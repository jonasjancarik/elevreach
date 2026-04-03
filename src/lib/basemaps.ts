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

const BASEMAPS: Record<BasemapTone, BasemapDefinition> = {
  light: {
    url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
  dark: {
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
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
