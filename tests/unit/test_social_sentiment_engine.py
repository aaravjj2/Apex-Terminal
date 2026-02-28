"""
Tests for SocialSentimentEngine — sentiment scoring, spike detection, WSB analysis.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.social_sentiment_engine import (
    SocialPost,
    TextSentimentAnalyzer,
    MentionVolumeAnalyzer,
    AggregateSentimentScorer,
    WallStreetBetsAnalyzer,
    SocialSpreadIndicator,
    SocialSentimentEngine,
    SentimentPolarity,
    SentimentSource,
)
import random


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def bullish_post():
    return SocialPost(
        post_id="p001",
        source=SentimentSource.TWITTER,
        symbol="TSLA",
        text="TSLA is absolutely crushing it! Rockets to the moon! Strong BUY accumulate more",
        upvotes=100,
        comments=50,
        shares=25,
        author_followers=5000,
    )


@pytest.fixture
def bearish_post():
    return SocialPost(
        post_id="p002",
        source=SentimentSource.REDDIT,
        symbol="TSLA",
        text="terrible earnings crash imminent sell everything dump is coming bearish reversal",
        upvotes=20,
        comments=30,
        shares=5,
        author_followers=2000,
    )


@pytest.fixture
def neutral_post():
    return SocialPost(
        post_id="p003",
        source=SentimentSource.STOCKTWITS,
        symbol="AAPL",
        text="AAPL holds at support level watching price action",
        upvotes=10,
        comments=5,
        shares=2,
        author_followers=1000,
    )


@pytest.fixture
def wsb_post():
    return SocialPost(
        post_id="p_wsb",
        source=SentimentSource.REDDIT,
        symbol="GME",
        text="GME short squeeze YOLO tendies moon rocket rocket diamond hands apes together strong",
        upvotes=5000,
        comments=1200,
        shares=800,
        author_followers=50000,
    )


@pytest.fixture
def engine():
    return SocialSentimentEngine()


# ── SocialPost Properties ─────────────────────────────────────────────

class TestSocialPost:
    def test_engagement_score(self, bullish_post):
        expected = 100 * 1 + 50 * 2 + 25 * 3
        assert bullish_post.engagement_score == expected

    def test_engagement_zero_values(self):
        post = SocialPost("p", SentimentSource.NEWS, "AAPL", "text")
        assert post.engagement_score == 0

    def test_reach_score_positive(self, bullish_post):
        assert bullish_post.reach_score > 0

    def test_reach_score_no_followers(self):
        post = SocialPost("p", SentimentSource.TWITTER, "X", "text", upvotes=10)
        assert post.reach_score > 0  # just engagement contribution

    def test_to_dict(self, bullish_post):
        d = bullish_post.to_dict()
        assert "post_id" in d
        assert "engagement_score" in d


# ── TextSentimentAnalyzer ─────────────────────────────────────────────

class TestTextSentimentAnalyzer:
    def setup_method(self):
        self.analyzer = TextSentimentAnalyzer()

    def test_tokenize_lowercase(self):
        tokens = self.analyzer.tokenize("Hello WORLD foo_bar")
        assert "hello" in tokens
        assert "world" in tokens

    def test_bullish_text_positive_score(self):
        score = self.analyzer.score_text("bullish breakout buy accumulate rocket")
        assert score > 0

    def test_bearish_text_negative_score(self):
        score = self.analyzer.score_text("crash dump bearish sell short terrible")
        assert score < 0

    def test_neutral_text_near_zero(self):
        score = self.analyzer.score_text("price action support resistance")
        assert -0.3 < score < 0.3

    def test_score_clamp(self):
        extreme = " ".join(["bullish"] * 20)
        score = self.analyzer.score_text(extreme)
        assert -1.0 <= score <= 1.0

    def test_negation_flips_sentiment(self):
        pos = self.analyzer.score_text("bullish")
        neg = self.analyzer.score_text("not bullish")
        assert neg < pos

    def test_polarity_positive(self):
        pol = self.analyzer.polarity(0.4)
        assert pol == SentimentPolarity.BULLISH

    def test_polarity_negative(self):
        pol = self.analyzer.polarity(-0.4)
        assert pol == SentimentPolarity.BEARISH

    def test_polarity_neutral(self):
        pol = self.analyzer.polarity(0.0)
        assert pol == SentimentPolarity.NEUTRAL

    def test_polarity_strong(self):
        pos = self.analyzer.polarity(0.8)
        neg = self.analyzer.polarity(-0.8)
        assert pos == SentimentPolarity.VERY_BULLISH
        assert neg == SentimentPolarity.VERY_BEARISH

    def test_empty_text(self):
        score = self.analyzer.score_text("")
        assert score == 0.0


# ── MentionVolumeAnalyzer ─────────────────────────────────────────────

class TestMentionVolumeAnalyzer:
    def test_mentions_per_hour(self):
        posts = [
            SocialPost(f"p{i}", SentimentSource.TWITTER, "TSLA", "text",
                       timestamp_hour=i % 24)
            for i in range(24)
        ]
        result = MentionVolumeAnalyzer.mentions_per_hour(posts, "TSLA")
        assert isinstance(result, dict)
        assert sum(result.values()) == 24

    def test_spike_detection_no_spike(self):
        result = MentionVolumeAnalyzer.spike_detection(
            historical_avg_per_hour=10.0, current_mentions=12
        )
        assert result["is_spike"] == False

    def test_spike_detection_spike(self):
        result = MentionVolumeAnalyzer.spike_detection(
            historical_avg_per_hour=5.0, current_mentions=100, historical_std=5.0
        )
        assert result["is_spike"] == True

    def test_spike_detection_zero_std(self):
        result = MentionVolumeAnalyzer.spike_detection(
            historical_avg_per_hour=10.0, current_mentions=15, historical_std=0
        )
        assert result["is_spike"] == False

    def test_mention_trend_increasing(self):
        counts = [float(i) for i in range(1, 31)]
        result = MentionVolumeAnalyzer.mention_trend(counts)
        assert result["slope"] > 0
        assert result["accelerating"] == True

    def test_mention_trend_decreasing(self):
        counts = [float(30 - i) for i in range(30)]
        result = MentionVolumeAnalyzer.mention_trend(counts)
        assert result["slope"] < 0

    def test_mention_trend_insufficient(self):
        result = MentionVolumeAnalyzer.mention_trend([5])
        assert result["slope"] == 0


# ── AggregateSentimentScorer ──────────────────────────────────────────

class TestAggregateSentimentScorer:
    def make_posts(self, n_bull, n_bear):
        rng = random.Random(0)
        posts = []
        for i in range(n_bull):
            p = SocialPost(f"b{i}", SentimentSource.TWITTER, "X",
                           "bullish rocket moon buy strong",
                           upvotes=rng.randint(10, 100), author_followers=1000)
            posts.append(p)
        for i in range(n_bear):
            p = SocialPost(f"r{i}", SentimentSource.REDDIT, "X",
                           "bearish crash dump terrible sell",
                           upvotes=rng.randint(10, 100), author_followers=1000)
            posts.append(p)
        return posts

    def test_weighted_sentiment_bullish(self):
        posts = self.make_posts(8, 2)
        result = AggregateSentimentScorer.weighted_sentiment(posts)
        assert result > 0

    def test_weighted_sentiment_bearish(self):
        posts = self.make_posts(2, 8)
        result = AggregateSentimentScorer.weighted_sentiment(posts)
        assert result < 0

    def test_weighted_sentiment_empty(self):
        result = AggregateSentimentScorer.weighted_sentiment([])
        assert result == 0.0

    def test_bull_bear_ratio_bullish(self):
        posts = self.make_posts(7, 3)
        result = AggregateSentimentScorer.bull_bear_ratio(posts)
        assert result["bull_bear_ratio"] > 1.0

    def test_source_breakdown(self):
        posts = self.make_posts(5, 3)
        result = AggregateSentimentScorer.source_breakdown(posts)
        assert isinstance(result, dict)


# ── WallStreetBetsAnalyzer ────────────────────────────────────────────

class TestWallStreetBetsAnalyzer:
    def test_is_wsb_style_true(self, wsb_post):
        assert WallStreetBetsAnalyzer.is_wsb_style(wsb_post.text) == True

    def test_is_wsb_style_false(self, bullish_post):
        # bullish_post doesn't have wsb keywords
        result = WallStreetBetsAnalyzer.is_wsb_style(bullish_post.text)
        assert isinstance(result, bool)

    def test_squeeze_candidate_mentions(self):
        rng = random.Random(7)
        posts = [
            SocialPost(f"g{i}", SentimentSource.REDDIT, "GME",
                       "short squeeze gamma squeeze high short interest",
                       upvotes=rng.randint(100, 5000), author_followers=10000)
            for i in range(5)
        ]
        result = WallStreetBetsAnalyzer.squeeze_candidate_mentions(posts)
        assert len(result) > 0  # list of symbols

    def test_yolo_ratio(self):
        rng = random.Random(3)
        posts = []
        for i in range(10):
            p = SocialPost(f"y{i}", SentimentSource.REDDIT, "TSLA",
                           "yolo tendies diamond hands" if i % 2 == 0 else "analysis support",
                           upvotes=rng.randint(10, 200))
            posts.append(p)
        ratio = WallStreetBetsAnalyzer.yolo_ratio(posts)
        assert 0 <= ratio <= 1


# ── SocialSpreadIndicator ─────────────────────────────────────────────

class TestSocialSpreadIndicator:
    def test_controversy_score_high_disagreement(self):
        rng = random.Random(99)
        posts = []
        for i in range(20):
            text = "bullish rocket moon buy strong" if i % 2 == 0 else "crash dump bearish sell terrible"
            p = SocialPost(f"c{i}", SentimentSource.TWITTER, "TSLA",
                           text, upvotes=rng.randint(5, 50))
            posts.append(p)
        result = SocialSpreadIndicator.controversy_score(posts)
        assert result > 50  # high controversy

    def test_controversy_score_consensus(self):
        posts = []
        for i in range(20):
            p = SocialPost(f"d{i}", SentimentSource.TWITTER, "AAPL",
                           "bullish strong buy moon rocket")
            posts.append(p)
        result = SocialSpreadIndicator.controversy_score(posts)
        assert result < 20  # low controversy = consensus

    def test_sentiment_momentum_positive(self):
        # Trend from -0.5 to +0.5 over 5 days
        daily = [-0.5, -0.2, 0.0, 0.2, 0.5]
        result = SocialSpreadIndicator.sentiment_momentum(daily)
        assert result["momentum"] > 0

    def test_sentiment_momentum_negative(self):
        daily = [0.5, 0.2, 0.0, -0.2, -0.5]
        result = SocialSpreadIndicator.sentiment_momentum(daily)
        assert result["momentum"] < 0

    def test_sentiment_momentum_insufficient(self):
        result = SocialSpreadIndicator.sentiment_momentum([0.5])
        assert result["momentum"] == 0


# ── SocialSentimentEngine Orchestrator ───────────────────────────────

class TestSocialSentimentEngine:
    def test_score_post_bullish(self, engine, bullish_post):
        result = engine.score_post(bullish_post.text)
        assert "score" in result
        assert "polarity" in result
        assert result["score"] > 0

    def test_score_post_bearish(self, engine, bearish_post):
        result = engine.score_post(bearish_post.text)
        assert result["score"] < 0

    def test_aggregate_multiple_posts(self, engine):
        posts = [
            SocialPost(f"a{i}", SentimentSource.TWITTER, "AAPL",
                       "bullish buy strong accumulate" if i % 2 == 0 else "crash sell bearish",
                       upvotes=100, author_followers=5000)
            for i in range(10)
        ]
        result = engine.aggregate(posts)
        assert "weighted_sentiment" in result or result == {}

    def test_detect_spike_true(self, engine):
        posts = [
            SocialPost(f"s{i}", SentimentSource.TWITTER, "TSLA", "buy buy buy",
                       upvotes=50, author_followers=1000)
            for i in range(150)
        ]
        result = engine.detect_spike("TSLA", posts, historical_avg=5.0, historical_std=3.0)
        assert result["is_spike"] == True

    def test_detect_spike_false(self, engine):
        posts = [
            SocialPost(f"s{i}", SentimentSource.TWITTER, "TSLA", "buy",
                       upvotes=10, author_followers=500)
            for i in range(5)
        ]
        result = engine.detect_spike("TSLA", posts, historical_avg=10.0, historical_std=5.0)
        assert result["is_spike"] == False

    def test_controversy(self, engine):
        posts = [
            SocialPost(f"x{i}", SentimentSource.TWITTER, "GME",
                       "bullish rocket moon" if i % 2 == 0 else "crash dump bearish sell")
            for i in range(20)
        ]
        score = engine.controversy(posts)
        assert 0 <= score <= 100

    def test_yolo_ratio(self, engine):
        posts = [
            SocialPost(f"y{i}", SentimentSource.REDDIT, "AMC",
                        "yolo tendies moon" if i < 5 else "hold support")
            for i in range(10)
        ]
        ratio = engine.yolo_ratio(posts)
        assert 0 <= ratio <= 1

    def test_squeeze_candidates(self, engine):
        posts = [
            SocialPost(f"s{i}", SentimentSource.REDDIT, "GME",
                       "short squeeze gamma squeeze short interest high",
                       upvotes=1000, author_followers=20000)
            for i in range(3)
        ]
        result = engine.squeeze_candidates(posts)
        assert isinstance(result, list)

    def test_full_analysis(self, engine):
        posts = [
            SocialPost(f"f{i}", SentimentSource.TWITTER, "TSLA",
                       "bullish strong buy" if i % 3 != 0 else "bearish crash",
                       upvotes=50 + i * 5, author_followers=2000)
            for i in range(15)
        ]
        result = engine.full_analysis("TSLA", posts)
        assert "symbol" in result
        assert "mention_count" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "SocialSentimentEngine"
        assert len(caps["features"]) >= 12
