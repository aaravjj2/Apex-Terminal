import type {
  ReturnSeries,
  PerformanceMetrics,
  RollingReturn,
  CalendarReturn,
  CaptureRatio,
  WinLossStats,
  CashFlow,
} from './types';
import {
  mean,
  stdDev,
  variance,
  covariance,
  maxDrawdown,
  downsideDeviation,
  calculateBeta,
  trackingError as calcTrackingError,
} from './risk';

// ─── Basic Return Calculations ──────────────────────────────────────────────

export function simpleReturn(startValue: number, endValue: number): number {
  return startValue !== 0 ? (endValue - startValue) / startValue : 0;
}

export function logReturn(startValue: number, endValue: number): number {
  return startValue > 0 && endValue > 0 ? Math.log(endValue / startValue) : 0;
}

export function cumulativeReturn(returns: number[]): number {
  return returns.reduce((cum, r) => cum * (1 + r), 1) - 1;
}

export function cumulativeReturnSeries(returns: number[]): number[] {
  const series = new Array(returns.length);
  series[0] = 1 + returns[0];
  for (let i = 1; i < returns.length; i++) {
    series[i] = series[i - 1] * (1 + returns[i]);
  }
  return series;
}

export function annualizedReturn(totalReturn: number, years: number): number {
  if (years <= 0) return 0;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

export function cagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

export function geometricMeanReturn(returns: number[]): number {
  const product = returns.reduce((p, r) => p * (1 + r), 1);
  return Math.pow(product, 1 / returns.length) - 1;
}

export function arithmeticMeanReturn(returns: number[]): number {
  return mean(returns);
}

// ─── Time-Weighted Return (TWR) ─────────────────────────────────────────────

export function timeWeightedReturn(
  subPeriodReturns: number[]
): number {
  return subPeriodReturns.reduce((cum, r) => cum * (1 + r), 1) - 1;
}

export function twrFromValuations(
  valuations: { date: number; value: number; cashFlow: number }[]
): number {
  if (valuations.length < 2) return 0;

  let twr = 1;
  for (let i = 1; i < valuations.length; i++) {
    const prevValue = valuations[i - 1].value;
    const cf = valuations[i].cashFlow;
    const adjustedStart = prevValue + cf;
    if (adjustedStart > 0) {
      twr *= valuations[i].value / adjustedStart;
    }
  }
  return twr - 1;
}

// ─── Money-Weighted Return (XIRR) ──────────────────────────────────────────

export function xirr(
  cashFlows: { date: number; amount: number }[],
  guess = 0.1,
  tolerance = 1e-10,
  maxIter = 1000
): number {
  if (cashFlows.length < 2) return 0;

  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const dates = cashFlows.map(cf => cf.date);
  const amounts = cashFlows.map(cf => cf.amount);
  const t0 = dates[0];
  const years = dates.map(d => (d - t0) / msPerYear);

  let rate = guess;

  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0;

    for (let i = 0; i < amounts.length; i++) {
      const discountFactor = Math.pow(1 + rate, years[i]);
      if (discountFactor === 0) continue;
      npv += amounts[i] / discountFactor;
      dnpv -= years[i] * amounts[i] / (discountFactor * (1 + rate));
    }

    if (Math.abs(npv) < tolerance) return rate;
    if (Math.abs(dnpv) < 1e-20) break;

    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;

    if (rate < -0.999) rate = -0.999;
    if (rate > 100) rate = 100;
  }

  return rate;
}

// ─── Rolling Returns ────────────────────────────────────────────────────────

function rollingReturnForWindow(returns: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = window; i <= returns.length; i++) {
    const slice = returns.slice(i - window, i);
    result.push(cumulativeReturn(slice));
  }
  return result;
}

export function rollingReturns(
  returns: number[],
  dates: number[]
): RollingReturn[] {
  const TRADING_DAYS = { '1m': 21, '3m': 63, '6m': 126, '1y': 252, '3y': 756, '5y': 1260 };
  const results: RollingReturn[] = [];

  const minWindow = Math.min(...Object.values(TRADING_DAYS));
  if (returns.length < minWindow) return results;

  const roll = (w: number, idx: number) => {
    if (idx < w) return NaN;
    const slice = returns.slice(idx - w, idx);
    return cumulativeReturn(slice);
  };

  for (let i = 0; i < returns.length; i++) {
    results.push({
      date: dates[i],
      return1m: roll(TRADING_DAYS['1m'], i),
      return3m: roll(TRADING_DAYS['3m'], i),
      return6m: roll(TRADING_DAYS['6m'], i),
      return1y: roll(TRADING_DAYS['1y'], i),
      return3y: roll(TRADING_DAYS['3y'], i),
      return5y: roll(TRADING_DAYS['5y'], i),
    });
  }
  return results;
}

// ─── Calendar Returns ───────────────────────────────────────────────────────

export function calendarReturns(
  returns: number[],
  dates: number[]
): CalendarReturn[] {
  const byYear = new Map<number, { month: number; returns: number[] }[]>();

  for (let i = 0; i < returns.length; i++) {
    const d = new Date(dates[i]);
    const year = d.getFullYear();
    const month = d.getMonth();

    if (!byYear.has(year)) byYear.set(year, []);
    const yearData = byYear.get(year)!;
    let monthEntry = yearData.find(m => m.month === month);
    if (!monthEntry) {
      monthEntry = { month, returns: [] };
      yearData.push(monthEntry);
    }
    monthEntry.returns.push(returns[i]);
  }

  const results: CalendarReturn[] = [];
  for (const [year, months] of byYear.entries()) {
    const monthly = new Array(12).fill(0);
    const allReturnsInYear: number[] = [];

    for (const m of months) {
      monthly[m.month] = cumulativeReturn(m.returns);
      allReturnsInYear.push(...m.returns);
    }

    const quarterly = [0, 1, 2, 3].map(q => {
      const qMonths = [q * 3, q * 3 + 1, q * 3 + 2];
      const qReturns = qMonths.map(m => monthly[m]);
      return qReturns.reduce((cum, r) => cum * (1 + r), 1) - 1;
    });

    results.push({
      year,
      monthly,
      quarterly,
      yearly: cumulativeReturn(allReturnsInYear),
    });
  }

  return results.sort((a, b) => a.year - b.year);
}

// ─── Risk-Adjusted Metrics ──────────────────────────────────────────────────

export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  const excessMean = mean(returns) - riskFreeRate / 252;
  const vol = stdDev(returns);
  return vol > 0 ? (excessMean / vol) * Math.sqrt(252) : 0;
}

export function sortinoRatio(returns: number[], riskFreeRate = 0, mar = 0): number {
  const excessMean = mean(returns) - riskFreeRate / 252;
  const dd = downsideDeviation(returns, mar);
  return dd > 0 ? (excessMean * Math.sqrt(252)) / (dd * Math.sqrt(252)) : 0;
}

export function calmarRatio(returns: number[]): number {
  const annRet = annualizedReturn(cumulativeReturn(returns), returns.length / 252);
  const mdd = maxDrawdown(returns);
  return mdd > 0 ? annRet / mdd : 0;
}

export function treynorRatio(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0
): number {
  const beta = calculateBeta(portfolioReturns, benchmarkReturns);
  const excessReturn = mean(portfolioReturns) * 252 - riskFreeRate;
  return beta !== 0 ? excessReturn / beta : 0;
}

export function informationRatio(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number {
  const excess = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  const te = stdDev(excess) * Math.sqrt(252);
  const excessMean = mean(excess) * 252;
  return te > 0 ? excessMean / te : 0;
}

export function omegaRatio(returns: number[], threshold = 0): number {
  let gainSum = 0;
  let lossSum = 0;
  for (const r of returns) {
    if (r > threshold) gainSum += r - threshold;
    else lossSum += threshold - r;
  }
  return lossSum > 0 ? gainSum / lossSum : Infinity;
}

export function sterlingRatio(returns: number[], periods = 3): number {
  const annRet = annualizedReturn(cumulativeReturn(returns), returns.length / 252);
  const drawdowns: number[] = [];

  let peak = 1;
  let cum = 1;
  let currentDD = 0;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) {
      if (currentDD > 0) drawdowns.push(currentDD);
      peak = cum;
      currentDD = 0;
    }
    const dd = (peak - cum) / peak;
    if (dd > currentDD) currentDD = dd;
  }
  if (currentDD > 0) drawdowns.push(currentDD);

  drawdowns.sort((a, b) => b - a);
  const topN = drawdowns.slice(0, periods);
  const avgDD = topN.length > 0 ? topN.reduce((s, d) => s + d, 0) / topN.length : 0;
  return avgDD > 0 ? annRet / avgDD : 0;
}

export function burkeRatio(returns: number[]): number {
  const annRet = annualizedReturn(cumulativeReturn(returns), returns.length / 252);
  const drawdowns: number[] = [];

  let peak = 1;
  let cum = 1;
  let currentDD = 0;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) {
      if (currentDD > 0) drawdowns.push(currentDD);
      peak = cum;
      currentDD = 0;
    }
    const dd = (peak - cum) / peak;
    if (dd > currentDD) currentDD = dd;
  }
  if (currentDD > 0) drawdowns.push(currentDD);

  const sumSqDD = drawdowns.reduce((s, d) => s + d * d, 0);
  const burkeDenom = Math.sqrt(sumSqDD / drawdowns.length);
  return burkeDenom > 0 ? annRet / burkeDenom : 0;
}

// ─── Capture Ratios ─────────────────────────────────────────────────────────

export function captureRatios(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): CaptureRatio {
  const upPortfolio: number[] = [];
  const upBenchmark: number[] = [];
  const downPortfolio: number[] = [];
  const downBenchmark: number[] = [];

  for (let i = 0; i < benchmarkReturns.length; i++) {
    if (benchmarkReturns[i] >= 0) {
      upPortfolio.push(portfolioReturns[i]);
      upBenchmark.push(benchmarkReturns[i]);
    } else {
      downPortfolio.push(portfolioReturns[i]);
      downBenchmark.push(benchmarkReturns[i]);
    }
  }

  const geoUp = (arr: number[]) => {
    if (arr.length === 0) return 0;
    return geometricMeanReturn(arr);
  };

  const upBmRet = geoUp(upBenchmark);
  const downBmRet = geoUp(downBenchmark);

  const upCapture = upBmRet !== 0 ? (geoUp(upPortfolio) / upBmRet) * 100 : 0;
  const downCapture = downBmRet !== 0 ? (geoUp(downPortfolio) / downBmRet) * 100 : 0;
  const ratio = downCapture !== 0 ? upCapture / downCapture : 0;

  return { upCapture, downCapture, captureRatio: ratio };
}

// ─── Win/Loss Statistics ────────────────────────────────────────────────────

export function winLossStats(
  portfolioReturns: number[],
  benchmarkReturns?: number[]
): WinLossStats {
  const wins = portfolioReturns.filter(r => r > 0);
  const losses = portfolioReturns.filter(r => r <= 0);

  const winRate = portfolioReturns.length > 0 ? wins.length / portfolioReturns.length : 0;
  const avgWin = wins.length > 0 ? mean(wins) : 0;
  const avgLoss = losses.length > 0 ? mean(losses) : 0;
  const grossProfit = wins.reduce((s, w) => s + w, 0);
  const grossLoss = Math.abs(losses.reduce((s, l) => s + l, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity;

  let battingAverage = 0;
  if (benchmarkReturns && benchmarkReturns.length === portfolioReturns.length) {
    const outperform = portfolioReturns.filter((r, i) => r > benchmarkReturns[i]).length;
    battingAverage = outperform / portfolioReturns.length;
  }

  return {
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    battingAverage,
    bestPeriod: portfolioReturns.length > 0 ? Math.max(...portfolioReturns) : 0,
    worstPeriod: portfolioReturns.length > 0 ? Math.min(...portfolioReturns) : 0,
  };
}

// ─── Return Distribution Analysis ───────────────────────────────────────────

export interface DistributionStats {
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  percentiles: Record<string, number>;
  histogram: { bin: number; count: number }[];
}

export function returnDistribution(returns: number[], numBins = 50): DistributionStats {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  const m = mean(returns);
  const s = stdDev(returns);

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Skewness
  let skewSum = 0;
  let kurtSum = 0;
  for (const r of returns) {
    const z = (r - m) / s;
    skewSum += z ** 3;
    kurtSum += z ** 4;
  }
  const skew = (n / ((n - 1) * (n - 2))) * skewSum;
  const kurt = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));

  const minVal = sorted[0];
  const maxVal = sorted[n - 1];
  const binWidth = (maxVal - minVal) / numBins;
  const histogram: { bin: number; count: number }[] = [];

  for (let b = 0; b < numBins; b++) {
    const lo = minVal + b * binWidth;
    const hi = lo + binWidth;
    const count = returns.filter(r => r >= lo && (b === numBins - 1 ? r <= hi : r < hi)).length;
    histogram.push({ bin: lo + binWidth / 2, count });
  }

  const pctKeys = [1, 5, 10, 25, 50, 75, 90, 95, 99];
  const percentiles: Record<string, number> = {};
  for (const p of pctKeys) {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    percentiles[`p${p}`] = lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  }

  return { mean: m, median, stdDev: s, skewness: skew, kurtosis: kurt, min: minVal, max: maxVal, percentiles, histogram };
}

// ─── Peer Comparison ────────────────────────────────────────────────────────

export interface PeerRanking {
  metric: string;
  value: number;
  rank: number;
  percentile: number;
  total: number;
}

export function peerComparison(
  portfolioReturns: number[],
  peerReturns: number[][],
  riskFreeRate = 0
): PeerRanking[] {
  const metrics = [
    { name: 'totalReturn', fn: (r: number[]) => cumulativeReturn(r) },
    { name: 'annualizedReturn', fn: (r: number[]) => annualizedReturn(cumulativeReturn(r), r.length / 252) },
    { name: 'volatility', fn: (r: number[]) => stdDev(r) * Math.sqrt(252) },
    { name: 'sharpe', fn: (r: number[]) => sharpeRatio(r, riskFreeRate) },
    { name: 'maxDrawdown', fn: (r: number[]) => maxDrawdown(r) },
    { name: 'calmar', fn: (r: number[]) => calmarRatio(r) },
  ];

  const results: PeerRanking[] = [];
  const all = [portfolioReturns, ...peerReturns];

  for (const metric of metrics) {
    const values = all.map(r => metric.fn(r));
    const portfolioValue = values[0];

    const isLowerBetter = metric.name === 'volatility' || metric.name === 'maxDrawdown';
    const sorted = [...values].sort((a, b) => isLowerBetter ? a - b : b - a);
    const rank = sorted.indexOf(portfolioValue) + 1;

    results.push({
      metric: metric.name,
      value: portfolioValue,
      rank,
      percentile: ((all.length - rank) / (all.length - 1)) * 100,
      total: all.length,
    });
  }

  return results;
}

// ─── Benchmark Comparison ───────────────────────────────────────────────────

export interface BenchmarkComparison {
  portfolioReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number;
  downCapture: number;
  correlationToBenchmark: number;
  rSquared: number;
}

export function benchmarkComparison(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0
): BenchmarkComparison {
  const portCum = cumulativeReturn(portfolioReturns);
  const bmCum = cumulativeReturn(benchmarkReturns);
  const years = portfolioReturns.length / 252;

  const portAnn = annualizedReturn(portCum, years);
  const bmAnn = annualizedReturn(bmCum, years);

  const beta = calculateBeta(portfolioReturns, benchmarkReturns);
  const alpha = (portAnn - riskFreeRate) - beta * (bmAnn - riskFreeRate);
  const te = calcTrackingError(portfolioReturns, benchmarkReturns);
  const ir = informationRatio(portfolioReturns, benchmarkReturns);
  const capture = captureRatios(portfolioReturns, benchmarkReturns);

  const cov = covariance(portfolioReturns, benchmarkReturns);
  const portVol = stdDev(portfolioReturns);
  const bmVol = stdDev(benchmarkReturns);
  const corr = (portVol > 0 && bmVol > 0) ? cov / (portVol * bmVol) : 0;

  return {
    portfolioReturn: portAnn,
    benchmarkReturn: bmAnn,
    excessReturn: portAnn - bmAnn,
    alpha,
    beta,
    trackingError: te,
    informationRatio: ir,
    upCapture: capture.upCapture,
    downCapture: capture.downCapture,
    correlationToBenchmark: corr,
    rSquared: corr * corr,
  };
}

// ─── Aggregate Performance Metrics ──────────────────────────────────────────

export function calculatePerformanceMetrics(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0
): PerformanceMetrics {
  const totalRet = cumulativeReturn(portfolioReturns);
  const years = portfolioReturns.length / 252;
  const annRet = annualizedReturn(totalRet, years);
  const beta = calculateBeta(portfolioReturns, benchmarkReturns);

  const bmCum = cumulativeReturn(benchmarkReturns);
  const bmAnn = annualizedReturn(bmCum, years);

  return {
    totalReturn: totalRet,
    annualizedReturn: annRet,
    sharpe: sharpeRatio(portfolioReturns, riskFreeRate),
    sortino: sortinoRatio(portfolioReturns, riskFreeRate),
    calmar: calmarRatio(portfolioReturns),
    maxDrawdown: maxDrawdown(portfolioReturns),
    trackingError: calcTrackingError(portfolioReturns, benchmarkReturns),
    informationRatio: informationRatio(portfolioReturns, benchmarkReturns),
    alpha: (annRet - riskFreeRate) - beta * (bmAnn - riskFreeRate),
    beta,
    treynor: treynorRatio(portfolioReturns, benchmarkReturns, riskFreeRate),
    omega: omegaRatio(portfolioReturns),
    sterling: sterlingRatio(portfolioReturns),
    burke: burkeRatio(portfolioReturns),
    cagr: annRet,
    geometricMean: geometricMeanReturn(portfolioReturns),
    arithmeticMean: arithmeticMeanReturn(portfolioReturns),
  };
}
