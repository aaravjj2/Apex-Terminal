# Web Worker Guide

Creating and managing Web Workers in Apex Terminal.

## Table of Contents

- [Worker Inventory](#worker-inventory)
- [Creating Workers with Vite](#creating-workers-with-vite)
- [Message Protocol](#message-protocol)
- [Typed Message Interfaces](#typed-message-interfaces)
- [Error Handling in Workers](#error-handling-in-workers)
- [Progress Reporting](#progress-reporting)
- [Worker Pool Patterns](#worker-pool-patterns)
- [Testing Workers](#testing-workers)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Worker Inventory

Apex Terminal has 5 dedicated workers in `frontend/src/workers/`:

| Worker                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `indicatorWorker.ts`   | SMA, EMA, RSI, MACD, etc. on OHLCV data       |
| `backtestWorker.ts`    | Strategy simulation over historical bars       |
| `screeningWorker.ts`   | Multi-criteria stock filtering                 |
| `optimizationWorker.ts`| Parameter sweep (grid/genetic) for strategies  |
| `dataWorker.ts`        | Data transformation, aggregation, resampling   |

## Creating Workers with Vite

Vite supports workers via `new URL()` + `import.meta.url`. This ensures proper bundling and code splitting:

```typescript
// Instantiate a worker
const worker = new Worker(
  new URL('@/workers/indicatorWorker.ts', import.meta.url),
  { type: 'module' },
);
```

For use with the `useWorker` hook:

```typescript
import { useWorker } from '@/hooks/useWorker';

const { postMessage, status, isReady } = useWorker(
  () => new Worker(new URL('@/workers/indicatorWorker.ts', import.meta.url), { type: 'module' }),
  { timeout: 15000 },
);
```

When creating a new worker file, place it in `frontend/src/workers/` with the naming convention `<domain>Worker.ts`.

## Message Protocol

All workers follow a consistent request/response message protocol:

### Inbound (main thread → worker)

```typescript
interface InboundMessage {
  type: string;       // Operation type: 'calculate', 'batch', 'stream', 'cancel'
  taskId: string;     // Unique ID to correlate response
  // ... operation-specific fields
}
```

### Outbound (worker → main thread)

```typescript
interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready';
  taskId: string;     // Matches the inbound taskId
  data?: unknown;     // Result payload
  error?: string;     // Error message (when type === 'error')
  progress?: number;  // 0-1 progress value (when type === 'progress')
}
```

Every worker sends a `{ type: 'ready', taskId: '' }` message on initialization so the main thread knows it's available.

## Typed Message Interfaces

Define specific message types per worker for type safety:

```typescript
// indicatorWorker types
interface CalculateMessage {
  type: 'calculate';
  taskId: string;
  indicators: IndicatorConfig[];
  bars: BarData[];
}

interface BatchMessage {
  type: 'batch';
  taskId: string;
  indicators: IndicatorConfig[];
  bars: BarData[];
}

interface StreamMessage {
  type: 'stream';
  taskId: string;
  indicators: IndicatorConfig[];
  bars: BarData[];
  newBars: BarData[];
}

interface CancelMessage {
  type: 'cancel';
  taskId: string;
}

type WorkerInbound = CalculateMessage | BatchMessage | StreamMessage | CancelMessage;
```

In the worker, use a switch on `msg.type` for dispatch:

```typescript
const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'cancel':
      cancelledTasks.add(msg.taskId);
      return;

    case 'calculate':
      try {
        const result = calculateIndicator(msg.indicators[0], msg.bars);
        send({ type: 'result', taskId: msg.taskId, data: result });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;

    case 'batch':
      // ... process multiple indicators with progress reporting
      return;
  }
};
```

## Error Handling in Workers

Wrap all computation in try/catch and send error messages back:

```typescript
try {
  const result = heavyComputation(msg.data);
  send({ type: 'result', taskId: msg.taskId, data: result });
} catch (err) {
  send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
}
```

On the main thread, the `useWorker` hook rejects the promise on error messages:

```typescript
try {
  const result = await postMessage('calculate', payload);
} catch (err) {
  console.error('Worker computation failed:', err.message);
  showErrorToast('Indicator calculation failed');
}
```

Handle the global `onerror` for uncaught exceptions:

```typescript
// In the worker file
self.onerror = (event) => {
  send({ type: 'error', taskId: '', error: `Unhandled: ${event.message}` });
};
```

## Progress Reporting

For long-running operations, send periodic progress updates:

```typescript
case 'batch': {
  const total = msg.indicators.length;
  const results: Record<string, unknown> = {};

  for (let i = 0; i < total; i++) {
    if (cancelledTasks.has(msg.taskId)) {
      cancelledTasks.delete(msg.taskId);
      send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
      return;
    }

    results[msg.indicators[i].type] = calculateIndicator(msg.indicators[i], msg.bars);

    // Report progress every 5% or every indicator
    if ((i + 1) % Math.max(1, Math.floor(total / 20)) === 0) {
      send({ type: 'progress', taskId: msg.taskId, progress: (i + 1) / total });
    }
  }

  send({ type: 'result', taskId: msg.taskId, data: results });
}
```

On the main thread, listen for progress via `useWorker`'s `onMessage` callback:

```typescript
const { postMessage } = useWorker(factory, {
  onMessage: (response) => {
    if (response.type === 'progress') {
      setProgress(response.payload * 100);
    }
  },
});
```

## Worker Pool Patterns

For CPU-bound parallelism, use `useWorkerPool`:

```typescript
import { useWorkerPool } from '@/hooks/useWorker';

const pool = useWorkerPool(
  () => new Worker(new URL('@/workers/screeningWorker.ts', import.meta.url), { type: 'module' }),
  { poolSize: navigator.hardwareConcurrency ?? 4, timeout: 60000 },
);

// Execute a single task on the next idle worker
const result = await pool.execute('screen', { criteria, symbols: batch });

// Execute many tasks in parallel across the pool
const allResults = await pool.executeAll(
  batches.map((batch) => ({ type: 'screen', payload: { criteria, symbols: batch } })),
);
```

The pool distributes work round-robin to idle workers and queues if all are busy.

## Testing Workers

Test worker logic by extracting computation into pure functions and testing those:

```typescript
// Extract the computation
export function calculateSMA(data: number[], period: number): number[] { /* ... */ }

// Test the pure function
describe('indicatorWorker - SMA calculation', () => {
  it('computes SMA correctly', () => {
    expect(calculateSMA([1, 2, 3, 4, 5], 3)[4]).toBeCloseTo(4);
  });
});
```

For integration tests that exercise the message protocol, use a mock worker:

```typescript
import { describe, it, expect } from 'vitest';

it('responds to calculate message', async () => {
  const worker = new Worker(
    new URL('@/workers/indicatorWorker.ts', import.meta.url),
    { type: 'module' },
  );

  const response = await new Promise<any>((resolve) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'result') resolve(e.data);
    };
    worker.postMessage({
      type: 'calculate',
      taskId: 'test-1',
      indicators: [{ type: 'sma', params: { period: 3 } }],
      bars: [
        { time: 1, open: 1, high: 2, low: 0.5, close: 1, volume: 100 },
        { time: 2, open: 1, high: 3, low: 1, close: 2, volume: 200 },
        { time: 3, open: 2, high: 4, low: 1.5, close: 3, volume: 150 },
      ],
    });
  });

  expect(response.taskId).toBe('test-1');
  expect(response.data.values[2]).toBeCloseTo(2);
  worker.terminate();
});
```

## Conventions

- Worker files are self-contained — import only pure utility functions, no React or DOM APIs.
- Use `self as unknown as Worker` for typed access to `postMessage` and `onmessage`.
- Every message has a `taskId` for request/response correlation.
- Workers send `{ type: 'ready' }` on initialization.
- Keep workers focused — one domain per worker.

## Do's and Don'ts

**Do:**
- Use Vite's `new URL()` pattern for worker instantiation
- Define typed interfaces for all message types
- Send progress updates for operations > 1 second
- Support cancellation via a `cancel` message type
- Terminate workers on component unmount (handled by `useWorker`)

**Don't:**
- Import React or browser DOM APIs in worker files
- Use `importScripts()` — use ES module imports instead
- Send huge data payloads via postMessage without considering structured clone cost
- Create workers inline in render — use `useWorker` or a ref
- Block the worker's message loop with synchronous operations > 50ms without yielding
