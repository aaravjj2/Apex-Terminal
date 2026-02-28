"""
order_flow_engine.py
Dark pool prints, block trade detection, tape analysis,
options flow scoring, and unusual activity alerts.
"""
from __future__ import annotations

import random
import math
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Tuple

# ─── Enums ────────────────────────────────────────────────────────────────────

class TradeType(Enum):
    REGULAR    = "REGULAR"
    BLOCK      = "BLOCK"
    DARK_POOL  = "DARK_POOL"
    SWEEP      = "SWEEP"
    CROSS      = "CROSS"
    AUCTION    = "AUCTION"
    ISO        = "ISO"
    MIDPOINT   = "MIDPOINT"

class TradeSide(Enum):
    BUY         = "BUY"
    SELL        = "SELL"
    NEUTRAL     = "NEUTRAL"
    AUCTION_BUY = "AUCTION_BUY"

class FlowSentiment(Enum):
    VERY_BULLISH = "VERY_BULLISH"
    BULLISH      = "BULLISH"
    NEUTRAL      = "NEUTRAL"
    BEARISH      = "BEARISH"
    VERY_BEARISH = "VERY_BEARISH"

class AlertLevel(Enum):
    INFO    = "INFO"
    WARNING = "WARNING"
    ALERT   = "ALERT"
    UNUSUAL = "UNUSUAL"

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class TapeEntry:
    ticker:         str
    timestamp:      datetime
    price:          float
    size:           int
    dollar_value:   float
    trade_type:     TradeType
    side:           TradeSide
    exchange:       str
    conditions:     List[str] = field(default_factory=list)
    is_dark_pool:   bool = False
    is_block:       bool = False
    aggressor:      str = "unknown"
    sequence:       int = 0

@dataclass
class BlockTrade:
    ticker:         str
    timestamp:      datetime
    price:          float
    size:           int
    dollar_value:   float
    side:           TradeSide
    exchange:       str
    threshold_used: int = 0
    alert_level:    AlertLevel = AlertLevel.INFO
    premium_to_market: float = 0.0
    note:           str = ""

@dataclass
class DarkPoolPrint:
    ticker:         str
    timestamp:      datetime
    price:          float
    size:           int
    dollar_value:   float
    venue:          str
    level_type:     str   # "support" | "resistance" | "neutral"
    significance:  float  # 0-1
    note:           str = ""

@dataclass
class OptionsFlowEntry:
    ticker:         str
    timestamp:      datetime
    expiry:         str
    strike:         float
    option_type:    str   # call/put
    side:           TradeSide
    size:           int
    premium:        float
    total_premium:  float
    spot_at_trade:  float
    delta:          float
    gamma:          float
    iv:             float
    sentiment_score: float
    is_sweep:       bool = False
    is_unusual:     bool = False
    underlying_move_est: float = 0.0
    note:           str = ""

@dataclass
class FlowSummary:
    ticker:           str
    window_minutes:   int
    call_premium:     float
    put_premium:      float
    net_premium:      float
    put_call_ratio:   float
    call_sweeps:      int
    put_sweeps:       int
    unusual_count:    int
    sentiment:        FlowSentiment
    sentiment_score:  float
    dominant_expiry:  str
    dominant_strike:  float
    largest_trade:    Optional[OptionsFlowEntry]

@dataclass
class TapeStatistics:
    ticker:          str
    window_minutes:  int
    total_trades:    int
    buy_volume:      int
    sell_volume:     int
    neutral_volume:  int
    total_volume:    int
    buy_dollar:      float
    sell_dollar:     float
    block_count:     int
    dark_pool_count: int
    dark_pool_vol:   int
    dark_pool_pct:   float
    avg_trade_size:  float
    vwap:            float
    obv_direction:   str
    flow_sentiment:  FlowSentiment

@dataclass
class UnusualActivity:
    ticker:          str
    timestamp:       datetime
    activity_type:   str
    description:     str
    significance:    float
    dollar_amount:   float
    alert_level:     AlertLevel
    metadata:        Dict = field(default_factory=dict)

# ─── Constants ────────────────────────────────────────────────────────────────

DARK_POOL_VENUES = ["FINRA ADF", "IEX", "Liquidnet", "Instinet", "ITG POSIT",
                     "Virtu MatchIt", "Goldman Sigma X", "Morgan Stanley MS POOL",
                     "Barclays LX", "Credit Suisse Crossfinder"]

EXCHANGES = ["NYSE", "NASDAQ", "BATS", "IEX", "EDGX", "ARCA", "PHLX"]

TAPE_CONDITIONS = {
    "F": "Intermarket Sweep",
    "O": "Opening Print",
    "C": "Closing Print",
    "X": "Cross Trade",
    "M": "Midpoint Trade",
    "V": "Average Price",
    ".T": "Extended Hours",
    "I": "Odd Lot",
}

BLOCK_THRESHOLDS: Dict[str, int] = {
    "NVDA": 50_000, "AAPL": 100_000, "MSFT": 75_000, "AMZN": 25_000,
    "META": 30_000, "GOOGL": 15_000, "TSLA": 60_000, "JPM": 40_000,
    "SPY": 200_000, "QQQ": 150_000, "IWM": 80_000, "DEFAULT": 10_000,
}

TICKER_BETAS: Dict[str, float] = {
    "NVDA": 1.85, "AAPL": 1.2, "MSFT": 1.15, "AMZN": 1.35,
    "META": 1.4, "GOOGL": 1.18, "TSLA": 2.1, "JPM": 1.05, "DEFAULT": 1.0,
}

# ─── Engine ───────────────────────────────────────────────────────────────────

class TapeEngine:
    """Processes real-time tape data and computes buy/sell pressure."""

    def __init__(self):
        self._rng = random.Random(42)

    def generate_tape(self, ticker: str, n: int = 200, spot: float = 100.0,
                       minutes: int = 30) -> List[TapeEntry]:
        entries: List[TapeEntry] = []
        now = datetime.utcnow()
        price = spot
        vol_per_min = self._get_typical_vol(ticker)
        for i in range(n):
            dt = now - timedelta(seconds=self._rng.uniform(0, minutes * 60))
            price_move = self._rng.gauss(0, spot * 0.0003)
            price = max(0.01, price + price_move)
            size = self._generate_size(ticker)
            dollar_val = round(price * size, 2)
            t_type, is_dark, is_block = self._classify_trade(ticker, size, dollar_val)
            side = self._determine_side(price_move)
            exchange = "FINRA ADF" if is_dark else self._rng.choice(EXCHANGES)
            conditions = self._generate_conditions(t_type)
            entries.append(TapeEntry(
                ticker=ticker, timestamp=dt, price=round(price, 2),
                size=size, dollar_value=dollar_val, trade_type=t_type,
                side=side, exchange=exchange, conditions=conditions,
                is_dark_pool=is_dark, is_block=is_block,
                aggressor="buy" if side == TradeSide.BUY else "sell",
                sequence=i + 1,
            ))
        return sorted(entries, key=lambda e: e.timestamp, reverse=True)

    def compute_statistics(self, tape: List[TapeEntry], window_minutes: int = 30) -> TapeStatistics:
        if not tape:
            ticker = "UNKNOWN"
            return TapeStatistics(ticker, window_minutes, 0, 0, 0, 0, 0, 0.0, 0.0, 0, 0, 0, 0.0, 0.0, 0.0, "NEUTRAL", FlowSentiment.NEUTRAL)
        ticker = tape[0].ticker
        buy_vol = sell_vol = neutral_vol = 0
        buy_dollar = sell_dollar = 0.0
        blocks = darks = 0
        dp_vol = 0
        prices_sizes = []
        for t in tape:
            if t.side == TradeSide.BUY:
                buy_vol += t.size; buy_dollar += t.dollar_value
            elif t.side == TradeSide.SELL:
                sell_vol += t.size; sell_dollar += t.dollar_value
            else:
                neutral_vol += t.size
            if t.is_block: blocks += 1
            if t.is_dark_pool: darks += 1; dp_vol += t.size
            prices_sizes.append((t.price, t.size))
        total_vol = buy_vol + sell_vol + neutral_vol
        vwap = sum(p * s for p, s in prices_sizes) / max(1, sum(s for _, s in prices_sizes))
        avg_size = total_vol / max(1, len(tape))
        dp_pct = dp_vol / max(1, total_vol) * 100
        buy_pressure = buy_volume = buy_dollar / max(1, buy_dollar + sell_dollar)
        sentiment = self._score_sentiment(buy_pressure)
        obv_dir = "UP" if buy_vol > sell_vol else "DOWN"
        return TapeStatistics(
            ticker=ticker, window_minutes=window_minutes,
            total_trades=len(tape), buy_volume=buy_vol, sell_volume=sell_vol,
            neutral_volume=neutral_vol, total_volume=total_vol,
            buy_dollar=round(buy_dollar, 2), sell_dollar=round(sell_dollar, 2),
            block_count=blocks, dark_pool_count=darks,
            dark_pool_vol=dp_vol, dark_pool_pct=round(dp_pct, 2),
            avg_trade_size=round(avg_size, 1), vwap=round(vwap, 4),
            obv_direction=obv_dir, flow_sentiment=sentiment,
        )

    def _get_typical_vol(self, ticker: str) -> float:
        return self._rng.uniform(0.008, 0.020)

    def _generate_size(self, ticker: str) -> int:
        r = self._rng.random()
        if r < 0.002: return self._rng.randint(200_000, 2_000_000)
        if r < 0.02:  return self._rng.randint(10_000, 200_000)
        if r < 0.15:  return self._rng.randint(1_000, 10_000)
        return self._rng.randint(100, 1000)

    def _classify_trade(self, ticker: str, size: int, dv: float) -> Tuple[TradeType, bool, bool]:
        threshold = BLOCK_THRESHOLDS.get(ticker, BLOCK_THRESHOLDS["DEFAULT"])
        is_block = size >= threshold or dv >= 5_000_000
        is_dark = self._rng.random() < 0.35  # ~35% of volume in dark pools
        if is_dark:
            t_type = TradeType.DARK_POOL if is_block else TradeType.MIDPOINT
        elif is_block:
            t_type = TradeType.BLOCK
        elif self._rng.random() < 0.05:
            t_type = TradeType.SWEEP
        else:
            t_type = TradeType.REGULAR
        return t_type, is_dark, is_block

    def _determine_side(self, price_move: float) -> TradeSide:
        if price_move > 0.02: return TradeSide.BUY
        if price_move < -0.02: return TradeSide.SELL
        return TradeSide.BUY if self._rng.random() < 0.5 else TradeSide.SELL

    def _generate_conditions(self, t_type: TradeType) -> List[str]:
        conds = []
        if t_type == TradeType.SWEEP: conds.append("F")
        if t_type == TradeType.CROSS: conds.append("X")
        if t_type == TradeType.MIDPOINT: conds.append("M")
        if self._rng.random() < 0.05: conds.append("I")
        return conds

    def _score_sentiment(self, buy_pressure: float) -> FlowSentiment:
        if buy_pressure > 0.75: return FlowSentiment.VERY_BULLISH
        if buy_pressure > 0.60: return FlowSentiment.BULLISH
        if buy_pressure < 0.25: return FlowSentiment.VERY_BEARISH
        if buy_pressure < 0.40: return FlowSentiment.BEARISH
        return FlowSentiment.NEUTRAL


class BlockTradeDetector:
    """Detects and analyzes block trades with premium measurement."""

    def __init__(self):
        self._rng = random.Random(99)

    def detect_blocks(self, ticker: str, n: int = 20, spot: float = 100.0) -> List[BlockTrade]:
        blocks: List[BlockTrade] = []
        now = datetime.utcnow()
        threshold = BLOCK_THRESHOLDS.get(ticker, BLOCK_THRESHOLDS["DEFAULT"])
        for _ in range(n):
            size = self._rng.randint(threshold, threshold * 20)
            price = spot * self._rng.uniform(0.999, 1.001)
            dollar = price * size
            side = TradeSide.BUY if self._rng.random() < 0.52 else TradeSide.SELL
            premium = (price - spot) / spot * 100 if side == TradeSide.BUY else (spot - price) / spot * 100
            alert = AlertLevel.UNUSUAL if dollar > 50_000_000 else (AlertLevel.ALERT if dollar > 10_000_000 else AlertLevel.INFO)
            note = f"${dollar/1e6:.1f}M {side.value} block, {abs(premium):.3f}% {'premium' if premium >= 0 else 'discount'}"
            blocks.append(BlockTrade(
                ticker=ticker,
                timestamp=now - timedelta(seconds=self._rng.uniform(0, 3600)),
                price=round(price, 3),
                size=size,
                dollar_value=round(dollar, 2),
                side=side,
                exchange=self._rng.choice(EXCHANGES),
                threshold_used=threshold,
                alert_level=alert,
                premium_to_market=round(premium, 4),
                note=note,
            ))
        return sorted(blocks, key=lambda b: b.dollar_value, reverse=True)

    def get_block_imbalance(self, blocks: List[BlockTrade]) -> Dict:
        buy_dv = sum(b.dollar_value for b in blocks if b.side == TradeSide.BUY)
        sell_dv = sum(b.dollar_value for b in blocks if b.side == TradeSide.SELL)
        total = buy_dv + sell_dv
        return {
            "buy_dollar": round(buy_dv, 2), "sell_dollar": round(sell_dv, 2),
            "net_dollar": round(buy_dv - sell_dv, 2),
            "buy_pct": round(buy_dv / max(1, total) * 100, 1),
            "sell_pct": round(sell_dv / max(1, total) * 100, 1),
            "sentiment": "BULLISH" if buy_dv > sell_dv else "BEARISH",
        }


class DarkPoolTracker:
    """Tracks dark pool prints and identifies significant price levels."""

    def __init__(self):
        self._rng = random.Random(77)

    def get_prints(self, ticker: str, n: int = 30, spot: float = 100.0) -> List[DarkPoolPrint]:
        prints: List[DarkPoolPrint] = []
        now = datetime.utcnow()
        for _ in range(n):
            price = spot * self._rng.uniform(0.97, 1.03)
            size = self._rng.randint(5000, 500000)
            dollar = price * size
            deviation = abs(price - spot) / spot
            sig = min(1.0, deviation * 20 + (math.log10(dollar) - 6) * 0.3)
            level_type = "neutral"
            if price < spot * 0.995:
                level_type = "support"
            elif price > spot * 1.005:
                level_type = "resistance"
            prints.append(DarkPoolPrint(
                ticker=ticker,
                timestamp=now - timedelta(seconds=self._rng.uniform(0, 7200)),
                price=round(price, 2),
                size=size,
                dollar_value=round(dollar, 2),
                venue=self._rng.choice(DARK_POOL_VENUES),
                level_type=level_type,
                significance=round(max(0, sig), 3),
                note=f"${dollar/1e6:.2f}M @ {price:.2f} ({level_type})",
            ))
        return sorted(prints, key=lambda p: p.significance, reverse=True)

    def get_key_levels(self, prints: List[DarkPoolPrint], spot: float) -> Dict:
        support_prints = [p for p in prints if p.level_type == "support"]
        resistance_prints = [p for p in prints if p.level_type == "resistance"]
        support_lvl = sum(p.price * p.dollar_value for p in support_prints) / max(1, sum(p.dollar_value for p in support_prints)) if support_prints else None
        resistance_lvl = sum(p.price * p.dollar_value for p in resistance_prints) / max(1, sum(p.dollar_value for p in resistance_prints)) if resistance_prints else None
        return {
            "support": round(support_lvl, 2) if support_lvl else None,
            "resistance": round(resistance_lvl, 2) if resistance_lvl else None,
            "spot": spot,
            "dp_volume_total": sum(p.size for p in prints),
            "support_count": len(support_prints),
            "resistance_count": len(resistance_prints),
        }


class OptionsFlowScanner:
    """Scans options tape for unusual activity and bullish/bearish flow."""

    def __init__(self):
        self._rng = random.Random(55)

    def scan_flow(self, ticker: str, n: int = 50, spot: float = 100.0) -> List[OptionsFlowEntry]:
        flows: List[OptionsFlowEntry] = []
        now = datetime.utcnow()
        expiries = ["2025-07-18", "2025-08-15", "2025-09-19", "2025-12-19", "2026-01-16"]
        for _ in range(n):
            exp = self._rng.choice(expiries)
            strike_bump = self._rng.choice([-15, -10, -5, 0, 5, 10, 15, 20, 25])
            strike = round(spot + strike_bump, 0)
            opt_type = "call" if self._rng.random() < 0.58 else "put"
            size = self._rng.randint(1, 2000)
            iv = self._rng.uniform(0.20, 0.70)
            price_per_contract = spot * iv * self._rng.uniform(0.02, 0.15)
            total_prem = price_per_contract * size * 100
            side = TradeSide.BUY if self._rng.random() < 0.55 else TradeSide.SELL
            is_sweep = self._rng.random() < 0.10
            delta = self._rng.uniform(0.15, 0.85) if opt_type == "call" else self._rng.uniform(-0.85, -0.15)
            gamma = self._rng.uniform(0.003, 0.040)
            sentiment_score = (self._calc_sentiment(opt_type, side, total_prem, size))
            is_unusual = size > 500 and total_prem > 100_000
            T_approx = self._rng.uniform(0.1, 1.0)
            underlying_move = iv / math.sqrt(252 / (T_approx * 252)) * 100
            flows.append(OptionsFlowEntry(
                ticker=ticker, timestamp=now - timedelta(seconds=self._rng.uniform(0, 3600)),
                expiry=exp, strike=strike, option_type=opt_type, side=side,
                size=size, premium=round(price_per_contract, 4),
                total_premium=round(total_prem, 2), spot_at_trade=round(spot, 2),
                delta=round(delta, 3), gamma=round(gamma, 5), iv=round(iv, 4),
                sentiment_score=round(sentiment_score, 3), is_sweep=is_sweep,
                is_unusual=is_unusual, underlying_move_est=round(underlying_move, 2),
            ))
        return sorted(flows, key=lambda f: f.total_premium, reverse=True)

    def summarize_flow(self, flows: List[OptionsFlowEntry], ticker: str, window_minutes: int = 60) -> FlowSummary:
        call_flows = [f for f in flows if f.option_type == "call"]
        put_flows = [f for f in flows if f.option_type == "put"]
        call_prem = sum(f.total_premium for f in call_flows if f.side == TradeSide.BUY)
        put_prem = sum(f.total_premium for f in put_flows if f.side == TradeSide.BUY)
        net_prem = call_prem - put_prem
        pcr = put_prem / max(1, call_prem)
        call_sweeps = sum(1 for f in call_flows if f.is_sweep)
        put_sweeps = sum(1 for f in put_flows if f.is_sweep)
        unusual = [f for f in flows if f.is_unusual]
        avg_score = sum(f.sentiment_score for f in flows) / max(1, len(flows))
        sentiment = self._flow_sentiment(avg_score)
        dom_exp = max(flows, key=lambda f: f.total_premium).expiry if flows else ""
        dom_strike = max(flows, key=lambda f: f.total_premium).strike if flows else 0.0
        largest = max(flows, key=lambda f: f.total_premium) if flows else None
        return FlowSummary(
            ticker=ticker, window_minutes=window_minutes,
            call_premium=round(call_prem, 2), put_premium=round(put_prem, 2),
            net_premium=round(net_prem, 2), put_call_ratio=round(pcr, 3),
            call_sweeps=call_sweeps, put_sweeps=put_sweeps,
            unusual_count=len(unusual), sentiment=sentiment,
            sentiment_score=round(avg_score, 3), dominant_expiry=dom_exp,
            dominant_strike=dom_strike, largest_trade=largest,
        )

    def _calc_sentiment(self, opt_type: str, side: TradeSide, total: float, size: int) -> float:
        base = 1.0 if (opt_type == "call" and side == TradeSide.BUY) or (opt_type == "put" and side == TradeSide.SELL) else -1.0
        magnitude = min(1.0, math.log10(max(1, total)) / 6)
        return base * magnitude

    def _flow_sentiment(self, score: float) -> FlowSentiment:
        if score > 0.5: return FlowSentiment.VERY_BULLISH
        if score > 0.1: return FlowSentiment.BULLISH
        if score < -0.5: return FlowSentiment.VERY_BEARISH
        if score < -0.1: return FlowSentiment.BEARISH
        return FlowSentiment.NEUTRAL


class UnusualActivityMonitor:
    """Monitors and ranks unusual activity alerts across tickers."""

    def __init__(self):
        self._rng = random.Random(33)
        self._tape_engine = TapeEngine()
        self._block_detector = BlockTradeDetector()
        self._options_scanner = OptionsFlowScanner()

    def scan_ticker(self, ticker: str, spot: float = 100.0) -> List[UnusualActivity]:
        alerts: List[UnusualActivity] = []
        now = datetime.utcnow()
        tape = self._tape_engine.generate_tape(ticker, n=100, spot=spot)
        stats = self._tape_engine.compute_statistics(tape)
        blocks = self._block_detector.detect_blocks(ticker, n=5, spot=spot)
        options_flow = self._options_scanner.scan_flow(ticker, n=30, spot=spot)
        flow_summary = self._options_scanner.summarize_flow(options_flow, ticker)

        # Dark pool imbalance alert
        if stats.dark_pool_pct > 50:
            alerts.append(UnusualActivity(
                ticker=ticker, timestamp=now,
                activity_type="DARK_POOL_SURGE",
                description=f"Dark pool volume {stats.dark_pool_pct:.1f}% of total (above 50% threshold)",
                significance=min(1.0, stats.dark_pool_pct / 80),
                dollar_amount=stats.buy_dollar + stats.sell_dollar,
                alert_level=AlertLevel.UNUSUAL,
                metadata={"dark_pool_pct": stats.dark_pool_pct, "dark_vol": stats.dark_pool_vol},
            ))

        # Large block trade alert
        largest_block = max((b for b in blocks), key=lambda b: b.dollar_value, default=None)
        if largest_block and largest_block.dollar_value > 10_000_000:
            alerts.append(UnusualActivity(
                ticker=ticker, timestamp=now,
                activity_type="MEGA_BLOCK",
                description=f"${largest_block.dollar_value/1e6:.1f}M {largest_block.side.value} block trade detected",
                significance=min(1.0, largest_block.dollar_value / 100_000_000),
                dollar_amount=largest_block.dollar_value,
                alert_level=largest_block.alert_level,
                metadata={"price": largest_block.price, "size": largest_block.size, "side": largest_block.side.value},
            ))

        # Unusual options flow
        if flow_summary.unusual_count > 5:
            alerts.append(UnusualActivity(
                ticker=ticker, timestamp=now,
                activity_type="OPTIONS_FLOW_SURGE",
                description=f"{flow_summary.unusual_count} unusual options trades; net premium ${flow_summary.net_premium/1e3:.0f}K ({flow_summary.sentiment.value})",
                significance=min(1.0, flow_summary.unusual_count / 20),
                dollar_amount=flow_summary.call_premium + flow_summary.put_premium,
                alert_level=AlertLevel.UNUSUAL,
                metadata={"sentiment": flow_summary.sentiment.value, "pcr": flow_summary.put_call_ratio,
                          "call_sweeps": flow_summary.call_sweeps, "put_sweeps": flow_summary.put_sweeps},
            ))

        # Buy/sell imbalance
        total = stats.buy_dollar + stats.sell_dollar
        if total > 0:
            buy_pct = stats.buy_dollar / total
            if buy_pct > 0.75 or buy_pct < 0.25:
                side_str = "BUY" if buy_pct > 0.5 else "SELL"
                alerts.append(UnusualActivity(
                    ticker=ticker, timestamp=now,
                    activity_type="FLOW_IMBALANCE",
                    description=f"Extreme {side_str} imbalance: {buy_pct*100:.0f}% buy pressure",
                    significance=abs(buy_pct - 0.5) * 2,
                    dollar_amount=total,
                    alert_level=AlertLevel.ALERT,
                    metadata={"buy_pct": round(buy_pct*100, 1), "flow_sentiment": stats.flow_sentiment.value},
                ))

        return sorted(alerts, key=lambda a: a.significance, reverse=True)

    def scan_watchlist(self, tickers: List[str], spots: Optional[Dict[str, float]] = None) -> List[UnusualActivity]:
        all_alerts = []
        for ticker in tickers:
            spot = (spots or {}).get(ticker, 100.0)
            all_alerts.extend(self.scan_ticker(ticker, spot))
        return sorted(all_alerts, key=lambda a: a.significance, reverse=True)


# ─── Module-level helpers ─────────────────────────────────────────────────────

_tape_engine = TapeEngine()
_block_detector = BlockTradeDetector()
_dp_tracker = DarkPoolTracker()
_options_scanner = OptionsFlowScanner()
_unusual_monitor = UnusualActivityMonitor()


def get_tape(ticker: str, n: int = 200, spot: float = 100.0) -> List[TapeEntry]:
    return _tape_engine.generate_tape(ticker, n=n, spot=spot)


def get_tape_stats(ticker: str, n: int = 200, spot: float = 100.0) -> TapeStatistics:
    tape = _tape_engine.generate_tape(ticker, n=n, spot=spot)
    return _tape_engine.compute_statistics(tape)


def get_blocks(ticker: str, n: int = 20, spot: float = 100.0) -> List[BlockTrade]:
    return _block_detector.detect_blocks(ticker, n=n, spot=spot)


def get_dark_pool_prints(ticker: str, n: int = 30, spot: float = 100.0) -> List[DarkPoolPrint]:
    return _dp_tracker.get_prints(ticker, n=n, spot=spot)


def get_options_flow(ticker: str, n: int = 50, spot: float = 100.0) -> FlowSummary:
    flows = _options_scanner.scan_flow(ticker, n=n, spot=spot)
    return _options_scanner.summarize_flow(flows, ticker)


def get_unusual_activity(ticker: str, spot: float = 100.0) -> List[UnusualActivity]:
    return _unusual_monitor.scan_ticker(ticker, spot=spot)
