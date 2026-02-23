"""
Waves 11-20 — Sentiment Pipeline API Routes
FinBERT scoring, news ingestion, sentiment dashboard, signal overlay.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import hashlib
from datetime import datetime, timezone
import logging

from ...waves11_20.sentiment import (
    get_sentiment_pipeline, NewsArticle, NewsSource
)

router = APIRouter(prefix="/api/v2/sentiment", tags=["sentiment-v2"])
logger = logging.getLogger(__name__)


class IngestArticleRequest(BaseModel):
    headline: str
    summary: str
    symbol: str
    source: str = "finnhub"
    published_at: Optional[str] = None
    url: Optional[str] = None


class ScoreArticleRequest(BaseModel):
    article_id: str
    positive: float
    negative: float
    neutral: float


class SignalOverlayRequest(BaseModel):
    symbol: str
    base_signal: float
    sentiment_weight: float = 0.3


@router.post("/articles")
async def ingest_article(req: IngestArticleRequest):
    """Ingest a news article."""
    pipeline = get_sentiment_pipeline()
    article = NewsArticle(
        article_id=f"art-{hashlib.md5(f'{req.headline}{req.symbol}'.encode()).hexdigest()[:10]}",
        headline=req.headline,
        summary=req.summary,
        source=NewsSource(req.source),
        symbol=req.symbol,
        published_at=req.published_at or datetime.now(timezone.utc).isoformat(),
        url=req.url,
    )
    pipeline.ingest_article(article)
    return article.to_dict()


@router.get("/articles")
async def list_articles(
    symbol: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    """List ingested articles."""
    pipeline = get_sentiment_pipeline()
    articles = pipeline.get_articles(symbol=symbol, limit=limit)
    return {"articles": [a.to_dict() for a in articles], "count": len(articles)}


@router.post("/score")
async def score_article(req: ScoreArticleRequest):
    """Score an article with FinBERT probabilities."""
    pipeline = get_sentiment_pipeline()
    articles = pipeline.get_articles()
    article = next((a for a in articles if a.article_id == req.article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail=f"Article {req.article_id} not found")

    score = pipeline.score_article(
        article, positive=req.positive, negative=req.negative, neutral=req.neutral,
    )
    return score.to_dict()


@router.get("/scores")
async def list_scores(
    symbol: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    """List sentiment scores."""
    pipeline = get_sentiment_pipeline()
    scores = pipeline.get_scores(symbol=symbol, limit=limit)
    return {"scores": [s.to_dict() for s in scores], "count": len(scores)}


@router.get("/aggregate/{symbol}")
async def aggregate_sentiment(
    symbol: str,
    lookback_hours: Optional[float] = Query(default=None),
):
    """Get aggregated sentiment for a symbol."""
    pipeline = get_sentiment_pipeline()
    agg = pipeline.aggregate_symbol(symbol, lookback_hours=lookback_hours)
    return agg.to_dict()


@router.get("/dashboard")
async def sentiment_dashboard(
    symbols: str = Query(..., description="Comma-separated symbols"),
):
    """Get sentiment dashboard for multiple symbols."""
    pipeline = get_sentiment_pipeline()
    sym_list = [s.strip() for s in symbols.split(",")]
    sentiments = pipeline.get_all_sentiments(sym_list)
    return {"sentiments": [s.to_dict() for s in sentiments]}


@router.post("/signal-overlay")
async def signal_overlay(req: SignalOverlayRequest):
    """Compute sentiment-adjusted signal overlay."""
    pipeline = get_sentiment_pipeline()
    overlay = pipeline.compute_signal_overlay(
        req.symbol, req.base_signal, req.sentiment_weight,
    )
    return overlay.to_dict()
