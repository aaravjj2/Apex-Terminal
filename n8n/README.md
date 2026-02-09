# n8n Automation for TradingView Recreation

This directory contains n8n Docker setup and workflows for automating the AI Options Autopilot system.

## Quick Start

### 1. Start n8n

```bash
cd n8n
docker compose up -d
```

### 2. Access n8n

Open http://localhost:5678 in your browser.

### 3. Import Workflows

1. In n8n, go to **Settings → Import**
2. Import JSON files from `/home/node/workflows/` (mounted inside container)
3. Or manually import from `n8n/workflows/` directory

### 4. Activate Workflows

1. Open each imported workflow
2. Toggle the "Active" switch in the top right
3. Verify the cron schedule in the trigger node

## Workflows

### Market Open Autopilot (`market_open_autopilot.json`)
**NEW: Primary workflow for daily automation**

**Schedule:** 09:30 AM America/New_York, weekdays only

**Flow:**
1. Cron trigger at market open
2. POST `/api/v1/autopilot/run` - Run autopilot cycle
3. Wait 30 seconds for processing
4. GET `/api/v1/verification/last_run` - Verify internal ledger
5. GET `/api/v1/brokers/alpaca/recent_activity` - Check Alpaca orders
6. Conditional: Log success or alert if no executions
7. GET `/api/v1/reports/daily` - Generate daily report

### Other Workflows
- `autopilot_scheduled_run.json` - Multiple scheduled runs per day
- `daily_report_generator.json` - End-of-day reporting
- `regime_change_handler.json` - Webhook-triggered risk adjustment

## Backend Requirements

Ensure the backend is running and accessible:

```bash
# Terminal 1: Start backend
cd phase1
source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

The n8n container connects to the backend via `host.docker.internal:8000`.

## Environment Variables

The docker-compose.yml sets:
- `TZ=America/New_York` - Timezone for cron schedules
- `BACKEND_URL=http://host.docker.internal:8000` - Backend connection

## Verification

After a scheduled run, verify execution:

```bash
# Check internal ledger
curl http://localhost:8000/api/v1/verification/last_run

# Check Alpaca orders
curl http://localhost:8000/api/v1/brokers/alpaca/recent_activity

# Check Alpaca health
curl http://localhost:8000/api/v1/verification/brokers/alpaca/health
```

## Troubleshooting

### n8n Can't Reach Backend
- Ensure backend is running on port 8000
- Check `host.docker.internal` resolves (Linux may need extra_hosts)
- Test: `docker exec n8n-autopilot wget -q -O- http://host.docker.internal:8000/health`

### Workflow Not Triggering
- Check workflow is active (toggle in n8n)
- Verify timezone settings
- Check n8n logs: `docker logs n8n-autopilot`

### API Errors
- Check backend logs for errors
- Verify endpoints exist: http://localhost:8000/docs
