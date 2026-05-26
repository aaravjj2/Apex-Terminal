"""
Wave 6 — News Sentiment Engine (Live Finnhub Integration)
=========================================================
GET /api/v1/sentiment/articles      — Live market news (Finnhub → empty on failure)
GET /api/v1/sentiment/symbols       — Per-symbol sentiment scores (Finnhub)
GET /api/v1/sentiment/symbols/{sym} — Per-symbol summary
GET /api/v1/sentiment/hash          — Data fingerprint
GET /api/v1/sentiment/market-mood   — Aggregate market mood

Data priority: Finnhub live → warning log (no stale demo data shown to user).
Cache TTL: 5 minutes to avoid hammering the Finnhub rate limit.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, List, Optional

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/sentiment", tags=["sentiment"])
_log = logging.getLogger(__name__)

# ── Symbols to track for symbol-level sentiment ───────────────────────────────
UNIVERSE: List[str] = [
    "AAPL", "NVDA", "TSLA", "MSFT", "AMZN",
    "META", "AMD", "GOOGL", "JPM", "SPY",
]

# ── Simple in-process TTL cache ───────────────────────────────────────────────
_CACHE: Dict[str, tuple] = {}
_CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    return None


def _cache_set(key: str, value, ttl: int = _CACHE_TTL) -> None:
    _CACHE[key] = (value, time.monotonic() + ttl)


# ── Keyword sentiment classifier ──────────────────────────────────────────────
_BULL_WORDS = frozenset([
    "beat", "surge", "rally", "record", "growth", "upgrade", "buy",
    "strong", "positive", "gain", "expansion", "jump", "boost",
    "profit", "revenue", "rises", "soars", "bullish", "outperform",
])
_BEAR_WORDS = frozenset([
    "miss", "drop", "fall", "decline", "cut", "downgrade", "sell",
    "weak", "loss", "layoff", "recall", "concern", "warning",
    "slump", "tumble", "bearish", "recession", "default", "lawsuit",
])


def _classify_sentiment(text: str) -> tuple[str, float]:
    """Simple keyword heuristic returning (sentiment_label, confidence)."""
    words = [w.strip(".,!?;:\"'") for w in text.lower().split()]
    bull = sum(1 for w in words if w in _BULL_WORDS)
    bear = sum(1 for w in words if w in _BEAR_WORDS)
    total = bull + bear
    if total == 0:
        return "neutral", 0.65
    if bull > bear:
        return "bullish", min(0.95, 0.65 + bull * 0.04)
    if bear > bull:
        return "bearish", min(0.95, 0.65 + bear * 0.04)
    return "neutral", 0.65


def _extract_symbols(text: str) -> List[str]:
    """Extract universe symbols that appear in text."""
    text_upper = text.upper()
    return [s for s in UNIVERSE if s in text_upper]


# ── Finnhub REST helpers (synchronous — run via executor) ─────────────────────

def _fetch_finnhub_market_news_sync(limit: int = 30) -> Optional[List[dict]]:
    """
    Fetch live general market news from Finnhub.
    GET https://finnhub.io/api/v1/news?category=general&token=...
    Returns list of article dicts, or None if Finnhub is unavailable.
    """
    cached = _cache_get("market_news")
    if cached is not None:
        return cached

    try:
        import datetime
        import httpx
        from ...config import get_settings

        settings = get_settings()
        key = settings.finnhub_api_key
        if not key:
            _log.warning(
                "FINNHUB_API_KEY not configured — news feed unavailable. "
                "Set FINNHUB_API_KEY in keys.env to enable live news."
            )
            return None

        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://finnhub.io/api/v1/news",
                params={"category": "general", "token": key},
            )
            resp.raise_for_status()
            raw = resp.json()

        if not isinstance(raw, list) or not raw:
            _log.warning("Finnhub returned empty news list")
            return None

        articles: List[dict] = []
        for i, item in enumerate(raw[:limit]):
            headline = item.get("headline", "").strip()
            summary = item.get("summary", "").strip()
            if not headline:
                continue
            source = item.get("source", "Unknown")
            dt = item.get("datetime", 0)
            try:
                ts = datetime.datetime.utcfromtimestamp(int(dt)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            except Exception:
                ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

            sentiment, confidence = _classify_sentiment(headline + " " + summary)
            symbols = _extract_symbols(headline + " " + summary)
            articles.append({
                "article_id": f"fh-{item.get('id', i)}",
                "headline": headline,
                "source": source,
                "published_at": ts,
                "sentiment": sentiment,
                "confidence": round(confidence, 2),
                "relevance": 0.80,
                "symbols": symbols,
                "url": item.get("url", ""),
                "summary": (summary[:300] + "…") if len(summary) > 300 else summary,
            })

        _cache_set("market_news", articles)
        _log.info(f"Finnhub market news fetched: {len(articles)} articles")
        return articles

    except Exception as e:
        _log.warning(f"Finnhub market news fetch failed: {e}")
        return None


def _fetch_finnhub_symbol_sentiment_sync(symbol: str) -> Optional[dict]:
    """
    Fetch Finnhub news-sentiment score for a single symbol.
    GET https://finnhub.io/api/v1/news-sentiment?symbol=...&token=...
    Returns sentiment dict or None.
    """
    cache_key = f"sym_sentiment_{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        import httpx
        from ...config import get_settings

        settings = get_settings()
        key = settings.finnhub_api_key
        if not key:
            return None

        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://finnhub.io/api/v1/news-sentiment",
                params={"symbol": symbol, "token": key},
            )
            resp.raise_for_status()
            data = resp.json()

        if not data or "sentiment" not in data:
            return None

        bull_pct: float = data["sentiment"].get("bullishPercent", 0.5)
        bear_pct: float = data["sentiment"].get("bearishPercent", 0.5)
        score = round(float(bull_pct) - float(bear_pct), 4)
        overall = "bullish" if score > 0.1 else "bearish" if score < -0.1 else "neutral"

        buzz = data.get("buzz", {})
        count = int(buzz.get("articlesInLastWeek", 0))
        bull_n = int(count * bull_pct)
        bear_n = int(count * bear_pct)
        neutral_n = max(0, count - bull_n - bear_n)

        result = {
            "symbol": symbol,
            "overall_sentiment": overall,
            "score": score,
            "article_count": count,
            "bullish_count": bull_n,
            "bearish_count": bear_n,
            "neutral_count": neutral_n,
            "top_headline": (
                f"Bullish: {bull_pct * 100:.0f}% / Bearish: {bear_pct * 100:.0f}% "
                f"({count} articles this week, source: Finnhub)"
            ),
            "company_news_score": round(float(data.get("companyNewsScore", 0.0)), 4),
        }
        _cache_set(cache_key, result)
        return result

    except Exception as e:
        _log.debug(f"Finnhub symbol sentiment fetch failed for {symbol}: {e}")
        return None


def _null_sentiment(symbol: str) -> dict:
    """Return a zero-value sentiment record when Finnhub is unavailable."""
    return {
        "symbol": symbol,
        "overall_sentiment": "neutral",
        "score": 0.0,
        "article_count": 0,
        "bullish_count": 0,
        "bearish_count": 0,
        "neutral_count": 0,
        "top_headline": "No live data — FINNHUB_API_KEY not configured or fetch failed",
    }


# ── Route handlers ────────────────────────────────────────────────────────────

@router.get("/articles")
async def list_articles(symbol: str = None, limit: int = 20):
    """Return live Finnhub market news. Empty list (not demo data) if unavailable."""
    loop = asyncio.get_event_loop()
    articles = await loop.run_in_executor(
        None, _fetch_finnhub_market_news_sync, min(limit * 2, 60)
    )
    if articles is None:
        return {"articles": [], "total": 0, "source": "unavailable"}

    if symbol:
        articles = [a for a in articles if symbol.upper() in a.get("symbols", [])]

    result = articles[:limit]
    return {"articles": result, "total": len(result), "source": "finnhub"}


@router.get("/symbols")
async def symbol_sentiments():
    """Return per-symbol sentiment for the universe. Live Finnhub data, zeros if unavailable."""
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, _fetch_finnhub_symbol_sentiment_sync, sym)
        for sym in UNIVERSE
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    results = [
        r if isinstance(r, dict) else _null_sentiment(sym)
        for sym, r in zip(UNIVERSE, raw_results)
    ]
    source = "finnhub" if any(r["article_count"] > 0 for r in results) else "unavailable"
    return {"sentiments": results, "source": source}


@router.get("/symbols/{symbol}")
async def symbol_sentiment(symbol: str):
    """Return sentiment for a single symbol."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _fetch_finnhub_symbol_sentiment_sync, symbol.upper()
    )
    return result if result else _null_sentiment(symbol.upper())


@router.get("/hash")
async def sentiment_hash():
    """Return SHA-256 fingerprint of live news data."""
    loop = asyncio.get_event_loop()
    articles = await loop.run_in_executor(None, _fetch_finnhub_market_news_sync, 20)
    canonical = json.dumps(articles or [], sort_keys=True, separators=(",", ":"))
    return {
        "hash": hashlib.sha256(canonical.encode()).hexdigest(),
        "source": "finnhub" if articles else "unavailable",
    }


@router.get("/market-mood")
async def market_mood():
    """Aggregate market mood across the top-5 universe symbols."""
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, _fetch_finnhub_symbol_sentiment_sync, sym)
        for sym in UNIVERSE[:5]
    ]
    raw = await asyncio.gather(*tasks, return_exceptions=True)
    scores = [r["score"] for r in raw if isinstance(r, dict) and r.get("article_count", 0) > 0]
    if not scores:
        return {
            "mood": "neutral",
            "avg_score": 0.0,
            "symbol_count": 0,
            "source": "unavailable",
        }
    avg_score = sum(scores) / len(scores)
    mood = "bullish" if avg_score > 0.1 else "bearish" if avg_score < -0.1 else "neutral"
    return {
        "mood": mood,
        "avg_score": round(avg_score, 4),
        "symbol_count": len(scores),
        "source": "finnhub",
    }


# ── v4 compat aliases (frontend SentimentUI2 hits these paths) ──────────────
v4_router = APIRouter(prefix="/api/v4/sentiment", tags=["sentiment-v4-compat"])


@v4_router.get("/news")
async def v4_news(symbol: str = None, limit: int = 20):
    return await list_articles(symbol=symbol, limit=limit)


@v4_router.get("/symbols")
async def v4_symbols():
    return await symbol_sentiments()


@v4_router.get("/social")
async def v4_social(limit: int = 20):
    """Social entries — stubbed as empty until a real social provider is wired."""
    return {"entries": [], "total": 0, "source": "unavailable"}


@v4_router.get("/fear-greed")
async def v4_fear_greed():
    mood = await market_mood()
    score = mood["avg_score"]
    # Map [-1,+1] → [0,100] for a fear/greed style gauge.
    fg = max(0, min(100, round((score + 1) * 50)))
    classification = (
        "Extreme Greed" if fg >= 80 else
        "Greed" if fg >= 60 else
        "Neutral" if fg >= 40 else
        "Fear" if fg >= 20 else
        "Extreme Fear"
    )
    return {
        "score": fg,
        "classification": classification,
        "raw_mood": mood["mood"],
        "source": mood["source"],
    }


@v4_router.get("/dashboard")
async def v4_dashboard():
    mood = await market_mood()
    syms = await symbol_sentiments()
    news = await list_articles(limit=10)
    sentiments = syms.get("sentiments", [])
    bulls = sum(1 for s in sentiments if s.get("score", 0) > 0.1)
    bears = sum(1 for s in sentiments if s.get("score", 0) < -0.1)
    neutrals = max(0, len(sentiments) - bulls - bears)
    total_articles = sum(s.get("article_count", 0) for s in sentiments)
    return {
        "summary": {
            "mood": mood.get("mood"),
            "avg_score": mood.get("avg_score"),
            "symbols_tracked": len(sentiments),
            "bull_count": bulls,
            "bear_count": bears,
            "neutral_count": neutrals,
            "news_articles": total_articles,
            "social_entries": 0,
        },
        "top_headlines": news.get("articles", [])[:5],
        "source": mood.get("source"),
    }
