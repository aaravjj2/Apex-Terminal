# Screening API

`frontend/src/api/screeningApi.ts`

## Run Screen

```typescript
const results = await runScreen({ filters, universe, sortBy });
```

## Saved Screens

```typescript
await saveScreen({ name, filters });
const screens = await getSavedScreens();
```
