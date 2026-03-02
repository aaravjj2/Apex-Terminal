# Real-Time Market Scanner

Continuous market scanning with pattern detection, unusual activity alerts, gap analysis, momentum tracking, and custom scan conditions — powered by Web Workers for streaming results.

## Table of Contents

- [Overview](#overview)
- [Scanner Architecture](#scanner-architecture)
- [Pattern Detection](#pattern-detection)
- [Unusual Volume Alerts](#unusual-volume-alerts)
- [Gap Scanners](#gap-scanners)
- [Momentum Scanners](#momentum-scanners)
- [Custom Scan Conditions](#custom-scan-conditions)
- [Streaming Results](#streaming-results)
- [Configuration](#configuration)

## Overview

The real-time scanner (`lib/marketData/scanner.ts`) continuously monitors the market universe for configurable conditions, delivering matches as they occur. Unlike the screener (which runs on-demand), the scanner operates as a persistent background process via `workers/screeningWorker.ts`.

```typescript
import { MarketScanner } from '@/lib/marketData/scanner';

const scanner = new MarketScanner({
  universe: 'us-equities',
  updateInterval: 5000,
  maxConcurrentScans: 4,
});
```

## Scanner Architecture

The scanner runs in a dedicated Web Worker to avoid blocking the UI:

```typescript
// screeningWorker.ts handles the computation loop
interface ScannerMessage {
  type: 'start' | 'stop' | 'update-config' | 'add-scan' | 'remove-scan';
  payload: ScanConfig | string;
}

interface ScanResult {
  scanId: string;
  symbol: string;
  matchedAt: number;
  condition: string;
  currentValue: number;
  metadata: Record<string, number>;
}

// Main thread communicates with the worker
const worker = new Worker(new URL('@/workers/screeningWorker.ts', import.meta.url));
worker.postMessage({ type: 'start', payload: scanConfig });
worker.onmessage = (e: MessageEvent<ScanResult[]>) => {
  updateResults(e.data);
};
```

The worker receives market data updates from the feed module and evaluates all active scan conditions each tick.

## Pattern Detection

Scan for chart patterns as they form in real-time:

```typescript
const patternScan = scanner.createScan({
  id: 'pattern-breakouts',
  type: 'pattern',
  conditions: {
    patterns: [
      'double-bottom',
      'ascending-triangle',
      'bull-flag',
      'cup-and-handle',
      'inverse-head-shoulders',
    ],
    completionThreshold: 0.85,  // pattern at least 85% formed
    volumeConfirmation: true,
  },
  universe: 'sp500',
});

scanner.on('pattern-breakouts', (results) => {
  // results: [{ symbol: 'AAPL', pattern: 'bull-flag', completion: 0.92, ... }]
});
```

Pattern recognition uses geometric template matching with dynamic time warping for flexible shape matching.

## Unusual Volume Alerts

Detect abnormal trading activity relative to historical baselines:

```typescript
const volumeScan = scanner.createScan({
  id: 'unusual-volume',
  type: 'volume',
  conditions: {
    volumeMultiple: 3.0,       // 3x the 20-day average
    priceChangeMin: 2.0,       // at least 2% price move
    timeOfDay: 'market-hours', // 'pre-market' | 'market-hours' | 'after-hours' | 'all'
    excludeEarnings: true,     // ignore expected volume around earnings
    minAvgVolume: 500_000,     // filter out illiquid names
  },
});

// Fires when a stock trades 3x+ its normal volume with >2% price move
scanner.on('unusual-volume', (results) => {
  // Alert via notification system
});
```

The scanner cross-references volume spikes with upcoming earnings dates, option expiration, and index rebalancing events to reduce false positives.

## Gap Scanners

Identify pre-market gaps for opening-range strategies:

```typescript
const gapScan = scanner.createScan({
  id: 'gap-scanner',
  type: 'gap',
  conditions: {
    gapType: 'up',            // 'up' | 'down' | 'both'
    minGapPercent: 3.0,
    maxGapPercent: 15.0,
    minPremarketVolume: 100_000,
    catalystRequired: false,  // optionally require news catalyst
    relativeTo: 'previous-close',
  },
  schedule: {
    activeFrom: '04:00',     // pre-market start
    activeTo: '09:45',       // shortly after open
    timezone: 'America/New_York',
  },
});
```

Gap statistics include historical gap-fill rates, average time to fill, and continuation probabilities per gap size bracket.

## Momentum Scanners

Track momentum leaders and breakout candidates:

```typescript
const momentumScan = scanner.createScan({
  id: 'momentum-surge',
  type: 'momentum',
  conditions: {
    priceChangePercent: { min: 1.5, period: '5m' },
    rsiThreshold: { min: 60, max: 80 },
    volumeAcceleration: true,  // volume increasing over last 3 bars
    aboveVWAP: true,
    newHighs: 'intraday',     // 'intraday' | '52-week' | 'all-time'
  },
});

// Separate scan for intraday reversals
const reversalScan = scanner.createScan({
  id: 'mean-reversion',
  type: 'momentum',
  conditions: {
    priceChangePercent: { max: -3, period: '30m' },
    rsiThreshold: { max: 25 },
    nearSupport: true,
    volumeSpike: 2.0,
  },
});
```

## Custom Scan Conditions

Define arbitrary scan logic with the expression engine:

```typescript
const customScan = scanner.createScan({
  id: 'my-custom-scan',
  type: 'custom',
  expression: `
    close > sma(close, 200)
    AND close CROSSES_ABOVE sma(close, 20)
    AND volume > 2 * sma(volume, 20)
    AND rsi(14) > 50
    AND rsi(14) < 70
    AND atr(14) / close > 0.02
  `,
});
```

Supported expression operators: arithmetic (`+`, `-`, `*`, `/`), comparison (`>`, `<`, `>=`, `<=`), logical (`AND`, `OR`, `NOT`), and crossover functions (`CROSSES_ABOVE`, `CROSSES_BELOW`).

## Streaming Results

Results stream to the UI as they are detected:

```typescript
const { scanResults, activeScanCount, isRunning } = useScannerStore();

// Results are deduplicated and ranked by recency
// Each result includes a TTL — old matches auto-expire
interface StreamingResult {
  symbol: string;
  scanId: string;
  matchedAt: number;
  ttl: number;        // milliseconds until expiry
  priority: 'high' | 'medium' | 'low';
  data: Record<string, number>;
}
```

The UI renders results in a sortable, filterable table with real-time price updates for matched symbols. Sound alerts can be configured per scan.

## Configuration

Global scanner settings:

```typescript
interface ScannerConfig {
  maxActiveScans: number;          // default: 10
  updateIntervalMs: number;        // default: 5000
  resultTTLMs: number;             // default: 300_000 (5 minutes)
  maxResultsPerScan: number;       // default: 100
  enableSoundAlerts: boolean;
  enablePushNotifications: boolean;
  universeRefreshInterval: number; // how often to refresh symbol universe
  workerPoolSize: number;          // number of Web Workers (default: navigator.hardwareConcurrency)
}
```

Scanner state persists across page reloads via IndexedDB, and active scans resume automatically on reconnection.
