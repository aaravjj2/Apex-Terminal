/**
 * Enhanced Backtest Analyze Tab with 5 Required Charts
 * 1. Equity Curve (with tooltip & zoom)
 * 2. Drawdown Chart (underwater plot)
 * 3. Daily Returns Histogram
 * 4. Monthly Returns Heatmap
 * 5. Rolling Sharpe Ratio Mini-Chart
 */

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush
} from 'recharts';
import type { BacktestRun } from '../../backtest/types';
import { formatNumberSafe, formatPercentSafe, formatCurrencySafe, tickFormatCurrency, tickFormatPercent } from '../../../utils/formatters';

interface AnalyzeTabProps {
  run: BacktestRun;
}

export function AnalyzeTab({ run }: AnalyzeTabProps) {
  if (!run) {
    return (
      <div className="text-center text-text-secondary py-8">
        Select a run from the Runs tab to analyze.
      </div>
    );
  }

  // Prepare equity curve data (guard against null config/initial_capital)
  const initialCapital = run.config?.initial_capital ?? 100000;
  const equityData = (run.equity_curve ?? []).map((point: { timestamp: string; equity: number }) => ({
    timestamp: new Date(point.timestamp).getTime(),
    timestampLabel: new Date(point.timestamp).toLocaleDateString(),
    equity: point.equity ?? 0,
    returnPct: initialCapital > 0 ? ((( point.equity ?? 0) - initialCapital) / initialCapital) * 100 : 0
  }));

  // Calculate drawdown data
  let maxEquity = initialCapital;
  const drawdownData = equityData.map((point: any) => {
    if (point.equity > maxEquity) maxEquity = point.equity;
    const drawdown = ((point.equity - maxEquity) / maxEquity) * 100;
    return {
      ...point,
      drawdown
    };
  });

  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityData.length; i++) {
    const prevEquity = equityData[i - 1].equity;
    const currEquity = equityData[i].equity;
    if (prevEquity > 0) {
      const dailyReturn = ((currEquity - prevEquity) / prevEquity) * 100;
      dailyReturns.push(dailyReturn);
    }
  }

  // Create histogram bins
  const histogramBins: Record<string, number> = {};
  const binSize = 0.5; // 0.5% bins
  dailyReturns.forEach((ret) => {
    const bin = Math.floor(ret / binSize) * binSize;
    const binKey = bin.toFixed(1);
    histogramBins[binKey] = (histogramBins[binKey] || 0) + 1;
  });

  const histogramData = Object.entries(histogramBins)
    .map(([bin, count]) => ({ bin: parseFloat(bin), count }))
    .sort((a, b) => a.bin - b.bin);

  // Calculate monthly returns for heatmap
  const monthlyReturnsMap: Record<string, number> = {};
  equityData.forEach((point: any, idx: number) => {
    if (idx === 0) return;
    const date = new Date(point.timestamp);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Calculate return for this month
    const prevDay = equityData[idx - 1];
    if (prevDay.equity > 0) {
      const dailyRet = ((point.equity - prevDay.equity) / prevDay.equity) * 100;
      monthlyReturnsMap[monthKey] = (monthlyReturnsMap[monthKey] || 0) + dailyRet;
    }
  });

  const monthlyReturns = Object.entries(monthlyReturnsMap).map(([month, ret]) => ({
    month,
    return: ret
  }));

  // Calculate rolling Sharpe (30-day window)
  const rollingWindow = 30;
  const rollingMetrics: Array<{timestamp: number; timestampLabel: string; rollingSharpe: number}> = [];
  
  for (let i = rollingWindow; i < dailyReturns.length; i++) {
    const windowReturns = dailyReturns.slice(i - rollingWindow, i);
    const mean = windowReturns.reduce((sum, ret) => sum + ret, 0) / windowReturns.length;
    const variance = windowReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / windowReturns.length;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0; // Annualized
    
    rollingMetrics.push({
      timestamp: equityData[i].timestamp,
      timestampLabel: equityData[i].timestampLabel,
      rollingSharpe: sharpe
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Metrics Summary */}
  {run.metrics && (
        <div className="grid grid-cols-4 gap-4" data-testid="analyze-metrics">
          <div className="bg-panel-bg border border-border rounded p-4">
            <div className="text-xs text-text-secondary uppercase tracking-wide">Total Return</div>
            <div className={`text-2xl font-bold mt-1 ${(run.metrics.total_return_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
              {formatPercentSafe(run.metrics.total_return_pct)}
            </div>
          </div>
          <div className="bg-panel-bg border border-border rounded p-4">
            <div className="text-xs text-text-secondary uppercase tracking-wide">Sharpe Ratio</div>
            <div className="text-2xl font-bold text-text mt-1">{formatNumberSafe(run.metrics.sharpe_ratio)}</div>
          </div>
          <div className="bg-panel-bg border border-border rounded p-4">
            <div className="text-xs text-text-secondary uppercase tracking-wide">Max Drawdown</div>
            <div className="text-2xl font-bold text-down mt-1">{formatPercentSafe(run.metrics.max_drawdown_pct)}</div>
          </div>
          <div className="bg-panel-bg border border-border rounded p-4">
            <div className="text-xs text-text-secondary uppercase tracking-wide">Win Rate</div>
            <div className="text-2xl font-bold text-text mt-1">{formatPercentSafe(run.metrics.win_rate_pct, 1)}</div>
          </div>
        </div>
      )}

      {/* Chart 1: Equity Curve with Zoom */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="backtest-analyze-chart-equity">
        <h3 className="text-sm font-semibold text-text mb-4">Equity Curve</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={equityData} margin={{ top: 5, right: 30, left: 20, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="timestampLabel" 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
              tickFormatter={tickFormatCurrency}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-element)', 
border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}
              labelStyle={{ color: 'var(--color-text)' }}
              formatter={(value: any) => [formatCurrencySafe(typeof value === 'number' ? value : null), 'Equity']}
            />
            <Line 
              type="monotone" 
              dataKey="equity" 
              stroke="var(--color-brand)" 
              strokeWidth={2}
              dot={false}
            />
            <Brush 
              dataKey="timestampLabel" 
              height={30} 
              stroke="var(--color-brand)"
              fill="var(--color-element)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Drawdown (Underwater Plot) */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="backtest-analyze-chart-drawdown">
        <h3 className="text-sm font-semibold text-text mb-4">Drawdown (Underwater Plot)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={drawdownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="timestampLabel" 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => tickFormatPercent(val, 1)}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-element)', 
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}
              formatter={(value: any) => [formatPercentSafe(typeof value === 'number' ? value : null), 'Drawdown']}
            />
            <Area 
              type="monotone" 
              dataKey="drawdown" 
              stroke="var(--color-down)" 
              fill="var(--color-down)" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Daily Returns Histogram */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="backtest-analyze-chart-histogram">
        <h3 className="text-sm font-semibold text-text mb-4">Daily Returns Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={histogramData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="bin" 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => tickFormatPercent(val, 1)}
            />
            <YAxis 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
              label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: 'var(--color-text-secondary)' }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-element)', 
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}
              formatter={(value: any) => [typeof value === 'number' ? value : 0, 'Count']}
            />
            <Bar 
              dataKey="count" 
              fill="var(--color-brand)" 
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Monthly Returns Heatmap (Simplified Grid) */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="backtest-analyze-chart-heatmap">
        <h3 className="text-sm font-semibold text-text mb-4">Monthly Returns</h3>
        <div className="grid grid-cols-6 gap-2">
          {monthlyReturns.map(({month, return: ret}) => {
            const safeRet = ret ?? 0;
            const intensity = Math.min(Math.abs(safeRet) / 10, 1); // Normalize to 0-1
            const bgColor = safeRet >= 0 
              ? `rgba(8, 153, 129, ${intensity})` 
              : `rgba(242, 54, 69, ${intensity})`;
            
            return (
              <div 
                key={month}
                className="p-3 rounded border border-border text-center"
                style={{ backgroundColor: bgColor }}
                title={`${month}: ${formatPercentSafe(safeRet)}`}
              >
                <div className="text-xs text-text-secondary">{month}</div>
                <div className="text-sm font-semibold text-text mt-1">{formatPercentSafe(ret, 1)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart 5: Rolling Sharpe Ratio */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="backtest-analyze-chart-rolling-sharpe">
        <h3 className="text-sm font-semibold text-text mb-4">Rolling 30-Day Sharpe Ratio</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rollingMetrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="timestampLabel" 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="var(--color-text-secondary)" 
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-element)', 
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}
              formatter={(value: any) => [formatNumberSafe(typeof value === 'number' ? value : null), 'Sharpe']}
            />
            <Line 
              type="monotone" 
              dataKey="rollingSharpe" 
              stroke="var(--color-warn)" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trade Blotter */}
      <div className="bg-panel-bg border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">Trade Blotter ({(run.trades || []).length} trades)</h3>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full" data-testid="trade-blotter">
            <thead className="bg-element-bg sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">Trade ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">Timestamp</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">Side</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">Price</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text">P&L</th>
              </tr>
            </thead>
            <tbody>
              {(run.trades || []).map((trade: any) => (
                <tr key={trade.trade_id} className="border-b border-border hover:bg-element-bg/50">
                  <td className="px-4 py-2 text-xs font-mono text-text">{trade.trade_id}</td>
                  <td className="px-4 py-2 text-xs text-text">
                    {new Date(trade.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                      trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-text">{trade.quantity}</td>
                  <td className="px-4 py-2 text-xs text-text">{formatCurrencySafe(trade.price)}</td>
                  <td className={`px-4 py-2 text-xs font-semibold ${
                    trade.pnl && trade.pnl > 0 ? 'text-up' : trade.pnl && trade.pnl < 0 ? 'text-down' : 'text-text'
                  }`}>
                    {trade.pnl != null ? formatCurrencySafe(trade.pnl) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
