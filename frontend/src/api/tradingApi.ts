/**
 * tradingApi.ts
 * Trading / Order management API client.
 * Covers order submission, modification, cancellation, fills, positions,
 * account info, TCA, and broker connectivity with optimistic update support.
 */

import { apiClient, createWebSocket } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type OrderTimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';
export type OrderStatus =
  | 'new'
  | 'pending'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'replaced';

export type PositionSide = 'long' | 'short';

export interface SubmitOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  trailPercent?: number;
  trailAmount?: number;
  timeInForce?: OrderTimeInForce;
  extendedHours?: boolean;
  clientOrderId?: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  ocoGroupId?: string;
  notes?: string;
}

export interface ModifyOrderParams {
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
  trailPercent?: number;
  timeInForce?: OrderTimeInForce;
}

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce: OrderTimeInForce;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  limitPrice: number | null;
  stopPrice: number | null;
  trailPercent: number | null;
  avgFillPrice: number | null;
  status: OrderStatus;
  extendedHours: boolean;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  ocoGroupId: string | null;
  commission: number;
  fees: number;
  createdAt: string;
  updatedAt: string;
  filledAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  rejectionReason: string | null;
  legs?: OrderLeg[];
}

export interface OrderLeg {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  filledQuantity: number;
  avgFillPrice: number | null;
  status: OrderStatus;
}

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  side?: OrderSide;
  symbol?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission: number;
  fees: number;
  exchange: string;
  liquidityType: 'maker' | 'taker' | 'unknown';
  timestamp: string;
}

export interface FillFilters {
  symbol?: string;
  orderId?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface Position {
  symbol: string;
  side: PositionSide;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  todayPnl: number;
  todayPnlPct: number;
  exchange: string;
  assetClass: string;
  openedAt: string;
  lastUpdated: string;
}

export interface ClosePositionParams {
  symbol: string;
  quantity?: number;
  type?: 'market' | 'limit';
  limitPrice?: number;
}

export interface AccountInfo {
  accountId: string;
  status: 'active' | 'restricted' | 'disabled';
  currency: string;
  cash: number;
  portfolioValue: number;
  equity: number;
  buyingPower: number;
  longMarketValue: number;
  shortMarketValue: number;
  initialMargin: number;
  maintenanceMargin: number;
  excessMargin: number;
  dayTradeCount: number;
  dayTradeBuyingPower: number;
  patternDayTrader: boolean;
  marginMultiplier: number;
  pendingTransfers: number;
  lastUpdated: string;
}

export interface TCAReport {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  avgFillPrice: number;
  arrivalPrice: number;
  vwapBenchmark: number;
  twapBenchmark: number;
  implementationShortfall: number;
  slippageBps: number;
  marketImpactBps: number;
  timingCostBps: number;
  totalCostBps: number;
  participationRate: number;
  fillRate: number;
  executionDuration: number;
  numFills: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface BrokerStatus {
  connected: boolean;
  broker: string;
  accountType: 'live' | 'paper';
  latencyMs: number;
  lastHeartbeat: string;
  capabilities: string[];
  restrictions: string[];
  marketHours: {
    isOpen: boolean;
    nextOpen: string;
    nextClose: string;
    timezone: string;
  };
}

export type OrderEventType =
  | 'order_new'
  | 'order_fill'
  | 'order_partial_fill'
  | 'order_cancelled'
  | 'order_rejected'
  | 'order_replaced'
  | 'order_expired'
  | 'position_update'
  | 'account_update';

export interface OrderEvent {
  type: OrderEventType;
  data: Order | Position | AccountInfo;
  timestamp: string;
}

export interface OrderSubscription {
  unsubscribe: () => void;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── Optimistic update helpers ────────────────────────────────────────────────

type OptimisticCallback<T> = (data: T) => void;

const orderListeners = new Set<OptimisticCallback<Order>>();
const positionListeners = new Set<OptimisticCallback<Position[]>>();

export function onOrderUpdate(cb: OptimisticCallback<Order>): () => void {
  orderListeners.add(cb);
  return () => orderListeners.delete(cb);
}

export function onPositionUpdate(cb: OptimisticCallback<Position[]>): () => void {
  positionListeners.add(cb);
  return () => positionListeners.delete(cb);
}

function notifyOrderUpdate(order: Order): void {
  for (const cb of orderListeners) cb(order);
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/trading';

export async function submitOrder(params: SubmitOrderParams): Promise<Order> {
  const order = await apiClient.post<Order>(`${BASE}/orders`, params, {
    deduplicate: false,
  } as never);
  notifyOrderUpdate(order);
  return order;
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const order = await apiClient.delete<Order>(`${BASE}/orders/${orderId}`);
  notifyOrderUpdate(order);
  apiClient.invalidateCache(`${BASE}/orders`);
  return order;
}

export async function modifyOrder(
  orderId: string,
  params: ModifyOrderParams,
): Promise<Order> {
  const order = await apiClient.patch<Order>(
    `${BASE}/orders/${orderId}`,
    params,
  );
  notifyOrderUpdate(order);
  apiClient.invalidateCache(`${BASE}/orders`);
  return order;
}

export async function getOrders(filters?: OrderFilters): Promise<{
  orders: Order[];
  total: number;
}> {
  const q = filters
    ? qs({
        status: Array.isArray(filters.status) ? filters.status : filters.status,
        side: filters.side,
        symbol: filters.symbol,
        since: filters.since,
        until: filters.until,
        limit: filters.limit,
        offset: filters.offset,
      })
    : '';
  return apiClient.get(`${BASE}/orders${q}`);
}

export async function getOrder(orderId: string): Promise<Order> {
  return apiClient.get<Order>(`${BASE}/orders/${orderId}`);
}

export async function getFills(filters?: FillFilters): Promise<{
  fills: Fill[];
  total: number;
}> {
  const q = filters
    ? qs({
        symbol: filters.symbol,
        order_id: filters.orderId,
        since: filters.since,
        until: filters.until,
        limit: filters.limit,
        offset: filters.offset,
      })
    : '';
  return apiClient.get(`${BASE}/fills${q}`);
}

export async function getPositions(): Promise<Position[]> {
  return apiClient.get<Position[]>(`${BASE}/positions`);
}

export async function getPosition(symbol: string): Promise<Position> {
  return apiClient.get<Position>(
    `${BASE}/positions/${encodeURIComponent(symbol)}`,
  );
}

export async function closePosition(
  params: ClosePositionParams,
): Promise<Order> {
  const order = await apiClient.post<Order>(
    `${BASE}/positions/${encodeURIComponent(params.symbol)}/close`,
    {
      quantity: params.quantity,
      type: params.type ?? 'market',
      limit_price: params.limitPrice,
    },
  );
  notifyOrderUpdate(order);
  apiClient.invalidateCache(`${BASE}/positions`);
  return order;
}

export async function closeAllPositions(): Promise<{
  orders: Order[];
  closedCount: number;
}> {
  const result = await apiClient.post<{ orders: Order[]; closedCount: number }>(
    `${BASE}/positions/close-all`,
    {},
  );
  apiClient.invalidateCache(`${BASE}/positions`);
  apiClient.invalidateCache(`${BASE}/orders`);
  return result;
}

export async function getAccountInfo(): Promise<AccountInfo> {
  return apiClient.get<AccountInfo>(`${BASE}/account`);
}

export async function getTCA(orderId: string): Promise<TCAReport> {
  return apiClient.get<TCAReport>(`${BASE}/tca/${orderId}`);
}

export async function getBrokerStatus(): Promise<BrokerStatus> {
  return apiClient.get<BrokerStatus>(`${BASE}/broker/status`, {
    timeoutMs: 5000,
  });
}

// ─── Bracket / OCO Orders ─────────────────────────────────────────────────────

export interface BracketOrderParams {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryType: 'market' | 'limit';
  limitPrice?: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  timeInForce?: OrderTimeInForce;
}

export async function submitBracketOrder(
  params: BracketOrderParams,
): Promise<{ entry: Order; takeProfit: Order; stopLoss: Order }> {
  return apiClient.post(`${BASE}/orders/bracket`, params, {
    deduplicate: false,
  } as never);
}

// ─── WebSocket subscription ───────────────────────────────────────────────────

export function subscribeOrderUpdates(
  callback: (event: OrderEvent) => void,
): OrderSubscription {
  const ws = createWebSocket('/ws/trading', {
    onMessage: (raw) => {
      const event = raw as OrderEvent;
      callback(event);
      if (event.type.startsWith('order_') && 'id' in event.data) {
        notifyOrderUpdate(event.data as Order);
      }
      if (event.type === 'position_update') {
        for (const cb of positionListeners) cb(event.data as unknown as Position[]);
      }
    },
    onOpen: () => {
      ws.send({ action: 'subscribe', channels: ['orders', 'positions', 'account'] });
    },
    reconnectMs: 1500,
    maxReconnects: 20,
  });

  return {
    unsubscribe: () => {
      ws.send({ action: 'unsubscribe', channels: ['orders', 'positions', 'account'] });
      ws.close();
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function orderStatusColor(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    new: '#3b82f6',
    pending: '#f59e0b',
    partially_filled: '#8b5cf6',
    filled: '#00d4aa',
    cancelled: '#6b7280',
    rejected: '#ef4444',
    expired: '#6b7280',
    replaced: '#f59e0b',
  };
  return map[status];
}

export function orderStatusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    new: 'New',
    pending: 'Pending',
    partially_filled: 'Partial Fill',
    filled: 'Filled',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    expired: 'Expired',
    replaced: 'Replaced',
  };
  return map[status];
}

export function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pnlColor(value: number): string {
  if (value > 0) return '#00d4aa';
  if (value < 0) return '#ff4444';
  return '#888888';
}

export function isOrderActive(status: OrderStatus): boolean {
  return ['new', 'pending', 'partially_filled'].includes(status);
}

export function isOrderTerminal(status: OrderStatus): boolean {
  return ['filled', 'cancelled', 'rejected', 'expired'].includes(status);
}
