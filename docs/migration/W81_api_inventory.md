# W81 API Inventory
**Generated:** 2026-02-23  
**Server:** `http://127.0.0.1:8090`  
**Source:** `phase1/services/api/main.py` + route files

---

## Tag: health

| Method | Path | File | Description |
|--------|------|------|-------------|
| GET | `/health` | `health_router.py` | Liveness + broker status |
| GET | `/api/v1/verification/alpaca/health` | `verification_routes.py` | Full Alpaca account check |
| GET | `/api/v1/autopilot/ws_status` | `unified_router.py` | WS connection count |
| GET | `/api/v2/broker/readiness` | various | Kill switch + broker mode |
| GET | `/api/v1/platform-health/summary` | `platform_health.py` | Component health summary |
| GET | `/api/v1/health` | `health_router.py` | Component status map |

## Tag: bars

| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/bars/{symbol}` | `bars.py` |
| GET | `/api/v1/bars/{symbol}/latest` | `bars.py` |

## Tag: backtest

| Method | Path | File |
|--------|------|------|
| POST | `/api/backtest/run` | `backtest.py` |
| GET | `/api/backtest/runs` | `backtest.py` |
| GET | `/api/backtest/runs/{run_id}` | `backtest.py` |
| POST | `/api/v21/backtest/run` | `w21_backtest_v4.py` |
| GET | `/api/v21/backtest/runs` | `w21_backtest_v4.py` |

## Tag: search

| Method | Path | File |
|--------|------|------|
| POST | `/api/v1/search` | `search.py` |
| GET | `/api/v1/search/suggest` | `search.py` |

## Tag: elasticsearch

| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/elasticsearch/health` | `w11_elasticsearch.py` |
| POST | `/api/v1/elasticsearch/search` | `w11_elasticsearch.py` |
| GET | `/api/v1/elasticsearch/indices` | `w11_elasticsearch.py` |
| GET | `/api/v46/elasticsearch/health` | `w46_elasticsearch_v3.py` |
| POST | `/api/v46/elasticsearch/search` | `w46_elasticsearch_v3.py` |

## Tag: autopilot

| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/autopilot/status` | `unified_router.py` |
| GET | `/api/v1/autopilot/ws_status` | `unified_router.py` |
| POST | `/api/v1/autopilot/start` | `unified_router.py` |
| POST | `/api/v1/autopilot/stop` | `unified_router.py` |
| WS | `/ws/autopilot` | `autopilot_websocket.py` |
| WS | `/ws/bars/{symbol}/{tf}` | `websocket.py` |

## Tag: broker

| Method | Path | File |
|--------|------|------|
| GET | `/api/v2/broker/readiness` | various |
| GET | `/api/v2/broker/positions` | various |
| GET | `/api/v2/broker/orders` | various |
| GET | `/api/v1/verification/alpaca/health` | `verification_routes.py` |

## Tag: strategies

| Method | Path | File |
|--------|------|------|
| GET | `/api/v1/strategies` | `strategies.py` |
| POST | `/api/v1/strategies` | `strategies.py` |
| GET | `/api/v1/strategies/{id}` | `strategies.py` |
| PUT | `/api/v1/strategies/{id}` | `strategies.py` |
| DELETE | `/api/v1/strategies/{id}` | `strategies.py` |

## Tag: ops (W81+ new — v3 prefix)

| Method | Path | File | Status |
|--------|------|------|--------|
| GET | `/api/v3/ops/health` | `ops_health.py` | exists in phase1 |
| GET | `/api/v3/ops/ws/health` | (W87) | planned |
| GET | `/api/v3/ops/elastic/health` | (W88) | planned |
| GET | `/api/v3/ops/broker/health` | (W88) | planned |
| GET | `/api/v3/events` | (W86) | planned |
| POST | `/api/v3/events/search` | (W86) | planned |
| GET | `/api/v3/evidence/graph` | (W93) | planned |

---

## Breaking Changes Planned (Waves 82-85)

| Action | Old Path | New Path | Wave |
|--------|----------|----------|------|
| Add stable prefix | `/api/backtest/*` | `/api/v3/backtest/*` | 85 |
| Deprecate | `/api/v1/elasticsearch/*` (proxy) | Direct ES on 9200 | 88 |
| Consolidate | `/api/v21/backtest/*` | `/api/v3/backtest/*` | 85 |
