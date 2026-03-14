/**
 * OMS Order Types - Comprehensive order management definitions.
 * Order types, execution algos, lifecycle states, validation, builder, serialization.
 */

// ─── Order Type Enums ────────────────────────────────────────────────────────

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
  TRAILING_STOP = 'TRAILING_STOP',
  TRAILING_STOP_LIMIT = 'TRAILING_STOP_LIMIT',
  IOC = 'IMMEDIATE_OR_CANCEL',
  FOK = 'FILL_OR_KILL',
  GTC = 'GOOD_TILL_CANCELLED',
  GTD = 'GOOD_TILL_DATE',
  MOO = 'MARKET_ON_OPEN',
  MOC = 'MARKET_ON_CLOSE',
  LOO = 'LIMIT_ON_OPEN',
  LOC = 'LIMIT_ON_CLOSE',
  PEG = 'PEGGED',
  PEG_MIDPOINT = 'PEG_MIDPOINT',
  ICEBERG = 'ICEBERG',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
  BUY_TO_COVER = 'BUY_TO_COVER',
  SELL_SHORT = 'SELL_SHORT',
}

export enum OrderLifecycleState {
  PENDING = 'PENDING',
  STAGED = 'STAGED',
  SUBMITTED = 'SUBMITTED',
  PARTIAL_FILL = 'PARTIAL_FILL',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  AMENDED = 'AMENDED',
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

// ─── Execution Algorithm Types ───────────────────────────────────────────────

export enum ExecutionAlgoType {
  TWAP = 'TWAP',
  VWAP = 'VWAP',
  IMPLEMENTATION_SHORTFALL = 'IMPLEMENTATION_SHORTFALL',
  POV = 'POV',
  ARRIVAL_PRICE = 'ARRIVAL_PRICE',
  CLOSE_PRICE = 'CLOSE_PRICE',
  DARK_POOL = 'DARK_POOL',
  SOR = 'SOR',
  ICEBERG = 'ICEBERG',
}

// ─── Algo Parameter Interfaces ───────────────────────────────────────────────

export interface TWAPAlgoParams {
  algo: ExecutionAlgoType.TWAP;
  startTime: number;
  endTime: number;
  sliceIntervalMs: number;
  randomizePct?: number;
  limitPrice?: number;
  participationCap?: number;
}

export interface VWAPAlgoParams {
  algo: ExecutionAlgoType.VWAP;
  startTime: number;
  endTime: number;
  volumeProfile: number[];
  limitPrice?: number;
  maxParticipation?: number;
  minSliceSize?: number;
}

export interface ImplementationShortfallParams {
  algo: ExecutionAlgoType.IMPLEMENTATION_SHORTFALL;
  urgency: number;
  riskAversion: number;
  volatility: number;
  dailyVolume: number;
  temporaryImpact: number;
  permanentImpact: number;
  startTime: number;
  endTime: number;
}

export interface POVAlgoParams {
  algo: ExecutionAlgoType.POV;
  targetRate: number;
  minRate?: number;
  maxRate?: number;
  startTime: number;
  endTime: number;
  limitPrice?: number;
}

export interface ArrivalPriceParams {
  algo: ExecutionAlgoType.ARRIVAL_PRICE;
  arrivalPrice: number;
  urgency: number;
  riskAversion: number;
  volatility: number;
  startTime: number;
  endTime: number;
}

export interface ClosePriceParams {
  algo: ExecutionAlgoType.CLOSE_PRICE;
  targetPct: number;
  mooVolumePct: number;
  startTime: number;
  closeTime: number;
}

export interface DarkPoolParams {
  algo: ExecutionAlgoType.DARK_POOL;
  maxParticipationPct?: number;
  minPriceImprovement?: number;
  preferDark?: boolean;
}

export interface SORParams {
  algo: ExecutionAlgoType.SOR;
  venues: string[];
  splitStrategy: 'PROPORTIONAL' | 'PRIORITY' | 'MIN_COST';
  minSliceSize?: number;
}

export interface IcebergAlgoParams {
  algo: ExecutionAlgoType.ICEBERG;
  displayQuantity: number;
  variance?: number;
  refreshTrigger?: number;
  limitPrice: number;
}

export type AlgoParams =
  | TWAPAlgoParams
  | VWAPAlgoParams
  | ImplementationShortfallParams
  | POVAlgoParams
  | ArrivalPriceParams
  | ClosePriceParams
  | DarkPoolParams
  | SORParams
  | IcebergAlgoParams;

// ─── Order Base Interface ────────────────────────────────────────────────────

export interface BaseOrderSpec {
  symbol: string;
  side: OrderSide;
  quantity: number;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
  accountId?: string;
  extendedHours?: boolean;
  algoParams?: AlgoParams;
  tags?: Record<string, string>;
}

// ─── Individual Order Type Definitions ───────────────────────────────────────

export interface MarketOrderSpec extends BaseOrderSpec {
  type: OrderType.MARKET;
}

export interface LimitOrderSpec extends BaseOrderSpec {
  type: OrderType.LIMIT;
  limitPrice: number;
}

export interface StopOrderSpec extends BaseOrderSpec {
  type: OrderType.STOP;
  stopPrice: number;
}

export interface StopLimitOrderSpec extends BaseOrderSpec {
  type: OrderType.STOP_LIMIT;
  stopPrice: number;
  limitPrice: number;
}

export interface TrailingStopOrderSpec extends BaseOrderSpec {
  type: OrderType.TRAILING_STOP;
  trailingAmount?: number;
  trailingPercent?: number;
}

export interface TrailingStopLimitOrderSpec extends BaseOrderSpec {
  type: OrderType.TRAILING_STOP_LIMIT;
  trailingAmount?: number;
  trailingPercent?: number;
  limitPriceOffset?: number;
}

export interface IocOrderSpec extends BaseOrderSpec {
  type: OrderType.IOC;
  limitPrice?: number;
}

export interface FokOrderSpec extends BaseOrderSpec {
  type: OrderType.FOK;
  limitPrice: number;
}

export interface GtcOrderSpec extends BaseOrderSpec {
  type: OrderType.GTC;
  limitPrice?: number;
  stopPrice?: number;
}

export interface GtdOrderSpec extends BaseOrderSpec {
  type: OrderType.GTD;
  expiresAt: number;
  limitPrice?: number;
  stopPrice?: number;
}

export interface MooOrderSpec extends BaseOrderSpec {
  type: OrderType.MOO;
  quantity: number;
}

export interface MocOrderSpec extends BaseOrderSpec {
  type: OrderType.MOC;
  quantity: number;
}

export interface LooOrderSpec extends BaseOrderSpec {
  type: OrderType.LOO;
  limitPrice: number;
  quantity: number;
}

export interface LocOrderSpec extends BaseOrderSpec {
  type: OrderType.LOC;
  limitPrice: number;
  quantity: number;
}

export interface BracketOrderSpec extends BaseOrderSpec {
  type: OrderType.LIMIT | OrderType.MARKET;
  limitPrice?: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  trailingStopPercent?: number;
}

export interface OCOOrderSpec {
  orders: [BaseOrderSpec, BaseOrderSpec];
  clientOrderId?: string;
}

export interface OTOOrderSpec {
  primaryOrder: BaseOrderSpec;
  secondaryOrders: BaseOrderSpec[];
  clientOrderId?: string;
}

export interface PegOrderSpec extends BaseOrderSpec {
  type: OrderType.PEG | OrderType.PEG_MIDPOINT;
  offsetAmount?: number;
  referencePrice?: 'BID' | 'ASK' | 'LAST' | 'MID';
}

export interface IcebergOrderSpec extends BaseOrderSpec {
  type: OrderType.ICEBERG;
  limitPrice: number;
  displayQuantity: number;
}

export type OrderSpec =
  | MarketOrderSpec
  | LimitOrderSpec
  | StopOrderSpec
  | StopLimitOrderSpec
  | TrailingStopOrderSpec
  | TrailingStopLimitOrderSpec
  | IocOrderSpec
  | FokOrderSpec
  | GtcOrderSpec
  | GtdOrderSpec
  | MooOrderSpec
  | MocOrderSpec
  | LooOrderSpec
  | LocOrderSpec
  | PegOrderSpec
  | IcebergOrderSpec;

// ─── Full Order (Runtime State) ──────────────────────────────────────────────

export interface Order {
  id: string;
  clientOrderId: string;
  parentOrderId?: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce;
  state: OrderLifecycleState;
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
  algoParams?: AlgoParams;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  expiresAt?: number;
  filledAt?: number;
  cancelledAt?: number;
  rejectionReason?: string;
  text?: string;
  tags: Record<string, string>;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  displayQuantity?: number; // For iceberg
}

// ─── Fill and Execution Types ─────────────────────────────────────────────────

export interface Fill {
  id: string;
  orderId: string;
  executionId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission: number;
  liquidity: 'ADD' | 'REMOVE' | 'ROUTED';
  timestamp: number;
  venue?: string;
  counterpartyId?: string;
}

export interface OrderAmendment {
  orderId: string;
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
  trailingAmount?: number;
  trailingPercent?: number;
  expiresAt?: number;
}

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Validation Logic ────────────────────────────────────────────────────────

const MIN_QUANTITY = 0.000001;
const MAX_QUANTITY = 1e12;
const MAX_PRICE = 1e15;
const MAX_NOTIONAL = 1e18;

export function validateOrderSpec(spec: OrderSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (spec.quantity < MIN_QUANTITY) {
    errors.push(`Quantity must be >= ${MIN_QUANTITY}`);
  }
  if (spec.quantity > MAX_QUANTITY) {
    errors.push(`Quantity exceeds maximum ${MAX_QUANTITY}`);
  }
  if (!spec.symbol || spec.symbol.trim().length === 0) {
    errors.push('Symbol is required');
  }

  switch (spec.type) {
    case OrderType.LIMIT:
    case OrderType.LOO:
    case OrderType.LOC:
    case OrderType.FOK:
    case OrderType.ICEBERG:
      if ('limitPrice' in spec && (spec.limitPrice <= 0 || spec.limitPrice > MAX_PRICE)) {
        errors.push('Invalid limit price');
      }
      if (spec.type === OrderType.ICEBERG && 'displayQuantity' in spec && spec.displayQuantity >= spec.quantity) {
        errors.push('Iceberg displayQuantity must be less than total quantity');
      }
      break;
    case OrderType.STOP:
    case OrderType.STOP_LIMIT:
      if ('stopPrice' in spec && (spec.stopPrice <= 0 || spec.stopPrice > MAX_PRICE)) {
        errors.push('Invalid stop price');
      }
      if (spec.type === OrderType.STOP_LIMIT && 'limitPrice' in spec) {
        if (spec.limitPrice <= 0 || spec.limitPrice > MAX_PRICE) {
          errors.push('Invalid limit price on stop-limit');
        }
      }
      break;
    case OrderType.TRAILING_STOP:
    case OrderType.TRAILING_STOP_LIMIT:
      const hasTrail =
        ('trailingAmount' in spec && spec.trailingAmount != null && spec.trailingAmount > 0) ||
        ('trailingPercent' in spec && spec.trailingPercent != null && spec.trailingPercent > 0);
      if (!hasTrail) {
        errors.push('Trailing orders require trailingAmount or trailingPercent');
      }
      if ('trailingPercent' in spec && spec.trailingPercent != null) {
        if (spec.trailingPercent <= 0 || spec.trailingPercent > 100) {
          errors.push('trailingPercent must be in (0, 100]');
        }
      }
      break;
    case OrderType.GTD:
      if ('expiresAt' in spec && spec.expiresAt <= Date.now()) {
        errors.push('GTD expiresAt must be in the future');
      }
      break;
  }

  if (spec.algoParams) {
    const ap = spec.algoParams;
    if (ap.algo === ExecutionAlgoType.TWAP && ap.startTime >= ap.endTime) {
      errors.push('TWAP: startTime must be before endTime');
    }
    if (ap.algo === ExecutionAlgoType.VWAP && ap.startTime >= ap.endTime) {
      errors.push('VWAP: startTime must be before endTime');
    }
    if (ap.algo === ExecutionAlgoType.POV && ap.targetRate <= 0) {
      errors.push('POV: targetRate must be positive');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateOrder(order: Partial<Order>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!order.id) errors.push('Order id required');
  if (!order.symbol) errors.push('Order symbol required');
  if (order.quantity == null || order.quantity < MIN_QUANTITY) {
    errors.push('Invalid quantity');
  }
  if (order.filledQuantity != null && order.filledQuantity > order.quantity!) {
    errors.push('filledQuantity cannot exceed quantity');
  }
  if (order.state === OrderLifecycleState.FILLED && order.filledQuantity !== order.quantity) {
    warnings.push('FILLED order should have filledQuantity === quantity');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Order Builder ───────────────────────────────────────────────────────────

let _orderIdCounter = 0;

export function generateOrderId(prefix = 'ORD'): string {
  _orderIdCounter += 1;
  return `${prefix}-${Date.now()}-${_orderIdCounter.toString(36)}`;
}

export function specToOrder(spec: OrderSpec, id?: string, accountId = 'default'): Order {
  const orderId = id ?? generateOrderId();
  const clientOrderId = 'clientOrderId' in spec ? spec.clientOrderId ?? orderId : orderId;
  const now = Date.now();

  const base: Order = {
    id: orderId,
    clientOrderId: clientOrderId as string,
    accountId: spec.accountId ?? accountId,
    symbol: spec.symbol,
    side: spec.side,
    type: spec.type,
    timeInForce: spec.timeInForce ?? TimeInForce.DAY,
    state: OrderLifecycleState.PENDING,
    quantity: spec.quantity,
    filledQuantity: 0,
    remainingQuantity: spec.quantity,
    avgFillPrice: 0,
    commission: 0,
    createdAt: now,
    updatedAt: now,
    tags: spec.tags ?? {},
  };

  if ('limitPrice' in spec && spec.limitPrice != null) {
    base.limitPrice = spec.limitPrice;
  }
  if ('stopPrice' in spec && spec.stopPrice != null) {
    base.stopPrice = spec.stopPrice;
  }
  if ('trailingAmount' in spec && spec.trailingAmount != null) {
    base.trailingAmount = spec.trailingAmount;
  }
  if ('trailingPercent' in spec && spec.trailingPercent != null) {
    base.trailingPercent = spec.trailingPercent;
  }
  if ('expiresAt' in spec && spec.expiresAt != null) {
    base.expiresAt = spec.expiresAt;
  }
  if ('displayQuantity' in spec && spec.displayQuantity != null) {
    base.displayQuantity = spec.displayQuantity;
  }
  if (spec.algoParams) {
    base.algoParams = spec.algoParams;
  }

  return base;
}

export function createMarketOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.MARKET,
    symbol,
    side,
    quantity,
    ...opts,
  });
}

export function createLimitOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  limitPrice: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.LIMIT,
    symbol,
    side,
    quantity,
    limitPrice,
    ...opts,
  });
}

export function createStopOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  stopPrice: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.STOP,
    symbol,
    side,
    quantity,
    stopPrice,
    ...opts,
  });
}

export function createStopLimitOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  stopPrice: number,
  limitPrice: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.STOP_LIMIT,
    symbol,
    side,
    quantity,
    stopPrice,
    limitPrice,
    ...opts,
  });
}

export function createTrailingStopOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  trailingAmount?: number,
  trailingPercent?: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.TRAILING_STOP,
    symbol,
    side,
    quantity,
    trailingAmount,
    trailingPercent,
    ...opts,
  } as TrailingStopOrderSpec);
}

export function createIcebergOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  limitPrice: number,
  displayQuantity: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'timeInForce' | 'accountId'>>
): Order {
  return specToOrder({
    type: OrderType.ICEBERG,
    symbol,
    side,
    quantity,
    limitPrice,
    displayQuantity,
    ...opts,
  } as IcebergOrderSpec);
}

export function createBracketOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  limitPrice: number,
  takeProfitPrice: number,
  stopLossPrice: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'accountId'>>
): { entry: Order; takeProfit: Order; stopLoss: Order } {
  const parentId = generateOrderId('BRK');
  const entry = specToOrder({
    type: OrderType.LIMIT,
    symbol,
    side,
    quantity,
    limitPrice,
    clientOrderId: opts?.clientOrderId,
  });
  entry.id = parentId;
  entry.parentOrderId = parentId;

  const takeProfit = specToOrder({
    type: OrderType.LIMIT,
    symbol,
    side: side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
    quantity,
    limitPrice: takeProfitPrice,
  });
  takeProfit.parentOrderId = parentId;

  const stopLoss = specToOrder({
    type: OrderType.STOP,
    symbol,
    side: side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
    quantity,
    stopPrice: stopLossPrice,
  });
  stopLoss.parentOrderId = parentId;

  return { entry, takeProfit, stopLoss };
}

// ─── Serialization ────────────────────────────────────────────────────────────

export function orderToJson(order: Order): string {
  return JSON.stringify(orderToPlain(order));
}

export function orderFromJson(json: string): Order {
  return plainToOrder(JSON.parse(json));
}

export function orderToPlain(o: Order): Record<string, unknown> {
  return {
    id: o.id,
    clientOrderId: o.clientOrderId,
    parentOrderId: o.parentOrderId,
    accountId: o.accountId,
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    timeInForce: o.timeInForce,
    state: o.state,
    quantity: o.quantity,
    filledQuantity: o.filledQuantity,
    remainingQuantity: o.remainingQuantity,
    price: o.price,
    stopPrice: o.stopPrice,
    limitPrice: o.limitPrice,
    trailingAmount: o.trailingAmount,
    trailingPercent: o.trailingPercent,
    avgFillPrice: o.avgFillPrice,
    lastFillPrice: o.lastFillPrice,
    commission: o.commission,
    algoParams: o.algoParams ? JSON.parse(JSON.stringify(o.algoParams)) : undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    submittedAt: o.submittedAt,
    expiresAt: o.expiresAt,
    filledAt: o.filledAt,
    cancelledAt: o.cancelledAt,
    rejectionReason: o.rejectionReason,
    text: o.text,
    tags: { ...o.tags },
    takeProfitPrice: o.takeProfitPrice,
    stopLossPrice: o.stopLossPrice,
    displayQuantity: o.displayQuantity,
  };
}

export function plainToOrder(p: Record<string, unknown>): Order {
  return {
    id: p.id as string,
    clientOrderId: p.clientOrderId as string,
    parentOrderId: p.parentOrderId as string | undefined,
    accountId: p.accountId as string,
    symbol: p.symbol as string,
    side: p.side as OrderSide,
    type: p.type as OrderType,
    timeInForce: p.timeInForce as TimeInForce,
    state: p.state as OrderLifecycleState,
    quantity: (p.quantity as number) ?? 0,
    filledQuantity: (p.filledQuantity as number) ?? 0,
    remainingQuantity: (p.remainingQuantity as number) ?? (p.quantity as number) ?? 0,
    price: p.price as number | undefined,
    stopPrice: p.stopPrice as number | undefined,
    limitPrice: p.limitPrice as number | undefined,
    trailingAmount: p.trailingAmount as number | undefined,
    trailingPercent: p.trailingPercent as number | undefined,
    avgFillPrice: (p.avgFillPrice as number) ?? 0,
    lastFillPrice: p.lastFillPrice as number | undefined,
    commission: (p.commission as number) ?? 0,
    algoParams: p.algoParams as AlgoParams | undefined,
    createdAt: (p.createdAt as number) ?? Date.now(),
    updatedAt: (p.updatedAt as number) ?? Date.now(),
    submittedAt: p.submittedAt as number | undefined,
    expiresAt: p.expiresAt as number | undefined,
    filledAt: p.filledAt as number | undefined,
    cancelledAt: p.cancelledAt as number | undefined,
    rejectionReason: p.rejectionReason as string | undefined,
    text: p.text as string | undefined,
    tags: (p.tags as Record<string, string>) ?? {},
    takeProfitPrice: p.takeProfitPrice as number | undefined,
    stopLossPrice: p.stopLossPrice as number | undefined,
    displayQuantity: p.displayQuantity as number | undefined,
  };
}

// ─── Order State Helpers ──────────────────────────────────────────────────────

export function isOrderActive(order: Order): boolean {
  return [
    OrderLifecycleState.PENDING,
    OrderLifecycleState.STAGED,
    OrderLifecycleState.SUBMITTED,
    OrderLifecycleState.PARTIAL_FILL,
  ].includes(order.state);
}

export function isOrderTerminal(order: Order): boolean {
  return [
    OrderLifecycleState.FILLED,
    OrderLifecycleState.CANCELLED,
    OrderLifecycleState.REJECTED,
    OrderLifecycleState.EXPIRED,
  ].includes(order.state);
}

export function transitionOrderState(
  order: Order,
  newState: OrderLifecycleState,
  updates?: Partial<Pick<Order, 'filledQuantity' | 'remainingQuantity' | 'avgFillPrice' | 'lastFillPrice' | 'commission' | 'filledAt' | 'cancelledAt' | 'rejectionReason'>>
): Order {
  const updated: Order = { ...order, ...updates };
  updated.state = newState;
  updated.updatedAt = Date.now();

  if (updates?.filledQuantity != null) {
    updated.remainingQuantity = order.quantity - updates.filledQuantity;
  }
  if (newState === OrderLifecycleState.FILLED && updates?.filledQuantity == null) {
    updated.filledQuantity = order.quantity;
    updated.remainingQuantity = 0;
  }
  if (newState === OrderLifecycleState.CANCELLED) {
    updated.cancelledAt = Date.now();
  }

  return updated;
}

// ─── Execution Algo Stubs ──────────────────────────────────────────────────────

export interface AlgoScheduleSlice {
  scheduledTime: number;
  targetQuantity: number;
  executedQuantity: number;
  avgPrice: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
}

export interface AlgoSchedule {
  algoType: ExecutionAlgoType;
  totalQuantity: number;
  slices: AlgoScheduleSlice[];
  estimatedDurationMs: number;
  estimatedCompletionTime: number;
}

/**
 * TWAP: Time-Weighted Average Price.
 * Splits order into equal slices over time window.
 */
export function twapSchedule(params: TWAPAlgoParams, quantity: number): AlgoSchedule {
  const duration = params.endTime - params.startTime;
  const numSlices = Math.max(1, Math.floor(duration / params.sliceIntervalMs));
  const sliceQty = quantity / numSlices;

  const slices: AlgoScheduleSlice[] = [];
  for (let i = 0; i < numSlices; i++) {
    slices.push({
      scheduledTime: params.startTime + i * params.sliceIntervalMs,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });
  }

  return {
    algoType: ExecutionAlgoType.TWAP,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: duration,
    estimatedCompletionTime: params.endTime,
  };
}

/**
 * VWAP: Volume-Weighted Average Price.
 * Uses volume profile to size slices proportionally.
 */
export function vwapSchedule(params: VWAPAlgoParams, quantity: number): AlgoSchedule {
  const totalVol = params.volumeProfile.reduce((a, b) => a + b, 0);
  const duration = params.endTime - params.startTime;
  const n = params.volumeProfile.length;
  if (n === 0 || totalVol <= 0) {
    return twapSchedule(
      {
        algo: ExecutionAlgoType.TWAP,
        startTime: params.startTime,
        endTime: params.endTime,
        sliceIntervalMs: duration / 10,
      },
      quantity
    );
  }

  const slices: AlgoScheduleSlice[] = params.volumeProfile.map((vol, i) => ({
    scheduledTime: params.startTime + (i / n) * duration,
    targetQuantity: quantity * (vol / totalVol),
    executedQuantity: 0,
    avgPrice: 0,
    status: 'PENDING',
  }));

  return {
    algoType: ExecutionAlgoType.VWAP,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: duration,
    estimatedCompletionTime: params.endTime,
  };
}

/**
 * Implementation Shortfall stub.
 * Algo trades off market impact vs timing risk.
 */
export function implementationShortfallSchedule(
  params: ImplementationShortfallParams,
  quantity: number
): AlgoSchedule {
  const duration = params.endTime - params.startTime;
  const urgency = Math.max(0.01, Math.min(1, params.urgency));
  const numSlices = Math.max(1, Math.ceil(10 * (1 - urgency)));

  const slices: AlgoScheduleSlice[] = [];
  for (let i = 0; i < numSlices; i++) {
    const t0 = params.startTime + (i / numSlices) * duration;
    const t1 = params.startTime + ((i + 1) / numSlices) * duration;
    const sliceQty = quantity / numSlices;
    slices.push({
      scheduledTime: (t0 + t1) / 2,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });
  }

  return {
    algoType: ExecutionAlgoType.IMPLEMENTATION_SHORTFALL,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: duration,
    estimatedCompletionTime: params.endTime,
  };
}

/**
 * POV: Percent of Volume.
 * Participates at target % of market volume.
 */
export function povSchedule(params: POVAlgoParams, quantity: number): AlgoSchedule {
  const duration = params.endTime - params.startTime;
  const intervalMs = 60000; // 1 min buckets
  const numSlices = Math.max(1, Math.floor(duration / intervalMs));
  const sliceQty = quantity / numSlices;

  const slices: AlgoScheduleSlice[] = [];
  for (let i = 0; i < numSlices; i++) {
    slices.push({
      scheduledTime: params.startTime + i * intervalMs,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });
  }

  return {
    algoType: ExecutionAlgoType.POV,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: duration,
    estimatedCompletionTime: params.endTime,
  };
}

/**
 * Arrival Price stub.
 */
export function arrivalPriceSchedule(
  params: ArrivalPriceParams,
  quantity: number
): AlgoSchedule {
  return implementationShortfallSchedule(
    {
      algo: ExecutionAlgoType.IMPLEMENTATION_SHORTFALL,
      urgency: params.urgency,
      riskAversion: params.riskAversion,
      volatility: params.volatility,
      dailyVolume: quantity * 100,
      temporaryImpact: 0.1,
      permanentImpact: 0.05,
      startTime: params.startTime,
      endTime: params.endTime,
    },
    quantity
  );
}

/**
 * Close Price stub.
 */
export function closePriceSchedule(
  params: ClosePriceParams,
  quantity: number
): AlgoSchedule {
  const slices: AlgoScheduleSlice[] = [
    {
      scheduledTime: params.closeTime - 60000,
      targetQuantity: quantity * (1 - params.mooVolumePct),
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    },
    {
      scheduledTime: params.closeTime,
      targetQuantity: quantity * params.mooVolumePct,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    },
  ];

  return {
    algoType: ExecutionAlgoType.CLOSE_PRICE,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: params.closeTime - params.startTime,
    estimatedCompletionTime: params.closeTime,
  };
}

/**
 * Dark Pool stub.
 */
export function darkPoolSchedule(
  params: DarkPoolParams,
  quantity: number
): AlgoSchedule {
  return {
    algoType: ExecutionAlgoType.DARK_POOL,
    totalQuantity: quantity,
    slices: [
      {
        scheduledTime: Date.now(),
        targetQuantity: quantity,
        executedQuantity: 0,
        avgPrice: 0,
        status: 'PENDING',
      },
    ],
    estimatedDurationMs: 0,
    estimatedCompletionTime: Date.now(),
  };
}

/**
 * SOR: Smart Order Router stub.
 */
export function sorSchedule(params: SORParams, quantity: number): AlgoSchedule {
  const numVenues = params.venues?.length ?? 1;
  const perVenue = quantity / Math.max(1, numVenues);
  const now = Date.now();

  const slices: AlgoScheduleSlice[] = (params.venues ?? ['default']).map((_, i) => ({
    scheduledTime: now + i * 10,
    targetQuantity: perVenue,
    executedQuantity: 0,
    avgPrice: 0,
    status: 'PENDING',
  }));

  return {
    algoType: ExecutionAlgoType.SOR,
    totalQuantity: quantity,
    slices,
    estimatedDurationMs: 100,
    estimatedCompletionTime: now + 500,
  };
}

export function getAlgoSchedule(params: AlgoParams, quantity: number): AlgoSchedule {
  switch (params.algo) {
    case ExecutionAlgoType.TWAP:
      return twapSchedule(params, quantity);
    case ExecutionAlgoType.VWAP:
      return vwapSchedule(params, quantity);
    case ExecutionAlgoType.IMPLEMENTATION_SHORTFALL:
      return implementationShortfallSchedule(params, quantity);
    case ExecutionAlgoType.POV:
      return povSchedule(params, quantity);
    case ExecutionAlgoType.ARRIVAL_PRICE:
      return arrivalPriceSchedule(params, quantity);
    case ExecutionAlgoType.CLOSE_PRICE:
      return closePriceSchedule(params, quantity);
    case ExecutionAlgoType.DARK_POOL:
      return darkPoolSchedule(params, quantity);
    case ExecutionAlgoType.SOR:
      return sorSchedule(params, quantity);
    case ExecutionAlgoType.ICEBERG:
      return {
        algoType: ExecutionAlgoType.ICEBERG,
        totalQuantity: quantity,
        slices: [
          {
            scheduledTime: Date.now(),
            targetQuantity: params.displayQuantity ?? quantity,
            executedQuantity: 0,
            avgPrice: 0,
            status: 'PENDING',
          },
        ],
        estimatedDurationMs: 0,
        estimatedCompletionTime: Date.now(),
      };
    default:
      return twapSchedule(
        {
          algo: ExecutionAlgoType.TWAP,
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
          sliceIntervalMs: 60000,
        },
        quantity
      );
  }
}

// ─── OCO and OTO Builders ─────────────────────────────────────────────────────

export function createOCOOrders(
  symbol: string,
  side: OrderSide,
  quantity: number,
  limitPrice1: number,
  limitPrice2: number,
  opts?: Partial<Pick<BaseOrderSpec, 'clientOrderId' | 'accountId'>>
): { order1: Order; order2: Order } {
  const ocoId = opts?.clientOrderId ?? generateOrderId('OCO');
  const order1 = specToOrder({
    type: OrderType.LIMIT,
    symbol,
    side,
    quantity,
    limitPrice: limitPrice1,
    clientOrderId: `${ocoId}-A`,
    ...opts,
  });
  const order2 = specToOrder({
    type: OrderType.LIMIT,
    symbol,
    side,
    quantity,
    limitPrice: limitPrice2,
    clientOrderId: `${ocoId}-B`,
    ...opts,
  });
  order1.parentOrderId = ocoId;
  order2.parentOrderId = ocoId;
  return { order1, order2 };
}

export function createOTOOrders(
  primary: OrderSpec,
  secondaries: OrderSpec[],
  opts?: { clientOrderId?: string }
): { primary: Order; secondaries: Order[] } {
  const otoId = opts?.clientOrderId ?? generateOrderId('OTO');
  const primaryOrder = specToOrder({ ...primary, clientOrderId: `${otoId}-P` } as OrderSpec);
  primaryOrder.parentOrderId = otoId;
  const secondaryOrders = secondaries.map((s, i) => {
    const o = specToOrder({ ...s, clientOrderId: `${otoId}-S${i}` } as OrderSpec);
    o.parentOrderId = otoId;
    return o;
  });
  return { primary: primaryOrder, secondaries: secondaryOrders };
}

// ─── Extended Validation (Per-Type) ────────────────────────────────────────────

export function validateMarketOrder(spec: MarketOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  return base;
}

export function validateLimitOrder(spec: LimitOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (spec.limitPrice <= 0) base.errors.push('Limit price must be positive');
  return base;
}

export function validateStopOrder(spec: StopOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (spec.stopPrice <= 0) base.errors.push('Stop price must be positive');
  return base;
}

export function validateStopLimitOrder(spec: StopLimitOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (spec.stopPrice <= 0) base.errors.push('Stop price must be positive');
  if (spec.limitPrice <= 0) base.errors.push('Limit price must be positive');
  if (spec.side === OrderSide.BUY && spec.stopPrice > spec.limitPrice) {
    base.warnings.push('Buy stop-limit: stop above limit may never fill');
  }
  if (spec.side === OrderSide.SELL && spec.stopPrice < spec.limitPrice) {
    base.warnings.push('Sell stop-limit: stop below limit may never fill');
  }
  return base;
}

export function validateTrailingStopOrder(spec: TrailingStopOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (!spec.trailingAmount && !spec.trailingPercent) {
    base.errors.push('Trailing stop requires trailingAmount or trailingPercent');
  }
  if (spec.trailingPercent != null && (spec.trailingPercent <= 0 || spec.trailingPercent > 100)) {
    base.errors.push('trailingPercent must be in (0, 100]');
  }
  return base;
}

export function validateGtdOrder(spec: GtdOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (spec.expiresAt <= Date.now()) {
    base.errors.push('GTD expiresAt must be in the future');
  }
  return base;
}

export function validateIcebergOrder(spec: IcebergOrderSpec): ValidationResult {
  const base = validateOrderSpec(spec);
  if (!base.valid) return base;
  if (spec.displayQuantity >= spec.quantity) {
    base.errors.push('displayQuantity must be less than total quantity');
  }
  if (spec.displayQuantity <= 0) {
    base.errors.push('displayQuantity must be positive');
  }
  return base;
}

export function validateOrderSpecByType(spec: OrderSpec): ValidationResult {
  switch (spec.type) {
    case OrderType.MARKET:
      return validateMarketOrder(spec as MarketOrderSpec);
    case OrderType.LIMIT:
      return validateLimitOrder(spec as LimitOrderSpec);
    case OrderType.STOP:
      return validateStopOrder(spec as StopOrderSpec);
    case OrderType.STOP_LIMIT:
      return validateStopLimitOrder(spec as StopLimitOrderSpec);
    case OrderType.TRAILING_STOP:
      return validateTrailingStopOrder(spec as TrailingStopOrderSpec);
    case OrderType.GTD:
      return validateGtdOrder(spec as GtdOrderSpec);
    case OrderType.ICEBERG:
      return validateIcebergOrder(spec as IcebergOrderSpec);
    default:
      return validateOrderSpec(spec);
  }
}

// ─── Order State Machine ───────────────────────────────────────────────────────

export type OrderStateTransition =
  | { from: OrderLifecycleState.PENDING; to: OrderLifecycleState.STAGED }
  | { from: OrderLifecycleState.PENDING; to: OrderLifecycleState.SUBMITTED }
  | { from: OrderLifecycleState.PENDING; to: OrderLifecycleState.REJECTED }
  | { from: OrderLifecycleState.STAGED; to: OrderLifecycleState.SUBMITTED }
  | { from: OrderLifecycleState.STAGED; to: OrderLifecycleState.CANCELLED }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.PARTIAL_FILL }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.FILLED }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.CANCELLED }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.REJECTED }
  | { from: OrderLifecycleState.PARTIAL_FILL; to: OrderLifecycleState.FILLED }
  | { from: OrderLifecycleState.PARTIAL_FILL; to: OrderLifecycleState.CANCELLED }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.AMENDED }
  | { from: OrderLifecycleState.SUBMITTED; to: OrderLifecycleState.EXPIRED };

const VALID_TRANSITIONS: Partial<Record<OrderLifecycleState, OrderLifecycleState[]>> = {
  [OrderLifecycleState.PENDING]: [OrderLifecycleState.STAGED, OrderLifecycleState.SUBMITTED, OrderLifecycleState.REJECTED],
  [OrderLifecycleState.STAGED]: [OrderLifecycleState.SUBMITTED, OrderLifecycleState.CANCELLED],
  [OrderLifecycleState.SUBMITTED]: [
    OrderLifecycleState.PARTIAL_FILL,
    OrderLifecycleState.FILLED,
    OrderLifecycleState.CANCELLED,
    OrderLifecycleState.REJECTED,
    OrderLifecycleState.AMENDED,
    OrderLifecycleState.EXPIRED,
  ],
  [OrderLifecycleState.PARTIAL_FILL]: [OrderLifecycleState.FILLED, OrderLifecycleState.CANCELLED],
};

export function canTransitionOrder(from: OrderLifecycleState, to: OrderLifecycleState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertValidTransition(from: OrderLifecycleState, to: OrderLifecycleState): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order state transition: ${from} -> ${to}`);
  }
}

// ─── Order Amendment Helpers ───────────────────────────────────────────────────

export function applyAmendment(order: Order, amendment: OrderAmendment): Order {
  const updated = { ...order };
  if (amendment.quantity != null) {
    if (order.filledQuantity > amendment.quantity) {
      throw new Error('Cannot reduce quantity below filled amount');
    }
    updated.quantity = amendment.quantity;
    updated.remainingQuantity = amendment.quantity - order.filledQuantity;
  }
  if (amendment.limitPrice != null) updated.limitPrice = amendment.limitPrice;
  if (amendment.stopPrice != null) updated.stopPrice = amendment.stopPrice;
  if (amendment.trailingAmount != null) updated.trailingAmount = amendment.trailingAmount;
  if (amendment.trailingPercent != null) updated.trailingPercent = amendment.trailingPercent;
  if (amendment.expiresAt != null) updated.expiresAt = amendment.expiresAt;
  updated.updatedAt = Date.now();
  updated.state = OrderLifecycleState.AMENDED;
  return updated;
}

// ─── Batch Serialization ───────────────────────────────────────────────────────

export function ordersToJson(orders: Order[]): string {
  return JSON.stringify(orders.map(orderToPlain));
}

export function ordersFromJson(json: string): Order[] {
  const arr = JSON.parse(json) as Record<string, unknown>[];
  return arr.map(plainToOrder);
}

// ─── Order Comparison and Equality ─────────────────────────────────────────────

export function ordersEqual(a: Order, b: Order): boolean {
  return (
    a.id === b.id &&
    a.symbol === b.symbol &&
    a.side === b.side &&
    a.type === b.type &&
    a.quantity === b.quantity &&
    a.filledQuantity === b.filledQuantity &&
    a.state === b.state
  );
}

export function orderSpecEquals(a: OrderSpec, b: OrderSpec): boolean {
  if (a.type !== b.type || a.symbol !== b.symbol || a.side !== b.side || a.quantity !== b.quantity) {
    return false;
  }
  if ('limitPrice' in a && 'limitPrice' in b && a.limitPrice !== b.limitPrice) return false;
  if ('stopPrice' in a && 'stopPrice' in b && a.stopPrice !== b.stopPrice) return false;
  return true;
}

// ─── Export index ──────────────────────────────────────────────────────────────

export const ORDER_TYPES = {
  OrderType,
  OrderSide,
  OrderLifecycleState,
  TimeInForce,
  ExecutionAlgoType,
  validateOrderSpec,
  validateOrder,
  validateOrderSpecByType,
  specToOrder,
  orderToJson,
  orderFromJson,
  orderToPlain,
  plainToOrder,
  ordersToJson,
  ordersFromJson,
  createMarketOrder,
  createLimitOrder,
  createStopOrder,
  createStopLimitOrder,
  createTrailingStopOrder,
  createIcebergOrder,
  createBracketOrder,
  createOCOOrders,
  createOTOOrders,
  getAlgoSchedule,
  isOrderActive,
  isOrderTerminal,
  transitionOrderState,
  applyAmendment,
  canTransitionOrder,
  assertValidTransition,
  ordersEqual,
  orderSpecEquals,
  generateOrderId,
};
