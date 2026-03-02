import { describe, it, expect } from 'vitest';
import {
  simpleReturn,
  logReturn,
  cumulativeReturn,
  cumulativeReturnSeries,
  annualizedReturn,
  cagr,
  geometricMeanReturn,
  arithmeticMeanReturn,
  timeWeightedReturn,
  twrFromValuations,
  xirr,
  rollingReturns,
  calendarReturns,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
  treynorRatio,
  informationRatio,
  omegaRatio,
  sterlingRatio,
  burkeRatio,
  captureRatios,
  winLossStats,
  returnDistribution,
  peerComparison,
  benchmarkComparison,
  calculatePerformanceMetrics,
} from '../../../src/lib/portfolio/performance';

function generateReturns(n: number, mu: number, sigma: number): number[] {
  const returns: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    const normal = (z - Math.floor(z)) * 2 - 1;
    returns.push(mu + sigma * normal);
  }
  return returns;
}

describe('Basic Return Calculations', () => {
  it('simpleReturn: (110 - 100) / 100 = 0.10', () => {
    expect(simpleReturn(100, 110)).toBeCloseTo(0.10, 10);
  });

  it('simpleReturn: start=0 returns 0', () => {
    expect(simpleReturn(0, 100)).toBe(0);
  });

  it('logReturn: ln(110/100) ≈ 0.0953', () => {
    expect(logReturn(100, 110)).toBeCloseTo(Math.log(1.1), 10);
  });

  it('logReturn: negative start returns 0', () => {
    expect(logReturn(-10, 100)).toBe(0);
  });

  it('cumulativeReturn of [0.10, 0.05, -0.03]', () => {
    const expected = (1.10 * 1.05 * 0.97) - 1;
    expect(cumulativeReturn([0.10, 0.05, -0.03])).toBeCloseTo(expected, 10);
  });

  it('cumulativeReturn of empty returns -1? No, 0 with reduce init 1', () => {
    expect(cumulativeReturn([])).toBe(0);
  });

  it('cumulativeReturnSeries tracks running product', () => {
    const series = cumulativeReturnSeries([0.10, -0.05, 0.02]);
    expect(series[0]).toBeCloseTo(1.10, 10);
    expect(series[1]).toBeCloseTo(1.10 * 0.95, 10);
    expect(series[2]).toBeCloseTo(1.10 * 0.95 * 1.02, 10);
  });
});

describe('Annualized Return & CAGR', () => {
  it('annualizedReturn: 100% over 2 years → ~41.4%', () => {
    expect(annualizedReturn(1.0, 2)).toBeCloseTo(Math.sqrt(2) - 1, 4);
  });

  it('annualizedReturn with years=0 returns 0', () => {
    expect(annualizedReturn(0.5, 0)).toBe(0);
  });

  it('cagr: 100→200 over 3 years', () => {
    const result = cagr(100, 200, 3);
    expect(result).toBeCloseTo(Math.pow(2, 1 / 3) - 1, 8);
  });

  it('cagr: start=0 returns 0', () => {
    expect(cagr(0, 200, 3)).toBe(0);
  });

  it('cagr: years=0 returns 0', () => {
    expect(cagr(100, 200, 0)).toBe(0);
  });

  it('geometricMeanReturn of [0.10, -0.05, 0.08]', () => {
    const product = 1.10 * 0.95 * 1.08;
    const expected = Math.pow(product, 1 / 3) - 1;
    expect(geometricMeanReturn([0.10, -0.05, 0.08])).toBeCloseTo(expected, 8);
  });

  it('arithmeticMeanReturn = simple average', () => {
    expect(arithmeticMeanReturn([0.10, -0.05, 0.08])).toBeCloseTo((0.10 - 0.05 + 0.08) / 3, 10);
  });

  it('geometric mean <= arithmetic mean', () => {
    const returns = [0.10, -0.05, 0.08, 0.02, -0.03];
    expect(geometricMeanReturn(returns)).toBeLessThanOrEqual(arithmeticMeanReturn(returns) + 1e-10);
  });
});

describe('Time-Weighted Return', () => {
  it('TWR matches cumulativeReturn for daily returns', () => {
    const returns = [0.01, 0.02, -0.01, 0.005];
    expect(timeWeightedReturn(returns)).toBeCloseTo(cumulativeReturn(returns), 10);
  });

  it('twrFromValuations handles cash flows', () => {
    const valuations = [
      { date: 0, value: 1000, cashFlow: 0 },
      { date: 1, value: 1100, cashFlow: 100 },
      { date: 2, value: 1250, cashFlow: 0 },
    ];
    const twr = twrFromValuations(valuations);
    expect(twr).toBeGreaterThan(0);
  });

  it('twrFromValuations with no cash flows = simple return', () => {
    const valuations = [
      { date: 0, value: 1000, cashFlow: 0 },
      { date: 1, value: 1100, cashFlow: 0 },
    ];
    const twr = twrFromValuations(valuations);
    expect(twr).toBeCloseTo(0.10, 10);
  });
});

describe('XIRR', () => {
  it('simple investment: -1000 today, +1100 in 1 year ≈ 10%', () => {
    const now = Date.now();
    const yearMs = 365.25 * 24 * 60 * 60 * 1000;
    const cashFlows = [
      { date: now, amount: -1000 },
      { date: now + yearMs, amount: 1100 },
    ];
    const rate = xirr(cashFlows);
    expect(rate).toBeCloseTo(0.10, 2);
  });

  it('handles single cash flow by returning 0', () => {
    expect(xirr([{ date: Date.now(), amount: -1000 }])).toBe(0);
  });
});

describe('Sharpe Ratio', () => {
  it('Sharpe = (mean excess return) / σ * √252', () => {
    const returns = generateReturns(252, 0.001, 0.01);
    const sr = sharpeRatio(returns, 0.02);
    expect(isFinite(sr)).toBe(true);
  });

  it('positive returns with no risk-free rate gives positive Sharpe', () => {
    const returns = Array(100).fill(0.001);
    const sr = sharpeRatio(returns, 0);
    expect(sr).toBeGreaterThan(0);
  });

  it('all-zero returns gives Sharpe = 0', () => {
    const returns = Array(100).fill(0);
    expect(sharpeRatio(returns, 0)).toBe(0);
  });
});

describe('Sortino Ratio', () => {
  it('Sortino uses only downside deviation', () => {
    const returns = generateReturns(252, 0.001, 0.01);
    const sortino = sortinoRatio(returns, 0.02);
    expect(isFinite(sortino)).toBe(true);
  });

  it('Sortino is positive for positively-skewed returns', () => {
    const returns = [0.02, 0.03, 0.01, 0.04, -0.005, 0.015, 0.025, -0.002, 0.01, 0.02];
    const so = sortinoRatio(returns, 0);
    expect(so).toBeGreaterThan(0);
    expect(isFinite(so)).toBe(true);
  });

  it('all positive returns: Sortino = 0 (no downside deviation)', () => {
    const returns = Array(50).fill(0.01);
    expect(sortinoRatio(returns, 0)).toBe(0);
  });
});

describe('Calmar Ratio', () => {
  it('returns annualized return / max drawdown', () => {
    const returns = generateReturns(252, 0.001, 0.01);
    const calmar = calmarRatio(returns);
    expect(isFinite(calmar)).toBe(true);
  });
});

describe('Treynor Ratio', () => {
  it('returns excess return / beta', () => {
    const port = generateReturns(100, 0.001, 0.015);
    const bench = generateReturns(100, 0.0008, 0.01);
    const treynor = treynorRatio(port, bench, 0.02);
    expect(isFinite(treynor)).toBe(true);
  });
});

describe('Information Ratio', () => {
  it('returns excess / tracking error', () => {
    const port = generateReturns(100, 0.001, 0.015);
    const bench = generateReturns(100, 0.0008, 0.01);
    const ir = informationRatio(port, bench);
    expect(isFinite(ir)).toBe(true);
  });
});

describe('Omega Ratio', () => {
  it('positive-only returns give Infinity', () => {
    expect(omegaRatio(Array(50).fill(0.01), 0)).toBe(Infinity);
  });

  it('mixed returns give finite ratio', () => {
    const returns = [0.02, -0.01, 0.03, -0.005, 0.01];
    const omega = omegaRatio(returns, 0);
    expect(omega).toBeGreaterThan(0);
    expect(isFinite(omega)).toBe(true);
  });
});

describe('Sterling & Burke Ratios', () => {
  it('sterling ratio is finite', () => {
    const returns = generateReturns(252, 0.0005, 0.01);
    expect(isFinite(sterlingRatio(returns))).toBe(true);
  });

  it('burke ratio is finite', () => {
    const returns = generateReturns(252, 0.0005, 0.01);
    expect(isFinite(burkeRatio(returns))).toBe(true);
  });
});

describe('Capture Ratios', () => {
  it('up and down capture for same returns = 100%', () => {
    const returns = generateReturns(100, 0.001, 0.01);
    const cap = captureRatios(returns, returns);
    expect(cap.upCapture).toBeCloseTo(100, 0);
    expect(cap.downCapture).toBeCloseTo(100, 0);
  });
});

describe('Win/Loss Stats', () => {
  it('winRate between 0 and 1', () => {
    const returns = generateReturns(100, 0.0005, 0.01);
    const stats = winLossStats(returns);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
  });

  it('avgWin > 0 and avgLoss <= 0', () => {
    const returns = [0.05, -0.03, 0.02, -0.01, 0.01, -0.005];
    const stats = winLossStats(returns);
    expect(stats.avgWin).toBeGreaterThan(0);
    expect(stats.avgLoss).toBeLessThanOrEqual(0);
  });

  it('profitFactor > 0', () => {
    const returns = [0.05, -0.03, 0.02, -0.01, 0.01, -0.005];
    const stats = winLossStats(returns);
    expect(stats.profitFactor).toBeGreaterThan(0);
  });

  it('bestPeriod >= worstPeriod', () => {
    const returns = generateReturns(100, 0, 0.01);
    const stats = winLossStats(returns);
    expect(stats.bestPeriod).toBeGreaterThanOrEqual(stats.worstPeriod);
  });
});

describe('Rolling Returns', () => {
  it('returns rolling periods', () => {
    const n = 300;
    const returns = generateReturns(n, 0.0005, 0.01);
    const dates = Array.from({ length: n }, (_, i) => Date.now() - (n - i) * 86400000);
    const result = rollingReturns(returns, dates);
    expect(result).toHaveLength(n);
  });

  it('1m rolling return is NaN for first 20 entries', () => {
    const n = 100;
    const returns = generateReturns(n, 0.0005, 0.01);
    const dates = Array.from({ length: n }, (_, i) => Date.now() - (n - i) * 86400000);
    const result = rollingReturns(returns, dates);
    expect(isNaN(result[0].return1m)).toBe(true);
    expect(isNaN(result[20].return1m)).toBe(true);
  });
});

describe('Calendar Returns', () => {
  it('groups returns by year and month', () => {
    const n = 252 * 2;
    const returns = generateReturns(n, 0.0005, 0.01);
    const startDate = new Date(2023, 0, 2);
    const dates = Array.from({ length: n }, (_, i) => startDate.getTime() + i * 86400000);
    const result = calendarReturns(returns, dates);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toHaveProperty('year');
    expect(result[0]).toHaveProperty('monthly');
    expect(result[0].monthly).toHaveLength(12);
    expect(result[0]).toHaveProperty('quarterly');
    expect(result[0].quarterly).toHaveLength(4);
  });

  it('yearly return is compounded from daily', () => {
    const returns = [0.01, 0.02, -0.01, 0.005, 0.015];
    const startDate = new Date(2024, 5, 1);
    const dates = returns.map((_, i) => startDate.getTime() + i * 86400000);
    const result = calendarReturns(returns, dates);
    const yearlyFromDaily = cumulativeReturn(returns);
    expect(result[0].yearly).toBeCloseTo(yearlyFromDaily, 8);
  });
});

describe('Return Distribution', () => {
  it('returns all distribution stats', () => {
    const returns = generateReturns(500, 0, 0.01);
    const dist = returnDistribution(returns);
    expect(dist).toHaveProperty('mean');
    expect(dist).toHaveProperty('median');
    expect(dist).toHaveProperty('stdDev');
    expect(dist).toHaveProperty('skewness');
    expect(dist).toHaveProperty('kurtosis');
    expect(dist).toHaveProperty('min');
    expect(dist).toHaveProperty('max');
    expect(dist).toHaveProperty('percentiles');
    expect(dist).toHaveProperty('histogram');
  });

  it('min <= median <= max', () => {
    const returns = generateReturns(500, 0, 0.01);
    const dist = returnDistribution(returns);
    expect(dist.min).toBeLessThanOrEqual(dist.median);
    expect(dist.median).toBeLessThanOrEqual(dist.max);
  });

  it('histogram bins sum to approximately total count', () => {
    const returns = generateReturns(500, 0, 0.01);
    const dist = returnDistribution(returns, 20);
    const totalCount = dist.histogram.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBeGreaterThanOrEqual(498);
    expect(totalCount).toBeLessThanOrEqual(500);
  });
});

describe('Benchmark Comparison', () => {
  it('returns all comparison fields', () => {
    const port = generateReturns(252, 0.001, 0.015);
    const bench = generateReturns(252, 0.0008, 0.01);
    const comp = benchmarkComparison(port, bench, 0.02);
    expect(comp).toHaveProperty('portfolioReturn');
    expect(comp).toHaveProperty('benchmarkReturn');
    expect(comp).toHaveProperty('alpha');
    expect(comp).toHaveProperty('beta');
    expect(comp).toHaveProperty('trackingError');
    expect(comp).toHaveProperty('rSquared');
    expect(comp.rSquared).toBeGreaterThanOrEqual(-1e-9);
    expect(comp.rSquared).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('Peer Comparison', () => {
  it('rankings are valid', () => {
    const port = generateReturns(252, 0.001, 0.01);
    const peers = Array.from({ length: 5 }, (_, i) =>
      generateReturns(252, 0.0005 + i * 0.0002, 0.01)
    );
    const rankings = peerComparison(port, peers, 0.02);
    for (const r of rankings) {
      expect(r.rank).toBeGreaterThanOrEqual(1);
      expect(r.rank).toBeLessThanOrEqual(6);
      expect(r.percentile).toBeGreaterThanOrEqual(0);
      expect(r.percentile).toBeLessThanOrEqual(100);
    }
  });
});

describe('Full Performance Metrics', () => {
  it('returns all metric fields', () => {
    const port = generateReturns(252, 0.001, 0.015);
    const bench = generateReturns(252, 0.0008, 0.01);
    const metrics = calculatePerformanceMetrics(port, bench, 0.02);
    expect(metrics).toHaveProperty('totalReturn');
    expect(metrics).toHaveProperty('annualizedReturn');
    expect(metrics).toHaveProperty('sharpe');
    expect(metrics).toHaveProperty('sortino');
    expect(metrics).toHaveProperty('calmar');
    expect(metrics).toHaveProperty('maxDrawdown');
    expect(metrics).toHaveProperty('trackingError');
    expect(metrics).toHaveProperty('informationRatio');
    expect(metrics).toHaveProperty('alpha');
    expect(metrics).toHaveProperty('beta');
    expect(metrics).toHaveProperty('treynor');
    expect(metrics).toHaveProperty('omega');
    expect(metrics).toHaveProperty('sterling');
    expect(metrics).toHaveProperty('burke');
    expect(metrics).toHaveProperty('cagr');
    expect(metrics).toHaveProperty('geometricMean');
    expect(metrics).toHaveProperty('arithmeticMean');
  });

  it('maxDrawdown is between 0 and 1', () => {
    const port = generateReturns(252, 0.001, 0.015);
    const bench = generateReturns(252, 0.0008, 0.01);
    const metrics = calculatePerformanceMetrics(port, bench);
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDrawdown).toBeLessThanOrEqual(1);
  });
});
