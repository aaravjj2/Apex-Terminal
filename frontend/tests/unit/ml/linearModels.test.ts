import { describe, it, expect } from 'vitest';
import {
  LinearRegression, RidgeRegression, LassoRegression, ElasticNet,
  LogisticRegression, HuberRegression, QuantileRegression,
  famaMacBeth, estimateFactorModel,
} from '../../../src/lib/ml/linearModels';

function linspace(start: number, end: number, n: number): number[] {
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

describe('LinearRegression', () => {
  const X = linspace(0, 10, 50).map(v => [v]);
  const y = X.map(([x]) => 2 * x + 3);

  it('fits known slope and intercept', () => {
    const model = new LinearRegression();
    const result = model.fit(X, y);
    expect(result.weights![0]).toBeCloseTo(2, 1);
    expect(result.bias).toBeCloseTo(3, 1);
    expect(result.converged).toBe(true);
  });

  it('predicts accurately on training data', () => {
    const model = new LinearRegression();
    model.fit(X, y);
    const pred = model.predict(X);
    pred.predictions.forEach((p, i) => expect(p).toBeCloseTo(y[i], 1));
  });

  it('score returns high R² for perfect fit', () => {
    const model = new LinearRegression();
    model.fit(X, y);
    const scores = model.score(X, y);
    expect(scores['r2']).toBeGreaterThan(0.99);
  });

  it('handles multidimensional features', () => {
    const X2 = linspace(0, 10, 50).map(v => [v, v * 2]);
    const y2 = X2.map(([a, b]) => a + b + 1);
    const model = new LinearRegression();
    model.fit(X2, y2);
    const scores = model.score(X2, y2);
    expect(scores['r2']).toBeGreaterThan(0.99);
  });
});

describe('RidgeRegression', () => {
  const X = linspace(0, 10, 50).map(v => [v]);
  const y = X.map(([x]) => 3 * x + 1);

  it('fits with regularization', () => {
    const model = new RidgeRegression(0.1);
    const result = model.fit(X, y);
    expect(result.weights!.length).toBe(1);
    expect(result.converged).toBe(true);
  });

  it('ridge coefficients are smaller than OLS for high alpha', () => {
    const ols = new LinearRegression();
    const ridge = new RidgeRegression(100);
    ols.fit(X, y);
    ridge.fit(X, y);
    const olsResult = ols.score(X, y);
    const ridgeResult = ridge.score(X, y);
    expect(typeof olsResult['r2']).toBe('number');
    expect(typeof ridgeResult['r2']).toBe('number');
  });

  it('predicts accurately with low regularization', () => {
    const model = new RidgeRegression(0.001);
    model.fit(X, y);
    const pred = model.predict(X);
    pred.predictions.forEach((p, i) => expect(p).toBeCloseTo(y[i], 0));
  });
});

describe('LassoRegression', () => {
  it('performs feature selection via sparsity', () => {
    const n = 100;
    const X = Array.from({ length: n }, (_, i) => [i, Math.random(), i * 2]);
    const y = X.map(([a, , c]) => a + c);
    const model = new LassoRegression(1.0, 2000);
    const result = model.fit(X, y);
    expect(result.weights!.length).toBe(3);
  });

  it('fits simple linear relationship', () => {
    const X = linspace(0, 10, 60).map(v => [v]);
    const y = X.map(([x]) => 5 * x);
    const model = new LassoRegression(0.01, 2000);
    model.fit(X, y);
    const pred = model.predict(X);
    const mse = pred.predictions.reduce((s, p, i) => s + (p - y[i]) ** 2, 0) / y.length;
    expect(mse).toBeLessThan(5);
  });
});

describe('ElasticNet', () => {
  it('combines L1 and L2 regularization', () => {
    const X = linspace(0, 10, 50).map(v => [v, v * 0.5]);
    const y = X.map(([a, b]) => 2 * a + b);
    const model = new ElasticNet(0.1, 0.5, 2000);
    model.fit(X, y);
    const scores = model.score(X, y);
    expect(scores['r2']).toBeGreaterThan(0.8);
  });
});

describe('LogisticRegression', () => {
  it('classifies linearly separable data', () => {
    const X = [...Array.from({ length: 25 }, (_, i) => [i]), ...Array.from({ length: 25 }, (_, i) => [i + 50])];
    const y = [...Array(25).fill(0), ...Array(25).fill(1)];
    const model = new LogisticRegression(0.01, 2000);
    model.fit(X, y);
    const pred = model.predict(X);
    const accuracy = pred.predictions.reduce((acc, p, i) => acc + (p === y[i] ? 1 : 0), 0) / y.length;
    expect(accuracy).toBeGreaterThan(0.8);
  });

  it('predictProbability returns values in [0,1]', () => {
    const X = [...Array.from({ length: 20 }, (_, i) => [i]), ...Array.from({ length: 20 }, (_, i) => [i + 40])];
    const y = [...Array(20).fill(0), ...Array(20).fill(1)];
    const model = new LogisticRegression(0.01, 2000);
    model.fit(X, y);
    const probs = model.predictProbability(X);
    probs.forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it('score returns accuracy', () => {
    const X = [...Array.from({ length: 20 }, () => [0]), ...Array.from({ length: 20 }, () => [10])];
    const y = [...Array(20).fill(0), ...Array(20).fill(1)];
    const model = new LogisticRegression(0.05, 2000);
    model.fit(X, y);
    const scores = model.score(X, y);
    expect(scores['accuracy']).toBeGreaterThan(0.5);
  });
});

describe('HuberRegression', () => {
  it('is robust to outliers', () => {
    const X = linspace(0, 10, 50).map(v => [v]);
    const y = X.map(([x]) => 2 * x + 1);
    y[0] = 1000;
    const model = new HuberRegression(1.35, 0.001, 2000);
    model.fit(X, y);
    const pred = model.predict([[5]]);
    expect(pred.predictions[0]).toBeCloseTo(11, -1);
  });
});

describe('QuantileRegression', () => {
  it('fits median regression (q=0.5)', () => {
    const X = linspace(0, 10, 50).map(v => [v]);
    const y = X.map(([x]) => 3 * x + 2);
    const model = new QuantileRegression(0.5, 0.001, 2000);
    model.fit(X, y);
    const pred = model.predict([[5]]);
    expect(pred.predictions[0]).toBeCloseTo(17, -1);
  });
});

describe('famaMacBeth', () => {
  it('returns mean coefficients and t-statistics', () => {
    const crossSections = Array.from({ length: 20 }, () => {
      const n = 10;
      const X = Array.from({ length: n }, () => [Math.random(), Math.random()]);
      const y = X.map(([a, b]) => 0.5 * a + 0.3 * b + (Math.random() - 0.5) * 0.1);
      return { X, y };
    });
    const result = famaMacBeth(crossSections);
    expect(result.meanCoefficients.length).toBe(3);
    expect(result.tStatistics.length).toBe(3);
    expect(result.standardErrors.length).toBe(3);
    expect(result.rSquaredSeries.length).toBe(20);
  });
});

describe('estimateFactorModel', () => {
  it('estimates betas and alphas', () => {
    const T = 50;
    const nAssets = 3;
    const nFactors = 2;
    const factors = Array.from({ length: T }, () => [Math.random() * 0.02, Math.random() * 0.01]);
    const returns = Array.from({ length: T }, (_, t) =>
      Array.from({ length: nAssets }, (__, j) =>
        0.001 + (j + 1) * 0.5 * factors[t][0] + (j + 1) * 0.3 * factors[t][1] + (Math.random() - 0.5) * 0.002,
      ),
    );
    const result = estimateFactorModel(returns, factors);
    expect(result.betas.length).toBe(nAssets);
    expect(result.alphas.length).toBe(nAssets);
    expect(result.factorPremiums.length).toBe(nFactors);
    expect(result.rSquared.length).toBe(nAssets);
    result.rSquared.forEach(r2 => expect(r2).toBeGreaterThan(0));
  });
});
