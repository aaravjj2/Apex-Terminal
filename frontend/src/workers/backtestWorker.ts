// ─── Message Protocol ───────────────────────────────────────────────────────

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategyRule {
  entryCondition: string;
  exitCondition: string;
  side: 'long' | 'short';
  quantity: number | 'percent';
  quantityValue: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
}

interface BacktestParams {
  initialCapital: number;
  commissionPerTrade: number;
  slippagePct: number;
  strategy: StrategyRule;
  params: Record<string, number>;
}

interface TradeResult {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  quantity: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  bars: number;
  exitReason: string;
}

interface BacktestResult {
  trades: TradeResult[];
  equityCurve: { time: number; equity: number }[];
  metrics: BacktestMetrics;
  executionTimeMs: number;
}

interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgTradeDuration: number;
  expectancy: number;
  payoffRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

interface InboundMessage {
  type: 'execute' | 'multi' | 'cancel';
  taskId: string;
  bars?: BarData[];
  config?: BacktestParams;
  configs?: BacktestParams[];
}

interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready' | 'intermediate';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

// ─── Simple Expression Evaluator ────────────────────────────────────────────

interface IndicatorCache {
  sma: Map<number, number[]>;
  ema: Map<number, number[]>;
  rsi: Map<number, number[]>;
}

function buildCache(bars: BarData[]): IndicatorCache {
  return { sma: new Map(), ema: new Map(), rsi: new Map() };
}

function getSMA(data: number[], period: number, cache: IndicatorCache): number[] {
  if (cache.sma.has(period)) return cache.sma.get(period)!;
  const out = new Array(data.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  cache.sma.set(period, out);
  return out;
}

function getEMA(data: number[], period: number, cache: IndicatorCache): number[] {
  if (cache.ema.has(period)) return cache.ema.get(period)!;
  const out = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * k + prev;
    out[i] = prev;
  }
  cache.ema.set(period, out);
  return out;
}

function getRSI(data: number[], period: number, cache: IndicatorCache): number[] {
  if (cache.rsi.has(period)) return cache.rsi.get(period)!;
  const out = new Array(data.length).fill(NaN);
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
  cache.rsi.set(period, out);
  return out;
}

function evaluateCondition(
  condition: string,
  idx: number,
  bars: BarData[],
  closes: number[],
  cache: IndicatorCache,
  params: Record<string, number>,
): boolean {
  try {
    const resolved = condition.replace(/sma\((\d+)\)/g, (_, p) => {
      const vals = getSMA(closes, Number(p), cache);
      return String(vals[idx] ?? NaN);
    }).replace(/ema\((\d+)\)/g, (_, p) => {
      const vals = getEMA(closes, Number(p), cache);
      return String(vals[idx] ?? NaN);
    }).replace(/rsi\((\d+)\)/g, (_, p) => {
      const vals = getRSI(closes, Number(p), cache);
      return String(vals[idx] ?? NaN);
    }).replace(/close/g, String(closes[idx]))
      .replace(/open/g, String(bars[idx].open))
      .replace(/high/g, String(bars[idx].high))
      .replace(/low/g, String(bars[idx].low))
      .replace(/volume/g, String(bars[idx].volume))
      .replace(/\bparam\.(\w+)/g, (_, name) => String(params[name] ?? 0));

    return Boolean(new Function(`return ${resolved}`)());
  } catch {
    return false;
  }
}

// ─── Backtest Engine ────────────────────────────────────────────────────────

function executeBacktest(
  bars: BarData[],
  config: BacktestParams,
  progressCallback?: (p: number) => void,
  isCancelled?: () => boolean,
): BacktestResult {
  const start = performance.now();
  const trades: TradeResult[] = [];
  const equityCurve: { time: number; equity: number }[] = [];
  const closes = bars.map(b => b.close);
  const cache = buildCache(bars);

  let cash = config.initialCapital;
  let position: { entryPrice: number; entryTime: number; entryIdx: number; side: 'long' | 'short'; quantity: number } | null = null;

  const warmup = 50;

  for (let i = warmup; i < bars.length; i++) {
    if (isCancelled?.()) break;

    const bar = bars[i];

    if (position) {
      const rule = config.strategy;
      let exitPrice = 0;
      let exitReason = '';

      if (position.side === 'long') {
        if (rule.stopLoss && bar.low <= position.entryPrice * (1 - rule.stopLoss / 100)) {
          exitPrice = position.entryPrice * (1 - rule.stopLoss / 100);
          exitReason = 'stop_loss';
        } else if (rule.takeProfit && bar.high >= position.entryPrice * (1 + rule.takeProfit / 100)) {
          exitPrice = position.entryPrice * (1 + rule.takeProfit / 100);
          exitReason = 'take_profit';
        }
      } else {
        if (rule.stopLoss && bar.high >= position.entryPrice * (1 + rule.stopLoss / 100)) {
          exitPrice = position.entryPrice * (1 + rule.stopLoss / 100);
          exitReason = 'stop_loss';
        } else if (rule.takeProfit && bar.low <= position.entryPrice * (1 - rule.takeProfit / 100)) {
          exitPrice = position.entryPrice * (1 - rule.takeProfit / 100);
          exitReason = 'take_profit';
        }
      }

      if (!exitReason && evaluateCondition(rule.exitCondition, i, bars, closes, cache, config.params)) {
        exitPrice = bar.close;
        exitReason = 'signal';
      }

      if (exitReason) {
        exitPrice *= (1 - config.slippagePct / 100 * (position.side === 'long' ? 1 : -1));
        const pnl = position.side === 'long'
          ? (exitPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - exitPrice) * position.quantity;
        const commission = config.commissionPerTrade;
        const netPnl = pnl - commission;

        trades.push({
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: position.entryPrice,
          exitPrice,
          side: position.side,
          quantity: position.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / (position.entryPrice * position.quantity)) * 100,
          commission,
          bars: i - position.entryIdx,
          exitReason,
        });

        cash += position.side === 'long'
          ? exitPrice * position.quantity - commission
          : position.entryPrice * position.quantity + pnl - commission;
        position = null;
      }
    }

    if (!position) {
      const rule = config.strategy;
      if (evaluateCondition(rule.entryCondition, i, bars, closes, cache, config.params)) {
        const qty = rule.quantity === 'percent'
          ? Math.floor((cash * (rule.quantityValue / 100)) / bar.close)
          : rule.quantityValue;

        if (qty > 0 && bar.close * qty <= cash) {
          const entryPrice = bar.close * (1 + config.slippagePct / 100 * (rule.side === 'long' ? 1 : -1));
          position = { entryPrice, entryTime: bar.time, entryIdx: i, side: rule.side, quantity: qty };
          cash -= entryPrice * qty;
        }
      }
    }

    const equity = position
      ? cash + (position.side === 'long'
          ? bar.close * position.quantity
          : position.entryPrice * position.quantity + (position.entryPrice - bar.close) * position.quantity)
      : cash;

    equityCurve.push({ time: bar.time, equity });

    if (i % Math.max(1, Math.floor(bars.length / 50)) === 0) {
      progressCallback?.((i - warmup) / (bars.length - warmup));
    }
  }

  if (position) {
    const lastBar = bars[bars.length - 1];
    const exitPrice = lastBar.close;
    const pnl = position.side === 'long'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;
    trades.push({
      entryTime: position.entryTime,
      exitTime: lastBar.time,
      entryPrice: position.entryPrice,
      exitPrice,
      side: position.side,
      quantity: position.quantity,
      pnl: pnl - config.commissionPerTrade,
      pnlPercent: ((pnl - config.commissionPerTrade) / (position.entryPrice * position.quantity)) * 100,
      commission: config.commissionPerTrade,
      bars: bars.length - 1 - position.entryIdx,
      exitReason: 'end_of_data',
    });
  }

  return {
    trades,
    equityCurve,
    metrics: computeMetrics(trades, equityCurve, config.initialCapital),
    executionTimeMs: performance.now() - start,
  };
}

// ─── Metrics Computation ────────────────────────────────────────────────────

function computeMetrics(
  trades: TradeResult[],
  equityCurve: { time: number; equity: number }[],
  initialCapital: number,
): BacktestMetrics {
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossWins = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));

  let maxDD = 0;
  let maxDDPct = 0;
  let peak = initialCapital;
  for (const ep of equityCurve) {
    if (ep.equity > peak) peak = ep.equity;
    const dd = peak - ep.equity;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    returns.push(prev > 0 ? (equityCurve[i].equity - prev) / prev : 0);
  }

  const avgReturn = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((s, v) => s + (v - avgReturn) ** 2, 0) / (returns.length - 1)) : 0;
  const downReturns = returns.filter(r => r < 0);
  const downDev = downReturns.length > 1 ? Math.sqrt(downReturns.reduce((s, v) => s + v ** 2, 0) / downReturns.length) : 0;

  let maxConsWins = 0;
  let maxConsLosses = 0;
  let cw = 0;
  let cl = 0;
  for (const t of trades) {
    if (t.pnl > 0) { cw++; cl = 0; maxConsWins = Math.max(maxConsWins, cw); }
    else { cl++; cw = 0; maxConsLosses = Math.max(maxConsLosses, cl); }
  }

  const avgWin = winners.length ? grossWins / winners.length : 0;
  const avgLoss = losers.length ? grossLosses / losers.length : 0;

  return {
    totalReturn: totalPnl,
    totalReturnPercent: (totalPnl / initialCapital) * 100,
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
    avgWin,
    avgLoss,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPct * 100,
    sharpeRatio: stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0,
    sortinoRatio: downDev > 0 ? (avgReturn / downDev) * Math.sqrt(252) : 0,
    avgTradeDuration: trades.length ? trades.reduce((s, t) => s + t.bars, 0) / trades.length : 0,
    expectancy: trades.length ? totalPnl / trades.length : 0,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    maxConsecutiveWins: maxConsWins,
    maxConsecutiveLosses: maxConsLosses,
  };
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

  switch (msg.type) {
    case 'cancel': {
      cancelledTasks.add(msg.taskId);
      return;
    }

    case 'execute': {
      try {
        if (!msg.bars?.length || !msg.config) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing bars or config' });
          return;
        }
        const result = executeBacktest(
          msg.bars,
          msg.config,
          p => send({ type: 'progress', taskId: msg.taskId, progress: p }),
          () => cancelledTasks.has(msg.taskId),
        );

        if (cancelledTasks.has(msg.taskId)) {
          cancelledTasks.delete(msg.taskId);
          send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
          return;
        }

        send({ type: 'result', taskId: msg.taskId, data: result });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;
    }

    case 'multi': {
      try {
        if (!msg.bars?.length || !msg.configs?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing bars or configs' });
          return;
        }

        const results: BacktestResult[] = [];
        for (let i = 0; i < msg.configs.length; i++) {
          if (cancelledTasks.has(msg.taskId)) {
            cancelledTasks.delete(msg.taskId);
            send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
            return;
          }

          const result = executeBacktest(msg.bars, msg.configs[i]);
          results.push(result);

          send({ type: 'intermediate', taskId: msg.taskId, data: { index: i, result } });
          send({ type: 'progress', taskId: msg.taskId, progress: (i + 1) / msg.configs.length });
        }

        send({ type: 'result', taskId: msg.taskId, data: results });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;
    }
  }
};

send({ type: 'ready', taskId: '' });
