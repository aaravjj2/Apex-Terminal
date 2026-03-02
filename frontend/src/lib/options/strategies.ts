import {
  OptionType,
  ExerciseStyle,
  StrategyLeg,
  StrategyDefinition,
  StrategyPayoff,
  Greeks,
  ScenarioResult,
} from './types';
import { bsPrice, bsAllGreeks, normalCDF, calcD2 } from './blackScholes';

// ─── Strategy Factory Helpers ───────────────────────────────────────────────

function leg(
  type: OptionType, strike: number, expiry: number, quantity: number,
  premium: number, exerciseStyle: ExerciseStyle = ExerciseStyle.EUROPEAN
): StrategyLeg {
  return { type, strike, expiry, quantity, premium, exerciseStyle };
}

function call(K: number, T: number, qty: number, premium: number): StrategyLeg {
  return leg(OptionType.CALL, K, T, qty, premium);
}

function put(K: number, T: number, qty: number, premium: number): StrategyLeg {
  return leg(OptionType.PUT, K, T, qty, premium);
}

// ─── Standard Strategy Definitions ──────────────────────────────────────────

export function coveredCall(
  S: number, K: number, T: number, callPremium: number
): StrategyDefinition {
  return {
    name: 'Covered Call',
    legs: [call(K, T, -1, callPremium)],
    description: 'Long stock + short call. Income generation on existing holdings.',
    outlook: 'neutral-to-slightly-bullish',
  };
}

export function protectivePut(
  S: number, K: number, T: number, putPremium: number
): StrategyDefinition {
  return {
    name: 'Protective Put',
    legs: [put(K, T, 1, putPremium)],
    description: 'Long stock + long put. Downside insurance.',
    outlook: 'bullish-with-protection',
  };
}

export function bullCallSpread(
  Klow: number, Khigh: number, T: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Bull Call Spread',
    legs: [call(Klow, T, 1, lowPremium), call(Khigh, T, -1, highPremium)],
    description: 'Long lower strike call, short higher strike call. Defined risk bullish.',
    outlook: 'moderately-bullish',
  };
}

export function bearPutSpread(
  Klow: number, Khigh: number, T: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Bear Put Spread',
    legs: [put(Khigh, T, 1, highPremium), put(Klow, T, -1, lowPremium)],
    description: 'Long higher strike put, short lower strike put. Defined risk bearish.',
    outlook: 'moderately-bearish',
  };
}

export function bullPutSpread(
  Klow: number, Khigh: number, T: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Bull Put Spread',
    legs: [put(Klow, T, -1, lowPremium), put(Khigh, T, 1, highPremium)],
    description: 'Short higher strike put, long lower strike put. Credit spread, bullish.',
    outlook: 'moderately-bullish',
  };
}

export function bearCallSpread(
  Klow: number, Khigh: number, T: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Bear Call Spread',
    legs: [call(Klow, T, -1, lowPremium), call(Khigh, T, 1, highPremium)],
    description: 'Short lower strike call, long higher strike call. Credit spread, bearish.',
    outlook: 'moderately-bearish',
  };
}

export function longStraddle(
  K: number, T: number, callPremium: number, putPremium: number
): StrategyDefinition {
  return {
    name: 'Long Straddle',
    legs: [call(K, T, 1, callPremium), put(K, T, 1, putPremium)],
    description: 'Long call + long put at same strike. Profit from large moves.',
    outlook: 'volatile',
  };
}

export function shortStraddle(
  K: number, T: number, callPremium: number, putPremium: number
): StrategyDefinition {
  return {
    name: 'Short Straddle',
    legs: [call(K, T, -1, callPremium), put(K, T, -1, putPremium)],
    description: 'Short call + short put at same strike. Profit from stability.',
    outlook: 'neutral',
  };
}

export function longStrangle(
  Kput: number, Kcall: number, T: number,
  callPremium: number, putPremium: number
): StrategyDefinition {
  return {
    name: 'Long Strangle',
    legs: [call(Kcall, T, 1, callPremium), put(Kput, T, 1, putPremium)],
    description: 'OTM call + OTM put. Cheaper vol play than straddle.',
    outlook: 'volatile',
  };
}

export function shortStrangle(
  Kput: number, Kcall: number, T: number,
  callPremium: number, putPremium: number
): StrategyDefinition {
  return {
    name: 'Short Strangle',
    legs: [call(Kcall, T, -1, callPremium), put(Kput, T, -1, putPremium)],
    description: 'Short OTM call + short OTM put. Profit from range-bound.',
    outlook: 'neutral',
  };
}

export function ironCondor(
  Kp1: number, Kp2: number, Kc1: number, Kc2: number, T: number,
  p1Prem: number, p2Prem: number, c1Prem: number, c2Prem: number
): StrategyDefinition {
  return {
    name: 'Iron Condor',
    legs: [
      put(Kp1, T, 1, p1Prem),    // long OTM put (wing)
      put(Kp2, T, -1, p2Prem),   // short put
      call(Kc1, T, -1, c1Prem),  // short call
      call(Kc2, T, 1, c2Prem),   // long OTM call (wing)
    ],
    description: 'Bull put spread + bear call spread. Defined risk neutral.',
    outlook: 'neutral',
  };
}

export function ironButterfly(
  Klow: number, Kmid: number, Khigh: number, T: number,
  lowPut: number, midCall: number, midPut: number, highCall: number
): StrategyDefinition {
  return {
    name: 'Iron Butterfly',
    legs: [
      put(Klow, T, 1, lowPut),
      put(Kmid, T, -1, midPut),
      call(Kmid, T, -1, midCall),
      call(Khigh, T, 1, highCall),
    ],
    description: 'Short straddle + long strangle wings. Max profit at center strike.',
    outlook: 'neutral',
  };
}

export function calendarSpread(
  K: number, Tnear: number, Tfar: number, type: OptionType,
  nearPremium: number, farPremium: number
): StrategyDefinition {
  return {
    name: 'Calendar Spread',
    legs: [
      leg(type, K, Tnear, -1, nearPremium),
      leg(type, K, Tfar, 1, farPremium),
    ],
    description: 'Short near-term, long far-term at same strike. Time decay play.',
    outlook: 'neutral-near-strike',
  };
}

export function diagonalSpread(
  K1: number, K2: number, Tnear: number, Tfar: number, type: OptionType,
  nearPremium: number, farPremium: number
): StrategyDefinition {
  return {
    name: 'Diagonal Spread',
    legs: [
      leg(type, K1, Tnear, -1, nearPremium),
      leg(type, K2, Tfar, 1, farPremium),
    ],
    description: 'Calendar spread with different strikes. Directional + time decay.',
    outlook: type === OptionType.CALL ? 'moderately-bullish' : 'moderately-bearish',
  };
}

export function ratioCallSpread(
  Klow: number, Khigh: number, T: number, ratio: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Ratio Call Spread',
    legs: [
      call(Klow, T, 1, lowPremium),
      call(Khigh, T, -ratio, highPremium),
    ],
    description: `1x${ratio} call spread. Extra premium from ratio, unlimited risk above.`,
    outlook: 'moderately-bullish',
  };
}

export function ratioPutSpread(
  Klow: number, Khigh: number, T: number, ratio: number,
  lowPremium: number, highPremium: number
): StrategyDefinition {
  return {
    name: 'Ratio Put Spread',
    legs: [
      put(Khigh, T, 1, highPremium),
      put(Klow, T, -ratio, lowPremium),
    ],
    description: `1x${ratio} put spread. Extra premium from ratio, risk below lower strike.`,
    outlook: 'moderately-bearish',
  };
}

export function collar(
  Kput: number, Kcall: number, T: number,
  putPremium: number, callPremium: number
): StrategyDefinition {
  return {
    name: 'Collar',
    legs: [
      put(Kput, T, 1, putPremium),
      call(Kcall, T, -1, callPremium),
    ],
    description: 'Long stock + protective put + covered call. Capped risk and reward.',
    outlook: 'neutral-to-slightly-bullish',
  };
}

export function jadeLizard(
  Kput: number, Kcall1: number, Kcall2: number, T: number,
  putPrem: number, call1Prem: number, call2Prem: number
): StrategyDefinition {
  return {
    name: 'Jade Lizard',
    legs: [
      put(Kput, T, -1, putPrem),
      call(Kcall1, T, -1, call1Prem),
      call(Kcall2, T, 1, call2Prem),
    ],
    description: 'Short put + bear call spread. No upside risk if structured correctly.',
    outlook: 'neutral-to-bullish',
  };
}

export function brokenWingButterfly(
  K1: number, K2: number, K3: number, T: number, type: OptionType,
  p1: number, p2: number, p3: number
): StrategyDefinition {
  return {
    name: 'Broken Wing Butterfly',
    legs: [
      leg(type, K1, T, 1, p1),
      leg(type, K2, T, -2, p2),
      leg(type, K3, T, 1, p3),
    ],
    description: 'Unbalanced butterfly with skipped strike. Directional bias with limited risk.',
    outlook: type === OptionType.CALL ? 'moderately-bullish' : 'moderately-bearish',
  };
}

export function christmasTree(
  K1: number, K2: number, K3: number, T: number, type: OptionType,
  p1: number, p2: number, p3: number
): StrategyDefinition {
  return {
    name: 'Christmas Tree',
    legs: [
      leg(type, K1, T, 1, p1),
      leg(type, K2, T, -1, p2),
      leg(type, K3, T, -1, p3),
    ],
    description: 'Ladder-like structure with 3 strikes. Low cost directional play.',
    outlook: type === OptionType.CALL ? 'bullish' : 'bearish',
  };
}

export function boxSpread(
  Klow: number, Khigh: number, T: number,
  clp: number, chp: number, php: number, plp: number
): StrategyDefinition {
  return {
    name: 'Box Spread',
    legs: [
      call(Klow, T, 1, clp),
      call(Khigh, T, -1, chp),
      put(Khigh, T, 1, php),
      put(Klow, T, -1, plp),
    ],
    description: 'Bull call spread + bear put spread. Arbitrage / financing vehicle.',
    outlook: 'neutral-arbitrage',
  };
}

export function conversion(
  K: number, T: number, callPrem: number, putPrem: number
): StrategyDefinition {
  return {
    name: 'Conversion',
    legs: [
      call(K, T, -1, callPrem),
      put(K, T, 1, putPrem),
    ],
    description: 'Long stock + long put + short call at same strike. Arbitrage if mispriced.',
    outlook: 'neutral-arbitrage',
  };
}

export function reversal(
  K: number, T: number, callPrem: number, putPrem: number
): StrategyDefinition {
  return {
    name: 'Reversal',
    legs: [
      call(K, T, 1, callPrem),
      put(K, T, -1, putPrem),
    ],
    description: 'Short stock + short put + long call. Opposite of conversion.',
    outlook: 'neutral-arbitrage',
  };
}

export function syntheticLong(
  K: number, T: number, callPrem: number, putPrem: number
): StrategyDefinition {
  return {
    name: 'Synthetic Long',
    legs: [call(K, T, 1, callPrem), put(K, T, -1, putPrem)],
    description: 'Long call + short put. Synthetic stock position.',
    outlook: 'bullish',
  };
}

export function syntheticShort(
  K: number, T: number, callPrem: number, putPrem: number
): StrategyDefinition {
  return {
    name: 'Synthetic Short',
    legs: [call(K, T, -1, callPrem), put(K, T, 1, putPrem)],
    description: 'Short call + long put. Synthetic short stock.',
    outlook: 'bearish',
  };
}

export function riskReversal(
  Kput: number, Kcall: number, T: number,
  putPrem: number, callPrem: number
): StrategyDefinition {
  return {
    name: 'Risk Reversal',
    legs: [put(Kput, T, -1, putPrem), call(Kcall, T, 1, callPrem)],
    description: 'Short OTM put + long OTM call. Bullish, potentially zero cost.',
    outlook: 'bullish',
  };
}

export function gutSpread(
  Klow: number, Khigh: number, T: number,
  type: 'long' | 'short',
  callPrem: number, putPrem: number
): StrategyDefinition {
  const qty = type === 'long' ? 1 : -1;
  return {
    name: `${type === 'long' ? 'Long' : 'Short'} Gut Spread`,
    legs: [
      call(Klow, T, qty, callPrem),
      put(Khigh, T, qty, putPrem),
    ],
    description: 'ITM call + ITM put. Higher cost version of straddle/strangle.',
    outlook: type === 'long' ? 'volatile' : 'neutral',
  };
}

export function ladder(
  K1: number, K2: number, K3: number, T: number, type: OptionType,
  p1: number, p2: number, p3: number
): StrategyDefinition {
  if (type === OptionType.CALL) {
    return {
      name: 'Call Ladder',
      legs: [call(K1, T, 1, p1), call(K2, T, -1, p2), call(K3, T, -1, p3)],
      description: 'Long 1 call, short 2 higher calls. Profit if stays near middle.',
      outlook: 'moderately-bullish',
    };
  }
  return {
    name: 'Put Ladder',
    legs: [put(K3, T, 1, p3), put(K2, T, -1, p2), put(K1, T, -1, p1)],
    description: 'Long 1 put, short 2 lower puts. Profit if stays near middle.',
    outlook: 'moderately-bearish',
  };
}

// ─── Payoff Calculation ─────────────────────────────────────────────────────

/**
 * Calculate the payoff of a single leg at expiry.
 */
function legPayoffAtExpiry(leg: StrategyLeg, underlyingPrice: number): number {
  const intrinsic = leg.type === OptionType.CALL
    ? Math.max(underlyingPrice - leg.strike, 0)
    : Math.max(leg.strike - underlyingPrice, 0);
  return leg.quantity * (intrinsic - leg.premium);
}

/**
 * Calculate strategy payoff at expiry across a range of underlying prices.
 * For strategies with stock legs, pass stockQty and stockEntry.
 */
export function calculatePayoffAtExpiry(
  strategy: StrategyDefinition,
  priceRange: [number, number],
  points: number = 500,
  stockQty: number = 0,
  stockEntry: number = 0
): StrategyPayoff {
  const [low, high] = priceRange;
  const step = (high - low) / (points - 1);
  const underlyingPrices = Array.from({ length: points }, (_, i) => low + i * step);
  const payoffs = new Array(points);

  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (let i = 0; i < points; i++) {
    const S = underlyingPrices[i];
    let totalPayoff = stockQty * (S - stockEntry);
    for (const l of strategy.legs) {
      totalPayoff += legPayoffAtExpiry(l, S);
    }
    payoffs[i] = totalPayoff;
    if (totalPayoff > maxProfit) maxProfit = totalPayoff;
    if (totalPayoff < maxLoss) maxLoss = totalPayoff;
  }

  const breakEvens = findBreakEvens(underlyingPrices, payoffs);
  const probabilityOfProfit = estimateProbabilityOfProfit(strategy, stockQty, stockEntry);

  return {
    underlyingPrices,
    payoffs,
    breakEvens,
    maxProfit: maxProfit === Infinity ? Infinity : maxProfit,
    maxLoss: maxLoss === -Infinity ? -Infinity : maxLoss,
    probabilityOfProfit,
  };
}

function findBreakEvens(prices: number[], payoffs: number[]): number[] {
  const breakEvens: number[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    if ((payoffs[i] <= 0 && payoffs[i + 1] > 0) || (payoffs[i] >= 0 && payoffs[i + 1] < 0)) {
      // Linear interpolation
      const fraction = Math.abs(payoffs[i]) / (Math.abs(payoffs[i]) + Math.abs(payoffs[i + 1]));
      breakEvens.push(prices[i] + fraction * (prices[i + 1] - prices[i]));
    }
  }
  return breakEvens;
}

/**
 * Estimate probability of profit using lognormal assumption.
 * Uses the first leg's expiry and a default vol of 25%.
 */
function estimateProbabilityOfProfit(
  strategy: StrategyDefinition,
  stockQty: number = 0,
  stockEntry: number = 0,
  S?: number, sigma: number = 0.25, r: number = 0.05
): number {
  if (strategy.legs.length === 0) return 0.5;

  const T = strategy.legs[0].expiry;
  const spotGuess = S ?? strategy.legs[0].strike;

  // Calculate break-even points
  const range: [number, number] = [spotGuess * 0.3, spotGuess * 3];
  const payoff = calculatePayoffAtExpiryRaw(strategy, range, 2000, stockQty, stockEntry);

  let profitCount = 0;
  const totalPoints = payoff.underlyingPrices.length;

  for (let i = 0; i < totalPoints; i++) {
    const price = payoff.underlyingPrices[i];
    if (payoff.payoffs[i] > 0) {
      // Weight by lognormal probability density
      const logReturn = Math.log(price / spotGuess);
      const mean = (r - 0.5 * sigma * sigma) * T;
      const std = sigma * Math.sqrt(T);
      const zScore = (logReturn - mean) / std;
      const density = Math.exp(-0.5 * zScore * zScore) / (std * Math.sqrt(2 * Math.PI) * price);
      profitCount += density;
    }
  }

  // Normalize: integrate density across entire range
  let totalDensity = 0;
  for (let i = 0; i < totalPoints; i++) {
    const price = payoff.underlyingPrices[i];
    const logReturn = Math.log(price / spotGuess);
    const mean = (r - 0.5 * sigma * sigma) * T;
    const std = sigma * Math.sqrt(T);
    const zScore = (logReturn - mean) / std;
    const density = Math.exp(-0.5 * zScore * zScore) / (std * Math.sqrt(2 * Math.PI) * price);
    totalDensity += density;
  }

  return totalDensity > 0 ? profitCount / totalDensity : 0.5;
}

function calculatePayoffAtExpiryRaw(
  strategy: StrategyDefinition,
  priceRange: [number, number],
  points: number,
  stockQty: number, stockEntry: number
): { underlyingPrices: number[]; payoffs: number[] } {
  const [low, high] = priceRange;
  const step = (high - low) / (points - 1);
  const underlyingPrices = Array.from({ length: points }, (_, i) => low + i * step);
  const payoffs = underlyingPrices.map(S => {
    let total = stockQty * (S - stockEntry);
    for (const l of strategy.legs) total += legPayoffAtExpiry(l, S);
    return total;
  });
  return { underlyingPrices, payoffs };
}

// ─── P&L Before Expiry ─────────────────────────────────────────────────────

/**
 * Calculate strategy P&L at a specific date before expiry using BS pricing.
 */
export function calculatePnLBeforeExpiry(
  strategy: StrategyDefinition,
  S: number, r: number, q: number, sigma: number,
  timeRemaining: number,
  stockQty: number = 0, stockEntry: number = 0
): number {
  let totalPnL = stockQty * (S - stockEntry);

  for (const l of strategy.legs) {
    const T = Math.max(timeRemaining, 0);
    const currentValue = bsPrice(S, l.strike, T, r, q, sigma, l.type);
    totalPnL += l.quantity * (currentValue - l.premium);
  }

  return totalPnL;
}

/**
 * Generate P&L surface: P&L over price and time dimensions.
 */
export function pnlSurface(
  strategy: StrategyDefinition,
  priceRange: [number, number], timePoints: number[],
  r: number, q: number, sigma: number,
  points: number = 200,
  stockQty: number = 0, stockEntry: number = 0
): { prices: number[]; times: number[]; pnl: number[][] } {
  const [low, high] = priceRange;
  const step = (high - low) / (points - 1);
  const prices = Array.from({ length: points }, (_, i) => low + i * step);
  const pnl: number[][] = [];

  for (const t of timePoints) {
    const row: number[] = [];
    for (const S of prices) {
      row.push(calculatePnLBeforeExpiry(strategy, S, r, q, sigma, t, stockQty, stockEntry));
    }
    pnl.push(row);
  }

  return { prices, times: timePoints, pnl };
}

// ─── Break-Even Calculation ─────────────────────────────────────────────────

/**
 * Find break-even prices at expiry using bisection.
 */
export function findBreakEvenPrices(
  strategy: StrategyDefinition,
  searchRange: [number, number],
  stockQty: number = 0, stockEntry: number = 0,
  tolerance: number = 0.01
): number[] {
  const payoffFn = (S: number) => {
    let total = stockQty * (S - stockEntry);
    for (const l of strategy.legs) total += legPayoffAtExpiry(l, S);
    return total;
  };

  const breakEvens: number[] = [];
  const [lo, hi] = searchRange;
  const steps = 1000;
  const step = (hi - lo) / steps;

  for (let i = 0; i < steps; i++) {
    const x1 = lo + i * step;
    const x2 = x1 + step;
    const y1 = payoffFn(x1);
    const y2 = payoffFn(x2);

    if (y1 * y2 < 0) {
      // Bisection
      let a = x1, b = x2;
      for (let iter = 0; iter < 50; iter++) {
        const mid = (a + b) / 2;
        const yMid = payoffFn(mid);
        if (Math.abs(yMid) < tolerance) { a = mid; break; }
        if (yMid * payoffFn(a) < 0) b = mid; else a = mid;
      }
      breakEvens.push((a + b) / 2);
    }
  }

  return breakEvens;
}

// ─── Greeks Aggregation ─────────────────────────────────────────────────────

/**
 * Aggregate Greeks across all legs of a strategy.
 */
export function strategyGreeks(
  strategy: StrategyDefinition,
  S: number, r: number, q: number, sigma: number,
  timeRemaining?: number
): Greeks {
  const result: Greeks = {
    delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0,
    vanna: 0, volga: 0, charm: 0, veta: 0, speed: 0, zomma: 0, color: 0,
  };

  for (const l of strategy.legs) {
    const T = timeRemaining ?? l.expiry;
    if (T <= 0) continue;
    const greeks = bsAllGreeks(S, l.strike, T, r, q, sigma, l.type);

    result.delta += l.quantity * greeks.delta;
    result.gamma += l.quantity * greeks.gamma;
    result.theta += l.quantity * greeks.theta;
    result.vega += l.quantity * greeks.vega;
    result.rho += l.quantity * greeks.rho;
    result.vanna += l.quantity * greeks.vanna;
    result.volga += l.quantity * greeks.volga;
    result.charm += l.quantity * greeks.charm;
    result.veta += l.quantity * greeks.veta;
    result.speed += l.quantity * greeks.speed;
    result.zomma += l.quantity * greeks.zomma;
    result.color += l.quantity * greeks.color;
  }

  return result;
}

// ─── Max Profit / Max Loss ──────────────────────────────────────────────────

export function strategyMaxProfit(
  strategy: StrategyDefinition,
  stockQty: number = 0, stockEntry: number = 0
): number {
  const guessCenter = strategy.legs.reduce((s, l) => s + l.strike, 0) / strategy.legs.length;
  const range: [number, number] = [0.01, guessCenter * 5];
  const payoff = calculatePayoffAtExpiry(strategy, range, 5000, stockQty, stockEntry);
  return payoff.maxProfit;
}

export function strategyMaxLoss(
  strategy: StrategyDefinition,
  stockQty: number = 0, stockEntry: number = 0
): number {
  const guessCenter = strategy.legs.reduce((s, l) => s + l.strike, 0) / strategy.legs.length;
  const range: [number, number] = [0.01, guessCenter * 5];
  const payoff = calculatePayoffAtExpiry(strategy, range, 5000, stockQty, stockEntry);
  return payoff.maxLoss;
}

// ─── Position Rolling ───────────────────────────────────────────────────────

/**
 * Roll a strategy to a new expiry, optionally adjusting strikes.
 * Returns new strategy definition with updated premiums based on BS pricing.
 */
export function rollStrategy(
  strategy: StrategyDefinition,
  S: number, r: number, q: number, sigma: number,
  newExpiry: number,
  strikeAdjustment: number = 0
): StrategyDefinition {
  const newLegs = strategy.legs.map(l => {
    const newStrike = l.strike + strikeAdjustment;
    const newPremium = bsPrice(S, newStrike, newExpiry, r, q, sigma, l.type);
    return { ...l, strike: newStrike, expiry: newExpiry, premium: newPremium };
  });

  return {
    ...strategy,
    name: `${strategy.name} (rolled)`,
    legs: newLegs,
  };
}

// ─── Strategy Comparison ────────────────────────────────────────────────────

export interface StrategyComparison {
  strategies: string[];
  prices: number[];
  payoffs: number[][]; // [strategyIdx][priceIdx]
  maxProfits: number[];
  maxLosses: number[];
  breakEvens: number[][];
}

export function compareStrategies(
  strategies: StrategyDefinition[],
  priceRange: [number, number],
  points: number = 500,
  stockQtys?: number[],
  stockEntries?: number[]
): StrategyComparison {
  const sqtys = stockQtys ?? strategies.map(() => 0);
  const sentries = stockEntries ?? strategies.map(() => 0);

  const results = strategies.map((s, i) =>
    calculatePayoffAtExpiry(s, priceRange, points, sqtys[i], sentries[i])
  );

  return {
    strategies: strategies.map(s => s.name),
    prices: results[0].underlyingPrices,
    payoffs: results.map(r => r.payoffs),
    maxProfits: results.map(r => r.maxProfit),
    maxLosses: results.map(r => r.maxLoss),
    breakEvens: results.map(r => r.breakEvens),
  };
}

// ─── Scenario Analysis ──────────────────────────────────────────────────────

export interface ScenarioParams {
  priceChange?: number;   // absolute change in underlying
  volChange?: number;     // absolute change in IV
  daysForward?: number;   // days forward in time
}

export function scenarioAnalysis(
  strategy: StrategyDefinition,
  S: number, r: number, q: number, sigma: number,
  currentTimeToExpiry: number,
  scenarios: ScenarioParams[],
  stockQty: number = 0, stockEntry: number = 0
): ScenarioResult[] {
  const currentPnL = calculatePnLBeforeExpiry(
    strategy, S, r, q, sigma, currentTimeToExpiry, stockQty, stockEntry
  );

  return scenarios.map(sc => {
    const newS = S + (sc.priceChange ?? 0);
    const newSigma = Math.max(sigma + (sc.volChange ?? 0), 0.001);
    const newT = Math.max(currentTimeToExpiry - (sc.daysForward ?? 0) / 365, 0);

    const pnl = calculatePnLBeforeExpiry(
      strategy, newS, r, q, newSigma, newT, stockQty, stockEntry
    );

    const greeks = strategyGreeks(strategy, newS, r, q, newSigma, newT);

    return {
      price: newS,
      pnl: pnl - currentPnL,
      greeks,
    };
  });
}

/**
 * Generate a full what-if matrix: price changes vs vol changes.
 */
export function whatIfMatrix(
  strategy: StrategyDefinition,
  S: number, r: number, q: number, sigma: number,
  timeToExpiry: number,
  priceChanges: number[], volChanges: number[],
  stockQty: number = 0, stockEntry: number = 0
): { priceChanges: number[]; volChanges: number[]; pnl: number[][] } {
  const basePnL = calculatePnLBeforeExpiry(
    strategy, S, r, q, sigma, timeToExpiry, stockQty, stockEntry
  );

  const pnl: number[][] = [];
  for (const dp of priceChanges) {
    const row: number[] = [];
    for (const dv of volChanges) {
      const newPnL = calculatePnLBeforeExpiry(
        strategy, S + dp, r, q, Math.max(sigma + dv, 0.001), timeToExpiry,
        stockQty, stockEntry
      );
      row.push(newPnL - basePnL);
    }
    pnl.push(row);
  }

  return { priceChanges, volChanges, pnl };
}
