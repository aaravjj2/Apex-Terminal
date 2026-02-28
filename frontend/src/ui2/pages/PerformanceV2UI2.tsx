import { useSyncExternalStore, useEffect } from 'react';
import { performanceV2Store } from '../stores/waves11_20Store';

function usePerformanceV2() {
  return useSyncExternalStore(performanceV2Store.subscribe, performanceV2Store.getState);
}

export function PerformanceV2UI2() {
  const { strategies, leaderboard, disableEvents, loading, error } = usePerformanceV2();

  useEffect(() => {
    performanceV2Store.fetchAll();
  }, []);

  return (
    <div data-testid="performance-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Performance Ledger (v2)</h1>
      {loading && <p>Loading metrics...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Leaderboard */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Strategy Leaderboard</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {leaderboard.map((s, i) => (
          <div key={i} data-testid={`lb-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32' }}>#{s.rank}</div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Strategy</span><div style={{ fontWeight: 600 }}>{s.strategy_id}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Sharpe</span><div>{s.sharpe.toFixed(2)}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Win Rate</span><div>{(s.win_rate * 100).toFixed(1)}%</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>P&L</span><div style={{ color: s.total_pnl >= 0 ? '#22c55e' : '#ef4444' }}>${s.total_pnl.toFixed(2)}</div></div>
          </div>
        ))}
        {leaderboard.length === 0 && <p style={{ color: '#94a3b8' }}>No strategies ranked yet</p>}
      </div>

      {/* Strategy Metrics */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Strategy Metrics</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
        {strategies.map((s, i) => (
          <div key={i} data-testid={`strat-${i}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{s.strategy_id}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
              <div><span style={{ color: '#94a3b8' }}>Sharpe: </span>{s.sharpe_proxy.toFixed(2)}</div>
              <div><span style={{ color: '#94a3b8' }}>Win Rate: </span>{(s.win_rate * 100).toFixed(1)}%</div>
              <div><span style={{ color: '#94a3b8' }}>P&L: </span><span style={{ color: s.total_pnl >= 0 ? '#22c55e' : '#ef4444' }}>${s.total_pnl.toFixed(2)}</span></div>
              <div><span style={{ color: '#94a3b8' }}>Trades: </span>{s.trade_count}</div>
              <div><span style={{ color: '#94a3b8' }}>Role: </span><span style={{ textTransform: 'uppercase', color: s.role === 'champion' ? '#fbbf24' : '#94a3b8' }}>{s.role}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-Disable Events */}
      {disableEvents.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Auto-Disable Events</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {disableEvents.map((e, i) => (
              <div key={i} data-testid={`disable-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', borderLeft: '4px solid #ef4444' }}>
                <span style={{ fontWeight: 600 }}>{e.strategy_id}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>{e.rule_name} — {e.triggered_at}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
