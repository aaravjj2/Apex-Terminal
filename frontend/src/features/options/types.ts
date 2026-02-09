/**
 * Options Analytics Types
 */

export type OptionType = 'call' | 'put';
export type PositionType = 'long' | 'short';

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  theoreticalPrice?: number;
  intrinsicValue?: number;
  timeValue?: number;
}

export interface OptionContract {
  symbol: string;
  contractSymbol: string;
  optionType: OptionType;
  strike: number;
  expiration: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mark: number | null;
  midPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  greeks: Greeks | null;
  inTheMoney: boolean;
  daysToExpiration: number;
}

export interface OptionsChain {
  symbol: string;
  underlyingPrice: number;
  expirations: string[];
  contracts: OptionContract[];
  timestamp: string;
  provider: string;
  totalContracts: number;
  unavailable?: string;
}

export interface IVAnalytics {
  symbol: string;
  currentIv: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  ivHigh: number | null;
  ivLow: number | null;
  lookbackDays: number;
  timestamp: string;
  unavailable?: string;
}

export interface VolatilitySkew {
  symbol: string;
  expiration: string;
  strikes: number[];
  ivs: number[];
  atmStrike: number;
  atmIv: number;
  skewSlope: number;
  delta25PutIv: number | null;
  delta25CallIv: number | null;
  skewRatio: number | null;
  unavailable?: string;
}

export interface TermStructure {
  symbol: string;
  expirations: string[];
  daysToExpiration: number[];
  ivs: number[];
  structureType: 'contango' | 'backwardation' | 'inverted' | 'flat';
  unavailable?: string;
}

export interface PutCallRatio {
  symbol: string;
  volumePcr: number;
  oiPcr: number;
  totalPutVolume: number;
  totalCallVolume: number;
  totalPutOi: number;
  totalCallOi: number;
  timestamp: string;
  unavailable?: string;
}

// Strategy Types
export interface StrategyTemplate {
  name: string;
  description: string;
  category: 'income' | 'directional' | 'neutral' | 'volatility';
  maxProfit: 'limited' | 'unlimited';
  maxLoss: 'limited' | 'unlimited';
  legsDescription: string;
}

export interface StrategyLeg {
  optionType: 'call' | 'put' | 'stock';
  position: PositionType;
  strike: number;
  premium: number;
  quantity: number;
  expirationDays: number;
  iv?: number;
}

export interface StrategyAnalysis {
  name: string;
  legs: StrategyLeg[];
  underlyingPrice: number;
  priceRange: number[];
  expirationPayoff: number[];
  theoreticalPayoff: number[];
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
}

// API Request Types
export interface StrategyAnalyzeRequest {
  legs: StrategyLeg[];
  underlyingPrice: number;
  strategyName?: string;
}

export interface CoveredCallRequest {
  underlyingPrice: number;
  callStrike: number;
  callPremium: number;
  expirationDays?: number;
  iv?: number;
}

export interface IronCondorRequest {
  underlyingPrice: number;
  putLongStrike: number;
  putLongPremium: number;
  putShortStrike: number;
  putShortPremium: number;
  callShortStrike: number;
  callShortPremium: number;
  callLongStrike: number;
  callLongPremium: number;
  expirationDays?: number;
  iv?: number;
}

export interface StraddleRequest {
  underlyingPrice: number;
  strike: number;
  callPremium: number;
  putPremium: number;
  expirationDays?: number;
  iv?: number;
  isLong?: boolean;
}

export interface VerticalSpreadRequest {
  underlyingPrice: number;
  longStrike: number;
  longPremium: number;
  shortStrike: number;
  shortPremium: number;
  optionType?: OptionType;
  expirationDays?: number;
  iv?: number;
}
