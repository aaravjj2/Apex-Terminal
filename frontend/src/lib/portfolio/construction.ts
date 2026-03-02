/**
 * Portfolio Construction — Asset allocation visualization, rebalancing rules,
 * tax-loss harvesting logic, and portfolio building utilities.
 */

import type {
  Position,
  TaxLot,
  OptimizationConstraints,
  RebalanceResult,
  TaxHarvestResult,
} from './types';
import type { EfficientFrontierPoint } from './types';
import type { Sector } from './types';
import {
  calendarRebalance,
  thresholdRebalance,
  optimalRebalance,
  identifyTaxLots,
  checkWashSale,
  taxLossHarvesting,
} from './optimization';
import { herfindahlIndex, effectiveNumPositions } from './risk';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetAllocationNode {
  id: string;
  label: string;
  weight: number;
  value: number;
  children?: AssetAllocationNode[];
  sector?: Sector;
  assetClass?: AssetClass;
}

export interface AllocationTree {
  root: AssetAllocationNode;
  totalValue: number;
  depth: number;
}

export interface RebalanceRule {
  id: string;
  type: 'calendar' | 'threshold' | 'band' | 'optimal';
  params: Record<string, unknown>;
}

export interface RebalanceBand {
  symbol: string;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  currentWeight: number;
  inBand: boolean;
  deviation: number;
}

export interface TaxHarvestCandidate {
  lot: TaxLot;
  symbol: string;
  loss: number;
  lossPct: number;
  taxSavings: number;
  washSaleBlocked: boolean;
}

export interface HarvestStrategy {
  maxHarvestPct: number;
  minLossPct: number;
  avoidWashSale: boolean;
  replaceWithSimilar: boolean;
}

// ─── Asset Allocation Visualization ──────────────────────────────────────────

/**
 * Build hierarchical allocation tree from positions (by sector then asset).
 */
export function buildAllocationTree(
  positions: Position[],
  groupBy: 'sector' | 'assetClass' | 'both' = 'sector'
): AllocationTree {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const nodes: AssetAllocationNode[] = [];
  const groups = new Map<string, Position[]>();

  for (const p of positions) {
    const key =
      groupBy === 'sector'
        ? (p.sector ?? 'other')
        : groupBy === 'assetClass'
          ? (p.assetClass ?? 'other')
          : `${p.sector ?? 'other'}|${p.assetClass ?? 'other'}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  let depth = 1;
  for (const [groupKey, posList] of groups) {
    const groupValue = posList.reduce((s, p) => s + p.marketValue, 0);
    const weight = totalValue > 0 ? groupValue / totalValue : 0;

    const children: AssetAllocationNode[] = posList.map(p => ({
      id: p.symbol,
      label: p.symbol,
      weight: totalValue > 0 ? p.marketValue / totalValue : 0,
      value: p.marketValue,
    }));

    nodes.push({
      id: groupKey,
      label: formatGroupLabel(groupKey),
      weight,
      value: groupValue,
      children,
    });
    if (children.length > 0) depth = Math.max(depth, 2);
  }

  const root: AssetAllocationNode = {
    id: 'portfolio',
    label: 'Portfolio',
    weight: 1,
    value: totalValue,
    children: nodes,
  };

  return { root, totalValue, depth };
}

function formatGroupLabel(key: string): string {
  if (key.includes('|')) {
    const [sector, ac] = key.split('|');
    return `${sector} / ${ac}`;
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Flatten allocation tree for sunburst/treemap data.
 */
export function flattenAllocationForViz(tree: AllocationTree): Array<{
  id: string;
  parent: string;
  value: number;
  label: string;
  depth: number;
}> {
  const result: Array<{
    id: string;
    parent: string;
    value: number;
    label: string;
    depth: number;
  }> = [];

  function visit(node: AssetAllocationNode, parent: string, depth: number) {
    result.push({
      id: node.id,
      parent,
      value: node.value,
      label: node.label,
      depth,
    });
    for (const child of node.children ?? []) {
      visit(child, node.id, depth + 1);
    }
  }

  visit(tree.root, '', 0);
  return result;
}

/**
 * Compute sector weights from positions.
 */
export function sectorWeights(positions: Position[]): Record<string, number> {
  const total = positions.reduce((s, p) => s + p.marketValue, 0);
  const weights: Record<string, number> = {};
  for (const p of positions) {
    const sector = p.sector ?? 'other';
    weights[sector] = (weights[sector] ?? 0) + (total > 0 ? p.marketValue / total : 0);
  }
  return weights;
}

/**
 * Compute asset class weights.
 */
export function assetClassWeights(positions: Position[]): Record<string, number> {
  const total = positions.reduce((s, p) => s + p.marketValue, 0);
  const weights: Record<string, number> = {};
  for (const p of positions) {
    const ac = p.assetClass ?? 'other';
    weights[ac] = (weights[ac] ?? 0) + (total > 0 ? p.marketValue / total : 0);
  }
  return weights;
}

/**
 * Radar/spider chart data for allocation across dimensions.
 */
export function allocationRadarData(
  positions: Position[],
  dimensions: string[]
): { axis: string; value: number }[] {
  const sectorW = sectorWeights(positions);
  const acW = assetClassWeights(positions);

  return dimensions.map(dim => {
    const val =
      sectorW[dim] ?? acW[dim] ?? 0;
    return { axis: dim, value: val };
  });
}

// ─── Rebalancing Rules ────────────────────────────────────────────────────────

export const DEFAULT_REBALANCE_RULES: RebalanceRule[] = [
  { id: 'calendar_monthly', type: 'calendar', params: { frequency: 'monthly' } },
  { id: 'calendar_quarterly', type: 'calendar', params: { frequency: 'quarterly' } },
  { id: 'threshold_5pct', type: 'threshold', params: { threshold: 0.05 } },
  { id: 'threshold_10pct', type: 'threshold', params: { threshold: 0.10 } },
  { id: 'band_2pct', type: 'band', params: { band: 0.02 } },
];

/**
 * Check if rebalance is needed under threshold rule.
 */
export function needsThresholdRebalance(
  currentWeights: number[],
  targetWeights: number[],
  threshold: number
): boolean {
  const maxDev = Math.max(
    ...currentWeights.map((w, i) => Math.abs(w - (targetWeights[i] ?? 0)))
  );
  return maxDev >= threshold;
}

/**
 * Compute rebalance bands for each position.
 */
export function computeRebalanceBands(
  currentWeights: number[],
  targetWeights: number[],
  symbols: string[],
  bandPct: number
): RebalanceBand[] {
  return symbols.map((symbol, i) => {
    const target = targetWeights[i] ?? 0;
    const current = currentWeights[i] ?? 0;
    const band = target * bandPct;
    const minW = Math.max(0, target - band);
    const maxW = target + band;
    const inBand = current >= minW && current <= maxW;
    const deviation = current - target;

    return {
      symbol,
      targetWeight: target,
      minWeight: minW,
      maxWeight: maxW,
      currentWeight: current,
      inBand,
      deviation,
    };
  });
}

/**
 * Determine which positions need rebalancing (outside band).
 */
export function positionsOutsideBand(
  bands: RebalanceBand[]
): RebalanceBand[] {
  return bands.filter(b => !b.inBand);
}

/**
 * Calendar-based rebalance schedule.
 */
export function nextRebalanceDate(
  lastRebalance: number,
  frequency: 'monthly' | 'quarterly' | 'annually'
): number {
  const d = new Date(lastRebalance);
  if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'quarterly') {
    d.setMonth(d.getMonth() + 3);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.getTime();
}

/**
 * Estimate transaction costs for a rebalance.
 */
export function estimateRebalanceCosts(
  trades: RebalanceResult['trades'],
  prices: number[],
  symbols: string[],
  costPerShare = 0.005,
  slippageBps = 5
): { commission: number; slippage: number; total: number } {
  let commission = 0;
  let slippage = 0;

  for (const t of trades) {
    const idx = symbols.indexOf(t.symbol);
    const price = prices[idx] ?? 0;
    const notional = Math.abs(t.shares * price);
    commission += Math.abs(t.shares) * costPerShare;
    slippage += notional * (slippageBps / 10000);
  }

  return { commission, slippage, total: commission + slippage };
}

// ─── Tax-Loss Harvesting Logic ────────────────────────────────────────────────

/**
 * Find all tax-loss harvest candidates.
 */
export function findHarvestCandidates(
  positions: Position[],
  taxLots: TaxLot[],
  recentPurchases: { symbol: string; date: number }[],
  currentDate: number,
  strategy: HarvestStrategy
): TaxHarvestCandidate[] {
  const candidates: TaxHarvestCandidate[] = [];
  const shortTermRate = 0.37;
  const longTermRate = 0.20;

  for (const lot of taxLots) {
    const pos = positions.find(p => p.symbol === lot.symbol);
    if (!pos) continue;

    const lossPerShare = pos.currentPrice - lot.costBasis;
    if (lossPerShare >= 0) continue;

    const lossPct = (lossPerShare / lot.costBasis) * 100;
    if (lossPct > -strategy.minLossPct) continue;

    const totalLoss = lossPerShare * lot.quantity;
    const taxRate = lot.isShortTerm ? shortTermRate : longTermRate;
    const taxSavings = Math.abs(totalLoss) * taxRate;

    const washSaleBlocked =
      strategy.avoidWashSale &&
      checkWashSale(lot, recentPurchases, currentDate);

    candidates.push({
      lot,
      symbol: lot.symbol,
      loss: totalLoss,
      lossPct,
      taxSavings,
      washSaleBlocked,
    });
  }

  return candidates
    .filter(c => !c.washSaleBlocked)
    .sort((a, b) => a.loss - b.loss); // Most negative first
}

/**
 * Select lots to harvest up to max percent of portfolio.
 */
export function selectHarvestLots(
  candidates: TaxHarvestCandidate[],
  portfolioValue: number,
  maxHarvestPct: number
): TaxHarvestCandidate[] {
  const maxHarvestValue = portfolioValue * (maxHarvestPct / 100);
  let harvested = 0;
  const selected: TaxHarvestCandidate[] = [];

  for (const c of candidates) {
    const lossValue = Math.abs(c.loss);
    if (harvested + lossValue > maxHarvestValue) break;
    selected.push(c);
    harvested += lossValue;
  }

  return selected;
}

/**
 * Check if a replacement purchase would trigger wash sale.
 */
export function wouldTriggerWashSale(
  symbol: string,
  sellDate: number,
  purchaseWindowDays = 30
): (purchase: { symbol: string; date: number }) => boolean {
  const windowMs = purchaseWindowDays * 24 * 60 * 60 * 1000;
  return purchase =>
    purchase.symbol === symbol &&
    Math.abs(purchase.date - sellDate) <= windowMs;
}

/**
 * Tax-loss harvest with automatic reinvestment in similar fund (TLH pair).
 */
export function taxLossHarvestWithReplacement(
  positions: Position[],
  taxLots: TaxLot[],
  tlhPairs: Record<string, string>,
  currentDate: number,
  recentPurchases: { symbol: string; date: number }[]
): {
  toSell: TaxLot[];
  toBuy: { symbol: string; value: number }[];
  taxSavings: number;
} {
  const result = taxLossHarvesting(
    positions,
    taxLots,
    currentDate,
    recentPurchases
  );

  const toBuy: { symbol: string; value: number }[] = [];
  for (const lot of result.lotsToSell) {
    const replacement = tlhPairs[lot.symbol];
    if (replacement) {
      const pos = positions.find(p => p.symbol === lot.symbol);
      const value = pos ? lot.quantity * pos.currentPrice : 0;
      toBuy.push({ symbol: replacement, value });
    }
  }

  return {
    toSell: result.lotsToSell,
    toBuy,
    taxSavings: result.estimatedTaxSavings,
  };
}

// ─── Portfolio Building Utilities ────────────────────────────────────────────

/**
 * Normalize weights to sum to 1.
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((s, v) => s + v, 0);
  if (sum <= 0) return weights.map(() => 1 / weights.length);
  return weights.map(w => w / sum);
}

/**
 * Rescale weights to target volatility.
 */
export function rescaleToTargetVol(
  weights: number[],
  covMatrix: number[][],
  targetVol: number
): number[] {
  let portVol = 0;
  const n = weights.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portVol += weights[i] * weights[j] * (covMatrix[i]?.[j] ?? 0);
    }
  }
  portVol = Math.sqrt(Math.max(0, portVol));
  if (portVol < 1e-10) return weights;
  const scale = targetVol / portVol;
  return weights.map(w => w * scale);
}

/**
 * Blend two weight vectors.
 */
export function blendWeights(
  w1: number[],
  w2: number[],
  alpha: number
): number[] {
  return w1.map((v, i) => (1 - alpha) * v + alpha * (w2[i] ?? 0));
}

/**
 * Apply weight constraints (box constraints).
 */
export function applyWeightConstraints(
  weights: number[],
  minW?: number,
  maxW?: number
): number[] {
  let w = weights.map(v => {
    let x = v;
    if (minW != null) x = Math.max(minW, x);
    if (maxW != null) x = Math.min(maxW, x);
    return x;
  });
  return normalizeWeights(w);
}

/**
 * Convert target weights to share counts.
 */
export function weightsToShares(
  weights: number[],
  totalValue: number,
  prices: number[],
  symbols: string[]
): { symbol: string; shares: number; value: number }[] {
  return symbols.map((symbol, i) => {
    const targetValue = (weights[i] ?? 0) * totalValue;
    const price = prices[i] ?? 1;
    const shares = price > 0 ? Math.round(targetValue / price) : 0;
    return { symbol, shares, value: shares * price };
  });
}

// ─── Concentration & Diversification ────────────────────────────────────────────

/**
 * Concentration score (0 = diversified, 1 = concentrated).
 */
export function concentrationScore(weights: number[]): number {
  const hhi = herfindahlIndex(weights);
  const n = weights.length;
  if (n <= 1) return 1;
  const minHhi = 1 / n;
  const maxHhi = 1;
  return (hhi - minHhi) / (maxHhi - minHhi);
}

/**
 * Diversification ratio.
 */
export function diversificationRatio(
  weights: number[],
  covMatrix: number[][]
): number {
  let portVol = 0;
  const n = weights.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portVol += weights[i] * weights[j] * (covMatrix[i]?.[j] ?? 0);
    }
  }
  portVol = Math.sqrt(Math.max(0, portVol));
  const avgVol = weights.reduce((s, w, i) => s + w * Math.sqrt(covMatrix[i]?.[i] ?? 0), 0);
  return portVol > 0 && avgVol > 0 ? avgVol / portVol : 1;
}

// ─── Portfolio Health Checks ──────────────────────────────────────────────────

export interface PortfolioHealth {
  isValid: boolean;
  weightsSumToOne: boolean;
  noNegativeWeights: boolean;
  constraintsSatisfied: boolean;
  diversificationOk: boolean;
  issues: string[];
}

/**
 * Validate portfolio construction.
 */
export function portfolioHealthCheck(
  weights: number[],
  constraints?: OptimizationConstraints,
  minDiversification = 3
): PortfolioHealth {
  const issues: string[] = [];

  const sum = weights.reduce((s, v) => s + v, 0);
  const weightsSumToOne = Math.abs(sum - 1) < 0.01;
  if (!weightsSumToOne) issues.push(`Weights sum to ${sum.toFixed(4)}`);

  const hasNegative = weights.some(w => w < -1e-8);
  const noNegativeWeights = !hasNegative;
  if (hasNegative) issues.push('Some weights are negative');

  let constraintsSatisfied = true;
  if (constraints?.minWeight) {
    const below = weights.filter(w => w < constraints.minWeight! - 1e-8);
    if (below.length > 0) {
      constraintsSatisfied = false;
      issues.push(`${below.length} weights below min`);
    }
  }
  if (constraints?.maxWeight) {
    const above = weights.filter(w => w > constraints.maxWeight! + 1e-8);
    if (above.length > 0) {
      constraintsSatisfied = false;
      issues.push(`${above.length} weights above max`);
    }
  }

  const enp = effectiveNumPositions(weights);
  const diversificationOk = enp >= minDiversification;
  if (!diversificationOk) issues.push(`Low diversification (ENP=${enp.toFixed(1)})`);

  return {
    isValid: issues.length === 0,
    weightsSumToOne,
    noNegativeWeights,
    constraintsSatisfied,
    diversificationOk,
    issues,
  };
}

// ─── Efficient Frontier Visualization ──────────────────────────────────────────

/**
 * Prepare efficient frontier for charting.
 */
export function prepareFrontierForChart(
  frontier: EfficientFrontierPoint[]
): { risk: number[]; return: number[]; sharpe: number[] } {
  return {
    risk: frontier.map(p => p.risk),
    return: frontier.map(p => p.return),
    sharpe: frontier.map(p => p.sharpe),
  };
}

/**
 * Find point on frontier at target return.
 */
export function frontierPointAtReturn(
  frontier: EfficientFrontierPoint[],
  targetReturn: number
): EfficientFrontierPoint | null {
  let best: EfficientFrontierPoint | null = null;
  let bestDiff = Infinity;

  for (const p of frontier) {
    const diff = Math.abs(p.return - targetReturn);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best;
}

// ─── Turnover Analysis ────────────────────────────────────────────────────────

/**
 * Compute turnover from weight changes.
 */
export function computeTurnover(
  oldWeights: number[],
  newWeights: number[]
): number {
  let turnover = 0;
  for (let i = 0; i < oldWeights.length; i++) {
    turnover += Math.abs((newWeights[i] ?? 0) - (oldWeights[i] ?? 0));
  }
  return turnover / 2;
}

/**
 * Break down turnover by source (allocation vs drift).
 */
export function turnoverDecomposition(
  oldWeights: number[],
  targetWeights: number[],
  newWeights: number[]
): { allocation: number; drift: number; total: number } {
  const allocation = computeTurnover(oldWeights, targetWeights);
  const drift = computeTurnover(targetWeights, newWeights);
  const total = computeTurnover(oldWeights, newWeights);
  return { allocation, drift, total };
}
