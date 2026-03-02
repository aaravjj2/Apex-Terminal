// ─── Signals & Enums ────────────────────────────────────────────────────────

export enum Signal {
  BUY = 'BUY',
  SELL = 'SELL',
  SHORT = 'SHORT',
  COVER = 'COVER',
  HOLD = 'HOLD',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
  BRACKET = 'BRACKET',
  OCO = 'OCO',
  TRAILING_STOP = 'TRAILING_STOP',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum PositionSizing {
  FIXED = 'FIXED',
  PERCENT_EQUITY = 'PERCENT_EQUITY',
  KELLY = 'KELLY',
  RISK_BASED = 'RISK_BASED',
  VOLATILITY_BASED = 'VOLATILITY_BASED',
}

export enum CommissionModel {
  PER_SHARE = 'PER_SHARE',
  PER_TRADE = 'PER_TRADE',
  PERCENTAGE = 'PERCENTAGE',
  TIERED = 'TIERED',
}

export enum SlippageModel {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
  VOLATILITY_BASED = 'VOLATILITY_BASED',
  MARKET_IMPACT = 'MARKET_IMPACT',
}

export enum Side {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export enum Timeframe {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1D',
  W1 = '1W',
  MN = '1M',
}

// ─── Bar / Candle ───────────────────────────────────────────────────────────

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
  adjClose?: number;
}

// ─── Order ──────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: Side;
  quantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  trailingAmount?: number;
  trailingPercent?: number;
  timeInForce: 'GTC' | 'DAY' | 'IOC' | 'FOK';
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice: number;
  commission: number;
  slippage: number;
  createdAt: number;
  filledAt?: number;
  cancelledAt?: number;
  parentId?: string;
  childIds?: string[];
  tag?: string;
  reason?: string;
}

// ─── Trade ──────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  symbol: string;
  side: Side;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  mae: number;
  mfe: number;
  duration: number;
  entryReason?: string;
  exitReason?: string;
  tags?: string[];
  bars: number;
  entryOrderId: string;
  exitOrderId: string;
}

// ─── Position ───────────────────────────────────────────────────────────────

export interface Position {
  symbol: string;
  side: Side;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  maxPrice: number;
  minPrice: number;
  entryTime: number;
  commission: number;
  margin: number;
}

// ─── Commission Config ──────────────────────────────────────────────────────

export interface CommissionConfig {
  model: CommissionModel;
  perShare?: number;
  perTrade?: number;
  percentage?: number;
  minPerTrade?: number;
  maxPerTrade?: number;
  tiers?: { maxVolume: number; rate: number }[];
}

// ─── Slippage Config ────────────────────────────────────────────────────────

export interface SlippageConfig {
  model: SlippageModel;
  fixedAmount?: number;
  percentage?: number;
  volatilityFactor?: number;
  impactExponent?: number;
  participationRate?: number;
}

// ─── Dividend & Split Events ────────────────────────────────────────────────

export interface DividendEvent {
  time: number;
  symbol: string;
  amount: number;
  exDate: number;
  payDate: number;
}

export interface SplitEvent {
  time: number;
  symbol: string;
  ratio: number;
}

export interface CorporateEvent {
  dividends: DividendEvent[];
  splits: SplitEvent[];
}

// ─── Backtest Config ────────────────────────────────────────────────────────

export interface BacktestConfig {
  symbols: string[];
  startDate: number;
  endDate: number;
  initialCapital: number;
  commission: CommissionConfig;
  slippage: SlippageConfig;
  marginRequirement: number;
  positionSizing: PositionSizing;
  positionSizeValue: number;
  maxPositions: number;
  maxPositionSize: number;
  riskFreeRate: number;
  benchmarkSymbol?: string;
  timeframe: Timeframe;
  warmupBars: number;
  allowShorting: boolean;
  allowFractional: boolean;
  reinvestDividends: boolean;
  seed?: number;
  dataGapFill: 'forward' | 'skip' | 'interpolate';
}

// ─── Strategy Interface ─────────────────────────────────────────────────────

export interface StrategyParam {
  name: string;
  type: 'number' | 'boolean' | 'string' | 'select';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: (string | number)[];
  description: string;
}

export interface StrategyContext {
  bars: Map<string, Bar[]>;
  currentBar: Map<string, Bar>;
  positions: Map<string, Position>;
  cash: number;
  equity: number;
  barIndex: number;
  timestamp: number;
  submit: (order: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'avgFillPrice' | 'commission' | 'slippage' | 'createdAt'>) => string;
  cancel: (orderId: string) => boolean;
  cancelAll: (symbol?: string) => void;
  getPosition: (symbol: string) => Position | undefined;
  getOrders: (symbol?: string) => Order[];
}

export interface Strategy {
  name: string;
  description: string;
  version: string;
  params: StrategyParam[];
  init(ctx: StrategyContext, paramValues: Record<string, number | boolean | string>): void;
  onBar(ctx: StrategyContext, bar: Bar, symbol: string): void;
  onTick?(ctx: StrategyContext, price: number, symbol: string): void;
  onOrderFill?(ctx: StrategyContext, order: Order): void;
  onPositionClose?(ctx: StrategyContext, trade: Trade): void;
  cleanup?(ctx: StrategyContext): void;
}

// ─── Equity / Drawdown ──────────────────────────────────────────────────────

export interface EquityPoint {
  time: number;
  equity: number;
  cash: number;
  positionValue: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface DrawdownPeriod {
  start: number;
  end: number;
  recovered: number | null;
  depth: number;
  depthPercent: number;
  duration: number;
  recoveryDuration: number | null;
}

// ─── Backtest Metrics ───────────────────────────────────────────────────────

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  cagr: number;
  volatility: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgDrawdown: number;
  longestDrawdownDays: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinPercent: number;
  avgLossPercent: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  payoffRatio: number;
  expectancy: number;
  expectancyPercent: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDuration: number;
  medianTradeDuration: number;
  timeInMarket: number;
  exposure: number;
  avgBarsInTrade: number;
  kellyPercent: number;
  ulcerIndex: number;
  tailRatio: number;
  commonSenseRatio: number;
  cpcIndex: number;
  beta: number;
  alpha: number;
  rSquared: number;
  skewness: number;
  kurtosis: number;
  var95: number;
  cvar95: number;
  totalCommission: number;
  totalSlippage: number;
  netProfit: number;
}

// ─── Monthly Returns ────────────────────────────────────────────────────────

export interface MonthlyReturn {
  year: number;
  month: number;
  return_: number;
  returnPercent: number;
  trades: number;
}

// ─── Backtest Result ────────────────────────────────────────────────────────

export interface BacktestResult {
  config: BacktestConfig;
  strategyName: string;
  paramValues: Record<string, number | boolean | string>;
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  drawdowns: DrawdownPeriod[];
  metrics: BacktestMetrics;
  monthlyReturns: MonthlyReturn[];
  dailyReturns: number[];
  benchmarkReturns?: number[];
  startTime: number;
  endTime: number;
  executionTimeMs: number;
}

// ─── Monte Carlo ────────────────────────────────────────────────────────────

export interface MonteCarloResult {
  simulations: number;
  equityPaths: number[][];
  finalEquities: number[];
  maxDrawdowns: number[];
  percentiles: {
    p5: { finalEquity: number; maxDrawdown: number };
    p25: { finalEquity: number; maxDrawdown: number };
    p50: { finalEquity: number; maxDrawdown: number };
    p75: { finalEquity: number; maxDrawdown: number };
    p95: { finalEquity: number; maxDrawdown: number };
  };
  ruinProbability: number;
  medianReturn: number;
  confidenceInterval95: [number, number];
}

// ─── Walk-Forward ───────────────────────────────────────────────────────────

export interface WalkForwardWindow {
  inSampleStart: number;
  inSampleEnd: number;
  outOfSampleStart: number;
  outOfSampleEnd: number;
  bestParams: Record<string, number | boolean | string>;
  inSampleMetrics: BacktestMetrics;
  outOfSampleMetrics: BacktestMetrics;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  combinedOutOfSample: BacktestMetrics;
  walkForwardEfficiency: number;
  isRobust: boolean;
  degradationRatio: number;
}

// ─── Optimization ───────────────────────────────────────────────────────────

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationObjective {
  metric: keyof BacktestMetrics;
  direction: 'maximize' | 'minimize';
  weight?: number;
}

export interface OptimizationResult {
  bestParams: Record<string, number | boolean | string>;
  bestMetrics: BacktestMetrics;
  allResults: {
    params: Record<string, number | boolean | string>;
    metrics: BacktestMetrics;
  }[];
  paretoFront?: {
    params: Record<string, number | boolean | string>;
    metrics: BacktestMetrics;
  }[];
  overfitScore: number;
  robustnessScore: number;
  executionTimeMs: number;
}

export interface SensitivityPoint {
  paramName: string;
  paramValue: number;
  metric: number;
}

export interface CSCVResult {
  probabilityOfOverfit: number;
  performanceDegradation: number;
  logitsDistribution: number[];
  isOverfit: boolean;
}

// ─── Engine Events ──────────────────────────────────────────────────────────

export type EngineEvent =
  | { type: 'bar'; bar: Bar; symbol: string }
  | { type: 'order_submitted'; order: Order }
  | { type: 'order_filled'; order: Order }
  | { type: 'order_cancelled'; order: Order }
  | { type: 'order_rejected'; order: Order; reason: string }
  | { type: 'position_opened'; position: Position }
  | { type: 'position_closed'; trade: Trade }
  | { type: 'dividend'; event: DividendEvent; position: Position }
  | { type: 'split'; event: SplitEvent; position: Position }
  | { type: 'margin_call'; position: Position; requiredMargin: number };

export type EventHandler = (event: EngineEvent) => void;

// ─── Default Config Factory ─────────────────────────────────────────────────

export function defaultBacktestConfig(
  overrides: Partial<BacktestConfig> & { symbols: string[] }
): BacktestConfig {
  return {
    startDate: 0,
    endDate: Date.now(),
    initialCapital: 100000,
    commission: { model: CommissionModel.PER_SHARE, perShare: 0.005, minPerTrade: 1 },
    slippage: { model: SlippageModel.FIXED, fixedAmount: 0.01 },
    marginRequirement: 1.0,
    positionSizing: PositionSizing.PERCENT_EQUITY,
    positionSizeValue: 0.02,
    maxPositions: 10,
    maxPositionSize: 0.25,
    riskFreeRate: 0.05,
    timeframe: Timeframe.D1,
    warmupBars: 50,
    allowShorting: true,
    allowFractional: false,
    reinvestDividends: true,
    dataGapFill: 'forward',
    ...overrides,
  };
}
