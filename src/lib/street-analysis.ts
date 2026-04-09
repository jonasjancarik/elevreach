import type { AnalysisResult, StreetReachabilityMeta } from './analysis';
import { MinHeap } from './min-heap';
import type { StreetGraph } from './street-graph';
import { findNearestStreetNode } from './street-graph';
import type { TerrainDataset } from './terrain';
import { cellLatLng, gridIndex } from './terrain';

export interface StreetAnalysisOptions {
  activeMask: Uint8Array;
  ascentBudget: number;
  dataset: TerrainDataset;
  graph: StreetGraph;
  roundTrip: boolean;
  sourceIndex: number;
}

export function runStreetAnalysis(
  options: StreetAnalysisOptions,
): AnalysisResult | null {
  const sourceNode = findNearestStreetNode(
    options.graph,
    options.dataset,
    options.sourceIndex,
    options.activeMask,
  );

  if (!sourceNode) {
    return null;
  }

  const outwardCosts = leastCostNodes(
    options.graph.adjacency,
    options.graph,
    options.activeMask,
    sourceNode.nodeIndex,
  );
  const returnCosts = options.roundTrip
    ? leastCostNodes(
        options.graph.reverseAdjacency,
        options.graph,
        options.activeMask,
        sourceNode.nodeIndex,
      )
    : null;

  const totalNodeCosts = new Float32Array(options.graph.nodes.length);
  totalNodeCosts.fill(Number.POSITIVE_INFINITY);

  for (let nodeIndex = 0; nodeIndex < options.graph.nodes.length; nodeIndex += 1) {
    const outwardCost = outwardCosts[nodeIndex];

    if (!Number.isFinite(outwardCost)) {
      continue;
    }

    const totalCost = outwardCost + (returnCosts ? returnCosts[nodeIndex] : 0);
    totalNodeCosts[nodeIndex] = totalCost;
  }

  const segmentCosts = new Float32Array(options.graph.segments.length);
  segmentCosts.fill(Number.POSITIVE_INFINITY);
  let reachableRoadMeters = 0;

  for (let segmentIndex = 0; segmentIndex < options.graph.segments.length; segmentIndex += 1) {
    const segment = options.graph.segments[segmentIndex];
    const fromCost = totalNodeCosts[segment.from];
    const toCost = totalNodeCosts[segment.to];
    const segmentCost = Math.min(fromCost, toCost);

    if (!Number.isFinite(segmentCost) || segmentCost > options.ascentBudget) {
      continue;
    }

    segmentCosts[segmentIndex] = segmentCost;
    reachableRoadMeters += segment.distanceMeters;
  }

  const mask = rasterizeReachableSegments(options.dataset, options.graph, segmentCosts, options.activeMask);
  const { insideAreaKm2, matchedAreaKm2 } = summarizeAreas(options.dataset, mask, options.activeMask);
  const sourceElevation = options.dataset.elevations[options.sourceIndex];
  const snappedNode = options.graph.nodes[sourceNode.nodeIndex];
  const sourcePoint = cellLatLng(options.dataset, options.sourceIndex);

  return {
    costs: null,
    insideAreaKm2,
    mask,
    matchedAreaKm2,
    maxCost: options.ascentBudget,
    sourceElevation,
    street: {
      reachableRoadKm: reachableRoadMeters / 1000,
      segmentCosts,
      snappedDistanceMeters: haversineMeters(
        sourcePoint.lat,
        sourcePoint.lng,
        snappedNode.lat,
        snappedNode.lng,
      ),
      sourceNodeIndex: sourceNode.nodeIndex,
    } satisfies StreetReachabilityMeta,
  };
}

function leastCostNodes(
  adjacency: StreetGraph['adjacency'],
  graph: StreetGraph,
  activeMask: Uint8Array,
  sourceNodeIndex: number,
) {
  const costs = new Float32Array(graph.nodes.length);
  costs.fill(Number.POSITIVE_INFINITY);

  const queue = new MinHeap();
  costs[sourceNodeIndex] = 0;
  queue.push(sourceNodeIndex, 0);

  while (queue.size > 0) {
    const current = queue.pop();

    if (!current || current.cost !== costs[current.index]) {
      continue;
    }

    if (activeMask[graph.nodes[current.index].cellIndex] === 0) {
      continue;
    }

    adjacency[current.index].forEach((arc) => {
      if (activeMask[graph.nodes[arc.to].cellIndex] === 0) {
        return;
      }

      const nextCost = current.cost + arc.cost;

      if (nextCost >= costs[arc.to]) {
        return;
      }

      costs[arc.to] = nextCost;
      queue.push(arc.to, nextCost);
    });
  }

  return costs;
}

function rasterizeReachableSegments(
  dataset: TerrainDataset,
  graph: StreetGraph,
  segmentCosts: Float32Array,
  activeMask: Uint8Array,
) {
  const mask = new Uint8Array(dataset.elevations.length);

  for (let segmentIndex = 0; segmentIndex < graph.segments.length; segmentIndex += 1) {
    if (!Number.isFinite(segmentCosts[segmentIndex])) {
      continue;
    }

    const segment = graph.segments[segmentIndex];
    const fromCellIndex = graph.nodes[segment.from].cellIndex;
    const toCellIndex = graph.nodes[segment.to].cellIndex;
    const fromRow = Math.floor(fromCellIndex / dataset.cols);
    const fromCol = fromCellIndex - fromRow * dataset.cols;
    const toRow = Math.floor(toCellIndex / dataset.cols);
    const toCol = toCellIndex - toRow * dataset.cols;

    paintLine(mask, activeMask, dataset, fromCol, fromRow, toCol, toRow);
  }

  return mask;
}

function paintLine(
  mask: Uint8Array,
  activeMask: Uint8Array,
  dataset: TerrainDataset,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
) {
  const deltaCol = toCol - fromCol;
  const deltaRow = toRow - fromRow;
  const steps = Math.max(Math.abs(deltaCol), Math.abs(deltaRow), 1);

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const col = Math.round(fromCol + deltaCol * ratio);
    const row = Math.round(fromRow + deltaRow * ratio);

    paintDisk(mask, activeMask, dataset, col, row);
  }
}

function paintDisk(
  mask: Uint8Array,
  activeMask: Uint8Array,
  dataset: TerrainDataset,
  centerCol: number,
  centerRow: number,
) {
  for (let row = centerRow - 1; row <= centerRow + 1; row += 1) {
    for (let col = centerCol - 1; col <= centerCol + 1; col += 1) {
      if (col < 0 || col >= dataset.cols || row < 0 || row >= dataset.rows) {
        continue;
      }

      const cellIndex = gridIndex(dataset, col, row);

      if (activeMask[cellIndex] === 0) {
        continue;
      }

      mask[cellIndex] = 1;
    }
  }
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
    insideAreaKm2,
    matchedAreaKm2,
  };
}

function haversineMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
) {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a =
    sinLat * sinLat +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      sinLng *
      sinLng;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
