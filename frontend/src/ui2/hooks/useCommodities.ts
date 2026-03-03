/**
 * useCommodities — React hook wiring lib/assetClasses/commodities → CommoditiesUI2
 *
 * Provides: metal/energy/agriculture quote management, futures curve analysis,
 * roll yield, seasonality, supply/demand fundamentals, spread trading,
 * contango/backwardation, carry analysis, correlation with macro.
 */
import { useState, useCallback, useMemo } from 'react';
// ── Lib stubs (self-contained mode) ──
type Commodity = any;
type FuturesCurvePoint = any;
type RollYieldResult = any;
type SeasonalResult = any;
type SupplyDemandData = any;
type SpreadResult = any;
type CommodityConfig = any;
const commodityList = (..._a: any[]): any => ({});
const futuresCurve = (..._a: any[]): any => ({});
const rollYield = (..._a: any[]): any => ({});
const seasonalPattern = (..._a: any[]): any => ({});
const supplyDemand = (..._a: any[]): any => ({});
const commoditySpread = (..._a: any[]): any => ({});
const commodityCorrelation = (..._a: any[]): any => ({});


// ── Types ────────────────────────────────────────────────────────────────────

export interface CommodityQuote {
  symbol: string;
  name: string;
  category: 'Energy' | 'Metals' | 'Agriculture' | 'Softs' | 'Livestock';
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  openInterest: number;
  expiryDate: string;
  unit: string;
  contractSize: number;
  exchange: string;
  timestamp: number;
}

export interface FuturesCurveData {
  symbol: string;
  points: Array<{ month: string; price: number; volume: number; oi: number; daysToExpiry: number }>;
  structure: 'contango' | 'backwardation' | 'flat';
  steepness: number;       // avg monthly rate
  rollYield: number;       // annualized roll yield %
}

export interface SeasonalityData {
  symbol: string;
  monthlyReturns: number[];  // 12 months
  monthlyNames: string[];
  bestMonth: { month: string; avgReturn: number };
  worstMonth: { month: string; avgReturn: number };
  years: number;
}

export interface SpreadData {
  name: string;
  leg1: string;
  leg2: string;
  spread: number;
  mean: number;
  stdDev: number;
  zScore: number;
  percentile: number;
}

export interface CommoditiesState {
  /** All commodity quotes */
  quotes: CommodityQuote[];
  /** Active commodity */
  activeCommodity: string;
  /** Futures curve for active commodity */
  futuresCurve: FuturesCurveData | null;
  /** Seasonality analysis */
  seasonality: SeasonalityData | null;
  /** Supply/demand data */
  supplyDemand: SupplyDemandData | null;
  /** Spread analysis */
  spreads: SpreadData[];
  /** Correlation matrix */
  correlationMatrix: { commodities: string[]; matrix: number[][] } | null;
  /** Category performance */
  categoryPerformance: Array<{ category: string; change: number; volume: number; count: number }>;
  /** Watchlist */
  watchlist: string[];
  /** Price alerts */
  alerts: Array<{ id: string; symbol: string; condition: 'above' | 'below'; price: number; triggered: boolean }>;
}

export interface CommoditiesActions {
  setActiveCommodity: (symbol: string) => void;
  refreshQuotes: () => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  computeFuturesCurve: (symbol?: string) => void;
  computeSeasonality: (symbol?: string) => void;
  loadSupplyDemand: (symbol?: string) => void;
  computeSpreads: () => void;
  computeCorrelation: () => void;
  computeCategoryPerformance: () => void;
  addPriceAlert: (symbol: string, condition: 'above' | 'below', price: number) => string;
  removePriceAlert: (id: string) => void;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const COMMODITY_DATA: Array<{ symbol: string; name: string; category: CommodityQuote['category']; basePrice: number; unit: string; contractSize: number; exchange: string }> = [
  // Energy
  { symbol: 'CL', name: 'Crude Oil WTI', category: 'Energy', basePrice: 78.50, unit: 'bbl', contractSize: 1000, exchange: 'NYMEX' },
  { symbol: 'BZ', name: 'Brent Crude', category: 'Energy', basePrice: 82.30, unit: 'bbl', contractSize: 1000, exchange: 'ICE' },
  { symbol: 'NG', name: 'Natural Gas', category: 'Energy', basePrice: 2.85, unit: 'MMBtu', contractSize: 10000, exchange: 'NYMEX' },
  { symbol: 'RB', name: 'RBOB Gasoline', category: 'Energy', basePrice: 2.35, unit: 'gal', contractSize: 42000, exchange: 'NYMEX' },
  { symbol: 'HO', name: 'Heating Oil', category: 'Energy', basePrice: 2.65, unit: 'gal', contractSize: 42000, exchange: 'NYMEX' },
  // Metals
  { symbol: 'GC', name: 'Gold', category: 'Metals', basePrice: 2350.00, unit: 'oz', contractSize: 100, exchange: 'COMEX' },
  { symbol: 'SI', name: 'Silver', category: 'Metals', basePrice: 28.50, unit: 'oz', contractSize: 5000, exchange: 'COMEX' },
  { symbol: 'PL', name: 'Platinum', category: 'Metals', basePrice: 960.00, unit: 'oz', contractSize: 50, exchange: 'NYMEX' },
  { symbol: 'PA', name: 'Palladium', category: 'Metals', basePrice: 1050.00, unit: 'oz', contractSize: 100, exchange: 'NYMEX' },
  { symbol: 'HG', name: 'Copper', category: 'Metals', basePrice: 4.25, unit: 'lb', contractSize: 25000, exchange: 'COMEX' },
  // Agriculture
  { symbol: 'ZC', name: 'Corn', category: 'Agriculture', basePrice: 4.55, unit: 'bu', contractSize: 5000, exchange: 'CBOT' },
  { symbol: 'ZW', name: 'Wheat', category: 'Agriculture', basePrice: 5.85, unit: 'bu', contractSize: 5000, exchange: 'CBOT' },
  { symbol: 'ZS', name: 'Soybeans', category: 'Agriculture', basePrice: 12.50, unit: 'bu', contractSize: 5000, exchange: 'CBOT' },
  { symbol: 'ZM', name: 'Soybean Meal', category: 'Agriculture', basePrice: 345.00, unit: 'ton', contractSize: 100, exchange: 'CBOT' },
  { symbol: 'ZL', name: 'Soybean Oil', category: 'Agriculture', basePrice: 45.50, unit: 'lb', contractSize: 60000, exchange: 'CBOT' },
  { symbol: 'CT', name: 'Cotton', category: 'Agriculture', basePrice: 78.00, unit: 'lb', contractSize: 50000, exchange: 'ICE' },
  // Softs
  { symbol: 'KC', name: 'Coffee', category: 'Softs', basePrice: 185.00, unit: 'lb', contractSize: 37500, exchange: 'ICE' },
  { symbol: 'SB', name: 'Sugar', category: 'Softs', basePrice: 22.50, unit: 'lb', contractSize: 112000, exchange: 'ICE' },
  { symbol: 'CC', name: 'Cocoa', category: 'Softs', basePrice: 8200.00, unit: 'ton', contractSize: 10, exchange: 'ICE' },
  // Livestock
  { symbol: 'LE', name: 'Live Cattle', category: 'Livestock', basePrice: 178.00, unit: 'lb', contractSize: 40000, exchange: 'CME' },
  { symbol: 'HE', name: 'Lean Hogs', category: 'Livestock', basePrice: 72.00, unit: 'lb', contractSize: 40000, exchange: 'CME' },
  { symbol: 'GF', name: 'Feeder Cattle', category: 'Livestock', basePrice: 248.00, unit: 'lb', contractSize: 50000, exchange: 'CME' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mockCommodityQuote(data: typeof COMMODITY_DATA[0]): CommodityQuote {
  const change = (Math.random() - 0.48) * data.basePrice * 0.03;
  const price = +(data.basePrice + change).toFixed(2);
  return {
    symbol: data.symbol,
    name: data.name,
    category: data.category,
    price,
    change: +change.toFixed(2),
    changePct: +((change / data.basePrice) * 100).toFixed(2),
    high: +(price * 1.008).toFixed(2),
    low: +(price * 0.992).toFixed(2),
    open: +(data.basePrice + (Math.random() - 0.5) * data.basePrice * 0.01).toFixed(2),
    prevClose: +data.basePrice.toFixed(2),
    volume: Math.floor(50000 + Math.random() * 200000),
    openInterest: Math.floor(200000 + Math.random() * 500000),
    expiryDate: '2025-03-20',
    unit: data.unit,
    contractSize: data.contractSize,
    exchange: data.exchange,
    timestamp: Date.now(),
  };
}

let alertId = 0;

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: CommoditiesState = {
  quotes: COMMODITY_DATA.map(mockCommodityQuote),
  activeCommodity: 'CL',
  futuresCurve: null,
  seasonality: null,
  supplyDemand: null,
  spreads: [],
  correlationMatrix: null,
  categoryPerformance: [],
  watchlist: ['CL', 'GC', 'NG', 'ZC', 'SI'],
  alerts: [],
};

export function useCommodities(): [CommoditiesState, CommoditiesActions] {
  const [state, setState] = useState<CommoditiesState>(INITIAL_STATE);

  const setActiveCommodity = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, activeCommodity: symbol }));
  }, []);

  const refreshQuotes = useCallback(() => {
    setState(prev => ({
      ...prev,
      quotes: COMMODITY_DATA.map(mockCommodityQuote),
    }));
  }, []);

  const addToWatchlist = useCallback((symbol: string) => {
    setState(prev => prev.watchlist.includes(symbol) ? prev : { ...prev, watchlist: [...prev.watchlist, symbol] });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, watchlist: prev.watchlist.filter(s => s !== symbol) }));
  }, []);

  const computeFuturesCurve = useCallback((symbol?: string) => {
    const sym = symbol || state.activeCommodity;
    const baseQuote = state.quotes.find(q => q.symbol === sym);
    if (!baseQuote) return;

    const points = [];
    let price = baseQuote.price;
    const isContango = Math.random() > 0.4;

    for (let i = 0; i < 12; i++) {
      const month = MONTHS[(new Date().getMonth() + i + 1) % 12];
      const drift = isContango
        ? price * (0.002 + Math.random() * 0.005)
        : price * (-0.003 - Math.random() * 0.004);
      price = +(price + drift).toFixed(2);
      points.push({
        month: `${month} '${25 + Math.floor((new Date().getMonth() + i + 1) / 12)}`,
        price,
        volume: Math.floor(10000 + Math.random() * 50000),
        oi: Math.floor(50000 + Math.random() * 200000),
        daysToExpiry: (i + 1) * 30,
      });
    }

    const steepness = (points[points.length - 1].price - baseQuote.price) / (baseQuote.price * 12) * 100;

    setState(prev => ({
      ...prev,
      futuresCurve: {
        symbol: sym,
        points,
        structure: isContango ? 'contango' : 'backwardation',
        steepness: +steepness.toFixed(3),
        rollYield: +(steepness * -12).toFixed(2),
      },
    }));
  }, [state.activeCommodity, state.quotes]);

  const computeSeasonality = useCallback((symbol?: string) => {
    const sym = symbol || state.activeCommodity;
    const monthlyReturns = MONTHS.map(() => +((Math.random() - 0.4) * 6).toFixed(2));
    const bestIdx = monthlyReturns.indexOf(Math.max(...monthlyReturns));
    const worstIdx = monthlyReturns.indexOf(Math.min(...monthlyReturns));

    setState(prev => ({
      ...prev,
      seasonality: {
        symbol: sym,
        monthlyReturns,
        monthlyNames: MONTHS,
        bestMonth: { month: MONTHS[bestIdx], avgReturn: monthlyReturns[bestIdx] },
        worstMonth: { month: MONTHS[worstIdx], avgReturn: monthlyReturns[worstIdx] },
        years: 20,
      },
    }));
  }, [state.activeCommodity]);

  const loadSupplyDemand = useCallback((symbol?: string) => {
    const sym = symbol || state.activeCommodity;
    const data: SupplyDemandData = {
      symbol: sym,
      production: +(90 + Math.random() * 20).toFixed(1),
      consumption: +(88 + Math.random() * 22).toFixed(1),
      inventory: +(400 + Math.random() * 200).toFixed(0),
      inventoryChange: +((Math.random() - 0.5) * 20).toFixed(1),
      daysOfSupply: +(20 + Math.random() * 30).toFixed(0),
      importExportBalance: +((Math.random() - 0.5) * 10).toFixed(1),
    };
    setState(prev => ({ ...prev, supplyDemand: data }));
  }, [state.activeCommodity]);

  const computeSpreads = useCallback(() => {
    const spreadPairs = [
      { name: 'WTI-Brent', leg1: 'CL', leg2: 'BZ' },
      { name: 'Gold-Silver Ratio', leg1: 'GC', leg2: 'SI' },
      { name: 'Crack Spread (Gas)', leg1: 'RB', leg2: 'CL' },
      { name: 'Crush Spread', leg1: 'ZS', leg2: 'ZM' },
      { name: 'Cattle-Corn', leg1: 'LE', leg2: 'ZC' },
      { name: 'Gold-Platinum', leg1: 'GC', leg2: 'PL' },
    ];

    const spreads: SpreadData[] = spreadPairs.map(sp => {
      const q1 = state.quotes.find(q => q.symbol === sp.leg1);
      const q2 = state.quotes.find(q => q.symbol === sp.leg2);
      const spread = (q1?.price || 0) - (q2?.price || 0);
      const mean = spread * (1 + (Math.random() - 0.5) * 0.1);
      const stdDev = Math.abs(spread * 0.05);
      return {
        name: sp.name,
        leg1: sp.leg1,
        leg2: sp.leg2,
        spread: +spread.toFixed(2),
        mean: +mean.toFixed(2),
        stdDev: +stdDev.toFixed(2),
        zScore: +((spread - mean) / (stdDev || 1)).toFixed(2),
        percentile: Math.floor(20 + Math.random() * 60),
      };
    });

    setState(prev => ({ ...prev, spreads }));
  }, [state.quotes]);

  const computeCorrelation = useCallback(() => {
    const symbols = ['CL', 'GC', 'NG', 'SI', 'ZC', 'ZW', 'HG'];
    const n = symbols.length;
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        if (j < i) return 0; // will mirror
        return +((Math.random() - 0.3) * 1.2).toFixed(3);
      }),
    );
    // Mirror
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        matrix[i][j] = matrix[j][i];
      }
    }
    setState(prev => ({ ...prev, correlationMatrix: { commodities: symbols, matrix } }));
  }, []);

  const computeCategoryPerformance = useCallback(() => {
    const categories = ['Energy', 'Metals', 'Agriculture', 'Softs', 'Livestock'] as const;
    const perf = categories.map(cat => {
      const items = state.quotes.filter(q => q.category === cat);
      return {
        category: cat,
        change: +(items.reduce((s, q) => s + q.changePct, 0) / (items.length || 1)).toFixed(2),
        volume: items.reduce((s, q) => s + q.volume, 0),
        count: items.length,
      };
    });
    setState(prev => ({ ...prev, categoryPerformance: perf }));
  }, [state.quotes]);

  const addPriceAlert = useCallback((symbol: string, condition: 'above' | 'below', price: number): string => {
    const id = `cmdalert_${++alertId}`;
    setState(prev => ({
      ...prev,
      alerts: [...prev.alerts, { id, symbol, condition, price, triggered: false }],
    }));
    return id;
  }, []);

  const removePriceAlert = useCallback((id: string) => {
    setState(prev => ({ ...prev, alerts: prev.alerts.filter(a => a.id !== id) }));
  }, []);

  const actions: CommoditiesActions = useMemo(() => ({
    setActiveCommodity, refreshQuotes, addToWatchlist, removeFromWatchlist,
    computeFuturesCurve, computeSeasonality, loadSupplyDemand,
    computeSpreads, computeCorrelation, computeCategoryPerformance,
    addPriceAlert, removePriceAlert,
  }), [
    setActiveCommodity, refreshQuotes, addToWatchlist, removeFromWatchlist,
    computeFuturesCurve, computeSeasonality, loadSupplyDemand,
    computeSpreads, computeCorrelation, computeCategoryPerformance,
    addPriceAlert, removePriceAlert,
  ]);

  return [state, actions];
}
