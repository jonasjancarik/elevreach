import { gridIndex, type TerrainDataset } from './terrain';

export type AnalysisMode = 'band' | 'ceiling' | 'ascent';

export interface AnalysisOptions {
  activeMask: Uint8Array;
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
  const sourceElevation = dataset.elevations[options.sourceIndex];
  const insideArea = summarizeAreas(dataset, options.activeMask, options.activeMask);

  if (options.mode === 'ascent') {
    const { mask, costs } = ascentBudgetMask(
      dataset,
      options.activeMask,
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
    ? connectedMask(dataset, options.activeMask, candidateMask, options.sourceIndex)
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
  };
}

function connectedMask(
  dataset: TerrainDataset,
  activeMask: Uint8Array,
  candidateMask: Uint8Array,
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

      const nextIndex = gridIndex(dataset, nextCol, nextRow);

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
  sourceIndex: number,
  ascentBudget: number,
  roundTrip: boolean,
) {
  const outwardCosts = leastAscentCosts(dataset, activeMask, sourceIndex, false);
  const returnCosts = roundTrip
    ? leastAscentCosts(dataset, activeMask, sourceIndex, true)
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

    const row = Math.floor(current.index / dataset.cols);
    const col = current.index - row * dataset.cols;
    const currentElevation = dataset.elevations[current.index];

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

      const nextIndex = gridIndex(dataset, nextCol, nextRow);

      if (activeMask[nextIndex] === 0) {
        return;
      }

      const nextElevation = dataset.elevations[nextIndex];
      const rise = reverse
        ? Math.max(0, currentElevation - nextElevation)
        : Math.max(0, nextElevation - currentElevation);
      const nextCost = current.cost + rise;

      if (nextCost >= costs[nextIndex]) {
        return;
      }

      costs[nextIndex] = nextCost;
      queue.push(nextIndex, nextCost);
    });
  }

  return costs;
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

interface HeapNode {
  index: number;
  cost: number;
}

class MinHeap {
  private readonly nodes: HeapNode[] = [];

  get size() {
    return this.nodes.length;
  }

  push(index: number, cost: number) {
    this.nodes.push({ index, cost });
    this.bubbleUp(this.nodes.length - 1);
  }

  pop() {
    const first = this.nodes[0];

    if (!first) {
      return null;
    }

    const last = this.nodes.pop();

    if (this.nodes.length > 0 && last) {
      this.nodes[0] = last;
      this.sinkDown(0);
    }

    return first;
  }

  private bubbleUp(startIndex: number) {
    let nodeIndex = startIndex;

    while (nodeIndex > 0) {
      const parentIndex = Math.floor((nodeIndex - 1) / 2);

      if (this.nodes[parentIndex].cost <= this.nodes[nodeIndex].cost) {
        break;
      }

      swap(this.nodes, nodeIndex, parentIndex);
      nodeIndex = parentIndex;
    }
  }

  private sinkDown(startIndex: number) {
    let nodeIndex = startIndex;

    while (true) {
      const leftIndex = nodeIndex * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = nodeIndex;

      if (
        leftIndex < this.nodes.length &&
        this.nodes[leftIndex].cost < this.nodes[smallestIndex].cost
      ) {
        smallestIndex = leftIndex;
      }

      if (
        rightIndex < this.nodes.length &&
        this.nodes[rightIndex].cost < this.nodes[smallestIndex].cost
      ) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === nodeIndex) {
        break;
      }

      swap(this.nodes, nodeIndex, smallestIndex);
      nodeIndex = smallestIndex;
    }
  }
}

function swap<TValue>(values: TValue[], leftIndex: number, rightIndex: number) {
  [values[leftIndex], values[rightIndex]] = [
    values[rightIndex],
    values[leftIndex],
  ];
}
