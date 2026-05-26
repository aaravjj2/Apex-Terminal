/**
 * Apex Terminal — TopBar Component
 * Matches demo/index.html TopBar exactly:
 * Logo | Mode Badge | Search | Symbol Strip | Latency | Clock | Icons | User
 */
import { useState, useEffect } from 'react';
import { useContextBus } from '../stores/contextBusStore';
import { useLiveStatus, useLiveQuote } from '../lib/liveQuoteStore';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  connectionStatus: string;
  marketOpen: boolean;
  marketSession: string;
}

const SYMBOLS = ['AAPL', 'TSLA', 'SPY', 'BTC', 'ETH'];
const MODES = ['live', 'paper', 'bt', 'replay'] as const;
const MODE_LABELS: Record<string, string> = { live: 'LIVE', paper: 'PAPER', bt: 'BACKTEST', replay: 'REPLAY' };

export function TopBar({ onOpenCommandPalette, connectionStatus, marketOpen, marketSession }: TopBarProps) {
  const [clock, setClock] = useState('');
  const [mode, setMode] = useState<typeof MODES[number]>('live');
  const setActiveSymbol = useContextBus(s => s.setActiveSymbol);
  const activeSymbol = useContextBus(s => s.activeSymbol);
  const liveStatus = useLiveStatus();
  const activeQuote = useLiveQuote(activeSymbol);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClock(`${h}:${m}:${s} ET`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const cycleMode = () => {
    const idx = MODES.indexOf(mode);
    setMode(MODES[(idx + 1) % MODES.length]);
  };

  return (
    <div className="apex-topbar" data-testid="ui2-topbar">
      {/* Logo */}
      <div className="tb-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <polygon points="12,2 22,20 2,20" fill="#2962FF" opacity=".9" />
          <polygon points="12,7 19,20 5,20" fill="#1E53E4" opacity=".6" />
        </svg>
        APEX
      </div>
      <div className="tb-sep" />

      {/* Mode Badge */}
      <div className={`mode-badge ${mode}`} onClick={cycleMode} data-testid="mode-badge">
        <div className="mode-dot" />
        {MODE_LABELS[mode]}
      </div>
      <div className="tb-sep" />

      {/* Search */}
      <div className="tb-search" onClick={onOpenCommandPalette} data-testid="ui2-command-trigger">
        <svg width="13" height="13" fill="none" stroke="#787B86" strokeWidth="2">
          <circle cx="5.5" cy="5.5" r="4.5" />
          <path d="m9 9 3 3" />
        </svg>
        <input placeholder="Jump to any view... Ctrl+K" readOnly onClick={onOpenCommandPalette} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--tx3)', background: 'var(--bg3)', padding: '1px 5px', borderRadius: '3px' }}>⌘K</span>
      </div>

      {/* Symbol Strip with live prices */}
      <div style={{ display: 'flex', gap: '1px', overflow: 'hidden', flexShrink: 0 }}>
        {SYMBOLS.map(sym => (
          <SymbolPill
            key={sym}
            sym={sym}
            active={activeSymbol === sym}
            onClick={() => setActiveSymbol(sym)}
          />
        ))}
      </div>

      {/* Live data status badge */}
      <div className="tb-sep" />
      <div
        title={`Live data stream: ${liveStatus}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px', fontSize: 10, fontFamily: 'var(--mono)',
          fontWeight: 700, letterSpacing: '0.05em',
          color: liveStatus === 'live' ? 'var(--up)' : liveStatus === 'reconnecting' ? 'var(--warn)' : 'var(--dn)',
          background: 'var(--bg2)', borderRadius: 3,
        }}
      >
        <div
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: liveStatus === 'live' ? 'var(--up)' : liveStatus === 'reconnecting' ? 'var(--warn)' : 'var(--dn)',
            boxShadow: liveStatus === 'live' ? '0 0 6px var(--up)' : 'none',
          }}
        />
        {liveStatus === 'live' ? 'LIVE' : liveStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
        {activeQuote && activeQuote.price > 0 && (
          <span style={{ color: 'var(--tx2)', marginLeft: 4 }}>
            {activeSymbol} ${activeQuote.price.toFixed(2)}
          </span>
        )}
      </div>

      {/* Latency indicator — tied to live quote stream status */}
      <div className="latency" title={`Quote stream: ${liveStatus}`}>
        <div
          className="latency-dot"
          style={{
            background: liveStatus === 'live' ? 'var(--up)' : liveStatus === 'reconnecting' ? 'var(--warn)' : 'var(--dn)',
          }}
        />
        <span>{liveStatus === 'live' ? '< 1s' : liveStatus === 'reconnecting' ? '…' : 'offline'}</span>
      </div>

      {/* Right */}
      <div className="tb-right">
        <div className="tb-clock" data-testid="ui2-clock">{clock}</div>

        {/* Notification bell */}
        <div className="tb-icon-btn" title="Notifications">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 3.5A4 4 0 0 0 4 7.5v3l-1 1.5h10l-1-1.5V7.5M7 13.5a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2z" />
          </svg>
          <div className="notif-dot" />
        </div>

        {/* Layout */}
        <div className="tb-icon-btn" title="Layout">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="2" width="4" height="4" />
            <rect x="9" y="2" width="4" height="4" />
            <rect x="2" y="9" width="4" height="4" />
            <rect x="9" y="9" width="4" height="4" />
          </svg>
        </div>

        {/* Settings */}
        <div className="tb-icon-btn" title="Settings">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="7" r="2.5" />
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4" />
          </svg>
        </div>

        {/* User */}
        <div className="tb-user">
          <div className="avatar">AG</div>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Aarav</span>
        </div>
      </div>
    </div>
  );
}

function SymbolPill({ sym, active, onClick }: { sym: string; active: boolean; onClick: () => void }) {
  const q = useLiveQuote(sym);
  const up = (q?.change ?? 0) >= 0;
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        borderRadius: 'var(--r2)',
        fontSize: '11px',
        fontWeight: 600,
        color: active ? 'var(--tx)' : 'var(--tx2)',
        cursor: 'pointer',
        background: active ? 'var(--bg2)' : 'none',
        border: 'none',
        fontFamily: 'var(--mono)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>{sym}</span>
      {q && q.price > 0 && (
        <>
          <span style={{ color: 'var(--tx2)' }}>${q.price.toFixed(2)}</span>
          <span style={{ color: up ? 'var(--up)' : 'var(--dn)', fontSize: 10 }}>
            {up ? '▲' : '▼'}{Math.abs(q.changePct).toFixed(2)}%
          </span>
        </>
      )}
    </button>
  );
}
