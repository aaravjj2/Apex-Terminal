import {
  type Bar,
  type Order,
  type Trade,
  type Position,
  type BacktestConfig,
  type BacktestResult,
  type EquityPoint,
  type Strategy,
  type StrategyContext,
  type CommissionConfig,
  type SlippageConfig,
  type DividendEvent,
  type SplitEvent,
  type CorporateEvent,
  type EventHandler,
  type EngineEvent,
  OrderType,
  OrderStatus,
  Side,
  CommissionModel,
  SlippageModel,
  Timeframe,
} from './types';

// ─── Deterministic PRNG (xoshiro128**) ──────────────────────────────────────

class PRNG {
  private s: Uint32Array;

  constructor(seed: number) {
    this.s = new Uint32Array(4);
    this.s[0] = seed >>> 0;
    this.s[1] = (seed * 1812433253 + 1) >>> 0;
    this.s[2] = (this.s[1] * 1812433253 + 1) >>> 0;
    this.s[3] = (this.s[2] * 1812433253 + 1) >>> 0;
    for (let i = 0; i < 16; i++) this.next();
  }

  next(): number {
    const r = Math.imul(this.s[1] * 5, 7) >>> 0;
    const result = ((r << 9) | (r >>> 23)) * 9;
    const t = this.s[1] << 9;
    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];
    this.s[2] ^= t;
    this.s[3] = (this.s[3] << 11) | (this.s[3] >>> 21);
    return (result >>> 0) / 4294967296;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let globalOrderId = 0;

function generateOrderId(): string {
  return `ORD-${++globalOrderId}`;
}

let globalTradeId = 0;

function generateTradeId(): string {
  return `TRD-${++globalTradeId}`;
}

function timeframeMs(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    [Timeframe.M1]: 60_000,
    [Timeframe.M5]: 300_000,
    [Timeframe.M15]: 900_000,
    [Timeframe.M30]: 1_800_000,
    [Timeframe.H1]: 3_600_000,
    [Timeframe.H4]: 14_400_000,
    [Timeframe.D1]: 86_400_000,
    [Timeframe.W1]: 604_800_000,
    [Timeframe.MN]: 2_592_000_000,
  };
  return map[tf];
}

function resampleBars(bars: Bar[], targetTf: Timeframe): Bar[] {
  if (!bars.length) return [];
  const intervalMs = timeframeMs(targetTf);
  const resampled: Bar[] = [];
  let bucket: Bar | null = null;
  let bucketStart = 0;

  for (const bar of bars) {
    const start = Math.floor(bar.time / intervalMs) * intervalMs;
    if (!bucket || start !== bucketStart) {
      if (bucket) resampled.push(bucket);
      bucketStart = start;
      bucket = { ...bar, time: start };
    } else {
      bucket.high = Math.max(bucket.high, bar.high);
      bucket.low = Math.min(bucket.low, bar.low);
      bucket.close = bar.close;
      bucket.volume += bar.volume;
      if (bar.adjClose !== undefined) bucket.adjClose = bar.adjClose;
    }
  }
  if (bucket) resampled.push(bucket);
  return resampled;
}

function fillGaps(bars: Bar[], method: 'forward' | 'skip' | 'interpolate'): Bar[] {
  if (method === 'skip' || bars.length < 2) return bars.filter(b => isFinite(b.close) && b.close > 0);
  const filled: Bar[] = [];
  let lastValid: Bar | null = null;

  for (const bar of bars) {
    if (!isFinite(bar.close) || bar.close <= 0) {
      if (method === 'forward' && lastValid) {
        filled.push({ ...lastValid, time: bar.time, volume: 0 });
      }
      continue;
    }
    if (method === 'interpolate' && lastValid && filled.length > 0) {
      const gap = bar.time - lastValid.time;
      const tfMs = bars.length > 1 ? bars[1].time - bars[0].time : 86_400_000;
      const missingBars = Math.round(gap / tfMs) - 1;
      for (let i = 1; i <= missingBars; i++) {
        const frac = i / (missingBars + 1);
        const interpClose = lastValid.close + (bar.close - lastValid.close) * frac;
        filled.push({
          time: lastValid.time + i * tfMs,
          open: interpClose,
          high: interpClose,
          low: interpClose,
          close: interpClose,
          volume: 0,
        });
      }
    }
    filled.push(bar);
    lastValid = bar;
  }
  return filled;
}

// ─── Commission / Slippage Calculators ──────────────────────────────────────

function calcCommission(cfg: CommissionConfig, quantity: number, price: number, totalVolume: number): number {
  let comm = 0;
  switch (cfg.model) {
    case CommissionModel.PER_SHARE:
      comm = Math.abs(quantity) * (cfg.perShare ?? 0.005);
      break;
    case CommissionModel.PER_TRADE:
      comm = cfg.perTrade ?? 0;
      break;
    case CommissionModel.PERCENTAGE:
      comm = Math.abs(quantity) * price * (cfg.percentage ?? 0);
      break;
    case CommissionModel.TIERED: {
      if (!cfg.tiers?.length) break;
      let remaining = Math.abs(quantity);
      let prevMax = 0;
      for (const tier of cfg.tiers) {
        const tierQty = Math.min(remaining, tier.maxVolume - prevMax);
        if (tierQty <= 0) break;
        comm += tierQty * price * tier.rate;
        remaining -= tierQty;
        prevMax = tier.maxVolume;
      }
      if (remaining > 0) {
        const lastTier = cfg.tiers[cfg.tiers.length - 1];
        comm += remaining * price * lastTier.rate;
      }
      break;
    }
  }
  if (cfg.minPerTrade !== undefined) comm = Math.max(comm, cfg.minPerTrade);
  if (cfg.maxPerTrade !== undefined) comm = Math.min(comm, cfg.maxPerTrade);
  return comm;
}

function calcSlippage(
  cfg: SlippageConfig,
  price: number,
  quantity: number,
  side: Side,
  atr?: number,
  avgVolume?: number,
): number {
  const direction = side === Side.LONG ? 1 : -1;
  switch (cfg.model) {
    case SlippageModel.FIXED:
      return (cfg.fixedAmount ?? 0.01) * direction;
    case SlippageModel.PERCENTAGE:
      return price * (cfg.percentage ?? 0.001) * direction;
    case SlippageModel.VOLATILITY_BASED: {
      const vol = atr ?? price * 0.02;
      return vol * (cfg.volatilityFactor ?? 0.1) * direction;
    }
    case SlippageModel.MARKET_IMPACT: {
      const participation = avgVolume ? Math.abs(quantity) / avgVolume : 0.01;
      const exponent = cfg.impactExponent ?? 0.5;
      return price * 0.01 * Math.pow(participation, exponent) * direction;
    }
    default:
      return 0;
  }
}

// ─── BacktestEngine ─────────────────────────────────────────────────────────

export class BacktestEngine {
  private config: BacktestConfig;
  private strategy: Strategy;
  private paramValues: Record<string, number | boolean | string>;

  private cash: number;
  private positions: Map<string, Position> = new Map();
  private pendingOrders: Map<string, Order> = new Map();
  private filledOrders: Order[] = [];
  private trades: Trade[] = [];
  private equityCurve: EquityPoint[] = [];
  private barHistory: Map<string, Bar[]> = new Map();
  private currentBars: Map<string, Bar> = new Map();
  private barIndex = 0;
  private currentTime = 0;

  private totalCommission = 0;
  private totalSlippage = 0;
  private cumulativeVolume: Map<string, number> = new Map();

  private eventHandlers: EventHandler[] = [];
  private rng: PRNG;

  private openTrades: Map<string, {
    entryTime: number;
    entryPrice: number;
    entryOrderId: string;
    side: Side;
    quantity: number;
    reason?: string;
    tags?: string[];
    maxPrice: number;
    minPrice: number;
    bars: number;
  }> = new Map();

  constructor(
    config: BacktestConfig,
    strategy: Strategy,
    paramValues: Record<string, number | boolean | string>,
  ) {
    this.config = config;
    this.strategy = strategy;
    this.paramValues = paramValues;
    this.cash = config.initialCapital;
    this.rng = new PRNG(config.seed ?? 42);
    globalOrderId = 0;
    globalTradeId = 0;
  }

  on(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: EngineEvent): void {
    for (const h of this.eventHandlers) h(event);
  }

  // ─── Core Run ───────────────────────────────────────────────────────────

  run(
    data: Map<string, Bar[]>,
    corporateEvents?: Map<string, CorporateEvent>,
  ): BacktestResult {
    const startMs = performance.now();

    const prepared = new Map<string, Bar[]>();
    for (const [sym, bars] of data) {
      let filtered = bars.filter(b => b.time >= this.config.startDate && b.time <= this.config.endDate);
      filtered = fillGaps(filtered, this.config.dataGapFill);
      prepared.set(sym, filtered);
      this.barHistory.set(sym, []);
    }

    const timeline = this.buildTimeline(prepared);
    const ctx = this.buildContext();

    this.strategy.init(ctx, this.paramValues);

    for (let i = 0; i < timeline.length; i++) {
      const { time, bars: timeBars } = timeline[i];
      this.currentTime = time;
      this.barIndex = i;

      this.processCorporateEvents(time, corporateEvents);

      for (const { symbol, bar } of timeBars) {
        this.currentBars.set(symbol, bar);
        const history = this.barHistory.get(symbol)!;
        history.push(bar);
        this.updatePositionPrices(symbol, bar);
        this.processOrders(symbol, bar);
        this.emit({ type: 'bar', bar, symbol });
      }

      if (i >= this.config.warmupBars) {
        for (const { symbol, bar } of timeBars) {
          this.strategy.onBar(this.buildContext(), bar, symbol);
        }
      }

      this.checkMarginRequirements();
      this.recordEquity(time);
    }

    if (this.strategy.cleanup) {
      this.strategy.cleanup(this.buildContext());
    }

    this.closeAllPositions('backtest_end');
    this.recordEquity(this.currentTime);

    const executionTimeMs = performance.now() - startMs;

    return {
      config: this.config,
      strategyName: this.strategy.name,
      paramValues: this.paramValues,
      trades: this.trades,
      orders: this.filledOrders,
      equityCurve: this.equityCurve,
      drawdowns: this.computeDrawdownPeriods(),
      metrics: {} as any,
      monthlyReturns: [],
      dailyReturns: this.computeDailyReturns(),
      startTime: this.config.startDate,
      endTime: this.config.endDate,
      executionTimeMs,
    };
  }

  // ─── Timeline Builder ─────────────────────────────────────────────────

  private buildTimeline(data: Map<string, Bar[]>): { time: number; bars: { symbol: string; bar: Bar }[] }[] {
    const allTimes = new Set<number>();
    for (const bars of data.values()) {
      for (const bar of bars) allTimes.add(bar.time);
    }
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    const barIdx = new Map<string, number>();
    for (const sym of data.keys()) barIdx.set(sym, 0);

    const timeline: { time: number; bars: { symbol: string; bar: Bar }[] }[] = [];

    for (const time of sortedTimes) {
      const entry: { symbol: string; bar: Bar }[] = [];
      for (const [sym, bars] of data) {
        const idx = barIdx.get(sym)!;
        if (idx < bars.length && bars[idx].time === time) {
          entry.push({ symbol: sym, bar: bars[idx] });
          barIdx.set(sym, idx + 1);
        }
      }
      if (entry.length) timeline.push({ time, bars: entry });
    }

    return timeline;
  }

  // ─── Context Builder ──────────────────────────────────────────────────

  private buildContext(): StrategyContext {
    return {
      bars: this.barHistory,
      currentBar: this.currentBars,
      positions: new Map(this.positions),
      cash: this.cash,
      equity: this.getEquity(),
      barIndex: this.barIndex,
      timestamp: this.currentTime,
      submit: (partial) => this.submitOrder(partial),
      cancel: (id) => this.cancelOrder(id),
      cancelAll: (sym) => this.cancelAllOrders(sym),
      getPosition: (sym) => this.positions.get(sym),
      getOrders: (sym) => this.getOpenOrders(sym),
    };
  }

  // ─── Order Submission ─────────────────────────────────────────────────

  private submitOrder(
    partial: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'avgFillPrice' | 'commission' | 'slippage' | 'createdAt'>,
  ): string {
    if (partial.side === Side.SHORT && !this.config.allowShorting) {
      return '';
    }

    const id = generateOrderId();
    const order: Order = {
      ...partial,
      id,
      status: OrderStatus.PENDING,
      filledQuantity: 0,
      avgFillPrice: 0,
      commission: 0,
      slippage: 0,
      createdAt: this.currentTime,
    };

    const positionValue = Math.abs(partial.quantity) * (partial.price ?? this.currentBars.get(partial.symbol)?.close ?? 0);
    if (positionValue > this.getEquity() * this.config.maxPositionSize) {
      this.emit({ type: 'order_rejected', order, reason: 'exceeds_max_position_size' });
      return '';
    }

    if (partial.side === Side.LONG && !this.positions.has(partial.symbol)) {
      if (this.positions.size >= this.config.maxPositions) {
        const existingPos = this.positions.get(partial.symbol);
        if (!existingPos) {
          this.emit({ type: 'order_rejected', order, reason: 'max_positions_reached' });
          return '';
        }
      }
    }

    this.pendingOrders.set(id, order);
    this.emit({ type: 'order_submitted', order });
    return id;
  }

  private cancelOrder(id: string): boolean {
    const order = this.pendingOrders.get(id);
    if (!order) return false;
    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = this.currentTime;
    this.pendingOrders.delete(id);
    this.emit({ type: 'order_cancelled', order });
    return true;
  }

  private cancelAllOrders(symbol?: string): void {
    for (const [id, order] of this.pendingOrders) {
      if (!symbol || order.symbol === symbol) {
        this.cancelOrder(id);
      }
    }
  }

  private getOpenOrders(symbol?: string): Order[] {
    const orders: Order[] = [];
    for (const order of this.pendingOrders.values()) {
      if (!symbol || order.symbol === symbol) orders.push(order);
    }
    return orders;
  }

  // ─── Order Processing ─────────────────────────────────────────────────

  private processOrders(symbol: string, bar: Bar): void {
    const toFill: Order[] = [];

    for (const [, order] of this.pendingOrders) {
      if (order.symbol !== symbol) continue;

      switch (order.type) {
        case OrderType.MARKET:
          toFill.push(order);
          break;
        case OrderType.LIMIT:
          if (order.side === Side.LONG && bar.low <= (order.price ?? Infinity)) {
            toFill.push(order);
          } else if (order.side === Side.SHORT && bar.high >= (order.price ?? 0)) {
            toFill.push(order);
          }
          break;
        case OrderType.STOP:
          if (order.side === Side.LONG && bar.high >= (order.stopPrice ?? Infinity)) {
            toFill.push(order);
          } else if (order.side === Side.SHORT && bar.low <= (order.stopPrice ?? 0)) {
            toFill.push(order);
          }
          break;
        case OrderType.STOP_LIMIT:
          if (order.side === Side.LONG && bar.high >= (order.stopPrice ?? Infinity) && bar.low <= (order.limitPrice ?? Infinity)) {
            toFill.push(order);
          } else if (order.side === Side.SHORT && bar.low <= (order.stopPrice ?? 0) && bar.high >= (order.limitPrice ?? 0)) {
            toFill.push(order);
          }
          break;
        case OrderType.TRAILING_STOP: {
          const pos = this.positions.get(symbol);
          if (!pos) break;
          const trailAmt = order.trailingAmount ?? (order.trailingPercent ?? 0.02) * pos.maxPrice;
          if (pos.side === Side.LONG && bar.low <= pos.maxPrice - trailAmt) {
            toFill.push(order);
          } else if (pos.side === Side.SHORT && bar.high >= pos.minPrice + trailAmt) {
            toFill.push(order);
          }
          break;
        }
        case OrderType.BRACKET: {
          if (order.childIds?.length) break;
          toFill.push(order);
          break;
        }
        case OrderType.OCO: {
          if (order.price !== undefined && bar.low <= order.price) {
            toFill.push(order);
          } else if (order.stopPrice !== undefined && bar.high >= order.stopPrice) {
            toFill.push(order);
          }
          break;
        }
      }

      if (order.timeInForce === 'DAY' && bar.time > order.createdAt) {
        order.status = OrderStatus.EXPIRED;
        this.pendingOrders.delete(order.id);
      }
    }

    for (const order of toFill) {
      this.fillOrder(order, bar);
    }
  }

  private fillOrder(order: Order, bar: Bar): void {
    let fillPrice: number;
    switch (order.type) {
      case OrderType.LIMIT:
        fillPrice = order.price!;
        break;
      case OrderType.STOP:
        fillPrice = order.stopPrice!;
        break;
      case OrderType.STOP_LIMIT:
        fillPrice = order.limitPrice!;
        break;
      default:
        fillPrice = bar.open;
    }

    fillPrice = Math.max(bar.low, Math.min(bar.high, fillPrice));

    const avgVol = this.getAverageVolume(order.symbol, 20);
    const atr = this.getATR(order.symbol, 14);
    const slip = calcSlippage(this.config.slippage, fillPrice, order.quantity, order.side, atr, avgVol);
    fillPrice += slip;

    const volume = this.cumulativeVolume.get(order.symbol) ?? 0;
    const comm = calcCommission(this.config.commission, order.quantity, fillPrice, volume);

    const cost = Math.abs(order.quantity) * fillPrice + comm;
    if (order.side === Side.LONG && cost > this.cash) {
      this.emit({ type: 'order_rejected', order, reason: 'insufficient_cash' });
      order.status = OrderStatus.REJECTED;
      this.pendingOrders.delete(order.id);
      return;
    }

    order.status = OrderStatus.FILLED;
    order.filledQuantity = order.quantity;
    order.avgFillPrice = fillPrice;
    order.commission = comm;
    order.slippage = Math.abs(slip * order.quantity);
    order.filledAt = this.currentTime;

    this.totalCommission += comm;
    this.totalSlippage += Math.abs(slip * order.quantity);
    this.cumulativeVolume.set(order.symbol, volume + Math.abs(order.quantity));

    this.pendingOrders.delete(order.id);
    this.filledOrders.push(order);
    this.emit({ type: 'order_filled', order });

    this.updatePosition(order, fillPrice, comm);

    if (order.type === OrderType.OCO && order.childIds) {
      for (const childId of order.childIds) this.cancelOrder(childId);
    }

    if (this.strategy.onOrderFill) {
      this.strategy.onOrderFill(this.buildContext(), order);
    }
  }

  // ─── Position Management ──────────────────────────────────────────────

  private updatePosition(order: Order, fillPrice: number, commission: number): void {
    const existing = this.positions.get(order.symbol);

    if (!existing) {
      if (this.isClosingOrder(order)) return;

      const margin = Math.abs(order.quantity) * fillPrice * this.config.marginRequirement;
      const pos: Position = {
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        avgPrice: fillPrice,
        currentPrice: fillPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        maxPrice: fillPrice,
        minPrice: fillPrice,
        entryTime: this.currentTime,
        commission,
        margin,
      };
      this.positions.set(order.symbol, pos);

      if (order.side === Side.LONG) {
        this.cash -= Math.abs(order.quantity) * fillPrice + commission;
      } else {
        this.cash -= margin + commission;
      }

      this.openTrades.set(order.symbol, {
        entryTime: this.currentTime,
        entryPrice: fillPrice,
        entryOrderId: order.id,
        side: order.side,
        quantity: order.quantity,
        reason: order.reason,
        tags: order.tag ? [order.tag] : undefined,
        maxPrice: fillPrice,
        minPrice: fillPrice,
        bars: 0,
      });

      this.emit({ type: 'position_opened', position: pos });
    } else if (this.isSameSide(existing.side, order.side)) {
      const totalQty = Math.abs(existing.quantity) + Math.abs(order.quantity);
      existing.avgPrice = (existing.avgPrice * Math.abs(existing.quantity) + fillPrice * Math.abs(order.quantity)) / totalQty;
      existing.quantity = existing.side === Side.LONG ? totalQty : -totalQty;
      existing.commission += commission;

      if (existing.side === Side.LONG) {
        this.cash -= Math.abs(order.quantity) * fillPrice + commission;
      } else {
        this.cash -= Math.abs(order.quantity) * fillPrice * this.config.marginRequirement + commission;
      }

      existing.margin = Math.abs(existing.quantity) * existing.avgPrice * this.config.marginRequirement;

      const ot = this.openTrades.get(order.symbol);
      if (ot) {
        ot.quantity = existing.quantity;
      }
    } else {
      const closingQty = Math.min(Math.abs(order.quantity), Math.abs(existing.quantity));
      const remainingQty = Math.abs(order.quantity) - closingQty;

      let pnl: number;
      if (existing.side === Side.LONG) {
        pnl = (fillPrice - existing.avgPrice) * closingQty;
        this.cash += closingQty * fillPrice - commission;
      } else {
        pnl = (existing.avgPrice - fillPrice) * closingQty;
        this.cash += closingQty * existing.avgPrice * this.config.marginRequirement + pnl - commission;
      }

      existing.realizedPnl += pnl;

      const ot = this.openTrades.get(order.symbol);
      if (closingQty >= Math.abs(existing.quantity)) {
        const trade = this.recordTrade(order.symbol, existing, fillPrice, closingQty, order.id, commission, ot);
        this.positions.delete(order.symbol);
        this.openTrades.delete(order.symbol);
        this.emit({ type: 'position_closed', trade });

        if (this.strategy.onPositionClose) {
          this.strategy.onPositionClose(this.buildContext(), trade);
        }

        if (remainingQty > 0) {
          const flipOrder: Order = {
            ...order,
            id: generateOrderId(),
            quantity: remainingQty,
            status: OrderStatus.PENDING,
            filledQuantity: 0,
            avgFillPrice: 0,
            commission: 0,
            slippage: 0,
          };
          this.updatePosition(flipOrder, fillPrice, 0);
        }
      } else {
        const newQty = Math.abs(existing.quantity) - closingQty;
        existing.quantity = existing.side === Side.LONG ? newQty : -newQty;
        existing.commission += commission;
        existing.margin = Math.abs(existing.quantity) * existing.avgPrice * this.config.marginRequirement;
      }
    }
  }

  private isClosingOrder(order: Order): boolean {
    const pos = this.positions.get(order.symbol);
    if (!pos) return false;
    return (pos.side === Side.LONG && order.side === Side.SHORT) ||
           (pos.side === Side.SHORT && order.side === Side.LONG);
  }

  private isSameSide(posSide: Side, orderSide: Side): boolean {
    return posSide === orderSide;
  }

  private updatePositionPrices(symbol: string, bar: Bar): void {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    pos.currentPrice = bar.close;
    pos.maxPrice = Math.max(pos.maxPrice, bar.high);
    pos.minPrice = Math.min(pos.minPrice, bar.low);

    if (pos.side === Side.LONG) {
      pos.unrealizedPnl = (bar.close - pos.avgPrice) * Math.abs(pos.quantity);
    } else {
      pos.unrealizedPnl = (pos.avgPrice - bar.close) * Math.abs(pos.quantity);
    }

    const ot = this.openTrades.get(symbol);
    if (ot) {
      ot.maxPrice = Math.max(ot.maxPrice, bar.high);
      ot.minPrice = Math.min(ot.minPrice, bar.low);
      ot.bars++;
    }
  }

  private recordTrade(
    symbol: string,
    position: Position,
    exitPrice: number,
    quantity: number,
    exitOrderId: string,
    exitCommission: number,
    openTrade?: { entryTime: number; entryPrice: number; entryOrderId: string; side: Side; reason?: string; tags?: string[]; maxPrice: number; minPrice: number; bars: number } | null,
  ): Trade {
    const entryPrice = position.avgPrice;
    const side = position.side;
    let pnl: number;
    let mae: number;
    let mfe: number;

    if (side === Side.LONG) {
      pnl = (exitPrice - entryPrice) * quantity;
      mae = (entryPrice - (openTrade?.minPrice ?? position.minPrice)) * quantity;
      mfe = ((openTrade?.maxPrice ?? position.maxPrice) - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - exitPrice) * quantity;
      mae = ((openTrade?.maxPrice ?? position.maxPrice) - entryPrice) * quantity;
      mfe = (entryPrice - (openTrade?.minPrice ?? position.minPrice)) * quantity;
    }

    const totalComm = position.commission + exitCommission;
    const netPnl = pnl - totalComm;
    const entryTime = openTrade?.entryTime ?? position.entryTime;
    const duration = this.currentTime - entryTime;

    const trade: Trade = {
      id: generateTradeId(),
      symbol,
      side,
      entryTime,
      exitTime: this.currentTime,
      entryPrice,
      exitPrice,
      quantity,
      pnl: netPnl,
      pnlPercent: (netPnl / (entryPrice * quantity)) * 100,
      commission: totalComm,
      slippage: 0,
      mae,
      mfe,
      duration,
      entryReason: openTrade?.reason,
      tags: openTrade?.tags,
      bars: openTrade?.bars ?? 0,
      entryOrderId: openTrade?.entryOrderId ?? '',
      exitOrderId,
    };

    this.trades.push(trade);
    return trade;
  }

  // ─── Corporate Events ─────────────────────────────────────────────────

  private processCorporateEvents(time: number, events?: Map<string, CorporateEvent>): void {
    if (!events) return;

    for (const [symbol, ce] of events) {
      for (const div of ce.dividends) {
        if (div.exDate === time) {
          this.handleDividend(symbol, div);
        }
      }
      for (const split of ce.splits) {
        if (split.time === time) {
          this.handleSplit(symbol, split);
        }
      }
    }
  }

  private handleDividend(symbol: string, div: DividendEvent): void {
    const pos = this.positions.get(symbol);
    if (!pos || pos.side !== Side.LONG) return;

    const amount = div.amount * Math.abs(pos.quantity);
    if (this.config.reinvestDividends) {
      this.cash += amount;
    } else {
      this.cash += amount;
    }
    this.emit({ type: 'dividend', event: div, position: pos });
  }

  private handleSplit(symbol: string, split: SplitEvent): void {
    const pos = this.positions.get(symbol);
    if (!pos) return;

    const oldQty = pos.quantity;
    pos.quantity = Math.round(pos.quantity * split.ratio);
    pos.avgPrice = pos.avgPrice / split.ratio;
    pos.currentPrice = pos.currentPrice / split.ratio;
    pos.maxPrice = pos.maxPrice / split.ratio;
    pos.minPrice = pos.minPrice / split.ratio;

    const history = this.barHistory.get(symbol);
    if (history) {
      for (const bar of history) {
        bar.open /= split.ratio;
        bar.high /= split.ratio;
        bar.low /= split.ratio;
        bar.close /= split.ratio;
        bar.volume *= split.ratio;
      }
    }

    this.emit({ type: 'split', event: split, position: pos });
  }

  // ─── Margin ───────────────────────────────────────────────────────────

  private checkMarginRequirements(): void {
    for (const [, pos] of this.positions) {
      if (pos.side !== Side.SHORT) continue;
      const requiredMargin = Math.abs(pos.quantity) * pos.currentPrice * this.config.marginRequirement;
      if (requiredMargin > this.cash + pos.margin) {
        this.emit({ type: 'margin_call', position: pos, requiredMargin });
      }
    }
  }

  // ─── Equity ───────────────────────────────────────────────────────────

  private getEquity(): number {
    let equity = this.cash;
    for (const [, pos] of this.positions) {
      if (pos.side === Side.LONG) {
        equity += Math.abs(pos.quantity) * pos.currentPrice;
      } else {
        equity += pos.margin + pos.unrealizedPnl;
      }
    }
    return equity;
  }

  private getPositionValue(): number {
    let val = 0;
    for (const [, pos] of this.positions) {
      val += Math.abs(pos.quantity) * pos.currentPrice;
    }
    return val;
  }

  private recordEquity(time: number): void {
    const equity = this.getEquity();
    const posVal = this.getPositionValue();
    let maxEquity = this.config.initialCapital;
    for (const ep of this.equityCurve) {
      if (ep.equity > maxEquity) maxEquity = ep.equity;
    }
    if (equity > maxEquity) maxEquity = equity;
    const dd = maxEquity - equity;
    const ddPct = maxEquity > 0 ? (dd / maxEquity) * 100 : 0;

    this.equityCurve.push({
      time,
      equity,
      cash: this.cash,
      positionValue: posVal,
      drawdown: dd,
      drawdownPercent: ddPct,
    });
  }

  private computeDrawdownPeriods(): import('./types').DrawdownPeriod[] {
    const periods: import('./types').DrawdownPeriod[] = [];
    let peak = this.config.initialCapital;
    let inDrawdown = false;
    let ddStart = 0;
    let maxDepth = 0;
    let maxDepthPct = 0;

    for (const ep of this.equityCurve) {
      if (ep.equity >= peak) {
        if (inDrawdown) {
          periods.push({
            start: ddStart,
            end: ep.time,
            recovered: ep.time,
            depth: maxDepth,
            depthPercent: maxDepthPct,
            duration: ep.time - ddStart,
            recoveryDuration: ep.time - ddStart,
          });
          inDrawdown = false;
          maxDepth = 0;
          maxDepthPct = 0;
        }
        peak = ep.equity;
      } else {
        if (!inDrawdown) {
          ddStart = ep.time;
          inDrawdown = true;
        }
        const depth = peak - ep.equity;
        const depthPct = (depth / peak) * 100;
        if (depth > maxDepth) {
          maxDepth = depth;
          maxDepthPct = depthPct;
        }
      }
    }

    if (inDrawdown) {
      const lastTime = this.equityCurve[this.equityCurve.length - 1]?.time ?? 0;
      periods.push({
        start: ddStart,
        end: lastTime,
        recovered: null,
        depth: maxDepth,
        depthPercent: maxDepthPct,
        duration: lastTime - ddStart,
        recoveryDuration: null,
      });
    }

    return periods;
  }

  private computeDailyReturns(): number[] {
    if (this.equityCurve.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prev = this.equityCurve[i - 1].equity;
      const curr = this.equityCurve[i].equity;
      returns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    return returns;
  }

  // ─── Close All ────────────────────────────────────────────────────────

  private closeAllPositions(reason: string): void {
    for (const [symbol, pos] of this.positions) {
      const closeSide = pos.side === Side.LONG ? Side.SHORT : Side.LONG;
      const bar = this.currentBars.get(symbol);
      if (!bar) continue;

      const orderId = generateOrderId();
      const order: Order = {
        id: orderId,
        symbol,
        type: OrderType.MARKET,
        side: closeSide,
        quantity: Math.abs(pos.quantity),
        timeInForce: 'GTC',
        status: OrderStatus.PENDING,
        filledQuantity: 0,
        avgFillPrice: 0,
        commission: 0,
        slippage: 0,
        createdAt: this.currentTime,
        reason,
      };
      this.fillOrder(order, bar);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  private getAverageVolume(symbol: string, period: number): number {
    const history = this.barHistory.get(symbol);
    if (!history || !history.length) return 0;
    const slice = history.slice(-period);
    return slice.reduce((s, b) => s + b.volume, 0) / slice.length;
  }

  private getATR(symbol: string, period: number): number {
    const history = this.barHistory.get(symbol);
    if (!history || history.length < 2) return 0;
    const slice = history.slice(-(period + 1));
    let sum = 0;
    let count = 0;
    for (let i = 1; i < slice.length; i++) {
      const tr = Math.max(
        slice[i].high - slice[i].low,
        Math.abs(slice[i].high - slice[i - 1].close),
        Math.abs(slice[i].low - slice[i - 1].close),
      );
      sum += tr;
      count++;
    }
    return count > 0 ? sum / count : 0;
  }

  // ─── Static Helpers ───────────────────────────────────────────────────

  static resample(bars: Bar[], targetTimeframe: Timeframe): Bar[] {
    return resampleBars(bars, targetTimeframe);
  }
}
