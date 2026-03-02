import type {
  Attribution,
  SectorAttribution,
  FactorAttribution,
  MultiPeriodAttribution,
} from './types';
import { matMul, transpose, matInverse, mean, variance } from './risk';

// ─── Brinson-Hood-Beebower (BHB) Attribution ────────────────────────────────

export interface BHBInput {
  sectors: string[];
  portfolioWeights: number[];
  benchmarkWeights: number[];
  portfolioReturns: number[];
  benchmarkReturns: number[];
}

export function brinsonHoodBeebower(input: BHBInput): SectorAttribution[] {
  const { sectors, portfolioWeights, benchmarkWeights, portfolioReturns, benchmarkReturns } = input;
  const n = sectors.length;

  const totalBenchmarkReturn = benchmarkWeights.reduce(
    (s, w, i) => s + w * benchmarkReturns[i], 0
  );

  const results: SectorAttribution[] = [];

  for (let i = 0; i < n; i++) {
    const wp = portfolioWeights[i];
    const wb = benchmarkWeights[i];
    const rp = portfolioReturns[i];
    const rb = benchmarkReturns[i];

    // BHB decomposition
    const allocation = (wp - wb) * rb;
    const selection = wb * (rp - rb);
    const interaction = (wp - wb) * (rp - rb);

    results.push({
      sector: sectors[i],
      portfolioWeight: wp,
      benchmarkWeight: wb,
      portfolioReturn: rp,
      benchmarkReturn: rb,
      allocation,
      selection,
      interaction,
      total: allocation + selection + interaction,
    });
  }

  return results;
}

export function brinsonHoodBeebowerTotal(input: BHBInput): Attribution {
  const sectorResults = brinsonHoodBeebower(input);
  return {
    allocation: sectorResults.reduce((s, r) => s + r.allocation, 0),
    selection: sectorResults.reduce((s, r) => s + r.selection, 0),
    interaction: sectorResults.reduce((s, r) => s + r.interaction, 0),
    currency: 0,
    total: sectorResults.reduce((s, r) => s + r.total, 0),
  };
}

// ─── Brinson-Fachler Attribution ────────────────────────────────────────────

export function brinsonFachler(input: BHBInput): SectorAttribution[] {
  const { sectors, portfolioWeights, benchmarkWeights, portfolioReturns, benchmarkReturns } = input;
  const n = sectors.length;

  const totalBenchmarkReturn = benchmarkWeights.reduce(
    (s, w, i) => s + w * benchmarkReturns[i], 0
  );

  const results: SectorAttribution[] = [];

  for (let i = 0; i < n; i++) {
    const wp = portfolioWeights[i];
    const wb = benchmarkWeights[i];
    const rp = portfolioReturns[i];
    const rb = benchmarkReturns[i];

    // Brinson-Fachler uses total benchmark return as the notional return
    const allocation = (wp - wb) * (rb - totalBenchmarkReturn);
    const selection = wb * (rp - rb);
    const interaction = (wp - wb) * (rp - rb);

    results.push({
      sector: sectors[i],
      portfolioWeight: wp,
      benchmarkWeight: wb,
      portfolioReturn: rp,
      benchmarkReturn: rb,
      allocation,
      selection,
      interaction,
      total: allocation + selection + interaction,
    });
  }

  return results;
}

// ─── Factor Attribution ─────────────────────────────────────────────────────

export interface FactorModelInput {
  assetReturns: number[];
  factorReturns: number[][];
  factorNames: string[];
}

export function factorAttribution(input: FactorModelInput): {
  alpha: number;
  factors: FactorAttribution[];
  residual: number;
  rSquared: number;
} {
  const { assetReturns, factorReturns, factorNames } = input;
  const nObs = assetReturns.length;
  const nFactors = factorNames.length;

  // OLS: y = X * beta + epsilon, X includes intercept
  const X: number[][] = factorReturns.map(row => [1, ...row]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInverse(XtX);
  const y = assetReturns.map(v => [v]);
  const Xty = matMul(Xt, y);
  const betaMatrix = matMul(XtXinv, Xty);
  const betas = betaMatrix.map(row => row[0]);

  const alpha = betas[0];
  const factorBetas = betas.slice(1);

  // Compute contributions & residual
  const predicted = new Array(nObs);
  for (let t = 0; t < nObs; t++) {
    predicted[t] = alpha;
    for (let f = 0; f < nFactors; f++) {
      predicted[t] += factorBetas[f] * factorReturns[t][f];
    }
  }

  const residuals = assetReturns.map((r, t) => r - predicted[t]);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssTot = assetReturns.reduce((s, r) => s + (r - mean(assetReturns)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const factors: FactorAttribution[] = factorNames.map((name, f) => ({
    factorName: name,
    exposure: factorBetas[f],
    factorReturn: mean(factorReturns.map(row => row[f])) * 252,
    contribution: factorBetas[f] * mean(factorReturns.map(row => row[f])) * 252,
  }));

  return {
    alpha: alpha * 252,
    factors,
    residual: mean(residuals) * 252,
    rSquared,
  };
}

// Fama-French 3-factor
export function famaFrench3Factor(
  assetReturns: number[],
  mktRf: number[],
  smb: number[],
  hml: number[]
): ReturnType<typeof factorAttribution> {
  const factorReturns = mktRf.map((_, i) => [mktRf[i], smb[i], hml[i]]);
  return factorAttribution({
    assetReturns,
    factorReturns,
    factorNames: ['Market', 'SMB', 'HML'],
  });
}

// Carhart 4-factor
export function carhart4Factor(
  assetReturns: number[],
  mktRf: number[],
  smb: number[],
  hml: number[],
  mom: number[]
): ReturnType<typeof factorAttribution> {
  const factorReturns = mktRf.map((_, i) => [mktRf[i], smb[i], hml[i], mom[i]]);
  return factorAttribution({
    assetReturns,
    factorReturns,
    factorNames: ['Market', 'SMB', 'HML', 'Momentum'],
  });
}

// ─── Fixed Income Attribution ───────────────────────────────────────────────

export interface FixedIncomeAttributionInput {
  portfolioDuration: number;
  benchmarkDuration: number;
  yieldCurveShift: number;
  portfolioSpread: number;
  benchmarkSpread: number;
  spreadChange: number;
  curveReshape: number[];
  keyRateDurations: number[];
}

export function fixedIncomeAttribution(input: FixedIncomeAttributionInput): {
  duration: number;
  credit: number;
  curve: number;
  spread: number;
  total: number;
} {
  const {
    portfolioDuration, benchmarkDuration, yieldCurveShift,
    portfolioSpread, benchmarkSpread, spreadChange,
    curveReshape, keyRateDurations,
  } = input;

  // Duration effect: difference in duration × parallel yield shift
  const duration = -(portfolioDuration - benchmarkDuration) * yieldCurveShift;

  // Credit effect: duration × spread change
  const credit = -portfolioDuration * (portfolioSpread - benchmarkSpread) * spreadChange;

  // Curve effect: sum of key rate duration × curve reshape
  let curve = 0;
  for (let i = 0; i < Math.min(curveReshape.length, keyRateDurations.length); i++) {
    curve += -keyRateDurations[i] * curveReshape[i];
  }

  // Spread effect
  const spread = -portfolioDuration * spreadChange;

  return { duration, credit, curve, spread, total: duration + credit + curve + spread };
}

// ─── Currency Attribution ───────────────────────────────────────────────────

export interface CurrencyAttributionInput {
  localReturns: number[];
  fxReturns: number[];
  weights: number[];
  benchmarkLocalReturns: number[];
  benchmarkFxReturns: number[];
  benchmarkWeights: number[];
}

export function currencyAttribution(input: CurrencyAttributionInput): {
  localEffect: number;
  currencyEffect: number;
  crossProduct: number;
  total: number;
} {
  const { localReturns, fxReturns, weights, benchmarkLocalReturns, benchmarkFxReturns, benchmarkWeights } = input;

  let portLocal = 0;
  let bmLocal = 0;
  let portCurrency = 0;
  let bmCurrency = 0;

  for (let i = 0; i < weights.length; i++) {
    portLocal += weights[i] * localReturns[i];
    portCurrency += weights[i] * fxReturns[i];
  }

  for (let i = 0; i < benchmarkWeights.length; i++) {
    bmLocal += benchmarkWeights[i] * benchmarkLocalReturns[i];
    bmCurrency += benchmarkWeights[i] * benchmarkFxReturns[i];
  }

  const localEffect = portLocal - bmLocal;
  const currencyEffect = portCurrency - bmCurrency;

  let crossProduct = 0;
  for (let i = 0; i < weights.length; i++) {
    crossProduct += weights[i] * localReturns[i] * fxReturns[i];
  }
  for (let i = 0; i < benchmarkWeights.length; i++) {
    crossProduct -= benchmarkWeights[i] * benchmarkLocalReturns[i] * benchmarkFxReturns[i];
  }

  return {
    localEffect,
    currencyEffect,
    crossProduct,
    total: localEffect + currencyEffect + crossProduct,
  };
}

// ─── Multi-Period Attribution Linking ────────────────────────────────────────

export interface PeriodAttribution {
  start: number;
  end: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  attribution: Attribution;
}

// Carino linking method
export function carinoLinking(periods: PeriodAttribution[]): MultiPeriodAttribution {
  const totalPortReturn = periods.reduce((p, pd) => p * (1 + pd.portfolioReturn), 1) - 1;
  const totalBmReturn = periods.reduce((p, pd) => p * (1 + pd.benchmarkReturn), 1) - 1;
  const totalActive = totalPortReturn - totalBmReturn;

  const k = (totalActive: number, portRet: number, bmRet: number) => {
    if (Math.abs(portRet - bmRet) < 1e-12) {
      return portRet !== 0 ? Math.log(1 + portRet) / portRet : 1;
    }
    const lp = portRet !== 0 ? Math.log(1 + portRet) : 0;
    const lb = bmRet !== 0 ? Math.log(1 + bmRet) : 0;
    return (lp - lb) / (portRet - bmRet);
  };

  const kTotal = k(totalActive, totalPortReturn, totalBmReturn);

  const factors = periods.map(pd => {
    const kt = k(pd.portfolioReturn - pd.benchmarkReturn, pd.portfolioReturn, pd.benchmarkReturn);
    return kTotal !== 0 ? kt / kTotal : 1 / periods.length;
  });

  const linked: Attribution = { allocation: 0, selection: 0, interaction: 0, currency: 0, total: 0 };

  for (let i = 0; i < periods.length; i++) {
    const f = factors[i];
    linked.allocation += f * periods[i].attribution.allocation;
    linked.selection += f * periods[i].attribution.selection;
    linked.interaction += f * periods[i].attribution.interaction;
    linked.currency += f * periods[i].attribution.currency;
  }
  linked.total = linked.allocation + linked.selection + linked.interaction + linked.currency;

  return {
    periods: periods.map(p => ({ start: p.start, end: p.end, attribution: p.attribution })),
    linkedAttribution: linked,
    linkingMethod: 'carino',
  };
}

// Menchero linking method
export function mencheroLinking(periods: PeriodAttribution[]): MultiPeriodAttribution {
  const n = periods.length;
  const cumPort = new Array(n);
  const cumBm = new Array(n);
  cumPort[0] = 1 + periods[0].portfolioReturn;
  cumBm[0] = 1 + periods[0].benchmarkReturn;
  for (let i = 1; i < n; i++) {
    cumPort[i] = cumPort[i - 1] * (1 + periods[i].portfolioReturn);
    cumBm[i] = cumBm[i - 1] * (1 + periods[i].benchmarkReturn);
  }

  const totalPort = cumPort[n - 1] - 1;
  const totalBm = cumBm[n - 1] - 1;

  const linked: Attribution = { allocation: 0, selection: 0, interaction: 0, currency: 0, total: 0 };

  for (let i = 0; i < n; i++) {
    const priorCumPort = i > 0 ? cumPort[i - 1] : 1;
    const priorCumBm = i > 0 ? cumBm[i - 1] : 1;

    const adjustmentFactor = priorCumBm;

    let scalingNumerator = 0;
    for (let j = i + 1; j < n; j++) {
      const futurePort = cumPort[j] / cumPort[i];
      const futureBm = cumBm[j] / cumBm[i];
      scalingNumerator += (futurePort + futureBm) / 2;
    }
    const scaleFactor = i < n - 1 ? (1 + scalingNumerator / (n - i - 1)) : 1;
    const f = adjustmentFactor * scaleFactor;

    linked.allocation += f * periods[i].attribution.allocation;
    linked.selection += f * periods[i].attribution.selection;
    linked.interaction += f * periods[i].attribution.interaction;
    linked.currency += f * periods[i].attribution.currency;
  }

  // Normalize so total matches actual excess
  const rawTotal = linked.allocation + linked.selection + linked.interaction + linked.currency;
  const actualExcess = totalPort - totalBm;

  if (Math.abs(rawTotal) > 1e-12) {
    const scale = actualExcess / rawTotal;
    linked.allocation *= scale;
    linked.selection *= scale;
    linked.interaction *= scale;
    linked.currency *= scale;
  }
  linked.total = linked.allocation + linked.selection + linked.interaction + linked.currency;

  return {
    periods: periods.map(p => ({ start: p.start, end: p.end, attribution: p.attribution })),
    linkedAttribution: linked,
    linkingMethod: 'menchero',
  };
}

// GRAP (Geometric Return Attribution Program) linking
export function grapLinking(periods: PeriodAttribution[]): MultiPeriodAttribution {
  const n = periods.length;

  const cumBm = new Array(n);
  cumBm[0] = 1 + periods[0].benchmarkReturn;
  for (let i = 1; i < n; i++) {
    cumBm[i] = cumBm[i - 1] * (1 + periods[i].benchmarkReturn);
  }

  const totalPort = periods.reduce((p, pd) => p * (1 + pd.portfolioReturn), 1) - 1;
  const totalBm = cumBm[n - 1] - 1;

  const linked: Attribution = { allocation: 0, selection: 0, interaction: 0, currency: 0, total: 0 };

  for (let i = 0; i < n; i++) {
    const compoundBm = i < n - 1
      ? cumBm[n - 1] / cumBm[i]
      : 1;

    linked.allocation += periods[i].attribution.allocation * compoundBm;
    linked.selection += periods[i].attribution.selection * compoundBm;
    linked.interaction += periods[i].attribution.interaction * compoundBm;
    linked.currency += periods[i].attribution.currency * compoundBm;
  }

  linked.total = linked.allocation + linked.selection + linked.interaction + linked.currency;

  return {
    periods: periods.map(p => ({ start: p.start, end: p.end, attribution: p.attribution })),
    linkedAttribution: linked,
    linkingMethod: 'grap',
  };
}

// ─── Transaction Cost Attribution ───────────────────────────────────────────

export interface TransactionCostInput {
  trades: {
    symbol: string;
    side: 'buy' | 'sell';
    shares: number;
    executionPrice: number;
    arrivalPrice: number;
    benchmarkVWAP: number;
    commission: number;
    marketImpact: number;
  }[];
}

export function transactionCostAttribution(input: TransactionCostInput): {
  totalSlippage: number;
  commissions: number;
  marketImpact: number;
  timing: number;
  implementationShortfall: number;
  perTrade: {
    symbol: string;
    slippage: number;
    commission: number;
    impact: number;
    timing: number;
    total: number;
  }[];
} {
  const perTrade = input.trades.map(trade => {
    const notional = trade.shares * trade.arrivalPrice;
    const direction = trade.side === 'buy' ? 1 : -1;

    const slippage = direction * (trade.executionPrice - trade.arrivalPrice) * trade.shares;
    const timing = direction * (trade.arrivalPrice - trade.benchmarkVWAP) * trade.shares;
    const impact = trade.marketImpact * trade.shares;

    return {
      symbol: trade.symbol,
      slippage,
      commission: trade.commission,
      impact,
      timing,
      total: slippage + trade.commission + impact,
    };
  });

  return {
    totalSlippage: perTrade.reduce((s, t) => s + t.slippage, 0),
    commissions: perTrade.reduce((s, t) => s + t.commission, 0),
    marketImpact: perTrade.reduce((s, t) => s + t.impact, 0),
    timing: perTrade.reduce((s, t) => s + t.timing, 0),
    implementationShortfall: perTrade.reduce((s, t) => s + t.total, 0),
    perTrade,
  };
}

// ─── Alpha Decomposition ────────────────────────────────────────────────────

export function alphaDecomposition(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  numBootstrap = 5000
): {
  observedAlpha: number;
  tStat: number;
  pValue: number;
  bootstrapMean: number;
  bootstrapStdErr: number;
  isSkillful: boolean;
} {
  const excess = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  const observedAlpha = mean(excess) * 252;
  const se = Math.sqrt(variance(excess) / excess.length) * Math.sqrt(252);
  const tStat = se > 0 ? observedAlpha / se : 0;

  // Bootstrap under null (alpha = 0)
  const centered = excess.map(e => e - mean(excess));
  const bootstrapAlphas: number[] = [];

  for (let b = 0; b < numBootstrap; b++) {
    const sample: number[] = [];
    for (let i = 0; i < centered.length; i++) {
      const idx = Math.floor(Math.random() * centered.length);
      sample.push(centered[idx]);
    }
    bootstrapAlphas.push(mean(sample) * 252);
  }

  bootstrapAlphas.sort((a, b) => a - b);
  const bootstrapMean = mean(bootstrapAlphas);
  const bootstrapStdErr = Math.sqrt(variance(bootstrapAlphas));

  const exceedCount = bootstrapAlphas.filter(a =>
    Math.abs(a) >= Math.abs(observedAlpha)
  ).length;
  const pValue = exceedCount / numBootstrap;

  return {
    observedAlpha,
    tStat,
    pValue,
    bootstrapMean,
    bootstrapStdErr,
    isSkillful: pValue < 0.05,
  };
}

// ─── Sector Attribution ─────────────────────────────────────────────────────

export function sectorAttribution(
  portfolioSectorWeights: Record<string, number>,
  benchmarkSectorWeights: Record<string, number>,
  portfolioSectorReturns: Record<string, number>,
  benchmarkSectorReturns: Record<string, number>
): SectorAttribution[] {
  const allSectors = new Set([
    ...Object.keys(portfolioSectorWeights),
    ...Object.keys(benchmarkSectorWeights),
  ]);

  const totalBmReturn = Object.entries(benchmarkSectorWeights).reduce(
    (s, [sector, w]) => s + w * (benchmarkSectorReturns[sector] ?? 0), 0
  );

  return Array.from(allSectors).map(sector => {
    const wp = portfolioSectorWeights[sector] ?? 0;
    const wb = benchmarkSectorWeights[sector] ?? 0;
    const rp = portfolioSectorReturns[sector] ?? 0;
    const rb = benchmarkSectorReturns[sector] ?? 0;

    const allocation = (wp - wb) * (rb - totalBmReturn);
    const selection = wb * (rp - rb);
    const interaction = (wp - wb) * (rp - rb);

    return {
      sector,
      portfolioWeight: wp,
      benchmarkWeight: wb,
      portfolioReturn: rp,
      benchmarkReturn: rb,
      allocation,
      selection,
      interaction,
      total: allocation + selection + interaction,
    };
  });
}

// ─── Style Attribution ──────────────────────────────────────────────────────

export interface StyleAttributionResult {
  growth: number;
  value: number;
  size: number;
  momentum: number;
  quality: number;
  total: number;
}

export function styleAttribution(
  portfolioReturns: number[],
  styleFactors: {
    growth: number[];
    value: number[];
    size: number[];
    momentum: number[];
    quality: number[];
  }
): StyleAttributionResult {
  const nObs = portfolioReturns.length;
  const factorNames = ['growth', 'value', 'size', 'momentum', 'quality'] as const;
  const factorData = factorNames.map(name => styleFactors[name]);

  const factorReturns = Array.from({ length: nObs }, (_, t) =>
    factorData.map(f => f[t])
  );

  const result = factorAttribution({
    assetReturns: portfolioReturns,
    factorReturns,
    factorNames: [...factorNames],
  });

  const contributions: Record<string, number> = {};
  for (const f of result.factors) {
    contributions[f.factorName] = f.contribution;
  }

  return {
    growth: contributions['growth'] ?? 0,
    value: contributions['value'] ?? 0,
    size: contributions['size'] ?? 0,
    momentum: contributions['momentum'] ?? 0,
    quality: contributions['quality'] ?? 0,
    total: Object.values(contributions).reduce((s, v) => s + v, 0),
  };
}

// ─── Country/Region Attribution ─────────────────────────────────────────────

export function regionAttribution(
  portfolioRegionWeights: Record<string, number>,
  benchmarkRegionWeights: Record<string, number>,
  portfolioRegionReturns: Record<string, number>,
  benchmarkRegionReturns: Record<string, number>
): SectorAttribution[] {
  // Reuses same math as sector attribution
  return sectorAttribution(
    portfolioRegionWeights,
    benchmarkRegionWeights,
    portfolioRegionReturns,
    benchmarkRegionReturns
  );
}
