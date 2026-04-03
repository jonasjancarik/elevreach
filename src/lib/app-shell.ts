import type { AppearancePreference } from './theme';

export interface AppNodes {
  appearanceButtons: HTMLButtonElement[];
  advancedButton: HTMLButtonElement;
  advancedControls: HTMLElement;
  boundaryRadiusHint: HTMLElement;
  boundaryRadiusOutput: HTMLOutputElement;
  boundaryRadiusRange: HTMLInputElement;
  boundaryScopeInputs: HTMLInputElement[];
  clickHint: HTMLElement;
  controls: HTMLFormElement;
  searchForm: HTMLFormElement;
  searchInput: HTMLInputElement;
  searchButton: HTMLButtonElement;
  topCard: HTMLElement;
  topCardBody: HTMLElement;
  topCardCollapseButton: HTMLButtonElement;
  upperRange: HTMLInputElement;
  lowerRange: HTMLInputElement;
  budgetRange: HTMLInputElement;
  budgetLabel: HTMLElement;
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
      <div id="map" aria-label="City elevation map"></div>
      
      <div class="map-overlay">
        <!-- Top Left -->
        <div class="floating-panel top-left" id="top-card">
          <div class="panel-top">
            <p class="eyebrow">ElevReach</p>
            <div class="panel-actions">
              <button
                id="top-card-toggle"
                class="panel-toggle"
                type="button"
                aria-expanded="true"
                aria-controls="top-card-body"
              >
                <span class="panel-toggle-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M6.5 9.5 12 15l5.5-5.5"></path>
                  </svg>
                </span>
                <span class="panel-toggle-label">Collapse</span>
              </button>
              <div class="panel-appearance-picker" aria-label="Appearance">
                <div class="appearance-buttons">
                  ${appearanceButtonsMarkup}
                </div>
              </div>
            </div>
          </div>

          <div class="panel-body" id="top-card-body">
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

            <div class="stats">
              <article>
                <span class="stat-label">Reachable area</span>
                <strong id="area-stat">…</strong>
              </article>
              <article>
                <span class="stat-label">Start elevation</span>
                <strong id="elevation-stat">…</strong>
              </article>
            </div>

            <p id="rule-summary" class="rule-summary">Loading terrain…</p>
          </div>
        </div>

        <!-- Bottom Center -->
        <div class="floating-panel bottom-center">
          <form class="controls-shell" id="controls">
            <div class="controls primary-controls">
              <label class="control" id="boundary-radius-control">
                <div class="control-head">
                  <span>Trip radius</span>
                  <output id="boundary-radius-output" for="boundary-radius-range">5 km</output>
                </div>
                <input id="boundary-radius-range" type="range" min="1" max="25" step="0.5" value="5" />
              </label>

              <label class="control" id="budget-control">
                <div class="control-head">
                  <span id="budget-label">Round-trip uphill limit</span>
                  <output id="budget-output" for="budget-range">30 m</output>
                </div>
                <input id="budget-range" type="range" min="0" max="200" step="5" value="30" />
              </label>

              <button
                id="advanced-toggle"
                class="advanced-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="advanced-controls"
              >
                Advanced
              </button>
            </div>

            <div id="advanced-controls" class="controls advanced-controls hidden">
              <fieldset class="mode-switch sub-switch boundary-switch">
                <legend>Search area</legend>
                <label>
                  <input type="radio" name="boundary-scope" value="city" />
                  <span>City limits</span>
                </label>
                <label>
                  <input type="radio" name="boundary-scope" value="radius" checked />
                  <span>Radius</span>
                </label>
              </fieldset>

              <fieldset class="mode-switch">
                <legend>Terrain lens</legend>
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
                  <span>Climb budget</span>
                </label>
              </fieldset>

              <label class="control" id="upper-control">
                <div class="control-head">
                  <span>Max rise above start</span>
                  <output id="upper-output" for="upper-range">15 m</output>
                </div>
                <input id="upper-range" type="range" min="0" max="40" step="1" value="15" />
              </label>

              <label class="control" id="lower-control">
                <div class="control-head">
                  <span>Max drop below start</span>
                  <output id="lower-output" for="lower-range">15 m</output>
                </div>
                <input id="lower-range" type="range" min="0" max="80" step="1" value="15" />
              </label>

              <fieldset class="mode-switch sub-switch" id="ascent-scope-control">
                <legend>Apply climbing limit to</legend>
                <label>
                  <input type="radio" name="ascent-scope" value="one-way" />
                  <span>One-way</span>
                </label>
                <label>
                  <input type="radio" name="ascent-scope" value="round-trip" checked />
                  <span>Round trip</span>
                </label>
              </fieldset>

              <p class="note">
                Default view: trip radius plus round-trip climb budget. Terrain only. No street network or distance penalty yet.
              </p>
            </div>
          </form>
        </div>

        <!-- Bottom Left -->
        <div class="floating-panel bottom-left">
          <div id="click-hint" class="chip">Click map to move start</div>
          <div class="legend">
            <span class="legend-swatch"></span>
            <span>reachable area</span>
          </div>
          <div id="status" class="status is-loading">Loading default city…</div>
        </div>
      </div>
      
      <!-- hidden stats so TS doesn't complain for now -->
      <div style="display: none;">
        <span id="share-stat"></span>
        <span id="coords-stat"></span>
        <input id="connected-toggle" type="checkbox" checked />
        <span id="boundary-radius-hint"></span>
        <span id="lower-hint"></span>
        <span id="budget-hint"></span>
      </div>
    </div>
  `;

  return {
    appearanceButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-appearance]'),
    ),
    advancedButton: must<HTMLButtonElement>('#advanced-toggle'),
    advancedControls: must<HTMLElement>('#advanced-controls'),
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
    topCard: must<HTMLElement>('#top-card'),
    topCardBody: must<HTMLElement>('#top-card-body'),
    topCardCollapseButton: must<HTMLButtonElement>('#top-card-toggle'),
    upperRange: must<HTMLInputElement>('#upper-range'),
    lowerRange: must<HTMLInputElement>('#lower-range'),
    budgetRange: must<HTMLInputElement>('#budget-range'),
    budgetLabel: must<HTMLElement>('#budget-label'),
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
