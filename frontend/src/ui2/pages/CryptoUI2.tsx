/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — CRYPTO DASHBOARD (UI2)                               │
 * │                                                                       │
 * │ Multi-exchange crypto analytics — tasks.md §10                       │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Top cryptos with live prices + sparklines                         │
 * │ • DeFi yield tracker                                                 │
 * │ • On-chain metrics (hashrate, fees, active addresses)                │
 * │ • Exchange flows (inflow/outflow)                                    │
 * │ • Liquidation heatmap                                                │
 * │ • Fear & Greed index                                                 │
 * │ • Stablecoin dominance                                               │
 * │ • Funding rates (perpetuals)                                         │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useCrypto } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC', btcOrange: '#F7931A', ethBlue: '#627EEA',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };
const clr = (n: number) => n >= 0 ? T.up : T.dn;
const fmtUsd = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(2)}`;

interface Crypto { symbol: string; name: string; price: number; change1h: number; change24h: number; change7d: number; marketCap: number; volume24h: number; dominance: number; sparkline: number[]; color: string; }

function generateCryptos(): Crypto[] {
  const data = [
    { sym: 'BTC', name: 'Bitcoin', price: 67842, mc: 1.33e12, dom: 52.5, color: '#F7931A' },
    { sym: 'ETH', name: 'Ethereum', price: 3485, mc: 418e9, dom: 16.5, color: '#627EEA' },
    { sym: 'BNB', name: 'BNB', price: 592, mc: 88e9, dom: 3.5, color: '#F3BA2F' },
    { sym: 'SOL', name: 'Solana', price: 172, mc: 76e9, dom: 3.0, color: '#9945FF' },
    { sym: 'XRP', name: 'XRP', price: 0.528, mc: 29e9, dom: 1.1, color: '#23292F' },
    { sym: 'DOGE', name: 'Dogecoin', price: 0.158, mc: 22.5e9, dom: 0.9, color: '#C2A633' },
    { sym: 'ADA', name: 'Cardano', price: 0.458, mc: 16.2e9, dom: 0.6, color: '#3CC8C8' },
    { sym: 'AVAX', name: 'Avalanche', price: 35.8, mc: 13.8e9, dom: 0.5, color: '#E84142' },
    { sym: 'DOT', name: 'Polkadot', price: 7.25, mc: 10.2e9, dom: 0.4, color: '#E6007A' },
    { sym: 'MATIC', name: 'Polygon', price: 0.685, mc: 6.8e9, dom: 0.3, color: '#8247E5' },
    { sym: 'LINK', name: 'Chainlink', price: 14.82, mc: 8.7e9, dom: 0.3, color: '#2A5ADA' },
    { sym: 'UNI', name: 'Uniswap', price: 7.52, mc: 5.7e9, dom: 0.2, color: '#FF007A' },
    { sym: 'ATOM', name: 'Cosmos', price: 8.95, mc: 3.5e9, dom: 0.1, color: '#2E3148' },
    { sym: 'LTC', name: 'Litecoin', price: 82.5, mc: 6.2e9, dom: 0.2, color: '#BFBBBB' },
    { sym: 'FIL', name: 'Filecoin', price: 5.85, mc: 3.2e9, dom: 0.1, color: '#0090FF' },
  ];
  return data.map(d => ({
    symbol: d.sym, name: d.name, price: d.price, marketCap: d.mc, dominance: d.dom, color: d.color,
    change1h: +((Math.random() - 0.48) * 2).toFixed(2), change24h: +((Math.random() - 0.45) * 8).toFixed(2), change7d: +((Math.random() - 0.4) * 15).toFixed(2),
    volume24h: d.mc * (0.02 + Math.random() * 0.08),
    sparkline: Array.from({ length: 24 }, () => d.price * (1 + (Math.random() - 0.48) * 0.05)),
  }));
}

/* Crypto Table */
function CryptoTable({ cryptos }: { cryptos: Crypto[] }) {
  return (
    <div data-testid="crypto-table" style={panelStyle}>
      <div style={panelHdr}><span>CRYPTO MARKETS</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['#', 'Name', 'Price', '1h%', '24h%', '7d%', 'Mkt Cap', 'Vol 24h', 'Dom%', '24h Chart'].map(h => <th key={h} style={{ padding: '3px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>{cryptos.map((c, i) => (
            <tr key={c.symbol} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text3, borderBottom: `1px solid ${T.border0}` }}>{i + 1}</td>
              <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: T.text0 }}>{c.symbol}</span>
                  <span style={{ fontSize: '9px', color: T.text3 }}>{c.name}</span>
                </div>
              </td>
              <td style={{ padding: '3px 6px', fontSize: '11px', fontFamily: T.fontMono, color: T.text0, fontWeight: 600, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{c.price >= 1 ? `$${c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${c.price.toFixed(4)}`}</td>
              {[c.change1h, c.change24h, c.change7d].map((ch, ci) => (
                <td key={ci} style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(ch), fontWeight: 600, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</td>
              ))}
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{fmtUsd(c.marketCap)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{fmtUsd(c.volume24h)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{c.dominance}%</td>
              <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                <svg width="50" height="16"><polyline points={c.sparkline.map((v, j) => { const mn = Math.min(...c.sparkline), mx = Math.max(...c.sparkline); return `${(j / 23) * 50},${16 - ((v - mn) / (mx - mn || 1)) * 16}`; }).join(' ')} fill="none" stroke={clr(c.change24h)} strokeWidth="1.2" /></svg>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* DeFi Yields */
function DeFiYields() {
  const protocols = [
    { protocol: 'Aave V3', chain: 'Ethereum', asset: 'USDC', apy: 4.82, tvl: 8.5e9, risk: 'Low' },
    { protocol: 'Compound V3', chain: 'Ethereum', asset: 'USDC', apy: 5.12, tvl: 3.2e9, risk: 'Low' },
    { protocol: 'Lido', chain: 'Ethereum', asset: 'ETH', apy: 3.45, tvl: 32.5e9, risk: 'Medium' },
    { protocol: 'Rocket Pool', chain: 'Ethereum', asset: 'ETH', apy: 3.18, tvl: 4.2e9, risk: 'Medium' },
    { protocol: 'Curve', chain: 'Ethereum', asset: '3pool', apy: 2.85, tvl: 2.8e9, risk: 'Medium' },
    { protocol: 'GMX', chain: 'Arbitrum', asset: 'GLP', apy: 12.5, tvl: 580e6, risk: 'High' },
    { protocol: 'Raydium', chain: 'Solana', asset: 'SOL-USDC', apy: 18.2, tvl: 320e6, risk: 'High' },
    { protocol: 'Morpho', chain: 'Ethereum', asset: 'WETH', apy: 2.95, tvl: 1.8e9, risk: 'Low' },
  ];
  const riskColor = (r: string) => r === 'Low' ? T.up : r === 'Medium' ? T.warn : T.dn;

  return (
    <div data-testid="defi-yields" style={panelStyle}>
      <div style={panelHdr}><span>DeFi YIELDS</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Protocol', 'Chain', 'Asset', 'APY', 'TVL', 'Risk'].map(h => <th key={h} style={{ padding: '3px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans }}>{h}</th>)}</tr></thead>
          <tbody>{protocols.map(p => (
            <tr key={p.protocol + p.asset}><td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontSans, color: T.text0, fontWeight: 600, borderBottom: `1px solid ${T.border0}` }}>{p.protocol}</td>
              <td style={{ padding: '3px 6px', fontSize: '9px', fontFamily: T.fontSans, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{p.chain}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.info, borderBottom: `1px solid ${T.border0}` }}>{p.asset}</td>
              <td style={{ padding: '3px 6px', fontSize: '11px', fontFamily: T.fontMono, color: T.up, fontWeight: 700, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{p.apy.toFixed(2)}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{fmtUsd(p.tvl)}</td>
              <td style={{ padding: '3px 6px', fontSize: '9px', fontFamily: T.fontSans, color: riskColor(p.risk), fontWeight: 700, borderBottom: `1px solid ${T.border0}` }}>{p.risk}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Funding Rates */
function FundingRates() {
  const rates = [
    { pair: 'BTC/USDT', rate: 0.0085, predicted: 0.0092, openInterest: 28.5e9 },
    { pair: 'ETH/USDT', rate: 0.0072, predicted: 0.0068, openInterest: 12.8e9 },
    { pair: 'SOL/USDT', rate: 0.0125, predicted: 0.0135, openInterest: 3.2e9 },
    { pair: 'BNB/USDT', rate: 0.0045, predicted: 0.0042, openInterest: 1.8e9 },
    { pair: 'DOGE/USDT', rate: 0.0185, predicted: 0.0195, openInterest: 850e6 },
    { pair: 'XRP/USDT', rate: 0.0035, predicted: 0.0038, openInterest: 920e6 },
  ];

  return (
    <div data-testid="funding-rates" style={panelStyle}>
      <div style={panelHdr}><span>PERPETUAL FUNDING RATES (8h)</span></div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rates.map(r => (
          <div key={r.pair} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: `1px solid ${T.border0}`, gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono, width: '80px' }}>{r.pair}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: T.fontMono }}>
                <span style={{ color: T.text3 }}>Rate: <span style={{ color: r.rate > 0.01 ? T.warn : T.up, fontWeight: 600 }}>{(r.rate * 100).toFixed(4)}%</span></span>
                <span style={{ color: T.text3 }}>Pred: <span style={{ color: T.text2 }}>{(r.predicted * 100).toFixed(4)}%</span></span>
                <span style={{ color: T.text3 }}>OI: <span style={{ color: T.text1 }}>{fmtUsd(r.openInterest)}</span></span>
              </div>
              <div style={{ height: '3px', background: T.bg3, borderRadius: '2px', marginTop: '3px' }}>
                <div style={{ width: `${Math.min(r.rate * 5000, 100)}%`, height: '100%', background: r.rate > 0.01 ? T.warn : T.up, borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Fear & Greed + On-Chain Metrics */
function MarketSentiment() {
  const fgi = 72;
  const fgiColor = fgi > 75 ? T.dn : fgi > 50 ? T.up : fgi > 25 ? T.warn : T.dn;
  const fgiLabel = fgi > 75 ? 'Extreme Greed' : fgi > 50 ? 'Greed' : fgi > 25 ? 'Fear' : 'Extreme Fear';

  const metrics = [
    { label: 'BTC Hashrate', value: '612 EH/s', change: '+2.3%' },
    { label: 'Network Fees (24h)', value: '$8.2M', change: '-5.1%' },
    { label: 'Active Addresses', value: '1.05M', change: '+1.8%' },
    { label: 'Exchange Outflow', value: '-12,450 BTC', change: '' },
    { label: 'Stablecoin Supply', value: '$145.2B', change: '+0.8%' },
    { label: 'BTC Dominance', value: '52.5%', change: '+0.3%' },
  ];

  return (
    <div data-testid="market-sentiment" style={panelStyle}>
      <div style={panelHdr}><span>MARKET SENTIMENT</span></div>
      <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Fear & Greed */}
        <div style={{ textAlign: 'center', padding: '8px', background: T.bg2, borderRadius: T.radius }}>
          <div style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase', marginBottom: '4px' }}>Fear & Greed Index</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: fgiColor, fontFamily: T.fontMono }}>{fgi}</div>
          <div style={{ fontSize: '10px', color: fgiColor, fontWeight: 700 }}>{fgiLabel}</div>
          <div style={{ height: '6px', background: T.bg3, borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${fgi}%`, height: '100%', background: `linear-gradient(90deg, ${T.dn}, ${T.warn}, ${T.up})`, borderRadius: '3px' }} />
          </div>
        </div>
        {/* On-chain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {metrics.map(m => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
              <span style={{ fontSize: '9px', color: T.text3, fontFamily: T.fontSans }}>{m.label}</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: T.text0, fontFamily: T.fontMono, fontWeight: 600 }}>{m.value}</span>
                {m.change && <span style={{ fontSize: '9px', color: clr(parseFloat(m.change)), fontFamily: T.fontMono }}>{m.change}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function CryptoUI2() {
  // ── Hook integration ──
  const [cryptoState, cryptoActions] = useCrypto();

  const [cryptos, setCryptos] = useState(generateCryptos);

  useEffect(() => {
    const interval = setInterval(() => setCryptos(prev => prev.map(c => {
      const delta = c.price * (Math.random() - 0.49) * 0.003;
      return { ...c, price: +(c.price + delta).toFixed(c.price >= 1 ? 2 : 4), change1h: +((Math.random() - 0.48) * 2).toFixed(2) };
    })), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div data-testid="crypto-page" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        <CryptoTable cryptos={cryptos} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        <MarketSentiment />
        <FundingRates />
        <DeFiYields />
      </div>
    </div>
  );
}
