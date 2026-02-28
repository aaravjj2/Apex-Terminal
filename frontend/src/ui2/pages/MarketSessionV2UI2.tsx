import { useSyncExternalStore, useEffect } from 'react';
import { marketSessionStore } from '../stores/waves11_20Store';

function useMarketSession() {
  return useSyncExternalStore(marketSessionStore.subscribe, marketSessionStore.getState);
}

export function MarketSessionV2UI2() {
  const { session, holidays, loading, error } = useMarketSession();

  useEffect(() => {
    marketSessionStore.fetchStatus();
    marketSessionStore.fetchHolidays();
  }, []);

  return (
    <div data-testid="market-session-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Market Session (v2)</h1>
      {loading && <p>Loading session data...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {session && (
          <>
            <div data-testid="ms-session-type" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${session.is_trading ? '#22c55e' : '#ef4444'}` }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Session Type</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: session.is_trading ? '#22c55e' : '#ef4444', textTransform: 'uppercase' }}>{session.session_type}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Market Open</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{session.market_open}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Market Close</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{session.market_close}</div>
            </div>
            {session.next_open && (
              <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Next Open</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{session.next_open}</div>
              </div>
            )}
          </>
        )}
      </div>

      {holidays.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Market Holidays</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {holidays.map((h, i) => (
              <div key={i} data-testid={`ms-holiday-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{h.name}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
                  <span>{h.date}</span>
                  {h.early_close && <span style={{ color: '#f59e0b' }}>Early Close</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
