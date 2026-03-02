import type {
  CryptoAsset, ExchangePrice, ArbitrageOpportunity, FundingRate,
  OpenInterestData, LiquidationLevel, OnChainMetrics, MVRVData,
  NVTData, StockToFlowData, ExchangeFlowData, StablecoinMetrics,
  DeFiProtocol, GasFeeEstimate, FearGreedComponents,
  TokenCorrelation, MarketDominance,
} from './types';
import { FundingRateDirection } from './types';

// ── Multi-exchange price aggregation ──────────────────────────────────
export function aggregateExchangePrices(
  quotes: ExchangePrice[],
): { vwap: number; median: number; spread: number; outliers: ExchangePrice[] } {
  if (quotes.length === 0) return { vwap: 0, median: 0, spread: 0, outliers: [] };

  let totalVolume = 0, weightedSum = 0;
  for (const q of quotes) {
    const mid = (q.bid + q.ask) / 2;
    weightedSum += mid * q.volume24h;
    totalVolume += q.volume24h;
  }
  const vwap = totalVolume > 0 ? weightedSum / totalVolume : 0;

  const mids = quotes.map(q => (q.bid + q.ask) / 2).sort((a, b) => a - b);
  const n = mids.length;
  const median = n % 2 !== 0 ? mids[Math.floor(n / 2)] : (mids[n / 2 - 1] + mids[n / 2]) / 2;

  const spread = mids[n - 1] - mids[0];

  // Outlier detection: > 2 standard deviations from VWAP
  const mean = mids.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(mids.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const outliers = quotes.filter(q => {
    const mid = (q.bid + q.ask) / 2;
    return Math.abs(mid - mean) > 2 * std;
  });

  return { vwap, median, spread, outliers };
}

// ── Exchange arbitrage detection ──────────────────────────────────────
export function detectExchangeArbitrage(
  quotes: ExchangePrice[],
  transferFees: Record<string, number>,
  transferTimes: Record<string, number>,
  minProfitPercent = 0.1,
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (let i = 0; i < quotes.length; i++) {
    for (let j = i + 1; j < quotes.length; j++) {
      const a = quotes[i], b = quotes[j];
      if (a.symbol !== b.symbol) continue;

      // Check a→b and b→a
      const directions: [ExchangePrice, ExchangePrice][] = [[a, b], [b, a]];
      for (const [buy, sell] of directions) {
        if (buy.ask >= sell.bid) continue;

        const spreadPercent = (sell.bid - buy.ask) / buy.ask * 100;
        const fee = (transferFees[buy.exchange] ?? 0) + (transferFees[sell.exchange] ?? 0);
        const estimatedProfit = sell.bid - buy.ask;
        const netProfit = estimatedProfit - fee;
        const netProfitPercent = netProfit / buy.ask * 100;

        if (netProfitPercent >= minProfitPercent) {
          opportunities.push({
            symbol: a.symbol,
            buyExchange: buy.exchange,
            sellExchange: sell.exchange,
            buyPrice: buy.ask,
            sellPrice: sell.bid,
            spreadPercent,
            estimatedProfit,
            transferTime: transferTimes[buy.exchange] ?? 30,
            transferFee: fee,
            netProfit,
          });
        }
      }
    }
  }

  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}

// ── Funding rate analysis ─────────────────────────────────────────────
export function analyzeFundingRates(
  rates: FundingRate[],
): {
  averageRate: number;
  annualizedYield: number;
  extremes: FundingRate[];
  arbitrageOpportunities: { longExchange: string; shortExchange: string; netRate: number }[];
} {
  if (rates.length === 0) return { averageRate: 0, annualizedYield: 0, extremes: [], arbitrageOpportunities: [] };

  const avgRate = rates.reduce((s, r) => s + r.rate, 0) / rates.length;
  // 3 funding periods per day (8h each), 365 days
  const annualizedYield = avgRate * 3 * 365;

  const mean = avgRate;
  const std = Math.sqrt(rates.reduce((s, r) => s + (r.rate - mean) ** 2, 0) / rates.length);
  const extremes = rates.filter(r => Math.abs(r.rate - mean) > 2 * std);

  // Funding rate arbitrage: long where rate is negative, short where positive
  const arbitrageOpportunities: { longExchange: string; shortExchange: string; netRate: number }[] = [];
  for (let i = 0; i < rates.length; i++) {
    for (let j = i + 1; j < rates.length; j++) {
      if (rates[i].symbol !== rates[j].symbol) continue;
      const netRate = Math.abs(rates[i].rate - rates[j].rate);
      if (netRate > 0.01) { // > 1% per period
        const [longExch, shortExch] = rates[i].rate < rates[j].rate
          ? [rates[i].exchange, rates[j].exchange]
          : [rates[j].exchange, rates[i].exchange];
        arbitrageOpportunities.push({ longExchange: longExch, shortExchange: shortExch, netRate });
      }
    }
  }

  return { averageRate: avgRate, annualizedYield, extremes, arbitrageOpportunities };
}

// ── Open interest analysis ────────────────────────────────────────────
export function analyzeOpenInterest(
  data: OpenInterestData[],
  priceChanges: number[],
): {
  totalOI: number;
  oiWeightedByExchange: Record<string, number>;
  oiPriceCorrelation: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
} {
  const totalOI = data.reduce((s, d) => s + d.openInterestUSD, 0);
  const oiWeightedByExchange: Record<string, number> = {};
  for (const d of data) {
    oiWeightedByExchange[d.exchange] = (oiWeightedByExchange[d.exchange] ?? 0) + d.openInterestUSD;
  }

  // Correlation between OI changes and price changes
  const oiChanges = data.map(d => d.changePercent24h);
  const n = Math.min(oiChanges.length, priceChanges.length);
  let cov = 0, var1 = 0, var2 = 0;
  const m1 = oiChanges.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const m2 = priceChanges.slice(0, n).reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const d1 = oiChanges[i] - m1, d2 = priceChanges[i] - m2;
    cov += d1 * d2; var1 += d1 * d1; var2 += d2 * d2;
  }
  const denom = Math.sqrt(var1 * var2);
  const oiPriceCorrelation = denom > 0 ? cov / denom : 0;

  const avgChange = data.reduce((s, d) => s + d.changePercent24h, 0) / data.length;
  const trend = avgChange > 5 ? 'INCREASING' : avgChange < -5 ? 'DECREASING' : 'STABLE';

  return { totalOI, oiWeightedByExchange, oiPriceCorrelation, trend };
}

// ── Liquidation level estimation ──────────────────────────────────────
export function estimateLiquidationLevels(
  currentPrice: number,
  leverageLevels: number[],
  longOIDistribution: Record<number, number>,  // leverage → OI
  shortOIDistribution: Record<number, number>,
): LiquidationLevel[] {
  const levels: LiquidationLevel[] = [];

  for (const leverage of leverageLevels) {
    // Longs liquidated when price drops by 1/leverage (minus maintenance margin ~50% of initial)
    const longLiqPrice = currentPrice * (1 - 0.8 / leverage);
    const longSize = longOIDistribution[leverage] ?? 0;

    // Shorts liquidated when price rises by 1/leverage
    const shortLiqPrice = currentPrice * (1 + 0.8 / leverage);
    const shortSize = shortOIDistribution[leverage] ?? 0;

    if (longSize > 0) {
      levels.push({
        price: longLiqPrice,
        side: 'LONG',
        estimatedSize: longSize,
        leverage,
        cumulativeAbove: 0,
        cumulativeBelow: 0,
      });
    }
    if (shortSize > 0) {
      levels.push({
        price: shortLiqPrice,
        side: 'SHORT',
        estimatedSize: shortSize,
        leverage,
        cumulativeAbove: 0,
        cumulativeBelow: 0,
      });
    }
  }

  levels.sort((a, b) => a.price - b.price);

  // Compute cumulative sizes
  let cumBelow = 0;
  for (const l of levels) {
    cumBelow += l.estimatedSize;
    l.cumulativeBelow = cumBelow;
  }
  let cumAbove = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    cumAbove += levels[i].estimatedSize;
    levels[i].cumulativeAbove = cumAbove;
  }

  return levels;
}

// ── MVRV ratio ────────────────────────────────────────────────────────
export function calculateMVRV(
  marketCap: number,
  realizedCap: number,
  historicalMVRV: number[],
): MVRVData {
  const mvrvRatio = realizedCap > 0 ? marketCap / realizedCap : 0;

  const n = historicalMVRV.length;
  const mean = n > 0 ? historicalMVRV.reduce((s, v) => s + v, 0) / n : 1;
  const std = n > 1 ? Math.sqrt(historicalMVRV.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const zScore = std > 0 ? (mvrvRatio - mean) / std : 0;

  let signal: 'OVERVALUED' | 'FAIR' | 'UNDERVALUED';
  if (mvrvRatio > 3.5 || zScore > 2) signal = 'OVERVALUED';
  else if (mvrvRatio < 1 || zScore < -1) signal = 'UNDERVALUED';
  else signal = 'FAIR';

  return { marketCap, realizedCap, mvrvRatio, zScore, signal };
}

// ── NVT ratio ─────────────────────────────────────────────────────────
export function calculateNVT(
  networkValue: number,
  transactionVolume: number,
  historicalNVT: number[],
  smoothingPeriod = 90,
): NVTData {
  const nvtRatio = transactionVolume > 0 ? networkValue / transactionVolume : 0;

  // NVT Signal: smoothed version
  const recent = historicalNVT.slice(-smoothingPeriod);
  const nvtSignal = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : nvtRatio;

  let interpretation: 'HIGH_VALUE' | 'FAIR' | 'LOW_VALUE';
  if (nvtRatio > 150) interpretation = 'HIGH_VALUE';
  else if (nvtRatio < 40) interpretation = 'LOW_VALUE';
  else interpretation = 'FAIR';

  return { networkValue, transactionVolume, nvtRatio, nvtSignal, interpretation };
}

// ── Stock-to-Flow model ───────────────────────────────────────────────
export function calculateStockToFlow(
  currentStock: number,
  annualFlow: number,
  currentPrice: number,
): StockToFlowData {
  const sfRatio = annualFlow > 0 ? currentStock / annualFlow : Infinity;
  // S2F model: price = e^(a * ln(SF) + b), typical BTC coefficients
  const modelPrice = Math.exp(3.21956 * Math.log(sfRatio) + 14.6227);
  const deviation = currentPrice > 0 ? (currentPrice - modelPrice) / modelPrice : 0;

  return { currentStock, annualFlow, sfRatio, modelPrice, actualPrice: currentPrice, deviation };
}

// ── Puell Multiple ────────────────────────────────────────────────────
export function calculatePuellMultiple(
  dailyIssuanceUSD: number,
  ma365Issuance: number,
): { puellMultiple: number; signal: 'BUY_ZONE' | 'NEUTRAL' | 'SELL_ZONE' } {
  const puellMultiple = ma365Issuance > 0 ? dailyIssuanceUSD / ma365Issuance : 0;
  let signal: 'BUY_ZONE' | 'NEUTRAL' | 'SELL_ZONE';
  if (puellMultiple < 0.5) signal = 'BUY_ZONE';
  else if (puellMultiple > 4) signal = 'SELL_ZONE';
  else signal = 'NEUTRAL';
  return { puellMultiple, signal };
}

// ── SOPR (Spent Output Profit Ratio) ──────────────────────────────────
export function calculateSOPR(
  realizedValues: number[],
  creationValues: number[],
): { sopr: number; adjustedSOPR: number; signal: 'PROFIT_TAKING' | 'CAPITULATION' | 'NEUTRAL' } {
  const n = Math.min(realizedValues.length, creationValues.length);
  let totalRealized = 0, totalCreation = 0;

  for (let i = 0; i < n; i++) {
    totalRealized += realizedValues[i];
    totalCreation += creationValues[i];
  }

  const sopr = totalCreation > 0 ? totalRealized / totalCreation : 1;
  // Adjusted SOPR: exclude outputs with no gain/loss (sopr ≈ 1)
  let adjRealized = 0, adjCreation = 0;
  for (let i = 0; i < n; i++) {
    const ratio = creationValues[i] > 0 ? realizedValues[i] / creationValues[i] : 1;
    if (Math.abs(ratio - 1) > 0.001) {
      adjRealized += realizedValues[i];
      adjCreation += creationValues[i];
    }
  }
  const adjustedSOPR = adjCreation > 0 ? adjRealized / adjCreation : 1;

  let signal: 'PROFIT_TAKING' | 'CAPITULATION' | 'NEUTRAL';
  if (sopr > 1.05) signal = 'PROFIT_TAKING';
  else if (sopr < 0.95) signal = 'CAPITULATION';
  else signal = 'NEUTRAL';

  return { sopr, adjustedSOPR, signal };
}

// ── Exchange inflow/outflow analysis ──────────────────────────────────
export function analyzeExchangeFlows(
  flows: ExchangeFlowData[],
): {
  totalNetFlow: number;
  netFlowTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  largestInflow: ExchangeFlowData | null;
  largestOutflow: ExchangeFlowData | null;
} {
  if (flows.length === 0) return { totalNetFlow: 0, netFlowTrend: 'NEUTRAL', largestInflow: null, largestOutflow: null };

  const totalNetFlow = flows.reduce((s, f) => s + f.netFlow, 0);

  let largestInflow: ExchangeFlowData | null = null;
  let largestOutflow: ExchangeFlowData | null = null;
  for (const f of flows) {
    if (!largestInflow || f.inflow24h > largestInflow.inflow24h) largestInflow = f;
    if (!largestOutflow || f.outflow24h > largestOutflow.outflow24h) largestOutflow = f;
  }

  // Net outflow (negative) = accumulation (bullish); net inflow (positive) = distribution (bearish)
  const netFlowTrend = totalNetFlow < -0.01 * flows.reduce((s, f) => s + f.reserveBalance, 0)
    ? 'ACCUMULATION'
    : totalNetFlow > 0.01 * flows.reduce((s, f) => s + f.reserveBalance, 0)
      ? 'DISTRIBUTION'
      : 'NEUTRAL';

  return { totalNetFlow, netFlowTrend, largestInflow, largestOutflow };
}

// ── Stablecoin supply analysis ────────────────────────────────────────
export function analyzeStablecoinSupply(
  stablecoins: StablecoinMetrics[],
): {
  totalMarketCap: number;
  dominanceByToken: Record<string, number>;
  pegDeviations: { symbol: string; deviation: number }[];
  supplyTrend: 'EXPANDING' | 'CONTRACTING' | 'STABLE';
} {
  const totalMarketCap = stablecoins.reduce((s, sc) => s + sc.marketCap, 0);
  const dominanceByToken: Record<string, number> = {};
  for (const sc of stablecoins) {
    dominanceByToken[sc.symbol] = totalMarketCap > 0 ? sc.marketCap / totalMarketCap : 0;
  }

  const pegDeviations = stablecoins
    .filter(sc => Math.abs(sc.deviation) > 0.001)
    .map(sc => ({ symbol: sc.symbol, deviation: sc.deviation }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  const avgSupplyChange = stablecoins.reduce((s, sc) => s + sc.supplyChange30d, 0) / stablecoins.length;
  const supplyTrend = avgSupplyChange > 2 ? 'EXPANDING' : avgSupplyChange < -2 ? 'CONTRACTING' : 'STABLE';

  return { totalMarketCap, dominanceByToken, pegDeviations, supplyTrend };
}

// ── DeFi TVL tracking ─────────────────────────────────────────────────
export function analyzeDeFiTVL(
  protocols: DeFiProtocol[],
): {
  totalTVL: number;
  tvlByChain: Record<string, number>;
  topProtocols: DeFiProtocol[];
  avgMcapToTvl: number;
  revenueYield: number;
} {
  const totalTVL = protocols.reduce((s, p) => s + p.tvl, 0);

  const tvlByChain: Record<string, number> = {};
  for (const p of protocols) {
    tvlByChain[p.chain] = (tvlByChain[p.chain] ?? 0) + p.tvl;
  }

  const topProtocols = [...protocols].sort((a, b) => b.tvl - a.tvl).slice(0, 10);

  const withMcap = protocols.filter(p => p.mcapToTvl !== undefined && p.mcapToTvl! > 0);
  const avgMcapToTvl = withMcap.length > 0
    ? withMcap.reduce((s, p) => s + p.mcapToTvl!, 0) / withMcap.length
    : 0;

  const totalRevenue = protocols.reduce((s, p) => s + p.revenue24h, 0) * 365;
  const revenueYield = totalTVL > 0 ? totalRevenue / totalTVL : 0;

  return { totalTVL, tvlByChain, topProtocols, avgMcapToTvl, revenueYield };
}

// ── Yield farming APY calculation ─────────────────────────────────────
export function calculateYieldFarmingAPY(
  baseAPR: number,
  compoundingFrequency: number,     // times per year
  rewardTokenAPR: number,
  rewardTokenPriceChange = 0,       // expected % change
): { baseAPY: number; rewardAPY: number; totalAPY: number; dailyROI: number } {
  // APY = (1 + APR/n)^n - 1
  const baseAPY = Math.pow(1 + baseAPR / compoundingFrequency, compoundingFrequency) - 1;
  const adjustedRewardAPR = rewardTokenAPR * (1 + rewardTokenPriceChange);
  const rewardAPY = Math.pow(1 + adjustedRewardAPR / compoundingFrequency, compoundingFrequency) - 1;
  const totalAPY = baseAPY + rewardAPY;
  const dailyROI = Math.pow(1 + totalAPY, 1 / 365) - 1;

  return { baseAPY, rewardAPY, totalAPY, dailyROI };
}

// ── Impermanent loss calculation ──────────────────────────────────────
export function calculateImpermanentLoss(
  priceRatioChange: number,
): { impermanentLoss: number; holdValue: number; lpValue: number } {
  // IL = 2√r / (1+r) - 1 where r is the price ratio change
  const r = 1 + priceRatioChange;
  const sqrtR = Math.sqrt(Math.abs(r));
  const lpValue = 2 * sqrtR / (1 + r);
  const holdValue = 1;
  const impermanentLoss = lpValue - holdValue;

  return { impermanentLoss, holdValue, lpValue };
}

// ── Gas fee estimation ────────────────────────────────────────────────
export function estimateGasFees(
  recentBaseFees: number[],
  recentPriorityFees: number[],
): GasFeeEstimate {
  const n = recentBaseFees.length;
  if (n === 0) {
    const zero = { gwei: 0, time: 0 };
    return { chain: 'ETHEREUM' as any, slow: zero, standard: zero, fast: zero, baseFee: 0, priorityFee: 0 };
  }

  const sortedBase = [...recentBaseFees].sort((a, b) => a - b);
  const sortedPriority = [...recentPriorityFees].sort((a, b) => a - b);

  const baseFee = sortedBase[Math.floor(n * 0.5)];
  const priorityFee = sortedPriority[Math.floor(n * 0.5)];

  return {
    chain: 'ETHEREUM' as any,
    slow: {
      gwei: baseFee + sortedPriority[Math.floor(n * 0.1)],
      time: 300,
    },
    standard: {
      gwei: baseFee + priorityFee,
      time: 60,
    },
    fast: {
      gwei: baseFee + sortedPriority[Math.floor(n * 0.9)],
      time: 15,
    },
    baseFee,
    priorityFee,
  };
}

// ── Token correlation matrix ──────────────────────────────────────────
export function calculateTokenCorrelations(
  tokenReturns: Record<string, number[]>,
  period?: number,
): TokenCorrelation[] {
  const tokens = Object.keys(tokenReturns);
  const correlations: TokenCorrelation[] = [];

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      let r1 = tokenReturns[tokens[i]];
      let r2 = tokenReturns[tokens[j]];
      const len = Math.min(r1.length, r2.length);
      const p = period ? Math.min(period, len) : len;
      r1 = r1.slice(-p);
      r2 = r2.slice(-p);

      const m1 = r1.reduce((s, v) => s + v, 0) / p;
      const m2 = r2.reduce((s, v) => s + v, 0) / p;
      let cov = 0, v1 = 0, v2 = 0;
      for (let k = 0; k < p; k++) {
        const d1 = r1[k] - m1, d2 = r2[k] - m2;
        cov += d1 * d2; v1 += d1 * d1; v2 += d2 * d2;
      }
      const denom = Math.sqrt(v1 * v2);
      const correlation = denom > 0 ? cov / denom : 0;

      // Beta = cov(token, benchmark) / var(benchmark) — treat first token as benchmark proxy
      const beta = v2 > 0 ? cov / v2 : 0;

      correlations.push({
        token1: tokens[i],
        token2: tokens[j],
        correlation,
        period: p,
        beta,
      });
    }
  }

  return correlations;
}

// ── Market dominance metrics ──────────────────────────────────────────
export function calculateMarketDominance(
  assets: CryptoAsset[],
  previous24h: Record<string, number>,
  previous7d: Record<string, number>,
): MarketDominance[] {
  const totalMarketCap = assets.reduce((s, a) => s + a.marketCap, 0);
  if (totalMarketCap === 0) return [];

  return assets.map(a => {
    const dominance = a.marketCap / totalMarketCap;
    const prev24 = previous24h[a.symbol] ?? dominance;
    const prev7 = previous7d[a.symbol] ?? dominance;
    return {
      symbol: a.symbol,
      dominance,
      change24h: dominance - prev24,
      change7d: dominance - prev7,
    };
  }).sort((a, b) => b.dominance - a.dominance);
}

// ── Fear and Greed index ──────────────────────────────────────────────
export function calculateFearGreedIndex(
  volatilityScore: number,     // 0–100, higher = more fear
  momentumScore: number,       // 0–100, higher = more greed
  socialScore: number,         // 0–100
  dominanceScore: number,      // 0–100 (BTC dominance as fear proxy)
  trendsScore: number,         // 0–100 (search volume)
): FearGreedComponents {
  // Weighted average matching popular crypto F&G methodology
  const weights = { volatility: 0.25, momentum: 0.25, social: 0.15, dominance: 0.10, trends: 0.25 };

  const overall =
    (100 - volatilityScore) * weights.volatility +   // invert: high vol = fear
    momentumScore * weights.momentum +
    socialScore * weights.social +
    (100 - dominanceScore) * weights.dominance +      // high BTC dom = fear
    trendsScore * weights.trends;

  const clamped = Math.max(0, Math.min(100, overall));

  let label: FearGreedComponents['label'];
  if (clamped <= 20) label = 'EXTREME_FEAR';
  else if (clamped <= 40) label = 'FEAR';
  else if (clamped <= 60) label = 'NEUTRAL';
  else if (clamped <= 80) label = 'GREED';
  else label = 'EXTREME_GREED';

  return {
    volatility: volatilityScore,
    momentum: momentumScore,
    socialMedia: socialScore,
    dominance: dominanceScore,
    trends: trendsScore,
    overall: clamped,
    label,
  };
}
