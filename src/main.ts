import L, { type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import {
  cellLatLng,
  elevationAtIndex,
  findNearestInsideIndex,
  indexFromLatLng,
  loadPragueBoundary,
  loadTerrainDataset,
  type BoundaryGeoJson,
  type TerrainDataset,
} from './lib/terrain';
import {
  runElevationAnalysis,
  type AnalysisMode,
  type AnalysisResult,
} from './lib/analysis';
import { renderAnalysisOverlay } from './lib/render';

type PresetKey = 'flat-5' | 'flat-15' | 'ceiling-5' | 'ascent-25';

interface AppState {
  boundary: BoundaryGeoJson | null;
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

app.innerHTML = `
  <div class="shell">
    <aside class="panel">
      <p class="eyebrow">Prague elevation slices</p>
      <h1>Click Prague. See how much of the city shares that height.</h1>
      <p class="lede">
        Same-height bands for flat trips. Elevation ceilings for rough downhill intuition. Cumulative ascent for a more honest one-way or back-and-forth terrain budget.
      </p>

      <div class="preset-bar" aria-label="Presets">
        <button type="button" class="preset active" data-preset="flat-5">Flat ±5 m</button>
        <button type="button" class="preset" data-preset="flat-15">Flat ±15 m</button>
        <button type="button" class="preset" data-preset="ceiling-5">Ceiling +5 m</button>
        <button type="button" class="preset" data-preset="ascent-25">Ascent ≤25 m</button>
      </div>

      <form class="controls" id="controls">
        <fieldset class="mode-switch">
          <legend>Mode</legend>
          <label>
            <input type="radio" name="mode" value="band" checked />
            <span>Elevation band</span>
          </label>
          <label>
            <input type="radio" name="mode" value="ceiling" />
            <span>Elevation ceiling</span>
          </label>
          <label>
            <input type="radio" name="mode" value="ascent" />
            <span>Cumulative ascent</span>
          </label>
        </fieldset>

        <label class="control">
          <div class="control-head">
            <span>Allowed climb</span>
            <output id="upper-output" for="upper-range">5 m</output>
          </div>
          <input id="upper-range" type="range" min="0" max="40" step="1" value="5" />
        </label>

        <label class="control">
          <div class="control-head">
            <span>Allowed drop</span>
            <output id="lower-output" for="lower-range">5 m</output>
          </div>
          <input id="lower-range" type="range" min="0" max="80" step="1" value="5" />
          <small id="lower-hint">Used only in band mode.</small>
        </label>

        <label class="control">
          <div class="control-head">
            <span>Cumulative ascent budget</span>
            <output id="budget-output" for="budget-range">25 m</output>
          </div>
          <input id="budget-range" type="range" min="0" max="160" step="5" value="25" />
          <small id="budget-hint">Used only in cumulative ascent mode.</small>
        </label>

        <fieldset class="mode-switch sub-switch">
          <legend>Ascent budget applies to</legend>
          <label>
            <input type="radio" name="ascent-scope" value="one-way" checked />
            <span>One way</span>
          </label>
          <label>
            <input type="radio" name="ascent-scope" value="round-trip" />
            <span>Back and forth</span>
          </label>
        </fieldset>

        <label class="toggle">
          <input id="connected-toggle" type="checkbox" checked />
          <span>Keep only the connected area from the picked point</span>
        </label>
      </form>

      <div class="stats">
        <article>
          <span class="stat-label">Anchor elevation</span>
          <strong id="elevation-stat">…</strong>
        </article>
        <article>
          <span class="stat-label">Matched share of Prague</span>
          <strong id="share-stat">…</strong>
        </article>
        <article>
          <span class="stat-label">Approx area</span>
          <strong id="area-stat">…</strong>
        </article>
        <article>
          <span class="stat-label">Anchor coordinates</span>
          <strong id="coords-stat">…</strong>
        </article>
      </div>

      <p id="rule-summary" class="rule-summary">Loading terrain…</p>
      <p class="note">
        Terrain-only model. Cumulative ascent uses the least-uphill terrain path, not real streets, bridges, or intersections.
      </p>
      <p class="sources">
        Basemap: OpenStreetMap. Boundary: OpenStreetMap/Nominatim. Elevation: Terrarium tiles.
      </p>
    </aside>

    <section class="stage">
      <div id="map" aria-label="Prague elevation map"></div>
      <div class="map-chrome">
        <div class="chip">Click map to move anchor</div>
        <div class="legend">
          <span class="legend-swatch"></span>
          <span>matched cells</span>
        </div>
        <div id="status" class="status is-loading">Loading Prague boundary…</div>
      </div>
    </section>
  </div>
`;

const controls = must<HTMLFormElement>('#controls');
const upperRange = must<HTMLInputElement>('#upper-range');
const lowerRange = must<HTMLInputElement>('#lower-range');
const upperOutput = must<HTMLOutputElement>('#upper-output');
const lowerOutput = must<HTMLOutputElement>('#lower-output');
const budgetRange = must<HTMLInputElement>('#budget-range');
const budgetOutput = must<HTMLOutputElement>('#budget-output');
const lowerHint = must<HTMLElement>('#lower-hint');
const budgetHint = must<HTMLElement>('#budget-hint');
const ascentScopeInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="ascent-scope"]'),
);
const connectedToggle = must<HTMLInputElement>('#connected-toggle');
const statusNode = must<HTMLElement>('#status');
const elevationStat = must<HTMLElement>('#elevation-stat');
const shareStat = must<HTMLElement>('#share-stat');
const areaStat = must<HTMLElement>('#area-stat');
const coordsStat = must<HTMLElement>('#coords-stat');
const ruleSummary = must<HTMLElement>('#rule-summary');
const presetButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-preset]'),
);

const state: AppState = {
  boundary: null,
  dataset: null,
  sourceIndex: null,
  mode: 'band',
  upperAllowance: Number(upperRange.value),
  lowerAllowance: Number(lowerRange.value),
  ascentBudget: Number(budgetRange.value),
  ascentRoundTrip: false,
  contiguousOnly: connectedToggle.checked,
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

let sourceMarker: L.CircleMarker | null = null;
let overlayLayer: L.ImageOverlay | null = null;
let renderScheduled = false;

bootstrap().catch((error) => {
  console.error(error);
  setStatus(
    error instanceof Error ? error.message : 'Failed to load Prague terrain.',
    true,
  );
});

controls.addEventListener('input', () => {
  syncStateFromControls();
  updatePresetState(null);
  scheduleRender();
});

controls.addEventListener('change', () => {
  syncStateFromControls();
  updatePresetState(null);
  scheduleRender();
});

presetButtons.forEach((button) => {
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
    candidate ?? findNearestInsideIndex(state.dataset, state.dataset.cols / 2, state.dataset.rows / 2);

  if (sourceIndex === null) {
    return;
  }

  state.sourceIndex = sourceIndex;
  setSourceMarker(sourceIndex);
  scheduleRender();
});

function syncStateFromControls() {
  const modeInput = controls.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );

  state.mode = parseMode(modeInput?.value);
  state.upperAllowance = Number(upperRange.value);
  state.lowerAllowance = Number(lowerRange.value);
  state.ascentBudget = Number(budgetRange.value);
  state.ascentRoundTrip = parseAscentScope() === 'round-trip';
  state.contiguousOnly =
    state.mode === 'ascent' ? true : connectedToggle.checked;

  upperOutput.textContent = `${state.upperAllowance} m`;
  lowerOutput.textContent =
    state.mode === 'band' ? `${state.lowerAllowance} m` : '∞ drop';
  budgetOutput.textContent = `${state.ascentBudget} m`;

  upperRange.disabled = state.mode === 'ascent';
  lowerRange.disabled = state.mode !== 'band';
  budgetRange.disabled = state.mode !== 'ascent';
  connectedToggle.disabled = state.mode === 'ascent';
  ascentScopeInputs.forEach((input) => {
    input.disabled = state.mode !== 'ascent';
  });

  if (state.mode === 'ascent') {
    connectedToggle.checked = true;
  }

  lowerHint.textContent =
    state.mode === 'band'
      ? 'Band mode keeps cells inside the upper and lower elevation limits.'
      : state.mode === 'ceiling'
        ? 'Ceiling mode includes every lower cell, which can still understate repeated climbs.'
        : 'Drop limit is not used in cumulative ascent mode.';
  budgetHint.textContent =
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
  const modeInput = controls.querySelector<HTMLInputElement>(
    `input[name="mode"][value="${options.mode}"]`,
  );

  if (modeInput) {
    modeInput.checked = true;
  }

  upperRange.value = String(options.upper);
  lowerRange.value = String(options.lower);
  budgetRange.value = String(options.ascentBudget);
  const ascentScopeInput = controls.querySelector<HTMLInputElement>(
    `input[name="ascent-scope"][value="${options.ascentRoundTrip ? 'round-trip' : 'one-way'}"]`,
  );

  if (ascentScopeInput) {
    ascentScopeInput.checked = true;
  }

  connectedToggle.checked = options.contiguous;
  syncStateFromControls();
}

function updatePresetState(active: PresetKey | null) {
  presetButtons.forEach((button) => {
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

async function bootstrap() {
  syncStateFromControls();

  const boundary = await loadPragueBoundary();
  state.boundary = boundary;

  const bbox = boundary.bbox;
  map.fitBounds(
    [
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ],
    { padding: [24, 24] },
  );

  L.geoJSON(boundary, {
    style: {
      color: '#101a1d',
      weight: 2,
      fillOpacity: 0,
      opacity: 0.7,
      dashArray: '6 8',
    },
  }).addTo(map);

  setStatus('Loading Terrarium elevation tiles…');

  const dataset = await loadTerrainDataset(boundary, {
    zoom: 12,
    sampleStep: 2,
    onProgress: (loaded, total) => {
      setStatus(`Loading elevation tiles… ${loaded}/${total}`);
    },
  });

  state.dataset = dataset;
  state.sourceIndex =
    indexFromLatLng(dataset, 14.4378, 50.0755) ??
    findNearestInsideIndex(dataset, dataset.cols / 2, dataset.rows / 2);

  if (state.sourceIndex === null) {
    throw new Error('Could not find a valid start point inside Prague.');
  }

  setSourceMarker(state.sourceIndex);
  renderVisualization();
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
  const sourcePoint = cellLatLng(dataset, state.sourceIndex!);
  const sourceElevation = elevationAtIndex(dataset, state.sourceIndex!);
  const share = analysis.insideAreaKm2 === 0 ? 0 : analysis.matchedAreaKm2 / analysis.insideAreaKm2;

  elevationStat.textContent = `${sourceElevation.toFixed(0)} m`;
  shareStat.textContent = `${(share * 100).toFixed(1)}%`;
  areaStat.textContent = `${analysis.matchedAreaKm2.toFixed(1)} km²`;
  coordsStat.textContent = `${sourcePoint.lat.toFixed(4)}, ${sourcePoint.lng.toFixed(4)}`;

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
        : 'across all of Prague';
  const caveat =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Terrain path only; best outbound and return paths can differ, and roads may be worse.'
        : 'Terrain path only; road detours can add more climbing.'
      : state.mode === 'ceiling'
        ? 'Useful as a ceiling, not a promise of an easy ride.'
        : '';

  ruleSummary.textContent = `${baseRule}. Showing area ${scope}.${caveat ? ` ${caveat}` : ''}`;
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
  statusNode.textContent = message;
  statusNode.classList.toggle('is-loading', !isError && message !== 'Ready');
  statusNode.classList.toggle('is-error', isError);
}

function must<TElement extends Element>(selector: string) {
  const node = document.querySelector<TElement>(selector);

  if (!node) {
    throw new Error(`Missing node: ${selector}`);
  }

  return node;
}

function parseMode(value: string | undefined): AnalysisMode {
  if (value === 'ceiling' || value === 'ascent') {
    return value;
  }

  return 'band';
}

function parseAscentScope() {
  const selected = controls.querySelector<HTMLInputElement>(
    'input[name="ascent-scope"]:checked',
  );

  return selected?.value === 'round-trip' ? 'round-trip' : 'one-way';
}
