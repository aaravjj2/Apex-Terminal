# Troubleshooting Guide

## Quick Diagnostics

Run all service health checks:

```bash
curl http://localhost:8090/api/v3/ops/health
curl http://localhost:8090/api/v3/ops/ws/health
curl http://localhost:8090/api/v3/ops/elasticsearch
curl http://localhost:8090/api/v3/ops/broker
```

---

## Common Issues

### Backend won't start

1. Check port 8090 is free: `Get-NetTCPConnection -LocalPort 8090`
2. Kill existing process if needed
3. Ensure `PYTHONPATH` includes both workspace root AND `phase1/` directory
4. Check `DATABASE_URL` points to `data/bars.db`

### ES not connecting

1. Verify ES is running: `curl http://localhost:9200`
2. Check `ELASTICSEARCH_URL` env var
3. Restart ES: `docker compose -f docker-compose.judge.yml restart elasticsearch`

### WebSocket disconnects

1. Check `GET /api/v3/ops/ws/health` → `running: true`
2. Verify `heartbeat_task_alive: true`
3. `disconnect_count > 0` means reconnects occurred — investigate network stability

### Broker connection issues

1. Check `GET /api/v3/ops/broker` → `connected: true`
2. Verify `ALPACA_API_KEY` and `ALPACA_API_SECRET` in `keys.env`
3. Check `trading_blocked: false`

### Playwright tests failing

1. Confirm frontend is running: `curl http://localhost:5100`
2. Confirm backend is running: `curl http://localhost:8090/api/v3/ops/health`
3. Check `playwright.config.ts` has `headless: false, workers: 1, retries: 0`
4. Never use `waitForTimeout` — use `data-testid` selectors and `toBeAttached()`

---

## Reset All Test Data

```bash
curl -X POST http://localhost:8090/api/v3/ops/reset-all
```

See [RESET.md](RESET.md) for details.
