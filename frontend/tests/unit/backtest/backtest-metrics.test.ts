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

function makeEquity(n: number): EquityPoint[] {
  const curve: EquityPoint[] = [];
  let eq = 100_000;
  let peak = eq;
  for (let i = 0; i < n; i++) {
    eq += 50 + Math.sin(i * 0.2) * 100;
    if (eq > peak) peak = eq;
    curve.push({
      time: 1_609_459_200_000 + i * DAY,
      equity: eq,
      cash: eq * 0.2,
      positionValue: eq * 0.8,
      drawdown: Math.max(0, peak - eq),
      drawdownPercent: peak > 0 ? ((peak - eq) / peak) * 100 : 0,
    });
  }
  return curve;
}

function makeTrades(n: number): Trade[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `T${i}`,
    symbol: 'AAPL',
    side: i % 2 ? Side.SHORT : Side.LONG,
    entryTime: 1_609_459_200_000 + i * DAY * 2,
    exitTime: 1_609_459_200_000 + i * DAY * 2 + DAY,
    entryPrice: 150,
    exitPrice: 150 + (i % 2 ? -1 : 1) * 2,
    quantity: 100,
    pnl: (i % 2 ? -1 : 1) * 200,
    pnlPercent: (i % 2 ? -1 : 1) * 1.33,
    commission: 1,
    slippage: 0.5,
    mae: 50,
    mfe: 100,
    duration: DAY,
    bars: 1,
    entryOrderId: `E${i}`,
    exitOrderId: `X${i}`,
  }));
}

function makeResult(): BacktestResult {
  const curve = makeEquity(252);
  const dailyReturns = curve.slice(1).map((c, i) => (c.equity - curve[i].equity) / curve[i].equity);
  return {
    config: { symbols: ['AAPL'], startDate: curve[0].time, endDate: curve[curve.length - 1].time, initialCapital: 100_000 },
    equityCurve: curve,
    trades: makeTrades(50),
    dailyReturns,
    metrics: {} as any,
    startTime: curve[0].time,
    endTime: curve[curve.length - 1].time,
  };
}

describe('computeMetrics', () => {
  it('returns metrics object', () => {
    const r = makeResult();
    const m = computeMetrics(r);
    expect(m).toHaveProperty('totalReturn');
    expect(m).toHaveProperty('sharpeRatio');
  });

  it('sharpe ratio defined for positive returns', () => {
    const r = makeResult();
    const m = computeMetrics(r);
    expect(typeof m.sharpeRatio).toBe('number');
  });

  it('maxDrawdown non-negative', () => {
    const r = makeResult();
    const m = computeMetrics(r);
    expect(m.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
  });
});

describe('computeMonthlyReturns', () => {
  it('returns monthly returns array', () => {
    const r = makeResult();
    const monthly = computeMonthlyReturns(r);
    expect(Array.isArray(monthly)).toBe(true);
  });
});

describe('rollingMetric', () => {
  it('rolling Sharpe over window', () => {
    const returns = Array.from({ length: 252 }, () => 0.001);
    const rolled = rollingMetric(returns, 60, (arr) => {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      const s = Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - 1)) || 0.001;
      return (m / s) * Math.sqrt(252);
    });
    expect(rolled.length).toBeLessThanOrEqual(returns.length);
  });
});

describe('maeMfeAnalysis', () => {
  it('returns MAE/MFE stats', () => {
    const trades = makeTrades(30);
    const a = maeMfeAnalysis(trades);
    expect(a).toBeDefined();
  });
});

describe('dayOfWeekAnalysis', () => {
  it('returns day-of-week stats', () => {
    const trades = makeTrades(30);
    const d = dayOfWeekAnalysis(trades);
    expect(d).toBeDefined();
  });
});

describe('hourOfDayAnalysis', () => {
  it('returns hour stats when timestamps available', () => {
    const trades = makeTrades(20);
    const h = hourOfDayAnalysis(trades);
    expect(h).toBeDefined();
  });
});

describe('tradeDurationDistribution', () => {
  it('returns duration buckets', () => {
    const trades = makeTrades(25);
    const dist = tradeDurationDistribution(trades);
    expect(dist).toBeDefined();
  });
});

describe('profitDistribution', () => {
  it('returns profit buckets', () => {
    const trades = makeTrades(25);
    const dist = profitDistribution(trades);
    expect(dist).toBeDefined();
  });
});

describe('compareToBenchmark', () => {
  it('compares strategy to benchmark returns', () => {
    const strategyReturns = Array(252).fill(0.001);
    const benchmarkReturns = Array(252).fill(0.0008);
    const c = compareToBenchmark(strategyReturns, benchmarkReturns);
    expect(c).toHaveProperty('alpha');
    expect(c).toHaveProperty('informationRatio');
  });
});

describe('tTestReturns', () => {
  it('returns t-stat and p-value', () => {
    const returns = Array(252).fill(0.001);
    const t = tTestReturns(returns, 0);
    expect(t).toHaveProperty('tStat');
  });
});

describe('analyzeExposure', () => {
  it('returns exposure analysis', () => {
    const curve = makeEquity(252);
    const a = analyzeExposure(curve);
    expect(a).toBeDefined();
  });
});
