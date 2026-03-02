# Broker Status

Broker connectivity and capabilities.

## Types

```typescript
interface BrokerStatus {
  connected: boolean;
  broker: string;
  accountType: 'live' | 'paper';
  latencyMs: number;
  lastHeartbeat: string;
  capabilities: string[];
  restrictions: string[];
  marketHours: {
    isOpen: boolean;
    nextOpen: string;
    nextClose: string;
    timezone: string;
  };
}
```

## API

```typescript
// GET /api/trading/broker/status
const status = await getBrokerStatus();
```

Timeout: 5000ms.
