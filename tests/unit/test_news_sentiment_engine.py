"""
Tests for news_sentiment_engine.py
===================================
Covers: SentimentAnalyzer, EntityExtractor, TopicClassifier, NewsFeed,
        SentimentAggregator, MarketImpactEstimator, NewsCorrelator,
        NewsSentimentEngine orchestrator.
"""

import time
import pytest
import numpy as np
from phase1.services.news_sentiment_engine import (
    SentimentLabel, NewsCategory, NewsSource,
    SentimentScore, NewsArticle,
    SentimentAnalyzer, EntityExtractor, TopicClassifier,
    NewsFeed, SentimentAggregator, MarketImpactEstimator,
    NewsCorrelator, NewsSentimentEngine,
)


# ═══════════════════════════════════════════════════════════════════════════════
# SentimentScore
# ═══════════════════════════════════════════════════════════════════════════════

class TestSentimentScore:
    def test_from_score_very_bullish(self):
        s = SentimentScore.from_score(0.7)
        assert s.label == SentimentLabel.VERY_BULLISH

    def test_from_score_bullish(self):
        s = SentimentScore.from_score(0.3)
        assert s.label == SentimentLabel.BULLISH

    def test_from_score_neutral(self):
        s = SentimentScore.from_score(0.0)
        assert s.label == SentimentLabel.NEUTRAL

    def test_from_score_bearish(self):
        s = SentimentScore.from_score(-0.3)
        assert s.label == SentimentLabel.BEARISH

    def test_from_score_very_bearish(self):
        s = SentimentScore.from_score(-0.7)
        assert s.label == SentimentLabel.VERY_BEARISH

    def test_to_dict(self):
        s = SentimentScore.from_score(0.5, 0.8)
        d = s.to_dict()
        assert d["score"] == 0.5
        assert d["confidence"] == 0.8
        assert d["label"] == "bullish"


# ═══════════════════════════════════════════════════════════════════════════════
# NewsArticle
# ═══════════════════════════════════════════════════════════════════════════════

class TestNewsArticle:
    def test_auto_id(self):
        a = NewsArticle(headline="Test headline")
        assert len(a.id) == 12

    def test_age(self):
        a = NewsArticle(headline="x", published_at=time.time() - 120)
        assert a.age_seconds >= 119
        assert a.age_minutes >= 1.9

    def test_to_dict(self):
        a = NewsArticle(
            headline="AAPL beats earnings",
            source=NewsSource.BLOOMBERG,
            symbols=["AAPL"],
            categories=[NewsCategory.EARNINGS],
            sentiment=SentimentScore.from_score(0.6),
        )
        d = a.to_dict()
        assert d["headline"] == "AAPL beats earnings"
        assert d["source"] == "bloomberg"
        assert d["categories"] == ["earnings"]
        assert d["sentiment"]["label"] == "very_bullish"

    def test_default_fields(self):
        a = NewsArticle()
        assert a.read is False
        assert a.entities == {}
        assert a.keywords == []


# ═══════════════════════════════════════════════════════════════════════════════
# SentimentAnalyzer
# ═══════════════════════════════════════════════════════════════════════════════

class TestSentimentAnalyzer:
    def setup_method(self):
        self.analyzer = SentimentAnalyzer()

    def test_positive_text(self):
        s = self.analyzer.analyze("Strong profit growth beats estimates with record revenue")
        assert s.score > 0
        assert s.label in (SentimentLabel.BULLISH, SentimentLabel.VERY_BULLISH)

    def test_negative_text(self):
        s = self.analyzer.analyze("Loss decline crash selloff bearish downgrade")
        assert s.score < 0
        assert s.label in (SentimentLabel.BEARISH, SentimentLabel.VERY_BEARISH)

    def test_neutral_text(self):
        s = self.analyzer.analyze("The meeting was held on Tuesday afternoon")
        assert s.label == SentimentLabel.NEUTRAL

    def test_negation(self):
        s = self.analyzer.analyze("The company did not profit this quarter")
        # "not" negates "profit" => bearish
        assert s.score < 0

    def test_intensifier(self):
        base = self.analyzer.analyze("surge")
        intensified = self.analyzer.analyze("extremely surge")
        # Both should be positive, intensified should be at least as positive
        assert base.score > 0
        assert intensified.score > 0

    def test_empty_text(self):
        s = self.analyzer.analyze("")
        assert s.score == 0.0
        assert s.confidence == 0.0

    def test_headline_analysis(self):
        s = self.analyzer.analyze_headline("Massive rally as profits surge")
        assert s.score > 0
        assert s.confidence > 0

    def test_batch_analyze(self):
        results = self.analyzer.batch_analyze(["gains profit", "loss crash", "meeting room"])
        assert len(results) == 3
        assert results[0].score > 0
        assert results[1].score < 0

    def test_no_sentiment_words(self):
        s = self.analyzer.analyze("cat dog house tree")
        assert s.score == 0.0

    def test_mixed_sentiment(self):
        s = self.analyzer.analyze("growth was strong but losses remain a concern")
        # Mixed, but should still compute something
        assert isinstance(s.score, float)


# ═══════════════════════════════════════════════════════════════════════════════
# EntityExtractor
# ═══════════════════════════════════════════════════════════════════════════════

class TestEntityExtractor:
    def setup_method(self):
        self.extractor = EntityExtractor()

    def test_cashtag_extraction(self):
        tickers = self.extractor.extract_tickers("Check out $AAPL and $MSFT today")
        assert "AAPL" in tickers
        assert "MSFT" in tickers

    def test_known_tickers(self):
        known = {"AAPL", "MSFT", "GOOGL"}
        tickers = self.extractor.extract_tickers("AAPL reported earnings", known)
        assert "AAPL" in tickers

    def test_stop_words_filtered(self):
        tickers = self.extractor.extract_tickers("THE CEO SAID IPO IS NEW")
        assert "THE" not in tickers
        assert "CEO" not in tickers
        assert "IS" not in tickers

    def test_extract_entities_currencies(self):
        entities = self.extractor.extract_entities("Revenue was $5,000,000 up 15%")
        assert len(entities["currencies"]) > 0
        assert len(entities["percentages"]) > 0

    def test_extract_entities_percentages(self):
        entities = self.extractor.extract_entities("Up 5.2% this quarter")
        assert "5.2%" in entities["percentages"]

    def test_extract_numbers(self):
        entities = self.extractor.extract_entities("Revenue of 1,500,000 reported")
        assert "1,500,000" in entities["numbers"]


# ═══════════════════════════════════════════════════════════════════════════════
# TopicClassifier
# ═══════════════════════════════════════════════════════════════════════════════

class TestTopicClassifier:
    def setup_method(self):
        self.classifier = TopicClassifier()

    def test_earnings(self):
        cats = self.classifier.classify("Q3 earnings beat EPS estimate revenue guidance")
        assert NewsCategory.EARNINGS in cats

    def test_merger(self):
        cats = self.classifier.classify("Acquisition deal takeover bid announced")
        assert NewsCategory.MERGER_ACQUISITION in cats

    def test_regulation(self):
        cats = self.classifier.classify("SEC regulatory fine compliance ruling")
        assert NewsCategory.REGULATION in cats

    def test_macro(self):
        cats = self.classifier.classify("Fed interest rate inflation GDP unemployment")
        assert NewsCategory.MACRO in cats

    def test_analyst(self):
        cats = self.classifier.classify("Analyst upgrade price target outperform")
        assert NewsCategory.ANALYST in cats

    def test_general(self):
        cats = self.classifier.classify("A beautiful sunny day in the park")
        assert NewsCategory.GENERAL in cats

    def test_batch_classify(self):
        results = self.classifier.classify_batch(["earnings beat", "merger announced"])
        assert len(results) == 2

    def test_multiple_categories(self):
        cats = self.classifier.classify("SEC regulation fine after merger deal acquisition")
        assert len(cats) >= 1  # Could match regulation and M&A


# ═══════════════════════════════════════════════════════════════════════════════
# NewsFeed
# ═══════════════════════════════════════════════════════════════════════════════

class TestNewsFeed:
    def setup_method(self):
        self.feed = NewsFeed(max_articles=100)

    def _make_article(self, headline="Test", symbols=None, category=None,
                      published_at=None):
        return NewsArticle(
            headline=headline,
            symbols=symbols or [],
            categories=[category] if category else [NewsCategory.GENERAL],
            published_at=published_at or time.time(),
        )

    def test_add_and_get(self):
        a = self._make_article("AAPL earnings")
        assert self.feed.add_article(a) is True
        assert self.feed.get_article(a.id) is not None

    def test_dedup(self):
        a = self._make_article("Dup test")
        self.feed.add_article(a)
        assert self.feed.add_article(a) is False  # duplicate
        assert self.feed.count == 1

    def test_get_by_symbol(self):
        self.feed.add_article(self._make_article("A1", symbols=["AAPL"]))
        self.feed.add_article(self._make_article("A2", symbols=["MSFT"]))
        self.feed.add_article(self._make_article("A3", symbols=["AAPL"]))
        result = self.feed.get_by_symbol("AAPL")
        assert len(result) == 2

    def test_get_latest(self):
        for i in range(5):
            self.feed.add_article(self._make_article(f"N{i}"))
        result = self.feed.get_latest(3)
        assert len(result) == 3

    def test_get_by_category(self):
        self.feed.add_article(self._make_article("E1", category=NewsCategory.EARNINGS))
        self.feed.add_article(self._make_article("M1", category=NewsCategory.MACRO))
        result = self.feed.get_by_category(NewsCategory.EARNINGS)
        assert len(result) == 1

    def test_search(self):
        self.feed.add_article(self._make_article("AAPL beats earnings expectations"))
        self.feed.add_article(self._make_article("MSFT cloud revenue grows"))
        result = self.feed.search("beats")
        assert len(result) == 1

    def test_mark_read(self):
        a = self._make_article("Read test")
        self.feed.add_article(a)
        assert self.feed.unread_count() == 1
        self.feed.mark_read(a.id)
        assert self.feed.unread_count() == 0

    def test_unread_by_symbol(self):
        self.feed.add_article(self._make_article("A1", symbols=["AAPL"]))
        self.feed.add_article(self._make_article("A2", symbols=["MSFT"]))
        assert self.feed.unread_count("AAPL") == 1

    def test_trim(self):
        feed = NewsFeed(max_articles=5)
        for i in range(10):
            feed.add_article(self._make_article(f"Art{i}", published_at=time.time() + i))
        assert feed.count == 5

    def test_mark_read_nonexistent(self):
        assert self.feed.mark_read("fake") is False


# ═══════════════════════════════════════════════════════════════════════════════
# SentimentAggregator
# ═══════════════════════════════════════════════════════════════════════════════

class TestSentimentAggregator:
    def _make_articles(self):
        articles = []
        for sym, score in [("AAPL", 0.5), ("AAPL", 0.3), ("MSFT", -0.4)]:
            a = NewsArticle(headline=f"{sym} news", symbols=[sym],
                            sentiment=SentimentScore.from_score(score))
            articles.append(a)
        return articles

    def test_by_symbol(self):
        articles = self._make_articles()
        result = SentimentAggregator.by_symbol(articles)
        assert "AAPL" in result
        assert result["AAPL"]["avg_sentiment"] > 0
        assert result["MSFT"]["avg_sentiment"] < 0

    def test_by_category(self):
        articles = [
            NewsArticle(headline="E", categories=[NewsCategory.EARNINGS],
                        sentiment=SentimentScore.from_score(0.5)),
            NewsArticle(headline="M", categories=[NewsCategory.MACRO],
                        sentiment=SentimentScore.from_score(-0.3)),
        ]
        result = SentimentAggregator.by_category(articles)
        assert "earnings" in result
        assert "macro" in result

    def test_time_series(self):
        now = time.time()
        articles = [
            NewsArticle(headline="A", published_at=now - 7200,
                        sentiment=SentimentScore.from_score(0.5)),
            NewsArticle(headline="B", published_at=now - 3600,
                        sentiment=SentimentScore.from_score(-0.3)),
            NewsArticle(headline="C", published_at=now,
                        sentiment=SentimentScore.from_score(0.2)),
        ]
        result = SentimentAggregator.time_series(articles, bucket_seconds=3600)
        assert len(result) >= 2  # at least 2 distinct hourly buckets

    def test_overall(self):
        articles = self._make_articles()
        result = SentimentAggregator.overall(articles)
        assert "avg_sentiment" in result
        assert result["count"] == 3
        assert "bullish_pct" in result

    def test_overall_empty(self):
        result = SentimentAggregator.overall([])
        assert result["count"] == 0

    def test_time_series_empty(self):
        result = SentimentAggregator.time_series([])
        assert result == []


# ═══════════════════════════════════════════════════════════════════════════════
# MarketImpactEstimator
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarketImpactEstimator:
    def setup_method(self):
        self.estimator = MarketImpactEstimator()

    def test_estimate_earnings(self):
        a = NewsArticle(
            headline="Beat",
            categories=[NewsCategory.EARNINGS],
            sentiment=SentimentScore.from_score(0.8, 0.9),
            source=NewsSource.BLOOMBERG,
        )
        result = self.estimator.estimate_impact(a)
        assert result["impact_score"] > 0
        assert result["direction"] == "bullish"

    def test_estimate_no_sentiment(self):
        a = NewsArticle(headline="Test")
        result = self.estimator.estimate_impact(a)
        assert result["impact_score"] == 0.0

    def test_estimate_bearish(self):
        a = NewsArticle(
            headline="Crash",
            categories=[NewsCategory.LEGAL],
            sentiment=SentimentScore.from_score(-0.7, 0.8),
            source=NewsSource.REUTERS,
        )
        result = self.estimator.estimate_impact(a)
        assert result["direction"] == "bearish"

    def test_source_weight(self):
        a_reuters = NewsArticle(
            headline="A", categories=[NewsCategory.GENERAL],
            sentiment=SentimentScore.from_score(0.5),
            source=NewsSource.REUTERS,
        )
        a_social = NewsArticle(
            headline="B", categories=[NewsCategory.GENERAL],
            sentiment=SentimentScore.from_score(0.5),
            source=NewsSource.SOCIAL,
        )
        r1 = self.estimator.estimate_impact(a_reuters)
        r2 = self.estimator.estimate_impact(a_social)
        assert r1["source_weight"] > r2["source_weight"]

    def test_rank_by_impact(self):
        articles = [
            NewsArticle(headline="Low", categories=[NewsCategory.GENERAL],
                        sentiment=SentimentScore.from_score(0.1)),
            NewsArticle(headline="High", categories=[NewsCategory.EARNINGS],
                        sentiment=SentimentScore.from_score(0.9, 0.95),
                        source=NewsSource.BLOOMBERG),
        ]
        ranked = self.estimator.rank_by_impact(articles)
        assert ranked[0][1].headline == "High"


# ═══════════════════════════════════════════════════════════════════════════════
# NewsCorrelator
# ═══════════════════════════════════════════════════════════════════════════════

class TestNewsCorrelator:
    def test_sentiment_vs_returns(self):
        sent = [0.5, 0.3, -0.2, 0.1, -0.4]
        ret = [0.02, 0.01, -0.03, 0.005, -0.02]
        result = NewsCorrelator.sentiment_vs_returns(sent, ret)
        assert "correlation" in result
        assert abs(result["correlation"]) <= 1.0

    def test_short_series(self):
        result = NewsCorrelator.sentiment_vs_returns([0.1], [0.02])
        assert result["correlation"] == 0.0

    def test_news_volume_vs_volatility(self):
        nc = [5, 10, 3, 8, 12]
        vol = [0.01, 0.02, 0.005, 0.015, 0.025]
        result = NewsCorrelator.news_volume_vs_volatility(nc, vol)
        assert "correlation" in result

    def test_zero_std(self):
        result = NewsCorrelator.sentiment_vs_returns([0.5, 0.5, 0.5], [0.01, 0.02, 0.03])
        assert result["correlation"] == 0.0

    def test_lag_correlation(self):
        sent = [0.5, 0.3, -0.2, 0.1, -0.4, 0.2]
        ret = [0.02, 0.01, -0.03, 0.005, -0.02, 0.01]
        result = NewsCorrelator.sentiment_vs_returns(sent, ret)
        assert "lag_1_corr" in result


# ═══════════════════════════════════════════════════════════════════════════════
# NewsSentimentEngine (orchestrator)
# ═══════════════════════════════════════════════════════════════════════════════

class TestNewsSentimentEngine:
    def setup_method(self):
        self.engine = NewsSentimentEngine()

    def test_ingest_article(self):
        a = self.engine.ingest_article(
            headline="AAPL beats Q3 earnings with record revenue",
            symbols=["AAPL"],
            source="bloomberg",
        )
        assert a.sentiment is not None
        assert a.sentiment.score > 0
        assert NewsCategory.EARNINGS in a.categories
        assert a.relevance_score >= 0

    def test_ingest_bearish(self):
        a = self.engine.ingest_article(
            headline="Massive crash selloff amid fraud investigation",
            symbols=["XYZ"],
        )
        assert a.sentiment.score < 0

    def test_get_symbol_sentiment(self):
        self.engine.ingest_article(headline="Strong growth profit", symbols=["AAPL"])
        self.engine.ingest_article(headline="Beat estimates surge", symbols=["AAPL"])
        result = self.engine.get_symbol_sentiment("AAPL")
        assert result["articles"] == 2
        assert result["sentiment"]["avg_sentiment"] > 0

    def test_get_symbol_sentiment_none(self):
        result = self.engine.get_symbol_sentiment("ZZZZ")
        assert result["articles"] == 0

    def test_get_market_sentiment(self):
        self.engine.ingest_article(headline="Growth profit gains", symbols=["AAPL"])
        self.engine.ingest_article(headline="Loss crash decline", symbols=["MSFT"])
        result = self.engine.get_market_sentiment()
        assert result["article_count"] == 2
        assert "overall" in result

    def test_get_top_movers(self):
        self.engine.ingest_article(headline="Massive surge rally gains profit", symbols=["AAPL"])
        self.engine.ingest_article(headline="Minor update released", symbols=["MSFT"])
        movers = self.engine.get_top_movers(5)
        assert len(movers) >= 1
        assert movers[0]["symbol"] == "AAPL"

    def test_get_high_impact(self):
        self.engine.ingest_article(
            headline="Major earnings beat record revenue",
            symbols=["AAPL"], source="bloomberg",
        )
        self.engine.ingest_article(
            headline="Cat picture posted",
            symbols=["XYZ"], source="social_media",
        )
        result = self.engine.get_high_impact(5)
        assert len(result) >= 1

    def test_search_news(self):
        self.engine.ingest_article(headline="AAPL launches new product", symbols=["AAPL"])
        self.engine.ingest_article(headline="MSFT cloud growth", symbols=["MSFT"])
        result = self.engine.search_news("cloud")
        assert len(result) == 1

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert caps["total_articles"] == 0
        assert "sentiment_analysis" in caps["features"]
        assert "earnings" in caps["categories"]

    def test_source_parsing(self):
        a = self.engine.ingest_article(headline="Test", source="reuters")
        assert a.source == NewsSource.REUTERS

    def test_unknown_source_defaults(self):
        a = self.engine.ingest_article(headline="Test", source="unknown_src")
        assert a.source == NewsSource.CUSTOM

    def test_published_at(self):
        ts = 1700000000.0
        a = self.engine.ingest_article(headline="Old news", published_at=ts)
        assert a.published_at == ts

    def test_entity_extraction_in_ingest(self):
        a = self.engine.ingest_article(
            headline="Revenue was $5,000,000 up 15% for $AAPL",
            symbols=["AAPL"],
        )
        assert len(a.entities) > 0

    def test_multiple_ingestion(self):
        for i in range(20):
            self.engine.ingest_article(
                headline=f"Article {i} about growth profit gains",
                symbols=["AAPL"],
            )
        assert self.engine.feed.count == 20
        result = self.engine.get_symbol_sentiment("AAPL")
        assert result["articles"] == 20
