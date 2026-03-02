/**
 * EarningsCalendarUI2 — Earnings Calendar, Estimates, Surprises
 * Upcoming earnings, historical surprise %, whisper numbers,
 * sector-level earnings trends, earnings volatility crush.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

interface EarningsEvent {
  id: number; date: string; symbol: string; name: string; sector: string;
  time: 'BMO' | 'AMC' | 'DMH'; // Before Market Open, After Market Close, During Market Hours
  epsCons: number; epsWhisper: number; epsActual: number | null;
  revCons: number; revActual: number | null;
  surprise: number | null; ivCrush: number;
  priceMove: number | null; confirmed: boolean;
  marketCap: number; optionsVol: number;
  history: { quarter: string; eps: number; estimate: number; surprise: number }[];
}

/* ─── Mock ──────────────────────────────────────────────────────────── */
function genEvents(): EarningsEvent[] {
  let s = 67;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  const companies = [
    { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', mcap: 3200 },
    { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', mcap: 3100 },
    { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology', mcap: 2800 },
    { symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication', mcap: 2100 },
    { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Disc.', mcap: 1900 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Communication', mcap: 1200 },
    { symbol: 'TSLA', name: 'Tesla', sector: 'Consumer Disc.', mcap: 800 },
    { symbol: 'JPM', name: 'JPMorgan', sector: 'Financials', mcap: 600 },
    { symbol: 'V', name: 'Visa', sector: 'Financials', mcap: 550 },
    { symbol: 'JNJ', name: 'Johnson & J', sector: 'Healthcare', mcap: 430 },
    { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', mcap: 520 },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Disc.', mcap: 370 },
    { symbol: 'PG', name: 'Procter & G', sector: 'Consumer Stpl.', mcap: 380 },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', mcap: 420 },
    { symbol: 'BAC', name: 'Bank of Am.', sector: 'Financials', mcap: 300 },
    { symbol: 'DIS', name: 'Walt Disney', sector: 'Communication', mcap: 190 },
    { symbol: 'NFLX', name: 'Netflix', sector: 'Communication', mcap: 250 },
    { symbol: 'AMD', name: 'AMD', sector: 'Technology', mcap: 220 },
    { symbol: 'CRM', name: 'Salesforce', sector: 'Technology', mcap: 280 },
    { symbol: 'COST', name: 'Costco', sector: 'Consumer Stpl.', mcap: 340 },
    { symbol: 'COIN', name: 'Coinbase', sector: 'Financials', mcap: 40 },
    { symbol: 'SQ', name: 'Block Inc', sector: 'Technology', mcap: 35 },
    { symbol: 'PLTR', name: 'Palantir', sector: 'Technology', mcap: 45 },
    { symbol: 'NKE', name: 'Nike', sector: 'Consumer Disc.', mcap: 130 },
    { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials', mcap: 180 },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', mcap: 160 },
    { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare', mcap: 700 },
    { symbol: 'AVGO', name: 'Broadcom', sector: 'Technology', mcap: 600 },
  ];

  const events: EarningsEvent[] = [];
  const today = new Date(2024, 9, 14); // Mid October

  companies.forEach((co, idx) => {
    const offset = Math.floor(rng() * 30) - 10;
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    const isPast = offset < 0;
    const times = ['BMO', 'AMC', 'DMH'] as const;
    const eps = 1 + rng() * 6;
    const epsCons = eps * (1 + (rng() - 0.5) * 0.1);
    const epsWhisper = epsCons * (1 + (rng() - 0.45) * 0.05);
    const surprisePct = (rng() - 0.35) * 20;
    const rev = co.mcap * (0.02 + rng() * 0.05);

    const history = ['Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024'].map(q => {
      const est = eps * (0.85 + rng() * 0.3);
      const act = est * (1 + (rng() - 0.4) * 0.15);
      return { quarter: q, eps: act, estimate: est, surprise: ((act - est) / est) * 100 };
    });

    events.push({
      id: idx, date: dateStr, symbol: co.symbol, name: co.name, sector: co.sector,
      time: times[Math.floor(rng() * times.length)],
      epsCons: +epsCons.toFixed(2), epsWhisper: +epsWhisper.toFixed(2),
      epsActual: isPast ? +(epsCons * (1 + surprisePct / 100)).toFixed(2) : null,
      revCons: +rev.toFixed(0), revActual: isPast ? +(rev * (1 + (rng() - 0.4) * 0.08)).toFixed(0) : null,
      surprise: isPast ? surprisePct : null,
      ivCrush: 15 + rng() * 40,
      priceMove: isPast ? (rng() - 0.45) * 15 : null,
      confirmed: rng() > (isPast ? 0 : 0.3),
      marketCap: co.mcap,
      optionsVol: Math.floor(50000 + rng() * 500000),
      history,
    });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Canvas: Surprise History ───────────────────────────────────────── */
function SurpriseChart({ event }: { event: EarningsEvent }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);

    const hist = event.history;
    const pad = { l: 40, r: 10, t: 10, b: 30 };
    const barW = (w - pad.l - pad.r) / hist.length * 0.6;
    const gap = (w - pad.l - pad.r) / hist.length;
    const maxS = Math.max(10, Math.max(...hist.map(h2 => Math.abs(h2.surprise))));

    // Zero line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, h / 2); ctx.lineTo(w - pad.r, h / 2); ctx.stroke();

    hist.forEach((h2, i) => {
      const x = pad.l + i * gap + (gap - barW) / 2;
      const barH = (h2.surprise / maxS) * ((h - pad.t - pad.b) / 2);
      const y = h / 2 - (h2.surprise > 0 ? barH : 0);

      ctx.fillStyle = h2.surprise >= 0 ? GREEN : RED;
      ctx.fillRect(x, y, barW, Math.abs(barH));

      // Label
      ctx.fillStyle = MUTED; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(h2.quarter, x + barW / 2, h - pad.b + 10);
      ctx.fillStyle = h2.surprise >= 0 ? GREEN : RED; ctx.font = 'bold 7px monospace';
      ctx.fillText(`${h2.surprise >= 0 ? '+' : ''}${h2.surprise.toFixed(1)}%`, x + barW / 2, h2.surprise >= 0 ? y - 3 : y + Math.abs(barH) + 10);
    });

    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`+${maxS.toFixed(0)}%`, pad.l - 3, pad.t + 8);
    ctx.fillText(`-${maxS.toFixed(0)}%`, pad.l - 3, h - pad.b);
  }, [event]);
  return <canvas ref={ref} style={{ width: '100%', height: 120, borderRadius: 4 }} />;
}

const TABS = ['THIS WEEK', 'CALENDAR', 'RESULTS', 'VOLATILITY'] as const;
type Tab = typeof TABS[number];

export default function EarningsCalendarUI2() {
  const [tab, setTab] = useState<Tab>('THIS WEEK');
  const [events] = useState(() => genEvents());
  const [selectedEvent, setSelectedEvent] = useState<EarningsEvent | null>(null);
  const [filterSector, setFilterSector] = useState('All');

  const sectors = useMemo(() => ['All', ...new Set(events.map(e => e.sector))], [events]);
  const filtered = useMemo(() => {
    return events.filter(e => filterSector === 'All' || e.sector === filterSector);
  }, [events, filterSector]);

  const upcoming = filtered.filter(e => e.epsActual === null);
  const reported = filtered.filter(e => e.epsActual !== null);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>📆 EARNINGS CALENDAR</span>
          <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '3px 8px', fontSize: 10 }}>
            {sectors.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 8, color: MUTED }}>Upcoming</div><div style={{ fontWeight: 700, color: AMBER }}>{upcoming.length}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 8, color: MUTED }}>Reported</div><div style={{ fontWeight: 700, color: GREEN }}>{reported.length}</div></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: MUTED }}>Beat %</div>
            <div style={{ fontWeight: 700, color: GREEN }}>
              {reported.length > 0 ? (reported.filter(e => (e.surprise ?? 0) > 0).length / reported.length * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'THIS WEEK' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 320px' : '1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 8, display: 'block' }}>UPCOMING EARNINGS</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
                    {['Date', 'Time', 'Symbol', 'Company', 'EPS Est', 'Whisper', 'Rev Est', 'IV Crush', 'Opts Vol', 'Status'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Company' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map(e => (
                    <tr key={e.id} onClick={() => setSelectedEvent(e)} style={{
                      cursor: 'pointer', borderBottom: `1px solid ${BORDER}22`,
                      background: selectedEvent?.id === e.id ? 'rgba(245,166,35,0.05)' : 'transparent',
                    }}>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED }}>{e.date}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        <span style={{
                          padding: '1px 4px', borderRadius: 2, fontSize: 8,
                          background: e.time === 'BMO' ? `${AMBER}22` : e.time === 'AMC' ? '#5599ee22' : '#88888822',
                          color: e.time === 'BMO' ? AMBER : e.time === 'AMC' ? '#5599ee' : MUTED,
                        }}>{e.time}</span>
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>{e.symbol}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'left', color: MUTED }}>{e.name}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>${e.epsCons.toFixed(2)}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: e.epsWhisper > e.epsCons ? GREEN : RED }}>
                        ${e.epsWhisper.toFixed(2)}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED }}>${(e.revCons / 1000).toFixed(1)}B</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: e.ivCrush > 30 ? AMBER : MUTED }}>
                        {e.ivCrush.toFixed(0)}%
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED }}>{(e.optionsVol / 1000).toFixed(0)}K</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        <span style={{ padding: '1px 4px', borderRadius: 2, fontSize: 8,
                          background: e.confirmed ? `${GREEN}22` : `${MUTED}22`, color: e.confirmed ? GREEN : MUTED }}>
                          {e.confirmed ? 'CONFIRMED' : 'TENTATIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedEvent && (
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedEvent.symbol}</span>
                    <div style={{ color: MUTED, fontSize: 10 }}>{selectedEvent.name}</div>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: AMBER, fontWeight: 600, fontSize: 10 }}>SURPRISE HISTORY</span>
                  <SurpriseChart event={selectedEvent} />
                </div>
                {[
                  { l: 'Report Date', v: selectedEvent.date },
                  { l: 'Timing', v: selectedEvent.time },
                  { l: 'EPS Consensus', v: `$${selectedEvent.epsCons.toFixed(2)}` },
                  { l: 'EPS Whisper', v: `$${selectedEvent.epsWhisper.toFixed(2)}`, c: selectedEvent.epsWhisper > selectedEvent.epsCons ? GREEN : RED },
                  { l: 'Revenue Est', v: `$${(selectedEvent.revCons / 1000).toFixed(1)}B` },
                  { l: 'Implied Move', v: `±${selectedEvent.ivCrush.toFixed(1)}%` },
                  { l: 'Market Cap', v: `$${selectedEvent.marketCap}B` },
                  { l: 'Options Volume', v: `${(selectedEvent.optionsVol / 1000).toFixed(0)}K` },
                  { l: 'Sector', v: selectedEvent.sector },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ color: MUTED }}>{s.l}</span>
                    <span style={{ color: (s as any).c || '#eee', fontWeight: 600 }}>{s.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'CALENDAR' && (
          <div style={panelStyle}>
            <span style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 8, display: 'block' }}>WEEKLY CALENDAR VIEW</span>
            {(() => {
              const byDate = new Map<string, EarningsEvent[]>();
              filtered.forEach(e => {
                const list = byDate.get(e.date) || [];
                list.push(e);
                byDate.set(e.date, list);
              });
              const dates = [...byDate.keys()].sort();
              return dates.map(date => (
                <div key={date} style={{ marginBottom: 12, borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: AMBER, fontSize: 11 }}>
                      {new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ color: MUTED, fontSize: 9 }}>({byDate.get(date)!.length} reports)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                    {byDate.get(date)!.map(e => (
                      <div key={e.id} onClick={() => setSelectedEvent(e)} style={{
                        padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                        background: e.epsActual !== null
                          ? (e.surprise ?? 0) > 0 ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)'
                          : '#0a0a0a',
                        border: `1px solid ${BORDER}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 10 }}>{e.symbol}</span>
                          <span style={{
                            fontSize: 7, padding: '1px 3px', borderRadius: 2,
                            background: e.time === 'BMO' ? `${AMBER}22` : '#5599ee22',
                            color: e.time === 'BMO' ? AMBER : '#5599ee',
                          }}>{e.time}</span>
                        </div>
                        <div style={{ fontSize: 9, color: MUTED }}>{e.name}</div>
                        <div style={{ fontSize: 9, marginTop: 2, color: e.epsActual !== null ? (e.surprise ?? 0) > 0 ? GREEN : RED : '#eee' }}>
                          {e.epsActual !== null
                            ? `${(e.surprise ?? 0) > 0 ? '▲' : '▼'} ${e.surprise?.toFixed(1)}% surprise`
                            : `Est: $${e.epsCons.toFixed(2)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {tab === 'RESULTS' && (
          <div style={panelStyle}>
            <span style={{ color: GREEN, fontWeight: 600, fontSize: 11, marginBottom: 8, display: 'block' }}>RECENT RESULTS</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Date', 'Symbol', 'Company', 'EPS Est', 'EPS Act', 'Surprise', 'Rev Est', 'Rev Act', 'Price Move'].map(h => (
                    <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Company' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reported.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                  <tr key={e.id} style={{
                    borderBottom: `1px solid ${BORDER}22`,
                    background: (e.surprise ?? 0) > 5 ? 'rgba(38,166,154,0.03)' : (e.surprise ?? 0) < -5 ? 'rgba(239,83,80,0.03)' : 'transparent',
                  }}>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED }}>{e.date}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>{e.symbol}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'left', color: MUTED }}>{e.name}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>${e.epsCons.toFixed(2)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: (e.epsActual ?? 0) > e.epsCons ? GREEN : RED }}>
                      ${e.epsActual?.toFixed(2)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      <span style={{
                        padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                        background: (e.surprise ?? 0) > 0 ? `${GREEN}22` : `${RED}22`,
                        color: (e.surprise ?? 0) > 0 ? GREEN : RED,
                      }}>{(e.surprise ?? 0) > 0 ? '+' : ''}{e.surprise?.toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED }}>${(e.revCons / 1000).toFixed(1)}B</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: (e.revActual ?? 0) > e.revCons ? GREEN : RED }}>
                      ${((e.revActual ?? 0) / 1000).toFixed(1)}B
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: (e.priceMove ?? 0) > 0 ? GREEN : RED }}>
                      {(e.priceMove ?? 0) > 0 ? '+' : ''}{e.priceMove?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'VOLATILITY' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>IMPLIED MOVE (IV CRUSH)</span>
              {[...filtered].sort((a, b) => b.ivCrush - a.ivCrush).slice(0, 15).map(e => {
                const maxIV = Math.max(...filtered.map(ev => ev.ivCrush));
                return (
                  <div key={e.id} style={{ padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>
                        <span style={{ fontWeight: 700 }}>{e.symbol}</span>
                        <span style={{ color: MUTED, marginLeft: 6, fontSize: 9 }}>{e.date}</span>
                      </span>
                      <span style={{ color: e.ivCrush > 30 ? AMBER : MUTED, fontWeight: 600 }}>±{e.ivCrush.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3 }}>
                      <div style={{ width: `${(e.ivCrush / maxIV) * 100}%`, height: '100%', borderRadius: 3,
                        background: `linear-gradient(90deg, ${GREEN}, ${AMBER}, ${RED})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EARNINGS STRADDLE</span>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>Implied vs Realized Move</div>
              {reported.sort((a, b) => Math.abs(b.priceMove ?? 0) - Math.abs(a.priceMove ?? 0)).slice(0, 12).map(e => {
                const implied = e.ivCrush;
                const realized = Math.abs(e.priceMove ?? 0);
                const straddleWin = realized > implied;
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ width: 42, fontWeight: 700 }}>{e.symbol}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ color: MUTED, fontSize: 8, width: 40 }}>Implied</span>
                        <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(100, implied * 2)}%`, height: '100%', background: AMBER, borderRadius: 2 }} />
                        </div>
                        <span style={{ width: 35, textAlign: 'right', color: AMBER }}>{implied.toFixed(1)}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ color: MUTED, fontSize: 8, width: 40 }}>Actual</span>
                        <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(100, realized * 2)}%`, height: '100%', background: straddleWin ? GREEN : RED, borderRadius: 2 }} />
                        </div>
                        <span style={{ width: 35, textAlign: 'right', color: straddleWin ? GREEN : RED }}>{realized.toFixed(1)}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2,
                      background: straddleWin ? `${GREEN}22` : `${RED}22`, color: straddleWin ? GREEN : RED }}>
                      {straddleWin ? 'WIN' : 'LOSE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
