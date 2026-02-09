"""
V1 Provider Adapters
====================
Phase 5: Standardized provider interfaces for V1.

All providers must implement these interfaces to ensure:
1. Deterministic behavior in backtests
2. Clean separation of concerns
3. Easy provider swapping
4. Consistent error handling

Provider Types:
- QuoteProvider: Real-time and historical quotes
- NewsProvider: News headlines and sentiment
- BrokerProvider: Order execution and position management
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, Dict, List, Any, AsyncIterator, Protocol
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class Quote:
    """Option quote data."""
    symbol: str  # OCC symbol
    underlying: str
    strike: float
    expiry: date
    option_type: str  # "call" or "put"
    bid: float
    ask: float
    bid_size: int = 0
    ask_size: int = 0
    last: Optional[float] = None
    volume: int = 0
    open_interest: int = 0
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2
    
    @property
    def spread(self) -> float:
        return self.ask - self.bid
    
    @property
    def spread_pct(self) -> float:
        return self.spread / self.mid if self.mid > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "underlying": self.underlying,
            "strike": self.strike,
            "expiry": self.expiry.isoformat() if self.expiry else None,
            "option_type": self.option_type,
            "bid": self.bid,
            "ask": self.ask,
            "mid": self.mid,
            "spread": self.spread,
            "volume": self.volume,
            "open_interest": self.open_interest,
            "iv": self.iv,
            "delta": self.delta,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class StockQuote:
    """Stock quote data."""
    symbol: str
    bid: float
    ask: float
    last: float
    volume: int
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2


@dataclass
class NewsItem:
    """News headline item."""
    headline: str
    source: str
    symbols: List[str]
    sentiment: float  # -1 to 1
    published_at: datetime
    url: Optional[str] = None
    summary: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "headline": self.headline,
            "source": self.source,
            "symbols": self.symbols,
            "sentiment": self.sentiment,
            "published_at": self.published_at.isoformat(),
            "url": self.url,
        }


class OrderStatus(str, Enum):
    """Order status codes."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    FILLED = "filled"
    PARTIAL = "partial"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class Order:
    """Order data."""
    order_id: str
    symbol: str
    side: str  # "buy" or "sell"
    qty: int
    order_type: str  # "limit" or "market"
    limit_price: Optional[float]
    status: OrderStatus
    filled_qty: int = 0
    filled_price: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    filled_at: Optional[datetime] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side,
            "qty": self.qty,
            "order_type": self.order_type,
            "limit_price": self.limit_price,
            "status": self.status.value,
            "filled_qty": self.filled_qty,
            "filled_price": self.filled_price,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Position:
    """Position data."""
    symbol: str
    underlying: str
    qty: int
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    market_value: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "underlying": self.underlying,
            "qty": self.qty,
            "avg_cost": self.avg_cost,
            "current_price": self.current_price,
            "unrealized_pnl": self.unrealized_pnl,
            "market_value": self.market_value,
        }


# =============================================================================
# PROVIDER INTERFACES
# =============================================================================

class QuoteProvider(ABC):
    """
    Interface for quote data providers.
    
    Implementations: Alpaca, Yahoo Finance, Mock
    """
    
    @abstractmethod
    async def get_option_quote(self, symbol: str) -> Optional[Quote]:
        """Get quote for a single option."""
        pass
    
    @abstractmethod
    async def get_option_chain(
        self, underlying: str, expiry: Optional[date] = None
    ) -> List[Quote]:
        """Get option chain for underlying."""
        pass
    
    @abstractmethod
    async def get_stock_quote(self, symbol: str) -> Optional[StockQuote]:
        """Get quote for underlying stock."""
        pass
    
    @abstractmethod
    async def stream_quotes(
        self, symbols: List[str]
    ) -> AsyncIterator[Quote]:
        """Stream real-time quotes."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass
    
    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Check if provider is connected."""
        pass


class NewsProvider(ABC):
    """
    Interface for news/sentiment providers.
    
    Implementations: Finnhub, Benzinga, Mock
    """
    
    @abstractmethod
    async def get_news(
        self, symbol: str, limit: int = 10
    ) -> List[NewsItem]:
        """Get recent news for symbol."""
        pass
    
    @abstractmethod
    async def get_market_news(self, limit: int = 20) -> List[NewsItem]:
        """Get general market news."""
        pass
    
    @abstractmethod
    async def get_sentiment(self, symbol: str) -> float:
        """Get sentiment score for symbol (-1 to 1)."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass


class BrokerProvider(ABC):
    """
    Interface for broker/execution providers.
    
    Implementations: Alpaca, Paper, Mock
    """
    
    @abstractmethod
    async def submit_order(
        self,
        symbol: str,
        side: str,
        qty: int,
        order_type: str = "limit",
        limit_price: Optional[float] = None,
    ) -> Order:
        """Submit an order."""
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        pass
    
    @abstractmethod
    async def get_order(self, order_id: str) -> Optional[Order]:
        """Get order by ID."""
        pass
    
    @abstractmethod
    async def get_orders(
        self, status: Optional[OrderStatus] = None
    ) -> List[Order]:
        """Get all orders, optionally filtered by status."""
        pass
    
    @abstractmethod
    async def get_positions(self) -> List[Position]:
        """Get all positions."""
        pass
    
    @abstractmethod
    async def close_position(self, symbol: str) -> Order:
        """Close a position."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass
    
    @property
    @abstractmethod
    def is_paper(self) -> bool:
        """Check if this is paper trading."""
        pass


# =============================================================================
# MOCK PROVIDERS (for testing)
# =============================================================================

class MockQuoteProvider(QuoteProvider):
    """Mock quote provider for testing."""
    
    def __init__(self):
        self._quotes: Dict[str, Quote] = {}
        self._connected = True
    
    def set_quote(self, quote: Quote) -> None:
        """Set a mock quote."""
        self._quotes[quote.symbol] = quote
    
    async def get_option_quote(self, symbol: str) -> Optional[Quote]:
        return self._quotes.get(symbol)
    
    async def get_option_chain(
        self, underlying: str, expiry: Optional[date] = None
    ) -> List[Quote]:
        return [q for q in self._quotes.values() if q.underlying == underlying]
    
    async def get_stock_quote(self, symbol: str) -> Optional[StockQuote]:
        return StockQuote(
            symbol=symbol,
            bid=100.0,
            ask=100.05,
            last=100.02,
            volume=1000000,
        )
    
    async def stream_quotes(self, symbols: List[str]) -> AsyncIterator[Quote]:
        for symbol in symbols:
            if symbol in self._quotes:
                yield self._quotes[symbol]
    
    @property
    def name(self) -> str:
        return "MockQuote"
    
    @property
    def is_connected(self) -> bool:
        return self._connected


class MockNewsProvider(NewsProvider):
    """Mock news provider for testing."""
    
    def __init__(self):
        self._news: Dict[str, List[NewsItem]] = {}
        self._sentiment: Dict[str, float] = {}
    
    def set_news(self, symbol: str, items: List[NewsItem]) -> None:
        """Set mock news for symbol."""
        self._news[symbol] = items
    
    def set_sentiment(self, symbol: str, score: float) -> None:
        """Set mock sentiment for symbol."""
        self._sentiment[symbol] = score
    
    async def get_news(self, symbol: str, limit: int = 10) -> List[NewsItem]:
        return self._news.get(symbol, [])[:limit]
    
    async def get_market_news(self, limit: int = 20) -> List[NewsItem]:
        all_news = []
        for items in self._news.values():
            all_news.extend(items)
        return sorted(all_news, key=lambda x: x.published_at, reverse=True)[:limit]
    
    async def get_sentiment(self, symbol: str) -> float:
        return self._sentiment.get(symbol, 0.0)
    
    @property
    def name(self) -> str:
        return "MockNews"


class MockBrokerProvider(BrokerProvider):
    """Mock broker provider for testing."""
    
    def __init__(self, paper: bool = True):
        self._paper = paper
        self._orders: Dict[str, Order] = {}
        self._positions: Dict[str, Position] = {}
        self._order_counter = 0
    
    async def submit_order(
        self,
        symbol: str,
        side: str,
        qty: int,
        order_type: str = "limit",
        limit_price: Optional[float] = None,
    ) -> Order:
        self._order_counter += 1
        order_id = f"MOCK-{self._order_counter:06d}"
        
        # V1: Reject market orders
        if order_type == "market":
            return Order(
                order_id=order_id,
                symbol=symbol,
                side=side,
                qty=qty,
                order_type=order_type,
                limit_price=limit_price,
                status=OrderStatus.REJECTED,
                error="V1: Market orders not allowed",
            )
        
        # Simulate immediate fill for paper trading
        order = Order(
            order_id=order_id,
            symbol=symbol,
            side=side,
            qty=qty,
            order_type=order_type,
            limit_price=limit_price,
            status=OrderStatus.FILLED,
            filled_qty=qty,
            filled_price=limit_price,
            filled_at=datetime.utcnow(),
        )
        
        self._orders[order_id] = order
        return order
    
    async def cancel_order(self, order_id: str) -> bool:
        if order_id in self._orders:
            self._orders[order_id].status = OrderStatus.CANCELLED
            return True
        return False
    
    async def get_order(self, order_id: str) -> Optional[Order]:
        return self._orders.get(order_id)
    
    async def get_orders(
        self, status: Optional[OrderStatus] = None
    ) -> List[Order]:
        orders = list(self._orders.values())
        if status:
            orders = [o for o in orders if o.status == status]
        return orders
    
    async def get_positions(self) -> List[Position]:
        return list(self._positions.values())
    
    async def close_position(self, symbol: str) -> Order:
        pos = self._positions.get(symbol)
        if pos:
            return await self.submit_order(
                symbol=symbol,
                side="sell",
                qty=pos.qty,
                order_type="limit",
                limit_price=pos.current_price,
            )
        raise ValueError(f"No position for {symbol}")
    
    @property
    def name(self) -> str:
        return "MockBroker"
    
    @property
    def is_paper(self) -> bool:
        return self._paper


# =============================================================================
# PROVIDER REGISTRY
# =============================================================================

class ProviderRegistry:
    """
    Central registry for all providers.
    
    Ensures only one instance of each provider type is active.
    """
    
    def __init__(self):
        self._quote_provider: Optional[QuoteProvider] = None
        self._news_provider: Optional[NewsProvider] = None
        self._broker_provider: Optional[BrokerProvider] = None
    
    def register_quote_provider(self, provider: QuoteProvider) -> None:
        """Register quote provider."""
        self._quote_provider = provider
        logger.info(f"Registered quote provider: {provider.name}")
    
    def register_news_provider(self, provider: NewsProvider) -> None:
        """Register news provider."""
        self._news_provider = provider
        logger.info(f"Registered news provider: {provider.name}")
    
    def register_broker_provider(self, provider: BrokerProvider) -> None:
        """Register broker provider."""
        if not provider.is_paper:
            raise ValueError("V1 only allows paper trading providers")
        self._broker_provider = provider
        logger.info(f"Registered broker provider: {provider.name}")
    
    @property
    def quotes(self) -> QuoteProvider:
        if not self._quote_provider:
            raise RuntimeError("No quote provider registered")
        return self._quote_provider
    
    @property
    def news(self) -> NewsProvider:
        if not self._news_provider:
            raise RuntimeError("No news provider registered")
        return self._news_provider
    
    @property
    def broker(self) -> BrokerProvider:
        if not self._broker_provider:
            raise RuntimeError("No broker provider registered")
        return self._broker_provider
    
    def status(self) -> Dict[str, Any]:
        """Get status of all providers."""
        return {
            "quote_provider": self._quote_provider.name if self._quote_provider else None,
            "quote_connected": self._quote_provider.is_connected if self._quote_provider else False,
            "news_provider": self._news_provider.name if self._news_provider else None,
            "broker_provider": self._broker_provider.name if self._broker_provider else None,
            "broker_paper": self._broker_provider.is_paper if self._broker_provider else None,
        }


# Singleton registry
_registry: Optional[ProviderRegistry] = None


def get_provider_registry() -> ProviderRegistry:
    """Get the singleton provider registry."""
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
    return _registry


def reset_provider_registry() -> None:
    """Reset the provider registry (for testing)."""
    global _registry
    _registry = None
