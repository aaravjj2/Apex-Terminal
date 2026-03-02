import type {
  BacktestResult,
  BacktestMetrics,
  MonthlyReturn,
  Trade,
  EquityPoint,
  DrawdownPeriod,
} from './types';
import { Side } from './types';

// ─── Statistical Helpers ────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function downsideDeviation(returns: number[], mar = 0): number {
  const downside = returns.filter(r => r < mar).map(r => (r - mar) ** 2);
  if (!downside.length) return 0;
  return Math.sqrt(downside.reduce((s, v) => s + v, 0) / returns.length);
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function skewness(arr: number[]): number {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  const s = stddev(arr, m);
  if (s === 0) return 0;
  const n = arr.length;
  const skew = arr.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * skew;
}

function kurtosis(arr: number[]): number {
  if (arr.length < 4) return 0;
  const m = mean(arr);
  const s = stddev(arr, m);
  if (s === 0) return 0;
  const n = arr.length;
  const kurt = arr.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurt
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function covariance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len < 2) return 0;
  const ma = mean(a.slice(0, len));
  const mb = mean(b.slice(0, len));
  let cov = 0;
  for (let i = 0; i < len; i++) cov += (a[i] - ma) * (b[i] - mb);
  return cov / (len - 1);
}

function correlation(a: number[], b: number[]): number {
  const sa = stddev(a);
  const sb = stddev(b);
  if (sa === 0 || sb === 0) return 0;
  return covariance(a, b) / (sa * sb);
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = my - slope * mx;
  const rSquared = ssXX !== 0 && ssYY !== 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  return { slope, intercept, rSquared };
}

// Students t-distribution CDF approximation
function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  let a = df / 2;
  let b = 0.5;
  let ibeta = 0;
  if (x === 0) ibeta = 0;
  else if (x === 1) ibeta = 1;
  else {
    const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
    let f = 1, c = 1, d = 1;
    for (let i = 0; i <= 200; i++) {
      const m = i;
      let num: number;
      if (m === 0) num = 1;
      else if (m % 2 === 0) {
        const k = m / 2;
        num = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
      } else {
        const k = (m - 1) / 2;
        num = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1));
      }
      d = 1 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const delta = c * d;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-10) break;
    }
    ibeta = (front / a) * f;
  }
  return t >= 0 ? 1 - ibeta / 2 : ibeta / 2;
}

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -5.395239384953e-6];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ─── Core Analytics ─────────────────────────────────────────────────────────

const TRADING_DAYS_YEAR = 252;
const MS_PER_DAY = 86_400_000;

export function computeMetrics(result: BacktestResult, benchmarkReturns?: number[]): BacktestMetrics {
  const { trades, equityCurve, dailyReturns, config } = result;
  const rfDaily = config.riskFreeRate / TRADING_DAYS_YEAR;

  const initialEquity = config.initialCapital;
  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : initialEquity;

  const totalReturn = finalEquity - initialEquity;
  const totalReturnPercent = (totalReturn / initialEquity) * 100;

  const durationMs = result.endTime - result.startTime;
  const years = durationMs / (365.25 * MS_PER_DAY);
  const cagr = years > 0 ? (Math.pow(finalEquity / initialEquity, 1 / years) - 1) * 100 : 0;
  const annualizedReturn = cagr;

  const avgDaily = mean(dailyReturns);
  const dailyStd = stddev(dailyReturns, avgDaily);
  const volatility = dailyStd;
  const annualizedVolatility = dailyStd * Math.sqrt(TRADING_DAYS_YEAR) * 100;

  const excessReturns = dailyReturns.map(r => r - rfDaily);
  const sharpeRatio = dailyStd > 0 ? (mean(excessReturns) / dailyStd) * Math.sqrt(TRADING_DAYS_YEAR) : 0;

  const downDev = downsideDeviation(dailyReturns, rfDaily);
  const sortinoRatio = downDev > 0 ? (mean(excessReturns) / downDev) * Math.sqrt(TRADING_DAYS_YEAR) : 0;

  const { maxDrawdown, maxDrawdownPercent, avgDrawdown, longestDrawdownDays } = analyzeDrawdowns(equityCurve);
  const calmarRatio = maxDrawdownPercent > 0 ? cagr / maxDrawdownPercent : 0;

  let beta = 0, alpha = 0, rSquared = 0, treynorRatio = 0, informationRatio = 0;
  if (benchmarkReturns && benchmarkReturns.length) {
    const reg = linearRegression(benchmarkReturns, dailyReturns);
    beta = reg.slope;
    rSquared = reg.rSquared;
    alpha = (mean(dailyReturns) - rfDaily - beta * (mean(benchmarkReturns) - rfDaily)) * TRADING_DAYS_YEAR * 100;
    treynorRatio = beta !== 0 ? (mean(excessReturns) / beta) * TRADING_DAYS_YEAR : 0;

    const trackingError = dailyReturns.map((r, i) => r - (benchmarkReturns[i] ?? 0));
    const teStd = stddev(trackingError);
    informationRatio = teStd > 0 ? (mean(trackingError) / teStd) * Math.sqrt(TRADING_DAYS_YEAR) : 0;
  }

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const avgWin = mean(winningTrades.map(t => t.pnl));
  const avgLoss = mean(losingTrades.map(t => Math.abs(t.pnl)));
  const avgWinPercent = mean(winningTrades.map(t => t.pnlPercent));
  const avgLossPercent = mean(losingTrades.map(t => Math.abs(t.pnlPercent)));

  const largestWin = winningTrades.length ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
  const largestLoss = losingTrades.length ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

  const grossProfit = winningTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  const wr = winRate / 100;
  const expectancy = trades.length > 0 ? mean(trades.map(t => t.pnl)) : 0;
  const expectancyPercent = trades.length > 0 ? mean(trades.map(t => t.pnlPercent)) : 0;

  const { maxConsecutiveWins, maxConsecutiveLosses } = consecutiveAnalysis(trades);

  const durations = trades.map(t => t.duration);
  const avgTradeDuration = mean(durations);
  const medianTradeDuration = median(durations);
  const avgBarsInTrade = mean(trades.map(t => t.bars));

  const timeInMarket = computeTimeInMarket(equityCurve);
  const exposure = timeInMarket;

  const kellyPercent = avgLoss > 0 ? (wr - (1 - wr) / payoffRatio) * 100 : 0;

  const ulcerIndex = computeUlcerIndex(equityCurve);

  const p95 = percentile(dailyReturns, 95);
  const p5 = percentile(dailyReturns, 5);
  const tailRatio = Math.abs(p5) > 0 ? Math.abs(p95 / p5) : 0;

  const commonSenseRatio = profitFactor * tailRatio;
  const cpcIndex = profitFactor * (winRate / 100) * payoffRatio;

  const skew = skewness(dailyReturns);
  const kurt = kurtosis(dailyReturns);

  const var95 = -percentile(dailyReturns, 5) * initialEquity;
  const below5 = dailyReturns.filter(r => r <= percentile(dailyReturns, 5));
  const cvar95 = below5.length > 0 ? -mean(below5) * initialEquity : 0;

  const totalCommission = trades.reduce((s, t) => s + t.commission, 0);
  const totalSlippage = trades.reduce((s, t) => s + t.slippage, 0);
  const netProfit = totalReturn - totalCommission - totalSlippage;

  return {
    totalReturn,
    totalReturnPercent,
    annualizedReturn,
    cagr,
    volatility,
    annualizedVolatility,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    treynorRatio,
    informationRatio,
    maxDrawdown,
    maxDrawdownPercent,
    avgDrawdown,
    longestDrawdownDays,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWin,
    avgLoss,
    avgWinPercent,
    avgLossPercent,
    largestWin,
    largestLoss,
    profitFactor,
    payoffRatio,
    expectancy,
    expectancyPercent,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    avgTradeDuration,
    medianTradeDuration,
    timeInMarket,
    exposure,
    avgBarsInTrade,
    kellyPercent,
    ulcerIndex,
    tailRatio,
    commonSenseRatio,
    cpcIndex,
    beta,
    alpha,
    rSquared,
    skewness: skew,
    kurtosis: kurt,
    var95,
    cvar95,
    totalCommission,
    totalSlippage,
    netProfit,
  };
}

// ─── Drawdown Analysis ──────────────────────────────────────────────────────

function analyzeDrawdowns(curve: EquityPoint[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgDrawdown: number;
  longestDrawdownDays: number;
} {
  if (!curve.length) return { maxDrawdown: 0, maxDrawdownPercent: 0, avgDrawdown: 0, longestDrawdownDays: 0 };

  let peak = curve[0].equity;
  let maxDD = 0;
  let maxDDPct = 0;
  let ddStart = 0;
  let longestDDDays = 0;
  let inDD = false;
  const ddDepths: number[] = [];

  for (const ep of curve) {
    if (ep.equity >= peak) {
      if (inDD) {
        longestDDDays = Math.max(longestDDDays, (ep.time - ddStart) / MS_PER_DAY);
        inDD = false;
      }
      peak = ep.equity;
    } else {
      if (!inDD) {
        ddStart = ep.time;
        inDD = true;
      }
      const dd = peak - ep.equity;
      const ddPct = (dd / peak) * 100;
      maxDD = Math.max(maxDD, dd);
      maxDDPct = Math.max(maxDDPct, ddPct);
      ddDepths.push(ddPct);
    }
  }

  if (inDD) {
    const last = curve[curve.length - 1];
    longestDDDays = Math.max(longestDDDays, (last.time - ddStart) / MS_PER_DAY);
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPct,
    avgDrawdown: mean(ddDepths),
    longestDrawdownDays: Math.round(longestDDDays),
  };
}

function computeTimeInMarket(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  let invested = 0;
  for (const ep of curve) {
    if (ep.positionValue > 0) invested++;
  }
  return (invested / curve.length) * 100;
}

function computeUlcerIndex(curve: EquityPoint[]): number {
  if (curve.length < 2) return 0;
  let peak = curve[0].equity;
  let sumSq = 0;
  for (const ep of curve) {
    if (ep.equity > peak) peak = ep.equity;
    const pctDD = ((peak - ep.equity) / peak) * 100;
    sumSq += pctDD * pctDD;
  }
  return Math.sqrt(sumSq / curve.length);
}

function consecutiveAnalysis(trades: Trade[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
  let maxWins = 0, maxLosses = 0, wins = 0, losses = 0;
  for (const t of trades) {
    if (t.pnl > 0) {
      wins++;
      losses = 0;
      maxWins = Math.max(maxWins, wins);
    } else {
      losses++;
      wins = 0;
      maxLosses = Math.max(maxLosses, losses);
    }
  }
  return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
}

// ─── Monthly Returns ────────────────────────────────────────────────────────

export function computeMonthlyReturns(curve: EquityPoint[], trades: Trade[]): MonthlyReturn[] {
  if (curve.length < 2) return [];

  const monthly = new Map<string, { startEquity: number; endEquity: number; trades: number }>();

  for (const ep of curve) {
    const d = new Date(ep.time);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = monthly.get(key);
    if (!entry) {
      monthly.set(key, { startEquity: ep.equity, endEquity: ep.equity, trades: 0 });
    } else {
      entry.endEquity = ep.equity;
    }
  }

  for (const t of trades) {
    const d = new Date(t.exitTime);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = monthly.get(key);
    if (entry) entry.trades++;
  }

  const result: MonthlyReturn[] = [];
  for (const [key, val] of monthly) {
    const [yearStr, monthStr] = key.split('-');
    const ret = val.endEquity - val.startEquity;
    const retPct = val.startEquity > 0 ? (ret / val.startEquity) * 100 : 0;
    result.push({
      year: parseInt(yearStr),
      month: parseInt(monthStr) + 1,
      return_: ret,
      returnPercent: retPct,
      trades: val.trades,
    });
  }

  return result.sort((a, b) => a.year - b.year || a.month - b.month);
}

// ─── Rolling Metrics ────────────────────────────────────────────────────────

export function rollingMetric(
  dailyReturns: number[],
  windowDays: number,
  metric: 'sharpe' | 'sortino' | 'volatility',
  riskFreeRate = 0.05,
): { index: number; value: number }[] {
  const results: { index: number; value: number }[] = [];
  const rfDaily = riskFreeRate / TRADING_DAYS_YEAR;

  for (let i = windowDays; i <= dailyReturns.length; i++) {
    const window = dailyReturns.slice(i - windowDays, i);
    const excess = window.map(r => r - rfDaily);

    let value: number;
    switch (metric) {
      case 'sharpe': {
        const s = stddev(excess);
        value = s > 0 ? (mean(excess) / s) * Math.sqrt(TRADING_DAYS_YEAR) : 0;
        break;
      }
      case 'sortino': {
        const dd = downsideDeviation(window, rfDaily);
        value = dd > 0 ? (mean(excess) / dd) * Math.sqrt(TRADING_DAYS_YEAR) : 0;
        break;
      }
      case 'volatility':
        value = stddev(window) * Math.sqrt(TRADING_DAYS_YEAR) * 100;
        break;
    }
    results.push({ index: i - 1, value });
  }
  return results;
}

// ─── MAE / MFE Analysis ────────────────────────────────────────────────────

export interface MAEMFEPoint {
  tradeId: string;
  pnlPercent: number;
  maePercent: number;
  mfePercent: number;
  side: Side;
}

export function maeMfeAnalysis(trades: Trade[]): MAEMFEPoint[] {
  return trades.map(t => ({
    tradeId: t.id,
    pnlPercent: t.pnlPercent,
    maePercent: (t.mae / (t.entryPrice * t.quantity)) * 100,
    mfePercent: (t.mfe / (t.entryPrice * t.quantity)) * 100,
    side: t.side,
  }));
}

// ─── Day / Hour Analysis ────────────────────────────────────────────────────

export interface TemporalAnalysis {
  label: string;
  trades: number;
  avgPnl: number;
  winRate: number;
  totalPnl: number;
}

export function dayOfWeekAnalysis(trades: Trade[]): TemporalAnalysis[] {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const buckets = new Map<number, Trade[]>();

  for (const t of trades) {
    const day = new Date(t.entryTime).getDay();
    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day)!.push(t);
  }

  return days.map((label, i) => {
    const bkt = buckets.get(i) ?? [];
    const wins = bkt.filter(t => t.pnl > 0).length;
    return {
      label,
      trades: bkt.length,
      avgPnl: mean(bkt.map(t => t.pnl)),
      winRate: bkt.length > 0 ? (wins / bkt.length) * 100 : 0,
      totalPnl: bkt.reduce((s, t) => s + t.pnl, 0),
    };
  });
}

export function hourOfDayAnalysis(trades: Trade[]): TemporalAnalysis[] {
  const buckets = new Map<number, Trade[]>();

  for (const t of trades) {
    const hour = new Date(t.entryTime).getHours();
    if (!buckets.has(hour)) buckets.set(hour, []);
    buckets.get(hour)!.push(t);
  }

  return Array.from({ length: 24 }, (_, h) => {
    const bkt = buckets.get(h) ?? [];
    const wins = bkt.filter(t => t.pnl > 0).length;
    return {
      label: `${h.toString().padStart(2, '0')}:00`,
      trades: bkt.length,
      avgPnl: mean(bkt.map(t => t.pnl)),
      winRate: bkt.length > 0 ? (wins / bkt.length) * 100 : 0,
      totalPnl: bkt.reduce((s, t) => s + t.pnl, 0),
    };
  });
}

// ─── Trade Duration Distribution ────────────────────────────────────────────

export interface DistributionBucket {
  binStart: number;
  binEnd: number;
  count: number;
  label: string;
}

export function tradeDurationDistribution(trades: Trade[], bucketCount = 20): DistributionBucket[] {
  if (!trades.length) return [];
  const durations = trades.map(t => t.duration / MS_PER_DAY);
  return histogram(durations, bucketCount, 'd');
}

export function profitDistribution(trades: Trade[], bucketCount = 20): DistributionBucket[] {
  if (!trades.length) return [];
  return histogram(trades.map(t => t.pnl), bucketCount, '$');
}

function histogram(values: number[], buckets: number, unit: string): DistributionBucket[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ binStart: min, binEnd: max, count: values.length, label: `${min.toFixed(2)}${unit}` }];
  const width = (max - min) / buckets;

  const result: DistributionBucket[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = min + i * width;
    const end = start + width;
    result.push({
      binStart: start,
      binEnd: end,
      count: 0,
      label: `${start.toFixed(1)}-${end.toFixed(1)}${unit}`,
    });
  }

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), buckets - 1);
    result[idx].count++;
  }
  return result;
}

// ─── Regime Analysis ────────────────────────────────────────────────────────

export interface RegimePerformance {
  regime: 'bull' | 'bear' | 'sideways';
  trades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
}

export function regimeAnalysis(
  trades: Trade[],
  benchmarkPrices: { time: number; close: number }[],
  lookbackDays = 60,
): RegimePerformance[] {
  if (!benchmarkPrices.length || !trades.length) return [];

  const regimeMap = new Map<number, 'bull' | 'bear' | 'sideways'>();
  for (let i = 0; i < benchmarkPrices.length; i++) {
    const lookbackIdx = Math.max(0, i - lookbackDays);
    const change = (benchmarkPrices[i].close - benchmarkPrices[lookbackIdx].close) / benchmarkPrices[lookbackIdx].close;
    let regime: 'bull' | 'bear' | 'sideways';
    if (change > 0.1) regime = 'bull';
    else if (change < -0.1) regime = 'bear';
    else regime = 'sideways';
    regimeMap.set(benchmarkPrices[i].time, regime);
  }

  const byRegime = new Map<string, Trade[]>();
  for (const t of trades) {
    let closest = 'sideways';
    let minDist = Infinity;
    for (const [time, regime] of regimeMap) {
      const dist = Math.abs(time - t.entryTime);
      if (dist < minDist) {
        minDist = dist;
        closest = regime;
      }
    }
    if (!byRegime.has(closest)) byRegime.set(closest, []);
    byRegime.get(closest)!.push(t);
  }

  const regimes: ('bull' | 'bear' | 'sideways')[] = ['bull', 'bear', 'sideways'];
  return regimes.map(regime => {
    const rTrades = byRegime.get(regime) ?? [];
    const wins = rTrades.filter(t => t.pnl > 0).length;
    const pnls = rTrades.map(t => t.pnl);
    const avgP = mean(pnls);
    const sd = stddev(pnls);
    return {
      regime,
      trades: rTrades.length,
      winRate: rTrades.length > 0 ? (wins / rTrades.length) * 100 : 0,
      avgPnl: avgP,
      totalPnl: pnls.reduce((s, v) => s + v, 0),
      sharpe: sd > 0 ? (avgP / sd) * Math.sqrt(TRADING_DAYS_YEAR) : 0,
    };
  });
}

// ─── Benchmark Comparison ───────────────────────────────────────────────────

export interface BenchmarkComparison {
  strategyReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  strategySharpe: number;
  benchmarkSharpe: number;
  beta: number;
  alpha: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
}

export function compareToBenchmark(
  dailyReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0.05,
): BenchmarkComparison {
  const rfDaily = riskFreeRate / TRADING_DAYS_YEAR;
  const n = Math.min(dailyReturns.length, benchmarkReturns.length);
  const strat = dailyReturns.slice(0, n);
  const bench = benchmarkReturns.slice(0, n);

  const stratCum = strat.reduce((a, r) => a * (1 + r), 1) - 1;
  const benchCum = bench.reduce((a, r) => a * (1 + r), 1) - 1;

  const stratExcess = strat.map(r => r - rfDaily);
  const benchExcess = bench.map(r => r - rfDaily);

  const stratSharpe = stddev(stratExcess) > 0
    ? (mean(stratExcess) / stddev(stratExcess)) * Math.sqrt(TRADING_DAYS_YEAR) : 0;
  const benchSharpe = stddev(benchExcess) > 0
    ? (mean(benchExcess) / stddev(benchExcess)) * Math.sqrt(TRADING_DAYS_YEAR) : 0;

  const reg = linearRegression(bench, strat);
  const corr = correlation(strat, bench);

  const te = strat.map((r, i) => r - bench[i]);
  const teStd = stddev(te);

  return {
    strategyReturn: stratCum * 100,
    benchmarkReturn: benchCum * 100,
    excessReturn: (stratCum - benchCum) * 100,
    strategySharpe: stratSharpe,
    benchmarkSharpe: benchSharpe,
    beta: reg.slope,
    alpha: (mean(strat) - rfDaily - reg.slope * (mean(bench) - rfDaily)) * TRADING_DAYS_YEAR * 100,
    correlation: corr,
    trackingError: teStd * Math.sqrt(TRADING_DAYS_YEAR) * 100,
    informationRatio: teStd > 0 ? (mean(te) / teStd) * Math.sqrt(TRADING_DAYS_YEAR) : 0,
  };
}

// ─── Statistical Significance ───────────────────────────────────────────────

export interface SignificanceTest {
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number;
  meanReturn: number;
  standardError: number;
}

export function tTestReturns(dailyReturns: number[], confidenceLevel = 0.95): SignificanceTest {
  const n = dailyReturns.length;
  if (n < 2) return { tStatistic: 0, pValue: 1, isSignificant: false, confidenceLevel, meanReturn: 0, standardError: 0 };

  const m = mean(dailyReturns);
  const se = stddev(dailyReturns) / Math.sqrt(n);
  const tStat = se > 0 ? m / se : 0;
  const df = n - 1;
  const pValue = 2 * (1 - tCDF(Math.abs(tStat), df));

  return {
    tStatistic: tStat,
    pValue,
    isSignificant: pValue < (1 - confidenceLevel),
    confidenceLevel,
    meanReturn: m,
    standardError: se,
  };
}

// ─── Exposure Analysis ──────────────────────────────────────────────────────

export interface ExposureAnalysis {
  longExposurePercent: number;
  shortExposurePercent: number;
  netExposurePercent: number;
  grossExposurePercent: number;
  avgLongExposure: number;
  avgShortExposure: number;
}

export function analyzeExposure(equityCurve: EquityPoint[]): ExposureAnalysis {
  if (!equityCurve.length) {
    return { longExposurePercent: 0, shortExposurePercent: 0, netExposurePercent: 0, grossExposurePercent: 0, avgLongExposure: 0, avgShortExposure: 0 };
  }

  let longBars = 0;
  let shortBars = 0;
  let totalLongExp = 0;
  let totalShortExp = 0;

  for (const ep of equityCurve) {
    const longExp = ep.positionValue > 0 ? ep.positionValue / ep.equity : 0;
    const shortExp = 0;
    if (longExp > 0) longBars++;
    if (shortExp > 0) shortBars++;
    totalLongExp += longExp;
    totalShortExp += shortExp;
  }

  const n = equityCurve.length;
  return {
    longExposurePercent: (longBars / n) * 100,
    shortExposurePercent: (shortBars / n) * 100,
    netExposurePercent: ((totalLongExp - totalShortExp) / n) * 100,
    grossExposurePercent: ((totalLongExp + totalShortExp) / n) * 100,
    avgLongExposure: longBars > 0 ? (totalLongExp / n) * 100 : 0,
    avgShortExposure: shortBars > 0 ? (totalShortExp / n) * 100 : 0,
  };
}
