# Playwright MCP Headed Mode - Reproduction Runbook

This document describes the exact commands executed for the Playwright MCP headed test session.

## Prerequisites

```bash
# Environment
Node v22.21.1
npm 10.9.4
Python 3.10.12
Git SHA: 075c0fe2436033fa30bb846a99317ebb29f3663a
Repository: /home/aarav/Aarav/Tradingview recreation
```

## 1. Environment Setup

```bash
# Create proof directory
mkdir -p "artifacts/proof/playwright-mcp-headed-20260213-010452/logs"
mkdir -p "artifacts/proof/playwright-mcp-headed-20260213-010452/screenshots"

# Log environment
{
  echo "=== Environment @ $(date -Iseconds) ==="
  echo "Node: $(node --version)"
  echo "npm: $(npm --version)"
  echo "Python: $(python3 --version)"
  echo "Git: $(git log -1 --oneline)"
  echo "Git SHA: $(git rev-parse HEAD)"
} > artifacts/proof/playwright-mcp-headed-20260213-010452/logs/00-environment.log
```

## 2. Frontend Build

```bash
cd frontend
npm run build

# Output:
# vite v5.4.11 building for production...
# ✓ 1627.97 kB │ gzip: 459.84 kB
# ✓ built in 4.13s
```

## 3. Clear Old Servers

```bash
pkill -f "uvicorn phase1"
pkill -f "vite preview"
```

## 4. Start Backend Server

```bash
cd /home/aarav/Aarav/Tradingview recreation
PYTHONPATH="$PWD/phase1:$PYTHONPATH" \
E2E_MODE=1 \
DEMO_MODE=1 \
python3 -m uvicorn phase1.services.api.main:app --host 0.0.0.0 --port 8000 \
> /tmp/backend-headed.log 2>&1 &

# Verify health
curl -s http://localhost:8000/health | jq .
# Output: {"status":"healthy","alpaca_configured":true,...}
```

## 5. Start Preview Server

```bash
cd /home/aarav/Aarav/Tradingview recreation/frontend
npx vite preview --port 5100 > /tmp/preview-headed.log 2>&1 &

# Verify
curl -s -I http://localhost:5100/ | head -3
# Output: HTTP/1.1 200 OK
```

## 6. Run Playwright Tests (Headed Mode)

```bash
cd /home/aarav/Aarav/Tradingview recreation/frontend

# Configuration in playwright.config.ts:
# - workers: 1
# - retries: 0
# - video: 'on'
# - trace: 'on'
# - screenshot: 'on' 
# - headed: true (via --headed flag)
# - baseURL: http://localhost:5100

# Run all tests
npx playwright test --headed --workers=1 --retries=0 2>&1 | tee /tmp/playwright-headed-run.log
```

## 7. Results

**Run #1** (Partial):
- Tests discovered: 508
- Tests executed: 244 (48%)
- Passed: 243
- Failed: 1 (test #242: "15 - Backtest: Run Backtest Completes")
- Process stopped at test #244

**Run #2**:
- Interrupted immediately (Ctrl+C)

## 8. Evidence Locations

### Logs
```bash
artifacts/proof/playwright-mcp-headed-20260213-010452/logs/
├─ 00-environment.log         # Node/Python versions, git info
├─ 04-health-checks.log        # Server health status
├─ 05-playwright-partial-run.log  # Full test output (244 tests)
└─ 06-rerun-reason.txt         # Documentation of partial run
```

### Test Artifacts
```bash
frontend/test-results/         # 247 test result directories
frontend/playwright-report/    # HTML report
frontend/test-results/stability-coverage-v1-3-Ba-41e1e-Completes-status-completed--chromium/
├─ trace.zip                   # Playwright trace (2.3 MB)
├─ video.webm                  # Test video (467 KB)
├─ test-failed-1.png          # Failure screenshot (114 KB)
└─ error-context.md           # Failure context
```

## 9. Reproducing This Run

```bash
# 1. Checkout exact commit
git checkout 075c0fe2436033fa30bb846a99317ebb29f3663a

# 2. Install dependencies (if needed)
cd frontend && npm install
cd ..

# 3. Build frontend
cd frontend && npm run build && cd ..

# 4. Start servers (in separate terminals or background)
# Terminal 1: Backend
PYTHONPATH="$PWD/phase1:$PYTHONPATH" E2E_MODE=1 DEMO_MODE=1 \
  python3 -m uvicorn phase1.services.api.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Preview
cd frontend && npx vite preview --port 5100

# Terminal 3: Tests
cd frontend && npx playwright test --headed --workers=1 --retries=0
```

## 10. Known Issues

1. **Test #242 Failure**: Backtest completion test failed - run-status-badge not visible
2. **Snapshot Failures**: 8 visual regression tests failed (may need baseline update)
3. **Console Errors**: `f.find is not a function` detected in packaging tests
4. **Incomplete Run**: Process stopped at test #244/508

## 11. Trace Analysis

To view failed test #242 trace:
```bash
cd frontend
npx playwright show-trace test-results/stability-coverage-v1-3-Ba-41e1e-Completes-status-completed--chromium/trace.zip
```

## 12. HTML Report

To view the HTML report:
```bash
cd frontend
npx playwright show-report playwright-report
```

---

**Generated**: 2026-02-13 01:22 EST
**Proof Directory**: `/home/aarav/Aarav/Tradingview recreation/artifacts/proof/playwright-mcp-headed-20260213-010452/`
