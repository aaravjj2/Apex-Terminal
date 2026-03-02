# Performance Attribution

Attribution models for return decomposition.

## Types

```typescript
type AttributionModel = 'brinson' | 'factor' | 'sector' | 'country';
```

## API

```typescript
// GET /api/portfolio/attribution?period=&model=
const attribution = await getAttribution({ period: '1M', model: 'brinson' });
```

## Brinson

Decomposes return into allocation and selection effects.
