// ─── Message Protocol ───────────────────────────────────────────────────────

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ScreenCriterion {
  field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between' | 'crosses_above' | 'crosses_below';
  value: number;
  value2?: number;
  indicator?: { type: string; period: number };
}

interface ScreenConfig {
  criteria: ScreenCriterion[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  maxResults: number;
  formula?: string;
}

interface SymbolData {
  symbol: string;
  bars: BarData[];
  metadata?: Record<string, number | string>;
}

interface ScreenResult {
  symbol: string;
  rank: number;
  matchedCriteria: number;
  totalCriteria: number;
  values: Record<string, number>;
  formulaResult?: number;
}

interface InboundMessage {
  type: 'screen' | 'rescreen' | 'formula' | 'cancel';
  taskId: string;
  universe?: SymbolData[];
  config?: ScreenConfig;
  updatedSymbols?: SymbolData[];
  expression?: string;
}

interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready' | 'partial';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

// ─── Indicator Helpers ──────────────────────────────────────────────────────

function sma(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  const k = 2 / (period + 1);
  let s = 0;
  for (let i = 0; i < period; i++) s += data[i];
  let prev = s / period;
  out[period - 1] = prev;
  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

function rsi(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i] - data[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i] - data[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function atr(bars: BarData[], period: number): number[] {
  const out = new Array(bars.length).fill(NaN);
  if (bars.length < 2) return out;
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    ));
  }
  let s = 0;
  for (let i = 0; i < Math.min(period, tr.length); i++) s += tr[i];
  out[period - 1] = s / period;
  for (let i = period; i < tr.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

// ─── Field Resolution ───────────────────────────────────────────────────────

function resolveField(sym: SymbolData, field: string, indicator?: { type: string; period: number }): number {
  const bars = sym.bars;
  if (!bars.length) return NaN;
  const last = bars[bars.length - 1];
  const closes = bars.map(b => b.close);

  if (indicator) {
    let values: number[];
    switch (indicator.type) {
      case 'sma': values = sma(closes, indicator.period); break;
      case 'ema': values = ema(closes, indicator.period); break;
      case 'rsi': values = rsi(closes, indicator.period); break;
      case 'atr': values = atr(bars, indicator.period); break;
      default: return NaN;
    }
    return values[values.length - 1] ?? NaN;
  }

  switch (field) {
    case 'close': return last.close;
    case 'open': return last.open;
    case 'high': return last.high;
    case 'low': return last.low;
    case 'volume': return last.volume;
    case 'change': return bars.length > 1 ? last.close - bars[bars.length - 2].close : 0;
    case 'changePct': return bars.length > 1 ? ((last.close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100 : 0;
    case 'range': return last.high - last.low;
    case 'avgVolume': {
      const period = Math.min(20, bars.length);
      const slice = bars.slice(-period);
      return slice.reduce((s, b) => s + b.volume, 0) / period;
    }
    case 'relativeVolume': {
      const period = Math.min(20, bars.length);
      const avgVol = bars.slice(-period - 1, -1).reduce((s, b) => s + b.volume, 0) / period;
      return avgVol > 0 ? last.volume / avgVol : 0;
    }
    case 'high52w': {
      const lookback = Math.min(252, bars.length);
      return Math.max(...bars.slice(-lookback).map(b => b.high));
    }
    case 'low52w': {
      const lookback = Math.min(252, bars.length);
      return Math.min(...bars.slice(-lookback).map(b => b.low));
    }
    case 'volatility': {
      if (bars.length < 21) return NaN;
      const rets: number[] = [];
      for (let i = bars.length - 20; i < bars.length; i++) {
        rets.push(Math.log(bars[i].close / bars[i - 1].close));
      }
      const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
      const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / (rets.length - 1);
      return Math.sqrt(variance * 252) * 100;
    }
    default: {
      const meta = sym.metadata?.[field];
      return typeof meta === 'number' ? meta : NaN;
    }
  }
}

function resolvePreviousField(sym: SymbolData, field: string, indicator?: { type: string; period: number }): number {
  const bars = sym.bars;
  if (bars.length < 2) return NaN;

  if (indicator) {
    const closes = bars.map(b => b.close);
    let values: number[];
    switch (indicator.type) {
      case 'sma': values = sma(closes, indicator.period); break;
      case 'ema': values = ema(closes, indicator.period); break;
      case 'rsi': values = rsi(closes, indicator.period); break;
      case 'atr': values = atr(bars, indicator.period); break;
      default: return NaN;
    }
    return values[values.length - 2] ?? NaN;
  }

  const prev = bars[bars.length - 2];
  switch (field) {
    case 'close': return prev.close;
    case 'open': return prev.open;
    case 'high': return prev.high;
    case 'low': return prev.low;
    case 'volume': return prev.volume;
    default: return NaN;
  }
}

// ─── Criterion Evaluation ───────────────────────────────────────────────────

function evaluateCriterion(sym: SymbolData, criterion: ScreenCriterion): boolean {
  const val = resolveField(sym, criterion.field, criterion.indicator);
  if (isNaN(val)) return false;

  switch (criterion.operator) {
    case 'gt': return val > criterion.value;
    case 'lt': return val < criterion.value;
    case 'gte': return val >= criterion.value;
    case 'lte': return val <= criterion.value;
    case 'eq': return Math.abs(val - criterion.value) < 1e-10;
    case 'neq': return Math.abs(val - criterion.value) >= 1e-10;
    case 'between': return val >= criterion.value && val <= (criterion.value2 ?? Infinity);
    case 'crosses_above': {
      const prev = resolvePreviousField(sym, criterion.field, criterion.indicator);
      return !isNaN(prev) && prev <= criterion.value && val > criterion.value;
    }
    case 'crosses_below': {
      const prev = resolvePreviousField(sym, criterion.field, criterion.indicator);
      return !isNaN(prev) && prev >= criterion.value && val < criterion.value;
    }
    default: return false;
  }
}

// ─── Custom Formula Evaluation ──────────────────────────────────────────────

function evaluateFormula(sym: SymbolData, expression: string): number {
  try {
    const bars = sym.bars;
    if (!bars.length) return NaN;
    const last = bars[bars.length - 1];
    const closes = bars.map(b => b.close);

    const resolved = expression
      .replace(/sma\((\d+)\)/g, (_, p) => {
        const vals = sma(closes, Number(p));
        return String(vals[vals.length - 1] ?? NaN);
      })
      .replace(/ema\((\d+)\)/g, (_, p) => {
        const vals = ema(closes, Number(p));
        return String(vals[vals.length - 1] ?? NaN);
      })
      .replace(/rsi\((\d+)\)/g, (_, p) => {
        const vals = rsi(closes, Number(p));
        return String(vals[vals.length - 1] ?? NaN);
      })
      .replace(/close/g, String(last.close))
      .replace(/open/g, String(last.open))
      .replace(/high/g, String(last.high))
      .replace(/low/g, String(last.low))
      .replace(/volume/g, String(last.volume));

    return Number(new Function(`return ${resolved}`)());
  } catch {
    return NaN;
  }
}

// ─── Screen Execution ───────────────────────────────────────────────────────

function executeScreen(
  universe: SymbolData[],
  config: ScreenConfig,
  progressCb: (p: number) => void,
  partialCb: (results: ScreenResult[]) => void,
  isCancelled: () => boolean,
): ScreenResult[] {
  const results: ScreenResult[] = [];
  const batchSize = Math.max(1, Math.floor(universe.length / 20));

  for (let i = 0; i < universe.length; i++) {
    if (isCancelled()) break;

    const sym = universe[i];
    let matched = 0;
    const values: Record<string, number> = {};

    for (const criterion of config.criteria) {
      const val = resolveField(sym, criterion.field, criterion.indicator);
      values[criterion.field] = val;
      if (evaluateCriterion(sym, criterion)) matched++;
    }

    if (matched === config.criteria.length) {
      const formulaResult = config.formula ? evaluateFormula(sym, config.formula) : undefined;
      const sortVal = values[config.sortField] ?? resolveField(sym, config.sortField);
      values[config.sortField] = sortVal;

      results.push({
        symbol: sym.symbol,
        rank: 0,
        matchedCriteria: matched,
        totalCriteria: config.criteria.length,
        values,
        formulaResult,
      });
    }

    if ((i + 1) % batchSize === 0) {
      progressCb((i + 1) / universe.length);
      if (results.length > 0) {
        partialCb(results.slice(-batchSize));
      }
    }
  }

  const direction = config.sortDirection === 'asc' ? 1 : -1;
  results.sort((a, b) => {
    const va = a.values[config.sortField] ?? 0;
    const vb = b.values[config.sortField] ?? 0;
    return (va - vb) * direction;
  });

  for (let i = 0; i < results.length; i++) {
    results[i].rank = i + 1;
  }

  return results.slice(0, config.maxResults);
}

// ─── Re-screening (Incremental Update) ─────────────────────────────────────

let cachedResults: ScreenResult[] = [];
let cachedUniverse: Map<string, SymbolData> = new Map();
let cachedConfig: ScreenConfig | null = null;

function rescreen(
  updatedSymbols: SymbolData[],
  config: ScreenConfig,
  progressCb: (p: number) => void,
): ScreenResult[] {
  for (const sym of updatedSymbols) {
    cachedUniverse.set(sym.symbol, sym);
  }

  const universe = Array.from(cachedUniverse.values());
  const results: ScreenResult[] = [];

  for (let i = 0; i < universe.length; i++) {
    const sym = universe[i];
    let matched = 0;
    const values: Record<string, number> = {};

    for (const criterion of config.criteria) {
      values[criterion.field] = resolveField(sym, criterion.field, criterion.indicator);
      if (evaluateCriterion(sym, criterion)) matched++;
    }

    if (matched === config.criteria.length) {
      results.push({
        symbol: sym.symbol,
        rank: 0,
        matchedCriteria: matched,
        totalCriteria: config.criteria.length,
        values,
        formulaResult: config.formula ? evaluateFormula(sym, config.formula) : undefined,
      });
    }

    progressCb((i + 1) / universe.length);
  }

  const direction = config.sortDirection === 'asc' ? 1 : -1;
  results.sort((a, b) => ((a.values[config.sortField] ?? 0) - (b.values[config.sortField] ?? 0)) * direction);
  for (let i = 0; i < results.length; i++) results[i].rank = i + 1;

  cachedResults = results.slice(0, config.maxResults);
  cachedConfig = config;
  return cachedResults;
}

// ─── Cancellation Tracking ──────────────────────────────────────────────────

const cancelledTasks = new Set<string>();

// ─── Message Handler ────────────────────────────────────────────────────────

const ctx = self as unknown as Worker;

function send(msg: OutboundMessage): void {
  ctx.postMessage(msg);
}

ctx.onmessage = (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelledTasks.add(msg.taskId);
    return;
  }

  const progressCb = (p: number) => send({ type: 'progress', taskId: msg.taskId, progress: p });
  const isCancelled = () => cancelledTasks.has(msg.taskId);

  try {
    switch (msg.type) {
      case 'screen': {
        if (!msg.universe?.length || !msg.config) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing universe or config' });
          return;
        }

        cachedUniverse = new Map(msg.universe.map(s => [s.symbol, s]));

        const results = executeScreen(
          msg.universe,
          msg.config,
          progressCb,
          partial => send({ type: 'partial', taskId: msg.taskId, data: partial }),
          isCancelled,
        );

        if (isCancelled()) {
          cancelledTasks.delete(msg.taskId);
          send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
          return;
        }

        cachedResults = results;
        cachedConfig = msg.config;
        send({ type: 'result', taskId: msg.taskId, data: { results, total: msg.universe.length, matched: results.length } });
        return;
      }

      case 'rescreen': {
        if (!msg.updatedSymbols?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing updated symbols' });
          return;
        }

        const config = msg.config ?? cachedConfig;
        if (!config) {
          send({ type: 'error', taskId: msg.taskId, error: 'No screen config available' });
          return;
        }

        const results = rescreen(msg.updatedSymbols, config, progressCb);
        send({ type: 'result', taskId: msg.taskId, data: { results, total: cachedUniverse.size, matched: results.length } });
        return;
      }

      case 'formula': {
        if (!msg.universe?.length || !msg.expression) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing universe or expression' });
          return;
        }

        const formulaResults: { symbol: string; value: number }[] = [];
        for (let i = 0; i < msg.universe.length; i++) {
          const val = evaluateFormula(msg.universe[i], msg.expression);
          formulaResults.push({ symbol: msg.universe[i].symbol, value: val });
          if ((i + 1) % Math.max(1, Math.floor(msg.universe.length / 20)) === 0) {
            progressCb((i + 1) / msg.universe.length);
          }
        }

        formulaResults.sort((a, b) => b.value - a.value);
        send({ type: 'result', taskId: msg.taskId, data: formulaResults });
        return;
      }

      default:
        send({ type: 'error', taskId: msg.taskId, error: `Unknown message type: ${msg.type}` });
    }
  } catch (err) {
    send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
  }
};

send({ type: 'ready', taskId: '' });
