import type { AppearancePreference } from './theme';

export interface AppNodes {
  appearanceButtons: HTMLButtonElement[];
  controls: HTMLFormElement;
  searchForm: HTMLFormElement;
  searchInput: HTMLInputElement;
  searchButton: HTMLButtonElement;
  cityLabel: HTMLElement;
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
        <h1>Load a city. See which parts share a climb budget.</h1>
        <p class="lede">
          Same-height bands for flat trips. Elevation ceilings for rough downhill intuition. Cumulative ascent for a more honest one-way or back-and-forth terrain budget.
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
          <button id="city-submit" class="city-submit" type="submit">Load city</button>
        </form>

        <div class="city-meta">
          <span class="city-meta-label">Current city</span>
          <strong id="city-label" class="city-label">${defaultCityQuery}</strong>
        </div>

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
            <span class="stat-label">Matched share of city</span>
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
          Basemap: Stadia Maps Alidade. Boundary search: OpenStreetMap/Nominatim. Elevation: Terrarium tiles.
        </p>
      </aside>

      <section class="stage">
        <div id="map" aria-label="City elevation map"></div>
        <div class="map-chrome">
          <div class="chip">Click map to move anchor</div>
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
    controls: must<HTMLFormElement>('#controls'),
    searchForm: must<HTMLFormElement>('#city-form'),
    searchInput: must<HTMLInputElement>('#city-query'),
    searchButton: must<HTMLButtonElement>('#city-submit'),
    cityLabel: must<HTMLElement>('#city-label'),
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
