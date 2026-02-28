# Apex Terminal  Baseline Audit
Generated: 2026-02-23 13:44:42

## Git SHA
7030dfb985399244836118a4e725157bf789e5dd

## Versions
- Python: Python 3.14.3
- Node: v24.13.1

## Detected Services
- Backend: http://localhost:8090 (FastAPI/uvicorn)
- Frontend: http://localhost:5100 (Vite dev)
- Elasticsearch: http://localhost:9200

## Active Providers (from /health)
{   "status": "healthy",   "alpaca_configured": true,   "alpaca_connected": true,   "tradier_configured": true,   "tradier_connected": true,   "options_provider": "tradier",   "bars_source": "alpaca",   "mode": "paper" }

## Ops Health (from /api/v3/ops/health)
{   "correlation_id": "642fac04-bf46-4cb6-85ea-f7bf5bfb96f2",   "ready": true,   "checked_at": 1771872282.7078984,   "dependencies": {     "elasticsearch": {       "connected": true,       "cluster_status": "yellow",       "cluster_name": "apex-local",       "node_count": 1,       "latency_ms": 732.1     },     "broker": {       "connected": true,       "account_status": "ACTIVE",       "account_number": "PA3LZE4BFKOG",       "trading_blocked": false,       "cash": 983103.8,       "latency_ms": 334.2     }   } }
