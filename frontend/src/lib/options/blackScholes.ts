import {
  OptionType,
  OptionContract,
  Greeks,
  PricingResult,
  DiscreteDividend,
} from './types';

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const INV_SQRT_2 = 1 / Math.sqrt(2);

/**
 * Standard normal PDF: φ(x) = (1/√(2π)) * e^(-x²/2)
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/**
 * Standard normal CDF using Abramowitz & Stegun approximation (formula 26.2.17).
 * Maximum error: |ε(x)| < 7.5 × 10⁻⁸
 */
export function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const poly = b1 * t + b2 * t2 + b3 * t3 + b4 * t4 + b5 * t5;
  const cdf = 1.0 - normalPDF(absX) * poly;

  return sign === 1 ? cdf : 1.0 - cdf;
}

/**
 * Inverse normal CDF (quantile function) via rational approximation.
 * Beasley-Springer-Moro algorithm.
 */
export function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

export function calcD1(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return S >= K ? 100 : -100;
  return (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

export function calcD2(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return S >= K ? 100 : -100;
  return calcD1(S, K, T, r, q, sigma) - sigma * Math.sqrt(T);
}

/**
 * European call price under BSM with continuous dividend yield q.
 * C = S·e^(-qT)·N(d1) - K·e^(-rT)·N(d2)
 */
export function bsCallPrice(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0) return Math.max(S - K, 0);
  if (sigma <= 0) return Math.max(S * Math.exp(-q * T) - K * Math.exp(-r * T), 0);

  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);

  return S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

/**
 * European put price under BSM with continuous dividend yield q.
 * P = K·e^(-rT)·N(-d2) - S·e^(-qT)·N(-d1)
 */
export function bsPutPrice(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0) return Math.max(K - S, 0);
  if (sigma <= 0) return Math.max(K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);

  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);

  return K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
}

export function bsPrice(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): number {
  return type === OptionType.CALL
    ? bsCallPrice(S, K, T, r, q, sigma)
    : bsPutPrice(S, K, T, r, q, sigma);
}

// ─── Greeks ───────────────────────────────────────────────────────────────────

export function bsDelta(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): number {
  if (T <= 0) {
    if (type === OptionType.CALL) return S > K ? 1 : S === K ? 0.5 : 0;
    return S < K ? -1 : S === K ? -0.5 : 0;
  }
  const d1 = calcD1(S, K, T, r, q, sigma);
  const eqT = Math.exp(-q * T);
  return type === OptionType.CALL
    ? eqT * normalCDF(d1)
    : eqT * (normalCDF(d1) - 1);
}

export function bsGamma(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  return Math.exp(-q * T) * normalPDF(d1) / (S * sigma * Math.sqrt(T));
}

/**
 * Theta: time decay per year. Divide by 365 for daily theta.
 */
export function bsTheta(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): number {
  if (T <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const sqrtT = Math.sqrt(T);
  const eqT = Math.exp(-q * T);
  const erT = Math.exp(-r * T);

  const term1 = -(S * eqT * normalPDF(d1) * sigma) / (2 * sqrtT);

  if (type === OptionType.CALL) {
    return term1 + q * S * eqT * normalCDF(d1) - r * K * erT * normalCDF(d2);
  }
  return term1 - q * S * eqT * normalCDF(-d1) + r * K * erT * normalCDF(-d2);
}

export function bsVega(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  return S * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T);
}

export function bsRho(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): number {
  if (T <= 0) return 0;
  const d2 = calcD2(S, K, T, r, q, sigma);
  const erT = Math.exp(-r * T);
  return type === OptionType.CALL
    ? K * T * erT * normalCDF(d2)
    : -K * T * erT * normalCDF(-d2);
}

// ─── Second-order Greeks ──────────────────────────────────────────────────────

/**
 * Vanna: ∂Δ/∂σ = ∂Vega/∂S = -e^(-qT)·φ(d1)·d2/σ
 */
export function bsVanna(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  return -Math.exp(-q * T) * normalPDF(d1) * d2 / sigma;
}

/**
 * Volga (Vomma): ∂²V/∂σ² = Vega · d1·d2 / σ
 */
export function bsVolga(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const vega = bsVega(S, K, T, r, q, sigma);
  return vega * d1 * d2 / sigma;
}

/**
 * Charm: ∂Δ/∂T (delta decay)
 */
export function bsCharm(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const eqT = Math.exp(-q * T);
  const sqrtT = Math.sqrt(T);

  const pdfD1 = normalPDF(d1);
  const charmCommon = eqT * pdfD1 * (2 * (r - q) * T - d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT);

  if (type === OptionType.CALL) {
    return q * eqT * normalCDF(d1) - charmCommon;
  }
  return -q * eqT * normalCDF(-d1) - charmCommon;
}

/**
 * Veta: ∂Vega/∂T
 */
export function bsVeta(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const sqrtT = Math.sqrt(T);
  const eqT = Math.exp(-q * T);

  const vega = bsVega(S, K, T, r, q, sigma);
  const term = q + (r - q) * d1 / (sigma * sqrtT) - (1 + d1 * d2) / (2 * T);
  return vega * term;
}

/**
 * Speed: ∂³V/∂S³ = -(Gamma/S)·(d1/(σ√T) + 1)
 */
export function bsSpeed(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const gamma = bsGamma(S, K, T, r, q, sigma);
  return -(gamma / S) * (d1 / (sigma * Math.sqrt(T)) + 1);
}

/**
 * Zomma: ∂Gamma/∂σ = Gamma·(d1·d2 - 1)/σ
 */
export function bsZomma(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const gamma = bsGamma(S, K, T, r, q, sigma);
  return gamma * (d1 * d2 - 1) / sigma;
}

/**
 * Color: ∂Gamma/∂T (gamma decay)
 */
export function bsColor(
  S: number, K: number, T: number, r: number, q: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = calcD1(S, K, T, r, q, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const sqrtT = Math.sqrt(T);
  const eqT = Math.exp(-q * T);

  const pdfD1 = normalPDF(d1);
  const term = 2 * (r - q) * T - d2 * sigma * sqrtT;
  return -eqT * pdfD1 / (2 * S * T * sigma * sqrtT) * (2 * q * T + 1 + d1 * term / (sigma * sqrtT));
}

export function bsAllGreeks(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType
): Greeks {
  return {
    delta: bsDelta(S, K, T, r, q, sigma, type),
    gamma: bsGamma(S, K, T, r, q, sigma),
    theta: bsTheta(S, K, T, r, q, sigma, type),
    vega: bsVega(S, K, T, r, q, sigma),
    rho: bsRho(S, K, T, r, q, sigma, type),
    vanna: bsVanna(S, K, T, r, q, sigma),
    volga: bsVolga(S, K, T, r, q, sigma),
    charm: bsCharm(S, K, T, r, q, sigma, type),
    veta: bsVeta(S, K, T, r, q, sigma),
    speed: bsSpeed(S, K, T, r, q, sigma),
    zomma: bsZomma(S, K, T, r, q, sigma),
    color: bsColor(S, K, T, r, q, sigma),
  };
}

export function bsPriceAndGreeks(contract: OptionContract): PricingResult {
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;
  return {
    theoreticalPrice: bsPrice(S, K, T, r, q, sigma, type),
    greeks: bsAllGreeks(S, K, T, r, q, sigma, type),
  };
}

// ─── Implied Volatility ──────────────────────────────────────────────────────

/**
 * Newton-Raphson with bisection fallback.
 * Solves for σ such that BS(σ) = marketPrice.
 */
export function impliedVolatility(
  marketPrice: number,
  S: number, K: number, T: number, r: number, q: number,
  type: OptionType,
  tolerance: number = 1e-8,
  maxIterations: number = 100
): number {
  if (T <= 0) return 0;

  const intrinsic = type === OptionType.CALL
    ? Math.max(S * Math.exp(-q * T) - K * Math.exp(-r * T), 0)
    : Math.max(K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);

  if (marketPrice <= intrinsic) return 0;

  // Upper bound: no-arbitrage limit
  const upperBound = type === OptionType.CALL
    ? S * Math.exp(-q * T)
    : K * Math.exp(-r * T);
  if (marketPrice >= upperBound) return 0;

  // Manaster-Koehler seed
  let sigma = Math.sqrt(2 * Math.abs(Math.log(S / K) + (r - q) * T) / T);
  if (sigma < 0.01) sigma = 0.25;

  let lo = 1e-6;
  let hi = 5.0;

  for (let i = 0; i < maxIterations; i++) {
    const price = bsPrice(S, K, T, r, q, sigma, type);
    const diff = price - marketPrice;

    if (Math.abs(diff) < tolerance) return sigma;

    const vega = bsVega(S, K, T, r, q, sigma);

    if (vega > 1e-12) {
      const newtonStep = sigma - diff / vega;
      if (newtonStep > lo && newtonStep < hi) {
        if (diff > 0) hi = sigma;
        else lo = sigma;
        sigma = newtonStep;
        continue;
      }
    }

    // Bisection fallback
    if (diff > 0) hi = sigma;
    else lo = sigma;
    sigma = (lo + hi) / 2;
  }

  return sigma;
}

// ─── Put-Call Parity ─────────────────────────────────────────────────────────

/**
 * Verifies put-call parity: C - P = S·e^(-qT) - K·e^(-rT)
 * Returns the absolute deviation.
 */
export function putCallParityDeviation(
  callPrice: number, putPrice: number,
  S: number, K: number, T: number, r: number, q: number
): number {
  const lhs = callPrice - putPrice;
  const rhs = S * Math.exp(-q * T) - K * Math.exp(-r * T);
  return Math.abs(lhs - rhs);
}

export function putCallParityHolds(
  callPrice: number, putPrice: number,
  S: number, K: number, T: number, r: number, q: number,
  tolerance: number = 0.01
): boolean {
  return putCallParityDeviation(callPrice, putPrice, S, K, T, r, q) < tolerance;
}

/**
 * Compute synthetic call from put using put-call parity.
 */
export function syntheticCallFromPut(
  putPrice: number, S: number, K: number, T: number, r: number, q: number
): number {
  return putPrice + S * Math.exp(-q * T) - K * Math.exp(-r * T);
}

/**
 * Compute synthetic put from call using put-call parity.
 */
export function syntheticPutFromCall(
  callPrice: number, S: number, K: number, T: number, r: number, q: number
): number {
  return callPrice - S * Math.exp(-q * T) + K * Math.exp(-r * T);
}

// ─── Discrete Dividend Adjustment ────────────────────────────────────────────

/**
 * Adjust spot price for discrete dividends by subtracting PV of dividends
 * occurring before expiry.
 */
export function adjustForDiscreteDividends(
  S: number, r: number, dividends: DiscreteDividend[], T: number
): number {
  let pvDividends = 0;
  for (const div of dividends) {
    if (div.date > 0 && div.date <= T) {
      pvDividends += div.amount * Math.exp(-r * div.date);
    }
  }
  return Math.max(S - pvDividends, 0);
}

/**
 * Price a European option with discrete dividends.
 * Uses the escrowed dividend approach: S_adj = S - PV(dividends).
 */
export function bsPriceDiscreteDividends(
  S: number, K: number, T: number, r: number, sigma: number,
  type: OptionType, dividends: DiscreteDividend[]
): number {
  const adjustedS = adjustForDiscreteDividends(S, r, dividends, T);
  return bsPrice(adjustedS, K, T, r, 0, sigma, type);
}
