# Fresh Clone Runbook

This document provides exact commands to run the TradingView Recreation project from a fresh clone.

## Prerequisites

- **Python 3.11+** (3.12 recommended)
- **Node.js 18+** and npm
- **Git**

## Quick Start (Demo Mode - No API Keys)

```bash
# 1. Clone the repository
git clone https://github.com/aaravjj2/tradingview-recreation.git
cd tradingview-recreation

# 2. Run the demo script (handles everything)
./scripts/run_demo.sh
```

**Expected Output:**
```
============================================
  🚀 Starting in DEMO MODE (no keys needed)
============================================

Backend will use mock data for Alpaca/Finnhub
Frontend will connect to http://localhost:8000

Starting backend...
Backend started (PID: XXXXX)
Waiting for backend to be ready...
Starting frontend...

============================================
  ✅ Demo is running!
============================================
  Frontend: http://localhost:5100
  Backend:  http://localhost:8000
  API Docs: http://localhost:8000/docs

  Press Ctrl+C to stop all services
============================================
```

## Manual Start (Two Terminals)

### Terminal 1: Backend

```bash
cd tradingview-recreation/phase1

# Create virtual environment (first time only)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using WatchFiles
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Terminal 2: Frontend

```bash
cd tradingview-recreation/frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
  VITE v6.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5100/
  ➜  Network: http://X.X.X.X:5100/
  ➜  press h + enter to show help
```

## Verification Steps

### 1. Backend Health Check
```bash
curl http://localhost:8000/api/v1/health
```

**Expected Response:**
```json
{"status": "healthy", "version": "1.0.0", ...}
```

### 2. Frontend Loads
Open http://localhost:5100 in your browser.

**Expected:**
- Command Center dashboard loads
- "PAPER MODE" banner visible at top
- Provider status indicators in top bar (may show "connecting" initially)

### 3. API Documentation
Open http://localhost:8000/docs

**Expected:**
- Swagger UI with all API endpoints
- Can test endpoints directly

## Running Tests

### Backend Tests
```bash
cd phase1
source venv/bin/activate
pytest -v
```

### Frontend Tests
```bash
cd frontend

# Unit tests
npm run test:unit

# E2E tests (requires servers running)
npx playwright test

# Specific test
npx playwright test tests/e2e/tts.spec.ts
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000
# Kill it
kill -9 <PID>

# Or use different ports
uvicorn services.api.main:app --port 8001
VITE_API_URL=http://localhost:8001 npm run dev
```

### pip install fails
```bash
# Ensure you're in the virtual environment
which python  # Should show venv/bin/python

# Upgrade pip first
pip install --upgrade pip

# Install with verbose output
pip install -r requirements.txt -v
```

### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Environment Variables (Optional - for Live Data)

Copy the example file and add your API keys:
```bash
cd phase1
cp keys.env.example keys.env
# Edit keys.env and add:
# ALPACA_API_KEY=your_key
# ALPACA_SECRET=your_secret
# FINNHUB_TOKEN=your_token
```

Then restart the backend to use live data.

---

**Last Verified:** 2026-02-02
