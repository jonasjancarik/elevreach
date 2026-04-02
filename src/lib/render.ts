import type { AnalysisMode, AnalysisResult } from './analysis';
import type { TerrainDataset } from './terrain';

interface RenderOptions {
  mode: AnalysisMode;
}

const BAND_LOW: [number, number, number] = [26, 84, 118];
const BAND_MID: [number, number, number] = [95, 186, 176];
const BAND_HIGH: [number, number, number] = [248, 192, 69];
const CEILING_NEAR: [number, number, number] = [83, 169, 143];
const CEILING_FAR: [number, number, number] = [17, 76, 75];
const ASCENT_EASY: [number, number, number] = [244, 191, 74];
const ASCENT_HARD: [number, number, number] = [185, 76, 53];

export function renderAnalysisOverlay(
  dataset: TerrainDataset,
  analysis: AnalysisResult,
  options: RenderOptions,
) {
  const canvas = document.createElement('canvas');
  canvas.width = dataset.cols;
  canvas.height = dataset.rows;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas not available for overlay rendering.');
  }

  const image = context.createImageData(dataset.cols, dataset.rows);
  const sourceElevation = analysis.sourceElevation;

  for (let cellIndex = 0; cellIndex < dataset.elevations.length; cellIndex += 1) {
    if (analysis.mask[cellIndex] === 0) {
      continue;
    }

    const elevation = dataset.elevations[cellIndex];
    const offset = cellIndex * 4;
    const [red, green, blue, alpha] = colorForCell(
      options.mode,
      analysis,
      sourceElevation,
      elevation,
      cellIndex,
    );

    image.data[offset] = red;
    image.data[offset + 1] = green;
    image.data[offset + 2] = blue;
    image.data[offset + 3] = alpha;
  }

  context.putImageData(image, 0, 0);
  context.imageSmoothingEnabled = false;

  return canvas.toDataURL('image/png');
}

function colorForCell(
  mode: AnalysisMode,
  analysis: AnalysisResult,
  sourceElevation: number,
  elevation: number,
  cellIndex: number,
) {
  if (mode === 'ceiling') {
    return ceilingColor(sourceElevation, elevation);
  }

  if (mode === 'ascent') {
    return ascentColor(analysis, cellIndex);
  }

  return bandColor(sourceElevation, elevation);
}

function bandColor(sourceElevation: number, elevation: number) {
  const delta = clamp((elevation - sourceElevation + 40) / 80, 0, 1);

  if (delta < 0.5) {
    const t = delta / 0.5;
    const [r, g, b] = mix(BAND_LOW, BAND_MID, t);
    return [r, g, b, 210] as const;
  }

  const t = (delta - 0.5) / 0.5;
  const [r, g, b] = mix(BAND_MID, BAND_HIGH, t);
  return [r, g, b, 220] as const;
}

function ceilingColor(sourceElevation: number, elevation: number) {
  const drop = clamp((sourceElevation - elevation) / 120, 0, 1);
  const [r, g, b] = mix(CEILING_NEAR, CEILING_FAR, drop);
  return [r, g, b, 216] as const;
}

function ascentColor(analysis: AnalysisResult, cellIndex: number) {
  const cost = analysis.costs?.[cellIndex] ?? 0;
  const ratio =
    analysis.maxCost <= 0 ? 0 : clamp(cost / analysis.maxCost, 0, 1);
  const [r, g, b] = mix(ASCENT_EASY, ASCENT_HARD, ratio);
  return [r, g, b, 220] as const;
}

function mix(
  start: [number, number, number],
  end: [number, number, number],
  ratio: number,
) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * ratio),
    Math.round(start[1] + (end[1] - start[1]) * ratio),
    Math.round(start[2] + (end[2] - start[2]) * ratio),
  ] as const;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
