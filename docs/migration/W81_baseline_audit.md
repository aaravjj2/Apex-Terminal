# W81 Baseline Audit — Apex Terminal
**Date:** 2026-02-23  
**Purpose:** Exact snapshot of current state before refactor begins.

---

## 1. Entrypoints

### Backend
| Role | Path | Command |
|------|------|---------|
| Primary FastAPI app | `phase1/services/api/main.py` | `uvicorn phase1.services.api.main:app --host 0.0.0.0 --port 8090` |
| Phase1 in-dir boot | `phase1/services/api/main.py` | `cd phase1 && uvicorn services.api.main:app --host 0.0.0.0 --port 8090` |
| WebSocket manager | `phase1/services/api/websocket.py` | loaded by main.py lifespan |
| Autopilot service | `phase1/services/autopilot/service.py` | loaded by main.py lifespan |
| Portfolio router | `phase1/services/portfolio/portfolio_router.py` | loaded by main.py |

### Frontend
| Role | Path | Command |
|------|------|---------|
| Vite dev server | `frontend/` | `cd frontend && npm run dev -- --port 5100` |
| Vite build | `frontend/` | `cd frontend && npm run build` |
| Vite preview | `frontend/` | `cd frontend && npm run preview -- --port 5100` |
| UI2 root component | `frontend/src/ui2/AppShellUI2.tsx` | mounted at `/ui2/*` |
| UI2 routes | `frontend/src/ui2/routes.tsx` | 70+ routes |

---

## 2. API Prefixes (currently exposed on port 8090)

| Prefix | File | Description |
|--------|------|-------------|
| `/health` | `health_router.py` | Liveness + broker health |
| `/api/v1/bars` | `routes/bars.py` | Market bars |
| `/api/v1/ingest` | `routes/ingest.py` | Data ingestion |
| `/api/v1/strategies` | `routes/strategies.py` | Strategy CRUD |
| `/api/v1/portfolio` | `routes/portfolio.py` | Portfolio state |
| `/api/v1/alerts` | `routes/alerts.py` | Alert management |
| `/api/v1/backtests` | `routes/backtest.py` | Backtest runs |
| `/api/backtest` | `routes/backtest.py` | Backtest (legacy prefix) |
| `/api/v1/autopilot` | `unified_router.py` | Autopilot control |
| `/api/v1/search` | `routes/search.py` | Search API |
| `/api/v1/agents` | `routes/agents.py` | Agent runs |
| `/api/v1/verification` | `verification_routes.py` | Alpaca/broker verification |
| `/api/v1/platform-health` | `routes/platform_health.py` | Platform health summary |
| `/api/v2/broker` | Various | Broker operations |
| `/api/v3/ops` | `routes/ops_health.py` | Ops health (Phase1 only) |
| `/api/v1/elasticsearch` | `routes/w11_elasticsearch.py` | ES gateway (Waves 11-20) |
| `/api/v46/elasticsearch` | `routes/w46_elasticsearch_v3.py` | ES v3 (Waves 21-50) |
| `/ws/autopilot` | `autopilot_websocket.py` | Autopilot WebSocket |
| `/ws/bars/{symbol}/{tf}` | `websocket.py` | Bars WebSocket |

---

## 3. WebSocket Endpoints

| URL | Purpose | Auth |
|-----|---------|------|
| `ws://127.0.0.1:8090/ws/autopilot` | Autopilot real-time ticks | None |
| `ws://127.0.0.1:8090/ws/bars/{symbol}/{timeframe}` | Live bars stream | None |

---

## 4. Elasticsearch Endpoints & Index Conventions

| Index | Purpose | Alias |
|-------|---------|-------|
| `apex-trades` | Trade records | — |
| (planned) `apex-events-*` | Audit events | `apex-events-write`, `apex-events-read` |
| (planned) `apex-strategies-*` | Strategies | `apex-strategies-write`, `apex-strategies-read` |

ES cluster: `apex-local` at `localhost:9200`, security disabled, single-node (yellow).

ES Backend proxy: `GET /api/v1/elasticsearch/*` and `GET /api/v46/elasticsearch/*`

---

## 5. Gold Commands (currently working)

```powershell
# TypeScript compile check
cd frontend; npx.cmd tsc --noEmit

# Frontend unit tests
cd frontend; npx.cmd vitest run

# Root pytest (488 tests)
cd "c:\Tradingview\Tradingview recreation"; C:\Python314\python.exe -m pytest tests/ -x -q

# Phase1 pytest (1520 tests)
cd phase1; $env:ELASTICSEARCH_URL="http://localhost:9200"; C:\Python314\python.exe -m pytest tests/ -x -q

# Playwright hardening suite
cd frontend; npx.cmd playwright test tests/e2e/hardening/ --reporter=line

# Start backend
cd phase1; C:\Python314\python.exe -m uvicorn services.api.main:app --host 0.0.0.0 --port 8090

# Start frontend (dev)
cd frontend; npm run dev -- --port 5100

# Start Elasticsearch
Start-Process "$env:USERPROFILE\elasticsearch\elasticsearch-8.17.0\bin\elasticsearch.bat" -WindowStyle Hidden
```

---

## 6. Top 25 Pain Points (to be eliminated)

1. **Dual entrypoint confusion** — backend runs as `phase1/services/api/main.py` with no clear `backend/` top-level folder
2. **No canonical monorepo layout** — `frontend/` + `phase1/` scattered at root, no `backend/` or `infrastructure/`
3. **No Makefile/dev.ps1** — commands must be remembered from docs, no `make up/down/test/e2e/proof`
4. **Wave-module layout** — code lives in `phase1/services/waves11_20/` and `waves21_50/` instead of domain folders
5. **No config validation** — missing keys fail silently or at runtime, not at startup
6. **Mock/demo fallbacks** — ingestion has yfinance fallback even in online-only mode
7. **No event bus** — state changes not emitted as structured events; no audit trail
8. **ES not wired for all backends** — `/api/v2/elasticsearch/health` returns 500 on the original server
9. **No import boundary tests** — cross-domain imports happen silently
10. **Playwright uses HMR/dev** — tests should run against `vite build && vite preview`
11. **No persistent browser context** — Playwright boots new browser per test file
12. **WS disconnect not surfaced in UI** — no global indicator, no auto-reconnect proof
13. **Hardcoded testids scattered** — inconsistent naming, `*-ready` vs `*-ui2-page`
14. **No DLQ for ES ingest** — failures drop silently
15. **No evidence graph** — no edge/node traceability across entities
16. **Agent tool calls not logged** — no structured trace for citations
17. **No command palette** — navigation is sidebar-only, not demo-friendly
18. **`*.Zone.Identifier` files committed** — Windows metadata noise in repo
19. **`node_modules/` referenced from root** — root `package.json` present, duplicating frontend
20. **No retention policy** — `test-results/`, `playwright-report/`, `logs/` may be committed
21. **No domain-level DTO contracts** — schemas duplicated across route files
22. **No safe actions (tickets)** — agents cannot create auditable actions
23. **No walk-forward + robustness UI** — `WalkForwardUI2` exists but lacks proper fold data
24. **No submission kit** — no `docs/submission/TERRACODE.md` or `ELASTIHACK.md`
25. **No TOUR webm** — proof pack lacks the 2–3 min demo video

---

## 7. Acceptance Criteria for W81

- [x] `scripts/tree_snapshot.ps1` produces identical output on two runs
- [x] `docs/migration/W81_tree_before.txt` generated
- [x] `docs/migration/W81_dep_audit.json` generated
- [x] `docs/migration/W81_move_map.yaml` generated
- [x] `docs/migration/W81_api_inventory.md` generated
- [x] `frontend/tests/e2e/hardening/w81-baseline-health.spec.ts` added
- [x] `backend/tests/integration/test_w81_health_contract.py` added
- [x] `scripts/assert_no_tracked_bloat.ps1` created
