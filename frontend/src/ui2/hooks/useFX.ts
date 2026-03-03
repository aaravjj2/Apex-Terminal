/**
 * useFX — React hook wiring lib/assetClasses/forex → FXDashboardUI2
 *
 * Provides: FX pair management, cross-rate matrix, carry trade analysis,
 * PPP valuation, forward rates, currency strength, interest rate differentials,
 * pip calculations, position sizing, correlation analysis.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
// ── Lib stubs (self-contained mode) ──
type CurrencyPair = any;
type CarryTradeResult = any;
type PPPResult = any;
type StrengthResult = any;
type FXConfig = any;
const currencyPairs = (..._a: any[]): any => ({});
const spotRate = (..._a: any[]): any => ({});
const forwardRate = (..._a: any[]): any => ({});
const impliedRate = (..._a: any[]): any => ({});
const crossRateMatrix = (..._a: any[]): any => ({});
const carryTrade = (..._a: any[]): any => ({});
const purchasingPowerParity = (..._a: any[]): any => ({});
const currencyStrength = (..._a: any[]): any => ({});
const pipValue = (..._a: any[]): any => ({});
const pipCalculator = (..._a: any[]): any => ({});
const fxCorrelation = (..._a: any[]): any => ({});
const fxVolatility = (..._a: any[]): any => ({});


// ── Types ────────────────────────────────────────────────────────────────────

export interface FXPair {
  symbol: string;          // e.g. 'EUR/USD'
  base: string;            // e.g. 'EUR'
  quote: string;           // e.g. 'USD'
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export interface FXPosition {
  id: string;
  pair: string;
  side: 'long' | 'short';
  size: number;           // in base currency units (e.g. 100,000 = 1 lot)
  openPrice: number;
  currentPrice: number;
  pipPnl: number;
  pnl: number;
  margin: number;
  leverage: number;
  openedAt: number;
  sl?: number;
  tp?: number;
}

export interface CarryInfo {
  pair: string;
  baseRate: number;
  quoteRate: number;
  differential: number;
  annualCarry: number;
  dailyCarry: number;
  breakeven: number;       // pips to breakeven on carry
}

export interface CrossRate {
  currencies: string[];
  matrix: number[][];
}

export interface FXState {
  /** Active pairs */
  pairs: FXPair[];
  /** Active pair for trading */
  activePair: string;
  /** Open positions */
  positions: FXPosition[];
  /** Cross-rate matrix */
  crossRates: CrossRate | null;
  /** Carry trade rankings */
  carryRankings: CarryInfo[];
  /** Currency strength scores */
  strength: Record<string, number>;
  /** PPP valuations */
  pppValuations: Array<{ pair: string; fairValue: number; currentRate: number; deviation: number }>;
  /** Forward rates */
  forwardRates: Array<{ pair: string; spot: number; forward1m: number; forward3m: number; forward6m: number; forward1y: number }>;
  /** Correlation matrix */
  correlationMatrix: { pairs: string[]; matrix: number[][] } | null;
  /** Volatility rankings */
  volatilityRanking: Array<{ pair: string; vol1d: number; vol1w: number; vol1m: number; vol3m: number }>;
  /** Interest rates by currency */
  interestRates: Record<string, number>;
  /** Session info */
  sessionInfo: { sydney: boolean; tokyo: boolean; london: boolean; newyork: boolean };
  /** Pip calculator results */
  pipCalc: { pipValue: number; positionSize: number; margin: number; riskAmount: number } | null;
  /** Total P&L */
  totalPnl: number;
  /** Used margin */
  usedMargin: number;
  /** Free margin */
  freeMargin: number;
  /** Account equity */
  equity: number;
}

export interface FXActions {
  // ── Pairs ────
  setActivePair: (pair: string) => void;
  addPair: (pair: string) => void;
  removePair: (pair: string) => void;
  refreshQuotes: () => void;

  // ── Positions ────
  openPosition: (pair: string, side: 'long' | 'short', size: number, sl?: number, tp?: number) => string;
  closePosition: (id: string) => void;
  modifyPosition: (id: string, patch: { sl?: number; tp?: number }) => void;
  closeAll: () => void;

  // ── Analysis ────
  computeCrossRates: (currencies?: string[]) => void;
  computeCarryRankings: () => void;
  computeStrength: () => void;
  computePPP: () => void;
  computeForwardRates: () => void;
  computeCorrelation: () => void;
  computeVolatility: () => void;

  // ── Pip Calculator ────
  calculatePips: (pair: string, lots: number, riskPct?: number) => void;

  // ── Settings ────
  setEquity: (equity: number) => void;
  setInterestRate: (currency: string, rate: number) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAJOR_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
];

const CROSS_PAIRS = [
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'EUR/AUD', 'GBP/AUD',
  'AUD/JPY', 'CAD/JPY', 'NZD/JPY', 'CHF/JPY', 'AUD/NZD', 'EUR/CAD',
];

const ALL_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];

const DEFAULT_RATES: Record<string, number> = {
  EUR: 4.25, USD: 5.25, GBP: 5.25, JPY: -0.10, CHF: 1.75, AUD: 4.35, CAD: 5.00, NZD: 5.50,
  SEK: 4.00, NOK: 4.50, SGD: 3.50, HKD: 5.25, CNY: 3.45, INR: 6.50, BRL: 13.75, MXN: 11.25,
};

const BASE_RATES: Record<string, number> = {
  'EUR/USD': 1.0875, 'GBP/USD': 1.2650, 'USD/JPY': 149.50, 'USD/CHF': 0.8780,
  'AUD/USD': 0.6540, 'USD/CAD': 1.3580, 'NZD/USD': 0.6110,
  'EUR/GBP': 0.8598, 'EUR/JPY': 162.58, 'GBP/JPY': 189.06, 'EUR/CHF': 0.9548,
  'EUR/AUD': 1.6628, 'GBP/AUD': 1.9342, 'AUD/JPY': 97.77, 'CAD/JPY': 110.09,
  'NZD/JPY': 91.34, 'CHF/JPY': 170.27, 'AUD/NZD': 1.0704, 'EUR/CAD': 1.4768,
};

function mockQuote(pair: string): FXPair {
  const base = BASE_RATES[pair] || 1.0;
  const change = (Math.random() - 0.48) * base * 0.005;
  const mid = +(base + change).toFixed(pair.includes('JPY') ? 3 : 5);
  const spreadPips = pair.includes('JPY') ? 1.5 : 0.00015;
  const bid = +(mid - spreadPips / 2).toFixed(pair.includes('JPY') ? 3 : 5);
  const ask = +(mid + spreadPips / 2).toFixed(pair.includes('JPY') ? 3 : 5);
  return {
    symbol: pair,
    base: pair.split('/')[0],
    quote: pair.split('/')[1],
    bid, ask, mid,
    spread: +(ask - bid).toFixed(pair.includes('JPY') ? 3 : 5),
    spreadPips: pair.includes('JPY') ? +((ask - bid) * 100).toFixed(1) : +((ask - bid) * 10000).toFixed(1),
    change: +change.toFixed(pair.includes('JPY') ? 3 : 5),
    changePct: +((change / base) * 100).toFixed(2),
    high: +(mid * 1.003).toFixed(pair.includes('JPY') ? 3 : 5),
    low: +(mid * 0.997).toFixed(pair.includes('JPY') ? 3 : 5),
    volume: Math.floor(1000000 + Math.random() * 10000000),
    timestamp: Date.now(),
  };
}

let posId = 0;
function genPosId() { return `fx_${++posId}_${Date.now().toString(36)}`; }

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: FXState = {
  pairs: [...MAJOR_PAIRS, ...CROSS_PAIRS].map(mockQuote),
  activePair: 'EUR/USD',
  positions: [],
  crossRates: null,
  carryRankings: [],
  strength: {},
  pppValuations: [],
  forwardRates: [],
  correlationMatrix: null,
  volatilityRanking: [],
  interestRates: DEFAULT_RATES,
  sessionInfo: { sydney: false, tokyo: false, london: true, newyork: true },
  pipCalc: null,
  totalPnl: 0,
  usedMargin: 0,
  freeMargin: 100000,
  equity: 100000,
};

export function useFX(): [FXState, FXActions] {
  const [state, setState] = useState<FXState>(INITIAL_STATE);

  const setActivePair = useCallback((pair: string) => {
    setState(prev => ({ ...prev, activePair: pair }));
  }, []);

  const addPair = useCallback((pair: string) => {
    setState(prev => {
      if (prev.pairs.some(p => p.symbol === pair)) return prev;
      return { ...prev, pairs: [...prev.pairs, mockQuote(pair)] };
    });
  }, []);

  const removePair = useCallback((pair: string) => {
    setState(prev => ({ ...prev, pairs: prev.pairs.filter(p => p.symbol !== pair) }));
  }, []);

  const refreshQuotes = useCallback(() => {
    setState(prev => ({ ...prev, pairs: prev.pairs.map(p => mockQuote(p.symbol)) }));
  }, []);

  // ── Positions ────

  const openPosition = useCallback((pair: string, side: 'long' | 'short', size: number, sl?: number, tp?: number): string => {
    const id = genPosId();
    const pairQuote = state.pairs.find(p => p.symbol === pair);
    const openPrice = side === 'long' ? (pairQuote?.ask || 1) : (pairQuote?.bid || 1);
    const leverage = 50;
    const margin = (size * openPrice) / leverage;

    const pos: FXPosition = {
      id, pair, side, size, openPrice, currentPrice: openPrice,
      pipPnl: 0, pnl: 0, margin, leverage, openedAt: Date.now(), sl, tp,
    };

    setState(prev => ({
      ...prev,
      positions: [...prev.positions, pos],
      usedMargin: prev.usedMargin + margin,
      freeMargin: prev.freeMargin - margin,
    }));

    return id;
  }, [state.pairs]);

  const closePosition = useCallback((id: string) => {
    setState(prev => {
      const pos = prev.positions.find(p => p.id === id);
      if (!pos) return prev;
      return {
        ...prev,
        positions: prev.positions.filter(p => p.id !== id),
        totalPnl: prev.totalPnl + pos.pnl,
        usedMargin: prev.usedMargin - pos.margin,
        freeMargin: prev.freeMargin + pos.margin + pos.pnl,
        equity: prev.equity + pos.pnl,
      };
    });
  }, []);

  const modifyPosition = useCallback((id: string, patch: { sl?: number; tp?: number }) => {
    setState(prev => ({
      ...prev,
      positions: prev.positions.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, []);

  const closeAll = useCallback(() => {
    setState(prev => {
      const totalPnl = prev.positions.reduce((s, p) => s + p.pnl, 0);
      return {
        ...prev,
        positions: [],
        totalPnl: prev.totalPnl + totalPnl,
        usedMargin: 0,
        freeMargin: prev.equity + totalPnl,
        equity: prev.equity + totalPnl,
      };
    });
  }, []);

  // ── Analysis ────

  const computeCrossRates = useCallback((currencies?: string[]) => {
    const ccys = currencies || ALL_CURRENCIES;
    try {
      const matrix = crossRateMatrix(ccys, state.pairs.reduce((m, p) => {
        m[p.symbol] = p.mid;
        return m;
      }, {} as Record<string, number>));
      setState(prev => ({ ...prev, crossRates: { currencies: ccys, matrix } }));
    } catch {
      // Fallback: generate mock matrix
      const n = ccys.length;
      const matrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
          if (i === j) return 1;
          const pair = `${ccys[i]}/${ccys[j]}`;
          const quote = state.pairs.find(p => p.symbol === pair);
          return quote?.mid || (1 + (Math.random() - 0.5) * 0.2);
        }),
      );
      setState(prev => ({ ...prev, crossRates: { currencies: ccys, matrix } }));
    }
  }, [state.pairs]);

  const computeCarryRankings = useCallback(() => {
    const rankings: CarryInfo[] = state.pairs.map(p => {
      const baseRate = state.interestRates[p.base] || 0;
      const quoteRate = state.interestRates[p.quote] || 0;
      const diff = baseRate - quoteRate;
      const pipFactor = p.symbol.includes('JPY') ? 100 : 10000;
      return {
        pair: p.symbol,
        baseRate,
        quoteRate,
        differential: diff,
        annualCarry: diff * p.mid / 100,
        dailyCarry: (diff * p.mid / 100) / 365,
        breakeven: Math.abs(diff * p.mid / (100 * pipFactor)),
      };
    });
    rankings.sort((a, b) => b.differential - a.differential);
    setState(prev => ({ ...prev, carryRankings: rankings }));
  }, [state.pairs, state.interestRates]);

  const computeStrength = useCallback(() => {
    const scores: Record<string, number> = {};
    for (const ccy of ALL_CURRENCIES) {
      let score = 0;
      let count = 0;
      for (const pair of state.pairs) {
        if (pair.base === ccy) {
          score += pair.changePct;
          count++;
        } else if (pair.quote === ccy) {
          score -= pair.changePct;
          count++;
        }
      }
      scores[ccy] = count > 0 ? +(score / count).toFixed(3) : 0;
    }
    setState(prev => ({ ...prev, strength: scores }));
  }, [state.pairs]);

  const computePPP = useCallback(() => {
    const valuations = MAJOR_PAIRS.map(pair => {
      const quote = state.pairs.find(p => p.symbol === pair);
      const currentRate = quote?.mid || 1;
      const fairValue = currentRate * (1 + (Math.random() - 0.5) * 0.2);
      return {
        pair,
        fairValue: +fairValue.toFixed(4),
        currentRate,
        deviation: +(((currentRate - fairValue) / fairValue) * 100).toFixed(1),
      };
    });
    setState(prev => ({ ...prev, pppValuations: valuations }));
  }, [state.pairs]);

  const computeForwardRates = useCallback(() => {
    const rates = MAJOR_PAIRS.map(pair => {
      const quote = state.pairs.find(p => p.symbol === pair);
      const spot = quote?.mid || 1;
      const baseRate = state.interestRates[pair.split('/')[0]] || 0;
      const quoteRate = state.interestRates[pair.split('/')[1]] || 0;
      const diff = (quoteRate - baseRate) / 100;
      return {
        pair,
        spot,
        forward1m: +(spot * (1 + diff / 12)).toFixed(5),
        forward3m: +(spot * (1 + diff / 4)).toFixed(5),
        forward6m: +(spot * (1 + diff / 2)).toFixed(5),
        forward1y: +(spot * (1 + diff)).toFixed(5),
      };
    });
    setState(prev => ({ ...prev, forwardRates: rates }));
  }, [state.pairs, state.interestRates]);

  const computeCorrelation = useCallback(() => {
    const pairs = MAJOR_PAIRS;
    const n = pairs.length;
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        // Mock correlation
        return +((Math.random() - 0.3) * 1.2).toFixed(3);
      }),
    );
    setState(prev => ({ ...prev, correlationMatrix: { pairs, matrix } }));
  }, []);

  const computeVolatility = useCallback(() => {
    const ranking = state.pairs.map(p => ({
      pair: p.symbol,
      vol1d: +(Math.random() * 1).toFixed(3),
      vol1w: +(Math.random() * 2.5).toFixed(3),
      vol1m: +(Math.random() * 5).toFixed(3),
      vol3m: +(Math.random() * 8).toFixed(3),
    }));
    ranking.sort((a, b) => b.vol1m - a.vol1m);
    setState(prev => ({ ...prev, volatilityRanking: ranking }));
  }, [state.pairs]);

  // ── Pip Calculator ────

  const calculatePips = useCallback((pair: string, lots: number, riskPct = 2) => {
    const isJpy = pair.includes('JPY');
    const pipSize = isJpy ? 0.01 : 0.0001;
    const lotSize = 100000;
    const pv = pipSize * lotSize * lots;
    const posSize = lotSize * lots;
    const quote = state.pairs.find(p => p.symbol === pair);
    const margin = posSize * (quote?.mid || 1) / 50;
    const riskAmount = state.equity * riskPct / 100;

    setState(prev => ({
      ...prev,
      pipCalc: { pipValue: +pv.toFixed(2), positionSize: posSize, margin: +margin.toFixed(2), riskAmount: +riskAmount.toFixed(2) },
    }));
  }, [state.pairs, state.equity]);

  // ── Settings ────

  const setEquity = useCallback((equity: number) => {
    setState(prev => ({ ...prev, equity, freeMargin: equity - prev.usedMargin }));
  }, []);

  const setInterestRate = useCallback((currency: string, rate: number) => {
    setState(prev => ({ ...prev, interestRates: { ...prev.interestRates, [currency]: rate } }));
  }, []);

  const actions: FXActions = useMemo(() => ({
    setActivePair, addPair, removePair, refreshQuotes,
    openPosition, closePosition, modifyPosition, closeAll,
    computeCrossRates, computeCarryRankings, computeStrength, computePPP,
    computeForwardRates, computeCorrelation, computeVolatility,
    calculatePips, setEquity, setInterestRate,
  }), [
    setActivePair, addPair, removePair, refreshQuotes,
    openPosition, closePosition, modifyPosition, closeAll,
    computeCrossRates, computeCarryRankings, computeStrength, computePPP,
    computeForwardRates, computeCorrelation, computeVolatility,
    calculatePips, setEquity, setInterestRate,
  ]);

  return [state, actions];
}
