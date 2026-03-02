# Portfolio Construction

Portfolio assembly from holdings and positions.

## Types

```typescript
interface Portfolio {
  accountId: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  holdings: PortfolioHolding[];
}

interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  weight: number;
  sector: string;
  assetClass: string;
}
```

## API

```typescript
// GET /api/portfolio
const portfolio = await getPortfolio();
```
