import { type Bar, type Trade, TimeFrame, TIMEFRAME_MS } from './types';

// ─── Aggregation Mode ───────────────────────────────────────────────────────

export enum AggregationMode {
  TIME = 'TIME',
  VOLUME = 'VOLUME',
  TICK = 'TICK',
  RANGE = 'RANGE',
  RENKO = 'RENKO',
  POINT_AND_FIGURE = 'POINT_AND_FIGURE',
}

export interface AggregatorConfig {
  symbol: string;
  mode: AggregationMode;
  timeframe?: TimeFrame;
  tickCount?: number;
  volumeThreshold?: number;
  rangeSize?: number;
  renkoSize?: number;
  pnfBoxSize?: number;
  pnfReversal?: number;
  includePreMarket?: boolean;
  includePostMarket?: boolean;
  sessionStart?: string; // HH:mm
  sessionEnd?: string;
}

// ─── Volume Profile within a Bar ────────────────────────────────────────────

interface BarVolumeProfile {
  priceLevels: Map<number, number>;
  poc: number;       // point of control price
  valueAreaHigh: number;
  valueAreaLow: number;
}

function buildVolumeProfile(trades: Trade[], tickSize = 0.01): BarVolumeProfile {
  const levels = new Map<number, number>();
  for (const t of trades) {
    const rounded = Math.round(t.price / tickSize) * tickSize;
    levels.set(rounded, (levels.get(rounded) ?? 0) + t.size);
  }

  let pocPrice = 0, pocVol = 0;
  let totalVol = 0;
  for (const [price, vol] of levels) {
    totalVol += vol;
    if (vol > pocVol) { pocVol = vol; pocPrice = price; }
  }

  const sorted = Array.from(levels.entries()).sort((a, b) => b[1] - a[1]);
  const vaTarget = totalVol * 0.7;
  let vaVol = 0;
  let vaHigh = -Infinity, vaLow = Infinity;
  for (const [price, vol] of sorted) {
    vaVol += vol;
    if (price > vaHigh) vaHigh = price;
    if (price < vaLow) vaLow = price;
    if (vaVol >= vaTarget) break;
  }

  return { priceLevels: levels, poc: pocPrice, valueAreaHigh: vaHigh, valueAreaLow: vaLow };
}

// ─── Bar Builder ────────────────────────────────────────────────────────────

interface ActiveBar {
  bar: Bar;
  tickCount: number;
  turnover: number;
  trades: Trade[];
}

function createActiveBar(symbol: string, timeframe: TimeFrame, timestamp: number, firstPrice: number): ActiveBar {
  return {
    bar: {
      symbol,
      timeframe,
      timestamp,
      open: firstPrice,
      high: firstPrice,
      low: firstPrice,
      close: firstPrice,
      volume: 0,
      vwap: 0,
      trades: 0,
      isComplete: false,
    },
    tickCount: 0,
    turnover: 0,
    trades: [],
  };
}

function applyTrade(active: ActiveBar, trade: Trade): void {
  const b = active.bar;
  if (trade.price > b.high) b.high = trade.price;
  if (trade.price < b.low) b.low = trade.price;
  b.close = trade.price;
  b.volume += trade.size;
  active.turnover += trade.price * trade.size;
  b.vwap = active.turnover / Math.max(b.volume, 1);
  b.trades++;
  active.tickCount++;
  active.trades.push(trade);
}

function finalizeBar(active: ActiveBar): Bar {
  active.bar.isComplete = true;
  return { ...active.bar };
}

// ─── Time-based Aggregator ──────────────────────────────────────────────────

export class TimeBarAggregator {
  private active: ActiveBar | null = null;
  private config: AggregatorConfig;
  private intervalMs: number;
  private completed: Bar[] = [];
  private listeners: Array<(bar: Bar, isUpdate: boolean) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.intervalMs = TIMEFRAME_MS[config.timeframe ?? TimeFrame.M1] ?? 60_000;
  }

  onBar(cb: (bar: Bar, isUpdate: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private barTimestamp(tradeTs: number): number {
    return Math.floor(tradeTs / this.intervalMs) * this.intervalMs;
  }

  private isInSession(ts: number): boolean {
    if (!this.config.sessionStart || !this.config.sessionEnd) return true;
    const d = new Date(ts);
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (this.config.includePreMarket && hhmm < this.config.sessionStart) return true;
    if (this.config.includePostMarket && hhmm > this.config.sessionEnd) return true;
    return hhmm >= this.config.sessionStart && hhmm < this.config.sessionEnd;
  }

  processTrade(trade: Trade): void {
    if (!this.isInSession(trade.timestamp)) return;

    const barTs = this.barTimestamp(trade.timestamp);

    if (this.active && this.active.bar.timestamp !== barTs) {
      const completed = finalizeBar(this.active);
      this.completed.push(completed);
      this.emit(completed, false);
      this.active = null;
    }

    if (!this.active) {
      this.active = createActiveBar(this.config.symbol, this.config.timeframe ?? TimeFrame.M1, barTs, trade.price);
    }

    applyTrade(this.active, trade);
    this.emit({ ...this.active.bar }, true);
  }

  flush(): Bar | null {
    if (!this.active) return null;
    const bar = finalizeBar(this.active);
    this.completed.push(bar);
    this.emit(bar, false);
    this.active = null;
    return bar;
  }

  getCompleted(): Bar[] { return [...this.completed]; }
  getCurrent(): Bar | null { return this.active ? { ...this.active.bar } : null; }
  getVolumeProfile(): BarVolumeProfile | null {
    return this.active ? buildVolumeProfile(this.active.trades) : null;
  }

  private emit(bar: Bar, isUpdate: boolean): void {
    for (const cb of this.listeners) {
      try { cb(bar, isUpdate); } catch { /* ignored */ }
    }
  }
}

// ─── Volume-based Aggregator ────────────────────────────────────────────────

export class VolumeBarAggregator {
  private active: ActiveBar | null = null;
  private threshold: number;
  private config: AggregatorConfig;
  private completed: Bar[] = [];
  private listeners: Array<(bar: Bar, isUpdate: boolean) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.threshold = config.volumeThreshold ?? 10_000;
  }

  onBar(cb: (bar: Bar, isUpdate: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  processTrade(trade: Trade): void {
    if (!this.active) {
      this.active = createActiveBar(this.config.symbol, TimeFrame.TICK, trade.timestamp, trade.price);
    }
    applyTrade(this.active, trade);
    this.emit({ ...this.active.bar }, true);

    if (this.active.bar.volume >= this.threshold) {
      const bar = finalizeBar(this.active);
      this.completed.push(bar);
      this.emit(bar, false);
      this.active = null;
    }
  }

  getCompleted(): Bar[] { return [...this.completed]; }

  private emit(bar: Bar, isUpdate: boolean): void {
    for (const cb of this.listeners) { try { cb(bar, isUpdate); } catch { /* */ } }
  }
}

// ─── Tick-based Aggregator ──────────────────────────────────────────────────

export class TickBarAggregator {
  private active: ActiveBar | null = null;
  private tickTarget: number;
  private config: AggregatorConfig;
  private completed: Bar[] = [];
  private listeners: Array<(bar: Bar, isUpdate: boolean) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.tickTarget = config.tickCount ?? 100;
  }

  onBar(cb: (bar: Bar, isUpdate: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  processTrade(trade: Trade): void {
    if (!this.active) {
      this.active = createActiveBar(this.config.symbol, TimeFrame.TICK, trade.timestamp, trade.price);
    }
    applyTrade(this.active, trade);
    this.emit({ ...this.active.bar }, true);

    if (this.active.tickCount >= this.tickTarget) {
      const bar = finalizeBar(this.active);
      this.completed.push(bar);
      this.emit(bar, false);
      this.active = null;
    }
  }

  getCompleted(): Bar[] { return [...this.completed]; }

  private emit(bar: Bar, isUpdate: boolean): void {
    for (const cb of this.listeners) { try { cb(bar, isUpdate); } catch { /* */ } }
  }
}

// ─── Range-based Aggregator ─────────────────────────────────────────────────

export class RangeBarAggregator {
  private active: ActiveBar | null = null;
  private rangeSize: number;
  private config: AggregatorConfig;
  private completed: Bar[] = [];
  private listeners: Array<(bar: Bar, isUpdate: boolean) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.rangeSize = config.rangeSize ?? 1.0;
  }

  onBar(cb: (bar: Bar, isUpdate: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  processTrade(trade: Trade): void {
    if (!this.active) {
      this.active = createActiveBar(this.config.symbol, TimeFrame.TICK, trade.timestamp, trade.price);
    }

    const projectedHigh = Math.max(this.active.bar.high, trade.price);
    const projectedLow = Math.min(this.active.bar.low, trade.price);

    if (projectedHigh - projectedLow > this.rangeSize) {
      const bar = finalizeBar(this.active);
      this.completed.push(bar);
      this.emit(bar, false);
      this.active = createActiveBar(this.config.symbol, TimeFrame.TICK, trade.timestamp, trade.price);
    }

    applyTrade(this.active, trade);
    this.emit({ ...this.active.bar }, true);
  }

  getCompleted(): Bar[] { return [...this.completed]; }

  private emit(bar: Bar, isUpdate: boolean): void {
    for (const cb of this.listeners) { try { cb(bar, isUpdate); } catch { /* */ } }
  }
}

// ─── Renko Aggregator ───────────────────────────────────────────────────────

export class RenkoAggregator {
  private brickSize: number;
  private lastClose: number | null = null;
  private config: AggregatorConfig;
  private completed: Bar[] = [];
  private listeners: Array<(bar: Bar) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.brickSize = config.renkoSize ?? 1.0;
  }

  onBrick(cb: (bar: Bar) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  processTrade(trade: Trade): void {
    if (this.lastClose === null) {
      this.lastClose = Math.round(trade.price / this.brickSize) * this.brickSize;
      return;
    }

    while (trade.price >= this.lastClose + this.brickSize) {
      const open = this.lastClose;
      const close = this.lastClose + this.brickSize;
      this.emitBrick(trade.timestamp, open, close, trade.size);
      this.lastClose = close;
    }
    while (trade.price <= this.lastClose - this.brickSize) {
      const open = this.lastClose;
      const close = this.lastClose - this.brickSize;
      this.emitBrick(trade.timestamp, open, close, trade.size);
      this.lastClose = close;
    }
  }

  private emitBrick(timestamp: number, open: number, close: number, volume: number): void {
    const bar: Bar = {
      symbol: this.config.symbol,
      timeframe: TimeFrame.TICK,
      timestamp,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      volume,
      vwap: (open + close) / 2,
      trades: 1,
      isComplete: true,
    };
    this.completed.push(bar);
    for (const cb of this.listeners) { try { cb(bar); } catch { /* */ } }
  }

  getCompleted(): Bar[] { return [...this.completed]; }
}

// ─── Point & Figure Aggregator ──────────────────────────────────────────────

export class PointAndFigureAggregator {
  private boxSize: number;
  private reversal: number;
  private direction: 'X' | 'O' | null = null;
  private columnHigh = 0;
  private columnLow = Infinity;
  private lastPrice: number | null = null;
  private config: AggregatorConfig;
  private columns: Array<{ direction: 'X' | 'O'; high: number; low: number; timestamp: number }> = [];
  private listeners: Array<(col: { direction: 'X' | 'O'; high: number; low: number }) => void> = [];

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.boxSize = config.pnfBoxSize ?? 1.0;
    this.reversal = config.pnfReversal ?? 3;
  }

  onColumn(cb: (col: { direction: 'X' | 'O'; high: number; low: number }) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  processTrade(trade: Trade): void {
    const price = Math.round(trade.price / this.boxSize) * this.boxSize;

    if (this.direction === null) {
      this.lastPrice = price;
      this.columnHigh = price;
      this.columnLow = price;
      this.direction = 'X';
      return;
    }

    if (this.direction === 'X') {
      if (price > this.columnHigh) {
        this.columnHigh = price;
      } else if (this.columnHigh - price >= this.reversal * this.boxSize) {
        this.closeColumn(trade.timestamp);
        this.direction = 'O';
        this.columnHigh = this.columnHigh;
        this.columnLow = price;
      }
    } else {
      if (price < this.columnLow) {
        this.columnLow = price;
      } else if (price - this.columnLow >= this.reversal * this.boxSize) {
        this.closeColumn(trade.timestamp);
        this.direction = 'X';
        this.columnLow = this.columnLow;
        this.columnHigh = price;
      }
    }
    this.lastPrice = price;
  }

  private closeColumn(timestamp: number): void {
    const col = { direction: this.direction!, high: this.columnHigh, low: this.columnLow, timestamp };
    this.columns.push(col);
    for (const cb of this.listeners) { try { cb(col); } catch { /* */ } }
  }

  getColumns() { return [...this.columns]; }
}

// ─── Multi-Timeframe Aggregator ─────────────────────────────────────────────

const TIMEFRAME_HIERARCHY: TimeFrame[] = [
  TimeFrame.M1, TimeFrame.M5, TimeFrame.M15, TimeFrame.M30,
  TimeFrame.H1, TimeFrame.H4, TimeFrame.D1, TimeFrame.W1, TimeFrame.MN1,
];

export class MultiTimeframeAggregator {
  private aggregators = new Map<TimeFrame, TimeBarAggregator>();
  private symbol: string;

  constructor(symbol: string, timeframes: TimeFrame[] = TIMEFRAME_HIERARCHY) {
    this.symbol = symbol;
    for (const tf of timeframes) {
      this.aggregators.set(tf, new TimeBarAggregator({
        symbol,
        mode: AggregationMode.TIME,
        timeframe: tf,
      }));
    }
  }

  processTrade(trade: Trade): void {
    for (const agg of this.aggregators.values()) {
      agg.processTrade(trade);
    }
  }

  onBar(timeframe: TimeFrame, cb: (bar: Bar, isUpdate: boolean) => void): () => void {
    const agg = this.aggregators.get(timeframe);
    if (!agg) return () => {};
    return agg.onBar(cb);
  }

  getCurrent(timeframe: TimeFrame): Bar | null {
    return this.aggregators.get(timeframe)?.getCurrent() ?? null;
  }

  getCompleted(timeframe: TimeFrame): Bar[] {
    return this.aggregators.get(timeframe)?.getCompleted() ?? [];
  }

  flushAll(): Map<TimeFrame, Bar | null> {
    const result = new Map<TimeFrame, Bar | null>();
    for (const [tf, agg] of this.aggregators) {
      result.set(tf, agg.flush());
    }
    return result;
  }
}

// ─── Gap Detector ───────────────────────────────────────────────────────────

export interface GapInfo {
  timestamp: number;
  prevClose: number;
  open: number;
  gapPct: number;
  type: 'UP' | 'DOWN';
}

export function detectGaps(bars: Bar[], minGapPct = 0.5): GapInfo[] {
  const gaps: GapInfo[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    if (!prev.isComplete) continue;
    const gapPct = ((curr.open - prev.close) / prev.close) * 100;
    if (Math.abs(gapPct) >= minGapPct) {
      gaps.push({
        timestamp: curr.timestamp,
        prevClose: prev.close,
        open: curr.open,
        gapPct,
        type: gapPct > 0 ? 'UP' : 'DOWN',
      });
    }
  }
  return gaps;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAggregator(config: AggregatorConfig) {
  switch (config.mode) {
    case AggregationMode.TIME:
      return new TimeBarAggregator(config);
    case AggregationMode.VOLUME:
      return new VolumeBarAggregator(config);
    case AggregationMode.TICK:
      return new TickBarAggregator(config);
    case AggregationMode.RANGE:
      return new RangeBarAggregator(config);
    case AggregationMode.RENKO:
      return new RenkoAggregator(config);
    case AggregationMode.POINT_AND_FIGURE:
      return new PointAndFigureAggregator(config);
    default:
      return new TimeBarAggregator(config);
  }
}
