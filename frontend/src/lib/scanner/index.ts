/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Market Scanner / Screener Library                  │
 * │  Real-time screening engine with 60+ filters, ranked results,       │
 * │  custom scan presets, and sector/industry analysis                   │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in' | 'not_in' | 'contains' | 'crosses_above' | 'crosses_below';
export type FilterCategory = 'price' | 'volume' | 'technical' | 'fundamental' | 'volatility' | 'sentiment' | 'options' | 'flow' | 'sector';
export type SortDirection = 'asc' | 'desc';
export type ScanFrequency = 'realtime' | '1s' | '5s' | '15s' | '1m' | '5m' | '15m' | '1h' | 'daily';

export interface FilterCondition {
  id: string;
  field: string;
  category: FilterCategory;
  operator: FilterOperator;
  value: number | string | number[] | string[];
  label: string;
  enabled: boolean;
}

export interface ScanPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  filters: FilterCondition[];
  sortBy: string;
  sortDir: SortDirection;
  limit: number;
  icon?: string;
}

export interface ScanResult {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  matchScore: number;       // 0-100
  matchedFilters: string[];
  data: Record<string, number | string>;
  alerts: ScanAlert[];
  rank: number;
  timestamp: number;
}

export interface ScanAlert {
  type: 'breakout' | 'breakdown' | 'volume_spike' | 'unusual_options' | 'earnings' | 'gap' | 'squeeze' | 'divergence';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
}

export interface ScanSession {
  id: string;
  preset: ScanPreset;
  startedAt: number;
  lastScanAt: number;
  scanCount: number;
  results: ScanResult[];
  history: ScanResult[][];
  frequency: ScanFrequency;
  running: boolean;
}

export interface MarketOverview {
  totalSymbols: number;
  advancing: number;
  declining: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  aboveMA200: number;
  belowMA200: number;
  avgVolRatio: number;
  sectorPerformance: { sector: string; pctChange: number; breadth: number }[];
  topGainers: ScanResult[];
  topLosers: ScanResult[];
  mostActive: ScanResult[];
  unusualVolume: ScanResult[];
}


// ═══════════════════════════════════════════════════════════════════════
// MOCK STOCK UNIVERSE
// ═══════════════════════════════════════════════════════════════════════

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number;
  eps: number;
  dividend: number;
  beta: number;
  high52w: number;
  low52w: number;
  rsi14: number;
  sma20: number;
  sma50: number;
  sma200: number;
  atr14: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbLower: number;
  obv: number;
  adx: number;
  stochK: number;
  stochD: number;
  vwap: number;
  relVolume: number;
  shortFloat: number;
  institutionalOwn: number;
  insiderOwn: number;
  earningsDate: number;
  ivRank: number;
  putCallRatio: number;
  unusualOptionsScore: number;
  gapPct: number;
  preMarketChange: number;
  afterHoursChange: number;
  avgSpreadBps: number;
  floatShares: number;
  revenue: number;
  revenueGrowth: number;
  netIncome: number;
  debtToEquity: number;
  currentRatio: number;
  roe: number;
  freeCashFlow: number;
}

function generateDemoUniverse(seed = 42): StockData[] {
  let s = seed;
  const rand = (): number => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gauss = (): number => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());

  const stocks: { symbol: string; name: string; sector: string; industry: string; basePrice: number; baseCap: number }[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', basePrice: 185, baseCap: 2900e9 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', industry: 'Software', basePrice: 420, baseCap: 3100e9 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', basePrice: 172, baseCap: 2100e9 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'E-Commerce', basePrice: 185, baseCap: 1900e9 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', industry: 'Semiconductors', basePrice: 875, baseCap: 2150e9 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology', industry: 'Social Media', basePrice: 505, baseCap: 1300e9 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', basePrice: 245, baseCap: 780e9 },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial', industry: 'Insurance', basePrice: 410, baseCap: 880e9 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial', industry: 'Banks', basePrice: 195, baseCap: 560e9 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial', industry: 'Payment Services', basePrice: 280, baseCap: 570e9 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals', basePrice: 158, baseCap: 380e9 },
    { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Retail', basePrice: 165, baseCap: 440e9 },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Defensive', industry: 'Consumer Products', basePrice: 162, baseCap: 380e9 },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', industry: 'Oil & Gas', basePrice: 105, baseCap: 430e9 },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Health Insurance', basePrice: 525, baseCap: 490e9 },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Cyclical', industry: 'Home Improvement', basePrice: 370, baseCap: 365e9 },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial', industry: 'Payment Services', basePrice: 460, baseCap: 420e9 },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Financial', industry: 'Banks', basePrice: 35, baseCap: 270e9 },
    { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Biotech', basePrice: 170, baseCap: 300e9 },
    { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals', basePrice: 28, baseCap: 158e9 },
    { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', industry: 'Software', basePrice: 295, baseCap: 285e9 },
    { symbol: 'AMD', name: 'AMD Inc.', sector: 'Technology', industry: 'Semiconductors', basePrice: 155, baseCap: 250e9 },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication', industry: 'Streaming', basePrice: 620, baseCap: 270e9 },
    { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication', industry: 'Entertainment', basePrice: 112, baseCap: 205e9 },
    { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology', industry: 'Semiconductors', basePrice: 31, baseCap: 130e9 },
    { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Technology', industry: 'Networking', basePrice: 50, baseCap: 200e9 },
    { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas', basePrice: 115, baseCap: 135e9 },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financial', industry: 'Investment Banking', basePrice: 450, baseCap: 145e9 },
    { symbol: 'LLY', name: 'Eli Lilly & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals', basePrice: 780, baseCap: 740e9 },
    { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors', basePrice: 1300, baseCap: 600e9 },
    { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication', industry: 'Telecom', basePrice: 17, baseCap: 120e9 },
    { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial', industry: 'Machinery', basePrice: 330, baseCap: 160e9 },
    { symbol: 'DE', name: 'Deere & Co.', sector: 'Industrial', industry: 'Farm Equipment', basePrice: 400, baseCap: 115e9 },
    { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrial', industry: 'Aerospace', basePrice: 210, baseCap: 130e9 },
    { symbol: 'GE', name: 'General Electric', sector: 'Industrial', industry: 'Conglomerate', basePrice: 160, baseCap: 175e9 },
    { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals', basePrice: 125, baseCap: 315e9 },
    { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Defensive', industry: 'Beverages', basePrice: 60, baseCap: 260e9 },
    { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Defensive', industry: 'Beverages', basePrice: 170, baseCap: 233e9 },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Defensive', industry: 'Retail', basePrice: 720, baseCap: 320e9 },
    { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Cyclical', industry: 'Footwear', basePrice: 95, baseCap: 140e9 },
    { symbol: 'SQ', name: 'Block Inc.', sector: 'Financial', industry: 'Fintech', basePrice: 78, baseCap: 47e9 },
    { symbol: 'PYPL', name: 'PayPal Holdings', sector: 'Financial', industry: 'Payment Services', basePrice: 62, baseCap: 68e9 },
    { symbol: 'UBER', name: 'Uber Technologies', sector: 'Technology', industry: 'Ride-Sharing', basePrice: 72, baseCap: 150e9 },
    { symbol: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer Cyclical', industry: 'Travel', basePrice: 155, baseCap: 98e9 },
    { symbol: 'SNOW', name: 'Snowflake Inc.', sector: 'Technology', industry: 'Cloud Computing', basePrice: 165, baseCap: 55e9 },
    { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', industry: 'Data Analytics', basePrice: 22, baseCap: 48e9 },
    { symbol: 'COIN', name: 'Coinbase Global', sector: 'Financial', industry: 'Crypto Exchange', basePrice: 250, baseCap: 60e9 },
    { symbol: 'MARA', name: 'Marathon Digital', sector: 'Financial', industry: 'Crypto Mining', basePrice: 22, baseCap: 6e9 },
    { symbol: 'GME', name: 'GameStop Corp.', sector: 'Consumer Cyclical', industry: 'Retail', basePrice: 15, baseCap: 4.5e9 },
    { symbol: 'AMC', name: 'AMC Entertainment', sector: 'Communication', industry: 'Entertainment', basePrice: 4.5, baseCap: 1.3e9 },
  ];

  return stocks.map(s => {
    const changePct = gauss() * 2.5;
    const price = Math.round(s.basePrice * (1 + changePct / 100) * 100) / 100;
    const change = Math.round((price - s.basePrice) * 100) / 100;
    const avgVol = Math.round(5e6 + rand() * 20e6);
    const volume = Math.round(avgVol * (0.5 + rand() * 2.5));
    const relVolume = Math.round(volume / avgVol * 100) / 100;
    const sma20 = price * (1 + gauss() * 0.02);
    const sma50 = price * (1 + gauss() * 0.04);
    const sma200 = price * (1 + gauss() * 0.08);
    const rsi14 = Math.max(10, Math.min(90, 50 + gauss() * 15));
    const atr14 = price * (0.005 + rand() * 0.02);
    const beta = 0.5 + rand() * 1.5;
    const pe = 10 + rand() * 40;
    const eps = price / pe;

    return {
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      industry: s.industry,
      price,
      change,
      changePct: Math.round(changePct * 100) / 100,
      volume,
      avgVolume: avgVol,
      marketCap: s.baseCap,
      pe: Math.round(pe * 100) / 100,
      eps: Math.round(eps * 100) / 100,
      dividend: Math.round(rand() * 3 * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      high52w: Math.round(price * (1 + 0.1 + rand() * 0.3) * 100) / 100,
      low52w: Math.round(price * (1 - 0.1 - rand() * 0.3) * 100) / 100,
      rsi14: Math.round(rsi14 * 100) / 100,
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      sma200: Math.round(sma200 * 100) / 100,
      atr14: Math.round(atr14 * 100) / 100,
      macdSignal: Math.round(gauss() * 2 * 100) / 100,
      macdHist: Math.round(gauss() * 1 * 100) / 100,
      bbUpper: Math.round((sma20 + 2 * atr14) * 100) / 100,
      bbLower: Math.round((sma20 - 2 * atr14) * 100) / 100,
      obv: Math.round(rand() * 1e8),
      adx: Math.round((15 + rand() * 40) * 100) / 100,
      stochK: Math.round((10 + rand() * 80) * 100) / 100,
      stochD: Math.round((10 + rand() * 80) * 100) / 100,
      vwap: Math.round(price * (1 + gauss() * 0.002) * 100) / 100,
      relVolume,
      shortFloat: Math.round(rand() * 30 * 100) / 100,
      institutionalOwn: Math.round((40 + rand() * 55) * 100) / 100,
      insiderOwn: Math.round(rand() * 15 * 100) / 100,
      earningsDate: Date.now() + Math.round((5 + rand() * 60) * 86400000),
      ivRank: Math.round(rand() * 100),
      putCallRatio: Math.round((0.3 + rand() * 1.4) * 100) / 100,
      unusualOptionsScore: Math.round(rand() * 100),
      gapPct: Math.round(gauss() * 1.5 * 100) / 100,
      preMarketChange: Math.round(gauss() * 1 * 100) / 100,
      afterHoursChange: Math.round(gauss() * 0.5 * 100) / 100,
      avgSpreadBps: Math.round((0.5 + rand() * 5) * 100) / 100,
      floatShares: Math.round(s.baseCap / s.basePrice * (0.5 + rand() * 0.5)),
      revenue: Math.round(s.baseCap * (0.05 + rand() * 0.15)),
      revenueGrowth: Math.round(gauss() * 20 * 100) / 100,
      netIncome: Math.round(s.baseCap * (0.02 + rand() * 0.08)),
      debtToEquity: Math.round(rand() * 2 * 100) / 100,
      currentRatio: Math.round((0.5 + rand() * 3) * 100) / 100,
      roe: Math.round((5 + rand() * 30) * 100) / 100,
      freeCashFlow: Math.round(s.baseCap * (0.01 + rand() * 0.06)),
    };
  });
}


// ═══════════════════════════════════════════════════════════════════════
// FILTER ENGINE
// ═══════════════════════════════════════════════════════════════════════

export class FilterEngine {
  private getFieldValue(stock: StockData, field: string): number | string {
    return (stock as unknown as Record<string, number | string>)[field] ?? 0;
  }

  evaluateFilter(stock: StockData, filter: FilterCondition): boolean {
    if (!filter.enabled) return true;
    const value = this.getFieldValue(stock, filter.field);

    switch (filter.operator) {
      case 'gt': return typeof value === 'number' && value > (filter.value as number);
      case 'gte': return typeof value === 'number' && value >= (filter.value as number);
      case 'lt': return typeof value === 'number' && value < (filter.value as number);
      case 'lte': return typeof value === 'number' && value <= (filter.value as number);
      case 'eq': return value === filter.value;
      case 'neq': return value !== filter.value;
      case 'between': {
        const [lo, hi] = filter.value as number[];
        return typeof value === 'number' && value >= lo && value <= hi;
      }
      case 'in': return (filter.value as (string | number)[]).includes(value as string | number);
      case 'not_in': return !(filter.value as (string | number)[]).includes(value as string | number);
      case 'contains': return typeof value === 'string' && value.toLowerCase().includes((filter.value as string).toLowerCase());
      case 'crosses_above': return typeof value === 'number' && value > (filter.value as number);
      case 'crosses_below': return typeof value === 'number' && value < (filter.value as number);
      default: return true;
    }
  }

  evaluateAllFilters(stock: StockData, filters: FilterCondition[]): { passes: boolean; matchedFilters: string[]; score: number } {
    const matchedFilters: string[] = [];
    let totalEnabled = 0;

    for (const filter of filters) {
      if (!filter.enabled) continue;
      totalEnabled++;
      if (this.evaluateFilter(stock, filter)) {
        matchedFilters.push(filter.id);
      }
    }

    const passes = totalEnabled === 0 || matchedFilters.length === totalEnabled;
    const score = totalEnabled > 0 ? Math.round(matchedFilters.length / totalEnabled * 100) : 100;

    return { passes, matchedFilters, score };
  }
}


// ═══════════════════════════════════════════════════════════════════════
// ALERT DETECTOR
// ═══════════════════════════════════════════════════════════════════════

export class AlertDetector {
  detect(stock: StockData): ScanAlert[] {
    const alerts: ScanAlert[] = [];

    // Volume spike
    if (stock.relVolume >= 3) {
      alerts.push({
        type: 'volume_spike',
        severity: stock.relVolume >= 5 ? 'critical' : 'high',
        message: `Volume ${stock.relVolume.toFixed(1)}x average`,
        value: stock.relVolume,
      });
    }

    // 52-week breakout
    if (stock.price >= stock.high52w * 0.98) {
      alerts.push({
        type: 'breakout',
        severity: stock.price >= stock.high52w ? 'critical' : 'high',
        message: stock.price >= stock.high52w
          ? `New 52-week high: $${stock.price}`
          : `Within 2% of 52-week high`,
        value: stock.price / stock.high52w * 100,
      });
    }

    // 52-week breakdown
    if (stock.price <= stock.low52w * 1.02) {
      alerts.push({
        type: 'breakdown',
        severity: stock.price <= stock.low52w ? 'critical' : 'high',
        message: stock.price <= stock.low52w
          ? `New 52-week low: $${stock.price}`
          : `Within 2% of 52-week low`,
        value: stock.price / stock.low52w * 100,
      });
    }

    // Gap detection
    if (Math.abs(stock.gapPct) >= 3) {
      alerts.push({
        type: 'gap',
        severity: Math.abs(stock.gapPct) >= 5 ? 'high' : 'medium',
        message: `${stock.gapPct > 0 ? 'Gap up' : 'Gap down'} ${Math.abs(stock.gapPct).toFixed(1)}%`,
        value: stock.gapPct,
      });
    }

    // RSI extremes
    if (stock.rsi14 >= 80) {
      alerts.push({
        type: 'divergence',
        severity: 'medium',
        message: `Overbought RSI: ${stock.rsi14.toFixed(1)}`,
        value: stock.rsi14,
      });
    } else if (stock.rsi14 <= 20) {
      alerts.push({
        type: 'divergence',
        severity: 'medium',
        message: `Oversold RSI: ${stock.rsi14.toFixed(1)}`,
        value: stock.rsi14,
      });
    }

    // Bollinger Band squeeze
    const bbWidth = (stock.bbUpper - stock.bbLower) / stock.price * 100;
    if (bbWidth < 2) {
      alerts.push({
        type: 'squeeze',
        severity: 'high',
        message: `BB squeeze: width ${bbWidth.toFixed(2)}%`,
        value: bbWidth,
      });
    }

    // Unusual options activity
    if (stock.unusualOptionsScore >= 80) {
      alerts.push({
        type: 'unusual_options',
        severity: stock.unusualOptionsScore >= 90 ? 'critical' : 'high',
        message: `Unusual options score: ${stock.unusualOptionsScore}`,
        value: stock.unusualOptionsScore,
      });
    }

    // Earnings proximity
    const daysToEarnings = (stock.earningsDate - Date.now()) / 86400000;
    if (daysToEarnings >= 0 && daysToEarnings <= 7) {
      alerts.push({
        type: 'earnings',
        severity: daysToEarnings <= 2 ? 'high' : 'medium',
        message: `Earnings in ${Math.round(daysToEarnings)} day(s)`,
        value: daysToEarnings,
      });
    }

    // High short interest
    if (stock.shortFloat >= 20) {
      alerts.push({
        type: 'squeeze',
        severity: stock.shortFloat >= 30 ? 'high' : 'medium',
        message: `High short interest: ${stock.shortFloat.toFixed(1)}%`,
        value: stock.shortFloat,
      });
    }

    return alerts;
  }
}


// ═══════════════════════════════════════════════════════════════════════
// BUILT-IN SCAN PRESETS
// ═══════════════════════════════════════════════════════════════════════

export const SCAN_PRESETS: ScanPreset[] = [
  {
    id: 'momentum_leaders',
    name: 'Momentum Leaders',
    description: 'Stocks with strong upward momentum + volume confirmation',
    category: 'Momentum',
    filters: [
      { id: 'rsi_above_60', field: 'rsi14', category: 'technical', operator: 'gt', value: 60, label: 'RSI > 60', enabled: true },
      { id: 'above_sma20', field: 'price', category: 'price', operator: 'crosses_above', value: 0, label: 'Above SMA20', enabled: true },
      { id: 'vol_above_avg', field: 'relVolume', category: 'volume', operator: 'gt', value: 1.5, label: 'Rel Volume > 1.5x', enabled: true },
      { id: 'change_positive', field: 'changePct', category: 'price', operator: 'gt', value: 1, label: 'Change > 1%', enabled: true },
    ],
    sortBy: 'changePct',
    sortDir: 'desc',
    limit: 25,
    icon: '🚀',
  },
  {
    id: 'oversold_bounce',
    name: 'Oversold Bounce',
    description: 'Oversold stocks showing reversal signals',
    category: 'Mean Reversion',
    filters: [
      { id: 'rsi_below_30', field: 'rsi14', category: 'technical', operator: 'lt', value: 30, label: 'RSI < 30', enabled: true },
      { id: 'near_bb_lower', field: 'price', category: 'technical', operator: 'crosses_below', value: 0, label: 'Near BB Lower', enabled: true },
      { id: 'change_negative', field: 'changePct', category: 'price', operator: 'lt', value: -2, label: 'Change < -2%', enabled: true },
    ],
    sortBy: 'rsi14',
    sortDir: 'asc',
    limit: 25,
    icon: '📉',
  },
  {
    id: 'volume_explosion',
    name: 'Volume Explosion',
    description: 'Stocks with massive volume relative to average',
    category: 'Volume',
    filters: [
      { id: 'vol_spike', field: 'relVolume', category: 'volume', operator: 'gt', value: 3, label: 'Rel Volume > 3x', enabled: true },
      { id: 'min_price', field: 'price', category: 'price', operator: 'gt', value: 5, label: 'Price > $5', enabled: true },
    ],
    sortBy: 'relVolume',
    sortDir: 'desc',
    limit: 20,
    icon: '💥',
  },
  {
    id: 'gap_and_go',
    name: 'Gap & Go',
    description: 'Stocks gapping up on high volume',
    category: 'Gap',
    filters: [
      { id: 'gap_up', field: 'gapPct', category: 'price', operator: 'gt', value: 3, label: 'Gap > 3%', enabled: true },
      { id: 'vol_confirm', field: 'relVolume', category: 'volume', operator: 'gt', value: 2, label: 'Rel Volume > 2x', enabled: true },
      { id: 'positive_change', field: 'changePct', category: 'price', operator: 'gt', value: 0, label: 'Holding gap', enabled: true },
    ],
    sortBy: 'gapPct',
    sortDir: 'desc',
    limit: 15,
    icon: '⬆️',
  },
  {
    id: 'short_squeeze',
    name: 'Short Squeeze Candidates',
    description: 'High short interest + volume + price action',
    category: 'Special',
    filters: [
      { id: 'high_si', field: 'shortFloat', category: 'fundamental', operator: 'gt', value: 15, label: 'Short Float > 15%', enabled: true },
      { id: 'vol_rising', field: 'relVolume', category: 'volume', operator: 'gt', value: 2, label: 'Rel Volume > 2x', enabled: true },
      { id: 'price_up', field: 'changePct', category: 'price', operator: 'gt', value: 2, label: 'Price up > 2%', enabled: true },
    ],
    sortBy: 'shortFloat',
    sortDir: 'desc',
    limit: 15,
    icon: '🔥',
  },
  {
    id: 'unusual_options',
    name: 'Unusual Options Activity',
    description: 'Stocks with elevated options flow and IV',
    category: 'Options',
    filters: [
      { id: 'options_score', field: 'unusualOptionsScore', category: 'options', operator: 'gt', value: 70, label: 'Options Score > 70', enabled: true },
      { id: 'iv_elevated', field: 'ivRank', category: 'options', operator: 'gt', value: 60, label: 'IV Rank > 60', enabled: true },
    ],
    sortBy: 'unusualOptionsScore',
    sortDir: 'desc',
    limit: 20,
    icon: '📊',
  },
  {
    id: 'golden_cross',
    name: 'Golden Cross',
    description: 'SMA50 crossing above SMA200',
    category: 'Trend',
    filters: [
      { id: 'sma50_above_200', field: 'sma50', category: 'technical', operator: 'crosses_above', value: 0, label: 'SMA50 > SMA200', enabled: true },
      { id: 'adx_strong', field: 'adx', category: 'technical', operator: 'gt', value: 25, label: 'ADX > 25', enabled: true },
    ],
    sortBy: 'adx',
    sortDir: 'desc',
    limit: 20,
    icon: '✨',
  },
  {
    id: 'large_cap_value',
    name: 'Large Cap Value',
    description: 'Undervalued large-cap dividend payers',
    category: 'Fundamental',
    filters: [
      { id: 'large_cap', field: 'marketCap', category: 'fundamental', operator: 'gt', value: 50e9, label: 'Mkt Cap > $50B', enabled: true },
      { id: 'low_pe', field: 'pe', category: 'fundamental', operator: 'lt', value: 20, label: 'P/E < 20', enabled: true },
      { id: 'has_dividend', field: 'dividend', category: 'fundamental', operator: 'gt', value: 1, label: 'Div Yield > 1%', enabled: true },
      { id: 'strong_roe', field: 'roe', category: 'fundamental', operator: 'gt', value: 15, label: 'ROE > 15%', enabled: true },
    ],
    sortBy: 'pe',
    sortDir: 'asc',
    limit: 20,
    icon: '💎',
  },
  {
    id: 'earnings_plays',
    name: 'Pre-Earnings Movers',
    description: 'Stocks approaching earnings with elevated IV',
    category: 'Events',
    filters: [
      { id: 'iv_high', field: 'ivRank', category: 'options', operator: 'gt', value: 70, label: 'IV Rank > 70', enabled: true },
      { id: 'vol_rising', field: 'relVolume', category: 'volume', operator: 'gt', value: 1.3, label: 'Rel Volume > 1.3x', enabled: true },
    ],
    sortBy: 'ivRank',
    sortDir: 'desc',
    limit: 15,
    icon: '📅',
  },
  {
    id: 'bb_squeeze',
    name: 'Bollinger Band Squeeze',
    description: 'Tight Bollinger Bands indicating potential breakout',
    category: 'Volatility',
    filters: [
      { id: 'adx_low', field: 'adx', category: 'technical', operator: 'lt', value: 20, label: 'ADX < 20', enabled: true },
      { id: 'price_above_5', field: 'price', category: 'price', operator: 'gt', value: 5, label: 'Price > $5', enabled: true },
    ],
    sortBy: 'adx',
    sortDir: 'asc',
    limit: 20,
    icon: '🔄',
  },
];


// ═══════════════════════════════════════════════════════════════════════
// MARKET SCANNER ENGINE
// ═══════════════════════════════════════════════════════════════════════

export class MarketScanner {
  private universe: StockData[];
  private filterEngine: FilterEngine;
  private alertDetector: AlertDetector;
  private sessions: Map<string, ScanSession>;

  constructor(seed = 42) {
    this.universe = generateDemoUniverse(seed);
    this.filterEngine = new FilterEngine();
    this.alertDetector = new AlertDetector();
    this.sessions = new Map();
  }

  /**
   * Run a scan with given filters
   */
  scan(preset: ScanPreset): ScanResult[] {
    const results: ScanResult[] = [];

    for (const stock of this.universe) {
      // Special handling for SMA crossover filters
      const adjustedFilters = preset.filters.map(f => {
        if (f.field === 'price' && f.operator === 'crosses_above') {
          return { ...f, field: 'price', operator: 'gt' as FilterOperator, value: stock.sma20 };
        }
        if (f.field === 'price' && f.operator === 'crosses_below') {
          return { ...f, field: 'price', operator: 'lt' as FilterOperator, value: stock.bbLower };
        }
        if (f.field === 'sma50' && f.operator === 'crosses_above') {
          return { ...f, field: 'sma50', operator: 'gt' as FilterOperator, value: stock.sma200 };
        }
        return f;
      });

      const evaluation = this.filterEngine.evaluateAllFilters(stock, adjustedFilters);
      if (evaluation.passes) {
        const alerts = this.alertDetector.detect(stock);

        results.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          industry: stock.industry,
          matchScore: evaluation.score,
          matchedFilters: evaluation.matchedFilters,
          data: {
            price: stock.price,
            change: stock.change,
            changePct: stock.changePct,
            volume: stock.volume,
            relVolume: stock.relVolume,
            rsi14: stock.rsi14,
            adx: stock.adx,
            marketCap: stock.marketCap,
            pe: stock.pe,
            dividend: stock.dividend,
            shortFloat: stock.shortFloat,
            ivRank: stock.ivRank,
            beta: stock.beta,
            sma20: stock.sma20,
            sma50: stock.sma50,
            sma200: stock.sma200,
            bbUpper: stock.bbUpper,
            bbLower: stock.bbLower,
            gapPct: stock.gapPct,
            unusualOptionsScore: stock.unusualOptionsScore,
          },
          alerts,
          rank: 0,
          timestamp: Date.now(),
        });
      }
    }

    // Sort results
    const sortField = preset.sortBy;
    results.sort((a, b) => {
      const va = (a.data[sortField] as number) || 0;
      const vb = (b.data[sortField] as number) || 0;
      return preset.sortDir === 'desc' ? vb - va : va - vb;
    });

    // Apply limit and rank
    const limited = results.slice(0, preset.limit);
    limited.forEach((r, i) => r.rank = i + 1);

    return limited;
  }

  /**
   * Start a scanning session
   */
  startSession(preset: ScanPreset, frequency: ScanFrequency = '5s'): ScanSession {
    const session: ScanSession = {
      id: `scan-${Date.now().toString(36)}`,
      preset,
      startedAt: Date.now(),
      lastScanAt: 0,
      scanCount: 0,
      results: [],
      history: [],
      frequency,
      running: true,
    };

    // Run initial scan
    session.results = this.scan(preset);
    session.lastScanAt = Date.now();
    session.scanCount = 1;
    session.history.push([...session.results]);

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Update a running session with refreshed data
   */
  refreshSession(sessionId: string): ScanSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.running) return null;

    // Refresh universe with slight perturbation
    this.perturbUniverse();

    session.results = this.scan(session.preset);
    session.lastScanAt = Date.now();
    session.scanCount++;
    if (session.history.length < 100) {
      session.history.push([...session.results]);
    }

    return session;
  }

  /**
   * Simulate slight price/volume changes
   */
  private perturbUniverse(): void {
    for (const stock of this.universe) {
      const pctChange = (Math.random() - 0.5) * 0.2;
      stock.price = Math.round(stock.price * (1 + pctChange / 100) * 100) / 100;
      stock.change = Math.round((stock.price - stock.price / (1 + stock.changePct / 100)) * 100) / 100;
      stock.changePct = Math.round((stock.changePct + pctChange) * 100) / 100;
      stock.volume += Math.round((Math.random() - 0.4) * 50000);
      stock.relVolume = Math.round(stock.volume / stock.avgVolume * 100) / 100;
      stock.rsi14 = Math.max(5, Math.min(95, stock.rsi14 + (Math.random() - 0.5) * 1));
    }
  }

  /**
   * Generate market overview
   */
  getMarketOverview(): MarketOverview {
    const advancing = this.universe.filter(s => s.changePct > 0).length;
    const declining = this.universe.filter(s => s.changePct < 0).length;
    const unchanged = this.universe.filter(s => s.changePct === 0).length;
    const newHighs = this.universe.filter(s => s.price >= s.high52w).length;
    const newLows = this.universe.filter(s => s.price <= s.low52w).length;
    const aboveMA200 = this.universe.filter(s => s.price > s.sma200).length;

    // Sector performance
    const sectorMap = new Map<string, StockData[]>();
    for (const stock of this.universe) {
      if (!sectorMap.has(stock.sector)) sectorMap.set(stock.sector, []);
      sectorMap.get(stock.sector)!.push(stock);
    }

    const sectorPerformance = [...sectorMap.entries()].map(([sector, stocks]) => ({
      sector,
      pctChange: Math.round(stocks.reduce((s, st) => s + st.changePct, 0) / stocks.length * 100) / 100,
      breadth: Math.round(stocks.filter(st => st.changePct > 0).length / stocks.length * 100) / 100,
    })).sort((a, b) => b.pctChange - a.pctChange);

    const toResults = (stocks: StockData[]): ScanResult[] =>
      stocks.map((s, i) => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        industry: s.industry,
        matchScore: 100,
        matchedFilters: [],
        data: { price: s.price, change: s.change, changePct: s.changePct, volume: s.volume, relVolume: s.relVolume },
        alerts: [],
        rank: i + 1,
        timestamp: Date.now(),
      }));

    const sorted = [...this.universe];
    const topGainers = toResults(sorted.sort((a, b) => b.changePct - a.changePct).slice(0, 10));
    const topLosers = toResults(sorted.sort((a, b) => a.changePct - b.changePct).slice(0, 10));
    const mostActive = toResults([...this.universe].sort((a, b) => b.volume - a.volume).slice(0, 10));
    const unusualVolume = toResults([...this.universe].sort((a, b) => b.relVolume - a.relVolume).slice(0, 10));

    return {
      totalSymbols: this.universe.length,
      advancing, declining, unchanged, newHighs, newLows,
      aboveMA200,
      belowMA200: this.universe.length - aboveMA200,
      avgVolRatio: Math.round(this.universe.reduce((s, st) => s + st.relVolume, 0) / this.universe.length * 100) / 100,
      sectorPerformance,
      topGainers, topLosers, mostActive, unusualVolume,
    };
  }

  /**
   * Get all presets
   */
  getPresets(): ScanPreset[] {
    return [...SCAN_PRESETS];
  }

  /**
   * Get universe
   */
  getUniverse(): StockData[] {
    return [...this.universe];
  }
}


// ═══════════════════════════════════════════════════════════════════════
// HEAT MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════════

export interface HeatMapCell {
  symbol: string;
  name: string;
  sector: string;
  value: number;         // The metric value
  color: string;         // Hex color
  size: number;          // Relative size (market cap weight)
  x: number;
  y: number;
  width: number;
  height: number;
}

export class HeatMapGenerator {
  /**
   * Generate a treemap-style heat map data
   */
  generate(
    scanner: MarketScanner,
    metric: 'changePct' | 'relVolume' | 'rsi14' = 'changePct',
    sizeBy: 'marketCap' | 'volume' | 'equal' = 'marketCap'
  ): { cells: HeatMapCell[]; sectors: string[]; range: { min: number; max: number } } {
    const universe = scanner.getUniverse();
    const totalWidth = 1000;
    const totalHeight = 600;

    // Group by sector
    const sectorMap = new Map<string, typeof universe>();
    for (const stock of universe) {
      if (!sectorMap.has(stock.sector)) sectorMap.set(stock.sector, []);
      sectorMap.get(stock.sector)!.push(stock);
    }

    const sectors = [...sectorMap.keys()].sort();
    const cells: HeatMapCell[] = [];

    // Simple row-based layout
    let currentY = 0;
    const sectorHeight = totalHeight / sectors.length;

    for (const sector of sectors) {
      const stocks = sectorMap.get(sector) || [];
      const totalSize = stocks.reduce((s, st) =>
        s + (sizeBy === 'marketCap' ? st.marketCap : sizeBy === 'volume' ? st.volume : 1), 0
      );

      let currentX = 0;
      for (const stock of stocks) {
        const size = sizeBy === 'marketCap' ? stock.marketCap : sizeBy === 'volume' ? stock.volume : 1;
        const width = (size / totalSize) * totalWidth;
        const value = stock[metric];

        cells.push({
          symbol: stock.symbol,
          name: stock.name,
          sector,
          value,
          color: this.valueToColor(value, metric),
          size: size / totalSize,
          x: Math.round(currentX),
          y: Math.round(currentY),
          width: Math.round(width),
          height: Math.round(sectorHeight),
        });
        currentX += width;
      }
      currentY += sectorHeight;
    }

    const values = cells.map(c => c.value);
    return {
      cells,
      sectors,
      range: { min: Math.min(...values), max: Math.max(...values) },
    };
  }

  private valueToColor(value: number, metric: string): string {
    if (metric === 'changePct') {
      // Green for positive, red for negative
      const intensity = Math.min(1, Math.abs(value) / 5);
      if (value > 0) {
        const g = Math.round(100 + 155 * intensity);
        return `#00${g.toString(16).padStart(2, '0')}00`;
      } else {
        const r = Math.round(100 + 155 * intensity);
        return `#${r.toString(16).padStart(2, '0')}0000`;
      }
    }
    if (metric === 'relVolume') {
      const intensity = Math.min(1, value / 5);
      const b = Math.round(100 + 155 * intensity);
      return `#0000${b.toString(16).padStart(2, '0')}`;
    }
    if (metric === 'rsi14') {
      if (value > 70) return '#ff3333';
      if (value < 30) return '#33ff33';
      return '#666666';
    }
    return '#444444';
  }
}


// ═══════════════════════════════════════════════════════════════════════
// EXPORTS & DEMO
// ═══════════════════════════════════════════════════════════════════════

export function runScannerDemo(): {
  overview: MarketOverview;
  momentumResults: ScanResult[];
  volumeResults: ScanResult[];
  heatMap: ReturnType<HeatMapGenerator['generate']>;
} {
  const scanner = new MarketScanner(42);
  const overview = scanner.getMarketOverview();

  const momentumPreset = SCAN_PRESETS.find(p => p.id === 'momentum_leaders')!;
  const volumePreset = SCAN_PRESETS.find(p => p.id === 'volume_explosion')!;

  const momentumResults = scanner.scan(momentumPreset);
  const volumeResults = scanner.scan(volumePreset);

  const heatMapGen = new HeatMapGenerator();
  const heatMap = heatMapGen.generate(scanner, 'changePct', 'marketCap');

  return { overview, momentumResults, volumeResults, heatMap };
}
