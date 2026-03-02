import {
  OptionType,
  ExerciseStyle,
  OptionContract,
  Greeks,
  PricingResult,
  ConvergenceResult,
} from './types';
import { normalCDF, normalInvCDF } from './blackScholes';

// ─── CRR (Cox-Ross-Rubinstein) ──────────────────────────────────────────────

interface BinomialParams {
  u: number; // up factor
  d: number; // down factor
  p: number; // risk-neutral probability
}

function crrParams(sigma: number, r: number, q: number, dt: number): BinomialParams {
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  return { u, d, p };
}

// ─── Jarrow-Rudd (Equal Probability) ────────────────────────────────────────

function jarrowRuddParams(sigma: number, r: number, q: number, dt: number): BinomialParams {
  const nu = r - q - 0.5 * sigma * sigma;
  const u = Math.exp(nu * dt + sigma * Math.sqrt(dt));
  const d = Math.exp(nu * dt - sigma * Math.sqrt(dt));
  const p = 0.5;
  return { u, d, p };
}

// ─── Leisen-Reimer ──────────────────────────────────────────────────────────

function peizerPrattInversion(z: number, n: number): number {
  // Peizer-Pratt method 2 inversion for improved convergence
  const nOdd = n % 2 === 0 ? n + 1 : n;
  const term = z / (nOdd + 1.0 / 3.0 + 0.1 / (nOdd + 1));
  return 0.5 + 0.5 * Math.sign(z) * Math.sqrt(1 - Math.exp(-term * term * (nOdd + 1.0 / 6.0)));
}

function leisenReimerParams(
  S: number, K: number, T: number, sigma: number, r: number, q: number,
  n: number
): BinomialParams {
  const dt = T / n;
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const p = peizerPrattInversion(d2, n);
  const pPrime = peizerPrattInversion(d1, n);

  const u = Math.exp((r - q) * dt) * pPrime / p;
  const d = (Math.exp((r - q) * dt) - p * u) / (1 - p);

  return { u, d, p };
}

// ─── Core Binomial Engine ───────────────────────────────────────────────────

export type BinomialModel = 'CRR' | 'JR' | 'LR';

export interface BinomialConfig {
  steps: number;
  model: BinomialModel;
}

const DEFAULT_CONFIG: BinomialConfig = { steps: 200, model: 'CRR' };

function getParams(
  model: BinomialModel, S: number, K: number, T: number,
  sigma: number, r: number, q: number, n: number
): BinomialParams {
  const dt = T / n;
  switch (model) {
    case 'CRR': return crrParams(sigma, r, q, dt);
    case 'JR': return jarrowRuddParams(sigma, r, q, dt);
    case 'LR': return leisenReimerParams(S, K, T, sigma, r, q, n);
  }
}

/**
 * Price an option using a binomial tree.
 * Supports European, American, and Bermudan exercise styles.
 * Returns the full tree for Greeks computation when returnTree is true.
 */
export function binomialPrice(
  contract: OptionContract,
  config: Partial<BinomialConfig> = {}
): number {
  const { steps: n, model } = { ...DEFAULT_CONFIG, ...config };
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type, exerciseStyle } = contract;

  if (T <= 0) {
    return type === OptionType.CALL ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  const dt = T / n;
  const { u, d, p } = getParams(model, S, K, T, sigma, r, q, n);
  const disc = Math.exp(-r * dt);

  // Build terminal asset prices and option values
  const optionValues = new Float64Array(n + 1);

  for (let j = 0; j <= n; j++) {
    const price = S * Math.pow(u, n - j) * Math.pow(d, j);
    optionValues[j] = type === OptionType.CALL
      ? Math.max(price - K, 0)
      : Math.max(K - price, 0);
  }

  // Backward induction
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const holdValue = disc * (p * optionValues[j] + (1 - p) * optionValues[j + 1]);

      if (exerciseStyle === ExerciseStyle.AMERICAN) {
        const assetPrice = S * Math.pow(u, i - j) * Math.pow(d, j);
        const exerciseValue = type === OptionType.CALL
          ? Math.max(assetPrice - K, 0)
          : Math.max(K - assetPrice, 0);
        optionValues[j] = Math.max(holdValue, exerciseValue);
      } else if (exerciseStyle === ExerciseStyle.BERMUDAN) {
        // Allow exercise at every 10th step as a simple Bermudan approximation
        const canExercise = i % Math.max(1, Math.floor(n / 10)) === 0;
        if (canExercise) {
          const assetPrice = S * Math.pow(u, i - j) * Math.pow(d, j);
          const exerciseValue = type === OptionType.CALL
            ? Math.max(assetPrice - K, 0)
            : Math.max(K - assetPrice, 0);
          optionValues[j] = Math.max(holdValue, exerciseValue);
        } else {
          optionValues[j] = holdValue;
        }
      } else {
        optionValues[j] = holdValue;
      }
    }
  }

  return optionValues[0];
}

/**
 * Compute the early exercise boundary for American options.
 * Returns array of [time, criticalPrice] pairs.
 */
export function earlyExerciseBoundary(
  contract: OptionContract,
  config: Partial<BinomialConfig> = {}
): Array<[number, number]> {
  const { steps: n, model } = { ...DEFAULT_CONFIG, ...config };
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

  if (T <= 0) return [];

  const dt = T / n;
  const { u, d, p } = getParams(model, S, K, T, sigma, r, q, n);
  const disc = Math.exp(-r * dt);

  // Full tree for tracking exercise decisions
  const tree: Float64Array[] = [];
  const prices: Float64Array[] = [];

  for (let i = 0; i <= n; i++) {
    tree.push(new Float64Array(i + 1));
    prices.push(new Float64Array(i + 1));
  }

  // Forward: build price tree
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= i; j++) {
      prices[i][j] = S * Math.pow(u, i - j) * Math.pow(d, j);
    }
  }

  // Terminal values
  for (let j = 0; j <= n; j++) {
    tree[n][j] = type === OptionType.CALL
      ? Math.max(prices[n][j] - K, 0)
      : Math.max(K - prices[n][j], 0);
  }

  const boundary: Array<[number, number]> = [];

  // Backward induction with exercise tracking
  for (let i = n - 1; i >= 0; i--) {
    let criticalPrice = -1;
    for (let j = 0; j <= i; j++) {
      const holdValue = disc * (p * tree[i + 1][j] + (1 - p) * tree[i + 1][j + 1]);
      const assetPrice = prices[i][j];
      const exerciseValue = type === OptionType.CALL
        ? Math.max(assetPrice - K, 0)
        : Math.max(K - assetPrice, 0);

      if (exerciseValue > holdValue && exerciseValue > 0) {
        tree[i][j] = exerciseValue;
        // Track the boundary: for puts the highest price at which exercise is optimal
        if (type === OptionType.PUT) {
          if (criticalPrice < 0 || assetPrice > criticalPrice) criticalPrice = assetPrice;
        } else {
          if (criticalPrice < 0 || assetPrice < criticalPrice) criticalPrice = assetPrice;
        }
      } else {
        tree[i][j] = holdValue;
      }
    }
    if (criticalPrice > 0) {
      boundary.push([i * dt, criticalPrice]);
    }
  }

  return boundary;
}

// ─── Greeks via Finite Differences on the Tree ──────────────────────────────

function buildSmallTree(
  S: number, K: number, T: number, r: number, q: number, sigma: number,
  type: OptionType, exerciseStyle: ExerciseStyle,
  model: BinomialModel, n: number
): { f00: number; f10: number; f11: number; f20: number; f21: number; f22: number } {
  const dt = T / n;
  const { u, d, p } = getParams(model, S, K, T, sigma, r, q, n);
  const disc = Math.exp(-r * dt);

  const values = new Float64Array(n + 1);

  for (let j = 0; j <= n; j++) {
    const price = S * Math.pow(u, n - j) * Math.pow(d, j);
    values[j] = type === OptionType.CALL
      ? Math.max(price - K, 0)
      : Math.max(K - price, 0);
  }

  const savedN2 = new Float64Array(3);
  const savedN1 = new Float64Array(2);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const holdValue = disc * (p * values[j] + (1 - p) * values[j + 1]);
      if (exerciseStyle === ExerciseStyle.AMERICAN) {
        const assetPrice = S * Math.pow(u, i - j) * Math.pow(d, j);
        const exVal = type === OptionType.CALL
          ? Math.max(assetPrice - K, 0)
          : Math.max(K - assetPrice, 0);
        values[j] = Math.max(holdValue, exVal);
      } else {
        values[j] = holdValue;
      }
    }

    if (i === 2) {
      savedN2[0] = values[0]; savedN2[1] = values[1]; savedN2[2] = values[2];
    }
    if (i === 1) {
      savedN1[0] = values[0]; savedN1[1] = values[1];
    }
  }

  return {
    f00: values[0],
    f10: savedN1[0], f11: savedN1[1],
    f20: savedN2[0], f21: savedN2[1], f22: savedN2[2],
  };
}

export function binomialGreeks(
  contract: OptionContract,
  config: Partial<BinomialConfig> = {}
): Greeks {
  const { steps: n, model } = { ...DEFAULT_CONFIG, ...config };
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type, exerciseStyle } = contract;

  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, vanna: 0, volga: 0, charm: 0, veta: 0, speed: 0, zomma: 0, color: 0 };
  }

  const dt = T / n;
  const { u, d } = getParams(model, S, K, T, sigma, r, q, n);

  const tree = buildSmallTree(S, K, T, r, q, sigma, type, exerciseStyle, model, n);

  const S_u = S * u;
  const S_d = S * d;
  const S_uu = S * u * u;
  const S_dd = S * d * d;
  const S_ud = S * u * d;

  // Delta: (f_u - f_d) / (S_u - S_d)
  const delta = (tree.f10 - tree.f11) / (S_u - S_d);

  // Gamma: [(f_uu - f_ud)/(S_uu - S_ud) - (f_ud - f_dd)/(S_ud - S_dd)] / (0.5*(S_uu - S_dd))
  const gamma = (
    (tree.f20 - tree.f21) / (S_uu - S_ud) - (tree.f21 - tree.f22) / (S_ud - S_dd)
  ) / (0.5 * (S_uu - S_dd));

  // Theta: (f_ud - f_00) / (2*dt)
  const theta = (tree.f21 - tree.f00) / (2 * dt);

  // Vega via bump-and-revalue
  const dSigma = 0.01;
  const priceUp = binomialPrice({ ...contract, volatility: sigma + dSigma }, config);
  const priceDown = binomialPrice({ ...contract, volatility: Math.max(sigma - dSigma, 0.001) }, config);
  const vega = (priceUp - priceDown) / (2 * dSigma);

  // Rho via bump-and-revalue
  const dR = 0.001;
  const priceRUp = binomialPrice({ ...contract, riskFreeRate: r + dR }, config);
  const priceRDown = binomialPrice({ ...contract, riskFreeRate: r - dR }, config);
  const rho = (priceRUp - priceRDown) / (2 * dR);

  // Higher-order Greeks via finite differences
  const dS = S * 0.01;
  const contractUp = { ...contract, underlyingPrice: S + dS };
  const contractDown = { ...contract, underlyingPrice: S - dS };

  const priceSpotUp = binomialPrice(contractUp, config);
  const priceSpotDown = binomialPrice(contractDown, config);
  const basePrice = tree.f00;

  const deltaUp = (binomialPrice({ ...contractUp, volatility: sigma + dSigma }, config) -
    binomialPrice({ ...contractUp, volatility: Math.max(sigma - dSigma, 0.001) }, config)) / (2 * dSigma);
  const deltaDown = (binomialPrice({ ...contractDown, volatility: sigma + dSigma }, config) -
    binomialPrice({ ...contractDown, volatility: Math.max(sigma - dSigma, 0.001) }, config)) / (2 * dSigma);

  // Vanna: ∂²V/(∂S∂σ)
  const vegaSpotUp = (binomialPrice({ ...contractUp, volatility: sigma + dSigma }, config) -
    binomialPrice({ ...contractUp, volatility: Math.max(sigma - dSigma, 0.001) }, config)) / (2 * dSigma);
  const vegaSpotDown = (binomialPrice({ ...contractDown, volatility: sigma + dSigma }, config) -
    binomialPrice({ ...contractDown, volatility: Math.max(sigma - dSigma, 0.001) }, config)) / (2 * dSigma);
  const vanna = (vegaSpotUp - vegaSpotDown) / (2 * dS);

  // Volga: ∂²V/∂σ²
  const volga = (priceUp - 2 * basePrice + priceDown) / (dSigma * dSigma);

  // Charm: ∂Δ/∂T via bump
  const dT = T * 0.01;
  const deltaT1 = (() => {
    const c = { ...contract, expiry: T - dT };
    const p1 = binomialPrice({ ...c, underlyingPrice: S + dS }, config);
    const p2 = binomialPrice({ ...c, underlyingPrice: S - dS }, config);
    return (p1 - p2) / (2 * dS);
  })();
  const charm = -(deltaT1 - delta) / dT;

  // Veta: ∂Vega/∂T
  const vegaT1 = (() => {
    const c = { ...contract, expiry: T - dT };
    const p1 = binomialPrice({ ...c, volatility: sigma + dSigma }, config);
    const p2 = binomialPrice({ ...c, volatility: Math.max(sigma - dSigma, 0.001) }, config);
    return (p1 - p2) / (2 * dSigma);
  })();
  const veta = -(vegaT1 - vega) / dT;

  // Speed: ∂³V/∂S³
  const dS2 = dS;
  const priceMid = basePrice;
  const priceUp2 = binomialPrice({ ...contract, underlyingPrice: S + 2 * dS2 }, config);
  const priceDown2 = binomialPrice({ ...contract, underlyingPrice: S - 2 * dS2 }, config);
  const speed = (priceUp2 - 2 * priceSpotUp + 2 * priceSpotDown - priceDown2) / (2 * dS2 * dS2 * dS2);

  // Zomma: ∂Gamma/∂σ
  const gammaVolUp = (() => {
    const c = { ...contract, volatility: sigma + dSigma };
    const pu = binomialPrice({ ...c, underlyingPrice: S + dS }, config);
    const pd = binomialPrice({ ...c, underlyingPrice: S - dS }, config);
    const pm = binomialPrice(c, config);
    return (pu - 2 * pm + pd) / (dS * dS);
  })();
  const gammaVolDown = (() => {
    const c = { ...contract, volatility: Math.max(sigma - dSigma, 0.001) };
    const pu = binomialPrice({ ...c, underlyingPrice: S + dS }, config);
    const pd = binomialPrice({ ...c, underlyingPrice: S - dS }, config);
    const pm = binomialPrice(c, config);
    return (pu - 2 * pm + pd) / (dS * dS);
  })();
  const zomma = (gammaVolUp - gammaVolDown) / (2 * dSigma);

  // Color: ∂Gamma/∂T
  const gammaT1 = (() => {
    const c = { ...contract, expiry: T - dT };
    const pu = binomialPrice({ ...c, underlyingPrice: S + dS }, config);
    const pd = binomialPrice({ ...c, underlyingPrice: S - dS }, config);
    const pm = binomialPrice(c, config);
    return (pu - 2 * pm + pd) / (dS * dS);
  })();
  const color = -(gammaT1 - gamma) / dT;

  return { delta, gamma, theta, vega, rho, vanna, volga, charm, veta, speed, zomma, color };
}

export function binomialPriceAndGreeks(
  contract: OptionContract,
  config: Partial<BinomialConfig> = {}
): PricingResult {
  return {
    theoreticalPrice: binomialPrice(contract, config),
    greeks: binomialGreeks(contract, config),
  };
}

// ─── Convergence Analysis ───────────────────────────────────────────────────

/**
 * Analyze convergence by pricing with increasing number of steps.
 */
export function convergenceAnalysis(
  contract: OptionContract,
  model: BinomialModel = 'CRR',
  stepRange: number[] = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000]
): ConvergenceResult[] {
  return stepRange.map(steps => {
    const price = binomialPrice(contract, { steps, model });
    const dS = contract.underlyingPrice * 0.01;
    const pu = binomialPrice({ ...contract, underlyingPrice: contract.underlyingPrice + dS }, { steps, model });
    const pd = binomialPrice({ ...contract, underlyingPrice: contract.underlyingPrice - dS }, { steps, model });
    const delta = (pu - pd) / (2 * dS);
    return { steps, price, delta };
  });
}

/**
 * Price with Richardson extrapolation for faster convergence.
 * Uses prices at n and n/2 steps: P* = 2·P(n) - P(n/2)
 */
export function binomialRichardsonExtrapolation(
  contract: OptionContract,
  config: Partial<BinomialConfig> = {}
): number {
  const { steps: n, model } = { ...DEFAULT_CONFIG, ...config };
  const nHalf = Math.max(Math.floor(n / 2), 1);

  const priceN = binomialPrice(contract, { steps: n, model });
  const priceHalf = binomialPrice(contract, { steps: nHalf, model });

  return 2 * priceN - priceHalf;
}
