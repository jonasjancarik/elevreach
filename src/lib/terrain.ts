import { type BoundaryGeoJson } from './boundary';
import { latToWorldY, lonToWorldX, metersPerPixel, tileSize, worldXToLon, worldYToLat } from './mercator';

export interface TerrainDataset {
  zoom: number;
  sampleStep: number;
  cols: number;
  rows: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  overlayBounds: [[number, number], [number, number]];
  elevations: Float32Array;
  insideMask: Uint8Array;
  rowAreaKm2: Float64Array;
  bbox: [number, number, number, number];
}

type BoundaryGeometry = BoundaryGeoJson['features'][number]['geometry'];

interface LoadTerrainOptions {
  zoom: number;
  sampleStep: number;
  onProgress?: (loaded: number, total: number) => void;
}

export async function loadTerrainDataset(
  boundary: BoundaryGeoJson,
  options: LoadTerrainOptions,
): Promise<TerrainDataset> {
  const geometry = boundary.features[0]?.geometry;

  if (!geometry) {
    throw new Error('Boundary geometry missing.');
  }

  const bbox = boundary.bbox;
  const xPadding = 8;
  const yPadding = 8;
  const xMin = Math.floor(lonToWorldX(bbox[0], options.zoom)) - xPadding;
  const yMin = Math.floor(latToWorldY(bbox[3], options.zoom)) - yPadding;
  const xMax = Math.ceil(lonToWorldX(bbox[2], options.zoom)) + xPadding;
  const yMax = Math.ceil(latToWorldY(bbox[1], options.zoom)) + yPadding;
  const cols = Math.floor((xMax - xMin) / options.sampleStep) + 1;
  const rows = Math.floor((yMax - yMin) / options.sampleStep) + 1;

  const tileMinX = Math.floor(xMin / tileSize());
  const tileMaxX = Math.floor(xMax / tileSize());
  const tileMinY = Math.floor(yMin / tileSize());
  const tileMaxY = Math.floor(yMax / tileSize());
  const tileKeys: Array<[number, number]> = [];

  for (let tileY = tileMinY; tileY <= tileMaxY; tileY += 1) {
    for (let tileX = tileMinX; tileX <= tileMaxX; tileX += 1) {
      tileKeys.push([tileX, tileY]);
    }
  }

  const totalTiles = tileKeys.length;
  let loadedTiles = 0;

  const tiles = new Map<string, Uint8ClampedArray>();
  await Promise.all(
    tileKeys.map(async ([tileX, tileY]) => {
      const data = await loadTerrariumTile(tileX, tileY, options.zoom);
      tiles.set(key(tileX, tileY), data);
      loadedTiles += 1;
      options.onProgress?.(loadedTiles, totalTiles);
    }),
  );

  const insideMask = rasterizeInsideMask(
    geometry,
    cols,
    rows,
    xMin,
    yMin,
    options.zoom,
    options.sampleStep,
  );
  const elevations = new Float32Array(cols * rows);
  const rowAreaKm2 = new Float64Array(rows);

  for (let row = 0; row < rows; row += 1) {
    const worldY = yMin + row * options.sampleStep;
    const tileY = Math.floor(worldY / tileSize());
    const localY = Math.floor(worldY - tileY * tileSize());
    const lat = worldYToLat(worldY, options.zoom);
    const pixelMeters = metersPerPixel(lat, options.zoom) * options.sampleStep;

    rowAreaKm2[row] = (pixelMeters * pixelMeters) / 1_000_000;

    for (let col = 0; col < cols; col += 1) {
      const worldX = xMin + col * options.sampleStep;
      const tileX = Math.floor(worldX / tileSize());
      const localX = Math.floor(worldX - tileX * tileSize());
      const tile = tiles.get(key(tileX, tileY));

      if (!tile) {
        throw new Error(`Missing terrain tile ${tileX}/${tileY}.`);
      }

      const offset = (localY * tileSize() + localX) * 4;
      elevations[index(cols, col, row)] = decodeTerrarium(tile, offset);
    }
  }

  return {
    zoom: options.zoom,
    sampleStep: options.sampleStep,
    cols,
    rows,
    xMin,
    yMin,
    xMax,
    yMax,
    overlayBounds: [
      [worldYToLat(yMax, options.zoom), worldXToLon(xMin, options.zoom)],
      [worldYToLat(yMin, options.zoom), worldXToLon(xMax, options.zoom)],
    ],
    elevations,
    insideMask,
    rowAreaKm2,
    bbox,
  };
}

export function indexFromLatLng(
  dataset: TerrainDataset,
  lng: number,
  lat: number,
) {
  const col = Math.round((lonToWorldX(lng, dataset.zoom) - dataset.xMin) / dataset.sampleStep);
  const row = Math.round((latToWorldY(lat, dataset.zoom) - dataset.yMin) / dataset.sampleStep);

  return findNearestInsideIndex(dataset, col, row);
}

export function findNearestInsideIndex(
  dataset: TerrainDataset,
  roughCol: number,
  roughRow: number,
  maxRadius = 28,
) {
  const startCol = clamp(Math.round(roughCol), 0, dataset.cols - 1);
  const startRow = clamp(Math.round(roughRow), 0, dataset.rows - 1);
  const directIndex = index(dataset.cols, startCol, startRow);

  if (dataset.insideMask[directIndex] === 1) {
    return directIndex;
  }

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let row = startRow - radius; row <= startRow + radius; row += 1) {
      for (let col = startCol - radius; col <= startCol + radius; col += 1) {
        if (
          row < 0 ||
          row >= dataset.rows ||
          col < 0 ||
          col >= dataset.cols ||
          (Math.abs(row - startRow) !== radius && Math.abs(col - startCol) !== radius)
        ) {
          continue;
        }

        const currentIndex = index(dataset.cols, col, row);

        if (dataset.insideMask[currentIndex] === 1) {
          return currentIndex;
        }
      }
    }
  }

  return null;
}

export function cellLatLng(dataset: TerrainDataset, cellIndex: number) {
  const row = Math.floor(cellIndex / dataset.cols);
  const col = cellIndex - row * dataset.cols;
  const worldX = dataset.xMin + col * dataset.sampleStep;
  const worldY = dataset.yMin + row * dataset.sampleStep;

  return {
    lat: worldYToLat(worldY, dataset.zoom),
    lng: worldXToLon(worldX, dataset.zoom),
  };
}

export function elevationAtIndex(dataset: TerrainDataset, cellIndex: number) {
  return dataset.elevations[cellIndex];
}

export function gridIndex(dataset: TerrainDataset, col: number, row: number) {
  return index(dataset.cols, col, row);
}

function rasterizeInsideMask(
  geometry: BoundaryGeometry,
  cols: number,
  rows: number,
  xMin: number,
  yMin: number,
  zoom: number,
  sampleStep: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas not available for boundary mask.');
  }

  context.fillStyle = '#ffffff';
  context.beginPath();

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([lng, lat], ringIndex) => {
        const x = (lonToWorldX(lng, zoom) - xMin) / sampleStep;
        const y = (latToWorldY(lat, zoom) - yMin) / sampleStep;

        if (ringIndex === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
    });
  });

  context.fill('evenodd');

  const imageData = context.getImageData(0, 0, cols, rows).data;
  const mask = new Uint8Array(cols * rows);

  for (let cellIndex = 0; cellIndex < mask.length; cellIndex += 1) {
    mask[cellIndex] = imageData[cellIndex * 4 + 3] > 0 ? 1 : 0;
  }

  return mask;
}

async function loadTerrariumTile(tileX: number, tileY: number, zoom: number) {
  const response = await fetch(
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${tileY}.png`,
  );

  if (!response.ok) {
    throw new Error(`Terrain tile failed: ${zoom}/${tileX}/${tileY}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas not available for terrain decoding.');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return context.getImageData(0, 0, width, height).data;
}

function decodeTerrarium(tile: Uint8ClampedArray, offset: number) {
  return tile[offset] * 256 + tile[offset + 1] + tile[offset + 2] / 256 - 32768;
}

function key(tileX: number, tileY: number) {
  return `${tileX}:${tileY}`;
}

function index(cols: number, col: number, row: number) {
  return row * cols + col;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
