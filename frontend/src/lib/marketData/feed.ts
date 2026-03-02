import {
  type Quote,
  type Trade,
  type Bar,
  type Level1,
  type Level2,
  type Level2Entry,
  type Subscription,
  type FeedConfig,
  type DataQualityIssue,
  type MarketDataLevel,
  type ExchangeInfo,
  Exchange,
  MarketStatus,
  TimeFrame,
  DEFAULT_FEED_CONFIG,
} from './types';

// ─── Symbol Resolver ────────────────────────────────────────────────────────

type SymbolMapping = { canonical: string; aliases: string[] };

export class SymbolResolver {
  private canonicalMap = new Map<string, string>();
  private exchangeFormats = new Map<string, (symbol: string) => string>();

  register(mapping: SymbolMapping): void {
    this.canonicalMap.set(mapping.canonical.toUpperCase(), mapping.canonical);
    for (const alias of mapping.aliases) {
      this.canonicalMap.set(alias.toUpperCase(), mapping.canonical);
    }
  }

  registerExchangeFormat(exchange: string, formatter: (symbol: string) => string): void {
    this.exchangeFormats.set(exchange, formatter);
  }

  resolve(symbol: string): string {
    return this.canonicalMap.get(symbol.toUpperCase()) ?? symbol.toUpperCase();
  }

  formatForExchange(symbol: string, exchange: string): string {
    const canonical = this.resolve(symbol);
    const fmt = this.exchangeFormats.get(exchange);
    return fmt ? fmt(canonical) : canonical;
  }
}

// ─── Data Quality Validator ─────────────────────────────────────────────────

interface PriceStats {
  mean: number;
  stdDev: number;
  lastUpdate: number;
  count: number;
}

export class DataQualityValidator {
  private stats = new Map<string, PriceStats>();
  private config: FeedConfig;

  constructor(config: FeedConfig) {
    this.config = config;
  }

  updateStats(symbol: string, price: number): void {
    const existing = this.stats.get(symbol);
    if (!existing) {
      this.stats.set(symbol, { mean: price, stdDev: 0, lastUpdate: Date.now(), count: 1 });
      return;
    }
    const n = existing.count + 1;
    const delta = price - existing.mean;
    const newMean = existing.mean + delta / n;
    const delta2 = price - newMean;
    const newVar = ((existing.stdDev ** 2) * (n - 2) + delta * delta2) / Math.max(n - 1, 1);
    existing.mean = newMean;
    existing.stdDev = Math.sqrt(Math.max(0, newVar));
    existing.lastUpdate = Date.now();
    existing.count = n;
  }

  isStale(symbol: string): boolean {
    const s = this.stats.get(symbol);
    return !!s && Date.now() - s.lastUpdate > this.config.staleThresholdMs;
  }

  isOutlier(symbol: string, price: number): boolean {
    const s = this.stats.get(symbol);
    if (!s || s.count < 20 || s.stdDev === 0) return false;
    return Math.abs(price - s.mean) > this.config.outlierStdDevMultiple * s.stdDev;
  }

  validate(symbol: string, price: number, size: number): DataQualityIssue | null {
    if (price <= 0 || !isFinite(price)) {
      return {
        type: 'INVALID',
        timestamp: Date.now(),
        description: `Invalid price ${price} for ${symbol}`,
        severity: 'ERROR',
      };
    }
    if (size < 0 || !isFinite(size)) {
      return {
        type: 'INVALID',
        timestamp: Date.now(),
        description: `Invalid size ${size} for ${symbol}`,
        severity: 'ERROR',
      };
    }
    if (this.isOutlier(symbol, price)) {
      return {
        type: 'OUTLIER',
        timestamp: Date.now(),
        description: `Outlier price ${price} for ${symbol} (mean=${this.stats.get(symbol)!.mean.toFixed(2)})`,
        severity: 'WARNING',
      };
    }
    if (this.isStale(symbol)) {
      return {
        type: 'STALE',
        timestamp: Date.now(),
        description: `Stale data for ${symbol}`,
        severity: 'WARNING',
      };
    }
    this.updateStats(symbol, price);
    return null;
  }
}

// ─── Exchange Calendar ──────────────────────────────────────────────────────

export class ExchangeCalendar {
  private exchanges = new Map<Exchange, ExchangeInfo>();

  register(info: ExchangeInfo): void {
    this.exchanges.set(info.code, info);
  }

  getStatus(exchange: Exchange, at: Date = new Date()): MarketStatus {
    const info = this.exchanges.get(exchange);
    if (!info) return MarketStatus.CLOSED;

    const dateStr = at.toISOString().slice(0, 10);
    if (info.holidays.includes(dateStr)) return MarketStatus.HOLIDAY;

    const dayOfWeek = at.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return MarketStatus.CLOSED;

    const timeStr = at.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: info.timezone,
      hour: '2-digit',
      minute: '2-digit',
    });

    const earlyClose = info.earlyCloses[dateStr];

    for (const session of info.sessions) {
      if (timeStr >= session.open && timeStr < (earlyClose ?? session.close)) {
        if (session.isPreMarket) return MarketStatus.PRE_MARKET;
        if (session.isPostMarket) return MarketStatus.POST_MARKET;
        return earlyClose ? MarketStatus.EARLY_CLOSE : MarketStatus.OPEN;
      }
    }
    return MarketStatus.CLOSED;
  }

  isOpen(exchange: Exchange, at?: Date): boolean {
    const status = this.getStatus(exchange, at);
    return status === MarketStatus.OPEN || status === MarketStatus.EARLY_CLOSE;
  }

  nextOpen(exchange: Exchange, from: Date = new Date()): Date {
    const probe = new Date(from);
    for (let i = 0; i < 14; i++) {
      probe.setDate(probe.getDate() + 1);
      probe.setHours(0, 0, 0, 0);
      if (this.isOpen(exchange, probe)) {
        const info = this.exchanges.get(exchange)!;
        const mainSession = info.sessions.find(s => !s.isPreMarket && !s.isPostMarket);
        if (mainSession) {
          const [h, m] = mainSession.open.split(':').map(Number);
          probe.setHours(h, m, 0, 0);
        }
        return probe;
      }
    }
    return probe;
  }

  getTradingSessions(exchange: Exchange) {
    return this.exchanges.get(exchange)?.sessions ?? [];
  }
}

// ─── Best Bid/Offer Aggregator ──────────────────────────────────────────────

interface VenueQuote {
  exchange: Exchange;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  timestamp: number;
}

export class BBOAggregator {
  private venues = new Map<string, Map<Exchange, VenueQuote>>();
  private staleMs: number;

  constructor(staleMs = 5_000) {
    this.staleMs = staleMs;
  }

  update(symbol: string, quote: VenueQuote): void {
    let venueMap = this.venues.get(symbol);
    if (!venueMap) {
      venueMap = new Map();
      this.venues.set(symbol, venueMap);
    }
    venueMap.set(quote.exchange, quote);
  }

  computeBBO(symbol: string): Quote | null {
    const venueMap = this.venues.get(symbol);
    if (!venueMap || venueMap.size === 0) return null;

    const now = Date.now();
    let bestBid = -Infinity, bestBidSize = 0, bestBidExchange: Exchange | undefined;
    let bestAsk = Infinity, bestAskSize = 0, bestAskExchange: Exchange | undefined;

    for (const [ex, vq] of venueMap) {
      if (now - vq.timestamp > this.staleMs) continue;
      if (vq.bid > bestBid || (vq.bid === bestBid && vq.bidSize > bestBidSize)) {
        bestBid = vq.bid;
        bestBidSize = vq.bidSize;
        bestBidExchange = ex;
      }
      if (vq.ask < bestAsk || (vq.ask === bestAsk && vq.askSize > bestAskSize)) {
        bestAsk = vq.ask;
        bestAskSize = vq.askSize;
        bestAskExchange = ex;
      }
    }

    if (bestBid === -Infinity || bestAsk === Infinity) return null;
    if (bestBid > bestAsk) {
      bestBid = bestAsk;
      bestBidSize = bestAskSize;
    }

    return {
      symbol,
      bid: bestBid,
      ask: bestAsk,
      bidSize: bestBidSize,
      askSize: bestAskSize,
      mid: (bestBid + bestAsk) / 2,
      spread: bestAsk - bestBid,
      timestamp: now,
      exchange: bestBidExchange,
    };
  }

  getConsolidatedBook(symbol: string): Level2 | null {
    const venueMap = this.venues.get(symbol);
    if (!venueMap) return null;

    const now = Date.now();
    const bids: Level2Entry[] = [];
    const asks: Level2Entry[] = [];

    for (const [ex, vq] of venueMap) {
      if (now - vq.timestamp > this.staleMs) continue;
      bids.push({ price: vq.bid, size: vq.bidSize, orders: 1, exchange: ex, timestamp: vq.timestamp });
      asks.push({ price: vq.ask, size: vq.askSize, orders: 1, exchange: ex, timestamp: vq.timestamp });
    }

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    return { symbol, timestamp: now, bids: mergeLevels(bids), asks: mergeLevels(asks) };
  }
}

function mergeLevels(entries: Level2Entry[]): Level2Entry[] {
  const merged = new Map<number, Level2Entry>();
  for (const e of entries) {
    const existing = merged.get(e.price);
    if (existing) {
      existing.size += e.size;
      existing.orders += e.orders;
      existing.timestamp = Math.max(existing.timestamp, e.timestamp);
    } else {
      merged.set(e.price, { ...e });
    }
  }
  return Array.from(merged.values());
}

// ─── Consolidated Tape ──────────────────────────────────────────────────────

export class ConsolidatedTape {
  private trades: Trade[] = [];
  private maxHistory: number;
  private listeners: Array<(trade: Trade) => void> = [];

  constructor(maxHistory = 10_000) {
    this.maxHistory = maxHistory;
  }

  onTrade(cb: (trade: Trade) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  record(trade: Trade): void {
    this.trades.push(trade);
    if (this.trades.length > this.maxHistory) {
      this.trades = this.trades.slice(-Math.floor(this.maxHistory * 0.8));
    }
    for (const cb of this.listeners) cb(trade);
  }

  recent(symbol: string, count = 100): Trade[] {
    const filtered = this.trades.filter(t => t.symbol === symbol);
    return filtered.slice(-count);
  }

  volumeProfile(symbol: string, sincMs?: number): Map<number, number> {
    const start = sincMs ?? 0;
    const profile = new Map<number, number>();
    for (const t of this.trades) {
      if (t.symbol !== symbol || t.timestamp < start) continue;
      const rounded = Math.round(t.price * 100) / 100;
      profile.set(rounded, (profile.get(rounded) ?? 0) + t.size);
    }
    return profile;
  }
}

// ─── Throttle / Batch ───────────────────────────────────────────────────────

type QueuedMessage = { type: string; data: unknown; timestamp: number };

class ThrottleBatch {
  private queue: QueuedMessage[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly throttleMs: number;
  private readonly batchSize: number;
  private readonly flush: (batch: QueuedMessage[]) => void;

  constructor(throttleMs: number, batchSize: number, flush: (batch: QueuedMessage[]) => void) {
    this.throttleMs = throttleMs;
    this.batchSize = batchSize;
    this.flush = flush;
  }

  push(msg: QueuedMessage): void {
    this.queue.push(msg);
    if (this.queue.length >= this.batchSize) {
      this.drain();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.drain(), this.throttleMs);
    }
  }

  private drain(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    this.flush(batch);
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.queue.length = 0;
  }
}

// ─── Market Data Feed ───────────────────────────────────────────────────────

type FeedState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export class MarketDataFeed {
  private config: FeedConfig;
  private state: FeedState = 'DISCONNECTED';
  private subscriptions = new Map<string, Subscription>();
  private symbolSubs = new Map<string, Set<string>>();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;
  private url: string;

  readonly resolver = new SymbolResolver();
  readonly validator: DataQualityValidator;
  readonly bbo = new BBOAggregator();
  readonly tape = new ConsolidatedTape();
  readonly calendar = new ExchangeCalendar();

  private throttle: ThrottleBatch;
  private stateListeners: Array<(state: FeedState) => void> = [];
  private issueListeners: Array<(issue: DataQualityIssue) => void> = [];

  constructor(url: string, config: Partial<FeedConfig> = {}) {
    this.url = url;
    this.config = { ...DEFAULT_FEED_CONFIG, ...config };
    this.validator = new DataQualityValidator(this.config);
    this.throttle = new ThrottleBatch(this.config.throttleMs, this.config.batchSize, batch => {
      this.processBatch(batch);
    });
  }

  // ── Connection ──

  connect(): void {
    if (this.state === 'CONNECTED' || this.state === 'CONNECTING') return;
    this.setState('CONNECTING');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.setState('CONNECTED');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      this.lastHeartbeat = Date.now();
      try {
        const msg = JSON.parse(String(event.data));
        this.throttle.push({ type: msg.type, data: msg, timestamp: Date.now() });
      } catch { /* malformed messages silently dropped */ }
    };

    this.ws.onerror = () => {
      this.setState('ERROR');
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.state !== 'DISCONNECTED') {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.setState('DISCONNECTED');
    this.throttle.destroy();
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.setState('RECONNECTING');
    const delay = Math.min(
      this.config.reconnectBaseMs * Math.pow(2, this.reconnectAttempts),
      this.config.reconnectMaxMs,
    );
    const jitter = delay * (0.5 + Math.random() * 0.5);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  private startHeartbeat(): void {
    this.lastHeartbeat = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastHeartbeat > this.config.heartbeatIntervalMs * 3) {
        this.ws?.close();
      } else if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Subscriptions ──

  subscribe(symbol: string, level: MarketDataLevel, callback: (data: unknown) => void, timeframe?: TimeFrame): string {
    const canonical = this.resolver.resolve(symbol);
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error(`Max subscriptions (${this.config.maxSubscriptions}) reached`);
    }

    const id = `${canonical}:${level}:${timeframe ?? ''}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const sub: Subscription = { id, symbol: canonical, level, timeframe, callback, createdAt: Date.now() };
    this.subscriptions.set(id, sub);

    let symSet = this.symbolSubs.get(canonical);
    if (!symSet) {
      symSet = new Set();
      this.symbolSubs.set(canonical, symSet);
    }
    symSet.add(id);

    if (symSet.size === 1) {
      this.sendSubscribe(canonical, level, timeframe);
    }
    return id;
  }

  unsubscribe(id: string): void {
    const sub = this.subscriptions.get(id);
    if (!sub) return;
    this.subscriptions.delete(id);

    const symSet = this.symbolSubs.get(sub.symbol);
    if (symSet) {
      symSet.delete(id);
      if (symSet.size === 0) {
        this.symbolSubs.delete(sub.symbol);
        this.sendUnsubscribe(sub.symbol, sub.level, sub.timeframe);
      }
    }
  }

  unsubscribeSymbol(symbol: string): void {
    const canonical = this.resolver.resolve(symbol);
    const symSet = this.symbolSubs.get(canonical);
    if (!symSet) return;
    for (const id of symSet) this.subscriptions.delete(id);
    this.symbolSubs.delete(canonical);
    this.sendUnsubscribe(canonical, 'L1');
  }

  private sendSubscribe(symbol: string, level: MarketDataLevel, timeframe?: TimeFrame): void {
    this.send({ type: 'subscribe', symbol, level, timeframe });
  }

  private sendUnsubscribe(symbol: string, level: MarketDataLevel, timeframe?: TimeFrame): void {
    this.send({ type: 'unsubscribe', symbol, level, timeframe });
  }

  private resubscribeAll(): void {
    const seen = new Set<string>();
    for (const sub of this.subscriptions.values()) {
      const key = `${sub.symbol}:${sub.level}:${sub.timeframe ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.sendSubscribe(sub.symbol, sub.level, sub.timeframe);
    }
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  // ── Dispatch ──

  private processBatch(batch: QueuedMessage[]): void {
    for (const msg of batch) {
      this.dispatchMessage(msg.data as Record<string, unknown>);
    }
  }

  private dispatchMessage(msg: Record<string, unknown>): void {
    const symbol = msg.symbol as string | undefined;
    if (!symbol) return;

    const canonical = this.resolver.resolve(symbol);
    const issue = this.validateIncoming(canonical, msg);
    if (issue) {
      if (issue.severity === 'ERROR') return;
      for (const cb of this.issueListeners) cb(issue);
    }

    const normalized = this.normalize(canonical, msg);
    const symSet = this.symbolSubs.get(canonical);
    if (!symSet) return;

    for (const id of symSet) {
      const sub = this.subscriptions.get(id);
      if (!sub) continue;
      if (this.levelMatches(sub.level, msg.type as string)) {
        try { sub.callback(normalized); } catch { /* subscriber errors don't crash the feed */ }
      }
    }

    if (msg.type === 'trade') this.tape.record(normalized as Trade);
    if (msg.type === 'quote') {
      const q = normalized as Quote;
      if (q.exchange) {
        this.bbo.update(canonical, {
          exchange: q.exchange,
          bid: q.bid,
          bidSize: q.bidSize,
          ask: q.ask,
          askSize: q.askSize,
          timestamp: q.timestamp,
        });
      }
    }
  }

  private levelMatches(subLevel: MarketDataLevel, msgType: string): boolean {
    const map: Record<string, MarketDataLevel[]> = {
      trade: ['TRADE', 'L1'],
      quote: ['QUOTE', 'L1'],
      l2: ['L2'],
      l3: ['L3', 'L2'],
      bar: ['BAR'],
    };
    return (map[msgType] ?? []).includes(subLevel);
  }

  private validateIncoming(symbol: string, msg: Record<string, unknown>): DataQualityIssue | null {
    const price = (msg.price ?? msg.last ?? msg.close ?? msg.bid) as number | undefined;
    const size = (msg.size ?? msg.volume ?? msg.bidSize) as number | undefined;
    if (price != null && size != null) {
      return this.validator.validate(symbol, price, size);
    }
    return null;
  }

  private normalize(canonical: string, msg: Record<string, unknown>): unknown {
    return { ...msg, symbol: canonical, _normalized: true };
  }

  // ── Events ──

  onStateChange(cb: (state: FeedState) => void): () => void {
    this.stateListeners.push(cb);
    return () => {
      const idx = this.stateListeners.indexOf(cb);
      if (idx >= 0) this.stateListeners.splice(idx, 1);
    };
  }

  onQualityIssue(cb: (issue: DataQualityIssue) => void): () => void {
    this.issueListeners.push(cb);
    return () => {
      const idx = this.issueListeners.indexOf(cb);
      if (idx >= 0) this.issueListeners.splice(idx, 1);
    };
  }

  private setState(state: FeedState): void {
    if (this.state === state) return;
    this.state = state;
    for (const cb of this.stateListeners) {
      try { cb(state); } catch { /* ignored */ }
    }
  }

  getState(): FeedState { return this.state; }
  getSubscriptionCount(): number { return this.subscriptions.size; }
  getSubscribedSymbols(): string[] { return Array.from(this.symbolSubs.keys()); }
}
