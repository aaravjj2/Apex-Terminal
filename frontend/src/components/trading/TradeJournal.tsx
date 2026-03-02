import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  setup: string;
  strategy: string;
  emotion: string;
  notes: string;
  lessons: string;
  rating: number;
  screenshot: string | null;
  tags: string[];
}

interface TradeJournalProps {
  className?: string;
}

type ViewMode = 'list' | 'calendar';
type FilterKey = 'all' | 'winners' | 'losers';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Gap Fill', 'Trend Follow', 'Mean Reversion', 'Momentum', 'Range Trade'];
const STRATEGIES = ['Swing', 'Scalp', 'Day Trade', 'Position', 'Earnings Play', 'Catalyst'];
const EMOTIONS = ['Confident', 'Fearful', 'Greedy', 'Neutral', 'FOMO', 'Revenge', 'Disciplined', 'Anxious'];
const TAGS = ['high-conviction', 'paper-trade', 'earnings', 'sector-rotation', 'technical', 'fundamental', 'macro', 'news-driven'];

function genEntries(): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];
  for (let i = 0; i < 40; i++) {
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const side = Math.random() > 0.4 ? 'LONG' as const : 'SHORT' as const;
    const entry = 100 + Math.random() * 500;
    const pnlPct = (Math.random() - 0.42) * 15;
    const exit = entry * (1 + pnlPct / 100);
    const qty = Math.floor(Math.random() * 300 + 20);
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 60));

    entries.push({
      id: `j-${i}`,
      date: d.toISOString().slice(0, 10),
      symbol: sym,
      side,
      entryPrice: +entry.toFixed(2),
      exitPrice: +exit.toFixed(2),
      quantity: qty,
      pnl: +((exit - entry) * qty * (side === 'SHORT' ? -1 : 1)).toFixed(2),
      pnlPct: +(pnlPct * (side === 'SHORT' ? -1 : 1)).toFixed(2),
      setup: SETUPS[Math.floor(Math.random() * SETUPS.length)],
      strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
      emotion: EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)],
      notes: '',
      lessons: '',
      rating: Math.floor(Math.random() * 5) + 1,
      screenshot: null,
      tags: [TAGS[Math.floor(Math.random() * TAGS.length)]].concat(Math.random() > 0.5 ? [TAGS[Math.floor(Math.random() * TAGS.length)]] : []),
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pnlColor = (n: number) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-400';
const pnlBg = (n: number) => n > 0 ? 'bg-emerald-900/20' : n < 0 ? 'bg-red-900/20' : 'bg-gray-800/20';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TradeJournal({ className = '' }: TradeJournalProps) {
  const [entries] = useState<JournalEntry[]>(() => genEntries());
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [strategyFilter, setStrategyFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<{ id: string; notes: string; lessons: string } | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());

  const filteredEntries = useMemo(() => {
    let f = entries;
    if (filter === 'winners') f = f.filter(e => e.pnl > 0);
    if (filter === 'losers') f = f.filter(e => e.pnl < 0);
    if (tagFilter) f = f.filter(e => e.tags.includes(tagFilter));
    if (strategyFilter) f = f.filter(e => e.strategy === strategyFilter);
    return f;
  }, [entries, filter, tagFilter, strategyFilter]);

  const stats = useMemo(() => {
    const wins = filteredEntries.filter(e => e.pnl > 0);
    const losses = filteredEntries.filter(e => e.pnl < 0);
    const totalPnl = filteredEntries.reduce((s, e) => s + e.pnl, 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + e.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, e) => s + e.pnl, 0) / losses.length : 0;
    const winRate = filteredEntries.length > 0 ? (wins.length / filteredEntries.length) * 100 : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    const byStrategy: Record<string, { pnl: number; count: number }> = {};
    const bySetup: Record<string, { pnl: number; count: number }> = {};
    for (const e of filteredEntries) {
      (byStrategy[e.strategy] ??= { pnl: 0, count: 0 }).pnl += e.pnl;
      byStrategy[e.strategy].count++;
      (bySetup[e.setup] ??= { pnl: 0, count: 0 }).pnl += e.pnl;
      bySetup[e.setup].count++;
    }

    const byWeek: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    for (const e of filteredEntries) {
      const d = new Date(e.date);
      const wk = `${d.getFullYear()}-W${String(Math.ceil((d.getDate()) / 7)).padStart(2, '0')}`;
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byWeek[wk] = (byWeek[wk] ?? 0) + e.pnl;
      byMonth[mo] = (byMonth[mo] ?? 0) + e.pnl;
    }

    return { wins: wins.length, losses: losses.length, totalPnl, avgWin, avgLoss, winRate, profitFactor, byStrategy, bySetup, byWeek, byMonth };
  }, [filteredEntries]);

  const calendarData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) { map[e.date] = (map[e.date] ?? 0) + e.pnl; }
    return map;
  }, [entries]);

  const allTags = useMemo(() => Array.from(new Set(entries.flatMap(e => e.tags))), [entries]);
  const allStrategies = useMemo(() => Array.from(new Set(entries.map(e => e.strategy))), [entries]);

  const handleSaveNotes = useCallback((id: string, notes: string, lessons: string) => {
    setEditNotes(null);
    // In production, persist to backend
    void id; void notes; void lessons;
  }, []);

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">Trade Journal</span>
          <span className="text-gray-500">({filteredEntries.length} trades)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setView('list')} className={`px-1.5 py-0.5 rounded text-[10px] border ${view === 'list' ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50'}`}>List</button>
          <button onClick={() => setView('calendar')} className={`px-1.5 py-0.5 rounded text-[10px] border ${view === 'calendar' ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50'}`}>Cal</button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-6 gap-2 px-3 py-2 border-b border-gray-800/30 bg-[#0c0c18] text-[10px]">
        <div><span className="text-gray-500">Total P&L</span><p className={`text-sm font-bold ${pnlColor(stats.totalPnl)}`}>{fmtUsd(stats.totalPnl)}</p></div>
        <div><span className="text-gray-500">Win Rate</span><p className={`text-sm font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.winRate.toFixed(1)}%</p></div>
        <div><span className="text-gray-500">Wins/Losses</span><p className="text-sm font-bold text-gray-300">{stats.wins}/{stats.losses}</p></div>
        <div><span className="text-gray-500">Avg Win</span><p className="text-sm font-bold text-emerald-400">{fmtUsd(stats.avgWin)}</p></div>
        <div><span className="text-gray-500">Avg Loss</span><p className="text-sm font-bold text-red-400">{fmtUsd(stats.avgLoss)}</p></div>
        <div><span className="text-gray-500">Profit Factor</span><p className="text-sm font-bold text-amber-300">{stats.profitFactor.toFixed(2)}</p></div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/30 bg-[#0c0c18]">
        <div className="flex gap-0.5">
          {(['all', 'winners', 'losers'] as FilterKey[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-1.5 py-0.5 rounded text-[10px] ${filter === f ? 'bg-amber-600 text-black' : 'bg-[#12121f] text-gray-400 border border-gray-800/50 hover:bg-[#1a1a2e]'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none">
          <option value="">All Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none">
          <option value="">All Strategies</option>
          {allStrategies.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '450px' }}>
        {view === 'list' ? (
          <>
            {filteredEntries.map(e => (
              <React.Fragment key={e.id}>
                <div
                  onClick={() => setExpandedId(prev => prev === e.id ? null : e.id)}
                  className={`grid grid-cols-[70px_50px_45px_60px_60px_65px_75px_60px_1fr] gap-1 px-2 py-1.5 cursor-pointer hover:bg-[#12121f] border-b border-gray-800/20 transition-colors`}
                >
                  <span className="text-gray-500">{e.date}</span>
                  <span className="text-amber-300 font-medium">{e.symbol}</span>
                  <span className={e.side === 'LONG' ? 'text-blue-400' : 'text-orange-400'}>{e.side}</span>
                  <span className="text-gray-400 font-mono">${e.entryPrice.toFixed(0)}</span>
                  <span className="text-gray-400 font-mono">${e.exitPrice.toFixed(0)}</span>
                  <span className={`font-mono font-medium ${pnlColor(e.pnl)}`}>{fmtUsd(e.pnl)}</span>
                  <span className="text-gray-500">{e.setup}</span>
                  <span className="text-gray-500">{e.strategy}</span>
                  <div className="flex gap-0.5">
                    {e.tags.map(t => <span key={t} className="px-1 py-0 bg-amber-900/20 text-amber-400/70 rounded text-[9px]">{t}</span>)}
                  </div>
                </div>

                {expandedId === e.id && (
                  <div className="bg-[#0c0c18] border-b border-amber-900/20 px-3 py-2 space-y-2">
                    <div className="grid grid-cols-4 gap-3 text-[10px]">
                      <div><span className="text-gray-500">Quantity</span><br /><span className="text-gray-300">{e.quantity}</span></div>
                      <div><span className="text-gray-500">P&L %</span><br /><span className={pnlColor(e.pnlPct)}>{e.pnlPct > 0 ? '+' : ''}{e.pnlPct}%</span></div>
                      <div><span className="text-gray-500">Emotion</span><br /><span className="text-gray-300">{e.emotion}</span></div>
                      <div>
                        <span className="text-gray-500">Rating</span><br />
                        <span className="text-amber-400">{'★'.repeat(e.rating)}{'☆'.repeat(5 - e.rating)}</span>
                      </div>
                    </div>

                    {editNotes?.id === e.id ? (
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-gray-500 text-[10px]">Notes</label>
                          <textarea value={editNotes.notes} onChange={ev => setEditNotes(n => n ? { ...n, notes: ev.target.value } : n)} rows={2} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none mt-0.5" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[10px]">Lessons Learned</label>
                          <textarea value={editNotes.lessons} onChange={ev => setEditNotes(n => n ? { ...n, lessons: ev.target.value } : n)} rows={2} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none mt-0.5" />
                        </div>
                        <button onClick={() => handleSaveNotes(e.id, editNotes.notes, editNotes.lessons)} className="px-2 py-1 bg-amber-600 text-black rounded text-[10px] font-medium hover:bg-amber-500">Save</button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[10px]">
                        {e.notes && <p className="text-gray-400"><span className="text-gray-500">Notes:</span> {e.notes}</p>}
                        {e.lessons && <p className="text-gray-400"><span className="text-gray-500">Lessons:</span> {e.lessons}</p>}
                        <button onClick={() => setEditNotes({ id: e.id, notes: e.notes, lessons: e.lessons })} className="text-amber-500 hover:text-amber-300 text-[10px]">
                          {e.notes ? 'Edit Notes' : 'Add Notes'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </>
        ) : (
          /* Calendar View */
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} className="text-gray-400 hover:text-amber-400 px-2">◀</button>
              <span className="text-amber-300 font-medium">{new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} className="text-gray-400 hover:text-amber-400 px-2">▶</button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-gray-600 text-[10px] py-1">{d}</div>
              ))}
              {Array.from({ length: getFirstDayOfWeek(calYear, calMonth) }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayPnl = calendarData[dateStr];
                const hasData = dayPnl !== undefined;
                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded text-[10px] ${
                      hasData ? `${pnlBg(dayPnl)} border border-gray-800/30` : ''
                    }`}
                  >
                    <span className={hasData ? 'text-gray-300' : 'text-gray-600'}>{day}</span>
                    {hasData && (
                      <span className={`text-[8px] font-mono ${pnlColor(dayPnl)}`}>
                        {dayPnl > 0 ? '+' : ''}{(dayPnl / 1000).toFixed(1)}k
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Performance Summaries */}
      <div className="border-t border-amber-900/20 bg-[#0d0d1a]">
        <div className="grid grid-cols-2 gap-3 px-3 py-2">
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">By Strategy</p>
            <div className="space-y-0.5">
              {Object.entries(stats.byStrategy).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 4).map(([strat, data]) => (
                <div key={strat} className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{strat} ({data.count})</span>
                  <span className={pnlColor(data.pnl)}>{fmtUsd(data.pnl)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">By Setup</p>
            <div className="space-y-0.5">
              {Object.entries(stats.bySetup).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 4).map(([setup, data]) => (
                <div key={setup} className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{setup} ({data.count})</span>
                  <span className={pnlColor(data.pnl)}>{fmtUsd(data.pnl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
