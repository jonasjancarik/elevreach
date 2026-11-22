import L from 'leaflet';

export type BasemapTone = 'light' | 'dark';

interface BasemapDefinition {
  attribution: string;
  maxZoom: number;
  url: string;
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

// CARTO requires an API key on every basemap tile request. It is injected at
// build time from VITE_CARTO_KEY (a GitHub repository variable in CI, or
// .env.local for local development). Without it, tiles show a watermark.
const CARTO_KEY: string = import.meta.env.VITE_CARTO_KEY?.trim() ?? '';
const CARTO_KEY_QUERY = CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : '';

function cartoTileUrl(style: string) {
  return `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png${CARTO_KEY_QUERY}`;
}

const BASEMAPS: Record<BasemapTone, BasemapDefinition> = {
  light: {
    url: cartoTileUrl('light_all'),
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
  dark: {
    url: cartoTileUrl('dark_all'),
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
};

export function createBasemapLayer(tone: BasemapTone) {
  const basemap = BASEMAPS[tone];

  return L.tileLayer(basemap.url, {
    attribution: basemap.attribution,
    detectRetina: true,
    maxZoom: basemap.maxZoom,
  });
}
