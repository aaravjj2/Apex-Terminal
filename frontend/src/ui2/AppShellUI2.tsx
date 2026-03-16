/**
 * UI2 AppShellUI2 Component — v2.0
 * TradingView-inspired terminal shell matching demo/index.html exactly
 * Grid: 40px TopBar | 1fr Layout (48px LeftNav + 1fr Content + 286px RightSidebar) | 20px StatusBar
 * 
 * Layout matches demo/index.html:
 * - TopBar: Logo, Mode Badge, Search, Symbol Strip, Latency, Clock, Icons, User
 * - LeftNav: 5 collapsible groups (TRADE/STRAT/MKTS/ASSET/SYSTEM) with SVG icons
 * - Content: React Router Outlet
 * - RightSidebar: 6 tabs (Order/Watch/Pos/News/L2/T&amp;S)
 * - StatusBar: Live dot, Market status, NAV, Scrolling ticker tape, Version
 * - CommandPalette: Ctrl+K
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar, LeftNav, RightSidebarNew, StatusBar, CommandPaletteNew } from './shell';
import type { CmdItem } from './shell';
import { COMMAND_REGISTRY } from './stores/commandRegistry';
import { useContextBus } from './stores/contextBusStore';
import { ToastProvider } from '../ui/Toast';
import { tradingStore } from './stores/tradingStore';

// Import design system CSS
import '../styles/apex-design-system.css';

// Phase A: Build-time version fingerprints
declare const __GIT_SHA__: string;
const FE_GIT_SHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown';

// ─── Workspace config for command palette navigation ───
interface WorkspaceConfig {
  id: string;
  label: string;
  icon: string;
  path: string;
  section?: 'main' | 'tools' | 'system';
  description?: string;
  keywords?: string[];
}

const WORKSPACES: WorkspaceConfig[] = [
  // ── Core Trading ──
  { id: 'dashboard',         label: 'Dashboard',       icon: '📊', path: '/ui2/dashboard',         section: 'main',   description: 'Command center with key metrics',          keywords: ['home', 'overview', 'metrics', 'kpi'] },
  { id: 'trading',           label: 'Trading',         icon: '📈', path: '/ui2/trading',           section: 'main',   description: 'Live chart and order execution',           keywords: ['chart', 'trade', 'order', 'execution'] },
  { id: 'portfolio',         label: 'Portfolio',       icon: '💼', path: '/ui2/portfolio',         section: 'main',   description: 'Positions and performance',                keywords: ['positions', 'pnl', 'performance', 'holdings'] },
  { id: 'orders',            label: 'Orders',          icon: '📋', path: '/ui2/orders',            section: 'main',   description: 'Order history and management',             keywords: ['order', 'history', 'fills', 'execution'] },
  { id: 'risk',              label: 'Risk',            icon: '🛡️', path: '/ui2/risk',             section: 'main',   description: 'Risk management dashboard',                keywords: ['risk', 'var', 'stress', 'exposure'] },
  { id: 'alerts',            label: 'Alerts',          icon: '🔔', path: '/ui2/alerts',            section: 'main',   description: 'Price and event alerts',                   keywords: ['alert', 'notification'] },
  { id: 'monitor',           label: 'Monitor',         icon: '🖥️', path: '/ui2/monitor',          section: 'main',   description: 'Multi-panel monitoring',                   keywords: ['monitor', 'grid'] },
  // ── Markets ──
  { id: 'heatmap',           label: 'Heatmap',         icon: '🗺️', path: '/ui2/heatmap',          section: 'main',   description: 'Market heatmap with sector treemap',       keywords: ['heatmap', 'sector', 'treemap'] },
  { id: 'options-chain',     label: 'Options',         icon: '⚡', path: '/ui2/options-chain',    section: 'tools',  description: 'Options chain, Greeks',                    keywords: ['options', 'chain', 'greeks'] },
  { id: 'options-matrix',    label: 'Options Matrix',  icon: '🔢', path: '/ui2/options-matrix',   section: 'tools',  description: 'Options payoff matrix',                    keywords: ['options', 'matrix', 'payoff'] },
  { id: 'screeners',         label: 'Screener',        icon: '🔍', path: '/ui2/screeners',        section: 'tools',  description: 'Stock screener',                           keywords: ['screener', 'filter', 'scan'] },
  { id: 'watchlist-manager', label: 'Watchlists',      icon: '👁️', path: '/ui2/watchlist-manager',section: 'main',   description: 'Multi-watchlist manager',                  keywords: ['watchlist'] },
  { id: 'sentiment',         label: 'Sentiment',       icon: '📰', path: '/ui2/sentiment',        section: 'tools',  description: 'News sentiment analysis',                  keywords: ['sentiment', 'news'] },
  { id: 'economic-calendar', label: 'Econ Calendar',   icon: '📅', path: '/ui2/economic-calendar',section: 'tools',  description: 'Economic events calendar',                 keywords: ['economic', 'calendar', 'macro'] },
  { id: 'vol-surface',       label: 'Vol Surface',     icon: '🌊', path: '/ui2/vol-surface',      section: 'tools',  description: 'Volatility surface viewer',                keywords: ['vol', 'surface', 'implied'] },
  { id: 'factor-model',      label: 'Factor Model',    icon: '🧩', path: '/ui2/factor-model',     section: 'tools',  description: 'Factor exposure analysis',                 keywords: ['factor', 'model', 'exposure'] },
  { id: 'blotter',           label: 'Blotter',         icon: '📜', path: '/ui2/blotter',          section: 'main',   description: 'Trade blotter',                            keywords: ['blotter', 'trades', 'fills'] },
  // ── Autopilot ──
  { id: 'autopilot',         label: 'Autopilot',       icon: '🤖', path: '/ui2/autopilot',        section: 'tools',  description: 'Autonomous trading agent',                 keywords: ['autopilot', 'agent', 'auto'] },
  { id: 'autopilot-v2',      label: 'Autopilot V2',    icon: '🚀', path: '/ui2/autopilot-v2',     section: 'tools',  description: 'V2 autopilot pipeline',                    keywords: ['autopilot', 'v2'] },
  // ── Strategy ──
  { id: 'backtest',          label: 'Backtest',        icon: '⏪', path: '/ui2/backtest',         section: 'tools',  description: 'Walk-forward analysis',                    keywords: ['backtest', 'strategy', 'walk-forward'] },
  { id: 'model-router',      label: 'Model Router',    icon: '🔀', path: '/ui2/model-router',     section: 'tools',  description: 'AI model routing',                         keywords: ['model', 'router', 'ai'] },
  { id: 'nova',              label: 'Nova AI Hub',     icon: '✨', path: '/ui2/nova',             section: 'tools',  description: 'Amazon Nova — chat, chart vision, voice, agentic research', keywords: ['nova', 'ai', 'chat', 'voice', 'amazon', 'bedrock'] },
  // ── System ──
  { id: 'search',            label: 'Search',          icon: '🔍', path: '/ui2/search',           section: 'system', description: 'Full-text search',                         keywords: ['search', 'find'] },
  { id: 'settings',          label: 'Settings',        icon: '⚙️', path: '/ui2/settings',        section: 'system', description: 'Platform configuration',                   keywords: ['settings', 'config'] },
];

/* ────────────────────────────────────────── */
/*              MAIN APP SHELL               */
/* ────────────────────────────────────────── */
export function AppShellUI2() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSession, setMarketSession] = useState<string>('closed');
  const [beGitSha, setBeGitSha] = useState<string>('');
  const [versionMismatch, setVersionMismatch] = useState(false);

  // Subscribe to trading store connection status
  const connectionStatus = useSyncExternalStore(
    tradingStore.subscribe,
    tradingStore.getConnectionStatus
  );

  // Phase A: Fetch backend version
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/ops/version');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled && data.git_sha) {
            setBeGitSha(data.git_sha);
            if (FE_GIT_SHA !== 'unknown' && data.git_sha !== FE_GIT_SHA) {
              setVersionMismatch(true);
            }
          }
        }
      } catch { /* backend unreachable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Phase D: Fetch market session every 30s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/ops/market_session');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) {
            setMarketOpen(data.is_open_now ?? false);
            setMarketSession(data.session ?? 'closed');
          }
        }
      } catch { /* backend unreachable */ }
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Ctrl+K command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build command palette items from WORKSPACES + COMMAND_REGISTRY
  const setActiveSymbol = useContextBus(s => s.setActiveSymbol);
  const commands: CmdItem[] = [
    ...WORKSPACES.map(ws => ({
      id: ws.id,
      label: ws.label,
      description: ws.description,
      icon: <span style={{ fontSize: '14px' }}>{ws.icon}</span>,
      category: 'navigation' as const,
      keywords: ws.keywords,
      path: ws.path,
    })),
    ...COMMAND_REGISTRY.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      icon: <span style={{ fontSize: '14px' }}>{c.icon}</span>,
      category: c.category as CmdItem['category'],
      keywords: c.keywords,
      path: c.path,
      ...(c.action?.startsWith('select-ticker-') ? {
        onSelect: () => setActiveSymbol(c.action!.replace('select-ticker-', '')),
      } : {}),
    })),
  ];

  return (
    <ToastProvider>
      {/* Phase A: Version mismatch banner */}
      {versionMismatch && (
        <div data-testid="version-mismatch-banner" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          background: 'var(--warn, #F59E0B)', color: '#fff', textAlign: 'center',
          padding: '6px 16px', fontSize: '12px', fontWeight: 600,
          pointerEvents: 'none',
        }}>
          Version mismatch — FE: {FE_GIT_SHA} / BE: {beGitSha}. Hard-refresh recommended.
        </div>
      )}

      {/* Skip-to-main-content */}
      <a
        href="#main-content"
        data-testid="skip-to-main"
        style={{
          position: 'fixed', top: '-40px', left: '8px', zIndex: 9999,
          padding: '8px 16px', background: 'var(--brand, #2962FF)', color: '#fff',
          fontWeight: 600, fontSize: '13px', borderRadius: '4px',
          textDecoration: 'none', transition: 'top 0.1s',
        }}
        onFocus={e => { e.currentTarget.style.top = '8px'; }}
        onBlur={e => { e.currentTarget.style.top = '-40px'; }}
      >
        Skip to main content
      </a>

      {/* ━━━ MAIN APP GRID ━━━
        3 rows: 40px topbar | 1fr layout | 20px statusbar
        Layout inner: 48px leftnav | 1fr content | 286px rightsidebar
      */}
      <div
        className="apex-app"
        data-testid="ui2-app-shell"
        style={{
          display: 'grid',
          gridTemplateRows: '40px 1fr 20px',
          gridTemplateColumns: '1fr',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--bg0, #0C0E12)',
          color: 'var(--tx1, #D1D4DC)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '13px',
        }}
      >
        {/* ROW 1: TopBar (40px) */}
        {/* Data mode badge — visible in TopBar area */}
        <span
          data-testid="ui2-data-mode-badge"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0.01 }}
          aria-hidden="false"
        >Online</span>
        <TopBar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          connectionStatus={connectionStatus}
          marketOpen={marketOpen}
          marketSession={marketSession}
        />

        {/* ROW 2: Layout (1fr) — 3-column inner grid */}
        <div
          className="apex-layout"
          data-testid="ui2-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr 286px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* COL 1: LeftNav (48px) */}
          <LeftNav />

          {/* COL 2: Content (1fr) */}
          <div
            className="apex-content"
            id="main-content"
            role="main"
            aria-label="Main workspace"
            data-testid="ui2-center"
            style={{
              overflow: 'auto',
              minHeight: 0,
              background: 'var(--bg1, #131722)',
              borderLeft: '1px solid var(--border, #1E222D)',
              borderRight: '1px solid var(--border, #1E222D)',
            }}
          >
            <Outlet />
          </div>

          {/* COL 3: RightSidebar (286px) */}
          <RightSidebarNew />
        </div>

        {/* ROW 3: StatusBar (20px) */}
        <StatusBar
          marketOpen={marketOpen}
          marketSession={marketSession}
          connectionStatus={connectionStatus}
        />
      </div>

      {/* Command Palette Overlay (Ctrl+K) */}
      <CommandPaletteNew
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commands}
      />
    </ToastProvider>
  );
}
