import {
  type Bar,
  type CorporateAction,
  type DataGap,
  type DataQuality,
  type DataQualityIssue,
  CorporateActionType,
  TimeFrame,
  TIMEFRAME_MS,
} from './types';

// ─── LRU Cache ──────────────────────────────────────────────────────────────

class LRUCache<V> {
  private capacity: number;
  private cache = new Map<string, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: string): V | undefined {
    const val = this.cache.get(key);
    if (val !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: string, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  has(key: string): boolean { return this.cache.has(key); }
  delete(key: string): boolean { return this.cache.delete(key); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
}

// ─── IndexedDB Store ────────────────────────────────────────────────────────

const DB_NAME = 'MarketDataHistory';
const DB_VERSION = 1;
const STORE_NAME = 'bars';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('symbol_tf', ['symbol', 'timeframe'], { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

interface StoredBar extends Bar {
  key: string;
}

function barKey(symbol: string, timeframe: TimeFrame, timestamp: number): string {
  return `${symbol}:${timeframe}:${timestamp}`;
}

async function idbPutBars(bars: Bar[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const bar of bars) {
    const stored: StoredBar = { ...bar, key: barKey(bar.symbol, bar.timeframe, bar.timestamp) };
    store.put(stored);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetBars(
  symbol: string,
  timeframe: TimeFrame,
  from: number,
  to: number,
): Promise<Bar[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const results: Bar[] = [];
    const range = IDBKeyRange.bound(
      barKey(symbol, timeframe, from),
      barKey(symbol, timeframe, to),
    );
    const req = store.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const bar = cursor.value as StoredBar;
        if (bar.symbol === symbol && bar.timeframe === timeframe) {
          results.push(bar);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Corporate Action Adjustment ────────────────────────────────────────────

export enum AdjustmentMethod {
  BACK_ADJUST = 'BACK_ADJUST',
  PROPORTIONAL = 'PROPORTIONAL',
}

function splitAdjustmentFactor(action: CorporateAction): number {
  if (!action.ratio || action.ratio === 0) return 1;
  if (action.type === CorporateActionType.FORWARD_SPLIT) return 1 / action.ratio;
  if (action.type === CorporateActionType.REVERSE_SPLIT) return action.ratio;
  return 1;
}

function dividendAdjustmentFactor(action: CorporateAction, prevClose: number): number {
  if (action.type !== CorporateActionType.CASH_DIVIDEND) return 1;
  if (!action.amount || prevClose <= 0) return 1;
  return (prevClose - action.amount) / prevClose;
}

export function adjustBarsForCorporateActions(
  bars: Bar[],
  actions: CorporateAction[],
  method: AdjustmentMethod = AdjustmentMethod.BACK_ADJUST,
): Bar[] {
  if (actions.length === 0) return bars;

  const sorted = [...actions].sort(
    (a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime(),
  );

  const adjusted = bars.map(b => ({ ...b }));

  for (const action of sorted) {
    const exTs = new Date(action.exDate).getTime();

    let factor = 1;
    const isSplit =
      action.type === CorporateActionType.FORWARD_SPLIT ||
      action.type === CorporateActionType.REVERSE_SPLIT;

    if (isSplit) {
      factor = splitAdjustmentFactor(action);
    } else if (action.type === CorporateActionType.CASH_DIVIDEND) {
      const barBefore = adjusted.filter(b => b.timestamp < exTs).pop();
      const prevClose = barBefore?.close ?? 0;
      factor = dividendAdjustmentFactor(action, prevClose);
    }

    if (factor === 1) continue;

    if (method === AdjustmentMethod.BACK_ADJUST) {
      for (const bar of adjusted) {
        if (bar.timestamp < exTs) {
          bar.open *= factor;
          bar.high *= factor;
          bar.low *= factor;
          bar.close *= factor;
          bar.vwap *= factor;
          if (isSplit) bar.volume /= factor;
        }
      }
    } else {
      let cumFactor = 1;
      for (let i = adjusted.length - 1; i >= 0; i--) {
        if (adjusted[i].timestamp < exTs) cumFactor *= factor;
        adjusted[i].open *= cumFactor;
        adjusted[i].high *= cumFactor;
        adjusted[i].low *= cumFactor;
        adjusted[i].close *= cumFactor;
        adjusted[i].vwap *= cumFactor;
      }
    }
  }

  return adjusted;
}

// ─── Data Stitching ─────────────────────────────────────────────────────────

export function stitchBars(historical: Bar[], realtime: Bar[]): Bar[] {
  if (historical.length === 0) return [...realtime];
  if (realtime.length === 0) return [...historical];

  const lastHistTs = historical[historical.length - 1].timestamp;
  const newRealtime = realtime.filter(b => b.timestamp > lastHistTs);

  const overlapBar = realtime.find(b => b.timestamp === lastHistTs);
  if (overlapBar) {
    const merged = [...historical];
    const last = merged[merged.length - 1];
    merged[merged.length - 1] = {
      ...last,
      high: Math.max(last.high, overlapBar.high),
      low: Math.min(last.low, overlapBar.low),
      close: overlapBar.close,
      volume: Math.max(last.volume, overlapBar.volume),
      trades: Math.max(last.trades, overlapBar.trades),
      isComplete: overlapBar.isComplete,
    };
    return [...merged, ...newRealtime];
  }

  return [...historical, ...newRealtime];
}

// ─── Gap Detection & Interpolation ──────────────────────────────────────────

export function detectDataGaps(
  bars: Bar[],
  timeframe: TimeFrame,
  holidays: Set<string> = new Set(),
): DataGap[] {
  const intervalMs = TIMEFRAME_MS[timeframe];
  if (!intervalMs || bars.length < 2) return [];

  const gaps: DataGap[] = [];
  for (let i = 1; i < bars.length; i++) {
    const expected = bars[i - 1].timestamp + intervalMs;
    const actual = bars[i].timestamp;
    const diff = actual - expected;

    if (diff <= intervalMs * 0.5) continue;

    const expectedBars = Math.round(diff / intervalMs);
    let reason: DataGap['reason'] = 'NO_DATA';

    if (isWeekendGap(bars[i - 1].timestamp, bars[i].timestamp)) {
      reason = 'HOLIDAY';
    } else {
      const dateStr = new Date(expected).toISOString().slice(0, 10);
      if (holidays.has(dateStr)) reason = 'HOLIDAY';
    }

    gaps.push({
      symbol: bars[i].symbol,
      timeframe,
      start: bars[i - 1].timestamp,
      end: actual,
      expectedBars,
      reason,
    });
  }
  return gaps;
}

function isWeekendGap(from: number, to: number): boolean {
  const d1 = new Date(from).getDay();
  const d2 = new Date(to).getDay();
  return (d1 === 5 && d2 === 1) || d1 === 6 || d1 === 0;
}

export function interpolateMissing(
  bars: Bar[],
  timeframe: TimeFrame,
  method: 'LINEAR' | 'FORWARD_FILL' | 'NONE' = 'FORWARD_FILL',
): Bar[] {
  const intervalMs = TIMEFRAME_MS[timeframe];
  if (!intervalMs || bars.length < 2 || method === 'NONE') return bars;

  const result: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    result.push(bars[i]);

    if (i < bars.length - 1) {
      const gap = bars[i + 1].timestamp - bars[i].timestamp;
      const missing = Math.round(gap / intervalMs) - 1;

      if (missing > 0 && missing <= 10) {
        for (let j = 1; j <= missing; j++) {
          const ts = bars[i].timestamp + j * intervalMs;
          if (isWeekendTimestamp(ts)) continue;

          if (method === 'FORWARD_FILL') {
            result.push({
              ...bars[i],
              timestamp: ts,
              open: bars[i].close,
              high: bars[i].close,
              low: bars[i].close,
              volume: 0,
              trades: 0,
              isComplete: true,
            });
          } else {
            const ratio = j / (missing + 1);
            const interp = (a: number, b: number) => a + (b - a) * ratio;
            result.push({
              ...bars[i],
              timestamp: ts,
              open: interp(bars[i].close, bars[i + 1].open),
              high: interp(bars[i].high, bars[i + 1].high),
              low: interp(bars[i].low, bars[i + 1].low),
              close: interp(bars[i].close, bars[i + 1].open),
              volume: 0,
              trades: 0,
              isComplete: true,
            });
          }
        }
      }
    }
  }
  return result;
}

function isWeekendTimestamp(ts: number): boolean {
  const d = new Date(ts).getDay();
  return d === 0 || d === 6;
}

// ─── Continuous Futures ─────────────────────────────────────────────────────

export interface FuturesContract {
  symbol: string;
  expiryDate: string;
  bars: Bar[];
}

export function buildContinuousFutures(
  contracts: FuturesContract[],
  method: AdjustmentMethod = AdjustmentMethod.BACK_ADJUST,
): Bar[] {
  if (contracts.length === 0) return [];
  const sorted = [...contracts].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
  );

  if (sorted.length === 1) return [...sorted[0].bars];

  const result: Bar[] = [];
  let cumulativeAdjust = 0;

  for (let c = 0; c < sorted.length; c++) {
    const contract = sorted[c];
    const nextContract = sorted[c + 1];
    const expiryTs = new Date(contract.expiryDate).getTime();

    let rollAdjust = 0;
    if (nextContract) {
      const lastBar = contract.bars.filter(b => b.timestamp <= expiryTs).pop();
      const firstNextBar = nextContract.bars.find(b => b.timestamp >= expiryTs - 86_400_000);
      if (lastBar && firstNextBar) {
        rollAdjust = firstNextBar.close - lastBar.close;
      }
    }

    const contractBars = nextContract
      ? contract.bars.filter(b => b.timestamp <= expiryTs)
      : contract.bars;

    if (method === AdjustmentMethod.BACK_ADJUST) {
      for (const bar of contractBars) {
        result.push({
          ...bar,
          symbol: 'CONTINUOUS',
          open: bar.open - cumulativeAdjust,
          high: bar.high - cumulativeAdjust,
          low: bar.low - cumulativeAdjust,
          close: bar.close - cumulativeAdjust,
        });
      }
      cumulativeAdjust += rollAdjust;
    } else {
      for (const bar of contractBars) {
        const factor = cumulativeAdjust === 0 ? 1 : cumulativeAdjust;
        result.push({
          ...bar,
          symbol: 'CONTINUOUS',
          open: bar.open * factor,
          high: bar.high * factor,
          low: bar.low * factor,
          close: bar.close * factor,
        });
      }
      if (rollAdjust !== 0 && contractBars.length > 0) {
        const lastClose = contractBars[contractBars.length - 1].close;
        const nextClose = lastClose + rollAdjust;
        cumulativeAdjust = (cumulativeAdjust === 0 ? 1 : cumulativeAdjust) * (nextClose / lastClose);
      }
    }
  }

  return result;
}

// ─── Data Validation ────────────────────────────────────────────────────────

export function validateBars(bars: Bar[]): DataQuality {
  const issues: DataQualityIssue[] = [];
  let missingBars = 0, staleBars = 0, outlierBars = 0, gapCount = 0;

  const prices = bars.map(b => b.close).filter(p => isFinite(p));
  const mean = prices.reduce((s, p) => s + p, 0) / (prices.length || 1);
  const stdDev = Math.sqrt(
    prices.reduce((s, p) => s + (p - mean) ** 2, 0) / (prices.length || 1),
  );

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    if (bar.high < bar.low) {
      issues.push({ type: 'INVALID', timestamp: bar.timestamp, description: `high < low at ${bar.timestamp}`, severity: 'ERROR' });
    }
    if (bar.close > bar.high || bar.close < bar.low) {
      issues.push({ type: 'INVALID', timestamp: bar.timestamp, description: `close outside high/low range`, severity: 'ERROR' });
    }
    if (bar.open > bar.high || bar.open < bar.low) {
      issues.push({ type: 'INVALID', timestamp: bar.timestamp, description: `open outside high/low range`, severity: 'ERROR' });
    }
    if (bar.volume < 0) {
      issues.push({ type: 'INVALID', timestamp: bar.timestamp, description: `negative volume`, severity: 'ERROR' });
    }

    if (stdDev > 0 && Math.abs(bar.close - mean) > 5 * stdDev) {
      outlierBars++;
      issues.push({ type: 'OUTLIER', timestamp: bar.timestamp, description: `price ${bar.close} is >5σ from mean`, severity: 'WARNING' });
    }

    if (i > 0) {
      const prev = bars[i - 1];
      if (bar.volume === 0 && prev.volume === 0) {
        staleBars++;
      }
      if (bar.close === prev.close && bar.open === prev.open && bar.high === prev.high && bar.low === prev.low && bar.volume === 0) {
        issues.push({ type: 'STALE', timestamp: bar.timestamp, description: `duplicate bar`, severity: 'WARNING' });
      }
    }
  }

  const totalBars = bars.length;
  const completeness = totalBars > 0 ? (totalBars - missingBars - staleBars) / totalBars : 0;

  return {
    symbol: bars[0]?.symbol ?? '',
    timeframe: bars[0]?.timeframe ?? TimeFrame.D1,
    totalBars,
    missingBars,
    staleBars,
    outlierBars,
    gapCount,
    completeness: Math.max(0, Math.min(1, completeness)),
    lastChecked: Date.now(),
    issues,
  };
}

// ─── Historical Data Manager ────────────────────────────────────────────────

export interface HistoricalFetcher {
  fetchBars(symbol: string, timeframe: TimeFrame, from: number, to: number): Promise<Bar[]>;
  fetchCorporateActions(symbol: string, from: number, to: number): Promise<CorporateAction[]>;
}

export interface HistoricalManagerConfig {
  memoryCacheSize: number;
  useIndexedDB: boolean;
  adjustForCorporateActions: boolean;
  adjustmentMethod: AdjustmentMethod;
  interpolationMethod: 'LINEAR' | 'FORWARD_FILL' | 'NONE';
  maxPageSize: number;
  holidays: Set<string>;
}

const DEFAULT_HIST_CONFIG: HistoricalManagerConfig = {
  memoryCacheSize: 200,
  useIndexedDB: true,
  adjustForCorporateActions: true,
  adjustmentMethod: AdjustmentMethod.BACK_ADJUST,
  interpolationMethod: 'FORWARD_FILL',
  maxPageSize: 5000,
  holidays: new Set(),
};

export class HistoricalDataManager {
  private fetcher: HistoricalFetcher;
  private config: HistoricalManagerConfig;
  private memCache: LRUCache<Bar[]>;
  private pendingRequests = new Map<string, Promise<Bar[]>>();

  constructor(fetcher: HistoricalFetcher, config: Partial<HistoricalManagerConfig> = {}) {
    this.fetcher = fetcher;
    this.config = { ...DEFAULT_HIST_CONFIG, ...config };
    this.memCache = new LRUCache(this.config.memoryCacheSize);
  }

  async getBars(
    symbol: string,
    timeframe: TimeFrame,
    from: number,
    to: number,
    options: { adjusted?: boolean; interpolate?: boolean } = {},
  ): Promise<Bar[]> {
    const cacheKey = `${symbol}:${timeframe}:${from}:${to}`;

    const memCached = this.memCache.get(cacheKey);
    if (memCached) return memCached;

    const pending = this.pendingRequests.get(cacheKey);
    if (pending) return pending;

    const promise = this.fetchWithPagination(symbol, timeframe, from, to, options);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const bars = await promise;
      this.memCache.set(cacheKey, bars);
      return bars;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async fetchWithPagination(
    symbol: string,
    timeframe: TimeFrame,
    from: number,
    to: number,
    options: { adjusted?: boolean; interpolate?: boolean },
  ): Promise<Bar[]> {
    let allBars: Bar[] = [];

    if (this.config.useIndexedDB) {
      const cached = await idbGetBars(symbol, timeframe, from, to);
      if (cached.length > 0) {
        const cachedFrom = cached[0].timestamp;
        const cachedTo = cached[cached.length - 1].timestamp;

        const gaps: Array<[number, number]> = [];
        if (from < cachedFrom) gaps.push([from, cachedFrom]);
        if (to > cachedTo) gaps.push([cachedTo, to]);

        const fetched: Bar[] = [];
        for (const [gFrom, gTo] of gaps) {
          const page = await this.fetchPages(symbol, timeframe, gFrom, gTo);
          fetched.push(...page);
        }

        if (fetched.length > 0) await idbPutBars(fetched);
        allBars = [...cached, ...fetched].sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    if (allBars.length === 0) {
      allBars = await this.fetchPages(symbol, timeframe, from, to);
      if (this.config.useIndexedDB && allBars.length > 0) {
        await idbPutBars(allBars).catch(() => {});
      }
    }

    allBars = deduplicateBars(allBars);

    const shouldAdjust = options.adjusted ?? this.config.adjustForCorporateActions;
    if (shouldAdjust) {
      const actions = await this.fetcher.fetchCorporateActions(symbol, from, to);
      allBars = adjustBarsForCorporateActions(allBars, actions, this.config.adjustmentMethod);
    }

    const shouldInterpolate = options.interpolate ?? this.config.interpolationMethod !== 'NONE';
    if (shouldInterpolate) {
      allBars = interpolateMissing(allBars, timeframe, this.config.interpolationMethod);
    }

    return allBars.filter(b => b.timestamp >= from && b.timestamp <= to);
  }

  private async fetchPages(
    symbol: string,
    timeframe: TimeFrame,
    from: number,
    to: number,
  ): Promise<Bar[]> {
    const intervalMs = TIMEFRAME_MS[timeframe] ?? 60_000;
    const pageSpan = this.config.maxPageSize * intervalMs;
    const allBars: Bar[] = [];

    let cursor = from;
    while (cursor < to) {
      const pageTo = Math.min(cursor + pageSpan, to);
      const page = await this.fetcher.fetchBars(symbol, timeframe, cursor, pageTo);
      allBars.push(...page);
      if (page.length === 0) break;
      cursor = page[page.length - 1].timestamp + intervalMs;
    }

    return allBars;
  }

  async clearCache(): Promise<void> {
    this.memCache.clear();
    if (this.config.useIndexedDB) await idbClear().catch(() => {});
  }

  async getDataQuality(symbol: string, timeframe: TimeFrame, from: number, to: number): Promise<DataQuality> {
    const bars = await this.getBars(symbol, timeframe, from, to, { adjusted: false, interpolate: false });
    const quality = validateBars(bars);
    const gaps = detectDataGaps(bars, timeframe, this.config.holidays);
    quality.gapCount = gaps.length;
    quality.missingBars = gaps.reduce((s, g) => s + g.expectedBars, 0);
    return quality;
  }
}

function deduplicateBars(bars: Bar[]): Bar[] {
  const seen = new Set<number>();
  return bars.filter(b => {
    if (seen.has(b.timestamp)) return false;
    seen.add(b.timestamp);
    return true;
  });
}
