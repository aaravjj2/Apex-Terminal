"""
Wave 6 — News Sentiment Engine
Enhanced sentiment analysis for universe symbols.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/sentiment", tags=["sentiment"])


class SentimentArticle(BaseModel):
    article_id: str
    headline: str
    source: str
    published_at: str
    sentiment: str  # bullish / bearish / neutral
    confidence: float
    relevance: float
    symbols: List[str]


class SymbolSentiment(BaseModel):
    symbol: str
    overall_sentiment: str
    score: float  # -1.0 to 1.0
    article_count: int
    bullish_count: int
    bearish_count: int
    neutral_count: int
    top_headline: str


DEMO_ARTICLES: List[dict] = [
    {"article_id": "art-001", "headline": "Apple reports record Q4 revenue beating estimates", "source": "Reuters",
     "published_at": "2026-01-16T09:30:00Z", "sentiment": "bullish", "confidence": 0.92, "relevance": 0.98, "symbols": ["AAPL"]},
    {"article_id": "art-002", "headline": "NVIDIA faces supply chain concerns amid AI chip demand", "source": "Bloomberg",
     "published_at": "2026-01-16T10:15:00Z", "sentiment": "bearish", "confidence": 0.78, "relevance": 0.95, "symbols": ["NVDA"]},
    {"article_id": "art-003", "headline": "Tesla announces new factory expansion in Europe", "source": "CNBC",
     "published_at": "2026-01-16T11:00:00Z", "sentiment": "bullish", "confidence": 0.85, "relevance": 0.90, "symbols": ["TSLA"]},
    {"article_id": "art-004", "headline": "S&P 500 holds steady amid mixed economic data", "source": "MarketWatch",
     "published_at": "2026-01-16T12:00:00Z", "sentiment": "neutral", "confidence": 0.88, "relevance": 0.75, "symbols": ["SPY"]},
    {"article_id": "art-005", "headline": "Microsoft Azure growth accelerates in cloud market", "source": "WSJ",
     "published_at": "2026-01-16T13:30:00Z", "sentiment": "bullish", "confidence": 0.90, "relevance": 0.93, "symbols": ["MSFT"]},
    {"article_id": "art-006", "headline": "AMD gains market share in data center processors", "source": "TechCrunch",
     "published_at": "2026-01-16T14:00:00Z", "sentiment": "bullish", "confidence": 0.82, "relevance": 0.88, "symbols": ["AMD"]},
    {"article_id": "art-007", "headline": "Meta Platforms faces regulatory scrutiny in EU", "source": "FT",
     "published_at": "2026-01-16T14:30:00Z", "sentiment": "bearish", "confidence": 0.75, "relevance": 0.85, "symbols": ["META"]},
    {"article_id": "art-008", "headline": "Amazon Web Services launches new AI services", "source": "Reuters",
     "published_at": "2026-01-16T15:00:00Z", "sentiment": "bullish", "confidence": 0.87, "relevance": 0.91, "symbols": ["AMZN"]},
]

DEMO_SYMBOL_SENTIMENTS: List[dict] = [
    {"symbol": "AAPL", "overall_sentiment": "bullish", "score": 0.72, "article_count": 5, "bullish_count": 3, "bearish_count": 1, "neutral_count": 1, "top_headline": "Apple reports record Q4 revenue beating estimates"},
    {"symbol": "NVDA", "overall_sentiment": "bearish", "score": -0.35, "article_count": 4, "bullish_count": 1, "bearish_count": 2, "neutral_count": 1, "top_headline": "NVIDIA faces supply chain concerns amid AI chip demand"},
    {"symbol": "TSLA", "overall_sentiment": "bullish", "score": 0.55, "article_count": 6, "bullish_count": 3, "bearish_count": 1, "neutral_count": 2, "top_headline": "Tesla announces new factory expansion in Europe"},
    {"symbol": "SPY", "overall_sentiment": "neutral", "score": 0.05, "article_count": 8, "bullish_count": 3, "bearish_count": 2, "neutral_count": 3, "top_headline": "S&P 500 holds steady amid mixed economic data"},
    {"symbol": "MSFT", "overall_sentiment": "bullish", "score": 0.68, "article_count": 4, "bullish_count": 3, "bearish_count": 0, "neutral_count": 1, "top_headline": "Microsoft Azure growth accelerates in cloud market"},
    {"symbol": "AMD", "overall_sentiment": "bullish", "score": 0.48, "article_count": 3, "bullish_count": 2, "bearish_count": 0, "neutral_count": 1, "top_headline": "AMD gains market share in data center processors"},
    {"symbol": "META", "overall_sentiment": "bearish", "score": -0.22, "article_count": 5, "bullish_count": 1, "bearish_count": 3, "neutral_count": 1, "top_headline": "Meta Platforms faces regulatory scrutiny in EU"},
    {"symbol": "AMZN", "overall_sentiment": "bullish", "score": 0.61, "article_count": 4, "bullish_count": 3, "bearish_count": 0, "neutral_count": 1, "top_headline": "Amazon Web Services launches new AI services"},
]


@router.get("/articles")
async def list_articles(symbol: str = None, limit: int = 20):
    articles = DEMO_ARTICLES
    if symbol:
        articles = [a for a in articles if symbol.upper() in a["symbols"]]
    return {"articles": articles[:limit], "total": len(articles)}


@router.get("/symbols")
async def symbol_sentiments():
    return {"sentiments": DEMO_SYMBOL_SENTIMENTS}


@router.get("/symbols/{symbol}")
async def symbol_sentiment(symbol: str):
    for s in DEMO_SYMBOL_SENTIMENTS:
        if s["symbol"] == symbol.upper():
            return s
    return {"symbol": symbol.upper(), "overall_sentiment": "unknown", "score": 0.0, "article_count": 0,
            "bullish_count": 0, "bearish_count": 0, "neutral_count": 0, "top_headline": "No data"}


@router.get("/hash")
async def sentiment_hash():
    canonical = json.dumps(DEMO_SYMBOL_SENTIMENTS, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest()}


@router.get("/market-mood")
async def market_mood():
    avg_score = sum(s["score"] for s in DEMO_SYMBOL_SENTIMENTS) / len(DEMO_SYMBOL_SENTIMENTS)
    if avg_score > 0.3:
        mood = "bullish"
    elif avg_score < -0.3:
        mood = "bearish"
    else:
        mood = "neutral"
    return {"mood": mood, "avg_score": round(avg_score, 4), "symbol_count": len(DEMO_SYMBOL_SENTIMENTS)}
