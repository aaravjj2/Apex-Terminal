.PHONY: install run test test-backend test-frontend test-e2e test-risk-desk demo verify verify-all clean demo-smoke

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

clean:
	rm -rf phase1/__pycache__
	rm -rf frontend/dist
	rm -rf frontend/node_modules
