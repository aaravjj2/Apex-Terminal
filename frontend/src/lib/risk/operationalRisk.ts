import type {
  OperationalRiskEvent,
  KRI,
  BaselOpRiskCategory,
  RCSAScore,
  LimitStatus,
  Severity,
  RemediationAction,
} from './types';

// ─── Basel II Category Definitions ──────────────────────────────────────────

export const BASEL_CATEGORIES: Record<BaselOpRiskCategory, { name: string; description: string; examples: string[] }> = {
  internal_fraud: {
    name: 'Internal Fraud',
    description: 'Losses due to acts intended to defraud, misappropriate property, or circumvent regulations by internal parties',
    examples: ['Unauthorized trading', 'Intentional mismarking', 'Insider trading', 'Employee theft'],
  },
  external_fraud: {
    name: 'External Fraud',
    description: 'Losses due to acts intended to defraud or misappropriate property by third parties',
    examples: ['Robbery', 'Forgery', 'Check kiting', 'Hacking', 'Identity theft'],
  },
  employment_practices: {
    name: 'Employment Practices & Workplace Safety',
    description: 'Losses arising from violations of employment, health, or safety laws',
    examples: ['Discrimination claims', 'Workers compensation', 'Wrongful termination', 'Workplace harassment'],
  },
  clients_products: {
    name: 'Clients, Products & Business Practices',
    description: 'Losses from unintentional or negligent failure to meet professional obligations',
    examples: ['Suitability violations', 'Market manipulation', 'Product defects', 'Fiduciary breaches'],
  },
  damage_to_physical_assets: {
    name: 'Damage to Physical Assets',
    description: 'Losses from damage to physical assets from natural disaster or other events',
    examples: ['Natural disasters', 'Terrorism', 'Vandalism', 'Fire'],
  },
  business_disruption: {
    name: 'Business Disruption & System Failures',
    description: 'Losses from disruption of business or system failures',
    examples: ['Hardware failures', 'Software failures', 'Telecommunications outages', 'Utility outages'],
  },
  execution_delivery: {
    name: 'Execution, Delivery & Process Management',
    description: 'Losses from failed transaction processing or process management',
    examples: ['Data entry errors', 'Accounting errors', 'Failed mandatory reporting', 'Incomplete legal documents'],
  },
};

// ─── Business Line Weights (Basel II Standardized) ──────────────────────────

const BUSINESS_LINE_BETA: Record<string, number> = {
  'corporate_finance': 0.18,
  'trading_sales': 0.18,
  'retail_banking': 0.12,
  'commercial_banking': 0.15,
  'payment_settlement': 0.18,
  'agency_services': 0.15,
  'asset_management': 0.12,
  'retail_brokerage': 0.12,
};

// ─── KRI Tracking ───────────────────────────────────────────────────────────

export function createKRI(
  name: string,
  category: BaselOpRiskCategory,
  thresholds: { green: number; amber: number; red: number },
  frequency: KRI['frequency'] = 'monthly',
): KRI {
  return {
    id: `kri_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    category,
    currentValue: 0,
    thresholdGreen: thresholds.green,
    thresholdAmber: thresholds.amber,
    thresholdRed: thresholds.red,
    status: 'green',
    trend: 'stable',
    frequency,
    history: [],
  };
}

export function updateKRI(kri: KRI, newValue: number): KRI {
  const prevValue = kri.currentValue;
  const history = [...kri.history, { date: Date.now(), value: newValue }];

  let status: LimitStatus;
  if (newValue <= kri.thresholdGreen) status = 'green';
  else if (newValue <= kri.thresholdAmber) status = 'amber';
  else if (newValue <= kri.thresholdRed) status = 'red';
  else status = 'breached';

  let trend: KRI['trend'];
  if (history.length < 3) {
    trend = 'stable';
  } else {
    const recent = history.slice(-5);
    const deltas = recent.slice(1).map((h, i) => h.value - recent[i].value);
    const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    if (avgDelta < -0.05 * Math.abs(newValue || 1)) trend = 'improving';
    else if (avgDelta > 0.05 * Math.abs(newValue || 1)) trend = 'deteriorating';
    else trend = 'stable';
  }

  return { ...kri, currentValue: newValue, status, trend, history };
}

export function getDefaultKRIs(): KRI[] {
  return [
    createKRI('Failed Trade Rate (%)', 'execution_delivery', { green: 1, amber: 3, red: 5 }, 'daily'),
    createKRI('System Downtime (hours/month)', 'business_disruption', { green: 2, amber: 8, red: 24 }, 'monthly'),
    createKRI('Unauthorized Access Attempts', 'external_fraud', { green: 10, amber: 50, red: 100 }, 'weekly'),
    createKRI('Complaint Rate (per 1000 clients)', 'clients_products', { green: 2, amber: 5, red: 10 }, 'monthly'),
    createKRI('Staff Turnover (%)', 'employment_practices', { green: 10, amber: 20, red: 30 }, 'quarterly'),
    createKRI('Reconciliation Breaks', 'execution_delivery', { green: 5, amber: 20, red: 50 }, 'daily'),
    createKRI('Overdue Audit Findings', 'internal_fraud', { green: 2, amber: 5, red: 10 }, 'monthly'),
    createKRI('Regulatory Breaches', 'clients_products', { green: 0, amber: 1, red: 3 }, 'quarterly'),
  ];
}

// ─── Loss Event Management ──────────────────────────────────────────────────

export function createLossEvent(
  category: BaselOpRiskCategory,
  severity: Severity,
  description: string,
  lossAmount: number,
  currency: string,
  businessLine: string,
  nearMiss: boolean = false,
): OperationalRiskEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    severity,
    description,
    lossAmount: nearMiss ? 0 : lossAmount,
    currency,
    occurredAt: Date.now(),
    discoveredAt: Date.now(),
    businessLine,
    status: 'open',
    nearMiss,
  };
}

export function categorizeEvents(
  events: OperationalRiskEvent[],
): Record<BaselOpRiskCategory, { count: number; totalLoss: number; avgLoss: number }> {
  const result: Record<string, { count: number; totalLoss: number; avgLoss: number }> = {};

  for (const cat of Object.keys(BASEL_CATEGORIES) as BaselOpRiskCategory[]) {
    result[cat] = { count: 0, totalLoss: 0, avgLoss: 0 };
  }

  for (const event of events) {
    if (!result[event.category]) continue;
    result[event.category].count++;
    result[event.category].totalLoss += event.lossAmount;
  }

  for (const cat of Object.values(result)) {
    cat.avgLoss = cat.count > 0 ? cat.totalLoss / cat.count : 0;
  }

  return result as Record<BaselOpRiskCategory, { count: number; totalLoss: number; avgLoss: number }>;
}

// ─── Loss Distribution Approach (LDA) ───────────────────────────────────────

/** Poisson probability mass function. */
function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Generate Poisson random variate via Knuth's method. */
function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Generate Lognormal random variate. */
function lognormalRandom(mu: number, sigma: number): number {
  const z = boxMullerNormal();
  return Math.exp(mu + sigma * z);
}

function boxMullerNormal(): number {
  let u1: number;
  do { u1 = Math.random(); } while (u1 === 0);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
}

export interface LDAResult {
  expectedFrequency: number;
  expectedSeverityMean: number;
  expectedSeverityStd: number;
  expectedAnnualLoss: number;
  varLoss95: number;
  varLoss99: number;
  varLoss999: number;
  simulatedLosses: number[];
}

/**
 * Loss Distribution Approach: convolves frequency (Poisson) and
 * severity (Lognormal) distributions via Monte Carlo.
 */
export function lossDistributionApproach(
  frequencyLambda: number,
  severityMu: number,
  severitySigma: number,
  simulations: number = 50000,
): LDAResult {
  const aggregateLosses: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const nEvents = poissonRandom(frequencyLambda);
    let totalLoss = 0;
    for (let e = 0; e < nEvents; e++) {
      totalLoss += lognormalRandom(severityMu, severitySigma);
    }
    aggregateLosses.push(totalLoss);
  }

  aggregateLosses.sort((a, b) => a - b);

  const expectedSeverityMean = Math.exp(severityMu + severitySigma ** 2 / 2);
  const expectedSeverityStd = expectedSeverityMean * Math.sqrt(Math.exp(severitySigma ** 2) - 1);

  return {
    expectedFrequency: frequencyLambda,
    expectedSeverityMean,
    expectedSeverityStd,
    expectedAnnualLoss: frequencyLambda * expectedSeverityMean,
    varLoss95: aggregateLosses[Math.floor(0.95 * simulations)],
    varLoss99: aggregateLosses[Math.floor(0.99 * simulations)],
    varLoss999: aggregateLosses[Math.floor(0.999 * simulations)],
    simulatedLosses: aggregateLosses,
  };
}

export function fitFrequencyDistribution(
  eventCounts: number[],
): { lambda: number; goodnessOfFit: number } {
  if (eventCounts.length === 0) return { lambda: 0, goodnessOfFit: 0 };

  const lambda = eventCounts.reduce((s, c) => s + c, 0) / eventCounts.length;

  let chiSquared = 0;
  const maxK = Math.max(...eventCounts) + 1;
  const observed = new Array(maxK + 1).fill(0);
  for (const c of eventCounts) observed[Math.min(c, maxK)]++;

  for (let k = 0; k <= maxK; k++) {
    const expected = eventCounts.length * poissonPMF(k, lambda);
    if (expected > 0) {
      chiSquared += (observed[k] - expected) ** 2 / expected;
    }
  }

  const dof = Math.max(maxK - 1, 1);
  const pValue = 1 - chi2CDF(chiSquared, dof);

  return { lambda, goodnessOfFit: pValue };
}

export function fitSeverityDistribution(
  losses: number[],
): { mu: number; sigma: number; goodnessOfFit: number } {
  const positiveLosses = losses.filter(l => l > 0);
  if (positiveLosses.length === 0) return { mu: 0, sigma: 1, goodnessOfFit: 0 };

  const logLosses = positiveLosses.map(l => Math.log(l));
  const mu = logLosses.reduce((s, l) => s + l, 0) / logLosses.length;
  const sigma = Math.sqrt(
    logLosses.reduce((s, l) => s + (l - mu) ** 2, 0) / (logLosses.length - 1),
  );

  const ks = kolmogorovSmirnovTest(positiveLosses, mu, sigma);

  return { mu, sigma, goodnessOfFit: ks };
}

function kolmogorovSmirnovTest(data: number[], mu: number, sigma: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  let maxD = 0;

  for (let i = 0; i < n; i++) {
    const empirical = (i + 1) / n;
    const theoretical = lognormalCDF(sorted[i], mu, sigma);
    maxD = Math.max(maxD, Math.abs(empirical - theoretical));
  }

  const sqrtN = Math.sqrt(n);
  const pValue = 2 * Math.exp(-2 * sqrtN * sqrtN * maxD * maxD);
  return Math.min(1, Math.max(0, pValue));
}

function lognormalCDF(x: number, mu: number, sigma: number): number {
  if (x <= 0) return 0;
  return normalCDF((Math.log(x) - mu) / sigma);
}

function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

function chi2CDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return lowerIncompleteGamma(k / 2, x / 2) / gamma(k / 2);
}

function gamma(z: number): number {
  if (z <= 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function lowerIncompleteGamma(s: number, x: number): number {
  if (x === 0) return 0;
  let sum = 0, term = 1 / s;
  for (let n = 1; n < 200; n++) {
    sum += term;
    term *= x / (s + n);
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.pow(x, s) * Math.exp(-x) * sum;
}

// ─── RCSA Scoring ───────────────────────────────────────────────────────────

export function calculateRCSA(
  riskId: string,
  inherentLikelihood: number,
  inherentImpact: number,
  controlEffectiveness: number,
): RCSAScore {
  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const il = clamp(inherentLikelihood);
  const ii = clamp(inherentImpact);
  const ce = Math.max(0, Math.min(1, controlEffectiveness));

  const residualLikelihood = il * (1 - ce * 0.6);
  const residualImpact = ii * (1 - ce * 0.3);
  const residualScore = residualLikelihood * residualImpact;

  return {
    riskId,
    inherentLikelihood: il,
    inherentImpact: ii,
    controlEffectiveness: ce,
    residualLikelihood: Math.max(1, residualLikelihood),
    residualImpact: Math.max(1, residualImpact),
    residualScore,
  };
}

export function rcsaSeverity(score: RCSAScore): Severity {
  if (score.residualScore >= 15) return 'critical';
  if (score.residualScore >= 10) return 'high';
  if (score.residualScore >= 5) return 'medium';
  return 'low';
}

// ─── Capital Allocation ─────────────────────────────────────────────────────

/**
 * Basic Indicator Approach (BIA): Capital = 15% × average gross income (3 years).
 */
export function basicIndicatorApproach(grossIncomes: number[]): number {
  const positiveIncomes = grossIncomes.filter(gi => gi > 0);
  if (positiveIncomes.length === 0) return 0;
  const avgIncome = positiveIncomes.reduce((s, gi) => s + gi, 0) / positiveIncomes.length;
  return 0.15 * avgIncome;
}

/**
 * Standardized Approach: Capital = sum of (beta × gross income) per business line.
 */
export function standardizedApproach(
  businessLineIncomes: Record<string, number[]>,
): { total: number; byBusinessLine: Record<string, number> } {
  let total = 0;
  const byBL: Record<string, number> = {};

  for (const [bl, incomes] of Object.entries(businessLineIncomes)) {
    const beta = BUSINESS_LINE_BETA[bl] ?? 0.15;
    const positiveIncomes = incomes.filter(i => i > 0);
    if (positiveIncomes.length === 0) {
      byBL[bl] = 0;
      continue;
    }
    const avgIncome = positiveIncomes.reduce((s, i) => s + i, 0) / positiveIncomes.length;
    const capital = beta * avgIncome;
    byBL[bl] = capital;
    total += capital;
  }

  return { total: Math.max(total, 0), byBusinessLine: byBL };
}

/**
 * Advanced Measurement Approach (AMA): uses the LDA results
 * combined with internal data, external data, scenario analysis, and BEICFs.
 */
export function advancedMeasurementApproach(
  ldaResults: Record<BaselOpRiskCategory, LDAResult>,
  diversificationBenefit: number = 0.20,
  insuranceMitigation: number = 0,
): { total: number; byCategory: Record<string, number>; diversifiedTotal: number } {
  let undiversifiedTotal = 0;
  const byCategory: Record<string, number> = {};

  for (const [category, lda] of Object.entries(ldaResults)) {
    const capitalCharge = lda.varLoss999 - lda.expectedAnnualLoss;
    byCategory[category] = Math.max(capitalCharge, 0);
    undiversifiedTotal += Math.max(capitalCharge, 0);
  }

  const diversifiedTotal = undiversifiedTotal * (1 - diversificationBenefit);
  const afterInsurance = Math.max(diversifiedTotal - insuranceMitigation, diversifiedTotal * 0.80);

  return {
    total: undiversifiedTotal,
    byCategory,
    diversifiedTotal: afterInsurance,
  };
}

// ─── Incident Management ────────────────────────────────────────────────────

export function escalateEvent(
  event: OperationalRiskEvent,
  newSeverity: Severity,
  rootCause: string,
): OperationalRiskEvent {
  return {
    ...event,
    severity: newSeverity,
    status: 'investigating',
    rootCause,
  };
}

export function addRemediation(
  event: OperationalRiskEvent,
  description: string,
  assignee: string,
  dueDateMs: number,
): OperationalRiskEvent {
  const action: RemediationAction = {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    description,
    assignee,
    dueDate: dueDateMs,
    status: 'pending',
  };

  return {
    ...event,
    remediationActions: [...(event.remediationActions ?? []), action],
  };
}

export function updateRemediationStatus(
  event: OperationalRiskEvent,
  remediationId: string,
  status: RemediationAction['status'],
): OperationalRiskEvent {
  const actions = (event.remediationActions ?? []).map(a =>
    a.id === remediationId ? { ...a, status } : a,
  );

  const allComplete = actions.every(a => a.status === 'completed');
  return {
    ...event,
    remediationActions: actions,
    status: allComplete ? 'remediated' : event.status,
  };
}

export function checkOverdueRemediations(
  events: OperationalRiskEvent[],
  now: number = Date.now(),
): { eventId: string; remediationId: string; daysOverdue: number }[] {
  const overdue: { eventId: string; remediationId: string; daysOverdue: number }[] = [];

  for (const event of events) {
    for (const action of event.remediationActions ?? []) {
      if (action.status !== 'completed' && action.dueDate < now) {
        const daysOverdue = Math.floor((now - action.dueDate) / 86400000);
        overdue.push({ eventId: event.id, remediationId: action.id, daysOverdue });
      }
    }
  }

  return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ─── Risk Appetite Framework ────────────────────────────────────────────────

export interface RiskAppetiteMetric {
  name: string;
  category: BaselOpRiskCategory;
  appetiteLevel: number;
  toleranceLevel: number;
  currentLevel: number;
  withinAppetite: boolean;
  withinTolerance: boolean;
}

export function evaluateRiskAppetite(
  metrics: { name: string; category: BaselOpRiskCategory; appetite: number; tolerance: number; current: number }[],
): RiskAppetiteMetric[] {
  return metrics.map(m => ({
    name: m.name,
    category: m.category,
    appetiteLevel: m.appetite,
    toleranceLevel: m.tolerance,
    currentLevel: m.current,
    withinAppetite: m.current <= m.appetite,
    withinTolerance: m.current <= m.tolerance,
  }));
}

// ─── Control Effectiveness ──────────────────────────────────────────────────

export interface ControlAssessment {
  controlId: string;
  controlName: string;
  designEffectiveness: number;
  operatingEffectiveness: number;
  overallEffectiveness: number;
  testDate: number;
  nextTestDate: number;
  findings: string[];
}

export function assessControlEffectiveness(
  controlId: string,
  controlName: string,
  designScore: number,
  operatingScore: number,
  findings: string[] = [],
): ControlAssessment {
  const design = Math.max(0, Math.min(1, designScore));
  const operating = Math.max(0, Math.min(1, operatingScore));
  const overall = design * 0.4 + operating * 0.6;

  return {
    controlId,
    controlName,
    designEffectiveness: design,
    operatingEffectiveness: operating,
    overallEffectiveness: overall,
    testDate: Date.now(),
    nextTestDate: Date.now() + 90 * 86400000,
    findings,
  };
}

// ─── Aggregate Op Risk Dashboard ────────────────────────────────────────────

export interface OpRiskSummary {
  totalLossesYTD: number;
  eventCount: number;
  averageLoss: number;
  topCategory: BaselOpRiskCategory;
  kriBreaches: number;
  openRemediations: number;
  capitalCharge: number;
}

export function computeOpRiskSummary(
  events: OperationalRiskEvent[],
  kris: KRI[],
  capitalCharge: number,
): OpRiskSummary {
  const totalLoss = events.reduce((s, e) => s + e.lossAmount, 0);
  const avgLoss = events.length > 0 ? totalLoss / events.length : 0;

  const categoryCounts = categorizeEvents(events);
  let topCategory: BaselOpRiskCategory = 'execution_delivery';
  let topLoss = 0;
  for (const [cat, stats] of Object.entries(categoryCounts)) {
    if (stats.totalLoss > topLoss) {
      topLoss = stats.totalLoss;
      topCategory = cat as BaselOpRiskCategory;
    }
  }

  const kriBreaches = kris.filter(k => k.status === 'red' || k.status === 'breached').length;
  const openRemediations = events.reduce((count, e) => {
    return count + (e.remediationActions?.filter(a => a.status !== 'completed').length ?? 0);
  }, 0);

  return {
    totalLossesYTD: totalLoss,
    eventCount: events.length,
    averageLoss: avgLoss,
    topCategory,
    kriBreaches,
    openRemediations,
    capitalCharge,
  };
}
