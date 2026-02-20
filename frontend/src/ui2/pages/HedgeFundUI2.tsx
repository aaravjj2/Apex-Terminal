import { useSyncExternalStore, useEffect } from 'react';
import { hedgeFundStore } from '../stores/waveStores';

function useHedgeFund() {
  return useSyncExternalStore(hedgeFundStore.subscribe, hedgeFundStore.getState);
}

export function HedgeFundUI2() {
  const { allocations, summary, hash, loading, error } = useHedgeFund();
  useEffect(() => { hedgeFundStore.fetchAll(); }, []);

  return (
    <div data-testid="hedge-fund-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Hedge Fund Mode</h1>
      {loading && <p data-testid="hf-loading">Loading fund data...</p>}
      {error && <p data-testid="hf-error" style={{ color: '#ef4444' }}>{error}</p>}
      {summary && (
        <div data-testid="hf-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
          <div data-testid="hf-fund-name" style={{ background: '#1e293b', padding: 14, borderRadius: 8, gridColumn: 'span 2' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{(summary as any).fund_name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>AUM ${(summary as any).total_aum_usd_m}M</div>
          </div>
          <div data-testid="hf-ytd" style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>YTD Return</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{(((summary as any).ytd_return ?? 0) * 100).toFixed(1)}%</div>
          </div>
          <div data-testid="hf-nav" style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>NAV/Share</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>${(summary as any).nav_per_share}</div>
          </div>
          <div data-testid="hf-sharpe" style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Sharpe (inception)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{(summary as any).sharpe_inception}</div>
          </div>
          <div data-testid="hf-drawdown" style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Max Drawdown</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{(((summary as any).max_drawdown ?? 0) * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}
      {hash && <p data-testid="hf-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="hf-allocation-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Bucket','Strategy','AUM %','AUM ($M)','Sharpe YTD','Beta','Gross Exp.'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allocations.map((a: any, i) => (
              <tr key={a.bucket} data-testid={`hf-row-${i}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td data-testid={`hf-bucket-${i}`} style={{ padding: '8px 12px', fontWeight: 600 }}>{a.bucket}</td>
                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{a.strategy}</td>
                <td data-testid={`hf-aum-pct-${i}`} style={{ padding: '8px 12px' }}>{(a.aum_pct * 100).toFixed(0)}%</td>
                <td style={{ padding: '8px 12px' }}>${a.aum_usd_m}M</td>
                <td data-testid={`hf-sharpe-${i}`} style={{ padding: '8px 12px', color: '#22c55e' }}>{a.sharpe_ytd}</td>
                <td style={{ padding: '8px 12px' }}>{a.beta}</td>
                <td style={{ padding: '8px 12px' }}>{a.gross_exposure}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
