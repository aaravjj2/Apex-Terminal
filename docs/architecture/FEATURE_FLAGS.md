# Feature Flags

> Gradual rollout, A/B testing, and remote configuration powered by the `FeatureFlagEngine` in `lib/platform/featureFlags.ts`.

---

## Table of Contents

- [Overview](#overview)
- [Flag Types](#flag-types)
- [Flag Registration](#flag-registration)
- [Evaluation Logic](#evaluation-logic)
- [Percentage Rollout](#percentage-rollout)
- [A/B Testing](#ab-testing)
- [Overrides](#overrides)
- [Remote Configuration](#remote-configuration)
- [Audit Trail](#audit-trail)
- [Component Integration](#component-integration)
- [Default Flags](#default-flags)
- [Lifecycle and Cleanup](#lifecycle-and-cleanup)

---

## Overview

The feature flag system enables progressive rollout of new functionality without code deployments. The `FeatureFlagEngine` supports four flag types — boolean, percentage-based, user-list gated, and A/B test variants — with local persistence, URL-based overrides for testing, remote flag syncing via polling, and a capped audit log.

Flags are persisted to `localStorage` under the keys `feature_flags`, `feature_flag_overrides`, and `feature_flag_audit`. Evaluation results are cached for 5 minutes per user+flag combination.

---

## Flag Types

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'ab_test';
  percentage?: number;         // 0-100 for percentage type
  allowedUsers?: string[];     // user IDs for user_list type
  variants?: FlagVariant[];    // A/B test variants with weights
  defaultVariant?: string;
  tags?: string[];             // categorical tags for filtering
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;          // auto-disable after expiry
}
```

| Type | Behavior | Use Case |
|------|----------|----------|
| `boolean` | On/off for all users | Feature gates, kill switches |
| `percentage` | Deterministic hash-based bucket | Gradual rollout (10%, 25%, 50%, 100%) |
| `user_list` | Explicit user ID whitelist | Beta testers, internal users |
| `ab_test` | Weighted variant assignment | UI experiments, order panel redesign |

---

## Flag Registration

Flags are registered at application startup via `register()` or `registerMany()`:

```typescript
const engine = new FeatureFlagEngine();

engine.registerMany(createDefaultFlags());

engine.register({
  id: 'new_risk_dashboard',
  name: 'Risk Dashboard V2',
  description: 'Redesigned risk analytics panel',
  enabled: true,
  type: 'percentage',
  percentage: 15,
  tags: ['risk', 'beta'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

---

## Evaluation Logic

Evaluation follows a strict priority chain:

1. **Override check** — Local, URL, or API overrides take precedence (with expiry check)
2. **Expiry check** — Expired flags evaluate to `false`
3. **Enabled check** — Disabled flags short-circuit to `false`
4. **Type-specific evaluation** — Boolean, percentage hash, user list match, or variant selection

Each evaluation produces a `FlagEvaluation` with a `reason` field for debugging:

```typescript
interface FlagEvaluation {
  flagId: string;
  enabled: boolean;
  variant?: string;
  payload?: Record<string, unknown>;
  reason: 'default' | 'override' | 'percentage' | 'user_list' | 'remote' | 'expired' | 'disabled';
  timestamp: number;
}
```

---

## Percentage Rollout

Percentage flags use a deterministic hash of `userId:flagId` to assign users to a 0-99 bucket. Users whose bucket falls below the configured percentage get the feature enabled. This ensures consistent assignment — the same user always lands in the same bucket for a given flag.

```typescript
// Internally: hash("user_42:ai_predictions") % 100 → bucket 37
// If percentage = 10 → 37 >= 10 → disabled
// If percentage = 50 → 37 < 50  → enabled

engine.isEnabled('ai_predictions', 'user_42'); // consistent per user
```

To ramp a feature: update the `percentage` field from 10 → 25 → 50 → 100. Lower-bucket users remain enabled as the threshold increases.

---

## A/B Testing

A/B test flags define weighted variants. The engine hashes `userId:flagId` against the total weight to deterministically assign a variant:

```typescript
engine.register({
  id: 'new_order_panel',
  type: 'ab_test',
  enabled: true,
  variants: [
    { id: 'control', name: 'Current Panel', weight: 50 },
    { id: 'variant_a', name: 'Redesign A', weight: 25, payload: { layout: 'compact' } },
    { id: 'variant_b', name: 'Redesign B', weight: 25, payload: { layout: 'expanded' } },
  ],
  // ...
});

const variant = engine.getVariant('new_order_panel');   // 'control' | 'variant_a' | 'variant_b'
const payload = engine.getPayload('new_order_panel');   // { layout: 'compact' } or null
```

---

## Overrides

Three override sources allow testing without modifying flag definitions:

### Local Override

```typescript
engine.setOverride('dark_pool_trading', true);
engine.setOverride('ai_predictions', true, undefined, Date.now() + 3600_000); // 1hr expiry
engine.clearOverride('dark_pool_trading');
```

### URL Override

Append `?ff_<flagId>=1` or `?ff_<flagId>=0` to the URL:

```
https://app.apexterminal.io/chart?ff_dark_pool_trading=1&ff_ai_predictions=true
```

URL overrides are applied on engine construction and take `source: 'url'`.

### API Override

Remote flag updates from the server automatically replace local definitions. Override precedence: **local/URL override > remote flag > default definition**.

---

## Remote Configuration

Connect to a flag management backend with polling:

```typescript
await engine.configureRemote({
  endpoint: 'https://api.apexterminal.io/v1/flags',
  pollIntervalMs: 60_000,
  headers: { 'Authorization': 'Bearer <token>' },
  timeout: 5000,
});
```

The engine fetches flags on configuration and polls at the specified interval. Failed fetches log a warning without disrupting cached evaluations. Remote payloads replace the local flag map and clear the evaluation cache.

---

## Audit Trail

Every flag evaluation, override, creation, update, and deletion is recorded in the audit log (capped at 500 entries in memory, 100 persisted to localStorage):

```typescript
interface FlagAuditEntry {
  flagId: string;
  action: 'evaluate' | 'override' | 'update' | 'create' | 'delete';
  previousValue?: boolean;
  newValue?: boolean;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const history = engine.getAuditLog('new_order_panel');
```

---

## Component Integration

### Conditional Rendering

```typescript
const flags = new FeatureFlagEngine();

function TradingPanel() {
  const showDarkPool = flags.isEnabled('dark_pool_trading');
  const orderVariant = flags.getVariant('new_order_panel');

  return (
    <div>
      {showDarkPool && <DarkPoolRouter />}
      {orderVariant === 'variant_a' ? <OrderPanelV2 /> : <OrderPanel />}
    </div>
  );
}
```

### Listening for Changes

```typescript
useEffect(() => {
  const unsub = flags.onFlagChange('ai_predictions', (evaluation) => {
    if (evaluation.enabled) loadAIPredictionModule();
  });
  return unsub;
}, []);
```

---

## Default Flags

The platform ships with 10 pre-registered flags via `createDefaultFlags()`:

| Flag ID | Type | Default | Tags |
|---------|------|---------|------|
| `dark_pool_trading` | boolean | off | trading |
| `advanced_charts` | boolean | on | charts |
| `ai_predictions` | percentage (10%) | off | ai, beta |
| `social_trading` | percentage (25%) | off | social, beta |
| `options_chain` | boolean | on | options |
| `new_order_panel` | ab_test (50/25/25) | on | trading, experiment |
| `portfolio_analytics` | boolean | on | portfolio |
| `multi_monitor` | boolean | off | layout |
| `risk_management` | boolean | on | risk |
| `crypto_trading` | boolean | on | trading, crypto |

---

## Lifecycle and Cleanup

Call `destroy()` on the engine to stop remote polling and clear listeners:

```typescript
engine.destroy(); // clears poll timer, listeners, evaluation cache
```

Expired overrides are automatically pruned on next evaluation. Flags with `expiresAt` in the past evaluate to `disabled` regardless of their `enabled` state.
