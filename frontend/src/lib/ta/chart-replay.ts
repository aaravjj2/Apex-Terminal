/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Chart Replay Engine                                │
 * │  Tick-by-tick historical replay, speed control, bookmarks,          │
 * │  snapshot capture, multi-timeframe sync, and order simulation       │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/* ── Types ───────────────────────────────────────────────────────────── */
export interface ReplayCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayTick {
  time: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell' | 'unknown';
}

export interface ReplayBookmark {
  id: string;
  name: string;
  time: number;
  index: number;
  notes: string;
  screenshot?: string; // base64 data URL
  orders: SimulatedOrder[];
}

export interface SimulatedOrder {
  id: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop-limit';
  price: number;
  quantity: number;
  time: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  fillPrice?: number;
  fillTime?: number;
  pnl?: number;
}

export interface ReplayPosition {
  symbol: string;
  side: 'long' | 'short' | 'flat';
  qty: number;
  avgEntry: number;
  unrealizedPnl: number;
  realizedPnl: number;
  fills: SimulatedOrder[];
}

export interface ReplayStats {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalPnl: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldTime: number; // in bars
  expectancy: number;
}

export type ReplaySpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8 | 16 | 32;
export type ReplayState = 'stopped' | 'playing' | 'paused' | 'finished';
export type TimeframeId = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';

export interface TimeframeConfig {
  id: TimeframeId;
  label: string;
  minutes: number;
  maxBars: number;
}

export interface ReplayConfig {
  symbol: string;
  startTime: number;
  endTime: number;
  timeframe: TimeframeId;
  speed: ReplaySpeed;
  initialCapital: number;
  commission: number; // per share
  slippage: number; // in price units
  enableSound: boolean;
  showVolume: boolean;
  showVWAP: boolean;
  autoScaleY: boolean;
}

export interface ReplaySnapshot {
  index: number;
  time: number;
  visibleBars: ReplayCandle[];
  position: ReplayPosition;
  orders: SimulatedOrder[];
  equity: number;
  stats: ReplayStats;
}

/* ── Constants ───────────────────────────────────────────────────────── */
export const TIMEFRAMES: TimeframeConfig[] = [
  { id: '1m',  label: '1 Minute',   minutes: 1,     maxBars: 1440 },
  { id: '5m',  label: '5 Minutes',  minutes: 5,     maxBars: 1440 },
  { id: '15m', label: '15 Minutes', minutes: 15,    maxBars: 1440 },
  { id: '1h',  label: '1 Hour',     minutes: 60,    maxBars: 720 },
  { id: '4h',  label: '4 Hours',    minutes: 240,   maxBars: 500 },
  { id: '1D',  label: 'Daily',      minutes: 1440,  maxBars: 365 },
  { id: '1W',  label: 'Weekly',     minutes: 10080, maxBars: 104 },
];

export const SPEEDS: ReplaySpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

/* ── ID generation ───────────────────────────────────────────────────── */
let _counter = 0;
function uid(): string { return `r${Date.now()}-${++_counter}`; }

/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 1: REPLAY ENGINE CORE                                        */
/* ══════════════════════════════════════════════════════════════════════ */

export class ReplayEngine {
  private data: ReplayCandle[] = [];
  private currentIndex = 0;
  private state: ReplayState = 'stopped';
  private speed: ReplaySpeed = 1;
  private config: ReplayConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bookmarks: ReplayBookmark[] = [];
  private orders: SimulatedOrder[] = [];
  private position: ReplayPosition;
  private equity: number;
  private equityCurve: { time: number; equity: number }[] = [];
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private tradeHistory: SimulatedOrder[] = [];
  private peakEquity = 0;
  private maxDrawdown = 0;
  private consecutiveWins = 0;
  private consecutiveLosses = 0;
  private maxConsecutiveWins = 0;
  private maxConsecutiveLosses = 0;

  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = {
      symbol: 'SPY',
      startTime: Date.now() - 30 * 86400_000,
      endTime: Date.now(),
      timeframe: '1D',
      speed: 1,
      initialCapital: 100_000,
      commission: 0.005,
      slippage: 0.01,
      enableSound: false,
      showVolume: true,
      showVWAP: true,
      autoScaleY: true,
      ...config,
    };
    this.speed = this.config.speed;
    this.equity = this.config.initialCapital;
    this.peakEquity = this.equity;
    this.position = this.createFlatPosition();
  }

  /* ── Data Loading ───────────────────────────────────────────────── */
  loadData(candles: ReplayCandle[]): void {
    this.data = [...candles].sort((a, b) => a.time - b.time);
    this.currentIndex = 0;
    this.state = 'stopped';
    this.emit('dataLoaded', { bars: this.data.length });
  }

  generateDemoData(bars = 200): void {
    const data: ReplayCandle[] = [];
    let price = 450;
    const baseTime = this.config.startTime;
    const tf = TIMEFRAMES.find(t => t.id === this.config.timeframe) || TIMEFRAMES[5];

    for (let i = 0; i < bars; i++) {
      const volatility = 0.008 + Math.random() * 0.012;
      const drift = (Math.random() - 0.48) * 0.002;
      const open = price;
      const noise1 = (Math.random() - 0.5) * 2 * volatility * price;
      const noise2 = (Math.random() - 0.5) * 2 * volatility * price;
      const close = open + drift * price + noise1;
      const high = Math.max(open, close) + Math.abs(noise2) * 0.5;
      const low = Math.min(open, close) - Math.abs(noise2) * 0.5;
      const volume = Math.floor(5_000_000 + Math.random() * 10_000_000 + (Math.abs(noise1) / price) * 50_000_000);

      data.push({
        time: baseTime + i * tf.minutes * 60_000,
        open: +open.toFixed(2), high: +high.toFixed(2),
        low: +low.toFixed(2), close: +close.toFixed(2),
        volume,
      });
      price = close;
    }
    this.loadData(data);
  }

  /* ── Playback Controls ─────────────────────────────────────────── */
  play(): void {
    if (this.state === 'playing') return;
    if (this.currentIndex >= this.data.length - 1) {
      this.state = 'finished';
      this.emit('finished', this.getStats());
      return;
    }
    this.state = 'playing';
    this.startTimer();
    this.emit('stateChange', { state: this.state });
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.stopTimer();
    this.emit('stateChange', { state: this.state });
  }

  stop(): void {
    this.state = 'stopped';
    this.stopTimer();
    this.currentIndex = 0;
    this.resetPosition();
    this.emit('stateChange', { state: this.state });
  }

  stepForward(bars = 1): void {
    for (let i = 0; i < bars; i++) {
      if (this.currentIndex >= this.data.length - 1) {
        this.state = 'finished';
        this.emit('finished', this.getStats());
        break;
      }
      this.currentIndex++;
      this.processBar(this.data[this.currentIndex]);
    }
    this.emit('tick', this.getCurrentState());
  }

  stepBackward(bars = 1): void {
    this.currentIndex = Math.max(0, this.currentIndex - bars);
    this.recalculateFromStart();
    this.emit('tick', this.getCurrentState());
  }

  jumpToIndex(index: number): void {
    this.currentIndex = Math.max(0, Math.min(this.data.length - 1, index));
    this.recalculateFromStart();
    this.emit('tick', this.getCurrentState());
  }

  jumpToTime(time: number): void {
    const idx = this.data.findIndex(d => d.time >= time);
    if (idx >= 0) this.jumpToIndex(idx);
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
    if (this.state === 'playing') {
      this.stopTimer();
      this.startTimer();
    }
    this.emit('speedChange', { speed });
  }

  private startTimer(): void {
    const intervalMs = Math.max(16, 1000 / this.speed);
    this.timer = setInterval(() => {
      if (this.currentIndex >= this.data.length - 1) {
        this.state = 'finished';
        this.stopTimer();
        this.emit('finished', this.getStats());
        return;
      }
      this.currentIndex++;
      this.processBar(this.data[this.currentIndex]);
      this.emit('tick', this.getCurrentState());
    }, intervalMs);
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /* ── Bar Processing ─────────────────────────────────────────────── */
  private processBar(bar: ReplayCandle): void {
    // Check pending orders against this bar
    for (const order of this.orders) {
      if (order.status !== 'pending') continue;
      this.checkOrderFill(order, bar);
    }

    // Update position P&L
    if (this.position.side !== 'flat') {
      const price = bar.close;
      const multiplier = this.position.side === 'long' ? 1 : -1;
      this.position.unrealizedPnl = (price - this.position.avgEntry) * this.position.qty * multiplier;
    }

    // Update equity curve
    const totalPnl = this.position.realizedPnl + this.position.unrealizedPnl;
    this.equity = this.config.initialCapital + totalPnl;
    if (this.equity > this.peakEquity) this.peakEquity = this.equity;
    const dd = (this.peakEquity - this.equity) / this.peakEquity;
    if (dd > this.maxDrawdown) this.maxDrawdown = dd;

    this.equityCurve.push({ time: bar.time, equity: this.equity });
  }

  private checkOrderFill(order: SimulatedOrder, bar: ReplayCandle): void {
    let fillPrice: number | null = null;

    switch (order.type) {
      case 'market':
        fillPrice = order.side === 'buy' ? bar.open + this.config.slippage : bar.open - this.config.slippage;
        break;
      case 'limit':
        if (order.side === 'buy' && bar.low <= order.price) fillPrice = Math.min(order.price, bar.open);
        if (order.side === 'sell' && bar.high >= order.price) fillPrice = Math.max(order.price, bar.open);
        break;
      case 'stop':
        if (order.side === 'buy' && bar.high >= order.price) fillPrice = Math.max(order.price, bar.open) + this.config.slippage;
        if (order.side === 'sell' && bar.low <= order.price) fillPrice = Math.min(order.price, bar.open) - this.config.slippage;
        break;
      case 'stop-limit':
        if (order.side === 'buy' && bar.high >= order.price) fillPrice = order.price;
        if (order.side === 'sell' && bar.low <= order.price) fillPrice = order.price;
        break;
    }

    if (fillPrice !== null) {
      order.status = 'filled';
      order.fillPrice = +fillPrice.toFixed(2);
      order.fillTime = bar.time;
      const commission = order.quantity * this.config.commission;
      this.applyFill(order, commission);
      this.emit('orderFilled', order);
    }
  }

  private applyFill(order: SimulatedOrder, commission: number): void {
    const fp = order.fillPrice!;
    const qty = order.quantity;

    if (this.position.side === 'flat') {
      // Open new position
      this.position.side = order.side === 'buy' ? 'long' : 'short';
      this.position.qty = qty;
      this.position.avgEntry = fp;
      this.position.fills.push(order);
    } else if (
      (this.position.side === 'long' && order.side === 'sell') ||
      (this.position.side === 'short' && order.side === 'buy')
    ) {
      // Close or reduce position
      const closedQty = Math.min(qty, this.position.qty);
      const multiplier = this.position.side === 'long' ? 1 : -1;
      const pnl = (fp - this.position.avgEntry) * closedQty * multiplier - commission;
      this.position.realizedPnl += pnl;
      order.pnl = pnl;
      this.tradeHistory.push(order);

      // Track consecutive wins/losses
      if (pnl > 0) {
        this.consecutiveWins++;
        this.consecutiveLosses = 0;
        if (this.consecutiveWins > this.maxConsecutiveWins) this.maxConsecutiveWins = this.consecutiveWins;
      } else {
        this.consecutiveLosses++;
        this.consecutiveWins = 0;
        if (this.consecutiveLosses > this.maxConsecutiveLosses) this.maxConsecutiveLosses = this.consecutiveLosses;
      }

      this.position.qty -= closedQty;
      if (this.position.qty === 0) {
        this.position.side = 'flat';
        this.position.avgEntry = 0;
        this.position.unrealizedPnl = 0;
      }

      // If qty > position qty, flip
      if (qty > closedQty) {
        const remaining = qty - closedQty;
        this.position.side = order.side === 'buy' ? 'long' : 'short';
        this.position.qty = remaining;
        this.position.avgEntry = fp;
      }
      this.position.fills.push(order);
    } else {
      // Add to existing position
      const totalCost = this.position.avgEntry * this.position.qty + fp * qty;
      this.position.qty += qty;
      this.position.avgEntry = totalCost / this.position.qty;
      this.position.fills.push(order);
    }
  }

  /* ── Order Management ───────────────────────────────────────────── */
  placeOrder(side: 'buy' | 'sell', type: SimulatedOrder['type'], quantity: number, price?: number): SimulatedOrder {
    const bar = this.data[this.currentIndex];
    const order: SimulatedOrder = {
      id: uid(),
      side,
      type,
      price: price ?? bar?.close ?? 0,
      quantity,
      time: bar?.time ?? 0,
      status: 'pending',
    };
    this.orders.push(order);

    // Market orders fill immediately on current bar
    if (type === 'market' && bar) {
      this.checkOrderFill(order, bar);
    }

    this.emit('orderPlaced', order);
    return order;
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return false;
    order.status = 'cancelled';
    this.emit('orderCancelled', order);
    return true;
  }

  cancelAllOrders(): number {
    let count = 0;
    for (const order of this.orders) {
      if (order.status === 'pending') { order.status = 'cancelled'; count++; }
    }
    return count;
  }

  flattenPosition(): SimulatedOrder | null {
    if (this.position.side === 'flat' || this.position.qty === 0) return null;
    const side = this.position.side === 'long' ? 'sell' : 'buy';
    return this.placeOrder(side, 'market', this.position.qty);
  }

  /* ── Bookmarks ──────────────────────────────────────────────────── */
  addBookmark(name: string, notes = ''): ReplayBookmark {
    const bm: ReplayBookmark = {
      id: uid(), name, notes,
      time: this.data[this.currentIndex]?.time ?? 0,
      index: this.currentIndex,
      orders: [...this.orders],
    };
    this.bookmarks.push(bm);
    this.emit('bookmarkAdded', bm);
    return bm;
  }

  removeBookmark(id: string): boolean {
    const idx = this.bookmarks.findIndex(b => b.id === id);
    if (idx < 0) return false;
    this.bookmarks.splice(idx, 1);
    return true;
  }

  jumpToBookmark(id: string): boolean {
    const bm = this.bookmarks.find(b => b.id === id);
    if (!bm) return false;
    this.jumpToIndex(bm.index);
    return true;
  }

  getBookmarks(): ReplayBookmark[] { return [...this.bookmarks]; }

  /* ── Snapshots ──────────────────────────────────────────────────── */
  takeSnapshot(): ReplaySnapshot {
    const visibleStart = Math.max(0, this.currentIndex - 100);
    return {
      index: this.currentIndex,
      time: this.data[this.currentIndex]?.time ?? 0,
      visibleBars: this.data.slice(visibleStart, this.currentIndex + 1),
      position: { ...this.position, fills: [...this.position.fills] },
      orders: this.orders.filter(o => o.status === 'pending'),
      equity: this.equity,
      stats: this.getStats(),
    };
  }

  /* ── Statistics ─────────────────────────────────────────────────── */
  getStats(): ReplayStats {
    const wins = this.tradeHistory.filter(t => (t.pnl ?? 0) > 0);
    const losses = this.tradeHistory.filter(t => (t.pnl ?? 0) <= 0);
    const totalPnl = this.tradeHistory.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length) : 0;
    const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));

    // Sharpe from equity curve
    const returns: number[] = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prev = this.equityCurve[i - 1].equity;
      const curr = this.equityCurve[i].equity;
      returns.push((curr - prev) / prev);
    }
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 1 ?
      Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1)) : 1;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    // Average hold time (in bars)
    let avgHoldTime = 0;
    const closedFills = this.tradeHistory.filter(t => t.fillTime);
    if (closedFills.length > 0) {
      const totalHold = closedFills.reduce((s, t) => s + ((t.fillTime ?? 0) - t.time), 0);
      avgHoldTime = totalHold / closedFills.length;
    }

    const expectancy = this.tradeHistory.length > 0 ? totalPnl / this.tradeHistory.length : 0;

    return {
      totalTrades: this.tradeHistory.length,
      winRate: this.tradeHistory.length > 0 ? (wins.length / this.tradeHistory.length) * 100 : 0,
      avgWin, avgLoss,
      maxDrawdown: +(this.maxDrawdown * 100).toFixed(2),
      sharpeRatio: +sharpeRatio.toFixed(3),
      profitFactor: totalLosses > 0 ? +(totalWins / totalLosses).toFixed(3) : totalWins > 0 ? Infinity : 0,
      totalPnl: +totalPnl.toFixed(2),
      maxConsecutiveWins: this.maxConsecutiveWins,
      maxConsecutiveLosses: this.maxConsecutiveLosses,
      avgHoldTime: +avgHoldTime.toFixed(0),
      expectancy: +expectancy.toFixed(2),
    };
  }

  /* ── State Getters ──────────────────────────────────────────────── */
  getCurrentState() {
    const bar = this.data[this.currentIndex];
    return {
      index: this.currentIndex,
      totalBars: this.data.length,
      bar,
      state: this.state,
      speed: this.speed,
      position: { ...this.position },
      equity: this.equity,
      pendingOrders: this.orders.filter(o => o.status === 'pending'),
      progress: this.data.length > 0 ? (this.currentIndex / (this.data.length - 1)) * 100 : 0,
    };
  }

  getVisibleBars(count = 100): ReplayCandle[] {
    const start = Math.max(0, this.currentIndex - count + 1);
    return this.data.slice(start, this.currentIndex + 1);
  }

  getEquityCurve() { return [...this.equityCurve]; }
  getData() { return [...this.data]; }
  getPosition() { return { ...this.position }; }
  getOrders() { return [...this.orders]; }
  getConfig() { return { ...this.config }; }
  getState() { return this.state; }
  getSpeed() { return this.speed; }
  getCurrentIndex() { return this.currentIndex; }
  getCurrentBar() { return this.data[this.currentIndex] ?? null; }

  /* ── Internal ───────────────────────────────────────────────────── */
  private createFlatPosition(): ReplayPosition {
    return {
      symbol: this.config.symbol,
      side: 'flat', qty: 0, avgEntry: 0,
      unrealizedPnl: 0, realizedPnl: 0, fills: [],
    };
  }

  private resetPosition(): void {
    this.position = this.createFlatPosition();
    this.orders = [];
    this.tradeHistory = [];
    this.equityCurve = [];
    this.equity = this.config.initialCapital;
    this.peakEquity = this.equity;
    this.maxDrawdown = 0;
    this.consecutiveWins = 0;
    this.consecutiveLosses = 0;
    this.maxConsecutiveWins = 0;
    this.maxConsecutiveLosses = 0;
  }

  private recalculateFromStart(): void {
    const savedOrders = [...this.orders];
    this.resetPosition();
    for (let i = 0; i <= this.currentIndex; i++) {
      // Re-place orders that were placed before this index
      for (const order of savedOrders) {
        if (order.time === this.data[i]?.time && order.status === 'pending') {
          this.orders.push(order);
        }
      }
      this.processBar(this.data[i]);
    }
  }

  /* ── Event System ───────────────────────────────────────────────── */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => { this.listeners.get(event)?.delete(callback); };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  destroy(): void {
    this.stopTimer();
    this.listeners.clear();
  }
}


/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 2: MULTI-TIMEFRAME SYNC                                      */
/* ══════════════════════════════════════════════════════════════════════ */

export class MultiTimeframeSync {
  private engines: Map<TimeframeId, ReplayEngine> = new Map();
  private primaryTf: TimeframeId;
  private masterIndex = 0;

  constructor(config: Partial<ReplayConfig>, timeframes: TimeframeId[] = ['1D', '1h', '15m']) {
    this.primaryTf = timeframes[0];
    for (const tf of timeframes) {
      const engine = new ReplayEngine({ ...config, timeframe: tf });
      this.engines.set(tf, engine);
    }
  }

  loadData(timeframe: TimeframeId, candles: ReplayCandle[]): void {
    this.engines.get(timeframe)?.loadData(candles);
  }

  generateAllDemo(bars: Record<TimeframeId, number>): void {
    for (const [tf, count] of Object.entries(bars)) {
      const engine = this.engines.get(tf as TimeframeId);
      if (engine) engine.generateDemoData(count);
    }
  }

  syncToTime(time: number): void {
    for (const [, engine] of this.engines) {
      engine.jumpToTime(time);
    }
  }

  stepPrimary(bars = 1): void {
    const primary = this.engines.get(this.primaryTf);
    if (!primary) return;
    primary.stepForward(bars);
    const currentBar = primary.getCurrentBar();
    if (!currentBar) return;

    // Sync secondary timeframes to primary time
    for (const [tf, engine] of this.engines) {
      if (tf === this.primaryTf) continue;
      engine.jumpToTime(currentBar.time);
    }
    this.masterIndex++;
  }

  getEngine(tf: TimeframeId): ReplayEngine | undefined {
    return this.engines.get(tf);
  }

  getAllStates() {
    const states: Record<string, ReturnType<ReplayEngine['getCurrentState']>> = {};
    for (const [tf, engine] of this.engines) {
      states[tf] = engine.getCurrentState();
    }
    return states;
  }

  destroy(): void {
    for (const [, engine] of this.engines) engine.destroy();
    this.engines.clear();
  }
}


/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 3: CANDLE AGGREGATION UTILITIES                              */
/* ══════════════════════════════════════════════════════════════════════ */

/**
 * Aggregate minute-level data into any timeframe
 */
export function aggregateCandles(minuteData: ReplayCandle[], targetMinutes: number): ReplayCandle[] {
  if (minuteData.length === 0) return [];
  if (targetMinutes <= 1) return [...minuteData];

  const result: ReplayCandle[] = [];
  let current: ReplayCandle | null = null;
  const msInterval = targetMinutes * 60_000;

  for (const bar of minuteData) {
    const bucket = Math.floor(bar.time / msInterval) * msInterval;
    if (!current || current.time !== bucket) {
      if (current) result.push(current);
      current = { time: bucket, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume;
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Generate synthetic ticks from OHLCV candle
 */
export function generateTicksFromCandle(candle: ReplayCandle, tickCount = 20): ReplayTick[] {
  const ticks: ReplayTick[] = [];
  const duration = 60_000; // 1 minute in ms
  const { open, high, low, close, time, volume } = candle;
  const volPerTick = Math.floor(volume / tickCount);

  // Path: open → random walk hitting high/low → close
  const prices: number[] = [open];
  const midIdx = Math.floor(tickCount / 2);

  for (let i = 1; i < tickCount; i++) {
    if (i === midIdx) {
      // Hit the extreme
      prices.push(open < close ? high : low);
    } else if (i === tickCount - 1) {
      prices.push(close);
    } else {
      const prev = prices[prices.length - 1];
      const target = i < midIdx ? (open < close ? high : low) : close;
      const progress = i < midIdx ? i / midIdx : (i - midIdx) / (tickCount - midIdx);
      const noise = (Math.random() - 0.5) * (high - low) * 0.1;
      prices.push(prev + (target - prev) * progress * 0.3 + noise);
    }
  }

  // Clamp prices to high/low range
  for (let i = 0; i < prices.length; i++) {
    prices[i] = Math.max(low, Math.min(high, prices[i]));
    const tickTime = time + Math.floor((i / tickCount) * duration);
    const side: ReplayTick['side'] = i > 0 && prices[i] > prices[i - 1] ? 'buy'
      : i > 0 && prices[i] < prices[i - 1] ? 'sell' : 'unknown';
    ticks.push({
      time: tickTime,
      price: +prices[i].toFixed(2),
      volume: volPerTick + Math.floor(Math.random() * volPerTick * 0.5),
      side,
    });
  }
  return ticks;
}


/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 4: REPLAY INDICATORS (computed on visible bars only)         */
/* ══════════════════════════════════════════════════════════════════════ */

export function computeVWAP(candles: ReplayCandle[]): number[] {
  const vwap: number[] = [];
  let cumVol = 0;
  let cumTP = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumTP += tp * c.volume;
    vwap.push(cumVol > 0 ? cumTP / cumVol : tp);
  }
  return vwap;
}

export function computeReplaySMA(candles: ReplayCandle[], period: number): number[] {
  const closes = candles.map(c => c.close);
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function computeReplayEMA(candles: ReplayCandle[], period: number): number[] {
  const closes = candles.map(c => c.close);
  const result: number[] = [];
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { result.push(closes[0]); continue; }
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function computeReplayBollingerBands(candles: ReplayCandle[], period = 20, stdDevMultiplier = 2) {
  const middle = computeReplaySMA(candles, period);
  const closes = candles.map(c => c.close);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = middle[i];
    const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(avg + std * stdDevMultiplier);
    lower.push(avg - std * stdDevMultiplier);
  }

  return { upper, middle, lower };
}

export function computeReplayRSI(candles: ReplayCandle[], period = 14): number[] {
  const closes = candles.map(c => c.close);
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { rsi.push(50); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) {
        rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
      } else {
        rsi.push(50);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
  }
  return rsi;
}

export function computeReplayATR(candles: ReplayCandle[], period = 14): number[] {
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });

  const result: number[] = [];
  let atrVal = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < period) {
      atrVal += tr[i] / period;
      result.push(i === period - 1 ? atrVal : NaN);
    } else {
      atrVal = (atrVal * (period - 1) + tr[i]) / period;
      result.push(atrVal);
    }
  }
  return result;
}


/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 5: REPLAY CANVAS RENDERER                                    */
/* ══════════════════════════════════════════════════════════════════════ */

export interface ReplayRenderConfig {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  colors: {
    background: string;
    grid: string;
    text: string;
    bullish: string;
    bearish: string;
    vwap: string;
    ema: string;
    volume: string;
    crosshair: string;
    orderBuy: string;
    orderSell: string;
    position: string;
  };
  showGrid: boolean;
  showVolume: boolean;
  showVWAP: boolean;
  showCrosshair: boolean;
  candleWidth: number;
  candleGap: number;
}

const DEFAULT_RENDER_CONFIG: ReplayRenderConfig = {
  width: 800, height: 500,
  padding: { top: 20, right: 60, bottom: 40, left: 60 },
  colors: {
    background: '#0a0e17',
    grid: '#1a1f2e',
    text: '#8892a4',
    bullish: '#00c176',
    bearish: '#ff3b5c',
    vwap: '#ffaa00',
    ema: '#4da6ff',
    volume: '#2a3040',
    crosshair: '#3a4050',
    orderBuy: '#00c176',
    orderSell: '#ff3b5c',
    position: '#ff9800',
  },
  showGrid: true, showVolume: true, showVWAP: true, showCrosshair: true,
  candleWidth: 6, candleGap: 2,
};

export function renderReplayChart(
  ctx: CanvasRenderingContext2D,
  bars: ReplayCandle[],
  config: Partial<ReplayRenderConfig> = {},
  overlays?: {
    vwap?: number[];
    ema20?: number[];
    orders?: SimulatedOrder[];
    position?: ReplayPosition;
  }
): void {
  const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };
  const { width, height, padding: p, colors } = cfg;
  const chartW = width - p.left - p.right;
  const chartH = height - p.top - p.bottom;
  const volumeH = cfg.showVolume ? chartH * 0.2 : 0;
  const priceH = chartH - volumeH;

  // Background
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  if (bars.length === 0) {
    ctx.fillStyle = colors.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No data — press Play or load data', width / 2, height / 2);
    return;
  }

  // Price range
  const minPrice = Math.min(...bars.map(b => b.low)) * 0.999;
  const maxPrice = Math.max(...bars.map(b => b.high)) * 1.001;
  const priceRange = maxPrice - minPrice || 1;
  const maxVol = Math.max(...bars.map(b => b.volume)) || 1;

  const toX = (i: number) => p.left + (i / (bars.length - 1 || 1)) * chartW;
  const toY = (price: number) => p.top + (1 - (price - minPrice) / priceRange) * priceH;
  const toVolY = (vol: number) => height - p.bottom - (vol / maxVol) * volumeH;

  // Grid
  if (cfg.showGrid) {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const y = p.top + (i / priceSteps) * priceH;
      ctx.beginPath(); ctx.moveTo(p.left, y); ctx.lineTo(width - p.right, y); ctx.stroke();
      const price = maxPrice - (i / priceSteps) * priceRange;
      ctx.fillStyle = colors.text;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), p.left - 5, y + 3);
    }
  }

  // Volume bars
  if (cfg.showVolume) {
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const x = toX(i);
      const w = Math.max(1, cfg.candleWidth);
      const vy = toVolY(bar.volume);
      ctx.fillStyle = isBullish(bar) ? colors.bullish + '30' : colors.bearish + '30';
      ctx.fillRect(x - w / 2, vy, w, height - p.bottom - vy);
    }
  }

  // Candles
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const x = toX(i);
    const w = Math.max(1, cfg.candleWidth);
    const bull = isBullish(bar);
    const color = bull ? colors.bullish : colors.bearish;

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(bar.high));
    ctx.lineTo(x, toY(bar.low));
    ctx.stroke();

    // Body
    const bodyTop = toY(Math.max(bar.open, bar.close));
    const bodyBottom = toY(Math.min(bar.open, bar.close));
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, bodyTop, w, Math.max(1, bodyBottom - bodyTop));
  }

  // VWAP overlay
  if (cfg.showVWAP && overlays?.vwap) {
    ctx.strokeStyle = colors.vwap;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    for (let i = 0; i < overlays.vwap.length; i++) {
      const x = toX(i);
      const y = toY(overlays.vwap[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // EMA overlay
  if (overlays?.ema20) {
    ctx.strokeStyle = colors.ema;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < overlays.ema20.length; i++) {
      if (isNaN(overlays.ema20[i])) continue;
      const x = toX(i);
      const y = toY(overlays.ema20[i]);
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      started = true;
    }
    ctx.stroke();
  }

  // Order markers
  if (overlays?.orders) {
    for (const order of overlays.orders) {
      if (order.status !== 'pending') continue;
      const y = toY(order.price);
      ctx.strokeStyle = order.side === 'buy' ? colors.orderBuy : colors.orderSell;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(width - p.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = order.side === 'buy' ? colors.orderBuy : colors.orderSell;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${order.side.toUpperCase()} ${order.type} @ ${order.price.toFixed(2)}`, p.left + 5, y - 3);
    }
  }

  // Position line
  if (overlays?.position && overlays.position.side !== 'flat') {
    const y = toY(overlays.position.avgEntry);
    ctx.strokeStyle = colors.position;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(p.left, y);
    ctx.lineTo(width - p.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = colors.position;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const label = `${overlays.position.side.toUpperCase()} ${overlays.position.qty} @ ${overlays.position.avgEntry.toFixed(2)}`;
    ctx.fillText(label, width - p.right - 5, y - 4);
  }

  // Current price label (right axis)
  const lastBar = bars[bars.length - 1];
  if (lastBar) {
    const y = toY(lastBar.close);
    const bull = isBullish(lastBar);
    ctx.fillStyle = bull ? colors.bullish : colors.bearish;
    ctx.fillRect(width - p.right, y - 8, p.right, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(lastBar.close.toFixed(2), width - p.right / 2, y + 3);
  }

  // Time axis (simplified)
  ctx.fillStyle = colors.text;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  const timeSteps = Math.min(8, bars.length);
  for (let i = 0; i < timeSteps; i++) {
    const idx = Math.floor((i / (timeSteps - 1)) * (bars.length - 1));
    const bar = bars[idx];
    if (!bar) continue;
    const x = toX(idx);
    const date = new Date(bar.time);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    ctx.fillText(label, x, height - p.bottom + 15);
  }
}


/* ══════════════════════════════════════════════════════════════════════ */
/* SECTION 6: COMPARISON / EXPORT UTILITIES                             */
/* ══════════════════════════════════════════════════════════════════════ */

export interface ReplayComparison {
  symbol: string;
  stats: ReplayStats;
  equityCurve: { time: number; equity: number }[];
}

/**
 * Compare stats of multiple replay runs
 */
export function compareReplays(replays: ReplayComparison[]) {
  if (replays.length === 0) return null;
  
  const best = {
    winRate: replays.reduce((a, b) => a.stats.winRate > b.stats.winRate ? a : b),
    sharpe: replays.reduce((a, b) => a.stats.sharpeRatio > b.stats.sharpeRatio ? a : b),
    profitFactor: replays.reduce((a, b) => a.stats.profitFactor > b.stats.profitFactor ? a : b),
    totalPnl: replays.reduce((a, b) => a.stats.totalPnl > b.stats.totalPnl ? a : b),
    minDrawdown: replays.reduce((a, b) => a.stats.maxDrawdown < b.stats.maxDrawdown ? a : b),
  };

  return {
    runs: replays.length,
    best,
    averages: {
      winRate: +(replays.reduce((s, r) => s + r.stats.winRate, 0) / replays.length).toFixed(1),
      sharpe: +(replays.reduce((s, r) => s + r.stats.sharpeRatio, 0) / replays.length).toFixed(3),
      profitFactor: +(replays.reduce((s, r) => s + r.stats.profitFactor, 0) / replays.length).toFixed(3),
      totalPnl: +(replays.reduce((s, r) => s + r.stats.totalPnl, 0) / replays.length).toFixed(2),
      maxDrawdown: +(replays.reduce((s, r) => s + r.stats.maxDrawdown, 0) / replays.length).toFixed(2),
    },
  };
}

/**
 * Export replay data as CSV
 */
export function exportReplayCSV(engine: ReplayEngine): string {
  const data = engine.getData();
  const stats = engine.getStats();
  const orders = engine.getOrders();

  const lines: string[] = [
    '# Replay Export',
    `# Symbol: ${engine.getConfig().symbol}`,
    `# Total Trades: ${stats.totalTrades}`,
    `# Win Rate: ${stats.winRate.toFixed(1)}%`,
    `# Sharpe: ${stats.sharpeRatio}`,
    `# P&L: ${stats.totalPnl}`,
    '',
    '## OHLCV Data',
    'time,open,high,low,close,volume',
    ...data.map(d => `${d.time},${d.open},${d.high},${d.low},${d.close},${d.volume}`),
    '',
    '## Orders',
    'id,side,type,price,quantity,status,fillPrice,fillTime,pnl',
    ...orders.filter(o => o.status === 'filled').map(o =>
      `${o.id},${o.side},${o.type},${o.price},${o.quantity},${o.status},${o.fillPrice ?? ''},${o.fillTime ?? ''},${o.pnl ?? ''}`
    ),
    '',
    '## Equity Curve',
    'time,equity',
    ...engine.getEquityCurve().map(e => `${e.time},${e.equity.toFixed(2)}`),
  ];

  return lines.join('\n');
}

/**
 * Export replay data as JSON
 */
export function exportReplayJSON(engine: ReplayEngine): string {
  return JSON.stringify({
    config: engine.getConfig(),
    stats: engine.getStats(),
    position: engine.getPosition(),
    orders: engine.getOrders().filter(o => o.status === 'filled'),
    equityCurve: engine.getEquityCurve(),
    bookmarks: engine.getBookmarks(),
    dataLength: engine.getData().length,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}
