# v1.12 / v1.13 Acceptance Testing - README

## Quick Start

### 1. View Full Documentation
```bash
cat MANIFEST.md
```

### 2. Reproduce Test Run

**Prerequisites:**
- Backend server running on port 8000
- Frontend server running on port 5100

**Verify servers:**
```bash
curl http://localhost:8000/health
curl http://localhost:5100/
```

**Run full suite:**
```bash
cd "/home/aarav/Aarav/Tradingview recreation/frontend"
npx playwright test --reporter=list

# Expected: ~365 passed, ~60 failed, 0 skipped (28 minutes)
```

### 3. Verify Category 1 Fix (Market Data API)

```bash
cd "/home/aarav/Aarav/Tradingview recreation/frontend"
npx playwright test market-data-providers-v1-11 --reporter=line

# Expected: 6 passed (2 seconds)
```

### 4. View HTML Report

```bash
cd "/home/aarav/Aarav/Tradingview recreation/frontend"
npx playwright show-report
```

### 5. Inspect Test Failure

```bash
# Example: View trace for a failed test
cd "/home/aarav/Aarav/Tradingview recreation/frontend"
npx playwright show-trace test-results/<test-name>/trace.zip
```

---

## Key Files

| File | Description |
|------|-------------|
| `MANIFEST.md` | Full session report with root cause analysis |
| `README.md` | This file (quick reference) |
| `logs/playwright-list.txt` | Full test discovery (425 tests) |
| `logs/playwright-full-run-final.txt` | Baseline run results (361/64/0) |
| `logs/playwright-failures-list.txt` | All 64 failures extracted |
| `logs/final-phase0/versions.txt` | Environment baseline |
| `logs/final-phase0/git-sha.txt` | Git commit SHA |

---

## Summary

**Achievements:**
- ✅ 425 tests discovered (full suite)
- ✅ Infrastructure stabilized (servers operational)
- ✅ 4 API tests fixed (market-data-providers-v1-11)
- ✅ ~86% pass rate (365/425)
- ✅ 0 skipped tests

**Remaining Work:**
- ❌ ~60 failures in 6 categories
- ⚠️ 14-21 hours estimated effort
- ⚠️ 4 tests blocked on unimplemented backend API

**Status:** PARTIAL ACCEPTANCE

See `MANIFEST.md` for complete root cause analysis and remediation roadmap.

---

## Session Details

- **Date:** 2026-02-11
- **Git SHA:** 075c0fe2436033fa30bb846a99317ebb29f3663a
- **Node:** v22.21.1
- **Python:** 3.10.12
- **Runtime:** 27.5 minutes (full suite)
