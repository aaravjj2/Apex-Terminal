// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const LEVEL_COLORS: Record<string, string> = {
  info: '#888', signal: BLUE, order: PURPLE,
  fill: GREEN, warning: AMBER, error: RED,
};

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'signal' | 'order' | 'fill' | 'error' | 'warning';
  message: string;
  data?: Record<string, unknown>;
}

const API_BASE = '/api/v1';

const MOCK_LOGS: LogEntry[] = [
  { id: '1',  timestamp: new Date(Date.now() - 30000).toISOString(), level: 'info',    message: 'Strategy initialized',              data: { symbol: 'AAPL', mode: 'live' } },
  { id: '2',  timestamp: new Date(Date.now() - 25000).toISOString(), level: 'signal',  message: 'BUY signal generated',               data: { price: 175.50, indicator: 'SMA crossover', strength: 0.82 } },
  { id: '3',  timestamp: new Date(Date.now() - 22000).toISOString(), level: 'order',   message: 'Market order submitted',             data: { side: 'BUY', qty: 100, type: 'market', order_id: 'ORD-7823' } },
  { id: '4',  timestamp: new Date(Date.now() - 20000).toISOString(), level: 'fill',    message: 'Order filled',                       data: { price: 175.52, qty: 100, commission: 1.00, slippage: 0.02 } },
  { id: '5',  timestamp: new Date(Date.now() - 15000).toISOString(), level: 'info',    message: 'Position updated',                   data: { symbol: 'AAPL', qty: 100, avg: 175.52, unrealized_pnl: 48.00 } },
  { id: '6',  timestamp: new Date(Date.now() - 10000).toISOString(), level: 'warning', message: 'Approaching position limit',         data: { current: 8500, limit: 10000, pct: 85 } },
  { id: '7',  timestamp: new Date(Date.now() - 8000).toISOString(),  level: 'signal',  message: 'SELL signal - take profit target',   data: { price: 176.00, target: 176.00, rr: 2.4 } },
  { id: '8',  timestamp: new Date(Date.now() - 6000).toISOString(),  level: 'order',   message: 'Limit order submitted',              data: { side: 'SELL', qty: 50, type: 'limit', price: 176.10 } },
  { id: '9',  timestamp: new Date(Date.now() - 3000).toISOString(),  level: 'error',   message: 'Order rejected by risk manager',     data: { reason: 'Position size exceeded', order_id: 'ORD-7824' } },
  { id: '10', timestamp: new Date(Date.now() - 1000).toISOString(), level: 'info',    message: 'Risk check bypass override pending', data: { user: 'system', action: 'notify' } },
];

import React, { useState, useEffect, useRef } from 'react';

export function StrategyLogs({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/strategies/${strategyId}/logs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data);
    } catch {
      setLogs(MOCK_LOGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); const iv = setInterval(fetchLogs, 2000); return () => clearInterval(iv); }, [strategyId]);
  useEffect(() => { if (autoScroll && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [logs, autoScroll]);

  const ALL_LEVELS = ['all', 'info', 'signal', 'order', 'fill', 'warning', 'error'];
  const filteredLogs = logs.filter(l =>
    (filter === 'all' || l.level === filter) &&
    (!search || l.message.toLowerCase().includes(search.toLowerCase()) || JSON.stringify(l.data || {}).toLowerCase().includes(search.toLowerCase()))
  );

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);

  const counts = ALL_LEVELS.slice(1).reduce((acc, l) => { acc[l] = logs.filter(e => e.level === l).length; return acc; }, {} as Record<string,number>);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', fontFamily: MONO }}>
      <div style={{ width: 860, height: 620, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: AMBER, letterSpacing: 2, fontWeight: 700 }}>â–¸ STRATEGY LOGS</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>{strategyId}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <span style={{ fontSize: 10, color: AMBER }}>â— LIVE</span>}
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, fontSize: 10, padding: '3px 8px', fontFamily: MONO, width: 160, outline: 'none' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: SUBTLE, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: AMBER }} />
              AUTO-SCROLL
            </label>
            <button onClick={fetchLogs} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 3, color: SUBTLE, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>â†» REFRESH</button>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 3, color: RED, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>âœ•</button>
          </div>
        </div>

        {/* Level filter bar */}
        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 6, alignItems: 'center' }}>
          {ALL_LEVELS.map(lv => (
            <button key={lv} onClick={() => setFilter(lv)} style={{
              background: filter === lv ? AMBER + '22' : 'none',
              border: `1px solid ${filter === lv ? AMBER : BORDER}`,
              borderRadius: 3, cursor: 'pointer', padding: '2px 8px',
              fontSize: 9, color: filter === lv ? AMBER : SUBTLE,
              fontFamily: MONO, letterSpacing: 1,
            }}>
              {lv.toUpperCase()}{lv !== 'all' && counts[lv] > 0 ? ` (${counts[lv]})` : ''}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 9, color: SUBTLE }}>{filteredLogs.length} events</div>
        </div>

        {/* Main content: log list + detail pane */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Log list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredLogs.map(log => {
              const lc = LEVEL_COLORS[log.level] || SUBTLE;
              const isSel = selectedLog?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(prev => prev?.id === log.id ? null : log)}
                  style={{
                    display: 'flex', gap: 8, padding: '4px 12px', cursor: 'pointer',
                    background: isSel ? '#1a1a1a' : 'transparent',
                    borderLeft: `3px solid ${isSel ? lc : 'transparent'}`,
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#161616'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ color: SUBTLE, fontSize: 9, whiteSpace: 'nowrap', marginTop: 1, minWidth: 76 }}>{formatTime(log.timestamp)}</span>
                  <span style={{ fontSize: 9, color: lc, width: 48, flexShrink: 0, fontWeight: 700, letterSpacing: 0.5 }}>{log.level.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: TEXT, flex: 1 }}>{log.message}</span>
                  {log.data && <span style={{ fontSize: 9, color: SUBTLE, whiteSpace: 'nowrap' }}>+{Object.keys(log.data).length}f</span>}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>

          {/* Detail pane */}
          {selectedLog && (
            <div style={{ width: 260, borderLeft: `1px solid ${BORDER}`, padding: 12, overflowY: 'auto' }}>
              <div style={{ fontSize: 9, color: AMBER, letterSpacing: 2, marginBottom: 10 }}>LOG DETAIL</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, background: LEVEL_COLORS[selectedLog.level] + '22', border: `1px solid ${LEVEL_COLORS[selectedLog.level]}`, borderRadius: 3, padding: '1px 6px', color: LEVEL_COLORS[selectedLog.level] }}>{selectedLog.level.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 10, color: TEXT, marginBottom: 10, lineHeight: 1.6 }}>{selectedLog.message}</div>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>{new Date(selectedLog.timestamp).toLocaleString()}</div>
              {selectedLog.data && (
                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>PAYLOAD</div>
                  {Object.entries(selectedLog.data).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
                      <span style={{ color: SUBTLE }}>{k}</span>
                      <span style={{ color: BLUE, fontFamily: MONO }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div style={{ padding: '6px 14px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 16, fontSize: 9, color: SUBTLE }}>
          <span>TOTAL: <span style={{ color: TEXT }}>{logs.length}</span></span>
          <span>FILLS: <span style={{ color: GREEN }}>{counts.fill || 0}</span></span>
          <span>SIGNALS: <span style={{ color: BLUE }}>{counts.signal || 0}</span></span>
          <span>ORDERS: <span style={{ color: PURPLE }}>{counts.order || 0}</span></span>
          <span>WARNS: <span style={{ color: AMBER }}>{counts.warning || 0}</span></span>
          <span>ERRORS: <span style={{ color: RED }}>{counts.error || 0}</span></span>
        </div>
      </div>
    </div>
  );
}
