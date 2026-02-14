/**
 * v1.42 — Correlation Matrix Panel
 * DEMO-first cross-asset correlation matrix display.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface CorrelationData {
  symbols: string[];
  data: number[][];
  period: string;
  computed_at: string;
}

export function CorrelationPanel() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/correlation/matrix`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const getColor = (val: number) => {
    if (val >= 0.8) return 'bg-green-500/40 text-green-300';
    if (val >= 0.5) return 'bg-green-500/20 text-green-400';
    if (val >= 0.0) return 'bg-gray-500/10 text-text-muted';
    if (val >= -0.5) return 'bg-red-500/20 text-red-400';
    return 'bg-red-500/40 text-red-300';
  };

  return (
    <div data-testid="correlation-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Correlation Matrix</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.42 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="correlation-loading" className="animate-pulse">
          <div className="h-64 bg-element-bg/50 rounded-lg" />
        </div>
      )}

      {!loading && !data && (
        <div data-testid="correlation-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No correlation data available</p>
        </div>
      )}

      {!loading && data && (
        <div className="flex-1 overflow-auto">
          <div className="text-xs text-text-muted mb-2">
            Period: {data.period} • Computed: {data.computed_at}
          </div>
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-text-muted text-xs"></th>
                {data.symbols.map(s => (
                  <th key={s} data-testid={`corr-header-${s}`} className="p-2 text-text-muted text-xs font-mono">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.symbols.map((row, ri) => (
                <tr key={row}>
                  <td className="p-2 text-text-muted text-xs font-mono">{row}</td>
                  {data.data[ri].map((val, ci) => (
                    <td
                      key={`${ri}-${ci}`}
                      data-testid={`corr-cell-${ri}-${ci}`}
                      className={`p-2 text-center font-mono text-xs rounded ${getColor(val)}`}
                    >
                      {val.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div data-testid="correlation-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
