// ─── Enums ───────────────────────────────────────────────────────────────────

export enum AssetClass {
  Equity = 'equity',
  FixedIncome = 'fixed_income',
  Commodity = 'commodity',
  RealEstate = 'real_estate',
  Cash = 'cash',
  Crypto = 'crypto',
  Derivative = 'derivative',
  Alternative = 'alternative',
}

export enum Sector {
  Technology = 'technology',
  Healthcare = 'healthcare',
  Financials = 'financials',
  ConsumerDiscretionary = 'consumer_discretionary',
  ConsumerStaples = 'consumer_staples',
  Energy = 'energy',
  Materials = 'materials',
  Industrials = 'industrials',
  Utilities = 'utilities',
  RealEstate = 'real_estate',
  CommunicationServices = 'communication_services',
  Other = 'other',
}

export enum DayCountConvention {
  Thirty360 = '30/360',
  ActualActual = 'actual/actual',
  Actual360 = 'actual/360',
  Actual365 = 'actual/365',
}

export enum TaxLotMethod {
  FIFO = 'fifo',
  LIFO = 'lifo',
  HighestCost = 'highest_cost',
  SpecificId = 'specific_id',
}

export enum RebalanceStrategy {
  Calendar = 'calendar',
  Threshold = 'threshold',
  Optimal = 'optimal',
}

// ─── Core Position & Portfolio ───────────────────────────────────────────────

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  sector: Sector;
  assetClass: AssetClass;
  currency?: string;
  region?: string;
  esgScore?: number;
  beta?: number;
}

export interface TaxLot {
  id: string;
  symbol: string;
  quantity: number;
  costBasis: number;
  purchaseDate: number;
  isShortTerm: boolean;
}

export interface CashFlow {
  date: number;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'dividend' | 'interest' | 'fee';
}

export interface Portfolio {
  positions: Position[];
  totalValue: number;
  cash: number;
  benchmark: string;
  createdAt: number;
  cashFlows?: CashFlow[];
  taxLots?: TaxLot[];
  currency?: string;
}

// ─── Return Series ───────────────────────────────────────────────────────────

export interface ReturnSeries {
  dates: number[];
  returns: number[];
}

export interface PriceHistory {
  dates: number[];
  prices: number[];
}

export interface BenchmarkData {
  returns: ReturnSeries;
  weights: Record<string, number>;
  sectorWeights: Record<string, number>;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  trackingError: number;
  informationRatio: number;
  alpha: number;
  beta: number;
  treynor: number;
  omega: number;
  sterling: number;
  burke: number;
  cagr: number;
  geometricMean: number;
  arithmeticMean: number;
}

export interface RollingReturn {
  date: number;
  return1m: number;
  return3m: number;
  return6m: number;
  return1y: number;
  return3y: number;
  return5y: number;
}

export interface CalendarReturn {
  year: number;
  monthly: number[];
  quarterly: number[];
  yearly: number;
}

export interface CaptureRatio {
  upCapture: number;
  downCapture: number;
  captureRatio: number;
}

export interface WinLossStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  battingAverage: number;
  bestPeriod: number;
  worstPeriod: number;
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export interface RiskMetrics {
  var1d: number;
  var10d: number;
  cvar: number;
  volatility: number;
  downsideDeviation: number;
  semiVariance: number;
  skewness: number;
  kurtosis: number;
  herfindahlIndex: number;
}

export interface DrawdownInfo {
  maxDrawdown: number;
  maxDrawdownPct: number;
  peakDate: number;
  troughDate: number;
  recoveryDate: number | null;
  duration: number;
  recoveryDuration: number | null;
}

export interface VaRResult {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  method: 'historical' | 'parametric' | 'monteCarlo' | 'cornishFisher';
}

export interface ComponentVaR {
  symbol: string;
  marginalVaR: number;
  componentVaR: number;
  percentContribution: number;
}

export interface FactorRiskDecomposition {
  systematicRisk: number;
  idiosyncraticRisk: number;
  totalRisk: number;
  factorContributions: Record<string, number>;
}

// ─── Attribution ─────────────────────────────────────────────────────────────

export interface Attribution {
  allocation: number;
  selection: number;
  interaction: number;
  currency: number;
  total: number;
}

export interface SectorAttribution {
  sector: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  allocation: number;
  selection: number;
  interaction: number;
  total: number;
}

export interface FactorAttribution {
  factorName: string;
  exposure: number;
  factorReturn: number;
  contribution: number;
}

export interface MultiPeriodAttribution {
  periods: { start: number; end: number; attribution: Attribution }[];
  linkedAttribution: Attribution;
  linkingMethod: 'carino' | 'menchero' | 'grap';
}

// ─── Optimization ────────────────────────────────────────────────────────────

export interface OptimizationResult {
  weights: number[];
  expectedReturn: number;
  expectedVolatility: number;
  sharpe: number;
  efficientFrontier: EfficientFrontierPoint[];
}

export interface EfficientFrontierPoint {
  risk: number;
  return: number;
  weights: number[];
  sharpe: number;
}

export interface BlackLittermanInputs {
  marketCap: number[];
  riskAversion: number;
  tau: number;
  viewMatrix: number[][];
  viewReturns: number[];
  viewConfidence: number[];
}

export interface OptimizationConstraints {
  longOnly?: boolean;
  minWeight?: number;
  maxWeight?: number;
  sectorLimits?: Record<string, { min: number; max: number }>;
  maxTurnover?: number;
  maxTrackingError?: number;
  minESGScore?: number;
  targetReturn?: number;
  targetRisk?: number;
}

export interface RebalanceResult {
  trades: { symbol: string; currentWeight: number; targetWeight: number; tradeWeight: number; shares: number }[];
  turnover: number;
  estimatedCost: number;
}

export interface TaxHarvestResult {
  lotsToSell: TaxLot[];
  estimatedTaxSavings: number;
  washSaleRestrictions: string[];
  taxAlpha: number;
}

// ─── Fixed Income ────────────────────────────────────────────────────────────

export interface Bond {
  faceValue: number;
  couponRate: number;
  frequency: 1 | 2 | 4;
  maturityDate: number;
  issueDate: number;
  settlementDate: number;
  dayCount: DayCountConvention;
  callSchedule?: { date: number; price: number }[];
}

export interface BondAnalytics {
  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  ytm: number;
  ytc: number | null;
  ytw: number;
  currentYield: number;
  macaulayDuration: number;
  modifiedDuration: number;
  effectiveDuration: number;
  convexity: number;
  dv01: number;
}

export interface SpreadMetrics {
  gSpread: number;
  iSpread: number;
  zSpread: number;
  oas: number;
  aswSpread: number;
}

export interface YieldCurvePoint {
  maturity: number;
  yield: number;
  discountFactor: number;
  forwardRate: number;
  parYield: number;
}

export interface CashFlowSchedule {
  date: number;
  coupon: number;
  principal: number;
  total: number;
  discountFactor: number;
  presentValue: number;
}

export interface KeyRateDuration {
  tenor: number;
  duration: number;
}

export interface CarryRollAnalysis {
  carry: number;
  rollReturn: number;
  totalCarryRoll: number;
  breakEvenYieldChange: number;
}
