// ─── Order Type Enums ────────────────────────────────────────────────────────

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
  TRAILING_STOP = 'TRAILING_STOP',
  TRAILING_STOP_LIMIT = 'TRAILING_STOP_LIMIT',
  MOO = 'MARKET_ON_OPEN',
  MOC = 'MARKET_ON_CLOSE',
  LOO = 'LIMIT_ON_OPEN',
  LOC = 'LIMIT_ON_CLOSE',
  IOC = 'IMMEDIATE_OR_CANCEL',
  FOK = 'FILL_OR_KILL',
  GTC = 'GOOD_TILL_CANCELLED',
  GTD = 'GOOD_TILL_DATE',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
  BUY_TO_COVER = 'BUY_TO_COVER',
  SELL_SHORT = 'SELL_SHORT',
}

export enum OrderStatus {
  NEW = 'NEW',
  PENDING = 'PENDING_NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REPLACED = 'REPLACED',
}

export enum TimeInForce {
  DAY = 'DAY',
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
  GTD = 'GTD',
  OPG = 'OPG',
  CLS = 'CLS',
  MOO = 'MOO',
  MOC = 'MOC',
}

export enum AlgoType {
  TWAP = 'TWAP',
  VWAP = 'VWAP',
  IMPLEMENTATION_SHORTFALL = 'IS',
  POV = 'POV',
  ARRIVAL_PRICE = 'ARRIVAL_PRICE',
  CLOSE_PRICE = 'CLOSE_PRICE',
  ICEBERG = 'ICEBERG',
  PAIRS = 'PAIRS',
  BASKET = 'BASKET',
}

export enum Venue {
  NYSE = 'NYSE',
  NASDAQ = 'NASDAQ',
  ARCA = 'ARCA',
  BATS = 'BATS',
  IEX = 'IEX',
  EDGX = 'EDGX',
  DARK_POOL = 'DARK_POOL',
  INTERNAL = 'INTERNAL',
}

export enum RejectionReason {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  POSITION_LIMIT = 'POSITION_LIMIT',
  NOTIONAL_LIMIT = 'NOTIONAL_LIMIT',
  FAT_FINGER = 'FAT_FINGER',
  DAILY_LOSS_LIMIT = 'DAILY_LOSS_LIMIT',
  RATE_LIMIT = 'RATE_LIMIT',
  MARGIN_INSUFFICIENT = 'MARGIN_INSUFFICIENT',
  SHORT_SELL_RESTRICTED = 'SHORT_SELL_RESTRICTED',
  RESTRICTED_SECURITY = 'RESTRICTED_SECURITY',
  CREDIT_LIMIT = 'CREDIT_LIMIT',
  UPTICK_RULE = 'UPTICK_RULE',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
}

// ─── Core Interfaces ─────────────────────────────────────────────────────────

export interface Order {
  id: string;
  clientOrderId: string;
  parentOrderId?: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  trailingAmount?: number;
  trailingPercent?: number;
  avgFillPrice: number;
  lastFillPrice?: number;
  commission: number;
  venue?: Venue;
  algoParams?: AlgoOrderParams;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  filledAt?: number;
  cancelledAt?: number;
  rejectionReason?: RejectionReason;
  text?: string;
  tags: Record<string, string>;
}

export interface Fill {
  id: string;
  orderId: string;
  executionId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission: number;
  venue: Venue;
  liquidity: 'ADD' | 'REMOVE' | 'ROUTED';
  timestamp: number;
  counterpartyId?: string;
  settlementDate?: number;
}

export interface Execution {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  venue: Venue;
  timestamp: number;
  sequenceNumber: number;
  tradeId?: string;
  reportType: 'NEW' | 'FILL' | 'PARTIAL_FILL' | 'CANCEL' | 'REPLACE' | 'REJECT';
}

export interface ExecutionReport {
  execution: Execution;
  order: Order;
  fills: Fill[];
  cumulativeQuantity: number;
  averagePrice: number;
  leavesQuantity: number;
  commission: number;
  text?: string;
  timestamp: number;
}

// ─── Compound Order Types ────────────────────────────────────────────────────

export interface BracketOrder {
  id: string;
  entryOrder: Order;
  takeProfitOrder: Order;
  stopLossOrder: Order;
  trailingStop?: boolean;
  trailingStopPercent?: number;
  status: 'ACTIVE' | 'ENTRY_FILLED' | 'COMPLETED' | 'CANCELLED';
}

export interface OCOOrder {
  id: string;
  orders: [Order, Order];
  status: 'ACTIVE' | 'ONE_FILLED' | 'COMPLETED' | 'CANCELLED';
  filledOrderId?: string;
  cancelledOrderId?: string;
}

export interface OTOOrder {
  id: string;
  primaryOrder: Order;
  secondaryOrders: Order[];
  status: 'WAITING' | 'PRIMARY_FILLED' | 'ALL_ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

// ─── Order Book Types ────────────────────────────────────────────────────────

export interface OrderBookEntry {
  price: number;
  quantity: number;
  orderCount: number;
  orders: Array<{ orderId: string; quantity: number; timestamp: number }>;
}

export interface Level2Data {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
  sequenceNumber: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastTradePrice: number;
  lastTradeSize: number;
  totalBidVolume: number;
  totalAskVolume: number;
  spread: number;
  midPrice: number;
  vwMidPrice: number;
  imbalance: number;
  timestamp: number;
}

export interface OrderBookDelta {
  symbol: string;
  side: 'BID' | 'ASK';
  action: 'ADD' | 'MODIFY' | 'DELETE';
  price: number;
  quantity: number;
  sequenceNumber: number;
  timestamp: number;
}

// ─── Algo Order Parameters ───────────────────────────────────────────────────

export interface TWAPParams {
  algo: AlgoType.TWAP;
  startTime: number;
  endTime: number;
  sliceIntervalMs: number;
  randomizePct?: number;
  limitPrice?: number;
  participationCap?: number;
}

export interface VWAPParams {
  algo: AlgoType.VWAP;
  startTime: number;
  endTime: number;
  volumeProfile: number[];
  limitPrice?: number;
  maxParticipation?: number;
  minSliceSize?: number;
}

export interface ISParams {
  algo: AlgoType.IMPLEMENTATION_SHORTFALL;
  urgency: number;
  riskAversion: number;
  volatility: number;
  dailyVolume: number;
  temporaryImpact: number;
  permanentImpact: number;
  startTime: number;
  endTime: number;
}

export interface POVParams {
  algo: AlgoType.POV;
  targetRate: number;
  minRate?: number;
  maxRate?: number;
  startTime: number;
  endTime: number;
  limitPrice?: number;
}

export interface ArrivalPriceParams {
  algo: AlgoType.ARRIVAL_PRICE;
  arrivalPrice: number;
  urgency: number;
  riskAversion: number;
  volatility: number;
  startTime: number;
  endTime: number;
}

export interface ClosePriceParams {
  algo: AlgoType.CLOSE_PRICE;
  targetPct: number;
  mooVolumePct: number;
  startTime: number;
  closeTime: number;
}

export interface IcebergParams {
  algo: AlgoType.ICEBERG;
  displayQuantity: number;
  variance?: number;
  refreshTrigger?: number;
  limitPrice: number;
}

export interface PairsParams {
  algo: AlgoType.PAIRS;
  legA: { symbol: string; ratio: number; side: OrderSide };
  legB: { symbol: string; ratio: number; side: OrderSide };
  spreadTarget: number;
  spreadTolerance: number;
  maxLegging: number;
}

export interface BasketParams {
  algo: AlgoType.BASKET;
  legs: Array<{ symbol: string; quantity: number; side: OrderSide; weight: number }>;
  cashTarget?: number;
  trackingError?: number;
  maxParticipation?: number;
}

export type AlgoOrderParams =
  | TWAPParams
  | VWAPParams
  | ISParams
  | POVParams
  | ArrivalPriceParams
  | ClosePriceParams
  | IcebergParams
  | PairsParams
  | BasketParams;

// ─── Algo Schedule & Risk Outputs ────────────────────────────────────────────

export interface AlgoSlice {
  scheduledTime: number;
  targetQuantity: number;
  executedQuantity: number;
  avgPrice: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'SKIPPED';
}

export interface AlgoSchedule {
  algoType: AlgoType;
  totalQuantity: number;
  slices: AlgoSlice[];
  estimatedDuration: number;
  estimatedCompletionTime: number;
}

export interface AlgoCostEstimate {
  spreadCost: number;
  impactCost: number;
  timingRisk: number;
  commissions: number;
  totalExpectedCost: number;
  costBps: number;
}

export interface AlgoRiskMetrics {
  expectedShortfall: number;
  trackingError: number;
  participationRate: number;
  completionRisk: number;
  informationLeakage: number;
}

// ─── Smart Router Types ──────────────────────────────────────────────────────

export interface VenueStats {
  venue: Venue;
  avgFillRate: number;
  avgSpread: number;
  avgLatencyMs: number;
  priceImprovement: number;
  rebatePerShare: number;
  feePerShare: number;
  toxicityScore: number;
  revertRate: number;
  fillQuality: number;
  lastUpdated: number;
}

export interface RoutingDecision {
  venue: Venue;
  quantity: number;
  expectedCost: number;
  expectedFillRate: number;
  reason: string;
}

// ─── Risk Check Types ────────────────────────────────────────────────────────

export interface RiskCheckResult {
  passed: boolean;
  checkName: string;
  details: string;
  currentValue?: number;
  limit?: number;
  severity: 'INFO' | 'WARNING' | 'HARD_REJECT';
}

export interface RiskLimits {
  maxPositionSize: number;
  maxNotionalValue: number;
  maxConcentrationPct: number;
  maxPriceDeviationPct: number;
  dailyLossLimit: number;
  orderRateLimit: number;
  orderRateWindowMs: number;
  marginRequirementPct: number;
  maxCreditExposure: number;
}
