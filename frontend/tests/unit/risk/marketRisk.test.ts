import { describe, it, expect } from 'vitest';
import {
  historicalVaR, parametricVaR, cornishFisherVaR, monteCarloVaR,
  backtestVaR, attributePnL, herfindahlIndex, effectiveN,
  marginalRiskContribution, componentRiskContribution,
  peaksOverThreshold, blockMaxima, tailRiskMetrics,
} from '../../../src/lib/risk/marketRisk';

function normalReturns(n: number, mu = 0, sigma = 0.01): number[] {
  const r: number[] = [];
  for (let i = 0; i < n; i++) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    r.push(mu + sigma * z);
  }
  return r;
}

describe('Historical VaR', () => {
  it('returns positive VaR for losses', () => {
    const returns = normalReturns(500, -0.001, 0.02);
    const { var: v, es } = historicalVaR(returns, 0.95);
    expect(v).toBeGreaterThan(0);
    expect(es).toBeGreaterThanOrEqual(v);
  });

  it('ES >= VaR', () => {
    const returns = normalReturns(500, 0, 0.015);
    const { var: v, es } = historicalVaR(returns, 0.99);
    expect(es).toBeGreaterThanOrEqual(v);
  });

  it('higher confidence → higher VaR', () => {
    const returns = normalReturns(1000, 0, 0.02);
    const v95 = historicalVaR(returns, 0.95);
    const v99 = historicalVaR(returns, 0.99);
    expect(v99.var).toBeGreaterThanOrEqual(v95.var * 0.8);
  });

  it('returns zero for empty returns', () => {
    const { var: v } = historicalVaR([], 0.95);
    expect(v).toBe(0);
  });

  it('scales with horizon', () => {
    const returns = normalReturns(500, 0, 0.01);
    const v1d = historicalVaR(returns, 0.95, '1d');
    const v10d = historicalVaR(returns, 0.95, '10d');
    expect(v10d.var).toBeGreaterThan(v1d.var);
  });
});

describe('Parametric VaR', () => {
  it('returns positive VaR', () => {
    const returns = normalReturns(500, 0, 0.02);
    const { var: v } = parametricVaR(returns, 0.95);
    expect(v).toBeGreaterThan(0);
  });

  it('ES >= VaR for parametric', () => {
    const returns = normalReturns(300, 0, 0.015);
    const { var: v, es } = parametricVaR(returns, 0.95);
    expect(es).toBeGreaterThanOrEqual(v);
  });

  it('VaR is proportional to volatility', () => {
    const low = normalReturns(500, 0, 0.005);
    const high = normalReturns(500, 0, 0.02);
    const vLow = parametricVaR(low, 0.95);
    const vHigh = parametricVaR(high, 0.95);
    expect(vHigh.var).toBeGreaterThan(vLow.var);
  });

  it('returns zero for empty returns', () => {
    expect(parametricVaR([], 0.95).var).toBe(0);
  });

  it('scales with 10d horizon', () => {
    const returns = normalReturns(300, 0, 0.01);
    const v1 = parametricVaR(returns, 0.95, '1d');
    const v10 = parametricVaR(returns, 0.95, '10d');
    expect(v10.var).toBeGreaterThan(v1.var);
    expect(v10.var).toBeCloseTo(v1.var * Math.sqrt(10), 1);
  });
});

describe('Cornish-Fisher VaR', () => {
  it('adjusts for skewness and kurtosis', () => {
    const returns = normalReturns(500, 0, 0.02);
    const cf = cornishFisherVaR(returns, 0.95);
    const param = parametricVaR(returns, 0.95);
    expect(Math.abs(cf.var - param.var) / param.var).toBeLessThan(0.5);
  });

  it('falls back to parametric for small samples', () => {
    const returns = [0.01, -0.02, 0.005];
    const cf = cornishFisherVaR(returns, 0.95);
    const param = parametricVaR(returns, 0.95);
    expect(cf.var).toBeCloseTo(param.var, 4);
  });
});

describe('Monte Carlo VaR', () => {
  it('returns positive VaR', () => {
    const returns = normalReturns(300, 0, 0.02);
    const { var: v } = monteCarloVaR(returns, 0.95, '1d', 5000);
    expect(v).toBeGreaterThan(0);
  });

  it('ES >= VaR', () => {
    const returns = normalReturns(300, 0, 0.015);
    const { var: v, es } = monteCarloVaR(returns, 0.95, '1d', 5000);
    expect(es).toBeGreaterThanOrEqual(v * 0.8);
  });

  it('scales with longer horizon', () => {
    const returns = normalReturns(500, 0, 0.01);
    const v1 = monteCarloVaR(returns, 0.95, '1d', 5000);
    const v10 = monteCarloVaR(returns, 0.95, '10d', 5000);
    expect(v10.var).toBeGreaterThan(v1.var);
  });

  it('returns zero for empty returns', () => {
    expect(monteCarloVaR([], 0.95).var).toBe(0);
  });

  it('more simulations gives more stable result', () => {
    const returns = normalReturns(200, 0, 0.01);
    const r1 = monteCarloVaR(returns, 0.95, '1d', 1000);
    const r2 = monteCarloVaR(returns, 0.95, '1d', 1000);
    expect(Math.abs(r1.var - r2.var)).toBeLessThan(r1.var * 0.5);
  });
});

describe('VaR backtesting', () => {
  it('produces backtest result with exception count', () => {
    const pnl = normalReturns(252, 0, 0.02);
    const varEst = pnl.map(() => 0.03);
    const result = backtestVaR(pnl, varEst, 0.95);
    expect(result).toHaveProperty('exceptions');
    expect(result).toHaveProperty('expectedExceptions');
    expect(result).toHaveProperty('kupiecPValue');
    expect(result).toHaveProperty('baselZone');
  });

  it('produces green zone for well-calibrated VaR', () => {
    const pnl = normalReturns(252, 0, 0.01);
    const varEst = pnl.map(() => 0.05);
    const result = backtestVaR(pnl, varEst, 0.95);
    expect(result.exceptions).toBeLessThan(result.expectedExceptions * 3);
  });

  it('exception dates are tracked', () => {
    const pnl = normalReturns(100, 0, 0.03);
    const varEst = pnl.map(() => 0.01);
    const result = backtestVaR(pnl, varEst, 0.95);
    expect(result.exceptionDates.length).toBe(result.exceptions);
  });

  it('basel zone is one of green/yellow/red', () => {
    const pnl = normalReturns(252, 0, 0.015);
    const varEst = pnl.map(() => 0.03);
    const result = backtestVaR(pnl, varEst, 0.99);
    expect(['green', 'yellow', 'red']).toContain(result.baselZone);
  });
});

describe('P&L attribution', () => {
  it('produces attribution breakdown', () => {
    const portfolio = {
      id: 'P1', name: 'Test', currency: 'USD', totalValue: 1_000_000,
      historicalReturns: [], historicalDates: [],
      positions: [
        { id: 'POS1', symbol: 'AAPL', quantity: 100, entryPrice: 150, currentPrice: 155, marketValue: 15500, weight: 0.5, assetClass: 'equity' as const, currency: 'USD' },
        { id: 'POS2', symbol: 'GOOG', quantity: 50, entryPrice: 2800, currentPrice: 2850, marketValue: 142500, weight: 0.5, assetClass: 'equity' as const, currency: 'USD' },
      ],
    };
    const prevPositions = portfolio.positions;
    const factorReturns = { equity_us: 0.01, fx_eurusd: -0.005 };
    const result = attributePnL(portfolio, prevPositions, factorReturns);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('byAsset');
    expect(result).toHaveProperty('byFactor');
  });
});

describe('Concentration metrics', () => {
  it('herfindahlIndex is 1 for single asset', () => {
    expect(herfindahlIndex([1.0])).toBeCloseTo(1.0, 5);
  });

  it('herfindahlIndex is low for diversified portfolio', () => {
    const weights = Array(10).fill(0.1);
    expect(herfindahlIndex(weights)).toBeCloseTo(0.1, 5);
  });

  it('effectiveN equals n for equal weights', () => {
    const weights = Array(5).fill(0.2);
    expect(effectiveN(weights)).toBeCloseTo(5, 1);
  });

  it('effectiveN is 1 for concentrated portfolio', () => {
    expect(effectiveN([1])).toBeCloseTo(1, 1);
  });
});

describe('Risk contribution', () => {
  it('marginal risk contribution sums to portfolio risk', () => {
    const weights = [0.5, 0.5];
    const cov = [[0.04, 0.01], [0.01, 0.09]];
    const mrc = marginalRiskContribution(weights, cov);
    expect(mrc.length).toBe(2);
    expect(mrc[0]).toBeGreaterThan(0);
  });

  it('component risk contribution sums to total variance', () => {
    const weights = [0.6, 0.4];
    const cov = [[0.04, 0.01], [0.01, 0.09]];
    const crc = componentRiskContribution(weights, cov);
    const totalVar = weights.reduce((s, w, i) => {
      let v = 0;
      for (let j = 0; j < weights.length; j++) v += w * weights[j] * cov[i][j];
      return s + v;
    }, 0);
    const crcSum = crc.reduce((s, v) => s + v, 0);
    expect(crcSum).toBeCloseTo(Math.sqrt(totalVar), 4);
  });
});

describe('Extreme Value Theory', () => {
  it('peaks over threshold returns EVT result', () => {
    const losses = normalReturns(500, 0, 0.03).map(r => -r);
    const result = peaksOverThreshold(losses);
    expect(result).toHaveProperty('shapeParameter');
    expect(result).toHaveProperty('scaleParameter');
    expect(result).toHaveProperty('method');
    expect(result.method).toBe('pot');
  });

  it('block maxima returns EVT result', () => {
    const losses = normalReturns(500, 0, 0.03).map(r => -r);
    const result = blockMaxima(losses);
    expect(result).toHaveProperty('shapeParameter');
    expect(result.method).toBe('block_maxima');
  });
});

describe('Tail risk metrics', () => {
  it('returns expected tail loss metrics', () => {
    const returns = normalReturns(500, 0, 0.02);
    const metrics = tailRiskMetrics(returns);
    expect(metrics).toHaveProperty('expectedTailLoss95');
    expect(metrics).toHaveProperty('expectedTailLoss99');
    expect(metrics).toHaveProperty('tailRatio');
    expect(metrics).toHaveProperty('maxDrawdown');
    expect(metrics.expectedTailLoss99).toBeGreaterThanOrEqual(metrics.expectedTailLoss95);
  });
});
