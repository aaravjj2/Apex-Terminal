"""
news_sentiment_engine.py — Bloomberg-grade News & Sentiment Analysis Engine
============================================================================
Pure computation engine — no FastAPI imports.

Components:
    SentimentScore      — Normalized sentiment with confidence
    NewsArticle         — Article with metadata, entities, sentiment
    SentimentAnalyzer   — Rule-based + lexicon sentiment analysis
    EntityExtractor     — Extract tickers, people, orgs from text
    TopicClassifier     — Classify news into categories
    NewsFeed            — Article management, dedup, freshness
    SentimentAggregator — Aggregate sentiment by symbol/sector/time
    NewsAlertScanner    — Scan news for alert-worthy content
    MarketImpactEstimator — Estimate price impact from news
    NewsCorrelator      — Correlate news flow with price action
    NewsSentimentEngine — Top-level orchestrator
"""

from __future__ import annotations
import time
import hashlib
import re
import numpy as np
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict


# ─── Enums ───────────────────────────────────────────────────────────────────

class SentimentLabel(Enum):
    VERY_BULLISH = "very_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    VERY_BEARISH = "very_bearish"


class NewsCategory(Enum):
    EARNINGS = "earnings"
    MERGER_ACQUISITION = "merger_acquisition"
    REGULATION = "regulation"
    PRODUCT_LAUNCH = "product_launch"
    MANAGEMENT = "management"
    LEGAL = "legal"
    MACRO = "macro"
    SECTOR = "sector"
    TECHNICAL = "technical"
    DIVIDEND = "dividend"
    BUYBACK = "buyback"
    INSIDER = "insider"
    ANALYST = "analyst"
    IPO = "ipo"
    GENERAL = "general"


class NewsSource(Enum):
    REUTERS = "reuters"
    BLOOMBERG = "bloomberg"
    WSJ = "wsj"
    CNBC = "cnbc"
    SEC = "sec_filing"
    PR = "press_release"
    SOCIAL = "social_media"
    ANALYST = "analyst_report"
    CUSTOM = "custom"


# ─── DataClasses ─────────────────────────────────────────────────────────────

@dataclass
class SentimentScore:
    """Normalized sentiment with confidence."""
    score: float = 0.0      # -1.0 (bearish) to +1.0 (bullish)
    confidence: float = 0.5  # 0.0 to 1.0
    label: SentimentLabel = SentimentLabel.NEUTRAL

    @staticmethod
    def from_score(score: float, confidence: float = 0.5) -> SentimentScore:
        if score > 0.5:
            label = SentimentLabel.VERY_BULLISH
        elif score > 0.15:
            label = SentimentLabel.BULLISH
        elif score < -0.5:
            label = SentimentLabel.VERY_BEARISH
        elif score < -0.15:
            label = SentimentLabel.BEARISH
        else:
            label = SentimentLabel.NEUTRAL
        return SentimentScore(score=score, confidence=confidence, label=label)

    def to_dict(self) -> Dict[str, Any]:
        return {"score": self.score, "confidence": self.confidence,
                "label": self.label.value}


@dataclass
class NewsArticle:
    """News article with full metadata."""
    id: str = ""
    headline: str = ""
    summary: str = ""
    body: str = ""
    source: NewsSource = NewsSource.CUSTOM
    url: str = ""
    published_at: float = field(default_factory=time.time)
    symbols: List[str] = field(default_factory=list)
    categories: List[NewsCategory] = field(default_factory=list)
    sentiment: Optional[SentimentScore] = None
    entities: Dict[str, List[str]] = field(default_factory=dict)
    keywords: List[str] = field(default_factory=list)
    relevance_score: float = 0.0
    read: bool = False

    def __post_init__(self):
        if not self.id:
            text = f"{self.headline}{self.published_at}"
            self.id = hashlib.md5(text.encode()).hexdigest()[:12]

    @property
    def age_seconds(self) -> float:
        return time.time() - self.published_at

    @property
    def age_minutes(self) -> float:
        return self.age_seconds / 60.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "headline": self.headline, "summary": self.summary,
            "source": self.source.value, "url": self.url,
            "published_at": self.published_at, "symbols": self.symbols,
            "categories": [c.value for c in self.categories],
            "sentiment": self.sentiment.to_dict() if self.sentiment else None,
            "entities": self.entities, "keywords": self.keywords,
            "relevance_score": self.relevance_score,
            "age_minutes": round(self.age_minutes, 1),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. SentimentAnalyzer — Lexicon-based sentiment
# ═══════════════════════════════════════════════════════════════════════════════

class SentimentAnalyzer:
    """Rule-based sentiment analysis using financial lexicon."""

    # Financial sentiment lexicon (Loughran-McDonald inspired)
    POSITIVE_WORDS = {
        "beat", "beats", "exceeded", "surpassed", "strong", "growth",
        "profit", "gains", "rally", "bullish", "upgrade", "outperform",
        "positive", "record", "high", "surge", "soar", "jump", "climb",
        "recover", "rebound", "breakout", "dividend", "buyback",
        "innovation", "partnership", "expansion", "approved", "milestone",
        "optimistic", "confident", "exceeds", "upside", "boost", "improve",
        "momentum", "opportunity", "breakthrough", "success", "win",
        "revenue", "increase", "raise", "higher", "advance", "best",
        "acceleration", "robust", "resilient", "healthy",
    }

    NEGATIVE_WORDS = {
        "miss", "missed", "decline", "loss", "losses", "bearish",
        "downgrade", "underperform", "negative", "low", "drop", "fall",
        "crash", "plunge", "sink", "tumble", "selloff", "recession",
        "bankruptcy", "layoff", "layoffs", "investigation", "lawsuit",
        "fraud", "fine", "penalty", "warning", "risk", "threat",
        "volatile", "uncertainty", "fear", "concern", "weak", "miss",
        "disappointing", "cut", "reduce", "lower", "default", "debt",
        "downside", "collapse", "worst", "deceleration", "struggling",
        "impairment", "writedown", "restructuring",
    }

    INTENSIFIERS = {
        "very", "extremely", "significantly", "substantially",
        "dramatically", "sharply", "massive", "huge", "major",
    }

    NEGATORS = {
        "not", "no", "never", "neither", "nor", "don't", "doesn't",
        "didn't", "won't", "wouldn't", "couldn't", "shouldn't",
        "without", "barely", "hardly",
    }

    def analyze(self, text: str) -> SentimentScore:
        """Analyze text and return sentiment score."""
        if not text:
            return SentimentScore.from_score(0.0, 0.0)

        words = re.findall(r'\b\w+\b', text.lower())
        if not words:
            return SentimentScore.from_score(0.0, 0.0)

        pos_count = 0
        neg_count = 0
        intensity = 1.0
        negate = False

        for i, word in enumerate(words):
            if word in self.NEGATORS:
                negate = True
                continue

            if word in self.INTENSIFIERS:
                intensity = 1.5
                continue

            if word in self.POSITIVE_WORDS:
                if negate:
                    neg_count += intensity
                else:
                    pos_count += intensity
                negate = False
                intensity = 1.0
            elif word in self.NEGATIVE_WORDS:
                if negate:
                    pos_count += intensity
                else:
                    neg_count += intensity
                negate = False
                intensity = 1.0
            else:
                # Reset negate after 2 words
                if negate and i > 0:
                    negate = False
                intensity = 1.0

        total = pos_count + neg_count
        if total == 0:
            return SentimentScore.from_score(0.0, 0.1)

        score = (pos_count - neg_count) / total
        confidence = min(total / len(words) * 5, 1.0)  # scale by word density
        return SentimentScore.from_score(score, confidence)

    def analyze_headline(self, headline: str) -> SentimentScore:
        """Analyze headline with higher weight (headlines are more impactful)."""
        result = self.analyze(headline)
        result.confidence = min(result.confidence * 1.3, 1.0)
        return result

    def batch_analyze(self, texts: List[str]) -> List[SentimentScore]:
        """Analyze multiple texts."""
        return [self.analyze(t) for t in texts]


# ═══════════════════════════════════════════════════════════════════════════════
# 2. EntityExtractor — Extract tickers, people, orgs
# ═══════════════════════════════════════════════════════════════════════════════

class EntityExtractor:
    """Extract financial entities from text."""

    # Common ticker patterns
    TICKER_PATTERN = re.compile(r'\b([A-Z]{1,5})\b')
    CASHTAG_PATTERN = re.compile(r'\$([A-Z]{1,5})\b')

    # Common non-ticker uppercase words to exclude
    STOP_WORDS = {
        "THE", "AND", "FOR", "BUT", "NOT", "ARE", "WAS", "HAS", "HAD",
        "ITS", "WITH", "FROM", "WILL", "CAN", "ALL", "NEW", "ONE", "TWO",
        "CEO", "CFO", "CTO", "COO", "IPO", "SEC", "FDA", "FED", "GDP",
        "ETF", "NYSE", "NASDAQ", "DOW", "USA", "UK", "EU", "USD", "EUR",
        "AI", "API", "IT", "UP", "DOWN", "BUY", "SELL", "HOLD",
        "Q1", "Q2", "Q3", "Q4", "YOY", "QOQ", "EPS", "PE", "PB",
        "M&A", "RSI", "MACD", "SMA", "EMA", "ATR", "VWAP",
        "P&L", "ROE", "ROI", "EBITDA", "IS", "IN", "ON", "AT", "TO",
        "BE", "OR", "AS", "AN", "DO", "IF", "SO", "NO", "BY", "OF",
        "A", "I",
    }

    def extract_tickers(self, text: str,
                        known_tickers: Optional[Set[str]] = None) -> List[str]:
        """Extract stock tickers from text."""
        # First try cashtags (most reliable)
        cashtags = self.CASHTAG_PATTERN.findall(text)

        # Then uppercase words
        upper_words = self.TICKER_PATTERN.findall(text)

        tickers = set(cashtags)
        for word in upper_words:
            if word in self.STOP_WORDS:
                continue
            if known_tickers and word in known_tickers:
                tickers.add(word)
            elif len(word) <= 4 and word not in self.STOP_WORDS:
                # Only short words that aren't stop words
                if known_tickers is None:
                    tickers.add(word)

        return sorted(tickers)

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract named entities from text."""
        entities: Dict[str, List[str]] = {
            "tickers": self.extract_tickers(text),
            "numbers": [],
            "percentages": [],
            "currencies": [],
        }

        # Extract numbers with $ prefix
        currencies = re.findall(r'\$[\d,]+\.?\d*[BMK]?', text)
        entities["currencies"] = currencies

        # Extract percentages
        percentages = re.findall(r'[\d.]+%', text)
        entities["percentages"] = percentages

        # Extract large numbers
        numbers = re.findall(r'\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b', text)
        entities["numbers"] = numbers

        return entities


# ═══════════════════════════════════════════════════════════════════════════════
# 3. TopicClassifier — Classify news category
# ═══════════════════════════════════════════════════════════════════════════════

class TopicClassifier:
    """Classify news articles into financial categories."""

    CATEGORY_KEYWORDS: Dict[NewsCategory, Set[str]] = {
        NewsCategory.EARNINGS: {
            "earnings", "revenue", "quarterly", "q1", "q2", "q3", "q4",
            "eps", "profit", "income", "sales", "fiscal", "guidance",
            "beat", "miss", "estimate", "forecast",
        },
        NewsCategory.MERGER_ACQUISITION: {
            "merger", "acquisition", "acquire", "takeover", "buyout",
            "deal", "combine", "merge", "bid", "hostile", "offer",
        },
        NewsCategory.REGULATION: {
            "regulation", "regulatory", "sec", "fda", "antitrust",
            "compliance", "fine", "penalty", "ruling", "legislation",
            "ban", "approval", "cleared",
        },
        NewsCategory.PRODUCT_LAUNCH: {
            "launch", "release", "unveil", "announce", "introduce",
            "product", "service", "platform", "feature", "update",
        },
        NewsCategory.MANAGEMENT: {
            "ceo", "cfo", "cto", "executive", "resign", "appoint",
            "hire", "board", "director", "leadership", "succession",
        },
        NewsCategory.LEGAL: {
            "lawsuit", "sue", "litigation", "settlement", "court",
            "patent", "investigation", "fraud", "indictment",
        },
        NewsCategory.MACRO: {
            "fed", "interest rate", "inflation", "gdp", "unemployment",
            "jobs", "payroll", "treasury", "monetary", "fiscal",
            "recession", "stimulus", "taper",
        },
        NewsCategory.DIVIDEND: {
            "dividend", "yield", "payout", "distribution", "ex-dividend",
        },
        NewsCategory.BUYBACK: {
            "buyback", "repurchase", "share repurchase", "stock buyback",
        },
        NewsCategory.INSIDER: {
            "insider", "form 4", "insider trading", "insider buying",
            "insider selling", "officer", "director purchase",
        },
        NewsCategory.ANALYST: {
            "analyst", "upgrade", "downgrade", "target", "rating",
            "overweight", "underweight", "outperform", "underperform",
            "coverage", "initiate", "price target",
        },
        NewsCategory.IPO: {
            "ipo", "initial public offering", "public offering",
            "debut", "listing", "spac",
        },
    }

    def classify(self, text: str) -> List[NewsCategory]:
        """Classify text into one or more categories."""
        text_lower = text.lower()
        scores: Dict[NewsCategory, int] = {}
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            if count > 0:
                scores[category] = count

        if not scores:
            return [NewsCategory.GENERAL]

        sorted_cats = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        # Return top categories (those with at least half the max score)
        max_score = sorted_cats[0][1]
        return [cat for cat, sc in sorted_cats if sc >= max_score * 0.5]

    def classify_batch(self, texts: List[str]) -> List[List[NewsCategory]]:
        return [self.classify(t) for t in texts]


# ═══════════════════════════════════════════════════════════════════════════════
# 4. NewsFeed — Article management
# ═══════════════════════════════════════════════════════════════════════════════

class NewsFeed:
    """Manage news articles with dedup and freshness."""

    def __init__(self, max_articles: int = 10000):
        self._articles: Dict[str, NewsArticle] = {}
        self._by_symbol: Dict[str, List[str]] = defaultdict(list)
        self._max = max_articles

    def add_article(self, article: NewsArticle) -> bool:
        """Add article with dedup. Returns False if duplicate."""
        if article.id in self._articles:
            return False
        self._articles[article.id] = article
        for sym in article.symbols:
            self._by_symbol[sym].append(article.id)
        self._trim()
        return True

    def get_article(self, article_id: str) -> Optional[NewsArticle]:
        return self._articles.get(article_id)

    def get_by_symbol(self, symbol: str, limit: int = 50) -> List[NewsArticle]:
        ids = self._by_symbol.get(symbol.upper(), [])
        articles = [self._articles[aid] for aid in ids if aid in self._articles]
        articles.sort(key=lambda a: a.published_at, reverse=True)
        return articles[:limit]

    def get_latest(self, limit: int = 50) -> List[NewsArticle]:
        articles = sorted(self._articles.values(),
                          key=lambda a: a.published_at, reverse=True)
        return articles[:limit]

    def get_by_category(self, category: NewsCategory,
                        limit: int = 50) -> List[NewsArticle]:
        result = [a for a in self._articles.values() if category in a.categories]
        result.sort(key=lambda a: a.published_at, reverse=True)
        return result[:limit]

    def search(self, query: str, limit: int = 50) -> List[NewsArticle]:
        q = query.lower()
        result = [a for a in self._articles.values()
                  if q in a.headline.lower() or q in a.summary.lower()]
        result.sort(key=lambda a: a.published_at, reverse=True)
        return result[:limit]

    def mark_read(self, article_id: str) -> bool:
        article = self._articles.get(article_id)
        if article:
            article.read = True
            return True
        return False

    def unread_count(self, symbol: str = "") -> int:
        if symbol:
            articles = self.get_by_symbol(symbol)
        else:
            articles = list(self._articles.values())
        return sum(1 for a in articles if not a.read)

    @property
    def count(self) -> int:
        return len(self._articles)

    def _trim(self):
        if len(self._articles) > self._max:
            sorted_articles = sorted(self._articles.values(),
                                      key=lambda a: a.published_at)
            to_remove = len(self._articles) - self._max
            for article in sorted_articles[:to_remove]:
                del self._articles[article.id]
                for sym in article.symbols:
                    if article.id in self._by_symbol[sym]:
                        self._by_symbol[sym].remove(article.id)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. SentimentAggregator — Aggregate sentiment
# ═══════════════════════════════════════════════════════════════════════════════

class SentimentAggregator:
    """Aggregate sentiment across articles, symbols, time."""

    @staticmethod
    def by_symbol(articles: List[NewsArticle]) -> Dict[str, Dict[str, Any]]:
        """Aggregate sentiment by symbol."""
        symbol_scores: Dict[str, List[float]] = defaultdict(list)
        for article in articles:
            if article.sentiment:
                for sym in article.symbols:
                    symbol_scores[sym].append(article.sentiment.score)

        result = {}
        for sym, scores in symbol_scores.items():
            arr = np.array(scores)
            result[sym] = {
                "avg_sentiment": float(np.mean(arr)),
                "median_sentiment": float(np.median(arr)),
                "std_sentiment": float(np.std(arr)),
                "article_count": len(scores),
                "bullish_count": int(np.sum(arr > 0.15)),
                "bearish_count": int(np.sum(arr < -0.15)),
                "neutral_count": int(np.sum(np.abs(arr) <= 0.15)),
            }
        return result

    @staticmethod
    def by_category(articles: List[NewsArticle]) -> Dict[str, Dict[str, Any]]:
        """Aggregate sentiment by news category."""
        cat_scores: Dict[str, List[float]] = defaultdict(list)
        for article in articles:
            if article.sentiment:
                for cat in article.categories:
                    cat_scores[cat.value].append(article.sentiment.score)

        result = {}
        for cat, scores in cat_scores.items():
            arr = np.array(scores)
            result[cat] = {
                "avg_sentiment": float(np.mean(arr)),
                "article_count": len(scores),
            }
        return result

    @staticmethod
    def time_series(articles: List[NewsArticle],
                    bucket_seconds: float = 3600) -> List[Dict[str, Any]]:
        """Sentiment time series in fixed buckets."""
        if not articles:
            return []

        buckets: Dict[int, List[float]] = defaultdict(list)
        for article in articles:
            if article.sentiment:
                bucket = int(article.published_at / bucket_seconds)
                buckets[bucket].append(article.sentiment.score)

        result = []
        for bucket in sorted(buckets.keys()):
            scores = buckets[bucket]
            result.append({
                "bucket": bucket,
                "timestamp": bucket * bucket_seconds,
                "avg_sentiment": float(np.mean(scores)),
                "article_count": len(scores),
            })
        return result

    @staticmethod
    def overall(articles: List[NewsArticle]) -> Dict[str, Any]:
        """Overall sentiment for a set of articles."""
        scores = [a.sentiment.score for a in articles if a.sentiment]
        if not scores:
            return {"avg_sentiment": 0.0, "count": 0, "label": "neutral"}
        arr = np.array(scores)
        avg = float(np.mean(arr))
        label = SentimentScore.from_score(avg).label.value
        return {
            "avg_sentiment": avg,
            "median_sentiment": float(np.median(arr)),
            "std_sentiment": float(np.std(arr)),
            "count": len(scores),
            "label": label,
            "bullish_pct": float(np.sum(arr > 0.15) / len(arr) * 100),
            "bearish_pct": float(np.sum(arr < -0.15) / len(arr) * 100),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 6. MarketImpactEstimator — Estimate price impact from news
# ═══════════════════════════════════════════════════════════════════════════════

class MarketImpactEstimator:
    """Estimate potential market impact from news."""

    # Impact multipliers by category
    CATEGORY_IMPACT: Dict[NewsCategory, float] = {
        NewsCategory.EARNINGS: 2.0,
        NewsCategory.MERGER_ACQUISITION: 2.5,
        NewsCategory.REGULATION: 1.5,
        NewsCategory.LEGAL: 1.3,
        NewsCategory.MANAGEMENT: 1.2,
        NewsCategory.MACRO: 1.8,
        NewsCategory.ANALYST: 1.4,
        NewsCategory.DIVIDEND: 1.1,
        NewsCategory.BUYBACK: 1.1,
        NewsCategory.IPO: 1.6,
        NewsCategory.PRODUCT_LAUNCH: 1.0,
        NewsCategory.INSIDER: 1.3,
        NewsCategory.SECTOR: 0.8,
        NewsCategory.TECHNICAL: 0.5,
        NewsCategory.GENERAL: 0.5,
    }

    # Source reliability weights
    SOURCE_WEIGHT: Dict[NewsSource, float] = {
        NewsSource.REUTERS: 1.0,
        NewsSource.BLOOMBERG: 1.0,
        NewsSource.WSJ: 0.95,
        NewsSource.SEC: 1.0,
        NewsSource.CNBC: 0.8,
        NewsSource.ANALYST: 0.85,
        NewsSource.PR: 0.7,
        NewsSource.SOCIAL: 0.4,
        NewsSource.CUSTOM: 0.5,
    }

    def estimate_impact(self, article: NewsArticle) -> Dict[str, Any]:
        """Estimate market impact of a news article."""
        if not article.sentiment:
            return {"impact_score": 0.0, "direction": "neutral", "confidence": 0.0}

        # Base impact from sentiment
        base = abs(article.sentiment.score)

        # Category multiplier
        cat_mult = max(self.CATEGORY_IMPACT.get(c, 0.5) for c in article.categories) \
            if article.categories else 0.5

        # Source weight
        src_weight = self.SOURCE_WEIGHT.get(article.source, 0.5)

        # Freshness decay (newer = more impact)
        age_hours = article.age_seconds / 3600
        freshness = np.exp(-age_hours / 24)  # 24-hour half-life

        impact_score = base * cat_mult * src_weight * freshness
        direction = "bullish" if article.sentiment.score > 0 else "bearish"
        if abs(article.sentiment.score) < 0.15:
            direction = "neutral"

        return {
            "impact_score": float(min(impact_score, 1.0)),
            "direction": direction,
            "confidence": float(article.sentiment.confidence * src_weight),
            "category_multiplier": cat_mult,
            "source_weight": src_weight,
            "freshness": float(freshness),
        }

    def rank_by_impact(self, articles: List[NewsArticle]) -> List[Tuple[float, NewsArticle]]:
        """Rank articles by estimated market impact."""
        scored = []
        for article in articles:
            impact = self.estimate_impact(article)
            scored.append((impact["impact_score"], article))
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored


# ═══════════════════════════════════════════════════════════════════════════════
# 7. NewsCorrelator — Correlate news with price action
# ═══════════════════════════════════════════════════════════════════════════════

class NewsCorrelator:
    """Correlate news flow with price action."""

    @staticmethod
    def sentiment_vs_returns(sentiment_series: List[float],
                              return_series: List[float]) -> Dict[str, float]:
        """Compute correlation between sentiment and returns."""
        if len(sentiment_series) < 3 or len(return_series) < 3:
            return {"correlation": 0.0, "lag_1_corr": 0.0}

        min_len = min(len(sentiment_series), len(return_series))
        sent = np.array(sentiment_series[:min_len])
        ret = np.array(return_series[:min_len])

        if np.std(sent) == 0 or np.std(ret) == 0:
            return {"correlation": 0.0, "lag_1_corr": 0.0}

        corr = float(np.corrcoef(sent, ret)[0, 1])

        # Lag-1 correlation (sentiment leads returns)
        if min_len > 3:
            lag_corr = float(np.corrcoef(sent[:-1], ret[1:])[0, 1])
        else:
            lag_corr = 0.0

        return {"correlation": corr, "lag_1_corr": lag_corr,
                "samples": min_len}

    @staticmethod
    def news_volume_vs_volatility(news_counts: List[int],
                                   volatility: List[float]) -> Dict[str, float]:
        """Correlate news volume with price volatility."""
        if len(news_counts) < 3 or len(volatility) < 3:
            return {"correlation": 0.0}

        min_len = min(len(news_counts), len(volatility))
        nc = np.array(news_counts[:min_len], dtype=float)
        vol = np.array(volatility[:min_len])

        if np.std(nc) == 0 or np.std(vol) == 0:
            return {"correlation": 0.0}

        return {"correlation": float(np.corrcoef(nc, vol)[0, 1]),
                "samples": min_len}


# ═══════════════════════════════════════════════════════════════════════════════
# 8. NewsSentimentEngine — Orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class NewsSentimentEngine:
    """Bloomberg-grade news & sentiment analysis system."""

    def __init__(self):
        self.feed = NewsFeed()
        self.analyzer = SentimentAnalyzer()
        self.entity_extractor = EntityExtractor()
        self.topic_classifier = TopicClassifier()
        self.aggregator = SentimentAggregator()
        self.impact_estimator = MarketImpactEstimator()
        self.correlator = NewsCorrelator()

    def ingest_article(self, headline: str, summary: str = "",
                       body: str = "", source: str = "custom",
                       url: str = "", symbols: Optional[List[str]] = None,
                       published_at: Optional[float] = None) -> NewsArticle:
        """Ingest, analyze, and store a news article."""
        # Analyze sentiment
        full_text = f"{headline} {summary} {body}"
        sentiment = self.analyzer.analyze(full_text)

        # Extract entities
        entities = self.entity_extractor.extract_entities(full_text)

        # Classify topic
        categories = self.topic_classifier.classify(full_text)

        # Build article
        src = NewsSource.CUSTOM
        for s in NewsSource:
            if s.value == source.lower():
                src = s
                break

        article = NewsArticle(
            headline=headline, summary=summary, body=body,
            source=src, url=url,
            symbols=symbols or entities.get("tickers", []),
            categories=categories, sentiment=sentiment,
            entities=entities,
            published_at=published_at or time.time(),
        )

        # Compute relevance
        impact = self.impact_estimator.estimate_impact(article)
        article.relevance_score = impact["impact_score"]

        # Store
        self.feed.add_article(article)
        return article

    def get_symbol_sentiment(self, symbol: str,
                              limit: int = 50) -> Dict[str, Any]:
        """Get aggregated sentiment for a symbol."""
        articles = self.feed.get_by_symbol(symbol, limit)
        if not articles:
            return {"symbol": symbol, "articles": 0, "sentiment": None}

        overall = self.aggregator.overall(articles)
        return {
            "symbol": symbol,
            "articles": len(articles),
            "sentiment": overall,
            "latest": articles[0].to_dict() if articles else None,
        }

    def get_market_sentiment(self) -> Dict[str, Any]:
        """Get overall market sentiment from all articles."""
        articles = self.feed.get_latest(200)
        overall = self.aggregator.overall(articles)
        by_category = self.aggregator.by_category(articles)
        return {
            "overall": overall,
            "by_category": by_category,
            "article_count": len(articles),
        }

    def get_top_movers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get symbols with strongest sentiment bias."""
        articles = self.feed.get_latest(200)
        by_symbol = self.aggregator.by_symbol(articles)
        sorted_symbols = sorted(by_symbol.items(),
                                 key=lambda x: abs(x[1]["avg_sentiment"]),
                                 reverse=True)
        return [{"symbol": sym, **data} for sym, data in sorted_symbols[:limit]]

    def get_high_impact(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get highest impact news articles."""
        articles = self.feed.get_latest(100)
        ranked = self.impact_estimator.rank_by_impact(articles)
        return [{"impact_score": score, "article": a.to_dict()}
                for score, a in ranked[:limit]]

    def search_news(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        articles = self.feed.search(query, limit)
        return [a.to_dict() for a in articles]

    def capabilities(self) -> Dict[str, Any]:
        return {
            "total_articles": self.feed.count,
            "categories": [c.value for c in NewsCategory],
            "sources": [s.value for s in NewsSource],
            "features": [
                "sentiment_analysis", "entity_extraction",
                "topic_classification", "impact_estimation",
                "sentiment_aggregation", "news_correlation",
                "symbol_sentiment", "market_sentiment",
                "search", "dedup", "freshness_decay",
            ],
        }
