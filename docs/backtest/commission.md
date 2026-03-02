# Commission Models

Commission and fee simulation in backtest.

## Config

```typescript
interface CommissionConfig {
  model: 'fixed' | 'perShare' | 'percent' | 'tiered';
  fixedPerOrder?: number;
  perShare?: number;
  percentOfNotional?: number;
}
```

## Models

- **fixed**: Flat fee per order
- **perShare**: Fee per share
- **percent**: % of notional
- **tiered**: Volume-based tiers
