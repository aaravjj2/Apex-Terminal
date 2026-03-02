import type {
  Portfolio,
  Position,
  StressScenario,
  StressTestResult,
  FactorShock,
  RiskFactorType,
  SensitivityLadder,
  RiskLimit,
} from './types';

// ─── Historical Scenario Library ────────────────────────────────────────────

const HISTORICAL_SCENARIOS: StressScenario[] = [
  {
    id: 'gfc_2008',
    name: '2008 Global Financial Crisis',
    description: 'Lehman Brothers collapse, credit freeze, massive equity selloff Sep-Nov 2008',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.45 },
      { factorId: 'equity_eu', factorType: 'equity', shockType: 'relative', shockValue: -0.50 },
      { factorId: 'equity_em', factorType: 'equity', shockType: 'relative', shockValue: -0.55 },
      { factorId: 'credit_ig', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.035 },
      { factorId: 'credit_hy', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.12 },
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 80 },
      { factorId: 'ir_us_10y', factorType: 'interest_rate', shockType: 'absolute', shockValue: -0.015 },
      { factorId: 'fx_eurusd', factorType: 'fx', shockType: 'relative', shockValue: -0.10 },
      { factorId: 'commodity_oil', factorType: 'commodity', shockType: 'relative', shockValue: -0.65 },
    ],
    liquidityMultiplier: 3.0,
    createdAt: Date.now(),
  },
  {
    id: 'flash_crash_2010',
    name: '2010 Flash Crash',
    description: 'May 6, 2010 intraday crash: DJIA dropped ~1000 points in minutes',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.09 },
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 40 },
      { factorId: 'equity_eu', factorType: 'equity', shockType: 'relative', shockValue: -0.04 },
    ],
    liquidityMultiplier: 5.0,
    createdAt: Date.now(),
  },
  {
    id: 'eu_debt_2011',
    name: '2011 European Debt Crisis',
    description: 'Greek/Italian sovereign debt crisis, euro breakup fears, Aug-Nov 2011',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_eu', factorType: 'equity', shockType: 'relative', shockValue: -0.30 },
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.18 },
      { factorId: 'credit_sovereign_eu', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.04 },
      { factorId: 'fx_eurusd', factorType: 'fx', shockType: 'relative', shockValue: -0.12 },
      { factorId: 'ir_de_10y', factorType: 'interest_rate', shockType: 'absolute', shockValue: -0.012 },
      { factorId: 'credit_hy', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.05 },
    ],
    liquidityMultiplier: 2.5,
    createdAt: Date.now(),
  },
  {
    id: 'china_deval_2015',
    name: '2015 China Devaluation',
    description: 'PBoC CNY devaluation, EM selloff, commodity weakness, Aug 2015',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_china', factorType: 'equity', shockType: 'relative', shockValue: -0.35 },
      { factorId: 'equity_em', factorType: 'equity', shockType: 'relative', shockValue: -0.20 },
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.12 },
      { factorId: 'fx_cny', factorType: 'fx', shockType: 'relative', shockValue: -0.04 },
      { factorId: 'commodity_oil', factorType: 'commodity', shockType: 'relative', shockValue: -0.30 },
      { factorId: 'commodity_metals', factorType: 'commodity', shockType: 'relative', shockValue: -0.20 },
    ],
    liquidityMultiplier: 2.0,
    createdAt: Date.now(),
  },
  {
    id: 'volmageddon_2018',
    name: '2018 Volmageddon',
    description: 'Feb 5, 2018 VIX spike and collapse of short-vol products (XIV)',
    category: 'historical',
    factorShocks: [
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 50 },
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.10 },
      { factorId: 'equity_eu', factorType: 'equity', shockType: 'relative', shockValue: -0.08 },
      { factorId: 'ir_us_2y', factorType: 'interest_rate', shockType: 'absolute', shockValue: 0.005 },
    ],
    liquidityMultiplier: 4.0,
    createdAt: Date.now(),
  },
  {
    id: 'covid_2020',
    name: '2020 COVID-19 Crash',
    description: 'Global pandemic selloff, Feb-Mar 2020, fastest bear market in history',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.34 },
      { factorId: 'equity_eu', factorType: 'equity', shockType: 'relative', shockValue: -0.38 },
      { factorId: 'equity_em', factorType: 'equity', shockType: 'relative', shockValue: -0.30 },
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 82 },
      { factorId: 'credit_ig', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.025 },
      { factorId: 'credit_hy', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.08 },
      { factorId: 'commodity_oil', factorType: 'commodity', shockType: 'relative', shockValue: -0.60 },
      { factorId: 'ir_us_10y', factorType: 'interest_rate', shockType: 'absolute', shockValue: -0.014 },
      { factorId: 'fx_em', factorType: 'fx', shockType: 'relative', shockValue: -0.15 },
    ],
    liquidityMultiplier: 4.5,
    createdAt: Date.now(),
  },
  {
    id: 'crypto_winter_2022',
    name: '2022 Crypto Winter',
    description: 'Terra/Luna collapse, 3AC/FTX contagion, BTC -65% from peak',
    category: 'historical',
    factorShocks: [
      { factorId: 'crypto_btc', factorType: 'equity', shockType: 'relative', shockValue: -0.65 },
      { factorId: 'crypto_eth', factorType: 'equity', shockType: 'relative', shockValue: -0.70 },
      { factorId: 'crypto_altcoins', factorType: 'equity', shockType: 'relative', shockValue: -0.85 },
      { factorId: 'equity_tech', factorType: 'equity', shockType: 'relative', shockValue: -0.25 },
    ],
    liquidityMultiplier: 6.0,
    createdAt: Date.now(),
  },
  {
    id: 'svb_2023',
    name: '2023 SVB/Banking Crisis',
    description: 'SVB, Signature Bank, Credit Suisse failures, Mar 2023',
    category: 'historical',
    factorShocks: [
      { factorId: 'equity_banks', factorType: 'equity', shockType: 'relative', shockValue: -0.25 },
      { factorId: 'equity_regional_banks', factorType: 'equity', shockType: 'relative', shockValue: -0.40 },
      { factorId: 'credit_banks', factorType: 'credit_spread', shockType: 'absolute', shockValue: 0.02 },
      { factorId: 'ir_us_2y', factorType: 'interest_rate', shockType: 'absolute', shockValue: -0.01 },
      { factorId: 'vol_vix', factorType: 'volatility', shockType: 'override', shockValue: 30 },
      { factorId: 'equity_us', factorType: 'equity', shockType: 'relative', shockValue: -0.05 },
    ],
    liquidityMultiplier: 2.5,
    createdAt: Date.now(),
  },
];

export function getHistoricalScenarios(): StressScenario[] {
  return HISTORICAL_SCENARIOS.map(s => ({ ...s, factorShocks: [...s.factorShocks] }));
}

export function getScenarioById(id: string): StressScenario | undefined {
  return HISTORICAL_SCENARIOS.find(s => s.id === id);
}

// ─── Hypothetical Scenario Builder ──────────────────────────────────────────

export function buildHypotheticalScenario(
  name: string,
  description: string,
  shocks: FactorShock[],
  options?: {
    correlationOverride?: number[][];
    liquidityMultiplier?: number;
  },
): StressScenario {
  return {
    id: `hyp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    category: 'hypothetical',
    factorShocks: shocks,
    correlationOverride: options?.correlationOverride,
    liquidityMultiplier: options?.liquidityMultiplier ?? 1.0,
    createdAt: Date.now(),
  };
}

export function buildCorrelationStressScenario(
  baseScenario: StressScenario,
  targetCorrelation: number = 1.0,
): StressScenario {
  const n = baseScenario.factorShocks.length;
  const corrMatrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1.0 : targetCorrelation)),
  );

  return {
    ...baseScenario,
    id: `corr_stress_${baseScenario.id}`,
    name: `${baseScenario.name} (Correlation = ${targetCorrelation})`,
    description: `${baseScenario.description} with correlations overridden to ${targetCorrelation}`,
    category: 'hypothetical',
    correlationOverride: corrMatrix,
  };
}

export function buildLiquidityStressScenario(
  baseScenario: StressScenario,
  spreadMultiplier: number = 3.0,
  depthReduction: number = 0.7,
): StressScenario {
  const amplifiedShocks = baseScenario.factorShocks.map(s => ({
    ...s,
    shockValue: s.shockType === 'relative'
      ? s.shockValue * (1 + depthReduction * 0.5)
      : s.shockValue * (1 + spreadMultiplier * 0.2),
  }));

  return {
    ...baseScenario,
    id: `liq_stress_${baseScenario.id}`,
    name: `${baseScenario.name} (Liquidity Stress)`,
    description: `${baseScenario.description} with spread ${spreadMultiplier}x wider and depth reduced ${(depthReduction * 100).toFixed(0)}%`,
    category: 'hypothetical',
    factorShocks: amplifiedShocks,
    liquidityMultiplier: spreadMultiplier,
  };
}

export function buildSectorStressScenario(
  sectorName: string,
  equityShock: number,
  creditSpreadWiden: number,
): StressScenario {
  return {
    id: `sector_${sectorName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    name: `${sectorName} Sector Stress`,
    description: `Stress scenario targeting the ${sectorName} sector`,
    category: 'hypothetical',
    factorShocks: [
      { factorId: `equity_${sectorName.toLowerCase()}`, factorType: 'equity', shockType: 'relative', shockValue: equityShock },
      { factorId: `credit_${sectorName.toLowerCase()}`, factorType: 'credit_spread', shockType: 'absolute', shockValue: creditSpreadWiden },
      { factorId: 'vol_sector', factorType: 'volatility', shockType: 'relative', shockValue: Math.abs(equityShock) * 2 },
    ],
    liquidityMultiplier: 1.5,
    createdAt: Date.now(),
  };
}

export function buildCountryStressScenario(
  countryName: string,
  equityShock: number,
  fxShock: number,
  rateShock: number,
): StressScenario {
  return {
    id: `country_${countryName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    name: `${countryName} Country Stress`,
    description: `Stress scenario for ${countryName} covering equities, FX, and rates`,
    category: 'hypothetical',
    factorShocks: [
      { factorId: `equity_${countryName.toLowerCase()}`, factorType: 'equity', shockType: 'relative', shockValue: equityShock },
      { factorId: `fx_${countryName.toLowerCase()}`, factorType: 'fx', shockType: 'relative', shockValue: fxShock },
      { factorId: `ir_${countryName.toLowerCase()}_10y`, factorType: 'interest_rate', shockType: 'absolute', shockValue: rateShock },
      { factorId: `credit_${countryName.toLowerCase()}`, factorType: 'credit_spread', shockType: 'absolute', shockValue: Math.abs(equityShock) * 0.05 },
    ],
    liquidityMultiplier: 2.0,
    createdAt: Date.now(),
  };
}

// ─── Scenario P&L Calculation ───────────────────────────────────────────────

export function calculateScenarioPnL(
  portfolio: Portfolio,
  scenario: StressScenario,
): StressTestResult {
  let totalPnl = 0;
  const componentPnl: Record<string, number> = {};
  const factorContributions: Record<string, number> = {};

  for (const shock of scenario.factorShocks) {
    factorContributions[shock.factorId] = 0;
  }

  for (const position of portfolio.positions) {
    let positionPnl = 0;

    for (const shock of scenario.factorShocks) {
      const exposure = getPositionExposure(position, shock);
      let shockPnl: number;

      switch (shock.shockType) {
        case 'relative':
          shockPnl = exposure * shock.shockValue;
          break;
        case 'absolute':
          shockPnl = position.quantity * shock.shockValue;
          break;
        case 'override':
          shockPnl = exposure * ((shock.shockValue / (position.currentPrice || 1)) - 1);
          break;
        default:
          shockPnl = 0;
      }

      if (position.Greeks) {
        const dS = position.currentPrice * (shock.shockType === 'relative' ? shock.shockValue : shock.shockValue / position.currentPrice);
        const greekPnl = (position.Greeks.delta ?? 0) * dS
                       + 0.5 * (position.Greeks.gamma ?? 0) * dS * dS;
        shockPnl = greekPnl * position.quantity;
      }

      positionPnl += shockPnl;
      factorContributions[shock.factorId] = (factorContributions[shock.factorId] ?? 0) + shockPnl;
    }

    if (scenario.liquidityMultiplier && scenario.liquidityMultiplier > 1) {
      const liquidityCost = Math.abs(positionPnl) * (scenario.liquidityMultiplier - 1) * 0.01;
      positionPnl -= liquidityCost;
    }

    componentPnl[position.id] = positionPnl;
    totalPnl += positionPnl;
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    portfolioId: portfolio.id,
    pnl: totalPnl,
    pnlPercent: portfolio.totalValue !== 0 ? totalPnl / portfolio.totalValue : 0,
    componentPnl,
    factorContributions,
    breachedLimits: [],
    timestamp: Date.now(),
  };
}

function getPositionExposure(position: Position, shock: FactorShock): number {
  const factorType = shock.factorType;

  if (position.assetClass === factorType) return position.marketValue;

  if (factorType === 'volatility' && position.Greeks?.vega) {
    return position.Greeks.vega * position.quantity;
  }
  if (factorType === 'interest_rate' && position.Greeks?.rho) {
    return position.Greeks.rho * position.quantity;
  }

  const sectorMatch = shock.factorId.includes(position.sector?.toLowerCase() ?? '__none__');
  const countryMatch = shock.factorId.includes(position.country?.toLowerCase() ?? '__none__');
  if (sectorMatch || countryMatch) return position.marketValue * 0.5;

  return 0;
}

// ─── Stress Test with Limit Checking ────────────────────────────────────────

export function stressTestWithLimits(
  portfolio: Portfolio,
  scenario: StressScenario,
  limits: RiskLimit[],
): StressTestResult {
  const result = calculateScenarioPnL(portfolio, scenario);

  const stressedValue = portfolio.totalValue + result.pnl;

  for (const limit of limits) {
    let breached = false;

    switch (limit.type) {
      case 'loss':
        breached = Math.abs(result.pnl) > limit.limitValue;
        break;
      case 'stress':
        breached = Math.abs(result.pnlPercent) > limit.limitValue;
        break;
      case 'notional':
        breached = stressedValue > limit.limitValue || stressedValue < -limit.limitValue;
        break;
      default:
        break;
    }

    if (breached) result.breachedLimits.push(limit.id);
  }

  return result;
}

// ─── Reverse Stress Testing ─────────────────────────────────────────────────

export function reverseStressTest(
  portfolio: Portfolio,
  targetLoss: number,
  factorTypes: RiskFactorType[] = ['equity', 'credit_spread', 'interest_rate', 'fx'],
  maxIterations: number = 100,
): StressScenario {
  let shockMultiplier = 0.01;
  let bestScenario: StressScenario | null = null;
  let bestDiff = Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    const shocks: FactorShock[] = factorTypes.map(ft => ({
      factorId: `reverse_${ft}`,
      factorType: ft,
      shockType: 'relative' as const,
      shockValue: -shockMultiplier,
    }));

    const scenario: StressScenario = {
      id: `reverse_${iter}`,
      name: `Reverse Stress (iter ${iter})`,
      description: `Reverse stress test targeting loss of ${targetLoss}`,
      category: 'reverse',
      factorShocks: shocks,
      createdAt: Date.now(),
    };

    const result = calculateScenarioPnL(portfolio, scenario);
    const diff = Math.abs(Math.abs(result.pnl) - targetLoss);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestScenario = scenario;
    }

    if (diff < targetLoss * 0.01) break;

    const ratio = targetLoss / Math.max(Math.abs(result.pnl), 1);
    shockMultiplier *= Math.sqrt(ratio);
    shockMultiplier = Math.min(shockMultiplier, 1.0);
  }

  return bestScenario ?? {
    id: 'reverse_failed',
    name: 'Reverse Stress (no convergence)',
    description: `Failed to find scenario matching target loss ${targetLoss}`,
    category: 'reverse',
    factorShocks: [],
    createdAt: Date.now(),
  };
}

// ─── Sensitivity Ladder ─────────────────────────────────────────────────────

export function generateSensitivityLadder(
  portfolio: Portfolio,
  factorId: string,
  factorType: RiskFactorType,
  shockLevels: number[] = [-0.20, -0.15, -0.10, -0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.05, 0.10, 0.15, 0.20],
): SensitivityLadder {
  const pnlResults = shockLevels.map(shock => {
    const scenario: StressScenario = {
      id: `ladder_${factorId}_${shock}`,
      name: `${factorId} ${(shock * 100).toFixed(1)}%`,
      description: '',
      category: 'hypothetical',
      factorShocks: [{ factorId, factorType, shockType: 'relative', shockValue: shock }],
      createdAt: Date.now(),
    };
    return calculateScenarioPnL(portfolio, scenario).pnl;
  });

  return { factorId, factorName: factorId, shockLevels, pnlResults };
}

// ─── Multi-Factor Stress ────────────────────────────────────────────────────

export function multiFactorStress(
  portfolio: Portfolio,
  factor1: { id: string; type: RiskFactorType; range: number[] },
  factor2: { id: string; type: RiskFactorType; range: number[] },
): { factor1Levels: number[]; factor2Levels: number[]; pnlGrid: number[][] } {
  const pnlGrid: number[][] = [];

  for (const s1 of factor1.range) {
    const row: number[] = [];
    for (const s2 of factor2.range) {
      const scenario: StressScenario = {
        id: `multi_${s1}_${s2}`,
        name: `Multi-factor ${s1}/${s2}`,
        description: '',
        category: 'hypothetical',
        factorShocks: [
          { factorId: factor1.id, factorType: factor1.type, shockType: 'relative', shockValue: s1 },
          { factorId: factor2.id, factorType: factor2.type, shockType: 'relative', shockValue: s2 },
        ],
        createdAt: Date.now(),
      };
      row.push(calculateScenarioPnL(portfolio, scenario).pnl);
    }
    pnlGrid.push(row);
  }

  return { factor1Levels: factor1.range, factor2Levels: factor2.range, pnlGrid };
}

// ─── Combined / Sequential Scenarios ────────────────────────────────────────

export function combinedScenario(
  scenarios: StressScenario[],
  name: string,
): StressScenario {
  const allShocks: FactorShock[] = [];
  const shockMap = new Map<string, FactorShock>();

  for (const scenario of scenarios) {
    for (const shock of scenario.factorShocks) {
      const existing = shockMap.get(shock.factorId);
      if (existing) {
        if (shock.shockType === 'relative' && existing.shockType === 'relative') {
          existing.shockValue = (1 + existing.shockValue) * (1 + shock.shockValue) - 1;
        } else if (shock.shockType === 'absolute' && existing.shockType === 'absolute') {
          existing.shockValue += shock.shockValue;
        } else {
          existing.shockValue = shock.shockValue;
          existing.shockType = shock.shockType;
        }
      } else {
        shockMap.set(shock.factorId, { ...shock });
      }
    }
  }

  shockMap.forEach(s => allShocks.push(s));

  const maxLiqMultiplier = Math.max(...scenarios.map(s => s.liquidityMultiplier ?? 1));

  return {
    id: `combined_${Date.now()}`,
    name,
    description: `Combined scenario from: ${scenarios.map(s => s.name).join(', ')}`,
    category: 'hypothetical',
    factorShocks: allShocks,
    liquidityMultiplier: maxLiqMultiplier,
    createdAt: Date.now(),
  };
}

export function sequentialScenarioPnL(
  portfolio: Portfolio,
  scenarios: StressScenario[],
): { steps: StressTestResult[]; cumulativePnl: number[] } {
  const steps: StressTestResult[] = [];
  const cumulativePnl: number[] = [];
  let runningPortfolio = { ...portfolio };
  let cumPnl = 0;

  for (const scenario of scenarios) {
    const result = calculateScenarioPnL(runningPortfolio, scenario);
    steps.push(result);
    cumPnl += result.pnl;
    cumulativePnl.push(cumPnl);

    runningPortfolio = {
      ...runningPortfolio,
      totalValue: runningPortfolio.totalValue + result.pnl,
      positions: runningPortfolio.positions.map(p => ({
        ...p,
        currentPrice: p.currentPrice * (1 + (result.componentPnl[p.id] ?? 0) / p.marketValue),
        marketValue: p.marketValue + (result.componentPnl[p.id] ?? 0),
      })),
    };
  }

  return { steps, cumulativePnl };
}

// ─── Scenario Comparison ────────────────────────────────────────────────────

export interface ScenarioComparison {
  scenarios: string[];
  pnl: number[];
  pnlPercent: number[];
  worstCase: string;
  bestCase: string;
  averagePnl: number;
  componentComparison: Record<string, Record<string, number>>;
}

export function compareScenarios(
  portfolio: Portfolio,
  scenarios: StressScenario[],
): ScenarioComparison {
  const results = scenarios.map(s => calculateScenarioPnL(portfolio, s));
  const pnls = results.map(r => r.pnl);
  const pnlPercents = results.map(r => r.pnlPercent);
  const names = scenarios.map(s => s.name);

  const worstIdx = pnls.indexOf(Math.min(...pnls));
  const bestIdx = pnls.indexOf(Math.max(...pnls));

  const componentComparison: Record<string, Record<string, number>> = {};
  for (let i = 0; i < results.length; i++) {
    for (const [posId, pnl] of Object.entries(results[i].componentPnl)) {
      if (!componentComparison[posId]) componentComparison[posId] = {};
      componentComparison[posId][names[i]] = pnl;
    }
  }

  return {
    scenarios: names,
    pnl: pnls,
    pnlPercent: pnlPercents,
    worstCase: names[worstIdx],
    bestCase: names[bestIdx],
    averagePnl: pnls.reduce((s, p) => s + p, 0) / pnls.length,
    componentComparison,
  };
}

// ─── Concentration Stress ───────────────────────────────────────────────────

export function concentrationStress(
  portfolio: Portfolio,
  topNPositions: number = 5,
  shock: number = -0.30,
): StressTestResult {
  const sorted = [...portfolio.positions].sort(
    (a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue),
  );
  const topN = sorted.slice(0, topNPositions);

  const shocks: FactorShock[] = topN.map(p => ({
    factorId: p.symbol,
    factorType: p.assetClass,
    shockType: 'relative' as const,
    shockValue: shock,
  }));

  const scenario: StressScenario = {
    id: `concentration_top${topNPositions}`,
    name: `Top ${topNPositions} Concentration Stress (${(shock * 100).toFixed(0)}%)`,
    description: `Shock applied to top ${topNPositions} positions by absolute market value`,
    category: 'hypothetical',
    factorShocks: shocks,
    createdAt: Date.now(),
  };

  return calculateScenarioPnL(portfolio, scenario);
}

// ─── Run All Historical Scenarios ───────────────────────────────────────────

export function runAllHistoricalScenarios(
  portfolio: Portfolio,
): StressTestResult[] {
  return HISTORICAL_SCENARIOS.map(scenario => calculateScenarioPnL(portfolio, scenario));
}

export function worstCaseScenario(
  portfolio: Portfolio,
  scenarios?: StressScenario[],
): { scenario: StressScenario; result: StressTestResult } | null {
  const scenariosToTest = scenarios ?? HISTORICAL_SCENARIOS;
  if (scenariosToTest.length === 0) return null;

  let worstResult: StressTestResult | null = null;
  let worstScenario: StressScenario | null = null;

  for (const scenario of scenariosToTest) {
    const result = calculateScenarioPnL(portfolio, scenario);
    if (!worstResult || result.pnl < worstResult.pnl) {
      worstResult = result;
      worstScenario = scenario;
    }
  }

  return worstScenario && worstResult
    ? { scenario: worstScenario, result: worstResult }
    : null;
}
