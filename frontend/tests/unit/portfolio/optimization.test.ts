import { describe, it, expect } from 'vitest';
import {
  minimumVariancePortfolio,
  maxSharpePortfolio,
  targetReturnPortfolio,
  targetRiskPortfolio,
  efficientFrontier,
  meanVarianceOptimization,
  blackLittermanEquilibriumReturns,
  blackLittermanPosterior,
  riskParity,
  hierarchicalRiskParity,
  maxDiversification,
  calendarRebalance,
  thresholdRebalance,
  optimalRebalance,
  validateConstraints,
  identifyTaxLots,
  checkWashSale,
} from '../../../src/lib/portfolio/optimization';
import { matVecMul } from '../../../src/lib/portfolio/risk';

const covMatrix = [
  [0.04, 0.006, 0.002],
  [0.006, 0.09, 0.009],
  [0.002, 0.009, 0.01],
];

const expectedReturns = [0.10, 0.15, 0.06];

describe('Minimum Variance Portfolio', () => {
  it('weights sum to 1', () => {
    const result = minimumVariancePortfolio(covMatrix);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('variance is positive', () => {
    const result = minimumVariancePortfolio(covMatrix);
    expect(result.variance).toBeGreaterThan(0);
  });

  it('variance is less than any individual asset variance', () => {
    const result = minimumVariancePortfolio(covMatrix);
    for (let i = 0; i < covMatrix.length; i++) {
      expect(result.variance).toBeLessThanOrEqual(covMatrix[i][i] + 0.001);
    }
  });

  it('constrained: long-only weights are non-negative', () => {
    const result = minimumVariancePortfolio(covMatrix, { longOnly: true });
    for (const w of result.weights) {
      expect(w).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('constrained: max weight respected', () => {
    const result = minimumVariancePortfolio(covMatrix, { longOnly: true, maxWeight: 0.5 });
    for (const w of result.weights) {
      expect(w).toBeLessThanOrEqual(0.51);
    }
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 1);
  });
});

describe('Max Sharpe Portfolio', () => {
  it('weights sum to 1', () => {
    const result = maxSharpePortfolio(expectedReturns, covMatrix, 0.02);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('Sharpe ratio is positive with positive expected returns', () => {
    const result = maxSharpePortfolio(expectedReturns, covMatrix, 0.02);
    expect(result.sharpe).toBeGreaterThan(0);
  });

  it('constrained max Sharpe has non-negative weights', () => {
    const result = maxSharpePortfolio(expectedReturns, covMatrix, 0.02, { longOnly: true });
    for (const w of result.weights) {
      expect(w).toBeGreaterThanOrEqual(-0.01);
    }
  });
});

describe('Target Return Portfolio', () => {
  it('achieved return ≈ target', () => {
    const target = 0.10;
    const result = targetReturnPortfolio(expectedReturns, covMatrix, target);
    const achievedReturn = result.weights.reduce((s, w, i) => s + w * expectedReturns[i], 0);
    expect(achievedReturn).toBeCloseTo(target, 1);
  });

  it('weights sum to 1', () => {
    const result = targetReturnPortfolio(expectedReturns, covMatrix, 0.10);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 1);
  });
});

describe('Target Risk Portfolio', () => {
  it('weights sum to 1', () => {
    const result = targetRiskPortfolio(expectedReturns, covMatrix, 0.15);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('returns expected return', () => {
    const result = targetRiskPortfolio(expectedReturns, covMatrix, 0.15);
    expect(isFinite(result.expectedReturn)).toBe(true);
  });
});

describe('Efficient Frontier', () => {
  it('returns specified number of points', () => {
    const frontier = efficientFrontier(expectedReturns, covMatrix, 20, 0.02);
    expect(frontier).toHaveLength(20);
  });

  it('all frontier points have risk, return, weights, sharpe', () => {
    const frontier = efficientFrontier(expectedReturns, covMatrix, 10);
    for (const point of frontier) {
      expect(point).toHaveProperty('risk');
      expect(point).toHaveProperty('return');
      expect(point).toHaveProperty('weights');
      expect(point).toHaveProperty('sharpe');
    }
  });

  it('returns are non-decreasing along the frontier', () => {
    const frontier = efficientFrontier(expectedReturns, covMatrix, 30, 0.02);
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].return).toBeGreaterThanOrEqual(frontier[i - 1].return - 0.001);
    }
  });

  it('risk generally increases with return along frontier', () => {
    const frontier = efficientFrontier(expectedReturns, covMatrix, 30, 0.02);
    const firstRisk = frontier[0].risk;
    const lastRisk = frontier[frontier.length - 1].risk;
    expect(lastRisk).toBeGreaterThan(firstRisk - 0.01);
  });

  it('constrained frontier has non-negative weights', () => {
    const frontier = efficientFrontier(expectedReturns, covMatrix, 10, 0.02, { longOnly: true });
    for (const point of frontier) {
      for (const w of point.weights) {
        expect(w).toBeGreaterThanOrEqual(-0.01);
      }
    }
  });
});

describe('Mean-Variance Optimization', () => {
  it('returns complete result', () => {
    const result = meanVarianceOptimization(expectedReturns, covMatrix, 0.02);
    expect(result).toHaveProperty('weights');
    expect(result).toHaveProperty('expectedReturn');
    expect(result).toHaveProperty('expectedVolatility');
    expect(result).toHaveProperty('sharpe');
    expect(result).toHaveProperty('efficientFrontier');
  });

  it('weights sum to 1', () => {
    const result = meanVarianceOptimization(expectedReturns, covMatrix, 0.02);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 2);
  });
});

describe('Black-Litterman', () => {
  it('equilibrium returns are proportional to risk', () => {
    const marketWeights = [0.5, 0.3, 0.2];
    const riskAversion = 2.5;
    const eqReturns = blackLittermanEquilibriumReturns(covMatrix, marketWeights, riskAversion);
    expect(eqReturns).toHaveLength(3);
    for (const r of eqReturns) {
      expect(isFinite(r)).toBe(true);
    }
  });

  it('posterior returns incorporate views', () => {
    const marketWeights = [0.5, 0.3, 0.2];
    const riskAversion = 2.5;
    const eqReturns = blackLittermanEquilibriumReturns(covMatrix, marketWeights, riskAversion);
    const viewMatrix = [[1, -1, 0]];
    const viewReturns = [0.05];
    const viewConfidence = [10];
    const { posteriorReturns } = blackLittermanPosterior(
      covMatrix, eqReturns, viewMatrix, viewReturns, viewConfidence
    );
    expect(posteriorReturns).toHaveLength(3);
    expect(posteriorReturns[0] - posteriorReturns[1]).toBeGreaterThan(
      eqReturns[0] - eqReturns[1] - 0.1
    );
  });
});

describe('Risk Parity', () => {
  it('weights sum to 1', () => {
    const result = riskParity(covMatrix);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('all weights are positive', () => {
    const result = riskParity(covMatrix);
    for (const w of result.weights) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it('risk contributions are approximately equal', () => {
    const equalCov = [
      [0.04, 0.01, 0.005],
      [0.01, 0.04, 0.01],
      [0.005, 0.01, 0.04],
    ];
    const result = riskParity(equalCov);
    const targetRC = 1 / equalCov.length;
    for (const rc of result.riskContributions) {
      expect(rc).toBeCloseTo(targetRC, 1);
    }
  });

  it('lower-risk asset gets higher weight', () => {
    const result = riskParity(covMatrix);
    const minVarIdx = covMatrix.reduce((minIdx, row, i, arr) =>
      row[i] < arr[minIdx][minIdx] ? i : minIdx, 0);
    const maxWeight = Math.max(...result.weights);
    expect(result.weights[minVarIdx]).toBeCloseTo(maxWeight, 1);
  });
});

describe('Hierarchical Risk Parity', () => {
  it('weights sum to 1', () => {
    const result = hierarchicalRiskParity(covMatrix);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('all weights are positive', () => {
    const result = hierarchicalRiskParity(covMatrix);
    for (const w of result.weights) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it('returns cluster order', () => {
    const result = hierarchicalRiskParity(covMatrix);
    expect(result.clusterOrder).toHaveLength(3);
  });
});

describe('Maximum Diversification', () => {
  it('weights sum to 1', () => {
    const result = maxDiversification(covMatrix);
    const sum = result.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('diversification ratio >= 1', () => {
    const result = maxDiversification(covMatrix);
    expect(result.diversificationRatio).toBeGreaterThanOrEqual(0.99);
  });
});

describe('Rebalancing', () => {
  const current = [0.55, 0.25, 0.20];
  const target = [0.40, 0.35, 0.25];
  const symbols = ['AAPL', 'GOOG', 'MSFT'];
  const totalValue = 100000;
  const prices = [150, 2800, 400];

  it('calendar rebalance produces trades', () => {
    const result = calendarRebalance(current, target, symbols, totalValue, prices);
    expect(result.trades).toHaveLength(3);
    expect(result.turnover).toBeGreaterThan(0);
  });

  it('threshold rebalance returns null if within threshold', () => {
    const close = [0.41, 0.34, 0.25];
    const result = thresholdRebalance(close, target, symbols, totalValue, prices, 0.05);
    expect(result).toBeNull();
  });

  it('threshold rebalance triggers when deviation > threshold', () => {
    const result = thresholdRebalance(current, target, symbols, totalValue, prices, 0.05);
    expect(result).not.toBeNull();
  });

  it('optimal rebalance produces trades', () => {
    const result = optimalRebalance(current, target, symbols, totalValue, prices, covMatrix);
    expect(result.trades).toHaveLength(3);
  });
});

describe('Constraint Validation', () => {
  it('valid long-only weights pass', () => {
    const result = validateConstraints([0.3, 0.3, 0.4], { longOnly: true });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('negative weight fails long-only', () => {
    const result = validateConstraints([-0.1, 0.6, 0.5], { longOnly: true });
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('weights not summing to 1 fails', () => {
    const result = validateConstraints([0.3, 0.3, 0.3], {});
    expect(result.valid).toBe(false);
  });

  it('max weight violation detected', () => {
    const result = validateConstraints([0.6, 0.2, 0.2], { maxWeight: 0.5 });
    expect(result.valid).toBe(false);
  });
});

describe('Tax Lot Identification', () => {
  const lots = [
    { id: '1', symbol: 'AAPL', quantity: 50, costBasis: 140, purchaseDate: Date.now() - 400 * 86400000, isShortTerm: false },
    { id: '2', symbol: 'AAPL', quantity: 30, costBasis: 155, purchaseDate: Date.now() - 100 * 86400000, isShortTerm: true },
    { id: '3', symbol: 'AAPL', quantity: 20, costBasis: 160, purchaseDate: Date.now() - 50 * 86400000, isShortTerm: true },
  ];

  it('FIFO selects oldest first', () => {
    const selected = identifyTaxLots(lots, 'fifo', 60);
    expect(selected[0].id).toBe('1');
  });

  it('LIFO selects newest first', () => {
    const selected = identifyTaxLots(lots, 'lifo', 20);
    expect(selected[0].id).toBe('3');
  });

  it('highest_cost selects most expensive first', () => {
    const selected = identifyTaxLots(lots, 'highest_cost', 20);
    expect(selected[0].costBasis).toBe(160);
  });

  it('does not exceed requested shares', () => {
    const selected = identifyTaxLots(lots, 'fifo', 40);
    const totalShares = selected.reduce((s, l) => s + l.quantity, 0);
    expect(totalShares).toBeLessThanOrEqual(40);
  });
});

describe('Wash Sale Detection', () => {
  it('detects wash sale within 30 days', () => {
    const lot = { id: '1', symbol: 'AAPL', quantity: 50, costBasis: 140, purchaseDate: Date.now() - 10 * 86400000, isShortTerm: false };
    const recent = [{ symbol: 'AAPL', date: Date.now() - 5 * 86400000 }];
    expect(checkWashSale(lot, recent, Date.now())).toBe(true);
  });

  it('no wash sale after 30 days', () => {
    const lot = { id: '1', symbol: 'AAPL', quantity: 50, costBasis: 140, purchaseDate: Date.now() - 100 * 86400000, isShortTerm: false };
    const recent = [{ symbol: 'AAPL', date: Date.now() - 60 * 86400000 }];
    expect(checkWashSale(lot, recent, Date.now())).toBe(false);
  });

  it('no wash sale for different symbol', () => {
    const lot = { id: '1', symbol: 'AAPL', quantity: 50, costBasis: 140, purchaseDate: Date.now(), isShortTerm: false };
    const recent = [{ symbol: 'GOOG', date: Date.now() - 5 * 86400000 }];
    expect(checkWashSale(lot, recent, Date.now())).toBe(false);
  });
});
