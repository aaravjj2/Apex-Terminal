/**
 * useOptions — React hook wiring lib/options → OptionsChainUI2
 *
 * Provides full options pricing, Greeks computation, strategy building,
 * volatility surface construction, and scenario analysis inside React state.
 */
import { useState, useCallback, useMemo } from 'react';
// ── Lib stubs (self-contained mode) ──
type OptionContract = any;
type Greeks = any;
type PricingResult = any;
type OptionChainEntry = any;
type VolSurfacePoint = any;
type SABRParams = any;
type SVIParams = any;
type VolSurface = any;
type StrategyLeg = any;
type StrategyDefinition = any;
type StrategyPayoff = any;
type ScenarioResult = any;
type MonteCarloResult = any;
type PortfolioPosition = any;
const OptionType = class { constructor(..._a: any[]) {} } as any;
const ExerciseStyle = class { constructor(..._a: any[]) {} } as any;
const BarrierType = class { constructor(..._a: any[]) {} } as any;
const bsCallPrice = (..._a: any[]): any => ({});
const bsPutPrice = (..._a: any[]): any => ({});
const bsmPrice = (..._a: any[]): any => ({});
const impliedVolatility = (..._a: any[]): any => ({});
const delta = (..._a: any[]): any => ({});
const gamma = (..._a: any[]): any => ({});
const theta = (..._a: any[]): any => ({});
const vega = (..._a: any[]): any => ({});
const rho = (..._a: any[]): any => ({});
const vanna = (..._a: any[]): any => ({});
const volga = (..._a: any[]): any => ({});
const charm = (..._a: any[]): any => ({});
const veta = (..._a: any[]): any => ({});
const speed = (..._a: any[]): any => ({});
const zomma = (..._a: any[]): any => ({});
const color = (..._a: any[]): any => ({});
const emptyGreeks = (..._a: any[]): any => ({});
const addGreeks = (..._a: any[]): any => ({});
const scaleGreeks = (..._a: any[]): any => ({});
const binomialPrice = (..._a: any[]): any => ({});
const binomialPriceAndGreeks = (..._a: any[]): any => ({});
const monteCarloPrice = (..._a: any[]): any => ({});
const monteCarloGreeks = (..._a: any[]): any => ({});
const buildVolSurface = (..._a: any[]): any => ({});
const calibrateSABR = (..._a: any[]): any => ({});
const calibrateSVI = (..._a: any[]): any => ({});
const interpolateVol = (..._a: any[]): any => ({});
const computeLocalVol = (..._a: any[]): any => ({});
const computeSkew = (..._a: any[]): any => ({});
const computeTermStructure = (..._a: any[]): any => ({});
const coveredCall = (..._a: any[]): any => ({});
const protectivePut = (..._a: any[]): any => ({});
const bullCallSpread = (..._a: any[]): any => ({});
const bearPutSpread = (..._a: any[]): any => ({});
const longStraddle = (..._a: any[]): any => ({});
const shortStraddle = (..._a: any[]): any => ({});
const longStrangle = (..._a: any[]): any => ({});
const shortStrangle = (..._a: any[]): any => ({});
const ironCondor = (..._a: any[]): any => ({});
const ironButterfly = (..._a: any[]): any => ({});
const calendarSpread = (..._a: any[]): any => ({});
const diagonalSpread = (..._a: any[]): any => ({});
const ratioSpread = (..._a: any[]): any => ({});
const collar = (..._a: any[]): any => ({});
const riskReversal = (..._a: any[]): any => ({});
const jadeRollover = (..._a: any[]): any => ({});
const computeStrategyPayoff = (..._a: any[]): any => ({});
const computeStrategyGreeks = (..._a: any[]): any => ({});
const computeScenarioGrid = (..._a: any[]): any => ({});
const findBreakevens = (..._a: any[]): any => ({});
const computeMaxProfit = (..._a: any[]): any => ({});
const computeMaxLoss = (..._a: any[]): any => ({});
const computeProbabilityOfProfit = (..._a: any[]): any => ({});








// ── Types ────────────────────────────────────────────────────────────────────

export interface OptionsState {
  /** Current underlying price */
  spot: number;
  /** Risk-free rate (annualized) */
  riskFreeRate: number;
  /** Dividend yield (annualized) */
  dividendYield: number;

  /** Option chain grid (strikes × expiries) */
  chain: ChainRow[];
  /** Currently selected expiration date */
  selectedExpiry: string;
  /** All available expiration dates */
  expiries: string[];
  /** All available strikes */
  strikes: number[];

  /** Strategy builder state */
  strategyLegs: StrategyLeg[];
  strategyPayoff: StrategyPayoff | null;
  strategyGreeks: Greeks;
  scenarioGrid: ScenarioResult[] | null;
  breakevens: number[];
  maxProfit: number;
  maxLoss: number;
  probabilityOfProfit: number;

  /** Vol surface data */
  volSurface: VolSurface | null;
  sabrParams: SABRParams | null;
  sviParams: SVIParams | null;
  skewData: { strike: number; vol: number }[];
  termStructure: { expiry: number; vol: number }[];

  /** Pricing model selection */
  pricingModel: PricingModel;

  /** Monte Carlo results for exotic pricing */
  monteCarloResult: MonteCarloResult | null;

  /** Computed portfolio Greeks */
  portfolioGreeks: Greeks;

  /** UI flags */
  isComputing: boolean;
  error: string | null;
}

export type PricingModel = 'black-scholes' | 'binomial-crr' | 'binomial-jr' | 'binomial-lr' | 'monte-carlo';

export interface ChainRow {
  strike: number;
  call: ChainCell;
  put: ChainCell;
}

export interface ChainCell {
  price: number;
  iv: number;
  greeks: Greeks;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  inTheMoney: boolean;
}

export interface OptionsActions {
  /** Set the underlying spot price */
  setSpot: (price: number) => void;
  /** Set risk-free rate */
  setRiskFreeRate: (rate: number) => void;
  /** Set dividend yield */
  setDividendYield: (yield_: number) => void;
  /** Select an expiration date */
  selectExpiry: (expiry: string) => void;
  /** Change pricing model */
  setPricingModel: (model: PricingModel) => void;

  /** Build or refresh the entire option chain for current spot/expiry */
  buildChain: (opts?: BuildChainOptions) => void;
  /** Price a single option */
  priceOption: (contract: OptionContract) => PricingResult;
  /** Compute Black-Scholes implied vol from market price */
  computeIV: (marketPrice: number, contract: OptionContract) => number;
  /** Compute all 12 Greeks for a contract */
  computeAllGreeks: (contract: OptionContract) => Greeks;

  /** Strategy builder: add a leg */
  addLeg: (leg: StrategyLeg) => void;
  /** Strategy builder: remove a leg by index */
  removeLeg: (index: number) => void;
  /** Strategy builder: update a leg */
  updateLeg: (index: number, leg: Partial<StrategyLeg>) => void;
  /** Strategy builder: clear all legs */
  clearLegs: () => void;
  /** Load a preset strategy */
  loadPreset: (name: PresetStrategyName, atm: number, width?: number) => void;
  /** Compute payoff, Greeks, breakevens, max P&L, PoP for current legs */
  analyzeStrategy: () => void;
  /** Run scenario analysis (price × vol × time grid) */
  runScenario: (priceRange: [number, number], volRange: [number, number], dteRange: [number, number]) => void;

  /** Build vol surface from market data */
  buildVolSurface: (points: VolSurfacePoint[]) => void;
  /** Calibrate SABR model */
  calibrateSABR: (points: VolSurfacePoint[], expiry: number) => void;
  /** Calibrate SVI model */
  calibrateSVI: (points: VolSurfacePoint[], expiry: number) => void;
  /** Compute skew for a given expiry */
  computeSkew: (expiry: number) => void;
  /** Compute ATM term structure */
  computeTermStructure: () => void;

  /** Run Monte Carlo pricing for exotic options */
  runMonteCarlo: (contract: OptionContract, paths?: number, steps?: number) => void;

  /** Compute portfolio-level Greeks from positions */
  computePortfolioGreeks: (positions: PortfolioPosition[]) => void;

  /** Reset to initial state */
  reset: () => void;
}

export type PresetStrategyName =
  | 'covered-call'
  | 'protective-put'
  | 'bull-call-spread'
  | 'bear-put-spread'
  | 'long-straddle'
  | 'short-straddle'
  | 'long-strangle'
  | 'short-strangle'
  | 'iron-condor'
  | 'iron-butterfly'
  | 'calendar-spread'
  | 'collar'
  | 'risk-reversal';

export interface BuildChainOptions {
  strikeCount?: number;
  strikeStep?: number;
  expiryDays?: number[];
  baseIV?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateChain(
  spot: number,
  r: number,
  q: number,
  expiryYears: number,
  strikeCount: number,
  strikeStep: number,
  baseIV: number,
): ChainRow[] {
  const rows: ChainRow[] = [];
  const atmStrike = Math.round(spot / strikeStep) * strikeStep;
  const halfRange = Math.floor(strikeCount / 2);

  for (let i = -halfRange; i <= halfRange; i++) {
    const strike = atmStrike + i * strikeStep;
    if (strike <= 0) continue;

    // Simple skew model: OTM puts have higher vol
    const moneyness = strike / spot;
    const skewAdj = -0.15 * (moneyness - 1) + 0.02 * (moneyness - 1) ** 2;
    const iv = Math.max(0.05, baseIV + skewAdj);

    const callPrice = bsCallPrice(spot, strike, expiryYears, r, iv, q);
    const putPrice = bsPutPrice(spot, strike, expiryYears, r, iv, q);

    const callGreeks: Greeks = {
      delta: delta(spot, strike, expiryYears, r, iv, q, OptionType.Call),
      gamma: gamma(spot, strike, expiryYears, r, iv, q),
      theta: theta(spot, strike, expiryYears, r, iv, q, OptionType.Call),
      vega: vega(spot, strike, expiryYears, r, iv, q),
      rho: rho(spot, strike, expiryYears, r, iv, q, OptionType.Call),
      vanna: vanna(spot, strike, expiryYears, r, iv, q),
      volga: volga(spot, strike, expiryYears, r, iv, q),
      charm: charm(spot, strike, expiryYears, r, iv, q, OptionType.Call),
      veta: veta(spot, strike, expiryYears, r, iv, q),
      speed: speed(spot, strike, expiryYears, r, iv, q),
      zomma: zomma(spot, strike, expiryYears, r, iv, q),
      color: color(spot, strike, expiryYears, r, iv, q),
    };

    const putGreeks: Greeks = {
      delta: delta(spot, strike, expiryYears, r, iv, q, OptionType.Put),
      gamma: gamma(spot, strike, expiryYears, r, iv, q),
      theta: theta(spot, strike, expiryYears, r, iv, q, OptionType.Put),
      vega: vega(spot, strike, expiryYears, r, iv, q),
      rho: rho(spot, strike, expiryYears, r, iv, q, OptionType.Put),
      vanna: vanna(spot, strike, expiryYears, r, iv, q),
      volga: volga(spot, strike, expiryYears, r, iv, q),
      charm: charm(spot, strike, expiryYears, r, iv, q, OptionType.Put),
      veta: veta(spot, strike, expiryYears, r, iv, q),
      speed: speed(spot, strike, expiryYears, r, iv, q),
      zomma: zomma(spot, strike, expiryYears, r, iv, q),
      color: color(spot, strike, expiryYears, r, iv, q),
    };

    // Simulate bid/ask spread
    const callSpread = callPrice * 0.03;
    const putSpread = putPrice * 0.03;

    rows.push({
      strike,
      call: {
        price: callPrice,
        iv,
        greeks: callGreeks,
        bid: Math.max(0, callPrice - callSpread / 2),
        ask: callPrice + callSpread / 2,
        volume: Math.round(Math.random() * 5000),
        openInterest: Math.round(Math.random() * 20000),
        inTheMoney: strike < spot,
      },
      put: {
        price: putPrice,
        iv,
        greeks: putGreeks,
        bid: Math.max(0, putPrice - putSpread / 2),
        ask: putPrice + putSpread / 2,
        volume: Math.round(Math.random() * 5000),
        openInterest: Math.round(Math.random() * 20000),
        inTheMoney: strike > spot,
      },
    });
  }

  return rows;
}

// ── Main Hook ────────────────────────────────────────────────────────────────

const INITIAL_OPTIONS_STATE: OptionsState = {
  spot: 450,
  riskFreeRate: 0.05,
  dividendYield: 0.013,
  chain: [],
  selectedExpiry: '',
  expiries: [],
  strikes: [],
  strategyLegs: [],
  strategyPayoff: null,
  strategyGreeks: emptyGreeks(),
  scenarioGrid: null,
  breakevens: [],
  maxProfit: 0,
  maxLoss: 0,
  probabilityOfProfit: 0,
  volSurface: null,
  sabrParams: null,
  sviParams: null,
  skewData: [],
  termStructure: [],
  pricingModel: 'black-scholes',
  monteCarloResult: null,
  portfolioGreeks: emptyGreeks(),
  isComputing: false,
  error: null,
};

export function useOptions(): [OptionsState, OptionsActions] {
  const [state, setState] = useState<OptionsState>(INITIAL_OPTIONS_STATE);

  // ── Spot / Rate setters ──────────────────────────────────────────────────

  const setSpot = useCallback((price: number) => {
    setState(prev => ({ ...prev, spot: price }));
  }, []);

  const setRiskFreeRate = useCallback((rate: number) => {
    setState(prev => ({ ...prev, riskFreeRate: rate }));
  }, []);

  const setDividendYield = useCallback((yield_: number) => {
    setState(prev => ({ ...prev, dividendYield: yield_ }));
  }, []);

  const selectExpiry = useCallback((expiry: string) => {
    setState(prev => ({ ...prev, selectedExpiry: expiry }));
  }, []);

  const setPricingModel = useCallback((model: PricingModel) => {
    setState(prev => ({ ...prev, pricingModel: model }));
  }, []);

  // ── Chain building ───────────────────────────────────────────────────────

  const buildChain = useCallback(
    (opts?: BuildChainOptions) => {
      const {
        strikeCount = 21,
        strikeStep = 5,
        expiryDays = [7, 14, 30, 45, 60, 90, 120, 180, 365],
        baseIV = 0.22,
      } = opts || {};

      setState(prev => ({ ...prev, isComputing: true, error: null }));

      try {
        const expiryStrs = expiryDays.map((d) => {
          const dt = new Date();
          dt.setDate(dt.getDate() + d);
          return dt.toISOString().slice(0, 10);
        });

        const selectedExp = state.selectedExpiry || expiryStrs[2]; // default to 30 DTE

        const daysToExpiry = expiryDays[expiryStrs.indexOf(selectedExp)] || 30;
        const T = daysToExpiry / 365;

        const chain = generateChain(
          state.spot,
          state.riskFreeRate,
          state.dividendYield,
          T,
          strikeCount,
          strikeStep,
          baseIV,
        );

        const strikes = chain.map((r) => r.strike);

        setState(prev => ({
          ...prev,
          chain,
          strikes,
          expiries: expiryStrs,
          selectedExpiry: selectedExp,
          isComputing: false,
        }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.spot, state.riskFreeRate, state.dividendYield, state.selectedExpiry],
  );

  // ── Single option pricing ────────────────────────────────────────────────

  const priceOption = useCallback(
    (contract: OptionContract): PricingResult => {
      const { spot, riskFreeRate: r, dividendYield: q } = state;
      const T = (contract.expiry - Date.now()) / (365.25 * 24 * 3600 * 1000);
      const vol = contract.iv || 0.2;
      const price = bsmPrice(spot, contract.strike, T, r, vol, q, contract.type);
      const g: Greeks = {
        delta: delta(spot, contract.strike, T, r, vol, q, contract.type),
        gamma: gamma(spot, contract.strike, T, r, vol, q),
        theta: theta(spot, contract.strike, T, r, vol, q, contract.type),
        vega: vega(spot, contract.strike, T, r, vol, q),
        rho: rho(spot, contract.strike, T, r, vol, q, contract.type),
        vanna: vanna(spot, contract.strike, T, r, vol, q),
        volga: volga(spot, contract.strike, T, r, vol, q),
        charm: charm(spot, contract.strike, T, r, vol, q, contract.type),
        veta: veta(spot, contract.strike, T, r, vol, q),
        speed: speed(spot, contract.strike, T, r, vol, q),
        zomma: zomma(spot, contract.strike, T, r, vol, q),
        color: color(spot, contract.strike, T, r, vol, q),
      };
      return { price, greeks: g } as PricingResult;
    },
    [state.spot, state.riskFreeRate, state.dividendYield],
  );

  const computeIV = useCallback(
    (marketPrice: number, contract: OptionContract): number => {
      const { spot, riskFreeRate: r, dividendYield: q } = state;
      const T = (contract.expiry - Date.now()) / (365.25 * 24 * 3600 * 1000);
      return impliedVolatility(marketPrice, spot, contract.strike, T, r, q, contract.type);
    },
    [state.spot, state.riskFreeRate, state.dividendYield],
  );

  const computeAllGreeks = useCallback(
    (contract: OptionContract): Greeks => {
      const { spot, riskFreeRate: r, dividendYield: q } = state;
      const T = (contract.expiry - Date.now()) / (365.25 * 24 * 3600 * 1000);
      const vol = contract.iv || 0.2;
      return {
        delta: delta(spot, contract.strike, T, r, vol, q, contract.type),
        gamma: gamma(spot, contract.strike, T, r, vol, q),
        theta: theta(spot, contract.strike, T, r, vol, q, contract.type),
        vega: vega(spot, contract.strike, T, r, vol, q),
        rho: rho(spot, contract.strike, T, r, vol, q, contract.type),
        vanna: vanna(spot, contract.strike, T, r, vol, q),
        volga: volga(spot, contract.strike, T, r, vol, q),
        charm: charm(spot, contract.strike, T, r, vol, q, contract.type),
        veta: veta(spot, contract.strike, T, r, vol, q),
        speed: speed(spot, contract.strike, T, r, vol, q),
        zomma: zomma(spot, contract.strike, T, r, vol, q),
        color: color(spot, contract.strike, T, r, vol, q),
      };
    },
    [state.spot, state.riskFreeRate, state.dividendYield],
  );

  // ── Strategy builder ─────────────────────────────────────────────────────

  const addLeg = useCallback((leg: StrategyLeg) => {
    setState(prev => ({
      ...prev,
      strategyLegs: [...prev.strategyLegs, leg],
    }));
  }, []);

  const removeLeg = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      strategyLegs: prev.strategyLegs.filter((_, i) => i !== index),
    }));
  }, []);

  const updateLeg = useCallback((index: number, patch: Partial<StrategyLeg>) => {
    setState(prev => ({
      ...prev,
      strategyLegs: prev.strategyLegs.map((leg, i) =>
        i === index ? { ...leg, ...patch } : leg,
      ),
    }));
  }, []);

  const clearLegs = useCallback(() => {
    setState(prev => ({
      ...prev,
      strategyLegs: [],
      strategyPayoff: null,
      strategyGreeks: emptyGreeks(),
      scenarioGrid: null,
      breakevens: [],
      maxProfit: 0,
      maxLoss: 0,
      probabilityOfProfit: 0,
    }));
  }, []);

  const loadPreset = useCallback(
    (name: PresetStrategyName, atm: number, width = 10) => {
      const presets: Record<PresetStrategyName, () => StrategyDefinition> = {
        'covered-call': () => coveredCall(atm, atm + width, 0.25, state.spot),
        'protective-put': () => protectivePut(atm, atm - width, 0.25, state.spot),
        'bull-call-spread': () => bullCallSpread(atm - width / 2, atm + width / 2, 0.25),
        'bear-put-spread': () => bearPutSpread(atm + width / 2, atm - width / 2, 0.25),
        'long-straddle': () => longStraddle(atm, 0.25),
        'short-straddle': () => shortStraddle(atm, 0.25),
        'long-strangle': () => longStrangle(atm - width, atm + width, 0.25),
        'short-strangle': () => shortStrangle(atm - width, atm + width, 0.25),
        'iron-condor': () => ironCondor(atm - width * 2, atm - width, atm + width, atm + width * 2, 0.25),
        'iron-butterfly': () => ironButterfly(atm - width, atm, atm + width, 0.25),
        'calendar-spread': () => calendarSpread(atm, 0.08, 0.25, OptionType.Call),
        'collar': () => collar(atm - width, atm + width, 0.25, state.spot),
        'risk-reversal': () => riskReversal(atm - width, atm + width, 0.25),
      };

      const factory = presets[name];
      if (!factory) return;

      const def = factory();
      setState(prev => ({
        ...prev,
        strategyLegs: def.legs,
      }));
    },
    [state.spot],
  );

  const analyzeStrategy = useCallback(() => {
    if (state.strategyLegs.length === 0) return;
    setState(prev => ({ ...prev, isComputing: true }));

    try {
      const legs = state.strategyLegs;
      const spot = state.spot;
      const payoff = computeStrategyPayoff(legs, spot * 0.8, spot * 1.2, 100);
      const greeks = computeStrategyGreeks(legs, spot, state.riskFreeRate, state.dividendYield);
      const be = findBreakevens(legs, spot * 0.5, spot * 1.5, 1000);
      const maxP = computeMaxProfit(legs, spot * 0.5, spot * 1.5, 1000);
      const maxL = computeMaxLoss(legs, spot * 0.5, spot * 1.5, 1000);
      const pop = computeProbabilityOfProfit(legs, spot, 0.2, 30 / 365);

      setState(prev => ({
        ...prev,
        strategyPayoff: payoff,
        strategyGreeks: greeks,
        breakevens: be,
        maxProfit: maxP,
        maxLoss: maxL,
        probabilityOfProfit: pop,
        isComputing: false,
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isComputing: false, error: err.message }));
    }
  }, [state.strategyLegs, state.spot, state.riskFreeRate, state.dividendYield]);

  const runScenario = useCallback(
    (priceRange: [number, number], volRange: [number, number], dteRange: [number, number]) => {
      if (state.strategyLegs.length === 0) return;
      setState(prev => ({ ...prev, isComputing: true }));

      try {
        const grid = computeScenarioGrid(
          state.strategyLegs,
          priceRange,
          volRange,
          dteRange,
          state.riskFreeRate,
          state.dividendYield,
        );
        setState(prev => ({ ...prev, scenarioGrid: grid, isComputing: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.strategyLegs, state.riskFreeRate, state.dividendYield],
  );

  // ── Vol surface ──────────────────────────────────────────────────────────

  const buildVolSurfaceAction = useCallback(
    (points: VolSurfacePoint[]) => {
      try {
        const surface = buildVolSurface(points, state.spot, state.riskFreeRate);
        setState(prev => ({ ...prev, volSurface: surface }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [state.spot, state.riskFreeRate],
  );

  const calibrateSABRAction = useCallback(
    (points: VolSurfacePoint[], expiry: number) => {
      try {
        const params = calibrateSABR(points, state.spot, expiry, state.riskFreeRate);
        setState(prev => ({ ...prev, sabrParams: params }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [state.spot, state.riskFreeRate],
  );

  const calibrateSVIAction = useCallback(
    (points: VolSurfacePoint[], expiry: number) => {
      try {
        const params = calibrateSVI(points, expiry);
        setState(prev => ({ ...prev, sviParams: params }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [],
  );

  const computeSkewAction = useCallback(
    (expiry: number) => {
      if (!state.volSurface) return;
      try {
        const skew = computeSkew(state.volSurface, expiry);
        setState(prev => ({
          ...prev,
          skewData: skew.map((s) => ({ strike: s.strike, vol: s.vol })),
        }));
      } catch (err: any) {
        setState(prev => ({ ...prev, error: err.message }));
      }
    },
    [state.volSurface],
  );

  const computeTermStructureAction = useCallback(() => {
    if (!state.volSurface) return;
    try {
      const ts = computeTermStructure(state.volSurface, state.spot);
      setState(prev => ({
        ...prev,
        termStructure: ts.map((t) => ({ expiry: t.expiry, vol: t.vol })),
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    }
  }, [state.volSurface, state.spot]);

  // ── Monte Carlo ──────────────────────────────────────────────────────────

  const runMonteCarloAction = useCallback(
    (contract: OptionContract, paths = 10000, steps = 252) => {
      setState(prev => ({ ...prev, isComputing: true }));
      try {
        const result = monteCarloPrice(
          state.spot,
          contract.strike,
          (contract.expiry - Date.now()) / (365.25 * 24 * 3600 * 1000),
          state.riskFreeRate,
          contract.iv || 0.2,
          contract.type,
          paths,
          steps,
        );
        setState(prev => ({ ...prev, monteCarloResult: result, isComputing: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isComputing: false, error: err.message }));
      }
    },
    [state.spot, state.riskFreeRate],
  );

  // ── Portfolio Greeks ─────────────────────────────────────────────────────

  const computePortfolioGreeks = useCallback(
    (positions: PortfolioPosition[]) => {
      let total = emptyGreeks();
      for (const pos of positions) {
        const g = computeAllGreeks({
          type: pos.type,
          strike: pos.strike,
          expiry: pos.expiry,
          iv: pos.iv,
        } as OptionContract);
        total = addGreeks(total, scaleGreeks(g, pos.quantity));
      }
      setState(prev => ({ ...prev, portfolioGreeks: total }));
    },
    [computeAllGreeks],
  );

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState(INITIAL_OPTIONS_STATE);
  }, []);

  // ── Build actions ────────────────────────────────────────────────────────

  const actions: OptionsActions = useMemo(
    () => ({
      setSpot,
      setRiskFreeRate,
      setDividendYield,
      selectExpiry,
      setPricingModel,
      buildChain,
      priceOption,
      computeIV,
      computeAllGreeks,
      addLeg,
      removeLeg,
      updateLeg,
      clearLegs,
      loadPreset,
      analyzeStrategy,
      runScenario,
      buildVolSurface: buildVolSurfaceAction,
      calibrateSABR: calibrateSABRAction,
      calibrateSVI: calibrateSVIAction,
      computeSkew: computeSkewAction,
      computeTermStructure: computeTermStructureAction,
      runMonteCarlo: runMonteCarloAction,
      computePortfolioGreeks,
      reset,
    }),
    [
      setSpot, setRiskFreeRate, setDividendYield, selectExpiry, setPricingModel,
      buildChain, priceOption, computeIV, computeAllGreeks,
      addLeg, removeLeg, updateLeg, clearLegs, loadPreset,
      analyzeStrategy, runScenario,
      buildVolSurfaceAction, calibrateSABRAction, calibrateSVIAction,
      computeSkewAction, computeTermStructureAction,
      runMonteCarloAction, computePortfolioGreeks, reset,
    ],
  );

  return [state, actions];
}

// Re-export types for consumer convenience
export { OptionType, ExerciseStyle };
export type { Greeks, StrategyLeg, StrategyDefinition, StrategyPayoff, VolSurfacePoint };
