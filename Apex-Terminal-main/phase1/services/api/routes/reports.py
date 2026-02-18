"""
Reports API Routes - Report generation and download.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from services.reports import get_report_generator

router = APIRouter(tags=["Reports"])


class PerformanceReportRequest(BaseModel):
    strategy_id: str
    start_date: str
    end_date: str
    trades: List[dict] = []
    metrics: dict = {}


class AuditReportRequest(BaseModel):
    start_date: str
    end_date: str
    orders: List[dict] = []
    alerts: List[dict] = []
    errors: List[dict] = []


class ReportSummary(BaseModel):
    report_id: str
    generated_at: str
    type: str


@router.get("/reports", response_model=List[ReportSummary])
async def list_reports():
    """List all generated reports."""
    generator = get_report_generator()
    return generator.list_reports()


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    """Get a specific report."""
    generator = get_report_generator()
    report = generator.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/reports/{report_id}/html", response_class=HTMLResponse)
async def get_report_html(report_id: str):
    """Get report as downloadable HTML."""
    generator = get_report_generator()
    report = generator.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return generator.to_html(report)


@router.post("/reports/performance")
async def create_performance_report(data: PerformanceReportRequest):
    """Generate a performance report."""
    generator = get_report_generator()
    report = generator.generate_performance_report(
        strategy_id=data.strategy_id,
        start_date=data.start_date,
        end_date=data.end_date,
        trades=data.trades,
        metrics=data.metrics
    )
    return {"report_id": report["report_id"], "message": "Report generated"}


@router.post("/reports/audit")
async def create_audit_report(data: AuditReportRequest):
    """Generate an audit trail report."""
    generator = get_report_generator()
    report = generator.generate_audit_report(
        start_date=data.start_date,
        end_date=data.end_date,
        orders=data.orders,
        alerts=data.alerts,
        errors=data.errors
    )
    return {"report_id": report["report_id"], "message": "Report generated"}
