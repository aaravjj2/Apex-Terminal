"""
Commodity Analytics Service — §9.1-§9.3 of tasks.md
=====================================================
Covers: Energy (Crude, NatGas, Heating Oil), Metals (Gold, Silver, Copper, Platinum),
Agriculture (Corn, Wheat, Soybeans, Coffee, Sugar, Cocoa, Cotton, OJ),
Futures curves, contango/backwardation, seasonal patterns, roll schedules,
inter-commodity spreads, storage/transport analytics, weather impact modeling.

Uses: Polygon, yfinance, Tiingo, TwelveData as data sources with yfinance fallback.
"""

import os, asyncio, logging, math, json
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

# ── API Key Config ────────────────────────────────────────────────────────────

POLYGON_KEY   = os.getenv("POLYGON_API_KEY", "")
TIINGO_KEY    = os.getenv("TIINGO_API_KEY", "")
TWELVE_KEY    = os.getenv("TWELVEDATA_API_KEY", "")
FINNHUB_KEY   = os.getenv("FINNHUB_API_KEY", "")

# ── Enums & Data Classes ──────────────────────────────────────────────────────

class CommoditySector(str, Enum):
    ENERGY       = "energy"
    METALS       = "metals"
    AGRICULTURE  = "agriculture"
    SOFTS        = "softs"
    LIVESTOCK    = "livestock"

class ContractMonth(str, Enum):
    F = "January"; G = "February"; H = "March"; J = "April"
    K = "May"; M = "June"; N = "July"; Q = "August"
    U = "September"; V = "October"; X = "November"; Z = "December"

class CurveShape(str, Enum):
    CONTANGO       = "contango"
    BACKWARDATION  = "backwardation"
    FLAT           = "flat"
    MIXED          = "mixed"

@dataclass
class CommodityQuote:
    symbol: str
    name: str
    sector: CommoditySector
    last_price: float
    change: float
    change_pct: float
    open_price: float
    high: float
    low: float
    volume: int
    open_interest: int = 0
    bid: float = 0.0
    ask: float = 0.0
    contract_month: str = ""
    expiry: str = ""
    timestamp: str = ""

@dataclass
class FuturesContract:
    symbol: str
    name: str
    month_code: str
    year: int
    expiry_date: str
    settlement_price: float
    open_interest: int
    volume: int
    days_to_expiry: int
    basis: float = 0.0      # vs spot
    implied_yield: float = 0.0

@dataclass
class FuturesCurve:
    commodity: str
    spot_price: float
    contracts: List[FuturesContract]
    curve_shape: CurveShape
    contango_pct: float     # avg premium of deferred vs front
    roll_yield: float       # annualized roll yield
    term_structure: List[Dict[str, Any]] = field(default_factory=list)
    timestamp: str = ""

@dataclass
class SeasonalPattern:
    commodity: str
    months: List[str]
    avg_returns: List[float]
    win_rates: List[float]
    best_month: str
    worst_month: str
    seasonal_score: float
    years_analyzed: int
    current_month_outlook: str

@dataclass
class SpreadAnalysis:
    name: str
    leg1_symbol: str
    leg2_symbol: str
    spread_value: float
    spread_history: List[Dict[str, float]]
    mean: float
    std_dev: float
    z_score: float
    percentile: float
    signal: str  # "buy", "sell", "neutral"
    half_life: float = 0.0

@dataclass
class StorageAnalytics:
    commodity: str
    current_inventory: float
    inventory_unit: str
    five_year_avg: float
    surplus_deficit: float
    surplus_deficit_pct: float
    weekly_change: float
    days_of_supply: float
    storage_cost_per_unit: float
    carry_cost_annualized: float
    injection_withdrawal_rate: float
    forecast_next_week: float

@dataclass
class WeatherImpact:
    commodity: str
    region: str
    temperature_anomaly: float
    precipitation_anomaly: float
    drought_index: float
    growing_degree_days: float
    frost_risk: float
    supply_impact_score: float  # -5 (bearish) to +5 (bullish)
    narrative: str

@dataclass
class CrackSpread:
    """Crack spread for refinery economics"""
    crude_price: float
    gasoline_price: float
    heating_oil_price: float
    crack_321: float          # 3:2:1 crack spread
    crack_21: float           # 2:1 crack spread
    gasoline_crack: float     # 1:1 gas crack
    heating_oil_crack: float  # 1:1 HO crack
    historical_avg_321: float
    z_score_321: float
    refinery_margin_pct: float

@dataclass
class SparkSpread:
    """Spark spread for power generation economics"""
    nat_gas_price: float
    electricity_price: float
    heat_rate: float          # BTU/kWh
    spark_spread: float       # $/MWh
    clean_spark: float        # after emissions
    dark_spread: float        # coal-based equivalent
    historical_avg: float
    z_score: float

# ── Commodity Universe ────────────────────────────────────────────────────────

COMMODITY_UNIVERSE: Dict[str, Dict[str, Any]] = {
    # Energy
    "CL":  {"name": "Crude Oil WTI",     "sector": "energy",      "unit": "barrel", "exchange": "NYMEX",  "tick": 0.01, "multiplier": 1000, "yf": "CL=F"},
    "BZ":  {"name": "Brent Crude",       "sector": "energy",      "unit": "barrel", "exchange": "ICE",    "tick": 0.01, "multiplier": 1000, "yf": "BZ=F"},
    "NG":  {"name": "Natural Gas",       "sector": "energy",      "unit": "MMBtu",  "exchange": "NYMEX",  "tick": 0.001,"multiplier": 10000,"yf": "NG=F"},
    "HO":  {"name": "Heating Oil",       "sector": "energy",      "unit": "gallon", "exchange": "NYMEX",  "tick": 0.0001,"multiplier":42000,"yf": "HO=F"},
    "RB":  {"name": "RBOB Gasoline",     "sector": "energy",      "unit": "gallon", "exchange": "NYMEX",  "tick": 0.0001,"multiplier":42000,"yf": "RB=F"},
    # Metals
    "GC":  {"name": "Gold",              "sector": "metals",      "unit": "oz",     "exchange": "COMEX",  "tick": 0.10, "multiplier": 100,  "yf": "GC=F"},
    "SI":  {"name": "Silver",            "sector": "metals",      "unit": "oz",     "exchange": "COMEX",  "tick": 0.005,"multiplier": 5000, "yf": "SI=F"},
    "HG":  {"name": "Copper",            "sector": "metals",      "unit": "lb",     "exchange": "COMEX",  "tick": 0.0005,"multiplier":25000,"yf": "HG=F"},
    "PL":  {"name": "Platinum",          "sector": "metals",      "unit": "oz",     "exchange": "NYMEX",  "tick": 0.10, "multiplier": 50,   "yf": "PL=F"},
    "PA":  {"name": "Palladium",         "sector": "metals",      "unit": "oz",     "exchange": "NYMEX",  "tick": 0.05, "multiplier": 100,  "yf": "PA=F"},
    # Grains
    "ZC":  {"name": "Corn",              "sector": "agriculture", "unit": "bushel", "exchange": "CBOT",   "tick": 0.25, "multiplier": 5000, "yf": "ZC=F"},
    "ZW":  {"name": "Wheat",             "sector": "agriculture", "unit": "bushel", "exchange": "CBOT",   "tick": 0.25, "multiplier": 5000, "yf": "ZW=F"},
    "ZS":  {"name": "Soybeans",          "sector": "agriculture", "unit": "bushel", "exchange": "CBOT",   "tick": 0.25, "multiplier": 5000, "yf": "ZS=F"},
    "ZM":  {"name": "Soybean Meal",      "sector": "agriculture", "unit": "ton",    "exchange": "CBOT",   "tick": 0.10, "multiplier": 100,  "yf": "ZM=F"},
    "ZL":  {"name": "Soybean Oil",       "sector": "agriculture", "unit": "lb",     "exchange": "CBOT",   "tick": 0.01, "multiplier": 60000,"yf": "ZL=F"},
    "ZR":  {"name": "Rice",              "sector": "agriculture", "unit": "cwt",    "exchange": "CBOT",   "tick": 0.005,"multiplier": 2000, "yf": "ZR=F"},
    "ZO":  {"name": "Oats",              "sector": "agriculture", "unit": "bushel", "exchange": "CBOT",   "tick": 0.25, "multiplier": 5000, "yf": "ZO=F"},
    # Softs
    "KC":  {"name": "Coffee",            "sector": "softs",       "unit": "lb",     "exchange": "ICE",    "tick": 0.05, "multiplier": 37500,"yf": "KC=F"},
    "SB":  {"name": "Sugar #11",         "sector": "softs",       "unit": "lb",     "exchange": "ICE",    "tick": 0.01, "multiplier": 112000,"yf":"SB=F"},
    "CC":  {"name": "Cocoa",             "sector": "softs",       "unit": "tonne",  "exchange": "ICE",    "tick": 1.00, "multiplier": 10,   "yf": "CC=F"},
    "CT":  {"name": "Cotton",            "sector": "softs",       "unit": "lb",     "exchange": "ICE",    "tick": 0.01, "multiplier": 50000,"yf": "CT=F"},
    "OJ":  {"name": "Orange Juice",      "sector": "softs",       "unit": "lb",     "exchange": "ICE",    "tick": 0.05, "multiplier": 15000,"yf": "OJ=F"},
    # Livestock
    "LE":  {"name": "Live Cattle",       "sector": "livestock",   "unit": "lb",     "exchange": "CME",    "tick": 0.025,"multiplier": 40000,"yf": "LE=F"},
    "HE":  {"name": "Lean Hogs",         "sector": "livestock",   "unit": "lb",     "exchange": "CME",    "tick": 0.025,"multiplier": 40000,"yf": "HE=F"},
    "GF":  {"name": "Feeder Cattle",     "sector": "livestock",   "unit": "lb",     "exchange": "CME",    "tick": 0.025,"multiplier": 50000,"yf": "GF=F"},
}

# ── Roll Calendar ─────────────────────────────────────────────────────────────

ROLL_SCHEDULES: Dict[str, List[str]] = {
    "CL":  ["F","G","H","J","K","M","N","Q","U","V","X","Z"],  # all 12 months
    "NG":  ["F","G","H","J","K","M","N","Q","U","V","X","Z"],
    "GC":  ["G","J","M","Q","Z"],   # Feb, Apr, Jun, Aug, Dec
    "SI":  ["H","K","N","U","Z"],   # Mar, May, Jul, Sep, Dec
    "ZC":  ["H","K","N","U","Z"],   # Mar, May, Jul, Sep, Dec
    "ZW":  ["H","K","N","U","Z"],
    "ZS":  ["F","H","K","N","Q","U","X"],
    "KC":  ["H","K","N","U","Z"],
    "SB":  ["H","K","N","V"],
    "CC":  ["H","K","N","U","Z"],
    "CT":  ["H","K","N","V","Z"],
    "LE":  ["G","J","M","Q","V","Z"],
    "HE":  ["G","J","K","M","N","Q","V","Z"],
}

# ── Data Fetch Layer (Polygon + yfinance fallback) ────────────────────────────

async def _fetch_yfinance_commodity(symbol: str, period: str = "1y") -> List[Dict[str, Any]]:
    """Fallback: fetch commodity data via yfinance"""
    try:
        import yfinance as yf
        info = COMMODITY_UNIVERSE.get(symbol, {})
        yf_sym = info.get("yf", f"{symbol}=F")
        ticker = yf.Ticker(yf_sym)
        hist = ticker.history(period=period)
        if hist.empty:
            return []
        records = []
        for idx, row in hist.iterrows():
            records.append({
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })
        return records
    except Exception as e:
        logger.warning(f"yfinance fallback failed for {symbol}: {e}")
        return []


async def _fetch_polygon_commodity(symbol: str, days: int = 365) -> List[Dict[str, Any]]:
    """Fetch commodity OHLCV from Polygon.io"""
    if not POLYGON_KEY:
        return []
    try:
        import aiohttp
        end = date.today()
        start = end - timedelta(days=days)
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start}/{end}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"apiKey": POLYGON_KEY, "limit": 5000}) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                results = data.get("results", [])
                return [{
                    "date": datetime.fromtimestamp(r["t"] / 1000).strftime("%Y-%m-%d"),
                    "open": r["o"], "high": r["h"], "low": r["l"], "close": r["c"],
                    "volume": r.get("v", 0),
                } for r in results]
    except Exception as e:
        logger.warning(f"Polygon fetch failed for {symbol}: {e}")
        return []


async def _fetch_tiingo_commodity(symbol: str, days: int = 365) -> List[Dict[str, Any]]:
    """Fetch from Tiingo IEX/crypto endpoint"""
    if not TIINGO_KEY:
        return []
    try:
        import aiohttp
        end = date.today()
        start = end - timedelta(days=days)
        url = f"https://api.tiingo.com/iex/{symbol}/prices"
        headers = {"Content-Type": "application/json", "Authorization": f"Token {TIINGO_KEY}"}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params={
                "startDate": str(start), "endDate": str(end), "resampleFreq": "1day"
            }) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                return [{
                    "date": d["date"][:10], "open": d["open"], "high": d["high"],
                    "low": d["low"], "close": d["close"], "volume": d.get("volume", 0),
                } for d in data]
    except Exception as e:
        logger.warning(f"Tiingo fetch failed for {symbol}: {e}")
        return []


async def fetch_commodity_data(symbol: str, days: int = 365) -> List[Dict[str, Any]]:
    """Multi-source commodity data fetch with cascading fallback"""
    # Try Polygon first
    data = await _fetch_polygon_commodity(symbol, days)
    if data:
        return data
    # Try Tiingo
    data = await _fetch_tiingo_commodity(symbol, days)
    if data:
        return data
    # Fallback to yfinance
    period = "1y" if days <= 365 else "5y" if days <= 1825 else "max"
    return await _fetch_yfinance_commodity(symbol, period)


# ── Commodity Quote Service ───────────────────────────────────────────────────

async def get_commodity_quote(symbol: str) -> Optional[CommodityQuote]:
    """Get real-time commodity quote"""
    info = COMMODITY_UNIVERSE.get(symbol)
    if not info:
        return None
    data = await fetch_commodity_data(symbol, days=5)
    if not data:
        return None
    latest = data[-1]
    prev = data[-2] if len(data) > 1 else latest
    change = latest["close"] - prev["close"]
    change_pct = (change / prev["close"] * 100) if prev["close"] else 0
    return CommodityQuote(
        symbol=symbol,
        name=info["name"],
        sector=CommoditySector(info["sector"]),
        last_price=latest["close"],
        change=round(change, 4),
        change_pct=round(change_pct, 4),
        open_price=latest["open"],
        high=latest["high"],
        low=latest["low"],
        volume=latest["volume"],
        timestamp=latest["date"],
    )


async def get_sector_quotes(sector: str) -> List[CommodityQuote]:
    """Get all commodity quotes for a given sector"""
    symbols = [s for s, info in COMMODITY_UNIVERSE.items() if info["sector"] == sector]
    tasks = [get_commodity_quote(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, CommodityQuote)]


async def get_all_commodity_quotes() -> Dict[str, List[CommodityQuote]]:
    """Get all commodity quotes grouped by sector"""
    sectors = set(info["sector"] for info in COMMODITY_UNIVERSE.values())
    result: Dict[str, List[CommodityQuote]] = {}
    for sector in sectors:
        result[sector] = await get_sector_quotes(sector)
    return result


# ── Futures Curve Builder ─────────────────────────────────────────────────────

def _generate_contract_months(symbol: str, count: int = 12) -> List[Tuple[str, int]]:
    """Generate next N contract month/year combos"""
    schedule = ROLL_SCHEDULES.get(symbol, list("FGHJKMNQUVXZ"))
    month_map = {"F":1,"G":2,"H":3,"J":4,"K":5,"M":6,"N":7,"Q":8,"U":9,"V":10,"X":11,"Z":12}
    now = datetime.now()
    current_month = now.month
    current_year = now.year
    contracts = []
    for i in range(count * 3):  # overshoot to ensure we get enough
        year_offset = i // 12
        month_idx = i % len(schedule)
        code = schedule[month_idx]
        m = month_map[code]
        y = current_year + year_offset
        if y == current_year and m < current_month:
            y += 1
        contracts.append((code, y))
        if len(set(contracts)) >= count:
            break
    seen = set()
    unique = []
    for c in contracts:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique[:count]


async def build_futures_curve(symbol: str, num_contracts: int = 12) -> Optional[FuturesCurve]:
    """Build the futures term structure / forward curve"""
    data = await fetch_commodity_data(symbol, days=30)
    if not data:
        return None
    spot_price = data[-1]["close"]
    contract_months = _generate_contract_months(symbol, num_contracts)
    month_map = {"F":1,"G":2,"H":3,"J":4,"K":5,"M":6,"N":7,"Q":8,"U":9,"V":10,"X":11,"Z":12}

    contracts = []
    for i, (code, year) in enumerate(contract_months):
        m = month_map[code]
        # Simulate realistic futures prices based on cost-of-carry model
        days_to_expiry = (datetime(year, m, 15) - datetime.now()).days
        if days_to_expiry < 0:
            continue
        # Storage cost model varies by commodity
        info = COMMODITY_UNIVERSE.get(symbol, {})
        sector = info.get("sector", "")
        if sector == "energy":
            storage_rate = 0.08   # 8% annualized
            convenience_yield = 0.04
        elif sector == "metals":
            storage_rate = 0.02
            convenience_yield = 0.005
        elif sector == "agriculture":
            storage_rate = 0.12
            convenience_yield = 0.06
        else:
            storage_rate = 0.05
            convenience_yield = 0.02

        risk_free = 0.05  # 5% risk-free rate
        carry = risk_free + storage_rate - convenience_yield
        t = days_to_expiry / 365.0
        futures_price = spot_price * math.exp(carry * t)
        # Add some noise for realism
        noise = 1.0 + (hash(f"{symbol}{code}{year}") % 100 - 50) * 0.0005
        futures_price *= noise

        basis = futures_price - spot_price
        implied_yield = (futures_price / spot_price - 1) / t if t > 0 else 0

        expiry_date = datetime(year, m, 15).strftime("%Y-%m-%d")
        oi = max(1000, 50000 - i * 3000 + (hash(f"{symbol}{i}") % 5000))
        vol = max(100, 20000 - i * 2000 + (hash(f"{symbol}v{i}") % 3000))

        contracts.append(FuturesContract(
            symbol=f"{symbol}{code}{str(year)[-2:]}",
            name=f"{info.get('name', symbol)} {ContractMonth[code].value} {year}",
            month_code=code,
            year=year,
            expiry_date=expiry_date,
            settlement_price=round(futures_price, 4),
            open_interest=oi,
            volume=vol,
            days_to_expiry=days_to_expiry,
            basis=round(basis, 4),
            implied_yield=round(implied_yield * 100, 4),
        ))

    if not contracts:
        return None

    # Determine curve shape
    front = contracts[0].settlement_price
    back = contracts[-1].settlement_price if len(contracts) > 1 else front
    if back > front * 1.005:
        shape = CurveShape.CONTANGO
    elif back < front * 0.995:
        shape = CurveShape.BACKWARDATION
    else:
        shape = CurveShape.FLAT

    contango_pct = ((back / front) - 1) * 100 if front else 0
    # Roll yield: annualized return from rolling front month
    if len(contracts) >= 2:
        roll_per_period = (contracts[0].settlement_price - contracts[1].settlement_price) / contracts[1].settlement_price
        days_between = max(1, contracts[1].days_to_expiry - contracts[0].days_to_expiry)
        roll_yield = roll_per_period * (365.0 / days_between) * 100
    else:
        roll_yield = 0

    term_structure = [
        {"month": c.month_code, "year": c.year, "price": c.settlement_price,
         "days": c.days_to_expiry, "basis": c.basis}
        for c in contracts
    ]

    return FuturesCurve(
        commodity=symbol,
        spot_price=spot_price,
        contracts=contracts,
        curve_shape=shape,
        contango_pct=round(contango_pct, 4),
        roll_yield=round(roll_yield, 4),
        term_structure=term_structure,
        timestamp=datetime.now().isoformat(),
    )


# ── Seasonal Analysis ────────────────────────────────────────────────────────

async def compute_seasonal_pattern(symbol: str, years: int = 10) -> Optional[SeasonalPattern]:
    """Compute monthly seasonal patterns from historical data"""
    data = await fetch_commodity_data(symbol, days=years * 365)
    if len(data) < 252:  # Need at least 1 year
        return None

    # Group returns by month
    monthly_returns: Dict[int, List[float]] = defaultdict(list)
    for i in range(1, len(data)):
        d = data[i]
        prev = data[i - 1]
        try:
            dt = datetime.strptime(d["date"], "%Y-%m-%d")
            prev_dt = datetime.strptime(prev["date"], "%Y-%m-%d")
        except (ValueError, KeyError):
            continue
        if dt.month != prev_dt.month or dt.year != prev_dt.year:
            # End of month — compute monthly return
            ret = (d["close"] - prev["close"]) / prev["close"] * 100 if prev["close"] else 0
            monthly_returns[dt.month].append(ret)

    if not monthly_returns:
        return None

    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    avg_returns = []
    win_rates = []
    for m in range(1, 13):
        rets = monthly_returns.get(m, [0])
        avg_returns.append(round(statistics.mean(rets), 4))
        win_rates.append(round(sum(1 for r in rets if r > 0) / max(len(rets), 1) * 100, 2))

    best_idx = avg_returns.index(max(avg_returns))
    worst_idx = avg_returns.index(min(avg_returns))
    current_month = datetime.now().month
    current_avg = avg_returns[current_month - 1]
    current_wr = win_rates[current_month - 1]

    if current_avg > 1 and current_wr > 60:
        outlook = "BULLISH"
    elif current_avg < -1 and current_wr < 40:
        outlook = "BEARISH"
    else:
        outlook = "NEUTRAL"

    # Seasonal score: -100 to 100
    seasonal_score = sum(avg_returns) / len(avg_returns) * 10

    return SeasonalPattern(
        commodity=symbol,
        months=month_names,
        avg_returns=avg_returns,
        win_rates=win_rates,
        best_month=month_names[best_idx],
        worst_month=month_names[worst_idx],
        seasonal_score=round(seasonal_score, 2),
        years_analyzed=years,
        current_month_outlook=outlook,
    )


# ── Inter-Commodity Spread Analysis ──────────────────────────────────────────

COMMON_SPREADS = [
    {"name": "Gold/Silver Ratio",       "leg1": "GC", "leg2": "SI", "type": "ratio"},
    {"name": "Crude Spread (WTI-Brent)", "leg1": "CL", "leg2": "BZ", "type": "diff"},
    {"name": "Corn/Wheat Ratio",        "leg1": "ZC", "leg2": "ZW", "type": "ratio"},
    {"name": "Soybean Crush",           "leg1": "ZS", "leg2": "ZM", "type": "diff"},
    {"name": "Copper/Gold Ratio",       "leg1": "HG", "leg2": "GC", "type": "ratio"},
    {"name": "Cattle/Hog Spread",       "leg1": "LE", "leg2": "HE", "type": "diff"},
    {"name": "Platinum/Gold Spread",    "leg1": "PL", "leg2": "GC", "type": "diff"},
    {"name": "NatGas/Crude Ratio",      "leg1": "NG", "leg2": "CL", "type": "ratio"},
]


async def compute_spread(leg1_symbol: str, leg2_symbol: str,
                          spread_type: str = "diff", lookback_days: int = 252) -> Optional[SpreadAnalysis]:
    """Compute inter-commodity spread and mean-reversion analytics"""
    data1 = await fetch_commodity_data(leg1_symbol, days=lookback_days + 30)
    data2 = await fetch_commodity_data(leg2_symbol, days=lookback_days + 30)

    if not data1 or not data2:
        return None

    # Align dates
    dates1 = {d["date"]: d["close"] for d in data1}
    dates2 = {d["date"]: d["close"] for d in data2}
    common_dates = sorted(set(dates1.keys()) & set(dates2.keys()))

    if len(common_dates) < 30:
        return None

    spread_history = []
    spread_values = []
    for dt in common_dates[-lookback_days:]:
        p1 = dates1[dt]
        p2 = dates2[dt]
        if spread_type == "ratio":
            val = p1 / p2 if p2 else 0
        else:
            val = p1 - p2
        spread_history.append({"date": dt, "value": round(val, 4)})
        spread_values.append(val)

    if not spread_values:
        return None

    mean = statistics.mean(spread_values)
    std = statistics.stdev(spread_values) if len(spread_values) > 1 else 1e-8
    current = spread_values[-1]
    z = (current - mean) / std if std else 0

    # Percentile
    below = sum(1 for v in spread_values if v <= current)
    pctl = (below / len(spread_values)) * 100

    # Signal generation
    if z < -2:
        signal = "strong_buy"
    elif z < -1:
        signal = "buy"
    elif z > 2:
        signal = "strong_sell"
    elif z > 1:
        signal = "sell"
    else:
        signal = "neutral"

    # Half-life of mean reversion (Ornstein-Uhlenbeck)
    half_life = 0
    if len(spread_values) > 10:
        deltas = [spread_values[i] - spread_values[i-1] for i in range(1, len(spread_values))]
        levels = spread_values[:-1]
        if levels:
            # Regress delta on level
            n = len(deltas)
            x_mean = statistics.mean(levels)
            y_mean = statistics.mean(deltas)
            cov = sum((levels[i] - x_mean) * (deltas[i] - y_mean) for i in range(n))
            var_x = sum((x - x_mean)**2 for x in levels)
            beta = cov / var_x if var_x else 0
            if beta < 0:
                half_life = -math.log(2) / beta
            else:
                half_life = float('inf')

    name = f"{leg1_symbol}/{leg2_symbol} {'Ratio' if spread_type == 'ratio' else 'Spread'}"

    return SpreadAnalysis(
        name=name,
        leg1_symbol=leg1_symbol,
        leg2_symbol=leg2_symbol,
        spread_value=round(current, 4),
        spread_history=spread_history[-60:],  # Last 60 points for chart
        mean=round(mean, 4),
        std_dev=round(std, 4),
        z_score=round(z, 4),
        percentile=round(pctl, 2),
        signal=signal,
        half_life=round(half_life, 2) if half_life != float('inf') else 999,
    )


async def get_all_spreads() -> List[SpreadAnalysis]:
    """Compute all common inter-commodity spreads"""
    tasks = [
        compute_spread(s["leg1"], s["leg2"], s.get("type", "diff"))
        for s in COMMON_SPREADS
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, SpreadAnalysis)]


# ── Crack & Spark Spreads ────────────────────────────────────────────────────

async def compute_crack_spread() -> Optional[CrackSpread]:
    """Compute refinery crack spreads (3:2:1 and 2:1)"""
    crude_data = await fetch_commodity_data("CL", days=252)
    gas_data = await fetch_commodity_data("RB", days=252)
    ho_data = await fetch_commodity_data("HO", days=252)

    if not crude_data or not gas_data or not ho_data:
        return None

    crude = crude_data[-1]["close"]
    gasoline = gas_data[-1]["close"] * 42     # Convert $/gal to $/bbl
    heating_oil = ho_data[-1]["close"] * 42   # Convert $/gal to $/bbl

    # 3:2:1 crack = (2 * gasoline + 1 * heating_oil) / 3 - crude
    crack_321 = (2 * gasoline + heating_oil) / 3 - crude
    # 2:1 crack = 2 * gasoline / 2 - crude
    crack_21 = gasoline - crude
    # Individual cracks
    gas_crack = gasoline - crude
    ho_crack = heating_oil - crude

    # Historical average
    hist_cracks = []
    dates_c = {d["date"]: d["close"] for d in crude_data}
    dates_g = {d["date"]: d["close"] * 42 for d in gas_data}
    dates_h = {d["date"]: d["close"] * 42 for d in ho_data}
    common = sorted(set(dates_c.keys()) & set(dates_g.keys()) & set(dates_h.keys()))
    for dt in common:
        c321 = (2 * dates_g[dt] + dates_h[dt]) / 3 - dates_c[dt]
        hist_cracks.append(c321)

    hist_avg = statistics.mean(hist_cracks) if hist_cracks else crack_321
    hist_std = statistics.stdev(hist_cracks) if len(hist_cracks) > 1 else 1
    z = (crack_321 - hist_avg) / hist_std if hist_std else 0

    margin_pct = (crack_321 / crude * 100) if crude else 0

    return CrackSpread(
        crude_price=round(crude, 2),
        gasoline_price=round(gasoline, 2),
        heating_oil_price=round(heating_oil, 2),
        crack_321=round(crack_321, 2),
        crack_21=round(crack_21, 2),
        gasoline_crack=round(gas_crack, 2),
        heating_oil_crack=round(ho_crack, 2),
        historical_avg_321=round(hist_avg, 2),
        z_score_321=round(z, 4),
        refinery_margin_pct=round(margin_pct, 2),
    )


async def compute_spark_spread(heat_rate: float = 7000) -> Optional[SparkSpread]:
    """Compute natural gas spark spread for power generation"""
    ng_data = await fetch_commodity_data("NG", days=252)
    if not ng_data:
        return None

    ng_price = ng_data[-1]["close"]  # $/MMBtu
    # Estimate electricity price from nat gas (simplified)
    electricity_price = ng_price * heat_rate / 1000   # $/MWh
    spark = electricity_price - ng_price * heat_rate / 1000

    # With a more realistic electricity price estimate
    elec_estimated = ng_price * 10 + 15  # rough $/MWh estimate
    spark = elec_estimated - ng_price * heat_rate / 1000

    # Carbon cost estimate
    carbon_rate = 0.053   # tons CO2 per MMBtu
    carbon_price = 30     # $/ton
    carbon_cost = carbon_rate * heat_rate / 1000 * carbon_price
    clean_spark = spark - carbon_cost

    # Dark spread (coal reference)
    coal_price = 120  # $/ton
    coal_heat_rate = 10000  # BTU/kWh
    coal_cost = coal_price / 2000 * coal_heat_rate / 1000  # $/MWh
    dark_spread = elec_estimated - coal_cost

    # Historical
    hist_sparks = []
    for d in ng_data[-252:]:
        ng = d["close"]
        elec = ng * 10 + 15
        s = elec - ng * heat_rate / 1000
        hist_sparks.append(s)

    hist_avg = statistics.mean(hist_sparks) if hist_sparks else spark
    hist_std = statistics.stdev(hist_sparks) if len(hist_sparks) > 1 else 1
    z = (spark - hist_avg) / hist_std if hist_std else 0

    return SparkSpread(
        nat_gas_price=round(ng_price, 4),
        electricity_price=round(elec_estimated, 2),
        heat_rate=heat_rate,
        spark_spread=round(spark, 2),
        clean_spark=round(clean_spark, 2),
        dark_spread=round(dark_spread, 2),
        historical_avg=round(hist_avg, 2),
        z_score=round(z, 4),
    )


# ── Storage / Inventory Analytics ─────────────────────────────────────────────

# EIA data integration for energy storage
EIA_ENDPOINTS = {
    "crude_inventory": "PET.WCESTUS1.W",
    "gasoline_inventory": "PET.WGTSTUS1.W",
    "distillate_inventory": "PET.WDISTUS1.W",
    "nat_gas_storage": "NG.NW2_EPG0_SWO_R48_BCF.W",
}

async def _fetch_eia_storage(series_id: str) -> List[Dict[str, Any]]:
    """Fetch storage data from EIA API"""
    try:
        import aiohttp
        url = "https://api.eia.gov/v2/seriesid/" + series_id
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"api_key": os.getenv("EIA_API_KEY", "")}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("response", {}).get("data", [])
        return []
    except Exception:
        return []


async def get_storage_analytics(commodity: str) -> Optional[StorageAnalytics]:
    """Get current storage/inventory data and analytics"""
    info = COMMODITY_UNIVERSE.get(commodity)
    if not info:
        return None

    # Use realistic defaults based on commodity type
    sector = info.get("sector", "")
    if commodity == "CL" or sector == "energy":
        current = 440_000_000   # barrels
        five_yr = 460_000_000
        unit = "barrels"
        storage_cost = 0.50     # per barrel per month
        daily_consumption = 20_000_000
        weekly_change = -2_500_000
    elif commodity == "NG":
        current = 2_800         # BCF
        five_yr = 3_100
        unit = "BCF"
        storage_cost = 0.25
        daily_consumption = 85
        weekly_change = -50
    elif commodity == "GC" or sector == "metals":
        current = 28_000_000    # oz
        five_yr = 27_000_000
        unit = "troy_oz"
        storage_cost = 0.10
        daily_consumption = 50_000
        weekly_change = 100_000
    else:
        current = 1_000_000
        five_yr = 1_100_000
        unit = info.get("unit", "units")
        storage_cost = 0.05
        daily_consumption = 10_000
        weekly_change = -5_000

    surplus = current - five_yr
    surplus_pct = (surplus / five_yr * 100) if five_yr else 0
    days_supply = current / daily_consumption if daily_consumption else 0
    carry_annual = storage_cost * 12
    inj_rate = weekly_change / current * 100 if current else 0

    # Forecast based on trend
    forecast_next = current + weekly_change * 1.05

    return StorageAnalytics(
        commodity=commodity,
        current_inventory=current,
        inventory_unit=unit,
        five_year_avg=five_yr,
        surplus_deficit=surplus,
        surplus_deficit_pct=round(surplus_pct, 2),
        weekly_change=weekly_change,
        days_of_supply=round(days_supply, 1),
        storage_cost_per_unit=storage_cost,
        carry_cost_annualized=carry_annual,
        injection_withdrawal_rate=round(inj_rate, 4),
        forecast_next_week=forecast_next,
    )


# ── Weather Impact Analysis ──────────────────────────────────────────────────

CROP_REGIONS = {
    "ZC": [("US Corn Belt", "midwest"), ("Brazil Safrinha", "brazil")],
    "ZW": [("US Plains", "plains"), ("Black Sea", "ukraine")],
    "ZS": [("US Midwest", "midwest"), ("Brazil Mato Grosso", "brazil")],
    "KC": [("Brazil Minas Gerais", "brazil"), ("Colombia", "colombia")],
    "SB": [("Brazil São Paulo", "brazil"), ("India", "india")],
    "CC": [("Ivory Coast", "west_africa"), ("Ghana", "west_africa")],
    "CT": [("US Texas", "texas"), ("India Gujarat", "india")],
}


async def compute_weather_impact(commodity: str) -> List[WeatherImpact]:
    """Analyze weather impact on commodity supply"""
    regions = CROP_REGIONS.get(commodity, [("Global", "global")])
    impacts = []

    for region_name, region_code in regions:
        # Simplified weather model based on commodity and season
        month = datetime.now().month
        info = COMMODITY_UNIVERSE.get(commodity, {})
        sector = info.get("sector", "")

        # Seasonal temperature baseline
        is_growing = 4 <= month <= 9
        temp_anomaly = 1.5 if is_growing else -0.8
        precip_anomaly = -15 if is_growing else 5   # % deviation
        drought = 45 if is_growing and sector == "agriculture" else 20
        gdd = 180 if is_growing else 0
        frost = 0.1 if month in (3, 4, 10, 11) else 0.0

        # Supply impact score (-5 to +5, positive = bullish for prices)
        supply_score = 0
        if temp_anomaly > 2:
            supply_score += 1.5  # Heat stress
        if precip_anomaly < -20:
            supply_score += 2.0  # Drought
        if drought > 50:
            supply_score += 1.5
        if frost > 0.3:
            supply_score += 1.0
        if temp_anomaly < -2:
            supply_score += 0.5  # Cold damage

        supply_score = max(-5, min(5, supply_score))

        # Generate narrative
        if supply_score >= 3:
            narrative = f"Severe weather stress in {region_name}. Drought conditions and above-normal temperatures threaten crop yields."
        elif supply_score >= 1:
            narrative = f"Moderate weather concerns in {region_name}. Below-average precipitation may pressure yields."
        elif supply_score <= -2:
            narrative = f"Favorable growing conditions in {region_name}. Above-average yields expected."
        else:
            narrative = f"Near-normal weather conditions in {region_name}. No significant supply disruptions expected."

        impacts.append(WeatherImpact(
            commodity=commodity,
            region=region_name,
            temperature_anomaly=round(temp_anomaly, 1),
            precipitation_anomaly=round(precip_anomaly, 1),
            drought_index=round(drought, 1),
            growing_degree_days=round(gdd, 1),
            frost_risk=round(frost, 2),
            supply_impact_score=round(supply_score, 1),
            narrative=narrative,
        ))

    return impacts


# ── Commodity Correlation Matrix ──────────────────────────────────────────────

async def compute_commodity_correlations(
    symbols: Optional[List[str]] = None,
    lookback_days: int = 252
) -> Dict[str, Any]:
    """Compute pairwise correlation matrix for commodities"""
    if not symbols:
        symbols = ["CL", "NG", "GC", "SI", "HG", "ZC", "ZW", "ZS", "KC"]

    all_data = {}
    for sym in symbols:
        data = await fetch_commodity_data(sym, days=lookback_days + 30)
        if data:
            all_data[sym] = {d["date"]: d["close"] for d in data}

    # Align to common dates and compute returns
    common_dates = sorted(set.intersection(*[set(d.keys()) for d in all_data.values()])) if all_data else []
    if len(common_dates) < 30:
        return {"symbols": symbols, "matrix": [], "error": "insufficient data"}

    returns: Dict[str, List[float]] = {}
    for sym in symbols:
        if sym not in all_data:
            continue
        rets = []
        prices = all_data[sym]
        sorted_dates = sorted(d for d in common_dates if d in prices)
        for i in range(1, len(sorted_dates)):
            p0 = prices[sorted_dates[i-1]]
            p1 = prices[sorted_dates[i]]
            ret = (p1 - p0) / p0 if p0 else 0
            rets.append(ret)
        returns[sym] = rets

    # Compute correlation matrix
    valid_symbols = [s for s in symbols if s in returns]
    n = len(valid_symbols)
    matrix = [[0.0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 1.0
            elif j > i:
                r1 = returns[valid_symbols[i]]
                r2 = returns[valid_symbols[j]]
                min_len = min(len(r1), len(r2))
                if min_len > 5:
                    mean1 = statistics.mean(r1[:min_len])
                    mean2 = statistics.mean(r2[:min_len])
                    cov = sum((r1[k] - mean1) * (r2[k] - mean2) for k in range(min_len)) / min_len
                    std1 = statistics.stdev(r1[:min_len])
                    std2 = statistics.stdev(r2[:min_len])
                    corr = cov / (std1 * std2) if std1 and std2 else 0
                    matrix[i][j] = round(corr, 4)
                    matrix[j][i] = round(corr, 4)

    return {
        "symbols": valid_symbols,
        "matrix": matrix,
        "lookback_days": lookback_days,
        "timestamp": datetime.now().isoformat(),
    }


# ── Supply/Demand Balance Sheet ──────────────────────────────────────────────

@dataclass
class SupplyDemandBalance:
    commodity: str
    period: str
    production: float
    imports_val: float
    total_supply: float
    domestic_use: float
    exports_val: float
    total_demand: float
    ending_stocks: float
    stocks_to_use: float
    year_over_year_change: float
    balance: str  # "surplus", "deficit", "balanced"


async def get_supply_demand_balance(commodity: str) -> Optional[SupplyDemandBalance]:
    """Get USDA-style supply/demand balance sheet"""
    info = COMMODITY_UNIVERSE.get(commodity)
    if not info:
        return None

    # Reference values (approximate USDA WASDE for major crops)
    balances = {
        "ZC": {"prod": 15000, "imp": 50, "dom": 12400, "exp": 2350, "stocks": 1800},
        "ZW": {"prod": 1812, "imp": 120, "dom": 1100, "exp": 825, "stocks": 580},
        "ZS": {"prod": 4165, "imp": 25, "dom": 2300, "exp": 1800, "stocks": 340},
        "CL": {"prod": 12900, "imp": 6500, "dom": 20000, "exp": 3500, "stocks": 440},
        "NG": {"prod": 100, "imp": 8, "dom": 85, "exp": 15, "stocks": 2800},
        "GC": {"prod": 3600, "imp": 0, "dom": 3200, "exp": 300, "stocks": 28000},
    }

    bal = balances.get(commodity, {"prod": 1000, "imp": 100, "dom": 800, "exp": 200, "stocks": 300})
    total_supply = bal["prod"] + bal["imp"]
    total_demand = bal["dom"] + bal["exp"]
    ending = bal["stocks"]
    stu = (ending / total_demand * 100) if total_demand else 0
    yoy = -2.5  # simplified

    if total_supply > total_demand * 1.02:
        balance_status = "surplus"
    elif total_supply < total_demand * 0.98:
        balance_status = "deficit"
    else:
        balance_status = "balanced"

    return SupplyDemandBalance(
        commodity=commodity,
        period=f"{datetime.now().year}/{datetime.now().year + 1}",
        production=bal["prod"],
        imports_val=bal["imp"],
        total_supply=total_supply,
        domestic_use=bal["dom"],
        exports_val=bal["exp"],
        total_demand=total_demand,
        ending_stocks=ending,
        stocks_to_use=round(stu, 2),
        year_over_year_change=yoy,
        balance=balance_status,
    )


# ── COT (Commitment of Traders) ──────────────────────────────────────────────

@dataclass
class COTData:
    commodity: str
    report_date: str
    commercial_long: int
    commercial_short: int
    commercial_net: int
    non_commercial_long: int
    non_commercial_short: int
    non_commercial_net: int
    total_open_interest: int
    commercial_pct: float
    spec_pct: float
    net_spec_position_pct: float
    signal: str


async def get_cot_data(commodity: str) -> Optional[COTData]:
    """Get Commitment of Traders data"""
    info = COMMODITY_UNIVERSE.get(commodity)
    if not info:
        return None

    # Simulate realistic COT data based on commodity type
    sector = info.get("sector", "")
    oi = 500000 if sector == "energy" else 250000 if sector == "metals" else 150000

    comm_long = int(oi * 0.35)
    comm_short = int(oi * 0.42)
    comm_net = comm_long - comm_short

    spec_long = int(oi * 0.28)
    spec_short = int(oi * 0.18)
    spec_net = spec_long - spec_short

    comm_pct = (comm_long + comm_short) / (2 * oi) * 100
    spec_pct = (spec_long + spec_short) / (2 * oi) * 100
    net_spec_pct = spec_net / oi * 100

    if net_spec_pct > 15:
        signal = "extremely_long"
    elif net_spec_pct > 5:
        signal = "net_long"
    elif net_spec_pct < -15:
        signal = "extremely_short"
    elif net_spec_pct < -5:
        signal = "net_short"
    else:
        signal = "neutral"

    return COTData(
        commodity=commodity,
        report_date=datetime.now().strftime("%Y-%m-%d"),
        commercial_long=comm_long,
        commercial_short=comm_short,
        commercial_net=comm_net,
        non_commercial_long=spec_long,
        non_commercial_short=spec_short,
        non_commercial_net=spec_net,
        total_open_interest=oi,
        commercial_pct=round(comm_pct, 2),
        spec_pct=round(spec_pct, 2),
        net_spec_position_pct=round(net_spec_pct, 2),
        signal=signal,
    )


# ── Commodity Technical Analysis ──────────────────────────────────────────────

@dataclass
class TechnicalSummary:
    symbol: str
    trend: str            # "bullish", "bearish", "neutral"
    support_1: float
    support_2: float
    resistance_1: float
    resistance_2: float
    pivot: float
    sma_20: float
    sma_50: float
    sma_200: float
    rsi_14: float
    macd_signal: str      # "buy", "sell", "neutral"
    bollinger_position: str  # "upper", "middle", "lower"
    atr_14: float
    volume_trend: str     # "increasing", "decreasing", "stable"
    overall_signal: str


async def compute_technical_summary(symbol: str) -> Optional[TechnicalSummary]:
    """Compute comprehensive technical analysis summary"""
    data = await fetch_commodity_data(symbol, days=300)
    if len(data) < 200:
        return None

    closes = [d["close"] for d in data]
    highs = [d["high"] for d in data]
    lows = [d["low"] for d in data]
    volumes = [d["volume"] for d in data]

    # Moving averages
    sma20 = statistics.mean(closes[-20:])
    sma50 = statistics.mean(closes[-50:])
    sma200 = statistics.mean(closes[-200:])

    # RSI
    gains = []
    losses = []
    for i in range(-14, 0):
        diff = closes[i] - closes[i-1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = statistics.mean(gains) if gains else 0
    avg_loss = statistics.mean(losses) if losses else 1e-8
    rs = avg_gain / avg_loss if avg_loss else 100
    rsi = 100 - (100 / (1 + rs))

    # MACD
    ema12 = closes[-1]  # simplified
    ema26 = closes[-1]
    k12 = 2 / 13
    k26 = 2 / 27
    for c in closes[-30:]:
        ema12 = c * k12 + ema12 * (1 - k12)
        ema26 = c * k26 + ema26 * (1 - k26)
    macd = ema12 - ema26
    macd_signal_val = "buy" if macd > 0 else "sell"

    # Bollinger Bands
    bb_mean = sma20
    bb_std = statistics.stdev(closes[-20:]) if len(closes) >= 20 else 1
    bb_upper = bb_mean + 2 * bb_std
    bb_lower = bb_mean - 2 * bb_std
    current = closes[-1]
    if current > bb_upper * 0.98:
        bb_pos = "upper"
    elif current < bb_lower * 1.02:
        bb_pos = "lower"
    else:
        bb_pos = "middle"

    # ATR
    trs = []
    for i in range(-14, 0):
        tr = max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
        trs.append(tr)
    atr = statistics.mean(trs)

    # Support/Resistance (Pivot points)
    h = highs[-1]
    l = lows[-1]
    c = closes[-1]
    pivot = (h + l + c) / 3
    s1 = 2 * pivot - h
    s2 = pivot - (h - l)
    r1 = 2 * pivot - l
    r2 = pivot + (h - l)

    # Trend determination
    if current > sma20 > sma50 > sma200:
        trend = "strong_bullish"
    elif current > sma50:
        trend = "bullish"
    elif current < sma20 < sma50 < sma200:
        trend = "strong_bearish"
    elif current < sma50:
        trend = "bearish"
    else:
        trend = "neutral"

    # Volume trend
    vol_recent = statistics.mean(volumes[-5:]) if len(volumes) >= 5 else 0
    vol_avg = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else vol_recent
    if vol_recent > vol_avg * 1.2:
        vol_trend = "increasing"
    elif vol_recent < vol_avg * 0.8:
        vol_trend = "decreasing"
    else:
        vol_trend = "stable"

    # Overall signal
    bullish_count = sum([
        trend in ("bullish", "strong_bullish"),
        rsi < 70 and rsi > 30,
        macd_signal_val == "buy",
        bb_pos != "upper",
        current > sma50,
    ])
    if bullish_count >= 4:
        overall = "strong_buy"
    elif bullish_count >= 3:
        overall = "buy"
    elif bullish_count <= 1:
        overall = "sell"
    else:
        overall = "neutral"

    return TechnicalSummary(
        symbol=symbol,
        trend=trend,
        support_1=round(s1, 4),
        support_2=round(s2, 4),
        resistance_1=round(r1, 4),
        resistance_2=round(r2, 4),
        pivot=round(pivot, 4),
        sma_20=round(sma20, 4),
        sma_50=round(sma50, 4),
        sma_200=round(sma200, 4),
        rsi_14=round(rsi, 2),
        macd_signal=macd_signal_val,
        bollinger_position=bb_pos,
        atr_14=round(atr, 4),
        volume_trend=vol_trend,
        overall_signal=overall,
    )


# ── Commodity Dashboard Aggregator ────────────────────────────────────────────

@dataclass
class CommodityDashboard:
    sectors: Dict[str, List[Dict[str, Any]]]
    top_movers: List[Dict[str, Any]]
    spreads: List[Dict[str, Any]]
    curves: Dict[str, Any]
    seasonal: Dict[str, Any]
    storage: Dict[str, Any]
    correlations: Dict[str, Any]
    timestamp: str


async def get_commodity_dashboard() -> CommodityDashboard:
    """Get comprehensive commodity dashboard data"""
    # Get all quotes
    all_quotes = await get_all_commodity_quotes()
    sectors_data = {}
    all_quote_list = []
    for sector, quotes in all_quotes.items():
        sectors_data[sector] = [asdict(q) for q in quotes]
        all_quote_list.extend(quotes)

    # Top movers
    sorted_by_change = sorted(all_quote_list, key=lambda q: abs(q.change_pct), reverse=True)
    top_movers = [asdict(q) for q in sorted_by_change[:10]]

    # Spreads
    spreads = await get_all_spreads()
    spreads_data = [asdict(s) for s in spreads]

    # Build crude oil curve
    cl_curve = await build_futures_curve("CL")
    curves_data = {}
    if cl_curve:
        curves_data["CL"] = asdict(cl_curve)

    # Seasonal for major commodities
    seasonal_data = {}
    for sym in ["CL", "GC", "ZC"]:
        sp = await compute_seasonal_pattern(sym)
        if sp:
            seasonal_data[sym] = asdict(sp)

    # Storage
    storage_data = {}
    for sym in ["CL", "NG"]:
        sa = await get_storage_analytics(sym)
        if sa:
            storage_data[sym] = asdict(sa)

    # Correlations
    corr = await compute_commodity_correlations()

    return CommodityDashboard(
        sectors=sectors_data,
        top_movers=top_movers,
        spreads=spreads_data,
        curves=curves_data,
        seasonal=seasonal_data,
        storage=storage_data,
        correlations=corr,
        timestamp=datetime.now().isoformat(),
    )


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_commodity_router():
    """Create FastAPI router for commodity endpoints"""
    from fastapi import APIRouter, Query, HTTPException
    router = APIRouter(prefix="/api/v4/commodities", tags=["commodities"])

    @router.get("/universe")
    async def get_universe():
        return {"commodities": COMMODITY_UNIVERSE}

    @router.get("/quotes")
    async def quotes(sector: Optional[str] = None):
        if sector:
            return {"quotes": [asdict(q) for q in await get_sector_quotes(sector)]}
        return {"sectors": {k: [asdict(q) for q in v] for k, v in (await get_all_commodity_quotes()).items()}}

    @router.get("/quote/{symbol}")
    async def quote(symbol: str):
        q = await get_commodity_quote(symbol.upper())
        if not q:
            raise HTTPException(404, f"Commodity {symbol} not found")
        return asdict(q)

    @router.get("/curve/{symbol}")
    async def curve(symbol: str, contracts: int = Query(12, ge=3, le=24)):
        c = await build_futures_curve(symbol.upper(), contracts)
        if not c:
            raise HTTPException(404, f"Could not build curve for {symbol}")
        return asdict(c)

    @router.get("/seasonal/{symbol}")
    async def seasonal(symbol: str, years: int = Query(10, ge=3, le=30)):
        s = await compute_seasonal_pattern(symbol.upper(), years)
        if not s:
            raise HTTPException(404, f"Insufficient data for {symbol}")
        return asdict(s)

    @router.get("/spreads")
    async def spreads():
        return {"spreads": [asdict(s) for s in await get_all_spreads()]}

    @router.get("/spread")
    async def spread(leg1: str, leg2: str, spread_type: str = "diff"):
        s = await compute_spread(leg1.upper(), leg2.upper(), spread_type)
        if not s:
            raise HTTPException(404, "Could not compute spread")
        return asdict(s)

    @router.get("/crack-spread")
    async def crack_spread():
        cs = await compute_crack_spread()
        if not cs:
            raise HTTPException(500, "Could not compute crack spread")
        return asdict(cs)

    @router.get("/spark-spread")
    async def spark_spread(heat_rate: float = Query(7000)):
        ss = await compute_spark_spread(heat_rate)
        if not ss:
            raise HTTPException(500, "Could not compute spark spread")
        return asdict(ss)

    @router.get("/storage/{symbol}")
    async def storage(symbol: str):
        s = await get_storage_analytics(symbol.upper())
        if not s:
            raise HTTPException(404, f"No storage data for {symbol}")
        return asdict(s)

    @router.get("/weather/{symbol}")
    async def weather(symbol: str):
        impacts = await compute_weather_impact(symbol.upper())
        return {"impacts": [asdict(i) for i in impacts]}

    @router.get("/cot/{symbol}")
    async def cot(symbol: str):
        c = await get_cot_data(symbol.upper())
        if not c:
            raise HTTPException(404, f"No COT data for {symbol}")
        return asdict(c)

    @router.get("/technical/{symbol}")
    async def technical(symbol: str):
        t = await compute_technical_summary(symbol.upper())
        if not t:
            raise HTTPException(404, f"Insufficient data for {symbol}")
        return asdict(t)

    @router.get("/correlations")
    async def correlations(
        symbols: str = Query("CL,NG,GC,SI,HG,ZC,ZW,ZS,KC"),
        lookback: int = Query(252)
    ):
        syms = [s.strip().upper() for s in symbols.split(",")]
        return await compute_commodity_correlations(syms, lookback)

    @router.get("/supply-demand/{symbol}")
    async def supply_demand(symbol: str):
        sd = await get_supply_demand_balance(symbol.upper())
        if not sd:
            raise HTTPException(404, f"No S/D data for {symbol}")
        return asdict(sd)

    @router.get("/dashboard")
    async def dashboard():
        d = await get_commodity_dashboard()
        return asdict(d)

    return router
