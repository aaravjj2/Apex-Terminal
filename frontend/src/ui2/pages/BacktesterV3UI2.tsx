import { useSyncExternalStore, useState } from 'react';
import { backtesterV3Store } from '../stores/waves11_20Store';

function useBacktesterV3() {
  return useSyncExternalStore(backtesterV3Store.subscribe, backtesterV3Store.getState);
}

export function BacktesterV3UI2() {
  const { result, loading, error } = useBacktesterV3();
  const [symbol, setSymbol] = useState('AAPL');
  const [fast, setFast] = useState('10');
  const [slow, setSlow] = useState('30');
  const [capital, setCapital] = useState('100000');

  const handleRun = () => {
    backtesterV3Store.runBacktest({
      symbol: symbol.toUpperCase(),
      fast_period: Number(fast),
      slow_period: Number(slow),
      initial_capital: Number(capital),
    });
  };

  return (
    <div data-testid="backtester-v3-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Backtester v3</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input data-testid="bt3-symbol" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 100 }} />
        <input data-testid="bt3-fast" value={fast} onChange={e => setFast(e.target.value)} placeholder="Fast MA" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 80 }} />
        <input data-testid="bt3-slow" value={slow} onChange={e => setSlow(e.target.value)} placeholder="Slow MA" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 80 }} />
        <input data-testid="bt3-capital" value={capital} onChange={e => setCapital(e.target.value)} placeholder="Capital" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 120 }} />
        <button data-testid="bt3-run-btn" onClick={handleRun} disabled={loading} style={{ background: loading ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Return', value: `${((result.total_return || 0) * 100).toFixed(2)}%`, color: (result.total_return || 0) >= 0 ? '#22c55e' : '#ef4444' },
            { label: 'Sharpe Ratio', value: (result.sharpe_ratio || 0).toFixed(2), color: '#e2e8f0' },
            { label: 'Max Drawdown', value: `${((result.max_drawdown || 0) * 100).toFixed(2)}%`, color: '#ef4444' },
            { label: 'Win Rate', value: `${((result.win_rate || 0) * 100).toFixed(1)}%`, color: '#e2e8f0' },
            { label: 'Total Trades', value: result.total_trades || 0, color: '#e2e8f0' },
            { label: 'Profit Factor', value: (result.profit_factor || 0).toFixed(2), color: '#e2e8f0' },
            { label: 'Final Equity', value: `$${(result.final_equity || 0).toLocaleString()}`, color: '#e2e8f0' },
          ].map(m => (
            <div key={m.label} data-testid={`bt3-${m.label.toLowerCase().replace(/\s/g, '-')}`} style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
