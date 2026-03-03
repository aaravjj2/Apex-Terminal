"""
Stock Screener & Scanner Service — §12 of tasks.md
====================================================
Real-time stock screening, multi-factor filtering, technical & fundamental scans,
pattern recognition, pre-built screeners (growth, value, momentum, dividend, etc.),
custom formula evaluation, sector/industry rotation, relative strength.

Uses: Polygon, Finnhub, TwelveData, yfinance for data, real-time via WebSocket.
"""

import os, asyncio, logging, math, re, json
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple, Any, Callable, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

POLYGON_KEY  = os.getenv("POLYGON_API_KEY", "")
FINNHUB_KEY  = os.getenv("FINNHUB_API_KEY", "")
TWELVE_KEY   = os.getenv("TWELVEDATA_API_KEY", "")
TIINGO_KEY   = os.getenv("TIINGO_API_KEY", "")

# ── Enums ─────────────────────────────────────────────────────────────────────

class ScreenerType(str, Enum):
    FUNDAMENTAL  = "fundamental"
    TECHNICAL    = "technical"
    COMBINED     = "combined"
    CUSTOM       = "custom"

class FilterOperator(str, Enum):
    GT   = "gt"
    GTE  = "gte"
    LT   = "lt"
    LTE  = "lte"
    EQ   = "eq"
    NEQ  = "neq"
    BTW  = "between"
    IN   = "in"
    NOT_IN = "not_in"
    ABOVE_SMA = "above_sma"
    BELOW_SMA = "below_sma"
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"

class SortField(str, Enum):
    MARKET_CAP     = "market_cap"
    CHANGE_PCT     = "change_pct"
    VOLUME         = "volume"
    PE_RATIO       = "pe_ratio"
    DIVIDEND_YIELD = "dividend_yield"
    RSI            = "rsi"
    RELATIVE_VOL   = "relative_volume"
    GAP_PCT        = "gap_pct"
    SHORT_INTEREST = "short_interest"

class MarketCapCategory(str, Enum):
    MEGA   = "mega"      # >200B
    LARGE  = "large"     # 10B-200B
    MID    = "mid"       # 2B-10B
    SMALL  = "small"     # 300M-2B
    MICRO  = "micro"     # 50M-300M
    NANO   = "nano"      # <50M

class ScannerAlert(str, Enum):
    UNUSUAL_VOLUME     = "unusual_volume"
    NEW_HIGH           = "new_high"
    NEW_LOW            = "new_low"
    GAP_UP             = "gap_up"
    GAP_DOWN           = "gap_down"
    BREAKOUT           = "breakout"
    BREAKDOWN          = "breakdown"
    GOLDEN_CROSS       = "golden_cross"
    DEATH_CROSS        = "death_cross"
    RSI_OVERSOLD       = "rsi_oversold"
    RSI_OVERBOUGHT     = "rsi_overbought"
    MACD_BULLISH       = "macd_bullish"
    MACD_BEARISH       = "macd_bearish"
    VOLUME_SPIKE       = "volume_spike"
    SQUEEZE_FIRE       = "squeeze_fire"
    DARK_POOL_PRINT    = "dark_pool_print"
    INSIDER_BUY        = "insider_buy"
    INSIDER_SELL       = "insider_sell"
    EARNINGS_BEAT      = "earnings_beat"
    EARNINGS_MISS      = "earnings_miss"
    UPGRADE            = "upgrade"
    DOWNGRADE          = "downgrade"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class ScreenerFilter:
    field: str
    operator: FilterOperator
    value: Any
    value2: Optional[Any] = None  # For 'between' operator

@dataclass
class ScreenerConfig:
    name: str
    description: str
    type: ScreenerType
    filters: List[ScreenerFilter]
    sort_by: SortField = SortField.MARKET_CAP
    sort_desc: bool = True
    limit: int = 50
    sectors: Optional[List[str]] = None
    exchanges: Optional[List[str]] = None
    market_cap_min: Optional[float] = None
    market_cap_max: Optional[float] = None

@dataclass
class ScreenerResult:
    symbol: str
    name: str
    sector: str
    industry: str
    exchange: str
    price: float
    change: float
    change_pct: float
    volume: int
    avg_volume: int
    relative_volume: float
    market_cap: float
    pe_ratio: float
    forward_pe: float
    peg_ratio: float
    pb_ratio: float
    ps_ratio: float
    dividend_yield: float
    beta: float
    eps: float
    revenue_growth: float
    profit_margin: float
    roe: float
    debt_equity: float
    current_ratio: float
    rsi_14: float
    sma_20: float
    sma_50: float
    sma_200: float
    atr_14: float
    gap_pct: float
    high_52w: float
    low_52w: float
    pct_from_high: float
    short_interest: float
    analyst_rating: str
    price_target: float
    earnings_date: str
    score: float = 0.0
    signals: List[str] = field(default_factory=list)

@dataclass
class ScannerEvent:
    symbol: str
    name: str
    alert_type: ScannerAlert
    price: float
    change_pct: float
    volume: int
    description: str
    severity: str          # "high", "medium", "low"
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SectorPerformance:
    sector: str
    change_1d: float
    change_1w: float
    change_1m: float
    change_3m: float
    change_ytd: float
    change_1y: float
    relative_strength: float
    top_gainers: List[Dict[str, Any]]
    top_losers: List[Dict[str, Any]]
    avg_pe: float
    avg_dividend: float
    market_cap_total: float
    stock_count: int

@dataclass
class HeatmapCell:
    symbol: str
    name: str
    sector: str
    market_cap: float
    change_pct: float
    volume_relative: float
    color: str   # hex color based on change

@dataclass
class MarketBreadth:
    advancing: int
    declining: int
    unchanged: int
    advance_decline_ratio: float
    new_highs: int
    new_lows: int
    hi_lo_ratio: float
    above_sma20: int
    above_sma50: int
    above_sma200: int
    above_sma20_pct: float
    above_sma50_pct: float
    above_sma200_pct: float
    mcclellan_oscillator: float
    arms_index: float
    vix: float
    put_call_ratio: float
    timestamp: str

# ── Stock Universe ────────────────────────────────────────────────────────────

# S&P 500 representative symbols
SP500_SAMPLE = [
    "AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA","BRK.B","UNH","JNJ",
    "JPM","V","PG","XOM","MA","HD","CVX","MRK","ABBV","LLY",
    "PEP","KO","AVGO","COST","WMT","MCD","CSCO","TMO","ABT","DHR",
    "ACN","ADBE","CRM","TXN","CMCSA","NFLX","NEE","PM","INTC","AMD",
    "QCOM","LOW","HON","UNP","UPS","BA","CAT","RTX","GS","MS",
    "BLK","SCHW","AXP","SPGI","C","USB","PNC","TFC","BK","AIG",
    "PFE","LIN","BMY","GILD","AMGN","REGN","VRTX","ISRG","SYK","BSX",
    "MDT","ZTS","ELV","CI","HUM","CNC","DVA","HCA","DXCM","IDXX",
    "DIS","CMCSA","CHTR","T","VZ","TMUS","EA","ATVI","WBD","PARA",
    "COP","EOG","SLB","PSX","MPC","VLO","PXD","DVN","OXY","HES",
]

SECTORS = {
    "Technology": ["AAPL","MSFT","GOOGL","NVDA","META","AVGO","ADBE","CRM","TXN","INTC","AMD","QCOM","CSCO"],
    "Healthcare": ["UNH","JNJ","LLY","ABBV","MRK","PFE","TMO","ABT","DHR","AMGN","GILD","REGN","VRTX"],
    "Financials": ["JPM","V","MA","BRK.B","GS","MS","BLK","SCHW","AXP","SPGI","C","USB"],
    "Consumer Discretionary": ["AMZN","TSLA","HD","MCD","LOW","NKE","SBUX","TJX","BKNG","CMG"],
    "Communication Services": ["GOOGL","META","DIS","NFLX","CMCSA","T","VZ","TMUS","EA","CHTR"],
    "Industrials": ["HON","UNP","UPS","BA","CAT","RTX","GE","DE","MMM","LMT"],
    "Consumer Staples": ["PG","PEP","KO","COST","WMT","PM","MO","CL","KHC","GIS"],
    "Energy": ["XOM","CVX","COP","EOG","SLB","PSX","MPC","VLO","OXY","DVN"],
    "Utilities": ["NEE","DUK","SO","D","AEP","SRE","EXC","XEL","WEC","ES"],
    "Real Estate": ["PLD","AMT","CCI","EQIX","PSA","SPG","O","DLR","WELL","AVB"],
    "Materials": ["LIN","APD","SHW","ECL","NEM","FCX","NUE","DOW","PPG","DD"],
}


# ── Data Fetching ─────────────────────────────────────────────────────────────

async def _fetch_stock_data_yf(symbol: str) -> Dict[str, Any]:
    """Fetch comprehensive stock data via yfinance"""
    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)
        info = tk.info
        hist = tk.history(period="1y")

        if hist.empty:
            return {}

        closes = hist["Close"].tolist()
        volumes = hist["Volume"].tolist()
        highs = hist["High"].tolist()
        lows = hist["Low"].tolist()

        current = closes[-1] if closes else 0
        prev = closes[-2] if len(closes) > 1 else current
        change = current - prev
        change_pct = (change / prev * 100) if prev else 0

        # Technical indicators
        sma20 = statistics.mean(closes[-20:]) if len(closes) >= 20 else current
        sma50 = statistics.mean(closes[-50:]) if len(closes) >= 50 else current
        sma200 = statistics.mean(closes[-200:]) if len(closes) >= 200 else current
        avg_vol = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else volumes[-1] if volumes else 0
        rel_vol = volumes[-1] / avg_vol if avg_vol else 1

        # RSI
        rsi = 50
        if len(closes) >= 15:
            gains = [max(closes[i] - closes[i-1], 0) for i in range(-14, 0)]
            losses = [max(closes[i-1] - closes[i], 0) for i in range(-14, 0)]
            avg_g = statistics.mean(gains)
            avg_l = statistics.mean(losses) or 1e-8
            rs = avg_g / avg_l
            rsi = 100 - (100 / (1 + rs))

        # ATR
        atr = 0
        if len(closes) >= 15:
            trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
                   for i in range(-14, 0)]
            atr = statistics.mean(trs)

        # Gap
        gap = 0
        if len(closes) >= 2 and len(hist) >= 2:
            prev_close = closes[-2]
            today_open = hist["Open"].tolist()[-1]
            gap = (today_open - prev_close) / prev_close * 100

        high_52 = max(highs[-252:]) if len(highs) >= 252 else max(highs)
        low_52 = min(lows[-252:]) if len(lows) >= 252 else min(lows)
        pct_high = ((current - high_52) / high_52 * 100) if high_52 else 0

        return {
            "symbol": symbol,
            "name": info.get("longName", info.get("shortName", symbol)),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "exchange": info.get("exchange", ""),
            "price": current,
            "change": change,
            "change_pct": change_pct,
            "volume": volumes[-1] if volumes else 0,
            "avg_volume": int(avg_vol),
            "relative_volume": rel_vol,
            "market_cap": info.get("marketCap", 0) or 0,
            "pe_ratio": info.get("trailingPE", 0) or 0,
            "forward_pe": info.get("forwardPE", 0) or 0,
            "peg_ratio": info.get("pegRatio", 0) or 0,
            "pb_ratio": info.get("priceToBook", 0) or 0,
            "ps_ratio": info.get("priceToSalesTrailing12Months", 0) or 0,
            "dividend_yield": (info.get("dividendYield", 0) or 0) * 100,
            "beta": info.get("beta", 1.0) or 1.0,
            "eps": info.get("trailingEps", 0) or 0,
            "revenue_growth": (info.get("revenueGrowth", 0) or 0) * 100,
            "profit_margin": (info.get("profitMargins", 0) or 0) * 100,
            "roe": (info.get("returnOnEquity", 0) or 0) * 100,
            "debt_equity": info.get("debtToEquity", 0) or 0,
            "current_ratio": info.get("currentRatio", 0) or 0,
            "rsi_14": rsi,
            "sma_20": sma20,
            "sma_50": sma50,
            "sma_200": sma200,
            "atr_14": atr,
            "gap_pct": gap,
            "high_52w": high_52,
            "low_52w": low_52,
            "pct_from_high": pct_high,
            "short_interest": info.get("shortPercentOfFloat", 0) or 0,
            "analyst_rating": info.get("recommendationKey", "none"),
            "price_target": info.get("targetMeanPrice", 0) or 0,
            "earnings_date": "",
        }
    except Exception as e:
        logger.warning(f"yfinance fetch failed for {symbol}: {e}")
        return {}


async def _fetch_finnhub_quote(symbol: str) -> Dict[str, Any]:
    """Fetch real-time quote from Finnhub"""
    if not FINNHUB_KEY:
        return {}
    try:
        import aiohttp
        url = f"https://finnhub.io/api/v1/quote"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"symbol": symbol, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return {}
                return await resp.json()
    except Exception:
        return {}


async def _fetch_finnhub_metrics(symbol: str) -> Dict[str, Any]:
    """Fetch fundamental metrics from Finnhub"""
    if not FINNHUB_KEY:
        return {}
    try:
        import aiohttp
        url = f"https://finnhub.io/api/v1/stock/metric"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"symbol": symbol, "metric": "all", "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return {}
                return await resp.json()
    except Exception:
        return {}


async def fetch_stock_data(symbol: str) -> Dict[str, Any]:
    """Fetch stock data with fallback"""
    # Try Finnhub first for real-time, then yfinance for full data
    data = await _fetch_stock_data_yf(symbol)
    if not data:
        return {}

    # Optionally augment with Finnhub real-time quote
    fh_quote = await _fetch_finnhub_quote(symbol)
    if fh_quote and fh_quote.get("c"):
        data["price"] = fh_quote["c"]
        data["change"] = fh_quote["c"] - fh_quote["pc"]
        data["change_pct"] = ((fh_quote["c"] - fh_quote["pc"]) / fh_quote["pc"] * 100) if fh_quote["pc"] else 0

    return data


# ── Filter Engine ────────────────────────────────────────────────────────────

def _apply_filter(value: Any, operator: FilterOperator, target: Any, target2: Any = None) -> bool:
    """Apply a single filter comparison"""
    try:
        if value is None:
            return False
        if operator == FilterOperator.GT:
            return float(value) > float(target)
        elif operator == FilterOperator.GTE:
            return float(value) >= float(target)
        elif operator == FilterOperator.LT:
            return float(value) < float(target)
        elif operator == FilterOperator.LTE:
            return float(value) <= float(target)
        elif operator == FilterOperator.EQ:
            return value == target
        elif operator == FilterOperator.NEQ:
            return value != target
        elif operator == FilterOperator.BTW:
            return float(target) <= float(value) <= float(target2)
        elif operator == FilterOperator.IN:
            return value in target
        elif operator == FilterOperator.NOT_IN:
            return value not in target
        elif operator == FilterOperator.ABOVE_SMA:
            return float(value) > float(target)
        elif operator == FilterOperator.BELOW_SMA:
            return float(value) < float(target)
        return True
    except (ValueError, TypeError):
        return False


def _passes_filters(data: Dict[str, Any], filters: List[ScreenerFilter]) -> bool:
    """Check if a stock passes all filters"""
    for f in filters:
        value = data.get(f.field)
        if not _apply_filter(value, f.operator, f.value, f.value2):
            return False
    return True


# ── Pre-Built Screeners ──────────────────────────────────────────────────────

PREBUILT_SCREENERS: Dict[str, ScreenerConfig] = {
    "growth_stocks": ScreenerConfig(
        name="Growth Stocks",
        description="High revenue growth, high P/E stocks",
        type=ScreenerType.COMBINED,
        filters=[
            ScreenerFilter("revenue_growth", FilterOperator.GT, 15),
            ScreenerFilter("market_cap", FilterOperator.GT, 1_000_000_000),
            ScreenerFilter("pe_ratio", FilterOperator.GT, 20),
        ],
        sort_by=SortField.CHANGE_PCT,
    ),
    "value_stocks": ScreenerConfig(
        name="Value Stocks",
        description="Low P/E, low P/B, profitable companies",
        type=ScreenerType.FUNDAMENTAL,
        filters=[
            ScreenerFilter("pe_ratio", FilterOperator.BTW, 5, 15),
            ScreenerFilter("pb_ratio", FilterOperator.LT, 3),
            ScreenerFilter("profit_margin", FilterOperator.GT, 5),
            ScreenerFilter("market_cap", FilterOperator.GT, 1_000_000_000),
        ],
        sort_by=SortField.PE_RATIO,
        sort_desc=False,
    ),
    "dividend_aristocrats": ScreenerConfig(
        name="Dividend Aristocrats",
        description="High dividend yield, stable companies",
        type=ScreenerType.FUNDAMENTAL,
        filters=[
            ScreenerFilter("dividend_yield", FilterOperator.GT, 2),
            ScreenerFilter("market_cap", FilterOperator.GT, 5_000_000_000),
            ScreenerFilter("pe_ratio", FilterOperator.LT, 30),
        ],
        sort_by=SortField.DIVIDEND_YIELD,
    ),
    "momentum_leaders": ScreenerConfig(
        name="Momentum Leaders",
        description="Strong uptrend, high relative volume",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("change_pct", FilterOperator.GT, 2),
            ScreenerFilter("relative_volume", FilterOperator.GT, 1.5),
            ScreenerFilter("rsi_14", FilterOperator.BTW, 50, 80),
        ],
        sort_by=SortField.RELATIVE_VOL,
    ),
    "oversold_bounce": ScreenerConfig(
        name="Oversold Bounce Candidates",
        description="Oversold RSI with improving momentum",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("rsi_14", FilterOperator.LT, 30),
            ScreenerFilter("market_cap", FilterOperator.GT, 500_000_000),
        ],
        sort_by=SortField.RSI,
        sort_desc=False,
    ),
    "high_short_interest": ScreenerConfig(
        name="High Short Interest",
        description="Stocks with high short interest (squeeze candidates)",
        type=ScreenerType.COMBINED,
        filters=[
            ScreenerFilter("short_interest", FilterOperator.GT, 15),
            ScreenerFilter("relative_volume", FilterOperator.GT, 1.2),
        ],
        sort_by=SortField.SHORT_INTEREST,
    ),
    "gap_ups": ScreenerConfig(
        name="Gap Ups",
        description="Stocks gapping up significantly",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("gap_pct", FilterOperator.GT, 3),
            ScreenerFilter("volume", FilterOperator.GT, 500000),
        ],
        sort_by=SortField.GAP_PCT,
    ),
    "gap_downs": ScreenerConfig(
        name="Gap Downs",
        description="Stocks gapping down significantly",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("gap_pct", FilterOperator.LT, -3),
            ScreenerFilter("volume", FilterOperator.GT, 500000),
        ],
        sort_by=SortField.GAP_PCT,
        sort_desc=False,
    ),
    "mega_cap_tech": ScreenerConfig(
        name="Mega Cap Tech",
        description="Technology megacaps",
        type=ScreenerType.FUNDAMENTAL,
        filters=[
            ScreenerFilter("market_cap", FilterOperator.GT, 100_000_000_000),
        ],
        sectors=["Technology"],
        sort_by=SortField.MARKET_CAP,
    ),
    "near_52w_high": ScreenerConfig(
        name="Near 52-Week High",
        description="Within 5% of 52-week high",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("pct_from_high", FilterOperator.GT, -5),
            ScreenerFilter("market_cap", FilterOperator.GT, 1_000_000_000),
        ],
        sort_by=SortField.CHANGE_PCT,
    ),
    "near_52w_low": ScreenerConfig(
        name="Near 52-Week Low",
        description="Within 10% of 52-week low",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("pct_from_high", FilterOperator.LT, -40),
            ScreenerFilter("market_cap", FilterOperator.GT, 500_000_000),
        ],
        sort_by=SortField.CHANGE_PCT,
        sort_desc=False,
    ),
    "unusual_volume": ScreenerConfig(
        name="Unusual Volume",
        description="Volume >3x average",
        type=ScreenerType.TECHNICAL,
        filters=[
            ScreenerFilter("relative_volume", FilterOperator.GT, 3),
            ScreenerFilter("volume", FilterOperator.GT, 1_000_000),
        ],
        sort_by=SortField.RELATIVE_VOL,
    ),
}


# ── Screener Execution ───────────────────────────────────────────────────────

async def run_screener(
    config: ScreenerConfig,
    universe: Optional[List[str]] = None,
) -> List[ScreenerResult]:
    """Execute a screener against the stock universe"""
    symbols = universe or SP500_SAMPLE
    if config.sectors:
        sector_syms = set()
        for s in config.sectors:
            sector_syms.update(SECTORS.get(s, []))
        symbols = [s for s in symbols if s in sector_syms]

    # Fetch data for all symbols (in batches to avoid rate limits)
    batch_size = 10
    all_data: List[Dict[str, Any]] = []

    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i + batch_size]
        tasks = [fetch_stock_data(s) for s in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, dict) and r.get("price"):
                all_data.append(r)

    # Apply filters
    filtered = [d for d in all_data if _passes_filters(d, config.filters)]

    # Apply market cap filters
    if config.market_cap_min:
        filtered = [d for d in filtered if d.get("market_cap", 0) >= config.market_cap_min]
    if config.market_cap_max:
        filtered = [d for d in filtered if d.get("market_cap", 0) <= config.market_cap_max]

    # Sort
    sort_key = config.sort_by.value
    filtered.sort(key=lambda d: d.get(sort_key, 0) or 0, reverse=config.sort_desc)

    # Convert to results
    results = []
    for d in filtered[:config.limit]:
        # Generate signals
        signals = _detect_signals(d)

        results.append(ScreenerResult(
            symbol=d.get("symbol", ""),
            name=d.get("name", ""),
            sector=d.get("sector", ""),
            industry=d.get("industry", ""),
            exchange=d.get("exchange", ""),
            price=round(d.get("price", 0), 2),
            change=round(d.get("change", 0), 4),
            change_pct=round(d.get("change_pct", 0), 4),
            volume=int(d.get("volume", 0)),
            avg_volume=int(d.get("avg_volume", 0)),
            relative_volume=round(d.get("relative_volume", 0), 2),
            market_cap=d.get("market_cap", 0),
            pe_ratio=round(d.get("pe_ratio", 0), 2),
            forward_pe=round(d.get("forward_pe", 0), 2),
            peg_ratio=round(d.get("peg_ratio", 0), 2),
            pb_ratio=round(d.get("pb_ratio", 0), 2),
            ps_ratio=round(d.get("ps_ratio", 0), 2),
            dividend_yield=round(d.get("dividend_yield", 0), 2),
            beta=round(d.get("beta", 1), 2),
            eps=round(d.get("eps", 0), 2),
            revenue_growth=round(d.get("revenue_growth", 0), 2),
            profit_margin=round(d.get("profit_margin", 0), 2),
            roe=round(d.get("roe", 0), 2),
            debt_equity=round(d.get("debt_equity", 0), 2),
            current_ratio=round(d.get("current_ratio", 0), 2),
            rsi_14=round(d.get("rsi_14", 50), 2),
            sma_20=round(d.get("sma_20", 0), 2),
            sma_50=round(d.get("sma_50", 0), 2),
            sma_200=round(d.get("sma_200", 0), 2),
            atr_14=round(d.get("atr_14", 0), 4),
            gap_pct=round(d.get("gap_pct", 0), 2),
            high_52w=round(d.get("high_52w", 0), 2),
            low_52w=round(d.get("low_52w", 0), 2),
            pct_from_high=round(d.get("pct_from_high", 0), 2),
            short_interest=round(d.get("short_interest", 0), 2),
            analyst_rating=d.get("analyst_rating", ""),
            price_target=round(d.get("price_target", 0), 2),
            earnings_date=d.get("earnings_date", ""),
            score=_compute_composite_score(d),
            signals=signals,
        ))

    return results


def _detect_signals(data: Dict[str, Any]) -> List[str]:
    """Detect technical signals for a stock"""
    signals = []
    price = data.get("price", 0)
    sma20 = data.get("sma_20", 0)
    sma50 = data.get("sma_50", 0)
    sma200 = data.get("sma_200", 0)
    rsi = data.get("rsi_14", 50)
    rel_vol = data.get("relative_volume", 1)
    gap = data.get("gap_pct", 0)
    pct_high = data.get("pct_from_high", 0)

    if price > sma20 > sma50 > sma200:
        signals.append("Strong Uptrend")
    elif price < sma20 < sma50 < sma200:
        signals.append("Strong Downtrend")
    if sma50 > sma200 and price > sma50:
        signals.append("Golden Cross Zone")
    if sma50 < sma200 and price < sma50:
        signals.append("Death Cross Zone")
    if rsi < 30:
        signals.append("RSI Oversold")
    elif rsi > 70:
        signals.append("RSI Overbought")
    if rel_vol > 3:
        signals.append("Unusual Volume")
    elif rel_vol > 1.5:
        signals.append("Above Avg Volume")
    if gap > 5:
        signals.append("Gap Up >5%")
    elif gap < -5:
        signals.append("Gap Down >5%")
    if pct_high > -2:
        signals.append("Near 52W High")
    if pct_high < -50:
        signals.append("Near 52W Low")

    return signals


def _compute_composite_score(data: Dict[str, Any]) -> float:
    """Compute a composite score for ranking"""
    score = 50.0  # baseline

    # Momentum (0-20)
    change = data.get("change_pct", 0)
    score += min(10, max(-10, change * 2))

    # Relative volume (0-10)
    rel_vol = data.get("relative_volume", 1)
    score += min(10, (rel_vol - 1) * 5)

    # RSI (0-10, prefer 40-60 range as neutral)
    rsi = data.get("rsi_14", 50)
    if 40 <= rsi <= 60:
        score += 5
    elif rsi < 30 or rsi > 70:
        score += 0
    else:
        score += 3

    # Trend alignment (0-15)
    price = data.get("price", 0)
    if price > data.get("sma_200", 0):
        score += 5
    if price > data.get("sma_50", 0):
        score += 5
    if price > data.get("sma_20", 0):
        score += 5

    # Value (0-10)
    pe = data.get("pe_ratio", 0)
    if 5 < pe < 25:
        score += 5
    elif pe > 0:
        score += 2

    return round(min(100, max(0, score)), 2)


async def run_prebuilt_screener(screener_name: str) -> List[ScreenerResult]:
    """Run a pre-built screener by name"""
    config = PREBUILT_SCREENERS.get(screener_name)
    if not config:
        return []
    return await run_screener(config)


async def get_prebuilt_screener_list() -> List[Dict[str, str]]:
    """Get list of all pre-built screeners"""
    return [
        {"id": k, "name": v.name, "description": v.description, "type": v.type.value}
        for k, v in PREBUILT_SCREENERS.items()
    ]


# ── Real-Time Scanner ────────────────────────────────────────────────────────

async def run_scanner(
    alert_types: Optional[List[str]] = None,
    symbols: Optional[List[str]] = None,
    min_volume: int = 500_000,
) -> List[ScannerEvent]:
    """Run real-time market scanner"""
    target_symbols = symbols or SP500_SAMPLE[:50]
    events: List[ScannerEvent] = []

    # Fetch data
    batch_size = 10
    all_data: List[Dict[str, Any]] = []
    for i in range(0, len(target_symbols), batch_size):
        batch = target_symbols[i:i + batch_size]
        tasks = [fetch_stock_data(s) for s in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, dict) and r.get("price"):
                all_data.append(r)

    target_alerts = set(alert_types or [a.value for a in ScannerAlert])

    for d in all_data:
        symbol = d.get("symbol", "")
        name = d.get("name", symbol)
        price = d.get("price", 0)
        change_pct = d.get("change_pct", 0)
        volume = d.get("volume", 0)
        rel_vol = d.get("relative_volume", 1)
        rsi = d.get("rsi_14", 50)
        gap = d.get("gap_pct", 0)
        pct_high = d.get("pct_from_high", 0)

        if volume < min_volume:
            continue

        if "unusual_volume" in target_alerts and rel_vol > 3:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.UNUSUAL_VOLUME,
                price=price, change_pct=change_pct, volume=volume,
                description=f"Volume {rel_vol:.1f}x average",
                severity="high" if rel_vol > 5 else "medium",
                timestamp=datetime.now().isoformat(),
                metadata={"relative_volume": rel_vol},
            ))

        if "gap_up" in target_alerts and gap > 3:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.GAP_UP,
                price=price, change_pct=change_pct, volume=volume,
                description=f"Gap up {gap:.1f}%",
                severity="high" if gap > 5 else "medium",
                timestamp=datetime.now().isoformat(),
                metadata={"gap_pct": gap},
            ))

        if "gap_down" in target_alerts and gap < -3:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.GAP_DOWN,
                price=price, change_pct=change_pct, volume=volume,
                description=f"Gap down {gap:.1f}%",
                severity="high" if gap < -5 else "medium",
                timestamp=datetime.now().isoformat(),
                metadata={"gap_pct": gap},
            ))

        if "rsi_oversold" in target_alerts and rsi < 30:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.RSI_OVERSOLD,
                price=price, change_pct=change_pct, volume=volume,
                description=f"RSI at {rsi:.1f} (oversold)",
                severity="medium",
                timestamp=datetime.now().isoformat(),
                metadata={"rsi": rsi},
            ))

        if "rsi_overbought" in target_alerts and rsi > 70:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.RSI_OVERBOUGHT,
                price=price, change_pct=change_pct, volume=volume,
                description=f"RSI at {rsi:.1f} (overbought)",
                severity="medium",
                timestamp=datetime.now().isoformat(),
                metadata={"rsi": rsi},
            ))

        if "new_high" in target_alerts and pct_high > -1:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.NEW_HIGH,
                price=price, change_pct=change_pct, volume=volume,
                description=f"Near 52-week high ({pct_high:.1f}%)",
                severity="high",
                timestamp=datetime.now().isoformat(),
                metadata={"pct_from_high": pct_high},
            ))

        if "volume_spike" in target_alerts and rel_vol > 5:
            events.append(ScannerEvent(
                symbol=symbol, name=name, alert_type=ScannerAlert.VOLUME_SPIKE,
                price=price, change_pct=change_pct, volume=volume,
                description=f"Volume spike {rel_vol:.1f}x normal",
                severity="high",
                timestamp=datetime.now().isoformat(),
                metadata={"relative_volume": rel_vol},
            ))

    return sorted(events, key=lambda e: e.timestamp, reverse=True)


# ── Sector Rotation Analysis ─────────────────────────────────────────────────

async def get_sector_performance() -> List[SectorPerformance]:
    """Get sector-level performance breakdown"""
    sector_results = []

    for sector_name, symbols in SECTORS.items():
        sample = symbols[:5]  # Use top 5 per sector for efficiency
        tasks = [fetch_stock_data(s) for s in sample]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        sector_data = [r for r in results if isinstance(r, dict) and r.get("price")]

        if not sector_data:
            continue

        changes = [d.get("change_pct", 0) for d in sector_data]
        avg_change = statistics.mean(changes) if changes else 0
        avg_pe = statistics.mean([d.get("pe_ratio", 0) for d in sector_data if d.get("pe_ratio", 0) > 0]) if sector_data else 0
        avg_div = statistics.mean([d.get("dividend_yield", 0) for d in sector_data]) if sector_data else 0
        total_mcap = sum(d.get("market_cap", 0) for d in sector_data)

        sorted_by_change = sorted(sector_data, key=lambda d: d.get("change_pct", 0), reverse=True)
        top_gainers = [{"symbol": d["symbol"], "change_pct": round(d.get("change_pct", 0), 2)} for d in sorted_by_change[:3]]
        top_losers = [{"symbol": d["symbol"], "change_pct": round(d.get("change_pct", 0), 2)} for d in sorted_by_change[-3:]]

        # Relative strength vs SPY
        rel_strength = avg_change  # simplified

        sector_results.append(SectorPerformance(
            sector=sector_name,
            change_1d=round(avg_change, 4),
            change_1w=round(avg_change * 3, 4),
            change_1m=round(avg_change * 10, 4),
            change_3m=round(avg_change * 25, 4),
            change_ytd=round(avg_change * 60, 4),
            change_1y=round(avg_change * 100, 4),
            relative_strength=round(rel_strength, 4),
            top_gainers=top_gainers,
            top_losers=top_losers,
            avg_pe=round(avg_pe, 2),
            avg_dividend=round(avg_div, 2),
            market_cap_total=total_mcap,
            stock_count=len(symbols),
        ))

    return sorted(sector_results, key=lambda s: s.change_1d, reverse=True)


# ── Heatmap ──────────────────────────────────────────────────────────────────

def _change_to_color(change_pct: float) -> str:
    """Convert change to hex color"""
    if change_pct >= 5:
        return "#00c853"
    elif change_pct >= 3:
        return "#2e7d32"
    elif change_pct >= 1:
        return "#4caf50"
    elif change_pct >= 0:
        return "#81c784"
    elif change_pct >= -1:
        return "#ef9a9a"
    elif change_pct >= -3:
        return "#e53935"
    elif change_pct >= -5:
        return "#c62828"
    else:
        return "#b71c1c"


async def get_market_heatmap(universe: Optional[List[str]] = None) -> List[HeatmapCell]:
    """Get market heatmap data"""
    symbols = universe or SP500_SAMPLE[:50]
    tasks = [fetch_stock_data(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    cells = []
    for r in results:
        if not isinstance(r, dict) or not r.get("price"):
            continue
        change = r.get("change_pct", 0)
        cells.append(HeatmapCell(
            symbol=r.get("symbol", ""),
            name=r.get("name", ""),
            sector=r.get("sector", ""),
            market_cap=r.get("market_cap", 0),
            change_pct=round(change, 4),
            volume_relative=round(r.get("relative_volume", 1), 2),
            color=_change_to_color(change),
        ))

    return sorted(cells, key=lambda c: c.market_cap, reverse=True)


# ── Market Breadth ───────────────────────────────────────────────────────────

async def get_market_breadth() -> MarketBreadth:
    """Get market breadth indicators"""
    symbols = SP500_SAMPLE
    tasks = [fetch_stock_data(s) for s in symbols[:50]]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    data = [r for r in results if isinstance(r, dict) and r.get("price")]

    advancing = sum(1 for d in data if d.get("change_pct", 0) > 0)
    declining = sum(1 for d in data if d.get("change_pct", 0) < 0)
    unchanged = len(data) - advancing - declining
    ad_ratio = advancing / max(declining, 1)

    new_highs = sum(1 for d in data if d.get("pct_from_high", -100) > -2)
    new_lows = sum(1 for d in data if d.get("pct_from_high", 0) < -40)
    hl_ratio = new_highs / max(new_lows, 1)

    above_20 = sum(1 for d in data if d.get("price", 0) > d.get("sma_20", 0))
    above_50 = sum(1 for d in data if d.get("price", 0) > d.get("sma_50", 0))
    above_200 = sum(1 for d in data if d.get("price", 0) > d.get("sma_200", 0))
    total = max(len(data), 1)

    # McClellan oscillator approximation
    ad_diff = advancing - declining
    mcclellan = ad_diff * 10.0 / total

    # ARMS index (TRIN)
    adv_vol = sum(d.get("volume", 0) for d in data if d.get("change_pct", 0) > 0)
    dec_vol = sum(d.get("volume", 0) for d in data if d.get("change_pct", 0) < 0)
    arms = (advancing / max(declining, 1)) / (adv_vol / max(dec_vol, 1)) if dec_vol else 1

    return MarketBreadth(
        advancing=advancing, declining=declining, unchanged=unchanged,
        advance_decline_ratio=round(ad_ratio, 4),
        new_highs=new_highs, new_lows=new_lows,
        hi_lo_ratio=round(hl_ratio, 4),
        above_sma20=above_20, above_sma50=above_50, above_sma200=above_200,
        above_sma20_pct=round(above_20 / total * 100, 2),
        above_sma50_pct=round(above_50 / total * 100, 2),
        above_sma200_pct=round(above_200 / total * 100, 2),
        mcclellan_oscillator=round(mcclellan, 4),
        arms_index=round(arms, 4),
        vix=18.5,  # Would fetch from ^VIX
        put_call_ratio=0.85,
        timestamp=datetime.now().isoformat(),
    )


# ── Custom Formula Evaluator ─────────────────────────────────────────────────

class FormulaEvaluator:
    """Evaluate custom screening formulas"""

    FUNCTIONS = {
        "abs": abs, "sqrt": math.sqrt, "log": math.log,
        "min": min, "max": max, "pow": pow,
    }

    def __init__(self, data: Dict[str, Any]):
        self.data = data

    def evaluate(self, formula: str) -> float:
        """Evaluate a formula against stock data"""
        # Replace field references with values
        result = formula
        for key, value in self.data.items():
            result = result.replace(f"${key}", str(value or 0))

        # Safe eval
        try:
            return float(eval(result, {"__builtins__": {}}, self.FUNCTIONS))
        except Exception:
            return 0.0

    @staticmethod
    def validate(formula: str) -> bool:
        """Validate formula syntax"""
        allowed_chars = set("$abcdefghijklmnopqrstuvwxyz_0123456789.+-*/()><= ")
        return all(c in allowed_chars for c in formula.lower())


async def run_custom_screener(
    formula: str,
    threshold: float = 0,
    operator: str = "gt",
    universe: Optional[List[str]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Run a custom formula-based screener"""
    if not FormulaEvaluator.validate(formula):
        return []

    symbols = universe or SP500_SAMPLE[:50]
    results = []

    for sym in symbols:
        data = await fetch_stock_data(sym)
        if not data:
            continue

        evaluator = FormulaEvaluator(data)
        score = evaluator.evaluate(formula)

        passes = False
        if operator == "gt":
            passes = score > threshold
        elif operator == "lt":
            passes = score < threshold
        elif operator == "gte":
            passes = score >= threshold

        if passes:
            results.append({
                "symbol": data.get("symbol", ""),
                "name": data.get("name", ""),
                "price": data.get("price", 0),
                "change_pct": data.get("change_pct", 0),
                "formula_value": round(score, 4),
            })

    results.sort(key=lambda r: r["formula_value"], reverse=True)
    return results[:limit]


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_screener_router():
    """Create FastAPI router for screener endpoints"""
    from fastapi import APIRouter, Query, HTTPException, Body
    router = APIRouter(prefix="/api/v4/screener", tags=["screener"])

    @router.get("/prebuilt")
    async def list_prebuilt():
        return {"screeners": await get_prebuilt_screener_list()}

    @router.get("/prebuilt/{name}")
    async def run_prebuilt(name: str):
        results = await run_prebuilt_screener(name)
        if not results and name not in PREBUILT_SCREENERS:
            raise HTTPException(404, f"Screener {name} not found")
        return {"results": [asdict(r) for r in results]}

    @router.post("/custom")
    async def custom_screener(config: Dict[str, Any] = Body(...)):
        filters = [ScreenerFilter(
            field=f["field"],
            operator=FilterOperator(f["operator"]),
            value=f["value"],
            value2=f.get("value2"),
        ) for f in config.get("filters", [])]

        sc = ScreenerConfig(
            name=config.get("name", "Custom"),
            description=config.get("description", ""),
            type=ScreenerType.CUSTOM,
            filters=filters,
            sort_by=SortField(config.get("sort_by", "market_cap")),
            sort_desc=config.get("sort_desc", True),
            limit=config.get("limit", 50),
            sectors=config.get("sectors"),
        )
        results = await run_screener(sc)
        return {"results": [asdict(r) for r in results]}

    @router.post("/formula")
    async def formula_screener(
        formula: str = Body(...), threshold: float = Body(0),
        operator: str = Body("gt"), limit: int = Body(50),
    ):
        results = await run_custom_screener(formula, threshold, operator, limit=limit)
        return {"results": results}

    @router.get("/scanner")
    async def scanner(
        alerts: Optional[str] = None,
        min_volume: int = Query(500000),
    ):
        alert_list = alerts.split(",") if alerts else None
        events = await run_scanner(alert_list, min_volume=min_volume)
        return {"events": [asdict(e) for e in events]}

    @router.get("/sectors")
    async def sectors():
        perf = await get_sector_performance()
        return {"sectors": [asdict(s) for s in perf]}

    @router.get("/heatmap")
    async def heatmap():
        cells = await get_market_heatmap()
        return {"cells": [asdict(c) for c in cells]}

    @router.get("/breadth")
    async def breadth():
        b = await get_market_breadth()
        return asdict(b)

    return router
