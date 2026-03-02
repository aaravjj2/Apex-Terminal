import type { FXPair, CarryTradeMetrics, StrategySignal } from './types';

// ── Shared helpers ────────────────────────────────────────────────────
function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function stddev(data: number[], period: number): number[] {
  const means = sma(data, period);
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(means[i])) { result.push(NaN); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (data[j] - means[i]) ** 2;
    }
    result.push(Math.sqrt(sumSq / period));
  }
  return result;
}

function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
}

function sharpeRatio(rets: number[], rfRate = 0): number {
  if (rets.length < 2) return 0;
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const std = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length);
  return std > 0 ? (mean - rfRate / 252) / std * Math.sqrt(252) : 0;
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0], maxDD = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ── Strategy result type ──────────────────────────────────────────────
export interface StrategyResult {
  name: string;
  signals: StrategySignal[];
  positions: number[];      // +1 long, -1 short, 0 flat
  equity: number[];
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
}

function computeStats(
  name: string,
  positions: number[],
  prices: number[],
): StrategyResult {
  const equity: number[] = [1];
  const tradeReturns: number[] = [];
  let currentTrade = 0;

  for (let i = 1; i < prices.length; i++) {
    const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
    equity.push(equity[i - 1] * (1 + positions[i - 1] * ret));

    if (positions[i] !== positions[i - 1] && positions[i - 1] !== 0) {
      tradeReturns.push(currentTrade);
      currentTrade = 0;
    }
    if (positions[i - 1] !== 0) {
      currentTrade += positions[i - 1] * ret;
    }
  }
  if (currentTrade !== 0) tradeReturns.push(currentTrade);

  const dailyReturns = returns(equity);
  const totalReturn = equity[equity.length - 1] / equity[0] - 1;
  const years = prices.length / 252;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / Math.max(years, 0.01)) - 1;
  const wins = tradeReturns.filter(r => r > 0);
  const losses = tradeReturns.filter(r => r < 0);
  const grossProfit = wins.reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(losses.reduce((s, v) => s + v, 0));

  const signals = positions.map(p =>
    p > 0 ? ('BUY' as StrategySignal) : p < 0 ? ('SELL' as StrategySignal) : ('NEUTRAL' as StrategySignal),
  );

  return {
    name,
    signals,
    positions,
    equity,
    totalReturn,
    annualizedReturn,
    sharpe: sharpeRatio(dailyReturns),
    maxDrawdown: maxDrawdown(equity),
    winRate: tradeReturns.length > 0 ? wins.length / tradeReturns.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    trades: tradeReturns.length,
  };
}

// ── 1. Carry Trade Strategy ──────────────────────────────────────────
export function carryTradeStrategy(
  prices: number[],
  rateDifferential: number,
  volLookback = 20,
  volThreshold = 0.15,
): StrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);
  const vols = stddev(returns(prices), volLookback);

  for (let i = volLookback + 1; i < n; i++) {
    const realizedVol = (vols[i - 1] ?? 0) * Math.sqrt(252);
    if (realizedVol > volThreshold) {
      positions[i] = 0; // risk-off: flat during high vol
    } else {
      positions[i] = rateDifferential > 0 ? 1 : -1;
    }
  }

  return computeStats('Carry Trade', positions, prices);
}

// ── 2. Momentum / Trend Following Strategy ───────────────────────────
export function momentumStrategy(
  prices: number[],
  fastPeriod = 20,
  slowPeriod = 60,
  atrPeriod = 14,
  atrMultiplier = 2,
): StrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);
  const fastMA = ema(prices, fastPeriod);
  const slowMA = ema(prices, slowPeriod);

  // ATR for position sizing / filtering
  const tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    tr.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const atr = sma(tr, atrPeriod);

  let position = 0;
  let entryPrice = 0;

  for (let i = slowPeriod; i < n; i++) {
    const fast = fastMA[i], slow = slowMA[i];
    const currentATR = atr[i] || 0;

    if (fast > slow && position <= 0) {
      position = 1;
      entryPrice = prices[i];
    } else if (fast < slow && position >= 0) {
      position = -1;
      entryPrice = prices[i];
    }

    // ATR trailing stop
    if (position === 1 && prices[i] < entryPrice - atrMultiplier * currentATR) {
      position = 0;
    } else if (position === -1 && prices[i] > entryPrice + atrMultiplier * currentATR) {
      position = 0;
    }

    positions[i] = position;
  }

  return computeStats('Momentum', positions, prices);
}

// ── 3. Mean Reversion Strategy ───────────────────────────────────────
export function meanReversionStrategy(
  prices: number[],
  fairValue: number[],
  entryThreshold = 2,
  exitThreshold = 0.5,
  lookback = 60,
): StrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);

  const spread: number[] = [];
  for (let i = 0; i < n; i++) {
    spread.push(prices[i] - (fairValue[i] ?? prices[i]));
  }

  const spreadMean = sma(spread, lookback);
  const spreadStd = stddev(spread, lookback);
  let position = 0;

  for (let i = lookback; i < n; i++) {
    const m = spreadMean[i], s = spreadStd[i];
    if (isNaN(m) || isNaN(s) || s === 0) continue;

    const zScore = (spread[i] - m) / s;

    if (zScore > entryThreshold && position >= 0) {
      position = -1;
    } else if (zScore < -entryThreshold && position <= 0) {
      position = 1;
    } else if (Math.abs(zScore) < exitThreshold) {
      position = 0;
    }

    positions[i] = position;
  }

  return computeStats('Mean Reversion', positions, prices);
}

// ── 4. Breakout Strategy ─────────────────────────────────────────────
export function breakoutStrategy(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback = 20,
  atrPeriod = 14,
  atrMultiplier = 1.5,
): StrategyResult {
  const n = closes.length;
  const positions: number[] = new Array(n).fill(0);

  const tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }
  const atr = sma(tr, atrPeriod);

  let position = 0;
  let stopLoss = 0;

  for (let i = lookback; i < n; i++) {
    let highestHigh = -Infinity, lowestLow = Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }

    const currentATR = atr[i] || 0;

    if (closes[i] > highestHigh && position <= 0) {
      position = 1;
      stopLoss = closes[i] - atrMultiplier * currentATR;
    } else if (closes[i] < lowestLow && position >= 0) {
      position = -1;
      stopLoss = closes[i] + atrMultiplier * currentATR;
    }

    if (position === 1 && closes[i] < stopLoss) {
      position = 0;
    } else if (position === -1 && closes[i] > stopLoss) {
      position = 0;
    }

    // Trailing stop update
    if (position === 1) {
      stopLoss = Math.max(stopLoss, closes[i] - atrMultiplier * currentATR);
    } else if (position === -1) {
      stopLoss = Math.min(stopLoss, closes[i] + atrMultiplier * currentATR);
    }

    positions[i] = position;
  }

  return computeStats('Breakout', positions, closes);
}

// ── 5. Grid Trading Strategy ─────────────────────────────────────────
export interface GridConfig {
  upperBound: number;
  lowerBound: number;
  gridLines: number;
  lotSize: number;
}

export function gridTradingStrategy(
  prices: number[],
  config: GridConfig,
): StrategyResult {
  const { upperBound, lowerBound, gridLines, lotSize } = config;
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);
  const gridSpacing = (upperBound - lowerBound) / gridLines;

  const gridLevels: number[] = [];
  for (let i = 0; i <= gridLines; i++) {
    gridLevels.push(lowerBound + i * gridSpacing);
  }

  const activeOrders: { level: number; side: 'BUY' | 'SELL'; filled: boolean }[] = [];
  for (const level of gridLevels) {
    activeOrders.push({ level, side: 'BUY', filled: false });
    activeOrders.push({ level: level + gridSpacing, side: 'SELL', filled: false });
  }

  let netPosition = 0;

  for (let i = 1; i < n; i++) {
    const price = prices[i];
    const prevPrice = prices[i - 1];

    for (const order of activeOrders) {
      if (order.filled) continue;

      if (order.side === 'BUY' && prevPrice > order.level && price <= order.level) {
        netPosition += lotSize;
        order.filled = true;
      } else if (order.side === 'SELL' && prevPrice < order.level && price >= order.level) {
        netPosition -= lotSize;
        order.filled = true;
      }
    }

    positions[i] = netPosition > 0 ? 1 : netPosition < 0 ? -1 : 0;
  }

  return computeStats('Grid Trading', positions, prices);
}

// ── 6. Martingale / Anti-Martingale ──────────────────────────────────
export function martingaleStrategy(
  prices: number[],
  initialSize = 1,
  multiplier = 2,
  maxLevels = 5,
  isAnti = false,
): StrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);

  let size = initialSize;
  let level = 0;
  let direction = 1;
  let entryPrice = prices[0];

  for (let i = 1; i < n; i++) {
    const pnl = direction * (prices[i] - prices[i - 1]) / prices[i - 1];

    if (isAnti) {
      // Anti-martingale: increase on wins, reset on losses
      if (pnl > 0 && level < maxLevels) {
        size *= multiplier;
        level++;
      } else if (pnl < 0) {
        size = initialSize;
        level = 0;
        direction = prices[i] > sma(prices.slice(0, i + 1), 20).pop()! ? 1 : -1;
      }
    } else {
      // Classic martingale: double on losses, reset on wins
      if (pnl < 0 && level < maxLevels) {
        size *= multiplier;
        level++;
      } else if (pnl > 0) {
        size = initialSize;
        level = 0;
      }
    }

    entryPrice = prices[i];
    positions[i] = direction * Math.min(size, initialSize * Math.pow(multiplier, maxLevels));
    // Normalize to -1..1 range
    const maxSize = initialSize * Math.pow(multiplier, maxLevels);
    positions[i] = direction * size / maxSize;
  }

  return computeStats(isAnti ? 'Anti-Martingale' : 'Martingale', positions, prices);
}

// ── 7. Hedging Strategies ────────────────────────────────────────────
export interface HedgeResult {
  hedgeRatio: number;
  hedgedPnL: number[];
  unhedgedPnL: number[];
  hedgeEffectiveness: number;  // variance reduction
  residualRisk: number;
}

export function staticHedge(
  exposurePrices: number[],
  hedgeInstrumentPrices: number[],
  notional: number,
  lookbackForRatio = 60,
): HedgeResult {
  const n = Math.min(exposurePrices.length, hedgeInstrumentPrices.length);
  const r1 = returns(exposurePrices.slice(0, n));
  const r2 = returns(hedgeInstrumentPrices.slice(0, n));

  // OLS hedge ratio from lookback window
  const lb = Math.min(lookbackForRatio, r1.length);
  const slice1 = r1.slice(-lb), slice2 = r2.slice(-lb);
  const mean1 = slice1.reduce((s, v) => s + v, 0) / lb;
  const mean2 = slice2.reduce((s, v) => s + v, 0) / lb;

  let cov = 0, var2 = 0;
  for (let i = 0; i < lb; i++) {
    cov += (slice1[i] - mean1) * (slice2[i] - mean2);
    var2 += (slice2[i] - mean2) ** 2;
  }
  const hedgeRatio = var2 > 0 ? -cov / var2 : 0;

  const hedgedPnL: number[] = [];
  const unhedgedPnL: number[] = [];
  for (let i = 0; i < r1.length; i++) {
    unhedgedPnL.push(r1[i] * notional);
    hedgedPnL.push((r1[i] + hedgeRatio * r2[i]) * notional);
  }

  const varUnhedged = unhedgedPnL.reduce((s, v) => s + v * v, 0) / unhedgedPnL.length;
  const varHedged = hedgedPnL.reduce((s, v) => s + v * v, 0) / hedgedPnL.length;
  const hedgeEffectiveness = varUnhedged > 0 ? 1 - varHedged / varUnhedged : 0;

  return {
    hedgeRatio,
    hedgedPnL,
    unhedgedPnL,
    hedgeEffectiveness,
    residualRisk: Math.sqrt(varHedged),
  };
}

export function dynamicHedge(
  exposurePrices: number[],
  hedgeInstrumentPrices: number[],
  notional: number,
  rebalanceFrequency = 5,
  ewmaLambda = 0.94,
): HedgeResult {
  const n = Math.min(exposurePrices.length, hedgeInstrumentPrices.length);
  const r1 = returns(exposurePrices.slice(0, n));
  const r2 = returns(hedgeInstrumentPrices.slice(0, n));

  const hedgedPnL: number[] = [];
  const unhedgedPnL: number[] = [];
  let ewmaCov = 0, ewmaVar2 = 0;
  let hedgeRatio = 0;

  for (let i = 0; i < r1.length; i++) {
    ewmaCov = ewmaLambda * ewmaCov + (1 - ewmaLambda) * r1[i] * r2[i];
    ewmaVar2 = ewmaLambda * ewmaVar2 + (1 - ewmaLambda) * r2[i] * r2[i];

    if (i % rebalanceFrequency === 0 && ewmaVar2 > 0) {
      hedgeRatio = -ewmaCov / ewmaVar2;
    }

    unhedgedPnL.push(r1[i] * notional);
    hedgedPnL.push((r1[i] + hedgeRatio * r2[i]) * notional);
  }

  const varUnhedged = unhedgedPnL.reduce((s, v) => s + v * v, 0) / unhedgedPnL.length;
  const varHedged = hedgedPnL.reduce((s, v) => s + v * v, 0) / hedgedPnL.length;

  return {
    hedgeRatio,
    hedgedPnL,
    unhedgedPnL,
    hedgeEffectiveness: varUnhedged > 0 ? 1 - varHedged / varUnhedged : 0,
    residualRisk: Math.sqrt(varHedged),
  };
}

// ── Strategy comparison ──────────────────────────────────────────────
export interface StrategyComparison {
  strategies: StrategyResult[];
  bestByReturn: string;
  bestBySharpe: string;
  bestByDrawdown: string;
  correlationMatrix: number[][];
}

export function compareStrategies(
  strategies: StrategyResult[],
): StrategyComparison {
  const bestByReturn = strategies.reduce((best, s) =>
    s.totalReturn > best.totalReturn ? s : best,
  ).name;

  const bestBySharpe = strategies.reduce((best, s) =>
    s.sharpe > best.sharpe ? s : best,
  ).name;

  const bestByDrawdown = strategies.reduce((best, s) =>
    s.maxDrawdown < best.maxDrawdown ? s : best,
  ).name;

  const n = strategies.length;
  const correlationMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { correlationMatrix[i][j] = 1; continue; }
      const r1 = returns(strategies[i].equity);
      const r2 = returns(strategies[j].equity);
      const len = Math.min(r1.length, r2.length);
      if (len < 2) continue;

      const m1 = r1.slice(0, len).reduce((s, v) => s + v, 0) / len;
      const m2 = r2.slice(0, len).reduce((s, v) => s + v, 0) / len;
      let cov = 0, v1 = 0, v2 = 0;
      for (let k = 0; k < len; k++) {
        const d1 = r1[k] - m1, d2 = r2[k] - m2;
        cov += d1 * d2; v1 += d1 * d1; v2 += d2 * d2;
      }
      const denom = Math.sqrt(v1 * v2);
      correlationMatrix[i][j] = denom > 0 ? cov / denom : 0;
    }
  }

  return { strategies, bestByReturn, bestBySharpe, bestByDrawdown, correlationMatrix };
}
