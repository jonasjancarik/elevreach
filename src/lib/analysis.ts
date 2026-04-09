import type { ExtraTraversalEdge } from './city-connectors';
import { gridIndex, type TerrainDataset } from './terrain';
import { MinHeap } from './min-heap';

export type AnalysisMode = 'band' | 'ceiling' | 'ascent';

export interface StreetReachabilityMeta {
  reachableRoadKm: number;
  segmentCosts: Float32Array;
  snappedDistanceMeters: number;
  sourceNodeIndex: number;
}

export interface AnalysisOptions {
  activeMask: Uint8Array;
  extraEdges: readonly ExtraTraversalEdge[];
  sourceIndex: number;
  mode: AnalysisMode;
  upperAllowance: number;
  lowerAllowance: number;
  ascentBudget: number;
  ascentRoundTrip: boolean;
  contiguousOnly: boolean;
}

export interface AnalysisResult {
  mask: Uint8Array;
  sourceElevation: number;
  matchedAreaKm2: number;
  insideAreaKm2: number;
  costs: Float32Array | null;
  maxCost: number;
  street: StreetReachabilityMeta | null;
}

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

export function runElevationAnalysis(
  dataset: TerrainDataset,
  options: AnalysisOptions,
): AnalysisResult {
  const extraEdgeLookup = buildExtraEdgeLookup(options.extraEdges);
  const sourceElevation = dataset.elevations[options.sourceIndex];
  const insideArea = summarizeAreas(dataset, options.activeMask, options.activeMask);

  if (options.mode === 'ascent') {
    const { mask, costs } = ascentBudgetMask(
      dataset,
      options.activeMask,
      extraEdgeLookup,
      options.sourceIndex,
      options.ascentBudget,
      options.ascentRoundTrip,
    );
    const { matchedAreaKm2 } = summarizeAreas(dataset, mask, options.activeMask);

    return {
      mask,
      sourceElevation,
      matchedAreaKm2,
      insideAreaKm2: insideArea.insideAreaKm2,
      costs,
      maxCost: options.ascentBudget,
      street: null,
    };
  }

  const upperLimit = sourceElevation + options.upperAllowance;
  const lowerLimit =
    options.mode === 'ceiling'
      ? Number.NEGATIVE_INFINITY
      : sourceElevation - options.lowerAllowance;
  const candidateMask = new Uint8Array(dataset.elevations.length);

  for (let cellIndex = 0; cellIndex < dataset.elevations.length; cellIndex += 1) {
    if (options.activeMask[cellIndex] === 0) {
      continue;
    }

    const elevation = dataset.elevations[cellIndex];

    if (elevation >= lowerLimit && elevation <= upperLimit) {
      candidateMask[cellIndex] = 1;
    }
  }

  const mask = options.contiguousOnly
    ? connectedMask(
        dataset,
        options.activeMask,
        candidateMask,
        extraEdgeLookup,
        options.sourceIndex,
      )
    : candidateMask;
  const { matchedAreaKm2, insideAreaKm2 } = summarizeAreas(
    dataset,
    mask,
    options.activeMask,
  );

  return {
    mask,
    sourceElevation,
    matchedAreaKm2,
    insideAreaKm2,
    costs: null,
    maxCost: 0,
    street: null,
  };
}

function connectedMask(
  dataset: TerrainDataset,
  activeMask: Uint8Array,
  candidateMask: Uint8Array,
  extraEdgeLookup: ExtraEdgeLookup,
  sourceIndex: number,
) {
  if (candidateMask[sourceIndex] === 0 || activeMask[sourceIndex] === 0) {
    return new Uint8Array(candidateMask.length);
  }

  const queue = new Uint32Array(candidateMask.length);
  const mask = new Uint8Array(candidateMask.length);
  let head = 0;
  let tail = 0;

  queue[tail] = sourceIndex;
  tail += 1;
  mask[sourceIndex] = 1;

  while (head < tail) {
    const cellIndex = queue[head];
    head += 1;

    forEachTraversalEdge(dataset, cellIndex, extraEdgeLookup, (nextIndex) => {
      if (candidateMask[nextIndex] === 0 || mask[nextIndex] === 1) {
        return;
      }

      mask[nextIndex] = 1;
      queue[tail] = nextIndex;
      tail += 1;
    });
  }

  return mask;
}

function ascentBudgetMask(
  dataset: TerrainDataset,
  activeMask: Uint8Array,
  extraEdgeLookup: ExtraEdgeLookup,
  sourceIndex: number,
  ascentBudget: number,
  roundTrip: boolean,
) {
  const outwardCosts = leastAscentCosts(
    dataset,
    activeMask,
    extraEdgeLookup,
    sourceIndex,
    false,
  );
  const returnCosts = roundTrip
    ? leastAscentCosts(dataset, activeMask, extraEdgeLookup, sourceIndex, true)
    : null;
  const costs = new Float32Array(dataset.elevations.length);
  costs.fill(Number.POSITIVE_INFINITY);
  const mask = new Uint8Array(dataset.elevations.length);

  for (let cellIndex = 0; cellIndex < dataset.elevations.length; cellIndex += 1) {
    if (activeMask[cellIndex] === 0) {
      continue;
    }

    const totalCost =
      outwardCosts[cellIndex] +
      (returnCosts ? returnCosts[cellIndex] : 0);

    costs[cellIndex] = totalCost;

    if (totalCost <= ascentBudget) {
      mask[cellIndex] = 1;
    }
  }

  return {
    mask,
    costs,
  };
}

function leastAscentCosts(
  dataset: TerrainDataset,
  activeMask: Uint8Array,
  extraEdgeLookup: ExtraEdgeLookup,
  sourceIndex: number,
  reverse: boolean,
) {
  const costs = new Float32Array(dataset.elevations.length);
  costs.fill(Number.POSITIVE_INFINITY);

  const queue = new MinHeap();
  costs[sourceIndex] = 0;
  queue.push(sourceIndex, 0);

  while (queue.size > 0) {
    const current = queue.pop();

    if (!current || current.cost !== costs[current.index]) {
      continue;
    }

    const currentElevation = dataset.elevations[current.index];

    forEachTraversalEdge(
      dataset,
      current.index,
      extraEdgeLookup,
      (nextIndex, syntheticCost) => {
      if (activeMask[nextIndex] === 0) {
        return;
      }

      const rise =
        syntheticCost ??
        (() => {
          const nextElevation = dataset.elevations[nextIndex];
          return reverse
            ? Math.max(0, currentElevation - nextElevation)
            : Math.max(0, nextElevation - currentElevation);
        })();
      const nextCost = current.cost + rise;

      if (nextCost >= costs[nextIndex]) {
        return;
      }

      costs[nextIndex] = nextCost;
      queue.push(nextIndex, nextCost);
      },
    );
  }

  return costs;
}

type ExtraEdgeLookup = Map<number, Array<{ cost: number; toIndex: number }>>;

function buildExtraEdgeLookup(extraEdges: readonly ExtraTraversalEdge[]) {
  const lookup: ExtraEdgeLookup = new Map();

  extraEdges.forEach(({ fromIndex, toIndex, cost }) => {
    pushExtraEdge(lookup, fromIndex, toIndex, cost);
    pushExtraEdge(lookup, toIndex, fromIndex, cost);
  });

  return lookup;
}

function pushExtraEdge(
  lookup: ExtraEdgeLookup,
  fromIndex: number,
  toIndex: number,
  cost: number,
) {
  const edges = lookup.get(fromIndex);

  if (edges) {
    edges.push({ toIndex, cost });
    return;
  }

  lookup.set(fromIndex, [{ toIndex, cost }]);
}

function forEachTraversalEdge(
  dataset: TerrainDataset,
  cellIndex: number,
  extraEdgeLookup: ExtraEdgeLookup,
  visit: (nextIndex: number, syntheticCost: number | null) => void,
) {
  const row = Math.floor(cellIndex / dataset.cols);
  const col = cellIndex - row * dataset.cols;

  NEIGHBORS.forEach(([dx, dy]) => {
    const nextCol = col + dx;
    const nextRow = row + dy;

    if (
      nextCol < 0 ||
      nextCol >= dataset.cols ||
      nextRow < 0 ||
      nextRow >= dataset.rows
    ) {
      return;
    }

    visit(gridIndex(dataset, nextCol, nextRow), null);
  });

  extraEdgeLookup.get(cellIndex)?.forEach(({ toIndex, cost }) => {
    visit(toIndex, cost);
  });
}

function summarizeAreas(
  dataset: TerrainDataset,
  mask: Uint8Array,
  activeMask: Uint8Array,
) {
  let matchedAreaKm2 = 0;
  let insideAreaKm2 = 0;

  for (let row = 0; row < dataset.rows; row += 1) {
    let matchedCells = 0;
    let insideCells = 0;

    for (let col = 0; col < dataset.cols; col += 1) {
      const cellIndex = gridIndex(dataset, col, row);

      if (activeMask[cellIndex] === 1) {
        insideCells += 1;
      }

      if (mask[cellIndex] === 1) {
        matchedCells += 1;
      }
    }

    insideAreaKm2 += insideCells * dataset.rowAreaKm2[row];
    matchedAreaKm2 += matchedCells * dataset.rowAreaKm2[row];
  }

  return {
    matchedAreaKm2,
    insideAreaKm2,
  };
}
