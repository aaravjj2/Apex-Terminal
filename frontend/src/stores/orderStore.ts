import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  OrderType,
  OrderSide,
  OrderStatus,
  TimeInForce,
  Venue,
  RejectionReason,
  type Order,
  type Fill,
  type BracketOrder,
  type OCOOrder,
  type RiskCheckResult,
  type RiskLimits,
} from '../lib/orders/types';

// ─── Order Ticket ───────────────────────────────────────────────────────────

export interface OrderTicket {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number | null;
  stopPrice: number | null;
  limitPrice: number | null;
  trailingAmount: number | null;
  trailingPercent: number | null;
  timeInForce: TimeInForce;
  venue: Venue | null;
  expiresAt: number | null;
  isReady: boolean;
}

export interface CommissionEstimate {
  perShare: number;
  total: number;
  exchangeFee: number;
  regulatoryFee: number;
  clearingFee: number;
  netTotal: number;
}

export interface MarginRequirement {
  initialMargin: number;
  maintenanceMargin: number;
  availableMargin: number;
  marginUsage: number;
  projectedMarginAfterOrder: number;
  willTriggerMarginCall: boolean;
}

export interface BracketConfig {
  enabled: boolean;
  takeProfitOffset: number | null;
  takeProfitPrice: number | null;
  stopLossOffset: number | null;
  stopLossPrice: number | null;
  trailingStop: boolean;
  trailingStopPercent: number;
}

export interface OCOConfig {
  enabled: boolean;
  order1Type: OrderType;
  order1Price: number | null;
  order2Type: OrderType;
  order2Price: number | null;
}

export interface OrderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskChecks: RiskCheckResult[];
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: 'submitted' | 'accepted' | 'filled' | 'partial_fill' | 'cancelled' | 'rejected' | 'replaced' | 'expired';
  timestamp: number;
  details: string;
  data?: Record<string, unknown>;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface OrderStoreState {
  activeOrders: Record<string, Order>;
  orderHistory: Order[];
  fills: Fill[];
  events: OrderEvent[];

  ticket: OrderTicket;
  bracketConfig: BracketConfig;
  ocoConfig: OCOConfig;
  validation: OrderValidation;
  commissionEstimate: CommissionEstimate | null;
  marginRequirement: MarginRequirement | null;

  brackets: Record<string, BracketOrder>;
  ocoOrders: Record<string, OCOOrder>;

  riskLimits: RiskLimits;

  isSubmitting: boolean;
  lastError: string | null;
  wsConnected: boolean;

  dailyOrderCount: number;
  dailyFillCount: number;
  dailyVolume: number;
  dailyCommissions: number;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

function createDefaultTicket(): OrderTicket {
  return {
    symbol: '',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    quantity: 100,
    price: null,
    stopPrice: null,
    limitPrice: null,
    trailingAmount: null,
    trailingPercent: null,
    timeInForce: TimeInForce.DAY,
    venue: null,
    expiresAt: null,
    isReady: false,
  };
}

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSize: 10000,
  maxNotionalValue: 1_000_000,
  maxConcentrationPct: 25,
  maxPriceDeviationPct: 5,
  dailyLossLimit: 50_000,
  orderRateLimit: 100,
  orderRateWindowMs: 60_000,
  marginRequirementPct: 50,
  maxCreditExposure: 2_000_000,
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Actions ────────────────────────────────────────────────────────────────

interface OrderStoreActions {
  updateTicket: (updates: Partial<OrderTicket>) => void;
  resetTicket: () => void;
  setTicketSymbol: (symbol: string, lastPrice?: number) => void;
  flipSide: () => void;

  updateBracketConfig: (updates: Partial<BracketConfig>) => void;
  updateOCOConfig: (updates: Partial<OCOConfig>) => void;
  resetBracketConfig: () => void;
  resetOCOConfig: () => void;

  validateOrder: () => OrderValidation;
  estimateCommission: (price: number, quantity: number) => CommissionEstimate;
  calculateMarginRequirement: (price: number, quantity: number) => MarginRequirement;

  submitOrder: () => string | null;
  submitMarketOrder: (symbol: string, side: OrderSide, quantity: number) => string | null;
  submitLimitOrder: (symbol: string, side: OrderSide, quantity: number, price: number) => string | null;

  cancelOrder: (orderId: string) => boolean;
  cancelAll: (symbol?: string) => number;
  modifyOrder: (orderId: string, updates: { price?: number; stopPrice?: number; quantity?: number }) => boolean;
  replaceOrder: (orderId: string, newOrder: Partial<OrderTicket>) => string | null;

  createBracketOrder: (symbol: string, side: OrderSide, quantity: number, entryPrice: number, takeProfitPrice: number, stopLossPrice: number) => string | null;
  createOCOOrder: (symbol: string, order1: { type: OrderType; price: number }, order2: { type: OrderType; price: number }, quantity: number) => string | null;
  cancelBracket: (bracketId: string) => void;
  cancelOCO: (ocoId: string) => void;

  handleOrderUpdate: (order: Order) => void;
  handleFill: (fill: Fill) => void;
  handleWsStatus: (connected: boolean) => void;

  updateRiskLimits: (limits: Partial<RiskLimits>) => void;
  clearHistory: () => void;
  clearEvents: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useOrderStore = create<OrderStoreState & OrderStoreActions>()(
  immer((set, get) => ({
    activeOrders: {},
    orderHistory: [],
    fills: [],
    events: [],
    ticket: createDefaultTicket(),
    bracketConfig: {
      enabled: false,
      takeProfitOffset: null,
      takeProfitPrice: null,
      stopLossOffset: null,
      stopLossPrice: null,
      trailingStop: false,
      trailingStopPercent: 1,
    },
    ocoConfig: {
      enabled: false,
      order1Type: OrderType.LIMIT,
      order1Price: null,
      order2Type: OrderType.STOP,
      order2Price: null,
    },
    validation: { isValid: false, errors: [], warnings: [], riskChecks: [] },
    commissionEstimate: null,
    marginRequirement: null,
    brackets: {},
    ocoOrders: {},
    riskLimits: DEFAULT_RISK_LIMITS,
    isSubmitting: false,
    lastError: null,
    wsConnected: false,
    dailyOrderCount: 0,
    dailyFillCount: 0,
    dailyVolume: 0,
    dailyCommissions: 0,

    updateTicket: (updates) => {
      set((s) => {
        Object.assign(s.ticket, updates);
        s.ticket.isReady = isTicketReady(s.ticket);
      });
    },

    resetTicket: () => {
      set((s) => {
        s.ticket = createDefaultTicket();
        s.bracketConfig.enabled = false;
        s.ocoConfig.enabled = false;
        s.validation = { isValid: false, errors: [], warnings: [], riskChecks: [] };
        s.commissionEstimate = null;
        s.marginRequirement = null;
      });
    },

    setTicketSymbol: (symbol, lastPrice) => {
      set((s) => {
        s.ticket.symbol = symbol;
        if (lastPrice !== undefined) s.ticket.price = lastPrice;
        s.ticket.isReady = isTicketReady(s.ticket);
      });
    },

    flipSide: () => {
      set((s) => {
        if (s.ticket.side === OrderSide.BUY) s.ticket.side = OrderSide.SELL;
        else if (s.ticket.side === OrderSide.SELL) s.ticket.side = OrderSide.BUY;
        else if (s.ticket.side === OrderSide.BUY_TO_COVER) s.ticket.side = OrderSide.SELL_SHORT;
        else s.ticket.side = OrderSide.BUY_TO_COVER;
      });
    },

    updateBracketConfig: (updates) => {
      set((s) => {
        Object.assign(s.bracketConfig, updates);
      });
    },

    updateOCOConfig: (updates) => {
      set((s) => {
        Object.assign(s.ocoConfig, updates);
      });
    },

    resetBracketConfig: () => {
      set((s) => {
        s.bracketConfig = {
          enabled: false,
          takeProfitOffset: null,
          takeProfitPrice: null,
          stopLossOffset: null,
          stopLossPrice: null,
          trailingStop: false,
          trailingStopPercent: 1,
        };
      });
    },

    resetOCOConfig: () => {
      set((s) => {
        s.ocoConfig = {
          enabled: false,
          order1Type: OrderType.LIMIT,
          order1Price: null,
          order2Type: OrderType.STOP,
          order2Price: null,
        };
      });
    },

    validateOrder: () => {
      const { ticket, riskLimits, dailyOrderCount } = get();
      const errors: string[] = [];
      const warnings: string[] = [];
      const riskChecks: RiskCheckResult[] = [];

      if (!ticket.symbol) errors.push('Symbol is required');
      if (ticket.quantity <= 0) errors.push('Quantity must be positive');
      if (ticket.quantity > riskLimits.maxPositionSize) {
        riskChecks.push({
          passed: false, checkName: 'Position Size', details: `Exceeds max ${riskLimits.maxPositionSize}`,
          currentValue: ticket.quantity, limit: riskLimits.maxPositionSize, severity: 'HARD_REJECT',
        });
      }

      if (ticket.type === OrderType.LIMIT || ticket.type === OrderType.STOP_LIMIT) {
        if (ticket.price === null || ticket.price <= 0) errors.push('Price is required for limit orders');
      }
      if (ticket.type === OrderType.STOP || ticket.type === OrderType.STOP_LIMIT) {
        if (ticket.stopPrice === null || ticket.stopPrice <= 0) errors.push('Stop price is required');
      }
      if (ticket.type === OrderType.TRAILING_STOP) {
        if (!ticket.trailingAmount && !ticket.trailingPercent) {
          errors.push('Trailing amount or percent is required');
        }
      }

      if (ticket.price !== null && ticket.price > 0) {
        const notional = ticket.price * ticket.quantity;
        if (notional > riskLimits.maxNotionalValue) {
          riskChecks.push({
            passed: false, checkName: 'Notional Value', details: `Notional $${notional.toFixed(0)} exceeds limit`,
            currentValue: notional, limit: riskLimits.maxNotionalValue, severity: 'HARD_REJECT',
          });
        }
      }

      if (dailyOrderCount >= riskLimits.orderRateLimit) {
        riskChecks.push({
          passed: false, checkName: 'Order Rate', details: 'Daily order limit reached',
          currentValue: dailyOrderCount, limit: riskLimits.orderRateLimit, severity: 'HARD_REJECT',
        });
      }

      if (ticket.type === OrderType.MARKET) {
        warnings.push('Market orders have no price protection');
      }

      const hasRiskFailures = riskChecks.some((r) => !r.passed && r.severity === 'HARD_REJECT');
      const result: OrderValidation = {
        isValid: errors.length === 0 && !hasRiskFailures,
        errors,
        warnings,
        riskChecks,
      };

      set((s) => {
        s.validation = result;
      });
      return result;
    },

    estimateCommission: (price, quantity) => {
      const perShare = 0.005;
      const rawCommission = perShare * quantity;
      const commission = Math.max(rawCommission, 1.0);
      const exchangeFee = quantity * 0.003;
      const regulatoryFee = quantity * 0.0000229;
      const clearingFee = quantity * 0.0002;
      const estimate: CommissionEstimate = {
        perShare,
        total: commission,
        exchangeFee,
        regulatoryFee,
        clearingFee,
        netTotal: commission + exchangeFee + regulatoryFee + clearingFee,
      };
      set((s) => {
        s.commissionEstimate = estimate;
      });
      return estimate;
    },

    calculateMarginRequirement: (price, quantity) => {
      const { riskLimits } = get();
      const notional = price * quantity;
      const initialMargin = notional * (riskLimits.marginRequirementPct / 100);
      const maintenanceMargin = notional * (riskLimits.marginRequirementPct / 100) * 0.75;
      const available = riskLimits.maxCreditExposure;
      const usage = (initialMargin / available) * 100;
      const req: MarginRequirement = {
        initialMargin,
        maintenanceMargin,
        availableMargin: available,
        marginUsage: usage,
        projectedMarginAfterOrder: usage,
        willTriggerMarginCall: usage > 90,
      };
      set((s) => {
        s.marginRequirement = req;
      });
      return req;
    },

    submitOrder: () => {
      const state = get();
      const validation = state.validateOrder();
      if (!validation.isValid) return null;

      const id = generateId('ord');
      const now = Date.now();
      const order: Order = {
        id,
        clientOrderId: generateId('cli'),
        accountId: 'default',
        symbol: state.ticket.symbol,
        side: state.ticket.side,
        type: state.ticket.type,
        timeInForce: state.ticket.timeInForce,
        status: OrderStatus.NEW,
        quantity: state.ticket.quantity,
        filledQuantity: 0,
        remainingQuantity: state.ticket.quantity,
        price: state.ticket.price ?? undefined,
        stopPrice: state.ticket.stopPrice ?? undefined,
        limitPrice: state.ticket.limitPrice ?? undefined,
        trailingAmount: state.ticket.trailingAmount ?? undefined,
        trailingPercent: state.ticket.trailingPercent ?? undefined,
        avgFillPrice: 0,
        commission: 0,
        venue: state.ticket.venue ?? undefined,
        createdAt: now,
        updatedAt: now,
        expiresAt: state.ticket.expiresAt ?? undefined,
        tags: {},
      };

      set((s) => {
        s.activeOrders[id] = order;
        s.events.push({
          id: generateId('evt'), orderId: id, type: 'submitted',
          timestamp: now, details: `${order.side} ${order.quantity} ${order.symbol} @ ${order.type}`,
        });
        s.dailyOrderCount++;
        s.isSubmitting = false;
        s.lastError = null;
        s.ticket = createDefaultTicket();
      });

      return id;
    },

    submitMarketOrder: (symbol, side, quantity) => {
      set((s) => {
        s.ticket = { ...createDefaultTicket(), symbol, side, quantity, type: OrderType.MARKET, isReady: true };
      });
      return get().submitOrder();
    },

    submitLimitOrder: (symbol, side, quantity, price) => {
      set((s) => {
        s.ticket = { ...createDefaultTicket(), symbol, side, quantity, price, type: OrderType.LIMIT, isReady: true };
      });
      return get().submitOrder();
    },

    cancelOrder: (orderId) => {
      const order = get().activeOrders[orderId];
      if (!order) return false;
      if (order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED) return false;

      set((s) => {
        const o = s.activeOrders[orderId];
        if (!o) return;
        o.status = OrderStatus.CANCELLED;
        o.cancelledAt = Date.now();
        o.updatedAt = Date.now();
        s.orderHistory.push(JSON.parse(JSON.stringify(o)));
        delete s.activeOrders[orderId];
        s.events.push({
          id: generateId('evt'), orderId, type: 'cancelled',
          timestamp: Date.now(), details: `Order ${orderId} cancelled`,
        });
      });
      return true;
    },

    cancelAll: (symbol) => {
      const state = get();
      const toCancel = Object.values(state.activeOrders).filter(
        (o) => (!symbol || o.symbol === symbol) && o.status !== OrderStatus.FILLED && o.status !== OrderStatus.CANCELLED,
      );
      for (const o of toCancel) state.cancelOrder(o.id);
      return toCancel.length;
    },

    modifyOrder: (orderId, updates) => {
      const order = get().activeOrders[orderId];
      if (!order || order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED) return false;

      set((s) => {
        const o = s.activeOrders[orderId];
        if (!o) return;
        if (updates.price !== undefined) o.price = updates.price;
        if (updates.stopPrice !== undefined) o.stopPrice = updates.stopPrice;
        if (updates.quantity !== undefined) {
          o.quantity = updates.quantity;
          o.remainingQuantity = updates.quantity - o.filledQuantity;
        }
        o.updatedAt = Date.now();
        s.events.push({
          id: generateId('evt'), orderId, type: 'replaced',
          timestamp: Date.now(), details: `Order modified: ${JSON.stringify(updates)}`,
        });
      });
      return true;
    },

    replaceOrder: (orderId, newTicket) => {
      const state = get();
      const success = state.cancelOrder(orderId);
      if (!success) return null;
      state.updateTicket(newTicket);
      return state.submitOrder();
    },

    createBracketOrder: (symbol, side, quantity, entryPrice, takeProfitPrice, stopLossPrice) => {
      const bracketId = generateId('brk');
      const now = Date.now();

      const entryOrder = buildOrder(symbol, side, OrderType.LIMIT, quantity, entryPrice, now);
      const tpSide = side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
      const tpOrder = buildOrder(symbol, tpSide, OrderType.LIMIT, quantity, takeProfitPrice, now, entryOrder.id);
      const slOrder = buildOrder(symbol, tpSide, OrderType.STOP, quantity, stopLossPrice, now, entryOrder.id);

      const bracket: BracketOrder = {
        id: bracketId,
        entryOrder,
        takeProfitOrder: tpOrder,
        stopLossOrder: slOrder,
        status: 'ACTIVE',
      };

      set((s) => {
        s.brackets[bracketId] = bracket;
        s.activeOrders[entryOrder.id] = entryOrder;
        s.dailyOrderCount++;
        s.events.push({
          id: generateId('evt'), orderId: entryOrder.id, type: 'submitted',
          timestamp: now, details: `Bracket order: entry=${entryPrice}, TP=${takeProfitPrice}, SL=${stopLossPrice}`,
        });
      });

      return bracketId;
    },

    createOCOOrder: (symbol, order1, order2, quantity) => {
      const ocoId = generateId('oco');
      const now = Date.now();

      const o1 = buildOrder(symbol, OrderSide.SELL, order1.type, quantity, order1.price, now);
      const o2 = buildOrder(symbol, OrderSide.SELL, order2.type, quantity, order2.price, now);

      const oco: OCOOrder = {
        id: ocoId,
        orders: [o1, o2],
        status: 'ACTIVE',
      };

      set((s) => {
        s.ocoOrders[ocoId] = oco;
        s.activeOrders[o1.id] = o1;
        s.activeOrders[o2.id] = o2;
        s.dailyOrderCount += 2;
        s.events.push({
          id: generateId('evt'), orderId: o1.id, type: 'submitted',
          timestamp: now, details: `OCO: ${order1.type}@${order1.price} / ${order2.type}@${order2.price}`,
        });
      });

      return ocoId;
    },

    cancelBracket: (bracketId) => {
      set((s) => {
        const bracket = s.brackets[bracketId];
        if (!bracket || bracket.status === 'COMPLETED' || bracket.status === 'CANCELLED') return;
        bracket.status = 'CANCELLED';
        for (const o of [bracket.entryOrder, bracket.takeProfitOrder, bracket.stopLossOrder]) {
          if (s.activeOrders[o.id]) {
            s.activeOrders[o.id].status = OrderStatus.CANCELLED;
            s.activeOrders[o.id].cancelledAt = Date.now();
            s.orderHistory.push(JSON.parse(JSON.stringify(s.activeOrders[o.id])));
            delete s.activeOrders[o.id];
          }
        }
      });
    },

    cancelOCO: (ocoId) => {
      set((s) => {
        const oco = s.ocoOrders[ocoId];
        if (!oco || oco.status === 'COMPLETED' || oco.status === 'CANCELLED') return;
        oco.status = 'CANCELLED';
        for (const o of oco.orders) {
          if (s.activeOrders[o.id]) {
            s.activeOrders[o.id].status = OrderStatus.CANCELLED;
            s.activeOrders[o.id].cancelledAt = Date.now();
            s.orderHistory.push(JSON.parse(JSON.stringify(s.activeOrders[o.id])));
            delete s.activeOrders[o.id];
          }
        }
      });
    },

    handleOrderUpdate: (order) => {
      set((s) => {
        const isTerminal = order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED
          || order.status === OrderStatus.REJECTED || order.status === OrderStatus.EXPIRED;

        if (isTerminal) {
          delete s.activeOrders[order.id];
          s.orderHistory.push(order);
        } else {
          s.activeOrders[order.id] = order;
        }

        let eventType: OrderEvent['type'] = 'accepted';
        if (order.status === OrderStatus.FILLED) eventType = 'filled';
        else if (order.status === OrderStatus.PARTIALLY_FILLED) eventType = 'partial_fill';
        else if (order.status === OrderStatus.CANCELLED) eventType = 'cancelled';
        else if (order.status === OrderStatus.REJECTED) eventType = 'rejected';
        else if (order.status === OrderStatus.EXPIRED) eventType = 'expired';

        s.events.push({
          id: generateId('evt'), orderId: order.id, type: eventType,
          timestamp: Date.now(), details: `${order.symbol} ${order.status} qty=${order.filledQuantity}/${order.quantity}`,
        });

        // Handle bracket fill propagation
        for (const bracket of Object.values(s.brackets)) {
          if (bracket.entryOrder.id === order.id && order.status === OrderStatus.FILLED) {
            bracket.status = 'ENTRY_FILLED';
            s.activeOrders[bracket.takeProfitOrder.id] = bracket.takeProfitOrder;
            s.activeOrders[bracket.stopLossOrder.id] = bracket.stopLossOrder;
          }
          if (bracket.takeProfitOrder.id === order.id && order.status === OrderStatus.FILLED) {
            bracket.status = 'COMPLETED';
            delete s.activeOrders[bracket.stopLossOrder.id];
          }
          if (bracket.stopLossOrder.id === order.id && order.status === OrderStatus.FILLED) {
            bracket.status = 'COMPLETED';
            delete s.activeOrders[bracket.takeProfitOrder.id];
          }
        }

        // Handle OCO fill propagation
        for (const oco of Object.values(s.ocoOrders)) {
          if (oco.status !== 'ACTIVE') continue;
          const [o1, o2] = oco.orders;
          if (o1.id === order.id && order.status === OrderStatus.FILLED) {
            oco.status = 'COMPLETED';
            oco.filledOrderId = o1.id;
            oco.cancelledOrderId = o2.id;
            delete s.activeOrders[o2.id];
          } else if (o2.id === order.id && order.status === OrderStatus.FILLED) {
            oco.status = 'COMPLETED';
            oco.filledOrderId = o2.id;
            oco.cancelledOrderId = o1.id;
            delete s.activeOrders[o1.id];
          }
        }
      });
    },

    handleFill: (fill) => {
      set((s) => {
        s.fills.push(fill);
        s.dailyFillCount++;
        s.dailyVolume += fill.quantity * fill.price;
        s.dailyCommissions += fill.commission;
      });
    },

    handleWsStatus: (connected) => {
      set((s) => {
        s.wsConnected = connected;
      });
    },

    updateRiskLimits: (limits) => {
      set((s) => {
        Object.assign(s.riskLimits, limits);
      });
    },

    clearHistory: () => {
      set((s) => {
        s.orderHistory = [];
        s.fills = [];
      });
    },

    clearEvents: () => {
      set((s) => {
        s.events = [];
      });
    },
  })),
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function isTicketReady(ticket: OrderTicket): boolean {
  if (!ticket.symbol || ticket.quantity <= 0) return false;
  if (ticket.type === OrderType.LIMIT && (ticket.price === null || ticket.price <= 0)) return false;
  if (ticket.type === OrderType.STOP && (ticket.stopPrice === null || ticket.stopPrice <= 0)) return false;
  if (ticket.type === OrderType.STOP_LIMIT) {
    if (ticket.stopPrice === null || ticket.stopPrice <= 0) return false;
    if (ticket.price === null || ticket.price <= 0) return false;
  }
  return true;
}

function buildOrder(
  symbol: string, side: OrderSide, type: OrderType, quantity: number,
  price: number, timestamp: number, parentOrderId?: string,
): Order {
  const id = generateId('ord');
  return {
    id,
    clientOrderId: generateId('cli'),
    parentOrderId,
    accountId: 'default',
    symbol,
    side,
    type,
    timeInForce: TimeInForce.GTC,
    status: OrderStatus.NEW,
    quantity,
    filledQuantity: 0,
    remainingQuantity: quantity,
    price: type === OrderType.LIMIT ? price : undefined,
    stopPrice: type === OrderType.STOP || type === OrderType.STOP_LIMIT ? price : undefined,
    avgFillPrice: 0,
    commission: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: {},
  };
}

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveOrdersList = (s: OrderStoreState) => Object.values(s.activeOrders);

export const selectActiveOrdersBySymbol = (symbol: string) => (s: OrderStoreState) =>
  Object.values(s.activeOrders).filter((o) => o.symbol === symbol);

export const selectPendingOrders = (s: OrderStoreState) =>
  Object.values(s.activeOrders).filter(
    (o) => o.status === OrderStatus.NEW || o.status === OrderStatus.PENDING,
  );

export const selectPartiallyFilledOrders = (s: OrderStoreState) =>
  Object.values(s.activeOrders).filter((o) => o.status === OrderStatus.PARTIALLY_FILLED);

export const selectFillsByOrder = (orderId: string) => (s: OrderStoreState) =>
  s.fills.filter((f) => f.orderId === orderId);

export const selectOrderEventsByOrder = (orderId: string) => (s: OrderStoreState) =>
  s.events.filter((e) => e.orderId === orderId);

export const selectDailyStats = (s: OrderStoreState) => ({
  orderCount: s.dailyOrderCount,
  fillCount: s.dailyFillCount,
  volume: s.dailyVolume,
  commissions: s.dailyCommissions,
});

export const selectActiveBrackets = (s: OrderStoreState) =>
  Object.values(s.brackets).filter((b) => b.status === 'ACTIVE' || b.status === 'ENTRY_FILLED');

export const selectActiveOCOs = (s: OrderStoreState) =>
  Object.values(s.ocoOrders).filter((o) => o.status === 'ACTIVE');

export const selectIsTicketReady = (s: OrderStoreState) => s.ticket.isReady;
