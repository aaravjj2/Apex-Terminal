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
interface EconEvent {
  time: string; country: string; flag: string;
  event: string; impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actual: string; forecast: string; previous: string;
  surprise: number;
}

interface EconIndicator {
  name: string; region: string; value: number;
  previous: number; change: number; unit: string;
  trend: 'improving' | 'deteriorating' | 'stable';
  lastUpdate: string;
}

interface CentralBank {
  bank: string; rate: number; nextMeeting: string;
  probHike: number; probHold: number; probCut: number;
  lastAction: string; bias: string;
}

interface GlobalIndex {
  name: string; region: string; value: number;
  change: number; changePct: number; ytd: number;
}

/* ── Mock Data ─────────────────────────────────────────────── */
const CALENDAR: EconEvent[] = [
  { time: '08:30', country: 'US', flag: '🇺🇸', event: 'CPI (YoY)', impact: 'HIGH', actual: '3.1%', forecast: '3.2%', previous: '3.4%', surprise: -0.1 },
  { time: '08:30', country: 'US', flag: '🇺🇸', event: 'Core CPI (MoM)', impact: 'HIGH', actual: '0.3%', forecast: '0.3%', previous: '0.3%', surprise: 0 },
  { time: '08:30', country: 'US', flag: '🇺🇸', event: 'Initial Jobless Claims', impact: 'MEDIUM', actual: '218K', forecast: '215K', previous: '212K', surprise: 3 },
  { time: '10:00', country: 'US', flag: '🇺🇸', event: 'Michigan Consumer Sentiment', impact: 'MEDIUM', actual: '', forecast: '69.4', previous: '69.7', surprise: 0 },
  { time: '14:00', country: 'US', flag: '🇺🇸', event: 'Fed Budget Balance', impact: 'LOW', actual: '', forecast: '-$68B', previous: '-$129B', surprise: 0 },
  { time: '07:00', country: 'DE', flag: '🇩🇪', event: 'German CPI (YoY)', impact: 'HIGH', actual: '3.7%', forecast: '3.8%', previous: '3.8%', surprise: -0.1 },
  { time: '09:30', country: 'GB', flag: '🇬🇧', event: 'UK GDP (QoQ)', impact: 'HIGH', actual: '-0.3%', forecast: '-0.1%', previous: '0.0%', surprise: -0.2 },
  { time: '04:30', country: 'JP', flag: '🇯🇵', event: 'Japan PPI (YoY)', impact: 'MEDIUM', actual: '0.3%', forecast: '0.5%', previous: '0.8%', surprise: -0.2 },
  { time: '02:00', country: 'CN', flag: '🇨🇳', event: 'China Trade Balance', impact: 'HIGH', actual: '$75.3B', forecast: '$68.0B', previous: '$56.5B', surprise: 7.3 },
  { time: '19:00', country: 'NZ', flag: '🇳🇿', event: 'RBNZ Interest Rate Decision', impact: 'HIGH', actual: '', forecast: '5.50%', previous: '5.50%', surprise: 0 },
  { time: '08:30', country: 'US', flag: '🇺🇸', event: 'Retail Sales (MoM)', impact: 'HIGH', actual: '', forecast: '0.4%', previous: '-0.1%', surprise: 0 },
  { time: '10:00', country: 'US', flag: '🇺🇸', event: 'Business Inventories', impact: 'LOW', actual: '', forecast: '0.1%', previous: '0.0%', surprise: 0 },
];

const INDICATORS: EconIndicator[] = [
  { name: 'GDP Growth (QoQ SAAR)',    region: 'US',    value: 3.3,    previous: 4.9,   change: -1.6,  unit: '%', trend: 'stable',        lastUpdate: 'Q4 2024' },
  { name: 'CPI (YoY)',                region: 'US',    value: 3.1,    previous: 3.4,   change: -0.3,  unit: '%', trend: 'improving',      lastUpdate: 'Dec 2024' },
  { name: 'Core PCE (YoY)',           region: 'US',    value: 2.9,    previous: 3.2,   change: -0.3,  unit: '%', trend: 'improving',      lastUpdate: 'Nov 2024' },
  { name: 'Unemployment Rate',        region: 'US',    value: 3.7,    previous: 3.7,   change: 0.0,   unit: '%', trend: 'stable',         lastUpdate: 'Dec 2024' },
  { name: 'NFP (Change)',             region: 'US',    value: 216,    previous: 173,   change: 43,    unit: 'K', trend: 'improving',      lastUpdate: 'Dec 2024' },
  { name: 'ISM Manufacturing',        region: 'US',    value: 47.4,   previous: 46.7,  change: 0.7,   unit: '',  trend: 'improving',      lastUpdate: 'Dec 2024' },
  { name: 'ISM Services',             region: 'US',    value: 50.6,   previous: 52.7,  change: -2.1,  unit: '',  trend: 'deteriorating',  lastUpdate: 'Dec 2024' },
  { name: 'Retail Sales (MoM)',       region: 'US',    value: -0.1,   previous: 0.3,   change: -0.4,  unit: '%', trend: 'deteriorating',  lastUpdate: 'Nov 2024' },
  { name: 'GDP Growth (QoQ)',         region: 'EU',    value: -0.1,   previous: 0.1,   change: -0.2,  unit: '%', trend: 'deteriorating',  lastUpdate: 'Q3 2024' },
  { name: 'CPI (YoY)',                region: 'EU',    value: 2.9,    previous: 2.4,   change: 0.5,   unit: '%', trend: 'deteriorating',  lastUpdate: 'Dec 2024' },
  { name: 'GDP Growth (QoQ)',         region: 'CN',    value: 1.3,    previous: 1.5,   change: -0.2,  unit: '%', trend: 'deteriorating',  lastUpdate: 'Q3 2024' },
  { name: 'GDP Growth (QoQ)',         region: 'GB',    value: -0.3,   previous: 0.0,   change: -0.3,  unit: '%', trend: 'deteriorating',  lastUpdate: 'Q3 2024' },
  { name: 'CPI (YoY)',                region: 'JP',    value: 2.8,    previous: 3.3,   change: -0.5,  unit: '%', trend: 'improving',      lastUpdate: 'Nov 2024' },
  { name: 'PMI Manufacturing',        region: 'Global',value: 49.0,   previous: 48.8,  change: 0.2,   unit: '',  trend: 'improving',      lastUpdate: 'Dec 2024' },
];

const CENTRAL_BANKS: CentralBank[] = [
  { bank: 'Federal Reserve (US)',      rate: 5.50, nextMeeting: 'Jan 31',  probHike: 0,  probHold: 95, probCut: 5,  lastAction: 'Hold (Dec)', bias: 'Neutral → Dovish' },
  { bank: 'ECB (Eurozone)',            rate: 4.50, nextMeeting: 'Jan 25',  probHike: 0,  probHold: 85, probCut: 15, lastAction: 'Hold (Dec)', bias: 'Data-Dependent' },
  { bank: 'Bank of England',          rate: 5.25, nextMeeting: 'Feb 1',   probHike: 0,  probHold: 90, probCut: 10, lastAction: 'Hold (Dec)', bias: 'Hawkish Hold' },
  { bank: 'Bank of Japan',            rate: -0.10, nextMeeting: 'Jan 23', probHike: 15, probHold: 85, probCut: 0,  lastAction: 'Hold (Dec)', bias: 'Dovish → Neutral' },
  { bank: 'People\'s Bank of China',  rate: 3.45, nextMeeting: 'Jan 22',  probHike: 0,  probHold: 60, probCut: 40, lastAction: 'Cut (Aug)',  bias: 'Easing' },
  { bank: 'Reserve Bank of Australia',rate: 4.35, nextMeeting: 'Feb 6',   probHike: 0,  probHold: 85, probCut: 15, lastAction: 'Hold (Dec)', bias: 'Data-Dependent' },
  { bank: 'Bank of Canada',           rate: 5.00, nextMeeting: 'Jan 24',  probHike: 0,  probHold: 75, probCut: 25, lastAction: 'Hold (Dec)', bias: 'Neutral' },
  { bank: 'Swiss National Bank',      rate: 1.75, nextMeeting: 'Mar 21',  probHike: 0,  probHold: 80, probCut: 20, lastAction: 'Hold (Dec)', bias: 'Neutral' },
];

const GLOBAL_INDICES: GlobalIndex[] = [
  { name: 'S&P 500',       region: 'US',     value: 4780.24, change: 28.45,  changePct: 0.60,  ytd: 24.2 },
  { name: 'NASDAQ',         region: 'US',     value: 15055.65,change: 92.18,  changePct: 0.62,  ytd: 42.8 },
  { name: 'DOW',            region: 'US',     value: 37592.12,change: 168.42, changePct: 0.45,  ytd: 12.6 },
  { name: 'Russell 2000',   region: 'US',     value: 2018.42, change: 12.85,  changePct: 0.64,  ytd: 15.4 },
  { name: 'STOXX 600',      region: 'EU',     value: 478.65,  change: -1.24,  changePct: -0.26, ytd: 14.8 },
  { name: 'FTSE 100',       region: 'GB',     value: 7694.82, change: -18.45, changePct: -0.24, ytd: 3.8 },
  { name: 'DAX',            region: 'DE',     value: 16751.48,change: 42.65,  changePct: 0.26,  ytd: 18.2 },
  { name: 'CAC 40',         region: 'FR',     value: 7465.24, change: 15.82,  changePct: 0.21,  ytd: 16.8 },
  { name: 'Nikkei 225',     region: 'JP',     value: 35577.11,change: 324.68, changePct: 0.92,  ytd: 34.2 },
  { name: 'Hang Seng',      region: 'HK',     value: 16244.58,change: -185.42,changePct: -1.13, ytd: -18.4 },
  { name: 'Shanghai Composite',region: 'CN',  value: 2886.45, change: -24.62, changePct: -0.85, ytd: -8.5 },
  { name: 'SENSEX',         region: 'IN',     value: 72484.28,change: 248.65, changePct: 0.34,  ytd: 18.6 },
  { name: 'ASX 200',        region: 'AU',     value: 7586.42, change: 28.12,  changePct: 0.37,  ytd: 8.4 },
  { name: 'KOSPI',          region: 'KR',     value: 2578.24, change: -12.48, changePct: -0.48, ytd: 4.2 },
];

const KPI_DATA = [
  { label: 'US 10Y', value: '3.98%', change: -2 },
  { label: 'FED RATE', value: '5.50%', change: 0 },
  { label: 'US CPI', value: '3.1%', change: -9 },
  { label: 'VIX', value: '12.85', change: -15 },
  { label: 'DXY', value: '102.42', change: -0.8 },
  { label: 'NEXT: RETAIL SALES', value: 'THU 08:30', change: 0 },
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

function chColor(v: number): string { return v >= 0 ? GREEN : RED; }
function chSign(v: number): string { return v >= 0 ? '+' : ''; }
function fmt(v: number, dec = 2): string { return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

/* ── KPI Strip ─────────────────────────────────────────────── */
const KPIStrip: React.FC = () => (
  <div style={S.kpiStrip}>
    {KPI_DATA.map(k => (
      <div key={k.label} style={S.kpiItem}>
        <span style={S.kpiLabel}>{k.label}</span>
        <span style={{ ...S.kpiValue, color: k.change !== 0 ? chColor(-k.change) : AMBER }}>{k.value}</span>
        {k.change !== 0 && <span style={{ fontSize: 10, color: chColor(-k.change) }}>{chSign(-k.change)}bps</span>}
      </div>
    ))}
  </div>
);

/* ── Calendar Tab ──────────────────────────────────────────── */
const CalendarTab: React.FC = () => {
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const filtered = impactFilter === 'ALL' ? CALENDAR : CALENDAR.filter(e => e.impact === impactFilter);

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(f => (
          <div key={f} onClick={() => setImpactFilter(f)} style={{ padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 9, letterSpacing: 1, background: impactFilter === f ? `${AMBER}20` : 'transparent', color: impactFilter === f ? AMBER : SUBTLE, border: `1px solid ${impactFilter === f ? AMBER : BORDER}40` }}>
            {f}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ color: SUBTLE, fontSize: 9, alignSelf: 'center' }}>TODAY — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>ECONOMIC CALENDAR<span style={{ color: SUBTLE, fontSize: 9 }}>{filtered.length} events</span></div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft, width: 60 }}>TIME</th>
                <th style={{ ...S.th, ...S.thLeft }}>EVENT</th>
                <th style={S.th}>IMPACT</th>
                <th style={S.th}>ACTUAL</th>
                <th style={S.th}>FORECAST</th>
                <th style={S.th}>PREVIOUS</th>
                <th style={S.th}>SURPRISE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onMouseEnter={ev => (ev.currentTarget.style.background = '#1a1a1a')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...S.td, ...S.tdLeft, color: SUBTLE }}>{e.time}</td>
                  <td style={{ ...S.td, ...S.tdLeft }}>
                    <span style={{ marginRight: 6 }}>{e.flag}</span>
                    <span style={{ color: e.impact === 'HIGH' ? TEXT : SUBTLE }}>{e.event}</span>
                  </td>
                  <td style={S.td}>
                    <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 8, fontWeight: 700, background: e.impact === 'HIGH' ? `${RED}20` : e.impact === 'MEDIUM' ? `${AMBER}20` : `${SUBTLE}20`, color: e.impact === 'HIGH' ? RED : e.impact === 'MEDIUM' ? AMBER : SUBTLE }}>
                      {e.impact}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: e.actual ? (e.surprise < 0 ? GREEN : e.surprise > 0 ? RED : TEXT) : SUBTLE, fontWeight: e.actual ? 700 : 400 }}>
                    {e.actual || '—'}
                  </td>
                  <td style={S.td}>{e.forecast}</td>
                  <td style={{ ...S.td, color: SUBTLE }}>{e.previous}</td>
                  <td style={S.td}>
                    {e.actual ? (
                      <span style={{ color: e.surprise < 0 ? GREEN : e.surprise > 0 ? RED : SUBTLE }}>
                        {e.surprise !== 0 ? `${chSign(e.surprise)}${typeof e.surprise === 'number' && !isNaN(e.surprise) ? e.surprise.toFixed(1) : e.surprise}` : 'IN-LINE'}
                      </span>
                    ) : <span style={{ color: SUBTLE }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming week */}
      <div style={S.panel}>
        <div style={S.panelHead}>KEY EVENTS NEXT 7 DAYS</div>
        <div style={{ padding: 8 }}>
          {[
            { day: 'Mon', events: ['US Empire State Mfg', 'EU Industrial Production'] },
            { day: 'Tue', events: ['US Retail Sales', 'US Industrial Production', 'DE ZEW Survey'] },
            { day: 'Wed', events: ['UK CPI', 'US Housing Starts', 'Fed Beige Book'] },
            { day: 'Thu', events: ['US Initial Claims', 'US Philadelphia Fed', 'ECB Minutes'] },
            { day: 'Fri', events: ['US Existing Home Sales', 'JP CPI', 'UK Retail Sales'] },
          ].map(d => (
            <div key={d.day} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: `1px solid ${BORDER}22` }}>
              <span style={{ color: AMBER, width: 40 }}>{d.day}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {d.events.map(e => (
                  <span key={e} style={{ padding: '1px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 9, color: TEXT }}>{e}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Indicators Tab ────────────────────────────────────────── */
const IndicatorsTab: React.FC = () => {
  const [region, setRegion] = useState('ALL');
  const regions = ['ALL', 'US', 'EU', 'GB', 'JP', 'CN', 'Global'];
  const filtered = region === 'ALL' ? INDICATORS : INDICATORS.filter(i => i.region === region);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {regions.map(r => (
          <div key={r} onClick={() => setRegion(r)} style={{ padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 9, letterSpacing: 1, background: region === r ? `${AMBER}20` : 'transparent', color: region === r ? AMBER : SUBTLE, border: `1px solid ${region === r ? AMBER : BORDER}40` }}>
            {r}
          </div>
        ))}
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>ECONOMIC INDICATORS<span style={{ color: SUBTLE, fontSize: 9 }}>{filtered.length} indicators</span></div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>INDICATOR</th>
                <th style={S.th}>REGION</th>
                <th style={S.th}>CURRENT</th>
                <th style={S.th}>PREVIOUS</th>
                <th style={S.th}>CHANGE</th>
                <th style={S.th}>TREND</th>
                <th style={S.th}>LAST UPDATE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ind, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, ...S.tdLeft, color: TEXT, fontWeight: 500 }}>{ind.name}</td>
                  <td style={{ ...S.td, color: BLUE }}>{ind.region}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(ind.value, 1)}{ind.unit}</td>
                  <td style={{ ...S.td, color: SUBTLE }}>{fmt(ind.previous, 1)}{ind.unit}</td>
                  <td style={{ ...S.td, color: chColor(ind.change) }}>{chSign(ind.change)}{fmt(ind.change, 1)}</td>
                  <td style={S.td}>
                    <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 8, background: ind.trend === 'improving' ? `${GREEN}20` : ind.trend === 'deteriorating' ? `${RED}20` : `${SUBTLE}20`, color: ind.trend === 'improving' ? GREEN : ind.trend === 'deteriorating' ? RED : SUBTLE }}>
                      {ind.trend === 'improving' ? '▲ IMPROVING' : ind.trend === 'deteriorating' ? '▼ DETERIORATING' : '— STABLE'}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: SUBTLE }}>{ind.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* US dashboard cards */}
      <div style={{ ...S.gridRow, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'GDP Growth', value: '3.3%', sub: 'Q4 SAAR', color: GREEN },
          { label: 'Inflation', value: '3.1%', sub: 'CPI YoY', color: AMBER },
          { label: 'Unemployment', value: '3.7%', sub: 'Dec 2024', color: BLUE },
          { label: 'Fed Rate', value: '5.50%', sub: 'Target Range', color: PURPLE },
        ].map(c => (
          <div key={c.label} style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
            <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>{c.label.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
            <div style={{ color: SUBTLE, fontSize: 9, marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Central Banks Tab ─────────────────────────────────────── */
const CentralBanksTab: React.FC = () => (
  <div>
    <div style={S.panel}>
      <div style={S.panelHead}>GLOBAL CENTRAL BANK RATES & PROBABILITIES</div>
      <div style={{ overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>CENTRAL BANK</th>
              <th style={S.th}>RATE</th>
              <th style={S.th}>NEXT MEETING</th>
              <th style={S.th}>P(HIKE)</th>
              <th style={S.th}>P(HOLD)</th>
              <th style={S.th}>P(CUT)</th>
              <th style={S.th}>LAST ACTION</th>
              <th style={{ ...S.th, ...S.thLeft }}>BIAS</th>
            </tr>
          </thead>
          <tbody>
            {CENTRAL_BANKS.map(cb => (
              <tr key={cb.bank}>
                <td style={{ ...S.td, ...S.tdLeft, color: AMBER }}>{cb.bank}</td>
                <td style={{ ...S.td, fontWeight: 700, color: TEXT }}>{fmt(cb.rate)}%</td>
                <td style={{ ...S.td, color: BLUE }}>{cb.nextMeeting}</td>
                <td style={{ ...S.td, color: cb.probHike > 30 ? RED : SUBTLE }}>{cb.probHike}%</td>
                <td style={{ ...S.td, color: cb.probHold > 70 ? AMBER : SUBTLE }}>{cb.probHold}%</td>
                <td style={{ ...S.td, color: cb.probCut > 30 ? GREEN : SUBTLE }}>{cb.probCut}%</td>
                <td style={{ ...S.td, color: SUBTLE }}>{cb.lastAction}</td>
                <td style={{ ...S.td, ...S.tdLeft, color: cb.bias.includes('Easing') || cb.bias.includes('Dovish') ? GREEN : cb.bias.includes('Hawkish') ? RED : AMBER }}>{cb.bias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Rate path visualization */}
    <div style={S.panel}>
      <div style={S.panelHead}>FED FUNDS RATE PATH EXPECTATIONS</div>
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
        {[
          { meeting: 'Jan 31', rate: '5.50%', prob: 95 },
          { meeting: 'Mar 20', rate: '5.25%', prob: 65 },
          { meeting: 'May 1', rate: '5.00%', prob: 55 },
          { meeting: 'Jun 12', rate: '4.75%', prob: 50 },
          { meeting: 'Jul 31', rate: '4.50%', prob: 45 },
          { meeting: 'Sep 18', rate: '4.25%', prob: 40 },
        ].map(m => (
          <div key={m.meeting} style={{ textAlign: 'center', padding: 8, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            <div style={{ color: SUBTLE, fontSize: 8, letterSpacing: 1 }}>{m.meeting}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, margin: '4px 0' }}>{m.rate}</div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, marginBottom: 4 }}>
              <div style={{ height: 4, width: `${m.prob}%`, background: m.prob > 60 ? GREEN : AMBER, borderRadius: 2 }} />
            </div>
            <div style={{ color: SUBTLE, fontSize: 8 }}>{m.prob}% implied</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Global Markets Tab ────────────────────────────────────── */
const GlobalMarketsTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 280;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 30, right: 60, bottom: 40, left: 120 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const sorted = [...GLOBAL_INDICES].sort((a, b) => b.ytd - a.ytd);
    const maxYTD = Math.max(...sorted.map(s => Math.abs(s.ytd)));
    const barH = Math.min(16, chartH / sorted.length - 2);

    // Zero line
    const zeroX = pad.left + (maxYTD / (maxYTD * 2)) * chartW;
    ctx.strokeStyle = SUBTLE; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(zeroX, pad.top); ctx.lineTo(zeroX, pad.top + chartH); ctx.stroke();
    ctx.setLineDash([]);

    sorted.forEach((idx, i) => {
      const y = pad.top + (i / sorted.length) * chartH;
      const barW = (Math.abs(idx.ytd) / maxYTD) * (chartW / 2);
      const x = idx.ytd >= 0 ? zeroX : zeroX - barW;
      ctx.fillStyle = idx.ytd >= 0 ? `${GREEN}80` : `${RED}80`;
      ctx.fillRect(x, y, barW, barH);
      // Label
      ctx.fillStyle = AMBER; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(idx.name, pad.left - 4, y + barH / 2 + 3);
      // Value
      ctx.fillStyle = idx.ytd >= 0 ? GREEN : RED; ctx.textAlign = 'left'; ctx.font = '9px ' + MONO;
      ctx.fillText(`${chSign(idx.ytd)}${fmt(idx.ytd, 1)}%`, x + barW + 4, y + barH / 2 + 3);
    });

    ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('GLOBAL INDICES — YTD PERFORMANCE', pad.left, pad.top - 10);
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
        <div style={S.panelHead}>YTD PERFORMANCE</div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>GLOBAL INDICES<span style={{ color: SUBTLE, fontSize: 9 }}>{GLOBAL_INDICES.length} markets</span></div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>INDEX</th>
                <th style={S.th}>REGION</th>
                <th style={S.th}>LAST</th>
                <th style={S.th}>CHANGE</th>
                <th style={S.th}>%CHG</th>
                <th style={S.th}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {GLOBAL_INDICES.map(idx => (
                <tr key={idx.name}>
                  <td style={{ ...S.td, ...S.tdLeft, color: AMBER, fontWeight: 600 }}>{idx.name}</td>
                  <td style={{ ...S.td, color: BLUE }}>{idx.region}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{fmt(idx.value)}</td>
                  <td style={{ ...S.td, color: chColor(idx.change) }}>{chSign(idx.change)}{fmt(idx.change)}</td>
                  <td style={{ ...S.td, color: chColor(idx.changePct) }}>{chSign(idx.changePct)}{fmt(idx.changePct)}%</td>
                  <td style={{ ...S.td, color: chColor(idx.ytd), fontWeight: 700 }}>{chSign(idx.ytd)}{fmt(idx.ytd, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── Macro Dashboard Tab ───────────────────────────────────── */
const MacroDashboardTab: React.FC = () => (
  <div>
    {/* Heat map */}
    <div style={S.panel}>
      <div style={S.panelHead}>MACRO REGIME INDICATOR</div>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {[
          { label: 'Growth', signal: 'Expansion', color: GREEN, value: 72 },
          { label: 'Inflation', signal: 'Cooling', color: GREEN, value: 65 },
          { label: 'Employment', signal: 'Strong', color: GREEN, value: 80 },
          { label: 'Financial', signal: 'Easy', color: BLUE, value: 58 },
          { label: 'Credit', signal: 'Tight', color: AMBER, value: 42 },
          { label: 'Sentiment', signal: 'Greed', color: AMBER, value: 72 },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: 12, background: `${m.color}10`, border: `1px solid ${m.color}40`, borderRadius: 2 }}>
            <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>{m.label.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ color: m.color, fontSize: 9, marginTop: 4 }}>{m.signal}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Cross-asset */}
    <div style={S.panel}>
      <div style={S.panelHead}>CROSS-ASSET PERFORMANCE</div>
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { asset: 'US Equities', pct: 0.60, mtd: 3.2, ytd: 24.2, color: GREEN },
          { asset: 'US Bonds', pct: 0.15, mtd: 1.8, ytd: -1.5, color: BLUE },
          { asset: 'Gold', pct: 0.62, mtd: 2.4, ytd: 12.8, color: AMBER },
          { asset: 'Oil', pct: 1.59, mtd: -4.2, ytd: -8.5, color: RED },
          { asset: 'DXY', pct: -0.12, mtd: -0.8, ytd: -2.4, color: PURPLE },
          { asset: 'EM Equities', pct: -0.45, mtd: 1.2, ytd: 5.8, color: CYAN },
          { asset: 'REITs', pct: 0.85, mtd: 4.5, ytd: 8.2, color: ORANGE },
          { asset: 'Crypto', pct: 2.45, mtd: 12.4, ytd: 156.2, color: AMBER },
        ].map(a => (
          <div key={a.asset} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 2, padding: 10 }}>
            <div style={{ color: a.color, fontWeight: 600, fontSize: 10, marginBottom: 6 }}>{a.asset}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: SUBTLE, fontSize: 9 }}>1D</span>
              <span style={{ color: chColor(a.pct), fontSize: 10 }}>{chSign(a.pct)}{fmt(a.pct)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: SUBTLE, fontSize: 9 }}>MTD</span>
              <span style={{ color: chColor(a.mtd), fontSize: 10 }}>{chSign(a.mtd)}{fmt(a.mtd, 1)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: SUBTLE, fontSize: 9 }}>YTD</span>
              <span style={{ color: chColor(a.ytd), fontSize: 10, fontWeight: 700 }}>{chSign(a.ytd)}{fmt(a.ytd, 1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Financial conditions */}
    <div style={S.panel}>
      <div style={S.panelHead}>US FINANCIAL CONDITIONS</div>
      <div style={{ padding: 8 }}>
        {[
          { label: 'National Financial Conditions Index', value: -0.42, range: [-1, 1], desc: 'Looser than avg' },
          { label: 'Credit Subindex', value: -0.28, range: [-1, 1], desc: 'Moderately loose' },
          { label: 'Leverage Subindex', value: -0.15, range: [-1, 1], desc: 'Slightly loose' },
          { label: 'Risk Subindex', value: -0.58, range: [-1, 1], desc: 'Loose' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: TEXT, fontSize: 10 }}>{f.label}</span>
              <span style={{ color: f.value < 0 ? GREEN : RED, fontSize: 10, fontWeight: 600 }}>{chSign(f.value)}{fmt(f.value)}</span>
            </div>
            <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, position: 'relative' as const }}>
              <div style={{ position: 'absolute' as const, left: '50%', width: 1, height: 6, background: SUBTLE }} />
              <div style={{
                position: 'absolute' as const,
                left: `${50 + (f.value / (f.range[1] - f.range[0])) * 100}%`,
                width: 8, height: 8, borderRadius: '50%', background: f.value < 0 ? GREEN : RED,
                top: -1, transform: 'translateX(-4px)'
              }} />
            </div>
            <div style={{ color: SUBTLE, fontSize: 8, marginTop: 2 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main Component ────────────────────────────────────────── */
const TABS = ['CALENDAR', 'INDICATORS', 'CENTRAL BANKS', 'GLOBAL MARKETS', 'DASHBOARD'] as const;
type Tab = typeof TABS[number];

export default function MacroUI2() {
  const [tab, setTab] = useState<Tab>('CALENDAR');

  return (
    <div style={S.root}>
      <KPIStrip />
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={S.body}>
        {tab === 'CALENDAR' && <CalendarTab />}
        {tab === 'INDICATORS' && <IndicatorsTab />}
        {tab === 'CENTRAL BANKS' && <CentralBanksTab />}
        {tab === 'GLOBAL MARKETS' && <GlobalMarketsTab />}
        {tab === 'DASHBOARD' && <MacroDashboardTab />}
      </div>
    </div>
  );
}
