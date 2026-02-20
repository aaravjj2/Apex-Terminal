/**
 * v1.56 — Deterministic Stream Simulator
 * Fixed-seed, fixed-clock-step market tick generator for DEMO mode
 * Produces predictable ticks for 5 symbols: SPY, AAPL, TSLA, NVDA, MSFT
 */

export interface StreamTick {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
  sequence: number;
}

// Fixed seed
const SEED = 42;
const SYMBOLS = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT'] as const;
// Use canonical demo base prices (single source of truth)
import { BASE_PRICES as CANONICAL_BASE_PRICES } from '../demo/canonicalDemo';

const BASE_PRICES: Record<string, number> = { ...CANONICAL_BASE_PRICES };

// Deterministic PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class StreamSimulator {
  private rng: () => number;
  private sequence = 0;
  private baseTime: number;
  private prices: Record<string, number>;
  private running = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(tick: StreamTick) => void>();
  private tickHistory: StreamTick[] = [];
  private _status: 'disconnected' | 'demo' | 'replay' | 'offline' = 'disconnected';

  constructor() {
    this.rng = mulberry32(SEED);
    this.baseTime = new Date('2026-02-15T14:30:00Z').getTime();
    this.prices = { ...BASE_PRICES };
  }

  get status() { return this._status; }
  get history() { return this.tickHistory; }

  /** Generate next deterministic tick */
  private nextTick(): StreamTick {
    const symbolIdx = this.sequence % SYMBOLS.length;
    const symbol = SYMBOLS[symbolIdx];
    const r = this.rng();
    // Price change: -0.5% to +0.5% of base
    const changePct = (r - 0.5) * 1.0;
    const change = this.prices[symbol] * (changePct / 100);
    this.prices[symbol] = Math.round((this.prices[symbol] + change) * 100) / 100;
    const volume = Math.floor(1000 + r * 9000);

    const tick: StreamTick = {
      symbol,
      price: this.prices[symbol],
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume,
      timestamp: this.baseTime + this.sequence * 1000,
      sequence: this.sequence,
    };
    this.sequence++;
    return tick;
  }

  /** Start deterministic tick stream */
  start(intervalMs = 1000) {
    if (this.running) return;
    this.running = true;
    this._status = 'demo';
    // Generate initial batch of 5 ticks (one per symbol)
    for (let i = 0; i < 5; i++) {
      const tick = this.nextTick();
      this.tickHistory.push(tick);
      this.listeners.forEach(fn => fn(tick));
    }
    this.interval = setInterval(() => {
      const tick = this.nextTick();
      this.tickHistory.push(tick);
      // Keep last 100 ticks
      if (this.tickHistory.length > 100) {
        this.tickHistory = this.tickHistory.slice(-100);
      }
      this.listeners.forEach(fn => fn(tick));
    }, intervalMs);
  }

  stop() {
    this.running = false;
    this._status = 'disconnected';
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  /** Reset to initial state for determinism */
  reset() {
    this.stop();
    this.rng = mulberry32(SEED);
    this.sequence = 0;
    this.prices = { ...BASE_PRICES };
    this.tickHistory = [];
  }

  subscribe(fn: (tick: StreamTick) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Get latest price for a symbol */
  getLatestPrice(symbol: string): number {
    return this.prices[symbol] ?? 0;
  }

  /** Generate N ticks deterministically (for snapshot testing) */
  generateBatch(n: number): StreamTick[] {
    const ticks: StreamTick[] = [];
    for (let i = 0; i < n; i++) {
      ticks.push(this.nextTick());
    }
    return ticks;
  }
}

// Singleton instance
export const streamSimulator = new StreamSimulator();
