
# ══════════════════════════════════════════════════════════════════════════════
# V4 CONTENT: QUARTER 1 (DAYS 1-65)
# Granularity: DAILY
# ══════════════════════════════════════════════════════════════════════════════

DAYS = {}

# ─── WEEK 1: FOUNDATION SETUP ────────────────────────────────────────────────

DAYS[1] = {
    'day_global': 1, 'weekday': 'Monday', 'title': 'Repository & Environment',
    'outcome': 'Clean Git repo, Python venv, FastAPI installed, Hello World running.',
    'commands': [
        'git init && git checkout -b main',
        'python3 -m venv venv && source venv/bin/activate',
        'pip install fastapi uvicorn[standard] python-dotenv',
        'pip freeze > requirements.txt',
        'curl -s https://www.gitignore.io/api/python,linux,macos > .gitignore'
    ],
    'files': [
        '.env.example (API_KEY=, DB_URL=)',
        'main.py (app = FastAPI())',
        'README.md (Project Mission Statement)'
    ],
    'arch': [
        'Monorepo Structure: /apps/api, /apps/web, /libs/core',
        'Environment Variable Strategy: 12-Factor App',
        'Pre-commit hooks setup (Black/Isort/Flake8)'
    ],
    'autopilot': [
        'Initialize "Coding Agent" instructions in .cursorrules',
        'Prompt: "You are a Senior Python Backend Engineer. Always type hint."',
        'Setup "Memory" file for the AI to track decisions.'
    ],
    'risk': 'Polluting global python environment. Mitigation: Enforce venv activation.',
    'metrics': 'GET / returns {"status": "ok"}'
}

DAYS[2] = {
    'day_global': 2, 'weekday': 'Tuesday', 'title': 'Database Schema & SQLAlchemy',
    'outcome': 'PostgreSQL container running, Models defined, Almebic initialized.',
    'commands': [
        'docker run -d --name apex-db -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:15',
        'pip install sqlalchemy alembic psycopg2-binary',
        'alembic init alembic'
    ],
    'files': [
        'apps/api/database.py (SessionLocal, Base)',
        'apps/api/models/trade.py (Trade Model)',
        'apps/api/models/ticker.py (Ticker Model)',
        'alembic.ini (Target metadata configured)'
    ],
    'arch': [
        'ORM Pattern: SQLAlchemy 2.0 (AsyncIO support?)',
        'Migration Strategy: Alembic auto-generate',
        'Schema Design: TimescaleDB extension for time-series data?'
    ],
    'autopilot': [
        'Prompt: "Generate SQLAlchemy model for Trade with fields: symbol, side, qty, price, timestamp."',
        'Ask AI to write the __repr__ methods for debugging.'
    ],
    'risk': 'Schema drift. Mitigation: CI check for missing migrations.',
    'metrics': 'alembic upgrade head runs successfully.'
}

DAYS[3] = {
    'day_global': 3, 'weekday': 'Wednesday', 'title': 'API CRUD & Pydantic',
    'outcome': 'Create/Read Trades via HTTP endpoints with Validation.',
    'commands': [
        'pip install pydantic',
        'uvicorn apps.api.main:app --reload'
    ],
    'files': [
        'apps/api/schemas/trade.py (TradeCreate, TradeResponse)',
        'apps/api/routers/trades.py (@router.post)',
        'apps/api/main.py (include_router)'
    ],
    'arch': [
        'DTO Pattern: Pydantic models separate from ORM models.',
        'Dependency Injection: get_db() session yield.',
        'HTTP Status Codes: 201 Created, 404 Not Found.'
    ],
    'autopilot': [
        'Prompt: "Write Pydantic schema for Trade with validation (qty > 0)."',
        'Prompt: "Create FastAPI endpoint to list trades with pagination."'
    ],
    'risk': 'SQL Injection. Mitigation: ORM handles parameterization.',
    'metrics': 'Swagger UI (/docs) shows Create Trade endpoint.'
}

DAYS[4] = {
    'day_global': 4, 'weekday': 'Thursday', 'title': 'Testing & CI/CD',
    'outcome': 'Pytest suite running locally and in GitHub Actions.',
    'commands': [
        'pip install pytest httpx pytest-asyncio',
        'pytest tests/ -v'
    ],
    'files': [
        'tests/conftest.py (Test DB fixture)',
        'tests/test_trades.py (test_create_trade)',
        '.github/workflows/test.yml'
    ],
    'arch': [
        'Testing Pyramid: Unit vs Integration.',
        'Fixture Factory Pattern.',
        'CI/CD: Fail build on lint error.'
    ],
    'autopilot': [
        'Prompt: "Write a test that mocks the specialized database session."',
        'Prompt: "Generate GitHub Action YAML for running pytest on PR."'
    ],
    'risk': 'Flaky tests. Mitigation: Deterministic seed data.',
    'metrics': 'GitHub Action turns Green.'
}

DAYS[5] = {
    'day_global': 5, 'weekday': 'Friday', 'title': 'Frontend Shell (React/Vite)',
    'outcome': 'Typescript React app running, fetching data from API.',
    'commands': [
        'npm create vite@latest apps/web -- --template react-ts',
        'cd apps/web && npm install',
        'npm install @tanstack/react-query axios tailwindcss'
    ],
    'files': [
        'apps/web/src/api/client.ts (Axios instance)',
        'apps/web/src/hooks/useTrades.ts (React Query hook)',
        'apps/web/src/App.tsx (Render list of trades)'
    ],
    'arch': [
        'State Management: React Query (Server State) + Zustand (Client State).',
        'Styling: Tailwind CSS Utility-first.',
        'CORS config on FastAPI backend.'
    ],
    'autopilot': [
        'Prompt: "Create a React component that displays a table of trades."',
        'Prompt: "Configure Tailwind to use Slate-900 dark mode default."'
    ],
    'risk': 'CORS errors. Mitigation: allow_origins=["*"] in dev.',
    'metrics': 'Frontend displays "Hello World" data from Backend.'
}

# ─── WEEK 2: MARKET DATA & BROKER INTEGRATION ────────────────────────────────

DAYS[6] = {
    'day_global': 6, 'weekday': 'Monday', 'title': 'Market Data Feed (Alpaca/Polygon)',
    'outcome': 'Streaming Real-Time Bars for AAPL into console.',
    'commands': [
        'pip install alpaca-py',
        'python scripts/test_stream.py'
    ],
    'files': [
        'apps/api/services/market_data.py',
        'scripts/stream_quotes.py'
    ],
    'arch': [
        'WebSocket Client pattern (asyncio).',
        'Data Normalization (Bar object).',
        'Queue System (Producer -> Consumer).'
    ],
    'autopilot': [
        'Prompt: "Write an asyncio wrapper for Alpaca WebSocket."',
        'Prompt: "Handle reconnection logic with exponential backoff."'
    ],
    'risk': 'API Rate limits. Mitigation: Check headers.',
    'metrics': 'See live price updates in terminal.'
}

DAYS[7] = {
    'day_global': 7, 'weekday': 'Tuesday', 'title': 'Broker Interface (Paper Trading)',
    'outcome': 'Place a Market Buy Order via Code.',
    'commands': [
        'pip install pytz',
        'python scripts/sub_order.py'
    ],
    'files': [
        'apps/api/services/broker.py (AbstractBaseClass)',
        'apps/api/services/alpaca_broker.py (Implementation)'
    ],
    'arch': [
        'Interface Segregation Principle.',
        'Order Lifecycle (Pending -> New -> Filled).',
        'Idempotency Keys.'
    ],
    'autopilot': [
        'Prompt: "Create a Broker abstract class with buy_market method."',
        'Prompt: "Implement cancel_all_orders logic."'
    ],
    'risk': 'Accidental Real Money trade. Mitigation: Check PAPER_MODE env var.',
    'metrics': 'Order ID returned from Alpaca Paper API.'
}
