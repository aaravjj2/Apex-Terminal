"""
Backtest Report Generator - HTML Report with Embedded Charts
Generates self-contained HTML reports for backtest runs.
"""

from typing import List, Optional
from datetime import datetime
from .models import BacktestRun, EquityPoint, TradeFill


def generate_html_report(run: BacktestRun) -> str:
    """
    Generate a self-contained HTML report with embedded SVG charts.
    No external CDN dependencies.
    """
    
    # Extract data for charts
    equity_data = []
    drawdown_data = []
    if run.equity_curve:
        max_equity = run.config.initial_capital
        for point in run.equity_curve:
            equity_data.append({
                'timestamp': point.timestamp.isoformat(),
                'equity': point.equity
            })
            if point.equity > max_equity:
                max_equity = point.equity
            drawdown = ((point.equity - max_equity) / max_equity) * 100 if max_equity > 0 else 0
            drawdown_data.append({
                'timestamp': point.timestamp.isoformat(),
                'drawdown': drawdown
            })
    
    # Calculate daily returns for histogram
    daily_returns = []
    if len(equity_data) > 1:
        for i in range(1, len(equity_data)):
            prev_equity = equity_data[i-1]['equity']
            curr_equity = equity_data[i]['equity']
            if prev_equity > 0:
                daily_return = ((curr_equity - prev_equity) / prev_equity) * 100
                daily_returns.append(daily_return)
    
    # Metrics
    metrics = run.metrics
    config = run.config
    
    # Generate HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest Report - {run.run_id}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        h1 {{ font-size: 32px; margin-bottom: 10px; color: #1a1a1a; }}
        h2 {{ font-size: 24px; margin-top: 40px; margin-bottom: 20px; color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }}
        h3 {{ font-size: 18px; margin-top: 20px; margin-bottom: 10px; color: #555; }}
        .metadata {{ background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 14px; }}
        .metadata p {{ margin: 5px 0; }}
        .metadata code {{ background: #e0e0e0; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }}
        .metrics-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }}
        .metric-card {{ background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #007acc; }}
        .metric-card .label {{ font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }}
        .metric-card .value {{ font-size: 28px; font-weight: bold; color: #1a1a1a; }}
        .metric-card .value.positive {{ color: #22c55e; }}
        .metric-card .value.negative {{ color: #ef4444; }}
        .chart-container {{ margin: 30px 0; background: #fafafa; padding: 20px; border-radius: 8px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }}
        th {{ background: #f0f0f0; font-weight: 600; color: #555; }}
        tr:hover {{ background: #f9f9f9; }}
        .footer {{ margin-top: 50px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; text-align: center; }}
        .determinism {{ background: #fff8e1; border: 1px solid #ffeb3b; padding: 15px; border-radius: 8px; margin: 20px 0; }}
        .determinism strong {{ color: #f57c00; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Backtest Report</h1>
        <div class="metadata">
            <p><strong>Run ID:</strong> <code>{run.run_id}</code></p>
            <p><strong>Strategy ID:</strong> <code>{config.strategy_id}</code></p>
            <p><strong>Symbol:</strong> {config.symbol}</p>
            <p><strong>Period:</strong> {config.start_date} to {config.end_date}</p>
            <p><strong>Initial Capital:</strong> ${config.initial_capital:,.2f}</p>
            <p><strong>Completed:</strong> {run.completed_at.strftime('%Y-%m-%d %H:%M:%S') if run.completed_at else 'N/A'}</p>
        </div>

        <div class="determinism">
            <p><strong>Determinism Guarantee:</strong></p>
"""
    
    if run.config_hash:
        html += f'            <p>Config Hash: <code>{run.config_hash}</code></p>\n'
    if hasattr(config, 'seed') and config.seed is not None:
        html += f'            <p>Random Seed: <code>{config.seed}</code></p>\n'
    
    html += f"""            <p>Engine Version: <code>1.0.0</code></p>
            <p><em>This run is fully reproducible with the above parameters.</em></p>
        </div>

        <h2>Performance Metrics</h2>
        <div class="metrics-grid">
"""
    
    if metrics:
        # Total Return
        total_return_class = 'positive' if metrics.total_return_pct >= 0 else 'negative'
        html += f"""            <div class="metric-card">
                <div class="label">Total Return</div>
                <div class="value {total_return_class}">{metrics.total_return_pct:.2f}%</div>
            </div>
"""
        
        # CAGR
        cagr_class = 'positive' if metrics.cagr_pct >= 0 else 'negative'
        html += f"""            <div class="metric-card">
                <div class="label">CAGR</div>
                <div class="value {cagr_class}">{metrics.cagr_pct:.2f}%</div>
            </div>
"""
        
        # Max Drawdown
        html += f"""            <div class="metric-card">
                <div class="label">Max Drawdown</div>
                <div class="value negative">{metrics.max_drawdown_pct:.2f}%</div>
            </div>
"""
        
        # Sharpe Ratio
        sharpe_class = 'positive' if metrics.sharpe_ratio >= 1 else ''
        html += f"""            <div class="metric-card">
                <div class="label">Sharpe Ratio</div>
                <div class="value {sharpe_class}">{metrics.sharpe_ratio:.2f}</div>
            </div>
"""
        
        # Win Rate
        win_rate_class = 'positive' if metrics.win_rate_pct >= 50 else ''
        html += f"""            <div class="metric-card">
                <div class="label">Win Rate</div>
                <div class="value {win_rate_class}">{metrics.win_rate_pct:.1f}%</div>
            </div>
"""
        
        # Total Trades
        html += f"""            <div class="metric-card">
                <div class="label">Total Trades</div>
                <div class="value">{metrics.total_trades}</div>
            </div>
"""
        
        # Profit Factor
        pf_class = 'positive' if metrics.profit_factor >= 1 else 'negative'
        html += f"""            <div class="metric-card">
                <div class="label">Profit Factor</div>
                <div class="value {pf_class}">{metrics.profit_factor:.2f}</div>
            </div>
"""
    
    html += """        </div>

        <h2>Equity Curve</h2>
        <div class="chart-container">
"""
    
    # Generate equity curve SVG
    if equity_data:
        html += _generate_equity_curve_svg(equity_data, config.initial_capital)
    else:
        html += '            <p>No equity curve data available.</p>\n'
    
    html += """        </div>

        <h2>Drawdown</h2>
        <div class="chart-container">
"""
    
    # Generate drawdown SVG
    if drawdown_data:
        html += _generate_drawdown_svg(drawdown_data)
    else:
        html += '            <p>No drawdown data available.</p>\n'
    
    html += """        </div>

        <h2>Trade Summary</h2>
"""
    
    # Trade table
    if run.trades:
        html += f"""        <p>Total trades: {len(run.trades)}</p>
        <table>
            <thead>
                <tr>
                    <th>Trade ID</th>
                    <th>Timestamp</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Fees</th>
                    <th>P&L</th>
                </tr>
            </thead>
            <tbody>
"""
        for trade in run.trades[:50]:  # Limit to first 50 trades for HTML display
            pnl_str = f"${trade.pnl:.2f}" if trade.pnl is not None else "N/A"
            pnl_class = 'positive' if trade.pnl and trade.pnl > 0 else 'negative' if trade.pnl and trade.pnl < 0 else ''
            html += f"""                <tr>
                    <td>{trade.trade_id}</td>
                    <td>{trade.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</td>
                    <td>{trade.symbol}</td>
                    <td>{trade.side}</td>
                    <td>{trade.quantity}</td>
                    <td>${trade.price:.2f}</td>
                    <td>${trade.fees:.2f}</td>
                    <td class="{pnl_class}">{pnl_str}</td>
                </tr>
"""
        
        if len(run.trades) > 50:
            html += f"""                <tr>
                    <td colspan="8"><em>... and {len(run.trades) - 50} more trades (see trades.csv)</em></td>
                </tr>
"""
        
        html += """            </tbody>
        </table>
"""
    else:
        html += '        <p>No trades executed.</p>\n'
    
    html += f"""
        <div class="footer">
            <p>Generated by Backtest Engine v1.0.0 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>This report is self-contained and reproducible. Config hash: <code>{run.config_hash or 'N/A'}</code></p>
        </div>
    </div>
</body>
</html>"""
    
    return html


def _generate_equity_curve_svg(equity_data: List[dict], initial_capital: float) -> str:
    """Generate inline SVG for equity curve"""
    if not equity_data:
        return '<p>No data</p>'
    
    width = 900
    height = 300
    padding = 50
    
    # Find min/max for scaling
    equities = [p['equity'] for p in equity_data]
    min_equity = min(equities)
    max_equity = max(equities)
    equity_range = max_equity - min_equity if max_equity > min_equity else 1
    
    # Generate path
    points = []
    for i, point in enumerate(equity_data):
        x = padding + (i / (len(equity_data) - 1)) * (width - 2 * padding)
        y = height - padding - ((point['equity'] - min_equity) / equity_range) * (height - 2 * padding)
        points.append(f"{x:.2f},{y:.2f}")
    
    path_d = "M " + " L ".join(points)
    
    svg = f"""<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="{width}" height="{height}" fill="white"/>
        <path d="{path_d}" stroke="#007acc" stroke-width="2" fill="none"/>
        <line x1="{padding}" y1="{height - padding}" x2="{width - padding}" y2="{height - padding}" stroke="#ccc" stroke-width="1"/>
        <line x1="{padding}" y1="{padding}" x2="{padding}" y2="{height - padding}" stroke="#ccc" stroke-width="1"/>
        <text x="{width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">Equity Curve</text>
        <text x="10" y="{padding}" font-size="12" fill="#666">${max_equity:,.0f}</text>
        <text x="10" y="{height - padding}" font-size="12" fill="#666">${min_equity:,.0f}</text>
    </svg>"""
    
    return svg


def _generate_drawdown_svg(drawdown_data: List[dict]) -> str:
    """Generate inline SVG for drawdown chart (underwater plot)"""
    if not drawdown_data:
        return '<p>No data</p>'
    
    width = 900
    height = 300
    padding = 50
    
    # Find min drawdown for scaling
    drawdowns = [p['drawdown'] for p in drawdown_data]
    min_drawdown = min(drawdowns)
    max_drawdown = max(drawdowns)
    drawdown_range = max_drawdown - min_drawdown if max_drawdown > min_drawdown else 1
    
    # Generate path (area chart)
    points = []
    for i, point in enumerate(drawdown_data):
        x = padding + (i / (len(drawdown_data) - 1)) * (width - 2 * padding)
        y = height - padding - ((point['drawdown'] - min_drawdown) / drawdown_range) * (height - 2 * padding)
        points.append(f"{x:.2f},{y:.2f}")
    
    # Close the path to create an area
    path_points = points + [f"{width - padding},{height - padding}", f"{padding},{height - padding}"]
    path_d = "M " + " L ".join(path_points) + " Z"
    
    svg = f"""<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="{width}" height="{height}" fill="white"/>
        <path d="{path_d}" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2"/>
        <line x1="{padding}" y1="{height - padding}" x2="{width - padding}" y2="{height - padding}" stroke="#ccc" stroke-width="1"/>
        <line x1="{padding}" y1="{padding}" x2="{padding}" y2="{height - padding}" stroke="#ccc" stroke-width="1"/>
        <text x="{width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">Drawdown (Underwater Plot)</text>
        <text x="10" y="{padding + 15}" font-size="12" fill="#666">0%</text>
        <text x="10" y="{height - padding}" font-size="12" fill="#666">{min_drawdown:.1f}%</text>
    </svg>"""
    
    return svg


def generate_readme_txt(run: BacktestRun) -> str:
    """Generate README.txt with reproduction instructions"""
    
    readme = f"""BACKTEST REPORT BUNDLE - {run.run_id}
{'=' * 80}

SUMMARY
-------
Run ID:          {run.run_id}
Strategy ID:     {run.config.strategy_id}
Symbol:          {run.config.symbol}
Period:          {run.config.start_date} to {run.config.end_date}
Initial Capital: ${run.config.initial_capital:,.2f}
Completed:       {run.completed_at.strftime('%Y-%m-%d %H:%M:%S') if run.completed_at else 'N/A'}

DETERMINISM
-----------
Config Hash:     {run.config_hash or 'N/A'}
Random Seed:     {run.config.seed if hasattr(run.config, 'seed') else 'N/A'}
Engine Version:  1.0.0

This backtest is fully reproducible. Running the same configuration with the same
seed and engine version will produce identical results.

FILES IN THIS BUNDLE
--------------------
- README.txt          This file
- report.html         Self-contained HTML report with charts
- run.json            Complete run data (config + results)
- metrics.json        Performance metrics
- equity_curve.csv    Timestamped equity values
- trades.csv          Trade-by-trade history

HOW TO REPRODUCE THIS RUN
--------------------------
1. Use the Backtest API with the configuration from run.json
2. POST /api/backtest/run with:
   {{
     "strategy_id": "{run.config.strategy_id}",
     "symbol": "{run.config.symbol}",
     "start_date": "{run.config.start_date}",
     "end_date": "{run.config.end_date}",
     "initial_capital": {run.config.initial_capital},
     "slippage_bps": {run.config.slippage_bps if hasattr(run.config, 'slippage_bps') else 5},
     "fee_per_trade": {run.config.fee_per_trade if hasattr(run.config, 'fee_per_trade') else 1},
     "seed": {run.config.seed if hasattr(run.config, 'seed') else 42}
   }}

3. Verify the config_hash matches: {run.config_hash or 'N/A'}

VIEWING THE REPORT
------------------
Open report.html in any modern web browser. No internet connection required.
The report includes embedded SVG charts and is fully self-contained.

QUESTIONS?
----------
For support or questions about this backtest report, consult the API documentation
or contact the development team.

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    return readme
