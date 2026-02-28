#!/usr/bin/env python3
"""
Apex Terminal Two-Year Master Plan — Expanded Edition
1 full page per week • 104 weeks • Deep technical + autopilot detail
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import datetime

# ─── COLOR PALETTE ───────────────────────────────────────────────────────────
APEX_DARK   = colors.HexColor("#0D1117")
APEX_BLUE   = colors.HexColor("#2196F3")
APEX_TEAL   = colors.HexColor("#00BCD4")
APEX_GREEN  = colors.HexColor("#4CAF50")
APEX_AMBER  = colors.HexColor("#FF9800")
APEX_RED    = colors.HexColor("#F44336")
APEX_PURPLE = colors.HexColor("#9C27B0")
APEX_GREY   = colors.HexColor("#37474F")
APEX_LIGHT  = colors.HexColor("#ECEFF1")
WHITE       = colors.white

QUARTER_COLORS = {
    1: APEX_BLUE,    # Y1-Q1
    2: APEX_TEAL,    # Y1-Q2
    3: APEX_GREEN,   # Y1-Q3
    4: APEX_AMBER,   # Y1-Q4
    5: APEX_RED,     # Y2-Q1
    6: APEX_PURPLE,  # Y2-Q2
    7: colors.HexColor("#00897B"),  # Y2-Q3
    8: colors.HexColor("#E91E63"),  # Y2-Q4
}

def quarter_for_week(w):
    if w <= 13: return 1
    if w <= 26: return 2
    if w <= 39: return 3
    if w <= 52: return 4
    if w <= 65: return 5
    if w <= 78: return 6
    if w <= 91: return 7
    return 8

QUARTER_LABELS = {
    1: "Year 1 · Q1 — Foundation",
    2: "Year 1 · Q2 — Hardening",
    3: "Year 1 · Q3 — Intelligence",
    4: "Year 1 · Q4 — Scale",
    5: "Year 2 · Q1 — Maturity",
    6: "Year 2 · Q2 — Ecosystem",
    7: "Year 2 · Q3 — AI Product",
    8: "Year 2 · Q4 — Polish & Release",
}

# ─── STYLES ──────────────────────────────────────────────────────────────────
def make_styles(qcolor):
    base = dict(fontName="Helvetica", leading=13, textColor=APEX_DARK)
    return {
        "week_title": ParagraphStyle("wt", fontName="Helvetica-Bold",
            fontSize=18, textColor=qcolor, leading=22, spaceAfter=2),
        "quarter_tag": ParagraphStyle("qt", fontName="Helvetica",
            fontSize=9, textColor=colors.HexColor("#78909C"), leading=12, spaceAfter=6),
        "section_head": ParagraphStyle("sh", fontName="Helvetica-Bold",
            fontSize=10, textColor=qcolor, leading=14, spaceBefore=8, spaceAfter=3),
        "body": ParagraphStyle("b", fontName="Helvetica",
            fontSize=8.5, leading=12, textColor=APEX_DARK, **{k:v for k,v in {}.items()}),
        "bullet": ParagraphStyle("bl", fontName="Helvetica",
            fontSize=8.5, leading=12, leftIndent=10, bulletIndent=0,
            bulletFontName="Helvetica", textColor=APEX_DARK),
        "code": ParagraphStyle("cd", fontName="Courier",
            fontSize=7.5, leading=11, textColor=colors.HexColor("#1A237E"),
            backColor=colors.HexColor("#F3F4F6"), leftIndent=8, rightIndent=8,
            borderPadding=4),
        "metric": ParagraphStyle("mt", fontName="Helvetica-Bold",
            fontSize=8, textColor=WHITE, leading=11),
        "kpi_val": ParagraphStyle("kv", fontName="Helvetica-Bold",
            fontSize=14, textColor=qcolor, leading=16),
        "kpi_lab": ParagraphStyle("kl", fontName="Helvetica",
            fontSize=7, textColor=APEX_GREY, leading=10),
    }

def B(text): return f"<b>{text}</b>"
def I(text): return f"<i>{text}</i>"

def hr(qcolor): return HRFlowable(width="100%", thickness=1, color=qcolor, spaceAfter=4, spaceBefore=4)

def kpi_table(kpis, qcolor, styles):
    """kpis = list of (label, value) tuples"""
    data = [[Paragraph(v, styles["kpi_val"]) for _,v in kpis],
            [Paragraph(l, styles["kpi_lab"]) for l,_ in kpis]]
    col_w = (6.5 * inch) / len(kpis)
    t = Table(data, colWidths=[col_w]*len(kpis))
    t.setStyle(TableStyle([
        ("BOX",        (0,0), (-1,-1), 0.5, qcolor),
        ("ALIGN",      (0,0), (-1,-1), "CENTER"),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LINEBELOW",  (0,0), (-1,0), 0.25, qcolor),
    ]))
    return t

def checklist_table(items, qcolor):
    data = [[Paragraph(f"☐  {i}", ParagraphStyle("ci", fontName="Helvetica",
             fontSize=8, leading=12, textColor=APEX_DARK))] for i in items]
    t = Table(data, colWidths=[6.5*inch])
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.HexColor("#F8F9FA"), WHITE]),
        ("TOPPADDING",     (0,0), (-1,-1), 3),
        ("BOTTOMPADDING",  (0,0), (-1,-1), 3),
        ("LEFTPADDING",    (0,0), (-1,-1), 6),
    ]))
    return t

def two_col(left_items, right_items, qcolor, styles, left_head="", right_head=""):
    def render_col(head, items):
        out = []
        if head:
            out.append(Paragraph(head, styles["section_head"]))
        for item in items:
            out.append(Paragraph(f"• {item}", styles["bullet"]))
        return out
    l = render_col(left_head, left_items)
    r = render_col(right_head, right_items)
    max_rows = max(len(l), len(r))
    while len(l) < max_rows: l.append(Spacer(1, 1))
    while len(r) < max_rows: r.append(Spacer(1, 1))
    data = [[l_cell, r_cell] for l_cell, r_cell in zip(l, r)]
    t = Table(data, colWidths=[3.15*inch, 3.15*inch], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
    ]))
    return t

def code_block(lines, styles):
    text = "<br/>".join(lines)
    return Paragraph(text, styles["code"])

def week_header_block(week_num, title, subtitle, qcolor, qlabel, styles):
    elems = []
    q = quarter_for_week(week_num)
    accent = QUARTER_COLORS[q]
    # Top accent bar via table trick
    bar = Table([[""]], colWidths=[6.5*inch], rowHeights=[4])
    bar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1), accent),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    elems.append(bar)
    elems.append(Spacer(1, 6))
    # Quarter tag
    elems.append(Paragraph(f"{qlabel}  |  Week {week_num} of 104", styles["quarter_tag"]))
    # Week title
    elems.append(Paragraph(f"Week {week_num}: {title}", styles["week_title"]))
    elems.append(Paragraph(subtitle, ParagraphStyle("sub", fontName="Helvetica-Oblique",
        fontSize=9.5, textColor=APEX_GREY, leading=13, spaceAfter=4)))
    elems.append(hr(qcolor))
    return elems

# ─── WEEK DATA ────────────────────────────────────────────────────────────────
# Each week: title, subtitle, kpis, goals, tasks, deliverables, autopilot, risk, code_snippet, day_breakdown
WEEKS = {}

# ═══════════════════════════════════════════════════════════════════════════════
#  YEAR 1 — Q1  (Weeks 1–13)  Foundation & Core Infrastructure
# ═══════════════════════════════════════════════════════════════════════════════
WEEKS[1] = dict(
    title="Project Scaffolding & Monorepo Setup",
    subtitle="Lay the bedrock: toolchain, repo structure, CI/CD, coding standards, and dev environment.",
    kpis=[("Goal","Zero-to-Running"),("Stack","React+FastAPI"),("CI","GitHub Actions"),("Test Target","100% bootstrap")],
    goals=[
        "Initialize monorepo with frontend (Vite+React+TS) and backend (FastAPI+Python 3.11) workspaces",
        "Configure ESLint, Prettier, Black, isort, and pre-commit hooks across the full stack",
        "Set up GitHub Actions CI pipeline: lint → unit test → build on every PR",
        "Create Docker Compose dev environment (frontend:5173, backend:8000, SQLite volume)",
        "Establish branch strategy: main, develop, feature/*, hotfix/*",
        "Write CONTRIBUTING.md, architecture.md, and initial README with setup instructions",
    ],
    tasks=[
        "Run: npx create-vite@latest frontend --template react-ts",
        "Run: cd frontend && npm i zustand @tanstack/react-query lightweight-charts",
        "Run: pip install fastapi uvicorn sqlalchemy alembic pytest pytest-asyncio",
        "Create phase1/main.py with /health endpoint returning {status:'ok',version:'0.1.0'}",
        "Create docker-compose.dev.yml with hot-reload volumes for both services",
        "Write .github/workflows/ci.yml: on push/PR → lint + test + build",
        "Set up SQLite with Alembic migrations; create initial schema migration",
        "Create Makefile targets: make dev, make test, make lint, make build",
    ],
    deliverables=[
        "Monorepo runs with single 'make dev' command",
        "CI passes green on first commit",
        "Health endpoint returns valid JSON",
        "Pre-commit hooks block bad code from entering repo",
        "README has copy-paste setup instructions verified on a clean machine",
    ],
    autopilot=[
        "No autopilot features yet — this week is pure infrastructure",
        "Design autopilot config schema (JSON/YAML) that will govern all future AI decisions",
        "Stub out AutopilotEngine class with run_cycle() method that returns a noop RunArtifact",
        "Wire kill_switch boolean to config — even in week 1, the kill switch exists and is ON",
    ],
    risk=[
        "Risk: Dev environment drift between team members → mitigate with Docker Compose",
        "Risk: CI flakiness on first setup → keep CI pipeline minimal (lint + smoke test only)",
        "Risk: Wrong Python version → pin to 3.11 in runtime.txt and .python-version",
    ],
    code=[
        "# phase1/main.py",
        "from fastapi import FastAPI",
        "app = FastAPI(title='Apex Terminal', version='0.1.0')",
        "@app.get('/health')",
        "def health(): return {'status': 'ok', 'version': '0.1.0', 'kill_switch': True}",
    ],
    days=[
        "Mon: Initialize repos, install toolchains, verify Python/Node versions",
        "Tue: Configure linters, pre-commit hooks, and write CONTRIBUTING.md",
        "Wed: Create FastAPI skeleton + SQLite + Alembic; verify /health endpoint",
        "Thu: Set up React+Vite+TS; create App.tsx with placeholder dashboard",
        "Fri: Wire up GitHub Actions CI; Docker Compose; tag v0.1.0 milestone",
    ],
)

WEEKS[2] = dict(
    title="Database Schema & Core Data Models",
    subtitle="Design production-grade SQLite schema for trades, positions, options, runs, and audit logs.",
    kpis=[("Tables","8 core"),("Migrations","Alembic"),("Test Coverage",">90%"),("Uptime","Local dev")],
    goals=[
        "Design and implement all core database tables: trades, positions, options_cache, autopilot_runs, bars, alerts, incidents, config",
        "Write Alembic migration for every table with proper indices and foreign keys",
        "Create SQLAlchemy ORM models and Pydantic schemas for API I/O",
        "Implement repository pattern: one class per domain (TradeRepo, PositionRepo, RunRepo)",
        "Write 30+ unit tests for all repository CRUD operations using pytest + SQLite in-memory",
        "Document schema decisions in docs/schema.md with ER diagram (ASCII)",
    ],
    tasks=[
        "Create models.py with SQLAlchemy declarative_base() and all 8 table classes",
        "Define trades table: id, symbol, strategy_type, direction, qty, entry_price, exit_price, pnl, status, opened_at, closed_at",
        "Define autopilot_runs table: run_id UUID, timestamp, duration_ms, success, phase, candidates_count, orders_placed, error_json",
        "Define positions table: position_id, symbol, qty, avg_cost, current_price, unrealized_pnl, strategy_type, broker_ref",
        "Define options_cache table: symbol, expiration, strike, option_type, bid, ask, iv, delta, gamma, theta, vega, cached_at",
        "Define bars table: symbol, tf, ts, open, high, low, close, volume — with composite index on (symbol, tf, ts)",
        "Create alembic/versions/001_initial_schema.py migration",
        "Write repos/trade_repo.py with create, get, list, update_status, get_stats methods",
        "Write repos/run_repo.py with save_run, list_runs, get_run methods",
        "Write tests/test_repos.py with 30+ parametrized CRUD tests",
    ],
    deliverables=[
        "alembic upgrade head runs cleanly from scratch",
        "All 8 tables created with proper constraints and indices",
        "30+ repo tests pass with 100% coverage on repo layer",
        "Schema documented in docs/schema.md",
    ],
    autopilot=[
        "RunArtifact dataclass mirrors autopilot_runs table exactly — parity is enforced by test",
        "audit_decision() function stub: accepts RunArtifact, writes to DB, returns run_id",
        "Config table seeded with default: max_positions=4, max_risk_per_trade=50, kill_switch=true",
        "Implement get_config() / set_config() helpers used by all future autopilot code",
    ],
    risk=[
        "Risk: Schema changes mid-development are costly → design schema fully upfront",
        "Risk: SQLite locking under concurrent writes → use WAL mode (PRAGMA journal_mode=WAL)",
        "Risk: Forgetting indices → add index on every foreign key and every filter column",
    ],
    code=[
        "# models.py (excerpt)",
        "class Trade(Base):",
        "    __tablename__ = 'trades'",
        "    id = Column(String, primary_key=True, default=lambda: str(uuid4()))",
        "    symbol = Column(String(10), nullable=False, index=True)",
        "    strategy_type = Column(String(30), nullable=False)",
        "    pnl = Column(Float, default=0.0)",
        "    status = Column(String(15), default='open')",
        "    opened_at = Column(DateTime, default=func.now())",
    ],
    days=[
        "Mon: Design full ER diagram on paper; enumerate all columns and types",
        "Tue: Write SQLAlchemy models and Alembic migration",
        "Wed: Implement repository classes with full CRUD",
        "Thu: Write all unit tests; achieve >90% coverage on DB layer",
        "Fri: Document schema, run migration on fresh DB, tag Week 2 complete",
    ],
)

WEEKS[3] = dict(
    title="Backend API Layer & WebSocket Infrastructure",
    subtitle="Build the full REST API surface and real-time WebSocket event bus powering the live dashboard.",
    kpis=[("Endpoints","25+"),("WS Events","5 types"),("Latency","<50ms P99"),("Test Suite","Integration")],
    goals=[
        "Implement all 25+ REST endpoints across autopilot, portfolio, options, and charting domains",
        "Build WebSocket event bus: clients subscribe to run_update, position_update, alert, log channels",
        "Add API versioning (/api/v1/) and structured error responses with error codes",
        "Implement request validation via Pydantic v2 with detailed error messages",
        "Add rate limiting (slowapi) and CORS configuration for frontend dev server",
        "Write integration tests for every endpoint using httpx async client",
    ],
    tasks=[
        "Create routers: autopilot_router, portfolio_router, options_router, chart_router, admin_router",
        "POST /api/v1/autopilot/cycle — trigger a cycle, return RunArtifact",
        "GET  /api/v1/autopilot/status — returns engine state, kill_switch, last_run_id",
        "GET  /api/v1/autopilot/positions — open positions with real-time P&L",
        "GET  /api/v1/autopilot/runs?limit=20 — paginated run history",
        "GET  /api/v1/autopilot/config — current config JSON",
        "PATCH /api/v1/autopilot/config — update config fields",
        "POST /api/v1/autopilot/kill — activate kill switch",
        "GET  /api/v1/options/chain?symbol=AAPL&expiration=2025-02-21 — options chain",
        "GET  /api/v1/bars/{symbol}?tf=1D&limit=200 — OHLCV bars",
        "Implement WebSocket /ws endpoint: broadcast events to all connected clients",
        "Add ConnectionManager class: track clients, handle disconnect, broadcast JSON events",
        "Write tests/test_api.py with 40+ async httpx tests — mock DB calls with pytest-mock",
    ],
    deliverables=[
        "All 25+ endpoints return correct responses with proper HTTP status codes",
        "WebSocket connects and receives live events when autopilot cycle runs",
        "Integration test suite passes in <30 seconds",
        "API documented at /docs (Swagger) and /redoc",
        "Rate limiting prevents >100 req/min per IP",
    ],
    autopilot=[
        "POST /api/v1/autopilot/cycle is the beating heart — it calls engine.run_cycle()",
        "All cycle events (phase transitions, trade decisions, errors) emitted via WebSocket",
        "cycle response includes: run_id, duration_ms, candidates_considered, orders_placed, no_action_reasons",
        "Kill switch endpoint returns 200 immediately; engine checks it at every phase boundary",
    ],
    risk=[
        "Risk: WebSocket memory leak on client disconnect → implement proper cleanup in ConnectionManager",
        "Risk: Blocking DB calls in async context → use asyncio.to_thread() for all SQLAlchemy calls",
        "Risk: CORS misconfiguration blocking frontend → test with actual Vite dev server origin",
    ],
    code=[
        "# ws.py — ConnectionManager",
        "class ConnectionManager:",
        "    def __init__(self): self.active: list[WebSocket] = []",
        "    async def connect(self, ws: WebSocket):",
        "        await ws.accept(); self.active.append(ws)",
        "    async def broadcast(self, event: dict):",
        "        msg = json.dumps(event)",
        "        for ws in self.active[:]:",
        "            try: await ws.send_text(msg)",
        "            except: self.active.remove(ws)",
    ],
    days=[
        "Mon: Create router files; implement all autopilot endpoints with stub responses",
        "Tue: Implement options and chart endpoints; wire to real DB repos",
        "Wed: Build WebSocket ConnectionManager; integrate event broadcasting into cycle",
        "Thu: Write all integration tests; fix any contract mismatches found",
        "Fri: Add rate limiting, CORS, docs verification; tag Week 3 complete",
    ],
)

WEEKS[4] = dict(
    title="React Frontend Shell & Live Dashboard",
    subtitle="Build the core UI: charting shell, WebSocket provider, Zustand state, and the unified dashboard.",
    kpis=[("Components","20+"),("WS Connected","Yes"),("Render FPS","≥60"),("Unit Tests","22 pass")],
    goals=[
        "Build full React app shell: router, layout, sidebar navigation, theme provider",
        "Implement Zustand stores for: autopilot state, positions, orders, config, events",
        "Create WebSocket context provider that auto-reconnects and dispatches events to stores",
        "Build UnifiedDashboardView with Supergraph chart, AIPanel, positions widget, orders widget",
        "Add lightweight-charts candlestick chart with real API data from /api/v1/bars/{symbol}",
        "Achieve 22 passing Vitest unit tests on all store logic and utility functions",
    ],
    tasks=[
        "npm install zustand @tanstack/react-query lightweight-charts react-router-dom",
        "Create stores/autopilotStore.ts: status, lastRun, killSwitch, cycle() action",
        "Create stores/positionsStore.ts: positions[], totalUnrealized, fetchPositions() action",
        "Create providers/WebSocketProvider.tsx: connects to /ws, routes events to stores",
        "Create features/layout/AppShell.tsx: sidebar + top nav + outlet",
        "Create features/chart/SupergraphModule.tsx: lightweight-charts with candles + trade markers",
        "Create features/autopilot/AIPanel.tsx: start/stop button, status, last run summary",
        "Create features/trading/tiles/PositionsTile.tsx: table with live P&L updates",
        "Write 22 Vitest tests across stores and utility functions",
        "Configure Vite proxy /api → http://localhost:8000 for dev",
    ],
    deliverables=[
        "Dashboard renders at localhost:5173 with real data from backend",
        "Candlestick chart loads AAPL bars on mount",
        "AIPanel shows autopilot status; clicking Run Cycle calls POST /cycle",
        "WebSocket events update positions in real time without polling",
        "22 Vitest unit tests pass in <5 seconds",
    ],
    autopilot=[
        "AIPanel is the user's entire interaction with autopilot — it must be clear and confidence-inspiring",
        "Last Run Summary card shows: timestamp, candidates_considered, orders_placed, duration_ms",
        "Kill switch button is RED and prominent — one click, confirmed with modal",
        "Status indicator: ● Running (green), ● Idle (grey), ● Killed (red) — visible on every page",
    ],
    risk=[
        "Risk: lightweight-charts version mismatch with React 19 → pin to ^4.1.0 and test",
        "Risk: WebSocket reconnect storm on server restart → implement exponential backoff (1s,2s,4s,8s,max30s)",
        "Risk: Zustand store getting stale across navigation → use subscribeWithSelector middleware",
    ],
    code=[
        "// WebSocketProvider.tsx (excerpt)",
        "useEffect(() => {",
        "  const connect = () => {",
        "    const ws = new WebSocket('ws://localhost:8000/ws');",
        "    ws.onmessage = ({data}) => {",
        "      const ev = JSON.parse(data);",
        "      if (ev.type === 'position_update') positionsStore.update(ev);",
        "      if (ev.type === 'run_complete') autopilotStore.setLastRun(ev.run);",
        "    };",
        "    ws.onclose = () => setTimeout(connect, backoff());",
        "  }; connect();",
        "}, []);",
    ],
    days=[
        "Mon: Scaffold React app; install deps; create router and AppShell layout",
        "Tue: Build Zustand stores and WebSocket provider; wire to backend",
        "Wed: Build SupergraphModule with lightweight-charts; load real bar data",
        "Thu: Build AIPanel, PositionsTile; RunArtifact display card",
        "Fri: Write 22 unit tests; verify full stack E2E; tag Week 4 complete",
    ],
)

WEEKS[5] = dict(
    title="Alpaca & Tradier Integration — Live Paper Trading",
    subtitle="Connect to real broker and data APIs; achieve live paper trade execution end-to-end.",
    kpis=[("Broker","Alpaca Paper"),("Data","Tradier Options"),("Exec Latency","<2s"),("Auth","API Key + Env")],
    goals=[
        "Implement AlpacaBroker class: submit_order, cancel_order, get_positions, get_account, get_orders",
        "Implement TradierOptionsProvider: get_chain, get_quotes, get_expirations with 60s cache",
        "Add keys.env pattern with validation at startup — missing keys = hard fail with message",
        "Write paper trade execution test: place a paper order on Alpaca and verify fill",
        "Implement retry logic with exponential backoff for all external API calls",
        "Health-check endpoints verify broker connectivity; red status if any API is unreachable",
    ],
    tasks=[
        "pip install alpaca-trade-api requests-cache",
        "Create services/execution/alpaca_broker.py with full interface",
        "Create services/options/tradier_provider.py with caching decorator",
        "Implement validate_env() at app startup: check all required env vars",
        "Write integration test: call alpaca.get_account() and assert equity > 0",
        "Write integration test: call tradier.get_chain('AAPL') and assert len > 0",
        "Add /health endpoint to check: DB ✓, Alpaca ✓, Tradier ✓, LLM ✓",
        "Wire broker health into autopilot engine: abort cycle if broker not reachable",
    ],
    deliverables=[
        "make test-integration passes with real API keys in environment",
        "Paper order placed and visible in Alpaca dashboard",
        "Tradier options chain returned with Greeks in <500ms",
        "/health shows all green services",
        "Startup fails loudly with clear error if keys are missing",
    ],
    autopilot=[
        "Autopilot now has a real execution surface — paper_broker.py wraps AlpacaBroker for simulation",
        "PaperBroker tracks virtual positions in SQLite when Alpaca paper isn't available",
        "BrokerVerification dataclass: is_alpaca_live, is_tradier_live, account_equity, buying_power",
        "Engine aborts if BrokerVerification fails — never trade without confirmed connectivity",
    ],
    risk=[
        "Risk: API keys committed to git → keys.env in .gitignore from day 1, pre-commit hook blocks secrets",
        "Risk: Tradier rate limit (120/min) hit during option chain scan → token bucket implementation",
        "Risk: Alpaca paper API throttled → add jitter to retry delays",
    ],
    code=[
        "# alpaca_broker.py (submit_order)",
        "def submit_order(self, symbol, qty, side, order_type='market'):",
        "    return self.client.submit_order(",
        "        symbol=symbol, qty=qty, side=side,",
        "        type=order_type, time_in_force='day'",
        "    )",
    ],
    days=[
        "Mon: Implement AlpacaBroker; write account/position/order methods",
        "Tue: Implement TradierProvider with caching; verify options chain",
        "Wed: Integrate both into /health; add startup validation",
        "Thu: Write integration tests with real APIs; verify paper order",
        "Fri: Wire broker health into cycle; document API key setup",
    ],
)

WEEKS[6] = dict(
    title="Options Chain Engine & Strategy Templates",
    subtitle="Build the full options scanning engine: chain fetching, Greeks math, and the 4 strategy templates.",
    kpis=[("Strategies","4 templates"),("Greeks","All 4"),("Chain Speed","<500ms"),("Candidates","50+ per scan")],
    goals=[
        "Implement full options chain processor: normalize Tradier response into internal OptionContract model",
        "Implement Black-Scholes Greeks verification: compute delta/gamma/theta/vega independently and diff against Tradier",
        "Build 4 strategy templates: PutCreditSpread, CallCreditSpread, IronCondor, DebitSpread",
        "Implement StrategyMatcher: given a chain, generate all valid spread candidates matching template parameters",
        "Build liquidity filter: reject any spread where bid_ask_spread_pct > 10%",
        "Add IV Rank calculator: compare current IV to 52-week IV range",
    ],
    tasks=[
        "pip install numpy scipy",
        "Create models/option_contract.py: symbol, expiration, strike, option_type, bid, ask, iv, delta, gamma, theta, vega",
        "Create services/options/greeks.py: black_scholes_price(), compute_delta(), compute_gamma(), compute_theta(), compute_vega()",
        "Create strategies/put_credit_spread.py: generate candidates given chain, target_delta, min_dte, max_dte",
        "Create strategies/iron_condor.py: symmetric wings around ATM",
        "Create strategies/call_credit_spread.py and debit_spread.py",
        "Create services/options/iv_rank.py: fetch 52w high/low IV, compute current rank 0-100",
        "Write test_strategies.py: for each template, generate candidates from mock chain and assert validity",
    ],
    deliverables=[
        "Given AAPL chain, generate 50+ spread candidates in <1s",
        "All Greeks verified against Black-Scholes within ±0.05 tolerance",
        "IV Rank computed for 10 symbols without error",
        "Strategy candidates include: symbol, legs[2-4], max_profit, max_loss, pop, dte, iv_rank",
        "All strategy unit tests pass",
    ],
    autopilot=[
        "CANDIDATE_GENERATION phase now has real content: iterate universe → fetch chain → match strategies",
        "CandidateRecord dataclass has all fields autopilot needs: score, pop, iv_rank, max_loss, max_profit, dte",
        "Autopilot only considers candidates where PoP ≥ 0.50 and liquidity_score ≥ 0.5",
        "All strategy parameters configurable via autopilot config: target_delta, min_dte, max_dte per strategy type",
    ],
    risk=[
        "Risk: Black-Scholes mismatch for deep ITM/OTM options → acceptable; log mismatches >0.15 delta diff",
        "Risk: Stale chains used for execution → enforce max_chain_age=60s before submission",
    ],
    code=[
        "# greeks.py — Black-Scholes delta",
        "from scipy.stats import norm; import numpy as np",
        "def bs_delta(S,K,T,r,sigma,call=True):",
        "    d1=(np.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*np.sqrt(T))",
        "    return norm.cdf(d1) if call else norm.cdf(d1)-1",
    ],
    days=[
        "Mon: Build OptionContract model; normalize Tradier chain response",
        "Tue: Implement Black-Scholes Greeks; write verification tests",
        "Wed: Build PutCreditSpread and IronCondor templates",
        "Thu: Build CallCreditSpread and DebitSpread; implement IV Rank",
        "Fri: Write all strategy unit tests; integrate into engine CANDIDATE_GENERATION phase",
    ],
)

WEEKS[7] = dict(
    title="Groq LLM Integration — Fast Candidate Ranking",
    subtitle="Integrate Groq API as Stage 1 of the dual-LLM pipeline for rapid options candidate ranking.",
    kpis=[("LLM","Groq llama3-70b"),("Latency","<3s"),("Prompt","Structured JSON"),("Fallback","Deterministic")],
    goals=[
        "Integrate Groq API: groq-python client with structured JSON output mode",
        "Build GroqProvider class with rank_candidates() method accepting CandidateRecord list",
        "Design the Groq prompt: system context, market regime, portfolio state, candidate structured data",
        "Parse and validate Groq response via Pydantic: selected_ids, confidence, explanation",
        "Implement deterministic fallback: sort by composite_score desc, take top 5",
        "Handle Groq failures gracefully: timeout (10s), rate limit, invalid JSON — all fall to deterministic",
    ],
    tasks=[
        "pip install groq",
        "Create services/llm/groq_provider.py with api_key from env, timeout=10s",
        "Build GROQ_SYSTEM_PROMPT: role=options trading AI, constraints, output format",
        "Build rank_candidates(candidates, context) → sends structured JSON, parses LLMResponse",
        "Implement LLMResponse Pydantic model: selected_ids: List[str], confidence: float, explanation: str",
        "Add validator: all selected_ids must exist in input candidates (hallucination guard)",
        "Add validator: confidence must be ≥ 0.60, else treat as uncertain",
        "Write unit test mocking Groq API: assert selected_ids validated, fallback triggered on bad response",
        "Add llm_calls table to DB: provider, model, prompt_tokens, completion_tokens, latency_ms, success",
    ],
    deliverables=[
        "GroqProvider returns valid selections for 20 mock candidates in <3s",
        "Hallucination guard rejects IDs not in input — test case proves this",
        "Deterministic fallback activates when Groq fails — test case proves this",
        "All LLM calls logged to DB with token counts and latency",
        "Sensitive prompt data never logged to stdout",
    ],
    autopilot=[
        "SELECTION phase now: CANDIDATE_GENERATION → [50 candidates] → Groq → [top 8]",
        "Groq context includes: market_regime, vix_level, portfolio.equity, portfolio.total_risk, candidates[]",
        "Each candidate sent to Groq as: {id, symbol, template, pop, iv_rank, max_loss, dte, liquidity_score}",
        "Groq explains its picks in natural language — explanation stored in RunArtifact for dashboard display",
    ],
    risk=[
        "Risk: Groq API down → deterministic fallback makes autopilot independent of LLM availability",
        "Risk: LLM picks hallucinated tickers → ID validation catches this before any order is considered",
        "Risk: Prompt injection via news data → sanitize all external text before including in prompt",
    ],
    code=[
        "SYSTEM = '''You are an expert options trader. Rank candidates by risk-adjusted quality.",
        "Return JSON: {\"selected_ids\": [\"id1\",\"id2\",...], \"confidence\": 0.85, \"explanation\": \"...\"}",
        "Only return IDs from the provided list. Prefer high PoP, reasonable risk/reward.'''",
    ],
    days=[
        "Mon: Install groq; build GroqProvider skeleton; test API connection",
        "Tue: Design and iterate on system prompt for quality rankings",
        "Wed: Implement Pydantic response validation; build all guard layers",
        "Thu: Wire into engine SELECTION phase; run live test with real candidates",
        "Fri: Write unit and integration tests; document LLM module",
    ],
)

WEEKS[8] = dict(
    title="Gemini LLM Integration — Deep Validation Layer",
    subtitle="Add Gemini as Stage 2 validator: cross-checks Groq picks, provides deeper analysis, reduces false positives.",
    kpis=[("LLM","Gemini 1.5 Flash"),("Agreement Gate","Intersection≥1"),("Fallback","Groq-only"),("Dual Cost","Tracked")],
    goals=[
        "Integrate Gemini API (google-generativeai): GeminiProvider.rank_candidates() method",
        "Design Gemini prompt: receives Groq's top picks + Groq's explanation as additional context",
        "Implement cross-validation logic: find intersection of Groq and Gemini selections",
        "Handle all failure modes: both fail → deterministic, one fails → use other's output",
        "Add dual-LLM agreement metric to RunArtifact: groq_picks, gemini_picks, agreed_picks, final_picks",
        "Track combined LLM cost per cycle; alert if cost > $0.01 per cycle",
    ],
    tasks=[
        "pip install google-generativeai",
        "Create services/llm/gemini_provider.py mirroring GroqProvider interface",
        "Build Gemini prompt: 'Validate these options trades selected by another AI...'",
        "Implement HybridSelector.select(): Groq → top8, Gemini → validate, intersect → final 2-3",
        "Implement consensus_select(groq_ids, gemini_ids) → agreed set or deterministic if empty",
        "Add to RunArtifact: llm_agreement: LLMAgreement(groq, gemini, agreed, final_source)",
        "Write integration test: mock both LLMs agree on 2 candidates → assert those 2 returned",
        "Write integration test: LLMs disagree → assert deterministic fallback fires",
    ],
    deliverables=[
        "Full dual-LLM pipeline operational: Groq ranks → Gemini validates → intersection selected",
        "Agreement metric visible in RunArtifact and displayed on RunsAuditView",
        "All four failure modes tested and working (both-ok, groq-only, gemini-only, both-fail)",
        "LLM cost tracked per cycle in DB",
        "Dashboard shows which LLM combo was used for each run",
    ],
    autopilot=[
        "Pipeline: 50 candidates → Groq fast rank (top 8) → Gemini deep validate → 2-3 final picks",
        "If LLMs disagree entirely: log warning, use deterministic fallback, flag run for human review",
        "'LLM-confirmed' badge appears on trades that passed both LLMs",
        "llm_log table stores full prompt+response for every call — critical for audit and debugging",
    ],
    risk=[
        "Risk: Both LLMs agree on a bad trade → human audit sample (10% of runs reviewed weekly)",
        "Risk: Gemini slower than expected → set 15s timeout; if slow, use Groq-only result",
        "Risk: API costs spiral → cap at $5/day; disable LLMs and use deterministic if exceeded",
    ],
    code=[
        "def consensus_select(groq_ids, gemini_ids, fallback_candidates):",
        "    agreed = set(groq_ids) & set(gemini_ids)",
        "    if agreed: return list(agreed)[:3], 'dual_llm'",
        "    if groq_ids: return groq_ids[:3], 'groq_only'",
        "    if gemini_ids: return gemini_ids[:3], 'gemini_only'",
        "    return deterministic(fallback_candidates)[:3], 'deterministic'",
    ],
    days=[
        "Mon: Install google-generativeai; build GeminiProvider skeleton",
        "Tue: Design Gemini prompt with Groq context injection",
        "Wed: Build HybridSelector with consensus logic; test all four paths",
        "Thu: Integrate into engine; add agreement metrics to RunArtifact",
        "Fri: Write all tests; review LLM call logs; verify cost tracking",
    ],
)

WEEKS[9] = dict(
    title="Entry Scoring Algorithm & Risk Validation Layer",
    subtitle="Implement the 7-factor entry scoring system (0-100) and all 12 risk validation gates.",
    kpis=[("Score Factors","7 weighted"),("Min Score","65/100"),("Risk Gates","12"),("Validation","Pre-order")],
    goals=[
        "Implement EntryScorer: compute composite 0-100 score from 7 weighted factors",
        "Implement all 12 ValidationGates: risk_budget, max_positions, max_per_underlying, liquidity, spread_width, earnings_blackout, news_sentiment, regime_mismatch, dte_bounds, delta_bounds, cluster_concentration, symbol_filter",
        "Wire scoring into engine SELECTION phase: candidates ranked by score, min 65 to proceed",
        "Wire validation into VALIDATION phase: all 12 gates checked before any execution",
        "Build rejection ledger: every rejected candidate logged with reason",
        "Add composite score to RunArtifact and display in candidate explorer on dashboard",
    ],
    tasks=[
        "Create services/autopilot/scoring.py: EntryScorer.calculate(candidate, sentiment, technicals, llm_conf)",
        "Implement all 7 factors with exact weights from MASTER_PLAN.md",
        "Create services/autopilot/validator.py: Validator.validate(candidate, portfolio, config, calendar, news)",
        "Implement each gate as a method returning (passed: bool, gate: ValidationGate, reason: str)",
        "Create RejectionRecord dataclass: candidate_id, gate, reason, timestamp",
        "Persist all RejectionRecords to rejection_log DB table",
        "Write 50+ unit tests for scoring: test each factor boundary condition",
        "Write 12 unit tests for validator: one per gate, test pass and fail case",
    ],
    deliverables=[
        "EntryScorer returns correct score for 10 diverse test candidates",
        "All factor boundaries produce correct scores (edge cases tested)",
        "All 12 gates pass/fail correctly in unit tests",
        "Rejection log populated after each cycle",
        "Full scoring visible in dashboard candidate explorer view",
    ],
    autopilot=[
        "Step-by-step scoring breakdown shown in AIPanel: which factors contributed how many points",
        "Validation gate failure shown in RunArtifact.no_action_reasons with human-readable explanation",
        "Score threshold configurable (default 65); adjust via config API without restart",
        "Backtesting module later will replay scoring on historical candidates to verify edge",
    ],
    risk=[
        "Risk: Over-tuning score weights → document weights with rationale; change only with backtest evidence",
        "Risk: Earnings blackout bypass → calendar.days_until_earnings uses multiple data sources",
        "Risk: Cluster concentration not enforced → count positions by sector; reject if >2 in same sector",
    ],
    code=[
        "def calculate_entry_score(c, sentiment, tech, llm_conf):",
        "    s = 0",
        "    # Factor 1: IV Rank (25 pts max)",
        "    s += 25 if c.iv_rank>=0.7 else (20+(c.iv_rank-0.5)*15 if c.iv_rank>=0.5 else c.iv_rank*33)",
        "    # Factor 2: PoP (20 pts max)",
        "    if c.pop < 0.5: return 0  # Hard reject",
        "    s += 20 if c.pop>=0.8 else (18 if c.pop>=0.7 else 15 if c.pop>=0.6 else 10)",
        "    return min(100, s)  # cap at 100",
    ],
    days=[
        "Mon: Design and document all 7 scoring factors with test cases",
        "Tue: Implement EntryScorer; write 25 scoring unit tests",
        "Wed: Implement Validator with all 12 gates",
        "Thu: Write 12 gate unit tests; wire into engine phases",
        "Fri: Add rejection log DB; expose scoring in dashboard; tag Week 9",
    ],
)

WEEKS[10] = dict(
    title="Exit Logic Automation & Position Monitor Loop",
    subtitle="Fully automate position monitoring: 5-minute exit checks, stop-loss, profit targets, DTE exits.",
    kpis=[("Exit Triggers","5 types"),("Poll Interval","5 min"),("Latency","<10s"),("Audit","Every exit logged")],
    goals=[
        "Implement PositionMonitor.run_pass(): evaluates all open positions against 5 exit triggers every 5 minutes",
        "Implement all 5 exit triggers with exact priority order from MASTER_PLAN.md",
        "Handle the 'roll' case: when strike defense decision is 'roll', generate replacement candidate automatically",
        "Build ExitRecord with full audit trail: position_id, trigger, entry_price, exit_price, pnl, held_days",
        "Wire monitoring pass into the daily scheduler (next week); for now, call via API endpoint",
        "Test every exit trigger path with mock positions and market data",
    ],
    tasks=[
        "Create services/autopilot/monitoring.py: PositionMonitor class",
        "Implement ExitTrigger enum: STOP_LOSS, NEWS_SHOCK, STRIKE_DEFENSE, DTE_THRESHOLD, PROFIT_TARGET",
        "evaluate_exit(position, current_price, news, calendar) → (should_exit, reason, urgency)",
        "Evaluate stop-loss: current_cost > 2x entry_credit → STOP_LOSS urgent",
        "Evaluate DTE: dte < 7 → DTE_THRESHOLD",
        "Evaluate profit: profit >= 0.5 * max_profit → PROFIT_TARGET",
        "Evaluate news: has_major_negative(symbol, 4h) → NEWS_SHOCK urgent",
        "Evaluate strike: underlying within 2% of short_strike → ai_strike_defense()",
        "Write 25+ tests covering all triggers and edge cases",
        "Create POST /api/v1/monitoring/run endpoint to trigger manually",
    ],
    deliverables=[
        "All 5 exit triggers fire correctly on mock positions",
        "ExitRecords persisted to exits table in DB",
        "P&L calculation accurate for credit spreads: (entry_credit - close_price) × qty × 100",
        "Urgent exits logged at WARNING level; normal exits at INFO",
        "Manual trigger endpoint works from dashboard",
    ],
    autopilot=[
        "MONITORING phase runs FIRST in every cycle — exits before entries, always",
        "Emergency exits (STOP_LOSS, NEWS_SHOCK) trigger instant execution regardless of market hours",
        "Roll decision: AI Strike Defense queries LLM with position context + news sentiment",
        "all_exit_actions[] in RunArtifact includes every position evaluated, not just exited ones",
    ],
    risk=[
        "Risk: Exit order fails at broker → retry 3x with 5s backoff; escalate to kill switch if still failing",
        "Risk: Stale position P&L used for stop-loss check → always fetch fresh quote before evaluating",
        "Risk: Monitor runs during market close → check market_is_open() before executing exits",
    ],
    code=[
        "def evaluate_exit(pos, current_price, news, cal):",
        "    loss = (current_price - pos.entry_credit) * pos.qty * 100",
        "    if loss >= 2 * pos.entry_credit * pos.qty * 100:",
        "        return True, ExitTrigger.STOP_LOSS, 'urgent'",
        "    if cal.days_until_earnings(pos.symbol) <= 2:",
        "        return True, ExitTrigger.DTE_THRESHOLD, 'urgent'",
        "    if pos.dte < 7: return True, ExitTrigger.DTE_THRESHOLD, 'normal'",
        "    profit = (pos.entry_credit-current_price)*pos.qty*100",
        "    if profit >= 0.5*pos.max_profit: return True, ExitTrigger.PROFIT_TARGET, 'optimal'",
        "    return False, None, None",
    ],
    days=[
        "Mon: Design ExitTrigger priority system; write specs for each trigger",
        "Tue: Implement PositionMonitor with stop-loss and profit target",
        "Wed: Implement DTE, news shock, and strike defense triggers",
        "Thu: Write 25+ unit tests; wire into engine MONITORING phase",
        "Fri: Add manual trigger endpoint; test E2E with paper positions",
    ],
)

WEEKS[11] = dict(
    title="n8n Scheduler & Full Autonomous Daily Loop",
    subtitle="Implement the full 4:00 AM → 4:05 PM daily schedule via n8n workflows; achieve true autonomous operation.",
    kpis=[("Schedule","5 workflows"),("Coverage","24hr loop"),("Docker","Required"),("Autonomy","99% target")],
    goals=[
        "Configure n8n with Docker (or APScheduler as fallback if Docker unavailable)",
        "Implement 5 scheduled workflows: pre-market-prep, market-open, intraday-scan, position-monitor, eod-report",
        "Build market hours awareness: is_market_open(), minutes_to_close(), next_open() functions",
        "Implement APScheduler-based scheduler as WSL Docker fallback (runs in Python process)",
        "Verify full daily loop runs autonomously: pre-market→open→scan→monitor→close→report",
        "Add circuit breaker: if 3+ consecutive cycles fail, auto-activate kill switch and send alert",
    ],
    tasks=[
        "pip install apscheduler",
        "Create services/automation/scheduler.py with APScheduler AsyncIOScheduler",
        "Add job: pre_market_prep() at 8:00 AM ET — warm data, check connectivity",
        "Add job: first_scan() at 10:00 AM ET — full candidate scan + execution",
        "Add job: intraday_scan() every 30 min 10:30→3:00 PM ET — continuous scanning",
        "Add job: monitor_positions() every 5 min during market hours — exit checks",
        "Add job: eod_report() at 4:05 PM ET — generate daily P&L summary",
        "Implement market_hours.py: NYSE calendar, is_market_open(), skip holidays",
        "Add consecutive-failure counter with kill-switch auto-activation at threshold 3",
        "Write n8n/workflows/*.json for Docker environment as alternative",
    ],
    deliverables=[
        "APScheduler runs full daily loop autonomously in a single Python process",
        "Market hours awareness: no scans on weekends or holidays",
        "Circuit breaker activates kill switch after 3 consecutive failures",
        "Daily log shows every scheduled job execution with timestamp and outcome",
        "n8n workflows defined as JSON backup for Docker environments",
    ],
    autopilot=[
        "This week completes the autonomous loop — the system now runs completely without human input",
        "Scheduler logs each job start/end with: job_name, scheduled_time, actual_time, duration_ms, success",
        "Pre-market prep includes: connectivity check, data warm-up, config reload from DB",
        "EOD report includes: daily P&L, total trades, win rate, account equity, tomorrow schedule preview",
    ],
    risk=[
        "Risk: Scheduler drift over time → use UTC internally, display in ET; verify with NYSE calendar library",
        "Risk: Job overlaps (monitor fires during scan) → use job coalescing: skip if previous run still active",
        "Risk: System clock is wrong in WSL → use ntpdate or chrony; verify clock on scheduler start",
    ],
    code=[
        "from apscheduler.schedulers.asyncio import AsyncIOScheduler",
        "scheduler = AsyncIOScheduler(timezone='America/New_York')",
        "scheduler.add_job(first_scan, 'cron', hour=10, minute=0)",
        "scheduler.add_job(monitor_positions, 'interval', minutes=5,",
        "    start_date='2025-01-01 09:30', end_date='2025-01-01 16:00')",
        "scheduler.add_job(eod_report, 'cron', hour=16, minute=5)",
        "scheduler.start()",
    ],
    days=[
        "Mon: Research APScheduler vs n8n; implement market_hours.py with NYSE calendar",
        "Tue: Build scheduler.py with all 5 jobs and timezone handling",
        "Wed: Implement circuit breaker; test failure escalation",
        "Thu: Run full simulated day loop; verify all jobs fire at correct times",
        "Fri: Write n8n JSON workflows; document autonomous operation; tag Week 11",
    ],
)

WEEKS[12] = dict(
    title="News Sentiment Engine & Event Classification",
    subtitle="Build the FinBERT-powered sentiment pipeline with real-time news scoring and event classification.",
    kpis=[("Model","FinBERT"),("Sources","5 feeds"),("Update Rate","5 min"),("Events Classified","3 tiers")],
    goals=[
        "Integrate FinBERT (ProsusAI/finbert) for real-time financial sentiment analysis",
        "Build multi-source news aggregator: Finnhub, SEC 8-K filings, and fallback to Yahoo Finance RSS",
        "Implement composite sentiment formula with source credibility and recency decay",
        "Build event classifier: HIGH (earnings/FDA/M&A), MEDIUM (analyst/launch), LOW (macro commentary)",
        "Wire sentiment into entry scoring (Factor 3) and exit logic (news_shock trigger)",
        "Cache sentiment scores per symbol with 5-minute TTL to avoid redundant FinBERT calls",
    ],
    tasks=[
        "pip install transformers torch finnhub-python feedparser",
        "Create services/autopilot/news_provider.py: fetch_headlines(symbol, hours=24)",
        "Create services/autopilot/news_sentiment.py: SentimentEngine with FinBERT",
        "Implement score_headline(headline, source, published_at) → float (-1 to +1)",
        "Implement aggregate_sentiment(symbol, hours=24) → CompositeScore with breakdown",
        "Implement classify_event(symbol) → EventClassification: HIGH/MEDIUM/LOW",
        "Add sentiment cache: Redis-compatible dict with TTL (use cachetools.TTLCache)",
        "Wire sentiment into validator: reject if HIGH event within 2 days of expiration",
        "Write tests: mock headlines, assert sentiment scores in expected range",
    ],
    deliverables=[
        "FinBERT running and scoring headlines in <500ms each",
        "Composite sentiment returned for 10 test symbols",
        "Event classification correctly identifies earnings as HIGH",
        "Sentiment cache reduces FinBERT calls by 90% in steady state",
        "News shock exit trigger fires when HIGH event detected",
    ],
    autopilot=[
        "Sentiment is now a real-time signal, not a static assumption",
        "SentimentSnapshot stored in RunArtifact: per-symbol sentiment scores at time of cycle",
        "Pre-market prep fetches and caches sentiment for all universe symbols — hot cache for scan",
        "Factor 3 in entry score uses cached sentiment → score reflects current market narrative",
    ],
    risk=[
        "Risk: FinBERT first load is slow (model download) → pre-load at startup; warm model in pre-market prep",
        "Risk: Finnhub rate limit → free tier 60 calls/min; implement symbol batching",
        "Risk: Sentiment model wrong on domain-specific jargon → test on 100 known headlines; accept ~80% accuracy",
    ],
    code=[
        "from transformers import pipeline",
        "nlp = pipeline('sentiment-analysis', model='ProsusAI/finbert')",
        "def score_headline(text, source, age_hours):",
        "    result = nlp(text[:512])[0]",
        "    raw = result['score'] if result['label']=='positive' else -result['score']",
        "    credibility = {'wsj':1.0,'reuters':0.9,'cnbc':0.7}.get(source,0.3)",
        "    recency = math.exp(-0.693 * age_hours / 6)",
        "    return raw * credibility * recency",
    ],
    days=[
        "Mon: Install transformers; test FinBERT on 20 sample headlines manually",
        "Tue: Build news_provider.py with Finnhub + RSS fallback; normalize output",
        "Wed: Build SentimentEngine with composite formula and recency decay",
        "Thu: Implement event classifier; wire into validator and exit logic",
        "Fri: Write tests; benchmark sentiment cycle time; tag Week 12",
    ],
)

WEEKS[13] = dict(
    title="Kill Switch, Kill Switch Recovery & Incident System",
    subtitle="Build a bulletproof emergency stop system with auto-recovery protocols and full incident tracking.",
    kpis=[("Kill Switch","<1s response"),("Auto-Recovery","3 levels"),("Incident Log","Full trail"),("Alerts","Email+Slack")],
    goals=[
        "Harden kill switch: one API call → all scheduled jobs paused, no new orders, all WS clients notified",
        "Build 3-tier auto-recovery: Level 1 (retry once), Level 2 (restart service), Level 3 (kill switch + alert)",
        "Implement incident tracking: every error captured as IncidentRecord with full stack trace",
        "Build alert system: Email (SMTP) and Slack webhook notifications for critical events",
        "Write runbook: step-by-step procedures for every known failure mode",
        "Load test recovery: simulate broker failure, data feed failure, LLM failure — verify correct response",
    ],
    tasks=[
        "Add kill_switch_activated_at column to config; broadcast ws event on activation",
        "Implement /api/v1/admin/kill (POST) and /api/v1/admin/resume (POST)",
        "Create services/incidents/incident_tracker.py: capture_incident(error, context, severity)",
        "Create IncidentRecord: id, timestamp, severity (FATAL/HIGH/MEDIUM), error_type, stack_trace, resolved_at",
        "Create services/alerts/alert_service.py: send_email(subject, body), send_slack(message)",
        "Implement recovery pipeline: on cycle error → Level1 retry → Level2 service restart → Level3 kill",
        "Write scripts/runbook.md with procedures for every failure mode",
        "Test: simulate 3 consecutive failures → assert kill switch activates and alert sent",
    ],
    deliverables=[
        "Kill switch activates in <1 second when called via API",
        "WebSocket broadcasts 'kill_switch_activated' event to all dashboard clients",
        "Incident tracker captures every exception with stack trace",
        "Email alert sent on FATAL incident (test with real SMTP)",
        "Auto-recovery correctly escalates through 3 levels",
        "Runbook complete and accurate",
    ],
    autopilot=[
        "Now the system can be trusted to run overnight — it fails safely and loudly",
        "Kill switch check is the FIRST thing every cycle does — even before data fetching",
        "'Incident dashboard' view in frontend: list of all incidents, severity badges, resolved/open status",
        "Weekly incident summary emailed every Sunday: incident count, MTTR, resolution rate",
    ],
    risk=[
        "Risk: Kill switch bypass due to async race condition → use a DB flag, not just in-memory",
        "Risk: Alert spam during prolonged outage → implement alert deduplication (same type: max 1/hour)",
        "Risk: Email credentials in env → always use env vars; never hardcode; test with non-production SMTP",
    ],
    code=[
        "async def activate_kill_switch(reason: str):",
        "    await db.set_config('kill_switch', True)",
        "    await db.set_config('kill_switch_reason', reason)",
        "    await ws_manager.broadcast({'type':'kill_switch','reason':reason})",
        "    await alert_service.send_slack(f'🚨 KILL SWITCH: {reason}')",
        "    scheduler.pause()  # stop all future jobs",
        "    logger.critical(f'Kill switch activated: {reason}')",
    ],
    days=[
        "Mon: Harden kill switch with DB persistence; broadcast WS event on activation",
        "Tue: Build incident tracker; integrate into all exception handlers",
        "Wed: Build alert service (SMTP + Slack webhook)",
        "Thu: Implement 3-tier auto-recovery; test all escalation paths",
        "Fri: Write runbook; run quarterly simulation; tag Q1 COMPLETE — celebrate!",
    ],
)


# ═══════════════════════════════════════════════════════════════════════════════
#  YEAR 1 — Q2  (Weeks 14–26)  Hardening, Testing & Production Readiness
# ═══════════════════════════════════════════════════════════════════════════════
WEEKS[14] = dict(
    title="Walk-Forward Backtesting Engine",
    subtitle="Build a rigorous walk-forward backtesting infrastructure to validate every strategy before live deployment.",
    kpis=[("Methodology","Walk-Forward"),("OOS Ratio",">70%"),("Scenarios","3 regimes"),("Speed","<5 min full run")],
    goals=[
        "Implement WalkForwardEngine: sliding 2-year train / 1-year test windows across 2018-2024",
        "Simulate trade execution with realistic costs: $0.65/contract + 0.5% slippage",
        "Compute OOS performance metrics: win rate, Sharpe, Sortino, max drawdown per window",
        "Aggregate results across all windows to get TRUE expected performance",
        "Build strategy comparison: run multiple strategy configs and rank by OOS Sharpe",
        "Store backtest results in DB; expose via /api/v1/backtest/results endpoint",
    ],
    tasks=[
        "Create services/backtest/engine.py: WalkForwardEngine class",
        "Implement fetch_historical_options(): load from DB or CSV fixture for testing",
        "Simulate entry: record credit received, max_profit, max_loss, dte at entry",
        "Simulate exit: iterate daily; fire exit triggers in same priority order as live engine",
        "Compute per-window stats: ProfitFactor, Sharpe, MaxDD using quantstats or manual",
        "Build BacktestResult dataclass: windows[], aggregate_sharpe, aggregate_win_rate, oos_ratio",
        "POST /api/v1/backtest/run → async task that runs backtest and stores result",
        "GET  /api/v1/backtest/results → list results with filter by strategy type",
    ],
    deliverables=[
        "WalkForwardEngine produces valid OOS results for PutCreditSpread strategy",
        "Results stored in DB and retrievable via API",
        "Sharpe and max drawdown computed correctly (verified against known dataset)",
        "Backtest completes in <5 minutes for 3-year history",
    ],
    autopilot=[
        "Autopilot MUST pass backtest gates before activating on any new strategy: Sharpe>1.0, MaxDD<20%",
        "BacktestView in frontend: interactive chart of equity curve + per-window metrics table",
        "Nightly backtest job (Week 94 concept, previewed here): run backtest on last 30 days live trades",
    ],
    risk=[
        "Risk: Look-ahead bias — use strict date boundary; NEVER use data from test window in training",
        "Risk: Survivorship bias — include delisted symbols from historical data fixture",
        "Risk: Overfitting from too many parameter combos → test max 3 parameters at a time",
    ],
    code=[
        "class WalkForwardEngine:",
        "    def run(self, strategy_fn, data, train_years=2, test_years=1):",
        "        results = []",
        "        for start in date_range(data.start, data.end, step=test_years):",
        "            train = data.slice(start, start+train_years)",
        "            test  = data.slice(start+train_years, start+train_years+test_years)",
        "            params = optimize(strategy_fn, train)",
        "            oos   = simulate(strategy_fn, test, params)",
        "            results.append(oos)",
        "        return aggregate(results)",
    ],
    days=[
        "Mon: Design walk-forward methodology; create historical data fixtures",
        "Tue: Build WalkForwardEngine core; implement simulation loop",
        "Wed: Implement all performance metrics computation",
        "Thu: Build API endpoints; test with real PutCreditSpread strategy",
        "Fri: Wire into frontend BacktestView; document methodology",
    ],
)

WEEKS[15] = dict(
    title="Monte Carlo Simulation & Risk-of-Ruin Analysis",
    subtitle="Run 1M+ outcome simulations to stress-test the strategy and quantify tail risk before risking real capital.",
    kpis=[("Simulations","1,000,000"),("Scenarios","7 stress"),("RoR Target","<1%"),("Speed","<60s")],
    goals=[
        "Implement MonteCarloSimulator with 1M trade-sequence shuffles",
        "Compute: expected return, 5th/95th percentile returns, max drawdown at 95th pct, risk-of-ruin",
        "Build 7 stress scenarios from MASTER_PLAN.md: Flash Crash, COVID 2020, Black Monday, etc.",
        "Stress test requires ALL scenarios to show drawdown < survival limit",
        "Monte Carlo results shown in frontend with distribution histogram",
        "Alert if risk-of-ruin > 1% — autopilot blocked until resolved",
    ],
    tasks=[
        "pip install numpy scipy matplotlib",
        "Create services/backtest/monte_carlo.py: MonteCarloSimulator",
        "Implement trade_shuffling(): shuffle historical trades, simulate equity curve 1M times",
        "Use numpy vectorization for speed: np.random.choice on returns array, cumsum for equity",
        "Stress scenarios: modify return distribution to simulate extreme conditions",
        "POST /api/v1/backtest/monte-carlo → runs simulation, returns distribution stats",
        "Add MC results block to ReportsView: histogram + risk-of-ruin gauge",
    ],
    deliverables=[
        "1M simulations complete in <60 seconds on modern CPU",
        "Risk-of-ruin correctly computed as P(equity < 0) across simulations",
        "All 7 stress scenarios produce results within survival limits for base strategy",
        "Frontend shows simulation results with histogram and key percentile markers",
    ],
    autopilot=[
        "MC simulation runs monthly (first Sunday of month) automatically",
        "If RoR > 1%: autopilot shows WARNING badge and requires human confirmation to continue",
        "Stress scenario results stored and compared month-over-month to detect strategy degradation",
    ],
    risk=[
        "Risk: 1M simulations too slow in Python → use numpy vectorized bootstrap instead of loop",
        "Risk: MC results look good but use wrong distribution → verify returns are IID before bootstrapping",
    ],
    code=[
        "def monte_carlo(trades, n=1_000_000):",
        "    returns = np.array([t.pnl_pct for t in trades])",
        "    samples = np.random.choice(returns, size=(n, len(trades)), replace=True)",
        "    equity = np.cumprod(1 + samples, axis=1)",
        "    final = equity[:, -1]",
        "    ror = np.mean(final < 0)",
        "    return {'p50': np.median(final), 'p5': np.percentile(final,5), 'ror': ror}",
    ],
    days=["Mon: Design MC methodology; build array-based bootstrap","Tue: Implement 7 stress scenarios with modified distributions","Wed: Build API endpoint; performance test for 1M speed","Thu: Build frontend histogram chart for MC results","Fri: Integration test; verify RoR blocking behavior"],
)

WEEKS[16] = dict(
    title="Real-Time Greeks Dashboard & Portfolio Exposure",
    subtitle="Build live portfolio Greeks monitoring with automatic exposure management and position balancing alerts.",
    kpis=[("Greeks","4 live"),("Update Rate","30s"),("Limits","Auto-enforced"),("Capacity Display","Yes")],
    goals=[
        "Build GreeksDashboard: real-time delta, theta, vega, gamma for entire portfolio",
        "Implement portfolio limits enforcement: delta ±0.20, theta positive, vega ±$500, gamma <$100/1%",
        "Show capacity indicator: how much more risk can be added within limits",
        "Alert when any portfolio Greek approaches a limit (>80% of limit = WARN, >100% = BLOCK)",
        "Build check_portfolio_balance() function called before every new trade validation",
        "Greeks update every 30 seconds during market hours using latest option quotes",
    ],
    tasks=[
        "Create services/options/greeks_aggregator.py: compute portfolio-level Greeks from positions",
        "GET /api/v1/portfolio/greeks → returns {delta, theta, vega, gamma, limits, capacity, alerts}",
        "Build GreeksTile.tsx: live table with per-position Greeks and portfolio totals",
        "Implement portfolio_delta_capacity(): remaining delta budget after current positions",
        "Add check_portfolio_balance(candidate) to validator: returns False if adding would breach limit",
        "Wire 30-second Greeks refresh into frontend WebSocket or polling",
    ],
    deliverables=[
        "Portfolio Greeks update every 30 seconds with real option quotes",
        "Validator rejects new trades that would breach any portfolio Greek limit",
        "Dashboard shows green/yellow/red indicators for each Greek near its limit",
        "Capacity bar shows remaining delta/vega budget at a glance",
    ],
    autopilot=[
        "Portfolio Greeks are a hard constraint — autopilot cannot breach them, period",
        "Delta imbalance detection: if portfolio delta > 0.15, autopilot prefers bearish strategies for balance",
        "Theta decay is the engine's core profit mechanism — positive theta displayed prominently",
    ],
    risk=["Risk: Stale quotes for Greeks → enforce quote age <120s before computing portfolio Greeks","Risk: Greeks computation slow for 10+ positions → cache individual Greeks; only recompute on quote update"],
    code=["def portfolio_greeks(positions, quotes):",
          "    return {g: sum(getattr(q,g)*p.qty for p,q in zip(positions,quotes))",
          "           for g in ['delta','theta','vega','gamma']}"],
    days=["Mon: Build greeks_aggregator.py with position-weighted sums","Tue: API endpoint; limit enforcement in validator","Wed: GreeksTile.tsx with live update","Thu: Capacity indicators; warning thresholds","Fri: Integration test with 5 open positions"],
)

WEEKS[17] = dict(
    title="Trade Execution Hardening & Order Management",
    subtitle="Harden the execution layer: multi-leg order submission, fill confirmation, partial fills, and order state machine.",
    kpis=[("Order Types","3 multi-leg"),("Fill Confirm","<5s"),("Partial Fills","Handled"),("Audit","Complete")],
    goals=[
        "Submit multi-leg spread orders as single combo orders to Alpaca (reduces slippage vs legging)",
        "Implement order state machine: PENDING → WORKING → FILLED / PARTIALLY_FILLED / CANCELLED",
        "Handle partial fills: store partial position, monitor for completion, retry or cancel remainder",
        "Confirm fills by polling order status with 5-second timeout; escalate to incident if no fill",
        "Build OrderRecord with full execution audit: order_id, legs[], fill_price, slippage, broker_ref",
        "Test execution with real paper trades on Alpaca; verify split fills handled correctly",
    ],
    tasks=[
        "Refactor alpaca_broker.py: submit_spread_order(legs: list[Leg]) → handles combo vs sequential",
        "Implement OrderStateMachine: transitions, timeouts, escalation to incident if stuck",
        "Poll alpaca.get_order(order_id) every 2s until FILLED or timeout (30s)",
        "Handle partial fills: update position with filled qty; schedule retry or cancel remainder",
        "Create orders table columns: fill_price, slippage_pct, legs_json, partial_fill_qty",
        "Write execution test suite: 10 paper orders including partial fill simulation",
    ],
    deliverables=[
        "Multi-leg spread orders placed as single Alpaca combo order",
        "Order state machine transitions correctly through all states",
        "Partial fills handled: position updated with correct filled quantity",
        "Execution audit trail complete in DB for every order attempt",
    ],
    autopilot=[
        "Execution phase now has real production-grade error handling",
        "Failed execution (no fill in 30s) → cancel order → log incident → try next candidate",
        "Fill price vs expected credit tracked as slippage_pct → feed into future entry scoring",
    ],
    risk=["Risk: Combo order not supported by Alpaca paper → fallback to sequential leg execution with retry","Risk: Order stuck in WORKING state → hard timeout at 60s; cancel and escalate to incident"],
    code=["async def await_fill(order_id, timeout=30):",
          "    for _ in range(timeout//2):",
          "        o = alpaca.get_order(order_id)",
          "        if o.status == 'filled': return o",
          "        if o.status == 'cancelled': raise OrderCancelledError()",
          "        await asyncio.sleep(2)",
          "    raise OrderTimeoutError(f'{order_id} not filled in {timeout}s')"],
    days=["Mon: Redesign execution layer for combo orders","Tue: Order state machine with all transitions","Wed: Partial fill handling; retry logic","Thu: Write 10-paper-order test suite","Fri: Slippage tracking; wire into entry scoring feedback loop"],
)

WEEKS[18] = dict(
    title="Performance Attribution & Reporting Engine",
    subtitle="Build automated daily/weekly/monthly P&L reports with performance attribution by strategy, symbol, and regime.",
    kpis=[("Reports","3 frequencies"),("Attribution","3 dimensions"),("Delivery","Email+Dashboard"),("Format","PDF+JSON")],
    goals=[
        "Daily EOD report: total P&L, open positions summary, win rate, top winner/loser",
        "Weekly report: 7-day P&L chart, strategy breakdown, sector exposure, Greeks recap",
        "Monthly report: full performance attribution, Monte Carlo update, strategy ranking, improvement recommendations",
        "Attribution by: strategy_type, underlying symbol, IV regime, market regime",
        "PDF report generation with reportlab; email delivery via SMTP",
        "All reports stored in DB and accessible via /api/v1/reports endpoint",
    ],
    tasks=[
        "pip install reportlab",
        "Create services/autopilot/reporting.py: ReportEngine class",
        "Implement generate_daily_report(): query DB for today's trades, compute stats, format PDF",
        "Implement generate_weekly_report(): 7-day equity curve, per-strategy breakdown",
        "Implement generate_monthly_report(): full analytics including Monte Carlo update",
        "POST /api/v1/reports/generate?period=daily|weekly|monthly",
        "GET  /api/v1/reports?period=weekly&limit=10",
        "Build ReportsView.tsx: list of reports with preview and download button",
    ],
    deliverables=[
        "Daily PDF report generated at 4:05 PM automatically",
        "Weekly report emailed every Sunday morning",
        "Attribution correctly identifies which strategies and symbols drove P&L",
        "ReportsView shows last 10 reports of each frequency",
    ],
    autopilot=["Reports are how the user KNOWS the autopilot is working — CRITICAL feature","Monthly report includes 'strategy health' section: is backtest edge degrading? Recommend changes","Report includes LLM agreement rate: what % of cycles had both LLMs agree"],
    risk=["Risk: ReportEngine crashes if no trades that day → handle empty periods gracefully (0-trade report)","Risk: PDF too large for email → compress with zlib; limit to last 90 days in monthly"],
    code=["def generate_daily_report(date):",
          "    trades = db.get_trades(date)",
          "    pnl = sum(t.pnl for t in trades)",
          "    win_rate = len([t for t in trades if t.pnl>0])/max(len(trades),1)",
          "    return compile_pdf({'date':date,'pnl':pnl,'win_rate':win_rate,'trades':trades})"],
    days=["Mon: Design report structure; implement daily report","Tue: Weekly report with equity curve chart","Wed: Monthly report with Monte Carlo update","Thu: Email delivery; PDF formatting polish","Fri: ReportsView in frontend; schedule daily/weekly jobs"],
)

WEEKS[19] = dict(
    title="Symbol Universe Management & Market Regime Detection",
    subtitle="Build intelligent universe selection and market regime classifier that adapts strategy mix to conditions.",
    kpis=[("Universe","500 symbols"),("Filter Speed","<2s"),("Regimes","4 types"),("Adaptation","Automatic")],
    goals=[
        "Build symbol universe: 500 large-cap equities + top-20 ETFs, liquid options, filtered for quality",
        "Universe filter criteria: avg_volume>1M, market_cap>$1B, options_volume>500/day, iv_liquidity>0.3",
        "Implement MarketRegimeDetector: classify current regime as Bull/Bear/Neutral/HighVol",
        "Map regime → strategy allocation: Bull→more calls, Bear→more puts, HighVol→more iron condors",
        "Pre-market universe scan: filter 500 → ~150 qualified symbols for the day",
        "Weekly universe refresh: add newly qualified symbols, remove those that no longer qualify",
    ],
    tasks=[
        "Create services/autopilot/universe.py: UniverseManager",
        "Load initial 500 symbols from S&P 500 + Russell 1000 list (CSV in data/)",
        "Filter universe daily: volume, market cap, options liquidity checks",
        "MarketRegimeDetector: use VIX level + SPY 50dma position + VIX 30d trend",
        "Regime → strategy_allocation dict: override default allocation weights per regime",
        "GET /api/v1/universe → qualified symbols for today with filter stats",
        "POST /api/v1/universe/refresh → trigger manual universe refresh",
    ],
    deliverables=[
        "500-symbol universe filtered down to qualified set in <2 seconds",
        "Regime correctly classified as Bull/Bear/Neutral/HighVol for test dates",
        "Strategy allocation automatically shifts based on regime",
        "Universe refresh runs every Monday pre-market",
    ],
    autopilot=["Autopilot skips symbols that don't pass universe filter — no exceptions","Regime displayed prominently in AIPanel: '📈 Regime: BULL · Strategy Mix: 60% Put Credit'","Universe filter results logged to DB: how many symbols qualify each day"],
    risk=["Risk: All symbols filtered out on low-liquidity day → minimum universe floor of 20 symbols","Risk: Regime detection wrong during rapid transitions → add 3-day confirmation window before switching"],
    code=["def classify_regime(vix, spy_price, spy_50dma):",
          "    if vix > 30: return 'HIGH_VOL'",
          "    if spy_price > spy_50dma * 1.02: return 'BULL'",
          "    if spy_price < spy_50dma * 0.98: return 'BEAR'",
          "    return 'NEUTRAL'"],
    days=["Mon: Load 500-symbol universe; implement volume/liquidity filters","Tue: MarketRegimeDetector with VIX + SPY signals","Wed: Regime → strategy allocation mapping","Thu: Pre-market universe scan job; API endpoints","Fri: Test regime detection on historical dates; document"],
)

WEEKS[20] = dict(
    title="Comprehensive Test Suite — 1,000+ Tests",
    subtitle="Reach full test coverage: 1,033+ backend tests across unit, integration, and E2E levels.",
    kpis=[("Total Tests","1,033+"),("Coverage",">85%"),("Runtime","<5 min"),("Flakiness","Zero")],
    goals=[
        "Reach 1,033+ passing pytest tests across all backend services",
        "Achieve >85% code coverage on all service modules",
        "Zero flaky tests: any test that fails randomly is fixed or removed",
        "Playwright E2E tests for critical user journeys: run autopilot cycle, view positions, kill switch",
        "22 Vitest unit tests all passing with <5s runtime",
        "CI pipeline runs full test suite on every PR in <10 minutes",
    ],
    tasks=[
        "Audit existing tests; identify coverage gaps using pytest-cov",
        "Write missing unit tests for: scoring, validator, monitoring, universe, regime",
        "Write integration tests for: full cycle with real DB, broker mocks, LLM mocks",
        "Write Playwright E2E: login→dashboard→run cycle→view run artifact→kill switch",
        "Fix all flaky tests: identify timing dependencies; use deterministic mocks",
        "Optimize CI: parallelize test suites; cache pip and npm dependencies",
        "Add test coverage badge to README",
    ],
    deliverables=[
        "1,033+ tests all passing in CI",
        ">85% coverage report generated by pytest-cov",
        "Playwright E2E passes headlessly in CI",
        "CI pipeline completes in <10 minutes",
        "Zero flaky test failures in last 10 CI runs",
    ],
    autopilot=["All autopilot cycle phases individually tested with comprehensive mocks","Regression test: run full dry_run cycle → assert RunArtifact structure matches schema exactly","Property-based testing (hypothesis): entry scorer always returns 0-100 for any valid input"],
    risk=["Risk: Integration tests require real API keys → use request recording (VCR) for CI","Risk: Test DB state bleeding between tests → use transaction rollback fixture per test"],
    code=["@pytest.fixture(autouse=True)",
          "def db_rollback(db_session):",
          "    yield db_session",
          "    db_session.rollback()  # every test gets clean DB state",
          "",
          "@pytest.mark.asyncio",
          "async def test_cycle_dry_run():",
          "    engine = UnifiedAutopilotEngine(config=test_config)",
          "    artifact = await engine.run_cycle(dry_run=True)",
          "    assert artifact.success is True"],
    days=["Mon: pytest-cov audit; identify top 20 coverage gaps","Tue: Write 200+ missing unit tests","Wed: Write integration tests with VCR cassettes","Thu: Playwright E2E tests; CI parallelization","Fri: Zero flaky tests verification; update coverage badge"],
)

WEEKS[21] = dict(
    title="Options Volatility Surface & IV Analytics",
    subtitle="Build 3D implied volatility surface visualization and IV analytics for smarter trade selection.",
    kpis=[("Surface","3D vol surface"),("IV Rank","52-week"),("IV Percentile","vs 1yr"),("Update","15 min")],
    goals=[
        "Implement implied volatility surface: IV vs strike × expiration as a 3D matrix",
        "Visualize vol surface as a 3D chart in VolSurfaceTile.tsx (using Three.js or Plotly)",
        "Implement IV Percentile (IVP): current IV vs 1-year historical distribution (better than IV Rank)",
        "Use IV surface shape to detect vol skew opportunities: steep put skew → prefer put spreads",
        "Alert when vol surface inverts (front month IV > back month) — unusual signal",
        "Store IV surface snapshots daily for trend analysis",
    ],
    tasks=[
        "Extend TradierProvider: build IV matrix from full chain across expirations",
        "Create services/options/vol_surface.py: build_surface(symbol) → 2D numpy array",
        "GET /api/v1/options/vol-surface?symbol=AAPL → JSON matrix for charting",
        "Build VolSurfaceTile.tsx with Plotly.js surface chart",
        "Implement compute_iv_percentile(symbol, current_iv, lookback_days=252)",
        "Store daily IV snapshots in iv_history table: symbol, date, atm_iv, skew_ratio",
        "Wire IVP into entry scorer: use IVP instead of IV Rank (90-day lookback preferred)",
    ],
    deliverables=[
        "3D vol surface renders correctly for AAPL and SPY",
        "IVP computed for universe symbols using 1-year history",
        "Vol surface inversion alert fires correctly for test case",
        "IV history table populated daily via scheduler",
    ],
    autopilot=["Entry scorer now uses IVP (superior to IV Rank for regime-awareness)","Vol skew analysis: steep put skew adds 3 bonus points to put credit spread score","Dashboard shows 'vol rank' badge on each position showing IVP at entry time"],
    risk=["Risk: Vol surface sparse for less-liquid symbols → handle missing strikes with linear interpolation","Risk: IVP needs 252 days of history → cold-start period uses IV Rank as fallback"],
    code=["def build_surface(chains):",
          "    strikes = sorted({c.strike for c in chains})",
          "    expirations = sorted({c.expiration for c in chains})",
          "    matrix = np.zeros((len(expirations), len(strikes)))",
          "    for c in chains:",
          "        i = expirations.index(c.expiration)",
          "        j = strikes.index(c.strike)",
          "        matrix[i][j] = c.iv",
          "    return matrix, strikes, expirations"],
    days=["Mon: Build IV matrix from option chain; compute surface","Tue: Vol surface API endpoint","Wed: VolSurfaceTile.tsx with Plotly 3D","Thu: IVP calculation with 252-day history","Fri: Daily snapshot scheduler; skew detector"],
)

# Weeks 22-26: briefer format but still full detail
WEEKS[22] = dict(
    title="Earnings Calendar & Event-Driven Risk Gateway",
    subtitle="Integrate earnings calendar with automated blackout zones and event-driven risk adjustments.",
    kpis=[("Sources","2 calendars"),("Blackout","2d pre-earnings"),("Coverage","Full S&P500"),("Accuracy",">99%")],
    goals=["Integrate Tradier earnings calendar + Nasdaq earnings API as dual sources","Implement earnings_blackout_gate: reject any trade if earnings within 2 trading days","Build event timeline: show upcoming earnings for all positions on dashboard","Send pre-market alert listing today's and tomorrow's earnings for held symbols","Implement post-earnings analysis: capture IV crush, price move, P&L impact"],
    tasks=["Create services/data/earnings_calendar.py: EarningsCalendar with dual-source validation","GET /api/v1/calendar/earnings?symbols=AAPL,MSFT → earnings dates","Add earnings_blackout_gate to ValidationGate enum; implement in validator","CalendarTile.tsx: heatmap of upcoming earnings for watchlist","Alerter: pre-market check — if any position has earnings today: send URGENT alert","Store IV before and after earnings in iv_events table for post-analysis"],
    deliverables=["Earnings dates returned for all 500 universe symbols","Blackout gate blocks trades within 2 days of earnings (tested)","Pre-market alert sends list of at-risk positions","Post-earnings IV crush captured in DB"],
    autopilot=["Earnings blackout is a HARD STOP — cannot be disabled via config","Pre-earnings position review: autopilot evaluates whether to close 3 days before, not just 2","earnings_risk_score added to position record: countdown days × IV exposure"],
    risk=["Risk: Earnings date wrong (company reschedules) → dual-source validation + manual override API","Risk: After-hours earnings miss a day boundary → use 'confirmed_date' field only; ignore unconfirmed"],
    code=["def earnings_blackout_gate(candidate, calendar):",
          "    dte = calendar.days_until_earnings(candidate.symbol)",
          "    return ValidationResult(passed=dte is None or dte > 2,",
          "                           gate=ValidationGate.EARNINGS_BLACKOUT,",
          "                           reason=f'Earnings in {dte} days')"],
    days=["Mon: Earnings calendar integration (dual source)","Tue: Blackout gate in validator","Wed: CalendarTile.tsx","Thu: Pre-market earnings alert job","Fri: Post-earnings IV analysis; event DB table"],
)

WEEKS[23] = dict(
    title="Alerting System & Notification Hub",
    subtitle="Build a comprehensive multi-channel alerting system for price alerts, risk warnings, and system events.",
    kpis=[("Channels","Email+Slack+WS"),("Alert Types","10+"),("Delivery","<30s"),("Dedup","1hr window")],
    goals=["Build AlertsEngine: 10+ alert types managed centrally","Price alerts: user-set price targets → notify when triggered","Risk alerts: Greeks near limit, drawdown approaching max, consecutive losses","System alerts: cycle failures, broker disconnected, budget exceeded","Implement deduplication: same alert type per symbol → max 1 per hour","AlertsView.tsx: manage active alerts, history, acknowledgement"],
    tasks=["Create services/alerts/alerts_engine.py: AlertsEngine with alert_type router","Define AlertType enum: PRICE_TARGET, GREEK_LIMIT, DRAWDOWN_WARNING, EARNINGS_RISK, CYCLE_FAILURE, KILL_SWITCH","Implement check_price_alerts() in intraday scan loop","Implement check_risk_alerts() in Greeks monitoring","POST /api/v1/alerts → create alert | GET /api/v1/alerts → list | DELETE /api/v1/alerts/{id}","AlertsView.tsx with create-alert form, active-alerts table, alert history"],
    deliverables=["10+ alert types configured and firing correctly in tests","Price alert fires when AAPL crosses target price (paper test)","Deduplication prevents alert spam","AlertsView shows all active and historical alerts"],
    autopilot=["Autopilot events → alert pipeline: every significant engine event creates an alert","Alert confidence: 'high-confidence' alerts (both LLMs + high score) get ✓ badge","Alert history shown in RunsAuditView: what alerts fired during each cycle"],
    risk=["Risk: Alert channel down (Slack webhook expired) → queue alerts in DB; retry with backoff","Risk: Alert spam on volatile day → exponential backoff + dedup window"],
    code=["async def check_price_alerts(symbol, current_price):",
          "    alerts = db.get_active_alerts(symbol, 'PRICE_TARGET')",
          "    for a in alerts:",
          "        if (a.direction=='above' and current_price>=a.target) or \\",
          "           (a.direction=='below' and current_price<=a.target):",
          "            await fire_alert(a, current_price)"],
    days=["Mon: AlertsEngine core; 10 alert types","Tue: Price alert checker in scan loop","Wed: Risk alerts (Greeks, drawdown)","Thu: AlertsView.tsx","Fri: Deduplication; E2E test all channels"],
)

WEEKS[24] = dict(
    title="Data Integrity Pipeline & Quality Gates",
    subtitle="Add multi-source data verification, staleness detection, and automated self-healing for corrupt data.",
    kpis=[("Sources","3-way verify"),("Staleness","<5s threshold"),("Self-Heal","Auto-retry"),("Audit","Data lineage")],
    goals=["Implement multi-source price verification: Tradier + Alpaca + yfinance must agree within 1%","Staleness detector: data older than 5 seconds = stale; cycle aborts and retries","Build DataAuditLog: every piece of data used in a decision logged with source, timestamp, value","Implement self-healing: on stale data, rotate to backup source automatically","Sanity bounds validation: stock price 0-100000, IV 0-500%, delta -1 to +1","Add data quality score to RunArtifact: % of data points that needed fallback or rejection"],
    tasks=["Create services/data/data_guardian.py: DataGuardian.validate(symbol, data_type, value)","Implement price cross-check: fetch Tradier + Alpaca quotes, compare within tolerance","Implement freshness_check(data): raise StaleDataError if age > threshold","Add backup_source rotation: primary → secondary → tertiary → abort","DataAuditLog table: run_id, symbol, data_type, source, value, age_ms, validated_at","Add data_quality_score to RunArtifact: 1.0 = all data pristine, 0.8 = 20% from backup"],
    deliverables=["Price cross-check catches spoofed or erroneous quote (test case)","StaleDataError correctly aborts cycle and retries from backup source","DataAuditLog populated for every run","Data quality score displayed in run history view"],
    autopilot=["Data guardian runs as a middleware layer — ALL data passes through it before reaching scoring","If data quality score < 0.7 → cycle skips execution entirely; logs WARNING","Data quality trends tracked weekly; degradation triggers alert"],
    risk=["Risk: All 3 sources return bad data simultaneously → hard abort cycle; manual review","Risk: DataAuditLog grows too large → partition by month; archive after 90 days"],
    code=["def verify_price(symbol):",
          "    prices = [tradier.quote(symbol), alpaca.quote(symbol), yf.info(symbol)['regularMarketPrice']]",
          "    if max(prices)/min(prices) > 1.01:",
          "        raise DataMismatchError(f'{symbol}: prices diverge {prices}')",
          "    return median(prices)"],
    days=["Mon: DataGuardian core; price cross-check","Tue: Freshness check; backup source rotation","Wed: DataAuditLog table and population","Thu: Data quality score in RunArtifact","Fri: Integration test all data guard scenarios"],
)

WEEKS[25] = dict(
    title="Frontend Polish: Dark Theme, Animations & UX",
    subtitle="Transform the dashboard from functional to premium: dark terminal aesthetics, micro-animations, and pro UX.",
    kpis=[("Theme","Dark terminal"),("Animations","12 micro"),("Accessibility","WCAG AA"),("Performance","<100ms FCP")],
    goals=["Implement cohesive dark terminal theme: #0D1117 background, blue accent #2196F3, Fira Code monospace","Add 12 micro-animations: panel transitions, P&L counters, status pulsing, chart fade-in","Performance: First Contentful Paint <100ms; no layout shifts; lazy-load heavy panels","Accessibility: keyboard navigation for all interactive elements; screen reader labels; focus rings","Mobile-responsive layout: dashboard works on tablet (1024px) without horizontal scroll","Add premium touches: animated gradient header, glassmorphism panels, smooth number transitions"],
    tasks=["Create frontend/src/styles/theme.ts with all design tokens","Implement TailwindCSS dark mode; configure custom colors in tailwind.config.ts","Add Framer Motion animations to: panel open/close, P&L increment/decrement, status change","Build animated status pulsing component for 'Autopilot Running' indicator","Add ARIA labels to all dashboard interactive elements","Performance: lazy-load VolSurfaceTile, Monte Carlo chart (heavy components)","Lighthouse audit: score >90 performance, >90 accessibility"],
    deliverables=["Dashboard looks like a premium Bloomberg-style terminal","All 12 micro-animations smooth at 60fps","Lighthouse scores: Performance 90+, Accessibility 90+","Mobile 1024px layout functional","No WCAG contrast failures"],
    autopilot=["AIPanel redesign: prominent START/STOP button, animated status ring, live metrics","Status ring: pulsing green when running, static grey when idle, blinking red when killed","RunArtifact card shows animated number increment for candidates_considered and orders_placed"],
    risk=["Risk: Framer Motion increases bundle size → lazy-import animations; target <500KB gzipped","Risk: Animations cause jank on lower-end hardware → use CSS transforms only; avoid layout animations"],
    code=["// Animated P&L counter",
          "const AnimatedPnL = ({value}: {value: number}) => {",
          "  const spring = useSpring(value, {damping:20,stiffness:100})",
          "  return <motion.span style={{color: value>=0?'#4CAF50':'#F44336'}}>",
          "    {spring.get().toFixed(2)}</motion.span>",
          "}"],
    days=["Mon: Design token system; implement dark theme throughout","Tue: Framer Motion animations for panels and status","Wed: Animated P&L counter; chart fade-in","Thu: ARIA labels; keyboard navigation; focus management","Fri: Lighthouse audit; performance fixes; mobile layout"],
)

WEEKS[26] = dict(
    title="Q2 Wrap-Up: Integration Testing, Hardening & v1.0 Tag",
    subtitle="Full-stack integration test, production hardening, security audit, and tagging the v1.0 milestone release.",
    kpis=[("Release","v1.0.0"),("E2E Tests","10 journeys"),("Security","OWASP Top10"),("Uptime","99.9% target")],
    goals=["Run 10 complete E2E user journeys end-to-end with Playwright","Security audit: OWASP Top 10 review; fix any HIGH/CRITICAL findings","Performance load test: API handles 100 concurrent users with P99 < 200ms","Tag v1.0.0; create GitHub release with changelog, architecture diagram, setup guide","Deploy to production (or staging) environment; verify all services start cleanly","Write post-Q2 retrospective: what worked, what to improve in Q3"],
    tasks=["Playwright E2E: run autopilot cycle, view run artifact, create price alert, kill switch, view reports","Run OWASP ZAP scan against API; fix any HIGH findings (injection, CSRF, auth bypass)","Locust load test: 100 VU hitting /cycle and /positions for 5 minutes","Fix all issues found by E2E, security, and load tests","git tag v1.0.0 and push with annotated tag message","Write GitHub release notes: features, known limitations, upgrade path"],
    deliverables=["All 10 E2E journeys pass headlessly in CI","Zero HIGH/CRITICAL security findings","API P99 < 200ms under 100 concurrent users","v1.0.0 tagged and released on GitHub","Retrospective document in docs/retrospectives/q2.md"],
    autopilot=["v1.0 marks: scheduler running, dual-LLM pipeline, backtesting, sentient monitoring — COMPLETE","First live paper trading week: track every cycle, every decision, every trade for 5 trading days","Document: did the autopilot actually work? What did it trade? What was the paper P&L?"],
    risk=["Risk: Security scan finds credential leakage → audit all log outputs; mask API keys in logs","Risk: Load test reveals DB bottleneck → add SQLite WAL + connection pool; scale reads"],
    code=["# locust load test",
          "class ApexUser(HttpUser):",
          "    wait_time = between(1,3)",
          "    @task(2) def check_status(self): self.client.get('/api/v1/autopilot/status')",
          "    @task(1) def run_cycle(self): self.client.post('/api/v1/autopilot/cycle')"],
    days=["Mon: Write all 10 Playwright E2E scenarios","Tue: OWASP ZAP security scan; fix findings","Wed: Locust load test; performance fixes","Thu: Write GitHub release notes; tag v1.0.0","Fri: Deploy to staging; verify all services; Q2 retrospective"],
)


# ══ Q3 Weeks 27-39 ══
WEEKS[27] = dict(
    title="Advanced LLM Prompt Engineering & Chain-of-Thought",
    subtitle="Upgrade dual-LLM pipeline with CoT reasoning, structured outputs, and explainability traces.",
    kpis=[("CoT Steps","5-step"),("JSON Schema","Enforced"),("Explainability","Per-trade"),("Agreement","Logged")],
    goals=["Implement 5-step chain-of-thought prompts for Groq and Gemini","Enforce JSON schema output validation for every LLM response","Build explainability trace: why each candidate was selected/rejected with LLM reasoning","Log LLM agreement/disagreement patterns over time for meta-learning","Implement few-shot examples in prompts from best historical trades","Reduce LLM latency by caching prompt templates and parallel calls"],
    tasks=["Upgrade groq_ranker.py: 5-step CoT prompt template","json_schema validator: validate LLM output matches TradeDecision schema","Store llm_reasoning text per trade decision in DB","Parallel Groq+Gemini calls with asyncio.gather for speed","Few-shot prompt builder: inject top-3 historical trades as examples","GET /api/v1/runs/{id}/llm-trace → full reasoning for each decision"],
    deliverables=["LLM responses always valid JSON matching schema","CoT reasoning visible in run artifact trace","Parallel LLM calls reduce pipeline latency by ~40%","LLM agreement rate tracked weekly"],
    autopilot=["CoT forces LLM to reason about Greeks, IV, days-to-expiry explicitly before deciding","Disagreement logger: when Groq says YES but Gemini says NO, log the delta for review","Few-shot examples updated monthly from top 10 highest-scoring closed trades"],
    risk=["Risk: CoT prompt too long → exceeds token limit; use compressed few-shot (2 examples max)","Risk: JSON parse failure on malformed response → retry once; then use deterministic fallback"],
    code=["COT_PROMPT = '''",
          "Analyze this options trade step by step:",
          "1. Market regime assessment",
          "2. Greeks risk evaluation",
          "3. IV rank vs historical",
          "4. Risk/reward ratio",
          "5. Final verdict (accept/reject)",
          "Respond ONLY as JSON: {\"verdict\":\"accept\"|\"reject\",\"confidence\":0-1,\"reasoning\":\"...\"}",
          "'''"],
    days=["Mon: CoT prompt templates for Groq+Gemini","Tue: JSON schema validator with retry","Wed: Parallel LLM calls with asyncio.gather","Thu: Few-shot example builder from historical trades","Fri: LLM trace API; test agreement rate logging"],
)

WEEKS[28] = dict(
    title="Portfolio Correlation & Sector Exposure Management",
    subtitle="Prevent portfolio concentration risk with correlation filtering and sector exposure caps.",
    kpis=[("Correlation","Max 0.7"),("Sectors","Max 30%"),("Matrix","Real-time"),("Blocked","Auto")],
    goals=["Compute pairwise correlation matrix for all open positions","Block new trades that would create >0.7 correlation with existing position","Implement sector exposure cap: max 30% of portfolio in any single GICS sector","Show correlation heatmap in PortfolioView","Track correlation drift: alert when correlation rises post-entry (merger, index rebalancing)","Sector lookup table: map symbol → GICS sector for all 500 universe symbols"],
    tasks=["Create services/portfolio/correlation.py: compute_correlation_matrix()","Add correlation_gate to ValidationGates: reject if pairwise_corr > 0.7","Build sector_exposure() from DB positions + sector_map CSV","Add sector_cap_gate: reject if adding symbol would put sector > 30%","CorrelationTile.tsx: heatmap using Chart.js matrix plugin","Weekly correlation drift alert job"],
    deliverables=["Correlation matrix computed from 30-day price returns for all positions","Correlation gate blocks correlated trade (test case passes)","Sector exposure bar chart in PortfolioView","Sector cap gate blocks concentrated sector trade"],
    autopilot=["Correlation gate makes autopilot naturally diversified — no manual balancing needed","Sector exposure logged with every RunArtifact for trend analysis","Correlation drift alert: if two positions become >0.85 correlated post-entry → evaluate closing one"],
    risk=["Risk: Correlation computation needs 30-day history → skip for new listings (<30 days old)","Risk: Correlation matrix too slow for 20+ positions → cache with 1-hour refresh"],
    code=["def correlation_gate(candidate, open_positions, returns_df):",
          "    for pos in open_positions:",
          "        corr = returns_df[candidate.symbol].corr(returns_df[pos.symbol])",
          "        if abs(corr) > 0.7:",
          "            return ValidationResult(passed=False, reason=f'Corr {corr:.2f} with {pos.symbol}')"],
    days=["Mon: Correlation matrix from returns DB","Tue: Correlation gate in validator","Wed: Sector map CSV + sector exposure cap","Thu: CorrelationTile.tsx heatmap","Fri: Correlation drift alert; E2E test"],
)

WEEKS[29] = dict(
    title="Advanced Exit Logic: Trailing Stops & Gamma Scalping",
    subtitle="Enhance exit logic with dynamic trailing stops, gamma scalping, and volatility-adjusted exit thresholds.",
    kpis=[("Trailing Stop","Dynamic"),("Gamma Scalp","Optional"),("Exit Score","5 factors"),("Override","Manual OK")],
    goals=["Implement dynamic trailing stop: lock in 50% of max profit when position reaches 60% profit","Gamma scalping option: for delta-heavy positions, scalp deltas to reduce cost basis","Volatility-adjusted exits: tighten stop loss when VIX spikes (regime-aware exits)","Build exit score: 5-factor composite (DTE, P&L%, IV change, delta drift, news score)","Manual exit override: UI button to immediately close position at market","Exit replay: show what exit trigger fired and at what exact time in run history"],
    tasks=["Upgrade PositionMonitor: add trailing_stop tracking to each position","trailing_stop_update(): when P&L% > 60%, set trailing = current - 50%*(max_profit - current)","VIX-adjusted stop: if VIX > 25, tighten stop to 30% loss (vs 50% default)","Gamma_scalp_hedge(): optional hedge for positions with |delta| > 0.3","ExitScore dataclass: compute from 5 factors; persist per monitoring event","Add 'Close Now' button to PositionTile with confirmation modal"],
    deliverables=["Trailing stop correctly locks in 50% profit after 60% threshold hit (tested on paper)","VIX spike triggers tighter stop loss (test with VIX=28)","Exit score computed every 5 minutes per position","Manual close executes immediately and logs exit_trigger=MANUAL"],
    autopilot=["Trailing stop is the autopilot's most profitable exit enhancement — captures winners","Gamma scalping is optional (config.gamma_scalp_enabled) — disabled by default for simplicity","Exit replay makes every close transparent: user can see exactly WHY position was closed"],
    risk=["Risk: Trailing stop too aggressive → whipsaws on volatile days; add 15-min lockout after trigger","Risk: Manual close during fast market fails → confirm fill before updating position to CLOSED"],
    code=["def update_trailing_stop(pos: Position) -> float:",
          "    pnl_pct = pos.unrealized_pnl / pos.max_profit",
          "    if pnl_pct >= 0.6 and pos.trailing_stop is None:",
          "        pos.trailing_stop = pos.unrealized_pnl * 0.5  # lock 50%",
          "    elif pos.trailing_stop:",
          "        pos.trailing_stop = max(pos.trailing_stop, pos.unrealized_pnl*0.5)",
          "    return pos.trailing_stop"],
    days=["Mon: Trailing stop tracking per position","Tue: VIX-adjusted exit thresholds","Wed: Exit score 5-factor computation","Thu: Manual close UI button + confirmation","Fri: Exit replay in run history; test all scenarios"],
)

WEEKS[30] = dict(
    title="n8n Workflow Orchestration (Docker Setup)",
    subtitle="Deploy n8n in Docker for enterprise-grade workflow automation, replacing APScheduler for critical paths.",
    kpis=[("Workflows","8 active"),("Reliability","Retry+alert"),("UI","n8n visual"),("Trigger","Webhook+cron")],
    goals=["Deploy n8n via Docker Compose alongside FastAPI and SQLite","Migrate 8 critical workflows from APScheduler to n8n: pre-market, scan, monitor, EOD, reports, backup, alert, recovery","Each workflow: retry on failure, send Slack alert on repeated failure, log execution in n8n history","Expose /api/v1/workflows/trigger endpoint for manual workflow execution from dashboard","n8n webhooks call FastAPI endpoints; FastAPI calls back with results via HTTP","WorkflowsView.tsx: list active workflows, last run status, trigger manually"],
    tasks=["docker-compose.yml: add n8n service on port 5678 with volume mount","Configure n8n credentials: Alpaca, Tradier, Groq, SMTP","Create n8n workflows: JSON export for each of 8 workflows","FastAPI: POST /api/v1/workflows/trigger?name=pre-market → triggers n8n webhook","GET /api/v1/workflows → list workflows and last execution status from n8n API","WorkflowsView.tsx: workflow cards with status LEDs and trigger buttons"],
    deliverables=["n8n running in Docker with all 8 workflows active","Pre-market workflow executes at 8:45 AM via n8n cron","Manual trigger from WorkflowsView calls n8n and returns execution ID","All workflows have retry logic and failure alerting"],
    autopilot=["n8n replaces APScheduler for production reliability — n8n has built-in retry, history, visual debugging","n8n workflow execution IDs correlated with run_ids in FastAPI DB for full auditability","n8n admin dashboard (port 5678) accessible internally for debugging workflow issues"],
    risk=["Risk: Docker unavailable in WSL → fallback plan: keep APScheduler, n8n workflows as reference only","Risk: n8n credentials stored in n8n internal DB → ensure volume is outside container for persistence"],
    code=["# docker-compose.yml excerpt",
          "services:",
          "  n8n:",
          "    image: n8nio/n8n:latest",
          "    ports: ['5678:5678']",
          "    volumes: ['n8n_data:/home/node/.n8n']",
          "    environment:",
          "      N8N_BASIC_AUTH_ACTIVE: 'true'",
          "      WEBHOOK_URL: 'http://api:8000/api/v1/n8n/callback'"],
    days=["Mon: Docker Compose setup; n8n running locally","Tue: Configure credentials; first 3 workflows","Wed: Remaining 5 workflows; retry logic","Thu: FastAPI webhook endpoints; WorkflowsView","Fri: E2E test: n8n triggers pre-market → FastAPI executes → logs result"],
)

WEEKS[31] = dict(
    title="Advanced Market Data: Tick Data & Level 2 Quotes",
    subtitle="Integrate tick-level data and Level 2 quotes for better execution timing and microstructure analysis.",
    kpis=[("Tick Rate","<100ms"),("L2 Depth","5 levels"),("Storage","Compressed"),("Use","Exec timing")],
    goals=["Integrate real-time tick data via Alpaca WebSocket stream","Store compressed tick data for analysis (30-day rolling window, then archive)","Build Level 2 order book display for any symbol in the chart panel","Use bid/ask spread analysis to time option spread execution (execute when spread is tightest)","Build TickAnalyzer: detect unusual volume spikes before news (potential front-running signal)","Spread timing advisor: show optimal execution windows based on historical bid/ask patterns"],
    tasks=["alpaca_ws.py: subscribe to trades and quotes feeds for universe symbols","tick_store.py: compressed HDF5 or parquet tick storage with 30-day TTL","GET /api/v1/market/ticks?symbol=AAPL&lookback=60s","OrderBookTile.tsx: real-time 5-level L2 depth display","TickAnalyzer: volume_spike_detector() — flag when tick volume > 3× 5min MA","Spread timing: identify minutes of day when bid/ask spread is historically narrowest"],
    deliverables=["Alpaca tick stream connected and storing ticks","OrderBookTile renders live L2 depth","Volume spike alerts generated for test event","Spread timing advisor shows best execution windows"],
    autopilot=["Execution engine waits for tight spread window before executing limit orders","Volume spike = potential news alert → autopilot flag for manual review before executing","Tick data used for next week's ML signal generation (foundation laid here)"],
    risk=["Risk: Tick data volume is massive → strict 30-day TTL; use parquet compression (10× compression)","Risk: WebSocket drops → reconnect with exponential backoff; buffer missed ticks with REST catch-up"],
    code=["async def on_tick(symbol, price, size, timestamp):",
          "    tick_store.append(symbol, price, size, timestamp)",
          "    vol_ma = tick_store.volume_ma(symbol, window='5min')",
          "    if size > vol_ma * 3:",
          "        await alert_engine.fire('VOLUME_SPIKE', symbol, {'size': size, 'vs_ma': vol_ma})"],
    days=["Mon: Alpaca WebSocket tick stream","Tue: Parquet tick storage with TTL","Wed: OrderBookTile with L2 depth","Thu: TickAnalyzer volume spike detector","Fri: Spread timing advisor; execution integration"],
)

WEEKS[32] = dict(
    title="ML Feature Engineering & Predictive Signals",
    subtitle="Build ML-ready feature pipeline and train first predictive models using historical trade outcomes.",
    kpis=[("Features","50+"),("Model","XGBoost"),("AUC",">0.65"),("Latency","<100ms")],
    goals=["Engineer 50+ features from price, volume, Greeks, IV, sentiment, calendar","Train XGBoost classifier: P(trade wins) given feature vector","Use SHAP values to explain model predictions and select top features","Integrate ML signal as 8th factor in entry scorer","Walk-forward validation ensures no look-ahead bias in ML training","Model retraining pipeline: weekly retrain on last 90 days of trade outcomes"],
    tasks=["Create services/ml/feature_store.py: build_feature_vector(candidate) → 50+ features","pip install xgboost shap scikit-learn","train_model.py: train XGBoost on historical trade outcomes","compute_shap(): identify top-15 features by importance","Add ml_signal_score to entry_scorer (weight: 12/100 points)","POST /api/v1/ml/retrain → trigger retraining; GET /api/v1/ml/model-info → current model stats","Weekly retrain scheduler job at Sunday midnight"],
    deliverables=["50+ feature vector built for every candidate","XGBoost model trained on historical trades (AUC > 0.65)","SHAP values show top features (expected: IV_rank, DTE, delta, VIX)","ML signal integrated into entry scorer"],
    autopilot=["ML signal is an 8th validation layer — adds information beyond rule-based scoring","SHAP explanations shown in run artifact trace: 'ML rejected this due to high gamma exposure'","Model performance tracked weekly: if AUC drops below 0.60, alert and switch to rule-based only"],
    risk=["Risk: Overfitting on small dataset — use 3-fold time-series CV; regularization alpha=0.5","Risk: ML model too slow → cache model in memory; precompute feature vector during scan phase"],
    code=["def build_feature_vector(c: Candidate) -> dict:",
          "    return {",
          "        'iv_rank': c.iv_rank, 'dte': c.dte, 'delta': c.delta,",
          "        'vix': c.vix_at_entry, 'spread': c.bid_ask_spread,",
          "        'sentiment': c.news_sentiment, 'volume_spike': c.tick_vol_spike,",
          "        'regime': encode(c.market_regime), ... # 50+ total",
          "    }"],
    days=["Mon: Feature store with 50 features","Tue: XGBoost training pipeline","Wed: SHAP values; feature importance analysis","Thu: ML signal integrated into entry scorer","Fri: Weekly retrain job; model info API; AUC tracking"],
)


WEEKS[33] = dict(
    title="Real-Time P&L Dashboard & Risk Metrics Display",
    subtitle="Build a live trader's dashboard: real-time P&L, drawdown meter, win-streak tracker, and daily risk status.",
    kpis=[("P&L Update","5s"),("Risk Gauges","6"),("History","90 days"),("Alert","Threshold-based")],
    goals=["Real-time unrealized P&L for all open positions, updated every 5 seconds","Realized P&L chart: daily bar chart for last 90 days","6 live risk gauges: daily loss vs limit, portfolio delta, vega exposure, drawdown%, win rate, streak","Win/loss streak tracker with longest streak records","Daily VaR (Value at Risk) estimate using historical simulation","Alert when daily loss > 75% of daily limit (early warning)"],
    tasks=["Expand positions WebSocket: push unrealized_pnl every 5s","Build PnlDashboardView.tsx: 90-day P&L bar chart, open positions live table","6 risk gauges using gauge chart (d3 or recharts)","VaR calculation: historical simulation on last 30 days trade returns","Alert on daily loss threshold: 75% warn, 100% block","Streak tracker: compute current streak from DB trade history"],
    deliverables=["Unrealized P&L updates every 5s via WebSocket","90-day P&L chart renders correctly","All 6 risk gauges display live data","Win streak and VaR shown prominently on dashboard"],
    autopilot=["VaR estimate shown as 'Expected worst day' — autopilot uses 95th-pct VaR for budget compliance","Consecutive loss counter → if 3 consecutive losses, autopilot pauses and sends alert for review","Dashboard is command center — shows everything needed to judge autopilot performance at a glance"],
    risk=["Risk: 5s P&L polling expensive with many positions → use DB snapshot; WebSocket pushes delta","Risk: VaR underestimates tail risk → supplement with CVaR (expected shortfall) for better risk view"],
    code=["async def stream_pnl(websocket):",
          "    while True:",
          "        positions = db.get_open_positions()",
          "        quotes = await broker.get_quotes([p.symbol for p in positions])",
          "        pnl = [{**p.dict(), 'unrealized': mark_to_market(p,q)} for p,q in zip(positions,quotes)]",
          "        await websocket.send_json({'type':'PNL_UPDATE','data':pnl})",
          "        await asyncio.sleep(5)"],
    days=["Mon: WebSocket P&L streaming","Tue: 90-day P&L bar chart","Wed: 6 risk gauges","Thu: VaR calculation + daily alert","Fri: Win streak tracker; dashboard layout polish"],
)

WEEKS[34] = dict(
    title="Options Strategy Optimizer & Parameter Tuning",
    subtitle="Auto-optimize strategy parameters (strikes, DTEs, widths) using backtest results as fitness function.",
    kpis=[("Parameters","8 tunable"),("Method","Bayesian BO"),("Frequency","Weekly"),("Improvement",">5% Sharpe")],
    goals=["Build StrategyOptimizer: tune 8 parameters (delta, DTE, width, profit target, stop, etc.)","Use Bayesian optimization (optuna) to find parameters that maximize OOS Sharpe","Run optimizer weekly on Sunday using last 60 days of walk-forward results","Implement parameter bounds: prevent optimizer from reaching unrealistic values","Show optimizer results: current vs recommended parameters with Sharpe delta","Apply new parameters after user approval (one-click in ParameterView)"],
    tasks=["pip install optuna","Create services/backtest/optimizer.py: StrategyOptimizer using Optuna","Define 8 parameter search space: delta (0.1–0.35), DTE (14-45), width (1-5 strikes), etc.","Objective function: run walk-forward with given params, return negative OOS Sharpe","POST /api/v1/optimizer/run → async optimization job (30-min job)","GET /api/v1/optimizer/results → current + recommended params with comparison","ParameterView.tsx: parameter table with recommended changes and approve button"],
    deliverables=["Optuna optimizer runs and finds better parameters than defaults (tested)","Optimizer completes in <30 minutes for 8 parameters, 100 trials","ParameterView shows before/after Sharpe comparison","One-click parameter update applies new values to live config"],
    autopilot=["Optimizer is the autopilot's self-improvement mechanism — gets better weekly","Parameter changes applied with full audit trail: who changed, from what, to what, why (optimizer trial ID)","If optimizer finds no improvement (delta < 1%), keep current parameters and log result"],
    risk=["Risk: Optimizer overfits to recent 60 days → use nested CV with held-out validation window","Risk: Optimizer applies harmful parameters without review → always require manual approval step"],
    code=["def objective(trial):",
          "    params = {",
          "        'delta': trial.suggest_float('delta', 0.10, 0.35),",
          "        'dte': trial.suggest_int('dte', 14, 45),",
          "        'width': trial.suggest_int('width', 1, 5),",
          "    }",
          "    wf = WalkForwardEngine().run(strategy, data, **params)",
          "    return -wf.sharpe  # minimize negative = maximize sharpe"],
    days=["Mon: Optuna integration; parameter space definition","Tue: Walk-forward as objective function","Wed: Optimizer API endpoint (async job)","Thu: ParameterView with comparison chart","Fri: Sunday optimizer scheduler; approval workflow"],
)

WEEKS[35] = dict(
    title="Multi-Account & Paper-to-Live Transition Framework",
    subtitle="Support multiple broker accounts and build a safe, gated process for transitioning from paper to live trading.",
    kpis=[("Accounts","3 supported"),("Gate","10-step checklist"),("Shadow","2 weeks"),("Rollback","1-click")],
    goals=["Support 3 account modes: paper (Alpaca), live (Alpaca), shadow (paper+live parallel)","Build 10-step go-live checklist: backtest passes, MC passes, 2-week paper profit, risk gates set, etc.","Shadow mode: execute on paper AND live simultaneously for 2 weeks for calibration","One-click rollback: instantly switch from live to paper if anomaly detected","Account selection UI: show current mode prominently; require confirmation to switch to live","Go-live readiness score: 0-100% based on checklist completion"],
    tasks=["Refactor broker layer: BrokerConfig(mode='paper'|'live'|'shadow')","Shadow mode executor: sends orders to both accounts, tracks live vs paper P&L divergence","Build go_live_checklist.py: 10 validation checks","GET /api/v1/accounts/readiness → readiness score + checklist status","AccountSwitcherModal.tsx: shows readiness score, checklist, requires 'I UNDERSTAND LIVE RISK' confirmation","Rollback endpoint: POST /api/v1/accounts/rollback → switch to paper immediately"],
    deliverables=["Paper/live/shadow modes switch correctly","Go-live readiness score computed from 10 checklist items","Shadow mode tracks live vs paper divergence","Rollback switches to paper in <5 seconds"],
    autopilot=["Shadow mode is the FINAL test before live — run 2 weeks minimum","Divergence alert: if live P&L diverges >10% from paper, trigger alert and review","Rollback is available 24/7 — even if autopilot is mid-cycle, emergency rollback aborts and switches"],
    risk=["Risk: Accidentally enabling live mode → require 3 confirmations + typed 'LIVE TRADING' phrase","Risk: Shadow mode executes double the trades cost → track paper fills separately; live fills are the alpha"],
    code=["class ShadowExecutor:",
          "    def execute(self, order):",
          "        paper_fill = paper_broker.execute(order)",
          "        live_fill  = live_broker.execute(order)",
          "        divergence = abs(paper_fill.price - live_fill.price) / paper_fill.price",
          "        if divergence > 0.02:",
          "            alert_engine.fire('SHADOW_DIVERGENCE', divergence=divergence)"],
    days=["Mon: Multi-account broker abstraction","Tue: Go-live readiness checklist","Wed: Shadow mode executor","Thu: AccountSwitcherModal with readiness score","Fri: Rollback endpoint; divergence alerting"],
)

WEEKS[36] = dict(
    title="Advanced Charting: Multi-Frame Analysis & Strategy Overlay",
    subtitle="Upgrade the chart panel with multi-timeframe view, strategy overlays, and technical indicator suite.",
    kpis=[("Timeframes","6"),("Indicators","15+"),("Overlays","Active trades"),("Performance","60fps")],
    goals=["6-timeframe chart: 1m, 5m, 15m, 1h, 4h, 1d all available via tab switcher","15+ technical indicators: SMA, EMA, VWAP, Bollinger, RSI, MACD, ATR, IV overlay, etc.","Strategy overlay: show entry/exit points for all closed trades on historical chart","Entry signal overlay: mark where autopilot considered and rejected candidates","Volume profile panel: horizontal volume by price for current session","Chart alerts: user can click on chart to place price alert at that level"],
    tasks=["Extend ChartPanel.tsx: timeframe switcher tabs","Indicator library: implement all 15 as overlays on lightweight-charts","Trade overlay: plot entry/exit arrows on chart for closed positions","Click-to-alert: chart click → opens 'Set Alert at $X' modal","Volume profile: compute volume by price bucket for visible chart range","Performance: ensure 60fps on 6-month daily chart with all indicators enabled"],
    deliverables=["All 6 timeframes switch without page reload","All 15 indicators render correctly","Trade entry/exit arrows visible on chart","Click-to-alert creates price alert from chart"],
    autopilot=["Trade overlays make autopilot decisions transparent — see exactly where it entered/exited","RSI + MACD add a technical filter layer to complement the options Greeks-based scoring","IV overlay on price chart shows IV spikes at key price levels — critical context for options traders"],
    risk=["Risk: 15 indicators slow down chart → compute indicators server-side; send pre-aggregated data","Risk: Clicking chart on mobile is imprecise → increase click target radius for price alerts"],
    code=["const indicators = {",
          "  SMA: (data,n) => sma(data.close, n),",
          "  EMA: (data,n) => ema(data.close, n),",
          "  VWAP: (data) => vwap(data.close, data.volume),",
          "  ATR: (data,n) => atr(data.high, data.low, data.close, n),",
          "  IV: (data) => data.iv  // from options table join",
          "}"],
    days=["Mon: Timeframe switcher + data fetching per timeframe","Tue: 8 indicator implementations","Wed: Remaining 7 indicators; performance optimization","Thu: Trade overlays; entry signal markers","Fri: Click-to-alert; volume profile panel"],
)

WEEKS[37] = dict(
    title="Compliance Logging & Regulatory Audit Trail",
    subtitle="Build a tamper-proof audit trail for all trading decisions, meeting retail broker compliance standards.",
    kpis=[("Immutability","Write-once"),("Coverage","100% trades"),("Export","CSV+PDF"),("Retention","7 years")],
    goals=["Implement immutable audit log: every trade decision, execution, and modification logged permanently","Audit records include: timestamp, decision_type, inputs, outputs, llm_reasoning, validator_results","Generate compliance report: exportable CSV and PDF for any date range","Implement 7-year retention policy: archive to cold storage after 1 year","Tamper detection: SHA-256 hash chain on audit records — any modification is detectable","Hide/anonymize sensitive data in exports (mask API keys, broker account numbers)"],
    tasks=["Create compliance_audit_log table: append-only with SHA-256 hash chain","AuditLogger.log(event_type, payload) → hashes with previous record's hash","GET /api/v1/compliance/audit?start=&end= → paginated audit records","POST /api/v1/compliance/export?format=csv|pdf → download compliance report","Implement archive_old_records(): move records >1yr to audit_archive table","Hash chain verifier: verify_chain() → confirms no tampering"],
    deliverables=["Audit log populated for every trade cycle (tested with 5 cycles)","Hash chain verifier detects tampered record (test case)","CSV export generates correct compliance report","Archive job moves records older than 1 year"],
    autopilot=["Compliance log is the ultimate safety net — proves autopilot followed all rules","Every LLM decision logged with full reasoning → no black-box trades","Regulators (or user's accountant) can reconstruct any trade decision from audit trail alone"],
    risk=["Risk: Audit log grows very large → partition by year; compress archived partitions with zstd","Risk: Hash chain too slow for high-frequency logging → compute hash async; batch every 100 records"],
    code=["def log_audit_event(event_type, payload, prev_hash):",
          "    record = AuditRecord(event_type=event_type, payload=json.dumps(payload),",
          "                         timestamp=utcnow())",
          "    record.hash = sha256(f'{prev_hash}{record.timestamp}{record.payload}').hexdigest()",
          "    db.add(record)",
          "    return record.hash"],
    days=["Mon: Audit log table with hash chain","Tue: AuditLogger with all event types","Wed: Compliance report export (CSV + PDF)","Thu: Hash chain verifier; tamper test","Fri: Archive job; retention policy implementation"],
)

WEEKS[38] = dict(
    title="Q3 Integration: Live Paper Trading Month",
    subtitle="First full month of live paper trading: monitor, learn, and iterate on autopilot performance daily.",
    kpis=[("Cycles","22 trading days"),("Win Rate","Target >60%"),("Avg P&L",">$0 net"),("Incidents","<3")],
    goals=["Run autopilot in paper mode for 22 trading days straight without manual intervention","Track every cycle: run_id, candidates_considered, candidates_selected, orders_placed, orders_filled","Daily review: compare actual vs expected outcomes; identify pattern discrepancies","Build LearningLog: capture surprises (trade that should have won but lost, etc.)","Adjust config parameters if win rate < 55% after 10 cycles","Reach 100 total paper trades milestone with full attribution analysis"],
    tasks=["Enable APScheduler full-day operation for 4 weeks","Morning review ritual: check dashboard before market open, review overnight EOD report","LearningLog.md: daily journal of observations, surprises, and adaptations","Incident log: record any cycle failure, broker error, or unexpected behavior","After 10 cycles: run optimizer on data so far; update parameters if needed","After 22 cycles: comprehensive performance attribution by strategy, symbol, day-of-week"],
    deliverables=["22 cycles run without critical failure","100+ paper trades executed","Win rate, P&L, Sharpe computed for the month","LearningLog.md with daily observations","Performance attribution report"],
    autopilot=["This week IS the autopilot — observing its behavior is the primary deliverable","LLM agreement rate for the month: track what % of cycles both LLMs agreed","Best and worst trades analyzed with full run artifact replay"],
    risk=["Risk: Autopilot makes many poor trades → immediately run optimizer; reduce position size","Risk: Broker API changes break execution → ensure broker abstraction catches and alerts on API errors"],
    code=["# monitoring query",
          "SELECT run_date, candidates_considered, orders_placed,",
          "       SUM(pnl) OVER (ORDER BY run_date) as cumulative_pnl",
          "FROM autopilot_runs JOIN trades USING(run_id)",
          "ORDER BY run_date DESC LIMIT 22"],
    days=["Mon (rolling): Pre-market review; post-market analysis; update LearningLog","Tue: Focus on win rate vs expected","Wed: Mid-week parameter check","Thu: Strategy performance breakdown","Fri: Weekly summary; optimization if needed"],
)

WEEKS[39] = dict(
    title="Sentiment Analysis 2.0: Social + Institutional Flow",
    subtitle="Upgrade sentiment to include Reddit/Twitter social sentiment and options flow (unusual activity) signals.",
    kpis=[("Sources","5 sentiment"),("Dark Pool","Yes"),("Social","Reddit+X"),("Signal","0-100 composite")],
    goals=["Integrate Reddit WSB sentiment: use PRAW to fetch mentions + upvote velocity","Integrate Twitter/X sentiment via API Basic tier (or nitter scraping as fallback)","Options flow: integrate Unusual Whales or Tradier unusual activity endpoint","Dark pool print detector: large block trades as institutional signal","Composite sentiment score: 5-source weighted average (news 40%, social 20%, flow 30%, dark pool 10%)","Unusual activity alerts: when options flow is unusually bullish/bearish vs historical"],
    tasks=["pip install praw","reddit_sentiment.py: fetch WSB mentions, run FinBERT, compute symbol sentiment","twitter_sentiment.py: search symbol mentions, FinBERT scoring","options_flow.py: Unusual Whales API or Tradier screener for unusual activity","darkpool.py: detect large block prints from tick data","Composite scorer: weighted combination of all 5 sources","GET /api/v1/sentiment/{symbol} → full sentiment breakdown by source"],
    deliverables=["Reddit sentiment computed for top 20 universe symbols","Options flow unusual activity flag working (test case)","Composite sentiment score integrates all 5 sources","Unusual activity alert fires when flow strongly bullish (test)"],
    autopilot=["Social sentiment adds contrarian signal: extreme WSB bullishness = be cautious (fade retail)","Unusual options flow: strongly bullish flow + autopilot's bearish setup = SKIP trade","Institutional dark pool prints: large buy prints before earnings = avoid short premium near expiry"],
    risk=["Risk: Reddit API rate limits → use PRAW with OAuth; cache for 15 minutes per symbol","Risk: Social sentiment noisy → use only at high-conviction threshold (>80/100 score); low weight"],
    code=["async def composite_sentiment(symbol):",
          "    news = await news_sentiment(symbol)    # 40%",
          "    social = await social_sentiment(symbol) # 20%",
          "    flow = await options_flow(symbol)       # 30%",
          "    dark = await darkpool_signal(symbol)    # 10%",
          "    return 0.4*news + 0.2*social + 0.3*flow + 0.1*dark"],
    days=["Mon: Reddit PRAW sentiment integration","Tue: Options flow unusual activity","Wed: Dark pool print detector","Thu: Composite scorer + flow alert","Fri: Sentiment dashboard UI; API endpoint"],
)


# ── Weeks 40-52 (Q3 tail + Q4) ──
WEEKS[40] = dict(
    title="Portfolio Heat Map & Sector Dashboard",
    subtitle="Build visual portfolio heat map and sector breakdown for instant risk visualization.",
    kpis=[("Tiles","All positions"),("Color","P&L-based"),("Sector","GICS 11"),("Refresh","30s")],
    goals=["Portfolio heat map: tiles sized by notional value, colored by unrealized P&L","Sector donut chart: % of portfolio in each GICS sector, updated with each position change","Position summary table: sortable by P&L, DTE, strategy type, sector","Quick filters: show only options, only stock, only positive P&L","Export: positions table downloadable as CSV for tax/reporting","Watchlist integration: see symbols you're watching but not yet in"],
    tasks=["HeatMapTile.tsx: responsive grid with variable-size tiles","Color gradient: red (loss >10%) → white (flat) → green (profit >10%)","SectorDonut.tsx: recharts pie chart with GICS colors","PositionsTable.tsx: sortable columns, filter dropdown","GET /api/v1/positions/export?format=csv","WatchlistPanel.tsx: manage 20-symbol watchlist with alerts"],
    deliverables=["Heat map renders all positions with correct sizing + coloring","Sector donut updates after each trade","Position table filterable and sortable","CSV export downloads correctly"],
    autopilot=["Heat map at a glance: autopilot portfolio health visible in 2 seconds","Red tiles = positions autopilot should consider closing → used in exit prioritization","Sector donut auto-balances autopilot's new trade selection toward under-represented sectors"],
    risk=["Risk: Heat map slow with many positions → use CSS grid GPU-accelerated layout; avoid DOM re-renders"],
    code=["const HeatMapTile = ({pos}) => (",
          "  <div style={{",
          "    width: pos.notional/1000+'px',",
          "    background: pnlToColor(pos.unrealizedPnl)",
          "  }}>",
          "    {pos.symbol}<br/>{pos.unrealizedPnl.toFixed(0)}",
          "  </div>",
          ")"],
    days=["Mon: HeatMapTile component","Tue: SectorDonut chart","Wed: PositionsTable with filters","Thu: CSV export; watchlist panel","Fri: Integration; 30s refresh via WebSocket"],
)

WEEKS[41] = dict(
    title="Advanced Risk Metrics: VaR, CVaR & Stress Testing Dashboard",
    subtitle="Implement institution-grade risk metrics available in a dedicated Risk Control Room view.",
    kpis=[("VaR","99% 1-day"),("CVaR","Yes"),("Stress Tests","7"),("Dashboard","Full view")],
    goals=["Daily VaR at 99% confidence using historical simulation on 252 days","CVaR (Conditional Value at Risk) = average loss in the worst 1% of days","Stress test portfolio against 7 scenarios: 2008 GFC, 2020 COVID, 2022 Rate Hike, etc.","Dollar-amount display: 'Worst expected day: -$2,340' is more intuitive than percentages","RiskControlRoom.tsx: full-page risk dashboard with all metrics","Build risk score (0-100): aggregate measure of current portfolio risk level"],
    tasks=["Extend monte_carlo.py: historical_var(), cvar(), stress_tests()","Stress test: modify returns distribution to match each historical crisis period","GET /api/v1/risk/dashboard → VaR, CVaR, stress results, risk score","RiskControlRoom.tsx: VaR gauge, CVaR card, 7 stress panels, risk score ring","Risk score formula: weighted combo of VaR%, max_drawdown%, greek_exposure, concentration","Route /risk in React Router; add to nav sidebar"],
    deliverables=["VaR and CVaR computed correctly (verified on sample portfolio)","All 7 stress scenarios produce results","Risk score aligns with intuitive portfolio riskiness","RiskControlRoom view accessible from nav"],
    autopilot=["Risk score gate: if risk score > 75, autopilot reduces position size to 50%","Stress test worst-case shown in pre-market briefing: 'If 2020-COVID repeat: -$5,400'","CVaR is more conservative than VaR — used for position sizing decisions"],
    risk=["Risk: Stress test assumes stationary returns → add regime-specific stress overlay for accuracy","Risk: Risk score weighting arbitrary → document formula; allow config adjustment"],
    code=["def historical_var(returns, confidence=0.99):",
          "    sorted_r = np.sort(returns)",
          "    cutoff_idx = int((1-confidence)*len(sorted_r))",
          "    var = abs(sorted_r[cutoff_idx])",
          "    cvar = abs(sorted_r[:cutoff_idx].mean())",
          "    return var, cvar"],
    days=["Mon: VaR + CVaR computation","Tue: 7 stress scenarios","Wed: Risk score formula","Thu: RiskControlRoom.tsx","Fri: VaR gate in autopilot position sizing"],
)

WEEKS[42] = dict(
    title="SEC Filing & Earnings Call Transcript Analysis",
    subtitle="Analyze 10-K, 10-Q filings and earnings call transcripts with LLM for fundamental risk signals.",
    kpis=[("Coverage","S&P 500 10-Qs"),("Analysis","LLM-based"),("Latency","<30s"),("Signals","Qualitative risk flags")],
    goals=["Fetch latest 10-Q and earnings call transcripts via SEC EDGAR API","Use Gemini (large context) to analyze filing for risk flags: liquidity, guidance cuts, lawsuits","Compute fundamental_risk_score per symbol: 0-100 (100=high risk)","High fundamental risk → reduce position size or skip entry","Cache filing analysis for 90 days (filings don't change)","Show filing analysis summary in SymbolDetail panel"],
    tasks=["sec_edgar.py: fetch latest 10-Q text for any symbol via EDGAR full-text search","transcript_fetcher.py: earnings call transcript via Seeking Alpha scraper or Motley Fool RSS","gemini_analyst.py: 5-factor filing analysis prompt (liquidity, guidance, legal, management, competitive)","fundamental_risk_score: weighted average of 5 factors","Cache analysis in fundamentals table with 90-day TTL","SymbolDetailPanel.tsx: show filing analysis with risk flags"],
    deliverables=["10-Q filing fetched for AAPL and MSFT","Gemini analysis returns risk flags correctly","Fundamental risk score integrated into entry scoring","Filing summary visible in symbol detail panel"],
    autopilot=["High-fundamental-risk symbols (score >70) get position size reduced by 50%","Filing analysis runs quarterly — autopilot knows when each company last filed","LLM analysis of filings: one of the most sophisticated features of the system"],
    risk=["Risk: Gemini context limit for long filings → chunk filing into sections; summarize each section first","Risk: EDGAR API throttling → cache aggressively; respect rate limits with 0.5s delays"],
    code=["FILING_PROMPT = '''",
          "Analyze this 10-Q filing excerpt for risk signals. Score each:",
          "1. Liquidity risk (0-100,higher=more risky)",
          "2. Guidance risk (did they cut guidance?)",
          "3. Legal/regulatory risk",
          "4. Management confidence",
          "5. Competitive moat changes",
          "Return JSON: {scores:{}, flags:[], summary:str}",
          "'''"],
    days=["Mon: SEC EDGAR filing fetcher","Tue: Earnings transcript fetcher","Wed: Gemini 5-factor analysis prompt","Thu: Fundamental risk score + cache","Fri: SymbolDetailPanel integration; entry scoring weight"],
)

WEEKS[43] = dict(
    title="Options Term Structure & Roll Strategy Engine",
    subtitle="Build automated roll detection and execution: roll losing positions to next month before expiry.",
    kpis=[("Roll Trigger","DTE<7"),("Rollover","Automated"),("Cost","<$50 per roll"),("Coverage","All strategies")],
    goals=["Term structure analysis: compare IV across expiry months to find optimal roll target","Roll trigger: when position DTE < 7, evaluate rolling vs closing","Automated roll: close current position, open new position 30 DTE in next month","Roll cost analysis: net debit/credit of rolling must be favorable","Roll simulation: backtest roll strategy vs close-and-reopen on historical data","RollView: upcoming rolls, roll candidates, roll history"],
    tasks=["term_structure.py: build IV term structure curve from chain across expirations","roll_detector.py: scan positions for DTE<7; evaluate roll attractiveness","RollEvaluator: compute roll P&L impact; recommend roll vs close","Automated roll executor: close → reopen in next expiry as atomic pair","Backtest roll strategy: compare rolling vs closing on last 2 years data","GET /api/v1/rolls/candidates → positions approaching roll threshold"],
    deliverables=["Roll trigger fires correctly when position DTE < 7","Automated roll executes close + reopen atomically","Term structure chart shows IV curve across expirations","Roll history tracked in DB with cost per roll"],
    autopilot=["Rolling extends position life and reduces realized losses — key to long-term profitability","Roll calendar: autopilot plans rolls 5 days in advance — not a surprise","Roll costing: only roll if net credit or small debit (<$20); otherwise close and redeploy"],
    risk=["Risk: Roll target month has bad IV → skip roll, close position instead","Risk: Execution slip during roll (close fills, open fails) → treat as partial roll; monitor open leg"],
    code=["def evaluate_roll(pos, chain):",
          "    current_credit = pos.entry_credit",
          "    roll_target = find_30dte(chain, pos.strategy_type)",
          "    roll_credit = roll_target.credit",
          "    net = roll_credit - pos.buyback_cost",
          "    return RollDecision(should_roll=net > -20, net_credit=net)"],
    days=["Mon: Term structure analysis + IV curve","Tue: Roll detector and evaluator","Wed: Automated roll executor (atomic)","Thu: Roll backtest comparison","Fri: RollView UI; roll scheduler job"],
)

WEEKS[44] = dict(
    title="System Monitoring & Observability Stack",
    subtitle="Add production-grade monitoring: Prometheus metrics, Grafana dashboard, health probes, and PagerDuty alerts.",
    kpis=[("Metrics","50+ exposed"),("Dashboards","3 Grafana"),("Uptime","99.9%"),("Alert","PagerDuty")],
    goals=["Expose 50+ Prometheus metrics: cycle duration, order fill rate, API latency, error rate, memory/CPU","Grafana dashboards: System Health, Autopilot Performance, Trading P&L","Health probe: /health endpoint returns comprehensive status for all dependencies","PagerDuty integration: on-call alert for CRITICAL incidents (system down, kill switch activated)","Log aggregation: structured JSON logs → file rotation → optional ELK stack","SLA targets: API P99 < 200ms, cycle duration < 90s, uptime > 99.9%"],
    tasks=["pip install prometheus-client","Add prometheus_client metrics to all service layers","prometheus_metrics.py: Histogram for latencies, Counter for orders, Gauge for positions/pnl","FastAPI middleware: auto-instrument all endpoints","/metrics endpoint: returns Prometheus scrape format","docker-compose: add prometheus + grafana services","3 Grafana dashboard JSON files: system, autopilot, trading"],
    deliverables=["50+ metrics exposed at /metrics","Grafana shows real-time system health","PagerDuty fires on CRITICAL alert (test case)","Structured JSON logs in all service modules"],
    autopilot=["cycle_duration_seconds histogram → P99 visible in Grafana → catch slow cycles early","orders_placed_total counter → tracks autopilot activity over time","Grafana alert: if cycle_success_rate < 0.8 over 1 hour → PagerDuty page"],
    risk=["Risk: Prometheus/Grafana adds complexity → use single docker-compose service; document setup","Risk: PagerDuty billing → use free tier; limit to <5 alerts/month threshold"],
    code=["from prometheus_client import Histogram, Counter",
          "CYCLE_DURATION = Histogram('cycle_duration_seconds', 'Time to complete full cycle')",
          "ORDERS_PLACED  = Counter('orders_placed_total', 'Orders placed', ['strategy', 'mode'])",
          "",
          "@CYCLE_DURATION.time()",
          "async def run_cycle(): ..."],
    days=["Mon: Prometheus client + 30 core metrics","Tue: Remaining 20 metrics; /metrics endpoint","Wed: Docker Compose prometheus+grafana","Thu: 3 Grafana dashboards","Fri: PagerDuty integration; structured logging"],
)

WEEKS[45] = dict(
    title="Multi-Strategy Portfolio: All 6 Strategy Types Live",
    subtitle="Enable all 6 strategy types in production with intelligent allocation weighting by regime.",
    kpis=[("Strategies","6 types"),("Allocation","Regime-based"),("Max/Type","30%"),("Concurrency","6 parallel scans")],
    goals=["Enable all 6 strategies: PutCreditSpread, CallCreditSpread, IronCondor, IronButterfly, CalendarSpread, DiagonalSpread","Regime-based allocation: allocate portfolio $ to each strategy based on current regime","Run 6 parallel scans: each strategy type scanned concurrently using asyncio","Strategy performance tracking: individual P&L, win rate, Sharpe per strategy","Auto-deactivate strategy if: OOS backtest Sharpe < 0.5 for 30 days running","Portfolio max-per-strategy cap: 30% notional in any single strategy type"],
    tasks=["Implement CalendarSpread and DiagonalSpread option chain builders + Greeks","6-parallel scan: asyncio.gather(*[scan(s,data) for s in strategies])","AllocationManager: compute $ allocation per strategy from regime config","Strategy health monitor: daily check of per-strategy rolling Sharpe","Auto-deactivate: if strategy_health < threshold, set status=PAUSED in config","StrategyAllocationView.tsx: donut chart + allocation table"],
    deliverables=["All 6 strategies execute correctly in paper mode","Regime-based allocation shifts correctly (test: Bull → 0% IronCondor, 40% PutCredit)","Parallel scan completes 6 strategies in < time of sequential scan","Strategy auto-deactivation works (test: force low Sharpe strategy)"],
    autopilot=["6 strategies = 6 alpha streams — diversified autopilot income sources","Regime detection now controls ALL allocation, not just strategy preference","Auto-deactivation: autopilot effectively fires underperforming strategies on its own"],
    risk=["Risk: Iron Butterfly hard to fill at mid → require tighter spread rules; use limit orders only","Risk: Calendar and diagonal need multiple expirations → validate both legs before submission"],
    code=["async def scan_all_strategies(data):",
          "    tasks = [scan_strategy(s, data) for s in ACTIVE_STRATEGIES]",
          "    results = await asyncio.gather(*tasks, return_exceptions=True)",
          "    return [r for r in results if not isinstance(r, Exception)]"],
    days=["Mon: Implement Calendar + Diagonal strategy builders","Tue: Parallel scan with asyncio.gather","Wed: AllocationManager + regime weights","Thu: Strategy health monitor + auto-deactivation","Fri: StrategyAllocationView; E2E 6-strategy test"],
)

WEEKS[46] = dict(
    title="AI-Powered Market Briefing & Natural Language Reports",
    subtitle="Generate natural language pre-market and EOD briefings using LLM, replacing raw data tables with narrative.",
    kpis=[("Briefing","2 daily"),("Sources","7 data feeds"),("Format","NL + structured"),("Delivery","Push+App")],
    goals=["Pre-market briefing (8:30 AM): NL summary of overnight news, economic events, vol regime, day's setup","EOD briefing (4:05 PM): narrative of what happened, what the autopilot did, P&L for the day","Use Gemini for briefing generation: structured prompt with all 7 data sources","Briefing style: Bloomberg-style concise prose, not bullet points","Push to Slack, email, and show in BriefingView in dashboard","Store briefings in DB; searchable by date"],
    tasks=["briefing_generator.py: pre_market_briefing() and eod_briefing() functions","7 data sources: VIX, SPY regime, earnings calendar, economic calendar, positions, P&L, sentiment","Gemini prompt: role='financial analyst'; structured data injection; output NL paragraph","BriefingView.tsx: styled text view with date navigator","Scheduler: pre-market job at 8:30 AM, EOD at 4:05 PM","slack_post_briefing(): format and post to Slack channel"],
    deliverables=["Pre-market briefing generated correctly for test date","EOD briefing references actual day's trades","BriefingView renders formatted briefing","Slack delivery confirmed working"],
    autopilot=["Briefings make autopilot's decisions legible to non-technical users: 'Today I placed 2 put credit spreads on AAPL due to high IV rank and bullish regime'","Pre-market briefing shows confidence level for the coming day's session","EOD briefing includes 'Today's lesson' section: what worked, what didn't"],
    risk=["Risk: Gemini API unavailable at 8:30 AM → fallback to template-based structured briefing","Risk: Briefing contains false information from LLM → add disclaimer; user should verify key facts"],
    code=["PRE_MARKET_PROMPT = f'''",
          "You are a professional options trader AI. Generate a concise pre-market briefing.",
          "Data: VIX={vix}, Regime={regime}, Upcoming earnings: {earnings},",
          "Open positions: {positions_summary}, Overnight sentiment: {sentiment_score}",
          "Write 3 paragraphs: 1) Market context, 2) Today's setup, 3) Risk factors.",
          "'''"],
    days=["Mon: briefing_generator.py with 7 data sources","Tue: Gemini prompt engineering for NL quality","Wed: BriefingView.tsx","Thu: Slack + email delivery","Fri: Scheduler jobs; briefing DB storage"],
)

WEEKS[47] = dict(
    title="API Rate Limiting, Caching & CDN Architecture",
    subtitle="Harden the production API with multi-tier caching, rate limiting, and CDN delivery for the frontend.",
    kpis=[("Cache Hit Rate",">70%"),("Rate Limit","100 req/min"),("CDN","Frontend"),("TTL","Strategy-based")],
    goals=["Multi-tier caching: in-memory (1s) → Redis (60s) → DB (permanent)","Tiered TTL strategy: stock quote 5s, option chain 30s, fundamentals 24h, reports 7d","API rate limiting: 100 req/min per client; 429 response with Retry-After header","CDN deployment: serve React build via Cloudflare Pages or Vercel","Cache invalidation: WebSocket events invalidate relevant cache keys","Cache hit rate monitoring: expose cache stats at /metrics"],
    tasks=["pip install redis","redis_cache.py: get(), set(), invalidate() with TTL param","Decorate all market data endpoints with @cache(ttl=30)","FastAPI middleware: rate limiter using redis sliding window","Modify Vite build: CNAME + deploy script to Cloudflare Pages","Cache stats: expose cache_hit_total and cache_miss_total Prometheus metrics"],
    deliverables=["Redis cache reduces redundant Tradier API calls by >70%","Rate limiter returns 429 after 100 requests/min (tested)","Frontend served from CDN with <100ms global TTFB","Cache hit rate visible in Grafana"],
    autopilot=["Caching makes the scan phase faster: option chains cached 30s, reducing Tradier calls","Cache invalidation on position update: ensure positions view always fresh","In paper mode: simulate redis with in-memory dict if Redis unavailable"],
    risk=["Risk: Redis unavailable → fallback to in-memory cache; warn in logs","Risk: Stale cache causes bad decisions → for real-time data (quotes), keep TTL very short (5s max)"],
    code=["@cache(ttl=30)",
          "async def get_option_chain(symbol: str):",
          "    return await tradier.get_chain(symbol)  # only called on cache miss",
          "",
          "# cache decorator",
          "def cache(ttl):",
          "    def decorator(fn):",
          "        async def wrapper(*args):",
          "            key = f'{fn.__name__}:{args}'",
          "            hit = await redis.get(key)",
          "            if hit: return json.loads(hit)",
          "            result = await fn(*args)",
          "            await redis.setex(key, ttl, json.dumps(result))",
          "            return result"],
    days=["Mon: Redis client integration; basic get/set","Tue: Cache decorator + TTL strategy","Wed: Rate limiter middleware","Thu: Frontend CDN deployment","Fri: Cache stats in Prometheus; Grafana panel"],
)

WEEKS[48] = dict(
    title="Automated Strategy Research & Alpha Discovery",
    subtitle="Build a research mode where the system autonomously discovers and tests new strategy variants.",
    kpis=[("Variants","50/week"),("Auto-test","Walk-forward"),("Promote","If Sharpe>1.5"),("Report","Weekly digest")],
    goals=["Research mode: generate 50 strategy variants by perturbing parameters","Auto-test each variant with accelerated walk-forward backtest","Rank variants by OOS Sharpe; promote top-3 to staging for paper testing","Research report: weekly email digest of new strategy discoveries","Parameter mutation engine: systematic exploration of parameter space","Human review gate: all promoted strategies require user approval before paper testing"],
    tasks=["research_mode.py: variant_generator() — produces 50 param combos per base strategy","Accelerated walk-forward: 5-year OOS on 6 months training (faster than full WF)","StrategyRegistry: promoted strategies tracked with status (research/staging/production)","Research report generator: summarize top-5 variants with backtest stats","POST /api/v1/research/run → trigger research cycle","ResearchView.tsx: variant ranking table; promote/dismiss buttons"],
    deliverables=["50 variants generated and tested in <2 hours (Sunday night job)","Top-3 variants correctly identified and staged for paper testing","Research report email sent with top-5 discoveries","ResearchView shows all variant results"],
    autopilot=["Research mode is the autopilot evolving itself — systematic alpha hunting","Each promoted variant runs in shadow mode (paper only) for 4 weeks before production consideration","Strategy mutation: not random — systematic grid around best current parameters"],
    risk=["Risk: Promote a variant based on lucky backtest period → require 3-year OOS minimum","Risk: Research report over-hypes findings → show confidence intervals; always caveat OOS"],
    code=["def generate_variants(base_params, n=50):",
          "    variants = []",
          "    for _ in range(n):",
          "        variant = {k: v * (1 + random.uniform(-0.2, 0.2))",
          "                   for k,v in base_params.items()}",
          "        variant = clip_to_bounds(variant)",
          "        variants.append(variant)",
          "    return variants"],
    days=["Mon: Variant generator engine","Tue: Accelerated walk-forward for rapid testing","Wed: StrategyRegistry + promotion logic","Thu: ResearchView + research report email","Fri: Research scheduler (Sunday night); E2E test"],
)

WEEKS[49] = dict(
    title="Position Sizing Engine: Kelly Criterion & Volatility Scaling",
    subtitle="Implement advanced position sizing: fractional Kelly, volatility targeting, and dynamic sizing by regime.",
    kpis=[("Method","Fractional Kelly"),("Vol Target","12% annual"),("Dynamic","Per-regime"),("Risk-Adj","Per trade")],
    goals=["Replace fixed position sizing with Kelly Criterion-based dynamic sizing","Fractional Kelly (0.25×) to reduce variance while capturing edge","Volatility targeting: scale position size up/down to maintain 12% annual portfolio vol","Regime-based sizing: larger positions in high-confidence regimes (Neutral, low VIX)","Per-trade risk budget: no single trade risks more than 2% of portfolio","Show sizing recommendation in trade approval flow: 'Recommended: 2 contracts'"],
    tasks=["kelly_calculator.py: fractional_kelly(win_rate, avg_win, avg_loss) → position_size_fraction","vol_scaler.py: compute current portfolio vol; scale new positions to maintain target","regime_sizer.py: multiply Kelly by regime confidence (0.7× Bear, 1.0× Neutral, 0.5× HighVol)","Integrate into cycle: position_qty = min(kelly_qty, max_risk_qty, max_notional_qty)","Show sizing breakdown in RunArtifact: Kelly=X, VolAdj=Y, RegimeAdj=Z, Final=N","Test: verify sizing reduces during high vol periods"],
    deliverables=["Kelly calculator produces correct quantities for test cases","Vol-targeting adjusts sizing when portfolio vol exceeds 12% (verified)","Regime sizing reduces positions in Bear/HighVol regimes","Sizing breakdown visible in run artifact"],
    autopilot=["Position sizing is one of the most important autopilot improvements — affects long-run P&L","Fractional Kelly (0.25×) protects against estimation error in win rate","Vol targeting makes portfolio drawdowns more predictable — key for sleep-at-night comfort"],
    risk=["Risk: Kelly formula gives huge position with small sample → minimum 30 trades before Kelly is trusted","Risk: Vol spikes intraday → size based on 20-day realized vol, not intraday — more stable"],
    code=["def fractional_kelly(win_rate, avg_win, avg_loss, fraction=0.25):",
          "    edge = win_rate * avg_win - (1-win_rate) * avg_loss",
          "    odds = avg_win / avg_loss",
          "    kelly = edge / odds",
          "    return kelly * fraction  # use 25% Kelly for conservatism"],
    days=["Mon: Kelly calculator; fractional sizing","Tue: Volatility targeting scaler","Wed: Regime-based sizing multiplier","Thu: Integration into cycle execution","Fri: Sizing breakdown in RunArtifact; E2E test"],
)

WEEKS[50] = dict(
    title="Full Security Hardening & Penetration Test",
    subtitle="Conduct full security audit, pen test the API, and harden all attack surfaces for production readiness.",
    kpis=[("OWASP","All 10 checked"),("Findings","0 Critical"),("Auth","JWT+2FA"),("Secrets","Vault-ready")],
    goals=["JWT authentication for all API endpoints (currently open for dev)","2FA option for dashboard login using TOTP (Google Authenticator)","OWASP ZAP full scan: automated pen test of all API endpoints","Secrets management: move API keys from keys.env → HashiCorp Vault or AWS Secrets Manager","SQL injection prevention: verify all ORM queries use parameterized queries","CSP headers: prevent XSS on frontend; CORS tightened to production domain only"],
    tasks=["Implement JWT auth: POST /api/v1/auth/login → token; all routes require Bearer","TOTP 2FA: pyotp library; QR code setup flow in Settings view","OWASP ZAP scan: run in CI; fail pipeline on HIGH severity finding","HashiCorp Vault dev mode setup; migrate API key reads to vault.read()","Audit all SQLAlchemy models: no raw SQL; use ORM queries only","Add security headers middleware: CSP, HSTS, X-Frame-Options, X-Content-Type"],
    deliverables=["JWT auth working for all API endpoints","2FA setup flow working in Settings","Zero HIGH/CRITICAL findings from ZAP scan","Security headers verified via securityheaders.com (grade A)"],
    autopilot=["API auth ensures autopilot API is not publicly accessible — no unauthorized trigger of trades","Vault integration: API keys lifecycle-managed — rotate without code change","Security hardening makes the system deployable to any cloud without exposure risk"],
    risk=["Risk: JWT secret leaked → rotate immediately; invalidate all tokens; re-deploy","Risk: TOTP QR code exposed → HTTPS only for setup; delete QR after first scan"],
    code=["from jose import jwt, JWTError",
          "SECRET = vault.get('JWT_SECRET')",
          "",
          "def create_token(user_id: str) -> str:",
          "    payload = {'sub': user_id, 'exp': utcnow()+timedelta(hours=12)}",
          "    return jwt.encode(payload, SECRET, algorithm='HS256')",
          "",
          "async def require_auth(token: str = Depends(oauth2_scheme)):",
          "    payload = jwt.decode(token, SECRET, algorithms=['HS256'])"],
    days=["Mon: JWT auth for all API routes","Tue: TOTP 2FA setup flow","Wed: OWASP ZAP scan + fix HIGH findings","Thu: HashiCorp Vault integration","Fri: Security headers; CSP; final scan"],
)

WEEKS[51] = dict(
    title="Documentation Suite & Interactive API Reference",
    subtitle="Build comprehensive documentation: user guide, API reference, runbook, and interactive demo.",
    kpis=[("Docs Pages","50+"),("API Ref","Auto-generated"),("Demo","Interactive"),("Coverage","100% features")],
    goals=["User guide: 10 chapters covering every feature with screenshots","API reference: OpenAPI/Swagger auto-generated, hosted at /docs","Developer guide: setup, architecture, contributing, testing","Runbook: step-by-step recovery procedures for every failure mode","Interactive demo: Storybook component library for all React components","README overhaul: badges, architecture diagram, quick start in <5 commands"],
    tasks=["FastAPI already generates OpenAPI; enhance with detailed descriptions and examples","Docusaurus setup in docs/ directory: user guide chapters","Write 10 user guide chapters: Introduction, Dashboard Tour, Autopilot, Positions, Reports, etc.","Storybook: npx storybook init; write stories for all 20 components","Generate architecture diagram as Mermaid diagram in README","Runbook: 15 failure scenarios with exact remediation steps"],
    deliverables=["Docusaurus docs site builds successfully","All 20 components have Storybook stories","README has architecture diagram and quick-start","Runbook covers all 15 failure scenarios"],
    autopilot=["Documentation makes the autopilot auditable — anyone can read exactly how it makes decisions","Interactive demos let new users explore without touching live system","Architecture diagram shows data flow: Market → Scan → LLM → Validate → Execute → Monitor"],
    risk=["Risk: Docs fall out of date quickly → add docs-check CI step; fail if API endpoints undocumented","Risk: Storybook adds build time → build Storybook only in docs CI pipeline, not main CI"],
    code=["# FastAPI OpenAPI enhancement",
          "@app.post('/api/v1/autopilot/cycle',",
          "    summary='Run full autopilot cycle',",
          "    description='Executes a complete scan-LLM-validate-execute cycle. In dry_run mode, no orders are placed.',",
          "    response_model=RunArtifact,",
          "    tags=['Autopilot'])"],
    days=["Mon: Docusaurus setup; first 5 user guide chapters","Tue: Remaining 5 chapters + runbook","Wed: Storybook for all components","Thu: README architecture diagram; quick-start","Fri: API example enhancements; docs CI check"],
)

WEEKS[52] = dict(
    title="Year 1 Wrap-Up: Performance Review & Year 2 Planning",
    subtitle="Comprehensive Year 1 retrospective, performance analysis, and detailed Year 2 planning with new objectives.",
    kpis=[("Paper Trades","500+ target"),("Review","Complete"),("Y2 Plan","Approved"),("Milestone","Year 1 Complete")],
    goals=["Comprehensive Year 1 performance attribution: 52 weeks of development + paper trading results","Calculate all-time paper trading stats: total trades, win rate, Sharpe, max drawdown, best/worst strategy","Architecture review: what worked, what needs redesign in Y2","Technical debt audit: categorize and prioritize all known debt items","Produce Year 2 Roadmap document: key themes, milestones, technology upgrades","Celebrate: tag v2.0-rc, write blog post / Devpost update, share publicly"],
    tasks=["Run comprehensive_year_review.py: query all DB tables for Year 1 stats","Year 1 report PDF: generated by ReportEngine; includes all key charts","Architecture retrospective: identify components that need rewrite (tech debt)","Year 2 Roadmap: AI agent autonomy, real money trading, institutional features, platform expansion","git tag v2.0-rc1 with full release notes","Blog/LinkedIn post: 'What I built in 52 weeks' with key architecture decisions"],
    deliverables=["Year 1 performance report PDF","Architecture retrospective document","Year 2 Roadmap approved","v2.0-rc1 tagged on GitHub","Blog post / public update published"],
    autopilot=["Year 1 autopilot: 26 weeks of operation, 500+ paper trades, dual-LLM, 6 strategies — COMPLETE","Year 2 autopilot theme: move from rule-based to fully adaptive AI agent","Key Year 1 lesson captured: what parameters worked best, what strategies underperformed"],
    risk=["Risk: Year 1 paper results disappointing → use year 2 to reboot with better parameters; don't panic","Risk: Tech debt too high to proceed → allocate first 4 weeks of Y2 to refactoring sprint"],
    code=["SELECT strategy_type,",
          "       COUNT(*) as trades,",
          "       AVG(CASE WHEN pnl>0 THEN 1.0 ELSE 0 END) as win_rate,",
          "       SUM(pnl) as total_pnl",
          "FROM trades WHERE created_at >= date('now','-52 weeks')",
          "GROUP BY strategy_type ORDER BY total_pnl DESC"],
    days=["Mon: Run Year 1 performance analysis scripts","Tue: Write Year 1 report PDF; architecture retrospective","Wed: Year 2 Roadmap document","Thu: Tag v2.0-rc1; write release notes","Fri: Blog post; share publicly; plan Week 53"],
)



# ══ Year 2 Weeks 53-104 ══
# ── Y2 Q1: AI Agent Evolution & Advanced Intelligence ──

WEEKS[53] = dict(
    title="Autonomous AI Agent Architecture (LangChain)",
    subtitle="Refactor autopilot into a true LangChain agent with tool-use, memory, and dynamic planning.",
    kpis=[("Framework","LangChain"),("Tools","12"),("Memory","Window Buffer"),("Fallback","Deterministic")],
    goals=["Replace hardcoded pipeline with LangChain AgentExecutor and 12 callable tools",
           "Agent memory: ConversationBufferWindowMemory (20-message window)",
           "Dynamic planning: agent decides tool call order based on market context",
           "Log every tool call with agent's rationale in run_artifact.agent_trace",
           "Fallback: if agent hangs >120s, revert to deterministic pipeline",
           "Agent dry-run mode: complete full cycle without order execution"],
    tasks=["pip install langchain langchain-groq langchain-google-genai",
           "services/autopilot/agent.py: ApexAgent class with 12 tool wrappers",
           "Tool descriptions explicitly require: validate before execute",
           "AgentExecutor with verbose=True; max_iterations=25",
           "Store agent_trace JSON field in RunArtifact",
           "Fallback handler: asyncio timeout 120s → deterministic pipeline"],
    deliverables=["LangChain agent completes full dry_run cycle","Agent uses >8 tools per cycle",
                  "Fallback activates on timeout","Agent trace shows reasoning per tool"],
    autopilot=["Agent IS the autopilot — it decides its own workflow now",
               "Dynamic strategy: high-VIX day → agent may check risk first before scanning",
               "Agent memory: remembers morning briefing when making afternoon decisions"],
    risk=["Risk: Agent loops → strict max_iterations=25; hard timeout 120s",
          "Risk: Agent execute without validate → tool descriptions require validate first"],
    code=["tools = [Tool('scan_universe', scan_universe, 'Scan for candidates. Input: date.'),",
          "         Tool('validate_trade', validate_trade, 'Validate against risk gates. Must call before execute.'),",
          "         Tool('execute_order', execute_order, 'Execute validated trade only.')]",
          "agent = create_react_agent(llm=groq, tools=tools, prompt=AGENT_PROMPT)",
          "executor = AgentExecutor(agent=agent, max_iterations=25)"],
    days=["Mon: LangChain setup; 12 tool wrappers","Tue: AgentExecutor + verbose trace",
          "Wed: Memory integration","Thu: Agent trace in RunArtifact","Fri: Fallback handler; E2E dry-run"],
)

WEEKS[54] = dict(
    title="Multi-Agent System: Researcher + Validator + Executor",
    subtitle="Split single agent into specialized sub-agents that debate every trade before execution.",
    kpis=[("Sub-agents","3"),("Protocol","Debate"),("Supervisor","LangGraph"),("Transcript","Saved")],
    goals=["ResearcherAgent: scans universe, builds candidate list with context",
           "ValidatorAgent: adversarial — challenges each trade; seeks to reject",
           "ExecutorAgent: final decision after hearing both sides",
           "SupervisorAgent: routes messages via LangGraph StateGraph",
           "Full debate transcript saved in run_artifact.debate_transcript",
           "Debate completes in <60s total"],
    tasks=["agent_researcher.py, agent_validator.py, agent_executor.py — separate system prompts + tools",
           "StateGraph: researcher→validator→executor routing",
           "Validator prompt: 'Find every reason NOT to take this trade'",
           "Executor reads debate transcript + weighs both perspectives",
           "debate_transcript stored as JSON in RunArtifact"],
    deliverables=["3-agent pipeline completes full dry-run","Validator argues against ≥1 candidate",
                  "Executor sometimes overrules with reasoning","Debate transcript saved"],
    autopilot=["Multi-agent = adversarial self-review = fewer bad trades",
               "Validator effectively acts as the system's risk manager"],
    risk=["Risk: Slower than single agent → parallelize Researcher + Validator",
          "Risk: Agents disagree on everything → tune Validator to focus on material risks only"],
    code=["graph = StateGraph(AgentState)",
          "graph.add_edge('researcher', 'validator')",
          "graph.add_conditional_edges('validator', route_to_executor)"],
    days=["Mon: ResearcherAgent","Tue: ValidatorAgent adversarial prompt","Wed: ExecutorAgent",
          "Thu: LangGraph supervisor routing","Fri: Debate transcript in RunArtifact; E2E"],
)

WEEKS[55] = dict(
    title="RAG-Powered Market Knowledge Base (ChromaDB)",
    subtitle="Build a vector knowledge base from 500+ financial documents for LLM context retrieval.",
    kpis=[("Documents","500+"),("Vector DB","ChromaDB"),("Retrieval","Top-5 chunks"),("Latency","<500ms")],
    goals=["Ingest 500+ docs: 10-K/10-Q, earnings transcripts, Fed minutes, research reports",
           "Chunk and embed via sentence-transformers → store in ChromaDB",
           "RAG query: ResearcherAgent queries KB before scoring each symbol",
           "Hybrid retrieval: semantic similarity + keyword match",
           "Weekly KB refresh: new filings + transcripts added automatically",
           "RAG context visible in agent reasoning trace"],
    tasks=["pip install chromadb langchain-community sentence-transformers",
           "doc_ingestion.py: fetch → chunk (512 tokens, 50 overlap) → embed → store",
           "KnowledgeBase.query(question, top_k=5) returns relevant chunks",
           "Wire into ResearcherAgent: query KB per symbol before scoring",
           "Weekly cron: re-index new 10-Q filings every Sunday"],
    deliverables=["500+ docs indexed","KB query returns correct chunks for AAPL",
                  "RAG context in agent trace","Weekly refresh running"],
    autopilot=["RAG gives agent memory of company history across all quarters",
               "Agent can ask: 'What did AAPL say about margins last earnings?'"],
    risk=["Risk: ChromaDB persistence → use PersistentClient with Docker volume",
          "Risk: Embedding cost → use sentence-transformers (local, free)"],
    code=["chroma = PersistentClient(path='./chroma_db')",
          "def ingest(doc_id, text, meta):",
          "    chunks = chunk(text, 512, 50)",
          "    collection.add(ids=[f'{doc_id}_{i}' for i in range(len(chunks))],",
          "                   documents=chunks, metadatas=[meta]*len(chunks))"],
    days=["Mon: ChromaDB + ingestion pipeline","Tue: Embed 500 docs","Wed: Hybrid retrieval",
          "Thu: Wire into ResearcherAgent","Fri: Weekly refresh scheduler"],
)

WEEKS[56] = dict(
    title="Real-Time News Arbitrage & Event-Driven Alpha",
    subtitle="Sub-second news processing to detect market-moving events and trigger reactive scans.",
    kpis=[("Feeds","6"),("Latency","<2s detection"),("Classification","ML"),("Actions","Reactive scan+emergency exit")],
    goals=["6 real-time feeds: Bloomberg RSS, Reuters, SEC EDGAR, Twitter, Reddit, Benzinga",
           "ML event classifier (FinBERT): categorize as Earnings Beat/Miss, M&A, FDA, Legal, Macro",
           "Estimate price impact for each event type based on historical reactions",
           "Reactive scan: positive large event → immediate candidate scan on that symbol",
           "Emergency exit evaluation: negative event for held position → close immediately?",
           "Latency tracking: measure detection time vs first price tick after event"],
    tasks=["newsfeeds.py: async readers for 6 sources; dedup by URL hash + 5-min freshness filter",
           "event_classifier.py: FinBERT fine-tuned for 8 event categories",
           "price_impact_estimator.py: regression from historical event→price impact pairs",
           "Reactive scan trigger: POST /api/v1/autopilot/scan?trigger=news&symbol=X",
           "Emergency exit: if negative_impact > 0.15 for held position → evaluate close"],
    deliverables=["6 feeds ingesting real-time","Event correctly classified (tested)",
                  "Emergency exit triggers on negative event test case","Latency < 2s measured"],
    autopilot=["News arbitrage is the alpha layer — acts in seconds vs human minutes",
               "Emergency exit is safety-first: protect capital before chasing alpha"],
    risk=["Risk: False positives → require 2+ source confirmation for large trades",
          "Risk: Stale reposted news → 5-minute freshness filter enforced"],
    code=["async def process_article(article):",
          "    ev = classifier.predict(article.text)",
          "    impact = estimator.predict(ev, article.symbol)",
          "    if abs(impact) > 0.05:",
          "        await alert_engine.fire('NEWS_EVENT', {'symbol':article.symbol,'impact':impact})"],
    days=["Mon: 6 feed readers","Tue: FinBERT classifier","Wed: Impact estimator",
          "Thu: Reactive scan trigger","Fri: Emergency exit; latency tracking"],
)

WEEKS[57] = dict(
    title="Options Flow Intelligence & Dark Pool Analytics",
    subtitle="Detect institutional money movement via unusual options flow and dark pool prints.",
    kpis=[("Flow Sources","3"),("Unusual","5× avg OI"),("Dark Pool","Block prints"),("Score","0-100")],
    goals=["Unusual options activity: flag volume > 5× average open interest per strike",
           "Sweep detector: aggressive multi-strike buying at ask → strong directional bet",
           "Dark pool prints: large block trades >10,000 shares before regular hours",
           "FlowScore 0-100: conviction based on size, direction, proximity to expiry, sweep flag",
           "Flow alignment: if flow matches proposed trade → +10 bonus to entry score",
           "Flow contradiction: if strong opposite flow → skip trade regardless"],
    tasks=["options_flow.py: Unusual Whales API or Tradier screener",
           "unusual_activity_detector(): volume vs 30-day avg OI per strike",
           "sweep_detector(): multi-strike aggressive buying pattern",
           "darkpool.py: large block prints from tick data inference",
           "FlowScore weighted composite","GET /api/v1/flow/{symbol}"],
    deliverables=["Unusual activity detected for test case (>5× OI)","Sweep correctly identified",
                  "Flow score computed for 20 symbols","FlowView renders events"],
    autopilot=["Flow alignment: institutional agreement = higher confidence entry",
               "Flow contradiction = hard skip regardless of other signals"],
    risk=["Risk: Unusual Whales expensive → use Tradier flow as free fallback",
          "Risk: Flow data lagged 15 min → context only, not sole signal"],
    code=["def is_unusual(symbol, strike, vol, oi_avg):",
          "    ratio = vol / max(oi_avg, 1)",
          "    return ratio > 5.0, ratio"],
    days=["Mon: Flow API integration","Tue: Unusual activity detector","Wed: Sweep detector",
          "Thu: Dark pool prints","Fri: FlowView + score integration"],
)

WEEKS[58] = dict(
    title="Fine-Tuning LLM on Own Trade History (LoRA PEFT)",
    subtitle="Fine-tune Llama3-8B on 500+ paper trades to create a personalized trading judgment model.",
    kpis=[("Dataset","500+ trades"),("Base Model","Llama3-8B"),("Method","LoRA PEFT"),("Eval","Win rate lift")],
    goals=["Build instruction-tuning dataset: trade features + outcome + LLM decision rationale",
           "Format as {instruction, input, output} pairs for supervised fine-tuning",
           "Fine-tune Llama3-8B with LoRA adapters (r=16) on Hugging Face PEFT",
           "Evaluate fine-tuned vs base Groq on held-out 20% test trades",
           "Deploy as 3rd LLM layer: Groq + Gemini + Fine-tuned = 3-judge consensus",
           "Monthly retraining as more live data accumulates"],
    tasks=["pip install transformers peft datasets accelerate",
           "dataset_builder.py: generate instruction pairs from DB trade history",
           "finetune.py: LoRA config + Trainer; evaluate on test set",
           "Export adapter → load at inference alongside base model",
           "fine_tuned_ranker.py: integration as 3rd judgment layer"],
    deliverables=["500-trade dataset built","LoRA trains without OOM","Fine-tuned beats base on test set",
                  "3rd LLM layer integrated in pipeline"],
    autopilot=["Fine-tuned model learns YOUR specific trading style",
               "3 judges: Groq + Gemini + Fine-tuned = higher confidence consensus"],
    risk=["Risk: 500 trades too small → data augmentation + synthetic examples",
          "Risk: Overfitting → evaluate on 20% held-out minimum"],
    code=["lora_config = LoraConfig(r=16, lora_alpha=32, target_modules=['q_proj','v_proj'])",
          "model = get_peft_model(base_model, lora_config)",
          "trainer = Trainer(model=model, args=training_args, train_dataset=train_data)",
          "trainer.train()"],
    days=["Mon: Dataset builder","Tue: Instruction pair formatting","Wed: LoRA fine-tuning",
          "Thu: Evaluation vs base","Fri: Deploy as 3rd LLM layer"],
)

WEEKS[59] = dict(
    title="Regime-Adaptive RL Allocation Agent (PPO)",
    subtitle="Train a PPO RL agent to dynamically adjust strategy allocation weights based on market regime.",
    kpis=[("Algorithm","PPO"),("State","15 features"),("Action","6 weights"),("Reward","Sharpe delta")],
    goals=["RL env (gymnasium): state=15 market features, action=6 strategy allocation weights",
           "Reward: Sharpe ratio improvement over prior period",
           "Train PPO (Stable Baselines 3) on 5-year historical data, 1M steps",
           "RL agent replaces static regime→allocation mapping from Week 19",
           "OOS evaluation: RL vs static allocation on held-out 2-year period",
           "Daily weight updates from RL policy; changes logged for transparency"],
    tasks=["pip install stable-baselines3 gymnasium",
           "TradingEnv(gymnasium.Env): state, action, reward, step() implementation",
           "Historical simulation env over 5 years of daily regime data",
           "PPO training: 1M steps with eval every 50k steps",
           "Export trained policy → rl_allocation_policy.pkl",
           "RLAllocator replaces AllocationManager; daily weight update job"],
    deliverables=["RL env runs 5-year episode without error","PPO trains to positive reward",
                  "RL outperforms static allocation on OOS test","Daily weight updates logged"],
    autopilot=["RL self-optimizes allocation without human tuning",
               "Weight changes logged: 'RL reduced Iron Condor from 20% to 8% today'"],
    risk=["Risk: Pathological allocations → enforce min/max weight bounds per strategy",
          "Risk: RL overfits → 3-year train / 2-year OOS split minimum"],
    code=["class TradingEnv(gym.Env):",
          "    def step(self, action):",
          "        weights = softmax(action)",
          "        pnl = simulate_day(weights, self.state)",
          "        reward = sharpe_increment(pnl)",
          "        return next_state(), reward, done, {}"],
    days=["Mon: TradingEnv implementation","Tue: PPO training","Wed: OOS evaluation",
          "Thu: Policy deployment","Fri: Daily weight update + logging"],
)

WEEKS[60] = dict(
    title="Go-Live: First Real Money Trades",
    subtitle="Clear 10-step go-live checklist and execute first real-money trades at minimal 1-contract size.",
    kpis=[("Mode","Live"),("Size","1 contract"),("Budget","$1,000"),("Monitor","Manual daily")],
    goals=["Complete 10-item go-live checklist — every item green before flipping switch",
           "Execute first real-money trade: 1 contract, max $500 total risk",
           "Monitor every cycle manually for first 2 weeks of live trading",
           "Paper vs live P&L daily comparison to measure execution slippage",
           "Week 1 debrief document: surprises vs paper, lessons learned",
           "Scale plan: 1 → 2 → 5 contracts over 8 weeks pending clean results"],
    tasks=["Complete + document all 10 go-live checklist items",
           "Switch BROKER_MODE='live'; MAX_POSITION_CONTRACTS=1; MAX_DAILY_LOSS=200",
           "First trade: put credit spread on liquid ETF (SPY, QQQ, IWM)",
           "Daily live vs paper comparison report",
           "Week 1 debrief document"],
    deliverables=["Checklist 100% green","First live trade executed + confirmed filled",
                  "Daily comparison report","Week 1 debrief written"],
    autopilot=["Live trading is the 60-week culmination — the autopilot proven at real stakes",
               "1 contract = minimal risk; learning about live execution quality is the goal"],
    risk=["Risk: Bad fill on first trade → review order type (limit at mid price only)",
          "Risk: Panic on first loss → commit to full 10-trade minimum before any config change"],
    code=["BROKER_MODE = 'live'",
          "MAX_POSITION_CONTRACTS = 1",
          "MAX_DAILY_LOSS_USD = 200",
          "# kill switch active at ALL times during live trading"],
    days=["Mon: Go-live checklist completion; switch to live","Tue: First live trade; monitor fill",
          "Wed-Thu: 2nd and 3rd trades; slippage capture","Fri: Week 1 debrief document"],
)

# ── Y2 Q2: Scaling & Robustness ──
WEEKS[61] = dict(
    title="Scale-Up to 5 Contracts & Kelly Recalibration",
    subtitle="Increase live position size to 5 contracts using live-calibrated Kelly after 2 clean weeks.",
    kpis=[("Max","5 contracts"),("Kelly","Live-data"),("Daily Loss","$500"),("Slippage","Tracked")],
    goals=["Scale to 5 contracts after 2 clean weeks of live trading",
           "Recalibrate Kelly parameters using live trade win rate and P&L data",
           "Update daily loss limit: $200 → $500 proportionally",
           "Track slippage: live fill vs theoretical mid price per trade",
           "Volume impact: verify 5-contract orders don't worsen fill quality significantly"],
    tasks=["Update config: MAX_POSITION_CONTRACTS=5, MAX_DAILY_LOSS=500",
           "Kelly recalibration: live_trades = db.get_live_trades(last_n=50)",
           "slippage_tracker.py: record expected_mid vs actual_fill per trade",
           "Volume analysis: compare fill quality as contract count increases",
           "Updated monitoring thresholds for 5-contract risk"],
    deliverables=["5-contract live trades executing cleanly","Kelly recalibrated on live data",
                  "Slippage per trade computed"],
    autopilot=["Scale-up gated on clean execution — no incidents in first 2 weeks",
               "Live Kelly recalibration makes sizing data-driven from actual fills"],
    risk=["Risk: Worse fills with 5 contracts → test 2, then 3, then 5 progressively",
          "Risk: Overconfidence → keep daily loss limit strict; honor the kill switch"],
    code=["live_trades = db.get_live_trades(last_n=50)",
          "win_rate = mean([1 if t.pnl>0 else 0 for t in live_trades])",
          "kelly = fractional_kelly(win_rate, avg_win(live_trades), avg_loss(live_trades))"],
    days=["Mon: Config update; first 5-contract trade","Tue: Kelly recalibration",
          "Wed: Slippage tracking","Thu: Volume + fill quality analysis","Fri: Updated monitoring"],
)

WEEKS[62] = dict(
    title="Multi-Broker Integration & Automatic Failover",
    subtitle="Add TD Ameritrade/Schwab as second broker for redundancy and best-execution routing.",
    kpis=[("Brokers","2"),("Failover","Automatic"),("Compare","Commission + fill quality"),("SLA","Zero outage")],
    goals=["Integrate Schwab/TD Ameritrade API via schwab-py library",
           "BrokerRouter: selects broker based on health + estimated fill quality",
           "Automatic failover: if primary broker fails → auto-route to secondary in <5s",
           "Commission tracker: per-trade commission by broker for cost comparison",
           "Dual health check pre-market: both brokers must respond before cycle starts"],
    tasks=["pip install schwab-py","schwab_broker.py implementing BrokerInterface",
           "BrokerRouter.execute(): primary healthy → primary; else secondary",
           "commission_tracker.py: log commission per trade per broker",
           "Failover test: simulate primary outage → confirm secondary activates"],
    deliverables=["Schwab connected + placing paper orders","Failover test passes in <5s",
                  "Commission comparison report generated"],
    autopilot=["Dual broker = zero single-point-of-failure in execution",
               "Best-execution routing shifts to lower-cost broker over time"],
    risk=["Risk: Schwab API changes → use well-maintained schwab-py; monitor for deprecations"],
    code=["class BrokerRouter:",
          "    def execute(self, order):",
          "        if self.primary.is_healthy(): return self.primary.execute(order)",
          "        return self.secondary.execute(order)  # automatic failover"],
    days=["Mon: Schwab API auth","Tue: schwab_broker.py","Wed: BrokerRouter failover",
          "Thu: Commission tracker","Fri: Failover E2E test"],
)

WEEKS[63] = dict(
    title="Futures & Index Hedging Integration",
    subtitle="Add E-mini S&P 500 futures and VIX derivatives for portfolio delta-neutral hedging.",
    kpis=[("Instruments","ES, NQ, VIX"),("Hedge","Delta-neutral"),("Auto","Every 30 min"),("Cost","Tracked separately")],
    goals=["E-mini ES futures via Interactive Brokers ib_insync for portfolio delta hedging",
           "Hedge trigger: if portfolio delta drifts beyond ±0.25, neutralize with ES",
           "VIX call hedge: buy cheap OTM VIX calls (insurance) when VIX < 18",
           "Hedge sizing: exact contract count from portfolio delta / ES delta per contract",
           "Auto-hedge job: check delta balance every 30 minutes intraday",
           "Hedge P&L tracked separately from options P&L"],
    tasks=["pip install ib_insync","ib_broker.py: ES mini execution on IB paper",
           "delta_hedger.py: portfolio_delta → ES contracts needed",
           "vix_hedge.py: buy OTM VIX calls when VIX < 18",
           "Auto-hedge 30-min job; HedgeView.tsx"],
    deliverables=["ES mini orders on IB paper account","Delta hedge math verified (tested)",
                  "Auto-hedge fires every 30 minutes","HedgeView shows hedge positions + P&L"],
    autopilot=["Delta-neutral hedge removes market direction risk from portfolio",
               "VIX insurance: affordable in calm markets, pays off in crashes"],
    risk=["Risk: Margin requirements → verify account margin before each hedge",
          "Risk: Over-hedging (negative delta) → strict target ±0.10 delta range"],
    code=["def compute_hedge_qty(portfolio_delta, es_delta_per_contract=50):",
          "    return -round(portfolio_delta / es_delta_per_contract)"],
    days=["Mon: IB API + ES paper trading","Tue: Delta hedger","Wed: VIX hedge logic",
          "Thu: 30-min auto-hedge job","Fri: HedgeView + P&L tracking"],
)

WEEKS[64] = dict(
    title="Portfolio Rebalancing Engine & Capital Efficiency",
    subtitle="Automate weekly rebalancing to maintain target allocation and maximize capital deployment.",
    kpis=[("Rebalance","Weekly"),("Idle Capital","<10%"),("Margin","50-70%"),("Turnover","Minimize")],
    goals=["Weekly rebalance: assess allocation drift; generate rebalance orders if drift >5%",
           "Capital efficiency: no more than 10% idle — deploy or sweep to T-bills",
           "Margin utilization: 50-70% target — not too conservative, not too leveraged",
           "Minimize turnover: prefer rolling over close-and-reopen",
           "RebalanceView: current vs target allocation with action plan"],
    tasks=["rebalancer.py: drift computation; rebalance order generation",
           "capital_efficiency(): deployed% + idle recommendation",
           "margin_monitor(): alert at 70% margin utilization",
           "cash_sweep_manager(): broker cash management API",
           "RebalanceView.tsx: side-by-side current vs target"],
    deliverables=["Rebalancer produces correct action for test drift","Capital efficiency metric computed",
                  "Margin alert at 70%","RebalanceView shows weekly plan"],
    autopilot=["Rebalancing maintains intended risk profile over time",
               "Idle capital detection removes drag from uninvested cash"],
    risk=["Risk: Rebalance too frequent → only execute if drift >5%",
          "Risk: Cash sweep may not be available → integrate and verify with broker"],
    code=["def rebalance_plan(current, target, tol=0.05):",
          "    return {s: target[s]-current.get(s,0) for s in target",
          "           if abs(target[s]-current.get(s,0)) > tol}"],
    days=["Mon: Rebalancer core","Tue: Capital efficiency + margin monitor","Wed: Cash sweep",
          "Thu: RebalanceView.tsx","Fri: Weekly scheduler + E2E"],
)

# Weeks 65-78: institutional + advanced features (briefer format)
_BRIEF_WEEKS = {
65: ("Institutional Reporting & FINRA Compliance",
     "Build 13F-style reports, daily reconciliation, FINRA-ready audit trail, 7-year retention.",
     "13F position report, daily reconciliation, trade confirms, 7-year tamper-proof archive."),
66: ("Tax Lot Accounting & Wash Sale Compliance",
     "Track cost basis, holding periods, and wash sale rules automatically for tax reporting.",
     "FIFO/LIFO lot tracking, wash sale flag, annual tax report PDF, tax optimization hints."),
67: ("Crypto Correlation Signal Integration",
     "Monitor BTC/ETH as risk-off signals affecting equity options strategy allocation.",
     "BTC correlation to SPY, crypto fear/greed index, regime modifier when crypto diverges."),
68: ("Macro Economic Indicator Dashboard",
     "Build macro dashboard: CPI, NFP, PMI, Fed signals integrated into regime detection.",
     "Economic calendar pull (FRED API), 12 macro indicators, regime overlay adjustments."),
69: ("IV Skew Trading Strategies",
     "Build dedicated IV skew arbitrage: buy cheap wing, sell expensive ATM or vice versa.",
     "Skew index per symbol, skew trade builder, backtest on 2 years of vol surface data."),
70: ("Live Earnings Play Strategies",
     "Trade IV crush around earnings: structured calendar positions 5 days before, close day-of.",
     "Earnings play scanner, pre-earnings entry, IV crush capture, post-earnings analysis."),
71: ("Portfolio Insurance & Tail Risk Hedging",
     "Systematic tail hedging: OTM puts, VIX calls, correlation trades for crash protection.",
     "Tail hedge budget 1% of NAV/month, auto-buy SPY puts in calm markets, track hedge drag."),
72: ("AI Agent Self-Evaluation & Improvement Loop",
     "Agent evaluates its own weekly performance and proposes parameter improvements.",
     "Weekly self-eval prompt, agent proposes changes, human approval gate, auto A/B test."),
73: ("Multi-Timeframe Regime Analysis",
     "Align short/medium/long-term regime signals for higher-conviction entries only.",
     "3-timeframe regime (daily, weekly, monthly), alignment score, skip on regime conflict."),
74: ("Client Reporting API & Partner Integration",
     "RESTful API for third-party portfolio managers to access Apex Terminal performance data.",
     "OAuth2 API keys, GET /partner/performance, rate-limited, white-label report endpoint."),
75: ("Advanced Backtesting: Stress Period Deep-Dives",
     "Deep-dive backtest in 5 stress periods (2008, 2011, 2018, 2020, 2022) with tick data.",
     "Tick-level backtest engine, 5 stress periods, regime-stratified Sharpe, tail loss audit."),
76: ("Volatility Forecasting with GARCH Models",
     "Train GARCH(1,1) to forecast next-day IV; use forecast in entry scoring and position sizing.",
     "arch library GARCH(1,1), forecast vs realized calibration, IV forecast in entry scorer."),
77: ("Options Market Making Simulation",
     "Simulate basic market making: quote bid and ask; earn spread as alternative revenue stream.",
     "MM simulation engine, BBO-aware quoting, inventory hedging, simulated P&L from spread capture."),
78: ("Q3 Performance Review & Y2H2 Planning",
     "Mid-year live trading review and planning for the final 26 weeks of Year 2.",
     "Q3 attribution, live vs paper comparison, top-3 strategy winners, Y2H2 roadmap approved."),
}

for wk, (title, subtitle, summary) in _BRIEF_WEEKS.items():
    WEEKS[wk] = dict(
        title=title, subtitle=subtitle,
        kpis=[("Status","Y2 Mid-Phase"),("Priority","High"),("Type","Production"),("Detail",summary[:30])],
        goals=[summary, "Integrate with existing autopilot pipeline",
               "Add comprehensive tests", "Document in user guide"],
        tasks=[f"Design {title} architecture", f"Implement core {title} service",
               f"Build API and frontend component", "Write tests + CI integration",
               "Document in user guide and runbook"],
        deliverables=[f"{title} working end-to-end", "Tests passing in CI",
                      "Feature documented in user guide"],
        autopilot=[f"{title} enhances autopilot decision quality and operational robustness",
                   "Results logged in RunArtifact and weekly performance reports"],
        risk=["Risk: Integration complexity → standalone service first, integrate after unit tests pass"],
        code=[f"# {title}", f"# {summary}", "# See service module for full implementation"],
        days=["Mon: Design + architecture","Tue: Core implementation","Wed: API endpoints",
              "Thu: Frontend component","Fri: Tests + documentation"],
    )

# ── Y2 Q4: Completion & Ecosystem ──
WEEKS[79] = dict(
    title="Mobile App: React Native Dashboard",
    subtitle="iOS and Android app with real-time P&L, push notifications, and biometric kill switch.",
    kpis=[("Platform","iOS+Android"),("Push","FCM+APNs"),("Auth","Biometric"),("Size","<30MB")],
    goals=["React Native app: real-time P&L, positions, alerts feed, kill switch",
           "Push every trade execution, alert trigger, daily briefing",
           "Biometric auth (FaceID/TouchID) for kill switch activation",
           "Offline mode: cached last-known positions when no connection",
           "Dark terminal theme matching desktop"],
    tasks=["npx react-native init ApexMobile","JWT auth integration with FastAPI backend",
           "WebSocket client for live P&L streaming","FCM + APNs push setup",
           "Biometric kill switch","TestFlight + Google Play internal beta"],
    deliverables=["App builds for iOS + Android","P&L updates via WebSocket",
                  "Push fires on test trade","Kill switch works with biometric"],
    autopilot=["Mobile = always-on monitoring even away from desk",
               "Biometric kill switch is the ultimate safety feature"],
    risk=["Risk: WebSocket battery drain → background polling when app inactive",
          "Risk: App store review delay → TestFlight for internal testing first"],
    code=["const killSwitch = async () => {",
          "  const auth = await LocalAuthentication.authenticateAsync();",
          "  if (auth.success) await api.post('/autopilot/kill');",
          "}"],
    days=["Mon: RN setup; JWT auth","Tue: P&L + positions screens","Wed: WebSocket",
          "Thu: Push notifications","Fri: Biometric kill switch; TestFlight"],
)

WEEKS[80] = dict(
    title="Web3 Integration & On-Chain Trade Audit Trail",
    subtitle="Publish trade decision hashes to Polygon blockchain for tamper-proof immutable audit.",
    kpis=[("Chain","Polygon"),("Cost","<$0.01/hash"),("Verify","On-chain"),("DeFi","Research phase")],
    goals=["Publish SHA-256 hash of each trade decision to Polygon for immutable record",
           "Verification API: compare DB record vs on-chain hash",
           "Quarterly portfolio attestation published on-chain",
           "Research Lyra DeFi options protocol on testnet",
           "Batch hourly hashes to control gas costs"],
    tasks=["pip install web3","blockchain.py: publish_hash(trade_id, hash) → tx_hash",
           "Polygon Mumbai testnet → mainnet after testing",
           "verify_trade(trade_id): compare DB vs on-chain",
           "GET /api/v1/compliance/chain-verify/{trade_id}"],
    deliverables=["Hash published on Polygon for test trade","Verification endpoint works",
                  "Gas tracked at <$0.01 per hash batch","Lyra research doc written"],
    autopilot=["On-chain hashes = blockchain is the ultimate immutable audit",
               "Quarterly attestation makes performance claims publicly verifiable"],
    risk=["Risk: Gas spikes → batch hourly rather than per-trade",
          "Risk: Lyra liquidity thin → DeFi research only; no production trading yet"],
    code=["def publish_hash(h: str) -> str:",
          "    tx = contract.functions.recordHash(h).build_transaction({'gas':50000})",
          "    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)",
          "    return w3.eth.send_raw_transaction(signed.rawTransaction).hex()"],
    days=["Mon: Web3 + Polygon","Tue: Hash publisher","Wed: Verification API",
          "Thu: Lyra testnet research","Fri: Quarterly attestation"],
)

# Weeks 81-103: final phase
_FINAL_WEEKS = {
81: "Quantitative Research Platform & Jupyter Integration",
82: "API Marketplace: Sell Data Feeds & Signals to Third Parties",
83: "Enterprise Multi-Tenant Architecture for Multiple Users",
84: "Black-Litterman Portfolio Optimization Model",
85: "Regulatory Filing Automation (Form 4, 13F Preparation)",
86: "AI-Powered Strategy Narrative Auto-Generator",
87: "Cross-Asset Correlation Engine (Stocks + Bonds + Crypto + Forex)",
88: "Distributed Computing: Ray Cluster for Parallel Backtests",
89: "Automated A/B Testing Framework for Strategy Variants",
90: "Production Hardening: Kubernetes, Helm Charts, Auto-Scaling",
91: "Community Platform: Strategy Sharing Marketplace",
92: "Beta Program: External User Onboarding (10 Beta Users)",
93: "Public API v2.0 with GraphQL & WebSocket Subscriptions",
94: "Advanced Options Analytics: Smile Arbitrage & Density Extraction",
95: "Institutional Data Integration: Bloomberg B-PIPE Alternative",
96: "Automated Earnings Straddle & Strangle Strategy Suite",
97: "Full CI/CD Pipeline: GitOps, ArgoCD, Blue-Green Deployments",
98: "Performance Attribution Engine: Brinson-Hood-Beebower Model",
99: "Predictive Analytics Dashboard: ML-Powered Forward Metrics",
100: "Two-Year Milestone: 10,000 Paper Trades Analysis & Insights",
101: "Open Source Launch: Apache 2.0 License + GitHub Stars Campaign",
102: "Premium Tier: SaaS Model Design & Stripe Billing Integration",
103: "Final Integration Testing & Two-Year Performance Certification",
}

for wk, title in _FINAL_WEEKS.items():
    WEEKS[wk] = dict(
        title=title,
        subtitle=f"Advanced Year 2 strategic feature: {title[:60]}",
        kpis=[("Week",f"{wk}/104"),("Phase","Y2 Final"),("Status","Production"),("Priority","Strategic")],
        goals=[f"Implement {title} as production-grade capability",
               "Integrate with core autopilot ecosystem",
               "Test in staging environment before production rollout",
               "Document and release with comprehensive changelog"],
        tasks=[f"Architect {title} design","Implement core service + API",
               "Build frontend component","Write unit + integration tests",
               "Documentation + CI integration"],
        deliverables=[f"{title} live in production","Tests passing in CI",
                      "User documentation updated","Released with changelog"],
        autopilot=[f"{title} adds strategic depth to the autonomous trading ecosystem",
                   "Performance impact tracked in weekly attribution reports"],
        risk=["Risk: Scope underestimated → timebox to 1 week; defer excess to post-v3.0 roadmap"],
        code=[f"# Week {wk}: {title}", "# See architecture docs for full implementation"],
        days=["Mon: Design + kickoff","Tue: Core implementation","Wed: API + frontend",
              "Thu: Testing + integration","Fri: Documentation + deployment"],
    )

WEEKS[104] = dict(
    title="Two-Year Completion: Open Source Launch, 4-Year Roadmap & Celebration",
    subtitle="Final week: 2-year retrospective, open source the core, publish the definitive technical article, plan Year 3+.",
    kpis=[("Live Trades","2,000+ target"),("Sharpe","Target >1.5"),("Open Source","GitHub"),("Release","v3.0")],
    goals=["Comprehensive 2-year performance attribution: all strategies, all regimes",
           "Calculate full live trading P&L: target Sharpe >1.5, max drawdown <15%",
           "Open-source the core framework (minus proprietary alpha signals) on GitHub",
           "Publish definitive technical article: 'Building an Autonomous Options Autopilot in 2 Years'",
           "Year 3-4 roadmap: hedge fund structure, institutional capital, full platform",
           "Tag v3.0; celebrate the two-year milestone"],
    tasks=["two_year_review.py: full performance attribution from DB",
           "2-year report PDF via ReportEngine",
           "Open-source prep: audit private signals; write contribution guide + LICENSE",
           "Publish technical article on Substack / HN / LinkedIn",
           "Year 3-4 Roadmap.md: investor-deck format with track record",
           "git tag v3.0 with full annotated changelog"],
    deliverables=["2-year performance report PDF","Open-source repo live with README",
                  "Technical article published","Year 3-4 roadmap finalized","v3.0 tagged on GitHub"],
    autopilot=["Two years of autonomous operation — the autopilot has proven itself at real stakes",
               "Open-source core: give back to the trading community that provided the tools",
               "Track record = foundation for Year 3 institutional conversations"],
    risk=["Risk: 2-year results below target → honest retrospective; document what to change for Y3",
          "Risk: Open-source exposes proprietary alpha → carefully audit what stays private"],
    code=["SELECT EXTRACT(year FROM created_at) yr,",
          "       COUNT(*) trades, SUM(pnl) total_pnl,",
          "       AVG(CASE WHEN pnl>0 THEN 1.0 ELSE 0 END) win_rate",
          "FROM trades GROUP BY yr ORDER BY yr",
          "-- Target: win_rate>0.60, max_dd<15%, positive P&L both years"],
    days=["Mon: 2-year analysis + performance report PDF","Tue: Open-source prep + contribution guide",
          "Wed: Technical article draft + publish","Thu: Year 3-4 roadmap + v3.0 release notes",
          "Fri: Tag v3.0; publish article; celebrate 104 weeks of building"],
)


# ══════════════════════════════════════════════════════════════════════════════
# PDF BUILD ENGINE
# ══════════════════════════════════════════════════════════════════════════════

# --- WEEK DATA ENRICHMENT ---
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from enrich_weeks import ENRICHMENT
for _wk, _extra in ENRICHMENT.items():
    if _wk in WEEKS:
        WEEKS[_wk].update(_extra)
def build_week_page(story, week_num, data, styles):
    q = quarter_for_week(week_num)
    qcolor = QUARTER_COLORS[q]
    qlabels = {1:'Year 1 Q1 — Foundation',2:'Year 1 Q2 — Hardening',3:'Year 1 Q3 — Intelligence',
               4:'Year 1 Q4 — Scale',5:'Year 2 Q1 — AI Agents',6:'Year 2 Q2 — Scaling',
               7:'Year 2 Q3 — Ecosystem',8:'Year 2 Q4 — Completion'}
    qlabel = qlabels.get(q, f'Q{q}')

    # Header
    story += week_header_block(week_num, data['title'], data['subtitle'], qcolor, qlabel, styles)
    story.append(Spacer(1, 4))

    # KPI bar
    kpis = data.get('kpis', [])
    if kpis:
        n = len(kpis)
        cells = [[Paragraph(f'<b>{k}</b><br/>{v}', ParagraphStyle('kc',
            fontName='Helvetica-Bold', fontSize=7.5, textColor=WHITE, leading=10,
            alignment=TA_CENTER)) for k,v in kpis]]
        t = Table(cells, colWidths=[6.5*inch/n]*n, rowHeights=[26])
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),qcolor),
            ('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
            ('GRID',(0,0),(-1,-1),0.5,APEX_GREY)]))
        story.append(t); story.append(Spacer(1,6))

    def list_section(label, items, color, bullet='->'):
        if not items: return
        story.append(Paragraph(label, ParagraphStyle('sh', fontName='Helvetica-Bold',
            fontSize=8.5, textColor=color, spaceBefore=6, spaceAfter=2)))
        for item in items:
            story.append(Paragraph(f'  {bullet}  {item}',
                ParagraphStyle('bi', fontName='Helvetica', fontSize=8,
                    textColor=APEX_DARK, leading=12, leftIndent=10, spaceAfter=1)))

    def two_col_section(label, left_items, right_items, left_color, right_color, left_lbl, right_lbl):
        story.append(Paragraph(label, ParagraphStyle('sh2', fontName='Helvetica-Bold',
            fontSize=8.5, textColor=left_color, spaceBefore=6, spaceAfter=2)))
        rows = []
        for i in range(max(len(left_items), len(right_items))):
            l = left_items[i] if i < len(left_items) else ''
            r = right_items[i] if i < len(right_items) else ''
            lp = Paragraph(f'  ->  {l}', ParagraphStyle('lc', fontName='Helvetica', fontSize=7.5,
                textColor=APEX_DARK, leading=11)) if l else Spacer(1,1)
            rp = Paragraph(f'  ->  {r}', ParagraphStyle('rc', fontName='Helvetica', fontSize=7.5,
                textColor=APEX_DARK, leading=11)) if r else Spacer(1,1)
            rows.append([lp, rp])
        if rows:
            t = Table(rows, colWidths=[3.15*inch, 3.15*inch])
            t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                ('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1),
                ('LINEAFTER',(0,0),(0,-1),0.5,APEX_GREY)]))
            story.append(t)

    # Main content sections
    list_section('GOALS', data.get('goals',[]), APEX_BLUE)
    list_section('TASKS', data.get('tasks',[]), APEX_TEAL)

    # Commands + Files as two-col
    cmds = data.get('commands',[])
    files = data.get('files',[])
    if cmds or files:
        two_col_section('COMMANDS & FILES', cmds, files, APEX_GREEN, APEX_AMBER,
            'Shell Commands', 'Files / Modules to Create')

    list_section('API ENDPOINTS TO BUILD', data.get('apis',[]), APEX_PURPLE)
    list_section('TESTS TO WRITE', data.get('tests',[]), APEX_TEAL)

    # Env vars + Deps as two-col
    evars = data.get('env_vars',[])
    deps = data.get('deps',[])
    if evars or deps:
        two_col_section('ENV VARS & DEPENDENCIES', evars, deps, APEX_AMBER, APEX_BLUE,
            'Environment Variables', 'pip / npm packages')

    list_section('DELIVERABLES', data.get('deliverables',[]), APEX_GREEN)
    list_section('AUTOPILOT LOGIC', data.get('autopilot',[]), APEX_AMBER)
    list_section('PITFALLS & HOW TO AVOID', data.get('pitfalls',[]), APEX_RED)
    list_section('SUCCESS METRICS', data.get('metrics',[]), APEX_BLUE)
    list_section('RISK', data.get('risk',[]), APEX_RED)
    list_section('DAY-BY-DAY BREAKDOWN', data.get('days',[]), APEX_PURPLE, bullet='>')

    story.append(PageBreak())


def build_pdf():
    out = "/home/aarav/Aarav/Tradingview recreation/Apex_Terminal_2Year_Expanded_Plan.pdf"
    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
    )

    styles = make_styles(APEX_TEAL)  # default accent for shared styles
    story = []

    # ── Cover page ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.2*inch))
    story.append(Paragraph("APEX TERMINAL", ParagraphStyle("cover_main",
        fontName="Helvetica-Bold", fontSize=38, textColor=APEX_TEAL,
        alignment=TA_CENTER, spaceAfter=8)))
    story.append(Paragraph("Two-Year Master Plan — Expanded Edition",
        ParagraphStyle("cover_sub",fontName="Helvetica",fontSize=18,
        textColor=APEX_DARK,alignment=TA_CENTER,spaceAfter=4)))
    story.append(Paragraph("104 Weeks  |  Detailed Technical Breakdown  |  AI Autopilot Architecture",
        ParagraphStyle("cover_tag",fontName="Helvetica-Oblique",fontSize=10,
        textColor=APEX_GREY,alignment=TA_CENTER,spaceAfter=20)))
    bar = Table([[""]], colWidths=[6.5*inch], rowHeights=[3])
    bar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),APEX_TEAL)]))
    story.append(bar)
    story.append(Spacer(1, 16))
    metrics = [
        ["104 Weeks","6 Strategies","Dual LLM","Full Stack"],
        ["52 Wks Y1 + 52 Wks Y2","All Option Types","Groq + Gemini","React + FastAPI"],
    ]
    met_tbl = Table(metrics, colWidths=[1.625*inch]*4, rowHeights=[18,14])
    met_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),APEX_BLUE),
        ("TEXTCOLOR",(0,0),(-1,0),WHITE),
        ("TEXTCOLOR",(0,1),(-1,1),APEX_GREY),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("FONTNAME",(0,1),(-1,1),"Helvetica"),
        ("FONTSIZE",(0,0),(-1,0),9),
        ("FONTSIZE",(0,1),(-1,1),7),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("GRID",(0,0),(-1,-1),0.5,APEX_GREY),
    ]))
    story.append(met_tbl)
    story.append(PageBreak())

    # ── Table of Contents ────────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", ParagraphStyle("toc_title",
        fontName="Helvetica-Bold",fontSize=16,textColor=APEX_TEAL,
        alignment=TA_CENTER,spaceAfter=12)))
    for wk in range(1, 105):
        if wk in WEEKS:
            q = quarter_for_week(wk)
            qnames = {1:"Y1-Q1",2:"Y1-Q2",3:"Y1-Q3",4:"Y1-Q4",
                      5:"Y2-Q1",6:"Y2-Q2",7:"Y2-Q3",8:"Y2-Q4"}
            line = f"<b>Wk {wk:03d}</b> [{qnames[q]}]  {WEEKS[wk]['title']}"
            story.append(Paragraph(line, ParagraphStyle("toc_line",
                fontName="Helvetica",fontSize=7,textColor=APEX_DARK,
                leading=9,spaceAfter=1,leftIndent=8)))
    story.append(PageBreak())

    # ── Week pages ───────────────────────────────────────────────────────────
    for wk in range(1, 105):
        if wk in WEEKS:
            build_week_page(story, wk, WEEKS[wk], styles)

    doc.build(story)
    print(f"✅ PDF generated: {out}")
    print(f"   Total weeks rendered: {sum(1 for w in range(1,105) if w in WEEKS)}/104")


if __name__ == "__main__":
    build_pdf()
