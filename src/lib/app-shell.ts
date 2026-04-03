import type { AppearancePreference } from './theme';

export interface AppNodes {
  appearanceButtons: HTMLButtonElement[];
  boundaryRadiusHint: HTMLElement;
  boundaryRadiusOutput: HTMLOutputElement;
  boundaryRadiusRange: HTMLInputElement;
  boundaryScopeInputs: HTMLInputElement[];
  clickHint: HTMLElement;
  controls: HTMLFormElement;
  searchForm: HTMLFormElement;
  searchInput: HTMLInputElement;
  searchButton: HTMLButtonElement;
  upperRange: HTMLInputElement;
  lowerRange: HTMLInputElement;
  budgetRange: HTMLInputElement;
  upperOutput: HTMLOutputElement;
  lowerOutput: HTMLOutputElement;
  budgetOutput: HTMLOutputElement;
  lowerHint: HTMLElement;
  budgetHint: HTMLElement;
  ascentScopeInputs: HTMLInputElement[];
  connectedToggle: HTMLInputElement;
  statusNode: HTMLElement;
  elevationStat: HTMLElement;
  shareStat: HTMLElement;
  areaStat: HTMLElement;
  coordsStat: HTMLElement;
  ruleSummary: HTMLElement;
  presetButtons: HTMLButtonElement[];
}

export function setupAppShell(
  root: HTMLDivElement,
  defaultCityQuery: string,
): AppNodes {
  const appearanceButtonsMarkup = (['system', 'light', 'dark'] as AppearancePreference[])
    .map(
      (value) => `
        <button
          type="button"
          class="appearance-button${value === 'system' ? ' active' : ''}"
          data-appearance="${value}"
          aria-label="${appearanceLabel(value)} mode"
          title="${appearanceLabel(value)} mode"
        >
          <span class="appearance-icon" aria-hidden="true">${appearanceIcon(value)}</span>
        </button>
      `,
    )
    .join('');

  root.innerHTML = `
    <div class="shell">
      <aside class="panel">
        <div class="panel-top">
          <p class="eyebrow">ElevReach</p>
          <div class="panel-appearance-picker" aria-label="Appearance">
            <div class="appearance-buttons">
              ${appearanceButtonsMarkup}
            </div>
          </div>
        </div>
        <h1>How much of the city is an easy trip?</h1>
        <p class="lede">
          See the areas you can reach from any starting point without a lot of effort. Click anywhere on the map to explore your accessible zone.
        </p>

        <form class="city-form" id="city-form">
          <label class="city-search" for="city-query">
            <span class="sr-only">City search</span>
            <input
              id="city-query"
              name="city-query"
              type="search"
              value="${defaultCityQuery}"
              placeholder="Try Lisbon, Portugal"
              autocomplete="off"
            />
          </label>
          <button id="city-submit" class="city-submit" type="submit">Search</button>
        </form>

        <div class="preset-bar" aria-label="Presets">
          <button type="button" class="preset" data-preset="flat-5">Flat ±5 m</button>
          <button type="button" class="preset" data-preset="flat-15">Flat ±15 m</button>
          <button type="button" class="preset" data-preset="ceiling-5">Max +5 m</button>
          <button type="button" class="preset active" data-preset="ascent-25">Climb ≤25 m</button>
        </div>

        <form class="controls" id="controls">
          <fieldset class="mode-switch sub-switch boundary-switch">
            <legend>Search area</legend>
            <label>
              <input type="radio" name="boundary-scope" value="city" checked />
              <span>City limits</span>
            </label>
            <label>
              <input type="radio" name="boundary-scope" value="radius" />
              <span>Radius</span>
            </label>
          </fieldset>

          <label class="control" id="boundary-radius-control">
            <div class="control-head">
              <span>Search distance</span>
              <output id="boundary-radius-output" for="boundary-radius-range">6 km</output>
            </div>
            <input id="boundary-radius-range" type="range" min="1" max="25" step="0.5" value="6" />
            <small id="boundary-radius-hint">Radius mode follows the selected map point.</small>
          </label>

          <fieldset class="mode-switch">
            <legend>Analysis mode</legend>
            <label>
              <input type="radio" name="mode" value="band" />
              <span>Flat zone</span>
            </label>
            <label>
              <input type="radio" name="mode" value="ceiling" />
              <span>Elevation cap</span>
            </label>
            <label>
              <input type="radio" name="mode" value="ascent" checked />
              <span>Total climbing</span>
            </label>
          </fieldset>

          <label class="control" id="upper-control">
            <div class="control-head">
              <span>Max climb up</span>
              <output id="upper-output" for="upper-range">15 m</output>
            </div>
            <input id="upper-range" type="range" min="0" max="40" step="1" value="15" />
          </label>

          <label class="control" id="lower-control">
            <div class="control-head">
              <span>Max drop down</span>
              <output id="lower-output" for="lower-range">15 m</output>
            </div>
            <input id="lower-range" type="range" min="0" max="80" step="1" value="15" />
            <small id="lower-hint">Used only in flat zone mode.</small>
          </label>

          <label class="control" id="budget-control">
            <div class="control-head">
              <span>Max total climbing</span>
              <output id="budget-output" for="budget-range">25 m</output>
            </div>
            <input id="budget-range" type="range" min="0" max="160" step="5" value="25" />
            <small id="budget-hint">Used only in total climbing mode.</small>
          </label>

          <fieldset class="mode-switch sub-switch" id="ascent-scope-control">
            <legend>Apply climbing limit to</legend>
            <label>
              <input type="radio" name="ascent-scope" value="one-way" checked />
              <span>One-way trip</span>
            </label>
            <label>
              <input type="radio" name="ascent-scope" value="round-trip" />
              <span>Round trip</span>
            </label>
          </fieldset>

          <label class="toggle" id="connected-control">
            <input id="connected-toggle" type="checkbox" checked />
            <span>Show only directly reachable areas (no jumps)</span>
          </label>
        </form>

        <div class="stats">
          <article>
            <span class="stat-label">Start elevation</span>
            <strong id="elevation-stat">…</strong>
          </article>
          <article>
            <span class="stat-label">Reachable area within boundary</span>
            <strong id="share-stat">…</strong>
          </article>
          <article>
            <span class="stat-label">Approx. area</span>
            <strong id="area-stat">…</strong>
          </article>
          <article>
            <span class="stat-label">Start coordinates</span>
            <strong id="coords-stat">…</strong>
          </article>
        </div>

        <p id="rule-summary" class="rule-summary">Loading terrain…</p>
        <p class="note">
          Terrain-only model. Total climbing uses the least-uphill terrain path, not real streets, bridges, or intersections.
        </p>
        <p class="sources">
          Basemap: CARTO raster tiles. Boundary search: OpenStreetMap/Nominatim. Elevation: Terrarium tiles.
        </p>
      </aside>

      <section class="stage">
        <div id="map" aria-label="City elevation map"></div>
        <div class="map-chrome">
          <div id="click-hint" class="chip">Click map to move anchor</div>
          <div class="legend">
            <span class="legend-swatch"></span>
            <span>matched cells</span>
          </div>
          <div id="status" class="status is-loading">Loading default city…</div>
        </div>
      </section>
    </div>
  `;

  return {
    appearanceButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-appearance]'),
    ),
    boundaryRadiusHint: must<HTMLElement>('#boundary-radius-hint'),
    boundaryRadiusOutput: must<HTMLOutputElement>('#boundary-radius-output'),
    boundaryRadiusRange: must<HTMLInputElement>('#boundary-radius-range'),
    boundaryScopeInputs: Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="boundary-scope"]'),
    ),
    clickHint: must<HTMLElement>('#click-hint'),
    controls: must<HTMLFormElement>('#controls'),
    searchForm: must<HTMLFormElement>('#city-form'),
    searchInput: must<HTMLInputElement>('#city-query'),
    searchButton: must<HTMLButtonElement>('#city-submit'),
    upperRange: must<HTMLInputElement>('#upper-range'),
    lowerRange: must<HTMLInputElement>('#lower-range'),
    budgetRange: must<HTMLInputElement>('#budget-range'),
    upperOutput: must<HTMLOutputElement>('#upper-output'),
    lowerOutput: must<HTMLOutputElement>('#lower-output'),
    budgetOutput: must<HTMLOutputElement>('#budget-output'),
    lowerHint: must<HTMLElement>('#lower-hint'),
    budgetHint: must<HTMLElement>('#budget-hint'),
    ascentScopeInputs: Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="ascent-scope"]'),
    ),
    connectedToggle: must<HTMLInputElement>('#connected-toggle'),
    statusNode: must<HTMLElement>('#status'),
    elevationStat: must<HTMLElement>('#elevation-stat'),
    shareStat: must<HTMLElement>('#share-stat'),
    areaStat: must<HTMLElement>('#area-stat'),
    coordsStat: must<HTMLElement>('#coords-stat'),
    ruleSummary: must<HTMLElement>('#rule-summary'),
    presetButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-preset]'),
    ),
  };
}

function appearanceLabel(value: AppearancePreference) {
  switch (value) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
}

function appearanceIcon(value: AppearancePreference) {
  switch (value) {
    case 'light':
      return `
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2.5v3.2M12 18.3v3.2M21.5 12h-3.2M5.7 12H2.5M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3M18.7 18.7l-2.3-2.3M7.6 7.6 5.3 5.3"></path>
        </svg>
      `;
    case 'dark':
      return `
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M14.8 3.4a8.7 8.7 0 1 0 5.8 15.1A9.4 9.4 0 0 1 14.8 3.4Z"></path>
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 3a9 9 0 1 0 0 18Z"></path>
          <path d="M12 3a9 9 0 0 1 0 18Z" opacity="0.35"></path>
        </svg>
      `;
  }
}

function must<TElement extends Element>(selector: string) {
  const node = document.querySelector<TElement>(selector);

  if (!node) {
    throw new Error(`Missing node: ${selector}`);
  }

  return node;
}
