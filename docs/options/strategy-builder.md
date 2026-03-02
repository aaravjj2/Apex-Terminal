# Options Strategy Builder

Multi-leg strategy construction and payoff analysis.

## Types

```typescript
interface StrategyLeg {
  type: OptionType;  // CALL | PUT
  strike: number;
  expiry: number;
  quantity: number;  // + long, - short
  premium: number;
  exerciseStyle: ExerciseStyle;
}

interface StrategyDefinition {
  name: string;
  legs: StrategyLeg[];
  description: string;
  outlook: string;
}
```

## Payoff

```typescript
interface StrategyPayoff {
  underlyingPrices: number[];
  payoffs: number[];
  breakEvens: number[];
  maxProfit: number;
  maxLoss: number;
  probabilityOfProfit: number;
}
```

## Common Strategies

- Covered Call, Protective Put
- Bull/Bear Spreads
- Straddle, Strangle
- Iron Condor, Butterfly
