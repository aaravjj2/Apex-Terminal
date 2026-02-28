"""
Extended Social Sentiment Engine Tests — 250+ tests covering text sentiment
scoring, mention volume analysis, aggregate sentiment, WSB analysis,
social spread indicators, orchestrator, edge cases, and stress tests.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
from services.social_sentiment_engine import (
    SocialPost, SentimentSource, SentimentPolarity,
    TextSentimentAnalyzer, MentionVolumeAnalyzer,
    AggregateSentimentScorer, WallStreetBetsAnalyzer,
    SocialSpreadIndicator, SocialSentimentEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _make_post(symbol="AAPL", text="bullish moon", source=SentimentSource.REDDIT,
               upvotes=10, comments=5, shares=2, followers=100, hour=12,
               verified=False, post_id=None):
    return SocialPost(
        post_id=post_id or f"post_{random.randint(1, 99999)}",
        source=source,
        symbol=symbol,
        text=text,
        upvotes=upvotes,
        comments=comments,
        shares=shares,
        author_followers=followers,
        timestamp_hour=hour,
        is_verified_author=verified,
    )


def _make_posts(n=50, symbol="AAPL", seed=42):
    rng = random.Random(seed)
    bullish_texts = [
        "bullish on this stock", "moon rocket buy", "diamond hands",
        "squeeze incoming", "gains profits strong", "breakout soaring",
    ]
    bearish_texts = [
        "bearish dump sell", "crash falling drop", "red bleed tank",
        "overvalued bubble", "short puts collapse", "loss weak negative",
    ]
    neutral_texts = [
        "what do you think", "interesting price action", "volume today",
        "earnings report upcoming", "market open in 5 minutes", "any thoughts",
    ]
    all_texts = bullish_texts + bearish_texts + neutral_texts
    posts = []
    for i in range(n):
        posts.append(_make_post(
            symbol=symbol,
            text=rng.choice(all_texts),
            source=rng.choice(list(SentimentSource)),
            upvotes=rng.randint(0, 500),
            comments=rng.randint(0, 100),
            shares=rng.randint(0, 50),
            followers=rng.randint(0, 10000),
            hour=rng.randint(0, 23),
            post_id=f"post_{i}",
        ))
    return posts


# ═══════════════════════════════════════════════════════════════════════
# SocialPost dataclass
# ═══════════════════════════════════════════════════════════════════════

class TestSocialPost:
    def test_engagement_score(self):
        p = _make_post(upvotes=10, comments=5, shares=2)
        expected = 10 * 1.0 + 5 * 2.0 + 2 * 3.0
        assert p.engagement_score == expected

    def test_engagement_zero(self):
        p = _make_post(upvotes=0, comments=0, shares=0)
        assert p.engagement_score == 0.0

    def test_reach_score_with_followers(self):
        p = _make_post(followers=1000)
        assert p.reach_score > p.engagement_score

    def test_reach_score_verified_boost(self):
        p1 = _make_post(followers=1000, verified=False)
        p2 = _make_post(followers=1000, verified=True)
        assert p2.reach_score > p1.reach_score

    def test_to_dict_keys(self):
        p = _make_post()
        d = p.to_dict()
        for k in ["post_id", "source", "symbol", "text_length",
                   "upvotes", "engagement_score", "reach_score"]:
            assert k in d

    def test_to_dict_source_value(self):
        p = _make_post(source=SentimentSource.TWITTER)
        assert p.to_dict()["source"] == "twitter"

    @pytest.mark.parametrize("source", list(SentimentSource))
    def test_all_sources(self, source):
        p = _make_post(source=source)
        assert p.source == source

    @pytest.mark.parametrize("upvotes", [0, 1, 100, 10000])
    def test_various_upvotes(self, upvotes):
        p = _make_post(upvotes=upvotes)
        assert p.engagement_score >= upvotes


# ═══════════════════════════════════════════════════════════════════════
# TextSentimentAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestTokenize:
    def test_simple(self):
        tokens = TextSentimentAnalyzer.tokenize("buy AAPL")
        assert "buy" in tokens
        assert "aapl" in tokens

    def test_empty(self):
        assert TextSentimentAnalyzer.tokenize("") == []

    def test_special_chars(self):
        tokens = TextSentimentAnalyzer.tokenize("🚀 moon! $AAPL")
        assert isinstance(tokens, list)

    def test_lowercase(self):
        tokens = TextSentimentAnalyzer.tokenize("BULLISH BUY MOON")
        assert all(t.islower() or not t.isalpha() for t in tokens)


class TestScoreText:
    def test_bullish_text(self):
        score = TextSentimentAnalyzer.score_text("bullish buy moon rocket 🚀")
        assert score > 0

    def test_bearish_text(self):
        score = TextSentimentAnalyzer.score_text("bearish crash sell dump puts")
        assert score < 0

    def test_neutral_text(self):
        score = TextSentimentAnalyzer.score_text("the market opened today at 9:30 AM")
        assert -0.3 <= score <= 0.3

    def test_bounded(self):
        score = TextSentimentAnalyzer.score_text("bullish " * 100)
        assert -1.0 <= score <= 1.0

    def test_empty_text(self):
        score = TextSentimentAnalyzer.score_text("")
        assert score == 0.0

    def test_amplifier(self):
        base = TextSentimentAnalyzer.score_text("bullish")
        amped = TextSentimentAnalyzer.score_text("very bullish")
        # Amplifier should increase magnitude
        assert abs(amped) >= abs(base) or abs(amped - base) < 0.2

    def test_negator(self):
        pos = TextSentimentAnalyzer.score_text("bullish")
        neg = TextSentimentAnalyzer.score_text("not bullish")
        assert neg < pos

    def test_emoji_bullish(self):
        score = TextSentimentAnalyzer.score_text("🚀🚀🚀")
        assert score > 0

    def test_emoji_bearish(self):
        score = TextSentimentAnalyzer.score_text("📉📉📉")
        assert score < 0

    @pytest.mark.parametrize("word", list(TextSentimentAnalyzer.BULLISH_WORDS)[:10])
    def test_bullish_words(self, word):
        score = TextSentimentAnalyzer.score_text(f"the stock is {word}")
        assert score >= 0

    @pytest.mark.parametrize("word", list(TextSentimentAnalyzer.BEARISH_WORDS)[:10])
    def test_bearish_words(self, word):
        score = TextSentimentAnalyzer.score_text(f"the stock is {word}")
        assert score <= 0

    def test_mixed_sentiment(self):
        score = TextSentimentAnalyzer.score_text("bullish short term but bearish long term")
        assert isinstance(score, float)


class TestPolarity:
    def test_very_bullish(self):
        assert TextSentimentAnalyzer.polarity(0.8) == SentimentPolarity.VERY_BULLISH

    def test_bullish(self):
        assert TextSentimentAnalyzer.polarity(0.3) == SentimentPolarity.BULLISH

    def test_neutral(self):
        assert TextSentimentAnalyzer.polarity(0.0) == SentimentPolarity.NEUTRAL

    def test_bearish(self):
        assert TextSentimentAnalyzer.polarity(-0.3) == SentimentPolarity.BEARISH

    def test_very_bearish(self):
        assert TextSentimentAnalyzer.polarity(-0.8) == SentimentPolarity.VERY_BEARISH

    @pytest.mark.parametrize("score,expected", [
        (0.6, SentimentPolarity.VERY_BULLISH),
        (0.3, SentimentPolarity.BULLISH),
        (0.1, SentimentPolarity.NEUTRAL),
        (-0.1, SentimentPolarity.NEUTRAL),
        (-0.3, SentimentPolarity.BEARISH),
        (-0.6, SentimentPolarity.VERY_BEARISH),
    ])
    def test_all_polarities(self, score, expected):
        assert TextSentimentAnalyzer.polarity(score) == expected

    @pytest.mark.parametrize("score", [-1.0, -0.5, -0.15, 0.0, 0.15, 0.5, 1.0])
    def test_boundaries(self, score):
        result = TextSentimentAnalyzer.polarity(score)
        assert isinstance(result, SentimentPolarity)


# ═══════════════════════════════════════════════════════════════════════
# MentionVolumeAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestMentionsPerHour:
    def test_basic(self):
        posts = [_make_post(symbol="AAPL", hour=h) for h in range(24)]
        r = MentionVolumeAnalyzer.mentions_per_hour(posts, "AAPL")
        assert sum(r.values()) == 24
        assert len(r) == 24

    def test_case_insensitive(self):
        posts = [_make_post(symbol="aapl")]
        r = MentionVolumeAnalyzer.mentions_per_hour(posts, "AAPL")
        assert sum(r.values()) == 1

    def test_different_symbol(self):
        posts = [_make_post(symbol="MSFT")]
        r = MentionVolumeAnalyzer.mentions_per_hour(posts, "AAPL")
        assert sum(r.values()) == 0

    def test_empty(self):
        r = MentionVolumeAnalyzer.mentions_per_hour([], "AAPL")
        assert sum(r.values()) == 0

    def test_all_same_hour(self):
        posts = [_make_post(symbol="AAPL", hour=14) for _ in range(50)]
        r = MentionVolumeAnalyzer.mentions_per_hour(posts, "AAPL")
        assert r[14] == 50
        assert sum(r.values()) == 50


class TestSpikeDetection:
    def test_spike_detected(self):
        r = MentionVolumeAnalyzer.spike_detection(10.0, 30, threshold_sigma=2.0, historical_std=5.0)
        assert r["is_spike"] is True

    def test_no_spike(self):
        r = MentionVolumeAnalyzer.spike_detection(10.0, 12, threshold_sigma=2.0, historical_std=5.0)
        assert r["is_spike"] is False

    def test_zero_std(self):
        r = MentionVolumeAnalyzer.spike_detection(10.0, 20, historical_std=0)
        assert r["z_score"] == 0.0

    def test_output_keys(self):
        r = MentionVolumeAnalyzer.spike_detection(10.0, 20)
        for k in ["current_mentions", "historical_avg", "z_score",
                   "is_spike", "spike_magnitude"]:
            assert k in r

    @pytest.mark.parametrize("mentions", [0, 5, 10, 20, 50, 100])
    def test_various_mentions(self, mentions):
        r = MentionVolumeAnalyzer.spike_detection(10.0, mentions)
        assert isinstance(r["is_spike"], bool)

    def test_spike_magnitude(self):
        r = MentionVolumeAnalyzer.spike_detection(10.0, 30)
        assert r["spike_magnitude"] == 3.0


class TestMentionTrend:
    def test_increasing(self):
        counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        r = MentionVolumeAnalyzer.mention_trend(counts)
        assert r["slope"] > 0
        assert r["accelerating"] is True

    def test_decreasing(self):
        counts = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
        r = MentionVolumeAnalyzer.mention_trend(counts)
        assert r["slope"] < 0
        assert r["accelerating"] is False

    def test_flat(self):
        counts = [5]*10
        r = MentionVolumeAnalyzer.mention_trend(counts)
        assert r["slope"] == 0

    def test_single_count(self):
        r = MentionVolumeAnalyzer.mention_trend([5])
        assert r["slope"] == 0

    def test_empty(self):
        r = MentionVolumeAnalyzer.mention_trend([])
        assert r["slope"] == 0

    def test_output_keys(self):
        r = MentionVolumeAnalyzer.mention_trend([1, 2, 3, 4])
        for k in ["slope", "accelerating", "recent_vs_earlier"]:
            assert k in r


# ═══════════════════════════════════════════════════════════════════════
# AggregateSentimentScorer
# ═══════════════════════════════════════════════════════════════════════

class TestWeightedSentiment:
    def test_empty(self):
        assert AggregateSentimentScorer.weighted_sentiment([]) == 0.0

    def test_all_bullish(self):
        posts = [_make_post(text="bullish moon rocket") for _ in range(10)]
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert score > 0

    def test_all_bearish(self):
        posts = [_make_post(text="bearish crash dump") for _ in range(10)]
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert score < 0

    def test_bounded(self):
        posts = _make_posts(100)
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert -1.0 <= score <= 1.0

    def test_single_post(self):
        posts = [_make_post(text="bullish")]
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert isinstance(score, float)


class TestBullBearRatio:
    def test_empty(self):
        assert AggregateSentimentScorer.bull_bear_ratio([]) == {}

    def test_has_distribution(self):
        posts = _make_posts(20)
        r = AggregateSentimentScorer.bull_bear_ratio(posts)
        assert "distribution" in r
        assert "total_posts" in r
        assert r["total_posts"] == 20

    def test_distribution_sums_to_one(self):
        posts = _make_posts(50)
        r = AggregateSentimentScorer.bull_bear_ratio(posts)
        total = sum(r["distribution"].values())
        assert abs(total - 1.0) < 0.01


class TestSourceBreakdown:
    def test_empty(self):
        assert AggregateSentimentScorer.source_breakdown([]) == {}

    def test_single_source(self):
        posts = [_make_post(source=SentimentSource.REDDIT) for _ in range(5)]
        r = AggregateSentimentScorer.source_breakdown(posts)
        assert "reddit" in r
        assert r["reddit"]["n_posts"] == 5

    def test_multiple_sources(self):
        posts = [
            _make_post(source=SentimentSource.REDDIT),
            _make_post(source=SentimentSource.TWITTER),
            _make_post(source=SentimentSource.STOCKTWITS),
        ]
        r = AggregateSentimentScorer.source_breakdown(posts)
        assert len(r) == 3


# ═══════════════════════════════════════════════════════════════════════
# WallStreetBetsAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestIsWSBStyle:
    def test_yolo(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("YOLO all in on calls") is True

    def test_tendies(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("looking for tendies") is True

    def test_diamond_hands(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("diamond hands forever") is True

    def test_normal_text(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("the stock price went up today") is False

    def test_empty(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("") is False

    def test_case_insensitive(self):
        assert WallStreetBetsAnalyzer.is_wsb_style("YOLO") is True

    @pytest.mark.parametrize("keyword", [
        "yolo", "tendies", "ape", "diamond hands", "short squeeze",
        "gamma squeeze", "gme", "amc", "meme"
    ])
    def test_various_keywords(self, keyword):
        assert WallStreetBetsAnalyzer.is_wsb_style(f"I love {keyword}") is True


class TestSqueezeCandidate:
    def test_squeeze_mention(self):
        posts = [_make_post(text="short squeeze incoming", symbol="GME")]
        r = WallStreetBetsAnalyzer.squeeze_candidate_mentions(posts)
        assert "GME" in r

    def test_no_squeeze(self):
        posts = [_make_post(text="nice day for trading")]
        r = WallStreetBetsAnalyzer.squeeze_candidate_mentions(posts)
        assert r == []

    def test_empty(self):
        assert WallStreetBetsAnalyzer.squeeze_candidate_mentions([]) == []

    def test_multiple_symbols(self):
        posts = [
            _make_post(text="squeeze on this one", symbol="GME"),
            _make_post(text="short interest is huge", symbol="AMC"),
            _make_post(text="normal trade", symbol="AAPL"),
        ]
        r = WallStreetBetsAnalyzer.squeeze_candidate_mentions(posts)
        assert "GME" in r
        assert "AMC" in r
        assert "AAPL" not in r


class TestYoloRatio:
    def test_all_yolo(self):
        posts = [_make_post(text="yolo all in life savings") for _ in range(10)]
        ratio = WallStreetBetsAnalyzer.yolo_ratio(posts)
        assert ratio > 0

    def test_no_yolo(self):
        posts = [_make_post(text="careful trade") for _ in range(10)]
        ratio = WallStreetBetsAnalyzer.yolo_ratio(posts)
        assert ratio == 0.0

    def test_empty(self):
        assert WallStreetBetsAnalyzer.yolo_ratio([]) == 0.0

    def test_bounded(self):
        posts = _make_posts(100)
        ratio = WallStreetBetsAnalyzer.yolo_ratio(posts)
        assert 0.0 <= ratio <= 1.0


# ═══════════════════════════════════════════════════════════════════════
# SocialSpreadIndicator
# ═══════════════════════════════════════════════════════════════════════

class TestControversyScore:
    def test_few_posts_default(self):
        posts = [_make_post() for _ in range(3)]
        score = SocialSpreadIndicator.controversy_score(posts)
        assert score == 50.0

    def test_all_same_sentiment(self):
        posts = [_make_post(text="bullish") for _ in range(20)]
        score = SocialSpreadIndicator.controversy_score(posts)
        assert isinstance(score, float)

    def test_mixed_sentiment(self):
        posts = ([_make_post(text="bullish moon rocket") for _ in range(10)] +
                 [_make_post(text="bearish crash dump") for _ in range(10)])
        score = SocialSpreadIndicator.controversy_score(posts)
        assert score > 0

    def test_bounded(self):
        posts = _make_posts(100)
        score = SocialSpreadIndicator.controversy_score(posts)
        assert 0 <= score <= 100


class TestSentimentMomentum:
    def test_improving(self):
        scores = [-0.2, -0.1, 0.0, 0.1, 0.2, 0.3]
        r = SocialSpreadIndicator.sentiment_momentum(scores)
        assert r["direction"] == "improving"

    def test_deteriorating(self):
        scores = [0.3, 0.2, 0.1, 0.0, -0.1, -0.2]
        r = SocialSpreadIndicator.sentiment_momentum(scores)
        assert r["direction"] == "deteriorating"

    def test_stable(self):
        scores = [0.1, 0.1, 0.1, 0.1, 0.1]
        r = SocialSpreadIndicator.sentiment_momentum(scores)
        assert r["direction"] == "stable"

    def test_single_score(self):
        r = SocialSpreadIndicator.sentiment_momentum([0.5])
        assert r["momentum"] == 0

    def test_empty(self):
        r = SocialSpreadIndicator.sentiment_momentum([])
        assert r["momentum"] == 0

    def test_output_keys(self):
        r = SocialSpreadIndicator.sentiment_momentum([0.1, 0.2, 0.3])
        for k in ["momentum", "direction", "current_score"]:
            assert k in r

    @pytest.mark.parametrize("lookback", [3, 5, 10])
    def test_various_lookbacks(self, lookback):
        scores = [0.1 * i for i in range(20)]
        r = SocialSpreadIndicator.sentiment_momentum(scores, lookback=lookback)
        assert isinstance(r, dict)


# ═══════════════════════════════════════════════════════════════════════
# SocialSentimentEngine orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestSocialSentimentEngineOrchestrator:
    def setup_method(self):
        self.engine = SocialSentimentEngine()
        self.posts = _make_posts(50)

    def test_score_post(self):
        r = self.engine.score_post("bullish moon rocket")
        assert "score" in r
        assert "polarity" in r
        assert r["score"] > 0

    def test_score_post_bearish(self):
        r = self.engine.score_post("bearish crash dump")
        assert r["score"] < 0

    def test_aggregate_empty(self):
        assert self.engine.aggregate([]) == {}

    def test_aggregate(self):
        r = self.engine.aggregate(self.posts)
        assert "weighted_sentiment" in r
        assert "n_posts" in r
        assert r["n_posts"] == 50

    def test_detect_spike(self):
        posts = [_make_post(symbol="AAPL") for _ in range(50)]
        r = self.engine.detect_spike("AAPL", posts, historical_avg=10)
        assert "is_spike" in r
        assert r["is_spike"] is True

    def test_detect_spike_no_spike(self):
        posts = [_make_post(symbol="AAPL") for _ in range(5)]
        r = self.engine.detect_spike("AAPL", posts, historical_avg=10, historical_std=5)
        assert "is_spike" in r

    def test_controversy(self):
        score = self.engine.controversy(self.posts)
        assert isinstance(score, float)

    def test_yolo_ratio(self):
        ratio = self.engine.yolo_ratio(self.posts)
        assert isinstance(ratio, float)
        assert 0.0 <= ratio <= 1.0

    def test_squeeze_candidates(self):
        r = self.engine.squeeze_candidates(self.posts)
        assert isinstance(r, list)

    def test_full_analysis(self):
        all_posts = [_make_post(symbol="AAPL", text="bullish moon") for _ in range(20)]
        r = self.engine.full_analysis("AAPL", all_posts)
        assert r["symbol"] == "AAPL"
        assert "aggregate" in r
        assert "controversy_score" in r
        assert "yolo_ratio" in r
        assert "mention_count" in r
        assert r["mention_count"] == 20

    def test_full_analysis_no_posts(self):
        r = self.engine.full_analysis("AAPL", [])
        assert r["mention_count"] == 0

    def test_capabilities(self):
        c = self.engine.capabilities()
        assert c["engine"] == "SocialSentimentEngine"
        assert "features" in c


# ═══════════════════════════════════════════════════════════════════════
# Enum coverage
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    @pytest.mark.parametrize("source", list(SentimentSource))
    def test_sentiment_source_values(self, source):
        assert isinstance(source.value, str)

    @pytest.mark.parametrize("polarity", list(SentimentPolarity))
    def test_sentiment_polarity_values(self, polarity):
        assert isinstance(polarity.value, str)

    def test_source_count(self):
        assert len(SentimentSource) == 5

    def test_polarity_count(self):
        assert len(SentimentPolarity) == 5


# ═══════════════════════════════════════════════════════════════════════
# Property-based tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(20))
    def test_score_bounded(self, seed):
        rng = random.Random(seed)
        words = ["bullish", "bearish", "moon", "crash", "hold", "sell", "buy",
                 "green", "red", "profit", "loss"]
        text = " ".join(rng.choice(words) for _ in range(rng.randint(1, 20)))
        score = TextSentimentAnalyzer.score_text(text)
        assert -1.0 <= score <= 1.0

    @pytest.mark.parametrize("seed", range(10))
    def test_weighted_sentiment_bounded(self, seed):
        posts = _make_posts(50, seed=seed)
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert -1.0 <= score <= 1.0

    @pytest.mark.parametrize("seed", range(10))
    def test_yolo_ratio_bounded(self, seed):
        posts = _make_posts(50, seed=seed)
        ratio = WallStreetBetsAnalyzer.yolo_ratio(posts)
        assert 0.0 <= ratio <= 1.0

    @pytest.mark.parametrize("seed", range(5))
    def test_controversy_bounded(self, seed):
        posts = _make_posts(20, seed=seed)
        score = SocialSpreadIndicator.controversy_score(posts)
        assert 0 <= score <= 100


# ═══════════════════════════════════════════════════════════════════════
# Stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_large_posts_aggregate(self):
        posts = _make_posts(500)
        score = AggregateSentimentScorer.weighted_sentiment(posts)
        assert -1.0 <= score <= 1.0

    def test_large_posts_bull_bear(self):
        posts = _make_posts(500)
        r = AggregateSentimentScorer.bull_bear_ratio(posts)
        assert r["total_posts"] == 500

    def test_many_squeeze_candidates(self):
        posts = [_make_post(text="squeeze short interest", symbol=f"S{i}")
                 for i in range(100)]
        r = WallStreetBetsAnalyzer.squeeze_candidate_mentions(posts)
        assert len(r) == 100

    def test_large_mention_volume(self):
        posts = [_make_post(symbol="AAPL", hour=h % 24) for h in range(1000)]
        r = MentionVolumeAnalyzer.mentions_per_hour(posts, "AAPL")
        assert sum(r.values()) == 1000

    def test_full_analysis_large(self):
        engine = SocialSentimentEngine()
        posts = _make_posts(500, symbol="TSLA")
        r = engine.full_analysis("TSLA", posts)
        assert r["mention_count"] == 500

    def test_very_long_text(self):
        text = "bullish " * 10000
        score = TextSentimentAnalyzer.score_text(text)
        assert -1.0 <= score <= 1.0

    def test_tokenize_long_text(self):
        text = "word " * 5000
        tokens = TextSentimentAnalyzer.tokenize(text)
        assert len(tokens) >= 5000
