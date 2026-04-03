import type { TerrainDataset } from './terrain';

const PRAGUE_POPULATION_METADATA_URL = `${import.meta.env.BASE_URL}data/prague-population-grid.json`;
const PRAGUE_POPULATION_BINARY_URL = `${import.meta.env.BASE_URL}data/prague-population-grid.bin`;

interface PopulationMetadata {
  cityQuery: string;
  cols: number;
  generatedAt: string;
  method: string;
  rows: number;
  sampleStep: number;
  sourceName: string;
  sourceUrl: string;
  totalPopulation: number;
  xMax: number;
  xMin: number;
  yMax: number;
  yMin: number;
  zoom: number;
}

export interface PopulationDataset extends PopulationMetadata {
  values: Float32Array;
}

export interface PopulationSummary {
  matchedPopulation: number;
  activePopulation: number;
}

let cachedPromise: Promise<PopulationDataset | null> | null = null;

export async function loadPopulationDataset(
  dataset: TerrainDataset,
  cityLabel: string,
) {
  if (!isPrague(cityLabel)) {
    return null;
  }

  cachedPromise ??= loadBundledPopulationDataset();
  const populationDataset = await cachedPromise;

  if (!populationDataset || !matchesTerrainGrid(populationDataset, dataset)) {
    return null;
  }

  return populationDataset;
}

export function summarizePopulation(
  populationDataset: PopulationDataset,
  mask: Uint8Array,
  activeMask: Uint8Array,
): PopulationSummary {
  let matchedPopulation = 0;
  let activePopulation = 0;

  for (let index = 0; index < populationDataset.values.length; index += 1) {
    const population = populationDataset.values[index];

    if (population <= 0) {
      continue;
    }

    if (activeMask[index] === 1) {
      activePopulation += population;
    }

    if (mask[index] === 1) {
      matchedPopulation += population;
    }
  }

  return {
    matchedPopulation,
    activePopulation,
  };
}

async function loadBundledPopulationDataset() {
  const [metadataResponse, binaryResponse] = await Promise.all([
    fetch(PRAGUE_POPULATION_METADATA_URL),
    fetch(PRAGUE_POPULATION_BINARY_URL),
  ]);

  if (!metadataResponse.ok || !binaryResponse.ok) {
    return null;
  }

  const metadata = (await metadataResponse.json()) as PopulationMetadata;
  const buffer = await binaryResponse.arrayBuffer();
  const values = new Float32Array(buffer);

  if (values.length !== metadata.cols * metadata.rows) {
    throw new Error('Prague population grid size mismatch.');
  }

  return {
    ...metadata,
    values,
  } satisfies PopulationDataset;
}

function isPrague(cityLabel: string) {
  return /(^|,|\s)(prague|praha)(,|\s|$)/i.test(cityLabel);
}

function matchesTerrainGrid(
  populationDataset: PopulationMetadata,
  dataset: TerrainDataset,
) {
  return (
    populationDataset.zoom === dataset.zoom &&
    populationDataset.sampleStep === dataset.sampleStep &&
    populationDataset.cols === dataset.cols &&
    populationDataset.rows === dataset.rows &&
    populationDataset.xMin === dataset.xMin &&
    populationDataset.xMax === dataset.xMax &&
    populationDataset.yMin === dataset.yMin &&
    populationDataset.yMax === dataset.yMax
  );
}
