import type {
  Portfolio,
  Position,
  RegulatoryMetric,
  FRTBResult,
  BaselIIIMetrics,
  ISDAMargin,
  RiskFactorType,
  SensitivityResult,
} from './types';

// ─── FRTB: Sensitivities-Based Method (SbM) ────────────────────────────────

const FRTB_RISK_WEIGHTS: Record<RiskFactorType, number> = {
  equity: 0.30,
  fx: 0.15,
  interest_rate: 0.015,
  credit_spread: 0.05,
  commodity: 0.35,
  volatility: 1.00,
  inflation: 0.02,
  basis: 0.004,
};

const FRTB_VEGA_RISK_WEIGHTS: Record<RiskFactorType, number> = {
  equity: 0.55,
  fx: 0.40,
  interest_rate: 1.00,
  credit_spread: 0.50,
  commodity: 0.60,
  volatility: 1.00,
  inflation: 0.50,
  basis: 0.50,
};

const FRTB_INTRA_BUCKET_CORRELATION = 0.75;
const FRTB_INTER_BUCKET_CORRELATION = 0.50;

/**
 * FRTB SbM Delta capital charge.
 * Aggregates weighted sensitivities within and across buckets.
 */
export function frtbDeltaCharge(
  sensitivities: { riskClass: RiskFactorType; bucket: string; sensitivity: number }[],
): { total: number; byRiskClass: Record<string, number> } {
  const byRiskClass: Record<string, number> = {};
  const bucketAggregates: Record<string, Record<string, number>> = {};

  for (const s of sensitivities) {
    const rw = FRTB_RISK_WEIGHTS[s.riskClass] ?? 0.20;
    const weightedSens = s.sensitivity * rw;
    const key = `${s.riskClass}::${s.bucket}`;

    if (!bucketAggregates[s.riskClass]) bucketAggregates[s.riskClass] = {};
    bucketAggregates[s.riskClass][s.bucket] = (bucketAggregates[s.riskClass][s.bucket] ?? 0) + weightedSens;
  }

  let totalCharge = 0;

  for (const [riskClass, buckets] of Object.entries(bucketAggregates)) {
    const bucketValues = Object.values(buckets);

    let intraBucketCharge = 0;
    for (let i = 0; i < bucketValues.length; i++) {
      for (let j = 0; j < bucketValues.length; j++) {
        const corr = i === j ? 1.0 : FRTB_INTRA_BUCKET_CORRELATION;
        intraBucketCharge += bucketValues[i] * bucketValues[j] * corr;
      }
    }
    intraBucketCharge = Math.sqrt(Math.max(intraBucketCharge, 0));

    byRiskClass[riskClass] = intraBucketCharge;
    totalCharge += intraBucketCharge;
  }

  const rcValues = Object.values(byRiskClass);
  let interBucketCharge = 0;
  for (let i = 0; i < rcValues.length; i++) {
    for (let j = 0; j < rcValues.length; j++) {
      const corr = i === j ? 1.0 : FRTB_INTER_BUCKET_CORRELATION;
      interBucketCharge += rcValues[i] * rcValues[j] * corr;
    }
  }

  return {
    total: Math.sqrt(Math.max(interBucketCharge, 0)),
    byRiskClass,
  };
}

/**
 * FRTB SbM Vega capital charge.
 */
export function frtbVegaCharge(
  vegaSensitivities: { riskClass: RiskFactorType; bucket: string; vega: number; impliedVol: number }[],
): number {
  let totalCharge = 0;

  for (const s of vegaSensitivities) {
    const rw = FRTB_VEGA_RISK_WEIGHTS[s.riskClass] ?? 0.50;
    const weightedVega = s.vega * s.impliedVol * rw;
    totalCharge += weightedVega * weightedVega;
  }

  return Math.sqrt(totalCharge);
}

/**
 * FRTB SbM Curvature capital charge.
 * Computed as the worst of upward and downward shock P&L changes.
 */
export function frtbCurvatureCharge(
  curvatureData: { riskClass: RiskFactorType; upPnl: number; downPnl: number }[],
): number {
  let totalUp = 0;
  let totalDown = 0;

  for (const c of curvatureData) {
    totalUp += Math.max(-c.upPnl, 0);
    totalDown += Math.max(-c.downPnl, 0);
  }

  return Math.max(totalUp, totalDown);
}

/**
 * FRTB Default Risk Charge (DRC) for non-securitization positions.
 * Uses a jump-to-default framework with LGD and net exposure.
 */
export function frtbDefaultRiskCharge(
  positions: { notional: number; lgd: number; pd: number; rating: string; isLong: boolean }[],
): number {
  let grossJTD = 0;
  let longJTD = 0;
  let shortJTD = 0;

  for (const pos of positions) {
    const jtd = pos.notional * pos.lgd;
    grossJTD += jtd;
    if (pos.isLong) longJTD += jtd;
    else shortJTD += jtd;
  }

  const hedgeBenefitRatio = shortJTD > 0 ? Math.min(shortJTD / longJTD, 0.6) : 0;
  const netJTD = longJTD - shortJTD * hedgeBenefitRatio;

  const ratingWeights: Record<string, number> = {
    'AAA': 0.005, 'AA': 0.02, 'A': 0.03, 'BBB': 0.06,
    'BB': 0.15, 'B': 0.30, 'CCC': 0.50, 'D': 1.00,
  };

  let weightedDRC = 0;
  for (const pos of positions) {
    if (!pos.isLong) continue;
    const rw = ratingWeights[simplifyRating(pos.rating)] ?? 0.15;
    weightedDRC += pos.notional * pos.lgd * rw;
  }

  return weightedDRC;
}

function simplifyRating(rating: string): string {
  const base = rating.replace(/[+-]$/, '');
  if (base === 'AAA') return 'AAA';
  if (base === 'AA') return 'AA';
  if (base === 'A') return 'A';
  if (base === 'BBB') return 'BBB';
  if (base === 'BB') return 'BB';
  if (base === 'B') return 'B';
  if (['CCC', 'CC', 'C'].includes(base)) return 'CCC';
  return 'D';
}

/**
 * FRTB Residual Risk Add-On (RRAO).
 * Applied to exotic instruments not fully captured by SbM or DRC.
 */
export function frtbResidualRiskAddOn(
  exoticNotional: number,
  otherResidualNotional: number,
): number {
  return exoticNotional * 0.01 + otherResidualNotional * 0.001;
}

export function calculateFRTB(
  deltaSensitivities: { riskClass: RiskFactorType; bucket: string; sensitivity: number }[],
  vegaSensitivities: { riskClass: RiskFactorType; bucket: string; vega: number; impliedVol: number }[],
  curvatureData: { riskClass: RiskFactorType; upPnl: number; downPnl: number }[],
  drcPositions: { notional: number; lgd: number; pd: number; rating: string; isLong: boolean }[],
  exoticNotional: number = 0,
  otherResidualNotional: number = 0,
): FRTBResult {
  const { total: deltaCharge } = frtbDeltaCharge(deltaSensitivities);
  const vegaCharge = frtbVegaCharge(vegaSensitivities);
  const curvCharge = frtbCurvatureCharge(curvatureData);
  const sbmTotal = deltaCharge + vegaCharge + curvCharge;

  const drc = frtbDefaultRiskCharge(drcPositions);
  const rrao = frtbResidualRiskAddOn(exoticNotional, otherResidualNotional);

  return {
    sbm: { delta: deltaCharge, vega: vegaCharge, curvature: curvCharge, total: sbmTotal },
    drc,
    rrao,
    totalCapitalCharge: sbmTotal + drc + rrao,
  };
}

// ─── Basel III Ratios ───────────────────────────────────────────────────────

export function calculateBaselIII(
  cet1Capital: number,
  additionalTier1: number,
  tier2Capital: number,
  rwa: number,
  totalExposure: number,
  hqla: number,
  netCashOutflows30d: number,
  availableStableFunding: number,
  requiredStableFunding: number,
): BaselIIIMetrics {
  const tier1 = cet1Capital + additionalTier1;
  const totalCapital = tier1 + tier2Capital;
  const safeRWA = Math.max(rwa, 1);

  return {
    cet1Ratio: cet1Capital / safeRWA,
    tier1Ratio: tier1 / safeRWA,
    totalCapitalRatio: totalCapital / safeRWA,
    leverageRatio: totalExposure > 0 ? tier1 / totalExposure : 0,
    lcr: netCashOutflows30d > 0 ? hqla / netCashOutflows30d : Infinity,
    nsfr: requiredStableFunding > 0 ? availableStableFunding / requiredStableFunding : Infinity,
    rwa,
  };
}

export function checkBaselIIICompliance(metrics: BaselIIIMetrics): {
  compliant: boolean;
  breaches: string[];
  buffers: Record<string, number>;
} {
  const breaches: string[] = [];
  const MIN_CET1 = 0.045;
  const MIN_TIER1 = 0.06;
  const MIN_TOTAL_CAPITAL = 0.08;
  const MIN_LEVERAGE = 0.03;
  const MIN_LCR = 1.0;
  const MIN_NSFR = 1.0;
  const CONSERVATION_BUFFER = 0.025;

  if (metrics.cet1Ratio < MIN_CET1) breaches.push(`CET1 ratio ${(metrics.cet1Ratio * 100).toFixed(2)}% below minimum ${MIN_CET1 * 100}%`);
  if (metrics.cet1Ratio < MIN_CET1 + CONSERVATION_BUFFER) breaches.push(`CET1 ratio below conservation buffer`);
  if (metrics.tier1Ratio < MIN_TIER1) breaches.push(`Tier 1 ratio ${(metrics.tier1Ratio * 100).toFixed(2)}% below minimum ${MIN_TIER1 * 100}%`);
  if (metrics.totalCapitalRatio < MIN_TOTAL_CAPITAL) breaches.push(`Total capital ratio below minimum ${MIN_TOTAL_CAPITAL * 100}%`);
  if (metrics.leverageRatio < MIN_LEVERAGE) breaches.push(`Leverage ratio ${(metrics.leverageRatio * 100).toFixed(2)}% below minimum ${MIN_LEVERAGE * 100}%`);
  if (metrics.lcr < MIN_LCR) breaches.push(`LCR ${(metrics.lcr * 100).toFixed(1)}% below minimum 100%`);
  if (metrics.nsfr < MIN_NSFR) breaches.push(`NSFR ${(metrics.nsfr * 100).toFixed(1)}% below minimum 100%`);

  return {
    compliant: breaches.length === 0,
    breaches,
    buffers: {
      cet1Buffer: metrics.cet1Ratio - MIN_CET1,
      tier1Buffer: metrics.tier1Ratio - MIN_TIER1,
      totalCapitalBuffer: metrics.totalCapitalRatio - MIN_TOTAL_CAPITAL,
      leverageBuffer: metrics.leverageRatio - MIN_LEVERAGE,
      lcrBuffer: metrics.lcr - MIN_LCR,
      nsfrBuffer: metrics.nsfr - MIN_NSFR,
    },
  };
}

/**
 * Risk-Weighted Assets calculation using the Standardized Approach.
 */
export function calculateRWA(
  positions: { exposure: number; assetClass: string; rating: string; collateralValue?: number }[],
): { total: number; byAssetClass: Record<string, number> } {
  const riskWeights: Record<string, Record<string, number>> = {
    sovereign: { 'AAA': 0, 'AA': 0, 'A': 0.20, 'BBB': 0.50, 'BB': 1.0, 'B': 1.0, 'CCC': 1.50, 'D': 1.50 },
    bank: { 'AAA': 0.20, 'AA': 0.20, 'A': 0.50, 'BBB': 0.50, 'BB': 1.0, 'B': 1.0, 'CCC': 1.50, 'D': 1.50 },
    corporate: { 'AAA': 0.20, 'AA': 0.20, 'A': 0.50, 'BBB': 1.0, 'BB': 1.0, 'B': 1.50, 'CCC': 1.50, 'D': 1.50 },
    retail: { default: 0.75 },
    mortgage: { default: 0.35 },
    equity: { default: 1.0 },
  };

  let total = 0;
  const byAssetClass: Record<string, number> = {};

  for (const pos of positions) {
    const acWeights = riskWeights[pos.assetClass] ?? riskWeights['corporate'];
    const simpleRating = simplifyRating(pos.rating);
    const rw = acWeights[simpleRating] ?? acWeights['default'] ?? 1.0;

    const netExposure = Math.max(pos.exposure - (pos.collateralValue ?? 0) * 0.8, 0);
    const rwa = netExposure * rw;

    byAssetClass[pos.assetClass] = (byAssetClass[pos.assetClass] ?? 0) + rwa;
    total += rwa;
  }

  return { total, byAssetClass };
}

// ─── ISDA SIMM ──────────────────────────────────────────────────────────────

const SIMM_RISK_WEIGHTS: Record<string, number> = {
  'interest_rate': 61,
  'credit_qualifying': 59,
  'credit_non_qualifying': 500,
  'equity': 25,
  'commodity': 16,
  'fx': 7.3,
};

const SIMM_VEGA_RISK_WEIGHTS: Record<string, number> = {
  'interest_rate': 0.18,
  'credit_qualifying': 0.50,
  'credit_non_qualifying': 0.50,
  'equity': 0.21,
  'commodity': 0.27,
  'fx': 0.21,
};

export function simmDeltaMargin(
  sensitivities: { riskClass: string; tenor?: string; sensitivity: number }[],
): { total: number; byRiskClass: Record<string, number> } {
  const byRC: Record<string, number[]> = {};

  for (const s of sensitivities) {
    if (!byRC[s.riskClass]) byRC[s.riskClass] = [];
    const rw = SIMM_RISK_WEIGHTS[s.riskClass] ?? 25;
    byRC[s.riskClass].push(s.sensitivity * rw);
  }

  let total = 0;
  const byRiskClass: Record<string, number> = {};

  for (const [rc, weightedSens] of Object.entries(byRC)) {
    let bucketCharge = 0;
    for (let i = 0; i < weightedSens.length; i++) {
      for (let j = 0; j < weightedSens.length; j++) {
        const corr = i === j ? 1.0 : 0.90;
        bucketCharge += weightedSens[i] * weightedSens[j] * corr;
      }
    }
    const charge = Math.sqrt(Math.max(bucketCharge, 0));
    byRiskClass[rc] = charge;
    total += charge;
  }

  return { total, byRiskClass };
}

export function simmVegaMargin(
  vegaSensitivities: { riskClass: string; vega: number; impliedVol: number }[],
): { total: number; byRiskClass: Record<string, number> } {
  const byRC: Record<string, number[]> = {};

  for (const s of vegaSensitivities) {
    if (!byRC[s.riskClass]) byRC[s.riskClass] = [];
    const vrw = SIMM_VEGA_RISK_WEIGHTS[s.riskClass] ?? 0.25;
    byRC[s.riskClass].push(s.vega * s.impliedVol * vrw);
  }

  let total = 0;
  const byRiskClass: Record<string, number> = {};

  for (const [rc, weightedVegas] of Object.entries(byRC)) {
    let bucketCharge = 0;
    for (let i = 0; i < weightedVegas.length; i++) {
      for (let j = 0; j < weightedVegas.length; j++) {
        const corr = i === j ? 1.0 : 0.50;
        bucketCharge += weightedVegas[i] * weightedVegas[j] * corr;
      }
    }
    const charge = Math.sqrt(Math.max(bucketCharge, 0));
    byRiskClass[rc] = charge;
    total += charge;
  }

  return { total, byRiskClass };
}

export function simmCurvatureMargin(
  curvatureData: { riskClass: string; upPnl: number; downPnl: number; scaleFactor: number }[],
): { total: number; byRiskClass: Record<string, number> } {
  const byRC: Record<string, { up: number; down: number }> = {};

  for (const c of curvatureData) {
    if (!byRC[c.riskClass]) byRC[c.riskClass] = { up: 0, down: 0 };
    byRC[c.riskClass].up += c.upPnl * c.scaleFactor;
    byRC[c.riskClass].down += c.downPnl * c.scaleFactor;
  }

  let total = 0;
  const byRiskClass: Record<string, number> = {};

  for (const [rc, pnl] of Object.entries(byRC)) {
    const charge = Math.max(Math.abs(pnl.up), Math.abs(pnl.down));
    byRiskClass[rc] = charge;
    total += charge;
  }

  return { total, byRiskClass };
}

export function calculateISDAMargin(
  deltaSensitivities: { riskClass: string; tenor?: string; sensitivity: number }[],
  vegaSensitivities: { riskClass: string; vega: number; impliedVol: number }[],
  curvatureData: { riskClass: string; upPnl: number; downPnl: number; scaleFactor: number }[],
): ISDAMargin {
  const delta = simmDeltaMargin(deltaSensitivities);
  const vega = simmVegaMargin(vegaSensitivities);
  const curvature = simmCurvatureMargin(curvatureData);

  const byRiskClass: Record<string, number> = {};
  const allClasses = new Set([
    ...Object.keys(delta.byRiskClass),
    ...Object.keys(vega.byRiskClass),
    ...Object.keys(curvature.byRiskClass),
  ]);

  for (const rc of allClasses) {
    byRiskClass[rc] = (delta.byRiskClass[rc] ?? 0)
                     + (vega.byRiskClass[rc] ?? 0)
                     + (curvature.byRiskClass[rc] ?? 0);
  }

  return {
    deltaMargin: delta.total,
    vegaMargin: vega.total,
    curvatureMargin: curvature.total,
    totalMargin: delta.total + vega.total + curvature.total,
    byRiskClass,
  };
}

// ─── Volcker Rule ───────────────────────────────────────────────────────────

export interface VolckerMetrics {
  tradingAccountPnl: number;
  customerFacingRevenue: number;
  inventoryAging: { within30d: number; within60d: number; beyond60d: number };
  hedgingEffectiveness: number;
  compliant: boolean;
  flags: string[];
}

export function volckerComplianceCheck(
  tradingAccountPnl: number,
  customerFacingRevenue: number,
  totalRevenue: number,
  inventoryAging: { within30d: number; within60d: number; beyond60d: number },
  hedgingCorrelation: number,
): VolckerMetrics {
  const flags: string[] = [];

  const cfRevenueRatio = totalRevenue > 0 ? customerFacingRevenue / totalRevenue : 0;
  if (cfRevenueRatio < 0.5) {
    flags.push(`Customer-facing revenue ratio (${(cfRevenueRatio * 100).toFixed(1)}%) suggests potential proprietary trading`);
  }

  const totalInventory = inventoryAging.within30d + inventoryAging.within60d + inventoryAging.beyond60d;
  if (totalInventory > 0 && inventoryAging.beyond60d / totalInventory > 0.3) {
    flags.push(`${((inventoryAging.beyond60d / totalInventory) * 100).toFixed(1)}% of inventory aged beyond 60 days`);
  }

  const hedgingEffectiveness = Math.abs(hedgingCorrelation);
  if (hedgingEffectiveness < 0.8) {
    flags.push(`Hedging effectiveness (${(hedgingEffectiveness * 100).toFixed(1)}%) below 80% threshold`);
  }

  return {
    tradingAccountPnl,
    customerFacingRevenue,
    inventoryAging,
    hedgingEffectiveness,
    compliant: flags.length === 0,
    flags,
  };
}

// ─── Position & Large Exposure Reporting ────────────────────────────────────

export interface PositionReport {
  asOfDate: number;
  positions: {
    symbol: string;
    notional: number;
    marketValue: number;
    assetClass: string;
    country: string;
    currency: string;
  }[];
  totalNotional: number;
  totalMarketValue: number;
  byAssetClass: Record<string, number>;
  byCurrency: Record<string, number>;
  byCountry: Record<string, number>;
}

export function generatePositionReport(portfolio: Portfolio): PositionReport {
  const byAssetClass: Record<string, number> = {};
  const byCurrency: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  let totalNotional = 0;

  for (const pos of portfolio.positions) {
    const notional = Math.abs(pos.quantity * pos.currentPrice);
    totalNotional += notional;

    byAssetClass[pos.assetClass] = (byAssetClass[pos.assetClass] ?? 0) + Math.abs(pos.marketValue);
    byCurrency[pos.currency] = (byCurrency[pos.currency] ?? 0) + Math.abs(pos.marketValue);
    const country = pos.country ?? 'Unknown';
    byCountry[country] = (byCountry[country] ?? 0) + Math.abs(pos.marketValue);
  }

  return {
    asOfDate: Date.now(),
    positions: portfolio.positions.map(p => ({
      symbol: p.symbol,
      notional: Math.abs(p.quantity * p.currentPrice),
      marketValue: p.marketValue,
      assetClass: p.assetClass,
      country: p.country ?? 'Unknown',
      currency: p.currency,
    })),
    totalNotional,
    totalMarketValue: portfolio.totalValue,
    byAssetClass,
    byCurrency,
    byCountry,
  };
}

export interface LargeExposureResult {
  counterpartyId: string;
  exposure: number;
  tier1Capital: number;
  exposureRatio: number;
  breachesLimit: boolean;
  limit: number;
}

export function checkLargeExposures(
  counterpartyExposures: Record<string, number>,
  tier1Capital: number,
  limitPercent: number = 0.25,
): LargeExposureResult[] {
  const results: LargeExposureResult[] = [];
  const limit = tier1Capital * limitPercent;

  for (const [cpty, exposure] of Object.entries(counterpartyExposures)) {
    const ratio = tier1Capital > 0 ? exposure / tier1Capital : Infinity;
    results.push({
      counterpartyId: cpty,
      exposure,
      tier1Capital,
      exposureRatio: ratio,
      breachesLimit: exposure > limit,
      limit,
    });
  }

  return results.sort((a, b) => b.exposureRatio - a.exposureRatio);
}

// ─── Regulatory Capital Summary ─────────────────────────────────────────────

export interface RegulatoryCapitalSummary {
  marketRiskCapital: number;
  creditRiskCapital: number;
  operationalRiskCapital: number;
  totalCapitalRequirement: number;
  capitalSurplus: number;
  surplusRatio: number;
}

export function calculateRegulatoryCapital(
  availableCapital: number,
  marketRiskCapital: number,
  creditRiskCapital: number,
  operationalRiskCapital: number,
): RegulatoryCapitalSummary {
  const totalRequired = marketRiskCapital + creditRiskCapital + operationalRiskCapital;
  const surplus = availableCapital - totalRequired;

  return {
    marketRiskCapital,
    creditRiskCapital,
    operationalRiskCapital,
    totalCapitalRequirement: totalRequired,
    capitalSurplus: surplus,
    surplusRatio: totalRequired > 0 ? surplus / totalRequired : Infinity,
  };
}

// ─── Consolidated Regulatory Report ─────────────────────────────────────────

export function generateRegulatoryMetrics(
  baselMetrics: BaselIIIMetrics,
  frtbResult: FRTBResult,
  simmResult: ISDAMargin,
): RegulatoryMetric[] {
  const now = Date.now();

  return [
    { framework: 'basel_iii', metricName: 'CET1 Ratio', value: baselMetrics.cet1Ratio, threshold: 0.045, compliant: baselMetrics.cet1Ratio >= 0.045, reportingDate: now },
    { framework: 'basel_iii', metricName: 'Tier 1 Ratio', value: baselMetrics.tier1Ratio, threshold: 0.06, compliant: baselMetrics.tier1Ratio >= 0.06, reportingDate: now },
    { framework: 'basel_iii', metricName: 'Total Capital Ratio', value: baselMetrics.totalCapitalRatio, threshold: 0.08, compliant: baselMetrics.totalCapitalRatio >= 0.08, reportingDate: now },
    { framework: 'basel_iii', metricName: 'Leverage Ratio', value: baselMetrics.leverageRatio, threshold: 0.03, compliant: baselMetrics.leverageRatio >= 0.03, reportingDate: now },
    { framework: 'basel_iii', metricName: 'LCR', value: baselMetrics.lcr, threshold: 1.0, compliant: baselMetrics.lcr >= 1.0, reportingDate: now },
    { framework: 'basel_iii', metricName: 'NSFR', value: baselMetrics.nsfr, threshold: 1.0, compliant: baselMetrics.nsfr >= 1.0, reportingDate: now },
    { framework: 'frtb', metricName: 'SbM Total', value: frtbResult.sbm.total, threshold: Infinity, compliant: true, reportingDate: now, details: frtbResult.sbm },
    { framework: 'frtb', metricName: 'DRC', value: frtbResult.drc, threshold: Infinity, compliant: true, reportingDate: now },
    { framework: 'frtb', metricName: 'RRAO', value: frtbResult.rrao, threshold: Infinity, compliant: true, reportingDate: now },
    { framework: 'frtb', metricName: 'Total FRTB Charge', value: frtbResult.totalCapitalCharge, threshold: Infinity, compliant: true, reportingDate: now },
    { framework: 'isda_simm', metricName: 'Total SIMM Margin', value: simmResult.totalMargin, threshold: Infinity, compliant: true, reportingDate: now, details: simmResult.byRiskClass },
    { framework: 'isda_simm', metricName: 'Delta Margin', value: simmResult.deltaMargin, threshold: Infinity, compliant: true, reportingDate: now },
    { framework: 'isda_simm', metricName: 'Vega Margin', value: simmResult.vegaMargin, threshold: Infinity, compliant: true, reportingDate: now },
    { framework: 'isda_simm', metricName: 'Curvature Margin', value: simmResult.curvatureMargin, threshold: Infinity, compliant: true, reportingDate: now },
  ];
}
