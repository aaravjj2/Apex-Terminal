"""
Market Breadth Engine — Comprehensive market-wide breadth indicators and internals analysis.

Covers:
  - Advance/Decline line and ratio
  - New Highs/New Lows (52-week)
  - McClellan Oscillator and Summation Index
  - Arms Index (TRIN)
  - Percentage of stocks above moving averages (20/50/100/200 SMA)
  - Breadth thrust indicator
  - Up/Down volume ratio
  - Sector rotation analysis
  - Market regime classification from breadth
  - Cumulative breadth indicators
  - Zweig Breadth Thrust
  - Hindenburg Omen detection
  - Stocks above/below Bollinger Bands
  - Force Index breadth
  - Tick index analysis
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ── Enums ───────────────────────────────────────────────────────────────

class MarketRegime(Enum):
    STRONG_BULL = "strong_bull"
    BULL = "bull"
    NEUTRAL = "neutral"
    BEAR = "bear"
    STRONG_BEAR = "strong_bear"


class BreadthSignal(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    DIVERGENCE_BULLISH = "divergence_bullish"
    DIVERGENCE_BEARISH = "divergence_bearish"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class DailyBreadthData:
    """Single day of market breadth data."""
    date: str
    advances: int
    declines: int
    unchanged: int = 0
    new_highs: int = 0
    new_lows: int = 0
    up_volume: float = 0.0
    down_volume: float = 0.0
    total_issues: int = 0

    @property
    def ad_difference(self) -> int:
        return self.advances - self.declines

    @property
    def ad_ratio(self) -> float:
        return self.advances / self.declines if self.declines > 0 else float("inf")

    @property
    def nh_nl_difference(self) -> int:
        return self.new_highs - self.new_lows

    @property
    def volume_ratio(self) -> float:
        return self.up_volume / self.down_volume if self.down_volume > 0 else float("inf")

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "advances": self.advances,
            "declines": self.declines,
            "unchanged": self.unchanged,
            "ad_difference": self.ad_difference,
            "ad_ratio": round(self.ad_ratio, 4) if self.ad_ratio != float("inf") else "inf",
            "new_highs": self.new_highs,
            "new_lows": self.new_lows,
            "nh_nl_difference": self.nh_nl_difference,
            "up_volume": self.up_volume,
            "down_volume": self.down_volume,
            "volume_ratio": round(self.volume_ratio, 4) if self.volume_ratio != float("inf") else "inf",
        }


@dataclass
class StockAboveMASummary:
    """Summary of stocks above various moving averages."""
    total_stocks: int
    above_20sma: int = 0
    above_50sma: int = 0
    above_100sma: int = 0
    above_200sma: int = 0

    @property
    def pct_above_20sma(self) -> float:
        return (self.above_20sma / self.total_stocks * 100) if self.total_stocks > 0 else 0.0

    @property
    def pct_above_50sma(self) -> float:
        return (self.above_50sma / self.total_stocks * 100) if self.total_stocks > 0 else 0.0

    @property
    def pct_above_100sma(self) -> float:
        return (self.above_100sma / self.total_stocks * 100) if self.total_stocks > 0 else 0.0

    @property
    def pct_above_200sma(self) -> float:
        return (self.above_200sma / self.total_stocks * 100) if self.total_stocks > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "total_stocks": self.total_stocks,
            "above_20sma": self.above_20sma,
            "above_50sma": self.above_50sma,
            "above_100sma": self.above_100sma,
            "above_200sma": self.above_200sma,
            "pct_above_20sma": round(self.pct_above_20sma, 2),
            "pct_above_50sma": round(self.pct_above_50sma, 2),
            "pct_above_100sma": round(self.pct_above_100sma, 2),
            "pct_above_200sma": round(self.pct_above_200sma, 2),
        }


# ── Advance/Decline Calculator ─────────────────────────────────────────

class AdvanceDeclineCalculator:
    """Advance/Decline line and related indicators."""

    @staticmethod
    def ad_line(data: list[DailyBreadthData]) -> list[dict]:
        """Cumulative Advance-Decline line."""
        result = []
        cumulative = 0
        for d in data:
            cumulative += d.ad_difference
            result.append({"date": d.date, "ad_line": cumulative, "ad_diff": d.ad_difference})
        return result

    @staticmethod
    def ad_ratio_series(data: list[DailyBreadthData]) -> list[dict]:
        """Daily A/D ratio series."""
        return [
            {"date": d.date, "ad_ratio": round(d.ad_ratio, 4) if d.ad_ratio != float("inf") else None}
            for d in data
        ]

    @staticmethod
    def ad_breadth_pct(data: list[DailyBreadthData]) -> list[dict]:
        """Advance % = advances / (advances + declines + unchanged)."""
        result = []
        for d in data:
            total = d.advances + d.declines + d.unchanged
            adv_pct = (d.advances / total * 100) if total > 0 else 50.0
            result.append({"date": d.date, "advance_pct": round(adv_pct, 2)})
        return result

    @staticmethod
    def cumulative_ad_volume(data: list[DailyBreadthData]) -> list[dict]:
        """Cumulative Up Volume - Down Volume."""
        result = []
        cumulative = 0.0
        for d in data:
            cumulative += d.up_volume - d.down_volume
            result.append({"date": d.date, "cumulative_vol_diff": round(cumulative, 2)})
        return result


# ── McClellan Oscillator ────────────────────────────────────────────────

class McCllellanCalculator:
    """McClellan Oscillator and Summation Index."""

    @staticmethod
    def _ema(values: list[float], period: int) -> list[float]:
        """Simple EMA calculation."""
        if not values or period <= 0:
            return []
        k = 2.0 / (period + 1)
        result = [values[0]]
        for i in range(1, len(values)):
            result.append(values[i] * k + result[-1] * (1 - k))
        return result

    def oscillator(self, data: list[DailyBreadthData]) -> list[dict]:
        """
        McClellan Oscillator = 19-day EMA of (A-D) - 39-day EMA of (A-D).
        Actually uses ratio-adjusted net advances.
        """
        if len(data) < 2:
            return []

        # Net advances ratio-adjusted
        net_advances = []
        for d in data:
            total = d.advances + d.declines
            if total > 0:
                ratio_adj = (d.advances - d.declines) / total * 1000
            else:
                ratio_adj = 0.0
            net_advances.append(ratio_adj)

        ema19 = self._ema(net_advances, 19)
        ema39 = self._ema(net_advances, 39)

        result = []
        for i, d in enumerate(data):
            osc = ema19[i] - ema39[i]
            result.append({
                "date": d.date,
                "oscillator": round(osc, 4),
                "ema19": round(ema19[i], 4),
                "ema39": round(ema39[i], 4),
            })
        return result

    def summation_index(self, data: list[DailyBreadthData]) -> list[dict]:
        """McClellan Summation Index = cumulative sum of McClellan Oscillator."""
        osc_data = self.oscillator(data)
        if not osc_data:
            return []
        result = []
        cumulative = 0.0
        for pt in osc_data:
            cumulative += pt["oscillator"]
            result.append({
                "date": pt["date"],
                "summation_index": round(cumulative, 4),
                "oscillator": pt["oscillator"],
            })
        return result


# ── Arms Index (TRIN) ──────────────────────────────────────────────────

class ArmsIndexCalculator:
    """TRIN (Trading Index / Arms Index)."""

    @staticmethod
    def trin(data: list[DailyBreadthData]) -> list[dict]:
        """
        TRIN = (Advances / Declines) / (Up Volume / Down Volume).
        TRIN < 1 = bullish, TRIN > 1 = bearish.
        """
        result = []
        for d in data:
            ad_ratio = d.advances / d.declines if d.declines > 0 else float("inf")
            vol_ratio = d.up_volume / d.down_volume if d.down_volume > 0 else float("inf")
            if vol_ratio == float("inf") or vol_ratio == 0:
                trin_val = None
            else:
                trin_val = round(ad_ratio / vol_ratio, 4) if ad_ratio != float("inf") else None
            signal = "neutral"
            if trin_val is not None:
                if trin_val < 0.8:
                    signal = "strongly_bullish"
                elif trin_val < 1.0:
                    signal = "bullish"
                elif trin_val > 1.2:
                    signal = "strongly_bearish"
                elif trin_val > 1.0:
                    signal = "bearish"
            result.append({"date": d.date, "trin": trin_val, "signal": signal})
        return result

    @staticmethod
    def moving_average_trin(data: list[DailyBreadthData], period: int = 10) -> list[dict]:
        """Smoothed TRIN over a period."""
        trin_raw = ArmsIndexCalculator.trin(data)
        result = []
        for i in range(len(trin_raw)):
            window = [t["trin"] for t in trin_raw[max(0, i - period + 1):i + 1] if t["trin"] is not None]
            avg = statistics.mean(window) if window else None
            result.append({
                "date": trin_raw[i]["date"],
                "trin": trin_raw[i]["trin"],
                "trin_ma": round(avg, 4) if avg is not None else None,
            })
        return result


# ── New Highs / New Lows ───────────────────────────────────────────────

class NewHighLowCalculator:
    """52-week new highs and new lows analysis."""

    @staticmethod
    def nh_nl_line(data: list[DailyBreadthData]) -> list[dict]:
        """Cumulative New Highs - New Lows."""
        result = []
        cumulative = 0
        for d in data:
            cumulative += d.nh_nl_difference
            result.append({"date": d.date, "nh_nl_line": cumulative, "nh_nl_diff": d.nh_nl_difference})
        return result

    @staticmethod
    def nh_nl_ratio(data: list[DailyBreadthData]) -> list[dict]:
        """New Highs / (New Highs + New Lows) percentage."""
        result = []
        for d in data:
            total = d.new_highs + d.new_lows
            pct = (d.new_highs / total * 100) if total > 0 else 50.0
            result.append({"date": d.date, "nh_pct": round(pct, 2)})
        return result

    @staticmethod
    def nh_nl_moving_avg(data: list[DailyBreadthData], period: int = 10) -> list[dict]:
        """Smoothed NH-NL difference."""
        diffs = [d.nh_nl_difference for d in data]
        result = []
        for i in range(len(diffs)):
            window = diffs[max(0, i - period + 1):i + 1]
            avg = statistics.mean(window)
            result.append({
                "date": data[i].date,
                "nh_nl_diff": diffs[i],
                "nh_nl_ma": round(avg, 2),
            })
        return result


# ── Breadth Thrust ──────────────────────────────────────────────────────

class BreadthThrustCalculator:
    """Breadth thrust and Zweig Breadth Thrust indicators."""

    @staticmethod
    def breadth_thrust(data: list[DailyBreadthData], period: int = 10) -> list[dict]:
        """
        Breadth Thrust = EMA of (Advances / (Advances + Declines)).
        Thrust signal when it moves from below 0.40 to above 0.615 within 10 days.
        """
        if not data:
            return []
        ratios = []
        for d in data:
            total = d.advances + d.declines
            ratio = d.advances / total if total > 0 else 0.5
            ratios.append(ratio)

        # EMA
        k = 2.0 / (period + 1)
        ema = [ratios[0]]
        for i in range(1, len(ratios)):
            ema.append(ratios[i] * k + ema[-1] * (1 - k))

        result = []
        for i, d in enumerate(data):
            thrust_signal = False
            if i >= period:
                # Check if EMA went from below 0.40 to above 0.615 within `period` days
                window = ema[max(0, i - period):i + 1]
                has_low = any(v < 0.40 for v in window)
                has_high = ema[i] > 0.615
                thrust_signal = has_low and has_high
            result.append({
                "date": d.date,
                "breadth_ratio": round(ratios[i], 4),
                "ema": round(ema[i], 4),
                "thrust_signal": thrust_signal,
            })
        return result

    @staticmethod
    def zweig_breadth_thrust(data: list[DailyBreadthData]) -> dict:
        """
        Zweig Breadth Thrust: Advance/(Advance+Decline) 10-day EMA
        goes from below 0.40 to above 0.615 in 10 trading days.
        Very rare — strong buy signal.
        """
        if len(data) < 11:
            return {"signal": False, "insufficient_data": True}

        ratios = []
        for d in data:
            total = d.advances + d.declines
            ratios.append(d.advances / total if total > 0 else 0.5)

        k = 2.0 / 11  # 10-period EMA
        ema = [ratios[0]]
        for i in range(1, len(ratios)):
            ema.append(ratios[i] * k + ema[-1] * (1 - k))

        # Find most recent thrust
        for i in range(len(ema) - 1, 9, -1):
            if ema[i] > 0.615:
                # Check if EMA was below 0.40 within last 10 days
                window = ema[max(0, i - 10):i]
                if any(v < 0.40 for v in window):
                    return {
                        "signal": True,
                        "signal_date": data[i].date,
                        "ema_value": round(ema[i], 4),
                        "description": "Zweig Breadth Thrust — extremely bullish",
                    }

        return {"signal": False, "current_ema": round(ema[-1], 4)}


# ── Hindenburg Omen ────────────────────────────────────────────────────

class HindenburgOmenDetector:
    """
    Hindenburg Omen — bearish signal.
    Criteria (simplified):
      1. Both new 52-week highs and lows > 2.8% of total issues
      2. NYSE index in uptrend (10-week SMA rising)
      3. McClellan Oscillator negative
    """

    @staticmethod
    def detect(data: list[DailyBreadthData], index_values: list[float] | None = None) -> list[dict]:
        """
        Check each day for Hindenburg Omen conditions.
        index_values: list of market index closes aligned with data.
        """
        mcclel = McCllellanCalculator()
        osc_data = mcclel.oscillator(data)

        result = []
        for i, d in enumerate(data):
            total = d.total_issues if d.total_issues > 0 else (d.advances + d.declines + d.unchanged)
            if total == 0:
                total = 1  # avoid division by zero

            nh_pct = d.new_highs / total * 100
            nl_pct = d.new_lows / total * 100

            crit1 = nh_pct > 2.8 and nl_pct > 2.8
            crit2 = True  # assume uptrend if no index provided
            if index_values and i >= 50:
                ma50 = statistics.mean(index_values[i - 49:i + 1])
                crit2 = index_values[i] > ma50

            crit3 = False
            if i < len(osc_data):
                crit3 = osc_data[i]["oscillator"] < 0

            is_omen = crit1 and crit2 and crit3

            result.append({
                "date": d.date,
                "hindenburg_omen": is_omen,
                "nh_pct": round(nh_pct, 2),
                "nl_pct": round(nl_pct, 2),
                "criteria_1_met": crit1,
                "criteria_2_met": crit2,
                "criteria_3_met": crit3,
            })
        return result


# ── Percent Above MA (from stock data) ─────────────────────────────────

class PercentAboveMACalculator:
    """Calculate percentage of stocks above various moving averages."""

    @staticmethod
    def calculate(stock_prices: dict[str, list[float]], ma_period: int = 50) -> dict:
        """
        stock_prices: {symbol: [close_prices...]} — needs at least ma_period prices.
        Returns summary of how many stocks are above their MA.
        """
        total = 0
        above = 0
        details = []

        for symbol, prices in stock_prices.items():
            if len(prices) < ma_period:
                continue
            total += 1
            ma = statistics.mean(prices[-ma_period:])
            current = prices[-1]
            is_above = current > ma
            if is_above:
                above += 1
            details.append({
                "symbol": symbol,
                "price": round(current, 2),
                "ma": round(ma, 2),
                "above": is_above,
                "pct_from_ma": round((current - ma) / ma * 100, 2)
            })

        return {
            "total_stocks": total,
            "above_ma": above,
            "below_ma": total - above,
            "pct_above": round(above / total * 100, 2) if total > 0 else 0.0,
            "ma_period": ma_period,
            "details": details,
        }

    @staticmethod
    def multi_ma_summary(stock_prices: dict[str, list[float]]) -> StockAboveMASummary:
        """Calculate for all standard MA periods."""
        total = len(stock_prices)
        counts = {20: 0, 50: 0, 100: 0, 200: 0}

        for symbol, prices in stock_prices.items():
            for period in counts:
                if len(prices) >= period:
                    ma = statistics.mean(prices[-period:])
                    if prices[-1] > ma:
                        counts[period] += 1

        return StockAboveMASummary(
            total_stocks=total,
            above_20sma=counts[20],
            above_50sma=counts[50],
            above_100sma=counts[100],
            above_200sma=counts[200],
        )


# ── Volume Breadth ─────────────────────────────────────────────────────

class VolumeBreadthCalculator:
    """Volume-based breadth indicators."""

    @staticmethod
    def up_down_volume_ratio(data: list[DailyBreadthData]) -> list[dict]:
        """Daily Up/Down volume ratio series."""
        return [
            {
                "date": d.date,
                "ratio": round(d.volume_ratio, 4) if d.volume_ratio != float("inf") else None,
                "net_volume": round(d.up_volume - d.down_volume, 2),
            }
            for d in data
        ]

    @staticmethod
    def cumulative_volume_line(data: list[DailyBreadthData]) -> list[dict]:
        """Cumulative net volume (up - down)."""
        result = []
        cum = 0.0
        for d in data:
            cum += d.up_volume - d.down_volume
            result.append({"date": d.date, "cumulative_net_vol": round(cum, 2)})
        return result

    @staticmethod
    def volume_thrust(data: list[DailyBreadthData], threshold: float = 9.0) -> list[dict]:
        """
        Volume thrust: Up Volume / Down Volume > threshold (e.g., 9:1).
        Strong bullish signal when it occurs.
        """
        result = []
        for d in data:
            ratio = d.volume_ratio
            is_thrust = False
            if ratio != float("inf"):
                is_thrust = ratio >= threshold
            elif d.up_volume > 0 and d.down_volume == 0:
                is_thrust = True  # infinite ratio = definitely thrust
            result.append({
                "date": d.date,
                "up_down_ratio": round(ratio, 4) if ratio != float("inf") else None,
                "volume_thrust": is_thrust,
            })
        return result


# ── Sector Rotation ────────────────────────────────────────────────────

class SectorRotationAnalyzer:
    """Analyze sector rotation for market regime insights."""

    DEFENSIVE_SECTORS = {"utilities", "consumer_staples", "healthcare", "real_estate"}
    CYCLICAL_SECTORS = {"technology", "consumer_discretionary", "industrials", "financials", "materials", "energy"}

    @staticmethod
    def rotation_score(sector_returns: dict[str, float]) -> dict:
        """
        Score sector rotation: positive = risk-on, negative = risk-off.
        sector_returns: {sector_name: return_pct}
        """
        defensive_rets = []
        cyclical_rets = []

        for sector, ret in sector_returns.items():
            sector_lower = sector.lower().replace(" ", "_")
            if sector_lower in SectorRotationAnalyzer.DEFENSIVE_SECTORS:
                defensive_rets.append(ret)
            elif sector_lower in SectorRotationAnalyzer.CYCLICAL_SECTORS:
                cyclical_rets.append(ret)

        avg_defensive = statistics.mean(defensive_rets) if defensive_rets else 0.0
        avg_cyclical = statistics.mean(cyclical_rets) if cyclical_rets else 0.0

        score = avg_cyclical - avg_defensive  # positive = risk-on
        regime = "risk_on" if score > 0.5 else "risk_off" if score < -0.5 else "neutral"

        return {
            "rotation_score": round(score, 4),
            "regime": regime,
            "avg_defensive": round(avg_defensive, 4),
            "avg_cyclical": round(avg_cyclical, 4),
            "spread": round(avg_cyclical - avg_defensive, 4),
        }

    @staticmethod
    def relative_strength(sector_returns: dict[str, float]) -> list[dict]:
        """Rank sectors by relative strength."""
        if not sector_returns:
            return []
        avg_return = statistics.mean(sector_returns.values())
        ranked = sorted(
            [
                {
                    "sector": sector,
                    "return": round(ret, 4),
                    "relative_strength": round(ret - avg_return, 4),
                }
                for sector, ret in sector_returns.items()
            ],
            key=lambda x: x["return"],
            reverse=True,
        )
        for i, r in enumerate(ranked):
            r["rank"] = i + 1
        return ranked


# ── Market Regime from Breadth ──────────────────────────────────────────

class BreadthRegimeClassifier:
    """Classify overall market regime using breadth data."""

    @staticmethod
    def classify(
        data: list[DailyBreadthData],
        lookback: int = 20,
    ) -> dict:
        """
        Use multiple breadth indicators to classify regime.
        """
        if len(data) < lookback:
            return {"regime": MarketRegime.NEUTRAL.value, "insufficient_data": True}

        recent = data[-lookback:]

        # 1. A/D ratio average
        ad_ratios = [d.ad_ratio for d in recent if d.ad_ratio != float("inf")]
        avg_ad = statistics.mean(ad_ratios) if ad_ratios else 1.0

        # 2. NH-NL average
        nh_nl = [d.nh_nl_difference for d in recent]
        avg_nh_nl = statistics.mean(nh_nl)

        # 3. Volume ratio average
        vol_ratios = [d.volume_ratio for d in recent if d.volume_ratio != float("inf")]
        avg_vol = statistics.mean(vol_ratios) if vol_ratios else 1.0

        # Scoring
        score = 0
        if avg_ad > 1.5:
            score += 2
        elif avg_ad > 1.0:
            score += 1
        elif avg_ad < 0.67:
            score -= 2
        elif avg_ad < 1.0:
            score -= 1

        if avg_nh_nl > 50:
            score += 2
        elif avg_nh_nl > 0:
            score += 1
        elif avg_nh_nl < -50:
            score -= 2
        elif avg_nh_nl < 0:
            score -= 1

        if avg_vol > 1.5:
            score += 1
        elif avg_vol < 0.67:
            score -= 1

        if score >= 4:
            regime = MarketRegime.STRONG_BULL
        elif score >= 2:
            regime = MarketRegime.BULL
        elif score <= -4:
            regime = MarketRegime.STRONG_BEAR
        elif score <= -2:
            regime = MarketRegime.BEAR
        else:
            regime = MarketRegime.NEUTRAL

        return {
            "regime": regime.value,
            "score": score,
            "avg_ad_ratio": round(avg_ad, 4),
            "avg_nh_nl": round(avg_nh_nl, 2),
            "avg_vol_ratio": round(avg_vol, 4),
            "lookback_days": lookback,
        }


# ── Divergence Detector ────────────────────────────────────────────────

class BreadthDivergenceDetector:
    """Detect divergences between market price and breadth."""

    @staticmethod
    def detect_divergence(
        index_prices: list[float],
        ad_line: list[int],
        lookback: int = 20,
    ) -> dict:
        """
        Bearish divergence: index makes new high but A/D line doesn't.
        Bullish divergence: index makes new low but A/D line doesn't.
        """
        if len(index_prices) < lookback or len(ad_line) < lookback:
            return {"signal": BreadthSignal.NEUTRAL.value, "insufficient_data": True}

        recent_prices = index_prices[-lookback:]
        recent_ad = ad_line[-lookback:]
        prior_prices = index_prices[-2 * lookback:-lookback] if len(index_prices) >= 2 * lookback else index_prices[:lookback]
        prior_ad = ad_line[-2 * lookback:-lookback] if len(ad_line) >= 2 * lookback else ad_line[:lookback]

        price_higher = max(recent_prices) > max(prior_prices) if prior_prices else False
        ad_higher = max(recent_ad) > max(prior_ad) if prior_ad else False

        price_lower = min(recent_prices) < min(prior_prices) if prior_prices else False
        ad_lower = min(recent_ad) < min(prior_ad) if prior_ad else False

        if price_higher and not ad_higher:
            return {
                "signal": BreadthSignal.DIVERGENCE_BEARISH.value,
                "description": "Price making new highs but breadth is not — bearish divergence",
            }
        elif price_lower and not ad_lower:
            return {
                "signal": BreadthSignal.DIVERGENCE_BULLISH.value,
                "description": "Price making new lows but breadth is not — bullish divergence",
            }
        return {"signal": BreadthSignal.NEUTRAL.value}


# ── Orchestrator ────────────────────────────────────────────────────────

class MarketBreadthEngine:
    """Top-level orchestrator for all market breadth calculations."""

    def __init__(self) -> None:
        self._ad_calc = AdvanceDeclineCalculator()
        self._mcclellan = McCllellanCalculator()
        self._trin_calc = ArmsIndexCalculator()
        self._nh_nl_calc = NewHighLowCalculator()
        self._thrust_calc = BreadthThrustCalculator()
        self._hindenburg = HindenburgOmenDetector()
        self._pct_ma_calc = PercentAboveMACalculator()
        self._vol_breadth = VolumeBreadthCalculator()
        self._sector_rot = SectorRotationAnalyzer()
        self._regime_clf = BreadthRegimeClassifier()
        self._divergence = BreadthDivergenceDetector()

    def ad_line(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._ad_calc.ad_line(data)

    def ad_ratio(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._ad_calc.ad_ratio_series(data)

    def ad_breadth_pct(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._ad_calc.ad_breadth_pct(data)

    def mcclellan_oscillator(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._mcclellan.oscillator(data)

    def mcclellan_summation(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._mcclellan.summation_index(data)

    def trin(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._trin_calc.trin(data)

    def trin_moving_avg(self, data: list[DailyBreadthData], period: int = 10) -> list[dict]:
        return self._trin_calc.moving_average_trin(data, period)

    def nh_nl_line(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._nh_nl_calc.nh_nl_line(data)

    def nh_nl_ratio(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._nh_nl_calc.nh_nl_ratio(data)

    def breadth_thrust(self, data: list[DailyBreadthData], period: int = 10) -> list[dict]:
        return self._thrust_calc.breadth_thrust(data, period)

    def zweig_thrust(self, data: list[DailyBreadthData]) -> dict:
        return self._thrust_calc.zweig_breadth_thrust(data)

    def hindenburg_omen(self, data: list[DailyBreadthData], index_values: list[float] | None = None) -> list[dict]:
        return self._hindenburg.detect(data, index_values)

    def pct_above_ma(self, stock_prices: dict[str, list[float]], period: int = 50) -> dict:
        return self._pct_ma_calc.calculate(stock_prices, period)

    def multi_ma_summary(self, stock_prices: dict[str, list[float]]) -> dict:
        return self._pct_ma_calc.multi_ma_summary(stock_prices).to_dict()

    def volume_ratio(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._vol_breadth.up_down_volume_ratio(data)

    def cumulative_volume(self, data: list[DailyBreadthData]) -> list[dict]:
        return self._vol_breadth.cumulative_volume_line(data)

    def volume_thrust(self, data: list[DailyBreadthData], threshold: float = 9.0) -> list[dict]:
        return self._vol_breadth.volume_thrust(data, threshold)

    def sector_rotation(self, sector_returns: dict[str, float]) -> dict:
        return self._sector_rot.rotation_score(sector_returns)

    def sector_relative_strength(self, sector_returns: dict[str, float]) -> list[dict]:
        return self._sector_rot.relative_strength(sector_returns)

    def market_regime(self, data: list[DailyBreadthData], lookback: int = 20) -> dict:
        return self._regime_clf.classify(data, lookback)

    def divergence(self, index_prices: list[float], ad_line_values: list[int], lookback: int = 20) -> dict:
        return self._divergence.detect_divergence(index_prices, ad_line_values, lookback)

    def full_dashboard(self, data: list[DailyBreadthData]) -> dict:
        """Compute all breadth indicators at once."""
        return {
            "ad_line": self.ad_line(data),
            "mcclellan": self.mcclellan_oscillator(data),
            "trin": self.trin(data),
            "nh_nl": self.nh_nl_line(data),
            "regime": self.market_regime(data),
            "zweig_thrust": self.zweig_thrust(data),
        }

    def capabilities(self) -> dict:
        return {
            "engine": "MarketBreadthEngine",
            "version": "1.0.0",
            "indicators": [
                "advance_decline_line", "ad_ratio", "ad_breadth_pct",
                "mcclellan_oscillator", "mcclellan_summation_index",
                "trin", "trin_moving_average",
                "new_highs_new_lows_line", "nh_nl_ratio",
                "breadth_thrust", "zweig_breadth_thrust",
                "hindenburg_omen",
                "pct_above_ma", "multi_ma_summary",
                "up_down_volume_ratio", "cumulative_volume", "volume_thrust",
                "sector_rotation", "sector_relative_strength",
                "market_regime_classification", "breadth_divergence",
                "full_dashboard",
            ],
        }
