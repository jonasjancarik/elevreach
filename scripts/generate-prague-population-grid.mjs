import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromFile } from 'geotiff';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'data');
const BOUNDARY_PATH = path.join(OUTPUT_DIR, 'prague-boundary.geojson');
const TIFF_URL =
  'https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/CZE/cze_ppp_2020.tif';
const LOCAL_TIFF_PATH = '/tmp/worldpop-cze-2020.tif';
const OUTPUT_METADATA_PATH = path.join(OUTPUT_DIR, 'prague-population-grid.json');
const OUTPUT_BINARY_PATH = path.join(OUTPUT_DIR, 'prague-population-grid.bin');

const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE = 40_075_016.686;
const ZOOM = 12;
const SAMPLE_STEP = 2;
const X_PADDING = 8;
const Y_PADDING = 8;

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await ensureTiff();

  const boundary = JSON.parse(await readFile(BOUNDARY_PATH, 'utf8'));
  const bbox = boundary.features?.[0]?.bbox;

  if (!bbox || bbox.length !== 4) {
    throw new Error('Bundled Prague boundary bbox missing.');
  }

  const terrainGrid = buildTerrainGridMetadata(bbox);
  const tiff = await fromFile(LOCAL_TIFF_PATH);
  const image = await tiff.getImage();
  const raster = await readSubset(image, terrainGrid.bounds);
  const populationByCell = projectPopulationToTerrainGrid(terrainGrid, raster);

  const metadata = {
    cityQuery: 'Prague, Czechia',
    generatedAt: new Date().toISOString(),
    method:
      'Nearest WorldPop 2020 population pixel, converted to density and projected onto the bundled Prague terrain grid.',
    sampleStep: SAMPLE_STEP,
    sourceName: 'WorldPop Czech Republic population count 2020',
    sourceUrl: TIFF_URL,
    xMax: terrainGrid.xMax,
    xMin: terrainGrid.xMin,
    yMax: terrainGrid.yMax,
    yMin: terrainGrid.yMin,
    zoom: ZOOM,
    cols: terrainGrid.cols,
    rows: terrainGrid.rows,
    totalPopulation: round(sum(populationByCell), 0),
  };

  await writeFile(OUTPUT_BINARY_PATH, Buffer.from(populationByCell.buffer));
  await writeFile(OUTPUT_METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        binary: path.relative(ROOT, OUTPUT_BINARY_PATH),
        metadata: path.relative(ROOT, OUTPUT_METADATA_PATH),
        totalPopulation: metadata.totalPopulation,
      },
      null,
      2,
    ),
  );
}

async function ensureTiff() {
  try {
    const existing = await stat(LOCAL_TIFF_PATH);

    if (existing.size > 1_000_000) {
      return;
    }
  } catch {
    // download below
  }

  console.log(`Downloading ${TIFF_URL} -> ${LOCAL_TIFF_PATH}`);
  await new Promise((resolve, reject) => {
    const child = spawn(
      'curl',
      ['-L', '--fail', '-C', '-', '-o', LOCAL_TIFF_PATH, TIFF_URL],
      {
        stdio: 'inherit',
      },
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`WorldPop download failed with code ${code ?? 'unknown'}.`));
    });
  });
}

function buildTerrainGridMetadata(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox.map(Number);
  const xMin = Math.floor(lonToWorldX(minLng, ZOOM)) - X_PADDING;
  const yMin = Math.floor(latToWorldY(maxLat, ZOOM)) - Y_PADDING;
  const xMax = Math.ceil(lonToWorldX(maxLng, ZOOM)) + X_PADDING;
  const yMax = Math.ceil(latToWorldY(minLat, ZOOM)) + Y_PADDING;
  const cols = Math.floor((xMax - xMin) / SAMPLE_STEP) + 1;
  const rows = Math.floor((yMax - yMin) / SAMPLE_STEP) + 1;

  return {
    cols,
    rows,
    xMax,
    xMin,
    yMax,
    yMin,
    bounds: {
      maxLat: worldYToLat(yMin, ZOOM),
      maxLng: worldXToLon(xMax, ZOOM),
      minLat: worldYToLat(yMax, ZOOM),
      minLng: worldXToLon(xMin, ZOOM),
    },
  };
}

async function readSubset(image, bounds) {
  const [rasterMinLng, rasterMinLat, rasterMaxLng, rasterMaxLat] = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  const resolution = image.getResolution();
  const lngResolution = Math.abs(resolution[0]);
  const latResolution = Math.abs(resolution[1]);
  const left = clamp(
    Math.floor((bounds.minLng - rasterMinLng) / lngResolution) - 1,
    0,
    width - 1,
  );
  const right = clamp(
    Math.ceil((bounds.maxLng - rasterMinLng) / lngResolution) + 1,
    1,
    width,
  );
  const top = clamp(
    Math.floor((rasterMaxLat - bounds.maxLat) / latResolution) - 1,
    0,
    height - 1,
  );
  const bottom = clamp(
    Math.ceil((rasterMaxLat - bounds.minLat) / latResolution) + 1,
    1,
    height,
  );
  const values = await image.readRasters({
    interleave: true,
    window: [left, top, right, bottom],
  });

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    values,
    rasterMinLng,
    rasterMaxLat,
    lngResolution,
    latResolution,
    nodata: image.getGDALNoData(),
  };
}

function projectPopulationToTerrainGrid(terrainGrid, raster) {
  const result = new Float32Array(terrainGrid.cols * terrainGrid.rows);
  const rasterRowAreaM2 = new Float64Array(raster.height);
  const terrainRowAreaM2 = new Float64Array(terrainGrid.rows);

  for (let row = 0; row < raster.height; row += 1) {
    const lat = raster.rasterMaxLat - (raster.top + row + 0.5) * raster.latResolution;
    rasterRowAreaM2[row] = areaFromDegrees(lat, raster.lngResolution, raster.latResolution);
  }

  for (let row = 0; row < terrainGrid.rows; row += 1) {
    const worldY = terrainGrid.yMin + row * SAMPLE_STEP;
    const lat = worldYToLat(worldY, ZOOM);
    const pixelMeters = metersPerPixel(lat, ZOOM) * SAMPLE_STEP;
    terrainRowAreaM2[row] = pixelMeters * pixelMeters;
  }

  for (let row = 0; row < terrainGrid.rows; row += 1) {
    const worldY = terrainGrid.yMin + row * SAMPLE_STEP;
    const lat = worldYToLat(worldY, ZOOM);
    const rasterRow = clamp(
      Math.floor((raster.rasterMaxLat - lat) / raster.latResolution) - raster.top,
      0,
      raster.height - 1,
    );
    const terrainArea = terrainRowAreaM2[row];
    const rasterCellArea = rasterRowAreaM2[rasterRow];

    for (let col = 0; col < terrainGrid.cols; col += 1) {
      const worldX = terrainGrid.xMin + col * SAMPLE_STEP;
      const lng = worldXToLon(worldX, ZOOM);
      const rasterCol = clamp(
        Math.floor((lng - raster.rasterMinLng) / raster.lngResolution) - raster.left,
        0,
        raster.width - 1,
      );
      const rasterIndex = rasterRow * raster.width + rasterCol;
      const populationCount = raster.values[rasterIndex];

      if (
        populationCount === raster.nodata ||
        !Number.isFinite(populationCount) ||
        populationCount <= 0 ||
        rasterCellArea <= 0
      ) {
        continue;
      }

      result[row * terrainGrid.cols + col] =
        (populationCount / rasterCellArea) * terrainArea;
    }
  }

  return result;
}

function lonToWorldX(lon, zoom) {
  return ((lon + 180) / 360) * scale(zoom);
}

function latToWorldY(lat, zoom) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(Math.max(sinLat, -0.9999), 0.9999);

  return (
    (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) *
    scale(zoom)
  );
}

function worldXToLon(worldX, zoom) {
  return (worldX / scale(zoom)) * 360 - 180;
}

function worldYToLat(worldY, zoom) {
  const n = Math.PI - (2 * Math.PI * worldY) / scale(zoom);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

function metersPerPixel(lat, zoom) {
  return (
    (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
    scale(zoom)
  );
}

function scale(zoom) {
  return TILE_SIZE * 2 ** zoom;
}

function areaFromDegrees(lat, lngDegrees, latDegrees) {
  const latRadians = (lat * Math.PI) / 180;
  const metersPerDegreeLat =
    111_132.92 -
    559.82 * Math.cos(2 * latRadians) +
    1.175 * Math.cos(4 * latRadians) -
    0.0023 * Math.cos(6 * latRadians);
  const metersPerDegreeLng =
    111_412.84 * Math.cos(latRadians) -
    93.5 * Math.cos(3 * latRadians) +
    0.118 * Math.cos(5 * latRadians);

  return metersPerDegreeLat * latDegrees * metersPerDegreeLng * lngDegrees;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sum(values) {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
