# Pagination

List endpoints support cursor or offset pagination.

## Query Params

- `limit` — max items (default 100)
- `offset` — skip N items
- `nextPageToken` — cursor for next page

## Response

```json
{
  "orders": [...],
  "total": 1500,
  "nextPageToken": "eyJpZCI6IjEyMyJ9"
}
```

## Example

```typescript
const { orders, total, nextPageToken } = await getOrders({ limit: 50, offset: 100 });
```
