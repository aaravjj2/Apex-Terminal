"""
Report Generator - Creates performance reports in various formats.
"""
import json
from datetime import datetime
from typing import List, Optional


class ReportGenerator:
    """Generates strategy performance and audit reports."""
    
    def __init__(self):
        self._reports: dict = {}
    
    def generate_performance_report(
        self,
        strategy_id: str,
        start_date: str,
        end_date: str,
        trades: List[dict],
        metrics: dict
    ) -> dict:
        """Generate a performance report."""
        
        # Calculate basic stats
        total_trades = len(trades)
        winning_trades = [t for t in trades if t.get("pnl", 0) > 0]
        losing_trades = [t for t in trades if t.get("pnl", 0) < 0]
        
        total_pnl = sum(t.get("pnl", 0) for t in trades)
        win_rate = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
        
        avg_win = sum(t.get("pnl", 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t.get("pnl", 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        report = {
            "report_id": f"perf_{strategy_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "generated_at": datetime.utcnow().isoformat(),
            "strategy_id": strategy_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "total_trades": total_trades,
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "win_rate_pct": round(win_rate, 2),
                "total_pnl": round(total_pnl, 2),
                "avg_win": round(avg_win, 2),
                "avg_loss": round(avg_loss, 2),
                "profit_factor": round(abs(avg_win / avg_loss), 2) if avg_loss != 0 else 0
            },
            "metrics": metrics,
            "trades": trades
        }
        
        self._reports[report["report_id"]] = report
        return report
    
    def generate_audit_report(
        self,
        start_date: str,
        end_date: str,
        orders: List[dict],
        alerts: List[dict],
        errors: List[dict]
    ) -> dict:
        """Generate an audit trail report."""
        
        report = {
            "report_id": f"audit_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "generated_at": datetime.utcnow().isoformat(),
            "period": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "total_orders": len(orders),
                "total_alerts": len(alerts),
                "total_errors": len(errors)
            },
            "orders": orders,
            "alerts": alerts,
            "errors": errors
        }
        
        self._reports[report["report_id"]] = report
        return report
    
    def get_report(self, report_id: str) -> Optional[dict]:
        return self._reports.get(report_id)
    
    def list_reports(self) -> List[dict]:
        return [
            {
                "report_id": r["report_id"],
                "generated_at": r["generated_at"],
                "type": "performance" if r["report_id"].startswith("perf_") else "audit"
            }
            for r in self._reports.values()
        ]
    
    def to_html(self, report: dict) -> str:
        """Convert report to HTML format."""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Trading Report - {report.get('report_id', 'Unknown')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; background: #131722; color: #d1d4dc; }}
        h1 {{ color: #2962ff; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #2a2e39; }}
        th {{ background: #1e222d; }}
        .positive {{ color: #089981; }}
        .negative {{ color: #f23645; }}
        .metric {{ background: #1e222d; padding: 15px; border-radius: 8px; margin: 10px 0; }}
    </style>
</head>
<body>
    <h1>📊 Trading Report</h1>
    <p>Generated: {report.get('generated_at', 'Unknown')}</p>
    <p>Period: {report.get('period', {}).get('start', 'N/A')} to {report.get('period', {}).get('end', 'N/A')}</p>
    
    <h2>Summary</h2>
    <div class="metric">
"""
        summary = report.get('summary', {})
        for key, value in summary.items():
            css_class = ''
            if 'pnl' in key.lower():
                css_class = 'positive' if value > 0 else 'negative'
            html += f"<p><strong>{key.replace('_', ' ').title()}:</strong> <span class='{css_class}'>{value}</span></p>\n"
        
        html += """
    </div>
</body>
</html>
"""
        return html


# Singleton
_generator: Optional[ReportGenerator] = None

def get_report_generator() -> ReportGenerator:
    global _generator
    if _generator is None:
        _generator = ReportGenerator()
    return _generator
