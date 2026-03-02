import { describe, it, expect } from 'vitest';
import {
  normalize, denormalize, imputeMissing,
  detectOutliersIQR, detectOutliersZScore, clipOutliers, winsorize,
  lagFeatures, returnFeatures, logReturnFeatures, rollingStatFeatures,
  calendarFeatures, crossSectionalRank, crossSectionalZScore,
  timeSeriesSplit, walkForwardSplit,
  pca, correlationMatrix, selectByCorrelation,
  mutualInformation, removeHighlyCorrelated,
} from '../../../src/lib/ml/preprocessing';
import { NormalizationMethod, ImputationMethod } from '../../../src/lib/ml/types';
import type { Feature } from '../../../src/lib/ml/types';

function makeFeature(name: string, values: number[]): Feature {
  return { name, values, type: 'continuous' };
}

describe('normalize', () => {
  it('min-max scales to [0,1]', () => {
    const f = makeFeature('x', [10, 20, 30, 40, 50]);
    const { normalized, params } = normalize([f], NormalizationMethod.MinMax);
    expect(Math.min(...normalized[0].values)).toBeCloseTo(0, 5);
    expect(Math.max(...normalized[0].values)).toBeCloseTo(1, 5);
    expect(params.method).toBe(NormalizationMethod.MinMax);
  });

  it('z-score produces mean ≈ 0 and std ≈ 1', () => {
    const vals = Array.from({ length: 200 }, (_, i) => i);
    const f = makeFeature('x', vals);
    const { normalized } = normalize([f], NormalizationMethod.ZScore);
    const m = normalized[0].values.reduce((a, b) => a + b, 0) / normalized[0].values.length;
    expect(m).toBeCloseTo(0, 2);
    const v = normalized[0].values.reduce((a, b) => a + b * b, 0) / normalized[0].values.length;
    expect(Math.sqrt(v)).toBeCloseTo(1, 1);
  });

  it('robust normalization handles outliers', () => {
    const vals = [1, 2, 3, 4, 5, 100];
    const { normalized } = normalize([makeFeature('x', vals)], NormalizationMethod.Robust);
    expect(normalized[0].values.length).toBe(6);
  });

  it('normalizes multiple features independently', () => {
    const f1 = makeFeature('a', [0, 10]);
    const f2 = makeFeature('b', [100, 200]);
    const { normalized } = normalize([f1, f2], NormalizationMethod.MinMax);
    expect(normalized.length).toBe(2);
    expect(normalized[0].values[0]).toBeCloseTo(0);
    expect(normalized[1].values[0]).toBeCloseTo(0);
  });
});

describe('denormalize', () => {
  it('reverses normalization', () => {
    const original = [10, 20, 30];
    const offset = 10;
    const scale = 20;
    const normed = original.map(v => (v - offset) / scale);
    const result = denormalize(normed, offset, scale);
    result.forEach((v, i) => expect(v).toBeCloseTo(original[i], 5));
  });
});

describe('imputeMissing', () => {
  it('mean imputation replaces NaN with mean', () => {
    const result = imputeMissing([1, 2, NaN, 4], ImputationMethod.Mean);
    expect(result[2]).toBeCloseTo(7 / 3, 5);
    expect(result.every(v => !isNaN(v))).toBe(true);
  });

  it('median imputation', () => {
    const result = imputeMissing([1, NaN, 3, 5, 7], ImputationMethod.Median);
    expect(result[1]).toBeCloseTo(4, 5);
  });

  it('forward-fill imputation', () => {
    const result = imputeMissing([10, NaN, NaN, 20], ImputationMethod.ForwardFill);
    expect(result[1]).toBe(10);
    expect(result[2]).toBe(10);
  });

  it('interpolation imputation', () => {
    const result = imputeMissing([0, NaN, 4], ImputationMethod.Interpolation);
    expect(result[1]).toBeCloseTo(2, 1);
  });
});

describe('outlier detection', () => {
  it('IQR detects extreme outliers', () => {
    const vals = [1, 2, 3, 4, 5, 100];
    const mask = detectOutliersIQR(vals, 1.5);
    expect(mask[5]).toBe(true);
    expect(mask[0]).toBe(false);
  });

  it('z-score detects outliers', () => {
    const vals = Array.from({ length: 100 }, () => 0);
    vals.push(100);
    const mask = detectOutliersZScore(vals, 3);
    expect(mask[100]).toBe(true);
    expect(mask[0]).toBe(false);
  });

  it('clipOutliers clamps values', () => {
    const result = clipOutliers([1, 5, 10, 50, 100], 2, 60);
    expect(result[0]).toBe(2);
    expect(result[4]).toBe(60);
    expect(result[2]).toBe(10);
  });

  it('winsorize caps extreme percentiles', () => {
    const vals = Array.from({ length: 100 }, (_, i) => i);
    const result = winsorize(vals, 0.05);
    expect(result.length).toBe(100);
    expect(Math.min(...result)).toBeGreaterThanOrEqual(vals[4]);
  });
});

describe('feature engineering', () => {
  it('lagFeatures creates lagged columns', () => {
    const result = lagFeatures([10, 20, 30, 40, 50], [1, 2]);
    expect(result.length).toBe(2);
    expect(result[0].name).toContain('lag_1');
    expect(result[1].name).toContain('lag_2');
  });

  it('returnFeatures computes period returns', () => {
    const result = returnFeatures([100, 110, 121]);
    expect(result.length).toBe(1);
    expect(result[0].values[1]).toBeCloseTo(0.1, 2);
  });

  it('logReturnFeatures computes log returns', () => {
    const result = logReturnFeatures([100, 110]);
    expect(result[0].values[1]).toBeCloseTo(Math.log(110 / 100), 5);
  });

  it('rollingStatFeatures computes rolling stats', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = rollingStatFeatures(vals, 3, ['mean', 'std']);
    expect(result.length).toBe(2);
    expect(result[0].name).toContain('mean');
    expect(result[1].name).toContain('std');
  });

  it('calendarFeatures extracts time components', () => {
    const timestamps = [Date.now(), Date.now() + 86_400_000];
    const result = calendarFeatures(timestamps);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

describe('cross-sectional transforms', () => {
  it('crossSectionalRank ranks rows', () => {
    const matrix = [[30, 10, 20], [100, 200, 300]];
    const ranked = crossSectionalRank(matrix);
    expect(ranked.length).toBe(2);
    expect(ranked[0].length).toBe(3);
  });

  it('crossSectionalZScore standardizes rows', () => {
    const matrix = [[10, 20, 30]];
    const zscored = crossSectionalZScore(matrix);
    const row = zscored[0];
    const m = row.reduce((a, b) => a + b, 0) / row.length;
    expect(m).toBeCloseTo(0, 5);
  });
});

describe('train/test splitting', () => {
  it('timeSeriesSplit produces correct sized splits', () => {
    const split = timeSeriesSplit(100, 0.7, 0.3);
    expect(split.trainIndices.length).toBe(70);
    expect(split.testIndices.length).toBe(30);
  });

  it('timeSeriesSplit with validation', () => {
    const split = timeSeriesSplit(100, 0.6, 0.2, 0.2);
    expect(split.trainIndices.length).toBe(60);
    expect(split.testIndices.length).toBe(20);
    expect(split.validationIndices!.length).toBe(20);
  });

  it('timeSeriesSplit with gap', () => {
    const split = timeSeriesSplit(100, 0.7, 0.3, 0, 5);
    expect(split.trainIndices.length + split.testIndices.length + 5).toBeLessThanOrEqual(100);
  });

  it('walkForwardSplit produces multiple windows', () => {
    const result = walkForwardSplit(100, 50, 10, 10);
    expect(result.splits.length).toBeGreaterThan(0);
    expect(result.windowSize).toBe(50);
    for (const s of result.splits) {
      expect(s.trainIndices.length).toBeGreaterThan(0);
      expect(s.testIndices.length).toBeGreaterThan(0);
    }
  });
});

describe('PCA', () => {
  it('reduces dimensionality', () => {
    const data = Array.from({ length: 50 }, () => [Math.random(), Math.random(), Math.random()]);
    const result = pca(data, 2);
    expect(result.nComponents).toBe(2);
    expect(result.transformedData[0].length).toBe(2);
    expect(result.explainedVarianceRatio.length).toBe(2);
  });

  it('cumulative variance sums to <= 1', () => {
    const data = Array.from({ length: 50 }, () => [Math.random(), Math.random()]);
    const result = pca(data);
    const total = result.cumulativeVariance[result.cumulativeVariance.length - 1];
    expect(total).toBeCloseTo(1, 1);
  });
});

describe('correlationMatrix', () => {
  it('produces symmetric matrix', () => {
    const features = [
      makeFeature('a', [1, 2, 3, 4, 5]),
      makeFeature('b', [2, 4, 6, 8, 10]),
    ];
    const corr = correlationMatrix(features);
    expect(corr.length).toBe(2);
    expect(corr[0][0]).toBeCloseTo(1, 5);
    expect(corr[0][1]).toBeCloseTo(corr[1][0], 5);
  });

  it('perfectly correlated features have r ≈ 1', () => {
    const features = [
      makeFeature('x', [1, 2, 3, 4, 5]),
      makeFeature('y', [2, 4, 6, 8, 10]),
    ];
    const corr = correlationMatrix(features);
    expect(corr[0][1]).toBeCloseTo(1, 5);
  });
});

describe('feature selection', () => {
  it('selectByCorrelation keeps correlated features', () => {
    const features = [
      makeFeature('x', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      makeFeature('noise', [5, 3, 7, 2, 8, 1, 9, 4, 6, 0]),
    ];
    const target = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const selected = selectByCorrelation(features, target, 0.5);
    expect(selected.some(f => f.name === 'x')).toBe(true);
  });

  it('removeHighlyCorrelated removes redundant features', () => {
    const features = [
      makeFeature('a', [1, 2, 3, 4, 5]),
      makeFeature('b', [1.01, 2.01, 3.01, 4.01, 5.01]),
      makeFeature('c', [5, 3, 1, 2, 4]),
    ];
    const kept = removeHighlyCorrelated(features, 0.95);
    expect(kept.length).toBeLessThan(3);
  });

  it('mutualInformation returns non-negative value', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const mi = mutualInformation(x, y);
    expect(mi).toBeGreaterThanOrEqual(0);
  });
});
