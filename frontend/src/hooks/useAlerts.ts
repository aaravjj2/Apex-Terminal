/**
 * useAlerts.ts
 * Alert management hook with create/delete/modify, real-time evaluation,
 * notification dispatch, sound management, alert history, and bulk operations.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AlertCondition = 'crosses_above' | 'crosses_below' | 'greater_than' | 'less_than'
  | 'equals' | 'pct_change_up' | 'pct_change_down' | 'volume_spike' | 'new_high' | 'new_low';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'disabled';
export type AlertFrequency = 'once' | 'every_time' | 'once_per_bar';
export type AlertSound = 'default' | 'bell' | 'chime' | 'alert' | 'warning' | 'none';

export interface Alert {
  id: string;
  name: string;
  symbol: string;
  field: string;
  condition: AlertCondition;
  threshold: number;
  threshold2?: number;
  frequency: AlertFrequency;
  status: AlertStatus;
  sound: AlertSound;
  message?: string;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  triggerCount: number;
  tags?: string[];
}

export interface AlertNotification {
  id: string;
  alertId: string;
  symbol: string;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  read: boolean;
  dismissed: boolean;
}

export interface AlertHistoryEntry {
  alertId: string;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  currentValue: number;
  timestamp: number;
}

export interface CreateAlertRequest {
  name: string;
  symbol: string;
  field?: string;
  condition: AlertCondition;
  threshold: number;
  threshold2?: number;
  frequency?: AlertFrequency;
  sound?: AlertSound;
  message?: string;
  expiresAt?: number;
  tags?: string[];
}

export interface UseAlertsOptions {
  storageKey?: string;
  maxHistory?: number;
  evaluationIntervalMs?: number;
  onTriggered?: (alert: Alert, notification: AlertNotification) => void;
  onError?: (error: string) => void;
  soundEnabled?: boolean;
  getCurrentPrice?: (symbol: string) => number | null;
}

// ─── Sound Playback ────────────────────────────────────────────────────────────

const SOUND_FREQUENCIES: Record<AlertSound, number[]> = {
  default: [440, 880],
  bell: [523, 659, 784],
  chime: [440, 554, 659],
  alert: [880, 440, 880],
  warning: [220, 220, 440],
  none: [],
};

function playAlertSound(sound: AlertSound): void {
  if (sound === 'none' || typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const freqs = SOUND_FREQUENCIES[sound];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 * (i + 1) + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.15 * i);
      osc.stop(ctx.currentTime + 0.15 * (i + 1) + 0.1);
    });
  } catch { /* audio not available */ }
}

// ─── Condition Evaluation ──────────────────────────────────────────────────────

function evaluateCondition(
  condition: AlertCondition,
  currentValue: number,
  threshold: number,
  previousValue?: number
): boolean {
  switch (condition) {
    case 'crosses_above': return previousValue !== undefined && previousValue <= threshold && currentValue > threshold;
    case 'crosses_below': return previousValue !== undefined && previousValue >= threshold && currentValue < threshold;
    case 'greater_than': return currentValue > threshold;
    case 'less_than': return currentValue < threshold;
    case 'equals': return Math.abs(currentValue - threshold) < 0.001;
    case 'pct_change_up': return previousValue !== undefined && previousValue > 0 && ((currentValue - previousValue) / previousValue) * 100 >= threshold;
    case 'pct_change_down': return previousValue !== undefined && previousValue > 0 && ((previousValue - currentValue) / previousValue) * 100 >= threshold;
    case 'volume_spike': return currentValue > threshold;
    case 'new_high': return currentValue > threshold;
    case 'new_low': return currentValue < threshold;
    default: return false;
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAlerts(options: UseAlertsOptions = {}) {
  const {
    storageKey = 'apex_alerts',
    maxHistory = 500,
    evaluationIntervalMs = 1000,
    onTriggered,
    onError,
    soundEnabled = true,
    getCurrentPrice,
  } = options;

  const [alerts, setAlerts] = useState<Map<string, Alert>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const arr: Alert[] = JSON.parse(stored);
        return new Map(arr.map(a => [a.id, a]));
      }
    } catch {}
    return new Map();
  });

  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const previousValuesRef = useRef<Map<string, number>>(new Map());
  const evalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persistAlerts = useCallback((alertMap: Map<string, Alert>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(alertMap.values())));
    } catch {}
  }, [storageKey]);

  const createAlert = useCallback((request: CreateAlertRequest): Alert => {
    const alert: Alert = {
      id: `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: request.name,
      symbol: request.symbol,
      field: request.field ?? 'price',
      condition: request.condition,
      threshold: request.threshold,
      threshold2: request.threshold2,
      frequency: request.frequency ?? 'once',
      status: 'active',
      sound: request.sound ?? 'default',
      message: request.message,
      expiresAt: request.expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      triggerCount: 0,
      tags: request.tags,
    };

    setAlerts(prev => {
      const next = new Map(prev).set(alert.id, alert);
      persistAlerts(next);
      return next;
    });
    return alert;
  }, [persistAlerts]);

  const deleteAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const next = new Map(prev);
      next.delete(id);
      persistAlerts(next);
      return next;
    });
  }, [persistAlerts]);

  const modifyAlert = useCallback((id: string, updates: Partial<CreateAlertRequest>) => {
    setAlerts(prev => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: Date.now() };
        next.set(id, updated);
        persistAlerts(next);
      }
      return next;
    });
  }, [persistAlerts]);

  const toggleAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const next = new Map(prev);
      const alert = next.get(id);
      if (alert) {
        next.set(id, { ...alert, status: alert.status === 'active' ? 'disabled' : 'active', updatedAt: Date.now() });
        persistAlerts(next);
      }
      return next;
    });
  }, [persistAlerts]);

  const triggerAlert = useCallback((alert: Alert, currentValue: number) => {
    const notification: AlertNotification = {
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      alertId: alert.id,
      symbol: alert.symbol,
      message: alert.message ?? `${alert.symbol} ${alert.condition} ${alert.threshold} (current: ${currentValue.toFixed(2)})`,
      currentValue,
      threshold: alert.threshold,
      timestamp: Date.now(),
      read: false,
      dismissed: false,
    };

    setNotifications(prev => [notification, ...prev].slice(0, 100));
    setHistory(prev => [{
      alertId: alert.id, symbol: alert.symbol, condition: alert.condition,
      threshold: alert.threshold, currentValue, timestamp: Date.now(),
    }, ...prev].slice(0, maxHistory));

    if (soundEnabled) playAlertSound(alert.sound);
    onTriggered?.(alert, notification);

    setAlerts(prev => {
      const next = new Map(prev);
      const a = next.get(alert.id);
      if (a) {
        const shouldDisable = a.frequency === 'once';
        next.set(a.id, {
          ...a,
          triggerCount: a.triggerCount + 1,
          triggeredAt: Date.now(),
          updatedAt: Date.now(),
          status: shouldDisable ? 'triggered' : 'active',
        });
        persistAlerts(next);
      }
      return next;
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`Alert: ${alert.symbol}`, { body: notification.message, icon: '/favicon.ico' });
    }
  }, [maxHistory, soundEnabled, onTriggered, persistAlerts]);

  // ── Evaluation Loop ──

  const evaluate = useCallback(() => {
    if (!getCurrentPrice) return;

    alerts.forEach(alert => {
      if (alert.status !== 'active') return;
      if (alert.expiresAt && Date.now() > alert.expiresAt) {
        setAlerts(prev => {
          const next = new Map(prev);
          next.set(alert.id, { ...alert, status: 'expired', updatedAt: Date.now() });
          persistAlerts(next);
          return next;
        });
        return;
      }

      const currentValue = getCurrentPrice(alert.symbol);
      if (currentValue === null) return;

      const previousValue = previousValuesRef.current.get(`${alert.id}:${alert.symbol}`);
      const triggered = evaluateCondition(alert.condition, currentValue, alert.threshold, previousValue);
      previousValuesRef.current.set(`${alert.id}:${alert.symbol}`, currentValue);

      if (triggered) triggerAlert(alert, currentValue);
    });
  }, [alerts, getCurrentPrice, triggerAlert, persistAlerts]);

  useEffect(() => {
    if (!getCurrentPrice) return;
    evalTimerRef.current = setInterval(evaluate, evaluationIntervalMs);
    return () => {
      if (evalTimerRef.current) clearInterval(evalTimerRef.current);
    };
  }, [evaluate, evaluationIntervalMs, getCurrentPrice]);

  // ── Notification Management ──

  const markRead = useCallback((notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  }, []);

  const dismissNotification = useCallback((notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, dismissed: true } : n));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // ── Bulk Operations ──

  const bulkDelete = useCallback((ids: string[]) => {
    setAlerts(prev => {
      const next = new Map(prev);
      ids.forEach(id => next.delete(id));
      persistAlerts(next);
      return next;
    });
  }, [persistAlerts]);

  const bulkToggle = useCallback((ids: string[], enabled: boolean) => {
    setAlerts(prev => {
      const next = new Map(prev);
      ids.forEach(id => {
        const alert = next.get(id);
        if (alert) next.set(id, { ...alert, status: enabled ? 'active' : 'disabled', updatedAt: Date.now() });
      });
      persistAlerts(next);
      return next;
    });
  }, [persistAlerts]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const alertList = useMemo(() => Array.from(alerts.values()), [alerts]);
  const activeAlerts = useMemo(() => alertList.filter(a => a.status === 'active'), [alertList]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.read && !n.dismissed).length, [notifications]);

  return {
    alerts: alertList,
    activeAlerts,
    notifications: notifications.filter(n => !n.dismissed),
    history,
    unreadCount,
    createAlert, deleteAlert, modifyAlert, toggleAlert,
    markRead, dismissNotification, clearNotifications, markAllRead,
    bulkDelete, bulkToggle,
    requestNotificationPermission,
  };
}

export default useAlerts;
