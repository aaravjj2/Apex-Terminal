"""
T6: Ticket Builder — deterministic trade-ticket JSON generator.

Given a completed risk run and a selected hedge candidate, produces a
TicketDraft ready for desk review / export.

Fully deterministic — no LLM, no API keys.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .schemas_w2 import (
    ComplianceResult,
    HedgeCandidate,
    RiskRunResult,
    TicketDraft,
)


def build_ticket(
    run: RiskRunResult,
    selected_hedge_id: str,
) -> Optional[TicketDraft]:
    """Build a TicketDraft from a completed risk run + selected hedge.

    Args:
        run: The completed RiskRunResult from the pipeline.
        selected_hedge_id: Either "hedge_A" or "hedge_B".

    Returns:
        A TicketDraft if the selected hedge exists, or None.
    """
    if not run.stress or not run.stress.hedge_candidates:
        return None

    # Find the selected hedge candidate
    candidate: Optional[HedgeCandidate] = None
    for hc in run.stress.hedge_candidates:
        if hc.id == selected_hedge_id:
            candidate = hc
            break

    if candidate is None:
        return None

    # Determine compliance status
    compliance_status = "unknown"
    if run.compliance:
        compliance_status = run.compliance.status

    # Build the ticket
    return TicketDraft(
        run_id=run.run_id,
        hedge_id=candidate.id,
        hedge_name=candidate.name,
        legs=[leg.model_dump() for leg in candidate.legs],
        net_cost_est=candidate.net_cost_est,
        compliance_status=compliance_status,
        generated_at=datetime.now(timezone.utc).isoformat(),
        notes=(
            f"Auto-generated from risk run {run.run_id}. "
            f"Strategy: {candidate.strategy_type}. "
            f"Stress scenario: {run.stress.scenario.label}. "
            f"Portfolio stress P&L: ${run.stress.total_pnl:,.2f}. "
            f"Est. max loss reduction: ${candidate.max_loss_reduction_est:,.2f}."
        ),
    )
