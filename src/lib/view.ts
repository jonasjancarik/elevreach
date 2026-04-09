import type { AnalysisResult } from './analysis';
import type { AppNodes } from './app-shell';
import type { BoundaryGeoJson } from './boundary';
import { getCopy, localeForLanguage, type AppLanguage } from './i18n';
import type { PopulationDataset, PopulationSummary } from './population';
import { cellLatLng, elevationAtIndex, findNearestInsideIndex, indexFromLatLng, type TerrainDataset } from './terrain';

const PRAGUE_DEFAULT_ANCHOR = {
  lat: 50.0719419,
  lng: 14.4040297,
};

export function updateStatsView(
  nodes: AppNodes,
  dataset: TerrainDataset,
  sourceIndex: number,
  analysis: AnalysisResult,
  population: {
    dataset: PopulationDataset;
    summary: PopulationSummary;
  } | null,
  populationStatus: 'loading' | 'ready' | 'unavailable',
  state: {
    ascentModel: 'terrain' | 'street';
    boundaryRadiusKm: number;
    boundaryScope: 'city' | 'radius';
    cityLabel: string;
    mode: 'band' | 'ceiling' | 'ascent';
    upperAllowance: number;
    lowerAllowance: number;
    ascentBudget: number;
    ascentRoundTrip: boolean;
    contiguousOnly: boolean;
  },
  language: AppLanguage,
) {
  const copy = getCopy(language);
  const locale = localeForLanguage(language);
  const sourcePoint = cellLatLng(dataset, sourceIndex);
  const sourceElevation = elevationAtIndex(dataset, sourceIndex);
  const isPragueCity = isPrague(state.cityLabel, state.cityLabel);
  const share =
    analysis.insideAreaKm2 === 0
      ? 0
      : analysis.matchedAreaKm2 / analysis.insideAreaKm2;
  const areaValue = analysis.street
    ? formatStreetLength(analysis.street.reachableRoadKm, locale)
    : `${formatFixedNumber(analysis.matchedAreaKm2, locale, 1)} km²`;

  nodes.elevationStat.textContent = `${formatWholeNumber(sourceElevation, locale)} m`;
  nodes.areaLabel.textContent = analysis.street
    ? language === 'cs'
      ? 'Dosažitelné ulice'
      : 'Reachable streets'
    : language === 'cs'
      ? 'Dosažitelná oblast'
      : 'Reachable area';
  nodes.shareStat.textContent = `${formatFixedNumber(share * 100, locale, 1)}%`;
  nodes.areaStat.textContent = areaValue;
  nodes.coordsStat.textContent =
    `${formatFixedNumber(sourcePoint.lat, locale, 4)}, ${formatFixedNumber(sourcePoint.lng, locale, 4)}`;
  nodes.populationStat.textContent =
    populationStatus === 'loading'
      ? '…'
      : population
        ? `≈ ${formatPopulation(population.summary.matchedPopulation, locale)}`
        : '—';
  nodes.populationTooltip.hidden = !population;
  nodes.populationNote.hidden = Boolean(population);
  nodes.populationTooltipPanel.textContent = population
    ? analysis.street
      ? copy.populationTooltipStreet(population.dataset.sourceName, population.dataset.method)
      : copy.populationTooltipTerrain(population.dataset.sourceName, population.dataset.method)
    : '';
  nodes.populationNote.textContent =
    populationStatus === 'loading'
      ? copy.loadingPraguePopulation
      : copy.populationEstimateUnavailable;
  nodes.compactAreaStat.textContent = copy.compactReach(areaValue);
  nodes.compactPopulationStat.hidden = !isPragueCity;
  if (isPragueCity) {
    nodes.compactPopulationStat.textContent =
      populationStatus === 'loading'
        ? copy.compactPopulationLoading
        : population
          ? copy.compactPopulation(formatCompactPopulation(population.summary.matchedPopulation, locale))
          : copy.compactPopulationUnavailable;
  }

  const baseRule =
    state.mode === 'ceiling'
      ? copy.ruleCeiling(formatWholeNumber(sourceElevation, locale), state.upperAllowance)
      : state.mode === 'ascent'
        ? analysis.street
          ? state.ascentRoundTrip
            ? copy.ruleStreetAscentRoundTrip(state.ascentBudget)
            : copy.ruleStreetAscentOneWay(state.ascentBudget)
          : state.ascentRoundTrip
            ? copy.ruleTerrainAscentRoundTrip(state.ascentBudget)
            : copy.ruleTerrainAscentOneWay(state.ascentBudget)
        : copy.ruleBand(formatWholeNumber(sourceElevation, locale), state.lowerAllowance, state.upperAllowance);
  const scope =
    state.mode === 'ascent'
      ? state.boundaryScope === 'radius'
        ? copy.ruleScopeFromStartRadius(formatRadius(state.boundaryRadiusKm, locale))
        : copy.ruleScopeFromStart
      : state.contiguousOnly
        ? state.boundaryScope === 'radius'
          ? copy.ruleScopeConnectedRadius(formatRadius(state.boundaryRadiusKm, locale))
          : copy.ruleScopeConnected
        : state.boundaryScope === 'radius'
          ? copy.ruleScopeAcrossRadius(formatRadius(state.boundaryRadiusKm, locale))
          : copy.ruleScopeAcrossCity(state.cityLabel);
  const caveat =
    state.mode === 'ascent'
      ? analysis.street
        ? copy.caveatStreet(analysis.street.snappedDistanceMeters)
        : state.ascentRoundTrip
          ? copy.caveatTerrainRoundTrip
          : copy.caveatTerrainOneWay
      : state.mode === 'ceiling'
        ? copy.caveatCeiling
        : '';

  nodes.ruleSummary.textContent = copy.ruleSummary(baseRule, scope, caveat);
}

export function pickDefaultAnchor(
  dataset: TerrainDataset,
  boundary: BoundaryGeoJson,
  cityQuery: string,
  cityLabel: string,
) {
  if (isPrague(cityQuery, cityLabel)) {
    return (
      indexFromLatLng(dataset, PRAGUE_DEFAULT_ANCHOR.lng, PRAGUE_DEFAULT_ANCHOR.lat) ??
      findNearestInsideIndex(dataset, dataset.cols / 2, dataset.rows / 2)
    );
  }

  const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return (
    indexFromLatLng(dataset, centerLng, centerLat) ??
    findNearestInsideIndex(dataset, dataset.cols / 2, dataset.rows / 2)
  );
}

export function setLoadingState(nodes: AppNodes, isLoading: boolean, language: AppLanguage) {
  const copy = getCopy(language);
  nodes.searchButton.disabled = isLoading;
  nodes.searchInput.disabled = isLoading;
  nodes.searchButton.textContent = isLoading
    ? copy.loadingSearchButton
    : copy.staticText.searchButton;
}

export function setStatusView(nodes: AppNodes, message: string, isError = false) {
  const readyMessage = nodes.statusNode.dataset.readyMessage ?? 'Ready';
  nodes.statusNode.textContent = message;
  nodes.statusNode.classList.toggle('is-loading', !isError && message !== readyMessage);
  nodes.statusNode.classList.toggle('is-error', isError);
}

function isPrague(cityQuery: string, cityLabel: string) {
  return /(^|,|\s)(prague|praha)(,|\s|$)/i.test(cityQuery) ||
    /(^|,|\s)(prague|praha)(,|\s|$)/i.test(cityLabel);
}

function formatRadius(radiusKm: number, locale: string) {
  return Number.isInteger(radiusKm)
    ? `${formatWholeNumber(radiusKm, locale)} km`
    : `${formatFixedNumber(radiusKm, locale, 1)} km`;
}

function formatPopulation(population: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(population));
}

function formatCompactPopulation(population: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: population >= 1_000_000 ? 1 : 0,
  }).format(Math.round(population));
}

function formatStreetLength(lengthKm: number, locale: string) {
  return lengthKm >= 10
    ? `${formatWholeNumber(lengthKm, locale)} km`
    : `${formatFixedNumber(lengthKm, locale, 1)} km`;
}

function formatWholeNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatFixedNumber(value: number, locale: string, fractionDigits: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
