// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const CONDITION_LABELS: Record<string, string> = {
  price_above: '> ABOVE', price_below: '< BELOW',
  price_cross: 'âœ• CROSS', volume_above: 'VOL >', pct_change: '% CHNG',
  rsi_above: 'RSI >', rsi_below: 'RSI <', macd_cross: 'MACD âœ•',
};

interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: string;
  value: number;
  active: boolean;
  triggered_at?: string;
  times_triggered?: number;
}

const MOCK_ALERTS: Alert[] = [
  { id: '1', name: 'AAPL Breakout', symbol: 'AAPL', condition: 'price_above', value: 180.00, active: true, times_triggered: 0 },
  { id: '2', name: 'TSLA Support', symbol: 'TSLA', condition: 'price_below', value: 220.50, active: true, triggered_at: '2024-01-15 09:32', times_triggered: 1 },
  { id: '3', name: 'SPY Volume', symbol: 'SPY', condition: 'volume_above', value: 5000000, active: false, times_triggered: 3 },
  { id: '4', name: 'NVDA RSI', symbol: 'NVDA', condition: 'rsi_above', value: 70, active: true, times_triggered: 0 },
];

import React, { useState, useEffect, useCallback } from 'react';

export function AlertsPanel({ embedded }: { embedded?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newCondition, setNewCondition] = useState('price_above');
  const [newValue, setNewValue] = useState('');
  const [newName, setNewName] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      if (!res.ok) throw new Error('err');
      setAlerts(await res.json());
    } catch {
      setAlerts(MOCK_ALERTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen || embedded) fetchAlerts(); }, [isOpen, embedded, fetchAlerts]);

  const toggleActive = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const deleteAlert = (id: string) => { setAlerts(prev => prev.filter(a => a.id !== id)); if (selected?.id === id) setSelected(null); };

  const filtered = alerts.filter(a => filterActive === 'all' || (filterActive === 'active' ? a.active : !a.active));
  const activeCount = alerts.filter(a => a.active).length;
  const triggeredCount = alerts.filter(a => (a.times_triggered ?? 0) > 0).length;

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: ORANGE, fontWeight: 700, letterSpacing: 2 }}>AL</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>ALERTS</span>
        <span style={{ fontSize: 10, color: activeCount > 0 ? GREEN : SUBTLE, background: (activeCount > 0 ? GREEN : SUBTLE) + '22', border: `1px solid ${(activeCount > 0 ? GREEN : SUBTLE)}44`, borderRadius: 10, padding: '1px 6px' }}>{activeCount} ACTIVE</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowAddForm(s => !s)} style={{ background: showAddForm ? ORANGE + '22' : 'transparent', border: `1px solid ${showAddForm ? ORANGE : BORDER}`, borderRadius: 2, padding: '2px 8px', color: showAddForm ? ORANGE : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>+ NEW</button>
          {!embedded && <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 8px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>âœ•</button>}
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16 }}>
        {[
          { label: 'TOTAL', val: alerts.length, col: TEXT },
          { label: 'ACTIVE', val: activeCount, col: GREEN },
          { label: 'TRIGGERED', val: triggeredCount, col: AMBER },
        ].map(({ label, val, col }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, color: col, fontFamily: MONO }}>{val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilterActive(f)} style={{
              background: filterActive === f ? ORANGE + '22' : 'transparent', border: `1px solid ${filterActive === f ? ORANGE : BORDER}`,
              borderRadius: 2, padding: '2px 6px', color: filterActive === f ? ORANGE : SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'pointer',
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#0e0e0e' }}>
          <div style={{ fontSize: 10, color: ORANGE, letterSpacing: 1, marginBottom: 8 }}>CREATE ALERT</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Alert name" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', flex: 2 }} />
            <input value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} placeholder="SYMBOL" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: AMBER, fontFamily: MONO, fontSize: 11, outline: 'none', width: 80, textTransform: 'uppercase' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={newCondition} onChange={e => setNewCondition(e.target.value)} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', flex: 1 }}>
              {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Value" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 80 }} />
            <button style={{ background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '4px 12px', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>CREATE</button>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selected ? '0 0 55%' : 1, overflow: 'auto' }}>
          {loading && <div style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: SUBTLE }}>
              <div style={{ marginBottom: 12 }}>No alerts</div>
              <button onClick={() => setShowAddForm(true)} style={{ background: ORANGE + '22', border: `1px dashed ${ORANGE}`, borderRadius: 3, padding: '6px 14px', color: ORANGE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>+ CREATE FIRST ALERT</button>
            </div>
          )}
          {!loading && filtered.map(a => {
            const isSelected = selected?.id === a.id;
            const condLabel = CONDITION_LABELS[a.condition] ?? a.condition;
            return (
              <div
                key={a.id}
                onClick={() => setSelected(prev => prev?.id === a.id ? null : a)}
                style={{
                  padding: '9px 14px', borderBottom: `1px solid ${BORDER}`,
                  background: isSelected ? '#1a0e00' : 'transparent',
                  cursor: 'pointer', borderLeft: `3px solid ${isSelected ? ORANGE : a.active ? GREEN : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#141414'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>
                      <span style={{ color: AMBER }}>{a.symbol}</span> {condLabel} <span style={{ color: TEXT, fontFamily: MONO }}>{a.value.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(a.times_triggered ?? 0) > 0 && <span style={{ fontSize: 9, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 8, padding: '1px 5px' }}>Ã—{a.times_triggered}</span>}
                    <button onClick={e => { e.stopPropagation(); toggleActive(a.id); }} style={{ fontSize: 10, color: a.active ? GREEN : SUBTLE, background: 'none', border: 'none', cursor: 'pointer' }}>{a.active ? 'â—' : 'â—‹'}</button>
                    <button onClick={e => { e.stopPropagation(); deleteAlert(a.id); }} style={{ fontSize: 10, color: RED, background: 'none', border: 'none', cursor: 'pointer' }}>âœ•</button>
                  </div>
                </div>
                {a.triggered_at && <div style={{ fontSize: 9, color: SUBTLE, marginTop: 3 }}>Last: {a.triggered_at}</div>}
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ flex: '0 0 45%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>ALERT DETAIL</div>
                <div style={{ fontSize: 14, color: ORANGE, fontWeight: 700 }}>{selected.name}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {[
              { label: 'SYMBOL', val: selected.symbol, col: AMBER },
              { label: 'CONDITION', val: CONDITION_LABELS[selected.condition] ?? selected.condition, col: TEXT },
              { label: 'VALUE', val: selected.value.toLocaleString(), col: TEXT },
              { label: 'STATUS', val: selected.active ? 'ACTIVE' : 'INACTIVE', col: selected.active ? GREEN : SUBTLE },
              { label: 'TRIGGERED', val: `Ã—${selected.times_triggered ?? 0}`, col: (selected.times_triggered ?? 0) > 0 ? AMBER : SUBTLE },
              { label: 'LAST HIT', val: selected.triggered_at ?? '--', col: SUBTLE === '#555' ? TEXT : SUBTLE },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col, fontFamily: MONO }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button onClick={() => toggleActive(selected.id)} style={{ flex: 1, background: (selected.active ? RED : GREEN) + '22', border: `1px solid ${selected.active ? RED : GREEN}`, borderRadius: 3, padding: '5px 0', color: selected.active ? RED : GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>{selected.active ? 'DISABLE' : 'ENABLE'}</button>
              <button onClick={() => deleteAlert(selected.id)} style={{ flex: 1, background: RED + '11', border: `1px solid ${RED}55`, borderRadius: 3, padding: '5px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>DELETE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return panelContent;

  return (
    <>
      <button onClick={() => setIsOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        background: isOpen ? ORANGE + '22' : '#181818', border: `1px solid ${isOpen ? ORANGE : BORDER}`, borderRadius: 3,
        color: isOpen ? ORANGE : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
      }}>âš¡ ALERTS {activeCount > 0 && <span style={{ fontSize: 9, background: ORANGE + '33', border: `1px solid ${ORANGE}55`, borderRadius: 8, padding: '0 5px', color: ORANGE }}>{activeCount}</span>}</button>
      {isOpen && (
        <div style={{ position: 'absolute', top: 40, right: 0, width: 440, height: 460, zIndex: 100, boxShadow: '0 8px 40px rgba(0,0,0,0.8)', border: `1px solid ${BORDER}` }}>
          {panelContent}
        </div>
      )}
    </>
  );
}


interface Alert {
    id: string;
    name: string;
    symbol: string;
    condition: string;
    value: number;
    active: boolean;
}


