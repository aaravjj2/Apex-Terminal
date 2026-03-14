# APEX TERMINAL — MASTER TASK LIST & IMPROVEMENT ROADMAP

> Full-stack trading terminal: React 19 + TypeScript + Vite 5 + Tailwind CSS 4 + lightweight-charts v5 + Zustand
> FastAPI backend on port 8000 · SQLite/PostgreSQL · Alpaca · Finnhub · Tradier · yfinance
> Last updated: 2026-03-14

## Legend

- `- [ ]` Todo
- `- [x]` Done
- 🔴 P0 — Critical / must have
- 🟠 P1 — High priority / should have
- 🟡 P2 — Medium / nice to have
- 🟢 P3 — Low / future consideration
- Effort: XS (<1h) · S (1–4h) · M (4–8h) · L (1–2d) · XL (2–5d)

---

## SPRINT PLANNING TIMELINE

| Sprint | Dates | Theme |
|--------|-------|-------|
| Sprint 1 | 2026-03-13 → 2026-03-14 | **DONE** — Stability & test foundation |
| Sprint 2 | 2026-03-15 → 2026-03-28 | Autopilot UI + Trading UI improvements |
| Sprint 3 | 2026-03-29 → 2026-04-18 | Backend robustness + Deployment |
| Sprint 4 | 2026-04-19 → 2026-05-09 | AI intelligence + Observability |

---

## QUALITY METRICS

| Metric | Current | Target |
|--------|---------|--------|
| E2E tests passing | 108/108 | 200+ |
| TypeScript errors | 0 | 0 |
| Backend test coverage | ~30% | 80%+ |
| API endpoints | 60+ | 60+ (cleaned) |
| Frontend bundle size | ~2 MB | <800 KB |
| Lighthouse score | ~65 | >90 |
| p95 API latency | ~200 ms | <100 ms |

---

## 1. COMPLETED — Sprint 1 (2026-03-13 to 2026-03-14)

### 1.1 Stability & Security

- [x] 🔴 P0 Port standardization — unified 8090/7500 → 8000 across config.py, Dockerfile, docker-compose.yml (XS)
- [x] 🔴 P0 CORS P0 security fix — replaced `allow_origins=["*"]` with explicit `settings.origins_list` (XS)
- [x] 🔴 P0 Dual autopilot engine conflict — autopilot_v3 router disabled; unified_engine is now canonical (S)
- [x] 🟠 P1 Elasticsearch optional by default — `elastic_required=False` in config.py (XS)
- [x] 🟠 P1 `.env.example` created at repo root with full documentation of all env vars (S)

### 1.2 Frontend Performance

- [x] 🟠 P1 React.lazy + Suspense on all 23 routes — RouteSkeleton shown during code-split load (M)
- [x] 🟠 P1 Tab-gating RightSidebarNew — only the active tab is mounted and polled (S)
- [x] 🟠 P1 AutopilotUI2 canvas chart → ApexAreaChart (lightweight-charts v5, data prop-driven) (S)
- [x] 🔴 P0 ApexChart + ApexAreaChart `import type` fix — Vite threw runtime error on type-value imports (XS)

### 1.3 API

- [x] 🟠 P1 Batch quote endpoint — `POST /api/v1/market-data/quotes/batch` (multi-symbol, per-symbol fallback) (S)
- [x] 🟠 P1 Health + readiness endpoints — `/health` (liveness) and `/ready` (dependency check) (XS)

### 1.4 Tests

- [x] 🔴 P0 autopilot.spec.ts test ID fix — `nav-item-autopilot` → `ui2-rail-autopilot` to match LeftNav data-testid format (XS)
- [x] 🔴 P0 All 108 Playwright E2E tests passing — 7 suites, 0 failures, 0 flaky (L)
- [x] 🔴 P0 TypeScript 0 errors — `tsc --noEmit` clean across entire frontend codebase (XS)

---

## 2. AUTOPILOT UI OVERHAUL — Sprint 2

### 2.1 Real-Time Data Transport

- [ ] 🔴 P0 **A1** Replace 13 polling timers with a single WebSocket connection (M)
  - Connect AutopilotUI2 to existing `/ws/autopilot` endpoint
  - Dispatch engine state updates via Zustand `autopilotStore` actions
  - Implement exponential-backoff reconnect (max 5 retries, then surface error banner)
  - Remove all `setInterval` polling in AutopilotUI2.tsx

### 2.2 Candidate & Signal UI

- [ ] 🟠 P1 **A2** Candidate drill-down slide-out panel (L)
  - Click any candidate row → open right-side panel (300 px wide, animated slide-in)
  - Panel shows: full signal payload, Greeks if options, mini PnL spark chart, risk score gauge
  - Close with Escape key or click-outside
- [ ] 🟡 P2 **A7** Trade journal view — scrollable log of all closed trades (M)
  - Columns: date, symbol, side, qty, entry, exit, PnL, score, strategy
  - Sortable columns, CSV export button
  - Fetches from `GET /api/v1/autopilot/trades?closed=true`

### 2.3 Configuration & Control

- [ ] 🟠 P1 **A3** Strategy config editor — form calling `POST /api/v1/autopilot/config` (M)
  - Fields: risk_pct, max_positions, symbol_universe (multi-select), cooldown_sec, max_premium_per_trade
  - Show current values from `GET /api/v1/autopilot/config`
  - Inline validation: risk_pct must be 0–10%, max_positions 1–20
- [ ] 🔴 P0 **A5** Kill switch redesign — sticky top-right corner, always visible (S)
  - Red animated pulse ring when engine is ACTIVE (armed=true)
  - Single click to arm/disarm with confirmation modal
  - Never hidden by scroll or route change

### 2.4 Visualization

- [ ] 🟠 P1 **A4** Equity curve with SPY benchmark overlay (S)
  - Two AreaSeries on one ApexChart instance
  - Portfolio curve (amber) + SPY (slate-400)
  - Toggle benchmark on/off via checkbox
- [ ] 🟡 P2 **A8** Autopilot health beat indicator (S)
  - Real-time badge showing: engine loop latency (ms), signal queue depth, last execution timestamp
  - Green/yellow/red color thresholds: <100ms green, 100–500ms yellow, >500ms red
- [ ] 🟡 P2 **A6** Per-position stop-loss editor (M)
  - Click any open position row → inline form to set SL price and TP price
  - `POST /api/v1/autopilot/positions/{id}/stops` with `{sl: float, tp: float}`

### 2.5 Advanced Autopilot

- [ ] 🟢 P3 **A9** Multi-strategy support — UI to create/edit/delete named strategies (XL)
- [ ] 🟢 P3 **A10** Backtesting integration — dry-run autopilot on historical data, show equity curve inline (XL)

---

## 3. FRONTEND BEAUTY & UX — Sprint 2 / 3

### 3.1 Typography & Color

- [ ] 🟠 P1 **F1** Typography upgrade (S)
  - Add IBM Plex Mono (Google Fonts) for all numeric data cells
  - Add IBM Plex Sans for UI prose text
  - Apply via CSS custom property `--font-data` and `--font-ui`
- [ ] 🟠 P1 **F2** Unified color token system (M)
  - Define all amber/gold/dark colors as CSS custom properties in `globals.css`
  - Replace every hardcoded hex value in Tailwind classes with token references
  - Tokens: `--color-amber-400`, `--color-surface-0` through `--color-surface-3`, etc.
- [ ] 🟡 P2 **F7** Dark mode OLED refinements (S)
  - True `#000000` background option behind a `data-theme="oled"` attribute
  - Higher contrast borders: upgrade `border-slate-800` → `border-slate-700` globally

### 3.2 Interactivity & Navigation

- [ ] 🔴 P0 **F6** Command palette — Cmd+K / Ctrl+K fuzzy search (M)
  - Covers all 23 pages + common actions (Place Order, Arm Autopilot, View Chart)
  - Keyboard navigation: arrow keys + Enter to select, Escape to dismiss
  - Recent items stored in localStorage (last 10 actions)
- [ ] 🟠 P1 **F4** Tab Visibility API — pause all polling when browser tab is hidden (S)
  - Listen to `document.visibilitychange`
  - Suspend all Zustand store polling intervals when `document.hidden === true`
  - Resume immediately on tab focus (no stale data lag)
- [ ] 🟠 P1 **F9** Keyboard navigation map (M)
  - Implement: `G+D` → Dashboard, `G+T` → Trading, `G+A` → Autopilot, `G+P` → Portfolio
  - Number keys `1`–`9` jump to first 9 rail items
  - Documented in Settings → Shortcuts panel

### 3.3 Feedback & States

- [ ] 🟠 P1 **F5** Toast notification system (S)
  - Implement `useToast` hook + `ToastContainer` mounted in AppShellUI2
  - Variants: success (green), error (red), info (amber), warning (orange)
  - Replace all `console.log` success/error messages in order flow and autopilot actions
- [ ] 🟠 P1 **F10** Loading skeleton states — shimmer placeholders for all data panels (M)
  - Create reusable `<Skeleton />` component with `animate-pulse` + amber tint
  - Apply to: watchlist rows, positions table, options chain rows, trade history
- [ ] 🟡 P2 **F3** Micro-animations (S)
  - Page mount: `opacity-0 → opacity-100` over 120ms
  - List item stagger: `translateY(4px) → 0` with 20ms per-item delay
  - Live price update flash: green/red background pulse on tick change

### 3.4 Data Display

- [ ] 🟠 P1 **F14** Number formatting — consistent locale formatting everywhere (S)
  - Use `Intl.NumberFormat` utility throughout; `1234.56` → `1,234.56`
  - Currency values: `$1,234.56`; percentage: `12.34%`; large numbers: `$1.23M`
- [ ] 🟠 P1 **F12** Volume histogram in ApexChart pane 2 (M)
  - Add `HistogramSeries` in pane index 1 (already stubbed in ApexChart.tsx)
  - Backend: ensure `/api/v1/bars` response includes `volume` field
  - Color bars: green if `close >= open`, red if `close < open`
- [ ] 🟡 P2 **F16** Real-time price tick animation (S)
  - On WebSocket price update: flash `priceLineColor` on the series to green or red for 500ms
  - Use lightweight-charts `series.applyOptions()` to update color dynamically
- [ ] 🟡 P2 **F13** Virtual scrolling for large lists (M)
  - Install `@tanstack/react-virtual` (already in package scope)
  - Apply to: screener results, trade history table, order book rows
- [ ] 🟡 P2 **F8** Responsive layout at 1280px (L)
  - Audit all pages for overflow at 1280px viewport width
  - Collapse RightSidebarNew behind a toggle button at <1400px
  - Ensure LeftNav collapses to icon-only at <1280px
- [ ] 🟢 P3 **F15** WCAG AA accessibility audit (M)
  - Run `axe-core` against all 23 pages
  - Fix all `color-contrast` and `label` violations (target: 0 critical, 0 serious)
- [ ] 🟡 P2 **F11** Chart theme synchronization (S)
  - Export a shared `APEX_CHART_THEME` const from `ui2/components/chart/theme.ts`
  - All ApexChart + ApexAreaChart instances import and apply this shared theme object

---

## 4. TRADING UI — Sprint 2

### 4.1 Order Entry

- [ ] 🔴 P0 **T1** Order ticket client-side validation (S)
  - Qty: must be integer > 0 and ≤ account buying power
  - Symbol: must match `/^[A-Z]{1,5}$/` or options format
  - Limit price: must be within ±20% of last trade price (warn, not block)
  - Show inline field-level error messages before allowing submit

### 4.2 Market Depth

- [ ] 🟠 P1 **T2** Order book L2 depth visualization (M)
  - In RightSidebarNew L2 tab: stacked horizontal bars for bid depth (left) and ask depth (right)
  - Color-coded: bids in green shades, asks in red shades, intensity proportional to size
  - Refresh from `GET /api/v1/market-data/{sym}/depth` every 500ms
- [ ] 🟠 P1 **T3** Time & Sales real WebSocket feed (M)
  - Connect T&S panel to `/ws/trades/{symbol}` stream
  - Display: time, price, size, exchange, aggressor side (B/S/U)
  - Color-code rows: green = buyer aggressor, red = seller aggressor

### 4.3 Position Management

- [ ] 🟠 P1 **T4** Position sizing calculator (S)
  - Embedded panel: inputs for account size, risk % per trade, entry price, stop price
  - Output: shares to buy, max dollar risk, risk/reward ratio
  - Updates in real-time as inputs change
- [ ] 🟡 P2 **T10** Per-position P&L mini chart (M)
  - Click any position row → modal with ApexAreaChart showing equity curve for that position
  - X-axis: time since open, Y-axis: unrealized PnL in dollars

### 4.4 Options Chain Improvements

- [ ] 🟠 P1 **T5** Options chain additional columns (S)
  - Add IV Rank (0–100), HV30, IV Percentile, Probability ITM columns
  - Color-code strikes: ITM rows in subtle green tint, OTM rows in default
- [ ] 🟡 P2 **T6** Options chain filtering (S)
  - Filter bar: expiration date selector, delta range slider (0.0–1.0), min volume threshold
  - Persist filter state in URL params for shareability
- [ ] 🟢 P3 **T7** Multi-leg options spread builder (XL)
  - Select 2–4 option contracts → build named spread (vertical, straddle, iron condor)
  - Show combined P&L diagram and aggregate Greeks
  - Submit as single multi-leg order via Alpaca options API

### 4.5 Alerts & Orders

- [ ] 🟠 P1 **T8** Price alert creation UI (M)
  - Form: symbol, condition (above/below/cross), price, notification method (toast/email)
  - Backend: `POST /api/v1/alerts` stores alert; engine checks on each quote tick
  - WebSocket push to frontend when triggered
- [ ] 🟠 P1 **T9** Order history panel (M)
  - Table showing all open/filled/cancelled orders with real-time status via Alpaca stream
  - Columns: time, symbol, side, type, qty, filled_qty, limit_price, avg_fill_price, status
  - Cancel button inline for open orders

---

## 5. BACKEND ROBUSTNESS — Sprint 3

### 5.1 Data Layer

- [ ] 🟠 P1 **B1** SQLite connection pool — switch to `aiosqlite` with per-request async context managers (M)
- [ ] 🟠 P1 **B7** Alembic database migrations — never manual DDL again (M)
  - Initialize Alembic in `phase1/`
  - Create initial migration from current schema
  - Document `alembic upgrade head` in dev setup instructions
- [ ] 🟡 P2 **B8** Caching layer — TTL cache for quote data (60s) and bars data (5min) (M)
  - Use `cachetools.TTLCache` or Redis if available
  - Apply to: `/quotes/batch`, `/bars`, `/market-data/{sym}/quote`

### 5.2 API Quality

- [ ] 🟠 P1 **B4** Pydantic request validation on all POST/PUT endpoints (M)
  - Audit all 60+ routes; add `BaseModel` request bodies where missing
  - Ensure all route handlers declare response models for OpenAPI accuracy
- [ ] 🟠 P1 **B9** Standardized error envelope (S)
  - All API errors return `{"error": str, "code": int, "request_id": str}`
  - Add `X-Request-ID` header to every response (uuid4, generated per request)
- [ ] 🟠 P1 **B10** Pagination on all list endpoints (S)
  - Query params: `?page=1&limit=50` on trades, runs, candidates, orders, alerts
  - Response envelope: `{"data": [...], "total": int, "page": int, "limit": int}`
- [ ] 🟡 P2 **B13** OpenAPI cleanup (M)
  - Organize all 60+ endpoints into logical tags: `market-data`, `autopilot`, `portfolio`, `orders`, `options`, `admin`
  - Add `summary` and `description` to every route decorator
  - Result: clean Swagger UI at `/docs`
- [ ] 🟡 P2 **B5** API versioning strategy (M)
  - Design `/api/v2/` namespace to replace ad-hoc `v1.13`-style naming
  - Document migration plan; keep v1 alive with deprecation header `Deprecation: true`

### 5.3 Infrastructure & Security

- [ ] 🔴 P0 **B3** Rate limiting — `slowapi` middleware (S)
  - 10 req/s per IP for unauthenticated routes
  - 100 req/s per authenticated session
  - Return `429 Too Many Requests` with `Retry-After` header
- [ ] 🟠 P1 **B11** JWT authentication (L)
  - Even single-user: required for cloud deploy
  - `POST /api/auth/token` → returns signed JWT
  - Protected routes require `Authorization: Bearer <token>` header
  - Frontend stores token in `sessionStorage`, attaches via axios interceptor
- [ ] 🟠 P1 **B6** Centralized WebSocket manager (M)
  - Single `ConnectionManager` class managing all active WS connections
  - Supports broadcast, per-channel publish, and connection cleanup on disconnect
  - Replaces per-endpoint WS handlers scattered across route files
- [ ] 🟡 P2 **B12** Audit logging — immutable append-only log for all trade orders (S)
  - Write to `audit.log` with: timestamp, user, action, symbol, qty, price, order_id
  - Never deleted or truncated; rotate by date (keep 90 days)
- [ ] 🟡 P2 **B2** Async task queue for long-running autopilot cycles (M)
  - Use `FastAPI.BackgroundTasks` for fire-and-forget; or Celery if >5s jobs needed
  - Prevents HTTP timeout on slow autopilot full-run requests
- [ ] 🟢 P3 **B15** Circuit breaker around all external API calls (M)
  - Wrap Alpaca, Finnhub, Tradier calls with `pybreaker` or custom circuit breaker
  - After 5 consecutive failures → open circuit, return cached data or 503 with `X-Circuit-Open: true`
- [ ] 🟢 P3 **B14** Performance profiling endpoint (S)
  - Add `/admin/profile` that triggers `py-spy` top output for 5 seconds
  - Protected by admin-only API key header

---

## 6. DATA PIPELINE — Sprint 3

### 6.1 Historical & Real-Time Bars

- [ ] 🟠 P1 **D1** Historical data backfill CLI (M)
  - `python scripts/backfill.py --symbols SPY,AAPL,TSLA --days 730`
  - Uses Alpaca historical bars API; writes to `data/bars.db`
  - Progress bar via `tqdm`; skips already-present date ranges
- [ ] 🟡 P2 **D2** Real-time bar aggregation from tick stream (L)
  - Compute 1m/5m/15m/1h bars in-process from Finnhub WebSocket ticks
  - Useful as fallback when Alpaca pre-aggregated bars are delayed

### 6.2 Market Context Data

- [ ] 🟠 P1 **D4** Earnings calendar markers on chart (M)
  - Show vertical dotted line + "E" marker on chart when earnings date falls in view
  - Data from Finnhub `/calendar/earnings` endpoint
- [ ] 🟡 P2 **D5** Economic calendar on Dashboard (M)
  - Fed meetings, CPI/PCE/NFP releases shown as timeline entries
  - Color-coded by expected market impact (red = high, yellow = medium, green = low)
- [ ] 🟡 P2 **D3** Volume profile computation on backend (L)
  - Server-side VRVP/VAH/VAL calculation from stored bars at `/api/v1/volume-profile`
  - Returns price buckets with total volume; frontend renders as horizontal histogram
- [ ] 🟡 P2 **D9** Sector rotation tracking (M)
  - Classify universe by GICS sector; compute 1w/1m relative momentum per sector
  - Feed data to HeatmapUI2 sector view

### 6.3 Alternative Data

- [ ] 🟡 P2 **D6** Social sentiment scoring (S)
  - Aggregate and score sentiment from existing `/api/v1/sentiment/articles` route
  - Display sentiment gauge (bearish/neutral/bullish) in RightSidebarNew news tab
- [ ] 🟡 P2 **D7** Options flow unusual activity tracker (L)
  - Scan for large sweep orders (size > 1000 contracts, premium > $100K) in options chain data
  - Surface as feed in a new "Flow" tab in AutopilotUI2 candidates panel
- [ ] 🟢 P3 **D10** Correlation matrix heatmap (M)
  - Real-time pairwise correlation for all watched symbols over configurable lookback
  - Rendered as color grid (red = negative, green = positive correlation)
- [ ] 🟢 P3 **D8** Dark pool print feed (XL)
  - Ingest Unusual Whales or Finviz dark pool data via their public endpoints
  - Display as filterable table with volume, price, time, exchange

---

## 7. DEPLOYMENT — Sprint 3 / 4

### 7.1 Container & Orchestration

- [ ] 🔴 P0 **DEP1** Docker Compose full stack (M)
  - Single `docker-compose.yml`: `frontend` (nginx), `backend` (uvicorn), optional `postgres`
  - `docker compose up` starts everything; `docker compose up --profile db` adds PostgreSQL
  - Health-check dependencies: backend waits for DB; frontend waits for backend `/ready`
- [ ] 🟠 P1 **DEP2** Nginx config — production reverse proxy (M)
  - Serve `frontend/dist/` as static assets with `Cache-Control: max-age=31536000, immutable` for hashed files
  - Proxy `/api/*` and `/ws/*` to `backend:8000`
  - Enable gzip compression; set `X-Frame-Options: DENY`

### 7.2 CI/CD

- [ ] 🔴 P0 **DEP3** GitHub Actions CI pipeline (M)
  - Trigger: push to `main` or any PR
  - Steps: `tsc --noEmit` → `pytest` → Playwright E2E (headless) → fail fast on any error
  - Cache: node_modules, pip venv, Playwright browsers between runs
- [ ] 🟠 P1 **DEP4** Environment-based config enforcement (S)
  - CI checks: no literal API keys in committed files (truffleHog or gitleaks scan)
  - All dev/staging/prod secrets via `keys.env` or injected env vars; never in source

### 7.3 Cloud & Scaling

- [ ] 🟡 P2 **DEP5** PostgreSQL migration path (M)
  - Document SQLite → PostgreSQL schema migration steps
  - Alembic `env.py` supports both `sqlite:///` and `postgresql://` via `DATABASE_URL` env var
- [ ] 🟡 P2 **DEP6** Cloud deploy guide (S)
  - Step-by-step for Render.com free tier: backend as Web Service, frontend as Static Site
  - Document required env vars, health check path (`/ready`), and zero-downtime deploys
- [ ] 🟡 P2 **DEP7** Bundle size optimization (S)
  - Install `rollup-plugin-visualizer` (`vite-bundle-analyzer`) and generate report
  - Target: eliminate any single chunk > 200 KB; lazy-split heavy dependencies
- [ ] 🟢 P3 **DEP8** CDN for static assets (S)
  - Configure `build.assetsDir` and `base` in `vite.config.ts` for Cloudflare Pages deploy
- [ ] 🟢 P3 **DEP9** Horizontal scaling documentation (S)
  - Document stateless backend requirements (no in-process session state)
  - WebSocket sticky sessions via `X-Forwarded-For` in load balancer config
- [ ] 🟢 P3 **DEP10** Secrets management guide (S)
  - Document Doppler CLI setup for local dev and CI
  - Alternative: AWS Secrets Manager with `boto3` integration in `config.py`

---

## 8. TESTING — Sprint 2 / 3

### 8.1 Backend Unit Tests

- [ ] 🔴 P0 **TE1** Backend unit tests with pytest (XL)
  - Target 80% coverage across all 20+ route files in `phase1/services/api/routes/`
  - Use `httpx.AsyncClient` + `pytest-asyncio` for async route testing
  - Mock external API calls (Alpaca, Finnhub) with `pytest-mock`
  - Priority files: `market_data_v1_13.py`, `portfolio.py`, `options_chain_v4.py`, `w43_model_router.py`

### 8.2 Integration & Contract Tests

- [ ] 🟠 P1 **TE2** WebSocket test harness (M)
  - Test: connection lifecycle, reconnect after server restart, message schema validation
  - Use `pytest-websockets` or custom async WS client fixture
- [ ] 🟡 P2 **TE3** Frontend-backend contract tests (L)
  - For each frontend `fetch()` call, assert response shape matches TypeScript interface
  - Use `zod` parse on API responses in dev mode to catch schema drift early

### 8.3 Performance & Security

- [ ] 🟡 P2 **TE4** Load test with k6 (M)
  - Scenario: 100 concurrent virtual users hitting `/api/v1/bars`, `/api/v1/market-data/{sym}/quote`, and `/api/v1/portfolio/positions`
  - Pass criteria: p95 < 200ms, 0% error rate at 100 VU
- [ ] 🟡 P2 **TE7** OWASP ZAP security scan (M)
  - Run ZAP baseline scan against running Docker Compose stack
  - Fix all HIGH and MEDIUM findings before Sprint 3 close
- [ ] 🟡 P2 **TE5** Visual regression tests (M)
  - Playwright screenshot baseline for all 13 core pages
  - Fail CI if pixel diff > 1% (excluding animated elements)
- [ ] 🟡 P2 **TE6** Accessibility audit with axe-core (S)
  - Integrate `@axe-core/playwright` into E2E suite
  - Run on every page mount; fail on any `critical` or `serious` violation
- [ ] 🟢 P3 **TE8** Chaos testing (M)
  - Kill backend process mid-request using `kill -9`
  - Verify frontend shows error banner (not white screen) within 3 seconds
  - Verify automatic reconnect after backend restarts

---

## 9. AI / AUTOPILOT INTELLIGENCE — Sprint 4

### 9.1 Signal Quality

- [ ] 🟠 P1 **AI2** Signal explanation — human-readable rationale per signal (M)
  - Each autopilot candidate shows: "RSI oversold (28.4) + Volume spike (2.3× avg) + Bullish engulfing"
  - Generated from structured signal payload fields; no LLM required for basic version
- [ ] 🟡 P2 **AI1** Multi-model routing UI (M)
  - Dropdown in AutopilotUI2 settings: select signal LLM (Groq Llama, Gemini Flash, local Ollama)
  - Calls `/api/v1/autopilot/config` with `{"signal_model": "groq/llama-3.1-70b"}`
- [ ] 🟡 P2 **AI4** Paper trading PnL tracking (M)
  - Real P&L tracking against paper positions (currently only position count is tracked)
  - Show running Sharpe ratio, total return, max drawdown in AutopilotUI2 ledger tab

### 9.2 Strategy Intelligence

- [ ] 🟠 P1 **AI3** Autopilot backtesting — dry-run on historical data (XL)
  - Run unified_engine in simulation mode: replay historical bars, emit signals, track virtual positions
  - Show equity curve and summary stats in AutopilotUI2 eval tab
- [ ] 🟡 P2 **AI5** Options autopilot — theta strategy scanner (XL)
  - Dedicated scanner for: iron condors, credit spreads, cash-secured puts
  - Criteria: IV Rank > 50, days-to-expiry 20–45, delta < 0.30
- [ ] 🟡 P2 **AI6** Risk manager improvements (M)
  - Add VaR calculation, portfolio beta, max correlated exposure limit (cap at 40% exposure to one sector)
  - Surface as gauges in AutopilotUI2 risk tab
- [ ] 🟢 P3 **AI7** Agent pipeline DAG visualization (L)
  - Show the multi-agent orchestration pipeline as an animated directed graph
  - Nodes: DataFetcher → SignalEngine → RiskManager → ExecutionEngine
  - Live-highlight the active node during each cycle
- [ ] 🟢 P3 **AI8** Strategy marketplace (XL)
  - Library of pre-built strategies: mean reversion, VWAP bounce, momentum breakout
  - Single-click enable; each strategy defines its own signal params and risk rules

---

## 10. INFRASTRUCTURE & OBSERVABILITY — Sprint 4

### 10.1 Metrics & Tracing

- [ ] 🟠 P1 **INF1** Prometheus metrics endpoint (M)
  - Expose `/metrics` via `prometheus-fastapi-instrumentator`
  - Custom metrics: `trade_orders_total`, `signal_queue_depth`, `autopilot_cycle_latency_seconds`
- [ ] 🟡 P2 **INF2** Grafana dashboard (M)
  - Pre-built `grafana-dashboard.json` for trading system metrics
  - Panels: request rate, p95 latency, autopilot cycle time, active positions count
- [ ] 🟡 P2 **INF3** OpenTelemetry tracing (L)
  - Trace requests: browser fetch → FastAPI route handler → external API call → DB query
  - Export to local Jaeger instance in docker-compose dev profile

### 10.2 Error Tracking & Alerting

- [ ] 🟠 P1 **INF6** Sentry integration (S)
  - Frontend: `@sentry/react` DSN from `VITE_SENTRY_DSN` env var
  - Backend: `sentry-sdk[fastapi]` with transaction sampling at 0.1
  - Both ship source maps; errors include `request_id` tag for correlation
- [ ] 🟡 P2 **INF4** Structured JSON logging (S)
  - Replace all `print()` and unformatted `logging.info()` with `structlog` JSON output
  - Each log line includes: `timestamp`, `level`, `request_id`, `service`, `message`
- [ ] 🟡 P2 **INF5** Uptime monitoring (XS)
  - Configure UptimeRobot free tier to ping `/health` every 60s
  - Alert to Slack/email on downtime > 2 minutes
- [ ] 🟢 P3 **INF7** Feature flags — simple JSON config (S)
  - `phase1/feature_flags.json`: `{"options_autopilot": false, "dark_pool_feed": false}`
  - FastAPI reads at startup; frontend fetches from `GET /api/v1/flags`
  - Gate experimental UI panels behind flag checks

---

## 11. KNOWN ISSUES & BUGS

- [ ] 🔴 P0 AutopilotUI2 has 13 simultaneous polling timers — see A1 above (M)
- [ ] 🟠 P1 `GET /api/v1/bars` does not always return `volume` field — needed for F12 (S)
- [ ] 🟠 P1 RightSidebarNew L2 tab shows synthetic depth, not real order book — see T2 (M)
- [ ] 🟡 P2 `indicators-e2e.spec.ts` is sensitive to Finnhub rate limits in CI — needs mock (S)
- [ ] 🟡 P2 `autopilotDepthStore.ts` imports are unused in current routing — needs cleanup (XS)
- [ ] 🟡 P2 `streamSimulator.ts` still present in production bundle — should be dev-only (XS)
- [ ] 🟡 P2 WatchlistManagerUI2 uses hardcoded default watchlist names — should come from API (S)
- [ ] 🟢 P3 ModelRouterUI2 has no backend route — shows mock latency/cost data (M)
- [ ] 🟢 P3 MonitorUI2 system health metrics are all mocked — wire to `/health` + `/metrics` (M)

---

## 12. BACKLOG / FUTURE EXPLORATION

- [ ] 🟢 P3 WebRTC-based collaborative chart sessions (real-time cursor sharing)
- [ ] 🟢 P3 Mobile PWA mode — installable, offline-capable via service worker
- [ ] 🟢 P3 Excel/Google Sheets integration for portfolio export
- [ ] 🟢 P3 Bloomberg API adapter for institutional data access
- [ ] 🟢 P3 Multi-broker aggregation (Alpaca + Interactive Brokers + TD Ameritrade)
- [ ] 🟢 P3 AI chart pattern recognition — annotate historical patterns automatically
- [ ] 🟢 P3 Earnings transcript NLP — summarize and score earnings calls
- [ ] 🟢 P3 Pre-market/after-hours scanner with extended-hours quotes
- [ ] 🟢 P3 Full audit trail UI — searchable and filterable event log for compliance
- [ ] 🟢 P3 Custom Pine Script–style formula language for user-defined indicators
