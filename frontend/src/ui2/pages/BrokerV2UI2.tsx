import { useSyncExternalStore, useEffect, useState } from 'react';
import { brokerStore } from '../stores/waves11_20Store';

function useBroker() {
  return useSyncExternalStore(brokerStore.subscribe, brokerStore.getState);
}

export function BrokerV2UI2() {
  const { readiness, orders, positions, killSwitch, dailyPnl, loading, error } = useBroker();
  const [killReason, setKillReason] = useState('');

  useEffect(() => {
    brokerStore.fetchReadiness();
    brokerStore.fetchOrders();
    brokerStore.fetchPositions();
    brokerStore.fetchKillSwitch();
    brokerStore.fetchDailyPnl();
  }, []);

  return (
    <div data-testid="broker-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Paper Broker (v2)</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Readiness + Kill Switch */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {readiness && (
          <div data-testid="broker-readiness" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${readiness.is_ready ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Broker Status</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: readiness.is_ready ? '#22c55e' : '#ef4444' }}>{readiness.is_ready ? 'Ready' : 'Not Ready'}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Session: {readiness.session_type}</div>
          </div>
        )}

        {killSwitch && (
          <div data-testid="broker-kill-switch" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${killSwitch.active ? '#ef4444' : '#22c55e'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Kill Switch</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: killSwitch.active ? '#ef4444' : '#22c55e' }}>{killSwitch.active ? 'ACTIVE' : 'Inactive'}</div>
            {killSwitch.active && <div style={{ color: '#94a3b8', fontSize: 12 }}>{killSwitch.reason}</div>}
          </div>
        )}

        {dailyPnl && (
          <div data-testid="broker-daily-pnl" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${dailyPnl.total >= 0 ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Daily P&L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: dailyPnl.total >= 0 ? '#22c55e' : '#ef4444' }}>${dailyPnl.total.toFixed(2)}</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Real: ${dailyPnl.realized.toFixed(2)} | Unreal: ${dailyPnl.unrealized.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Kill Switch Controls */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          data-testid="kill-reason-input"
          value={killReason}
          onChange={e => setKillReason(e.target.value)}
          placeholder="Kill switch reason..."
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, flex: 1 }}
        />
        <button
          data-testid="kill-activate-btn"
          onClick={() => { brokerStore.activateKillSwitch(killReason || 'Manual activation'); setKillReason(''); }}
          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          Activate Kill Switch
        </button>
        <button
          data-testid="kill-deactivate-btn"
          onClick={() => brokerStore.deactivateKillSwitch()}
          style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          Deactivate
        </button>
      </div>

      {/* Positions */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Positions ({positions.length})</h2>
      {positions.length > 0 ? (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {positions.map((p, i) => (
            <div key={i} data-testid={`position-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Symbol</span><div style={{ fontWeight: 700 }}>{p.symbol}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Qty</span><div>{p.quantity}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Mkt Value</span><div>${p.market_value.toFixed(2)}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Unrealized</span><div style={{ color: p.unrealized_pnl >= 0 ? '#22c55e' : '#ef4444' }}>${p.unrealized_pnl.toFixed(2)}</div></div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: '#94a3b8', marginBottom: 24 }}>No open positions</p>}

      {/* Orders */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Recent Orders ({orders.length})</h2>
      {orders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.slice(0, 20).map((o, i) => (
            <div key={i} data-testid={`order-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8 }}>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Symbol</span><div style={{ fontWeight: 600 }}>{o.symbol}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Side</span><div style={{ color: o.side === 'buy' ? '#22c55e' : '#ef4444', textTransform: 'uppercase' }}>{o.side}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Qty</span><div>{o.quantity}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Status</span><div>{o.status}</div></div>
              <div><span style={{ color: '#94a3b8', fontSize: 12 }}>ID</span><div style={{ fontSize: 11, color: '#64748b' }}>{o.order_id.slice(0, 8)}</div></div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: '#94a3b8' }}>No orders yet</p>}
    </div>
  );
}
