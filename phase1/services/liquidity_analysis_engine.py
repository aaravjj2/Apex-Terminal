"""
Liquidity Analysis Engine — Market liquidity scoring, bid-ask analysis,
market impact models, liquidity risk metrics, optimal execution algorithms,
slippage estimation, liquidity-adjusted VaR, position sizing with liquidity.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class LiquidityTier(str, Enum):
    ULTRA_LIQUID = "ultra_liquid"
    HIGHLY_LIQUID = "highly_liquid"
    LIQUID = "liquid"
    SEMI_LIQUID = "semi_liquid"
    ILLIQUID = "illiquid"
    HIGHLY_ILLIQUID = "highly_illiquid"


class ExecutionStrategy(str, Enum):
    TWAP = "twap"
    VWAP = "vwap"
    ARRIVAL_PRICE = "arrival_price"
    IS_MINIMIZE = "implementation_shortfall"
    PERCENT_OF_VOLUME = "percent_of_volume"
    MARKET_ON_CLOSE = "market_on_close"
    ICEBERG = "iceberg"
    DARK_POOL = "dark_pool"


@dataclass
class LiquidityProfile:
    symbol: str
    avg_daily_volume: float
    avg_daily_dollar_volume: float
    avg_spread_bps: float
    spread_volatility: float
    depth_score: float
    resilience_score: float
    tier: str
    score: float

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "avg_daily_volume": round(self.avg_daily_volume, 0),
            "avg_daily_dollar_volume": round(self.avg_daily_dollar_volume, 0),
            "avg_spread_bps": round(self.avg_spread_bps, 2),
            "spread_volatility": round(self.spread_volatility, 4),
            "depth_score": round(self.depth_score, 2),
            "resilience_score": round(self.resilience_score, 2),
            "tier": self.tier,
            "composite_score": round(self.score, 2),
        }


@dataclass
class SlippageEstimate:
    expected_slippage_bps: float
    best_case_bps: float
    worst_case_bps: float
    confidence_interval_95: tuple[float, float]
    estimated_cost: float

    def to_dict(self) -> dict:
        return {
            "expected_slippage_bps": round(self.expected_slippage_bps, 2),
            "best_case_bps": round(self.best_case_bps, 2),
            "worst_case_bps": round(self.worst_case_bps, 2),
            "confidence_interval_95": (round(self.confidence_interval_95[0], 2), round(self.confidence_interval_95[1], 2)),
            "estimated_cost": round(self.estimated_cost, 2),
        }


@dataclass
class ExecutionPlan:
    strategy: str
    total_quantity: float
    n_slices: int
    slice_schedule: list[dict]
    estimated_total_cost: float
    estimated_market_impact_bps: float
    estimated_timing_risk_bps: float

    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "total_quantity": round(self.total_quantity, 4),
            "n_slices": self.n_slices,
            "slice_schedule": self.slice_schedule,
            "estimated_total_cost": round(self.estimated_total_cost, 2),
            "estimated_market_impact_bps": round(self.estimated_market_impact_bps, 2),
            "estimated_timing_risk_bps": round(self.estimated_timing_risk_bps, 2),
        }


# ── Liquidity Scoring ────────────────────────────────────────────────

class LiquidityScoring:
    @staticmethod
    def composite_score(
        avg_daily_volume: float,
        avg_dollar_volume: float,
        avg_spread_bps: float,
        spread_vol: float,
        depth: float,
        resilience: float,
    ) -> tuple[float, str]:
        """
        Compute composite liquidity score (0-100) and assign tier.
        Components:
        - Volume (30%): higher volume = more liquid
        - Dollar Volume (20%): higher dollar volume = more liquid
        - Spread (25%): tighter spread = more liquid
        - Depth (15%): deeper book = more liquid
        - Resilience (10%): faster recovery = more liquid
        """
        # Volume score: log-scale
        vol_score = min(100, max(0, 15 * math.log10(avg_daily_volume + 1)))
        dvol_score = min(100, max(0, 10 * math.log10(avg_dollar_volume + 1)))

        # Spread score: tighter is better (invert)
        spread_score = max(0, 100 - avg_spread_bps * 5)

        # Depth score: 0-100 already
        depth_score = min(100, max(0, depth))

        # Resilience score: 0-100 already
        res_score = min(100, max(0, resilience))

        composite = (
            vol_score * 0.30
            + dvol_score * 0.20
            + spread_score * 0.25
            + depth_score * 0.15
            + res_score * 0.10
        )

        # Assign tier
        if composite >= 85:
            tier = LiquidityTier.ULTRA_LIQUID.value
        elif composite >= 70:
            tier = LiquidityTier.HIGHLY_LIQUID.value
        elif composite >= 55:
            tier = LiquidityTier.LIQUID.value
        elif composite >= 40:
            tier = LiquidityTier.SEMI_LIQUID.value
        elif composite >= 25:
            tier = LiquidityTier.ILLIQUID.value
        else:
            tier = LiquidityTier.HIGHLY_ILLIQUID.value

        return composite, tier

    @staticmethod
    def build_profile(
        symbol: str,
        daily_volumes: list[float],
        daily_dollar_volumes: list[float],
        daily_spreads_bps: list[float],
        depth_score: float = 50.0,
        resilience_score: float = 50.0,
    ) -> LiquidityProfile:
        adv = statistics.mean(daily_volumes) if daily_volumes else 0
        addv = statistics.mean(daily_dollar_volumes) if daily_dollar_volumes else 0
        avg_spread = statistics.mean(daily_spreads_bps) if daily_spreads_bps else 0
        spread_vol = statistics.stdev(daily_spreads_bps) if len(daily_spreads_bps) > 1 else 0

        score, tier = LiquidityScoring.composite_score(
            adv, addv, avg_spread, spread_vol, depth_score, resilience_score
        )

        return LiquidityProfile(
            symbol=symbol,
            avg_daily_volume=adv,
            avg_daily_dollar_volume=addv,
            avg_spread_bps=avg_spread,
            spread_volatility=spread_vol,
            depth_score=depth_score,
            resilience_score=resilience_score,
            tier=tier,
            score=score,
        )


# ── Bid-Ask Spread Analysis ──────────────────────────────────────────

class SpreadDecomposition:
    @staticmethod
    def huang_stoll(
        spreads: list[float],
        quote_changes: list[float],
    ) -> dict:
        """
        Huang and Stoll (1997) three-way spread decomposition.
        Components: adverse selection, inventory, order processing.
        """
        n = min(len(spreads), len(quote_changes))
        if n < 5:
            return {"adverse_selection": 0, "inventory": 0, "order_processing": 0}

        avg_spread = statistics.mean(spreads[:n])
        avg_change = statistics.mean([abs(q) for q in quote_changes[:n]])

        # Simplified decomposition
        adverse_selection_pct = avg_change / avg_spread if avg_spread > 0 else 0
        adverse_selection_pct = min(max(adverse_selection_pct, 0), 1)

        # Remainder split between inventory and order processing
        remaining = 1 - adverse_selection_pct
        inventory_pct = remaining * 0.4
        order_processing_pct = remaining * 0.6

        return {
            "adverse_selection_pct": round(adverse_selection_pct, 4),
            "inventory_pct": round(inventory_pct, 4),
            "order_processing_pct": round(order_processing_pct, 4),
            "adverse_selection_cost": round(adverse_selection_pct * avg_spread, 6),
            "inventory_cost": round(inventory_pct * avg_spread, 6),
            "order_processing_cost": round(order_processing_pct * avg_spread, 6),
            "total_spread": round(avg_spread, 6),
        }

    @staticmethod
    def glosten_harris(
        trade_prices: list[float],
        trade_signs: list[float],  # +1 buy, -1 sell
        trade_volumes: list[float],
    ) -> dict:
        """
        Glosten-Harris (1988) model for spread estimation.
        Price change = c0 * sign_change + c1 * (signed_vol_change) + noise
        """
        n = min(len(trade_prices), len(trade_signs), len(trade_volumes))
        if n < 5:
            return {"permanent_impact": 0, "temporary_impact": 0, "effective_spread": 0}

        price_changes = [trade_prices[i] - trade_prices[i - 1] for i in range(1, n)]
        sign_changes = [trade_signs[i] - trade_signs[i - 1] for i in range(1, n)]
        vol_signs = [trade_signs[i] * trade_volumes[i] for i in range(n)]
        vol_sign_changes = [vol_signs[i] - vol_signs[i - 1] for i in range(1, n)]

        # OLS for c0, c1
        m = len(price_changes)
        sum_y = sum(price_changes)
        sum_x1 = sum(sign_changes)
        sum_x2 = sum(vol_sign_changes)
        sum_x1y = sum(sign_changes[i] * price_changes[i] for i in range(m))
        sum_x2y = sum(vol_sign_changes[i] * price_changes[i] for i in range(m))
        sum_x1x1 = sum(x * x for x in sign_changes)
        sum_x2x2 = sum(x * x for x in vol_sign_changes)
        sum_x1x2 = sum(sign_changes[i] * vol_sign_changes[i] for i in range(m))

        # Solve 2x2 system
        det = sum_x1x1 * sum_x2x2 - sum_x1x2 ** 2
        if abs(det) < 1e-12:
            return {"permanent_impact": 0, "temporary_impact": 0, "effective_spread": 0}

        c0 = (sum_x2x2 * sum_x1y - sum_x1x2 * sum_x2y) / det
        c1 = (sum_x1x1 * sum_x2y - sum_x1x2 * sum_x1y) / det

        return {
            "permanent_impact_per_unit": round(c1, 8),
            "temporary_impact": round(c0, 6),
            "effective_half_spread": round(abs(c0), 6),
            "effective_spread": round(2 * abs(c0), 6),
        }


# ── Slippage Estimation ──────────────────────────────────────────────

class SlippageEstimator:
    @staticmethod
    def estimate(
        order_size: float,
        avg_daily_volume: float,
        volatility: float,
        avg_spread_bps: float,
        price: float,
        urgency: float = 0.5,  # 0 = patient, 1 = urgent
    ) -> SlippageEstimate:
        """Estimate market impact slippage."""
        participation = order_size / avg_daily_volume if avg_daily_volume > 0 else 1.0

        # Permanent impact: Barra-style sqrt model
        permanent_bps = 10 * volatility * math.sqrt(participation) * 10000

        # Temporary impact
        temporary_bps = avg_spread_bps / 2 + urgency * 5 * volatility * participation * 10000

        # Total expected slippage
        expected = permanent_bps + temporary_bps

        # Uncertainty
        sigma = volatility * math.sqrt(participation) * 10000
        best_case = max(0, expected - 2 * sigma)
        worst_case = expected + 2 * sigma
        ci_95 = (max(0, expected - 1.96 * sigma), expected + 1.96 * sigma)

        estimated_cost = expected / 10000 * price * order_size

        return SlippageEstimate(
            expected_slippage_bps=expected,
            best_case_bps=best_case,
            worst_case_bps=worst_case,
            confidence_interval_95=ci_95,
            estimated_cost=estimated_cost,
        )


# ── Optimal Execution ────────────────────────────────────────────────

class OptimalExecution:
    @staticmethod
    def twap_schedule(
        total_quantity: float,
        n_intervals: int = 78,  # 5-min intervals in 6.5 hour day
        start_pct: float = 0.0,
        end_pct: float = 1.0,
    ) -> list[dict]:
        """Generate TWAP execution schedule."""
        active_intervals = int(n_intervals * (end_pct - start_pct))
        if active_intervals <= 0:
            return []

        qty_per_interval = total_quantity / active_intervals
        schedule = []

        for i in range(n_intervals):
            pct = (i + 1) / n_intervals
            if start_pct <= pct <= end_pct:
                schedule.append({
                    "interval": i + 1,
                    "time_pct": round(pct, 4),
                    "quantity": round(qty_per_interval, 4),
                    "cumulative_quantity": round(len(schedule) * qty_per_interval + qty_per_interval, 4),
                })
            else:
                schedule.append({
                    "interval": i + 1,
                    "time_pct": round(pct, 4),
                    "quantity": 0,
                    "cumulative_quantity": round(sum(s["quantity"] for s in schedule), 4),
                })

        return schedule

    @staticmethod
    def vwap_schedule(
        total_quantity: float,
        volume_profile: list[float],
    ) -> list[dict]:
        """Generate VWAP execution schedule based on historical volume profile."""
        if not volume_profile:
            return []

        total_vol = sum(volume_profile)
        if total_vol <= 0:
            return []

        schedule = []
        cumulative = 0.0

        for i, vol in enumerate(volume_profile):
            pct = vol / total_vol
            qty = total_quantity * pct
            cumulative += qty
            schedule.append({
                "interval": i + 1,
                "volume_pct": round(pct, 4),
                "quantity": round(qty, 4),
                "cumulative_quantity": round(cumulative, 4),
            })

        return schedule

    @staticmethod
    def almgren_chriss_optimal(
        total_quantity: float,
        n_intervals: int,
        volatility: float,
        eta: float,  # temporary impact parameter
        gamma: float,  # permanent impact parameter
        risk_aversion: float = 1e-6,
    ) -> list[dict]:
        """
        Almgren-Chriss optimal execution trajectory.
        Minimizes: E[cost] + lambda * Var[cost]
        """
        if n_intervals <= 0:
            return []

        tau = 1.0 / n_intervals
        kappa_sq = risk_aversion * volatility ** 2 / (eta * (1 / tau - 0.5 * gamma))
        kappa = math.sqrt(max(kappa_sq, 1e-12))

        # Optimal trajectory: x_j = X * sinh(kappa*(T-t_j)) / sinh(kappa*T)
        T = n_intervals * tau
        schedule = []
        cumulative_traded = 0.0
        remaining = total_quantity

        for j in range(n_intervals):
            t_j = j * tau
            if abs(math.sinh(kappa * T)) < 1e-12:
                fraction = 1.0 / n_intervals
            else:
                frac_remaining = math.sinh(kappa * (T - t_j)) / math.sinh(kappa * T)
                frac_next = math.sinh(kappa * (T - (t_j + tau))) / math.sinh(kappa * T) if j < n_intervals - 1 else 0

                fraction = frac_remaining - frac_next

            qty = total_quantity * fraction
            cumulative_traded += qty
            remaining -= qty

            schedule.append({
                "interval": j + 1,
                "time": round(t_j, 4),
                "trade_quantity": round(qty, 4),
                "cumulative_traded": round(cumulative_traded, 4),
                "remaining": round(max(remaining, 0), 4),
                "urgency": round(fraction * n_intervals, 4),
            })

        return schedule

    @staticmethod
    def iceberg_schedule(
        total_quantity: float,
        display_quantity: float,
        avg_volume_per_interval: float,
        max_participation: float = 0.10,
    ) -> list[dict]:
        """Generate iceberg order schedule."""
        max_qty_per_interval = avg_volume_per_interval * max_participation
        effective_display = min(display_quantity, max_qty_per_interval)

        n_slices = math.ceil(total_quantity / effective_display) if effective_display > 0 else 1
        schedule = []
        remaining = total_quantity

        for i in range(n_slices):
            qty = min(effective_display, remaining)
            remaining -= qty
            schedule.append({
                "slice": i + 1,
                "display_quantity": round(qty, 4),
                "hidden_remaining": round(remaining, 4),
                "participation_rate": round(qty / avg_volume_per_interval if avg_volume_per_interval > 0 else 0, 4),
            })

        return schedule


# ── Liquidity-Adjusted VaR ────────────────────────────────────────────

class LiquidityAdjustedVaR:
    @staticmethod
    def laVar(
        portfolio_value: float,
        var_normal: float,
        avg_spread_bps: float,
        spread_volatility_bps: float,
        position_size: float,
        avg_daily_volume: float,
        confidence: float = 0.99,
    ) -> dict:
        """
        Liquidity-Adjusted VaR (LVaR).
        LVaR = VaR + Liquidity Cost
        """
        # Normal VaR component
        z_scores = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090}
        z = z_scores.get(confidence, 1.645)

        # Expected liquidity cost (half-spread)
        expected_liq_cost = portfolio_value * avg_spread_bps / 20000

        # Exogenous liquidity risk (spread volatility)
        exo_liq_risk = portfolio_value * z * spread_volatility_bps / 20000

        # Endogenous liquidity risk (market impact)
        participation = position_size / avg_daily_volume if avg_daily_volume > 0 else 1
        endo_liq_risk = portfolio_value * 0.1 * math.sqrt(participation)

        # Total LVaR
        lvar = var_normal + expected_liq_cost + exo_liq_risk + endo_liq_risk

        # Liquidity horizon adjustment
        days_to_liquidate = position_size / (avg_daily_volume * 0.10) if avg_daily_volume > 0 else 1
        horizon_adjusted_var = var_normal * math.sqrt(max(days_to_liquidate, 1))

        return {
            "var_normal": round(var_normal, 2),
            "expected_liquidity_cost": round(expected_liq_cost, 2),
            "exogenous_liquidity_risk": round(exo_liq_risk, 2),
            "endogenous_liquidity_risk": round(endo_liq_risk, 2),
            "liquidity_adjusted_var": round(lvar, 2),
            "liquidity_component_pct": round((lvar - var_normal) / lvar * 100 if lvar > 0 else 0, 2),
            "days_to_liquidate": round(days_to_liquidate, 1),
            "horizon_adjusted_var": round(horizon_adjusted_var, 2),
        }


# ── Position Sizing with Liquidity ───────────────────────────────────

class LiquidityConstrainedSizing:
    @staticmethod
    def max_position_from_adv(
        avg_daily_volume: float,
        max_days_to_liquidate: float = 5.0,
        participation_rate: float = 0.10,
    ) -> float:
        """Max position size constrained by liquidation time."""
        return avg_daily_volume * participation_rate * max_days_to_liquidate

    @staticmethod
    def optimal_position_size(
        signal_strength: float,
        volatility: float,
        avg_daily_volume: float,
        avg_spread_bps: float,
        price: float,
        max_portfolio_pct: float = 0.05,
        portfolio_value: float = 1_000_000,
    ) -> dict:
        """
        Determine optimal position size considering both signal and liquidity.
        Uses Kelly-like criterion with liquidity adjustment.
        """
        # Base Kelly
        edge = signal_strength
        variance = volatility ** 2
        kelly_fraction = edge / variance if variance > 0 else 0

        # Liquidity discount
        spread_cost = avg_spread_bps / 10000
        impact_cost = 0.1 * math.sqrt(1.0 / max(avg_daily_volume, 1))
        total_cost = spread_cost + impact_cost

        adjusted_kelly = max(0, kelly_fraction - total_cost / variance if variance > 0 else 0)

        # Cap at max position and ADV constraint
        max_pos_dollars = portfolio_value * max_portfolio_pct
        kelly_pos_dollars = portfolio_value * adjusted_kelly
        adv_limit = LiquidityConstrainedSizing.max_position_from_adv(avg_daily_volume * price)

        position_dollars = min(kelly_pos_dollars, max_pos_dollars, adv_limit)
        shares = position_dollars / price if price > 0 else 0

        return {
            "kelly_fraction": round(kelly_fraction, 4),
            "liquidity_adjusted_kelly": round(adjusted_kelly, 4),
            "position_dollars": round(position_dollars, 2),
            "position_shares": round(shares, 0),
            "constraint_binding": "adv" if position_dollars >= adv_limit else (
                "max_portfolio_pct" if position_dollars >= max_pos_dollars else "kelly"
            ),
            "estimated_entry_cost_bps": round((spread_cost + impact_cost * math.sqrt(shares / avg_daily_volume if avg_daily_volume > 0 else 1)) * 10000, 2),
        }


# ── Market Resilience ─────────────────────────────────────────────────

class MarketResilience:
    @staticmethod
    def spread_recovery_time(
        spreads: list[float],
        timestamps: list[float],
        shock_times: list[int],
        normal_spread: float,
        threshold: float = 1.5,
    ) -> dict:
        """Measure how quickly the spread recovers after a shock."""
        recoveries = []

        for shock_idx in shock_times:
            if shock_idx >= len(spreads):
                continue

            shock_spread = spreads[shock_idx]
            if shock_spread < normal_spread * threshold:
                continue  # Not a real shock

            # Find recovery time
            recovery_idx = None
            for j in range(shock_idx + 1, len(spreads)):
                if spreads[j] <= normal_spread * 1.1:
                    recovery_idx = j
                    break

            if recovery_idx and shock_idx < len(timestamps) and recovery_idx < len(timestamps):
                recovery_time = timestamps[recovery_idx] - timestamps[shock_idx]
                recoveries.append(recovery_time)

        if not recoveries:
            return {"avg_recovery_time": 0, "median_recovery_time": 0, "n_shocks": 0}

        return {
            "avg_recovery_time": round(statistics.mean(recoveries), 2),
            "median_recovery_time": round(statistics.median(recoveries), 2),
            "min_recovery_time": round(min(recoveries), 2),
            "max_recovery_time": round(max(recoveries), 2),
            "n_shocks": len(recoveries),
        }

    @staticmethod
    def depth_recovery(
        depth_snapshots: list[float],
        timestamps: list[float],
        normal_depth: float,
    ) -> dict:
        """Measure depth recovery after large trades."""
        depletions = []
        current_depletion = None

        for i, d in enumerate(depth_snapshots):
            if d < normal_depth * 0.5 and current_depletion is None:
                current_depletion = {"start_idx": i, "min_depth": d}
            elif current_depletion is not None:
                if d < current_depletion["min_depth"]:
                    current_depletion["min_depth"] = d
                if d >= normal_depth * 0.9:
                    current_depletion["end_idx"] = i
                    if current_depletion["start_idx"] < len(timestamps) and i < len(timestamps):
                        current_depletion["time"] = timestamps[i] - timestamps[current_depletion["start_idx"]]
                    depletions.append(current_depletion)
                    current_depletion = None

        if not depletions:
            return {"avg_depth_recovery_time": 0, "n_depletions": 0}

        times = [d.get("time", 0) for d in depletions if "time" in d]
        return {
            "avg_depth_recovery_time": round(statistics.mean(times), 2) if times else 0,
            "n_depletions": len(depletions),
            "avg_min_depth_pct": round(statistics.mean(d["min_depth"] / normal_depth for d in depletions) * 100, 2),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class LiquidityAnalysisEngine:
    def __init__(self) -> None:
        self.scoring = LiquidityScoring()
        self.spread_decomp = SpreadDecomposition()
        self.slippage = SlippageEstimator()
        self.execution = OptimalExecution()
        self.lavar = LiquidityAdjustedVaR()
        self.sizing = LiquidityConstrainedSizing()
        self.resilience = MarketResilience()

    def profile(self, **kwargs) -> dict:
        p = self.scoring.build_profile(**kwargs)
        return p.to_dict()

    def estimate_slippage(self, **kwargs) -> dict:
        result = self.slippage.estimate(**kwargs)
        return result.to_dict()

    def optimal_execution_plan(
        self,
        strategy: str,
        total_quantity: float,
        **kwargs,
    ) -> dict:
        if strategy == "twap":
            sched = self.execution.twap_schedule(total_quantity, **kwargs)
        elif strategy == "vwap":
            sched = self.execution.vwap_schedule(total_quantity, **kwargs)
        elif strategy == "almgren_chriss":
            sched = self.execution.almgren_chriss_optimal(total_quantity, **kwargs)
        elif strategy == "iceberg":
            sched = self.execution.iceberg_schedule(total_quantity, **kwargs)
        else:
            sched = self.execution.twap_schedule(total_quantity)

        return {
            "strategy": strategy,
            "total_quantity": round(total_quantity, 4),
            "schedule": sched,
        }

    def liquidity_adjusted_var(self, **kwargs) -> dict:
        return self.lavar.laVar(**kwargs)

    def position_sizing(self, **kwargs) -> dict:
        return self.sizing.optimal_position_size(**kwargs)

    def spread_analysis(self, spreads: list[float], quote_changes: list[float]) -> dict:
        return self.spread_decomp.huang_stoll(spreads, quote_changes)

    def capabilities(self) -> dict:
        return {
            "engine": "LiquidityAnalysisEngine",
            "version": "1.0.0",
            "features": [
                "composite_liquidity_scoring",
                "liquidity_tier_classification",
                "spread_decomposition (Huang-Stoll, Glosten-Harris)",
                "slippage_estimation",
                "optimal_execution (TWAP, VWAP, Almgren-Chriss, iceberg)",
                "liquidity_adjusted_VaR",
                "liquidity_constrained_position_sizing",
                "market_resilience analysis",
                "depth_recovery_analysis",
            ],
        }
