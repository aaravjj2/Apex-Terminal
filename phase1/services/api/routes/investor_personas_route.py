"""
investor_personas_route.py — Investor Persona Analysis API
===========================================================
GET  /api/v1/investors/analyze/{symbol}  — Single symbol analysis
POST /api/v1/investors/analyze/batch     — Multi-symbol batch
"""
from __future__ import annotations
import asyncio
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/investors", tags=["Investor Personas"])
_log = logging.getLogger(__name__)


class PersonaSignalOut(BaseModel):
    persona: str
    signal: str
    confidence: float
    reasoning: str
    key_factor: str


class ConsensusOut(BaseModel):
    symbol: str
    consensus: str
    conviction: float
    buy_votes: int
    sell_votes: int
    hold_votes: int
    weighted_score: float
    personas: List[PersonaSignalOut]
    analysis_summary: str


class BatchRequest(BaseModel):
    symbols: List[str]


async def _build_context(symbol: str) -> Optional[Any]:
    """Build StockContext from live market data."""
    from ...autopilot.investor_personas import StockContext
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()
        def _fetch():
            t = yf.Ticker(symbol)
            hist = t.history(period="6mo")
            if hist.empty or len(hist) < 20:
                return None
            info = {}
            try:
                info = t.fast_info
            except Exception:
                pass

            price = float(hist["Close"].iloc[-1])
            price_1d_ago = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
            price_5d_ago = float(hist["Close"].iloc[-6]) if len(hist) >= 6 else price
            price_30d_ago = float(hist["Close"].iloc[-31]) if len(hist) >= 31 else price

            # Simple SMA
            closes = hist["Close"]
            sma_50 = float(closes.tail(50).mean()) if len(closes) >= 50 else None
            sma_200 = float(closes.tail(200).mean()) if len(closes) >= 200 else None

            # RSI
            delta = closes.diff()
            gain = delta.clip(lower=0).tail(15).mean()
            loss = -delta.clip(upper=0).tail(15).mean()
            rsi = 100 - 100 / (1 + gain / (loss + 1e-9)) if loss > 0 else 50.0

            # Volume ratio
            vol_today = float(hist["Volume"].iloc[-1])
            vol_20d = float(hist["Volume"].tail(20).mean())
            vol_ratio = vol_today / vol_20d if vol_20d > 0 else 1.0

            pe = getattr(info, "pe_ratio", None)
            try:
                pe = float(pe) if pe else None
            except Exception:
                pe = None

            return StockContext(
                symbol=symbol.upper(),
                current_price=price,
                price_change_pct=round((price - price_1d_ago) / price_1d_ago * 100, 2),
                week_change_pct=round((price - price_5d_ago) / price_5d_ago * 100, 2),
                month_change_pct=round((price - price_30d_ago) / price_30d_ago * 100, 2),
                rsi_14=round(rsi, 1),
                sma_50=sma_50,
                sma_200=sma_200,
                volume_ratio=round(vol_ratio, 2),
                pe_ratio=pe,
                market_regime="bull" if sma_50 and sma_200 and sma_50 > sma_200 else "bear" if sma_50 and sma_200 and sma_50 < sma_200 else "neutral",
            )
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        _log.warning(f"Context build failed for {symbol}: {e}")
        return None


@router.get("/analyze/{symbol}", response_model=ConsensusOut)
async def analyze_single(symbol: str):
    """Run all 8 investor personas on a single symbol."""
    from ...autopilot.investor_personas import analyze_stock, StockContext
    ctx = await _build_context(symbol.upper())
    if ctx is None:
        # Minimal fallback context
        ctx = StockContext(
            symbol=symbol.upper(),
            current_price=0.0,
            price_change_pct=0.0,
            week_change_pct=0.0,
            month_change_pct=0.0,
        )
    result = analyze_stock(ctx)
    return ConsensusOut(
        symbol=result.symbol,
        consensus=result.consensus,
        conviction=result.conviction,
        buy_votes=result.buy_votes,
        sell_votes=result.sell_votes,
        hold_votes=result.hold_votes,
        weighted_score=result.weighted_score,
        personas=[PersonaSignalOut(**p.__dict__) for p in result.personas],
        analysis_summary=result.analysis_summary,
    )


@router.post("/analyze/batch", response_model=List[ConsensusOut])
async def analyze_batch(req: BatchRequest):
    """Run all investor personas on multiple symbols concurrently."""
    from ...autopilot.investor_personas import analyze_stocks_batch, StockContext
    contexts = await asyncio.gather(*[_build_context(s.upper()) for s in req.symbols[:20]])
    valid_contexts = [
        ctx if ctx else StockContext(
            symbol=sym.upper(), current_price=0.0,
            price_change_pct=0.0, week_change_pct=0.0, month_change_pct=0.0
        )
        for ctx, sym in zip(contexts, req.symbols[:20])
    ]
    results = await analyze_stocks_batch(valid_contexts)
    return [
        ConsensusOut(
            symbol=r.symbol, consensus=r.consensus, conviction=r.conviction,
            buy_votes=r.buy_votes, sell_votes=r.sell_votes, hold_votes=r.hold_votes,
            weighted_score=r.weighted_score,
            personas=[PersonaSignalOut(**p.__dict__) for p in r.personas],
            analysis_summary=r.analysis_summary,
        )
        for r in results
    ]
