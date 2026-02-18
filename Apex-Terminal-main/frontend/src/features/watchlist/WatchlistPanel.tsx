/**
 * v1.41 — Watchlist Manager Panel
 * DEMO-first watchlist viewer: lists, symbols, prices.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface WatchlistItem {
  symbol: string;
  added_at: string;
  notes: string;
}

interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  created_at: string;
}

export function WatchlistPanel() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/watchlists`)
      .then(r => r.json())
      .then(data => {
        setWatchlists(Array.isArray(data) ? data : []);
        if (data.length > 0) setSelected(data[0].id);
      })
      .catch(() => setWatchlists([]))
      .finally(() => setLoading(false));
  }, []);

  const active = watchlists.find(w => w.id === selected);

  return (
    <div data-testid="watchlist-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Watchlist Manager</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.41 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="watchlist-loading" className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && watchlists.length === 0 && (
        <div data-testid="watchlist-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No watchlists available</p>
        </div>
      )}

      {!loading && watchlists.length > 0 && (
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Sidebar list */}
          <div className="w-48 space-y-1 overflow-y-auto">
            {watchlists.map(w => (
              <button
                key={w.id}
                data-testid={`watchlist-tab-${w.id}`}
                onClick={() => setSelected(w.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected === w.id ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-element-bg'
                }`}
              >
                {w.name}
                <span className="ml-1 text-xs text-text-muted">({w.items.length})</span>
              </button>
            ))}
          </div>

          {/* Symbols table */}
          {active && (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs border-b border-border">
                    <th className="text-left py-2 px-3">Symbol</th>
                    <th className="text-left py-2 px-3">Notes</th>
                    <th className="text-right py-2 px-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {active.items.map((s, idx) => (
                    <tr key={s.symbol} data-testid={`watchlist-symbol-${idx}`} className="border-b border-border/30">
                      <td className="py-2 px-3 font-mono text-text">{s.symbol}</td>
                      <td className="py-2 px-3 text-text-secondary text-xs">{s.notes}</td>
                      <td className="py-2 px-3 text-right text-text-muted text-xs">{s.added_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div data-testid="watchlist-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
