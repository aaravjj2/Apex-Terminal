/**
 * usePortfolio — React hook wiring lib/portfolio → PortfolioUI2
 *
 * Provides portfolio risk analytics, performance measurement,
 * Brinson attribution, efficient-frontier optimization,
 * construction tools, and fixed-income analytics.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
// ── Lib stubs (self-contained mode) ──
type Sector = any;
type PortfolioPosition = any;
type RiskMetrics = any;
type VaRResult = any;
type EfficientFrontierPoint = any;
type portfolioFactorRisk = any;
const sampleCovarianceMatrix = (..._a: any[]): any => ({});
const ewmaCovarianceMatrix = (..._a: any[]): any => ({});
const ledoitWolfShrinkage = (..._a: any[]): any => ({});
const historicalVaR = (..._a: any[]): any => ({});
const parametricVaR = (..._a: any[]): any => ({});
const monteCarloVaR = (..._a: any[]): any => ({});
const cornishFisherVaR = (..._a: any[]): any => ({});
const expectedShortfall = (..._a: any[]): any => ({});
const componentVaR = (..._a: any[]): any => ({});
const incrementalVaR = (..._a: any[]): any => ({});
const calculateBeta = (..._a: any[]): any => ({});
const trackingError = (..._a: any[]): any => ({});
const herfindahlIndex = (..._a: any[]): any => ({});
const simpleReturn = (..._a: any[]): any => ({});
const logReturn = (..._a: any[]): any => ({});
const cumulativeReturn = (..._a: any[]): any => ({});
const annualizedReturn = (..._a: any[]): any => ({});
const cagr = (..._a: any[]): any => ({});
const brinsonHoodBeebower = (..._a: any[]): any => ({});
const markowitzEfficientFrontier = (..._a: any[]): any => ({});
const blackLitterman = (..._a: any[]): any => ({});
const calendarRebalance = (..._a: any[]): any => ({});
const thresholdRebalance = (..._a: any[]): any => ({});
const taxLossHarvesting = (..._a: any[]): any => ({});
type AssetAllocationNode = any;
const dayCountFraction = (..._a: any[]): any => ({});
type AssetClass = any;
const riskDashboard = (..._a: any[]): any => ({});
const drawdownAnalysis = (..._a: any[]): any => ({});
const stressTestPortfolio = (..._a: any[]): any => ({});



// ── Types ────────────────────────────────────────────────────────────────────

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  sector: string;
  assetClass: string;
  currency: string;
  weight: number;
  returns: number[];
}

export interface PortfolioState {
  /** All holdings in the portfolio */
  holdings: Holding[];
  /** Total portfolio value */
  totalValue: number;
  /** Cash balance */
  cash: number;

  /** Risk metrics */
  riskMetrics: PortfolioRiskMetrics | null;
  /** Value at Risk results (multiple methods) */
  varResults: VaRBundle | null;
  /** Covariance matrix */
  covarianceMatrix: number[][] | null;
  /** Beta to benchmark */
  beta: number;
  /** Tracking error vs benchmark */
  trackingErr: number;
  /** Concentration (Herfindahl) */
  herfindahl: number;

  /** Performance metrics */
  performanceMetrics: PerformanceBundle | null;
  /** Attribution results (BHB) */
  attributionResults: AttributionBundle | null;

  /** Efficient frontier points */
  efficientFrontier: EfficientFrontierPoint[];
  /** Black-Litterman posterior weights */
  blWeights: number[] | null;
  /** Rebalance trades needed */
  rebalanceTrades: RebalanceTrade[] | null;
  /** Tax-loss harvest candidates */
  taxLossHarvestCandidates: TaxLossCandidate[] | null;

  /** Drawdown analysis */
  drawdownData: DrawdownData | null;
  /** Stress test results */
  stressResults: StressResult[] | null;
  /** Factor risk decomposition */
  factorRisk: FactorRiskData | null;

  /** UI flags */
  isComputing: boolean;
  error: string | null;
}

export interface PortfolioRiskMetrics {
  portfolioReturn: number;
  portfolioVol: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  calmar: number;
  informationRatio: number;
}

export interface VaRBundle {
  historical: VaRResult;
  parametric: VaRResult;
  monteCarlo: VaRResult;
  cornishFisher: VaRResult;
  es95: number;
  es99: number;
  componentVaR: number[];
}

export interface PerformanceBundle {
  totalReturn: number;
  annReturn: number;
  cagrValue: number;
  ytdReturn: number;
  mtdReturn: number;
  cumReturns: number[];
  rollingReturns: { '1m': number; '3m': number; '6m': number; '1y': number };
}

export interface AttributionBundle {
  allocationEffect: number[];
  selectionEffect: number[];
  interactionEffect: number[];
  totalEffect: number;
  sectorAttribution: { sector: string; allocation: number; selection: number; total: number }[];
}

export interface RebalanceTrade {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  tradeShares: number;
  tradeValue: number;
  direction: 'BUY' | 'SELL';
}

export interface TaxLossCandidate {
  symbol: string;
  unrealizedLoss: number;
  holdingPeriod: number;
  washSaleRisk: boolean;
  potentialSavings: number;
}

export interface DrawdownData {
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  recoveryTime: number;
  drawdownSeries: number[];
  underwaterSeries: number[];
}

export interface StressResult {
  scenario: string;
  portfolioImpact: number;
  worstAsset: string;
  worstImpact: number;
}

export interface FactorRiskData {
  factors: string[];
  exposures: number[];
  contributions: number[];
  residual: number;
  rSquared: number;
}

export interface PortfolioActions {
  /** Replace holdings */
  setHoldings: (holdings: Holding[]) => void;
  /** Add a single holding */
  addHolding: (holding: Holding) => void;
  /** Remove a holding by symbol */
  removeHolding: (symbol: string) => void;
  /** Update a holding */
  updateHolding: (symbol: string, patch: Partial<Holding>) => void;
  /** Set cash balance */
  setCash: (cash: number) => void;

  /** Compute risk metrics (VaR, volatility, Sharpe, etc.) */
  computeRisk: (confidenceLevel?: number) => void;
  /** Compute covariance matrix (sample / EWMA / Ledoit-Wolf) */
  computeCovMatrix: (method?: 'sample' | 'ewma' | 'ledoit-wolf') => void;
  /** Compute beta and tracking error vs benchmark */
  computeBenchmarkMetrics: (benchmarkReturns: number[]) => void;

  /** Compute performance metrics */
  computePerformance: () => void;
  /** Run BHB attribution */
  runAttribution: (benchmarkWeights: number[], benchmarkReturns: number[]) => void;

  /** Compute efficient frontier */
  computeEfficientFrontier: (points?: number) => void;
  /** Run Black-Litterman optimization */
  runBlackLitterman: (views: { assets: number[]; q: number; omega: number }[]) => void;
  /** Compute rebalance trades to reach target weights */
  computeRebalance: (targetWeights: number[]) => void;
  /** Identify tax-loss harvest candidates */
  identifyTaxLossHarvest: (taxRate?: number) => void;

  /** Run drawdown analysis */
  analyzeDrawdowns: () => void;
  /** Run stress tests */
  runStressTests: () => void;
  /** Decompose risk by factor */
  decomposeFactorRisk: (factorReturns: number[][]) => void;

  /** Reset state */
  reset: () => void;
}

// ── Initial state ────────────────────────────────────────────────────────────

const INITIAL_PORTFOLIO_STATE: PortfolioState = {
  holdings: [],
  totalValue: 0,
  cash: 0,
  riskMetrics: null,
  varResults: null,
  covarianceMatrix: null,
  beta: 0,
  trackingErr: 0,
  herfindahl: 0,
  performanceMetrics: null,
  attributionResults: null,
  efficientFrontier: [],
  blWeights: null,
  rebalanceTrades: null,
  taxLossHarvestCandidates: null,
  drawdownData: null,
  stressResults: null,
  factorRisk: null,
  isComputing: false,
  error: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTotalValue(holdings: Holding[], cash: number): number {
  return holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0) + cash;
}

function computeWeights(holdings: Holding[], totalValue: number): number[] {
  return holdings.map((h) => (h.shares * h.currentPrice) / totalValue);
}

// ── API helpers ─────────────────────────────────────────────────────────────────────

async function apiLoadPortfolio(signal?: AbortSignal): Promise<{ holdings: Holding[]; cash: number } | null> {
  try {
    // Load summary
    const summaryRes = await fetch('/api/v1/portfolio', { signal });
    const summary = summaryRes.ok ? await summaryRes.json() as Record<string, unknown> : null;
    const cash = summary ? Number(summary.cash ?? summary.buying_power ?? 0) : 0;

    // Load positions
    const posRes = await fetch('/api/v1/portfolio/positions', { signal });
    if (!posRes.ok) return { holdings: [], cash };
    const posData: unknown = await posRes.json();
    const raw: unknown[] = (posData as { positions?: unknown[] }).positions
      ?? (posData as { data?: unknown[] }).data
      ?? (Array.isArray(posData) ? posData : []);

    const holdings: Holding[] = raw.map((item: unknown) => {
      const p = item as Record<string, unknown>;
      const shares = Number(p.qty ?? p.quantity ?? 0);
      const avgCost = Number(p.avg_entry_price ?? p.avg_cost ?? p.avgCost ?? 0);
      const currentPrice = Number(p.current_price ?? p.marketPrice ?? avgCost);
      return {
        symbol: (p.symbol as string) ?? '',
        name: (p.asset_name as string) ?? (p.name as string) ?? (p.symbol as string) ?? '',
        shares,
        avgCost,
        currentPrice,
        sector: (p.sector as string) ?? 'Unknown',
        assetClass: (p.asset_class as string) ?? 'equity',
        currency: (p.currency as string) ?? 'USD',
        weight: 0, // computed below
        returns: [],
      };
    });

    // Compute weights
    const totalPos = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
    const totalVal = totalPos + cash;
    return {
      holdings: holdings.map(h => ({ ...h, weight: totalVal > 0 ? (h.shares * h.currentPrice) / totalVal : 0 })),
      cash,
    };
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolio(): [PortfolioState, PortfolioActions] {
  const [state, setState] = useState<PortfolioState>(INITIAL_PORTFOLIO_STATE);

  // Load real portfolio data from API on mount
  useEffect(() => {
    const ctrl = new AbortController();
    apiLoadPortfolio(ctrl.signal)
      .then(data => {
        if (!data || ctrl.signal.aborted) return;
        const { holdings, cash } = data;
        const totalValue = computeTotalValue(holdings, cash);
        setState(prev => ({ ...prev, holdings, cash, totalValue }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── Holdings management ──────────────────────────────────────────────────

  const setHoldings = useCallback((holdings: Holding[]) => {
    const total = computeTotalValue(holdings, state.cash);
    const updated = holdings.map((h) => ({
      ...h,
      weight: (h.shares * h.currentPrice) / total,
    }));
    setState(prev => ({ ...prev, holdings: updated, totalValue: total }));
  }, [state.cash]);

  const addHolding = useCallback((holding: Holding) => {
    setState(prev => {
      const newHoldings = [...prev.holdings, holding];
      const total = computeTotalValue(newHoldings, prev.cash);
      return {
        ...prev,
        holdings: newHoldings.map((h) => ({
          ...h,
          weight: (h.shares * h.currentPrice) / total,
        })),
        totalValue: total,
      };
    });
  }, []);

  const removeHolding = useCallback((symbol: string) => {
    setState(prev => {
      const newHoldings = prev.holdings.filter((h) => h.symbol !== symbol);
      const total = computeTotalValue(newHoldings, prev.cash);
      return {
        ...prev,
        holdings: newHoldings.map((h) => ({
          ...h,
          weight: (h.shares * h.currentPrice) / total,
        })),
        totalValue: total,
      };
    });
  }, []);

  const updateHolding = useCallback((symbol: string, patch: Partial<Holding>) => {
    setState(prev => {
      const newHoldings = prev.holdings.map((h) =>
        h.symbol === symbol ? { ...h, ...patch } : h,
      );
      const total = computeTotalValue(newHoldings, prev.cash);
      return {
        ...prev,
        holdings: newHoldings.map((h) => ({
          ...h,
          weight: (h.shares * h.currentPrice) / total,
        })),
        totalValue: total,
      };
    });
  }, []);

  const setCash = useCallback((cash: number) => {
    setState(prev => {
      const total = computeTotalValue(prev.holdings, cash);
      return {
        ...prev,
        cash,
        totalValue: total,
        holdings: prev.holdings.map((h) => ({
          ...h,
          weight: (h.shares * h.currentPrice) / total,
        })),
      };
    });
  }, []);

  // ── Risk computation ─────────────────────────────────────────────────────

  const computeRisk = useCallback(
    (confidenceLevel = 0.95) => {
      if (state.holdings.length < 2) return;
      setState(prev => ({ ...prev, isComputing: true, error: null }));

      try {
        const returns = state.holdings.map((h) => h.returns);
        const weights = computeWeights(state.holdings, state.totalValue);

        const histVar = historicalVaR(returns, weights, confidenceLevel);
        const paraVar = parametricVaR(returns, weights, confidenceLevel);
        const mcVar = monteCarloVaR(returns, weights, confidenceLevel, 10000);
        const cfVar = cornishFisherVaR(returns, weights, confidenceLevel);
        const es95 = expectedShortfall(returns, weights, 0.95);
        const es99 = expectedShortfall(returns, weights, 0.99);
        const compVaR = componentVaR(returns, weights, confidenceLevel);

        const portfolioReturns = weights.reduce((arr, w, i) =>
          returns[i].map((r, j) => (arr[j] || 0) + w * r), new Array(returns[0].length).fill(0),
        );
        const mean = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
        const vol = Math.sqrt(
          portfolioReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / portfolioReturns.length,
        );
        const annVol = vol * Math.sqrt(252);
        const annReturn = mean * 252;
        const sharpe = annVol > 0 ? annReturn / annVol : 0;
        const downside = portfolioReturns.filter((r) => r < 0);
        const downsideVol =
          downside.length > 0
            ? Math.sqrt(downside.reduce((a, r) => a + r ** 2, 0) / downside.length) * Math.sqrt(252)
            : 0;
        const sortino = downsideVol > 0 ? annReturn / downsideVol : 0;

        let peak = 1;
        let maxDD = 0;
        let eq = 1;
        for (const r of portfolioReturns) {
          eq *= 1 + r;
          if (eq > peak) peak = eq;
          const dd = (peak - eq) / peak;
          if (dd > maxDD) maxDD = dd;
        }
        const calmar = maxDD > 0 ? annReturn / maxDD : 0;

        setState(prev => ({
          ...prev,
          riskMetrics: {
            portfolioReturn: annReturn,
            portfolioVol: annVol,
            sharpe,
            sortino,
            maxDrawdown: maxDD,
            calmar,
            informationRatio: 0,
          },
          varResults: {
            historical: histVar,
            parametric: paraVar,
            monteCarlo: mcVar,
            cornishFisher: cfVar,
            es95,
            es99,
            componentVaR: compVaR,
          },
          herfindahl: herfindahlIndex(weights),
          isComputing: false,
        }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.holdings, state.totalValue],
  );

  const computeCovMatrix = useCallback(
    (method: 'sample' | 'ewma' | 'ledoit-wolf' = 'sample') => {
      if (state.holdings.length < 2) return;
      const returns = state.holdings.map((h) => h.returns);
      try {
        let cov: number[][];
        switch (method) {
          case 'ewma':
            cov = ewmaCovarianceMatrix(returns, 0.94);
            break;
          case 'ledoit-wolf':
            cov = ledoitWolfShrinkage(returns);
            break;
          default:
            cov = sampleCovarianceMatrix(returns);
        }
        setState(prev => ({ ...prev, covarianceMatrix: cov }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [state.holdings],
  );

  const computeBenchmarkMetrics = useCallback(
    (benchmarkReturns: number[]) => {
      if (state.holdings.length === 0) return;
      const weights = computeWeights(state.holdings, state.totalValue);
      const returns = state.holdings.map((h) => h.returns);
      const portfolioReturns = weights.reduce((arr, w, i) =>
        returns[i].map((r, j) => (arr[j] || 0) + w * r), new Array(returns[0].length).fill(0),
      );
      const b = calculateBeta(portfolioReturns, benchmarkReturns);
      const te = trackingError(portfolioReturns, benchmarkReturns);
      setState(prev => ({ ...prev, beta: b, trackingErr: te }));
    },
    [state.holdings, state.totalValue],
  );

  // ── Performance metrics ──────────────────────────────────────────────────

  const computePerformance = useCallback(() => {
    if (state.holdings.length === 0) return;
    const weights = computeWeights(state.holdings, state.totalValue);
    const returns = state.holdings.map((h) => h.returns);
    const portfolioReturns = weights.reduce((arr, w, i) =>
      returns[i].map((r, j) => (arr[j] || 0) + w * r), new Array(returns[0].length).fill(0),
    );

    const totalRet = cumulativeReturn(portfolioReturns);
    const annRet = annualizedReturn(portfolioReturns, 252);
    const cagrVal = cagr(1, 1 + totalRet, portfolioReturns.length / 252);

    const cumReturns: number[] = [];
    let cum = 1;
    for (const r of portfolioReturns) {
      cum *= 1 + r;
      cumReturns.push(cum - 1);
    }

    const len = portfolioReturns.length;
    const m1 = len >= 21 ? cumulativeReturn(portfolioReturns.slice(-21)) : 0;
    const m3 = len >= 63 ? cumulativeReturn(portfolioReturns.slice(-63)) : 0;
    const m6 = len >= 126 ? cumulativeReturn(portfolioReturns.slice(-126)) : 0;
    const y1 = len >= 252 ? cumulativeReturn(portfolioReturns.slice(-252)) : 0;

    setState(prev => ({
      ...prev,
      performanceMetrics: {
        totalReturn: totalRet,
        annReturn: annRet,
        cagrValue: cagrVal,
        ytdReturn: m3, // approx
        mtdReturn: m1,
        cumReturns,
        rollingReturns: { '1m': m1, '3m': m3, '6m': m6, '1y': y1 },
      },
    }));
  }, [state.holdings, state.totalValue]);

  // ── Attribution ──────────────────────────────────────────────────────────

  const runAttribution = useCallback(
    (benchmarkWeights: number[], benchmarkReturns: number[]) => {
      if (state.holdings.length === 0) return;
      const weights = computeWeights(state.holdings, state.totalValue);
      const portReturns = state.holdings.map((h) => {
        const r = h.returns;
        return r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length * 252 : 0;
      });

      try {
        const bhb = brinsonHoodBeebower(weights, portReturns, benchmarkWeights, benchmarkReturns);
        const sectors = [...new Set(state.holdings.map((h) => h.sector))];
        const sectorAttrib = sectors.map((sector) => {
          const sectorHoldings = state.holdings
            .map((h, i) => ({ h, i }))
            .filter(({ h }) => h.sector === sector);
          const sectorAlloc = sectorHoldings.reduce(
            (a, { h }) => a + (h.shares * h.currentPrice) / state.totalValue,
            0,
          );
          const sectorSel = sectorHoldings.reduce((a, { h }) => {
            const r = h.returns.length > 0 ? h.returns.reduce((x, y) => x + y, 0) / h.returns.length : 0;
            return a + r;
          }, 0);
          return { sector, allocation: sectorAlloc, selection: sectorSel, total: sectorAlloc + sectorSel };
        });

        setState(prev => ({
          ...prev,
          attributionResults: {
            allocationEffect: bhb.allocationEffect || [],
            selectionEffect: bhb.selectionEffect || [],
            interactionEffect: bhb.interactionEffect || [],
            totalEffect: bhb.totalEffect || 0,
            sectorAttribution: sectorAttrib,
          },
        }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [state.holdings, state.totalValue],
  );

  // ── Optimization ─────────────────────────────────────────────────────────

  const computeEfficientFrontier = useCallback(
    (points = 50) => {
      if (state.holdings.length < 2) return;
      setState(prev => ({ ...prev, isComputing: true }));
      try {
        const returns = state.holdings.map((h) => h.returns);
        const frontier = markowitzEfficientFrontier(returns, points);
        setState(prev => ({ ...prev, efficientFrontier: frontier, isComputing: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.holdings],
  );

  const runBlackLitterman = useCallback(
    (views: { assets: number[]; q: number; omega: number }[]) => {
      if (state.holdings.length < 2) return;
      setState(prev => ({ ...prev, isComputing: true }));
      try {
        const returns = state.holdings.map((h) => h.returns);
        const weights = computeWeights(state.holdings, state.totalValue);
        const result = blackLitterman(returns, weights, views);
        setState(prev => ({ ...prev, blWeights: result, isComputing: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.holdings, state.totalValue],
  );

  const computeRebalance = useCallback(
    (targetWeights: number[]) => {
      if (state.holdings.length === 0 || targetWeights.length !== state.holdings.length) return;
      const trades: RebalanceTrade[] = state.holdings.map((h, i) => {
        const currentWeight = (h.shares * h.currentPrice) / state.totalValue;
        const diff = targetWeights[i] - currentWeight;
        const tradeValue = diff * state.totalValue;
        const tradeShares = Math.round(tradeValue / h.currentPrice);
        return {
          symbol: h.symbol,
          currentWeight,
          targetWeight: targetWeights[i],
          tradeShares: Math.abs(tradeShares),
          tradeValue: Math.abs(tradeValue),
          direction: diff >= 0 ? 'BUY' as const : 'SELL' as const,
        };
      });
      setState(prev => ({ ...prev, rebalanceTrades: trades }));
    },
    [state.holdings, state.totalValue],
  );

  const identifyTaxLossHarvest = useCallback(
    (taxRate = 0.37) => {
      const candidates: TaxLossCandidate[] = state.holdings
        .filter((h) => h.currentPrice < h.avgCost)
        .map((h) => ({
          symbol: h.symbol,
          unrealizedLoss: (h.avgCost - h.currentPrice) * h.shares,
          holdingPeriod: 180, // placeholder
          washSaleRisk: false,
          potentialSavings: (h.avgCost - h.currentPrice) * h.shares * taxRate,
        }))
        .sort((a, b) => b.potentialSavings - a.potentialSavings);
      setState(prev => ({ ...prev, taxLossHarvestCandidates: candidates }));
    },
    [state.holdings],
  );

  // ── Drawdown & Stress ────────────────────────────────────────────────────

  const analyzeDrawdowns = useCallback(() => {
    if (state.holdings.length === 0) return;
    const weights = computeWeights(state.holdings, state.totalValue);
    const returns = state.holdings.map((h) => h.returns);
    const portfolioReturns = weights.reduce((arr, w, i) =>
      returns[i].map((r, j) => (arr[j] || 0) + w * r), new Array(returns[0].length).fill(0),
    );

    let peak = 1;
    let eq = 1;
    let maxDD = 0;
    let maxDDDuration = 0;
    let ddStart = 0;
    const ddSeries: number[] = [];
    const uwSeries: number[] = [];

    for (let i = 0; i < portfolioReturns.length; i++) {
      eq *= 1 + portfolioReturns[i];
      if (eq > peak) {
        peak = eq;
        ddStart = i;
      }
      const dd = (peak - eq) / peak;
      ddSeries.push(dd);
      uwSeries.push(eq / peak - 1);
      if (dd > maxDD) {
        maxDD = dd;
        maxDDDuration = i - ddStart;
      }
    }

    setState(prev => ({
      ...prev,
      drawdownData: {
        currentDrawdown: ddSeries[ddSeries.length - 1] || 0,
        maxDrawdown: maxDD,
        maxDrawdownDuration: maxDDDuration,
        recoveryTime: 0, // would need more logic
        drawdownSeries: ddSeries,
        underwaterSeries: uwSeries,
      },
    }));
  }, [state.holdings, state.totalValue]);

  const runStressTests = useCallback(() => {
    const scenarios = [
      { scenario: '2008 GFC', shocks: [-0.38, -0.45, -0.30, -0.55, -0.20] },
      { scenario: 'Flash Crash 2010', shocks: [-0.06, -0.08, -0.04, -0.10, -0.03] },
      { scenario: 'COVID Crash 2020', shocks: [-0.34, -0.25, -0.40, -0.32, -0.15] },
      { scenario: 'Taper Tantrum 2013', shocks: [-0.06, -0.08, -0.10, -0.04, -0.12] },
      { scenario: 'Rate Hike +200bp', shocks: [-0.08, -0.12, -0.05, -0.15, -0.20] },
      { scenario: 'Oil Crash 2014', shocks: [-0.02, -0.05, -0.40, 0.05, 0.03] },
      { scenario: 'Volmageddon 2018', shocks: [-0.10, -0.12, -0.05, -0.15, -0.03] },
      { scenario: 'China Devaluation 2015', shocks: [-0.12, -0.15, -0.08, -0.20, -0.05] },
    ];

    const weights = computeWeights(state.holdings, state.totalValue);
    const results: StressResult[] = scenarios.map(({ scenario, shocks }) => {
      let impact = 0;
      let worstAsset = '';
      let worstImpact = 0;
      state.holdings.forEach((h, i) => {
        const shock = shocks[i % shocks.length];
        const assetImpact = weights[i] * shock;
        impact += assetImpact;
        if (Math.abs(assetImpact) > Math.abs(worstImpact)) {
          worstImpact = assetImpact;
          worstAsset = h.symbol;
        }
      });
      return { scenario, portfolioImpact: impact, worstAsset, worstImpact };
    });

    setState(prev => ({ ...prev, stressResults: results }));
  }, [state.holdings, state.totalValue]);

  const decomposeFactorRisk = useCallback(
    (factorReturns: number[][]) => {
      if (state.holdings.length === 0 || factorReturns.length === 0) return;
      const weights = computeWeights(state.holdings, state.totalValue);
      const returns = state.holdings.map((h) => h.returns);
      const portfolioReturns = weights.reduce((arr, w, i) =>
        returns[i].map((r, j) => (arr[j] || 0) + w * r), new Array(returns[0].length).fill(0),
      );

      // Simple factor regression
      const factorNames = ['Market', 'Size', 'Value', 'Momentum', 'Quality'];
      const n = Math.min(portfolioReturns.length, factorReturns[0]?.length || 0);
      const exposures = factorReturns.map((fr) => {
        let sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
          sumXY += fr[i] * portfolioReturns[i];
          sumXX += fr[i] * fr[i];
        }
        return sumXX > 0 ? sumXY / sumXX : 0;
      });

      const totalVar = portfolioReturns.reduce((a, r) => {
        const mean = portfolioReturns.reduce((s, v) => s + v, 0) / n;
        return a + (r - mean) ** 2;
      }, 0) / n;

      const contributions = exposures.map((e) => e * e * 0.01); // simplified
      const sumContrib = contributions.reduce((a, b) => a + b, 0);
      const rSquared = totalVar > 0 ? sumContrib / totalVar : 0;

      setState(prev => ({
        ...prev,
        factorRisk: {
          factors: factorNames.slice(0, factorReturns.length),
          exposures,
          contributions,
          residual: totalVar - sumContrib,
          rSquared: Math.min(1, rSquared),
        },
      }));
    },
    [state.holdings, state.totalValue],
  );

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState(INITIAL_PORTFOLIO_STATE);
  }, []);

  // ── Build actions ────────────────────────────────────────────────────────

  const actions: PortfolioActions = useMemo(
    () => ({
      setHoldings,
      addHolding,
      removeHolding,
      updateHolding,
      setCash,
      computeRisk,
      computeCovMatrix,
      computeBenchmarkMetrics,
      computePerformance,
      runAttribution,
      computeEfficientFrontier,
      runBlackLitterman,
      computeRebalance,
      identifyTaxLossHarvest,
      analyzeDrawdowns,
      runStressTests,
      decomposeFactorRisk,
      reset,
    }),
    [
      setHoldings, addHolding, removeHolding, updateHolding, setCash,
      computeRisk, computeCovMatrix, computeBenchmarkMetrics,
      computePerformance, runAttribution,
      computeEfficientFrontier, runBlackLitterman,
      computeRebalance, identifyTaxLossHarvest,
      analyzeDrawdowns, runStressTests, decomposeFactorRisk,
      reset,
    ],
  );

  return [state, actions];
}
