import type {
  Bar,
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  Strategy,
  ParameterRange,
  OptimizationObjective,
  OptimizationResult,
  MonteCarloResult,
  WalkForwardResult,
  WalkForwardWindow,
  CSCVResult,
  SensitivityPoint,
} from './types';
import { BacktestEngine } from './engine';
import { computeMetrics, computeMonthlyReturns } from './analytics';

// ─── Deterministic PRNG ─────────────────────────────────────────────────────

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
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  normalRandom(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

// ─── Helper: Run Single Backtest ────────────────────────────────────────────

function runBacktest(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  params: Record<string, number | boolean | string>,
): BacktestResult {
  const engine = new BacktestEngine(config, strategy, params);
  const result = engine.run(data);
  result.metrics = computeMetrics(result, result.benchmarkReturns);
  result.monthlyReturns = computeMonthlyReturns(result.equityCurve, result.trades);
  return result;
}

function getMetricValue(metrics: BacktestMetrics, key: keyof BacktestMetrics): number {
  return metrics[key] as number;
}

function objectiveScore(
  metrics: BacktestMetrics,
  objectives: OptimizationObjective[],
): number {
  let score = 0;
  for (const obj of objectives) {
    const val = getMetricValue(metrics, obj.metric);
    const w = obj.weight ?? 1;
    score += obj.direction === 'maximize' ? val * w : -val * w;
  }
  return score;
}

// ─── Grid Search ────────────────────────────────────────────────────────────

export function gridSearch(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: OptimizationObjective[],
): OptimizationResult {
  const startMs = performance.now();
  const combos = generateCombinations(paramRanges);

  const allResults: { params: Record<string, number | boolean | string>; metrics: BacktestMetrics }[] = [];
  let bestScore = -Infinity;
  let bestParams: Record<string, number | boolean | string> = {};
  let bestMetrics: BacktestMetrics = {} as any;

  for (const combo of combos) {
    const result = runBacktest(strategy, config, data, combo);
    const score = objectiveScore(result.metrics, objectives);
    allResults.push({ params: combo, metrics: result.metrics });

    if (score > bestScore) {
      bestScore = score;
      bestParams = combo;
      bestMetrics = result.metrics;
    }
  }

  return {
    bestParams,
    bestMetrics,
    allResults,
    overfitScore: 0,
    robustnessScore: computeRobustnessScore(allResults, objectives),
    executionTimeMs: performance.now() - startMs,
  };
}

function generateCombinations(ranges: ParameterRange[]): Record<string, number>[] {
  if (!ranges.length) return [{}];
  const [first, ...rest] = ranges;
  const restCombos = generateCombinations(rest);
  const combos: Record<string, number>[] = [];

  const precision = Math.max(0, -Math.floor(Math.log10(first.step || 1)));

  for (let v = first.min; v <= first.max + first.step * 0.001; v += first.step) {
    const rounded = parseFloat(v.toFixed(precision));
    for (const rc of restCombos) {
      combos.push({ [first.name]: rounded, ...rc });
    }
  }
  return combos;
}

// ─── Walk-Forward Analysis ──────────────────────────────────────────────────

export function walkForwardAnalysis(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: OptimizationObjective[],
  numWindows: number,
  inSampleRatio = 0.7,
): WalkForwardResult {
  const totalDuration = config.endDate - config.startDate;
  const windowSize = totalDuration / numWindows;
  const inSampleSize = windowSize * inSampleRatio;
  const oosSize = windowSize * (1 - inSampleRatio);

  const windows: WalkForwardWindow[] = [];
  let combinedOOSReturns: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const isStart = config.startDate + w * windowSize;
    const isEnd = isStart + inSampleSize;
    const oosStart = isEnd;
    const oosEnd = oosStart + oosSize;

    const isConfig: BacktestConfig = { ...config, startDate: isStart, endDate: isEnd };
    const oosConfig: BacktestConfig = { ...config, startDate: oosStart, endDate: oosEnd };

    const isOptResult = gridSearch(strategy, isConfig, data, paramRanges, objectives);

    const oosResult = runBacktest(strategy, oosConfig, data, isOptResult.bestParams);

    const isResult = runBacktest(strategy, isConfig, data, isOptResult.bestParams);

    combinedOOSReturns = combinedOOSReturns.concat(oosResult.dailyReturns);

    windows.push({
      inSampleStart: isStart,
      inSampleEnd: isEnd,
      outOfSampleStart: oosStart,
      outOfSampleEnd: oosEnd,
      bestParams: isOptResult.bestParams,
      inSampleMetrics: isResult.metrics,
      outOfSampleMetrics: oosResult.metrics,
    });
  }

  const avgISPerf = windows.reduce((s, w) => s + objectiveScore(w.inSampleMetrics, objectives), 0) / windows.length;
  const avgOOSPerf = windows.reduce((s, w) => s + objectiveScore(w.outOfSampleMetrics, objectives), 0) / windows.length;
  const degradationRatio = avgISPerf !== 0 ? 1 - avgOOSPerf / avgISPerf : 1;
  const walkForwardEfficiency = avgISPerf !== 0 ? avgOOSPerf / avgISPerf : 0;

  const combinedResult = runBacktest(strategy, config, data, windows[0]?.bestParams ?? {});

  return {
    windows,
    combinedOutOfSample: combinedResult.metrics,
    walkForwardEfficiency,
    isRobust: walkForwardEfficiency > 0.5 && degradationRatio < 0.5,
    degradationRatio,
  };
}

// ─── Monte Carlo Permutation Test ───────────────────────────────────────────

export function monteCarloPermutationTest(
  trades: { pnl: number }[],
  numSimulations: number,
  seed = 42,
): { observedMean: number; pValue: number; distribution: number[] } {
  const rng = new PRNG(seed);
  const pnls = trades.map(t => t.pnl);
  const observedMean = pnls.reduce((s, v) => s + v, 0) / pnls.length;

  const distribution: number[] = [];
  let countAbove = 0;

  for (let i = 0; i < numSimulations; i++) {
    const shuffled = rng.shuffle(pnls);
    const signs = shuffled.map((p, j) => (rng.next() > 0.5 ? p : -p));
    const simMean = signs.reduce((s, v) => s + v, 0) / signs.length;
    distribution.push(simMean);
    if (simMean >= observedMean) countAbove++;
  }

  return {
    observedMean,
    pValue: countAbove / numSimulations,
    distribution: distribution.sort((a, b) => a - b),
  };
}

// ─── Monte Carlo Simulation (Equity Paths) ─────────────────────────────────

export function monteCarloSimulation(
  trades: { pnl: number }[],
  initialCapital: number,
  numSimulations: number,
  numTrades?: number,
  seed = 42,
): MonteCarloResult {
  const rng = new PRNG(seed);
  const pnls = trades.map(t => t.pnl);
  const n = numTrades ?? pnls.length;

  const equityPaths: number[][] = [];
  const finalEquities: number[] = [];
  const maxDrawdowns: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialCapital];
    let equity = initialCapital;
    let peak = initialCapital;
    let maxDD = 0;

    for (let t = 0; t < n; t++) {
      const idx = Math.floor(rng.next() * pnls.length);
      equity += pnls[idx];
      path.push(equity);
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    equityPaths.push(path);
    finalEquities.push(equity);
    maxDrawdowns.push(maxDD * 100);
  }

  const sortedEquity = [...finalEquities].sort((a, b) => a - b);
  const sortedDD = [...maxDrawdowns].sort((a, b) => a - b);
  const pctIdx = (p: number, arr: number[]) => arr[Math.floor(p * (arr.length - 1))];

  const ruinCount = finalEquities.filter(e => e <= 0).length;

  return {
    simulations: numSimulations,
    equityPaths,
    finalEquities,
    maxDrawdowns,
    percentiles: {
      p5: { finalEquity: pctIdx(0.05, sortedEquity), maxDrawdown: pctIdx(0.95, sortedDD) },
      p25: { finalEquity: pctIdx(0.25, sortedEquity), maxDrawdown: pctIdx(0.75, sortedDD) },
      p50: { finalEquity: pctIdx(0.5, sortedEquity), maxDrawdown: pctIdx(0.5, sortedDD) },
      p75: { finalEquity: pctIdx(0.75, sortedEquity), maxDrawdown: pctIdx(0.25, sortedDD) },
      p95: { finalEquity: pctIdx(0.95, sortedEquity), maxDrawdown: pctIdx(0.05, sortedDD) },
    },
    ruinProbability: ruinCount / numSimulations,
    medianReturn: ((pctIdx(0.5, sortedEquity) - initialCapital) / initialCapital) * 100,
    confidenceInterval95: [pctIdx(0.025, sortedEquity), pctIdx(0.975, sortedEquity)],
  };
}

// ─── Genetic Algorithm Optimization ─────────────────────────────────────────

export function geneticOptimization(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: OptimizationObjective[],
  options: {
    populationSize?: number;
    generations?: number;
    mutationRate?: number;
    crossoverRate?: number;
    elitismCount?: number;
    seed?: number;
  } = {},
): OptimizationResult {
  const startMs = performance.now();
  const {
    populationSize = 50,
    generations = 100,
    mutationRate = 0.1,
    crossoverRate = 0.7,
    elitismCount = 2,
    seed = 42,
  } = options;

  const rng = new PRNG(seed);

  type Individual = { params: Record<string, number>; fitness: number; metrics: BacktestMetrics };

  function randomIndividual(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const r of paramRanges) {
      const steps = Math.round((r.max - r.min) / r.step);
      const stepIdx = Math.floor(rng.next() * (steps + 1));
      params[r.name] = r.min + stepIdx * r.step;
    }
    return params;
  }

  function evaluate(params: Record<string, number>): Individual {
    const result = runBacktest(strategy, config, data, params);
    const fitness = objectiveScore(result.metrics, objectives);
    return { params, fitness, metrics: result.metrics };
  }

  function crossover(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const child: Record<string, number> = {};
    for (const r of paramRanges) {
      if (rng.next() < 0.5) {
        child[r.name] = a[r.name];
      } else {
        child[r.name] = b[r.name];
      }
    }
    return child;
  }

  function mutate(params: Record<string, number>): Record<string, number> {
    const mutated = { ...params };
    for (const r of paramRanges) {
      if (rng.next() < mutationRate) {
        const delta = (rng.next() - 0.5) * 2 * (r.max - r.min) * 0.2;
        let newVal = mutated[r.name] + delta;
        newVal = Math.max(r.min, Math.min(r.max, newVal));
        newVal = Math.round((newVal - r.min) / r.step) * r.step + r.min;
        mutated[r.name] = parseFloat(newVal.toFixed(10));
      }
    }
    return mutated;
  }

  function tournamentSelect(pop: Individual[]): Individual {
    const a = pop[Math.floor(rng.next() * pop.length)];
    const b = pop[Math.floor(rng.next() * pop.length)];
    return a.fitness >= b.fitness ? a : b;
  }

  let population: Individual[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push(evaluate(randomIndividual()));
  }

  const allResults: { params: Record<string, number | boolean | string>; metrics: BacktestMetrics }[] = [];

  for (let gen = 0; gen < generations; gen++) {
    population.sort((a, b) => b.fitness - a.fitness);

    const nextGen: Individual[] = [];

    for (let e = 0; e < elitismCount && e < population.length; e++) {
      nextGen.push(population[e]);
    }

    while (nextGen.length < populationSize) {
      const p1 = tournamentSelect(population);
      const p2 = tournamentSelect(population);

      let childParams: Record<string, number>;
      if (rng.next() < crossoverRate) {
        childParams = crossover(p1.params, p2.params);
      } else {
        childParams = { ...p1.params };
      }

      childParams = mutate(childParams);
      nextGen.push(evaluate(childParams));
    }

    population = nextGen;
  }

  population.sort((a, b) => b.fitness - a.fitness);

  for (const ind of population) {
    allResults.push({ params: ind.params, metrics: ind.metrics });
  }

  const best = population[0];

  return {
    bestParams: best.params,
    bestMetrics: best.metrics,
    allResults,
    overfitScore: 0,
    robustnessScore: computeRobustnessScore(allResults, objectives),
    executionTimeMs: performance.now() - startMs,
  };
}

// ─── Bayesian Optimization (Gaussian Process) ──────────────────────────────

export function bayesianOptimization(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: OptimizationObjective[],
  options: { maxIterations?: number; initialSamples?: number; xi?: number; seed?: number } = {},
): OptimizationResult {
  const startMs = performance.now();
  const { maxIterations = 50, initialSamples = 10, xi = 0.01, seed = 42 } = options;
  const rng = new PRNG(seed);

  const observations: { x: number[]; y: number }[] = [];
  const allResults: { params: Record<string, number | boolean | string>; metrics: BacktestMetrics }[] = [];

  function paramsToVec(params: Record<string, number>): number[] {
    return paramRanges.map(r => (params[r.name] - r.min) / (r.max - r.min || 1));
  }

  function vecToParams(vec: number[]): Record<string, number> {
    const params: Record<string, number> = {};
    paramRanges.forEach((r, i) => {
      const raw = r.min + vec[i] * (r.max - r.min);
      params[r.name] = Math.round((raw - r.min) / r.step) * r.step + r.min;
    });
    return params;
  }

  function rbfKernel(a: number[], b: number[], lengthScale = 0.3): number {
    let sqDist = 0;
    for (let i = 0; i < a.length; i++) sqDist += (a[i] - b[i]) ** 2;
    return Math.exp(-sqDist / (2 * lengthScale * lengthScale));
  }

  function gpPredict(x: number[]): { mean: number; std: number } {
    if (observations.length === 0) return { mean: 0, std: 1 };

    const n = observations.length;
    const K = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        rbfKernel(observations[i].x, observations[j].x) + (i === j ? 1e-6 : 0)
      )
    );

    const kStar = observations.map(o => rbfKernel(x, o.x));
    const y = observations.map(o => o.y);

    const KInv = invertMatrix(K);
    if (!KInv) return { mean: 0, std: 1 };

    let mu = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += KInv[i][j] * y[j];
      mu += kStar[i] * sum;
    }

    let variance = rbfKernel(x, x);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += KInv[i][j] * kStar[j];
      variance -= kStar[i] * sum;
    }

    return { mean: mu, std: Math.sqrt(Math.max(variance, 1e-10)) };
  }

  function acquisitionEI(x: number[]): number {
    const { mean, std } = gpPredict(x);
    if (std < 1e-10) return 0;
    const yBest = Math.max(...observations.map(o => o.y));
    const z = (mean - yBest - xi) / std;
    return (mean - yBest - xi) * normalCDF(z) + std * normalPDF(z);
  }

  function normalCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  function normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  for (let i = 0; i < initialSamples; i++) {
    const vec = paramRanges.map(() => rng.next());
    const params = vecToParams(vec);
    const result = runBacktest(strategy, config, data, params);
    const score = objectiveScore(result.metrics, objectives);
    observations.push({ x: vec, y: score });
    allResults.push({ params, metrics: result.metrics });
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let bestEI = -Infinity;
    let bestVec: number[] = paramRanges.map(() => 0.5);

    const numCandidates = 100;
    for (let c = 0; c < numCandidates; c++) {
      const candidate = paramRanges.map(() => rng.next());
      const ei = acquisitionEI(candidate);
      if (ei > bestEI) {
        bestEI = ei;
        bestVec = candidate;
      }
    }

    const params = vecToParams(bestVec);
    const result = runBacktest(strategy, config, data, params);
    const score = objectiveScore(result.metrics, objectives);
    observations.push({ x: bestVec, y: score });
    allResults.push({ params, metrics: result.metrics });
  }

  let bestIdx = 0;
  for (let i = 1; i < observations.length; i++) {
    if (observations[i].y > observations[bestIdx].y) bestIdx = i;
  }

  return {
    bestParams: allResults[bestIdx].params,
    bestMetrics: allResults[bestIdx].metrics,
    allResults,
    overfitScore: 0,
    robustnessScore: computeRobustnessScore(allResults, objectives),
    executionTimeMs: performance.now() - startMs,
  };
}

// ─── Multi-Objective (Pareto Front) ─────────────────────────────────────────

export function multiObjectiveOptimization(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: [OptimizationObjective, OptimizationObjective],
  populationSize = 50,
  generations = 100,
  seed = 42,
): OptimizationResult {
  const startMs = performance.now();
  const rng = new PRNG(seed);

  type Ind = { params: Record<string, number>; metrics: BacktestMetrics; objectives: [number, number] };

  function randomParams(): Record<string, number> {
    const p: Record<string, number> = {};
    for (const r of paramRanges) {
      const steps = Math.round((r.max - r.min) / r.step);
      p[r.name] = r.min + Math.floor(rng.next() * (steps + 1)) * r.step;
    }
    return p;
  }

  function evaluateInd(params: Record<string, number>): Ind {
    const result = runBacktest(strategy, config, data, params);
    const o1 = getMetricValue(result.metrics, objectives[0].metric) * (objectives[0].direction === 'maximize' ? 1 : -1);
    const o2 = getMetricValue(result.metrics, objectives[1].metric) * (objectives[1].direction === 'maximize' ? 1 : -1);
    return { params, metrics: result.metrics, objectives: [o1, o2] };
  }

  function dominates(a: Ind, b: Ind): boolean {
    return a.objectives[0] >= b.objectives[0] && a.objectives[1] >= b.objectives[1]
      && (a.objectives[0] > b.objectives[0] || a.objectives[1] > b.objectives[1]);
  }

  function nonDominatedSort(pop: Ind[]): Ind[][] {
    const fronts: Ind[][] = [[]];
    const dominated = new Map<Ind, Ind[]>();
    const domCount = new Map<Ind, number>();

    for (const p of pop) {
      dominated.set(p, []);
      domCount.set(p, 0);
      for (const q of pop) {
        if (p === q) continue;
        if (dominates(p, q)) dominated.get(p)!.push(q);
        else if (dominates(q, p)) domCount.set(p, (domCount.get(p) ?? 0) + 1);
      }
      if (domCount.get(p) === 0) fronts[0].push(p);
    }

    let i = 0;
    while (fronts[i].length > 0) {
      const next: Ind[] = [];
      for (const p of fronts[i]) {
        for (const q of dominated.get(p)!) {
          const c = (domCount.get(q) ?? 1) - 1;
          domCount.set(q, c);
          if (c === 0) next.push(q);
        }
      }
      if (next.length) fronts.push(next);
      i++;
    }
    return fronts;
  }

  function crowdingDistance(front: Ind[]): Map<Ind, number> {
    const dist = new Map<Ind, number>();
    for (const ind of front) dist.set(ind, 0);
    if (front.length <= 2) {
      for (const ind of front) dist.set(ind, Infinity);
      return dist;
    }

    for (let m = 0; m < 2; m++) {
      const sorted = [...front].sort((a, b) => a.objectives[m] - b.objectives[m]);
      dist.set(sorted[0], Infinity);
      dist.set(sorted[sorted.length - 1], Infinity);
      const range = sorted[sorted.length - 1].objectives[m] - sorted[0].objectives[m];
      if (range === 0) continue;
      for (let i = 1; i < sorted.length - 1; i++) {
        const d = (dist.get(sorted[i]) ?? 0) + (sorted[i + 1].objectives[m] - sorted[i - 1].objectives[m]) / range;
        dist.set(sorted[i], d);
      }
    }
    return dist;
  }

  let pop: Ind[] = [];
  for (let i = 0; i < populationSize; i++) pop.push(evaluateInd(randomParams()));

  for (let gen = 0; gen < generations; gen++) {
    const offspring: Ind[] = [];
    while (offspring.length < populationSize) {
      const i1 = Math.floor(rng.next() * pop.length);
      const i2 = Math.floor(rng.next() * pop.length);
      const p1 = pop[i1];
      const p2 = pop[i2];
      const child: Record<string, number> = {};
      for (const r of paramRanges) {
        child[r.name] = rng.next() < 0.5 ? p1.params[r.name] : p2.params[r.name];
        if (rng.next() < 0.1) {
          const delta = (rng.next() - 0.5) * (r.max - r.min) * 0.3;
          child[r.name] = Math.max(r.min, Math.min(r.max,
            Math.round((child[r.name] + delta - r.min) / r.step) * r.step + r.min));
        }
      }
      offspring.push(evaluateInd(child));
    }

    const combined = [...pop, ...offspring];
    const fronts = nonDominatedSort(combined);

    const nextPop: Ind[] = [];
    for (const front of fronts) {
      if (nextPop.length + front.length <= populationSize) {
        nextPop.push(...front);
      } else {
        const cd = crowdingDistance(front);
        front.sort((a, b) => (cd.get(b) ?? 0) - (cd.get(a) ?? 0));
        nextPop.push(...front.slice(0, populationSize - nextPop.length));
        break;
      }
    }
    pop = nextPop;
  }

  const allResults = pop.map(ind => ({ params: ind.params as Record<string, number | boolean | string>, metrics: ind.metrics }));
  const paretoFront = nonDominatedSort(pop)[0].map(ind => ({ params: ind.params as Record<string, number | boolean | string>, metrics: ind.metrics }));

  const best = pop.reduce((a, b) => (a.objectives[0] + a.objectives[1] > b.objectives[0] + b.objectives[1] ? a : b));

  return {
    bestParams: best.params,
    bestMetrics: best.metrics,
    allResults,
    paretoFront,
    overfitScore: 0,
    robustnessScore: computeRobustnessScore(allResults, objectives),
    executionTimeMs: performance.now() - startMs,
  };
}

// ─── Combinatorial Symmetric Cross-Validation ───────────────────────────────

export function cscvAnalysis(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  paramRanges: ParameterRange[],
  objectives: OptimizationObjective[],
  numBlocks = 10,
  seed = 42,
): CSCVResult {
  const rng = new PRNG(seed);
  const totalDuration = config.endDate - config.startDate;
  const blockSize = totalDuration / numBlocks;

  const blockConfigs: BacktestConfig[] = [];
  for (let i = 0; i < numBlocks; i++) {
    blockConfigs.push({
      ...config,
      startDate: config.startDate + i * blockSize,
      endDate: config.startDate + (i + 1) * blockSize,
    });
  }

  const halfSize = Math.floor(numBlocks / 2);
  const numCombinations = Math.min(50, comb(numBlocks, halfSize));
  const logits: number[] = [];

  for (let c = 0; c < numCombinations; c++) {
    const indices = Array.from({ length: numBlocks }, (_, i) => i);
    const shuffled = rng.shuffle(indices);
    const isIndices = shuffled.slice(0, halfSize);
    const oosIndices = shuffled.slice(halfSize);

    const isStart = Math.min(...isIndices.map(i => blockConfigs[i].startDate));
    const isEnd = Math.max(...isIndices.map(i => blockConfigs[i].endDate));
    const oosStart = Math.min(...oosIndices.map(i => blockConfigs[i].startDate));
    const oosEnd = Math.max(...oosIndices.map(i => blockConfigs[i].endDate));

    const isConfig: BacktestConfig = { ...config, startDate: isStart, endDate: isEnd };
    const oosConfig: BacktestConfig = { ...config, startDate: oosStart, endDate: oosEnd };

    const optResult = gridSearch(strategy, isConfig, data, paramRanges, objectives);
    const oosResult = runBacktest(strategy, oosConfig, data, optResult.bestParams);
    const oosScore = objectiveScore(oosResult.metrics, objectives);

    const baseResult = runBacktest(strategy, oosConfig, data, {});
    const baseScore = objectiveScore(baseResult.metrics, objectives);

    const logit = oosScore > 0 && baseScore > 0
      ? Math.log(oosScore / baseScore)
      : oosScore - baseScore;
    logits.push(logit);
  }

  const overfitCount = logits.filter(l => l < 0).length;
  const pbo = overfitCount / logits.length;
  const avgDegradation = logits.reduce((s, v) => s + v, 0) / logits.length;

  return {
    probabilityOfOverfit: pbo,
    performanceDegradation: avgDegradation,
    logitsDistribution: logits.sort((a, b) => a - b),
    isOverfit: pbo > 0.5,
  };
}

function comb(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
  return Math.round(result);
}

// ─── Parameter Sensitivity Analysis ─────────────────────────────────────────

export function parameterSensitivity(
  strategy: Strategy,
  config: BacktestConfig,
  data: Map<string, Bar[]>,
  baseParams: Record<string, number | boolean | string>,
  paramRanges: ParameterRange[],
  metric: keyof BacktestMetrics,
): SensitivityPoint[] {
  const points: SensitivityPoint[] = [];

  for (const range of paramRanges) {
    for (let v = range.min; v <= range.max + range.step * 0.001; v += range.step) {
      const rounded = parseFloat(v.toFixed(10));
      const params = { ...baseParams, [range.name]: rounded };
      const result = runBacktest(strategy, config, data, params);
      points.push({
        paramName: range.name,
        paramValue: rounded,
        metric: getMetricValue(result.metrics, metric),
      });
    }
  }

  return points;
}

// ─── Robustness Score ───────────────────────────────────────────────────────

function computeRobustnessScore(
  results: { params: Record<string, number | boolean | string>; metrics: BacktestMetrics }[],
  objectives: OptimizationObjective[],
): number {
  if (results.length < 3) return 0;

  const scores = results.map(r => objectiveScore(r.metrics, objectives));
  const sorted = [...scores].sort((a, b) => b - a);
  const topN = Math.max(1, Math.floor(sorted.length * 0.1));
  const topScores = sorted.slice(0, topN);
  const medianScore = sorted[Math.floor(sorted.length / 2)];
  const topMean = topScores.reduce((s, v) => s + v, 0) / topN;
  const totalMean = scores.reduce((s, v) => s + v, 0) / scores.length;

  if (topMean === 0) return 0;
  const consistency = totalMean / topMean;
  const profitableRatio = scores.filter(s => s > 0).length / scores.length;

  return Math.min(1, (consistency * 0.5 + profitableRatio * 0.5));
}

// ─── White's Reality Check ──────────────────────────────────────────────────

export function whitesRealityCheck(
  strategyReturns: number[],
  benchmarkReturns: number[],
  numBootstrap: number = 1000,
  seed = 42,
): { pValue: number; isSignificant: boolean; testStatistic: number } {
  const rng = new PRNG(seed);
  const n = Math.min(strategyReturns.length, benchmarkReturns.length);
  const excess = strategyReturns.slice(0, n).map((r, i) => r - (benchmarkReturns[i] ?? 0));
  const observedMean = excess.reduce((s, v) => s + v, 0) / n;

  let countAbove = 0;
  for (let b = 0; b < numBootstrap; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng.next() * n);
      sum += excess[idx];
    }
    const bootstrapMean = sum / n;
    if (bootstrapMean >= observedMean) countAbove++;
  }

  const pValue = countAbove / numBootstrap;
  return {
    pValue,
    isSignificant: pValue < 0.05,
    testStatistic: observedMean,
  };
}

// ─── Matrix Inversion (Gauss-Jordan, for small GP kernel matrices) ──────────

function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  const aug = m.map((row, i) => {
    const extended = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) extended[j] = row[j];
    extended[n + i] = 1;
    return extended;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null;

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}
