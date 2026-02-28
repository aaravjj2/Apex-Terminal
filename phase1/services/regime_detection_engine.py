"""
Regime Detection Engine — Market regime identification & classification.

Identifies bull/bear/sideways regimes, volatility regimes, momentum regimes,
trend-following vs mean-reversion environments, and structural breaks.
Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ── Enums ───────────────────────────────────────────────────────────────

class MarketRegime(str, Enum):
    STRONG_BULL = "strong_bull"
    BULL = "bull"
    NEUTRAL = "neutral"
    BEAR = "bear"
    STRONG_BEAR = "strong_bear"


class VolatilityRegime(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    EXTREME = "extreme"


class TrendRegime(str, Enum):
    STRONG_TREND = "strong_trend"
    MODERATE_TREND = "moderate_trend"
    RANGE_BOUND = "range_bound"
    CHOPPY = "choppy"


class MomentumRegime(str, Enum):
    STRONG_POSITIVE = "strong_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    STRONG_NEGATIVE = "strong_negative"


class CyclePhase(str, Enum):
    EXPANSION = "expansion"
    PEAK = "peak"
    CONTRACTION = "contraction"
    TROUGH = "trough"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class RegimeState:
    """Complete regime state at a point in time."""
    market: MarketRegime
    volatility: VolatilityRegime
    trend: TrendRegime
    momentum: MomentumRegime
    cycle_phase: Optional[CyclePhase] = None
    confidence: float = 0.0
    timestamp_idx: int = 0

    def to_dict(self) -> dict:
        return {
            "market": self.market.value,
            "volatility": self.volatility.value,
            "trend": self.trend.value,
            "momentum": self.momentum.value,
            "cycle_phase": self.cycle_phase.value if self.cycle_phase else None,
            "confidence": round(self.confidence, 2),
            "timestamp_idx": self.timestamp_idx,
        }


@dataclass
class RegimeTransition:
    """Records a regime change."""
    from_regime: str
    to_regime: str
    index: int
    regime_type: str  # "market", "volatility", "trend"

    def to_dict(self) -> dict:
        return {
            "from": self.from_regime,
            "to": self.to_regime,
            "index": self.index,
            "type": self.regime_type,
        }


# ── SMA / EMA Helpers ──────────────────────────────────────────────────

def _sma(prices: list[float], period: int) -> list[float]:
    """Simple moving average."""
    if len(prices) < period:
        return [statistics.mean(prices)] * len(prices)
    result = [0.0] * (period - 1)
    for i in range(period - 1, len(prices)):
        result.append(statistics.mean(prices[i - period + 1 : i + 1]))
    return result


def _ema(prices: list[float], period: int) -> list[float]:
    """Exponential moving average."""
    if not prices:
        return []
    k = 2.0 / (period + 1)
    result = [prices[0]]
    for i in range(1, len(prices)):
        result.append(prices[i] * k + result[-1] * (1 - k))
    return result


def _returns(prices: list[float]) -> list[float]:
    """Daily returns from price series."""
    if len(prices) < 2:
        return []
    return [(prices[i] / prices[i - 1]) - 1.0 for i in range(1, len(prices))]


def _rolling_std(values: list[float], window: int) -> list[float]:
    """Rolling standard deviation."""
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        chunk = values[start : i + 1]
        if len(chunk) < 2:
            result.append(0.0)
        else:
            result.append(statistics.stdev(chunk))
    return result


# ── Market Regime Classifier ───────────────────────────────────────────

class MarketRegimeClassifier:
    """Classify market into bull/bear/neutral using multiple signals."""

    @staticmethod
    def classify_by_sma(
        prices: list[float],
        short_period: int = 50,
        long_period: int = 200,
    ) -> list[dict]:
        """Classify regime by SMA crossover (price vs 50/200 SMA)."""
        if len(prices) < long_period:
            short_period = max(5, len(prices) // 4)
            long_period = max(10, len(prices) // 2)

        sma_short = _sma(prices, short_period)
        sma_long = _sma(prices, long_period)

        regimes = []
        for i in range(len(prices)):
            if i < long_period:
                regimes.append({"index": i, "regime": MarketRegime.NEUTRAL, "score": 0.0})
                continue

            price = prices[i]
            s = sma_short[i]
            l = sma_long[i]

            if s == 0 or l == 0:
                regimes.append({"index": i, "regime": MarketRegime.NEUTRAL, "score": 0.0})
                continue

            # Score: how far price is from long SMA + short vs long SMA
            price_vs_long = (price - l) / l
            short_vs_long = (s - l) / l

            score = price_vs_long * 50 + short_vs_long * 50  # weighted
            score = max(-100, min(100, score * 10))  # normalize

            if score > 50:
                regime = MarketRegime.STRONG_BULL
            elif score > 15:
                regime = MarketRegime.BULL
            elif score > -15:
                regime = MarketRegime.NEUTRAL
            elif score > -50:
                regime = MarketRegime.BEAR
            else:
                regime = MarketRegime.STRONG_BEAR

            regimes.append({"index": i, "regime": regime, "score": round(score, 2)})

        return regimes

    @staticmethod
    def classify_by_returns(
        prices: list[float],
        lookback: int = 60,
    ) -> list[dict]:
        """Classify by rolling return over lookback period."""
        regimes = []
        for i in range(len(prices)):
            if i < lookback:
                regimes.append({"index": i, "regime": MarketRegime.NEUTRAL, "return_pct": 0.0})
                continue

            ret = (prices[i] / prices[i - lookback]) - 1.0
            ret_pct = ret * 100

            if ret_pct > 20:
                regime = MarketRegime.STRONG_BULL
            elif ret_pct > 5:
                regime = MarketRegime.BULL
            elif ret_pct > -5:
                regime = MarketRegime.NEUTRAL
            elif ret_pct > -20:
                regime = MarketRegime.BEAR
            else:
                regime = MarketRegime.STRONG_BEAR

            regimes.append({"index": i, "regime": regime, "return_pct": round(ret_pct, 2)})

        return regimes

    @staticmethod
    def classify_composite(prices: list[float]) -> list[dict]:
        """Combine SMA-based and return-based regime classification."""
        sma_regimes = MarketRegimeClassifier.classify_by_sma(prices)
        ret_regimes = MarketRegimeClassifier.classify_by_returns(prices)

        regime_scores = {
            MarketRegime.STRONG_BULL: 2,
            MarketRegime.BULL: 1,
            MarketRegime.NEUTRAL: 0,
            MarketRegime.BEAR: -1,
            MarketRegime.STRONG_BEAR: -2,
        }

        results = []
        for i in range(len(prices)):
            s1 = regime_scores.get(sma_regimes[i]["regime"], 0)
            s2 = regime_scores.get(ret_regimes[i]["regime"], 0)
            avg = (s1 + s2) / 2.0

            if avg > 1.0:
                regime = MarketRegime.STRONG_BULL
            elif avg > 0.3:
                regime = MarketRegime.BULL
            elif avg > -0.3:
                regime = MarketRegime.NEUTRAL
            elif avg > -1.0:
                regime = MarketRegime.BEAR
            else:
                regime = MarketRegime.STRONG_BEAR

            confidence = min(abs(avg) / 2.0, 1.0)
            results.append({
                "index": i,
                "regime": regime,
                "confidence": round(confidence, 2),
                "sma_regime": sma_regimes[i]["regime"].value,
                "return_regime": ret_regimes[i]["regime"].value,
            })

        return results


# ── Volatility Regime Detector ─────────────────────────────────────────

class VolatilityRegimeDetector:
    """Classify volatility into low/normal/high/extreme regimes."""

    @staticmethod
    def realized_volatility(
        prices: list[float],
        window: int = 20,
        annualize: bool = True,
    ) -> list[float]:
        """Rolling realized volatility (annualized or raw)."""
        rets = _returns(prices)
        if not rets:
            return [0.0] * len(prices)

        vol = _rolling_std(rets, window)
        if annualize:
            vol = [v * math.sqrt(252) for v in vol]

        # Pad to match price length
        return [0.0] + vol

    @staticmethod
    def classify(
        prices: list[float],
        window: int = 20,
        lookback_for_percentiles: int = 252,
    ) -> list[dict]:
        """Classify volatility regime based on percentile ranking."""
        vol = VolatilityRegimeDetector.realized_volatility(prices, window)

        results = []
        for i in range(len(prices)):
            start = max(0, i - lookback_for_percentiles)
            hist = [v for v in vol[start : i + 1] if v > 0]

            if not hist:
                results.append({"index": i, "regime": VolatilityRegime.NORMAL, "vol": 0.0, "percentile": 50})
                continue

            current = vol[i]
            sorted_hist = sorted(hist)
            rank = sum(1 for v in sorted_hist if v <= current)
            percentile = (rank / len(sorted_hist)) * 100

            if percentile < 20:
                regime = VolatilityRegime.LOW
            elif percentile < 60:
                regime = VolatilityRegime.NORMAL
            elif percentile < 90:
                regime = VolatilityRegime.HIGH
            else:
                regime = VolatilityRegime.EXTREME

            results.append({
                "index": i,
                "regime": regime,
                "vol": round(current, 4),
                "percentile": round(percentile, 1),
            })

        return results

    @staticmethod
    def vol_of_vol(prices: list[float], vol_window: int = 20, vov_window: int = 20) -> list[float]:
        """Volatility of volatility — measures vol clustering."""
        vol = VolatilityRegimeDetector.realized_volatility(prices, vol_window)
        return _rolling_std(vol, vov_window)


# ── Trend Strength Analyzer ───────────────────────────────────────────

class TrendStrengthAnalyzer:
    """Quantify trend strength and classify trending vs range-bound."""

    @staticmethod
    def adx_simple(
        high: list[float],
        low: list[float],
        close: list[float],
        period: int = 14,
    ) -> list[float]:
        """Simplified ADX calculation."""
        if len(close) < period + 1:
            return [0.0] * len(close)

        # Calculate +DM, -DM, TR
        plus_dm = []
        minus_dm = []
        tr_list = []

        for i in range(1, len(close)):
            h_diff = high[i] - high[i - 1]
            l_diff = low[i - 1] - low[i]

            pdm = h_diff if h_diff > l_diff and h_diff > 0 else 0
            mdm = l_diff if l_diff > h_diff and l_diff > 0 else 0

            tr = max(
                high[i] - low[i],
                abs(high[i] - close[i - 1]),
                abs(low[i] - close[i - 1]),
            )

            plus_dm.append(pdm)
            minus_dm.append(mdm)
            tr_list.append(tr)

        # Smoothed averages
        sm_plus_dm = _ema(plus_dm, period)
        sm_minus_dm = _ema(minus_dm, period)
        sm_tr = _ema(tr_list, period)

        # +DI, -DI
        dx_values = []
        for i in range(len(sm_tr)):
            if sm_tr[i] == 0:
                dx_values.append(0)
                continue
            plus_di = (sm_plus_dm[i] / sm_tr[i]) * 100
            minus_di = (sm_minus_dm[i] / sm_tr[i]) * 100
            di_sum = plus_di + minus_di
            if di_sum == 0:
                dx_values.append(0)
            else:
                dx_values.append(abs(plus_di - minus_di) / di_sum * 100)

        adx = _ema(dx_values, period)
        # Pad front to match original length
        padding = [0.0] * (len(close) - len(adx))
        return padding + adx

    @staticmethod
    def efficiency_ratio(prices: list[float], period: int = 20) -> list[float]:
        """
        Kaufman Efficiency Ratio: net direction / total path.
        1.0 = perfectly trending, 0.0 = perfectly choppy.
        """
        result = []
        for i in range(len(prices)):
            if i < period:
                result.append(0.5)
                continue

            direction = abs(prices[i] - prices[i - period])
            volatility = sum(abs(prices[j] - prices[j - 1]) for j in range(i - period + 1, i + 1))

            if volatility == 0:
                result.append(0.5)
            else:
                result.append(direction / volatility)

        return result

    @staticmethod
    def classify(
        prices: list[float],
        high: Optional[list[float]] = None,
        low: Optional[list[float]] = None,
    ) -> list[dict]:
        """Classify trend regime (strong_trend/moderate_trend/range_bound/choppy)."""
        if high is None:
            high = prices
        if low is None:
            low = prices

        er = TrendStrengthAnalyzer.efficiency_ratio(prices)
        adx = TrendStrengthAnalyzer.adx_simple(high, low, prices)

        results = []
        for i in range(len(prices)):
            er_val = er[i]
            adx_val = adx[i] if i < len(adx) else 0

            # Combined score
            score = er_val * 50 + (adx_val / 100) * 50

            if score > 60:
                regime = TrendRegime.STRONG_TREND
            elif score > 35:
                regime = TrendRegime.MODERATE_TREND
            elif score > 20:
                regime = TrendRegime.RANGE_BOUND
            else:
                regime = TrendRegime.CHOPPY

            results.append({
                "index": i,
                "regime": regime,
                "efficiency_ratio": round(er_val, 4),
                "adx": round(adx_val, 2),
                "score": round(score, 2),
            })

        return results


# ── Momentum Regime Detector ──────────────────────────────────────────

class MomentumRegimeDetector:
    """Classify momentum regime using RSI and rate-of-change."""

    @staticmethod
    def rsi(prices: list[float], period: int = 14) -> list[float]:
        """Relative Strength Index."""
        if len(prices) < period + 1:
            return [50.0] * len(prices)

        changes = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
        gains = [max(c, 0) for c in changes]
        losses = [max(-c, 0) for c in changes]

        avg_gain = statistics.mean(gains[:period])
        avg_loss = statistics.mean(losses[:period])

        rsi_values = [50.0] * period  # pad

        for i in range(period, len(changes)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

            if avg_loss == 0:
                rsi_values.append(100.0)
            else:
                rs = avg_gain / avg_loss
                rsi_values.append(100 - (100 / (1 + rs)))

        # Pad to match price length
        return [50.0] + rsi_values

    @staticmethod
    def rate_of_change(prices: list[float], period: int = 20) -> list[float]:
        """Rate of change (percent)."""
        result = []
        for i in range(len(prices)):
            if i < period:
                result.append(0.0)
            else:
                result.append(((prices[i] / prices[i - period]) - 1) * 100)
        return result

    @staticmethod
    def classify(prices: list[float]) -> list[dict]:
        """Classify momentum regime."""
        rsi_vals = MomentumRegimeDetector.rsi(prices)
        roc_vals = MomentumRegimeDetector.rate_of_change(prices, 20)

        results = []
        for i in range(len(prices)):
            rsi_v = rsi_vals[i] if i < len(rsi_vals) else 50
            roc_v = roc_vals[i]

            # Score: RSI-based component (0 to 100 mapped to -50 to 50) + ROC
            rsi_score = (rsi_v - 50)  # -50 to +50
            roc_score = max(-50, min(50, roc_v * 2))  # clamp
            score = rsi_score * 0.6 + roc_score * 0.4

            if score > 30:
                regime = MomentumRegime.STRONG_POSITIVE
            elif score > 10:
                regime = MomentumRegime.POSITIVE
            elif score > -10:
                regime = MomentumRegime.NEUTRAL
            elif score > -30:
                regime = MomentumRegime.NEGATIVE
            else:
                regime = MomentumRegime.STRONG_NEGATIVE

            results.append({
                "index": i,
                "regime": regime,
                "rsi": round(rsi_v, 2),
                "roc": round(roc_v, 2),
                "score": round(score, 2),
            })

        return results


# ── Structural Break Detector ─────────────────────────────────────────

class StructuralBreakDetector:
    """Detect structural breaks / regime transitions in price series."""

    @staticmethod
    def cusum(
        prices: list[float],
        threshold: float = 2.0,
    ) -> list[dict]:
        """
        CUSUM (Cumulative Sum) test for structural breaks.
        Detects shifts in the mean of returns.
        """
        rets = _returns(prices)
        if len(rets) < 20:
            return []

        mean_ret = statistics.mean(rets)
        std_ret = statistics.stdev(rets) if len(rets) > 1 else 1.0
        if std_ret == 0:
            std_ret = 0.0001

        s_pos = 0.0
        s_neg = 0.0
        breaks = []

        for i, r in enumerate(rets):
            z = (r - mean_ret) / std_ret
            s_pos = max(0, s_pos + z - 0.5)
            s_neg = max(0, s_neg - z - 0.5)

            if s_pos > threshold:
                breaks.append({
                    "index": i + 1,  # +1 for price index
                    "type": "positive_shift",
                    "cusum_value": round(s_pos, 4),
                })
                s_pos = 0.0

            if s_neg > threshold:
                breaks.append({
                    "index": i + 1,
                    "type": "negative_shift",
                    "cusum_value": round(s_neg, 4),
                })
                s_neg = 0.0

        return breaks

    @staticmethod
    def rolling_mean_shift(
        prices: list[float],
        window: int = 50,
        shift_threshold: float = 2.0,
    ) -> list[dict]:
        """Detect when rolling mean shifts significantly."""
        rets = _returns(prices)
        if len(rets) < window * 2:
            return []

        breaks = []
        for i in range(window, len(rets) - window):
            left = rets[i - window : i]
            right = rets[i : i + window]

            mean_l = statistics.mean(left)
            mean_r = statistics.mean(right)
            std_l = statistics.stdev(left) if len(left) > 1 else 0.001

            if std_l == 0:
                std_l = 0.001

            z_diff = (mean_r - mean_l) / std_l

            if abs(z_diff) > shift_threshold:
                breaks.append({
                    "index": i + 1,
                    "type": "positive_shift" if z_diff > 0 else "negative_shift",
                    "z_score": round(z_diff, 4),
                    "left_mean": round(mean_l, 6),
                    "right_mean": round(mean_r, 6),
                })

        return breaks

    @staticmethod
    def variance_ratio_test(
        prices: list[float],
        period: int = 20,
        window: int = 100,
    ) -> list[dict]:
        """
        Rolling variance ratio test.
        VR(q) ≈ 1 for random walk.
        VR(q) > 1 suggests momentum/trending.
        VR(q) < 1 suggests mean-reversion.
        """
        rets = _returns(prices)
        if len(rets) < window + period:
            return [{"index": i, "vr": 1.0, "interpretation": "insufficient_data"} for i in range(len(prices))]

        results = [{"index": i, "vr": 1.0, "interpretation": "insufficient_data"} for i in range(window + period)]

        for i in range(window + period, len(rets)):
            chunk = rets[i - window : i]

            # Variance of 1-period returns
            var_1 = statistics.variance(chunk)
            if var_1 == 0:
                results.append({"index": i + 1, "vr": 1.0, "interpretation": "zero_variance"})
                continue

            # Variance of q-period returns
            q_rets = [sum(chunk[j : j + period]) for j in range(0, len(chunk) - period + 1)]
            if len(q_rets) < 2:
                results.append({"index": i + 1, "vr": 1.0, "interpretation": "insufficient_data"})
                continue

            var_q = statistics.variance(q_rets)
            vr = var_q / (period * var_1)

            if vr > 1.3:
                interp = "trending"
            elif vr < 0.7:
                interp = "mean_reverting"
            else:
                interp = "random_walk"

            results.append({"index": i + 1, "vr": round(vr, 4), "interpretation": interp})

        return results


# ── Regime Transition Tracker ─────────────────────────────────────────

class RegimeTransitionTracker:
    """Track and analyze regime transitions over time."""

    @staticmethod
    def detect_transitions(regimes: list[dict], regime_key: str = "regime") -> list[RegimeTransition]:
        """Detect all regime changes in a sequence."""
        transitions = []
        for i in range(1, len(regimes)):
            prev = regimes[i - 1].get(regime_key)
            curr = regimes[i].get(regime_key)

            # Handle enum or string
            prev_val = prev.value if hasattr(prev, "value") else str(prev)
            curr_val = curr.value if hasattr(curr, "value") else str(curr)

            if prev_val != curr_val:
                transitions.append(RegimeTransition(
                    from_regime=prev_val,
                    to_regime=curr_val,
                    index=i,
                    regime_type=regime_key,
                ))

        return transitions

    @staticmethod
    def regime_durations(regimes: list[dict], regime_key: str = "regime") -> dict:
        """Calculate how long each regime lasts on average."""
        if not regimes:
            return {}

        durations: dict[str, list[int]] = {}
        current = regimes[0].get(regime_key)
        current_val = current.value if hasattr(current, "value") else str(current)
        current_len = 1

        for i in range(1, len(regimes)):
            r = regimes[i].get(regime_key)
            r_val = r.value if hasattr(r, "value") else str(r)

            if r_val == current_val:
                current_len += 1
            else:
                durations.setdefault(current_val, []).append(current_len)
                current_val = r_val
                current_len = 1

        durations.setdefault(current_val, []).append(current_len)

        result = {}
        for regime, lengths in durations.items():
            result[regime] = {
                "count": len(lengths),
                "avg_duration": round(statistics.mean(lengths), 1),
                "min_duration": min(lengths),
                "max_duration": max(lengths),
                "total_bars": sum(lengths),
            }

        return result

    @staticmethod
    def transition_matrix(transitions: list[RegimeTransition]) -> dict:
        """Build a transition probability matrix."""
        counts: dict[str, dict[str, int]] = {}

        for t in transitions:
            if t.from_regime not in counts:
                counts[t.from_regime] = {}
            counts[t.from_regime][t.to_regime] = counts[t.from_regime].get(t.to_regime, 0) + 1

        # Normalize to probabilities
        matrix = {}
        for from_r, to_counts in counts.items():
            total = sum(to_counts.values())
            matrix[from_r] = {to_r: round(c / total, 4) for to_r, c in to_counts.items()}

        return matrix


# ── Hidden Markov-like Regime Smoother ─────────────────────────────────

class RegimeSmoother:
    """
    Smooth noisy regime classifications using a simple persistence filter.
    Not a full HMM — uses minimum-duration and consensus filtering.
    """

    @staticmethod
    def minimum_duration_filter(
        regimes: list[dict],
        min_bars: int = 5,
        regime_key: str = "regime",
    ) -> list[dict]:
        """
        Remove regime changes that don't persist for at least min_bars.
        Short-lived regimes are absorbed into the surrounding regime.
        """
        if len(regimes) <= min_bars:
            return regimes

        # Extract regime values
        vals = []
        for r in regimes:
            rv = r.get(regime_key)
            vals.append(rv.value if hasattr(rv, "value") else str(rv))

        # Forward pass: find runs
        runs = []
        current = vals[0]
        start = 0
        for i in range(1, len(vals)):
            if vals[i] != current:
                runs.append((current, start, i - 1))
                current = vals[i]
                start = i
        runs.append((current, start, len(vals) - 1))

        # Filter short runs: replace with previous long regime
        filtered = vals.copy()
        last_long_regime = runs[0][0]
        for regime, s, e in runs:
            length = e - s + 1
            if length >= min_bars:
                last_long_regime = regime
            else:
                for j in range(s, e + 1):
                    filtered[j] = last_long_regime

        # Rebuild regimes
        result = []
        for i, r in enumerate(regimes):
            new_r = dict(r)
            # Try to set as enum
            regime_val = r.get(regime_key)
            if hasattr(regime_val, "__class__") and hasattr(regime_val.__class__, "__members__"):
                # It's an enum — find the matching member
                for member in regime_val.__class__:
                    if member.value == filtered[i]:
                        new_r[regime_key] = member
                        break
            else:
                new_r[regime_key] = filtered[i]
            new_r["smoothed"] = True
            result.append(new_r)

        return result

    @staticmethod
    def consensus_filter(
        regime_series_list: list[list[dict]],
        regime_key: str = "regime",
    ) -> list[dict]:
        """
        Combine multiple regime classifiers using majority vote.
        Each element in regime_series_list is a list of regime dicts.
        """
        if not regime_series_list:
            return []

        length = min(len(s) for s in regime_series_list)
        results = []

        for i in range(length):
            votes: dict[str, int] = {}
            for series in regime_series_list:
                r = series[i].get(regime_key)
                val = r.value if hasattr(r, "value") else str(r)
                votes[val] = votes.get(val, 0) + 1

            winner = max(votes, key=votes.get)
            total_votes = sum(votes.values())
            confidence = votes[winner] / total_votes

            results.append({
                "index": i,
                "regime": winner,
                "confidence": round(confidence, 2),
                "votes": dict(votes),
            })

        return results


# ── Cycle Phase Detector ──────────────────────────────────────────────

class CyclePhaseDetector:
    """Detect expansion/peak/contraction/trough phases."""

    @staticmethod
    def detect(prices: list[float], smooth_period: int = 20) -> list[dict]:
        """
        Detect cycle phase using price momentum and acceleration.
        - Expansion: positive momentum, positive acceleration
        - Peak: positive momentum, negative acceleration
        - Contraction: negative momentum, negative acceleration
        - Trough: negative momentum, positive acceleration
        """
        if len(prices) < smooth_period * 2:
            return [{"index": i, "phase": CyclePhase.EXPANSION, "momentum": 0, "acceleration": 0}
                    for i in range(len(prices))]

        smoothed = _sma(prices, smooth_period)

        # Momentum: rate of change of smoothed price
        momentum = []
        for i in range(len(smoothed)):
            if i < smooth_period:
                momentum.append(0.0)
            else:
                if smoothed[i - smooth_period] == 0:
                    momentum.append(0.0)
                else:
                    momentum.append((smoothed[i] / smoothed[i - smooth_period]) - 1.0)

        # Acceleration: rate of change of momentum
        acceleration = []
        for i in range(len(momentum)):
            if i < 1:
                acceleration.append(0.0)
            else:
                acceleration.append(momentum[i] - momentum[i - 1])

        results = []
        for i in range(len(prices)):
            m = momentum[i]
            a = acceleration[i]

            if m > 0 and a > 0:
                phase = CyclePhase.EXPANSION
            elif m > 0 and a <= 0:
                phase = CyclePhase.PEAK
            elif m <= 0 and a <= 0:
                phase = CyclePhase.CONTRACTION
            else:
                phase = CyclePhase.TROUGH

            results.append({
                "index": i,
                "phase": phase,
                "momentum": round(m, 6),
                "acceleration": round(a, 8),
            })

        return results


# ── Regime-Based Strategy Selector ────────────────────────────────────

class StrategySelector:
    """Recommend trading strategies based on current regime."""

    STRATEGY_MAP = {
        (MarketRegime.STRONG_BULL, TrendRegime.STRONG_TREND): [
            "trend_following", "momentum", "breakout",
        ],
        (MarketRegime.BULL, TrendRegime.MODERATE_TREND): [
            "trend_following", "dip_buying", "swing_trading",
        ],
        (MarketRegime.NEUTRAL, TrendRegime.RANGE_BOUND): [
            "mean_reversion", "range_trading", "pairs_trading",
        ],
        (MarketRegime.NEUTRAL, TrendRegime.CHOPPY): [
            "scalping", "market_making", "reduced_exposure",
        ],
        (MarketRegime.BEAR, TrendRegime.MODERATE_TREND): [
            "short_selling", "hedging", "defensive",
        ],
        (MarketRegime.STRONG_BEAR, TrendRegime.STRONG_TREND): [
            "short_selling", "put_options", "cash",
        ],
    }

    VOL_ADJUSTMENTS = {
        VolatilityRegime.LOW: {"position_size_mult": 1.5, "stop_mult": 0.8},
        VolatilityRegime.NORMAL: {"position_size_mult": 1.0, "stop_mult": 1.0},
        VolatilityRegime.HIGH: {"position_size_mult": 0.6, "stop_mult": 1.5},
        VolatilityRegime.EXTREME: {"position_size_mult": 0.3, "stop_mult": 2.0},
    }

    @staticmethod
    def recommend(state: RegimeState) -> dict:
        """Recommend strategies and position sizing based on regime."""
        key = (state.market, state.trend)
        strategies = StrategySelector.STRATEGY_MAP.get(key)

        # Fallback: find closest match
        if strategies is None:
            # Match on market regime only
            for (m, t), strats in StrategySelector.STRATEGY_MAP.items():
                if m == state.market:
                    strategies = strats
                    break
            if strategies is None:
                strategies = ["reduced_exposure", "cash"]

        vol_adj = StrategySelector.VOL_ADJUSTMENTS.get(
            state.volatility,
            {"position_size_mult": 1.0, "stop_mult": 1.0},
        )

        return {
            "recommended_strategies": strategies,
            "position_size_multiplier": vol_adj["position_size_mult"],
            "stop_loss_multiplier": vol_adj["stop_mult"],
            "market_regime": state.market.value,
            "volatility_regime": state.volatility.value,
            "trend_regime": state.trend.value,
            "momentum_regime": state.momentum.value,
            "confidence": state.confidence,
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class RegimeDetectionEngine:
    """Top-level orchestrator for all regime detection functionality."""

    def __init__(self) -> None:
        self.market_classifier = MarketRegimeClassifier()
        self.vol_detector = VolatilityRegimeDetector()
        self.trend_analyzer = TrendStrengthAnalyzer()
        self.momentum_detector = MomentumRegimeDetector()
        self.break_detector = StructuralBreakDetector()
        self.transition_tracker = RegimeTransitionTracker()
        self.smoother = RegimeSmoother()
        self.cycle_detector = CyclePhaseDetector()
        self.strategy_selector = StrategySelector()

    def classify_market(self, prices: list[float]) -> list[dict]:
        """Composite market regime classification."""
        return self.market_classifier.classify_composite(prices)

    def classify_volatility(self, prices: list[float]) -> list[dict]:
        """Volatility regime classification."""
        return self.vol_detector.classify(prices)

    def classify_trend(
        self,
        prices: list[float],
        high: Optional[list[float]] = None,
        low: Optional[list[float]] = None,
    ) -> list[dict]:
        """Trend regime classification."""
        return self.trend_analyzer.classify(prices, high, low)

    def classify_momentum(self, prices: list[float]) -> list[dict]:
        """Momentum regime classification."""
        return self.momentum_detector.classify(prices)

    def detect_breaks(self, prices: list[float], method: str = "cusum") -> list[dict]:
        """Detect structural breaks."""
        if method == "cusum":
            return self.break_detector.cusum(prices)
        elif method == "mean_shift":
            return self.break_detector.rolling_mean_shift(prices)
        elif method == "variance_ratio":
            return self.break_detector.variance_ratio_test(prices)
        return self.break_detector.cusum(prices)

    def detect_cycle(self, prices: list[float]) -> list[dict]:
        """Detect business/market cycle phase."""
        return self.cycle_detector.detect(prices)

    def get_transitions(self, regimes: list[dict]) -> list[dict]:
        """Get all regime transitions."""
        transitions = self.transition_tracker.detect_transitions(regimes)
        return [t.to_dict() for t in transitions]

    def get_durations(self, regimes: list[dict]) -> dict:
        """Get regime duration statistics."""
        return self.transition_tracker.regime_durations(regimes)

    def get_transition_matrix(self, regimes: list[dict]) -> dict:
        """Build transition probability matrix."""
        transitions = self.transition_tracker.detect_transitions(regimes)
        return self.transition_tracker.transition_matrix(transitions)

    def smooth_regimes(self, regimes: list[dict], min_bars: int = 5) -> list[dict]:
        """Apply minimum-duration smoothing."""
        return self.smoother.minimum_duration_filter(regimes, min_bars)

    def full_regime_state(self, prices: list[float]) -> RegimeState:
        """Get complete regime state from current prices."""
        market = self.classify_market(prices)
        vol = self.classify_volatility(prices)
        trend = self.classify_trend(prices)
        momentum = self.classify_momentum(prices)
        cycle = self.detect_cycle(prices)

        last_market = market[-1]["regime"] if market else MarketRegime.NEUTRAL
        last_vol = vol[-1]["regime"] if vol else VolatilityRegime.NORMAL
        last_trend = trend[-1]["regime"] if trend else TrendRegime.RANGE_BOUND
        last_momentum = momentum[-1]["regime"] if momentum else MomentumRegime.NEUTRAL
        last_cycle = cycle[-1]["phase"] if cycle else CyclePhase.EXPANSION

        confidence = market[-1].get("confidence", 0.5) if market else 0.5

        return RegimeState(
            market=last_market,
            volatility=last_vol,
            trend=last_trend,
            momentum=last_momentum,
            cycle_phase=last_cycle,
            confidence=confidence,
            timestamp_idx=len(prices) - 1,
        )

    def recommend_strategy(self, prices: list[float]) -> dict:
        """Recommend strategy based on current regime."""
        state = self.full_regime_state(prices)
        return self.strategy_selector.recommend(state)

    def full_dashboard(self, prices: list[float]) -> dict:
        """Complete regime dashboard."""
        state = self.full_regime_state(prices)
        strategy = self.strategy_selector.recommend(state)
        market_regimes = self.classify_market(prices)
        breaks = self.detect_breaks(prices)

        return {
            "current_state": state.to_dict(),
            "recommended_strategy": strategy,
            "structural_breaks": breaks[-5:] if breaks else [],  # last 5
            "total_breaks": len(breaks),
            "regime_transitions": len(self.get_transitions(market_regimes)),
        }

    def capabilities(self) -> dict:
        return {
            "engine": "RegimeDetectionEngine",
            "version": "1.0.0",
            "features": [
                "market_regime_classification (SMA crossover + returns composite)",
                "volatility_regime_detection (percentile-based)",
                "trend_strength_analysis (ADX + efficiency ratio)",
                "momentum_regime_detection (RSI + ROC)",
                "structural_break_detection (CUSUM, mean-shift, variance ratio)",
                "cycle_phase_detection (expansion, peak, contraction, trough)",
                "regime_transition_tracking",
                "transition_probability_matrix",
                "regime_duration_statistics",
                "minimum_duration_smoothing",
                "consensus_filter (multi-classifier vote)",
                "strategy_recommendation_by_regime",
                "position_sizing_by_volatility_regime",
                "full_regime_dashboard",
            ],
        }
