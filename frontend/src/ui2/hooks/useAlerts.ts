/**
 * useAlerts — React hook wiring lib/social/notifications + custom alert logic → AlertsManagerUI2
 *
 * Provides: price alerts, indicator alerts, portfolio alerts, news sentiment alerts,
 * volume surge alerts, pattern recognition alerts, composite conditions,
 * notification management (push, email, SMS, webhook).
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'paused' | 'deleted';
export type AlertCategory = 'price' | 'indicator' | 'volume' | 'pattern' | 'portfolio' | 'news' | 'custom' | 'composite';
export type ComparisonOp = 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'inside_range' | 'outside_range' | 'pct_change_up' | 'pct_change_down';
export type NotificationChannel = 'push' | 'email' | 'sms' | 'webhook' | 'sound' | 'popup';

export interface AlertCondition {
  field: string;          // e.g. 'price', 'rsi', 'volume', 'macd_histogram'
  op: ComparisonOp;
  value: number;
  value2?: number;        // for range conditions
  timeframe?: string;     // e.g. '1D', '1h'
  lookback?: number;      // bars to look back
}

export interface Alert {
  id: string;
  name: string;
  symbol: string;
  category: AlertCategory;
  conditions: AlertCondition[];
  conditionLogic: 'AND' | 'OR';
  priority: AlertPriority;
  status: AlertStatus;
  channels: NotificationChannel[];
  message: string;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  expiresAt?: number;
  lastChecked?: number;
  triggerCount: number;
  maxTriggers: number;   // 0 = unlimited
  cooldownMs: number;    // prevent re-trigger for N ms
  tags: string[];
  notes: string;
}

export interface Notification {
  id: string;
  alertId: string;
  alertName: string;
  symbol: string;
  message: string;
  priority: AlertPriority;
  channel: NotificationChannel;
  timestamp: number;
  read: boolean;
  dismissed: boolean;
}

export interface AlertTemplate {
  id: string;
  name: string;
  category: AlertCategory;
  description: string;
  conditions: AlertCondition[];
  conditionLogic: 'AND' | 'OR';
  priority: AlertPriority;
  channels: NotificationChannel[];
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  criticalActive: number;
  byCategory: Record<AlertCategory, number>;
  byPriority: Record<AlertPriority, number>;
  mostTriggered: Array<{ alertId: string; name: string; count: number }>;
}

export interface AlertsState {
  /** All alerts */
  alerts: Alert[];
  /** Notification inbox */
  notifications: Notification[];
  /** Unread notification count */
  unreadCount: number;
  /** Alert templates / presets */
  templates: AlertTemplate[];
  /** Alert statistics */
  stats: AlertStats;
  /** Is checking alerts */
  isChecking: boolean;
  /** Global muting */
  isMuted: boolean;
  /** Sound enabled */
  soundEnabled: boolean;
  /** Active filter */
  filter: { category?: AlertCategory; priority?: AlertPriority; status?: AlertStatus; symbol?: string };
  /** Filtered alerts (computed) */
  filteredAlerts: Alert[];
}

export interface AlertActions {
  // ── CRUD ────
  createAlert: (alert: Omit<Alert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'triggerCount'>) => string;
  updateAlert: (id: string, patch: Partial<Alert>) => void;
  deleteAlert: (id: string) => void;
  duplicateAlert: (id: string) => string;

  // ── Status ────
  pauseAlert: (id: string) => void;
  resumeAlert: (id: string) => void;
  pauseAll: () => void;
  resumeAll: () => void;

  // ── Templates ────
  createFromTemplate: (templateId: string, symbol: string) => string;
  saveAsTemplate: (alertId: string, name: string) => void;

  // ── Quick Alerts ────
  quickPriceAlert: (symbol: string, op: ComparisonOp, price: number, channels?: NotificationChannel[]) => string;
  quickRSIAlert: (symbol: string, op: ComparisonOp, value: number) => string;
  quickVolumeAlert: (symbol: string, multiplier: number) => string;
  quickPatternAlert: (symbol: string, pattern: string) => string;
  quickPortfolioAlert: (metric: string, op: ComparisonOp, value: number) => string;

  // ── Checking ────
  checkAlerts: (marketData: Record<string, Record<string, number>>) => Notification[];
  checkSingleAlert: (alertId: string, data: Record<string, number>) => boolean;

  // ── Notifications ────
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
  dismissNotification: (notificationId: string) => void;
  clearNotifications: () => void;

  // ── Filtering ────
  setFilter: (filter: AlertsState['filter']) => void;
  clearFilter: () => void;

  // ── Settings ────
  toggleMute: () => void;
  toggleSound: () => void;

  // ── Stats ────
  computeStats: () => void;

  // ── Bulk ────
  bulkDelete: (ids: string[]) => void;
  bulkPause: (ids: string[]) => void;
  bulkResume: (ids: string[]) => void;
  exportAlerts: () => string;
  importAlerts: (json: string) => void;
}

// ── Alert Templates ──────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'tpl_price_breakout', name: 'Price Breakout', category: 'price',
    description: 'Alert when price crosses above a level',
    conditions: [{ field: 'price', op: 'crosses_above', value: 0 }],
    conditionLogic: 'AND', priority: 'high', channels: ['push', 'sound'],
  },
  {
    id: 'tpl_price_breakdown', name: 'Price Breakdown', category: 'price',
    description: 'Alert when price crosses below a level',
    conditions: [{ field: 'price', op: 'crosses_below', value: 0 }],
    conditionLogic: 'AND', priority: 'high', channels: ['push', 'sound'],
  },
  {
    id: 'tpl_rsi_overbought', name: 'RSI Overbought', category: 'indicator',
    description: 'Alert when RSI crosses above 70',
    conditions: [{ field: 'rsi', op: 'crosses_above', value: 70 }],
    conditionLogic: 'AND', priority: 'medium', channels: ['push'],
  },
  {
    id: 'tpl_rsi_oversold', name: 'RSI Oversold', category: 'indicator',
    description: 'Alert when RSI crosses below 30',
    conditions: [{ field: 'rsi', op: 'crosses_below', value: 30 }],
    conditionLogic: 'AND', priority: 'medium', channels: ['push'],
  },
  {
    id: 'tpl_macd_cross', name: 'MACD Cross', category: 'indicator',
    description: 'Alert on MACD signal line crossover',
    conditions: [{ field: 'macd_histogram', op: 'crosses_above', value: 0 }],
    conditionLogic: 'AND', priority: 'medium', channels: ['push'],
  },
  {
    id: 'tpl_volume_surge', name: 'Volume Surge', category: 'volume',
    description: 'Alert when volume exceeds 2x average',
    conditions: [{ field: 'volume_ratio', op: 'above', value: 2 }],
    conditionLogic: 'AND', priority: 'high', channels: ['push', 'sound'],
  },
  {
    id: 'tpl_bb_squeeze', name: 'Bollinger Squeeze', category: 'indicator',
    description: 'Alert when BB bandwidth is very narrow',
    conditions: [{ field: 'bb_bandwidth', op: 'below', value: 0.05 }],
    conditionLogic: 'AND', priority: 'low', channels: ['push'],
  },
  {
    id: 'tpl_gap_up', name: 'Gap Up >2%', category: 'price',
    description: 'Alert on gap up opening',
    conditions: [{ field: 'gap_pct', op: 'above', value: 2 }],
    conditionLogic: 'AND', priority: 'high', channels: ['push', 'sound'],
  },
  {
    id: 'tpl_portfolio_drawdown', name: 'Portfolio Drawdown', category: 'portfolio',
    description: 'Alert when portfolio drawdown exceeds threshold',
    conditions: [{ field: 'drawdown_pct', op: 'below', value: -5 }],
    conditionLogic: 'AND', priority: 'critical', channels: ['push', 'email', 'sound'],
  },
  {
    id: 'tpl_daily_loss', name: 'Daily Loss Limit', category: 'portfolio',
    description: 'Alert when daily loss exceeds limit',
    conditions: [{ field: 'daily_pnl', op: 'below', value: -10000 }],
    conditionLogic: 'AND', priority: 'critical', channels: ['push', 'email', 'sms', 'sound'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

let alertCounter = 0;
function genId(): string { return `alert_${++alertCounter}_${Date.now().toString(36)}`; }
let notifCounter = 0;
function genNotifId(): string { return `notif_${++notifCounter}_${Date.now().toString(36)}`; }

function evaluateCondition(cond: AlertCondition, data: Record<string, number>): boolean {
  const value = data[cond.field];
  if (value === undefined) return false;

  switch (cond.op) {
    case 'above': return value > cond.value;
    case 'below': return value < cond.value;
    case 'crosses_above': return value >= cond.value; // simplified
    case 'crosses_below': return value <= cond.value;
    case 'inside_range': return value >= cond.value && value <= (cond.value2 || cond.value);
    case 'outside_range': return value < cond.value || value > (cond.value2 || cond.value);
    case 'pct_change_up': return value >= cond.value;
    case 'pct_change_down': return value <= -cond.value;
    default: return false;
  }
}

function filterAlerts(alerts: Alert[], filter: AlertsState['filter']): Alert[] {
  return alerts.filter(a => {
    if (filter.category && a.category !== filter.category) return false;
    if (filter.priority && a.priority !== filter.priority) return false;
    if (filter.status && a.status !== filter.status) return false;
    if (filter.symbol && a.symbol !== filter.symbol) return false;
    return true;
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY_STATS: AlertStats = {
  totalAlerts: 0, activeAlerts: 0, triggeredToday: 0, criticalActive: 0,
  byCategory: { price: 0, indicator: 0, volume: 0, pattern: 0, portfolio: 0, news: 0, custom: 0, composite: 0 },
  byPriority: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  mostTriggered: [],
};

const INITIAL_STATE: AlertsState = {
  alerts: [],
  notifications: [],
  unreadCount: 0,
  templates: DEFAULT_TEMPLATES,
  stats: EMPTY_STATS,
  isChecking: false,
  isMuted: false,
  soundEnabled: true,
  filter: {},
  filteredAlerts: [],
};

export function useAlerts(): [AlertsState, AlertActions] {
  const [state, setState] = useState<AlertsState>(INITIAL_STATE);

  // Auto-compute filtered alerts
  useEffect(() => {
    const filtered = filterAlerts(state.alerts, state.filter);
    setState(prev => prev.filteredAlerts === filtered ? prev : { ...prev, filteredAlerts: filtered });
  }, [state.alerts, state.filter]);

  // ── CRUD ────

  const createAlert = useCallback((input: Omit<Alert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'triggerCount'>): string => {
    const id = genId();
    const now = Date.now();
    const alert: Alert = {
      ...input,
      id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      triggerCount: 0,
    };
    setState(prev => ({ ...prev, alerts: [...prev.alerts, alert] }));
    return id;
  }, []);

  const updateAlert = useCallback((id: string, patch: Partial<Alert>) => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a),
    }));
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(a => a.id !== id),
    }));
  }, []);

  const duplicateAlert = useCallback((id: string): string => {
    const original = state.alerts.find(a => a.id === id);
    if (!original) return '';
    return createAlert({
      ...original,
      name: `${original.name} (copy)`,
    });
  }, [state.alerts, createAlert]);

  // ── Status ────

  const pauseAlert = useCallback((id: string) => updateAlert(id, { status: 'paused' }), [updateAlert]);
  const resumeAlert = useCallback((id: string) => updateAlert(id, { status: 'active' }), [updateAlert]);

  const pauseAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => a.status === 'active' ? { ...a, status: 'paused' as const, updatedAt: Date.now() } : a),
    }));
  }, []);

  const resumeAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => a.status === 'paused' ? { ...a, status: 'active' as const, updatedAt: Date.now() } : a),
    }));
  }, []);

  // ── Templates ────

  const createFromTemplate = useCallback((templateId: string, symbol: string): string => {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return '';
    return createAlert({
      name: `${template.name} - ${symbol}`,
      symbol,
      category: template.category,
      conditions: template.conditions,
      conditionLogic: template.conditionLogic,
      priority: template.priority,
      channels: template.channels,
      message: `${template.name} triggered for ${symbol}`,
      maxTriggers: 0,
      cooldownMs: 60000,
      tags: [],
      notes: `Created from template: ${template.name}`,
    });
  }, [state.templates, createAlert]);

  const saveAsTemplate = useCallback((alertId: string, name: string) => {
    const alert = state.alerts.find(a => a.id === alertId);
    if (!alert) return;
    setState(prev => ({
      ...prev,
      templates: [...prev.templates, {
        id: `tpl_custom_${Date.now().toString(36)}`,
        name,
        category: alert.category,
        description: alert.notes || name,
        conditions: alert.conditions,
        conditionLogic: alert.conditionLogic,
        priority: alert.priority,
        channels: alert.channels,
      }],
    }));
  }, [state.alerts]);

  // ── Quick Alerts ────

  const quickPriceAlert = useCallback((symbol: string, op: ComparisonOp, price: number, channels?: NotificationChannel[]): string => {
    return createAlert({
      name: `Price ${op} $${price} - ${symbol}`,
      symbol,
      category: 'price',
      conditions: [{ field: 'price', op, value: price }],
      conditionLogic: 'AND',
      priority: 'high',
      channels: channels || ['push', 'sound'],
      message: `${symbol} price ${op} $${price}`,
      maxTriggers: 1,
      cooldownMs: 0,
      tags: ['quick'],
      notes: '',
    });
  }, [createAlert]);

  const quickRSIAlert = useCallback((symbol: string, op: ComparisonOp, value: number): string => {
    return createAlert({
      name: `RSI ${op} ${value} - ${symbol}`,
      symbol,
      category: 'indicator',
      conditions: [{ field: 'rsi', op, value }],
      conditionLogic: 'AND',
      priority: 'medium',
      channels: ['push'],
      message: `${symbol} RSI ${op} ${value}`,
      maxTriggers: 0,
      cooldownMs: 300000,
      tags: ['quick', 'rsi'],
      notes: '',
    });
  }, [createAlert]);

  const quickVolumeAlert = useCallback((symbol: string, multiplier: number): string => {
    return createAlert({
      name: `Volume ${multiplier}x Surge - ${symbol}`,
      symbol,
      category: 'volume',
      conditions: [{ field: 'volume_ratio', op: 'above', value: multiplier }],
      conditionLogic: 'AND',
      priority: 'high',
      channels: ['push', 'sound'],
      message: `${symbol} volume surged ${multiplier}x above average`,
      maxTriggers: 0,
      cooldownMs: 600000,
      tags: ['quick', 'volume'],
      notes: '',
    });
  }, [createAlert]);

  const quickPatternAlert = useCallback((symbol: string, pattern: string): string => {
    return createAlert({
      name: `${pattern} Pattern - ${symbol}`,
      symbol,
      category: 'pattern',
      conditions: [{ field: `pattern_${pattern.toLowerCase().replace(/\s+/g, '_')}`, op: 'above', value: 0.5 }],
      conditionLogic: 'AND',
      priority: 'medium',
      channels: ['push'],
      message: `${pattern} pattern detected on ${symbol}`,
      maxTriggers: 0,
      cooldownMs: 3600000,
      tags: ['quick', 'pattern'],
      notes: '',
    });
  }, [createAlert]);

  const quickPortfolioAlert = useCallback((metric: string, op: ComparisonOp, value: number): string => {
    return createAlert({
      name: `Portfolio ${metric} ${op} ${value}`,
      symbol: 'PORTFOLIO',
      category: 'portfolio',
      conditions: [{ field: metric, op, value }],
      conditionLogic: 'AND',
      priority: 'critical',
      channels: ['push', 'email', 'sound'],
      message: `Portfolio ${metric} ${op} ${value}`,
      maxTriggers: 0,
      cooldownMs: 1800000,
      tags: ['portfolio'],
      notes: '',
    });
  }, [createAlert]);

  // ── Checking ────

  const checkAlerts = useCallback((marketData: Record<string, Record<string, number>>): Notification[] => {
    if (state.isMuted) return [];
    const newNotifs: Notification[] = [];
    const now = Date.now();

    setState(prev => {
      const updatedAlerts = prev.alerts.map(alert => {
        if (alert.status !== 'active') return alert;
        if (alert.expiresAt && now > alert.expiresAt) return { ...alert, status: 'expired' as const };
        if (alert.maxTriggers > 0 && alert.triggerCount >= alert.maxTriggers) return alert;
        if (alert.triggeredAt && now - alert.triggeredAt < alert.cooldownMs) return alert;

        const data = marketData[alert.symbol];
        if (!data) return alert;

        const results = alert.conditions.map(c => evaluateCondition(c, data));
        const triggered = alert.conditionLogic === 'AND'
          ? results.every(Boolean)
          : results.some(Boolean);

        if (triggered) {
          for (const channel of alert.channels) {
            newNotifs.push({
              id: genNotifId(),
              alertId: alert.id,
              alertName: alert.name,
              symbol: alert.symbol,
              message: alert.message,
              priority: alert.priority,
              channel,
              timestamp: now,
              read: false,
              dismissed: false,
            });
          }
          return {
            ...alert,
            status: (alert.maxTriggers > 0 && alert.triggerCount + 1 >= alert.maxTriggers) ? 'triggered' as const : 'active' as const,
            triggeredAt: now,
            triggerCount: alert.triggerCount + 1,
            lastChecked: now,
          };
        }

        return { ...alert, lastChecked: now };
      });

      return {
        ...prev,
        alerts: updatedAlerts,
        notifications: [...prev.notifications, ...newNotifs],
        unreadCount: prev.unreadCount + newNotifs.filter(n => !n.read).length,
      };
    });

    return newNotifs;
  }, [state.isMuted]);

  const checkSingleAlert = useCallback((alertId: string, data: Record<string, number>): boolean => {
    const alert = state.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    const results = alert.conditions.map(c => evaluateCondition(c, data));
    return alert.conditionLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }, [state.alerts]);

  // ── Notifications ────

  const markRead = useCallback((nid: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === nid ? { ...n, read: true } : n),
      unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find(n => n.id === nid && !n.read) ? 1 : 0)),
    }));
  }, []);

  const markAllRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  }, []);

  const dismissNotification = useCallback((nid: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === nid ? { ...n, dismissed: true, read: true } : n),
      unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find(n => n.id === nid && !n.read) ? 1 : 0)),
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [], unreadCount: 0 }));
  }, []);

  // ── Filter ────

  const setFilter = useCallback((filter: AlertsState['filter']) => {
    setState(prev => ({ ...prev, filter }));
  }, []);

  const clearFilter = useCallback(() => {
    setState(prev => ({ ...prev, filter: {} }));
  }, []);

  // ── Settings ────

  const toggleMute = useCallback(() => { setState(prev => ({ ...prev, isMuted: !prev.isMuted })); }, []);
  const toggleSound = useCallback(() => { setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled })); }, []);

  // ── Stats ────

  const computeStats = useCallback(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const stats: AlertStats = {
      totalAlerts: state.alerts.length,
      activeAlerts: state.alerts.filter(a => a.status === 'active').length,
      triggeredToday: state.notifications.filter(n => n.timestamp >= todayStart).length,
      criticalActive: state.alerts.filter(a => a.priority === 'critical' && a.status === 'active').length,
      byCategory: { price: 0, indicator: 0, volume: 0, pattern: 0, portfolio: 0, news: 0, custom: 0, composite: 0 },
      byPriority: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      mostTriggered: [],
    };

    for (const a of state.alerts) {
      stats.byCategory[a.category]++;
      stats.byPriority[a.priority]++;
    }

    stats.mostTriggered = [...state.alerts]
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 10)
      .map(a => ({ alertId: a.id, name: a.name, count: a.triggerCount }));

    setState(prev => ({ ...prev, stats }));
  }, [state.alerts, state.notifications]);

  // ── Bulk ────

  const bulkDelete = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setState(prev => ({ ...prev, alerts: prev.alerts.filter(a => !idSet.has(a.id)) }));
  }, []);

  const bulkPause = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => idSet.has(a.id) ? { ...a, status: 'paused' as const } : a),
    }));
  }, []);

  const bulkResume = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => idSet.has(a.id) && a.status === 'paused' ? { ...a, status: 'active' as const } : a),
    }));
  }, []);

  const exportAlerts = useCallback((): string => {
    return JSON.stringify({ alerts: state.alerts, templates: state.templates }, null, 2);
  }, [state.alerts, state.templates]);

  const importAlerts = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (data.alerts) {
        setState(prev => ({ ...prev, alerts: [...prev.alerts, ...data.alerts] }));
      }
      if (data.templates) {
        setState(prev => ({ ...prev, templates: [...prev.templates, ...data.templates] }));
      }
    } catch { /* import failed */ }
  }, []);

  const actions: AlertActions = useMemo(() => ({
    createAlert, updateAlert, deleteAlert, duplicateAlert,
    pauseAlert, resumeAlert, pauseAll, resumeAll,
    createFromTemplate, saveAsTemplate,
    quickPriceAlert, quickRSIAlert, quickVolumeAlert, quickPatternAlert, quickPortfolioAlert,
    checkAlerts, checkSingleAlert,
    markRead, markAllRead, dismissNotification, clearNotifications,
    setFilter, clearFilter,
    toggleMute, toggleSound,
    computeStats,
    bulkDelete, bulkPause, bulkResume, exportAlerts, importAlerts,
  }), [
    createAlert, updateAlert, deleteAlert, duplicateAlert,
    pauseAlert, resumeAlert, pauseAll, resumeAll,
    createFromTemplate, saveAsTemplate,
    quickPriceAlert, quickRSIAlert, quickVolumeAlert, quickPatternAlert, quickPortfolioAlert,
    checkAlerts, checkSingleAlert,
    markRead, markAllRead, dismissNotification, clearNotifications,
    setFilter, clearFilter,
    toggleMute, toggleSound,
    computeStats,
    bulkDelete, bulkPause, bulkResume, exportAlerts, importAlerts,
  ]);

  return [state, actions];
}
