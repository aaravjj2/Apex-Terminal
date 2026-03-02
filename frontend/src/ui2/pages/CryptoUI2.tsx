import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ── Theme ─────────────────────────────────────────────────── */
const BG      = '#0a0a0a';
const PANEL   = '#111111';
const BORDER  = '#1e1e1e';
const AMBER   = '#f5a623';
const GREEN   = '#26a69a';
const RED     = '#ef5350';
const BLUE    = '#42a5f5';
const PURPLE  = '#ab47bc';
const ORANGE  = '#ff8a65';
const CYAN    = '#00bcd4';
const SUBTLE  = '#555';
const TEXT    = '#d1d4dc';
const MONO    = '"Roboto Mono","Courier New",monospace';

/* ── Types ─────────────────────────────────────────────────── */
interface Coin {
  rank: number; symbol: string; name: string; price: number;
  change1h: number; change24h: number; change7d: number;
  marketCap: number; volume24h: number; dominance: number;
  sparkline: number[];
}

interface Liquidation {
  time: string; exchange: string; symbol: string; side: string;
  size: number; price: number;
}

interface DeFiProtocol {
  name: string; chain: string; tvl: number; change24h: number;
  apy: number; category: string;
}

interface ExchangeFlow {
  exchange: string; inflow24h: number; outflow24h: number;
  netflow: number; reserves: number;
}

interface OnChainMetric {
  label: string; value: string; change: number; description: string;
}

/* ── Mock Data ─────────────────────────────────────────────── */
const sparkGen = (base: number, vol: number): number[] =>
  Array.from({ length: 24 }, (_, i) => base * (1 + (Math.sin(i * 0.5) * vol + (Math.random() - 0.5) * vol)));

const COINS: Coin[] = [
  { rank: 1,  symbol: 'BTC',  name: 'Bitcoin',       price: 43256.80, change1h: 0.12,  change24h: 2.45,  change7d: 5.82,  marketCap: 847_200_000_000, volume24h: 28_400_000_000, dominance: 52.4, sparkline: sparkGen(43000, 0.02) },
  { rank: 2,  symbol: 'ETH',  name: 'Ethereum',      price: 2268.45,  change1h: -0.08, change24h: 1.92,  change7d: 8.15,  marketCap: 272_800_000_000, volume24h: 14_200_000_000, dominance: 16.9, sparkline: sparkGen(2260, 0.03) },
  { rank: 3,  symbol: 'BNB',  name: 'BNB',           price: 312.65,   change1h: 0.05,  change24h: 0.85,  change7d: 3.42,  marketCap: 48_100_000_000,  volume24h: 1_250_000_000,  dominance: 3.0,  sparkline: sparkGen(312, 0.015) },
  { rank: 4,  symbol: 'SOL',  name: 'Solana',        price: 98.42,    change1h: 0.35,  change24h: 4.28,  change7d: 12.65, marketCap: 42_600_000_000,  volume24h: 3_840_000_000,  dominance: 2.6,  sparkline: sparkGen(96, 0.04) },
  { rank: 5,  symbol: 'XRP',  name: 'XRP',           price: 0.6245,   change1h: -0.15, change24h: -0.42, change7d: 2.18,  marketCap: 34_200_000_000,  volume24h: 1_420_000_000,  dominance: 2.1,  sparkline: sparkGen(0.62, 0.025) },
  { rank: 6,  symbol: 'ADA',  name: 'Cardano',       price: 0.5842,   change1h: 0.22,  change24h: 1.28,  change7d: 6.45,  marketCap: 20_600_000_000,  volume24h: 680_000_000,    dominance: 1.3,  sparkline: sparkGen(0.58, 0.03) },
  { rank: 7,  symbol: 'AVAX', name: 'Avalanche',     price: 38.65,    change1h: 0.42,  change24h: 3.85,  change7d: 15.20, marketCap: 14_200_000_000,  volume24h: 920_000_000,    dominance: 0.9,  sparkline: sparkGen(37, 0.05) },
  { rank: 8,  symbol: 'DOT',  name: 'Polkadot',      price: 7.85,     change1h: -0.05, change24h: 0.62,  change7d: 4.18,  marketCap: 10_400_000_000,  volume24h: 420_000_000,    dominance: 0.6,  sparkline: sparkGen(7.8, 0.02) },
  { rank: 9,  symbol: 'LINK', name: 'Chainlink',     price: 15.28,    change1h: 0.18,  change24h: 2.15,  change7d: 8.92,  marketCap: 8_900_000_000,   volume24h: 580_000_000,    dominance: 0.5,  sparkline: sparkGen(15, 0.035) },
  { rank: 10, symbol: 'MATIC',name: 'Polygon',       price: 0.8245,   change1h: -0.12, change24h: 1.45,  change7d: 3.82,  marketCap: 7_600_000_000,   volume24h: 450_000_000,    dominance: 0.5,  sparkline: sparkGen(0.82, 0.025) },
  { rank: 11, symbol: 'UNI',  name: 'Uniswap',       price: 6.42,     change1h: 0.08,  change24h: 1.85,  change7d: 7.25,  marketCap: 4_800_000_000,   volume24h: 240_000_000,    dominance: 0.3,  sparkline: sparkGen(6.3, 0.03) },
  { rank: 12, symbol: 'ATOM', name: 'Cosmos',        price: 9.85,     change1h: 0.15,  change24h: 0.92,  change7d: 5.65,  marketCap: 3_600_000_000,   volume24h: 180_000_000,    dominance: 0.2,  sparkline: sparkGen(9.8, 0.02) },
  { rank: 13, symbol: 'ARB',  name: 'Arbitrum',      price: 1.24,     change1h: 0.28,  change24h: 3.45,  change7d: 10.82, marketCap: 3_200_000_000,   volume24h: 420_000_000,    dominance: 0.2,  sparkline: sparkGen(1.2, 0.04) },
  { rank: 14, symbol: 'OP',   name: 'Optimism',      price: 2.85,     change1h: 0.32,  change24h: 4.12,  change7d: 11.45, marketCap: 2_800_000_000,   volume24h: 380_000_000,    dominance: 0.2,  sparkline: sparkGen(2.8, 0.04) },
  { rank: 15, symbol: 'NEAR', name: 'NEAR Protocol', price: 3.42,     change1h: 0.45,  change24h: 5.28,  change7d: 18.65, marketCap: 3_400_000_000,   volume24h: 320_000_000,    dominance: 0.2,  sparkline: sparkGen(3.2, 0.05) },
];

const LIQUIDATIONS: Liquidation[] = [
  { time: '14:32:18', exchange: 'Binance',  symbol: 'BTC/USDT',  side: 'LONG',  size: 2_450_000, price: 43180.50 },
  { time: '14:31:45', exchange: 'Bybit',    symbol: 'ETH/USDT',  side: 'SHORT', size: 1_820_000, price: 2275.80 },
  { time: '14:31:22', exchange: 'OKX',      symbol: 'SOL/USDT',  side: 'LONG',  size: 960_000,   price: 97.85 },
  { time: '14:30:58', exchange: 'Binance',  symbol: 'BTC/USDT',  side: 'SHORT', size: 3_200_000, price: 43320.20 },
  { time: '14:30:32', exchange: 'Bybit',    symbol: 'AVAX/USDT', side: 'LONG',  size: 480_000,   price: 38.40 },
  { time: '14:29:55', exchange: 'Binance',  symbol: 'ETH/USDT',  side: 'LONG',  size: 1_150_000, price: 2260.40 },
  { time: '14:29:18', exchange: 'OKX',      symbol: 'XRP/USDT',  side: 'SHORT', size: 620_000,   price: 0.6260 },
  { time: '14:28:42', exchange: 'Binance',  symbol: 'BTC/USDT',  side: 'LONG',  size: 4_800_000, price: 43050.00 },
  { time: '14:28:15', exchange: 'dYdX',     symbol: 'ETH/USD',   side: 'SHORT', size: 850_000,   price: 2272.50 },
  { time: '14:27:38', exchange: 'Bybit',    symbol: 'LINK/USDT', side: 'LONG',  size: 340_000,   price: 15.12 },
  { time: '14:27:05', exchange: 'Binance',  symbol: 'SOL/USDT',  side: 'SHORT', size: 1_420_000, price: 98.80 },
  { time: '14:26:28', exchange: 'OKX',      symbol: 'DOT/USDT',  side: 'LONG',  size: 280_000,   price: 7.78 },
];

const DEFI_PROTOCOLS: DeFiProtocol[] = [
  { name: 'Lido',       chain: 'Ethereum', tvl: 18_400_000_000, change24h: 0.85,  apy: 4.8,  category: 'Liquid Staking' },
  { name: 'MakerDAO',   chain: 'Ethereum', tvl: 8_200_000_000,  change24h: 1.24,  apy: 5.2,  category: 'CDP' },
  { name: 'AAVE v3',    chain: 'Multi',    tvl: 12_600_000_000, change24h: 2.15,  apy: 3.8,  category: 'Lending' },
  { name: 'Uniswap v3', chain: 'Multi',    tvl: 4_800_000_000,  change24h: -0.42, apy: 12.5, category: 'DEX' },
  { name: 'Curve',      chain: 'Multi',    tvl: 3_600_000_000,  change24h: 0.65,  apy: 2.4,  category: 'DEX' },
  { name: 'Eigenlayer', chain: 'Ethereum', tvl: 6_200_000_000,  change24h: 3.85,  apy: 6.2,  category: 'Restaking' },
  { name: 'Rocket Pool',chain: 'Ethereum', tvl: 3_400_000_000,  change24h: 0.52,  apy: 4.5,  category: 'Liquid Staking' },
  { name: 'Compound v3',chain: 'Ethereum', tvl: 2_800_000_000,  change24h: 1.82,  apy: 3.2,  category: 'Lending' },
  { name: 'GMX',        chain: 'Arbitrum', tvl: 520_000_000,    change24h: 4.28,  apy: 18.5, category: 'Perps' },
  { name: 'Pendle',     chain: 'Multi',    tvl: 1_200_000_000,  change24h: 5.82,  apy: 24.8, category: 'Yield' },
  { name: 'Jito',       chain: 'Solana',   tvl: 1_800_000_000,  change24h: 6.45,  apy: 7.2,  category: 'Liquid Staking' },
  { name: 'Jupiter',    chain: 'Solana',   tvl: 680_000_000,    change24h: 8.25,  apy: 15.4, category: 'DEX' },
];

const EXCHANGE_FLOWS: ExchangeFlow[] = [
  { exchange: 'Binance',   inflow24h: 12_400, outflow24h: 14_200, netflow: -1_800, reserves: 584_200 },
  { exchange: 'Coinbase',  inflow24h: 8_600,  outflow24h: 6_200,  netflow: 2_400,  reserves: 428_600 },
  { exchange: 'Kraken',    inflow24h: 2_400,  outflow24h: 3_100,  netflow: -700,   reserves: 124_800 },
  { exchange: 'OKX',       inflow24h: 5_200,  outflow24h: 4_800,  netflow: 400,    reserves: 186_400 },
  { exchange: 'Bybit',     inflow24h: 3_800,  outflow24h: 4_200,  netflow: -400,   reserves: 98_600  },
  { exchange: 'Bitfinex',  inflow24h: 1_800,  outflow24h: 2_600,  netflow: -800,   reserves: 62_400  },
];

const ONCHAIN_METRICS: OnChainMetric[] = [
  { label: 'Active Addresses (24h)',   value: '1.24M',    change: 8.5,   description: 'Unique addresses transacting' },
  { label: 'Hash Rate',               value: '486 EH/s',  change: 2.4,   description: 'Network computational power' },
  { label: 'NVT Ratio',               value: '42.8',      change: -3.2,  description: 'Network value to transactions' },
  { label: 'MVRV Z-Score',            value: '1.85',      change: 12.4,  description: 'Market value vs realized value' },
  { label: 'SOPR',                    value: '1.024',     change: 0.8,   description: 'Spent output profit ratio' },
  { label: 'Puell Multiple',          value: '0.82',      change: -5.2,  description: 'Daily miner revenue vs 365d MA' },
  { label: 'NUPL',                    value: '0.42',      change: 15.8,  description: 'Net unrealized profit/loss' },
  { label: 'Realized Cap',            value: '$425.2B',   change: 1.2,   description: 'Sum of all UTXO at last moved price' },
  { label: 'Exchange Reserves',       value: '2.38M BTC', change: -0.8,  description: 'Total BTC on exchanges' },
  { label: 'Long-Term Holder Supply', value: '14.8M BTC', change: 0.3,   description: 'Coins held >155 days' },
  { label: 'Stablecoin Supply Ratio', value: '3.42',      change: -2.1,  description: 'BTC MCap / Stablecoin MCap' },
  { label: 'Fear & Greed Index',      value: '72',        change: 8.0,   description: 'Market sentiment indicator' },
];

const KPI_DATA = [
  { label: 'BTC', value: '$43,257', change: 2.45 },
  { label: 'ETH', value: '$2,268', change: 1.92 },
  { label: 'SOL', value: '$98.42', change: 4.28 },
  { label: 'TOTAL MCAP', value: '$1.62T', change: 2.15 },
  { label: 'BTC.D', value: '52.4%', change: 0.12 },
  { label: 'DeFi TVL', value: '$82.4B', change: 1.85 },
];

/* ── Styles ────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root: { background: BG, color: TEXT, fontFamily: MONO, fontSize: 11, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  kpiStrip: { display: 'flex', gap: 1, padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  kpiItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px', borderRight: `1px solid ${BORDER}` },
  kpiLabel: { color: SUBTLE, fontSize: 9, letterSpacing: 1.2 },
  kpiValue: { fontSize: 12, fontWeight: 600 },
  tabBar: { display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  tab: { padding: '6px 16px', cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, borderBottom: '2px solid transparent', color: SUBTLE, transition: 'all .15s' },
  tabActive: { color: AMBER, borderBottomColor: AMBER },
  body: { flex: 1, overflow: 'auto', padding: 8 },
  panel: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, marginBottom: 8 },
  panelHead: { padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: 1.2, color: AMBER, textTransform: 'uppercase' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { padding: '5px 8px', textAlign: 'right' as const, color: SUBTLE, fontSize: 9, letterSpacing: 1, borderBottom: `1px solid ${BORDER}`, position: 'sticky' as const, top: 0, background: PANEL },
  thLeft: { textAlign: 'left' as const },
  td: { padding: '4px 8px', textAlign: 'right' as const, borderBottom: `1px solid ${BORDER}22` },
  tdLeft: { textAlign: 'left' as const },
  gridRow: { display: 'grid', gap: 8 },
};

/* ── Helpers ───────────────────────────────────────────────── */
function fmt(v: number, dec = 2): string { return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtB(v: number): string { if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`; if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`; return `$${(v / 1e6).toFixed(1)}M`; }
function fmtK(v: number): string { if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`; return v.toFixed(0); }
function chColor(v: number): string { return v >= 0 ? GREEN : RED; }
function chSign(v: number): string { return v >= 0 ? '+' : ''; }

/* ── KPI Strip ─────────────────────────────────────────────── */
const KPIStrip: React.FC = () => (
  <div style={S.kpiStrip}>
    {KPI_DATA.map(k => (
      <div key={k.label} style={S.kpiItem}>
        <span style={S.kpiLabel}>{k.label}</span>
        <span style={{ ...S.kpiValue, color: chColor(k.change) }}>{k.value}</span>
        <span style={{ fontSize: 10, color: chColor(k.change) }}>{chSign(k.change)}{fmt(k.change)}%</span>
      </div>
    ))}
  </div>
);

/* ── Sparkline (mini canvas) ───────────────────────────────── */
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color: string }> = ({ data, width = 80, height = 24, color }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const min = Math.min(...data); const max = Math.max(...data);
    const range = max - min || 1;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1;
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data, width, height, color]);
  return <canvas ref={ref} style={{ display: 'block' }} />;
};

/* ── Market Overview Tab ───────────────────────────────────── */
const MarketOverviewTab: React.FC = () => (
  <div>
    <div style={S.panel}>
      <div style={S.panelHead}>TOP CRYPTOCURRENCIES<span style={{ color: SUBTLE, fontSize: 9 }}>{COINS.length} assets</span></div>
      <div style={{ overflow: 'auto', maxHeight: 480 }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'center' as const, width: 30 }}>#</th>
              <th style={{ ...S.th, ...S.thLeft }}>ASSET</th>
              <th style={S.th}>PRICE</th>
              <th style={S.th}>1H</th>
              <th style={S.th}>24H</th>
              <th style={S.th}>7D</th>
              <th style={S.th}>MARKET CAP</th>
              <th style={S.th}>VOLUME 24H</th>
              <th style={S.th}>DOM %</th>
              <th style={{ ...S.th, textAlign: 'center' as const }}>7D CHART</th>
            </tr>
          </thead>
          <tbody>
            {COINS.map(c => (
              <tr key={c.symbol} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...S.td, textAlign: 'center' as const, color: SUBTLE }}>{c.rank}</td>
                <td style={{ ...S.td, ...S.tdLeft }}>
                  <span style={{ color: AMBER, fontWeight: 700 }}>{c.symbol}</span>
                  <span style={{ marginLeft: 8, color: SUBTLE }}>{c.name}</span>
                </td>
                <td style={{ ...S.td, fontWeight: 600 }}>${c.price < 1 ? c.price.toFixed(4) : fmt(c.price)}</td>
                <td style={{ ...S.td, color: chColor(c.change1h) }}>{chSign(c.change1h)}{fmt(c.change1h)}%</td>
                <td style={{ ...S.td, color: chColor(c.change24h) }}>{chSign(c.change24h)}{fmt(c.change24h)}%</td>
                <td style={{ ...S.td, color: chColor(c.change7d) }}>{chSign(c.change7d)}{fmt(c.change7d)}%</td>
                <td style={S.td}>{fmtB(c.marketCap)}</td>
                <td style={S.td}>{fmtB(c.volume24h)}</td>
                <td style={S.td}>{fmt(c.dominance, 1)}%</td>
                <td style={{ ...S.td, textAlign: 'center' as const }}>
                  <Sparkline data={c.sparkline} color={c.change7d >= 0 ? GREEN : RED} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Market stats row */}
    <div style={{ ...S.gridRow, gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {[
        { label: 'Total Market Cap', value: '$1.62T', ch: 2.15, color: GREEN },
        { label: 'Total Volume 24h', value: '$82.4B', ch: 15.8, color: BLUE },
        { label: 'BTC Dominance', value: '52.4%', ch: 0.12, color: AMBER },
        { label: 'Altcoin Season Index', value: '58/100', ch: 5.0, color: PURPLE },
      ].map(s => (
        <div key={s.label} style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 10, color: chColor(s.ch), marginTop: 2 }}>{chSign(s.ch)}{fmt(s.ch)}%</div>
        </div>
      ))}
    </div>
  </div>
);

/* ── On-Chain Analytics Tab ────────────────────────────────── */
const OnChainTab: React.FC = () => (
  <div>
    <div style={S.panel}>
      <div style={S.panelHead}>BITCOIN ON-CHAIN METRICS</div>
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {ONCHAIN_METRICS.map(m => (
          <div key={m.label} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 2, padding: 10 }}>
            <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>{m.label.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{m.value}</span>
              <span style={{ fontSize: 10, color: chColor(m.change) }}>{chSign(m.change)}{fmt(m.change, 1)}%</span>
            </div>
            <div style={{ color: SUBTLE, fontSize: 8, marginTop: 4 }}>{m.description}</div>
          </div>
        ))}
      </div>
    </div>

    {/* BTC Supply Breakdown */}
    <div style={S.panel}>
      <div style={S.panelHead}>BTC SUPPLY DISTRIBUTION</div>
      <div style={{ padding: 8 }}>
        {[
          { label: 'Exchanges', pct: 12.2, value: '2.38M', color: RED },
          { label: 'Long-Term Holders', pct: 75.8, value: '14.8M', color: GREEN },
          { label: 'Short-Term Holders', pct: 8.4, value: '1.64M', color: ORANGE },
          { label: 'Miners', pct: 1.8, value: '0.35M', color: BLUE },
          { label: 'Lost/Dormant', pct: 1.8, value: '0.35M', color: SUBTLE },
        ].map(s => (
          <div key={s.label} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: SUBTLE, fontSize: 9 }}>{s.label}</span>
              <span style={{ fontSize: 10 }}>{s.value} ({s.pct}%)</span>
            </div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2 }}>
              <div style={{ height: 4, width: `${s.pct}%`, background: s.color, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Liquidations Tab ──────────────────────────────────────── */
const LiquidationsTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longTotal = LIQUIDATIONS.filter(l => l.side === 'LONG').reduce((s, l) => s + l.size, 0);
  const shortTotal = LIQUIDATIONS.filter(l => l.side === 'SHORT').reduce((s, l) => s + l.size, 0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Bar chart of liquidations
    const pad = { top: 30, right: 20, bottom: 30, left: 60 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxSize = Math.max(...LIQUIDATIONS.map(l => l.size));

    LIQUIDATIONS.forEach((l, i) => {
      const barH = 10;
      const y = pad.top + (i / LIQUIDATIONS.length) * chartH;
      const barW = (l.size / maxSize) * chartW;
      const color = l.side === 'LONG' ? GREEN : RED;
      ctx.fillStyle = `${color}80`;
      ctx.fillRect(pad.left, y, barW, barH);
      ctx.fillStyle = SUBTLE; ctx.font = '8px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(l.symbol, pad.left - 4, y + 8);
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.font = '8px ' + MONO;
      ctx.fillText(`$${(l.size / 1e6).toFixed(2)}M ${l.side}`, pad.left + barW + 4, y + 8);
    });

    ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('LIQUIDATION HEATMAP (24h)', pad.left, pad.top - 10);
  }, []);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div>
      <div style={{ ...S.gridRow, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 8 }}>
        <div style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>TOTAL LIQUIDATIONS (24H)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: AMBER }}>${((longTotal + shortTotal) / 1e6).toFixed(1)}M</div>
        </div>
        <div style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>LONG LIQUIDATIONS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: GREEN }}>${(longTotal / 1e6).toFixed(1)}M</div>
        </div>
        <div style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>SHORT LIQUIDATIONS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>${(shortTotal / 1e6).toFixed(1)}M</div>
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>LIQUIDATION MAP</div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>RECENT LIQUIDATIONS<span style={{ color: SUBTLE, fontSize: 9 }}>LIVE FEED</span></div>
        <div style={{ overflow: 'auto', maxHeight: 300 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>TIME</th>
                <th style={S.th}>EXCHANGE</th>
                <th style={S.th}>PAIR</th>
                <th style={S.th}>SIDE</th>
                <th style={S.th}>SIZE</th>
                <th style={S.th}>PRICE</th>
              </tr>
            </thead>
            <tbody>
              {LIQUIDATIONS.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, ...S.tdLeft, color: SUBTLE }}>{l.time}</td>
                  <td style={S.td}>{l.exchange}</td>
                  <td style={{ ...S.td, color: AMBER }}>{l.symbol}</td>
                  <td style={{ ...S.td, color: l.side === 'LONG' ? GREEN : RED, fontWeight: 700 }}>{l.side}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>${fmtK(l.size)}</td>
                  <td style={S.td}>${l.price < 1 ? l.price.toFixed(4) : fmt(l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── DeFi Tab ──────────────────────────────────────────────── */
const DeFiTab: React.FC = () => {
  const totalTVL = DEFI_PROTOCOLS.reduce((s, p) => s + p.tvl, 0);
  return (
    <div>
      <div style={{ ...S.gridRow, gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 8 }}>
        {[
          { label: 'Total DeFi TVL', value: fmtB(totalTVL), color: GREEN },
          { label: 'DEX Volume 24h', value: '$4.2B', color: BLUE },
          { label: 'Stablecoin Supply', value: '$128.4B', color: AMBER },
          { label: 'Total Borrows', value: '$18.6B', color: PURPLE },
        ].map(s => (
          <div key={s.label} style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
            <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>TOP DeFi PROTOCOLS BY TVL<span style={{ color: SUBTLE, fontSize: 9 }}>{DEFI_PROTOCOLS.length} protocols</span></div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'center' as const, width: 30 }}>#</th>
                <th style={{ ...S.th, ...S.thLeft }}>PROTOCOL</th>
                <th style={S.th}>CHAIN</th>
                <th style={S.th}>CATEGORY</th>
                <th style={S.th}>TVL</th>
                <th style={S.th}>24H CHG</th>
                <th style={S.th}>APY</th>
                <th style={S.th}>% OF TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {DEFI_PROTOCOLS.map((p, i) => (
                <tr key={p.name} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...S.td, textAlign: 'center' as const, color: SUBTLE }}>{i + 1}</td>
                  <td style={{ ...S.td, ...S.tdLeft, color: AMBER, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...S.td, color: p.chain === 'Solana' ? PURPLE : p.chain === 'Arbitrum' ? BLUE : CYAN }}>{p.chain}</td>
                  <td style={{ ...S.td, color: SUBTLE }}>{p.category}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{fmtB(p.tvl)}</td>
                  <td style={{ ...S.td, color: chColor(p.change24h) }}>{chSign(p.change24h)}{fmt(p.change24h)}%</td>
                  <td style={{ ...S.td, color: p.apy > 10 ? AMBER : p.apy > 5 ? GREEN : TEXT }}>{fmt(p.apy, 1)}%</td>
                  <td style={S.td}>{fmt((p.tvl / totalTVL) * 100, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yield Opportunities */}
      <div style={S.panel}>
        <div style={S.panelHead}>YIELD OPPORTUNITIES</div>
        <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { pool: 'ETH/USDC LP', protocol: 'Uniswap v3', apy: 24.5, tvl: '$42M', risk: 'Medium' },
            { pool: 'stETH Staking', protocol: 'Lido', apy: 4.8, tvl: '$18.4B', risk: 'Low' },
            { pool: 'GLP', protocol: 'GMX', apy: 18.5, tvl: '$520M', risk: 'Medium' },
            { pool: 'PT-eETH', protocol: 'Pendle', apy: 28.4, tvl: '$1.2B', risk: 'High' },
            { pool: 'USDC Lending', protocol: 'AAVE v3', apy: 5.2, tvl: '$4.8B', risk: 'Low' },
            { pool: 'SOL Staking', protocol: 'Jito', apy: 7.2, tvl: '$1.8B', risk: 'Low' },
          ].map(y => (
            <div key={y.pool} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 2, padding: 10 }}>
              <div style={{ color: AMBER, fontWeight: 600, marginBottom: 2 }}>{y.pool}</div>
              <div style={{ color: SUBTLE, fontSize: 9, marginBottom: 6 }}>{y.protocol}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: GREEN, fontSize: 14, fontWeight: 700 }}>{fmt(y.apy, 1)}% APY</span>
                <span style={{ color: y.risk === 'Low' ? GREEN : y.risk === 'Medium' ? AMBER : RED, fontSize: 9, padding: '1px 6px', border: `1px solid`, borderRadius: 2 }}>{y.risk}</span>
              </div>
              <div style={{ color: SUBTLE, fontSize: 9, marginTop: 4 }}>TVL: {y.tvl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Exchange Flows Tab ────────────────────────────────────── */
const ExchangeFlowsTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 250;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...EXCHANGE_FLOWS.map(f => Math.max(f.inflow24h, f.outflow24h)));
    const barH = chartH / EXCHANGE_FLOWS.length * 0.7;
    const gap = chartH / EXCHANGE_FLOWS.length * 0.3;

    EXCHANGE_FLOWS.forEach((f, i) => {
      const y = pad.top + i * (barH + gap + gap / 2);
      // Inflow bar
      const inflowW = (f.inflow24h / maxVal) * chartW * 0.8;
      ctx.fillStyle = `${GREEN}80`;
      ctx.fillRect(pad.left, y, inflowW, barH / 2);
      // Outflow bar
      const outflowW = (f.outflow24h / maxVal) * chartW * 0.8;
      ctx.fillStyle = `${RED}80`;
      ctx.fillRect(pad.left, y + barH / 2, outflowW, barH / 2);
      // Label
      ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(f.exchange, pad.left - 4, y + barH / 2 + 3);
      // Net flow
      ctx.fillStyle = f.netflow >= 0 ? RED : GREEN;
      ctx.textAlign = 'left'; ctx.font = '9px ' + MONO;
      ctx.fillText(`Net: ${f.netflow >= 0 ? '+' : ''}${fmtK(f.netflow)} BTC`, Math.max(inflowW, outflowW) + pad.left + 8, y + barH / 2 + 3);
    });

    // Legend
    ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('BTC EXCHANGE FLOWS (24h)', pad.left, pad.top - 10);
    // Legend items
    ctx.fillStyle = `${GREEN}80`; ctx.fillRect(W - 200, pad.top - 16, 10, 10);
    ctx.fillStyle = TEXT; ctx.font = '9px ' + MONO; ctx.fillText('Inflow', W - 186, pad.top - 7);
    ctx.fillStyle = `${RED}80`; ctx.fillRect(W - 120, pad.top - 16, 10, 10);
    ctx.fillStyle = TEXT; ctx.fillText('Outflow', W - 106, pad.top - 7);
  }, []);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelHead}>EXCHANGE FLOW ANALYSIS</div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>EXCHANGE RESERVES (BTC)</div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>EXCHANGE</th>
                <th style={S.th}>INFLOW (24h)</th>
                <th style={S.th}>OUTFLOW (24h)</th>
                <th style={S.th}>NET FLOW</th>
                <th style={S.th}>RESERVES</th>
                <th style={S.th}>SIGNAL</th>
              </tr>
            </thead>
            <tbody>
              {EXCHANGE_FLOWS.map(f => (
                <tr key={f.exchange}>
                  <td style={{ ...S.td, ...S.tdLeft, color: AMBER }}>{f.exchange}</td>
                  <td style={{ ...S.td, color: GREEN }}>{fmtK(f.inflow24h)}</td>
                  <td style={{ ...S.td, color: RED }}>{fmtK(f.outflow24h)}</td>
                  <td style={{ ...S.td, color: chColor(-f.netflow), fontWeight: 700 }}>
                    {f.netflow >= 0 ? '+' : ''}{fmtK(f.netflow)}
                  </td>
                  <td style={S.td}>{fmtK(f.reserves)}</td>
                  <td style={{ ...S.td, color: f.netflow < 0 ? GREEN : RED }}>
                    {f.netflow < 0 ? '● BULLISH' : '● BEARISH'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stablecoin Flows */}
      <div style={S.panel}>
        <div style={S.panelHead}>STABLECOIN EXCHANGE FLOWS</div>
        <div style={{ padding: 8 }}>
          {[
            { name: 'USDT', inflow: 842, outflow: 624, supply: '91.4B' },
            { name: 'USDC', inflow: 425, outflow: 318, supply: '24.8B' },
            { name: 'DAI', inflow: 86, outflow: 102, supply: '5.2B' },
            { name: 'BUSD', inflow: 24, outflow: 45, supply: '2.8B' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', borderBottom: `1px solid ${BORDER}22` }}>
              <span style={{ color: AMBER, width: 50 }}>{s.name}</span>
              <span style={{ color: GREEN, width: 100 }}>↓ ${s.inflow}M</span>
              <span style={{ color: RED, width: 100 }}>↑ ${s.outflow}M</span>
              <span style={{ color: chColor(s.inflow - s.outflow), width: 100 }}>Net: ${s.inflow - s.outflow > 0 ? '+' : ''}{s.inflow - s.outflow}M</span>
              <span style={{ color: SUBTLE }}>Supply: ${s.supply}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Derivatives Tab ───────────────────────────────────────── */
const DerivativesTab: React.FC = () => (
  <div>
    <div style={{ ...S.gridRow, gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 8 }}>
      {[
        { label: 'BTC Open Interest', value: '$18.4B', ch: 3.2 },
        { label: 'ETH Open Interest', value: '$8.6B', ch: 5.4 },
        { label: 'Funding Rate (BTC)', value: '0.012%', ch: 0 },
        { label: 'Perps Volume 24h', value: '$62.4B', ch: 12.8 },
      ].map(s => (
        <div key={s.label} style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>{s.label.toUpperCase()}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: AMBER }}>{s.value}</div>
          {s.ch !== 0 && <div style={{ fontSize: 10, color: chColor(s.ch), marginTop: 2 }}>{chSign(s.ch)}{fmt(s.ch)}%</div>}
        </div>
      ))}
    </div>

    <div style={S.panel}>
      <div style={S.panelHead}>PERPETUAL FUTURES — FUNDING RATES</div>
      <div style={{ overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>PAIR</th>
              <th style={S.th}>BINANCE</th>
              <th style={S.th}>BYBIT</th>
              <th style={S.th}>OKX</th>
              <th style={S.th}>dYdX</th>
              <th style={S.th}>OI (TOTAL)</th>
              <th style={S.th}>LONG/SHORT</th>
            </tr>
          </thead>
          <tbody>
            {[
              { pair: 'BTC/USDT', rates: [0.012, 0.010, 0.015, 0.008], oi: '$18.4B', ls: '52/48' },
              { pair: 'ETH/USDT', rates: [0.008, 0.006, 0.012, 0.005], oi: '$8.6B', ls: '54/46' },
              { pair: 'SOL/USDT', rates: [0.024, 0.020, 0.028, 0.018], oi: '$2.8B', ls: '58/42' },
              { pair: 'BNB/USDT', rates: [0.005, 0.004, 0.006, 0.003], oi: '$1.4B', ls: '50/50' },
              { pair: 'AVAX/USDT', rates: [0.018, 0.015, 0.022, 0.012], oi: '$680M', ls: '56/44' },
              { pair: 'LINK/USDT', rates: [0.010, 0.008, 0.014, 0.006], oi: '$420M', ls: '53/47' },
              { pair: 'ARB/USDT', rates: [0.032, 0.028, 0.035, 0.024], oi: '$380M', ls: '62/38' },
              { pair: 'OP/USDT', rates: [0.028, 0.024, 0.030, 0.020], oi: '$320M', ls: '60/40' },
            ].map(r => (
              <tr key={r.pair}>
                <td style={{ ...S.td, ...S.tdLeft, color: AMBER }}>{r.pair}</td>
                {r.rates.map((rate, i) => (
                  <td key={i} style={{ ...S.td, color: rate > 0.015 ? AMBER : rate > 0 ? GREEN : RED }}>{fmt(rate, 3)}%</td>
                ))}
                <td style={S.td}>{r.oi}</td>
                <td style={S.td}>
                  <span style={{ color: GREEN }}>{r.ls.split('/')[0]}</span>/
                  <span style={{ color: RED }}>{r.ls.split('/')[1]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div style={S.panel}>
      <div style={S.panelHead}>OPTIONS OVERVIEW</div>
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'BTC Options OI', value: '$12.8B', sub: 'Deribit dominant' },
          { label: 'Max Pain (BTC)', value: '$42,000', sub: 'Dec 29 expiry' },
          { label: 'Put/Call Ratio', value: '0.62', sub: 'Bullish bias' },
          { label: 'ETH Options OI', value: '$5.4B', sub: 'Growing rapidly' },
          { label: 'BTC 25Δ Skew', value: '-2.8%', sub: 'Calls premium' },
          { label: 'BTC IV (ATM 30d)', value: '48.5%', sub: 'vs 42% RV' },
        ].map(o => (
          <div key={o.label} style={{ textAlign: 'center' }}>
            <div style={{ color: SUBTLE, fontSize: 9 }}>{o.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>{o.value}</div>
            <div style={{ color: SUBTLE, fontSize: 8, marginTop: 2 }}>{o.sub}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main Component ────────────────────────────────────────── */
const TABS = ['MARKET', 'ON-CHAIN', 'LIQUIDATIONS', 'DeFi', 'FLOWS', 'DERIVATIVES'] as const;
type Tab = typeof TABS[number];

export default function CryptoUI2() {
  const [tab, setTab] = useState<Tab>('MARKET');

  return (
    <div style={S.root}>
      <KPIStrip />
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={S.body}>
        {tab === 'MARKET' && <MarketOverviewTab />}
        {tab === 'ON-CHAIN' && <OnChainTab />}
        {tab === 'LIQUIDATIONS' && <LiquidationsTab />}
        {tab === 'DeFi' && <DeFiTab />}
        {tab === 'FLOWS' && <ExchangeFlowsTab />}
        {tab === 'DERIVATIVES' && <DerivativesTab />}
      </div>
    </div>
  );
}
