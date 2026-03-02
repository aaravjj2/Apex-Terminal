// ─── Time & Session Enums ───────────────────────────────────────────────────

export enum TimeFrame {
  TICK = 'tick',
  S1 = '1s',
  S5 = '5s',
  S15 = '15s',
  S30 = '30s',
  M1 = '1m',
  M2 = '2m',
  M3 = '3m',
  M5 = '5m',
  M10 = '10m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  H6 = '6h',
  H8 = '8h',
  H12 = '12h',
  D1 = '1D',
  D2 = '2D',
  D3 = '3D',
  W1 = '1W',
  W2 = '2W',
  MN1 = '1M',
  MN3 = '3M',
  MN6 = '6M',
  Y1 = '1Y',
}

export const TIMEFRAME_MS: Record<string, number> = {
  [TimeFrame.S1]: 1_000,
  [TimeFrame.S5]: 5_000,
  [TimeFrame.S15]: 15_000,
  [TimeFrame.S30]: 30_000,
  [TimeFrame.M1]: 60_000,
  [TimeFrame.M2]: 120_000,
  [TimeFrame.M3]: 180_000,
  [TimeFrame.M5]: 300_000,
  [TimeFrame.M10]: 600_000,
  [TimeFrame.M15]: 900_000,
  [TimeFrame.M30]: 1_800_000,
  [TimeFrame.H1]: 3_600_000,
  [TimeFrame.H2]: 7_200_000,
  [TimeFrame.H4]: 14_400_000,
  [TimeFrame.H6]: 21_600_000,
  [TimeFrame.H8]: 28_800_000,
  [TimeFrame.H12]: 43_200_000,
  [TimeFrame.D1]: 86_400_000,
  [TimeFrame.W1]: 604_800_000,
};

export enum AssetClass {
  EQUITY = 'EQUITY',
  OPTION = 'OPTION',
  FUTURE = 'FUTURE',
  FOREX = 'FOREX',
  CRYPTO = 'CRYPTO',
  BOND = 'BOND',
  INDEX = 'INDEX',
  ETF = 'ETF',
  COMMODITY = 'COMMODITY',
  WARRANT = 'WARRANT',
  CFD = 'CFD',
  FUND = 'FUND',
}

export enum Exchange {
  NYSE = 'NYSE',
  NASDAQ = 'NASDAQ',
  AMEX = 'AMEX',
  ARCA = 'ARCA',
  BATS = 'BATS',
  IEX = 'IEX',
  CME = 'CME',
  CBOT = 'CBOT',
  NYMEX = 'NYMEX',
  COMEX = 'COMEX',
  ICE = 'ICE',
  CBOE = 'CBOE',
  LSE = 'LSE',
  TSE = 'TSE',
  HKEX = 'HKEX',
  SSE = 'SSE',
  SZSE = 'SZSE',
  EUREX = 'EUREX',
  ASX = 'ASX',
  BSE = 'BSE',
  NSE = 'NSE',
  BINANCE = 'BINANCE',
  COINBASE = 'COINBASE',
  KRAKEN = 'KRAKEN',
  OTC = 'OTC',
}

export enum MarketStatus {
  PRE_MARKET = 'PRE_MARKET',
  OPEN = 'OPEN',
  LUNCH_BREAK = 'LUNCH_BREAK',
  POST_MARKET = 'POST_MARKET',
  CLOSED = 'CLOSED',
  HALTED = 'HALTED',
  HOLIDAY = 'HOLIDAY',
  EARLY_CLOSE = 'EARLY_CLOSE',
}

// ─── Core Market Data ───────────────────────────────────────────────────────

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  mid: number;
  spread: number;
  timestamp: number;
  exchange?: Exchange;
  condition?: string;
}

export interface Trade {
  symbol: string;
  price: number;
  size: number;
  timestamp: number;
  exchange?: Exchange;
  condition?: string;
  tradeId?: string;
  aggressor?: 'BUY' | 'SELL' | 'UNKNOWN';
}

export interface Bar {
  symbol: string;
  timeframe: TimeFrame;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  trades: number;
  openInterest?: number;
  turnover?: number;
  gap?: number;
  isComplete: boolean;
}

export interface Level1 {
  symbol: string;
  timestamp: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  lastSize: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  vwap: number;
  avgVolume: number;
  marketCap?: number;
}

export interface Level2Entry {
  price: number;
  size: number;
  orders: number;
  exchange?: Exchange;
  timestamp: number;
}

export interface Level2 {
  symbol: string;
  timestamp: number;
  bids: Level2Entry[];
  asks: Level2Entry[];
}

export interface Level3Entry extends Level2Entry {
  orderId: string;
  side: 'BID' | 'ASK';
  participant?: string;
}

export interface Level3 {
  symbol: string;
  timestamp: number;
  orders: Level3Entry[];
}

// ─── Session & Exchange ─────────────────────────────────────────────────────

export interface TradingSession {
  name: string;
  open: string;   // HH:mm format in exchange TZ
  close: string;
  timezone: string;
  isPreMarket?: boolean;
  isPostMarket?: boolean;
}

export interface ExchangeInfo {
  code: Exchange;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  sessions: TradingSession[];
  holidays: string[];          // ISO date strings
  earlyCloses: Record<string, string>; // date → close time
  lotSize: number;
  tickSize: number;
  assetClasses: AssetClass[];
}

// ─── Corporate Actions ──────────────────────────────────────────────────────

export enum CorporateActionType {
  CASH_DIVIDEND = 'CASH_DIVIDEND',
  STOCK_DIVIDEND = 'STOCK_DIVIDEND',
  FORWARD_SPLIT = 'FORWARD_SPLIT',
  REVERSE_SPLIT = 'REVERSE_SPLIT',
  MERGER = 'MERGER',
  ACQUISITION = 'ACQUISITION',
  SPINOFF = 'SPINOFF',
  RIGHTS_ISSUE = 'RIGHTS_ISSUE',
  BUYBACK = 'BUYBACK',
  DELISTING = 'DELISTING',
  NAME_CHANGE = 'NAME_CHANGE',
}

export interface CorporateAction {
  symbol: string;
  type: CorporateActionType;
  exDate: string;
  recordDate?: string;
  payDate?: string;
  ratio?: number;            // split ratio (e.g. 4 for 4:1 split)
  amount?: number;           // dividend amount per share
  currency?: string;
  newSymbol?: string;        // for mergers / name changes
  description: string;
}

// ─── Economic & Earnings ────────────────────────────────────────────────────

export interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  category: string;
  timestamp: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  previous?: number;
  consensus?: number;
  actual?: number;
  unit?: string;
  source?: string;
}

export interface EarningsRelease {
  symbol: string;
  reportDate: string;
  fiscalQuarter: string;
  fiscalYear: number;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  guidanceEps?: { low: number; high: number };
  guidanceRevenue?: { low: number; high: number };
  timing: 'BMO' | 'AMC' | 'DURING';
  surprise?: number;
  surprisePct?: number;
}

export interface IPO {
  symbol: string;
  company: string;
  exchange: Exchange;
  expectedDate: string;
  priceRange?: { low: number; high: number };
  offerPrice?: number;
  shares?: number;
  underwriters: string[];
  industry: string;
  status: 'FILED' | 'PRICED' | 'WITHDRAWN' | 'LISTED';
}

// ─── Data Quality ───────────────────────────────────────────────────────────

export interface DataQuality {
  symbol: string;
  timeframe: TimeFrame;
  totalBars: number;
  missingBars: number;
  staleBars: number;
  outlierBars: number;
  gapCount: number;
  completeness: number;       // 0-1
  lastChecked: number;
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'MISSING' | 'STALE' | 'OUTLIER' | 'GAP' | 'DUPLICATE' | 'INVALID';
  timestamp: number;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface DataGap {
  symbol: string;
  timeframe: TimeFrame;
  start: number;
  end: number;
  expectedBars: number;
  reason?: 'HOLIDAY' | 'HALT' | 'NO_DATA' | 'EXCHANGE_ISSUE';
}

// ─── Subscription ───────────────────────────────────────────────────────────

export type MarketDataLevel = 'L1' | 'L2' | 'L3' | 'TRADE' | 'QUOTE' | 'BAR';

export interface Subscription {
  id: string;
  symbol: string;
  level: MarketDataLevel;
  timeframe?: TimeFrame;
  exchange?: Exchange;
  callback: (data: unknown) => void;
  createdAt: number;
}

export interface FeedConfig {
  maxSubscriptions: number;
  throttleMs: number;
  batchSize: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  heartbeatIntervalMs: number;
  staleThresholdMs: number;
  outlierStdDevMultiple: number;
}

export const DEFAULT_FEED_CONFIG: FeedConfig = {
  maxSubscriptions: 500,
  throttleMs: 100,
  batchSize: 50,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 30_000,
  heartbeatIntervalMs: 5_000,
  staleThresholdMs: 15_000,
  outlierStdDevMultiple: 5,
};
