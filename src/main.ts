import L, { type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { type AnalysisMode, runElevationAnalysis } from './lib/analysis';
import { applyShellCopy, setupAppShell } from './lib/app-shell';
import { createBasemapLayer } from './lib/basemaps';
import {
  DEFAULT_CITY_QUERY,
  loadBundledBoundary,
  searchCityBoundary,
  type BoundaryGeoJson,
} from './lib/boundary';
import { resolveCityExtraEdges, type ExtraTraversalEdge } from './lib/city-connectors';
import {
  getCopy,
  getStoredLanguage,
  localeForLanguage,
  localizeErrorMessage,
  storeLanguage,
  type AppLanguage,
} from './lib/i18n';
import { renderAnalysisOverlay } from './lib/render';
import {
  loadPopulationDataset,
  summarizePopulation,
  type PopulationDataset,
} from './lib/population';
import { runStreetAnalysis } from './lib/street-analysis';
import {
  loadStreetGraphForRadius,
  streetGraphCacheKey,
  type StreetGraph,
} from './lib/street-graph';
import {
  buildRadiusMask,
  cellLatLng,
  elevationAtIndex,
  findNearestInsideIndex,
  indexFromLatLngClamped,
  indexFromLatLngExact,
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
  ascentModel: 'terrain' | 'street';
  boundaryRadiusKm: number;
  boundaryScope: 'city' | 'radius';
  boundary: BoundaryGeoJson | null;
  cityLabel: string;
  dataset: TerrainDataset | null;
  extraEdges: readonly ExtraTraversalEdge[];
  isCityLoading: boolean;
  language: AppLanguage;
  populationDataset: PopulationDataset | null | undefined;
  sourceIndex: number | null;
  mode: AnalysisMode;
  upperAllowance: number;
  lowerAllowance: number;
  ascentBudget: number;
  ascentRoundTrip: boolean;
  contiguousOnly: boolean;
  streetGraph: StreetGraph | null | undefined;
  streetGraphKey: string | null;
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const initialAppearance = getStoredAppearance();
const initialLanguage = getStoredLanguage();
const nodes = setupAppShell(app, DEFAULT_CITY_QUERY, initialLanguage);

const state: AppState = {
  appearance: initialAppearance,
  ascentModel: 'terrain',
  boundaryRadiusKm: Number(nodes.boundaryRadiusRange.value),
  boundaryScope: 'radius',
  boundary: null,
  cityLabel: DEFAULT_CITY_QUERY,
  dataset: null,
  extraEdges: [],
  isCityLoading: false,
  language: initialLanguage,
  populationDataset: undefined,
  sourceIndex: null,
  mode: 'ascent',
  upperAllowance: Number(nodes.upperRange.value),
  lowerAllowance: Number(nodes.lowerRange.value),
  ascentBudget: Number(nodes.budgetRange.value),
  ascentRoundTrip: true,
  contiguousOnly: nodes.connectedToggle.checked,
  streetGraph: undefined,
  streetGraphKey: null,
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
const hoverTooltip = L.tooltip({
  className: 'cursor-elevation-tooltip',
  direction: 'top',
  offset: [14, -6],
  opacity: 1,
  permanent: false,
  sticky: true,
});
let renderScheduled = false;
let activeLoadId = 0;
let activeStreetGraphRequestId = 0;
let advancedControlsOpen = false;
const smallScreenMedia = window.matchMedia('(max-width: 768px)');
let topCardCollapsed = smallScreenMedia.matches;

bootstrap().catch((error) => {
  console.error(error);
  setStatusView(
    nodes,
    localizeErrorMessage(error, state.language),
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

nodes.languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const language = button.dataset.language as AppLanguage | undefined;

    if ((language !== 'en' && language !== 'cs') || language === state.language) {
      return;
    }

    state.language = language;
    storeLanguage(language);
    applyLanguage();
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
    setStatusView(nodes, getCopy(state.language).searchValidationError, true);
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
  setTopCardCollapsed(event.matches);
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

map.on('mousemove', (event: LeafletMouseEvent) => {
  if (!state.dataset) {
    hoverTooltip.remove();
    return;
  }

  const hoverIndex = indexFromLatLngExact(
    state.dataset,
    event.latlng.lng,
    event.latlng.lat,
  );

  if (hoverIndex === null) {
    hoverTooltip.remove();
    return;
  }

  hoverTooltip
    .setLatLng(event.latlng)
    .setContent(`${elevationAtIndex(state.dataset, hoverIndex).toFixed(0)} m`);

  if (!map.hasLayer(hoverTooltip)) {
    hoverTooltip.addTo(map);
  }
});

map.on('mouseout', () => {
  hoverTooltip.remove();
});

async function bootstrap() {
  syncStateFromControls();
  setTopCardCollapsed(smallScreenMedia.matches);
  applyAppearance();
  applyLanguage();
  await loadCity(DEFAULT_CITY_QUERY, true);
}

async function loadCity(query: string, useBundled: boolean) {
  const loadId = ++activeLoadId;
  const copy = getCopy(state.language);
  state.isCityLoading = true;
  setLoadingState(nodes, true, state.language);
  setStatusView(nodes, useBundled ? copy.loadingDefaultCityBoundary : copy.loadingCity(query));
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
    document.title = getCopy(state.language).documentTitle(loadedBoundary.label);
    renderBoundary(loadedBoundary.boundary);

    setStatusView(nodes, getCopy(state.language).loadingElevation(loadedBoundary.label));

    const dataset = await loadTerrainDataset(loadedBoundary.boundary, {
      zoom: 12,
      sampleStep: 2,
      onProgress: (loaded, total) => {
        if (loadId !== activeLoadId) {
          return;
        }

        setStatusView(
          nodes,
          getCopy(state.language).loadingElevationTiles(loadedBoundary.label, loaded, total),
        );
      },
    });

    if (loadId !== activeLoadId) {
      return;
    }

    state.dataset = dataset;
    state.extraEdges = resolveCityExtraEdges(
      dataset,
      loadedBoundary.query,
      loadedBoundary.label,
    );
    state.populationDataset = undefined;
    state.sourceIndex = pickDefaultAnchor(
      dataset,
      loadedBoundary.boundary,
      loadedBoundary.query,
      loadedBoundary.label,
    );
    nodes.searchInput.value = loadedBoundary.query;

    if (state.sourceIndex === null) {
      throw new Error(getCopy(state.language).invalidAnchor(loadedBoundary.label));
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
      localizeErrorMessage(error, state.language),
      true,
    );
  } finally {
    if (loadId === activeLoadId) {
      state.isCityLoading = false;
      setLoadingState(nodes, false, state.language);
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
  state.extraEdges = [];
  state.populationDataset = undefined;
  state.sourceIndex = null;
  state.streetGraph = undefined;
  state.streetGraphKey = null;
  activeStreetGraphRequestId += 1;
  hoverTooltip.remove();
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
  const copy = getCopy(state.language);
  const modeInput = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );
  const nextAscentModel = parseAscentModel();

  state.mode = parseMode(modeInput?.value);
  state.boundaryRadiusKm = Number(nodes.boundaryRadiusRange.value);
  state.boundaryScope = parseBoundaryScope();
  state.upperAllowance = Number(nodes.upperRange.value);
  state.lowerAllowance = Number(nodes.lowerRange.value);
  state.ascentModel = nextAscentModel;
  nodes.budgetRange.max = state.mode === 'ascent' && state.ascentModel === 'street'
    ? '400'
    : '200';
  if (
    state.mode === 'ascent' &&
    state.ascentModel === 'street' &&
    Number(nodes.budgetRange.value) < 200
  ) {
    nodes.budgetRange.value = '200';
  }
  if (
    (state.mode !== 'ascent' || state.ascentModel === 'terrain') &&
    Number(nodes.budgetRange.value) > 200
  ) {
    nodes.budgetRange.value = '200';
  }
  state.ascentBudget = Number(nodes.budgetRange.value);
  state.ascentRoundTrip = parseAscentScope() === 'round-trip';
  state.contiguousOnly =
    state.mode === 'ascent' ? true : nodes.connectedToggle.checked;

  nodes.upperOutput.textContent = `${state.upperAllowance} m`;
  nodes.lowerOutput.textContent =
    state.mode === 'band' ? `${state.lowerAllowance} m` : '∞ drop';
  nodes.boundaryRadiusOutput.textContent = formatBoundaryRadius(state.boundaryRadiusKm);
  nodes.budgetOutput.textContent =
    state.mode === 'ascent' && state.ascentModel === 'street'
      ? `${state.ascentBudget} m-eq`
      : `${state.ascentBudget} m`;
  nodes.budgetLabel.textContent =
    state.mode !== 'ascent'
      ? copy.budgetLabelInactive
      : state.ascentModel === 'street'
        ? state.ascentRoundTrip
          ? copy.budgetLabelStreetRoundTrip
          : copy.budgetLabelStreetOneWay
        : state.ascentRoundTrip
          ? copy.budgetLabelTerrainRoundTrip
          : copy.budgetLabelTerrainOneWay;
  nodes.budgetRange.disabled = state.mode !== 'ascent';

  const boundaryRadiusControl = nodes.boundaryRadiusRange.closest<HTMLElement>('.control');
  const upperControl = nodes.upperRange.closest<HTMLElement>('.control');
  const lowerControl = nodes.lowerRange.closest<HTMLElement>('.control');
  const ascentScopeControl = nodes.ascentScopeInputs[0]?.closest<HTMLElement>('fieldset');
  const ascentModelControl = nodes.ascentModelInputs[0]?.closest<HTMLElement>('fieldset');
  const connectedControl = nodes.connectedToggle.closest<HTMLElement>('.toggle');

  setControlDisplay(boundaryRadiusControl, state.boundaryScope === 'radius');
  setControlDisplay(upperControl, state.mode !== 'ascent');
  setControlDisplay(lowerControl, state.mode === 'band');
  setControlDisplay(ascentScopeControl, state.mode === 'ascent');
  setControlDisplay(ascentModelControl, state.mode === 'ascent');
  setControlDisplay(connectedControl, state.mode !== 'ascent');

  if (state.mode === 'ascent') {
    nodes.connectedToggle.checked = true;
  }

  nodes.boundaryRadiusHint.textContent =
    state.boundaryScope === 'radius'
      ? copy.boundaryRadiusHintRadius
      : copy.boundaryRadiusHintCity(state.cityLabel);
  nodes.clickHint.textContent =
    state.boundaryScope === 'radius'
      ? copy.clickHintRadius
      : copy.clickHintCity;

  nodes.lowerHint.textContent =
    state.mode === 'band'
      ? state.language === 'cs'
        ? 'Rovinné pásmo sleduje stejnou nadmořskou výšku, ne cyklistickou náročnost.'
        : 'Flat zone is a same-elevation lens, not a cycling-effort model.'
      : state.mode === 'ceiling'
        ? state.language === 'cs'
          ? 'Výškový strop úplně ignoruje klesání, takže krátká opakovaná stoupání se mohou nasčítat.'
          : 'Elevation cap ignores drops entirely, so repeated short climbs may add up.'
        : state.language === 'cs'
          ? 'Limit klesání se v režimu rozpočtu stoupání nepoužívá.'
          : 'Drop limit is not used in climb budget mode.';
  nodes.budgetHint.textContent =
    state.mode === 'ascent'
      ? state.ascentModel === 'street'
        ? state.boundaryScope === 'radius'
          ? copy.budgetHintStreetRadius
          : copy.budgetHintStreetCity
        : state.ascentRoundTrip
          ? copy.budgetHintTerrainRoundTrip
          : copy.budgetHintTerrainOneWay
      : copy.budgetHintInactive;
  nodes.modelNote.textContent =
    state.mode !== 'ascent'
      ? copy.modelNoteInactive
      : state.ascentModel === 'street'
        ? copy.modelNoteStreet
        : copy.modelNoteTerrain;
}

function updateAppearanceState() {
  nodes.appearanceButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.appearance === state.appearance);
  });
}

function applyLanguage() {
  const copy = getCopy(state.language);
  document.documentElement.lang = state.language;
  applyShellCopy(nodes, state.language);
  nodes.statusNode.dataset.readyMessage = copy.ready;
  updateLanguageState();
  setLoadingState(nodes, state.isCityLoading, state.language);
  syncStateFromControls();
  setAdvancedControlsOpen(advancedControlsOpen);
  setTopCardCollapsed(topCardCollapsed);
  document.title = state.boundary
    ? copy.documentTitle(state.cityLabel)
    : 'ElevReach';

  if (state.dataset !== null && state.sourceIndex !== null) {
    renderVisualization();
  }
}

function updateLanguageState() {
  nodes.languageButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.language === state.language);
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
  const terrainAnalysis = runElevationAnalysis(state.dataset, {
    activeMask,
    extraEdges: state.extraEdges,
    sourceIndex: state.sourceIndex,
    mode: state.mode,
    upperAllowance: state.upperAllowance,
    lowerAllowance: state.lowerAllowance,
    ascentBudget: state.ascentBudget,
    ascentRoundTrip: state.ascentRoundTrip,
    contiguousOnly: state.contiguousOnly,
  });
  let analysis = terrainAnalysis;
  let statusMessage: string = getCopy(state.language).ready;
  let renderStreetGraph: StreetGraph | null = null;

  if (state.mode === 'ascent' && state.ascentModel === 'street') {
    if (state.boundaryScope !== 'radius') {
      statusMessage = getCopy(state.language).statusStreetRadiusOnly;
    } else {
      const streetGraph = ensureStreetGraphForCurrentRadius();

      if (streetGraph === undefined) {
        statusMessage = getCopy(state.language).statusStreetLoading;
      } else if (streetGraph === null) {
        statusMessage = getCopy(state.language).statusStreetUnavailable;
      } else {
        const streetAnalysis = runStreetAnalysis({
          activeMask,
          ascentBudget: state.ascentBudget,
          dataset: state.dataset,
          graph: streetGraph,
          roundTrip: state.ascentRoundTrip,
          sourceIndex: state.sourceIndex,
        });

        if (streetAnalysis) {
          analysis = streetAnalysis;
          renderStreetGraph = streetGraph;
        } else {
          statusMessage = getCopy(state.language).statusStreetNoStart;
        }
      }
    }
  }

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
    streetGraph: renderStreetGraph,
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
  setStatusView(nodes, statusMessage);
  updateStatsView(
    nodes,
    state.dataset,
    state.sourceIndex,
    analysis,
    populationSummary,
    populationStatus,
    {
      ascentModel: state.ascentModel,
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
    state.language,
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

function parseAscentModel() {
  const selected = nodes.controls.querySelector<HTMLInputElement>(
    'input[name="ascent-model"]:checked',
  );

  return selected?.value === 'street' ? 'street' : 'terrain';
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
  const locale = localeForLanguage(state.language);

  return Number.isInteger(radiusKm)
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(radiusKm)} km`
    : `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(radiusKm)} km`;
}

function ensureStreetGraphForCurrentRadius() {
  if (!state.dataset || state.sourceIndex === null || state.boundaryScope !== 'radius') {
    return null;
  }

  const cacheKey = streetGraphCacheKey(
    state.dataset,
    state.sourceIndex,
    state.boundaryRadiusKm,
  );

  if (state.streetGraphKey === cacheKey) {
    return state.streetGraph;
  }

  const requestId = ++activeStreetGraphRequestId;
  const dataset = state.dataset;
  const sourceIndex = state.sourceIndex;
  const radiusKm = state.boundaryRadiusKm;

  state.streetGraphKey = cacheKey;
  state.streetGraph = undefined;

  void loadStreetGraphForRadius(dataset, sourceIndex, radiusKm)
    .then((streetGraph) => {
      if (
        requestId !== activeStreetGraphRequestId ||
        state.dataset !== dataset ||
        state.sourceIndex !== sourceIndex ||
        state.streetGraphKey !== cacheKey
      ) {
        return;
      }

      state.streetGraph = streetGraph;
      scheduleRender();
    })
    .catch((error) => {
      console.error(error);

      if (
        requestId !== activeStreetGraphRequestId ||
        state.dataset !== dataset ||
        state.streetGraphKey !== cacheKey
      ) {
        return;
      }

      state.streetGraph = null;
      scheduleRender();
    });

  return undefined;
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
  nodes.advancedButton.textContent = open
    ? getCopy(state.language).advancedHide
    : getCopy(state.language).staticText.advancedButton;
}

function setTopCardCollapsed(collapsed: boolean) {
  const shouldCollapse = smallScreenMedia.matches && collapsed;
  const label = nodes.topCardCollapseButton.querySelector<HTMLElement>('.panel-toggle-label');

  topCardCollapsed = shouldCollapse;
  nodes.topCard.classList.toggle('collapsed', shouldCollapse);
  nodes.topCardBody.classList.toggle('hidden', shouldCollapse);
  nodes.topCardCollapseButton.setAttribute('aria-expanded', String(!shouldCollapse));
  if (label) {
    label.textContent = shouldCollapse
      ? state.language === 'cs'
        ? 'Rozbalit'
        : 'Expand'
      : getCopy(state.language).staticText.collapse;
  }
}
