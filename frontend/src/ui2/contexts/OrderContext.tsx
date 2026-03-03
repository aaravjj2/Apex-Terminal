/**
 * OrderContext — React context for order management, position tracking,
 * and trade execution across all trading pages.
 */
import React, { createContext, useContext, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getOrderExecutionService } from '@/ui2/services/OrderExecutionService';
import type { Order, Fill, Position, OrderSide, OrderType, TimeInForce, RiskCheck, TCAResult, ExecutionConfig } from '@/ui2/services/OrderExecutionService';

// ── State ────────────────────────────────────────────────────────────────────

export interface OrderContextState {
  orders: Order[];
  openOrders: Order[];
  filledOrders: Order[];
  positions: Position[];
  fills: Fill[];
  dailyPnl: number;
  totalPnl: number;
  totalCommissions: number;
  orderCount: number;
  fillCount: number;
  lastOrderId: string | null;
  lastRiskChecks: RiskCheck[];
  config: ExecutionConfig;
}

export interface OrderContextActions {
  submitOrder: (params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: TimeInForce;
    tags?: string[];
  }) => { order: Order; riskChecks: RiskCheck[] };
  cancelOrder: (orderId: string) => boolean;
  cancelAll: (symbol?: string) => number;
  flattenPosition: (symbol: string, currentPrice: number) => Order | null;
  flattenAll: (currentPrices: Map<string, number>) => Order[];
  getOrder: (id: string) => Order | undefined;
  getPosition: (symbol: string) => Position | undefined;
  getFills: (orderId: string) => Fill[];
  analyzeTCA: (orderId: string, arrivalPrice: number) => TCAResult | null;
  updateConfig: (config: Partial<ExecutionConfig>) => void;
  resetOrders: () => void;
}

type Ctx = [OrderContextState, OrderContextActions];

const OrderCtx = createContext<Ctx | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function OrderProvider({ children }: { children: ReactNode }) {
  const service = useRef(getOrderExecutionService());
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision(r => r + 1), []);

  const [lastRiskChecks, setLastRiskChecks] = useState<RiskCheck[]>([]);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // Listen for order events
  useEffect(() => {
    const unsubs = [
      service.current.on('orderSubmitted', () => bump()),
      service.current.on('orderFilled', () => bump()),
      service.current.on('orderCancelled', () => bump()),
      service.current.on('orderRejected', () => bump()),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [bump]);

  const submitOrder = useCallback((params: Parameters<OrderContextActions['submitOrder']>[0]) => {
    const result = service.current.submitOrder(params);
    setLastOrderId(result.order.id);
    setLastRiskChecks(result.riskChecks);
    bump();
    return result;
  }, [bump]);

  const cancelOrder = useCallback((orderId: string) => {
    const result = service.current.cancelOrder(orderId);
    if (result) bump();
    return result;
  }, [bump]);

  const cancelAll = useCallback((symbol?: string) => {
    const count = service.current.cancelAll(symbol);
    if (count > 0) bump();
    return count;
  }, [bump]);

  const flattenPosition = useCallback((symbol: string, currentPrice: number) => {
    const order = service.current.flattenPosition(symbol, currentPrice);
    if (order) bump();
    return order;
  }, [bump]);

  const flattenAll = useCallback((currentPrices: Map<string, number>) => {
    const orders = service.current.flattenAll(currentPrices);
    if (orders.length > 0) bump();
    return orders;
  }, [bump]);

  const getOrder = useCallback((id: string) => service.current.getOrder(id), []);
  const getPosition = useCallback((symbol: string) => service.current.getPosition(symbol), []);
  const getFills = useCallback((orderId: string) => service.current.getFills(orderId), []);
  const analyzeTCA = useCallback((orderId: string, arrivalPrice: number) => service.current.analyzeTCA(orderId, arrivalPrice), []);

  const updateConfig = useCallback((config: Partial<ExecutionConfig>) => {
    service.current.updateConfig(config);
    bump();
  }, [bump]);

  const resetOrders = useCallback(() => {
    service.current.reset();
    setLastOrderId(null);
    setLastRiskChecks([]);
    bump();
  }, [bump]);

  // Derive state from service (updated on revision)
  const allOrders = service.current.getOrders();
  const positions = service.current.getPositions();
  const allFills = service.current.getAllFills();

  const state: OrderContextState = useMemo(() => ({
    orders: allOrders,
    openOrders: allOrders.filter(o => o.status === 'pending' || o.status === 'submitted' || o.status === 'partial'),
    filledOrders: allOrders.filter(o => o.status === 'filled'),
    positions,
    fills: allFills,
    dailyPnl: positions.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0),
    totalPnl: positions.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0),
    totalCommissions: allOrders.reduce((s, o) => s + o.commission, 0),
    orderCount: allOrders.length,
    fillCount: allFills.length,
    lastOrderId,
    lastRiskChecks,
    config: {
      maxOrderSize: 10000,
      maxPositionSize: 50000,
      maxDailyLoss: 25000,
      maxDrawdown: 0.1,
      requireConfirmation: false,
      enableRiskChecks: true,
      defaultTif: 'day' as TimeInForce,
      commissionRate: 0.1,
      slippageBps: 2,
    },
  }), [allOrders, positions, allFills, lastOrderId, lastRiskChecks, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions: OrderContextActions = useMemo(() => ({
    submitOrder, cancelOrder, cancelAll, flattenPosition, flattenAll,
    getOrder, getPosition, getFills, analyzeTCA, updateConfig, resetOrders,
  }), [submitOrder, cancelOrder, cancelAll, flattenPosition, flattenAll,
       getOrder, getPosition, getFills, analyzeTCA, updateConfig, resetOrders]);

  return React.createElement(OrderCtx.Provider, { value: [state, actions] as Ctx }, children);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOrderContext(): Ctx {
  const ctx = useContext(OrderCtx);
  if (!ctx) throw new Error('useOrderContext must be used within OrderProvider');
  return ctx;
}

export default OrderProvider;
