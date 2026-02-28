"""
Pairs Trading Engine — Pure-Python pairs trading strategy framework.
Distance method, cointegration method, Kalman-filter-style adaptive hedge,
portfolio construction, risk management, and P&L tracking.
No numpy/scipy dependency.
"""
from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class PairSignal(str, Enum):
    OPEN_LONG = "open_long"       # buy A, sell B
    OPEN_SHORT = "open_short"     # sell A, buy B
    CLOSE = "close"
    HOLD = "hold"
    STOP_LOSS = "stop_loss"


class PairMethod(str, Enum):
    DISTANCE = "distance"
    COINTEGRATION = "cointegration"
    RATIO = "ratio"
    KALMAN = "kalman"


class TradeStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    STOPPED = "stopped"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class PairConfig:
    symbol_a: str
    symbol_b: str
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_z: float = 4.0
    lookback: int = 60
    position_size: float = 10000.0
    method: PairMethod = PairMethod.COINTEGRATION


@dataclass
class PairTrade:
    entry_index: int
    exit_index: int = -1
    direction: str = ""             # "long" (buy A sell B) or "short"
    entry_spread: float = 0.0
    exit_spread: float = 0.0
    entry_z: float = 0.0
    exit_z: float = 0.0
    pnl: float = 0.0
    status: TradeStatus = TradeStatus.OPEN
    hedge_ratio: float = 1.0
    holding_period: int = 0

    def to_dict(self) -> dict:
        return {
            "entry_idx": self.entry_index,
            "exit_idx": self.exit_index,
            "direction": self.direction,
            "entry_spread": round(self.entry_spread, 6),
            "exit_spread": round(self.exit_spread, 6),
            "pnl": round(self.pnl, 6),
            "status": self.status.value,
            "holding_period": self.holding_period,
        }


@dataclass
class PairPortfolio:
    pairs: list[PairConfig] = field(default_factory=list)
    total_capital: float = 100000.0
    max_pairs: int = 10
    max_allocation_per_pair: float = 0.20

    def per_pair_capital(self) -> float:
        n = min(len(self.pairs), self.max_pairs)
        if n == 0:
            return 0.0
        return min(self.total_capital / n, self.total_capital * self.max_allocation_per_pair)


# ═══════════════════════════════════════════════════════════════════════
# Distance Method
# ═══════════════════════════════════════════════════════════════════════

class DistanceMethod:
    """Pairs selection by minimum distance."""

    @staticmethod
    def normalized_prices(prices: list[float]) -> list[float]:
        if not prices or prices[0] == 0:
            return prices
        return [p / prices[0] for p in prices]

    @staticmethod
    def sum_squared_distance(prices_a: list[float], prices_b: list[float]) -> float:
        n = min(len(prices_a), len(prices_b))
        na = DistanceMethod.normalized_prices(prices_a[:n])
        nb = DistanceMethod.normalized_prices(prices_b[:n])
        return round(sum((na[i] - nb[i])**2 for i in range(n)), 6)

    @staticmethod
    def rank_by_distance(
        universe: dict[str, list[float]],
        top_n: int = 20,
    ) -> list[dict]:
        """Find closest pairs by SSD."""
        symbols = list(universe.keys())
        pairs = []

        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                ssd = DistanceMethod.sum_squared_distance(
                    universe[symbols[i]], universe[symbols[j]],
                )
                pairs.append({
                    "symbol_a": symbols[i],
                    "symbol_b": symbols[j],
                    "ssd": ssd,
                })

        pairs.sort(key=lambda p: p["ssd"])
        return pairs[:top_n]


# ═══════════════════════════════════════════════════════════════════════
# Spread Engine
# ═══════════════════════════════════════════════════════════════════════

class PairSpreadEngine:
    """Calculate and manage pair spreads."""

    @staticmethod
    def calculate_hedge_ratio(y: list[float], x: list[float]) -> dict:
        """OLS hedge ratio."""
        n = min(len(y), len(x))
        if n < 2:
            return {"beta": 1.0, "alpha": 0.0, "r_squared": 0.0}

        mx = statistics.mean(x[:n])
        my = statistics.mean(y[:n])
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)
        var_x = sum((x[i] - mx)**2 for i in range(n)) / (n - 1)

        if var_x == 0:
            return {"beta": 1.0, "alpha": 0.0, "r_squared": 0.0}

        beta = cov / var_x
        alpha = my - beta * mx

        ss_res = sum((y[i] - (alpha + beta * x[i]))**2 for i in range(n))
        ss_tot = sum((y[i] - my)**2 for i in range(n))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        return {
            "beta": round(beta, 6),
            "alpha": round(alpha, 6),
            "r_squared": round(max(0, r2), 4),
        }

    @staticmethod
    def compute_spread(
        prices_a: list[float],
        prices_b: list[float],
        hedge_ratio: float = 1.0,
    ) -> list[float]:
        n = min(len(prices_a), len(prices_b))
        return [round(prices_a[i] - hedge_ratio * prices_b[i], 6) for i in range(n)]

    @staticmethod
    def z_score_series(spread: list[float], lookback: int = 60) -> list[float]:
        result = []
        for i in range(len(spread)):
            window = spread[max(0, i - lookback + 1):i + 1]
            if len(window) < 2:
                result.append(0.0)
            else:
                m = statistics.mean(window)
                s = statistics.stdev(window)
                if s == 0:
                    result.append(0.0)
                else:
                    result.append(round((spread[i] - m) / s, 4))
        return result

    @staticmethod
    def half_life(spread: list[float]) -> float:
        """Estimate half-life of mean reversion."""
        n = len(spread)
        if n < 10:
            return float('inf')

        y = [spread[i] - spread[i - 1] for i in range(1, n)]
        x = spread[:-1]

        mx = statistics.mean(x)
        my = statistics.mean(y)
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(len(y))) / max(len(y) - 1, 1)
        var_x = sum((xi - mx)**2 for xi in x) / max(len(x) - 1, 1)

        if var_x == 0:
            return float('inf')

        gamma = cov / var_x
        if gamma >= 0:
            return float('inf')

        return round(-math.log(2) / math.log(1 + gamma), 2) if (1 + gamma) > 0 else float('inf')


# ═══════════════════════════════════════════════════════════════════════
# Kalman-Style Adaptive Hedge
# ═══════════════════════════════════════════════════════════════════════

class KalmanAdaptiveHedge:
    """Simplified Kalman filter for adaptive hedge ratio."""

    @staticmethod
    def filter(
        prices_a: list[float],
        prices_b: list[float],
        observation_noise: float = 1.0,
        transition_noise: float = 0.001,
    ) -> list[dict]:
        """Run Kalman filter to estimate time-varying hedge ratio."""
        n = min(len(prices_a), len(prices_b))
        if n == 0:
            return []

        # State: [intercept, slope]
        state = [0.0, 1.0]
        P = [[1.0, 0.0], [0.0, 1.0]]  # state covariance
        R = observation_noise
        Q = [[transition_noise, 0], [0, transition_noise]]

        results = []

        for i in range(n):
            x = prices_b[i]
            y = prices_a[i]

            # Prediction
            # State transition: state stays the same (random walk)
            predicted_state = list(state)
            predicted_P = [
                [P[0][0] + Q[0][0], P[0][1] + Q[0][1]],
                [P[1][0] + Q[1][0], P[1][1] + Q[1][1]],
            ]

            # Observation: y = state[0] + state[1] * x
            H = [1.0, x]
            y_pred = H[0] * predicted_state[0] + H[1] * predicted_state[1]
            innovation = y - y_pred

            # Innovation covariance
            S = H[0] * (predicted_P[0][0] * H[0] + predicted_P[0][1] * H[1]) + \
                H[1] * (predicted_P[1][0] * H[0] + predicted_P[1][1] * H[1]) + R

            if S == 0:
                S = 1e-6

            # Kalman gain
            K = [
                (predicted_P[0][0] * H[0] + predicted_P[0][1] * H[1]) / S,
                (predicted_P[1][0] * H[0] + predicted_P[1][1] * H[1]) / S,
            ]

            # Update state
            state = [
                predicted_state[0] + K[0] * innovation,
                predicted_state[1] + K[1] * innovation,
            ]

            # Update covariance
            P = [
                [
                    (1 - K[0] * H[0]) * predicted_P[0][0] - K[0] * H[1] * predicted_P[1][0],
                    (1 - K[0] * H[0]) * predicted_P[0][1] - K[0] * H[1] * predicted_P[1][1],
                ],
                [
                    -K[1] * H[0] * predicted_P[0][0] + (1 - K[1] * H[1]) * predicted_P[1][0],
                    -K[1] * H[0] * predicted_P[0][1] + (1 - K[1] * H[1]) * predicted_P[1][1],
                ],
            ]

            results.append({
                "intercept": round(state[0], 6),
                "hedge_ratio": round(state[1], 6),
                "spread": round(innovation, 6),
                "spread_std": round(math.sqrt(abs(S)), 6),
            })

        return results


# ═══════════════════════════════════════════════════════════════════════
# Signal Generator
# ═══════════════════════════════════════════════════════════════════════

class PairSignalGenerator:
    """Generate entry/exit signals for pairs."""

    @staticmethod
    def generate(
        z_score: float,
        config: PairConfig,
        current_position: str = "",  # "long", "short", ""
    ) -> PairSignal:
        """Generate signal based on z-score and position."""
        if abs(z_score) > config.stop_z:
            if current_position:
                return PairSignal.STOP_LOSS
            return PairSignal.HOLD

        if not current_position:
            if z_score < -config.entry_z:
                return PairSignal.OPEN_LONG
            elif z_score > config.entry_z:
                return PairSignal.OPEN_SHORT
            return PairSignal.HOLD
        else:
            if abs(z_score) < config.exit_z:
                return PairSignal.CLOSE
            return PairSignal.HOLD

    @staticmethod
    def generate_series(
        z_scores: list[float],
        config: PairConfig,
    ) -> list[dict]:
        """Generate signal series."""
        signals_list = []
        position = ""

        for i, z in enumerate(z_scores):
            signal = PairSignalGenerator.generate(z, config, position)

            if signal == PairSignal.OPEN_LONG:
                position = "long"
            elif signal == PairSignal.OPEN_SHORT:
                position = "short"
            elif signal in (PairSignal.CLOSE, PairSignal.STOP_LOSS):
                position = ""

            signals_list.append({
                "index": i,
                "z_score": z,
                "signal": signal.value,
                "position": position,
            })

        return signals_list


# ═══════════════════════════════════════════════════════════════════════
# Backtest Engine
# ═══════════════════════════════════════════════════════════════════════

class PairsBacktester:
    """Backtest pairs trading strategy."""

    @staticmethod
    def backtest(
        prices_a: list[float],
        prices_b: list[float],
        config: PairConfig,
    ) -> dict:
        """Full pairs trading backtest."""
        hedge = PairSpreadEngine.calculate_hedge_ratio(prices_a, prices_b)
        spread = PairSpreadEngine.compute_spread(prices_a, prices_b, hedge["beta"])
        z_scores = PairSpreadEngine.z_score_series(spread, config.lookback)
        half_life = PairSpreadEngine.half_life(spread)

        trades: list[PairTrade] = []
        current_trade: PairTrade | None = None

        for i in range(len(z_scores)):
            z = z_scores[i]

            if current_trade is None:
                if z < -config.entry_z:
                    current_trade = PairTrade(
                        entry_index=i,
                        direction="long",
                        entry_spread=spread[i],
                        entry_z=z,
                        hedge_ratio=hedge["beta"],
                    )
                elif z > config.entry_z:
                    current_trade = PairTrade(
                        entry_index=i,
                        direction="short",
                        entry_spread=spread[i],
                        entry_z=z,
                        hedge_ratio=hedge["beta"],
                    )
            else:
                close = False
                if abs(z) > config.stop_z:
                    close = True
                    current_trade.status = TradeStatus.STOPPED
                elif abs(z) < config.exit_z:
                    close = True
                    current_trade.status = TradeStatus.CLOSED

                if close:
                    current_trade.exit_index = i
                    current_trade.exit_spread = spread[i]
                    current_trade.exit_z = z
                    current_trade.holding_period = i - current_trade.entry_index

                    if current_trade.direction == "long":
                        current_trade.pnl = current_trade.exit_spread - current_trade.entry_spread
                    else:
                        current_trade.pnl = current_trade.entry_spread - current_trade.exit_spread

                    trades.append(current_trade)
                    current_trade = None

        # Force close open trade
        if current_trade is not None and len(spread) > 0:
            current_trade.exit_index = len(spread) - 1
            current_trade.exit_spread = spread[-1]
            current_trade.exit_z = z_scores[-1] if z_scores else 0
            current_trade.holding_period = current_trade.exit_index - current_trade.entry_index
            if current_trade.direction == "long":
                current_trade.pnl = current_trade.exit_spread - current_trade.entry_spread
            else:
                current_trade.pnl = current_trade.entry_spread - current_trade.exit_spread
            current_trade.status = TradeStatus.CLOSED
            trades.append(current_trade)

        return PairsBacktester._compute_stats(trades, hedge, half_life)

    @staticmethod
    def _compute_stats(
        trades: list[PairTrade],
        hedge: dict,
        half_life: float,
    ) -> dict:
        if not trades:
            return {
                "n_trades": 0,
                "total_pnl": 0,
                "hedge_ratio": hedge["beta"],
                "half_life": half_life,
            }

        pnls = [t.pnl for t in trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]
        holding = [t.holding_period for t in trades]
        stopped = [t for t in trades if t.status == TradeStatus.STOPPED]

        return {
            "n_trades": len(trades),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / len(trades) * 100, 2),
            "total_pnl": round(sum(pnls), 6),
            "avg_pnl": round(statistics.mean(pnls), 6),
            "max_win": round(max(pnls), 6),
            "max_loss": round(min(pnls), 6),
            "avg_holding_period": round(statistics.mean(holding), 1),
            "stopped_out": len(stopped),
            "hedge_ratio": hedge["beta"],
            "r_squared": hedge["r_squared"],
            "half_life": half_life,
            "profit_factor": round(sum(wins) / abs(sum(losses)), 4) if losses and sum(losses) != 0 else float('inf'),
            "trades": [t.to_dict() for t in trades],
        }


# ═══════════════════════════════════════════════════════════════════════
# Risk Manager
# ═══════════════════════════════════════════════════════════════════════

class PairRiskManager:
    """Risk management for pairs trades."""

    @staticmethod
    def position_size(
        capital: float,
        spread_volatility: float,
        target_risk_pct: float = 0.02,
    ) -> dict:
        """Size position based on spread volatility."""
        if spread_volatility <= 0:
            return {"notional": 0, "risk_per_unit": 0}

        # Risk per unit = spread vol * position size
        risk_budget = capital * target_risk_pct
        notional = risk_budget / spread_volatility

        return {
            "notional": round(notional, 2),
            "risk_per_unit": round(spread_volatility, 6),
            "risk_budget": round(risk_budget, 2),
            "risk_pct": target_risk_pct,
        }

    @staticmethod
    def portfolio_correlation(
        pair_returns: dict[str, list[float]],
    ) -> dict[str, dict[str, float]]:
        """Correlation between pair strategies."""
        pairs = list(pair_returns.keys())
        matrix = {}
        for i, pi in enumerate(pairs):
            matrix[pi] = {}
            for j, pj in enumerate(pairs):
                if i == j:
                    matrix[pi][pj] = 1.0
                elif j < i:
                    matrix[pi][pj] = matrix[pj][pi]
                else:
                    n = min(len(pair_returns[pi]), len(pair_returns[pj]))
                    if n < 2:
                        matrix[pi][pj] = 0.0
                    else:
                        mx = statistics.mean(pair_returns[pi][:n])
                        my = statistics.mean(pair_returns[pj][:n])
                        sx = statistics.stdev(pair_returns[pi][:n])
                        sy = statistics.stdev(pair_returns[pj][:n])
                        if sx == 0 or sy == 0:
                            matrix[pi][pj] = 0.0
                        else:
                            cov = sum(
                                (pair_returns[pi][k] - mx) * (pair_returns[pj][k] - my)
                                for k in range(n)
                            ) / (n - 1)
                            matrix[pi][pj] = round(cov / (sx * sy), 4)
        return matrix

    @staticmethod
    def max_drawdown_pairs(cumulative_pnl: list[float]) -> float:
        """Max drawdown of pairs strategy."""
        if not cumulative_pnl:
            return 0.0
        peak = cumulative_pnl[0]
        max_dd = 0.0
        for pnl in cumulative_pnl:
            peak = max(peak, pnl)
            dd = (peak - pnl) / abs(peak) if peak != 0 else 0
            max_dd = max(max_dd, dd)
        return round(max_dd, 4)


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class PairsTradingEngine:
    """Top-level pairs trading engine."""

    def __init__(self):
        self.distance = DistanceMethod()
        self.spread_engine = PairSpreadEngine()
        self.kalman = KalmanAdaptiveHedge()
        self.signal_gen = PairSignalGenerator()
        self.backtester = PairsBacktester()
        self.risk = PairRiskManager()

    def find_pairs(
        self,
        universe: dict[str, list[float]],
        method: PairMethod = PairMethod.DISTANCE,
        top_n: int = 10,
    ) -> list[dict]:
        if method == PairMethod.DISTANCE:
            return self.distance.rank_by_distance(universe, top_n)
        return self.distance.rank_by_distance(universe, top_n)

    def analyze_pair(
        self,
        prices_a: list[float],
        prices_b: list[float],
    ) -> dict:
        hedge = self.spread_engine.calculate_hedge_ratio(prices_a, prices_b)
        spread = self.spread_engine.compute_spread(prices_a, prices_b, hedge["beta"])
        z_scores = self.spread_engine.z_score_series(spread, 60)
        hl = self.spread_engine.half_life(spread)

        current_z = z_scores[-1] if z_scores else 0.0
        config = PairConfig(symbol_a="A", symbol_b="B")
        signal = self.signal_gen.generate(current_z, config)

        return {
            "hedge_ratio": hedge["beta"],
            "r_squared": hedge["r_squared"],
            "half_life": hl,
            "current_z": current_z,
            "signal": signal.value,
            "spread_mean": round(statistics.mean(spread), 6) if spread else 0,
            "spread_std": round(statistics.stdev(spread), 6) if len(spread) > 1 else 0,
        }

    def backtest(
        self,
        prices_a: list[float],
        prices_b: list[float],
        config: PairConfig = None,
    ) -> dict:
        if config is None:
            config = PairConfig(symbol_a="A", symbol_b="B")
        return self.backtester.backtest(prices_a, prices_b, config)

    def capabilities(self) -> dict:
        return {
            "engine": "PairsTradingEngine",
            "version": "1.0.0",
            "methods": [m.value for m in PairMethod],
            "features": [
                "distance_method_pair_selection",
                "cointegration_hedge_ratio",
                "spread_calculation_price_log_ratio",
                "z_score_series_rolling",
                "half_life_estimation",
                "kalman_adaptive_hedge",
                "signal_generation_entry_exit",
                "full_pairs_backtest",
                "position_sizing_risk_based",
                "portfolio_pair_correlation",
                "max_drawdown_tracking",
            ],
        }
