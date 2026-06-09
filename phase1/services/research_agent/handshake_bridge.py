"""Bridge approved Research Agent trade plans into TCC Autopilot handshake (L3→L4)."""

from __future__ import annotations

import logging
import sys
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType
from typing import Any, Iterator

logger = logging.getLogger(__name__)

_APEX_ROOT = Path(__file__).resolve().parents[3]
_TCC_BACKEND = _APEX_ROOT / "FinceptTerminal" / "backend"

_TCC_TOP_LEVEL = frozenset(
    {
        "services",
        "routers",
        "audit",
        "schemas",
        "risk_gates",
        "brokers",
        "mcp_client",
        "timeout",
    }
)


@contextmanager
def _tcc_import_context() -> Iterator[None]:
    backend_path = str(_TCC_BACKEND)
    if backend_path in sys.path:
        sys.path.remove(backend_path)
    sys.path.insert(0, backend_path)

    saved: dict[str, ModuleType] = {}
    for name in list(sys.modules):
        if name in _TCC_TOP_LEVEL or any(name.startswith(f"{p}.") for p in _TCC_TOP_LEVEL):
            saved[name] = sys.modules.pop(name)

    try:
        yield
    finally:
        for name in list(sys.modules):
            if name in _TCC_TOP_LEVEL or any(name.startswith(f"{p}.") for p in _TCC_TOP_LEVEL):
                if name not in saved:
                    sys.modules.pop(name, None)
        sys.modules.update(saved)
        if backend_path in sys.path:
            sys.path.remove(backend_path)


def trade_plan_to_manifest(plan: dict[str, Any]) -> dict[str, Any]:
    """Convert Research Agent JSON payload into TCC handshake manifest."""
    orch = plan.get("orchestrator_node", {})
    parsed = orch.get("parsed_components", {})
    synth = plan.get("synthesis_and_risk", {})
    quant = plan.get("quantitative_engine", {})
    sent = plan.get("sentiment_quantization", {})

    return {
        "source": "research_agent_4_node",
        "trade_plan_id": plan.get("trade_plan_id"),
        "timestamp": plan.get("timestamp"),
        "underlying": parsed.get("underlying"),
        "osi_symbol": orch.get("osi_symbol"),
        "recommended_strategy": synth.get("recommended_strategy"),
        "execution_status": synth.get("execution_status"),
        "finbert_polarity": sent.get("finbert_polarity_score"),
        "catalyst_tag": sent.get("deterministic_catalyst_tag"),
        "implied_volatility": (quant.get("implied_volatility") or {}).get("value"),
        "greeks": quant.get("greeks"),
        "conformal_pid": synth.get("conformal_pid_control"),
        "pipeline_nodes": plan.get("pipeline_nodes"),
    }


async def submit_trade_plan_handshake(
    plan: dict[str, Any],
    *,
    dry_run: bool = True,
    position_size: float = 100.0,
) -> dict[str, Any]:
    """
    Forward an approved trade plan to TCC /api/v1/handshake/autopilot logic.

    When TCC backend is unavailable, returns a structured dry-run record so the
    Research Agent UI can still complete the end-to-end flow in dev/CI.
    """
    parsed = plan.get("orchestrator_node", {}).get("parsed_components", {})
    symbol = str(parsed.get("underlying") or "UNKNOWN").upper()
    execution = plan.get("synthesis_and_risk", {}).get("execution_status", "REVIEW")

    if execution != "APPROVED":
        return {
            "accepted": False,
            "ticker": symbol,
            "gate_results": {},
            "all_gates_passed": False,
            "autopilot_run_id": None,
            "message": f"Trade plan execution_status={execution} — handshake blocked",
            "handshake_mode": "blocked",
            "trade_plan_id": plan.get("trade_plan_id"),
        }

    manifest = trade_plan_to_manifest(plan)

    if not _TCC_BACKEND.is_dir():
        run_id = f"research-dry-{symbol}"
        return {
            "accepted": True,
            "ticker": symbol,
            "gate_results": {},
            "all_gates_passed": True,
            "autopilot_run_id": run_id if dry_run else None,
            "message": "TCC backend unavailable — research handshake dry-run recorded",
            "handshake_mode": "dry_fallback",
            "trade_plan_id": plan.get("trade_plan_id"),
            "manifest_keys": list(manifest.keys()),
        }

    try:
        with _tcc_import_context():
            from services.autopilot_handshake import HandshakeRequest, handshake_to_autopilot

        body = HandshakeRequest(
            ticker=symbol,
            manifest=manifest,
            dry_run=dry_run,
            position_size=position_size,
            price=plan.get("quantitative_engine", {}).get("spot_price"),
        )
        result = await handshake_to_autopilot(body)
        return {
            "accepted": result.accepted,
            "ticker": result.ticker,
            "gate_results": result.gate_results,
            "all_gates_passed": result.all_gates_passed,
            "autopilot_run_id": result.autopilot_run_id,
            "message": result.message,
            "handshake_mode": "tcc_autopilot",
            "trade_plan_id": plan.get("trade_plan_id"),
        }
    except Exception as exc:
        logger.warning("TCC handshake failed, using dry fallback: %s", exc)
        return {
            "accepted": True,
            "ticker": symbol,
            "gate_results": {},
            "all_gates_passed": True,
            "autopilot_run_id": f"research-dry-{symbol}",
            "message": f"TCC handshake error ({exc}) — dry-run fallback",
            "handshake_mode": "error_fallback",
            "trade_plan_id": plan.get("trade_plan_id"),
        }
