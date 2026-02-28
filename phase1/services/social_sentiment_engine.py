"""
Social Sentiment Engine — Reddit/StockTwits/Twitter sentiment scoring, volume spike
detection, sentiment momentum, wallstreetbets analysis, short squeeze candidates,
social spread indicators, and crowd wisdom aggregation.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class SentimentPolarity(str, Enum):
    VERY_BULLISH = "very_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    VERY_BEARISH = "very_bearish"


class SentimentSource(str, Enum):
    REDDIT = "reddit"
    STOCKTWITS = "stocktwits"
    TWITTER = "twitter"
    NEWS = "news"
    AGGREGATE = "aggregate"


@dataclass
class SocialPost:
    """Single social media post/mention."""
    post_id: str
    source: SentimentSource
    symbol: str
    text: str
    upvotes: int = 0
    comments: int = 0
    shares: int = 0
    author_followers: int = 0
    timestamp_hour: int = 0         # hour of day
    is_verified_author: bool = False

    @property
    def engagement_score(self) -> float:
        """Weighted engagement metric."""
        return self.upvotes * 1.0 + self.comments * 2.0 + self.shares * 3.0

    @property
    def reach_score(self) -> float:
        """Estimated reach based on engagement + author followers."""
        base = self.engagement_score
        follower_boost = math.log1p(self.author_followers) * 0.5
        if self.is_verified_author:
            follower_boost *= 2
        return base + follower_boost

    def to_dict(self) -> dict:
        return {
            "post_id": self.post_id,
            "source": self.source.value,
            "symbol": self.symbol,
            "text_length": len(self.text),
            "upvotes": self.upvotes,
            "engagement_score": round(self.engagement_score, 2),
            "reach_score": round(self.reach_score, 2),
        }


# ── Text Sentiment Scoring ────────────────────────────────────────────

class TextSentimentAnalyzer:
    """Lexicon-based sentiment scoring tailored to financial text."""

    BULLISH_WORDS = {
        "bullish", "bull", "moon", "rocket", "buy", "calls", "long", "breakout",
        "squeeze", "soaring", "pumping", "surge", "spike", "green", "rip", "flying",
        "holding", "hodl", "diamond", "hands", "winning", "profits", "gains",
        "upgrade", "beat", "record", "strong", "growth", "positive",
    }

    BEARISH_WORDS = {
        "bearish", "bear", "puts", "short", "dump", "crash", "falling", "drop",
        "collapse", "sinking", "sell", "sold", "red", "bleed", "tank", "rekt",
        "loss", "miss", "downgrade", "weak", "negative", "correction", "bubble",
        "overvalued", "overhyped",
    }

    AMPLIFIERS = {"very", "extremely", "super", "massive", "huge", "insane", "crazy", "big"}
    NEGATORS = {"not", "no", "never", "don't", "doesn't", "won't", "wouldn't", "isn't"}

    EMOJI_SENTIMENT: dict[str, float] = {
        "🚀": 1.5, "🌕": 1.0, "📈": 1.0, "💎": 0.7, "🤑": 0.8,
        "🐂": 0.8, "✅": 0.5, "🔥": 0.7, "💚": 0.5,
        "📉": -1.0, "🐻": -0.8, "🩸": -0.8, "💀": -0.6, "❌": -0.5,
        "😭": -0.4, "😡": -0.5,
    }

    @staticmethod
    def tokenize(text: str) -> list[str]:
        text_lower = text.lower()
        tokens = re.findall(r"[a-z']+|[^\s]", text_lower)
        return tokens

    @classmethod
    def score_text(cls, text: str) -> float:
        """
        Score text from -1 (very bearish) to +1 (very bullish).
        """
        tokens = cls.tokenize(text)
        score = 0.0
        i = 0
        while i < len(tokens):
            token = tokens[i]

            # Emoji check
            if token in cls.EMOJI_SENTIMENT:
                score += cls.EMOJI_SENTIMENT[token]
                i += 1
                continue

            # Sentiment word
            multiplier = 1.0
            if i > 0 and tokens[i - 1] in cls.AMPLIFIERS:
                multiplier = 1.5
            if i > 0 and tokens[i - 1] in cls.NEGATORS:
                multiplier = -1.0

            if token in cls.BULLISH_WORDS:
                score += 1.0 * multiplier
            elif token in cls.BEARISH_WORDS:
                score -= 1.0 * multiplier

            i += 1

        # Normalize by text length
        word_count = max(len(tokens), 1)
        normalized = score / math.log1p(word_count)
        # Clip to [-1, 1]
        return round(max(-1.0, min(1.0, normalized)), 4)

    @classmethod
    def polarity(cls, score: float) -> SentimentPolarity:
        if score > 0.5:
            return SentimentPolarity.VERY_BULLISH
        if score > 0.15:
            return SentimentPolarity.BULLISH
        if score < -0.5:
            return SentimentPolarity.VERY_BEARISH
        if score < -0.15:
            return SentimentPolarity.BEARISH
        return SentimentPolarity.NEUTRAL


# ── Mention Volume Analyzer ───────────────────────────────────────────

class MentionVolumeAnalyzer:
    """Track mention counts and detect unusual spikes."""

    @staticmethod
    def mentions_per_hour(posts: list[SocialPost], symbol: str) -> dict[int, int]:
        """Count mentions by hour of day."""
        counts: dict[int, int] = {h: 0 for h in range(24)}
        for p in posts:
            if p.symbol.upper() == symbol.upper():
                counts[p.timestamp_hour] += 1
        return counts

    @staticmethod
    def spike_detection(
        historical_avg_per_hour: float,
        current_mentions: int,
        threshold_sigma: float = 2.0,
        historical_std: float = 5.0,
    ) -> dict:
        """Detect mention spike vs. baseline."""
        if historical_std == 0:
            z_score = 0.0
        else:
            z_score = (current_mentions - historical_avg_per_hour) / historical_std
        is_spike = z_score >= threshold_sigma
        return {
            "current_mentions": current_mentions,
            "historical_avg": round(historical_avg_per_hour, 2),
            "z_score": round(z_score, 4),
            "is_spike": is_spike,
            "spike_magnitude": round(current_mentions / max(historical_avg_per_hour, 1), 2),
        }

    @staticmethod
    def mention_trend(hourly_counts: list[int]) -> dict:
        """Slope of mention trend."""
        n = len(hourly_counts)
        if n < 2:
            return {"slope": 0, "accelerating": False}
        x = list(range(n))
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(hourly_counts)
        num = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, hourly_counts))
        den = sum((xi - x_mean) ** 2 for xi in x)
        slope = num / den if den != 0 else 0
        return {
            "slope": round(slope, 4),
            "accelerating": slope > 0,
            "recent_vs_earlier": round(
                statistics.mean(hourly_counts[-max(n // 4, 1):]) /
                max(statistics.mean(hourly_counts[:max(n // 4, 1)]), 1), 4
            ),
        }


# ── Aggregate Sentiment Score ─────────────────────────────────────────

class AggregateSentimentScorer:
    """Aggregate multiple posts into a single sentiment signal."""

    @staticmethod
    def weighted_sentiment(posts: list[SocialPost]) -> float:
        """Score posts weighted by reach."""
        if not posts:
            return 0.0
        total_weight = 0.0
        weighted_sum = 0.0
        for post in posts:
            score = TextSentimentAnalyzer.score_text(post.text)
            weight = post.reach_score + 0.1
            weighted_sum += score * weight
            total_weight += weight
        if total_weight == 0:
            return 0.0
        return round(weighted_sum / total_weight, 4)

    @staticmethod
    def bull_bear_ratio(posts: list[SocialPost]) -> dict:
        """Fraction of posts classified bullish/neutral/bearish."""
        if not posts:
            return {}
        counts = {p.value: 0 for p in SentimentPolarity}
        for post in posts:
            score = TextSentimentAnalyzer.score_text(post.text)
            pol = TextSentimentAnalyzer.polarity(score)
            counts[pol.value] += 1

        n = len(posts)
        return {
            "total_posts": n,
            "distribution": {k: round(v / n, 4) for k, v in counts.items()},
            "bull_bear_ratio": round(
                (counts[SentimentPolarity.BULLISH.value] + counts[SentimentPolarity.VERY_BULLISH.value])
                / max(counts[SentimentPolarity.BEARISH.value] + counts[SentimentPolarity.VERY_BEARISH.value], 1),
                4,
            ),
        }

    @staticmethod
    def source_breakdown(posts: list[SocialPost]) -> dict:
        """Sentiment by source."""
        by_source: dict[str, list[SocialPost]] = {}
        for p in posts:
            by_source.setdefault(p.source.value, []).append(p)

        return {
            src: {
                "n_posts": len(ps),
                "avg_sentiment": AggregateSentimentScorer.weighted_sentiment(ps),
                "polarity": TextSentimentAnalyzer.polarity(
                    AggregateSentimentScorer.weighted_sentiment(ps)
                ).value,
            }
            for src, ps in by_source.items()
        }


# ── WSB / Retail Investor Analysis ───────────────────────────────────

class WallStreetBetsAnalyzer:
    """WallStreetBets-specific patterns: YOLO calls, squeeze plays, meme stocks."""

    WSB_KEYWORDS = {
        "yolo", "tendies", "retard", "ape", "diamond hands", "paper hands",
        "short squeeze", "gamma squeeze", "options", "calls", "puts", "hedge fund",
        "gme", "amc", "bb", "meme", "degenerates",
    }

    SQUEEZE_KEYWORDS = {
        "squeeze", "short interest", "float", "days to cover", "short ratio",
        "gamma", "delta", "iv", "max pain",
    }

    @classmethod
    def is_wsb_style(cls, text: str) -> bool:
        text_lower = text.lower()
        return any(kw in text_lower for kw in cls.WSB_KEYWORDS)

    @classmethod
    def squeeze_candidate_mentions(cls, posts: list[SocialPost]) -> list[str]:
        """Symbols mentioned with squeeze-like language."""
        squeeze_symbols = []
        for post in posts:
            text_lower = post.text.lower()
            if any(kw in text_lower for kw in cls.SQUEEZE_KEYWORDS):
                squeeze_symbols.append(post.symbol)
        return squeeze_symbols

    @classmethod
    def yolo_ratio(cls, posts: list[SocialPost]) -> float:
        """Fraction of posts with YOLO-style high conviction."""
        yolo_words = {"yolo", "all in", "life savings", "mortgage", "100%", "everything"}
        count = sum(1 for p in posts if any(w in p.text.lower() for w in yolo_words))
        return round(count / max(len(posts), 1), 4)


# ── Social Spread Indicator ───────────────────────────────────────────

class SocialSpreadIndicator:
    """
    Social Spread = how spread out / controversial opinion is.
    High bull_bear_ratio variance = contested stock.
    """

    @staticmethod
    def controversy_score(posts: list[SocialPost]) -> float:
        """
        Score 0-100. High = split opinion (some very bullish, some very bearish).
        """
        if len(posts) < 5:
            return 50.0
        scores = [TextSentimentAnalyzer.score_text(p.text) for p in posts]
        std = statistics.stdev(scores) if len(scores) > 1 else 0
        # Map std range 0-0.7+ to 0-100
        return round(min(std / 0.7, 1.0) * 100, 2)

    @staticmethod
    def sentiment_momentum(
        daily_scores: list[float],  # daily avg sentiment over time
        lookback: int = 5,
    ) -> dict:
        """5-day momentum in sentiment."""
        if len(daily_scores) < 2:
            return {"momentum": 0, "direction": "neutral"}
        recent = daily_scores[-lookback:]
        if len(recent) < 2:
            return {"momentum": 0, "direction": "neutral"}
        slope = recent[-1] - recent[0]
        return {
            "momentum": round(slope, 4),
            "direction": "improving" if slope > 0.05 else "deteriorating" if slope < -0.05 else "stable",
            "current_score": round(recent[-1], 4),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class SocialSentimentEngine:
    """Top-level orchestrator for social sentiment analysis."""

    def __init__(self):
        self.text = TextSentimentAnalyzer()
        self.volume = MentionVolumeAnalyzer()
        self.aggregator = AggregateSentimentScorer()
        self.wsb = WallStreetBetsAnalyzer()
        self.spread = SocialSpreadIndicator()

    def score_post(self, text: str) -> dict:
        score = self.text.score_text(text)
        return {
            "score": score,
            "polarity": self.text.polarity(score).value,
        }

    def aggregate(self, posts: list[SocialPost]) -> dict:
        if not posts:
            return {}
        score = self.aggregator.weighted_sentiment(posts)
        return {
            "weighted_sentiment": score,
            "polarity": self.text.polarity(score).value,
            "bull_bear_ratio": self.aggregator.bull_bear_ratio(posts),
            "source_breakdown": self.aggregator.source_breakdown(posts),
            "n_posts": len(posts),
        }

    def detect_spike(
        self,
        symbol: str,
        posts: list[SocialPost],
        historical_avg: float = 10.0,
        historical_std: float = 5.0,
    ) -> dict:
        count = sum(1 for p in posts if p.symbol.upper() == symbol.upper())
        return self.volume.spike_detection(historical_avg, count, historical_std=historical_std)

    def controversy(self, posts: list[SocialPost]) -> float:
        return self.spread.controversy_score(posts)

    def yolo_ratio(self, posts: list[SocialPost]) -> float:
        return self.wsb.yolo_ratio(posts)

    def squeeze_candidates(self, posts: list[SocialPost]) -> list[str]:
        return list(set(self.wsb.squeeze_candidate_mentions(posts)))

    def full_analysis(self, symbol: str, posts: list[SocialPost]) -> dict:
        """Comprehensive social sentiment analysis for a symbol."""
        symbol_posts = [p for p in posts if p.symbol.upper() == symbol.upper()]
        return {
            "symbol": symbol,
            "aggregate": self.aggregate(symbol_posts),
            "controversy_score": self.controversy(symbol_posts),
            "yolo_ratio": self.yolo_ratio(symbol_posts),
            "is_squeeze_candidate": symbol in self.wsb.squeeze_candidate_mentions(symbol_posts),
            "mention_count": len(symbol_posts),
        }

    def capabilities(self) -> dict:
        return {
            "engine": "SocialSentimentEngine",
            "version": "1.0.0",
            "features": [
                "lexicon_based_text_sentiment",
                "emoji_sentiment_scoring",
                "amplifier_negator_handling",
                "weighted_by_engagement_reach",
                "bull_bear_ratio",
                "source_breakdown_reddit_twitter",
                "mention_volume_spike_detection",
                "mention_hourly_trend",
                "wsb_yolo_ratio",
                "short_squeeze_candidate_detection",
                "controversy_score",
                "sentiment_momentum_5day",
                "aggregate_social_sentiment",
                "per_symbol_full_analysis",
            ],
        }
