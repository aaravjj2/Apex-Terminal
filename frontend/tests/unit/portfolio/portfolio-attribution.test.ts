import { describe, it, expect } from 'vitest';
import {
  brinsonHoodBeebower,
  brinsonHoodBeebowerTotal,
  brinsonFachler,
  factorAttribution,
  famaFrench3Factor,
  carhart4Factor,
  fixedIncomeAttribution,
  currencyAttribution,
  carinoLinking,
  mencheroLinking,
  grapLinking,
  transactionCostAttribution,
  alphaDecomposition,
  sectorAttribution,
  styleAttribution,
  regionAttribution,
} from '../../../src/lib/portfolio/attribution';

describe('Brinson-Hood-Beebower Attribution', () => {
  const input = {
    sectors: ['Tech', 'Healthcare', 'Financials'],
    portfolioWeights: [0.5, 0.3, 0.2],
    benchmarkWeights: [0.4, 0.35, 0.25],
    portfolioReturns: [0.10, 0.08, 0.05],
    benchmarkReturns: [0.12, 0.06, 0.04],
  };

  it('returns sector-level attribution', () => {
    const result = brinsonHoodBeebower(input);
    expect(result).toHaveLength(3);
  });

  it('allocation = (wp - wb) * rb', () => {
    const result = brinsonHoodBeebower(input);
    const tech = result[0];
    expect(tech?.allocation).toBeCloseTo((0.5 - 0.4) * 0.12);
  });

  it('selection = wb * (rp - rb)', () => {
    const result = brinsonHoodBeebower(input);
    const tech = result[0];
    expect(tech?.selection).toBeCloseTo(0.4 * (0.10 - 0.12));
  });

  it('total attribution matches sum of components', () => {
    const result = brinsonHoodBeebower(input);
    const total = brinsonHoodBeebowerTotal(input);
    expect(total.allocation + total.selection + total.interaction).toBeCloseTo(
      result.reduce((s, r) => s + r.total, 0)
    );
  });

  it('handles equal weights', () => {
    const equal = {
      ...input,
      portfolioWeights: [1 / 3, 1 / 3, 1 / 3],
      benchmarkWeights: [1 / 3, 1 / 3, 1 / 3],
    };
    const result = brinsonHoodBeebower(equal);
    expect(result.every(r => r.allocation === 0)).toBe(true);
  });

  it('handles single sector', () => {
    const single = {
      sectors: ['Tech'],
      portfolioWeights: [1],
      benchmarkWeights: [1],
      portfolioReturns: [0.1],
      benchmarkReturns: [0.08],
    };
    const result = brinsonHoodBeebower(single);
    expect(result).toHaveLength(1);
  });
});

describe('Brinson-Fachler Attribution', () => {
  const input = {
    sectors: ['Tech', 'Healthcare'],
    portfolioWeights: [0.6, 0.4],
    benchmarkWeights: [0.5, 0.5],
    portfolioReturns: [0.15, 0.05],
    benchmarkReturns: [0.12, 0.08],
  };

  it('uses total benchmark return in allocation', () => {
    const result = brinsonFachler(input);
    const totalBm = 0.5 * 0.12 + 0.5 * 0.08;
    expect(result[0]?.allocation).toBeCloseTo((0.6 - 0.5) * (0.12 - totalBm));
  });
});

describe('Factor Attribution', () => {
  const nObs = 252;
  function rs(n: number) {
    const r: number[] = [];
    for (let i = 0; i < n; i++) r.push(0.0005 + (Math.sin(i * 0.1) * 0.01) + (i % 5) * 0.0002);
    return r;
  }
  const assetReturns = rs(nObs);
  const mktRf = rs(nObs).map((v, i) => v * 0.8 + 0.0001 * (i % 3));
  const smb = rs(nObs).map((v, i) => v * 0.3 + 0.0002 * (i % 4));
  const hml = rs(nObs).map((v, i) => v * -0.2 + 0.0001 * (i % 5));
  const mom = rs(nObs).map((v, i) => v * 0.4 + 0.0001 * (i % 6));

  it('returns alpha and factor contributions', () => {
    const result = factorAttribution({
      assetReturns,
      factorReturns: mktRf.map((_, i) => [mktRf[i], smb[i], hml[i]]),
      factorNames: ['Market', 'SMB', 'HML'],
    });
    expect(result).toHaveProperty('alpha');
    expect(result.factors).toHaveLength(3);
  });

  it('Fama-French 3-factor attribution', () => {
    const result = famaFrench3Factor(assetReturns, mktRf, smb, hml);
    expect(result.factors.map(f => f.factorName)).toContain('Market');
  });

  it('Carhart 4-factor attribution', () => {
    const result = carhart4Factor(assetReturns, mktRf, smb, hml, mom);
    expect(result.factors).toHaveLength(4);
  });

  it('rSquared in [0, 1]', () => {
    const result = factorAttribution({
      assetReturns: [1, 2, 3, 4, 5],
      factorReturns: [[1], [2], [3], [4], [5]],
      factorNames: ['X'],
    });
    expect(result.rSquared).toBeGreaterThanOrEqual(0);
    expect(result.rSquared).toBeLessThanOrEqual(1);
  });
});

describe('Fixed Income Attribution', () => {
  it('computes duration effect', () => {
    const result = fixedIncomeAttribution({
      portfolioDuration: 5,
      benchmarkDuration: 4,
      yieldCurveShift: 0.01,
      portfolioSpread: 0.02,
      benchmarkSpread: 0.018,
      spreadChange: 0.005,
      curveReshape: [0, 0],
      keyRateDurations: [1, 1],
    });
    expect(result.duration).toBeCloseTo(-(5 - 4) * 0.01);
  });
});

describe('Currency Attribution', () => {
  it('returns local and currency effects', () => {
    const result = currencyAttribution({
      localReturns: [0.05, 0.03],
      fxReturns: [0.02, -0.01],
      weights: [0.6, 0.4],
      benchmarkLocalReturns: [0.04, 0.03],
      benchmarkFxReturns: [0.01, -0.01],
      benchmarkWeights: [0.6, 0.4],
    });
    expect(result).toHaveProperty('localEffect');
    expect(result).toHaveProperty('currencyEffect');
  });
});

describe('Multi-Period Linking', () => {
  const periods = [
    { start: 0, end: 1, portfolioReturn: 0.05, benchmarkReturn: 0.03, attribution: { allocation: 0.005, selection: 0.01, interaction: 0.005, currency: 0, total: 0.02 } },
    { start: 1, end: 2, portfolioReturn: 0.02, benchmarkReturn: 0.04, attribution: { allocation: -0.01, selection: 0.005, interaction: -0.005, currency: 0, total: -0.01 } },
  ];

  it('Carino linking produces linked attribution', () => {
    const result = carinoLinking(periods);
    expect(result.linkingMethod).toBe('carino');
    expect(result.linkedAttribution.total).toBeDefined();
  });

  it('Menchero linking normalizes to actual excess', () => {
    const result = mencheroLinking(periods);
    expect(result.linkingMethod).toBe('menchero');
  });

  it('GRAP linking uses geometric compounding', () => {
    const result = grapLinking(periods);
    expect(result.linkingMethod).toBe('grap');
  });
});

describe('Transaction Cost Attribution', () => {
  it('computes per-trade slippage and timing', () => {
    const result = transactionCostAttribution({
      trades: [
        {
          symbol: 'AAPL',
          side: 'buy' as const,
          shares: 100,
          executionPrice: 151,
          arrivalPrice: 150,
          benchmarkVWAP: 149.5,
          commission: 1,
          marketImpact: 0.5,
        },
      ],
    });
    expect(result.perTrade).toHaveLength(1);
    expect(result.totalSlippage).toBeDefined();
  });
});

describe('Alpha Decomposition', () => {
  it('returns observed alpha and bootstrap stats', () => {
    const port = Array.from({ length: 252 }, () => 0.001 + Math.random() * 0.002);
    const bm = Array.from({ length: 252 }, () => 0.0008 + Math.random() * 0.0015);
    const result = alphaDecomposition(port, bm, 500);
    expect(result).toHaveProperty('observedAlpha');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('isSkillful');
  });
});

describe('Sector Attribution', () => {
  it('handles sector-level weights and returns', () => {
    const result = sectorAttribution(
      { Tech: 0.5, Healthcare: 0.5 },
      { Tech: 0.4, Healthcare: 0.6 },
      { Tech: 0.1, Healthcare: 0.05 },
      { Tech: 0.08, Healthcare: 0.06 }
    );
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Style Attribution', () => {
  it('returns style factor contributions', () => {
    const returns = Array.from({ length: 100 }, (_, i) => 0.001 + 0.0001 * (i % 7));
    const styleFactors = {
      growth: Array.from({ length: 100 }, (_, i) => 0.5 + 0.01 * (i % 5)),
      value: Array.from({ length: 100 }, (_, i) => 0.3 + 0.01 * (i % 4)),
      size: Array.from({ length: 100 }, (_, i) => -0.2 + 0.01 * (i % 6)),
      momentum: Array.from({ length: 100 }, (_, i) => 0.1 + 0.01 * (i % 3)),
      quality: Array.from({ length: 100 }, (_, i) => 0.2 + 0.01 * (i % 8)),
    };
    const result = styleAttribution(returns, styleFactors);
    expect(result).toHaveProperty('growth');
    expect(result).toHaveProperty('total');
  });
});

describe('Region Attribution', () => {
  it('reuses sector attribution logic', () => {
    const result = regionAttribution(
      { US: 0.7, EU: 0.3 },
      { US: 0.6, EU: 0.4 },
      { US: 0.08, EU: 0.05 },
      { US: 0.07, EU: 0.04 }
    );
    expect(result).toBeDefined();
  });
});
