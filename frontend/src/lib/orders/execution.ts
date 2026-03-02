import {
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  TimeInForce,
  AlgoType,
  AlgoSlice,
  AlgoSchedule,
  AlgoCostEstimate,
  AlgoRiskMetrics,
  TWAPParams,
  VWAPParams,
  ISParams,
  POVParams,
  ArrivalPriceParams,
  ClosePriceParams,
  IcebergParams,
  PairsParams,
  BasketParams,
  Venue,
  RoutingDecision,
  VenueStats,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Algo Result ─────────────────────────────────────────────────────────────

export interface AlgoResult {
  schedule: AlgoSchedule;
  expectedCost: AlgoCostEstimate;
  riskMetrics: AlgoRiskMetrics;
  childOrders: Partial<Order>[];
}

// ─── TWAP ────────────────────────────────────────────────────────────────────

export function executeTWAP(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: TWAPParams,
  currentPrice: number,
): AlgoResult {
  const duration = params.endTime - params.startTime;
  const numSlices = Math.max(1, Math.floor(duration / params.sliceIntervalMs));
  const baseSliceQty = Math.floor(totalQuantity / numSlices);
  let remainder = totalQuantity - baseSliceQty * numSlices;
  const randomizePct = params.randomizePct ?? 0;

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];

  for (let i = 0; i < numSlices; i++) {
    let sliceQty = baseSliceQty + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    if (randomizePct > 0) {
      const jitter = 1 + (normalRandom() * randomizePct) / 100;
      sliceQty = Math.max(1, Math.round(sliceQty * jitter));
    }

    const scheduledTime = params.startTime + i * params.sliceIntervalMs;

    slices.push({
      scheduledTime,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: params.limitPrice ? OrderType.LIMIT : OrderType.MARKET,
      price: params.limitPrice,
      quantity: sliceQty,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    });
  }

  const participationRate = params.participationCap ?? 0.1;
  const volatility = 0.02;
  const spreadCost = currentPrice * 0.0001 * totalQuantity;
  const impactCost = 0.5 * volatility * currentPrice * Math.sqrt(totalQuantity / 1_000_000) * totalQuantity;
  const timingRisk = volatility * currentPrice * Math.sqrt(duration / 86_400_000) * totalQuantity;

  return {
    schedule: {
      algoType: AlgoType.TWAP,
      totalQuantity,
      slices,
      estimatedDuration: duration,
      estimatedCompletionTime: params.endTime,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: spreadCost + impactCost + timingRisk + totalQuantity * 0.005,
      costBps: ((spreadCost + impactCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost + timingRisk,
      trackingError: timingRisk / (currentPrice * totalQuantity),
      participationRate,
      completionRisk: 1 - Math.min(1, participationRate * numSlices),
      informationLeakage: participationRate * 0.3,
    },
    childOrders,
  };
}

// ─── VWAP ────────────────────────────────────────────────────────────────────

export function executeVWAP(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: VWAPParams,
  currentPrice: number,
): AlgoResult {
  const profile = params.volumeProfile;
  const totalProfileVol = profile.reduce((s, v) => s + v, 0);
  if (totalProfileVol === 0) {
    throw new Error('Volume profile sums to zero');
  }

  const duration = params.endTime - params.startTime;
  const sliceInterval = duration / profile.length;
  const minSlice = params.minSliceSize ?? 1;

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let allocated = 0;

  for (let i = 0; i < profile.length; i++) {
    const weight = profile[i] / totalProfileVol;
    let sliceQty = Math.max(minSlice, Math.round(totalQuantity * weight));

    if (i === profile.length - 1) {
      sliceQty = totalQuantity - allocated;
    } else {
      sliceQty = Math.min(sliceQty, totalQuantity - allocated);
    }

    allocated += sliceQty;

    slices.push({
      scheduledTime: params.startTime + i * sliceInterval,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    if (sliceQty > 0) {
      childOrders.push({
        id: generateId(),
        symbol,
        side,
        type: params.limitPrice ? OrderType.LIMIT : OrderType.MARKET,
        price: params.limitPrice,
        quantity: sliceQty,
        timeInForce: TimeInForce.IOC,
        status: OrderStatus.NEW,
      });
    }
  }

  const maxParticipation = params.maxParticipation ?? 0.2;
  const spreadCost = currentPrice * 0.00008 * totalQuantity;
  const impactCost = 0.4 * 0.02 * currentPrice * Math.sqrt(totalQuantity / 1_000_000) * totalQuantity;
  const timingRisk = 0.02 * currentPrice * Math.sqrt(duration / 86_400_000) * totalQuantity * 0.5;

  return {
    schedule: {
      algoType: AlgoType.VWAP,
      totalQuantity,
      slices,
      estimatedDuration: duration,
      estimatedCompletionTime: params.endTime,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: spreadCost + impactCost + timingRisk + totalQuantity * 0.005,
      costBps: ((spreadCost + impactCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost + timingRisk,
      trackingError: timingRisk / (currentPrice * totalQuantity),
      participationRate: maxParticipation,
      completionRisk: 0.05,
      informationLeakage: maxParticipation * 0.2,
    },
    childOrders,
  };
}

// ─── Implementation Shortfall (Almgren-Chriss) ──────────────────────────────

export function executeImplementationShortfall(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: ISParams,
  currentPrice: number,
): AlgoResult {
  const { urgency, riskAversion, volatility, dailyVolume, temporaryImpact, permanentImpact } = params;

  // Almgren-Chriss optimal trajectory
  // X(t) = X_0 * sinh(κ(T-t)) / sinh(κT)
  // κ = sqrt(λσ² / η) where λ = risk aversion, σ = volatility, η = temporary impact
  const T = (params.endTime - params.startTime) / 86_400_000; // in days
  const kappa = Math.sqrt((riskAversion * volatility * volatility) / Math.max(temporaryImpact, 1e-10));
  const kappaT = kappa * T;

  const numSlices = Math.max(5, Math.min(100, Math.ceil(T * 78))); // ~78 slices/day (5-min intervals)
  const dt = T / numSlices;

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let previousHolding = totalQuantity;

  for (let i = 1; i <= numSlices; i++) {
    const t = i * dt;
    const remainingTime = T - t;
    const holding = kappaT > 0
      ? totalQuantity * Math.sinh(kappa * remainingTime) / Math.sinh(kappaT)
      : totalQuantity * (1 - t / T);

    const tradeQty = Math.max(0, Math.round(previousHolding - holding));
    previousHolding = holding;

    if (tradeQty <= 0) continue;

    const scheduledTime = params.startTime + i * dt * 86_400_000;

    slices.push({
      scheduledTime,
      targetQuantity: tradeQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: OrderType.LIMIT,
      quantity: tradeQty,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    });
  }

  // Cost decomposition
  const participation = dailyVolume > 0 ? totalQuantity / dailyVolume : 0;
  const permImpactCost = permanentImpact * volatility * currentPrice * participation * totalQuantity;
  const tempImpactCost = temporaryImpact * volatility * currentPrice * Math.sqrt(participation) * totalQuantity;
  const timingCost = 0.5 * riskAversion * volatility * volatility * currentPrice * currentPrice * T * totalQuantity;

  return {
    schedule: {
      algoType: AlgoType.IMPLEMENTATION_SHORTFALL,
      totalQuantity,
      slices,
      estimatedDuration: (params.endTime - params.startTime),
      estimatedCompletionTime: params.endTime,
    },
    expectedCost: {
      spreadCost: currentPrice * 0.0001 * totalQuantity,
      impactCost: permImpactCost + tempImpactCost,
      timingRisk: timingCost,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: permImpactCost + tempImpactCost + timingCost + totalQuantity * 0.005,
      costBps: ((permImpactCost + tempImpactCost + timingCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: permImpactCost + tempImpactCost + 1.5 * timingCost,
      trackingError: volatility * Math.sqrt(T) * participation,
      participationRate: participation / T,
      completionRisk: participation > 0.3 ? 0.15 : 0.03,
      informationLeakage: urgency * 0.2,
    },
    childOrders,
  };
}

// ─── POV (Percentage of Volume) ──────────────────────────────────────────────

export function executePOV(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: POVParams,
  currentPrice: number,
  estimatedVolumeProfile: number[],
): AlgoResult {
  const duration = params.endTime - params.startTime;
  const numSlices = estimatedVolumeProfile.length || 20;
  const sliceInterval = duration / numSlices;
  const targetRate = clamp(params.targetRate, params.minRate ?? 0.01, params.maxRate ?? 0.5);

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let allocated = 0;

  for (let i = 0; i < numSlices && allocated < totalQuantity; i++) {
    const expectedSliceVolume = estimatedVolumeProfile[i] ?? (totalQuantity / numSlices / targetRate);
    let sliceQty = Math.round(expectedSliceVolume * targetRate);
    sliceQty = Math.min(sliceQty, totalQuantity - allocated);

    if (sliceQty <= 0) continue;
    allocated += sliceQty;

    slices.push({
      scheduledTime: params.startTime + i * sliceInterval,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: params.limitPrice ? OrderType.LIMIT : OrderType.MARKET,
      price: params.limitPrice,
      quantity: sliceQty,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    });
  }

  const volatility = 0.02;
  const spreadCost = currentPrice * 0.0001 * totalQuantity;
  const impactCost = 0.3 * volatility * currentPrice * Math.sqrt(targetRate) * totalQuantity;

  return {
    schedule: {
      algoType: AlgoType.POV,
      totalQuantity,
      slices,
      estimatedDuration: duration,
      estimatedCompletionTime: params.endTime,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk: volatility * currentPrice * Math.sqrt(duration / 86_400_000) * totalQuantity * targetRate,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: spreadCost + impactCost + totalQuantity * 0.005,
      costBps: ((spreadCost + impactCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost * 1.5,
      trackingError: volatility * targetRate,
      participationRate: targetRate,
      completionRisk: allocated < totalQuantity ? (totalQuantity - allocated) / totalQuantity : 0,
      informationLeakage: targetRate * 0.25,
    },
    childOrders,
  };
}

// ─── Arrival Price ───────────────────────────────────────────────────────────

export function executeArrivalPrice(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: ArrivalPriceParams,
  currentPrice: number,
  dailyVolume: number,
): AlgoResult {
  const { arrivalPrice, urgency, riskAversion, volatility } = params;
  const duration = params.endTime - params.startTime;
  const T = duration / 86_400_000;

  // Front-loaded schedule: trade more aggressively early to minimize drift from arrival
  const numSlices = Math.max(5, Math.ceil(T * 78));
  const decayFactor = 1 + urgency * 2;

  const weights: number[] = [];
  for (let i = 0; i < numSlices; i++) {
    weights.push(Math.exp(-decayFactor * i / numSlices));
  }
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let allocated = 0;

  for (let i = 0; i < numSlices; i++) {
    let sliceQty = Math.round(totalQuantity * weights[i] / totalWeight);
    if (i === numSlices - 1) sliceQty = totalQuantity - allocated;
    sliceQty = Math.min(sliceQty, totalQuantity - allocated);
    if (sliceQty <= 0) continue;
    allocated += sliceQty;

    slices.push({
      scheduledTime: params.startTime + (i * duration) / numSlices,
      targetQuantity: sliceQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: OrderType.LIMIT,
      price: arrivalPrice * (side === OrderSide.BUY ? 1.001 : 0.999),
      quantity: sliceQty,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    });
  }

  const participation = dailyVolume > 0 ? totalQuantity / dailyVolume : 0;
  const impactCost = volatility * currentPrice * Math.sqrt(participation) * totalQuantity * 0.6;
  const timingRisk = riskAversion * volatility * currentPrice * Math.sqrt(T) * totalQuantity * 0.3;

  return {
    schedule: {
      algoType: AlgoType.ARRIVAL_PRICE,
      totalQuantity,
      slices,
      estimatedDuration: duration,
      estimatedCompletionTime: params.endTime,
    },
    expectedCost: {
      spreadCost: currentPrice * 0.00008 * totalQuantity,
      impactCost,
      timingRisk,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: impactCost + timingRisk + totalQuantity * 0.005,
      costBps: ((impactCost + timingRisk) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost + 1.5 * timingRisk,
      trackingError: volatility * Math.sqrt(T) * 0.5,
      participationRate: participation / T,
      completionRisk: urgency > 0.8 ? 0.02 : 0.08,
      informationLeakage: urgency * 0.15,
    },
    childOrders,
  };
}

// ─── Close Price ─────────────────────────────────────────────────────────────

export function executeClosePrice(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: ClosePriceParams,
  currentPrice: number,
): AlgoResult {
  const duration = params.closeTime - params.startTime;
  const mooQty = Math.round(totalQuantity * params.mooVolumePct);
  const closingQty = Math.round(totalQuantity * params.targetPct);
  const intradayQty = totalQuantity - mooQty - closingQty;

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];

  // MOO portion
  if (mooQty > 0) {
    slices.push({
      scheduledTime: params.startTime,
      targetQuantity: mooQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });
    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: OrderType.MOO,
      quantity: mooQty,
      timeInForce: TimeInForce.OPG,
      status: OrderStatus.NEW,
    });
  }

  // Intraday TWAP portion
  if (intradayQty > 0) {
    const intradaySlices = 20;
    const intradayInterval = (duration * 0.8) / intradaySlices;
    const perSlice = Math.floor(intradayQty / intradaySlices);
    let rem = intradayQty - perSlice * intradaySlices;

    for (let i = 0; i < intradaySlices; i++) {
      const qty = perSlice + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;

      slices.push({
        scheduledTime: params.startTime + 600_000 + i * intradayInterval,
        targetQuantity: qty,
        executedQuantity: 0,
        avgPrice: 0,
        status: 'PENDING',
      });
      childOrders.push({
        id: generateId(),
        symbol,
        side,
        type: OrderType.LIMIT,
        quantity: qty,
        timeInForce: TimeInForce.IOC,
        status: OrderStatus.NEW,
      });
    }
  }

  // MOC portion
  if (closingQty > 0) {
    slices.push({
      scheduledTime: params.closeTime - 300_000,
      targetQuantity: closingQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });
    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: OrderType.MOC,
      quantity: closingQty,
      timeInForce: TimeInForce.CLS,
      status: OrderStatus.NEW,
    });
  }

  const spreadCost = currentPrice * 0.0001 * totalQuantity;
  const impactCost = 0.3 * 0.02 * currentPrice * Math.sqrt(totalQuantity / 1_000_000) * totalQuantity;

  return {
    schedule: {
      algoType: AlgoType.CLOSE_PRICE,
      totalQuantity,
      slices,
      estimatedDuration: duration,
      estimatedCompletionTime: params.closeTime,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk: 0.02 * currentPrice * Math.sqrt(duration / 86_400_000) * totalQuantity * 0.4,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: spreadCost + impactCost + totalQuantity * 0.005,
      costBps: ((spreadCost + impactCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost * 1.3,
      trackingError: 0.02 * Math.sqrt(duration / 86_400_000) * 0.5,
      participationRate: params.targetPct,
      completionRisk: 0.02,
      informationLeakage: 0.1,
    },
    childOrders,
  };
}

// ─── Iceberg ─────────────────────────────────────────────────────────────────

export function executeIceberg(
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  params: IcebergParams,
  currentPrice: number,
): AlgoResult {
  const variance = params.variance ?? 0;
  const refreshTrigger = params.refreshTrigger ?? 0;
  const numWaves = Math.ceil(totalQuantity / params.displayQuantity);

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let allocated = 0;

  for (let i = 0; i < numWaves; i++) {
    let displayQty = params.displayQuantity;
    if (variance > 0) {
      displayQty = Math.max(1, Math.round(displayQty * (1 + (Math.random() - 0.5) * 2 * variance)));
    }
    displayQty = Math.min(displayQty, totalQuantity - allocated);
    if (displayQty <= 0) break;
    allocated += displayQty;

    slices.push({
      scheduledTime: Date.now() + i * 1000,
      targetQuantity: displayQty,
      executedQuantity: 0,
      avgPrice: 0,
      status: 'PENDING',
    });

    childOrders.push({
      id: generateId(),
      symbol,
      side,
      type: OrderType.LIMIT,
      price: params.limitPrice,
      quantity: displayQty,
      timeInForce: TimeInForce.GTC,
      status: OrderStatus.NEW,
    });
  }

  const spreadCost = currentPrice * 0.00005 * totalQuantity;
  const impactCost = 0.15 * 0.02 * currentPrice * Math.sqrt(totalQuantity / 1_000_000) * totalQuantity;

  return {
    schedule: {
      algoType: AlgoType.ICEBERG,
      totalQuantity,
      slices,
      estimatedDuration: numWaves * 5000,
      estimatedCompletionTime: Date.now() + numWaves * 5000,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk: 0.02 * currentPrice * Math.sqrt(numWaves * 5 / 86_400) * totalQuantity * 0.2,
      commissions: totalQuantity * 0.005,
      totalExpectedCost: spreadCost + impactCost + totalQuantity * 0.005,
      costBps: ((spreadCost + impactCost) / (currentPrice * totalQuantity)) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost * 1.2,
      trackingError: 0.005,
      participationRate: params.displayQuantity / totalQuantity,
      completionRisk: 0.1,
      informationLeakage: 0.05,
    },
    childOrders,
  };
}

// ─── Smart Order Router (multi-venue) ────────────────────────────────────────

export function routeOrder(
  symbol: string,
  side: OrderSide,
  quantity: number,
  price: number | undefined,
  venueStats: VenueStats[],
): RoutingDecision[] {
  if (venueStats.length === 0) {
    return [{
      venue: Venue.NYSE,
      quantity,
      expectedCost: quantity * 0.005,
      expectedFillRate: 0.7,
      reason: 'Default venue — no stats available',
    }];
  }

  // Score each venue: higher is better
  const scored = venueStats.map((vs) => {
    const fillScore = vs.avgFillRate * 40;
    const costScore = (1 - vs.feePerShare / 0.01) * 20;
    const latencyScore = (1 - vs.avgLatencyMs / 100) * 15;
    const improvementScore = vs.priceImprovement * 1000 * 15;
    const toxicityPenalty = vs.toxicityScore * 10;
    const score = fillScore + costScore + latencyScore + improvementScore - toxicityPenalty;
    return { venue: vs, score: Math.max(0, score) };
  });

  scored.sort((a, b) => b.score - a.score);
  const totalScore = scored.reduce((s, v) => s + v.score, 0);
  if (totalScore === 0) {
    return [{ venue: scored[0].venue.venue, quantity, expectedCost: quantity * 0.005, expectedFillRate: 0.5, reason: 'Fallback' }];
  }

  const decisions: RoutingDecision[] = [];
  let allocated = 0;

  for (const { venue: vs, score } of scored) {
    if (allocated >= quantity) break;
    const share = score / totalScore;
    let venueQty = Math.round(quantity * share);
    venueQty = Math.min(venueQty, quantity - allocated);
    if (venueQty <= 0) continue;
    allocated += venueQty;

    decisions.push({
      venue: vs.venue,
      quantity: venueQty,
      expectedCost: venueQty * (vs.feePerShare - vs.rebatePerShare),
      expectedFillRate: vs.avgFillRate,
      reason: `Score ${score.toFixed(1)} — fill ${(vs.avgFillRate * 100).toFixed(0)}%, latency ${vs.avgLatencyMs.toFixed(0)}ms`,
    });
  }

  // Sweep remainder to top venue
  if (allocated < quantity && decisions.length > 0) {
    decisions[0].quantity += quantity - allocated;
  }

  return decisions;
}

// ─── Pairs Trading Execution ─────────────────────────────────────────────────

export function executePairs(
  params: PairsParams,
  totalNotional: number,
  priceA: number,
  priceB: number,
): AlgoResult {
  const { legA, legB, spreadTarget, spreadTolerance, maxLegging } = params;

  const qtyA = Math.round((totalNotional * legA.ratio) / priceA);
  const qtyB = Math.round((totalNotional * legB.ratio) / priceB);
  const currentSpread = (priceA * legA.ratio) - (priceB * legB.ratio);
  const spreadDiff = currentSpread - spreadTarget;

  const slices: AlgoSlice[] = [
    {
      scheduledTime: Date.now(),
      targetQuantity: qtyA,
      executedQuantity: 0,
      avgPrice: 0,
      status: Math.abs(spreadDiff) <= spreadTolerance ? 'PENDING' : 'SKIPPED',
    },
    {
      scheduledTime: Date.now() + 100,
      targetQuantity: qtyB,
      executedQuantity: 0,
      avgPrice: 0,
      status: Math.abs(spreadDiff) <= spreadTolerance ? 'PENDING' : 'SKIPPED',
    },
  ];

  const childOrders: Partial<Order>[] = [
    {
      id: generateId(),
      symbol: legA.symbol,
      side: legA.side,
      type: OrderType.LIMIT,
      price: priceA,
      quantity: qtyA,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    },
    {
      id: generateId(),
      symbol: legB.symbol,
      side: legB.side,
      type: OrderType.LIMIT,
      price: priceB,
      quantity: qtyB,
      timeInForce: TimeInForce.IOC,
      status: OrderStatus.NEW,
    },
  ];

  const totalValue = qtyA * priceA + qtyB * priceB;
  const spreadCost = totalValue * 0.0001;
  const leggingRisk = maxLegging * 0.02 * totalValue;

  return {
    schedule: {
      algoType: AlgoType.PAIRS,
      totalQuantity: qtyA + qtyB,
      slices,
      estimatedDuration: 5000,
      estimatedCompletionTime: Date.now() + 5000,
    },
    expectedCost: {
      spreadCost,
      impactCost: totalValue * 0.0003,
      timingRisk: leggingRisk,
      commissions: (qtyA + qtyB) * 0.005,
      totalExpectedCost: spreadCost + totalValue * 0.0003 + leggingRisk,
      costBps: ((spreadCost + totalValue * 0.0003) / totalValue) * 10000,
    },
    riskMetrics: {
      expectedShortfall: leggingRisk * 2,
      trackingError: spreadTolerance / spreadTarget,
      participationRate: 0,
      completionRisk: Math.abs(spreadDiff) > spreadTolerance ? 0.5 : 0.05,
      informationLeakage: 0.05,
    },
    childOrders,
  };
}

// ─── Basket Trading Execution ────────────────────────────────────────────────

export function executeBasket(
  params: BasketParams,
  prices: Record<string, number>,
  dailyVolumes: Record<string, number>,
): AlgoResult {
  const legs = params.legs;
  const maxPart = params.maxParticipation ?? 0.15;

  const slices: AlgoSlice[] = [];
  const childOrders: Partial<Order>[] = [];
  let totalNotional = 0;

  for (const leg of legs) {
    const price = prices[leg.symbol] ?? 0;
    const volume = dailyVolumes[leg.symbol] ?? 1_000_000;
    const qty = leg.quantity;
    const participation = qty / volume;
    const numSlices = Math.max(1, Math.ceil(participation / maxPart));
    const sliceQty = Math.ceil(qty / numSlices);

    totalNotional += qty * price;

    for (let i = 0; i < numSlices; i++) {
      const thisQty = Math.min(sliceQty, qty - i * sliceQty);
      if (thisQty <= 0) continue;

      slices.push({
        scheduledTime: Date.now() + i * 60_000,
        targetQuantity: thisQty,
        executedQuantity: 0,
        avgPrice: 0,
        status: 'PENDING',
      });

      childOrders.push({
        id: generateId(),
        symbol: leg.symbol,
        side: leg.side,
        type: OrderType.LIMIT,
        price: price * (leg.side === OrderSide.BUY ? 1.001 : 0.999),
        quantity: thisQty,
        timeInForce: TimeInForce.IOC,
        status: OrderStatus.NEW,
      });
    }
  }

  const spreadCost = totalNotional * 0.0001;
  const impactCost = totalNotional * 0.0005;

  return {
    schedule: {
      algoType: AlgoType.BASKET,
      totalQuantity: legs.reduce((s, l) => s + l.quantity, 0),
      slices,
      estimatedDuration: slices.length * 60_000,
      estimatedCompletionTime: Date.now() + slices.length * 60_000,
    },
    expectedCost: {
      spreadCost,
      impactCost,
      timingRisk: totalNotional * 0.0003,
      commissions: legs.reduce((s, l) => s + l.quantity, 0) * 0.005,
      totalExpectedCost: spreadCost + impactCost + totalNotional * 0.0003,
      costBps: ((spreadCost + impactCost) / totalNotional) * 10000,
    },
    riskMetrics: {
      expectedShortfall: impactCost * 1.5,
      trackingError: params.trackingError ?? 0.01,
      participationRate: maxPart,
      completionRisk: 0.05,
      informationLeakage: 0.1,
    },
    childOrders,
  };
}
