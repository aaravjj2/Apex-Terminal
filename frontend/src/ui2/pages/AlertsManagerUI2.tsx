/**
 * AlertsManagerUI2.tsx — Bloomberg-style Alert Management System
 * ===============================================================
 * Full-featured alerts system with:
 * - Price alerts (above/below/cross)
 * - Technical indicator alerts (RSI, MACD, BB, Volume)
 * - Fundamental alerts (earnings, dividend dates)
 * - Alert history log with timestamps
 * - Canvas alert timeline visualization
 * - Sound/notification preferences
 * - Alert templates / presets
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Alert types ──────────────────────────────────────────────────────────────
type AlertCondition = 
  | 'price_above' | 'price_below' | 'price_cross'
  | 'rsi_above' | 'rsi_below'
  | 'macd_cross_up' | 'macd_cross_down'
  | 'bb_upper' | 'bb_lower'
  | 'volume_spike'
  | 'pct_change'
  | 'new_high' | 'new_low'
  | 'earnings_date' | 'dividend_date';

interface AlertConditionDef {
  id: AlertCondition;
  label: string;
  category: 'price' | 'technical' | 'volume' | 'fundamental';
  icon: string;
  needsValue: boolean;
  unit?: string;
}

const ALERT_CONDITIONS: AlertConditionDef[] = [
  { id: 'price_above', label: 'Price Crosses Above', category: 'price', icon: '📈', needsValue: true, unit: '$' },
  { id: 'price_below', label: 'Price Crosses Below', category: 'price', icon: '📉', needsValue: true, unit: '$' },
  { id: 'price_cross', label: 'Price Crosses Level', category: 'price', icon: '↔️', needsValue: true, unit: '$' },
  { id: 'pct_change', label: '% Change Exceeds', category: 'price', icon: '📊', needsValue: true, unit: '%' },
  { id: 'new_high', label: 'Makes New 52W High', category: 'price', icon: '🔝', needsValue: false },
  { id: 'new_low', label: 'Makes New 52W Low', category: 'price', icon: '🔻', needsValue: false },
  { id: 'rsi_above', label: 'RSI(14) Above', category: 'technical', icon: '⬆️', needsValue: true },
  { id: 'rsi_below', label: 'RSI(14) Below', category: 'technical', icon: '⬇️', needsValue: true },
  { id: 'macd_cross_up', label: 'MACD Bullish Cross', category: 'technical', icon: '🟢', needsValue: false },
  { id: 'macd_cross_down', label: 'MACD Bearish Cross', category: 'technical', icon: '🔴', needsValue: false },
  { id: 'bb_upper', label: 'Breaks Bollinger Upper', category: 'technical', icon: '⬆️', needsValue: false },
  { id: 'bb_lower', label: 'Breaks Bollinger Lower', category: 'technical', icon: '⬇️', needsValue: false },
  { id: 'volume_spike', label: 'Volume Spike (x Avg)', category: 'volume', icon: '📊', needsValue: true, unit: 'x' },
  { id: 'earnings_date', label: 'Earnings Date Within', category: 'fundamental', icon: '📅', needsValue: true, unit: 'days' },
  { id: 'dividend_date', label: 'Ex-Dividend Date Within', category: 'fundamental', icon: '💰', needsValue: true, unit: 'days' },
];

// ── Alert interface ──────────────────────────────────────────────────────────
interface Alert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  value?: number;
  status: 'active' | 'triggered' | 'expired' | 'disabled';
  createdAt: Date;
  triggeredAt?: Date;
  expiresAt?: Date;
  frequency: 'once' | 'every_time' | 'once_per_day';
  notification: ('popup' | 'sound' | 'email')[];
  triggerCount: number;
  notes?: string;
}

// ── Alert template ───────────────────────────────────────────────────────────
interface AlertTemplate {
  name: string;
  icon: string;
  condition: AlertCondition;
  value?: number;
  frequency: Alert['frequency'];
  description: string;
}

const TEMPLATES: AlertTemplate[] = [
  { name: 'Oversold RSI', icon: '📉', condition: 'rsi_below', value: 30, frequency: 'once_per_day', description: 'Triggers when RSI drops below 30' },
  { name: 'Overbought RSI', icon: '📈', condition: 'rsi_above', value: 70, frequency: 'once_per_day', description: 'Triggers when RSI exceeds 70' },
  { name: 'MACD Buy Signal', icon: '🟢', condition: 'macd_cross_up', frequency: 'once', description: 'MACD bullish crossover detected' },
  { name: 'Volume Breakout', icon: '🔥', condition: 'volume_spike', value: 3, frequency: 'every_time', description: 'Volume exceeds 3x daily average' },
  { name: 'New 52W High', icon: '🏆', condition: 'new_high', frequency: 'once', description: 'Stock makes new 52-week high' },
  { name: 'Earnings Alert', icon: '📅', condition: 'earnings_date', value: 7, frequency: 'once', description: 'Earnings report within 7 days' },
  { name: 'BB Squeeze', icon: '🔔', condition: 'bb_lower', frequency: 'every_time', description: 'Price breaks below Bollinger Band' },
  { name: 'Big Move Alert', icon: '⚡', condition: 'pct_change', value: 5, frequency: 'every_time', description: 'Stock moves more than 5% intraday' },
];

// ── Mock alerts ──────────────────────────────────────────────────────────────
function generateMockAlerts(): Alert[] {
  const symbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'JPM', 'V', 'BA', 'NFLX', 'CRM', 'COIN', 'XOM'];
  return symbols.flatMap((sym, si) => {
    const alerts: Alert[] = [];
    // Active price alert
    alerts.push({
      id: `alert-${si}-1`,
      symbol: sym,
      condition: 'price_above',
      value: 100 + Math.random() * 400,
      status: Math.random() > 0.3 ? 'active' : 'triggered',
      createdAt: new Date(Date.now() - Math.random() * 7 * 86400000),
      triggeredAt: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 2 * 86400000) : undefined,
      frequency: 'once',
      notification: ['popup', 'sound'],
      triggerCount: Math.random() > 0.5 ? 1 : 0,
    });
    // Technical alert
    if (Math.random() > 0.4) {
      const conds: AlertCondition[] = ['rsi_above', 'rsi_below', 'macd_cross_up', 'volume_spike'];
      alerts.push({
        id: `alert-${si}-2`,
        symbol: sym,
        condition: conds[Math.floor(Math.random() * conds.length)],
        value: Math.random() > 0.5 ? 30 + Math.random() * 40 : undefined,
        status: Math.random() > 0.6 ? 'active' : Math.random() > 0.3 ? 'triggered' : 'disabled',
        createdAt: new Date(Date.now() - Math.random() * 14 * 86400000),
        triggeredAt: Math.random() > 0.6 ? new Date(Date.now() - Math.random() * 3 * 86400000) : undefined,
        frequency: 'every_time',
        notification: ['popup'],
        triggerCount: Math.floor(Math.random() * 5),
      });
    }
    return alerts;
  });
}

// ── Timeline chart ───────────────────────────────────────────────────────────
function AlertTimeline({ alerts, width = 800, height = 100 }: { alerts: Alert[]; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const triggered = alerts.filter(a => a.triggeredAt);
    if (triggered.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No triggered alerts in timeline', width / 2, height / 2);
      return;
    }

    const now = Date.now();
    const weekAgo = now - 7 * 86400000;

    // Grid
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 0.5;
    for (let d = 0; d < 7; d++) {
      const x = (d / 7) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = MUTED;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      const date = new Date(weekAgo + d * 86400000);
      ctx.fillText(date.toLocaleDateString('en-US', { weekday: 'short' }), x + (width / 14), height - 4);
    }

    // Plot triggered alerts
    triggered.forEach(a => {
      const t = (a.triggeredAt!.getTime() - weekAgo) / (now - weekAgo);
      if (t < 0 || t > 1) return;
      const x = t * width;
      const y = 10 + Math.random() * (height - 30);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = a.condition.includes('above') || a.condition.includes('up') || a.condition === 'new_high'
        ? GREEN
        : a.condition.includes('below') || a.condition.includes('down') || a.condition === 'new_low'
          ? RED
          : AMBER;
      ctx.fill();

      ctx.fillStyle = TEXT;
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(a.symbol, x, y - 8);
    });
  }, [alerts, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'active' | 'history' | 'create' | 'templates';
type FilterStatus = 'all' | 'active' | 'triggered' | 'disabled';

export default function AlertsManagerUI2() {
  const [alerts, setAlerts] = useState<Alert[]>(() => generateMockAlerts());
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  // Create form state
  const [createSymbol, setCreateSymbol] = useState('');
  const [createCondition, setCreateCondition] = useState<AlertCondition>('price_above');
  const [createValue, setCreateValue] = useState('');
  const [createFrequency, setCreateFrequency] = useState<Alert['frequency']>('once');
  const [createNotifications, setCreateNotifications] = useState<Set<string>>(new Set(['popup', 'sound']));
  const [createNotes, setCreateNotes] = useState('');

  // ── Filter alerts ──
  const filteredAlerts = useMemo(() => {
    let items = alerts;
    if (filterStatus !== 'all') {
      items = items.filter(a => a.status === filterStatus);
    }
    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      items = items.filter(a => a.symbol.includes(q));
    }
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [alerts, filterStatus, searchQuery]);

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const triggeredAlerts = alerts.filter(a => a.status === 'triggered');

  // ── Stats ──
  const stats = useMemo(() => ({
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    triggered: alerts.filter(a => a.status === 'triggered').length,
    disabled: alerts.filter(a => a.status === 'disabled').length,
    bySymbol: [...new Set(alerts.map(a => a.symbol))].length,
  }), [alerts]);

  // ── Toggle alert ──
  const toggleAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, status: a.status === 'active' ? 'disabled' : 'active' } : a
    ));
  }, []);

  // ── Delete alert ──
  const deleteAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Create alert ──
  const handleCreateAlert = useCallback(() => {
    if (!createSymbol) return;
    const newAlert: Alert = {
      id: `alert-new-${Date.now()}`,
      symbol: createSymbol.toUpperCase(),
      condition: createCondition,
      value: createValue ? parseFloat(createValue) : undefined,
      status: 'active',
      createdAt: new Date(),
      frequency: createFrequency,
      notification: Array.from(createNotifications) as Alert['notification'],
      triggerCount: 0,
      notes: createNotes || undefined,
    };
    setAlerts(prev => [newAlert, ...prev]);
    setCreateSymbol('');
    setCreateValue('');
    setCreateNotes('');
    setActiveTab('active');
  }, [createSymbol, createCondition, createValue, createFrequency, createNotifications, createNotes]);

  // ── Apply template ──
  const applyTemplate = useCallback((template: AlertTemplate) => {
    setCreateCondition(template.condition);
    if (template.value !== undefined) setCreateValue(String(template.value));
    setCreateFrequency(template.frequency);
    setActiveTab('create');
  }, []);

  const conditionDef = ALERT_CONDITIONS.find(c => c.id === createCondition);

  function formatTime(d: Date): string {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'active', label: 'ACTIVE', count: stats.active },
    { key: 'history', label: 'TRIGGERED', count: stats.triggered },
    { key: 'create', label: '+ CREATE' },
    { key: 'templates', label: 'TEMPLATES' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>🔔 ALERT MANAGER</span>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 12, marginLeft: 16 }}>
          <span style={{ fontSize: 9, color: MUTED }}>
            Active: <span style={{ color: GREEN }}>{stats.active}</span>
          </span>
          <span style={{ fontSize: 9, color: MUTED }}>
            Triggered: <span style={{ color: AMBER }}>{stats.triggered}</span>
          </span>
          <span style={{ fontSize: 9, color: MUTED }}>
            Symbols: <span style={{ color: TEXT }}>{stats.bySymbol}</span>
          </span>
        </div>

        {/* Tabs */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  marginLeft: 4,
                  background: 'rgba(245,166,35,0.2)',
                  padding: '1px 4px',
                  borderRadius: 2,
                  fontSize: 8,
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search/Filter bar ── */}
      {(activeTab === 'active' || activeTab === 'history') && (
        <div style={{
          background: PANEL,
          borderBottom: `1px solid ${BORDER}`,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <input
            style={{
              background: '#0d0d0d',
              border: `1px solid ${BORDER}`,
              borderRadius: 3,
              color: TEXT,
              padding: '3px 8px',
              fontSize: 10,
              fontFamily: '"Roboto Mono", monospace',
              width: 120,
              outline: 'none',
            }}
            placeholder="Filter symbol..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {(['all', 'active', 'triggered', 'disabled'] as FilterStatus[]).map(s => (
            <button
              key={s}
              style={{
                background: filterStatus === s ? 'rgba(245,166,35,0.12)' : 'transparent',
                border: `1px solid ${filterStatus === s ? AMBER : BORDER}`,
                color: filterStatus === s ? AMBER : MUTED,
                padding: '3px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
                textTransform: 'uppercase',
              }}
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(activeTab === 'active' || activeTab === 'history') && (
          <div style={{ padding: 0 }}>
            {/* Timeline */}
            <div style={{
              padding: '8px 16px',
              borderBottom: `1px solid ${BORDER}`,
              background: PANEL,
            }}>
              <div style={{ color: AMBER, fontSize: 9, fontWeight: 600, marginBottom: 4 }}>ALERT TIMELINE (7 DAYS)</div>
              <AlertTimeline alerts={alerts} />
            </div>

            {/* Alert list */}
            <div style={{
              display: 'flex',
              borderBottom: `2px solid ${BORDER}`,
              padding: '6px 16px',
              position: 'sticky',
              top: 0,
              background: BG,
              zIndex: 1,
            }}>
              <span style={{ width: 70, color: MUTED, fontSize: 9, fontWeight: 600 }}>SYMBOL</span>
              <span style={{ flex: 1, color: MUTED, fontSize: 9, fontWeight: 600 }}>CONDITION</span>
              <span style={{ width: 80, color: MUTED, fontSize: 9, fontWeight: 600, textAlign: 'right' }}>VALUE</span>
              <span style={{ width: 70, color: MUTED, fontSize: 9, fontWeight: 600, textAlign: 'center' }}>STATUS</span>
              <span style={{ width: 80, color: MUTED, fontSize: 9, fontWeight: 600, textAlign: 'right' }}>CREATED</span>
              <span style={{ width: 60, color: MUTED, fontSize: 9, fontWeight: 600, textAlign: 'center' }}>FREQ</span>
              <span style={{ width: 80, color: MUTED, fontSize: 9, fontWeight: 600, textAlign: 'center' }}>ACTIONS</span>
            </div>

            {filteredAlerts.map((alert, i) => {
              const cDef = ALERT_CONDITIONS.find(c => c.id === alert.condition);
              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${BORDER}`,
                    background: selectedAlert === alert.id ? 'rgba(245,166,35,0.06)' : i % 2 === 0 ? PANEL : BG,
                    cursor: 'pointer',
                    opacity: alert.status === 'disabled' ? 0.5 : 1,
                  }}
                  onClick={() => setSelectedAlert(alert.id)}
                >
                  <span style={{ width: 70, color: AMBER, fontWeight: 600, fontSize: 10 }}>{alert.symbol}</span>
                  <span style={{ flex: 1, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{cDef?.icon}</span>
                    <span>{cDef?.label || alert.condition}</span>
                  </span>
                  <span style={{ width: 80, textAlign: 'right', fontSize: 10 }}>
                    {alert.value !== undefined ? `${cDef?.unit || ''}${alert.value.toFixed(cDef?.unit === '$' ? 2 : 0)}` : '—'}
                  </span>
                  <span style={{ width: 70, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 2,
                      fontSize: 8,
                      fontWeight: 600,
                      background:
                        alert.status === 'active' ? 'rgba(38,166,154,0.15)' :
                        alert.status === 'triggered' ? 'rgba(245,166,35,0.15)' :
                        'rgba(136,136,136,0.15)',
                      color:
                        alert.status === 'active' ? GREEN :
                        alert.status === 'triggered' ? AMBER :
                        MUTED,
                    }}>
                      {alert.status.toUpperCase()}
                    </span>
                  </span>
                  <span style={{ width: 80, textAlign: 'right', color: MUTED, fontSize: 9 }}>
                    {formatTime(alert.createdAt)}
                  </span>
                  <span style={{ width: 60, textAlign: 'center', fontSize: 9, color: MUTED }}>
                    {alert.frequency === 'once' ? '1×' : alert.frequency === 'every_time' ? '∞' : '1/d'}
                  </span>
                  <div style={{ width: 80, display: 'flex', justifyContent: 'center', gap: 4 }}>
                    <button
                      style={{
                        background: 'transparent',
                        border: `1px solid ${alert.status === 'active' ? AMBER : GREEN}`,
                        color: alert.status === 'active' ? AMBER : GREEN,
                        padding: '2px 6px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontSize: 8,
                        fontFamily: '"Roboto Mono", monospace',
                      }}
                      onClick={e => { e.stopPropagation(); toggleAlert(alert.id); }}
                    >
                      {alert.status === 'active' ? 'PAUSE' : 'RESUME'}
                    </button>
                    <button
                      style={{
                        background: 'transparent',
                        border: `1px solid ${RED}`,
                        color: RED,
                        padding: '2px 6px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontSize: 8,
                        fontFamily: '"Roboto Mono", monospace',
                      }}
                      onClick={e => { e.stopPropagation(); deleteAlert(alert.id); }}
                    >
                      DEL
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredAlerts.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                <div>No alerts match the current filter</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div style={{ padding: 16, maxWidth: 600 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>CREATE NEW ALERT</div>

            {/* Symbol */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>SYMBOL</label>
              <input
                style={{
                  background: '#0d0d0d',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 3,
                  color: TEXT,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: '"Roboto Mono", monospace',
                  width: '100%',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="AAPL"
                value={createSymbol}
                onChange={e => setCreateSymbol(e.target.value.toUpperCase())}
              />
            </div>

            {/* Condition */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>CONDITION</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {ALERT_CONDITIONS.map(c => (
                  <button
                    key={c.id}
                    style={{
                      background: createCondition === c.id ? 'rgba(245,166,35,0.12)' : 'transparent',
                      border: `1px solid ${createCondition === c.id ? AMBER : BORDER}`,
                      color: createCondition === c.id ? AMBER : TEXT,
                      padding: '6px 8px',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 9,
                      fontFamily: '"Roboto Mono", monospace',
                      textAlign: 'left',
                    }}
                    onClick={() => setCreateCondition(c.id)}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            {conditionDef?.needsValue && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>
                  VALUE {conditionDef.unit && `(${conditionDef.unit})`}
                </label>
                <input
                  style={{
                    background: '#0d0d0d',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 3,
                    color: TEXT,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontFamily: '"Roboto Mono", monospace',
                    width: '100%',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  type="number"
                  placeholder="Enter value..."
                  value={createValue}
                  onChange={e => setCreateValue(e.target.value)}
                />
              </div>
            )}

            {/* Frequency */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>FREQUENCY</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'once', label: 'Once Only' },
                  { key: 'every_time', label: 'Every Time' },
                  { key: 'once_per_day', label: 'Once Per Day' },
                ].map(f => (
                  <button
                    key={f.key}
                    style={{
                      flex: 1,
                      background: createFrequency === f.key ? 'rgba(245,166,35,0.12)' : 'transparent',
                      border: `1px solid ${createFrequency === f.key ? AMBER : BORDER}`,
                      color: createFrequency === f.key ? AMBER : MUTED,
                      padding: '6px',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 9,
                      fontFamily: '"Roboto Mono", monospace',
                    }}
                    onClick={() => setCreateFrequency(f.key as Alert['frequency'])}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>NOTIFICATIONS</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'popup', label: '💬 Popup' },
                  { key: 'sound', label: '🔊 Sound' },
                  { key: 'email', label: '📧 Email' },
                ].map(n => (
                  <button
                    key={n.key}
                    style={{
                      flex: 1,
                      background: createNotifications.has(n.key) ? 'rgba(38,166,154,0.12)' : 'transparent',
                      border: `1px solid ${createNotifications.has(n.key) ? GREEN : BORDER}`,
                      color: createNotifications.has(n.key) ? GREEN : MUTED,
                      padding: '6px',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 9,
                      fontFamily: '"Roboto Mono", monospace',
                    }}
                    onClick={() => {
                      setCreateNotifications(prev => {
                        const next = new Set(prev);
                        next.has(n.key) ? next.delete(n.key) : next.add(n.key);
                        return next;
                      });
                    }}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: MUTED, fontSize: 9, display: 'block', marginBottom: 4 }}>NOTES (OPTIONAL)</label>
              <input
                style={{
                  background: '#0d0d0d',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 3,
                  color: TEXT,
                  padding: '8px 12px',
                  fontSize: 10,
                  fontFamily: '"Roboto Mono", monospace',
                  width: '100%',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="Add notes..."
                value={createNotes}
                onChange={e => setCreateNotes(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              style={{
                background: 'rgba(38,166,154,0.2)',
                border: `1px solid ${GREEN}`,
                color: GREEN,
                padding: '10px 20px',
                borderRadius: 4,
                cursor: createSymbol ? 'pointer' : 'not-allowed',
                fontSize: 11,
                fontFamily: '"Roboto Mono", monospace',
                fontWeight: 700,
                width: '100%',
                opacity: createSymbol ? 1 : 0.5,
              }}
              onClick={handleCreateAlert}
              disabled={!createSymbol}
            >
              CREATE ALERT
            </button>
          </div>
        )}

        {activeTab === 'templates' && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>ALERT TEMPLATES</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 12,
            }}>
              {TEMPLATES.map(t => (
                <div
                  key={t.name}
                  style={{
                    background: PANEL,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 4,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onClick={() => applyTemplate(t)}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = AMBER}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = BORDER}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ color: TEXT, fontWeight: 700, fontSize: 11 }}>{t.name}</span>
                  </div>
                  <div style={{ color: MUTED, fontSize: 9, lineHeight: 1.4, marginBottom: 8 }}>
                    {t.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: MUTED }}>
                      {ALERT_CONDITIONS.find(c => c.id === t.condition)?.label}
                      {t.value !== undefined ? ` = ${t.value}` : ''}
                    </span>
                    <span style={{
                      color: AMBER,
                      fontSize: 9,
                      padding: '2px 6px',
                      border: `1px solid ${AMBER}`,
                      borderRadius: 2,
                    }}>
                      USE
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
