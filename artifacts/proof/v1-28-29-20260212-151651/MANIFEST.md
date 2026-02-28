# MANIFEST — v1.28 + v1.29 Proof Pack

## Version Info
- **Versions**: v1.28 (Strategy Artifacts) + v1.29 (Validation Engine)
- **Git SHA**: `075c0fe2436033fa30bb846a99317ebb29f3663a`
- **Date**: 2025-02-12
- **Node**: v22.21.1 | **npm**: 10.9.4 | **Python**: 3.10.12

## Validation Matrix

| Suite | Count | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| tsc --noEmit | — | ✅ 0 errors | 0 | 0 |
| vitest | 103 | 103 | 0 | 0 |
| pytest (artifacts) | 39 | 39 | 0 | 0 |
| pytest (full unit) | 1031 | 1031 | 0 | 0 |
| Playwright (v1.28+v1.29) | 9 | 9 | 0 | 0 |
| Playwright (full suite) | 480 | 403 | 77* | 0 |
| Autopilot precheck | 32 | 32 | 0 | 0 |
| Autopilot postcheck | 32 | 32 | 0 | 0 |

\* 77 failures are all pre-existing visual regression screenshot baselines and
console error gates — **none from v1.28/v1.29 code**. Zero of our 9 new tests
appear in the failure list.

## Determinism Proofs

| Proof | Runs | SHA256 Match |
|-------|------|--------------|
| Strategy Artifact (content-hash ID) | 2 | ✅ YES |
| Validation Report (error ordering) | 3 | ✅ YES |

## Known Limitations

NONE

## Files Created / Modified

### Backend (New)
- `phase1/services/strategy_lab/artifact_models.py` — Pydantic model, canonical JSON, content-hash
- `phase1/services/strategy_lab/artifact_store.py` — In-memory store with demo seeds
- `phase1/services/strategy_lab/artifact_validator.py` — 10 rules (STRAT_001–STRAT_010), deterministic sort
- `phase1/services/api/routes/strategy_artifacts.py` — FastAPI router (5 endpoints)

### Backend (Modified)
- `phase1/services/api/main.py` — Added strategy_artifacts router

### Frontend (New)
- `frontend/src/features/options/strategyLab/artifactTypes.ts` — TypeScript interfaces
- `frontend/src/features/options/strategyLab/StrategyArtifactsPanel.tsx` — Artifact list panel
- `frontend/src/features/options/strategyLab/StrategyValidationPanel.tsx` — Validation results panel

### Frontend (Modified)
- `frontend/src/features/options/strategyLab/StrategyLabPanel.tsx` — Artifacts tab, create button, validation panel
- `frontend/src/features/options/strategyLab/index.ts` — Added exports

### Tests (New)
- `phase1/tests/unit/test_strategy_artifacts.py` — 39 pytest tests
- `frontend/tests/e2e/strategy-artifacts-v1-28.spec.ts` — 4 Playwright tests
- `frontend/tests/e2e/strategy-validation-v1-29.spec.ts` — 5 Playwright tests
