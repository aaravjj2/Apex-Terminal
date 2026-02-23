# Getting Started — Apex Terminal

## Prerequisites

| Service | Required | Check |
|---|---|---|
| Python 3.11+ | ✅ | `python --version` |
| Node.js 18+ | ✅ | `node --version` |
| Docker | ✅ | `docker --version` |
| Elasticsearch 8.x | ✅ | `curl http://localhost:9200` |

---

## 1. Clone and configure

```bash
git clone <repo>
cd apex-terminal
cp keys.env.example keys.env
# Edit keys.env with your Alpaca API keys
```

## 2. Start services

```bash
docker compose -f docker-compose.judge.yml up -d
```

## 3. Start backend

```bash
export PYTHONPATH=$PWD:$PWD/phase1
uvicorn phase1.services.api.main:app --host 0.0.0.0 --port 8090
```

## 4. Start frontend

```bash
cd frontend && npm run dev
```

## 5. Verify health

```bash
curl http://localhost:8090/api/v3/ops/health
curl http://localhost:8090/api/v3/ops/elasticsearch
curl http://localhost:8090/api/v3/ops/ws/health
curl http://localhost:8090/api/v3/ops/broker
```

---

## Guided Tour

### Step 1 — Dashboard
Navigate to `http://localhost:5100/ui2/dashboard`

### Step 2 — Safe Actions (Tickets)
Navigate to `http://localhost:5100/ui2/safe-actions`

### Step 3 — Controls Domain
Navigate to `http://localhost:5100/ui2/controls-domain`

### Step 4 — Accessibility Audit
Navigate to `http://localhost:5100/ui2/accessibility`

### Step 5 — Performance Budget
Navigate to `http://localhost:5100/ui2/perf-budget`

### Step 6 — Export Bundle
Navigate to `http://localhost:5100/ui2/export-bundle`

### Step 7 — Ops Health
Navigate to `http://localhost:5100/ui2/ops`

---

## Missing environment variables

If any required keys are missing, the health endpoint will report them:

```bash
curl http://localhost:8090/api/v3/ops/health
```

Required variables:
- `DATABASE_URL` — SQLite path
- `ELASTICSEARCH_URL` — ES connection
- `ALPACA_API_KEY` + `ALPACA_API_SECRET` — Broker credentials

---

## Next steps

- Read [docs/ops/JUDGE_MODE.md](docs/ops/JUDGE_MODE.md) for full judge mode setup
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system overview
- Run `npx playwright test tests/e2e/hardening/ --headed` to see the full E2E suite
