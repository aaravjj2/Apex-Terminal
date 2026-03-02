import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  computeMonthlyReturns,
  rollingMetric,
  maeMfeAnalysis,
  dayOfWeekAnalysis,
  hourOfDayAnalysis,
  tradeDurationDistribution,
  profitDistribution,
  compareToBenchmark,
  tTestReturns,
  analyzeExposure,
} from '../../../src/lib/backtest/analytics';
import type { BacktestResult, Trade, EquityPoint } from '../../../src/lib/backtest/types';
import { Side } from '../../../src/lib/backtest/types';

const DAY = 86_400_000;

function makeEquityCurve(n: number, start = 100_000, drift = 50): EquityPoint[] {
  const curve: EquityPoint[] = [];
  let equity = start;
  let peak = equity;
  for (let i = 0; i < n; i++) {
    equity += drift + Math.sin(i * 0.3) * 200;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    curve.push({
      time: 1_609_459_200_000 + i * DAY,
      equity,
      cash: equity * 0.3,
      positionValue: equity * 0.7,
      drawdown: Math.max(0, dd),
      drawdownPercent: peak > 0 ? Math.max(0, dd / peak * 100) : 0,
    });
  }
  return curve;
}

function makeTrades(n: number, winPct = 0.6): Trade[] {
  const trades: Trade[] = [];
  for (let i = 0; i < n; i++) {
    const isWin = Math.random() < winPct;
    const pnl = isWin ? 100 + Math.random() * 500 : -(50 + Math.random() * 300);
    trades.push({
      id: `TRD-${i}`,
      symbol: 'AAPL',
      side: Side.LONG,
      entryTime: 1_609_459_200_000 + i * DAY * 3,
      exitTime: 1_609_459_200_000 + i * DAY * 3 + DAY * 2,
      entryPrice: 150,
      exitPrice: 150 + pnl / 100,
      quantity: 100,
      pnl,
      pnlPercent: pnl / 15000 * 100,
      commission: 2,
      slippage: 0.5,
      mae: Math.abs(pnl) * 0.3,
      mfe: Math.abs(pnl) * 1.5,
      duration: DAY * 2,
      bars: 2,
      entryOrderId: `ORD-E-${i}`,
      exitOrderId: `ORD-X-${i}`,
    });
  }
  return trades;
}

function makeResult(overrides?: Partial<BacktestResult>): BacktestResult {
  const curve = makeEquityCurve(100);
  const dailyReturns = [];
  for (let i = 1; i < curve.length; i++) {
    dailyReturns.push((curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity);
  }
  return {
    config: {
      symbols: ['AAPL'],
      startDate: curve[0].time,
      endDate: curve[curve.length - 1].time,
      initialCapital: 100_000,
      riskFreeRate: 0.05,
    } as any,
    strategyName: 'Test',
    paramValues: {},
    trades: makeTrades(30),
    orders: [],
    equityCurve: curve,
    drawdowns: [],
    metrics: {} as any,
    monthlyReturns: [],
    dailyReturns,
    startTime: curve[0].time,
    endTime: curve[curve.length - 1].time,
    executionTimeMs: 10,
    ...overrides,
  };
}

describe('computeMetrics', () => {
  it('computes all required metric fields', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(metrics).toHaveProperty('totalReturn');
    expect(metrics).toHaveProperty('sharpeRatio');
    expect(metrics).toHaveProperty('sortinoRatio');
    expect(metrics).toHaveProperty('maxDrawdown');
    expect(metrics).toHaveProperty('winRate');
    expect(metrics).toHaveProperty('profitFactor');
    expect(metrics).toHaveProperty('expectancy');
  });

  it('computes correct total return', () => {
    const curve = makeEquityCurve(50, 100_000, 100);
    const result = makeResult({ equityCurve: curve });
    const metrics = computeMetrics(result);
    const expected = curve[curve.length - 1].equity - 100_000;
    expect(metrics.totalReturn).toBeCloseTo(expected, 0);
  });

  it('Sharpe ratio is positive for uptrending equity', () => {
    const curve = makeEquityCurve(200, 100_000, 100);
    const dr = [];
    for (let i = 1; i < curve.length; i++) dr.push((curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity);
    const result = makeResult({ equityCurve: curve, dailyReturns: dr });
    const metrics = computeMetrics(result);
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it('Sortino ratio uses only downside deviation', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(typeof metrics.sortinoRatio).toBe('number');
    expect(isFinite(metrics.sortinoRatio)).toBe(true);
  });

  it('max drawdown is non-negative', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
  });

  it('win rate is between 0 and 100', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(metrics.winRate).toBeLessThanOrEqual(100);
  });

  it('profit factor > 0 when there are winning trades', () => {
    const trades = makeTrades(20, 0.8);
    const result = makeResult({ trades });
    const metrics = computeMetrics(result);
    expect(metrics.profitFactor).toBeGreaterThan(0);
  });

  it('expectancy reflects average trade PnL', () => {
    const trades = makeTrades(50, 0.6);
    const result = makeResult({ trades });
    const metrics = computeMetrics(result);
    const avgPnl = trades.reduce((s, t) => s + t.pnl, 0) / trades.length;
    expect(metrics.expectancy).toBeCloseTo(avgPnl, 0);
  });

  it('returns zero metrics for empty result', () => {
    const result = makeResult({ trades: [], equityCurve: [{ time: 0, equity: 100000, cash: 100000, positionValue: 0, drawdown: 0, drawdownPercent: 0 }], dailyReturns: [] });
    const metrics = computeMetrics(result);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
  });

  it('computes VaR and CVaR', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(metrics.var95).toBeGreaterThanOrEqual(0);
    expect(metrics.cvar95).toBeGreaterThanOrEqual(0);
  });

  it('computes skewness and kurtosis', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(typeof metrics.skewness).toBe('number');
    expect(typeof metrics.kurtosis).toBe('number');
  });

  it('computes consecutive wins and losses', () => {
    const result = makeResult();
    const metrics = computeMetrics(result);
    expect(metrics.maxConsecutiveWins).toBeGreaterThanOrEqual(0);
    expect(metrics.maxConsecutiveLosses).toBeGreaterThanOrEqual(0);
  });
});

describe('computeMonthlyReturns', () => {
  it('returns monthly return entries', () => {
    const curve = makeEquityCurve(90);
    const trades = makeTrades(10);
    const monthly = computeMonthlyReturns(curve, trades);
    expect(monthly.length).toBeGreaterThan(0);
    for (const m of monthly) {
      expect(m).toHaveProperty('year');
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('return_');
      expect(m).toHaveProperty('returnPercent');
    }
  });

  it('returns empty for short curve', () => {
    expect(computeMonthlyReturns([], [])).toHaveLength(0);
    expect(computeMonthlyReturns([makeEquityCurve(1)[0]], [])).toHaveLength(0);
  });
});

describe('rollingMetric', () => {
  it('computes rolling Sharpe ratio', () => {
    const dr = Array.from({ length: 100 }, () => 0.001 + Math.random() * 0.005);
    const rolling = rollingMetric(dr, 20, 'sharpe');
    expect(rolling.length).toBe(81);
    for (const r of rolling) expect(typeof r.value).toBe('number');
  });

  it('computes rolling Sortino', () => {
    const dr = Array.from({ length: 60 }, () => 0.002 - Math.random() * 0.003);
    const rolling = rollingMetric(dr, 20, 'sortino');
    expect(rolling.length).toBe(41);
  });

  it('computes rolling volatility', () => {
    const dr = Array.from({ length: 50 }, () => Math.random() * 0.01);
    const rolling = rollingMetric(dr, 10, 'volatility');
    expect(rolling.length).toBe(41);
    for (const r of rolling) expect(r.value).toBeGreaterThanOrEqual(0);
  });
});

describe('maeMfeAnalysis', () => {
  it('returns correct number of points', () => {
    const trades = makeTrades(20);
    const analysis = maeMfeAnalysis(trades);
    expect(analysis.length).toBe(20);
    for (const pt of analysis) {
      expect(pt).toHaveProperty('tradeId');
      expect(pt).toHaveProperty('pnlPercent');
      expect(pt).toHaveProperty('maePercent');
      expect(pt).toHaveProperty('mfePercent');
    }
  });
});

describe('dayOfWeekAnalysis', () => {
  it('returns 7 entries for all days', () => {
    const trades = makeTrades(30);
    const analysis = dayOfWeekAnalysis(trades);
    expect(analysis.length).toBe(7);
    expect(analysis[0].label).toBe('Sunday');
    expect(analysis[6].label).toBe('Saturday');
  });
});

describe('hourOfDayAnalysis', () => {
  it('returns 24 entries', () => {
    const trades = makeTrades(10);
    const analysis = hourOfDayAnalysis(trades);
    expect(analysis.length).toBe(24);
  });
});

describe('tradeDurationDistribution', () => {
  it('creates histogram buckets', () => {
    const trades = makeTrades(30);
    const dist = tradeDurationDistribution(trades, 5);
    expect(dist.length).toBeGreaterThan(0);
    const totalCount = dist.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(30);
  });

  it('returns empty for no trades', () => {
    expect(tradeDurationDistribution([])).toHaveLength(0);
  });
});

describe('profitDistribution', () => {
  it('creates P&L histogram', () => {
    const trades = makeTrades(25);
    const dist = profitDistribution(trades, 10);
    expect(dist.length).toBeGreaterThan(0);
    const totalCount = dist.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(25);
  });
});

describe('compareToBenchmark', () => {
  it('computes benchmark comparison metrics', () => {
    const stratReturns = Array.from({ length: 100 }, () => 0.001 + Math.random() * 0.002);
    const benchReturns = Array.from({ length: 100 }, () => 0.0005 + Math.random() * 0.002);
    const comparison = compareToBenchmark(stratReturns, benchReturns);
    expect(comparison).toHaveProperty('strategyReturn');
    expect(comparison).toHaveProperty('benchmarkReturn');
    expect(comparison).toHaveProperty('beta');
    expect(comparison).toHaveProperty('alpha');
    expect(comparison).toHaveProperty('correlation');
    expect(comparison).toHaveProperty('trackingError');
    expect(comparison).toHaveProperty('informationRatio');
  });

  it('strategy return equals benchmark when returns identical', () => {
    const returns = Array.from({ length: 50 }, () => 0.001);
    const comparison = compareToBenchmark(returns, returns);
    expect(comparison.excessReturn).toBeCloseTo(0, 2);
  });
});

describe('tTestReturns', () => {
  it('returns significance test result', () => {
    const returns = Array.from({ length: 100 }, () => 0.002 + (Math.random() - 0.5) * 0.001);
    const test = tTestReturns(returns);
    expect(test).toHaveProperty('tStatistic');
    expect(test).toHaveProperty('pValue');
    expect(test).toHaveProperty('isSignificant');
    expect(test.pValue).toBeGreaterThanOrEqual(0);
    expect(test.pValue).toBeLessThanOrEqual(1);
  });

  it('detects significance for strongly positive returns', () => {
    const returns = Array.from({ length: 200 }, () => 0.01 + Math.random() * 0.001);
    const test = tTestReturns(returns, 0.95);
    expect(test.tStatistic).toBeGreaterThan(0);
  });

  it('returns non-significant for zero returns', () => {
    const test = tTestReturns([0, 0, 0, 0, 0]);
    expect(test.tStatistic).toBe(0);
    expect(test.isSignificant).toBe(false);
  });
});

describe('analyzeExposure', () => {
  it('computes exposure percentages', () => {
    const curve = makeEquityCurve(50);
    const exposure = analyzeExposure(curve);
    expect(exposure).toHaveProperty('longExposurePercent');
    expect(exposure).toHaveProperty('netExposurePercent');
    expect(exposure.longExposurePercent).toBeGreaterThanOrEqual(0);
  });

  it('returns zeros for empty curve', () => {
    const exposure = analyzeExposure([]);
    expect(exposure.longExposurePercent).toBe(0);
    expect(exposure.grossExposurePercent).toBe(0);
  });
});
