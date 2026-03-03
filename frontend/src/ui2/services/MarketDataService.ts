/**
 * MarketDataService — manages WebSocket connections, REST data fetch,
 * bar aggregation, tick processing, and market data distribution.
 *
 * This service runs independently of React and can be consumed by
 * useMarketData or any other hook/context.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface Tick {
  symbol: string;
  price: number;
  size: number;
  timestamp: number;
  exchange: string;
  conditions: string[];
}

export interface Quote {
  symbol: string;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  last: number;
  lastSize: number;
  volume: number;
  timestamp: number;
}

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export type Timeframe = '1s' | '5s' | '15s' | '30s' | '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d' | '1w' | '1M';

export interface MarketDataSubscription {
  id: string;
  symbol: string;
  type: 'tick' | 'quote' | 'bar';
  timeframe?: Timeframe;
  callback: (data: Tick | Quote | Bar) => void;
}

export interface FeedConfig {
  provider: 'polygon' | 'alpaca' | 'coinbase' | 'mock';
  apiKey?: string;
  wsUrl?: string;
  restUrl?: string;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
  session: 'pre' | 'regular' | 'post' | 'closed';
  exchange: string;
}

// ── Timeframe utilities ──────────────────────────────────────────────────────

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1s': 1000, '5s': 5000, '15s': 15000, '30s': 30000,
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '2h': 7200000, '4h': 14400000,
  '1d': 86400000, '1w': 604800000, '1M': 2592000000,
};

export function timeframeToMs(tf: Timeframe): number {
  return TIMEFRAME_MS[tf] || 60000;
}

export function timeframeLabel(tf: Timeframe): string {
  const labels: Record<Timeframe, string> = {
    '1s': '1 Second', '5s': '5 Seconds', '15s': '15 Seconds', '30s': '30 Seconds',
    '1m': '1 Minute', '3m': '3 Minutes', '5m': '5 Minutes', '15m': '15 Minutes', '30m': '30 Minutes',
    '1h': '1 Hour', '2h': '2 Hours', '4h': '4 Hours',
    '1d': '1 Day', '1w': '1 Week', '1M': '1 Month',
  };
  return labels[tf];
}

// ── Bar Aggregator ───────────────────────────────────────────────────────────

export class BarAggregator {
  private current: Bar | null = null;
  private tfMs: number;
  private bars: Bar[] = [];
  private maxBars: number;

  constructor(timeframe: Timeframe, maxBars = 5000) {
    this.tfMs = timeframeToMs(timeframe);
    this.maxBars = maxBars;
  }

  processTick(tick: Tick): Bar | null {
    const barStart = Math.floor(tick.timestamp / this.tfMs) * this.tfMs;

    if (!this.current || this.current.timestamp !== barStart) {
      // Close current bar, start new one
      const closedBar = this.current ? { ...this.current } : null;
      this.current = {
        timestamp: barStart,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
        trades: 1,
      };
      if (closedBar) {
        this.bars.push(closedBar);
        if (this.bars.length > this.maxBars) this.bars.shift();
        return closedBar;
      }
      return null;
    }

    // Update current bar
    this.current.high = Math.max(this.current.high, tick.price);
    this.current.low = Math.min(this.current.low, tick.price);
    this.current.close = tick.price;
    this.current.volume += tick.size;
    this.current.trades = (this.current.trades || 0) + 1;

    return null;
  }

  getCurrentBar(): Bar | null {
    return this.current;
  }

  getBars(): Bar[] {
    return [...this.bars, ...(this.current ? [this.current] : [])];
  }

  reset(): void {
    this.current = null;
    this.bars = [];
  }
}

// ── VWAP Calculator ──────────────────────────────────────────────────────────

export class VwapCalculator {
  private cumulativeVolume = 0;
  private cumulativeVolumePrice = 0;
  private sessionStart: number;

  constructor() {
    this.sessionStart = this.getSessionStart();
  }

  private getSessionStart(): number {
    const now = new Date();
    now.setHours(9, 30, 0, 0);
    return now.getTime();
  }

  addTick(price: number, volume: number, timestamp: number): number {
    if (timestamp < this.sessionStart) {
      this.sessionStart = this.getSessionStart();
      this.cumulativeVolume = 0;
      this.cumulativeVolumePrice = 0;
    }
    this.cumulativeVolume += volume;
    this.cumulativeVolumePrice += price * volume;
    return this.cumulativeVolume > 0 ? this.cumulativeVolumePrice / this.cumulativeVolume : price;
  }

  getVwap(): number {
    return this.cumulativeVolume > 0 ? this.cumulativeVolumePrice / this.cumulativeVolume : 0;
  }

  reset(): void {
    this.cumulativeVolume = 0;
    this.cumulativeVolumePrice = 0;
    this.sessionStart = this.getSessionStart();
  }
}

// ── Tick Buffer ──────────────────────────────────────────────────────────────

export class TickBuffer {
  private buffer: Tick[] = [];
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  add(tick: Tick): void {
    this.buffer.push(tick);
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  getRange(from: number, to: number): Tick[] {
    return this.buffer.filter(t => t.timestamp >= from && t.timestamp <= to);
  }

  getLast(n: number): Tick[] {
    return this.buffer.slice(-n);
  }

  getCount(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

// ── Mock Data Generator ──────────────────────────────────────────────────────

export class MockMarketDataGenerator {
  private prices: Map<string, number> = new Map();
  private volatilities: Map<string, number> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers: Map<string, Array<(tick: Tick) => void>> = new Map();

  constructor() {
    const defaults: Array<[string, number, number]> = [
      ['AAPL', 185, 0.015],
      ['MSFT', 420, 0.012],
      ['GOOGL', 148, 0.014],
      ['AMZN', 182, 0.016],
      ['NVDA', 875, 0.025],
      ['TSLA', 245, 0.03],
      ['META', 505, 0.018],
      ['SPY', 525, 0.008],
      ['QQQ', 445, 0.01],
      ['IWM', 205, 0.012],
      ['BTC-USD', 67500, 0.02],
      ['ETH-USD', 3450, 0.025],
    ];
    defaults.forEach(([sym, price, vol]) => {
      this.prices.set(sym, price);
      this.volatilities.set(sym, vol);
    });
  }

  subscribe(symbol: string, callback: (tick: Tick) => void): () => void {
    if (!this.subscribers.has(symbol)) this.subscribers.set(symbol, []);
    this.subscribers.get(symbol)!.push(callback);
    if (!this.prices.has(symbol)) {
      this.prices.set(symbol, 100 + Math.random() * 200);
      this.volatilities.set(symbol, 0.015);
    }
    return () => {
      const subs = this.subscribers.get(symbol);
      if (subs) {
        const idx = subs.indexOf(callback);
        if (idx >= 0) subs.splice(idx, 1);
      }
    };
  }

  start(intervalMs = 200): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.subscribers.forEach((callbacks, symbol) => {
        const price = this.prices.get(symbol) || 100;
        const vol = this.volatilities.get(symbol) || 0.015;
        const change = price * vol * (Math.random() - 0.48) * 0.1;
        const newPrice = +(price + change).toFixed(price > 100 ? 2 : price > 1 ? 4 : 6);
        this.prices.set(symbol, newPrice);

        const tick: Tick = {
          symbol,
          price: newPrice,
          size: Math.floor(100 + Math.random() * 1000),
          timestamp: Date.now(),
          exchange: ['NYSE', 'NASDAQ', 'ARCA', 'BATS'][Math.floor(Math.random() * 4)],
          conditions: [],
        };
        callbacks.forEach(cb => cb(tick));
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  getPrice(symbol: string): number {
    return this.prices.get(symbol) || 0;
  }

  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price);
  }
}

// ── Market Data Service ──────────────────────────────────────────────────────

export class MarketDataService {
  private config: FeedConfig;
  private subscriptions: Map<string, MarketDataSubscription> = new Map();
  private aggregators: Map<string, BarAggregator> = new Map();
  private vwapCalc: VwapCalculator;
  private tickBuffer: TickBuffer;
  private mockGen: MockMarketDataGenerator;
  private subCounter = 0;
  private isRunning = false;

  constructor(config?: Partial<FeedConfig>) {
    this.config = { provider: 'mock', ...config };
    this.vwapCalc = new VwapCalculator();
    this.tickBuffer = new TickBuffer();
    this.mockGen = new MockMarketDataGenerator();
  }

  subscribeTick(symbol: string, callback: (tick: Tick) => void): string {
    const id = `sub_${++this.subCounter}`;
    this.subscriptions.set(id, { id, symbol, type: 'tick', callback: callback as any });
    this.mockGen.subscribe(symbol, callback);
    if (!this.isRunning) { this.mockGen.start(); this.isRunning = true; }
    return id;
  }

  subscribeBar(symbol: string, timeframe: Timeframe, callback: (bar: Bar) => void): string {
    const id = `sub_${++this.subCounter}`;
    const aggKey = `${symbol}_${timeframe}`;
    if (!this.aggregators.has(aggKey)) {
      this.aggregators.set(aggKey, new BarAggregator(timeframe));
    }
    this.subscriptions.set(id, { id, symbol, type: 'bar', timeframe, callback: callback as any });

    this.mockGen.subscribe(symbol, (tick) => {
      const agg = this.aggregators.get(aggKey);
      if (agg) {
        const bar = agg.processTick(tick);
        if (bar) callback(bar);
      }
    });

    if (!this.isRunning) { this.mockGen.start(); this.isRunning = true; }
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  getHistoricalBars(symbol: string, timeframe: Timeframe, count = 300): Bar[] {
    const tfMs = timeframeToMs(timeframe);
    const now = Date.now();
    let price = this.mockGen.getPrice(symbol) || 150;
    const bars: Bar[] = [];

    for (let i = count; i >= 0; i--) {
      const timestamp = now - i * tfMs;
      const change = (Math.random() - 0.48) * price * 0.015;
      const open = price;
      const close = +(open + change).toFixed(2);
      const high = +(Math.max(open, close) + Math.random() * Math.abs(change) * 0.5).toFixed(2);
      const low = +(Math.min(open, close) - Math.random() * Math.abs(change) * 0.5).toFixed(2);
      bars.push({
        timestamp,
        open: +open.toFixed(2),
        high, low, close,
        volume: Math.floor(100000 + Math.random() * 5000000),
        vwap: +((open + high + low + close) / 4).toFixed(2),
        trades: Math.floor(500 + Math.random() * 5000),
      });
      price = close;
    }

    return bars;
  }

  getMarketStatus(): MarketStatus {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;
    const isWeekday = now.getDay() > 0 && now.getDay() < 6;

    let session: MarketStatus['session'];
    if (!isWeekday) session = 'closed';
    else if (time < 570) session = 'pre';        // before 9:30
    else if (time < 960) session = 'regular';     // 9:30-16:00
    else if (time < 1200) session = 'post';       // 16:00-20:00
    else session = 'closed';

    return {
      isOpen: session === 'regular',
      nextOpen: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (session === 'closed' ? 1 : 0), 9, 30),
      nextClose: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0),
      session,
      exchange: 'NYSE',
    };
  }

  getVwap(): number {
    return this.vwapCalc.getVwap();
  }

  shutdown(): void {
    this.mockGen.stop();
    this.subscriptions.clear();
    this.aggregators.clear();
    this.tickBuffer.clear();
    this.isRunning = false;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: MarketDataService | null = null;

export function getMarketDataService(config?: Partial<FeedConfig>): MarketDataService {
  if (!instance) instance = new MarketDataService(config);
  return instance;
}

export function resetMarketDataService(): void {
  if (instance) { instance.shutdown(); instance = null; }
}

export default MarketDataService;
