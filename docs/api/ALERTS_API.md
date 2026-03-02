# Alerts API

Create and manage price alerts, indicator-based conditions, and volume spike triggers. Notifications are delivered via push, email, sound, or webhook.

## Table of Contents

- [Endpoints](#endpoints)
- [Create Alert](#post-create-alert)
- [List Alerts](#get-list-alerts)
- [Update Alert](#patch-update-alert)
- [Delete Alert](#delete-delete-alert)
- [Condition Types](#condition-types)
- [Notification Channels](#notification-channels)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/alerts` | Create a new alert |
| GET | `/api/alerts` | List all alerts with filters |
| PATCH | `/api/alerts/:id` | Update an existing alert |
| DELETE | `/api/alerts/:id` | Delete an alert |

## POST Create Alert

```typescript
interface CreateAlertRequest {
  symbol: string;
  name?: string;                // Human-readable label
  condition: AlertCondition;
  notifications: NotificationChannel[];
  expiration?: string;          // ISO 8601 datetime, null for no expiry
  recurring?: boolean;          // Re-arm after trigger (default: false)
  cooldownMinutes?: number;     // Min time between recurring triggers (default: 5)
}

const alert = await alertsApi.create({
  symbol: 'AAPL',
  name: 'AAPL breakout',
  condition: {
    type: 'price_above',
    value: 200.00,
  },
  notifications: [
    { channel: 'push', enabled: true },
    { channel: 'sound', enabled: true, sound: 'chime' },
    { channel: 'webhook', enabled: true, url: 'https://hooks.example.com/alerts' },
  ],
  recurring: true,
  cooldownMinutes: 15,
});

interface AlertResponse {
  id: string;
  symbol: string;
  name: string;
  condition: AlertCondition;
  notifications: NotificationChannel[];
  status: 'active' | 'triggered' | 'expired' | 'disabled';
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiration: string | null;
  recurring: boolean;
}
```

## GET List Alerts

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | `active`, `triggered`, `expired`, `all` (default: `all`) |
| `symbol` | string | No | Filter by symbol |
| `sort` | string | No | `created`, `triggered`, `name` (default: `created`) |
| `limit` | number | No | Page size (default: 50, max: 200) |
| `cursor` | string | No | Pagination cursor |

```typescript
const alerts = await alertsApi.list({ status: 'active', symbol: 'AAPL' });
// { alerts: AlertResponse[], meta: { total, hasMore, cursor } }
```

## PATCH Update Alert

Modify condition, notifications, or status of an existing alert. Only provided fields are updated.

```typescript
await alertsApi.update('alert_abc123', {
  condition: { type: 'price_above', value: 210.00 },
  notifications: [{ channel: 'email', enabled: true, address: 'trader@example.com' }],
  status: 'active',
});
```

## DELETE Delete Alert

Permanently removes an alert. Returns `204 No Content` on success.

```typescript
await alertsApi.delete('alert_abc123');
```

## Condition Types

```typescript
type AlertCondition =
  | { type: 'price_above'; value: number }
  | { type: 'price_below'; value: number }
  | { type: 'price_crosses'; value: number; direction: 'up' | 'down' }
  | { type: 'percent_change'; period: '1D' | '1W'; threshold: number; direction: 'up' | 'down' }
  | { type: 'indicator_cross'; indicator: string; params: Record<string, number>;
      reference: { indicator: string; params: Record<string, number> } | { value: number };
      direction: 'above' | 'below' }
  | { type: 'volume_spike'; multiplier: number; period: number }
  | { type: 'spread_change'; threshold: number }
  | { type: 'new_high'; period: '52W' | 'ATH' }
  | { type: 'new_low'; period: '52W' | 'ATL' };
```

### Condition Examples

| Condition | Description |
|-----------|-------------|
| `price_above: 200` | Triggers when price exceeds $200 |
| `price_crosses: 150, down` | Triggers when price crosses below $150 |
| `indicator_cross: RSI(14) below 30` | RSI drops below 30 (oversold) |
| `indicator_cross: SMA(20) above SMA(50)` | Golden cross detection |
| `volume_spike: 3x, 20` | Volume exceeds 3x the 20-period average |
| `percent_change: 1D, 5%, up` | Stock moves up 5%+ in a single day |
| `new_high: 52W` | Price hits a new 52-week high |

## Notification Channels

```typescript
type NotificationChannel =
  | { channel: 'push'; enabled: boolean }
  | { channel: 'email'; enabled: boolean; address: string }
  | { channel: 'sound'; enabled: boolean; sound: 'chime' | 'alert' | 'bell' | 'urgent' }
  | { channel: 'webhook'; enabled: boolean; url: string; headers?: Record<string, string> };
```

### Webhook Payload

When an alert triggers, the webhook receives a POST request:

```typescript
interface WebhookPayload {
  alertId: string;
  symbol: string;
  name: string;
  condition: AlertCondition;
  currentValue: number;
  triggeredAt: string;
}
```

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `8001` | Invalid alert condition |
| 400 | `8002` | Invalid notification channel configuration |
| 404 | `8003` | Alert not found |
| 409 | `8004` | Duplicate alert (same symbol + condition exists) |
| 403 | `8005` | Alert limit reached for current tier |
| 400 | `8006` | Invalid webhook URL |

## Rate Limits

| Tier | Max Active Alerts | Creates/min | Webhook Triggers/min |
|------|------------------|-------------|---------------------|
| Free | 10 | 5 | 10 |
| Pro | 200 | 30 | 100 |
| Enterprise | 2000 | 120 | 1000 |

Real-time alert status updates are delivered via the WebSocket `alerts` channel — see [WEBSOCKET_API.md](./WEBSOCKET_API.md).
