# Apex Terminal — Run Locally

## Prerequisites

- Docker 24+ with Compose plugin
- `keys.env.example` is included in the repo

## Quick Start

**Exactly 3 commands to run the full judge stack:**

**Step 1 — Bootstrap your keys file:**

```bash
bash scripts/bootstrap_keys_example.sh
```

**Step 2 — Start all services (Postgres + ES + Kibana + Backend + Frontend):**

```bash
docker compose -f docker-compose.judge.yml up -d
```

**Step 3 — Verify the stack is live:**

```bash
curl http://localhost:8090/api/v3/export/version
```

Expected response: `{"version":"w108-v1.0","status":"ok"}`

---

## Service URLs

| Service       | URL                              |
|--------------|-----------------------------------|
| Frontend      | http://localhost:5100             |
| Backend API   | http://localhost:8090             |
| Elasticsearch | http://localhost:9200             |
| Kibana        | http://localhost:5601             |
| Postgres      | localhost:5432                    |

## Stopping

```bash
docker compose -f docker-compose.judge.yml down
```

## Notes

- Fill in real API keys in `keys.env` before trading (Alpaca, Finnhub, etc.)
- ES and Kibana take ~60s to start — backend depends on them
- All data is stored in `./data/` (SQLite) and Docker volumes (ES, Postgres)
