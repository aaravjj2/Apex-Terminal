"""
Tests for V1 Provider Adapters
==============================
Phase 5: Provider interface tests.
"""

import pytest
from datetime import datetime, date
from services.autopilot.v1_providers import (
    Quote, StockQuote, NewsItem, Order, Position, OrderStatus,
    MockQuoteProvider, MockNewsProvider, MockBrokerProvider,
    ProviderRegistry, get_provider_registry, reset_provider_registry,
)


# =============================================================================
# DATA MODEL TESTS
# =============================================================================

class TestQuote:
    """Tests for Quote data model."""
    
    def test_quote_mid_calculation(self):
        """Mid price is average of bid and ask."""
        quote = Quote(
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            strike=200.0,
            expiry=date(2025, 1, 17),
            option_type="call",
            bid=5.00,
            ask=5.20,
        )
        assert quote.mid == 5.10
    
    def test_quote_spread_calculation(self):
        """Spread is ask minus bid."""
        quote = Quote(
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            strike=200.0,
            expiry=date(2025, 1, 17),
            option_type="call",
            bid=5.00,
            ask=5.20,
        )
        assert pytest.approx(quote.spread, rel=1e-3) == 0.20
    
    def test_quote_spread_pct(self):
        """Spread percent is spread divided by mid."""
        quote = Quote(
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            strike=200.0,
            expiry=date(2025, 1, 17),
            option_type="call",
            bid=5.00,
            ask=5.20,
        )
        assert pytest.approx(quote.spread_pct, rel=1e-3) == 0.0392
    
    def test_quote_to_dict(self):
        """Quote serializes to dict correctly."""
        quote = Quote(
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            strike=200.0,
            expiry=date(2025, 1, 17),
            option_type="call",
            bid=5.00,
            ask=5.20,
            volume=1000,
            delta=0.45,
        )
        d = quote.to_dict()
        assert d["symbol"] == "AAPL250117C00200000"
        assert d["underlying"] == "AAPL"
        assert d["strike"] == 200.0
        assert d["bid"] == 5.00
        assert d["ask"] == 5.20
        assert d["delta"] == 0.45


class TestNewsItem:
    """Tests for NewsItem data model."""
    
    def test_news_item_to_dict(self):
        """NewsItem serializes correctly."""
        item = NewsItem(
            headline="AAPL earnings beat expectations",
            source="Reuters",
            symbols=["AAPL"],
            sentiment=0.8,
            published_at=datetime(2025, 1, 10, 14, 30, 0),
            url="https://example.com/news",
        )
        d = item.to_dict()
        assert d["headline"] == "AAPL earnings beat expectations"
        assert d["sentiment"] == 0.8
        assert "AAPL" in d["symbols"]


class TestOrder:
    """Tests for Order data model."""
    
    def test_order_to_dict(self):
        """Order serializes correctly."""
        order = Order(
            order_id="TEST-001",
            symbol="AAPL250117C00200000",
            side="buy",
            qty=1,
            order_type="limit",
            limit_price=5.10,
            status=OrderStatus.FILLED,
            filled_qty=1,
            filled_price=5.10,
        )
        d = order.to_dict()
        assert d["order_id"] == "TEST-001"
        assert d["status"] == "filled"
        assert d["filled_price"] == 5.10


# =============================================================================
# MOCK QUOTE PROVIDER TESTS
# =============================================================================

class TestMockQuoteProvider:
    """Tests for MockQuoteProvider."""
    
    @pytest.fixture
    def provider(self):
        return MockQuoteProvider()
    
    @pytest.mark.asyncio
    async def test_get_option_quote_not_found(self, provider):
        """Returns None for unknown symbols."""
        quote = await provider.get_option_quote("UNKNOWN")
        assert quote is None
    
    @pytest.mark.asyncio
    async def test_set_and_get_quote(self, provider):
        """Can set and retrieve quotes."""
        test_quote = Quote(
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            strike=200.0,
            expiry=date(2025, 1, 17),
            option_type="call",
            bid=5.00,
            ask=5.20,
        )
        provider.set_quote(test_quote)
        
        quote = await provider.get_option_quote("AAPL250117C00200000")
        assert quote is not None
        assert quote.symbol == "AAPL250117C00200000"
        assert quote.bid == 5.00
    
    @pytest.mark.asyncio
    async def test_get_option_chain(self, provider):
        """Can get option chain for underlying."""
        for i, strike in enumerate([190, 195, 200, 205, 210]):
            quote = Quote(
                symbol=f"AAPL250117C00{strike}000",
                underlying="AAPL",
                strike=float(strike),
                expiry=date(2025, 1, 17),
                option_type="call",
                bid=5.00 - i * 0.5,
                ask=5.20 - i * 0.5,
            )
            provider.set_quote(quote)
        
        chain = await provider.get_option_chain("AAPL")
        assert len(chain) == 5
    
    @pytest.mark.asyncio
    async def test_get_stock_quote(self, provider):
        """Can get stock quote."""
        quote = await provider.get_stock_quote("AAPL")
        assert quote is not None
        assert quote.symbol == "AAPL"
        assert quote.bid > 0
    
    def test_provider_name(self, provider):
        """Provider has correct name."""
        assert provider.name == "MockQuote"
    
    def test_provider_is_connected(self, provider):
        """Provider reports connection status."""
        assert provider.is_connected is True


# =============================================================================
# MOCK NEWS PROVIDER TESTS
# =============================================================================

class TestMockNewsProvider:
    """Tests for MockNewsProvider."""
    
    @pytest.fixture
    def provider(self):
        return MockNewsProvider()
    
    @pytest.mark.asyncio
    async def test_get_news_empty(self, provider):
        """Returns empty list for unknown symbols."""
        news = await provider.get_news("UNKNOWN")
        assert news == []
    
    @pytest.mark.asyncio
    async def test_set_and_get_news(self, provider):
        """Can set and retrieve news."""
        items = [
            NewsItem(
                headline="AAPL beats earnings",
                source="Reuters",
                symbols=["AAPL"],
                sentiment=0.8,
                published_at=datetime.utcnow(),
            ),
            NewsItem(
                headline="AAPL announces buyback",
                source="Bloomberg",
                symbols=["AAPL"],
                sentiment=0.6,
                published_at=datetime.utcnow(),
            ),
        ]
        provider.set_news("AAPL", items)
        
        news = await provider.get_news("AAPL")
        assert len(news) == 2
        assert "beats earnings" in news[0].headline
    
    @pytest.mark.asyncio
    async def test_get_news_with_limit(self, provider):
        """Respects limit parameter."""
        items = [
            NewsItem(
                headline=f"News {i}",
                source="Test",
                symbols=["AAPL"],
                sentiment=0.5,
                published_at=datetime.utcnow(),
            )
            for i in range(10)
        ]
        provider.set_news("AAPL", items)
        
        news = await provider.get_news("AAPL", limit=3)
        assert len(news) == 3
    
    @pytest.mark.asyncio
    async def test_get_sentiment_default(self, provider):
        """Returns 0.0 for unknown symbols."""
        sentiment = await provider.get_sentiment("UNKNOWN")
        assert sentiment == 0.0
    
    @pytest.mark.asyncio
    async def test_set_and_get_sentiment(self, provider):
        """Can set and retrieve sentiment."""
        provider.set_sentiment("AAPL", 0.75)
        sentiment = await provider.get_sentiment("AAPL")
        assert sentiment == 0.75
    
    def test_provider_name(self, provider):
        """Provider has correct name."""
        assert provider.name == "MockNews"


# =============================================================================
# MOCK BROKER PROVIDER TESTS
# =============================================================================

class TestMockBrokerProvider:
    """Tests for MockBrokerProvider."""
    
    @pytest.fixture
    def provider(self):
        return MockBrokerProvider(paper=True)
    
    @pytest.mark.asyncio
    async def test_submit_limit_order_fills(self, provider):
        """Limit orders fill immediately in mock."""
        order = await provider.submit_order(
            symbol="AAPL250117C00200000",
            side="buy",
            qty=1,
            order_type="limit",
            limit_price=5.10,
        )
        assert order.status == OrderStatus.FILLED
        assert order.filled_qty == 1
        assert order.filled_price == 5.10
    
    @pytest.mark.asyncio
    async def test_v1_rejects_market_orders(self, provider):
        """V1: Market orders are rejected."""
        order = await provider.submit_order(
            symbol="AAPL250117C00200000",
            side="buy",
            qty=1,
            order_type="market",
        )
        assert order.status == OrderStatus.REJECTED
        assert "V1" in order.error
        assert "Market orders" in order.error
    
    @pytest.mark.asyncio
    async def test_cancel_order(self, provider):
        """Can cancel orders."""
        order = await provider.submit_order(
            symbol="AAPL250117C00200000",
            side="buy",
            qty=1,
            order_type="limit",
            limit_price=5.10,
        )
        
        result = await provider.cancel_order(order.order_id)
        assert result is True
        
        cancelled = await provider.get_order(order.order_id)
        assert cancelled.status == OrderStatus.CANCELLED
    
    @pytest.mark.asyncio
    async def test_cancel_unknown_order(self, provider):
        """Cancel returns False for unknown orders."""
        result = await provider.cancel_order("UNKNOWN-ORDER")
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_orders(self, provider):
        """Can get all orders."""
        await provider.submit_order("A", "buy", 1, "limit", 5.0)
        await provider.submit_order("B", "buy", 1, "limit", 6.0)
        
        orders = await provider.get_orders()
        assert len(orders) == 2
    
    @pytest.mark.asyncio
    async def test_get_orders_by_status(self, provider):
        """Can filter orders by status."""
        await provider.submit_order("A", "buy", 1, "limit", 5.0)
        order2 = await provider.submit_order("B", "buy", 1, "limit", 6.0)
        await provider.cancel_order(order2.order_id)
        
        filled = await provider.get_orders(status=OrderStatus.FILLED)
        assert len(filled) == 1
        
        cancelled = await provider.get_orders(status=OrderStatus.CANCELLED)
        assert len(cancelled) == 1
    
    def test_provider_name(self, provider):
        """Provider has correct name."""
        assert provider.name == "MockBroker"
    
    def test_provider_is_paper(self, provider):
        """Provider reports paper mode correctly."""
        assert provider.is_paper is True
        
        live_provider = MockBrokerProvider(paper=False)
        assert live_provider.is_paper is False


# =============================================================================
# PROVIDER REGISTRY TESTS
# =============================================================================

class TestProviderRegistry:
    """Tests for ProviderRegistry."""
    
    @pytest.fixture
    def registry(self):
        return ProviderRegistry()
    
    def test_register_quote_provider(self, registry):
        """Can register quote provider."""
        provider = MockQuoteProvider()
        registry.register_quote_provider(provider)
        assert registry.quotes == provider
    
    def test_register_news_provider(self, registry):
        """Can register news provider."""
        provider = MockNewsProvider()
        registry.register_news_provider(provider)
        assert registry.news == provider
    
    def test_register_broker_provider(self, registry):
        """Can register paper broker provider."""
        provider = MockBrokerProvider(paper=True)
        registry.register_broker_provider(provider)
        assert registry.broker == provider
    
    def test_v1_rejects_live_broker(self, registry):
        """V1: Only paper brokers allowed."""
        live_provider = MockBrokerProvider(paper=False)
        with pytest.raises(ValueError, match="V1 only allows paper"):
            registry.register_broker_provider(live_provider)
    
    def test_quotes_raises_if_not_registered(self, registry):
        """Raises if quote provider not registered."""
        with pytest.raises(RuntimeError, match="No quote provider"):
            _ = registry.quotes
    
    def test_news_raises_if_not_registered(self, registry):
        """Raises if news provider not registered."""
        with pytest.raises(RuntimeError, match="No news provider"):
            _ = registry.news
    
    def test_broker_raises_if_not_registered(self, registry):
        """Raises if broker provider not registered."""
        with pytest.raises(RuntimeError, match="No broker provider"):
            _ = registry.broker
    
    def test_status(self, registry):
        """Status reports provider info."""
        quote = MockQuoteProvider()
        news = MockNewsProvider()
        broker = MockBrokerProvider(paper=True)
        
        registry.register_quote_provider(quote)
        registry.register_news_provider(news)
        registry.register_broker_provider(broker)
        
        status = registry.status()
        assert status["quote_provider"] == "MockQuote"
        assert status["quote_connected"] is True
        assert status["news_provider"] == "MockNews"
        assert status["broker_provider"] == "MockBroker"
        assert status["broker_paper"] is True


class TestGlobalRegistry:
    """Tests for global registry functions."""
    
    def test_get_provider_registry_singleton(self):
        """Registry is a singleton."""
        reset_provider_registry()
        
        r1 = get_provider_registry()
        r2 = get_provider_registry()
        assert r1 is r2
    
    def test_reset_provider_registry(self):
        """Can reset registry."""
        reset_provider_registry()
        r1 = get_provider_registry()
        
        reset_provider_registry()
        r2 = get_provider_registry()
        
        assert r1 is not r2
