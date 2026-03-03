/**
 * useCrypto — React hook wiring lib/assetClasses/crypto → CryptoUI2
 *
 * Provides: crypto asset management, DeFi analytics, on-chain metrics,
 * DEX/CEX market data, staking/yield, liquidation tracking, whale alerts,
 * gas tracker, NFT floor prices, protocol TVL.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
// ── Lib stubs (self-contained mode) ──
type CryptoAsset = any;
type DeFiProtocol = any;
type OnChainData = any;
type GasEstimate = any;
type StakingInfo = any;
type LiquidationData = any;
type CryptoConfig = any;
const cryptoAssets = (..._a: any[]): any => ({});
const defiProtocols = (..._a: any[]): any => ({});
const onChainMetrics = (..._a: any[]): any => ({});
const gasTracker = (..._a: any[]): any => ({});
const stakingYields = (..._a: any[]): any => ({});
const liquidationLevels = (..._a: any[]): any => ({});


// ── Types ────────────────────────────────────────────────────────────────────

export interface CryptoQuote {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  maxSupply: number | null;
  rank: number;
  dominance: number;
  high24h: number;
  low24h: number;
  ath: number;
  athDate: string;
  sparkline: number[];
  category: string;
  timestamp: number;
}

export interface DeFiInfo {
  protocol: string;
  chain: string;
  tvl: number;
  tvlChange24h: number;
  apy: number;
  category: 'DEX' | 'Lending' | 'Yield' | 'Bridge' | 'Derivatives' | 'Liquid Staking';
  token: string;
  tokenPrice: number;
  mcapToTvl: number;
  fees24h: number;
  revenue24h: number;
}

export interface OnChainMetric {
  symbol: string;
  activeAddresses: number;
  transactions: number;
  hashRate: number;
  difficulty: number;
  nvtRatio: number;
  sopr: number;           // Spent Output Profit Ratio
  mvrv: number;           // Market Value to Realized Value
  nupl: number;           // Net Unrealized Profit/Loss
  exchangeNetflow: number;
  whaleTransactions: number;
  fearGreedIndex: number;
}

export interface WhaleAlert {
  id: string;
  symbol: string;
  amount: number;
  valueUsd: number;
  from: string;
  to: string;
  type: 'exchange_inflow' | 'exchange_outflow' | 'whale_transfer' | 'mint' | 'burn';
  timestamp: number;
  txHash: string;
}

export interface GasInfo {
  chain: string;
  slow: { gwei: number; time: string; usd: number };
  standard: { gwei: number; time: string; usd: number };
  fast: { gwei: number; time: string; usd: number };
  baseFee: number;
  lastBlock: number;
}

export interface StakingData {
  symbol: string;
  name: string;
  apy: number;
  minStake: number;
  lockPeriod: string;
  totalStaked: number;
  stakedPct: number;
  validators: number;
  slashingRisk: 'low' | 'medium' | 'high';
}

export interface CryptoPortfolioItem {
  symbol: string;
  amount: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPct: number;
  allocation: number;
}

export interface CryptoState {
  /** All crypto quotes */
  quotes: CryptoQuote[];
  /** Active crypto */
  activeCrypto: string;
  /** DeFi protocols */
  defi: DeFiInfo[];
  /** On-chain metrics */
  onChain: OnChainMetric | null;
  /** Whale alerts */
  whaleAlerts: WhaleAlert[];
  /** Gas tracker */
  gas: GasInfo[];
  /** Staking data */
  staking: StakingData[];
  /** Portfolio */
  portfolio: CryptoPortfolioItem[];
  /** Total portfolio value */
  totalPortfolioValue: number;
  /** Total crypto market cap */
  totalMarketCap: number;
  /** BTC dominance */
  btcDominance: number;
  /** Fear & Greed Index */
  fearGreedIndex: number;
  /** Sector performance */
  sectorPerformance: Array<{ sector: string; change: number; marketCap: number }>;
  /** Correlation matrix */
  correlations: { assets: string[]; matrix: number[][] } | null;
  /** Liquidation heatmap */
  liquidations: Array<{ price: number; longLiq: number; shortLiq: number }>;
  /** Is streaming */
  isStreaming: boolean;
  /** Watchlist */
  watchlist: string[];
}

export interface CryptoActions {
  setActiveCrypto: (symbol: string) => void;
  refreshQuotes: () => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;

  loadDeFi: () => void;
  loadOnChain: (symbol?: string) => void;
  loadWhaleAlerts: () => void;
  loadGas: () => void;
  loadStaking: () => void;
  loadLiquidations: (symbol?: string) => void;

  addToPortfolio: (symbol: string, amount: number, cost: number) => void;
  removeFromPortfolio: (symbol: string) => void;
  updatePortfolioPrices: () => void;

  computeSectorPerformance: () => void;
  computeCorrelations: () => void;

  startStreaming: () => void;
  stopStreaming: () => void;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const CRYPTO_DATA: Array<{ symbol: string; name: string; basePrice: number; maxSupply: number | null; category: string; rank: number }> = [
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 67500, maxSupply: 21000000, category: 'Layer 1', rank: 1 },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 3450, maxSupply: null, category: 'Layer 1', rank: 2 },
  { symbol: 'BNB', name: 'BNB', basePrice: 580, maxSupply: 200000000, category: 'Layer 1', rank: 3 },
  { symbol: 'SOL', name: 'Solana', basePrice: 145, maxSupply: null, category: 'Layer 1', rank: 4 },
  { symbol: 'XRP', name: 'XRP', basePrice: 0.62, maxSupply: 100000000000, category: 'Payment', rank: 5 },
  { symbol: 'ADA', name: 'Cardano', basePrice: 0.48, maxSupply: 45000000000, category: 'Layer 1', rank: 6 },
  { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.16, maxSupply: null, category: 'Meme', rank: 7 },
  { symbol: 'AVAX', name: 'Avalanche', basePrice: 38, maxSupply: 720000000, category: 'Layer 1', rank: 8 },
  { symbol: 'DOT', name: 'Polkadot', basePrice: 7.20, maxSupply: null, category: 'Layer 0', rank: 9 },
  { symbol: 'LINK', name: 'Chainlink', basePrice: 15.50, maxSupply: 1000000000, category: 'Oracle', rank: 10 },
  { symbol: 'MATIC', name: 'Polygon', basePrice: 0.72, maxSupply: 10000000000, category: 'Layer 2', rank: 11 },
  { symbol: 'UNI', name: 'Uniswap', basePrice: 9.80, maxSupply: 1000000000, category: 'DeFi', rank: 12 },
  { symbol: 'AAVE', name: 'Aave', basePrice: 95, maxSupply: 16000000, category: 'DeFi', rank: 13 },
  { symbol: 'ARB', name: 'Arbitrum', basePrice: 1.15, maxSupply: 10000000000, category: 'Layer 2', rank: 14 },
  { symbol: 'OP', name: 'Optimism', basePrice: 2.80, maxSupply: 4294967296, category: 'Layer 2', rank: 15 },
  { symbol: 'ATOM', name: 'Cosmos', basePrice: 9.50, maxSupply: null, category: 'Layer 0', rank: 16 },
  { symbol: 'FIL', name: 'Filecoin', basePrice: 6.20, maxSupply: null, category: 'Storage', rank: 17 },
  { symbol: 'LDO', name: 'Lido DAO', basePrice: 2.40, maxSupply: 1000000000, category: 'DeFi', rank: 18 },
  { symbol: 'MKR', name: 'Maker', basePrice: 2900, maxSupply: 1005577, category: 'DeFi', rank: 19 },
  { symbol: 'INJ', name: 'Injective', basePrice: 28, maxSupply: null, category: 'DeFi', rank: 20 },
];

function mockCryptoQuote(d: typeof CRYPTO_DATA[0]): CryptoQuote {
  const change24h = +((Math.random() - 0.45) * 10).toFixed(2);
  const price = +(d.basePrice * (1 + change24h / 100)).toFixed(d.basePrice > 100 ? 2 : d.basePrice > 1 ? 4 : 6);
  const supply = d.maxSupply ? d.maxSupply * 0.7 : Math.floor(d.basePrice > 100 ? 20e6 : 1e9);
  const marketCap = price * supply;
  const sparkline = Array.from({ length: 24 }, (_, i) =>
    +(d.basePrice * (1 + ((Math.random() - 0.48) * 3 + change24h * i / 24) / 100)).toFixed(2),
  );
  return {
    symbol: d.symbol, name: d.name, price,
    change24h, change7d: +((Math.random() - 0.4) * 15).toFixed(2),
    change30d: +((Math.random() - 0.35) * 25).toFixed(2),
    marketCap, volume24h: marketCap * (0.03 + Math.random() * 0.05),
    circulatingSupply: supply, maxSupply: d.maxSupply,
    rank: d.rank, dominance: d.rank <= 2 ? (d.rank === 1 ? 52 : 17) : +(Math.random() * 3).toFixed(2),
    high24h: +(price * 1.03).toFixed(2), low24h: +(price * 0.97).toFixed(2),
    ath: +(d.basePrice * (1.5 + Math.random())).toFixed(2), athDate: '2024-11-15',
    sparkline, category: d.category, timestamp: Date.now(),
  };
}

function genWhaleId() { return `whale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: CryptoState = {
  quotes: CRYPTO_DATA.map(mockCryptoQuote),
  activeCrypto: 'BTC',
  defi: [],
  onChain: null,
  whaleAlerts: [],
  gas: [],
  staking: [],
  portfolio: [],
  totalPortfolioValue: 0,
  totalMarketCap: 2.4e12,
  btcDominance: 52,
  fearGreedIndex: 65,
  sectorPerformance: [],
  correlations: null,
  liquidations: [],
  isStreaming: false,
  watchlist: ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'],
};

export function useCrypto(): [CryptoState, CryptoActions] {
  const [state, setState] = useState<CryptoState>(INITIAL_STATE);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setActiveCrypto = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, activeCrypto: symbol }));
  }, []);

  const refreshQuotes = useCallback(() => {
    setState(prev => ({
      ...prev,
      quotes: CRYPTO_DATA.map(mockCryptoQuote),
      totalMarketCap: 2.2e12 + Math.random() * 0.4e12,
      btcDominance: 50 + Math.random() * 4,
      fearGreedIndex: Math.floor(30 + Math.random() * 50),
    }));
  }, []);

  const addToWatchlist = useCallback((symbol: string) => {
    setState(prev => prev.watchlist.includes(symbol) ? prev : { ...prev, watchlist: [...prev.watchlist, symbol] });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, watchlist: prev.watchlist.filter(s => s !== symbol) }));
  }, []);

  const loadDeFi = useCallback(() => {
    const protocols: DeFiInfo[] = [
      { protocol: 'Lido', chain: 'Ethereum', tvl: 33e9, tvlChange24h: 1.2, apy: 3.6, category: 'Liquid Staking', token: 'LDO', tokenPrice: 2.4, mcapToTvl: 0.07, fees24h: 2.5e6, revenue24h: 250000 },
      { protocol: 'Aave', chain: 'Multi', tvl: 12e9, tvlChange24h: 0.8, apy: 4.2, category: 'Lending', token: 'AAVE', tokenPrice: 95, mcapToTvl: 0.12, fees24h: 1.8e6, revenue24h: 900000 },
      { protocol: 'Uniswap', chain: 'Multi', tvl: 5.5e9, tvlChange24h: -0.3, apy: 0, category: 'DEX', token: 'UNI', tokenPrice: 9.8, mcapToTvl: 1.5, fees24h: 3.2e6, revenue24h: 0 },
      { protocol: 'MakerDAO', chain: 'Ethereum', tvl: 8.2e9, tvlChange24h: 0.5, apy: 5.0, category: 'Lending', token: 'MKR', tokenPrice: 2900, mcapToTvl: 0.35, fees24h: 800000, revenue24h: 400000 },
      { protocol: 'Curve', chain: 'Multi', tvl: 3.8e9, tvlChange24h: -0.1, apy: 2.8, category: 'DEX', token: 'CRV', tokenPrice: 0.55, mcapToTvl: 0.15, fees24h: 500000, revenue24h: 250000 },
      { protocol: 'Compound', chain: 'Ethereum', tvl: 2.5e9, tvlChange24h: 0.2, apy: 3.5, category: 'Lending', token: 'COMP', tokenPrice: 55, mcapToTvl: 0.18, fees24h: 300000, revenue24h: 150000 },
      { protocol: 'Rocket Pool', chain: 'Ethereum', tvl: 4.2e9, tvlChange24h: 0.9, apy: 3.4, category: 'Liquid Staking', token: 'RPL', tokenPrice: 25, mcapToTvl: 0.12, fees24h: 150000, revenue24h: 75000 },
      { protocol: 'GMX', chain: 'Arbitrum', tvl: 700e6, tvlChange24h: 1.5, apy: 12, category: 'Derivatives', token: 'GMX', tokenPrice: 38, mcapToTvl: 0.45, fees24h: 1.2e6, revenue24h: 360000 },
    ];
    setState(prev => ({ ...prev, defi: protocols }));
  }, []);

  const loadOnChain = useCallback((symbol?: string) => {
    const sym = symbol || state.activeCrypto;
    const metric: OnChainMetric = {
      symbol: sym,
      activeAddresses: Math.floor(500000 + Math.random() * 500000),
      transactions: Math.floor(200000 + Math.random() * 300000),
      hashRate: sym === 'BTC' ? 550 + Math.random() * 50 : 0,
      difficulty: sym === 'BTC' ? 7.2e13 : 0,
      nvtRatio: +(30 + Math.random() * 40).toFixed(1),
      sopr: +(0.98 + Math.random() * 0.04).toFixed(4),
      mvrv: +(1.5 + Math.random() * 1.5).toFixed(3),
      nupl: +(0.3 + Math.random() * 0.3).toFixed(3),
      exchangeNetflow: +((Math.random() - 0.5) * 5000).toFixed(1),
      whaleTransactions: Math.floor(50 + Math.random() * 150),
      fearGreedIndex: Math.floor(30 + Math.random() * 50),
    };
    setState(prev => ({ ...prev, onChain: metric }));
  }, [state.activeCrypto]);

  const loadWhaleAlerts = useCallback(() => {
    const alerts: WhaleAlert[] = Array.from({ length: 15 }, (_, i) => {
      const symbols = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'];
      const types: WhaleAlert['type'][] = ['exchange_inflow', 'exchange_outflow', 'whale_transfer', 'mint', 'burn'];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const basePrice = CRYPTO_DATA.find(d => d.symbol === sym)?.basePrice || 1;
      const amount = Math.floor(100 + Math.random() * 10000);
      return {
        id: genWhaleId(),
        symbol: sym,
        amount,
        valueUsd: amount * basePrice,
        from: `0x${Math.random().toString(16).slice(2, 10)}...`,
        to: `0x${Math.random().toString(16).slice(2, 10)}...`,
        type: types[Math.floor(Math.random() * types.length)],
        timestamp: Date.now() - Math.floor(Math.random() * 3600000),
        txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
      };
    });
    alerts.sort((a, b) => b.timestamp - a.timestamp);
    setState(prev => ({ ...prev, whaleAlerts: alerts }));
  }, []);

  const loadGas = useCallback(() => {
    const chains: GasInfo[] = [
      { chain: 'Ethereum', slow: { gwei: 15, time: '~5 min', usd: 2.50 }, standard: { gwei: 25, time: '~2 min', usd: 4.20 }, fast: { gwei: 40, time: '~30 sec', usd: 6.80 }, baseFee: 12, lastBlock: 19500000 + Math.floor(Math.random() * 1000) },
      { chain: 'Polygon', slow: { gwei: 50, time: '~30 sec', usd: 0.01 }, standard: { gwei: 100, time: '~15 sec', usd: 0.02 }, fast: { gwei: 200, time: '~5 sec', usd: 0.04 }, baseFee: 30, lastBlock: 55000000 + Math.floor(Math.random() * 1000) },
      { chain: 'Arbitrum', slow: { gwei: 0.1, time: '~10 sec', usd: 0.15 }, standard: { gwei: 0.15, time: '~5 sec', usd: 0.22 }, fast: { gwei: 0.25, time: '~2 sec', usd: 0.35 }, baseFee: 0.08, lastBlock: 180000000 + Math.floor(Math.random() * 1000) },
      { chain: 'Base', slow: { gwei: 0.05, time: '~10 sec', usd: 0.08 }, standard: { gwei: 0.1, time: '~5 sec', usd: 0.15 }, fast: { gwei: 0.2, time: '~2 sec', usd: 0.28 }, baseFee: 0.03, lastBlock: 10000000 + Math.floor(Math.random() * 1000) },
    ];
    setState(prev => ({ ...prev, gas: chains }));
  }, []);

  const loadStaking = useCallback(() => {
    const data: StakingData[] = [
      { symbol: 'ETH', name: 'Ethereum', apy: 3.6, minStake: 32, lockPeriod: 'Variable', totalStaked: 30e6, stakedPct: 25, validators: 950000, slashingRisk: 'low' },
      { symbol: 'SOL', name: 'Solana', apy: 7.2, minStake: 0.01, lockPeriod: '2 epochs (~4 days)', totalStaked: 350e6, stakedPct: 68, validators: 2000, slashingRisk: 'low' },
      { symbol: 'ADA', name: 'Cardano', apy: 3.2, minStake: 10, lockPeriod: 'None', totalStaked: 23e9, stakedPct: 62, validators: 3200, slashingRisk: 'low' },
      { symbol: 'DOT', name: 'Polkadot', apy: 12, minStake: 120, lockPeriod: '28 days', totalStaked: 700e6, stakedPct: 54, validators: 297, slashingRisk: 'medium' },
      { symbol: 'ATOM', name: 'Cosmos', apy: 15, minStake: 0.001, lockPeriod: '21 days', totalStaked: 200e6, stakedPct: 62, validators: 180, slashingRisk: 'medium' },
      { symbol: 'AVAX', name: 'Avalanche', apy: 8.5, minStake: 25, lockPeriod: '14 days', totalStaked: 260e6, stakedPct: 58, validators: 1500, slashingRisk: 'low' },
    ];
    setState(prev => ({ ...prev, staking: data }));
  }, []);

  const loadLiquidations = useCallback((symbol?: string) => {
    const sym = symbol || state.activeCrypto;
    const basePrice = CRYPTO_DATA.find(d => d.symbol === sym)?.basePrice || 1000;
    const levels = Array.from({ length: 40 }, (_, i) => {
      const pricePct = -10 + i * 0.5;
      const price = +(basePrice * (1 + pricePct / 100)).toFixed(2);
      return {
        price,
        longLiq: Math.floor(Math.random() * 50e6) * (pricePct < 0 ? (Math.abs(pricePct) / 10) : 0),
        shortLiq: Math.floor(Math.random() * 50e6) * (pricePct > 0 ? (pricePct / 10) : 0),
      };
    });
    setState(prev => ({ ...prev, liquidations: levels }));
  }, [state.activeCrypto]);

  // Portfolio
  const addToPortfolio = useCallback((symbol: string, amount: number, cost: number) => {
    setState(prev => {
      const existing = prev.portfolio.find(p => p.symbol === symbol);
      const quote = prev.quotes.find(q => q.symbol === symbol);
      const currentPrice = quote?.price || cost;

      if (existing) {
        const totalAmount = existing.amount + amount;
        const totalCost = existing.avgCost * existing.amount + cost * amount;
        const avgCost = totalCost / totalAmount;
        const value = totalAmount * currentPrice;
        const pnl = value - totalCost;
        const updated: CryptoPortfolioItem = {
          ...existing,
          amount: totalAmount,
          avgCost: +avgCost.toFixed(6),
          currentPrice,
          value,
          pnl,
          pnlPct: +((pnl / totalCost) * 100).toFixed(2),
          allocation: 0, // will recompute
        };
        const portfolio = prev.portfolio.map(p => p.symbol === symbol ? updated : p);
        const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
        return {
          ...prev,
          portfolio: portfolio.map(p => ({ ...p, allocation: +((p.value / totalValue) * 100).toFixed(2) })),
          totalPortfolioValue: totalValue,
        };
      }

      const value = amount * currentPrice;
      const pnl = value - amount * cost;
      const item: CryptoPortfolioItem = {
        symbol, amount, avgCost: cost, currentPrice, value, pnl,
        pnlPct: +((pnl / (amount * cost)) * 100).toFixed(2),
        allocation: 0,
      };
      const portfolio = [...prev.portfolio, item];
      const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
      return {
        ...prev,
        portfolio: portfolio.map(p => ({ ...p, allocation: +((p.value / totalValue) * 100).toFixed(2) })),
        totalPortfolioValue: totalValue,
      };
    });
  }, []);

  const removeFromPortfolio = useCallback((symbol: string) => {
    setState(prev => {
      const portfolio = prev.portfolio.filter(p => p.symbol !== symbol);
      const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
      return {
        ...prev,
        portfolio: portfolio.map(p => ({ ...p, allocation: totalValue > 0 ? +((p.value / totalValue) * 100).toFixed(2) : 0 })),
        totalPortfolioValue: totalValue,
      };
    });
  }, []);

  const updatePortfolioPrices = useCallback(() => {
    setState(prev => {
      const portfolio = prev.portfolio.map(p => {
        const quote = prev.quotes.find(q => q.symbol === p.symbol);
        const currentPrice = quote?.price || p.currentPrice;
        const value = p.amount * currentPrice;
        const cost = p.amount * p.avgCost;
        return { ...p, currentPrice, value, pnl: value - cost, pnlPct: +((value - cost) / cost * 100).toFixed(2) };
      });
      const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
      return {
        ...prev,
        portfolio: portfolio.map(p => ({ ...p, allocation: totalValue > 0 ? +((p.value / totalValue) * 100).toFixed(2) : 0 })),
        totalPortfolioValue: totalValue,
      };
    });
  }, []);

  const computeSectorPerformance = useCallback(() => {
    const sectors = ['Layer 1', 'Layer 2', 'DeFi', 'Layer 0', 'Meme', 'Payment', 'Oracle', 'Storage'];
    const perf = sectors.map(sector => {
      const items = state.quotes.filter(q => q.category === sector);
      return {
        sector,
        change: items.length > 0 ? +(items.reduce((s, q) => s + q.change24h, 0) / items.length).toFixed(2) : 0,
        marketCap: items.reduce((s, q) => s + q.marketCap, 0),
      };
    }).filter(s => s.marketCap > 0);
    setState(prev => ({ ...prev, sectorPerformance: perf }));
  }, [state.quotes]);

  const computeCorrelations = useCallback(() => {
    const assets = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'LINK', 'DOT'];
    const n = assets.length;
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        if (j < i) return 0;
        // BTC-ETH high correlation, others moderate
        if (i === 0 && j === 1) return 0.85;
        return +(0.3 + Math.random() * 0.5).toFixed(3);
      }),
    );
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) matrix[i][j] = matrix[j][i];
    setState(prev => ({ ...prev, correlations: { assets, matrix } }));
  }, []);

  const startStreaming = useCallback(() => {
    if (streamRef.current) return;
    streamRef.current = setInterval(() => {
      refreshQuotes();
    }, 3000);
    setState(prev => ({ ...prev, isStreaming: true }));
  }, [refreshQuotes]);

  const stopStreaming = useCallback(() => {
    if (streamRef.current) { clearInterval(streamRef.current); streamRef.current = null; }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  useEffect(() => { return () => { if (streamRef.current) clearInterval(streamRef.current); }; }, []);

  const actions: CryptoActions = useMemo(() => ({
    setActiveCrypto, refreshQuotes, addToWatchlist, removeFromWatchlist,
    loadDeFi, loadOnChain, loadWhaleAlerts, loadGas, loadStaking, loadLiquidations,
    addToPortfolio, removeFromPortfolio, updatePortfolioPrices,
    computeSectorPerformance, computeCorrelations,
    startStreaming, stopStreaming,
  }), [
    setActiveCrypto, refreshQuotes, addToWatchlist, removeFromWatchlist,
    loadDeFi, loadOnChain, loadWhaleAlerts, loadGas, loadStaking, loadLiquidations,
    addToPortfolio, removeFromPortfolio, updatePortfolioPrices,
    computeSectorPerformance, computeCorrelations,
    startStreaming, stopStreaming,
  ]);

  return [state, actions];
}
