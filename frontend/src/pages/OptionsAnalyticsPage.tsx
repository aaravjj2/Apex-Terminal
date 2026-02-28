/**
 * OptionsAnalyticsPage.tsx
 * Options analytics hub — gamma exposure, delta/gamma dashboard,
 * put/call analysis, 0DTE flow, unusual activity scanner, options chain,
 * GEX visualization, skew chart, and term structure.
 */

import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionsTab = 'gex' | 'chain' | 'flow' | 'skew' | 'term' | 'scanner' | 'positions';

interface OptionsStrike {
  strike: number;
  call_iv: number;
  put_iv: number;
  call_delta: number;
  put_delta: number;
  call_gamma: number;
  put_gamma: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  call_bid: number;
  call_ask: number;
  put_bid: number;
  put_ask: number;
  net_gex: number;     // gamma exposure
  itm: boolean;
}

interface UnusualActivity {
  time: string;
  ticker: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  volume: number;
  oi: number;
  vol_oi_ratio: number;
  premium: number;
  condition: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
}

interface GreeksSummary {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  charm: number;
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

function generateChain(spot: number): OptionsStrike[] {
  const strikes = [];
  for (let k = spot * 0.85; k <= spot * 1.15; k += spot * 0.01) {
    const rounded = Math.round(k / 5) * 5;
    const moneyness = rounded / spot;
    const baseIV = 0.18 + Math.abs(Math.log(moneyness)) * 1.2; // Vol smile
    const d = (Math.log(spot / rounded) + 0.5 * baseIV ** 2) / baseIV;
    const callDelta = Math.max(0.01, Math.min(0.99, 0.5 + d * 0.3));
    const putDelta = callDelta - 1;
    const gamma = Math.exp(-0.5 * d * d) / (spot * baseIV * Math.sqrt(2 * Math.PI));
    strikes.push({
      strike: rounded,
      call_iv: baseIV + (moneyness > 1 ? 0 : 0.02),
      put_iv: baseIV + (moneyness < 1 ? 0.01 : 0),
      call_delta: callDelta,
      put_delta: putDelta,
      call_gamma: gamma,
      put_gamma: gamma,
      call_oi: Math.round(Math.random() * 50000 + 1000),
      put_oi: Math.round(Math.random() * 60000 + 1000),
      call_volume: Math.round(Math.random() * 20000),
      put_volume: Math.round(Math.random() * 25000),
      call_bid: Math.max(0.01, (callDelta * spot * baseIV * 0.4).toFixed(2) as any),
      call_ask: Math.max(0.05, (callDelta * spot * baseIV * 0.42).toFixed(2) as any),
      put_bid: Math.max(0.01, ((-putDelta) * spot * baseIV * 0.4).toFixed(2) as any),
      put_ask: Math.max(0.05, ((-putDelta) * spot * baseIV * 0.42).toFixed(2) as any),
      net_gex: (Math.random() > 0.5 ? 1 : -1) * gamma * (Math.random() * 100 + 10) * spot,
      itm: moneyness < 1,
    });
  }
  return strikes;
}

const UNUSUAL_ACTIVITY: UnusualActivity[] = [
  { time: '14:32', ticker: 'SPY', type: 'CALL', strike: 490, expiry: '2024-02-16', volume: 48200, oi: 12400, vol_oi_ratio: 3.9, premium: 2840000, condition: 'SWEEP', sentiment: 'BULLISH', score: 94 },
  { time: '14:28', ticker: 'QQQ', type: 'PUT', strike: 415, expiry: '2024-02-09', volume: 32100, oi: 8900, vol_oi_ratio: 3.6, premium: 1920000, condition: 'BLOCK', sentiment: 'BEARISH', score: 88 },
  { time: '14:15', ticker: 'NVDA', type: 'CALL', strike: 650, expiry: '2024-02-16', volume: 18400, oi: 4200, vol_oi_ratio: 4.4, premium: 3100000, condition: 'SWEEP', sentiment: 'BULLISH', score: 91 },
  { time: '13:56', ticker: 'TSLA', type: 'PUT', strike: 190, expiry: '2024-02-23', volume: 22600, oi: 14500, vol_oi_ratio: 1.6, premium: 1450000, condition: 'CROSSING', sentiment: 'BEARISH', score: 72 },
  { time: '13:41', ticker: 'AAPL', type: 'CALL', strike: 195, expiry: '2024-03-15', volume: 14800, oi: 28900, vol_oi_ratio: 0.5, premium: 890000, condition: 'SPLIT', sentiment: 'NEUTRAL', score: 65 },
  { time: '13:22', ticker: 'META', type: 'CALL', strike: 510, expiry: '2024-02-16', volume: 9400, oi: 1200, vol_oi_ratio: 7.8, premium: 2100000, condition: 'SWEEP', sentiment: 'BULLISH', score: 96 },
  { time: '12:48', ticker: 'IWM', type: 'PUT', strike: 190, expiry: '2024-02-02', volume: 41200, oi: 56800, vol_oi_ratio: 0.7, premium: 1240000, condition: '0DTE', sentiment: 'BEARISH', score: 78 },
];

const MARKET_PORTFOLIO_GREEKS: GreeksSummary = {
  delta: 1_842_000,
  gamma: 124_600,
  theta: -48_200,
  vega: 284_000,
  rho: 42_100,
  charm: -18_400,
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface GEXBarProps {
  chain: OptionsStrike[];
  spot: number;
}

const GEXChart: React.FC<GEXBarProps> = ({ chain, spot }) => {
  const width = 640, height = 240;
  const ML = 48, MR = 16, MT = 16, MB = 36;
  const innerW = width - ML - MR;
  const innerH = height - MT - MB;

  const maxGEX = Math.max(...chain.map(s => Math.abs(s.net_gex)));
  const xDomain = [chain[0].strike, chain[chain.length - 1].strike];
  const xScale = (k: number) => ML + ((k - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW;
  const yScale = (g: number) => MT + (1 - (g + maxGEX) / (2 * maxGEX)) * innerH;
  const barW = Math.max(2, (innerW / chain.length) - 1);

  return (
    <svg width={width} height={height} style={{ fontFamily: 'monospace' }}>
      {/* Zero line */}
      <line x1={ML} y1={yScale(0)} x2={ML + innerW} y2={yScale(0)} stroke="#2a3a4a" strokeWidth={1} />
      {/* Spot price */}
      <line x1={xScale(spot)} y1={MT} x2={xScale(spot)} y2={MT + innerH} stroke="#ffcc00" strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={xScale(spot) + 3} y={MT + 12} fill="#ffcc00" fontSize={9}>SPOT {spot}</text>
      {/* GEX bars */}
      {chain.map((s, i) => {
        const barH = Math.abs(yScale(s.net_gex) - yScale(0));
        const posBar = s.net_gex >= 0;
        return (
          <rect
            key={i}
            x={xScale(s.strike) - barW / 2}
            y={posBar ? yScale(s.net_gex) : yScale(0)}
            width={barW}
            height={barH}
            fill={posBar ? '#00d4aa' : '#ff4466'}
            opacity={0.8}
          />
        );
      })}
      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT + innerH} stroke="#2a3a4a" />
      <line x1={ML} y1={MT + innerH} x2={ML + innerW} y2={MT + innerH} stroke="#2a3a4a" />
      {chain.filter((_, i) => i % Math.max(1, Math.floor(chain.length / 8)) === 0).map((s, i) => (
        <text key={i} x={xScale(s.strike)} y={MT + innerH + 14} textAnchor="middle" fill="#555" fontSize={8}>{s.strike}</text>
      ))}
      <text x={width / 2} y={height - 4} textAnchor="middle" fill="#444" fontSize={9}>Strike</text>
      <text x={8} y={MT + innerH / 2} textAnchor="middle" fill="#444" fontSize={8} transform={`rotate(-90,8,${MT + innerH / 2})`}>GEX</text>
    </svg>
  );
};

// Options Chain Table
interface ChainTableProps {
  chain: OptionsStrike[];
  spot: number;
}

const ChainTable: React.FC<ChainTableProps> = ({ chain, spot }) => {
  const [sortBy, setSortBy] = useState<string>('strike');
  const [expiry] = useState('2024-02-16');

  return (
    <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10. }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <tr style={{ background: '#060e18' }}>
            <th colSpan={7} style={{ padding: '6px 10px', color: '#4a9eff', textAlign: 'center', borderBottom: '1px solid #1a2a38' }}>CALLS</th>
            <th style={{ padding: '6px 10px', color: '#ffcc00', textAlign: 'center', background: '#0a1628', borderBottom: '1px solid #1a2a38' }}>STRIKE</th>
            <th colSpan={7} style={{ padding: '6px 10px', color: '#ff4466', textAlign: 'center', borderBottom: '1px solid #1a2a38' }}>PUTS</th>
          </tr>
          <tr style={{ background: '#060e18' }}>
            {['OI', 'Vol', 'IV', 'Delta', 'Gamma', 'Bid', 'Ask', 'K', 'Bid', 'Ask', 'IV', 'Delta', 'Gamma', 'Vol', 'OI'].map((h, i) => (
              <th key={i} style={{
                padding: '5px 8px', color: '#555', fontSize: 8, fontWeight: 'bold',
                textAlign: i < 7 ? 'right' : i === 7 ? 'center' : 'left',
                borderBottom: '1px solid #1a2a38',
                background: i === 7 ? '#0a1628' : 'transparent',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chain.map((s, i) => {
            const isATM = Math.abs(s.strike - spot) < spot * 0.005;
            const rowBg = isATM ? '#14243844' : i % 2 === 0 ? 'transparent' : '#0a161e22';
            return (
              <tr key={i} style={{ background: rowBg, borderBottom: '1px solid #0a1628' }}>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#888' }}>{s.call_oi.toLocaleString()}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: s.call_volume > 10000 ? '#4a9eff' : '#666' }}>{s.call_volume.toLocaleString()}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#aaa' }}>{(s.call_iv * 100).toFixed(1)}%</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#4a9eff' }}>{s.call_delta.toFixed(3)}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#666' }}>{s.call_gamma.toFixed(4)}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#ddd' }}>{typeof s.call_bid === 'number' ? s.call_bid.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#ddd' }}>{typeof s.call_ask === 'number' ? s.call_ask.toFixed(2) : '—'}</td>
                {/* Strike */}
                <td style={{
                  padding: '3px 12px', textAlign: 'center', fontWeight: 'bold',
                  color: isATM ? '#ffcc00' : s.strike < spot ? '#4a9eff' : '#888',
                  background: '#0a1628',
                  borderLeft: '1px solid #1a2a38', borderRight: '1px solid #1a2a38',
                }}>{s.strike}</td>
                {/* Puts */}
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#ddd' }}>{typeof s.put_bid === 'number' ? s.put_bid.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#ddd' }}>{typeof s.put_ask === 'number' ? s.put_ask.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#aaa' }}>{(s.put_iv * 100).toFixed(1)}%</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#ff4466' }}>{s.put_delta.toFixed(3)}</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#666' }}>{s.put_gamma.toFixed(4)}</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: s.put_volume > 10000 ? '#ff4466' : '#666' }}>{s.put_volume.toLocaleString()}</td>
                <td style={{ padding: '3px 8px', textAlign: 'left', color: '#888' }}>{s.put_oi.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Flow Scanner
const FlowScanner: React.FC = () => {
  const sentColor = (s: string) => s === 'BULLISH' ? '#00d4aa' : s === 'BEARISH' ? '#ff4466' : '#888';
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {[
          { label: 'Bullish Sweeps', value: 42, color: '#00d4aa' },
          { label: 'Bearish Sweeps', value: 28, color: '#ff4466' },
          { label: 'Total Premium', value: '$18.4M', color: '#4a9eff' },
          { label: '0DTE Volume', value: '2.1M', color: '#ffcc00' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '6px 12px' }}>
            <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {UNUSUAL_ACTIVITY.map((a, i) => (
          <div key={i} style={{
            background: '#0e1c2e', borderLeft: `3px solid ${sentColor(a.sentiment)}`,
            borderRadius: '0 4px 4px 0', padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', width: 36 }}>{a.time}</span>
            <span style={{ color: '#4a9eff', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace', width: 40 }}>{a.ticker}</span>
            <span style={{
              color: a.type === 'CALL' ? '#4a9eff' : '#ff4466', fontSize: 9,
              background: a.type === 'CALL' ? '#4a9eff22' : '#ff446622',
              padding: '1px 5px', borderRadius: 2, fontFamily: 'monospace', width: 32,
            }}>{a.type}</span>
            <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace', width: 40 }}>{a.strike} {a.expiry.substring(5)}</span>
            <span style={{ color: '#ddd', fontSize: 9, fontFamily: 'monospace', width: 52 }}>Vol: {(a.volume / 1000).toFixed(1)}K</span>
            <span style={{ color: '#ddd', fontSize: 9, fontFamily: 'monospace', width: 68 }}>Prem: ${(a.premium / 1e6).toFixed(2)}M</span>
            <span style={{
              color: '#888', fontSize: 9, fontFamily: 'monospace',
              background: '#1a2a38', padding: '1px 5px', borderRadius: 2, width: 48,
            }}>{a.condition}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 40, height: 4, background: '#0a1628', borderRadius: 2 }}>
                <div style={{ width: `${a.score}%`, height: 4, background: sentColor(a.sentiment), borderRadius: 2 }} />
              </div>
              <span style={{ color: sentColor(a.sentiment), fontSize: 9, fontFamily: 'monospace' }}>{a.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Greeks Dashboard
const GreeksDashboard: React.FC = () => {
  const greeks = MARKET_PORTFOLIO_GREEKS;
  const items = [
    { label: 'Delta ($)', value: `$${greeks.delta.toLocaleString()}`, description: 'Portfolio exposure to underlying price change', color: '#4a9eff' },
    { label: 'Gamma ($)', value: `$${greeks.gamma.toLocaleString()}`, description: 'Rate of change of delta per $1 move', color: '#00d4aa' },
    { label: 'Theta ($/day)', value: `-$${Math.abs(greeks.theta).toLocaleString()}`, description: 'Time decay cost per day', color: '#ff4466' },
    { label: 'Vega ($)', value: `$${greeks.vega.toLocaleString()}`, description: 'P&L per 1% change in IV', color: '#ff9900' },
    { label: 'Rho ($)', value: `$${greeks.rho.toLocaleString()}`, description: 'P&L per 1% change in rates', color: '#cc44ff' },
    { label: 'Charm ($/day)', value: `-$${Math.abs(greeks.charm).toLocaleString()}`, description: 'Rate of change of delta per day', color: '#ffcc00' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {items.map((g, i) => (
        <div key={i} style={{
          background: '#0e1c2e', border: `1px solid ${g.color}33`,
          borderRadius: 6, padding: '12px 16px', minWidth: 160,
        }}>
          <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginBottom: 6 }}>{g.label}</div>
          <div style={{ color: g.color, fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 4 }}>{g.value}</div>
          <div style={{ color: '#444', fontSize: 8, fontFamily: 'monospace' }}>{g.description}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS_DEF: Array<{ id: OptionsTab; label: string }> = [
  { id: 'gex', label: 'GEX' },
  { id: 'chain', label: 'Options Chain' },
  { id: 'flow', label: 'Flow Scanner' },
  { id: 'skew', label: 'Skew' },
  { id: 'term', label: 'Term Structure' },
  { id: 'scanner', label: 'Greeks Dashboard' },
  { id: 'positions', label: 'Positions' },
];

export const OptionsAnalyticsPage: React.FC = () => {
  const [tab, setTab] = useState<OptionsTab>('gex');
  const [ticker, setTicker] = useState('SPY');
  const [spot] = useState(490.24);

  const chain = useMemo(() => generateChain(spot), [spot]);

  const renderTab = () => {
    switch (tab) {
      case 'gex': return (
        <div>
          <div style={{ marginBottom: 16, fontFamily: 'monospace', color: '#888', fontSize: 11 }}>
            Gamma Exposure (GEX) by Strike — <span style={{ color: '#00d4aa' }}>Positive = Dealer Long Gamma (stabilizing)</span> ·
            <span style={{ color: '#ff4466' }}> Negative = Dealer Short Gamma (amplifying)</span>
          </div>
          <GEXChart chain={chain} spot={spot} />
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            {[
              { label: 'Total GEX', value: `$${(chain.reduce((s, c) => s + c.net_gex, 0) / 1e6).toFixed(2)}B`, color: '#4a9eff' },
              { label: 'Positive GEX', value: `$${(chain.filter(c => c.net_gex > 0).reduce((s, c) => s + c.net_gex, 0) / 1e6).toFixed(2)}B`, color: '#00d4aa' },
              { label: 'Negative GEX', value: `$${(chain.filter(c => c.net_gex < 0).reduce((s, c) => s + c.net_gex, 0) / 1e6).toFixed(2)}B`, color: '#ff4466' },
              { label: 'Gamma Flip Level', value: `~${(spot * 0.995).toFixed(0)}`, color: '#ffcc00' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '8px 14px' }}>
                <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      );
      case 'chain': return <ChainTable chain={chain} spot={spot} />;
      case 'flow': return <FlowScanner />;
      case 'scanner': return <GreeksDashboard />;
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {tab}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      {/* Header */}
      <div style={{
        height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#cc44ff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>OPTIONS ANALYTICS</span>
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            style={{
              background: '#0e1c2e', border: '1px solid #2a3a4a', color: '#fff',
              padding: '3px 8px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11, width: 60,
            }}
          />
          <span style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>
            Spot: <b style={{ color: '#ddd' }}>${spot.toFixed(2)}</b>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {TABS_DEF.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? '2px solid #cc44ff' : '2px solid transparent',
            color: tab === t.id ? '#cc44ff' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderTab()}
      </div>
    </div>
  );
};

export default OptionsAnalyticsPage;
