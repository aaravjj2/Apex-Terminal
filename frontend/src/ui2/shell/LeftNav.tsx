/**
 * Apex Terminal — LeftNav
 * Clean Bloomberg-style icon rail: 10 core pages + Settings at bottom.
 * 48px wide, flat icons, amber active indicator, tooltip on hover.
 */
import { useNavigate, useLocation } from 'react-router-dom';

// ─── Token colours (match ui2-tokens.css) ───
const C = {
  bg:      '#0a0c10',
  border:  '#1d2230',
  tx3:     '#4b5264',
  tx1:     '#c4cad6',
  active:  '#f0c040',     // amber — Bloomberg accent
  activeBg:'rgba(240,192,64,0.08)',
  hover:   'rgba(255,255,255,0.05)',
};

// ─── SVG Icons (15×15) ───
const I = {
  dashboard: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1"/>
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/>
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/>
    </svg>
  ),
  trading: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <polyline points="1,12 4,7 7.5,9.5 11,4 14,5"/>
      <polyline points="14,5 14,2 11,2" fill="none"/>
    </svg>
  ),
  portfolio: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="7.5" cy="7.5" r="5.5"/>
      <path d="M7.5 2v5.5l3.5 2"/>
    </svg>
  ),
  autopilot: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="7.5" cy="7.5" r="5.5"/>
      <path d="M5 7.5l2 2 4-4"/>
    </svg>
  ),
  options: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="1" y="4" width="13" height="8" rx="1"/>
      <line x1="4" y1="7" x2="4" y2="9"/>
      <line x1="7.5" y1="6.5" x2="7.5" y2="9.5"/>
      <line x1="11" y1="7" x2="11" y2="9"/>
    </svg>
  ),
  heatmap: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="1" y="1" width="5.5" height="4" rx=".8" fill="currentColor" opacity=".4"/>
      <rect x="8.5" y="1" width="5.5" height="4" rx=".8" fill="currentColor" opacity=".7"/>
      <rect x="1" y="7" width="5.5" height="7" rx=".8" fill="currentColor" opacity=".8"/>
      <rect x="8.5" y="7" width="5.5" height="4" rx=".8" fill="currentColor" opacity=".3"/>
    </svg>
  ),
  backtest: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="7.5" cy="7.5" r="5.5"/>
      <polyline points="10,7.5 7.5,5 5,7.5"/>
      <line x1="7.5" y1="5" x2="7.5" y2="10.5"/>
    </svg>
  ),
  screener: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="6.5" cy="6.5" r="4.5"/>
      <line x1="10" y1="10" x2="13.5" y2="13.5"/>
    </svg>
  ),
  risk: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7.5 1.5L1 13.5h13z"/>
      <line x1="7.5" y1="6" x2="7.5" y2="9.5"/>
      <circle cx="7.5" cy="11.5" r=".8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  watchlist: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <line x1="1" y1="4" x2="14" y2="4"/>
      <line x1="1" y1="7.5" x2="14" y2="7.5"/>
      <line x1="1" y1="11" x2="14" y2="11"/>
      <circle cx="3.5" cy="4" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="11" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  ),
  settings: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="7.5" cy="7.5" r="2.5"/>
      <path d="M7.5 1.5v1.8M7.5 11.7v1.8M1.5 7.5h1.8M11.7 7.5h1.8M3.2 3.2l1.3 1.3M10.5 10.5l1.3 1.3M3.2 11.8l1.3-1.3M10.5 4.5l1.3-1.3"/>
    </svg>
  ),
};

// ─── Navigation items ───
const NAV_ITEMS: Array<{ id: string; label: string; path: string; icon: React.ReactNode }> = [
  { id: 'dashboard',  label: 'Dashboard',    path: '/ui2/dashboard',        icon: I.dashboard  },
  { id: 'trading',    label: 'Trading',       path: '/ui2/trading',          icon: I.trading    },
  { id: 'portfolio',  label: 'Portfolio',     path: '/ui2/portfolio',        icon: I.portfolio  },
  { id: 'autopilot',  label: 'Autopilot',     path: '/ui2/autopilot',        icon: I.autopilot  },
  { id: 'options',    label: 'Options',       path: '/ui2/options-chain',    icon: I.options    },
  { id: 'heatmap',    label: 'Heatmap',       path: '/ui2/heatmap',          icon: I.heatmap    },
  { id: 'watchlist',  label: 'Watchlists',    path: '/ui2/watchlist-manager',icon: I.watchlist  },
  { id: 'backtest',   label: 'Backtest',      path: '/ui2/backtest',         icon: I.backtest   },
  { id: 'screener',   label: 'Screener',      path: '/ui2/screeners',        icon: I.screener   },
  { id: 'risk',       label: 'Risk',          path: '/ui2/risk',             icon: I.risk       },
];

export function LeftNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav
      data-testid="ui2-left-rail"
      role="navigation"
      aria-label="Primary navigation"
      style={{
        width: 48,
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 6,
        gap: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {NAV_ITEMS.map(item => {
        const active = isActive(item.path);
        return (
          <button
            key={item.id}
            data-testid={`ui2-rail-${item.id}`}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
            style={{
              width: 40,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? C.activeBg : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: active ? C.active : C.tx3,
              margin: '1px 0',
              transition: 'color 0.12s, background 0.12s',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = C.tx1;
                (e.currentTarget as HTMLButtonElement).style.background = C.hover;
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = C.tx3;
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {/* Active indicator bar */}
            {active && (
              <span style={{
                position: 'absolute',
                left: 0,
                top: '20%',
                width: 2,
                height: '60%',
                background: C.active,
                borderRadius: '0 2px 2px 0',
              }}/>
            )}
            {item.icon}
          </button>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }}/>

      {/* Settings — pinned to bottom */}
      {(() => {
        const active = pathname.startsWith('/ui2/settings');
        return (
          <button
            data-testid="ui2-rail-settings"
            title="Settings"
            aria-label="Settings"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate('/ui2/settings')}
            style={{
              width: 40,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? C.activeBg : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: active ? C.active : C.tx3,
              margin: '1px 0',
              transition: 'color 0.12s, background 0.12s',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = C.tx1;
                (e.currentTarget as HTMLButtonElement).style.background = C.hover;
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = C.tx3;
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {active && (
              <span style={{
                position: 'absolute',
                left: 0,
                top: '20%',
                width: 2,
                height: '60%',
                background: C.active,
                borderRadius: '0 2px 2px 0',
              }}/>
            )}
            {I.settings}
          </button>
        );
      })()}
    </nav>
  );
}
