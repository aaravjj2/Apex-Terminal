"""
FastAPI routes for SocialSentimentEngine — text scoring, spike detection, WSB analysis.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.social_sentiment_engine import (
    SocialSentimentEngine,
    SocialPost,
    TextSentimentAnalyzer,
    SentimentSource,
)

router = APIRouter(prefix="/api/social-sentiment", tags=["Social Sentiment"])
_engine = SocialSentimentEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class PostInput(BaseModel):
    post_id: str = Field(..., description="Unique post identifier")
    source: str = Field(..., description="Source platform: twitter|reddit|stocktwits|discord|news")
    symbol: str = Field(..., description="Ticker symbol mentioned")
    text: str = Field(..., description="Post text content")
    upvotes: int = Field(0, ge=0)
    comments: int = Field(0, ge=0)
    shares: int = Field(0, ge=0)
    followers: int = Field(0, ge=0)


class ScorePostRequest(BaseModel):
    post: PostInput


class AggregateRequest(BaseModel):
    symbol: str = Field(..., description="Ticker symbol")
    posts: List[PostInput] = Field(..., min_items=1, description="Posts to aggregate")


class SpikeDetectionRequest(BaseModel):
    hourly_counts: List[float] = Field(..., min_items=2, description="Mention counts per hour")
    threshold_z: float = Field(2.0, ge=1.0, description="Z-score threshold for spike detection")


class MomentumRequest(BaseModel):
    daily_counts: List[float] = Field(..., min_items=5, description="Mention counts per day")


class TextScoreRequest(BaseModel):
    text: str = Field(..., description="Text to analyze for sentiment")


class FullAnalysisRequest(BaseModel):
    symbol: str = Field(..., description="Ticker symbol")
    posts: List[PostInput] = Field(..., min_items=1)
    hourly_counts: Optional[List[float]] = Field(None, description="Optional hourly mention counts for spike detection")
    daily_counts: Optional[List[float]] = Field(None, description="Optional daily counts for momentum")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_post(p: PostInput) -> SocialPost:
    source_map = {s.value: s for s in SentimentSource}
    source = source_map.get(p.source.lower(), SentimentSource.TWITTER)
    return SocialPost(
        post_id=p.post_id,
        source=source,
        symbol=p.symbol,
        text=p.text,
        upvotes=p.upvotes,
        comments=p.comments,
        shares=p.shares,
        followers=p.followers,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported sources."""
    return _engine.capabilities()


@router.post("/score-text")
def score_text(body: TextScoreRequest):
    """Score raw text for bullish/bearish sentiment."""
    try:
        analyzer = TextSentimentAnalyzer()
        score = analyzer.score_text(body.text)
        polarity = analyzer.polarity(score)
        return {
            "text_preview": body.text[:100],
            "score": round(score, 6),
            "polarity": polarity.value,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/score-post")
def score_post(body: ScorePostRequest):
    """Score a social media post for sentiment."""
    try:
        post = _parse_post(body.post)
        result = _engine.score_post(post)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/aggregate")
def aggregate_sentiment(body: AggregateRequest):
    """Compute weighted aggregate sentiment for a symbol across multiple posts."""
    try:
        posts = [_parse_post(p) for p in body.posts]
        result = _engine.aggregate(posts)
        if not result:
            raise HTTPException(status_code=422, detail="Unable to aggregate — no scoreable posts")
        return {"symbol": body.symbol, "post_count": len(posts), **result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/detect-spike")
def detect_spike(body: SpikeDetectionRequest):
    """Detect abnormal mention volume spikes using z-score analysis."""
    try:
        result = _engine.detect_spike(body.hourly_counts, body.threshold_z)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/mention-trend")
def mention_trend(body: MomentumRequest):
    """Analyze trending direction of mention volume over time."""
    try:
        from services.social_sentiment_engine import MentionVolumeAnalyzer
        result = MentionVolumeAnalyzer.mention_trend(body.daily_counts)
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data for trend analysis (need 7+ days)")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/wsb-analysis")
def wsb_analysis(body: AggregateRequest):
    """Analyze posts for WallStreetBets-style content, YOLO sentiment, and squeeze mentions."""
    try:
        posts = [_parse_post(p) for p in body.posts]
        from services.social_sentiment_engine import WallStreetBetsAnalyzer
        wsb_posts = [p for p in posts if WallStreetBetsAnalyzer.is_wsb_style(p)]
        scored = [(p, _engine._analyzer.score_text(p.text)) for p in posts]
        yolo_r = _engine.yolo_ratio(scored)
        squeeze = _engine.squeeze_candidates(posts)
        return {
            "symbol": body.symbol,
            "total_posts": len(posts),
            "wsb_style_posts": len(wsb_posts),
            "wsb_pct": round(len(wsb_posts) / len(posts) * 100, 2),
            "yolo_ratio": round(yolo_r, 4),
            "squeeze_analysis": squeeze,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/controversy")
def controversy_score(body: AggregateRequest):
    """Compute the controversy/disagreement score for a symbol."""
    try:
        posts = [_parse_post(p) for p in body.posts]
        scored = [(p, _engine._analyzer.score_text(p.text)) for p in posts]
        score = _engine.controversy(scored)
        label = "polarizing" if score > 70 else "consensus" if score < 30 else "divided"
        return {
            "symbol": body.symbol,
            "controversy_score": round(score, 2),
            "label": label,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sentiment-momentum")
def sentiment_momentum(body: MomentumRequest):
    """Compute 5-day sentiment momentum slope."""
    try:
        from services.social_sentiment_engine import SocialSpreadIndicator
        result = SocialSpreadIndicator.sentiment_momentum(body.daily_counts)
        direction = "improving" if result > 0.01 else "deteriorating" if result < -0.01 else "stable"
        return {"slope": round(result, 6), "direction": direction}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/full-analysis")
def full_analysis(body: FullAnalysisRequest):
    """Run complete social sentiment analysis for a symbol."""
    try:
        posts = [_parse_post(p) for p in body.posts]
        result = _engine.full_analysis(body.symbol, posts)

        # Optionally append spike and momentum data
        if body.hourly_counts and len(body.hourly_counts) >= 2:
            result["mention_spike"] = _engine.detect_spike(body.hourly_counts)
        if body.daily_counts and len(body.daily_counts) >= 7:
            from services.social_sentiment_engine import MentionVolumeAnalyzer
            result["mention_trend"] = MentionVolumeAnalyzer.mention_trend(body.daily_counts)

        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
