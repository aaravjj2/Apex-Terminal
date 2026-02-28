/**
 * W01 — MonitorGrid Component
 *
 * A 2-4 panel resizable grid that persists layout to localStorage.
 * Each panel can host a different "view" (chart, blotter, watchlist, etc.)
 * and reacts to the active symbol via ContextBus.
 *
 * Layout modes: 1×1, 1×2, 2×1, 2×2 — switchable via a toolbar.
 * State (which view is in which slot + layout mode) is saved per user.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useContextBus } from '../stores/contextBusStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutMode = '1x1' | '1x2' | '2x1' | '2x2';

/**
 * Every panel slot holds a "view" identifier.
 * The MonitorGrid renders a placeholder per view; real content
 * can be progressively added in later weeks.
 */
export type PanelView =
  | 'chart'
  | 'watchlist'
  | 'blotter'
  | 'positions'
  | 'news'
  | 'depth'
  | 'empty';

interface PanelSlot {
  id: number;
  view: PanelView;
}

interface MonitorGridState {
  layout: LayoutMode;
  panels: PanelSlot[];
}

const STORAGE_KEY = 'apex-monitor-grid';

const DEFAULT_STATE: MonitorGridState = {
  layout: '2x2',
  panels: [
    { id: 0, view: 'chart' },
    { id: 1, view: 'watchlist' },
    { id: 2, view: 'blotter' },
    { id: 3, view: 'positions' },
  ],
};

// Allowed panel counts per layout
const PANEL_COUNT: Record<LayoutMode, number> = {
  '1x1': 1,
  '1x2': 2,
  '2x1': 2,
  '2x2': 4,
};

const GRID_CSS: Record<LayoutMode, React.CSSProperties> = {
  '1x1': { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' },
  '1x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' },
  '2x1': { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' },
  '2x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
};

const VIEW_LABELS: Record<PanelView, string> = {
  chart: '📈 Chart',
  watchlist: '📋 Watchlist',
  blotter: '📝 Blotter',
  positions: '💼 Positions',
  news: '📰 News',
  depth: '📊 Depth',
  empty: '—',
};

const ALL_VIEWS: PanelView[] = ['chart', 'watchlist', 'blotter', 'positions', 'news', 'depth'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MonitorGridProps {
  testId?: string;
}

export function MonitorGrid({ testId = 'monitor-grid' }: MonitorGridProps) {
  const activeSymbol = useContextBus((s) => s.activeSymbol);

  // Load state from localStorage
  const [state, setState] = useState<MonitorGridState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MonitorGridState;
    } catch { /* fallback */ }
    return DEFAULT_STATE;
  });

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setLayout = useCallback((layout: LayoutMode) => {
    setState((prev) => {
      const count = PANEL_COUNT[layout];
      let panels = prev.panels.slice(0, count);
      while (panels.length < count) {
        panels.push({ id: panels.length, view: 'empty' });
      }
      return { layout, panels };
    });
  }, []);

  const setPanelView = useCallback((index: number, view: PanelView) => {
    setState((prev) => {
      const panels = prev.panels.map((p, i) =>
        i === index ? { ...p, view } : p,
      );
      return { ...prev, panels };
    });
  }, []);

  const visiblePanels = useMemo(
    () => state.panels.slice(0, PANEL_COUNT[state.layout]),
    [state],
  );

  return (
    <div data-testid={testId} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        data-testid={`${testId}-toolbar`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--ui2-bg-elevated)',
          borderBottom: '1px solid var(--ui2-border)',
          fontSize: '12px',
        }}
      >
        <span style={{ color: 'var(--ui2-text-muted)', fontWeight: 600 }}>Layout:</span>
        {(['1x1', '1x2', '2x1', '2x2'] as LayoutMode[]).map((l) => (
          <button
            key={l}
            data-testid={`${testId}-layout-${l}`}
            onClick={() => setLayout(l)}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '4px',
              border: state.layout === l
                ? '1px solid var(--ui2-brand-primary)'
                : '1px solid var(--ui2-border)',
              background: state.layout === l
                ? 'rgba(99,102,241,0.15)'
                : 'var(--ui2-bg-panel)',
              color: state.layout === l
                ? 'var(--ui2-brand-primary)'
                : 'var(--ui2-text-muted)',
            }}
          >
            {l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span
          data-testid={`${testId}-active-symbol`}
          style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ui2-brand-primary)' }}
        >
          {activeSymbol}
        </span>
      </div>

      {/* Grid panels */}
      <div
        data-testid={`${testId}-panels`}
        style={{
          flex: 1,
          display: 'grid',
          gap: '2px',
          background: 'var(--ui2-border)',
          ...GRID_CSS[state.layout],
        }}
      >
        {visiblePanels.map((panel, idx) => (
          <div
            key={panel.id}
            data-testid={`${testId}-panel-${idx}`}
            data-view={panel.view}
            style={{
              background: 'var(--ui2-bg-base)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                background: 'var(--ui2-bg-panel)',
                borderBottom: '1px solid var(--ui2-border)',
                fontSize: '11px',
              }}
            >
              <span style={{ color: 'var(--ui2-text-secondary)', fontWeight: 600 }}>
                {VIEW_LABELS[panel.view]}
              </span>
              <select
                data-testid={`${testId}-panel-${idx}-select`}
                value={panel.view}
                onChange={(e) => setPanelView(idx, e.target.value as PanelView)}
                style={{
                  fontSize: '10px',
                  background: 'var(--ui2-bg-input)',
                  border: '1px solid var(--ui2-border)',
                  borderRadius: '3px',
                  color: 'var(--ui2-text-muted)',
                  padding: '1px 4px',
                  cursor: 'pointer',
                }}
              >
                {ALL_VIEWS.map((v) => (
                  <option key={v} value={v}>{VIEW_LABELS[v]}</option>
                ))}
              </select>
            </div>
            {/* Panel content */}
            <div
              data-testid={`${testId}-panel-${idx}-content`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ui2-text-muted)',
                fontSize: '13px',
              }}
            >
              <PanelContent view={panel.view} symbol={activeSymbol} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel Content — Renders actual content per view type
// ---------------------------------------------------------------------------

function PanelContent({ view, symbol }: { view: PanelView; symbol: string }) {
  if (view === 'empty') {
    return <span>Select a view ↑</span>;
  }

  if (view === 'chart') {
    return (
      <div data-testid="monitor-chart-placeholder" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{symbol}</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>
          Chart panel — streams from ContextBus
        </div>
      </div>
    );
  }

  if (view === 'watchlist') {
    return <WatchlistPanel symbol={symbol} />;
  }

  if (view === 'blotter') {
    return <BlotterPanel />;
  }

  if (view === 'positions') {
    return <PositionsPanel />;
  }

  if (view === 'news') {
    return (
      <div data-testid="monitor-news-placeholder" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📰</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>News Feed</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>Sentiment stream for {symbol}</div>
      </div>
    );
  }

  if (view === 'depth') {
    return (
      <div data-testid="monitor-depth-placeholder" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>Market Depth</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>Level 2 for {symbol}</div>
      </div>
    );
  }

  return <span>{view}</span>;
}

// ---------------------------------------------------------------------------
// Sub-panels — Real data from API
// ---------------------------------------------------------------------------

function WatchlistPanel({ symbol }: { symbol: string }) {
  const WATCHLIST = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'SPY', 'QQQ', 'AMD'];
  const setActiveSymbol = useContextBus((s) => s.setActiveSymbol);

  return (
    <div data-testid="monitor-watchlist" style={{ width: '100%', padding: '4px 0', overflow: 'auto' }}>
      {WATCHLIST.map((sym) => (
        <button
          key={sym}
          data-testid={`watchlist-row-${sym}`}
          onClick={() => setActiveSymbol(sym)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            padding: '5px 10px',
            border: 'none',
            background: sym === symbol ? 'rgba(99,102,241,0.12)' : 'transparent',
            borderLeft: sym === symbol ? '2px solid var(--ui2-brand-primary)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--ui2-text-primary)',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ fontWeight: 600 }}>{sym}</span>
        </button>
      ))}
    </div>
  );
}

function BlotterPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/broker/orders');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setOrders(data.orders ?? []);
        }
      } catch { /* */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <span>Loading orders…</span>;
  if (orders.length === 0) return <span>No orders</span>;

  return (
    <div data-testid="monitor-blotter" style={{ width: '100%', fontSize: '11px', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
            {['Symbol', 'Side', 'Qty', 'Status'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--ui2-text-muted)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 10).map((o: any, i: number) => (
            <tr key={o.id ?? i} data-testid={`blotter-row-${i}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>{o.symbol}</td>
              <td style={{ padding: '3px 6px', color: o.side === 'buy' ? '#22c55e' : '#ef4444' }}>{o.side}</td>
              <td style={{ padding: '3px 6px' }}>{o.qty}</td>
              <td style={{ padding: '3px 6px', color: 'var(--ui2-text-muted)' }}>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionsPanel() {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/broker/positions');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setPositions(data.positions ?? []);
        }
      } catch { /* */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <span>Loading positions…</span>;
  if (positions.length === 0) return <span>No open positions</span>;

  return (
    <div data-testid="monitor-positions" style={{ width: '100%', fontSize: '11px', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
            {['Symbol', 'Qty', 'P&L $'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--ui2-text-muted)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p: any, i: number) => {
            const pnl = parseFloat(p.unrealized_pl ?? '0');
            return (
              <tr key={p.asset_id ?? i} data-testid={`position-row-${i}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                <td style={{ padding: '3px 6px', fontWeight: 600 }}>{p.symbol}</td>
                <td style={{ padding: '3px 6px' }}>{p.qty}</td>
                <td style={{ padding: '3px 6px', color: pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
