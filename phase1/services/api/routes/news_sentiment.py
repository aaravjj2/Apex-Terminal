"""
News & Sentiment API Routes
============================
29 endpoints for news ingestion, sentiment analysis, aggregation,
market impact estimation, and news correlation.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from phase1.services.news_sentiment_engine import NewsSentimentEngine

router = APIRouter(prefix="/api/v1/news", tags=["news-sentiment"])
engine = NewsSentimentEngine()


# ─── Pydantic Models ────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    headline: str
    summary: str = ""
    body: str = ""
    source: str = "custom"
    url: str = ""
    symbols: Optional[List[str]] = None
    published_at: Optional[float] = None


class BatchIngestRequest(BaseModel):
    articles: List[IngestRequest]


class AnalyzeTextRequest(BaseModel):
    text: str


class BatchAnalyzeRequest(BaseModel):
    texts: List[str]


class ExtractRequest(BaseModel):
    text: str
    known_tickers: Optional[List[str]] = None


class ClassifyRequest(BaseModel):
    text: str


class CorrelationRequest(BaseModel):
    sentiment_series: List[float]
    return_series: List[float]


class VolumeCorrelationRequest(BaseModel):
    news_counts: List[int]
    volatility: List[float]


class SearchRequest(BaseModel):
    query: str
    limit: int = 50


# ─── Ingestion ──────────────────────────────────────────────────────────────

@router.post("/ingest")
def ingest_article(req: IngestRequest):
    article = engine.ingest_article(
        headline=req.headline, summary=req.summary, body=req.body,
        source=req.source, url=req.url, symbols=req.symbols,
        published_at=req.published_at,
    )
    return article.to_dict()


@router.post("/ingest/batch")
def ingest_batch(req: BatchIngestRequest):
    results = []
    for a in req.articles:
        article = engine.ingest_article(
            headline=a.headline, summary=a.summary, body=a.body,
            source=a.source, url=a.url, symbols=a.symbols,
            published_at=a.published_at,
        )
        results.append(article.to_dict())
    return {"ingested": len(results), "articles": results}


# ─── Sentiment Analysis ────────────────────────────────────────────────────

@router.post("/analyze")
def analyze_text(req: AnalyzeTextRequest):
    result = engine.analyzer.analyze(req.text)
    return result.to_dict()


@router.post("/analyze/headline")
def analyze_headline(req: AnalyzeTextRequest):
    result = engine.analyzer.analyze_headline(req.text)
    return result.to_dict()


@router.post("/analyze/batch")
def analyze_batch(req: BatchAnalyzeRequest):
    results = engine.analyzer.batch_analyze(req.texts)
    return {"results": [r.to_dict() for r in results]}


# ─── Entity Extraction ─────────────────────────────────────────────────────

@router.post("/extract/entities")
def extract_entities(req: ExtractRequest):
    return engine.entity_extractor.extract_entities(req.text)


@router.post("/extract/tickers")
def extract_tickers(req: ExtractRequest):
    known = set(req.known_tickers) if req.known_tickers else None
    return {"tickers": engine.entity_extractor.extract_tickers(req.text, known)}


# ─── Topic Classification ──────────────────────────────────────────────────

@router.post("/classify")
def classify_text(req: ClassifyRequest):
    cats = engine.topic_classifier.classify(req.text)
    return {"categories": [c.value for c in cats]}


# ─── Feed Queries ───────────────────────────────────────────────────────────

@router.get("/feed/latest")
def get_latest(limit: int = 50):
    articles = engine.feed.get_latest(limit)
    return {"articles": [a.to_dict() for a in articles], "count": len(articles)}


@router.get("/feed/symbol/{symbol}")
def get_by_symbol(symbol: str, limit: int = 50):
    articles = engine.feed.get_by_symbol(symbol.upper(), limit)
    return {"symbol": symbol.upper(), "articles": [a.to_dict() for a in articles],
            "count": len(articles)}


@router.get("/feed/category/{category}")
def get_by_category(category: str, limit: int = 50):
    from phase1.services.news_sentiment_engine import NewsCategory
    try:
        cat = NewsCategory(category)
    except ValueError:
        raise HTTPException(400, f"Unknown category: {category}")
    articles = engine.feed.get_by_category(cat, limit)
    return {"category": category, "articles": [a.to_dict() for a in articles]}


@router.post("/feed/search")
def search_feed(req: SearchRequest):
    results = engine.search_news(req.query, req.limit)
    return {"query": req.query, "results": results, "count": len(results)}


@router.get("/feed/{article_id}")
def get_article(article_id: str):
    article = engine.feed.get_article(article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    return article.to_dict()


@router.post("/feed/{article_id}/read")
def mark_read(article_id: str):
    ok = engine.feed.mark_read(article_id)
    return {"success": ok}


@router.get("/feed/unread/count")
def unread_count(symbol: str = ""):
    return {"unread": engine.feed.unread_count(symbol)}


# ─── Sentiment Aggregation ─────────────────────────────────────────────────

@router.get("/sentiment/symbol/{symbol}")
def symbol_sentiment(symbol: str, limit: int = 50):
    return engine.get_symbol_sentiment(symbol.upper(), limit)


@router.get("/sentiment/market")
def market_sentiment():
    return engine.get_market_sentiment()


@router.get("/sentiment/top-movers")
def top_movers(limit: int = 10):
    return {"movers": engine.get_top_movers(limit)}


# ─── Impact ─────────────────────────────────────────────────────────────────

@router.get("/impact/high")
def high_impact(limit: int = 10):
    return {"articles": engine.get_high_impact(limit)}


@router.get("/impact/article/{article_id}")
def article_impact(article_id: str):
    article = engine.feed.get_article(article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    return engine.impact_estimator.estimate_impact(article)


# ─── Correlation ────────────────────────────────────────────────────────────

@router.post("/correlation/sentiment-returns")
def sentiment_returns(req: CorrelationRequest):
    return engine.correlator.sentiment_vs_returns(
        req.sentiment_series, req.return_series)


@router.post("/correlation/volume-volatility")
def volume_volatility(req: VolumeCorrelationRequest):
    return engine.correlator.news_volume_vs_volatility(
        req.news_counts, req.volatility)


# ─── Meta ───────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def capabilities():
    return engine.capabilities()
