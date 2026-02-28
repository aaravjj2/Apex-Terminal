"""
Market Microstructure Engine — Tick-level analysis, trade classification,
price discovery, information asymmetry, high-frequency metrics, order flow
analysis, PIN model, adverse selection, market maker profit decomposition.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class PriceDiscoveryMethod(str, Enum):
    HASBROUCK = "hasbrouck"
    GONZALO_GRANGER = "gonzalo_granger"
    MIDPOINT = "midpoint"


class QuoteType(str, Enum):
    NBB = "nbb"  # National Best Bid
    NBO = "nbo"  # National Best Offer
    MID = "mid"


@dataclass
class TickData:
    timestamp: float
    price: float
    volume: float
    bid: float = 0.0
    ask: float = 0.0
    trade_sign: int = 0  # +1 buy, -1 sell, 0 unknown
    venue: str = ""

    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2 if self.bid > 0 and self.ask > 0 else self.price

    @property
    def spread(self) -> float:
        return self.ask - self.bid if self.bid > 0 and self.ask > 0 else 0


@dataclass
class PINResult:
    pin: float
    alpha: float
    delta: float
    mu: float
    epsilon_buy: float
    epsilon_sell: float
    informed_probability: float

    def to_dict(self) -> dict:
        return {
            "pin": round(self.pin, 6),
            "alpha": round(self.alpha, 4),
            "delta": round(self.delta, 4),
            "mu": round(self.mu, 4),
            "epsilon_buy": round(self.epsilon_buy, 4),
            "epsilon_sell": round(self.epsilon_sell, 4),
            "informed_probability": round(self.informed_probability, 4),
        }


# ── Trade Classification ─────────────────────────────────────────────

class TradeClassifier:
    @staticmethod
    def lee_ready(ticks: list[TickData]) -> list[TickData]:
        """
        Lee-Ready (1991) trade classification algorithm.
        Step 1: Quote test — compare price to midpoint
        Step 2: Tick test — compare to previous price
        """
        classified = []
        for i, tick in enumerate(ticks):
            if tick.trade_sign != 0:
                classified.append(tick)
                continue

            mid = tick.mid
            if tick.price > mid + 1e-10:
                tick.trade_sign = 1  # buy
            elif tick.price < mid - 1e-10:
                tick.trade_sign = -1  # sell
            elif i > 0:
                # Tick test
                if tick.price > ticks[i - 1].price:
                    tick.trade_sign = 1
                elif tick.price < ticks[i - 1].price:
                    tick.trade_sign = -1
                else:
                    tick.trade_sign = ticks[i - 1].trade_sign if ticks[i - 1].trade_sign != 0 else 1
            else:
                tick.trade_sign = 1

            classified.append(tick)
        return classified

    @staticmethod
    def bulk_volume_classification(
        prices: list[float],
        volumes: list[float],
        sigma: float,
    ) -> list[float]:
        """
        Easley, Lopez de Prado, O'Hara (2012) BVC.
        Probabilistic trade classification.
        """
        n = len(prices)
        if n < 2 or sigma <= 0:
            return [0.0] * n

        classified = [0.0]
        for i in range(1, n):
            delta_p = prices[i] - prices[i - 1]
            # Standard normal CDF approximation
            z = delta_p / sigma
            buy_prob = 0.5 * (1 + math.erf(z / math.sqrt(2)))
            buy_vol = volumes[i] * buy_prob
            sell_vol = volumes[i] * (1 - buy_prob)
            classified.append(buy_vol - sell_vol)  # Signed volume

        return classified

    @staticmethod
    def emo_rule(ticks: list[TickData]) -> list[TickData]:
        """
        Ellis, Michaely, O'Hara (2000) trade classification.
        Modified version of Lee-Ready.
        """
        classified = []
        for i, tick in enumerate(ticks):
            mid = tick.mid

            # Step 1: if at ask -> buy, if at bid -> sell
            if abs(tick.price - tick.ask) < 1e-10:
                tick.trade_sign = 1
            elif abs(tick.price - tick.bid) < 1e-10:
                tick.trade_sign = -1
            # Step 2: if inside quote, use tick test
            elif tick.price > mid:
                tick.trade_sign = 1
            elif tick.price < mid:
                tick.trade_sign = -1
            elif i > 0:
                tick.trade_sign = ticks[i - 1].trade_sign if ticks[i - 1].trade_sign != 0 else 1
            else:
                tick.trade_sign = 1

            classified.append(tick)
        return classified


# ── PIN Model ─────────────────────────────────────────────────────────

class PINModel:
    """Probability of Informed Trading (Easley et al., 1996)."""

    @staticmethod
    def estimate(
        buy_counts: list[int],
        sell_counts: list[int],
        n_iterations: int = 200,
    ) -> PINResult:
        """
        Estimate PIN using EM algorithm.
        buy_counts, sell_counts: daily buy/sell trade counts
        """
        n = len(buy_counts)
        if n == 0:
            return PINResult(0, 0, 0, 0, 0, 0, 0)

        # Initial parameter estimates
        total_buys = sum(buy_counts)
        total_sells = sum(sell_counts)
        avg_total = (total_buys + total_sells) / (2 * n) if n > 0 else 1

        alpha = 0.5  # probability of information event
        delta = 0.5  # probability of bad news given event
        mu = avg_total * 0.3  # informed trader arrival rate
        epsilon_b = avg_total * 0.7  # uninformed buy rate
        epsilon_s = avg_total * 0.7  # uninformed sell rate

        lr = 0.01

        for iteration in range(n_iterations):
            # E-step: compute posterior probabilities for each day
            log_post_no_event = []
            log_post_good = []
            log_post_bad = []

            for i in range(n):
                B = buy_counts[i]
                S = sell_counts[i]

                # Poisson log-likelihoods (using Stirling approx for stability)
                def poisson_loglik(count: int, rate: float) -> float:
                    if rate <= 0:
                        return -100
                    return count * math.log(rate + 1e-30) - rate

                ll_no = (math.log(max(1 - alpha, 1e-30))
                         + poisson_loglik(B, epsilon_b)
                         + poisson_loglik(S, epsilon_s))

                ll_good = (math.log(max(alpha * (1 - delta), 1e-30))
                           + poisson_loglik(B, epsilon_b + mu)
                           + poisson_loglik(S, epsilon_s))

                ll_bad = (math.log(max(alpha * delta, 1e-30))
                          + poisson_loglik(B, epsilon_b)
                          + poisson_loglik(S, epsilon_s + mu))

                log_post_no_event.append(ll_no)
                log_post_good.append(ll_good)
                log_post_bad.append(ll_bad)

            # Normalize posteriors
            posteriors_no = []
            posteriors_good = []
            posteriors_bad = []

            for i in range(n):
                max_ll = max(log_post_no_event[i], log_post_good[i], log_post_bad[i])
                p_no = math.exp(log_post_no_event[i] - max_ll)
                p_good = math.exp(log_post_good[i] - max_ll)
                p_bad = math.exp(log_post_bad[i] - max_ll)
                total = p_no + p_good + p_bad + 1e-30

                posteriors_no.append(p_no / total)
                posteriors_good.append(p_good / total)
                posteriors_bad.append(p_bad / total)

            # M-step: update parameters
            sum_no = sum(posteriors_no)
            sum_good = sum(posteriors_good)
            sum_bad = sum(posteriors_bad)

            alpha_new = (sum_good + sum_bad) / n if n > 0 else alpha
            delta_new = sum_bad / (sum_good + sum_bad) if (sum_good + sum_bad) > 0 else delta

            # Update rates
            ep_b_num = sum(posteriors_no[i] * buy_counts[i] + posteriors_bad[i] * buy_counts[i] for i in range(n))
            ep_b_den = sum_no + sum_bad
            epsilon_b_new = ep_b_num / ep_b_den if ep_b_den > 0 else epsilon_b

            ep_s_num = sum(posteriors_no[i] * sell_counts[i] + posteriors_good[i] * sell_counts[i] for i in range(n))
            ep_s_den = sum_no + sum_good
            epsilon_s_new = ep_s_num / ep_s_den if ep_s_den > 0 else epsilon_s

            mu_num_b = sum(posteriors_good[i] * (buy_counts[i] - epsilon_b_new) for i in range(n))
            mu_num_s = sum(posteriors_bad[i] * (sell_counts[i] - epsilon_s_new) for i in range(n))
            mu_den = sum_good + sum_bad
            mu_new = max((mu_num_b + mu_num_s) / mu_den if mu_den > 0 else mu, 0.01)

            # Smooth update
            alpha = 0.7 * alpha + 0.3 * max(min(alpha_new, 0.99), 0.01)
            delta = 0.7 * delta + 0.3 * max(min(delta_new, 0.99), 0.01)
            mu = 0.7 * mu + 0.3 * mu_new
            epsilon_b = 0.7 * epsilon_b + 0.3 * max(epsilon_b_new, 0.01)
            epsilon_s = 0.7 * epsilon_s + 0.3 * max(epsilon_s_new, 0.01)

        # Calculate PIN
        pin = alpha * mu / (alpha * mu + epsilon_b + epsilon_s) if (alpha * mu + epsilon_b + epsilon_s) > 0 else 0

        return PINResult(
            pin=pin,
            alpha=alpha,
            delta=delta,
            mu=mu,
            epsilon_buy=epsilon_b,
            epsilon_sell=epsilon_s,
            informed_probability=alpha,
        )


# ── Price Discovery ───────────────────────────────────────────────────

class PriceDiscovery:
    @staticmethod
    def hasbrouck_information_share(
        prices_venue1: list[float],
        prices_venue2: list[float],
    ) -> dict:
        """
        Hasbrouck (1995) information share.
        Measures each venue's contribution to price discovery.
        """
        n = min(len(prices_venue1), len(prices_venue2))
        if n < 5:
            return {"venue1_share": 0.5, "venue2_share": 0.5}

        ret1 = [prices_venue1[i] - prices_venue1[i - 1] for i in range(1, n)]
        ret2 = [prices_venue2[i] - prices_venue2[i - 1] for i in range(1, n)]

        # Variance of returns
        var1 = statistics.variance(ret1)
        var2 = statistics.variance(ret2)
        cov12 = sum((ret1[i] - statistics.mean(ret1)) * (ret2[i] - statistics.mean(ret2)) for i in range(len(ret1))) / (len(ret1) - 1)

        total_var = var1 + var2 + 2 * cov12
        if total_var <= 0:
            return {"venue1_share": 0.5, "venue2_share": 0.5}

        # Cholesky decomposition for 2x2
        # Upper bound for venue 1
        a11 = math.sqrt(var1)
        a12 = cov12 / a11 if a11 > 0 else 0
        a22 = math.sqrt(max(var2 - a12 ** 2, 0))

        gamma = [1.0, 1.0]  # Cointegrating vector impact
        psi1 = gamma[0] * a11 + gamma[1] * a12
        psi2 = gamma[1] * a22

        total_psi = psi1 ** 2 + psi2 ** 2
        if total_psi <= 0:
            return {"venue1_share": 0.5, "venue2_share": 0.5}

        is_upper_v1 = (psi1 ** 2) / total_psi
        is_upper_v2 = 1 - is_upper_v1

        return {
            "venue1_information_share": round(is_upper_v1, 4),
            "venue2_information_share": round(is_upper_v2, 4),
            "lead_venue": "venue1" if is_upper_v1 > is_upper_v2 else "venue2",
        }

    @staticmethod
    def component_share(
        prices_venue1: list[float],
        prices_venue2: list[float],
    ) -> dict:
        """
        Gonzalo-Granger (1995) Component Share.
        Based on error correction model.
        """
        n = min(len(prices_venue1), len(prices_venue2))
        if n < 10:
            return {"venue1_share": 0.5, "venue2_share": 0.5}

        # Simple error correction estimation
        spreads = [prices_venue1[i] - prices_venue2[i] for i in range(n)]
        ret1 = [prices_venue1[i] - prices_venue1[i - 1] for i in range(1, n)]
        ret2 = [prices_venue2[i] - prices_venue2[i - 1] for i in range(1, n)]

        # Regress returns on lagged spread
        m = len(ret1)
        lagged_spread = spreads[:m]

        # Estimate alpha1 = response of venue1 to equilibrium error
        sum_xy1 = sum(ret1[i] * lagged_spread[i] for i in range(m))
        sum_xy2 = sum(ret2[i] * lagged_spread[i] for i in range(m))
        sum_xx = sum(s ** 2 for s in lagged_spread)

        alpha1 = sum_xy1 / sum_xx if sum_xx > 0 else 0
        alpha2 = sum_xy2 / sum_xx if sum_xx > 0 else 0

        # GG component share
        total_alpha = abs(alpha1) + abs(alpha2)
        if total_alpha <= 0:
            return {"venue1_share": 0.5, "venue2_share": 0.5}

        # Venue that adjusts less has more price discovery
        cs_v1 = abs(alpha2) / total_alpha
        cs_v2 = abs(alpha1) / total_alpha

        return {
            "venue1_component_share": round(cs_v1, 4),
            "venue2_component_share": round(cs_v2, 4),
            "alpha1_error_correction": round(alpha1, 6),
            "alpha2_error_correction": round(alpha2, 6),
            "dominant_venue": "venue1" if cs_v1 > cs_v2 else "venue2",
        }


# ── Information Asymmetry ────────────────────────────────────────────

class InformationAsymmetry:
    @staticmethod
    def adverse_selection_component(
        effective_spreads: list[float],
        realized_spreads: list[float],
    ) -> dict:
        """Adverse selection = effective spread - realized spread."""
        n = min(len(effective_spreads), len(realized_spreads))
        if n == 0:
            return {"adverse_selection": 0}

        as_component = [effective_spreads[i] - realized_spreads[i] for i in range(n)]

        return {
            "avg_adverse_selection": round(statistics.mean(as_component), 6),
            "median_adverse_selection": round(statistics.median(as_component), 6),
            "avg_effective_spread": round(statistics.mean(effective_spreads[:n]), 6),
            "avg_realized_spread": round(statistics.mean(realized_spreads[:n]), 6),
            "as_pct_of_effective": round(
                statistics.mean(as_component) / statistics.mean(effective_spreads[:n]) * 100
                if statistics.mean(effective_spreads[:n]) > 0 else 0, 2
            ),
        }

    @staticmethod
    def trade_informativeness(
        returns_after_trade: list[float],
        trade_signs: list[int],
        horizons: list[int] = [1, 5, 10, 30],
    ) -> dict:
        """Measure how informative trades are at different horizons."""
        n = len(trade_signs)
        results = {}

        for h in horizons:
            if n < h + 1:
                results[f"horizon_{h}"] = {"informativeness": 0, "hit_rate": 0}
                continue

            correct = 0
            total = 0
            cum_return = 0.0

            for i in range(n - h):
                if trade_signs[i] == 0:
                    continue
                total += 1
                ret = returns_after_trade[min(i + h, len(returns_after_trade) - 1)]
                if trade_signs[i] * ret > 0:
                    correct += 1
                cum_return += trade_signs[i] * ret

            hit_rate = correct / total if total > 0 else 0
            avg_return = cum_return / total if total > 0 else 0

            results[f"horizon_{h}"] = {
                "informativeness": round(avg_return, 6),
                "hit_rate": round(hit_rate, 4),
                "n_trades": total,
            }

        return results


# ── Tick Analysis ─────────────────────────────────────────────────────

class TickAnalysis:
    @staticmethod
    def tick_statistics(ticks: list[TickData]) -> dict:
        if not ticks:
            return {}

        prices = [t.price for t in ticks]
        volumes = [t.volume for t in ticks]
        spreads = [t.spread for t in ticks if t.spread > 0]

        # Inter-trade duration
        durations = []
        for i in range(1, len(ticks)):
            dt = ticks[i].timestamp - ticks[i - 1].timestamp
            if dt > 0:
                durations.append(dt)

        # Trade size distribution
        volume_buckets = {"micro": 0, "small": 0, "medium": 0, "large": 0, "block": 0}
        for v in volumes:
            if v < 100:
                volume_buckets["micro"] += 1
            elif v < 500:
                volume_buckets["small"] += 1
            elif v < 5000:
                volume_buckets["medium"] += 1
            elif v < 50000:
                volume_buckets["large"] += 1
            else:
                volume_buckets["block"] += 1

        return {
            "n_ticks": len(ticks),
            "price_range": round(max(prices) - min(prices), 6),
            "avg_price": round(statistics.mean(prices), 6),
            "avg_volume": round(statistics.mean(volumes), 2),
            "total_volume": round(sum(volumes), 2),
            "avg_spread": round(statistics.mean(spreads), 6) if spreads else 0,
            "avg_inter_trade_duration": round(statistics.mean(durations), 4) if durations else 0,
            "trade_size_distribution": volume_buckets,
            "buy_count": sum(1 for t in ticks if t.trade_sign == 1),
            "sell_count": sum(1 for t in ticks if t.trade_sign == -1),
        }

    @staticmethod
    def autocorrelation(prices: list[float], max_lag: int = 10) -> dict:
        if len(prices) < max_lag + 2:
            return {}

        returns = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
        n = len(returns)
        mean_r = statistics.mean(returns)
        var_r = sum((r - mean_r) ** 2 for r in returns) / n

        if var_r <= 0:
            return {f"lag_{k}": 0 for k in range(1, max_lag + 1)}

        result = {}
        for k in range(1, max_lag + 1):
            cov_k = sum((returns[i] - mean_r) * (returns[i - k] - mean_r) for i in range(k, n)) / n
            result[f"lag_{k}"] = round(cov_k / var_r, 4)

        return result

    @staticmethod
    def trade_arrival_intensity(
        timestamps: list[float],
        bucket_seconds: float = 60.0,
    ) -> list[dict]:
        if not timestamps:
            return []

        min_t = min(timestamps)
        max_t = max(timestamps)
        n_buckets = int((max_t - min_t) / bucket_seconds) + 1 if bucket_seconds > 0 else 1

        buckets = [0] * n_buckets
        for t in timestamps:
            idx = min(int((t - min_t) / bucket_seconds), n_buckets - 1) if bucket_seconds > 0 else 0
            buckets[idx] += 1

        return [
            {"bucket": i, "count": buckets[i], "rate": round(buckets[i] / bucket_seconds, 4) if bucket_seconds > 0 else 0}
            for i in range(n_buckets)
        ]


# ── Market Maker Analytics ────────────────────────────────────────────

class MarketMakerAnalytics:
    @staticmethod
    def mm_pnl_decomposition(
        spreads_earned: list[float],
        adverse_selection_costs: list[float],
        inventory_costs: list[float],
    ) -> dict:
        n = min(len(spreads_earned), len(adverse_selection_costs), len(inventory_costs))
        if n == 0:
            return {}

        total_spread = sum(spreads_earned[:n])
        total_as = sum(adverse_selection_costs[:n])
        total_inv = sum(inventory_costs[:n])
        total_pnl = total_spread - total_as - total_inv

        return {
            "total_spread_earned": round(total_spread, 2),
            "total_adverse_selection_cost": round(total_as, 2),
            "total_inventory_cost": round(total_inv, 2),
            "net_pnl": round(total_pnl, 2),
            "spread_capture_rate": round(total_spread / (total_spread + total_as + total_inv) * 100 if (total_spread + total_as + total_inv) > 0 else 0, 2),
            "as_pct": round(total_as / total_spread * 100 if total_spread > 0 else 0, 2),
        }

    @staticmethod
    def optimal_quote(
        mid_price: float,
        sigma: float,
        gamma: float,
        inventory: float,
        n_remaining: int,
    ) -> dict:
        """
        Avellaneda-Stoikov optimal market making quotes.
        """
        T = 1.0
        t = 1.0 - n_remaining / max(1, n_remaining + 1)

        # Reservation price
        reservation = mid_price - inventory * gamma * sigma ** 2 * (T - t)

        # Optimal spread
        spread = gamma * sigma ** 2 * (T - t) + 2 / gamma * math.log(1 + gamma / 1)

        bid = reservation - spread / 2
        ask = reservation + spread / 2

        return {
            "reservation_price": round(reservation, 6),
            "optimal_spread": round(spread, 6),
            "bid": round(bid, 6),
            "ask": round(ask, 6),
            "inventory_skew": round(mid_price - reservation, 6),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class MarketMicrostructureEngine:
    def __init__(self) -> None:
        self.classifier = TradeClassifier()
        self.pin = PINModel()
        self.discovery = PriceDiscovery()
        self.asymmetry = InformationAsymmetry()
        self.tick_analysis = TickAnalysis()
        self.mm = MarketMakerAnalytics()

    def classify_trades(self, ticks: list[TickData], method: str = "lee_ready") -> list[TickData]:
        if method == "emo":
            return self.classifier.emo_rule(ticks)
        return self.classifier.lee_ready(ticks)

    def estimate_pin(self, buy_counts: list[int], sell_counts: list[int]) -> dict:
        result = self.pin.estimate(buy_counts, sell_counts)
        return result.to_dict()

    def price_discovery(
        self,
        prices_v1: list[float],
        prices_v2: list[float],
        method: str = "hasbrouck",
    ) -> dict:
        if method == "gonzalo_granger":
            return self.discovery.component_share(prices_v1, prices_v2)
        return self.discovery.hasbrouck_information_share(prices_v1, prices_v2)

    def adverse_selection(self, effective: list[float], realized: list[float]) -> dict:
        return self.asymmetry.adverse_selection_component(effective, realized)

    def tick_stats(self, ticks: list[TickData]) -> dict:
        return self.tick_analysis.tick_statistics(ticks)

    def optimal_mm_quote(self, **kwargs) -> dict:
        return self.mm.optimal_quote(**kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "MarketMicrostructureEngine",
            "version": "1.0.0",
            "features": [
                "trade_classification (Lee-Ready, EMO)",
                "bulk_volume_classification",
                "PIN_model (probability of informed trading)",
                "price_discovery (Hasbrouck, Gonzalo-Granger)",
                "information_asymmetry_analysis",
                "adverse_selection_measurement",
                "trade_informativeness_analysis",
                "tick_statistics",
                "return_autocorrelation",
                "trade_arrival_intensity",
                "market_maker_pnl_decomposition",
                "optimal_market_making (Avellaneda-Stoikov)",
            ],
        }
