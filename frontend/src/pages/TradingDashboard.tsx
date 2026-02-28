/**
 * TradingDashboard.tsx
 * Main multi-panel Bloomberg-style Trading Dashboard for Apex Terminal.
 * Provides the primary view with macro, sector, sentiment, factor model, and risk panels.
 * Supports customizable layouts, panel pinning, workspace management, and real-time data.
 */

import React, {
  useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense,
} from 'react';

// ─── Lazy-loaded panels ───────────────────────────────────────────────────────
const MacroDashboard = lazy(() => import('../features/macro/MacroDashboard'));
const SectorRotationPanel = lazy(() => import('../features/sector-rotation/SectorRotationPanel'));
const SocialSentimentPanel = lazy(() => import('../features/sentiment/SocialSentimentPanel'));
const FactorModelPanel = lazy(() => import('../features/factor-model/FactorModelPanel'));
const StressTestPanel = lazy(() => import('../features/stress-test/StressTestPanel'));
const CrossAssetPanel = lazy(() => import('../features/cross-asset/CrossAssetPanel'));

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelId =
  | 'macro' | 'sector' | 'sentiment' | 'factor' | 'risk' | 'cross-asset'
  | 'watchlist' | 'news' | 'alerts' | 'portfolio';

interface PanelConfig {
  id: PanelId;
  title: string;
  icon: string;
  component: React.FC<{ className?: string }>;
  defaultVisible: boolean;
  minWidth?: number;
  minHeight?: number;
}

interface LayoutCell {
  panelId: PanelId;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
}

interface WorkspaceLayout {
  id: string;
  name: string;
  cells: LayoutCell[];
  columns: 2 | 3 | 4;
}

interface MarketSummary {
  symbol: string;
  last: number;
  change: number;
  changePct: number;
  direction: 'up' | 'down' | 'flat';
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'YTD';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LAYOUTS: WorkspaceLayout[] = [
  {
    id: 'default',
    name: 'Default',
    columns: 2,
    cells: [
      { panelId: 'macro', colSpan: 2 },
      { panelId: 'sector' },
      { panelId: 'sentiment' },
      { panelId: 'factor' },
      { panelId: 'risk' },
    ],
  },
  {
    id: 'risk-focus',
    name: 'Risk Focus',
    columns: 2,
    cells: [
      { panelId: 'risk', colSpan: 2 },
      { panelId: 'cross-asset' },
      { panelId: 'macro' },
    ],
  },
  {
    id: 'sentiment-focus',
    name: 'Sentiment',
    columns: 2,
    cells: [
      { panelId: 'sentiment', colSpan: 2 },
      { panelId: 'sector' },
      { panelId: 'factor' },
    ],
  },
];

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'YTD'];

// ─── Mock Market Summary ──────────────────────────────────────────────────────

function generateMockMarketSummary(): MarketSummary[] {
  const assets = [
    { symbol: 'SPX', base: 5420.12 },
    { symbol: 'NDX', base: 19254.45 },
    { symbol: 'RUT', base: 2218.34 },
    { symbol: 'VIX', base: 18.42 },
    { symbol: '10YR', base: 4.28 },
    { symbol: 'DXY', base: 104.32 },
    { symbol: 'GOLD', base: 2387.50 },
    { symbol: 'WTI', base: 81.24 },
    { symbol: 'BTC', base: 68450.00 },
  ];
  return assets.map(a => {
    const changePct = (Math.random() - 0.5) * 3;
    const change = a.base * changePct / 100;
    return {
      symbol: a.symbol,
      last: a.base + change,
      change,
      changePct,
      direction: changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
    };
  });
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface MarketTickerProps {
  summary: MarketSummary[];
  paused: boolean;
}

const MarketTicker: React.FC<MarketTickerProps> = ({ summary, paused }) => {
  const [offset, setOffset] = useState(0);
  const animRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      setOffset(prev => {
        const width = containerRef.current?.scrollWidth ?? 1000;
        return (prev - dt * 0.05) % (width / 2);
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused]);

  const items = [...summary, ...summary]; // duplicate for seamless loop

  return (
    <div className="market-ticker" ref={containerRef}>
      <div className="market-ticker__track" style={{ transform: `translateX(${offset}px)` }}>
        {items.map((s, i) => {
          const color = s.direction === 'up' ? '#00d4aa' : s.direction === 'down' ? '#ff4444' : '#888';
          return (
            <span key={`${s.symbol}_${i}`} className="ticker-item">
              <span className="ticker-symbol">{s.symbol}</span>
              <span className="ticker-price">{s.last.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              <span className="ticker-change" style={{ color }}>
                {s.change > 0 ? '+' : ''}{s.changePct.toFixed(2)}%
              </span>
              <span className="ticker-sep">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

interface TopNavBarProps {
  activeLayout: string;
  layouts: WorkspaceLayout[];
  onLayoutChange: (id: string) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  marketOpen: boolean;
  serverConnected: boolean;
  onTogglePanel: () => void;
}

const TopNavBar: React.FC<TopNavBarProps> = ({
  activeLayout,
  layouts,
  onLayoutChange,
  timeRange,
  onTimeRangeChange,
  marketOpen,
  serverConnected,
}) => (
  <nav className="trading-dashboard__topnav">
    <div className="topnav__brand">
      <span className="topnav__logo">⬡</span>
      <span className="topnav__name">APEX TERMINAL</span>
      <span className={`topnav__market-status ${marketOpen ? 'topnav__market-status--open' : 'topnav__market-status--closed'}`}>
        {marketOpen ? '● MARKET OPEN' : '○ CLOSED'}
      </span>
    </div>

    <div className="topnav__controls">
      {/* Layout selector */}
      <div className="topnav__layouts">
        {layouts.map(l => (
          <button
            key={l.id}
            className={`layout-btn${activeLayout === l.id ? ' layout-btn--active' : ''}`}
            onClick={() => onLayoutChange(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Time range */}
      <div className="topnav__timerange">
        {TIME_RANGES.map(r => (
          <button
            key={r}
            className={`time-btn${timeRange === r ? ' time-btn--active' : ''}`}
            onClick={() => onTimeRangeChange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Connection status */}
      <div className={`topnav__connection ${serverConnected ? 'topnav__connection--ok' : 'topnav__connection--err'}`}>
        {serverConnected ? '◉ API' : '◎ OFFLINE'}
      </div>
    </div>
  </nav>
);

interface PanelFallbackProps {
  panelId: PanelId;
  title: string;
  icon: string;
  hidden: boolean;
  onShow: () => void;
}

const PanelPlaceholder: React.FC<{ title: string; icon: string }> = ({ title, icon }) => (
  <div className="panel-placeholder">
    <div className="panel-placeholder__icon">{icon}</div>
    <div className="panel-placeholder__title">{title}</div>
    <div className="panel-placeholder__loading">Loading...</div>
  </div>
);

interface PanelWrapperProps {
  config: PanelConfig;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
  onHide: () => void;
}

const PanelWrapper: React.FC<PanelWrapperProps> = ({ config, colSpan = 1, rowSpan = 1, onHide }) => {
  const Component = config.component as React.ComponentType<{ className?: string }>;
  return (
    <div
      className={`dashboard-panel-wrapper dashboard-panel-wrapper--col${colSpan} dashboard-panel-wrapper--row${rowSpan}`}
    >
      <div className="dashboard-panel-wrapper__toolbar">
        <span className="dashboard-panel-wrapper__icon">{config.icon}</span>
        <span className="dashboard-panel-wrapper__title">{config.title}</span>
        <button className="dashboard-panel-wrapper__hide-btn" onClick={onHide} title="Hide panel">−</button>
      </div>
      <Suspense fallback={<PanelPlaceholder title={config.title} icon={config.icon} />}>
        <Component className="dashboard-panel-inner" />
      </Suspense>
    </div>
  );
};

interface AlertBannerProps {
  alerts: string[];
  onDismiss: (index: number) => void;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;
  return (
    <div className="dashboard-alerts">
      {alerts.map((alert, i) => (
        <div key={i} className="dashboard-alert">
          <span className="dashboard-alert__icon">⚡</span>
          <span className="dashboard-alert__text">{alert}</span>
          <button className="dashboard-alert__dismiss" onClick={() => onDismiss(i)}>✕</button>
        </div>
      ))}
    </div>
  );
};

// ─── Panel Registry ───────────────────────────────────────────────────────────

const PANEL_REGISTRY: Record<PanelId, PanelConfig> = {
  macro: {
    id: 'macro',
    title: 'Macro Dashboard',
    icon: '📈',
    component: MacroDashboard as unknown as React.FC,
    defaultVisible: true,
  },
  sector: {
    id: 'sector',
    title: 'Sector Rotation',
    icon: '⊡',
    component: SectorRotationPanel as unknown as React.FC,
    defaultVisible: true,
  },
  sentiment: {
    id: 'sentiment',
    title: 'Social Sentiment',
    icon: '📡',
    component: SocialSentimentPanel as unknown as React.FC,
    defaultVisible: true,
  },
  factor: {
    id: 'factor',
    title: 'Factor Model',
    icon: '⊞',
    component: FactorModelPanel as unknown as React.FC,
    defaultVisible: true,
  },
  risk: {
    id: 'risk',
    title: 'Stress Testing',
    icon: '⚠',
    component: StressTestPanel as unknown as React.FC,
    defaultVisible: true,
  },
  'cross-asset': {
    id: 'cross-asset',
    title: 'Cross-Asset',
    icon: '⊗',
    component: CrossAssetPanel as unknown as React.FC,
    defaultVisible: false,
  },
  // Placeholder panels (not yet implemented)
  watchlist: { id: 'watchlist', title: 'Watchlist', icon: '★', component: () => <div>Watchlist</div>, defaultVisible: false },
  news: { id: 'news', title: 'News', icon: '📰', component: () => <div>News</div>, defaultVisible: false },
  alerts: { id: 'alerts', title: 'Alerts', icon: '🔔', component: () => <div>Alerts</div>, defaultVisible: false },
  portfolio: { id: 'portfolio', title: 'Portfolio', icon: '💼', component: () => <div>Portfolio</div>, defaultVisible: false },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface TradingDashboardProps {
  initialLayout?: string;
  initialTimeRange?: TimeRange;
}

const TradingDashboard: React.FC<TradingDashboardProps> = ({
  initialLayout = 'default',
  initialTimeRange = '1D',
}) => {
  const [activeLayoutId, setActiveLayoutId] = useState(initialLayout);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [hiddenPanels, setHiddenPanels] = useState<Set<PanelId>>(new Set());
  const [marketSummary, setMarketSummary] = useState<MarketSummary[]>(generateMockMarketSummary);
  const [tickerPaused, setTickerPaused] = useState(false);
  const [serverConnected, setServerConnected] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([
    'NVDA up +5.2% on AI data center beats — highest 1D sentiment spike',
    'VIX spiked above 20 — stress testing models flagging elevated risk',
  ]);
  const [showPanelSelector, setShowPanelSelector] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeLayout = useMemo(
    () => DEFAULT_LAYOUTS.find(l => l.id === activeLayoutId) ?? DEFAULT_LAYOUTS[0],
    [activeLayoutId]
  );

  const visibleCells = useMemo(
    () => activeLayout.cells.filter(c => !hiddenPanels.has(c.panelId)),
    [activeLayout.cells, hiddenPanels]
  );

  // Refresh market summary every 5s
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      setMarketSummary(generateMockMarketSummary());
    }, 5000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, []);

  // Check server health
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(2000) });
        setServerConnected(resp.ok);
      } catch {
        setServerConnected(false);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  const marketOpen = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }, []);

  const handleHidePanel = useCallback((panelId: PanelId) => {
    setHiddenPanels(prev => new Set([...prev, panelId]));
  }, []);

  const handleShowPanel = useCallback((panelId: PanelId) => {
    setHiddenPanels(prev => {
      const next = new Set(prev);
      next.delete(panelId);
      return next;
    });
  }, []);

  const handleDismissAlert = useCallback((i: number) => {
    setAlerts(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  return (
    <div className="trading-dashboard">
      {/* ── Top Nav ── */}
      <TopNavBar
        activeLayout={activeLayoutId}
        layouts={DEFAULT_LAYOUTS}
        onLayoutChange={setActiveLayoutId}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        marketOpen={marketOpen}
        serverConnected={serverConnected}
        onTogglePanel={() => setShowPanelSelector(p => !p)}
      />

      {/* ── Market Ticker ── */}
      <div className="trading-dashboard__ticker-bar" onMouseEnter={() => setTickerPaused(true)} onMouseLeave={() => setTickerPaused(false)}>
        <MarketTicker summary={marketSummary} paused={tickerPaused} />
      </div>

      {/* ── Alerts ── */}
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

      {/* ── Panel Selector Drawer ── */}
      {showPanelSelector && (
        <div className="panel-selector-drawer">
          <div className="panel-selector-drawer__title">Show / Hide Panels</div>
          <div className="panel-selector-grid">
            {Object.values(PANEL_REGISTRY).map(panel => {
              const isHidden = hiddenPanels.has(panel.id);
              return (
                <button
                  key={panel.id}
                  className={`panel-toggle-btn${!isHidden ? ' panel-toggle-btn--visible' : ''}`}
                  onClick={() => isHidden ? handleShowPanel(panel.id) : handleHidePanel(panel.id)}
                >
                  <span>{panel.icon}</span> {panel.title}
                  <span className="panel-toggle-indicator">{isHidden ? '○' : '●'}</span>
                </button>
              );
            })}
          </div>
          <button className="panel-selector-drawer__close" onClick={() => setShowPanelSelector(false)}>Close ✕</button>
        </div>
      )}

      {/* ── Main Layout ── */}
      <main className={`trading-dashboard__main trading-dashboard__main--cols-${activeLayout.columns}`}>
        {visibleCells.map((cell, i) => {
          const config = PANEL_REGISTRY[cell.panelId];
          if (!config) return null;
          return (
            <PanelWrapper
              key={`${cell.panelId}_${i}`}
              config={config}
              colSpan={cell.colSpan}
              rowSpan={cell.rowSpan}
              onHide={() => handleHidePanel(cell.panelId)}
            />
          );
        })}

        {/* Empty state */}
        {visibleCells.length === 0 && (
          <div className="trading-dashboard__empty">
            <div className="empty-state__icon">⬡</div>
            <div className="empty-state__title">All panels hidden</div>
            <button className="empty-state__btn" onClick={() => setHiddenPanels(new Set())}>
              Show All Panels
            </button>
          </div>
        )}
      </main>

      {/* ── Status Bar ── */}
      <footer className="trading-dashboard__statusbar">
        <div className="statusbar__left">
          <span className={`statusbar-dot${serverConnected ? ' statusbar-dot--green' : ' statusbar-dot--red'}`} />
          <span>{serverConnected ? 'API Connected · localhost:8000' : 'API Offline · Mock Data Mode'}</span>
        </div>
        <div className="statusbar__center">
          APEX TERMINAL v2.0 · {activeLayout.name} Layout · {timeRange}
        </div>
        <div className="statusbar__right">
          <span>{new Date().toLocaleString()}</span>
        </div>
      </footer>
    </div>
  );
};

export default TradingDashboard;
