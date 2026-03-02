# Exotic Options

Barrier and Asian option support (types in `frontend/src/lib/options/types.ts`).

## Barrier Types

```typescript
enum BarrierType {
  UP_AND_IN, UP_AND_OUT,
  DOWN_AND_IN, DOWN_AND_OUT,
}
```

## Averaging

```typescript
enum AveragingType {
  ARITHMETIC,
  GEOMETRIC,
}
```

Exotic pricing may use Monte Carlo or closed-form approximations.
