/**
 * Apex Terminal — LeftNav Component  
 * Matches demo/index.html exactly:
 * Logo → Autopilot → TRADE group → STRAT group → MKTS group → ASSET group → SYSTEM group
 * Collapsible groups with SVG icons, tooltips, active indicator
 */
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  defaultExpanded: boolean;
  items: NavItem[];
}

// ─── SVG Icon helpers ───
const SvgChart = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="1,12 5,7 9,9 13,3 14,3" />
    <polyline points="13,3 14,3 14,5" />
  </svg>
);
const SvgDashboard = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
);
const SvgPortfolio = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 14 L2 8 L5 5 L8 8 L11 4 L14 8 L14 14z" />
  </svg>
);
const SvgOrders = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="2" width="11" height="11" rx="1" />
    <line x1="4.5" y1="6" x2="10.5" y2="6" />
    <line x1="4.5" y1="8.5" x2="8" y2="8.5" />
  </svg>
);
const SvgRisk = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7.5 1.5L1 13.5h13z" />
    <line x1="7.5" y1="6.5" x2="7.5" y2="9.5" />
    <circle cx="7.5" cy="11.5" r=".7" fill="currentColor" />
  </svg>
);
const SvgHeatmap = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1.5" y="1.5" width="4.5" height="4.5" rx=".8" />
    <rect x="9" y="1.5" width="4.5" height="4.5" rx=".8" />
    <rect x="1.5" y="9" width="4.5" height="4.5" rx=".8" />
    <rect x="9" y="9" width="4.5" height="4.5" rx=".8" />
  </svg>
);
const SvgBacktest = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="7.5" cy="7.5" r="6" />
    <polyline points="4.5,7.5 7.5,4.5 10.5,9" />
  </svg>
);
const SvgWalkForward = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="1.5,12 4.5,7.5 7.5,9.5 10.5,4.5 13.5,6.5" />
    <line x1="13.5" y1="6.5" x2="13.5" y2="12" />
  </svg>
);
const SvgMonteCarlo = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 11.5 Q5 4 7.5 7.5 Q10 11 13 2.5" />
  </svg>
);
const SvgStrategy = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="3.5,11.5 6.5,5.5 9.5,8.5 12.5,3.5" />
    <circle cx="3.5" cy="11.5" r="1.5" fill="currentColor" />
    <circle cx="12.5" cy="3.5" r="1.5" fill="currentColor" />
  </svg>
);
const SvgOptions = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 12.5 C3 6.5 6.5 2.5 12.5 2.5" />
    <circle cx="7.5" cy="7.5" r="2.5" />
  </svg>
);
const SvgScreener = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="6.5" cy="6.5" r="4.5" />
    <line x1="10" y1="10" x2="13.5" y2="13.5" />
    <line x1="4.5" y1="6.5" x2="8.5" y2="6.5" />
    <line x1="6.5" y1="4.5" x2="6.5" y2="8.5" />
  </svg>
);
const SvgAlerts = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9.5 3A4 4 0 0 0 3.5 7v3l-1 1.5h10l-1-1.5V7M6.5 13a2 2 0 0 0 2-2H4.5a2 2 0 0 0 2 2z" />
  </svg>
);
const SvgMacro = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1.5" y="2.5" width="12" height="10.5" rx="1" />
    <line x1="1.5" y1="6" x2="13.5" y2="6" />
    <line x1="5.5" y1="2.5" x2="5.5" y2="6" />
    <line x1="9.5" y1="2.5" x2="9.5" y2="6" />
  </svg>
);
const SvgResearch = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M11.5 1.5H3.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1z" />
    <line x1="4.5" y1="5.5" x2="10.5" y2="5.5" />
    <line x1="4.5" y1="8" x2="8.5" y2="8" />
  </svg>
);
const SvgSocial = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="5" cy="5.5" r="2.2" />
    <circle cx="10" cy="5.5" r="2.2" />
    <path d="M1 13c0-2 1.8-3.5 4-3.5h5c2.2 0 4 1.5 4 3.5" />
  </svg>
);
const SvgFI = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="4" width="11" height="8" rx="1" />
    <line x1="2" y1="7.5" x2="13" y2="7.5" />
    <path d="M5 4V2h5v2" />
  </svg>
);
const SvgFX = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="7.5" cy="7.5" r="5.5" />
    <path d="M2 7.5h11" />
    <path d="M7.5 2c-1.5 2-1.5 9 0 11" />
    <path d="M7.5 2c1.5 2 1.5 9 0 11" />
  </svg>
);
const SvgCommodities = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7.5 2L3 7l4.5 6L12 7z" />
    <line x1="7.5" y1="2" x2="7.5" y2="13" />
  </svg>
);
const SvgCrypto = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="7.5" cy="7.5" r="6" />
    <path d="M5.5 5.5h3a1.5 1.5 0 0 1 0 3H5.5v0h3.5a1.5 1.5 0 0 1 0 3H5.5" />
    <line x1="6.5" y1="3.5" x2="6.5" y2="5.5" />
    <line x1="8.5" y1="3.5" x2="8.5" y2="5.5" />
    <line x1="6.5" y1="11.5" x2="6.5" y2="13" />
    <line x1="8.5" y1="11.5" x2="8.5" y2="13" />
  </svg>
);
const SvgCompliance = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="2" width="11" height="11" rx="1" />
    <polyline points="4.5,7.5 6.5,9.5 10.5,5.5" />
  </svg>
);
const SvgPlatform = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="7.5" cy="7.5" r="2.5" />
    <path d="M7.5 1v2M7.5 11.5v2M1 7.5h2M11.5 7.5h2M2.9 2.9l1.4 1.4M10 10l1.5 1.5M2.9 12.1l1.4-1.4M10 5l1.5-1.5" />
  </svg>
);
const SvgAutopilot = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="8" cy="6" r="3" />
    <path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    <path d="M8 3V1M8 11v2M1 8h2M13 8h2M3 3l1.4 1.4M10.6 10.6l1.4 1.4M3 13l1.4-1.4M10.6 5.4l1.4-1.4" />
  </svg>
);

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'trade',
    label: 'TRADE',
    defaultExpanded: false,
    items: [
      { id: 'trading', label: 'Trading', path: '/ui2/trading', icon: <SvgChart /> },
      { id: 'dashboard', label: 'Dashboard', path: '/ui2/dashboard', icon: <SvgDashboard /> },
      { id: 'portfolio', label: 'Portfolio', path: '/ui2/portfolio', icon: <SvgPortfolio /> },
      { id: 'orders', label: 'Orders / Blotter', path: '/ui2/orders', icon: <SvgOrders /> },
      { id: 'risk', label: 'Risk Management', path: '/ui2/risk-dashboard', icon: <SvgRisk /> },
      { id: 'heatmap', label: 'Market Heatmap', path: '/ui2/heatmap', icon: <SvgHeatmap /> },
    ],
  },
  {
    id: 'strat',
    label: 'STRAT',
    defaultExpanded: false,
    items: [
      { id: 'backtest', label: 'Backtest', path: '/ui2/backtest', icon: <SvgBacktest /> },
      { id: 'walkforward', label: 'Walk-Forward', path: '/ui2/backtest', icon: <SvgWalkForward /> },
      { id: 'montecarlo', label: 'Monte Carlo', path: '/ui2/monte-carlo-sim', icon: <SvgMonteCarlo /> },
      { id: 'strategy', label: 'Strategy Studio', path: '/ui2/strategy-builder-pro', icon: <SvgStrategy /> },
    ],
  },
  {
    id: 'mkts',
    label: 'MKTS',
    defaultExpanded: false,
    items: [
      { id: 'options', label: 'Options Chain', path: '/ui2/options-chain', icon: <SvgOptions /> },
      { id: 'screener', label: 'Screener', path: '/ui2/stock-screener', icon: <SvgScreener /> },
      { id: 'alerts', label: 'Alerts', path: '/ui2/alerts-manager', icon: <SvgAlerts /> },
      { id: 'macro', label: 'Economic Calendar', path: '/ui2/macro', icon: <SvgMacro /> },
      { id: 'research', label: 'Research / Sentiment', path: '/ui2/research', icon: <SvgResearch /> },
      { id: 'social', label: 'Ideas / Social', path: '/ui2/social', icon: <SvgSocial /> },
    ],
  },
  {
    id: 'asset',
    label: 'ASSET',
    defaultExpanded: false,
    items: [
      { id: 'fixedincome', label: 'Fixed Income', path: '/ui2/fixed-income', icon: <SvgFI /> },
      { id: 'fx', label: 'FX / Forex', path: '/ui2/fx-dashboard', icon: <SvgFX /> },
      { id: 'commodities', label: 'Commodities', path: '/ui2/commodities', icon: <SvgCommodities /> },
      { id: 'crypto', label: 'Crypto / Digital', path: '/ui2/crypto', icon: <SvgCrypto /> },
    ],
  },
  {
    id: 'system',
    label: 'SYS',
    defaultExpanded: false,
    items: [
      { id: 'compliance', label: 'Compliance', path: '/ui2/settings', icon: <SvgCompliance /> },
      { id: 'platform', label: 'Platform', path: '/ui2/ops', icon: <SvgPlatform /> },
    ],
  },
];

export function LeftNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map(g => [g.id, g.defaultExpanded]))
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="apex-leftnav" data-testid="ui2-left-rail">
      {/* Logo icon */}
      <div style={{ padding: '4px 0 2px', display: 'flex', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <polygon points="10,2 18,7 18,13 10,18 2,13 2,7" fill="#2962FF" opacity=".9" />
          <polyline points="5,11 8,7 11,9 15,5" stroke="white" strokeWidth="1.6" fill="none" />
        </svg>
      </div>

      {/* Autopilot — prominent placement */}
      <button
        className={`nav-item${isActive('/ui2/autopilot') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/autopilot')}
        data-testid="ui2-rail-autopilot"
        title="Autopilot / AI"
      >
        <SvgAutopilot />
        <span className="nav-tip">Autopilot / AI</span>
      </button>
      <div className="navd" />

      {/* Core items — always visible */}
      <button
        className={`nav-item${isActive('/ui2/search') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/search')}
        data-testid="ui2-rail-search"
        title="Search"
      >
        <SvgScreener />
        <span className="nav-tip">Search</span>
      </button>
      <button
        className={`nav-item${isActive('/ui2/workflow-builder') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/workflow-builder')}
        data-testid="ui2-rail-workflow-builder"
        title="Workflow Builder"
      >
        <SvgStrategy />
        <span className="nav-tip">Workflow Builder</span>
      </button>
      <button
        className={`nav-item${isActive('/ui2/backtest') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/backtest')}
        data-testid="ui2-rail-backtest"
        title="Backtest"
      >
        <SvgBacktest />
        <span className="nav-tip">Backtest</span>
      </button>
      <button
        className={`nav-item${isActive('/ui2/runs') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/runs')}
        data-testid="ui2-rail-runs"
        title="Runs"
      >
        <SvgWalkForward />
        <span className="nav-tip">Runs</span>
      </button>
      <div className="navd" />

      {/* Nav Groups */}
      {NAV_GROUPS.map(group => {
        const isExpanded = expandedGroups[group.id];
        return (
          <div key={group.id} className={`nav-group nav-group-${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div
              className="nav-group-label"
              onClick={() => toggleGroup(group.id)}
              role="button"
              title={`Click to ${isExpanded ? 'collapse' : 'expand'}`}
            >
              {group.label}{' '}
              <span className="nav-chevron">{isExpanded ? '▼' : '▶'}</span>
            </div>
            {isExpanded && (
              <div className="nav-group-items">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    className={`nav-item${isActive(item.path) ? ' active' : ''}`}
                    onClick={() => navigate(item.path)}
                    data-testid={`ui2-rail-${item.id}`}
                    title={item.label}
                  >
                    {item.icon}
                    <span className="nav-tip">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="nav-spacer" />

      {/* Settings — always at bottom */}
      <button
        className={`nav-item${isActive('/ui2/settings') ? ' active' : ''}`}
        onClick={() => navigate('/ui2/settings')}
        data-testid="ui2-rail-settings"
        title="Settings"
      >
        <SvgPlatform />
        <span className="nav-tip">Settings</span>
      </button>
    </div>
  );
}
