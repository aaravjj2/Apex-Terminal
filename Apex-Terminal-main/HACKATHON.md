# HACKATHON.md — Week 1: Risk Desk Foundation

## One-Command Demo

```bash
make demo
```

This starts the backend (mock mode, no API keys needed) and frontend, then prints URLs.

**Or manually:**

```bash
# Terminal 1 — Backend
cd phase1
E2E_MODE=1 python3 -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

## Access the Risk Desk

1. Open **http://localhost:5100**
2. Click **Options** in the left nav sidebar
3. Click the **Risk Desk** tab in the Options header
4. Click **Load Demo Portfolio** → then **Validate**
5. See deterministic validation results (errors, warnings, summary)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/risk-desk/validate` | Validate portfolio CSV (upload file or `csv_text` form field) |
| `GET`  | `/api/risk-desk/demo-csv`  | Retrieve committed demo portfolio CSV text |

### Example: `POST /api/risk-desk/validate`

```bash
curl -X POST http://localhost:8000/api/risk-desk/validate \
  -F "file=@phase1/services/risk_desk/fixtures/demo_portfolio.csv"
```

**Response:**
```json
{
  "valid": true,
  "total_rows": 7,
  "error_count": 0,
  "warning_count": 2,
  "issues": [
    {
      "severity": "warning",
      "row": 5,
      "field": "symbol",
      "message": "Ticker 'BRK.B' normalized to 'BRK-B'.",
      "code": "TICKER_NORMALIZED"
    }
  ]
}
```

## Running Tests

### Backend unit tests (19 tests)

```bash
cd phase1 && python3 -m pytest tests/unit/test_risk_desk.py -v
```

### Playwright E2E tests (6 tests, with video + screenshots + traces)

```bash
cd frontend && npx playwright test --config=playwright.risk-desk.config.ts
```

Or via Makefile:

```bash
make test-risk-desk
```

### Artifact locations after E2E run

| Artifact | Path |
|----------|------|
| HTML Report | `frontend/playwright-report-risk-desk/index.html` |
| Videos | `frontend/test-results-risk-desk/*/video.webm` |
| Screenshots | `frontend/test-results-risk-desk/screenshots/*.png` |
| Traces | `frontend/test-results-risk-desk/*/trace.zip` |

## Environment

- No API keys required (mock/demo mode)
- No `.env.demo` needed — the system auto-detects demo mode when `E2E_MODE=1` is set
- Python 3.10+ and Node.js 18+ required

## What Was Added (vs. retained)

### New files (Week 1 Risk Desk)

```
phase1/services/risk_desk/
  __init__.py               # Module entry
  schemas.py                # Pydantic schemas
  validator.py              # Validation engine
  fixtures/
    demo_portfolio.csv      # Demo portfolio fixture
    demo_snapshot.json      # Synthetic snapshot fixture

phase1/services/api/routes/risk_desk.py   # API router

phase1/tests/unit/test_risk_desk.py       # 19 unit tests

frontend/src/features/options/riskDesk/
  index.ts                  # Barrel export
  types.ts                  # TypeScript types
  api.ts                    # API client
  RiskDeskPanel.tsx         # Main panel
  PortfolioUpload.tsx       # CSV upload component
  RunControls.tsx           # Validate button
  ValidationResults.tsx     # Results table

frontend/tests/e2e/risk-desk.spec.ts              # 6 Playwright tests
frontend/playwright.risk-desk.config.ts            # PW config with video=on

scripts/run_risk_desk_demo.sh              # Demo launcher
HACKATHON.md                               # This file
```

### Modified files

```
phase1/services/api/main.py               # Added risk_desk router import
Makefile                                   # Added demo + test-risk-desk targets
frontend/src/features/layout/views/OptionsView.tsx  # Added Risk Desk tab
```

### Retained (reused as-is)

- `phase1/services/api/routes/` pattern — followed existing router style
- `frontend/src/features/options/` — extended with riskDesk sub-feature
- `frontend/src/features/layout/views/OptionsView.tsx` — added tab
- All existing tests, configs, and components unchanged
