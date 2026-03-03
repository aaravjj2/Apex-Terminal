"""
Alert & Social Monitoring Service — §14 of tasks.md
=====================================================
Price alerts, volume alerts, technical indicator alerts, earnings alerts,
social sentiment tracking (Reddit, Twitter/X), delivery channels (push, webhook),
alert history, watchlist integration, price level crossing, indicator crossing.

Uses: Finnhub, Reddit, NewsAPI, yfinance, WebSocket for real-time.
"""

import os, asyncio, logging, json, hashlib, uuid
from datetime import datetime, timedelta, date, timezone
from typing import Dict, List, Optional, Tuple, Any, Set, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
NEWSAPI_KEY = os.getenv("NEWSAPI_API_KEY", "")
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER = os.getenv("REDDIT_USERNAME", "")
REDDIT_PASS = os.getenv("REDDIT_PASSWORD", "")

# ── Enums ─────────────────────────────────────────────────────────────────────

class AlertType(str, Enum):
    PRICE_ABOVE          = "price_above"
    PRICE_BELOW          = "price_below"
    PRICE_CROSSES_ABOVE  = "price_crosses_above"
    PRICE_CROSSES_BELOW  = "price_crosses_below"
    PRICE_CHANGE_PCT     = "price_change_pct"
    VOLUME_ABOVE         = "volume_above"
    VOLUME_SPIKE         = "volume_spike"
    RSI_ABOVE            = "rsi_above"
    RSI_BELOW            = "rsi_below"
    MACD_CROSS_BULL      = "macd_cross_bull"
    MACD_CROSS_BEAR      = "macd_cross_bear"
    SMA_CROSS_ABOVE      = "sma_cross_above"
    SMA_CROSS_BELOW      = "sma_cross_below"
    GOLDEN_CROSS         = "golden_cross"
    DEATH_CROSS          = "death_cross"
    BOLLINGER_UPPER      = "bollinger_upper"
    BOLLINGER_LOWER      = "bollinger_lower"
    NEW_52W_HIGH         = "new_52w_high"
    NEW_52W_LOW          = "new_52w_low"
    EARNINGS_UPCOMING    = "earnings_upcoming"
    EARNINGS_SURPRISE    = "earnings_surprise"
    DIVIDEND_EX_DATE     = "dividend_ex_date"
    INSIDER_TRADE        = "insider_trade"
    ANALYST_UPGRADE      = "analyst_upgrade"
    ANALYST_DOWNGRADE    = "analyst_downgrade"
    NEWS_SENTIMENT       = "news_sentiment"
    SOCIAL_MENTION_SPIKE = "social_mention_spike"
    TREND_CHANGE         = "trend_change"
    SUPPORT_BREAK        = "support_break"
    RESISTANCE_BREAK     = "resistance_break"
    GAP_UP               = "gap_up"
    GAP_DOWN             = "gap_down"
    CUSTOM_CONDITION     = "custom_condition"

class AlertStatus(str, Enum):
    ACTIVE    = "active"
    TRIGGERED = "triggered"
    EXPIRED   = "expired"
    PAUSED    = "paused"
    CANCELLED = "cancelled"

class AlertPriority(str, Enum):
    CRITICAL = "critical"
    HIGH     = "high"
    MEDIUM   = "medium"
    LOW      = "low"
    INFO     = "info"

class DeliveryChannel(str, Enum):
    PUSH       = "push"
    EMAIL      = "email"
    WEBHOOK    = "webhook"
    SMS        = "sms"
    IN_APP     = "in_app"
    SOUND      = "sound"
    DESKTOP    = "desktop"

class AlertFrequency(str, Enum):
    ONCE          = "once"
    EVERY_TIME    = "every_time"
    ONCE_PER_DAY  = "once_per_day"
    ONCE_PER_HOUR = "once_per_hour"

class SocialPlatform(str, Enum):
    REDDIT  = "reddit"
    TWITTER = "twitter"
    STOCKTWITS = "stocktwits"
    DISCORD = "discord"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class AlertCondition:
    type: AlertType
    symbol: str
    value: float
    value2: Optional[float] = None  # For range conditions
    timeframe: str = "1d"
    indicator_params: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Alert:
    id: str
    user_id: str
    name: str
    conditions: List[AlertCondition]
    logical_operator: str = "AND"
    status: AlertStatus = AlertStatus.ACTIVE
    priority: AlertPriority = AlertPriority.MEDIUM
    channels: List[DeliveryChannel] = field(default_factory=lambda: [DeliveryChannel.IN_APP])
    frequency: AlertFrequency = AlertFrequency.ONCE
    message: str = ""
    webhook_url: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    triggered_at: Optional[str] = None
    trigger_count: int = 0
    expires_at: Optional[str] = None
    last_checked: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AlertTrigger:
    alert_id: str
    symbol: str
    triggered_at: str
    price: float
    condition_met: str
    message: str
    data: Dict[str, Any]
    delivered: bool = False
    delivery_channels: List[str] = field(default_factory=list)

@dataclass
class SocialMention:
    platform: SocialPlatform
    symbol: str
    title: str
    body: str
    author: str
    url: str
    timestamp: str
    sentiment: float
    engagement: int
    subreddit: Optional[str] = None

@dataclass
class SocialMetrics:
    symbol: str
    mentions_1h: int
    mentions_24h: int
    mentions_7d: int
    mention_change_pct: float
    avg_sentiment: float
    sentiment_trend: str
    top_posts: List[SocialMention]
    platforms: Dict[str, int]
    trending_rank: int
    bullish_pct: float
    bearish_pct: float
    neutral_pct: float
    word_cloud: Dict[str, int]

@dataclass
class TrendingTicker:
    symbol: str
    name: str
    mentions: int
    mention_change: float
    sentiment: float
    price: float
    price_change_pct: float
    sources: List[str]
    top_comment: str

# ── Alert Storage ─────────────────────────────────────────────────────────────

class AlertStore:
    """In-memory alert storage"""

    def __init__(self):
        self._alerts: Dict[str, Alert] = {}
        self._triggers: List[AlertTrigger] = []
        self._symbol_alerts: Dict[str, List[str]] = defaultdict(list)

    def create_alert(self, alert: Alert) -> Alert:
        alert.id = str(uuid.uuid4())
        alert.created_at = datetime.now(timezone.utc).isoformat()
        alert.updated_at = alert.created_at
        self._alerts[alert.id] = alert
        for cond in alert.conditions:
            self._symbol_alerts[cond.symbol].append(alert.id)
        return alert

    def get_alert(self, alert_id: str) -> Optional[Alert]:
        return self._alerts.get(alert_id)

    def list_alerts(self, user_id: str, status: Optional[AlertStatus] = None) -> List[Alert]:
        alerts = [a for a in self._alerts.values() if a.user_id == user_id]
        if status:
            alerts = [a for a in alerts if a.status == status]
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    def update_alert(self, alert_id: str, **kwargs) -> Optional[Alert]:
        alert = self._alerts.get(alert_id)
        if not alert:
            return None
        for k, v in kwargs.items():
            if hasattr(alert, k):
                setattr(alert, k, v)
        alert.updated_at = datetime.now(timezone.utc).isoformat()
        return alert

    def delete_alert(self, alert_id: str) -> bool:
        alert = self._alerts.pop(alert_id, None)
        if alert:
            for cond in alert.conditions:
                if alert_id in self._symbol_alerts.get(cond.symbol, []):
                    self._symbol_alerts[cond.symbol].remove(alert_id)
            return True
        return False

    def get_alerts_for_symbol(self, symbol: str) -> List[Alert]:
        alert_ids = self._symbol_alerts.get(symbol, [])
        return [self._alerts[aid] for aid in alert_ids if aid in self._alerts]

    def add_trigger(self, trigger: AlertTrigger):
        self._triggers.append(trigger)
        alert = self._alerts.get(trigger.alert_id)
        if alert:
            alert.trigger_count += 1
            alert.triggered_at = trigger.triggered_at
            if alert.frequency == AlertFrequency.ONCE:
                alert.status = AlertStatus.TRIGGERED

    def get_triggers(self, alert_id: Optional[str] = None, limit: int = 100) -> List[AlertTrigger]:
        triggers = self._triggers
        if alert_id:
            triggers = [t for t in triggers if t.alert_id == alert_id]
        return sorted(triggers, key=lambda t: t.triggered_at, reverse=True)[:limit]


_store = AlertStore()


# ── Alert Evaluation ──────────────────────────────────────────────────────────

async def _fetch_price_data(symbol: str) -> Dict[str, Any]:
    """Fetch current price data for alert evaluation"""
    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)
        hist = tk.history(period="6mo")
        info = tk.info

        if hist.empty:
            return {}

        closes = hist["Close"].tolist()
        volumes = hist["Volume"].tolist()
        highs = hist["High"].tolist()
        lows = hist["Low"].tolist()

        current = closes[-1]
        prev = closes[-2] if len(closes) > 1 else current

        # EMAs
        ema12, ema26 = current, current
        if len(closes) >= 26:
            ema12 = _ema(closes, 12)
            ema26 = _ema(closes, 26)

        # MACD
        macd = ema12 - ema26
        signal = macd * 0.9  # simplified

        # RSI
        rsi = 50
        if len(closes) >= 15:
            gains = [max(closes[i] - closes[i-1], 0) for i in range(-14, 0)]
            losses = [max(closes[i-1] - closes[i], 0) for i in range(-14, 0)]
            avg_g = statistics.mean(gains)
            avg_l = statistics.mean(losses) or 1e-8
            rsi = 100 - (100 / (1 + avg_g / avg_l))

        # SMAs
        sma20 = statistics.mean(closes[-20:]) if len(closes) >= 20 else current
        sma50 = statistics.mean(closes[-50:]) if len(closes) >= 50 else current
        sma200 = statistics.mean(closes[-200:]) if len(closes) >= 200 else current

        # Bollinger
        bb_std = statistics.stdev(closes[-20:]) if len(closes) >= 20 else 0
        bb_upper = sma20 + 2 * bb_std
        bb_lower = sma20 - 2 * bb_std

        # 52W
        h52 = max(highs[-252:]) if len(highs) >= 252 else max(highs)
        l52 = min(lows[-252:]) if len(lows) >= 252 else min(lows)

        avg_vol = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else volumes[-1]
        last_vol = volumes[-1]

        gap = 0
        if len(hist) >= 2:
            opens = hist["Open"].tolist()
            gap = (opens[-1] - closes[-2]) / closes[-2] * 100

        return {
            "price": current, "prev_close": prev,
            "change_pct": (current - prev) / prev * 100 if prev else 0,
            "volume": last_vol, "avg_volume": avg_vol,
            "relative_volume": last_vol / avg_vol if avg_vol else 1,
            "rsi": rsi, "macd": macd, "macd_signal": signal,
            "sma_20": sma20, "sma_50": sma50, "sma_200": sma200,
            "bb_upper": bb_upper, "bb_lower": bb_lower,
            "high_52w": h52, "low_52w": l52,
            "gap_pct": gap,
            "closes": closes, "highs": highs, "lows": lows,
        }
    except Exception as e:
        logger.warning(f"Price fetch failed for {symbol}: {e}")
        return {}


def _ema(data: list, period: int) -> float:
    if not data:
        return 0
    k = 2 / (period + 1)
    ema = data[0]
    for val in data[1:]:
        ema = val * k + ema * (1 - k)
    return ema


def _check_condition(cond: AlertCondition, data: Dict[str, Any]) -> Tuple[bool, str]:
    """Check if a single alert condition is met"""
    price = data.get("price", 0)
    rsi = data.get("rsi", 50)
    macd = data.get("macd", 0)
    macd_sig = data.get("macd_signal", 0)
    sma20 = data.get("sma_20", 0)
    sma50 = data.get("sma_50", 0)
    sma200 = data.get("sma_200", 0)
    volume = data.get("volume", 0)
    rel_vol = data.get("relative_volume", 1)
    bb_upper = data.get("bb_upper", 0)
    bb_lower = data.get("bb_lower", 0)
    h52 = data.get("high_52w", 0)
    l52 = data.get("low_52w", 0)
    gap = data.get("gap_pct", 0)
    change = data.get("change_pct", 0)

    t = cond.type
    v = cond.value

    if t == AlertType.PRICE_ABOVE and price > v:
        return True, f"Price ${price:.2f} above ${v:.2f}"
    if t == AlertType.PRICE_BELOW and price < v:
        return True, f"Price ${price:.2f} below ${v:.2f}"
    if t == AlertType.PRICE_CROSSES_ABOVE and price > v:
        return True, f"Price crossed above ${v:.2f}"
    if t == AlertType.PRICE_CROSSES_BELOW and price < v:
        return True, f"Price crossed below ${v:.2f}"
    if t == AlertType.PRICE_CHANGE_PCT and abs(change) > v:
        return True, f"Price changed {change:.2f}% (threshold: {v:.2f}%)"
    if t == AlertType.VOLUME_ABOVE and volume > v:
        return True, f"Volume {volume:,.0f} above {v:,.0f}"
    if t == AlertType.VOLUME_SPIKE and rel_vol > v:
        return True, f"Volume {rel_vol:.1f}x average (threshold: {v:.1f}x)"
    if t == AlertType.RSI_ABOVE and rsi > v:
        return True, f"RSI {rsi:.1f} above {v:.1f}"
    if t == AlertType.RSI_BELOW and rsi < v:
        return True, f"RSI {rsi:.1f} below {v:.1f}"
    if t == AlertType.MACD_CROSS_BULL and macd > macd_sig:
        return True, f"MACD bullish crossover"
    if t == AlertType.MACD_CROSS_BEAR and macd < macd_sig:
        return True, f"MACD bearish crossover"
    if t == AlertType.SMA_CROSS_ABOVE and price > sma20:
        return True, f"Price crossed above SMA20"
    if t == AlertType.SMA_CROSS_BELOW and price < sma20:
        return True, f"Price crossed below SMA20"
    if t == AlertType.GOLDEN_CROSS and sma50 > sma200:
        return True, "Golden cross (SMA50 > SMA200)"
    if t == AlertType.DEATH_CROSS and sma50 < sma200:
        return True, "Death cross (SMA50 < SMA200)"
    if t == AlertType.BOLLINGER_UPPER and price > bb_upper:
        return True, f"Price above upper Bollinger Band (${bb_upper:.2f})"
    if t == AlertType.BOLLINGER_LOWER and price < bb_lower:
        return True, f"Price below lower Bollinger Band (${bb_lower:.2f})"
    if t == AlertType.NEW_52W_HIGH and price >= h52 * 0.99:
        return True, f"Near 52-week high (${h52:.2f})"
    if t == AlertType.NEW_52W_LOW and price <= l52 * 1.01:
        return True, f"Near 52-week low (${l52:.2f})"
    if t == AlertType.GAP_UP and gap > v:
        return True, f"Gap up {gap:.1f}% (threshold: {v:.1f}%)"
    if t == AlertType.GAP_DOWN and gap < -v:
        return True, f"Gap down {gap:.1f}% (threshold: {v:.1f}%)"

    return False, ""


async def evaluate_alert(alert: Alert) -> Optional[AlertTrigger]:
    """Evaluate a single alert against current market data"""
    if alert.status != AlertStatus.ACTIVE:
        return None

    # Check expiration
    if alert.expires_at:
        try:
            exp = datetime.fromisoformat(alert.expires_at)
            if datetime.now(timezone.utc) > exp:
                alert.status = AlertStatus.EXPIRED
                return None
        except ValueError:
            pass

    # Check frequency
    if alert.frequency == AlertFrequency.ONCE_PER_HOUR and alert.triggered_at:
        try:
            last = datetime.fromisoformat(alert.triggered_at)
            if datetime.now(timezone.utc) - last < timedelta(hours=1):
                return None
        except ValueError:
            pass
    if alert.frequency == AlertFrequency.ONCE_PER_DAY and alert.triggered_at:
        try:
            last = datetime.fromisoformat(alert.triggered_at)
            if datetime.now(timezone.utc) - last < timedelta(days=1):
                return None
        except ValueError:
            pass

    # Get unique symbols
    symbols = list(set(c.symbol for c in alert.conditions))
    data_map: Dict[str, Dict[str, Any]] = {}
    for sym in symbols:
        data_map[sym] = await _fetch_price_data(sym)

    # Evaluate conditions
    results = []
    messages = []
    for cond in alert.conditions:
        data = data_map.get(cond.symbol, {})
        if not data:
            results.append(False)
            continue
        met, msg = _check_condition(cond, data)
        results.append(met)
        if met:
            messages.append(msg)

    # Apply logical operator
    triggered = False
    if alert.logical_operator == "AND":
        triggered = all(results)
    elif alert.logical_operator == "OR":
        triggered = any(results)

    if not triggered:
        return None

    # Create trigger
    first_sym = alert.conditions[0].symbol if alert.conditions else ""
    first_data = data_map.get(first_sym, {})

    trigger = AlertTrigger(
        alert_id=alert.id,
        symbol=first_sym,
        triggered_at=datetime.now(timezone.utc).isoformat(),
        price=first_data.get("price", 0),
        condition_met=" & ".join(messages),
        message=alert.message or " | ".join(messages),
        data={"prices": {s: d.get("price", 0) for s, d in data_map.items()}},
    )

    return trigger


async def evaluate_all_alerts():
    """Check all active alerts"""
    active = [a for a in _store._alerts.values() if a.status == AlertStatus.ACTIVE]
    triggers = []

    for alert in active:
        try:
            trigger = await evaluate_alert(alert)
            if trigger:
                _store.add_trigger(trigger)
                triggers.append(trigger)
                await _deliver_alert(alert, trigger)
        except Exception as e:
            logger.error(f"Alert eval error {alert.id}: {e}")

    return triggers


# ── Delivery ──────────────────────────────────────────────────────────────────

async def _deliver_alert(alert: Alert, trigger: AlertTrigger):
    """Deliver alert through configured channels"""
    for channel in alert.channels:
        try:
            if channel == DeliveryChannel.WEBHOOK and alert.webhook_url:
                await _deliver_webhook(alert, trigger)
            elif channel == DeliveryChannel.IN_APP:
                # In-app delivery is handled by storing the trigger
                trigger.delivered = True
                trigger.delivery_channels.append("in_app")
            elif channel == DeliveryChannel.DESKTOP:
                trigger.delivered = True
                trigger.delivery_channels.append("desktop")
            elif channel == DeliveryChannel.SOUND:
                trigger.delivered = True
                trigger.delivery_channels.append("sound")
        except Exception as e:
            logger.error(f"Delivery failed for {channel}: {e}")


async def _deliver_webhook(alert: Alert, trigger: AlertTrigger):
    """Deliver alert via webhook"""
    if not alert.webhook_url:
        return
    try:
        import aiohttp
        payload = {
            "alert_id": alert.id,
            "alert_name": alert.name,
            "symbol": trigger.symbol,
            "price": trigger.price,
            "condition": trigger.condition_met,
            "message": trigger.message,
            "triggered_at": trigger.triggered_at,
            "priority": alert.priority.value,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(alert.webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status < 300:
                    trigger.delivered = True
                    trigger.delivery_channels.append("webhook")
    except Exception as e:
        logger.warning(f"Webhook delivery failed: {e}")


# ── Social Monitoring ─────────────────────────────────────────────────────────

FINANCE_SUBREDDITS = [
    "wallstreetbets", "stocks", "investing", "options", "thetagang",
    "stockmarket", "pennystocks", "daytrading", "algotrading",
    "SecurityAnalysis", "ValueInvesting", "dividends",
]

STOCK_TICKER_PATTERN = r'\$([A-Z]{1,5})\b'
CASHTAG_PATTERN = r'(?:^|\s)([A-Z]{2,5})(?:\s|$)'

async def _get_reddit_token() -> Optional[str]:
    """Get Reddit OAuth token"""
    if not REDDIT_CLIENT_ID or not REDDIT_SECRET:
        return None
    try:
        import aiohttp
        auth = aiohttp.BasicAuth(REDDIT_CLIENT_ID, REDDIT_SECRET)
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://www.reddit.com/api/v1/access_token",
                auth=auth,
                data={"grant_type": "password", "username": REDDIT_USER, "password": REDDIT_PASS},
                headers={"User-Agent": "FinanceDashboard/1.0"},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("access_token")
    except Exception as e:
        logger.warning(f"Reddit auth failed: {e}")
    return None


async def fetch_reddit_mentions(
    symbol: str,
    subreddits: Optional[List[str]] = None,
    limit: int = 50,
    period: str = "day",
) -> List[SocialMention]:
    """Fetch Reddit mentions of a stock ticker"""
    token = await _get_reddit_token()
    if not token:
        return _generate_demo_reddit(symbol)

    mentions = []
    target_subs = subreddits or ["wallstreetbets", "stocks", "options"]

    try:
        import aiohttp
        headers = {"Authorization": f"Bearer {token}", "User-Agent": "FinanceDashboard/1.0"}
        async with aiohttp.ClientSession() as session:
            for sub in target_subs:
                url = f"https://oauth.reddit.com/r/{sub}/search"
                params = {"q": f"${symbol} OR {symbol}", "sort": "new", "t": period, "limit": limit, "restrict_sr": True}
                async with session.get(url, params=params, headers=headers) as resp:
                    if resp.status != 200:
                        continue
                    data = await resp.json()
                    for post in data.get("data", {}).get("children", []):
                        p = post.get("data", {})
                        text = f"{p.get('title', '')} {p.get('selftext', '')}"
                        sent = _quick_sentiment(text)
                        mentions.append(SocialMention(
                            platform=SocialPlatform.REDDIT,
                            symbol=symbol,
                            title=p.get("title", ""),
                            body=p.get("selftext", "")[:500],
                            author=p.get("author", ""),
                            url=f"https://reddit.com{p.get('permalink', '')}",
                            timestamp=datetime.fromtimestamp(p.get("created_utc", 0), tz=timezone.utc).isoformat(),
                            sentiment=sent,
                            engagement=p.get("score", 0) + p.get("num_comments", 0),
                            subreddit=sub,
                        ))
    except Exception as e:
        logger.warning(f"Reddit fetch failed: {e}")

    return sorted(mentions, key=lambda m: m.engagement, reverse=True)


def _generate_demo_reddit(symbol: str) -> List[SocialMention]:
    """Generate demo Reddit mentions"""
    import random
    templates = [
        f"${symbol} looking bullish, strong support at current levels",
        f"Just bought more ${symbol}, earnings gonna crush it",
        f"${symbol} might be overvalued at these levels, be careful",
        f"DD on ${symbol}: fundamentals are solid, growth story intact",
        f"${symbol} short squeeze incoming? High SI and volume picking up",
        f"Sold my ${symbol} position, taking profits here",
        f"${symbol} breaking out of consolidation, watching closely",
        f"Bearish on ${symbol}, technicals look weak",
        f"${symbol} is the play today, unusual options activity",
        f"Long ${symbol} since $100, not selling until $500",
    ]
    subs = ["wallstreetbets", "stocks", "options", "investing"]
    mentions = []
    for i, t in enumerate(templates):
        mentions.append(SocialMention(
            platform=SocialPlatform.REDDIT,
            symbol=symbol,
            title=t,
            body=f"{t}. More detailed analysis here...",
            author=f"user_{random.randint(1000,9999)}",
            url=f"https://reddit.com/r/{subs[i % len(subs)]}/comments/demo{i}",
            timestamp=(datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))).isoformat(),
            sentiment=random.uniform(-0.5, 0.8),
            engagement=random.randint(10, 5000),
            subreddit=subs[i % len(subs)],
        ))
    return mentions


BULLISH_WORDS = {
    "bullish", "buy", "long", "calls", "moon", "rocket", "squeeze", "breakout",
    "undervalued", "support", "upside", "growth", "beat", "surge", "rally",
    "upgrade", "accumulate", "strong", "opportunity", "dip", "oversold",
}
BEARISH_WORDS = {
    "bearish", "sell", "short", "puts", "crash", "dump", "overvalued", "resistance",
    "downside", "decline", "miss", "drop", "downgrade", "weak", "overbought",
    "bubble", "risk", "layoffs", "debt", "warning",
}

def _quick_sentiment(text: str) -> float:
    """Quick sentiment score from text"""
    words = set(text.lower().split())
    bull = len(words & BULLISH_WORDS)
    bear = len(words & BEARISH_WORDS)
    total = bull + bear
    if total == 0:
        return 0.0
    return (bull - bear) / total


async def get_social_metrics(symbol: str) -> SocialMetrics:
    """Get comprehensive social metrics for a ticker"""
    mentions = await fetch_reddit_mentions(symbol)

    sentiments = [m.sentiment for m in mentions]
    avg_sent = statistics.mean(sentiments) if sentiments else 0
    bullish = sum(1 for s in sentiments if s > 0.2)
    bearish = sum(1 for s in sentiments if s < -0.2)
    neutral = len(sentiments) - bullish - bearish
    total = max(len(sentiments), 1)

    # Word cloud
    all_words: Dict[str, int] = defaultdict(int)
    for m in mentions:
        for w in m.title.lower().split():
            if len(w) > 3 and w.isalpha():
                all_words[w] += 1
    top_words = dict(sorted(all_words.items(), key=lambda x: x[1], reverse=True)[:30])

    return SocialMetrics(
        symbol=symbol,
        mentions_1h=len([m for m in mentions if _within_hours(m.timestamp, 1)]),
        mentions_24h=len([m for m in mentions if _within_hours(m.timestamp, 24)]),
        mentions_7d=len(mentions),
        mention_change_pct=0,
        avg_sentiment=round(avg_sent, 4),
        sentiment_trend="bullish" if avg_sent > 0.1 else "bearish" if avg_sent < -0.1 else "neutral",
        top_posts=mentions[:5],
        platforms={"reddit": len(mentions)},
        trending_rank=0,
        bullish_pct=round(bullish / total * 100, 2),
        bearish_pct=round(bearish / total * 100, 2),
        neutral_pct=round(neutral / total * 100, 2),
        word_cloud=top_words,
    )


def _within_hours(ts: str, hours: int) -> bool:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - dt < timedelta(hours=hours)
    except (ValueError, TypeError):
        return False


async def get_trending_tickers(limit: int = 20) -> List[TrendingTicker]:
    """Get trending tickers from social media"""
    # Scan top posts from wallstreetbets
    token = await _get_reddit_token()
    ticker_counts: Dict[str, int] = defaultdict(int)
    ticker_sentiments: Dict[str, List[float]] = defaultdict(list)
    ticker_posts: Dict[str, str] = {}

    if token:
        try:
            import aiohttp, re
            headers = {"Authorization": f"Bearer {token}", "User-Agent": "FinanceDashboard/1.0"}
            async with aiohttp.ClientSession() as session:
                for sub in ["wallstreetbets", "stocks"]:
                    url = f"https://oauth.reddit.com/r/{sub}/hot"
                    async with session.get(url, params={"limit": 100}, headers=headers) as resp:
                        if resp.status != 200:
                            continue
                        data = await resp.json()
                        for post in data.get("data", {}).get("children", []):
                            p = post.get("data", {})
                            text = f"{p.get('title', '')} {p.get('selftext', '')}"
                            tickers = re.findall(STOCK_TICKER_PATTERN, text)
                            sent = _quick_sentiment(text)
                            for ticker in tickers:
                                if len(ticker) >= 2 and ticker not in {"THE", "FOR", "AND", "BUT", "NOT", "ARE", "YOU", "ALL", "CAN", "HAS", "HER", "WAS"}:
                                    ticker_counts[ticker] += 1
                                    ticker_sentiments[ticker].append(sent)
                                    if ticker not in ticker_posts:
                                        ticker_posts[ticker] = p.get("title", "")
        except Exception as e:
            logger.warning(f"Trending scan failed: {e}")

    if not ticker_counts:
        # Demo data
        demo_tickers = ["NVDA", "AAPL", "TSLA", "AMD", "SPY", "GME", "PLTR", "AMZN", "META", "MSFT"]
        import random
        for t in demo_tickers:
            ticker_counts[t] = random.randint(5, 200)
            ticker_sentiments[t] = [random.uniform(-0.3, 0.7) for _ in range(5)]
            ticker_posts[t] = f"Discussion about ${t}"

    # Sort by mentions
    sorted_tickers = sorted(ticker_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

    results = []
    for ticker, count in sorted_tickers:
        sents = ticker_sentiments.get(ticker, [0])
        results.append(TrendingTicker(
            symbol=ticker,
            name=ticker,
            mentions=count,
            mention_change=0,
            sentiment=round(statistics.mean(sents), 4),
            price=0,
            price_change_pct=0,
            sources=["reddit"],
            top_comment=ticker_posts.get(ticker, ""),
        ))

    return results


# ── Watchlist Integration ─────────────────────────────────────────────────────

async def create_watchlist_alerts(
    user_id: str,
    watchlist: List[str],
    alert_types: List[AlertType],
    channels: List[DeliveryChannel] = None,
) -> List[Alert]:
    """Create alerts for all symbols in a watchlist"""
    alerts = []
    ch = channels or [DeliveryChannel.IN_APP]

    for symbol in watchlist:
        conditions = []
        for atype in alert_types:
            if atype == AlertType.PRICE_CHANGE_PCT:
                conditions.append(AlertCondition(type=atype, symbol=symbol, value=5))
            elif atype == AlertType.RSI_BELOW:
                conditions.append(AlertCondition(type=atype, symbol=symbol, value=30))
            elif atype == AlertType.RSI_ABOVE:
                conditions.append(AlertCondition(type=atype, symbol=symbol, value=70))
            elif atype == AlertType.VOLUME_SPIKE:
                conditions.append(AlertCondition(type=atype, symbol=symbol, value=3))
            else:
                conditions.append(AlertCondition(type=atype, symbol=symbol, value=0))

        alert = Alert(
            id="",
            user_id=user_id,
            name=f"{symbol} watchlist alerts",
            conditions=conditions,
            logical_operator="OR",
            channels=ch,
            frequency=AlertFrequency.ONCE_PER_HOUR,
        )
        created = _store.create_alert(alert)
        alerts.append(created)

    return alerts


# ── Alert Templates ──────────────────────────────────────────────────────────

ALERT_TEMPLATES = {
    "price_breakout": {
        "name": "Price Breakout Alert",
        "description": "Alert when price breaks a key level",
        "conditions": [
            {"type": "price_crosses_above", "value_required": True},
            {"type": "volume_spike", "value": 2},
        ],
    },
    "momentum_shift": {
        "name": "Momentum Shift",
        "description": "RSI + MACD momentum change",
        "conditions": [
            {"type": "rsi_below", "value": 30},
            {"type": "macd_cross_bull", "value": 0},
        ],
        "logical_operator": "OR",
    },
    "trend_following": {
        "name": "Trend Following",
        "description": "Price above major SMAs with volume confirmation",
        "conditions": [
            {"type": "sma_cross_above", "value": 0},
            {"type": "volume_spike", "value": 1.5},
        ],
    },
    "earnings_play": {
        "name": "Earnings Play",
        "description": "Pre-earnings alerts",
        "conditions": [
            {"type": "earnings_upcoming", "value": 7},
            {"type": "volume_spike", "value": 2},
        ],
        "logical_operator": "OR",
    },
    "volatility_alert": {
        "name": "Volatility Alert",
        "description": "Bollinger Band breakout",
        "conditions": [
            {"type": "bollinger_upper", "value": 0},
            {"type": "bollinger_lower", "value": 0},
        ],
        "logical_operator": "OR",
    },
    "52w_extremes": {
        "name": "52-Week Extremes",
        "description": "New highs or lows",
        "conditions": [
            {"type": "new_52w_high", "value": 0},
            {"type": "new_52w_low", "value": 0},
        ],
        "logical_operator": "OR",
    },
    "gap_alert": {
        "name": "Gap Alert",
        "description": "Significant gap up or down",
        "conditions": [
            {"type": "gap_up", "value": 3},
            {"type": "gap_down", "value": 3},
        ],
        "logical_operator": "OR",
    },
    "overbought_oversold": {
        "name": "Overbought/Oversold",
        "description": "RSI extreme readings",
        "conditions": [
            {"type": "rsi_above", "value": 70},
            {"type": "rsi_below", "value": 30},
        ],
        "logical_operator": "OR",
    },
}


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_alert_router():
    from fastapi import APIRouter, Query, HTTPException, Body
    router = APIRouter(prefix="/api/v4/alerts", tags=["alerts"])

    @router.post("/create")
    async def create_alert(config: Dict[str, Any] = Body(...)):
        conditions = [AlertCondition(
            type=AlertType(c["type"]),
            symbol=c["symbol"],
            value=c.get("value", 0),
        ) for c in config.get("conditions", [])]

        channels = [DeliveryChannel(ch) for ch in config.get("channels", ["in_app"])]

        alert = Alert(
            id="",
            user_id=config.get("user_id", "default"),
            name=config.get("name", "Alert"),
            conditions=conditions,
            logical_operator=config.get("logical_operator", "AND"),
            priority=AlertPriority(config.get("priority", "medium")),
            channels=channels,
            frequency=AlertFrequency(config.get("frequency", "once")),
            message=config.get("message", ""),
            webhook_url=config.get("webhook_url"),
            expires_at=config.get("expires_at"),
            tags=config.get("tags", []),
        )
        created = _store.create_alert(alert)
        return asdict(created)

    @router.get("/list")
    async def list_alerts(
        user_id: str = Query("default"),
        status: Optional[str] = None,
    ):
        st = AlertStatus(status) if status else None
        alerts = _store.list_alerts(user_id, st)
        return {"alerts": [asdict(a) for a in alerts]}

    @router.get("/{alert_id}")
    async def get_alert(alert_id: str):
        alert = _store.get_alert(alert_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return asdict(alert)

    @router.put("/{alert_id}")
    async def update_alert(alert_id: str, updates: Dict[str, Any] = Body(...)):
        alert = _store.update_alert(alert_id, **updates)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return asdict(alert)

    @router.delete("/{alert_id}")
    async def delete_alert(alert_id: str):
        if not _store.delete_alert(alert_id):
            raise HTTPException(404, "Alert not found")
        return {"deleted": True}

    @router.post("/{alert_id}/pause")
    async def pause_alert(alert_id: str):
        alert = _store.update_alert(alert_id, status=AlertStatus.PAUSED)
        if not alert:
            raise HTTPException(404)
        return {"status": "paused"}

    @router.post("/{alert_id}/resume")
    async def resume_alert(alert_id: str):
        alert = _store.update_alert(alert_id, status=AlertStatus.ACTIVE)
        if not alert:
            raise HTTPException(404)
        return {"status": "active"}

    @router.get("/{alert_id}/triggers")
    async def get_triggers(alert_id: str, limit: int = 50):
        triggers = _store.get_triggers(alert_id, limit)
        return {"triggers": [asdict(t) for t in triggers]}

    @router.post("/evaluate")
    async def evaluate_all():
        triggers = await evaluate_all_alerts()
        return {"triggered": [asdict(t) for t in triggers]}

    @router.get("/templates/list")
    async def list_templates():
        return {"templates": ALERT_TEMPLATES}

    @router.post("/from-template")
    async def create_from_template(config: Dict[str, Any] = Body(...)):
        template_name = config.get("template")
        template = ALERT_TEMPLATES.get(template_name)
        if not template:
            raise HTTPException(404, f"Template {template_name} not found")

        symbol = config.get("symbol", "AAPL")
        conditions = [AlertCondition(
            type=AlertType(c["type"]),
            symbol=symbol,
            value=config.get("value", c.get("value", 0)),
        ) for c in template["conditions"]]

        alert = Alert(
            id="",
            user_id=config.get("user_id", "default"),
            name=f"{template['name']} - {symbol}",
            conditions=conditions,
            logical_operator=template.get("logical_operator", "AND"),
            channels=[DeliveryChannel.IN_APP],
            frequency=AlertFrequency.EVERY_TIME,
        )
        created = _store.create_alert(alert)
        return asdict(created)

    @router.post("/watchlist")
    async def create_watchlist_alerts_ep(config: Dict[str, Any] = Body(...)):
        alerts = await create_watchlist_alerts(
            user_id=config.get("user_id", "default"),
            watchlist=config.get("symbols", []),
            alert_types=[AlertType(t) for t in config.get("alert_types", ["price_change_pct"])],
        )
        return {"alerts": [asdict(a) for a in alerts]}

    @router.get("/social/{symbol}")
    async def social_metrics(symbol: str):
        metrics = await get_social_metrics(symbol.upper())
        return asdict(metrics)

    @router.get("/social/{symbol}/mentions")
    async def social_mentions(
        symbol: str,
        limit: int = Query(50),
        period: str = Query("day"),
    ):
        mentions = await fetch_reddit_mentions(symbol.upper(), limit=limit, period=period)
        return {"mentions": [asdict(m) for m in mentions]}

    @router.get("/trending")
    async def trending():
        tickers = await get_trending_tickers()
        return {"trending": [asdict(t) for t in tickers]}

    return router
