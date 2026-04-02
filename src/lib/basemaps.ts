import L from 'leaflet';

export type BasemapTone = 'light' | 'dark';

interface BasemapDefinition {
  attribution: string;
  maxZoom: number;
  url: string;
}

const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const BASEMAPS: Record<BasemapTone, BasemapDefinition> = {
  light: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    attribution: STADIA_ATTRIBUTION,
    maxZoom: 20,
  },
  dark: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attribution: STADIA_ATTRIBUTION,
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
