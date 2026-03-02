export enum CryptoCategory {
  LAYER_1 = 'LAYER_1',
  LAYER_2 = 'LAYER_2',
  DEFI = 'DEFI',
  STABLECOIN = 'STABLECOIN',
  MEME = 'MEME',
  GAMING = 'GAMING',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  PRIVACY = 'PRIVACY',
  EXCHANGE_TOKEN = 'EXCHANGE_TOKEN',
  WRAPPED = 'WRAPPED',
}

export enum DeFiProtocolType {
  DEX = 'DEX',
  LENDING = 'LENDING',
  YIELD_AGGREGATOR = 'YIELD_AGGREGATOR',
  DERIVATIVES = 'DERIVATIVES',
  BRIDGE = 'BRIDGE',
  LIQUID_STAKING = 'LIQUID_STAKING',
  CDP = 'CDP',
  INSURANCE = 'INSURANCE',
}

export enum AMMType {
  CONSTANT_PRODUCT = 'CONSTANT_PRODUCT',     // Uniswap v2
  CONCENTRATED = 'CONCENTRATED',              // Uniswap v3
  STABLE_SWAP = 'STABLE_SWAP',              // Curve
  CONSTANT_SUM = 'CONSTANT_SUM',
  WEIGHTED = 'WEIGHTED',                      // Balancer
}

export enum NetworkChain {
  ETHEREUM = 'ETHEREUM',
  BITCOIN = 'BITCOIN',
  SOLANA = 'SOLANA',
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM',
  POLYGON = 'POLYGON',
  AVALANCHE = 'AVALANCHE',
  BSC = 'BSC',
  BASE = 'BASE',
}

export enum FundingRateDirection {
  LONGS_PAY = 'LONGS_PAY',
  SHORTS_PAY = 'SHORTS_PAY',
  NEUTRAL = 'NEUTRAL',
}

export interface CryptoAsset {
  symbol: string;
  name: string;
  chain: NetworkChain;
  category: CryptoCategory;
  marketCap: number;
  circulatingSupply: number;
  maxSupply: number | null;
  price: number;
  volume24h: number;
}

export interface ExchangePrice {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  lastPrice: number;
  volume24h: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
  estimatedProfit: number;
  transferTime: number;    // estimated minutes
  transferFee: number;
  netProfit: number;
}

export interface FundingRate {
  exchange: string;
  symbol: string;
  rate: number;            // per period (typically 8h)
  annualized: number;
  nextFundingTime: number;
  direction: FundingRateDirection;
  predictedRate: number;
}

export interface OpenInterestData {
  symbol: string;
  exchange: string;
  openInterest: number;
  openInterestUSD: number;
  change24h: number;
  changePercent24h: number;
}

export interface LiquidationLevel {
  price: number;
  side: 'LONG' | 'SHORT';
  estimatedSize: number;
  leverage: number;
  cumulativeAbove: number;
  cumulativeBelow: number;
}

export interface OnChainMetrics {
  chain: NetworkChain;
  hashRate?: number;
  difficulty?: number;
  activeAddresses24h: number;
  transactionCount24h: number;
  avgTransactionValue: number;
  totalValueLocked?: number;
  blockTime: number;
  avgGasFee: number;
}

export interface MVRVData {
  marketCap: number;
  realizedCap: number;
  mvrvRatio: number;
  zScore: number;
  signal: 'OVERVALUED' | 'FAIR' | 'UNDERVALUED';
}

export interface NVTData {
  networkValue: number;
  transactionVolume: number;
  nvtRatio: number;
  nvtSignal: number;    // smoothed NVT
  interpretation: 'HIGH_VALUE' | 'FAIR' | 'LOW_VALUE';
}

export interface StockToFlowData {
  currentStock: number;
  annualFlow: number;
  sfRatio: number;
  modelPrice: number;
  actualPrice: number;
  deviation: number;
}

export interface ExchangeFlowData {
  exchange: string;
  inflow24h: number;
  outflow24h: number;
  netFlow: number;
  reserveBalance: number;
  changePercent7d: number;
}

export interface StablecoinMetrics {
  symbol: string;
  totalSupply: number;
  marketCap: number;
  peg: number;
  deviation: number;
  dominance: number;
  supplyChange7d: number;
  supplyChange30d: number;
}

export interface DeFiProtocol {
  name: string;
  type: DeFiProtocolType;
  chain: NetworkChain;
  tvl: number;
  tvlChange24h: number;
  volume24h: number;
  fees24h: number;
  revenue24h: number;
  token?: string;
  tokenPrice?: number;
  mcapToTvl?: number;
}

export interface LiquidityPool {
  protocol: string;
  poolId: string;
  token0: string;
  token1: string;
  ammType: AMMType;
  reserve0: number;
  reserve1: number;
  totalValueLocked: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  impermanentLoss30d: number;
}

export interface YieldFarm {
  protocol: string;
  pool: string;
  chain: NetworkChain;
  baseApy: number;
  rewardApy: number;
  totalApy: number;
  tvl: number;
  rewardToken: string;
  riskScore: number;       // 1-10
}

export interface GasFeeEstimate {
  chain: NetworkChain;
  slow: { gwei: number; time: number };
  standard: { gwei: number; time: number };
  fast: { gwei: number; time: number };
  baseFee: number;
  priorityFee: number;
}

export interface FearGreedComponents {
  volatility: number;
  momentum: number;
  socialMedia: number;
  dominance: number;
  trends: number;
  overall: number;         // 0 (extreme fear) – 100 (extreme greed)
  label: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
}

export interface TokenCorrelation {
  token1: string;
  token2: string;
  correlation: number;
  period: number;
  beta: number;
}

export interface MarketDominance {
  symbol: string;
  dominance: number;
  change24h: number;
  change7d: number;
}
