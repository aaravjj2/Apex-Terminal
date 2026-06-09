"""Research Agent API — 4-node deterministic state machine."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .handshake_bridge import submit_trade_plan_handshake
from .mcp_mount import mcp_sse_mounted
from .news_engine import fetch_headlines
from .sentiment_engine import finbert_available
from .state_machine import run_research_agent

router = APIRouter(prefix="/api/v1/research", tags=["research-agent"])


class ResearchRunRequest(BaseModel):
    osi_symbol: str | None = Field(default=None, description="21-char OSI string")
    occ_symbol: str | None = Field(default=None, description="Compact OCC symbol")
    news_text: str = ""
    event_type: str | None = None
    market_mid: float | None = Field(default=None, gt=0)
    trade_plan_id: str | None = None
    fetch_news: bool = Field(default=True, description="Auto-fetch headlines when news_text empty")


class ResearchHandshakeRequest(BaseModel):
    trade_plan: dict[str, Any] | None = None
    osi_symbol: str | None = None
    occ_symbol: str | None = None
    news_text: str = ""
    event_type: str | None = None
    market_mid: float | None = Field(default=None, gt=0)
    fetch_news: bool = True
    dry_run: bool = True
    position_size: float = 100.0


@router.get("/status")
def research_status() -> dict[str, Any]:
    from services.config import get_settings

    settings = get_settings()
    return {
        "agent": "research_4_node_state_machine",
        "version": "1.2.0",
        "nodes": [
            {"id": 1, "name": "orchestrator", "capabilities": ["osi_parse", "mcp_sse", "news_ingestion"]},
            {"id": 2, "name": "quantitative_engine", "capabilities": ["bsm", "greeks", "newton_iv", "live_chain", "jaeckel_seed"]},
            {"id": 3, "name": "sentiment_quantization", "capabilities": ["finbert_softmax", "ontology", "confidence"]},
            {"id": 4, "name": "synthesis_risk", "capabilities": ["conformal_pid", "spci", "quality_gates"]},
        ],
        "llm_free": True,
        "finbert_available": finbert_available(),
        "mcp_sse_mounted": mcp_sse_mounted(),
        "mcp_sse_url": "/api/v1/research/mcp/sse",
        "handshake_url": "/api/v1/research/handshake",
        "news_sources": ["finnhub", "yfinance", "google_rss"],
        "finnhub_configured": bool(settings.finnhub_api_key),
    }


@router.get("/news/{symbol}")
def research_news(symbol: str, limit: int = 8) -> dict[str, Any]:
    """Preview ranked headlines for an underlying (Finnhub → yfinance → Google RSS)."""
    sym = symbol.strip().upper()
    if not sym or len(sym) > 10:
        raise HTTPException(status_code=400, detail="Invalid symbol")
    articles = fetch_headlines(sym, max_articles=min(limit, 20))
    return {
        "symbol": sym,
        "count": len(articles),
        "articles": [
            {
                "headline": a.headline,
                "summary": a.summary[:300] if a.summary else "",
                "source": a.source,
                "provider": a.provider,
                "url": a.url,
                "published_at": a.published_at.isoformat(),
                "relevance_score": a.relevance_score,
            }
            for a in articles
        ],
    }


@router.post("/run")
def research_run(body: ResearchRunRequest) -> dict[str, Any]:
    try:
        return run_research_agent(
            osi_symbol=body.osi_symbol,
            occ_symbol=body.occ_symbol,
            news_text=body.news_text,
            event_type=body.event_type,
            market_mid=body.market_mid,
            trade_plan_id=body.trade_plan_id,
            fetch_news=body.fetch_news,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/demo")
def research_demo() -> dict[str, Any]:
    """Blueprint example payload (SPY call from methodology doc)."""
    from datetime import date

    return run_research_agent(
        osi_symbol="SPY   251219C00600000",
        news_text="SPY beats earnings estimates; guidance raised for next quarter",
        event_type="EARNINGS_BEAT",
        market_mid=12.60,
        spot_override=542.15,
        as_of=date(2025, 6, 9),
        trade_plan_id="REQ-7738-ALPHA",
        fetch_news=False,
    )


@router.post("/handshake")
async def research_handshake(body: ResearchHandshakeRequest) -> dict[str, Any]:
    """
    Run pipeline (or accept existing trade plan) and forward to TCC Autopilot handshake.

    Only APPROVED trade plans proceed to L3 M-gates → L4 Autopilot.
    """
    try:
        if body.trade_plan:
            plan = body.trade_plan
        else:
            plan = run_research_agent(
                osi_symbol=body.osi_symbol,
                occ_symbol=body.occ_symbol,
                news_text=body.news_text,
                event_type=body.event_type,
                market_mid=body.market_mid,
                fetch_news=body.fetch_news,
            )
        result = await submit_trade_plan_handshake(
            plan,
            dry_run=body.dry_run,
            position_size=body.position_size,
        )
        result["trade_plan"] = plan
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
