# v1.28 + v1.29 Proof Pack

## What Was Built

### v1.28 — Strategy Artifacts
- **StrategyArtifact** Pydantic model with SHA-256 content-hash IDs
- Canonical JSON serialization ensuring deterministic byte output
- In-memory artifact store with demo seeds and idempotent creation
- REST API: `GET/POST /api/v1/strategy-artifacts`, `GET /{id}`, `POST /validate`, `POST /reset-demo`
- Frontend **Artifacts** tab in Strategy Lab with table listing all artifacts
- "Create Artifact" button producing artifacts with displayed content-hash IDs

### v1.29 — Validation Engine
- 10 validation rules (`STRAT_001`–`STRAT_010`) with deterministic ordering
- Errors/warnings sorted by `(rule_id, path, message)` for reproducibility
- Input checksum for request fingerprinting
- Frontend **Validation Panel** showing grouped errors/warnings with rule IDs
- "Run Validation" button triggering live validation against the API

## Reproduce

```bash
# 1. Start backend
cd phase1
PYTHONPATH="$PWD:$PYTHONPATH" E2E_MODE=1 DEMO_MODE=1 \
  python3 -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 &

# 2. Build + preview frontend
cd ../frontend
npm run build && npx vite preview --port 5100 &

# 3. Run v1.28+v1.29 E2E tests
npx playwright test tests/e2e/strategy-artifacts-v1-28.spec.ts \
                     tests/e2e/strategy-validation-v1-29.spec.ts \
  --workers=1 --retries=0

# 4. Run backend unit tests
cd ../phase1
PYTHONPATH="$PWD:$PYTHONPATH" pytest tests/unit/test_strategy_artifacts.py -v

# 5. Full validation matrix
cd ../frontend
npx tsc --noEmit          # 0 errors
npx vitest run            # 103 passed
cd ../phase1
PYTHONPATH="$PWD:$PYTHONPATH" pytest tests/unit/ -v  # 1031 passed
```

## Proof Pack Contents

```
v1-28-29-20260212-151651/
├── MANIFEST.md              ← This manifest
├── manifest.json            ← Machine-readable manifest
├── README.md                ← This file
├── determinism/
│   ├── inputs.strategy_spec.json
│   ├── inputs.validation_spec.json
│   ├── output.strategy_artifact.json
│   ├── output.strategy_artifact.sha256
│   ├── output.strategy_artifact_run1.json
│   ├── output.strategy_artifact_run2.json
│   ├── output.validation_report.json
│   ├── output.validation_report.sha256
│   ├── output.validation_report_run1.json
│   ├── output.validation_report_run2.json
│   ├── output.validation_report_run3.json
│   └── proof.txt
├── logs/
│   ├── 00-autopilot-precheck-env.txt
│   ├── 00-autopilot-precheck-run1.txt
│   ├── 00-autopilot-precheck-run2.txt
│   ├── 01-autopilot-postcheck-run1.txt
│   ├── 01-autopilot-postcheck-run2.txt
│   ├── 02-playwright-full.txt
│   ├── 02-pytest-artifacts.txt
│   ├── 02-pytest-full.txt
│   ├── 02-tsc.txt
│   └── 02-vitest.txt
├── playwright-report/       ← Full HTML report
└── screenshots/             ← Test result screenshots
```
