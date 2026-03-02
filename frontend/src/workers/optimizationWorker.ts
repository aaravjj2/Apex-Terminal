// ─── Message Protocol ───────────────────────────────────────────────────────

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

interface ObjectiveConfig {
  metric: string;
  direction: 'maximize' | 'minimize';
  weight: number;
}

interface OptimizationConfig {
  method: 'grid' | 'walk_forward' | 'monte_carlo' | 'genetic';
  parameters: ParameterRange[];
  objectives: ObjectiveConfig[];
  strategyExpression: string;
  initialCapital: number;
  commission: number;
  slippagePct: number;
  seed?: number;
}

interface GridConfig extends OptimizationConfig {
  method: 'grid';
}

interface WalkForwardConfig extends OptimizationConfig {
  method: 'walk_forward';
  inSampleRatio: number;
  windows: number;
  anchored: boolean;
}

interface MonteCarloConfig extends OptimizationConfig {
  method: 'monte_carlo';
  simulations: number;
  confidenceLevel: number;
}

interface GeneticConfig extends OptimizationConfig {
  method: 'genetic';
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismRate: number;
  tournamentSize: number;
}

interface OptimizationResult {
  params: Record<string, number>;
  score: number;
  metrics: Record<string, number>;
}

interface InboundMessage {
  type: 'optimize' | 'cancel';
  taskId: string;
  bars?: BarData[];
  config?: OptimizationConfig;
}

interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready' | 'best_update';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

// ─── PRNG ───────────────────────────────────────────────────────────────────

class PRNG {
  private s: Uint32Array;
  constructor(seed: number) {
    this.s = new Uint32Array(4);
    this.s[0] = seed >>> 0;
    this.s[1] = (seed * 1812433253 + 1) >>> 0;
    this.s[2] = (this.s[1] * 1812433253 + 1) >>> 0;
    this.s[3] = (this.s[2] * 1812433253 + 1) >>> 0;
    for (let i = 0; i < 16; i++) this.next();
  }
  next(): number {
    const r = Math.imul(this.s[1] * 5, 7) >>> 0;
    const result = ((r << 9) | (r >>> 23)) * 9;
    const t = this.s[1] << 9;
    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];
    this.s[2] ^= t;
    this.s[3] = (this.s[3] << 11) | (this.s[3] >>> 21);
    return (result >>> 0) / 4294967296;
  }
  normalRandom(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

// ─── Lightweight Backtest for Optimization ──────────────────────────────────

function quickBacktest(
  bars: BarData[],
  params: Record<string, number>,
  config: OptimizationConfig,
): Record<string, number> {
  const closes = bars.map(b => b.close);
  const n = bars.length;
  let cash = config.initialCapital;
  let position = 0;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let peak = cash;
  let maxDD = 0;

  const fast = params['fast'] ?? 10;
  const slow = params['slow'] ?? 30;

  const smaFast = new Array(n).fill(NaN);
  const smaSlow = new Array(n).fill(NaN);
  let sumF = 0, sumS = 0;
  for (let i = 0; i < n; i++) {
    sumF += closes[i];
    sumS += closes[i];
    if (i >= fast) sumF -= closes[i - fast];
    if (i >= slow) sumS -= closes[i - slow];
    if (i >= fast - 1) smaFast[i] = sumF / fast;
    if (i >= slow - 1) smaSlow[i] = sumS / slow;
  }

  for (let i = slow; i < n; i++) {
    if (isNaN(smaFast[i]) || isNaN(smaSlow[i])) continue;
    const prevFast = smaFast[i - 1];
    const prevSlow = smaSlow[i - 1];
    if (isNaN(prevFast) || isNaN(prevSlow)) continue;

    if (position === 0 && prevFast <= prevSlow && smaFast[i] > smaSlow[i]) {
      const price = closes[i] * (1 + config.slippagePct / 100);
      const qty = Math.floor(cash / price);
      if (qty > 0) {
        position = qty;
        entryPrice = price;
        cash -= qty * price + config.commission;
      }
    } else if (position > 0 && prevFast >= prevSlow && smaFast[i] < smaSlow[i]) {
      const price = closes[i] * (1 - config.slippagePct / 100);
      const pnl = (price - entryPrice) * position - config.commission;
      cash += position * price - config.commission;
      trades++;
      if (pnl > 0) { wins++; grossWin += pnl; }
      else grossLoss += Math.abs(pnl);
      position = 0;
    }

    const equity = cash + position * closes[i];
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const finalEquity = cash + position * closes[n - 1];
  const totalReturn = finalEquity - config.initialCapital;
  const totalReturnPct = (totalReturn / config.initialCapital) * 100;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  const returns: number[] = [];
  let prevEq = config.initialCapital;
  for (let i = slow; i < n; i++) {
    const eq = cash + position * closes[i];
    returns.push(prevEq > 0 ? (eq - prevEq) / prevEq : 0);
    prevEq = eq;
  }
  const avgR = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const stdR = returns.length > 1 ? Math.sqrt(returns.reduce((s, v) => s + (v - avgR) ** 2, 0) / (returns.length - 1)) : 0;
  const sharpe = stdR > 0 ? (avgR / stdR) * Math.sqrt(252) : 0;

  return {
    totalReturn,
    totalReturnPercent: totalReturnPct,
    winRate,
    profitFactor,
    maxDrawdownPercent: maxDD * 100,
    sharpeRatio: sharpe,
    trades,
    finalEquity,
  };
}

function objectiveScore(metrics: Record<string, number>, objectives: ObjectiveConfig[]): number {
  let score = 0;
  for (const obj of objectives) {
    const val = metrics[obj.metric] ?? 0;
    score += (obj.direction === 'maximize' ? val : -val) * obj.weight;
  }
  return score;
}

// ─── Grid Search ────────────────────────────────────────────────────────────

function gridSearch(
  bars: BarData[],
  config: GridConfig,
  progressCb: (p: number) => void,
  isCancelled: () => boolean,
  bestCb: (r: OptimizationResult) => void,
): OptimizationResult[] {
  const combos = generateCombinations(config.parameters);
  const results: OptimizationResult[] = [];
  let best: OptimizationResult | null = null;

  for (let i = 0; i < combos.length; i++) {
    if (isCancelled()) break;
    const params = combos[i];
    const metrics = quickBacktest(bars, params, config);
    const score = objectiveScore(metrics, config.objectives);
    const result = { params, score, metrics };
    results.push(result);

    if (!best || score > best.score) {
      best = result;
      bestCb(best);
    }

    progressCb((i + 1) / combos.length);
  }

  return results.sort((a, b) => b.score - a.score);
}

function generateCombinations(ranges: ParameterRange[]): Record<string, number>[] {
  const combos: Record<string, number>[] = [];
  const values = ranges.map(r => {
    const vals: number[] = [];
    for (let v = r.min; v <= r.max; v += r.step) vals.push(Math.round(v * 1e10) / 1e10);
    return vals;
  });

  const indices = new Array(ranges.length).fill(0);
  while (true) {
    const combo: Record<string, number> = {};
    for (let i = 0; i < ranges.length; i++) combo[ranges[i].name] = values[i][indices[i]];
    combos.push(combo);

    let carry = true;
    for (let i = ranges.length - 1; i >= 0 && carry; i--) {
      indices[i]++;
      if (indices[i] < values[i].length) carry = false;
      else indices[i] = 0;
    }
    if (carry) break;
  }

  return combos;
}

// ─── Walk-Forward ───────────────────────────────────────────────────────────

function walkForward(
  bars: BarData[],
  config: WalkForwardConfig,
  progressCb: (p: number) => void,
  isCancelled: () => boolean,
  bestCb: (r: OptimizationResult) => void,
): { windows: { inSampleBest: OptimizationResult; outOfSample: Record<string, number> }[]; combined: OptimizationResult[] } {
  const totalBars = bars.length;
  const windowSize = Math.floor(totalBars / config.windows);
  const inSampleSize = Math.floor(windowSize * config.inSampleRatio);
  const windows: { inSampleBest: OptimizationResult; outOfSample: Record<string, number> }[] = [];

  for (let w = 0; w < config.windows; w++) {
    if (isCancelled()) break;

    const isStart = config.anchored ? 0 : w * (windowSize - inSampleSize);
    const isEnd = isStart + inSampleSize;
    const oosStart = isEnd;
    const oosEnd = Math.min(oosStart + (windowSize - inSampleSize), totalBars);

    if (oosEnd <= oosStart) continue;

    const isBars = bars.slice(isStart, isEnd);
    const oosBars = bars.slice(oosStart, oosEnd);

    const combos = generateCombinations(config.parameters);
    let bestIS: OptimizationResult | null = null;

    for (const params of combos) {
      const metrics = quickBacktest(isBars, params, config);
      const score = objectiveScore(metrics, config.objectives);
      if (!bestIS || score > bestIS.score) {
        bestIS = { params, score, metrics };
      }
    }

    if (bestIS) {
      const oosMetrics = quickBacktest(oosBars, bestIS.params, config);
      windows.push({ inSampleBest: bestIS, outOfSample: oosMetrics });
      bestCb(bestIS);
    }

    progressCb((w + 1) / config.windows);
  }

  return { windows, combined: windows.map(w => w.inSampleBest) };
}

// ─── Monte Carlo Simulation ─────────────────────────────────────────────────

function monteCarlo(
  bars: BarData[],
  config: MonteCarloConfig,
  progressCb: (p: number) => void,
  isCancelled: () => boolean,
): { simulations: { finalEquity: number; maxDrawdown: number; totalReturn: number }[]; percentiles: Record<string, number> } {
  const rng = new PRNG(config.seed ?? 42);
  const baseMetrics = quickBacktest(bars, {}, config);
  const closes = bars.map(b => b.close);

  const dailyReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    dailyReturns.push(closes[i] / closes[i - 1] - 1);
  }

  const simResults: { finalEquity: number; maxDrawdown: number; totalReturn: number }[] = [];

  for (let s = 0; s < config.simulations; s++) {
    if (isCancelled()) break;

    const shuffled = [...dailyReturns];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let equity = config.initialCapital;
    let peak = equity;
    let maxDD = 0;

    for (const ret of shuffled) {
      equity *= (1 + ret);
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    simResults.push({
      finalEquity: equity,
      maxDrawdown: maxDD * 100,
      totalReturn: ((equity - config.initialCapital) / config.initialCapital) * 100,
    });

    if ((s + 1) % Math.max(1, Math.floor(config.simulations / 50)) === 0) {
      progressCb((s + 1) / config.simulations);
    }
  }

  const sortedFinal = [...simResults].sort((a, b) => a.finalEquity - b.finalEquity);
  const sortedDD = [...simResults].sort((a, b) => a.maxDrawdown - b.maxDrawdown);
  const pIdx = (p: number) => Math.min(Math.floor(p * sortedFinal.length), sortedFinal.length - 1);

  return {
    simulations: simResults,
    percentiles: {
      p5_equity: sortedFinal[pIdx(0.05)]?.finalEquity ?? 0,
      p25_equity: sortedFinal[pIdx(0.25)]?.finalEquity ?? 0,
      p50_equity: sortedFinal[pIdx(0.50)]?.finalEquity ?? 0,
      p75_equity: sortedFinal[pIdx(0.75)]?.finalEquity ?? 0,
      p95_equity: sortedFinal[pIdx(0.95)]?.finalEquity ?? 0,
      p5_drawdown: sortedDD[pIdx(0.05)]?.maxDrawdown ?? 0,
      p95_drawdown: sortedDD[pIdx(0.95)]?.maxDrawdown ?? 0,
      median_return: sortedFinal[pIdx(0.50)]?.totalReturn ?? 0,
    },
  };
}

// ─── Genetic Algorithm ──────────────────────────────────────────────────────

function geneticOptimization(
  bars: BarData[],
  config: GeneticConfig,
  progressCb: (p: number) => void,
  isCancelled: () => boolean,
  bestCb: (r: OptimizationResult) => void,
): OptimizationResult[] {
  const rng = new PRNG(config.seed ?? 42);
  const params = config.parameters;

  const clampToStep = (val: number, range: ParameterRange): number => {
    const clamped = Math.max(range.min, Math.min(range.max, val));
    return Math.round(clamped / range.step) * range.step;
  };

  const randomIndividual = (): Record<string, number> => {
    const ind: Record<string, number> = {};
    for (const p of params) {
      const steps = Math.floor((p.max - p.min) / p.step);
      ind[p.name] = p.min + Math.floor(rng.next() * (steps + 1)) * p.step;
    }
    return ind;
  };

  let population = Array.from({ length: config.populationSize }, randomIndividual);
  let scored: OptimizationResult[] = population.map(ind => {
    const metrics = quickBacktest(bars, ind, config);
    return { params: ind, score: objectiveScore(metrics, config.objectives), metrics };
  });
  scored.sort((a, b) => b.score - a.score);

  let globalBest = scored[0];
  bestCb(globalBest);

  for (let gen = 0; gen < config.generations; gen++) {
    if (isCancelled()) break;

    const eliteCount = Math.max(1, Math.floor(config.populationSize * config.elitismRate));
    const nextGen: Record<string, number>[] = scored.slice(0, eliteCount).map(r => ({ ...r.params }));

    while (nextGen.length < config.populationSize) {
      const parent1 = tournamentSelect(scored, config.tournamentSize, rng);
      const parent2 = tournamentSelect(scored, config.tournamentSize, rng);

      let child: Record<string, number>;
      if (rng.next() < config.crossoverRate) {
        child = {};
        for (const p of params) {
          child[p.name] = rng.next() < 0.5 ? parent1.params[p.name] : parent2.params[p.name];
        }
      } else {
        child = { ...parent1.params };
      }

      for (const p of params) {
        if (rng.next() < config.mutationRate) {
          const delta = rng.normalRandom() * (p.max - p.min) * 0.1;
          child[p.name] = clampToStep(child[p.name] + delta, p);
        }
      }

      nextGen.push(child);
    }

    population = nextGen;
    scored = population.map(ind => {
      const metrics = quickBacktest(bars, ind, config);
      return { params: ind, score: objectiveScore(metrics, config.objectives), metrics };
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored[0].score > globalBest.score) {
      globalBest = scored[0];
      bestCb(globalBest);
    }

    progressCb((gen + 1) / config.generations);
  }

  return scored;
}

function tournamentSelect(
  population: OptimizationResult[],
  size: number,
  rng: PRNG,
): OptimizationResult {
  let best: OptimizationResult | null = null;
  for (let i = 0; i < size; i++) {
    const idx = Math.floor(rng.next() * population.length);
    if (!best || population[idx].score > best.score) best = population[idx];
  }
  return best!;
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

  if (msg.type !== 'optimize' || !msg.bars?.length || !msg.config) {
    send({ type: 'error', taskId: msg.taskId, error: 'Missing bars or config' });
    return;
  }

  const progressCb = (p: number) => send({ type: 'progress', taskId: msg.taskId, progress: p });
  const isCancelled = () => cancelledTasks.has(msg.taskId);
  const bestCb = (r: OptimizationResult) => send({ type: 'best_update', taskId: msg.taskId, data: r });

  try {
    let result: unknown;

    switch (msg.config.method) {
      case 'grid':
        result = gridSearch(msg.bars, msg.config as GridConfig, progressCb, isCancelled, bestCb);
        break;
      case 'walk_forward':
        result = walkForward(msg.bars, msg.config as WalkForwardConfig, progressCb, isCancelled, bestCb);
        break;
      case 'monte_carlo':
        result = monteCarlo(msg.bars, msg.config as MonteCarloConfig, progressCb, isCancelled);
        break;
      case 'genetic':
        result = geneticOptimization(msg.bars, msg.config as GeneticConfig, progressCb, isCancelled, bestCb);
        break;
      default:
        send({ type: 'error', taskId: msg.taskId, error: `Unknown method: ${msg.config.method}` });
        return;
    }

    if (isCancelled()) {
      cancelledTasks.delete(msg.taskId);
      send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
      return;
    }

    send({ type: 'result', taskId: msg.taskId, data: result });
  } catch (err) {
    send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
  }
};

send({ type: 'ready', taskId: '' });
