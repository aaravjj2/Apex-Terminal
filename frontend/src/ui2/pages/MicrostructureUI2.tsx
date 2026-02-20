import { useSyncExternalStore, useEffect } from 'react';
import { microstructureStore } from '../stores/waveStores';

function useMicrostructure() {
  return useSyncExternalStore(microstructureStore.subscribe, microstructureStore.getState);
}

export function MicrostructureUI2() {
  const { metrics, hash, loading, error } = useMicrostructure();
  useEffect(() => { microstructureStore.fetchAll(); }, []);

  return (
    <div data-testid="microstructure-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Microstructure Metrics</h1>
      {loading && <p data-testid="ms-loading">Fetching microstructure data...</p>}
      {error && <p data-testid="ms-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="ms-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="ms-grid" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Symbol','Bid','Ask','Spread (bps)','Order Imbalance','VWAP','VWAP Dev (bps)','Trades/min'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: any, i) => (
              <tr key={m.symbol} data-testid={`ms-row-${i}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td data-testid={`ms-symbol-${i}`} style={{ padding: '8px 12px', fontWeight: 700 }}>{m.symbol}</td>
                <td style={{ padding: '8px 12px' }}>{m.bid}</td>
                <td style={{ padding: '8px 12px' }}>{m.ask}</td>
                <td data-testid={`ms-spread-${i}`} style={{ padding: '8px 12px', color: '#f59e0b' }}>{m.spread_bps}</td>
                <td data-testid={`ms-imbalance-${i}`} style={{ padding: '8px 12px', color: m.order_imbalance > 0 ? '#22c55e' : '#ef4444' }}>{m.order_imbalance > 0 ? `+${m.order_imbalance}` : m.order_imbalance}</td>
                <td style={{ padding: '8px 12px' }}>{m.vwap}</td>
                <td style={{ padding: '8px 12px' }}>{m.vwap_dev_bps}</td>
                <td style={{ padding: '8px 12px' }}>{m.trades_per_min}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
