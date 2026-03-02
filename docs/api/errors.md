# Error Handling

API error format and codes.

## Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "quantity must be positive",
    "details": {}
  }
}
```

## Codes

- VALIDATION_ERROR
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- RATE_LIMITED
- SERVER_ERROR

## Client

```typescript
apiClient.get('/api/trading/orders').catch((err) => {
  if (err.status === 401) { /* reauth */ }
  if (err.status === 429) { /* retry */ }
});
```
