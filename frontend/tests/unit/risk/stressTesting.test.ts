import { describe, it, expect } from 'vitest';
import {
  getHistoricalScenarios, getScenarioById,
  buildHypotheticalScenario, buildCorrelationStressScenario,
  buildLiquidityStressScenario, buildSectorStressScenario,
  buildCountryStressScenario, calculateScenarioPnL,
  reverseStressTest, multiFactorStress,
  combinedScenario, compareScenarios, runAllHistoricalScenarios,
} from '../../../src/lib/risk/stressTesting';
import type { Portfolio, StressScenario } from '../../../src/lib/risk/types';

function makePortfolio(): Portfolio {
  return {
    id: 'P1', name: 'Test Portfolio', currency: 'USD', totalValue: 1_000_000,
    historicalReturns: Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.02),
    historicalDates: Array.from({ length: 252 }, (_, i) => Date.now() - (252 - i) * 86_400_000),
    positions: [
      { id: 'POS1', symbol: 'AAPL', quantity: 1000, entryPrice: 150, currentPrice: 155, marketValue: 155_000, weight: 0.31, assetClass: 'equity', currency: 'USD', sector: 'Technology', country: 'US' },
      { id: 'POS2', symbol: 'SPY', quantity: 500, entryPrice: 400, currentPrice: 410, marketValue: 205_000, weight: 0.41, assetClass: 'equity', currency: 'USD', sector: 'Broad Market', country: 'US' },
      { id: 'POS3', symbol: 'TLT', quantity: 200, entryPrice: 120, currentPrice: 118, marketValue: 23_600, weight: 0.047, assetClass: 'interest_rate', currency: 'USD' },
      { id: 'POS4', symbol: 'GLD', quantity: 100, entryPrice: 180, currentPrice: 185, marketValue: 18_500, weight: 0.037, assetClass: 'commodity', currency: 'USD' },
    ],
  };
}

describe('Historical scenarios', () => {
  it('returns predefined historical scenarios', () => {
    const scenarios = getHistoricalScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(7);
    for (const s of scenarios) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.category).toBe('historical');
      expect(s.factorShocks.length).toBeGreaterThan(0);
    }
  });

  it('includes 2008 GFC scenario', () => {
    const gfc = getScenarioById('gfc_2008');
    expect(gfc).toBeDefined();
    expect(gfc!.name).toContain('2008');
    const equityShock = gfc!.factorShocks.find(s => s.factorId === 'equity_us');
    expect(equityShock).toBeDefined();
    expect(equityShock!.shockValue).toBeLessThan(0);
  });

  it('includes COVID-19 scenario', () => {
    const covid = getScenarioById('covid_2020');
    expect(covid).toBeDefined();
    expect(covid!.factorShocks.length).toBeGreaterThanOrEqual(5);
  });

  it('returns undefined for unknown id', () => {
    expect(getScenarioById('nonexistent')).toBeUndefined();
  });

  it('returns deep copies (mutations do not affect originals)', () => {
    const s1 = getHistoricalScenarios();
    s1[0].name = 'MUTATED';
    const s2 = getHistoricalScenarios();
    expect(s2[0].name).not.toBe('MUTATED');
  });
});

describe('Hypothetical scenario builder', () => {
  it('creates scenario with given shocks', () => {
    const scenario = buildHypotheticalScenario('Test Scenario', 'A test', [
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.20 },
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 40 },
    ]);
    expect(scenario.name).toBe('Test Scenario');
    expect(scenario.category).toBe('hypothetical');
    expect(scenario.factorShocks.length).toBe(2);
    expect(scenario.id).toContain('hyp_');
  });

  it('sets custom liquidity multiplier', () => {
    const scenario = buildHypotheticalScenario('Liq Test', '', [], { liquidityMultiplier: 5 });
    expect(scenario.liquidityMultiplier).toBe(5);
  });

  it('sets correlation override', () => {
    const corr = [[1, 0.8], [0.8, 1]];
    const scenario = buildHypotheticalScenario('Corr Test', '', [], { correlationOverride: corr });
    expect(scenario.correlationOverride).toEqual(corr);
  });
});

describe('Correlation stress scenario', () => {
  it('creates correlation override matrix', () => {
    const base = getScenarioById('gfc_2008')!;
    const stressed = buildCorrelationStressScenario(base, 0.9);
    expect(stressed.correlationOverride).toBeDefined();
    const n = base.factorShocks.length;
    expect(stressed.correlationOverride!.length).toBe(n);
    expect(stressed.correlationOverride![0][0]).toBe(1.0);
    expect(stressed.correlationOverride![0][1]).toBe(0.9);
  });
});

describe('Liquidity stress scenario', () => {
  it('amplifies shocks', () => {
    const base = getScenarioById('flash_crash_2010')!;
    const liq = buildLiquidityStressScenario(base, 3.0, 0.7);
    expect(liq.liquidityMultiplier).toBe(3.0);
    for (let i = 0; i < base.factorShocks.length; i++) {
      expect(Math.abs(liq.factorShocks[i].shockValue)).toBeGreaterThanOrEqual(
        Math.abs(base.factorShocks[i].shockValue) * 0.99,
      );
    }
  });
});

describe('Sector stress scenario', () => {
  it('creates sector-specific shocks', () => {
    const scenario = buildSectorStressScenario('Technology', -0.30, 0.02);
    expect(scenario.name).toContain('Technology');
    expect(scenario.factorShocks.length).toBeGreaterThanOrEqual(2);
    const eqShock = scenario.factorShocks.find(s => s.factorType === 'equity');
    expect(eqShock!.shockValue).toBe(-0.30);
  });
});

describe('Country stress scenario', () => {
  it('creates country-specific multi-factor shocks', () => {
    const scenario = buildCountryStressScenario('China', -0.25, -0.05, 0.01);
    expect(scenario.name).toContain('China');
    expect(scenario.factorShocks.length).toBeGreaterThanOrEqual(3);
    const fxShock = scenario.factorShocks.find(s => s.factorType === 'fx');
    expect(fxShock!.shockValue).toBe(-0.05);
  });
});

describe('Scenario P&L calculation', () => {
  it('produces P&L result', () => {
    const portfolio = makePortfolio();
    const scenario = getScenarioById('gfc_2008')!;
    const result = calculateScenarioPnL(portfolio, scenario);
    expect(result).toHaveProperty('pnl');
    expect(result).toHaveProperty('pnlPercent');
    expect(result).toHaveProperty('componentPnl');
    expect(result).toHaveProperty('factorContributions');
    expect(result.scenarioId).toBe('gfc_2008');
  });

  it('GFC scenario produces negative P&L for long equity', () => {
    const portfolio = makePortfolio();
    const scenario = getScenarioById('gfc_2008')!;
    const result = calculateScenarioPnL(portfolio, scenario);
    expect(result.pnl).toBeLessThan(0);
  });

  it('component P&L is populated for each position', () => {
    const portfolio = makePortfolio();
    const scenario = getScenarioById('covid_2020')!;
    const result = calculateScenarioPnL(portfolio, scenario);
    expect(Object.keys(result.componentPnl).length).toBe(portfolio.positions.length);
  });

  it('handles empty portfolio', () => {
    const empty: Portfolio = { id: 'E', name: 'Empty', currency: 'USD', totalValue: 0, positions: [], historicalReturns: [], historicalDates: [] };
    const scenario = getScenarioById('gfc_2008')!;
    const result = calculateScenarioPnL(empty, scenario);
    expect(result.pnl).toBe(0);
  });
});

describe('Reverse stress test', () => {
  it('finds scenario that achieves target loss', () => {
    const portfolio = makePortfolio();
    const targetLoss = -100_000;
    const result = reverseStressTest(portfolio, targetLoss);
    expect(result).toBeDefined();
    expect(result.factorShocks.length).toBeGreaterThan(0);
    expect(result.category).toBe('reverse');
  });
});

describe('Multi-factor stress', () => {
  it('produces P&L grid for two factors', () => {
    const portfolio = makePortfolio();
    const factor1 = { id: 'equity_us', type: 'equity' as const, range: [-0.3, -0.2, -0.1, 0, 0.1] };
    const factor2 = { id: 'ir_us_10y', type: 'interest_rate' as const, range: [-0.02, -0.01, 0, 0.01, 0.02] };
    const result = multiFactorStress(portfolio, factor1, factor2);
    expect(result.factor1Levels.length).toBe(5);
    expect(result.factor2Levels.length).toBe(5);
    expect(result.pnlGrid.length).toBe(5);
    expect(result.pnlGrid[0].length).toBe(5);
  });
});

describe('Combined scenario', () => {
  it('merges multiple scenarios', () => {
    const s1 = buildSectorStressScenario('Tech', -0.2, 0.01);
    const s2 = buildSectorStressScenario('Energy', -0.3, 0.02);
    const combined = combinedScenario([s1, s2], 'Combined Stress');
    expect(combined.name).toBe('Combined Stress');
    const uniqueFactorIds = new Set([...s1.factorShocks, ...s2.factorShocks].map(s => s.factorId));
    expect(combined.factorShocks.length).toBe(uniqueFactorIds.size);
  });
});

describe('Compare scenarios', () => {
  it('compares multiple scenarios', () => {
    const portfolio = makePortfolio();
    const scenarios = [getScenarioById('gfc_2008')!, getScenarioById('covid_2020')!];
    const comparison = compareScenarios(portfolio, scenarios);
    expect(comparison).toHaveProperty('scenarios');
    expect(comparison.scenarios.length).toBe(2);
  });
});

describe('Run all historical scenarios', () => {
  it('returns results for each scenario', () => {
    const portfolio = makePortfolio();
    const results = runAllHistoricalScenarios(portfolio);
    expect(results.length).toBe(getHistoricalScenarios().length);
    for (const r of results) {
      expect(typeof r.pnl).toBe('number');
    }
  });
});
