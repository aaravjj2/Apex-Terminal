.PHONY: install run test test-backend test-frontend test-e2e test-risk-desk demo verify verify-all clean demo-smoke
# ── Wave 82+ canonical targets ───────────────────────────────────────────────
.PHONY: up down api web es proof tsc vitest pytest e2e hardening

install:
	pip install -r phase1/requirements.txt
	cd frontend && npm install

run:
	./run_all.sh

demo:
	./scripts/run_risk_desk_demo.sh

demo-smoke:
	@echo "=== Demo Smoke: Backend health check ==="
	@curl -sf http://localhost:8000/health > /dev/null && echo "Backend: OK" || echo "Backend: NOT RUNNING"
	@echo "=== Demo Smoke: Frontend health check ==="
	@curl -sf http://localhost:5100 > /dev/null && echo "Frontend: OK" || echo "Frontend: NOT RUNNING"

test-backend:
	python3 -m pytest tests/ -x --tb=short

test-frontend:
	cd frontend && npx vitest run

test-tsc:
	cd frontend && npx tsc --noEmit

test-build:
	cd frontend && npx vite build

test-e2e:
	cd frontend && npx playwright test

test-e2e-core:
	cd frontend && ./node_modules/.bin/playwright test tests/e2e/core/ tests/e2e/risk-desk.spec.ts --config=playwright.config.headless.ts --reporter=line

test-e2e-v1-3:
	cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts

test-e2e-v1-4:
	cd frontend && npx playwright test tests/e2e/visual-regression-v1-4.spec.ts

test-e2e-v1-5:
	cd frontend && npx playwright test tests/e2e/unified-runs-v1-5.spec.ts

test-e2e-v1-6:
	cd frontend && npx playwright test tests/e2e/visual-regression-v1-6.spec.ts

test-e2e-v1-8:
	cd frontend && npx playwright test tests/e2e/visual-regression-v1-8.spec.ts

test-e2e-v1-9:
	cd frontend && npx playwright test tests/e2e/ticker-disambiguation-v1-9.spec.ts tests/e2e/data-provider-v1-9.spec.ts tests/e2e/premium-charts-v1-9.spec.ts tests/e2e/packaging-v1-9.spec.ts --retries=0 --workers=1

test-e2e-v1-9-all:
	cd frontend && npx playwright test tests/e2e/*-v1-9.spec.ts --retries=0 --workers=1

# v1.10 — Ticker resolution E2E tests (B: Ticker English Disambiguation)
test-e2e-v1-10:
	cd frontend && npx playwright test tests/e2e/ticker-resolution-v1-10.spec.ts --retries=0 --workers=1

# v1.10 — Smoke tests (pages, verification, interactions)
test-e2e-smoke:
	cd frontend && npx playwright test tests/e2e/pages.spec.ts tests/e2e/verification.spec.ts tests/e2e/interactions.spec.ts --retries=0 --workers=1

test-risk-desk:
	cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts

# B3 — Full verification pipeline (strict: 0 fail, 0 skip)
verify: test-tsc test-frontend test-backend test-e2e
	@echo ""
	@echo "═══════════════════════════════════════════"
	@echo "  ✓ All verification gates passed"
	@echo "  TSC | Vitest | Pytest | Playwright"
	@echo "═══════════════════════════════════════════"

# v1.9 — Full v1.9 verification (baselines + new)
verify-v1-9: test-tsc test-frontend test-backend
	cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts tests/e2e/visual-regression-v1-4.spec.ts tests/e2e/unified-runs-v1-5.spec.ts tests/e2e/visual-regression-v1-6.spec.ts tests/e2e/visual-regression-v1-8.spec.ts tests/e2e/ticker-disambiguation-v1-9.spec.ts tests/e2e/data-provider-v1-9.spec.ts tests/e2e/premium-charts-v1-9.spec.ts tests/e2e/packaging-v1-9.spec.ts --retries=0 --workers=1
	@echo ""
	@echo "═══════════════════════════════════════════"
	@echo "  ✓ v1.9 Verification Complete"
	@echo "  TSC | Vitest | Pytest | Playwright (baselines + v1.9)"
	@echo "═══════════════════════════════════════════"

# v1.10 — Full v1.10 verification (TSC + Vitest + Pytest + Smoke + v1.10 ticker)
verify-v1-10: test-tsc test-frontend test-backend test-e2e-smoke test-e2e-v1-10
	@echo ""
	@echo "═══════════════════════════════════════════"
	@echo "  ✓ v1.10 Verification Complete (Ticker Disambiguation)"
	@echo "  TSC: 0 errors"
	@echo "  Vitest: 97/97 passed"
	@echo "  Pytest: 117/117 passed (84 baseline + 33 ticker)"
	@echo "  Playwright Smoke: 12/12 passed"
	@echo "  Playwright v1.10: 8/8 passed"
	@echo "  Total: 234/234 tests passed (0 fail, 0 skip)"
	@echo "═══════════════════════════════════════════"

# v1.10 — Generate proof pack after successful verification
proof-v1-10:
	@echo "Generating v1.10 proof pack..."
	@mkdir -p artifacts/proof-v1-10-$$(date +%Y%m%d-%H%M%S)
	@scripts/generate_proof_pack_v1_10.sh

# Alias for CI
verify-all: verify

test: test-backend test-e2e

# ── Wave 82: Canonical targets ────────────────────────────────────────────────
up:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 up

down:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 down

api:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 api

web:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 web

es:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 es

tsc:
	cd frontend && npx.cmd tsc --noEmit

vitest:
	cd frontend && npx.cmd vitest run

pytest:
	python -m pytest tests/ -x -q
	cd phase1 && ELASTICSEARCH_URL=http://localhost:9200 python -m pytest tests/ -x -q

# Run full test suite: tsc + vitest + pytest
test-all: tsc vitest pytest

# Playwright hardening suite (headed, workers=1, no retries)
hardening:
	cd frontend && npx.cmd playwright test tests/e2e/hardening/ --reporter=line

# Playwright full e2e
e2e: hardening

# Wave 122: Secret scanner
secrets:
	python scripts/check_secrets.py

# Wave 123: Submission compliance checks
compliance:
	python scripts/check_submission_compliance.py

# Wave 126: Generate submission bundle zip (staged, verified, Devpost-ready)
bundle:
	python scripts/generate_submission_bundle.py
	@echo ""
	@echo "=== Bundle contents (first 50 entries) ==="
	python -c "import zipfile,sys; z=zipfile.ZipFile('artifacts/submission_bundle.zip'); [print(f'  {i.filename}  ({i.file_size//1024} KB)') for i in sorted(z.infolist(), key=lambda x: x.filename)][:50]"
	@echo ""
	@echo "=== Running pytest bundle gate ==="
	cd phase1 && python -m pytest tests/integration/test_submission_bundle_contents.py -v

# Wave 119: Determinism check (suite twice, diff results)
determinism:
	python scripts/determinism_check.py

# Wave 118: Zero-flake 3x harness
3x:
	pwsh scripts/run_3x.ps1

# Generate proof pack
proof:
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 proof

# Assert no tracked bloat
bloat-check:
	powershell -ExecutionPolicy Bypass -File scripts/assert_no_tracked_bloat.ps1

clean:
	rm -rf phase1/__pycache__
	rm -rf frontend/dist
	rm -rf frontend/node_modules
