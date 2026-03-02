# Authentication

Auth flow for API and WebSocket.

## Token

Bearer token in `Authorization` header:

```
Authorization: Bearer <token>
```

## Client

`apiClient` in `frontend/src/api/client.ts` attaches auth from config/store.

## Session

- Token stored in secure storage
- Refresh before expiry
- 401 → redirect to login
