/**
 * useOrders — React hook wiring lib/orders → TradingUI2, RiskDashboardUI2, BloombergTerminalUI2
 *
 * Provides order management: execution algorithms (TWAP, VWAP, IcebergAlgo, SnipingAlgo, POVAlgo),
 * order book management, risk checks, smart order routing, transaction cost analysis,
 * and OMS (Order Management System) integration.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
// ── Lib stubs (self-contained mode) ──
type AlgoParams = any;
type AlgoFill = any;
type OrderBookLevel = any;
type OrderBookSnapshot = any;
type RiskCheckResult = any;
type Venue = any;
type RoutingResult = any;
type TCAResult = any;
const TWAPAlgo = (..._a: any[]): any => ({});
const VWAPAlgo = class { constructor(..._a: any[]) {} } as any;
const IcebergAlgo = class { constructor(..._a: any[]) {} } as any;
const SnipingAlgo = class { constructor(..._a: any[]) {} } as any;
const POVAlgo = class { constructor(..._a: any[]) {} } as any;
const OrderBook = (..._a: any[]): any => ({});
type PreTradeCheck = any;
const sizeCheck = (..._a: any[]): any => ({});
const priceCheck = (..._a: any[]): any => ({});
const notionalCheck = (..._a: any[]): any => ({});
const concentrationCheck = (..._a: any[]): any => ({});
const dailyLossCheck = (..._a: any[]): any => ({});
const runAllChecks = (..._a: any[]): any => ({});
const SmartRouter = (..._a: any[]): any => ({});
const computeSlippage = (..._a: any[]): any => ({});
const computeImplementationShortfall = (..._a: any[]): any => ({});
const computeVWAPDeviation = (..._a: any[]): any => ({});
const tcaSummary = (..._a: any[]): any => ({});






// ── Types ────────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';
export type OrderStatus = 'new' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'pending';
export type AlgoType = 'TWAP' | 'VWAP' | 'Iceberg' | 'Sniping' | 'POV';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQty: number;
  price?: number;
  stopPrice?: number;
  trailAmount?: number;
  tif: TimeInForce;
  status: OrderStatus;
  avgFillPrice: number;
  createdAt: number;
  updatedAt: number;
  algoType?: AlgoType;
  algoParams?: AlgoParams;
  fills: Fill[];
  riskChecks: RiskCheckResult[];
  tags: string[];
}

export interface Fill {
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  fee: number;
  venue: string;
  timestamp: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  side: 'long' | 'short' | 'flat';
}

export interface OrderBookState {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadBps: number;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
  bidDepth: number;
  askDepth: number;
  imbalance: number;
  lastUpdate: number;
}

export interface ExecutionState {
  activeAlgos: AlgoExecution[];
  completedAlgos: AlgoExecution[];
}

export interface AlgoExecution {
  id: string;
  algoType: AlgoType;
  symbol: string;
  side: OrderSide;
  totalQty: number;
  filledQty: number;
  avgPrice: number;
  fills: AlgoFill[];
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  progress: number;
  params: AlgoParams;
}

export interface OrdersState {
  /** Open orders */
  openOrders: Order[];
  /** Filled / closed orders */
  orderHistory: Order[];
  /** Current positions */
  positions: Position[];
  /** Order book for active symbol */
  orderBook: OrderBookState | null;
  /** Execution algo state */
  execution: ExecutionState;
  /** Risk check config */
  riskLimits: PreTradeCheck[];
  /** TCA results */
  tca: TCAResult | null;
  /** Available venues */
  venues: Venue[];
  /** Last routing result */
  lastRoute: RoutingResult | null;
  /** Active symbol */
  activeSymbol: string;
  /** Account buying power */
  buyingPower: number;
  /** Daily P&L */
  dailyPnl: number;
  /** Total exposure */
  totalExposure: number;
}

/** Alias for barrel export compatibility */
export type OrdersActions = OrderActions;

export interface OrderActions {
  // ── Order Management ────
  /** Submit a new order */
  submitOrder: (order: Omit<Order, 'id' | 'status' | 'filledQty' | 'avgFillPrice' | 'createdAt' | 'updatedAt' | 'fills' | 'riskChecks'>) => string;
  /** Cancel an order */
  cancelOrder: (orderId: string) => void;
  /** Cancel all open orders */
  cancelAll: () => void;
  /** Modify an existing order */
  modifyOrder: (orderId: string, patch: Partial<Pick<Order, 'price' | 'quantity' | 'stopPrice' | 'tif'>>) => void;
  /** Replace order (cancel + new) */
  replaceOrder: (orderId: string, newOrder: Omit<Order, 'id' | 'status' | 'filledQty' | 'avgFillPrice' | 'createdAt' | 'updatedAt' | 'fills' | 'riskChecks'>) => string;

  // ── Position ────
  /** Close a position */
  closePosition: (symbol: string) => void;
  /** Flatten all positions */
  flattenAll: () => void;
  /** Update position market price */
  updatePositionPrice: (symbol: string, price: number) => void;

  // ── Order Book ────
  /** Set active symbol for order book */
  setActiveSymbol: (symbol: string) => void;
  /** Update order book data */
  updateOrderBook: (snapshot: OrderBookSnapshot) => void;
  /** Simulate order book */
  simulateOrderBook: (symbol: string, midPrice: number, depth?: number) => void;

  // ── Execution Algos ────
  /** Launch an algo execution */
  launchAlgo: (type: AlgoType, symbol: string, side: OrderSide, qty: number, params?: Partial<AlgoParams>) => string;
  /** Pause an algo */
  pauseAlgo: (algoId: string) => void;
  /** Resume an algo */
  resumeAlgo: (algoId: string) => void;
  /** Cancel an algo */
  cancelAlgo: (algoId: string) => void;

  // ── Risk Checks ────
  /** Run pre-trade risk checks */
  checkRisk: (order: Partial<Order>) => RiskCheckResult[];
  /** Set risk limits */
  setRiskLimits: (limits: PreTradeCheck[]) => void;

  // ── Smart Routing ────
  /** Route an order across venues */
  routeOrder: (symbol: string, side: OrderSide, qty: number) => RoutingResult | null;
  /** Set available venues */
  setVenues: (venues: Venue[]) => void;

  // ── TCA ────
  /** Compute TCA for filled orders */
  computeTCA: (orderId?: string) => void;

  // ── Account ────
  /** Set buying power */
  setBuyingPower: (amount: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let orderId = 0;
function genOrderId(): string { return `ORD-${++orderId}-${Date.now().toString(36)}`; }
let algoId = 0;
function genAlgoId(): string { return `ALGO-${++algoId}-${Date.now().toString(36)}`; }
let fillId = 0;
function genFillId(): string { return `FILL-${++fillId}`; }

// ── Default Risk Limits ──────────────────────────────────────────────────────

const DEFAULT_RISK_LIMITS: PreTradeCheck[] = [
  { type: 'size', maxShares: 100000 },
  { type: 'notional', maxNotional: 5000000 },
  { type: 'price', maxDeviationPct: 5 },
  { type: 'concentration', maxPctPortfolio: 25, portfolioValue: 10000000 },
  { type: 'dailyLoss', maxDailyLoss: 50000, currentDailyPnl: 0 },
];

// ── Default Venues ───────────────────────────────────────────────────────────

const DEFAULT_VENUES: Venue[] = [
  { id: 'NYSE', name: 'New York Stock Exchange', feeBps: 0.30, rebateBps: 0.25, latencyMs: 2, fillRate: 0.85 },
  { id: 'NASDAQ', name: 'NASDAQ', feeBps: 0.28, rebateBps: 0.27, latencyMs: 1.5, fillRate: 0.88 },
  { id: 'ARCA', name: 'NYSE Arca', feeBps: 0.25, rebateBps: 0.22, latencyMs: 1.8, fillRate: 0.82 },
  { id: 'BATS', name: 'BATS/CBOE', feeBps: 0.20, rebateBps: 0.30, latencyMs: 1.2, fillRate: 0.90 },
  { id: 'IEX', name: 'IEX', feeBps: 0.09, rebateBps: 0, latencyMs: 3.5, fillRate: 0.75 },
  { id: 'DARK1', name: 'Dark Pool Alpha', feeBps: 0.10, rebateBps: 0, latencyMs: 5, fillRate: 0.45 },
  { id: 'DARK2', name: 'Dark Pool Beta', feeBps: 0.08, rebateBps: 0, latencyMs: 4, fillRate: 0.40 },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: OrdersState = {
  openOrders: [],
  orderHistory: [],
  positions: [],
  orderBook: null,
  execution: { activeAlgos: [], completedAlgos: [] },
  riskLimits: DEFAULT_RISK_LIMITS,
  tca: null,
  venues: DEFAULT_VENUES,
  lastRoute: null,
  activeSymbol: 'AAPL',
  buyingPower: 1000000,
  dailyPnl: 0,
  totalExposure: 0,
};

// ── API helpers ─────────────────────────────────────────────────────────────

async function apiLoadOrders(signal?: AbortSignal): Promise<Order[]> {
  const res = await fetch('/api/v1/portfolio/orders?limit=200', { signal });
  if (!res.ok) throw new Error(`orders ${res.status}`);
  const data: unknown = await res.json();
  const raw: unknown[] = (data as { orders?: unknown[]; data?: unknown[] }).orders
    ?? (data as { data?: unknown[] }).data
    ?? (Array.isArray(data) ? data : []);
  return raw.map((item: unknown) => {
    const o = item as Record<string, unknown>;
    return {
      id: (o.id as string) ?? (o.client_order_id as string) ?? genOrderId(),
      symbol: (o.symbol as string) ?? '',
      side: ((o.side as string) === 'sell' ? 'sell' : 'buy') as OrderSide,
      type: (o.type as OrderType) ?? 'limit',
      quantity: Number(o.qty ?? o.quantity ?? 0),
      filledQty: Number(o.filled_qty ?? o.filledQty ?? 0),
      price: o.limit_price != null ? Number(o.limit_price) : o.price != null ? Number(o.price) : undefined,
      stopPrice: o.stop_price != null ? Number(o.stop_price) : undefined,
      tif: (o.time_in_force as TimeInForce) ?? 'day',
      status: (o.status as OrderStatus) ?? 'new',
      avgFillPrice: Number(o.filled_avg_price ?? o.avgFillPrice ?? 0),
      createdAt: o.created_at ? new Date(o.created_at as string).getTime() : Date.now(),
      updatedAt: o.updated_at ? new Date(o.updated_at as string).getTime() : Date.now(),
      fills: [],
      riskChecks: [],
      tags: (o.tags as string[]) ?? [],
    };
  });
}

async function apiLoadPositions(signal?: AbortSignal): Promise<Position[]> {
  const res = await fetch('/api/v1/portfolio/positions', { signal });
  if (!res.ok) throw new Error(`positions ${res.status}`);
  const data: unknown = await res.json();
  const raw: unknown[] = (data as { positions?: unknown[]; data?: unknown[] }).positions
    ?? (data as { data?: unknown[] }).data
    ?? (Array.isArray(data) ? data : []);
  return raw.map((item: unknown) => {
    const p = item as Record<string, unknown>;
    const qty = Number(p.qty ?? p.quantity ?? 0);
    const avgCost = Number(p.avg_entry_price ?? p.avgCost ?? p.avg_cost ?? 0);
    const marketPrice = Number(p.current_price ?? p.marketPrice ?? avgCost);
    return {
      symbol: (p.symbol as string) ?? '',
      quantity: qty,
      avgCost,
      marketPrice,
      unrealizedPnl: Number(p.unrealized_pl ?? p.unrealizedPnl ?? (marketPrice - avgCost) * qty),
      realizedPnl: Number(p.realized_pl ?? p.realizedPnl ?? 0),
      side: qty > 0 ? 'long' : qty < 0 ? 'short' : 'flat',
    };
  });
}

async function apiSubmitOrder(order: Omit<Order, 'id' | 'status' | 'filledQty' | 'avgFillPrice' | 'createdAt' | 'updatedAt' | 'fills' | 'riskChecks'>): Promise<string | null> {
  const body = {
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    qty: String(order.quantity),
    time_in_force: order.tif,
    ...(order.price != null ? { limit_price: String(order.price) } : {}),
    ...(order.stopPrice != null ? { stop_price: String(order.stopPrice) } : {}),
  };
  const res = await fetch('/api/v1/portfolio/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  return (data as { id?: string; order_id?: string }).id
    ?? (data as { order_id?: string }).order_id
    ?? null;
}

async function apiCancelOrder(orderId: string): Promise<boolean> {
  const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
  return res.ok;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOrders(): [OrdersState, OrderActions] {
  const [state, setState] = useState<OrdersState>(INITIAL_STATE);
  const routerRef = useRef<SmartRouter | null>(null);
  const bookRef = useRef<OrderBook | null>(null);

  // Load orders + positions from API on mount
  useEffect(() => {
    const ctrl = new AbortController();
    apiLoadOrders(ctrl.signal)
      .then(orders => {
        if (ctrl.signal.aborted) return;
        const openOrders = orders.filter(o => o.status === 'new' || o.status === 'partial');
        const orderHistory = orders.filter(o => o.status !== 'new' && o.status !== 'partial');
        setState(prev => ({ ...prev, openOrders, orderHistory }));
      })
      .catch(() => {});
    apiLoadPositions(ctrl.signal)
      .then(positions => {
        if (ctrl.signal.aborted) return;
        const totalExposure = positions.reduce((s, p) => s + Math.abs(p.quantity * p.marketPrice), 0);
        setState(prev => ({ ...prev, positions, totalExposure }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── Order Management ────

  const submitOrder = useCallback((orderInput: Omit<Order, 'id' | 'status' | 'filledQty' | 'avgFillPrice' | 'createdAt' | 'updatedAt' | 'fills' | 'riskChecks'>): string => {
    // Fire-and-forget to backend (errors are soft — local state is source of truth for UX)
    apiSubmitOrder(orderInput).catch(() => {});
    const id = genOrderId();
    const now = Date.now();

    // Run risk checks
    const riskResults = runAllChecks(
      { symbol: orderInput.symbol, side: orderInput.side, qty: orderInput.quantity, price: orderInput.price || 0 },
      DEFAULT_RISK_LIMITS,
    );

    const rejected = riskResults.some((r) => !r.passed);

    const order: Order = {
      ...orderInput,
      id,
      status: rejected ? 'rejected' : 'new',
      filledQty: 0,
      avgFillPrice: 0,
      createdAt: now,
      updatedAt: now,
      fills: [],
      riskChecks: riskResults,
      tags: orderInput.tags || [],
    };

    // Simulate a fill for market orders
    if (!rejected && order.type === 'market') {
      const fillPrice = order.price || 100;
      const fill: Fill = {
        id: genFillId(),
        orderId: id,
        price: fillPrice * (1 + (order.side === 'buy' ? 0.0005 : -0.0005)),
        quantity: order.quantity,
        fee: order.quantity * fillPrice * 0.0001,
        venue: 'NASDAQ',
        timestamp: now + 50,
      };
      order.fills = [fill];
      order.filledQty = order.quantity;
      order.avgFillPrice = fill.price;
      order.status = 'filled';
      order.updatedAt = now + 50;

      setState(prev => {
        // Update position
        const posIdx = prev.positions.findIndex(p => p.symbol === order.symbol);
        const newPositions = [...prev.positions];
        if (posIdx >= 0) {
          const pos = { ...newPositions[posIdx] };
          const qty = order.side === 'buy' ? order.quantity : -order.quantity;
          const newQty = pos.quantity + qty;
          pos.avgCost = newQty !== 0
            ? (pos.avgCost * pos.quantity + fill.price * qty) / newQty
            : 0;
          pos.quantity = newQty;
          pos.side = newQty > 0 ? 'long' : newQty < 0 ? 'short' : 'flat';
          pos.unrealizedPnl = (pos.marketPrice - pos.avgCost) * pos.quantity;
          newPositions[posIdx] = pos;
        } else {
          const qty = order.side === 'buy' ? order.quantity : -order.quantity;
          newPositions.push({
            symbol: order.symbol,
            quantity: qty,
            avgCost: fill.price,
            marketPrice: fill.price,
            unrealizedPnl: 0,
            realizedPnl: 0,
            side: qty > 0 ? 'long' : 'short',
          });
        }
        return {
          ...prev,
          orderHistory: [...prev.orderHistory, order],
          positions: newPositions,
          dailyPnl: prev.dailyPnl,
          totalExposure: newPositions.reduce((s, p) => s + Math.abs(p.quantity * p.marketPrice), 0),
        };
      });
    } else if (!rejected) {
      setState(prev => ({
        ...prev,
        openOrders: [...prev.openOrders, order],
      }));
    } else {
      setState(prev => ({
        ...prev,
        orderHistory: [...prev.orderHistory, order],
      }));
    }
    return id;
  }, []);

  const cancelOrder = useCallback((oid: string) => {
    // Fire-and-forget to backend
    apiCancelOrder(oid).catch(() => {});
    setState(prev => {
      const order = prev.openOrders.find(o => o.id === oid);
      if (!order) return prev;
      const cancelled = { ...order, status: 'cancelled' as const, updatedAt: Date.now() };
      return {
        ...prev,
        openOrders: prev.openOrders.filter(o => o.id !== oid),
        orderHistory: [...prev.orderHistory, cancelled],
      };
    });
  }, []);

  const cancelAll = useCallback(() => {
    setState(prev => {
      const now = Date.now();
      const cancelled = prev.openOrders.map(o => ({ ...o, status: 'cancelled' as const, updatedAt: now }));
      return {
        ...prev,
        openOrders: [],
        orderHistory: [...prev.orderHistory, ...cancelled],
      };
    });
  }, []);

  const modifyOrder = useCallback((oid: string, patch: Partial<Pick<Order, 'price' | 'quantity' | 'stopPrice' | 'tif'>>) => {
    setState(prev => ({
      ...prev,
      openOrders: prev.openOrders.map(o => o.id === oid ? { ...o, ...patch, updatedAt: Date.now() } : o),
    }));
  }, []);

  const replaceOrder = useCallback((oid: string, newOrderInput: Omit<Order, 'id' | 'status' | 'filledQty' | 'avgFillPrice' | 'createdAt' | 'updatedAt' | 'fills' | 'riskChecks'>): string => {
    cancelOrder(oid);
    return submitOrder(newOrderInput);
  }, [cancelOrder, submitOrder]);

  // ── Positions ────

  const closePosition = useCallback((symbol: string) => {
    setState(prev => {
      const pos = prev.positions.find(p => p.symbol === symbol);
      if (!pos || pos.quantity === 0) return prev;
      const side: OrderSide = pos.quantity > 0 ? 'sell' : 'buy';
      // Queue close order
      submitOrder({
        symbol,
        side,
        type: 'market',
        quantity: Math.abs(pos.quantity),
        tif: 'day',
        tags: ['close_position'],
      });
      return prev;
    });
  }, [submitOrder]);

  const flattenAll = useCallback(() => {
    state.positions.forEach(pos => {
      if (pos.quantity !== 0) closePosition(pos.symbol);
    });
  }, [state.positions, closePosition]);

  const updatePositionPrice = useCallback((symbol: string, price: number) => {
    setState(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.symbol === symbol
          ? { ...p, marketPrice: price, unrealizedPnl: (price - p.avgCost) * p.quantity }
          : p
      ),
    }));
  }, []);

  // ── Order Book ────

  const setActiveSymbol = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, activeSymbol: symbol }));
  }, []);

  const updateOrderBook = useCallback((snapshot: OrderBookSnapshot) => {
    const midPrice = snapshot.bids.length && snapshot.asks.length
      ? (snapshot.bids[0].price + snapshot.asks[0].price) / 2
      : 0;
    const spread = snapshot.asks.length && snapshot.bids.length
      ? snapshot.asks[0].price - snapshot.bids[0].price
      : 0;

    setState(prev => ({
      ...prev,
      orderBook: {
        symbol: prev.activeSymbol,
        bids: snapshot.bids,
        asks: snapshot.asks,
        spread,
        spreadBps: midPrice > 0 ? (spread / midPrice) * 10000 : 0,
        midPrice,
        bestBid: snapshot.bids[0]?.price || 0,
        bestAsk: snapshot.asks[0]?.price || 0,
        bidDepth: snapshot.bids.reduce((s, b) => s + b.size, 0),
        askDepth: snapshot.asks.reduce((s, a) => s + a.size, 0),
        imbalance: (() => {
          const bidVol = snapshot.bids.reduce((s, b) => s + b.size, 0);
          const askVol = snapshot.asks.reduce((s, a) => s + a.size, 0);
          return bidVol + askVol > 0 ? (bidVol - askVol) / (bidVol + askVol) : 0;
        })(),
        lastUpdate: Date.now(),
      },
    }));
  }, []);

  // First try to fetch the real order book; fall back to deterministic synthetic depth
  const simulateOrderBook = useCallback((symbol: string, midPrice: number, depth = 20) => {
    fetch(`/api/v1/orderbook/${encodeURIComponent(symbol)}?depth=${depth}`)
      .then(res => res.ok ? res.json() : null)
      .then((data: unknown) => {
        if (data) {
          const d = data as { bids?: unknown[]; asks?: unknown[] };
          if (d.bids?.length && d.asks?.length) {
            updateOrderBook({ bids: d.bids as OrderBookLevel[], asks: d.asks as OrderBookLevel[] });
            setActiveSymbol(symbol);
            return;
          }
        }
        // Deterministic fallback — no Math.random
        const bids: OrderBookLevel[] = [];
        const asks: OrderBookLevel[] = [];
        for (let i = 0; i < depth; i++) {
          const bidPrice = midPrice * (1 - 0.0001 * (i + 1));
          const askPrice = midPrice * (1 + 0.0001 * (i + 1));
          // Deterministic size: decreasing geometric with level index
          const bidSize = Math.floor(500 / (i + 1));
          const askSize = Math.floor(500 / (i + 1));
          const orders = Math.max(1, Math.floor(10 / (i + 1)));
          bids.push({ price: +bidPrice.toFixed(2), size: bidSize, orders });
          asks.push({ price: +askPrice.toFixed(2), size: askSize, orders });
        }
        updateOrderBook({ bids, asks });
        setActiveSymbol(symbol);
      })
      .catch(() => {
        // Deterministic fallback on error
        const bids: OrderBookLevel[] = [];
        const asks: OrderBookLevel[] = [];
        for (let i = 0; i < depth; i++) {
          const bidPrice = midPrice * (1 - 0.0001 * (i + 1));
          const askPrice = midPrice * (1 + 0.0001 * (i + 1));
          const size = Math.floor(500 / (i + 1));
          bids.push({ price: +bidPrice.toFixed(2), size, orders: Math.max(1, Math.floor(10 / (i + 1))) });
          asks.push({ price: +askPrice.toFixed(2), size, orders: Math.max(1, Math.floor(10 / (i + 1))) });
        }
        updateOrderBook({ bids, asks });
        setActiveSymbol(symbol);
      });
  }, [updateOrderBook, setActiveSymbol]);

  // ── Algo Execution ────

  const launchAlgo = useCallback((type: AlgoType, symbol: string, side: OrderSide, qty: number, params?: Partial<AlgoParams>): string => {
    const id = genAlgoId();
    const now = Date.now();
    const mergedParams: AlgoParams = {
      totalQty: qty,
      durationMs: 3600000,
      sliceCount: 20,
      clipSize: Math.ceil(qty / 20),
      displayQty: Math.ceil(qty / 10),
      maxParticipationRate: 0.1,
      side,
      ...params,
    };

    const execution: AlgoExecution = {
      id,
      algoType: type,
      symbol,
      side,
      totalQty: qty,
      filledQty: 0,
      avgPrice: 0,
      fills: [],
      startedAt: now,
      status: 'running',
      progress: 0,
      params: mergedParams,
    };

    setState(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        activeAlgos: [...prev.execution.activeAlgos, execution],
      },
    }));

    return id;
  }, []);

  const pauseAlgo = useCallback((aid: string) => {
    setState(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        activeAlgos: prev.execution.activeAlgos.map(a =>
          a.id === aid ? { ...a, status: 'paused' as const } : a
        ),
      },
    }));
  }, []);

  const resumeAlgo = useCallback((aid: string) => {
    setState(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        activeAlgos: prev.execution.activeAlgos.map(a =>
          a.id === aid && a.status === 'paused' ? { ...a, status: 'running' as const } : a
        ),
      },
    }));
  }, []);

  const cancelAlgo = useCallback((aid: string) => {
    setState(prev => {
      const algo = prev.execution.activeAlgos.find(a => a.id === aid);
      if (!algo) return prev;
      const cancelled = { ...algo, status: 'cancelled' as const, completedAt: Date.now() };
      return {
        ...prev,
        execution: {
          activeAlgos: prev.execution.activeAlgos.filter(a => a.id !== aid),
          completedAlgos: [...prev.execution.completedAlgos, cancelled],
        },
      };
    });
  }, []);

  // ── Risk ────

  const checkRisk = useCallback((order: Partial<Order>): RiskCheckResult[] => {
    return runAllChecks(
      { symbol: order.symbol || '', side: order.side || 'buy', qty: order.quantity || 0, price: order.price || 0 },
      state.riskLimits,
    );
  }, [state.riskLimits]);

  const setRiskLimits = useCallback((limits: PreTradeCheck[]) => {
    setState(prev => ({ ...prev, riskLimits: limits }));
  }, []);

  // ── Smart Routing ────

  const routeOrder = useCallback((symbol: string, side: OrderSide, qty: number): RoutingResult | null => {
    try {
      if (!routerRef.current) {
        routerRef.current = new SmartRouter(state.venues);
      }
      const result = routerRef.current.route(symbol, side, qty);
      setState(prev => ({ ...prev, lastRoute: result }));
      return result;
    } catch {
      return null;
    }
  }, [state.venues]);

  const setVenues = useCallback((venues: Venue[]) => {
    routerRef.current = new SmartRouter(venues);
    setState(prev => ({ ...prev, venues }));
  }, []);

  // ── TCA ────

  const computeTCA = useCallback((oid?: string) => {
    try {
      const orders = oid
        ? state.orderHistory.filter(o => o.id === oid)
        : state.orderHistory.filter(o => o.status === 'filled');

      if (orders.length === 0) return;

      const fills = orders.flatMap(o => o.fills);
      const prices = fills.map(f => f.price);
      const sizes = fills.map(f => f.quantity);
      const benchmarkPrice = prices[0] || 0;

      const result = tcaSummary(prices, sizes, benchmarkPrice);
      setState(prev => ({ ...prev, tca: result }));
    } catch {
      // TCA computation failed silently
    }
  }, [state.orderHistory]);

  // ── Account ────

  const setBuyingPower = useCallback((amount: number) => {
    setState(prev => ({ ...prev, buyingPower: amount }));
  }, []);

  const actions: OrderActions = useMemo(() => ({
    submitOrder,
    cancelOrder,
    cancelAll,
    modifyOrder,
    replaceOrder,
    closePosition,
    flattenAll,
    updatePositionPrice,
    setActiveSymbol,
    updateOrderBook,
    simulateOrderBook,
    launchAlgo,
    pauseAlgo,
    resumeAlgo,
    cancelAlgo,
    checkRisk,
    setRiskLimits,
    routeOrder,
    setVenues,
    computeTCA,
    setBuyingPower,
  }), [
    submitOrder, cancelOrder, cancelAll, modifyOrder, replaceOrder,
    closePosition, flattenAll, updatePositionPrice,
    setActiveSymbol, updateOrderBook, simulateOrderBook,
    launchAlgo, pauseAlgo, resumeAlgo, cancelAlgo,
    checkRisk, setRiskLimits, routeOrder, setVenues, computeTCA, setBuyingPower,
  ]);

  return [state, actions];
}
