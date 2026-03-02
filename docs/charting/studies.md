# Chart Studies

Pre-built study configurations and combinations.

## Study Definition

A study bundles indicator(s) with params:

```typescript
interface Study {
  id: string;
  name: string;
  indicators: { id: string; params?: Record<string, number> }[];
  overlay: boolean;  // on price vs separate pane
}
```

## Common Studies

| Study | Indicators | Overlay |
|-------|------------|---------|
| Bollinger Bands | BB(20,2) | Yes |
| RSI | RSI(14) | No |
| MACD | MACD(12,26,9) | No |
| Moving Average Crossover | SMA(9), SMA(21) | Yes |
| Ichimoku | IchimokuCloud | Yes |
| Volume Profile | VolumeProfile(50) | Yes |

## Adding a Study

```typescript
import { RSI, SMA } from '@/lib/ta/indicators-extended';

const rsiStudy = { id: 'rsi', name: 'RSI', indicators: [{ id: 'RSI', params: { period: 14 } }], overlay: false };
const smaStudy = { id: 'sma', name: 'SMA Cross', indicators: [
  { id: 'SMA', params: { period: 9 } },
  { id: 'SMA', params: { period: 21 } },
], overlay: true };
```
