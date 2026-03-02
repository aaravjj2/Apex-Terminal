# Backtest Metrics

Performance metrics computed from equity curve.

## Types

```typescript
interface BacktestResult {
  equityCurve: EquityPoint[];
  trades: Trade[];
  orders: Order[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTradePnl: number;
  };
}
```

## Key Metrics

| Metric | Description |
|--------|-------------|
| totalReturn | (endEquity - startEquity) / startEquity |
| sharpeRatio | Excess return / volatility (annualized) |
| maxDrawdown | Largest peak-to-trough decline |
| winRate | Winning trades / total trades |
| profitFactor | Gross profit / gross loss |
