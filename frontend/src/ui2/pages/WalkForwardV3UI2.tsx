import React, { useState } from 'react';

const API = 'http://localhost:8090/api/v3/walkforward';

interface Fold {
  fold_idx: number;
  train_start: number;
  train_end: number;
  test_start: number;
  test_end: number;
  train_return: number;
  test_return: number;
  purge_bars: number;
}

interface WalkResult {
  config_id: string;
  strategy: string;
  n_folds: number;
  purge_bars: number;
  folds: Fold[];
  avg_train_return: number;
  avg_test_return: number;
}

interface RobRow {
  slippage: number;
  spread: number;
  delay_bars: number;
  liquidity_cap: number;
  base_return: number;
  adj_return: number;
  delta: number;
}

interface RobResult { config_id: string; base_return: number; matrix: RobRow[]; count: number }

interface HeatmapRow { slippage: number; returns_by_spread: Record<string, number> }
interface HeatmapData { slippage_levels: number[]; spread_levels: number[]; heatmap: HeatmapRow[] }

export function WalkForwardV3UI2() {
  const [nFolds, setNFolds] = useState(4);
  const [purge, setPurge] = useState(2);
  const [walkResult, setWalkResult] = useState<WalkResult | null>(null);
  const [robResult, setRobResult] = useState<RobResult | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'folds' | 'robustness' | 'heatmap'>('folds');

  const runWalk = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n_folds: nFolds, purge_bars: purge }),
      });
      if (!r.ok) { setError((await r.json()).detail); return; }
      setWalkResult(await r.json());
      setTab('folds');
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const runRobustness = async () => {
    setLoading(true); setError(null);
    try {
      const cid = walkResult?.config_id || 'standalone';
      const r = await fetch(`${API}/robustness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: cid }),
      });
      if (!r.ok) { setError((await r.json()).detail); return; }
      setRobResult(await r.json());
      setTab('robustness');
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const loadHeatmap = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/heatmap`);
      setHeatmap(await r.json());
      setTab('heatmap');
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const color = (v: number) => v >= 0 ? '#4f4' : '#f44';

  return (
    <div data-testid="walkforward-v3-page" style={{ padding: 24, fontFamily: 'monospace', maxWidth: 1100 }}>
      <h2>W98 — Walk-Forward + Robustness v3</h2>
      {error && <p style={{ color: '#f55' }} data-testid="page-error">{error}</p>}

      {/* Controls */}
      <div data-testid="walkforward-controls" style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          Folds
          <input
            type="number" min={2} max={10}
            value={nFolds}
            onChange={e => setNFolds(Number(e.target.value))}
            data-testid="n-folds-input"
            style={{ marginLeft: 8, width: 60, background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 6px' }}
          />
        </label>
        <label>
          Purge Bars
          <input
            type="number" min={0} max={10}
            value={purge}
            onChange={e => setPurge(Number(e.target.value))}
            data-testid="purge-bars-input"
            style={{ marginLeft: 8, width: 60, background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 6px' }}
          />
        </label>
        <button data-testid="run-walkforward-btn" onClick={runWalk} disabled={loading}
          style={{ padding: '8px 18px', background: '#1e6fd4', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading && tab === 'folds' ? 'Running…' : 'Run Walk-Forward'}
        </button>
        <button data-testid="run-robustness-btn" onClick={runRobustness} disabled={loading}
          style={{ padding: '8px 18px', background: '#6b2fd4', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}>
          Run Robustness
        </button>
        <button data-testid="load-heatmap-btn" onClick={loadHeatmap} disabled={loading}
          style={{ padding: '8px 18px', background: '#2f8a2f', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}>
          Load Heatmap
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['folds', 'robustness', 'heatmap'] as const).map(t => (
          <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', border: '1px solid #444', borderRadius: 4,
              background: tab === t ? '#1e6fd4' : '#222', color: '#eee', cursor: 'pointer',
            }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Folds Tab */}
      {tab === 'folds' && walkResult && (
        <section data-testid="folds-panel">
          <h3>Walk-Forward Folds ({walkResult.n_folds} folds, purge={walkResult.purge_bars})</h3>
          <p>Avg Train Return: <strong style={{ color: color(walkResult.avg_train_return) }}>{pct(walkResult.avg_train_return)}</strong>
            {' · '} Avg Test Return: <strong data-testid="avg-test-return" style={{ color: color(walkResult.avg_test_return) }}>{pct(walkResult.avg_test_return)}</strong>
          </p>
          <table data-testid="folds-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Fold', 'Train [start→end]', 'Purge Gap', 'Test [start→end]', 'Train Return', 'Test Return'].map(h => (
                  <th key={h} style={{ border: '1px solid #444', padding: '5px 10px', background: '#222' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {walkResult.folds.map(f => (
                <tr key={f.fold_idx} data-testid={`fold-row-${f.fold_idx}`}>
                  <td style={{ border: '1px solid #333', padding: '4px 10px', textAlign: 'center' }}>{f.fold_idx}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 10px' }}>{f.train_start}→{f.train_end}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 10px', textAlign: 'center' }}>{f.purge_bars} bars</td>
                  <td style={{ border: '1px solid #333', padding: '4px 10px' }}>{f.test_start}→{f.test_end}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 10px', color: color(f.train_return) }}>{pct(f.train_return)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 10px', color: color(f.test_return) }}>{pct(f.test_return)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'folds' && !walkResult && (
        <p data-testid="folds-empty-state">No walk-forward results yet. Click Run Walk-Forward.</p>
      )}

      {/* Robustness Tab */}
      {tab === 'robustness' && robResult && (
        <section data-testid="robustness-panel">
          <h3>Robustness Matrix ({robResult.count} scenarios)</h3>
          <p>Base Return: <strong style={{ color: color(robResult.base_return) }}>{pct(robResult.base_return)}</strong></p>
          <table data-testid="robustness-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Slippage', 'Spread', 'Delay', 'Liq Cap', 'Adj Return', 'Delta'].map(h => (
                  <th key={h} style={{ border: '1px solid #444', padding: '4px 8px', background: '#222' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {robResult.matrix.map((row, i) => (
                <tr key={i} data-testid={`robustness-row-${i}`}>
                  <td style={{ border: '1px solid #333', padding: '3px 8px' }}>{row.slippage}</td>
                  <td style={{ border: '1px solid #333', padding: '3px 8px' }}>{row.spread}</td>
                  <td style={{ border: '1px solid #333', padding: '3px 8px' }}>{row.delay_bars}</td>
                  <td style={{ border: '1px solid #333', padding: '3px 8px' }}>{row.liquidity_cap}</td>
                  <td style={{ border: '1px solid #333', padding: '3px 8px', color: color(row.adj_return) }}>{pct(row.adj_return)}</td>
                  <td style={{ border: '1px solid #333', padding: '3px 8px', color: color(row.delta) }}>{pct(row.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'robustness' && !robResult && (
        <p data-testid="robustness-empty-state">No robustness results yet. Click Run Robustness.</p>
      )}

      {/* Heatmap Tab */}
      {tab === 'heatmap' && heatmap && (
        <section data-testid="heatmap-panel">
          <h3>Sensitivity Heatmap (Slippage × Spread)</h3>
          <table data-testid="heatmap-table" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #444', padding: '5px 12px', background: '#222' }}>Slippage \ Spread</th>
                {heatmap.spread_levels.map(s => (
                  <th key={s} style={{ border: '1px solid #444', padding: '5px 12px', background: '#222' }}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.heatmap.map(row => (
                <tr key={row.slippage} data-testid={`heatmap-row-${row.slippage}`}>
                  <td style={{ border: '1px solid #333', padding: '4px 12px', fontWeight: 'bold' }}>{row.slippage}</td>
                  {heatmap.spread_levels.map(s => {
                    const val = row.returns_by_spread[String(s)] ?? 0;
                    const intensity = Math.min(Math.abs(val) * 500, 80);
                    const bg = val >= 0 ? `rgba(0,200,0,${intensity / 100})` : `rgba(200,0,0,${intensity / 100})`;
                    return (
                      <td key={s} data-testid={`heatmap-cell-${row.slippage}-${s}`}
                        style={{ border: '1px solid #333', padding: '4px 12px', background: bg, textAlign: 'center', color: '#eee' }}>
                        {pct(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'heatmap' && !heatmap && (
        <p data-testid="heatmap-empty-state">No heatmap data. Click Load Heatmap.</p>
      )}
    </div>
  );
}
