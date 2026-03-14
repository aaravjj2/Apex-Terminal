/**
 * v1.57 — Stream Simulator
 * Generates synthetic ticks for 5 symbols until real WebSocket is wired.
 * On startup, attempts to seed prices from the live backend API so the
 * simulator starts from realistic values rather than stale hardcoded prices.
 * Falls back to BASE_PRICES (last-known reference values) if the API is
 * unavailable. Status is 'simulator' when running in fallback mode.
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
// Last-known reference prices — used ONLY as fallback when the live API is unreachable.
// connectLive() seeds from /api/v1/market-data/{symbol}/quote before starting simulation.
const BASE_PRICES: Record<string, number> = {
  SPY: 550.0,
  AAPL: 220.0,
  TSLA: 250.0,
  NVDA: 875.0,
  MSFT: 415.0,
};

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
  private _status: 'disconnected' | 'live' | 'simulator' | 'replay' | 'offline' = 'disconnected';
  /** Active WebSocket reference — prevents duplicate connection attempts */
  private _ws: WebSocket | null = null;

  constructor() {
    this.rng = mulberry32(SEED);
    this.baseTime = new Date('2026-02-15T14:30:00Z').getTime();
    this.prices = { ...BASE_PRICES };
  }

  get status() { return this._status; }
  get history() { return this.tickHistory; }

  /** Try to connect to real backend WebSocket for live ticks */
  connectLive(symbols: string[] = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT']) {
    // Guard: do not open a second connection if one is already open or connecting
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host || 'localhost:5100';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/market`;

    try {
      const ws = new WebSocket(wsUrl);
      this._ws = ws;
      let connected = false;

      ws.onopen = () => {
        connected = true;
        this._status = 'live';
        ws.send(JSON.stringify({ type: 'subscribe', symbols }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'tick' && msg.symbol && msg.price) {
            const tick: StreamTick = {
              symbol: msg.symbol,
              price: msg.price,
              change: msg.change ?? 0,
              changePct: msg.change_pct ?? 0,
              volume: msg.volume ?? 0,
              timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
              sequence: this.sequence++,
            };
            this.prices[tick.symbol] = tick.price;
            this.tickHistory.push(tick);
            if (this.tickHistory.length > 200) {
              this.tickHistory = this.tickHistory.slice(-200);
            }
            this.listeners.forEach(fn => fn(tick));
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onerror = () => {
        this._status = 'disconnected';
        if (!connected) {
          this._ws = null;
          // Seed live prices before starting synthetic ticks
          this._seedAndStart(symbols);
        }
      };

      ws.onclose = () => {
        this._ws = null;
        if (connected) {
          this._status = 'disconnected';
          setTimeout(() => this.connectLive(symbols), 3000);
        }
      };

      // If no connection established within 3 seconds, fall back to simulator
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          this._ws = null;
          this._seedAndStart(symbols);
        }
      }, 3000);

    } catch {
      this._ws = null;
      this._seedAndStart(symbols);
    }
  }

  /**
   * Fetch live spot prices from the backend API for each symbol, then
   * start the synthetic tick simulator with those prices as the seed.
   * Falls back immediately to BASE_PRICES if the API is unreachable.
   */
  private async _seedAndStart(symbols: string[], intervalMs = 1000): Promise<void> {
    try {
      const results = await Promise.allSettled(
        symbols.map(sym =>
          fetch(`/api/v1/market-data/${sym}/quote`, { signal: AbortSignal.timeout(4000) })
            .then(r => r.ok ? r.json() : null)
            .then(d => d ? { sym, price: d.price ?? d.last ?? d.close ?? null } : null)
        )
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.price) {
          const { sym, price } = result.value;
          if (sym && typeof price === 'number' && price > 0) {
            this.prices[sym] = price;
            console.info(`[StreamSimulator] Seeded ${sym} @ $${price.toFixed(2)} (live)`);
          }
        }
      }
    } catch {
      // Network unavailable — BASE_PRICES already loaded in constructor
    }
    this.start(intervalMs);
  }

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
    this._status = 'simulator';
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
    if (this._ws) { this._ws.close(); this._ws = null; }
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
