"""
market_data_v2.py — Real-Time Market Data REST API (v2)
=======================================================
Endpoints for tick processing, bar aggregation, order book analysis,
tape analytics, market breadth, session analytics, VWAP, and correlation.

Endpoints:
    POST /api/v2/market-data/register              → Register symbol
    POST /api/v2/market-data/tick                   → Process tick(s)
    POST /api/v2/market-data/book                   → Update order book
    GET  /api/v2/market-data/{symbol}/stats          → Real-time stats
    GET  /api/v2/market-data/{symbol}/bars/{tf}      → Aggregated bars
    GET  /api/v2/market-data/{symbol}/current-bar/{tf} → Current (open) bar
    GET  /api/v2/market-data/{symbol}/book-analysis  → Book analysis
    GET  /api/v2/market-data/{symbol}/tape           → Tape analysis
    POST /api/v2/market-data/aggregate               → MTF aggregation
    POST /api/v2/market-data/aggregate-extras         → MTF with extras
    POST /api/v2/market-data/breadth/ad-line         → Advance/Decline line
    POST /api/v2/market-data/breadth/trin            → TRIN (Arms Index)
    POST /api/v2/market-data/breadth/mcclellan       → McClellan oscillator
    POST /api/v2/market-data/breadth/new-highs-lows  → New Highs/Lows
    POST /api/v2/market-data/breadth/pct-above-ma    → % Above MA
    POST /api/v2/market-data/breadth/sector-rotation  → Sector rotation
    POST /api/v2/market-data/session/gap-analysis     → Gap analysis
    POST /api/v2/market-data/vwap                    → Intraday VWAP
    POST /api/v2/market-data/vwap/anchored           → Anchored VWAP
    POST /api/v2/market-data/correlation/matrix      → Correlation matrix
    POST /api/v2/market-data/correlation/rolling     → Rolling correlation
    POST /api/v2/market-data/correlation/beta         → Rolling beta
    POST /api/v2/market-data/correlation/divergence   → Pair divergence
    POST /api/v2/market-data/book-processor/depth     → Depth chart from snapshot
    POST /api/v2/market-data/book-processor/pressure  → Book pressure
    POST /api/v2/market-data/book-processor/walls     → Detect walls
    POST /api/v2/market-data/book-processor/shape     → Book shape analysis
    GET  /api/v2/market-data/capabilities             → List capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

from phase1.services.market_data_engine import (
    MarketDataEngine, BarAggregator, MultiTimeframeAggregator, RealTimeStats,
    OrderBookProcessor, TimeAndSalesProcessor, MarketBreadth, SessionAnalytics,
    IntradayVWAP, CorrelationAnalyzer,
    Tick, Bar, OrderBook, OrderBookLevel, TradeRecord,
    BarType, SessionType, TF_SECONDS,
)


router = APIRouter(prefix="/api/v2/market-data", tags=["Market Data v2"])


# ─── Shared Engine Instance ─────────────────────────────────────────────────
_engine = MarketDataEngine()


# ─── Pydantic Models ────────────────────────────────────────────────────────

class RegisterSymbolRequest(BaseModel):
    symbol: str
    timeframes: List[str] = ["1m", "5m", "15m", "1h"]


class TickModel(BaseModel):
    symbol: str
    price: float
    size: float
    timestamp: float
    side: Optional[str] = None


class TickBatchRequest(BaseModel):
    ticks: List[TickModel]


class OrderBookLevelModel(BaseModel):
    price: float
    size: float
    count: int = 1


class OrderBookRequest(BaseModel):
    symbol: str
    bids: List[OrderBookLevelModel]
    asks: List[OrderBookLevelModel]
    timestamp: float


class OHLCVRow(BaseModel):
    time: float
    open: float
    high: float
    low: float
    close: float
    volume: float


class OHLCVBarsRequest(BaseModel):
    bars: List[OHLCVRow]


class AggregateRequest(BaseModel):
    bars: List[OHLCVRow]
    target_tf: str


class BreadthSeriesRequest(BaseModel):
    advances: List[float]
    declines: List[float]


class BreadthVolumeRequest(BaseModel):
    advances: List[float]
    declines: List[float]
    advance_volume: List[float]
    decline_volume: List[float]


class HighsLowsRequest(BaseModel):
    new_highs: List[float]
    new_lows: List[float]


class ClosesMatrixRequest(BaseModel):
    columns: Dict[str, List[float]]
    ma_period: int = 50


class SectorRotationRequest(BaseModel):
    sectors: Dict[str, List[float]]
    market: List[float]
    lookback: int = 20


class VWAPRequest(BaseModel):
    bars: List[OHLCVRow]
    bands: List[float] = [1.0, 2.0]


class AnchoredVWAPRequest(BaseModel):
    bars: List[OHLCVRow]
    anchor_time: float


class CorrelationMatrixRequest(BaseModel):
    prices: Dict[str, List[float]]
    window: int = 30


class RollingCorrRequest(BaseModel):
    series_a: List[float]
    series_b: List[float]
    window: int = 30


class BetaRequest(BaseModel):
    asset: List[float]
    benchmark: List[float]
    window: int = 60


class PairDivergenceRequest(BaseModel):
    series_a: List[float]
    series_b: List[float]
    window: int = 20


class GapAnalysisRequest(BaseModel):
    bars: List[OHLCVRow]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _bars_to_df(bars: List[OHLCVRow]) -> pd.DataFrame:
    if not bars:
        return pd.DataFrame()
    data = [b.model_dump() for b in bars]
    return pd.DataFrame(data)


def _build_book(req: OrderBookRequest) -> OrderBook:
    return OrderBook(
        symbol=req.symbol,
        bids=[OrderBookLevel(price=l.price, size=l.size, count=l.count) for l in req.bids],
        asks=[OrderBookLevel(price=l.price, size=l.size, count=l.count) for l in req.asks],
        timestamp=req.timestamp,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Core Engine Endpoints (stateful — shared MarketDataEngine)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/register")
def register_symbol(req: RegisterSymbolRequest) -> Dict[str, Any]:
    _engine.register_symbol(req.symbol, timeframes=req.timeframes)
    return {"status": "ok", "symbol": req.symbol, "timeframes": req.timeframes}


@router.post("/tick")
def process_ticks(req: TickBatchRequest) -> Dict[str, Any]:
    count = 0
    for tm in req.ticks:
        tick = Tick(
            symbol=tm.symbol, price=tm.price, size=tm.size,
            timestamp=tm.timestamp, side=tm.side,
        )
        _engine.process_tick(tick)
        count += 1
    return {"status": "ok", "processed": count}


@router.post("/book")
def update_book(req: OrderBookRequest) -> Dict[str, Any]:
    book = _build_book(req)
    _engine.update_book(book)
    return {"status": "ok", "symbol": req.symbol}


@router.get("/{symbol}/stats")
def get_stats(symbol: str) -> Dict[str, Any]:
    stats = _engine.get_stats(symbol)
    if not stats:
        raise HTTPException(404, f"Symbol {symbol} not registered or no data")
    return stats


@router.get("/{symbol}/bars/{tf}")
def get_bars(symbol: str, tf: str) -> Dict[str, Any]:
    bars = _engine.get_bars(symbol, tf)
    return {"symbol": symbol, "timeframe": tf, "count": len(bars), "bars": [b.to_dict() for b in bars]}


@router.get("/{symbol}/current-bar/{tf}")
def get_current_bar(symbol: str, tf: str) -> Dict[str, Any]:
    bar = _engine.get_current_bar(symbol, tf)
    if not bar:
        raise HTTPException(404, f"No current bar for {symbol}/{tf}")
    return {"symbol": symbol, "timeframe": tf, "bar": bar.to_dict()}


@router.get("/{symbol}/book-analysis")
def get_book_analysis(symbol: str) -> Dict[str, Any]:
    analysis = _engine.get_book_analysis(symbol)
    if not analysis:
        raise HTTPException(404, f"No order book data for {symbol}")
    return analysis


@router.get("/{symbol}/tape")
def get_tape_analysis(symbol: str) -> Dict[str, Any]:
    analysis = _engine.get_tape_analysis(symbol)
    if not analysis:
        raise HTTPException(404, f"No tape data for {symbol}")
    return analysis


# ═══════════════════════════════════════════════════════════════════════════════
#  Multi-Timeframe Aggregation (stateless — pass bars in)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/aggregate")
def aggregate(req: AggregateRequest) -> Dict[str, Any]:
    df = _bars_to_df(req.bars)
    if df.empty:
        return {"count": 0, "bars": []}
    try:
        result = MultiTimeframeAggregator.aggregate(df, req.target_tf)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {
        "count": len(result),
        "bars": result.to_dict(orient="records"),
    }


@router.post("/aggregate-extras")
def aggregate_extras(req: AggregateRequest) -> Dict[str, Any]:
    df = _bars_to_df(req.bars)
    if df.empty:
        return {"count": 0, "bars": []}
    try:
        result = MultiTimeframeAggregator.aggregate_with_extras(df, req.target_tf)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {
        "count": len(result),
        "bars": result.to_dict(orient="records"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Market Breadth (stateless)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/breadth/ad-line")
def breadth_ad_line(req: BreadthSeriesRequest) -> Dict[str, Any]:
    adv = pd.Series(req.advances)
    dec = pd.Series(req.declines)
    result = MarketBreadth.advance_decline_line(adv, dec)
    return {"ad_line": result.tolist()}


@router.post("/breadth/ad-ratio")
def breadth_ad_ratio(req: BreadthSeriesRequest) -> Dict[str, Any]:
    adv = pd.Series(req.advances)
    dec = pd.Series(req.declines)
    result = MarketBreadth.advance_decline_ratio(adv, dec)
    return {"ad_ratio": result.tolist()}


@router.post("/breadth/trin")
def breadth_trin(req: BreadthVolumeRequest) -> Dict[str, Any]:
    adv = pd.Series(req.advances)
    dec = pd.Series(req.declines)
    av = pd.Series(req.advance_volume)
    dv = pd.Series(req.decline_volume)
    result = MarketBreadth.trin(adv, dec, av, dv)
    return {"trin": result.tolist()}


@router.post("/breadth/mcclellan")
def breadth_mcclellan(req: BreadthSeriesRequest) -> Dict[str, Any]:
    adv = pd.Series(req.advances)
    dec = pd.Series(req.declines)
    result = MarketBreadth.mcclellan_oscillator(adv, dec)
    return {
        "oscillator": result["oscillator"].tolist(),
        "summation": result["summation"].tolist(),
    }


@router.post("/breadth/new-highs-lows")
def breadth_new_highs_lows(req: HighsLowsRequest) -> Dict[str, Any]:
    result = MarketBreadth.new_highs_lows(pd.Series(req.new_highs), pd.Series(req.new_lows))
    return {
        "highs": result["highs"].tolist(),
        "lows": result["lows"].tolist(),
        "diff": result["diff"].tolist(),
        "cumulative": result["cumulative"].tolist(),
    }


@router.post("/breadth/pct-above-ma")
def breadth_pct_above_ma(req: ClosesMatrixRequest) -> Dict[str, Any]:
    df = pd.DataFrame(req.columns)
    result = MarketBreadth.percent_above_ma(df, ma_period=req.ma_period)
    return {"percent_above_ma": result.tolist()}


@router.post("/breadth/sector-rotation")
def breadth_sector_rotation(req: SectorRotationRequest) -> Dict[str, Any]:
    sectors = pd.DataFrame(req.sectors)
    market = pd.Series(req.market)
    result = MarketBreadth.sector_rotation(sectors, market, lookback=req.lookback)
    return {"rotation": result.to_dict(orient="list")}


# ═══════════════════════════════════════════════════════════════════════════════
#  Session Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/session/classify")
def classify_session(timestamp: float = Query(...)) -> Dict[str, Any]:
    session = SessionAnalytics.classify_session(timestamp)
    return {"timestamp": timestamp, "session": session.value}


@router.post("/session/gap-analysis")
def gap_analysis(req: GapAnalysisRequest) -> Dict[str, Any]:
    df = _bars_to_df(req.bars)
    if df.empty:
        return {"gaps": []}
    result = SessionAnalytics.gap_analysis(df)
    return {"gaps": result.to_dict(orient="records")}


# ═══════════════════════════════════════════════════════════════════════════════
#  VWAP
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/vwap")
def intraday_vwap(req: VWAPRequest) -> Dict[str, Any]:
    df = _bars_to_df(req.bars)
    if df.empty:
        return {"vwap": []}
    result = IntradayVWAP.calculate(df, bands=req.bands)
    return {"count": len(result), "data": result.to_dict(orient="records")}


@router.post("/vwap/anchored")
def anchored_vwap(req: AnchoredVWAPRequest) -> Dict[str, Any]:
    df = _bars_to_df(req.bars)
    if df.empty:
        return {"vwap": []}
    result = IntradayVWAP.anchored_vwap(df, req.anchor_time)
    return {"count": len(result), "vwap": result.tolist()}


# ═══════════════════════════════════════════════════════════════════════════════
#  Correlation
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/correlation/matrix")
def correlation_matrix(req: CorrelationMatrixRequest) -> Dict[str, Any]:
    prices = pd.DataFrame(req.prices)
    result = CorrelationAnalyzer.correlation_matrix(prices, window=req.window)
    return {
        "symbols": list(result.columns),
        "matrix": result.values.tolist(),
    }


@router.post("/correlation/rolling")
def rolling_correlation(req: RollingCorrRequest) -> Dict[str, Any]:
    a = pd.Series(req.series_a)
    b = pd.Series(req.series_b)
    result = CorrelationAnalyzer.rolling_correlation(a, b, window=req.window)
    return {"correlation": result.tolist()}


@router.post("/correlation/beta")
def rolling_beta(req: BetaRequest) -> Dict[str, Any]:
    asset = pd.Series(req.asset)
    bench = pd.Series(req.benchmark)
    result = CorrelationAnalyzer.beta(asset, bench, window=req.window)
    return {"beta": result.tolist()}


@router.post("/correlation/divergence")
def pair_divergence(req: PairDivergenceRequest) -> Dict[str, Any]:
    a = pd.Series(req.series_a)
    b = pd.Series(req.series_b)
    result = CorrelationAnalyzer.pair_divergence(a, b, window=req.window)
    return {
        "spread": result["spread"].tolist(),
        "z_score": result["z_score"].tolist(),
        "signal": result["signal"].tolist(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Order Book Processor (stateless — pass snapshot in)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/book-processor/depth")
def book_depth_chart(req: OrderBookRequest) -> Dict[str, Any]:
    book = _build_book(req)
    return OrderBookProcessor.depth_chart(book)


@router.post("/book-processor/pressure")
def book_pressure(req: OrderBookRequest, depth: int = Query(10)) -> Dict[str, Any]:
    book = _build_book(req)
    return OrderBookProcessor.book_pressure(book, depth=depth)


@router.post("/book-processor/walls")
def book_walls(req: OrderBookRequest, threshold_multiple: float = Query(2.0)) -> Dict[str, Any]:
    book = _build_book(req)
    return OrderBookProcessor.detect_walls(book, threshold_multiple=threshold_multiple)


@router.post("/book-processor/shape")
def book_shape(req: OrderBookRequest) -> Dict[str, Any]:
    book = _build_book(req)
    return OrderBookProcessor.book_shape(book)


@router.post("/book-processor/micro-price")
def book_micro_price(req: OrderBookRequest) -> Dict[str, Any]:
    book = _build_book(req)
    mp = OrderBookProcessor.micro_price(book)
    wmp = OrderBookProcessor.weighted_mid_price(book)
    return {"micro_price": mp, "weighted_mid_price": wmp, "mid_price": book.mid_price, "spread": book.spread}


# ═══════════════════════════════════════════════════════════════════════════════
#  Capabilities
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/capabilities")
def capabilities() -> Dict[str, Any]:
    return {
        "bar_types": [bt.value for bt in BarType],
        "session_types": [st.value for st in SessionType],
        "supported_timeframes": list(TF_SECONDS.keys()),
        "features": [
            "Real-time tick processing with multi-TF bar aggregation",
            "Time, Tick, Volume, Range, Renko bar types",
            "Order book analysis (depth chart, pressure, walls, shape, micro-price)",
            "Time & Sales (block trades, sweep detection, tape speed, price-at-volume)",
            "Market breadth (AD line, AD ratio, TRIN, McClellan, new highs/lows, % above MA, sector rotation)",
            "Session analytics (classify session, gap analysis)",
            "Intraday VWAP with std dev bands",
            "Anchored VWAP",
            "Correlation matrix, rolling correlation, beta, pair divergence",
            "Multi-timeframe aggregation (1m → 5m, 15m, 1h, 4h, 1D, 1W, 1M)",
        ],
        "endpoint_count": 29,
    }
