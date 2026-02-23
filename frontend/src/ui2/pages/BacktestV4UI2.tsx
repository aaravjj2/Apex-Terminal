import { useSyncExternalStore, useState } from 'react';
import { backtestV4Store } from '../stores/waves21_50Store';

function useBacktestV4() {
  return useSyncExternalStore(backtestV4Store.subscribe, backtestV4Store.getState);
}

export function BacktestV4UI2() {
  const { result, loading, error } = useBacktestV4();
  const [symbols, setSymbols] = useState('AAPL');
  const [capital, setCapital] = useState('100000');
  const [costModel, setCostModel] = useState('realistic');

  const handleRun = () => {
    backtestV4Store.runBacktest({
      symbols: symbols.split(',').map(s => s.trim().toUpperCase()),
      initial_capital: Number(capital),
      cost_model: costModel,
    });
  };

  return (
    <div data-testid="backtest-v4-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Backtest Engine v4 — Waves 27-33</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input data-testid="bt4-symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="Symbols (comma-sep)" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 180 }} />
        <input data-testid="bt4-capital" value={capital} onChange={e => setCapital(e.target.value)} placeholder="Capital" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 120 }} />
        <select data-testid="bt4-cost-model" value={costModel} onChange={e => setCostModel(e.target.value)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0' }}>
          <option value="realistic">Realistic</option>
          <option value="zero">Zero</option>
          <option value="ibkr_fixed">IBKR Fixed</option>
          <option value="ibkr_tiered">IBKR Tiered</option>
          <option value="robinhood">Robinhood</option>
          <option value="schwab">Schwab</option>
        </select>
        <button data-testid="bt4-run-btn" onClick={handleRun} disabled={loading} style={{ background: loading ? '#64748b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {result && (
        <div data-testid="bt4-result" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Sharpe', value: (result.metrics?.sharpe ?? 0).toFixed(2), color: '#e2e8f0' },
            { label: 'Max Drawdown', value: `${((result.metrics?.max_drawdown ?? 0) * 100).toFixed(2)}%`, color: '#ef4444' },
            { label: 'Total Return', value: `${((result.metrics?.total_return ?? 0) * 100).toFixed(2)}%`, color: (result.metrics?.total_return ?? 0) >= 0 ? '#22c55e' : '#ef4444' },
            { label: 'Win Rate', value: `${((result.metrics?.win_rate ?? 0) * 100).toFixed(1)}%`, color: '#e2e8f0' },
            { label: 'Trade Count', value: result.metrics?.trade_count ?? 0, color: '#e2e8f0' },
            { label: 'Profit Factor', value: (result.metrics?.profit_factor ?? 0).toFixed(2), color: '#e2e8f0' },
          ].map(m => (
            <div key={m.label} data-testid={`bt4-${m.label.toLowerCase().replace(/\s/g, '-')}`} style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
