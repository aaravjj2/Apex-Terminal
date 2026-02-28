"""
order_flow_routes.py
FastAPI routes for dark pool prints, block trade detection,
tape analysis, options flow scoring, and unusual activity.
"""

from __future__ import annotations
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/order-flow", tags=["Order Flow"])

try:
    from services.order_flow_engine import (
        TapeEngine, BlockTradeDetector, DarkPoolTracker,
        OptionsFlowScanner, UnusualActivityMonitor,
        get_tape_stats, get_blocks, get_dark_pool_prints,
        get_options_flow, get_unusual_activity,
        TICKERS_BY_SECTOR if False else None,
    )
    _tape_engine = TapeEngine()
    _blocks = BlockTradeDetector()
    _dp = DarkPoolTracker()
    _opts = OptionsFlowScanner()
    _unusual = UnusualActivityMonitor()
    _engine_ready = True
except Exception as e:
    logger.warning(f"Order flow engine import failed: {e}")
    _engine_ready = False

def _check():
    if not _engine_ready:
        raise HTTPException(status_code=503, detail="Order flow engine unavailable")


class WatchlistRequest(BaseModel):
    tickers: List[str] = Field(default_factory=list)
    spots: Optional[dict] = None


@router.get("/tape/{ticker}")
async def get_tape(
    ticker: str,
    n: int = Query(100, ge=10, le=500),
    spot: float = Query(100.0, gt=0),
    window_minutes: int = Query(30, ge=1, le=480),
):
    """Get live tape entries and statistics for a ticker."""
    _check()
    try:
        from services.order_flow_engine import TapeEngine
        engine = TapeEngine()
        tape = engine.generate_tape(ticker.upper(), n=n, spot=spot)
        stats = engine.compute_statistics(tape, window_minutes)
        return {
            "ticker": ticker.upper(),
            "stats": {
                "total_trades": stats.total_trades, "buy_volume": stats.buy_volume,
                "sell_volume": stats.sell_volume, "total_volume": stats.total_volume,
                "buy_dollar": stats.buy_dollar, "sell_dollar": stats.sell_dollar,
                "block_count": stats.block_count, "dark_pool_count": stats.dark_pool_count,
                "dark_pool_pct": stats.dark_pool_pct, "vwap": stats.vwap,
                "avg_trade_size": stats.avg_trade_size, "obv_direction": stats.obv_direction,
                "flow_sentiment": stats.flow_sentiment.value,
            },
            "tape": [
                {
                    "ticker": t.ticker, "timestamp": t.timestamp.isoformat(),
                    "price": t.price, "size": t.size, "dollar_value": t.dollar_value,
                    "trade_type": t.trade_type.value, "side": t.side.value,
                    "exchange": t.exchange, "is_dark_pool": t.is_dark_pool,
                    "is_block": t.is_block, "conditions": t.conditions,
                }
                for t in tape[:n]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/blocks/{ticker}")
async def get_block_trades(
    ticker: str,
    n: int = Query(20, ge=5, le=100),
    spot: float = Query(100.0, gt=0),
):
    """Get detected block trade list with dollar values and premium analysis."""
    _check()
    try:
        from services.order_flow_engine import BlockTradeDetector
        engine = BlockTradeDetector()
        blocks = engine.detect_blocks(ticker.upper(), n=n, spot=spot)
        imbalance = engine.get_block_imbalance(blocks)
        return {
            "ticker": ticker.upper(), "count": len(blocks),
            "imbalance": imbalance,
            "blocks": [
                {
                    "timestamp": b.timestamp.isoformat(), "price": b.price, "size": b.size,
                    "dollar_value": b.dollar_value, "side": b.side.value,
                    "exchange": b.exchange, "alert_level": b.alert_level.value,
                    "premium_pct": b.premium_to_market, "note": b.note,
                }
                for b in blocks
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dark-pool/{ticker}")
async def get_dark_pool(
    ticker: str,
    n: int = Query(30, ge=5, le=100),
    spot: float = Query(100.0, gt=0),
):
    """Get dark pool prints and key price levels."""
    _check()
    try:
        from services.order_flow_engine import DarkPoolTracker
        engine = DarkPoolTracker()
        prints = engine.get_prints(ticker.upper(), n=n, spot=spot)
        levels = engine.get_key_levels(prints, spot)
        return {
            "ticker": ticker.upper(), "count": len(prints),
            "key_levels": levels,
            "prints": [
                {
                    "timestamp": p.timestamp.isoformat(), "price": p.price, "size": p.size,
                    "dollar_value": p.dollar_value, "venue": p.venue,
                    "level_type": p.level_type, "significance": p.significance, "note": p.note,
                }
                for p in prints
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/options-flow/{ticker}")
async def get_options_flow_route(
    ticker: str,
    n: int = Query(50, ge=10, le=200),
    spot: float = Query(100.0, gt=0),
    window_minutes: int = Query(60, ge=15, le=480),
):
    """Get options flow entries and flow summary for a ticker."""
    _check()
    try:
        from services.order_flow_engine import OptionsFlowScanner
        engine = OptionsFlowScanner()
        flows = engine.scan_flow(ticker.upper(), n=n, spot=spot)
        summary = engine.summarize_flow(flows, ticker.upper(), window_minutes)
        return {
            "ticker": ticker.upper(),
            "summary": {
                "call_premium": summary.call_premium, "put_premium": summary.put_premium,
                "net_premium": summary.net_premium, "put_call_ratio": summary.put_call_ratio,
                "call_sweeps": summary.call_sweeps, "put_sweeps": summary.put_sweeps,
                "unusual_count": summary.unusual_count, "sentiment": summary.sentiment.value,
                "sentiment_score": summary.sentiment_score,
                "dominant_expiry": summary.dominant_expiry, "dominant_strike": summary.dominant_strike,
            },
            "flow": [
                {
                    "timestamp": f.timestamp.isoformat(), "expiry": f.expiry, "strike": f.strike,
                    "option_type": f.option_type, "side": f.side.value, "size": f.size,
                    "premium": f.premium, "total_premium": f.total_premium,
                    "spot": f.spot_at_trade, "delta": f.delta, "iv": f.iv,
                    "is_sweep": f.is_sweep, "is_unusual": f.is_unusual,
                    "sentiment_score": f.sentiment_score, "underlying_move_est": f.underlying_move_est,
                }
                for f in flows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unusual/{ticker}")
async def get_unusual_alerts(
    ticker: str,
    spot: float = Query(100.0, gt=0),
):
    """Get unusual activity alerts for a ticker."""
    _check()
    try:
        from services.order_flow_engine import UnusualActivityMonitor
        monitor = UnusualActivityMonitor()
        alerts = monitor.scan_ticker(ticker.upper(), spot=spot)
        return {
            "ticker": ticker.upper(),
            "alert_count": len(alerts),
            "alerts": [
                {
                    "timestamp": a.timestamp.isoformat(), "type": a.activity_type,
                    "description": a.description, "significance": a.significance,
                    "dollar_amount": a.dollar_amount, "alert_level": a.alert_level.value,
                    "metadata": a.metadata,
                }
                for a in alerts
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unusual/watchlist")
async def scan_watchlist(req: WatchlistRequest):
    """Scan multiple tickers for unusual activity."""
    _check()
    if not req.tickers:
        raise HTTPException(status_code=400, detail="Provide at least one ticker")
    if len(req.tickers) > 20:
        raise HTTPException(status_code=400, detail="Max 20 tickers per request")
    try:
        from services.order_flow_engine import UnusualActivityMonitor
        monitor = UnusualActivityMonitor()
        alerts = monitor.scan_watchlist(req.tickers, req.spots)
        return {
            "tickers": req.tickers,
            "total_alerts": len(alerts),
            "alerts": [
                {
                    "ticker": a.ticker, "timestamp": a.timestamp.isoformat(),
                    "type": a.activity_type, "description": a.description,
                    "significance": a.significance, "dollar_amount": a.dollar_amount,
                    "alert_level": a.alert_level.value, "metadata": a.metadata,
                }
                for a in alerts[:50]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    return {"status": "operational", "engine_ready": _engine_ready}
