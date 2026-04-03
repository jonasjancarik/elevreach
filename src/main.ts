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
  loadPopulationDataset,
  summarizePopulation,
  type PopulationDataset,
} from './lib/population';
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

interface AppState {
  appearance: AppearancePreference;
  boundaryRadiusKm: number;
  boundaryScope: 'city' | 'radius';
  boundary: BoundaryGeoJson | null;
  cityLabel: string;
  dataset: TerrainDataset | null;
  populationDataset: PopulationDataset | null | undefined;
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
  populationDataset: undefined,
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
let advancedControlsOpen = false;
let topCardCollapsed = false;
const smallScreenMedia = window.matchMedia('(max-width: 768px)');

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
  scheduleRender();
});

nodes.controls.addEventListener('change', () => {
  syncStateFromControls();
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

nodes.advancedButton.addEventListener('click', () => {
  setAdvancedControlsOpen(!advancedControlsOpen);
});

nodes.topCardCollapseButton.addEventListener('click', () => {
  if (!smallScreenMedia.matches) {
    return;
  }

  setTopCardCollapsed(!topCardCollapsed);
});

smallScreenMedia.addEventListener('change', (event) => {
  setTopCardCollapsed(event.matches ? topCardCollapsed : false);
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
  setTopCardCollapsed(false);
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
    state.populationDataset = undefined;
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
    void hydratePopulationDataset(loadId, dataset, loadedBoundary.label);
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
  state.populationDataset = undefined;
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
  nodes.budgetLabel.textContent =
    state.mode !== 'ascent'
      ? 'Climb budget'
      : state.ascentRoundTrip
        ? 'Round-trip uphill limit'
        : 'One-way uphill limit';
  nodes.budgetRange.disabled = state.mode !== 'ascent';

  const boundaryRadiusControl = nodes.boundaryRadiusRange.closest<HTMLElement>('.control');
  const upperControl = nodes.upperRange.closest<HTMLElement>('.control');
  const lowerControl = nodes.lowerRange.closest<HTMLElement>('.control');
  const ascentScopeControl = nodes.ascentScopeInputs[0]?.closest<HTMLElement>('fieldset');
  const connectedControl = nodes.connectedToggle.closest<HTMLElement>('.toggle');

  setControlDisplay(boundaryRadiusControl, state.boundaryScope === 'radius');
  setControlDisplay(upperControl, state.mode !== 'ascent');
  setControlDisplay(lowerControl, state.mode === 'band');
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

  const activeMask =
    state.boundaryScope === 'radius'
      ? buildRadiusMask(state.dataset, state.sourceIndex, state.boundaryRadiusKm)
      : state.dataset.insideMask;
  const analysis = runElevationAnalysis(state.dataset, {
    activeMask,
    sourceIndex: state.sourceIndex,
    mode: state.mode,
    upperAllowance: state.upperAllowance,
    lowerAllowance: state.lowerAllowance,
    ascentBudget: state.ascentBudget,
    ascentRoundTrip: state.ascentRoundTrip,
    contiguousOnly: state.contiguousOnly,
  });
  const populationSummary = state.populationDataset
    ? {
        dataset: state.populationDataset,
        summary: summarizePopulation(state.populationDataset, analysis.mask, activeMask),
      }
    : null;
  const populationStatus =
    state.populationDataset === undefined
      ? 'loading'
      : state.populationDataset
        ? 'ready'
        : 'unavailable';

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
  updateStatsView(
    nodes,
    state.dataset,
    state.sourceIndex,
    analysis,
    populationSummary,
    populationStatus,
    {
      boundaryRadiusKm: state.boundaryRadiusKm,
      boundaryScope: state.boundaryScope,
      cityLabel: state.cityLabel,
      mode: state.mode,
      upperAllowance: state.upperAllowance,
      lowerAllowance: state.lowerAllowance,
      ascentBudget: state.ascentBudget,
      ascentRoundTrip: state.ascentRoundTrip,
      contiguousOnly: state.contiguousOnly,
    },
  );
}

async function hydratePopulationDataset(
  loadId: number,
  dataset: TerrainDataset,
  cityLabel: string,
) {
  try {
    const populationDataset = await loadPopulationDataset(dataset, cityLabel);

    if (loadId !== activeLoadId || state.dataset !== dataset) {
      return;
    }

    state.populationDataset = populationDataset;
    scheduleRender();
  } catch (error) {
    console.error(error);

    if (loadId !== activeLoadId || state.dataset !== dataset) {
      return;
    }

    state.populationDataset = null;
    scheduleRender();
  }
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

function setAdvancedControlsOpen(open: boolean) {
  advancedControlsOpen = open;
  nodes.advancedControls.classList.toggle('hidden', !open);
  nodes.advancedButton.classList.toggle('active', open);
  nodes.advancedButton.setAttribute('aria-expanded', String(open));
  nodes.advancedButton.textContent = open ? 'Hide advanced' : 'Advanced';
}

function setTopCardCollapsed(collapsed: boolean) {
  const shouldCollapse = smallScreenMedia.matches && collapsed;
  const label = nodes.topCardCollapseButton.querySelector<HTMLElement>('.panel-toggle-label');

  topCardCollapsed = shouldCollapse;
  nodes.topCard.classList.toggle('collapsed', shouldCollapse);
  nodes.topCardBody.classList.toggle('hidden', shouldCollapse);
  nodes.topCardCollapseButton.setAttribute('aria-expanded', String(!shouldCollapse));
  if (label) {
    label.textContent = shouldCollapse ? 'Expand' : 'Collapse';
  }
}
