import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ConditionType = 'price_cross' | 'price_cross_indicator' | 'rsi_cross' | 'macd_crossover' | 'volume_exceed' | 'pct_change' | 'drawing_cross' | 'custom';
type AlertFrequency = 'once' | 'every_time' | 'once_per_bar';
type AlertChannel = 'in_app' | 'sound' | 'email' | 'webhook';
type AlertStatus = 'active' | 'triggered' | 'expired' | 'snoozed' | 'disabled';
type IndicatorType = 'SMA' | 'EMA' | 'VWAP';

interface AlertCondition {
  type: ConditionType;
  value?: number;
  indicator?: IndicatorType;
  indicatorPeriod?: number;
  direction?: 'above' | 'below' | 'cross';
  formula?: string;
}

interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: AlertCondition;
  frequency: AlertFrequency;
  channels: AlertChannel[];
  sound: string;
  status: AlertStatus;
  createdAt: number;
  expiresAt: number | null;
  triggeredAt: number | null;
  triggeredCount: number;
  message: string;
  templateId?: string;
}

interface AlertTemplate {
  id: string;
  name: string;
  condition: AlertCondition;
  frequency: AlertFrequency;
  channels: AlertChannel[];
}

interface AlertsManagerProps {
  className?: string;
  onCreateAlert?: (alert: Omit<Alert, 'id' | 'createdAt' | 'status' | 'triggeredAt' | 'triggeredCount'>) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'price_cross', label: 'Price Crossing Value' },
  { value: 'price_cross_indicator', label: 'Price Crossing Indicator' },
  { value: 'rsi_cross', label: 'RSI Crossing Threshold' },
  { value: 'macd_crossover', label: 'MACD Crossover' },
  { value: 'volume_exceed', label: 'Volume Exceeding' },
  { value: 'pct_change', label: '% Change Exceeding' },
  { value: 'drawing_cross', label: 'Drawing Line Cross' },
  { value: 'custom', label: 'Custom Formula' },
];

const SOUNDS = ['Default', 'Bell', 'Chime', 'Alert', 'Ping', 'Cash Register', 'Alarm', 'None'];

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', name: 'AAPL Above 195', symbol: 'AAPL', condition: { type: 'price_cross', value: 195, direction: 'above' }, frequency: 'once', channels: ['in_app', 'sound'], sound: 'Default', status: 'active', createdAt: Date.now() - 86400000 * 3, expiresAt: Date.now() + 86400000 * 30, triggeredAt: null, triggeredCount: 0, message: 'AAPL crossed above $195' },
  { id: 'a2', name: 'MSFT RSI Overbought', symbol: 'MSFT', condition: { type: 'rsi_cross', value: 70, direction: 'above' }, frequency: 'once_per_bar', channels: ['in_app', 'email'], sound: 'Bell', status: 'active', createdAt: Date.now() - 86400000 * 2, expiresAt: null, triggeredAt: null, triggeredCount: 0, message: 'MSFT RSI crossed above 70' },
  { id: 'a3', name: 'NVDA MACD Bull', symbol: 'NVDA', condition: { type: 'macd_crossover', direction: 'above' }, frequency: 'every_time', channels: ['in_app', 'sound', 'webhook'], sound: 'Chime', status: 'triggered', createdAt: Date.now() - 86400000 * 7, expiresAt: null, triggeredAt: Date.now() - 3600000, triggeredCount: 3, message: 'NVDA MACD bullish crossover' },
  { id: 'a4', name: 'TSLA Volume Spike', symbol: 'TSLA', condition: { type: 'volume_exceed', value: 50000000 }, frequency: 'once_per_bar', channels: ['in_app'], sound: 'Alert', status: 'triggered', createdAt: Date.now() - 86400000 * 5, expiresAt: null, triggeredAt: Date.now() - 7200000, triggeredCount: 5, message: 'TSLA volume exceeded 50M' },
  { id: 'a5', name: 'GOOGL 5% Drop', symbol: 'GOOGL', condition: { type: 'pct_change', value: -5, direction: 'below' }, frequency: 'once', channels: ['in_app', 'email', 'sound'], sound: 'Alarm', status: 'expired', createdAt: Date.now() - 86400000 * 14, expiresAt: Date.now() - 86400000 * 1, triggeredAt: null, triggeredCount: 0, message: 'GOOGL dropped more than 5%' },
  { id: 'a6', name: 'AMZN EMA Cross', symbol: 'AMZN', condition: { type: 'price_cross_indicator', indicator: 'EMA', indicatorPeriod: 20, direction: 'above' }, frequency: 'every_time', channels: ['in_app', 'sound'], sound: 'Default', status: 'snoozed', createdAt: Date.now() - 86400000 * 4, expiresAt: null, triggeredAt: Date.now() - 1800000, triggeredCount: 2, message: 'AMZN crossed above EMA(20)' },
];

const MOCK_TEMPLATES: AlertTemplate[] = [
  { id: 'tmpl1', name: 'Price Break Above', condition: { type: 'price_cross', value: 0, direction: 'above' }, frequency: 'once', channels: ['in_app', 'sound'] },
  { id: 'tmpl2', name: 'RSI Overbought', condition: { type: 'rsi_cross', value: 70, direction: 'above' }, frequency: 'once_per_bar', channels: ['in_app', 'email'] },
  { id: 'tmpl3', name: 'High Volume', condition: { type: 'volume_exceed', value: 10000000 }, frequency: 'once_per_bar', channels: ['in_app'] },
  { id: 'tmpl4', name: 'MACD Signal', condition: { type: 'macd_crossover', direction: 'cross' }, frequency: 'every_time', channels: ['in_app', 'sound'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusColors: Record<AlertStatus, string> = {
  active: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30',
  triggered: 'text-amber-400 bg-amber-900/20 border-amber-800/30',
  expired: 'text-gray-500 bg-gray-800/20 border-gray-700/30',
  snoozed: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  disabled: 'text-gray-600 bg-gray-800/10 border-gray-800/20',
};

const statusDot: Record<AlertStatus, string> = {
  active: 'bg-emerald-400',
  triggered: 'bg-amber-400 animate-pulse',
  expired: 'bg-gray-500',
  snoozed: 'bg-blue-400',
  disabled: 'bg-gray-600',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AlertsManager({ className = '', onCreateAlert }: AlertsManagerProps) {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [templates] = useState<AlertTemplate[]>(MOCK_TEMPLATES);
  const [tab, setTab] = useState<'active' | 'triggered' | 'all'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create form state
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('AAPL');
  const [newCondType, setNewCondType] = useState<ConditionType>('price_cross');
  const [newValue, setNewValue] = useState(0);
  const [newDirection, setNewDirection] = useState<'above' | 'below' | 'cross'>('above');
  const [newIndicator, setNewIndicator] = useState<IndicatorType>('SMA');
  const [newIndicatorPeriod, setNewIndicatorPeriod] = useState(20);
  const [newFormula, setNewFormula] = useState('');
  const [newFrequency, setNewFrequency] = useState<AlertFrequency>('once');
  const [newChannels, setNewChannels] = useState<Set<AlertChannel>>(new Set(['in_app', 'sound']));
  const [newSound, setNewSound] = useState('Default');
  const [newMessage, setNewMessage] = useState('');
  const [newExpiration, setNewExpiration] = useState('');

  const filteredAlerts = useMemo(() => {
    if (tab === 'active') return alerts.filter(a => a.status === 'active' || a.status === 'snoozed');
    if (tab === 'triggered') return alerts.filter(a => a.status === 'triggered');
    return alerts;
  }, [alerts, tab]);

  const stats = useMemo(() => ({
    active: alerts.filter(a => a.status === 'active').length,
    triggered: alerts.filter(a => a.status === 'triggered').length,
    snoozed: alerts.filter(a => a.status === 'snoozed').length,
    total: alerts.length,
  }), [alerts]);

  const toggleChannel = useCallback((ch: AlertChannel) => {
    setNewChannels(prev => { const s = new Set(prev); if (s.has(ch)) s.delete(ch); else s.add(ch); return s; });
  }, []);

  const handleCreate = useCallback(() => {
    const condition: AlertCondition = { type: newCondType, direction: newDirection };
    if (newCondType === 'price_cross' || newCondType === 'rsi_cross' || newCondType === 'volume_exceed' || newCondType === 'pct_change') condition.value = newValue;
    if (newCondType === 'price_cross_indicator') { condition.indicator = newIndicator; condition.indicatorPeriod = newIndicatorPeriod; }
    if (newCondType === 'custom') condition.formula = newFormula;

    const alert: Alert = {
      id: `a-${Date.now()}`,
      name: newName || `${newSymbol} Alert`,
      symbol: newSymbol,
      condition,
      frequency: newFrequency,
      channels: Array.from(newChannels),
      sound: newSound,
      status: 'active',
      createdAt: Date.now(),
      expiresAt: newExpiration ? new Date(newExpiration).getTime() : null,
      triggeredAt: null,
      triggeredCount: 0,
      message: newMessage || `${newSymbol} ${newCondType} alert`,
    };

    setAlerts(prev => [alert, ...prev]);
    onCreateAlert?.(alert);
    setShowCreate(false);
    setNewName('');
    setNewValue(0);
    setNewFormula('');
    setNewMessage('');
    setNewExpiration('');
  }, [newName, newSymbol, newCondType, newValue, newDirection, newIndicator, newIndicatorPeriod, newFormula, newFrequency, newChannels, newSound, newMessage, newExpiration, onCreateAlert]);

  const handleDelete = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const handleSnooze = useCallback((id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'snoozed' as AlertStatus } : a)), []);
  const handleActivate = useCallback((id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'active' as AlertStatus } : a)), []);
  const handleDisable = useCallback((id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'disabled' as AlertStatus } : a)), []);

  const handleBulkDelete = useCallback(() => {
    setAlerts(prev => prev.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkSnooze = useCallback(() => {
    setAlerts(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status: 'snoozed' as AlertStatus } : a));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }, []);

  const applyTemplate = useCallback((tmpl: AlertTemplate) => {
    setNewCondType(tmpl.condition.type);
    setNewValue(tmpl.condition.value ?? 0);
    setNewDirection(tmpl.condition.direction ?? 'above');
    if (tmpl.condition.indicator) setNewIndicator(tmpl.condition.indicator);
    if (tmpl.condition.indicatorPeriod) setNewIndicatorPeriod(tmpl.condition.indicatorPeriod);
    setNewFrequency(tmpl.frequency);
    setNewChannels(new Set(tmpl.channels));
    setNewName(tmpl.name);
    setShowTemplates(false);
    setShowCreate(true);
  }, []);

  const condLabel = (c: AlertCondition) => {
    switch (c.type) {
      case 'price_cross': return `Price ${c.direction} ${c.value}`;
      case 'price_cross_indicator': return `Price ${c.direction} ${c.indicator}(${c.indicatorPeriod})`;
      case 'rsi_cross': return `RSI ${c.direction} ${c.value}`;
      case 'macd_crossover': return `MACD ${c.direction === 'above' ? 'Bull' : c.direction === 'below' ? 'Bear' : ''} Cross`;
      case 'volume_exceed': return `Vol > ${(c.value ?? 0).toLocaleString()}`;
      case 'pct_change': return `Chg ${c.direction} ${c.value}%`;
      case 'drawing_cross': return 'Drawing Cross';
      case 'custom': return `Custom: ${c.formula?.slice(0, 20)}`;
    }
  };

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">Alerts</span>
          <div className="flex gap-1 text-[10px]">
            <span className="text-emerald-400">{stats.active} active</span>
            <span className="text-gray-600">|</span>
            <span className="text-amber-400">{stats.triggered} triggered</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowTemplates(true)} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">Templates</button>
          <button onClick={() => setShowCreate(true)} className="px-2 py-0.5 rounded text-[10px] bg-amber-600 text-black font-medium hover:bg-amber-500">+ New</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-3 border-b border-gray-800/30">
        {(['active', 'triggered', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border-b-2 transition-colors ${
              tab === t ? 'text-amber-400 border-amber-500' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t} {t === 'active' ? `(${stats.active})` : t === 'triggered' ? `(${stats.triggered})` : `(${stats.total})`}
          </button>
        ))}
        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-500">{selectedIds.size} selected</span>
            <button onClick={handleBulkSnooze} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded border border-blue-800/30 hover:bg-blue-800/40">Snooze</button>
            <button onClick={handleBulkDelete} className="px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded border border-red-800/30 hover:bg-red-800/40">Delete</button>
          </div>
        )}
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '400px' }}>
        {filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-gray-600">No alerts in this view</div>
        ) : filteredAlerts.map(a => (
          <div key={a.id} className="flex items-start gap-2 px-3 py-2 border-b border-gray-800/20 hover:bg-[#12121f] transition-colors">
            <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="mt-1 accent-amber-500" />
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot[a.status]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-amber-300 font-medium truncate">{a.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] border ${statusColors[a.status]}`}>{a.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                <span className="text-gray-400">{a.symbol}</span>
                <span className="text-gray-600">—</span>
                <span className="text-gray-500">{condLabel(a.condition)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-600">
                <span>Created {fmtDate(a.createdAt)}</span>
                {a.triggeredAt && <span>Last: {fmtDate(a.triggeredAt)}</span>}
                {a.triggeredCount > 0 && <span>×{a.triggeredCount}</span>}
                <span>{a.frequency.replace('_', ' ')}</span>
                <span>{a.channels.join(', ')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {a.status === 'snoozed' && (
                <button onClick={() => handleActivate(a.id)} className="px-1 py-0.5 text-[9px] text-emerald-500 hover:text-emerald-300">Wake</button>
              )}
              {a.status === 'active' && (
                <button onClick={() => handleSnooze(a.id)} className="px-1 py-0.5 text-[9px] text-blue-500 hover:text-blue-300">Snooze</button>
              )}
              {a.status !== 'disabled' && (
                <button onClick={() => handleDisable(a.id)} className="px-1 py-0.5 text-[9px] text-gray-500 hover:text-gray-300">Off</button>
              )}
              {a.status === 'disabled' && (
                <button onClick={() => handleActivate(a.id)} className="px-1 py-0.5 text-[9px] text-emerald-500 hover:text-emerald-300">On</button>
              )}
              <button onClick={() => handleDelete(a.id)} className="px-1 py-0.5 text-[9px] text-red-500 hover:text-red-300">×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Alert Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-lg p-4 w-[420px] max-w-[90vw] max-h-[80vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-400 font-bold text-sm">Create Alert</h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Alert name..." className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-amber-300 text-[11px] placeholder-gray-600 focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Symbol</label>
                <input value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-amber-300 text-[11px] focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Condition</label>
              <select value={newCondType} onChange={e => setNewCondType(e.target.value as ConditionType)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                {CONDITION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {(newCondType === 'price_cross' || newCondType === 'rsi_cross' || newCondType === 'volume_exceed' || newCondType === 'pct_change') && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 text-[10px] block mb-0.5">Direction</label>
                  <select value={newDirection} onChange={e => setNewDirection(e.target.value as 'above' | 'below' | 'cross')} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                    <option value="above">Crosses Above</option>
                    <option value="below">Crosses Below</option>
                    <option value="cross">Any Cross</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] block mb-0.5">Value</label>
                  <input type="number" value={newValue} onChange={e => setNewValue(parseFloat(e.target.value) || 0)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-amber-300 text-right text-[11px] focus:outline-none" />
                </div>
              </div>
            )}

            {newCondType === 'price_cross_indicator' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-gray-500 text-[10px] block mb-0.5">Indicator</label>
                  <select value={newIndicator} onChange={e => setNewIndicator(e.target.value as IndicatorType)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                    <option value="SMA">SMA</option><option value="EMA">EMA</option><option value="VWAP">VWAP</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] block mb-0.5">Period</label>
                  <input type="number" value={newIndicatorPeriod} onChange={e => setNewIndicatorPeriod(parseInt(e.target.value) || 20)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-amber-300 text-right text-[11px] focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] block mb-0.5">Direction</label>
                  <select value={newDirection} onChange={e => setNewDirection(e.target.value as 'above' | 'below' | 'cross')} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                    <option value="above">Above</option><option value="below">Below</option><option value="cross">Cross</option>
                  </select>
                </div>
              </div>
            )}

            {newCondType === 'macd_crossover' && (
              <div>
                <label className="text-gray-500 text-[10px] block mb-0.5">Crossover Type</label>
                <select value={newDirection} onChange={e => setNewDirection(e.target.value as 'above' | 'below' | 'cross')} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                  <option value="above">Bullish (Signal above)</option>
                  <option value="below">Bearish (Signal below)</option>
                  <option value="cross">Any Crossover</option>
                </select>
              </div>
            )}

            {newCondType === 'custom' && (
              <div>
                <label className="text-gray-500 text-[10px] block mb-0.5">Formula</label>
                <textarea value={newFormula} onChange={e => setNewFormula(e.target.value)} placeholder="e.g. close > sma(close, 50) and rsi(14) < 30" rows={3} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-amber-300 text-[11px] placeholder-gray-600 focus:outline-none font-mono" />
              </div>
            )}

            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Frequency</label>
              <div className="flex gap-1">
                {(['once', 'every_time', 'once_per_bar'] as AlertFrequency[]).map(f => (
                  <button key={f} onClick={() => setNewFrequency(f)} className={`flex-1 py-1 rounded text-[10px] ${newFrequency === f ? 'bg-amber-600 text-black' : 'bg-[#12121f] text-gray-400 border border-gray-800/50 hover:bg-[#1a1a2e]'}`}>
                    {f.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Channels</label>
              <div className="flex gap-1">
                {(['in_app', 'sound', 'email', 'webhook'] as AlertChannel[]).map(ch => (
                  <button key={ch} onClick={() => toggleChannel(ch)} className={`flex-1 py-1 rounded text-[10px] ${newChannels.has(ch) ? 'bg-amber-600/20 text-amber-400 border border-amber-700/30' : 'bg-[#12121f] text-gray-500 border border-gray-800/50 hover:bg-[#1a1a2e]'}`}>
                    {ch.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {newChannels.has('sound') && (
              <div>
                <label className="text-gray-500 text-[10px] block mb-0.5">Sound</label>
                <select value={newSound} onChange={e => setNewSound(e.target.value)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] focus:outline-none">
                  {SOUNDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 text-[10px] block mb-0.5">Message</label>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Alert message..." className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[11px] placeholder-gray-600 focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-500 text-[10px] block mb-0.5">Expires</label>
                <input type="datetime-local" value={newExpiration} onChange={e => setNewExpiration(e.target.value)} className="w-full bg-[#12121f] border border-gray-800/50 rounded px-1 py-1 text-gray-300 text-[10px] focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="py-2 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreate} className="py-2 bg-amber-600 text-black rounded text-xs font-bold hover:bg-amber-500">Create Alert</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Dialog */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowTemplates(false)}>
          <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-lg p-4 w-80 max-w-[90vw] space-y-2" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-400 font-bold text-sm mb-2">Alert Templates</h3>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="w-full text-left px-3 py-2 rounded bg-[#12121f] border border-gray-800/40 hover:border-amber-700/40 transition-colors"
              >
                <span className="text-amber-300 text-[11px] font-medium">{t.name}</span>
                <p className="text-gray-500 text-[10px] mt-0.5">{t.frequency.replace(/_/g, ' ')} — {t.channels.join(', ')}</p>
              </button>
            ))}
            <button onClick={() => setShowTemplates(false)} className="w-full py-1.5 text-gray-500 text-[10px] hover:text-gray-300 mt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
