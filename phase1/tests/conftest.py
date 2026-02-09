"""
Pytest configuration and shared fixtures.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator, List
import pytest
import pytest_asyncio

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services.models import RawTick, CanonicalTick, Bar, BarState, TickSource
from services.persistence import Database, init_database, BarRecord
from services.persistence.repository import BarRepository
from services.persistence.cache import BarCache, TieredBarStore
from services.bar_engine import BarEngine, BarIndexCalculator, NYSESessionCalendar
from services.ingestion.normalizer import TickNormalizer
from services.ingestion.connectors.mock import MockConnector


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def database() -> AsyncGenerator[Database, None]:
    """Create a test database (in-memory SQLite)."""
    db = Database(database_url="sqlite+aiosqlite:///:memory:")
    await db.init_db()
    yield db
    await db.drop_db()
    await db.close()


@pytest_asyncio.fixture
async def repository(database: Database) -> BarRepository:
    """Create a bar repository with test database."""
    return BarRepository(database=database)


@pytest_asyncio.fixture
async def cache() -> BarCache:
    """Create a bar cache."""
    return BarCache(max_size=1000)


@pytest_asyncio.fixture
async def store(cache: BarCache, repository: BarRepository) -> TieredBarStore:
    """Create a tiered store."""
    return TieredBarStore(cache=cache, repository=repository)


@pytest.fixture
def bar_engine() -> BarEngine:
    """Create a bar engine."""
    return BarEngine(timeframes=["1m", "5m"])


@pytest.fixture
def normalizer() -> TickNormalizer:
    """Create a tick normalizer."""
    return TickNormalizer()


@pytest.fixture
def mock_connector() -> MockConnector:
    """Create a mock connector."""
    return MockConnector()


@pytest.fixture
def calendar() -> NYSESessionCalendar:
    """Create NYSE session calendar."""
    return NYSESessionCalendar(include_extended_hours=False)


@pytest.fixture
def sample_raw_ticks() -> List[RawTick]:
    """Create sample raw ticks for testing."""
    base_ts = 1704067200000  # 2024-01-01 00:00:00 UTC (Monday)
    
    return [
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts, price=185.50, size=100),
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 1000, price=185.55, size=150),
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 2000, price=185.45, size=200),
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 30000, price=185.60, size=100),
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 60000, price=185.70, size=250),  # New minute
        RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 61000, price=185.65, size=100),
    ]


@pytest.fixture
def sample_canonical_ticks() -> List[CanonicalTick]:
    """Create sample canonical ticks for testing."""
    base_ts = 1704067200000  # 2024-01-01 00:00:00 UTC
    
    return [
        CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts, price=185.50, size=100),
        CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 1000, price=185.55, size=150),
        CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 2000, price=185.45, size=200),
        CanonicalTick(source=TickSource.MOCK, symbol="AAPL", ts_ms=base_ts + 30000, price=185.60, size=100),
    ]


@pytest.fixture
def sample_bar() -> Bar:
    """Create a sample bar for testing."""
    return Bar(
        symbol="AAPL",
        timeframe="1m",
        bar_index=0,
        ts_start_ms=1704067200000,
        ts_end_ms=1704067260000,
        open=185.50,
        high=185.60,
        low=185.45,
        close=185.55,
        volume=550,
        state=BarState.CONFIRMED,
        tick_count=4,
    )


@pytest.fixture
def fixtures_dir() -> Path:
    """Get path to fixtures directory.
    
    Checks multiple locations for fixtures:
    1. phase1/fixtures/ (primary)
    2. phase1/tests/fixtures/ (fallback)
    """
    # Try primary location first
    primary = Path(__file__).parent.parent / "fixtures"
    if primary.exists() and (primary / "aapl_test_ticks.csv").exists():
        return primary
    
    # Try tests/fixtures fallback
    fallback = Path(__file__).parent / "fixtures"
    if fallback.exists() and (fallback / "aapl_test_ticks.csv").exists():
        return fallback
    
    # Return primary and let individual tests generate fixtures if needed
    return primary


def create_test_tick(
    symbol: str = "AAPL",
    ts_ms: int = 1704067200000,
    price: float = 185.50,
    size: float = 100,
) -> CanonicalTick:
    """Helper to create test ticks."""
    return CanonicalTick(
        source=TickSource.MOCK,
        symbol=symbol,
        ts_ms=ts_ms,
        price=price,
        size=size,
    )


def create_test_bar(
    symbol: str = "AAPL",
    timeframe: str = "1m",
    bar_index: int = 0,
    ts_start_ms: int = 1704067200000,
    open_price: float = 185.50,
    high_price: float = 185.60,
    low_price: float = 185.45,
    close_price: float = 185.55,
    volume: float = 550,
    state: BarState = BarState.CONFIRMED,
) -> Bar:
    """Helper to create test bars."""
    from services.config import timeframe_to_ms
    
    tf_ms = timeframe_to_ms(timeframe)
    
    return Bar(
        symbol=symbol,
        timeframe=timeframe,
        bar_index=bar_index,
        ts_start_ms=ts_start_ms,
        ts_end_ms=ts_start_ms + tf_ms,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=volume,
        state=state,
        tick_count=4,
    )
