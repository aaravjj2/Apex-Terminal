# TradingView Recreation - Operational Runbook

## Overview

This runbook covers how to run the paper trading pipeline, verify trades, and troubleshoot issues.

---

## 1. Starting the System

### Backend (Required)

```bash
cd /home/aarav/Aarav/Tradingview\ recreation/phase1
source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify:** http://localhost:8000/docs shows API documentation.

### Frontend (Optional)

```bash
cd /home/aarav/Aarav/Tradingview\ recreation/frontend
npm run dev
```

**Verify:** http://localhost:5100 shows the trading interface.

### n8n Automation (Optional)

```bash
cd /home/aarav/Aarav/Tradingview\ recreation/n8n
docker compose up -d
```

**Verify:** http://localhost:5678 shows n8n interface.

---

## 2. Manual Autopilot Trigger

### Run Autopilot

```bash
curl -X POST http://localhost:8000/api/v1/autopilot/run \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "force": false}'
```

**Expected Response:**
```json
{
  "run_id": "run-uuid-here",
  "status": "completed",
  "message": "Autopilot run completed",
  "candidates_count": 5,
  "selected_count": 2,
  "executed_count": 1
}
```

### Check Status

```bash
curl http://localhost:8000/api/v1/autopilot/status
```

### Get Last Run Summary

```bash
curl http://localhost:8000/api/v1/autopilot/last_run_summary
```

### Get Open Positions

```bash
curl http://localhost:8000/api/v1/autopilot/positions
```

---

## 3. Verifying Trades Occurred

### Method A: Internal Ledger (Always Works)

```bash
curl http://localhost:8000/api/v1/verification/last_run
```

**Look for:**
- `verified_count > 0` - Trades were verified
- `discrepancy_count == 0` - No issues found

### Method B: Alpaca API (External Verification)

```bash
# Check Alpaca health
curl http://localhost:8000/api/v1/verification/brokers/alpaca/health

# Get recent Alpaca activity
curl http://localhost:8000/api/v1/brokers/alpaca/recent_activity
```

**Expected Alpaca Health:**
```json
{
  "status": "healthy",
  "api_reachable": true,
  "account_status": "ACTIVE",
  "trading_blocked": false,
  "portfolio_value": 100000.0
}
```

---

## 4. Configuration

### API Keys

All keys are in `phase1/keys.env`:

| Key | Purpose |
|-----|---------|
| `GROQ_API_KEY` | Fast LLM ranking |
| `GEMINI_API_KEY` | LLM explanations |
| `TRADIER_BROKERAGE_KEY` | Real-time options data |
| `APCA_API_KEY_ID` | Alpaca paper trading |
| `APCA_API_SECRET_KEY` | Alpaca secret |

### LLM Mode

Set `LLM_MODE` in keys.env:
- `off` - No LLM, deterministic only
- `groq` - Groq only
- `gemini` - Gemini only
- `hybrid` - Groq ranks, Gemini validates (recommended)
- `deterministic` - Score-based fallback

---

## 5. Running Tests

### Backend Tests

```bash
cd /home/aarav/Aarav/Tradingview\ recreation/phase1
source venv/bin/activate
pytest tests/ -v
```

**Expected:** All tests pass, 0 skipped.

### Frontend Tests

```bash
cd /home/aarav/Aarav/Tradingview\ recreation/frontend
npm run test:unit
npm run test:e2e
```

---

## 6. Troubleshooting

### No Trades Executed

1. Check if kill switch is active:
   ```bash
   curl http://localhost:8000/api/v1/autopilot/status
   ```

2. Check risk limits - may be exceeded:
   ```bash
   curl http://localhost:8000/api/v1/autopilot/last_run_summary
   ```

3. Check market hours - autopilot may reject outside hours

### LLM Errors

1. Verify keys are set in `phase1/keys.env`
2. Check mode: `LLM_MODE=hybrid`
3. System falls back to deterministic if LLM fails

### Alpaca Connection Issues

1. Check credentials in keys.env
2. Verify paper trading endpoint: `https://paper-api.alpaca.markets`
3. Test health: `curl http://localhost:8000/api/v1/verification/brokers/alpaca/health`

---

## 7. Daily Operations

### Market Open Checklist

1. ✅ Backend running on port 8000
2. ✅ n8n container running
3. ✅ Market open workflow active
4. ✅ Kill switch deactivated

### End of Day

1. Check daily report:
   ```bash
   curl http://localhost:8000/api/v1/reports/daily
   ```

2. Review positions:
   ```bash
   curl http://localhost:8000/api/v1/autopilot/positions
   ```

3. Check for any discrepancies:
   ```bash
   curl http://localhost:8000/api/v1/verification/last_run
   ```
