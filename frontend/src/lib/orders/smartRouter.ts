import {
  Order,
  OrderSide,
  Venue,
  VenueStats,
  RoutingDecision,
  Fill,
} from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VenueScore {
  venue: Venue;
  fillRateScore: number;
  costScore: number;
  latencyScore: number;
  improvementScore: number;
  toxicityPenalty: number;
  revertPenalty: number;
  composite: number;
}

export interface RoutingConfig {
  fillRateWeight: number;
  costWeight: number;
  latencyWeight: number;
  improvementWeight: number;
  toxicityWeight: number;
  revertWeight: number;
  darkPoolPreference: number;
  minVenueAllocation: number;
  maxVenueAllocation: number;
  internalizationThreshold: number;
  adaptiveLookback: number;
}

export interface SplitResult {
  decisions: RoutingDecision[];
  totalExpectedCost: number;
  expectedAvgFillRate: number;
  avgLatency: number;
}

export interface DarkPoolConfig {
  minBlockSize: number;
  maxPriceDeviation: number;
  allowedPools: Venue[];
  midpointPegEnabled: boolean;
  antiGamingEnabled: boolean;
  maxExposureTime: number;
}

export interface AdaptiveState {
  venueHistory: Map<Venue, VenueFillHistory>;
  lastAdaptation: number;
  currentWeights: Map<Venue, number>;
  regime: 'NORMAL' | 'HIGH_VOLATILITY' | 'LOW_LIQUIDITY' | 'FAST_MARKET';
}

interface VenueFillHistory {
  recentFills: Array<{ timestamp: number; fillRate: number; cost: number; reverted: boolean }>;
  ewmaFillRate: number;
  ewmaCost: number;
  ewmaRevert: number;
}

const DEFAULT_CONFIG: RoutingConfig = {
  fillRateWeight: 0.30,
  costWeight: 0.25,
  latencyWeight: 0.15,
  improvementWeight: 0.15,
  toxicityWeight: 0.10,
  revertWeight: 0.05,
  darkPoolPreference: 0.3,
  minVenueAllocation: 0.05,
  maxVenueAllocation: 0.60,
  internalizationThreshold: 0.25,
  adaptiveLookback: 300_000,
};

// ─── SmartOrderRouter ────────────────────────────────────────────────────────

export class SmartOrderRouter {
  private config: RoutingConfig;
  private venueStatsCache: Map<Venue, VenueStats> = new Map();
  private adaptiveState: AdaptiveState;

  constructor(config: Partial<RoutingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adaptiveState = {
      venueHistory: new Map(),
      lastAdaptation: Date.now(),
      currentWeights: new Map(),
      regime: 'NORMAL',
    };
  }

  updateVenueStats(stats: VenueStats[]): void {
    for (const s of stats) {
      this.venueStatsCache.set(s.venue, s);
    }
  }

  // ── Venue Scoring ──────────────────────────────────────────────────────────

  scoreVenues(symbol: string, side: OrderSide, quantity: number): VenueScore[] {
    const scores: VenueScore[] = [];

    for (const [venue, stats] of this.venueStatsCache) {
      const fillRateScore = stats.avgFillRate * 100;

      // Net cost = fee - rebate. Lower is better → invert for score.
      const netCost = stats.feePerShare - stats.rebatePerShare;
      const maxFee = 0.003;
      const costScore = Math.max(0, (1 - netCost / maxFee) * 100);

      const maxLatency = 50;
      const latencyScore = Math.max(0, (1 - stats.avgLatencyMs / maxLatency) * 100);

      const improvementScore = Math.min(100, stats.priceImprovement * 10000);

      const toxicityPenalty = stats.toxicityScore * 100;
      const revertPenalty = stats.revertRate * 100;

      const composite =
        fillRateScore * this.config.fillRateWeight +
        costScore * this.config.costWeight +
        latencyScore * this.config.latencyWeight +
        improvementScore * this.config.improvementWeight -
        toxicityPenalty * this.config.toxicityWeight -
        revertPenalty * this.config.revertWeight;

      scores.push({
        venue,
        fillRateScore,
        costScore,
        latencyScore,
        improvementScore,
        toxicityPenalty,
        revertPenalty,
        composite: Math.max(0, composite),
      });
    }

    // Apply adaptive adjustments
    for (const score of scores) {
      const history = this.adaptiveState.venueHistory.get(score.venue);
      if (history) {
        const adaptiveBoost = (history.ewmaFillRate - 0.5) * 20;
        const adaptivePenalty = history.ewmaRevert * 30;
        score.composite += adaptiveBoost - adaptivePenalty;
        score.composite = Math.max(0, score.composite);
      }
    }

    return scores.sort((a, b) => b.composite - a.composite);
  }

  // ── Optimal Venue Selection ────────────────────────────────────────────────

  selectOptimalVenue(symbol: string, side: OrderSide, quantity: number): Venue {
    const scores = this.scoreVenues(symbol, side, quantity);
    return scores.length > 0 ? scores[0].venue : Venue.NYSE;
  }

  // ── Split Order Across Venues ──────────────────────────────────────────────

  splitOrder(
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number,
  ): SplitResult {
    const scores = this.scoreVenues(symbol, side, quantity);
    if (scores.length === 0) {
      return {
        decisions: [{ venue: Venue.NYSE, quantity, expectedCost: quantity * 0.003, expectedFillRate: 0.7, reason: 'No venue data' }],
        totalExpectedCost: quantity * 0.003,
        expectedAvgFillRate: 0.7,
        avgLatency: 10,
      };
    }

    const totalScore = scores.reduce((s, v) => s + v.composite, 0);
    if (totalScore <= 0) {
      const top = scores[0];
      return {
        decisions: [{ venue: top.venue, quantity, expectedCost: quantity * 0.003, expectedFillRate: 0.5, reason: 'Fallback' }],
        totalExpectedCost: quantity * 0.003,
        expectedAvgFillRate: 0.5,
        avgLatency: 10,
      };
    }

    const decisions: RoutingDecision[] = [];
    let allocated = 0;

    for (const score of scores) {
      if (allocated >= quantity) break;

      let share = score.composite / totalScore;
      share = Math.max(share, this.config.minVenueAllocation);
      share = Math.min(share, this.config.maxVenueAllocation);

      let venueQty = Math.round(quantity * share);
      venueQty = Math.min(venueQty, quantity - allocated);
      if (venueQty <= 0) continue;

      const stats = this.venueStatsCache.get(score.venue);
      const netFee = stats ? (stats.feePerShare - stats.rebatePerShare) : 0.003;

      decisions.push({
        venue: score.venue,
        quantity: venueQty,
        expectedCost: venueQty * netFee,
        expectedFillRate: stats?.avgFillRate ?? 0.5,
        reason: `Score ${score.composite.toFixed(1)} | fill ${((stats?.avgFillRate ?? 0) * 100).toFixed(0)}% | ${stats?.avgLatencyMs.toFixed(0) ?? '?'}ms`,
      });

      allocated += venueQty;
    }

    // Remainder to top venue
    if (allocated < quantity && decisions.length > 0) {
      decisions[0].quantity += quantity - allocated;
    }

    const totalExpectedCost = decisions.reduce((s, d) => s + d.expectedCost, 0);
    const weightedFillRate = decisions.reduce((s, d) => s + d.expectedFillRate * d.quantity, 0) / quantity;
    const avgLatency = scores.reduce((s, sc) => {
      const st = this.venueStatsCache.get(sc.venue);
      return s + (st?.avgLatencyMs ?? 10);
    }, 0) / Math.max(1, scores.length);

    return { decisions, totalExpectedCost, expectedAvgFillRate: weightedFillRate, avgLatency };
  }

  // ── Dark Pool Integration ──────────────────────────────────────────────────

  routeToDarkPool(
    symbol: string,
    side: OrderSide,
    quantity: number,
    midPrice: number,
    darkConfig: DarkPoolConfig,
  ): RoutingDecision | null {
    if (quantity < darkConfig.minBlockSize) return null;

    // Check if any dark pool has acceptable metrics
    const darkVenues = darkConfig.allowedPools.length > 0
      ? darkConfig.allowedPools
      : [Venue.DARK_POOL];

    let bestPool: Venue | null = null;
    let bestScore = -Infinity;

    for (const pool of darkVenues) {
      const stats = this.venueStatsCache.get(pool);
      if (!stats) continue;

      const score =
        stats.avgFillRate * 40 +
        stats.priceImprovement * 10000 * 30 -
        stats.toxicityScore * 30;

      if (score > bestScore) {
        bestScore = score;
        bestPool = pool;
      }
    }

    if (!bestPool) return null;

    const stats = this.venueStatsCache.get(bestPool);
    const priceDeviation = stats ? Math.abs(stats.priceImprovement) / midPrice : 0;
    if (priceDeviation > darkConfig.maxPriceDeviation) return null;

    const pegPrice = darkConfig.midpointPegEnabled ? midPrice : undefined;

    return {
      venue: bestPool,
      quantity,
      expectedCost: quantity * (stats ? stats.feePerShare - stats.rebatePerShare : 0),
      expectedFillRate: stats?.avgFillRate ?? 0.3,
      reason: `Dark pool ${bestPool} | midpoint peg: ${pegPrice?.toFixed(2) ?? 'off'}`,
    };
  }

  // ── Internalization Detection ──────────────────────────────────────────────

  detectInternalization(fills: Fill[]): {
    internalizationRate: number;
    internalFills: number;
    externalFills: number;
    avgInternalImprovement: number;
    concerns: string[];
  } {
    const internal = fills.filter((f) => f.venue === Venue.INTERNAL);
    const external = fills.filter((f) => f.venue !== Venue.INTERNAL);
    const rate = fills.length > 0 ? internal.length / fills.length : 0;

    let avgImprovement = 0;
    if (internal.length > 0) {
      avgImprovement = internal.reduce((s, f) => {
        const isBuy = f.side === OrderSide.BUY || f.side === OrderSide.BUY_TO_COVER;
        return s + (isBuy ? -f.price : f.price);
      }, 0) / internal.length;
    }

    const concerns: string[] = [];
    if (rate > this.config.internalizationThreshold) {
      concerns.push(`High internalization rate: ${(rate * 100).toFixed(1)}% exceeds ${(this.config.internalizationThreshold * 100).toFixed(0)}% threshold`);
    }
    if (avgImprovement < 0) {
      concerns.push('Internalized fills showing negative price improvement');
    }
    if (internal.length > 10 && external.length === 0) {
      concerns.push('All fills internalized — no venue competition');
    }

    return {
      internalizationRate: rate,
      internalFills: internal.length,
      externalFills: external.length,
      avgInternalImprovement: avgImprovement,
      concerns,
    };
  }

  // ── Toxicity-Aware Routing ─────────────────────────────────────────────────

  routeWithToxicityAwareness(
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number,
    vpinScore: number,
  ): SplitResult {
    // In high-toxicity regime, prefer venues with lower adverse selection
    if (vpinScore > 0.6) {
      this.adaptiveState.regime = 'HIGH_VOLATILITY';

      // Boost dark pools and IEX-like venues that protect against toxicity
      const adjustedScores = this.scoreVenues(symbol, side, quantity);
      for (const score of adjustedScores) {
        const stats = this.venueStatsCache.get(score.venue);
        if (stats && stats.toxicityScore < 0.3) {
          score.composite *= 1.3;
        }
        if (score.venue === Venue.IEX) {
          score.composite *= 1.2;
        }
      }
    }

    return this.splitOrder(symbol, side, quantity, price);
  }

  // ── Latency Optimization ───────────────────────────────────────────────────

  optimizeForLatency(
    symbol: string,
    side: OrderSide,
    quantity: number,
    maxLatencyMs: number,
  ): RoutingDecision[] {
    const scores = this.scoreVenues(symbol, side, quantity);
    const fastVenues = scores.filter((s) => {
      const stats = this.venueStatsCache.get(s.venue);
      return stats && stats.avgLatencyMs <= maxLatencyMs;
    });

    if (fastVenues.length === 0) {
      // Fall back to fastest available
      const allByLatency = [...this.venueStatsCache.entries()]
        .sort((a, b) => a[1].avgLatencyMs - b[1].avgLatencyMs);

      if (allByLatency.length > 0) {
        return [{
          venue: allByLatency[0][0],
          quantity,
          expectedCost: quantity * allByLatency[0][1].feePerShare,
          expectedFillRate: allByLatency[0][1].avgFillRate,
          reason: `Fastest venue: ${allByLatency[0][1].avgLatencyMs.toFixed(0)}ms`,
        }];
      }

      return [{ venue: Venue.NYSE, quantity, expectedCost: quantity * 0.003, expectedFillRate: 0.7, reason: 'Default' }];
    }

    // Distribute among fast venues proportionally to score
    const totalScore = fastVenues.reduce((s, v) => s + v.composite, 0);
    const decisions: RoutingDecision[] = [];
    let allocated = 0;

    for (const v of fastVenues) {
      if (allocated >= quantity) break;
      const share = totalScore > 0 ? v.composite / totalScore : 1 / fastVenues.length;
      let venueQty = Math.round(quantity * share);
      venueQty = Math.min(venueQty, quantity - allocated);
      if (venueQty <= 0) continue;
      allocated += venueQty;

      const stats = this.venueStatsCache.get(v.venue);
      decisions.push({
        venue: v.venue,
        quantity: venueQty,
        expectedCost: venueQty * (stats ? stats.feePerShare - stats.rebatePerShare : 0.003),
        expectedFillRate: stats?.avgFillRate ?? 0.5,
        reason: `Latency-opt: ${stats?.avgLatencyMs.toFixed(0) ?? '?'}ms`,
      });
    }

    if (allocated < quantity && decisions.length > 0) {
      decisions[0].quantity += quantity - allocated;
    }

    return decisions;
  }

  // ── Adaptive Routing ───────────────────────────────────────────────────────

  recordFillOutcome(venue: Venue, fillRate: number, cost: number, reverted: boolean): void {
    let history = this.adaptiveState.venueHistory.get(venue);
    if (!history) {
      history = { recentFills: [], ewmaFillRate: 0.5, ewmaCost: 0.003, ewmaRevert: 0.1 };
      this.adaptiveState.venueHistory.set(venue, history);
    }

    history.recentFills.push({ timestamp: Date.now(), fillRate, cost, reverted });

    // Trim old entries
    const cutoff = Date.now() - this.config.adaptiveLookback;
    history.recentFills = history.recentFills.filter((f) => f.timestamp >= cutoff);

    // EWMA update (α = 0.1)
    const alpha = 0.1;
    history.ewmaFillRate = alpha * fillRate + (1 - alpha) * history.ewmaFillRate;
    history.ewmaCost = alpha * cost + (1 - alpha) * history.ewmaCost;
    history.ewmaRevert = alpha * (reverted ? 1 : 0) + (1 - alpha) * history.ewmaRevert;
  }

  detectRegime(volatility: number, averageSpread: number, volume: number, typicalVolume: number): void {
    if (volatility > 0.03) {
      this.adaptiveState.regime = 'HIGH_VOLATILITY';
    } else if (volume < typicalVolume * 0.3) {
      this.adaptiveState.regime = 'LOW_LIQUIDITY';
    } else if (averageSpread > 0.005) {
      this.adaptiveState.regime = 'FAST_MARKET';
    } else {
      this.adaptiveState.regime = 'NORMAL';
    }
  }

  adaptiveRoute(
    symbol: string,
    side: OrderSide,
    quantity: number,
    price: number,
  ): SplitResult {
    const regime = this.adaptiveState.regime;

    // Adjust config based on regime
    const adjustedConfig = { ...this.config };

    switch (regime) {
      case 'HIGH_VOLATILITY':
        adjustedConfig.latencyWeight *= 1.5;
        adjustedConfig.toxicityWeight *= 2;
        adjustedConfig.darkPoolPreference *= 0.5;
        break;
      case 'LOW_LIQUIDITY':
        adjustedConfig.fillRateWeight *= 1.5;
        adjustedConfig.maxVenueAllocation = 0.80;
        adjustedConfig.darkPoolPreference *= 1.5;
        break;
      case 'FAST_MARKET':
        adjustedConfig.latencyWeight *= 2;
        adjustedConfig.costWeight *= 0.5;
        break;
    }

    // Normalize weights
    const totalWeight =
      adjustedConfig.fillRateWeight +
      adjustedConfig.costWeight +
      adjustedConfig.latencyWeight +
      adjustedConfig.improvementWeight +
      adjustedConfig.toxicityWeight +
      adjustedConfig.revertWeight;

    adjustedConfig.fillRateWeight /= totalWeight;
    adjustedConfig.costWeight /= totalWeight;
    adjustedConfig.latencyWeight /= totalWeight;
    adjustedConfig.improvementWeight /= totalWeight;
    adjustedConfig.toxicityWeight /= totalWeight;
    adjustedConfig.revertWeight /= totalWeight;

    const savedConfig = this.config;
    this.config = adjustedConfig;
    const result = this.splitOrder(symbol, side, quantity, price);
    this.config = savedConfig;

    return result;
  }

  getAdaptiveState(): AdaptiveState {
    return this.adaptiveState;
  }

  getVenueScoreSummary(symbol: string, side: OrderSide, quantity: number): Array<{
    venue: Venue;
    score: number;
    stats: VenueStats | undefined;
  }> {
    const scores = this.scoreVenues(symbol, side, quantity);
    return scores.map((s) => ({
      venue: s.venue,
      score: s.composite,
      stats: this.venueStatsCache.get(s.venue),
    }));
  }
}
