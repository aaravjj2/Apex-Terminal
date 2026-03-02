import type { FuturesContract, SeasonalPattern } from './types';

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

function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
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

// ── Strategy result ───────────────────────────────────────────────────
export interface CommodityStrategyResult {
  name: string;
  positions: number[];
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
): CommodityStrategyResult {
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
    if (positions[i - 1] !== 0) currentTrade += positions[i - 1] * ret;
  }
  if (currentTrade !== 0) tradeReturns.push(currentTrade);

  const dailyRet = returns(equity);
  const totalReturn = equity[equity.length - 1] / equity[0] - 1;
  const years = prices.length / 252;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / Math.max(years, 0.01)) - 1;
  const mean = dailyRet.length > 0 ? dailyRet.reduce((s, v) => s + v, 0) / dailyRet.length : 0;
  const std = dailyRet.length > 1
    ? Math.sqrt(dailyRet.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyRet.length)
    : 0;
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;

  const wins = tradeReturns.filter(r => r > 0);
  const losses = tradeReturns.filter(r => r < 0);
  const grossProfit = wins.reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(losses.reduce((s, v) => s + v, 0));

  return {
    name,
    positions,
    equity,
    totalReturn,
    annualizedReturn,
    sharpe,
    maxDrawdown: maxDrawdown(equity),
    winRate: tradeReturns.length > 0 ? wins.length / tradeReturns.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    trades: tradeReturns.length,
  };
}

// ── 1. Calendar Spread Trading ────────────────────────────────────────
export function calendarSpreadStrategy(
  nearPrices: number[],
  farPrices: number[],
  lookback = 60,
  entryZScore = 2,
  exitZScore = 0.5,
): CommodityStrategyResult {
  const n = Math.min(nearPrices.length, farPrices.length);
  const spread: number[] = [];
  for (let i = 0; i < n; i++) spread.push(nearPrices[i] - farPrices[i]);

  const positions: number[] = new Array(n).fill(0);
  const spreadMA = sma(spread, lookback);
  let position = 0;

  for (let i = lookback; i < n; i++) {
    const mean = spreadMA[i];
    if (isNaN(mean)) continue;

    let variance = 0;
    for (let j = i - lookback + 1; j <= i; j++) variance += (spread[j] - mean) ** 2;
    const std = Math.sqrt(variance / lookback);
    if (std === 0) continue;

    const z = (spread[i] - mean) / std;

    if (z > entryZScore && position >= 0) position = -1;      // sell spread
    else if (z < -entryZScore && position <= 0) position = 1;  // buy spread
    else if (Math.abs(z) < exitZScore) position = 0;

    positions[i] = position;
  }

  // PnL is from spread changes
  const spreadEquity: number[] = [1];
  for (let i = 1; i < n; i++) {
    const base = Math.abs(spread[i - 1]) || 1;
    const ret = (spread[i] - spread[i - 1]) / base;
    spreadEquity.push(spreadEquity[i - 1] * (1 + positions[i - 1] * ret));
  }

  const result = computeStats('Calendar Spread', positions, nearPrices);
  result.equity = spreadEquity;
  result.totalReturn = spreadEquity[spreadEquity.length - 1] - 1;
  return result;
}

// ── 2. Crack Spread Trading ──────────────────────────────────────────
export function crackSpreadStrategy(
  crudePrices: number[],
  gasolinePrices: number[],
  heatingOilPrices: number[],
  lookback = 40,
  entryZScore = 1.5,
  exitZScore = 0.5,
): CommodityStrategyResult {
  const n = Math.min(crudePrices.length, gasolinePrices.length, heatingOilPrices.length);
  const crackSpread: number[] = [];

  for (let i = 0; i < n; i++) {
    const gasPerBarrel = gasolinePrices[i] * 42;
    const hoPerBarrel = heatingOilPrices[i] * 42;
    crackSpread.push((2 * gasPerBarrel + hoPerBarrel - 3 * crudePrices[i]) / 3);
  }

  const positions: number[] = new Array(n).fill(0);
  const spreadMA = sma(crackSpread, lookback);
  let position = 0;

  for (let i = lookback; i < n; i++) {
    const mean = spreadMA[i];
    if (isNaN(mean)) continue;

    let variance = 0;
    for (let j = i - lookback + 1; j <= i; j++) variance += (crackSpread[j] - mean) ** 2;
    const std = Math.sqrt(variance / lookback);
    if (std === 0) continue;

    const z = (crackSpread[i] - mean) / std;

    if (z < -entryZScore && position <= 0) position = 1;       // buy crack
    else if (z > entryZScore && position >= 0) position = -1;   // sell crack
    else if (Math.abs(z) < exitZScore) position = 0;

    positions[i] = position;
  }

  return computeStats('Crack Spread', positions, crudePrices);
}

// ── 3. Basis Trading ─────────────────────────────────────────────────
export function basisTradingStrategy(
  spotPrices: number[],
  futuresPrices: number[],
  lookback = 40,
  entryZScore = 2,
  exitZScore = 0.5,
): CommodityStrategyResult {
  const n = Math.min(spotPrices.length, futuresPrices.length);
  const basis: number[] = [];
  for (let i = 0; i < n; i++) basis.push(spotPrices[i] - futuresPrices[i]);

  const positions: number[] = new Array(n).fill(0);
  const basisMA = sma(basis, lookback);
  let position = 0;

  for (let i = lookback; i < n; i++) {
    const mean = basisMA[i];
    if (isNaN(mean)) continue;

    let variance = 0;
    for (let j = i - lookback + 1; j <= i; j++) variance += (basis[j] - mean) ** 2;
    const std = Math.sqrt(variance / lookback);
    if (std === 0) continue;

    const z = (basis[i] - mean) / std;

    if (z > entryZScore && position >= 0) position = -1;
    else if (z < -entryZScore && position <= 0) position = 1;
    else if (Math.abs(z) < exitZScore) position = 0;

    positions[i] = position;
  }

  return computeStats('Basis Trading', positions, spotPrices);
}

// ── 4. Momentum (Trend Following) ────────────────────────────────────
export function commodityMomentumStrategy(
  prices: number[],
  fastPeriod = 20,
  slowPeriod = 60,
  atrPeriod = 14,
  atrMultiplier = 2,
): CommodityStrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);
  const fastMA = ema(prices, fastPeriod);
  const slowMA = ema(prices, slowPeriod);

  const tr: number[] = [0];
  for (let i = 1; i < n; i++) tr.push(Math.abs(prices[i] - prices[i - 1]));
  const atr = sma(tr, atrPeriod);

  let position = 0;
  let entryPrice = 0;

  for (let i = slowPeriod; i < n; i++) {
    const currentATR = atr[i] || 0;

    if (fastMA[i] > slowMA[i] && position <= 0) {
      position = 1;
      entryPrice = prices[i];
    } else if (fastMA[i] < slowMA[i] && position >= 0) {
      position = -1;
      entryPrice = prices[i];
    }

    if (position === 1 && prices[i] < entryPrice - atrMultiplier * currentATR) {
      position = 0;
    } else if (position === -1 && prices[i] > entryPrice + atrMultiplier * currentATR) {
      position = 0;
    }

    positions[i] = position;
  }

  return computeStats('Commodity Momentum', positions, prices);
}

// ── 5. Carry Strategy (Roll Yield) ───────────────────────────────────
export function carryRollStrategy(
  prices: number[],
  rollYields: number[],   // annualized roll yield at each point
  threshold = 0.02,
  volLookback = 20,
): CommodityStrategyResult {
  const n = Math.min(prices.length, rollYields.length);
  const positions: number[] = new Array(n).fill(0);

  const dailyRet = returns(prices);
  const vols: number[] = [0];
  for (let i = 1; i < dailyRet.length; i++) {
    if (i < volLookback) { vols.push(0); continue; }
    let sum = 0;
    for (let j = i - volLookback; j < i; j++) sum += dailyRet[j] ** 2;
    vols.push(Math.sqrt(sum / volLookback) * Math.sqrt(252));
  }

  for (let i = volLookback + 1; i < n; i++) {
    const ry = rollYields[i];
    const vol = vols[i - 1] || 0.15;

    // Position size proportional to carry/vol ratio
    const carryVol = vol > 0 ? ry / vol : 0;

    if (ry > threshold) {
      positions[i] = Math.min(carryVol, 1);    // long in backwardation
    } else if (ry < -threshold) {
      positions[i] = Math.max(carryVol, -1);   // short in contango
    } else {
      positions[i] = 0;
    }
  }

  return computeStats('Carry (Roll Yield)', positions, prices);
}

// ── 6. Seasonal Patterns Trading ─────────────────────────────────────
export function seasonalStrategy(
  prices: number[],
  seasonalPattern: SeasonalPattern,
  tradingDaysPerYear = 252,
  confirmWithMomentum = true,
  momentumPeriod = 10,
): CommodityStrategyResult {
  const n = prices.length;
  const positions: number[] = new Array(n).fill(0);
  const daysPerMonth = Math.floor(tradingDaysPerYear / 12);

  const momentumMA = confirmWithMomentum ? sma(prices, momentumPeriod) : null;

  for (let i = 0; i < n; i++) {
    const dayOfYear = i % tradingDaysPerYear;
    const month = Math.min(Math.floor(dayOfYear / daysPerMonth), 11);

    const avgReturn = seasonalPattern.averageReturns[month] ?? 0;
    const winProb = seasonalPattern.winRate[month] ?? 0.5;

    let signal = 0;
    if (avgReturn > 0 && winProb > 0.55) signal = 1;
    else if (avgReturn < 0 && winProb < 0.45) signal = -1;

    // Confirm with short-term momentum
    if (confirmWithMomentum && momentumMA && i >= momentumPeriod) {
      const momentumDir = prices[i] > momentumMA[i] ? 1 : -1;
      if (signal !== 0 && signal !== momentumDir) signal = 0;
    }

    positions[i] = signal;
  }

  return computeStats('Seasonal', positions, prices);
}
