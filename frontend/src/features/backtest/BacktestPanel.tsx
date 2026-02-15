/**
 * Backtest Panel - Main backtesting UI
 * v1.31: Strategy artifact binding
 */

import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { cn } from '../../ui/utils';
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

export function BacktestPanel() {
  const [activeTab, setActiveTab] = useState<BacktestTab>('configure');
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [compareRunIds, setCompareRunIds] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // v1.21: Attached portfolio (session-only)
  const [attachedPortfolioId, setAttachedPortfolioId] = useState<string>('DEMO-PORT-001');

  // v1.31: Consume pending strategy artifact ID from app store
  const pendingStrategyArtifactId = useAppStore((s) => s.pendingStrategyArtifactId);
  const setPendingStrategyArtifactId = useAppStore((s) => s.setPendingStrategyArtifactId);
  
  const [config, setConfig] = useState<BacktestConfig>({
    strategy_id: '',
    symbol: 'SPY',
    start_date: '2023-01-01',
    end_date: '2023-12-31',
    initial_capital: 100000,
    slippage_bps: 5,
    fee_per_trade: 1,
    seed: 42,
    strategy_artifact_id: null,
  });

  // v1.31: Pick up pending artifact ID when the panel mounts or the value changes
  useEffect(() => {
    if (pendingStrategyArtifactId) {
      setConfig((prev) => ({ ...prev, strategy_artifact_id: pendingStrategyArtifactId }));
      setPendingStrategyArtifactId(null); // consume it
    }
  }, [pendingStrategyArtifactId, setPendingStrategyArtifactId]);

  // Ticker disambiguation
  const tickerInput = useTickerInput({
    initialValue: config.symbol,
    onResolved: (symbol) => setConfig({...config, symbol}),
    watchlist: [],
  });

  const tabs = [
    { id: 'configure' as const, label: 'Configure' },
    { id: 'runs' as const, label: 'Runs' },
    { id: 'analyze' as const, label: 'Analyze' },
    { id: 'compare' as const, label: 'Compare' },
    { id: 'export' as const, label: 'Export' }
  ];

  useEffect(() => {
    loadStrategies().finally(() => setIsReady(true));
  }, []);

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/strategies');
      const data = await res.json();
      // Ensure data is array
      const strategiesArray = Array.isArray(data) ? data : [];
      setStrategies(strategiesArray);
      if (strategiesArray.length > 0) {
        setConfig((prev) => prev.strategy_id ? prev : { ...prev, strategy_id: strategiesArray[0].id });
      }
    } catch (e) {
      console.error('Failed to load strategies:', e);
      setStrategies([]); // Ensure empty array on error
      setError('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backtest/runs');
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load runs:', e);
      setRuns([]);
      setError('Failed to load backtest runs');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    setRunStatus('running');
    setError(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }
      
      const run = await res.json();
      if (run.status === 'completed') {
        setRunStatus('complete');
        setSelectedRun(run);
      } else {
        setRunStatus('error');
        setError(`Backtest failed with status: ${run.status}`);
      }
      await loadRuns();
      setActiveTab('runs');
    } catch (e) {
      console.error('Failed to run backtest:', e);
      setRunStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to run backtest');
    }
  };

  const handleDownloadArtifacts = async (runId: string) => {
    try {
      const res = await fetch(`/api/backtest/run/${runId}/artifacts`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_bundle_${runId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download artifacts:', e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="backtest-panel">
      {isReady && <div data-testid="backtest-ready" className="hidden" />}
      {/* Header with subtabs */}
      <div className="view-header-bar gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/10">
            <FlaskConical size={16} className="text-brand" />
          </div>
          <h2 className="text-lg font-semibold text-text tracking-tight">Backtest</h2>
        </div>
        
        {/* v1.21: Portfolio Attach Selector + Valuation Cards */}
        <div className="flex flex-col gap-2">
          <PortfolioAttachSelector
            onPortfolioChange={setAttachedPortfolioId}
            currentPortfolioId={attachedPortfolioId}
          />
          {attachedPortfolioId && (
            <PortfolioValuationCards portfolioId={attachedPortfolioId} />
          )}
        </div>
        
        <div className="flex gap-1.5 ml-auto" role="tablist" aria-label="Backtest tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'runs' || tab.id === 'compare' || tab.id === 'export') loadRuns();
              }}
              data-testid={`backtest-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={cn(
                "pill-tab",
                activeTab === tab.id && "active"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span data-testid="backtest-run-status" className="text-xs text-text-muted tabular-nums">{runStatus}</span>
      </div>

      {/* Backtest Status Header (v1.8) */}
      <div className="px-4 pt-3">
        <BacktestStatusHeader
          runId={selectedRun?.run_id}
          configHash={selectedRun?.config_hash}
          status={runStatus}
          completedAt={selectedRun?.completed_at}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Error Banner */}
        {error && (
          <SeverityBanner
            severity="error"
            message={error}
            onDismiss={() => setError(null)}
            className="mb-4"
            testId="backtest-error-banner"
          />
        )}
        
        {/* Success Banner */}
        {runStatus === 'complete' && (
          <SeverityBanner
            severity="success"
            message="Backtest completed successfully!"
            onDismiss={() => setRunStatus('idle')}
            className="mb-4"
            testId="backtest-success-banner"
          />
        )}

        {activeTab === 'configure' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {loading ? (
              <div className="bg-panel-bg border border-border rounded p-4 space-y-4">
                <Skeleton height={60} />
                <Skeleton height={60} />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton height={60} />
                  <Skeleton height={60} />
                </div>
                <Skeleton height={60} />
                <Skeleton height={48} />
              </div>
            ) : (
              <div className="bg-panel-bg border border-border rounded p-4 space-y-4">
              {/* Strategy */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Strategy</label>
                <select
                  value={config.strategy_id}
                  onChange={(e) => setConfig({...config, strategy_id: e.target.value})}
                  data-testid="backtest-strategy-select"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                >
                  <option value="">Select strategy...</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* v1.31: Strategy Artifact ID */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Strategy Artifact</label>
                <div className="flex gap-2" data-testid="backtest-strategy-artifact-select">
                  <input
                    type="text"
                    value={config.strategy_artifact_id || ''}
                    onChange={(e) => setConfig({...config, strategy_artifact_id: e.target.value || null})}
                    placeholder="Strategy artifact ID (optional)"
                    data-testid="backtest-strategy-artifact-current"
                    className="flex-1 px-3 py-2 bg-element-bg border border-border rounded text-text text-xs font-mono"
                  />
                  {config.strategy_artifact_id && (
                    <button
                      onClick={() => setConfig({...config, strategy_artifact_id: null})}
                      className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Symbol */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Symbol</label>
                <input
                  type="text"
                  value={tickerInput.value}
                  onChange={(e) => tickerInput.onChange(e.target.value)}
                  onBlur={() => tickerInput.submit()}
                  data-testid="backtest-symbol-input"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Start Date</label>
                  <input
                    type="date"
                    value={config.start_date}
                    onChange={(e) => setConfig({...config, start_date: e.target.value})}
                    data-testid="backtest-start-date"
                    className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">End Date</label>
                  <input
                    type="date"
                    value={config.end_date}
                    onChange={(e) => setConfig({...config, end_date: e.target.value})}
                    data-testid="backtest-end-date"
                    className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                  />
                </div>
              </div>

              {/* Initial Capital */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Initial Capital ($)</label>
                <input
                  type="number"
                  value={config.initial_capital}
                  onChange={(e) => setConfig({...config, initial_capital: Number(e.target.value)})}
                  data-testid="backtest-capital-input"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                />
              </div>

              {/* Run Button */}
              <button
                onClick={handleRunBacktest}
                disabled={!config.strategy_id || runStatus === 'running'}
                data-testid="run-backtest-btn"
                className="w-full px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium"
              >
                {runStatus === 'running' ? 'Running...' : 'Run Backtest'}
              </button>
            </div>
            )}
          </div>
        )}

        {activeTab === 'runs' && (
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <SkeletonTable rows={5} cols={5} />
            ) : runs.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No backtest runs yet"
                description="Configure and run a backtest to see results here."
                action={{
                  label: 'Configure Backtest',
                  onClick: () => setActiveTab('configure'),
                  testId: 'empty-configure-action'
                }}
                testId="backtest-empty-state"
              />
            ) : (
              <div className="bg-panel-bg border border-border rounded overflow-hidden">
              <table className="w-full" data-testid="backtest-runs-table">
                <thead className="bg-element-bg border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Run ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Symbol</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Return %</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, idx) => (
                      <tr key={run.run_id} className="border-b border-border hover:bg-element-bg/50" data-testid={`backtest-runs-row-${idx}`}>
                        <td className="px-4 py-3 text-sm text-text font-mono">{run.run_id.slice(0, 16)}...</td>
                        <td className="px-4 py-3 text-sm text-text">{run.config.symbol}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text">
                          {run.metrics ? `${(run.metrics.total_return_pct ?? 0).toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          <button
                            onClick={() => { setSelectedRun(run); setActiveTab('analyze'); }}
                            className="text-brand hover:underline"
                            data-testid={`analyze-run-${run.run_id}`}
                          >
                            Analyze
                          </button>
                          <button
                            onClick={() => handleDownloadArtifacts(run.run_id)}
                            className="text-brand hover:underline"
                            data-testid={`download-run-${run.run_id}`}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {activeTab === 'analyze' && (
          selectedRun ? (
            <div className="overflow-auto" data-testid="backtest-analyze-ready">
              <div className="max-w-7xl mx-auto p-4">
                <ProvenanceDisplay 
                  provenance={selectedRun?.provenance || null}
                  className="mb-4"
                />
                {/* v1.24: Portfolio Overlay in Backtest Analyze */}
                <div className="mb-4 bg-surface border border-border rounded p-3" data-testid="backtest-portfolio-overlay">
                  <h4 className="text-sm font-semibold text-text mb-2">Portfolio Context</h4>
                  <div className="flex flex-wrap items-start gap-4">
                    <PortfolioAttachSelector
                      onPortfolioChange={setAttachedPortfolioId}
                      currentPortfolioId={attachedPortfolioId}
                    />
                    {attachedPortfolioId && (
                      <PortfolioValuationCards portfolioId={attachedPortfolioId} />
                    )}
                  </div>
                </div>
              </div>
              <AnalyzeTab run={selectedRun} />
            </div>
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="No run selected"
              description="Select a run from the Runs tab to view detailed analysis."
              action={{
                label: 'View Runs',
                onClick: () => setActiveTab('runs'),
                testId: 'analyze-empty-action'
              }}
              testId="analyze-empty-state"
            />
          )
        )}

        {activeTab === 'compare' && (
          runs.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No runs available"description="Run at least two backtests to compare their results."
              action={{
                label: 'Run Backtest',
                onClick: () => setActiveTab('configure'),
                testId: 'compare-empty-action'
              }}
              testId="compare-empty-state"
            />
          ) : (
            <div className="max-w-6xl mx-auto space-y-4">
            <div className="bg-panel-bg border border-border rounded p-4">
              <h3 className="text-sm font-semibold text-text mb-4">Select Runs to Compare</h3>
              <div className="grid grid-cols-2 gap-4">
                {runs.slice(0, 10).map((run, idx) => {
                  const isSelected = compareRunIds.includes(run.run_id);
                  return (
                    <button
                      key={run.run_id}
                      onClick={() => {
                        if (isSelected) {
                          setCompareRunIds(compareRunIds.filter(id => id !== run.run_id));
                        } else if (compareRunIds.length < 2) {
                          setCompareRunIds([...compareRunIds, run.run_id]);
                        }
                      }}
                      data-testid={`backtest-compare-add-run-${idx}`}
                      className={`p-3 border rounded text-left ${
                        isSelected ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/50'
                      }`}
                    >
                      <div className="text-xs font-mono text-text">{run.run_id.slice(0, 12)}...</div>
                      <div className="text-xs text-text-secondary mt-1">{run.config.symbol} • {run.config.start_date}</div>
                      {run.metrics && (
                        <div className="text-sm font-semibold text-text mt-2">
                          {(run.metrics?.total_return_pct ?? 0) > 0 ? '+' : ''}{(run.metrics?.total_return_pct ?? 0).toFixed(2)}%
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {compareRunIds.length === 2 && (() => {
              const runA = runs.find(r => r.run_id === compareRunIds[0]);
              const runB = runs.find(r => r.run_id === compareRunIds[1]);
              if (!runA || !runB || !runA.metrics || !runB.metrics) return null;
              
              const delta = {
                total_return: runB.metrics.total_return_pct - runA.metrics.total_return_pct,
                sharpe: runB.metrics.sharpe_ratio - runA.metrics.sharpe_ratio,
                drawdown: runB.metrics.max_drawdown_pct - runA.metrics.max_drawdown_pct,
                win_rate: runB.metrics.win_rate_pct - runA.metrics.win_rate_pct,
              };

              return (
                <div className="bg-panel-bg border border-border rounded overflow-hidden" data-testid="backtest-compare-table">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-text">Comparison Results</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-element-bg">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text">Metric</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text">Run A</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text">Run B</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-text">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="px-4 py-2 text-sm text-text">Total Return</td>
                        <td className="px-4 py-2 text-sm text-text">{(runA.metrics?.total_return_pct ?? 0).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-sm text-text">{(runB.metrics?.total_return_pct ?? 0).toFixed(2)}%</td>
                        <td className={`px-4 py-2 text-sm font-semibold ${delta.total_return >= 0 ? 'text-up' : 'text-down'}`}>
                          {(delta.total_return ?? 0) > 0 ? '+' : ''}{(delta.total_return ?? 0).toFixed(2)}%
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-4 py-2 text-sm text-text">Sharpe Ratio</td>
                        <td className="px-4 py-2 text-sm text-text">{(runA.metrics?.sharpe_ratio ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-text">{runB.metrics.sharpe_ratio.toFixed(2)}</td>
                        <td className={`px-4 py-2 text-sm font-semibold ${delta.sharpe >= 0 ? 'text-up' : 'text-down'}`}>
                          {delta.sharpe > 0 ? '+' : ''}{delta.sharpe.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-4 py-2 text-sm text-text">Max Drawdown</td>
                        <td className="px-4 py-2 text-sm text-text">{runA.metrics.max_drawdown_pct.toFixed(2)}%</td>
                        <td className="px-4 py-2 text-sm text-text">{runB.metrics.max_drawdown_pct.toFixed(2)}%</td>
                        <td className={`px-4 py-2 text-sm font-semibold ${delta.drawdown <= 0 ? 'text-up' : 'text-down'}`}>
                          {delta.drawdown > 0 ? '+' : ''}{delta.drawdown.toFixed(2)}%
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-4 py-2 text-sm text-text">Win Rate</td>
                        <td className="px-4 py-2 text-sm text-text">{runA.metrics.win_rate_pct.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-sm text-text">{runB.metrics.win_rate_pct.toFixed(1)}%</td>
                        <td className={`px-4 py-2 text-sm font-semibold ${delta.win_rate >= 0 ? 'text-up' : 'text-down'}`}>
                          {delta.win_rate > 0 ? '+' : ''}{delta.win_rate.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
          )
        )}

        {activeTab === 'export' && (
          <div className="max-w-4xl mx-auto text-center py-8">
            <div className="bg-panel-bg border border-border rounded p-6">
              <h3 className="text-lg font-semibold text-text mb-4">Export Artifacts</h3>
              <p className="text-text-secondary mb-4">
                Download backtest artifacts from the Runs tab, or select a run here.
              </p>
              {(() => {
                const exportRun = selectedRun || (runs.length > 0 ? runs[0] : null);
                return exportRun ? (
                  <button
                    onClick={() => handleDownloadArtifacts(exportRun.run_id)}
                    data-testid="backtest-export-btn"
                    className="px-6 py-3 bg-brand hover:bg-brand/90 text-white rounded font-medium"
                  >
                    Export {exportRun.run_id.slice(0, 16)}...
                  </button>
                ) : (
                  <p className="text-text-secondary">No run selected. Run a backtest first.</p>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Ticker Disambiguation Dialog */}
      <TickerDisambiguationDialog {...tickerInput.dialogProps} />
    </div>
  );
}
