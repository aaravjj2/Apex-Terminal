/**
 * UI2 AppShellUI2 Component
 * Professional trading terminal shell with Bloomberg-grade polish
 * TopBar + LeftRail + LeftDrawer + Center + RightSidebar + BottomDock + CommandPalette
 * v1.94: Real connection status from tradingStore
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BottomDock, RightSidebar, CommandPalette, MarketTape, type CommandItem } from './components';
import { DEMO_USER, DEMO_MARKET_STATUS } from './demo/constants';
import { COMMAND_REGISTRY } from './stores/commandRegistry';
import { ToastProvider } from '../ui/Toast';
import { OrdersBlotter } from '../features/orders/OrdersBlotter';
import { TradesLedger } from '../features/trades/TradesLedger';
import { tradingStore } from './stores/tradingStore';

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
  // Main section
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: '🏠', 
    path: '/ui2/dashboard', 
    section: 'main',
    description: 'Command center with key metrics',
    keywords: ['home', 'overview', 'metrics', 'kpi']
  },
  { 
    id: 'trading', 
    label: 'Trading', 
    icon: '📈', 
    path: '/ui2/trading', 
    section: 'main',
    description: 'Live chart and order execution',
    keywords: ['chart', 'trade', 'order', 'execution']
  },
  { 
    id: 'portfolio', 
    label: 'Portfolio', 
    icon: '💼', 
    path: '/ui2/portfolio', 
    section: 'main',
    description: 'Positions and performance',
    keywords: ['positions', 'pnl', 'performance', 'holdings']
  },
  { 
    id: 'orders', 
    label: 'Orders', 
    icon: '📋', 
    path: '/ui2/orders', 
    section: 'main',
    description: 'Order history and management',
    keywords: ['order', 'history', 'fills', 'execution']
  },
  // Tools section
  { 
    id: 'risk', 
    label: 'Risk & Options', 
    icon: '🛡️', 
    path: '/ui2/risk', 
    section: 'tools',
    description: 'Options chain and risk analysis',
    keywords: ['options', 'greeks', 'risk', 'strategy']
  },
  { 
    id: 'research', 
    label: 'Research', 
    icon: '🔬', 
    path: '/ui2/research', 
    section: 'tools',
    description: 'Strategy lab and analysis',
    keywords: ['strategies', 'backtest', 'research', 'analysis']
  },
  { 
    id: 'backtest', 
    label: 'Backtest', 
    icon: '🧪', 
    path: '/ui2/backtest', 
    section: 'tools',
    description: 'Historical strategy testing',
    keywords: ['backtest', 'historical', 'test', 'simulation']
  },
  { 
    id: 'autopilot', 
    label: 'Autopilot', 
    icon: '🤖', 
    path: '/ui2/autopilot', 
    section: 'tools',
    description: 'Autonomous trading agent',
    keywords: ['autopilot', 'agent', 'autonomous', 'auto']
  },
  { 
    id: 'alerts', 
    label: 'Alerts', 
    icon: '🔔', 
    path: '/ui2/alerts', 
    section: 'tools',
    description: 'Price and technical alerts',
    keywords: ['alerts', 'notifications', 'triggers']
  },
  { 
    id: 'replay', 
    label: 'Replay', 
    icon: '⏪', 
    path: '/ui2/replay', 
    section: 'tools',
    description: 'Market replay and analysis',
    keywords: ['replay', 'historical', 'playback']
  },
  // System section
  { 
    id: 'runs', 
    label: 'Runs & Audit', 
    icon: '📜', 
    path: '/ui2/runs', 
    section: 'system',
    description: 'Execution audit trail',
    keywords: ['runs', 'audit', 'history', 'log']
  },
  { 
    id: 'ops', 
    label: 'Ops', 
    icon: '⚙️', 
    path: '/ui2/ops', 
    section: 'system',
    description: 'System operations and monitoring',
    keywords: ['ops', 'operations', 'system', 'monitoring']
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: '🔧', 
    path: '/ui2/settings', 
    section: 'system',
    description: 'Platform configuration',
    keywords: ['settings', 'config', 'preferences']
  },
  // Wave 7 — v1.63+
  {
    id: 'automation',
    label: 'Automation',
    icon: '🔄',
    path: '/ui2/automation',
    section: 'tools',
    description: 'Workflow automation studio',
    keywords: ['workflow', 'automation', 'pipeline', 'trigger']
  },
  {
    id: 'search',
    label: 'Search',
    icon: '🔍',
    path: '/ui2/search',
    section: 'tools',
    description: 'Full-text entity search',
    keywords: ['search', 'find', 'query', 'elasticsearch']
  },
  {
    id: 'agent',
    label: 'AI Agent',
    icon: '💡',
    path: '/ui2/agent',
    section: 'tools',
    description: 'AI assistant with tool execution',
    keywords: ['agent', 'ai', 'assistant', 'nova', 'llm']
  },
  // Wave 8 — v1.73+
  {
    id: 'autopilot-v2',
    label: 'Autopilot V2',
    icon: '🚀',
    path: '/ui2/autopilot-v2',
    section: 'tools',
    description: 'V2 pipeline: scoring, risk, sizing, execution sim',
    keywords: ['autopilot', 'v2', 'pipeline', 'scoring', 'risk', 'execution']
  },
  {
    id: 'automation-v2',
    label: 'Automation V2',
    icon: '⚡',
    path: '/ui2/automation-v2',
    section: 'tools',
    description: 'DAG-based workflow automation engine',
    keywords: ['automation', 'dag', 'workflow', 'trigger']
  },
  {
    id: 'export',
    label: 'Export',
    icon: '📦',
    path: '/ui2/export',
    section: 'system',
    description: 'Export bundles and compliance reports',
    keywords: ['export', 'bundle', 'report', 'audit', 'compliance']
  },
  {
    id: 'health',
    label: 'Health',
    icon: '💚',
    path: '/ui2/health',
    section: 'system',
    description: 'Platform health and observability',
    keywords: ['health', 'status', 'metrics', 'observability']
  },
  // Wave 12 — v1.115+
  {
    id: 'telemetry',
    label: 'Telemetry',
    icon: '📡',
    path: '/ui2/telemetry',
    section: 'system',
    description: 'Event telemetry and observability',
    keywords: ['telemetry', 'events', 'observability', 'tracing']
  },
  {
    id: 'autopilot-explain',
    label: 'Explain',
    icon: '🧠',
    path: '/ui2/autopilot-explain',
    section: 'tools',
    description: 'Autopilot decision explainability',
    keywords: ['explain', 'autopilot', 'decision', 'reasoning']
  },
  // Wave 13-14 — v1.123+
  {
    id: 'automation-runs',
    label: 'Automation Runs',
    icon: '🏃',
    path: '/ui2/automation-runs',
    section: 'system',
    description: 'Automation run history and logs',
    keywords: ['runs', 'automation', 'execution', 'history', 'logs']
  },
  {
    id: 'workflow-builder',
    label: 'Workflow Builder',
    icon: '🔨',
    path: '/ui2/workflow-builder',
    section: 'tools',
    description: 'Visual workflow editor with templates',
    keywords: ['workflow', 'builder', 'create', 'template', 'editor']
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: '🚨',
    path: '/ui2/incidents',
    section: 'system',
    description: 'Incident tracking and response',
    keywords: ['incidents', 'alert', 'outage', 'response']
  },
  {
    id: 'decisions',
    label: 'Decisions',
    icon: '🧭',
    path: '/ui2/decisions',
    section: 'tools',
    description: 'Autopilot decision explorer with portfolio impact',
    keywords: ['decisions', 'autopilot', 'impact', 'portfolio']
  },
  {
    id: 'health-v4',
    label: 'Health V4',
    icon: '💊',
    path: '/ui2/health-v4',
    section: 'system',
    description: 'All-subsystem health with search, LLM, replay status',
    keywords: ['health', 'v4', 'subsystem', 'status']
  },
  // Wave 17 — v1.150+
  {
    id: 'ai-provider',
    label: 'AI Provider',
    icon: '🧩',
    path: '/ui2/ai-provider',
    section: 'system',
    description: 'LLM provider status, budget, cache, rate limits',
    keywords: ['ai', 'llm', 'provider', 'budget', 'cache', 'nova']
  },
  // Wave 18 — v1.155+
  {
    id: 'decision-explainer',
    label: 'Decision V2',
    icon: '📊',
    path: '/ui2/decision-explainer',
    section: 'tools',
    description: 'Decision explainer with feature attribution and confidence',
    keywords: ['decision', 'explainer', 'attribution', 'confidence', 'post-trade']
  },
  {
    id: 'nl-workflow',
    label: 'NL Workflow',
    icon: '✨',
    path: '/ui2/nl-workflow',
    section: 'tools',
    description: 'Natural language workflow generator with validation',
    keywords: ['nl', 'workflow', 'generate', 'natural', 'language', 'simulation']
  },
];

// Core Correctness Track — only 4 core features + 2 minimal ops shown in nav.
// All other workspaces are still routable but hidden from the left rail.
const CORE_NAV_IDS = new Set(['autopilot', 'search', 'workflow-builder', 'backtest', 'runs', 'settings']);
const VISIBLE_WORKSPACES = WORKSPACES.filter(w => CORE_NAV_IDS.has(w.id));

export function AppShellUI2() {
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isE2EMode = typeof window !== 'undefined' && (
    window.location.search.includes('e2e=1') || 
    window.location.search.includes('PLAYWRIGHT_TEST_BASE_URL')
  );

  // Subscribe to trading store connection status (v1.94)
  const connectionStatus = useSyncExternalStore(
    tradingStore.subscribe, 
    tradingStore.getConnectionStatus
  );

  const drawerVisible = true;
  const rightSidebarContent = (
    <div style={{ color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
      Select an item to inspect
    </div>
  );
  const [bottomDockTabs] = useState([
    {
      id: 'orders',
      label: 'Orders',
      content: <OrdersBlotter embedded />,
    },
    {
      id: 'trades',
      label: 'Trades',
      content: <TradesLedger embedded />,
    },
    {
      id: 'logs',
      label: 'Logs',
      content: <div style={{ color: 'var(--ui2-text-muted)', padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>System logs stream...</div>,
    },
  ]);

  const activeWorkspace =
    WORKSPACES.find((w) => location.pathname.startsWith(w.path))?.id || 'dashboard';

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

  // Build command palette items from COMMAND_REGISTRY + workspace navigation
  const commands: CommandItem[] = [
    ...WORKSPACES.map((ws) => ({
      id: ws.id,
      label: ws.label,
      description: ws.description,
      icon: ws.icon,
      category: 'navigation' as const,
      keywords: ws.keywords,
      path: ws.path,
    })),
    ...COMMAND_REGISTRY.filter(c => c.category !== 'navigation').map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      icon: c.icon,
      category: c.category,
      keywords: c.keywords,
      path: c.path,
    })),
  ];

  return (
    <ToastProvider>
    <div
      className="ui2-root"
      data-testid="ui2-app-shell"
      data-e2e-mode={isE2EMode ? 'true' : 'false'}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '48px 32px 1fr 240px',
        gridTemplateColumns: '56px auto 1fr auto',
        gridTemplateAreas: `
          "topbar topbar topbar topbar"
          "tape tape tape tape"
          "rail drawer center sidebar"
          "rail dock dock dock"
        `,
        background: 'var(--ui2-bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* TopBar */}
      <div
        data-testid="ui2-topbar"
        style={{
          gridArea: 'topbar',
          background: 'var(--ui2-bg-elevated)',
          borderBottom: '1px solid var(--ui2-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '16px',
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--ui2-radius-md)',
              background: 'linear-gradient(135deg, var(--ui2-brand-primary) 0%, var(--ui2-brand-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            A
          </div>
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--ui2-text-primary)',
                lineHeight: 1,
              }}
            >
              Apex Terminal
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--ui2-text-tertiary)',
                lineHeight: 1,
                marginTop: '2px',
              }}
            >
              Professional Edition
            </div>
          </div>
        </div>

        {/* Command Search Input (triggers palette) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          data-testid="ui2-command-trigger"
          style={{
            flex: 1,
            maxWidth: '600px',
            padding: '6px 12px',
            fontSize: '13px',
            background: 'var(--ui2-bg-input)',
            border: '1px solid var(--ui2-border)',
            borderRadius: 'var(--ui2-radius-md)',
            color: 'var(--ui2-text-tertiary)',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'border-color var(--ui2-transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ui2-border-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--ui2-border)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔍</span>
            <span>Search or run command...</span>
          </div>
          <div
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--ui2-bg-elevated)',
              borderRadius: 'var(--ui2-radius-sm)',
              color: 'var(--ui2-text-secondary)',
            }}
          >
            Ctrl+K
          </div>
        </button>

        <div style={{ flex: 1 }} />

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          {/* Mode Badge */}
          <div className="ui2-badge ui2-badge-info" data-testid="ui2-mode-badge">
            <span>🎯</span>
            <span>DEMO</span>
          </div>

          {/* Market Status */}
          <div
            className={`ui2-badge ${DEMO_MARKET_STATUS.isOpen ? 'ui2-badge-success' : 'ui2-badge-neutral'}`}
            data-testid="ui2-market-status"
          >
            <span>{DEMO_MARKET_STATUS.isOpen ? '●' : '○'}</span>
            <span>{DEMO_MARKET_STATUS.isOpen ? 'Market Open' : 'Market Closed'}</span>
          </div>

          {/* Connectivity (v1.94: Real status from tradingStore) */}
          <div 
            className={`ui2-badge ${
              connectionStatus === 'connected' ? 'ui2-badge-success' :
              connectionStatus === 'connecting' ? 'ui2-badge-warning' :
              connectionStatus === 'fallback' ? 'ui2-badge-warning' :
              'ui2-badge-neutral'
            }`} 
            data-testid="ui2-conn-status"
            title={`Connection: ${connectionStatus}`}
          >
            <span>{connectionStatus === 'connected' ? '⚡' : connectionStatus === 'connecting' ? '⏳' : connectionStatus === 'fallback' ? '📡' : '○'}</span>
            <span>
              {connectionStatus === 'connected' ? 'WS' :
               connectionStatus === 'connecting' ? 'Connecting' :
               connectionStatus === 'fallback' ? 'Polling' :
               'Offline'}
            </span>
          </div>

          {/* User Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              background: 'var(--ui2-bg-panel)',
              borderRadius: 'var(--ui2-radius-md)',
              border: '1px solid var(--ui2-border)',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--ui2-brand-primary) 0%, var(--ui2-brand-hover) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {DEMO_USER.name.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ color: 'var(--ui2-text-primary)', fontSize: '13px', fontWeight: 500 }}>
              {DEMO_USER.name}
            </span>
          </div>
        </div>
      </div>

      {/* MarketTape */}
      <div style={{ gridArea: 'tape' }}>
        <MarketTape />
      </div>

      {/* LeftRail */}
      <div
        data-testid="ui2-left-rail"
        style={{
          gridArea: 'rail',
          background: 'var(--ui2-bg-elevated)',
          borderRight: '1px solid var(--ui2-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '8px',
          gap: '4px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {VISIBLE_WORKSPACES.map((workspace, i) => {
          const isActive = activeWorkspace === workspace.id;
          const prevSection = i > 0 ? VISIBLE_WORKSPACES[i - 1].section : undefined;
          const showDivider = prevSection && workspace.section !== prevSection;
          return (
            <div key={workspace.id} style={{ display: 'contents' }}>
              {showDivider && (
                <div style={{ width: '32px', height: '1px', background: 'var(--ui2-border)', margin: '4px 0' }} />
              )}
              <button
                data-testid={`ui2-rail-${workspace.id}`}
                onClick={() => navigate(workspace.path)}
                title={workspace.label}
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  background: isActive ? 'var(--ui2-bg-selected)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--ui2-radius-md)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid var(--ui2-brand)' : '3px solid transparent',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--ui2-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {workspace.icon}
              </button>
            </div>
          );
        })}
      </div>

      {/* LeftDrawer */}
      {drawerVisible && (
        <div
          data-testid="ui2-left-drawer"
          style={{
            gridArea: 'drawer',
            width: '240px',
            background: 'var(--ui2-bg-panel)',
            borderRight: '1px solid var(--ui2-border)',
            overflow: 'auto',
            padding: '12px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--ui2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            {WORKSPACES.find((w) => w.id === activeWorkspace)?.label || 'Workspace'}
          </div>
          <div style={{ color: 'var(--ui2-text-muted)', fontSize: '12px' }}>
            Context-sensitive list (watchlist, strategies, portfolios, etc.)
          </div>
        </div>
      )}

      {/* Center Workspace */}
      <div
        data-testid="ui2-center"
        style={{
          gridArea: 'center',
          background: 'var(--ui2-bg-base)',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Outlet />
      </div>

      {/* RightSidebar */}
      <div style={{ gridArea: 'sidebar' }}>
        <RightSidebar testId="ui2-right-sidebar">{rightSidebarContent}</RightSidebar>
      </div>

      {/* BottomDock */}
      <div style={{ gridArea: 'dock' }}>
        <BottomDock
          tabs={bottomDockTabs}
          defaultTab="orders"
          testId="ui2-bottom-dock"
        />
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
        testId="ui2-command-palette"
      />
    </div>
    </ToastProvider>
  );
}
