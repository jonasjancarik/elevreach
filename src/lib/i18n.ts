export type AppLanguage = "en" | "cs";

const STORAGE_KEY = "city-elevation:language";

interface StaticTextCatalog {
  advancedButton: string;
  appearanceDarkMode: string;
  appearanceLightMode: string;
  appearancePickerLabel: string;
  appearanceSystemMode: string;
  citySearchLabel: string;
  citySearchPlaceholder: string;
  collapse: string;
  initialClickHint: string;
  initialModelNote: string;
  initialPopulationUnavailable: string;
  initialRuleSummary: string;
  initialStatus: string;
  languagePickerLabel: string;
  legendReachableArea: string;
  mapAriaLabel: string;
  maxDropLabel: string;
  maxRiseLabel: string;
  populationLabel: string;
  populationTooltipFallback: string;
  populationTooltipLabel: string;
  routeModelLegend: string;
  routeModelStreet: string;
  routeModelTerrain: string;
  searchAreaCity: string;
  searchAreaLegend: string;
  searchAreaRadius: string;
  searchButton: string;
  startElevationLabel: string;
  terrainLensAscent: string;
  terrainLensBand: string;
  terrainLensCeiling: string;
  terrainLensLegend: string;
  tripRadiusLabel: string;
  uphillLimitOneWay: string;
  uphillLimitRoundTrip: string;
  ascentScopeLegend: string;
  ascentScopeOneWay: string;
  ascentScopeRoundTrip: string;
}

interface CopyCatalog {
  staticText: StaticTextCatalog;
  locale: string;
  advancedHide: string;
  boundaryDataMissing: (label: string) => string;
  boundaryRadiusHintCity: (cityLabel: string) => string;
  boundaryRadiusHintRadius: string;
  boundaryResponseMalformed: (label: string) => string;
  boundarySearchFailed: (status: string) => string;
  budgetHintInactive: string;
  budgetHintStreetCity: string;
  budgetHintStreetRadius: string;
  budgetHintTerrainOneWay: string;
  budgetHintTerrainRoundTrip: string;
  budgetLabelInactive: string;
  budgetLabelStreetOneWay: string;
  budgetLabelStreetRoundTrip: string;
  budgetLabelTerrainOneWay: string;
  budgetLabelTerrainRoundTrip: string;
  bundledBoundaryLoadFailed: (status: string) => string;
  caveatCeiling: string;
  caveatStreet: (snappedDistanceMeters: number | null) => string;
  caveatTerrainOneWay: string;
  caveatTerrainRoundTrip: string;
  clickHintCity: string;
  clickHintRadius: string;
  compactPopulation: (value: string) => string;
  compactPopulationLoading: string;
  compactPopulationUnavailable: string;
  compactReach: (value: string) => string;
  documentTitle: (label: string) => string;
  enterCityName: string;
  failedToLoadCityTerrain: string;
  invalidAnchor: (label: string) => string;
  loadingCity: (query: string) => string;
  loadingDefaultCityBoundary: string;
  loadingElevation: (label: string) => string;
  loadingElevationTiles: (
    label: string,
    loaded: number,
    total: number,
  ) => string;
  loadingPraguePopulation: string;
  loadingSearchButton: string;
  modelNoteInactive: string;
  modelNoteStreet: string;
  modelNoteTerrain: string;
  noCityBoundaryFound: (query: string) => string;
  populationEstimateUnavailable: string;
  populationTooltipStreet: (sourceName: string, method: string) => string;
  populationTooltipTerrain: (sourceName: string, method: string) => string;
  ready: string;
  ruleBand: (
    sourceElevation: string,
    lowerAllowance: number,
    upperAllowance: number,
  ) => string;
  ruleCeiling: (sourceElevation: string, upperAllowance: number) => string;
  ruleScopeAcrossCity: (cityLabel: string) => string;
  ruleScopeAcrossRadius: (radius: string) => string;
  ruleScopeConnected: string;
  ruleScopeConnectedRadius: (radius: string) => string;
  ruleScopeFromStart: string;
  ruleScopeFromStartRadius: (radius: string) => string;
  ruleSummary: (baseRule: string, scope: string, caveat: string) => string;
  ruleStreetAscentOneWay: (budget: number) => string;
  ruleStreetAscentRoundTrip: (budget: number) => string;
  ruleTerrainAscentOneWay: (budget: number) => string;
  ruleTerrainAscentRoundTrip: (budget: number) => string;
  searchValidationError: string;
  streetGraphLoadFailed: (detail: string) => string;
  statusStreetLoading: string;
  statusStreetNoStart: string;
  statusStreetRadiusOnly: string;
  statusStreetUnavailable: string;
}

const ENGLISH_MESSAGES: CopyCatalog = {
  staticText: {
    advancedButton: "Advanced",
    appearanceDarkMode: "Dark mode",
    appearanceLightMode: "Light mode",
    appearancePickerLabel: "Appearance",
    appearanceSystemMode: "System mode",
    citySearchLabel: "City search",
    citySearchPlaceholder: "Try Lisbon, Portugal",
    collapse: "Collapse",
    initialClickHint: "Click map to move start",
    initialModelNote:
      "Default view: trip radius plus round-trip climb budget. Terrain only. No street network or distance penalty yet.",
    initialPopulationUnavailable: "Population estimate unavailable.",
    initialRuleSummary: "Loading terrain…",
    initialStatus: "Loading default city…",
    languagePickerLabel: "Language",
    legendReachableArea: "reachable area",
    mapAriaLabel: "City elevation map",
    maxDropLabel: "Max drop below start",
    maxRiseLabel: "Max rise above start",
    populationLabel: "Approx residents",
    populationTooltipFallback: "Population estimate details",
    populationTooltipLabel: "Population estimate details",
    routeModelLegend: "Route model",
    routeModelStreet: "Street graph beta",
    routeModelTerrain: "Terrain grid",
    searchAreaCity: "City limits",
    searchAreaLegend: "Search area",
    searchAreaRadius: "Radius",
    searchButton: "Search",
    startElevationLabel: "Start elevation",
    terrainLensAscent: "Climb budget",
    terrainLensBand: "Flat zone",
    terrainLensCeiling: "Elevation cap",
    terrainLensLegend: "Terrain lens",
    tripRadiusLabel: "Trip radius",
    uphillLimitOneWay: "One-way uphill limit",
    uphillLimitRoundTrip: "Round-trip uphill limit",
    ascentScopeLegend: "Apply climbing limit to",
    ascentScopeOneWay: "One-way",
    ascentScopeRoundTrip: "Round trip",
  },
  locale: "en-US",
  advancedHide: "Hide advanced",
  boundaryDataMissing: (label: string) => `Boundary data missing for ${label}.`,
  boundaryRadiusHintCity: (cityLabel: string) =>
    `City mode searches within the borders of ${cityLabel}.`,
  boundaryRadiusHintRadius:
    "Radius mode uses straight-line distance from the start. Click anywhere to move the trip area.",
  boundaryResponseMalformed: (label: string) =>
    `Boundary response malformed for ${label}.`,
  boundarySearchFailed: (status: string) => `Boundary search failed: ${status}`,
  budgetHintInactive: "Used only in climb budget mode.",
  budgetHintStreetCity:
    "Street beta currently uses Radius scope. City scope falls back to terrain reach.",
  budgetHintStreetRadius:
    "Street beta prices distance, uphill, and steep ramps into climb-equivalent meters. OSM only.",
  budgetHintTerrainOneWay:
    "Counts uphill meters one-way only. Distance is not priced, so flat detours are effectively free.",
  budgetHintTerrainRoundTrip:
    "Counts uphill meters out and uphill meters back. Distance is still not priced.",
  budgetLabelInactive: "Climb budget",
  budgetLabelStreetOneWay: "One-way effort limit",
  budgetLabelStreetRoundTrip: "Round-trip effort limit",
  budgetLabelTerrainOneWay: "One-way uphill limit",
  budgetLabelTerrainRoundTrip: "Round-trip uphill limit",
  bundledBoundaryLoadFailed: (status: string) =>
    `Bundled boundary load failed: ${status}`,
  caveatCeiling: "Repeated short hills may add up to a lot of climbing.",
  caveatStreet: (snappedDistanceMeters: number | null) =>
    `OSM streets only. Prices distance, uphill, and steep ramps, but not traffic, surface, or junction stress.${snappedDistanceMeters && snappedDistanceMeters > 35 ? ` Start snapped ${Math.round(snappedDistanceMeters)} m to the nearest routable street.` : ""}`,
  caveatTerrainOneWay:
    "Based on terrain only - not taking into account actual street routes.",
  caveatTerrainRoundTrip:
    "Based on terrain only - not taking into account actual street routes.",
  clickHintCity: "Click map to move start",
  clickHintRadius: "Click map to move start + boundary",
  compactPopulation: (value: string) => `Res ≈${value}`,
  compactPopulationLoading: "Res …",
  compactPopulationUnavailable: "Res —",
  compactReach: (value: string) => `Reach ${value}`,
  documentTitle: (label: string) => `ElevReach: ${label}`,
  enterCityName: 'Enter a city name, ideally "City, Country".',
  failedToLoadCityTerrain: "Failed to load city terrain.",
  invalidAnchor: (label: string) =>
    `Could not find a valid anchor point inside ${label}.`,
  loadingCity: (query: string) => `Loading ${query}…`,
  loadingDefaultCityBoundary: "Loading default city boundary…",
  loadingElevation: (label: string) => `Loading elevation for ${label}…`,
  loadingElevationTiles: (label: string, loaded: number, total: number) =>
    `Loading elevation tiles for ${label}… ${loaded}/${total}`,
  loadingPraguePopulation: "Loading Prague population estimate…",
  loadingSearchButton: "Loading…",
  modelNoteInactive: "Climb-budget modes only.",
  modelNoteStreet:
    "Street graph beta uses routable OSM streets inside the current trip radius. Cost mixes distance, uphill, and steep ramps.",
  modelNoteTerrain:
    "Terrain grid mode uses least-uphill DEM paths only. No street network or distance penalty yet.",
  noCityBoundaryFound: (query: string) =>
    `No city boundary found for "${query}". Try "City, Country".`,
  populationEstimateUnavailable:
    "Population estimate unavailable for this city or boundary.",
  populationTooltipStreet: (sourceName: string, method: string) =>
    `Prague-only estimate over buffered reachable street cells. Source: ${sourceName}. ${method}`,
  populationTooltipTerrain: (sourceName: string, method: string) =>
    `Prague-only estimate. Source: ${sourceName}. ${method}`,
  ready: "Ready",
  ruleBand: (
    sourceElevation: string,
    lowerAllowance: number,
    upperAllowance: number,
  ) =>
    `Areas between ${sourceElevation} m - ${lowerAllowance} m and + ${upperAllowance} m`,
  ruleCeiling: (sourceElevation: string, upperAllowance: number) =>
    `Areas at ${sourceElevation} m + ${upperAllowance} m or lower`,
  ruleScopeAcrossCity: (cityLabel: string) => `across ${cityLabel}`,
  ruleScopeAcrossRadius: (radius: string) =>
    `across the ${radius} straight-line radius`,
  ruleScopeConnected: "connected to the start point",
  ruleScopeConnectedRadius: (radius: string) =>
    `connected to the start point within a ${radius} straight-line radius`,
  ruleScopeFromStart: "from the start point",
  ruleScopeFromStartRadius: (radius: string) =>
    `within a ${radius} straight-line radius of the start point`,
  ruleSummary: (baseRule: string, scope: string, caveat: string) =>
    `${baseRule}. Showing area ${scope}.${caveat ? ` ${caveat}` : ""}`,
  ruleStreetAscentOneWay: (budget: number) =>
    `Street network whose outward route cost stays within ${budget} m-eq`,
  ruleStreetAscentRoundTrip: (budget: number) =>
    `Street network whose there-and-back route cost stays within ${budget} m-eq`,
  ruleTerrainAscentOneWay: (budget: number) =>
    `Places you can reach while climbing no more than ${budget} m`,
  ruleTerrainAscentRoundTrip: (budget: number) =>
    `Places you can reach and return from while climbing no more than ${budget} m in total`,
  searchValidationError: 'Enter a city, ideally "City, Country".',
  streetGraphLoadFailed: (detail: string) =>
    `Street graph load failed: ${detail}`,
  statusStreetLoading: "Loading street graph… showing terrain reach for now.",
  statusStreetNoStart:
    "No routable street found near the start. Showing terrain reach.",
  statusStreetRadiusOnly:
    "Street graph beta uses Radius scope for now. Showing terrain reach.",
  statusStreetUnavailable:
    "Street graph unavailable here. Showing terrain reach.",
};

const CZECH_MESSAGES: CopyCatalog = {
  staticText: {
    advancedButton: "Pokročilé",
    appearanceDarkMode: "Tmavý režim",
    appearanceLightMode: "Světlý režim",
    appearancePickerLabel: "Vzhled",
    appearanceSystemMode: "Systémový režim",
    citySearchLabel: "Hledání města",
    citySearchPlaceholder: "Zkuste třeba Lisabon, Portugalsko",
    collapse: "Sbalit",
    initialClickHint: "Kliknutím do mapy přesunete start",
    initialModelNote:
      "Výchozí pohled: poloměr oblasti plus limit stoupání tam i zpět. Jen terén. Zatím bez uliční sítě a bez penalizace vzdálenosti.",
    initialPopulationUnavailable: "Odhad počtu obyvatel není k dispozici.",
    initialRuleSummary: "Načítání terénu…",
    initialStatus: "Načítání výchozího města…",
    languagePickerLabel: "Jazyk",
    legendReachableArea: "dosažitelná oblast",
    mapAriaLabel: "Mapa nadmořské výšky města",
    maxDropLabel: "Max. pokles pod start",
    maxRiseLabel: "Max. stoupání nad start",
    populationLabel: "Odhad obyvatel",
    populationTooltipFallback: "Detaily odhadu obyvatel",
    populationTooltipLabel: "Detaily odhadu obyvatel",
    routeModelLegend: "Model trasy",
    routeModelStreet: "Pouliční graf beta",
    routeModelTerrain: "Výšková mřížka",
    searchAreaCity: "Hranice města",
    searchAreaLegend: "Oblast hledání",
    searchAreaRadius: "Poloměr",
    searchButton: "Hledat",
    startElevationLabel: "Výchozí nadmořská výška",
    terrainLensAscent: "Rozpočet stoupání",
    terrainLensBand: "Rovinné pásmo",
    terrainLensCeiling: "Výškový strop",
    terrainLensLegend: "Pohled na terén",
    tripRadiusLabel: "Poloměr oblasti",
    uphillLimitOneWay: "Limit stoupání jedním směrem",
    uphillLimitRoundTrip: "Limit stoupání tam i zpět",
    ascentScopeLegend: "Limit stoupání platí pro",
    ascentScopeOneWay: "Jedna cesta",
    ascentScopeRoundTrip: "Tam i zpět",
  },
  locale: "cs-CZ",
  advancedHide: "Skrýt pokročilé",
  boundaryDataMissing: (label: string) => `Pro ${label} chybí data hranice.`,
  boundaryRadiusHintCity: (cityLabel: string) =>
    `Režim města hledá uvnitř hranic ${cityLabel}.`,
  boundaryRadiusHintRadius:
    "Režim poloměru používá přímou vzdálenost od startu. Kliknutím kamkoli přesunete oblast jízdy.",
  boundaryResponseMalformed: (label: string) =>
    `Odpověď hranice pro ${label} má neplatný formát.`,
  boundarySearchFailed: (status: string) =>
    `Vyhledání hranice selhalo: ${status}`,
  budgetHintInactive: "Používá se jen v režimu rozpočtu stoupání.",
  budgetHintStreetCity:
    "Pouliční beta zatím funguje v režimu Poloměr. Režim města padá zpět na terénní dosah.",
  budgetHintStreetRadius:
    "Pouliční beta započítává vzdálenost, stoupání a prudké rampy do metrů-ekvivalentu stoupání. Jen OSM.",
  budgetHintTerrainOneWay:
    "Počítá nastoupané metry jen jedním směrem. Vzdálenost se nezapočítává, takže rovné okliky jsou prakticky zdarma.",
  budgetHintTerrainRoundTrip:
    "Počítá nastoupané metry tam i zpět. Vzdálenost se zatím nezapočítává.",
  budgetLabelInactive: "Rozpočet stoupání",
  budgetLabelStreetOneWay: "Limit námahy jedním směrem",
  budgetLabelStreetRoundTrip: "Limit námahy tam i zpět",
  budgetLabelTerrainOneWay: "Limit stoupání jedním směrem",
  budgetLabelTerrainRoundTrip: "Limit stoupání tam i zpět",
  bundledBoundaryLoadFailed: (status: string) =>
    `Načtení přibalené hranice selhalo: ${status}`,
  caveatCeiling:
    "Krátká opakovaná stoupání se mohou nasčítat do velkého převýšení.",
  caveatStreet: (snappedDistanceMeters: number | null) =>
    `Jen OSM ulice. Započítává vzdálenost, stoupání a prudké rampy, ale ne provoz, povrch ani stres na křižovatkách.${snappedDistanceMeters && snappedDistanceMeters > 35 ? ` Start byl posunut o ${Math.round(snappedDistanceMeters)} m k nejbližší průjezdné ulici.` : ""}`,
  caveatTerrainOneWay:
    "Jen podle terénu, bez započtení skutečných ulic a tras.",
  caveatTerrainRoundTrip:
    "Jen podle terénu, bez započtení skutečných ulic a tras.",
  clickHintCity: "Kliknutím do mapy přesunete start",
  clickHintRadius: "Kliknutím do mapy přesunete start i hranici",
  compactPopulation: (value: string) => `Obyv. ≈${value}`,
  compactPopulationLoading: "Obyv. …",
  compactPopulationUnavailable: "Obyv. —",
  compactReach: (value: string) => `Dosah ${value}`,
  documentTitle: (label: string) => `ElevReach: ${label}`,
  enterCityName: "Zadejte název města, ideálně „Město, Země“.",
  failedToLoadCityTerrain: "Nepodařilo se načíst terén města.",
  invalidAnchor: (label: string) =>
    `Uvnitř ${label} se nepodařilo najít platný výchozí bod.`,
  loadingCity: (query: string) => `Načítání ${query}…`,
  loadingDefaultCityBoundary: "Načítání hranice výchozího města…",
  loadingElevation: (label: string) => `Načítání nadmořské výšky pro ${label}…`,
  loadingElevationTiles: (label: string, loaded: number, total: number) =>
    `Načítání výškových dlaždic pro ${label}… ${loaded}/${total}`,
  loadingPraguePopulation: "Načítání odhadu počtu obyvatel pro Prahu…",
  loadingSearchButton: "Načítání…",
  modelNoteInactive: "Jen pro režimy s rozpočtem stoupání.",
  modelNoteStreet:
    "Beta pouličního grafu používá sjízdné OSM ulice uvnitř aktuálního poloměru oblasti. Cena mísí vzdálenost, stoupání a prudké rampy.",
  modelNoteTerrain:
    "Režim výškové mřížky používá jen DEM trasy s nejmenším stoupáním. Zatím bez uliční sítě a bez penalizace vzdálenosti.",
  noCityBoundaryFound: (query: string) =>
    `Hranice města pro „${query}“ nenalezena. Zkuste „Město, Země“.`,
  populationEstimateUnavailable:
    "Odhad počtu obyvatel není pro toto město nebo hranici k dispozici.",
  populationTooltipStreet: (sourceName: string, method: string) =>
    `Odhad jen pro Prahu nad bufferovanými buňkami dosažitelných ulic. Zdroj: ${sourceName}. ${method}`,
  populationTooltipTerrain: (sourceName: string, method: string) =>
    `Odhad jen pro Prahu. Zdroj: ${sourceName}. ${method}`,
  ready: "Připraveno",
  ruleBand: (
    sourceElevation: string,
    lowerAllowance: number,
    upperAllowance: number,
  ) =>
    `Oblasti mezi ${sourceElevation} m - ${lowerAllowance} m a + ${upperAllowance} m`,
  ruleCeiling: (sourceElevation: string, upperAllowance: number) =>
    `Oblasti v ${sourceElevation} m + ${upperAllowance} m nebo níž`,
  ruleScopeAcrossCity: (cityLabel: string) => `napříč ${cityLabel}`,
  ruleScopeAcrossRadius: (radius: string) =>
    `v rámci přímého poloměru ${radius}`,
  ruleScopeConnected: "spojenou se startem",
  ruleScopeConnectedRadius: (radius: string) =>
    `spojenou se startem v rámci přímého poloměru ${radius}`,
  ruleScopeFromStart: "od startu",
  ruleScopeFromStartRadius: (radius: string) =>
    `v přímém poloměru ${radius} od startu`,
  ruleSummary: (baseRule: string, scope: string, caveat: string) =>
    `${baseRule}. Zobrazuji oblast ${scope}.${caveat ? ` ${caveat}` : ""}`,
  ruleStreetAscentOneWay: (budget: number) =>
    `Pouliční síť, jejíž cesta jedním směrem zůstává do ${budget} m-ekv`,
  ruleStreetAscentRoundTrip: (budget: number) =>
    `Pouliční síť, jejíž cesta tam i zpět zůstává do ${budget} m-ekv`,
  ruleTerrainAscentOneWay: (budget: number) =>
    `Místa, kam se dostanete se stoupáním nejvýš ${budget} m`,
  ruleTerrainAscentRoundTrip: (budget: number) =>
    `Místa, kam se dostanete a zpět s celkovým stoupáním nejvýš ${budget} m`,
  searchValidationError: "Zadejte město, ideálně „Město, Země“.",
  streetGraphLoadFailed: (detail: string) =>
    `Načtení pouličního grafu selhalo: ${detail}`,
  statusStreetLoading: "Načítám pouliční graf… zatím zobrazuji terénní dosah.",
  statusStreetNoStart:
    "Poblíž startu nebyla nalezena sjízdná ulice. Zobrazuji terénní dosah.",
  statusStreetRadiusOnly:
    "Beta pouličního grafu zatím funguje jen v režimu Poloměr. Zobrazuji terénní dosah.",
  statusStreetUnavailable:
    "Pouliční graf tu není dostupný. Zobrazuji terénní dosah.",
};

const MESSAGES = {
  en: ENGLISH_MESSAGES,
  cs: CZECH_MESSAGES,
} as const;

type StaticTextKey = keyof StaticTextCatalog;

export function detectLanguageFromLocale(): AppLanguage {
  const locales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  return locales.some((locale) => locale.toLowerCase().startsWith("cs"))
    ? "cs"
    : "en";
}

export function getStoredLanguage(): AppLanguage {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === "en" || raw === "cs") {
      return raw;
    }
  } catch {
    // Ignore storage/privacy failures.
  }

  return detectLanguageFromLocale();
}

export function storeLanguage(language: AppLanguage) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage/privacy failures.
  }
}

export function getCopy(language: AppLanguage) {
  return MESSAGES[language];
}

export function localeForLanguage(language: AppLanguage) {
  return getCopy(language).locale;
}

export function applyStaticCopy(root: ParentNode, language: AppLanguage) {
  const copy = getCopy(language);

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n as StaticTextKey | undefined;

    if (!key) {
      return;
    }

    node.textContent = copy.staticText[key];
  });

  root
    .querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")
    .forEach((node) => {
      const key = node.dataset.i18nPlaceholder as StaticTextKey | undefined;

      if (!key) {
        return;
      }

      node.placeholder = copy.staticText[key];
    });

  root
    .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
    .forEach((node) => {
      const key = node.dataset.i18nAriaLabel as StaticTextKey | undefined;

      if (!key) {
        return;
      }

      node.setAttribute("aria-label", copy.staticText[key]);
    });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((node) => {
    const key = node.dataset.i18nTitle as StaticTextKey | undefined;

    if (!key) {
      return;
    }

    node.setAttribute("title", copy.staticText[key]);
  });
}

export function localizeErrorMessage(error: unknown, language: AppLanguage) {
  const copy = getCopy(language);

  if (!(error instanceof Error)) {
    return copy.failedToLoadCityTerrain;
  }

  if (error.message === ENGLISH_MESSAGES.enterCityName) {
    return copy.enterCityName;
  }

  if (error.message === ENGLISH_MESSAGES.failedToLoadCityTerrain) {
    return copy.failedToLoadCityTerrain;
  }

  let match = error.message.match(/^Bundled boundary load failed: (\d+)$/);

  if (match) {
    return copy.bundledBoundaryLoadFailed(match[1]);
  }

  match = error.message.match(/^Boundary search failed: (\d+)$/);

  if (match) {
    return copy.boundarySearchFailed(match[1]);
  }

  match = error.message.match(
    /^No city boundary found for "(.+)". Try "City, Country"\.$/,
  );

  if (match) {
    return copy.noCityBoundaryFound(match[1]);
  }

  match = error.message.match(/^Boundary data missing for (.+)\.$/);

  if (match) {
    return copy.boundaryDataMissing(match[1]);
  }

  match = error.message.match(/^Boundary response malformed for (.+)\.$/);

  if (match) {
    return copy.boundaryResponseMalformed(match[1]);
  }

  match = error.message.match(
    /^Could not find a valid anchor point inside (.+)\.$/,
  );

  if (match) {
    return copy.invalidAnchor(match[1]);
  }

  match = error.message.match(/^Street graph load failed: (.+)$/);

  if (match) {
    return copy.streetGraphLoadFailed(match[1]);
  }

  return error.message;
}
