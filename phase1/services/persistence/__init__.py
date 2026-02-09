"""
Database models and persistence layer.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, BigInteger, Float, String, Enum as SQLEnum,
    UniqueConstraint, Index, create_engine, text
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.asyncio import async_sessionmaker
import enum

from ..models import Bar, BarState
from ..config import get_settings


Base = declarative_base()


class BarStateDB(str, enum.Enum):
    """Database enum for bar states."""
    FORMING = "FORMING"
    CONFIRMED = "CONFIRMED"
    HISTORICAL = "HISTORICAL"


class BarRecord(Base):
    """
    SQLAlchemy model for persisted bars.
    
    Unique constraint: (symbol, timeframe, bar_index)
    """
    __tablename__ = "bars"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Composite key fields
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)
    bar_index = Column(BigInteger, nullable=False, index=True)
    
    # Timestamps
    ts_start_ms = Column(BigInteger, nullable=False, index=True)
    ts_end_ms = Column(BigInteger, nullable=False)
    
    # OHLCV data
    open = Column(Float, nullable=True)  # Nullable for NaN representation
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    close = Column(Float, nullable=True)
    volume = Column(Float, default=0.0)
    
    # Metadata
    state = Column(String(20), default=BarStateDB.CONFIRMED.value)
    tick_count = Column(Integer, default=0)
    last_update_ms = Column(BigInteger, nullable=True)
    bar_hash = Column(String(80), nullable=True)
    
    # Audit
    created_at = Column(BigInteger, nullable=True)
    
    __table_args__ = (
        UniqueConstraint('symbol', 'timeframe', 'bar_index', name='uix_bar_identity'),
        Index('ix_bar_lookup', 'symbol', 'timeframe', 'ts_start_ms'),
    )
    
    def to_bar(self) -> Bar:
        """Convert database record to Bar model."""
        state_map = {
            "FORMING": BarState.FORMING,
            "CONFIRMED": BarState.CONFIRMED,
            "HISTORICAL": BarState.HISTORICAL,
        }
        
        return Bar(
            symbol=self.symbol,
            timeframe=self.timeframe,
            bar_index=self.bar_index,
            ts_start_ms=self.ts_start_ms,
            ts_end_ms=self.ts_end_ms,
            open=self.open,
            high=self.high,
            low=self.low,
            close=self.close,
            volume=self.volume,
            state=state_map.get(self.state, BarState.HISTORICAL),
            tick_count=self.tick_count,
            last_update_ms=self.last_update_ms,
        )
    
    @classmethod
    def from_bar(cls, bar: Bar) -> "BarRecord":
        """Create database record from Bar model."""
        return cls(
            symbol=bar.symbol,
            timeframe=bar.timeframe,
            bar_index=bar.bar_index,
            ts_start_ms=bar.ts_start_ms,
            ts_end_ms=bar.ts_end_ms,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
            state=bar.state.value.replace("BAR_", ""),  # Store without prefix
            tick_count=bar.tick_count,
            last_update_ms=bar.last_update_ms,
            bar_hash=bar.bar_hash,
            created_at=int(datetime.utcnow().timestamp() * 1000),
        )


class RawTickRecord(Base):
    """
    SQLAlchemy model for raw tick storage.
    Used for replay and debugging.
    """
    __tablename__ = "raw_ticks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    source = Column(String(20), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)
    ts_ms = Column(BigInteger, nullable=False, index=True)
    price = Column(Float, nullable=False)
    size = Column(Float, default=0.0)
    tick_hash = Column(String(32), nullable=True, unique=True)
    
    # Audit
    ingested_at = Column(BigInteger, nullable=True)
    
    __table_args__ = (
        Index('ix_tick_lookup', 'symbol', 'ts_ms'),
    )


class Database:
    """
    Database connection and session management.
    """
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize database connection.
        
        Args:
            database_url: SQLAlchemy database URL
        """
        settings = get_settings()
        self.database_url = database_url or settings.database_url
        
        # Create async engine
        self.engine = create_async_engine(
            self.database_url,
            echo=settings.debug_mode,
            future=True,
        )
        
        # Session factory
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    
    async def init_db(self) -> None:
        """Initialize database schema."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    async def drop_db(self) -> None:
        """Drop all tables (for testing)."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    
    def get_session(self) -> AsyncSession:
        """Get a new database session."""
        return self.async_session()
    
    async def close(self) -> None:
        """Close database connection."""
        await self.engine.dispose()


# Global database instance
_db: Optional[Database] = None


def get_database() -> Database:
    """Get the global database instance."""
    global _db
    if _db is None:
        _db = Database()
    return _db


async def init_database() -> Database:
    """Initialize and return the database."""
    db = get_database()
    await db.init_db()
    return db
