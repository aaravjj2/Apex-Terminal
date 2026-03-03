/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — ALERTS MANAGER (UI2)                                 │
 * │                                                                       │
 * │ Alert condition builder + history — tasks.md §13                    │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Visual alert condition builder (price/volume/indicator/custom)     │
 * │ • Alert templates (price cross, volume spike, RSI extreme, etc.)    │
 * │ • Active alerts table with status indicators                        │
 * │ • Alert history + triggered log                                     │
 * │ • Delivery method config (popup, email, webhook, SMS)               │
 * │ • Smart alerts — ML-based anomaly detection                         │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo } from 'react';
import { useAlerts } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

interface Alert {
  id: number; symbol: string; condition: string; value: string; status: 'active' | 'triggered' | 'expired' | 'paused';
  type: string; created: string; lastTriggered?: string; delivery: string[]; triggerCount: number;
}

const ALERTS: Alert[] = [
  { id: 1, symbol: 'AAPL', condition: 'Price crosses above', value: '$200.00', status: 'active', type: 'Price', created: '2024-06-10 09:30', delivery: ['Popup', 'Email'], triggerCount: 0 },
  { id: 2, symbol: 'NVDA', condition: 'Volume > 2x Average', value: '150M shares', status: 'triggered', type: 'Volume', created: '2024-06-08 14:15', lastTriggered: '2024-06-12 10:42', delivery: ['Popup', 'Webhook'], triggerCount: 3 },
  { id: 3, symbol: 'SPY', condition: 'RSI(14) below', value: '30', status: 'active', type: 'Indicator', created: '2024-06-05 11:00', delivery: ['Popup', 'Email', 'SMS'], triggerCount: 0 },
  { id: 4, symbol: 'TSLA', condition: 'Price drops by', value: '5% in 1 hour', status: 'active', type: 'Price', created: '2024-06-01 08:45', delivery: ['Popup'], triggerCount: 0 },
  { id: 5, symbol: 'MSFT', condition: 'SMA(50) crosses SMA(200)', value: 'Golden Cross', status: 'triggered', type: 'Indicator', created: '2024-05-28 16:00', lastTriggered: '2024-06-11 15:30', delivery: ['Email', 'Webhook'], triggerCount: 1 },
  { id: 6, symbol: 'BTC', condition: 'Price crosses above', value: '$70,000', status: 'triggered', type: 'Price', created: '2024-05-20 12:00', lastTriggered: '2024-06-10 22:15', delivery: ['Popup', 'Email', 'SMS'], triggerCount: 5 },
  { id: 7, symbol: 'AMZN', condition: 'Earnings surprise >', value: '10%', status: 'active', type: 'Fundamental', created: '2024-06-12 09:00', delivery: ['Email'], triggerCount: 0 },
  { id: 8, symbol: 'META', condition: 'Bollinger Band breakout', value: 'Upper band', status: 'paused', type: 'Indicator', created: '2024-05-15 10:30', delivery: ['Popup'], triggerCount: 2 },
  { id: 9, symbol: 'QQQ', condition: 'Price below', value: '$440.00', status: 'active', type: 'Price', created: '2024-06-11 13:15', delivery: ['Popup', 'Webhook'], triggerCount: 0 },
  { id: 10, symbol: 'GC', condition: 'New 52-week high', value: '', status: 'triggered', type: 'Price', created: '2024-06-03 07:00', lastTriggered: '2024-06-12 08:20', delivery: ['Email', 'SMS'], triggerCount: 8 },
  { id: 11, symbol: 'EUR/USD', condition: 'Price crosses below', value: '1.0700', status: 'active', type: 'Price', created: '2024-06-09 06:00', delivery: ['Popup'], triggerCount: 0 },
  { id: 12, symbol: 'AAPL', condition: 'MACD histogram flip', value: 'Bearish → Bullish', status: 'expired', type: 'Indicator', created: '2024-05-01 09:30', lastTriggered: '2024-05-22 14:10', delivery: ['Popup', 'Email'], triggerCount: 1 },
];

const HISTORY = [
  { time: '10:42:18', symbol: 'NVDA', message: 'Volume exceeded 2x average — 168M shares traded', type: 'Volume' },
  { time: '10:15:30', symbol: 'BTC', message: 'Price crossed $70,000 — currently $70,125.50', type: 'Price' },
  { time: '09:52:05', symbol: 'GC', message: 'New 52-week high — Gold at $2,395.80/oz', type: 'Price' },
  { time: '09:30:00', symbol: 'SPY', message: 'Market Open — Vol spike detected in first 5 min', type: 'Smart' },
  { time: '08:20:12', symbol: 'GC', message: 'New 52-week high — Gold at $2,388.50/oz', type: 'Price' },
  { time: 'Yesterday 15:30', symbol: 'MSFT', message: 'SMA(50) crossed above SMA(200) — Golden Cross', type: 'Indicator' },
  { time: 'Yesterday 14:22', symbol: 'NVDA', message: 'Volume exceeded 2x average — 192M shares traded', type: 'Volume' },
  { time: 'Jun 10 22:15', symbol: 'BTC', message: 'Price crossed $70,000 — currently $70,450.00', type: 'Price' },
];

function statusColor(s: string) { return s === 'active' ? T.up : s === 'triggered' ? T.warn : s === 'paused' ? T.info : T.text3; }
function statusBg(s: string) { return s === 'active' ? 'rgba(38,166,154,0.1)' : s === 'triggered' ? 'rgba(255,152,0,0.1)' : 'rgba(0,0,0,0)'; }

/* Alert Builder */
function AlertBuilder({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState('');
  const [condType, setCondType] = useState('Price');
  const [condition, setCondition] = useState('crosses above');
  const [value, setValue] = useState('');
  const [delivery, setDelivery] = useState<string[]>(['Popup']);

  const conditions: Record<string, string[]> = {
    Price: ['crosses above', 'crosses below', 'drops by %', 'rises by %', 'new 52W high', 'new 52W low'],
    Volume: ['exceeds', 'exceeds Nx average', 'drops below average'],
    Indicator: ['RSI above', 'RSI below', 'MACD crossover', 'SMA cross', 'BB breakout'],
    Fundamental: ['P/E below', 'Earnings surprise >', 'Dividend change', 'Revenue beat'],
  };
  const deliveryMethods = ['Popup', 'Email', 'Webhook', 'SMS'];

  return (
    <div style={{ ...panelStyle, flexShrink: 0 }}>
      <div style={panelHdr}><span>CREATE ALERT</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: '12px' }}>✕</button></div>
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px', alignItems: 'center' }}>
          <label style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase' }}>Symbol</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.text0, padding: '4px 8px', borderRadius: T.radius, fontSize: '11px', fontFamily: T.fontMono, outline: 'none' }} />
          <label style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase' }}>Type</label>
          <select value={condType} onChange={e => setCondType(e.target.value)} style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.text0, padding: '4px 8px', borderRadius: T.radius, fontSize: '10px', fontFamily: T.fontSans, outline: 'none' }}>
            {Object.keys(conditions).map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase' }}>Condition</label>
          <select value={condition} onChange={e => setCondition(e.target.value)} style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.text0, padding: '4px 8px', borderRadius: T.radius, fontSize: '10px', fontFamily: T.fontSans, outline: 'none' }}>
            {conditions[condType].map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase' }}>Value</label>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder="200.00" style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.text0, padding: '4px 8px', borderRadius: T.radius, fontSize: '11px', fontFamily: T.fontMono, outline: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase', marginBottom: '4px' }}>Delivery</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {deliveryMethods.map(d => (
              <button key={d} onClick={() => setDelivery(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} style={{ background: delivery.includes(d) ? T.brand : T.bg3, color: delivery.includes(d) ? '#FFF' : T.text2, border: 'none', padding: '3px 8px', borderRadius: '2px', fontSize: '9px', cursor: 'pointer', fontWeight: 600, fontFamily: T.fontSans }}>{d}</button>
            ))}
          </div>
        </div>
        <button style={{ background: T.brand, color: '#FFF', border: 'none', padding: '6px', borderRadius: T.radius, fontSize: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontSans }}>CREATE ALERT</button>
      </div>
    </div>
  );
}

/* Templates */
function AlertTemplates() {
  const templates = [
    { name: 'Price Cross', icon: '📈', desc: 'Alert when price crosses a level' },
    { name: 'Volume Spike', icon: '📊', desc: 'Unusual volume detection' },
    { name: 'RSI Extreme', icon: '📉', desc: 'RSI overbought/oversold' },
    { name: 'Moving Avg Cross', icon: '✂️', desc: 'Golden/Death cross signals' },
    { name: 'Earnings Alert', icon: '💰', desc: 'Earnings surprises & beats' },
    { name: 'News Sentiment', icon: '📰', desc: 'Sentiment shift detection' },
  ];

  return (
    <div style={panelStyle}>
      <div style={panelHdr}><span>QUICK TEMPLATES</span></div>
      <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        {templates.map(t => (
          <div key={t.name} style={{ background: T.bg2, borderRadius: T.radius, padding: '6px', cursor: 'pointer', border: `1px solid transparent`, transition: 'border 0.15s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = T.brand)} onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.text0, marginBottom: '2px' }}>{t.icon} {t.name}</div>
            <div style={{ fontSize: '8px', color: T.text3 }}>{t.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function AlertsManagerUI2() {
  // ── Hook integration ──
  const [alertsState, alertsActions] = useAlerts();

  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [showBuilder, setShowBuilder] = useState(false);
  const [filter, setFilter] = useState('All');

  const activeAlerts = ALERTS.filter(a => filter === 'All' || a.status === filter.toLowerCase());

  return (
    <div data-testid="alerts-manager-page" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      {/* Left — Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        {showBuilder && <AlertBuilder onClose={() => setShowBuilder(false)} />}

        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHdr}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['active', 'history'].map(t => <button key={t} onClick={() => setTab(t as any)} style={{ background: tab === t ? T.brand : 'transparent', color: tab === t ? '#FFF' : T.text3, border: 'none', padding: '2px 8px', borderRadius: '2px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', fontFamily: T.fontSans }}>{t}</button>)}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {['All', 'Active', 'Triggered', 'Paused'].map(f => <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? T.bg3 : 'transparent', color: filter === f ? T.text0 : T.text3, border: 'none', padding: '2px 5px', borderRadius: '2px', fontSize: '8px', cursor: 'pointer', fontFamily: T.fontSans }}>{f}</button>)}
              <button onClick={() => setShowBuilder(!showBuilder)} style={{ background: T.brand, color: '#FFF', border: 'none', padding: '2px 8px', borderRadius: '2px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontSans }}>+ NEW</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
            {tab === 'active' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Status', 'Symbol', 'Condition', 'Value', 'Type', 'Created', 'Triggered', 'Delivery', '#'].map(h => <th key={h} style={{ padding: '3px 6px', fontSize: '8px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1 }}>{h}</th>)}</tr></thead>
                <tbody>{activeAlerts.map(a => (
                  <tr key={a.id} style={{ background: statusBg(a.status) }} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = statusBg(a.status)}>
                    <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: statusColor(a.status), marginRight: '4px' }} />
                      <span style={{ fontSize: '8px', color: statusColor(a.status), textTransform: 'uppercase', fontWeight: 700 }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>{a.symbol}</td>
                    <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text1, borderBottom: `1px solid ${T.border0}` }}>{a.condition}</td>
                    <td style={{ padding: '3px 6px', fontSize: '10px', color: T.brand, fontFamily: T.fontMono, fontWeight: 600, borderBottom: `1px solid ${T.border0}` }}>{a.value}</td>
                    <td style={{ padding: '3px 6px', fontSize: '9px', color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{a.type}</td>
                    <td style={{ padding: '3px 6px', fontSize: '9px', color: T.text3, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>{a.created.split(' ')[0]}</td>
                    <td style={{ padding: '3px 6px', fontSize: '9px', color: a.lastTriggered ? T.warn : T.text3, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>{a.lastTriggered || '—'}</td>
                    <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                      <div style={{ display: 'flex', gap: '2px' }}>{a.delivery.map(d => <span key={d} style={{ fontSize: '7px', background: T.bg3, color: T.text2, padding: '1px 3px', borderRadius: '2px' }}>{d}</span>)}</div>
                    </td>
                    <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text2, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}`, textAlign: 'center' }}>{a.triggerCount}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              // History
              <div>
                {HISTORY.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 10px', borderBottom: `1px solid ${T.border0}`, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '9px', color: T.text3, fontFamily: T.fontMono, flexShrink: 0, width: '85px' }}>{h.time}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T.brand, fontFamily: T.fontMono, flexShrink: 0, width: '45px' }}>{h.symbol}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '10px', color: T.text1 }}>{h.message}</span>
                      <span style={{ fontSize: '8px', color: T.text3, marginLeft: '6px' }}>[{h.type}]</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary Strip */}
        <div style={{ ...panelStyle, flexDirection: 'row', flexShrink: 0, padding: '4px 10px', gap: '16px', alignItems: 'center' }}>
          {[{ label: 'Active', count: ALERTS.filter(a => a.status === 'active').length, color: T.up }, { label: 'Triggered', count: ALERTS.filter(a => a.status === 'triggered').length, color: T.warn }, { label: 'Paused', count: ALERTS.filter(a => a.status === 'paused').length, color: T.info }, { label: 'Expired', count: ALERTS.filter(a => a.status === 'expired').length, color: T.text3 }, { label: 'Total Triggers', count: ALERTS.reduce((s, a) => s + a.triggerCount, 0), color: T.text1 }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: T.text3 }}>{s.label}:</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: s.color, fontFamily: T.fontMono }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Templates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        <AlertTemplates />
        {/* Smart Alerts */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHdr}><span>🧠 SMART ALERTS</span></div>
          <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
            {[
              { title: 'Anomaly: NVDA volume 3.2σ above mean', severity: 'HIGH', time: '10:42' },
              { title: 'Correlation break: AAPL-MSFT R² dropped to 0.45', severity: 'MEDIUM', time: '10:15' },
              { title: 'Momentum shift: SPY RSI divergence on 4H', severity: 'MEDIUM', time: '09:52' },
              { title: 'Liquidity: L2 bid depth thin for TSLA < $165', severity: 'HIGH', time: '09:30' },
              { title: 'Sector rotation detected: Tech → Healthcare', severity: 'LOW', time: '09:15' },
              { title: 'Options: Unusual put activity in QQQ Jul $430', severity: 'MEDIUM', time: '09:02' },
            ].map((a, i) => (
              <div key={i} style={{ padding: '5px 6px', borderBottom: `1px solid ${T.border0}`, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '7px', fontWeight: 800, padding: '1px 4px', borderRadius: '2px', background: a.severity === 'HIGH' ? T.dn : a.severity === 'MEDIUM' ? T.warn : T.text3, color: '#FFF' }}>{a.severity}</span>
                  <span style={{ fontSize: '8px', color: T.text3, fontFamily: T.fontMono }}>{a.time}</span>
                </div>
                <div style={{ fontSize: '10px', color: T.text1 }}>{a.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
