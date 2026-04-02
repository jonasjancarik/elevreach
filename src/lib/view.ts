import type { AnalysisResult } from './analysis';
import type { AppNodes } from './app-shell';
import type { BoundaryGeoJson } from './boundary';
import { cellLatLng, elevationAtIndex, findNearestInsideIndex, indexFromLatLng, type TerrainDataset } from './terrain';

export function updateStatsView(
  nodes: AppNodes,
  dataset: TerrainDataset,
  sourceIndex: number,
  analysis: AnalysisResult,
  state: {
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
        : `across ${state.cityLabel}`;
  const caveat =
    state.mode === 'ascent'
      ? state.ascentRoundTrip
        ? 'Terrain path only; best outbound and return paths can differ, and roads may be worse.'
        : 'Terrain path only; road detours can add more climbing.'
      : state.mode === 'ceiling'
        ? 'Useful as a ceiling, not a promise of an easy ride.'
        : '';

  nodes.ruleSummary.textContent = `${baseRule}. Showing area ${scope}.${caveat ? ` ${caveat}` : ''}`;
}

export function pickDefaultAnchor(dataset: TerrainDataset, boundary: BoundaryGeoJson) {
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
