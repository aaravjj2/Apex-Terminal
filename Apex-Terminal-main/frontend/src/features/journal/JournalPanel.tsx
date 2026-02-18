/**
 * v1.43 — Trade Journal Panel
 * DEMO-first trade journal with entries, tags, emotions, and PnL.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

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

export function JournalPanel() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/journal`).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/journal/stats`).then(r => r.json()),
    ])
      .then(([e, s]) => {
        setEntries(Array.isArray(e) ? e : []);
        setStats(s);
      })
      .catch(() => { setEntries([]); setStats(null); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="journal-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Trade Journal</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.43 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="journal-loading" className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div data-testid="journal-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No journal entries</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          {/* Stats bar */}
          {stats && (
            <div data-testid="journal-stats" className="grid grid-cols-5 gap-3 mb-4">
              <div className="p-2 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Entries</div>
                <div className="text-sm font-semibold text-text">{stats.total_entries}</div>
              </div>
              <div className="p-2 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Total P&L</div>
                <div className={`text-sm font-semibold ${stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${stats.total_pnl.toFixed(2)}
                </div>
              </div>
              <div className="p-2 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Wins</div>
                <div className="text-sm font-semibold text-green-400">{stats.wins}</div>
              </div>
              <div className="p-2 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Losses</div>
                <div className="text-sm font-semibold text-red-400">{stats.losses}</div>
              </div>
              <div className="p-2 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Win Rate</div>
                <div className="text-sm font-semibold text-brand">
                  {(stats.win_rate * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Entries */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {entries.map((e, idx) => (
              <div key={e.id} data-testid={`journal-entry-${idx}`} className="p-3 rounded-lg border border-border/50 bg-element-bg/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-text">{e.symbol}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    e.direction === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>{e.direction}</span>
                  <span className={`text-xs ml-auto font-mono ${e.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {e.pnl >= 0 ? '+' : ''}${e.pnl.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mb-1">{e.notes}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {e.tags.map(t => (
                    <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-brand/10 text-brand">{t}</span>
                  ))}
                  <span className="text-[9px] ml-auto text-text-muted">{e.emotion} • {e.created_at}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div data-testid="journal-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
