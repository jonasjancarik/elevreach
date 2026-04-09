import { type TerrainDataset, cellLatLng, indexFromLatLngClamped } from './terrain';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;
const QUERY_PADDING_KM = 0.75;

const ALLOWED_HIGHWAYS = new Set([
  'cycleway',
  'living_street',
  'primary',
  'primary_link',
  'residential',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
]);

const EXCLUDED_SERVICE_VALUES = new Set([
  'drive-through',
  'driveway',
  'emergency_access',
  'parking',
  'parking_aisle',
  'private',
]);

interface OverpassNodeElement {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWayElement {
  type: 'way';
  id: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: Array<OverpassNodeElement | OverpassWayElement>;
}

export interface StreetGraphNode {
  cellIndex: number;
  componentSize: number;
  elevation: number;
  lat: number;
  lng: number;
}

export interface StreetGraphSegment {
  backwardAllowed: boolean;
  backwardCost: number;
  distanceMeters: number;
  forwardAllowed: boolean;
  forwardCost: number;
  from: number;
  to: number;
}

export interface StreetGraphArc {
  cost: number;
  segmentIndex: number;
  to: number;
}

export interface StreetGraph {
  adjacency: StreetGraphArc[][];
  cacheKey: string;
  center: {
    lat: number;
    lng: number;
  };
  queryRadiusKm: number;
  reverseAdjacency: StreetGraphArc[][];
  segments: StreetGraphSegment[];
  sourceCellIndex: number;
  sourceRadiusKm: number;
  nodes: StreetGraphNode[];
}

const graphCache = new Map<string, Promise<StreetGraph>>();

export function streetGraphCacheKey(
  dataset: TerrainDataset,
  sourceIndex: number,
  radiusKm: number,
) {
  const center = cellLatLng(dataset, sourceIndex);
  const roundedRadiusKm = Math.max(2, Math.ceil(radiusKm + QUERY_PADDING_KM));

  return [
    'street-v1',
    center.lat.toFixed(3),
    center.lng.toFixed(3),
    roundedRadiusKm.toFixed(0),
  ].join(':');
}

export function loadStreetGraphForRadius(
  dataset: TerrainDataset,
  sourceIndex: number,
  radiusKm: number,
) {
  const center = cellLatLng(dataset, sourceIndex);
  const roundedRadiusKm = Math.max(2, Math.ceil(radiusKm + QUERY_PADDING_KM));
  const cacheKey = streetGraphCacheKey(dataset, sourceIndex, radiusKm);
  const cached = graphCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = fetchStreetGraph(dataset, center.lat, center.lng, roundedRadiusKm, {
    cacheKey,
    sourceCellIndex: sourceIndex,
    sourceRadiusKm: radiusKm,
  }).catch((error) => {
    graphCache.delete(cacheKey);
    throw error;
  });

  graphCache.set(cacheKey, pending);

  return pending;
}

export function findNearestStreetNode(
  graph: StreetGraph,
  dataset: TerrainDataset,
  sourceIndex: number,
  activeMask: Uint8Array,
  maxSnapMeters = 900,
) {
  const sourcePoint = cellLatLng(dataset, sourceIndex);
  let bestConnectedNodeIndex: number | null = null;
  let bestConnectedDistanceMeters = Number.POSITIVE_INFINITY;
  let bestNodeIndex: number | null = null;
  let bestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let nodeIndex = 0; nodeIndex < graph.nodes.length; nodeIndex += 1) {
    const node = graph.nodes[nodeIndex];

    if (activeMask[node.cellIndex] === 0) {
      continue;
    }

    const distanceMeters = haversineMeters(
      sourcePoint.lat,
      sourcePoint.lng,
      node.lat,
      node.lng,
    );

    if (distanceMeters >= bestDistanceMeters) {
      continue;
    }

    bestDistanceMeters = distanceMeters;
    bestNodeIndex = nodeIndex;

    if (node.componentSize >= 24 && distanceMeters < bestConnectedDistanceMeters) {
      bestConnectedDistanceMeters = distanceMeters;
      bestConnectedNodeIndex = nodeIndex;
    }
  }

  const preferredNodeIndex = bestConnectedNodeIndex ?? bestNodeIndex;
  const preferredDistanceMeters =
    bestConnectedNodeIndex !== null
      ? bestConnectedDistanceMeters
      : bestDistanceMeters;

  if (preferredNodeIndex === null || preferredDistanceMeters > maxSnapMeters) {
    return null;
  }

  return {
    distanceMeters: preferredDistanceMeters,
    nodeIndex: preferredNodeIndex,
  };
}

async function fetchStreetGraph(
  dataset: TerrainDataset,
  centerLat: number,
  centerLng: number,
  queryRadiusKm: number,
  meta: {
    cacheKey: string;
    sourceCellIndex: number;
    sourceRadiusKm: number;
  },
) {
  const data = await fetchOverpassResponse(centerLat, centerLng, queryRadiusKm);

  return buildStreetGraph(dataset, data, {
    cacheKey: meta.cacheKey,
    centerLat,
    centerLng,
    queryRadiusKm,
    sourceCellIndex: meta.sourceCellIndex,
    sourceRadiusKm: meta.sourceRadiusKm,
  });
}

function buildStreetGraph(
  dataset: TerrainDataset,
  data: OverpassResponse,
  meta: {
    cacheKey: string;
    centerLat: number;
    centerLng: number;
    queryRadiusKm: number;
    sourceCellIndex: number;
    sourceRadiusKm: number;
  },
) {
  const elements = data.elements ?? [];
  const rawNodes = new Map<number, OverpassNodeElement>();

  elements.forEach((element) => {
    if (element.type === 'node') {
      rawNodes.set(element.id, element);
    }
  });

  const nodes: StreetGraphNode[] = [];
  const adjacency: StreetGraphArc[][] = [];
  const reverseAdjacency: StreetGraphArc[][] = [];
  const undirectedAdjacency: number[][] = [];
  const segments: StreetGraphSegment[] = [];
  const graphNodeIndexes = new Map<number, number>();

  const ensureGraphNode = (osmNodeId: number) => {
    const existing = graphNodeIndexes.get(osmNodeId);

    if (existing !== undefined) {
      return existing;
    }

    const rawNode = rawNodes.get(osmNodeId);

    if (!rawNode) {
      return null;
    }

    const cellIndex = indexFromLatLngClamped(dataset, rawNode.lon, rawNode.lat);
    const graphNodeIndex = nodes.length;

    nodes.push({
      cellIndex,
      componentSize: 0,
      elevation: dataset.elevations[cellIndex],
      lat: rawNode.lat,
      lng: rawNode.lon,
    });
    adjacency.push([]);
    reverseAdjacency.push([]);
    undirectedAdjacency.push([]);
    graphNodeIndexes.set(osmNodeId, graphNodeIndex);

    return graphNodeIndex;
  };

  elements.forEach((element) => {
    if (element.type !== 'way' || !isRideableWay(element.tags)) {
      return;
    }

    const refs = element.nodes ?? [];

    if (refs.length < 2) {
      return;
    }

    const direction = edgeDirection(element.tags);

    for (let refIndex = 1; refIndex < refs.length; refIndex += 1) {
      const fromNodeIndex = ensureGraphNode(refs[refIndex - 1]);
      const toNodeIndex = ensureGraphNode(refs[refIndex]);

      if (fromNodeIndex === null || toNodeIndex === null || fromNodeIndex === toNodeIndex) {
        continue;
      }

      const fromNode = nodes[fromNodeIndex];
      const toNode = nodes[toNodeIndex];
      const distanceMeters = haversineMeters(
        fromNode.lat,
        fromNode.lng,
        toNode.lat,
        toNode.lng,
      );

      if (!Number.isFinite(distanceMeters) || distanceMeters < 4) {
        continue;
      }

      const segmentIndex = segments.length;
      const forwardCost = streetEffortCost(
        distanceMeters,
        Math.max(0, toNode.elevation - fromNode.elevation),
      );
      const backwardCost = streetEffortCost(
        distanceMeters,
        Math.max(0, fromNode.elevation - toNode.elevation),
      );
      const forwardAllowed = direction !== 'backward';
      const backwardAllowed = direction !== 'forward';

      segments.push({
        backwardAllowed,
        backwardCost,
        distanceMeters,
        forwardAllowed,
        forwardCost,
        from: fromNodeIndex,
        to: toNodeIndex,
      });
      undirectedAdjacency[fromNodeIndex].push(toNodeIndex);
      undirectedAdjacency[toNodeIndex].push(fromNodeIndex);

      if (forwardAllowed) {
        pushArc(adjacency, reverseAdjacency, fromNodeIndex, toNodeIndex, segmentIndex, forwardCost);
      }

      if (backwardAllowed) {
        pushArc(adjacency, reverseAdjacency, toNodeIndex, fromNodeIndex, segmentIndex, backwardCost);
      }
    }
  });

  if (nodes.length === 0 || segments.length === 0) {
    throw new Error('Street graph came back empty for this area.');
  }

  assignComponentSizes(nodes, undirectedAdjacency);

  return {
    adjacency,
    cacheKey: meta.cacheKey,
    center: {
      lat: meta.centerLat,
      lng: meta.centerLng,
    },
    nodes,
    queryRadiusKm: meta.queryRadiusKm,
    reverseAdjacency,
    segments,
    sourceCellIndex: meta.sourceCellIndex,
    sourceRadiusKm: meta.sourceRadiusKm,
  } satisfies StreetGraph;
}

function pushArc(
  adjacency: StreetGraphArc[][],
  reverseAdjacency: StreetGraphArc[][],
  from: number,
  to: number,
  segmentIndex: number,
  cost: number,
) {
  const arc = {
    cost,
    segmentIndex,
    to,
  } satisfies StreetGraphArc;

  adjacency[from].push(arc);
  reverseAdjacency[to].push({
    cost,
    segmentIndex,
    to: from,
  });
}

async function fetchOverpassResponse(
  centerLat: number,
  centerLng: number,
  queryRadiusKm: number,
) {
  const body = buildOverpassQuery(centerLat, centerLng, queryRadiusKm * 1000);
  const failures: string[] = [];

  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        body,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        method: 'POST',
      });

      if (!response.ok) {
        failures.push(`${url} -> ${response.status}`);
        continue;
      }

      return (await response.json()) as OverpassResponse;
    } catch (error) {
      failures.push(
        `${url} -> ${error instanceof Error ? error.message : 'request failed'}`,
      );
    }
  }

  throw new Error(`Street graph load failed: ${failures.join('; ')}`);
}

function buildOverpassQuery(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
) {
  return [
    '[out:json][timeout:25];',
    '(',
    `  way["highway"~"^(cycleway|living_street|primary|primary_link|residential|secondary|secondary_link|tertiary|tertiary_link|unclassified)$"]["access"!~"^(private|no)$"]["bicycle"!~"^(no)$"](around:${Math.round(radiusMeters)},${centerLat},${centerLng});`,
    ');',
    'out body;',
    '>;',
    'out skel qt;',
  ].join('\n');
}

function isRideableWay(tags?: Record<string, string>) {
  const highway = tags?.highway;

  if (!highway || !ALLOWED_HIGHWAYS.has(highway)) {
    return false;
  }

  if (tags?.access === 'private' || tags?.access === 'no' || tags?.bicycle === 'no') {
    return false;
  }

  if (highway === 'service' && tags?.service && EXCLUDED_SERVICE_VALUES.has(tags.service)) {
    return false;
  }

  return true;
}

function assignComponentSizes(
  nodes: StreetGraphNode[],
  adjacency: number[][],
) {
  const visited = new Uint8Array(nodes.length);
  const queue = new Uint32Array(nodes.length);

  for (let startIndex = 0; startIndex < nodes.length; startIndex += 1) {
    if (visited[startIndex] === 1) {
      continue;
    }

    let head = 0;
    let tail = 0;
    const componentNodes: number[] = [];

    visited[startIndex] = 1;
    queue[tail] = startIndex;
    tail += 1;

    while (head < tail) {
      const nodeIndex = queue[head];
      head += 1;
      componentNodes.push(nodeIndex);

      adjacency[nodeIndex].forEach((nextIndex) => {
        if (visited[nextIndex] === 1) {
          return;
        }

        visited[nextIndex] = 1;
        queue[tail] = nextIndex;
        tail += 1;
      });
    }

    componentNodes.forEach((nodeIndex) => {
      nodes[nodeIndex].componentSize = componentNodes.length;
    });
  }
}

function edgeDirection(tags?: Record<string, string>) {
  if (tags?.['oneway:bicycle'] === 'no') {
    return 'both';
  }

  if (tags?.oneway === '-1') {
    return 'backward';
  }

  if (
    tags?.oneway === 'yes' ||
    tags?.oneway === '1' ||
    tags?.junction === 'roundabout'
  ) {
    return 'forward';
  }

  return 'both';
}

function streetEffortCost(distanceMeters: number, uphillMeters: number) {
  const grade = uphillMeters / Math.max(distanceMeters, 1);
  const distancePenalty = distanceMeters * 0.002;
  const steepPenalty =
    grade <= 0.05 ? 0 : distanceMeters * (grade - 0.05) * 2.5;

  return uphillMeters + distancePenalty + steepPenalty;
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
