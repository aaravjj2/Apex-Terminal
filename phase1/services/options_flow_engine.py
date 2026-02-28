"""
Options Flow Engine — Advanced options flow analysis, unusual activity detection,
dark pool prints, gamma exposure, options sentiment, put/call analysis.
Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ── Enums ───────────────────────────────────────────────────────────────

class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class FlowSentiment(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    VERY_BULLISH = "very_bullish"
    VERY_BEARISH = "very_bearish"


class TradeCondition(str, Enum):
    SWEEP = "sweep"
    BLOCK = "block"
    SPLIT = "split"
    STANDARD = "standard"
    DARK_POOL = "dark_pool"


class UnusualActivityType(str, Enum):
    HIGH_VOLUME = "high_volume"
    HIGH_PREMIUM = "high_premium"
    OTM_SWEEP = "otm_sweep"
    ABNORMAL_OI = "abnormal_oi"
    GAMMA_TRIGGER = "gamma_trigger"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class OptionTrade:
    """Represents a single options trade."""
    symbol: str
    option_type: OptionType
    strike: float
    expiry: str
    premium: float
    size: int
    spot_price: float
    bid: float
    ask: float
    implied_vol: float
    open_interest: int
    condition: TradeCondition = TradeCondition.STANDARD
    is_opening: bool = True

    @property
    def moneyness(self) -> float:
        """Ratio of spot to strike (>1 = ITM call or OTM put)."""
        if self.strike == 0:
            return 1.0
        return self.spot_price / self.strike

    @property
    def is_itm(self) -> bool:
        if self.option_type == OptionType.CALL:
            return self.spot_price > self.strike
        return self.spot_price < self.strike

    @property
    def is_otm(self) -> bool:
        return not self.is_itm

    @property
    def notional_value(self) -> float:
        return self.premium * self.size * 100

    @property
    def mid_price(self) -> float:
        return (self.bid + self.ask) / 2

    @property
    def bid_ask_spread(self) -> float:
        return self.ask - self.bid

    @property
    def aggressor_side(self) -> str:
        """Determine if trade was at bid or ask."""
        if abs(self.premium - self.ask) < abs(self.premium - self.bid):
            return "ask"
        return "bid"

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "type": self.option_type.value,
            "strike": self.strike,
            "expiry": self.expiry,
            "premium": self.premium,
            "size": self.size,
            "spot_price": self.spot_price,
            "notional": round(self.notional_value, 2),
            "iv": round(self.implied_vol, 4),
            "moneyness": round(self.moneyness, 4),
            "is_itm": self.is_itm,
            "condition": self.condition.value,
            "aggressor": self.aggressor_side,
        }


@dataclass
class FlowSummary:
    """Aggregate options flow summary."""
    symbol: str
    call_premium: float = 0.0
    put_premium: float = 0.0
    call_volume: int = 0
    put_volume: int = 0
    call_trades: int = 0
    put_trades: int = 0
    bullish_premium: float = 0.0
    bearish_premium: float = 0.0
    sweep_count: int = 0
    block_count: int = 0

    @property
    def put_call_ratio_volume(self) -> float:
        if self.call_volume == 0:
            return float("inf") if self.put_volume > 0 else 1.0
        return self.put_volume / self.call_volume

    @property
    def put_call_ratio_premium(self) -> float:
        if self.call_premium == 0:
            return float("inf") if self.put_premium > 0 else 1.0
        return self.put_premium / self.call_premium

    @property
    def net_premium(self) -> float:
        return self.call_premium - self.put_premium

    @property
    def total_premium(self) -> float:
        return self.call_premium + self.put_premium

    @property
    def sentiment(self) -> FlowSentiment:
        if self.put_call_ratio_premium == 0:
            return FlowSentiment.NEUTRAL
        r = self.put_call_ratio_premium
        if r < 0.5:
            return FlowSentiment.VERY_BULLISH
        elif r < 0.8:
            return FlowSentiment.BULLISH
        elif r < 1.3:
            return FlowSentiment.NEUTRAL
        elif r < 2.0:
            return FlowSentiment.BEARISH
        else:
            return FlowSentiment.VERY_BEARISH

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "call_premium": round(self.call_premium, 2),
            "put_premium": round(self.put_premium, 2),
            "net_premium": round(self.net_premium, 2),
            "total_premium": round(self.total_premium, 2),
            "call_volume": self.call_volume,
            "put_volume": self.put_volume,
            "pc_ratio_volume": round(self.put_call_ratio_volume, 4),
            "pc_ratio_premium": round(self.put_call_ratio_premium, 4),
            "sentiment": self.sentiment.value,
            "sweeps": self.sweep_count,
            "blocks": self.block_count,
        }


# ── Greeks Calculator ──────────────────────────────────────────────────

class GreeksCalculator:
    """Black-Scholes Greeks for options."""

    @staticmethod
    def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
        if T <= 0 or sigma <= 0 or K <= 0:
            return 0.0
        return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

    @staticmethod
    def _d2(d1: float, sigma: float, T: float) -> float:
        if T <= 0:
            return 0.0
        return d1 - sigma * math.sqrt(T)

    @staticmethod
    def _norm_cdf(x: float) -> float:
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    @staticmethod
    def _norm_pdf(x: float) -> float:
        return math.exp(-0.5 * x ** 2) / math.sqrt(2 * math.pi)

    @classmethod
    def delta(cls, S: float, K: float, T: float, r: float, sigma: float, opt_type: OptionType) -> float:
        """Option delta."""
        if T <= 0:
            if opt_type == OptionType.CALL:
                return 1.0 if S > K else 0.0
            return -1.0 if S < K else 0.0
        d1 = cls._d1(S, K, T, r, sigma)
        if opt_type == OptionType.CALL:
            return cls._norm_cdf(d1)
        return cls._norm_cdf(d1) - 1.0

    @classmethod
    def gamma(cls, S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Option gamma (same for calls and puts)."""
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0
        d1 = cls._d1(S, K, T, r, sigma)
        return cls._norm_pdf(d1) / (S * sigma * math.sqrt(T))

    @classmethod
    def theta(cls, S: float, K: float, T: float, r: float, sigma: float, opt_type: OptionType) -> float:
        """Option theta (per day)."""
        if T <= 0 or sigma <= 0:
            return 0.0
        d1 = cls._d1(S, K, T, r, sigma)
        d2 = cls._d2(d1, sigma, T)
        term1 = -(S * cls._norm_pdf(d1) * sigma) / (2 * math.sqrt(T))
        if opt_type == OptionType.CALL:
            return (term1 - r * K * math.exp(-r * T) * cls._norm_cdf(d2)) / 365
        return (term1 + r * K * math.exp(-r * T) * cls._norm_cdf(-d2)) / 365

    @classmethod
    def vega(cls, S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Option vega (per 1% change in IV)."""
        if T <= 0:
            return 0.0
        d1 = cls._d1(S, K, T, r, sigma)
        return S * cls._norm_pdf(d1) * math.sqrt(T) / 100

    @classmethod
    def rho(cls, S: float, K: float, T: float, r: float, sigma: float, opt_type: OptionType) -> float:
        """Option rho (per 1% change in rate)."""
        if T <= 0:
            return 0.0
        d1 = cls._d1(S, K, T, r, sigma)
        d2 = cls._d2(d1, sigma, T)
        if opt_type == OptionType.CALL:
            return K * T * math.exp(-r * T) * cls._norm_cdf(d2) / 100
        return -K * T * math.exp(-r * T) * cls._norm_cdf(-d2) / 100

    @classmethod
    def all_greeks(cls, S: float, K: float, T: float, r: float, sigma: float, opt_type: OptionType) -> dict:
        """Calculate all Greeks at once."""
        delta = cls.delta(S, K, T, r, sigma, opt_type)
        gamma = cls.gamma(S, K, T, r, sigma)
        theta = cls.theta(S, K, T, r, sigma, opt_type)
        vega = cls.vega(S, K, T, r, sigma)
        rho = cls.rho(S, K, T, r, sigma, opt_type)
        return {
            "delta": round(delta, 6),
            "gamma": round(gamma, 8),
            "theta": round(theta, 6),
            "vega": round(vega, 6),
            "rho": round(rho, 6),
            "dollar_delta": round(delta * S * 100, 2),
            "dollar_gamma": round(gamma * S * S * 0.01 * 100, 2),
        }


# ── Gamma Exposure Calculator ─────────────────────────────────────────

class GammaExposureCalculator:
    """
    Calculate dealer gamma exposure (GEX) across the options chain.
    GEX drives market pinning, volatility suppression, and reflexive moves.
    """

    @staticmethod
    def single_strike_gex(
        spot: float,
        strike: float,
        T: float,
        sigma: float,
        call_oi: int,
        put_oi: int,
        r: float = 0.05,
    ) -> float:
        """Net dealer GEX at a single strike (gamma * OI * spot^2 * 0.01)."""
        gamma = GreeksCalculator.gamma(spot, strike, T, r, sigma)
        # Dealers long call gamma (negative to market), short put gamma (positive)
        call_gex = gamma * call_oi * 100 * spot ** 2 * 0.01
        put_gex = -gamma * put_oi * 100 * spot ** 2 * 0.01
        return call_gex + put_gex

    @staticmethod
    def build_gex_profile(
        spot: float,
        strikes: list[float],
        T: float,
        sigma: float,
        call_ois: list[int],
        put_ois: list[int],
        r: float = 0.05,
    ) -> list[dict]:
        """Build GEX profile across all strikes."""
        result = []
        for i, strike in enumerate(strikes):
            call_oi = call_ois[i] if i < len(call_ois) else 0
            put_oi = put_ois[i] if i < len(put_ois) else 0
            gex = GammaExposureCalculator.single_strike_gex(
                spot, strike, T, sigma, call_oi, put_oi, r
            )
            result.append({
                "strike": strike,
                "gex": round(gex, 2),
                "call_oi": call_oi,
                "put_oi": put_oi,
                "is_otm_call": strike > spot,
                "is_otm_put": strike < spot,
            })
        return result

    @staticmethod
    def find_gamma_walls(gex_profile: list[dict], top_n: int = 3) -> dict:
        """Find major positive and negative gamma walls."""
        pos = sorted([x for x in gex_profile if x["gex"] > 0], key=lambda x: -x["gex"])
        neg = sorted([x for x in gex_profile if x["gex"] < 0], key=lambda x: x["gex"])
        total_gex = sum(x["gex"] for x in gex_profile)
        return {
            "positive_walls": pos[:top_n],
            "negative_walls": neg[:top_n],
            "net_gex": round(total_gex, 2),
            "flip_point": next(
                (x["strike"] for x in sorted(gex_profile, key=lambda x: abs(x["gex"])) if abs(x["gex"]) < total_gex * 0.05),
                None,
            ),
        }

    @staticmethod
    def gex_weighted_mean_strike(gex_profile: list[dict]) -> float:
        """Calculate the GEX-weighted mean strike (magnetic level)."""
        total_abs = sum(abs(x["gex"]) for x in gex_profile)
        if total_abs == 0:
            return 0.0
        return sum(x["strike"] * abs(x["gex"]) for x in gex_profile) / total_abs


# ── Unusual Activity Detector ─────────────────────────────────────────

class UnusualActivityDetector:
    """Detect unusual options activity relative to historical norms."""

    @staticmethod
    def volume_vs_oi_ratio(volume: int, open_interest: int) -> float:
        """Volume/OI ratio — >1 is unusual, very high is very unusual."""
        if open_interest == 0:
            return float(volume) if volume > 0 else 0.0
        return volume / open_interest

    @staticmethod
    def is_unusual_volume(volume: int, avg_volume: float, threshold: float = 3.0) -> bool:
        """Detect if volume is unusually high vs historical average."""
        if avg_volume == 0:
            return volume > 100  # arbitrary threshold
        return volume > avg_volume * threshold

    @staticmethod
    def otm_sweep_score(
        strike: float,
        spot: float,
        opt_type: OptionType,
        premium: float,
        size: int,
        condition: TradeCondition,
    ) -> float:
        """
        Score how unusual an OTM sweep is (0-100).
        Factors: OTM-ness, premium paid, size, sweep vs block.
        """
        # OTM percentage
        if opt_type == OptionType.CALL:
            otm_pct = max(0, (strike - spot) / spot)
        else:
            otm_pct = max(0, (spot - strike) / spot)

        # Normalize factors
        otm_score = min(otm_pct / 0.20, 1.0) * 40  # 20% OTM = max score
        premium_score = min(premium * size * 100 / 500_000, 1.0) * 30  # $500K = max
        size_score = min(size / 1000, 1.0) * 20  # 1000 contracts = max
        sweep_bonus = 10 if condition == TradeCondition.SWEEP else 0

        return round(otm_score + premium_score + size_score + sweep_bonus, 2)

    @staticmethod
    def classify_activity(trades: list[OptionTrade]) -> list[dict]:
        """Classify each trade by unusual activity type."""
        results = []
        for trade in trades:
            flags = []
            score = 0

            # High notional
            if trade.notional_value > 1_000_000:
                flags.append(UnusualActivityType.HIGH_PREMIUM.value)
                score += 25

            # Sweep
            if trade.condition == TradeCondition.SWEEP:
                score += 20

            # OTM sweep
            if trade.is_otm and trade.condition == TradeCondition.SWEEP:
                flags.append(UnusualActivityType.OTM_SWEEP.value)
                score += 30

            # High volume vs OI
            vol_oi = UnusualActivityDetector.volume_vs_oi_ratio(trade.size, trade.open_interest)
            if vol_oi > 5:
                flags.append(UnusualActivityType.HIGH_VOLUME.value)
                score += 25

            results.append({
                **trade.to_dict(),
                "unusual_flags": flags,
                "unusual_score": min(score, 100),
                "vol_oi_ratio": round(vol_oi, 2),
            })

        return sorted(results, key=lambda x: -x["unusual_score"])


# ── Put/Call Analysis ─────────────────────────────────────────────────

class PutCallAnalyzer:
    """Analyze put/call ratios across time and strikes for sentiment."""

    @staticmethod
    def pcr_series(
        call_volumes: list[int],
        put_volumes: list[int],
    ) -> list[float]:
        """Calculate rolling P/C ratio series."""
        return [
            p / c if c > 0 else float("inf")
            for c, p in zip(call_volumes, put_volumes)
        ]

    @staticmethod
    def pcr_percentile(current_pcr: float, historical_pcr: list[float]) -> float:
        """Percentile rank of current P/C vs history (contrarian indicator)."""
        if not historical_pcr:
            return 50.0
        rank = sum(1 for v in historical_pcr if v <= current_pcr)
        return rank / len(historical_pcr) * 100

    @staticmethod
    def sentiment_from_pcr(pcr: float) -> FlowSentiment:
        """Contrarian sentiment from P/C ratio."""
        if pcr > 2.0:
            return FlowSentiment.VERY_BULLISH  # Extreme fear = contrarian buy
        elif pcr > 1.3:
            return FlowSentiment.BULLISH
        elif pcr > 0.8:
            return FlowSentiment.NEUTRAL
        elif pcr > 0.5:
            return FlowSentiment.BEARISH
        else:
            return FlowSentiment.VERY_BEARISH  # Extreme greed = contrarian sell

    @staticmethod
    def skew_analysis(
        calls: list[dict],
        puts: list[dict],
        spot: float,
    ) -> dict:
        """
        Analyze implied volatility skew.
        Rich put IV vs call IV indicates fear/hedging demand.
        """
        if not calls or not puts:
            return {"skew": 0.0, "interpretation": "insufficient_data"}

        # Find ATM IV
        atm_calls = sorted(calls, key=lambda x: abs(x.get("strike", spot) - spot))
        atm_puts = sorted(puts, key=lambda x: abs(x.get("strike", spot) - spot))

        atm_iv = 0.0
        if atm_calls:
            atm_iv = (atm_calls[0].get("iv", 0) + (atm_puts[0].get("iv", 0) if atm_puts else 0)) / 2

        # 25-delta skew approximation: 25d put IV - 25d call IV
        otm_puts = [p for p in puts if p.get("strike", spot) < spot * 0.95]
        otm_calls = [c for c in calls if c.get("strike", spot) > spot * 1.05]

        put_iv_25d = statistics.mean([p["iv"] for p in otm_puts]) if otm_puts else atm_iv
        call_iv_25d = statistics.mean([c["iv"] for c in otm_calls]) if otm_calls else atm_iv

        skew = put_iv_25d - call_iv_25d

        if skew > 0.05:
            interp = "fear_premium_high"
        elif skew > 0.02:
            interp = "moderate_fear"
        elif skew > -0.02:
            interp = "balanced"
        else:
            interp = "call_demand_premium"

        return {
            "skew_25d": round(skew, 4),
            "atm_iv": round(atm_iv, 4),
            "put_iv_25d": round(put_iv_25d, 4),
            "call_iv_25d": round(call_iv_25d, 4),
            "interpretation": interp,
        }


# ── Options Chain Analyzer ────────────────────────────────────────────

class OptionsChainAnalyzer:
    """Analyze the full options chain for key levels and signals."""

    @staticmethod
    def max_pain(
        strikes: list[float],
        call_ois: list[int],
        put_ois: list[int],
        spot: float = 100.0,
    ) -> float:
        """
        Calculate max pain price — level where most options expire worthless.
        """
        if not strikes:
            return spot

        min_pain = float("inf")
        max_pain_strike = strikes[0]

        for test_price in strikes:
            total_pain = 0.0

            for i, strike in enumerate(strikes):
                call_oi = call_ois[i] if i < len(call_ois) else 0
                put_oi = put_ois[i] if i < len(put_ois) else 0

                # Call pain at test_price
                if test_price > strike:
                    total_pain += (test_price - strike) * call_oi * 100

                # Put pain at test_price
                if test_price < strike:
                    total_pain += (strike - test_price) * put_oi * 100

            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = test_price

        return max_pain_strike

    @staticmethod
    def key_levels(
        strikes: list[float],
        call_ois: list[int],
        put_ois: list[int],
        spot: float,
    ) -> dict:
        """Find key options-based support/resistance levels."""
        if not strikes:
            return {}

        # Resistance: high OTM call OI above spot
        otm_calls = [(s, oi) for s, oi in zip(strikes, call_ois) if s > spot]
        # Support: high OTM put OI below spot
        otm_puts = [(s, oi) for s, oi in zip(strikes, put_ois) if s < spot]

        resistance = sorted(otm_calls, key=lambda x: -x[1])[:3] if otm_calls else []
        support = sorted(otm_puts, key=lambda x: -x[1])[:3] if otm_puts else []

        return {
            "max_pain": OptionsChainAnalyzer.max_pain(strikes, call_ois, put_ois, spot),
            "resistance_levels": [{"strike": s, "call_oi": oi} for s, oi in resistance],
            "support_levels": [{"strike": s, "put_oi": oi} for s, oi in support],
            "total_call_oi": sum(call_ois),
            "total_put_oi": sum(put_ois),
            "pcr_oi": round(sum(put_ois) / max(sum(call_ois), 1), 4),
        }

    @staticmethod
    def iv_term_structure(
        expirations: list[str],
        atm_ivs: list[float],
    ) -> dict:
        """Analyze IV term structure for contango/backwardation."""
        if len(atm_ivs) < 2:
            return {"shape": "insufficient_data"}

        diffs = [atm_ivs[i + 1] - atm_ivs[i] for i in range(len(atm_ivs) - 1)]
        avg_slope = statistics.mean(diffs)

        if avg_slope > 0.01:
            shape = "contango"  # Far-dated IV > near-dated
        elif avg_slope < -0.01:
            shape = "backwardation"  # Near-dated IV > far-dated (fear)
        else:
            shape = "flat"

        return {
            "shape": shape,
            "front_iv": round(atm_ivs[0], 4),
            "back_iv": round(atm_ivs[-1], 4),
            "slope": round(avg_slope, 6),
            "data": [{"expiry": e, "iv": round(iv, 4)} for e, iv in zip(expirations, atm_ivs)],
        }


# ── Dark Pool Detector ────────────────────────────────────────────────

class DarkPoolAnalyzer:
    """Detect and analyze dark pool prints in options and equity."""

    @staticmethod
    def classify_print(
        size: int,
        price: float,
        bid: float,
        ask: float,
        avg_daily_volume: float,
        is_options: bool = False,
    ) -> dict:
        """
        Classify if a print is likely a dark pool trade.
        Dark pools: large size, price between bid/ask or outside market, low urgency.
        """
        spread = ask - bid
        mid = (bid + ask) / 2
        price_vs_mid = abs(price - mid) / spread if spread > 0 else 0

        # Dark pool score (0-100)
        score = 0

        # Large block relative to ADV
        adv_pct = size / max(avg_daily_volume, 1) * 100
        if adv_pct > 1:
            score += 40
        elif adv_pct > 0.5:
            score += 20

        # Price at mid (institutional negotiated)
        if price_vs_mid < 0.2:
            score += 30
        elif price_vs_mid < 0.4:
            score += 15

        # Large round number contract size
        if is_options and size % 100 == 0:
            score += 20
        elif not is_options and size % 10000 == 0:
            score += 10

        condition = TradeCondition.DARK_POOL if score >= 50 else TradeCondition.BLOCK if size > 1000 else TradeCondition.STANDARD

        return {
            "dark_pool_score": min(score, 100),
            "likely_dark_pool": score >= 50,
            "adv_pct": round(adv_pct, 4),
            "price_vs_mid_pct": round(price_vs_mid * 100, 2),
            "condition": condition.value,
        }

    @staticmethod
    def find_dark_pool_levels(
        dark_prints: list[dict],
        price_resolution: float = 0.5,
    ) -> list[dict]:
        """Cluster dark pool prints to identify institutional price levels."""
        if not dark_prints:
            return []

        # Group by rounded price
        levels: dict[float, list[dict]] = {}
        for p in dark_prints:
            rounded = round(p.get("price", 0) / price_resolution) * price_resolution
            levels.setdefault(rounded, []).append(p)

        result = []
        for price, prints in levels.items():
            total_size = sum(p.get("size", 0) for p in prints)
            result.append({
                "price_level": price,
                "print_count": len(prints),
                "total_size": total_size,
                "cluster_score": len(prints) * total_size,
            })

        return sorted(result, key=lambda x: -x["cluster_score"])[:20]


# ── Options Flow Aggregator ───────────────────────────────────────────

class OptionsFlowAggregator:
    """Aggregate and score options flow for a symbol or market-wide."""

    @staticmethod
    def aggregate_flow(trades: list[OptionTrade], symbol: str) -> FlowSummary:
        """Aggregate options flow into a summary."""
        summary = FlowSummary(symbol=symbol)

        for trade in trades:
            notional = trade.notional_value
            if trade.option_type == OptionType.CALL:
                summary.call_premium += notional
                summary.call_volume += trade.size
                summary.call_trades += 1
            else:
                summary.put_premium += notional
                summary.put_volume += trade.size
                summary.put_trades += 1

            # Bullish/bearish: buying calls or selling puts = bullish
            if trade.aggressor_side == "ask" and trade.option_type == OptionType.CALL:
                summary.bullish_premium += notional
            elif trade.aggressor_side == "ask" and trade.option_type == OptionType.PUT:
                summary.bearish_premium += notional
            elif trade.aggressor_side == "bid" and trade.option_type == OptionType.PUT:
                summary.bullish_premium += notional  # selling puts = bullish
            elif trade.aggressor_side == "bid" and trade.option_type == OptionType.CALL:
                summary.bearish_premium += notional  # selling calls = bearish

            if trade.condition == TradeCondition.SWEEP:
                summary.sweep_count += 1
            elif trade.condition == TradeCondition.BLOCK:
                summary.block_count += 1

        return summary

    @staticmethod
    def rolling_flow_score(
        summaries: list[FlowSummary],
        window: int = 10,
    ) -> list[float]:
        """
        Calculate rolling flow score (-100 = max bearish, +100 = max bullish).
        """
        scores = []
        for i, s in enumerate(summaries):
            if s.total_premium == 0:
                scores.append(0.0)
                continue

            net_ratio = s.net_premium / s.total_premium  # -1 to +1
            sweep_bonus = min(s.sweep_count / 10, 0.2)
            raw_score = net_ratio * 80 + sweep_bonus * 20
            scores.append(round(max(-100, min(100, raw_score * 100)), 2))

        # Smooth with rolling average
        result = []
        for i in range(len(scores)):
            start = max(0, i - window + 1)
            result.append(round(statistics.mean(scores[start : i + 1]), 2))

        return result

    @staticmethod
    def top_symbols_by_flow(
        symbol_summaries: dict[str, FlowSummary],
        metric: str = "total_premium",
        top_n: int = 10,
    ) -> list[dict]:
        """Rank symbols by options flow metric."""
        return sorted(
            [{"symbol": sym, **s.to_dict()} for sym, s in symbol_summaries.items()],
            key=lambda x: -x.get(metric, 0),
        )[:top_n]


# ── IV Rank & Percentile ──────────────────────────────────────────────

class IVRankAnalyzer:
    """Calculate IV rank and percentile for options premium assessment."""

    @staticmethod
    def iv_rank(current_iv: float, history_52w: list[float]) -> float:
        """
        IV Rank = (current - 52w_low) / (52w_high - 52w_low) * 100.
        >50 = elevated IV, <20 = compressed IV.
        """
        if not history_52w:
            return 50.0
        low = min(history_52w)
        high = max(history_52w)
        if high == low:
            return 50.0
        return round((current_iv - low) / (high - low) * 100, 2)

    @staticmethod
    def iv_percentile(current_iv: float, history_52w: list[float]) -> float:
        """
        IV Percentile = % of days in past year where IV < current IV.
        """
        if not history_52w:
            return 50.0
        return round(sum(1 for v in history_52w if v < current_iv) / len(history_52w) * 100, 2)

    @staticmethod
    def iv_premium_analysis(
        current_iv: float,
        realized_vol_20d: float,
        ivr: float,
    ) -> dict:
        """Analyze IV premium over realized vol."""
        premium = current_iv - realized_vol_20d
        premium_pct = (premium / realized_vol_20d * 100) if realized_vol_20d > 0 else 0

        if ivr > 70 and premium > 0.05:
            strategy = "sell_premium"
            reason = "IV rank high, IV > realized vol"
        elif ivr < 30 and premium < 0:
            strategy = "buy_premium"
            reason = "IV rank low, realized vol > IV"
        elif ivr > 50:
            strategy = "neutral_sell"
            reason = "IV rank elevated"
        else:
            strategy = "neutral_buy"
            reason = "IV rank compressed"

        return {
            "current_iv": round(current_iv, 4),
            "realized_vol_20d": round(realized_vol_20d, 4),
            "iv_premium": round(premium, 4),
            "iv_premium_pct": round(premium_pct, 2),
            "iv_rank": round(ivr, 2),
            "suggested_strategy": strategy,
            "reason": reason,
        }


# ── Expected Move Calculator ──────────────────────────────────────────

class ExpectedMoveCalculator:
    """Calculate options-implied expected move for events and expirations."""

    @staticmethod
    def one_std_move(spot: float, iv: float, days_to_expiry: int) -> float:
        """1 standard deviation expected move based on IV."""
        T = days_to_expiry / 365
        return spot * iv * math.sqrt(T)

    @staticmethod
    def expected_move_range(spot: float, iv: float, days_to_expiry: int) -> dict:
        """Calculate expected move range (1σ, 2σ)."""
        one_sd = ExpectedMoveCalculator.one_std_move(spot, iv, days_to_expiry)
        return {
            "spot": spot,
            "iv": round(iv, 4),
            "dte": days_to_expiry,
            "one_sigma_move": round(one_sd, 2),
            "one_sigma_pct": round(one_sd / spot * 100, 2),
            "upper_1sd": round(spot + one_sd, 2),
            "lower_1sd": round(spot - one_sd, 2),
            "upper_2sd": round(spot + 2 * one_sd, 2),
            "lower_2sd": round(spot - 2 * one_sd, 2),
            "probability_within_1sd": 68.27,
            "probability_within_2sd": 95.45,
        }

    @staticmethod
    def earnings_expected_move(
        atm_straddle_price: float,
        spot: float,
    ) -> dict:
        """
        Estimate earnings expected move from ATM straddle price.
        ~ATM straddle / spot = 1-day expected move %.
        """
        move_pct = atm_straddle_price / spot
        return {
            "expected_move_pct": round(move_pct * 100, 2),
            "expected_move_dollar": round(atm_straddle_price, 2),
            "upper": round(spot * (1 + move_pct), 2),
            "lower": round(spot * (1 - move_pct), 2),
        }


# ── Flow Screener ─────────────────────────────────────────────────────

class OptionsFlowScreener:
    """Screen real-time options flow for high-conviction trades."""

    def __init__(
        self,
        min_premium: float = 50_000,
        min_size: int = 100,
        min_unusual_score: float = 50.0,
    ):
        self.min_premium = min_premium
        self.min_size = min_size
        self.min_unusual_score = min_unusual_score

    def screen(self, trades: list[OptionTrade]) -> list[dict]:
        """Screen trades against criteria."""
        classified = UnusualActivityDetector.classify_activity(trades)
        filtered = [
            t for t in classified
            if t.get("notional", 0) >= self.min_premium
            and t.get("size", 0) >= self.min_size
            and t.get("unusual_score", 0) >= self.min_unusual_score
        ]
        return filtered

    def smart_money_index(self, trades_today: list[OptionTrade]) -> dict:
        """
        Smart money index: compare early vs late session flow.
        Early = dumb money (retail), late = smart money (institutional).
        """
        # Approximate: track by sequence (earlier vs later in list)
        n = len(trades_today)
        if n < 4:
            return {"smart_money_index": 50.0, "bias": "neutral"}

        early_trades = trades_today[:n // 2]
        late_trades = trades_today[n // 2:]

        early_summary = OptionsFlowAggregator.aggregate_flow(early_trades, "MARKET")
        late_summary = OptionsFlowAggregator.aggregate_flow(late_trades, "MARKET")

        early_sentiment = early_summary.sentiment
        late_pcr = late_summary.put_call_ratio_premium

        # Institutional (late) tends toward hedges — if they buy calls late it's more conviction
        smart_bullish = late_summary.bullish_premium > late_summary.bearish_premium
        bias = "bullish" if smart_bullish else "bearish"

        return {
            "smart_money_index": round(late_summary.bullish_premium / max(late_summary.total_premium, 1) * 100, 2),
            "bias": bias,
            "late_session_pcr": round(late_pcr, 4),
            "early_session_sentiment": early_sentiment.value,
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class OptionsFlowEngine:
    """Top-level orchestrator for all options flow analysis."""

    def __init__(self):
        self.greeks = GreeksCalculator()
        self.gex = GammaExposureCalculator()
        self.unusual = UnusualActivityDetector()
        self.pc_analyzer = PutCallAnalyzer()
        self.chain = OptionsChainAnalyzer()
        self.dark_pool = DarkPoolAnalyzer()
        self.aggregator = OptionsFlowAggregator()
        self.iv_rank = IVRankAnalyzer()
        self.expected_move = ExpectedMoveCalculator()
        self.screener = OptionsFlowScreener()

    def analyze_trade(self, trade: OptionTrade, r: float = 0.05) -> dict:
        """Full analysis of a single options trade."""
        # DTE estimation (assume expiry format YYYYMMDD if given)
        T = 30 / 365  # default 30 days
        greeks = self.greeks.all_greeks(
            trade.spot_price, trade.strike, T, r, trade.implied_vol, trade.option_type
        )
        dp = self.dark_pool.classify_print(
            trade.size, trade.premium,
            trade.bid, trade.ask,
            avg_daily_volume=1000, is_options=True,
        )
        return {
            "trade": trade.to_dict(),
            "greeks": greeks,
            "dark_pool": dp,
        }

    def get_flow_summary(self, trades: list[OptionTrade], symbol: str) -> dict:
        """Get full flow summary for a symbol."""
        summary = self.aggregator.aggregate_flow(trades, symbol)
        unusual = self.unusual.classify_activity(trades)
        return {
            "summary": summary.to_dict(),
            "unusual_activity": unusual[:10],
        }

    def get_gex_profile(
        self,
        spot: float,
        strikes: list[float],
        T: float,
        sigma: float,
        call_ois: list[int],
        put_ois: list[int],
    ) -> dict:
        """Get full GEX profile."""
        profile = self.gex.build_gex_profile(spot, strikes, T, sigma, call_ois, put_ois)
        walls = self.gex.find_gamma_walls(profile)
        return {"profile": profile, "walls": walls}

    def get_chain_analysis(
        self,
        strikes: list[float],
        call_ois: list[int],
        put_ois: list[int],
        spot: float,
        calls_iv: list[float] = None,
        puts_iv: list[float] = None,
    ) -> dict:
        """Full options chain analysis."""
        levels = self.chain.key_levels(strikes, call_ois, put_ois, spot)
        calls = [{"strike": s, "iv": iv} for s, iv in zip(strikes, calls_iv or [])] if calls_iv else []
        puts = [{"strike": s, "iv": iv} for s, iv in zip(strikes, puts_iv or [])] if puts_iv else []
        skew = self.pc_analyzer.skew_analysis(calls, puts, spot)
        return {**levels, "skew": skew}

    def get_expected_move(self, spot: float, iv: float, dte: int) -> dict:
        """Calculate expected move."""
        return self.expected_move.expected_move_range(spot, iv, dte)

    def get_iv_analysis(
        self,
        current_iv: float,
        history_52w: list[float],
        realized_vol_20d: float,
    ) -> dict:
        """IV rank, percentile, and premium analysis."""
        ivr = self.iv_rank.iv_rank(current_iv, history_52w)
        ivp = self.iv_rank.iv_percentile(current_iv, history_52w)
        premium = self.iv_rank.iv_premium_analysis(current_iv, realized_vol_20d, ivr)
        return {"iv_rank": ivr, "iv_percentile": ivp, **premium}

    def capabilities(self) -> dict:
        return {
            "engine": "OptionsFlowEngine",
            "version": "1.0.0",
            "features": [
                "black_scholes_greeks_calculator",
                "gamma_exposure_profile_dealer_gex",
                "unusual_activity_detection_scoring",
                "put_call_ratio_analysis",
                "iv_skew_analysis_25delta",
                "max_pain_calculation",
                "dark_pool_print_detection",
                "dark_pool_level_clustering",
                "options_flow_aggregation",
                "rolling_flow_score",
                "iv_rank_iv_percentile",
                "iv_premium_over_realized",
                "expected_move_1sd_2sd",
                "earnings_expected_move",
                "smart_money_index",
                "gamma_wall_detection",
                "options_chain_key_levels",
                "iv_term_structure_analysis",
            ],
        }
