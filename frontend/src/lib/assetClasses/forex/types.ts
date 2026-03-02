export enum CurrencyCategory {
  G10 = 'G10',
  EM = 'EM',
  EXOTIC = 'EXOTIC',
  PEGGED = 'PEGGED',
}

export enum QuoteConvention {
  DIRECT = 'DIRECT',       // domestic per foreign (e.g., USD/JPY for US)
  INDIRECT = 'INDIRECT',   // foreign per domestic
  EUROPEAN = 'EUROPEAN',   // USD terms
  AMERICAN = 'AMERICAN',   // currency per USD
}

export enum TenorUnit {
  SPOT = 'SPOT',
  ON = 'ON',     // overnight
  TN = 'TN',     // tom-next
  SN = 'SN',     // spot-next
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export enum FXInstrumentType {
  SPOT = 'SPOT',
  OUTRIGHT_FORWARD = 'OUTRIGHT_FORWARD',
  FX_SWAP = 'FX_SWAP',
  NDF = 'NDF',
  OPTION_VANILLA = 'OPTION_VANILLA',
  OPTION_BARRIER = 'OPTION_BARRIER',
  CROSS_CURRENCY_SWAP = 'CROSS_CURRENCY_SWAP',
}

export enum StrategySignal {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL',
}

export interface Currency {
  code: string;         // ISO 4217
  name: string;
  category: CurrencyCategory;
  interestRate: number; // annualized risk-free rate
  inflationRate: number;
  centralBank: string;
}

export interface FXPair {
  base: string;
  quote: string;
  spotRate: number;
  bid: number;
  ask: number;
  pipSize: number;      // 0.0001 for most, 0.01 for JPY pairs
  lotSize: number;      // standard lot = 100,000 base units
  quoteConvention: QuoteConvention;
}

export interface FXTenor {
  unit: TenorUnit;
  count: number;
  daysToSettlement: number;
  yearFraction: number;
}

export interface ForwardPoints {
  tenor: FXTenor;
  points: number;        // in pips
  outrightRate: number;
  bidPoints: number;
  askPoints: number;
}

export interface FXSwapLeg {
  settlementDate: number;  // days from now
  rate: number;
  notionalBase: number;
  notionalQuote: number;
  direction: 'BUY' | 'SELL';
}

export interface FXSwapQuote {
  nearLeg: FXSwapLeg;
  farLeg: FXSwapLeg;
  swapPoints: number;
  allInCost: number;
}

export interface NDFContract {
  pair: FXPair;
  notional: number;
  fixingDate: number;    // days to fixing
  settlementDate: number;
  agreedRate: number;
  settlementCurrency: string;
}

export interface NDFSettlement {
  fixingRate: number;
  settlementAmount: number;
  direction: 'PAY' | 'RECEIVE';
}

export interface CrossCurrencyBasisSwap {
  currency1: string;
  currency2: string;
  notional1: number;
  notional2: number;
  tenor: number;          // years
  basisSpread: number;    // bps added to one leg
  rate1: number;
  rate2: number;
}

export interface CarryTradeMetrics {
  pair: string;
  rateHighYield: number;
  rateLowYield: number;
  rateDifferential: number;
  annualizedCarry: number; // in pips
  breakEvenMove: number;   // spot move to offset carry
  sharpeRatio: number;
}

export interface PPPValuation {
  pair: string;
  pppRate: number;
  spotRate: number;
  misalignment: number;  // % over/undervalued
  halfLife: number;       // mean-reversion half-life in months
}

export interface FXVolSurface {
  pair: string;
  tenors: number[];       // expiries in years
  deltas: number[];       // 10d, 25d, ATM, 75d, 90d
  vols: number[][];       // [tenorIdx][deltaIdx]
  atmVol: number[];
  riskReversal25d: number[];
  butterfly25d: number[];
}

export interface FXOptionQuote {
  pair: string;
  strike: number;
  expiry: number;
  isCall: boolean;
  premium: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  impliedVol: number;
}

export interface TechnicalLevel {
  level: number;
  type: 'SUPPORT' | 'RESISTANCE' | 'PIVOT';
  strength: number;    // 0–1
  touchCount: number;
}

export interface FXBasket {
  name: string;
  weights: Record<string, number>;  // currency → weight
  baseValue: number;
  currentValue: number;
  returns: number[];
}

export interface CorrelationEntry {
  pair1: string;
  pair2: string;
  correlation: number;
  period: number;   // lookback in days
}

export interface CentralBankPolicy {
  bank: string;
  currentRate: number;
  previousRate: number;
  nextMeetingDays: number;
  marketImpliedRate: number;
  hawkishScore: number;  // -1 (dovish) to +1 (hawkish)
}
