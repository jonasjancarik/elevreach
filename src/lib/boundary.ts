type Ring = [number, number][];
type Polygon = Ring[];

interface GeoJsonFeature<TGeometry, TProperties> {
  type: 'Feature';
  geometry: TGeometry;
  properties: TProperties;
}

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Ring[];
}

interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Polygon[];
}

type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;

interface BoundaryProperties {
  display_name?: string;
  name?: string;
}

export interface BoundaryGeoJson {
  type: 'FeatureCollection';
  bbox: [number, number, number, number];
  features: Array<GeoJsonFeature<BoundaryGeometry, BoundaryProperties>>;
}

export interface LoadedBoundary {
  boundary: BoundaryGeoJson;
  label: string;
  query: string;
  source: 'bundled' | 'cache' | 'remote';
}

interface BoundaryQueryFix {
  canonicalQuery: string;
  labelOverride?: string;
  osmLookupId?: string;
  matches: RegExp[];
}

const DEFAULT_BOUNDARY_PATH = `${import.meta.env.BASE_URL}data/prague-boundary.geojson`;
const DEFAULT_CITY_QUERY = 'Prague, Czechia';
const BOUNDARY_CACHE_PREFIX = 'city-elevation:v2:boundary:';
const BOUNDARY_QUERY_FIXES: BoundaryQueryFix[] = [
  {
    canonicalQuery: 'Brussels, Brussels-Capital Region, Belgium',
    labelOverride: 'Brussels-Capital Region, Belgium',
    osmLookupId: 'R54094',
    matches: [
      /^brussels$/i,
      /^brussels,\s*belgium$/i,
      /^brussels,\s*brussels-capital,\s*belgium$/i,
      /^brussels,\s*brussels-capital region,\s*belgium$/i,
      /^bruxelles$/i,
      /^bruxelles,\s*belgique$/i,
      /^brussel$/i,
      /^brussel,\s*belgië$/i,
    ],
  },
];

export { DEFAULT_CITY_QUERY };

export async function loadBundledBoundary() {
  const response = await fetch(DEFAULT_BOUNDARY_PATH);

  if (!response.ok) {
    throw new Error(`Bundled boundary load failed: ${response.status}`);
  }

  const data = normalizeBoundary(
    (await response.json()) as BoundaryGeoJson,
    DEFAULT_CITY_QUERY,
  );

  return {
    boundary: data,
    label: boundaryLabel(data, DEFAULT_CITY_QUERY),
    query: DEFAULT_CITY_QUERY,
    source: 'bundled',
  } satisfies LoadedBoundary;
}

export async function searchCityBoundary(rawQuery: string) {
  const query = normalizeQuery(rawQuery);

  if (!query) {
    throw new Error('Enter a city name, ideally "City, Country".');
  }

  const fixedQuery = applyQueryFix(query);
  const cacheKey = `${BOUNDARY_CACHE_PREFIX}${fixedQuery.canonicalQuery.toLowerCase()}`;
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    polygon_geojson: '1',
    limit: '1',
    email: 'jonas.jancarik@gmail.com',
  });
  const response = await fetch(buildNominatimUrl(fixedQuery, params));

  if (!response.ok) {
    throw new Error(`Boundary search failed: ${response.status}`);
  }

  const normalized = normalizeBoundary(
    jsonv2ToBoundary((await response.json()) as LookupResponse, fixedQuery.canonicalQuery),
    fixedQuery.canonicalQuery,
  );

  if (!normalized.features[0]) {
    throw new Error(`No city boundary found for "${query}". Try "City, Country".`);
  }

  const loaded = {
    boundary: normalized,
    label: fixedQuery.labelOverride ?? boundaryLabel(normalized, fixedQuery.canonicalQuery),
    query: fixedQuery.canonicalQuery,
    source: 'remote',
  } satisfies LoadedBoundary;

  writeCache(cacheKey, loaded);

  return loaded;
}

function normalizeBoundary(
  data: BoundaryGeoJson,
  fallbackLabel: string,
) {
  const feature = data.features[0];

  if (!feature) {
    throw new Error(`Boundary data missing for ${fallbackLabel}.`);
  }

  return {
    ...data,
    bbox: data.bbox ?? deriveBbox(feature.geometry),
  } satisfies BoundaryGeoJson;
}

function boundaryLabel(boundary: BoundaryGeoJson, fallbackLabel: string) {
  const feature = boundary.features[0];
  return feature?.properties.display_name ?? feature?.properties.name ?? fallbackLabel;
}

function deriveBbox(geometry: BoundaryGeometry): [number, number, number, number] {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      });
    });
  });

  return [minLng, minLat, maxLng, maxLat];
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

function applyQueryFix(query: string) {
  const fix = BOUNDARY_QUERY_FIXES.find((candidate) =>
    candidate.matches.some((pattern) => pattern.test(query)),
  );

  if (!fix) {
    return {
      canonicalQuery: query,
      labelOverride: undefined,
    };
  }

  return {
    canonicalQuery: fix.canonicalQuery,
    labelOverride: fix.labelOverride,
    osmLookupId: fix.osmLookupId,
  };
}

interface LookupFeature {
  geojson?: BoundaryGeoJson['features'][number]['geometry'];
  boundingbox?: string[];
  display_name?: string;
  name?: string;
}

type LookupResponse = LookupFeature[] | { features?: unknown };

function buildNominatimUrl(
  fixedQuery: {
    canonicalQuery: string;
    osmLookupId?: string;
  },
  params: URLSearchParams,
) {
  if (fixedQuery.osmLookupId) {
    params.set('osm_ids', fixedQuery.osmLookupId);
    return `https://nominatim.openstreetmap.org/lookup?${params.toString()}`;
  }

  params.set('q', fixedQuery.canonicalQuery);
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

function jsonv2ToBoundary(data: LookupResponse, fallbackLabel: string): BoundaryGeoJson {
  if (!Array.isArray(data)) {
    throw new Error(`Boundary response malformed for ${fallbackLabel}.`);
  }

  const first = data[0];

  if (!first?.geojson) {
    return {
      type: 'FeatureCollection',
      bbox: [0, 0, 0, 0],
      features: [],
    };
  }

  const bbox =
    first.boundingbox && first.boundingbox.length === 4
      ? ([
          Number(first.boundingbox[2]),
          Number(first.boundingbox[0]),
          Number(first.boundingbox[3]),
          Number(first.boundingbox[1]),
        ] as [number, number, number, number])
      : deriveBbox(first.geojson);

  return {
    type: 'FeatureCollection',
    bbox,
    features: [
      {
        type: 'Feature',
        geometry: first.geojson,
        properties: {
          display_name: first.display_name,
          name: first.name,
        },
      },
    ],
  };
}

function readCache(cacheKey: string) {
  try {
    const raw = window.localStorage.getItem(cacheKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as LoadedBoundary;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, loaded: LoadedBoundary) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(loaded));
  } catch {
    // Ignore quota/privacy failures; the app still works uncached.
  }
}
