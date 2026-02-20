import { useSyncExternalStore, useEffect } from 'react';
import { riskNetworkStore } from '../stores/waveStores';

function useRiskNetwork() {
  return useSyncExternalStore(riskNetworkStore.subscribe, riskNetworkStore.getState);
}

export function RiskNetworkUI2() {
  const { nodes, edges, hash, loading, error } = useRiskNetwork();
  useEffect(() => { riskNetworkStore.fetchAll(); }, []);

  return (
    <div data-testid="risk-network-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Risk Network Graph</h1>
      {loading && <p data-testid="rn-loading">Loading risk network...</p>}
      {error && <p data-testid="rn-error" style={{ color: '#ef4444' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div data-testid="rn-node-count" style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{nodes.length}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Nodes</div>
        </div>
        <div data-testid="rn-edge-count" style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{edges.length}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Edges</div>
        </div>
        {hash && <div data-testid="rn-hash" style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>Hash: {hash.slice(0, 16)}…</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nodes</h2>
          <div data-testid="rn-nodes-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nodes.map((n: any, i) => (
              <div key={n.id} data-testid={`rn-node-${i}`} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span data-testid={`rn-node-label-${i}`} style={{ fontWeight: 700 }}>{n.label}</span>
                <span style={{ color: '#94a3b8' }}>{n.type} · {n.sector}</span>
                <span style={{ color: '#f59e0b' }}>risk {n.risk_score}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Edges</h2>
          <div data-testid="rn-edges-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {edges.map((e: any, i) => (
              <div key={i} data-testid={`rn-edge-${i}`} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 8, fontSize: 12 }}>
                <span>{e.source} → {e.target}</span>
                <span style={{ color: '#94a3b8' }}>{e.type}</span>
                <span style={{ color: e.weight > 0 ? '#22c55e' : '#ef4444', marginLeft: 'auto' }}>{e.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
