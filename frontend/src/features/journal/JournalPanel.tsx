// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const EMOTIONS = ['confident', 'neutral', 'anxious', 'greedy', 'disciplined', 'fomo', 'patient'];
const EMOTION_COLORS: Record<string, string> = {
  confident: BLUE, neutral: TEXT, anxious: AMBER, greedy: RED,
  disciplined: GREEN, fomo: PURPLE, patient: '#80cbc4',
};

interface JournalEntry {
  id: string;
  trade_id: string;
  created_at: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  notes: string;
  tags: string[];
  emotion: string;
}

interface JournalStats {
  total_entries: number;
  total_pnl: number;
  wins: number;
  losses: number;
  win_rate: number;
}

const EntryCard: React.FC<{
  entry: JournalEntry;
  idx: number;
  selected: boolean;
  onClick: () => void;
}> = ({ entry, idx, selected, onClick }) => {
  const [hov, setHov] = React.useState(false);
  const emotionCol = EMOTION_COLORS[entry.emotion] || SUBTLE;
  const pnlCol = entry.pnl >= 0 ? GREEN : RED;
  return (
    <div
      data-testid={`journal-entry-${idx}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? '#1a1a2a' : hov ? '#141414' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: AMBER, fontFamily: MONO, fontWeight: 600 }}>{entry.symbol}</span>
        <span style={{
          fontSize: 9, color: entry.direction === 'long' ? GREEN : RED,
          background: (entry.direction === 'long' ? GREEN : RED) + '22',
          border: `1px solid ${(entry.direction === 'long' ? GREEN : RED)}44`,
          borderRadius: 2, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 1,
        }}>{entry.direction}</span>
        <span style={{ fontSize: 11, fontFamily: MONO, color: emotionCol, marginLeft: 'auto' }}>
          {entry.emotion}
        </span>
        <span style={{ fontSize: 12, fontFamily: MONO, color: pnlCol, fontWeight: 600 }}>
          {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          ENTRY <span style={{ color: TEXT }}>${entry.entry_price.toFixed(2)}</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          EXIT <span style={{ color: TEXT }}>${entry.exit_price.toFixed(2)}</span>
        </span>
        <span style={{ fontSize: 10, color: SUBTLE, marginLeft: 'auto' }}>
          {entry.created_at?.slice(0, 10)}
        </span>
      </div>
      {entry.notes && (
        <div style={{ fontSize: 11, color: SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {entry.notes}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entry.tags.map(t => (
          <span key={t} style={{
            fontSize: 9, color: AMBER, background: AMBER + '15',
            border: `1px solid ${AMBER}33`, borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5,
          }}>{t}</span>
        ))}
      </div>
    </div>
  );
};

/**
 * Bloomberg JL â€” Trade Journal Panel
 */
import React, { useState, useEffect, useCallback } from 'react';

export function JournalPanel() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterEmotion, setFilterEmotion] = useState('all');
  const [filterDir, setFilterDir] = useState<'all' | 'long' | 'short'>('all');
  const [filterTag, setFilterTag] = useState('');
  const [sortPnl, setSortPnl] = useState<'none' | 'asc' | 'desc'>('desc');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'analytics'>('entries');
  const [newNote, setNewNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/journal`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/journal/stats`).then(r => r.ok ? r.json() : null),
    ])
      .then(([e, s]) => {
        setEntries(Array.isArray(e) ? e : []);
        setStats(s);
      })
      .catch(() => { setEntries([]); setStats(null); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTags = [...new Set(entries.flatMap(e => e.tags))];

  const filtered = entries
    .filter(e => filterEmotion === 'all' || e.emotion === filterEmotion)
    .filter(e => filterDir === 'all' || e.direction === filterDir)
    .filter(e => !filterTag || e.tags.includes(filterTag))
    .sort((a, b) => {
      if (sortPnl === 'desc') return b.pnl - a.pnl;
      if (sortPnl === 'asc') return a.pnl - b.pnl;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Analytics
  const pnlByEmotion = EMOTIONS.reduce<Record<string, { pnl: number; count: number }>>((acc, em) => {
    const grp = entries.filter(e => e.emotion === em);
    acc[em] = { pnl: grp.reduce((s, e) => s + e.pnl, 0), count: grp.length };
    return acc;
  }, {});

  const maxAbsPnl = Math.max(...Object.values(pnlByEmotion).map(x => Math.abs(x.pnl)), 1);

  const tabBtn = (tab: 'entries' | 'analytics', label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        background: activeTab === tab ? AMBER + '22' : 'transparent',
        border: `1px solid ${activeTab === tab ? AMBER : BORDER}`,
        borderRadius: 2, padding: '3px 10px',
        color: activeTab === tab ? AMBER : SUBTLE,
        fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1,
      }}
    >{label}</button>
  );

  return (
    <div
      data-testid="journal-panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>JL</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>TRADE JOURNAL</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {tabBtn('entries', 'ENTRIES')}
          {tabBtn('analytics', 'ANALYTICS')}
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>â†º</button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div
          data-testid="journal-stats"
          style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 20 }}
        >
          {[
            { label: 'ENTRIES', val: stats.total_entries, col: TEXT },
            { label: 'TOTAL P&L', val: `${stats.total_pnl >= 0 ? '+' : ''}$${stats.total_pnl.toFixed(2)}`, col: stats.total_pnl >= 0 ? GREEN : RED },
            { label: 'WINS', val: stats.wins, col: GREEN },
            { label: 'LOSSES', val: stats.losses, col: RED },
            { label: 'WIN RATE', val: `${(stats.win_rate * 100).toFixed(1)}%`, col: AMBER },
            { label: 'AVG P&L', val: `$${stats.total_entries > 0 ? (stats.total_pnl / stats.total_entries).toFixed(2) : '0.00'}`, col: BLUE },
          ].map(({ label, val, col }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 12, fontFamily: MONO, color: col, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {activeTab === 'entries' && (
        <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'long', 'short'] as const).map(d => (
            <button key={d} onClick={() => setFilterDir(d)} style={{
              background: filterDir === d ? (d === 'long' ? GREEN : d === 'short' ? RED : AMBER) + '20' : 'transparent',
              border: `1px solid ${filterDir === d ? (d === 'long' ? GREEN : d === 'short' ? RED : AMBER) : BORDER}`,
              borderRadius: 2, padding: '2px 8px',
              color: filterDir === d ? (d === 'long' ? GREEN : d === 'short' ? RED : AMBER) : SUBTLE,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase',
            }}>{d}</button>
          ))}
          <select
            value={filterEmotion}
            onChange={e => setFilterEmotion(e.target.value)}
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 8px', color: TEXT, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}
          >
            <option value="all">All Emotions</option>
            {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 8px', color: TEXT, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}
          >
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: SUBTLE }}>PNL:</span>
            {(['none', 'desc', 'asc'] as const).map(s => (
              <button key={s} onClick={() => setSortPnl(s)} style={{
                background: sortPnl === s ? '#222' : 'transparent',
                border: `1px solid ${sortPnl === s ? AMBER : BORDER}`,
                borderRadius: 2, padding: '2px 7px', color: sortPnl === s ? AMBER : SUBTLE,
                fontFamily: MONO, fontSize: 10, cursor: 'pointer',
              }}>{s === 'none' ? 'DATE' : s === 'desc' ? 'â†“' : 'â†‘'}</button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'entries' && (
          <>
            <div style={{ flex: selectedEntry ? '0 0 55%' : '1 1 auto', overflow: 'auto', borderRight: selectedEntry ? `1px solid ${BORDER}` : 'none' }}>
              {loading && (
                <div data-testid="journal-loading" style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>
              )}
              {!loading && filtered.length === 0 && (
                <div data-testid="journal-empty" style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
                  No journal entries
                </div>
              )}
              {!loading && filtered.map((e, i) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  idx={i}
                  selected={selectedEntry?.id === e.id}
                  onClick={() => setSelectedEntry(prev => prev?.id === e.id ? null : e)}
                />
              ))}
            </div>

            {selectedEntry && (
              <div style={{ flex: '0 0 45%', overflow: 'auto', background: PANEL, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>ENTRY DETAIL</div>
                    <div style={{ fontSize: 15, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selectedEntry.symbol}</div>
                  </div>
                  <button onClick={() => setSelectedEntry(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
                </div>
                {[
                  { label: 'DIRECTION', val: selectedEntry.direction.toUpperCase(), col: selectedEntry.direction === 'long' ? GREEN : RED },
                  { label: 'ENTRY PRICE', val: `$${selectedEntry.entry_price.toFixed(4)}` },
                  { label: 'EXIT PRICE', val: `$${selectedEntry.exit_price.toFixed(4)}` },
                  { label: 'P&L', val: `${selectedEntry.pnl >= 0 ? '+' : ''}$${selectedEntry.pnl.toFixed(2)}`, col: selectedEntry.pnl >= 0 ? GREEN : RED },
                  { label: 'EMOTION', val: selectedEntry.emotion, col: EMOTION_COLORS[selectedEntry.emotion] || TEXT },
                  { label: 'DATE', val: selectedEntry.created_at?.slice(0, 10) },
                  { label: 'TRADE ID', val: selectedEntry.trade_id },
                ].map(({ label, val, col }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                    <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                    <span style={{ color: col || TEXT, fontFamily: MONO, fontWeight: col ? 600 : 400 }}>{val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 4 }}>NOTES</div>
                  <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6, background: BG, borderRadius: 3, padding: 8 }}>
                    {selectedEntry.notes || <span style={{ color: SUBTLE }}>No notes</span>}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>TAGS</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {selectedEntry.tags.map(t => (
                      <span key={t} style={{ fontSize: 10, color: AMBER, background: AMBER + '15', border: `1px solid ${AMBER}33`, borderRadius: 2, padding: '2px 7px' }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 4 }}>ADD NOTE</div>
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a reflective note..."
                    style={{
                      width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 3,
                      color: TEXT, fontFamily: MONO, fontSize: 11, padding: 8, resize: 'none', height: 70, outline: 'none',
                    }}
                  />
                  <button style={{ marginTop: 6, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, padding: '5px 14px', color: AMBER, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                    SAVE NOTE
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: AMBER, letterSpacing: 1, marginBottom: 10 }}>P&L BY EMOTION</div>
              {EMOTIONS.map(em => {
                const { pnl, count } = pnlByEmotion[em] || { pnl: 0, count: 0 };
                const col = EMOTION_COLORS[em] || SUBTLE;
                const barW = Math.abs(pnl) / maxAbsPnl * 100;
                return (
                  <div key={em} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                      <span style={{ color: col }}>{em}</span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ color: SUBTLE, fontSize: 10 }}>{count} trades</span>
                        <span style={{ color: pnl >= 0 ? GREEN : RED, fontFamily: MONO, fontWeight: 600 }}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: BORDER, borderRadius: 3 }}>
                      <div style={{
                        width: `${barW.toFixed(1)}%`, height: '100%',
                        background: pnl >= 0 ? GREEN : RED, borderRadius: 3,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <div style={{ fontSize: 11, color: AMBER, letterSpacing: 1, marginBottom: 10 }}>TOP TAGS</div>
              {allTags.slice(0, 10).map(tag => {
                const tagEntries = entries.filter(e => e.tags.includes(tag));
                const tagPnl = tagEntries.reduce((s, e) => s + e.pnl, 0);
                return (
                  <div key={tag} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
                    <span style={{ color: AMBER }}>&nbsp;{tag}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: SUBTLE }}>{tagEntries.length}Ã—</span>
                      <span style={{ color: tagPnl >= 0 ? GREEN : RED, fontFamily: MONO }}>${tagPnl.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
              {allTags.length === 0 && <div style={{ color: SUBTLE, fontSize: 12 }}>No tags yet</div>}
            </div>
          </div>
        )}
      </div>

      <div data-testid="journal-panel-ready" />
    </div>
  );
}

export default JournalPanel;
