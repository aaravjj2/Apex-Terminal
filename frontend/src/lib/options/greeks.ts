import {
  OptionType,
  OptionContract,
  Greeks,
  PortfolioPosition,
  DeltaHedgeResult,
  GammaScalpResult,
} from './types';
import {
  bsAllGreeks,
  bsPrice,
  bsDelta,
  bsGamma,
  bsTheta,
  bsVega,
  normalCDF,
  calcD1,
  calcD2,
} from './blackScholes';

// ─── Portfolio-Level Greeks ─────────────────────────────────────────────────

export function emptyGreeks(): Greeks {
  return {
    delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0,
    vanna: 0, volga: 0, charm: 0, veta: 0, speed: 0, zomma: 0, color: 0,
  };
}

export function addGreeks(a: Greeks, b: Greeks, bScale: number = 1): Greeks {
  return {
    delta: a.delta + bScale * b.delta,
    gamma: a.gamma + bScale * b.gamma,
    theta: a.theta + bScale * b.theta,
    vega: a.vega + bScale * b.vega,
    rho: a.rho + bScale * b.rho,
    vanna: a.vanna + bScale * b.vanna,
    volga: a.volga + bScale * b.volga,
    charm: a.charm + bScale * b.charm,
    veta: a.veta + bScale * b.veta,
    speed: a.speed + bScale * b.speed,
    zomma: a.zomma + bScale * b.zomma,
    color: a.color + bScale * b.color,
  };
}

export function scaleGreeks(g: Greeks, factor: number): Greeks {
  return {
    delta: g.delta * factor,
    gamma: g.gamma * factor,
    theta: g.theta * factor,
    vega: g.vega * factor,
    rho: g.rho * factor,
    vanna: g.vanna * factor,
    volga: g.volga * factor,
    charm: g.charm * factor,
    veta: g.veta * factor,
    speed: g.speed * factor,
    zomma: g.zomma * factor,
    color: g.color * factor,
  };
}

/**
 * Aggregate Greeks across all positions in a portfolio.
 * Multiplier is the contract multiplier (e.g. 100 for equity options).
 */
export function portfolioGreeks(
  positions: PortfolioPosition[],
  multiplier: number = 100
): Greeks {
  let total = emptyGreeks();

  for (const pos of positions) {
    const { contract, quantity } = pos;
    const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

    if (T <= 0) continue;

    const greeks = bsAllGreeks(S, K, T, r, q, sigma, type);
    total = addGreeks(total, greeks, quantity * multiplier);
  }

  return total;
}

// ─── Greeks Over Time ───────────────────────────────────────────────────────

export interface GreeksTimeSeries {
  times: number[];         // days to expiry
  delta: number[];
  gamma: number[];
  theta: number[];
  vega: number[];
}

/**
 * Generate Greeks values as time passes for a single option.
 */
export function greeksOverTime(
  contract: OptionContract,
  daysToPlot: number[] | null = null,
  multiplier: number = 1
): GreeksTimeSeries {
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

  const totalDays = Math.ceil(T * 365);
  const days = daysToPlot ?? Array.from({ length: Math.min(totalDays, 365) }, (_, i) => totalDays - i);

  const times: number[] = [];
  const delta: number[] = [];
  const gamma: number[] = [];
  const theta: number[] = [];
  const vega: number[] = [];

  for (const d of days) {
    const t = Math.max(d / 365, 1e-6);
    times.push(d);
    const g = bsAllGreeks(S, K, t, r, q, sigma, type);
    delta.push(g.delta * multiplier);
    gamma.push(g.gamma * multiplier);
    theta.push(g.theta / 365 * multiplier); // daily theta
    vega.push(g.vega / 100 * multiplier);   // per 1% vol move
  }

  return { times, delta, gamma, theta, vega };
}

// ─── Greeks Over Price ──────────────────────────────────────────────────────

export interface GreeksPriceSeries {
  prices: number[];
  delta: number[];
  gamma: number[];
  theta: number[];
  vega: number[];
}

/**
 * Generate Greeks values across a range of underlying prices.
 */
export function greeksOverPrice(
  contract: OptionContract,
  priceRange?: [number, number],
  points: number = 200,
  multiplier: number = 1
): GreeksPriceSeries {
  const { strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type, underlyingPrice: S } = contract;
  const [lo, hi] = priceRange ?? [S * 0.5, S * 1.5];
  const step = (hi - lo) / (points - 1);

  const prices: number[] = [];
  const delta: number[] = [];
  const gamma: number[] = [];
  const theta: number[] = [];
  const vega: number[] = [];

  for (let i = 0; i < points; i++) {
    const price = lo + i * step;
    prices.push(price);
    const g = bsAllGreeks(price, K, T, r, q, sigma, type);
    delta.push(g.delta * multiplier);
    gamma.push(g.gamma * multiplier);
    theta.push(g.theta / 365 * multiplier);
    vega.push(g.vega / 100 * multiplier);
  }

  return { prices, delta, gamma, theta, vega };
}

// ─── Delta Hedging ──────────────────────────────────────────────────────────

/**
 * Calculate the number of shares needed to delta-hedge a portfolio of options.
 */
export function deltaHedge(
  positions: PortfolioPosition[],
  existingShares: number = 0,
  multiplier: number = 100,
  rebalanceThreshold: number = 0.05
): DeltaHedgeResult {
  const greeks = portfolioGreeks(positions, multiplier);
  const totalDelta = greeks.delta + existingShares;
  const sharesNeeded = -totalDelta; // Sell shares if positive delta, buy if negative

  const avgPrice = positions.length > 0
    ? positions.reduce((s, p) => s + p.contract.underlyingPrice, 0) / positions.length
    : 0;

  return {
    sharesNeeded: Math.round(sharesNeeded),
    hedgeCost: Math.abs(sharesNeeded) * avgPrice,
    portfolioDelta: totalDelta + sharesNeeded,
    rebalanceThreshold,
  };
}

/**
 * Simulate delta hedging over a price path and return realized P&L.
 */
export function simulateDeltaHedge(
  contract: OptionContract,
  pricePath: number[],
  timeSteps: number[], // time remaining at each step
  quantity: number = 1,
  multiplier: number = 100,
  rebalanceThreshold: number = 0.01
): { hedgePnL: number; optionPnL: number; totalPnL: number; rebalances: number } {
  const { strike: K, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

  let shares = 0;
  let cashFlow = 0;
  let rebalances = 0;

  // Initial option purchase
  const initialPrice = bsPrice(pricePath[0], K, timeSteps[0], r, q, sigma, type);
  cashFlow -= initialPrice * quantity * multiplier;

  // Initial hedge
  const initialDelta = bsDelta(pricePath[0], K, timeSteps[0], r, q, sigma, type) * quantity * multiplier;
  shares = -initialDelta;
  cashFlow -= shares * pricePath[0];
  rebalances++;

  for (let i = 1; i < pricePath.length; i++) {
    const T = timeSteps[i];
    const S = pricePath[i];

    const targetDelta = bsDelta(S, K, T, r, q, sigma, type) * quantity * multiplier;
    const currentDelta = -shares;
    const deltaChange = targetDelta - currentDelta;

    if (Math.abs(deltaChange) > rebalanceThreshold * multiplier) {
      const sharesToTrade = -deltaChange;
      shares += sharesToTrade;
      cashFlow -= sharesToTrade * S;
      rebalances++;
    }
  }

  // Unwind at final step
  const finalT = timeSteps[timeSteps.length - 1];
  const finalS = pricePath[pricePath.length - 1];
  const optionPayoff = type === OptionType.CALL
    ? Math.max(finalS - K, 0)
    : Math.max(K - finalS, 0);

  const optionPnL = (optionPayoff - initialPrice) * quantity * multiplier;
  const hedgePnL = cashFlow + shares * finalS;

  return {
    hedgePnL,
    optionPnL,
    totalPnL: optionPnL + hedgePnL,
    rebalances,
  };
}

// ─── Gamma Scalping ─────────────────────────────────────────────────────────

/**
 * Estimate gamma scalping P&L for a delta-hedged long option position.
 * P&L ≈ 0.5 * Gamma * (ΔS)² - Theta * Δt
 */
export function gammaScalpEstimate(
  contract: OptionContract,
  expectedDailyMove: number, // expected daily price move (absolute)
  holdingDays: number = 1,
  quantity: number = 1,
  multiplier: number = 100
): GammaScalpResult {
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

  const gamma = bsGamma(S, K, T, r, q, sigma) * quantity * multiplier;
  const theta = bsTheta(S, K, T, r, q, sigma, type) * quantity * multiplier;

  // Per-day scalping P&L estimate
  const gammaProfit = 0.5 * gamma * expectedDailyMove * expectedDailyMove;
  const thetaCost = theta / 365; // daily theta (theta is annual)

  const dailyPnL = gammaProfit + thetaCost; // theta is negative for long positions
  const totalPnL = dailyPnL * holdingDays;

  // Approximate number of hedging adjustments per day (assume 2x if move > 1σ)
  const oneSigmaMove = S * sigma / Math.sqrt(252);
  const hedgeAdjustments = Math.max(1, Math.round(expectedDailyMove / oneSigmaMove * 2));

  return {
    estimatedPnL: totalPnL,
    realizedGamma: gamma,
    hedgeAdjustments: hedgeAdjustments * holdingDays,
  };
}

// ─── Theta Decay Visualization ──────────────────────────────────────────────

export interface ThetaDecayCurve {
  daysToExpiry: number[];
  optionValue: number[];
  timeValue: number[];
  dailyTheta: number[];
}

export function thetaDecayCurve(
  contract: OptionContract,
  multiplier: number = 1
): ThetaDecayCurve {
  const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

  const totalDays = Math.ceil(T * 365);
  const days = Array.from({ length: totalDays }, (_, i) => totalDays - i);

  const daysToExpiry: number[] = [];
  const optionValue: number[] = [];
  const timeValue: number[] = [];
  const dailyTheta: number[] = [];

  for (const d of days) {
    const t = d / 365;
    daysToExpiry.push(d);

    const price = bsPrice(S, K, t, r, q, sigma, type) * multiplier;
    const intrinsic = type === OptionType.CALL
      ? Math.max(S - K, 0) * multiplier
      : Math.max(K - S, 0) * multiplier;

    optionValue.push(price);
    timeValue.push(Math.max(price - intrinsic, 0));
    dailyTheta.push(bsTheta(S, K, t, r, q, sigma, type) / 365 * multiplier);
  }

  return { daysToExpiry, optionValue, timeValue, dailyTheta };
}

// ─── Vega Exposure Analysis ─────────────────────────────────────────────────

export interface VegaExposure {
  strikes: number[];
  expiries: number[];
  vegaByStrike: Map<number, number>;
  vegaByExpiry: Map<number, number>;
  totalVega: number;
  weightedAvgStrike: number;
  weightedAvgExpiry: number;
}

export function analyzeVegaExposure(
  positions: PortfolioPosition[],
  multiplier: number = 100
): VegaExposure {
  const vegaByStrike = new Map<number, number>();
  const vegaByExpiry = new Map<number, number>();
  let totalVega = 0;
  let weightedStrikeSum = 0;
  let weightedExpirySum = 0;

  const strikes = new Set<number>();
  const expiries = new Set<number>();

  for (const pos of positions) {
    const { contract, quantity } = pos;
    const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;

    strikes.add(K);
    expiries.add(T);

    const vega = bsVega(S, K, T, r, q, sigma) * quantity * multiplier;
    totalVega += vega;
    weightedStrikeSum += vega * K;
    weightedExpirySum += vega * T;

    vegaByStrike.set(K, (vegaByStrike.get(K) ?? 0) + vega);
    vegaByExpiry.set(T, (vegaByExpiry.get(T) ?? 0) + vega);
  }

  return {
    strikes: Array.from(strikes).sort((a, b) => a - b),
    expiries: Array.from(expiries).sort((a, b) => a - b),
    vegaByStrike,
    vegaByExpiry,
    totalVega,
    weightedAvgStrike: totalVega !== 0 ? weightedStrikeSum / totalVega : 0,
    weightedAvgExpiry: totalVega !== 0 ? weightedExpirySum / totalVega : 0,
  };
}

// ─── Pin Risk ───────────────────────────────────────────────────────────────

/**
 * Assess pin risk: the risk of the underlying closing near a strike at expiry.
 * Returns the probability that the underlying finishes within `range` of each strike.
 */
export function pinRiskAssessment(
  positions: PortfolioPosition[],
  range: number = 0.5 // e.g. within $0.50 of strike
): Array<{ strike: number; probability: number; gammaExposure: number }> {
  const strikeMap = new Map<number, { gamma: number; count: number }>();

  for (const pos of positions) {
    const { contract, quantity } = pos;
    const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma } = contract;

    const gamma = bsGamma(S, K, T, r, q, sigma) * quantity * 100;

    const existing = strikeMap.get(K) ?? { gamma: 0, count: 0 };
    strikeMap.set(K, { gamma: existing.gamma + gamma, count: existing.count + Math.abs(quantity) });
  }

  const results: Array<{ strike: number; probability: number; gammaExposure: number }> = [];

  for (const [strike, data] of strikeMap) {
    // Use the first matching position for probability calculation
    const pos = positions.find(p => p.contract.strike === strike)!;
    const { underlyingPrice: S, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma } = pos.contract;

    if (T <= 0) {
      results.push({ strike, probability: Math.abs(S - strike) <= range ? 1 : 0, gammaExposure: data.gamma });
      continue;
    }

    // Probability that S_T is within [K - range, K + range]
    const d2Upper = calcD2(S, strike - range, T, r, q, sigma);
    const d2Lower = calcD2(S, strike + range, T, r, q, sigma);
    const probability = normalCDF(d2Upper) - normalCDF(d2Lower);

    results.push({ strike, probability, gammaExposure: data.gamma });
  }

  return results.sort((a, b) => b.probability - a.probability);
}

// ─── Assignment Risk ────────────────────────────────────────────────────────

export interface AssignmentRisk {
  strike: number;
  type: OptionType;
  quantity: number;
  intrinsicValue: number;
  timeValue: number;
  daysToExpiry: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

/**
 * Assess early assignment risk for short American-style option positions.
 */
export function assessAssignmentRisk(
  positions: PortfolioPosition[]
): AssignmentRisk[] {
  const risks: AssignmentRisk[] = [];

  for (const pos of positions) {
    const { contract, quantity } = pos;
    if (quantity >= 0) continue; // Only short positions face assignment

    const { underlyingPrice: S, strike: K, expiry: T, riskFreeRate: r, dividendYield: q, volatility: sigma, type } = contract;
    const daysToExpiry = Math.round(T * 365);

    const price = bsPrice(S, K, T, r, q, sigma, type);
    const intrinsic = type === OptionType.CALL
      ? Math.max(S - K, 0)
      : Math.max(K - S, 0);
    const timeValue = Math.max(price - intrinsic, 0);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reason = 'Time value provides assignment protection';

    if (intrinsic <= 0) {
      riskLevel = 'low';
      reason = 'Option is OTM; no assignment risk';
    } else if (timeValue < 0.05 && daysToExpiry <= 1) {
      riskLevel = 'critical';
      reason = 'Deep ITM at expiry with no time value';
    } else if (timeValue < 0.10 && daysToExpiry <= 5) {
      riskLevel = 'high';
      reason = 'Near-zero time value close to expiry';
    } else if (type === OptionType.PUT && intrinsic > 0 && r > q) {
      // Deep ITM puts may be exercised early when r > q
      const exerciseThreshold = K * (1 - Math.exp(-r * T));
      if (timeValue < exerciseThreshold * 0.5) {
        riskLevel = 'high';
        reason = 'Deep ITM put, early exercise likely due to interest rate advantage';
      } else {
        riskLevel = 'medium';
        reason = 'ITM put with declining time value';
      }
    } else if (type === OptionType.CALL && q > 0) {
      // Calls may be exercised early before ex-dividend
      const divValue = S * (1 - Math.exp(-q * T));
      if (timeValue < divValue) {
        riskLevel = 'high';
        reason = 'ITM call, early exercise likely before ex-dividend';
      } else if (intrinsic > 0 && timeValue < divValue * 2) {
        riskLevel = 'medium';
        reason = 'ITM call approaching dividend, moderate assignment risk';
      }
    } else if (intrinsic > 0 && timeValue / intrinsic < 0.05) {
      riskLevel = 'medium';
      reason = 'Deep ITM with minimal time value';
    }

    risks.push({
      strike: K,
      type,
      quantity,
      intrinsicValue: intrinsic,
      timeValue,
      daysToExpiry,
      riskLevel,
      reason,
    });
  }

  return risks.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
}

// ─── Delta-Neutral Portfolio Construction ───────────────────────────────────

export interface DeltaNeutralResult {
  positions: Array<{ contract: OptionContract; quantity: number }>;
  portfolioGreeks: Greeks;
  hedgeRatio: number;
  costOfHedge: number;
}

/**
 * Construct a delta-neutral portfolio by finding the right quantity
 * of a hedging instrument to offset the delta of existing positions.
 */
export function constructDeltaNeutral(
  existingPositions: PortfolioPosition[],
  hedgeInstrument: OptionContract,
  multiplier: number = 100
): DeltaNeutralResult {
  const existingGreeks = portfolioGreeks(existingPositions, multiplier);
  const hedgeDelta = bsDelta(
    hedgeInstrument.underlyingPrice,
    hedgeInstrument.strike,
    hedgeInstrument.expiry,
    hedgeInstrument.riskFreeRate,
    hedgeInstrument.dividendYield,
    hedgeInstrument.volatility,
    hedgeInstrument.type
  ) * multiplier;

  if (Math.abs(hedgeDelta) < 1e-10) {
    return {
      positions: [],
      portfolioGreeks: existingGreeks,
      hedgeRatio: 0,
      costOfHedge: 0,
    };
  }

  const hedgeQuantity = -existingGreeks.delta / hedgeDelta;
  const roundedQty = Math.round(hedgeQuantity);

  const hedgeGreeks = bsAllGreeks(
    hedgeInstrument.underlyingPrice,
    hedgeInstrument.strike,
    hedgeInstrument.expiry,
    hedgeInstrument.riskFreeRate,
    hedgeInstrument.dividendYield,
    hedgeInstrument.volatility,
    hedgeInstrument.type
  );

  const combined = addGreeks(existingGreeks, hedgeGreeks, roundedQty * multiplier);

  const hedgePrice = bsPrice(
    hedgeInstrument.underlyingPrice,
    hedgeInstrument.strike,
    hedgeInstrument.expiry,
    hedgeInstrument.riskFreeRate,
    hedgeInstrument.dividendYield,
    hedgeInstrument.volatility,
    hedgeInstrument.type
  );

  return {
    positions: [{ contract: hedgeInstrument, quantity: roundedQty }],
    portfolioGreeks: combined,
    hedgeRatio: roundedQty,
    costOfHedge: Math.abs(roundedQty) * hedgePrice * multiplier,
  };
}

/**
 * Construct a delta-gamma neutral portfolio using two hedging instruments.
 * Solves: n1*Δ1 + n2*Δ2 = -Δ_portfolio
 *         n1*Γ1 + n2*Γ2 = -Γ_portfolio
 */
export function constructDeltaGammaNeutral(
  existingPositions: PortfolioPosition[],
  hedge1: OptionContract,
  hedge2: OptionContract,
  multiplier: number = 100
): DeltaNeutralResult {
  const existingG = portfolioGreeks(existingPositions, multiplier);

  const d1 = bsDelta(hedge1.underlyingPrice, hedge1.strike, hedge1.expiry, hedge1.riskFreeRate, hedge1.dividendYield, hedge1.volatility, hedge1.type) * multiplier;
  const g1 = bsGamma(hedge1.underlyingPrice, hedge1.strike, hedge1.expiry, hedge1.riskFreeRate, hedge1.dividendYield, hedge1.volatility) * multiplier;
  const d2 = bsDelta(hedge2.underlyingPrice, hedge2.strike, hedge2.expiry, hedge2.riskFreeRate, hedge2.dividendYield, hedge2.volatility, hedge2.type) * multiplier;
  const g2 = bsGamma(hedge2.underlyingPrice, hedge2.strike, hedge2.expiry, hedge2.riskFreeRate, hedge2.dividendYield, hedge2.volatility) * multiplier;

  // Solve 2x2 system: [d1 d2; g1 g2] * [n1; n2] = [-delta_port; -gamma_port]
  const det = d1 * g2 - d2 * g1;
  if (Math.abs(det) < 1e-12) {
    // Instruments are linearly dependent; fall back to delta-only
    return constructDeltaNeutral(existingPositions, hedge1, multiplier);
  }

  const targetDelta = -existingG.delta;
  const targetGamma = -existingG.gamma;

  const n1 = Math.round((targetDelta * g2 - targetGamma * d2) / det);
  const n2 = Math.round((targetGamma * d1 - targetDelta * g1) / det);

  const greeks1 = bsAllGreeks(hedge1.underlyingPrice, hedge1.strike, hedge1.expiry, hedge1.riskFreeRate, hedge1.dividendYield, hedge1.volatility, hedge1.type);
  const greeks2 = bsAllGreeks(hedge2.underlyingPrice, hedge2.strike, hedge2.expiry, hedge2.riskFreeRate, hedge2.dividendYield, hedge2.volatility, hedge2.type);

  let combined = existingG;
  combined = addGreeks(combined, greeks1, n1 * multiplier);
  combined = addGreeks(combined, greeks2, n2 * multiplier);

  const price1 = bsPrice(hedge1.underlyingPrice, hedge1.strike, hedge1.expiry, hedge1.riskFreeRate, hedge1.dividendYield, hedge1.volatility, hedge1.type);
  const price2 = bsPrice(hedge2.underlyingPrice, hedge2.strike, hedge2.expiry, hedge2.riskFreeRate, hedge2.dividendYield, hedge2.volatility, hedge2.type);

  return {
    positions: [
      { contract: hedge1, quantity: n1 },
      { contract: hedge2, quantity: n2 },
    ],
    portfolioGreeks: combined,
    hedgeRatio: n1 + n2,
    costOfHedge: Math.abs(n1) * price1 * multiplier + Math.abs(n2) * price2 * multiplier,
  };
}
