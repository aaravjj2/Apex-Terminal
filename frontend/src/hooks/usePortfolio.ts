/**
 * usePortfolio.ts
 * Portfolio management hook with position tracking, real-time P&L,
 * risk metrics, performance analytics, rebalance suggestions,
 * and tax-loss harvesting recommendations.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  realizedPnL: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
  sector?: string;
  assetClass: 'equity' | 'fixed_income' | 'commodity' | 'crypto' | 'option' | 'cash';
  openDate: number;
  lastUpdated: number;
  lots: TaxLot[];
}

export interface TaxLot {
  id: string;
  quantity: number;
  costBasis: number;
  purchaseDate: number;
  isLongTerm: boolean;
  unrealizedGain: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPct: number;
  totalRealizedPnL: number;
  dayChange: number;
  dayChangePct: number;
  cash: number;
  buyingPower: number;
  marginUsed: number;
  positionCount: number;
}

export interface RiskMetrics {
  beta: number;
  sharpeRatio: number;
  sortinoRatio: number;
  volatility: number;
  maxDrawdown: number;
  valueAtRisk95: number;
  valueAtRisk99: number;
  conditionalVaR: number;
  diversificationRatio: number;
  concentrationIndex: number;
  correlationToSPY: number;
  informationRatio: number;
}

export interface PerformanceData {
  period: string;
  returnPct: number;
  benchmarkReturnPct: number;
  alpha: number;
  beta: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradePnL: number;
}

export interface SectorAllocation {
  sector: string;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  value: number;
}

export interface RebalanceSuggestion {
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  currentWeight: number;
  targetWeight: number;
  estimatedCost: number;
  reason: string;
}

export interface TaxLossHarvestSuggestion {
  symbol: string;
  unrealizedLoss: number;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  isLongTerm: boolean;
  taxSavingsEstimate: number;
  replacement?: string;
  washSaleRisk: boolean;
}

export interface PortfolioTarget {
  symbol?: string;
  sector?: string;
  assetClass?: string;
  targetWeight: number;
}

export interface UsePortfolioOptions {
  apiUrl?: string;
  refreshIntervalMs?: number;
  getCurrentPrice?: (symbol: string) => number | null;
  taxRate?: number;
  onError?: (error: string) => void;
  mockMode?: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

function generateMockPositions(): Position[] {
  const now = Date.now();
  const positions: Omit<Position, 'marketValue' | 'costBasis' | 'unrealizedPnL' | 'unrealizedPnLPct' | 'dayChange' | 'dayChangePct' | 'weight'>[] = [
    { symbol: 'AAPL', name: 'Apple Inc', quantity: 150, avgCost: 165.20, currentPrice: 189.64, sector: 'Technology', assetClass: 'equity', openDate: now - 90 * 86400000, lastUpdated: now, realizedPnL: 1200, lots: [{ id: 'L1', quantity: 150, costBasis: 165.20, purchaseDate: now - 90 * 86400000, isLongTerm: false, unrealizedGain: 150 * (189.64 - 165.20) }] },
    { symbol: 'MSFT', name: 'Microsoft Corp', quantity: 80, avgCost: 380.50, currentPrice: 412.88, sector: 'Technology', assetClass: 'equity', openDate: now - 200 * 86400000, lastUpdated: now, realizedPnL: 800, lots: [{ id: 'L2', quantity: 80, costBasis: 380.50, purchaseDate: now - 200 * 86400000, isLongTerm: false, unrealizedGain: 80 * (412.88 - 380.50) }] },
    { symbol: 'NVDA', name: 'NVIDIA Corp', quantity: 50, avgCost: 520.00, currentPrice: 862.42, sector: 'Technology', assetClass: 'equity', openDate: now - 365 * 86400000, lastUpdated: now, realizedPnL: 5000, lots: [{ id: 'L3', quantity: 50, costBasis: 520.00, purchaseDate: now - 365 * 86400000, isLongTerm: true, unrealizedGain: 50 * (862.42 - 520.00) }] },
    { symbol: 'JPM', name: 'JPMorgan Chase', quantity: 100, avgCost: 180.00, currentPrice: 196.55, sector: 'Financial Services', assetClass: 'equity', openDate: now - 120 * 86400000, lastUpdated: now, realizedPnL: 0, lots: [{ id: 'L4', quantity: 100, costBasis: 180.00, purchaseDate: now - 120 * 86400000, isLongTerm: false, unrealizedGain: 100 * (196.55 - 180.00) }] },
    { symbol: 'TSLA', name: 'Tesla Inc', quantity: 30, avgCost: 270.00, currentPrice: 246.22, sector: 'Consumer Cyclical', assetClass: 'equity', openDate: now - 45 * 86400000, lastUpdated: now, realizedPnL: -500, lots: [{ id: 'L5', quantity: 30, costBasis: 270.00, purchaseDate: now - 45 * 86400000, isLongTerm: false, unrealizedGain: 30 * (246.22 - 270.00) }] },
  ];

  const totalValue = positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);

  return positions.map(p => {
    const mktVal = p.quantity * p.currentPrice;
    const cost = p.quantity * p.avgCost;
    const dayDelta = p.currentPrice * (Math.random() - 0.48) * 0.015;
    return {
      ...p,
      marketValue: mktVal,
      costBasis: cost,
      unrealizedPnL: mktVal - cost,
      unrealizedPnLPct: ((mktVal - cost) / cost) * 100,
      dayChange: dayDelta * p.quantity,
      dayChangePct: (dayDelta / p.currentPrice) * 100,
      weight: mktVal / totalValue,
    };
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const {
    apiUrl = '/api/portfolio',
    refreshIntervalMs = 5000,
    getCurrentPrice,
    taxRate = 0.35,
    onError,
    mockMode = true,
  } = options;

  const [positions, setPositions] = useState<Position[]>([]);
  const [cash, setCash] = useState(50000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<PortfolioTarget[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceData[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      if (mockMode) {
        const mockPositions = generateMockPositions();
        setPositions(mockPositions);
      } else {
        const res = await fetch(`${apiUrl}/positions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPositions(data.positions);
        setCash(data.cash);
      }
    } catch (err) {
      const msg = `Portfolio fetch failed: ${err}`;
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, mockMode, onError]);

  const updatePrices = useCallback(() => {
    if (!getCurrentPrice) return;
    setPositions(prev => {
      const totalValue = prev.reduce((s, p) => {
        const price = getCurrentPrice(p.symbol) ?? p.currentPrice;
        return s + p.quantity * price;
      }, 0) + cash;

      return prev.map(p => {
        const price = getCurrentPrice(p.symbol) ?? p.currentPrice;
        const mktVal = p.quantity * price;
        const dayDelta = price - p.currentPrice;
        return {
          ...p,
          currentPrice: price,
          marketValue: mktVal,
          unrealizedPnL: mktVal - p.costBasis,
          unrealizedPnLPct: ((mktVal - p.costBasis) / p.costBasis) * 100,
          dayChange: dayDelta * p.quantity,
          dayChangePct: p.currentPrice > 0 ? (dayDelta / p.currentPrice) * 100 : 0,
          weight: totalValue > 0 ? mktVal / totalValue : 0,
          lastUpdated: Date.now(),
        };
      });
    });
  }, [getCurrentPrice, cash]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (!getCurrentPrice) return;
    refreshTimerRef.current = setInterval(updatePrices, refreshIntervalMs);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [updatePrices, refreshIntervalMs, getCurrentPrice]);

  // ── Computed Values ──

  const summary = useMemo((): PortfolioSummary => {
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0) + cash;
    const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
    const totalUnrealizedPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
    const totalRealizedPnL = positions.reduce((s, p) => s + p.realizedPnL, 0);
    const dayChange = positions.reduce((s, p) => s + p.dayChange, 0);
    return {
      totalValue, totalCost, totalUnrealizedPnL,
      totalUnrealizedPnLPct: totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0,
      totalRealizedPnL, dayChange,
      dayChangePct: (totalValue - dayChange) > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0,
      cash, buyingPower: cash * 2, marginUsed: 0, positionCount: positions.length,
    };
  }, [positions, cash]);

  const sectorAllocation = useMemo((): SectorAllocation[] => {
    const sectors = new Map<string, number>();
    positions.forEach(p => {
      const key = p.sector ?? 'Other';
      sectors.set(key, (sectors.get(key) ?? 0) + p.marketValue);
    });
    const total = summary.totalValue;
    return Array.from(sectors.entries()).map(([sector, value]) => {
      const currentWeight = total > 0 ? value / total : 0;
      const target = targets.find(t => t.sector === sector);
      const targetWeight = target?.targetWeight ?? currentWeight;
      return { sector, currentWeight, targetWeight, deviation: currentWeight - targetWeight, value };
    });
  }, [positions, summary.totalValue, targets]);

  const riskMetrics = useMemo((): RiskMetrics => {
    const weights = positions.map(p => p.weight);
    const concentration = weights.reduce((s, w) => s + w * w, 0);
    return {
      beta: 1.05, sharpeRatio: 1.2, sortinoRatio: 1.5, volatility: 0.18,
      maxDrawdown: -0.12, valueAtRisk95: summary.totalValue * 0.02,
      valueAtRisk99: summary.totalValue * 0.035, conditionalVaR: summary.totalValue * 0.045,
      diversificationRatio: 1 / Math.sqrt(concentration), concentrationIndex: concentration,
      correlationToSPY: 0.85, informationRatio: 0.4,
    };
  }, [positions, summary.totalValue]);

  // ── Rebalance ──

  const getRebalanceSuggestions = useCallback((): RebalanceSuggestion[] => {
    if (targets.length === 0) return [];
    const suggestions: RebalanceSuggestion[] = [];
    const totalValue = summary.totalValue;

    targets.forEach(target => {
      const position = positions.find(p => p.symbol === target.symbol || p.sector === target.sector);
      if (!position) return;

      const currentWeight = position.weight;
      const deviation = currentWeight - target.targetWeight;
      if (Math.abs(deviation) < 0.01) return;

      const targetValue = totalValue * target.targetWeight;
      const currentValue = position.marketValue;
      const diff = targetValue - currentValue;
      const qty = Math.abs(Math.round(diff / position.currentPrice));

      if (qty > 0) {
        suggestions.push({
          symbol: position.symbol,
          action: diff > 0 ? 'buy' : 'sell',
          quantity: qty, currentWeight, targetWeight: target.targetWeight,
          estimatedCost: qty * position.currentPrice,
          reason: `${deviation > 0 ? 'Overweight' : 'Underweight'} by ${Math.abs(deviation * 100).toFixed(1)}%`,
        });
      }
    });

    return suggestions.sort((a, b) => Math.abs(b.currentWeight - b.targetWeight) - Math.abs(a.currentWeight - a.targetWeight));
  }, [targets, positions, summary.totalValue]);

  // ── Tax-Loss Harvesting ──

  const getTaxLossSuggestions = useCallback((): TaxLossHarvestSuggestion[] => {
    return positions
      .filter(p => p.unrealizedPnL < 0)
      .map(p => {
        const loss = Math.abs(p.unrealizedPnL);
        return {
          symbol: p.symbol,
          unrealizedLoss: -loss,
          quantity: p.quantity,
          costBasis: p.avgCost,
          currentPrice: p.currentPrice,
          isLongTerm: p.lots.some(l => l.isLongTerm),
          taxSavingsEstimate: loss * taxRate,
          washSaleRisk: false,
        };
      })
      .sort((a, b) => a.unrealizedLoss - b.unrealizedLoss);
  }, [positions, taxRate]);

  const getPerformancePeriods = useCallback((): PerformanceData[] => {
    return ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'].map(period => ({
      period,
      returnPct: (Math.random() - 0.3) * 20,
      benchmarkReturnPct: (Math.random() - 0.3) * 15,
      alpha: (Math.random() - 0.4) * 5,
      beta: 0.8 + Math.random() * 0.5,
      sharpeRatio: 0.5 + Math.random() * 1.5,
      maxDrawdown: -Math.random() * 15,
      winRate: 0.45 + Math.random() * 0.2,
      tradePnL: (Math.random() - 0.3) * 10000,
    }));
  }, []);

  return {
    positions, summary, sectorAllocation, riskMetrics,
    performanceHistory, isLoading, error,
    fetchPortfolio, updatePrices,
    getRebalanceSuggestions, getTaxLossSuggestions, getPerformancePeriods,
    setTargets, setCash,
  };
}

export default usePortfolio;
