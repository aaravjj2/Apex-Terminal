/**
 * OrderExecutionService — manages order routing, execution, and lifecycle.
 *
 * Provides: order submission, validation, risk checking, smart routing,
 * fill simulation, position management, TCA, algo execution.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | 'iceberg' | 'twap' | 'vwap';
export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  trailingAmount?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  filledAt?: number;
  avgFillPrice?: number;
  commission: number;
  route?: string;
  algo?: string;
  parentId?: string;
  tags: string[];
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  commission: number;
  exchange: string;
  timestamp: number;
  liquidity: 'add' | 'remove';
}

export interface Position {
  symbol: string;
  side: 'long' | 'short' | 'flat';
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  openedAt: number;
  lastUpdated: number;
}

export interface RiskCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ExecutionConfig {
  maxOrderSize: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  requireConfirmation: boolean;
  enableRiskChecks: boolean;
  defaultTif: TimeInForce;
  commissionRate: number;
  slippageBps: number;
}

// ── Risk Check Engine ────────────────────────────────────────────────────────

class RiskCheckEngine {
  private config: ExecutionConfig;
  private positions: Map<string, Position>;
  private dailyPnl: number;

  constructor(config: ExecutionConfig, positions: Map<string, Position>) {
    this.config = config;
    this.positions = positions;
    this.dailyPnl = 0;
  }

  check(order: Partial<Order>): RiskCheck[] {
    const checks: RiskCheck[] = [];

    // Size check
    if (order.quantity && order.quantity > this.config.maxOrderSize) {
      checks.push({
        name: 'Max Order Size',
        passed: false,
        message: `Order quantity ${order.quantity} exceeds max ${this.config.maxOrderSize}`,
        severity: 'error',
      });
    } else {
      checks.push({ name: 'Max Order Size', passed: true, message: 'OK', severity: 'info' });
    }

    // Position size check
    const pos = this.positions.get(order.symbol || '');
    const newQty = (pos?.quantity || 0) + (order.side === 'buy' ? 1 : -1) * (order.quantity || 0);
    if (Math.abs(newQty) > this.config.maxPositionSize) {
      checks.push({
        name: 'Max Position Size',
        passed: false,
        message: `Resulting position ${Math.abs(newQty)} exceeds max ${this.config.maxPositionSize}`,
        severity: 'error',
      });
    } else {
      checks.push({ name: 'Max Position Size', passed: true, message: 'OK', severity: 'info' });
    }

    // Daily loss check
    if (this.dailyPnl < -this.config.maxDailyLoss) {
      checks.push({
        name: 'Daily Loss Limit',
        passed: false,
        message: `Daily loss $${Math.abs(this.dailyPnl).toFixed(2)} exceeds max $${this.config.maxDailyLoss}`,
        severity: 'error',
      });
    } else {
      checks.push({ name: 'Daily Loss Limit', passed: true, message: 'OK', severity: 'info' });
    }

    // Notional check
    const notional = (order.quantity || 0) * (order.price || 0);
    if (notional > 1000000) {
      checks.push({
        name: 'Large Notional',
        passed: true,
        message: `Large order notional: $${notional.toLocaleString()}`,
        severity: 'warning',
      });
    }

    // Market order warning
    if (order.type === 'market') {
      checks.push({
        name: 'Market Order',
        passed: true,
        message: 'Market order may experience slippage',
        severity: 'warning',
      });
    }

    return checks;
  }

  updateDailyPnl(pnl: number): void {
    this.dailyPnl = pnl;
  }
}

// ── Smart Router ─────────────────────────────────────────────────────────────

interface Venue {
  id: string;
  name: string;
  type: 'exchange' | 'dark_pool' | 'ecn';
  rebateAdd: number;    // bps
  feesRemove: number;   // bps
  latency: number;      // ms
  fillRate: number;      // 0-1
}

const DEFAULT_VENUES: Venue[] = [
  { id: 'nyse', name: 'NYSE', type: 'exchange', rebateAdd: 0.2, feesRemove: 0.3, latency: 1, fillRate: 0.95 },
  { id: 'nasdaq', name: 'NASDAQ', type: 'exchange', rebateAdd: 0.25, feesRemove: 0.35, latency: 0.8, fillRate: 0.92 },
  { id: 'arca', name: 'NYSE Arca', type: 'exchange', rebateAdd: 0.15, feesRemove: 0.25, latency: 1.2, fillRate: 0.90 },
  { id: 'bats', name: 'BATS', type: 'exchange', rebateAdd: 0.3, feesRemove: 0.28, latency: 0.5, fillRate: 0.88 },
  { id: 'iex', name: 'IEX', type: 'exchange', rebateAdd: 0, feesRemove: 0.09, latency: 2, fillRate: 0.85 },
  { id: 'sig_x', name: 'Sigma-X', type: 'dark_pool', rebateAdd: 0, feesRemove: 0.1, latency: 3, fillRate: 0.40 },
  { id: 'cross_finder', name: 'CrossFinder', type: 'dark_pool', rebateAdd: 0, feesRemove: 0.08, latency: 4, fillRate: 0.35 },
];

class SmartRouter {
  private venues: Venue[];

  constructor(venues?: Venue[]) {
    this.venues = venues || DEFAULT_VENUES;
  }

  route(order: Partial<Order>): { venue: Venue; allocation: number }[] {
    const sorted = [...this.venues].sort((a, b) => {
      // Score: lower fees + higher fill rate
      const scoreA = a.fillRate * 100 - a.feesRemove + (order.type === 'limit' ? a.rebateAdd : 0);
      const scoreB = b.fillRate * 100 - b.feesRemove + (order.type === 'limit' ? b.rebateAdd : 0);
      return scoreB - scoreA;
    });

    // Split across top venues
    const qty = order.quantity || 100;
    const result: { venue: Venue; allocation: number }[] = [];

    if (qty <= 500) {
      // Small order → single venue
      result.push({ venue: sorted[0], allocation: 1 });
    } else {
      // Large order → split
      result.push({ venue: sorted[0], allocation: 0.5 });
      result.push({ venue: sorted[1], allocation: 0.3 });
      if (sorted.length > 2) result.push({ venue: sorted[2], allocation: 0.2 });
    }

    return result;
  }
}

// ── Fill Simulator ───────────────────────────────────────────────────────────

class FillSimulator {
  private config: ExecutionConfig;

  constructor(config: ExecutionConfig) {
    this.config = config;
  }

  simulateFill(order: Order, currentPrice: number): Fill | null {
    let fillPrice: number;
    const slippageFactor = this.config.slippageBps / 10000;

    switch (order.type) {
      case 'market':
        fillPrice = order.side === 'buy'
          ? currentPrice * (1 + slippageFactor)
          : currentPrice * (1 - slippageFactor);
        break;
      case 'limit':
        if (order.side === 'buy' && currentPrice > (order.price || 0)) return null;
        if (order.side === 'sell' && currentPrice < (order.price || 0)) return null;
        fillPrice = order.price || currentPrice;
        break;
      case 'stop':
        if (order.side === 'buy' && currentPrice < (order.stopPrice || 0)) return null;
        if (order.side === 'sell' && currentPrice > (order.stopPrice || 0)) return null;
        fillPrice = currentPrice * (1 + (order.side === 'buy' ? 1 : -1) * slippageFactor);
        break;
      default:
        fillPrice = currentPrice;
    }

    const commission = fillPrice * (order.quantity - order.filledQuantity) * (this.config.commissionRate / 10000);

    return {
      id: `fill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      price: +fillPrice.toFixed(2),
      quantity: order.quantity - order.filledQuantity,
      commission: +commission.toFixed(4),
      exchange: DEFAULT_VENUES[Math.floor(Math.random() * DEFAULT_VENUES.length)].name,
      timestamp: Date.now(),
      liquidity: order.type === 'limit' ? 'add' : 'remove',
    };
  }
}

// ── TCA (Transaction Cost Analysis) ──────────────────────────────────────────

export interface TCAResult {
  orderId: string;
  slippage: number;         // bps
  marketImpact: number;     // bps
  timingCost: number;       // bps
  totalCost: number;        // bps
  vwapDeviation: number;    // bps
  implementationShortfall: number; // absolute $
  arrivalPriceDev: number;  // bps
}

class TransactionCostAnalyzer {
  analyze(order: Order, fills: Fill[], arrivalPrice: number): TCAResult {
    const avgFillPrice = fills.reduce((s, f) => s + f.price * f.quantity, 0) /
                         fills.reduce((s, f) => s + f.quantity, 0);
    const direction = order.side === 'buy' ? 1 : -1;
    const slippage = direction * ((avgFillPrice - arrivalPrice) / arrivalPrice) * 10000;
    const totalQty = fills.reduce((s, f) => s + f.quantity, 0);

    return {
      orderId: order.id,
      slippage: +slippage.toFixed(2),
      marketImpact: +(slippage * 0.6).toFixed(2),
      timingCost: +(slippage * 0.3).toFixed(2),
      totalCost: +slippage.toFixed(2),
      vwapDeviation: +((Math.random() - 0.5) * 5).toFixed(2),
      implementationShortfall: +((avgFillPrice - arrivalPrice) * totalQty * direction).toFixed(2),
      arrivalPriceDev: +((avgFillPrice / arrivalPrice - 1) * 10000).toFixed(2),
    };
  }
}

// ── Order Execution Service ──────────────────────────────────────────────────

export class OrderExecutionService {
  private config: ExecutionConfig;
  private orders: Map<string, Order> = new Map();
  private fills: Map<string, Fill[]> = new Map();
  private positions: Map<string, Position> = new Map();
  private riskEngine: RiskCheckEngine;
  private router: SmartRouter;
  private fillSim: FillSimulator;
  private tca: TransactionCostAnalyzer;
  private orderCounter = 0;
  private listeners: Map<string, Array<(event: string, data: any) => void>> = new Map();

  constructor(config?: Partial<ExecutionConfig>) {
    this.config = {
      maxOrderSize: 10000,
      maxPositionSize: 50000,
      maxDailyLoss: 25000,
      maxDrawdown: 0.1,
      requireConfirmation: false,
      enableRiskChecks: true,
      defaultTif: 'day',
      commissionRate: 0.1,      // bps
      slippageBps: 2,
      ...config,
    };
    this.riskEngine = new RiskCheckEngine(this.config, this.positions);
    this.router = new SmartRouter();
    this.fillSim = new FillSimulator(this.config);
    this.tca = new TransactionCostAnalyzer();
  }

  submitOrder(params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: TimeInForce;
    tags?: string[];
  }): { order: Order; riskChecks: RiskCheck[] } {
    const id = `ord_${++this.orderCounter}_${Date.now().toString(36)}`;

    const order: Order = {
      id,
      clientOrderId: id,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      filledQuantity: 0,
      price: params.price,
      stopPrice: params.stopPrice,
      timeInForce: params.timeInForce || this.config.defaultTif,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      commission: 0,
      tags: params.tags || [],
    };

    // Risk checks
    const riskChecks = this.config.enableRiskChecks ? this.riskEngine.check(order) : [];
    const hasError = riskChecks.some(c => !c.passed && c.severity === 'error');

    if (hasError) {
      order.status = 'rejected';
      this.orders.set(id, order);
      this.emit('orderRejected', order);
      return { order, riskChecks };
    }

    // Route order
    const routes = this.router.route(order);
    order.route = routes.map(r => `${r.venue.name}:${Math.round(r.allocation * 100)}%`).join(', ');
    order.status = 'submitted';
    this.orders.set(id, order);
    this.emit('orderSubmitted', order);

    // Simulate immediate fill for market orders
    if (params.type === 'market') {
      setTimeout(() => this.simulateFill(id, params.price || 100), 50 + Math.random() * 200);
    }

    return { order, riskChecks };
  }

  private simulateFill(orderId: string, currentPrice: number): void {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'filled' || order.status === 'cancelled') return;

    const fill = this.fillSim.simulateFill(order, currentPrice);
    if (!fill) return;

    // Update order
    order.filledQuantity += fill.quantity;
    order.avgFillPrice = fill.price;
    order.commission += fill.commission;
    order.status = order.filledQuantity >= order.quantity ? 'filled' : 'partial';
    order.updatedAt = Date.now();
    if (order.status === 'filled') order.filledAt = Date.now();

    // Store fill
    if (!this.fills.has(orderId)) this.fills.set(orderId, []);
    this.fills.get(orderId)!.push(fill);

    // Update position
    this.updatePosition(fill);

    this.orders.set(orderId, order);
    this.emit('orderFilled', { order, fill });
  }

  private updatePosition(fill: Fill): void {
    const pos = this.positions.get(fill.symbol) || {
      symbol: fill.symbol,
      side: 'flat' as const,
      quantity: 0,
      avgCost: 0,
      currentPrice: fill.price,
      marketValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      realizedPnl: 0,
      openedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    const direction = fill.side === 'buy' ? 1 : -1;
    const oldQty = pos.quantity;
    const newQty = oldQty + direction * fill.quantity;

    if (Math.sign(oldQty) === direction || oldQty === 0) {
      // Adding to position
      pos.avgCost = oldQty === 0 ? fill.price : (pos.avgCost * Math.abs(oldQty) + fill.price * fill.quantity) / (Math.abs(oldQty) + fill.quantity);
    } else {
      // Reducing/closing position
      const closedQty = Math.min(Math.abs(oldQty), fill.quantity);
      pos.realizedPnl += (fill.price - pos.avgCost) * closedQty * Math.sign(oldQty);
    }

    pos.quantity = newQty;
    pos.side = newQty > 0 ? 'long' : newQty < 0 ? 'short' : 'flat';
    pos.currentPrice = fill.price;
    pos.marketValue = Math.abs(newQty) * fill.price;
    pos.unrealizedPnl = (fill.price - pos.avgCost) * newQty;
    pos.unrealizedPnlPct = pos.avgCost > 0 ? (fill.price / pos.avgCost - 1) * 100 * Math.sign(newQty) : 0;
    pos.lastUpdated = Date.now();

    if (newQty === 0) {
      this.positions.delete(fill.symbol);
    } else {
      this.positions.set(fill.symbol, pos);
    }
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'filled' || order.status === 'cancelled') return false;
    order.status = 'cancelled';
    order.updatedAt = Date.now();
    this.emit('orderCancelled', order);
    return true;
  }

  cancelAll(symbol?: string): number {
    let count = 0;
    this.orders.forEach(order => {
      if ((!symbol || order.symbol === symbol) && (order.status === 'pending' || order.status === 'submitted' || order.status === 'partial')) {
        order.status = 'cancelled';
        order.updatedAt = Date.now();
        count++;
      }
    });
    return count;
  }

  flattenPosition(symbol: string, currentPrice: number): Order | null {
    const pos = this.positions.get(symbol);
    if (!pos || pos.quantity === 0) return null;
    const { order } = this.submitOrder({
      symbol,
      side: pos.quantity > 0 ? 'sell' : 'buy',
      type: 'market',
      quantity: Math.abs(pos.quantity),
      price: currentPrice,
    });
    return order;
  }

  flattenAll(currentPrices: Map<string, number>): Order[] {
    const orders: Order[] = [];
    this.positions.forEach((pos, symbol) => {
      const price = currentPrices.get(symbol) || pos.currentPrice;
      const order = this.flattenPosition(symbol, price);
      if (order) orders.push(order);
    });
    return orders;
  }

  getOrder(id: string): Order | undefined { return this.orders.get(id); }
  getOrders(): Order[] { return Array.from(this.orders.values()); }
  getOpenOrders(): Order[] { return this.getOrders().filter(o => o.status === 'pending' || o.status === 'submitted' || o.status === 'partial'); }
  getFilledOrders(): Order[] { return this.getOrders().filter(o => o.status === 'filled'); }
  getFills(orderId: string): Fill[] { return this.fills.get(orderId) || []; }
  getAllFills(): Fill[] { return Array.from(this.fills.values()).flat(); }
  getPosition(symbol: string): Position | undefined { return this.positions.get(symbol); }
  getPositions(): Position[] { return Array.from(this.positions.values()); }

  analyzeTCA(orderId: string, arrivalPrice: number): TCAResult | null {
    const order = this.orders.get(orderId);
    const fills = this.fills.get(orderId);
    if (!order || !fills || fills.length === 0) return null;
    return this.tca.analyze(order, fills, arrivalPrice);
  }

  updateConfig(config: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...config };
    this.fillSim = new FillSimulator(this.config);
  }

  on(event: string, callback: (event: string, data: any) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
    return () => {
      const arr = this.listeners.get(event);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(event, data));
    this.listeners.get('*')?.forEach(cb => cb(event, data));
  }

  reset(): void {
    this.orders.clear();
    this.fills.clear();
    this.positions.clear();
    this.orderCounter = 0;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: OrderExecutionService | null = null;

export function getOrderExecutionService(config?: Partial<ExecutionConfig>): OrderExecutionService {
  if (!instance) instance = new OrderExecutionService(config);
  return instance;
}

export function resetOrderExecutionService(): void {
  if (instance) { instance.reset(); instance = null; }
}

export default OrderExecutionService;
