// ─── Screener Types ─────────────────────────────────────────────────────────

export type ComparisonOp = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'BETWEEN' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';

export interface ScreenerCriteria {
  field: string;
  operator: ComparisonOp;
  value: number;
  value2?: number;  // for BETWEEN
  weight?: number;  // for ranking
}

export interface ScreenerConfig {
  name: string;
  description?: string;
  universe: string;
  criteria: ScreenerCriteria[];
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  limit?: number;
  customFormula?: string;
}

export interface ScreenerResult {
  symbol: string;
  rank: number;
  score: number;
  values: Record<string, number>;
  passedCriteria: string[];
  failedCriteria: string[];
}

export interface ScreenExecution {
  config: ScreenerConfig;
  results: ScreenerResult[];
  totalScanned: number;
  totalPassed: number;
  executionTimeMs: number;
  timestamp: number;
}

// ─── Stock Universe ─────────────────────────────────────────────────────────

export interface StockData {
  symbol: string;
  [key: string]: number | string | boolean | undefined;
}

export class UniverseManager {
  private universes = new Map<string, Set<string>>();

  register(name: string, symbols: string[]): void {
    this.universes.set(name, new Set(symbols));
  }

  get(name: string): Set<string> {
    return this.universes.get(name) ?? new Set();
  }

  combine(names: string[]): Set<string> {
    const result = new Set<string>();
    for (const name of names) {
      for (const sym of this.get(name)) result.add(sym);
    }
    return result;
  }

  exclude(baseName: string, excludeName: string): Set<string> {
    const base = this.get(baseName);
    const excluded = this.get(excludeName);
    const result = new Set<string>();
    for (const sym of base) {
      if (!excluded.has(sym)) result.add(sym);
    }
    return result;
  }

  addToUniverse(name: string, symbol: string): void {
    let u = this.universes.get(name);
    if (!u) { u = new Set(); this.universes.set(name, u); }
    u.add(symbol);
  }

  removeFromUniverse(name: string, symbol: string): void {
    this.universes.get(name)?.delete(symbol);
  }

  listUniverses(): string[] {
    return Array.from(this.universes.keys());
  }
}

// ─── Expression Evaluator ───────────────────────────────────────────────────

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'FUNC';
interface Token { type: TokenType; value: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue; }
    if ('+-*/()'.includes(expr[i])) {
      tokens.push({ type: expr[i] === '(' ? 'LPAREN' : expr[i] === ')' ? 'RPAREN' : 'OP', value: expr[i] });
      i++;
    } else if (/\d/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) { num += expr[i]; i++; }
      tokens.push({ type: 'NUMBER', value: num });
    } else if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) { ident += expr[i]; i++; }
      if (i < expr.length && expr[i] === '(') {
        tokens.push({ type: 'FUNC', value: ident });
      } else {
        tokens.push({ type: 'IDENT', value: ident });
      }
    } else {
      i++;
    }
  }
  return tokens;
}

const BUILTIN_FUNCS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  log: Math.log,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

export function evaluateExpression(expr: string, vars: Record<string, number>): number {
  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function advance(): Token { return tokens[pos++]; }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.type === 'OP' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = advance().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (peek()?.type === 'OP' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = advance().value;
      const right = parseFactor();
      left = op === '*' ? left * right : (right !== 0 ? left / right : NaN);
    }
    return left;
  }

  function parseFactor(): number {
    const t = peek();
    if (!t) return NaN;

    if (t.type === 'NUMBER') {
      advance();
      return parseFloat(t.value);
    }
    if (t.type === 'IDENT') {
      advance();
      return vars[t.value] ?? NaN;
    }
    if (t.type === 'FUNC') {
      const fname = advance().value;
      advance(); // LPAREN
      const args: number[] = [];
      while (peek() && peek()!.type !== 'RPAREN') {
        args.push(parseExpr());
        if (peek()?.value === ',') advance();
      }
      if (peek()?.type === 'RPAREN') advance();
      const fn = BUILTIN_FUNCS[fname.toLowerCase()];
      return fn ? fn(...args) : NaN;
    }
    if (t.type === 'LPAREN') {
      advance();
      const val = parseExpr();
      if (peek()?.type === 'RPAREN') advance();
      return val;
    }
    if (t.type === 'OP' && t.value === '-') {
      advance();
      return -parseFactor();
    }
    advance();
    return NaN;
  }

  const result = parseExpr();
  return isFinite(result) ? result : NaN;
}

// ─── Filter Evaluation ──────────────────────────────────────────────────────

function evalCriteria(criteria: ScreenerCriteria, data: StockData, prevData?: StockData): boolean {
  const val = Number(data[criteria.field]);
  if (!isFinite(val)) return false;

  switch (criteria.operator) {
    case 'GT':  return val > criteria.value;
    case 'GTE': return val >= criteria.value;
    case 'LT':  return val < criteria.value;
    case 'LTE': return val <= criteria.value;
    case 'EQ':  return Math.abs(val - criteria.value) < 1e-9;
    case 'NEQ': return Math.abs(val - criteria.value) >= 1e-9;
    case 'BETWEEN':
      return criteria.value2 !== undefined && val >= criteria.value && val <= criteria.value2;
    case 'CROSSES_ABOVE': {
      if (!prevData) return false;
      const prevVal = Number(prevData[criteria.field]);
      return isFinite(prevVal) && prevVal <= criteria.value && val > criteria.value;
    }
    case 'CROSSES_BELOW': {
      if (!prevData) return false;
      const prevVal = Number(prevData[criteria.field]);
      return isFinite(prevVal) && prevVal >= criteria.value && val < criteria.value;
    }
    default: return false;
  }
}

// ─── Screener Engine ────────────────────────────────────────────────────────

export class ScreenerEngine {
  private universeManager = new UniverseManager();
  private dataProvider: (symbol: string) => StockData | null;
  private prevDataProvider?: (symbol: string) => StockData | null;

  constructor(
    dataProvider: (symbol: string) => StockData | null,
    prevDataProvider?: (symbol: string) => StockData | null,
  ) {
    this.dataProvider = dataProvider;
    this.prevDataProvider = prevDataProvider;
  }

  getUniverseManager(): UniverseManager { return this.universeManager; }

  execute(config: ScreenerConfig): ScreenExecution {
    const start = performance.now();
    const universe = this.universeManager.get(config.universe);
    const results: ScreenerResult[] = [];

    for (const symbol of universe) {
      const data = this.dataProvider(symbol);
      if (!data) continue;

      const prevData = this.prevDataProvider?.(symbol) ?? undefined;
      const passed: string[] = [];
      const failed: string[] = [];
      let allPassed = true;

      for (const criteria of config.criteria) {
        if (evalCriteria(criteria, data, prevData)) {
          passed.push(criteria.field);
        } else {
          failed.push(criteria.field);
          allPassed = false;
        }
      }

      if (!allPassed) continue;

      let score = 0;
      if (config.customFormula) {
        const vars: Record<string, number> = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'number') vars[k] = v;
        }
        score = evaluateExpression(config.customFormula, vars);
      } else {
        score = computeScore(config.criteria, data);
      }

      const values: Record<string, number> = {};
      for (const c of config.criteria) {
        const v = Number(data[c.field]);
        if (isFinite(v)) values[c.field] = v;
      }

      results.push({ symbol, rank: 0, score, values, passedCriteria: passed, failedCriteria: failed });
    }

    const sortField = config.sortField ?? 'score';
    const sortDir = config.sortDirection === 'ASC' ? 1 : -1;
    results.sort((a, b) => {
      const aVal = sortField === 'score' ? a.score : (a.values[sortField] ?? 0);
      const bVal = sortField === 'score' ? b.score : (b.values[sortField] ?? 0);
      return (bVal - aVal) * sortDir;
    });

    const limited = config.limit ? results.slice(0, config.limit) : results;
    limited.forEach((r, i) => r.rank = i + 1);

    return {
      config,
      results: limited,
      totalScanned: universe.size,
      totalPassed: results.length,
      executionTimeMs: performance.now() - start,
      timestamp: Date.now(),
    };
  }

  topN(config: ScreenerConfig, n: number): ScreenerResult[] {
    const result = this.execute({ ...config, limit: n });
    return result.results;
  }
}

function computeScore(criteria: ScreenerCriteria[], data: StockData): number {
  let score = 0;
  let totalWeight = 0;
  for (const c of criteria) {
    const val = Number(data[c.field]);
    if (!isFinite(val)) continue;
    const weight = c.weight ?? 1;
    const distance = c.operator === 'GT' || c.operator === 'GTE'
      ? (val - c.value) / Math.max(Math.abs(c.value), 1)
      : c.operator === 'LT' || c.operator === 'LTE'
        ? (c.value - val) / Math.max(Math.abs(c.value), 1)
        : 1;
    score += distance * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? score / totalWeight : 0;
}

// ─── Real-time Scanner (streaming filter) ───────────────────────────────────

export class RealtimeScreener {
  private engine: ScreenerEngine;
  private config: ScreenerConfig;
  private listeners: Array<(results: ScreenerResult[]) => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastResults: ScreenerResult[] = [];

  constructor(engine: ScreenerEngine, config: ScreenerConfig) {
    this.engine = engine;
    this.config = config;
  }

  start(refreshMs = 1_000): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), refreshMs);
    this.tick();
  }

  stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  onChange(cb: (results: ScreenerResult[]) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  private tick(): void {
    const exec = this.engine.execute(this.config);
    const changed = this.detectChanges(exec.results);
    this.lastResults = exec.results;
    if (changed) {
      for (const cb of this.listeners) { try { cb(exec.results); } catch { /* */ } }
    }
  }

  private detectChanges(newResults: ScreenerResult[]): boolean {
    if (newResults.length !== this.lastResults.length) return true;
    for (let i = 0; i < newResults.length; i++) {
      if (newResults[i].symbol !== this.lastResults[i].symbol) return true;
      if (Math.abs(newResults[i].score - this.lastResults[i].score) > 1e-6) return true;
    }
    return false;
  }

  getResults(): ScreenerResult[] { return [...this.lastResults]; }
}

// ─── Screen Alert ───────────────────────────────────────────────────────────

export interface ScreenAlert {
  id: string;
  screenName: string;
  type: 'ENTERED' | 'EXITED';
  symbol: string;
  timestamp: number;
  values: Record<string, number>;
}

export class ScreenAlertMonitor {
  private previousSymbols = new Set<string>();
  private alerts: ScreenAlert[] = [];
  private listeners: Array<(alert: ScreenAlert) => void> = [];
  private alertIdCounter = 0;

  onAlert(cb: (alert: ScreenAlert) => void): () => void {
    this.listeners.push(cb);
    return () => { const i = this.listeners.indexOf(cb); if (i >= 0) this.listeners.splice(i, 1); };
  }

  update(screenName: string, results: ScreenerResult[]): void {
    const current = new Set(results.map(r => r.symbol));

    for (const r of results) {
      if (!this.previousSymbols.has(r.symbol)) {
        this.emit({ id: String(++this.alertIdCounter), screenName, type: 'ENTERED', symbol: r.symbol, timestamp: Date.now(), values: r.values });
      }
    }
    for (const sym of this.previousSymbols) {
      if (!current.has(sym)) {
        this.emit({ id: String(++this.alertIdCounter), screenName, type: 'EXITED', symbol: sym, timestamp: Date.now(), values: {} });
      }
    }

    this.previousSymbols = current;
  }

  private emit(alert: ScreenAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > 1000) this.alerts = this.alerts.slice(-500);
    for (const cb of this.listeners) { try { cb(alert); } catch { /* */ } }
  }

  getRecent(count = 50): ScreenAlert[] { return this.alerts.slice(-count); }
}

// ─── Screen Backtester ──────────────────────────────────────────────────────

export interface ScreenBacktestResult {
  dates: string[];
  returns: number[];
  cumulativeReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  avgHolding: number;
  turnover: number;
}

export class ScreenBacktester {
  private historicalData: Map<string, Map<string, StockData>>;

  constructor(historicalData: Map<string, Map<string, StockData>>) {
    this.historicalData = historicalData;
  }

  backtest(
    config: ScreenerConfig,
    dates: string[],
    holdingPeriodDays = 20,
  ): ScreenBacktestResult {
    const returns: number[] = [];
    const holdings = new Map<string, { entryDate: string; entryPrice: number }>();
    let wins = 0, totalTrades = 0;
    let totalHolding = 0;
    let equity = 1;
    let peak = 1;
    let maxDd = 0;
    let turnoverSum = 0;

    for (let d = 0; d < dates.length; d++) {
      const date = dates[d];
      const snapshot = this.historicalData.get(date);
      if (!snapshot) { returns.push(0); continue; }

      const dataProvider = (symbol: string) => snapshot.get(symbol) ?? null;
      const engine = new ScreenerEngine(dataProvider);
      engine.getUniverseManager().register(config.universe, Array.from(snapshot.keys()));

      const exec = engine.execute(config);
      const selected = new Set(exec.results.map(r => r.symbol));

      let periodReturn = 0;
      let positionCount = 0;

      for (const [sym, holding] of holdings) {
        const data = snapshot.get(sym);
        if (!data) continue;
        const price = Number(data.close ?? data.price);
        if (!isFinite(price) || holding.entryPrice <= 0) continue;

        const ret = (price - holding.entryPrice) / holding.entryPrice;
        periodReturn += ret;
        positionCount++;

        const entryIdx = dates.indexOf(holding.entryDate);
        if (entryIdx >= 0 && d - entryIdx >= holdingPeriodDays) {
          if (ret > 0) wins++;
          totalTrades++;
          totalHolding += d - entryIdx;
          holdings.delete(sym);
        }
      }

      for (const sym of selected) {
        if (holdings.has(sym)) continue;
        const data = snapshot.get(sym);
        const price = Number(data?.close ?? data?.price);
        if (isFinite(price) && price > 0) {
          holdings.set(sym, { entryDate: date, entryPrice: price });
        }
      }

      const prevSize = positionCount || 1;
      const dailyRet = positionCount > 0 ? periodReturn / positionCount : 0;
      returns.push(dailyRet);
      equity *= (1 + dailyRet);
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDd) maxDd = dd;
      turnoverSum += Math.abs(selected.size - prevSize) / Math.max(prevSize, 1);
    }

    const cumReturn = equity - 1;
    const years = dates.length / 252;
    const annReturn = years > 0 ? Math.pow(1 + cumReturn, 1 / years) - 1 : 0;
    const avgRet = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
    const stdRet = Math.sqrt(returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (returns.length || 1));
    const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    return {
      dates,
      returns,
      cumulativeReturn: cumReturn,
      annualizedReturn: annReturn,
      maxDrawdown: maxDd,
      sharpeRatio: sharpe,
      winRate: totalTrades > 0 ? wins / totalTrades : 0,
      avgHolding: totalTrades > 0 ? totalHolding / totalTrades : 0,
      turnover: turnoverSum / (dates.length || 1),
    };
  }
}

// ─── Pre-built Screens ──────────────────────────────────────────────────────

export const PREBUILT_SCREENS: Record<string, ScreenerConfig> = {
  VALUE_STOCKS: {
    name: 'Value Stocks',
    description: 'Low valuation, profitable companies',
    universe: 'SP500',
    criteria: [
      { field: 'pe', operator: 'LT', value: 15, weight: 2 },
      { field: 'pb', operator: 'LT', value: 2, weight: 1.5 },
      { field: 'dividendYield', operator: 'GT', value: 2, weight: 1 },
      { field: 'profitMargin', operator: 'GT', value: 5, weight: 1 },
      { field: 'debtEquity', operator: 'LT', value: 1.5, weight: 1 },
    ],
    sortField: 'score',
    sortDirection: 'DESC',
    limit: 30,
  },

  GROWTH_STOCKS: {
    name: 'Growth Stocks',
    description: 'High revenue and earnings growth',
    universe: 'SP500',
    criteria: [
      { field: 'revenueGrowth', operator: 'GT', value: 15, weight: 2 },
      { field: 'earningsGrowth', operator: 'GT', value: 20, weight: 2 },
      { field: 'roe', operator: 'GT', value: 15, weight: 1 },
      { field: 'profitMargin', operator: 'GT', value: 10, weight: 1 },
    ],
    sortField: 'earningsGrowth',
    sortDirection: 'DESC',
    limit: 30,
  },

  MOMENTUM: {
    name: 'Momentum',
    description: 'Strong recent price performance',
    universe: 'RUSSELL2000',
    criteria: [
      { field: 'rsi14', operator: 'BETWEEN', value: 50, value2: 80, weight: 1 },
      { field: 'priceVsSma50', operator: 'GT', value: 0, weight: 1.5 },
      { field: 'priceVsSma200', operator: 'GT', value: 0, weight: 1 },
      { field: 'volumeRatio', operator: 'GT', value: 1.2, weight: 1 },
      { field: 'return3m', operator: 'GT', value: 10, weight: 2 },
    ],
    sortField: 'return3m',
    sortDirection: 'DESC',
    limit: 30,
  },

  QUALITY: {
    name: 'Quality',
    description: 'High-quality profitable businesses',
    universe: 'SP500',
    criteria: [
      { field: 'roe', operator: 'GT', value: 20, weight: 2 },
      { field: 'roa', operator: 'GT', value: 10, weight: 1.5 },
      { field: 'profitMargin', operator: 'GT', value: 15, weight: 1.5 },
      { field: 'currentRatio', operator: 'GT', value: 1.5, weight: 1 },
      { field: 'debtEquity', operator: 'LT', value: 0.5, weight: 1 },
    ],
    sortField: 'roe',
    sortDirection: 'DESC',
    limit: 30,
  },

  DIVIDEND: {
    name: 'Dividend',
    description: 'High dividend yield with sustainability',
    universe: 'SP500',
    criteria: [
      { field: 'dividendYield', operator: 'GT', value: 3, weight: 2 },
      { field: 'payoutRatio', operator: 'LT', value: 80, weight: 1.5 },
      { field: 'dividendGrowth5y', operator: 'GT', value: 3, weight: 1.5 },
      { field: 'fcfYield', operator: 'GT', value: 4, weight: 1 },
    ],
    sortField: 'dividendYield',
    sortDirection: 'DESC',
    limit: 30,
  },

  LOW_VOLATILITY: {
    name: 'Low Volatility',
    description: 'Stable, low-beta stocks',
    universe: 'SP500',
    criteria: [
      { field: 'beta', operator: 'LT', value: 0.8, weight: 2 },
      { field: 'volatility30d', operator: 'LT', value: 20, weight: 1.5 },
      { field: 'maxDrawdown1y', operator: 'GT', value: -15, weight: 1 },
    ],
    sortField: 'volatility30d',
    sortDirection: 'ASC',
    limit: 30,
  },

  SMALL_CAP_GROWTH: {
    name: 'Small Cap Growth',
    description: 'Small caps with strong growth metrics',
    universe: 'RUSSELL2000',
    criteria: [
      { field: 'marketCap', operator: 'BETWEEN', value: 300e6, value2: 2e9, weight: 1 },
      { field: 'revenueGrowth', operator: 'GT', value: 20, weight: 2 },
      { field: 'earningsGrowth', operator: 'GT', value: 15, weight: 2 },
      { field: 'profitMargin', operator: 'GT', value: 5, weight: 1 },
    ],
    sortField: 'revenueGrowth',
    sortDirection: 'DESC',
    limit: 50,
  },

  GARP: {
    name: 'GARP',
    description: 'Growth at a Reasonable Price',
    universe: 'SP500',
    criteria: [
      { field: 'pegRatio', operator: 'BETWEEN', value: 0.5, value2: 1.5, weight: 3 },
      { field: 'earningsGrowth', operator: 'GT', value: 10, weight: 2 },
      { field: 'pe', operator: 'LT', value: 25, weight: 1.5 },
      { field: 'roe', operator: 'GT', value: 12, weight: 1 },
      { field: 'debtEquity', operator: 'LT', value: 1, weight: 1 },
    ],
    sortField: 'score',
    sortDirection: 'DESC',
    limit: 30,
    customFormula: 'earningsGrowth / max(pe, 1)',
  },
};
