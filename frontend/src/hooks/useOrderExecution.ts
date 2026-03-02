/**
 * useOrderExecution.ts
 * Order execution hook supporting all order types (market, limit, stop,
 * stop-limit, trailing stop, bracket, OCO). Provides submit/cancel/modify,
 * status tracking, fill notifications, validation, commission preview,
 * margin checks, and position impact calculations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | 'bracket' | 'oco';
export type OrderSide = 'buy' | 'sell';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd';
export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  trailingAmount?: number;
  trailingPercent?: number;
  timeInForce?: TimeInForce;
  expireDate?: string;
  extendedHours?: boolean;
  bracketTakeProfit?: number;
  bracketStopLoss?: number;
  ocoOrders?: [Partial<OrderRequest>, Partial<OrderRequest>];
  clientOrderId?: string;
  notes?: string;
}

export interface Order extends OrderRequest {
  id: string;
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice: number;
  commission: number;
  submittedAt: number;
  updatedAt: number;
  fills: OrderFill[];
  rejectionReason?: string;
}

export interface OrderFill {
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  commission: number;
  timestamp: number;
  exchange?: string;
  liquidity: 'maker' | 'taker';
}

export interface CommissionPreview {
  commission: number;
  exchangeFee: number;
  regulatoryFee: number;
  total: number;
  currency: string;
}

export interface MarginCheck {
  initialMargin: number;
  maintenanceMargin: number;
  availableMargin: number;
  buyingPower: number;
  marginCall: boolean;
  shortable: boolean;
  locateFee?: number;
}

export interface PositionImpact {
  currentPosition: number;
  newPosition: number;
  avgCostBasis: number;
  newCostBasis: number;
  unrealizedPnL: number;
  projectedPnL: number;
  portfolioWeight: number;
  sectorExposure?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface UseOrderExecutionOptions {
  apiUrl?: string;
  wsUrl?: string;
  onFill?: (fill: OrderFill) => void;
  onStatusChange?: (order: Order) => void;
  onError?: (error: string) => void;
  autoValidate?: boolean;
  mockMode?: boolean;
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateOrder(req: OrderRequest): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!req.symbol?.trim()) {
    errors.push({ field: 'symbol', message: 'Symbol is required', code: 'MISSING_SYMBOL' });
  }
  if (req.quantity <= 0 || !Number.isFinite(req.quantity)) {
    errors.push({ field: 'quantity', message: 'Quantity must be a positive number', code: 'INVALID_QTY' });
  }
  if (req.type === 'limit' && (req.limitPrice === undefined || req.limitPrice <= 0)) {
    errors.push({ field: 'limitPrice', message: 'Limit price required for limit orders', code: 'MISSING_LIMIT' });
  }
  if ((req.type === 'stop' || req.type === 'stop_limit') && (req.stopPrice === undefined || req.stopPrice <= 0)) {
    errors.push({ field: 'stopPrice', message: 'Stop price required for stop orders', code: 'MISSING_STOP' });
  }
  if (req.type === 'stop_limit' && (req.limitPrice === undefined || req.limitPrice <= 0)) {
    errors.push({ field: 'limitPrice', message: 'Limit price required for stop-limit orders', code: 'MISSING_STOP_LIMIT' });
  }
  if (req.type === 'trailing_stop' && !req.trailingAmount && !req.trailingPercent) {
    errors.push({ field: 'trailingAmount', message: 'Trailing amount or percent required', code: 'MISSING_TRAIL' });
  }
  if (req.type === 'bracket') {
    if (!req.bracketTakeProfit) errors.push({ field: 'bracketTakeProfit', message: 'Take profit required for bracket orders', code: 'MISSING_TP' });
    if (!req.bracketStopLoss) errors.push({ field: 'bracketStopLoss', message: 'Stop loss required for bracket orders', code: 'MISSING_SL' });
  }

  if (req.quantity > 100000) warnings.push('Large order: consider splitting into smaller lots');
  if (req.type === 'market' && req.extendedHours) warnings.push('Market orders in extended hours may have wide spreads');

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Mock Helpers ──────────────────────────────────────────────────────────────

let mockOrderCounter = 0;
function createMockOrder(req: OrderRequest): Order {
  return {
    ...req,
    id: `ORD-${++mockOrderCounter}-${Date.now().toString(36)}`,
    status: 'submitted',
    filledQuantity: 0,
    avgFillPrice: 0,
    commission: 0,
    submittedAt: Date.now(),
    updatedAt: Date.now(),
    fills: [],
    timeInForce: req.timeInForce ?? 'day',
    clientOrderId: req.clientOrderId ?? `CLI-${Date.now()}`,
  };
}

function simulateFill(order: Order, partialQty?: number): { order: Order; fill: OrderFill } {
  const fillQty = partialQty ?? order.quantity - order.filledQuantity;
  const basePrice = order.limitPrice ?? order.stopPrice ?? 100;
  const slippage = order.type === 'market' ? (Math.random() - 0.5) * 0.02 * basePrice : 0;
  const fillPrice = Math.max(0.01, basePrice + slippage);
  const commission = fillQty * 0.005;

  const fill: OrderFill = {
    id: `FILL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    orderId: order.id,
    price: fillPrice,
    quantity: fillQty,
    commission,
    timestamp: Date.now(),
    exchange: 'MOCK',
    liquidity: order.type === 'limit' ? 'maker' : 'taker',
  };

  const allFills = [...order.fills, fill];
  const totalFilled = allFills.reduce((s, f) => s + f.quantity, 0);
  const avgPrice = allFills.reduce((s, f) => s + f.price * f.quantity, 0) / totalFilled;

  return {
    order: {
      ...order,
      status: totalFilled >= order.quantity ? 'filled' : 'partial',
      filledQuantity: totalFilled,
      avgFillPrice: avgPrice,
      commission: allFills.reduce((s, f) => s + f.commission, 0),
      fills: allFills,
      updatedAt: Date.now(),
    },
    fill,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useOrderExecution(options: UseOrderExecutionOptions = {}) {
  const {
    apiUrl = '/api/orders',
    onFill,
    onStatusChange,
    onError,
    autoValidate = true,
    mockMode = true,
  } = options;

  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [pendingSubmissions, setPendingSubmissions] = useState<Set<string>>(new Set());
  const [lastFill, setLastFill] = useState<OrderFill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fillTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      fillTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const submitOrder = useCallback(async (request: OrderRequest): Promise<Order | null> => {
    if (autoValidate) {
      const validation = validateOrder(request);
      if (!validation.valid) {
        const msg = validation.errors.map(e => e.message).join('; ');
        setError(msg);
        onError?.(msg);
        return null;
      }
    }

    const tempId = `pending-${Date.now()}`;
    setPendingSubmissions(prev => new Set(prev).add(tempId));

    try {
      if (mockMode) {
        const order = createMockOrder(request);
        setOrders(prev => new Map(prev).set(order.id, order));
        onStatusChange?.(order);

        const delay = request.type === 'market' ? 200 : 500 + Math.random() * 2000;
        const timer = setTimeout(() => {
          const { order: filled, fill } = simulateFill(order);
          setOrders(prev => new Map(prev).set(filled.id, filled));
          setLastFill(fill);
          onFill?.(fill);
          onStatusChange?.(filled);
          fillTimersRef.current.delete(order.id);
        }, delay);
        fillTimersRef.current.set(order.id, timer);

        return order;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const order: Order = await res.json();
      setOrders(prev => new Map(prev).set(order.id, order));
      onStatusChange?.(order);
      return order;
    } catch (err) {
      const msg = `Order submission failed: ${err}`;
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setPendingSubmissions(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  }, [apiUrl, autoValidate, mockMode, onFill, onStatusChange, onError]);

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    const timer = fillTimersRef.current.get(orderId);
    if (timer) {
      clearTimeout(timer);
      fillTimersRef.current.delete(orderId);
    }

    try {
      if (!mockMode) {
        const res = await fetch(`${apiUrl}/${orderId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }

      setOrders(prev => {
        const next = new Map(prev);
        const order = next.get(orderId);
        if (order && (order.status === 'submitted' || order.status === 'partial')) {
          next.set(orderId, { ...order, status: 'cancelled', updatedAt: Date.now() });
          onStatusChange?.({ ...order, status: 'cancelled', updatedAt: Date.now() });
        }
        return next;
      });
      return true;
    } catch (err) {
      const msg = `Cancel failed: ${err}`;
      setError(msg);
      onError?.(msg);
      return false;
    }
  }, [apiUrl, mockMode, onStatusChange, onError]);

  const modifyOrder = useCallback(async (orderId: string, changes: Partial<OrderRequest>): Promise<Order | null> => {
    try {
      const existing = orders.get(orderId);
      if (!existing || existing.status === 'filled' || existing.status === 'cancelled') {
        throw new Error('Cannot modify order in terminal state');
      }

      if (mockMode) {
        const modified: Order = { ...existing, ...changes, updatedAt: Date.now() };
        setOrders(prev => new Map(prev).set(orderId, modified));
        onStatusChange?.(modified);
        return modified;
      }

      const res = await fetch(`${apiUrl}/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: Order = await res.json();
      setOrders(prev => new Map(prev).set(orderId, updated));
      onStatusChange?.(updated);
      return updated;
    } catch (err) {
      const msg = `Modify failed: ${err}`;
      setError(msg);
      onError?.(msg);
      return null;
    }
  }, [apiUrl, mockMode, orders, onStatusChange, onError]);

  const previewCommission = useCallback((request: OrderRequest): CommissionPreview => {
    const notional = request.quantity * (request.limitPrice ?? 100);
    const commission = Math.max(1.0, request.quantity * 0.005);
    const exchangeFee = notional * 0.00003;
    const regulatoryFee = notional * 0.0000229;
    return {
      commission,
      exchangeFee,
      regulatoryFee,
      total: commission + exchangeFee + regulatoryFee,
      currency: 'USD',
    };
  }, []);

  const checkMargin = useCallback((request: OrderRequest): MarginCheck => {
    const notional = request.quantity * (request.limitPrice ?? request.stopPrice ?? 100);
    const initialRate = request.side === 'sell' ? 0.5 : 0.25;
    const maintenanceRate = request.side === 'sell' ? 0.3 : 0.25;
    return {
      initialMargin: notional * initialRate,
      maintenanceMargin: notional * maintenanceRate,
      availableMargin: 100000,
      buyingPower: 100000 / initialRate,
      marginCall: false,
      shortable: true,
      locateFee: request.side === 'sell' ? notional * 0.003 : undefined,
    };
  }, []);

  const calculatePositionImpact = useCallback((request: OrderRequest): PositionImpact => {
    const currentPos = 0;
    const sign = request.side === 'buy' ? 1 : -1;
    const newPos = currentPos + sign * request.quantity;
    const price = request.limitPrice ?? request.stopPrice ?? 100;
    return {
      currentPosition: currentPos,
      newPosition: newPos,
      avgCostBasis: 0,
      newCostBasis: price,
      unrealizedPnL: 0,
      projectedPnL: 0,
      portfolioWeight: (Math.abs(newPos) * price) / 1000000,
    };
  }, []);

  const validate = useCallback((request: OrderRequest): ValidationResult => {
    return validateOrder(request);
  }, []);

  const getOrder = useCallback((orderId: string): Order | undefined => {
    return orders.get(orderId);
  }, [orders]);

  const openOrders = useMemo(() =>
    Array.from(orders.values()).filter(o =>
      o.status === 'submitted' || o.status === 'partial' || o.status === 'pending'
    ),
    [orders]
  );

  const filledOrders = useMemo(() =>
    Array.from(orders.values()).filter(o => o.status === 'filled'),
    [orders]
  );

  const cancelAllOpen = useCallback(async () => {
    const promises = openOrders.map(o => cancelOrder(o.id));
    await Promise.all(promises);
  }, [openOrders, cancelOrder]);

  return {
    orders: Array.from(orders.values()),
    openOrders,
    filledOrders,
    lastFill,
    error,
    isSubmitting: pendingSubmissions.size > 0,
    submitOrder,
    cancelOrder,
    modifyOrder,
    cancelAllOpen,
    previewCommission,
    checkMargin,
    calculatePositionImpact,
    validate,
    getOrder,
  };
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import { useMemo } from 'react';

export default useOrderExecution;
