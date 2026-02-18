"""
Bar repository for CRUD operations on bars.
"""

from typing import Optional, List, Tuple
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
import structlog

from . import BarRecord, Database, get_database
from ..models import Bar, BarState


logger = structlog.get_logger()


class BarRepository:
    """
    Repository for bar persistence operations.
    
    Provides:
    - CRUD operations for bars
    - Query by symbol, timeframe, time range
    - Upsert for idempotent writes
    """
    
    def __init__(self, database: Optional[Database] = None):
        """
        Initialize repository.
        
        Args:
            database: Database instance (uses global if not provided)
        """
        self.db = database or get_database()
        self.logger = logger.bind(component="bar_repository")
    
    async def save_bar(self, bar: Bar) -> BarRecord:
        """
        Save a bar to the database.
        Uses upsert to handle conflicts on (symbol, timeframe, bar_index).
        """
        async with self.db.get_session() as session:
            record = BarRecord.from_bar(bar)
            
            # Check if record exists
            existing = await session.execute(
                select(BarRecord).where(
                    and_(
                        BarRecord.symbol == bar.symbol,
                        BarRecord.timeframe == bar.timeframe,
                        BarRecord.bar_index == bar.bar_index,
                    )
                )
            )
            existing_record = existing.scalar_one_or_none()
            
            if existing_record:
                # Update existing
                existing_record.open = record.open
                existing_record.high = record.high
                existing_record.low = record.low
                existing_record.close = record.close
                existing_record.volume = record.volume
                existing_record.state = record.state
                existing_record.tick_count = record.tick_count
                existing_record.last_update_ms = record.last_update_ms
                existing_record.bar_hash = record.bar_hash
                result = existing_record
            else:
                # Insert new
                session.add(record)
                result = record
            
            await session.commit()
            
            self.logger.debug(
                "bar_saved",
                symbol=bar.symbol,
                timeframe=bar.timeframe,
                bar_index=bar.bar_index,
            )
            
            return result
    
    async def save_bars(self, bars: List[Bar]) -> int:
        """
        Save multiple bars in a single transaction.
        
        Returns:
            Number of bars saved
        """
        if not bars:
            return 0
        
        async with self.db.get_session() as session:
            count = 0
            for bar in bars:
                record = BarRecord.from_bar(bar)
                
                # Check for existing
                existing = await session.execute(
                    select(BarRecord).where(
                        and_(
                            BarRecord.symbol == bar.symbol,
                            BarRecord.timeframe == bar.timeframe,
                            BarRecord.bar_index == bar.bar_index,
                        )
                    )
                )
                existing_record = existing.scalar_one_or_none()
                
                if existing_record:
                    existing_record.open = record.open
                    existing_record.high = record.high
                    existing_record.low = record.low
                    existing_record.close = record.close
                    existing_record.volume = record.volume
                    existing_record.state = record.state
                    existing_record.tick_count = record.tick_count
                    existing_record.last_update_ms = record.last_update_ms
                    existing_record.bar_hash = record.bar_hash
                else:
                    session.add(record)
                
                count += 1
            
            await session.commit()
            
            self.logger.info("bars_saved_batch", count=count)
            return count
    
    async def get_bar(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
    ) -> Optional[Bar]:
        """Get a specific bar by identity."""
        async with self.db.get_session() as session:
            result = await session.execute(
                select(BarRecord).where(
                    and_(
                        BarRecord.symbol == symbol,
                        BarRecord.timeframe == timeframe,
                        BarRecord.bar_index == bar_index,
                    )
                )
            )
            record = result.scalar_one_or_none()
            return record.to_bar() if record else None
    
    async def get_bars(
        self,
        symbol: str,
        timeframe: str,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[Bar]:
        """
        Get bars for a symbol/timeframe within a time range.
        
        Args:
            symbol: Stock symbol
            timeframe: Timeframe string
            start_ms: Start timestamp (inclusive)
            end_ms: End timestamp (exclusive)
            limit: Maximum bars to return
            offset: Offset for pagination
        """
        async with self.db.get_session() as session:
            query = select(BarRecord).where(
                and_(
                    BarRecord.symbol == symbol,
                    BarRecord.timeframe == timeframe,
                )
            )
            
            if start_ms is not None:
                query = query.where(BarRecord.ts_start_ms >= start_ms)
            if end_ms is not None:
                query = query.where(BarRecord.ts_start_ms < end_ms)
            
            # Default ordering is chronological ascending (oldest -> newest)
            query = query.order_by(BarRecord.ts_start_ms)
            query = query.limit(limit).offset(offset)
            
            result = await session.execute(query)
            records = result.scalars().all()
            
            return [r.to_bar() for r in records]

    async def get_recent_bars(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 1000,
    ) -> List[Bar]:
        """
        Get the most recent N bars for a symbol/timeframe in chronological order.
        This is useful for backfilling clients with the latest history.
        """
        if limit <= 0:
            return []

        async with self.db.get_session() as session:
            # Select latest N by timestamp descending, then return in chronological order
            query = select(BarRecord).where(
                and_(
                    BarRecord.symbol == symbol,
                    BarRecord.timeframe == timeframe,
                )
            ).order_by(BarRecord.ts_start_ms.desc()).limit(limit)

            result = await session.execute(query)
            records = result.scalars().all()

            # records are newest -> oldest, reverse for chronological
            records = list(reversed(records))
            return [r.to_bar() for r in records]
    
    async def get_bars_by_index_range(
        self,
        symbol: str,
        timeframe: str,
        start_index: int,
        end_index: int,
    ) -> List[Bar]:
        """Get bars by bar_index range."""
        async with self.db.get_session() as session:
            result = await session.execute(
                select(BarRecord).where(
                    and_(
                        BarRecord.symbol == symbol,
                        BarRecord.timeframe == timeframe,
                        BarRecord.bar_index >= start_index,
                        BarRecord.bar_index <= end_index,
                    )
                ).order_by(BarRecord.bar_index)
            )
            records = result.scalars().all()
            return [r.to_bar() for r in records]
    
    async def get_latest_bar(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get the most recent bar for a symbol/timeframe."""
        async with self.db.get_session() as session:
            result = await session.execute(
                select(BarRecord).where(
                    and_(
                        BarRecord.symbol == symbol,
                        BarRecord.timeframe == timeframe,
                    )
                ).order_by(BarRecord.ts_start_ms.desc()).limit(1)
            )
            record = result.scalar_one_or_none()
            return record.to_bar() if record else None
    
    async def get_earliest_bar(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get the earliest bar for a symbol/timeframe."""
        async with self.db.get_session() as session:
            result = await session.execute(
                select(BarRecord).where(
                    and_(
                        BarRecord.symbol == symbol,
                        BarRecord.timeframe == timeframe,
                    )
                ).order_by(BarRecord.ts_start_ms.asc()).limit(1)
            )
            record = result.scalar_one_or_none()
            return record.to_bar() if record else None
    
    async def count_bars(
        self,
        symbol: str,
        timeframe: str,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
    ) -> int:
        """Count bars for a symbol/timeframe."""
        async with self.db.get_session() as session:
            from sqlalchemy import func
            
            query = select(func.count(BarRecord.id)).where(
                and_(
                    BarRecord.symbol == symbol,
                    BarRecord.timeframe == timeframe,
                )
            )
            
            if start_ms is not None:
                query = query.where(BarRecord.ts_start_ms >= start_ms)
            if end_ms is not None:
                query = query.where(BarRecord.ts_start_ms < end_ms)
            
            result = await session.execute(query)
            return result.scalar() or 0
    
    async def delete_bars(
        self,
        symbol: str,
        timeframe: str,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
    ) -> int:
        """
        Delete bars for a symbol/timeframe.
        
        Returns:
            Number of bars deleted
        """
        async with self.db.get_session() as session:
            conditions = [
                BarRecord.symbol == symbol,
                BarRecord.timeframe == timeframe,
            ]
            
            if start_ms is not None:
                conditions.append(BarRecord.ts_start_ms >= start_ms)
            if end_ms is not None:
                conditions.append(BarRecord.ts_start_ms < end_ms)
            
            result = await session.execute(
                delete(BarRecord).where(and_(*conditions))
            )
            await session.commit()
            
            self.logger.info(
                "bars_deleted",
                symbol=symbol,
                timeframe=timeframe,
                count=result.rowcount,
            )
            
            return result.rowcount
    
    async def get_symbols(self) -> List[str]:
        """Get list of all symbols with stored bars."""
        async with self.db.get_session() as session:
            from sqlalchemy import distinct
            
            result = await session.execute(
                select(distinct(BarRecord.symbol))
            )
            return [r[0] for r in result.all()]
    
    async def get_timeframes_for_symbol(self, symbol: str) -> List[str]:
        """Get list of timeframes with data for a symbol."""
        async with self.db.get_session() as session:
            from sqlalchemy import distinct
            
            result = await session.execute(
                select(distinct(BarRecord.timeframe)).where(
                    BarRecord.symbol == symbol
                )
            )
            return [r[0] for r in result.all()]
