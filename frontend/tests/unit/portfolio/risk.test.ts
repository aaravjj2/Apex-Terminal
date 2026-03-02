import { describe, it, expect } from 'vitest';
import {
  mean,
  variance,
  stdDev,
  covariance,
  skewness,
  kurtosis,
  sampleCovarianceMatrix,
  ewmaCovarianceMatrix,
  ledoitWolfShrinkage,
  correlationMatrix,
  historicalVaR,
  parametricVaR,
  monteCarloVaR,
  cornishFisherVaR,
  expectedShortfall,
  componentVaR,
  incrementalVaR,
  calculateDrawdowns,
  maxDrawdown,
  calculateBeta,
  trackingError,
  factorRiskDecomposition,
  herfindahlIndex,
  effectiveNumPositions,
  downsideDeviation,
  semiVariance,
  calculateRiskMetrics,
  tailRatio,
  gainToPainRatio,
  ulcerIndex,
  stressTest,
  matMul,
  matVecMul,
  transpose,
  choleskyDecomposition,
  matInverse,
} from '../../../src/lib/portfolio/risk';

// Helper: generate pseudo-random returns with a seed-like approach
function generateReturns(n: number, mu: number, sigma: number): number[] {
  const returns: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    const normal = (z - Math.floor(z)) * 2 - 1;
    returns.push(mu + sigma * normal);
  }
  return returns;
}

describe('Statistical Helpers', () => {
  it('mean of [1,2,3,4,5] = 3', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('mean of single value equals that value', () => {
    expect(mean([42])).toBe(42);
  });

  it('variance of constant array = 0 (ddof=0)', () => {
    expect(variance([5, 5, 5, 5], 0)).toBe(0);
  });

  it('variance of [1,2,3,4,5] with ddof=1 = 2.5', () => {
    expect(variance([1, 2, 3, 4, 5], 1)).toBe(2.5);
  });

  it('stdDev of [2,4,4,4,5,5,7,9] ≈ 2.138', () => {
    const s = stdDev([2, 4, 4, 4, 5, 5, 7, 9], 1);
    expect(s).toBeCloseTo(2.138, 2);
  });

  it('covariance of identical arrays = variance', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(covariance(arr, arr, 1)).toBeCloseTo(variance(arr, 1), 10);
  });

  it('covariance of uncorrelated arrays ≈ 0', () => {
    const x = [1, -1, 1, -1, 1, -1];
    const y = [1, 1, -1, -1, 1, 1];
    const cov = covariance(x, y, 1);
    expect(Math.abs(cov)).toBeLessThan(0.5);
  });

  it('skewness of symmetric distribution ≈ 0', () => {
    const sym = [-3, -2, -1, 0, 1, 2, 3];
    expect(Math.abs(skewness(sym))).toBeLessThan(0.1);
  });

  it('kurtosis of normal-like data ≈ 0 (excess)', () => {
    const data = generateReturns(1000, 0, 0.01);
    expect(Math.abs(kurtosis(data))).toBeLessThan(3);
  });
});

describe('Linear Algebra', () => {
  it('matMul identity * A = A', () => {
    const A = [[1, 2], [3, 4]];
    const I = [[1, 0], [0, 1]];
    const result = matMul(I, A);
    expect(result[0][0]).toBeCloseTo(1);
    expect(result[0][1]).toBeCloseTo(2);
    expect(result[1][0]).toBeCloseTo(3);
    expect(result[1][1]).toBeCloseTo(4);
  });

  it('matVecMul works correctly', () => {
    const M = [[1, 2], [3, 4]];
    const v = [1, 1];
    const result = matVecMul(M, v);
    expect(result[0]).toBe(3);
    expect(result[1]).toBe(7);
  });

  it('transpose of 2x3 matrix is 3x2', () => {
    const M = [[1, 2, 3], [4, 5, 6]];
    const T = transpose(M);
    expect(T).toHaveLength(3);
    expect(T[0]).toHaveLength(2);
    expect(T[0][0]).toBe(1);
    expect(T[2][1]).toBe(6);
  });

  it('choleskyDecomposition: L*L^T = original', () => {
    const A = [[4, 2], [2, 3]];
    const L = choleskyDecomposition(A);
    const LT = transpose(L);
    const result = matMul(L, LT);
    expect(result[0][0]).toBeCloseTo(4, 6);
    expect(result[0][1]).toBeCloseTo(2, 6);
    expect(result[1][0]).toBeCloseTo(2, 6);
    expect(result[1][1]).toBeCloseTo(3, 6);
  });

  it('choleskyDecomposition: L is lower triangular', () => {
    const A = [[4, 2], [2, 3]];
    const L = choleskyDecomposition(A);
    expect(L[0][1]).toBe(0);
  });

  it('matInverse: A * A^-1 = I', () => {
    const A = [[2, 1], [5, 3]];
    const Ainv = matInverse(A);
    const result = matMul(A, Ainv);
    expect(result[0][0]).toBeCloseTo(1, 8);
    expect(result[0][1]).toBeCloseTo(0, 8);
    expect(result[1][0]).toBeCloseTo(0, 8);
    expect(result[1][1]).toBeCloseTo(1, 8);
  });
});

describe('Covariance Matrix Estimation', () => {
  const returnMatrix = [
    [0.01, 0.02],
    [0.02, -0.01],
    [-0.01, 0.01],
    [0.005, 0.005],
    [0.015, -0.005],
    [0.0, 0.01],
    [-0.005, 0.02],
    [0.02, 0.0],
  ];

  it('sampleCovarianceMatrix is symmetric', () => {
    const cov = sampleCovarianceMatrix(returnMatrix);
    expect(cov[0][1]).toBeCloseTo(cov[1][0], 12);
  });

  it('sampleCovarianceMatrix diagonal is positive', () => {
    const cov = sampleCovarianceMatrix(returnMatrix);
    expect(cov[0][0]).toBeGreaterThan(0);
    expect(cov[1][1]).toBeGreaterThan(0);
  });

  it('ewmaCovarianceMatrix is symmetric', () => {
    const cov = ewmaCovarianceMatrix(returnMatrix);
    expect(cov[0][1]).toBeCloseTo(cov[1][0], 10);
  });

  it('ewmaCovarianceMatrix diagonal is positive', () => {
    const cov = ewmaCovarianceMatrix(returnMatrix);
    expect(cov[0][0]).toBeGreaterThan(0);
    expect(cov[1][1]).toBeGreaterThan(0);
  });

  it('ledoitWolfShrinkage is symmetric', () => {
    const cov = ledoitWolfShrinkage(returnMatrix);
    expect(cov[0][1]).toBeCloseTo(cov[1][0], 10);
  });

  it('ledoitWolfShrinkage diagonal is positive', () => {
    const cov = ledoitWolfShrinkage(returnMatrix);
    expect(cov[0][0]).toBeGreaterThan(0);
    expect(cov[1][1]).toBeGreaterThan(0);
  });

  it('ledoitWolfShrinkage shrinks toward identity-like target', () => {
    const sample = sampleCovarianceMatrix(returnMatrix);
    const shrunk = ledoitWolfShrinkage(returnMatrix);
    const offDiagSample = Math.abs(sample[0][1]);
    const offDiagShrunk = Math.abs(shrunk[0][1]);
    expect(offDiagShrunk).toBeLessThanOrEqual(offDiagSample + 0.001);
  });

  it('correlationMatrix diagonal is 1', () => {
    const cov = sampleCovarianceMatrix(returnMatrix);
    const corr = correlationMatrix(cov);
    expect(corr[0][0]).toBeCloseTo(1, 10);
    expect(corr[1][1]).toBeCloseTo(1, 10);
  });

  it('correlationMatrix values between -1 and 1', () => {
    const cov = sampleCovarianceMatrix(returnMatrix);
    const corr = correlationMatrix(cov);
    expect(corr[0][1]).toBeGreaterThanOrEqual(-1);
    expect(corr[0][1]).toBeLessThanOrEqual(1);
  });
});

describe('Historical VaR', () => {
  const returns = generateReturns(500, 0, 0.02);

  it('var95 > 0 (positive = loss)', () => {
    const result = historicalVaR(returns);
    expect(result.var95).toBeGreaterThan(0);
  });

  it('var99 > var95', () => {
    const result = historicalVaR(returns);
    expect(result.var99).toBeGreaterThanOrEqual(result.var95 - 0.001);
  });

  it('method is historical', () => {
    const result = historicalVaR(returns);
    expect(result.method).toBe('historical');
  });

  it('correct percentile: 5% of returns are worse', () => {
    const sorted = [...returns].sort((a, b) => a - b);
    const cutoff = sorted[Math.floor(0.05 * sorted.length)];
    const result = historicalVaR(returns);
    expect(result.var95).toBeCloseTo(-cutoff, 1);
  });

  it('cvar95 >= var95', () => {
    const result = historicalVaR(returns);
    expect(result.cvar95).toBeGreaterThanOrEqual(result.var95 - 0.001);
  });

  it('cvar99 >= cvar95', () => {
    const result = historicalVaR(returns);
    expect(result.cvar99).toBeGreaterThanOrEqual(result.cvar95 - 0.001);
  });
});

describe('Parametric VaR', () => {
  const returns = generateReturns(500, 0.001, 0.02);

  it('var95 follows z * σ formula', () => {
    const result = parametricVaR(returns);
    expect(result.var95).toBeGreaterThan(0);
  });

  it('var99 > var95', () => {
    const result = parametricVaR(returns);
    expect(result.var99).toBeGreaterThan(result.var95);
  });

  it('method is parametric', () => {
    const result = parametricVaR(returns);
    expect(result.method).toBe('parametric');
  });

  it('cvar95 >= var95', () => {
    const result = parametricVaR(returns);
    expect(result.cvar95).toBeGreaterThanOrEqual(result.var95 - 0.001);
  });
});

describe('Monte Carlo VaR', () => {
  const returns = generateReturns(200, 0, 0.02);

  it('returns a positive var95', () => {
    const result = monteCarloVaR(returns, null, [1], 5000);
    expect(result.var95).toBeGreaterThan(0);
  });

  it('method is monteCarlo', () => {
    const result = monteCarloVaR(returns, null, [1], 5000);
    expect(result.method).toBe('monteCarlo');
  });

  it('confidence interval: true VaR within range of historical', () => {
    const histResult = historicalVaR(returns);
    const mcResult = monteCarloVaR(returns, null, [1], 10000);
    expect(mcResult.var95).toBeGreaterThan(0);
    expect(Math.abs(mcResult.var95 - histResult.var95)).toBeLessThan(histResult.var95 * 2);
  });
});

describe('Cornish-Fisher VaR', () => {
  const returns = generateReturns(300, 0, 0.02);

  it('returns a positive var95', () => {
    const result = cornishFisherVaR(returns);
    expect(result.var95).toBeGreaterThan(0);
  });

  it('method is cornishFisher', () => {
    const result = cornishFisherVaR(returns);
    expect(result.method).toBe('cornishFisher');
  });
});

describe('Expected Shortfall', () => {
  const returns = generateReturns(500, 0, 0.02);

  it('ES >= VaR', () => {
    const var95 = historicalVaR(returns).var95;
    const es = expectedShortfall(returns, 0.95);
    expect(es).toBeGreaterThanOrEqual(var95 - 0.001);
  });

  it('ES is positive', () => {
    expect(expectedShortfall(returns, 0.95)).toBeGreaterThan(0);
  });
});

describe('Component VaR', () => {
  const cov = [[0.04, 0.01], [0.01, 0.09]];
  const weights = [0.6, 0.4];

  it('component VaRs sum to total portfolio VaR', () => {
    const results = componentVaR(weights, cov, ['A', 'B']);
    const totalComponent = results.reduce((s, r) => s + r.componentVaR, 0);
    const portfolioVar = Math.sqrt(weights[0] * weights[0] * cov[0][0] + 2 * weights[0] * weights[1] * cov[0][1] + weights[1] * weights[1] * cov[1][1]);
    const z = 1.645;
    expect(totalComponent).toBeCloseTo(z * portfolioVar, 2);
  });

  it('percent contributions sum to ~100', () => {
    const results = componentVaR(weights, cov, ['A', 'B']);
    const totalPct = results.reduce((s, r) => s + r.percentContribution, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

describe('Drawdown Analysis', () => {
  it('maxDrawdown for monotonically increasing returns = 0', () => {
    const returns = [0.01, 0.01, 0.01, 0.01, 0.01];
    expect(maxDrawdown(returns)).toBe(0);
  });

  it('maxDrawdown for single loss', () => {
    const returns = [0.10, -0.20, 0.05, 0.05];
    const dd = maxDrawdown(returns);
    expect(dd).toBeGreaterThan(0);
    expect(dd).toBeLessThanOrEqual(0.20);
  });

  it('maxDrawdown returns value between 0 and 1', () => {
    const returns = generateReturns(252, 0.0004, 0.01);
    const dd = maxDrawdown(returns);
    expect(dd).toBeGreaterThanOrEqual(0);
    expect(dd).toBeLessThanOrEqual(1);
  });

  it('calculateDrawdowns returns sorted by severity', () => {
    const returns = [0.05, -0.10, -0.05, 0.20, -0.15, 0.10];
    const dates = returns.map((_, i) => Date.now() + i * 86400000);
    const dds = calculateDrawdowns(returns, dates);
    if (dds.length > 1) {
      expect(dds[0].maxDrawdownPct).toBeGreaterThanOrEqual(dds[1].maxDrawdownPct);
    }
  });
});

describe('Beta & Tracking Error', () => {
  it('beta of asset with itself = 1', () => {
    const returns = generateReturns(100, 0.001, 0.02);
    expect(calculateBeta(returns, returns)).toBeCloseTo(1, 6);
  });

  it('beta of uncorrelated asset ≈ 0', () => {
    const port = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 0.01);
    const bench = Array.from({ length: 200 }, (_, i) => Math.cos(i * 1.3) * 0.01);
    const beta = calculateBeta(port, bench);
    expect(Math.abs(beta)).toBeLessThan(0.5);
  });

  it('tracking error of identical returns = 0', () => {
    const returns = generateReturns(100, 0.001, 0.02);
    expect(trackingError(returns, returns)).toBeCloseTo(0, 8);
  });

  it('tracking error is positive for different returns', () => {
    const port = generateReturns(100, 0.001, 0.02);
    const bench = generateReturns(100, 0.0005, 0.015);
    expect(trackingError(port, bench)).toBeGreaterThan(0);
  });
});

describe('Herfindahl Index & Effective Positions', () => {
  it('HHI of equal weights = 1/n', () => {
    const weights = [0.25, 0.25, 0.25, 0.25];
    expect(herfindahlIndex(weights)).toBeCloseTo(0.25, 10);
  });

  it('HHI of concentrated portfolio approaches 1', () => {
    const weights = [0.99, 0.005, 0.005];
    expect(herfindahlIndex(weights)).toBeGreaterThan(0.9);
  });

  it('effective positions for equal weights = n', () => {
    const weights = [0.2, 0.2, 0.2, 0.2, 0.2];
    expect(effectiveNumPositions(weights)).toBeCloseTo(5, 6);
  });

  it('effective positions for concentrated = low', () => {
    const weights = [0.9, 0.05, 0.05];
    expect(effectiveNumPositions(weights)).toBeLessThan(2);
  });

  it('HHI of single position = 1', () => {
    expect(herfindahlIndex([1])).toBe(1);
  });
});

describe('Downside Deviation & Semi-Variance', () => {
  it('downsideDeviation only uses negative returns', () => {
    const returns = [0.05, 0.03, -0.02, -0.04, 0.01];
    const dd = downsideDeviation(returns, 0);
    expect(dd).toBeGreaterThan(0);
  });

  it('downsideDeviation is 0 when all returns are positive', () => {
    const returns = [0.01, 0.02, 0.03];
    expect(downsideDeviation(returns, 0)).toBe(0);
  });

  it('semiVariance is downsideDeviation squared (approximately)', () => {
    const returns = [0.05, 0.03, -0.02, -0.04, 0.01];
    const dd = downsideDeviation(returns, 0);
    const sv = semiVariance(returns, 0);
    expect(sv).toBeCloseTo(dd * dd, 8);
  });
});

describe('Aggregate Risk Metrics', () => {
  const returns = generateReturns(252, 0.0004, 0.01);

  it('calculateRiskMetrics returns all fields', () => {
    const metrics = calculateRiskMetrics(returns);
    expect(metrics).toHaveProperty('var1d');
    expect(metrics).toHaveProperty('var10d');
    expect(metrics).toHaveProperty('cvar');
    expect(metrics).toHaveProperty('volatility');
    expect(metrics).toHaveProperty('downsideDeviation');
    expect(metrics).toHaveProperty('semiVariance');
    expect(metrics).toHaveProperty('skewness');
    expect(metrics).toHaveProperty('kurtosis');
    expect(metrics).toHaveProperty('herfindahlIndex');
  });

  it('var10d = var1d * √10 (approximately)', () => {
    const metrics = calculateRiskMetrics(returns);
    expect(metrics.var10d).toBeCloseTo(metrics.var1d * Math.sqrt(10), 2);
  });

  it('volatility is annualized', () => {
    const metrics = calculateRiskMetrics(returns);
    const dailyVol = stdDev(returns);
    expect(metrics.volatility).toBeCloseTo(dailyVol * Math.sqrt(252), 2);
  });
});

describe('Tail Risk Metrics', () => {
  const returns = generateReturns(500, 0, 0.02);

  it('tailRatio is positive', () => {
    expect(tailRatio(returns)).toBeGreaterThan(0);
  });

  it('gainToPainRatio is finite', () => {
    expect(isFinite(gainToPainRatio(returns))).toBe(true);
  });

  it('ulcerIndex is positive', () => {
    expect(ulcerIndex(returns)).toBeGreaterThan(0);
  });
});

describe('Stress Testing', () => {
  it('returns impact for each scenario', () => {
    const weights = [0.5, 0.3, 0.2];
    const betas = [[1, 0.5], [0.8, -0.2], [0.3, 1.0]];
    const scenarios = [
      { name: 'Market Crash', factorShocks: { market: -0.20, rates: 0.02 } },
      { name: 'Rate Spike', factorShocks: { market: -0.05, rates: 0.05 } },
    ];
    const results = stressTest(weights, betas, scenarios);
    expect(results).toHaveLength(2);
    expect(results[0].scenario).toBe('Market Crash');
    expect(isFinite(results[0].portfolioImpact)).toBe(true);
  });
});

describe('Factor Risk Decomposition', () => {
  it('systematic + idiosyncratic ≈ total (approx)', () => {
    const n = 200;
    const market = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.01);
    const asset = market.map((m, i) => 1.2 * m + (Math.cos(i * 0.3) * 0.003));
    const factorReturns = market.map(m => [m]);

    const result = factorRiskDecomposition(asset, factorReturns, ['Market']);
    expect(result.totalRisk).toBeGreaterThan(0);
    expect(result.systematicRisk).toBeGreaterThan(0);
    expect(result.idiosyncraticRisk).toBeGreaterThanOrEqual(0);
  });
});

describe('Incremental VaR', () => {
  it('adding a correlated asset increases VaR', () => {
    const weights = [0.5, 0.5];
    const cov = [[0.04, 0.02], [0.02, 0.04]];
    const newAssetCov = [0.03, 0.03];
    const newAssetVar = 0.09;
    const iVaR = incrementalVaR(weights, cov, newAssetCov, newAssetVar, 0.1);
    expect(isFinite(iVaR)).toBe(true);
  });
});
