import { type Bar, type Level1, TimeFrame } from './types';

// ─── Scanner Types ──────────────────────────────────────────────────────────

export type ScannerType =
  | 'PRICE_BREAKOUT'
  | 'VOLUME_SPIKE'
  | 'GAP'
  | 'RELATIVE_STRENGTH'
  | 'UNUSUAL_OPTIONS'
  | 'MOMENTUM'
  | 'PATTERN'
  | 'SECTOR_ROTATION'
  | 'EARNINGS_MOMENTUM'
  | 'PRE_MARKET_MOVER'
  | 'ALL_TIME_HIGH'
  | 'ALL_TIME_LOW'
  | 'MOST_ACTIVE'
  | 'TOP_GAINER'
  | 'TOP_LOSER';

export interface ScannerHit {
  symbol: string;
  scanner: ScannerType;
  timestamp: number;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  detail: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata?: Record<string, number | string>;
}

export interface ScannerAlert {
  id: string;
  hit: ScannerHit;
  acknowledged: boolean;
  createdAt: number;
}

export interface ScannerConfig {
  type: ScannerType;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  minSeverity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Symbol Stats Snapshot ──────────────────────────────────────────────────

export interface SymbolSnapshot {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  avgVolume: number;
  high52w: number;
  low52w: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  atr14?: number;
  sector?: string;
  industry?: string;
  marketCap?: number;
  optionsVolume?: number;
  optionsOI?: number;
  avgOptionsVolume?: number;
  earningsSurprisePct?: number;
  preMarketPrice?: number;
  preMarketVolume?: number;
  afterHoursPrice?: number;
  afterHoursVolume?: number;
  recentBars?: Bar[];
}

// ─── Individual Scanners ────────────────────────────────────────────────────

function scanPriceBreakout(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const threshold = Number(params.threshold ?? 0.5);
  const pctAbove52High = ((snap.price - snap.high52w) / snap.high52w) * 100;
  const pctBelow52Low = ((snap.low52w - snap.price) / snap.low52w) * 100;

  if (snap.price >= snap.high52w * (1 - threshold / 100)) {
    return {
      symbol: snap.symbol,
      scanner: 'PRICE_BREAKOUT',
      timestamp: Date.now(),
      price: snap.price,
      change: snap.price - snap.prevClose,
      changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
      volume: snap.volume,
      detail: `Near 52-week high (${pctAbove52High.toFixed(2)}% from $${snap.high52w.toFixed(2)})`,
      severity: pctAbove52High >= 0 ? 'HIGH' : 'MEDIUM',
      metadata: { high52w: snap.high52w, pctAbove52High },
    };
  }

  if (snap.price <= snap.low52w * (1 + threshold / 100)) {
    return {
      symbol: snap.symbol,
      scanner: 'PRICE_BREAKOUT',
      timestamp: Date.now(),
      price: snap.price,
      change: snap.price - snap.prevClose,
      changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
      volume: snap.volume,
      detail: `Near 52-week low (${pctBelow52Low.toFixed(2)}% from $${snap.low52w.toFixed(2)})`,
      severity: pctBelow52Low >= 0 ? 'HIGH' : 'MEDIUM',
      metadata: { low52w: snap.low52w, pctBelow52Low },
    };
  }

  return null;
}

function scanVolumeSpike(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const multiplier = Number(params.multiplier ?? 2.0);
  if (snap.avgVolume <= 0) return null;

  const ratio = snap.volume / snap.avgVolume;
  if (ratio < multiplier) return null;

  const severity = ratio >= 5 ? 'HIGH' : ratio >= 3 ? 'MEDIUM' : 'LOW';
  return {
    symbol: snap.symbol,
    scanner: 'VOLUME_SPIKE',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
    volume: snap.volume,
    detail: `Volume ${ratio.toFixed(1)}x avg (${formatVolume(snap.volume)} vs ${formatVolume(snap.avgVolume)} avg)`,
    severity,
    metadata: { volumeRatio: ratio, avgVolume: snap.avgVolume },
  };
}

function scanGap(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minGapPct = Number(params.minGapPct ?? 2.0);
  if (snap.prevClose <= 0) return null;

  const gapPct = ((snap.open - snap.prevClose) / snap.prevClose) * 100;
  if (Math.abs(gapPct) < minGapPct) return null;

  const direction = gapPct > 0 ? 'up' : 'down';
  const severity = Math.abs(gapPct) >= 5 ? 'HIGH' : Math.abs(gapPct) >= 3 ? 'MEDIUM' : 'LOW';
  return {
    symbol: snap.symbol,
    scanner: 'GAP',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.open - snap.prevClose,
    changePct: gapPct,
    volume: snap.volume,
    detail: `Gap ${direction} ${Math.abs(gapPct).toFixed(2)}% ($${snap.prevClose.toFixed(2)} → $${snap.open.toFixed(2)})`,
    severity,
    metadata: { gapPct, prevClose: snap.prevClose, openPrice: snap.open },
  };
}

function scanRelativeStrength(
  snap: SymbolSnapshot,
  sectorPerf: Map<string, number>,
  marketPerf: number,
  params: Record<string, number | string | boolean>,
): ScannerHit | null {
  const minRS = Number(params.minRS ?? 1.5);
  if (snap.prevClose <= 0 || !snap.sector) return null;

  const stockPerf = ((snap.price - snap.prevClose) / snap.prevClose) * 100;
  const sectorP = sectorPerf.get(snap.sector) ?? 0;
  const rsVsSector = stockPerf - sectorP;
  const rsVsMarket = stockPerf - marketPerf;

  if (rsVsSector < minRS && rsVsMarket < minRS) return null;

  return {
    symbol: snap.symbol,
    scanner: 'RELATIVE_STRENGTH',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: stockPerf,
    volume: snap.volume,
    detail: `RS vs sector: +${rsVsSector.toFixed(2)}%, vs market: +${rsVsMarket.toFixed(2)}%`,
    severity: rsVsSector >= 3 ? 'HIGH' : rsVsSector >= 2 ? 'MEDIUM' : 'LOW',
    metadata: { rsVsSector, rsVsMarket, sectorPerf: sectorP, marketPerf },
  };
}

function scanUnusualOptions(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const multiplier = Number(params.multiplier ?? 2.0);
  if (!snap.optionsVolume || !snap.avgOptionsVolume || snap.avgOptionsVolume <= 0) return null;

  const ratio = snap.optionsVolume / snap.avgOptionsVolume;
  if (ratio < multiplier) return null;

  return {
    symbol: snap.symbol,
    scanner: 'UNUSUAL_OPTIONS',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
    volume: snap.volume,
    detail: `Options volume ${ratio.toFixed(1)}x avg (${formatVolume(snap.optionsVolume)} contracts)`,
    severity: ratio >= 5 ? 'HIGH' : ratio >= 3 ? 'MEDIUM' : 'LOW',
    metadata: { optionsVolumeRatio: ratio, optionsOI: snap.optionsOI ?? 0 },
  };
}

function scanMomentum(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minRsi = Number(params.minRsi ?? 70);
  const maxRsi = Number(params.maxRsi ?? 30);
  if (snap.rsi14 === undefined) return null;

  if (snap.rsi14 >= minRsi) {
    return {
      symbol: snap.symbol,
      scanner: 'MOMENTUM',
      timestamp: Date.now(),
      price: snap.price,
      change: snap.price - snap.prevClose,
      changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
      volume: snap.volume,
      detail: `Overbought (RSI: ${snap.rsi14.toFixed(1)})`,
      severity: snap.rsi14 >= 80 ? 'HIGH' : 'MEDIUM',
      metadata: { rsi14: snap.rsi14 },
    };
  }

  if (snap.rsi14 <= maxRsi) {
    return {
      symbol: snap.symbol,
      scanner: 'MOMENTUM',
      timestamp: Date.now(),
      price: snap.price,
      change: snap.price - snap.prevClose,
      changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
      volume: snap.volume,
      detail: `Oversold (RSI: ${snap.rsi14.toFixed(1)})`,
      severity: snap.rsi14 <= 20 ? 'HIGH' : 'MEDIUM',
      metadata: { rsi14: snap.rsi14 },
    };
  }

  return null;
}

function scanEarningsMomentum(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minSurprise = Number(params.minSurprisePct ?? 5);
  if (snap.earningsSurprisePct === undefined) return null;

  if (Math.abs(snap.earningsSurprisePct) < minSurprise) return null;

  const direction = snap.earningsSurprisePct > 0 ? 'beat' : 'missed';
  return {
    symbol: snap.symbol,
    scanner: 'EARNINGS_MOMENTUM',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
    volume: snap.volume,
    detail: `Earnings ${direction} by ${Math.abs(snap.earningsSurprisePct).toFixed(1)}%`,
    severity: Math.abs(snap.earningsSurprisePct) >= 20 ? 'HIGH' : Math.abs(snap.earningsSurprisePct) >= 10 ? 'MEDIUM' : 'LOW',
    metadata: { earningsSurprisePct: snap.earningsSurprisePct },
  };
}

function scanPreMarketMovers(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minMovePct = Number(params.minMovePct ?? 3);
  const price = snap.preMarketPrice ?? snap.afterHoursPrice;
  if (!price || snap.prevClose <= 0) return null;

  const movePct = ((price - snap.prevClose) / snap.prevClose) * 100;
  if (Math.abs(movePct) < minMovePct) return null;

  const session = snap.preMarketPrice ? 'pre-market' : 'after-hours';
  return {
    symbol: snap.symbol,
    scanner: 'PRE_MARKET_MOVER',
    timestamp: Date.now(),
    price,
    change: price - snap.prevClose,
    changePct: movePct,
    volume: snap.preMarketVolume ?? snap.afterHoursVolume ?? 0,
    detail: `${session} ${movePct > 0 ? '+' : ''}${movePct.toFixed(2)}% at $${price.toFixed(2)}`,
    severity: Math.abs(movePct) >= 10 ? 'HIGH' : Math.abs(movePct) >= 5 ? 'MEDIUM' : 'LOW',
    metadata: { session, extendedPrice: price, movePct },
  };
}

function scanAllTimeHigh(snap: SymbolSnapshot): ScannerHit | null {
  if (snap.price < snap.high52w) return null;
  return {
    symbol: snap.symbol,
    scanner: 'ALL_TIME_HIGH',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
    volume: snap.volume,
    detail: `New 52-week high at $${snap.price.toFixed(2)}`,
    severity: 'HIGH',
    metadata: { prevHigh52w: snap.high52w },
  };
}

function scanAllTimeLow(snap: SymbolSnapshot): ScannerHit | null {
  if (snap.price > snap.low52w) return null;
  return {
    symbol: snap.symbol,
    scanner: 'ALL_TIME_LOW',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: ((snap.price - snap.prevClose) / snap.prevClose) * 100,
    volume: snap.volume,
    detail: `New 52-week low at $${snap.price.toFixed(2)}`,
    severity: 'HIGH',
    metadata: { prevLow52w: snap.low52w },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

const SEVERITY_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function meetsSeverity(hit: ScannerHit, min: string): boolean {
  return (SEVERITY_RANK[hit.severity] ?? 0) >= (SEVERITY_RANK[min] ?? 0);
}

// ─── Scanner Alert System ───────────────────────────────────────────────────

export class ScannerAlertSystem {
  private alerts: ScannerAlert[] = [];
  private listeners: Array<(alert: ScannerAlert) => void> = [];
  private maxAlerts: number;
  private idCounter = 0;

  constructor(maxAlerts = 500) {
    this.maxAlerts = maxAlerts;
  }

  push(hit: ScannerHit): ScannerAlert {
    const alert: ScannerAlert = {
      id: String(++this.idCounter),
      hit,
      acknowledged: false,
      createdAt: Date.now(),
    };
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-Math.floor(this.maxAlerts * 0.8));
    }
    for (const cb of this.listeners) { try { cb(alert); } catch { /* */ } }
    return alert;
  }

  acknowledge(id: string): void {
    const a = this.alerts.find(a => a.id === id);
    if (a) a.acknowledged = true;
  }

  onAlert(cb: (alert: ScannerAlert) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  getRecent(count = 50): ScannerAlert[] { return this.alerts.slice(-count); }
  getUnacknowledged(): ScannerAlert[] { return this.alerts.filter(a => !a.acknowledged); }
  clear(): void { this.alerts = []; }
}

// ─── Market Scanner ─────────────────────────────────────────────────────────

export class MarketScanner {
  private scanners: ScannerConfig[] = [];
  private snapshots = new Map<string, SymbolSnapshot>();
  private sectorPerf = new Map<string, number>();
  private marketPerf = 0;
  private alertSystem = new ScannerAlertSystem();
  private hitListeners: Array<(hits: ScannerHit[]) => void> = [];
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private lastHits: ScannerHit[] = [];

  constructor(configs?: ScannerConfig[]) {
    if (configs) this.scanners = configs;
  }

  getAlertSystem(): ScannerAlertSystem { return this.alertSystem; }

  addScanner(config: ScannerConfig): void {
    this.scanners.push(config);
  }

  removeScanner(type: ScannerType): void {
    this.scanners = this.scanners.filter(s => s.type !== type);
  }

  enableScanner(type: ScannerType, enabled = true): void {
    const s = this.scanners.find(s => s.type === type);
    if (s) s.enabled = enabled;
  }

  updateSnapshot(snap: SymbolSnapshot): void {
    this.snapshots.set(snap.symbol, snap);
  }

  updateSnapshots(snaps: SymbolSnapshot[]): void {
    for (const snap of snaps) this.snapshots.set(snap.symbol, snap);
  }

  setSectorPerformance(perf: Map<string, number>): void {
    this.sectorPerf = perf;
  }

  setMarketPerformance(perf: number): void {
    this.marketPerf = perf;
  }

  scan(): ScannerHit[] {
    const hits: ScannerHit[] = [];

    for (const snap of this.snapshots.values()) {
      for (const config of this.scanners) {
        if (!config.enabled) continue;
        const hit = this.runScanner(config, snap);
        if (hit && meetsSeverity(hit, config.minSeverity)) {
          hits.push(hit);
          this.alertSystem.push(hit);
        }
      }
    }

    hits.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    this.lastHits = hits;
    for (const cb of this.hitListeners) { try { cb(hits); } catch { /* */ } }
    return hits;
  }

  private runScanner(config: ScannerConfig, snap: SymbolSnapshot): ScannerHit | null {
    switch (config.type) {
      case 'PRICE_BREAKOUT':    return scanPriceBreakout(snap, config.params);
      case 'VOLUME_SPIKE':      return scanVolumeSpike(snap, config.params);
      case 'GAP':               return scanGap(snap, config.params);
      case 'RELATIVE_STRENGTH': return scanRelativeStrength(snap, this.sectorPerf, this.marketPerf, config.params);
      case 'UNUSUAL_OPTIONS':   return scanUnusualOptions(snap, config.params);
      case 'MOMENTUM':          return scanMomentum(snap, config.params);
      case 'EARNINGS_MOMENTUM': return scanEarningsMomentum(snap, config.params);
      case 'PRE_MARKET_MOVER':  return scanPreMarketMovers(snap, config.params);
      case 'ALL_TIME_HIGH':     return scanAllTimeHigh(snap);
      case 'ALL_TIME_LOW':      return scanAllTimeLow(snap);
      case 'MOST_ACTIVE':       return scanMostActive(snap, config.params);
      case 'TOP_GAINER':        return scanTopGainer(snap, config.params);
      case 'TOP_LOSER':         return scanTopLoser(snap, config.params);
      default: return null;
    }
  }

  startStreaming(intervalMs = 1_000): void {
    if (this.scanInterval) return;
    this.scanInterval = setInterval(() => this.scan(), intervalMs);
    this.scan();
  }

  stopStreaming(): void {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
  }

  onHits(cb: (hits: ScannerHit[]) => void): () => void {
    this.hitListeners.push(cb);
    return () => { const i = this.hitListeners.indexOf(cb); if (i >= 0) this.hitListeners.splice(i, 1); };
  }

  getLastHits(): ScannerHit[] { return [...this.lastHits]; }

  getTopGainers(n = 10): ScannerHit[] {
    return this.rankByChangePct('DESC', n);
  }

  getTopLosers(n = 10): ScannerHit[] {
    return this.rankByChangePct('ASC', n);
  }

  getMostActive(n = 10): ScannerHit[] {
    const hits: ScannerHit[] = [];
    for (const snap of this.snapshots.values()) {
      hits.push({
        symbol: snap.symbol,
        scanner: 'MOST_ACTIVE',
        timestamp: Date.now(),
        price: snap.price,
        change: snap.price - snap.prevClose,
        changePct: snap.prevClose > 0 ? ((snap.price - snap.prevClose) / snap.prevClose) * 100 : 0,
        volume: snap.volume,
        detail: `Dollar volume: $${formatVolume(snap.price * snap.volume)}`,
        severity: 'MEDIUM',
        metadata: { dollarVolume: snap.price * snap.volume },
      });
    }
    hits.sort((a, b) => ((b.metadata?.dollarVolume as number) ?? 0) - ((a.metadata?.dollarVolume as number) ?? 0));
    return hits.slice(0, n);
  }

  private rankByChangePct(direction: 'ASC' | 'DESC', n: number): ScannerHit[] {
    const hits: ScannerHit[] = [];
    for (const snap of this.snapshots.values()) {
      if (snap.prevClose <= 0) continue;
      const changePct = ((snap.price - snap.prevClose) / snap.prevClose) * 100;
      hits.push({
        symbol: snap.symbol,
        scanner: direction === 'DESC' ? 'TOP_GAINER' : 'TOP_LOSER',
        timestamp: Date.now(),
        price: snap.price,
        change: snap.price - snap.prevClose,
        changePct,
        volume: snap.volume,
        detail: `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`,
        severity: Math.abs(changePct) >= 5 ? 'HIGH' : Math.abs(changePct) >= 2 ? 'MEDIUM' : 'LOW',
      });
    }
    hits.sort((a, b) => direction === 'DESC' ? b.changePct - a.changePct : a.changePct - b.changePct);
    return hits.slice(0, n);
  }
}

// ─── Additional scan functions ──────────────────────────────────────────────

function scanMostActive(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minDollarVol = Number(params.minDollarVolume ?? 10e6);
  const dollarVol = snap.price * snap.volume;
  if (dollarVol < minDollarVol) return null;

  return {
    symbol: snap.symbol,
    scanner: 'MOST_ACTIVE',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: snap.prevClose > 0 ? ((snap.price - snap.prevClose) / snap.prevClose) * 100 : 0,
    volume: snap.volume,
    detail: `Dollar volume: $${formatVolume(dollarVol)}`,
    severity: dollarVol >= 100e6 ? 'HIGH' : dollarVol >= 50e6 ? 'MEDIUM' : 'LOW',
    metadata: { dollarVolume: dollarVol },
  };
}

function scanTopGainer(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minPct = Number(params.minPct ?? 3);
  if (snap.prevClose <= 0) return null;

  const pct = ((snap.price - snap.prevClose) / snap.prevClose) * 100;
  if (pct < minPct) return null;

  return {
    symbol: snap.symbol,
    scanner: 'TOP_GAINER',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: pct,
    volume: snap.volume,
    detail: `+${pct.toFixed(2)}% gain`,
    severity: pct >= 10 ? 'HIGH' : pct >= 5 ? 'MEDIUM' : 'LOW',
  };
}

function scanTopLoser(snap: SymbolSnapshot, params: Record<string, number | string | boolean>): ScannerHit | null {
  const minPct = Number(params.minPct ?? 3);
  if (snap.prevClose <= 0) return null;

  const pct = ((snap.price - snap.prevClose) / snap.prevClose) * 100;
  if (pct > -minPct) return null;

  return {
    symbol: snap.symbol,
    scanner: 'TOP_LOSER',
    timestamp: Date.now(),
    price: snap.price,
    change: snap.price - snap.prevClose,
    changePct: pct,
    volume: snap.volume,
    detail: `${pct.toFixed(2)}% decline`,
    severity: pct <= -10 ? 'HIGH' : pct <= -5 ? 'MEDIUM' : 'LOW',
  };
}

// ─── Default Scanner Configs ────────────────────────────────────────────────

export const DEFAULT_SCANNER_CONFIGS: ScannerConfig[] = [
  { type: 'PRICE_BREAKOUT', enabled: true, params: { threshold: 0.5 }, minSeverity: 'MEDIUM' },
  { type: 'VOLUME_SPIKE', enabled: true, params: { multiplier: 2.0 }, minSeverity: 'MEDIUM' },
  { type: 'GAP', enabled: true, params: { minGapPct: 2.0 }, minSeverity: 'LOW' },
  { type: 'RELATIVE_STRENGTH', enabled: true, params: { minRS: 1.5 }, minSeverity: 'MEDIUM' },
  { type: 'UNUSUAL_OPTIONS', enabled: true, params: { multiplier: 2.0 }, minSeverity: 'MEDIUM' },
  { type: 'MOMENTUM', enabled: true, params: { minRsi: 70, maxRsi: 30 }, minSeverity: 'MEDIUM' },
  { type: 'EARNINGS_MOMENTUM', enabled: true, params: { minSurprisePct: 5 }, minSeverity: 'MEDIUM' },
  { type: 'PRE_MARKET_MOVER', enabled: true, params: { minMovePct: 3 }, minSeverity: 'LOW' },
  { type: 'ALL_TIME_HIGH', enabled: true, params: {}, minSeverity: 'HIGH' },
  { type: 'ALL_TIME_LOW', enabled: true, params: {}, minSeverity: 'HIGH' },
  { type: 'MOST_ACTIVE', enabled: true, params: { minDollarVolume: 10e6 }, minSeverity: 'LOW' },
  { type: 'TOP_GAINER', enabled: true, params: { minPct: 3 }, minSeverity: 'LOW' },
  { type: 'TOP_LOSER', enabled: true, params: { minPct: 3 }, minSeverity: 'LOW' },
];
