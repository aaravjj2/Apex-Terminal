import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PnFMark = 'X' | 'O';

export interface PnFColumn {
  type: PnFMark;
  startPrice: number;
  endPrice: number;
  boxes: number;
  startTime: number;
  endTime: number;
  columnIndex: number;
  volume: number;
}

export interface PnFConfig {
  boxSize: number;
  reversal: number;
  boxSizeMode: 'fixed' | 'atr' | 'percentage';
  atrPeriod: number;
  percentageSize: number;
  method: 'close' | 'high-low';
}

export interface PnFPattern {
  type: PnFPatternType;
  direction: 'bullish' | 'bearish';
  columnIndex: number;
  targetPrice: number | null;
  confidence: number;
}

export type PnFPatternType =
  | 'double_top'
  | 'double_bottom'
  | 'triple_top'
  | 'triple_bottom'
  | 'catapult_bull'
  | 'catapult_bear'
  | 'ascending_triple_top'
  | 'descending_triple_bottom';

export interface PnFTrendLine {
  startColumnIndex: number;
  startPrice: number;
  direction: 'bullish' | 'bearish';
  boxSize: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_PNF_CONFIG: PnFConfig = {
  boxSize: 1.0,
  reversal: 3,
  boxSizeMode: 'fixed',
  atrPeriod: 14,
  percentageSize: 1.0,
  method: 'close',
};

// ─── Box Size Helpers ───────────────────────────────────────────────────────

function computeATR(bars: OHLCVBar[], period: number): number {
  if (bars.length < 2) return 0;
  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trValues.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    ));
  }
  if (!trValues.length) return 0;
  const n = Math.min(period, trValues.length);
  let atr = 0;
  for (let i = 0; i < n; i++) atr += trValues[i];
  atr /= n;
  for (let i = n; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

function resolveBoxSize(bars: OHLCVBar[], cfg: PnFConfig): number {
  switch (cfg.boxSizeMode) {
    case 'atr': return computeATR(bars, cfg.atrPeriod);
    case 'percentage': {
      if (!bars.length) return cfg.boxSize;
      const avgPrice = bars.reduce((s, b) => s + b.close, 0) / bars.length;
      return avgPrice * (cfg.percentageSize / 100);
    }
    default: return cfg.boxSize;
  }
}

function roundToBox(price: number, boxSize: number): number {
  return Math.round(price / boxSize) * boxSize;
}

// ─── Column Generation ──────────────────────────────────────────────────────

export function generatePnFColumns(
  bars: OHLCVBar[],
  config: Partial<PnFConfig> = {},
): PnFColumn[] {
  const cfg = { ...DEFAULT_PNF_CONFIG, ...config };
  if (bars.length < 2) return [];

  const boxSize = resolveBoxSize(bars, cfg);
  if (boxSize <= 0) return [];

  const reversalSize = boxSize * cfg.reversal;
  const columns: PnFColumn[] = [];

  let currentType: PnFMark | null = null;
  let colStart = roundToBox(bars[0].close, boxSize);
  let colEnd = colStart;
  let colStartTime = bars[0].time;
  let colEndTime = bars[0].time;
  let colVolume = bars[0].volume;

  const pushColumn = () => {
    if (currentType) {
      columns.push({
        type: currentType,
        startPrice: colStart,
        endPrice: colEnd,
        boxes: Math.round(Math.abs(colEnd - colStart) / boxSize),
        startTime: colStartTime,
        endTime: colEndTime,
        columnIndex: columns.length,
        volume: colVolume,
      });
    }
  };

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const high = cfg.method === 'close' ? bar.close : bar.high;
    const low = cfg.method === 'close' ? bar.close : bar.low;

    if (currentType === null) {
      const upMove = roundToBox(high, boxSize) - colStart;
      const downMove = colStart - roundToBox(low, boxSize);
      if (upMove >= boxSize) {
        currentType = 'X';
        colEnd = roundToBox(high, boxSize);
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else if (downMove >= boxSize) {
        currentType = 'O';
        colEnd = roundToBox(low, boxSize);
        colEndTime = bar.time;
        colVolume += bar.volume;
      }
      continue;
    }

    if (currentType === 'X') {
      const newHigh = roundToBox(high, boxSize);
      if (newHigh > colEnd) {
        colEnd = newHigh;
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else {
        const reversal = colEnd - roundToBox(low, boxSize);
        if (reversal >= reversalSize) {
          pushColumn();
          currentType = 'O';
          colStart = colEnd - boxSize;
          colEnd = roundToBox(low, boxSize);
          colStartTime = bar.time;
          colEndTime = bar.time;
          colVolume = bar.volume;
        }
      }
    } else {
      const newLow = roundToBox(low, boxSize);
      if (newLow < colEnd) {
        colEnd = newLow;
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else {
        const reversal = roundToBox(high, boxSize) - colEnd;
        if (reversal >= reversalSize) {
          pushColumn();
          currentType = 'X';
          colStart = colEnd + boxSize;
          colEnd = roundToBox(high, boxSize);
          colStartTime = bar.time;
          colEndTime = bar.time;
          colVolume = bar.volume;
        }
      }
    }
  }

  pushColumn();
  return columns;
}

// ─── Pattern Recognition ────────────────────────────────────────────────────

export function detectPatterns(columns: PnFColumn[], boxSize: number): PnFPattern[] {
  const patterns: PnFPattern[] = [];
  if (columns.length < 3) return patterns;

  for (let i = 2; i < columns.length; i++) {
    const c0 = columns[i - 2];
    const c1 = columns[i - 1];
    const c2 = columns[i];

    if (c2.type === 'X' && c0.type === 'X' && c2.endPrice > c0.endPrice && c1.endPrice >= c0.startPrice) {
      patterns.push({
        type: 'double_top',
        direction: 'bullish',
        columnIndex: i,
        targetPrice: c2.endPrice + Math.abs(c0.endPrice - c1.endPrice),
        confidence: 0.7,
      });
    }

    if (c2.type === 'O' && c0.type === 'O' && c2.endPrice < c0.endPrice && c1.endPrice <= c0.startPrice) {
      patterns.push({
        type: 'double_bottom',
        direction: 'bearish',
        columnIndex: i,
        targetPrice: c2.endPrice - Math.abs(c1.endPrice - c0.endPrice),
        confidence: 0.7,
      });
    }
  }

  for (let i = 4; i < columns.length; i++) {
    const c0 = columns[i - 4];
    const c2 = columns[i - 2];
    const c4 = columns[i];

    if (c0.type === 'X' && c2.type === 'X' && c4.type === 'X' && c4.endPrice > c2.endPrice && c2.endPrice > c0.endPrice) {
      patterns.push({
        type: 'triple_top',
        direction: 'bullish',
        columnIndex: i,
        targetPrice: c4.endPrice + (c4.endPrice - columns[i - 3].endPrice),
        confidence: 0.85,
      });
    }

    if (c0.type === 'O' && c2.type === 'O' && c4.type === 'O' && c4.endPrice < c2.endPrice && c2.endPrice < c0.endPrice) {
      patterns.push({
        type: 'triple_bottom',
        direction: 'bearish',
        columnIndex: i,
        targetPrice: c4.endPrice - (columns[i - 3].endPrice - c4.endPrice),
        confidence: 0.85,
      });
    }

    if (c4.type === 'X' && c4.endPrice > c2.endPrice && c2.endPrice <= c0.endPrice) {
      patterns.push({
        type: 'catapult_bull',
        direction: 'bullish',
        columnIndex: i,
        targetPrice: c4.endPrice + Math.abs(c4.endPrice - c2.endPrice),
        confidence: 0.8,
      });
    }

    if (c4.type === 'O' && c4.endPrice < c2.endPrice && c2.endPrice >= c0.endPrice) {
      patterns.push({
        type: 'catapult_bear',
        direction: 'bearish',
        columnIndex: i,
        targetPrice: c4.endPrice - Math.abs(c2.endPrice - c4.endPrice),
        confidence: 0.8,
      });
    }
  }

  return patterns;
}

// ─── Price Targets ──────────────────────────────────────────────────────────

export function verticalCount(
  column: PnFColumn,
  boxSize: number,
  reversal: number,
): number {
  return column.endPrice + column.boxes * boxSize * reversal * (column.type === 'X' ? 1 : -1);
}

export function horizontalCount(
  columns: PnFColumn[],
  startIdx: number,
  endIdx: number,
  boxSize: number,
  reversal: number,
): number {
  const span = endIdx - startIdx + 1;
  const baseCol = columns[startIdx];
  const direction = baseCol.type === 'X' ? 1 : -1;
  return baseCol.endPrice + span * boxSize * reversal * direction;
}

// ─── Trend Lines ────────────────────────────────────────────────────────────

export function computeTrendLines(columns: PnFColumn[], boxSize: number): PnFTrendLine[] {
  const lines: PnFTrendLine[] = [];
  if (columns.length < 2) return lines;

  let lowest = Infinity;
  let lowestIdx = 0;
  let highest = -Infinity;
  let highestIdx = 0;

  for (let i = 0; i < columns.length; i++) {
    const low = Math.min(columns[i].startPrice, columns[i].endPrice);
    const high = Math.max(columns[i].startPrice, columns[i].endPrice);
    if (low < lowest) { lowest = low; lowestIdx = i; }
    if (high > highest) { highest = high; highestIdx = i; }
  }

  lines.push({
    startColumnIndex: lowestIdx,
    startPrice: lowest,
    direction: 'bullish',
    boxSize,
  });

  lines.push({
    startColumnIndex: highestIdx,
    startPrice: highest,
    direction: 'bearish',
    boxSize,
  });

  return lines;
}

// ─── Bullish / Bearish Percent ──────────────────────────────────────────────

export function bullishPercent(columns: PnFColumn[]): { bullish: number; bearish: number; percent: number } {
  if (!columns.length) return { bullish: 0, bearish: 0, percent: 50 };

  let bullish = 0;
  let bearish = 0;
  for (const col of columns) {
    if (col.type === 'X') bullish++;
    else bearish++;
  }

  return {
    bullish,
    bearish,
    percent: (bullish / columns.length) * 100,
  };
}

export function recentBullishPercent(columns: PnFColumn[], lookback: number): number {
  const slice = columns.slice(-lookback);
  const xCount = slice.filter(c => c.type === 'X').length;
  return slice.length > 0 ? (xCount / slice.length) * 100 : 50;
}
