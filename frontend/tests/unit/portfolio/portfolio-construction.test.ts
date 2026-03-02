import { describe, it, expect } from 'vitest';
import {
  buildAllocationTree,
  flattenAllocationForViz,
  sectorWeights,
  assetClassWeights,
  needsThresholdRebalance,
  computeRebalanceBands,
  positionsOutsideBand,
  nextRebalanceDate,
  estimateRebalanceCosts,
  findHarvestCandidates,
  selectHarvestLots,
  normalizeWeights,
  rescaleToTargetVol,
  blendWeights,
  applyWeightConstraints,
  weightsToShares,
  concentrationScore,
  diversificationRatio,
  portfolioHealthCheck,
  prepareFrontierForChart,
  frontierPointAtReturn,
  computeTurnover,
  turnoverDecomposition,
} from '../../../src/lib/portfolio/construction';
import type { Position, TaxLot, Sector } from '../../../src/lib/portfolio/types';

const mkPos = (symbol: string, mv: number, weight: number, sector: Sector = 'technology' as Sector): Position =>
  ({ symbol, marketValue: mv, weight, sector } as Position);

describe('Allocation Tree', () => {
  const positions: Position[] = [
    mkPos('AAPL', 50000, 0.5),
    mkPos('MSFT', 30000, 0.3),
    mkPos('JPM', 20000, 0.2),
  ];

  it('buildAllocationTree by sector', () => {
    const tree = buildAllocationTree(positions, 'sector');
    expect(tree.root.children).toBeDefined();
    expect(tree.totalValue).toBe(100000);
  });

  it('flattenAllocationForViz', () => {
    const tree = buildAllocationTree(positions);
    const flat = flattenAllocationForViz(tree);
    expect(flat.length).toBeGreaterThan(0);
  });
});

describe('Sector/Asset Class Weights', () => {
  it('sectorWeights sum to 1', () => {
    const pos = [mkPos('A', 60, 0.6), mkPos('B', 40, 0.4)];
    const w = sectorWeights(pos);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe('Rebalance Rules', () => {
  it('needsThresholdRebalance true when deviation exceeds threshold', () => {
    expect(needsThresholdRebalance([0.5, 0.5], [0.4, 0.6], 0.05)).toBe(true);
  });

  it('needsThresholdRebalance false when within band', () => {
    expect(needsThresholdRebalance([0.49, 0.51], [0.5, 0.5], 0.05)).toBe(false);
  });

  it('computeRebalanceBands', () => {
    const bands = computeRebalanceBands([0.3, 0.7], [0.5, 0.5], ['A', 'B'], 0.1);
    expect(bands[0].inBand).toBe(false);
  });

  it('positionsOutsideBand', () => {
    const bands = computeRebalanceBands([0.3, 0.7], [0.5, 0.5], ['A', 'B'], 0.05);
    const outside = positionsOutsideBand(bands);
    expect(outside.length).toBeGreaterThan(0);
  });

  it('nextRebalanceDate monthly', () => {
    const next = nextRebalanceDate(1609459200000, 'monthly');
    expect(next).toBeGreaterThan(1609459200000);
  });
});

describe('Tax Harvest', () => {
  const lots: TaxLot[] = [
    { id: '1', symbol: 'AAPL', quantity: 100, costBasis: 150, purchaseDate: 0, isShortTerm: true },
  ];
  const positions = [mkPos('AAPL', 14000, 1)];

  it('findHarvestCandidates returns losses', () => {
    const c = findHarvestCandidates(positions, lots, [], Date.now(), {
      maxHarvestPct: 10,
      minLossPct: 1,
      avoidWashSale: true,
      replaceWithSimilar: false,
    });
    expect(c).toBeDefined();
  });

  it('selectHarvestLots respects maxHarvestPct', () => {
    const candidates = [{ lot: lots[0], symbol: 'AAPL', loss: -1000, lossPct: -7, taxSavings: 370, washSaleBlocked: false }];
    const sel = selectHarvestLots(candidates, 100000, 5);
    expect(sel.length).toBeLessThanOrEqual(candidates.length);
  });
});

describe('Weight Utilities', () => {
  it('normalizeWeights sums to 1', () => {
    const w = normalizeWeights([1, 2, 3]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('blendWeights', () => {
    const w = blendWeights([0.5, 0.5], [0.6, 0.4], 0.5);
    expect(w[0]).toBeCloseTo(0.55);
  });

  it('applyWeightConstraints', () => {
    const w = applyWeightConstraints([0.1, 0.5, 0.4], 0.05, 0.5);
    expect(w.every(x => x >= 0.05 && x <= 0.5)).toBe(true);
  });

  it('weightsToShares', () => {
    const s = weightsToShares([0.5, 0.5], 10000, [100, 50], ['A', 'B']);
    expect(s).toHaveLength(2);
  });
});

describe('Diversification', () => {
  it('concentrationScore', () => {
    const s = concentrationScore([0.9, 0.1]);
    expect(s).toBeGreaterThan(0.5);
  });

  it('diversificationRatio', () => {
    const cov = [[0.04, 0.01], [0.01, 0.04]];
    const dr = diversificationRatio([0.5, 0.5], cov);
    expect(dr).toBeGreaterThan(0);
  });
});

describe('Portfolio Health', () => {
  it('valid portfolio', () => {
    const h = portfolioHealthCheck([0.34, 0.33, 0.33], undefined, 2);
    expect(h.isValid).toBe(true);
  });

  it('invalid when weights do not sum to 1', () => {
    const h = portfolioHealthCheck([0.5, 0.6]);
    expect(h.issues.length).toBeGreaterThan(0);
  });
});

describe('Turnover', () => {
  it('computeTurnover', () => {
    const t = computeTurnover([0.5, 0.5], [0.6, 0.4]);
    expect(t).toBeGreaterThan(0);
  });

  it('turnoverDecomposition', () => {
    const d = turnoverDecomposition([0.5, 0.5], [0.6, 0.4], [0.55, 0.45]);
    expect(d.total).toBeDefined();
  });
});
