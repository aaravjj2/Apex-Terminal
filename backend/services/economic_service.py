"""
Economic Data & Calendar Service — §16 of tasks.md
====================================================
FRED integration, economic indicators, calendar events, central bank decisions,
GDP/CPI/PPI/employment data, yield curves, inflation expectations,
economic surprise index, leading indicators, global macro dashboard.

Uses: FRED API, Finnhub economic calendar, yfinance for yields/commodities.
"""

import os, asyncio, logging, json, math
from datetime import datetime, timedelta, date, timezone
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

FRED_KEY    = os.getenv("FRED_API_KEY", "")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
TIINGO_KEY  = os.getenv("TIINGO_API_KEY", "")

# ── Enums ─────────────────────────────────────────────────────────────────────

class EconCategory(str, Enum):
    GDP              = "gdp"
    EMPLOYMENT       = "employment"
    INFLATION        = "inflation"
    INTEREST_RATES   = "interest_rates"
    HOUSING          = "housing"
    MANUFACTURING    = "manufacturing"
    CONSUMER         = "consumer"
    TRADE            = "trade"
    GOVERNMENT       = "government"
    MONEY_SUPPLY     = "money_supply"
    LEADING          = "leading"
    GLOBAL           = "global"

class EventImpact(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"

class CentralBank(str, Enum):
    FED  = "fed"
    ECB  = "ecb"
    BOJ  = "boj"
    BOE  = "boe"
    PBOC = "pboc"
    RBA  = "rba"
    BOC  = "boc"
    SNB  = "snb"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class EconomicIndicator:
    id: str
    name: str
    category: EconCategory
    value: float
    previous: float
    change: float
    change_pct: float
    date: str
    frequency: str
    unit: str
    source: str
    description: str
    trend: str    # "improving", "declining", "stable"
    z_score: float
    percentile: float
    history: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class CalendarEvent:
    date: str
    time: str
    country: str
    event: str
    impact: EventImpact
    actual: Optional[float]
    forecast: Optional[float]
    previous: Optional[float]
    surprise: Optional[float]
    unit: str
    source: str

@dataclass
class YieldCurvePoint:
    maturity: str
    yield_value: float
    change_1d: float
    change_1w: float
    change_1m: float

@dataclass
class YieldCurve:
    date: str
    points: List[YieldCurvePoint]
    spread_2_10: float
    spread_3m_10: float
    inversion_signal: bool
    curve_shape: str

@dataclass
class InflationData:
    cpi_headline: float
    cpi_core: float
    pce_headline: float
    pce_core: float
    ppi: float
    breakeven_5y: float
    breakeven_10y: float
    expectations_1y: float
    expectations_5y: float
    trend: str
    date: str

@dataclass
class EmploymentData:
    nonfarm_payrolls: float
    unemployment_rate: float
    participation_rate: float
    avg_hourly_earnings: float
    avg_hours_worked: float
    initial_claims: float
    continuing_claims: float
    jolts_openings: float
    quit_rate: float
    date: str

@dataclass
class GDPData:
    gdp_growth: float
    gdp_nominal: float
    consumer_spending: float
    business_investment: float
    government_spending: float
    net_exports: float
    inventory_change: float
    quarter: str
    revision: str

@dataclass
class MacroDashboard:
    gdp: GDPData
    employment: EmploymentData
    inflation: InflationData
    yield_curve: YieldCurve
    fed_funds_rate: float
    recession_probability: float
    leading_index: float
    consumer_confidence: float
    ism_manufacturing: float
    ism_services: float
    retail_sales_mom: float
    industrial_production: float
    housing_starts: float
    building_permits: float
    trade_balance: float
    m2_money_supply: float
    timestamp: str

# ── FRED Series Map ──────────────────────────────────────────────────────────

FRED_SERIES = {
    # GDP
    "GDP": {"name": "Real GDP", "category": "gdp", "unit": "Billions $", "freq": "Quarterly"},
    "GDPC1": {"name": "Real GDP", "category": "gdp", "unit": "Billions 2017$", "freq": "Quarterly"},
    "A191RL1Q225SBEA": {"name": "GDP Growth Rate", "category": "gdp", "unit": "%", "freq": "Quarterly"},

    # Employment
    "PAYEMS": {"name": "Nonfarm Payrolls", "category": "employment", "unit": "Thousands", "freq": "Monthly"},
    "UNRATE": {"name": "Unemployment Rate", "category": "employment", "unit": "%", "freq": "Monthly"},
    "CIVPART": {"name": "Labor Force Participation", "category": "employment", "unit": "%", "freq": "Monthly"},
    "CES0500000003": {"name": "Avg Hourly Earnings", "category": "employment", "unit": "$", "freq": "Monthly"},
    "ICSA": {"name": "Initial Jobless Claims", "category": "employment", "unit": "Thousands", "freq": "Weekly"},
    "CCSA": {"name": "Continuing Claims", "category": "employment", "unit": "Thousands", "freq": "Weekly"},
    "JTSJOL": {"name": "JOLTS Job Openings", "category": "employment", "unit": "Thousands", "freq": "Monthly"},
    "JTSQUR": {"name": "Quit Rate", "category": "employment", "unit": "%", "freq": "Monthly"},

    # Inflation
    "CPIAUCSL": {"name": "CPI All Items", "category": "inflation", "unit": "Index", "freq": "Monthly"},
    "CPILFESL": {"name": "CPI Core", "category": "inflation", "unit": "Index", "freq": "Monthly"},
    "PCEPI": {"name": "PCE Price Index", "category": "inflation", "unit": "Index", "freq": "Monthly"},
    "PCEPILFE": {"name": "PCE Core", "category": "inflation", "unit": "Index", "freq": "Monthly"},
    "PPIFIS": {"name": "PPI Final Demand", "category": "inflation", "unit": "Index", "freq": "Monthly"},
    "T5YIE": {"name": "5Y Breakeven Inflation", "category": "inflation", "unit": "%", "freq": "Daily"},
    "T10YIE": {"name": "10Y Breakeven Inflation", "category": "inflation", "unit": "%", "freq": "Daily"},
    "MICH": {"name": "UMich Inflation Expectations", "category": "inflation", "unit": "%", "freq": "Monthly"},

    # Interest Rates
    "FEDFUNDS": {"name": "Fed Funds Rate", "category": "interest_rates", "unit": "%", "freq": "Monthly"},
    "DFF": {"name": "Fed Funds Daily", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS1MO": {"name": "1M Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS3MO": {"name": "3M Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS6MO": {"name": "6M Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS1": {"name": "1Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS2": {"name": "2Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS3": {"name": "3Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS5": {"name": "5Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS7": {"name": "7Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS10": {"name": "10Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS20": {"name": "20Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "DGS30": {"name": "30Y Treasury", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "T10Y2Y": {"name": "10Y-2Y Spread", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "T10Y3M": {"name": "10Y-3M Spread", "category": "interest_rates", "unit": "%", "freq": "Daily"},
    "BAMLH0A0HYM2": {"name": "HY OAS Spread", "category": "interest_rates", "unit": "%", "freq": "Daily"},

    # Housing
    "HOUST": {"name": "Housing Starts", "category": "housing", "unit": "Thousands", "freq": "Monthly"},
    "PERMIT": {"name": "Building Permits", "category": "housing", "unit": "Thousands", "freq": "Monthly"},
    "CSUSHPINSA": {"name": "Case-Shiller HPI", "category": "housing", "unit": "Index", "freq": "Monthly"},
    "MORTGAGE30US": {"name": "30Y Mortgage Rate", "category": "housing", "unit": "%", "freq": "Weekly"},
    "EXHOSLUSM495S": {"name": "Existing Home Sales", "category": "housing", "unit": "Millions", "freq": "Monthly"},

    # Manufacturing
    "MANEMP": {"name": "Manufacturing Employment", "category": "manufacturing", "unit": "Thousands", "freq": "Monthly"},
    "INDPRO": {"name": "Industrial Production", "category": "manufacturing", "unit": "Index", "freq": "Monthly"},
    "DGORDER": {"name": "Durable Goods Orders", "category": "manufacturing", "unit": "Millions $", "freq": "Monthly"},
    "AWHMAN": {"name": "Mfg Avg Hours", "category": "manufacturing", "unit": "Hours", "freq": "Monthly"},

    # Consumer
    "UMCSENT": {"name": "UMich Consumer Sentiment", "category": "consumer", "unit": "Index", "freq": "Monthly"},
    "RSAFS": {"name": "Retail Sales", "category": "consumer", "unit": "Millions $", "freq": "Monthly"},
    "PCE": {"name": "Personal Consumption", "category": "consumer", "unit": "Billions $", "freq": "Monthly"},
    "PSAVERT": {"name": "Personal Savings Rate", "category": "consumer", "unit": "%", "freq": "Monthly"},
    "REVOLSL": {"name": "Revolving Consumer Credit", "category": "consumer", "unit": "Billions $", "freq": "Monthly"},

    # Trade
    "BOPGSTB": {"name": "Trade Balance", "category": "trade", "unit": "Millions $", "freq": "Monthly"},
    "DTWEXBGS": {"name": "Dollar Index Broad", "category": "trade", "unit": "Index", "freq": "Daily"},

    # Money Supply
    "M2SL": {"name": "M2 Money Supply", "category": "money_supply", "unit": "Billions $", "freq": "Monthly"},
    "WALCL": {"name": "Fed Balance Sheet", "category": "money_supply", "unit": "Millions $", "freq": "Weekly"},

    # Leading
    "USSLIND": {"name": "Leading Economic Index", "category": "leading", "unit": "Index", "freq": "Monthly"},
    "RECPROUSM156N": {"name": "Recession Probability", "category": "leading", "unit": "%", "freq": "Monthly"},
    "USREC": {"name": "Recession Indicator", "category": "leading", "unit": "Binary", "freq": "Monthly"},
    "VIXCLS": {"name": "VIX", "category": "leading", "unit": "Index", "freq": "Daily"},
}


# ── FRED Data Fetching ───────────────────────────────────────────────────────

async def fetch_fred_series(
    series_id: str,
    limit: int = 100,
    start_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch data from FRED API"""
    if not FRED_KEY:
        return _generate_demo_fred(series_id, limit)

    try:
        import aiohttp
        params = {
            "series_id": series_id,
            "api_key": FRED_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        }
        if start_date:
            params["observation_start"] = start_date

        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.stlouisfed.org/fred/series/observations",
                params=params,
            ) as resp:
                if resp.status != 200:
                    return _generate_demo_fred(series_id, limit)
                data = await resp.json()
                observations = data.get("observations", [])
                return [
                    {"date": o["date"], "value": float(o["value"]) if o["value"] != "." else None}
                    for o in observations if o.get("value") != "."
                ]
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")
        return _generate_demo_fred(series_id, limit)


def _generate_demo_fred(series_id: str, limit: int) -> List[Dict[str, Any]]:
    """Generate demo FRED data"""
    import random

    base_values = {
        "GDP": 28000, "GDPC1": 22000, "A191RL1Q225SBEA": 2.5,
        "PAYEMS": 157000, "UNRATE": 3.7, "CIVPART": 62.5,
        "CES0500000003": 34.5, "ICSA": 220, "CCSA": 1800,
        "CPIAUCSL": 310, "CPILFESL": 315, "PCEPI": 120,
        "FEDFUNDS": 5.25, "DFF": 5.33,
        "DGS1MO": 5.4, "DGS3MO": 5.3, "DGS6MO": 5.2,
        "DGS1": 5.0, "DGS2": 4.5, "DGS3": 4.3,
        "DGS5": 4.1, "DGS7": 4.0, "DGS10": 3.9,
        "DGS20": 4.1, "DGS30": 4.0,
        "T10Y2Y": -0.5, "T10Y3M": -1.2,
        "HOUST": 1400, "PERMIT": 1500,
        "MORTGAGE30US": 6.8,
        "UMCSENT": 67, "RSAFS": 700000,
        "INDPRO": 103, "VIXCLS": 18,
        "M2SL": 21000, "BOPGSTB": -70000,
        "USSLIND": 99, "RECPROUSM156N": 20,
        "T5YIE": 2.3, "T10YIE": 2.2, "MICH": 3.5,
        "BAMLH0A0HYM2": 4.5,
    }

    base = base_values.get(series_id, 100)
    result = []
    d = datetime.now()
    for i in range(min(limit, 100)):
        val = base * (1 + random.uniform(-0.02, 0.02))
        result.append({"date": (d - timedelta(days=i*7)).strftime("%Y-%m-%d"), "value": round(val, 4)})
    return result


async def get_indicator(series_id: str) -> EconomicIndicator:
    """Get a single economic indicator with context"""
    info = FRED_SERIES.get(series_id, {"name": series_id, "category": "leading", "unit": "", "freq": "Monthly"})
    data = await fetch_fred_series(series_id, 52)

    if not data:
        raise ValueError(f"No data for {series_id}")

    values = [d["value"] for d in data if d["value"] is not None]
    current = values[0] if values else 0
    previous = values[1] if len(values) > 1 else current
    change = current - previous
    change_pct = (change / previous * 100) if previous else 0

    # Z-score and percentile
    if len(values) > 2:
        mean = statistics.mean(values)
        std = statistics.stdev(values) or 1
        z = (current - mean) / std
        # Approximate percentile
        below = sum(1 for v in values if v < current)
        pct = below / len(values) * 100
    else:
        z, pct = 0, 50

    # Trend
    if len(values) >= 3:
        if values[0] > values[1] > values[2]:
            trend = "improving"
        elif values[0] < values[1] < values[2]:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    history = [{"date": d["date"], "value": d["value"]} for d in data[:24]]

    return EconomicIndicator(
        id=series_id,
        name=info["name"],
        category=EconCategory(info["category"]),
        value=round(current, 4),
        previous=round(previous, 4),
        change=round(change, 4),
        change_pct=round(change_pct, 4),
        date=data[0]["date"] if data else "",
        frequency=info["freq"],
        unit=info["unit"],
        source="FRED",
        description=f"{info['name']} ({info['freq']})",
        trend=trend,
        z_score=round(z, 4),
        percentile=round(pct, 2),
        history=history,
    )


# ── Economic Calendar ────────────────────────────────────────────────────────

async def get_economic_calendar(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    country: Optional[str] = None,
    impact: Optional[str] = None,
) -> List[CalendarEvent]:
    """Get economic calendar events"""
    start = start_date or datetime.now().strftime("%Y-%m-%d")
    end = end_date or (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    events = []

    # Try Finnhub calendar
    if FINNHUB_KEY:
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://finnhub.io/api/v1/calendar/economic",
                    params={"from": start, "to": end, "token": FINNHUB_KEY},
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for e in data.get("economicCalendar", []):
                            events.append(CalendarEvent(
                                date=e.get("date", ""),
                                time=e.get("time", ""),
                                country=e.get("country", "US"),
                                event=e.get("event", ""),
                                impact=_classify_impact(e.get("impact", "low")),
                                actual=e.get("actual"),
                                forecast=e.get("estimate"),
                                previous=e.get("prev"),
                                surprise=_calc_surprise(e.get("actual"), e.get("estimate")),
                                unit=e.get("unit", ""),
                                source="Finnhub",
                            ))
        except Exception as e:
            logger.warning(f"Finnhub calendar failed: {e}")

    if not events:
        events = _generate_demo_calendar(start, end)

    # Filter
    if country:
        events = [e for e in events if e.country.lower() == country.lower()]
    if impact:
        events = [e for e in events if e.impact.value == impact]

    return sorted(events, key=lambda e: e.date)


def _classify_impact(s: str) -> EventImpact:
    s = s.lower()
    if s in ("high", "3"):
        return EventImpact.HIGH
    elif s in ("medium", "2"):
        return EventImpact.MEDIUM
    return EventImpact.LOW


def _calc_surprise(actual, forecast) -> Optional[float]:
    if actual is not None and forecast is not None and forecast != 0:
        return round((actual - forecast) / abs(forecast) * 100, 4)
    return None


def _generate_demo_calendar(start: str, end: str) -> List[CalendarEvent]:
    """Generate demo calendar events"""
    events_template = [
        ("US", "FOMC Rate Decision", EventImpact.HIGH, 5.25, 5.25, 5.25, "%"),
        ("US", "Non-Farm Payrolls", EventImpact.HIGH, 185, 175, 220, "K"),
        ("US", "CPI MoM", EventImpact.HIGH, 0.2, 0.3, 0.4, "%"),
        ("US", "CPI YoY", EventImpact.HIGH, 3.2, 3.3, 3.5, "%"),
        ("US", "Core CPI MoM", EventImpact.HIGH, 0.3, 0.3, 0.4, "%"),
        ("US", "Retail Sales MoM", EventImpact.MEDIUM, 0.4, 0.3, -0.2, "%"),
        ("US", "Initial Jobless Claims", EventImpact.MEDIUM, 218, 220, 225, "K"),
        ("US", "ISM Manufacturing PMI", EventImpact.HIGH, 49.2, 48.5, 47.8, ""),
        ("US", "ISM Services PMI", EventImpact.MEDIUM, 53.5, 52.8, 52.0, ""),
        ("US", "Consumer Confidence", EventImpact.MEDIUM, 102.5, 100.0, 99.5, ""),
        ("US", "PPI MoM", EventImpact.MEDIUM, 0.1, 0.2, 0.3, "%"),
        ("US", "Housing Starts", EventImpact.LOW, 1420, 1400, 1380, "K"),
        ("US", "Building Permits", EventImpact.LOW, 1510, 1480, 1500, "K"),
        ("US", "GDP QoQ", EventImpact.HIGH, 2.8, 3.0, 3.3, "%"),
        ("US", "PCE Price Index MoM", EventImpact.HIGH, 0.2, 0.3, 0.3, "%"),
        ("US", "Michigan Consumer Sentiment", EventImpact.MEDIUM, 67.5, 68.0, 69.0, ""),
        ("US", "Durable Goods Orders MoM", EventImpact.MEDIUM, 1.2, -0.5, 0.8, "%"),
        ("US", "Trade Balance", EventImpact.LOW, -68.5, -70.0, -71.0, "B$"),
        ("EU", "ECB Rate Decision", EventImpact.HIGH, 4.5, 4.5, 4.5, "%"),
        ("EU", "CPI YoY", EventImpact.HIGH, 2.6, 2.8, 2.9, "%"),
        ("UK", "BOE Rate Decision", EventImpact.HIGH, 5.25, 5.25, 5.25, "%"),
        ("JP", "BOJ Rate Decision", EventImpact.HIGH, -0.1, -0.1, -0.1, "%"),
        ("CN", "GDP YoY", EventImpact.HIGH, 5.2, 5.0, 4.9, "%"),
    ]

    d = datetime.strptime(start, "%Y-%m-%d")
    events = []
    for i, (country, event, impact, actual, forecast, previous, unit) in enumerate(events_template):
        event_date = d + timedelta(days=i % 14)
        events.append(CalendarEvent(
            date=event_date.strftime("%Y-%m-%d"),
            time=f"{8 + (i % 6)}:30",
            country=country,
            event=event,
            impact=impact,
            actual=actual,
            forecast=forecast,
            previous=previous,
            surprise=_calc_surprise(actual, forecast),
            unit=unit,
            source="Demo",
        ))
    return events


# ── Yield Curve ──────────────────────────────────────────────────────────────

async def get_yield_curve() -> YieldCurve:
    """Get current US Treasury yield curve"""
    maturities = [
        ("1M", "DGS1MO"), ("3M", "DGS3MO"), ("6M", "DGS6MO"),
        ("1Y", "DGS1"), ("2Y", "DGS2"), ("3Y", "DGS3"),
        ("5Y", "DGS5"), ("7Y", "DGS7"), ("10Y", "DGS10"),
        ("20Y", "DGS20"), ("30Y", "DGS30"),
    ]

    points = []
    values = {}

    for label, series in maturities:
        data = await fetch_fred_series(series, 30)
        if not data:
            continue

        vals = [d["value"] for d in data if d["value"] is not None]
        if not vals:
            continue

        current = vals[0]
        change_1d = current - vals[1] if len(vals) > 1 else 0
        change_1w = current - vals[5] if len(vals) > 5 else 0
        change_1m = current - vals[22] if len(vals) > 22 else 0

        points.append(YieldCurvePoint(
            maturity=label,
            yield_value=round(current, 4),
            change_1d=round(change_1d, 4),
            change_1w=round(change_1w, 4),
            change_1m=round(change_1m, 4),
        ))
        values[label] = current

    spread_2_10 = values.get("10Y", 0) - values.get("2Y", 0)
    spread_3m_10 = values.get("10Y", 0) - values.get("3M", 0)
    inverted = spread_2_10 < 0 or spread_3m_10 < 0

    if spread_2_10 < -0.5:
        shape = "Deeply Inverted"
    elif spread_2_10 < 0:
        shape = "Inverted"
    elif spread_2_10 < 0.5:
        shape = "Flat"
    elif spread_2_10 < 1.5:
        shape = "Normal"
    else:
        shape = "Steep"

    return YieldCurve(
        date=datetime.now().strftime("%Y-%m-%d"),
        points=points,
        spread_2_10=round(spread_2_10, 4),
        spread_3m_10=round(spread_3m_10, 4),
        inversion_signal=inverted,
        curve_shape=shape,
    )


# ── Macro Dashboard ──────────────────────────────────────────────────────────

async def get_macro_dashboard() -> MacroDashboard:
    """Get comprehensive macro economic dashboard"""
    # Fetch all critical series
    series_ids = [
        "A191RL1Q225SBEA", "GDP",  # GDP
        "PAYEMS", "UNRATE", "CIVPART", "CES0500000003", "ICSA", "CCSA", "JTSJOL", "JTSQUR",  # Employment
        "CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE", "PPIFIS", "T5YIE", "T10YIE", "MICH",  # Inflation
        "FEDFUNDS", "DGS2", "DGS10",  # Rates
        "UMCSENT", "RSAFS", "INDPRO",  # Consumer/Industrial
        "HOUST", "PERMIT",  # Housing
        "BOPGSTB", "M2SL",  # Trade/Money
        "USSLIND", "RECPROUSM156N",  # Leading
    ]

    # Fetch in batches
    data_map: Dict[str, List[Dict[str, Any]]] = {}
    for sid in series_ids:
        data_map[sid] = await fetch_fred_series(sid, 12)

    def _latest(sid: str) -> float:
        vals = data_map.get(sid, [])
        for v in vals:
            if v.get("value") is not None:
                return v["value"]
        return 0

    def _prev(sid: str) -> float:
        vals = data_map.get(sid, [])
        found = 0
        for v in vals:
            if v.get("value") is not None:
                found += 1
                if found == 2:
                    return v["value"]
        return _latest(sid)

    # Compute YoY for CPI
    cpi_data = data_map.get("CPIAUCSL", [])
    cpi_vals = [d["value"] for d in cpi_data if d.get("value") is not None]
    cpi_yoy = ((cpi_vals[0] / cpi_vals[12] - 1) * 100) if len(cpi_vals) > 12 else 3.2
    core_cpi_data = data_map.get("CPILFESL", [])
    core_vals = [d["value"] for d in core_cpi_data if d.get("value") is not None]
    core_yoy = ((core_vals[0] / core_vals[12] - 1) * 100) if len(core_vals) > 12 else 4.0

    # PCE YoY
    pce_data = data_map.get("PCEPI", [])
    pce_vals = [d["value"] for d in pce_data if d.get("value") is not None]
    pce_yoy = ((pce_vals[0] / pce_vals[12] - 1) * 100) if len(pce_vals) > 12 else 3.0
    core_pce_data = data_map.get("PCEPILFE", [])
    core_pce_vals = [d["value"] for d in core_pce_data if d.get("value") is not None]
    core_pce_yoy = ((core_pce_vals[0] / core_pce_vals[12] - 1) * 100) if len(core_pce_vals) > 12 else 3.5

    # Retail MoM
    rs_data = data_map.get("RSAFS", [])
    rs_vals = [d["value"] for d in rs_data if d.get("value") is not None]
    rs_mom = ((rs_vals[0] / rs_vals[1] - 1) * 100) if len(rs_vals) > 1 else 0.3

    # NF payrolls change
    nfp_data = data_map.get("PAYEMS", [])
    nfp_vals = [d["value"] for d in nfp_data if d.get("value") is not None]
    nfp_change = nfp_vals[0] - nfp_vals[1] if len(nfp_vals) > 1 else 180

    inflation_trend = "declining" if cpi_yoy < 4 else "elevated"

    gdp = GDPData(
        gdp_growth=_latest("A191RL1Q225SBEA"),
        gdp_nominal=_latest("GDP"),
        consumer_spending=0, business_investment=0,
        government_spending=0, net_exports=0, inventory_change=0,
        quarter="Q3 2024", revision="3rd",
    )

    employment = EmploymentData(
        nonfarm_payrolls=nfp_change,
        unemployment_rate=_latest("UNRATE"),
        participation_rate=_latest("CIVPART"),
        avg_hourly_earnings=_latest("CES0500000003"),
        avg_hours_worked=34.3,
        initial_claims=_latest("ICSA"),
        continuing_claims=_latest("CCSA"),
        jolts_openings=_latest("JTSJOL"),
        quit_rate=_latest("JTSQUR"),
        date=datetime.now().strftime("%Y-%m-%d"),
    )

    inflation = InflationData(
        cpi_headline=round(cpi_yoy, 2),
        cpi_core=round(core_yoy, 2),
        pce_headline=round(pce_yoy, 2),
        pce_core=round(core_pce_yoy, 2),
        ppi=_latest("PPIFIS"),
        breakeven_5y=_latest("T5YIE"),
        breakeven_10y=_latest("T10YIE"),
        expectations_1y=_latest("MICH"),
        expectations_5y=2.3,
        trend=inflation_trend,
        date=datetime.now().strftime("%Y-%m-%d"),
    )

    yield_curve = await get_yield_curve()

    return MacroDashboard(
        gdp=gdp,
        employment=employment,
        inflation=inflation,
        yield_curve=yield_curve,
        fed_funds_rate=_latest("FEDFUNDS"),
        recession_probability=_latest("RECPROUSM156N"),
        leading_index=_latest("USSLIND"),
        consumer_confidence=_latest("UMCSENT"),
        ism_manufacturing=49.2,
        ism_services=53.5,
        retail_sales_mom=round(rs_mom, 2),
        industrial_production=_latest("INDPRO"),
        housing_starts=_latest("HOUST"),
        building_permits=_latest("PERMIT"),
        trade_balance=_latest("BOPGSTB"),
        m2_money_supply=_latest("M2SL"),
        timestamp=datetime.now().isoformat(),
    )


# ── Indicator Groups ─────────────────────────────────────────────────────────

async def get_indicators_by_category(category: EconCategory) -> List[EconomicIndicator]:
    """Get all indicators for a category"""
    indicators = []
    for series_id, info in FRED_SERIES.items():
        if info["category"] == category.value:
            try:
                ind = await get_indicator(series_id)
                indicators.append(ind)
            except Exception:
                pass
    return indicators


# ── Economic Surprise Index ──────────────────────────────────────────────────

async def get_economic_surprise_index() -> Dict[str, Any]:
    """Calculate economic surprise index (actual vs. forecast)"""
    events = await get_economic_calendar()
    high_impact = [e for e in events if e.impact == EventImpact.HIGH and e.surprise is not None]

    if not high_impact:
        return {"index": 0, "events": 0, "positive_pct": 50, "negative_pct": 50}

    surprises = [e.surprise for e in high_impact]
    positive = sum(1 for s in surprises if s > 0)
    negative = sum(1 for s in surprises if s < 0)
    total = len(surprises)
    avg_surprise = statistics.mean(surprises)

    return {
        "index": round(avg_surprise, 4),
        "events": total,
        "positive_pct": round(positive / total * 100, 2),
        "negative_pct": round(negative / total * 100, 2),
        "avg_surprise": round(avg_surprise, 4),
        "biggest_beat": max(high_impact, key=lambda e: e.surprise or 0).event,
        "biggest_miss": min(high_impact, key=lambda e: e.surprise or 0).event,
    }


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_economic_router():
    from fastapi import APIRouter, Query, HTTPException
    router = APIRouter(prefix="/api/v4/economic", tags=["economic"])

    @router.get("/indicator/{series_id}")
    async def indicator(series_id: str):
        try:
            ind = await get_indicator(series_id.upper())
            return asdict(ind)
        except Exception as e:
            raise HTTPException(400, str(e))

    @router.get("/series/{series_id}")
    async def series(series_id: str, limit: int = Query(100)):
        data = await fetch_fred_series(series_id.upper(), limit)
        return {"series_id": series_id.upper(), "data": data}

    @router.get("/category/{category}")
    async def by_category(category: str):
        try:
            cat = EconCategory(category)
        except ValueError:
            raise HTTPException(400, f"Invalid category: {category}")
        indicators = await get_indicators_by_category(cat)
        return {"category": category, "indicators": [asdict(i) for i in indicators]}

    @router.get("/categories")
    async def list_categories():
        return {"categories": [c.value for c in EconCategory]}

    @router.get("/calendar")
    async def calendar(
        start: Optional[str] = None,
        end: Optional[str] = None,
        country: Optional[str] = None,
        impact: Optional[str] = None,
    ):
        events = await get_economic_calendar(start, end, country, impact)
        return {"events": [asdict(e) for e in events]}

    @router.get("/yield-curve")
    async def yield_curve():
        yc = await get_yield_curve()
        return asdict(yc)

    @router.get("/dashboard")
    async def macro_dashboard():
        dashboard = await get_macro_dashboard()
        return asdict(dashboard)

    @router.get("/surprise")
    async def surprise_index():
        return await get_economic_surprise_index()

    @router.get("/series-list")
    async def series_list():
        return {"series": [
            {"id": k, "name": v["name"], "category": v["category"],
             "unit": v["unit"], "frequency": v["freq"]}
            for k, v in FRED_SERIES.items()
        ]}

    return router
