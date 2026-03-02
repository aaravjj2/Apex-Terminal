import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AlertConditionType =
  | 'price_above'
  | 'price_below'
  | 'price_crossing_up'
  | 'price_crossing_down'
  | 'percent_change_up'
  | 'percent_change_down'
  | 'volume_above'
  | 'volume_spike'
  | 'indicator_crossing'
  | 'indicator_above'
  | 'indicator_below'
  | 'moving_average_cross'
  | 'rsi_overbought'
  | 'rsi_oversold'
  | 'macd_cross'
  | 'new_high'
  | 'new_low'
  | 'gap_up'
  | 'gap_down'
  | 'custom';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus = 'active' | 'triggered' | 'snoozed' | 'expired' | 'disabled';

export type AlertNotificationMethod = 'popup' | 'sound' | 'email' | 'sms' | 'webhook' | 'push';

export type AlertFrequency = 'once' | 'once_per_bar' | 'every_time' | 'once_per_minute';

export interface AlertCondition {
  type: AlertConditionType;
  value: number;
  secondaryValue?: number;
  indicator?: string;
  indicatorParams?: Record<string, number>;
  timeframe?: string;
  comparisonSymbol?: string;
  customExpression?: string;
}

export interface AlertSound {
  id: string;
  name: string;
  url: string;
  volume: number;
  duration: number;
}

export interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: AlertCondition;
  priority: AlertPriority;
  status: AlertStatus;
  frequency: AlertFrequency;

  notificationMethods: AlertNotificationMethod[];
  sound: string | null;
  message: string;
  webhookUrl?: string;

  triggerCount: number;
  maxTriggers: number;
  lastTriggeredAt: number | null;
  snoozedUntil: number | null;

  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;

  tags: string[];
  notes: string;
}

export interface TriggeredAlert {
  id: string;
  alertId: string;
  alertName: string;
  symbol: string;
  condition: AlertCondition;
  priority: AlertPriority;
  triggeredAt: number;
  priceAtTrigger: number;
  message: string;
  acknowledged: boolean;
  acknowledgedAt: number | null;
}

export interface AlertStats {
  totalActive: number;
  totalTriggered: number;
  totalSnoozed: number;
  triggeredToday: number;
  triggeredThisWeek: number;
  mostTriggeredSymbol: string;
  avgTriggersPerDay: number;
}

export interface SoundConfig {
  masterVolume: number;
  mutedAll: boolean;
  sounds: Record<AlertPriority, string>;
  customSounds: AlertSound[];
}

// ─── Store State ────────────────────────────────────────────────────────────

interface AlertStoreState {
  alerts: Record<string, Alert>;
  triggeredAlerts: TriggeredAlert[];
  stats: AlertStats;
  soundConfig: SoundConfig;

  filterSymbol: string | null;
  filterStatus: AlertStatus | 'all';
  filterPriority: AlertPriority | 'all';
  searchQuery: string;

  unacknowledgedCount: number;
  lastEvaluationTime: number;
  isEvaluating: boolean;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_SOUND_CONFIG: SoundConfig = {
  masterVolume: 0.7,
  mutedAll: false,
  sounds: {
    low: 'ding',
    medium: 'chime',
    high: 'alert',
    critical: 'alarm',
  },
  customSounds: [],
};

function computeStats(alerts: Record<string, Alert>, triggered: TriggeredAlert[]): AlertStats {
  const all = Object.values(alerts);
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = todayStart - 6 * 86_400_000;

  const triggeredToday = triggered.filter((t) => t.triggeredAt >= todayStart).length;
  const triggeredThisWeek = triggered.filter((t) => t.triggeredAt >= weekStart).length;

  const symbolCounts = new Map<string, number>();
  for (const t of triggered) {
    symbolCounts.set(t.symbol, (symbolCounts.get(t.symbol) ?? 0) + 1);
  }
  let mostTriggeredSymbol = '';
  let maxCount = 0;
  for (const [sym, count] of symbolCounts) {
    if (count > maxCount) { maxCount = count; mostTriggeredSymbol = sym; }
  }

  const daysActive = triggered.length > 0
    ? Math.max(1, (now - Math.min(...triggered.map((t) => t.triggeredAt))) / 86_400_000)
    : 1;

  return {
    totalActive: all.filter((a) => a.status === 'active').length,
    totalTriggered: triggered.length,
    totalSnoozed: all.filter((a) => a.status === 'snoozed').length,
    triggeredToday,
    triggeredThisWeek,
    mostTriggeredSymbol,
    avgTriggersPerDay: triggered.length / daysActive,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

interface AlertStoreActions {
  createAlert: (params: {
    name: string;
    symbol: string;
    condition: AlertCondition;
    priority?: AlertPriority;
    frequency?: AlertFrequency;
    notificationMethods?: AlertNotificationMethod[];
    sound?: string | null;
    message?: string;
    maxTriggers?: number;
    expiresAt?: number | null;
    tags?: string[];
    notes?: string;
    webhookUrl?: string;
  }) => string;
  updateAlert: (alertId: string, updates: Partial<Omit<Alert, 'id' | 'createdAt'>>) => void;
  deleteAlert: (alertId: string) => void;
  deleteAllAlerts: (symbol?: string) => void;
  enableAlert: (alertId: string) => void;
  disableAlert: (alertId: string) => void;
  duplicateAlert: (alertId: string) => string | null;

  acknowledgeAlert: (triggeredAlertId: string) => void;
  acknowledgeAll: () => void;
  dismissTriggered: (triggeredAlertId: string) => void;
  clearTriggeredHistory: () => void;

  snoozeAlert: (alertId: string, durationMs: number) => void;
  unsnoozeAlert: (alertId: string) => void;

  evaluateAlerts: (marketData: Map<string, { price: number; volume: number; previousClose: number; high52w: number; low52w: number }>) => TriggeredAlert[];

  setFilterSymbol: (symbol: string | null) => void;
  setFilterStatus: (status: AlertStatus | 'all') => void;
  setFilterPriority: (priority: AlertPriority | 'all') => void;
  setSearchQuery: (query: string) => void;

  muteAll: () => void;
  unmuteAll: () => void;
  setMasterVolume: (volume: number) => void;
  setPrioritySound: (priority: AlertPriority, soundId: string) => void;
  addCustomSound: (sound: Omit<AlertSound, 'id'>) => string;
  removeCustomSound: (soundId: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAlertStore = create<AlertStoreState & AlertStoreActions>()(
  immer((set, get) => ({
    alerts: {},
    triggeredAlerts: [],
    stats: { totalActive: 0, totalTriggered: 0, totalSnoozed: 0, triggeredToday: 0, triggeredThisWeek: 0, mostTriggeredSymbol: '', avgTriggersPerDay: 0 },
    soundConfig: DEFAULT_SOUND_CONFIG,
    filterSymbol: null,
    filterStatus: 'all',
    filterPriority: 'all',
    searchQuery: '',
    unacknowledgedCount: 0,
    lastEvaluationTime: 0,
    isEvaluating: false,

    createAlert: (params) => {
      const id = generateId('alert');
      const now = Date.now();
      const alert: Alert = {
        id,
        name: params.name,
        symbol: params.symbol,
        condition: params.condition,
        priority: params.priority ?? 'medium',
        status: 'active',
        frequency: params.frequency ?? 'once',
        notificationMethods: params.notificationMethods ?? ['popup', 'sound'],
        sound: params.sound ?? null,
        message: params.message ?? `${params.symbol}: ${params.condition.type} ${params.condition.value}`,
        webhookUrl: params.webhookUrl,
        triggerCount: 0,
        maxTriggers: params.maxTriggers ?? (params.frequency === 'once' ? 1 : 0),
        lastTriggeredAt: null,
        snoozedUntil: null,
        expiresAt: params.expiresAt ?? null,
        createdAt: now,
        updatedAt: now,
        tags: params.tags ?? [],
        notes: params.notes ?? '',
      };

      set((s) => {
        s.alerts[id] = alert;
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
      return id;
    },

    updateAlert: (alertId, updates) => {
      set((s) => {
        const alert = s.alerts[alertId];
        if (!alert) return;
        Object.assign(alert, updates, { updatedAt: Date.now() });
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    deleteAlert: (alertId) => {
      set((s) => {
        delete s.alerts[alertId];
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    deleteAllAlerts: (symbol) => {
      set((s) => {
        if (symbol) {
          for (const [id, alert] of Object.entries(s.alerts)) {
            if (alert.symbol === symbol) delete s.alerts[id];
          }
        } else {
          s.alerts = {};
        }
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    enableAlert: (alertId) => {
      set((s) => {
        const alert = s.alerts[alertId];
        if (alert) { alert.status = 'active'; alert.updatedAt = Date.now(); }
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    disableAlert: (alertId) => {
      set((s) => {
        const alert = s.alerts[alertId];
        if (alert) { alert.status = 'disabled'; alert.updatedAt = Date.now(); }
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    duplicateAlert: (alertId) => {
      const source = get().alerts[alertId];
      if (!source) return null;
      return get().createAlert({
        name: `${source.name} (copy)`,
        symbol: source.symbol,
        condition: { ...source.condition },
        priority: source.priority,
        frequency: source.frequency,
        notificationMethods: [...source.notificationMethods],
        sound: source.sound,
        message: source.message,
        maxTriggers: source.maxTriggers,
        expiresAt: source.expiresAt,
        tags: [...source.tags],
        notes: source.notes,
      });
    },

    acknowledgeAlert: (triggeredAlertId) => {
      set((s) => {
        const ta = s.triggeredAlerts.find((t) => t.id === triggeredAlertId);
        if (ta && !ta.acknowledged) {
          ta.acknowledged = true;
          ta.acknowledgedAt = Date.now();
          s.unacknowledgedCount = Math.max(0, s.unacknowledgedCount - 1);
        }
      });
    },

    acknowledgeAll: () => {
      set((s) => {
        const now = Date.now();
        for (const ta of s.triggeredAlerts) {
          if (!ta.acknowledged) {
            ta.acknowledged = true;
            ta.acknowledgedAt = now;
          }
        }
        s.unacknowledgedCount = 0;
      });
    },

    dismissTriggered: (triggeredAlertId) => {
      set((s) => {
        const idx = s.triggeredAlerts.findIndex((t) => t.id === triggeredAlertId);
        if (idx !== -1) {
          if (!s.triggeredAlerts[idx].acknowledged) s.unacknowledgedCount = Math.max(0, s.unacknowledgedCount - 1);
          s.triggeredAlerts.splice(idx, 1);
        }
      });
    },

    clearTriggeredHistory: () => {
      set((s) => {
        s.triggeredAlerts = [];
        s.unacknowledgedCount = 0;
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    snoozeAlert: (alertId, durationMs) => {
      set((s) => {
        const alert = s.alerts[alertId];
        if (alert) {
          alert.status = 'snoozed';
          alert.snoozedUntil = Date.now() + durationMs;
          alert.updatedAt = Date.now();
        }
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    unsnoozeAlert: (alertId) => {
      set((s) => {
        const alert = s.alerts[alertId];
        if (alert && alert.status === 'snoozed') {
          alert.status = 'active';
          alert.snoozedUntil = null;
          alert.updatedAt = Date.now();
        }
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });
    },

    evaluateAlerts: (marketData) => {
      const state = get();
      const now = Date.now();
      const triggered: TriggeredAlert[] = [];

      set((s) => { s.isEvaluating = true; });

      for (const alert of Object.values(state.alerts)) {
        if (alert.status !== 'active') continue;
        if (alert.expiresAt && now > alert.expiresAt) {
          set((s) => { if (s.alerts[alert.id]) s.alerts[alert.id].status = 'expired'; });
          continue;
        }
        if (alert.maxTriggers > 0 && alert.triggerCount >= alert.maxTriggers) continue;

        const data = marketData.get(alert.symbol);
        if (!data) continue;

        const isTriggered = evaluateCondition(alert.condition, data);
        if (!isTriggered) continue;

        const ta: TriggeredAlert = {
          id: generateId('trig'),
          alertId: alert.id,
          alertName: alert.name,
          symbol: alert.symbol,
          condition: alert.condition,
          priority: alert.priority,
          triggeredAt: now,
          priceAtTrigger: data.price,
          message: alert.message,
          acknowledged: false,
          acknowledgedAt: null,
        };
        triggered.push(ta);

        set((s) => {
          const a = s.alerts[alert.id];
          if (!a) return;
          a.triggerCount++;
          a.lastTriggeredAt = now;
          if (a.frequency === 'once' || (a.maxTriggers > 0 && a.triggerCount >= a.maxTriggers)) {
            a.status = 'triggered';
          }
          s.triggeredAlerts.unshift(ta);
          s.unacknowledgedCount++;
        });
      }

      set((s) => {
        s.lastEvaluationTime = now;
        s.isEvaluating = false;
        s.stats = computeStats(s.alerts, s.triggeredAlerts);
      });

      return triggered;
    },

    setFilterSymbol: (symbol) => set((s) => { s.filterSymbol = symbol; }),
    setFilterStatus: (status) => set((s) => { s.filterStatus = status; }),
    setFilterPriority: (priority) => set((s) => { s.filterPriority = priority; }),
    setSearchQuery: (query) => set((s) => { s.searchQuery = query; }),

    muteAll: () => set((s) => { s.soundConfig.mutedAll = true; }),
    unmuteAll: () => set((s) => { s.soundConfig.mutedAll = false; }),
    setMasterVolume: (volume) => set((s) => { s.soundConfig.masterVolume = Math.max(0, Math.min(1, volume)); }),

    setPrioritySound: (priority, soundId) => {
      set((s) => { s.soundConfig.sounds[priority] = soundId; });
    },

    addCustomSound: (sound) => {
      const id = generateId('snd');
      set((s) => { s.soundConfig.customSounds.push({ ...sound, id }); });
      return id;
    },

    removeCustomSound: (soundId) => {
      set((s) => {
        s.soundConfig.customSounds = s.soundConfig.customSounds.filter((snd) => snd.id !== soundId);
      });
    },
  })),
);

// ─── Evaluation Engine ──────────────────────────────────────────────────────

function evaluateCondition(
  condition: AlertCondition,
  data: { price: number; volume: number; previousClose: number; high52w: number; low52w: number },
): boolean {
  switch (condition.type) {
    case 'price_above':
      return data.price > condition.value;
    case 'price_below':
      return data.price < condition.value;
    case 'price_crossing_up':
      return data.previousClose <= condition.value && data.price > condition.value;
    case 'price_crossing_down':
      return data.previousClose >= condition.value && data.price < condition.value;
    case 'percent_change_up': {
      const changePct = ((data.price - data.previousClose) / data.previousClose) * 100;
      return changePct >= condition.value;
    }
    case 'percent_change_down': {
      const changePct = ((data.previousClose - data.price) / data.previousClose) * 100;
      return changePct >= condition.value;
    }
    case 'volume_above':
      return data.volume > condition.value;
    case 'volume_spike':
      return data.volume > condition.value * (condition.secondaryValue ?? 2);
    case 'new_high':
      return data.price >= data.high52w;
    case 'new_low':
      return data.price <= data.low52w;
    case 'gap_up':
      return data.price > data.previousClose * (1 + (condition.value / 100));
    case 'gap_down':
      return data.price < data.previousClose * (1 - (condition.value / 100));
    case 'rsi_overbought':
      return condition.value >= (condition.secondaryValue ?? 70);
    case 'rsi_oversold':
      return condition.value <= (condition.secondaryValue ?? 30);
    default:
      return false;
  }
}

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectAlertsList = (s: AlertStoreState) => Object.values(s.alerts);

export const selectActiveAlerts = (s: AlertStoreState) =>
  Object.values(s.alerts).filter((a) => a.status === 'active');

export const selectAlertsBySymbol = (symbol: string) => (s: AlertStoreState) =>
  Object.values(s.alerts).filter((a) => a.symbol === symbol);

export const selectFilteredAlerts = (s: AlertStoreState) => {
  let alerts = Object.values(s.alerts);
  if (s.filterSymbol) alerts = alerts.filter((a) => a.symbol === s.filterSymbol);
  if (s.filterStatus !== 'all') alerts = alerts.filter((a) => a.status === s.filterStatus);
  if (s.filterPriority !== 'all') alerts = alerts.filter((a) => a.priority === s.filterPriority);
  if (s.searchQuery) {
    const q = s.searchQuery.toLowerCase();
    alerts = alerts.filter(
      (a) => a.name.toLowerCase().includes(q)
        || a.symbol.toLowerCase().includes(q)
        || a.message.toLowerCase().includes(q),
    );
  }
  return alerts;
};

export const selectUnacknowledgedTriggered = (s: AlertStoreState) =>
  s.triggeredAlerts.filter((t) => !t.acknowledged);

export const selectTriggeredByPriority = (priority: AlertPriority) => (s: AlertStoreState) =>
  s.triggeredAlerts.filter((t) => t.priority === priority);

export const selectCriticalAlerts = (s: AlertStoreState) =>
  s.triggeredAlerts.filter((t) => t.priority === 'critical' && !t.acknowledged);
