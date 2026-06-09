"""News ingestion for Research Agent Node 3 — multi-source headline fetch + ranking."""

from __future__ import annotations

import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from .sentiment_engine import CatalystTag, tag_catalyst

logger = logging.getLogger(__name__)

NewsSource = Literal["finnhub", "yfinance", "google_rss", "manual", "synthetic"]

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SEC = 300

_EARNINGS_KW = re.compile(r"\b(earnings|eps|revenue|guidance|beat|miss|quarter)\b", re.I)
_ANALYST_KW = re.compile(r"\b(upgrade|downgrade|analyst|price target|outperform|underperform)\b", re.I)


@dataclass
class NewsArticle:
    headline: str
    summary: str
    source: str
    url: str
    published_at: datetime
    provider: NewsSource
    relevance_score: float = 0.0
    symbols: list[str] = field(default_factory=list)

    def combined_text(self) -> str:
        parts = [self.headline.strip()]
        if self.summary.strip():
            parts.append(self.summary.strip())
        return ". ".join(parts)


@dataclass
class NewsFetchResult:
    text: str
    headline: str
    summary: str
    event_type: str | None
    source: NewsSource
    provider_detail: str
    article_count: int
    selected_article: NewsArticle | None
    articles: list[NewsArticle]
    fetch_ok: bool


def _cache_get(key: str) -> Any | None:
    entry = _CACHE.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    return None


def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (value, time.monotonic() + _CACHE_TTL_SEC)


def _score_article(article: NewsArticle, underlying: str) -> float:
    text = article.combined_text().upper()
    score = 0.0
    if underlying.upper() in text:
        score += 0.35
    if underlying.upper() in article.symbols:
        score += 0.2
    age_h = max(0.0, (datetime.now(timezone.utc) - article.published_at).total_seconds() / 3600)
    if age_h < 6:
        score += 0.25
    elif age_h < 24:
        score += 0.15
    elif age_h < 72:
        score += 0.05
    if _EARNINGS_KW.search(article.combined_text()):
        score += 0.15
    if _ANALYST_KW.search(article.combined_text()):
        score += 0.08
    return round(min(1.0, score), 3)


def _fetch_finnhub_company_news(underlying: str, *, days: int = 7) -> list[NewsArticle]:
    try:
        import httpx
        from services.config import get_settings

        key = get_settings().finnhub_api_key
        if not key:
            return []

        cache_key = f"fh:{underlying}:{days}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days)
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://finnhub.io/api/v1/company-news",
                params={
                    "symbol": underlying.upper(),
                    "from": from_date.strftime("%Y-%m-%d"),
                    "to": to_date.strftime("%Y-%m-%d"),
                    "token": key,
                },
            )
            resp.raise_for_status()
            raw = resp.json()

        articles: list[NewsArticle] = []
        for item in raw if isinstance(raw, list) else []:
            headline = str(item.get("headline", "")).strip()
            if not headline:
                continue
            ts = datetime.fromtimestamp(int(item.get("datetime", 0)), tz=timezone.utc)
            related = str(item.get("related", "") or "")
            symbols = [s.strip().upper() for s in related.split(",") if s.strip()]
            articles.append(
                NewsArticle(
                    headline=headline,
                    summary=str(item.get("summary", "")).strip(),
                    source=str(item.get("source", "Finnhub")),
                    url=str(item.get("url", "")),
                    published_at=ts,
                    provider="finnhub",
                    symbols=symbols,
                )
            )

        _cache_set(cache_key, articles)
        return articles
    except Exception as exc:
        logger.debug("Finnhub company news failed for %s: %s", underlying, exc)
        return []


def _fetch_yfinance_news(underlying: str) -> list[NewsArticle]:
    try:
        import yfinance as yf

        cache_key = f"yf:{underlying}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        raw = getattr(yf.Ticker(underlying.upper()), "news", None) or []
        articles: list[NewsArticle] = []
        for item in raw:
            headline = str(item.get("title", "")).strip()
            if not headline:
                continue
            pub = item.get("providerPublishTime") or item.get("publishedAt")
            if isinstance(pub, (int, float)) and pub > 0:
                ts = datetime.fromtimestamp(pub, tz=timezone.utc)
            else:
                ts = datetime.now(timezone.utc)
            articles.append(
                NewsArticle(
                    headline=headline,
                    summary=str(item.get("summary", "") or item.get("description", "")).strip(),
                    source=str(item.get("publisher", "yfinance")),
                    url=str(item.get("link", "") or item.get("url", "")),
                    published_at=ts,
                    provider="yfinance",
                    symbols=[underlying.upper()],
                )
            )

        _cache_set(cache_key, articles)
        return articles
    except Exception as exc:
        logger.debug("yfinance news failed for %s: %s", underlying, exc)
        return []


def _fetch_google_rss_news(underlying: str) -> list[NewsArticle]:
    try:
        cache_key = f"rss:{underlying}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        query = quote_plus(f"{underlying} stock earnings")
        url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
        req = Request(url, headers={"User-Agent": "ApexResearchAgent/1.2"})
        with urlopen(req, timeout=10) as resp:
            root = ET.fromstring(resp.read())

        articles: list[NewsArticle] = []
        for item in root.findall(".//item")[:20]:
            headline = (item.findtext("title") or "").strip()
            if not headline:
                continue
            pub_raw = item.findtext("pubDate") or ""
            try:
                ts = datetime.strptime(pub_raw[:25], "%a, %d %b %Y %H:%M:%S").replace(tzinfo=timezone.utc)
            except ValueError:
                ts = datetime.now(timezone.utc)
            articles.append(
                NewsArticle(
                    headline=headline,
                    summary=(item.findtext("description") or "").strip(),
                    source="Google News",
                    url=(item.findtext("link") or "").strip(),
                    published_at=ts,
                    provider="google_rss",
                    symbols=[underlying.upper()],
                )
            )

        _cache_set(cache_key, articles)
        return articles
    except Exception as exc:
        logger.debug("Google RSS news failed for %s: %s", underlying, exc)
        return []


def fetch_headlines(underlying: str, *, max_articles: int = 12) -> list[NewsArticle]:
    """Fetch and merge headlines from Finnhub → yfinance → Google RSS."""
    merged: list[NewsArticle] = []
    seen: set[str] = set()

    for batch_fn in (_fetch_finnhub_company_news, _fetch_yfinance_news, _fetch_google_rss_news):
        for art in batch_fn(underlying):
            key = art.headline.lower()[:120]
            if key in seen:
                continue
            seen.add(key)
            art.relevance_score = _score_article(art, underlying)
            merged.append(art)

    merged.sort(key=lambda a: (a.relevance_score, a.published_at), reverse=True)
    return merged[:max_articles]


def _infer_event_type(text: str, explicit: str | None) -> str | None:
    if explicit:
        return explicit.upper().replace(" ", "_")
    tag = tag_catalyst(text)
    return None if tag == CatalystTag.GENERAL_NEWS else tag.value


def resolve_news_input(
    *,
    underlying: str,
    news_text: str = "",
    event_type: str | None = None,
    fetch_news: bool = True,
) -> NewsFetchResult:
    """
    Resolve headline text for sentiment analysis.
    Manual text wins; otherwise fetch live headlines when enabled.
    """
    manual = news_text.strip()
    if manual:
        tag = _infer_event_type(manual, event_type)
        return NewsFetchResult(
            text=manual,
            headline=manual.split(".")[0][:240],
            summary=manual,
            event_type=tag,
            source="manual",
            provider_detail="user_input",
            article_count=0,
            selected_article=None,
            articles=[],
            fetch_ok=True,
        )

    if not fetch_news:
        synthetic = (
            f"{underlying} options activity — no headline provided; enable fetch_news for live catalysts"
        )
        return NewsFetchResult(
            text=synthetic,
            headline=synthetic,
            summary="",
            event_type=event_type,
            source="synthetic",
            provider_detail="no_input",
            article_count=0,
            selected_article=None,
            articles=[],
            fetch_ok=False,
        )

    articles = fetch_headlines(underlying)
    if not articles:
        synthetic = f"{underlying} market update — news providers unavailable"
        return NewsFetchResult(
            text=synthetic,
            headline=synthetic,
            summary="",
            event_type=event_type,
            source="synthetic",
            provider_detail="all_providers_failed",
            article_count=0,
            selected_article=None,
            articles=[],
            fetch_ok=False,
        )

    top = articles[0]
    text = top.combined_text()
    tag = _infer_event_type(text, event_type)
    return NewsFetchResult(
        text=text,
        headline=top.headline,
        summary=top.summary,
        event_type=tag,
        source=top.provider,
        provider_detail=f"{top.provider}:{top.source}",
        article_count=len(articles),
        selected_article=top,
        articles=articles,
        fetch_ok=True,
    )
