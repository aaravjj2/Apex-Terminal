/**
 * Options Pricing Models - Black-Scholes-Merton, Binomial (CRR), Greeks,
 * Volatility surface interpolation, IV smile, Strategy P&L calculator.
 */

import {
  OptionType,
  ExerciseStyle,
  OptionContract,
  Greeks as GreeksType,
  StrategyLeg,
  SABRParams,
} from './types';
import {
  bsPrice,
  bsCallPrice,
  bsPutPrice,
  bsDelta,
  bsGamma,
  bsTheta,
  bsVega,
  bsRho,
  bsAllGreeks,
  impliedVolatility,
  normalCDF,
  normalPDF,
  calcD1,
  calcD2,
} from './blackScholes';
import { binomialPrice, binomialPriceAndGreeks, BinomialConfig } from './binomial';

// ─── Black-Scholes-Merton ────────────────────────────────────────────────────

export interface BSMParams {
  S: number;
  K: number;
  T: number;
  r: number;
  q: number;
  sigma: number;
}

/**
 * Black-Scholes-Merton price for European option.
 */
export function bsmPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType
): number {
  return bsPrice(S, K, T, r, q, sigma, type);
}

/**
 * BSM delta.
 */
export function bsmDelta(S: number, K: number, T: number, r: number, q: number, sigma: number, type: OptionType): number {
  return bsDelta(S, K, T, r, q, sigma, type);
}

/**
 * BSM gamma.
 */
export function bsmGamma(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  return bsGamma(S, K, T, r, q, sigma);
}

/**
 * BSM theta per year.
 */
export function bsmTheta(S: number, K: number, T: number, r: number, q: number, sigma: number, type: OptionType): number {
  return bsTheta(S, K, T, r, q, sigma, type);
}

/**
 * BSM vega.
 */
export function bsmVega(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  return bsVega(S, K, T, r, q, sigma);
}

/**
 * BSM rho.
 */
export function bsmRho(S: number, K: number, T: number, r: number, q: number, sigma: number, type: OptionType): number {
  return bsRho(S, K, T, r, q, sigma, type);
}

/**
 * BSM implied volatility.
 */
export function bsmImpliedVol(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  type: OptionType,
  tolerance = 1e-8,
  maxIter = 100
): number {
  return impliedVolatility(marketPrice, S, K, T, r, q, type, tolerance, maxIter);
}

/**
 * Full BSM price and Greeks.
 */
export function bsmPriceAndGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType
): { price: number; greeks: GreeksType } {
  return {
    price: bsPrice(S, K, T, r, q, sigma, type),
    greeks: bsAllGreeks(S, K, T, r, q, sigma, type),
  };
}

// ─── Binomial Tree (Cox-Ross-Rubinstein) ─────────────────────────────────────

export interface BinomialTreeResult {
  price: number;
  greeks?: GreeksType;
  tree?: number[][];
}

const DEFAULT_BINOMIAL_STEPS = 200;

/**
 * Binomial tree (CRR) price.
 */
export function binomialTreePrice(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  exerciseStyle: ExerciseStyle = ExerciseStyle.EUROPEAN,
  steps: number = DEFAULT_BINOMIAL_STEPS
): number {
  const contract: OptionContract = {
    underlyingPrice: S,
    strike: K,
    expiry: T,
    riskFreeRate: r,
    dividendYield: q,
    volatility: sigma,
    type,
    exerciseStyle,
  };
  return binomialPrice(contract, { steps, model: 'CRR' });
}

/**
 * Binomial tree with Greeks.
 */
export function binomialTreePriceAndGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  exerciseStyle: ExerciseStyle = ExerciseStyle.EUROPEAN,
  steps: number = DEFAULT_BINOMIAL_STEPS
): BinomialTreeResult {
  const contract: OptionContract = {
    underlyingPrice: S,
    strike: K,
    expiry: T,
    riskFreeRate: r,
    dividendYield: q,
    volatility: sigma,
    type,
    exerciseStyle,
  };
  const result = binomialPriceAndGreeks(contract, { steps, model: 'CRR' });
  return {
    price: result.theoreticalPrice,
    greeks: result.greeks,
  };
}

// ─── Greeks via Finite Difference ─────────────────────────────────────────────

const FD_EPS_S = 0.0001;
const FD_EPS_SIGMA = 0.0001;
const FD_EPS_R = 0.0001;
const FD_EPS_T = 1 / 365;

export interface NumericalGreeksConfig {
  epsS?: number;
  epsSigma?: number;
  epsR?: number;
  epsT?: number;
  pricer: (S: number, K: number, T: number, r: number, q: number, sigma: number, type: OptionType) => number;
}

const defaultBSMPricer = (S: number, K: number, T: number, r: number, q: number, sigma: number, type: OptionType) =>
  bsPrice(S, K, T, r, q, sigma, type);

/**
 * Delta via central finite difference: (V(S+h) - V(S-h)) / (2h).
 */
export function numericalDelta(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsS ?? Math.max(S * FD_EPS_S, 0.01);
  const pricer = config?.pricer ?? defaultBSMPricer;
  const Vup = pricer(S + eps, K, T, r, q, sigma, type);
  const Vdown = pricer(S - eps, K, T, r, q, sigma, type);
  return (Vup - Vdown) / (2 * eps);
}

/**
 * Gamma via finite difference: (Delta(S+h) - Delta(S-h)) / (2h).
 */
export function numericalGamma(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsS ?? Math.max(S * FD_EPS_S, 0.01);
  const pricer = config?.pricer ?? defaultBSMPricer;
  const deltaUp = (pricer(S + eps, K, T, r, q, sigma, type) - pricer(S, K, T, r, q, sigma, type)) / eps;
  const deltaDown = (pricer(S, K, T, r, q, sigma, type) - pricer(S - eps, K, T, r, q, sigma, type)) / eps;
  return (deltaUp - deltaDown) / (2 * eps);
}

/**
 * Theta via forward difference: (V(T-dt) - V(T)) / dt.
 */
export function numericalTheta(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsT ?? Math.max(T * 0.01, FD_EPS_T);
  const pricer = config?.pricer ?? defaultBSMPricer;
  const T1 = Math.max(T - eps, 0);
  const V1 = pricer(S, K, T1, r, q, sigma, type);
  const V0 = pricer(S, K, T, r, q, sigma, type);
  return (V1 - V0) / eps;
}

/**
 * Vega via central difference.
 */
export function numericalVega(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsSigma ?? FD_EPS_SIGMA;
  const pricer = config?.pricer ?? defaultBSMPricer;
  const Vup = pricer(S, K, T, r, q, sigma + eps, type);
  const Vdown = pricer(S, K, T, r, q, Math.max(sigma - eps, 0.001), type);
  return (Vup - Vdown) / (2 * eps);
}

/**
 * Rho via central difference.
 */
export function numericalRho(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsR ?? FD_EPS_R;
  const pricer = config?.pricer ?? defaultBSMPricer;
  const Vup = pricer(S, K, T, r + eps, q, sigma, type);
  const Vdown = pricer(S, K, T, r - eps, q, sigma, type);
  return (Vup - Vdown) / (2 * eps);
}

/**
 * All Greeks via finite difference.
 */
export function numericalAllGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): GreeksType {
  return {
    delta: numericalDelta(S, K, T, r, q, sigma, type, config),
    gamma: numericalGamma(S, K, T, r, q, sigma, type, config),
    theta: numericalTheta(S, K, T, r, q, sigma, type, config),
    vega: numericalVega(S, K, T, r, q, sigma, type, config),
    rho: numericalRho(S, K, T, r, q, sigma, type, config),
    vanna: numericalVanna(S, K, T, r, q, sigma, type, config),
    volga: numericalVolga(S, K, T, r, q, sigma, type, config),
    charm: 0,
    veta: 0,
    speed: 0,
    zomma: 0,
    color: 0,
  };
}

function numericalVanna(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const epsS = config?.epsS ?? Math.max(S * FD_EPS_S, 0.01);
  const epsSig = config?.epsSigma ?? FD_EPS_SIGMA;
  const pricer = config?.pricer ?? defaultBSMPricer;
  const vegaUp = (pricer(S + epsS, K, T, r, q, sigma + epsSig, type) - pricer(S + epsS, K, T, r, q, sigma - epsSig, type)) / (2 * epsSig);
  const vegaDown = (pricer(S - epsS, K, T, r, q, sigma + epsSig, type) - pricer(S - epsS, K, T, r, q, sigma - epsSig, type)) / (2 * epsSig);
  return (vegaUp - vegaDown) / (2 * epsS);
}

function numericalVolga(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  config?: Partial<NumericalGreeksConfig>
): number {
  const eps = config?.epsSigma ?? FD_EPS_SIGMA;
  const pricer = config?.pricer ?? defaultBSMPricer;
  const vegaUp = (pricer(S, K, T, r, q, sigma + eps, type) - pricer(S, K, T, r, q, sigma, type)) / eps;
  const vegaDown = (pricer(S, K, T, r, q, sigma, type) - pricer(S, K, T, r, q, Math.max(sigma - eps, 0.001), type)) / eps;
  return (vegaUp - vegaDown) / (2 * eps);
}

// ─── Volatility Surface Interpolation ────────────────────────────────────────

export interface VolSurfaceInterpolator {
  getVol(strike: number, expiry: number): number;
  getVolFromMoneyness(moneyness: number, expiry: number): number;
}

/**
 * Bilinear interpolation on strike × expiry grid.
 */
export function createBilinearVolSurface(
  strikes: number[],
  expiries: number[],
  grid: number[][]  // grid[expiryIdx][strikeIdx] = IV
): VolSurfaceInterpolator {
  const sortedStrikes = [...strikes].sort((a, b) => a - b);
  const sortedExpiries = [...expiries].sort((a, b) => a - b);

  return {
    getVol(strike: number, expiry: number): number {
      if (sortedStrikes.length < 2 || sortedExpiries.length < 2) return grid[0]?.[0] ?? 0.2;
      let si = 0,
        ei = 0;
      while (si < sortedStrikes.length - 1 && sortedStrikes[si + 1] < strike) si++;
      while (ei < sortedExpiries.length - 1 && sortedExpiries[ei + 1] < expiry) ei++;
      const s0 = sortedStrikes[si];
      const s1 = sortedStrikes[Math.min(si + 1, sortedStrikes.length - 1)];
      const e0 = sortedExpiries[ei];
      const e1 = sortedExpiries[Math.min(ei + 1, sortedExpiries.length - 1)];
      const ws = s1 > s0 ? (strike - s0) / (s1 - s0) : 0;
      const we = e1 > e0 ? (expiry - e0) / (e1 - e0) : 0;
      const v00 = grid[ei]?.[si] ?? 0.2;
      const v01 = grid[ei]?.[si + 1] ?? v00;
      const v10 = grid[ei + 1]?.[si] ?? v00;
      const v11 = grid[ei + 1]?.[si + 1] ?? v01;
      return (1 - ws) * (1 - we) * v00 + ws * (1 - we) * v01 + (1 - ws) * we * v10 + ws * we * v11;
    },
    getVolFromMoneyness(moneyness: number, expiry: number): number {
      return 0.2; // Placeholder; would need spot
    },
  };
}

/**
 * Linear interpolation along strike for a fixed expiry.
 */
export function interpolateIVAlongStrike(
  strikes: number[],
  vols: number[],
  strike: number
): number {
  if (strikes.length !== vols.length || strikes.length === 0) return 0.2;
  if (strike <= strikes[0]) return vols[0];
  if (strike >= strikes[strikes.length - 1]) return vols[vols.length - 1];
  let i = 0;
  while (i < strikes.length - 1 && strikes[i + 1] < strike) i++;
  const w = (strike - strikes[i]) / (strikes[i + 1] - strikes[i]);
  return vols[i] * (1 - w) + vols[i + 1] * w;
}

/**
 * IV smile: fit quadratic in log-moneyness.
 * logMoneyness = log(K/F).
 */
export function fitIVSmile(
  strikes: number[],
  vols: number[],
  forward: number
): (strike: number) => number {
  const logM = strikes.map((K) => Math.log(K / forward));
  const n = logM.length;
  if (n < 3) return () => vols[0] ?? 0.2;
  // Fit a*x^2 + b*x + c
  let sx = 0,
    sx2 = 0,
    sx3 = 0,
    sx4 = 0,
    sy = 0,
    sxy = 0,
    sx2y = 0;
  for (let i = 0; i < n; i++) {
    const x = logM[i];
    const y = vols[i];
    sx += x;
    sx2 += x * x;
    sx3 += x * x * x;
    sx4 += x * x * x * x;
    sy += y;
    sxy += x * y;
    sx2y += x * x * y;
  }
  const denom = n * (sx2 * sx4 - sx3 * sx3) - sx * (sx * sx4 - sx3 * sx2) + sx2 * (sx * sx3 - sx2 * sx2);
  if (Math.abs(denom) < 1e-20) return () => vols[Math.floor(n / 2)] ?? 0.2;
  const c = (sy * (sx2 * sx4 - sx3 * sx3) - sx * (sxy * sx4 - sx2y * sx3) + sx2 * (sxy * sx3 - sx2y * sx2)) / denom;
  const b = (n * (sxy * sx4 - sx2y * sx3) - sx * (sy * sx4 - sx2y * sx2) + sx2 * (sy * sx3 - sxy * sx2)) / denom;
  const a = (n * (sx2 * sx2y - sxy * sx3) - sx * (sx2 * sy - sxy * sx) + sy * (sx * sx3 - sx2 * sx2)) / denom;
  return (strike: number) => {
    const x = Math.log(strike / forward);
    return Math.max(0.01, a * x * x + b * x + c);
  };
}

// ─── Strategy P&L Calculator ────────────────────────────────────────────────

export interface StrategyLegWithPrice extends StrategyLeg {
  currentPrice?: number;  // Mark-to-market price
}

export interface StrategyPnLInput {
  legs: StrategyLegWithPrice[];
  underlyingPrice: number;
  riskFreeRate: number;
  dividendYield: number;
  volatilities?: number[];  // Per-leg vol if not using surface
  volSurface?: VolSurfaceInterpolator;
}

export interface StrategyPnLResult {
  totalCost: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPct: number;
  legPnLs: number[];
  legValues: number[];
  legCosts: number[];
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  breakEvens: number[];
  maxProfit: number;
  maxLoss: number;
}

/**
 * Compute strategy cost (premium paid/received).
 */
export function strategyCost(legs: StrategyLeg[]): number {
  return legs.reduce((sum, leg) => sum + leg.quantity * leg.premium, 0);
}

/**
 * Price a single leg at given spot/vol.
 */
function priceLeg(
  leg: StrategyLegWithPrice,
  S: number,
  r: number,
  q: number,
  sigma: number
): number {
  if (leg.currentPrice != null) return leg.currentPrice;
  return bsPrice(S, leg.strike, leg.expiry, r, q, sigma, leg.type) * leg.quantity;
}

/**
 * Strategy P&L for multi-leg positions.
 */
export function strategyPnL(input: StrategyPnLInput): StrategyPnLResult {
  const { legs, underlyingPrice: S, riskFreeRate: r, dividendYield: q, volatilities, volSurface } = input;
  const legCosts = legs.map((l) => l.quantity * l.premium);
  const totalCost = legCosts.reduce((a, b) => a + b, 0);

  const legValues: number[] = [];
  const legPnLs: number[] = [];
  let delta = 0,
    gamma = 0,
    theta = 0,
    vega = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const sigma = volatilities?.[i] ?? volSurface?.getVol(leg.strike, leg.expiry) ?? 0.25;
    const v = priceLeg(leg, S, r, q, sigma);
    legValues.push(v);
    legPnLs.push(v - legCosts[i]);

    const g = bsAllGreeks(S, leg.strike, leg.expiry, r, q, sigma, leg.type);
    delta += g.delta * leg.quantity;
    gamma += g.gamma * leg.quantity;
    theta += g.theta * leg.quantity;
    vega += g.vega * leg.quantity;
  }

  const totalValue = legValues.reduce((a, b) => a + b, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost !== 0 ? (totalPnL / Math.abs(totalCost)) * 100 : 0;

  const breakEvens: number[] = [];
  for (const leg of legs) {
    const sigma = volatilities?.[legs.indexOf(leg)] ?? 0.25;
    const k = leg.strike;
    breakEvens.push(k);
  }

  let maxProfit = Infinity;
  let maxLoss = -Infinity;
  const testPrices = [S * 0.5, S * 0.75, S, S * 1.25, S * 1.5, S * 2];
  for (const Sp of testPrices) {
    let pnl = -totalCost;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const sigma = volatilities?.[i] ?? 0.25;
      pnl += bsPrice(Sp, leg.strike, leg.expiry, r, q, sigma, leg.type) * leg.quantity;
    }
    if (pnl > maxLoss) maxLoss = pnl;
    if (pnl < maxProfit) maxProfit = pnl;
  }
  maxProfit = maxProfit === Infinity ? 0 : -maxProfit;
  maxLoss = maxLoss === -Infinity ? 0 : maxLoss;

  return {
    totalCost,
    totalValue,
    totalPnL,
    totalPnLPct,
    legPnLs,
    legValues,
    legCosts,
    delta,
    gamma,
    theta,
    vega,
    breakEvens,
    maxProfit,
    maxLoss,
  };
}

/**
 * Payoff at expiry for a strategy (intrinsic value).
 */
export function strategyPayoffAtExpiry(
  legs: StrategyLeg[],
  underlyingPrice: number
): number {
  return legs.reduce((sum, leg) => {
    const intrinsic = leg.type === OptionType.CALL
      ? Math.max(underlyingPrice - leg.strike, 0)
      : Math.max(leg.strike - underlyingPrice, 0);
    return sum + leg.quantity * intrinsic;
  }, 0);
}

/**
 * Build payoff diagram data: underlyingPrices[], payoffs[].
 */
export function strategyPayoffDiagram(
  legs: StrategyLeg[],
  cost: number,
  priceMin: number,
  priceMax: number,
  numPoints: number = 100
): { underlyingPrices: number[]; payoffs: number[] } {
  const underlyingPrices: number[] = [];
  const payoffs: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const S = priceMin + (i / numPoints) * (priceMax - priceMin);
    const intrinsic = strategyPayoffAtExpiry(legs, S);
    underlyingPrices.push(S);
    payoffs.push(intrinsic - cost);
  }
  return { underlyingPrices, payoffs };
}

// ─── SABR / SVI Wrappers for Surface ──────────────────────────────────────────

import { sabrImpliedVol } from './volatilitySurface';
export { sabrImpliedVol };
export type { SABRParams };

/**
 * Create SABR-based vol surface for one expiry.
 */
export function createSABRVolSurface(
  F: number,
  T: number,
  params: SABRParams
): (strike: number) => number {
  return (strike: number) => sabrImpliedVol(F, strike, T, params);
}

// ─── Multi-Asset / Basket Strategy P&L ─────────────────────────────────────────

export interface BasketLeg {
  symbol: string;
  type: OptionType;
  strike: number;
  expiry: number;
  quantity: number;
  premium: number;
  underlyingPrice: number;
  volatility: number;
}

export function basketStrategyPnL(
  legs: BasketLeg[],
  riskFreeRate: number,
  dividendYield: number = 0
): { totalCost: number; totalValue: number; pnl: number; legValues: number[] } {
  const legCosts = legs.map((l) => l.quantity * l.premium);
  const totalCost = legCosts.reduce((a, b) => a + b, 0);
  const legValues = legs.map((l) =>
    bsPrice(l.underlyingPrice, l.strike, l.expiry, riskFreeRate, dividendYield, l.volatility, l.type) * l.quantity
  );
  const totalValue = legValues.reduce((a, b) => a + b, 0);
  return { totalCost, totalValue, pnl: totalValue - totalCost, legValues };
}

// ─── Scenario Analysis ───────────────────────────────────────────────────────

export interface ScenarioInput {
  legs: StrategyLeg[];
  baseSpot: number;
  spotRange: [number, number];
  baseVol: number;
  volRange: [number, number];
  riskFreeRate: number;
  dividendYield: number;
}

export interface ScenarioOutput {
  spotScenarios: { spot: number; pnl: number; delta: number }[];
  volScenarios: { vol: number; pnl: number; vega: number }[];
  cost: number;
}

export function runScenarioAnalysis(input: ScenarioInput): ScenarioOutput {
  const { legs, baseSpot, spotRange, baseVol, volRange, riskFreeRate, dividendYield } = input;
  const cost = strategyCost(legs);
  const spotScenarios: { spot: number; pnl: number; delta: number }[] = [];
  const volScenarios: { vol: number; pnl: number; vega: number }[] = [];

  for (let pct = 0.8; pct <= 1.2; pct += 0.05) {
    const spot = baseSpot * pct;
    let value = 0;
    let delta = 0;
    for (const leg of legs) {
      const v = bsPrice(spot, leg.strike, leg.expiry, riskFreeRate, dividendYield, baseVol, leg.type);
      value += v * leg.quantity;
      delta += bsDelta(spot, leg.strike, leg.expiry, riskFreeRate, dividendYield, baseVol, leg.type) * leg.quantity;
    }
    spotScenarios.push({ spot, pnl: value - cost, delta });
  }

  for (let pct = 0.5; pct <= 1.5; pct += 0.1) {
    const vol = baseVol * pct;
    let value = 0;
    let vega = 0;
    for (const leg of legs) {
      const v = bsPrice(baseSpot, leg.strike, leg.expiry, riskFreeRate, dividendYield, vol, leg.type);
      value += v * leg.quantity;
      vega += bsVega(baseSpot, leg.strike, leg.expiry, riskFreeRate, dividendYield, vol) * leg.quantity;
    }
    volScenarios.push({ vol, pnl: value - cost, vega });
  }

  return { spotScenarios, volScenarios, cost };
}

// ─── Put-Call Parity and Arbitrage ────────────────────────────────────────────

export function putCallParityCall(
  putPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  q: number
): number {
  return putPrice + S * Math.exp(-q * T) - K * Math.exp(-r * T);
}

export function putCallParityPut(
  callPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  q: number
): number {
  return callPrice - S * Math.exp(-q * T) + K * Math.exp(-r * T);
}

export function syntheticForward(S: number, K: number, T: number, r: number, q: number): number {
  return S * Math.exp(-q * T) - K * Math.exp(-r * T);
}

// ─── Forward and Futures Adjustments ──────────────────────────────────────────

export function forwardFromSpot(
  spot: number,
  r: number,
  q: number,
  T: number
): number {
  return spot * Math.exp((r - q) * T);
}

export function optionOnForward(
  F: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: OptionType
): number {
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const disc = Math.exp(-r * T);
  if (type === OptionType.CALL) {
    return disc * (F * normalCDF(d1) - K * normalCDF(d2));
  }
  return disc * (K * normalCDF(-d2) - F * normalCDF(-d1));
}

// ─── Discrete Dividend Handling ────────────────────────────────────────────────

export function adjustSpotForDividends(
  S: number,
  r: number,
  dividends: Array<{ date: number; amount: number }>,
  T: number
): number {
  let pv = 0;
  for (const d of dividends) {
    if (d.date > 0 && d.date <= T) {
      pv += d.amount * Math.exp(-r * d.date);
    }
  }
  return Math.max(S - pv, 0);
}

export function bsmWithDiscreteDividends(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: OptionType,
  dividends: Array<{ date: number; amount: number }>
): number {
  const Sadj = adjustSpotForDividends(S, r, dividends, T);
  return bsPrice(Sadj, K, T, r, 0, sigma, type);
}

// ─── Term Structure of Volatility ────────────────────────────────────────────

export function flatVolSurface(vol: number): VolSurfaceInterpolator {
  return {
    getVol(_strike: number, _expiry: number): number {
      return vol;
    },
    getVolFromMoneyness(_moneyness: number, _expiry: number): number {
      return vol;
    },
  };
}

export function volTermStructure(
  expiries: number[],
  vols: number[]
): (expiry: number) => number {
  return (expiry: number) => {
    if (expiry <= expiries[0]) return vols[0];
    if (expiry >= expiries[expiries.length - 1]) return vols[vols.length - 1];
    let i = 0;
    while (i < expiries.length - 1 && expiries[i + 1] < expiry) i++;
    const w = (expiry - expiries[i]) / (expiries[i + 1] - expiries[i]);
    return vols[i] * (1 - w) + vols[i + 1] * w;
  };
}

// ─── American vs European Comparison ────────────────────────────────────────────

export function earlyExercisePremium(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number,
  type: OptionType,
  binomialSteps: number = 200
): number {
  const americanContract: OptionContract = {
    underlyingPrice: S,
    strike: K,
    expiry: T,
    riskFreeRate: r,
    dividendYield: q,
    volatility: sigma,
    type,
    exerciseStyle: ExerciseStyle.AMERICAN,
  };
  const europeanContract: OptionContract = {
    ...americanContract,
    exerciseStyle: ExerciseStyle.EUROPEAN,
  };
  const americanPrice = binomialPrice(americanContract, { steps: binomialSteps, model: 'CRR' });
  const europeanPrice = binomialPrice(europeanContract, { steps: binomialSteps, model: 'CRR' });
  return americanPrice - europeanPrice;
}

// ─── Barrier Option Stubs (Binary) ────────────────────────────────────────────

export function digitalCallPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number
): number {
  const d2 = calcD2(S, K, T, r, q, sigma);
  return Math.exp(-r * T) * normalCDF(d2);
}

export function digitalPutPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  q: number,
  sigma: number
): number {
  const d2 = calcD2(S, K, T, r, q, sigma);
  return Math.exp(-r * T) * normalCDF(-d2);
}

// ─── Export Index ─────────────────────────────────────────────────────────────

export const PRICING_MODELS = {
  bsmPrice,
  bsmDelta,
  bsmGamma,
  bsmTheta,
  bsmVega,
  bsmRho,
  bsmImpliedVol,
  bsmPriceAndGreeks,
  binomialTreePrice,
  binomialTreePriceAndGreeks,
  numericalDelta,
  numericalGamma,
  numericalTheta,
  numericalVega,
  numericalRho,
  numericalAllGreeks,
  createBilinearVolSurface,
  interpolateIVAlongStrike,
  fitIVSmile,
  strategyCost,
  strategyPnL,
  strategyPayoffAtExpiry,
  strategyPayoffDiagram,
  basketStrategyPnL,
  runScenarioAnalysis,
  putCallParityCall,
  putCallParityPut,
  syntheticForward,
  forwardFromSpot,
  optionOnForward,
  adjustSpotForDividends,
  bsmWithDiscreteDividends,
  flatVolSurface,
  volTermStructure,
  earlyExercisePremium,
  digitalCallPrice,
  digitalPutPrice,
  createSABRVolSurface,
};
