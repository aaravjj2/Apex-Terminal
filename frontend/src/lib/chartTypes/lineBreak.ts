import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LineBreakBlock {
  open: number;
  close: number;
  high: number;
  low: number;
  time: number;
  direction: 'up' | 'down';
  blockIndex: number;
  volume: number;
  isReversal: boolean;
}

export interface LineBreakConfig {
  lineCount: number;
}

export interface LineBreakSupportResistance {
  level: number;
  type: 'support' | 'resistance';
  strength: number;
  lastTime: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_LINEBREAK_CONFIG: LineBreakConfig = {
  lineCount: 3,
};

// ─── Line Break Calculation ─────────────────────────────────────────────────

export function generateLineBreakBlocks(
  bars: OHLCVBar[],
  config: Partial<LineBreakConfig> = {},
): LineBreakBlock[] {
  const cfg = { ...DEFAULT_LINEBREAK_CONFIG, ...config };
  if (bars.length < 2) return [];

  const n = Math.max(1, cfg.lineCount);
  const blocks: LineBreakBlock[] = [];

  const firstDir: 'up' | 'down' = bars[1].close >= bars[0].close ? 'up' : 'down';
  blocks.push({
    open: bars[0].close,
    close: bars[1].close,
    high: Math.max(bars[0].close, bars[1].close),
    low: Math.min(bars[0].close, bars[1].close),
    time: bars[1].time,
    direction: firstDir,
    blockIndex: 0,
    volume: bars[0].volume + bars[1].volume,
    isReversal: false,
  });

  for (let i = 2; i < bars.length; i++) {
    const price = bars[i].close;
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock.direction === 'up') {
      if (price > lastBlock.close) {
        blocks.push({
          open: lastBlock.close,
          close: price,
          high: price,
          low: lastBlock.close,
          time: bars[i].time,
          direction: 'up',
          blockIndex: blocks.length,
          volume: bars[i].volume,
          isReversal: false,
        });
      } else {
        const lookback = blocks.slice(-n);
        const lowestClose = Math.min(...lookback.map(b => Math.min(b.open, b.close)));
        if (price < lowestClose) {
          blocks.push({
            open: lastBlock.close,
            close: price,
            high: lastBlock.close,
            low: price,
            time: bars[i].time,
            direction: 'down',
            blockIndex: blocks.length,
            volume: bars[i].volume,
            isReversal: true,
          });
        }
      }
    } else {
      if (price < lastBlock.close) {
        blocks.push({
          open: lastBlock.close,
          close: price,
          high: lastBlock.close,
          low: price,
          time: bars[i].time,
          direction: 'down',
          blockIndex: blocks.length,
          volume: bars[i].volume,
          isReversal: false,
        });
      } else {
        const lookback = blocks.slice(-n);
        const highestClose = Math.max(...lookback.map(b => Math.max(b.open, b.close)));
        if (price > highestClose) {
          blocks.push({
            open: lastBlock.close,
            close: price,
            high: price,
            low: lastBlock.close,
            time: bars[i].time,
            direction: 'up',
            blockIndex: blocks.length,
            volume: bars[i].volume,
            isReversal: true,
          });
        }
      }
    }
  }

  return blocks;
}

// ─── Trend Reversal Detection ───────────────────────────────────────────────

export interface LineBreakReversal {
  blockIndex: number;
  time: number;
  fromDirection: 'up' | 'down';
  toDirection: 'up' | 'down';
  price: number;
}

export function detectReversals(blocks: LineBreakBlock[]): LineBreakReversal[] {
  const reversals: LineBreakReversal[] = [];

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].isReversal) {
      reversals.push({
        blockIndex: i,
        time: blocks[i].time,
        fromDirection: blocks[i - 1].direction,
        toDirection: blocks[i].direction,
        price: blocks[i].close,
      });
    }
  }

  return reversals;
}

// ─── Consecutive Block Analysis ─────────────────────────────────────────────

export function consecutiveBlocks(blocks: LineBreakBlock[]): { maxUp: number; maxDown: number; currentRun: number; currentDirection: 'up' | 'down' | null } {
  if (!blocks.length) return { maxUp: 0, maxDown: 0, currentRun: 0, currentDirection: null };

  let maxUp = 0;
  let maxDown = 0;
  let run = 1;
  let runDir = blocks[0].direction;

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].direction === runDir) {
      run++;
    } else {
      if (runDir === 'up') maxUp = Math.max(maxUp, run);
      else maxDown = Math.max(maxDown, run);
      runDir = blocks[i].direction;
      run = 1;
    }
  }

  if (runDir === 'up') maxUp = Math.max(maxUp, run);
  else maxDown = Math.max(maxDown, run);

  return { maxUp, maxDown, currentRun: run, currentDirection: runDir };
}

// ─── Support / Resistance Identification ────────────────────────────────────

export function findSupportResistance(
  blocks: LineBreakBlock[],
  tolerance: number = 0.005,
): LineBreakSupportResistance[] {
  if (blocks.length < 3) return [];

  const levels: { price: number; type: 'support' | 'resistance'; time: number }[] = [];

  for (const block of blocks) {
    if (block.isReversal) {
      if (block.direction === 'up') {
        levels.push({ price: block.open, type: 'support', time: block.time });
      } else {
        levels.push({ price: block.open, type: 'resistance', time: block.time });
      }
    }
  }

  const merged: LineBreakSupportResistance[] = [];
  const used = new Set<number>();

  for (let i = 0; i < levels.length; i++) {
    if (used.has(i)) continue;
    used.add(i);

    const cluster = [levels[i]];
    for (let j = i + 1; j < levels.length; j++) {
      if (used.has(j)) continue;
      if (levels[j].type === levels[i].type &&
          Math.abs(levels[j].price - levels[i].price) / levels[i].price <= tolerance) {
        cluster.push(levels[j]);
        used.add(j);
      }
    }

    const avgPrice = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
    merged.push({
      level: avgPrice,
      type: levels[i].type,
      strength: cluster.length,
      lastTime: cluster[cluster.length - 1].time,
    });
  }

  return merged.sort((a, b) => b.strength - a.strength);
}

// ─── Trend Strength ─────────────────────────────────────────────────────────

export function trendStrength(blocks: LineBreakBlock[], lookback: number = 20): number {
  const slice = blocks.slice(-lookback);
  if (!slice.length) return 0;

  const upBlocks = slice.filter(b => b.direction === 'up').length;
  return ((upBlocks / slice.length) - 0.5) * 2;
}

export function blockStatistics(blocks: LineBreakBlock[]): {
  totalBlocks: number;
  upBlocks: number;
  downBlocks: number;
  reversals: number;
  avgBlockSize: number;
  avgUpSize: number;
  avgDownSize: number;
} {
  const up = blocks.filter(b => b.direction === 'up');
  const down = blocks.filter(b => b.direction === 'down');
  const sizes = blocks.map(b => Math.abs(b.close - b.open));
  const upSizes = up.map(b => Math.abs(b.close - b.open));
  const downSizes = down.map(b => Math.abs(b.close - b.open));

  return {
    totalBlocks: blocks.length,
    upBlocks: up.length,
    downBlocks: down.length,
    reversals: blocks.filter(b => b.isReversal).length,
    avgBlockSize: sizes.length ? sizes.reduce((s, v) => s + v, 0) / sizes.length : 0,
    avgUpSize: upSizes.length ? upSizes.reduce((s, v) => s + v, 0) / upSizes.length : 0,
    avgDownSize: downSizes.length ? downSizes.reduce((s, v) => s + v, 0) / downSizes.length : 0,
  };
}
