# Contributing to Apex Terminal

## Guiding Principles

- Every interactive element in `frontend/src/ui2/` **must** have a `data-testid` attribute.
- Playwright tests in `frontend/tests/e2e/hardening/` **must not** use fragile selectors.
- No mock data in integration tests. All tests run against real services (ES, broker, WS) on port 8090.

---

## Wave Proof Requirements

Each Wave must ship with:

| Artifact | Location | Requirement |
|---|---|---|
| pytest integration test | `backend/tests/integration/test_w{NN}_*.py` | All pass, workers=1, retries=0 |
| Playwright E2E spec | `frontend/tests/e2e/hardening/w{NN}-*.spec.ts` | All pass × 2 (determinism run) |
| TypeScript check | `cd frontend && npx tsc --noEmit` | 0 errors |
| Vitest unit tests | `cd frontend && npx vitest run` | 0 failures |

---

## Selector Rules (Enforced by `scripts/scan_playwright.py`)

The following patterns are **forbidden** in `frontend/tests/e2e/hardening/*.spec.ts`:

```
getByText()       → use [data-testid="..."] instead
getByRole()       → use [data-testid="..."] instead
getByLabel()      → use [data-testid="..."] instead
getByPlaceholder() → use [data-testid="..."] instead
waitForTimeout()  → use waitForSelector() or waitForURL() instead
```

**Allowed pattern only:**
```typescript
await page.waitForSelector('[data-testid="my-element"]', { timeout: 10000 });
await page.locator('[data-testid="my-element"]').click();
```

---

## testid Rules (Enforced by `scripts/scan_testids.py`)

Every `<button>`, `<input>`, `<select>`, `<textarea>` element in `frontend/src/ui2/**/*.tsx` must have:

```tsx
data-testid="my-descriptive-id"
// or for dynamic lists:
data-testid={`my-item-${item.id}`}
```

Hidden fields (`type="hidden"`) are exempt.

---

## Running the Sanity Scanners

```powershell
# Check for missing testids
python scripts/scan_testids.py

# Check for forbidden Playwright patterns
python scripts/scan_playwright.py
```

Both must return exit code 0 before merging.

---

## Test Commands

```powershell
# Run backend tests (from repo root)
cd phase1
$env:DATABASE_URL="sqlite+aiosqlite:///./test_phase1.db"
python -m pytest backend/tests/integration/test_w{NN}_*.py -x --workers=1 --retries=0

# Run Playwright E2E (from frontend/)
cd frontend
npx playwright test tests/e2e/hardening/w{NN}-*.spec.ts --workers=1 --retries=0

# TypeScript check
cd frontend && npx tsc --noEmit

# Vitest
cd frontend && npx vitest run
```

---

## Naming Conventions

| Type | Pattern | Example |
|---|---|---|
| pytest file | `test_w{NN}_{slug}.py` | `test_w90_repo_sanity.py` |
| Playwright spec | `w{NN}-{slug}.spec.ts` | `w90-repo-sanity.spec.ts` |
| data-testid | `{page/component}-{element}-{action?}` | `backtest-run-btn`, `ops-es-card` |
| ES index | `apex-{type}-{YYYY.MM}` | `apex-events-2026.02` |
| ES alias | `apex-{type}-{write\|read}` | `apex-events-write` |
