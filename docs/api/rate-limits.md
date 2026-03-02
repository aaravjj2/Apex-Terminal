# Rate Limits

Request throttling for API stability.

## Limits

- REST: 100 req/min per endpoint (varies)
- WebSocket: 10 msg/sec
- Backtest: 5 concurrent runs

## Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709904000
```

## 429 Response

Retry-After header indicates wait time in seconds.
