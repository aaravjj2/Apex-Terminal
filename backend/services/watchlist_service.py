"""
Watchlist & Market Data Service — §17 of tasks.md
===================================================
Watchlist CRUD, real-time quotes, portfolio tracking, market overview,
quote streaming, multi-exchange data, historical data retrieval,
intraday tick data, corporate actions, splits/dividends history.

Uses: Polygon, Finnhub, TwelveData, Tiingo, yfinance for data.
"""

import os, asyncio, logging, json, uuid, hashlib
from datetime import datetime, timedelta, date, timezone
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

POLYGON_KEY  = os.getenv("POLYGON_API_KEY", "")
FINNHUB_KEY  = os.getenv("FINNHUB_API_KEY", "")
TWELVE_KEY   = os.getenv("TWELVEDATA_API_KEY", "")
TIINGO_KEY   = os.getenv("TIINGO_API_KEY", "")
ALPACA_KEY   = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET = os.getenv("ALPACA_SECRET_KEY", "")

# ── Enums ─────────────────────────────────────────────────────────────────────

class AssetClass(str, Enum):
    EQUITY   = "equity"
    ETF      = "etf"
    OPTION   = "option"
    FUTURES  = "futures"
    CRYPTO   = "crypto"
    FOREX    = "forex"
    INDEX    = "index"
    BOND     = "bond"

class Interval(str, Enum):
    TICK   = "tick"
    S1     = "1s"
    M1     = "1min"
    M5     = "5min"
    M15    = "15min"
    M30    = "30min"
    H1     = "1h"
    H4     = "4h"
    D1     = "1d"
    W1     = "1w"
    MN1    = "1mo"

class WatchlistType(str, Enum):
    CUSTOM   = "custom"
    SECTOR   = "sector"
    INDUSTRY = "industry"
    INDEX    = "index"
    PORTFOLIO = "portfolio"

class CorporateActionType(str, Enum):
    DIVIDEND      = "dividend"
    SPLIT          = "split"
    REVERSE_SPLIT  = "reverse_split"
    SPINOFF        = "spinoff"
    MERGER         = "merger"
    RIGHTS_ISSUE   = "rights_issue"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class Quote:
    symbol: str
    name: str
    asset_class: AssetClass
    exchange: str
    price: float
    open: float
    high: float
    low: float
    close: float
    prev_close: float
    change: float
    change_pct: float
    volume: int
    avg_volume: int
    relative_volume: float
    bid: float
    ask: float
    bid_size: int
    ask_size: int
    market_cap: float
    pe_ratio: float
    dividend_yield: float
    high_52w: float
    low_52w: float
    timestamp: str
    market_status: str  # "open", "pre", "post", "closed"

@dataclass
class OHLCV:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int

@dataclass
class WatchlistItem:
    symbol: str
    name: str
    asset_class: AssetClass
    added_at: str
    notes: str = ""
    cost_basis: Optional[float] = None
    shares: Optional[float] = None
    target_price: Optional[float] = None
    stop_price: Optional[float] = None
    alert_enabled: bool = False
    tags: List[str] = field(default_factory=list)

@dataclass
class Watchlist:
    id: str
    name: str
    description: str
    type: WatchlistType
    items: List[WatchlistItem]
    created_at: str
    updated_at: str
    color: str = "#3b82f6"
    icon: str = "star"
    sort_by: str = "symbol"
    columns: List[str] = field(default_factory=lambda: [
        "price", "change", "change_pct", "volume", "market_cap"
    ])

@dataclass
class WatchlistSummary:
    id: str
    name: str
    item_count: int
    avg_change_pct: float
    top_gainer: Dict[str, Any]
    top_loser: Dict[str, Any]
    total_value: float

@dataclass
class CorporateAction:
    symbol: str
    type: CorporateActionType
    date: str
    description: str
    value: Optional[float] = None
    ratio: Optional[str] = None
    ex_date: Optional[str] = None
    record_date: Optional[str] = None
    pay_date: Optional[str] = None

@dataclass
class SymbolSearch:
    symbol: str
    name: str
    type: str
    exchange: str
    currency: str
    country: str

@dataclass
class MarketOverview:
    indices: List[Dict[str, Any]]
    sectors: List[Dict[str, Any]]
    top_gainers: List[Dict[str, Any]]
    top_losers: List[Dict[str, Any]]
    most_active: List[Dict[str, Any]]
    market_status: str
    timestamp: str

@dataclass
class PortfolioPosition:
    symbol: str
    name: str
    shares: float
    cost_basis: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    day_change: float
    day_change_pct: float
    weight: float
    sector: str

@dataclass
class PortfolioSummary:
    total_value: float
    total_cost: float
    total_pnl: float
    total_pnl_pct: float
    day_change: float
    day_change_pct: float
    positions: List[PortfolioPosition]
    sector_allocation: Dict[str, float]
    top_holdings: List[Dict[str, Any]]

# ── Watchlist Storage ─────────────────────────────────────────────────────────

class WatchlistStore:
    """In-memory watchlist storage"""

    def __init__(self):
        self._watchlists: Dict[str, Watchlist] = {}
        self._user_watchlists: Dict[str, List[str]] = defaultdict(list)
        self._init_defaults()

    def _init_defaults(self):
        """Create default watchlists"""
        defaults = [
            ("tech_leaders", "Tech Leaders", "Top technology stocks", WatchlistType.SECTOR,
             ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ADBE", "CRM"]),
            ("sp500_megacap", "S&P 500 Mega Caps", "Largest S&P 500 companies", WatchlistType.INDEX,
             ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
              "JPM", "V", "PG", "XOM", "MA"]),
            ("dividend_kings", "Dividend Kings", "High-quality dividend payers", WatchlistType.CUSTOM,
             ["JNJ", "PG", "KO", "PEP", "MMM", "ABT", "EMR", "GPC", "LOW", "CL"]),
            ("growth_portfolio", "Growth Portfolio", "High-growth companies", WatchlistType.PORTFOLIO,
             ["NVDA", "TSLA", "AMD", "NFLX", "CRM", "SHOP", "SQ", "PLTR", "SNOW", "DDOG"]),
            ("crypto_watchlist", "Crypto Watchlist", "Cryptocurrency tracking", WatchlistType.CUSTOM,
             ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOT-USD"]),
            ("energy_sector", "Energy Sector", "Oil & gas companies", WatchlistType.SECTOR,
             ["XOM", "CVX", "COP", "EOG", "SLB", "PSX", "MPC", "VLO", "OXY", "DVN"]),
        ]

        for wid, name, desc, wtype, symbols in defaults:
            items = [WatchlistItem(
                symbol=s, name=s, asset_class=AssetClass.EQUITY,
                added_at=datetime.now(timezone.utc).isoformat(),
            ) for s in symbols]
            wl = Watchlist(
                id=wid, name=name, description=desc, type=wtype,
                items=items,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self._watchlists[wid] = wl
            self._user_watchlists["default"].append(wid)

    def create(self, watchlist: Watchlist, user_id: str = "default") -> Watchlist:
        watchlist.id = str(uuid.uuid4())[:8]
        watchlist.created_at = datetime.now(timezone.utc).isoformat()
        watchlist.updated_at = watchlist.created_at
        self._watchlists[watchlist.id] = watchlist
        self._user_watchlists[user_id].append(watchlist.id)
        return watchlist

    def get(self, wl_id: str) -> Optional[Watchlist]:
        return self._watchlists.get(wl_id)

    def list(self, user_id: str = "default") -> List[Watchlist]:
        ids = self._user_watchlists.get(user_id, [])
        return [self._watchlists[wid] for wid in ids if wid in self._watchlists]

    def update(self, wl_id: str, **kwargs) -> Optional[Watchlist]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return None
        for k, v in kwargs.items():
            if hasattr(wl, k):
                setattr(wl, k, v)
        wl.updated_at = datetime.now(timezone.utc).isoformat()
        return wl

    def delete(self, wl_id: str) -> bool:
        return bool(self._watchlists.pop(wl_id, None))

    def add_symbol(self, wl_id: str, item: WatchlistItem) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        if any(i.symbol == item.symbol for i in wl.items):
            return False
        wl.items.append(item)
        wl.updated_at = datetime.now(timezone.utc).isoformat()
        return True

    def remove_symbol(self, wl_id: str, symbol: str) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        orig = len(wl.items)
        wl.items = [i for i in wl.items if i.symbol != symbol]
        if len(wl.items) < orig:
            wl.updated_at = datetime.now(timezone.utc).isoformat()
            return True
        return False


_wl_store = WatchlistStore()


# ── Quote Engine ──────────────────────────────────────────────────────────────

async def get_quote(symbol: str) -> Quote:
    """Get real-time quote for a symbol"""
    # Try Polygon → Finnhub → yfinance
    quote = await _polygon_quote(symbol)
    if not quote:
        quote = await _finnhub_quote(symbol)
    if not quote:
        quote = await _yfinance_quote(symbol)
    if not quote:
        raise ValueError(f"No quote data for {symbol}")
    return quote


async def _polygon_quote(symbol: str) -> Optional[Quote]:
    if not POLYGON_KEY:
        return None
    try:
        import aiohttp
        base = "https://api.polygon.io"
        async with aiohttp.ClientSession() as session:
            # Snapshot
            url = f"{base}/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}"
            async with session.get(url, params={"apiKey": POLYGON_KEY}) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                ticker = data.get("ticker", {})
                day = ticker.get("day", {})
                prev = ticker.get("prevDay", {})
                last = ticker.get("lastTrade", {}) or ticker.get("lastQuote", {})

                price = day.get("c", 0) or last.get("p", 0)
                prev_close = prev.get("c", price)
                change = price - prev_close
                change_pct = (change / prev_close * 100) if prev_close else 0

                return Quote(
                    symbol=symbol,
                    name=ticker.get("name", symbol),
                    asset_class=AssetClass.EQUITY,
                    exchange=ticker.get("exchange", ""),
                    price=round(price, 2),
                    open=round(day.get("o", 0), 2),
                    high=round(day.get("h", 0), 2),
                    low=round(day.get("l", 0), 2),
                    close=round(day.get("c", 0), 2),
                    prev_close=round(prev_close, 2),
                    change=round(change, 4),
                    change_pct=round(change_pct, 4),
                    volume=int(day.get("v", 0)),
                    avg_volume=0,
                    relative_volume=0,
                    bid=0, ask=0, bid_size=0, ask_size=0,
                    market_cap=0,
                    pe_ratio=0, dividend_yield=0,
                    high_52w=0, low_52w=0,
                    timestamp=datetime.now().isoformat(),
                    market_status="open",
                )
    except Exception as e:
        logger.warning(f"Polygon quote failed for {symbol}: {e}")
    return None


async def _finnhub_quote(symbol: str) -> Optional[Quote]:
    if not FINNHUB_KEY:
        return None
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = "https://finnhub.io/api/v1/quote"
            async with session.get(url, params={"symbol": symbol, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return None
                q = await resp.json()
                if not q.get("c"):
                    return None

                change = q["c"] - q["pc"]
                change_pct = (change / q["pc"] * 100) if q["pc"] else 0

                return Quote(
                    symbol=symbol, name=symbol,
                    asset_class=AssetClass.EQUITY, exchange="",
                    price=round(q["c"], 2),
                    open=round(q["o"], 2),
                    high=round(q["h"], 2),
                    low=round(q["l"], 2),
                    close=round(q["c"], 2),
                    prev_close=round(q["pc"], 2),
                    change=round(change, 4),
                    change_pct=round(change_pct, 4),
                    volume=0, avg_volume=0, relative_volume=0,
                    bid=0, ask=0, bid_size=0, ask_size=0,
                    market_cap=0, pe_ratio=0, dividend_yield=0,
                    high_52w=0, low_52w=0,
                    timestamp=datetime.now().isoformat(),
                    market_status="open",
                )
    except Exception:
        pass
    return None


async def _yfinance_quote(symbol: str) -> Optional[Quote]:
    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)
        info = tk.info
        hist = tk.history(period="5d")

        if hist.empty:
            return None

        price = hist["Close"].tolist()[-1]
        prev = hist["Close"].tolist()[-2] if len(hist) > 1 else price
        change = price - prev
        pct = (change / prev * 100) if prev else 0

        vols = hist["Volume"].tolist()
        avg_vol = statistics.mean(vols) if vols else 0
        rel_vol = vols[-1] / avg_vol if avg_vol else 1

        # 52W from longer history
        hist_1y = tk.history(period="1y")
        h52 = hist_1y["High"].max() if not hist_1y.empty else price
        l52 = hist_1y["Low"].min() if not hist_1y.empty else price

        return Quote(
            symbol=symbol,
            name=info.get("longName", info.get("shortName", symbol)),
            asset_class=_classify_asset(info),
            exchange=info.get("exchange", ""),
            price=round(price, 2),
            open=round(hist["Open"].tolist()[-1], 2),
            high=round(hist["High"].tolist()[-1], 2),
            low=round(hist["Low"].tolist()[-1], 2),
            close=round(price, 2),
            prev_close=round(prev, 2),
            change=round(change, 4),
            change_pct=round(pct, 4),
            volume=int(vols[-1]) if vols else 0,
            avg_volume=int(avg_vol),
            relative_volume=round(rel_vol, 2),
            bid=info.get("bid", 0) or 0,
            ask=info.get("ask", 0) or 0,
            bid_size=info.get("bidSize", 0) or 0,
            ask_size=info.get("askSize", 0) or 0,
            market_cap=info.get("marketCap", 0) or 0,
            pe_ratio=info.get("trailingPE", 0) or 0,
            dividend_yield=(info.get("dividendYield", 0) or 0) * 100,
            high_52w=round(h52, 2),
            low_52w=round(l52, 2),
            timestamp=datetime.now().isoformat(),
            market_status="open",
        )
    except Exception as e:
        logger.warning(f"yfinance quote failed for {symbol}: {e}")
    return None


def _classify_asset(info: dict) -> AssetClass:
    qtype = info.get("quoteType", "").lower()
    if qtype == "etf":
        return AssetClass.ETF
    elif qtype == "cryptocurrency":
        return AssetClass.CRYPTO
    elif qtype == "index":
        return AssetClass.INDEX
    elif qtype == "future":
        return AssetClass.FUTURES
    return AssetClass.EQUITY


# ── Batch Quotes ──────────────────────────────────────────────────────────────

async def get_batch_quotes(symbols: List[str]) -> List[Quote]:
    """Get quotes for multiple symbols"""
    batch_size = 8
    all_quotes: List[Quote] = []
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i + batch_size]
        tasks = [get_quote(s) for s in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Quote):
                all_quotes.append(r)
    return all_quotes


# ── Historical Data ──────────────────────────────────────────────────────────

async def get_historical(
    symbol: str,
    interval: Interval = Interval.D1,
    period: str = "1y",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[OHLCV]:
    """Get historical OHLCV data"""
    # Map intervals to yfinance
    yf_intervals = {
        Interval.M1: "1m", Interval.M5: "5m", Interval.M15: "15m",
        Interval.M30: "30m", Interval.H1: "1h", Interval.H4: "1h",
        Interval.D1: "1d", Interval.W1: "1wk", Interval.MN1: "1mo",
    }

    yf_interval = yf_intervals.get(interval, "1d")

    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)

        if start_date and end_date:
            hist = tk.history(start=start_date, end=end_date, interval=yf_interval)
        else:
            hist = tk.history(period=period, interval=yf_interval)

        if hist.empty:
            return []

        bars = []
        for idx, row in hist.iterrows():
            bars.append(OHLCV(
                timestamp=idx.strftime("%Y-%m-%dT%H:%M:%S"),
                open=round(row["Open"], 4),
                high=round(row["High"], 4),
                low=round(row["Low"], 4),
                close=round(row["Close"], 4),
                volume=int(row["Volume"]),
            ))
        return bars
    except Exception as e:
        logger.warning(f"Historical data failed for {symbol}: {e}")
        return []


# ── Corporate Actions ────────────────────────────────────────────────────────

async def get_corporate_actions(
    symbol: str,
    action_type: Optional[CorporateActionType] = None,
) -> List[CorporateAction]:
    """Get corporate actions (dividends, splits, etc.)"""
    actions = []

    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)

        # Dividends
        divs = tk.dividends
        if not divs.empty:
            for idx, val in divs.items():
                actions.append(CorporateAction(
                    symbol=symbol,
                    type=CorporateActionType.DIVIDEND,
                    date=idx.strftime("%Y-%m-%d"),
                    description=f"Dividend: ${val:.4f} per share",
                    value=round(val, 4),
                    ex_date=idx.strftime("%Y-%m-%d"),
                ))

        # Splits
        splits = tk.splits
        if not splits.empty:
            for idx, val in splits.items():
                if val != 1.0:
                    ratio = f"{int(val)}:1" if val > 1 else f"1:{int(1/val)}"
                    actions.append(CorporateAction(
                        symbol=symbol,
                        type=CorporateActionType.SPLIT if val > 1 else CorporateActionType.REVERSE_SPLIT,
                        date=idx.strftime("%Y-%m-%d"),
                        description=f"{'Stock Split' if val > 1 else 'Reverse Split'}: {ratio}",
                        ratio=ratio,
                    ))
    except Exception as e:
        logger.warning(f"Corporate actions failed for {symbol}: {e}")

    if action_type:
        actions = [a for a in actions if a.type == action_type]

    return sorted(actions, key=lambda a: a.date, reverse=True)


# ── Symbol Search ────────────────────────────────────────────────────────────

async def search_symbols(query: str, limit: int = 20) -> List[SymbolSearch]:
    """Search for symbols by name or ticker"""
    results = []

    # Finnhub search
    if FINNHUB_KEY:
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://finnhub.io/api/v1/search",
                    params={"q": query, "token": FINNHUB_KEY},
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for r in data.get("result", [])[:limit]:
                            results.append(SymbolSearch(
                                symbol=r.get("symbol", ""),
                                name=r.get("description", ""),
                                type=r.get("type", ""),
                                exchange=r.get("displaySymbol", ""),
                                currency="USD",
                                country="US",
                            ))
        except Exception:
            pass

    if not results:
        # Fallback: local search
        known = [
            ("AAPL", "Apple Inc"), ("MSFT", "Microsoft Corp"), ("GOOGL", "Alphabet Inc"),
            ("AMZN", "Amazon.com Inc"), ("NVDA", "NVIDIA Corp"), ("META", "Meta Platforms"),
            ("TSLA", "Tesla Inc"), ("JPM", "JPMorgan Chase"), ("V", "Visa Inc"),
            ("JNJ", "Johnson & Johnson"), ("UNH", "UnitedHealth Group"),
            ("WMT", "Walmart Inc"), ("PG", "Procter & Gamble"),
        ]
        q = query.upper()
        for sym, name in known:
            if q in sym or q.lower() in name.lower():
                results.append(SymbolSearch(
                    symbol=sym, name=name, type="equity",
                    exchange="NASDAQ/NYSE", currency="USD", country="US",
                ))

    return results[:limit]


# ── Market Overview ──────────────────────────────────────────────────────────

async def get_market_overview() -> MarketOverview:
    """Get broad market overview"""
    indices = [
        ("SPY", "S&P 500"), ("QQQ", "NASDAQ 100"), ("DIA", "Dow Jones"),
        ("IWM", "Russell 2000"), ("VIX", "VIX"),
    ]
    sectors = [
        ("XLK", "Technology"), ("XLF", "Financials"), ("XLE", "Energy"),
        ("XLV", "Healthcare"), ("XLI", "Industrials"), ("XLY", "Consumer Disc"),
        ("XLP", "Consumer Staples"), ("XLU", "Utilities"), ("XLRE", "Real Estate"),
        ("XLB", "Materials"), ("XLC", "Communication"),
    ]

    # Fetch index quotes
    index_data = []
    for sym, name in indices:
        try:
            q = await get_quote(sym)
            index_data.append({
                "symbol": sym, "name": name, "price": q.price,
                "change": q.change, "change_pct": q.change_pct,
            })
        except Exception:
            pass

    # Fetch sector quotes
    sector_data = []
    for sym, name in sectors:
        try:
            q = await get_quote(sym)
            sector_data.append({
                "symbol": sym, "name": name, "price": q.price,
                "change": q.change, "change_pct": q.change_pct,
            })
        except Exception:
            pass
    sector_data.sort(key=lambda s: s.get("change_pct", 0), reverse=True)

    # Active stocks
    active_syms = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "AMD", "GOOGL"]
    active_data = []
    for sym in active_syms:
        try:
            q = await get_quote(sym)
            active_data.append({
                "symbol": sym, "name": q.name, "price": q.price,
                "change_pct": q.change_pct, "volume": q.volume,
            })
        except Exception:
            pass

    gainers = sorted(active_data, key=lambda d: d.get("change_pct", 0), reverse=True)[:5]
    losers = sorted(active_data, key=lambda d: d.get("change_pct", 0))[:5]
    most_active = sorted(active_data, key=lambda d: d.get("volume", 0), reverse=True)[:5]

    return MarketOverview(
        indices=index_data,
        sectors=sector_data,
        top_gainers=gainers,
        top_losers=losers,
        most_active=most_active,
        market_status="open",
        timestamp=datetime.now().isoformat(),
    )


# ── Portfolio Tracking ───────────────────────────────────────────────────────

async def get_portfolio_summary(watchlist_id: str) -> Optional[PortfolioSummary]:
    """Get portfolio summary for a watchlist with positions"""
    wl = _wl_store.get(watchlist_id)
    if not wl:
        return None

    positions = []
    total_value = 0
    total_cost = 0
    day_change_total = 0
    sector_alloc: Dict[str, float] = defaultdict(float)

    for item in wl.items:
        if item.shares and item.cost_basis:
            try:
                q = await get_quote(item.symbol)
                mkt_val = q.price * item.shares
                cost = item.cost_basis * item.shares
                pnl = mkt_val - cost
                pnl_pct = (pnl / cost * 100) if cost else 0
                day_chg = q.change * item.shares

                total_value += mkt_val
                total_cost += cost
                day_change_total += day_chg

                positions.append(PortfolioPosition(
                    symbol=item.symbol, name=q.name,
                    shares=item.shares, cost_basis=item.cost_basis,
                    current_price=q.price, market_value=round(mkt_val, 2),
                    unrealized_pnl=round(pnl, 2), unrealized_pnl_pct=round(pnl_pct, 2),
                    day_change=round(day_chg, 2), day_change_pct=q.change_pct,
                    weight=0, sector="",
                ))
            except Exception:
                pass

    # Compute weights
    for p in positions:
        p.weight = round((p.market_value / total_value * 100) if total_value else 0, 2)

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost else 0
    day_pct = (day_change_total / (total_value - day_change_total) * 100) if total_value else 0

    return PortfolioSummary(
        total_value=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_pct=round(total_pnl_pct, 2),
        day_change=round(day_change_total, 2),
        day_change_pct=round(day_pct, 2),
        positions=sorted(positions, key=lambda p: p.market_value, reverse=True),
        sector_allocation=dict(sector_alloc),
        top_holdings=[{"symbol": p.symbol, "weight": p.weight} for p in sorted(positions, key=lambda p: p.weight, reverse=True)[:5]],
    )


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_watchlist_router():
    from fastapi import APIRouter, Query, HTTPException, Body
    router = APIRouter(prefix="/api/v4/market", tags=["market-data"])

    # ── Quotes ──
    @router.get("/quote/{symbol}")
    async def quote(symbol: str):
        try:
            q = await get_quote(symbol.upper())
            return asdict(q)
        except Exception as e:
            raise HTTPException(400, str(e))

    @router.get("/quotes")
    async def quotes(symbols: str = Query(...)):
        syms = [s.strip().upper() for s in symbols.split(",")]
        qs = await get_batch_quotes(syms)
        return {"quotes": [asdict(q) for q in qs]}

    @router.get("/historical/{symbol}")
    async def historical(
        symbol: str,
        interval: str = Query("1d"),
        period: str = Query("1y"),
        start: Optional[str] = None,
        end: Optional[str] = None,
    ):
        bars = await get_historical(symbol.upper(), Interval(interval), period, start, end)
        return {"symbol": symbol.upper(), "bars": [asdict(b) for b in bars]}

    @router.get("/search")
    async def search(q: str = Query(...), limit: int = Query(20)):
        results = await search_symbols(q, limit)
        return {"results": [asdict(r) for r in results]}

    @router.get("/overview")
    async def overview():
        ov = await get_market_overview()
        return asdict(ov)

    @router.get("/corporate-actions/{symbol}")
    async def corporate_actions(symbol: str, type: Optional[str] = None):
        act_type = CorporateActionType(type) if type else None
        actions = await get_corporate_actions(symbol.upper(), act_type)
        return {"actions": [asdict(a) for a in actions]}

    # ── Watchlists ──
    @router.get("/watchlists")
    async def list_watchlists(user_id: str = Query("default")):
        wls = _wl_store.list(user_id)
        return {"watchlists": [asdict(w) for w in wls]}

    @router.post("/watchlists")
    async def create_watchlist(config: Dict[str, Any] = Body(...)):
        items = [WatchlistItem(
            symbol=s, name=s, asset_class=AssetClass.EQUITY,
            added_at=datetime.now(timezone.utc).isoformat(),
        ) for s in config.get("symbols", [])]

        wl = Watchlist(
            id="", name=config.get("name", "My Watchlist"),
            description=config.get("description", ""),
            type=WatchlistType(config.get("type", "custom")),
            items=items,
            created_at="", updated_at="",
            color=config.get("color", "#3b82f6"),
        )
        created = _wl_store.create(wl, config.get("user_id", "default"))
        return asdict(created)

    @router.get("/watchlists/{wl_id}")
    async def get_watchlist(wl_id: str):
        wl = _wl_store.get(wl_id)
        if not wl:
            raise HTTPException(404)
        return asdict(wl)

    @router.get("/watchlists/{wl_id}/quotes")
    async def watchlist_quotes(wl_id: str):
        wl = _wl_store.get(wl_id)
        if not wl:
            raise HTTPException(404)
        symbols = [i.symbol for i in wl.items]
        qs = await get_batch_quotes(symbols)
        return {"watchlist": wl.name, "quotes": [asdict(q) for q in qs]}

    @router.put("/watchlists/{wl_id}")
    async def update_watchlist(wl_id: str, updates: Dict[str, Any] = Body(...)):
        wl = _wl_store.update(wl_id, **updates)
        if not wl:
            raise HTTPException(404)
        return asdict(wl)

    @router.delete("/watchlists/{wl_id}")
    async def delete_watchlist(wl_id: str):
        if not _wl_store.delete(wl_id):
            raise HTTPException(404)
        return {"deleted": True}

    @router.post("/watchlists/{wl_id}/symbols")
    async def add_to_watchlist(wl_id: str, config: Dict[str, Any] = Body(...)):
        item = WatchlistItem(
            symbol=config["symbol"].upper(),
            name=config.get("name", config["symbol"]),
            asset_class=AssetClass(config.get("asset_class", "equity")),
            added_at=datetime.now(timezone.utc).isoformat(),
            notes=config.get("notes", ""),
            cost_basis=config.get("cost_basis"),
            shares=config.get("shares"),
        )
        if not _wl_store.add_symbol(wl_id, item):
            raise HTTPException(400, "Symbol already in watchlist or watchlist not found")
        return {"added": True}

    @router.delete("/watchlists/{wl_id}/symbols/{symbol}")
    async def remove_from_watchlist(wl_id: str, symbol: str):
        if not _wl_store.remove_symbol(wl_id, symbol.upper()):
            raise HTTPException(404)
        return {"removed": True}

    @router.get("/watchlists/{wl_id}/portfolio")
    async def portfolio(wl_id: str):
        summary = await get_portfolio_summary(wl_id)
        if not summary:
            raise HTTPException(404)
        return asdict(summary)

    return router
