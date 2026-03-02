import type {
  CreditRating,
  CreditRatingAgency,
  SPRating,
  MoodysRating,
  ProbabilityOfDefault,
  LossGivenDefault,
  ExposureAtDefault,
  CreditVAResult,
  Position,
} from './types';

// ─── Rating Mapping Tables ──────────────────────────────────────────────────

const SP_TO_NUMERIC: Record<string, number> = {
  'AAA': 1, 'AA+': 2, 'AA': 3, 'AA-': 4,
  'A+': 5, 'A': 6, 'A-': 7,
  'BBB+': 8, 'BBB': 9, 'BBB-': 10,
  'BB+': 11, 'BB': 12, 'BB-': 13,
  'B+': 14, 'B': 15, 'B-': 16,
  'CCC+': 17, 'CCC': 18, 'CCC-': 19,
  'CC': 20, 'C': 21, 'D': 22,
};

const MOODYS_TO_SP: Record<string, SPRating> = {
  'Aaa': 'AAA', 'Aa1': 'AA+', 'Aa2': 'AA', 'Aa3': 'AA-',
  'A1': 'A+', 'A2': 'A', 'A3': 'A-',
  'Baa1': 'BBB+', 'Baa2': 'BBB', 'Baa3': 'BBB-',
  'Ba1': 'BB+', 'Ba2': 'BB', 'Ba3': 'BB-',
  'B1': 'B+', 'B2': 'B', 'B3': 'B-',
  'Caa1': 'CCC+', 'Caa2': 'CCC', 'Caa3': 'CCC-',
  'Ca': 'CC', 'C': 'C',
};

const FITCH_TO_SP: Record<string, SPRating> = {
  'AAA': 'AAA', 'AA+': 'AA+', 'AA': 'AA', 'AA-': 'AA-',
  'A+': 'A+', 'A': 'A', 'A-': 'A-',
  'BBB+': 'BBB+', 'BBB': 'BBB', 'BBB-': 'BBB-',
  'BB+': 'BB+', 'BB': 'BB', 'BB-': 'BB-',
  'B+': 'B+', 'B': 'B', 'B-': 'B-',
  'CCC+': 'CCC+', 'CCC': 'CCC', 'CCC-': 'CCC-',
  'CC': 'CC', 'C': 'C', 'D': 'D',
};

export function mapToSPEquivalent(agency: CreditRatingAgency, rating: string): SPRating {
  if (agency === 'sp') return rating as SPRating;
  if (agency === 'moodys') return MOODYS_TO_SP[rating] ?? 'CCC';
  return FITCH_TO_SP[rating] ?? 'CCC';
}

export function ratingToNumeric(rating: string): number {
  return SP_TO_NUMERIC[rating] ?? 18;
}

export function numericToRating(numeric: number): SPRating {
  const entries = Object.entries(SP_TO_NUMERIC);
  const match = entries.find(([_, v]) => v === Math.round(Math.max(1, Math.min(22, numeric))));
  return (match?.[0] ?? 'CCC') as SPRating;
}

export function isInvestmentGrade(rating: string): boolean {
  return ratingToNumeric(rating) <= 10;
}

// ─── Transition Matrix (1-year, S&P historical averages) ────────────────────

const RATING_LABELS: SPRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'];

const TRANSITION_MATRIX: number[][] = [
  // AAA    AA      A      BBB     BB      B      CCC     D
  [0.9081, 0.0833, 0.0068, 0.0006, 0.0012, 0.0000, 0.0000, 0.0000], // AAA
  [0.0070, 0.9065, 0.0779, 0.0064, 0.0006, 0.0014, 0.0002, 0.0000], // AA
  [0.0009, 0.0227, 0.9105, 0.0552, 0.0074, 0.0026, 0.0001, 0.0006], // A
  [0.0002, 0.0033, 0.0595, 0.8693, 0.0530, 0.0117, 0.0012, 0.0018], // BBB
  [0.0003, 0.0014, 0.0067, 0.0773, 0.8053, 0.0884, 0.0100, 0.0106], // BB
  [0.0000, 0.0011, 0.0024, 0.0043, 0.0648, 0.8346, 0.0407, 0.0521], // B
  [0.0022, 0.0000, 0.0022, 0.0130, 0.0238, 0.1124, 0.6486, 0.1978], // CCC
  [0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000], // D
];

export function getTransitionMatrix(): { labels: string[]; matrix: number[][] } {
  return { labels: [...RATING_LABELS], matrix: TRANSITION_MATRIX.map(r => [...r]) };
}

export function transitionProbability(fromRating: string, toRating: string): number {
  const fromIdx = RATING_LABELS.findIndex(r => r === simplifyRating(fromRating));
  const toIdx = RATING_LABELS.findIndex(r => r === simplifyRating(toRating));
  if (fromIdx < 0 || toIdx < 0) return 0;
  return TRANSITION_MATRIX[fromIdx][toIdx];
}

function simplifyRating(rating: string): string {
  const base = rating.replace(/[+-]$/, '');
  if (['AAA'].includes(base)) return 'AAA';
  if (['AA'].includes(base)) return 'AA';
  if (['A'].includes(base)) return 'A';
  if (['BBB'].includes(base)) return 'BBB';
  if (['BB'].includes(base)) return 'BB';
  if (['B'].includes(base)) return 'B';
  if (['CCC', 'CC', 'C'].includes(base)) return 'CCC';
  return 'D';
}

export function multiYearTransition(years: number): number[][] {
  let result = TRANSITION_MATRIX.map(r => [...r]);
  for (let y = 1; y < years; y++) {
    result = matMul(result, TRANSITION_MATRIX);
  }
  return result;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

// ─── Probability of Default ─────────────────────────────────────────────────

/** Historical PD by rating (1-year, S&P long-term average). */
const HISTORICAL_PD: Record<string, number> = {
  'AAA': 0.0001, 'AA+': 0.0002, 'AA': 0.0003, 'AA-': 0.0004,
  'A+': 0.0006, 'A': 0.0008, 'A-': 0.0012,
  'BBB+': 0.0018, 'BBB': 0.0027, 'BBB-': 0.0046,
  'BB+': 0.0079, 'BB': 0.0130, 'BB-': 0.0200,
  'B+': 0.0358, 'B': 0.0583, 'B-': 0.0891,
  'CCC+': 0.1500, 'CCC': 0.2600, 'CCC-': 0.3500,
  'CC': 0.4500, 'C': 0.6000, 'D': 1.0000,
};

export function historicalPD(rating: string): number {
  return HISTORICAL_PD[rating] ?? 0.05;
}

/**
 * Merton structural model for PD.
 * Models equity as a call option on the firm's assets; default occurs when
 * asset value falls below the debt face value at horizon.
 */
export function mertonPD(
  assetValue: number,
  debtFaceValue: number,
  assetVolatility: number,
  riskFreeRate: number,
  timeHorizon: number = 1,
): ProbabilityOfDefault {
  if (assetValue <= 0 || assetVolatility <= 0 || timeHorizon <= 0) {
    return { counterpartyId: '', pd1y: 1, pdCumulative: [1], method: 'merton', asOfDate: Date.now() };
  }

  const d2 = (Math.log(assetValue / debtFaceValue) + (riskFreeRate - 0.5 * assetVolatility ** 2) * timeHorizon)
             / (assetVolatility * Math.sqrt(timeHorizon));

  const pd = normalCDF(-d2);

  const cumPD: number[] = [];
  for (let t = 1; t <= 10; t++) {
    const d2t = (Math.log(assetValue / debtFaceValue) + (riskFreeRate - 0.5 * assetVolatility ** 2) * t)
               / (assetVolatility * Math.sqrt(t));
    cumPD.push(normalCDF(-d2t));
  }

  return {
    counterpartyId: '',
    pd1y: Math.max(0, Math.min(1, pd)),
    pdCumulative: cumPD.map(p => Math.max(0, Math.min(1, p))),
    method: 'merton',
    asOfDate: Date.now(),
  };
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

function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    const num = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]);
    const den = ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return num / den;
  }
}

/**
 * Altman Z-Score model for manufacturing firms.
 * Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
 */
export function altmanZScore(
  workingCapital: number,
  retainedEarnings: number,
  ebit: number,
  marketEquity: number,
  totalLiabilities: number,
  sales: number,
  totalAssets: number,
): { zScore: number; classification: 'safe' | 'grey' | 'distress'; impliedPD: number } {
  if (totalAssets === 0) {
    return { zScore: 0, classification: 'distress', impliedPD: 1 };
  }

  const x1 = workingCapital / totalAssets;
  const x2 = retainedEarnings / totalAssets;
  const x3 = ebit / totalAssets;
  const x4 = totalLiabilities > 0 ? marketEquity / totalLiabilities : 10;
  const x5 = sales / totalAssets;

  const z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;

  let classification: 'safe' | 'grey' | 'distress';
  if (z > 2.99) classification = 'safe';
  else if (z > 1.81) classification = 'grey';
  else classification = 'distress';

  const impliedPD = 1 / (1 + Math.exp(z - 2.5));

  return { zScore: z, classification, impliedPD: Math.max(0, Math.min(1, impliedPD)) };
}

export function altmanZScorePD(counterpartyId: string, zScore: number): ProbabilityOfDefault {
  const pd = 1 / (1 + Math.exp(zScore - 2.5));
  const cumPD: number[] = [];
  for (let t = 1; t <= 10; t++) {
    cumPD.push(1 - Math.pow(1 - pd, t));
  }

  return {
    counterpartyId,
    pd1y: Math.max(0, Math.min(1, pd)),
    pdCumulative: cumPD,
    method: 'altman_z',
    asOfDate: Date.now(),
  };
}

// ─── Loss Given Default ─────────────────────────────────────────────────────

const SENIORITY_LGD: Record<string, number> = {
  'senior_secured': 0.35,
  'senior_unsecured': 0.45,
  'subordinated': 0.65,
  'junior': 0.75,
};

export function estimateLGD(
  instrumentType: string,
  seniority: 'senior_secured' | 'senior_unsecured' | 'subordinated' | 'junior',
  collateralValue: number = 0,
  exposureValue: number = 0,
): LossGivenDefault {
  let baseLGD = SENIORITY_LGD[seniority] ?? 0.50;

  if (exposureValue > 0 && collateralValue > 0) {
    const collateralCoverage = collateralValue / exposureValue;
    baseLGD = Math.max(0, baseLGD * (1 - collateralCoverage * 0.8));
  }

  return {
    instrumentType,
    seniority,
    lgd: Math.max(0, Math.min(1, baseLGD)),
    recoveryRate: 1 - Math.max(0, Math.min(1, baseLGD)),
  };
}

// ─── Exposure at Default ────────────────────────────────────────────────────

export function calculateEAD(
  counterpartyId: string,
  currentExposure: number,
  unusedCommitment: number = 0,
  creditConversionFactor: number = 0.5,
  nettingBenefit: number = 0,
): ExposureAtDefault {
  const potentialFuture = unusedCommitment * creditConversionFactor;
  const grossEAD = currentExposure + potentialFuture;
  const ead = Math.max(grossEAD - nettingBenefit, 0);

  return {
    counterpartyId,
    currentExposure,
    potentialFutureExposure: potentialFuture,
    ead,
    nettingSetId: undefined,
  };
}

// ─── Expected & Unexpected Loss ─────────────────────────────────────────────

export function expectedLoss(pd: number, lgd: number, ead: number): number {
  return pd * lgd * ead;
}

export function unexpectedLoss(
  pd: number,
  lgd: number,
  ead: number,
  lgdVolatility: number = 0.25,
): number {
  const elSq = pd * lgd * lgd + pd * (1 - pd) * lgdVolatility * lgdVolatility;
  return ead * Math.sqrt(Math.max(elSq - (pd * lgd) ** 2, 0));
}

/**
 * Portfolio credit VaR using single-factor Gaussian copula (Vasicek model).
 * Uses the asymptotic single risk factor (ASRF) approach from Basel II.
 */
export function creditVaR(
  pds: number[],
  lgds: number[],
  eads: number[],
  assetCorrelation: number = 0.20,
  confidence: number = 0.999,
): number {
  let totalVaR = 0;
  const z = normalInv(confidence);

  for (let i = 0; i < pds.length; i++) {
    const pd = pds[i];
    const lgd = lgds[i];
    const ead = eads[i];

    if (pd <= 0 || pd >= 1) {
      totalVaR += pd >= 1 ? lgd * ead : 0;
      continue;
    }

    const rho = assetCorrelation;
    const conditionalPD = normalCDF(
      (normalInv(pd) + Math.sqrt(rho) * z) / Math.sqrt(1 - rho),
    );

    totalVaR += lgd * ead * conditionalPD;
  }

  const el = pds.reduce((s, pd, i) => s + pd * lgds[i] * eads[i], 0);
  return Math.max(totalVaR - el, 0);
}

/**
 * Credit VaR via Monte Carlo simulation with correlated defaults.
 */
export function creditVaRMonteCarlo(
  pds: number[],
  lgds: number[],
  eads: number[],
  correlationMatrix: number[][],
  confidence: number = 0.999,
  simulations: number = 10000,
): number {
  const n = pds.length;
  const L = choleskyDecomposition(correlationMatrix);
  const losses: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const z = Array.from({ length: n }, () => boxMullerNormal());
    const correlated: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        correlated[i] += L[i][j] * z[j];
      }
    }

    let loss = 0;
    for (let i = 0; i < n; i++) {
      const defaultThreshold = normalInv(pds[i]);
      if (correlated[i] < defaultThreshold) {
        loss += lgds[i] * eads[i];
      }
    }
    losses.push(loss);
  }

  losses.sort((a, b) => a - b);
  const varIdx = Math.floor(confidence * simulations);
  const varValue = losses[Math.min(varIdx, losses.length - 1)];
  const el = pds.reduce((s, pd, i) => s + pd * lgds[i] * eads[i], 0);

  return Math.max(varValue - el, 0);
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      L[i][j] = i === j
        ? Math.sqrt(Math.max(matrix[i][i] - sum, 1e-12))
        : (matrix[i][j] - sum) / L[j][j];
    }
  }
  return L;
}

function boxMullerNormal(): number {
  let u1: number;
  do { u1 = Math.random(); } while (u1 === 0);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
}

// ─── Credit Spread Analysis ─────────────────────────────────────────────────

export function creditSpreadFromPD(pd: number, lgd: number, riskPremium: number = 0.005): number {
  if (pd <= 0) return riskPremium;
  return pd * lgd + riskPremium;
}

export function impliedPDFromSpread(spread: number, lgd: number): number {
  if (lgd <= 0) return 0;
  return Math.max(0, Math.min(1, spread / lgd));
}

export function creditSpreadDuration(
  spread: number,
  maturity: number,
  couponFrequency: number = 2,
): number {
  const periods = maturity * couponFrequency;
  const coupon = spread / couponFrequency;
  let weightedTime = 0;
  let totalPV = 0;

  for (let t = 1; t <= periods; t++) {
    const time = t / couponFrequency;
    const df = Math.exp(-spread * time);
    const cf = t === periods ? coupon + 1 : coupon;
    weightedTime += time * cf * df;
    totalPV += cf * df;
  }

  return totalPV > 0 ? weightedTime / totalPV : maturity;
}

// ─── CDS Pricing (Constant Hazard Rate) ────────────────────────────────────

export function cdsPremium(
  pd: number,
  lgd: number,
  maturity: number = 5,
  riskFreeRate: number = 0.03,
  paymentFrequency: number = 4,
): number {
  if (pd <= 0 || lgd <= 0) return 0;

  const lambda = -Math.log(1 - pd);
  const periods = maturity * paymentFrequency;
  const dt = 1 / paymentFrequency;

  let protectionLeg = 0;
  let premiumLeg = 0;

  for (let i = 1; i <= periods; i++) {
    const t = i * dt;
    const survivalProb = Math.exp(-lambda * t);
    const prevSurvival = Math.exp(-lambda * (t - dt));
    const defaultProb = prevSurvival - survivalProb;
    const df = Math.exp(-riskFreeRate * t);

    protectionLeg += lgd * defaultProb * df;
    premiumLeg += survivalProb * dt * df;
  }

  return premiumLeg > 0 ? protectionLeg / premiumLeg : 0;
}

export function cdsMarkToMarket(
  contractSpread: number,
  currentSpread: number,
  notional: number,
  remainingMaturity: number,
  riskFreeRate: number = 0.03,
): number {
  const riskyDuration = (1 - Math.exp(-currentSpread * remainingMaturity)) / currentSpread;
  return notional * (currentSpread - contractSpread) * riskyDuration;
}

// ─── XVA: CVA, DVA, FVA ────────────────────────────────────────────────────

/**
 * CVA = sum over time buckets of: DiscountFactor × DefaultProb × LGD × ExpectedExposure
 */
export function calculateCVA(
  expectedExposureProfile: number[],
  counterpartyPD: number,
  counterpartyLGD: number,
  riskFreeRate: number = 0.03,
  timeStep: number = 0.25,
): number {
  const lambda = -Math.log(1 - counterpartyPD);
  let cva = 0;

  for (let i = 0; i < expectedExposureProfile.length; i++) {
    const t = (i + 1) * timeStep;
    const survivalPrev = Math.exp(-lambda * (t - timeStep));
    const survivalCurr = Math.exp(-lambda * t);
    const defaultProb = survivalPrev - survivalCurr;
    const df = Math.exp(-riskFreeRate * t);

    cva += df * defaultProb * counterpartyLGD * expectedExposureProfile[i];
  }

  return cva;
}

export function calculateDVA(
  expectedNegativeExposureProfile: number[],
  ownPD: number,
  ownLGD: number,
  riskFreeRate: number = 0.03,
  timeStep: number = 0.25,
): number {
  const lambda = -Math.log(1 - ownPD);
  let dva = 0;

  for (let i = 0; i < expectedNegativeExposureProfile.length; i++) {
    const t = (i + 1) * timeStep;
    const survivalPrev = Math.exp(-lambda * (t - timeStep));
    const survivalCurr = Math.exp(-lambda * t);
    const defaultProb = survivalPrev - survivalCurr;
    const df = Math.exp(-riskFreeRate * t);

    dva += df * defaultProb * ownLGD * Math.abs(expectedNegativeExposureProfile[i]);
  }

  return dva;
}

export function calculateFVA(
  expectedExposureProfile: number[],
  fundingSpread: number,
  riskFreeRate: number = 0.03,
  timeStep: number = 0.25,
): number {
  let fva = 0;
  for (let i = 0; i < expectedExposureProfile.length; i++) {
    const t = (i + 1) * timeStep;
    const df = Math.exp(-riskFreeRate * t);
    fva += df * fundingSpread * timeStep * expectedExposureProfile[i];
  }
  return fva;
}

export function calculateBilateralCVA(
  expectedExposureProfile: number[],
  expectedNegativeExposureProfile: number[],
  counterpartyPD: number,
  counterpartyLGD: number,
  ownPD: number,
  ownLGD: number,
  riskFreeRate: number = 0.03,
  timeStep: number = 0.25,
): CreditVAResult {
  const cva = calculateCVA(expectedExposureProfile, counterpartyPD, counterpartyLGD, riskFreeRate, timeStep);
  const dva = calculateDVA(expectedNegativeExposureProfile, ownPD, ownLGD, riskFreeRate, timeStep);

  return {
    cva,
    dva,
    fva: 0,
    bilateral: cva - dva,
    byCounterparty: {},
  };
}

// ─── Wrong-Way Risk ─────────────────────────────────────────────────────────

export function identifyWrongWayRisk(
  positions: Position[],
  counterpartyRating: string,
  counterpartySector: string,
): { positionId: string; symbol: string; wwrType: 'specific' | 'general'; severity: 'low' | 'medium' | 'high' }[] {
  const results: { positionId: string; symbol: string; wwrType: 'specific' | 'general'; severity: 'low' | 'medium' | 'high' }[] = [];

  for (const pos of positions) {
    if (pos.sector === counterpartySector && pos.quantity > 0) {
      results.push({
        positionId: pos.id,
        symbol: pos.symbol,
        wwrType: 'specific',
        severity: ratingToNumeric(counterpartyRating) > 13 ? 'high' : 'medium',
      });
    }

    if (pos.counterpartyId && pos.quantity > 0 && pos.assetClass === 'credit_spread') {
      results.push({
        positionId: pos.id,
        symbol: pos.symbol,
        wwrType: 'specific',
        severity: 'high',
      });
    }
  }

  return results;
}

// ─── Credit Migration Analysis ──────────────────────────────────────────────

export function creditMigrationPnL(
  notional: number,
  currentRating: string,
  spread: number,
  maturity: number,
  riskFreeRate: number = 0.03,
): Record<string, number> {
  const results: Record<string, number> = {};
  const currentIdx = RATING_LABELS.findIndex(r => r === simplifyRating(currentRating));
  if (currentIdx < 0) return results;

  for (let j = 0; j < RATING_LABELS.length; j++) {
    const targetRating = RATING_LABELS[j];
    const prob = TRANSITION_MATRIX[currentIdx][j];

    if (targetRating === 'D') {
      const lgd = SENIORITY_LGD['senior_unsecured'];
      results[targetRating] = -notional * lgd * prob;
    } else {
      const impliedSpread = creditSpreadFromPD(historicalPD(targetRating), 0.45);
      const spreadChange = impliedSpread - spread;
      const duration = creditSpreadDuration(spread, maturity);
      results[targetRating] = -notional * duration * spreadChange * prob;
    }
  }

  return results;
}

// ─── Portfolio Credit Concentration ─────────────────────────────────────────

export function creditConcentration(
  positions: Position[],
): {
  byCounterparty: Record<string, number>;
  bySector: Record<string, number>;
  byRating: Record<string, number>;
  herfindahl: number;
} {
  const totalExposure = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const byCounterparty: Record<string, number> = {};
  const bySector: Record<string, number> = {};

  for (const pos of positions) {
    const cpty = pos.counterpartyId ?? pos.symbol;
    byCounterparty[cpty] = (byCounterparty[cpty] ?? 0) + Math.abs(pos.marketValue);
    const sector = pos.sector ?? 'Unknown';
    bySector[sector] = (bySector[sector] ?? 0) + Math.abs(pos.marketValue);
  }

  const weights = Object.values(byCounterparty).map(v => totalExposure > 0 ? v / totalExposure : 0);
  const herfindahl = weights.reduce((s, w) => s + w * w, 0);

  const byRating: Record<string, number> = {};

  return { byCounterparty, bySector, byRating, herfindahl };
}

// ─── Sector Credit Exposure ─────────────────────────────────────────────────

export function sectorCreditExposure(
  positions: Position[],
): Record<string, { exposure: number; pctOfTotal: number; avgPD: number }> {
  const totalExposure = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const sectors: Record<string, { exposure: number; count: number; pdSum: number }> = {};

  for (const pos of positions) {
    const sector = pos.sector ?? 'Unknown';
    if (!sectors[sector]) sectors[sector] = { exposure: 0, count: 0, pdSum: 0 };
    sectors[sector].exposure += Math.abs(pos.marketValue);
    sectors[sector].count++;
    sectors[sector].pdSum += 0.02;
  }

  const result: Record<string, { exposure: number; pctOfTotal: number; avgPD: number }> = {};
  for (const [sector, data] of Object.entries(sectors)) {
    result[sector] = {
      exposure: data.exposure,
      pctOfTotal: totalExposure > 0 ? data.exposure / totalExposure : 0,
      avgPD: data.count > 0 ? data.pdSum / data.count : 0,
    };
  }

  return result;
}
