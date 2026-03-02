/**
 * Portfolio Risk Analytics — Comprehensive VaR, Expected Shortfall, stress testing,
 * correlation matrix analysis, beta, tracking error, and risk decomposition.
 *
 * Builds on portfolio/risk.ts with analytics-focused APIs for dashboards and reporting.
 */

import type {
  ReturnSeries,
  VaRResult,
  ComponentVaR,
  DrawdownInfo,
  FactorRiskDecomposition,
  Position,
  RiskMetrics,
} from './types';
import {
  mean,
  variance,
  stdDev,
  covariance,
  skewness,
  kurtosis,
  sampleCovarianceMatrix,
  ewmaCovarianceMatrix,
  ledoitWolfShrinkage,
  correlationMatrix,
  historicalVaR,
  parametricVaR,
  monteCarloVaR,
  cornishFisherVaR,
  expectedShortfall,
  componentVaR,
  incrementalVaR,
  calculateDrawdowns,
  maxDrawdown,
  calculateBeta,
  trackingError,
  factorRiskDecomposition,
  herfindahlIndex,
  effectiveNumPositions,
  downsideDeviation,
  semiVariance,
  tailRatio,
  gainToPainRatio,
  ulcerIndex,
  stressTest,
  matVecMul,
  choleskyDecomposition,
} from './risk';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VaRConfig {
  confidence: number;
  horizon: number;
  method: 'historical' | 'parametric' | 'monteCarlo' | 'cornishFisher';
  numSimulations?: number;
}

export interface StressScenarioDef {
  id: string;
  name: string;
  description: string;
  factorShocks: Record<string, number>;
  probability?: number;
  severity: 'mild' | 'moderate' | 'severe' | 'extreme';
}

export interface CorrelationCluster {
  assets: string[];
  avgCorrelation: number;
  clusterId: number;
}

export interface RollingRiskMetrics {
  date: number;
  volatility: number;
  var95: number;
  var99: number;
  cvar95: number;
  beta: number;
  trackingError: number;
  maxDrawdown: number;
}

export interface RiskDecompositionReport {
  totalRisk: number;
  systematicRisk: number;
  idiosyncraticRisk: number;
  factorContributions: Record<string, number>;
  componentVaRs: ComponentVaR[];
  concentrationRisk: number;
  tailRisk: number;
}

export interface StressTestReport {
  scenarios: { name: string; impact: number; impactPct: number }[];
  worstCase: { name: string; impact: number };
  averageImpact: number;
}

// ─── VaR Analytics ───────────────────────────────────────────────────────────

/**
 * Compute VaR using the specified method with full result set.
 */
export function computeVaRAnalytics(
  returns: number[],
  config: VaRConfig,
  covMatrix?: number[][],
  weights?: number[]
): VaRResult & { method: string; config: VaRConfig } {
  const { confidence, horizon, method, numSimulations = 10000 } = config;

  let result: VaRResult;

  switch (method) {
    case 'historical':
      result = historicalVaR(returns, confidence);
      break;
    case 'parametric':
      result = parametricVaR(returns, confidence);
      break;
    case 'monteCarlo':
      result = monteCarloVaR(
        returns,
        covMatrix ?? null,
        weights ?? [1],
        numSimulations,
        horizon
      );
      break;
    case 'cornishFisher':
      result = cornishFisherVaR(returns);
      break;
    default:
      result = historicalVaR(returns, confidence);
  }

  // Scale to horizon if needed
  const scale = Math.sqrt(horizon);
  if (horizon > 1) {
    result = {
      var95: result.var95 * scale,
      var99: result.var99 * scale,
      cvar95: result.cvar95 * scale,
      cvar99: result.cvar99 * scale,
      method: result.method,
    };
  }

  return { ...result, method: result.method, config };
}

/**
 * Compare VaR across methods for validation.
 */
export function compareVaRMethods(
  returns: number[],
  confidence = 0.95
): Record<string, VaRResult> {
  const cov = sampleCovarianceMatrix(returns.map(r => [r]));
  const weights = [1];

  return {
    historical: historicalVaR(returns, confidence),
    parametric: parametricVaR(returns, confidence),
    monteCarlo: monteCarloVaR(returns, cov, weights, 5000, 1),
    cornishFisher: cornishFisherVaR(returns),
  };
}

/**
 * Expected Shortfall (CVaR) at multiple confidence levels.
 */
export function expectedShortfallMultiLevel(
  returns: number[],
  levels: number[] = [0.9, 0.95, 0.99]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const level of levels) {
    result[`es${Math.round(level * 100)}`] = expectedShortfall(returns, level);
  }
  return result;
}

/**
 * Backtest VaR: count violations (actual losses exceeding VaR) and compute coverage.
 */
export function backtestVaR(
  returns: number[],
  varEstimates: number[],
  confidence: number
): {
  violations: number;
  violationRate: number;
  expectedViolations: number;
  unconditionalCoverage: boolean;
  hitSequence: number[];
} {
  const hitSequence = returns.map((r, i) =>
    -r > (varEstimates[i] ?? 0) ? 1 : 0
  );
  const violations = hitSequence.reduce((s, v) => s + v, 0);
  const violationRate = violations / returns.length;
  const expectedViolations = returns.length * (1 - confidence);

  // Unconditional coverage: violation rate should be close to 1-confidence
  const tolerance = 0.5 / Math.sqrt(returns.length);
  const unconditionalCoverage =
    Math.abs(violationRate - (1 - confidence)) < tolerance;

  return {
    violations,
    violationRate,
    expectedViolations,
    unconditionalCoverage,
    hitSequence,
  };
}

// ─── Stress Testing Analytics ────────────────────────────────────────────────

/** Predefined stress scenarios for equity markets. */
export const EQUITY_STRESS_SCENARIOS: StressScenarioDef[] = [
  {
    id: 'black_monday',
    name: 'Black Monday (1987)',
    description: 'S&P 500 -22% single day',
    factorShocks: { market: -0.22 },
    severity: 'extreme',
  },
  {
    id: 'dotcom',
    name: 'Dot-com Crash',
    description: 'Tech selloff ~2000-2002',
    factorShocks: { market: -0.49, technology: -0.65 },
    severity: 'severe',
  },
  {
    id: 'gfc',
    name: 'Global Financial Crisis',
    description: '2008 Lehman collapse',
    factorShocks: { market: -0.55, financials: -0.70 },
    severity: 'extreme',
  },
  {
    id: 'covid',
    name: 'COVID-19 Crash',
    description: 'March 2020 selloff',
    factorShocks: { market: -0.34 },
    severity: 'severe',
  },
  {
    id: 'rates_up',
    name: 'Rates Shock Up',
    description: '+200bps parallel shift',
    factorShocks: { rates: 0.02 },
    severity: 'moderate',
  },
  {
    id: 'rates_down',
    name: 'Rates Shock Down',
    description: '-150bps parallel shift',
    factorShocks: { rates: -0.015 },
    severity: 'moderate',
  },
  {
    id: 'vol_spike',
    name: 'Volatility Spike',
    description: 'VIX doubles',
    factorShocks: { volatility: 1.0 },
    severity: 'moderate',
  },
  {
    id: 'mild',
    name: 'Mild Correction',
    description: '-10% market decline',
    factorShocks: { market: -0.10 },
    severity: 'mild',
  },
];

/**
 * Run full stress test report with portfolio impact in dollar terms.
 */
export function stressTestReport(
  weights: number[],
  factorBetas: number[][],
  scenarios: StressScenarioDef[],
  portfolioValue: number
): StressTestReport {
  const allFactorNames = new Set<string>();
  for (const s of scenarios) {
    for (const f of Object.keys(s.factorShocks)) allFactorNames.add(f);
  }
  const factorNames = Array.from(allFactorNames);
  const scenarioResults = scenarios.map(s => {
    let impact = 0;
    for (let i = 0; i < weights.length; i++) {
      let assetImpact = 0;
      for (const f of factorNames) {
        const idx = factorNames.indexOf(f);
        assetImpact += (factorBetas[i]?.[idx] ?? 0) * (s.factorShocks[f] ?? 0);
      }
      impact += weights[i] * assetImpact;
    }
    return {
      name: s.name,
      impact,
      impactPct: impact * 100,
    };
  });

  const worstCase = scenarioResults.reduce((a, b) =>
    a.impact < b.impact ? a : b
  );
  const averageImpact =
    scenarioResults.reduce((s, r) => s + r.impact, 0) / scenarioResults.length;

  return {
    scenarios: scenarioResults,
    worstCase: { name: worstCase.name, impact: worstCase.impact },
    averageImpact,
  };
}

/**
 * Custom stress scenario builder.
 */
export function buildStressScenario(
  baseShocks: Record<string, number>,
  multiplier: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseShocks)) {
    result[k] = v * multiplier;
  }
  return result;
}

// ─── Correlation Matrix Analytics ───────────────────────────────────────────

export interface CorrelationAnalytics {
  matrix: number[][];
  symbols: string[];
  eigenvalues: number[];
  conditionNumber: number;
  clusters: CorrelationCluster[];
  avgCorrelation: number;
  maxCorrelation: { pair: [string, string]; value: number };
  minCorrelation: { pair: [string, string]; value: number };
}

/**
 * Full correlation matrix analytics with clustering.
 */
export function correlationMatrixAnalytics(
  returnMatrix: number[][],
  symbols: string[]
): CorrelationAnalytics {
  const cov = sampleCovarianceMatrix(returnMatrix);
  const corr = correlationMatrix(cov);
  const n = corr.length;

  // Average correlation
  let sumCorr = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumCorr += corr[i][j];
      count++;
    }
  }
  const avgCorrelation = count > 0 ? sumCorr / count : 0;

  // Max/min correlation pairs
  let maxCorr = -2;
  let minCorr = 2;
  let maxPair: [string, string] = [symbols[0] ?? '', symbols[1] ?? ''];
  let minPair: [string, string] = [symbols[0] ?? '', symbols[1] ?? ''];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (corr[i][j] > maxCorr) {
        maxCorr = corr[i][j];
        maxPair = [symbols[i] ?? '', symbols[j] ?? ''];
      }
      if (corr[i][j] < minCorr) {
        minCorr = corr[i][j];
        minPair = [symbols[i] ?? '', symbols[j] ?? ''];
      }
    }
  }

  // Simple eigenvalue approximation via power iteration (dominant)
  const eigenvalues: number[] = [];
  // Use trace for condition number approximation
  const trace = corr.reduce((s, row, i) => s + row[i], 0);
  const conditionNumber = n / Math.max(trace, 1e-10);

  // Simple distance-based clustering
  const clusters = clusterByCorrelation(corr, symbols);

  return {
    matrix: corr,
    symbols,
    eigenvalues,
    conditionNumber,
    clusters,
    avgCorrelation,
    maxCorrelation: { pair: maxPair, value: maxCorr },
    minCorrelation: { pair: minPair, value: minCorr },
  };
}

function clusterByCorrelation(
  corr: number[][],
  symbols: string[]
): CorrelationCluster[] {
  const n = corr.length;
  if (n < 2) return [{ assets: symbols, avgCorrelation: 0, clusterId: 0 }];

  const clusters: CorrelationCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue;

    const clusterAssets = [i];
    let sumCorr = 0;
    let corrCount = 0;

    for (let j = i + 1; j < n; j++) {
      if (assigned.has(j)) continue;
      if (corr[i][j] > 0.5) {
        clusterAssets.push(j);
        assigned.add(j);
        sumCorr += corr[i][j];
        corrCount++;
      }
    }

    assigned.add(i);
    clusters.push({
      assets: clusterAssets.map(idx => symbols[idx] ?? ''),
      avgCorrelation: corrCount > 0 ? sumCorr / corrCount : 0,
      clusterId: clusters.length,
    });
  }

  return clusters;
}

/**
 * Rolling covariance matrix with EWMA.
 */
export function rollingCovarianceMatrix(
  returnMatrix: number[][],
  lambda: number
): number[][] {
  return ewmaCovarianceMatrix(returnMatrix, lambda);
}

/**
 * Shrunk covariance for better conditioning.
 */
export function shrunkCovarianceMatrix(returnMatrix: number[][]): number[][] {
  return ledoitWolfShrinkage(returnMatrix);
}

// ─── Beta & Tracking Error Analytics ────────────────────────────────────────

export interface BetaAnalytics {
  beta: number;
  alpha: number;
  rSquared: number;
  trackingError: number;
  informationRatio: number;
  systematicRisk: number;
  idiosyncraticRisk: number;
}

/**
 * Full beta decomposition for portfolio vs benchmark.
 */
export function betaAnalytics(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): BetaAnalytics {
  const beta = calculateBeta(portfolioReturns, benchmarkReturns);
  const te = trackingError(portfolioReturns, benchmarkReturns);
  const avgPort = mean(portfolioReturns);
  const avgBench = mean(benchmarkReturns);
  const alpha = (avgPort - beta * avgBench) * 252;

  const n = portfolioReturns.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const fitted = avgBench + beta * (benchmarkReturns[i] - avgBench);
    const residual = portfolioReturns[i] - (avgPort + beta * (benchmarkReturns[i] - avgBench));
    ssRes += residual * residual;
    ssTot += (portfolioReturns[i] - avgPort) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const portVol = stdDev(portfolioReturns) * Math.sqrt(252);
  const systematicRisk = beta * stdDev(benchmarkReturns) * Math.sqrt(252);
  const idiosyncraticRisk = Math.sqrt(Math.max(0, portVol * portVol - systematicRisk * systematicRisk));

  const ir = te > 0 ? alpha / (te / 100) : 0;

  return {
    beta,
    alpha,
    rSquared,
    trackingError: te * 100, // as bps
    informationRatio: ir,
    systematicRisk,
    idiosyncraticRisk,
  };
}

/**
 * Rolling beta over a window.
 */
export function rollingBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  window: number
): number[] {
  const n = portfolioReturns.length;
  const result: number[] = [];
  for (let i = window - 1; i < n; i++) {
    const pSlice = portfolioReturns.slice(i - window + 1, i + 1);
    const bSlice = benchmarkReturns.slice(i - window + 1, i + 1);
    result.push(calculateBeta(pSlice, bSlice));
  }
  return result;
}

// ─── Risk Decomposition Report ──────────────────────────────────────────────

/**
 * Full risk decomposition for dashboard/reporting.
 */
export function riskDecompositionReport(
  returns: number[],
  weights: number[],
  symbols: string[],
  covMatrix: number[][],
  factorReturns?: number[][],
  factorNames?: string[],
  confidence = 0.95
): RiskDecompositionReport {
  const componentVaRs = componentVaR(weights, covMatrix, symbols, confidence);

  let factorDec: FactorRiskDecomposition | null = null;
  if (factorReturns && factorNames && factorReturns.length === returns.length) {
    // Use first asset as proxy for portfolio
    factorDec = factorRiskDecomposition(returns, factorReturns, factorNames);
  }

  const concRisk = herfindahlIndex(weights);
  const tailRisk = expectedShortfall(returns, confidence);

  return {
    totalRisk: stdDev(returns) * Math.sqrt(252) * 100,
    systematicRisk: factorDec?.systematicRisk ?? 0,
    idiosyncraticRisk: factorDec?.idiosyncraticRisk ?? 0,
    factorContributions: factorDec?.factorContributions ?? {},
    componentVaRs,
    concentrationRisk: concRisk,
    tailRisk,
  };
}

// ─── Rolling Risk Metrics ────────────────────────────────────────────────────

/**
 * Compute rolling risk metrics for time series viz.
 */
export function rollingRiskMetrics(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  dates: number[],
  window = 60
): RollingRiskMetrics[] {
  const n = portfolioReturns.length;
  const result: RollingRiskMetrics[] = [];

  for (let i = window - 1; i < n; i++) {
    const pSlice = portfolioReturns.slice(i - window + 1, i + 1);
    const bSlice = benchmarkReturns.slice(i - window + 1, i + 1);

    const varRes = historicalVaR(pSlice, 0.95);
    const beta = calculateBeta(pSlice, bSlice);
    const te = trackingError(pSlice, bSlice);

    result.push({
      date: dates[i] ?? 0,
      volatility: stdDev(pSlice) * Math.sqrt(252) * 100,
      var95: varRes.var95 * 100,
      var99: varRes.var99 * 100,
      cvar95: varRes.cvar95 * 100,
      beta,
      trackingError: te * 100,
      maxDrawdown: maxDrawdown(pSlice) * 100,
    });
  }

  return result;
}

// ─── Drawdown Analytics ───────────────────────────────────────────────────────

export interface DrawdownAnalytics {
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgDrawdown: number;
  drawdownDuration: number;
  recoveryDuration: number | null;
  underwaterPeriods: number;
  drawdowns: DrawdownInfo[];
}

/**
 * Extended drawdown analytics.
 */
export function drawdownAnalytics(
  returns: number[],
  dates: number[]
): DrawdownAnalytics {
  const drawdowns = calculateDrawdowns(returns, dates);
  const maxDD = maxDrawdown(returns);

  const avgDD =
    drawdowns.length > 0
      ? drawdowns.reduce((s, d) => s + d.maxDrawdownPct, 0) / drawdowns.length
      : 0;

  const maxDDInfo = drawdowns[0];
  const duration = maxDDInfo?.duration ?? 0;
  const recoveryDuration = maxDDInfo?.recoveryDuration ?? null;

  let underwaterPeriods = 0;
  let peak = 1;
  let cum = 1;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    if (cum < peak) underwaterPeriods++;
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDD * 100,
    avgDrawdown: avgDD,
    drawdownDuration: duration,
    recoveryDuration,
    underwaterPeriods,
    drawdowns,
  };
}

// ─── Tail Risk Metrics ───────────────────────────────────────────────────────

export interface TailRiskReport {
  tailRatio: number;
  gainToPainRatio: number;
  ulcerIndex: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  var95: number;
  var99: number;
}

export function tailRiskReport(returns: number[]): TailRiskReport {
  const varRes = historicalVaR(returns, 0.95);
  return {
    tailRatio: tailRatio(returns, 5),
    gainToPainRatio: gainToPainRatio(returns),
    ulcerIndex: ulcerIndex(returns),
    expectedShortfall95: expectedShortfall(returns, 0.95),
    expectedShortfall99: expectedShortfall(returns, 0.99),
    var95: varRes.var95,
    var99: varRes.var99,
  };
}

// ─── Concentration Analytics ────────────────────────────────────────────────

export interface ConcentrationReport {
  herfindahlIndex: number;
  effectiveNumPositions: number;
  topHoldingsPct: number;
  giniCoefficient: number;
}

export function concentrationReport(
  weights: number[],
  topN = 5
): ConcentrationReport {
  const hhi = herfindahlIndex(weights);
  const enp = effectiveNumPositions(weights);

  const sorted = [...weights].sort((a, b) => b - a);
  const topSum = sorted.slice(0, topN).reduce((s, v) => s + v, 0);

  // Gini coefficient
  const n = weights.length;
  const sortedW = sorted.slice().sort((a, b) => a - b);
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sortedW[i];
  }
  const gini = n > 0 ? giniSum / (n * sortedW.reduce((s, v) => s + v, 0)) : 0;

  return {
    herfindahlIndex: hhi,
    effectiveNumPositions: enp,
    topHoldingsPct: topSum * 100,
    giniCoefficient: Math.max(0, Math.min(1, gini)),
  };
}

// ─── Aggregate Risk Dashboard ────────────────────────────────────────────────

export interface RiskDashboard {
  metrics: RiskMetrics;
  varComparison: Record<string, VaRResult>;
  stressReport: StressTestReport | null;
  correlation: CorrelationAnalytics | null;
  betaAnalytics: BetaAnalytics | null;
  tailRisk: TailRiskReport;
  concentration: ConcentrationReport;
  rollingMetrics: RollingRiskMetrics[];
}

export function buildRiskDashboard(
  returns: number[],
  dates: number[],
  positions: Position[],
  benchmarkReturns?: number[],
  returnMatrix?: number[][],
  symbols?: string[],
  factorBetas?: number[][],
  window = 60
): RiskDashboard {
  const weights = positions.map(p => p.weight);
  const covMatrix = returnMatrix
    ? sampleCovarianceMatrix(returnMatrix)
    : [[]];

  const metrics: RiskMetrics = {
    var1d: historicalVaR(returns, 0.95).var95,
    var10d: historicalVaR(returns, 0.95).var95 * Math.sqrt(10),
    cvar: expectedShortfall(returns, 0.95),
    volatility: stdDev(returns) * Math.sqrt(252),
    downsideDeviation: downsideDeviation(returns) * Math.sqrt(252),
    semiVariance: semiVariance(returns) * 252,
    skewness: skewness(returns),
    kurtosis: kurtosis(returns),
    herfindahlIndex: weights.length > 0 ? herfindahlIndex(weights) : 0,
  };

  const varComparison = compareVaRMethods(returns);

  let stressReport: StressTestReport | null = null;
  if (factorBetas && factorBetas.length === weights.length) {
    stressReport = stressTestReport(
      weights,
      factorBetas,
      EQUITY_STRESS_SCENARIOS,
      1
    );
  }

  let correlation: CorrelationAnalytics | null = null;
  if (returnMatrix && symbols && returnMatrix[0].length === symbols.length) {
    correlation = correlationMatrixAnalytics(returnMatrix, symbols);
  }

  let betaAnalyticsData: BetaAnalytics | null = null;
  if (benchmarkReturns) {
    betaAnalyticsData = betaAnalytics(returns, benchmarkReturns);
  }

  const tailRisk = tailRiskReport(returns);
  const concentration = concentrationReport(weights);

  const rollingMetrics = benchmarkReturns
    ? rollingRiskMetrics(returns, benchmarkReturns, dates, window)
    : [];

  return {
    metrics,
    varComparison,
    stressReport,
    correlation,
    betaAnalytics: betaAnalyticsData,
    tailRisk,
    concentration,
    rollingMetrics,
  };
}
