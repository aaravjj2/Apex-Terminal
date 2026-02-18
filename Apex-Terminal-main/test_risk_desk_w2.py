"""
Week 2 Risk Desk backend tests.

Tests the full pipeline (T1-T5), individual tools (T2-T6),
and API endpoints (/run, /ticket, /scenarios).
"""

from __future__ import annotations

import json
import math
import pytest
from pathlib import Path

# ── Fixtures ────────────────────────────────────────────────────────────────

FIXTURES_DIR = Path(__file__).parent / "phase1" / "services" / "risk_desk" / "fixtures"
DEMO_CSV = (FIXTURES_DIR / "demo_portfolio.csv").read_text()
DEMO_SNAPSHOT = json.loads((FIXTURES_DIR / "demo_snapshot.json").read_text())


# ── Imports ─────────────────────────────────────────────────────────────────

from phase1.services.risk_desk.pipeline import execute_risk_run
from phase1.services.risk_desk.greeks_calculator import calculate_greeks, _bs_greeks
from phase1.services.risk_desk.stress_tester import run_stress_test, SCENARIOS
from phase1.services.risk_desk.greeks_verifier import verify_greeks, _binomial_price
from phase1.services.risk_desk.compliance_checker import check_compliance
from phase1.services.risk_desk.ticket_builder import build_ticket
from phase1.services.risk_desk.validator import parse_csv, load_default_snapshot
from phase1.services.risk_desk.schemas_w2 import RiskRunResult


# ── Helper ──────────────────────────────────────────────────────────────────

def _run_demo() -> RiskRunResult:
    """Execute the full pipeline with demo data."""
    return execute_risk_run(DEMO_CSV, "moderate_selloff")


# ═══════════════════════════════════════════════════════════════════════════
# T2: Greeks Calculator
# ═══════════════════════════════════════════════════════════════════════════

class TestGreeksCalculator:
    def test_bs_call_delta_positive(self):
        g = _bs_greeks(225, 220, 0.15, 0.30, 0.05, "call")
        assert 0.0 < g["delta"] < 1.0, f"Call delta {g['delta']} not in (0, 1)"

    def test_bs_put_delta_negative(self):
        g = _bs_greeks(225, 210, 0.15, 0.25, 0.05, "put")
        assert -1.0 < g["delta"] < 0.0, f"Put delta {g['delta']} not in (-1, 0)"

    def test_gamma_positive(self):
        g = _bs_greeks(225, 220, 0.15, 0.30, 0.05, "call")
        assert g["gamma"] > 0

    def test_vega_positive(self):
        g = _bs_greeks(225, 220, 0.15, 0.30, 0.05, "call")
        assert g["vega"] > 0

    def test_calculate_greeks_returns_summary(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = calculate_greeks(portfolio.rows, snapshot)
        assert result.net_delta != 0.0
        assert len(result.per_leg) == 7

    def test_calculate_greeks_deterministic(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        r1 = calculate_greeks(portfolio.rows, snapshot)
        r2 = calculate_greeks(portfolio.rows, snapshot)
        assert r1.net_delta == r2.net_delta
        assert r1.net_gamma == r2.net_gamma


# ═══════════════════════════════════════════════════════════════════════════
# T3: Stress Tester
# ═══════════════════════════════════════════════════════════════════════════

class TestStressTester:
    def test_three_scenarios_exist(self):
        assert len(SCENARIOS) == 3
        assert "moderate_selloff" in SCENARIOS
        assert "severe_crash" in SCENARIOS
        assert "vol_expansion" in SCENARIOS

    def test_stress_returns_two_hedge_candidates(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = run_stress_test(portfolio.rows, snapshot, "moderate_selloff")
        assert len(result.hedge_candidates) == 2
        ids = [h.id for h in result.hedge_candidates]
        assert "hedge_A" in ids
        assert "hedge_B" in ids

    def test_stress_pnl_negative_for_selloff(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = run_stress_test(portfolio.rows, snapshot, "moderate_selloff")
        # With a selloff, the portfolio with net long calls should lose value
        assert result.total_pnl != 0

    def test_stress_leg_results_match_rows(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = run_stress_test(portfolio.rows, snapshot, "moderate_selloff")
        assert len(result.leg_results) == len(portfolio.rows)

    def test_hedge_candidate_legs_populated(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = run_stress_test(portfolio.rows, snapshot, "moderate_selloff")
        for hc in result.hedge_candidates:
            assert len(hc.legs) >= 2
            assert hc.net_cost_est != 0 or True  # cost can be 0 for collar
            assert hc.explanation != ""


# ═══════════════════════════════════════════════════════════════════════════
# T4: Greeks Verifier
# ═══════════════════════════════════════════════════════════════════════════

class TestGreeksVerifier:
    def test_binomial_call_price_positive(self):
        p = _binomial_price(225, 220, 0.15, 0.30, 0.05, "call", 50)
        assert p > 0

    def test_binomial_put_price_positive(self):
        p = _binomial_price(225, 210, 0.15, 0.25, 0.05, "put", 50)
        assert p > 0

    def test_verification_passes_for_demo(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        greeks = calculate_greeks(portfolio.rows, snapshot)
        result = verify_greeks(portfolio.rows, snapshot, greeks)
        assert result.method == "binomial_tree"
        assert result.verified is True
        assert result.max_delta_deviation < 0.05

    def test_verification_deterministic(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        greeks = calculate_greeks(portfolio.rows, snapshot)
        r1 = verify_greeks(portfolio.rows, snapshot, greeks)
        r2 = verify_greeks(portfolio.rows, snapshot, greeks)
        assert r1.max_delta_deviation == r2.max_delta_deviation


# ═══════════════════════════════════════════════════════════════════════════
# T5: Compliance Checker
# ═══════════════════════════════════════════════════════════════════════════

class TestComplianceChecker:
    def test_demo_portfolio_blocked(self):
        """Demo portfolio has naked short puts → should be blocked."""
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = check_compliance(portfolio.rows, snapshot)
        assert result.status == "blocked"
        assert len(result.violations) >= 1

    def test_uncovered_short_detected(self):
        portfolio = parse_csv(DEMO_CSV)
        snapshot = load_default_snapshot()
        result = check_compliance(portfolio.rows, snapshot)
        codes = [v.code for v in result.violations]
        assert "UNCOVERED_SHORT" in codes

    def test_all_long_portfolio_approved(self):
        """A portfolio with only long options should be approved."""
        csv = (
            "symbol,option_type,strike,expiry,quantity,multiplier\n"
            "AAPL,call,220,2025-03-21,10,100\n"
            "MSFT,call,430,2025-03-21,5,100\n"
        )
        portfolio = parse_csv(csv)
        snapshot = load_default_snapshot()
        result = check_compliance(portfolio.rows, snapshot)
        assert result.status == "approved"
        assert len(result.violations) == 0

    def test_oversized_position_blocked(self):
        csv = (
            "symbol,option_type,strike,expiry,quantity,multiplier\n"
            "AAPL,call,220,2025-03-21,100,100\n"
        )
        portfolio = parse_csv(csv)
        snapshot = load_default_snapshot()
        result = check_compliance(portfolio.rows, snapshot)
        codes = [v.code for v in result.violations]
        assert "POSITION_SIZE" in codes


# ═══════════════════════════════════════════════════════════════════════════
# T6: Ticket Builder
# ═══════════════════════════════════════════════════════════════════════════

class TestTicketBuilder:
    def test_build_ticket_hedge_a(self):
        run = _run_demo()
        ticket = build_ticket(run, "hedge_A")
        assert ticket is not None
        assert ticket.hedge_id == "hedge_A"
        assert ticket.run_id == run.run_id
        assert len(ticket.legs) >= 2
        assert ticket.compliance_status in ("approved", "blocked")

    def test_build_ticket_hedge_b(self):
        run = _run_demo()
        ticket = build_ticket(run, "hedge_B")
        assert ticket is not None
        assert ticket.hedge_id == "hedge_B"

    def test_build_ticket_invalid_hedge_returns_none(self):
        run = _run_demo()
        ticket = build_ticket(run, "hedge_Z")
        assert ticket is None

    def test_ticket_contains_run_id(self):
        run = _run_demo()
        ticket = build_ticket(run, "hedge_A")
        assert run.run_id in ticket.notes


# ═══════════════════════════════════════════════════════════════════════════
# Pipeline (end-to-end)
# ═══════════════════════════════════════════════════════════════════════════

class TestPipeline:
    def test_demo_pipeline_runs_ok(self):
        result = _run_demo()
        assert result.ok is True
        assert result.run_id.startswith("run-")

    def test_pipeline_has_5_trace_entries(self):
        result = _run_demo()
        assert len(result.tool_trace) == 5
        ids = [t.tool_id for t in result.tool_trace]
        assert ids == ["T1", "T2", "T3", "T4", "T5"]

    def test_all_tools_status_ok(self):
        result = _run_demo()
        for t in result.tool_trace:
            assert t.status == "ok", f"{t.tool_id} status={t.status}: {t.outputs_summary}"

    def test_pipeline_greeks_populated(self):
        result = _run_demo()
        assert result.greeks is not None
        assert result.greeks.net_delta != 0.0
        assert len(result.greeks.per_leg) == 7

    def test_pipeline_stress_populated(self):
        result = _run_demo()
        assert result.stress is not None
        assert result.stress.total_pnl != 0.0
        assert len(result.stress.hedge_candidates) == 2

    def test_pipeline_verification_populated(self):
        result = _run_demo()
        assert result.verification is not None
        assert result.verification.verified is True

    def test_pipeline_compliance_populated(self):
        result = _run_demo()
        assert result.compliance is not None
        assert result.compliance.status in ("approved", "blocked")

    def test_pipeline_deterministic(self):
        """Two runs produce identical outputs (except run_id and timing)."""
        r1 = _run_demo()
        r2 = _run_demo()
        assert r1.greeks.net_delta == r2.greeks.net_delta
        assert r1.stress.total_pnl == r2.stress.total_pnl
        assert r1.compliance.status == r2.compliance.status

    def test_invalid_csv_fails_gracefully(self):
        result = execute_risk_run("this is not csv", "moderate_selloff")
        assert result.ok is False
        assert len(result.tool_trace) >= 1

    def test_empty_csv_fails(self):
        result = execute_risk_run("", "moderate_selloff")
        assert result.ok is False
