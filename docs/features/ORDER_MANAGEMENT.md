# Order Management

Apex Terminal's order management system in `lib/orders/` handles the full order lifecycle — from entry validation and risk checks through smart routing, execution, and post-trade analysis. The system supports institutional order types, bracket orders, and real-time blotter tracking.

## Table of Contents

- [Architecture](#architecture)
- [Order Types](#order-types)
- [Bracket and Contingent Orders](#bracket-and-contingent-orders)
- [Time-in-Force](#time-in-force)
- [Order Validation](#order-validation)
- [Risk Checks](#risk-checks)
- [Smart Order Router](#smart-order-router)
- [Transaction Cost Analysis](#transaction-cost-analysis)
- [Execution Blotter](#execution-blotter)

## Architecture

The order management pipeline flows through four modules:

```
Order Entry → riskChecks.ts → smartRouter.ts → execution.ts → TCA.ts
```

```typescript
// lib/orders/execution.ts
export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  trailingAmount?: number;
  timeInForce: TimeInForce;
  bracket?: BracketConfig;
  status: OrderStatus;
  fills: Fill[];
  createdAt: number;
}

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected';
```

## Order Types

| Type | Trigger | Price Guarantee | Use Case |
|---|---|---|---|
| **Market** | Immediate | No | Fastest execution, accept current price |
| **Limit** | Price reaches limit | Yes (or better) | Buy below / sell above target price |
| **Stop** | Price crosses stop | No | Stop-loss, breakout entry |
| **Stop-Limit** | Stop triggers → limit | Yes (or better) | Controlled exit with price floor |
| **Trailing Stop** | Price retreats by amount | No | Lock profits while letting winners run |

```typescript
import { createOrder, submitOrder } from '@/lib/orders/execution';

const order = createOrder({
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  price: 185.50,
  timeInForce: 'GTC',
});

const result = await submitOrder(order);
```

## Bracket and Contingent Orders

**Bracket orders** attach a take-profit limit and stop-loss to a parent entry order:

```typescript
const bracketOrder = createOrder({
  symbol: 'TSLA',
  side: 'buy',
  type: 'market',
  quantity: 50,
  bracket: {
    takeProfit: { type: 'limit', price: 260.00 },
    stopLoss: { type: 'stop', stopPrice: 240.00 },
  },
});
```

**OCO (One-Cancels-Other)** links two orders so that filling one automatically cancels the other. Used for dual-exit strategies where either a profit target or stop-loss should execute but not both.

## Time-in-Force

| Code | Name | Behavior |
|---|---|---|
| `GTC` | Good Till Cancel | Active until filled or manually cancelled |
| `DAY` | Day Order | Expires at market close if unfilled |
| `IOC` | Immediate or Cancel | Fill immediately (partial OK), cancel remainder |
| `FOK` | Fill or Kill | Fill entirely immediately, or cancel |
| `GTD` | Good Till Date | Active until specified expiration date |

## Order Validation

Pre-submission validation catches errors before they reach the execution layer:

```typescript
// lib/orders/execution.ts
export function validateOrder(order: Order): ValidationResult {
  const errors: string[] = [];
  if (order.quantity <= 0) errors.push('Quantity must be positive');
  if (order.type === 'limit' && !order.price) errors.push('Limit price required');
  if (order.type === 'stop' && !order.stopPrice) errors.push('Stop price required');
  if (order.type === 'stop_limit' && (!order.price || !order.stopPrice))
    errors.push('Both limit and stop prices required');
  return { valid: errors.length === 0, errors };
}
```

Additional validations include: lot size conformance, tick size rounding, maximum order size limits, and duplicate order detection.

## Risk Checks

The `riskChecks.ts` module enforces pre-trade risk limits before order submission:

```typescript
// lib/orders/riskChecks.ts
export interface RiskLimits {
  maxOrderSize: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  maxOpenOrders: number;
  maxConcentration: number;   // % of portfolio in single name
  marginRequirement: number;
}

export function checkRiskLimits(order: Order, portfolio: Portfolio, limits: RiskLimits): RiskCheckResult {
  const checks = [
    checkOrderSize(order, limits),
    checkPositionConcentration(order, portfolio, limits),
    checkDailyLoss(portfolio, limits),
    checkMarginAvailability(order, portfolio, limits),
    checkOpenOrderCount(portfolio, limits),
  ];
  return { passed: checks.every(c => c.passed), violations: checks.filter(c => !c.passed) };
}
```

## Smart Order Router

The `smartRouter.ts` module optimizes execution venue selection:

- **Price improvement** — routes to the venue with the best bid/offer.
- **Liquidity analysis** — considers depth of book at each venue.
- **Fee optimization** — factors in maker/taker fee schedules.
- **Latency scoring** — weights venues by historical fill latency.

```typescript
import { routeOrder } from '@/lib/orders/smartRouter';

const routing = routeOrder(order, {
  venues: ['NYSE', 'NASDAQ', 'BATS', 'IEX'],
  strategy: 'best_price',
  urgency: 'normal',
});
```

## Transaction Cost Analysis

Post-trade TCA in `TCA.ts` measures execution quality:

| Metric | Description |
|---|---|
| **Implementation Shortfall** | Difference between decision price and average fill price |
| **VWAP Slippage** | Fill price vs. interval VWAP |
| **Arrival Price** | Slippage from mid-price at order submission |
| **Market Impact** | Price movement attributable to the order |
| **Spread Cost** | Fraction of bid-ask spread paid |

```typescript
import { analyzeTCA } from '@/lib/orders/TCA';

const analysis = analyzeTCA(order, fills, marketData);
// { implShortfall: -0.03, vwapSlippage: 0.02, marketImpact: 0.01, spreadCost: 0.015 }
```

## Execution Blotter

The real-time blotter displays all orders and fills in a filterable, sortable data grid with columns for symbol, side, type, quantity, price, status, fill price, and timestamps. Status badges use color coding — green for filled, yellow for partial, red for cancelled/rejected. Click any row to expand fill details and TCA metrics.
