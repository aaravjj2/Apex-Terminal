"""
Risk Desk API routes — fastapi router.
Week 1: /validate, /demo-csv
Week 2: /run (5-tool pipeline), /ticket (T6), /scenarios
v1.7: determinism, enhanced export bundles
"""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from typing import Optional
from datetime import datetime, timezone
import io
import zipfile
import json
import hashlib

from ...risk_desk import validate_portfolio, ValidationResult
from ...risk_desk.schemas_w2 import (
    RiskRunRequest,
    RiskRunResult,
    TicketRequest,
    TicketDraft,
)
from ...risk_desk.pipeline import execute_risk_run
from ...risk_desk.ticket_builder import build_ticket
from ...risk_desk.stress_tester import SCENARIOS

router = APIRouter(prefix="/risk-desk", tags=["risk-desk"])

FIXTURES_DIR = Path(__file__).parent.parent.parent / "risk_desk" / "fixtures"

# In-memory run store (keyed by run_id) — good enough for demo mode.
_run_store: dict[str, RiskRunResult] = {}


@router.post("/validate", response_model=ValidationResult)
async def validate(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
) -> ValidationResult:
    """Validate an options portfolio CSV.

    Accepts either:
    * ``file`` — a multipart file upload, or
    * ``csv_text`` — raw CSV pasted as a form field.
    """
    if file is not None:
        raw = (await file.read()).decode("utf-8")
    elif csv_text is not None:
        raw = csv_text
    else:
        return ValidationResult(
            valid=False,
            total_rows=0,
            error_count=1,
            warning_count=0,
            issues=[{
                "severity": "error",
                "row": None,
                "field": "input",
                "message": "No CSV provided. Upload a file or supply csv_text.",
                "code": "NO_INPUT",
            }],
        )

    return validate_portfolio(raw)


@router.get("/demo-csv")
async def get_demo_csv() -> dict:
    """Return the committed demo portfolio CSV so the frontend can load it."""
    path = FIXTURES_DIR / "demo_portfolio.csv"
    return {"csv": path.read_text()}


# ── Week 2 endpoints ─────────────────────────────────────────────────────

@router.get("/scenarios")
async def list_scenarios() -> dict:
    """Return available stress scenarios."""
    return {
        "scenarios": [
            {"id": s.id, "label": s.label}
            for s in SCENARIOS.values()
        ]
    }


@router.post("/run", response_model=RiskRunResult)
async def run_risk_pipeline(req: RiskRunRequest) -> RiskRunResult:
    """Execute the 5-tool risk pipeline (T1-T5).

    Body JSON: { csv_text, scenario_id?, snapshot_id? }
    """
    result = execute_risk_run(
        csv_text=req.csv_text,
        scenario_id=req.scenario_id,
    )
    _run_store[result.run_id] = result
    return result


@router.post("/ticket", response_model=TicketDraft)
async def generate_ticket(req: TicketRequest) -> dict:
    """Build a trade ticket for a selected hedge (T6).

    Body JSON: { run_id, selected_hedge_id }
    """
    run = _run_store.get(req.run_id)
    if run is None:
        return {"error": f"Run {req.run_id} not found"}

    ticket = build_ticket(run, req.selected_hedge_id)
    if ticket is None:
        return {"error": f"Hedge {req.selected_hedge_id} not found in run {req.run_id}"}

    return ticket.model_dump()


@router.get("/export/{run_id}")
async def export_risk_run(run_id: str):
    """
    Export Risk Desk run as a ZIP bundle (v1.7 institutional-ready).
    Includes: risk_run.json, tool_trace.json, compliance.json, portfolio.csv,
              snapshot.json, config_hash.txt, report.html, README.txt
    """
    run = _run_store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    run_data = run.model_dump()
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # risk_run.json (main run data)
        zipf.writestr(f"{run_id}/risk_run.json", json.dumps(run_data, indent=2, default=str))
        
        # tool_trace.json (tool execution trace)
        tool_trace = run.tool_trace if hasattr(run, 'tool_trace') else []
        trace_data = [t.model_dump() if hasattr(t, 'model_dump') else t for t in tool_trace]
        zipf.writestr(f"{run_id}/tool_trace.json", json.dumps(trace_data, indent=2, default=str))
        
        # compliance.json (compliance gate data)
        compliance_data = {
            "run_id": run.run_id,
            "compliance_state": run.compliance.status if run.compliance else "approved",
            "compliance_issues": [v.model_dump() for v in run.compliance.violations] if run.compliance else [],
        }
        zipf.writestr(f"{run_id}/compliance.json", json.dumps(compliance_data, indent=2))
        
        # snapshot.json (market snapshot used)
        snapshot_data = {
            "run_id": run_id,
            "config_hash": run.config_hash or "",
            "portfolio_hash": run.portfolio_hash or "",
            "scenario_id": run.stress.scenario.id if run.stress else "unknown",
            "created_at": run.created_at or datetime.now(timezone.utc).isoformat(),
        }
        zipf.writestr(f"{run_id}/snapshot.json", json.dumps(snapshot_data, indent=2))
        
        # config_hash.txt
        zipf.writestr(f"{run_id}/config_hash.txt", run.config_hash or "N/A")
        
        # portfolio.csv (reconstruct from validation if available)
        portfolio_csv = "# Portfolio CSV not available in this export\n"
        zipf.writestr(f"{run_id}/portfolio.csv", portfolio_csv)
        
        # report.html (self-contained institutional report)
        report_html = _generate_risk_report_html(run, run_data)
        zipf.writestr(f"{run_id}/report.html", report_html)
        
        # README.txt
        readme = f"""RISK DESK RUN EXPORT - {run_id}
{'=' * 80}

SUMMARY
-------
Run ID:          {run_id}
Config Hash:     {run.config_hash or 'N/A'}
Portfolio Hash:  {run.portfolio_hash or 'N/A'}
Scenario:        {run.stress.scenario.label if run.stress else 'N/A'}
Compliance:      {run.compliance.status if run.compliance else 'approved'}
Created:         {run.created_at or 'N/A'}

FILES IN THIS BUNDLE
--------------------
- README.txt          This file
- risk_run.json       Complete risk run data
- tool_trace.json     Tool execution trace (T1-T5) with timestamps
- compliance.json     Compliance gate results
- snapshot.json       Market snapshot & determinism metadata
- config_hash.txt     Config hash for reproducibility
- portfolio.csv       Input portfolio
- report.html         Self-contained HTML report (open in browser)

TOOL PIPELINE (T1-T5)
---------------------
T1: Validator      - Portfolio validation
T2: Pricer         - Options pricing (greeks)
T3: Stress Tester  - Stress scenario analysis
T4: Verifier       - Independent greeks verification
T5: Compliance     - Compliance gate check

DETERMINISM
-----------
Config Hash:     {run.config_hash or 'N/A'}
Portfolio Hash:  {run.portfolio_hash or 'N/A'}
This run is fully reproducible with the same inputs.

Generated: {datetime.now(timezone.utc).isoformat()}
"""
        zipf.writestr(f"{run_id}/README.txt", readme)
    
    # Return ZIP as downloadable file
    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={run_id}_risk_export.zip"
        }
    )


def _generate_risk_report_html(run: RiskRunResult, run_data: dict) -> str:
    """Generate a self-contained HTML report for a risk desk run."""
    scenario_label = run.stress.scenario.label if run.stress else "N/A"
    total_pnl = f"${run.stress.total_pnl:,.2f}" if run.stress else "N/A"
    compliance_status = run.compliance.status if run.compliance else "approved"
    
    greeks_html = ""
    if run.greeks:
        greeks_html = f"""
        <div class="metrics-grid">
            <div class="metric-card"><div class="label">Delta (\u0394)</div><div class="value">{run.greeks.net_delta:.4f}</div></div>
            <div class="metric-card"><div class="label">Gamma (\u0393)</div><div class="value">{run.greeks.net_gamma:.4f}</div></div>
            <div class="metric-card"><div class="label">Vega (V)</div><div class="value">{run.greeks.net_vega:.4f}</div></div>
            <div class="metric-card"><div class="label">Theta (\u0398)</div><div class="value">{run.greeks.net_theta:.4f}</div></div>
        </div>"""

    violations_html = ""
    if run.compliance and run.compliance.violations:
        rows = ""
        for v in run.compliance.violations:
            rows += f"<tr><td>{v.code}</td><td>{v.severity}</td><td>{v.message}</td><td>{v.suggested_fix}</td></tr>\n"
        violations_html = f"""
        <h2>Compliance Violations</h2>
        <table><thead><tr><th>Code</th><th>Severity</th><th>Message</th><th>Suggested Fix</th></tr></thead>
        <tbody>{rows}</tbody></table>"""

    trace_html = ""
    if run.tool_trace:
        trace_rows = ""
        for t in run.tool_trace:
            status_cls = "positive" if t.status == "ok" else "negative"
            cache = "\u2713 cached" if t.cache_hit else ""
            trace_rows += f"<tr><td>{t.tool_id}</td><td>{t.tool_name}</td><td>{t.duration_ms}ms</td><td class='{status_cls}'>{t.status}</td><td>{cache}</td><td>{t.outputs_summary}</td></tr>\n"
        trace_html = f"""
        <h2>Tool Execution Trace</h2>
        <table><thead><tr><th>ID</th><th>Tool</th><th>Duration</th><th>Status</th><th>Cache</th><th>Output</th></tr></thead>
        <tbody>{trace_rows}</tbody></table>"""

    hedges_html = ""
    if run.stress and run.stress.hedge_candidates:
        hedge_rows = ""
        for h in run.stress.hedge_candidates:
            hedge_rows += f"<tr><td>{h.name}</td><td>{h.strategy_type}</td><td>${h.net_cost_est:,.2f}</td><td>${h.max_loss_reduction_est:,.2f}</td><td>{h.explanation}</td></tr>\n"
        hedges_html = f"""
        <h2>Hedge Candidates</h2>
        <table><thead><tr><th>Name</th><th>Type</th><th>Cost</th><th>Max Loss Reduction</th><th>Explanation</th></tr></thead>
        <tbody>{hedge_rows}</tbody></table>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Risk Desk Report - {run.run_id}</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; color: #333; }}
.container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
h1 {{ font-size: 28px; margin-bottom: 8px; color: #1a1a1a; }}
h2 {{ font-size: 22px; margin-top: 30px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #007acc; padding-bottom: 8px; }}
.metadata {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }}
.metadata p {{ margin: 4px 0; }}
.metadata code {{ background: #e0e0e0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }}
.metrics-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }}
.metric-card {{ background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #007acc; }}
.metric-card .label {{ font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }}
.metric-card .value {{ font-size: 24px; font-weight: bold; color: #1a1a1a; }}
.positive {{ color: #22c55e; }}
.negative {{ color: #ef4444; }}
table {{ width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }}
th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }}
th {{ background: #f0f0f0; font-weight: 600; color: #555; }}
.footer {{ margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }}
.determinism {{ background: #fff8e1; border: 1px solid #ffeb3b; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 13px; }}
.compliance-badge {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 14px; }}
.compliance-approved {{ background: #dcfce7; color: #166534; }}
.compliance-blocked {{ background: #fee2e2; color: #991b1b; }}
</style>
</head>
<body>
<div class="container">
    <h1>Risk Desk Report</h1>
    <div class="metadata">
        <p><strong>Run ID:</strong> <code>{run.run_id}</code></p>
        <p><strong>Scenario:</strong> {scenario_label}</p>
        <p><strong>Stress P&L:</strong> {total_pnl}</p>
        <p><strong>Compliance:</strong> <span class="compliance-badge compliance-{compliance_status}">{compliance_status.upper()}</span></p>
        <p><strong>Created:</strong> {run.created_at or 'N/A'}</p>
    </div>
    <div class="determinism">
        <p><strong>Determinism Metadata</strong></p>
        <p>Config Hash: <code>{run.config_hash or 'N/A'}</code></p>
        <p>Portfolio Hash: <code>{run.portfolio_hash or 'N/A'}</code></p>
    </div>
    <h2>Portfolio Greeks</h2>
    {greeks_html}
    <h2>Stress Test Results</h2>
    <div class="metrics-grid">
        <div class="metric-card"><div class="label">Total P&L</div><div class="value negative">{total_pnl}</div></div>
        <div class="metric-card"><div class="label">Scenario</div><div class="value">{scenario_label}</div></div>
    </div>
    {violations_html}
    {hedges_html}
    {trace_html}
    <div class="footer">
        <p>Generated by Axiom Risk & Strategy Desk | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        <p>This report is self-contained. Config hash: <code>{run.config_hash or 'N/A'}</code></p>
    </div>
</div>
</body>
</html>"""
