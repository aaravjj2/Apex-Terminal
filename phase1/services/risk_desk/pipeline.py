"""
Pipeline Orchestrator — runs T1 → T2 → T3 → T4 → T5 sequentially.

Each tool is wrapped in a ToolTraceEntry capturing timing, status, and
summary info.  Returns a complete RiskRunResult.

Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

import hashlib
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from .schemas import Snapshot
from .schemas_w2 import (
    RiskRunRequest,
    RiskRunResult,
    ToolTraceEntry,
)
from .validator import validate_portfolio, load_default_snapshot, parse_csv
from .greeks_calculator import calculate_greeks
from .stress_tester import run_stress_test, DEFAULT_SCENARIO_ID
from .greeks_verifier import verify_greeks
from .compliance_checker import check_compliance


def _is_demo_mode() -> bool:
    return os.environ.get("DEMO_MODE", "0") == "1"


def _make_run_id(csv_text: str, scenario_id: str) -> str:
    """Deterministic run_id in DEMO_MODE, random otherwise."""
    if _is_demo_mode():
        digest = hashlib.sha256(f"{csv_text}|{scenario_id}".encode()).hexdigest()[:12]
        return f"run-{digest}"
    return f"run-{uuid.uuid4().hex[:12]}"


def _portfolio_hash(csv_text: str) -> str:
    return hashlib.sha256(csv_text.strip().encode()).hexdigest()[:16]


def _config_hash(csv_text: str, scenario_id: str) -> str:
    return hashlib.sha256(f"{csv_text.strip()}|{scenario_id}".encode()).hexdigest()[:16]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def execute_risk_run(
    csv_text: str,
    scenario_id: str = DEFAULT_SCENARIO_ID,
    snapshot: Optional[Snapshot] = None,
) -> RiskRunResult:
    """Execute the full 5-tool risk run pipeline.

    T1: Portfolio Validator
    T2: Greeks Calculator
    T3: Stress Tester (+ hedge candidates)
    T4: Greeks Verifier (binomial tree cross-check)
    T5: Compliance Checker

    Returns a RiskRunResult with all tool outputs and a trace timeline.
    """
    run_id = _make_run_id(csv_text, scenario_id)
    created_at = _iso_now()
    p_hash = _portfolio_hash(csv_text)
    c_hash = _config_hash(csv_text, scenario_id)
    trace: list[ToolTraceEntry] = []

    if snapshot is None:
        snapshot = load_default_snapshot()

    # ── T1: Portfolio Validator ──────────────────────────────────────────
    t0 = time.monotonic()
    t0_iso = _iso_now()
    try:
        validation = validate_portfolio(csv_text, snapshot)
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T1",
            tool_name="portfolio_validator",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="ok",
            inputs_summary=f"{len(csv_text)} chars CSV",
            outputs_summary=(
                f"valid={validation.valid}, "
                f"{len(validation.issues)} issues, "
                f"{validation.total_rows} rows"
            ),
        ))
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T1",
            tool_name="portfolio_validator",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="error",
            inputs_summary=f"{len(csv_text)} chars CSV",
            outputs_summary=f"Error: {exc}",
        ))
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error=f"T1 failed: {exc}",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            tool_trace=trace,
        )

    if not validation.valid:
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error="Portfolio validation failed — see issues",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            validation=validation,
            tool_trace=trace,
        )

    # Re-parse CSV to get PortfolioRow objects for downstream tools
    portfolio = parse_csv(csv_text)
    rows = portfolio.rows

    # ── T2: Greeks Calculator ────────────────────────────────────────────
    t0 = time.monotonic()
    t0_iso = _iso_now()
    try:
        greeks = calculate_greeks(rows, snapshot)
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T2",
            tool_name="greeks_calculator",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="ok",
            inputs_summary=f"{len(rows)} legs",
            outputs_summary=(
                f"Δ={greeks.net_delta:.4f}, "
                f"Γ={greeks.net_gamma:.4f}, "
                f"V={greeks.net_vega:.4f}, "
                f"Θ={greeks.net_theta:.4f}"
            ),
        ))
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T2",
            tool_name="greeks_calculator",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="error",
            inputs_summary=f"{len(rows)} legs",
            outputs_summary=f"Error: {exc}",
        ))
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error=f"T2 failed: {exc}",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            validation=validation,
            tool_trace=trace,
        )

    # ── T3: Stress Tester ────────────────────────────────────────────────
    t0 = time.monotonic()
    t0_iso = _iso_now()
    try:
        stress = run_stress_test(rows, snapshot, scenario_id)
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T3",
            tool_name="stress_tester",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="ok",
            inputs_summary=f"scenario={scenario_id}, {len(rows)} legs",
            outputs_summary=(
                f"P&L=${stress.total_pnl:,.2f}, "
                f"{len(stress.hedge_candidates)} hedges"
            ),
        ))
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T3",
            tool_name="stress_tester",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="error",
            inputs_summary=f"scenario={scenario_id}",
            outputs_summary=f"Error: {exc}",
        ))
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error=f"T3 failed: {exc}",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            validation=validation,
            greeks=greeks,
            tool_trace=trace,
        )

    # ── T4: Greeks Verifier ──────────────────────────────────────────────
    t0 = time.monotonic()
    t0_iso = _iso_now()
    try:
        verification = verify_greeks(rows, snapshot, greeks)
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T4",
            tool_name="greeks_verifier",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="ok",
            inputs_summary=f"method=binomial_tree, {len(rows)} legs",
            outputs_summary=(
                f"verified={verification.verified}, "
                f"max_Δ_dev={verification.max_delta_deviation:.6f}"
            ),
        ))
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T4",
            tool_name="greeks_verifier",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="error",
            inputs_summary="binomial_tree verification",
            outputs_summary=f"Error: {exc}",
        ))
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error=f"T4 failed: {exc}",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            validation=validation,
            greeks=greeks,
            stress=stress,
            tool_trace=trace,
        )

    # ── T5: Compliance Checker ───────────────────────────────────────────
    t0 = time.monotonic()
    t0_iso = _iso_now()
    try:
        compliance = check_compliance(rows, snapshot)
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T5",
            tool_name="compliance_checker",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="ok",
            inputs_summary=f"{len(rows)} legs",
            outputs_summary=(
                f"status={compliance.status}, "
                f"{len(compliance.violations)} violations"
            ),
        ))
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        trace.append(ToolTraceEntry(
            tool_id="T5",
            tool_name="compliance_checker",
            started_at=t0_iso,
            ended_at=_iso_now(),
            duration_ms=elapsed,
            status="error",
            inputs_summary=f"{len(rows)} legs",
            outputs_summary=f"Error: {exc}",
        ))
        return RiskRunResult(
            run_id=run_id,
            ok=False,
            error=f"T5 failed: {exc}",
            created_at=created_at,
            config_hash=c_hash,
            portfolio_hash=p_hash,
            validation=validation,
            greeks=greeks,
            stress=stress,
            verification=verification,
            tool_trace=trace,
        )

    # ── Assemble result ──────────────────────────────────────────────────
    return RiskRunResult(
        run_id=run_id,
        ok=True,
        created_at=created_at,
        config_hash=c_hash,
        portfolio_hash=p_hash,
        validation=validation,
        greeks=greeks,
        stress=stress,
        verification=verification,
        compliance=compliance,
        tool_trace=trace,
    )
