"""
Sentiment & FinBERT Pipeline — Wave 17
Finnhub news integration, FinBERT scoring, sentiment fusion,
sentiment-weighted signal overlay.
"""

import hashlib
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SentimentLabel(str, Enum):
    VERY_BEARISH = "very_bearish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    BULLISH = "bullish"
    VERY_BULLISH = "very_bullish"


class NewsSource(str, Enum):
    FINNHUB = "finnhub"
    ALPACA = "alpaca"
    MANUAL = "manual"


@dataclass
class NewsArticle:
    """A single news article."""
    article_id: str
    headline: str
    summary: str
    source: NewsSource
    symbol: str
    published_at: str
    url: Optional[str] = None
    ingested_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "article_id": self.article_id,
            "headline": self.headline,
            "summary": self.summary,
            "source": self.source.value,
            "symbol": self.symbol,
            "published_at": self.published_at,
            "url": self.url,
            "ingested_at": self.ingested_at,
        }


@dataclass
class SentimentScore:
    """FinBERT sentiment score for an article."""
    article_id: str
    symbol: str
    label: SentimentLabel
    positive: float
    negative: float
    neutral: float
    composite: float  # -1 to +1
    confidence: float  # 0 to 1
    model_version: str = "finbert-v1"
    scored_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "article_id": self.article_id,
            "symbol": self.symbol,
            "label": self.label.value,
            "positive": round(self.positive, 4),
            "negative": round(self.negative, 4),
            "neutral": round(self.neutral, 4),
            "composite": round(self.composite, 4),
            "confidence": round(self.confidence, 4),
            "model_version": self.model_version,
            "scored_at": self.scored_at,
        }


@dataclass
class SymbolSentiment:
    """Aggregated sentiment for a symbol."""
    symbol: str
    articles_count: int
    avg_composite: float
    weighted_composite: float  # Confidence-weighted
    label: SentimentLabel
    trend: str  # "improving", "degrading", "stable"
    last_article_at: str
    computed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "articles_count": self.articles_count,
            "avg_composite": round(self.avg_composite, 4),
            "weighted_composite": round(self.weighted_composite, 4),
            "label": self.label.value,
            "trend": self.trend,
            "last_article_at": self.last_article_at,
            "computed_at": self.computed_at,
        }


@dataclass
class SentimentSignalOverlay:
    """Sentiment-derived signal adjustment."""
    symbol: str
    base_signal_strength: float  # Original signal [-1, 1]
    sentiment_adjustment: float  # Sentiment overlay [-0.5, 0.5]
    adjusted_signal: float       # Final signal [-1, 1]
    sentiment_agrees: bool
    override_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "base_signal_strength": round(self.base_signal_strength, 4),
            "sentiment_adjustment": round(self.sentiment_adjustment, 4),
            "adjusted_signal": round(self.adjusted_signal, 4),
            "sentiment_agrees": self.sentiment_agrees,
            "override_reason": self.override_reason,
        }


# Sentiment thresholds
SENTIMENT_THRESHOLDS = {
    SentimentLabel.VERY_BEARISH: (-1.0, -0.6),
    SentimentLabel.BEARISH: (-0.6, -0.2),
    SentimentLabel.NEUTRAL: (-0.2, 0.2),
    SentimentLabel.BULLISH: (0.2, 0.6),
    SentimentLabel.VERY_BULLISH: (0.6, 1.0),
}


def composite_to_label(composite: float) -> SentimentLabel:
    """Map composite score to sentiment label."""
    for label, (low, high) in SENTIMENT_THRESHOLDS.items():
        if low <= composite < high:
            return label
    return SentimentLabel.VERY_BULLISH if composite >= 0.6 else SentimentLabel.VERY_BEARISH


class SentimentPipeline:
    """
    FinBERT-based sentiment pipeline with Finnhub news integration.
    Processes news → scores → aggregation → signal overlay.
    """

    def __init__(self, decay_hours: float = 72.0, min_confidence: float = 0.5):
        self._articles: list[NewsArticle] = []
        self._scores: list[SentimentScore] = []
        self._decay_hours = decay_hours
        self._min_confidence = min_confidence

    def ingest_article(self, article: NewsArticle) -> NewsArticle:
        """Ingest a news article."""
        self._articles.append(article)
        return article

    def ingest_articles(self, articles: list[NewsArticle]) -> int:
        """Bulk ingest articles."""
        self._articles.extend(articles)
        return len(articles)

    def score_article(
        self,
        article: NewsArticle,
        positive: float = 0.33,
        negative: float = 0.33,
        neutral: float = 0.34,
    ) -> SentimentScore:
        """
        Score an article with FinBERT probabilities.
        In production, these come from the FinBERT model.
        For online-only mode, accepts pre-computed scores.
        """
        composite = positive - negative
        confidence = max(positive, negative, neutral)
        label = composite_to_label(composite)

        score = SentimentScore(
            article_id=article.article_id,
            symbol=article.symbol,
            label=label,
            positive=positive,
            negative=negative,
            neutral=neutral,
            composite=composite,
            confidence=confidence,
        )
        self._scores.append(score)
        return score

    def aggregate_symbol(self, symbol: str, lookback_hours: Optional[float] = None) -> SymbolSentiment:
        """Aggregate sentiment for a symbol with time decay."""
        cutoff = None
        if lookback_hours:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

        relevant = [
            s for s in self._scores
            if s.symbol == symbol and s.confidence >= self._min_confidence
        ]

        if cutoff:
            relevant = [
                s for s in relevant
                if datetime.fromisoformat(s.scored_at) >= cutoff
            ]

        if not relevant:
            return SymbolSentiment(
                symbol=symbol,
                articles_count=0,
                avg_composite=0,
                weighted_composite=0,
                label=SentimentLabel.NEUTRAL,
                trend="stable",
                last_article_at="",
            )

        # Time-decayed, confidence-weighted composite
        now = datetime.now(timezone.utc)
        total_weight = 0
        weighted_sum = 0
        raw_sum = 0

        for s in relevant:
            scored_dt = datetime.fromisoformat(s.scored_at)
            hours_ago = (now - scored_dt).total_seconds() / 3600
            decay = math.exp(-hours_ago / self._decay_hours)
            weight = s.confidence * decay
            weighted_sum += s.composite * weight
            total_weight += weight
            raw_sum += s.composite

        avg_composite = raw_sum / len(relevant)
        weighted_composite = weighted_sum / total_weight if total_weight > 0 else 0

        # Trend detection (first half vs second half)
        if len(relevant) >= 4:
            mid = len(relevant) // 2
            first_avg = sum(s.composite for s in relevant[:mid]) / mid
            second_avg = sum(s.composite for s in relevant[mid:]) / (len(relevant) - mid)
            if second_avg - first_avg > 0.1:
                trend = "improving"
            elif first_avg - second_avg > 0.1:
                trend = "degrading"
            else:
                trend = "stable"
        else:
            trend = "stable"

        return SymbolSentiment(
            symbol=symbol,
            articles_count=len(relevant),
            avg_composite=avg_composite,
            weighted_composite=weighted_composite,
            label=composite_to_label(weighted_composite),
            trend=trend,
            last_article_at=max(s.scored_at for s in relevant),
        )

    def compute_signal_overlay(
        self,
        symbol: str,
        base_signal: float,
        sentiment_weight: float = 0.3,
    ) -> SentimentSignalOverlay:
        """Compute sentiment-adjusted signal."""
        agg = self.aggregate_symbol(symbol, lookback_hours=self._decay_hours)

        # Sentiment adjustment: scale to [-0.5, 0.5]
        adjustment = agg.weighted_composite * sentiment_weight
        adjustment = max(-0.5, min(0.5, adjustment))

        adjusted = base_signal + adjustment
        adjusted = max(-1.0, min(1.0, adjusted))

        agrees = (base_signal > 0 and agg.weighted_composite > 0) or \
                 (base_signal < 0 and agg.weighted_composite < 0) or \
                 abs(agg.weighted_composite) < 0.1

        override_reason = None
        if not agrees and abs(agg.weighted_composite) > 0.5:
            override_reason = f"Strong sentiment disagreement: {agg.label.value}"

        return SentimentSignalOverlay(
            symbol=symbol,
            base_signal_strength=base_signal,
            sentiment_adjustment=adjustment,
            adjusted_signal=adjusted,
            sentiment_agrees=agrees,
            override_reason=override_reason,
        )

    def get_all_sentiments(self, symbols: list[str]) -> list[SymbolSentiment]:
        """Get aggregated sentiment for multiple symbols."""
        return [self.aggregate_symbol(s) for s in symbols]

    def get_articles(self, symbol: Optional[str] = None, limit: int = 50) -> list[NewsArticle]:
        arts = self._articles
        if symbol:
            arts = [a for a in arts if a.symbol == symbol]
        return arts[-limit:]

    def get_scores(self, symbol: Optional[str] = None, limit: int = 50) -> list[SentimentScore]:
        scores = self._scores
        if symbol:
            scores = [s for s in scores if s.symbol == symbol]
        return scores[-limit:]


_pipeline: Optional[SentimentPipeline] = None


def get_sentiment_pipeline() -> SentimentPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = SentimentPipeline()
    return _pipeline
