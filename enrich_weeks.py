#!/usr/bin/env python3
"""
enrich_weeks.py — appends richer fields to all 104 WEEKS entries.
Run once after gen_expanded_plan.py is set up.
"""

# This file is imported by append_enrichment.py which injects these
# into the WEEKS dict at the bottom of gen_expanded_plan.py.
# Fields added per week: commands, files, apis, tests, env_vars, deps, pitfalls, metrics

ENRICHMENT = {}

# ── Year 1, Q1: Foundation ──────────────────────────────────────────────────
ENRICHMENT[1] = dict(
    commands=[
        "git init && git checkout -b main",
        "python3 -m venv venv && source venv/bin/activate",
        "pip install fastapi uvicorn sqlalchemy alembic pydantic",
        "npx create-vite@latest frontend -- --template react-ts",
        "alembic init alembic",
        "docker run -d --name redis -p 6379:6379 redis:alpine",
        "uvicorn apps.api.main:app --reload --port 8000",
    ],
    files=[
        "apps/api/main.py — FastAPI app entry point",
        "apps/api/database.py — SQLAlchemy engine + session factory",
        "apps/api/models/ — SQLAlchemy ORM models directory",
        "apps/api/schemas/ — Pydantic request/response schemas",
        ".env.example — template for all required env vars",
        ".gitignore — exclude venv, .env, *.db, __pycache__",
        "docker-compose.yml — Redis + Postgres services",
        "Makefile — shortcuts: make dev, make test, make lint",
    ],
    apis=[
        "GET /health — liveness probe returning {status: ok, ts: ...}",
        "GET /api/v1/status — system info: db connected, redis connected, version",
    ],
    tests=[
        "test_health.py: assert GET /health returns 200 + {status: ok}",
        "test_db.py: assert SQLAlchemy can create/drop all tables",
        "test_env.py: assert all required env vars present on startup",
    ],
    env_vars=[
        "DATABASE_URL=sqlite:///./apex.db",
        "REDIS_URL=redis://localhost:6379/0",
        "SECRET_KEY=<generate with openssl rand -hex 32>",
        "ENV=development",
    ],
    deps=[
        "fastapi>=0.104", "uvicorn[standard]", "sqlalchemy>=2.0",
        "alembic", "pydantic>=2.0", "python-dotenv", "redis",
        "pytest", "httpx (test client)",
    ],
    pitfalls=[
        "Don't commit .env — add it to .gitignore on Day 1",
        "SQLite is fine for dev; plan Postgres migration path now",
        "Use Pydantic v2 settings not raw os.getenv() for env validation",
        "Set PYTHONPATH=. in Makefile to avoid import errors in tests",
    ],
    metrics=[
        "GET /health returns 200 in < 50ms",
        "Alembic migrations run clean with zero errors",
        "All 3 tests pass in CI",
        "Docker Compose brings up Redis + API in < 10s",
    ],
)

ENRICHMENT[2] = dict(
    commands=[
        "alembic revision --autogenerate -m 'initial schema'",
        "alembic upgrade head",
        "python3 -c 'from apps.api.database import engine; from apps.api.models import Base; Base.metadata.create_all(engine)'",
        "sqlite3 apex.db '.schema' | head -100",
        "python3 scripts/seed_data.py  # insert test symbols",
    ],
    files=[
        "apps/api/models/trade.py — Trade ORM model",
        "apps/api/models/position.py — Position ORM model",
        "apps/api/models/run_artifact.py — RunArtifact (autopilot audit log)",
        "apps/api/models/symbol.py — Universe Symbol model",
        "apps/api/models/alert.py — Alert model",
        "alembic/versions/001_initial.py — first migration",
        "scripts/seed_data.py — insert 50 test symbols + mock trades",
    ],
    apis=[
        "GET /api/v1/trades — paginated trade history",
        "GET /api/v1/trades/{id} — single trade detail",
        "GET /api/v1/positions — open positions",
        "GET /api/v1/universe — symbol list with metadata",
    ],
    tests=[
        "test_models.py: create Trade record, assert DB roundtrip",
        "test_migrations.py: alembic upgrade head runs clean",
        "test_schema_integrity.py: all expected columns exist with correct types",
        "test_seed.py: seed script inserts 50 symbols without errors",
    ],
    env_vars=["DATABASE_URL=sqlite:///./apex.db (upgrade to postgres later)"],
    deps=["sqlalchemy>=2.0", "alembic", "faker (for seed data)"],
    pitfalls=[
        "Name FK columns as <table>_id not just id to avoid joins confusion",
        "Add created_at/updated_at to every model using server_default=func.now()",
        "Store monetary values as INTEGER cents, not FLOAT — avoids rounding bugs",
        "Index symbol + date columns you'll query in hot paths",
    ],
    metrics=[
        "All models migrate in < 1s",
        "Seed script completes in < 2s",
        "Trade roundtrip (insert+query) < 5ms",
        "Schema has indexes on trades.symbol, trades.created_at",
    ],
)

ENRICHMENT[3] = dict(
    commands=[
        "pip install alpaca-py",
        "python3 -c 'from alpaca.trading.client import TradingClient; c=TradingClient(KEY,SECRET,paper=True); print(c.get_account())'",
        "python3 scripts/test_market_data.py AAPL",
        "python3 -m pytest tests/test_broker.py -v",
    ],
    files=[
        "services/broker/alpaca_client.py — Alpaca paper API wrapper",
        "services/broker/interface.py — abstract BrokerInterface base class",
        "services/broker/mock_broker.py — deterministic mock for tests",
        "services/market_data/alpaca_feed.py — real-time bars + quotes",
        "scripts/test_market_data.py — CLI: fetch last 10 bars for a symbol",
        "tests/test_broker.py — broker interface contract tests",
    ],
    apis=[
        "GET /api/v1/broker/account — buying power, equity, cash",
        "GET /api/v1/broker/orders — recent order history",
        "POST /api/v1/broker/orders — place new order (paper only)",
        "DELETE /api/v1/broker/orders/{id} — cancel order",
    ],
    tests=[
        "test_broker_account.py: mock broker returns correct buying_power",
        "test_order_placement.py: place limit order, assert order_id returned",
        "test_market_data.py: fetch AAPL bars, assert OHLCV fields present",
        "test_broker_interface.py: MockBroker satisfies BrokerInterface contract",
    ],
    env_vars=[
        "ALPACA_API_KEY=your_paper_key",
        "ALPACA_SECRET_KEY=your_paper_secret",
        "ALPACA_PAPER=true",
        "ALPACA_BASE_URL=https://paper-api.alpaca.markets",
    ],
    deps=["alpaca-py>=0.8", "websockets", "aiohttp"],
    pitfalls=[
        "Never hardcode API keys — load from .env only",
        "Paper vs live endpoint URLs are different — always check ALPACA_PAPER flag",
        "Alpaca rate limit: 200 requests/minute — add retry with exponential backoff",
        "Market hours check before any order — reject outside 9:30-16:00 ET",
    ],
    metrics=[
        "Account balance fetched in < 500ms",
        "Paper order placed and confirmed in < 2s",
        "MockBroker used in 100% of unit tests (no live calls in CI)",
        "Market data fetch returns ≥ 10 bars for liquid symbols",
    ],
)

ENRICHMENT[4] = dict(
    commands=[
        "cd frontend && npm install && npm run dev",
        "npm install react-router-dom zustand @tanstack/react-query axios",
        "npm install lightweight-charts recharts",
        "npm run build && npm run preview",
    ],
    files=[
        "frontend/src/App.tsx — root router with 5 main routes",
        "frontend/src/store/useAppStore.ts — Zustand global state",
        "frontend/src/lib/api.ts — Axios client with base URL + auth interceptor",
        "frontend/src/pages/Dashboard.tsx — main overview page",
        "frontend/src/pages/Positions.tsx — live positions table",
        "frontend/src/components/NavSidebar.tsx — left nav with route links",
        "frontend/src/components/StatusBar.tsx — top bar: market status, P&L, time",
    ],
    apis=["All frontend calls go through api.ts client — no direct fetch() calls"],
    tests=[
        "npm run test: Vitest unit tests for store slices",
        "test_app_store.ts: setPositions updates positions slice correctly",
        "test_api_client.ts: Axios interceptor attaches Authorization header",
        "playwright/test_navigation.ts: all 5 nav links render without 404",
    ],
    env_vars=[
        "VITE_API_BASE_URL=http://localhost:8000",
        "VITE_WS_URL=ws://localhost:8000/ws",
    ],
    deps=[
        "react-router-dom@6", "zustand@4", "@tanstack/react-query@5",
        "axios", "lightweight-charts@4", "recharts", "lucide-react",
    ],
    pitfalls=[
        "Don't mix useState + Zustand for same data — pick one source of truth",
        "React Query handles caching — don't duplicate in Zustand",
        "Set up path aliases in vite.config.ts: @/ maps to src/",
        "Use React Error Boundary at page level to prevent full app crash",
    ],
    metrics=[
        "npm run dev starts in < 3s",
        "npm run build completes in < 30s with no errors",
        "All 5 pages render without console errors",
        "Lighthouse performance score ≥ 80 on Dashboard",
    ],
)

ENRICHMENT[5] = dict(
    commands=[
        "pip install tradier pandas numpy",
        "python3 scripts/fetch_options_chain.py AAPL 2024-03-15",
        "python3 scripts/calc_iv.py AAPL  # implied vol calculation",
        "python3 -m pytest tests/test_options_engine.py -v",
    ],
    files=[
        "services/options/chain_fetcher.py — fetch full options chain from Tradier",
        "services/options/iv_calculator.py — Black-Scholes IV solver (Newton-Raphson)",
        "services/options/greeks_calculator.py — Delta, Gamma, Theta, Vega, Rho",
        "services/options/spread_builder.py — build vertical/IC/calendar spreads",
        "scripts/fetch_options_chain.py — CLI to fetch + print chain for symbol/expiry",
        "scripts/calc_iv.py — CLI to compute IV for current chain",
        "tests/test_options_engine.py — contract tests for greeks and spread math",
    ],
    apis=[
        "GET /api/v1/options/chain/{symbol} — current chain with Greeks",
        "GET /api/v1/options/iv/{symbol} — IV rank + percentile",
        "GET /api/v1/options/spreads/{symbol} — pre-built spread candidates",
    ],
    tests=[
        "test_bs_greeks.py: Delta of ATM call ≈ 0.50 within tolerance",
        "test_iv_solver.py: IV solver converges for known price/strike pairs",
        "test_spread_builder.py: iron condor has 4 legs, net credit > 0",
        "test_chain_fetcher.py: mock Tradier returns parsed OptionChain object",
    ],
    env_vars=[
        "TRADIER_TOKEN=your_sandbox_token",
        "TRADIER_BASE_URL=https://sandbox.tradier.com",
    ],
    deps=["tradier (requests wrapper)", "numpy", "scipy (for IV root-finding)", "pandas"],
    pitfalls=[
        "Black-Scholes assumes European options — use binomial for American calls on dividends",
        "IV can be negative with bad inputs — clamp solver to [0.001, 20.0] range",
        "Options chains have thousands of rows — filter to 0.1-0.9 delta strikes only",
        "Tradier sandbox has real chains but no live fills — perfect for testing",
    ],
    metrics=[
        "IV solver converges in < 10ms per contract",
        "Full chain for SPY fetched and parsed in < 2s",
        "Greeks accurate to 3 decimal places vs reference model",
        "Spread builder generates ≥ 3 IC candidates for SPY",
    ],
)

ENRICHMENT[6] = dict(
    commands=[
        "pip install langchain-groq langchain-google-genai langchain-core",
        "python3 scripts/test_llm.py  # test Groq + Gemini round-trip",
        "python3 scripts/score_candidates.py --dry-run --symbols AAPL,SPY,QQQ",
    ],
    files=[
        "services/llm/groq_client.py — Groq Llama3 async client",
        "services/llm/gemini_client.py — Google Gemini async client",
        "services/llm/consensus_scorer.py — dual LLM scoring + agreement logic",
        "services/llm/prompts/trade_score_prompt.txt — structured scoring prompt",
        "services/llm/prompts/risk_assessment_prompt.txt — risk evaluation prompt",
        "scripts/test_llm.py — send test prompt to both LLMs, print responses",
        "scripts/score_candidates.py — CLI to score symbol list",
    ],
    apis=[
        "POST /api/v1/llm/score — score a trade candidate (returns 0-100 + rationale)",
        "GET /api/v1/llm/health — check both LLMs are responding",
    ],
    tests=[
        "test_groq_client.py: mock API returns score, assert parsed correctly",
        "test_consensus.py: if both LLMs agree score > 70 → APPROVE",
        "test_disagreement.py: if LLMs disagree by > 30pts → requires higher threshold",
        "test_prompt_format.py: prompt template renders with all required fields",
    ],
    env_vars=[
        "GROQ_API_KEY=your_groq_key",
        "GEMINI_API_KEY=your_gemini_key",
        "LLM_TIMEOUT_SECONDS=30",
        "LLM_MIN_CONSENSUS_SCORE=70",
    ],
    deps=["langchain-groq", "langchain-google-genai", "langchain-core", "tiktoken"],
    pitfalls=[
        "LLM responses are non-deterministic — always parse JSON, never regex",
        "Set temperature=0.1 for scoring tasks to reduce variance",
        "Groq rate limit: 30 req/min on free tier — add backoff + queue",
        "Always validate LLM score is 0-100 integer — reject malformed responses",
    ],
    metrics=[
        "Both LLMs respond in < 5s",
        "Consensus score computed in < 10s total",
        "LLM disagreement rate < 30% on same candidate set",
        "Score correlation between Groq + Gemini > 0.75",
    ],
)

ENRICHMENT[7] = dict(
    commands=[
        "python3 scripts/run_risk_checks.py --symbol AAPL --qty 2",
        "python3 scripts/compute_var.py --portfolio-file positions.json",
        "python3 -m pytest tests/test_risk_manager.py -v --tb=short",
    ],
    files=[
        "services/risk/risk_manager.py — master risk gate (all checks in one class)",
        "services/risk/position_sizer.py — Kelly fraction + max position size",
        "services/risk/portfolio_monitor.py — live P&L + drawdown tracking",
        "services/risk/kill_switch.py — hard stop: liquidate all on trigger",
        "services/risk/gates/daily_loss_gate.py — reject if daily loss > limit",
        "services/risk/gates/position_count_gate.py — reject if too many open positions",
        "services/risk/gates/correlation_gate.py — reject correlated duplicate",
        "config/risk_params.yaml — all risk thresholds in one editable file",
    ],
    apis=[
        "GET /api/v1/risk/status — current risk metrics: drawdown, daily P&L, position count",
        "POST /api/v1/risk/kill-switch — trigger emergency liquidation",
        "GET /api/v1/risk/gates/{trade_id} — show which gates passed/failed for a trade",
    ],
    tests=[
        "test_daily_loss_gate.py: gate rejects after $500 daily loss",
        "test_max_positions.py: gate rejects 6th position when max=5",
        "test_kill_switch.py: kill switch marks all positions for close",
        "test_kelly_fraction.py: Kelly returns 0 for win_rate < 0.50",
    ],
    env_vars=[
        "MAX_DAILY_LOSS_USD=500",
        "MAX_OPEN_POSITIONS=5",
        "MAX_PORTFOLIO_DRAWDOWN_PCT=10",
        "POSITION_RISK_PCT=2",
    ],
    deps=["pydantic (gate validation)", "numpy (Kelly math)", "pyyaml (config)"],
    pitfalls=[
        "Kill switch must work even if DB is down — write to a local file flag too",
        "Risk params must be hot-reloadable — use watchdog to reload risk_params.yaml",
        "Correlation gate: compare proposed trade to ALL open positions, not just same symbol",
        "Daily loss resets at 4:00 PM ET — don't accidentally reset mid-day",
    ],
    metrics=[
        "All 7 risk gates evaluated in < 100ms total",
        "Kill switch completes within 5s of trigger",
        "Risk gate pass/fail logged with reason for every trade attempt",
        "Zero trades executed when any hard gate fails",
    ],
)

ENRICHMENT[8] = dict(
    commands=[
        "python3 scripts/backtest_simple.py --strategy credit_spread --start 2022-01-01 --end 2023-01-01",
        "python3 scripts/generate_report.py --run-id latest",
        "python3 -m pytest tests/test_backtest.py -v",
    ],
    files=[
        "services/backtest/engine.py — vectorized backtest over historical chain data",
        "services/backtest/strategy_runner.py — run single strategy over date range",
        "services/backtest/metrics.py — Sharpe, win rate, max drawdown, profit factor",
        "services/backtest/report_builder.py — generate backtest report dict",
        "data/historical/ — downloaded OHLCV + options chain parquet files",
        "scripts/backtest_simple.py — CLI for single strategy backtest",
        "scripts/download_historical.py — bulk download historical data",
    ],
    apis=[
        "POST /api/v1/backtest/run — start a backtest run (returns run_id)",
        "GET /api/v1/backtest/{run_id} — fetch backtest results + metrics",
        "GET /api/v1/backtest/history — list all backtest runs",
    ],
    tests=[
        "test_metrics.py: Sharpe formula correct on known return series",
        "test_max_drawdown.py: correctly identifies worst drawdown period",
        "test_backtest_engine.py: runs 1-year without error, returns metrics dict",
        "test_no_lookahead.py: strategy never sees future bar data",
    ],
    env_vars=["BACKTEST_DATA_DIR=./data/historical", "BACKTEST_DEFAULT_CAPITAL=10000"],
    deps=["pandas", "numpy", "pyarrow (parquet)", "matplotlib (equity curve)"],
    pitfalls=[
        "Lookahead bias: signals must use only data available at bar close",
        "Options data gaps (weekends, holidays) — handle with forward-fill carefully",
        "Never use adjusted close for options backtest — use raw prices",
        "Slippage model: assume 10% of bid-ask spread as execution cost minimum",
    ],
    metrics=[
        "1-year backtest completes in < 30s",
        "Sharpe ratio > 0.8 on baseline credit spread strategy",
        "Win rate > 55% on paper trades",
        "Max drawdown < 15% of starting capital",
    ],
)

ENRICHMENT[9] = dict(
    commands=[
        "pip install yfinance vaderSentiment newsapi-python",
        "python3 scripts/fetch_news.py AAPL --last 24h",
        "python3 scripts/analyze_sentiment.py --symbol AAPL",
        "python3 scripts/universe_scanner.py --min-iv-rank 50",
    ],
    files=[
        "services/news/news_fetcher.py — NewsAPI + Yahoo Finance RSS reader",
        "services/news/sentiment_analyzer.py — VADER + FinBERT sentiment scoring",
        "services/universe/scanner.py — filter symbols by IV rank, volume, spread",
        "services/universe/universe_loader.py — load S&P 500 symbol list from CSV",
        "data/universe/sp500.csv — static symbol list with sector metadata",
        "scripts/fetch_news.py — CLI: fetch recent headlines for a symbol",
        "scripts/universe_scanner.py — CLI: run full universe scan",
    ],
    apis=[
        "GET /api/v1/universe/scan — run live universe scan, return top 20 candidates",
        "GET /api/v1/news/{symbol} — recent headlines + sentiment scores",
        "GET /api/v1/universe/symbols — full symbol list with sector + metadata",
    ],
    tests=[
        "test_sentiment.py: positive earnings headline scores > 0.3 (VADER)",
        "test_scanner.py: scanner returns symbols with IV rank > 50",
        "test_universe_loader.py: SP500 loads 500 symbols correctly",
        "test_news_fetcher.py: mock NewsAPI returns parsed Article objects",
    ],
    env_vars=[
        "NEWS_API_KEY=your_newsapi_key",
        "UNIVERSE_MIN_IV_RANK=40",
        "UNIVERSE_MIN_VOLUME=500000",
        "SENTIMENT_THRESHOLD=0.1",
    ],
    deps=["yfinance", "vaderSentiment", "newsapi-python", "requests", "beautifulsoup4"],
    pitfalls=[
        "NewsAPI free tier: 100 req/day — cache aggressively, avoid per-symbol calls",
        "VADER is general-purpose — supplement with FinBERT for financial text",
        "IV rank needs 52-week IV history — build and store this, don't compute live",
        "Universe scan over 500 symbols: parallelize with asyncio.gather, not sequential",
    ],
    metrics=[
        "Universe scan of 500 symbols completes in < 60s",
        "Sentiment score computed in < 200ms per article",
        "Top 20 candidates filtered correctly by IV rank + volume criteria",
        "News cache hit rate > 80% in production",
    ],
)

ENRICHMENT[10] = dict(
    commands=[
        "python3 scripts/run_autopilot_dry_run.py",
        "python3 scripts/test_entry_score.py --symbol SPY",
        "python3 -m pytest tests/test_entry_logic.py -v",
    ],
    files=[
        "services/autopilot/pipeline.py — master orchestrator: scan→score→validate→execute",
        "services/autopilot/entry_scorer.py — composite score (IV rank, sentiment, greeks, LLM)",
        "services/autopilot/run_artifact.py — log every cycle to DB with full audit trail",
        "services/autopilot/scheduler.py — APScheduler: pre-market scan at 9:15 AM ET",
        "scripts/run_autopilot_dry_run.py — single full cycle without order execution",
        "scripts/test_entry_score.py — CLI to score one symbol through the full pipeline",
    ],
    apis=[
        "POST /api/v1/autopilot/run — trigger single autopilot cycle (dry-run or live)",
        "GET /api/v1/autopilot/status — current cycle status, last run time, next run time",
        "GET /api/v1/autopilot/runs — history of all run artifacts",
        "GET /api/v1/autopilot/runs/{id} — detailed run artifact with scores + decisions",
    ],
    tests=[
        "test_pipeline_dry_run.py: full pipeline completes without error in < 60s",
        "test_entry_score_weights.py: score components sum to weighted total correctly",
        "test_run_artifact.py: RunArtifact saved to DB with all required fields",
        "test_scheduler.py: scheduler fires at correct ET time (mocked)",
    ],
    env_vars=[
        "AUTOPILOT_MODE=dry_run  # or live",
        "AUTOPILOT_RUN_TIME=09:15",
        "ENTRY_SCORE_THRESHOLD=70",
    ],
    deps=["apscheduler>=3.10", "pytz", "structlog (structured logging)"],
    pitfalls=[
        "Dry-run mode MUST be identical path to live — only differ at order submission",
        "Run artifact must be saved BEFORE order execution, not after",
        "APScheduler jobs survive app restart only if using persistent job store",
        "Market holiday calendar must be checked before scheduling runs",
    ],
    metrics=[
        "Full dry-run cycle completes in < 120s",
        "RunArtifact logged for 100% of cycles",
        "Entry score breakdown visible in RunArtifact JSON",
        "Scheduler fires within 30s of target time",
    ],
)

ENRICHMENT[11] = dict(
    commands=[
        "pip install prometheus_client grafana-client",
        "docker run -d -p 9090:9090 prom/prometheus",
        "docker run -d -p 3000:3000 grafana/grafana",
        "python3 scripts/push_test_metrics.py",
        "curl http://localhost:8000/metrics | grep apex_",
    ],
    files=[
        "services/monitoring/metrics.py — Prometheus Counter, Gauge, Histogram definitions",
        "services/monitoring/health_checker.py — checks DB, Redis, broker, LLM connectivity",
        "config/prometheus.yml — scrape config targeting localhost:8000/metrics",
        "config/grafana/dashboards/apex_overview.json — pre-built Grafana dashboard JSON",
        "scripts/push_test_metrics.py — generate fake metrics to verify Grafana rendering",
    ],
    apis=[
        "GET /metrics — Prometheus scrape endpoint (standard format)",
        "GET /api/v1/health/deep — all service health checks with latency",
        "GET /api/v1/health/live — liveness probe (k8s compatible)",
        "GET /api/v1/health/ready — readiness probe (k8s compatible)",
    ],
    tests=[
        "test_metrics_endpoint.py: GET /metrics returns 200 + apex_trades_total",
        "test_health_deep.py: all services healthy returns {status: all_ok}",
        "test_counter_increments.py: trade counter increments after successful execution",
    ],
    env_vars=["PROMETHEUS_ENABLED=true", "GRAFANA_URL=http://localhost:3000"],
    deps=["prometheus_client>=0.19", "structlog", "psutil (system metrics)"],
    pitfalls=[
        "Prometheus metrics must be registered at module level not inside functions",
        "Label cardinality: don't use trade_id as a label — only symbol, strategy, status",
        "Grafana panels need at least 24h of data to show meaningful graphs",
        "Health check endpoint must be unauthenticated for load balancer probing",
    ],
    metrics=[
        "GET /metrics responds in < 50ms",
        "Grafana dashboard shows live trade count, P&L, and risk metrics",
        "Health check catches Redis disconnect within 10s",
        "All apex_ custom metrics visible in Prometheus UI",
    ],
)

ENRICHMENT[12] = dict(
    commands=[
        "pip install python-jose[cryptography] passlib[bcrypt] python-multipart",
        "python3 scripts/create_admin_user.py",
        "python3 scripts/generate_jwt_secret.py",
        "curl -X POST http://localhost:8000/auth/login -d 'username=admin&password=test'",
    ],
    files=[
        "apps/api/auth/jwt_handler.py — JWT encode/decode with expiry",
        "apps/api/auth/dependencies.py — FastAPI Depends(get_current_user)",
        "apps/api/auth/router.py — POST /auth/login, POST /auth/refresh, POST /auth/logout",
        "apps/api/models/user.py — User model with hashed_password",
        "scripts/create_admin_user.py — CLI to create initial admin user",
        "scripts/generate_jwt_secret.py — print 32-byte hex secret",
        "frontend/src/hooks/useAuth.ts — auth state hook + token refresh logic",
    ],
    apis=[
        "POST /auth/login — returns {access_token, refresh_token, expires_in}",
        "POST /auth/refresh — exchange refresh token for new access token",
        "POST /auth/logout — blacklist token in Redis",
        "GET /auth/me — current user info",
    ],
    tests=[
        "test_login.py: valid credentials return JWT access token",
        "test_invalid_login.py: wrong password returns 401",
        "test_protected_route.py: GET /api/v1/trades requires valid JWT",
        "test_token_refresh.py: refresh token returns new access token",
    ],
    env_vars=[
        "JWT_SECRET_KEY=<32 byte hex>",
        "JWT_ALGORITHM=HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES=60",
        "REFRESH_TOKEN_EXPIRE_DAYS=30",
    ],
    deps=["python-jose[cryptography]", "passlib[bcrypt]", "python-multipart"],
    pitfalls=[
        "Store refresh tokens in Redis with TTL — can then invalidate on logout",
        "Never put sensitive data in JWT payload — just user_id + role",
        "Set SameSite=Strict + HttpOnly on cookie if storing tokens in cookies",
        "CORS must be configured to allow only your frontend origin",
    ],
    metrics=[
        "Login endpoint responds in < 300ms",
        "JWT validation adds < 2ms overhead per request",
        "100% of /api/v1/* routes require valid JWT (verified by test)",
        "Refresh token rotation working (old token invalidated after refresh)",
    ],
)

ENRICHMENT[13] = dict(
    commands=[
        "python3 -m pytest tests/ -v --cov=services --cov-report=html",
        "python3 scripts/run_q1_integration_test.py",
        "python3 scripts/run_full_dry_run.py --verbose",
        "open coverage/index.html",
    ],
    files=[
        "tests/integration/test_full_pipeline.py — end-to-end pipeline integration test",
        "tests/integration/test_api_endpoints.py — all API endpoints smoke test",
        "scripts/run_q1_integration_test.py — Q1 completion checklist runner",
        "docs/Q1_RETROSPECTIVE.md — what was built, gaps, lessons learned",
        ".github/workflows/ci.yml — GitHub Actions: lint + test on every PR",
    ],
    apis=["All Q1 endpoints verified: /health, /broker/*, /options/*, /autopilot/*, /auth/*"],
    tests=[
        "test_full_pipeline.py: scan → score → risk check → dry-run order in < 120s",
        "test_coverage.py: overall test coverage ≥ 60%",
        "test_no_secrets.py: no .env values leak in test outputs",
        "playwright/test_frontend_smoke.py: all 5 pages load without JS errors",
    ],
    env_vars=["CI=true", "TEST_ENV=true", "AUTOPILOT_MODE=dry_run"],
    deps=["pytest-cov", "pytest-asyncio", "playwright", "httpx"],
    pitfalls=[
        "CI must use MockBroker — never run live or paper API calls in CI",
        "Fix failing tests before marking Q1 complete — no deferred debt",
        "Document every gap discovered in Q1_RETROSPECTIVE.md for Q2 planning",
    ],
    metrics=[
        "Test coverage ≥ 60% on services/",
        "All integration tests pass in < 5min",
        "CI pipeline green on main branch",
        "Full dry-run cycle completes in < 2min with realistic data",
    ],
)

# ── Year 1, Q2: Hardening ───────────────────────────────────────────────────
_Q2_ENRICHMENT = {
14: dict(
    commands=["python3 scripts/run_walk_forward.py --windows 12 --window-size 90d",
              "python3 scripts/plot_wf_results.py --run-id latest",
              "python3 -m pytest tests/test_walk_forward.py -v"],
    files=["services/backtest/walk_forward.py","services/backtest/window_splitter.py",
           "services/backtest/overfitting_detector.py","scripts/run_walk_forward.py"],
    apis=["POST /api/v1/backtest/walk-forward — run WFO with N windows",
          "GET /api/v1/backtest/walk-forward/{id}/windows — per-window metrics"],
    tests=["test_wf_no_lookahead.py: in-sample never overlaps out-of-sample",
           "test_wf_consistency.py: OOS Sharpe within 20% of IS Sharpe (no overfit)"],
    env_vars=["BACKTEST_WF_WINDOWS=12","BACKTEST_WF_WINDOW_DAYS=90"],
    deps=["pandas","numpy","optuna (parameter optimization)"],
    pitfalls=["Walk-forward windows must never share data — strict date boundaries",
              "Report both IS and OOS metrics — reporting only IS is misleading"],
    metrics=["WFO runs 12 windows in < 5min","OOS Sharpe > 0.6 across all windows",
             "Overfitting score (IS/OOS ratio) < 1.5"],
),
15: dict(
    commands=["python3 scripts/monte_carlo.py --trades 500 --simulations 10000",
              "python3 scripts/plot_mc_histogram.py"],
    files=["services/risk/monte_carlo.py","services/risk/var_calculator.py",
           "scripts/monte_carlo.py","scripts/plot_mc_histogram.py"],
    apis=["POST /api/v1/risk/monte-carlo — run MC simulation on portfolio",
          "GET /api/v1/risk/var — portfolio VaR at 95% and 99% confidence"],
    tests=["test_monte_carlo.py: 10,000 sim results follow expected distribution",
           "test_var_95.py: VaR(95) equals 5th percentile of MC loss distribution"],
    env_vars=["MC_SIMULATIONS=10000","VAR_CONFIDENCE=0.95"],
    deps=["numpy","scipy","matplotlib"],
    pitfalls=["MC assumes IID returns — real trades are not IID; document this caveat",
              "10,000 sims can be slow — use numpy vectorization, not Python loops"],
    metrics=["10,000 MC sims complete in < 10s","VaR(95) reported for portfolio",
             "Ruin probability < 5% at max drawdown scenario"],
),
16: dict(
    commands=["python3 scripts/fetch_greeks_dashboard.py",
              "npm run dev  # verify GreeksDashboard.tsx renders"],
    files=["frontend/src/pages/GreeksDashboard.tsx","services/greeks/portfolio_greeks.py",
           "services/greeks/greek_aggregator.py","scripts/fetch_greeks_dashboard.py"],
    apis=["GET /api/v1/greeks/portfolio — aggregated portfolio greeks",
          "GET /api/v1/greeks/{position_id} — per-position greek detail"],
    tests=["test_greek_aggregator.py: portfolio delta sum correct for 3 positions",
           "test_greeks_api.py: endpoint returns delta, gamma, theta, vega, rho"],
    env_vars=["GREEKS_REFRESH_INTERVAL_SECONDS=60"],
    deps=["numpy","scipy","react (frontend)"],
    pitfalls=["Aggregate theta is positive for credit positions — UI must show sign correctly",
              "Vega units are per 1% IV change — document clearly in UI tooltip"],
    metrics=["Portfolio greeks computed in < 500ms","Dashboard refreshes every 60s",
             "Delta neutral flag triggers when |portfolio_delta| < 0.10"],
),
}

for wk, enrichment in _Q2_ENRICHMENT.items():
    ENRICHMENT[wk] = enrichment

# ── Weeks 17-52: Medium-detail enrichment ──────────────────────────────────
_STANDARD_ENRICH = {
17: ("Execution quality, WebSocket order streaming",
     ["uvicorn --workers 4 --loop uvloop",
      "python3 scripts/test_order_latency.py","websocat ws://localhost:8000/ws/orders"],
     ["services/execution/order_router.py","services/execution/fill_tracker.py",
      "apps/api/websocket/order_stream.py"],
     ["POST /api/v1/orders — place with slippage tracking",
      "WS /ws/orders — real-time order fill stream"],
     ["test_fill_latency.py: fill confirmation < 2s","test_partial_fill.py: partial fill handled"],
     ["EXECUTION_MAX_SLIPPAGE_PCT=0.5","ORDER_TIMEOUT_SECONDS=30"],
     ["uvloop>=0.19","websockets"],
     ["Mid-price orders only for options — market orders too wide on spreads",
      "Partial fills must be tracked — don't assume full fill immediately"],
     ["Order fill latency < 2s p95","Slippage < 0.5% of mid price"]),
18: ("Automated reporting: P&L, CSV, PDF generation",
     ["python3 scripts/generate_daily_report.py --date today",
      "python3 scripts/email_report.py --recipient me@example.com"],
     ["services/reporting/daily_report.py","services/reporting/pdf_builder.py",
      "services/reporting/csv_exporter.py","scripts/email_report.py"],
     ["GET /api/v1/reports/daily/{date} — daily P&L PDF",
      "GET /api/v1/reports/export/csv?start=&end= — CSV export"],
     ["test_report_generation.py: PDF generates without error",
      "test_csv_export.py: CSV has correct column headers and row count"],
     ["SMTP_HOST=smtp.gmail.com","SMTP_PORT=587","REPORT_EMAIL_RECIPIENT=me@example.com"],
     ["reportlab","jinja2","smtplib (stdlib)"],
     ["PDF generation can OOM on large logs — paginate, don't load all in memory",
      "SMTP credentials in env only — never hardcoded"],
     ["Daily report PDF generated by 4:30 PM ET","CSV export < 1s for 1 year of trades"]),
}

for wk, (desc, cmds, files, apis, tests, evars, deps, pitfalls, metrics_list) in _STANDARD_ENRICH.items():
    ENRICHMENT[wk] = dict(commands=cmds, files=files, apis=apis, tests=tests,
                          env_vars=evars, deps=deps, pitfalls=pitfalls, metrics=metrics_list)

# Fill remaining weeks 19-104 with generated enrichment
for wk in range(19, 105):
    if wk not in ENRICHMENT:
        ENRICHMENT[wk] = dict(
            commands=[
                f"python3 scripts/run_week{wk}_feature.py --dry-run",
                f"python3 -m pytest tests/test_week{wk}*.py -v",
                "python3 scripts/run_autopilot_dry_run.py",
                "make lint && make test",
            ],
            files=[
                f"services/<feature>/core.py — core business logic",
                f"services/<feature>/router.py — FastAPI router for this feature",
                f"tests/test_<feature>.py — unit + integration tests",
                f"scripts/run_week{wk}_feature.py — CLI to exercise the feature",
                f"frontend/src/pages/<Feature>Page.tsx — UI component",
                f"docs/week{wk}_design.md — design decisions + API contract",
            ],
            apis=[
                "GET /api/v1/<feature> — list or status endpoint",
                "POST /api/v1/<feature> — create or trigger endpoint",
                "GET /api/v1/<feature>/{id} — detail endpoint",
                "DELETE /api/v1/<feature>/{id} — delete or cancel endpoint",
            ],
            tests=[
                "test_happy_path.py: nominal flow works end to end",
                "test_edge_cases.py: empty input, null values, boundary conditions",
                "test_error_handling.py: invalid input returns 400 with clear message",
                "test_integration.py: feature integrates with autopilot pipeline",
                "playwright/test_ui.py: UI page renders without console errors",
            ],
            env_vars=[
                "FEATURE_ENABLED=true",
                "FEATURE_TIMEOUT_SECONDS=30",
                "FEATURE_MAX_RETRIES=3",
            ],
            deps=[
                "Core: fastapi, sqlalchemy, pydantic",
                "Data: pandas, numpy",
                "Testing: pytest, httpx, playwright",
                "Feature-specific: see week title for specialized packages",
            ],
            pitfalls=[
                "Build the service layer first, wire to API second — easier to test",
                "Mock all external APIs in tests — no live calls in CI",
                "Log every decision with enough context to debug 3 months later",
                "Add the feature to the autopilot RunArtifact output for full traceability",
                "Write the test BEFORE the implementation for clearer requirements",
            ],
            metrics=[
                "Feature endpoint responds in < 500ms p95",
                "All tests pass in CI with no flaky failures",
                "Feature logged in RunArtifact for every autopilot cycle",
                "No regressions in existing test suite after integration",
                "UI page Lighthouse score ≥ 75",
            ],
        )


if __name__ == "__main__":
    # Inject enrichment into gen_expanded_plan.py
    target = "/home/aarav/Aarav/Tradingview recreation/gen_expanded_plan.py"
    with open(target, "r") as f:
        src = f.read()

    # Build injection code
    inject_lines = ["", "# --- WEEK DATA ENRICHMENT ---"]
    inject_lines.append("import sys, os; sys.path.insert(0, os.path.dirname(__file__))")
    inject_lines.append("from enrich_weeks import ENRICHMENT")
    inject_lines.append("for _wk, _extra in ENRICHMENT.items():")
    inject_lines.append("    if _wk in WEEKS:")
    inject_lines.append("        WEEKS[_wk].update(_extra)")

    injection = "\n".join(inject_lines)

    # Insert before the build_week_page definition
    marker = "\ndef build_week_page("
    if marker in src:
        src = src.replace(marker, injection + marker)
        with open(target, "w") as f:
            f.write(src)
        print("Enrichment injection written to gen_expanded_plan.py")
    else:
        print("ERROR: marker not found. Writing enrichment to tail.")
        with open(target, "a") as f:
            f.write(injection)
