/**
 * BloombergToolbar.tsx
 * Bloomberg Terminal-style command toolbar with ticker search,
 * function key shortcuts, breadcrumb navigation, workspace switcher,
 * connection status indicator, clock, and quick-access action buttons.
 */

import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ToolbarAction {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
}

export interface WorkspaceTab {
  id: string;
  name: string;
  badge?: number;
}

interface SearchResult {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
  price?: number;
  change_pct?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_SEARCH: SearchResult[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'Stock', exchange: 'NASDAQ', price: 862.42, change_pct: 2.27 },
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'Stock', exchange: 'NASDAQ', price: 189.64, change_pct: -0.80 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'Stock', exchange: 'NASDAQ', price: 412.88, change_pct: 0.65 },
  { ticker: 'TSLA', name: 'Tesla, Inc.', type: 'Stock', exchange: 'NASDAQ', price: 246.22, change_pct: -1.42 },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF', exchange: 'NYSE', price: 527.88, change_pct: 1.04 },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF', exchange: 'NASDAQ', price: 456.22, change_pct: 1.41 },
  { ticker: 'BTC-USD', name: 'Bitcoin USD', type: 'Crypto', exchange: 'CRYPTO', price: 68420, change_pct: 1.25 },
  { ticker: 'EUR/USD', name: 'Euro / US Dollar', type: 'FX', exchange: 'FOREX', price: 1.0842, change_pct: 0.12 },
  { ticker: 'GC=F', name: 'Gold Futures', type: 'Futures', exchange: 'CME', price: 2328.80, change_pct: -0.61 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'Stock', exchange: 'NASDAQ', price: 184.22, change_pct: 1.88 },
];

function searchSymbols(query: string): SearchResult[] {
  if (!query || query.length < 1) return [];
  const q = query.toUpperCase();
  return MOCK_SEARCH.filter(r =>
    r.ticker.includes(q) || r.name.toUpperCase().includes(q)
  ).slice(0, 7);
}

function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '0',
    background: 'linear-gradient(180deg, #1a2a3a 0%, #0e1c2e 100%)',
    borderBottom: '2px solid #4a9eff',
    height: '44px', padding: '0', position: 'relative', zIndex: 1000,
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    userSelect: 'none',
  },
  logoZone: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '0 12px', height: '100%',
    borderRight: '1px solid #1a2a38', cursor: 'pointer',
    minWidth: '120px',
  },
  logoText: { color: '#4a9eff', fontWeight: 700, fontSize: '14px', letterSpacing: '2px' },
  logoSub: { color: '#6b8aaa', fontSize: '9px', letterSpacing: '1px' },
  fnKeys: {
    display: 'flex', alignItems: 'center', height: '100%',
    borderRight: '1px solid #1a2a38',
  },
  fnKey: {
    height: '100%', padding: '0 8px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    borderRight: '1px solid #0a1628', minWidth: '42px',
    transition: 'background 0.1s',
    gap: '2px',
  },
  fnLabel: { color: '#4a9eff', fontSize: '9px', fontWeight: 700 },
  fnDesc: { color: '#6b8aaa', fontSize: '8px' },
  searchZone: {
    flex: 1, padding: '0 8px', height: '100%',
    display: 'flex', alignItems: 'center', position: 'relative',
    maxWidth: '340px',
  },
  searchInput: {
    background: '#060e18', border: '1px solid #1a2a38', color: '#e0e8f0',
    fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
    padding: '0 8px 0 28px', height: '28px', width: '100%',
    outline: 'none', letterSpacing: '1px',
    borderRadius: '2px',
  },
  searchIcon: {
    position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
    color: '#4a9eff', fontSize: '12px', pointerEvents: 'none',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: '8px', right: '8px',
    background: '#0e1c2e', border: '1px solid #1a2a38', borderTop: 'none',
    zIndex: 2000, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  dropdownItem: {
    display: 'flex', alignItems: 'center', padding: '6px 10px',
    cursor: 'pointer', borderBottom: '1px solid #0a1628',
    gap: '8px',
  },
  breadcrumbs: {
    display: 'flex', alignItems: 'center', height: '100%',
    padding: '0 8px', gap: '4px', flex: 1,
    borderRight: '1px solid #1a2a38',
  },
  breadcrumbItem: { color: '#6b8aaa', fontSize: '11px', cursor: 'pointer' },
  breadcrumbSep: { color: '#1a2a38', fontSize: '11px' },
  breadcrumbActive: { color: '#4a9eff', fontSize: '11px', fontWeight: 600 },
  workspaceTabs: {
    display: 'flex', alignItems: 'center', height: '100%',
    borderRight: '1px solid #1a2a38', overflow: 'hidden',
  },
  wsTab: {
    height: '100%', padding: '0 12px', display: 'flex', alignItems: 'center',
    cursor: 'pointer', borderRight: '1px solid #0a1628', fontSize: '11px',
    position: 'relative', whiteSpace: 'nowrap',
  },
  rightZone: {
    display: 'flex', alignItems: 'center', height: '100%',
    padding: '0 8px', gap: '8px', marginLeft: 'auto',
  },
  statusDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    flexShrink: 0,
  },
  clock: { color: '#e0e8f0', fontSize: '11px', fontFeatureSettings: "'tnum'" },
  clockDate: { color: '#6b8aaa', fontSize: '9px' },
  actionBtn: {
    height: '26px', padding: '0 8px', border: '1px solid #1a2a38',
    background: 'transparent', color: '#a0b4c8', fontSize: '11px',
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
    alignItems: 'center', gap: '4px', borderRadius: '2px',
    transition: 'all 0.15s',
  },
};

// ─── Function Key Bar ─────────────────────────────────────────────────────────

const FN_KEYS = [
  { key: 'F1', desc: 'HELP' }, { key: 'F2', desc: 'NEWS' },
  { key: 'F3', desc: 'SRCH' }, { key: 'F4', desc: 'CALC' },
  { key: 'F5', desc: 'RFSH' }, { key: 'F8', desc: 'SCRN' },
  { key: 'F10', desc: 'MENU' }, { key: 'F12', desc: 'LOGS' },
];

interface FnKeyBarProps { onFnKey: (key: string) => void; }

function FnKeyBar({ onFnKey }: FnKeyBarProps) {
  return (
    <div style={styles.fnKeys}>
      {FN_KEYS.map(fk => (
        <div
          key={fk.key}
          style={styles.fnKey}
          onClick={() => onFnKey(fk.key)}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a2a38')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={styles.fnLabel}>{fk.key}</span>
          <span style={styles.fnDesc}>{fk.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  onSelect: (result: SearchResult) => void;
}

function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    setResults(searchSymbols(v));
    setHighlight(-1);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, results.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && highlight >= 0) { onSelect(results[highlight]); setQuery(''); setResults([]); }
    else if (e.key === 'Escape') { setQuery(''); setResults([]); inputRef.current?.blur(); }
  };

  const fmtChange = (pct: number) => (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';

  return (
    <div style={styles.searchZone}>
      <span style={styles.searchIcon}>⌕</span>
      <input
        ref={inputRef}
        style={{ ...styles.searchInput, borderColor: focused ? '#4a9eff' : '#1a2a38' }}
        placeholder="Search symbol, news, command... (Ctrl+K)"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => { setFocused(false); setResults([]); }, 200)}
        autoComplete="off"
        spellCheck={false}
      />
      {results.length > 0 && focused && (
        <div style={styles.dropdown}>
          {results.map((r, i) => (
            <div
              key={r.ticker}
              style={{
                ...styles.dropdownItem,
                background: i === highlight ? '#1a2a38' : 'transparent',
              }}
              onClick={() => { onSelect(r); setQuery(''); setResults([]); }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span style={{ color: '#4a9eff', fontWeight: 700, fontSize: '12px', minWidth: '60px' }}>{r.ticker}</span>
              <span style={{ color: '#a0b4c8', fontSize: '11px', flex: 1 }}>{r.name}</span>
              <span style={{ color: '#6b8aaa', fontSize: '10px', marginRight: '8px' }}>{r.type}</span>
              {r.price && (
                <>
                  <span style={{ color: '#e0e8f0', fontSize: '11px', minWidth: '64px', textAlign: 'right' }}>
                    {r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontSize: '10px', minWidth: '52px', textAlign: 'right',
                    color: r.change_pct! >= 0 ? '#00d4aa' : '#ff4466',
                  }}>
                    {fmtChange(r.change_pct!)}
                  </span>
                </>
              )}
            </div>
          ))}
          <div style={{ padding: '4px 10px', color: '#6b8aaa', fontSize: '9px', borderTop: '1px solid #0a1628' }}>
            ↑↓ navigate · Enter to select · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workspace Tabs ───────────────────────────────────────────────────────────

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
}

function WorkspaceTabBar({ tabs, activeId, onSelect, onNew, onClose }: WorkspaceTabsProps) {
  return (
    <div style={styles.workspaceTabs}>
      {tabs.map(tab => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            style={{
              ...styles.wsTab,
              background: isActive ? '#0a1628' : 'transparent',
              color: isActive ? '#4a9eff' : '#6b8aaa',
              borderBottom: isActive ? '2px solid #4a9eff' : '2px solid transparent',
            }}
            onClick={() => onSelect(tab.id)}
          >
            {tab.name}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={{
                marginLeft: '4px', background: '#ff4466', color: '#fff',
                borderRadius: '8px', fontSize: '9px', padding: '1px 4px',
                fontWeight: 700,
              }}>
                {tab.badge}
              </span>
            )}
            <span
              style={{ marginLeft: '6px', color: '#6b8aaa', fontSize: '10px' }}
              onClick={e => { e.stopPropagation(); onClose(tab.id); }}
            >
              ×
            </span>
          </div>
        );
      })}
      <div
        style={{ ...styles.wsTab, color: '#6b8aaa', minWidth: '30px', justifyContent: 'center' }}
        onClick={onNew}
        title="New workspace"
      >
        +
      </div>
    </div>
  );
}

// ─── Connection Indicator ────────────────────────────────────────────────────

interface ConnectionIndicatorProps { connected: boolean; latency?: number; }

function ConnectionIndicator({ connected, latency }: ConnectionIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{
        ...styles.statusDot,
        background: connected ? '#00d4aa' : '#ff4466',
        boxShadow: connected ? '0 0 4px #00d4aa' : '0 0 4px #ff4466',
      }} />
      <span style={{ color: connected ? '#00d4aa' : '#ff4466', fontSize: '9px' }}>
        {connected ? (latency ? `${latency}ms` : 'LIVE') : 'OFFLINE'}
      </span>
    </div>
  );
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export interface BloombergToolbarProps {
  connected?: boolean;
  latency?: number;
  breadcrumbs?: BreadcrumbItem[];
  workspaceTabs?: WorkspaceTab[];
  activeWorkspaceId?: string;
  onSymbolSelect?: (ticker: string) => void;
  onFnKey?: (key: string) => void;
  onNewWorkspace?: () => void;
  onCloseWorkspace?: (id: string) => void;
  onSelectWorkspace?: (id: string) => void;
  onCommandPalette?: () => void;
  onLayout?: () => void;
  onAlerts?: () => void;
  extraActions?: ToolbarAction[];
}

export const BloombergToolbar: React.FC<BloombergToolbarProps> = ({
  connected = true,
  latency,
  breadcrumbs = [],
  workspaceTabs = [],
  activeWorkspaceId = '',
  onSymbolSelect = () => {},
  onFnKey = () => {},
  onNewWorkspace = () => {},
  onCloseWorkspace = () => {},
  onSelectWorkspace = () => {},
  onCommandPalette = () => {},
  onLayout = () => {},
  onAlerts = () => {},
  extraActions = [],
}) => {
  const now = useDateTime();

  const handleSearchSelect = useCallback((result: SearchResult) => {
    onSymbolSelect(result.ticker);
  }, [onSymbolSelect]);

  return (
    <header style={styles.toolbar}>
      {/* Logo */}
      <div style={styles.logoZone} onClick={onCommandPalette} title="Command Palette (Ctrl+K)">
        <div>
          <div style={styles.logoText}>APEX</div>
          <div style={styles.logoSub}>TERMINAL</div>
        </div>
      </div>

      {/* Fn Keys */}
      <FnKeyBar onFnKey={onFnKey} />

      {/* Search */}
      <SearchBar onSelect={handleSearchSelect} />

      {/* Workspace Tabs */}
      {workspaceTabs.length > 0 && (
        <WorkspaceTabBar
          tabs={workspaceTabs}
          activeId={activeWorkspaceId}
          onSelect={onSelectWorkspace}
          onNew={onNewWorkspace}
          onClose={onCloseWorkspace}
        />
      )}

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div style={styles.breadcrumbs}>
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={styles.breadcrumbSep}>›</span>}
              <span
                style={i === breadcrumbs.length - 1 ? styles.breadcrumbActive : styles.breadcrumbItem}
                onClick={bc.onClick}
              >
                {bc.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Right Zone */}
      <div style={styles.rightZone}>
        {/* Action Buttons */}
        <button
          style={styles.actionBtn}
          onClick={onLayout}
          onMouseEnter={e => { (e.currentTarget.style.background = '#1a2a38'); (e.currentTarget.style.color = '#4a9eff'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = '#a0b4c8'); }}
        >
          ⊞ Layout
        </button>
        <button
          style={styles.actionBtn}
          onClick={onAlerts}
          onMouseEnter={e => { (e.currentTarget.style.background = '#1a2a38'); (e.currentTarget.style.color = '#ff9900'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = '#a0b4c8'); }}
        >
          🔔 Alerts
        </button>
        {extraActions.map(action => (
          <button
            key={action.id}
            style={{
              ...styles.actionBtn,
              opacity: action.disabled ? 0.4 : 1,
              cursor: action.disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={action.disabled ? undefined : action.onClick}
            title={action.shortcut}
          >
            {action.icon} {action.label}
          </button>
        ))}

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', background: '#1a2a38' }} />

        {/* Connection Status */}
        <ConnectionIndicator connected={connected} latency={latency} />

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', background: '#1a2a38' }} />

        {/* Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={styles.clock}>{fmtTime(now)}</div>
          <div style={styles.clockDate}>{fmtDate(now)}</div>
        </div>
      </div>
    </header>
  );
};

// ─── Demo ─────────────────────────────────────────────────────────────────────

export const BloombergToolbarDemo: React.FC = () => {
  const [activeWs, setActiveWs] = useState('ws1');
  const [activeTicker, setActiveTicker] = useState('NVDA');
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: 'ws1', name: 'Equities', badge: 0 },
    { id: 'ws2', name: 'Options' },
    { id: 'ws3', name: 'Macro', badge: 3 },
  ]);

  return (
    <div style={{ background: '#060e18', fontFamily: "'JetBrains Mono', monospace" }}>
      <BloombergToolbar
        connected
        latency={8}
        workspaceTabs={tabs}
        activeWorkspaceId={activeWs}
        onSelectWorkspace={setActiveWs}
        onNewWorkspace={() => {
          const id = `ws${Date.now()}`;
          setTabs(prev => [...prev, { id, name: `WS ${prev.length + 1}` }]);
          setActiveWs(id);
        }}
        onCloseWorkspace={id => setTabs(prev => prev.filter(t => t.id !== id))}
        onSymbolSelect={t => setActiveTicker(t)}
        breadcrumbs={[{ label: 'Terminal' }, { label: activeTicker }, { label: 'Chart' }]}
        onFnKey={k => console.log('FN:', k)}
      />
      <div style={{ padding: '12px 16px', color: '#6b8aaa', fontSize: '11px' }}>
        Active Symbol: <span style={{ color: '#4a9eff', fontWeight: 700 }}>{activeTicker}</span>
      </div>
    </div>
  );
};

export default BloombergToolbar;
