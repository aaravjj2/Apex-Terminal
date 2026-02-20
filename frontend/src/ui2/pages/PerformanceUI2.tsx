import { useSyncExternalStore, useEffect } from 'react';
import { performanceStore } from '../stores/waveStores';

function usePerformance() {
  return useSyncExternalStore(performanceStore.subscribe, performanceStore.getState);
}

function returnColor(v: number): string {
  return v >= 0 ? '#22c55e' : '#ef4444';
}

export function PerformanceUI2() {
  const { dashboard, periods, strategies, loading, error } = usePerformance();

  useEffect(() => {
    performanceStore.fetchAll();
  }, []);

  return (
    <div data-testid="performance-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Performance Analytics</h1>
      {loading && <p>Loading performance data...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Total P&L</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: returnColor((dashboard as any).total_pnl ?? 0) }}>
              ${((dashboard as any).total_pnl ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Win Rate</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{((dashboard as any).win_rate ?? 0).toFixed(1)}%</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Sharpe Ratio</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{((dashboard as any).sharpe_ratio ?? 0).toFixed(3)}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Max Drawdown</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{((dashboard as any).max_drawdown ?? 0).toFixed(1)}%</div>
          </div>
        </div>
      )}
      {periods.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Period Returns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {periods.map((p: any) => (
              <div key={p.period} data-testid={`perf-period-${p.period}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>{p.period}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: returnColor(p.return_pct ?? 0) }}>
                  {(p.return_pct ?? 0) >= 0 ? '+' : ''}{(p.return_pct ?? 0).toFixed(2)}%
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  P&L: ${(p.pnl ?? 0).toLocaleString()} | Trades: {p.trades ?? 0}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {strategies.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Strategy Breakdown</h2>
          <table data-testid="perf-strategies-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8' }}>Strategy</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>Return</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>Sharpe</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>Win Rate</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>Trades</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s: any) => (
                <tr key={s.strategy_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: 8, fontWeight: 500 }}>{s.name || s.strategy_id}</td>
                  <td style={{ padding: 8, textAlign: 'right', color: returnColor(s.return_pct ?? 0) }}>{(s.return_pct ?? 0).toFixed(2)}%</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{(s.sharpe ?? 0).toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{(s.win_rate ?? 0).toFixed(1)}%</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{s.total_trades ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
