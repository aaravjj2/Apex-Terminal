import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Bitcoin, TrendingUp, TrendingDown, Activity, BarChart3,
  ArrowUpDown, RefreshCw, Globe, Layers, Zap,
  DollarSign, Hash, ExternalLink,
} from 'lucide-react';

// --- Types ---

interface CryptoAsset {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: string;
  volume24h: string;
  dominance: number;
  sparkline: { v: number }[];
}

// --- Mock Data ---

const sparkGen = (trend: number) => Array.from({ length: 24 }, (_, i) => ({ v: 100 + trend * i + Math.sin(i * 0.6) * 8 + Math.random() * 5 }));

const CRYPTO_ASSETS: CryptoAsset[] = [
  { rank: 1, symbol: 'BTC', name: 'Bitcoin', price: 63482.15, change24h: 2.34, change7d: 5.12, marketCap: '$1.24T', volume24h: '$32.1B', dominance: 52.3, sparkline: sparkGen(1.2) },
  { rank: 2, symbol: 'ETH', name: 'Ethereum', price: 3456.82, change24h: 1.87, change7d: 3.45, marketCap: '$415B', volume24h: '$15.8B', dominance: 17.5, sparkline: sparkGen(0.8) },
  { rank: 3, symbol: 'BNB', name: 'BNB', price: 412.55, change24h: -0.45, change7d: 1.22, marketCap: '$63B', volume24h: '$1.2B', dominance: 2.7, sparkline: sparkGen(0.3) },
  { rank: 4, symbol: 'SOL', name: 'Solana', price: 142.38, change24h: 4.56, change7d: 12.34, marketCap: '$62B', volume24h: '$3.8B', dominance: 2.6, sparkline: sparkGen(2.1) },
  { rank: 5, symbol: 'XRP', name: 'Ripple', price: 0.6234, change24h: -1.23, change7d: -2.45, marketCap: '$34B', volume24h: '$1.5B', dominance: 1.4, sparkline: sparkGen(-0.5) },
  { rank: 6, symbol: 'ADA', name: 'Cardano', price: 0.6512, change24h: 3.21, change7d: 8.67, marketCap: '$23B', volume24h: '$0.8B', dominance: 1.0, sparkline: sparkGen(1.5) },
  { rank: 7, symbol: 'AVAX', name: 'Avalanche', price: 38.72, change24h: 2.12, change7d: 6.78, marketCap: '$14B', volume24h: '$0.6B', dominance: 0.6, sparkline: sparkGen(1.0) },
  { rank: 8, symbol: 'DOT', name: 'Polkadot', price: 8.45, change24h: -0.89, change7d: 2.34, marketCap: '$11B', volume24h: '$0.4B', dominance: 0.5, sparkline: sparkGen(0.2) },
  { rank: 9, symbol: 'LINK', name: 'Chainlink', price: 19.82, change24h: 5.67, change7d: 15.23, marketCap: '$11B', volume24h: '$0.9B', dominance: 0.5, sparkline: sparkGen(2.5) },
  { rank: 10, symbol: 'MATIC', name: 'Polygon', price: 1.02, change24h: 1.45, change7d: 4.56, marketCap: '$9.5B', volume24h: '$0.5B', dominance: 0.4, sparkline: sparkGen(0.7) },
];

const FEAR_GREED = { value: 72, label: 'Greed', prev: 65 };

const DOMINANCE_DATA = [
  { name: 'BTC', value: 52.3, color: '#ff9900' },
  { name: 'ETH', value: 17.5, color: '#6699ff' },
  { name: 'BNB', value: 2.7, color: '#f3ba2f' },
  { name: 'SOL', value: 2.6, color: '#9945ff' },
  { name: 'Others', value: 24.9, color: '#444' },
];

const DEFI_TVL = Array.from({ length: 30 }, (_, i) => ({
  date: `${Math.floor(i / 30 * 28 + 1)}`,
  tvl: +(85 + Math.sin(i * 0.2) * 12 + i * 0.5 + Math.random() * 5).toFixed(1),
  aave: +(18 + Math.sin(i * 0.15) * 3 + Math.random() * 1).toFixed(1),
  lido: +(22 + Math.sin(i * 0.18) * 4 + Math.random() * 1.5).toFixed(1),
  maker: +(8 + Math.sin(i * 0.12) * 2 + Math.random() * 0.5).toFixed(1),
}));

const FUNDING_RATES = [
  { pair: 'BTC-PERP', binance: 0.0120, okx: 0.0115, bybit: 0.0118, deribit: 0.0110 },
  { pair: 'ETH-PERP', binance: 0.0095, okx: 0.0090, bybit: 0.0092, deribit: 0.0088 },
  { pair: 'SOL-PERP', binance: 0.0180, okx: 0.0175, bybit: 0.0172, deribit: 0.0168 },
  { pair: 'BNB-PERP', binance: 0.0060, okx: 0.0058, bybit: 0.0062, deribit: 0.0055 },
  { pair: 'XRP-PERP', binance: -0.0025, okx: -0.0030, bybit: -0.0022, deribit: -0.0028 },
  { pair: 'ADA-PERP', binance: 0.0140, okx: 0.0135, bybit: 0.0138, deribit: 0.0132 },
  { pair: 'AVAX-PERP', binance: 0.0100, okx: 0.0098, bybit: 0.0095, deribit: 0.0092 },
  { pair: 'LINK-PERP', binance: 0.0200, okx: 0.0195, bybit: 0.0190, deribit: 0.0188 },
];

const EXCHANGE_PRICES = [
  { coin: 'BTC', binance: 63482, coinbase: 63495, kraken: 63478, okx: 63488 },
  { coin: 'ETH', binance: 3456.82, coinbase: 3458.10, kraken: 3455.90, okx: 3457.50 },
  { coin: 'SOL', binance: 142.38, coinbase: 142.52, kraken: 142.30, okx: 142.45 },
];

const LIQUIDATION_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  longs: +(Math.random() * 50 + 5).toFixed(1),
  shorts: +(Math.random() * 45 + 5).toFixed(1),
}));

const CORRELATION_DATA = [
  { pair: 'BTC/ETH', value: 0.92, trend: 'stable' as const },
  { pair: 'BTC/SOL', value: 0.78, trend: 'rising' as const },
  { pair: 'BTC/SPX', value: 0.45, trend: 'falling' as const },
  { pair: 'BTC/Gold', value: 0.18, trend: 'stable' as const },
  { pair: 'ETH/SOL', value: 0.85, trend: 'rising' as const },
  { pair: 'BTC/DXY', value: -0.52, trend: 'stable' as const },
];

const ONCHAIN = [
  { metric: 'Active Addresses (BTC)', value: '1.02M', change: '+3.2%', positive: true },
  { metric: 'Hash Rate', value: '625 EH/s', change: '+1.8%', positive: true },
  { metric: 'Exchange Outflow (BTC)', value: '12,450', change: '+45%', positive: true },
  { metric: 'Miner Revenue', value: '$42.8M', change: '-5.2%', positive: false },
  { metric: 'MVRV Ratio', value: '2.15', change: '+0.12', positive: true },
  { metric: 'NVT Signal', value: '48.2', change: '-2.1', positive: false },
  { metric: 'Realized Cap', value: '$412B', change: '+1.5%', positive: true },
  { metric: 'SOPR', value: '1.04', change: '+0.02', positive: true },
];

const NFT_SUMMARY = [
  { collection: 'Bored Ape Yacht Club', floor: '28.5 ETH', change: -4.2, volume: '142 ETH' },
  { collection: 'CryptoPunks', floor: '48.2 ETH', change: 1.8, volume: '95 ETH' },
  { collection: 'Azuki', floor: '8.4 ETH', change: -8.5, volume: '210 ETH' },
  { collection: 'Pudgy Penguins', floor: '12.1 ETH', change: 12.4, volume: '180 ETH' },
  { collection: 'DeGods', floor: '5.2 ETH', change: -2.1, volume: '65 ETH' },
];

// --- Sub-components ---

const MiniLine: React.FC<{ data: { v: number }[]; positive: boolean }> = ({ data, positive }) => (
  <div className="w-20 h-8">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line type="monotone" dataKey="v" stroke={positive ? '#00cc66' : '#ff3333'} strokeWidth={1.2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

const FearGreedGauge: React.FC = () => {
  const gaugeData = [{ name: 'FG', value: FEAR_GREED.value, fill: FEAR_GREED.value > 75 ? '#ff3333' : FEAR_GREED.value > 50 ? '#00cc66' : FEAR_GREED.value > 25 ? '#ff9900' : '#ff3333' }];
  return (
    <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fear & Greed Index</div>
      <div className="flex items-center gap-3">
        <div className="w-24 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="100%" innerRadius="55%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={8}>
              <RadialBar background={{ fill: '#1a1a2e' }} dataKey="value" cornerRadius={4} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#00cc66]">{FEAR_GREED.value}</div>
          <div className="text-xs text-[#00cc66]">{FEAR_GREED.label}</div>
          <div className="text-[10px] text-gray-500">prev: {FEAR_GREED.prev}</div>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

export const CryptoAnalytics: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'defi' | 'funding' | 'onchain' | 'nft'>('overview');
  const [sortCol, setSortCol] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedAssets = useMemo(() =>
    [...CRYPTO_ASSETS].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] as number;
      const bv = (b as Record<string, unknown>)[sortCol] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    }),
    [sortCol, sortDir]
  );

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'rank' ? 'asc' : 'desc'); }
  };

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'defi', label: 'DeFi' },
    { key: 'funding', label: 'Funding & Liquidations' },
    { key: 'onchain', label: 'On-Chain' },
    { key: 'nft', label: 'NFTs' },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <Bitcoin size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">Crypto Analytics</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-2.5 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs">
          <div><span className="text-gray-500">Total Mkt Cap:</span> <span className="text-gray-200">$2.37T</span></div>
          <div><span className="text-gray-500">24h Vol:</span> <span className="text-gray-200">$89.2B</span></div>
          <div><span className="text-gray-500">BTC Dom:</span> <span className="text-amber-400">52.3%</span></div>
        </div>
        <button className="text-gray-500 hover:text-gray-300 p-1 ml-2"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Top Row */}
            <div className="grid grid-cols-4 gap-3">
              <FearGreedGauge />

              {/* Exchange Comparison */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3 col-span-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Exchange Price Comparison</div>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-500 py-1 px-2">Coin</th>
                      <th className="text-right text-gray-500 py-1 px-2">Binance</th>
                      <th className="text-right text-gray-500 py-1 px-2">Coinbase</th>
                      <th className="text-right text-gray-500 py-1 px-2">Kraken</th>
                      <th className="text-right text-gray-500 py-1 px-2">OKX</th>
                      <th className="text-right text-gray-500 py-1 px-2">Spread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXCHANGE_PRICES.map((ep) => {
                      const prices = [ep.binance, ep.coinbase, ep.kraken, ep.okx];
                      const spread = ((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices) * 100).toFixed(3);
                      return (
                        <tr key={ep.coin} className="border-t border-[#1a1a2e]/50">
                          <td className="py-1.5 px-2 text-amber-400 font-medium">{ep.coin}</td>
                          <td className="py-1.5 px-2 text-right text-gray-300">${ep.binance.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-gray-300">${ep.coinbase.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-gray-300">${ep.kraken.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-gray-300">${ep.okx.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right text-[#6699ff]">{spread}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Market Dominance */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Market Dominance</div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={DOMINANCE_DATA} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                        {DOMINANCE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 10, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                  {DOMINANCE_DATA.map((d) => (
                    <div key={d.name} className="flex items-center gap-1 text-[9px]">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-400">{d.name}</span>
                      <span className="text-gray-300">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Token Correlations */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Token Correlations (30D)</div>
              <div className="grid grid-cols-6 gap-2">
                {CORRELATION_DATA.map((c) => (
                  <div key={c.pair} className="bg-[#0a0a14] border border-[#1a1a2e] rounded p-2 text-center">
                    <div className="text-[10px] text-gray-500">{c.pair}</div>
                    <div className={`text-sm font-bold ${c.value > 0.7 ? 'text-[#00cc66]' : c.value > 0.3 ? 'text-amber-400' : c.value > 0 ? 'text-gray-300' : 'text-[#ff3333]'}`}>
                      {c.value.toFixed(2)}
                    </div>
                    <div className={`text-[9px] ${c.trend === 'rising' ? 'text-[#00cc66]' : c.trend === 'falling' ? 'text-[#ff3333]' : 'text-gray-600'}`}>
                      {c.trend}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Table */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    {[
                      { key: 'rank', label: '#', align: 'left' },
                      { key: 'name', label: 'Name', align: 'left' },
                      { key: 'price', label: 'Price', align: 'right' },
                      { key: 'change24h', label: '24h', align: 'right' },
                      { key: 'change7d', label: '7d', align: 'right' },
                      { key: 'marketCap', label: 'Mkt Cap', align: 'right' },
                      { key: 'volume24h', label: 'Volume', align: 'right' },
                      { key: 'dominance', label: 'Dom%', align: 'right' },
                      { key: 'sparkline', label: '7D Chart', align: 'center' },
                    ].map((col) => (
                      <th key={col.key} onClick={() => col.key !== 'sparkline' && handleSort(col.key)} className={`px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-300 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key && <ArrowUpDown size={10} className="text-amber-400" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map((coin) => (
                    <tr key={coin.symbol} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f] cursor-pointer">
                      <td className="px-3 py-2 text-gray-500">{coin.rank}</td>
                      <td className="px-3 py-2">
                        <div className="text-amber-400 font-medium">{coin.symbol}</div>
                        <div className="text-gray-600 text-[10px]">{coin.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-200 font-medium">${coin.price.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-medium ${coin.change24h >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                        {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2 text-right ${coin.change7d >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                        {coin.change7d >= 0 ? '+' : ''}{coin.change7d.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{coin.marketCap}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{coin.volume24h}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{coin.dominance}%</td>
                      <td className="px-3 py-2"><MiniLine data={coin.sparkline} positive={coin.change7d >= 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'defi' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Total Value Locked (TVL) — DeFi</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={DEFI_TVL} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `$${v}B`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `$${v}B`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="tvl" name="Total TVL" fill="#6699ff20" stroke="#6699ff" strokeWidth={2} />
                    <Line type="monotone" dataKey="aave" name="Aave" stroke="#00cc66" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="lido" name="Lido" stroke="#ff9900" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="maker" name="Maker" stroke="#cc66ff" strokeWidth={1} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'funding' && (
          <div className="p-4 space-y-4">
            {/* Funding Rates */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Perpetual Funding Rates (8h)</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Pair</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Binance</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">OKX</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Bybit</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Deribit</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNDING_RATES.map((fr) => (
                    <tr key={fr.pair} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-amber-400 font-medium">{fr.pair}</td>
                      {[fr.binance, fr.okx, fr.bybit, fr.deribit].map((rate, i) => (
                        <td key={i} className={`px-3 py-2 text-right font-medium ${rate >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {(rate * 100).toFixed(4)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Liquidation Chart */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">24h Liquidations ($M)</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={LIQUIDATION_DATA} margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="hour" tick={{ fill: '#666', fontSize: 9 }} tickCount={8} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `$${v}M`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `$${v}M`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="longs" name="Long Liqs" fill="#ff3333" fillOpacity={0.7} stackId="a" />
                    <Bar dataKey="shorts" name="Short Liqs" fill="#00cc66" fillOpacity={0.7} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'onchain' && (
          <div className="p-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">On-Chain Metrics — Bitcoin</div>
            <div className="grid grid-cols-4 gap-3">
              {ONCHAIN.map((m) => (
                <div key={m.metric} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">{m.metric}</div>
                  <div className="text-lg font-bold text-gray-200 mt-1">{m.value}</div>
                  <div className={`text-[10px] mt-0.5 ${m.positive ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                    {m.change}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'nft' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">NFT Market Summary</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Collection</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Floor</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">24h Chg</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">24h Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {NFT_SUMMARY.map((nft) => (
                    <tr key={nft.collection} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-gray-300">{nft.collection}</td>
                      <td className="px-3 py-2 text-right text-amber-400 font-medium">{nft.floor}</td>
                      <td className={`px-3 py-2 text-right font-medium ${nft.change >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                        {nft.change >= 0 ? '+' : ''}{nft.change}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{nft.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoAnalytics;
