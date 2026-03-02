# Alerts API

`frontend/src/api/alertsApi.ts`

## CRUD

```typescript
await createAlert({ symbol, condition, field, value });
await updateAlert(alertId, params);
await deleteAlert(alertId);
const alerts = await getAlerts();
```

## Subscribe

```typescript
subscribeAlerts((event) => { /* triggered */ });
```
