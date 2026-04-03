import L, { type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { type AnalysisMode, runElevationAnalysis } from './lib/analysis';
import { setupAppShell } from './lib/app-shell';
import { createBasemapLayer } from './lib/basemaps';
import {
  DEFAULT_CITY_QUERY,
  loadBundledBoundary,
  searchCityBoundary,
  type BoundaryGeoJson,
} from './lib/boundary';
import { renderAnalysisOverlay } from './lib/render';
import {
  buildRadiusMask,
  cellLatLng,
  findNearestInsideIndex,
  indexFromLatLngClamped,
  indexFromLatLng,
  loadTerrainDataset,
  type TerrainDataset,
} from './lib/terrain';
import {
  getStoredAppearance,
  resolveTheme,
  storeAppearance,
  type AppearancePreference,
  type ResolvedTheme,
  watchSystemTheme,
} from './lib/theme';
import { pickDefaultAnchor, setLoadingState, setStatusView, updateStatsView } from './lib/view';

type PresetKey = 'flat-walk' | 'ride-low' | 'ride-everyday';

interface AppState {
  appearance: AppearancePreference;
  boundaryRadiusKm: number;
  boundaryScope: 'city' | 'radius';
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
const initialAppearance = getStoredAppearance();

const state: AppState = {
  appearance: initialAppearance,
  boundaryRadiusKm: Number(nodes.boundaryRadiusRange.value),
  boundaryScope: 'radius',
  boundary: null,
  cityLabel: DEFAULT_CITY_QUERY,
  dataset: null,
  sourceIndex: null,
  mode: 'ascent',
  upperAllowance: Number(nodes.upperRange.value),
  lowerAllowance: Number(nodes.lowerRange.value),
  ascentBudget: Number(nodes.budgetRange.value),
  ascentRoundTrip: true,
  contiguousOnly: nodes.connectedToggle.checked,
};

const map = L.map('map', {
  zoomControl: false,
  preferCanvas: true,
});

L.control
  .zoom({
    position: 'topright',
  })
  .addTo(map);

let resolvedTheme: ResolvedTheme = resolveTheme(initialAppearance);
let basemapLayer = createBasemapLayer(resolvedTheme).addTo(map);
let boundaryLayer: L.GeoJSON | null = null;
let boundaryRadiusCircle: L.Circle | null = null;
let sourceMarker: L.CircleMarker | null = null;
let overlayLayer: L.ImageOverlay | null = null;
let renderScheduled = false;
let activeLoadId = 0;

bootstrap().catch((error) => {
  console.error(error);
  setStatusView(
    nodes,
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

nodes.appearanceButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const preference = button.dataset.appearance as AppearancePreference | undefined;

    if (
      !preference ||
      (preference !== 'system' &&
        preference !== 'light' &&
        preference !== 'dark') ||
      preference === state.appearance
    ) {
      return;
    }

    state.appearance = preference;
    storeAppearance(preference);
    applyAppearance();
  });
});

watchSystemTheme((nextTheme) => {
  if (state.appearance !== 'system') {
    return;
  }

  resolvedTheme = nextTheme;
  applyAppearance();
});

nodes.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const query = nodes.searchInput.value.trim();

  if (!query) {
    setStatusView(nodes, 'Enter a city, ideally "City, Country".', true);
    return;
  }

  void loadCity(query, false);
});

nodes.presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyPreset(button.dataset.preset as PresetKey);
    document.querySelector('#custom-controls')?.classList.add('hidden');
    document.querySelector('#custom-preset-btn')?.classList.remove('active');
    scheduleRender();
  });
});

const customPresetBtn = document.querySelector('#custom-preset-btn');
customPresetBtn?.addEventListener('click', () => {
  const controls = document.querySelector('#custom-controls');
  controls?.classList.toggle('hidden');
  customPresetBtn.classList.toggle('active', !controls?.classList.contains('hidden'));
  updatePresetState(null);
});

map.on('click', (event: LeafletMouseEvent) => {
  if (!state.dataset) {
    return;
  }

  const candidate =
    state.boundaryScope === 'radius'
      ? indexFromLatLngClamped(state.dataset, event.latlng.lng, event.latlng.lat)
      : indexFromLatLng(
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
  applyAppearance();
  await loadCity(DEFAULT_CITY_QUERY, true);
}

async function loadCity(query: string, useBundled: boolean) {
  const loadId = ++activeLoadId;
  setLoadingState(nodes, true);
  setStatusView(nodes, useBundled ? 'Loading default city boundary…' : `Loading ${query}…`);
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
    document.title = `ElevReach: ${loadedBoundary.label}`;
    renderBoundary(loadedBoundary.boundary);

    setStatusView(nodes, `Loading elevation for ${loadedBoundary.label}…`);

    const dataset = await loadTerrainDataset(loadedBoundary.boundary, {
      zoom: 12,
      sampleStep: 2,
      onProgress: (loaded, total) => {
        if (loadId !== activeLoadId) {
          return;
        }

        setStatusView(nodes, `Loading elevation tiles for ${loadedBoundary.label}… ${loaded}/${total}`);
      },
    });

    if (loadId !== activeLoadId) {
      return;
    }

    state.dataset = dataset;
    state.sourceIndex = pickDefaultAnchor(
      dataset,
      loadedBoundary.boundary,
      loadedBoundary.query,
      loadedBoundary.label,
    );
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
    setStatusView(
      nodes,
      error instanceof Error ? error.message : 'Failed to load city terrain.',
      true,
    );
  } finally {
    if (loadId === activeLoadId) {
      setLoadingState(nodes, false);
    }
  }
}

function renderBoundary(boundary: BoundaryGeoJson) {
  if (boundaryLayer === null) {
    boundaryLayer = L.geoJSON(boundary, {
      style: boundaryStyle(),
    }).addTo(map);
  } else {
    boundaryLayer.clearLayers();
    boundaryLayer.addData(boundary);
    boundaryLayer.setStyle(boundaryStyle());
  }

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
  boundaryRadiusCircle?.remove();
  boundaryRadiusCircle = null;
  overlayLayer?.remove();
  overlayLayer = null;
  sourceMarker?.remove();
  sourceMarker = null;
}

function applyAppearance() {
  resolvedTheme = resolveTheme(state.appearance);
  document.documentElement.dataset.theme = resolvedTheme;
  basemapLayer.remove();
  basemapLayer = createBasemapLayer(resolvedTheme).addTo(map);
  basemapLayer.bringToBack();
  updateMapThemeStyles();
  updateAppearanceState();
}

function syncStateFromControls() {
  const modeInput = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );

  state.mode = parseMode(modeInput?.value);
  state.boundaryRadiusKm = Number(nodes.boundaryRadiusRange.value);
  state.boundaryScope = parseBoundaryScope();
  state.upperAllowance = Number(nodes.upperRange.value);
  state.lowerAllowance = Number(nodes.lowerRange.value);
  state.ascentBudget = Number(nodes.budgetRange.value);
  state.ascentRoundTrip = parseAscentScope() === 'round-trip';
  state.contiguousOnly =
    state.mode === 'ascent' ? true : nodes.connectedToggle.checked;

  nodes.upperOutput.textContent = `${state.upperAllowance} m`;
  nodes.lowerOutput.textContent =
    state.mode === 'band' ? `${state.lowerAllowance} m` : '∞ drop';
  nodes.boundaryRadiusOutput.textContent = formatBoundaryRadius(state.boundaryRadiusKm);
  nodes.budgetOutput.textContent = `${state.ascentBudget} m`;

  const boundaryRadiusControl = nodes.boundaryRadiusRange.closest<HTMLElement>('.control');
  const upperControl = nodes.upperRange.closest<HTMLElement>('.control');
  const lowerControl = nodes.lowerRange.closest<HTMLElement>('.control');
  const budgetControl = nodes.budgetRange.closest<HTMLElement>('.control');
  const ascentScopeControl = nodes.ascentScopeInputs[0]?.closest<HTMLElement>('fieldset');
  const connectedControl = nodes.connectedToggle.closest<HTMLElement>('.toggle');

  setControlDisplay(boundaryRadiusControl, state.boundaryScope === 'radius');
  setControlDisplay(upperControl, state.mode !== 'ascent');
  setControlDisplay(lowerControl, state.mode === 'band');
  setControlDisplay(budgetControl, state.mode === 'ascent');
  setControlDisplay(ascentScopeControl, state.mode === 'ascent');
  setControlDisplay(connectedControl, state.mode !== 'ascent');

  if (state.mode === 'ascent') {
    nodes.connectedToggle.checked = true;
  }

  nodes.boundaryRadiusHint.textContent =
    state.boundaryScope === 'radius'
      ? 'Radius mode uses straight-line distance from the start. Click anywhere to move the trip area.'
      : `City mode searches within the borders of ${state.cityLabel}.`;
  nodes.clickHint.textContent =
    state.boundaryScope === 'radius'
      ? 'Click map to move start + boundary'
      : 'Click map to move start';

  nodes.lowerHint.textContent =
    state.mode === 'band'
      ? 'Flat zone is a same-elevation lens, not a cycling-effort model.'
      : state.mode === 'ceiling'
        ? 'Elevation cap ignores drops entirely, so repeated short climbs may add up.'
        : 'Drop limit is not used in climb budget mode.';
  nodes.budgetHint.textContent =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Counts uphill meters out and uphill meters back. Distance is still not priced.'
        : 'Counts uphill meters one-way only. Distance is not priced, so flat detours are effectively free.'
      : 'Used only in climb budget mode.';
}

function applyPreset(preset: PresetKey) {
  switch (preset) {
    case 'flat-walk':
      setControls({
        boundaryScope: 'radius',
        boundaryRadiusKm: 2.5,
        mode: 'band',
        upper: 5,
        lower: 5,
        ascentBudget: 60,
        ascentRoundTrip: true,
        contiguous: true,
      });
      break;
    case 'ride-low':
      setControls({
        boundaryScope: 'radius',
        boundaryRadiusKm: 5,
        mode: 'ascent',
        upper: 5,
        lower: 5,
        ascentBudget: 60,
        ascentRoundTrip: true,
        contiguous: true,
      });
      break;
    case 'ride-everyday':
      setControls({
        boundaryScope: 'radius',
        boundaryRadiusKm: 8,
        mode: 'ascent',
        upper: 5,
        lower: 5,
        ascentBudget: 120,
        ascentRoundTrip: true,
        contiguous: true,
      });
      break;
  }

  updatePresetState(preset);
}

function setControls(options: {
  boundaryScope: 'city' | 'radius';
  boundaryRadiusKm: number;
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

  const boundaryScopeInput = nodes.controls.querySelector<HTMLInputElement>(
    `input[name="boundary-scope"][value="${options.boundaryScope}"]`,
  );

  if (boundaryScopeInput) {
    boundaryScopeInput.checked = true;
  }

  nodes.boundaryRadiusRange.value = String(options.boundaryRadiusKm);
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

function updateAppearanceState() {
  nodes.appearanceButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.appearance === state.appearance);
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
    activeMask:
      state.boundaryScope === 'radius'
        ? buildRadiusMask(state.dataset, state.sourceIndex, state.boundaryRadiusKm)
        : state.dataset.insideMask,
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

  updateBoundaryRadiusCircle();
  setStatusView(nodes, 'Ready');
  updateStatsView(nodes, state.dataset, state.sourceIndex, analysis, {
    boundaryRadiusKm: state.boundaryRadiusKm,
    boundaryScope: state.boundaryScope,
    cityLabel: state.cityLabel,
    mode: state.mode,
    upperAllowance: state.upperAllowance,
    lowerAllowance: state.lowerAllowance,
    ascentBudget: state.ascentBudget,
    ascentRoundTrip: state.ascentRoundTrip,
    contiguousOnly: state.contiguousOnly,
  });
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
      color: markerStroke(),
      fillColor: markerFill(),
      fillOpacity: 1,
    }).addTo(map);
  } else {
    sourceMarker.setLatLng(point);
    sourceMarker.setStyle({
      color: markerStroke(),
      fillColor: markerFill(),
    });
  }
}

function updateMapThemeStyles() {
  boundaryLayer?.setStyle(boundaryStyle());
  updateBoundaryRadiusCircle();

  if (sourceMarker) {
    sourceMarker.setStyle({
      color: markerStroke(),
      fillColor: markerFill(),
    });
  }
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

function boundaryStyle(): L.PathOptions {
  return {
    color: resolvedTheme === 'dark' ? '#edf3ef' : '#101a1d',
    weight: 2,
    fillOpacity: 0,
    opacity: 0.78,
    dashArray: '6 8',
  };
}

function markerStroke() {
  return resolvedTheme === 'dark' ? '#101a1d' : '#f8f4e9';
}

function markerFill() {
  return resolvedTheme === 'dark' ? '#edf3ef' : '#101a1d';
}

function updateBoundaryRadiusCircle() {
  if (!state.dataset || state.sourceIndex === null || state.boundaryScope !== 'radius') {
    boundaryRadiusCircle?.remove();
    boundaryRadiusCircle = null;
    return;
  }

  const point = cellLatLng(state.dataset, state.sourceIndex);
  const radiusMeters = state.boundaryRadiusKm * 1000;
  const stroke = resolvedTheme === 'dark' ? '#efc86d' : '#8e5c06';
  const fill = resolvedTheme === 'dark' ? '#efc86d' : '#f0ab35';

  if (boundaryRadiusCircle === null) {
    boundaryRadiusCircle = L.circle(point, {
      color: stroke,
      weight: 2,
      dashArray: '10 8',
      fillOpacity: 0.05,
      fillColor: fill,
      interactive: false,
      radius: radiusMeters,
    }).addTo(map);
  } else {
    boundaryRadiusCircle.setLatLng(point);
    boundaryRadiusCircle.setRadius(radiusMeters);
    boundaryRadiusCircle.setStyle({
      color: stroke,
      fillColor: fill,
    });
  }
}

function parseBoundaryScope() {
  const selected = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="boundary-scope"]:checked',
  );

  return selected?.value === 'radius' ? 'radius' : 'city';
}

function formatBoundaryRadius(radiusKm: number) {
  return Number.isInteger(radiusKm) ? `${radiusKm} km` : `${radiusKm.toFixed(1)} km`;
}

function setControlDisplay(node: HTMLElement | null | undefined, visible: boolean) {
  if (!node) {
    return;
  }

  node.style.display = visible ? '' : 'none';
}
