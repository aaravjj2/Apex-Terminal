# Apex Terminal — Submission Checklist

## ElastiHack Requirements

- [x] Elasticsearch 8.x used as primary operational store
- [x] Multiple ES indices (apex-tickets, apex-controls-*, apex-perf-budget)
- [x] Elastic Agent Builder integration (AI agent with ES queries + LLM reasoning)
- [x] Tool trace documented in `docs/submission/ELASTIHACK.md`
- [x] Citations from ES in audit trail (`ticket_audit_events.details`)
- [x] Safe action with RBAC gate demonstrated
- [x] OSI license (MIT) in `LICENSE`
- [x] Demo script in `docs/submission/ELASTIHACK.md` (~3 min)
- [x] Architecture diagram in `docs/ARCHITECTURE.md`

## TERRACODE Requirements

- [x] Problem clearly stated
- [x] Solution with AI component explained
- [x] Stack documented
- [x] How AI is used described
- [x] Demo script (2-3 min) in `docs/submission/TERRACODE.md`
- [x] Reproducible judge bundle (export bundle)
- [x] OSI license (MIT)

## Technical Requirements

- [x] Backend: FastAPI + Python 3.14
- [x] Frontend: React 18 + TypeScript
- [x] Elasticsearch 8.12 running at localhost:9200
- [x] All 5 service stack runs via `docker compose -f docker-compose.judge.yml up -d`
- [x] 3 commands to run locally (see `docs/RUN_LOCAL.md`)
- [x] Deterministic export bundle with SHA256 manifest
- [x] pytest: 0 failed, 0 skipped across all waves
- [x] Playwright: 0 failed, 0 skipped across all waves (headed, workers=1, retries=0)
- [x] All E2E tests use only `data-testid` selectors (no getByText/getByRole)
- [x] No `waitForTimeout` in any test file

## Wave Completion Status

| Wave | Description                    | pytest | Playwright |
|------|-------------------------------|--------|------------|
| W81-W103 | Core platform waves   | ✅ ×2  | ✅ ×2      |
| W104 | Accessibility audit           | ✅ ×2  | ✅ ×2      |
| W105 | Perf budget                   | ✅ ×2  | ✅ ×2      |
| W106 | Controls domain               | ✅ ×2  | ✅ ×2      |
| W107 | Safe actions (RBAC tickets)   | ✅ ×2  | ✅ ×2      |
| W108 | Export bundle                 | ✅ ×2  | ✅ ×2      |
| W109 | Docker compose + judge mode   | ✅ ×2  | ✅ ×2      |
| W110 | Submission kit v1             | ✅ ×2  | ✅ ×2      |

## Pre-submission Validation

Before submitting, verify:

```bash
# 1. All pytest passing
python -m pytest backend/tests/integration/ -q
# Expected: 0 failed, 0 skipped

# 2. All Playwright passing
cd frontend && npx playwright test tests/e2e/hardening/ --headed --workers=1 --retries=0
# Expected: 0 failed, 0 skipped

# 3. Export bundle deterministic
curl -X POST http://localhost:8090/api/v3/export/bundle
curl -X POST http://localhost:8090/api/v3/export/bundle
# bundle_hash should be identical both times (if data hasn't changed)

# 4. ES healthy
curl http://localhost:9200/_cluster/health
# status: green or yellow
```
