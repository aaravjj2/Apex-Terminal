/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Options Sweep Scanner V2 (UI2)                      │
 * │  Real-time unusual options activity, large block trades, sweep       │
 * │  detection, dark pool prints, and institutional flow analysis        │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  gold: '#FFD700', cyan: '#00BCD4',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface SweepEntry {
  id: string;
  time: string;
  ticker: string;
  expiry: string;
  strike: number;
  type: 'CALL' | 'PUT';
  side: 'BUY' | 'SELL';
  size: number;
  premium: number;
  spot: number;
  iv: number;
  delta: number;
  openInterest: number;
  volume: number;
  volOiRatio: number;
  exchange: string;
  sweepType: 'SWEEP' | 'BLOCK' | 'SPLIT' | 'CROSS' | 'FLOOR';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  unusual: boolean;
  daysToExpiry: number;
}

interface FlowSummary {
  ticker: string;
  callPremium: number;
  putPremium: number;
  callVolume: number;
  putVolume: number;
  netSentiment: number;
  sweepCount: number;
  avgSize: number;
  topStrike: number;
  topExpiry: string;
}

interface DarkPoolPrint {
  time: string;
  ticker: string;
  price: number;
  size: number;
  value: number;
  exchange: string;
  aboveBelow: 'ABOVE' | 'BELOW' | 'AT';
  percentOfAdv: number;
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'SPY', 'QQQ', 'AMD', 'NFLX', 'COIN', 'PLTR', 'ARM', 'SMCI'];
const EXCHANGES = ['CBOE', 'ISE', 'PHLX', 'ARCA', 'BOX', 'MIAX', 'PEARL', 'EDGX', 'C2', 'BATS'];

function generateSweeps(count: number): SweepEntry[] {
  const sweeps: SweepEntry[] = [];
  for (let i = 0; i < count; i++) {
    const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
    const type: 'CALL' | 'PUT' = Math.random() > 0.45 ? 'CALL' : 'PUT';
    const spot = ticker === 'AAPL' ? 185 : ticker === 'MSFT' ? 420 : ticker === 'NVDA' ? 880 : ticker === 'SPY' ? 510 : 100 + Math.random() * 500;
    const strike = Math.round(spot * (0.9 + Math.random() * 0.2) / 5) * 5;
    const size = Math.round(50 + Math.random() * 2000);
    const premium = size * (0.5 + Math.random() * 15) * 100;
    const dte = Math.round(1 + Math.random() * 90);
    const sweepTypes: SweepEntry['sweepType'][] = ['SWEEP', 'BLOCK', 'SPLIT', 'CROSS', 'FLOOR'];
    const side: 'BUY' | 'SELL' = Math.random() > 0.4 ? 'BUY' : 'SELL';
    const sentiment = type === 'CALL' ? (side === 'BUY' ? 'BULLISH' : 'BEARISH') : (side === 'BUY' ? 'BEARISH' : 'BULLISH');
    const oi = Math.round(500 + Math.random() * 50000);
    const vol = Math.round(100 + Math.random() * 10000);

    sweeps.push({
      id: `SW-${String(i + 1).padStart(4, '0')}`,
      time: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      ticker, expiry: new Date(Date.now() + dte * 86400000).toISOString().slice(0, 10),
      strike, type, side, size, premium, spot: +spot.toFixed(2),
      iv: +(15 + Math.random() * 60).toFixed(1),
      delta: +(type === 'CALL' ? 0.1 + Math.random() * 0.8 : -(0.1 + Math.random() * 0.8)).toFixed(2),
      openInterest: oi, volume: vol, volOiRatio: +(vol / oi).toFixed(2),
      exchange: EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)],
      sweepType: sweepTypes[Math.floor(Math.random() * sweepTypes.length)],
      sentiment: sentiment as SweepEntry['sentiment'],
      unusual: premium > 100000 || vol / oi > 3,
      daysToExpiry: dte,
    });
  }
  return sweeps.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function generateFlowSummary(sweeps: SweepEntry[]): FlowSummary[] {
  const map = new Map<string, SweepEntry[]>();
  sweeps.forEach(s => { const arr = map.get(s.ticker) ?? []; arr.push(s); map.set(s.ticker, arr); });
  return Array.from(map.entries()).map(([ticker, entries]) => {
    const calls = entries.filter(e => e.type === 'CALL');
    const puts = entries.filter(e => e.type === 'PUT');
    const callPrem = calls.reduce((s, e) => s + e.premium, 0);
    const putPrem = puts.reduce((s, e) => s + e.premium, 0);
    return {
      ticker, callPremium: callPrem, putPremium: putPrem,
      callVolume: calls.reduce((s, e) => s + e.size, 0),
      putVolume: puts.reduce((s, e) => s + e.size, 0),
      netSentiment: callPrem > 0 || putPrem > 0 ? (callPrem - putPrem) / (callPrem + putPrem) : 0,
      sweepCount: entries.length,
      avgSize: Math.round(entries.reduce((s, e) => s + e.size, 0) / entries.length),
      topStrike: entries.sort((a, b) => b.premium - a.premium)[0]?.strike ?? 0,
      topExpiry: entries.sort((a, b) => b.premium - a.premium)[0]?.expiry ?? '',
    };
  }).sort((a, b) => (b.callPremium + b.putPremium) - (a.callPremium + a.putPremium));
}

function generateDarkPoolPrints(): DarkPoolPrint[] {
  return Array.from({ length: 25 }, (_, i) => {
    const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
    const price = 100 + Math.random() * 500;
    const size = Math.round(10000 + Math.random() * 500000);
    return {
      time: new Date(Date.now() - Math.random() * 7200000).toISOString(),
      ticker, price: +price.toFixed(2), size,
      value: +(price * size).toFixed(0),
      exchange: ['FINRA ADF', 'IEX', 'MEMX', 'EDGX'][Math.floor(Math.random() * 4)],
      aboveBelow: (['ABOVE', 'BELOW', 'AT'] as const)[Math.floor(Math.random() * 3)],
      percentOfAdv: +(0.5 + Math.random() * 8).toFixed(1),
    };
  }).sort((a, b) => b.value - a.value);
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function SweepTable({ sweeps, filter }: { sweeps: SweepEntry[]; filter: string }) {
  const filtered = filter ? sweeps.filter(s => s.ticker === filter) : sweeps;
  return (
    <div style={{ overflow: 'auto', maxHeight: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono, minWidth: '900px' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: T.bg1 }}>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Time', 'Ticker', 'Exp', 'Strike', 'C/P', 'Side', 'Size', 'Premium', 'IV', 'Delta', 'Vol/OI', 'Type', 'Sent.', 'Exch'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 100).map(s => (
            <tr key={s.id} style={{
              borderBottom: `1px solid ${T.border}`,
              background: s.unusual ? `${T.gold}08` : 'transparent',
            }}>
              <td style={{ padding: '2px 4px', color: T.tx3, textAlign: 'left', whiteSpace: 'nowrap' }}>{new Date(s.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
              <td style={{ padding: '2px 4px', color: T.brand, fontWeight: 700, textAlign: 'right' }}>{s.ticker}</td>
              <td style={{ padding: '2px 4px', color: T.tx2, textAlign: 'right' }}>{s.expiry.slice(5)}</td>
              <td style={{ padding: '2px 4px', color: T.tx0, textAlign: 'right' }}>${s.strike}</td>
              <td style={{ padding: '2px 4px', color: s.type === 'CALL' ? T.up : T.dn, fontWeight: 700, textAlign: 'right' }}>{s.type}</td>
              <td style={{ padding: '2px 4px', color: s.side === 'BUY' ? T.up : T.dn, textAlign: 'right' }}>{s.side}</td>
              <td style={{ padding: '2px 4px', color: s.size > 500 ? T.gold : T.tx1, textAlign: 'right', fontWeight: s.size > 500 ? 700 : 400 }}>{s.size.toLocaleString()}</td>
              <td style={{ padding: '2px 4px', color: s.premium > 500000 ? T.gold : s.premium > 100000 ? T.warn : T.tx1, textAlign: 'right', fontWeight: s.premium > 100000 ? 700 : 400 }}>
                ${s.premium >= 1000000 ? (s.premium / 1e6).toFixed(1) + 'M' : (s.premium / 1000).toFixed(0) + 'K'}
              </td>
              <td style={{ padding: '2px 4px', color: s.iv > 50 ? T.warn : T.tx2, textAlign: 'right' }}>{s.iv}%</td>
              <td style={{ padding: '2px 4px', color: T.tx2, textAlign: 'right' }}>{s.delta}</td>
              <td style={{ padding: '2px 4px', color: s.volOiRatio > 3 ? T.gold : s.volOiRatio > 1 ? T.warn : T.tx2, textAlign: 'right', fontWeight: s.volOiRatio > 3 ? 700 : 400 }}>{s.volOiRatio.toFixed(1)}x</td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                <span style={{
                  fontSize: '6px', fontWeight: 700, padding: '1px 3px', borderRadius: '2px',
                  background: s.sweepType === 'SWEEP' ? `${T.purple}25` : s.sweepType === 'BLOCK' ? `${T.gold}25` : `${T.info}25`,
                  color: s.sweepType === 'SWEEP' ? T.purple : s.sweepType === 'BLOCK' ? T.gold : T.info,
                }}>{s.sweepType}</span>
              </td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                <span style={{
                  fontSize: '6px', fontWeight: 800, padding: '1px 3px', borderRadius: '2px',
                  background: s.sentiment === 'BULLISH' ? `${T.up}20` : s.sentiment === 'BEARISH' ? `${T.dn}20` : `${T.tx3}20`,
                  color: s.sentiment === 'BULLISH' ? T.up : s.sentiment === 'BEARISH' ? T.dn : T.tx3,
                }}>{s.sentiment.slice(0, 4)}</span>
              </td>
              <td style={{ padding: '2px 4px', color: T.tx3, textAlign: 'right', fontSize: '7px' }}>{s.exchange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowSummaryPanel({ summary }: { summary: FlowSummary[] }) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Ticker', 'Call $', 'Put $', 'Call Vol', 'Put Vol', 'Net Sent', 'Sweeps', 'Avg Size', 'Top Strike', 'Top Exp'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.map(s => (
            <tr key={s.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.brand, fontWeight: 700, textAlign: 'left' }}>{s.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.up, textAlign: 'right' }}>${(s.callPremium / 1000).toFixed(0)}K</td>
              <td style={{ padding: '3px 4px', color: T.dn, textAlign: 'right' }}>${(s.putPremium / 1000).toFixed(0)}K</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{s.callVolume.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{s.putVolume.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <div style={{ width: '50px', height: '6px', background: T.bg3, borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: `${Math.abs(s.netSentiment) * 50}%`, background: s.netSentiment >= 0 ? T.up : T.dn, [s.netSentiment >= 0 ? 'left' : 'right']: '50%', borderRadius: '3px' }} />
                  </div>
                  <span style={{ color: s.netSentiment >= 0 ? T.up : T.dn, fontWeight: 600, minWidth: '30px' }}>
                    {(s.netSentiment * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{s.sweepCount}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{s.avgSize}</td>
              <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'right' }}>${s.topStrike}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{s.topExpiry.slice(5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DarkPoolPanel({ prints }: { prints: DarkPoolPrint[] }) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Time', 'Ticker', 'Price', 'Size', 'Value', 'Venue', 'vs Mid', '% ADV'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prints.map((p, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: p.value > 10000000 ? `${T.gold}08` : 'transparent' }}>
              <td style={{ padding: '2px 4px', color: T.tx3, textAlign: 'left' }}>{new Date(p.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
              <td style={{ padding: '2px 4px', color: T.brand, fontWeight: 700, textAlign: 'right' }}>{p.ticker}</td>
              <td style={{ padding: '2px 4px', color: T.tx0, textAlign: 'right' }}>${p.price.toFixed(2)}</td>
              <td style={{ padding: '2px 4px', color: p.size > 100000 ? T.gold : T.tx1, textAlign: 'right', fontWeight: p.size > 100000 ? 700 : 400 }}>{p.size.toLocaleString()}</td>
              <td style={{ padding: '2px 4px', color: p.value > 10000000 ? T.gold : T.tx1, textAlign: 'right', fontWeight: 600 }}>
                ${p.value >= 1000000 ? (p.value / 1e6).toFixed(1) + 'M' : (p.value / 1000).toFixed(0) + 'K'}
              </td>
              <td style={{ padding: '2px 4px', color: T.tx3, textAlign: 'right', fontSize: '7px' }}>{p.exchange}</td>
              <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                <span style={{
                  fontSize: '6px', fontWeight: 700, padding: '1px 3px', borderRadius: '2px',
                  background: p.aboveBelow === 'ABOVE' ? `${T.up}20` : p.aboveBelow === 'BELOW' ? `${T.dn}20` : `${T.tx3}20`,
                  color: p.aboveBelow === 'ABOVE' ? T.up : p.aboveBelow === 'BELOW' ? T.dn : T.tx3,
                }}>{p.aboveBelow}</span>
              </td>
              <td style={{ padding: '2px 4px', color: p.percentOfAdv > 5 ? T.warn : T.tx2, textAlign: 'right' }}>{p.percentOfAdv.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SweepStatsBar({ sweeps }: { sweeps: SweepEntry[] }) {
  const total = sweeps.length;
  const totalPremium = sweeps.reduce((s, e) => s + e.premium, 0);
  const calls = sweeps.filter(e => e.type === 'CALL');
  const puts = sweeps.filter(e => e.type === 'PUT');
  const bullish = sweeps.filter(e => e.sentiment === 'BULLISH').length;
  const unusual = sweeps.filter(e => e.unusual).length;

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '6px 10px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
      {[
        { label: 'Total', value: total.toString(), col: T.tx0 },
        { label: 'Premium', value: `$${(totalPremium / 1e6).toFixed(1)}M`, col: T.gold },
        { label: 'Calls', value: `${calls.length} (${(calls.reduce((s, e) => s + e.premium, 0) / 1e6).toFixed(1)}M)`, col: T.up },
        { label: 'Puts', value: `${puts.length} (${(puts.reduce((s, e) => s + e.premium, 0) / 1e6).toFixed(1)}M)`, col: T.dn },
        { label: 'Bullish', value: `${((bullish / total) * 100).toFixed(0)}%`, col: T.up },
        { label: 'Unusual', value: unusual.toString(), col: T.warn },
      ].map(s => (
        <div key={s.label} style={{ fontSize: '8px', fontFamily: T.mono }}>
          <span style={{ color: T.tx3 }}>{s.label}: </span>
          <span style={{ color: s.col, fontWeight: 700 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
type SweepTab = 'live' | 'flow' | 'darkpool' | 'alerts';

export default function SweepV2UI2() {
  const [tab, setTab] = useState<SweepTab>('live');
  const [tickerFilter, setTickerFilter] = useState('');
  const [showUnusualOnly, setShowUnusualOnly] = useState(false);
  const [minPremium, setMinPremium] = useState(0);
  const sweeps = useMemo(() => generateSweeps(200), []);
  const flowSummary = useMemo(() => generateFlowSummary(sweeps), [sweeps]);
  const darkPoolPrints = useMemo(() => generateDarkPoolPrints(), []);

  const filteredSweeps = useMemo(() => {
    let result = sweeps;
    if (tickerFilter) result = result.filter(s => s.ticker === tickerFilter);
    if (showUnusualOnly) result = result.filter(s => s.unusual);
    if (minPremium > 0) result = result.filter(s => s.premium >= minPremium);
    return result;
  }, [sweeps, tickerFilter, showUnusualOnly, minPremium]);

  return (
    <div data-testid="sweep-v2-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>OPTIONS SWEEP SCANNER</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        {/* Filter controls */}
        <select value={tickerFilter} onChange={e => setTickerFilter(e.target.value)}
          style={{ background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '9px', fontFamily: T.mono }}>
          <option value="">All Tickers</option>
          {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8px', color: T.tx2, cursor: 'pointer' }}>
          <input type="checkbox" checked={showUnusualOnly} onChange={e => setShowUnusualOnly(e.target.checked)} style={{ width: '10px', height: '10px' }} />
          Unusual Only
        </label>
        <select value={minPremium} onChange={e => setMinPremium(+e.target.value)}
          style={{ background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '9px', fontFamily: T.mono }}>
          <option value={0}>Min Premium: All</option>
          <option value={10000}>$10K+</option>
          <option value={50000}>$50K+</option>
          <option value={100000}>$100K+</option>
          <option value={500000}>$500K+</option>
          <option value={1000000}>$1M+</option>
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3 }}>Live Feed</span>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.up, animation: 'pulse 2s infinite' }} />
      </div>

      <SweepStatsBar sweeps={filteredSweeps} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'live' as SweepTab, label: '⚡ Live Sweeps' },
          { key: 'flow' as SweepTab, label: '📊 Flow Summary' },
          { key: 'darkpool' as SweepTab, label: '🌑 Dark Pool' },
          { key: 'alerts' as SweepTab, label: '🔔 Alerts' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: tab === 'live' ? '0' : '8px' }}>
        {tab === 'live' && <SweepTable sweeps={filteredSweeps} filter={tickerFilter} />}
        {tab === 'flow' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>📊 Flow Summary by Ticker</div>
            <FlowSummaryPanel summary={flowSummary} />
          </div>
        )}
        {tab === 'darkpool' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>🌑 Dark Pool Prints</div>
            <DarkPoolPanel prints={darkPoolPrints} />
          </div>
        )}
        {tab === 'alerts' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '8px' }}>🔔 Sweep Alerts Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Premium > $100K', active: true, count: 12 },
                { label: 'Vol/OI > 5x', active: true, count: 8 },
                { label: 'Unusual Sweeps', active: true, count: 15 },
                { label: 'Dark Pool > 5% ADV', active: false, count: 0 },
                { label: 'Block Trades > $500K', active: true, count: 3 },
                { label: 'IV Spike > 50%', active: false, count: 0 },
              ].map(a => (
                <div key={a.label} style={{
                  background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: T.tx0 }}>{a.label}</div>
                    <div style={{ fontSize: '8px', color: T.tx3, marginTop: '2px' }}>Triggered {a.count}x today</div>
                  </div>
                  <div style={{
                    width: '28px', height: '16px', borderRadius: '8px', padding: '2px', cursor: 'pointer',
                    background: a.active ? T.up : T.bg3, display: 'flex', alignItems: 'center',
                    justifyContent: a.active ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFF' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { SweepV2UI2 };
