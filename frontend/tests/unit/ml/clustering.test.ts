import { describe, it, expect } from 'vitest';
import {
  KMeans, DBSCAN, GaussianMixture, HierarchicalClustering,
  spectralClustering, silhouetteScore, daviesBouldinIndex,
  calinskiHarabaszIndex, elbowMethod,
} from '../../../src/lib/ml/clustering';

function clusteredData(
  centers: number[][],
  pointsPerCluster: number,
  noise: number,
): number[][] {
  const data: number[][] = [];
  for (const center of centers) {
    for (let i = 0; i < pointsPerCluster; i++) {
      data.push(center.map(c => c + (Math.random() - 0.5) * noise));
    }
  }
  return data;
}

describe('KMeans', () => {
  const data = clusteredData([[0, 0], [10, 10], [20, 0]], 30, 1);

  it('finds correct number of clusters', () => {
    const km = new KMeans({ k: 3, maxIter: 100, seed: 42 });
    const result = km.fit(data);
    expect(result.nClusters).toBe(3);
    expect(result.labels.length).toBe(90);
    expect(result.centers!.length).toBe(3);
  });

  it('assigns labels in valid range', () => {
    const km = new KMeans({ k: 3, seed: 42 });
    const result = km.fit(data);
    result.labels.forEach(l => {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThan(3);
    });
  });

  it('cluster sizes sum to total data points', () => {
    const km = new KMeans({ k: 3, seed: 42 });
    const result = km.fit(data);
    const total = result.clusterSizes.reduce((a, b) => a + b, 0);
    expect(total).toBe(90);
  });

  it('predict assigns new points to nearest cluster', () => {
    const km = new KMeans({ k: 3, seed: 42 });
    km.fit(data);
    const predicted = km.predict([[0, 0], [10, 10]]);
    expect(predicted.length).toBe(2);
  });

  it('inertia decreases with more iterations', () => {
    const km1 = new KMeans({ k: 3, maxIter: 1, seed: 42 });
    const km2 = new KMeans({ k: 3, maxIter: 100, seed: 42 });
    const r1 = km1.fit(data);
    const r2 = km2.fit(data);
    expect(r2.inertia!).toBeLessThanOrEqual(r1.inertia! * 1.01);
  });

  it('deterministic with same seed', () => {
    const km1 = new KMeans({ k: 3, seed: 123 });
    const km2 = new KMeans({ k: 3, seed: 123 });
    const r1 = km1.fit(data);
    const r2 = km2.fit(data);
    expect(r1.labels).toEqual(r2.labels);
  });
});

describe('DBSCAN', () => {
  it('finds clusters in well-separated data', () => {
    const data = clusteredData([[0, 0], [20, 20]], 30, 1);
    const dbscan = new DBSCAN(3, 3);
    const result = dbscan.fit(data);
    expect(result.nClusters).toBeGreaterThanOrEqual(2);
  });

  it('labels noise as -1', () => {
    const data = clusteredData([[0, 0]], 20, 0.5);
    data.push([100, 100]);
    const dbscan = new DBSCAN(2, 3);
    const result = dbscan.fit(data);
    expect(result.labels[result.labels.length - 1]).toBe(-1);
  });

  it('handles single cluster', () => {
    const data = clusteredData([[5, 5]], 50, 0.5);
    const dbscan = new DBSCAN(2, 3);
    const result = dbscan.fit(data);
    expect(result.nClusters).toBeGreaterThanOrEqual(1);
  });
});

describe('GaussianMixture', () => {
  it('fits GMM to clustered data', () => {
    const data = clusteredData([[0, 0], [10, 10]], 40, 1);
    const gmm = new GaussianMixture(2, 100);
    const result = gmm.fit(data);
    expect(result.nClusters).toBe(2);
    expect(result.labels.length).toBe(80);
  });

  it('cluster sizes are reasonable', () => {
    const data = clusteredData([[0, 0], [10, 10]], 40, 1);
    const gmm = new GaussianMixture(2, 100);
    const result = gmm.fit(data);
    result.clusterSizes.forEach(s => expect(s).toBeGreaterThan(10));
  });
});

describe('HierarchicalClustering', () => {
  it('ward linkage produces correct clusters', () => {
    const data = clusteredData([[0, 0], [10, 10]], 20, 1);
    const hc = new HierarchicalClustering('ward');
    const result = hc.fit(data, 2);
    expect(result.nClusters).toBe(2);
    expect(result.labels.length).toBe(40);
  });

  it('single linkage works', () => {
    const data = clusteredData([[0, 0], [10, 10]], 15, 1);
    const hc = new HierarchicalClustering('single');
    const result = hc.fit(data, 2);
    expect(result.nClusters).toBe(2);
  });
});

describe('spectralClustering', () => {
  it('clusters non-linearly separable data', () => {
    const data = clusteredData([[0, 0], [10, 0]], 25, 1);
    const result = spectralClustering(data, 2);
    expect(result.nClusters).toBe(2);
    expect(result.labels.length).toBe(50);
  });
});

describe('silhouetteScore', () => {
  it('well-separated clusters have high score', () => {
    const data = clusteredData([[0, 0], [20, 20]], 30, 0.5);
    const labels = [...Array(30).fill(0), ...Array(30).fill(1)];
    const score = silhouetteScore(data, labels);
    expect(score).toBeGreaterThan(0.5);
  });

  it('random labels have low score', () => {
    const data = clusteredData([[0, 0], [20, 20]], 30, 0.5);
    const labels = data.map(() => Math.random() > 0.5 ? 0 : 1);
    const score = silhouetteScore(data, labels);
    expect(score).toBeLessThan(0.8);
  });
});

describe('daviesBouldinIndex', () => {
  it('well-separated clusters have low DB index', () => {
    const data = clusteredData([[0, 0], [20, 20]], 30, 0.5);
    const labels = [...Array(30).fill(0), ...Array(30).fill(1)];
    const centers = [[0, 0], [20, 20]];
    const db = daviesBouldinIndex(data, labels, centers);
    expect(db).toBeLessThan(1);
    expect(db).toBeGreaterThan(0);
  });
});

describe('calinskiHarabaszIndex', () => {
  it('returns positive value for valid clustering', () => {
    const data = clusteredData([[0, 0], [10, 10]], 30, 1);
    const labels = [...Array(30).fill(0), ...Array(30).fill(1)];
    const centers = [[0, 0], [10, 10]];
    const ch = calinskiHarabaszIndex(data, labels, centers);
    expect(ch).toBeGreaterThan(0);
  });
});

describe('elbowMethod', () => {
  it('returns inertias for each k', () => {
    const data = clusteredData([[0, 0], [10, 10], [20, 0]], 20, 1);
    const result = elbowMethod(data, 6);
    expect(result.k.length).toBe(6);
    expect(result.inertias.length).toBe(6);
    expect(result.inertias[0]).toBeGreaterThan(result.inertias[5]);
  });

  it('inertia monotonically decreases', () => {
    const data = clusteredData([[0, 0], [10, 10]], 30, 1);
    const result = elbowMethod(data, 5);
    for (let i = 1; i < result.inertias.length; i++) {
      expect(result.inertias[i]).toBeLessThanOrEqual(result.inertias[i - 1] * 1.01);
    }
  });
});
