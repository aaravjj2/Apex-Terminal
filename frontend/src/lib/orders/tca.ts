import { Fill, OrderSide, Venue, VenueStats } from './types';

// ─── TCA Types ───────────────────────────────────────────────────────────────

export interface ISDecomposition {
  delayCost: number;
  tradingCost: number;
  opportunityCost: number;
  totalIS: number;
  delayCostBps: number;
  tradingCostBps: number;
  opportunityCostBps: number;
  totalISBps: number;
}

export interface VWAPSlippage {
  benchmarkVWAP: number;
  executionVWAP: number;
  slippage: number;
  slippageBps: number;
  signedSlippage: number;
}

export interface MarketImpactEstimate {
  temporaryImpact: number;
  permanentImpact: number;
  totalImpact: number;
  temporaryImpactBps: number;
  permanentImpactBps: number;
  totalImpactBps: number;
  decayHalfLife: number;
}

export interface TimingCostResult {
  arrivalPrice: number;
  executionPrice: number;
  closingPrice: number;
  arrivalSlippage: number;
  arrivalSlippageBps: number;
  closingSlippage: number;
  closingSlippageBps: number;
  intervalReturn: number;
}

export interface VenueAnalysis {
  venue: Venue;
  fillRate: number;
  avgSpread: number;
  avgSpreadBps: number;
  priceImprovement: number;
  priceImprovementBps: number;
  avgFillSize: number;
  revertRate5s: number;
  revertRate30s: number;
  toxicityScore: number;
  numFills: number;
  totalVolume: number;
}

export interface CommissionAnalysis {
  totalCommissions: number;
  avgCommissionPerShare: number;
  avgCommissionBps: number;
  exchangeFees: number;
  clearingFees: number;
  regulatoryFees: number;
  estimatedAllIn: number;
}

export interface TotalCostOfOwnership {
  explicitCosts: number;
  implicitCosts: number;
  spreadCost: number;
  marketImpact: number;
  timingCost: number;
  opportunityCost: number;
  commissions: number;
  taxes: number;
  totalCost: number;
  totalCostBps: number;
}

export interface BestExecutionReport {
  orderId: string;
  symbol: string;
  side: OrderSide;
  totalQuantity: number;
  executedQuantity: number;
  benchmarkPrice: number;
  executionPrice: number;
  isDecomposition: ISDecomposition;
  vwapSlippage: VWAPSlippage;
  marketImpact: MarketImpactEstimate;
  venueBreakdown: VenueAnalysis[];
  commissions: CommissionAnalysis;
  totalCost: TotalCostOfOwnership;
  mifidCompliance: MiFIDIICompliance;
  timestamp: number;
}

export interface MiFIDIICompliance {
  bestExecutionAchieved: boolean;
  priceScore: number;
  costScore: number;
  speedScore: number;
  likelihoodScore: number;
  overallScore: number;
  factors: string[];
  reportingTimestamp: number;
}

export interface TCAAggregate {
  groupKey: string;
  numOrders: number;
  totalVolume: number;
  totalNotional: number;
  avgSlippageBps: number;
  avgImpactBps: number;
  avgCommissionBps: number;
  totalCostBps: number;
  fillRate: number;
  avgDuration: number;
}

export interface TCAHistoricalTrend {
  period: string;
  avgSlippageBps: number;
  avgImpactBps: number;
  avgCostBps: number;
  orderCount: number;
  totalNotional: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
}

// ─── Implementation Shortfall Decomposition ──────────────────────────────────

export function computeISDecomposition(
  decisionPrice: number,
  arrivalPrice: number,
  executionPrice: number,
  closingPrice: number,
  executedQty: number,
  totalQty: number,
  side: OrderSide,
): ISDecomposition {
  const sign = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? 1 : -1;
  const notional = decisionPrice * totalQty;

  const delayCost = sign * (arrivalPrice - decisionPrice) * totalQty;
  const tradingCost = sign * (executionPrice - arrivalPrice) * executedQty;
  const unexecutedQty = totalQty - executedQty;
  const opportunityCost = sign * (closingPrice - decisionPrice) * unexecutedQty;
  const totalIS = delayCost + tradingCost + opportunityCost;

  return {
    delayCost,
    tradingCost,
    opportunityCost,
    totalIS,
    delayCostBps: notional !== 0 ? (delayCost / notional) * 10000 : 0,
    tradingCostBps: notional !== 0 ? (tradingCost / notional) * 10000 : 0,
    opportunityCostBps: notional !== 0 ? (opportunityCost / notional) * 10000 : 0,
    totalISBps: notional !== 0 ? (totalIS / notional) * 10000 : 0,
  };
}

// ─── VWAP Slippage ───────────────────────────────────────────────────────────

export function computeVWAPSlippage(
  fills: Fill[],
  marketTrades: Array<{ price: number; volume: number }>,
  side: OrderSide,
): VWAPSlippage {
  const totalMktVol = marketTrades.reduce((s, t) => s + t.volume, 0);
  const benchmarkVWAP = totalMktVol > 0
    ? marketTrades.reduce((s, t) => s + t.price * t.volume, 0) / totalMktVol
    : 0;

  const totalFillVol = fills.reduce((s, f) => s + f.quantity, 0);
  const executionVWAP = totalFillVol > 0
    ? fills.reduce((s, f) => s + f.price * f.quantity, 0) / totalFillVol
    : 0;

  const sign = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? 1 : -1;
  const slippage = sign * (executionVWAP - benchmarkVWAP);
  const slippageBps = benchmarkVWAP !== 0 ? (slippage / benchmarkVWAP) * 10000 : 0;

  return {
    benchmarkVWAP,
    executionVWAP,
    slippage,
    slippageBps,
    signedSlippage: slippage,
  };
}

// ─── Market Impact Estimation ────────────────────────────────────────────────

export function estimateMarketImpact(
  fills: Fill[],
  preBenchmark: number,
  postBenchmark5s: number,
  postBenchmark30s: number,
  postBenchmark5m: number,
  side: OrderSide,
): MarketImpactEstimate {
  const totalVol = fills.reduce((s, f) => s + f.quantity, 0);
  const execVWAP = totalVol > 0
    ? fills.reduce((s, f) => s + f.price * f.quantity, 0) / totalVol
    : 0;

  const sign = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? 1 : -1;

  // Temporary: price reverts back after trade
  const tempImpact = sign * (execVWAP - preBenchmark) - sign * (postBenchmark5m - preBenchmark);
  // Permanent: sustained price level change
  const permImpact = sign * (postBenchmark5m - preBenchmark);
  const totalImpact = tempImpact + permImpact;

  // Exponential decay model: estimate half-life from 5s and 30s revert
  const revert5s = Math.abs(postBenchmark5s - execVWAP);
  const revert30s = Math.abs(postBenchmark30s - execVWAP);
  const decayHalfLife = revert5s > 0 && revert30s > 0 && revert30s < revert5s
    ? -25 / Math.log(revert30s / revert5s)
    : 30;

  return {
    temporaryImpact: tempImpact,
    permanentImpact: permImpact,
    totalImpact,
    temporaryImpactBps: preBenchmark !== 0 ? (tempImpact / preBenchmark) * 10000 : 0,
    permanentImpactBps: preBenchmark !== 0 ? (permImpact / preBenchmark) * 10000 : 0,
    totalImpactBps: preBenchmark !== 0 ? (totalImpact / preBenchmark) * 10000 : 0,
    decayHalfLife: Math.max(1, decayHalfLife),
  };
}

// ─── Timing Cost Analysis ────────────────────────────────────────────────────

export function computeTimingCost(
  fills: Fill[],
  arrivalPrice: number,
  closingPrice: number,
  side: OrderSide,
): TimingCostResult {
  const totalVol = fills.reduce((s, f) => s + f.quantity, 0);
  const executionPrice = totalVol > 0
    ? fills.reduce((s, f) => s + f.price * f.quantity, 0) / totalVol
    : 0;

  const sign = side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? 1 : -1;
  const arrivalSlippage = sign * (executionPrice - arrivalPrice);
  const closingSlippage = sign * (executionPrice - closingPrice);
  const intervalReturn = arrivalPrice !== 0 ? (closingPrice - arrivalPrice) / arrivalPrice : 0;

  return {
    arrivalPrice,
    executionPrice,
    closingPrice,
    arrivalSlippage,
    arrivalSlippageBps: arrivalPrice !== 0 ? (arrivalSlippage / arrivalPrice) * 10000 : 0,
    closingSlippage,
    closingSlippageBps: closingPrice !== 0 ? (closingSlippage / closingPrice) * 10000 : 0,
    intervalReturn,
  };
}

// ─── Venue Analysis ──────────────────────────────────────────────────────────

export function analyzeVenue(
  fills: Fill[],
  midPrices: Map<number, number>,
  postTradePrices: Map<number, number>,
): VenueAnalysis[] {
  const byVenue = new Map<Venue, Fill[]>();
  for (const f of fills) {
    const arr = byVenue.get(f.venue) ?? [];
    arr.push(f);
    byVenue.set(f.venue, arr);
  }

  const totalFills = fills.length;
  const results: VenueAnalysis[] = [];

  for (const [venue, venueFills] of byVenue) {
    const numFills = venueFills.length;
    const totalVolume = venueFills.reduce((s, f) => s + f.quantity, 0);
    const avgFillSize = totalVolume / numFills;

    let spreadSum = 0;
    let improvementSum = 0;
    let revert5sCount = 0;
    let revert30sCount = 0;

    for (const f of venueFills) {
      const mid = midPrices.get(f.timestamp) ?? f.price;
      const spread = Math.abs(f.price - mid) * 2;
      spreadSum += spread;

      const isBuy = f.side === OrderSide.BUY || f.side === OrderSide.BUY_TO_COVER;
      const improvement = isBuy ? mid - f.price : f.price - mid;
      improvementSum += improvement;

      const postPrice = postTradePrices.get(f.timestamp);
      if (postPrice !== undefined) {
        const revert = isBuy
          ? f.price - postPrice
          : postPrice - f.price;
        if (revert > 0) revert5sCount++;
        if (revert > spread * 0.5) revert30sCount++;
      }
    }

    const avgSpread = spreadSum / numFills;
    const avgImprovement = improvementSum / numFills;
    const avgPrice = venueFills.reduce((s, f) => s + f.price, 0) / numFills;

    results.push({
      venue,
      fillRate: numFills / Math.max(1, totalFills),
      avgSpread,
      avgSpreadBps: avgPrice !== 0 ? (avgSpread / avgPrice) * 10000 : 0,
      priceImprovement: avgImprovement,
      priceImprovementBps: avgPrice !== 0 ? (avgImprovement / avgPrice) * 10000 : 0,
      avgFillSize,
      revertRate5s: numFills > 0 ? revert5sCount / numFills : 0,
      revertRate30s: numFills > 0 ? revert30sCount / numFills : 0,
      toxicityScore: numFills > 0 ? (revert5sCount + revert30sCount) / (numFills * 2) : 0,
      numFills,
      totalVolume,
    });
  }

  return results;
}

// ─── Commission Analysis ─────────────────────────────────────────────────────

export function analyzeCommissions(
  fills: Fill[],
  exchangeFeeRate: number = 0.003,
  clearingFeeRate: number = 0.0002,
  regulatoryFeeRate: number = 0.0000229,
): CommissionAnalysis {
  const totalCommissions = fills.reduce((s, f) => s + f.commission, 0);
  const totalQty = fills.reduce((s, f) => s + f.quantity, 0);
  const totalNotional = fills.reduce((s, f) => s + f.price * f.quantity, 0);

  const exchangeFees = totalQty * exchangeFeeRate;
  const clearingFees = totalQty * clearingFeeRate;
  const regulatoryFees = totalNotional * regulatoryFeeRate;

  return {
    totalCommissions,
    avgCommissionPerShare: totalQty > 0 ? totalCommissions / totalQty : 0,
    avgCommissionBps: totalNotional > 0 ? (totalCommissions / totalNotional) * 10000 : 0,
    exchangeFees,
    clearingFees,
    regulatoryFees,
    estimatedAllIn: totalCommissions + exchangeFees + clearingFees + regulatoryFees,
  };
}

// ─── Total Cost of Ownership ─────────────────────────────────────────────────

export function computeTotalCostOfOwnership(
  isDecomp: ISDecomposition,
  impact: MarketImpactEstimate,
  commissions: CommissionAnalysis,
  notional: number,
  taxRate: number = 0,
): TotalCostOfOwnership {
  const spreadCost = notional * 0.0001;
  const explicitCosts = commissions.estimatedAllIn + notional * taxRate;
  const implicitCosts = isDecomp.tradingCost + impact.totalImpact * notional / 10000;

  const taxes = notional * taxRate;
  const totalCost = explicitCosts + implicitCosts + spreadCost;

  return {
    explicitCosts,
    implicitCosts,
    spreadCost,
    marketImpact: impact.totalImpact,
    timingCost: isDecomp.delayCost,
    opportunityCost: isDecomp.opportunityCost,
    commissions: commissions.estimatedAllIn,
    taxes,
    totalCost,
    totalCostBps: notional > 0 ? (totalCost / notional) * 10000 : 0,
  };
}

// ─── Best Execution Report (MiFID II) ────────────────────────────────────────

export function generateBestExecutionReport(
  orderId: string,
  symbol: string,
  side: OrderSide,
  totalQuantity: number,
  executedQuantity: number,
  fills: Fill[],
  benchmarkPrice: number,
  arrivalPrice: number,
  closingPrice: number,
  marketTrades: Array<{ price: number; volume: number }>,
  venueStatsMap: VenueStats[],
  midPrices: Map<number, number>,
  postTradePrices: Map<number, number>,
): BestExecutionReport {
  const execPrice = fills.length > 0
    ? fills.reduce((s, f) => s + f.price * f.quantity, 0) / fills.reduce((s, f) => s + f.quantity, 0)
    : 0;

  const isDecomp = computeISDecomposition(
    benchmarkPrice, arrivalPrice, execPrice, closingPrice,
    executedQuantity, totalQuantity, side,
  );

  const vwapSlip = computeVWAPSlippage(fills, marketTrades, side);

  const post5s = closingPrice;
  const post30s = closingPrice;
  const post5m = closingPrice;
  const impact = estimateMarketImpact(fills, arrivalPrice, post5s, post30s, post5m, side);

  const venueBreakdown = analyzeVenue(fills, midPrices, postTradePrices);
  const commissions = analyzeCommissions(fills);
  const notional = execPrice * executedQuantity;
  const totalCost = computeTotalCostOfOwnership(isDecomp, impact, commissions, notional);

  // MiFID II scoring
  const priceScore = Math.max(0, 100 - Math.abs(vwapSlip.slippageBps) * 5);
  const costScore = Math.max(0, 100 - totalCost.totalCostBps * 2);
  const speedScore = executedQuantity >= totalQuantity ? 100 : (executedQuantity / totalQuantity) * 100;
  const likelihoodScore = fills.length > 0 ? Math.min(100, fills.length * 10) : 0;
  const overallScore = priceScore * 0.35 + costScore * 0.30 + speedScore * 0.20 + likelihoodScore * 0.15;

  const factors: string[] = [];
  if (priceScore < 50) factors.push('Price execution below benchmark');
  if (costScore < 50) factors.push('Elevated transaction costs');
  if (speedScore < 80) factors.push('Incomplete fill — execution risk');
  if (impact.totalImpactBps > 10) factors.push('Significant market impact detected');
  if (factors.length === 0) factors.push('Execution within acceptable parameters');

  return {
    orderId,
    symbol,
    side,
    totalQuantity,
    executedQuantity,
    benchmarkPrice,
    executionPrice: execPrice,
    isDecomposition: isDecomp,
    vwapSlippage: vwapSlip,
    marketImpact: impact,
    venueBreakdown,
    commissions,
    totalCost,
    mifidCompliance: {
      bestExecutionAchieved: overallScore >= 60,
      priceScore,
      costScore,
      speedScore,
      likelihoodScore,
      overallScore,
      factors,
      reportingTimestamp: Date.now(),
    },
    timestamp: Date.now(),
  };
}

// ─── TCA Aggregation ─────────────────────────────────────────────────────────

export function aggregateTCA(
  reports: BestExecutionReport[],
  groupBy: 'broker' | 'venue' | 'strategy' | 'period',
  groupKeyFn: (report: BestExecutionReport) => string,
): TCAAggregate[] {
  const groups = new Map<string, BestExecutionReport[]>();

  for (const r of reports) {
    const key = groupKeyFn(r);
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const results: TCAAggregate[] = [];

  for (const [key, group] of groups) {
    const numOrders = group.length;
    const totalVol = group.reduce((s, r) => s + r.executedQuantity, 0);
    const totalNotional = group.reduce((s, r) => s + r.executionPrice * r.executedQuantity, 0);

    const avgSlippage = numOrders > 0
      ? group.reduce((s, r) => s + r.vwapSlippage.slippageBps, 0) / numOrders
      : 0;
    const avgImpact = numOrders > 0
      ? group.reduce((s, r) => s + r.marketImpact.totalImpactBps, 0) / numOrders
      : 0;
    const avgCommission = numOrders > 0
      ? group.reduce((s, r) => s + r.commissions.avgCommissionBps, 0) / numOrders
      : 0;
    const fillRate = numOrders > 0
      ? group.reduce((s, r) => s + r.executedQuantity / Math.max(1, r.totalQuantity), 0) / numOrders
      : 0;

    results.push({
      groupKey: key,
      numOrders,
      totalVolume: totalVol,
      totalNotional,
      avgSlippageBps: avgSlippage,
      avgImpactBps: avgImpact,
      avgCommissionBps: avgCommission,
      totalCostBps: avgSlippage + avgImpact + avgCommission,
      fillRate,
      avgDuration: 0,
    });
  }

  return results.sort((a, b) => b.totalNotional - a.totalNotional);
}

// ─── Historical TCA Trends ───────────────────────────────────────────────────

export function computeTCAHistoricalTrends(
  reports: BestExecutionReport[],
  periodFn: (timestamp: number) => string,
): TCAHistoricalTrend[] {
  const periods = new Map<string, BestExecutionReport[]>();

  for (const r of reports) {
    const period = periodFn(r.timestamp);
    const arr = periods.get(period) ?? [];
    arr.push(r);
    periods.set(period, arr);
  }

  const results: TCAHistoricalTrend[] = [];

  for (const [period, group] of periods) {
    const n = group.length;
    const slippages = group.map((r) => r.vwapSlippage.slippageBps).sort((a, b) => a - b);
    const impacts = group.map((r) => r.marketImpact.totalImpactBps);
    const costs = group.map((r) => r.totalCost.totalCostBps);

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)];
    };

    results.push({
      period,
      avgSlippageBps: n > 0 ? slippages.reduce((a, b) => a + b, 0) / n : 0,
      avgImpactBps: n > 0 ? impacts.reduce((a, b) => a + b, 0) / n : 0,
      avgCostBps: n > 0 ? costs.reduce((a, b) => a + b, 0) / n : 0,
      orderCount: n,
      totalNotional: group.reduce((s, r) => s + r.executionPrice * r.executedQuantity, 0),
      percentile25: percentile(slippages, 25),
      percentile50: percentile(slippages, 50),
      percentile75: percentile(slippages, 75),
    });
  }

  return results.sort((a, b) => a.period.localeCompare(b.period));
}

// ─── Peer Benchmarking ───────────────────────────────────────────────────────

export interface PeerBenchmark {
  metric: string;
  ownValue: number;
  peerMedian: number;
  peerP25: number;
  peerP75: number;
  percentileRank: number;
  rating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR';
}

export function computePeerBenchmark(
  ownReport: BestExecutionReport,
  peerReports: BestExecutionReport[],
): PeerBenchmark[] {
  const metrics: Array<{ name: string; extract: (r: BestExecutionReport) => number; lowerBetter: boolean }> = [
    { name: 'VWAP Slippage (bps)', extract: (r) => Math.abs(r.vwapSlippage.slippageBps), lowerBetter: true },
    { name: 'Market Impact (bps)', extract: (r) => Math.abs(r.marketImpact.totalImpactBps), lowerBetter: true },
    { name: 'Total Cost (bps)', extract: (r) => r.totalCost.totalCostBps, lowerBetter: true },
    { name: 'Fill Rate', extract: (r) => r.executedQuantity / Math.max(1, r.totalQuantity), lowerBetter: false },
    { name: 'Commission (bps)', extract: (r) => r.commissions.avgCommissionBps, lowerBetter: true },
  ];

  return metrics.map(({ name, extract, lowerBetter }) => {
    const ownVal = extract(ownReport);
    const peerVals = peerReports.map(extract).sort((a, b) => a - b);
    const n = peerVals.length;

    const percentile = (p: number) => {
      if (n === 0) return 0;
      return peerVals[Math.max(0, Math.ceil(n * p / 100) - 1)];
    };

    const pMedian = percentile(50);
    const rank = n > 0 ? peerVals.filter((v) => (lowerBetter ? v >= ownVal : v <= ownVal)).length / n * 100 : 50;

    let rating: PeerBenchmark['rating'];
    if (rank >= 80) rating = 'EXCELLENT';
    else if (rank >= 60) rating = 'GOOD';
    else if (rank >= 40) rating = 'AVERAGE';
    else if (rank >= 20) rating = 'BELOW_AVERAGE';
    else rating = 'POOR';

    return {
      metric: name,
      ownValue: ownVal,
      peerMedian: pMedian,
      peerP25: percentile(25),
      peerP75: percentile(75),
      percentileRank: rank,
      rating,
    };
  });
}
