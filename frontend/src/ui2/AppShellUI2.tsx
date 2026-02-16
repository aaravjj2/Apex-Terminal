/**
 * UI2 AppShellUI2 Component
 * Main layout shell: TopBar + LeftRail + LeftDrawer + Center + RightSidebar + BottomDock
 * Wraps content with ToastProvider for embedded UI1 components
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BottomDock, RightSidebar } from './components';
import { DEMO_USER, DEMO_MARKET_STATUS, DEMO_WS_STATUS } from './demo/constants';
import { ToastProvider } from '../ui/Toast';
import { OrdersBlotter } from '../features/orders/OrdersBlotter';
import { TradesLedger } from '../features/trades/TradesLedger';

interface WorkspaceConfig {
  id: string;
  label: string;
  icon: string;
  path: string;
  section?: 'main' | 'tools' | 'system';
}

const WORKSPACES: WorkspaceConfig[] = [
  // Main section
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/ui2/dashboard', section: 'main' },
  { id: 'trading', label: 'Trading', icon: '📈', path: '/ui2/trading', section: 'main' },
  { id: 'portfolio', label: 'Portfolio', icon: '💼', path: '/ui2/portfolio', section: 'main' },
  { id: 'orders', label: 'Orders', icon: '📋', path: '/ui2/orders', section: 'main' },
  // Tools section
  { id: 'risk', label: 'Risk & Options', icon: '🛡️', path: '/ui2/risk', section: 'tools' },
  { id: 'research', label: 'Research', icon: '🔬', path: '/ui2/research', section: 'tools' },
  { id: 'backtest', label: 'Backtest', icon: '🧪', path: '/ui2/backtest', section: 'tools' },
  { id: 'autopilot', label: 'Autopilot', icon: '🤖', path: '/ui2/autopilot', section: 'tools' },
  { id: 'alerts', label: 'Alerts', icon: '🔔', path: '/ui2/alerts', section: 'tools' },
  { id: 'replay', label: 'Replay', icon: '⏪', path: '/ui2/replay', section: 'tools' },
  // System section
  { id: 'runs', label: 'Runs & Audit', icon: '📜', path: '/ui2/runs', section: 'system' },
  { id: 'ops', label: 'Ops', icon: '⚙️', path: '/ui2/ops', section: 'system' },
  { id: 'settings', label: 'Settings', icon: '🔧', path: '/ui2/settings', section: 'system' },
];

export function AppShellUI2() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <ToastProvider>
    <div
      className="ui2-root"
      data-testid="ui2-app-shell"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '48px 1fr 240px',
        gridTemplateColumns: '56px auto 1fr auto',
        gridTemplateAreas: `
          "topbar topbar topbar topbar"
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
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--ui2-brand)',
          }}
        >
          QuantCloud UI v2
        </div>
        <input
          type="text"
          placeholder="Search or run command..."
          data-testid="ui2-command-input"
          style={{
            flex: 1,
            maxWidth: '600px',
            padding: '6px 12px',
            fontSize: '13px',
            background: 'var(--ui2-bg-panel)',
            border: '1px solid var(--ui2-border)',
            borderRadius: 'var(--ui2-radius-md)',
            color: 'var(--ui2-text-primary)',
          }}
        />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          <span
            style={{
              color: DEMO_MARKET_STATUS.isOpen
                ? 'var(--ui2-success)'
                : 'var(--ui2-text-muted)',
            }}
          >
            {DEMO_MARKET_STATUS.isOpen ? '● Market Open' : '○ Market Closed'}
          </span>
          <span style={{ color: 'var(--ui2-text-muted)' }}>
            WS: {DEMO_WS_STATUS.latency}ms
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              background: 'var(--ui2-bg-panel)',
              borderRadius: 'var(--ui2-radius-md)',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--ui2-brand)',
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
            <span style={{ color: 'var(--ui2-text-primary)', fontSize: '13px' }}>
              {DEMO_USER.name}
            </span>
          </div>
        </div>
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
        {WORKSPACES.map((workspace, i) => {
          const isActive = activeWorkspace === workspace.id;
          const prevSection = i > 0 ? WORKSPACES[i - 1].section : undefined;
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
    </div>
    </ToastProvider>
  );
}
