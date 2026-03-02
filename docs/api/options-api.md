# Options API

`frontend/src/api/optionsApi.ts`

## Chain

```typescript
const chain = await getOptionsChain('AAPL', { expiration: '2024-06-21' });
```

## Greeks

```typescript
const greeks = await getGreeks('AAPL', { strike: 150, expiration: '2024-06-21', type: 'call' });
```
