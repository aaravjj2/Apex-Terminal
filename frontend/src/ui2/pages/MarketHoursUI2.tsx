import { useSyncExternalStore, useEffect } from 'react';
import { marketHoursStore } from '../stores/waveStores';

function useMarketHours() {
  return useSyncExternalStore(marketHoursStore.subscribe, marketHoursStore.getState);
}

export function MarketHoursUI2() {
  const { session, holidays, canTrade, loading, error } = useMarketHours();

  useEffect(() => {
    marketHoursStore.fetchAll();
  }, []);

  return (
    <div data-testid="market-hours-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Market Hours</h1>
      {loading && <p>Loading market data...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div data-testid="mh-can-trade" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${canTrade ? '#22c55e' : '#ef4444'}` }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Trading Status</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: canTrade ? '#22c55e' : '#ef4444' }}>
            {canTrade === null ? 'Loading...' : (canTrade ? 'Markets Open' : 'Markets Closed')}
          </div>
        </div>
        {session && (
          <>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Session</div>
              <div style={{ fontSize: 18, fontWeight: 600, textTransform: 'uppercase' }}>{(session as any).session}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Timezone</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{(session as any).timezone}</div>
            </div>
            {(session as any).next_open && (
              <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Next Open</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{(session as any).next_open}</div>
              </div>
            )}
          </>
        )}
      </div>
      {holidays.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Upcoming Holidays</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {holidays.slice(0, 8).map((h: any, i: number) => (
              <div key={i} data-testid={`holiday-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{h.name}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
                  <span>{h.date}</span>
                  <span style={{ textTransform: 'capitalize' }}>{h.type?.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
