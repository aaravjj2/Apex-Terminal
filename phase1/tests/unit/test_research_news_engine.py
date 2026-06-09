"""Unit tests for Research Agent news engine."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from services.research_agent.news_engine import (
    NewsArticle,
    _score_article,
    fetch_headlines,
    resolve_news_input,
)
from services.research_agent.sentiment_engine import CatalystTag


def test_manual_news_takes_priority():
    result = resolve_news_input(
        underlying="SPY",
        news_text="SPY beats earnings estimates; guidance raised",
        event_type="EARNINGS_BEAT",
        fetch_news=True,
    )
    assert result.source == "manual"
    assert result.fetch_ok
    assert "beats earnings" in result.text.lower()


def test_synthetic_when_fetch_disabled_and_empty():
    result = resolve_news_input(underlying="SPY", news_text="", fetch_news=False)
    assert result.source == "synthetic"
    assert not result.fetch_ok


def test_article_scoring_prefers_ticker_and_recency():
    art = NewsArticle(
        headline="SPY beats Q4 earnings",
        summary="Guidance raised",
        source="Test",
        url="",
        published_at=datetime.now(timezone.utc),
        provider="finnhub",
        symbols=["SPY"],
    )
    score = _score_article(art, "SPY")
    assert score >= 0.5


@patch("services.research_agent.news_engine._fetch_finnhub_company_news")
@patch("services.research_agent.news_engine._fetch_yfinance_news")
@patch("services.research_agent.news_engine._fetch_google_rss_news")
def test_fetch_headlines_merges_sources(mock_rss, mock_yf, mock_fh):
    mock_fh.return_value = [
        NewsArticle("A", "", "FH", "", datetime.now(timezone.utc), "finnhub", symbols=["SPY"]),
    ]
    mock_yf.return_value = [
        NewsArticle("B", "", "YF", "", datetime.now(timezone.utc), "yfinance", symbols=["SPY"]),
    ]
    mock_rss.return_value = [
        NewsArticle("A", "", "RSS", "", datetime.now(timezone.utc), "google_rss", symbols=["SPY"]),
    ]
    articles = fetch_headlines("SPY", max_articles=5)
    assert len(articles) == 2
    headlines = {a.headline for a in articles}
    assert "A" in headlines and "B" in headlines


@patch("services.research_agent.news_engine.fetch_headlines")
def test_resolve_fetched_news_infers_event(mock_fetch):
    mock_fetch.return_value = [
        NewsArticle(
            headline="SPY beats earnings and raises guidance",
            summary="Strong quarter",
            source="Reuters",
            url="https://example.com",
            published_at=datetime.now(timezone.utc),
            provider="finnhub",
            symbols=["SPY"],
            relevance_score=0.9,
        )
    ]
    result = resolve_news_input(underlying="SPY", news_text="", fetch_news=True)
    assert result.source == "finnhub"
    assert result.fetch_ok
    assert result.event_type == CatalystTag.EARNINGS_BEAT.value
