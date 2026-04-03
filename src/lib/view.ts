import type { AnalysisResult } from './analysis';
import type { AppNodes } from './app-shell';
import type { BoundaryGeoJson } from './boundary';
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
  state: {
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
) {
  const sourcePoint = cellLatLng(dataset, sourceIndex);
  const sourceElevation = elevationAtIndex(dataset, sourceIndex);
  const share =
    analysis.insideAreaKm2 === 0
      ? 0
      : analysis.matchedAreaKm2 / analysis.insideAreaKm2;

  nodes.elevationStat.textContent = `${sourceElevation.toFixed(0)} m`;
  nodes.shareStat.textContent = `${(share * 100).toFixed(1)}%`;
  nodes.areaStat.textContent = `${analysis.matchedAreaKm2.toFixed(1)} km²`;
  nodes.coordsStat.textContent = `${sourcePoint.lat.toFixed(4)}, ${sourcePoint.lng.toFixed(4)}`;

  const baseRule =
    state.mode === 'ceiling'
      ? `Areas at ${sourceElevation.toFixed(0)} m + ${state.upperAllowance} m or lower`
      : state.mode === 'ascent'
        ? state.ascentRoundTrip
          ? `Areas where the round trip on the flattest paths has ≤ ${state.ascentBudget} m total climbing`
          : `Areas reachable on the flattest path with ≤ ${state.ascentBudget} m total climbing`
        : `Areas between ${sourceElevation.toFixed(0)} m - ${state.lowerAllowance} m and + ${state.upperAllowance} m`;
  const scope =
    state.mode === 'ascent'
      ? state.boundaryScope === 'radius'
        ? `from the start point within a ${formatRadius(state.boundaryRadiusKm)} radius`
        : 'from the start point'
      : state.contiguousOnly
        ? state.boundaryScope === 'radius'
          ? `connected to the start point within a ${formatRadius(state.boundaryRadiusKm)} radius`
          : 'connected to the start point'
        : state.boundaryScope === 'radius'
          ? `across the ${formatRadius(state.boundaryRadiusKm)} radius`
          : `across ${state.cityLabel}`;
  const caveat =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Terrain path only. Real roads will add more climbing.'
        : 'Terrain path only. Real roads will add more climbing.'
      : state.mode === 'ceiling'
        ? 'Repeated short hills may add up to a lot of climbing.'
        : '';

  nodes.ruleSummary.textContent = `${baseRule}. Showing area ${scope}.${caveat ? ` ${caveat}` : ''}`;
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

export function setLoadingState(nodes: AppNodes, isLoading: boolean) {
  nodes.searchButton.disabled = isLoading;
  nodes.searchInput.disabled = isLoading;
  nodes.searchButton.textContent = isLoading ? 'Loading…' : 'Load city';
}

export function setStatusView(nodes: AppNodes, message: string, isError = false) {
  nodes.statusNode.textContent = message;
  nodes.statusNode.classList.toggle('is-loading', !isError && message !== 'Ready');
  nodes.statusNode.classList.toggle('is-error', isError);
}

function isPrague(cityQuery: string, cityLabel: string) {
  return /(^|,|\s)(prague|praha)(,|\s|$)/i.test(cityQuery) ||
    /(^|,|\s)(prague|praha)(,|\s|$)/i.test(cityLabel);
}

function formatRadius(radiusKm: number) {
  return Number.isInteger(radiusKm) ? `${radiusKm} km` : `${radiusKm.toFixed(1)} km`;
}
