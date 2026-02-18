"""
News & Sentiment Provider

Provides news sentiment data from multiple sources:
- Finnhub (primary for market news)
- yfinance (backup for earnings/fundamentals)
- Optional: NewsAPI for headlines

Use case:
1. Pre-trade gating: Don't open positions with negative sentiment
2. Monitoring: Exit if shock headlines appear
3. Earnings blackout: Block trades near earnings
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Callable
from enum import Enum
import asyncio
import logging
import os
import json
import hashlib

logger = logging.getLogger(__name__)


# ============================================================================
# MODELS
# ============================================================================

class SentimentLevel(str, Enum):
    """Sentiment classification."""
    VERY_NEGATIVE = "very_negative"  # -1.0 to -0.6
    NEGATIVE = "negative"            # -0.6 to -0.2
    NEUTRAL = "neutral"              # -0.2 to 0.2
    POSITIVE = "positive"            # 0.2 to 0.6
    VERY_POSITIVE = "very_positive"  # 0.6 to 1.0


class NewsCategory(str, Enum):
    """News category classification."""
    EARNINGS = "earnings"
    GUIDANCE = "guidance"
    ANALYST_RATING = "analyst_rating"
    MERGER = "merger"
    REGULATORY = "regulatory"
    PRODUCT = "product"
    LAWSUIT = "lawsuit"
    GENERAL = "general"
    MACRO = "macro"


@dataclass
class NewsItem:
    """A single news item."""
    headline: str
    summary: Optional[str] = None
    source: str = "unknown"
    url: Optional[str] = None
    published_at: Optional[datetime] = None
    symbol: Optional[str] = None
    category: NewsCategory = NewsCategory.GENERAL
    sentiment_score: float = 0.0  # -1 to 1
    sentiment_level: SentimentLevel = SentimentLevel.NEUTRAL
    is_shock: bool = False  # True if large move expected
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "headline": self.headline,
            "summary": self.summary,
            "source": self.source,
            "url": self.url,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "symbol": self.symbol,
            "category": self.category.value,
            "sentiment_score": self.sentiment_score,
            "sentiment_level": self.sentiment_level.value,
            "is_shock": self.is_shock,
        }


@dataclass
class EarningsEvent:
    """An earnings event."""
    symbol: str
    date: date
    time: str = "unknown"  # BMO/AMC/--
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None
    surprise_pct: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "date": self.date.isoformat(),
            "time": self.time,
            "eps_estimate": self.eps_estimate,
            "eps_actual": self.eps_actual,
            "surprise_pct": self.surprise_pct,
        }


@dataclass
class SentimentSnapshot:
    """Snapshot of sentiment for a symbol."""
    symbol: str
    timestamp: datetime
    overall_score: float = 0.0  # -1 to 1
    overall_level: SentimentLevel = SentimentLevel.NEUTRAL
    news_count_24h: int = 0
    shock_news: List[NewsItem] = field(default_factory=list)
    recent_headlines: List[str] = field(default_factory=list)
    earnings_within: Optional[int] = None  # Days until next earnings
    is_blackout: bool = False  # True if in earnings blackout
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "overall_score": self.overall_score,
            "overall_level": self.overall_level.value,
            "news_count_24h": self.news_count_24h,
            "shock_news": [n.to_dict() for n in self.shock_news],
            "recent_headlines": self.recent_headlines[:5],
            "earnings_within": self.earnings_within,
            "is_blackout": self.is_blackout,
        }


@dataclass
class MarketSentiment:
    """Overall market sentiment."""
    timestamp: datetime
    market_score: float = 0.0  # -1 to 1
    market_level: SentimentLevel = SentimentLevel.NEUTRAL
    vix_level: Optional[float] = None
    fear_greed_index: Optional[int] = None
    news_velocity: str = "normal"  # low/normal/high
    trending_topics: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "market_score": self.market_score,
            "market_level": self.market_level.value,
            "vix_level": self.vix_level,
            "fear_greed_index": self.fear_greed_index,
            "news_velocity": self.news_velocity,
            "trending_topics": self.trending_topics,
        }


# ============================================================================
# BASE PROVIDER
# ============================================================================

class NewsProviderBase:
    """Base class for news providers."""
    
    def __init__(self, name: str):
        self.name = name
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(minutes=5)
    
    def _cache_key(self, *args) -> str:
        return hashlib.md5(str(args).encode()).hexdigest()
    
    def _get_cached(self, key: str) -> Optional[Any]:
        if key in self._cache:
            data, ts = self._cache[key]
            if datetime.utcnow() - ts < self._cache_ttl:
                return data
        return None
    
    def _set_cached(self, key: str, data: Any):
        self._cache[key] = (data, datetime.utcnow())
    
    async def get_news(self, symbol: str, hours: int = 24) -> List[NewsItem]:
        raise NotImplementedError
    
    async def get_earnings(self, symbol: str) -> Optional[EarningsEvent]:
        raise NotImplementedError
    
    async def get_sentiment(self, symbol: str) -> SentimentSnapshot:
        raise NotImplementedError


# ============================================================================
# FINNHUB PROVIDER
# ============================================================================

class FinnhubProvider(NewsProviderBase):
    """Finnhub news provider (requires API key)."""
    
    def __init__(self, api_key: Optional[str] = None):
        super().__init__("finnhub")
        self._api_key = api_key or os.environ.get("FINNHUB_API_KEY", "")
        self._base_url = "https://finnhub.io/api/v1"
        
        if not self._api_key:
            logger.warning("Finnhub API key not configured")
    
    async def get_news(self, symbol: str, hours: int = 24) -> List[NewsItem]:
        """Get news for a symbol."""
        if not self._api_key:
            return []
        
        cache_key = self._cache_key("news", symbol, hours)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            import aiohttp
            
            # Finnhub company news endpoint
            to_date = datetime.utcnow()
            from_date = to_date - timedelta(hours=hours)
            
            url = f"{self._base_url}/company-news"
            params = {
                "symbol": symbol,
                "from": from_date.strftime("%Y-%m-%d"),
                "to": to_date.strftime("%Y-%m-%d"),
                "token": self._api_key,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        logger.error(f"Finnhub error: {resp.status}")
                        return []
                    
                    data = await resp.json()
            
            items = []
            for article in data[:20]:  # Limit to recent 20
                items.append(NewsItem(
                    headline=article.get("headline", ""),
                    summary=article.get("summary"),
                    source=article.get("source", "finnhub"),
                    url=article.get("url"),
                    published_at=datetime.fromtimestamp(article.get("datetime", 0)),
                    symbol=symbol,
                    category=self._categorize(article.get("category", "")),
                    sentiment_score=self._estimate_sentiment(article.get("headline", "")),
                ))
            
            for item in items:
                item.sentiment_level = self._score_to_level(item.sentiment_score)
                item.is_shock = abs(item.sentiment_score) > 0.6
            
            self._set_cached(cache_key, items)
            return items
            
        except Exception as e:
            logger.error(f"Finnhub news error: {e}")
            return []
    
    async def get_earnings(self, symbol: str) -> Optional[EarningsEvent]:
        """Get upcoming earnings for a symbol."""
        if not self._api_key:
            return None
        
        cache_key = self._cache_key("earnings", symbol)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            import aiohttp
            
            url = f"{self._base_url}/calendar/earnings"
            from_date = date.today()
            to_date = from_date + timedelta(days=30)
            
            params = {
                "symbol": symbol,
                "from": from_date.isoformat(),
                "to": to_date.isoformat(),
                "token": self._api_key,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        return None
                    
                    data = await resp.json()
            
            earnings = data.get("earningsCalendar", [])
            if not earnings:
                return None
            
            next_earn = earnings[0]
            event = EarningsEvent(
                symbol=symbol,
                date=datetime.strptime(next_earn.get("date", ""), "%Y-%m-%d").date(),
                time=next_earn.get("hour", "unknown"),
                eps_estimate=next_earn.get("epsEstimate"),
                eps_actual=next_earn.get("epsActual"),
            )
            
            self._set_cached(cache_key, event)
            return event
            
        except Exception as e:
            logger.error(f"Finnhub earnings error: {e}")
            return None
    
    async def get_sentiment(self, symbol: str) -> SentimentSnapshot:
        """Get sentiment snapshot for a symbol."""
        news = await self.get_news(symbol, hours=24)
        earnings = await self.get_earnings(symbol)
        
        # Calculate overall sentiment
        if news:
            avg_score = sum(n.sentiment_score for n in news) / len(news)
        else:
            avg_score = 0.0
        
        # Check for earnings blackout (within 3 days)
        earnings_within = None
        is_blackout = False
        if earnings:
            days_until = (earnings.date - date.today()).days
            if days_until >= 0:
                earnings_within = days_until
                is_blackout = days_until <= 3
        
        return SentimentSnapshot(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            overall_score=avg_score,
            overall_level=self._score_to_level(avg_score),
            news_count_24h=len(news),
            shock_news=[n for n in news if n.is_shock],
            recent_headlines=[n.headline for n in news[:5]],
            earnings_within=earnings_within,
            is_blackout=is_blackout,
        )
    
    def _categorize(self, category: str) -> NewsCategory:
        cat_lower = category.lower()
        if "earning" in cat_lower:
            return NewsCategory.EARNINGS
        if "analyst" in cat_lower or "rating" in cat_lower:
            return NewsCategory.ANALYST_RATING
        if "merger" in cat_lower or "acquisition" in cat_lower:
            return NewsCategory.MERGER
        if "lawsuit" in cat_lower or "legal" in cat_lower:
            return NewsCategory.LAWSUIT
        return NewsCategory.GENERAL
    
    def _estimate_sentiment(self, headline: str) -> float:
        """Simple keyword-based sentiment estimation."""
        headline = headline.lower()
        
        positive = ["surge", "rally", "beat", "strong", "growth", "gains", "bullish", "upgrade", "record"]
        negative = ["crash", "plunge", "miss", "weak", "decline", "losses", "bearish", "downgrade", "lawsuit", "investigation"]
        
        score = 0.0
        for word in positive:
            if word in headline:
                score += 0.3
        for word in negative:
            if word in headline:
                score -= 0.3
        
        return max(-1.0, min(1.0, score))
    
    def _score_to_level(self, score: float) -> SentimentLevel:
        if score <= -0.6:
            return SentimentLevel.VERY_NEGATIVE
        if score <= -0.2:
            return SentimentLevel.NEGATIVE
        if score <= 0.2:
            return SentimentLevel.NEUTRAL
        if score <= 0.6:
            return SentimentLevel.POSITIVE
        return SentimentLevel.VERY_POSITIVE


# ============================================================================
# YFINANCE PROVIDER (Backup)
# ============================================================================

class YFinanceProvider(NewsProviderBase):
    """yfinance provider (no API key needed)."""
    
    def __init__(self):
        super().__init__("yfinance")
        self._yf = None
    
    def _get_yf(self):
        if self._yf is None:
            try:
                import yfinance as yf
                self._yf = yf
            except ImportError:
                logger.warning("yfinance not installed")
        return self._yf
    
    async def get_news(self, symbol: str, hours: int = 24) -> List[NewsItem]:
        """Get news from yfinance."""
        yf = self._get_yf()
        if not yf:
            return []
        
        cache_key = self._cache_key("news", symbol)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            ticker = yf.Ticker(symbol)
            news = ticker.news or []
            
            items = []
            for article in news[:10]:
                published = article.get("providerPublishTime", 0)
                items.append(NewsItem(
                    headline=article.get("title", ""),
                    summary=None,
                    source=article.get("publisher", "yfinance"),
                    url=article.get("link"),
                    published_at=datetime.fromtimestamp(published) if published else None,
                    symbol=symbol,
                ))
            
            self._set_cached(cache_key, items)
            return items
            
        except Exception as e:
            logger.error(f"yfinance news error: {e}")
            return []
    
    async def get_earnings(self, symbol: str) -> Optional[EarningsEvent]:
        """Get earnings from yfinance."""
        yf = self._get_yf()
        if not yf:
            return None
        
        try:
            ticker = yf.Ticker(symbol)
            calendar = ticker.calendar
            
            if calendar is None or calendar.empty:
                return None
            
            # yfinance calendar format varies
            if "Earnings Date" in calendar.index:
                earn_date = calendar.loc["Earnings Date"]
                if hasattr(earn_date, "iloc"):
                    earn_date = earn_date.iloc[0]
                
                if hasattr(earn_date, "date"):
                    return EarningsEvent(
                        symbol=symbol,
                        date=earn_date.date(),
                    )
            
            return None
            
        except Exception as e:
            logger.debug(f"yfinance earnings error: {e}")
            return None
    
    async def get_sentiment(self, symbol: str) -> SentimentSnapshot:
        """Basic sentiment from yfinance."""
        news = await self.get_news(symbol)
        earnings = await self.get_earnings(symbol)
        
        earnings_within = None
        is_blackout = False
        if earnings:
            days = (earnings.date - date.today()).days
            if days >= 0:
                earnings_within = days
                is_blackout = days <= 3
        
        return SentimentSnapshot(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            news_count_24h=len(news),
            recent_headlines=[n.headline for n in news[:5]],
            earnings_within=earnings_within,
            is_blackout=is_blackout,
        )


# ============================================================================
# COMPOSITE PROVIDER
# ============================================================================

class NewsProvider:
    """
    Composite news provider - uses best available source.
    
    Priority:
    1. Finnhub (if API key available)
    2. yfinance (fallback)
    """
    
    def __init__(self):
        self._finnhub = FinnhubProvider()
        self._yfinance = YFinanceProvider()
        self._primary = self._finnhub if self._finnhub._api_key else self._yfinance
        logger.info(f"NewsProvider initialized with primary: {self._primary.name}")
    
    @property
    def provider_name(self) -> str:
        return self._primary.name
    
    async def get_news(self, symbol: str, hours: int = 24) -> List[NewsItem]:
        """Get news, falling back if primary fails."""
        try:
            items = await self._primary.get_news(symbol, hours)
            if items:
                return items
        except Exception as e:
            logger.warning(f"Primary news failed: {e}")
        
        # Fallback
        if self._primary != self._yfinance:
            return await self._yfinance.get_news(symbol, hours)
        return []
    
    async def get_earnings(self, symbol: str) -> Optional[EarningsEvent]:
        """Get earnings, falling back if primary fails."""
        try:
            event = await self._primary.get_earnings(symbol)
            if event:
                return event
        except Exception:
            pass
        
        if self._primary != self._yfinance:
            return await self._yfinance.get_earnings(symbol)
        return None
    
    async def get_sentiment(self, symbol: str) -> SentimentSnapshot:
        """Get sentiment snapshot."""
        return await self._primary.get_sentiment(symbol)
    
    async def get_batch_sentiment(self, symbols: List[str]) -> Dict[str, SentimentSnapshot]:
        """Get sentiment for multiple symbols."""
        results = {}
        for symbol in symbols:
            try:
                results[symbol] = await self.get_sentiment(symbol)
            except Exception as e:
                logger.error(f"Sentiment error for {symbol}: {e}")
                results[symbol] = SentimentSnapshot(
                    symbol=symbol,
                    timestamp=datetime.utcnow(),
                )
        return results
    
    async def get_market_sentiment(self) -> MarketSentiment:
        """Get overall market sentiment."""
        # Use SPY as proxy
        spy_sentiment = await self.get_sentiment("SPY")
        
        return MarketSentiment(
            timestamp=datetime.utcnow(),
            market_score=spy_sentiment.overall_score,
            market_level=spy_sentiment.overall_level,
            news_velocity="high" if spy_sentiment.news_count_24h > 20 else "normal",
        )
    
    def get_shock_symbols(self, sentiments: Dict[str, SentimentSnapshot]) -> List[str]:
        """Get symbols with shock news."""
        return [
            sym for sym, sent in sentiments.items()
            if sent.shock_news or sent.overall_score < -0.5
        ]
    
    def get_blackout_symbols(self, sentiments: Dict[str, SentimentSnapshot]) -> List[str]:
        """Get symbols in earnings blackout."""
        return [sym for sym, sent in sentiments.items() if sent.is_blackout]


# ============================================================================
# Singleton
# ============================================================================

_provider: Optional[NewsProvider] = None


def get_news_provider() -> NewsProvider:
    global _provider
    if _provider is None:
        _provider = NewsProvider()
    return _provider
