"""
Unit tests for News Sentiment Service

Tests:
- NewsCategory enum
- SentimentBucket enum
- RecencyBucket calculations
- NewsArticle dataclass
- SentimentScore calculations
- SentimentEngine analysis
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from services.autopilot.news_sentiment import (
    NewsCategory,
    SentimentBucket,
    RecencyBucket,
    NewsArticle,
    SentimentScore,
    FinnhubNewsProvider,
    SentimentEngine,
)


class TestNewsCategory:
    """Test NewsCategory enum."""
    
    def test_news_categories(self):
        """Verify all categories exist."""
        assert NewsCategory.GENERAL.value == "general"
        assert NewsCategory.EARNINGS.value == "earnings"
        assert NewsCategory.MERGER.value == "merger"
        assert NewsCategory.ANALYST.value == "analyst"


class TestSentimentBucket:
    """Test SentimentBucket enum."""
    
    def test_sentiment_buckets(self):
        """Verify all sentiment buckets."""
        assert SentimentBucket.VERY_BULLISH.value == "very_bullish"
        assert SentimentBucket.BULLISH.value == "bullish"
        assert SentimentBucket.NEUTRAL.value == "neutral"
        assert SentimentBucket.BEARISH.value == "bearish"
        assert SentimentBucket.VERY_BEARISH.value == "very_bearish"


class TestRecencyBucket:
    """Test RecencyBucket enum."""
    
    def test_recency_buckets(self):
        """Verify recency buckets."""
        assert RecencyBucket.BREAKING.value == "breaking"
        assert RecencyBucket.RECENT.value == "recent"
        assert RecencyBucket.TODAY.value == "today"
        assert RecencyBucket.STALE.value == "stale"
        assert RecencyBucket.ARCHIVE.value == "archive"


class TestNewsArticle:
    """Test NewsArticle dataclass."""
    
    def test_article_creation(self):
        """Create news article."""
        article = NewsArticle(
            id="art1",
            headline="Apple Reports Record Q4 Earnings",
            summary="Apple Inc. exceeded analyst expectations...",
            source="Reuters",
            url="https://example.com/article",
            published_at=datetime.utcnow(),
            category=NewsCategory.EARNINGS,
            symbols=["AAPL"],
        )
        
        assert article.headline == "Apple Reports Record Q4 Earnings"
        assert article.category == NewsCategory.EARNINGS
        assert "AAPL" in article.symbols
    
    def test_recency_bucket_breaking(self):
        """Test breaking news recency."""
        article = NewsArticle(
            id="art2",
            headline="Breaking News",
            summary="...",
            source="Test",
            url="https://example.com",
            published_at=datetime.utcnow() - timedelta(minutes=30),
            category=NewsCategory.GENERAL,
            symbols=[],
        )
        
        assert article.recency_bucket == RecencyBucket.BREAKING
    
    def test_recency_bucket_recent(self):
        """Test recent news recency."""
        article = NewsArticle(
            id="art3",
            headline="Recent News",
            summary="...",
            source="Test",
            url="https://example.com",
            published_at=datetime.utcnow() - timedelta(hours=3),
            category=NewsCategory.GENERAL,
            symbols=[],
        )
        
        assert article.recency_bucket == RecencyBucket.RECENT
    
    def test_recency_bucket_today(self):
        """Test today's news recency."""
        article = NewsArticle(
            id="art4",
            headline="Today News",
            summary="...",
            source="Test",
            url="https://example.com",
            published_at=datetime.utcnow() - timedelta(hours=12),
            category=NewsCategory.GENERAL,
            symbols=[],
        )
        
        assert article.recency_bucket == RecencyBucket.TODAY
    
    def test_recency_bucket_stale(self):
        """Test stale news recency."""
        article = NewsArticle(
            id="art5",
            headline="Old News",
            summary="...",
            source="Test",
            url="https://example.com",
            published_at=datetime.utcnow() - timedelta(days=2),
            category=NewsCategory.GENERAL,
            symbols=[],
        )
        
        assert article.recency_bucket == RecencyBucket.STALE
    
    def test_recency_bucket_archive(self):
        """Test archive news recency."""
        article = NewsArticle(
            id="art6",
            headline="Ancient News",
            summary="...",
            source="Test",
            url="https://example.com",
            published_at=datetime.utcnow() - timedelta(days=5),
            category=NewsCategory.GENERAL,
            symbols=[],
        )
        
        assert article.recency_bucket == RecencyBucket.ARCHIVE
    
    def test_article_to_dict(self):
        """Test article serialization."""
        now = datetime.utcnow()
        article = NewsArticle(
            id="art7",
            headline="Test",
            summary="Test summary",
            source="Test Source",
            url="https://example.com",
            published_at=now,
            category=NewsCategory.GENERAL,
            symbols=["AAPL", "MSFT"],
        )
        
        data = article.to_dict()
        assert data["id"] == "art7"
        assert data["headline"] == "Test"
        assert data["symbols"] == ["AAPL", "MSFT"]


class TestSentimentScore:
    """Test SentimentScore dataclass."""
    
    def test_sentiment_from_score_very_bullish(self):
        """Test very bullish sentiment."""
        score = SentimentScore.from_score(0.7, confidence=0.9)
        assert score.bucket == SentimentBucket.VERY_BULLISH
        assert score.sentiment_score == 0.7
        assert score.confidence == 0.9
    
    def test_sentiment_from_score_bullish(self):
        """Test bullish sentiment."""
        score = SentimentScore.from_score(0.3, confidence=0.8)
        assert score.bucket == SentimentBucket.BULLISH
    
    def test_sentiment_from_score_neutral(self):
        """Test neutral sentiment."""
        score = SentimentScore.from_score(0.0, confidence=0.5)
        assert score.bucket == SentimentBucket.NEUTRAL
    
    def test_sentiment_from_score_bearish(self):
        """Test bearish sentiment."""
        score = SentimentScore.from_score(-0.3, confidence=0.7)
        assert score.bucket == SentimentBucket.BEARISH
    
    def test_sentiment_from_score_very_bearish(self):
        """Test very bearish sentiment."""
        score = SentimentScore.from_score(-0.8, confidence=0.95)
        assert score.bucket == SentimentBucket.VERY_BEARISH
    
    def test_sentiment_to_dict(self):
        """Test sentiment serialization."""
        score = SentimentScore(
            sentiment_score=0.5,
            confidence=0.8,
            bucket=SentimentBucket.BULLISH,
            article_count=10,
            positive_count=7,
            negative_count=2,
            neutral_count=1,
            recency_weight=0.9,
        )
        
        data = score.to_dict()
        assert data["sentiment_score"] == 0.5
        assert data["bucket"] == "bullish"
        assert data["article_count"] == 10


class TestFinnhubNewsProvider:
    """Test FinnhubNewsProvider class."""
    
    def test_provider_initialization(self):
        """Initialize provider."""
        provider = FinnhubNewsProvider(api_key="test_key")
        assert provider._api_key == "test_key"
    
    def test_provider_uses_env_key_when_not_provided(self):
        """Provider uses env key when not explicitly provided."""
        # When no key is passed, it reads from FINNHUB_API_KEY env var
        provider = FinnhubNewsProvider(api_key="explicit_key")
        assert provider._api_key == "explicit_key"


class TestSentimentEngine:
    """Test SentimentEngine class."""
    
    def test_engine_initialization(self):
        """Initialize sentiment engine."""
        engine = SentimentEngine()
        assert engine._news_provider is not None
    
    def test_recency_weights(self):
        """Verify recency weights are configured."""
        weights = SentimentEngine.RECENCY_WEIGHTS
        
        assert weights[RecencyBucket.BREAKING] == 1.0
        assert weights[RecencyBucket.RECENT] == 0.8
        assert weights[RecencyBucket.TODAY] == 0.5
        assert weights[RecencyBucket.STALE] == 0.2
        assert weights[RecencyBucket.ARCHIVE] == 0.1
    
    def test_sentiment_gate_passed_bullish(self):
        """Test sentiment gate with bullish sentiment."""
        engine = SentimentEngine()
        
        sentiment = SentimentScore(
            sentiment_score=0.4,
            confidence=0.8,
            bucket=SentimentBucket.BULLISH,
            article_count=10,
            positive_count=7,
            negative_count=2,
            neutral_count=1,
            recency_weight=0.9,
        )
        
        passed, reason = engine.is_sentiment_gate_passed(
            sentiment,
            required_bucket=SentimentBucket.NEUTRAL,
        )
        
        assert passed is True
        assert "meets requirement" in reason
    
    def test_sentiment_gate_failed_bearish(self):
        """Test sentiment gate with bearish sentiment."""
        engine = SentimentEngine()
        
        sentiment = SentimentScore(
            sentiment_score=-0.4,
            confidence=0.8,
            bucket=SentimentBucket.BEARISH,
            article_count=10,
            positive_count=2,
            negative_count=7,
            neutral_count=1,
            recency_weight=0.9,
        )
        
        passed, reason = engine.is_sentiment_gate_passed(
            sentiment,
            required_bucket=SentimentBucket.NEUTRAL,
            allow_neutral=False,
        )
        
        assert passed is False
        assert "below" in reason
    
    def test_sentiment_gate_low_confidence_passes(self):
        """Test that low confidence allows trade through."""
        engine = SentimentEngine()
        
        sentiment = SentimentScore(
            sentiment_score=-0.5,
            confidence=0.2,  # Low confidence
            bucket=SentimentBucket.BEARISH,
            article_count=2,
            positive_count=0,
            negative_count=2,
            neutral_count=0,
            recency_weight=0.5,
        )
        
        passed, reason = engine.is_sentiment_gate_passed(
            sentiment,
            min_confidence=0.3,
        )
        
        assert passed is True
        assert "Low confidence" in reason
    
    def test_sentiment_gate_neutral_allowed(self):
        """Test neutral sentiment when allowed."""
        engine = SentimentEngine()
        
        sentiment = SentimentScore(
            sentiment_score=0.0,
            confidence=0.8,
            bucket=SentimentBucket.NEUTRAL,
            article_count=10,
            positive_count=3,
            negative_count=3,
            neutral_count=4,
            recency_weight=0.7,
        )
        
        passed, reason = engine.is_sentiment_gate_passed(
            sentiment,
            allow_neutral=True,
        )
        
        assert passed is True
        assert "Neutral" in reason
