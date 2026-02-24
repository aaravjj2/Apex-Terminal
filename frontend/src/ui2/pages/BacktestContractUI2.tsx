import React, { useState, useEffect } from 'react';

const API = '/api/v3/backtest-contract';

interface GoldenRun {
  id: string;
  name: string;
  strategy_type: string;
  description: string;
  expected_total_return: number;
  expected_trade_count: number;
  expected_final_equity: number;
}

interface ComparisonField {
  actual: number;
  expected: number;
  within_tolerance: boolean;
}

interface ExecuteResult {
  run_id: string;
  golden_id: string;
  strategy_type: string;
  invariant_ok: boolean;
  invariant_errors: string[];
  metrics: { total_return: number; trade_count: number; sharpe: number; final_equity: number };
  comparison: { total_return: ComparisonField; trade_count: ComparisonField; final_equity: ComparisonField };
  all_pass: boolean;
  status: string;
}

interface Invariant {
  id: string;
  name: string;
  description: string;
  enforced: boolean;
}

interface Run {
  id: string;
  golden_id: string;
  strategy_type: string;
  status: string;
  total_return: number;
  trade_count: number;
  sharpe: number;
  final_equity: number;
  invariant_ok: boolean;
  created_at: string;
}

export function BacktestContractUI2() {
  const [goldenRuns, setGoldenRuns] = useState<GoldenRun[]>([]);
  const [invariants, setInvariants] = useState<Invariant[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const loadAll = async () => {
    try {
      const [gr, inv, rs] = await Promise.all([
        fetch(`${API}/golden-runs`).then(r => r.json()),
        fetch(`${API}/invariants`).then(r => r.json()),
        fetch(`${API}/runs`).then(r => r.json()),
      ]);
      setGoldenRuns(gr.golden_runs ?? []);
      setInvariants(inv.invariants ?? []);
      setRuns(rs.runs ?? []);
      setStatus(`Loaded ${(gr.golden_runs ?? []).length} golden runs`);
    } catch (e: any) {
      setError(String(e));
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleExecute = async (goldenId: string) => {
    setExecuting(goldenId);
    setLastResult(null);
    setError(null);
    try {
      const r = await fetch(`${API}/golden-runs/${goldenId}/execute`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json();
        setError(err.detail || 'Execute failed');
        return;
      }
      const result: ExecuteResult = await r.json();
      setLastResult(result);
      await loadAll();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div data-testid="backtest-contract-page" style={{ padding: '24px', fontFamily: 'monospace', maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 8 }}>W97 — Backtesting Correctness Contract</h2>
      {status && <p style={{ color: '#aaa', marginBottom: 16 }} data-testid="page-status">{status}</p>}
      {error && <p style={{ color: '#f55', marginBottom: 8 }} data-testid="page-error">{error}</p>}

      {/* Invariants */}
      <section data-testid="invariants-panel" style={{ marginBottom: 28 }}>
        <h3>Invariants</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['ID', 'Name', 'Description', 'Enforced'].map(h => (
                <th key={h} style={{ border: '1px solid #444', padding: '6px 10px', textAlign: 'left', background: '#222' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invariants.map(inv => (
              <tr key={inv.id} data-testid={`invariant-row-${inv.id}`}>
                <td style={{ border: '1px solid #333', padding: '5px 10px' }}>{inv.id}</td>
                <td style={{ border: '1px solid #333', padding: '5px 10px' }}>{inv.name}</td>
                <td style={{ border: '1px solid #333', padding: '5px 10px' }}>{inv.description}</td>
                <td style={{ border: '1px solid #333', padding: '5px 10px', color: inv.enforced ? '#4f4' : '#f44' }}>
                  {inv.enforced ? 'YES' : 'NO'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Golden Runs */}
      <section style={{ marginBottom: 28 }}>
        <h3>Golden Runs</h3>
        <div data-testid="golden-runs-list">
          {goldenRuns.length === 0 && (
            <p data-testid="golden-runs-empty">No golden runs found</p>
          )}
          {goldenRuns.map(g => (
            <div
              key={g.id}
              data-testid={`golden-run-row-${g.id}`}
              style={{
                border: '1px solid #444',
                borderRadius: 6,
                padding: 14,
                marginBottom: 10,
                background: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1 }}>
                <strong data-testid={`golden-run-name-${g.id}`}>{g.name}</strong>
                <span style={{ marginLeft: 10, color: '#888', fontSize: 12 }}>{g.strategy_type}</span>
                <p style={{ margin: '4px 0 0', color: '#aaa', fontSize: 12 }}>{g.description}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Expected return: <strong>{(g.expected_total_return * 100).toFixed(1)}%</strong>
                  {' · '} Trades: <strong>{g.expected_trade_count}</strong>
                  {' · '} Final equity: <strong>${g.expected_final_equity.toLocaleString()}</strong>
                </p>
              </div>
              <button
                data-testid={`execute-golden-btn-${g.id}`}
                onClick={() => handleExecute(g.id)}
                disabled={!!executing}
                style={{
                  padding: '8px 18px',
                  background: executing === g.id ? '#555' : '#1e6fd4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: executing ? 'not-allowed' : 'pointer',
                }}
              >
                {executing === g.id ? 'Running…' : 'Execute'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Last Result */}
      {lastResult && (
        <section data-testid="validation-result-panel" style={{ marginBottom: 28 }}>
          <h3>Last Execution Result</h3>
          <div style={{ border: '1px solid #444', borderRadius: 6, padding: 16, background: '#0f1923' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <span
                data-testid="validation-status-badge"
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontWeight: 'bold',
                  background: lastResult.all_pass ? '#1a4a1a' : '#4a1a1a',
                  color: lastResult.all_pass ? '#4f4' : '#f44',
                  border: `1px solid ${lastResult.all_pass ? '#2a6a2a' : '#6a2a2a'}`,
                }}
              >
                {lastResult.status.toUpperCase()}
              </span>
              <span
                data-testid="invariant-status-badge"
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: lastResult.invariant_ok ? '#1a3a4a' : '#4a2a1a',
                  color: lastResult.invariant_ok ? '#4af' : '#fa4',
                  border: `1px solid ${lastResult.invariant_ok ? '#2a5a6a' : '#6a4a2a'}`,
                }}
              >
                {lastResult.invariant_ok ? 'INVARIANTS OK' : 'INVARIANT VIOLATION'}
              </span>
            </div>

            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}>
              <thead>
                <tr>
                  {['Metric', 'Actual', 'Expected', 'Within Tolerance'].map(h => (
                    <th key={h} style={{ border: '1px solid #444', padding: '5px 8px', background: '#222', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(lastResult.comparison).map(([key, v]) => (
                  <tr key={key} data-testid={`comparison-row-${key}`}>
                    <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{key}</td>
                    <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{typeof v.actual === 'number' ? v.actual.toFixed(4) : v.actual}</td>
                    <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{typeof v.expected === 'number' ? v.expected.toFixed(4) : v.expected}</td>
                    <td style={{ border: '1px solid #333', padding: '4px 8px', color: v.within_tolerance ? '#4f4' : '#f44' }}>
                      {v.within_tolerance ? '✓' : '✗'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lastResult.invariant_errors.length > 0 && (
              <div data-testid="violation-list">
                <strong>Invariant Violations:</strong>
                <ul>
                  {lastResult.invariant_errors.map((e, i) => (
                    <li key={i} style={{ color: '#fa4' }} data-testid={`violation-item-${i}`}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Runs History */}
      <section>
        <h3>Execution History ({runs.length})</h3>
        {runs.length === 0 ? (
          <p data-testid="runs-empty-state">No runs yet. Execute a golden run above.</p>
        ) : (
          <table data-testid="runs-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Run ID', 'Golden ID', 'Strategy', 'Status', 'Return', 'Trades', 'Sharpe', 'Final Equity', 'Inv OK'].map(h => (
                  <th key={h} style={{ border: '1px solid #444', padding: '5px 8px', background: '#222', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} data-testid={`run-row-${r.id}`}>
                  <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 11 }}>{r.id.slice(0, 8)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 11 }}>{r.golden_id}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{r.strategy_type}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px', color: r.status === 'passed' ? '#4f4' : '#f44', fontWeight: 'bold' }}>{r.status}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{((r.total_return ?? 0) * 100).toFixed(2)}%</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{r.trade_count}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{(r.sharpe ?? 0).toFixed(3)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px' }}>${(r.final_equity ?? 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 8px', color: r.invariant_ok ? '#4f4' : '#f44' }}>{r.invariant_ok ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
