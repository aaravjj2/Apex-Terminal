export enum CommoditySector {
  ENERGY = 'ENERGY',
  PRECIOUS_METALS = 'PRECIOUS_METALS',
  BASE_METALS = 'BASE_METALS',
  AGRICULTURE = 'AGRICULTURE',
  LIVESTOCK = 'LIVESTOCK',
  SOFTS = 'SOFTS',
}

export enum CurveShape {
  CONTANGO = 'CONTANGO',
  BACKWARDATION = 'BACKWARDATION',
  FLAT = 'FLAT',
  MIXED = 'MIXED',
}

export enum SpreadType {
  CALENDAR = 'CALENDAR',
  CRACK = 'CRACK',
  CRUSH = 'CRUSH',
  SPARK = 'SPARK',
  INTER_COMMODITY = 'INTER_COMMODITY',
  LOCATION = 'LOCATION',
}

export enum COTCategory {
  COMMERCIAL = 'COMMERCIAL',
  NON_COMMERCIAL = 'NON_COMMERCIAL',
  NON_REPORTABLE = 'NON_REPORTABLE',
  MANAGED_MONEY = 'MANAGED_MONEY',
  SWAP_DEALER = 'SWAP_DEALER',
  PRODUCER = 'PRODUCER',
}

export enum SeasonalPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
}

export interface Commodity {
  symbol: string;
  name: string;
  sector: CommoditySector;
  unit: string;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  currency: string;
  exchange: string;
  storageCostPerUnit: number;  // annual per unit
  insuranceCostRate: number;   // % of value
}

export interface FuturesContract {
  symbol: string;
  commodity: string;
  expiryDate: number;       // timestamp ms
  daysToExpiry: number;
  price: number;
  volume: number;
  openInterest: number;
  settlementPrice: number;
}

export interface FuturesCurve {
  commodity: string;
  contracts: FuturesContract[];
  spotPrice: number;
  shape: CurveShape;
  annualizedContango: number;  // % per year (negative = backwardation)
}

export interface BasisAnalysis {
  commodity: string;
  spotPrice: number;
  nearFuturesPrice: number;
  basis: number;               // spot - futures
  basisPercent: number;
  historicalBasisMean: number;
  basisZScore: number;
}

export interface RollYield {
  commodity: string;
  frontMonth: FuturesContract;
  nextMonth: FuturesContract;
  rollYieldPercent: number;
  annualizedRollYield: number;
  daysInRoll: number;
}

export interface ConvenienceYield {
  commodity: string;
  spotPrice: number;
  futuresPrice: number;
  riskFreeRate: number;
  storageCost: number;
  timeToExpiry: number;        // years
  convenienceYield: number;    // annualized %
}

export interface SpreadQuote {
  type: SpreadType;
  leg1Symbol: string;
  leg2Symbol: string;
  leg1Price: number;
  leg2Price: number;
  spreadValue: number;
  ratio: number;
  leg3Symbol?: string;
  leg3Price?: number;
}

export interface CrackSpread {
  crudePrice: number;
  gasolinePrice: number;
  heatingOilPrice: number;
  spread321: number;        // 3:2:1 crack
  spread21: number;         // 2:1:1 crack
  gasolineCrack: number;
  heatingOilCrack: number;
  marginPerBarrel: number;
}

export interface CrushSpread {
  soybeanPrice: number;
  soybeanMealPrice: number;
  soybeanOilPrice: number;
  grossProcessingMargin: number;
  boardCrush: number;
}

export interface SparkSpread {
  natGasPrice: number;
  electricityPrice: number;
  heatRate: number;           // BTU/kWh efficiency
  sparkSpread: number;
  darkSpread?: number;        // coal equivalent
  cleanSpark?: number;        // carbon-adjusted
  carbonPrice?: number;
}

export interface SeasonalPattern {
  commodity: string;
  period: SeasonalPeriod;
  averageReturns: number[];
  medianReturns: number[];
  winRate: number[];
  currentPeriodReturn: number;
  seasonalIndex: number[];
  yearsOfData: number;
}

export interface InventoryData {
  commodity: string;
  currentLevel: number;
  previousLevel: number;
  weeklyChange: number;
  fiveYearAverage: number;
  fiveYearRange: [number, number];
  daysOfSupply: number;
  percentOfCapacity: number;
}

export interface COTData {
  commodity: string;
  reportDate: number;
  positions: Record<COTCategory, { long: number; short: number; net: number; change: number }>;
  totalOpenInterest: number;
  netSpeculative: number;
  commercialHedgingPressure: number;
}

export interface SupplyDemandModel {
  commodity: string;
  supply: number;
  demand: number;
  surplus: number;
  priceElasticitySupply: number;
  priceElasticityDemand: number;
  equilibriumPrice: number;
  currentPrice: number;
}

export interface CommodityIndex {
  name: string;
  components: { symbol: string; weight: number; price: number }[];
  value: number;
  baseValue: number;
  totalReturn: number;
  excessReturn: number;
  collateralReturn: number;
  rollYieldComponent: number;
}

export interface WeatherImpact {
  commodity: string;
  region: string;
  heatingDegreeDays: number;
  coolingDegreeDays: number;
  normalHDD: number;
  normalCDD: number;
  deviationHDD: number;
  deviationCDD: number;
  estimatedPriceImpact: number;
}
