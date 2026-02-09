"""
Week 2 Pydantic domain schemas for Risk Desk.

Extends Week 1 schemas with:
- RiskRunRequest / RiskRunResult
- Greeks, StressResult, HedgeCandidate, ComplianceResult, TicketDraft
- ToolTraceEntry for the 6-tool pipeline
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from .schemas import ValidationResult


# ── Tool trace ──────────────────────────────────────────────────────────────

class ToolTraceEntry(BaseModel):
    """One step in the deterministic tool pipeline."""
    tool_id: str = Field(..., description="T1..T6 identifier")
    tool_name: str = Field(..., description="Human-readable tool name")
    started_at: str = ""
    ended_at: str = ""
    duration_ms: float = 0.0
    status: str = "ok"  # "ok" | "error" | "skipped"
    inputs_summary: str = ""
    outputs_summary: str = ""
    error_message: str = ""
    cache_hit: bool = False


# ── Greeks ──────────────────────────────────────────────────────────────────

class GreeksSummary(BaseModel):
    """Portfolio-level aggregate greeks."""
    net_delta: float = 0.0
    net_gamma: float = 0.0
    net_vega: float = 0.0
    net_theta: float = 0.0
    per_leg: list[dict] = Field(default_factory=list)


# ── Stress test ─────────────────────────────────────────────────────────────

class StressScenario(BaseModel):
    """A named stress scenario."""
    id: str
    label: str
    spot_shift_pct: float = Field(..., description="% change in underlying price")
    vol_shift_pct: float = Field(..., description="% change in IV")


class StressLegResult(BaseModel):
    """P&L for one leg under one scenario."""
    symbol: str
    option_type: str
    strike: float
    base_value: float = 0.0
    stressed_value: float = 0.0
    pnl: float = 0.0


class StressResult(BaseModel):
    """Full stress test output including hedge candidates."""
    scenario: StressScenario
    total_pnl: float = 0.0
    leg_results: list[StressLegResult] = Field(default_factory=list)
    hedge_candidates: list["HedgeCandidate"] = Field(default_factory=list)


# ── Hedge candidates ───────────────────────────────────────────────────────

class HedgeLeg(BaseModel):
    """One leg of a hedge trade."""
    symbol: str
    option_type: str
    strike: float
    expiry: str
    side: str  # "buy" or "sell"
    quantity: int
    premium_est: float = 0.0


class HedgeCandidate(BaseModel):
    """A proposed hedge trade (exactly 2 candidates per run)."""
    id: str  # "hedge_A" or "hedge_B"
    name: str
    strategy_type: str  # e.g. "protective_put_spread", "call_spread_collar"
    legs: list[HedgeLeg] = Field(default_factory=list)
    net_cost_est: float = 0.0
    max_loss_reduction_est: float = 0.0
    explanation: str = ""


# ── Compliance ──────────────────────────────────────────────────────────────

class ComplianceViolation(BaseModel):
    """A single compliance rule violation."""
    code: str
    severity: str  # "critical" | "warning"
    message: str
    suggested_fix: str = ""


class ComplianceResult(BaseModel):
    """Output of the compliance checker."""
    status: str = "approved"  # "approved" | "blocked"
    violations: list[ComplianceViolation] = Field(default_factory=list)


# ── Ticket ──────────────────────────────────────────────────────────────────

class TicketDraft(BaseModel):
    """Trade ticket JSON draft."""
    run_id: str
    hedge_id: str
    hedge_name: str
    legs: list[dict] = Field(default_factory=list)
    net_cost_est: float = 0.0
    compliance_status: str = ""
    generated_at: str = ""
    notes: str = ""


# ── Verifier ────────────────────────────────────────────────────────────────

class VerifierResult(BaseModel):
    """Output of the independent greeks verifier (binomial/finite-diff)."""
    method: str = "binomial_tree"
    verified: bool = True
    max_delta_deviation: float = 0.0
    max_gamma_deviation: float = 0.0
    max_vega_deviation: float = 0.0
    max_theta_deviation: float = 0.0
    details: list[dict] = Field(default_factory=list)


# ── Top-level run ───────────────────────────────────────────────────────────

class RiskRunRequest(BaseModel):
    """Input for POST /api/risk-desk/run."""
    csv_text: str = ""
    scenario_id: str = "moderate_selloff"
    snapshot_id: str = "demo"


class TicketRequest(BaseModel):
    """Input for POST /api/risk-desk/ticket."""
    run_id: str
    selected_hedge_id: str  # "hedge_A" or "hedge_B"


class RiskRunResult(BaseModel):
    """Full output of the risk run pipeline."""
    run_id: str
    ok: bool = True
    error: str = ""
    created_at: str = ""
    config_hash: str = ""
    portfolio_hash: str = ""

    # T1
    validation: Optional[ValidationResult] = None

    # T2
    greeks: Optional[GreeksSummary] = None

    # T3
    stress: Optional[StressResult] = None

    # T4
    verification: Optional[VerifierResult] = None

    # T5
    compliance: Optional[ComplianceResult] = None

    # T6 (ticket is built separately via /ticket endpoint)

    # Trace
    tool_trace: list[ToolTraceEntry] = Field(default_factory=list)
