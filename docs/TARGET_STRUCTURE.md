# Apex Terminal — Target Project Structure

## Current vs Target

```
Apex Terminal/
├── backend/                    # ← EXISTS, has domains/ and core/
│   ├── core/                   # startup_checks, es_templates, bulk_ingest
│   └── domains/                # audit, broker domain modules
│
├── phase1/                     # ← CURRENT backend entry, acts as "backend/"
│   ├── services/
│   │   ├── api/                # FastAPI routers (main.py, routes/)
│   │   ├── autopilot/          # Autopilot engine
│   │   ├── config.py           # Settings/config
│   │   ├── ingestion/          # Data connectors + bar engine
│   │   ├── market_data/        # Market data providers
│   │   ├── persistence/        # DB models + repository
│   │   └── portfolio/          # Portfolio management
│   └── tests/                  # 1520+ pytest tests
│
├── frontend/                   # ← React/Vite frontend
│   ├── src/
│   │   └── ui2/                # PRIMARY UI (pages, components, stores)
│   ├── tests/
│   │   └── e2e/                # 169 Playwright specs
│   └── playwright.config.ts
│
├── infrastructure/             # ← EXISTS, docker-compose files
│
├── scripts/                    # Dev/ops scripts (cleanup, determinism checks, etc.)
│
├── artifacts/                  # ← GITIGNORED, proof packs + evidence
│   └── proof/<timestamp>-<milestone>/
│
├── docs/
│   ├── AUDIT_NO_DEMO.md
│   └── TARGET_STRUCTURE.md     # This file
│
├── keys.env                    # GITIGNORED — all secrets
├── keys.env.example            # Template for required env vars
└── .gitignore
```

## Migration Notes

1. **phase1/** stays as the backend entry for now (too many imports depend on `phase1.services.*`)
2. **backend/** contains newer modules (core/startup_checks, domains/) that are imported by phase1 routes
3. **frontend/src/ui2/** is the PRIMARY UI — all other UIs are legacy
4. **Root node_modules/** should be removed (only frontend/node_modules/ is needed)
5. All test artifacts go to `artifacts/proof/` or are gitignored in place

## Port Configuration (Single Source of Truth)

| Component | Port | Env Var | Default |
|-----------|------|---------|---------|
| Backend (FastAPI) | 8090 | `APEX_BACKEND_PORT` | 8090 |
| Frontend (Vite) | 5100 | `APEX_FRONTEND_PORT` | 5100 |
| Elasticsearch | 9200 | `ELASTICSEARCH_URL` | http://localhost:9200 |
| PostgreSQL | 5432 | `POSTGRES_PORT` | 5432 |

These are read by:
- `phase1/services/config.py` (Settings.api_port)
- `frontend/vite.config.ts` (APEX_BACKEND_PORT)
- `frontend/playwright.config.ts` (APEX_BACKEND_PORT, APEX_FRONTEND_PORT)
- `GET /api/ops/config` (returns active config)
