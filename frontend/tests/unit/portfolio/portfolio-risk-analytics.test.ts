import { describe, it, expect } from 'vitest';
import {
  computeVaRAnalytics,
  compareVaRMethods,
  expectedShortfallMultiLevel,
  backtestVaR,
  EQUITY_STRESS_SCENARIOS,
  stressTestReport,
  correlationMatrixAnalytics,
  betaAnalytics,
  rollingBeta,
  riskDecompositionReport,
  rollingRiskMetrics,
  drawdownAnalytics,
  tailRiskReport,
  concentrationReport,
  buildRiskDashboard,
} from '../../../src/lib/portfolio/risk-analytics';

function genReturns(n: number, mu = 0.0002, sigma = 0.01): number[] {
  const r: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.sin(i * 12.9898) * 43758.5453;
    const u = (z - Math.floor(z));
    r.push(mu + sigma * (u * 2 - 1));
  }
  return r;
}

describe('VaR Analytics', () => {
  const returns = genReturns(252);

  it('historical VaR at 0.95', () => {
    const r = computeVaRAnalytics(returns, { confidence: 0.95, horizon: 1, method: 'historical' });
    expect(r.var95).toBeGreaterThan(0);
  });

  it('parametric VaR', () => {
    const r = computeVaRAnalytics(returns, { confidence: 0.95, horizon: 1, method: 'parametric' });
    expect(r.method).toBe('parametric');
  });

  it('monteCarlo VaR', () => {
    const r = computeVaRAnalytics(returns, { confidence: 0.95, horizon: 1, method: 'monteCarlo', numSimulations: 1000 });
    expect(r.var95).toBeGreaterThan(0);
  });

  it('cornishFisher VaR', () => {
    const r = computeVaRAnalytics(returns, { confidence: 0.95, horizon: 1, method: 'cornishFisher' });
    expect(r.var99).toBeDefined();
  });

  it('compareVaRMethods returns all methods', () => {
    const comp = compareVaRMethods(returns);
    expect(comp).toHaveProperty('historical');
    expect(comp).toHaveProperty('parametric');
  });

  it('expectedShortfallMultiLevel', () => {
    const es = expectedShortfallMultiLevel(returns, [0.9, 0.95, 0.99]);
    expect(es.es90).toBeDefined();
    expect(es.es95).toBeDefined();
  });

  it('backtestVaR computes violations', () => {
    const varEst = returns.map(() => 0.02);
    const bt = backtestVaR(returns, varEst, 0.95);
    expect(bt).toHaveProperty('violations');
    expect(bt).toHaveProperty('hitSequence');
  });
});

describe('Stress Testing', () => {
  it('EQUITY_STRESS_SCENARIOS has predefined scenarios', () => {
    expect(EQUITY_STRESS_SCENARIOS.length).toBeGreaterThan(5);
  });

  it('stressTestReport computes scenario impacts', () => {
    const weights = [0.5, 0.5];
    const factorBetas = [[1.0, 0.5], [0.9, 0.6]];
    const report = stressTestReport(weights, factorBetas, EQUITY_STRESS_SCENARIOS, 100000);
    expect(report.scenarios.length).toBe(EQUITY_STRESS_SCENARIOS.length);
    expect(report.worstCase).toBeDefined();
  });
});

describe('Correlation Matrix Analytics', () => {
  const m = [genReturns(100), genReturns(100), genReturns(100)];
  const matrix = Array.from({ length: 100 }, (_, i) => [m[0][i], m[1][i], m[2][i]]);
  const symbols = ['A', 'B', 'C'];

  it('returns correlation analytics', () => {
    const a = correlationMatrixAnalytics(matrix, symbols);
    expect(a.matrix.length).toBe(3);
    expect(a.symbols).toEqual(symbols);
    expect(a.avgCorrelation).toBeDefined();
  });
});

describe('Beta Analytics', () => {
  const port = genReturns(252);
  const bm = genReturns(252);

  it('betaAnalytics returns full decomposition', () => {
    const a = betaAnalytics(port, bm);
    expect(a.beta).toBeDefined();
    expect(a.alpha).toBeDefined();
    expect(a.rSquared).toBeGreaterThanOrEqual(0);
  });

  it('rollingBeta returns array', () => {
    const rb = rollingBeta(port, bm, 60);
    expect(rb.length).toBeGreaterThan(0);
  });
});

describe('Risk Decomposition Report', () => {
  const returns = genReturns(252);
  const weights = [0.5, 0.5];
  const symbols = ['A', 'B'];
  const cov = [[0.0001, 0.00005], [0.00005, 0.0001]];

  it('returns component VaRs', () => {
    const r = riskDecompositionReport(returns, weights, symbols, cov);
    expect(r.componentVaRs).toHaveLength(2);
  });
});

describe('Rolling Risk Metrics', () => {
  const port = genReturns(300);
  const bm = genReturns(300);
  const dates = port.map((_, i) => 1609459200000 + i * 86400000);

  it('returns rolling metrics array', () => {
    const rm = rollingRiskMetrics(port, bm, dates, 60);
    expect(rm.length).toBeGreaterThan(0);
    expect(rm[0]).toHaveProperty('volatility');
  });
});

describe('Drawdown Analytics', () => {
  const returns = genReturns(100);
  const dates = returns.map((_, i) => 1609459200000 + i * 86400000);

  it('returns drawdown info', () => {
    const d = drawdownAnalytics(returns, dates);
    expect(d.maxDrawdown).toBeDefined();
    expect(d.drawdowns).toBeDefined();
  });
});

describe('Tail Risk Report', () => {
  it('tailRiskReport returns all metrics', () => {
    const r = tailRiskReport(genReturns(252));
    expect(r.var95).toBeDefined();
    expect(r.ulcerIndex).toBeDefined();
  });
});

describe('Concentration Report', () => {
  it('concentrationReport', () => {
    const r = concentrationReport([0.5, 0.3, 0.2]);
    expect(r.herfindahlIndex).toBeGreaterThan(0);
    expect(r.effectiveNumPositions).toBeLessThanOrEqual(3);
  });
});

describe('Risk Dashboard', () => {
  const returns = genReturns(252);
  const dates = returns.map((_, i) => 1609459200000 + i * 86400000);
  const positions = [
    { symbol: 'A', weight: 0.6, marketValue: 60000 } as any,
    { symbol: 'B', weight: 0.4, marketValue: 40000 } as any,
  ];

  it('buildRiskDashboard returns full dashboard', () => {
    const d = buildRiskDashboard(returns, dates, positions);
    expect(d.metrics).toBeDefined();
    expect(d.varComparison).toBeDefined();
    expect(d.tailRisk).toBeDefined();
  });
});
