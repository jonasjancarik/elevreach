import L, { type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { type AnalysisMode, type AnalysisResult, runElevationAnalysis } from './lib/analysis';
import { setupAppShell } from './lib/app-shell';
import {
  DEFAULT_CITY_QUERY,
  loadBundledBoundary,
  searchCityBoundary,
  type BoundaryGeoJson,
} from './lib/boundary';
import { renderAnalysisOverlay } from './lib/render';
import {
  cellLatLng,
  elevationAtIndex,
  findNearestInsideIndex,
  indexFromLatLng,
  loadTerrainDataset,
  type TerrainDataset,
} from './lib/terrain';

type PresetKey = 'flat-5' | 'flat-15' | 'ceiling-5' | 'ascent-25';

interface AppState {
  boundary: BoundaryGeoJson | null;
  cityLabel: string;
  dataset: TerrainDataset | null;
  sourceIndex: number | null;
  mode: AnalysisMode;
  upperAllowance: number;
  lowerAllowance: number;
  ascentBudget: number;
  ascentRoundTrip: boolean;
  contiguousOnly: boolean;
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const nodes = setupAppShell(app, DEFAULT_CITY_QUERY);

const state: AppState = {
  boundary: null,
  cityLabel: DEFAULT_CITY_QUERY,
  dataset: null,
  sourceIndex: null,
  mode: 'band',
  upperAllowance: Number(nodes.upperRange.value),
  lowerAllowance: Number(nodes.lowerRange.value),
  ascentBudget: Number(nodes.budgetRange.value),
  ascentRoundTrip: false,
  contiguousOnly: nodes.connectedToggle.checked,
};

const map = L.map('map', {
  zoomControl: false,
  preferCanvas: true,
});

L.control
  .zoom({
    position: 'bottomright',
  })
  .addTo(map);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 17,
}).addTo(map);

let boundaryLayer: L.GeoJSON | null = null;
let sourceMarker: L.CircleMarker | null = null;
let overlayLayer: L.ImageOverlay | null = null;
let renderScheduled = false;
let activeLoadId = 0;

bootstrap().catch((error) => {
  console.error(error);
  setStatus(
    error instanceof Error ? error.message : 'Failed to load city terrain.',
    true,
  );
});

nodes.controls.addEventListener('input', () => {
  syncStateFromControls();
  updatePresetState(null);
  scheduleRender();
});

nodes.controls.addEventListener('change', () => {
  syncStateFromControls();
  updatePresetState(null);
  scheduleRender();
});

nodes.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const query = nodes.searchInput.value.trim();

  if (!query) {
    setStatus('Enter a city, ideally "City, Country".', true);
    return;
  }

  void loadCity(query, false);
});

nodes.presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyPreset(button.dataset.preset as PresetKey);
    scheduleRender();
  });
});

map.on('click', (event: LeafletMouseEvent) => {
  if (!state.dataset) {
    return;
  }

  const candidate = indexFromLatLng(
    state.dataset,
    event.latlng.lng,
    event.latlng.lat,
  );
  const sourceIndex =
    candidate ??
    findNearestInsideIndex(
      state.dataset,
      state.dataset.cols / 2,
      state.dataset.rows / 2,
    );

  if (sourceIndex === null) {
    return;
  }

  state.sourceIndex = sourceIndex;
  setSourceMarker(sourceIndex);
  scheduleRender();
});

async function bootstrap() {
  syncStateFromControls();
  await loadCity(DEFAULT_CITY_QUERY, true);
}

async function loadCity(query: string, useBundled: boolean) {
  const loadId = ++activeLoadId;
  setSearchLoading(true);
  setStatus(useBundled ? 'Loading default city boundary…' : `Loading ${query}…`);
  clearVisualization();

  try {
    const loadedBoundary = useBundled
      ? await loadBundledBoundary()
      : await searchCityBoundary(query);

    if (loadId !== activeLoadId) {
      return;
    }

    state.boundary = loadedBoundary.boundary;
    state.cityLabel = loadedBoundary.label;
    nodes.cityLabel.textContent = loadedBoundary.label;
    document.title = `Elevation Slices: ${loadedBoundary.label}`;
    renderBoundary(loadedBoundary.boundary);

    setStatus(`Loading elevation for ${loadedBoundary.label}…`);

    const dataset = await loadTerrainDataset(loadedBoundary.boundary, {
      zoom: 12,
      sampleStep: 2,
      onProgress: (loaded, total) => {
        if (loadId !== activeLoadId) {
          return;
        }

        setStatus(`Loading elevation tiles for ${loadedBoundary.label}… ${loaded}/${total}`);
      },
    });

    if (loadId !== activeLoadId) {
      return;
    }

    state.dataset = dataset;
    state.sourceIndex = pickDefaultAnchor(dataset, loadedBoundary.boundary);
    nodes.searchInput.value = loadedBoundary.query;

    if (state.sourceIndex === null) {
      throw new Error(`Could not find a valid anchor point inside ${loadedBoundary.label}.`);
    }

    setSourceMarker(state.sourceIndex);
    renderVisualization();
  } catch (error) {
    if (loadId !== activeLoadId) {
      return;
    }

    console.error(error);
    setStatus(
      error instanceof Error ? error.message : 'Failed to load city terrain.',
      true,
    );
  } finally {
    if (loadId === activeLoadId) {
      setSearchLoading(false);
    }
  }
}

function renderBoundary(boundary: BoundaryGeoJson) {
  boundaryLayer?.remove();

  boundaryLayer = L.geoJSON(boundary, {
    style: {
      color: '#101a1d',
      weight: 2,
      fillOpacity: 0,
      opacity: 0.7,
      dashArray: '6 8',
    },
  }).addTo(map);

  const bbox = boundary.bbox;
  map.fitBounds(
    [
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ],
    { padding: [24, 24] },
  );
}

function clearVisualization() {
  state.dataset = null;
  state.sourceIndex = null;
  overlayLayer?.remove();
  overlayLayer = null;
  sourceMarker?.remove();
  sourceMarker = null;
}

function syncStateFromControls() {
  const modeInput = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );

  state.mode = parseMode(modeInput?.value);
  state.upperAllowance = Number(nodes.upperRange.value);
  state.lowerAllowance = Number(nodes.lowerRange.value);
  state.ascentBudget = Number(nodes.budgetRange.value);
  state.ascentRoundTrip = parseAscentScope() === 'round-trip';
  state.contiguousOnly =
    state.mode === 'ascent' ? true : nodes.connectedToggle.checked;

  nodes.upperOutput.textContent = `${state.upperAllowance} m`;
  nodes.lowerOutput.textContent =
    state.mode === 'band' ? `${state.lowerAllowance} m` : '∞ drop';
  nodes.budgetOutput.textContent = `${state.ascentBudget} m`;

  nodes.upperRange.disabled = state.mode === 'ascent';
  nodes.lowerRange.disabled = state.mode !== 'band';
  nodes.budgetRange.disabled = state.mode !== 'ascent';
  nodes.connectedToggle.disabled = state.mode === 'ascent';
  nodes.ascentScopeInputs.forEach((input) => {
    input.disabled = state.mode !== 'ascent';
  });

  if (state.mode === 'ascent') {
    nodes.connectedToggle.checked = true;
  }

  nodes.lowerHint.textContent =
    state.mode === 'band'
      ? 'Band mode keeps cells inside the upper and lower elevation limits.'
      : state.mode === 'ceiling'
        ? 'Ceiling mode includes every lower cell, which can still understate repeated climbs.'
        : 'Drop limit is not used in cumulative ascent mode.';
  nodes.budgetHint.textContent =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Counts uphill meters there and uphill meters back, each on the least-ascent terrain path.'
        : 'Least-ascent terrain path only. Long flat detours are still cheap here.'
      : 'Used only in cumulative ascent mode.';
}

function applyPreset(preset: PresetKey) {
  switch (preset) {
    case 'flat-5':
      setControls({
        mode: 'band',
        upper: 5,
        lower: 5,
        ascentBudget: 25,
        ascentRoundTrip: false,
        contiguous: true,
      });
      break;
    case 'flat-15':
      setControls({
        mode: 'band',
        upper: 15,
        lower: 15,
        ascentBudget: 25,
        ascentRoundTrip: false,
        contiguous: true,
      });
      break;
    case 'ceiling-5':
      setControls({
        mode: 'ceiling',
        upper: 5,
        lower: 5,
        ascentBudget: 25,
        ascentRoundTrip: false,
        contiguous: true,
      });
      break;
    case 'ascent-25':
      setControls({
        mode: 'ascent',
        upper: 5,
        lower: 5,
        ascentBudget: 25,
        ascentRoundTrip: false,
        contiguous: true,
      });
      break;
  }

  updatePresetState(preset);
}

function setControls(options: {
  mode: AnalysisMode;
  upper: number;
  lower: number;
  ascentBudget: number;
  ascentRoundTrip: boolean;
  contiguous: boolean;
}) {
  const modeInput = nodes.controls.querySelector<HTMLInputElement>(
    `input[name="mode"][value="${options.mode}"]`,
  );

  if (modeInput) {
    modeInput.checked = true;
  }

  nodes.upperRange.value = String(options.upper);
  nodes.lowerRange.value = String(options.lower);
  nodes.budgetRange.value = String(options.ascentBudget);

  const ascentScopeInput = nodes.controls.querySelector<HTMLInputElement>(
    `input[name="ascent-scope"][value="${options.ascentRoundTrip ? 'round-trip' : 'one-way'}"]`,
  );

  if (ascentScopeInput) {
    ascentScopeInput.checked = true;
  }

  nodes.connectedToggle.checked = options.contiguous;
  syncStateFromControls();
}

function updatePresetState(active: PresetKey | null) {
  nodes.presetButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === active);
  });
}

function scheduleRender() {
  if (renderScheduled) {
    return;
  }

  renderScheduled = true;

  requestAnimationFrame(() => {
    renderScheduled = false;
    renderVisualization();
  });
}

function renderVisualization() {
  if (state.dataset === null || state.sourceIndex === null) {
    return;
  }

  const analysis = runElevationAnalysis(state.dataset, {
    sourceIndex: state.sourceIndex,
    mode: state.mode,
    upperAllowance: state.upperAllowance,
    lowerAllowance: state.lowerAllowance,
    ascentBudget: state.ascentBudget,
    ascentRoundTrip: state.ascentRoundTrip,
    contiguousOnly: state.contiguousOnly,
  });

  const imageUrl = renderAnalysisOverlay(state.dataset, analysis, {
    mode: state.mode,
  });

  if (overlayLayer === null) {
    overlayLayer = L.imageOverlay(imageUrl, state.dataset.overlayBounds, {
      interactive: false,
      opacity: 0.86,
    }).addTo(map);
  } else {
    overlayLayer.setUrl(imageUrl);
  }

  setStatus('Ready');
  updateStats(state.dataset, analysis);
}

function updateStats(dataset: TerrainDataset, analysis: AnalysisResult) {
  if (state.sourceIndex === null) {
    return;
  }

  const sourcePoint = cellLatLng(dataset, state.sourceIndex);
  const sourceElevation = elevationAtIndex(dataset, state.sourceIndex);
  const share =
    analysis.insideAreaKm2 === 0
      ? 0
      : analysis.matchedAreaKm2 / analysis.insideAreaKm2;

  nodes.elevationStat.textContent = `${sourceElevation.toFixed(0)} m`;
  nodes.shareStat.textContent = `${(share * 100).toFixed(1)}%`;
  nodes.areaStat.textContent = `${analysis.matchedAreaKm2.toFixed(1)} km²`;
  nodes.coordsStat.textContent = `${sourcePoint.lat.toFixed(4)}, ${sourcePoint.lng.toFixed(4)}`;

  const baseRule =
    state.mode === 'ceiling'
      ? `Cells at ${sourceElevation.toFixed(0)} m + ${state.upperAllowance} m or lower`
      : state.mode === 'ascent'
        ? state.ascentRoundTrip
          ? `Cells where uphill there + uphill back, on least-ascent terrain paths, stays ≤ ${state.ascentBudget} m`
          : `Cells reachable on the least-ascent terrain path with total uphill ≤ ${state.ascentBudget} m`
        : `Cells inside ${sourceElevation.toFixed(0)} m - ${state.lowerAllowance} m / + ${state.upperAllowance} m`;
  const scope =
    state.mode === 'ascent'
      ? 'from the anchor'
      : state.contiguousOnly
        ? 'connected to the anchor'
        : `across ${state.cityLabel}`;
  const caveat =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Terrain path only; best outbound and return paths can differ, and roads may be worse.'
        : 'Terrain path only; road detours can add more climbing.'
      : state.mode === 'ceiling'
        ? 'Useful as a ceiling, not a promise of an easy ride.'
        : '';

  nodes.ruleSummary.textContent = `${baseRule}. Showing area ${scope}.${caveat ? ` ${caveat}` : ''}`;
}

function setSourceMarker(index: number) {
  if (!state.dataset) {
    return;
  }

  const point = cellLatLng(state.dataset, index);

  if (sourceMarker === null) {
    sourceMarker = L.circleMarker(point, {
      radius: 7,
      weight: 3,
      color: '#f8f4e9',
      fillColor: '#101a1d',
      fillOpacity: 1,
    }).addTo(map);
  } else {
    sourceMarker.setLatLng(point);
  }
}

function setStatus(message: string, isError = false) {
  nodes.statusNode.textContent = message;
  nodes.statusNode.classList.toggle('is-loading', !isError && message !== 'Ready');
  nodes.statusNode.classList.toggle('is-error', isError);
}

function setSearchLoading(isLoading: boolean) {
  nodes.searchButton.disabled = isLoading;
  nodes.searchInput.disabled = isLoading;
  nodes.searchButton.textContent = isLoading ? 'Loading…' : 'Load city';
}

function pickDefaultAnchor(dataset: TerrainDataset, boundary: BoundaryGeoJson) {
  const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return (
    indexFromLatLng(dataset, centerLng, centerLat) ??
    findNearestInsideIndex(dataset, dataset.cols / 2, dataset.rows / 2)
  );
}

function parseMode(value: string | undefined): AnalysisMode {
  if (value === 'ceiling' || value === 'ascent') {
    return value;
  }

  return 'band';
}

function parseAscentScope() {
  const selected = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="ascent-scope"]:checked',
  );

  return selected?.value === 'round-trip' ? 'round-trip' : 'one-way';
}
