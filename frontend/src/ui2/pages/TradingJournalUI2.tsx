/**
 * TradingJournalUI2 — Trade Journal & Performance Diary
 * Tag trades, attach screenshots, track patterns/emotions,
 * daily P/L calendar, win/loss streaks, pattern analytics.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface JournalEntry {
  id: number; date: string; symbol: string; side: 'LONG' | 'SHORT';
  entryPrice: number; exitPrice: number; qty: number; pnl: number;
  setup: string; emotion: string; tags: string[];
  notes: string; rating: number; screenshot: boolean; timeframe: string;
  conviction: number; riskReward: number;
}

interface DailyPnl { date: string; pnl: number; trades: number }
interface SetupStat { setup: string; trades: number; wins: number; pnl: number; avgR: number }

/* ─── Mock Data ───────────────────────────────────────────────────────── */
const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Range', 'Gap Fill', 'Momentum', 'Mean Reversion', 'News Catalyst', 'Earnings Play', 'Triple Top'];
const EMOTIONS = ['Confident', 'Fearful', 'FOMO', 'Greedy', 'Disciplined', 'Impatient', 'Calm', 'Anxious', 'Revenge', 'Neutral'];
const TAGS = ['Trend Following', 'Counter-Trend', 'Pre-Market', 'After Hours', 'Large Cap', 'Small Cap', 'High Volume', 'Sector Rotation', 'Catalyst', 'Technical', 'Fundamental', 'Scalp'];

function genEntries(): JournalEntry[] {
  let s = 77;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const syms = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM', 'COIN', 'SQ', 'PLTR', 'SOFI', 'RIVN'];
  const entries: JournalEntry[] = [];

  for (let i = 0; i < 80; i++) {
    const d = new Date(2024, 0, 1);
    d.setDate(d.getDate() + Math.floor(rng() * 270));
    const sym = syms[Math.floor(rng() * syms.length)];
    const side = rng() > 0.4 ? 'LONG' : 'SHORT' as const;
    const entry = 50 + rng() * 400;
    const pnlPct = (rng() - 0.45) * 0.08;
    const exit = entry * (1 + (side === 'LONG' ? pnlPct : -pnlPct));
    const qty = Math.floor(rng() * 200 + 10);
    const pnl = (exit - entry) * qty * (side === 'LONG' ? 1 : -1);
    const setup = SETUPS[Math.floor(rng() * SETUPS.length)];
    const emotion = EMOTIONS[Math.floor(rng() * EMOTIONS.length)];
    const nTags = Math.floor(rng() * 3) + 1;
    const tags: string[] = [];
    for (let j = 0; j < nTags; j++) {
      const t = TAGS[Math.floor(rng() * TAGS.length)];
      if (!tags.includes(t)) tags.push(t);
    }
    const notes = pnl > 0 
      ? `Good execution on ${setup.toLowerCase()} setup. Followed the plan.`
      : `Stopped out. ${emotion === 'FOMO' ? 'Entered too late.' : 'Need to wait for confirmation.'}`;

    entries.push({
      id: i + 1, date: d.toISOString().split('T')[0], symbol: sym, side,
      entryPrice: entry, exitPrice: exit, qty, pnl, setup, emotion, tags, notes,
      rating: Math.floor(rng() * 5) + 1, screenshot: rng() > 0.5,
      timeframe: ['1m', '5m', '15m', '1H', '4H', '1D'][Math.floor(rng() * 6)],
      conviction: Math.floor(rng() * 10) + 1,
      riskReward: 0.5 + rng() * 4,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/* ─── Canvas: P/L Calendar ────────────────────────────────────────────── */
function PnLCalendar({ entries, month, year }: { entries: JournalEntry[]; month: number; year: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellW = (w - 20) / 7, cellH = Math.min(40, (h - 40) / 6);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Header
    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    days.forEach((d, i) => ctx.fillText(d, 10 + i * cellW + cellW / 2, 15));

    // Daily PnL map
    const dailyPnl: Record<number, number> = {};
    entries.forEach(e => {
      const d = new Date(e.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        dailyPnl[d.getDate()] = (dailyPnl[d.getDate()] || 0) + e.pnl;
      }
    });

    // Cells
    for (let day = 1; day <= daysInMonth; day++) {
      const pos = firstDay + day - 1;
      const col = pos % 7, row = Math.floor(pos / 7);
      const x = 10 + col * cellW, y = 22 + row * cellH;
      const pnl = dailyPnl[day] ?? null;

      if (pnl !== null) {
        const intensity = Math.min(0.5, Math.abs(pnl) / 5000);
        ctx.fillStyle = pnl >= 0 ? `rgba(38,166,154,${intensity + 0.1})` : `rgba(239,83,80,${intensity + 0.1})`;
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
      ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, cellW, cellH);

      ctx.fillStyle = pnl !== null ? '#eee' : '#444'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${day}`, x + 3, y + 12);

      if (pnl !== null) {
        ctx.fillStyle = pnl >= 0 ? GREEN : RED; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'right';
        ctx.fillText(`${pnl >= 0 ? '+' : ''}$${Math.abs(pnl) >= 1000 ? (pnl / 1000).toFixed(1) + 'K' : pnl.toFixed(0)}`, x + cellW - 3, y + cellH - 5);
      }
    }
  }, [entries, month, year]);
  return <canvas ref={ref} style={{ width: '100%', height: 280, borderRadius: 4 }} />;
}

/* ─── Canvas: Cumulative P/L ──────────────────────────────────────────── */
function CumulativePnLChart({ entries }: { entries: JournalEntry[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    const points = sorted.map(e => { cum += e.pnl; return cum; });
    if (points.length === 0) return;

    const minP = Math.min(0, ...points), maxP = Math.max(0, ...points);
    const range = maxP - minP || 1;
    const pad = { l: 50, r: 10, t: 10, b: 20 };
    const px = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
    const py = (v: number) => pad.t + ((maxP - v) / range) * (h - pad.t - pad.b);

    // Zero line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, py(0)); ctx.lineTo(w - pad.r, py(0)); ctx.stroke();

    // Area
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    points.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(points.length - 1), py(0));
    ctx.closePath();
    ctx.fillStyle = cum >= 0 ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)';
    ctx.fill();

    // Line
    ctx.strokeStyle = cum >= 0 ? GREEN : RED; ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.stroke();

    // Current value
    ctx.fillStyle = cum >= 0 ? GREEN : RED; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`$${cum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, px(points.length - 1) - 50, py(cum) - 8);

    // Axis
    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`$${maxP.toFixed(0)}`, pad.l - 5, pad.t + 8);
    ctx.fillText(`$${minP.toFixed(0)}`, pad.l - 5, h - pad.b);
  }, [entries]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['JOURNAL', 'CALENDAR', 'ANALYTICS', 'PATTERNS'] as const;
type Tab = typeof TABS[number];

export default function TradingJournalUI2() {
  const [tab, setTab] = useState<Tab>('JOURNAL');
  const [entries] = useState(() => genEntries());
  const [filter, setFilter] = useState('');
  const [filterSetup, setFilterSetup] = useState('All');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(2024);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filter && !e.symbol.toLowerCase().includes(filter.toLowerCase()) && !e.setup.toLowerCase().includes(filter.toLowerCase())) return false;
      if (filterSetup !== 'All' && e.setup !== filterSetup) return false;
      return true;
    });
  }, [entries, filter, filterSetup]);

  const stats = useMemo(() => {
    const wins = filtered.filter(e => e.pnl > 0);
    const losses = filtered.filter(e => e.pnl <= 0);
    return {
      total: filtered.length,
      wins: wins.length,
      losses: losses.length,
      winRate: wins.length / (filtered.length || 1) * 100,
      totalPnl: filtered.reduce((s, e) => s + e.pnl, 0),
      avgWin: wins.length > 0 ? wins.reduce((s, e) => s + e.pnl, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((s, e) => s + e.pnl, 0) / losses.length : 0,
      bestTrade: Math.max(...filtered.map(e => e.pnl)),
      worstTrade: Math.min(...filtered.map(e => e.pnl)),
      avgRating: filtered.reduce((s, e) => s + e.rating, 0) / (filtered.length || 1),
    };
  }, [filtered]);

  const setupStats = useMemo((): SetupStat[] => {
    const map = new Map<string, { trades: number; wins: number; pnl: number; totalR: number }>();
    filtered.forEach(e => {
      const cur = map.get(e.setup) || { trades: 0, wins: 0, pnl: 0, totalR: 0 };
      cur.trades++;
      if (e.pnl > 0) cur.wins++;
      cur.pnl += e.pnl;
      cur.totalR += e.riskReward;
      map.set(e.setup, cur);
    });
    return Array.from(map.entries()).map(([setup, d]) => ({
      setup, trades: d.trades, wins: d.wins, pnl: d.pnl, avgR: d.totalR / d.trades,
    })).sort((a, b) => b.pnl - a.pnl);
  }, [filtered]);

  const emotionStats = useMemo(() => {
    const map = new Map<string, { trades: number; wins: number; pnl: number }>();
    filtered.forEach(e => {
      const cur = map.get(e.emotion) || { trades: 0, wins: 0, pnl: 0 };
      cur.trades++; if (e.pnl > 0) cur.wins++; cur.pnl += e.pnl;
      map.set(e.emotion, cur);
    });
    return Array.from(map.entries()).map(([emotion, d]) => ({
      emotion, ...d, winRate: d.wins / d.trades * 100,
    })).sort((a, b) => b.pnl - a.pnl);
  }, [filtered]);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>📓 TRADING JOURNAL</span>
          <input placeholder="Search symbol/setup..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ width: 180, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 10px', fontSize: 11 }} />
          <select value={filterSetup} onChange={e => setFilterSetup(e.target.value)}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '4px 8px', fontSize: 11 }}>
            <option>All</option>
            {SETUPS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: stats.totalPnl >= 0 ? GREEN : RED, fontWeight: 700, fontSize: 16 }}>
            {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span style={{ color: MUTED, fontSize: 10 }}>
            {stats.wins}W / {stats.losses}L ({stats.winRate.toFixed(0)}%)
          </span>
          <button style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 4, padding: '5px 14px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ NEW ENTRY</button>
        </div>
      </div>

      {/* Tabs */}
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
        {tab === 'JOURNAL' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedEntry ? '1fr 350px' : '1fr', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
                      {['Date', 'Symbol', 'Side', 'Entry', 'Exit', 'P/L', 'Setup', 'Emotion', 'Rating', 'Tags'].map(h => (
                        <th key={h} style={{ padding: '6px 6px', textAlign: 'left', color: MUTED, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map(e => (
                      <tr key={e.id} onClick={() => setSelectedEntry(e)} style={{
                        borderBottom: `1px solid ${BORDER}22`, cursor: 'pointer',
                        background: selectedEntry?.id === e.id ? 'rgba(245,166,35,0.05)' : 'transparent',
                      }}>
                        <td style={{ padding: '5px 6px', color: MUTED }}>{e.date}</td>
                        <td style={{ padding: '5px 6px', fontWeight: 700 }}>{e.symbol}</td>
                        <td style={{ padding: '5px 6px' }}>
                          <span style={{ padding: '1px 4px', borderRadius: 2, fontSize: 9, background: e.side === 'LONG' ? `${GREEN}22` : `${RED}22`, color: e.side === 'LONG' ? GREEN : RED }}>{e.side}</span>
                        </td>
                        <td style={{ padding: '5px 6px' }}>${e.entryPrice.toFixed(2)}</td>
                        <td style={{ padding: '5px 6px' }}>${e.exitPrice.toFixed(2)}</td>
                        <td style={{ padding: '5px 6px', color: e.pnl > 0 ? GREEN : RED, fontWeight: 700 }}>{e.pnl > 0 ? '+' : ''}${e.pnl.toFixed(0)}</td>
                        <td style={{ padding: '5px 6px' }}><span style={{ padding: '1px 6px', borderRadius: 3, background: `${AMBER}12`, color: AMBER, fontSize: 9 }}>{e.setup}</span></td>
                        <td style={{ padding: '5px 6px', color: ['Confident', 'Disciplined', 'Calm'].includes(e.emotion) ? GREEN : ['FOMO', 'Revenge', 'Greedy'].includes(e.emotion) ? RED : MUTED, fontSize: 10 }}>{e.emotion}</td>
                        <td style={{ padding: '5px 6px' }}>{'★'.repeat(e.rating)}<span style={{ color: '#333' }}>{'★'.repeat(5 - e.rating)}</span></td>
                        <td style={{ padding: '5px 6px' }}>
                          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {e.tags.slice(0, 2).map(t => (
                              <span key={t} style={{ padding: '1px 4px', borderRadius: 2, fontSize: 8, background: '#1a1a1a', color: MUTED }}>{t}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedEntry && (
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TRADE DETAIL</span>
                  <button onClick={() => setSelectedEntry(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedEntry.symbol}</span>
                  <span style={{ color: selectedEntry.pnl > 0 ? GREEN : RED, fontWeight: 700, fontSize: 16 }}>
                    {selectedEntry.pnl > 0 ? '+' : ''}${selectedEntry.pnl.toFixed(0)}
                  </span>
                </div>
                {[
                  { l: 'Date', v: selectedEntry.date },
                  { l: 'Side', v: selectedEntry.side, c: selectedEntry.side === 'LONG' ? GREEN : RED },
                  { l: 'Entry', v: `$${selectedEntry.entryPrice.toFixed(2)}` },
                  { l: 'Exit', v: `$${selectedEntry.exitPrice.toFixed(2)}` },
                  { l: 'Quantity', v: selectedEntry.qty.toString() },
                  { l: 'Timeframe', v: selectedEntry.timeframe },
                  { l: 'Setup', v: selectedEntry.setup },
                  { l: 'Emotion', v: selectedEntry.emotion },
                  { l: 'Conviction', v: `${selectedEntry.conviction}/10` },
                  { l: 'R:R', v: `${selectedEntry.riskReward.toFixed(1)}` },
                  { l: 'Rating', v: '★'.repeat(selectedEntry.rating) },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ color: MUTED }}>{s.l}</span>
                    <span style={{ color: (s as any).c || '#eee', fontWeight: 600 }}>{s.v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 10 }}>
                  <span style={{ color: MUTED }}>Tags:</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {selectedEntry.tags.map(t => (
                      <span key={t} style={{ padding: '2px 6px', borderRadius: 3, background: '#1a1a1a', color: AMBER, fontSize: 9 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: 8, background: '#0a0a0a', borderRadius: 4, fontSize: 10, color: '#ccc', lineHeight: 1.5 }}>
                  <span style={{ color: MUTED, fontSize: 9 }}>NOTES</span><br />
                  {selectedEntry.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'CALENDAR' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={() => { calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }}
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, color: MUTED, padding: '2px 8px', cursor: 'pointer' }}>◀</button>
                <span style={{ fontWeight: 700 }}>
                  {new Date(calYear, calMonth).toLocaleString('default', { month: 'long' })} {calYear}
                </span>
                <button onClick={() => { calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }}
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, color: MUTED, padding: '2px 8px', cursor: 'pointer' }}>▶</button>
              </div>
              <PnLCalendar entries={entries} month={calMonth} year={calYear} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CUMULATIVE P/L</span>
                <CumulativePnLChart entries={entries} />
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>DAY OF WEEK</span>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                  const dayEntries = entries.filter(e => {
                    const d = new Date(e.date); return d.toLocaleString('default', { weekday: 'short' }) === day;
                  });
                  const pnl = dayEntries.reduce((s, e) => s + e.pnl, 0);
                  const wr = dayEntries.filter(e => e.pnl > 0).length / (dayEntries.length || 1) * 100;
                  return (
                    <div key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                      <span style={{ width: 30, fontWeight: 600 }}>{day}</span>
                      <div style={{ flex: 1, mx: 8, height: 6, background: '#1a1a1a', borderRadius: 3, margin: '0 8px' }}>
                        <div style={{ width: `${wr}%`, height: '100%', background: wr > 55 ? GREEN : wr > 45 ? AMBER : RED, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: pnl > 0 ? GREEN : RED, fontWeight: 600, width: 60, textAlign: 'right' }}>
                        ${pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'ANALYTICS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SETUP PERFORMANCE</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Setup', 'Trades', 'Win%', 'P/L', 'Avg R'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setupStats.map(s => (
                    <tr key={s.setup} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 600 }}>{s.setup}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{s.trades}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: s.wins / s.trades > 0.55 ? GREEN : s.wins / s.trades > 0.45 ? AMBER : RED }}>
                        {(s.wins / s.trades * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: s.pnl > 0 ? GREEN : RED, fontWeight: 700 }}>
                        {s.pnl > 0 ? '+' : ''}${s.pnl.toFixed(0)}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{s.avgR.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EMOTION IMPACT</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Emotion', 'Trades', 'Win%', 'P/L'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emotionStats.map(s => (
                    <tr key={s.emotion} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 600,
                        color: ['Confident', 'Disciplined', 'Calm'].includes(s.emotion) ? GREEN :
                               ['FOMO', 'Revenge', 'Greedy'].includes(s.emotion) ? RED : '#eee'
                      }}>{s.emotion}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{s.trades}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: s.winRate > 55 ? GREEN : s.winRate > 45 ? AMBER : RED }}>
                        {s.winRate.toFixed(0)}%
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: s.pnl > 0 ? GREEN : RED, fontWeight: 700 }}>
                        {s.pnl > 0 ? '+' : ''}${s.pnl.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'PATTERNS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>KEY METRICS</span>
              {[
                { l: 'Total Trades', v: stats.total },
                { l: 'Win Rate', v: `${stats.winRate.toFixed(0)}%`, c: stats.winRate > 55 ? GREEN : AMBER },
                { l: 'Avg Win', v: `$${stats.avgWin.toFixed(0)}`, c: GREEN },
                { l: 'Avg Loss', v: `$${stats.avgLoss.toFixed(0)}`, c: RED },
                { l: 'Best Trade', v: `+$${stats.bestTrade.toFixed(0)}`, c: GREEN },
                { l: 'Worst Trade', v: `$${stats.worstTrade.toFixed(0)}`, c: RED },
                { l: 'Avg Rating', v: `${'★'.repeat(Math.round(stats.avgRating))}` },
                { l: 'Profit Factor', v: (Math.abs(stats.avgWin * stats.wins) / Math.abs(stats.avgLoss * stats.losses || 1)).toFixed(2) },
              ].map(s => (
                <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                  <span style={{ color: MUTED }}>{s.l}</span>
                  <span style={{ color: (s as any).c || '#eee', fontWeight: 600 }}>{s.v}</span>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TOP SYMBOLS</span>
              {Array.from(new Set(entries.map(e => e.symbol))).map(sym => {
                const symEntries = entries.filter(e => e.symbol === sym);
                const pnl = symEntries.reduce((s, e) => s + e.pnl, 0);
                return { sym, trades: symEntries.length, pnl };
              }).sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(s => (
                <div key={s.sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                  <span style={{ fontWeight: 600 }}>{s.sym} <span style={{ color: MUTED, fontWeight: 400 }}>({s.trades})</span></span>
                  <span style={{ color: s.pnl > 0 ? GREEN : RED, fontWeight: 700 }}>${s.pnl > 0 ? '+' : ''}{s.pnl.toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TAG PERFORMANCE</span>
              {Array.from(new Set(entries.flatMap(e => e.tags))).map(tag => {
                const tagEntries = entries.filter(e => e.tags.includes(tag));
                const pnl = tagEntries.reduce((s, e) => s + e.pnl, 0);
                return { tag, trades: tagEntries.length, pnl };
              }).sort((a, b) => b.pnl - a.pnl).map(s => (
                <div key={s.tag} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                  <span style={{ color: AMBER, fontSize: 9 }}>#{s.tag} <span style={{ color: MUTED }}>({s.trades})</span></span>
                  <span style={{ color: s.pnl > 0 ? GREEN : RED, fontWeight: 600 }}>${s.pnl > 0 ? '+' : ''}{s.pnl.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
