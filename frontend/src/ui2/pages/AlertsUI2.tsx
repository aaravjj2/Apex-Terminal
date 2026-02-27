/**
 * AlertsUI2 — Bloomberg-grade Alert Management Terminal
 * CREATE | ACTIVE | HISTORY | WATCHDOG
 * Real API: /api/v4/screener/alerts/* | /api/v1/alerts
 * Full inline Bloomberg styling — no ui2/components dependency
 */
import React, { useState, useEffect, useCallback } from 'react';

// ─── Bloomberg palette ────────────────────────────────────────────────────────
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

// ─── Shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' };
const hdr: React.CSSProperties = {
  padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`,
  fontSize: 10, color: SUBTLE, fontWeight: 700, letterSpacing: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const th: React.CSSProperties = {
  padding: '4px 8px', fontSize: 9, color: SUBTLE, fontFamily: MONO,
  fontWeight: 700, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '4px 8px', fontSize: 10, fontFamily: MONO, borderBottom: `1px solid #0f0f0f`,
};
const inp: React.CSSProperties = {
  background: '#131313', border: `1px solid ${BORDER}`, borderRadius: 3,
  color: TEXT, fontFamily: MONO, fontSize: 10, padding: '4px 8px', outline: 'none',
};
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertType = 'price' | 'price_pct' | 'rsi' | 'macd' | 'volume' | 'bb_pct' | 'atr' | 'custom';
type AlertCond = 'crosses_above' | 'crosses_below' | 'above' | 'below' | 'equals';
type AlertStatus = 'active' | 'triggered' | 'disabled' | 'expired';

interface Alert {
  id: string; symbol: string; type: AlertType; condition: AlertCond;
  threshold: number; status: AlertStatus; created_at: string;
  triggered_at?: string; message?: string; note?: string;
  current_value?: number; repeat?: boolean; priority?: 'low'|'medium'|'high';
}

interface WatchdogEntry {
  symbol: string; price: number; change_pct: number; rsi?: number;
  volume?: number; alert_proximity?: number; nearest_alert?: string;
}

// ─── Alert type metadata ──────────────────────────────────────────────────────
const ALERT_TYPE_META: Record<AlertType, { label: string; unit: string; example: string }> = {
  price:     { label: 'Price', unit: '$', example: '150.00' },
  price_pct: { label: 'Price Change %', unit: '%', example: '5.0' },
  rsi:       { label: 'RSI (14)', unit: '', example: '70' },
  macd:      { label: 'MACD Signal', unit: '', example: '0.5' },
  volume:    { label: 'Volume', unit: 'shares', example: '1000000' },
  bb_pct:    { label: 'Bollinger %B', unit: '', example: '0.95' },
  atr:       { label: 'ATR', unit: '$', example: '3.5' },
  custom:    { label: 'Custom Expression', unit: '', example: 'close > sma20 * 1.05' },
};

const CONDITION_META: Record<AlertCond, string> = {
  crosses_above: 'Crosses Above',
  crosses_below: 'Crosses Below',
  above:         'Is Above',
  below:         'Is Below',
  equals:        'Equals',
};

const PRIORITY_COLORS: Record<string, string> = { high: RED, medium: AMBER, low: BLUE };
const STATUS_COLORS: Record<AlertStatus, string> = {
  active: GREEN, triggered: AMBER, disabled: SUBTLE, expired: SUBTLE,
};

// ─── Badge component ──────────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    display: 'inline-block', padding: '1px 6px', borderRadius: 2, fontSize: 8,
    background: `${color}20`, color, border: `1px solid ${color}40`, fontWeight: 700, fontFamily: MONO,
  }}>{label.toUpperCase()}</span>
);

// ─── Main component ───────────────────────────────────────────────────────────
const TABS = ['CREATE', 'ACTIVE', 'HISTORY', 'WATCHDOG'] as const;
type Tab = typeof TABS[number];

export function AlertsUI2() {
  const [tab, setTab] = useState<Tab>('CREATE');

  // Create form state
  const [symbol, setSymbol] = useState('AAPL');
  const [alertType, setAlertType] = useState<AlertType>('price');
  const [condition, setCondition] = useState<AlertCond>('crosses_above');
  const [threshold, setThreshold] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<'low'|'medium'|'high'>('medium');
  const [repeat, setRepeat] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createErr, setCreateErr] = useState('');

  // Bulk create state
  const [bulkSymbols, setBulkSymbols] = useState('');
  const [bulkType, setBulkType] = useState<AlertType>('price');
  const [bulkCondition, setBulkCondition] = useState<AlertCond>('crosses_above');
  const [bulkThreshold, setBulkThreshold] = useState('');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  // Active alerts state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [filterStatus, setFilterStatus] = useState<AlertStatus|'all'>('active');
  const [filterType, setFilterType] = useState<AlertType|'all'>('all');
  const [filterSymbol, setFilterSymbol] = useState('');
  const [sortAlert, setSortAlert] = useState<'created'|'symbol'|'type'|'priority'>('created');

  // Watchdog state
  const [watchSymbols, setWatchSymbols] = useState('AAPL,MSFT,NVDA,TSLA,AMZN');
  const [watchData, setWatchData] = useState<WatchdogEntry[]>([]);
  const [loadingWatch, setLoadingWatch] = useState(false);

  // ── Create single alert ───────────────────────────────────────────────────
  const createAlert = useCallback(async () => {
    if (!symbol.trim() || !threshold.trim()) {
      setCreateErr('Symbol and threshold required');
      return;
    }
    setCreating(true); setCreateErr(''); setCreateMsg('');
    try {
      const body = {
        symbol: symbol.toUpperCase(), type: alertType, condition,
        threshold: parseFloat(threshold), note, priority, repeat,
      };
      const r = await fetch('/api/v4/screener/alerts/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      const result = await r.json();
      setCreateMsg(`Alert created: ID ${result.id ?? 'ok'}`);
      setThreshold(''); setNote('');
      loadAlerts();
    } catch (e) { setCreateErr(String(e)); }
    finally { setCreating(false); }
  }, [symbol, alertType, condition, threshold, note, priority, repeat]);

  // ── Bulk create alerts ────────────────────────────────────────────────────
  const createBulkAlerts = useCallback(async () => {
    if (!bulkSymbols.trim() || !bulkThreshold.trim()) { setBulkMsg('Fill all fields'); return; }
    setBulkCreating(true); setBulkMsg('');
    const syms = bulkSymbols.split(',').map(s => s.trim()).filter(Boolean);
    let ok = 0, fail = 0;
    for (const sym of syms) {
      try {
        const r = await fetch('/api/v4/screener/alerts/add', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: sym.toUpperCase(), type: bulkType, condition: bulkCondition, threshold: parseFloat(bulkThreshold) }),
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkMsg(`Created ${ok} alerts${fail ? `, ${fail} failed` : ''}`);
    setBulkCreating(false);
    loadAlerts();
  }, [bulkSymbols, bulkType, bulkCondition, bulkThreshold]);

  // ── Load alerts ───────────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const r = await fetch('/api/v1/alerts');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setAlerts(Array.isArray(d) ? d : d.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally { setLoadingAlerts(false); }
  }, []);

  // ── Load watchdog ─────────────────────────────────────────────────────────
  const loadWatchdog = useCallback(async () => {
    setLoadingWatch(true);
    const syms = watchSymbols.split(',').map(s => s.trim()).filter(Boolean);
    const results: WatchdogEntry[] = [];
    await Promise.allSettled(syms.map(async sym => {
      try {
        const r = await fetch(`/api/v1/market-data/${sym}/quote`);
        if (!r.ok) return;
        const q = await r.json();
        results.push({
          symbol: sym,
          price: q.price ?? 0,
          change_pct: q.change_pct ?? 0,
          rsi: q.rsi,
          volume: q.volume,
        });
      } catch { /* ignore */ }
    }));
    results.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    setWatchData(results);
    setLoadingWatch(false);
  }, [watchSymbols]);

  // ── Delete alert ──────────────────────────────────────────────────────────
  const deleteAlert = useCallback(async (id: string) => {
    try {
      await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE' });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  }, []);

  // ── Toggle alert status ───────────────────────────────────────────────────
  const toggleAlert = useCallback(async (id: string, current: AlertStatus) => {
    const newStatus: AlertStatus = current === 'active' ? 'disabled' : 'active';
    try {
      await fetch(`/api/v1/alerts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAlerts(); }, []);
  useEffect(() => { if (tab === 'WATCHDOG') loadWatchdog(); }, [tab]);

  // ── Filtered/sorted alerts ────────────────────────────────────────────────
  const filteredAlerts = alerts
    .filter(a => filterStatus === 'all' || a.status === filterStatus)
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => !filterSymbol || a.symbol.toUpperCase().includes(filterSymbol.toUpperCase()))
    .sort((a, b) => {
      if (sortAlert === 'symbol') return a.symbol.localeCompare(b.symbol);
      if (sortAlert === 'type') return a.type.localeCompare(b.type);
      if (sortAlert === 'priority') {
        const p = { high: 2, medium: 1, low: 0 };
        return (p[b.priority ?? 'low'] ?? 0) - (p[a.priority ?? 'low'] ?? 0);
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

  const triggeredAlerts = alerts.filter(a => a.status === 'triggered');
  const activeCount = alerts.filter(a => a.status === 'active').length;

  // ── Tab style helper ──────────────────────────────────────────────────────
  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 16px', border: 'none', background: tab === t ? '#141414' : 'transparent',
    color: tab === t ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`,
    letterSpacing: 1, position: 'relative',
  });

  return (
    <div data-testid="alerts-ui2-page" data-ready="true"
      style={{ height: '100%', overflow: 'auto', background: BG, padding: '10px 14px', fontFamily: MONO, color: TEXT }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ALERT MANAGEMENT TERMINAL</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: SUBTLE }}>
          <span><span style={{ color: GREEN, fontWeight: 700 }}>{activeCount}</span> active</span>
          <span><span style={{ color: AMBER, fontWeight: 700 }}>{triggeredAlerts.length}</span> triggered</span>
          <button onClick={loadAlerts} style={{
            padding: '3px 10px', border: `1px solid ${BORDER}`, background: '#0d0d0d',
            color: SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 3,
          }}>{loadingAlerts ? 'LOADING…' : 'REFRESH'}</button>
        </div>
      </div>

      {/* ── Triggered alerts banner ──────────────────────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <div style={{ background: '#1a0800', border: `1px solid ${AMBER}`, borderRadius: 4, padding: '7px 12px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚡ {triggeredAlerts.length} ALERT{triggeredAlerts.length > 1 ? 'S' : ''} TRIGGERED</span>
          {triggeredAlerts.slice(0, 4).map(a => (
            <span key={a.id} style={{ fontSize: 9, color: TEXT, background: '#0d0d0d', padding: '2px 6px', borderRadius: 2 }}>
              {a.symbol} {CONDITION_META[a.condition]} {a.threshold}
            </span>
          ))}
          {triggeredAlerts.length > 4 && (
            <span style={{ fontSize: 9, color: SUBTLE }}>+{triggeredAlerts.length - 4} more</span>
          )}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
        {TABS.map(t => <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ══════════════ CREATE TAB ═══════════════════════════════════════ */}
      {tab === 'CREATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Single alert form */}
          <div style={card}>
            <div style={hdr}><span>CREATE ALERT</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {/* Symbol */}
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>SYMBOL</label>
                  <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
                    style={{ ...inp, width: 100, textTransform: 'uppercase' }} placeholder="AAPL" />
                </div>
                {/* Alert type */}
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>ALERT TYPE</label>
                  <select value={alertType} onChange={e => setAlertType(e.target.value as AlertType)} style={{ ...sel, width: 160 }}>
                    {(Object.entries(ALERT_TYPE_META) as [AlertType, typeof ALERT_TYPE_META[AlertType]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                {/* Condition */}
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>CONDITION</label>
                  <select value={condition} onChange={e => setCondition(e.target.value as AlertCond)} style={{ ...sel, width: 140 }}>
                    {(Object.entries(CONDITION_META) as [AlertCond, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {/* Threshold */}
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>
                    THRESHOLD ({ALERT_TYPE_META[alertType].unit || 'value'})
                  </label>
                  <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
                    style={{ ...inp, width: 110 }}
                    placeholder={ALERT_TYPE_META[alertType].example} />
                </div>
                {/* Priority */}
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>PRIORITY</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} style={{ ...sel, width: 100 }}>
                    <option value="high">HIGH</option>
                    <option value="medium">MEDIUM</option>
                    <option value="low">LOW</option>
                  </select>
                </div>
                {/* Repeat */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>REPEAT</label>
                  <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: 10 }}>
                    <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                    <span style={{ color: TEXT }}>Auto-Reset</span>
                  </label>
                </div>
              </div>
              {/* Note */}
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>NOTE (OPTIONAL)</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  style={{ ...inp, width: '100%' }} placeholder="Context or rationale for this alert…" />
              </div>
              {/* Action row */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={createAlert} disabled={creating} style={{
                  padding: '6px 18px', border: `1px solid ${creating ? BORDER : AMBER}`,
                  background: creating ? '#111' : '#1a1200', color: creating ? SUBTLE : AMBER,
                  fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                  borderRadius: 3, letterSpacing: 1,
                }}>{creating ? 'CREATING…' : 'ADD ALERT'}</button>
                {createMsg && <span style={{ fontSize: 10, color: GREEN }}>{createMsg}</span>}
                {createErr && <span style={{ fontSize: 10, color: RED }}>{createErr}</span>}
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div style={card}>
            <div style={hdr}><span>QUICK PRESET ALERTS</span></div>
            <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'RSI Overbought (>70)', type: 'rsi' as AlertType, cond: 'crosses_above' as AlertCond, thresh: '70' },
                { label: 'RSI Oversold (<30)', type: 'rsi' as AlertType, cond: 'crosses_below' as AlertCond, thresh: '30' },
                { label: 'Volume Spike (1M+)', type: 'volume' as AlertType, cond: 'above' as AlertCond, thresh: '1000000' },
                { label: 'BB Upper Band', type: 'bb_pct' as AlertType, cond: 'crosses_above' as AlertCond, thresh: '1.0' },
                { label: 'BB Lower Band', type: 'bb_pct' as AlertType, cond: 'crosses_below' as AlertCond, thresh: '0.0' },
                { label: 'Price Up 5%', type: 'price_pct' as AlertType, cond: 'crosses_above' as AlertCond, thresh: '5' },
                { label: 'Price Down 5%', type: 'price_pct' as AlertType, cond: 'crosses_below' as AlertCond, thresh: '-5' },
              ].map(preset => (
                <button key={preset.label}
                  onClick={() => { setAlertType(preset.type); setCondition(preset.cond); setThreshold(preset.thresh); }}
                  style={{
                    padding: '5px 10px', border: `1px solid ${BORDER}`, background: '#0d0d0d',
                    color: TEXT, fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 3,
                  }}>{preset.label}</button>
              ))}
            </div>
          </div>

          {/* Bulk create */}
          <div style={card}>
            <div style={hdr}><span>BULK ALERT CREATION</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>SYMBOLS (COMMA-SEPARATED)</label>
                  <input value={bulkSymbols} onChange={e => setBulkSymbols(e.target.value.toUpperCase())}
                    style={{ ...inp, width: 300 }} placeholder="AAPL,MSFT,NVDA,TSLA" />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>TYPE</label>
                  <select value={bulkType} onChange={e => setBulkType(e.target.value as AlertType)} style={{ ...sel, width: 130 }}>
                    {Object.entries(ALERT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>CONDITION</label>
                  <select value={bulkCondition} onChange={e => setBulkCondition(e.target.value as AlertCond)} style={{ ...sel, width: 130 }}>
                    {Object.entries(CONDITION_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>THRESHOLD</label>
                  <input type="number" value={bulkThreshold} onChange={e => setBulkThreshold(e.target.value)}
                    style={{ ...inp, width: 100 }} />
                </div>
                <button onClick={createBulkAlerts} disabled={bulkCreating} style={{
                  padding: '6px 14px', border: `1px solid ${BORDER}`, background: '#0d1a0d',
                  color: bulkCreating ? SUBTLE : GREEN, fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  cursor: bulkCreating ? 'not-allowed' : 'pointer', borderRadius: 3, alignSelf: 'flex-end',
                }}>{bulkCreating ? 'CREATING…' : 'BULK CREATE'}</button>
              </div>
              {bulkMsg && <span style={{ fontSize: 10, color: bulkMsg.includes('failed') ? RED : GREEN }}>{bulkMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ACTIVE TAB ════════════════════════════════════════ */}
      {tab === 'ACTIVE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 2 }}>STATUS</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} style={{ ...sel, width: 110 }}>
                <option value="all">ALL</option>
                <option value="active">ACTIVE</option>
                <option value="triggered">TRIGGERED</option>
                <option value="disabled">DISABLED</option>
                <option value="expired">EXPIRED</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 2 }}>TYPE</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)} style={{ ...sel, width: 130 }}>
                <option value="all">ALL TYPES</option>
                {Object.entries(ALERT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 2 }}>SYMBOL FILTER</label>
              <input value={filterSymbol} onChange={e => setFilterSymbol(e.target.value.toUpperCase())}
                style={{ ...inp, width: 100 }} placeholder="AAPL" />
            </div>
            <div>
              <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 2 }}>SORT BY</label>
              <select value={sortAlert} onChange={e => setSortAlert(e.target.value as typeof sortAlert)} style={{ ...sel, width: 100 }}>
                <option value="created">DATE</option>
                <option value="symbol">SYMBOL</option>
                <option value="type">TYPE</option>
                <option value="priority">PRIORITY</option>
              </select>
            </div>
            <div style={{ fontSize: 10, color: SUBTLE, alignSelf: 'flex-end', paddingBottom: 4 }}>
              {filteredAlerts.length} alerts
            </div>
          </div>

          <div style={card}>
            <div style={hdr}>
              <span>ALERT REGISTRY</span>
              <span style={{ color: SUBTLE }}>{filteredAlerts.length} shown / {alerts.length} total</span>
            </div>
            {filteredAlerts.length === 0
              ? <div style={{ padding: '30px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
                  {loadingAlerts ? 'Loading alerts…' : 'No alerts found — create one in the CREATE tab'}
                </div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                        <th style={{ ...th, textAlign: 'left' }}>TYPE</th>
                        <th style={{ ...th, textAlign: 'left' }}>CONDITION</th>
                        <th style={th}>THRESHOLD</th>
                        <th style={th}>STATUS</th>
                        <th style={th}>PRIORITY</th>
                        <th style={{ ...th, textAlign: 'left' }}>NOTE</th>
                        <th style={{ ...th, textAlign: 'left' }}>CREATED</th>
                        <th style={th}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((a, i) => (
                        <tr key={a.id} style={{ background: a.status === 'triggered' ? '#120a00' : i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{a.symbol}</td>
                          <td style={{ ...td, textAlign: 'left', color: TEXT }}>{ALERT_TYPE_META[a.type]?.label ?? a.type}</td>
                          <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{CONDITION_META[a.condition] ?? a.condition}</td>
                          <td style={{ ...td, fontWeight: 700, color: TEXT }}>{a.threshold}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <Badge label={a.status} color={STATUS_COLORS[a.status]} />
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <Badge label={a.priority ?? 'medium'} color={PRIORITY_COLORS[a.priority ?? 'medium']} />
                          </td>
                          <td style={{ ...td, textAlign: 'left', color: SUBTLE, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.note ?? '─'}
                          </td>
                          <td style={{ ...td, textAlign: 'left', color: SUBTLE, fontSize: 9 }}>
                            {a.created_at ? new Date(a.created_at).toLocaleDateString() : '─'}
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button onClick={() => toggleAlert(a.id, a.status)} style={{
                                padding: '2px 6px', border: `1px solid ${a.status === 'active' ? AMBER : GREEN}`,
                                background: 'transparent', color: a.status === 'active' ? AMBER : GREEN,
                                fontFamily: MONO, fontSize: 8, cursor: 'pointer', borderRadius: 2,
                              }}>{a.status === 'active' ? 'PAUSE' : 'ENABLE'}</button>
                              <button onClick={() => deleteAlert(a.id)} style={{
                                padding: '2px 6px', border: `1px solid ${RED}40`, background: 'transparent',
                                color: RED, fontFamily: MONO, fontSize: 8, cursor: 'pointer', borderRadius: 2,
                              }}>DEL</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      )}

      {/* ══════════════ HISTORY TAB ══════════════════════════════════════ */}
      {tab === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={card}>
            <div style={hdr}><span>TRIGGERED ALERT HISTORY</span></div>
            {triggeredAlerts.length === 0
              ? <div style={{ padding: '30px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>No triggered alerts</div>
              : <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                      <th style={{ ...th, textAlign: 'left' }}>TYPE</th>
                      <th style={{ ...th, textAlign: 'left' }}>CONDITION</th>
                      <th style={th}>THRESHOLD</th>
                      <th style={th}>TRIGGERED AT</th>
                      <th style={{ ...th, textAlign: 'left' }}>MESSAGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {triggeredAlerts.map((a, i) => (
                      <tr key={a.id} style={{ background: i % 2 === 0 ? '#120800' : 'transparent' }}>
                        <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{a.symbol}</td>
                        <td style={{ ...td, textAlign: 'left' }}>{ALERT_TYPE_META[a.type]?.label ?? a.type}</td>
                        <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{CONDITION_META[a.condition]}</td>
                        <td style={{ ...td, color: TEXT, fontWeight: 700 }}>{a.threshold}</td>
                        <td style={{ ...td, fontSize: 9, color: SUBTLE }}>
                          {a.triggered_at ? new Date(a.triggered_at).toLocaleString() : '─'}
                        </td>
                        <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{a.message ?? '─'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { l: 'TOTAL ALERTS', v: alerts.length.toString(), c: TEXT },
              { l: 'ACTIVE', v: activeCount.toString(), c: GREEN },
              { l: 'TRIGGERED', v: triggeredAlerts.length.toString(), c: AMBER },
              { l: 'DISABLED', v: alerts.filter(a => a.status === 'disabled').length.toString(), c: SUBTLE },
            ].map(item => (
              <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px' }}>
                <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 1 }}>{item.l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 3 }}>{item.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ WATCHDOG TAB ══════════════════════════════════════ */}
      {tab === 'WATCHDOG' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={card}>
            <div style={hdr}><span>WATCHDOG — LIVE MONITORING</span></div>
            <div style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>WATCH UNIVERSE</label>
                <input value={watchSymbols} onChange={e => setWatchSymbols(e.target.value.toUpperCase())}
                  style={{ ...inp, width: 320 }} placeholder="AAPL,MSFT,NVDA,TSLA,AMZN" />
              </div>
              <button onClick={loadWatchdog} disabled={loadingWatch} style={{
                padding: '5px 14px', border: `1px solid ${AMBER}`, background: '#1a1200',
                color: AMBER, fontFamily: MONO, fontSize: 10, fontWeight: 700,
                cursor: loadingWatch ? 'not-allowed' : 'pointer', borderRadius: 3,
              }}>{loadingWatch ? 'MONITORING…' : 'REFRESH'}</button>
            </div>
          </div>

          {watchData.length > 0 && (
            <div style={card}>
              <div style={hdr}><span>WATCHDOG DASHBOARD</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                      <th style={th}>PRICE</th>
                      <th style={th}>CHANGE %</th>
                      <th style={th}>RSI (14)</th>
                      <th style={th}>VOLUME</th>
                      <th style={th}>SIGNAL</th>
                      <th style={th}>ALERTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchData.map((w, i) => {
                      const symbolAlerts = alerts.filter(a => a.symbol === w.symbol && a.status === 'active');
                      const rsiSignal = w.rsi != null ? (w.rsi > 70 ? 'OVERBOUGHT' : w.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL') : '─';
                      const rsiColor = w.rsi != null ? (w.rsi > 70 ? RED : w.rsi < 30 ? GREEN : SUBTLE) : SUBTLE;
                      return (
                        <tr key={w.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{w.symbol}</td>
                          <td style={{ ...td, fontFamily: MONO }}>{w.price > 0 ? w.price.toFixed(2) : '─'}</td>
                          <td style={{ ...td, color: w.change_pct >= 0 ? GREEN : RED, fontWeight: 700 }}>
                            {w.change_pct >= 0 ? '+' : ''}{(w.change_pct * 100).toFixed(2)}%
                          </td>
                          <td style={{ ...td, color: rsiColor, fontWeight: w.rsi != null && (w.rsi > 70 || w.rsi < 30) ? 700 : 400 }}>
                            {w.rsi != null ? w.rsi.toFixed(1) : '─'}
                          </td>
                          <td style={{ ...td, color: SUBTLE }}>
                            {w.volume != null ? (w.volume > 1e6 ? `${(w.volume / 1e6).toFixed(1)}M` : w.volume > 1e3 ? `${(w.volume / 1e3).toFixed(0)}K` : w.volume.toString()) : '─'}
                          </td>
                          <td style={{ ...td, color: rsiColor, fontSize: 9 }}>{rsiSignal}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            {symbolAlerts.length > 0
                              ? <Badge label={`${symbolAlerts.length} ALERT${symbolAlerts.length > 1 ? 'S' : ''}`} color={AMBER} />
                              : <span style={{ color: SUBTLE, fontSize: 9 }}>─</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div data-testid="alerts-ready" style={{ display: 'none' }} />
    </div>
  );
}

