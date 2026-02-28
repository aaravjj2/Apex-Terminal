# Apex Terminal — DevPost Submission

## Inspiration
Most trading "demos" fall apart the moment Wi-Fi flakes or an API rate-limits you. I wanted a terminal that's actually **demoable** and **reproducible**: same inputs, same outputs, every time.

## What it does
Apex Terminal is a trading research terminal with:
- **Replay-first market data** — DEMO mode is 100% fixture-driven; LOCAL mode can fetch but never breaks tests
- **Strategy Lab workflows** — Build, validate, library, and run/backtest strategies with deterministic outputs
- **Backtesting + analysis views** — Deterministic charts and metrics that produce identical snapshots across runs
- **Risk/analytics panels** — Greeks, stress tests, and compliance gates with consistent, screenshot-stable UI states
- **Provenance surfacing** — Run metadata, input fixtures, and Git SHAs embedded in the UI and exports so results can be traced and verified

## How I built it
- **Frontend:** React + TypeScript + Vite, with strict `data-testid` selectors for E2E reliability
- **Charts:** TradingView Lightweight Charts for performance and visual consistency
- **Backend:** Python + FastAPI with deterministic schema validation and canonical serialization
- **Testing:** Vitest (unit) + Pytest (API) + Playwright (E2E) running against build + preview (not dev server)
- **E2E Policy:** All 425 Playwright tests run in DEMO mode (no API keys), `retries: 0`, `workers: 1`

## Accomplishments that I'm proud of
🏆 **425 passing Playwright E2E tests, 0 failures, 0 skipped, 0 flakes** — Verified across 3 consecutive runs (22m, 21.2m, 25.4m)

✅ Every workflow (Strategy Lab, Risk Desk, Backtesting, Replay, Autopilot) tested end-to-end  
✅ 80+ visual regression snapshots stable across runs  
✅ 100% DEMO mode coverage — No API keys required for any test  
✅ Deterministic Greeks/stress calculations pass structural validation  

## What I learned
The hard part isn't "adding features", it's **eliminating flake**:
- **Canonical serialization and stable hashing** — Every data structure has a deterministic fingerprint
- **Replay-first policies** — Network calls are opt-in and explicitly gated, preventing accidental dependencies
- **Deterministic UI states** — No `Date.now()` or `Math.random()` in render paths; time-based data mocked in tests
- **Snapshot baselines that don't drift** — All visual regression tests updated in sync with build artifacts

### Technical Challenges Overcome
1. **WebSocket `networkidle` hangs** — Connections kept page "busy" forever → switched to `domcontentloaded` across 17 files (29 replacements)
2. **SPA routing 404s** — Vite preview serves at `/` only → fixed 15 `goto('index.html')` references
3. **Strategy Lab empty states** — API timing variance caused flaky tests → seed demo strategies on component mount
4. **Autopilot save button race** — Config sync reset dirty flag after user input → added explicit wait for config load
5. **Scenario label mismatch** — `severe_crash` case missing → extended ternary logic in `api.ts`
6. **Greeks non-determinism** — Live calculations vary by milliseconds → verify structure (Delta/Gamma/Vega/Theta present) instead of exact floats

## Challenges I ran into
- **Making "replay vs cache vs demo" obvious in the UI** without relying on text-based test selectors — Solved with mode badges, visual indicators, and testid attributes
- **Schema hardening across providers** — Alpaca, Tradier, and Polygon have subtle differences; unified schema prevents silent drift
- **Keeping visual regression stable** across dozens of charts and panels — Required strict snapshot update discipline and deterministic rendering

## What's next for Apex Terminal
Expand the **replay + provenance pipeline** deeper into exports and offline reports, so every artifact is judge-grade traceable:

- **Embed run metadata** (Git SHA, input fixtures, timestamps) into every CSV export
- **Generate offline HTML reports** with full audit trails for backtests and risk analyses
- **Extend mode badges** to exports so offline artifacts clearly indicate their data source (demo/replay/live)
- **Deterministic PDF generation** for compliance-ready reporting

---

## Proof Pack

Full test verification artifacts at: `artifacts/proof/20260211-213919/`

**Verification commands:**
```bash
cd frontend
npx playwright test --reporter=line  # → 425 passed (21-25m)
```

**Environment:**
- Git SHA: `075c0fe2436033fa30bb846a99317ebb29f3663a`
- Node v22.21.1 | npm 10.9.4 | Python 3.10.12
- Playwright: retries=0, workers=1, video=on, trace=on, screenshot=on

---

## Links
- **Repository:** https://github.com/aaravjj2/Apex-Terminal
- **Live Demo:** [Coming soon — deployed to Vercel/Railway]
- **Proof Pack:** `artifacts/proof/20260211-213919/README.md`
