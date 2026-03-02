import { describe, it, expect } from 'vitest';
import {
  matrixCreate, matrixIdentity, matrixMultiply, matrixTranspose,
  matrixAdd, matrixScale, matrixDeterminant, matrixInverse,
  matrixCholesky, matrixEigenvaluesQR, matrixLU, matrixSVD,
  mean, median, mode, variance, stdDev, skewness, kurtosis,
  covariance, correlation, percentile, quantile, iqr, mad,
  weightedMean, exponentialMovingAverage, linearRegression,
  linearInterpolation, cubicSpline, lagrangeInterpolation, newtonInterpolation,
  newtonRaphson, bisection, secantMethod, brentMethod, gradientDescent,
  trapezoidalIntegration, simpsonsIntegration, gaussLegendreIntegration,
  boxMullerNormal, randomExponential, randomUniform,
  gammaFunction, logGamma, betaFunction, erf, erfc,
  normalPDF, normalCDF, normalQuantile,
  tDistributionCDF, chiSquaredCDF,
  MersenneTwister, SobolSequence,
} from '../../../src/lib/utils/math';

describe('matrix operations', () => {
  it('matrixCreate fills with value', () => {
    const m = matrixCreate(2, 3, 5);
    expect(m.length).toBe(2);
    expect(m[0].length).toBe(3);
    expect(m[1][2]).toBe(5);
  });

  it('matrixIdentity is correct', () => {
    const I = matrixIdentity(3);
    expect(I[0]).toEqual([1, 0, 0]);
    expect(I[1]).toEqual([0, 1, 0]);
    expect(I[2]).toEqual([0, 0, 1]);
  });

  it('matrixMultiply I * A = A', () => {
    const A = [[1, 2], [3, 4]];
    const I = matrixIdentity(2);
    const result = matrixMultiply(I, A);
    expect(result).toEqual(A);
  });

  it('matrixMultiply computes correctly', () => {
    const A = [[1, 2], [3, 4]];
    const B = [[5, 6], [7, 8]];
    const C = matrixMultiply(A, B);
    expect(C[0][0]).toBe(19);
    expect(C[0][1]).toBe(22);
    expect(C[1][0]).toBe(43);
    expect(C[1][1]).toBe(50);
  });

  it('matrixTranspose swaps rows and cols', () => {
    const result = matrixTranspose([[1, 2, 3], [4, 5, 6]]);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual([1, 4]);
  });

  it('matrixAdd sums element-wise', () => {
    const result = matrixAdd([[1, 2]], [[3, 4]]);
    expect(result[0]).toEqual([4, 6]);
  });

  it('matrixScale multiplies each element', () => {
    const result = matrixScale([[1, 2], [3, 4]], 2);
    expect(result[0]).toEqual([2, 4]);
    expect(result[1]).toEqual([6, 8]);
  });

  it('matrixDeterminant 2x2', () => {
    expect(matrixDeterminant([[3, 8], [4, 6]])).toBeCloseTo(-14, 5);
  });

  it('matrixDeterminant 3x3', () => {
    const m = [[6, 1, 1], [4, -2, 5], [2, 8, 7]];
    expect(matrixDeterminant(m)).toBeCloseTo(-306, 3);
  });

  it('matrixLU decomposes correctly', () => {
    const A = [[2, 1], [4, 3]];
    const { L, U, P } = matrixLU(A);
    const reconstructed = matrixMultiply(L, U);
    const PA = P.map(i => A[i]);
    expect(reconstructed[0][0]).toBeCloseTo(PA[0][0], 5);
    expect(reconstructed[0][1]).toBeCloseTo(PA[0][1], 5);
    expect(reconstructed[1][0]).toBeCloseTo(PA[1][0], 5);
    expect(reconstructed[1][1]).toBeCloseTo(PA[1][1], 5);
  });

  it('matrixInverse A * A^-1 = I', () => {
    const A = [[4, 7], [2, 6]];
    const Ainv = matrixInverse(A);
    const product = matrixMultiply(A, Ainv);
    expect(product[0][0]).toBeCloseTo(1, 5);
    expect(product[0][1]).toBeCloseTo(0, 5);
    expect(product[1][0]).toBeCloseTo(0, 5);
    expect(product[1][1]).toBeCloseTo(1, 5);
  });

  it('matrixCholesky L * L^T = A for SPD matrix', () => {
    const A = [[4, 2], [2, 3]];
    const L = matrixCholesky(A);
    const LT = matrixTranspose(L);
    const product = matrixMultiply(L, LT);
    expect(product[0][0]).toBeCloseTo(4, 5);
    expect(product[0][1]).toBeCloseTo(2, 5);
    expect(product[1][1]).toBeCloseTo(3, 5);
  });

  it('matrixEigenvaluesQR finds eigenvalues of diagonal matrix', () => {
    const D = [[3, 0], [0, 7]];
    const eigs = matrixEigenvaluesQR(D);
    const sorted = [...eigs].sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(3, 1);
    expect(sorted[1]).toBeCloseTo(7, 1);
  });

  it('matrixSVD decomposes matrix', () => {
    const A = [[1, 2], [3, 4], [5, 6]];
    const { U, S, V } = matrixSVD(A);
    expect(S.length).toBe(2);
    expect(U.length).toBe(3);
    expect(V.length).toBe(2);
    S.forEach(s => expect(s).toBeGreaterThanOrEqual(0));
  });
});

describe('statistics', () => {
  it('mean', () => expect(mean([1, 2, 3, 4, 5])).toBeCloseTo(3));
  it('median odd', () => expect(median([3, 1, 2])).toBeCloseTo(2));
  it('median even', () => expect(median([1, 2, 3, 4])).toBeCloseTo(2.5));
  it('mode', () => expect(mode([1, 2, 2, 3])).toContain(2));
  it('variance sample', () => expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4.571, 2));
  it('variance population', () => expect(variance([2, 4, 4, 4, 5, 5, 7, 9], true)).toBeCloseTo(4, 2));
  it('stdDev', () => expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(4.571), 1));
  it('skewness symmetric ≈ 0', () => {
    const data = [-2, -1, 0, 1, 2];
    expect(Math.abs(skewness(data))).toBeLessThan(0.5);
  });
  it('kurtosis normal ≈ 0 (excess)', () => {
    const data = Array.from({ length: 10000 }, () => {
      const u1 = Math.random(), u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    });
    expect(kurtosis(data)).toBeCloseTo(0, 0);
  });
  it('covariance of identical series', () => {
    const x = [1, 2, 3, 4, 5];
    expect(covariance(x, x)).toBeCloseTo(variance(x), 5);
  });
  it('correlation of perfectly correlated', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
  });
  it('correlation of uncorrelated ≈ 0', () => {
    const n = 10000;
    const x = Array.from({ length: n }, () => Math.random());
    const y = Array.from({ length: n }, () => Math.random());
    expect(Math.abs(correlation(x, y))).toBeLessThan(0.1);
  });
  it('percentile', () => expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBeCloseTo(5.5, 0));
  it('quantile', () => expect(quantile([1, 2, 3, 4, 5], 0.25)).toBeCloseTo(2, 0));
  it('iqr', () => expect(iqr([1, 2, 3, 4, 5, 6, 7])).toBeGreaterThan(0));
  it('mad', () => expect(mad([1, 1, 2, 2, 4, 6, 9])).toBeGreaterThan(0));
  it('weightedMean', () => expect(weightedMean([1, 2, 3], [1, 1, 1])).toBeCloseTo(2));
  it('weightedMean with unequal weights', () => expect(weightedMean([0, 10], [1, 3])).toBeCloseTo(7.5));
});

describe('EMA', () => {
  it('exponentialMovingAverage returns correct length', () => {
    const result = exponentialMovingAverage([1, 2, 3, 4, 5], 3);
    expect(result.length).toBe(5);
  });
});

describe('linearRegression', () => {
  it('fits known line', () => {
    const x = [1, 2, 3, 4, 5];
    const y = x.map(v => 2 * v + 1);
    const { slope, intercept, r2 } = linearRegression(x, y);
    expect(slope).toBeCloseTo(2, 5);
    expect(intercept).toBeCloseTo(1, 5);
    expect(r2).toBeCloseTo(1, 5);
  });
});

describe('interpolation', () => {
  it('linearInterpolation midpoint', () => {
    expect(linearInterpolation(0, 0, 10, 100, 5)).toBeCloseTo(50);
  });

  it('cubicSpline interpolates between points', () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 4, 9];
    const spline = cubicSpline(xs, ys);
    expect(spline(0)).toBeCloseTo(0, 1);
    expect(spline(1)).toBeCloseTo(1, 1);
    expect(spline(1.5)).toBeGreaterThan(1);
    expect(spline(1.5)).toBeLessThan(4);
  });

  it('lagrangeInterpolation exact at nodes', () => {
    const xs = [0, 1, 2];
    const ys = [1, 3, 5];
    expect(lagrangeInterpolation(xs, ys, 0)).toBeCloseTo(1, 5);
    expect(lagrangeInterpolation(xs, ys, 1)).toBeCloseTo(3, 5);
  });

  it('newtonInterpolation exact at nodes', () => {
    expect(newtonInterpolation([0, 1, 2], [0, 1, 4], 2)).toBeCloseTo(4, 3);
  });
});

describe('root finding', () => {
  const f = (x: number) => x * x - 4;
  const df = (x: number) => 2 * x;

  it('newtonRaphson finds root of x²-4', () => {
    const root = newtonRaphson(f, df, 3);
    expect(root).toBeCloseTo(2, 5);
  });

  it('bisection finds root in [0, 3]', () => {
    const root = bisection(f, 0, 3);
    expect(root).toBeCloseTo(2, 5);
  });

  it('secantMethod finds root', () => {
    const root = secantMethod(f, 1, 3);
    expect(root).toBeCloseTo(2, 3);
  });

  it('brentMethod finds root', () => {
    const root = brentMethod(f, 0, 3);
    expect(root).toBeCloseTo(2, 5);
  });
});

describe('gradientDescent', () => {
  it('minimizes quadratic f(x) = (x-3)²', () => {
    const gradient = (x: number[]) => [2 * (x[0] - 3)];
    const result = gradientDescent(gradient, [0], 0.1);
    expect(result[0]).toBeCloseTo(3, 1);
  });
});

describe('numerical integration', () => {
  const f = (x: number) => x * x;

  it('trapezoidal ∫₀¹ x² dx ≈ 1/3', () => {
    expect(trapezoidalIntegration(f, 0, 1)).toBeCloseTo(1 / 3, 3);
  });

  it('simpsons ∫₀¹ x² dx ≈ 1/3', () => {
    expect(simpsonsIntegration(f, 0, 1)).toBeCloseTo(1 / 3, 5);
  });

  it('gaussLegendre ∫₀¹ x² dx ≈ 1/3', () => {
    expect(gaussLegendreIntegration(f, 0, 1)).toBeCloseTo(1 / 3, 3);
  });
});

describe('random number generation', () => {
  it('boxMullerNormal produces two standard normals', () => {
    const { z0, z1 } = boxMullerNormal();
    expect(typeof z0).toBe('number');
    expect(typeof z1).toBe('number');
    expect(isFinite(z0)).toBe(true);
    expect(isFinite(z1)).toBe(true);
  });

  it('randomExponential is positive', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomExponential(1)).toBeGreaterThan(0);
    }
  });

  it('randomUniform in range', () => {
    for (let i = 0; i < 20; i++) {
      const v = randomUniform(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('MersenneTwister is deterministic', () => {
    const mt1 = new MersenneTwister(42);
    const mt2 = new MersenneTwister(42);
    for (let i = 0; i < 10; i++) {
      expect(mt1.next()).toBe(mt2.next());
    }
  });

  it('MersenneTwister nextInt in range', () => {
    const mt = new MersenneTwister(99);
    for (let i = 0; i < 50; i++) {
      const v = mt.nextInt(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('SobolSequence produces d-dimensional points', () => {
    const sobol = new SobolSequence(3);
    const p = sobol.next();
    expect(p.length).toBe(3);
    p.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

describe('special functions', () => {
  it('gammaFunction(5) = 24', () => expect(gammaFunction(5)).toBeCloseTo(24, 1));
  it('gammaFunction(0.5) = √π', () => expect(gammaFunction(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 2));
  it('logGamma(5) = ln(24)', () => expect(logGamma(5)).toBeCloseTo(Math.log(24), 2));
  it('betaFunction(2, 3) = 1/12', () => expect(betaFunction(2, 3)).toBeCloseTo(1 / 12, 3));
  it('erf(0) = 0', () => expect(erf(0)).toBeCloseTo(0, 6));
  it('erf(∞) ≈ 1', () => expect(erf(5)).toBeCloseTo(1, 5));
  it('erfc(0) = 1', () => expect(erfc(0)).toBeCloseTo(1, 6));
  it('erf + erfc = 1', () => expect(erf(1.5) + erfc(1.5)).toBeCloseTo(1, 6));
});

describe('distributions', () => {
  it('normalPDF at mean is max', () => {
    expect(normalPDF(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 5);
  });

  it('normalCDF(0) = 0.5', () => expect(normalCDF(0)).toBeCloseTo(0.5, 5));
  it('normalCDF(-∞) ≈ 0', () => expect(normalCDF(-6)).toBeLessThan(0.001));
  it('normalCDF(+∞) ≈ 1', () => expect(normalCDF(6)).toBeGreaterThan(0.999));

  it('normalQuantile(0.5) = 0', () => expect(normalQuantile(0.5)).toBeCloseTo(0, 3));
  it('normalQuantile(0.975) ≈ 1.96', () => expect(normalQuantile(0.975)).toBeCloseTo(1.96, 1));
  it('normalCDF(normalQuantile(p)) = p', () => {
    [0.1, 0.25, 0.5, 0.75, 0.9].forEach(p => {
      expect(normalCDF(normalQuantile(p))).toBeCloseTo(p, 2);
    });
  });

  it('tDistributionCDF(0, df) = 0.5', () => expect(tDistributionCDF(0, 10)).toBeCloseTo(0.5, 2));
  it('chiSquaredCDF grows with x', () => {
    const c1 = chiSquaredCDF(1, 2);
    const c2 = chiSquaredCDF(5, 2);
    expect(c2).toBeGreaterThan(c1);
  });
});
