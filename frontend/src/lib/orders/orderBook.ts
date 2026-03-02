import {
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  OrderBookEntry,
  OrderBookSnapshot,
  OrderBookDelta,
  Level2Data,
  Fill,
  Venue,
} from './types';

// ─── Price Level ─────────────────────────────────────────────────────────────

class PriceLevel {
  readonly price: number;
  private _orders: Array<{ orderId: string; quantity: number; timestamp: number }> = [];

  constructor(price: number) {
    this.price = price;
  }

  get totalQuantity(): number {
    return this._orders.reduce((sum, o) => sum + o.quantity, 0);
  }

  get orderCount(): number {
    return this._orders.length;
  }

  get orders(): Array<{ orderId: string; quantity: number; timestamp: number }> {
    return [...this._orders];
  }

  addOrder(orderId: string, quantity: number, timestamp: number): void {
    this._orders.push({ orderId, quantity, timestamp });
  }

  removeOrder(orderId: string): boolean {
    const idx = this._orders.findIndex((o) => o.orderId === orderId);
    if (idx === -1) return false;
    this._orders.splice(idx, 1);
    return true;
  }

  modifyOrder(orderId: string, newQuantity: number): boolean {
    const order = this._orders.find((o) => o.orderId === orderId);
    if (!order) return false;
    order.quantity = newQuantity;
    return true;
  }

  /** Returns fills consumed from this level in time priority. Mutates internal state. */
  matchAgainst(incomingQty: number, incomingSide: OrderSide, venue: Venue): { fills: Fill[]; filledQty: number } {
    const fills: Fill[] = [];
    let remaining = incomingQty;

    while (remaining > 0 && this._orders.length > 0) {
      const resting = this._orders[0];
      const fillQty = Math.min(remaining, resting.quantity);

      fills.push({
        id: crypto.randomUUID(),
        orderId: resting.orderId,
        executionId: crypto.randomUUID(),
        symbol: '',
        side: incomingSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
        quantity: fillQty,
        price: this.price,
        commission: 0,
        venue,
        liquidity: 'ADD',
        timestamp: Date.now(),
      });

      resting.quantity -= fillQty;
      remaining -= fillQty;

      if (resting.quantity <= 0) {
        this._orders.shift();
      }
    }

    return { fills, filledQty: incomingQty - remaining };
  }

  toEntry(): OrderBookEntry {
    return {
      price: this.price,
      quantity: this.totalQuantity,
      orderCount: this.orderCount,
      orders: this.orders,
    };
  }
}

// ─── Order Book ──────────────────────────────────────────────────────────────

export class OrderBook {
  readonly symbol: string;
  private bids: Map<number, PriceLevel> = new Map();
  private asks: Map<number, PriceLevel> = new Map();
  private orderIndex: Map<string, { side: 'BID' | 'ASK'; price: number }> = new Map();
  private lastTradePrice = 0;
  private lastTradeSize = 0;
  private sequenceNumber = 0;
  private tradeHistory: Array<{ price: number; size: number; timestamp: number; aggressor: OrderSide }> = [];

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  // ── Sorted levels ──────────────────────────────────────────────────────────

  private sortedBidPrices(): number[] {
    return [...this.bids.keys()].sort((a, b) => b - a);
  }

  private sortedAskPrices(): number[] {
    return [...this.asks.keys()].sort((a, b) => a - b);
  }

  get bestBid(): number | undefined {
    const prices = this.sortedBidPrices();
    return prices.length > 0 ? prices[0] : undefined;
  }

  get bestAsk(): number | undefined {
    const prices = this.sortedAskPrices();
    return prices.length > 0 ? prices[0] : undefined;
  }

  get spread(): number {
    const bb = this.bestBid;
    const ba = this.bestAsk;
    if (bb === undefined || ba === undefined) return Infinity;
    return ba - bb;
  }

  get midPrice(): number {
    const bb = this.bestBid;
    const ba = this.bestAsk;
    if (bb === undefined || ba === undefined) return this.lastTradePrice;
    return (bb + ba) / 2;
  }

  // ── Add Order ──────────────────────────────────────────────────────────────

  addOrder(order: Order): { fills: Fill[]; remainingQty: number } {
    const isBuy = order.side === OrderSide.BUY || order.side === OrderSide.BUY_TO_COVER;
    const fills: Fill[] = [];
    let remainingQty = order.remainingQuantity;

    if (order.type === OrderType.MARKET || order.type === OrderType.IOC || order.type === OrderType.FOK) {
      const result = this.matchMarketOrder(order, remainingQty, isBuy);
      fills.push(...result.fills);
      remainingQty = result.remainingQty;

      if (order.type === OrderType.FOK && remainingQty > 0) {
        return { fills: [], remainingQty: order.remainingQuantity };
      }
      return { fills, remainingQty };
    }

    if (order.type === OrderType.LIMIT || order.type === OrderType.GTC) {
      const limitPrice = order.price ?? order.limitPrice;
      if (limitPrice === undefined) {
        return { fills: [], remainingQty };
      }

      const crossResult = this.matchLimitOrder(order, remainingQty, isBuy, limitPrice);
      fills.push(...crossResult.fills);
      remainingQty = crossResult.remainingQty;

      if (remainingQty > 0) {
        this.restOrder(order.id, isBuy ? 'BID' : 'ASK', limitPrice, remainingQty, order.createdAt);
      }

      return { fills, remainingQty };
    }

    if (order.type === OrderType.STOP || order.type === OrderType.STOP_LIMIT) {
      const stopPrice = order.stopPrice;
      if (stopPrice === undefined) return { fills: [], remainingQty };

      const triggered = isBuy
        ? this.lastTradePrice >= stopPrice
        : this.lastTradePrice <= stopPrice;

      if (triggered) {
        if (order.type === OrderType.STOP) {
          const result = this.matchMarketOrder(order, remainingQty, isBuy);
          return { fills: result.fills, remainingQty: result.remainingQty };
        }
        const limitPrice = order.limitPrice ?? order.price;
        if (limitPrice === undefined) return { fills: [], remainingQty };
        const result = this.matchLimitOrder(order, remainingQty, isBuy, limitPrice);
        if (result.remainingQty > 0) {
          this.restOrder(order.id, isBuy ? 'BID' : 'ASK', limitPrice, result.remainingQty, order.createdAt);
        }
        return { fills: result.fills, remainingQty: result.remainingQty };
      }

      const restPrice = order.type === OrderType.STOP_LIMIT
        ? (order.limitPrice ?? order.price ?? stopPrice)
        : stopPrice;
      this.restOrder(order.id, isBuy ? 'BID' : 'ASK', restPrice, remainingQty, order.createdAt);
      return { fills: [], remainingQty };
    }

    if (order.price !== undefined) {
      this.restOrder(order.id, isBuy ? 'BID' : 'ASK', order.price, remainingQty, order.createdAt);
    }

    return { fills, remainingQty };
  }

  // ── Cancel Order ───────────────────────────────────────────────────────────

  cancelOrder(orderId: string): boolean {
    const loc = this.orderIndex.get(orderId);
    if (!loc) return false;

    const levels = loc.side === 'BID' ? this.bids : this.asks;
    const level = levels.get(loc.price);
    if (!level) return false;

    const removed = level.removeOrder(orderId);
    if (removed) {
      this.orderIndex.delete(orderId);
      if (level.orderCount === 0) {
        levels.delete(loc.price);
      }
      this.sequenceNumber++;
    }
    return removed;
  }

  // ── Modify Order ───────────────────────────────────────────────────────────

  modifyOrder(orderId: string, newQuantity: number, newPrice?: number): boolean {
    const loc = this.orderIndex.get(orderId);
    if (!loc) return false;

    if (newPrice !== undefined && newPrice !== loc.price) {
      const levels = loc.side === 'BID' ? this.bids : this.asks;
      const level = levels.get(loc.price);
      if (!level) return false;

      const existingOrder = level.orders.find((o) => o.orderId === orderId);
      if (!existingOrder) return false;

      level.removeOrder(orderId);
      if (level.orderCount === 0) levels.delete(loc.price);

      this.restOrder(orderId, loc.side, newPrice, newQuantity, Date.now());
      this.sequenceNumber++;
      return true;
    }

    const levels = loc.side === 'BID' ? this.bids : this.asks;
    const level = levels.get(loc.price);
    if (!level) return false;

    const modified = level.modifyOrder(orderId, newQuantity);
    if (modified) this.sequenceNumber++;
    return modified;
  }

  // ── Matching Logic ─────────────────────────────────────────────────────────

  private matchMarketOrder(
    order: Order,
    qty: number,
    isBuy: boolean,
  ): { fills: Fill[]; remainingQty: number } {
    const fills: Fill[] = [];
    let remaining = qty;
    const oppositeLevels = isBuy ? this.sortedAskPrices() : this.sortedBidPrices();
    const levelMap = isBuy ? this.asks : this.bids;

    for (const price of oppositeLevels) {
      if (remaining <= 0) break;
      const level = levelMap.get(price)!;
      const result = level.matchAgainst(remaining, order.side, order.venue ?? Venue.NYSE);
      result.fills.forEach((f) => (f.symbol = order.symbol));
      fills.push(...result.fills);
      remaining -= result.filledQty;

      if (result.filledQty > 0) {
        this.recordTrade(price, result.filledQty, order.side);
      }

      if (level.orderCount === 0) {
        levelMap.delete(price);
      }
    }

    return { fills, remainingQty: remaining };
  }

  private matchLimitOrder(
    order: Order,
    qty: number,
    isBuy: boolean,
    limitPrice: number,
  ): { fills: Fill[]; remainingQty: number } {
    const fills: Fill[] = [];
    let remaining = qty;
    const oppositePrices = isBuy ? this.sortedAskPrices() : this.sortedBidPrices();
    const levelMap = isBuy ? this.asks : this.bids;

    for (const price of oppositePrices) {
      if (remaining <= 0) break;
      if (isBuy && price > limitPrice) break;
      if (!isBuy && price < limitPrice) break;

      const level = levelMap.get(price)!;
      const result = level.matchAgainst(remaining, order.side, order.venue ?? Venue.NYSE);
      result.fills.forEach((f) => (f.symbol = order.symbol));
      fills.push(...result.fills);
      remaining -= result.filledQty;

      if (result.filledQty > 0) {
        this.recordTrade(price, result.filledQty, order.side);
      }

      if (level.orderCount === 0) {
        levelMap.delete(price);
      }
    }

    return { fills, remainingQty: remaining };
  }

  private restOrder(orderId: string, side: 'BID' | 'ASK', price: number, qty: number, timestamp: number): void {
    const levels = side === 'BID' ? this.bids : this.asks;
    let level = levels.get(price);
    if (!level) {
      level = new PriceLevel(price);
      levels.set(price, level);
    }
    level.addOrder(orderId, qty, timestamp);
    this.orderIndex.set(orderId, { side, price });
    this.sequenceNumber++;
  }

  private recordTrade(price: number, size: number, aggressor: OrderSide): void {
    this.lastTradePrice = price;
    this.lastTradeSize = size;
    this.tradeHistory.push({ price, size, timestamp: Date.now(), aggressor });
    if (this.tradeHistory.length > 10000) {
      this.tradeHistory = this.tradeHistory.slice(-5000);
    }
  }

  // ── Level 2 Market Depth ───────────────────────────────────────────────────

  getLevel2(depth: number = 10): Level2Data {
    const bidPrices = this.sortedBidPrices().slice(0, depth);
    const askPrices = this.sortedAskPrices().slice(0, depth);

    return {
      symbol: this.symbol,
      bids: bidPrices.map((p) => this.bids.get(p)!.toEntry()),
      asks: askPrices.map((p) => this.asks.get(p)!.toEntry()),
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber,
    };
  }

  // ── Order Book Snapshot ────────────────────────────────────────────────────

  getSnapshot(depth: number = 20): OrderBookSnapshot {
    const l2 = this.getLevel2(depth);
    const totalBidVol = l2.bids.reduce((s, b) => s + b.quantity, 0);
    const totalAskVol = l2.asks.reduce((s, a) => s + a.quantity, 0);

    return {
      symbol: this.symbol,
      bids: l2.bids,
      asks: l2.asks,
      lastTradePrice: this.lastTradePrice,
      lastTradeSize: this.lastTradeSize,
      totalBidVolume: totalBidVol,
      totalAskVolume: totalAskVol,
      spread: this.spread,
      midPrice: this.midPrice,
      vwMidPrice: this.volumeWeightedMidPrice(),
      imbalance: this.orderBookImbalance(),
      timestamp: Date.now(),
    };
  }

  // ── Apply Delta ────────────────────────────────────────────────────────────

  applyDelta(delta: OrderBookDelta): void {
    const levels = delta.side === 'BID' ? this.bids : this.asks;

    if (delta.action === 'DELETE') {
      levels.delete(delta.price);
    } else if (delta.action === 'ADD' || delta.action === 'MODIFY') {
      let level = levels.get(delta.price);
      if (!level) {
        level = new PriceLevel(delta.price);
        levels.set(delta.price, level);
      }
      if (delta.action === 'ADD') {
        level.addOrder(`delta-${delta.sequenceNumber}`, delta.quantity, delta.timestamp);
      }
    }

    this.sequenceNumber = Math.max(this.sequenceNumber, delta.sequenceNumber);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  orderBookImbalance(levels: number = 5): number {
    const bidPrices = this.sortedBidPrices().slice(0, levels);
    const askPrices = this.sortedAskPrices().slice(0, levels);

    const bidVol = bidPrices.reduce((s, p) => s + (this.bids.get(p)?.totalQuantity ?? 0), 0);
    const askVol = askPrices.reduce((s, p) => s + (this.asks.get(p)?.totalQuantity ?? 0), 0);

    const total = bidVol + askVol;
    if (total === 0) return 0;
    return (bidVol - askVol) / total;
  }

  volumeWeightedMidPrice(): number {
    const bb = this.bestBid;
    const ba = this.bestAsk;
    if (bb === undefined || ba === undefined) return this.midPrice;

    const bidLevel = this.bids.get(bb)!;
    const askLevel = this.asks.get(ba)!;
    const bidVol = bidLevel.totalQuantity;
    const askVol = askLevel.totalQuantity;
    const total = bidVol + askVol;
    if (total === 0) return this.midPrice;

    return (bb * askVol + ba * bidVol) / total;
  }

  bidAskSpreadBps(): number {
    const bb = this.bestBid;
    const ba = this.bestAsk;
    if (bb === undefined || ba === undefined || this.midPrice === 0) return 0;
    return ((ba - bb) / this.midPrice) * 10000;
  }

  effectiveSpread(tradePrice: number): number {
    return 2 * Math.abs(tradePrice - this.midPrice);
  }

  realizedSpread(tradePrice: number, futurePrice: number, side: OrderSide): number {
    const sign = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? 1 : -1;
    return 2 * sign * (tradePrice - futurePrice);
  }

  /**
   * Kyle's lambda: price impact per unit of signed order flow.
   * Estimated via OLS regression of price changes on signed volume.
   */
  kylesLambda(windowSize: number = 100): number {
    const trades = this.tradeHistory.slice(-windowSize);
    if (trades.length < 10) return 0;

    const signedFlows: number[] = [];
    const priceChanges: number[] = [];

    for (let i = 1; i < trades.length; i++) {
      const sign = trades[i].aggressor === OrderSide.BUY || trades[i].aggressor === OrderSide.BUY_TO_COVER ? 1 : -1;
      signedFlows.push(sign * trades[i].size);
      priceChanges.push(trades[i].price - trades[i - 1].price);
    }

    const n = signedFlows.length;
    const sumX = signedFlows.reduce((a, b) => a + b, 0);
    const sumY = priceChanges.reduce((a, b) => a + b, 0);
    const sumXY = signedFlows.reduce((s, x, i) => s + x * priceChanges[i], 0);
    const sumX2 = signedFlows.reduce((s, x) => s + x * x, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return 0;

    return (n * sumXY - sumX * sumY) / denom;
  }

  /** Amihud illiquidity ratio: avg(|return| / volume) */
  amihudIlliquidity(windowSize: number = 100): number {
    const trades = this.tradeHistory.slice(-windowSize);
    if (trades.length < 2) return 0;

    let sum = 0;
    let count = 0;

    for (let i = 1; i < trades.length; i++) {
      const ret = Math.abs((trades[i].price - trades[i - 1].price) / trades[i - 1].price);
      const vol = trades[i].size * trades[i].price;
      if (vol > 0) {
        sum += ret / vol;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Market impact estimation combining Kyle's lambda and square-root model.
   * Returns estimated price impact in currency units.
   */
  estimateMarketImpact(orderSize: number, dailyVolume: number, volatility: number): {
    linearImpact: number;
    sqrtImpact: number;
    totalImpact: number;
  } {
    const lambda = this.kylesLambda();
    const linearImpact = lambda * orderSize;

    // Almgren et al. square-root model: η * σ * √(Q/V)
    const eta = 0.5;
    const participation = dailyVolume > 0 ? orderSize / dailyVolume : 0;
    const sqrtImpact = eta * volatility * this.midPrice * Math.sqrt(participation);

    return {
      linearImpact,
      sqrtImpact,
      totalImpact: linearImpact + sqrtImpact,
    };
  }

  /**
   * VPIN — Volume-Synchronized Probability of Informed Trading.
   * Splits recent trades into volume buckets and measures buy/sell imbalance.
   */
  computeVPIN(bucketSize: number = 1000, numBuckets: number = 50): number {
    if (this.tradeHistory.length < bucketSize) return 0;

    const buckets: Array<{ buyVol: number; sellVol: number }> = [];
    let currentBucket = { buyVol: 0, sellVol: 0 };
    let bucketVol = 0;

    for (const trade of this.tradeHistory) {
      const isBuy = trade.aggressor === OrderSide.BUY || trade.aggressor === OrderSide.BUY_TO_COVER;
      let remaining = trade.size;

      while (remaining > 0) {
        const spaceInBucket = bucketSize - bucketVol;
        const toAdd = Math.min(remaining, spaceInBucket);

        if (isBuy) {
          currentBucket.buyVol += toAdd;
        } else {
          currentBucket.sellVol += toAdd;
        }

        bucketVol += toAdd;
        remaining -= toAdd;

        if (bucketVol >= bucketSize) {
          buckets.push(currentBucket);
          currentBucket = { buyVol: 0, sellVol: 0 };
          bucketVol = 0;
        }
      }
    }

    const recentBuckets = buckets.slice(-numBuckets);
    if (recentBuckets.length === 0) return 0;

    const sumAbsImbalance = recentBuckets.reduce(
      (s, b) => s + Math.abs(b.buyVol - b.sellVol),
      0,
    );
    const totalVolume = recentBuckets.length * bucketSize;

    return totalVolume > 0 ? sumAbsImbalance / totalVolume : 0;
  }

  // ── Depth & Liquidity ──────────────────────────────────────────────────────

  getCumulativeDepth(side: 'BID' | 'ASK', priceLevels: number = 10): Array<{ price: number; cumQty: number }> {
    const prices = side === 'BID' ? this.sortedBidPrices() : this.sortedAskPrices();
    const levels = side === 'BID' ? this.bids : this.asks;
    const result: Array<{ price: number; cumQty: number }> = [];
    let cumQty = 0;

    for (const p of prices.slice(0, priceLevels)) {
      cumQty += levels.get(p)!.totalQuantity;
      result.push({ price: p, cumQty });
    }

    return result;
  }

  getDepthAtPrice(price: number, side: 'BID' | 'ASK'): number {
    const levels = side === 'BID' ? this.bids : this.asks;
    return levels.get(price)?.totalQuantity ?? 0;
  }

  /**
   * Estimates the average execution price for a hypothetical market order of given size
   * by walking the book (market simulation).
   */
  simulateMarketOrder(side: OrderSide, quantity: number): { avgPrice: number; totalCost: number; levelsConsumed: number } {
    const isBuy = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER;
    const prices = isBuy ? this.sortedAskPrices() : this.sortedBidPrices();
    const levels = isBuy ? this.asks : this.bids;

    let remaining = quantity;
    let totalCost = 0;
    let levelsConsumed = 0;

    for (const price of prices) {
      if (remaining <= 0) break;
      const available = levels.get(price)!.totalQuantity;
      const filled = Math.min(remaining, available);
      totalCost += filled * price;
      remaining -= filled;
      levelsConsumed++;
    }

    const executedQty = quantity - remaining;
    return {
      avgPrice: executedQty > 0 ? totalCost / executedQty : 0,
      totalCost,
      levelsConsumed,
    };
  }
}
