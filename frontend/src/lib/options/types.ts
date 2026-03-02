export enum OptionType {
  CALL = 'CALL',
  PUT = 'PUT',
}

export enum ExerciseStyle {
  AMERICAN = 'AMERICAN',
  EUROPEAN = 'EUROPEAN',
  BERMUDAN = 'BERMUDAN',
}

export enum BarrierType {
  UP_AND_IN = 'UP_AND_IN',
  UP_AND_OUT = 'UP_AND_OUT',
  DOWN_AND_IN = 'DOWN_AND_IN',
  DOWN_AND_OUT = 'DOWN_AND_OUT',
}

export enum AveragingType {
  ARITHMETIC = 'ARITHMETIC',
  GEOMETRIC = 'GEOMETRIC',
}

export enum LookbackStrikeType {
  FLOATING = 'FLOATING',
  FIXED = 'FIXED',
}

export interface OptionContract {
  strike: number;
  expiry: number; // time to expiry in years
  type: OptionType;
  exerciseStyle: ExerciseStyle;
  underlyingPrice: number;
  riskFreeRate: number;
  dividendYield: number;
  volatility: number;
}

export interface DiscreteDividend {
  date: number; // time in years from now
  amount: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  vanna: number;
  volga: number; // aka vomma
  charm: number; // delta decay
  veta: number;  // vega decay
  speed: number; // 3rd order delta
  zomma: number; // gamma sensitivity to vol
  color: number; // gamma decay
}

export interface PricingResult {
  theoreticalPrice: number;
  greeks: Greeks;
  impliedVolatility?: number;
}

export interface OptionChainEntry {
  strike: number;
  expiry: number;
  call: {
    bid: number;
    ask: number;
    last: number;
    volume: number;
    openInterest: number;
    impliedVol: number;
    greeks: Greeks;
  };
  put: {
    bid: number;
    ask: number;
    last: number;
    volume: number;
    openInterest: number;
    impliedVol: number;
    greeks: Greeks;
  };
}

export interface VolSurfacePoint {
  strike: number;
  expiry: number;
  impliedVol: number;
  moneyness?: number;
  delta?: number;
  logMoneyness?: number;
}

export interface SABRParams {
  alpha: number; // initial vol
  beta: number;  // CEV exponent (0 = normal, 1 = lognormal)
  rho: number;   // correlation between asset and vol
  nu: number;    // vol of vol
}

export interface SVIParams {
  a: number; // vertical shift
  b: number; // angle between put/call wings
  rho: number; // rotation
  m: number;  // horizontal shift
  sigma: number; // smoothing
}

export interface VolSurface {
  points: VolSurfacePoint[];
  strikes: number[];
  expiries: number[];
  grid: number[][]; // [expiryIdx][strikeIdx] = IV
  atmVol: (expiry: number) => number;
  getVol: (strike: number, expiry: number) => number;
  skew: (expiry: number) => number;
  kurtosis: (expiry: number) => number;
  termSlope: () => number;
}

export interface StrategyLeg {
  type: OptionType;
  strike: number;
  expiry: number;
  quantity: number; // positive = long, negative = short
  premium: number;
  exerciseStyle: ExerciseStyle;
}

export interface StrategyPayoff {
  underlyingPrices: number[];
  payoffs: number[];
  breakEvens: number[];
  maxProfit: number;
  maxLoss: number;
  probabilityOfProfit: number;
}

export interface StrategyDefinition {
  name: string;
  legs: StrategyLeg[];
  description: string;
  outlook: string; // bullish, bearish, neutral, etc.
}

export interface ScenarioResult {
  price: number;
  pnl: number;
  greeks: Greeks;
}

export interface ConvergenceResult {
  steps: number;
  price: number;
  delta?: number;
}

export interface MonteCarloResult {
  price: number;
  standardError: number;
  confidenceInterval: [number, number];
  paths?: number;
  greeks?: Greeks;
}

export interface BinomialTreeNode {
  price: number;
  optionValue: number;
  exercised: boolean;
}

export interface PortfolioPosition {
  contract: OptionContract;
  quantity: number;
  entryPrice: number;
}

export interface DeltaHedgeResult {
  sharesNeeded: number;
  hedgeCost: number;
  portfolioDelta: number;
  rebalanceThreshold: number;
}

export interface GammaScalpResult {
  estimatedPnL: number;
  realizedGamma: number;
  hedgeAdjustments: number;
}
