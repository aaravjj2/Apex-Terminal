# Execution Algorithms

Apex Terminal implements institutional-grade algorithmic execution strategies that slice large orders into smaller child orders to minimize market impact and achieve benchmark-beating fill prices.

## Table of Contents

- [Overview](#overview)
- [TWAP — Time-Weighted Average Price](#twap--time-weighted-average-price)
- [VWAP — Volume-Weighted Average Price](#vwap--volume-weighted-average-price)
- [Iceberg Orders](#iceberg-orders)
- [Percentage of Volume](#percentage-of-volume)
- [Implementation Shortfall](#implementation-shortfall)
- [Smart Order Routing](#smart-order-routing)
- [Algorithm Configuration](#algorithm-configuration)
- [Execution Monitoring](#execution-monitoring)

## Overview

Execution algorithms sit between the order management layer and the venue router. When a parent order is assigned an algorithm, the `AlgorithmEngine` generates a schedule of child orders executed over a defined horizon:

```typescript
// lib/orders/execution.ts — algorithm dispatch
export interface AlgoConfig {
  strategy: 'twap' | 'vwap' | 'iceberg' | 'pov' | 'is';
  parentOrder: Order;
  startTime: number;
  endTime: number;
  params: Record<string, number>;
}

export class AlgorithmEngine {
  private schedule: ChildOrder[] = [];

  execute(config: AlgoConfig): void {
    switch (config.strategy) {
      case 'twap': this.schedule = generateTwapSchedule(config); break;
      case 'vwap': this.schedule = generateVwapSchedule(config); break;
      case 'iceberg': this.schedule = generateIcebergSchedule(config); break;
      case 'pov': this.schedule = generatePovSchedule(config); break;
      case 'is': this.schedule = generateIsSchedule(config); break;
    }
    this.dispatchSchedule();
  }
}
```

## TWAP — Time-Weighted Average Price

TWAP divides the total quantity into equal slices executed at regular intervals over the order horizon. It targets the simple time-weighted average price as its benchmark.

```typescript
function generateTwapSchedule(config: AlgoConfig): ChildOrder[] {
  const { parentOrder, startTime, endTime, params } = config;
  const sliceCount = params.slices ?? 20;
  const interval = (endTime - startTime) / sliceCount;
  const sliceQty = Math.floor(parentOrder.quantity / sliceCount);
  const remainder = parentOrder.quantity - sliceQty * sliceCount;

  return Array.from({ length: sliceCount }, (_, i) => ({
    parentId: parentOrder.id,
    quantity: sliceQty + (i < remainder ? 1 : 0),
    scheduledTime: startTime + i * interval,
    type: 'limit' as const,
    limitOffset: params.limitOffset ?? 0.01,
  }));
}
```

**Parameters**: `slices` (number of child orders), `limitOffset` (passive limit offset from mid), `randomize` (±% jitter on timing to avoid detection).

## VWAP — Volume-Weighted Average Price

VWAP shapes the execution schedule to mirror the historical intraday volume profile, placing more shares during high-volume periods and fewer during lulls:

```typescript
function generateVwapSchedule(config: AlgoConfig): ChildOrder[] {
  const volumeProfile = getHistoricalVolumeProfile(config.parentOrder.symbol, 20);
  const buckets = discretizeProfile(volumeProfile, config.startTime, config.endTime);

  return buckets.map((bucket) => ({
    parentId: config.parentOrder.id,
    quantity: Math.round(config.parentOrder.quantity * bucket.volumeFraction),
    scheduledTime: bucket.time,
    type: 'limit' as const,
    limitOffset: config.params.limitOffset ?? 0.01,
  }));
}
```

The volume profile is built from the trailing 20-day average intraday volume distribution, binned into 5-minute intervals. VWAP typically achieves lower market impact than TWAP for liquid names.

## Iceberg Orders

Iceberg orders expose only a visible "tip" quantity to the market while hiding the true order size. Once the visible slice fills, the next slice is automatically placed:

```typescript
function generateIcebergSchedule(config: AlgoConfig): ChildOrder[] {
  const { parentOrder, params } = config;
  const visibleQty = params.displayQty ?? Math.ceil(parentOrder.quantity * 0.1);
  const slices = Math.ceil(parentOrder.quantity / visibleQty);

  return Array.from({ length: slices }, (_, i) => ({
    parentId: parentOrder.id,
    quantity: Math.min(visibleQty, parentOrder.quantity - i * visibleQty),
    triggerOnFill: i > 0,
    type: 'limit' as const,
    price: parentOrder.price!,
  }));
}
```

**Parameters**: `displayQty` (visible slice size), `variance` (±% randomization on display qty to obscure pattern).

## Percentage of Volume

POV targets a fixed participation rate relative to real-time market volume. The algorithm monitors consolidated volume and adjusts its pace to remain at or below the target rate:

```typescript
interface PovState {
  targetRate: number;      // e.g., 0.10 for 10% of volume
  filledQty: number;
  marketVolume: number;
  maxRate: number;          // hard ceiling, e.g., 0.25
}

function computeNextSlice(state: PovState, recentVolume: number): number {
  const targetQty = recentVolume * state.targetRate;
  const maxQty = recentVolume * state.maxRate;
  return Math.min(targetQty, maxQty);
}
```

POV is favored for large block orders where maintaining a low footprint is more important than hitting a specific time benchmark.

## Implementation Shortfall

The IS algorithm minimizes the gap between the decision price (mid-price at order creation) and the final average execution price. It front-loads execution to reduce timing risk, trading off higher immediate market impact for lower price drift exposure:

```typescript
interface IsParams {
  riskAversion: number;    // 0–1 scale, higher = more aggressive / front-loaded
  volatility: number;
  adv: number;             // average daily volume
  spreadCost: number;
}

function optimalTrajectory(params: IsParams, totalQty: number, horizon: number): number[] {
  const kappa = Math.sqrt(params.riskAversion * params.volatility / params.spreadCost);
  return discretizeAlmgrenChriss(kappa, totalQty, horizon);
}
```

The trajectory follows the Almgren-Chriss optimal execution framework, balancing market impact cost against volatility risk.

## Smart Order Routing

All execution algorithms route child orders through the `smartRouter`, which selects venues per-slice based on:

| Factor | Weight | Source |
|---|---|---|
| Best price | 40% | Real-time L1 quotes |
| Available depth | 25% | L2 order book |
| Historical fill rate | 15% | Venue statistics |
| Fee schedule | 10% | Venue fee tables |
| Latency | 10% | Ping measurements |

The router supports dark pool inclusion for orders where information leakage is a concern.

## Algorithm Configuration

Algorithms are configured through the order ticket UI or programmatically:

```typescript
const algoOrder = createAlgoOrder({
  symbol: 'MSFT',
  side: 'buy',
  quantity: 50000,
  algorithm: {
    strategy: 'vwap',
    startTime: marketOpen,
    endTime: marketOpen + 2 * 3600 * 1000,
    params: { limitOffset: 0.02, urgency: 'medium' },
  },
});
```

Urgency presets (`low`, `medium`, `high`) adjust participation rates and aggressiveness across all algorithms.

## Execution Monitoring

The algo monitor panel displays real-time progress:

- **Completion gauge** — percentage of parent quantity filled.
- **Benchmark tracking** — running slippage vs. TWAP/VWAP benchmark.
- **Schedule chart** — planned vs. actual fill distribution over time.
- **Child order blotter** — individual child order statuses and fill prices.

Users can pause, resume, or cancel running algorithms. Adjusting parameters mid-flight (e.g., increasing urgency) re-optimizes the remaining schedule.
