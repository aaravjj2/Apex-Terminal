import { useSyncExternalStore, useEffect } from 'react';
import { portfolioOptimizerStore } from '../stores/waveStores';

function usePortfolioOptimizer() {
  return useSyncExternalStore(portfolioOptimizerStore.subscribe, portfolioOptimizerStore.getState);
}

export function PortfolioOptimizerUI2() {
  const { allocations, result, hash, loading, error } = usePortfolioOptimizer();
  useEffect(() => { portfolioOptimizerStore.fetchAll(); }, []);

  return (
    <div data-testid="portfolio-optimizer-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Portfolio Optimizer</h1>
      {loading && <p data-testid="po-loading">Optimizing portfolio...</p>}
      {error && <p data-testid="po-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="po-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Hash: {hash.slice(0, 16)}…</p>}
      {result && (
        <div data-testid="po-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          <div data-testid="po-sharpe" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Portfolio Sharpe</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{(result as any).portfolio_sharpe ?? '—'}</div>
          </div>
          <div data-testid="po-return" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Expected Return</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{(result as any).expected_return != null ? `${((result as any).expected_return * 100).toFixed(1)}%` : '—'}</div>
          </div>
          <div data-testid="po-vol" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Portfolio Vol</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{(result as any).portfolio_vol != null ? `${((result as any).portfolio_vol * 100).toFixed(1)}%` : '—'}</div>
          </div>
        </div>
      )}
      <div data-testid="po-allocation-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Symbol','Weight','Return','Vol','Sharpe'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allocations.map((a: any, i) => (
              <tr key={a.symbol} data-testid={`po-alloc-${i}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td data-testid={`po-sym-${i}`} style={{ padding: '8px 12px', fontWeight: 600 }}>{a.symbol}</td>
                <td data-testid={`po-weight-${i}`} style={{ padding: '8px 12px' }}>{(a.weight * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px', color: '#22c55e' }}>{(a.expected_return * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px', color: '#f59e0b' }}>{(a.volatility * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px' }}>{a.sharpe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
