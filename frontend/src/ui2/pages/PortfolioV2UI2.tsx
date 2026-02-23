import { useSyncExternalStore, useEffect, useState } from 'react';
import { portfolioV2Store } from '../stores/waves11_20Store';

function usePortfolioV2() {
  return useSyncExternalStore(portfolioV2Store.subscribe, portfolioV2Store.getState);
}

export function PortfolioV2UI2() {
  const { allocation, exposure, loading, error } = usePortfolioV2();
  const [capital, setCapital] = useState('100000');
  const [method, setMethod] = useState('equal_weight');
  const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

  useEffect(() => {
    portfolioV2Store.fetchExposure();
  }, []);

  const handleAllocate = () => {
    portfolioV2Store.fetchAllocation(defaultSymbols, Number(capital), method);
  };

  return (
    <div data-testid="portfolio-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Portfolio Allocator (v2)</h1>
      {loading && <p>Computing allocation...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          data-testid="pv2-capital"
          value={capital}
          onChange={e => setCapital(e.target.value)}
          placeholder="Capital ($)"
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, width: 140 }}
        />
        <select
          data-testid="pv2-method"
          value={method}
          onChange={e => setMethod(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14 }}
        >
          <option value="equal_weight">Equal Weight</option>
          <option value="inverse_vol">Inverse Volatility</option>
        </select>
        <button
          data-testid="pv2-allocate-btn"
          onClick={handleAllocate}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          Allocate
        </button>
      </div>

      {allocation && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Allocation — {allocation.method}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Object.entries(allocation.allocations).map(([sym, alloc]: [string, any]) => (
              <div key={sym} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{sym}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  Weight: {((alloc.weight || 0) * 100).toFixed(1)}%
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  Capital: ${(alloc.capital || 0).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {exposure && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Exposure Dashboard</h2>
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Total Exposure</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{(exposure.total_exposure * 100).toFixed(1)}%</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {Object.entries(exposure.sector_exposure).map(([sector, pct]) => (
              <div key={sector} style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{sector}</div>
                <div style={{ fontWeight: 600 }}>{(pct * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
