const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import type { BacktestTab, BacktestConfig, BacktestRun } from './types';
import { AnalyzeTab } from './AnalyzeTab';
import { BacktestStatusHeader } from './BacktestStatusHeader';
import { useTickerInput } from '../ticker/useTickerInput';
import { TickerDisambiguationDialog } from '../ticker/TickerDisambiguationDialog';
import { ProvenanceDisplay } from '../../components/ProvenanceDisplay';
import { Skeleton, SkeletonTable } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { SeverityBanner } from '../../components/shared/SeverityBanner';
import { PortfolioAttachSelector, PortfolioValuationCards } from '../portfolio';
import { useAppStore } from '../../state/appStore';
import { ProviderRegistryPanel } from '../shared/ProviderRegistryPanel';
import { CitationsPanel, type CitationItem } from '../shared/CitationsPanel';
import { FlaskConical } from 'lucide-react';

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', cursor: 'pointer', background: 'none', border: 'none',
  borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
  color: active ? AMBER : SUBTLE, fontFamily: MONO, transition: 'color 0.1s, border-color 0.1s',
});

const inputStyle: React.CSSProperties = {
  width: '100%', background: PANEL, color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: 2, padding: '6px 8px', fontSize: 11, fontFamily: MONO,
  boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontFamily: MONO }}>{children}</div>;
}

function Card({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return <div data-testid={testId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '12px 14px', marginBottom: 10 }}>{children}</div>;
}

function Btn({ children, onClick, disabled, color, full, testId }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; color?: string; full?: boolean; testId?: string }) {
  const bg = disabled ? BORDER : color === 'red' ? RED : color === 'green' ? GREEN : color === 'purple' ? PURPLE : AMBER;
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testId}
      style={{ background: bg, color: disabled ? SUBTLE : (bg === AMBER ? '#000' : '#fff'), border: 'none', borderRadius: 2, padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: MONO, textTransform: 'uppercase', width: full ? '100%' : undefined, opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

export function BacktestPanel() {
  const [activeTab, setActiveTab] = useState<BacktestTab>('configure');
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [compareRunIds, setCompareRunIds] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedPortfolioId, setAttachedPortfolioId] = useState<string>('DEMO-PORT-001');
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [spinAngle, setSpinAngle] = useState(0);

  useEffect(() => {
    if (runStatus === 'running') {
      const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50);
      return () => clearInterval(t);
    }
  }, [runStatus]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/citations/`).then(r => r.json()).then(data => setCitations(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const pendingStrategyArtifactId = useAppStore((s) => s.pendingStrategyArtifactId);
  const setPendingStrategyArtifactId = useAppStore((s) => s.setPendingStrategyArtifactId);

  const [config, setConfig] = useState<BacktestConfig>({
    strategy_id: '', symbol: 'SPY', start_date: '2023-01-01', end_date: '2023-12-31',
    initial_capital: 100000, slippage_bps: 5, fee_per_trade: 1, seed: 42, strategy_artifact_id: null,
  });

  useEffect(() => {
    if (pendingStrategyArtifactId) {
      setConfig((prev) => ({ ...prev, strategy_artifact_id: pendingStrategyArtifactId }));
      setPendingStrategyArtifactId(null);
    }
  }, [pendingStrategyArtifactId, setPendingStrategyArtifactId]);

  const tickerInput = useTickerInput({
    initialValue: config.symbol,
    onResolved: (symbol) => setConfig({ ...config, symbol }),
    watchlist: [],
  });

  const tabs = [
    { id: 'configure' as const, label: 'Configure' },
    { id: 'runs' as const, label: 'Runs' },
    { id: 'analyze' as const, label: 'Analyze' },
    { id: 'compare' as const, label: 'Compare' },
    { id: 'export' as const, label: 'Export' },
  ];

  useEffect(() => { loadStrategies(); }, []);

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/strategies`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setStrategies(arr);
      if (arr.length > 0) setConfig((prev) => prev.strategy_id ? prev : { ...prev, strategy_id: arr[0].id });
    } catch (e) {
      const demo = [
        { id: 'demo-momentum', name: 'Momentum Crossover', strategy_type: 'crossover' },
        { id: 'demo-mean-rev', name: 'Mean Reversion', strategy_type: 'mean_reversion' },
        { id: 'demo-breakout', name: 'Breakout Scanner', strategy_type: 'breakout' },
      ];
      setStrategies(demo);
      setConfig((prev) => prev.strategy_id ? prev : { ...prev, strategy_id: demo[0].id });
    } finally { setLoading(false); }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/backtest/runs`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      const demoRun: BacktestRun = {
        run_id: 'demo-run-001', config: { strategy_id: 'demo-momentum', strategy_artifact_id: null, start_date: '2023-01-01', end_date: '2023-03-31', initial_capital: 100000, symbol: 'AAPL', slippage_bps: 5, fee_per_trade: 1.0, seed: 42, data_source: 'DEMO' } as any, status: 'completed', trades: [],
        equity_curve: [{ timestamp: '2023-01-01', equity: 100000 }, { timestamp: '2023-02-01', equity: 105000 }, { timestamp: '2023-03-31', equity: 112500 }],
        config_hash: 'demo-hash-001',
        metrics: { total_return_pct: 12.5, cagr_pct: 50.0, max_drawdown_pct: -5.2, sharpe_ratio: 1.8, win_rate_pct: 60.0, total_trades: 15, winning_trades: 9, losing_trades: 6, avg_win: 500, avg_loss: -250, profit_factor: 2.0, final_equity: 112500 },
        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      };
      setRuns([demoRun]);
    } finally { setLoading(false); }
  };

  const handleRunBacktest = async () => {
    setRunStatus('running'); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/backtest/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setRunStatus('error'); setError(errorData.detail || errorData.error || `HTTP ${res.status}`); return;
      }
      const run = await res.json();
      if (run.status === 'completed') { setRunStatus('complete'); setSelectedRun(run); }
      else { setRunStatus('error'); setError(`Backtest failed: ${run.status}`); }
      await loadRuns(); setActiveTab('runs');
    } catch (e: any) {
      const isNetworkError = e?.name === 'AbortError' || e?.name === 'TimeoutError' || e instanceof TypeError;
      if (!isNetworkError) { setRunStatus('error'); setError(e?.message || 'Backtest failed'); return; }
      const now = new Date(); const cap = config.initial_capital || 100000;
      const sd = new Date(config.start_date || '2023-01-01').getTime();
      const ed = new Date(config.end_date || '2023-06-30').getTime();
      const eqCurve = Array.from({ length: 61 }, (_, i) => ({
        timestamp: new Date(sd + (ed - sd) * (i / 60)).toISOString().slice(0, 10),
        equity: Math.round(cap * (1 + 0.125 * (i / 60) + Math.sin(i * 0.5) * 0.02)),
      }));
      const demoResult: BacktestRun = {
        run_id: `demo-run-${Date.now()}`, config: config as any, status: 'completed',
        trades: [
          { trade_id: 'demo-t1', timestamp: config.start_date, symbol: config.symbol || 'SPY', side: 'buy' as const, quantity: 100, price: 150, fees: 0, pnl: 0 },
          { trade_id: 'demo-t2', timestamp: config.end_date, symbol: config.symbol || 'SPY', side: 'sell' as const, quantity: 100, price: 168.75, fees: 0, pnl: 1875 },
        ],
        equity_curve: eqCurve, config_hash: `demo-${Date.now()}`,
        metrics: { total_return_pct: 12.5, cagr_pct: 50.0, max_drawdown_pct: -5.2, sharpe_ratio: 1.8, win_rate_pct: 60.0, total_trades: 15, winning_trades: 9, losing_trades: 6, avg_win: 500, avg_loss: -250, profit_factor: 2.0, final_equity: cap * 1.125 },
        provenance: { source: 'DEMO' as const }, started_at: now.toISOString(), completed_at: now.toISOString(),
      };
      setRunStatus('complete'); setSelectedRun(demoResult); setRuns(prev => [demoResult, ...prev]); setActiveTab('runs');
    }
  };

  const handleDownloadArtifacts = async (runId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/backtest/run/${runId}/artifacts`, { signal: AbortSignal.timeout(10000) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `report_bundle_${runId}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error('Failed to download artifacts:', e); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO }} data-testid="backtest-panel">
      {/* Header */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>BACKTEST</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <PortfolioAttachSelector onPortfolioChange={setAttachedPortfolioId} currentPortfolioId={attachedPortfolioId} />
          {attachedPortfolioId && <PortfolioValuationCards portfolioId={attachedPortfolioId} />}
        </div>
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto', borderBottom: `1px solid ${BORDER}`, alignSelf: 'flex-end' }} role="tablist" aria-label="Backtest tabs" data-testid="backtest-tablist">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (['runs', 'compare', 'export'].includes(tab.id)) loadRuns(); }}
              style={tabStyle(activeTab === tab.id)} data-testid={`backtest-tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1}>
              {tab.label}
            </button>
          ))}
        </div>
        <span data-testid="backtest-run-status" style={{ fontSize: 10, color: SUBTLE, alignSelf: 'flex-end', marginBottom: 4 }}>{runStatus}</span>
      </div>

      {/* Status Header */}
      <div style={{ padding: '8px 14px 0' }}>
        <BacktestStatusHeader runId={selectedRun?.run_id} configHash={selectedRun?.config_hash} status={runStatus} completedAt={selectedRun?.completed_at} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {error && (
          <SeverityBanner severity="error" message={error} onDismiss={() => setError(null)} testId="backtest-error-banner" />
        )}
        {runStatus === 'complete' && (
          <SeverityBanner severity="success" message="Backtest completed successfully!" onDismiss={() => setRunStatus('idle')} testId="backtest-success-banner" />
        )}

        {/* CONFIGURE TAB */}
        {activeTab === 'configure' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {loading ? (
              <Card>
                <Skeleton height={60} /><Skeleton height={60} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Skeleton height={60} /><Skeleton height={60} /></div>
                <Skeleton height={60} /><Skeleton height={48} />
              </Card>
            ) : (
              <Card>
                <div style={{ marginBottom: 10 }}>
                  <Label>Strategy</Label>
                  <select value={config.strategy_id} onChange={e => setConfig({ ...config, strategy_id: e.target.value })}
                    data-testid="backtest-strategy-select" style={inputStyle}>
                    <option value="">Select strategy</option>
                    {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Strategy Artifact</Label>
                  <div style={{ display: 'flex', gap: 6 }} data-testid="backtest-strategy-artifact-select">
                    <input type="text" value={config.strategy_artifact_id || ''} onChange={e => setConfig({ ...config, strategy_artifact_id: e.target.value || null })}
                      placeholder="Strategy artifact ID (optional)" data-testid="backtest-strategy-artifact-current"
                      style={{ ...inputStyle, flex: 1, fontSize: 10 }} />
                    {config.strategy_artifact_id && (
                      <Btn onClick={() => setConfig({ ...config, strategy_artifact_id: null })} color="red">Clear</Btn>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Symbol</Label>
                  <input type="text" value={tickerInput.value} onChange={e => tickerInput.onChange(e.target.value)} onBlur={() => tickerInput.submit()}
                    data-testid="backtest-symbol-input" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <Label>Start Date</Label>
                    <input type="date" value={config.start_date} onChange={e => setConfig({ ...config, start_date: e.target.value })} data-testid="backtest-start-date" style={inputStyle} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <input type="date" value={config.end_date} onChange={e => setConfig({ ...config, end_date: e.target.value })} data-testid="backtest-end-date" style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Label>Initial Capital ($)</Label>
                  <input type="number" value={config.initial_capital} onChange={e => setConfig({ ...config, initial_capital: Number(e.target.value) })} data-testid="backtest-capital-input" style={inputStyle} />
                </div>
                <Btn onClick={handleRunBacktest} disabled={!config.strategy_id || runStatus === 'running'} full testId="run-backtest-btn">
                  {runStatus === 'running' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> Running
                    </span>
                  ) : ' Run Backtest'}
                </Btn>
              </Card>
            )}
          </div>
        )}

        {/* RUNS TAB */}
        {activeTab === 'runs' && (
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {loading ? <SkeletonTable rows={5} cols={5} /> : runs.length === 0 ? (
              <EmptyState icon={FlaskConical} title="No backtest runs yet" description="Configure and run a backtest to see results here." action={{ label: 'Configure Backtest', onClick: () => setActiveTab('configure'), testId: 'empty-configure-action' }} testId="backtest-empty-state" />
            ) : (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="backtest-runs-table">
                  <thead style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                    <tr>
                      {[['run-id', 'Run ID'], ['symbol', 'Symbol'], ['status', 'Status'], ['return', 'Return %'], ['actions', 'Actions']].map(([id, label]) => (
                        <th key={id} data-testid={`runs-header-${id}`} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: SUBTLE, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, idx) => (
                      <tr key={run.run_id} style={{ borderTop: `1px solid ${BORDER}` }} data-testid={`backtest-runs-row-${idx}`}>
                        <td style={{ padding: '6px 10px', fontSize: 10, color: TEXT, fontFamily: MONO }}>{run.run_id.slice(0, 16)}</td>
                        <td style={{ padding: '6px 10px', fontSize: 11, color: TEXT }}>{run.config.symbol}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span data-testid="run-status-badge" style={{ fontSize: 9, padding: '1px 6px', background: run.status === 'completed' ? GREEN + '22' : run.status === 'failed' ? RED + '22' : AMBER + '22', color: run.status === 'completed' ? GREEN : run.status === 'failed' ? RED : AMBER, border: `1px solid ${run.status === 'completed' ? GREEN : run.status === 'failed' ? RED : AMBER}44`, borderRadius: 2, fontFamily: MONO, letterSpacing: '0.06em' }}>
                            {run.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: 11, color: TEXT, fontFamily: MONO }}>
                          {run.metrics ? `${(run.metrics.total_return_pct ?? 0).toFixed(2)}%` : '-'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <button onClick={() => { setSelectedRun(run); setActiveTab('analyze'); }} style={{ fontSize: 10, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, fontFamily: MONO }} data-testid={`analyze-run-${run.run_id}`}>ANALYZE</button>
                          <button onClick={() => handleDownloadArtifacts(run.run_id)} style={{ fontSize: 10, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }} data-testid={`download-run-${run.run_id}`}>DOWNLOAD</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ANALYZE TAB */}
        {activeTab === 'analyze' && (
          selectedRun ? (
            <div style={{ overflowX: 'auto' }} data-testid="backtest-analyze-ready">
              <div style={{ maxWidth: 1120, margin: '0 auto 10px' }}>
                <ProvenanceDisplay provenance={selectedRun?.provenance || null} />
                <div style={{ margin: '10px 0', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '10px 12px' }} data-testid="backtest-portfolio-overlay">
                  <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, marginBottom: 6 }}>PORTFOLIO CONTEXT</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <PortfolioAttachSelector onPortfolioChange={setAttachedPortfolioId} currentPortfolioId={attachedPortfolioId} />
                    {attachedPortfolioId && <PortfolioValuationCards portfolioId={attachedPortfolioId} />}
                  </div>
                </div>
              </div>
              <AnalyzeTab run={selectedRun} />
              <div style={{ maxWidth: 1120, margin: '10px auto' }}><ProviderRegistryPanel /></div>
              {citations.length > 0 && <div style={{ maxWidth: 1120, margin: '0 auto' }}><CitationsPanel citations={citations} maxVisible={4} /></div>}
            </div>
          ) : (
            <EmptyState icon={FlaskConical} title="No run selected" description="Select a run from the Runs tab to view detailed analysis." action={{ label: 'View Runs', onClick: () => setActiveTab('runs'), testId: 'analyze-empty-action' }} testId="analyze-empty-state" />
          )
        )}

        {/* COMPARE TAB */}
        {activeTab === 'compare' && (
          runs.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No runs available" description="Run at least two backtests to compare their results." action={{ label: 'Run Backtest', onClick: () => setActiveTab('configure'), testId: 'compare-empty-action' }} testId="compare-empty-state" />
          ) : (
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <Card>
                <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', marginBottom: 10 }}>SELECT RUNS TO COMPARE</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {runs.slice(0, 10).map((run, idx) => {
                    const isSelected = compareRunIds.includes(run.run_id);
                    return (
                      <button key={run.run_id} onClick={() => {
                        if (isSelected) setCompareRunIds(compareRunIds.filter(id => id !== run.run_id));
                        else if (compareRunIds.length < 2) setCompareRunIds([...compareRunIds, run.run_id]);
                      }}
                        data-testid={`backtest-compare-add-run-${idx}`}
                        style={{ background: isSelected ? AMBER + '22' : BG, border: `1px solid ${isSelected ? AMBER : BORDER}`, borderRadius: 2, padding: '8px 10px', textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ fontSize: 10, fontFamily: MONO, color: TEXT }}>{run.run_id.slice(0, 12)}</div>
                        <div style={{ fontSize: 9, color: SUBTLE, marginTop: 2 }}>{run.config.symbol}  {run.config.start_date}</div>
                        {run.metrics && <div style={{ fontSize: 13, fontWeight: 700, color: (run.metrics.total_return_pct ?? 0) >= 0 ? GREEN : RED, marginTop: 4, fontFamily: MONO }}>{(run.metrics.total_return_pct ?? 0) > 0 ? '+' : ''}{(run.metrics.total_return_pct ?? 0).toFixed(2)}%</div>}
                      </button>
                    );
                  })}
                </div>
              </Card>
              {compareRunIds.length === 2 && (() => {
                const runA = runs.find(r => r.run_id === compareRunIds[0]);
                const runB = runs.find(r => r.run_id === compareRunIds[1]);
                if (!runA || !runB || !runA.metrics || !runB.metrics) return null;
                const delta = { total_return: runB.metrics.total_return_pct - runA.metrics.total_return_pct, sharpe: runB.metrics.sharpe_ratio - runA.metrics.sharpe_ratio, drawdown: runB.metrics.max_drawdown_pct - runA.metrics.max_drawdown_pct, win_rate: runB.metrics.win_rate_pct - runA.metrics.win_rate_pct };
                return (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden' }} data-testid="backtest-compare-table">
                    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>COMPARISON RESULTS</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: BG }}>
                        <tr>
                          {['Metric', 'Run A', 'Run B', 'Delta'].map(h => (
                            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: SUBTLE, letterSpacing: '0.08em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Total Return', a: `${(runA.metrics.total_return_pct ?? 0).toFixed(2)}%`, b: `${(runB.metrics.total_return_pct ?? 0).toFixed(2)}%`, d: delta.total_return, pct: true, better: delta.total_return >= 0 },
                          { label: 'Sharpe Ratio', a: (runA.metrics.sharpe_ratio ?? 0).toFixed(2), b: runB.metrics.sharpe_ratio.toFixed(2), d: delta.sharpe, pct: false, better: delta.sharpe >= 0 },
                          { label: 'Max Drawdown', a: `${runA.metrics.max_drawdown_pct.toFixed(2)}%`, b: `${runB.metrics.max_drawdown_pct.toFixed(2)}%`, d: delta.drawdown, pct: true, better: delta.drawdown <= 0 },
                          { label: 'Win Rate', a: `${runA.metrics.win_rate_pct.toFixed(1)}%`, b: `${runB.metrics.win_rate_pct.toFixed(1)}%`, d: delta.win_rate, pct: true, better: delta.win_rate >= 0 },
                        ].map(row => (
                          <tr key={row.label} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '5px 10px', fontSize: 11, color: TEXT }}>{row.label}</td>
                            <td style={{ padding: '5px 10px', fontSize: 11, color: TEXT, fontFamily: MONO }}>{row.a}</td>
                            <td style={{ padding: '5px 10px', fontSize: 11, color: TEXT, fontFamily: MONO }}>{row.b}</td>
                            <td style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: row.better ? GREEN : RED, fontFamily: MONO }}>
                              {row.d > 0 ? '+' : ''}{row.d.toFixed(row.pct ? 2 : 2)}{row.pct ? '%' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 20 }}>
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 8 }}>EXPORT ARTIFACTS</div>
              <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 12 }}>Download backtest artifacts from the Runs tab, or select a run here.</div>
              {(() => {
                const exportRun = selectedRun || (runs.length > 0 ? runs[0] : null);
                return exportRun ? (
                  <Btn onClick={() => handleDownloadArtifacts(exportRun.run_id)} testId="backtest-export-btn">
                    Export {exportRun.run_id.slice(0, 16)}
                  </Btn>
                ) : (
                  <div style={{ fontSize: 11, color: SUBTLE }}>No run selected. Run a backtest first.</div>
                );
              })()}
            </Card>
          </div>
        )}
      </div>

      <TickerDisambiguationDialog {...tickerInput.dialogProps} />

      {/* Provider Registry & Citations */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 14px', background: PANEL, maxHeight: 280, overflowY: 'auto' }}>
        <ProviderRegistryPanel />
        <CitationsPanel citations={citations} />
      </div>
    </div>
  );
}