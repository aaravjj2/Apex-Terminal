import type {
  FXPair, Currency, FXTenor, ForwardPoints, FXSwapQuote, FXSwapLeg,
  NDFContract, NDFSettlement, CrossCurrencyBasisSwap, CarryTradeMetrics,
  PPPValuation, FXVolSurface, FXOptionQuote, TechnicalLevel, FXBasket,
  CorrelationEntry, CentralBankPolicy,
} from './types';

// ── Gaussian helpers (Abramowitz & Stegun approximation) ──────────────
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937;
  const a4 = -1.821255978, a5 = 1.330274429;
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ── Cross rate matrix ─────────────────────────────────────────────────
export function buildCrossRateMatrix(
  pairs: FXPair[],
  currencies: string[],
): Record<string, Record<string, number>> {
  const rateToUSD: Record<string, number> = { USD: 1 };

  for (const p of pairs) {
    if (p.base === 'USD') rateToUSD[p.quote] = p.spotRate;
    else if (p.quote === 'USD') rateToUSD[p.base] = 1 / p.spotRate;
  }

  for (const p of pairs) {
    if (!rateToUSD[p.base] && rateToUSD[p.quote]) {
      rateToUSD[p.base] = rateToUSD[p.quote] / p.spotRate;
    } else if (!rateToUSD[p.quote] && rateToUSD[p.base]) {
      rateToUSD[p.quote] = rateToUSD[p.base] * p.spotRate;
    }
  }

  const matrix: Record<string, Record<string, number>> = {};
  for (const base of currencies) {
    matrix[base] = {};
    for (const quote of currencies) {
      if (base === quote) { matrix[base][quote] = 1; continue; }
      if (rateToUSD[base] && rateToUSD[quote]) {
        matrix[base][quote] = rateToUSD[quote] / rateToUSD[base];
      }
    }
  }
  return matrix;
}

// ── Triangular arbitrage detection ────────────────────────────────────
export interface TriangularArbitrageResult {
  path: [string, string, string];
  rates: [number, number, number];
  impliedRate: number;
  profit: number;      // % profit
  profitPips: number;
}

export function detectTriangularArbitrage(
  crossMatrix: Record<string, Record<string, number>>,
  currencies: string[],
  threshold = 0.0005,
): TriangularArbitrageResult[] {
  const results: TriangularArbitrageResult[] = [];
  const n = currencies.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        const a = currencies[i], b = currencies[j], c = currencies[k];
        const r1 = crossMatrix[a]?.[b];
        const r2 = crossMatrix[b]?.[c];
        const r3 = crossMatrix[c]?.[a];
        if (!r1 || !r2 || !r3) continue;

        const impliedRate = r1 * r2 * r3;
        const profit = impliedRate - 1;
        if (Math.abs(profit) > threshold) {
          results.push({
            path: [a, b, c],
            rates: [r1, r2, r3],
            impliedRate,
            profit,
            profitPips: profit * 10000,
          });
        }
      }
    }
  }
  return results.sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
}

// ── Forward points & outright forward ─────────────────────────────────
export function calculateForwardPoints(
  spot: number,
  domesticRate: number,
  foreignRate: number,
  tenor: FXTenor,
): ForwardPoints {
  const t = tenor.yearFraction;
  const outrightRate = spot * ((1 + domesticRate * t) / (1 + foreignRate * t));
  const points = (outrightRate - spot) * 10000;

  const halfSpread = 0.00005;
  return {
    tenor,
    points,
    outrightRate,
    bidPoints: points - halfSpread * 10000,
    askPoints: points + halfSpread * 10000,
  };
}

export function outrightForwardPrice(
  spot: number,
  rBase: number,
  rQuote: number,
  t: number,
): number {
  return spot * Math.exp((rQuote - rBase) * t);
}

// ── FX Swap pricing ──────────────────────────────────────────────────
export function priceFXSwap(
  spot: number,
  rBase: number,
  rQuote: number,
  nearDays: number,
  farDays: number,
  notionalBase: number,
): FXSwapQuote {
  const tNear = nearDays / 360;
  const tFar = farDays / 360;

  const nearRate = spot * ((1 + rQuote * tNear) / (1 + rBase * tNear));
  const farRate = spot * ((1 + rQuote * tFar) / (1 + rBase * tFar));

  const nearLeg: FXSwapLeg = {
    settlementDate: nearDays,
    rate: nearRate,
    notionalBase,
    notionalQuote: notionalBase * nearRate,
    direction: 'BUY',
  };

  const farLeg: FXSwapLeg = {
    settlementDate: farDays,
    rate: farRate,
    notionalBase,
    notionalQuote: notionalBase * farRate,
    direction: 'SELL',
  };

  return {
    nearLeg,
    farLeg,
    swapPoints: (farRate - nearRate) * 10000,
    allInCost: (farRate - nearRate) / nearRate,
  };
}

// ── Cross-currency basis swap ─────────────────────────────────────────
export function priceCrossCurrencyBasisSwap(
  swap: CrossCurrencyBasisSwap,
): { pvLeg1: number; pvLeg2: number; fairBasis: number } {
  const { notional1, notional2, tenor, rate1, rate2, basisSpread } = swap;
  const periods = Math.floor(tenor * 4); // quarterly payments
  const dt = 0.25;

  let pvLeg1 = 0, pvLeg2 = 0;
  for (let i = 1; i <= periods; i++) {
    const t = i * dt;
    const df1 = 1 / Math.pow(1 + rate1, t);
    const df2 = 1 / Math.pow(1 + rate2 + basisSpread / 10000, t);
    pvLeg1 += notional1 * rate1 * dt * df1;
    pvLeg2 += notional2 * (rate2 + basisSpread / 10000) * dt * df2;
  }
  pvLeg1 += notional1 / Math.pow(1 + rate1, tenor);
  pvLeg2 += notional2 / Math.pow(1 + rate2 + basisSpread / 10000, tenor);

  const fairBasis = (pvLeg1 / notional1 - pvLeg2 / notional2) * 10000;

  return { pvLeg1, pvLeg2, fairBasis };
}

// ── NDF pricing ───────────────────────────────────────────────────────
export function priceNDF(contract: NDFContract): { ndfRate: number; markToMarket: number } {
  const t = contract.fixingDate / 365;
  const spot = contract.pair.spotRate;
  const rBase = 0.05;  // implied from market
  const rQuote = 0.03;
  const ndfRate = spot * Math.exp((rQuote - rBase) * t);
  const markToMarket = contract.notional * (ndfRate - contract.agreedRate) /
    (1 + rQuote * t);
  return { ndfRate, markToMarket };
}

export function settleNDF(
  contract: NDFContract,
  fixingRate: number,
): NDFSettlement {
  const diff = fixingRate - contract.agreedRate;
  const settlementAmount = contract.notional * diff / fixingRate;
  return {
    fixingRate,
    settlementAmount: Math.abs(settlementAmount),
    direction: settlementAmount > 0 ? 'RECEIVE' : 'PAY',
  };
}

// ── Carry trade analysis ──────────────────────────────────────────────
export function analyzeCarryTrade(
  pair: string,
  highYieldRate: number,
  lowYieldRate: number,
  spotRate: number,
  volatility: number,
  holdingPeriod = 1,
): CarryTradeMetrics {
  const differential = highYieldRate - lowYieldRate;
  const annualizedCarry = differential * spotRate * 10000;
  const breakEvenMove = differential * spotRate;
  const expectedReturn = differential * holdingPeriod;
  const sharpeRatio = expectedReturn / (volatility * Math.sqrt(holdingPeriod));

  return {
    pair,
    rateHighYield: highYieldRate,
    rateLowYield: lowYieldRate,
    rateDifferential: differential,
    annualizedCarry,
    breakEvenMove,
    sharpeRatio,
  };
}

// ── REER (Real Effective Exchange Rate) ───────────────────────────────
export function calculateREER(
  baseCurrency: string,
  tradePartners: { currency: string; weight: number; nominalRate: number; cpiBase: number; cpiPartner: number }[],
): number {
  let logREER = 0;
  for (const p of tradePartners) {
    const realRate = p.nominalRate * (p.cpiBase / p.cpiPartner);
    logREER += p.weight * Math.log(realRate);
  }
  return Math.exp(logREER) * 100; // indexed to 100
}

// ── PPP valuation ─────────────────────────────────────────────────────
export function calculatePPP(
  pair: string,
  spotRate: number,
  inflationDomestic: number,
  inflationForeign: number,
  basePPPRate: number,
  historicalHalfLifeMonths: number,
): PPPValuation {
  const pppRate = basePPPRate * ((1 + inflationDomestic) / (1 + inflationForeign));
  const misalignment = (spotRate - pppRate) / pppRate;

  return {
    pair,
    pppRate,
    spotRate,
    misalignment,
    halfLife: historicalHalfLifeMonths,
  };
}

// ── FX Volatility surface ─────────────────────────────────────────────
export function buildFXVolSurface(
  pair: string,
  tenors: number[],
  atmVols: number[],
  rr25d: number[],
  bf25d: number[],
): FXVolSurface {
  const deltas = [0.10, 0.25, 0.50, 0.75, 0.90];
  const vols: number[][] = [];

  for (let i = 0; i < tenors.length; i++) {
    const atm = atmVols[i];
    const rr = rr25d[i];
    const bf = bf25d[i];

    const vol25dCall = atm + bf + rr / 2;
    const vol25dPut = atm + bf - rr / 2;
    const vol10dCall = atm + 2.5 * bf + 1.5 * rr;
    const vol10dPut = atm + 2.5 * bf - 1.5 * rr;

    vols.push([
      Math.max(vol10dPut, 0.001),
      Math.max(vol25dPut, 0.001),
      atm,
      Math.max(vol25dCall, 0.001),
      Math.max(vol10dCall, 0.001),
    ]);
  }

  return {
    pair,
    tenors,
    deltas,
    vols,
    atmVol: atmVols,
    riskReversal25d: rr25d,
    butterfly25d: bf25d,
  };
}

// ── Risk reversal & butterfly ─────────────────────────────────────────
export function riskReversal25d(vol25dCall: number, vol25dPut: number): number {
  return vol25dCall - vol25dPut;
}

export function butterfly25d(vol25dCall: number, vol25dPut: number, atmVol: number): number {
  return (vol25dCall + vol25dPut) / 2 - atmVol;
}

// ── Garman-Kohlhagen FX option pricing ────────────────────────────────
export function garmanKohlhagen(
  spot: number,
  strike: number,
  rDomestic: number,
  rForeign: number,
  vol: number,
  t: number,
  isCall: boolean,
): FXOptionQuote {
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (rDomestic - rForeign + 0.5 * vol * vol) * t) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;

  const dfDom = Math.exp(-rDomestic * t);
  const dfFor = Math.exp(-rForeign * t);

  let premium: number, delta: number;
  if (isCall) {
    premium = spot * dfFor * normalCDF(d1) - strike * dfDom * normalCDF(d2);
    delta = dfFor * normalCDF(d1);
  } else {
    premium = strike * dfDom * normalCDF(-d2) - spot * dfFor * normalCDF(-d1);
    delta = -dfFor * normalCDF(-d1);
  }

  const gamma = dfFor * normalPDF(d1) / (spot * vol * sqrtT);
  const vega = spot * dfFor * normalPDF(d1) * sqrtT;
  const theta = isCall
    ? -spot * dfFor * normalPDF(d1) * vol / (2 * sqrtT) + rForeign * spot * dfFor * normalCDF(d1) - rDomestic * strike * dfDom * normalCDF(d2)
    : -spot * dfFor * normalPDF(d1) * vol / (2 * sqrtT) - rForeign * spot * dfFor * normalCDF(-d1) + rDomestic * strike * dfDom * normalCDF(-d2);

  return {
    pair: '',
    strike,
    expiry: t,
    isCall,
    premium,
    delta,
    gamma,
    vega: vega / 100, // per 1% vol move
    theta: theta / 365,
    impliedVol: vol,
  };
}

// ── Implied vol solver via Newton-Raphson ─────────────────────────────
export function impliedVolFX(
  spot: number,
  strike: number,
  rDom: number,
  rFor: number,
  t: number,
  marketPrice: number,
  isCall: boolean,
  tol = 1e-8,
  maxIter = 100,
): number {
  let vol = 0.15;

  for (let i = 0; i < maxIter; i++) {
    const result = garmanKohlhagen(spot, strike, rDom, rFor, vol, t, isCall);
    const diff = result.premium - marketPrice;
    if (Math.abs(diff) < tol) return vol;

    const sqrtT = Math.sqrt(t);
    const d1 = (Math.log(spot / strike) + (rDom - rFor + 0.5 * vol * vol) * t) / (vol * sqrtT);
    const vegaRaw = spot * Math.exp(-rFor * t) * normalPDF(d1) * sqrtT;
    if (Math.abs(vegaRaw) < 1e-15) break;

    vol -= diff / vegaRaw;
    vol = Math.max(vol, 0.001);
  }
  return vol;
}

// ── Central bank policy impact ────────────────────────────────────────
export function analyzeCentralBankImpact(
  policy: CentralBankPolicy,
  historicalSensitivity: number, // pips per 25bps move
): { expectedMove: number; direction: 'STRENGTHEN' | 'WEAKEN' | 'NEUTRAL'; confidence: number } {
  const impliedChange = policy.marketImpliedRate - policy.currentRate;
  const surprisePotential = Math.abs(impliedChange) * 4; // 25bps units

  const expectedMove = surprisePotential * historicalSensitivity;
  const direction = policy.hawkishScore > 0.2
    ? 'STRENGTHEN'
    : policy.hawkishScore < -0.2
      ? 'WEAKEN'
      : 'NEUTRAL';

  const confidence = Math.min(Math.abs(policy.hawkishScore), 1);
  return { expectedMove, direction, confidence };
}

// ── Technical levels for FX ───────────────────────────────────────────
export function calculateTechnicalLevels(
  highs: number[],
  lows: number[],
  closes: number[],
): TechnicalLevel[] {
  const levels: TechnicalLevel[] = [];
  const n = closes.length;
  if (n < 5) return levels;

  // Pivot points (classic floor pivots)
  const h = highs[n - 1], l = lows[n - 1], c = closes[n - 1];
  const pivot = (h + l + c) / 3;
  const r1 = 2 * pivot - l;
  const s1 = 2 * pivot - h;
  const r2 = pivot + (h - l);
  const s2 = pivot - (h - l);
  const r3 = h + 2 * (pivot - l);
  const s3 = l - 2 * (h - pivot);

  levels.push(
    { level: pivot, type: 'PIVOT', strength: 0.9, touchCount: 0 },
    { level: r1, type: 'RESISTANCE', strength: 0.7, touchCount: 0 },
    { level: r2, type: 'RESISTANCE', strength: 0.6, touchCount: 0 },
    { level: r3, type: 'RESISTANCE', strength: 0.5, touchCount: 0 },
    { level: s1, type: 'SUPPORT', strength: 0.7, touchCount: 0 },
    { level: s2, type: 'SUPPORT', strength: 0.6, touchCount: 0 },
    { level: s3, type: 'SUPPORT', strength: 0.5, touchCount: 0 },
  );

  // Detect swing highs/lows as support/resistance
  for (let i = 2; i < n - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      let touches = 0;
      for (let j = 0; j < n; j++) {
        if (Math.abs(highs[j] - highs[i]) / highs[i] < 0.001) touches++;
      }
      levels.push({
        level: highs[i],
        type: 'RESISTANCE',
        strength: Math.min(touches / 5, 1),
        touchCount: touches,
      });
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      let touches = 0;
      for (let j = 0; j < n; j++) {
        if (Math.abs(lows[j] - lows[i]) / lows[i] < 0.001) touches++;
      }
      levels.push({
        level: lows[i],
        type: 'SUPPORT',
        strength: Math.min(touches / 5, 1),
        touchCount: touches,
      });
    }
  }

  return levels.sort((a, b) => a.level - b.level);
}

// ── Correlation matrix for FX pairs ───────────────────────────────────
export function calculateCorrelationMatrix(
  pairReturns: Record<string, number[]>,
  period?: number,
): CorrelationEntry[] {
  const pairs = Object.keys(pairReturns);
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      let r1 = pairReturns[pairs[i]];
      let r2 = pairReturns[pairs[j]];

      const len = Math.min(r1.length, r2.length);
      const p = period ? Math.min(period, len) : len;
      r1 = r1.slice(-p);
      r2 = r2.slice(-p);

      const mean1 = r1.reduce((s, v) => s + v, 0) / p;
      const mean2 = r2.reduce((s, v) => s + v, 0) / p;

      let cov = 0, var1 = 0, var2 = 0;
      for (let k = 0; k < p; k++) {
        const d1 = r1[k] - mean1, d2 = r2[k] - mean2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
      }
      const denom = Math.sqrt(var1 * var2);
      const correlation = denom > 0 ? cov / denom : 0;

      entries.push({
        pair1: pairs[i],
        pair2: pairs[j],
        correlation,
        period: p,
      });
    }
  }
  return entries;
}

// ── FX basket construction ────────────────────────────────────────────
export function constructFXBasket(
  name: string,
  weights: Record<string, number>,
  initialRates: Record<string, number>,
): FXBasket {
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  const normalizedWeights: Record<string, number> = {};
  for (const [ccy, w] of Object.entries(weights)) {
    normalizedWeights[ccy] = w / totalWeight;
  }

  let baseValue = 0;
  for (const [ccy, w] of Object.entries(normalizedWeights)) {
    baseValue += w * (initialRates[ccy] ?? 1);
  }

  return {
    name,
    weights: normalizedWeights,
    baseValue,
    currentValue: baseValue,
    returns: [0],
  };
}

export function updateFXBasket(
  basket: FXBasket,
  currentRates: Record<string, number>,
): FXBasket {
  let currentValue = 0;
  for (const [ccy, w] of Object.entries(basket.weights)) {
    currentValue += w * (currentRates[ccy] ?? 1);
  }
  const ret = (currentValue - basket.baseValue) / basket.baseValue;
  return {
    ...basket,
    currentValue,
    returns: [...basket.returns, ret],
  };
}

// ── Rolling correlation with decay ────────────────────────────────────
export function ewmaCorrelation(
  returns1: number[],
  returns2: number[],
  lambda = 0.94,
): number {
  const n = Math.min(returns1.length, returns2.length);
  if (n < 2) return 0;

  let mean1 = 0, mean2 = 0;
  for (let i = 0; i < n; i++) { mean1 += returns1[i]; mean2 += returns2[i]; }
  mean1 /= n; mean2 /= n;

  let cov = 0, var1 = 0, var2 = 0;
  let weight = 1;

  for (let i = n - 1; i >= 0; i--) {
    const d1 = returns1[i] - mean1, d2 = returns2[i] - mean2;
    cov += weight * d1 * d2;
    var1 += weight * d1 * d1;
    var2 += weight * d2 * d2;
    weight *= lambda;
  }

  const denom = Math.sqrt(var1 * var2);
  return denom > 0 ? cov / denom : 0;
}

// ── Interpolation helpers for vol surface ─────────────────────────────
export function interpolateVol(
  surface: FXVolSurface,
  targetDelta: number,
  targetTenor: number,
): number {
  const { tenors, deltas, vols } = surface;

  let ti = 0;
  for (let i = 0; i < tenors.length - 1; i++) {
    if (targetTenor >= tenors[i] && targetTenor <= tenors[i + 1]) { ti = i; break; }
  }
  const tFrac = tenors[ti + 1] !== tenors[ti]
    ? (targetTenor - tenors[ti]) / (tenors[ti + 1] - tenors[ti])
    : 0;

  let di = 0;
  for (let i = 0; i < deltas.length - 1; i++) {
    if (targetDelta >= deltas[i] && targetDelta <= deltas[i + 1]) { di = i; break; }
  }
  const dFrac = deltas[di + 1] !== deltas[di]
    ? (targetDelta - deltas[di]) / (deltas[di + 1] - deltas[di])
    : 0;

  // bilinear interpolation on total-variance space
  const tv = (t: number, d: number) => {
    const tIdx = Math.min(t, vols.length - 1);
    const dIdx = Math.min(d, vols[0].length - 1);
    return vols[tIdx][dIdx] * vols[tIdx][dIdx] * tenors[tIdx];
  };

  const tv00 = tv(ti, di);
  const tv01 = tv(ti, di + 1);
  const tv10 = tv(ti + 1, di);
  const tv11 = tv(ti + 1, di + 1);

  const interpTV = tv00 * (1 - tFrac) * (1 - dFrac)
    + tv01 * (1 - tFrac) * dFrac
    + tv10 * tFrac * (1 - dFrac)
    + tv11 * tFrac * dFrac;

  return targetTenor > 0 ? Math.sqrt(interpTV / targetTenor) : 0;
}

// ── Delta-to-strike conversion ────────────────────────────────────────
export function deltaToStrike(
  spot: number,
  rDom: number,
  rFor: number,
  vol: number,
  t: number,
  delta: number,
  isCall: boolean,
): number {
  const sqrtT = Math.sqrt(t);
  const fwd = spot * Math.exp((rDom - rFor) * t);
  const sign = isCall ? 1 : -1;

  // Premium-adjusted delta inversion via Newton's method
  let strike = fwd;
  for (let iter = 0; iter < 50; iter++) {
    const d1 = (Math.log(spot / strike) + (rDom - rFor + 0.5 * vol * vol) * t) / (vol * sqrtT);
    const modelDelta = sign * Math.exp(-rFor * t) * normalCDF(sign * d1);
    const err = modelDelta - delta;
    if (Math.abs(err) < 1e-10) break;

    const dStrike = err / (Math.exp(-rFor * t) * normalPDF(d1) / (strike * vol * sqrtT));
    strike += dStrike;
    strike = Math.max(strike, spot * 0.01);
  }
  return strike;
}

// ── Straddle breakeven analysis ───────────────────────────────────────
export function straddleBreakeven(
  spot: number,
  atmVol: number,
  t: number,
  rDom: number,
  rFor: number,
): { upperBreak: number; lowerBreak: number; totalPremium: number } {
  const call = garmanKohlhagen(spot, spot, rDom, rFor, atmVol, t, true);
  const put = garmanKohlhagen(spot, spot, rDom, rFor, atmVol, t, false);
  const totalPremium = call.premium + put.premium;

  return {
    upperBreak: spot + totalPremium,
    lowerBreak: spot - totalPremium,
    totalPremium,
  };
}
