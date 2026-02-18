/**
 * v1.49 — Strategy Comparison Matrix Panel
 * DEMO-first side-by-side strategy metrics comparison.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface StrategyMetrics {
  id: string;
  name: string;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  win_rate: number;
  avg_return: number;
  total_trades: number;
  profit_factor: number;
  calmar: number;
}

export function StrategyComparePanel() {
  const [strategies, setStrategies] = useState<StrategyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('sharpe');

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/strategy-compare`)
      .then(r => r.json())
      .then(data => setStrategies(Array.isArray(data) ? data : []))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...strategies].sort((a, b) => {
    const av = (a as any)[sortKey] ?? 0;
    const bv = (b as any)[sortKey] ?? 0;
    return sortKey === 'max_drawdown' ? av - bv : bv - av;
  });

  const cols = ['sharpe', 'sortino', 'max_drawdown', 'win_rate', 'profit_factor', 'calmar', 'total_trades', 'avg_return'];

  const formatVal = (key: string, val: number) => {
    if (key === 'max_drawdown' || key === 'win_rate' || key === 'avg_return') return `${(val * 100).toFixed(1)}%`;
    if (key === 'total_trades') return String(val);
    return val.toFixed(2);
  };

  return (
    <div data-testid="strategy-compare-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Strategy Comparison</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.49 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="strategy-compare-loading" className="animate-pulse">
          <div className="h-48 bg-element-bg/50 rounded-lg" />
        </div>
      )}

      {!loading && strategies.length === 0 && (
        <div data-testid="strategy-compare-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No strategies to compare</p>
        </div>
      )}

      {!loading && strategies.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border">
                <th className="text-left py-2 px-2 sticky left-0 bg-background">Strategy</th>
                {cols.map(c => (
                  <th
                    key={c}
                    data-testid={`compare-col-${c}`}
                    onClick={() => setSortKey(c)}
                    className={`text-right py-2 px-2 cursor-pointer hover:text-text transition-colors ${sortKey === c ? 'text-brand' : ''}`}
                  >
                    {c.replace(/_/g, ' ')}
                    {sortKey === c && ' ▼'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => (
                <tr key={s.id} data-testid={`compare-row-${idx}`} className="border-b border-border/30 hover:bg-element-bg/20">
                  <td className="py-2 px-2 font-medium text-text sticky left-0 bg-background">{s.name}</td>
                  {cols.map(c => {
                    const v = (s as any)[c];
                    return (
                      <td key={c} className="py-2 px-2 text-right font-mono text-text-secondary text-xs">
                        {formatVal(c, v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div data-testid="strategy-compare-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
