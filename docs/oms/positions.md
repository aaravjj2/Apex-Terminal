# Positions

Position management from `tradingApi.ts`.

## Types

```typescript
interface Position {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  todayPnl: number;
  todayPnlPct: number;
  exchange: string;
  assetClass: string;
  openedAt: string;
  lastUpdated: string;
}
```

## API

```typescript
// GET /api/trading/positions
const positions = await getPositions();

// GET /api/trading/positions/:symbol
const pos = await getPosition('AAPL');

// POST /api/trading/positions/:symbol/close
await closePosition({ symbol: 'AAPL', quantity: 50, type: 'market' });

// POST /api/trading/positions/close-all
const { orders, closedCount } = await closeAllPositions();
```
