/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Smart Order Execution Library                      │
 * │  VWAP / TWAP / Iceberg / Adaptive algorithms, execution analytics, │
 * │  order book simulation, fill probability models, TCA (trade cost)   │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'iceberg' | 'trailing_stop' | 'bracket';
export type AlgoType = 'vwap' | 'twap' | 'pov' | 'iceberg' | 'adaptive' | 'sniper' | 'dark_sweep';
export type OrderStatus = 'pending' | 'working' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type Urgency = 'passive' | 'normal' | 'aggressive' | 'hyper';

export interface OrderRequest {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  trailingPct?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  algoType?: AlgoType;
  algoParams?: AlgoParams;
  parentId?: string;
  timestamp: number;
}

export interface AlgoParams {
  startTime?: number;
  endTime?: number;
  maxParticipation?: number;   // % of volume
  urgency?: Urgency;
  displaySize?: number;        // for iceberg
  darkOnly?: boolean;
  minFillSize?: number;
  priceLimit?: number;
  adaptiveTarget?: number;     // bps from arrival
  slices?: number;
}

export interface OrderFill {
  orderId: string;
  fillId: string;
  timestamp: number;
  price: number;
  quantity: number;
  venue: string;
  fees: number;
  liquidity: 'add' | 'remove';
}

export interface OrderState {
  order: OrderRequest;
  status: OrderStatus;
  filledQty: number;
  remainingQty: number;
  avgFillPrice: number;
  fills: OrderFill[];
  childOrders: string[];
  createdAt: number;
  updatedAt: number;
  cancelReason?: string;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
  spread: number;
  spreadBps: number;
  imbalance: number;        // -1 to 1 (bid heavy to ask heavy)
  depth5: { bid: number; ask: number };
  depth10: { bid: number; ask: number };
}

export interface ExecutionMetrics {
  arrivalPrice: number;
  avgFillPrice: number;
  vwap: number;
  twap: number;
  closingPrice: number;
  implementationShortfall: number;
  implementationShortfallBps: number;
  slippageBps: number;
  marketImpactBps: number;
  timingCostBps: number;
  totalCostBps: number;
  fillRate: number;
  participationRate: number;
  executionTime: number;     // seconds
  averageSpreadBps: number;
  priceReversion5min: number;
  priceReversion30min: number;
}

export interface TCAReport {
  orderId: string;
  symbol: string;
  side: OrderSide;
  totalQty: number;
  metrics: ExecutionMetrics;
  childAnalysis: ChildOrderAnalysis[];
  venueAnalysis: VenueAnalysis[];
  timeDistribution: TimeSliceAnalysis[];
  benchmarkComparison: BenchmarkComparison[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
}

export interface ChildOrderAnalysis {
  childId: string;
  filledQty: number;
  avgPrice: number;
  venue: string;
  slippageBps: number;
  fillTime: number;
}

export interface VenueAnalysis {
  venue: string;
  fills: number;
  totalQty: number;
  avgPrice: number;
  avgSlippageBps: number;
  avgFillTime: number;
  fillRate: number;
  addLiquidityPct: number;
}

export interface TimeSliceAnalysis {
  startTime: number;
  endTime: number;
  filledQty: number;
  avgPrice: number;
  vwap: number;
  participation: number;
  slippageBps: number;
}

export interface BenchmarkComparison {
  benchmark: string;
  price: number;
  costBps: number;
}


// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function weightedMean(values: number[], weights: number[]): number {
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW === 0) return mean(values);
  return values.reduce((s, v, i) => s + v * weights[i], 0) / totalW;
}


// ═══════════════════════════════════════════════════════════════════════
// ORDER BOOK SIMULATOR
// ═══════════════════════════════════════════════════════════════════════

export class OrderBookSimulator {
  private seed: number;

  constructor(seed = 42) {
    this.seed = seed;
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  private gauss(): number {
    return Math.sqrt(-2 * Math.log(this.rand())) * Math.cos(2 * Math.PI * this.rand());
  }

  generateOrderBook(symbol: string, midPrice: number, timestamp: number): OrderBook {
    const tickSize = midPrice > 100 ? 0.01 : 0.005;
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    // Generate 20 levels on each side
    for (let i = 0; i < 20; i++) {
      const bidPrice = midPrice - tickSize * (i + 1) + this.gauss() * tickSize * 0.1;
      const askPrice = midPrice + tickSize * (i + 1) + this.gauss() * tickSize * 0.1;

      // Size increases with depth (more liquidity away from mid)
      const baseSizeBid = Math.round(100 + i * 50 + Math.abs(this.gauss()) * 200);
      const baseSizeAsk = Math.round(100 + i * 50 + Math.abs(this.gauss()) * 200);

      bids.push({
        price: Math.round(bidPrice * 100) / 100,
        size: baseSizeBid,
        orders: Math.max(1, Math.round(baseSizeBid / 100)),
      });

      asks.push({
        price: Math.round(askPrice * 100) / 100,
        size: baseSizeAsk,
        orders: Math.max(1, Math.round(baseSizeAsk / 100)),
      });
    }

    // Sort: bids descending, asks ascending
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || midPrice;
    const bestAsk = asks[0]?.price || midPrice;
    const spread = bestAsk - bestBid;

    const depth5Bid = bids.slice(0, 5).reduce((s, l) => s + l.size * l.price, 0);
    const depth5Ask = asks.slice(0, 5).reduce((s, l) => s + l.size * l.price, 0);
    const depth10Bid = bids.slice(0, 10).reduce((s, l) => s + l.size * l.price, 0);
    const depth10Ask = asks.slice(0, 10).reduce((s, l) => s + l.size * l.price, 0);

    const bidVolume = bids.reduce((s, l) => s + l.size, 0);
    const askVolume = asks.reduce((s, l) => s + l.size, 0);
    const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume || 1);

    return {
      symbol, timestamp, bids, asks,
      midPrice: (bestBid + bestAsk) / 2,
      spread,
      spreadBps: Math.round(spread / midPrice * 10000 * 100) / 100,
      imbalance: Math.round(imbalance * 1000) / 1000,
      depth5: { bid: Math.round(depth5Bid), ask: Math.round(depth5Ask) },
      depth10: { bid: Math.round(depth10Bid), ask: Math.round(depth10Ask) },
    };
  }

  /**
   * Simulate market impact of an order
   */
  simulateImpact(book: OrderBook, side: OrderSide, quantity: number): {
    avgFillPrice: number;
    worstPrice: number;
    impactBps: number;
    levelsConsumed: number;
  } {
    const levels = side === 'buy' ? book.asks : book.bids;
    let remaining = quantity;
    let totalCost = 0;
    let worstPrice = levels[0]?.price || book.midPrice;
    let levelsConsumed = 0;

    for (const level of levels) {
      if (remaining <= 0) break;
      const fillAtLevel = Math.min(remaining, level.size);
      totalCost += fillAtLevel * level.price;
      worstPrice = level.price;
      remaining -= fillAtLevel;
      levelsConsumed++;
    }

    // If we exhaust the book, simulate continuation
    if (remaining > 0) {
      const lastPrice = worstPrice;
      const extraImpact = remaining * lastPrice * 0.001; // 10bps per remaining unit
      totalCost += remaining * (lastPrice * 1.001);
      levelsConsumed++;
    }

    const avgFillPrice = totalCost / quantity;
    const impactBps = Math.abs(avgFillPrice - book.midPrice) / book.midPrice * 10000;

    return {
      avgFillPrice: Math.round(avgFillPrice * 100) / 100,
      worstPrice: Math.round(worstPrice * 100) / 100,
      impactBps: Math.round(impactBps * 100) / 100,
      levelsConsumed,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// EXECUTION ALGORITHMS
// ═══════════════════════════════════════════════════════════════════════

export class VWAPAlgorithm {
  private readonly typicalVolumeProfile: number[];

  constructor() {
    // Typical intraday volume profile (390 minutes, normalized to 1)
    // U-shaped: heavy at open/close, light midday
    this.typicalVolumeProfile = Array.from({ length: 78 }, (_, i) => {
      const x = i / 77; // 0 to 1 through the day in 5-min buckets
      return 1.5 * Math.exp(-10 * (x - 0) ** 2) +
             1.0 * Math.exp(-10 * (x - 1) ** 2) +
             0.5 + 0.2 * Math.sin(x * Math.PI * 4);
    });
    const total = this.typicalVolumeProfile.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.typicalVolumeProfile.length; i++) {
      this.typicalVolumeProfile[i] /= total;
    }
  }

  /**
   * Generate VWAP target schedule
   */
  generateSchedule(
    totalQty: number,
    params: AlgoParams
  ): { bucket: number; targetQty: number; pctOfTotal: number }[] {
    const startBucket = params.startTime ? Math.floor(params.startTime / 5) : 0;
    const endBucket = params.endTime ? Math.floor(params.endTime / 5) : 77;
    const activeBuckets = this.typicalVolumeProfile.slice(startBucket, endBucket + 1);
    const activeTotal = activeBuckets.reduce((a, b) => a + b, 0);

    return activeBuckets.map((vol, i) => {
      const pct = activeTotal > 0 ? vol / activeTotal : 1 / activeBuckets.length;
      return {
        bucket: startBucket + i,
        targetQty: Math.round(totalQty * pct),
        pctOfTotal: Math.round(pct * 10000) / 100,
      };
    });
  }

  /**
   * Simulate VWAP execution
   */
  simulate(
    totalQty: number,
    side: OrderSide,
    prices: number[],      // price at each bucket
    volumes: number[],     // volume at each bucket
    params: AlgoParams = {}
  ): OrderFill[] {
    const schedule = this.generateSchedule(totalQty, params);
    const fills: OrderFill[] = [];
    const maxPart = params.maxParticipation || 0.10;
    const venues = ['NYSE', 'NASDAQ', 'ARCA', 'BATS', 'IEX', 'DARK_1', 'DARK_2'];

    let filled = 0;
    for (let i = 0; i < schedule.length; i++) {
      if (filled >= totalQty) break;
      const bucketIdx = i;
      if (bucketIdx >= prices.length) break;

      const maxFromVolume = Math.round(volumes[bucketIdx] * maxPart);
      const targetQty = Math.min(schedule[i].targetQty, maxFromVolume, totalQty - filled);

      if (targetQty <= 0) continue;

      // Add some slippage
      const slippage = side === 'buy' ? 1 + 0.0002 : 1 - 0.0002;
      const fillPrice = Math.round(prices[bucketIdx] * slippage * 100) / 100;

      const venue = venues[Math.floor(Math.random() * venues.length)];
      const isAdd = Math.random() > 0.6;

      fills.push({
        orderId: '',
        fillId: uid(),
        timestamp: Date.now() + i * 5 * 60 * 1000,
        price: fillPrice,
        quantity: targetQty,
        venue,
        fees: targetQty * fillPrice * (isAdd ? -0.00002 : 0.0003),
        liquidity: isAdd ? 'add' : 'remove',
      });

      filled += targetQty;
    }

    return fills;
  }
}

export class TWAPAlgorithm {
  /**
   * Generate TWAP schedule - equal slices across time
   */
  generateSchedule(
    totalQty: number,
    slices: number
  ): { slice: number; targetQty: number; pctOfTotal: number }[] {
    const qtyPerSlice = Math.round(totalQty / slices);
    const schedule = [];
    let remaining = totalQty;

    for (let i = 0; i < slices; i++) {
      const qty = i === slices - 1 ? remaining : Math.min(qtyPerSlice, remaining);
      schedule.push({
        slice: i,
        targetQty: qty,
        pctOfTotal: Math.round(qty / totalQty * 10000) / 100,
      });
      remaining -= qty;
    }

    return schedule;
  }

  simulate(
    totalQty: number,
    side: OrderSide,
    prices: number[],
    params: AlgoParams = {}
  ): OrderFill[] {
    const slices = params.slices || 20;
    const schedule = this.generateSchedule(totalQty, slices);
    const fills: OrderFill[] = [];
    const venues = ['NYSE', 'NASDAQ', 'ARCA', 'BATS', 'IEX'];

    for (let i = 0; i < schedule.length; i++) {
      const priceIdx = Math.min(i, prices.length - 1);
      const jitter = (Math.random() - 0.5) * 0.001;
      const fillPrice = Math.round(prices[priceIdx] * (1 + jitter) * 100) / 100;

      fills.push({
        orderId: '',
        fillId: uid(),
        timestamp: Date.now() + i * 60000,
        price: fillPrice,
        quantity: schedule[i].targetQty,
        venue: venues[i % venues.length],
        fees: schedule[i].targetQty * fillPrice * 0.0001,
        liquidity: Math.random() > 0.5 ? 'add' : 'remove',
      });
    }

    return fills;
  }
}

export class IcebergAlgorithm {
  simulate(
    totalQty: number,
    side: OrderSide,
    limitPrice: number,
    displaySize: number,
    priceEvolution: number[]
  ): OrderFill[] {
    const fills: OrderFill[] = [];
    let remaining = totalQty;
    let slice = 0;

    for (let i = 0; i < priceEvolution.length && remaining > 0; i++) {
      const canFill = side === 'buy'
        ? priceEvolution[i] <= limitPrice
        : priceEvolution[i] >= limitPrice;

      if (canFill) {
        const fillQty = Math.min(displaySize, remaining);
        fills.push({
          orderId: '',
          fillId: uid(),
          timestamp: Date.now() + i * 1000,
          price: priceEvolution[i],
          quantity: fillQty,
          venue: 'HIDDEN',
          fees: fillQty * priceEvolution[i] * 0.00005,
          liquidity: 'add',
        });
        remaining -= fillQty;
        slice++;
      }
    }

    return fills;
  }
}

export class AdaptiveAlgorithm {
  /**
   * Adaptive algorithm that adjusts aggression based on market conditions
   */
  simulate(
    totalQty: number,
    side: OrderSide,
    prices: number[],
    volumes: number[],
    spreads: number[],
    params: AlgoParams = {}
  ): { fills: OrderFill[]; aggressionHistory: number[] } {
    const fills: OrderFill[] = [];
    const aggressionHistory: number[] = [];
    const targetBps = params.adaptiveTarget || 5;
    const urgency = params.urgency || 'normal';
    let remaining = totalQty;
    const arrivalPrice = prices[0];

    const urgencyMultiplier = {
      passive: 0.5,
      normal: 1.0,
      aggressive: 2.0,
      hyper: 3.0,
    }[urgency];

    for (let i = 0; i < prices.length && remaining > 0; i++) {
      // Compute current shortfall from arrival
      const shortfall = side === 'buy'
        ? (prices[i] - arrivalPrice) / arrivalPrice * 10000
        : (arrivalPrice - prices[i]) / arrivalPrice * 10000;

      // Aggression increases if we're losing money (shortfall worsening)
      const timePressure = i / prices.length;
      let aggression = urgencyMultiplier * (0.5 + timePressure);
      if (shortfall > targetBps) {
        aggression *= 2; // Double aggression if behind target
      } else if (shortfall < -targetBps) {
        aggression *= 0.3; // Reduce if favorable
      }

      // Increase aggression if spread is tight
      if (spreads[i] < mean(spreads)) {
        aggression *= 1.3;
      }

      aggression = Math.max(0.1, Math.min(5, aggression));
      aggressionHistory.push(aggression);

      // Volume to trade this slice
      const baseQty = totalQty / prices.length;
      const adaptiveQty = Math.min(
        Math.round(baseQty * aggression),
        remaining,
        Math.round(volumes[i] * 0.15)
      );

      if (adaptiveQty > 0) {
        const impact = adaptiveQty / (volumes[i] || 1) * 10; // bps impact
        const slippage = side === 'buy' ? 1 + impact / 10000 : 1 - impact / 10000;

        fills.push({
          orderId: '',
          fillId: uid(),
          timestamp: Date.now() + i * 60000,
          price: Math.round(prices[i] * slippage * 100) / 100,
          quantity: adaptiveQty,
          venue: spreads[i] < 5 ? 'LIT' : 'DARK',
          fees: adaptiveQty * prices[i] * 0.00015,
          liquidity: aggression > 1.5 ? 'remove' : 'add',
        });
        remaining -= adaptiveQty;
      }
    }

    return { fills, aggressionHistory };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// FILL PROBABILITY MODEL
// ═══════════════════════════════════════════════════════════════════════

export class FillProbabilityModel {
  /**
   * Estimate probability of limit order fill
   */
  estimateFillProb(
    side: OrderSide,
    limitPrice: number,
    midPrice: number,
    spread: number,
    volatility: number,
    timeHorizon: number,   // seconds
    queuePosition: number  // 0 = front of queue
  ): { probability: number; expectedTime: number; expectedFillPrice: number } {
    // Distance from mid in terms of spread
    const distanceSpreads = side === 'buy'
      ? (midPrice - limitPrice) / spread
      : (limitPrice - midPrice) / spread;

    // Base probability from distance (exponential decay)
    let baseProbability = Math.exp(-1.5 * Math.max(0, distanceSpreads));

    // Time adjustment (higher with more time)
    const timeAdjust = 1 - Math.exp(-timeHorizon / 3600);
    baseProbability *= (0.5 + 0.5 * timeAdjust);

    // Volatility adjustment (higher vol → more likely to reach limit)
    const volAdjust = 1 + volatility * 5;
    baseProbability *= Math.min(2, volAdjust);

    // Queue position adjustment
    const queuePenalty = Math.exp(-queuePosition * 0.01);
    baseProbability *= queuePenalty;

    const probability = Math.max(0, Math.min(1, baseProbability));

    // Expected time to fill (if filled)
    const expectedTime = distanceSpreads > 0
      ? timeHorizon * (1 - probability) * 2
      : timeHorizon * 0.2;

    return {
      probability: Math.round(probability * 1000) / 1000,
      expectedTime: Math.round(expectedTime),
      expectedFillPrice: limitPrice,
    };
  }

  /**
   * Optimal limit price for desired fill probability
   */
  optimalLimitPrice(
    side: OrderSide,
    midPrice: number,
    spread: number,
    targetProbability: number,
    volatility: number
  ): { price: number; expectedSlippageBps: number } {
    // Binary search for price that achieves target probability
    let lo = midPrice - spread * 5;
    let hi = midPrice + spread * 5;

    for (let iter = 0; iter < 30; iter++) {
      const mid = (lo + hi) / 2;
      const prob = this.estimateFillProb(side, mid, midPrice, spread, volatility, 3600, 0);

      if (prob.probability < targetProbability) {
        if (side === 'buy') lo = mid; else hi = mid;
      } else {
        if (side === 'buy') hi = mid; else lo = mid;
      }
    }

    const optimalPrice = Math.round((lo + hi) / 2 * 100) / 100;
    const slippage = Math.abs(optimalPrice - midPrice) / midPrice * 10000;

    return {
      price: optimalPrice,
      expectedSlippageBps: Math.round(slippage * 100) / 100,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// TRANSACTION COST ANALYSIS (TCA)
// ═══════════════════════════════════════════════════════════════════════

export class TransactionCostAnalyzer {
  /**
   * Full TCA report for an executed order
   */
  analyze(
    order: OrderState,
    marketData: {
      arrivalPrice: number;
      vwap: number;
      twap: number;
      closingPrice: number;
      openPrice: number;
      volumeProfile: number[];
      priceEvolution: number[];
    }
  ): TCAReport {
    const { fills } = order;
    if (fills.length === 0) {
      return this.emptyReport(order);
    }

    // Compute fill-weighted average price
    const avgFillPrice = weightedMean(
      fills.map(f => f.price),
      fills.map(f => f.quantity)
    );

    const totalQty = fills.reduce((s, f) => s + f.quantity, 0);
    const totalNotional = fills.reduce((s, f) => s + f.price * f.quantity, 0);
    const totalFees = fills.reduce((s, f) => s + f.fees, 0);

    // Implementation shortfall
    const arrivalPrice = marketData.arrivalPrice;
    const isSell = order.order.side === 'sell';
    const shortfall = isSell
      ? (arrivalPrice - avgFillPrice)
      : (avgFillPrice - arrivalPrice);
    const shortfallBps = shortfall / arrivalPrice * 10000;

    // Market impact (difference from VWAP)
    const impactBps = Math.abs(avgFillPrice - marketData.vwap) / marketData.vwap * 10000;

    // Timing cost (arrival vs TWAP)
    const timingBps = Math.abs(arrivalPrice - marketData.twap) / arrivalPrice * 10000;

    // Total cost
    const feesBps = totalFees / totalNotional * 10000;
    const totalCostBps = Math.abs(shortfallBps) + feesBps;

    // Venue analysis
    const venueMap = new Map<string, OrderFill[]>();
    for (const f of fills) {
      if (!venueMap.has(f.venue)) venueMap.set(f.venue, []);
      venueMap.get(f.venue)!.push(f);
    }

    const venueAnalysis: VenueAnalysis[] = [];
    for (const [venue, venueFills] of venueMap) {
      const vQty = venueFills.reduce((s, f) => s + f.quantity, 0);
      const vAvg = weightedMean(venueFills.map(f => f.price), venueFills.map(f => f.quantity));
      const vSlip = Math.abs(vAvg - arrivalPrice) / arrivalPrice * 10000;
      const addPct = venueFills.filter(f => f.liquidity === 'add').length / venueFills.length;

      venueAnalysis.push({
        venue,
        fills: venueFills.length,
        totalQty: vQty,
        avgPrice: Math.round(vAvg * 100) / 100,
        avgSlippageBps: Math.round(vSlip * 100) / 100,
        avgFillTime: venueFills.length > 1
          ? (venueFills[venueFills.length - 1].timestamp - venueFills[0].timestamp) / 1000
          : 0,
        fillRate: vQty / totalQty,
        addLiquidityPct: Math.round(addPct * 100) / 100,
      });
    }

    // Time distribution
    const sliceDuration = 5 * 60 * 1000; // 5-min slices
    const timeSlices: TimeSliceAnalysis[] = [];
    if (fills.length > 1) {
      const startTime = fills[0].timestamp;
      const endTime = fills[fills.length - 1].timestamp;
      for (let t = startTime; t <= endTime; t += sliceDuration) {
        const sliceFills = fills.filter(f => f.timestamp >= t && f.timestamp < t + sliceDuration);
        if (sliceFills.length === 0) continue;
        const sliceQty = sliceFills.reduce((s, f) => s + f.quantity, 0);
        const sliceAvg = weightedMean(sliceFills.map(f => f.price), sliceFills.map(f => f.quantity));
        timeSlices.push({
          startTime: t,
          endTime: t + sliceDuration,
          filledQty: sliceQty,
          avgPrice: Math.round(sliceAvg * 100) / 100,
          vwap: Math.round(marketData.vwap * 100) / 100,
          participation: 0.05,
          slippageBps: Math.round(Math.abs(sliceAvg - marketData.vwap) / marketData.vwap * 10000 * 100) / 100,
        });
      }
    }

    // Benchmark comparison
    const benchmarks: BenchmarkComparison[] = [
      { benchmark: 'Arrival', price: arrivalPrice, costBps: Math.round(shortfallBps * 100) / 100 },
      { benchmark: 'VWAP', price: marketData.vwap, costBps: Math.round(impactBps * 100) / 100 },
      { benchmark: 'TWAP', price: marketData.twap, costBps: Math.round(Math.abs(avgFillPrice - marketData.twap) / marketData.twap * 10000 * 100) / 100 },
      { benchmark: 'Close', price: marketData.closingPrice, costBps: Math.round(Math.abs(avgFillPrice - marketData.closingPrice) / marketData.closingPrice * 10000 * 100) / 100 },
      { benchmark: 'Open', price: marketData.openPrice, costBps: Math.round(Math.abs(avgFillPrice - marketData.openPrice) / marketData.openPrice * 10000 * 100) / 100 },
    ];

    // Grade
    const absShortfall = Math.abs(shortfallBps);
    const grade: TCAReport['grade'] =
      absShortfall < 3 ? 'A' :
      absShortfall < 8 ? 'B' :
      absShortfall < 15 ? 'C' :
      absShortfall < 30 ? 'D' : 'F';

    const executionTime = fills.length > 1
      ? (fills[fills.length - 1].timestamp - fills[0].timestamp) / 1000
      : 0;

    return {
      orderId: order.order.id,
      symbol: order.order.symbol,
      side: order.order.side,
      totalQty,
      metrics: {
        arrivalPrice,
        avgFillPrice: Math.round(avgFillPrice * 100) / 100,
        vwap: marketData.vwap,
        twap: marketData.twap,
        closingPrice: marketData.closingPrice,
        implementationShortfall: Math.round(shortfall * 100) / 100,
        implementationShortfallBps: Math.round(shortfallBps * 100) / 100,
        slippageBps: Math.round(Math.abs(shortfallBps) * 100) / 100,
        marketImpactBps: Math.round(impactBps * 100) / 100,
        timingCostBps: Math.round(timingBps * 100) / 100,
        totalCostBps: Math.round(totalCostBps * 100) / 100,
        fillRate: totalQty / order.order.quantity,
        participationRate: 0.08,
        executionTime,
        averageSpreadBps: 2.5,
        priceReversion5min: 0,
        priceReversion30min: 0,
      },
      childAnalysis: [],
      venueAnalysis,
      timeDistribution: timeSlices,
      benchmarkComparison: benchmarks,
      grade,
      summary: `Execution graded ${grade}. IS: ${shortfallBps.toFixed(1)} bps. ` +
               `Avg fill: $${avgFillPrice.toFixed(2)} vs arrival $${arrivalPrice.toFixed(2)}. ` +
               `${fills.length} fills across ${venueAnalysis.length} venues in ${(executionTime / 60).toFixed(1)} min.`,
    };
  }

  private emptyReport(order: OrderState): TCAReport {
    return {
      orderId: order.order.id,
      symbol: order.order.symbol,
      side: order.order.side,
      totalQty: 0,
      metrics: {
        arrivalPrice: 0, avgFillPrice: 0, vwap: 0, twap: 0, closingPrice: 0,
        implementationShortfall: 0, implementationShortfallBps: 0,
        slippageBps: 0, marketImpactBps: 0, timingCostBps: 0, totalCostBps: 0,
        fillRate: 0, participationRate: 0, executionTime: 0,
        averageSpreadBps: 0, priceReversion5min: 0, priceReversion30min: 0,
      },
      childAnalysis: [], venueAnalysis: [], timeDistribution: [], benchmarkComparison: [],
      grade: 'F',
      summary: 'No fills recorded',
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// SMART ORDER ROUTER
// ═══════════════════════════════════════════════════════════════════════

export interface Venue {
  name: string;
  makerFee: number;     // per share
  takerFee: number;
  latencyMs: number;
  darkPool: boolean;
  minSize: number;
  avgFillRate: number;
  avgSpreadBps: number;
}

export class SmartOrderRouter {
  private venues: Venue[];

  constructor() {
    this.venues = [
      { name: 'NYSE', makerFee: -0.0020, takerFee: 0.0030, latencyMs: 1, darkPool: false, minSize: 1, avgFillRate: 0.92, avgSpreadBps: 1.5 },
      { name: 'NASDAQ', makerFee: -0.0020, takerFee: 0.0030, latencyMs: 1, darkPool: false, minSize: 1, avgFillRate: 0.94, avgSpreadBps: 1.3 },
      { name: 'ARCA', makerFee: -0.0025, takerFee: 0.0030, latencyMs: 2, darkPool: false, minSize: 1, avgFillRate: 0.88, avgSpreadBps: 1.8 },
      { name: 'BATS', makerFee: -0.0025, takerFee: 0.0028, latencyMs: 1, darkPool: false, minSize: 1, avgFillRate: 0.90, avgSpreadBps: 1.4 },
      { name: 'IEX', makerFee: -0.0009, takerFee: 0.0009, latencyMs: 3, darkPool: false, minSize: 1, avgFillRate: 0.75, avgSpreadBps: 2.0 },
      { name: 'SIGMA_X', makerFee: 0, takerFee: 0.0010, latencyMs: 5, darkPool: true, minSize: 100, avgFillRate: 0.35, avgSpreadBps: 0 },
      { name: 'CROSSFINDER', makerFee: 0, takerFee: 0.0008, latencyMs: 4, darkPool: true, minSize: 100, avgFillRate: 0.30, avgSpreadBps: 0 },
      { name: 'LEVEL_ATS', makerFee: 0, takerFee: 0.0012, latencyMs: 6, darkPool: true, minSize: 200, avgFillRate: 0.25, avgSpreadBps: 0 },
    ];
  }

  /**
   * Route order to optimal venue(s)
   */
  route(
    side: OrderSide,
    quantity: number,
    price: number,
    urgency: Urgency = 'normal'
  ): { venue: string; quantity: number; expectedCost: number; rationale: string }[] {
    const routes: { venue: string; quantity: number; expectedCost: number; rationale: string }[] = [];

    // Score each venue
    const venueScores = this.venues.map(v => {
      let score = 0;

      // Fee advantage
      const fee = quantity > 0 ? v.takerFee : v.makerFee;
      score -= fee * quantity * 10; // Penalize fees

      // Latency (more important for aggressive)
      const latencyPenalty = v.latencyMs * (urgency === 'hyper' ? 5 : urgency === 'aggressive' ? 2 : 0.5);
      score -= latencyPenalty;

      // Fill rate
      score += v.avgFillRate * 50;

      // Dark pool bonus for large orders
      if (v.darkPool && quantity >= 500) {
        score += 30; // Price improvement
      }
      if (v.darkPool && quantity < v.minSize) {
        score -= 1000; // Can't route small orders to dark pools
      }

      // Spread: lit venues need spread consideration
      if (!v.darkPool) {
        score -= v.avgSpreadBps * 2;
      }

      return { venue: v, score };
    });

    venueScores.sort((a, b) => b.score - a.score);

    // Allocate quantities
    let remaining = quantity;
    const maxVenues = urgency === 'aggressive' || urgency === 'hyper' ? 4 : 3;

    for (let i = 0; i < Math.min(maxVenues, venueScores.length) && remaining > 0; i++) {
      const v = venueScores[i].venue;
      if (remaining < v.minSize) continue;

      const allocQty = i === maxVenues - 1 ? remaining : Math.round(remaining * (0.4 + 0.3 * (maxVenues - i) / maxVenues));
      const actualQty = Math.min(allocQty, remaining);
      const expectedCost = actualQty * price * Math.abs(v.takerFee) + actualQty * v.avgSpreadBps / 10000 * price;

      routes.push({
        venue: v.name,
        quantity: actualQty,
        expectedCost: Math.round(expectedCost * 100) / 100,
        rationale: v.darkPool
          ? `Dark pool: price improvement, ${(v.avgFillRate * 100).toFixed(0)}% fill rate`
          : `Lit venue: ${v.avgSpreadBps}bps spread, ${v.latencyMs}ms latency`,
      });

      remaining -= actualQty;
    }

    return routes;
  }

  getVenues(): Venue[] {
    return [...this.venues];
  }
}


// ═══════════════════════════════════════════════════════════════════════
// DEMO & EXPORTS
// ═══════════════════════════════════════════════════════════════════════

export function runExecutionDemo(): {
  orderBook: OrderBook;
  vwapFills: OrderFill[];
  twapFills: OrderFill[];
  routes: ReturnType<SmartOrderRouter['route']>;
  tca: TCAReport;
  fillProb: ReturnType<FillProbabilityModel['estimateFillProb']>;
} {
  // Generate demo order book
  const bookSim = new OrderBookSimulator(42);
  const orderBook = bookSim.generateOrderBook('AAPL', 185.50, Date.now());

  // Generate price evolution
  const prices: number[] = [];
  const volumes: number[] = [];
  const spreads: number[] = [];
  let price = 185.50;
  for (let i = 0; i < 78; i++) {
    price += (Math.random() - 0.48) * 0.15;
    prices.push(Math.round(price * 100) / 100);
    volumes.push(Math.round(50000 + Math.random() * 100000));
    spreads.push(1 + Math.random() * 3);
  }

  // VWAP execution
  const vwap = new VWAPAlgorithm();
  const vwapFills = vwap.simulate(5000, 'buy', prices, volumes);

  // TWAP execution
  const twap = new TWAPAlgorithm();
  const twapFills = twap.simulate(5000, 'buy', prices, { slices: 20 });

  // Smart routing
  const router = new SmartOrderRouter();
  const routes = router.route('buy', 5000, 185.50, 'normal');

  // Fill probability
  const fillModel = new FillProbabilityModel();
  const fillProb = fillModel.estimateFillProb('buy', 185.00, 185.50, 0.02, 0.015, 3600, 50);

  // Build mock order state for TCA
  const mockOrder: OrderState = {
    order: {
      id: 'demo-1', symbol: 'AAPL', side: 'buy', quantity: 5000,
      orderType: 'market', timeInForce: 'day', algoType: 'vwap', timestamp: Date.now(),
    },
    status: 'filled',
    filledQty: vwapFills.reduce((s, f) => s + f.quantity, 0),
    remainingQty: 0,
    avgFillPrice: weightedMean(vwapFills.map(f => f.price), vwapFills.map(f => f.quantity)),
    fills: vwapFills,
    childOrders: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tcaAnalyzer = new TransactionCostAnalyzer();
  const vwapPrice = weightedMean(prices, volumes);
  const tca = tcaAnalyzer.analyze(mockOrder, {
    arrivalPrice: prices[0],
    vwap: Math.round(vwapPrice * 100) / 100,
    twap: Math.round(mean(prices) * 100) / 100,
    closingPrice: prices[prices.length - 1],
    openPrice: prices[0],
    volumeProfile: volumes,
    priceEvolution: prices,
  });

  return { orderBook, vwapFills, twapFills, routes, tca, fillProb };
}
