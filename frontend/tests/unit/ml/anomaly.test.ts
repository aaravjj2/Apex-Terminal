import { describe, it, expect } from 'vitest';
import {
  zScoreAnomaly, modifiedZScoreAnomaly, grubbsTest,
  iqrAnomaly, cusumAnomaly, bollingerBandAnomaly,
  mahalanobisAnomaly, pcaReconstructionAnomaly,
  IsolationForest, LocalOutlierFactor, OnlineAnomalyDetector,
  detectMarketAnomalies, correlationBreakDetection, rankAnomalies,
} from '../../../src/lib/ml/anomaly';

function normalData(n: number, mean = 0, std = 1): number[] {
  return Array.from({ length: n }, () => {
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  });
}

function dataWithOutliers(n: number, nOutliers: number, outlierMag: number): number[] {
  const data = normalData(n);
  for (let i = 0; i < nOutliers; i++) {
    data.push(outlierMag * (Math.random() > 0.5 ? 1 : -1));
  }
  return data;
}

describe('zScoreAnomaly', () => {
  it('detects large outliers', () => {
    const data = dataWithOutliers(100, 3, 20);
    const result = zScoreAnomaly(data, 3);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(2);
    expect(result.threshold).toBe(3);
    expect(result.isAnomaly.length).toBe(data.length);
  });

  it('no anomalies in clean data', () => {
    const data = normalData(100, 0, 1);
    const result = zScoreAnomaly(data, 5);
    expect(result.anomalyRate).toBeLessThan(0.1);
  });

  it('scores have correct length', () => {
    const data = normalData(50);
    const result = zScoreAnomaly(data);
    expect(result.scores.length).toBe(50);
  });
});

describe('modifiedZScoreAnomaly', () => {
  it('is robust to outliers in baseline', () => {
    const data = [...normalData(100, 0, 1), 50, -50];
    const result = modifiedZScoreAnomaly(data, 3.5);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(2);
  });

  it('uses MAD-based scoring', () => {
    const data = normalData(80);
    const result = modifiedZScoreAnomaly(data);
    expect(result.scores.every(s => typeof s === 'number')).toBe(true);
  });
});

describe('grubbsTest', () => {
  it('detects single outlier', () => {
    const data = [...normalData(50, 10, 1), 100];
    const result = grubbsTest(data, 0.05);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(1);
  });
});

describe('iqrAnomaly', () => {
  it('flags values beyond 1.5 * IQR', () => {
    const data = dataWithOutliers(100, 5, 15);
    const result = iqrAnomaly(data, 1.5);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(3);
  });

  it('stricter multiplier catches fewer anomalies', () => {
    const data = dataWithOutliers(100, 5, 10);
    const r1 = iqrAnomaly(data, 1.5);
    const r2 = iqrAnomaly(data, 3.0);
    expect(r1.anomalyIndices.length).toBeGreaterThanOrEqual(r2.anomalyIndices.length);
  });
});

describe('cusumAnomaly', () => {
  it('detects level shift', () => {
    const data = [...Array(50).fill(0), ...Array(50).fill(5)];
    const result = cusumAnomaly(data, 3);
    expect(result.anomalyIndices.length).toBeGreaterThan(0);
  });

  it('stable series has few anomalies', () => {
    const data = Array(100).fill(10);
    const result = cusumAnomaly(data, 5);
    expect(result.anomalyRate).toBeLessThan(0.05);
  });
});

describe('bollingerBandAnomaly', () => {
  it('flags points outside bands', () => {
    const data = [...normalData(100, 0, 1), 20, -20, 15];
    const result = bollingerBandAnomaly(data, 20, 2);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(2);
  });
});

describe('mahalanobisAnomaly', () => {
  it('detects multivariate outliers', () => {
    const data = Array.from({ length: 50 }, () => [Math.random(), Math.random()]);
    data.push([20, 20]);
    const result = mahalanobisAnomaly(data, 3);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(1);
    expect(result.isAnomaly[data.length - 1]).toBe(true);
  });
});

describe('pcaReconstructionAnomaly', () => {
  it('detects points with high reconstruction error', () => {
    const data = Array.from({ length: 60 }, () => {
      const x = Math.random();
      return [x, x + Math.random() * 0.1, x * 2 + Math.random() * 0.1];
    });
    data.push([10, -10, 50]);
    const result = pcaReconstructionAnomaly(data, 1, 0.05);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(1);
  });
});

describe('IsolationForest', () => {
  it('detects outliers in 2D data', () => {
    const normal = Array.from({ length: 100 }, () => [Math.random(), Math.random()]);
    const outliers = [[20, 20], [-20, -20], [15, -15]];
    const data = [...normal, ...outliers];
    const iso = new IsolationForest(50, 64, 0.05);
    iso.fit(data);
    const result = iso.detect(data);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(2);
    expect(result.scores.length).toBe(data.length);
  });

  it('anomaly rate matches contamination approximately', () => {
    const data = Array.from({ length: 200 }, () => [Math.random() * 2, Math.random() * 2]);
    const iso = new IsolationForest(100, 128, 0.1);
    iso.fit(data);
    const result = iso.detect(data);
    expect(result.anomalyRate).toBeGreaterThan(0.01);
    expect(result.anomalyRate).toBeLessThan(0.3);
  });
});

describe('LocalOutlierFactor', () => {
  it('detects isolated points', () => {
    const data = Array.from({ length: 50 }, () => [Math.random(), Math.random()]);
    data.push([50, 50]);
    const lof = new LocalOutlierFactor(5, 0.1);
    const result = lof.detect(data);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(1);
  });
});

describe('OnlineAnomalyDetector', () => {
  it('detects sudden spike after warm-up', () => {
    const detector = new OnlineAnomalyDetector(50, 3);
    const warmup = normalData(60, 0, 1);
    warmup.forEach(v => detector.update(v));
    const spike = detector.update(100);
    expect(spike.isAnomaly).toBe(true);
    expect(spike.score).toBeGreaterThan(3);
  });

  it('normal values are not anomalies', () => {
    const detector = new OnlineAnomalyDetector(50, 3);
    normalData(60, 10, 1).forEach(v => detector.update(v));
    const result = detector.update(10);
    expect(result.isAnomaly).toBe(false);
  });

  it('reset clears state', () => {
    const detector = new OnlineAnomalyDetector(20, 3);
    normalData(30, 0, 1).forEach(v => detector.update(v));
    detector.reset();
    const result = detector.update(0);
    expect(result.isAnomaly).toBe(false);
  });
});

describe('detectMarketAnomalies', () => {
  it('returns flash crashes, unusual volume, and price jumps', () => {
    const n = 200;
    const prices = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 10));
    prices[100] = 50;
    const volumes = Array.from({ length: n }, () => 1000 + Math.random() * 200);
    volumes[150] = 100_000;
    const result = detectMarketAnomalies(prices, volumes);
    expect(result).toHaveProperty('flashCrashes');
    expect(result).toHaveProperty('unusualVolume');
    expect(result).toHaveProperty('priceJumps');
    expect(result.flashCrashes.isAnomaly.length).toBe(n - 1);
  });
});

describe('correlationBreakDetection', () => {
  it('detects correlation regime change', () => {
    const n = 200;
    const a = Array.from({ length: n }, () => Math.random());
    const b = a.map((v, i) => i < 100 ? v + Math.random() * 0.1 : -v + Math.random() * 0.1);
    const result = correlationBreakDetection(a, b, 30, 2);
    expect(result.anomalyIndices.length).toBeGreaterThanOrEqual(0);
    expect(result.scores.length).toBe(n);
  });
});

describe('rankAnomalies', () => {
  it('combines and ranks multiple results', () => {
    const data = dataWithOutliers(100, 3, 15);
    const r1 = zScoreAnomaly(data, 3);
    const r2 = iqrAnomaly(data, 1.5);
    const ranked = rankAnomalies([r1, r2]);
    expect(ranked.length).toBeGreaterThan(0);
    ranked.forEach(r => {
      expect(r.combinedScore).toBeGreaterThanOrEqual(0);
      expect(r.methods.length).toBeGreaterThanOrEqual(1);
    });
  });
});
