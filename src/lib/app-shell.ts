import { applyStaticCopy, getCopy, type AppLanguage } from './i18n';
import type { AppearancePreference } from './theme';

export interface AppNodes {
  appearanceButtons: HTMLButtonElement[];
  advancedButton: HTMLButtonElement;
  advancedControls: HTMLElement;
  areaLabel: HTMLElement;
  boundaryRadiusHint: HTMLElement;
  boundaryRadiusOutput: HTMLOutputElement;
  boundaryRadiusRange: HTMLInputElement;
  boundaryScopeInputs: HTMLInputElement[];
  clickHint: HTMLElement;
  compactAreaStat: HTMLElement;
  compactPopulationStat: HTMLElement;
  controls: HTMLFormElement;
  languageButtons: HTMLButtonElement[];
  root: HTMLDivElement;
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
  ascentModelInputs: HTMLInputElement[];
  connectedToggle: HTMLInputElement;
  modelNote: HTMLElement;
  statusNode: HTMLElement;
  elevationStat: HTMLElement;
  populationStat: HTMLElement;
  populationNote: HTMLElement;
  populationTooltip: HTMLElement;
  populationTooltipPanel: HTMLElement;
  shareStat: HTMLElement;
  areaStat: HTMLElement;
  coordsStat: HTMLElement;
  ruleSummary: HTMLElement;
}

export function setupAppShell(
  root: HTMLDivElement,
  defaultCityQuery: string,
  language: AppLanguage,
): AppNodes {
  const copy = getCopy(language);
  const appearanceButtonsMarkup = (['system', 'light', 'dark'] as AppearancePreference[])
    .map(
      (value) => `
        <button
          type="button"
          class="appearance-button${value === 'system' ? ' active' : ''}"
          data-appearance="${value}"
          data-i18n-aria-label="${appearanceLabelKey(value)}"
          data-i18n-title="${appearanceLabelKey(value)}"
        >
          <span class="appearance-icon" aria-hidden="true">${appearanceIcon(value)}</span>
        </button>
      `,
    )
    .join('');
  const languageButtonsMarkup = ([
    { code: 'en', label: 'EN', title: 'English' },
    { code: 'cs', label: 'CZ', title: 'Čeština' },
  ] as const)
    .map(
      ({ code, label, title }) => `
        <button
          type="button"
          class="language-button${code === language ? ' active' : ''}"
          data-language="${code}"
          aria-label="${title}"
          title="${title}"
          lang="${code}"
        >
          ${label}
        </button>
      `,
    )
    .join('');

  root.innerHTML = `
    <div class="shell">
      <div
        id="map"
        data-i18n-aria-label="mapAriaLabel"
        aria-label="${copy.staticText.mapAriaLabel}"
      ></div>
      
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
                <span class="panel-toggle-label">${copy.staticText.collapse}</span>
              </button>
              <div
                class="panel-appearance-picker"
                data-i18n-aria-label="appearancePickerLabel"
                aria-label="${copy.staticText.appearancePickerLabel}"
              >
                <div class="appearance-buttons">
                  ${appearanceButtonsMarkup}
                </div>
              </div>
              <div
                class="panel-language-picker"
                data-i18n-aria-label="languagePickerLabel"
                aria-label="${copy.staticText.languagePickerLabel}"
              >
                <div class="language-buttons">
                  ${languageButtonsMarkup}
                </div>
              </div>
            </div>
          </div>

          <div class="panel-body" id="top-card-body">
            <form class="city-form" id="city-form">
              <label class="city-search" for="city-query">
                <span class="sr-only" data-i18n="citySearchLabel">${copy.staticText.citySearchLabel}</span>
                <input
                  id="city-query"
                  name="city-query"
                  type="search"
                  value="${defaultCityQuery}"
                  data-i18n-placeholder="citySearchPlaceholder"
                  placeholder="${copy.staticText.citySearchPlaceholder}"
                  autocomplete="off"
                />
              </label>
              <button
                id="city-submit"
                class="city-submit"
                type="submit"
                data-i18n="searchButton"
              >${copy.staticText.searchButton}</button>
            </form>

            <div class="stats">
              <article>
                <span id="area-label" class="stat-label">Reachable area</span>
                <strong id="area-stat">…</strong>
              </article>
              <article>
                <span class="stat-label" data-i18n="startElevationLabel">${copy.staticText.startElevationLabel}</span>
                <strong id="elevation-stat">…</strong>
              </article>
              <article>
                <span class="stat-label stat-label-with-tooltip">
                  <span data-i18n="populationLabel">${copy.staticText.populationLabel}</span>
                  <span id="population-tooltip" class="info-tooltip" hidden>
                    <button
                      id="population-tooltip-trigger"
                      class="info-tooltip-trigger"
                      type="button"
                      data-i18n-aria-label="populationTooltipLabel"
                      aria-describedby="population-tooltip-panel"
                      data-i18n-title="populationTooltipLabel"
                      aria-label="${copy.staticText.populationTooltipLabel}"
                      title="${copy.staticText.populationTooltipLabel}"
                    >
                      ?
                    </button>
                    <span id="population-tooltip-panel" class="info-tooltip-panel" role="tooltip">
                      ${copy.staticText.populationTooltipFallback}
                    </span>
                  </span>
                </span>
                <strong id="population-stat">—</strong>
              </article>
            </div>

            <p id="rule-summary" class="rule-summary">${copy.staticText.initialRuleSummary}</p>
            <p id="population-note" class="sources">
              ${copy.staticText.initialPopulationUnavailable}
            </p>
          </div>

          <div class="panel-compact-summary" id="top-card-compact-summary" aria-live="polite">
            <span id="compact-area-stat" class="compact-summary-item">Reach …</span>
            <span id="compact-population-stat" class="compact-summary-item">Res —</span>
          </div>
        </div>

        <!-- Bottom Center -->
        <div class="floating-panel bottom-center">
          <form class="controls-shell" id="controls">
            <div class="controls primary-controls">
              <label class="control" id="boundary-radius-control">
                <div class="control-head">
                  <span data-i18n="tripRadiusLabel">${copy.staticText.tripRadiusLabel}</span>
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
              >${copy.staticText.advancedButton}</button>
            </div>

            <div id="advanced-controls" class="controls advanced-controls hidden">
              <fieldset class="mode-switch sub-switch boundary-switch">
                <legend data-i18n="searchAreaLegend">${copy.staticText.searchAreaLegend}</legend>
                <label>
                  <input type="radio" name="boundary-scope" value="city" />
                  <span data-i18n="searchAreaCity">${copy.staticText.searchAreaCity}</span>
                </label>
                <label>
                  <input type="radio" name="boundary-scope" value="radius" checked />
                  <span data-i18n="searchAreaRadius">${copy.staticText.searchAreaRadius}</span>
                </label>
              </fieldset>

              <fieldset class="mode-switch">
                <legend data-i18n="terrainLensLegend">${copy.staticText.terrainLensLegend}</legend>
                <label>
                  <input type="radio" name="mode" value="band" />
                  <span data-i18n="terrainLensBand">${copy.staticText.terrainLensBand}</span>
                </label>
                <label>
                  <input type="radio" name="mode" value="ceiling" />
                  <span data-i18n="terrainLensCeiling">${copy.staticText.terrainLensCeiling}</span>
                </label>
                <label>
                  <input type="radio" name="mode" value="ascent" checked />
                  <span data-i18n="terrainLensAscent">${copy.staticText.terrainLensAscent}</span>
                </label>
              </fieldset>

              <label class="control" id="upper-control">
                <div class="control-head">
                  <span data-i18n="maxRiseLabel">${copy.staticText.maxRiseLabel}</span>
                  <output id="upper-output" for="upper-range">15 m</output>
                </div>
                <input id="upper-range" type="range" min="0" max="40" step="1" value="15" />
              </label>

              <label class="control" id="lower-control">
                <div class="control-head">
                  <span data-i18n="maxDropLabel">${copy.staticText.maxDropLabel}</span>
                  <output id="lower-output" for="lower-range">15 m</output>
                </div>
                <input id="lower-range" type="range" min="0" max="80" step="1" value="15" />
              </label>

              <fieldset class="mode-switch sub-switch" id="ascent-scope-control">
                <legend data-i18n="ascentScopeLegend">${copy.staticText.ascentScopeLegend}</legend>
                <label>
                  <input type="radio" name="ascent-scope" value="one-way" />
                  <span data-i18n="ascentScopeOneWay">${copy.staticText.ascentScopeOneWay}</span>
                </label>
                <label>
                  <input type="radio" name="ascent-scope" value="round-trip" checked />
                  <span data-i18n="ascentScopeRoundTrip">${copy.staticText.ascentScopeRoundTrip}</span>
                </label>
              </fieldset>

              <fieldset class="mode-switch sub-switch" id="ascent-model-control">
                <legend data-i18n="routeModelLegend">${copy.staticText.routeModelLegend}</legend>
                <label>
                  <input type="radio" name="ascent-model" value="terrain" checked />
                  <span data-i18n="routeModelTerrain">${copy.staticText.routeModelTerrain}</span>
                </label>
                <label>
                  <input type="radio" name="ascent-model" value="street" />
                  <span data-i18n="routeModelStreet">${copy.staticText.routeModelStreet}</span>
                </label>
              </fieldset>

              <p id="model-note" class="note">
                ${copy.staticText.initialModelNote}
              </p>
            </div>
          </form>
        </div>

        <!-- Bottom Left -->
        <div class="floating-panel bottom-left">
          <div id="click-hint" class="chip">${copy.staticText.initialClickHint}</div>
          <div class="legend">
            <span class="legend-swatch"></span>
            <span data-i18n="legendReachableArea">${copy.staticText.legendReachableArea}</span>
          </div>
          <div id="status" class="status is-loading">${copy.staticText.initialStatus}</div>
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
  applyStaticCopy(root, language);

  return {
    appearanceButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-appearance]'),
    ),
    advancedButton: must<HTMLButtonElement>('#advanced-toggle'),
    advancedControls: must<HTMLElement>('#advanced-controls'),
    areaLabel: must<HTMLElement>('#area-label'),
    boundaryRadiusHint: must<HTMLElement>('#boundary-radius-hint'),
    boundaryRadiusOutput: must<HTMLOutputElement>('#boundary-radius-output'),
    boundaryRadiusRange: must<HTMLInputElement>('#boundary-radius-range'),
    boundaryScopeInputs: Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="boundary-scope"]'),
    ),
    clickHint: must<HTMLElement>('#click-hint'),
    compactAreaStat: must<HTMLElement>('#compact-area-stat'),
    compactPopulationStat: must<HTMLElement>('#compact-population-stat'),
    controls: must<HTMLFormElement>('#controls'),
    languageButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-language]'),
    ),
    root,
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
    ascentModelInputs: Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="ascent-model"]'),
    ),
    connectedToggle: must<HTMLInputElement>('#connected-toggle'),
    modelNote: must<HTMLElement>('#model-note'),
    statusNode: must<HTMLElement>('#status'),
    elevationStat: must<HTMLElement>('#elevation-stat'),
    populationStat: must<HTMLElement>('#population-stat'),
    populationNote: must<HTMLElement>('#population-note'),
    populationTooltip: must<HTMLElement>('#population-tooltip'),
    populationTooltipPanel: must<HTMLElement>('#population-tooltip-panel'),
    shareStat: must<HTMLElement>('#share-stat'),
    areaStat: must<HTMLElement>('#area-stat'),
    coordsStat: must<HTMLElement>('#coords-stat'),
    ruleSummary: must<HTMLElement>('#rule-summary'),
  };
}

export function applyShellCopy(nodes: AppNodes, language: AppLanguage) {
  applyStaticCopy(nodes.root, language);
}

function appearanceLabelKey(value: AppearancePreference) {
  switch (value) {
    case 'light':
      return 'appearanceLightMode';
    case 'dark':
      return 'appearanceDarkMode';
    default:
      return 'appearanceSystemMode';
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
