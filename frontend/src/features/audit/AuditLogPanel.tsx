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

const API_BASE = '/api/v1';

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  ip: string;
  timestamp: string;
}

const MOCK_ENTRIES: AuditEntry[] = [
  { id: '1', action: 'LOGIN', actor: 'admin', target: 'auth', detail: 'Successful login from Chrome/Win11', ip: '10.0.0.1', timestamp: '2024-01-15 14:32:01' },
  { id: '2', action: 'ORDER_PLACED', actor: 'algo_01', target: 'AAPL', detail: 'BUY 100 @ MARKET', ip: '10.0.0.5', timestamp: '2024-01-15 14:28:44' },
  { id: '3', action: 'STRATEGY_START', actor: 'admin', target: 'SMA Crossover', detail: 'Strategy activated on AAPL 15m', ip: '10.0.0.1', timestamp: '2024-01-15 09:00:01' },
  { id: '4', action: 'CONFIG_CHANGE', actor: 'admin', target: 'risk.max_pos', detail: 'Changed from 10000 to 15000', ip: '10.0.0.1', timestamp: '2024-01-14 17:45:30' },
  { id: '5', action: 'ALERT_TRIGGERED', actor: 'system', target: 'TSLA BELOW 220', detail: 'Price crossed 220.50 support', ip: '127.0.0.1', timestamp: '2024-01-14 10:23:11' },
  { id: '6', action: 'LOGOUT', actor: 'admin', target: 'auth', detail: 'Session expired after 8h', ip: '10.0.0.1', timestamp: '2024-01-13 18:01:00' },
];

const ACTION_COLORS: Record<string, string> = {
  LOGIN: GREEN, LOGOUT: SUBTLE, ORDER_PLACED: BLUE, ORDER_CANCELLED: RED,
  STRATEGY_START: GREEN, STRATEGY_STOP: RED, CONFIG_CHANGE: AMBER,
  ALERT_TRIGGERED: AMBER, ERROR: RED, WARNING: AMBER,
};

import React, { useState, useEffect } from 'react';

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/audit`)
      .then(r => r.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries(MOCK_ENTRIES))
      .finally(() => setLoading(false));
  }, []);

  const actions = ['all', ...Array.from(new Set(entries.map(e => e.action)))];
  const filtered = entries
    .filter(e => actionFilter === 'all' || e.action === actionFilter)
    .filter(e => !searchQuery || [e.actor, e.target, e.detail, e.action].some(v => v.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div data-testid="audit-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>AT</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>AUDIT TRAIL</span>
        <span data-testid="audit-count" style={{ fontSize: 10, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 10, padding: '1px 6px' }}>{entries.length} ENTRIES</span>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search actor/target/detail..."
          style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', color: TEXT, fontFamily: MONO, fontSize: 10, outline: 'none', minWidth: 180 }}
        />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', color: TEXT, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'ALL ACTIONS' : a}</option>)}
        </select>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selected ? '0 0 55%' : 1, overflow: 'auto' }}>
          {loading && <div data-testid="audit-loading" style={{ padding: 32, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {!loading && filtered.length === 0 && <div data-testid="audit-empty" style={{ padding: 48, textAlign: 'center', color: SUBTLE }}>No audit entries</div>}
          {!loading && filtered.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: PANEL, position: 'sticky', top: 0 }}>
                  {['ACTION', 'ACTOR', 'TARGET', 'DETAIL', 'TIME'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, color: SUBTLE, letterSpacing: 1, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, idx) => {
                  const isSelected = selected?.id === e.id;
                  const col = ACTION_COLORS[e.action] || SUBTLE;
                  return (
                    <tr
                      key={e.id}
                      data-testid={`audit-row-${idx}`}
                      onClick={() => setSelected(prev => prev?.id === e.id ? null : e)}
                      style={{
                        borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                        background: isSelected ? '#0e1420' : 'transparent',
                        borderLeft: `3px solid ${isSelected ? col : 'transparent'}`,
                      }}
                      onMouseEnter={ev => { if (!isSelected) (ev.currentTarget as HTMLTableRowElement).style.background = '#141414'; }}
                      onMouseLeave={ev => { if (!isSelected) (ev.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ fontSize: 9, padding: '1px 6px', background: col + '22', border: `1px solid ${col}44`, borderRadius: 3, color: col, whiteSpace: 'nowrap', letterSpacing: 1 }}>{e.action}</span>
                      </td>
                      <td style={{ padding: '6px 10px', color: BLUE, fontSize: 10 }}>{e.actor}</td>
                      <td style={{ padding: '6px 10px', color: TEXT, fontFamily: MONO, fontSize: 10 }}>{e.target}</td>
                      <td style={{ padding: '6px 10px', color: SUBTLE, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</td>
                      <td style={{ padding: '6px 10px', color: SUBTLE, fontSize: 9, whiteSpace: 'nowrap' }}>{e.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div style={{ flex: '0 0 45%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>ENTRY DETAIL</div>
                <div style={{ fontSize: 13, color: ACTION_COLORS[selected.action] || AMBER, fontWeight: 700 }}>{selected.action}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {[
              { label: 'ACTION', val: selected.action, col: ACTION_COLORS[selected.action] || AMBER },
              { label: 'ACTOR', val: selected.actor, col: BLUE },
              { label: 'TARGET', val: selected.target, col: TEXT },
              { label: 'IP ADDRESS', val: selected.ip, col: SUBTLE === '#555' ? TEXT : SUBTLE },
              { label: 'TIMESTAMP', val: selected.timestamp, col: TEXT },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col, fontFamily: MONO }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: '8px 10px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>DETAIL</div>
              <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6 }}>{selected.detail}</div>
            </div>
          </div>
        )}
      </div>

      <div data-testid="audit-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}


interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  ip: string;
  timestamp: string;
}

