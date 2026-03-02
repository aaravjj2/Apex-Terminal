/**
 * alertsApi.ts
 * Alerts API client for creating, managing, and tracking price/indicator alerts,
 * triggered history, acknowledgement, and snoozing.
 */

import { apiClient, createWebSocket } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertCondition =
  | 'crosses_above'
  | 'crosses_below'
  | 'greater_than'
  | 'less_than'
  | 'percent_change_up'
  | 'percent_change_down'
  | 'enters_range'
  | 'exits_range'
  | 'volume_spike';

export type AlertField =
  | 'price'
  | 'bid'
  | 'ask'
  | 'volume'
  | 'rsi'
  | 'macd'
  | 'sma'
  | 'ema'
  | 'atr'
  | 'vwap'
  | 'open_interest'
  | 'implied_vol';

export type AlertFrequency = 'once' | 'once_per_bar' | 'every_time' | 'once_per_minute';
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'snoozed' | 'disabled';

export type NotificationChannel = 'app' | 'email' | 'sms' | 'push' | 'webhook';

export interface CreateAlertParams {
  symbol: string;
  field: AlertField;
  condition: AlertCondition;
  value: number;
  valueTo?: number;
  frequency: AlertFrequency;
  priority?: AlertPriority;
  message?: string;
  name?: string;
  expiresAt?: string;
  channels?: NotificationChannel[];
  webhookUrl?: string;
  timeframe?: string;
  indicatorParams?: Record<string, number>;
}

export interface UpdateAlertParams {
  field?: AlertField;
  condition?: AlertCondition;
  value?: number;
  valueTo?: number;
  frequency?: AlertFrequency;
  priority?: AlertPriority;
  message?: string;
  name?: string;
  expiresAt?: string;
  channels?: NotificationChannel[];
  webhookUrl?: string;
  enabled?: boolean;
}

export interface Alert {
  id: string;
  symbol: string;
  name: string;
  field: AlertField;
  condition: AlertCondition;
  value: number;
  valueTo: number | null;
  frequency: AlertFrequency;
  priority: AlertPriority;
  message: string;
  status: AlertStatus;
  channels: NotificationChannel[];
  webhookUrl: string | null;
  timeframe: string | null;
  indicatorParams: Record<string, number>;
  triggerCount: number;
  lastTriggeredAt: string | null;
  expiresAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertFilters {
  status?: AlertStatus | AlertStatus[];
  symbol?: string;
  priority?: AlertPriority;
  field?: AlertField;
  limit?: number;
  offset?: number;
}

export interface TriggeredAlert {
  id: string;
  alertId: string;
  symbol: string;
  alertName: string;
  field: AlertField;
  condition: AlertCondition;
  targetValue: number;
  actualValue: number;
  price: number;
  priority: AlertPriority;
  message: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  triggeredAt: string;
}

export type SnoozeDuration = '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | 'custom';

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  triggeredThisWeek: number;
  triggeredThisMonth: number;
  snoozedAlerts: number;
  expiredAlerts: number;
  disabledAlerts: number;
  topTriggeredSymbols: Array<{
    symbol: string;
    count: number;
  }>;
  triggersByPriority: Record<AlertPriority, number>;
  triggersByHour: number[];
  avgTriggersPerDay: number;
}

export interface AlertEvent {
  type: 'alert_triggered' | 'alert_expired' | 'alert_snoozed';
  alert: TriggeredAlert | Alert;
  timestamp: string;
}

export interface AlertSubscription {
  unsubscribe: () => void;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/alerts';

export async function createAlert(
  params: CreateAlertParams,
): Promise<Alert> {
  return apiClient.post<Alert>(`${BASE}`, params, {
    deduplicate: false,
  } as never);
}

export async function updateAlert(
  alertId: string,
  params: UpdateAlertParams,
): Promise<Alert> {
  return apiClient.patch<Alert>(`${BASE}/${alertId}`, params);
}

export async function deleteAlert(alertId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${alertId}`);
}

export async function getAlerts(
  filters?: AlertFilters,
): Promise<{ alerts: Alert[]; total: number }> {
  const q = filters
    ? qs({
        status: Array.isArray(filters.status) ? filters.status.join(',') : filters.status,
        symbol: filters.symbol,
        priority: filters.priority,
        field: filters.field,
        limit: filters.limit,
        offset: filters.offset,
      })
    : '';
  return apiClient.get(`${BASE}${q}`);
}

export async function getAlert(alertId: string): Promise<Alert> {
  return apiClient.get<Alert>(`${BASE}/${alertId}`);
}

export async function getTriggeredAlerts(
  since?: string,
  limit = 50,
  acknowledged?: boolean,
): Promise<{ triggered: TriggeredAlert[]; total: number }> {
  return apiClient.get(
    `${BASE}/triggered${qs({ since, limit, acknowledged })}`,
  );
}

export async function acknowledgeAlert(
  alertId: string,
): Promise<TriggeredAlert> {
  return apiClient.post<TriggeredAlert>(
    `${BASE}/triggered/${alertId}/acknowledge`,
    {},
  );
}

export async function acknowledgeAll(): Promise<{ count: number }> {
  return apiClient.post(`${BASE}/triggered/acknowledge-all`, {});
}

export async function snoozeAlert(
  alertId: string,
  duration: SnoozeDuration,
  customUntil?: string,
): Promise<Alert> {
  return apiClient.post<Alert>(
    `${BASE}/${alertId}/snooze`,
    { duration, custom_until: customUntil },
  );
}

export async function unsnoozeAlert(alertId: string): Promise<Alert> {
  return apiClient.post<Alert>(`${BASE}/${alertId}/unsnooze`, {});
}

export async function enableAlert(alertId: string): Promise<Alert> {
  return apiClient.patch<Alert>(`${BASE}/${alertId}`, { enabled: true });
}

export async function disableAlert(alertId: string): Promise<Alert> {
  return apiClient.patch<Alert>(`${BASE}/${alertId}`, { enabled: false });
}

export async function getAlertStats(): Promise<AlertStats> {
  return apiClient.get<AlertStats>(
    `${BASE}/stats`,
    { useCache: true, cacheTtlMs: 60_000 },
  );
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

export async function deleteAlerts(alertIds: string[]): Promise<{ deleted: number }> {
  return apiClient.post(`${BASE}/bulk-delete`, { alert_ids: alertIds });
}

export async function disableAlerts(alertIds: string[]): Promise<{ updated: number }> {
  return apiClient.post(`${BASE}/bulk-disable`, { alert_ids: alertIds });
}

// ─── WebSocket Subscription ───────────────────────────────────────────────────

export function subscribeAlerts(
  callback: (event: AlertEvent) => void,
): AlertSubscription {
  const ws = createWebSocket('/ws/alerts', {
    onMessage: (raw) => {
      callback(raw as AlertEvent);
    },
    onOpen: () => {
      ws.send({ action: 'subscribe' });
    },
    reconnectMs: 2000,
    maxReconnects: 15,
  });

  return {
    unsubscribe: () => {
      ws.send({ action: 'unsubscribe' });
      ws.close();
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function alertStatusColor(status: AlertStatus): string {
  const map: Record<AlertStatus, string> = {
    active: '#00d4aa',
    triggered: '#f59e0b',
    expired: '#6b7280',
    snoozed: '#8b5cf6',
    disabled: '#374151',
  };
  return map[status];
}

export function alertPriorityColor(priority: AlertPriority): string {
  const map: Record<AlertPriority, string> = {
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#f59e0b',
    critical: '#ef4444',
  };
  return map[priority];
}

export function conditionLabel(condition: AlertCondition): string {
  const map: Record<AlertCondition, string> = {
    crosses_above: 'Crosses Above',
    crosses_below: 'Crosses Below',
    greater_than: 'Greater Than',
    less_than: 'Less Than',
    percent_change_up: '% Change Up',
    percent_change_down: '% Change Down',
    enters_range: 'Enters Range',
    exits_range: 'Exits Range',
    volume_spike: 'Volume Spike',
  };
  return map[condition];
}

export function fieldLabel(field: AlertField): string {
  const map: Record<AlertField, string> = {
    price: 'Price',
    bid: 'Bid',
    ask: 'Ask',
    volume: 'Volume',
    rsi: 'RSI',
    macd: 'MACD',
    sma: 'SMA',
    ema: 'EMA',
    atr: 'ATR',
    vwap: 'VWAP',
    open_interest: 'Open Interest',
    implied_vol: 'Implied Vol',
  };
  return map[field];
}

export function snoozeDurationMs(duration: SnoozeDuration): number {
  const map: Record<Exclude<SnoozeDuration, 'custom'>, number> = {
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h': 60 * 60_000,
    '4h': 4 * 60 * 60_000,
    '1D': 24 * 60 * 60_000,
    '1W': 7 * 24 * 60 * 60_000,
  };
  return duration === 'custom' ? 0 : map[duration];
}
