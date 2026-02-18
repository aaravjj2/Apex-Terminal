"""
News Provider and Sentiment Engine

Integrates with Finnhub for:
- Market news
- Company-specific news
- Sentiment analysis
- News impact scoring
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


class NewsCategory(str, Enum):
    """News categories for filtering."""
    GENERAL = "general"
    FOREX = "forex"
    CRYPTO = "crypto"
    MERGER = "merger"
    EARNINGS = "earnings"
    IPO = "ipo"
    FDA = "fda"
    ANALYST = "analyst"
    OTHER = "other"


class SentimentBucket(str, Enum):
    """Sentiment classification buckets."""
    VERY_BULLISH = "very_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    VERY_BEARISH = "very_bearish"


class RecencyBucket(str, Enum):
    """News recency buckets for weighting."""
    BREAKING = "breaking"      # < 1 hour
    RECENT = "recent"          # 1-6 hours
    TODAY = "today"            # 6-24 hours
    STALE = "stale"            # 1-3 days
    ARCHIVE = "archive"        # > 3 days


@dataclass
class NewsArticle:
    """A single news article."""
    id: str
    headline: str
    summary: str
    source: str
    url: str
    published_at: datetime
    category: NewsCategory
    symbols: List[str]
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def recency_bucket(self) -> RecencyBucket:
        """Get recency bucket based on age."""
        age = datetime.utcnow() - self.published_at
        
        if age < timedelta(hours=1):
            return RecencyBucket.BREAKING
        elif age < timedelta(hours=6):
            return RecencyBucket.RECENT
        elif age < timedelta(hours=24):
            return RecencyBucket.TODAY
        elif age < timedelta(days=3):
            return RecencyBucket.STALE
        else:
            return RecencyBucket.ARCHIVE
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "headline": self.headline,
            "summary": self.summary,
            "source": self.source,
            "url": self.url,
            "published_at": self.published_at.isoformat(),
            "category": self.category.value,
            "symbols": self.symbols,
            "recency": self.recency_bucket.value,
        }


@dataclass
class SentimentScore:
    """Sentiment analysis result for a piece of content."""
    sentiment_score: float      # -1.0 to 1.0
    confidence: float           # 0.0 to 1.0
    bucket: SentimentBucket
    article_count: int
    positive_count: int
    negative_count: int
    neutral_count: int
    recency_weight: float       # Weight based on article recency
    
    @staticmethod
    def from_score(score: float, confidence: float = 1.0, article_count: int = 1) -> "SentimentScore":
        """Create SentimentScore from raw score."""
        if score >= 0.6:
            bucket = SentimentBucket.VERY_BULLISH
        elif score >= 0.2:
            bucket = SentimentBucket.BULLISH
        elif score > -0.2:
            bucket = SentimentBucket.NEUTRAL
        elif score > -0.6:
            bucket = SentimentBucket.BEARISH
        else:
            bucket = SentimentBucket.VERY_BEARISH
        
        return SentimentScore(
            sentiment_score=score,
            confidence=confidence,
            bucket=bucket,
            article_count=article_count,
            positive_count=1 if score > 0.2 else 0,
            negative_count=1 if score < -0.2 else 0,
            neutral_count=1 if -0.2 <= score <= 0.2 else 0,
            recency_weight=1.0,
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sentiment_score": self.sentiment_score,
            "confidence": self.confidence,
            "bucket": self.bucket.value,
            "article_count": self.article_count,
            "positive_count": self.positive_count,
            "negative_count": self.negative_count,
            "neutral_count": self.neutral_count,
            "recency_weight": self.recency_weight,
        }


class FinnhubNewsProvider:
    """
    News provider using Finnhub API.
    
    Endpoints:
    - /news for market news
    - /company-news for company-specific news
    - /news-sentiment for sentiment analysis
    """
    
    BASE_URL = "https://finnhub.io/api/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        # Try primary key, fallback to secondary
        self._api_key = api_key or os.environ.get("FINNHUB_API_KEY", "") or os.environ.get("FINNHUB2_API_KEY", "")
        self._backup_key = os.environ.get("FINNHUB2_API_KEY", "")
        self._use_backup = False
        self._cache: Dict[str, Tuple[datetime, Any]] = {}
        self._cache_ttl = timedelta(minutes=5)
    
    @property
    def is_available(self) -> bool:
        """Check if provider is configured."""
        return bool(self._api_key) and HTTPX_AVAILABLE
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key in self._cache:
            cached_time, value = self._cache[key]
            if datetime.utcnow() - cached_time < self._cache_ttl:
                return value
        return None
    
    def _set_cached(self, key: str, value: Any):
        """Set value in cache."""
        self._cache[key] = (datetime.utcnow(), value)
    
    async def get_market_news(
        self,
        category: NewsCategory = NewsCategory.GENERAL,
        min_id: int = 0,
    ) -> List[NewsArticle]:
        """
        Fetch market news.
        
        Args:
            category: News category filter
            min_id: Return news with ID greater than this
        
        Returns:
            List of news articles
        """
        if not self.is_available:
            logger.warning("FinnhubNewsProvider not available")
            return []
        
        cache_key = f"market_news_{category.value}_{min_id}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/news",
                    params={
                        "category": category.value,
                        "minId": min_id,
                        "token": self._api_key,
                    }
                )
                response.raise_for_status()
                data = response.json()
            
            articles = []
            for item in data:
                article = NewsArticle(
                    id=str(item.get("id", "")),
                    headline=item.get("headline", ""),
                    summary=item.get("summary", ""),
                    source=item.get("source", ""),
                    url=item.get("url", ""),
                    published_at=datetime.fromtimestamp(item.get("datetime", 0)),
                    category=category,
                    symbols=item.get("related", "").split(",") if item.get("related") else [],
                    raw_data=item,
                )
                articles.append(article)
            
            self._set_cached(cache_key, articles)
            return articles
            
        except Exception as e:
            logger.error(f"Failed to fetch market news: {e}")
            return []
    
    async def get_company_news(
        self,
        symbol: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[NewsArticle]:
        """
        Fetch news for a specific company.
        
        Args:
            symbol: Stock symbol
            from_date: Start date (default: 7 days ago)
            to_date: End date (default: today)
        
        Returns:
            List of news articles
        """
        if not self.is_available:
            logger.warning("FinnhubNewsProvider not available")
            return []
        
        # Default date range
        if to_date is None:
            to_date = datetime.utcnow()
        if from_date is None:
            from_date = to_date - timedelta(days=7)
        
        cache_key = f"company_news_{symbol}_{from_date.date()}_{to_date.date()}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/company-news",
                    params={
                        "symbol": symbol,
                        "from": from_date.strftime("%Y-%m-%d"),
                        "to": to_date.strftime("%Y-%m-%d"),
                        "token": self._api_key,
                    }
                )
                response.raise_for_status()
                data = response.json()
            
            articles = []
            for item in data:
                # Categorize based on content
                headline_lower = item.get("headline", "").lower()
                if "earnings" in headline_lower:
                    category = NewsCategory.EARNINGS
                elif "analyst" in headline_lower or "upgrade" in headline_lower or "downgrade" in headline_lower:
                    category = NewsCategory.ANALYST
                elif "merger" in headline_lower or "acquisition" in headline_lower:
                    category = NewsCategory.MERGER
                else:
                    category = NewsCategory.GENERAL
                
                article = NewsArticle(
                    id=str(item.get("id", "")),
                    headline=item.get("headline", ""),
                    summary=item.get("summary", ""),
                    source=item.get("source", ""),
                    url=item.get("url", ""),
                    published_at=datetime.fromtimestamp(item.get("datetime", 0)),
                    category=category,
                    symbols=[symbol],
                    raw_data=item,
                )
                articles.append(article)
            
            self._set_cached(cache_key, articles)
            return articles
            
        except Exception as e:
            logger.error(f"Failed to fetch company news for {symbol}: {e}")
            return []
    
    async def get_news_sentiment(self, symbol: str) -> Optional[SentimentScore]:
        """
        Fetch news sentiment for a company.
        
        Args:
            symbol: Stock symbol
        
        Returns:
            SentimentScore or None if unavailable
        """
        if not self.is_available:
            logger.warning("FinnhubNewsProvider not available")
            return None
        
        cache_key = f"sentiment_{symbol}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/news-sentiment",
                    params={
                        "symbol": symbol,
                        "token": self._api_key,
                    }
                )
                response.raise_for_status()
                data = response.json()
            
            # Parse Finnhub sentiment response
            sentiment = data.get("sentiment", {})
            buzz = data.get("buzz", {})
            
            score = sentiment.get("bullishPercent", 0.5) - sentiment.get("bearishPercent", 0.5)
            article_count = buzz.get("articlesInLastWeek", 0)
            
            # Determine bucket
            if score >= 0.4:
                bucket = SentimentBucket.VERY_BULLISH
            elif score >= 0.1:
                bucket = SentimentBucket.BULLISH
            elif score > -0.1:
                bucket = SentimentBucket.NEUTRAL
            elif score > -0.4:
                bucket = SentimentBucket.BEARISH
            else:
                bucket = SentimentBucket.VERY_BEARISH
            
            result = SentimentScore(
                sentiment_score=score,
                confidence=min(article_count / 10.0, 1.0),  # Confidence scales with article count
                bucket=bucket,
                article_count=article_count,
                positive_count=int(sentiment.get("bullishPercent", 0) * article_count),
                negative_count=int(sentiment.get("bearishPercent", 0) * article_count),
                neutral_count=int((1 - sentiment.get("bullishPercent", 0) - sentiment.get("bearishPercent", 0)) * article_count),
                recency_weight=buzz.get("weeklyAverage", 1.0) / max(buzz.get("articlesInLastWeek", 1), 1),
            )
            
            self._set_cached(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Failed to fetch news sentiment for {symbol}: {e}")
            return None


class SentimentEngine:
    """
    Aggregates and analyzes sentiment from multiple sources.
    
    Features:
    - Combines news sentiment with price action
    - Weights by recency
    - Provides overall sentiment signal
    """
    
    # Recency weights for aggregation
    RECENCY_WEIGHTS = {
        RecencyBucket.BREAKING: 1.0,
        RecencyBucket.RECENT: 0.8,
        RecencyBucket.TODAY: 0.5,
        RecencyBucket.STALE: 0.2,
        RecencyBucket.ARCHIVE: 0.1,
    }
    
    def __init__(self, news_provider: Optional[FinnhubNewsProvider] = None):
        self._news_provider = news_provider or FinnhubNewsProvider()
        self._sentiment_cache: Dict[str, Tuple[datetime, SentimentScore]] = {}
        self._cache_ttl = timedelta(minutes=15)
    
    async def get_symbol_sentiment(
        self,
        symbol: str,
        include_news: bool = True,
    ) -> SentimentScore:
        """
        Get aggregated sentiment for a symbol.
        
        Args:
            symbol: Stock/option underlying symbol
            include_news: Whether to fetch news articles for analysis
        
        Returns:
            Aggregated SentimentScore
        """
        # Check cache
        if symbol in self._sentiment_cache:
            cached_time, cached_score = self._sentiment_cache[symbol]
            if datetime.utcnow() - cached_time < self._cache_ttl:
                return cached_score
        
        # Get API sentiment
        api_sentiment = await self._news_provider.get_news_sentiment(symbol)
        
        if api_sentiment:
            self._sentiment_cache[symbol] = (datetime.utcnow(), api_sentiment)
            return api_sentiment
        
        # Fallback: analyze news articles
        if include_news:
            return await self._analyze_news_sentiment(symbol)
        
        # Default neutral
        return SentimentScore.from_score(0.0, confidence=0.0, article_count=0)
    
    async def _analyze_news_sentiment(self, symbol: str) -> SentimentScore:
        """Analyze sentiment from news articles."""
        articles = await self._news_provider.get_company_news(symbol)
        
        if not articles:
            return SentimentScore.from_score(0.0, confidence=0.0, article_count=0)
        
        # Simple keyword-based sentiment (as fallback)
        positive_keywords = {
            "upgrade", "buy", "bullish", "growth", "profit", "beat", 
            "outperform", "strong", "positive", "surge", "rally",
            "breakthrough", "innovative", "success", "record"
        }
        negative_keywords = {
            "downgrade", "sell", "bearish", "loss", "miss", 
            "underperform", "weak", "negative", "fall", "decline",
            "warning", "concern", "risk", "problem", "lawsuit"
        }
        
        weighted_scores = []
        for article in articles:
            text = f"{article.headline} {article.summary}".lower()
            
            # Count keyword hits
            pos_hits = sum(1 for kw in positive_keywords if kw in text)
            neg_hits = sum(1 for kw in negative_keywords if kw in text)
            
            # Calculate article score
            if pos_hits + neg_hits > 0:
                article_score = (pos_hits - neg_hits) / (pos_hits + neg_hits)
            else:
                article_score = 0.0
            
            # Weight by recency
            weight = self.RECENCY_WEIGHTS.get(article.recency_bucket, 0.1)
            weighted_scores.append((article_score, weight))
        
        # Aggregate
        if weighted_scores:
            total_weight = sum(w for _, w in weighted_scores)
            weighted_sum = sum(s * w for s, w in weighted_scores)
            final_score = weighted_sum / total_weight if total_weight > 0 else 0.0
        else:
            final_score = 0.0
        
        # Count by sentiment
        pos_count = sum(1 for s, _ in weighted_scores if s > 0.2)
        neg_count = sum(1 for s, _ in weighted_scores if s < -0.2)
        neu_count = len(weighted_scores) - pos_count - neg_count
        
        # Determine bucket
        if final_score >= 0.4:
            bucket = SentimentBucket.VERY_BULLISH
        elif final_score >= 0.1:
            bucket = SentimentBucket.BULLISH
        elif final_score > -0.1:
            bucket = SentimentBucket.NEUTRAL
        elif final_score > -0.4:
            bucket = SentimentBucket.BEARISH
        else:
            bucket = SentimentBucket.VERY_BEARISH
        
        result = SentimentScore(
            sentiment_score=final_score,
            confidence=min(len(articles) / 10.0, 1.0),
            bucket=bucket,
            article_count=len(articles),
            positive_count=pos_count,
            negative_count=neg_count,
            neutral_count=neu_count,
            recency_weight=sum(self.RECENCY_WEIGHTS.get(a.recency_bucket, 0.1) for a in articles) / len(articles),
        )
        
        self._sentiment_cache[symbol] = (datetime.utcnow(), result)
        return result
    
    def is_sentiment_gate_passed(
        self,
        sentiment: SentimentScore,
        required_bucket: SentimentBucket = SentimentBucket.NEUTRAL,
        min_confidence: float = 0.3,
        allow_neutral: bool = True,
    ) -> Tuple[bool, str]:
        """
        Check if sentiment passes the gate for trading.
        
        Args:
            sentiment: Current sentiment score
            required_bucket: Minimum required sentiment level
            min_confidence: Minimum confidence threshold
            allow_neutral: Whether neutral sentiment passes
        
        Returns:
            (passed, reason) tuple
        """
        # Map buckets to numeric values
        bucket_values = {
            SentimentBucket.VERY_BEARISH: -2,
            SentimentBucket.BEARISH: -1,
            SentimentBucket.NEUTRAL: 0,
            SentimentBucket.BULLISH: 1,
            SentimentBucket.VERY_BULLISH: 2,
        }
        
        current_value = bucket_values.get(sentiment.bucket, 0)
        required_value = bucket_values.get(required_bucket, 0)
        
        # Check confidence
        if sentiment.confidence < min_confidence:
            return (True, f"Low confidence ({sentiment.confidence:.2f}), allowing trade")
        
        # Check neutral handling
        if sentiment.bucket == SentimentBucket.NEUTRAL:
            if allow_neutral:
                return (True, "Neutral sentiment, trade allowed")
            else:
                return (False, "Neutral sentiment blocked")
        
        # Check bucket level
        if current_value >= required_value:
            return (True, f"Sentiment {sentiment.bucket.value} meets requirement")
        else:
            return (False, f"Sentiment {sentiment.bucket.value} below {required_bucket.value}")
    
    async def get_market_sentiment(self) -> SentimentScore:
        """Get overall market sentiment from market news."""
        articles = await self._news_provider.get_market_news()
        
        if not articles:
            return SentimentScore.from_score(0.0, confidence=0.0, article_count=0)
        
        # Analyze market news
        positive_keywords = {
            "rally", "bull", "growth", "record", "surge", "optimism",
            "recovery", "strong", "positive", "beat"
        }
        negative_keywords = {
            "crash", "bear", "recession", "fear", "sell-off", "decline",
            "warning", "weak", "negative", "miss", "crisis"
        }
        
        weighted_scores = []
        for article in articles[:50]:  # Limit to recent 50
            text = f"{article.headline} {article.summary}".lower()
            
            pos_hits = sum(1 for kw in positive_keywords if kw in text)
            neg_hits = sum(1 for kw in negative_keywords if kw in text)
            
            if pos_hits + neg_hits > 0:
                article_score = (pos_hits - neg_hits) / (pos_hits + neg_hits)
            else:
                article_score = 0.0
            
            weight = self.RECENCY_WEIGHTS.get(article.recency_bucket, 0.1)
            weighted_scores.append((article_score, weight))
        
        if weighted_scores:
            total_weight = sum(w for _, w in weighted_scores)
            weighted_sum = sum(s * w for s, w in weighted_scores)
            final_score = weighted_sum / total_weight if total_weight > 0 else 0.0
        else:
            final_score = 0.0
        
        return SentimentScore.from_score(
            final_score,
            confidence=min(len(articles) / 20.0, 1.0),
            article_count=len(articles)
        )


class EnsembleSentimentEngine:
    """
    Ensemble Sentiment Engine combining multiple models:
    - Finnhub API sentiment (fast, API-based)
    - FinBERT (local ML model - financial BERT)
    - FinGPT (local/API ML model - financial GPT)
    
    Provides weighted ensemble scoring for more robust sentiment analysis.
    """
    
    # Default weights for ensemble
    DEFAULT_WEIGHTS = {
        "finnhub": 0.30,
        "finbert": 0.40,
        "fingpt": 0.30,
    }
    
    def __init__(
        self,
        news_provider: Optional[FinnhubNewsProvider] = None,
        weights: Optional[Dict[str, float]] = None,
    ):
        """
        Initialize ensemble sentiment engine.
        
        Args:
            news_provider: Finnhub news provider for API sentiment
            weights: Custom weights for ensemble (must sum to 1.0)
        """
        self._news_provider = news_provider or FinnhubNewsProvider()
        self._base_engine = SentimentEngine(self._news_provider)
        self._weights = weights or self.DEFAULT_WEIGHTS.copy()
        
        # Lazy-load ML providers
        self._finbert = None
        self._fingpt = None
        self._providers_loaded = False
        
        # Cache
        self._sentiment_cache: Dict[str, Tuple[datetime, SentimentScore]] = {}
        self._cache_ttl = timedelta(minutes=10)
    
    def _ensure_providers(self):
        """Lazy load ML providers."""
        if self._providers_loaded:
            return
        
        self._providers_loaded = True
        
        try:
            from .finbert_provider import get_finbert_provider
            self._finbert = get_finbert_provider()
            logger.info(f"FinBERT available: {self._finbert.is_available}")
        except Exception as e:
            logger.warning(f"FinBERT load failed: {e}")
            self._finbert = None
        
        try:
            from .fingpt_provider import get_fingpt_provider
            self._fingpt = get_fingpt_provider()
            logger.info(f"FinGPT available: {self._fingpt.is_available if self._fingpt else False}")
        except Exception as e:
            logger.warning(f"FinGPT load failed: {e}")
            self._fingpt = None
    
    async def get_ensemble_sentiment(
        self,
        symbol: str,
        headlines: Optional[List[str]] = None,
    ) -> SentimentScore:
        """
        Get ensemble sentiment combining all available models.
        
        Args:
            symbol: Stock symbol
            headlines: Optional headlines to analyze (fetched if not provided)
            
        Returns:
            Combined SentimentScore
        """
        # Check cache
        cache_key = f"ensemble_{symbol}"
        if cache_key in self._sentiment_cache:
            cached_time, cached_score = self._sentiment_cache[cache_key]
            if datetime.utcnow() - cached_time < self._cache_ttl:
                return cached_score
        
        self._ensure_providers()
        
        scores: Dict[str, Tuple[float, float]] = {}  # provider -> (score, confidence)
        
        # 1. Get Finnhub API sentiment
        try:
            finnhub_sentiment = await self._base_engine.get_symbol_sentiment(symbol)
            scores["finnhub"] = (
                finnhub_sentiment.sentiment_score,
                finnhub_sentiment.confidence,
            )
            logger.debug(f"Finnhub: {finnhub_sentiment.sentiment_score:.2f}")
        except Exception as e:
            logger.warning(f"Finnhub sentiment failed: {e}")
        
        # Get headlines for ML models if not provided
        if headlines is None:
            try:
                articles = await self._news_provider.get_company_news(symbol)
                headlines = [a.headline for a in articles[:10]]  # Limit to recent 10
            except Exception as e:
                logger.warning(f"Failed to fetch headlines: {e}")
                headlines = []
        
        # 2. Get FinBERT sentiment (Feature Flagged)
        from .config import get_autopilot_config
        config = get_autopilot_config()
        
        if config.enable_finbert and self._finbert and self._finbert.is_available and headlines:
            try:
                finbert_analysis_results = self._finbert.analyze_batch(headlines)
                valid_results = [r for r in finbert_analysis_results if r is not None]
                
                if valid_results:
                    avg_score = sum(r.normalized_score for r in valid_results) / len(valid_results)
                    avg_conf = sum(r.score for r in valid_results) / len(valid_results)
                    scores["finbert"] = (avg_score, avg_conf)
                    logger.debug(f"FinBERT: {avg_score:.2f} (conf: {avg_conf:.2f})")
            except Exception as e:
                logger.warning(f"FinBERT analysis failed: {e}")
        
        # 3. Get FinGPT sentiment
        if self._fingpt and self._fingpt.is_available and headlines:
            try:
                fingpt_results = self._fingpt.analyze_batch(headlines[:5])  # Limit for speed
                valid_results = [r for r in fingpt_results if r is not None]
                
                if valid_results:
                    avg_score = sum(r.normalized_score for r in valid_results) / len(valid_results)
                    avg_conf = sum(r.score for r in valid_results) / len(valid_results)
                    scores["fingpt"] = (avg_score, avg_conf)
                    logger.debug(f"FinGPT: {avg_score:.2f} (conf: {avg_conf:.2f})")
            except Exception as e:
                logger.warning(f"FinGPT analysis failed: {e}")
        
        # Combine scores with weights
        final_score, total_weight, total_confidence = 0.0, 0.0, 0.0
        
        for provider, (score, confidence) in scores.items():
            weight = self._weights.get(provider, 0.0)
            # Weight by both configured weight and confidence
            effective_weight = weight * confidence
            final_score += score * effective_weight
            total_weight += effective_weight
            total_confidence += confidence * weight
        
        if total_weight > 0:
            final_score = final_score / total_weight
        else:
            final_score = 0.0
        
        # Normalize confidence
        total_confidence = min(total_confidence, 1.0)
        
        # Create result
        if final_score >= 0.4:
            bucket = SentimentBucket.VERY_BULLISH
        elif final_score >= 0.1:
            bucket = SentimentBucket.BULLISH
        elif final_score > -0.1:
            bucket = SentimentBucket.NEUTRAL
        elif final_score > -0.4:
            bucket = SentimentBucket.BEARISH
        else:
            bucket = SentimentBucket.VERY_BEARISH
        
        result = SentimentScore(
            sentiment_score=final_score,
            confidence=total_confidence,
            bucket=bucket,
            article_count=len(headlines) if headlines else 0,
            positive_count=sum(1 for _, (s, _) in scores.items() if s > 0.1),
            negative_count=sum(1 for _, (s, _) in scores.items() if s < -0.1),
            neutral_count=sum(1 for _, (s, _) in scores.items() if -0.1 <= s <= 0.1),
            recency_weight=1.0,
        )
        
        # Cache result
        self._sentiment_cache[cache_key] = (datetime.utcnow(), result)
        
        logger.info(
            f"Ensemble sentiment for {symbol}: {final_score:.2f} "
            f"(sources: {list(scores.keys())}, conf: {total_confidence:.2f})"
        )
        
        return result
    
    def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all sentiment providers."""
        self._ensure_providers()
        
        return {
            "finnhub": {
                "available": self._news_provider.is_available,
                "weight": self._weights.get("finnhub", 0),
            },
            "finbert": {
                "available": self._finbert.is_available if self._finbert else False,
                "weight": self._weights.get("finbert", 0),
                "health": self._finbert.health_check() if self._finbert else None,
            },
            "fingpt": {
                "available": self._fingpt.is_available if self._fingpt else False,
                "weight": self._weights.get("fingpt", 0),
                "health": self._fingpt.health_check() if self._fingpt else None,
            },
            "ensemble_weights": self._weights,
        }


# Global instances
_news_provider: Optional[FinnhubNewsProvider] = None
_sentiment_engine: Optional[SentimentEngine] = None
_ensemble_engine: Optional[EnsembleSentimentEngine] = None


def get_news_provider() -> FinnhubNewsProvider:
    """Get or create global news provider."""
    global _news_provider
    if _news_provider is None:
        _news_provider = FinnhubNewsProvider()
    return _news_provider


def get_sentiment_engine() -> SentimentEngine:
    """Get or create global sentiment engine (basic)."""
    global _sentiment_engine
    if _sentiment_engine is None:
        _sentiment_engine = SentimentEngine(get_news_provider())
    return _sentiment_engine


def get_ensemble_sentiment_engine() -> EnsembleSentimentEngine:
    """Get or create global ensemble sentiment engine (FinBERT + FinGPT)."""
    global _ensemble_engine
    if _ensemble_engine is None:
        _ensemble_engine = EnsembleSentimentEngine(get_news_provider())
    return _ensemble_engine

