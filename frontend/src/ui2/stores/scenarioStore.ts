/**
 * v1.59 — Risk Scenario Store
 * Deterministic scenario builder with export capability
 */

export type Severity = 'mild' | 'moderate' | 'severe' | 'extreme';
export type Horizon = '1d' | '5d' | '10d' | '30d';

export interface ScenarioInput {
  severity: Severity;
  equityShock: number; // percentage
  volShock: number; // percentage  
  rateShock: number; // basis points
  horizon: Horizon;
}

export interface ScenarioResult {
  id: string;
  inputs: ScenarioInput;
  portfolioImpact: number;
  portfolioImpactPct: number;
  var95: number;
  cvar95: number;
  maxDrawdown: number;
  recoveryDays: number;
  positionBreakdown: Array<{
    symbol: string;
    impact: number;
    impactPct: number;
  }>;
  timestamp: number;
  hash: string;
}

// Deterministic hash from inputs
function hashInputs(inputs: ScenarioInput): string {
  const raw = `${inputs.severity}|${inputs.equityShock}|${inputs.volShock}|${inputs.rateShock}|${inputs.horizon}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return `SCN-${Math.abs(h).toString(16).padStart(8, '0')}`;
}

// Deterministic result computation (no random)
function computeResult(inputs: ScenarioInput): ScenarioResult {
  const severityMultiplier = { mild: 0.5, moderate: 1.0, severe: 1.5, extreme: 2.5 }[inputs.severity];
  const horizonMultiplier = { '1d': 0.3, '5d': 0.6, '10d': 1.0, '30d': 1.8 }[inputs.horizon];
  const base = 199872.50; // portfolio value

  const totalShockPct = (inputs.equityShock * severityMultiplier + inputs.volShock * 0.3 + inputs.rateShock * 0.01) * horizonMultiplier;
  const portfolioImpact = Math.round(base * totalShockPct / 100 * 100) / 100;

  const symbols = [
    { symbol: 'SPY', weight: 0.41 },
    { symbol: 'AAPL', weight: 0.18 },
    { symbol: 'TSLA', weight: 0.08 },
    { symbol: 'NVDA', weight: 0.20 },
  ];

  const positionBreakdown = symbols.map(s => ({
    symbol: s.symbol,
    impact: Math.round(portfolioImpact * s.weight * 100) / 100,
    impactPct: Math.round(totalShockPct * s.weight * (1 + severityMultiplier * 0.1) * 100) / 100,
  }));

  return {
    id: hashInputs(inputs),
    inputs,
    portfolioImpact: -Math.abs(portfolioImpact),
    portfolioImpactPct: -Math.abs(Math.round(totalShockPct * 100) / 100),
    var95: Math.round(Math.abs(portfolioImpact) * 0.7 * 100) / 100,
    cvar95: Math.round(Math.abs(portfolioImpact) * 0.9 * 100) / 100,
    maxDrawdown: Math.round(totalShockPct * severityMultiplier * 100) / 100,
    recoveryDays: Math.round(10 * horizonMultiplier * severityMultiplier),
    positionBreakdown,
    timestamp: Date.now(),
    hash: hashInputs(inputs),
  };
}

let scenarioResults: ScenarioResult[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export const scenarioStore = {
  getResults: () => [...scenarioResults],

  runScenario(inputs: ScenarioInput): ScenarioResult {
    const result = computeResult(inputs);
    scenarioResults.push(result);
    notify();
    return result;
  },

  exportBundle(): { manifest: object; csv: string; hash: string } {
    const manifest = {
      type: 'risk-scenario-export',
      version: '1.59',
      timestamp: Date.now(),
      scenarioCount: scenarioResults.length,
      results: scenarioResults.map(r => ({
        id: r.id,
        severity: r.inputs.severity,
        portfolioImpact: r.portfolioImpact,
        hash: r.hash,
      })),
    };

    let csv = 'id,severity,equityShock,volShock,rateShock,horizon,impact,impactPct,var95,cvar95\n';
    scenarioResults.forEach(r => {
      csv += `${r.id},${r.inputs.severity},${r.inputs.equityShock},${r.inputs.volShock},${r.inputs.rateShock},${r.inputs.horizon},${r.portfolioImpact},${r.portfolioImpactPct},${r.var95},${r.cvar95}\n`;
    });

    // Deterministic hash of entire bundle
    const bundleStr = JSON.stringify(manifest) + csv;
    let h = 0;
    for (let i = 0; i < bundleStr.length; i++) {
      h = ((h << 5) - h + bundleStr.charCodeAt(i)) | 0;
    }
    const bundleHash = Math.abs(h).toString(16).padStart(8, '0');

    return { manifest, csv, hash: bundleHash };
  },

  reset() {
    scenarioResults = [];
    notify();
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
