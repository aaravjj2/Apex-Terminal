import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EquivolumeBox {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  width: number;
  normalizedWidth: number;
  isPowerBar: boolean;
  easeOfMovement: number;
  barIndex: number;
}

export interface EquivolumeConfig {
  volumeScale: 'linear' | 'sqrt' | 'log';
  powerBarThreshold: number;
  maxWidthMultiple: number;
}

export interface PowerBarInfo {
  index: number;
  time: number;
  direction: 'up' | 'down';
  volume: number;
  priceChange: number;
  easeOfMovement: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_EQUIVOLUME_CONFIG: EquivolumeConfig = {
  volumeScale: 'sqrt',
  powerBarThreshold: 2.0,
  maxWidthMultiple: 5.0,
};

// ─── Volume Width Calculation ───────────────────────────────────────────────

function scaleVolume(volume: number, scale: 'linear' | 'sqrt' | 'log'): number {
  switch (scale) {
    case 'sqrt': return Math.sqrt(volume);
    case 'log': return volume > 0 ? Math.log(volume + 1) : 0;
    default: return volume;
  }
}

// ─── Equivolume Box Generation ──────────────────────────────────────────────

export function generateEquivolumeBoxes(
  bars: OHLCVBar[],
  config: Partial<EquivolumeConfig> = {},
): EquivolumeBox[] {
  const cfg = { ...DEFAULT_EQUIVOLUME_CONFIG, ...config };
  if (!bars.length) return [];

  const scaledVolumes = bars.map(b => scaleVolume(b.volume, cfg.volumeScale));
  const avgScaledVol = scaledVolumes.reduce((s, v) => s + v, 0) / scaledVolumes.length;
  const maxAllowed = avgScaledVol * cfg.maxWidthMultiple;

  const avgVolume = bars.reduce((s, b) => s + b.volume, 0) / bars.length;
  const boxes: EquivolumeBox[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const rawWidth = scaledVolumes[i];
    const clampedWidth = Math.min(rawWidth, maxAllowed);
    const normalizedWidth = avgScaledVol > 0 ? clampedWidth / avgScaledVol : 1;

    const priceRange = bar.high - bar.low;
    const emv = priceRange > 0 ? ((bar.close - bar.open) / priceRange) * (bar.volume / avgVolume) : 0;
    const isPowerBar = bar.volume > avgVolume * cfg.powerBarThreshold && Math.abs(bar.close - bar.open) > priceRange * 0.5;

    boxes.push({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      direction: bar.close >= bar.open ? 'up' : 'down',
      width: clampedWidth,
      normalizedWidth,
      isPowerBar,
      easeOfMovement: emv,
      barIndex: i,
    });
  }

  return boxes;
}

// ─── Ease of Movement (EMV) ─────────────────────────────────────────────────

export function easeOfMovement(bars: OHLCVBar[], period: number = 14): number[] {
  if (bars.length < 2) return new Array(bars.length).fill(NaN);

  const emv = new Array<number>(bars.length).fill(NaN);

  for (let i = 1; i < bars.length; i++) {
    const distanceMoved = ((bars[i].high + bars[i].low) / 2) - ((bars[i - 1].high + bars[i - 1].low) / 2);
    const boxRatio = (bars[i].high - bars[i].low) !== 0
      ? bars[i].volume / (bars[i].high - bars[i].low)
      : 0;
    emv[i] = boxRatio !== 0 ? distanceMoved / boxRatio : 0;
  }

  if (period <= 1) return emv;

  const smoothed = new Array<number>(bars.length).fill(NaN);
  let sum = 0;
  let count = 0;

  for (let i = 1; i < bars.length; i++) {
    if (!isNaN(emv[i])) {
      sum += emv[i];
      count++;
    }
    if (i > period) {
      if (!isNaN(emv[i - period])) {
        sum -= emv[i - period];
        count--;
      }
    }
    if (count >= period) {
      smoothed[i] = sum / count;
    }
  }

  return smoothed;
}

// ─── Power Bars Identification ──────────────────────────────────────────────

export function findPowerBars(boxes: EquivolumeBox[]): PowerBarInfo[] {
  return boxes
    .filter(b => b.isPowerBar)
    .map(b => ({
      index: b.barIndex,
      time: b.time,
      direction: b.direction,
      volume: b.volume,
      priceChange: b.close - b.open,
      easeOfMovement: b.easeOfMovement,
    }));
}

export function powerBarRatio(boxes: EquivolumeBox[]): {
  total: number;
  powerBars: number;
  ratio: number;
  upPower: number;
  downPower: number;
} {
  const power = boxes.filter(b => b.isPowerBar);
  return {
    total: boxes.length,
    powerBars: power.length,
    ratio: boxes.length > 0 ? power.length / boxes.length : 0,
    upPower: power.filter(b => b.direction === 'up').length,
    downPower: power.filter(b => b.direction === 'down').length,
  };
}

// ─── Volume Analysis Integration ────────────────────────────────────────────

export function volumeWeightedPrice(boxes: EquivolumeBox[]): number {
  if (!boxes.length) return 0;
  let sumPV = 0;
  let sumV = 0;
  for (const box of boxes) {
    sumPV += ((box.high + box.low + box.close) / 3) * box.volume;
    sumV += box.volume;
  }
  return sumV > 0 ? sumPV / sumV : 0;
}

export function volumeDirectionBias(boxes: EquivolumeBox[]): number {
  let upVol = 0;
  let downVol = 0;
  for (const box of boxes) {
    if (box.direction === 'up') upVol += box.volume;
    else downVol += box.volume;
  }
  const total = upVol + downVol;
  return total > 0 ? (upVol - downVol) / total : 0;
}

export function cumulativeEMV(boxes: EquivolumeBox[]): number[] {
  const cumulative = new Array<number>(boxes.length).fill(0);
  if (!boxes.length) return cumulative;

  cumulative[0] = boxes[0].easeOfMovement;
  for (let i = 1; i < boxes.length; i++) {
    cumulative[i] = cumulative[i - 1] + boxes[i].easeOfMovement;
  }
  return cumulative;
}

// ─── Width Statistics ───────────────────────────────────────────────────────

export function widthStatistics(boxes: EquivolumeBox[]): {
  avgWidth: number;
  minWidth: number;
  maxWidth: number;
  stdDevWidth: number;
  widestBar: EquivolumeBox | null;
  narrowestBar: EquivolumeBox | null;
} {
  if (!boxes.length) return { avgWidth: 0, minWidth: 0, maxWidth: 0, stdDevWidth: 0, widestBar: null, narrowestBar: null };

  const widths = boxes.map(b => b.normalizedWidth);
  const avg = widths.reduce((s, v) => s + v, 0) / widths.length;
  const sorted = [...widths].sort((a, b) => a - b);
  const variance = widths.reduce((s, v) => s + (v - avg) ** 2, 0) / widths.length;

  let widestIdx = 0;
  let narrowestIdx = 0;
  for (let i = 1; i < boxes.length; i++) {
    if (boxes[i].normalizedWidth > boxes[widestIdx].normalizedWidth) widestIdx = i;
    if (boxes[i].normalizedWidth < boxes[narrowestIdx].normalizedWidth) narrowestIdx = i;
  }

  return {
    avgWidth: avg,
    minWidth: sorted[0],
    maxWidth: sorted[sorted.length - 1],
    stdDevWidth: Math.sqrt(variance),
    widestBar: boxes[widestIdx],
    narrowestBar: boxes[narrowestIdx],
  };
}
