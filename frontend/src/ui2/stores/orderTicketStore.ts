/**
 * v1.57 — Order Ticket Store
 * Deterministic in-memory order management for DEMO mode
 */

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderTIF = 'day' | 'gtc' | 'ioc' | 'fok';
export type OrderStatus = 'preview' | 'pending' | 'working' | 'filled' | 'rejected' | 'canceled';

export interface OrderTicket {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  notional?: number;
  tif: OrderTIF;
  status: OrderStatus;
  filledQty: number;
  avgFillPrice?: number;
  rejectReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrderValidationError {
  field: string;
  message: string;
}

let orderCounter = 100;
let orderStore: OrderTicket[] = [];
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

export function validateOrder(ticket: Partial<OrderTicket>): OrderValidationError[] {
  const errors: OrderValidationError[] = [];
  if (!ticket.symbol || ticket.symbol.trim().length === 0) {
    errors.push({ field: 'symbol', message: 'Symbol is required' });
  }
  if (!ticket.quantity || ticket.quantity <= 0) {
    errors.push({ field: 'quantity', message: 'Quantity must be positive' });
  }
  if (ticket.quantity && ticket.quantity > 10000) {
    errors.push({ field: 'quantity', message: 'Quantity exceeds maximum (10000)' });
  }
  if (ticket.type === 'limit' && (!ticket.limitPrice || ticket.limitPrice <= 0)) {
    errors.push({ field: 'limitPrice', message: 'Limit price required for limit orders' });
  }
  if (ticket.type === 'stop' && (!ticket.stopPrice || ticket.stopPrice <= 0)) {
    errors.push({ field: 'stopPrice', message: 'Stop price required for stop orders' });
  }
  return errors;
}

export function previewOrder(ticket: Partial<OrderTicket>): OrderTicket {
  const id = `ORD-DEMO-${String(++orderCounter).padStart(3, '0')}`;
  return {
    id,
    symbol: ticket.symbol || '',
    side: ticket.side || 'buy',
    type: ticket.type || 'market',
    quantity: ticket.quantity || 0,
    limitPrice: ticket.limitPrice,
    stopPrice: ticket.stopPrice,
    notional: ticket.notional,
    tif: ticket.tif || 'day',
    status: 'preview',
    filledQty: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function placeOrder(preview: OrderTicket): OrderTicket {
  const order = { ...preview, status: 'pending' as OrderStatus, updatedAt: Date.now() };
  orderStore.push(order);
  notify();

  // Deterministic fill simulation (no random)  
  if (order.type === 'market') {
    // Market orders fill instantly
    order.status = 'filled';
    order.filledQty = order.quantity;
    order.avgFillPrice = order.type === 'market' ? getBasePrice(order.symbol) : order.limitPrice;
    order.updatedAt = Date.now() + 500;
    notify();
  } else if (order.type === 'limit') {
    order.status = 'working';
    order.updatedAt = Date.now() + 200;
    notify();
  }
  return order;
}

export function cancelDemoOrder(id: string) {
  const order = orderStore.find(o => o.id === id);
  if (order && (order.status === 'pending' || order.status === 'working')) {
    order.status = 'canceled';
    order.updatedAt = Date.now() + 1000;
    notify();
  }
}

export function getDemoOrders(): OrderTicket[] {
  return [...orderStore];
}

export function resetDemoOrders() {
  orderCounter = 100;
  orderStore = [];
  notify();
}

export function subscribeOrders(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55, MSFT: 412.33,
    AMZN: 178.92, GOOGL: 152.23, META: 487.63,
  };
  return prices[symbol] ?? 100.00;
}
