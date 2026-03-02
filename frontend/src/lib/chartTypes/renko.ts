// ─── Types ──────────────────────────────────────────────────────────────────

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RenkoBrick {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  direction: 'up' | 'down';
  brickIndex: number;
  sourceBarStart: number;
  sourceBarEnd: number;
}

export type BrickSizeMode = 'fixed' | 'atr';

export type RenkoMode = 'traditional' | 'modified';

export interface RenkoConfig {
  brickSize: number;
  mode: RenkoMode;
  brickSizeMode: BrickSizeMode;
  atrPeriod: number;
  showWicks: boolean;
}

export interface RenkoSupportResistance {
  level: number;
  type: 'support' | 'resistance';
  touches: number;
  firstTime: number;
  lastTime: number;
}

export interface RenkoTrend {
  direction: 'up' | 'down' | 'neutral';
  strength: number;
  consecutiveBricks: number;
  startIndex: number;
  endIndex: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_RENKO_CONFIG: RenkoConfig = {
  brickSize: 1.0,
  mode: 'traditional',
  brickSizeMode: 'fixed',
  atrPeriod: 14,
  showWicks: false,
};

// ─── ATR Calculation ────────────────────────────────────────────────────────

function computeATR(bars: OHLCVBar[], period: number): number {
  if (bars.length < 2) return 0;

  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    );
    trValues.push(tr);
  }

  if (trValues.length < period) {
    return trValues.reduce((s, v) => s + v, 0) / trValues.length;
  }

  let atr = 0;
  for (let i = 0; i < period; i++) atr += trValues[i];
  atr /= period;

  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

// ─── Renko Brick Generation ─────────────────────────────────────────────────

export function generateRenkoBricks(
  bars: OHLCVBar[],
  config: Partial<RenkoConfig> = {},
): RenkoBrick[] {
  const cfg = { ...DEFAULT_RENKO_CONFIG, ...config };
  if (!bars.length) return [];

  const brickSize = cfg.brickSizeMode === 'atr'
    ? computeATR(bars, cfg.atrPeriod)
    : cfg.brickSize;

  if (brickSize <= 0) return [];

  return cfg.mode === 'traditional'
    ? buildTraditional(bars, brickSize, cfg.showWicks)
    : buildModified(bars, brickSize, cfg.showWicks);
}

function buildTraditional(
  bars: OHLCVBar[],
  brickSize: number,
  showWicks: boolean,
): RenkoBrick[] {
  const bricks: RenkoBrick[] = [];
  let refPrice = Math.round(bars[0].close / brickSize) * brickSize;
  let accVolume = 0;
  let sourceStart = bars[0].time;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    accVolume += bar.volume;

    const diff = bar.close - refPrice;
    const absDiff = Math.abs(diff);

    if (absDiff >= brickSize) {
      const numBricks = Math.floor(absDiff / brickSize);
      const direction: 'up' | 'down' = diff > 0 ? 'up' : 'down';
      const step = direction === 'up' ? brickSize : -brickSize;
      const volPerBrick = numBricks > 0 ? accVolume / numBricks : accVolume;

      for (let b = 0; b < numBricks; b++) {
        const open = refPrice + (direction === 'up' ? b * step : (b + 1) * step);
        const close = refPrice + (direction === 'up' ? (b + 1) * step : b * step);

        const brick: RenkoBrick = {
          time: bar.time,
          open: direction === 'up' ? open : close,
          close: direction === 'up' ? close : open,
          high: showWicks ? Math.max(open, close, bar.high) : Math.max(open, close),
          low: showWicks ? Math.min(open, close, bar.low) : Math.min(open, close),
          volume: volPerBrick,
          direction,
          brickIndex: bricks.length,
          sourceBarStart: sourceStart,
          sourceBarEnd: bar.time,
        };
        bricks.push(brick);
      }

      refPrice += numBricks * step;
      accVolume = 0;
      sourceStart = bar.time;
    }
  }

  return bricks;
}

function buildModified(
  bars: OHLCVBar[],
  brickSize: number,
  showWicks: boolean,
): RenkoBrick[] {
  const bricks: RenkoBrick[] = [];
  let refPrice = Math.round(bars[0].close / brickSize) * brickSize;
  let accVolume = 0;
  let sourceStart = bars[0].time;
  let lastDirection: 'up' | 'down' | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    accVolume += bar.volume;

    const upDiff = bar.high - refPrice;
    const downDiff = refPrice - bar.low;

    let created = false;

    if (lastDirection !== 'down' && upDiff >= brickSize) {
      const numBricks = Math.floor(upDiff / brickSize);
      const volPerBrick = numBricks > 0 ? accVolume / numBricks : accVolume;

      for (let b = 0; b < numBricks; b++) {
        const open = refPrice + b * brickSize;
        const close = open + brickSize;
        bricks.push({
          time: bar.time,
          open,
          close,
          high: showWicks && b === numBricks - 1 ? Math.max(close, bar.high) : close,
          low: showWicks && b === 0 ? Math.min(open, bar.low) : open,
          volume: volPerBrick,
          direction: 'up',
          brickIndex: bricks.length,
          sourceBarStart: sourceStart,
          sourceBarEnd: bar.time,
        });
      }
      refPrice += numBricks * brickSize;
      lastDirection = 'up';
      created = true;
    } else if (lastDirection !== 'up' && downDiff >= brickSize) {
      const numBricks = Math.floor(downDiff / brickSize);
      const volPerBrick = numBricks > 0 ? accVolume / numBricks : accVolume;

      for (let b = 0; b < numBricks; b++) {
        const close = refPrice - b * brickSize;
        const open = close - brickSize;
        bricks.push({
          time: bar.time,
          open: close,
          close: open,
          high: showWicks && b === 0 ? Math.max(close, bar.high) : close,
          low: showWicks && b === numBricks - 1 ? Math.min(open, bar.low) : open,
          volume: volPerBrick,
          direction: 'down',
          brickIndex: bricks.length,
          sourceBarStart: sourceStart,
          sourceBarEnd: bar.time,
        });
      }
      refPrice -= numBricks * brickSize;
      lastDirection = 'down';
      created = true;
    }

    if (lastDirection === null) {
      if (upDiff >= brickSize) {
        const numBricks = Math.floor(upDiff / brickSize);
        const volPerBrick = accVolume / Math.max(numBricks, 1);
        for (let b = 0; b < numBricks; b++) {
          const open = refPrice + b * brickSize;
          const close = open + brickSize;
          bricks.push({
            time: bar.time, open, close, high: close, low: open,
            volume: volPerBrick, direction: 'up', brickIndex: bricks.length,
            sourceBarStart: sourceStart, sourceBarEnd: bar.time,
          });
        }
        refPrice += numBricks * brickSize;
        lastDirection = 'up';
        created = true;
      } else if (downDiff >= brickSize) {
        const numBricks = Math.floor(downDiff / brickSize);
        const volPerBrick = accVolume / Math.max(numBricks, 1);
        for (let b = 0; b < numBricks; b++) {
          const close = refPrice - b * brickSize;
          const open = close - brickSize;
          bricks.push({
            time: bar.time, open: close, close: open, high: close, low: open,
            volume: volPerBrick, direction: 'down', brickIndex: bricks.length,
            sourceBarStart: sourceStart, sourceBarEnd: bar.time,
          });
        }
        refPrice -= numBricks * brickSize;
        lastDirection = 'down';
        created = true;
      }
    }

    if (created) {
      accVolume = 0;
      sourceStart = bar.time;
    }
  }

  return bricks;
}

// ─── Support & Resistance from Reversals ────────────────────────────────────

export function findSupportResistance(
  bricks: RenkoBrick[],
  tolerance: number = 0.001,
): RenkoSupportResistance[] {
  if (bricks.length < 3) return [];

  const reversalLevels: { level: number; type: 'support' | 'resistance'; time: number }[] = [];

  for (let i = 1; i < bricks.length; i++) {
    if (bricks[i].direction !== bricks[i - 1].direction) {
      if (bricks[i].direction === 'up') {
        reversalLevels.push({ level: bricks[i - 1].close, type: 'support', time: bricks[i].time });
      } else {
        reversalLevels.push({ level: bricks[i - 1].close, type: 'resistance', time: bricks[i].time });
      }
    }
  }

  const merged: RenkoSupportResistance[] = [];
  const used = new Set<number>();

  for (let i = 0; i < reversalLevels.length; i++) {
    if (used.has(i)) continue;
    const rl = reversalLevels[i];
    const cluster: typeof reversalLevels = [rl];
    used.add(i);

    for (let j = i + 1; j < reversalLevels.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(reversalLevels[j].level - rl.level) / rl.level <= tolerance && reversalLevels[j].type === rl.type) {
        cluster.push(reversalLevels[j]);
        used.add(j);
      }
    }

    const avgLevel = cluster.reduce((s, c) => s + c.level, 0) / cluster.length;
    merged.push({
      level: avgLevel,
      type: rl.type,
      touches: cluster.length,
      firstTime: cluster[0].time,
      lastTime: cluster[cluster.length - 1].time,
    });
  }

  return merged.sort((a, b) => b.touches - a.touches);
}

// ─── Trend Identification ───────────────────────────────────────────────────

export function identifyTrends(bricks: RenkoBrick[]): RenkoTrend[] {
  if (!bricks.length) return [];

  const trends: RenkoTrend[] = [];
  let startIdx = 0;
  let currentDir = bricks[0].direction;
  let count = 1;

  for (let i = 1; i < bricks.length; i++) {
    if (bricks[i].direction === currentDir) {
      count++;
    } else {
      trends.push({
        direction: currentDir,
        strength: count,
        consecutiveBricks: count,
        startIndex: startIdx,
        endIndex: i - 1,
      });
      startIdx = i;
      currentDir = bricks[i].direction;
      count = 1;
    }
  }

  trends.push({
    direction: currentDir,
    strength: count,
    consecutiveBricks: count,
    startIndex: startIdx,
    endIndex: bricks.length - 1,
  });

  return trends;
}

// ─── Renko MA Overlay ───────────────────────────────────────────────────────

export function renkoSMA(bricks: RenkoBrick[], period: number): number[] {
  const closes = bricks.map(b => b.close);
  const out = new Array<number>(closes.length).fill(NaN);
  if (period > closes.length) return out;

  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function renkoEMA(bricks: RenkoBrick[], period: number): number[] {
  const closes = bricks.map(b => b.close);
  const out = new Array<number>(closes.length).fill(NaN);
  if (period > closes.length) return out;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];

  let prev = sum / period;
  out[period - 1] = prev;

  for (let i = period; i < closes.length; i++) {
    prev = (closes[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

// ─── Volume Integration ─────────────────────────────────────────────────────

export function brickVolumeProfile(bricks: RenkoBrick[]): Map<number, number> {
  const profile = new Map<number, number>();
  for (const brick of bricks) {
    const level = Math.round((brick.open + brick.close) / 2 * 100) / 100;
    profile.set(level, (profile.get(level) ?? 0) + brick.volume);
  }
  return profile;
}

export function averageBrickVolume(bricks: RenkoBrick[], direction?: 'up' | 'down'): number {
  const filtered = direction ? bricks.filter(b => b.direction === direction) : bricks;
  if (!filtered.length) return 0;
  return filtered.reduce((s, b) => s + b.volume, 0) / filtered.length;
}
