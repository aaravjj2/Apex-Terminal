# Alert System

Configurable alert engine with price, indicator, volume, and pattern conditions, multi-channel notifications, alert history, recurring alerts, and reusable templates.

## Table of Contents

- [Overview](#overview)
- [Alert Conditions](#alert-conditions)
- [Notification Channels](#notification-channels)
- [AlertsManager Component](#alertsmanager-component)
- [Alert History](#alert-history)
- [Recurring Alerts](#recurring-alerts)
- [Alert Templates](#alert-templates)
- [Store Integration](#store-integration)

## Overview

The alert system provides real-time monitoring of market conditions with instant notification delivery. The `alertStore` manages alert lifecycle, and the `AlertsManager` component offers a full management UI.

```typescript
import { useAlertStore } from '@/stores/alertStore';
import { AlertsManager } from '@/components/trading/AlertsManager';

const { createAlert, activeAlerts, triggeredAlerts } = useAlertStore();
```

## Alert Conditions

Alerts support multiple condition types that can be combined with logical operators:

### Price Alerts

```typescript
createAlert({
  symbol: 'AAPL',
  condition: {
    type: 'price',
    operator: 'crosses_above',  // 'gt' | 'lt' | 'gte' | 'lte' | 'crosses_above' | 'crosses_below'
    value: 200,
    field: 'last',              // 'last' | 'bid' | 'ask' | 'mid' | 'vwap'
  },
  notification: { channels: ['sound', 'push'] },
});
```

### Indicator Alerts

```typescript
createAlert({
  symbol: 'TSLA',
  condition: {
    type: 'indicator',
    indicator: 'rsi',
    params: { period: 14 },
    operator: 'lte',
    value: 30,
  },
  message: 'TSLA RSI oversold — potential bounce setup',
});
```

### Volume Alerts

```typescript
createAlert({
  symbol: 'NVDA',
  condition: {
    type: 'volume',
    metric: 'relative',         // 'absolute' | 'relative' (vs 20d avg)
    operator: 'gte',
    value: 3.0,                 // 3x average volume
  },
});
```

### Pattern Alerts

```typescript
createAlert({
  symbol: 'MSFT',
  condition: {
    type: 'pattern',
    pattern: 'double-bottom',
    timeframe: '1D',
    completionThreshold: 0.9,
  },
});
```

### Compound Conditions

```typescript
createAlert({
  symbol: 'AMZN',
  condition: {
    type: 'compound',
    operator: 'AND',
    conditions: [
      { type: 'price', operator: 'crosses_above', value: 190, field: 'last' },
      { type: 'volume', metric: 'relative', operator: 'gte', value: 1.5 },
      { type: 'indicator', indicator: 'macd', params: {}, operator: 'gt', value: 0 },
    ],
  },
});
```

## Notification Channels

Alerts deliver through multiple channels simultaneously:

```typescript
interface NotificationConfig {
  channels: ('sound' | 'push' | 'email' | 'webhook')[];
  sound?: {
    tone: 'default' | 'urgent' | 'subtle' | 'custom';
    customUrl?: string;
    volume: number;
  };
  push?: {
    title?: string;
    priority: 'normal' | 'high';
  };
  email?: {
    address: string;
    includeChart: boolean;
  };
  webhook?: {
    url: string;
    method: 'POST' | 'GET';
    headers?: Record<string, string>;
    bodyTemplate?: string;   // Mustache-style template with {{symbol}}, {{price}}, etc.
  };
}
```

Webhook integration enables Slack, Discord, Telegram, and custom system notifications via HTTP callbacks.

## AlertsManager Component

The `AlertsManager` component provides the full alert management interface:

```tsx
<AlertsManager
  defaultSymbol="AAPL"
  showHistory={true}
  maxVisible={50}
  groupBy="symbol"          // 'symbol' | 'type' | 'status' | 'none'
  onAlertTriggered={(alert) => console.log('Triggered:', alert)}
/>
```

Features include inline alert creation, drag-to-reorder priority, bulk enable/disable, and a trigger timeline visualization.

## Alert History

Complete audit trail of all triggered alerts:

```typescript
const { triggeredAlerts, getAlertHistory } = useAlertStore();

const history = getAlertHistory({
  symbol: 'AAPL',
  dateRange: { from: '2026-01-01', to: '2026-03-01' },
  type: 'price',
  limit: 100,
});

// Each entry: { alertId, symbol, condition, triggeredAt, priceAtTrigger, acknowledged }
```

History entries link to the chart at the exact timestamp of the trigger, enabling post-hoc analysis of alert effectiveness.

## Recurring Alerts

Alerts that reset after triggering, useful for ongoing monitoring:

```typescript
createAlert({
  symbol: 'SPY',
  condition: {
    type: 'indicator',
    indicator: 'rsi',
    params: { period: 14 },
    operator: 'lte',
    value: 30,
  },
  recurring: {
    enabled: true,
    cooldownMinutes: 60,    // minimum time between re-triggers
    maxTriggers: 10,        // auto-disable after N triggers
    resetCondition: 'opposite',  // reset when RSI > 50
  },
});
```

Cooldown periods prevent notification spam during volatile conditions. The `opposite` reset mode requires the condition to fully reverse before re-arming.

## Alert Templates

Reusable alert configurations for common setups:

```typescript
const { saveTemplate, loadTemplate, listTemplates } = useAlertStore();

saveTemplate({
  id: 'oversold-bounce',
  name: 'Oversold Bounce Setup',
  description: 'Alerts when RSI < 25 with volume spike',
  condition: {
    type: 'compound',
    operator: 'AND',
    conditions: [
      { type: 'indicator', indicator: 'rsi', params: { period: 14 }, operator: 'lte', value: 25 },
      { type: 'volume', metric: 'relative', operator: 'gte', value: 2.0 },
    ],
  },
  notification: { channels: ['sound', 'push'] },
});

// Apply template to any symbol
const alert = loadTemplate('oversold-bounce');
createAlert({ ...alert, symbol: 'META' });
```

## Store Integration

The `alertStore` (Zustand) manages all alert state:

```typescript
interface AlertState {
  activeAlerts: Alert[];
  triggeredAlerts: TriggeredAlert[];
  templates: AlertTemplate[];
  createAlert: (config: AlertConfig) => string;
  deleteAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  acknowledgeTriggered: (id: string) => void;
  saveTemplate: (template: AlertTemplate) => void;
  getAlertHistory: (filters: HistoryFilters) => TriggeredAlert[];
  stats: { active: number; triggered24h: number; acknowledged: number };
}
```

Alerts persist via IndexedDB and synchronize across browser tabs using the BroadcastChannel API.
