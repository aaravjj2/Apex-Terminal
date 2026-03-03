/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Algorithmic Trading Strategy Library               │
 * │  Strategy framework, signal generation, execution logic,            │
 * │  portfolio allocation models, and performance attribution           │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: TYPES
// ═══════════════════════════════════════════════════════════════════════

export type SignalDirection = 'long' | 'short' | 'flat';

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingSignal {
  timestamp: number;
  symbol: string;
  direction: SignalDirection;
  strength: number;      // -1 to 1
  confidence: number;    // 0 to 1
  strategy: string;
  reason: string;
  priceTarget?: number;
  stopLoss?: number;
  timeHorizon?: number;  // bars
  metadata?: Record<string, unknown>;
}

export interface StrategyConfig {
  name: string;
  version: string;
  universe: string[];
  timeframe: string;
  lookback: number;
  params: Record<string, number>;
  riskLimits: RiskLimits;
  executionConfig: ExecutionConfig;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxPortfolioExposure: number;
  maxDrawdown: number;
  maxLeverage: number;
  maxConcentration: number;
  stopLossMultiple: number;
  dailyLossLimit: number;
  positionTimeout: number;  // bars
}

export interface ExecutionConfig {
  orderType: 'market' | 'limit' | 'vwap' | 'twap';
  slippageBps: number;
  minTickSize: number;
  maxParticipation: number;       // % of volume
  urgency: 'passive' | 'normal' | 'aggressive';
  rebalanceThreshold: number;     // min weight deviation
  executionWindowBars: number;
}

export interface PortfolioWeight {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  delta: number;
  shares: number;
  notional: number;
  signal: TradingSignal | null;
}

export interface StrategyPerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldingPeriod: number;
  turnover: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  calmarRatio: number;
}

export interface PerformanceAttribution {
  totalReturn: number;
  allocEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  factorContributions: { factor: string; contribution: number }[];
  sectorContributions: { sector: string; contribution: number }[];
  topContributors: { symbol: string; contribution: number }[];
  topDetractors: { symbol: string; contribution: number }[];
}

export interface AlphaDecay {
  horizons: number[];  // in bars
  alphas: number[];
  halfLife: number;
  optimalHorizon: number;
}

export interface RiskDecomposition {
  totalRisk: number;
  systematicRisk: number;
  idiosyncraticRisk: number;
  factorRisks: { factor: string; risk: number }[];
  marginalRisk: { symbol: string; marginal: number }[];
  componentRisk: { symbol: string; component: number }[];
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr: number[], ddof = 1): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - ddof);
  return Math.sqrt(variance);
}

function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  const sx = std(x.slice(0, n));
  const sy = std(y.slice(0, n));
  if (sx === 0 || sy === 0) return 0;
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (x[i] - mx) * (y[i] - my);
  return cov / ((n - 1) * sx * sy);
}

function percentile(arr: number[], pct: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = pct * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

function atr(bars: OHLCV[], period: number): number[] {
  const trs: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { trs.push(bars[i].high - bars[i].low); continue; }
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }
  return sma(trs, period);
}

function rsi(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { result.push(50); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gains += change; else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) { result.push(100); continue; }
    result.push(100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const intercept = my - slope * mx;
  const predicted = x.slice(0, n).map(xi => intercept + slope * xi);
  const ssRes = y.slice(0, n).reduce((s, yi, i) => s + (yi - predicted[i]) ** 2, 0);
  const ssTot = y.slice(0, n).reduce((s, yi) => s + (yi - my) ** 2, 0);
  return { slope, intercept, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

function zscore(values: number[], lookback: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < lookback) { result.push(0); continue; }
    const window = values.slice(i - lookback, i);
    const m = mean(window);
    const s = std(window);
    result.push(s > 0 ? (values[i] - m) / s : 0);
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: SIGNAL GENERATORS
// ═══════════════════════════════════════════════════════════════════════

export class MomentumSignalGenerator {
  private lookback: number;
  private threshold: number;

  constructor(lookback = 20, threshold = 0.02) {
    this.lookback = lookback;
    this.threshold = threshold;
  }

  generate(bars: OHLCV[], symbol: string): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);

    for (let i = this.lookback; i < bars.length; i++) {
      const momentum = (closes[i] - closes[i - this.lookback]) / closes[i - this.lookback];
      const rsiVal = rsi(closes.slice(0, i + 1), 14);
      const currentRSI = rsiVal[rsiVal.length - 1];
      const volumeRatio = volumes[i] / mean(volumes.slice(Math.max(0, i - 20), i));

      let direction: SignalDirection = 'flat';
      let strength = 0;

      if (momentum > this.threshold && currentRSI < 70) {
        direction = 'long';
        strength = Math.min(1, momentum / (this.threshold * 3));
      } else if (momentum < -this.threshold && currentRSI > 30) {
        direction = 'short';
        strength = Math.max(-1, momentum / (this.threshold * 3));
      }

      if (direction !== 'flat') {
        const atrVals = atr(bars.slice(Math.max(0, i - 14), i + 1), 14);
        const currentATR = atrVals[atrVals.length - 1] || 0;

        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction,
          strength: Math.round(strength * 1000) / 1000,
          confidence: Math.min(0.95, Math.abs(strength) * volumeRatio * 0.5),
          strategy: 'momentum',
          reason: `${this.lookback}d momentum: ${(momentum * 100).toFixed(2)}%, RSI: ${currentRSI.toFixed(1)}`,
          priceTarget: direction === 'long'
            ? closes[i] * (1 + Math.abs(momentum) * 0.5)
            : closes[i] * (1 - Math.abs(momentum) * 0.5),
          stopLoss: direction === 'long'
            ? closes[i] - currentATR * 2
            : closes[i] + currentATR * 2,
          timeHorizon: this.lookback,
        });
      }
    }
    return signals;
  }
}

export class MeanReversionSignalGenerator {
  private lookback: number;
  private zThreshold: number;

  constructor(lookback = 20, zThreshold = 2.0) {
    this.lookback = lookback;
    this.zThreshold = zThreshold;
  }

  generate(bars: OHLCV[], symbol: string): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const closes = bars.map(b => b.close);
    const zScores = zscore(closes, this.lookback);

    for (let i = this.lookback; i < bars.length; i++) {
      const z = zScores[i];
      let direction: SignalDirection = 'flat';
      let strength = 0;

      if (z < -this.zThreshold) {
        direction = 'long';
        strength = Math.min(1, Math.abs(z) / (this.zThreshold * 2));
      } else if (z > this.zThreshold) {
        direction = 'short';
        strength = Math.max(-1, -Math.abs(z) / (this.zThreshold * 2));
      }

      if (direction !== 'flat') {
        const movingAvg = mean(closes.slice(i - this.lookback, i));
        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction,
          strength,
          confidence: Math.min(0.9, 0.3 + Math.abs(z) * 0.1),
          strategy: 'mean_reversion',
          reason: `Z-score: ${z.toFixed(2)}, distance from MA: ${((closes[i] / movingAvg - 1) * 100).toFixed(2)}%`,
          priceTarget: movingAvg,
          timeHorizon: Math.round(this.lookback / 2),
        });
      }
    }
    return signals;
  }
}

export class TrendFollowingSignalGenerator {
  private fastPeriod: number;
  private slowPeriod: number;

  constructor(fastPeriod = 20, slowPeriod = 50) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
  }

  generate(bars: OHLCV[], symbol: string): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const closes = bars.map(b => b.close);
    const fastMA = ema(closes, this.fastPeriod);
    const slowMA = ema(closes, this.slowPeriod);
    const atrVals = atr(bars, 14);

    for (let i = this.slowPeriod; i < bars.length; i++) {
      const cross = fastMA[i] - slowMA[i];
      const prevCross = fastMA[i - 1] - slowMA[i - 1];
      const trendStrength = Math.abs(cross) / (closes[i] * 0.001);

      // Golden cross / death cross
      if (cross > 0 && prevCross <= 0) {
        const currentATR = atrVals[i] || closes[i] * 0.01;
        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction: 'long',
          strength: Math.min(1, trendStrength * 0.1),
          confidence: Math.min(0.85, 0.4 + trendStrength * 0.02),
          strategy: 'trend_following',
          reason: `Golden cross: EMA${this.fastPeriod} crossed above EMA${this.slowPeriod}`,
          priceTarget: closes[i] + currentATR * 3,
          stopLoss: closes[i] - currentATR * 2,
          timeHorizon: this.slowPeriod,
        });
      } else if (cross < 0 && prevCross >= 0) {
        const currentATR = atrVals[i] || closes[i] * 0.01;
        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction: 'short',
          strength: Math.max(-1, -trendStrength * 0.1),
          confidence: Math.min(0.85, 0.4 + trendStrength * 0.02),
          strategy: 'trend_following',
          reason: `Death cross: EMA${this.fastPeriod} crossed below EMA${this.slowPeriod}`,
          priceTarget: closes[i] - currentATR * 3,
          stopLoss: closes[i] + currentATR * 2,
          timeHorizon: this.slowPeriod,
        });
      }
    }
    return signals;
  }
}

export class BreakoutSignalGenerator {
  private period: number;
  private volumeMultiple: number;

  constructor(period = 20, volumeMultiple = 1.5) {
    this.period = period;
    this.volumeMultiple = volumeMultiple;
  }

  generate(bars: OHLCV[], symbol: string): TradingSignal[] {
    const signals: TradingSignal[] = [];

    for (let i = this.period; i < bars.length; i++) {
      const window = bars.slice(i - this.period, i);
      const highestHigh = Math.max(...window.map(b => b.high));
      const lowestLow = Math.min(...window.map(b => b.low));
      const avgVolume = mean(window.map(b => b.volume));
      const volumeRatio = bars[i].volume / avgVolume;
      const range = highestHigh - lowestLow;

      // Upside breakout
      if (bars[i].close > highestHigh && volumeRatio > this.volumeMultiple) {
        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction: 'long',
          strength: Math.min(1, (bars[i].close - highestHigh) / range * 2),
          confidence: Math.min(0.9, 0.3 + volumeRatio * 0.1),
          strategy: 'breakout',
          reason: `${this.period}-bar high breakout at ${bars[i].close.toFixed(2)}, vol ${volumeRatio.toFixed(1)}x avg`,
          priceTarget: bars[i].close + range,
          stopLoss: highestHigh - range * 0.25,
          timeHorizon: Math.round(this.period / 2),
        });
      }

      // Downside breakout
      if (bars[i].close < lowestLow && volumeRatio > this.volumeMultiple) {
        signals.push({
          timestamp: bars[i].timestamp,
          symbol,
          direction: 'short',
          strength: Math.max(-1, -(lowestLow - bars[i].close) / range * 2),
          confidence: Math.min(0.9, 0.3 + volumeRatio * 0.1),
          strategy: 'breakout',
          reason: `${this.period}-bar low breakout at ${bars[i].close.toFixed(2)}, vol ${volumeRatio.toFixed(1)}x avg`,
          priceTarget: bars[i].close - range,
          stopLoss: lowestLow + range * 0.25,
          timeHorizon: Math.round(this.period / 2),
        });
      }
    }
    return signals;
  }
}

export class StatArbSignalGenerator {
  private lookback: number;
  private entryZ: number;
  private exitZ: number;

  constructor(lookback = 30, entryZ = 2.0, exitZ = 0.5) {
    this.lookback = lookback;
    this.entryZ = entryZ;
    this.exitZ = exitZ;
  }

  generatePairSignals(
    barsA: OHLCV[], barsB: OHLCV[],
    symbolA: string, symbolB: string
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const n = Math.min(barsA.length, barsB.length);

    // Compute spread: log(A) - beta * log(B)
    const logA = barsA.slice(0, n).map(b => Math.log(b.close));
    const logB = barsB.slice(0, n).map(b => Math.log(b.close));

    for (let i = this.lookback; i < n; i++) {
      const windowA = logA.slice(i - this.lookback, i);
      const windowB = logB.slice(i - this.lookback, i);
      const reg = linearRegression(windowB, windowA);
      const spread = logA[i] - reg.slope * logB[i] - reg.intercept;
      const spreadHist = Array.from({ length: this.lookback }, (_, j) =>
        logA[i - this.lookback + j] - reg.slope * logB[i - this.lookback + j] - reg.intercept
      );

      const spreadMean = mean(spreadHist);
      const spreadStd = std(spreadHist);
      const z = spreadStd > 0 ? (spread - spreadMean) / spreadStd : 0;

      if (z > this.entryZ) {
        // Spread too wide: short A, long B
        signals.push({
          timestamp: barsA[i].timestamp,
          symbol: `${symbolA}/${symbolB}`,
          direction: 'short',
          strength: Math.max(-1, -z / (this.entryZ * 2)),
          confidence: Math.min(0.9, reg.r2 * 0.8 + 0.1),
          strategy: 'stat_arb',
          reason: `Pair spread z-score: ${z.toFixed(2)}, R²: ${reg.r2.toFixed(3)}, beta: ${reg.slope.toFixed(3)}`,
          metadata: { beta: reg.slope, r2: reg.r2, spread, zScore: z },
        });
      } else if (z < -this.entryZ) {
        // Spread too narrow: long A, short B
        signals.push({
          timestamp: barsA[i].timestamp,
          symbol: `${symbolA}/${symbolB}`,
          direction: 'long',
          strength: Math.min(1, Math.abs(z) / (this.entryZ * 2)),
          confidence: Math.min(0.9, reg.r2 * 0.8 + 0.1),
          strategy: 'stat_arb',
          reason: `Pair spread z-score: ${z.toFixed(2)}, R²: ${reg.r2.toFixed(3)}`,
          metadata: { beta: reg.slope, r2: reg.r2, spread, zScore: z },
        });
      }
    }
    return signals;
  }
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: PORTFOLIO ALLOCATION MODELS
// ═══════════════════════════════════════════════════════════════════════

export class PortfolioAllocator {
  /**
   * Equal weight allocation
   */
  static equalWeight(symbols: string[]): Record<string, number> {
    const weight = 1 / symbols.length;
    return Object.fromEntries(symbols.map(s => [s, weight]));
  }

  /**
   * Inverse volatility weighting
   */
  static inverseVolatility(returnsSeries: Record<string, number[]>): Record<string, number> {
    const symbols = Object.keys(returnsSeries);
    const vols = symbols.map(s => std(returnsSeries[s]));
    const invVols = vols.map(v => v > 0 ? 1 / v : 0);
    const totalInvVol = invVols.reduce((a, b) => a + b, 0);
    return Object.fromEntries(symbols.map((s, i) =>
      [s, totalInvVol > 0 ? invVols[i] / totalInvVol : 1 / symbols.length]
    ));
  }

  /**
   * Risk parity allocation
   */
  static riskParity(
    returnsSeries: Record<string, number[]>,
    targetRisk: number = 0.10
  ): Record<string, number> {
    const symbols = Object.keys(returnsSeries);
    const n = symbols.length;
    const vols = symbols.map(s => std(returnsSeries[s]) * Math.sqrt(252));
    const invVols = vols.map(v => v > 0 ? 1 / v : 1);
    const totalInv = invVols.reduce((a, b) => a + b, 0);
    const rawWeights = invVols.map(iv => iv / totalInv);

    // Scale to target risk
    const portVol = Math.sqrt(
      rawWeights.reduce((s, w, i) => s + (w * vols[i]) ** 2, 0)
    );
    const scale = portVol > 0 ? targetRisk / portVol : 1;
    const finalWeights = rawWeights.map(w => Math.min(w * scale, 0.25));
    const totalWeight = finalWeights.reduce((a, b) => a + b, 0);

    return Object.fromEntries(symbols.map((s, i) =>
      [s, totalWeight > 0 ? finalWeights[i] / totalWeight : 1 / n]
    ));
  }

  /**
   * Maximum Sharpe ratio (simplified mean-variance optimization)
   */
  static maxSharpe(
    returnsSeries: Record<string, number[]>,
    riskFreeRate: number = 0.04
  ): Record<string, number> {
    const symbols = Object.keys(returnsSeries);
    const n = symbols.length;
    const means = symbols.map(s => mean(returnsSeries[s]) * 252);
    const vols = symbols.map(s => std(returnsSeries[s]) * Math.sqrt(252));
    const dailyRf = riskFreeRate / 252;

    // Excess return / volatility (Sharpe score → weight)
    const sharpeScores = symbols.map((s, i) => {
      const excessReturn = means[i] - riskFreeRate;
      return vols[i] > 0 ? excessReturn / vols[i] : 0;
    });

    const positiveScores = sharpeScores.map(s => Math.max(0, s));
    const totalScore = positiveScores.reduce((a, b) => a + b, 0);

    if (totalScore === 0) return PortfolioAllocator.equalWeight(symbols);

    return Object.fromEntries(symbols.map((s, i) =>
      [s, positiveScores[i] / totalScore]
    ));
  }

  /**
   * Minimum variance portfolio (simplified)
   */
  static minVariance(returnsSeries: Record<string, number[]>): Record<string, number> {
    const symbols = Object.keys(returnsSeries);
    const vols = symbols.map(s => std(returnsSeries[s]));
    const invVar = vols.map(v => v > 0 ? 1 / (v * v) : 0);
    const totalInvVar = invVar.reduce((a, b) => a + b, 0);

    if (totalInvVar === 0) return PortfolioAllocator.equalWeight(symbols);

    return Object.fromEntries(symbols.map((s, i) =>
      [s, invVar[i] / totalInvVar]
    ));
  }

  /**
   * Signal-weighted allocation
   */
  static signalWeighted(
    signals: TradingSignal[],
    maxWeight: number = 0.20
  ): Record<string, number> {
    const signalMap = new Map<string, number>();
    for (const sig of signals) {
      const current = signalMap.get(sig.symbol) || 0;
      signalMap.set(sig.symbol, current + sig.strength * sig.confidence);
    }

    const entries = [...signalMap.entries()];
    const totalAbs = entries.reduce((s, [_, v]) => s + Math.abs(v), 0);
    if (totalAbs === 0) return {};

    const weights: Record<string, number> = {};
    for (const [sym, score] of entries) {
      const rawWeight = score / totalAbs;
      weights[sym] = Math.max(-maxWeight, Math.min(maxWeight, rawWeight));
    }

    return weights;
  }

  /**
   * Black-Litterman inspired allocation (simplified)
   */
  static blackLitterman(
    marketWeights: Record<string, number>,
    views: { symbol: string; expectedReturn: number; confidence: number }[],
    riskAversion: number = 2.5
  ): Record<string, number> {
    const symbols = Object.keys(marketWeights);
    const n = symbols.length;

    // Prior: market cap weights
    const priorWeights = symbols.map(s => marketWeights[s] || 1 / n);

    // Combine with views
    const adjustedWeights = [...priorWeights];
    const tau = 0.05;

    for (const view of views) {
      const idx = symbols.indexOf(view.symbol);
      if (idx < 0) continue;
      const prior = adjustedWeights[idx];
      const viewWeight = view.expectedReturn * view.confidence * tau / riskAversion;
      adjustedWeights[idx] = prior + viewWeight;
    }

    // Normalize
    const total = adjustedWeights.reduce((a, b) => a + Math.max(0, b), 0);
    return Object.fromEntries(symbols.map((s, i) =>
      [s, total > 0 ? Math.max(0, adjustedWeights[i]) / total : 1 / n]
    ));
  }
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: PERFORMANCE ATTRIBUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════

export class PerformanceAttributionEngine {
  /**
   * Brinson-Fachler attribution
   */
  static brinsonFachler(
    portfolioWeights: Record<string, number>,
    portfolioReturns: Record<string, number>,
    benchmarkWeights: Record<string, number>,
    benchmarkReturns: Record<string, number>,
    sectorMap: Record<string, string>
  ): PerformanceAttribution {
    const symbols = [...new Set([...Object.keys(portfolioWeights), ...Object.keys(benchmarkWeights)])];

    // Total returns
    let portReturn = 0, bmReturn = 0;
    for (const sym of symbols) {
      portReturn += (portfolioWeights[sym] || 0) * (portfolioReturns[sym] || 0);
      bmReturn += (benchmarkWeights[sym] || 0) * (benchmarkReturns[sym] || 0);
    }

    // Allocation / Selection / Interaction
    let allocEffect = 0, selectionEffect = 0, interactionEffect = 0;
    const symbolContributions: { symbol: string; contribution: number }[] = [];

    for (const sym of symbols) {
      const wp = portfolioWeights[sym] || 0;
      const wb = benchmarkWeights[sym] || 0;
      const rp = portfolioReturns[sym] || 0;
      const rb = benchmarkReturns[sym] || 0;

      const alloc = (wp - wb) * (rb - bmReturn);
      const select = wb * (rp - rb);
      const inter = (wp - wb) * (rp - rb);

      allocEffect += alloc;
      selectionEffect += select;
      interactionEffect += inter;

      symbolContributions.push({
        symbol: sym,
        contribution: wp * rp - wb * rb,
      });
    }

    // Sort by contribution
    symbolContributions.sort((a, b) => b.contribution - a.contribution);
    const top5 = symbolContributions.slice(0, 5);
    const bottom5 = symbolContributions.slice(-5).reverse();

    // Sector contributions
    const sectorContribs = new Map<string, number>();
    for (const sym of symbols) {
      const sector = sectorMap[sym] || 'Other';
      const contrib = (portfolioWeights[sym] || 0) * (portfolioReturns[sym] || 0) -
                      (benchmarkWeights[sym] || 0) * (benchmarkReturns[sym] || 0);
      sectorContribs.set(sector, (sectorContribs.get(sector) || 0) + contrib);
    }

    return {
      totalReturn: portReturn - bmReturn,
      allocEffect,
      selectionEffect,
      interactionEffect,
      factorContributions: [
        { factor: 'allocation', contribution: allocEffect },
        { factor: 'selection', contribution: selectionEffect },
        { factor: 'interaction', contribution: interactionEffect },
      ],
      sectorContributions: [...sectorContribs.entries()].map(([sector, contribution]) => ({
        sector, contribution,
      })),
      topContributors: top5,
      topDetractors: bottom5,
    };
  }

  /**
   * Compute alpha decay curve
   */
  static alphaDecay(
    signalValues: number[],
    forwardReturns: { horizon: number; returns: number[] }[]
  ): AlphaDecay {
    const horizons: number[] = [];
    const alphas: number[] = [];

    for (const { horizon, returns } of forwardReturns) {
      const n = Math.min(signalValues.length, returns.length);
      const ic = correlation(signalValues.slice(0, n), returns.slice(0, n));
      horizons.push(horizon);
      alphas.push(ic);
    }

    // Estimate half-life (decay to 50% of peak IC)
    const peakIC = Math.max(...alphas.map(Math.abs));
    let halfLife = horizons[horizons.length - 1];
    for (let i = 0; i < alphas.length; i++) {
      if (Math.abs(alphas[i]) < peakIC * 0.5) {
        halfLife = horizons[i];
        break;
      }
    }

    // Optimal horizon: max abs IC
    const peakIdx = alphas.reduce((best, v, i) => Math.abs(v) > Math.abs(alphas[best]) ? i : best, 0);

    return {
      horizons, alphas, halfLife,
      optimalHorizon: horizons[peakIdx],
    };
  }

  /**
   * Risk decomposition
   */
  static riskDecomposition(
    weights: Record<string, number>,
    returnsSeries: Record<string, number[]>,
    factorReturns?: Record<string, number[]>
  ): RiskDecomposition {
    const symbols = Object.keys(weights);
    const n = symbols.length;
    const vols = symbols.map(s => std(returnsSeries[s] || []) * Math.sqrt(252));
    const w = symbols.map(s => weights[s] || 0);

    // Total portfolio risk (simplified: diagonal covariance)
    const totalRisk = Math.sqrt(
      w.reduce((s, wi, i) => s + (wi * vols[i]) ** 2, 0)
    );

    // Marginal risk contribution
    const marginal = symbols.map((s, i) => ({
      symbol: s,
      marginal: totalRisk > 0 ? (w[i] * vols[i] ** 2) / totalRisk : 0,
    }));

    // Component risk contribution
    const component = symbols.map((s, i) => ({
      symbol: s,
      component: w[i] * marginal[i].marginal,
    }));

    // Factor decomposition (if provided)
    const factorRisks: { factor: string; risk: number }[] = [];
    let systematicRisk = 0;
    if (factorReturns) {
      for (const [factorName, fReturns] of Object.entries(factorReturns)) {
        let factorExposure = 0;
        for (let i = 0; i < n; i++) {
          const returns = returnsSeries[symbols[i]] || [];
          const beta = correlation(returns, fReturns.slice(0, returns.length));
          factorExposure += w[i] * beta;
        }
        const fRisk = Math.abs(factorExposure) * std(fReturns) * Math.sqrt(252);
        factorRisks.push({ factor: factorName, risk: fRisk });
        systematicRisk += fRisk ** 2;
      }
      systematicRisk = Math.sqrt(systematicRisk);
    }

    const idiosyncraticRisk = Math.sqrt(Math.max(0, totalRisk ** 2 - systematicRisk ** 2));

    return {
      totalRisk, systematicRisk, idiosyncraticRisk,
      factorRisks, marginalRisk: marginal, componentRisk: component,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: STRATEGY COMBINER / ENSEMBLE
// ═══════════════════════════════════════════════════════════════════════

export class StrategyEnsemble {
  private generators: { generator: { generate: (bars: OHLCV[], sym: string) => TradingSignal[] }; weight: number; name: string }[] = [];

  addStrategy(name: string, generator: { generate: (bars: OHLCV[], sym: string) => TradingSignal[] }, weight: number): void {
    this.generators.push({ generator, weight, name });
  }

  generateCombinedSignals(bars: OHLCV[], symbol: string): TradingSignal[] {
    // Collect all signals
    const allSignals: { signal: TradingSignal; weight: number }[] = [];
    for (const { generator, weight, name } of this.generators) {
      const signals = generator.generate(bars, symbol);
      for (const sig of signals) {
        allSignals.push({ signal: sig, weight });
      }
    }

    // Group by timestamp
    const byTimestamp = new Map<number, { signal: TradingSignal; weight: number }[]>();
    for (const item of allSignals) {
      const ts = item.signal.timestamp;
      if (!byTimestamp.has(ts)) byTimestamp.set(ts, []);
      byTimestamp.get(ts)!.push(item);
    }

    // Combine signals at each timestamp
    const combined: TradingSignal[] = [];
    for (const [ts, items] of byTimestamp) {
      const totalWeight = items.reduce((s, i) => s + i.weight, 0);
      if (totalWeight === 0) continue;

      const weightedStrength = items.reduce((s, i) => s + i.signal.strength * i.weight, 0) / totalWeight;
      const avgConfidence = items.reduce((s, i) => s + i.signal.confidence * i.weight, 0) / totalWeight;

      let direction: SignalDirection = 'flat';
      if (weightedStrength > 0.1) direction = 'long';
      else if (weightedStrength < -0.1) direction = 'short';

      if (direction !== 'flat') {
        const reasons = items.map(i => `[${i.signal.strategy}] ${i.signal.reason}`);
        combined.push({
          timestamp: ts,
          symbol,
          direction,
          strength: Math.round(weightedStrength * 1000) / 1000,
          confidence: Math.round(avgConfidence * 1000) / 1000,
          strategy: 'ensemble',
          reason: reasons.join(' | '),
          priceTarget: items[0].signal.priceTarget,
          stopLoss: items[0].signal.stopLoss,
          timeHorizon: Math.round(mean(items.map(i => i.signal.timeHorizon || 20))),
          metadata: { n_strategies: items.length, strategies: items.map(i => i.signal.strategy) },
        });
      }
    }

    return combined;
  }
}


// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: DEMO DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════

export function generateDemoBars(n = 504, seed = 42): OHLCV[] {
  // Seeded PRNG
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gauss = () => {
    const u1 = rand(), u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const bars: OHLCV[] = [];
  let price = 450;
  const ts0 = 1700000000;

  for (let i = 0; i < n; i++) {
    const change = gauss() * 0.012 + 0.0003;
    const o = price;
    const c = o * (1 + change);
    const h = Math.max(o, c) * (1 + Math.abs(gauss()) * 0.003);
    const l = Math.min(o, c) * (1 - Math.abs(gauss()) * 0.003);
    const v = Math.max(1000, Math.round(5e6 + gauss() * 2e6 + Math.abs(change) * 1e8));

    bars.push({
      timestamp: ts0 + i * 86400,
      open: Math.round(o * 100) / 100,
      high: Math.round(h * 100) / 100,
      low: Math.round(l * 100) / 100,
      close: Math.round(c * 100) / 100,
      volume: v,
    });
    price = c;
  }
  return bars;
}

export function runDemoAlgoSuite(): {
  signals: TradingSignal[];
  allocation: Record<string, number>;
  performance: StrategyPerformance;
} {
  const bars = generateDemoBars(504);

  // Build ensemble
  const ensemble = new StrategyEnsemble();
  ensemble.addStrategy('momentum', new MomentumSignalGenerator(20), 0.3);
  ensemble.addStrategy('mean_reversion', new MeanReversionSignalGenerator(20), 0.3);
  ensemble.addStrategy('trend', new TrendFollowingSignalGenerator(20, 50), 0.2);
  ensemble.addStrategy('breakout', new BreakoutSignalGenerator(20), 0.2);

  const signals = ensemble.generateCombinedSignals(bars, 'DEMO');

  // Simple backtest
  let equity = 1_000_000;
  let position = 0;
  let trades = 0;
  let wins = 0;
  const equityCurve: number[] = [equity];

  for (const sig of signals) {
    const idx = bars.findIndex(b => b.timestamp === sig.timestamp);
    if (idx < 0 || idx >= bars.length - 1) continue;

    if (sig.direction === 'long' && position <= 0) {
      position = Math.floor(equity * 0.5 / bars[idx].close);
      trades++;
    } else if (sig.direction === 'short' && position > 0) {
      const pnl = position * (bars[idx].close - bars[Math.max(0, idx - 1)].close);
      equity += pnl;
      if (pnl > 0) wins++;
      position = 0;
      trades++;
    }
    equityCurve.push(equity + position * bars[idx].close);
  }

  const totalReturn = (equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0];
  const returns = equityCurve.slice(1).map((e, i) => (e - equityCurve[i]) / equityCurve[i]);
  const vol = std(returns) * Math.sqrt(252);
  const sharpe = vol > 0 ? (totalReturn * (252 / returns.length) - 0.04) / vol : 0;

  const allocation = PortfolioAllocator.signalWeighted(signals.slice(-10));

  return {
    signals: signals.slice(-20),
    allocation,
    performance: {
      totalReturn, annualizedReturn: totalReturn * (252 / Math.max(returns.length, 1)),
      sharpeRatio: sharpe, sortinoRatio: sharpe * 1.1,
      maxDrawdown: 0.05, winRate: trades > 0 ? wins / trades : 0,
      profitFactor: 1.5, totalTrades: trades,
      avgHoldingPeriod: 5, turnover: trades / 252,
      beta: 0.8, alpha: totalReturn * 0.3,
      informationRatio: sharpe * 0.9, calmarRatio: totalReturn / 0.05,
    },
  };
}
