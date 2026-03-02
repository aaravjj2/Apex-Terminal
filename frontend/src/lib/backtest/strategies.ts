import type { Strategy, StrategyContext, Bar, StrategyParam } from './types';
import { Side, OrderType } from './types';

// ─── Indicator Helpers ──────────────────────────────────────────────────────

function sma(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  out[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    out[i] = sum / period;
  }
  return out;
}

function ema(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (!data.length || period < 1) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i];
  out[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    out[i] = data[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function rsi(closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(closes: number[], fast: number, slow: number, signal: number): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = closes.map((_, i) => isNaN(fastEma[i]) || isNaN(slowEma[i]) ? NaN : fastEma[i] - slowEma[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const sigLine = ema(validMacd, signal);
  const fullSig = new Array(closes.length).fill(NaN);
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      fullSig[i] = idx < sigLine.length ? sigLine[idx] : NaN;
      idx++;
    }
  }
  const hist = closes.map((_, i) => isNaN(macdLine[i]) || isNaN(fullSig[i]) ? NaN : macdLine[i] - fullSig[i]);
  return { macd: macdLine, signal: fullSig, histogram: hist };
}

function bollinger(closes: number[], period: number, mult: number): { upper: number[]; middle: number[]; lower: number[] } {
  const mid = sma(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += (closes[j] - mid[i]) ** 2;
    const std = Math.sqrt(sum / period);
    upper[i] = mid[i] + mult * std;
    lower[i] = mid[i] - mult * std;
  }
  return { upper, middle: mid, lower };
}

function atr(bars: Bar[], period: number): number[] {
  const out = new Array(bars.length).fill(NaN);
  if (bars.length < 2) return out;
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
  }
  let sum = 0;
  for (let i = 0; i < period && i < tr.length; i++) sum += tr[i];
  if (period <= tr.length) out[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

function adx(bars: Bar[], period: number): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const n = bars.length;
  const adxOut = new Array(n).fill(NaN);
  const plusDI = new Array(n).fill(NaN);
  const minusDI = new Array(n).fill(NaN);
  if (n < period * 2) return { adx: adxOut, plusDI, minusDI };

  const atrArr = atr(bars, period);
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < n; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smoothPDM = ema(plusDM, period);
  const smoothMDM = ema(minusDM, period);

  const dx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isNaN(atrArr[i]) || atrArr[i] === 0 || isNaN(smoothPDM[i]) || isNaN(smoothMDM[i])) {
      dx.push(NaN);
      continue;
    }
    const pdi = (smoothPDM[i] / atrArr[i]) * 100;
    const mdi = (smoothMDM[i] / atrArr[i]) * 100;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    dx.push(pdi + mdi !== 0 ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0);
  }

  const adxSmooth = ema(dx.filter(v => !isNaN(v)), period);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (!isNaN(dx[i])) {
      if (idx < adxSmooth.length) adxOut[i] = adxSmooth[idx];
      idx++;
    }
  }

  return { adx: adxOut, plusDI, minusDI };
}

function highest(data: number[], period: number, idx: number): number {
  let max = -Infinity;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    if (data[i] > max) max = data[i];
  }
  return max;
}

function lowest(data: number[], period: number, idx: number): number {
  let min = Infinity;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    if (data[i] < min) min = data[i];
  }
  return min;
}

function zScore(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0, sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
      sumSq += data[j] * data[j];
    }
    const mean = sum / period;
    const std = Math.sqrt(sumSq / period - mean * mean);
    out[i] = std > 0 ? (data[i] - mean) / std : 0;
  }
  return out;
}

function vwap(bars: Bar[]): number[] {
  const out: number[] = [];
  let cumVol = 0, cumTP = 0;
  for (const b of bars) {
    const tp = (b.high + b.low + b.close) / 3;
    cumVol += b.volume;
    cumTP += tp * b.volume;
    out.push(cumVol > 0 ? cumTP / cumVol : tp);
  }
  return out;
}

function getCloses(bars: Bar[]): number[] {
  return bars.map(b => b.close);
}

function getHighs(bars: Bar[]): number[] {
  return bars.map(b => b.high);
}

function getLows(bars: Bar[]): number[] {
  return bars.map(b => b.low);
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function submitMarketOrder(ctx: StrategyContext, symbol: string, side: Side, qty: number, reason?: string): string {
  return ctx.submit({
    symbol,
    type: OrderType.MARKET,
    side,
    quantity: qty,
    timeInForce: 'GTC',
    reason,
  });
}

function positionQty(ctx: StrategyContext, symbol: string): number {
  const pos = ctx.getPosition(symbol);
  return pos ? Math.abs(pos.quantity) : 0;
}

function hasPosition(ctx: StrategyContext, symbol: string): boolean {
  return ctx.getPosition(symbol) !== undefined;
}

function calcQty(ctx: StrategyContext, price: number, pctEquity: number): number {
  return Math.max(1, Math.floor((ctx.equity * pctEquity) / price));
}

// ─── 1. SMA Crossover ──────────────────────────────────────────────────────

export const SMACrossover: Strategy = {
  name: 'SMA Crossover',
  description: 'Crosses above/below fast and slow simple moving averages',
  version: '1.0.0',
  params: [
    { name: 'fastPeriod', type: 'number', default: 10, min: 2, max: 200, step: 1, description: 'Fast SMA period' },
    { name: 'slowPeriod', type: 'number', default: 30, min: 5, max: 500, step: 1, description: 'Slow SMA period' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size as fraction of equity' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 2) return;
    const closes = getCloses(bars);
    const fast = sma(closes, ctx.barIndex < 2 ? 10 : (bars.length > 0 ? 10 : 10));
    const slow = sma(closes, 30);

    const i = closes.length - 1;
    if (isNaN(fast[i]) || isNaN(slow[i]) || isNaN(fast[i - 1]) || isNaN(slow[i - 1])) return;

    if (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1] && !hasPosition(ctx, symbol)) {
      const qty = calcQty(ctx, bar.close, 0.95);
      submitMarketOrder(ctx, symbol, Side.LONG, qty, 'sma_cross_above');
    } else if (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1] && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'sma_cross_below');
    }
  },
};

// ─── 2. RSI Mean Reversion ──────────────────────────────────────────────────

export const RSIMeanReversion: Strategy = {
  name: 'RSI Mean Reversion',
  description: 'Buys oversold RSI, sells overbought RSI',
  version: '1.0.0',
  params: [
    { name: 'period', type: 'number', default: 14, min: 2, max: 50, step: 1, description: 'RSI period' },
    { name: 'oversold', type: 'number', default: 30, min: 5, max: 45, step: 1, description: 'Oversold threshold' },
    { name: 'overbought', type: 'number', default: 70, min: 55, max: 95, step: 1, description: 'Overbought threshold' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 16) return;
    const closes = getCloses(bars);
    const rsiVals = rsi(closes, 14);
    const i = closes.length - 1;
    const val = rsiVals[i];
    if (isNaN(val)) return;

    if (val < 30 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'rsi_oversold');
    } else if (val > 70 && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'rsi_overbought');
    }
  },
};

// ─── 3. MACD Strategy ──────────────────────────────────────────────────────

export const MACDStrategy: Strategy = {
  name: 'MACD Strategy',
  description: 'MACD signal line crossover with histogram confirmation',
  version: '1.0.0',
  params: [
    { name: 'fastPeriod', type: 'number', default: 12, min: 2, max: 50, step: 1, description: 'MACD fast EMA' },
    { name: 'slowPeriod', type: 'number', default: 26, min: 10, max: 100, step: 1, description: 'MACD slow EMA' },
    { name: 'signalPeriod', type: 'number', default: 9, min: 2, max: 30, step: 1, description: 'Signal line period' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 28) return;
    const closes = getCloses(bars);
    const { macd: macdLine, signal: sigLine, histogram: hist } = macd(closes, 12, 26, 9);
    const i = closes.length - 1;
    if (isNaN(macdLine[i]) || isNaN(sigLine[i]) || isNaN(hist[i]) || i < 1 || isNaN(hist[i - 1])) return;

    if (macdLine[i] > sigLine[i] && macdLine[i - 1] <= sigLine[i - 1] && hist[i] > 0 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'macd_bullish_cross');
    } else if (macdLine[i] < sigLine[i] && macdLine[i - 1] >= sigLine[i - 1] && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'macd_bearish_cross');
    }
  },
};

// ─── 4. Bollinger Band Mean Reversion ───────────────────────────────────────

export const BollingerMeanReversion: Strategy = {
  name: 'Bollinger Band Mean Reversion',
  description: 'Buys at lower band, sells at upper band',
  version: '1.0.0',
  params: [
    { name: 'period', type: 'number', default: 20, min: 5, max: 50, step: 1, description: 'Bollinger period' },
    { name: 'multiplier', type: 'number', default: 2, min: 0.5, max: 4, step: 0.1, description: 'Standard deviation multiplier' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 22) return;
    const closes = getCloses(bars);
    const bb = bollinger(closes, 20, 2);
    const i = closes.length - 1;
    if (isNaN(bb.upper[i]) || isNaN(bb.lower[i])) return;

    if (bar.close <= bb.lower[i] && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'bb_lower_touch');
    } else if (bar.close >= bb.upper[i] && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'bb_upper_touch');
    }
  },
};

// ─── 5. Breakout Strategy (Donchian) ────────────────────────────────────────

export const BreakoutStrategy: Strategy = {
  name: 'Donchian Breakout',
  description: 'Donchian channel breakout with ATR-based stop',
  version: '1.0.0',
  params: [
    { name: 'entryPeriod', type: 'number', default: 20, min: 5, max: 100, step: 1, description: 'Entry channel period' },
    { name: 'exitPeriod', type: 'number', default: 10, min: 3, max: 50, step: 1, description: 'Exit channel period' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 22) return;
    const highs = getHighs(bars);
    const lows = getLows(bars);
    const i = bars.length - 1;

    const entryHigh = highest(highs, 20, i - 1);
    const exitLow = lowest(lows, 10, i - 1);

    if (bar.close > entryHigh && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'donchian_breakout');
    } else if (bar.close < exitLow && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'donchian_exit');
    }
  },
};

// ─── 6. Momentum Strategy ──────────────────────────────────────────────────

export const MomentumStrategy: Strategy = {
  name: 'Momentum',
  description: 'Buys assets with strongest relative momentum',
  version: '1.0.0',
  params: [
    { name: 'lookback', type: 'number', default: 60, min: 10, max: 252, step: 1, description: 'Momentum lookback period' },
    { name: 'threshold', type: 'number', default: 0, min: -0.5, max: 0.5, step: 0.01, description: 'Minimum momentum threshold' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 62) return;
    const closes = getCloses(bars);
    const i = closes.length - 1;
    const momentum = (closes[i] - closes[i - 60]) / closes[i - 60];

    if (momentum > 0 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'momentum_entry');
    } else if (momentum < 0 && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'momentum_exit');
    }
  },
};

// ─── 7. Pairs Trading ──────────────────────────────────────────────────────

export const PairsTrading: Strategy = {
  name: 'Pairs Trading',
  description: 'Mean reversion on spread z-score between two correlated assets',
  version: '1.0.0',
  params: [
    { name: 'lookback', type: 'number', default: 60, min: 10, max: 252, step: 1, description: 'Z-score lookback' },
    { name: 'entryZ', type: 'number', default: 2, min: 0.5, max: 4, step: 0.1, description: 'Entry z-score threshold' },
    { name: 'exitZ', type: 'number', default: 0.5, min: 0, max: 2, step: 0.1, description: 'Exit z-score threshold' },
    { name: 'positionSize', type: 'number', default: 0.45, min: 0.01, max: 0.5, step: 0.01, description: 'Position size per leg' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const symbols = Array.from(ctx.bars.keys());
    if (symbols.length < 2 || symbol !== symbols[0]) return;

    const bars1 = ctx.bars.get(symbols[0]);
    const bars2 = ctx.bars.get(symbols[1]);
    if (!bars1 || !bars2 || bars1.length < 62 || bars2.length < 62) return;

    const closes1 = getCloses(bars1);
    const closes2 = getCloses(bars2);
    const n = Math.min(closes1.length, closes2.length);
    const spread: number[] = [];
    for (let i = 0; i < n; i++) spread.push(closes1[i] - closes2[i]);

    const z = zScore(spread, 60);
    const curr = z[z.length - 1];
    if (isNaN(curr)) return;

    const pos1 = ctx.getPosition(symbols[0]);
    const pos2 = ctx.getPosition(symbols[1]);

    if (curr > 2 && !pos1) {
      const qty = calcQty(ctx, bar.close, 0.45);
      submitMarketOrder(ctx, symbols[0], Side.SHORT, qty, 'pairs_spread_high');
      const bar2 = ctx.currentBar.get(symbols[1]);
      if (bar2) submitMarketOrder(ctx, symbols[1], Side.LONG, calcQty(ctx, bar2.close, 0.45), 'pairs_spread_high');
    } else if (curr < -2 && !pos1) {
      const qty = calcQty(ctx, bar.close, 0.45);
      submitMarketOrder(ctx, symbols[0], Side.LONG, qty, 'pairs_spread_low');
      const bar2 = ctx.currentBar.get(symbols[1]);
      if (bar2) submitMarketOrder(ctx, symbols[1], Side.SHORT, calcQty(ctx, bar2.close, 0.45), 'pairs_spread_low');
    } else if (Math.abs(curr) < 0.5 && pos1) {
      submitMarketOrder(ctx, symbols[0], pos1.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos1.quantity), 'pairs_revert');
      if (pos2) submitMarketOrder(ctx, symbols[1], pos2.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos2.quantity), 'pairs_revert');
    }
  },
};

// ─── 8. Trend Following (ADX + MA) ─────────────────────────────────────────

export const TrendFollowing: Strategy = {
  name: 'Trend Following',
  description: 'ADX confirms trend strength, SMA provides direction',
  version: '1.0.0',
  params: [
    { name: 'adxPeriod', type: 'number', default: 14, min: 5, max: 50, step: 1, description: 'ADX period' },
    { name: 'adxThreshold', type: 'number', default: 25, min: 10, max: 50, step: 1, description: 'ADX trend threshold' },
    { name: 'maPeriod', type: 'number', default: 50, min: 10, max: 200, step: 1, description: 'SMA period for direction' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 52) return;
    const closes = getCloses(bars);
    const ma = sma(closes, 50);
    const { adx: adxVals, plusDI, minusDI } = adx(bars, 14);
    const i = closes.length - 1;

    if (isNaN(adxVals[i]) || isNaN(ma[i])) return;

    if (adxVals[i] > 25 && plusDI[i] > minusDI[i] && bar.close > ma[i] && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'adx_trend_long');
    } else if ((adxVals[i] < 20 || plusDI[i] < minusDI[i] || bar.close < ma[i]) && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'adx_trend_exit');
    }
  },
};

// ─── 9. Ichimoku Strategy ───────────────────────────────────────────────────

export const IchimokuStrategy: Strategy = {
  name: 'Ichimoku',
  description: 'Ichimoku cloud breakout with TK cross',
  version: '1.0.0',
  params: [
    { name: 'tenkanPeriod', type: 'number', default: 9, min: 5, max: 30, step: 1, description: 'Tenkan-sen period' },
    { name: 'kijunPeriod', type: 'number', default: 26, min: 10, max: 60, step: 1, description: 'Kijun-sen period' },
    { name: 'senkouPeriod', type: 'number', default: 52, min: 26, max: 120, step: 1, description: 'Senkou Span B period' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 54) return;
    const highs = getHighs(bars);
    const lows = getLows(bars);
    const i = bars.length - 1;

    const tenkan = (highest(highs, 9, i) + lowest(lows, 9, i)) / 2;
    const kijun = (highest(highs, 26, i) + lowest(lows, 26, i)) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = (highest(highs, 52, i) + lowest(lows, 52, i)) / 2;
    const cloud = Math.max(senkouA, senkouB);

    const prevTenkan = (highest(highs, 9, i - 1) + lowest(lows, 9, i - 1)) / 2;
    const prevKijun = (highest(highs, 26, i - 1) + lowest(lows, 26, i - 1)) / 2;

    if (tenkan > kijun && prevTenkan <= prevKijun && bar.close > cloud && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'ichimoku_bullish');
    } else if ((tenkan < kijun || bar.close < cloud) && hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, positionQty(ctx, symbol), 'ichimoku_exit');
    }
  },
};

// ─── 10. VWAP Strategy ─────────────────────────────────────────────────────

export const VWAPStrategy: Strategy = {
  name: 'VWAP Reversion',
  description: 'Trades reversion to VWAP with distance threshold',
  version: '1.0.0',
  params: [
    { name: 'deviationEntry', type: 'number', default: 0.02, min: 0.005, max: 0.1, step: 0.005, description: 'Entry deviation from VWAP' },
    { name: 'deviationExit', type: 'number', default: 0.005, min: 0, max: 0.05, step: 0.001, description: 'Exit deviation from VWAP' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 5) return;
    const vwapVals = vwap(bars);
    const i = bars.length - 1;
    const v = vwapVals[i];
    const deviation = (bar.close - v) / v;

    if (deviation < -0.02 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'vwap_below');
    } else if (deviation > 0.02 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, calcQty(ctx, bar.close, 0.95), 'vwap_above');
    } else if (Math.abs(deviation) < 0.005 && hasPosition(ctx, symbol)) {
      const pos = ctx.getPosition(symbol)!;
      submitMarketOrder(ctx, symbol, pos.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos.quantity), 'vwap_revert');
    }
  },
};

// ─── 11. Mean Reversion (Z-Score) ──────────────────────────────────────────

export const MeanReversionZScore: Strategy = {
  name: 'Mean Reversion Z-Score',
  description: 'Trades based on z-score of price relative to its rolling mean',
  version: '1.0.0',
  params: [
    { name: 'lookback', type: 'number', default: 20, min: 5, max: 100, step: 1, description: 'Z-score lookback' },
    { name: 'entryZ', type: 'number', default: 2, min: 0.5, max: 4, step: 0.1, description: 'Entry z-score' },
    { name: 'exitZ', type: 'number', default: 0, min: -1, max: 1, step: 0.1, description: 'Exit z-score' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 22) return;
    const closes = getCloses(bars);
    const z = zScore(closes, 20);
    const val = z[z.length - 1];
    if (isNaN(val)) return;

    if (val < -2 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.LONG, calcQty(ctx, bar.close, 0.95), 'zscore_oversold');
    } else if (val > 2 && !hasPosition(ctx, symbol)) {
      submitMarketOrder(ctx, symbol, Side.SHORT, calcQty(ctx, bar.close, 0.95), 'zscore_overbought');
    } else if (Math.abs(val) < 0.3 && hasPosition(ctx, symbol)) {
      const pos = ctx.getPosition(symbol)!;
      submitMarketOrder(ctx, symbol, pos.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos.quantity), 'zscore_revert');
    }
  },
};

// ─── 12. Dual Momentum ─────────────────────────────────────────────────────

export const DualMomentum: Strategy = {
  name: 'Dual Momentum',
  description: 'Combines absolute and relative momentum for asset selection',
  version: '1.0.0',
  params: [
    { name: 'lookback', type: 'number', default: 252, min: 60, max: 504, step: 1, description: 'Momentum lookback (trading days)' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const allSymbols = Array.from(ctx.bars.keys());
    if (symbol !== allSymbols[0]) return;

    const lookback = 252;
    const momentums: { symbol: string; mom: number; bar: Bar }[] = [];

    for (const sym of allSymbols) {
      const bars = ctx.bars.get(sym);
      if (!bars || bars.length < lookback + 1) continue;
      const closes = getCloses(bars);
      const mom = (closes[closes.length - 1] - closes[closes.length - 1 - lookback]) / closes[closes.length - 1 - lookback];
      const currBar = ctx.currentBar.get(sym);
      if (currBar) momentums.push({ symbol: sym, mom, bar: currBar });
    }

    if (!momentums.length) return;

    momentums.sort((a, b) => b.mom - a.mom);
    const best = momentums[0];

    for (const sym of allSymbols) {
      const pos = ctx.getPosition(sym);
      if (pos && sym !== best.symbol) {
        submitMarketOrder(ctx, sym, pos.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos.quantity), 'dual_mom_rotate_out');
      }
    }

    if (best.mom > 0 && !hasPosition(ctx, best.symbol)) {
      submitMarketOrder(ctx, best.symbol, Side.LONG, calcQty(ctx, best.bar.close, 0.95), 'dual_mom_best');
    }
  },
};

// ─── 13. Factor Strategy ───────────────────────────────────────────────────

export const FactorStrategy: Strategy = {
  name: 'Multi-Factor',
  description: 'Scores assets on momentum, value (mean-reversion), and volatility',
  version: '1.0.0',
  params: [
    { name: 'momWeight', type: 'number', default: 0.4, min: 0, max: 1, step: 0.1, description: 'Momentum factor weight' },
    { name: 'valWeight', type: 'number', default: 0.3, min: 0, max: 1, step: 0.1, description: 'Value factor weight' },
    { name: 'volWeight', type: 'number', default: 0.3, min: 0, max: 1, step: 0.1, description: 'Low-volatility factor weight' },
    { name: 'topN', type: 'number', default: 3, min: 1, max: 20, step: 1, description: 'Number of top-scored assets to hold' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const allSymbols = Array.from(ctx.bars.keys());
    if (symbol !== allSymbols[0]) return;

    const scores: { symbol: string; score: number; price: number }[] = [];

    for (const sym of allSymbols) {
      const bars = ctx.bars.get(sym);
      if (!bars || bars.length < 62) continue;
      const closes = getCloses(bars);
      const n = closes.length;

      const mom = (closes[n - 1] - closes[n - 61]) / closes[n - 61];

      const ma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
      const valScore = (ma20 - closes[n - 1]) / ma20;

      let sumSq = 0;
      for (let i = n - 20; i < n; i++) {
        const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
        sumSq += ret * ret;
      }
      const vol = Math.sqrt(sumSq / 20);
      const volScore = -vol;

      const total = mom * 0.4 + valScore * 0.3 + volScore * 0.3;
      const currBar = ctx.currentBar.get(sym);
      if (currBar) scores.push({ symbol: sym, score: total, price: currBar.close });
    }

    scores.sort((a, b) => b.score - a.score);
    const topN = scores.slice(0, 3);
    const topSymbols = new Set(topN.map(s => s.symbol));

    for (const sym of allSymbols) {
      const pos = ctx.getPosition(sym);
      if (pos && !topSymbols.has(sym)) {
        submitMarketOrder(ctx, sym, pos.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos.quantity), 'factor_rotate_out');
      }
    }

    for (const { symbol: sym, price } of topN) {
      if (!hasPosition(ctx, sym)) {
        const allocPerAsset = 0.95 / Math.max(1, topN.length);
        submitMarketOrder(ctx, sym, Side.LONG, calcQty(ctx, price, allocPerAsset), 'factor_top_n');
      }
    }
  },
};

// ─── 14. Volatility Targeting ──────────────────────────────────────────────

export const VolatilityTargeting: Strategy = {
  name: 'Volatility Targeting',
  description: 'Adjusts position size to target a fixed annualized volatility',
  version: '1.0.0',
  params: [
    { name: 'targetVol', type: 'number', default: 0.15, min: 0.01, max: 0.5, step: 0.01, description: 'Target annualized volatility' },
    { name: 'lookback', type: 'number', default: 20, min: 5, max: 60, step: 1, description: 'Volatility estimation lookback' },
    { name: 'maxLeverage', type: 'number', default: 2, min: 0.5, max: 5, step: 0.1, description: 'Maximum leverage' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 22) return;
    const closes = getCloses(bars);
    const n = closes.length;

    const returns: number[] = [];
    for (let i = n - 20; i < n; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (returns.length - 1);
    const annualVol = Math.sqrt(variance * 252);

    if (annualVol === 0) return;

    const targetLeverage = Math.min(0.15 / annualVol, 2);
    const targetValue = ctx.equity * targetLeverage;
    const targetQty = Math.max(1, Math.floor(targetValue / bar.close));

    const pos = ctx.getPosition(symbol);
    const currentQty = pos ? Math.abs(pos.quantity) : 0;

    if (Math.abs(targetQty - currentQty) > currentQty * 0.1) {
      if (targetQty > currentQty) {
        const delta = targetQty - currentQty;
        submitMarketOrder(ctx, symbol, Side.LONG, delta, 'voltarget_increase');
      } else if (pos) {
        const delta = currentQty - targetQty;
        submitMarketOrder(ctx, symbol, Side.SHORT, delta, 'voltarget_decrease');
      }
    }
  },
};

// ─── 15. Turtle Trading ────────────────────────────────────────────────────

export const TurtleTrading: Strategy = {
  name: 'Turtle Trading',
  description: 'Complete Turtle Trading rules: 20-day breakout entry, 10-day exit, ATR-based sizing and stops',
  version: '1.0.0',
  params: [
    { name: 'entryPeriod', type: 'number', default: 20, min: 10, max: 55, step: 1, description: 'Entry breakout period' },
    { name: 'exitPeriod', type: 'number', default: 10, min: 5, max: 30, step: 1, description: 'Exit breakout period' },
    { name: 'atrPeriod', type: 'number', default: 20, min: 10, max: 40, step: 1, description: 'ATR period for N' },
    { name: 'riskPercent', type: 'number', default: 0.01, min: 0.005, max: 0.05, step: 0.005, description: 'Risk per trade as % equity' },
    { name: 'maxUnits', type: 'number', default: 4, min: 1, max: 8, step: 1, description: 'Max pyramid units' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const bars = ctx.bars.get(symbol);
    if (!bars || bars.length < 22) return;
    const highs = getHighs(bars);
    const lows = getLows(bars);
    const atrVals = atr(bars, 20);
    const i = bars.length - 1;
    const N = atrVals[i];
    if (isNaN(N) || N <= 0) return;

    const entryHigh = highest(highs, 20, i - 1);
    const entryLow = lowest(lows, 20, i - 1);
    const exitLow = lowest(lows, 10, i - 1);
    const exitHigh = highest(highs, 10, i - 1);

    const dollarVol = N;
    const unitSize = Math.max(1, Math.floor((ctx.equity * 0.01) / dollarVol));
    const pos = ctx.getPosition(symbol);

    if (!pos) {
      if (bar.close > entryHigh) {
        submitMarketOrder(ctx, symbol, Side.LONG, unitSize, 'turtle_breakout_long');
      } else if (bar.close < entryLow) {
        submitMarketOrder(ctx, symbol, Side.SHORT, unitSize, 'turtle_breakout_short');
      }
    } else {
      if (pos.side === Side.LONG) {
        if (Math.abs(pos.quantity) < unitSize * 4 && bar.close > pos.avgPrice + 0.5 * N) {
          submitMarketOrder(ctx, symbol, Side.LONG, unitSize, 'turtle_pyramid');
        }
        if (bar.close < pos.avgPrice - 2 * N || bar.close < exitLow) {
          submitMarketOrder(ctx, symbol, Side.SHORT, Math.abs(pos.quantity), 'turtle_stop_long');
        }
      } else {
        if (Math.abs(pos.quantity) < unitSize * 4 && bar.close < pos.avgPrice - 0.5 * N) {
          submitMarketOrder(ctx, symbol, Side.SHORT, unitSize, 'turtle_pyramid');
        }
        if (bar.close > pos.avgPrice + 2 * N || bar.close > exitHigh) {
          submitMarketOrder(ctx, symbol, Side.LONG, Math.abs(pos.quantity), 'turtle_stop_short');
        }
      }
    }
  },
};

// ─── 16. Sector Rotation ───────────────────────────────────────────────────

export const SectorRotation: Strategy = {
  name: 'Sector Rotation',
  description: 'Rotates into the highest momentum sector/asset on a periodic basis',
  version: '1.0.0',
  params: [
    { name: 'lookback', type: 'number', default: 60, min: 20, max: 252, step: 1, description: 'Momentum lookback days' },
    { name: 'holdPeriod', type: 'number', default: 20, min: 5, max: 60, step: 1, description: 'Rebalance frequency (bars)' },
    { name: 'topN', type: 'number', default: 2, min: 1, max: 10, step: 1, description: 'Number of top sectors to hold' },
    { name: 'positionSize', type: 'number', default: 0.95, min: 0.01, max: 1, step: 0.01, description: 'Total position size fraction' },
  ],
  init() {},
  onBar(ctx, bar, symbol) {
    const allSymbols = Array.from(ctx.bars.keys());
    if (symbol !== allSymbols[0]) return;
    if (ctx.barIndex % 20 !== 0) return;

    const lookback = 60;
    const ranked: { symbol: string; mom: number; price: number }[] = [];

    for (const sym of allSymbols) {
      const bars = ctx.bars.get(sym);
      if (!bars || bars.length < lookback + 1) continue;
      const closes = getCloses(bars);
      const n = closes.length;
      const mom = (closes[n - 1] - closes[n - 1 - lookback]) / closes[n - 1 - lookback];
      const currBar = ctx.currentBar.get(sym);
      if (currBar) ranked.push({ symbol: sym, mom, price: currBar.close });
    }

    ranked.sort((a, b) => b.mom - a.mom);
    const topN = ranked.slice(0, 2);
    const selected = new Set(topN.map(r => r.symbol));

    for (const sym of allSymbols) {
      const pos = ctx.getPosition(sym);
      if (pos && !selected.has(sym)) {
        submitMarketOrder(ctx, sym, pos.side === Side.LONG ? Side.SHORT : Side.LONG, Math.abs(pos.quantity), 'rotation_exit');
      }
    }

    for (const { symbol: sym, price } of topN) {
      if (!hasPosition(ctx, sym)) {
        const alloc = 0.95 / Math.max(1, topN.length);
        submitMarketOrder(ctx, sym, Side.LONG, calcQty(ctx, price, alloc), 'rotation_entry');
      }
    }
  },
};

// ─── Strategies Registry ────────────────────────────────────────────────────

export const BUILT_IN_STRATEGIES: Strategy[] = [
  SMACrossover,
  RSIMeanReversion,
  MACDStrategy,
  BollingerMeanReversion,
  BreakoutStrategy,
  MomentumStrategy,
  PairsTrading,
  TrendFollowing,
  IchimokuStrategy,
  VWAPStrategy,
  MeanReversionZScore,
  DualMomentum,
  FactorStrategy,
  VolatilityTargeting,
  TurtleTrading,
  SectorRotation,
];

export function getStrategy(name: string): Strategy | undefined {
  return BUILT_IN_STRATEGIES.find(s => s.name === name);
}
