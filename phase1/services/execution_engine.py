"""
execution_engine.py — Bloomberg-grade Trade Execution Engine
==============================================================
Pure computation engine — no FastAPI imports.

Components:
    ExecutionAlgo       — TWAP, VWAP, Iceberg, POV, Adaptive algorithms
    SlippageModel       — Almgren-Chriss, linear, square-root impact
    TransactionCostModel — Commission, spread, impact, taxes
    ExecutionSimulator  — Full execution simulation with market microstructure
    ExecutionAnalyzer   — Implementation shortfall, benchmark comparison
    ExecutionEngine     — Top-level orchestrator
"""

from __future__ import annotations
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class AlgoType(Enum):
    TWAP = "twap"
    VWAP = "vwap"
    ICEBERG = "iceberg"
    POV = "pov"                    # percentage of volume
    ADAPTIVE = "adaptive"
    ARRIVAL_PRICE = "arrival_price"
    CLOSE = "close"
    DARK = "dark_pool"


class ExecutionStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class CostComponent(Enum):
    COMMISSION = "commission"
    SPREAD = "spread"
    MARKET_IMPACT = "market_impact"
    TIMING = "timing"
    TAX = "tax"
    SLIPPAGE = "slippage"


# ─── DataClasses ─────────────────────────────────────────────────────────────

@dataclass
class ExecutionSlice:
    """A single execution slice within an algo."""
    slice_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    timestamp: float = field(default_factory=time.time)
    quantity: int = 0
    price: float = 0.0
    target_pct: float = 0.0    # target % of total to fill this slice
    actual_pct: float = 0.0
    slippage_bps: float = 0.0
    commission: float = 0.0
    venue: str = ""

    @property
    def notional(self) -> float:
        return self.quantity * self.price

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slice_id": self.slice_id, "timestamp": self.timestamp,
            "quantity": self.quantity, "price": self.price,
            "target_pct": self.target_pct, "actual_pct": self.actual_pct,
            "slippage_bps": self.slippage_bps, "commission": self.commission,
            "notional": self.notional, "venue": self.venue,
        }


@dataclass
class AlgoExecution:
    """Full algo execution record."""
    execution_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    algo_type: AlgoType = AlgoType.TWAP
    symbol: str = ""
    side: str = "buy"
    total_quantity: int = 0
    filled_quantity: int = 0
    avg_price: float = 0.0
    arrival_price: float = 0.0       # price at start
    status: ExecutionStatus = ExecutionStatus.PENDING
    slices: List[ExecutionSlice] = field(default_factory=list)

    # Algo parameters
    duration_seconds: float = 0.0     # total duration
    num_slices: int = 10
    urgency: float = 0.5              # 0 = passive, 1 = aggressive
    max_participation: float = 0.10    # max % of volume
    display_size: int = 0              # for iceberg

    # Timing
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    created_at: float = field(default_factory=time.time)

    # Cost tracking
    total_commission: float = 0.0
    total_slippage_bps: float = 0.0

    @property
    def remaining_quantity(self) -> int:
        return self.total_quantity - self.filled_quantity

    @property
    def fill_ratio(self) -> float:
        return self.filled_quantity / self.total_quantity if self.total_quantity > 0 else 0

    @property
    def is_active(self) -> bool:
        return self.status in (ExecutionStatus.RUNNING, ExecutionStatus.PAUSED)

    @property
    def implementation_shortfall_bps(self) -> float:
        if self.arrival_price <= 0 or self.avg_price <= 0:
            return 0.0
        if self.side == "buy":
            return (self.avg_price - self.arrival_price) / self.arrival_price * 10000
        else:
            return (self.arrival_price - self.avg_price) / self.arrival_price * 10000

    def add_slice(self, s: ExecutionSlice):
        self.slices.append(s)
        total_notional = self.avg_price * self.filled_quantity + s.price * s.quantity
        self.filled_quantity += s.quantity
        if self.filled_quantity > 0:
            self.avg_price = total_notional / self.filled_quantity
        self.total_commission += s.commission
        if self.filled_quantity >= self.total_quantity:
            self.status = ExecutionStatus.COMPLETED
            self.end_time = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "execution_id": self.execution_id,
            "algo_type": self.algo_type.value,
            "symbol": self.symbol, "side": self.side,
            "total_quantity": self.total_quantity,
            "filled_quantity": self.filled_quantity,
            "remaining_quantity": self.remaining_quantity,
            "avg_price": self.avg_price, "arrival_price": self.arrival_price,
            "status": self.status.value, "fill_ratio": self.fill_ratio,
            "implementation_shortfall_bps": self.implementation_shortfall_bps,
            "total_commission": self.total_commission,
            "num_slices": len(self.slices),
            "duration_seconds": self.duration_seconds,
            "urgency": self.urgency,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. SlippageModel
# ═══════════════════════════════════════════════════════════════════════════════

class SlippageModel:
    """Market impact and slippage modeling."""

    @staticmethod
    def linear_impact(quantity: int, adv: float,
                      impact_coeff: float = 0.1) -> float:
        """Linear market impact: impact = coeff * (Q / ADV)."""
        if adv <= 0:
            return 0.0
        return impact_coeff * (quantity / adv)

    @staticmethod
    def square_root_impact(quantity: int, adv: float,
                            volatility: float = 0.02,
                            impact_coeff: float = 0.5) -> float:
        """Square-root impact (Almgren-Chriss inspired).
        impact ≈ sigma * coeff * sqrt(Q / ADV)"""
        if adv <= 0:
            return 0.0
        return volatility * impact_coeff * np.sqrt(quantity / adv)

    @staticmethod
    def almgren_chriss(quantity: int, adv: float,
                       volatility: float = 0.02,
                       eta: float = 0.01, gamma: float = 0.5,
                       num_periods: int = 10) -> Dict[str, Any]:
        """Almgren-Chriss optimal execution schedule.

        Returns optimal trade schedule and expected cost.
        """
        if adv <= 0 or num_periods <= 0:
            return {"schedule": [], "expected_cost": 0, "risk": 0}

        q_per_period = quantity / num_periods
        # Permanent impact
        permanent = eta * (quantity / adv)
        # Temporary impact per slice
        temp_per_slice = gamma * volatility * np.sqrt(q_per_period / adv)

        schedule = []
        for i in range(num_periods):
            slice_qty = int(q_per_period)
            impact = permanent + temp_per_slice
            schedule.append({
                "period": i,
                "quantity": slice_qty,
                "expected_impact_bps": float(impact * 10000),
            })

        expected_cost = float(permanent + temp_per_slice * num_periods) * 10000
        risk = float(volatility * np.sqrt(quantity / adv / num_periods) * 10000)

        return {
            "schedule": schedule,
            "expected_cost_bps": expected_cost,
            "risk_bps": risk,
            "permanent_impact_bps": float(permanent * 10000),
            "temporary_impact_bps": float(temp_per_slice * 10000),
        }

    @staticmethod
    def estimate_slippage(price: float, quantity: int,
                           adv: float, spread: float = 0.01,
                           volatility: float = 0.02) -> Dict[str, float]:
        """Comprehensive slippage estimate."""
        spread_cost = spread / 2  # half-spread
        linear = SlippageModel.linear_impact(quantity, adv)
        sqrt_impact = SlippageModel.square_root_impact(quantity, adv, volatility)

        total_bps = (spread_cost / price + sqrt_impact) * 10000
        return {
            "spread_cost_bps": float(spread_cost / price * 10000),
            "market_impact_bps": float(sqrt_impact * 10000),
            "total_slippage_bps": float(total_bps),
            "total_cost_dollars": float(total_bps / 10000 * price * quantity),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. TransactionCostModel
# ═══════════════════════════════════════════════════════════════════════════════

class TransactionCostModel:
    """Full transaction cost analysis (TCA)."""

    def __init__(self):
        self.commission_per_share = 0.005
        self.min_commission = 1.0
        self.sec_fee_rate = 0.0000278    # SEC fee per $ sold
        self.taf_fee_rate = 0.000166     # TAF fee per share sold
        self.exchange_fee = 0.003        # per share

    def commission(self, quantity: int) -> float:
        return max(quantity * self.commission_per_share, self.min_commission)

    def regulatory_fees(self, quantity: int, price: float,
                        side: str = "sell") -> float:
        """SEC + TAF fees (sell-side only in US)."""
        if side != "sell":
            return 0.0
        sec = self.sec_fee_rate * quantity * price
        taf = self.taf_fee_rate * quantity
        return sec + taf

    def exchange_fees(self, quantity: int) -> float:
        return quantity * self.exchange_fee

    def spread_cost(self, quantity: int, bid: float, ask: float) -> float:
        spread = ask - bid
        return quantity * spread / 2

    def total_cost(self, quantity: int, price: float,
                   side: str = "buy",
                   bid: float = 0, ask: float = 0) -> Dict[str, float]:
        """Calculate total transaction costs."""
        comm = self.commission(quantity)
        reg = self.regulatory_fees(quantity, price, side)
        exch = self.exchange_fees(quantity)
        spread = self.spread_cost(quantity, bid, ask) if bid and ask else 0

        total = comm + reg + exch + spread
        return {
            "commission": comm,
            "regulatory_fees": reg,
            "exchange_fees": exch,
            "spread_cost": spread,
            "total": total,
            "per_share": total / quantity if quantity else 0,
            "bps": total / (quantity * price) * 10000 if quantity * price > 0 else 0,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ExecutionAlgo — Algorithm implementations
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionAlgo:
    """Algorithmic execution strategies."""

    @staticmethod
    def twap_schedule(total_quantity: int, num_slices: int,
                       duration_seconds: float,
                       start_time: float = 0) -> List[Dict[str, Any]]:
        """Generate TWAP schedule (equal slices over time)."""
        if num_slices <= 0:
            return []
        qty_per = total_quantity // num_slices
        remainder = total_quantity - qty_per * num_slices
        interval = duration_seconds / num_slices
        t0 = start_time or time.time()

        schedule = []
        for i in range(num_slices):
            qty = qty_per + (1 if i < remainder else 0)
            schedule.append({
                "slice": i,
                "target_time": t0 + i * interval,
                "quantity": qty,
                "target_pct": qty / total_quantity,
            })
        return schedule

    @staticmethod
    def vwap_schedule(total_quantity: int, num_slices: int,
                       volume_profile: Optional[List[float]] = None) -> List[Dict[str, Any]]:
        """Generate VWAP schedule weighted by historical volume profile."""
        if num_slices <= 0:
            return []

        if volume_profile is None:
            # Default U-shaped volume profile
            x = np.linspace(-2, 2, num_slices)
            volume_profile = (np.exp(-x ** 2 / 2) * 0.3 + 0.5 +
                              np.exp(-(x - 1.5) ** 2) * 0.3).tolist()

        # Normalize profile to match slices
        if len(volume_profile) != num_slices:
            profile = np.interp(
                np.linspace(0, len(volume_profile) - 1, num_slices),
                np.arange(len(volume_profile)),
                volume_profile,
            )
        else:
            profile = np.array(volume_profile)

        weights = profile / profile.sum()
        schedule = []
        allocated = 0
        for i in range(num_slices):
            if i == num_slices - 1:
                qty = total_quantity - allocated
            else:
                qty = int(total_quantity * weights[i])
                allocated += qty
            schedule.append({
                "slice": i,
                "quantity": qty,
                "weight": float(weights[i]),
                "target_pct": qty / total_quantity,
            })
        return schedule

    @staticmethod
    def iceberg_schedule(total_quantity: int,
                          display_size: int) -> List[Dict[str, Any]]:
        """Generate iceberg order schedule."""
        if display_size <= 0:
            return []
        slices = []
        remaining = total_quantity
        i = 0
        while remaining > 0:
            qty = min(display_size, remaining)
            slices.append({
                "slice": i, "quantity": qty,
                "visible": min(display_size, remaining),
                "hidden": remaining - qty,
            })
            remaining -= qty
            i += 1
        return slices

    @staticmethod
    def pov_schedule(total_quantity: int, market_volumes: List[int],
                      participation_rate: float = 0.10) -> List[Dict[str, Any]]:
        """Percentage of Volume schedule."""
        schedule = []
        remaining = total_quantity
        for i, vol in enumerate(market_volumes):
            if remaining <= 0:
                break
            target_qty = min(int(vol * participation_rate), remaining)
            schedule.append({
                "slice": i,
                "market_volume": vol,
                "target_quantity": target_qty,
                "participation_rate": target_qty / vol if vol > 0 else 0,
            })
            remaining -= target_qty
        return schedule

    @staticmethod
    def adaptive_schedule(total_quantity: int, num_slices: int,
                           urgency: float = 0.5,
                           volatility: float = 0.02) -> List[Dict[str, Any]]:
        """Adaptive execution — front-loaded when urgent, back-loaded when patient."""
        if num_slices <= 0:
            return []

        # Urgency controls the concentration
        # High urgency = front-loaded, Low = even
        indices = np.arange(num_slices, dtype=float)
        if urgency > 0.5:
            # Front-loaded: exponential decay
            rate = (urgency - 0.5) * 4
            weights = np.exp(-rate * indices / num_slices)
        else:
            # Back-loaded or even
            rate = (0.5 - urgency) * 4
            weights = np.exp(rate * indices / num_slices)

        weights = weights / weights.sum()
        schedule = []
        allocated = 0
        for i in range(num_slices):
            if i == num_slices - 1:
                qty = total_quantity - allocated
            else:
                qty = int(total_quantity * weights[i])
                allocated += qty
            schedule.append({
                "slice": i, "quantity": qty,
                "weight": float(weights[i]),
                "urgency_level": urgency,
            })
        return schedule


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ExecutionSimulator
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionSimulator:
    """Simulate execution with market microstructure effects."""

    def __init__(self, slippage_model: Optional[SlippageModel] = None,
                 cost_model: Optional[TransactionCostModel] = None):
        self.slippage = slippage_model or SlippageModel()
        self.cost = cost_model or TransactionCostModel()

    def simulate_twap(self, symbol: str, side: str,
                       total_quantity: int, base_price: float,
                       adv: float = 1_000_000,
                       volatility: float = 0.02,
                       num_slices: int = 10,
                       duration_seconds: float = 3600) -> AlgoExecution:
        """Simulate a TWAP execution."""
        schedule = ExecutionAlgo.twap_schedule(total_quantity, num_slices,
                                                duration_seconds)
        execution = AlgoExecution(
            algo_type=AlgoType.TWAP, symbol=symbol, side=side,
            total_quantity=total_quantity, arrival_price=base_price,
            num_slices=num_slices,
            duration_seconds=duration_seconds,
            status=ExecutionStatus.RUNNING,
        )

        price = base_price
        for s in schedule:
            # Random walk price
            price *= (1 + np.random.normal(0, volatility / np.sqrt(252 * num_slices)))
            # Add market impact
            impact = self.slippage.linear_impact(s["quantity"], adv)
            if side == "buy":
                fill_price = price * (1 + impact)
            else:
                fill_price = price * (1 - impact)

            commission = self.cost.commission(s["quantity"])
            slip = abs(fill_price - price) / price * 10000

            sl = ExecutionSlice(
                quantity=s["quantity"], price=fill_price,
                target_pct=s["target_pct"],
                actual_pct=s["quantity"] / total_quantity,
                slippage_bps=slip, commission=commission,
            )
            execution.add_slice(sl)

        execution.status = ExecutionStatus.COMPLETED
        execution.end_time = time.time()
        return execution

    def simulate_vwap(self, symbol: str, side: str,
                       total_quantity: int, base_price: float,
                       adv: float = 1_000_000,
                       volatility: float = 0.02,
                       num_slices: int = 10) -> AlgoExecution:
        """Simulate a VWAP execution."""
        schedule = ExecutionAlgo.vwap_schedule(total_quantity, num_slices)
        execution = AlgoExecution(
            algo_type=AlgoType.VWAP, symbol=symbol, side=side,
            total_quantity=total_quantity, arrival_price=base_price,
            num_slices=num_slices,
            status=ExecutionStatus.RUNNING,
        )

        price = base_price
        for s in schedule:
            price *= (1 + np.random.normal(0, volatility / np.sqrt(252 * num_slices)))
            impact = self.slippage.square_root_impact(s["quantity"], adv, volatility)
            fill_price = price * (1 + impact) if side == "buy" else price * (1 - impact)

            commission = self.cost.commission(s["quantity"])
            sl = ExecutionSlice(
                quantity=s["quantity"], price=fill_price,
                target_pct=s.get("weight", 0),
                slippage_bps=abs(fill_price - price) / price * 10000,
                commission=commission,
            )
            execution.add_slice(sl)

        execution.status = ExecutionStatus.COMPLETED
        execution.end_time = time.time()
        return execution

    def simulate_iceberg(self, symbol: str, side: str,
                          total_quantity: int, base_price: float,
                          display_size: int = 100,
                          adv: float = 1_000_000) -> AlgoExecution:
        """Simulate an iceberg execution."""
        schedule = ExecutionAlgo.iceberg_schedule(total_quantity, display_size)
        execution = AlgoExecution(
            algo_type=AlgoType.ICEBERG, symbol=symbol, side=side,
            total_quantity=total_quantity, arrival_price=base_price,
            display_size=display_size,
            status=ExecutionStatus.RUNNING,
        )

        price = base_price
        for s in schedule:
            price *= (1 + np.random.normal(0, 0.001))
            fill_price = price
            commission = self.cost.commission(s["quantity"])
            sl = ExecutionSlice(
                quantity=s["quantity"], price=fill_price,
                commission=commission, slippage_bps=0,
            )
            execution.add_slice(sl)

        execution.status = ExecutionStatus.COMPLETED
        return execution


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ExecutionAnalyzer — Post-trade analysis
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionAnalyzer:
    """Post-trade execution analysis."""

    @staticmethod
    def implementation_shortfall(execution: AlgoExecution) -> Dict[str, float]:
        """Calculate implementation shortfall components."""
        if execution.arrival_price <= 0 or execution.avg_price <= 0:
            return {"total_bps": 0}

        if execution.side == "buy":
            shortfall = (execution.avg_price - execution.arrival_price) \
                / execution.arrival_price
        else:
            shortfall = (execution.arrival_price - execution.avg_price) \
                / execution.arrival_price

        notional = execution.filled_quantity * execution.arrival_price
        return {
            "total_bps": float(shortfall * 10000),
            "total_dollars": float(shortfall * notional),
            "commission_bps": float(execution.total_commission / notional * 10000)
                if notional > 0 else 0,
            "arrival_price": execution.arrival_price,
            "avg_fill_price": execution.avg_price,
        }

    @staticmethod
    def vwap_comparison(execution: AlgoExecution,
                         market_vwap: float) -> Dict[str, float]:
        """Compare execution vs market VWAP."""
        if market_vwap <= 0:
            return {"vs_vwap_bps": 0}
        if execution.side == "buy":
            diff = (execution.avg_price - market_vwap) / market_vwap
        else:
            diff = (market_vwap - execution.avg_price) / market_vwap
        return {
            "vs_vwap_bps": float(diff * 10000),
            "execution_avg": execution.avg_price,
            "market_vwap": market_vwap,
        }

    @staticmethod
    def participation_analysis(execution: AlgoExecution,
                                market_volume: int) -> Dict[str, float]:
        """Analyze participation rate."""
        if market_volume <= 0:
            return {"participation_rate": 0}
        rate = execution.filled_quantity / market_volume
        return {
            "participation_rate": float(rate),
            "filled_quantity": execution.filled_quantity,
            "market_volume": market_volume,
            "avg_slice_size": float(
                np.mean([s.quantity for s in execution.slices])
            ) if execution.slices else 0,
        }

    @staticmethod
    def execution_profile(execution: AlgoExecution) -> Dict[str, Any]:
        """Detailed execution profile."""
        if not execution.slices:
            return {"num_slices": 0}

        prices = [s.price for s in execution.slices]
        quantities = [s.quantity for s in execution.slices]
        slippages = [s.slippage_bps for s in execution.slices]

        return {
            "num_slices": len(execution.slices),
            "price_range": [float(min(prices)), float(max(prices))],
            "avg_slice_qty": float(np.mean(quantities)),
            "std_slice_qty": float(np.std(quantities)),
            "avg_slippage_bps": float(np.mean(slippages)),
            "max_slippage_bps": float(np.max(slippages)),
            "total_commission": execution.total_commission,
            "fill_ratio": execution.fill_ratio,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 6. ExecutionEngine — Orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class ExecutionEngine:
    """Bloomberg-grade execution engine."""

    def __init__(self):
        self.simulator = ExecutionSimulator()
        self.analyzer = ExecutionAnalyzer()
        self.slippage_model = SlippageModel()
        self.cost_model = TransactionCostModel()
        self._executions: Dict[str, AlgoExecution] = {}

    # ── Schedule Generation ─────────────────────────────────────────────────

    def generate_twap(self, quantity: int, num_slices: int,
                       duration: float) -> List[Dict[str, Any]]:
        return ExecutionAlgo.twap_schedule(quantity, num_slices, duration)

    def generate_vwap(self, quantity: int, num_slices: int,
                       profile: Optional[List[float]] = None) -> List[Dict[str, Any]]:
        return ExecutionAlgo.vwap_schedule(quantity, num_slices, profile)

    def generate_iceberg(self, quantity: int,
                          display_size: int) -> List[Dict[str, Any]]:
        return ExecutionAlgo.iceberg_schedule(quantity, display_size)

    def generate_pov(self, quantity: int, volumes: List[int],
                      rate: float = 0.10) -> List[Dict[str, Any]]:
        return ExecutionAlgo.pov_schedule(quantity, volumes, rate)

    def generate_adaptive(self, quantity: int, num_slices: int,
                           urgency: float = 0.5) -> List[Dict[str, Any]]:
        return ExecutionAlgo.adaptive_schedule(quantity, num_slices, urgency)

    # ── Simulation ──────────────────────────────────────────────────────────

    def simulate_twap(self, symbol: str, side: str, quantity: int,
                       price: float, **kwargs) -> AlgoExecution:
        exec_ = self.simulator.simulate_twap(symbol, side, quantity, price, **kwargs)
        self._executions[exec_.execution_id] = exec_
        return exec_

    def simulate_vwap(self, symbol: str, side: str, quantity: int,
                       price: float, **kwargs) -> AlgoExecution:
        exec_ = self.simulator.simulate_vwap(symbol, side, quantity, price, **kwargs)
        self._executions[exec_.execution_id] = exec_
        return exec_

    def simulate_iceberg(self, symbol: str, side: str, quantity: int,
                          price: float, display_size: int = 100,
                          **kwargs) -> AlgoExecution:
        exec_ = self.simulator.simulate_iceberg(symbol, side, quantity, price,
                                                  display_size, **kwargs)
        self._executions[exec_.execution_id] = exec_
        return exec_

    # ── Analysis ────────────────────────────────────────────────────────────

    def analyze_execution(self, execution_id: str) -> Dict[str, Any]:
        exec_ = self._executions.get(execution_id)
        if not exec_:
            return {"error": "not_found"}
        shortfall = self.analyzer.implementation_shortfall(exec_)
        profile = self.analyzer.execution_profile(exec_)
        return {"shortfall": shortfall, "profile": profile, **exec_.to_dict()}

    def compare_vwap(self, execution_id: str,
                      market_vwap: float) -> Dict[str, float]:
        exec_ = self._executions.get(execution_id)
        if not exec_:
            return {"error": "not_found"}
        return self.analyzer.vwap_comparison(exec_, market_vwap)

    # ── Cost Estimation ─────────────────────────────────────────────────────

    def estimate_slippage(self, price: float, quantity: int,
                           adv: float, spread: float = 0.01,
                           volatility: float = 0.02) -> Dict[str, float]:
        return self.slippage_model.estimate_slippage(
            price, quantity, adv, spread, volatility)

    def estimate_cost(self, quantity: int, price: float,
                       side: str = "buy",
                       bid: float = 0, ask: float = 0) -> Dict[str, float]:
        return self.cost_model.total_cost(quantity, price, side, bid, ask)

    # ── Queries ─────────────────────────────────────────────────────────────

    def get_execution(self, execution_id: str) -> Optional[AlgoExecution]:
        return self._executions.get(execution_id)

    def get_all_executions(self) -> List[AlgoExecution]:
        return list(self._executions.values())

    def get_active_executions(self) -> List[AlgoExecution]:
        return [e for e in self._executions.values() if e.is_active]

    def capabilities(self) -> Dict[str, Any]:
        return {
            "algos": [a.value for a in AlgoType],
            "features": [
                "twap", "vwap", "iceberg", "pov", "adaptive",
                "slippage_modeling", "transaction_cost_analysis",
                "implementation_shortfall", "vwap_comparison",
                "execution_simulation", "almgren_chriss",
            ],
            "total_executions": len(self._executions),
        }
