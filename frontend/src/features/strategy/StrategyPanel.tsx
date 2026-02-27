// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const STATUS_COLORS: Record<string, string> = {
  running: GREEN, paused: AMBER, stopped: RED, error: RED, idle: SUBTLE, backtest: BLUE,
};

const STATUS_ICONS: Record<string, string> = {
  running: 'â–¶', paused: 'â¸', stopped: 'â– ', error: 'âœ•', idle: 'â—‹', backtest: 'âŸ³',
};

interface Strategy {
  id: string;
  name: string;
  strategy_type: string;
  symbol: string;
  status: string;
  pnl?: number;
  sharpe?: number;
  drawdown?: number;
  win_rate?: number;
  trades?: number;
  last_signal?: string;
  created_at?: string;
}

const MOCK_STRATEGIES: Strategy[] = [
  { id: '1', name: 'SMA Crossover', strategy_type: 'sma', symbol: 'AAPL', status: 'running', pnl: 1234.56, sharpe: 1.42, drawdown: -0.034, win_rate: 0.58, trades: 47, last_signal: 'BUY @ 185.20', created_at: '2024-01-15' },
  { id: '2', name: 'RSI Reversal', strategy_type: 'rsi', symbol: 'TSLA', status: 'paused', pnl: -234.12, sharpe: 0.87, drawdown: -0.089, win_rate: 0.43, trades: 21, last_signal: 'SELL @ 208.50', created_at: '2024-02-01' },
  { id: '3', name: 'Breakout Alpha', strategy_type: 'breakout', symbol: 'NVDA', status: 'running', pnl: 3456.78, sharpe: 2.01, drawdown: -0.021, win_rate: 0.65, trades: 89, last_signal: 'BUY @ 780.00', created_at: '2024-01-20' },
  { id: '4', name: 'MACD Trend', strategy_type: 'macd', symbol: 'SPY', status: 'idle', pnl: 0, sharpe: 0, drawdown: 0, win_rate: 0, trades: 0, last_signal: '--', created_at: '2024-03-01' },
];

const StratRow: React.FC<{
  s: Strategy;
  selected: boolean;
  onClick: () => void;
  onAction: (action: string) => void;
}> = ({ s, selected, onClick, onAction }) => {
  const [hov, setHov] = React.useState(false);
  const col = STATUS_COLORS[s.status] || SUBTLE;
  const icon = STATUS_ICONS[s.status] || 'â—‹';
  const pnlCol = (s.pnl ?? 0) >= 0 ? GREEN : RED;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? '#1a2a1a' : hov ? '#141414' : 'transparent',
        cursor: 'pointer',
        borderLeft: `3px solid ${selected ? col : 'transparent'}`,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 10, color: SUBTLE, marginTop: 1 }}>
            <span style={{ color: AMBER }}>{s.symbol}</span> Â· {s.strategy_type.toUpperCase()} Â· {s.trades ?? 0} trades
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: col, fontFamily: MONO }}>{icon} {s.status.toUpperCase()}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          P&L <span style={{ color: pnlCol, fontWeight: 600 }}>{s.pnl != null ? `${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(2)}` : '--'}</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          SR <span style={{ color: BLUE }}>{s.sharpe?.toFixed(2) ?? '--'}</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          WR <span style={{ color: TEXT }}>{s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}%` : '--'}</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
          DD <span style={{ color: s.drawdown != null && s.drawdown < -0.05 ? RED : TEXT }}>{s.drawdown != null ? `${(s.drawdown * 100).toFixed(1)}%` : '--'}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); onAction('start'); }}
          style={{ padding: '2px 8px', background: GREEN + '22', border: `1px solid ${GREEN}44`, borderRadius: 2, color: GREEN, fontFamily: MONO, fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>â–¶</button>
        <button onClick={e => { e.stopPropagation(); onAction('pause'); }}
          style={{ padding: '2px 8px', background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 2, color: AMBER, fontFamily: MONO, fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>â¸</button>
        <button onClick={e => { e.stopPropagation(); onAction('stop'); }}
          style={{ padding: '2px 8px', background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, color: RED, fontFamily: MONO, fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>â– </button>
        <span style={{ fontSize: 9, color: SUBTLE, marginLeft: 'auto', alignSelf: 'center' }}>
          {s.last_signal || '--'}
        </span>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';

export function StrategyPanel({ embedded }: { embedded?: boolean }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'name' | 'pnl' | 'sharpe' | 'status'>('status');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newStratName, setNewStratName] = useState('');
  const [newStratSymbol, setNewStratSymbol] = useState('');
  const [newStratType, setNewStratType] = useState('sma');

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/strategies`);
      if (!res.ok) throw new Error('err');
      const data = await res.json();
      setStrategies(data);
    } catch {
      setStrategies(MOCK_STRATEGIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen || embedded) fetchStrategies();
  }, [isOpen, embedded, fetchStrategies]);

  const handleAction = (id: string, action: string) => {
    const statusMap: Record<string, string> = { start: 'running', pause: 'paused', stop: 'stopped' };
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, status: statusMap[action] || s.status } : s));
  };

  const filtered = strategies
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .sort((a, b) => {
      switch (sortKey) {
        case 'pnl': return (b.pnl ?? 0) - (a.pnl ?? 0);
        case 'sharpe': return (b.sharpe ?? 0) - (a.sharpe ?? 0);
        case 'status': return a.status.localeCompare(b.status);
        default: return a.name.localeCompare(b.name);
      }
    });

  const runningCount = strategies.filter(s => s.status === 'running').length;
  const totalPnl = strategies.reduce((s, st) => s + (st.pnl ?? 0), 0);

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>ST</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>STRATEGIES</span>
        <span style={{ fontSize: 10, background: runningCount > 0 ? GREEN + '22' : BORDER, color: runningCount > 0 ? GREEN : SUBTLE, border: `1px solid ${runningCount > 0 ? GREEN + '55' : BORDER}`, borderRadius: 10, padding: '1px 6px', fontFamily: MONO }}>
          {runningCount} LIVE
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowNewForm(n => !n)} style={{ background: showNewForm ? AMBER + '22' : 'transparent', border: `1px solid ${showNewForm ? AMBER : BORDER}`, borderRadius: 2, padding: '3px 10px', color: showNewForm ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>+ NEW</button>
          <button onClick={fetchStrategies} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 8px', color: loading ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>{loading ? '...' : 'â†º'}</button>
          {!embedded && <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 8px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>âœ•</button>}
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16 }}>
        {[
          { label: 'TOTAL', val: strategies.length, col: TEXT },
          { label: 'RUNNING', val: runningCount, col: GREEN },
          { label: 'PAUSED', val: strategies.filter(s => s.status === 'paused').length, col: AMBER },
          { label: 'TOTAL P&L', val: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, col: totalPnl >= 0 ? GREEN : RED },
        ].map(({ label, val, col }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: MONO, color: col, fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* New strategy form */}
      {showNewForm && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#0e0e0e' }}>
          <div style={{ fontSize: 10, color: AMBER, letterSpacing: 1, marginBottom: 8 }}>NEW STRATEGY</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newStratName} onChange={e => setNewStratName(e.target.value)} placeholder="Name" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', flex: 1, minWidth: 100 }} />
            <input value={newStratSymbol} onChange={e => setNewStratSymbol(e.target.value.toUpperCase())} placeholder="SYMBOL" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 80, textTransform: 'uppercase' }} />
            <select value={newStratType} onChange={e => setNewStratType(e.target.value)} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}>
              {['sma', 'ema', 'rsi', 'macd', 'breakout', 'custom'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
            <button style={{ background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '4px 12px', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>CREATE</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center' }}>
        {['all', 'running', 'paused', 'stopped', 'idle'].map(f => {
          const col = f === 'all' ? TEXT : (STATUS_COLORS[f] || SUBTLE);
          const active = statusFilter === f;
          return (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              background: active ? col + '22' : 'transparent',
              border: `1px solid ${active ? col : BORDER}`,
              borderRadius: 2, padding: '2px 8px', color: active ? col : SUBTLE,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase',
            }}>{f}</button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
          {(['name', 'pnl', 'sharpe', 'status'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              background: sortKey === k ? '#222' : 'transparent',
              border: `1px solid ${sortKey === k ? AMBER : BORDER}`,
              borderRadius: 2, padding: '2px 6px', color: sortKey === k ? AMBER : SUBTLE,
              fontFamily: MONO, fontSize: 9, cursor: 'pointer', textTransform: 'uppercase',
            }}>{k}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selectedStrategy ? '0 0 55%' : '1 1 auto', overflow: 'auto', borderRight: selectedStrategy ? `1px solid ${BORDER}` : 'none' }}>
          {loading && <div style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE }}>No strategies</div>}
          {!loading && filtered.map(s => (
            <StratRow
              key={s.id}
              s={s}
              selected={selectedStrategy?.id === s.id}
              onClick={() => setSelectedStrategy(prev => prev?.id === s.id ? null : s)}
              onAction={action => handleAction(s.id, action)}
            />
          ))}
        </div>

        {selectedStrategy && (
          <div style={{ flex: '0 0 45%', overflow: 'auto', background: PANEL, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>STRATEGY DETAIL</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selectedStrategy.name}</div>
              </div>
              <button onClick={() => setSelectedStrategy(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {[
              { label: 'SYMBOL', val: selectedStrategy.symbol, col: AMBER },
              { label: 'TYPE', val: selectedStrategy.strategy_type.toUpperCase() },
              { label: 'STATUS', val: selectedStrategy.status.toUpperCase(), col: STATUS_COLORS[selectedStrategy.status] || SUBTLE },
              { label: 'P&L', val: selectedStrategy.pnl != null ? `${selectedStrategy.pnl >= 0 ? '+' : ''}$${selectedStrategy.pnl.toFixed(2)}` : '--', col: (selectedStrategy.pnl ?? 0) >= 0 ? GREEN : RED },
              { label: 'SHARPE', val: selectedStrategy.sharpe?.toFixed(4) ?? '--', col: BLUE },
              { label: 'WIN RATE', val: selectedStrategy.win_rate != null ? `${(selectedStrategy.win_rate * 100).toFixed(1)}%` : '--' },
              { label: 'MAX DD', val: selectedStrategy.drawdown != null ? `${(selectedStrategy.drawdown * 100).toFixed(2)}%` : '--', col: (selectedStrategy.drawdown ?? 0) < -0.05 ? RED : TEXT },
              { label: 'TRADES', val: selectedStrategy.trades ?? '--' },
              { label: 'LAST SIGNAL', val: selectedStrategy.last_signal || '--', col: ORANGE },
              { label: 'CREATED', val: selectedStrategy.created_at || '--' },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col || TEXT, fontFamily: MONO, fontWeight: col ? 600 : 400 }}>{String(val)}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
              <button onClick={() => handleAction(selectedStrategy.id, 'start')} style={{ flex: 1, background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '6px 0', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>â–¶ START</button>
              <button onClick={() => handleAction(selectedStrategy.id, 'pause')} style={{ flex: 1, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, padding: '6px 0', color: AMBER, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>â¸ PAUSE</button>
              <button onClick={() => handleAction(selectedStrategy.id, 'stop')} style={{ flex: 1, background: RED + '22', border: `1px solid ${RED}`, borderRadius: 3, padding: '6px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>â–  STOP</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return panelContent;

  return (
    <>
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', background: isOpen ? AMBER + '22' : '#181818',
          border: `1px solid ${isOpen ? AMBER : BORDER}`, borderRadius: 3,
          color: isOpen ? AMBER : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
        }}
      >
        â—ˆ STRATEGIES
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', top: 40, right: 0, width: 480, height: 520,
          zIndex: 100, boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          border: `1px solid ${BORDER}`,
        }}>
          {panelContent}
        </div>
      )}
    </>
  );
}

export default StrategyPanel;

