/**
 * RiskDeskPanel — Week 3: Internal subtabs (Run | Runs | Export)
 *
 * Run:    3-column risk run UI (portfolio upload, outputs, trace)
 * Runs:   Run history list (in-memory), click to replay
 * Export: Download JSON buttons (risk_run, tool_trace, ticket)
 */

import { useState, useCallback, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PortfolioUpload } from './PortfolioUpload';
import { RunStatusHeader } from './RunStatusHeader';
import { PremiumRiskCharts } from './PremiumRiskCharts';
import * as RiskDeskAPI from './api';
import { ProvenanceDisplay } from '../../../components/ProvenanceDisplay';
import { ProviderPill } from '../../shared/ProviderPill';
import { ProviderRegistryPanel } from '../../shared/ProviderRegistryPanel';
import { cn } from '../../../ui/utils';
import { API_BASE } from '../../../config/api';
import { PortfolioAttachSelector, PortfolioValuationCards, MultiPortfolioSelector, MultiValuationCards } from '../../portfolio';
import type {
  RiskRunResult,
  RunState,
  TicketDraft,
} from './types';

type RiskDeskTab = 'run' | 'runs' | 'export';

export function RiskDeskPanel() {
  const [activeTab, setActiveTab] = useState<RiskDeskTab>('run');
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [scenarioId, setScenarioId] = useState('moderate_selloff');
  const [runState, setRunState] = useState<RunState>('idle');
  const [result, setResult] = useState<RiskRunResult | null>(null);
  const [ticket, setTicket] = useState<TicketDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // v1.21: Attached portfolio (session-only)
  const [attachedPortfolioId, setAttachedPortfolioId] = useState<string>('DEMO-PORT-001');
  
  // v1.25: Multi-portfolio selection
  const [multiPortfolioIds, setMultiPortfolioIds] = useState<string[]>(['DEMO-PORT-001']);
  
  // Run history (in-memory for demo)
  const [runHistory, setRunHistory] = useState<RiskRunResult[]>([]);
  
  // Compliance fix state
  const [beforeFixResult, setBeforeFixResult] = useState<RiskRunResult | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');

  // Provider info state
  const [providerInfo, setProviderInfo] = useState<{ 
    mode: 'DEMO'; 
    provider: 'demo'; 
    source: 'demo' | 'replay'; 
  }>({ 
    mode: 'DEMO', 
    provider: 'demo', 
    source: 'demo'
  });

  // Fetch provider info on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/market-data/providers`)
      .then(r => r.json())
      .then(data => {
        const providers = Array.isArray(data) ? data : [];
        const demo = providers.find((p: any) => p.name === 'demo');
        if (demo) {
          setProviderInfo({
            mode: demo.mode,
            provider: 'demo',
            source: demo.replay_available ? 'replay' : 'demo'
          });
        }
      })
      .catch(err => console.error('Failed to fetch provider info:', err))
      .finally(() => setIsReady(true));
  }, []);

  // ── File handling ──────────────────────────────────────────────────
  const handleFileSelected = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
      setFileName(f.name);
      setResult(null);
      setTicket(null);
      setError(null);
    };
    reader.readAsText(f);
  }, []);

  const handleLoadDemo = useCallback(async () => {
    try {
      setError(null);
      const csv = await RiskDeskAPI.fetchDemoCsv();
      setCsvText(csv);
      setFileName('demo_portfolio.csv');
      setResult(null);
      setTicket(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo');
    }
  }, []);

  // ── Run pipeline ──────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!csvText) {
      setError('No portfolio loaded. Upload a CSV or load demo.');
      return;
    }
    try {
      setRunState('running');
      setError(null);
      setTicket(null);
      const res = await RiskDeskAPI.runRiskPipeline(csvText, scenarioId);
      setResult(res);
      setRunState('done');
      // Add to run history
      setRunHistory(prev => [res, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Risk run failed');
      setRunState('done');
    }
  }, [csvText, scenarioId]);

  // ── Build ticket ──────────────────────────────────────────────────
  const handleBuildTicket = useCallback(async (hedgeId: string) => {
    if (!result) return;
    try {
      const t = await RiskDeskAPI.buildTicket(result.run_id, hedgeId);
      setTicket(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket build failed');
    }
  }, [result]);
  
  // ── View historical run ───────────────────────────────────────────
  const handleViewRun = useCallback((run: RiskRunResult) => {
    setResult(run);
    setRunState('done');
    setActiveTab('run');
    setTicket(null);
  }, []);
  
  // ── Apply compliance fix (demo only) ──────────────────────────────
  const handleApplyFix = useCallback(async () => {
    if (!csvText || !result || !fileName.includes('demo')) {
      setError('Fix-It is only available for demo portfolios.');
      return;
    }
    
    try {
      setError(null);
      // Save current result as "before"
      setBeforeFixResult(result);
      setShowBeforeAfter('after');
      
      // Parse CSV and apply fixes
      const lines = csvText.trim().split('\n');
      const headers = lines[0];
      const dataLines = lines.slice(1);
      const fixedLines: string[] = [headers];
      
      // Demo fix: For naked shorts (qty < 0 with no offsetting position),
      // add a long leg at +/- $5 strike to create a spread
      const rows = dataLines.map(line => {
        const parts = line.split(',');
        return {
          original: line,
          symbol: parts[0],
          expiry: parts[1],
          strike: parseFloat(parts[2]),
          optionType: parts[3],
          qty: parseInt(parts[4]),
        };
      });
      
      for (const row of rows) {
        fixedLines.push(row.original);
        
        // If short position (qty < 0), add protective long leg
        if (row.qty < 0) {
          const strikeOffset = row.optionType === 'call' ? 5 : -5;
          const newStrike = row.strike + strikeOffset;
          const newQty = Math.abs(row.qty); // Long position
          const newLine = `${row.symbol},${row.expiry},${newStrike},${row.optionType},${newQty},100`;
          fixedLines.push(newLine);
        }
      }
      
      const fixedCsv = fixedLines.join('\n');
      setCsvText(fixedCsv);
      
      // Re-run pipeline with fixed portfolio
      setRunState('running');
      const res = await RiskDeskAPI.runRiskPipeline(fixedCsv, scenarioId);
      setResult(res);
      setRunState('done');
      setRunHistory(prev => [res, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fix failed');
      setRunState('done');
    }
  }, [csvText, result, fileName, scenarioId]);

  const hasPortfolio = !!csvText;
  
  const tabs = [
    { id: 'run' as const, label: 'Run' },
    { id: 'runs' as const, label: 'Runs' },
    { id: 'export' as const, label: 'Export' },
  ];

  return (
    <div className="h-full flex flex-col bg-background" data-testid="risk-desk-panel">
      {isReady && <div data-testid="risk-desk-ready" className="hidden" />}
      {/* Professional header bar */}
      <div className="view-header-bar gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/10">
            <ShieldCheck size={16} className="text-brand" />
          </div>
          <h2 className="text-lg font-semibold text-text tracking-tight" data-testid="risk-desk-title">
            Risk Desk
          </h2>
          <ProviderPill {...providerInfo} testIdPrefix="riskdesk-provider" />
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
        
        {/* Subtabs - pill style */}
        <div className="flex gap-1.5 ml-auto" role="tablist" aria-label="Risk Desk tabs" data-testid="riskdesk-tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`riskdesk-subtab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`riskdesk-tabpanel-${tab.id}`}
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
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-4">

      {/* Run Status Header (v1.8) */}
      <RunStatusHeader result={result} runState={runState} />

      {/* Tab content */}
      {activeTab === 'run' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 h-[calc(100%-5rem)]">
        {/* ═══ LEFT COLUMN: INPUTS ═══ */}
        <div className="flex flex-col gap-4" data-testid="inputs-column">
          {/* Portfolio upload */}
          <PortfolioUpload
            onFileSelected={handleFileSelected}
            onLoadDemo={handleLoadDemo}
            disabled={runState === 'running'}
            fileName={fileName}
          />

          {/* Scenario selector */}
          <div className="bg-element-bg/40 border border-border rounded p-3">
            <label className="text-xs text-text-secondary font-medium block mb-1">
              Stress Scenario
            </label>
            <select
              className="w-full bg-background text-text border border-border rounded px-2 py-1 text-sm"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              disabled={runState === 'running'}
              data-testid="scenario-select"
            >
              <option value="moderate_selloff">Moderate Sell-off (-10% spot, +20% vol)</option>
              <option value="severe_crash">Severe Crash (-25% spot, +50% vol)</option>
              <option value="vol_expansion">Vol Expansion (0% spot, +40% vol)</option>
            </select>
          </div>

          {/* Run button */}
          <button
            className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors
              ${hasPortfolio && runState !== 'running'
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
            onClick={handleRun}
            disabled={!hasPortfolio || runState === 'running'}
            data-testid="run-button"
          >
            {runState === 'running' ? 'Running...' : 'Run Risk Pipeline'}
          </button>

          {/* Error banner */}
          {error && (
            <div className="p-2 rounded bg-red-900/20 border border-red-700 text-red-400 text-xs" data-testid="error-banner">
              {error}
            </div>
          )}

          {/* v1.25: Multi-Portfolio Analysis */}
          <div className="bg-element-bg/40 border border-border rounded p-3" data-testid="multi-portfolio-section">
            <label className="text-xs text-text-secondary font-medium block mb-2">
              Multi-Portfolio Analysis (v1.25)
            </label>
            <MultiPortfolioSelector
              onSelectionChange={setMultiPortfolioIds}
              selectedIds={multiPortfolioIds}
            />
            {multiPortfolioIds.length > 0 && (
              <div className="mt-3">
                <MultiValuationCards portfolioIds={multiPortfolioIds} />
              </div>
            )}
          </div>
        </div>

        {/* ═══ MIDDLE COLUMN: OUTPUTS ═══ */}
        <div className="flex flex-col gap-4 overflow-auto" data-testid="outputs-column">
          {runState === 'idle' && (
            <div className="text-center py-16" data-testid="empty-state">
              <div className="text-text-secondary text-sm mb-4">
                Load a portfolio and click "Run Risk Pipeline" to begin.
              </div>
              <div className="text-xs text-text-secondary/70 max-w-sm mx-auto">
                The 5-tool pipeline calculates greeks, runs stress tests,
                verifies results, checks compliance, and generates hedge candidates.
              </div>
              <button
                className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline focus-visible:outline-2 focus-visible:outline-brand"
                onClick={handleLoadDemo}
                data-testid="empty-state-load-demo"
              >
                Load sample portfolio to get started
              </button>
            </div>
          )}

          {runState === 'running' && (
            <div className="text-center py-16 text-blue-400 text-sm" data-testid="running-indicator">
              Running 5-tool pipeline…
            </div>
          )}

          {runState === 'done' && result && (
            <div data-testid="riskdesk-ready">
              {/* Provenance Display */}
              <ProvenanceDisplay 
                provenance={result.provenance || null}
                className="mx-auto"
              />
              
              {/* v1.37: Provider Registry */}
              <div className="my-3">
                <ProviderRegistryPanel />
              </div>
              
              {/* Run status */}
              <div className={`p-3 rounded border text-sm ${
                result.ok
                  ? 'bg-green-900/20 border-green-700 text-green-400'
                  : 'bg-red-900/20 border-red-700 text-red-400'
              }`} data-testid="run-status">
                <span className="font-medium">
                  {result.ok ? '✓ Pipeline Complete' : '✗ Pipeline Failed'}
                </span>
                <span className="ml-2 text-xs opacity-75">
                  {result.run_id}
                </span>
                {result.error && (
                  <p className="mt-1 text-xs">{result.error}</p>
                )}
              </div>

              {/* Greeks summary */}
              {result.greeks && (
                <div className="bg-element-bg/40 border border-border rounded p-3" data-testid="greeks-card">
                  <h3 className="text-sm font-semibold text-text mb-2">Portfolio Greeks</h3>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <div className="text-text-secondary">Delta (Δ)</div>
                      <div className="text-text font-mono" data-testid="net-delta">
                        {result.greeks.net_delta.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Gamma (Γ)</div>
                      <div className="text-text font-mono" data-testid="net-gamma">
                        {result.greeks.net_gamma.toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Vega (V)</div>
                      <div className="text-text font-mono" data-testid="net-vega">
                        {result.greeks.net_vega.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Theta (Θ)</div>
                      <div className="text-text font-mono" data-testid="net-theta">
                        {result.greeks.net_theta.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stress P&L */}
              {result.stress && (
                <div className="bg-element-bg/40 border border-border rounded p-3" data-testid="stress-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text">
                      Stress Test: {(showBeforeAfter === 'before' && beforeFixResult?.stress 
                        ? beforeFixResult.stress.scenario.label 
                        : result.stress.scenario.label)}
                    </h3>
                    
                    {/* Before/After toggle (only show if we have both) */}
                    {beforeFixResult && beforeFixResult.stress && (
                      <div className="flex gap-1 text-xs">
                        <button
                          className={`px-2 py-1 rounded transition-colors ${
                            showBeforeAfter === 'before'
                              ? 'bg-brand text-white'
                              : 'bg-element-bg text-text-secondary hover:text-text'
                          }`}
                          onClick={() => setShowBeforeAfter('before')}
                          data-testid="toggle-before"
                        >
                          Before Fix
                        </button>
                        <button
                          className={`px-2 py-1 rounded transition-colors ${
                            showBeforeAfter === 'after'
                              ? 'bg-brand text-white'
                              : 'bg-element-bg text-text-secondary hover:text-text'
                          }`}
                          onClick={() => setShowBeforeAfter('after')}
                          data-testid="toggle-after"
                        >
                          After Fix
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {(() => {
                    const displayStress = showBeforeAfter === 'before' && beforeFixResult?.stress
                      ? beforeFixResult.stress
                      : result.stress;
                    
                    return (
                      <>
                        <div className="text-lg font-mono font-bold mb-2" data-testid="stress-pnl"
                          style={{ color: displayStress.total_pnl < 0 ? '#ef4444' : '#22c55e' }}>
                          ${displayStress.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>

                        {/* Per-leg stress table */}
                        <table className="w-full text-xs border-collapse mb-3" data-testid="stress-legs-table">
                          <thead>
                            <tr className="text-text-secondary">
                              <th className="text-left py-1">Symbol</th>
                              <th className="text-left py-1">Type</th>
                              <th className="text-right py-1">Strike</th>
                              <th className="text-right py-1">Base</th>
                              <th className="text-right py-1">Stressed</th>
                              <th className="text-right py-1">P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayStress.leg_results.map((leg, i) => (
                              <tr key={i} className="text-text border-t border-border/30">
                                <td className="py-1">{leg.symbol}</td>
                                <td className="py-1">{leg.option_type}</td>
                                <td className="text-right py-1">{leg.strike}</td>
                                <td className="text-right py-1 font-mono">{leg.base_value.toFixed(0)}</td>
                                <td className="text-right py-1 font-mono">{leg.stressed_value.toFixed(0)}</td>
                                <td className="text-right py-1 font-mono"
                                  style={{ color: leg.pnl < 0 ? '#ef4444' : '#22c55e' }}>
                                  {leg.pnl.toFixed(0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Before / After Payoff Chart (A3) */}
                        {beforeFixResult && beforeFixResult.stress && (
                          <div className="mt-3" data-testid="before-after-chart">
                            <h4 className="text-xs font-semibold text-text-secondary mb-2">Before / After Hedge Payoff</h4>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart
                                data={(() => {
                                  const beforeLegs = beforeFixResult.stress.leg_results || [];
                                  const afterLegs = displayStress.leg_results || [];
                                  const allSymbols = [...new Set([
                                    ...beforeLegs.map((l: any) => l.symbol),
                                    ...afterLegs.map((l: any) => l.symbol),
                                  ])];
                                  return allSymbols.map(sym => ({
                                    symbol: sym,
                                    before: beforeLegs.find((l: any) => l.symbol === sym)?.pnl ?? 0,
                                    after: afterLegs.find((l: any) => l.symbol === sym)?.pnl ?? 0,
                                  }));
                                })()}
                                margin={{ top: 5, right: 20, left: 15, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="symbol" stroke="var(--color-text-secondary)" tick={{ fontSize: 11 }} />
                                <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 11 }} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: 'var(--color-element)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                />
                                <Legend />
                                <Bar dataKey="before" name="Before Fix" fill="#ef4444" opacity={0.7} />
                                <Bar dataKey="after" name="After Fix" fill="#22c55e" opacity={0.7} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Hedge candidates */}
                  <h4 className="text-xs font-semibold text-text-secondary mb-1">Hedge Candidates</h4>
                  <div className="flex flex-col gap-2" data-testid="hedge-candidates">
                    {result.stress.hedge_candidates.map((hc) => (
                      <div key={hc.id} className="bg-background border border-border rounded p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-text" data-testid={`hedge-name-${hc.id}`}>
                            {hc.name}
                          </span>
                          <button
                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                            onClick={() => handleBuildTicket(hc.id)}
                            data-testid={`build-ticket-${hc.id}`}
                          >
                            Build Ticket
                          </button>
                        </div>
                        <div className="text-text-secondary">{hc.explanation}</div>
                        <div className="flex gap-4 mt-1">
                          <span>Cost: ${hc.net_cost_est.toFixed(2)}</span>
                          <span>Max loss reduction: ${hc.max_loss_reduction_est.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Premium Charts (v1.9) */}
              {result && <PremiumRiskCharts result={result} />}

              {/* Verification */}
              {result.verification && (
                <div className={`p-3 rounded border text-xs ${
                  result.verification.verified
                    ? 'bg-green-900/10 border-green-800 text-green-400'
                    : 'bg-yellow-900/10 border-yellow-800 text-yellow-400'
                }`} data-testid="verification-card">
                  <span className="font-medium">
                    Greeks Verification ({result.verification.method}):{' '}
                    {result.verification.verified ? '✓ Passed' : '⚠ Discrepancy detected'}
                  </span>
                  <span className="ml-2 opacity-75">
                    Max Δ deviation: {result.verification.max_delta_deviation.toFixed(6)}
                  </span>
                </div>
              )}

              {/* Compliance gate */}
              {result.compliance && (
                <div className={`p-3 rounded border text-sm ${
                  result.compliance.status === 'approved'
                    ? 'bg-green-900/20 border-green-700 text-green-400'
                    : 'bg-red-900/20 border-red-700 text-red-400'
                }`} data-testid="compliance-card">
                  <h3 className="font-medium mb-1">
                    Compliance: {result.compliance.status === 'approved' ? '✓ Approved' : '✗ Blocked'}
                  </h3>
                  {result.compliance.violations.length > 0 && (
                    <>
                      <ul className="text-xs space-y-1 mt-2">
                        {result.compliance.violations.map((v, i) => (
                          <li key={i} data-testid={`violation-${i}`}>
                            <span className={`font-medium ${
                              v.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              [{v.severity.toUpperCase()}]
                            </span>{' '}
                            {v.message}
                            {v.suggested_fix && (
                              <span className="text-text-secondary ml-1">→ {v.suggested_fix}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      
                      {/* Apply Fix button */}
                      {result.compliance.status === 'blocked' && (
                        <button
                          className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-2 rounded font-medium transition-colors"
                          onClick={handleApplyFix}
                          data-testid="apply-fix-button"
                        >
                          {fileName.includes('demo') 
                            ? 'Apply Suggested Fix (Demo)' 
                            : 'Fix-It available for demo fixtures only'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Ticket draft */}
              {ticket && (
                <div className="bg-element-bg/40 border border-border rounded p-3" data-testid="ticket-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text">
                      Trade Ticket: {ticket.hedge_name}
                    </h3>
                    <button
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(ticket, null, 2));
                      }}
                      data-testid="copy-ticket"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="text-xs text-text font-mono bg-background p-2 rounded overflow-auto max-h-48" data-testid="ticket-json">
                    {JSON.stringify(ticket, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN: TOOL TRACE ═══ */}
        <div className="flex flex-col gap-2" data-testid="trace-column">
          <h3 className="text-sm font-semibold text-text">Tool Trace</h3>
          {(!result || result.tool_trace.length === 0) && (
            <div className="text-text-secondary text-xs">No trace yet.</div>
          )}
          {result?.tool_trace.map((t, i) => (
            <div
              key={i}
              className={`p-2 rounded border text-xs ${
                t.status === 'ok'
                  ? 'bg-green-900/10 border-green-800'
                  : 'bg-red-900/10 border-red-800'
              }`}
              data-testid={`trace-${t.tool_id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">
                  {t.tool_id}: {t.tool_name}
                </span>
                <span className={`text-xs ${t.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.status === 'ok' ? '✓' : '✗'} {t.duration_ms}ms
                </span>
              </div>
              <div className="text-text-secondary mt-1 truncate">
                {t.outputs_summary}
              </div>
            </div>
          ))}

          {/* Download trace JSON */}
          {result && result.tool_trace.length > 0 && (
            <button
              className="text-xs text-blue-400 hover:text-blue-300 underline mt-2"
              onClick={() => {
                const blob = new Blob([JSON.stringify(result.tool_trace, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `trace-${result.run_id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              data-testid="download-trace"
            >
              Download Trace JSON
            </button>
          )}
        </div>
        </div>
      )}

      {/* ═══ RUNS TAB ═══ */}
      {activeTab === 'runs' && (
        <div className="h-[calc(100%-5rem)]" data-testid="runs-tab" role="tabpanel" id="riskdesk-tabpanel-runs">
          <h3 className="text-sm font-semibold text-text mb-2">Run History</h3>
          {runHistory.length === 0 ? (
            <div className="text-center py-16" data-testid="runs-empty-state">
              <div className="text-text-secondary text-sm mb-2">
                No runs yet.
              </div>
              <div className="text-xs text-text-secondary/70 mb-4">
                Execute your first risk analysis from the "Run" tab to see results here.
              </div>
              <button
                className="text-xs text-blue-400 hover:text-blue-300 underline focus-visible:outline-2 focus-visible:outline-brand"
                onClick={() => setActiveTab('run')}
                data-testid="runs-empty-goto-run"
              >
                Go to Run tab →
              </button>
            </div>
          ) : (
            <div className="space-y-2 overflow-auto h-full">
              {runHistory.map((run, idx) => (
                <div
                  key={run.run_id}
                  className="bg-element-bg/40 border border-border rounded p-3 hover:border-brand cursor-pointer transition-colors"
                  onClick={() => handleViewRun(run)}
                  data-testid={`run-history-item-${idx}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text" data-testid="run-history-run-id">
                      {run.run_id}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      run.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
                    }`}>
                      {run.ok ? 'OK' : 'Failed'}
                    </span>
                  </div>
                  {run.stress && (
                    <div className="text-xs text-text-secondary">
                      Scenario: {run.stress.scenario.label}
                    </div>
                  )}
                  {run.compliance && (
                    <div className="text-xs text-text-secondary">
                      Compliance: {run.compliance.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ EXPORT TAB ═══ */}
      {activeTab === 'export' && (
        <div className="h-[calc(100%-5rem)]" data-testid="export-tab" role="tabpanel" id="riskdesk-tabpanel-export">
          <span data-testid="riskdesk-export-ready">✓</span>
          <h3 className="text-sm font-semibold text-text mb-3">Export Risk Desk Data</h3>
          
          {!result && (
            <div className="text-center py-8 text-text-secondary text-sm">
              No risk run available. Execute a run first to enable exports.
            </div>
          )}
          
          <div className="space-y-4 max-w-md">
            {/* Export risk run JSON */}
            <div className="bg-element-bg/40 border border-border rounded p-3">
              <h4 className="text-sm font-medium text-text mb-2">Risk Run Result</h4>
              <p className="text-xs text-text-secondary mb-2">
                Complete pipeline output including greeks, stress test, compliance, and verification.
              </p>
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!result) return;
                  const blob = new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `risk_run-${result.run_id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!result}
                data-testid="export-risk-run"
              >
                Download risk_run.json
              </button>
            </div>

            {/* Export tool trace JSON */}
            <div className="bg-element-bg/40 border border-border rounded p-3">
              <h4 className="text-sm font-medium text-text mb-2">Tool Trace Timeline</h4>
              <p className="text-xs text-text-secondary mb-2">
                Execution timeline for all 5 tools (T1-T5) with timing and outputs.
              </p>
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!result || !result.tool_trace.length) return;
                  const blob = new Blob([JSON.stringify(result.tool_trace, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tool_trace-${result.run_id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!result || !result?.tool_trace.length}
                data-testid="export-tool-trace"
              >
                Download tool_trace.json
              </button>
            </div>

            {/* Export ticket JSON */}
            <div className="bg-element-bg/40 border border-border rounded p-3">
              <h4 className="text-sm font-medium text-text mb-2">Trade Ticket</h4>
              <p className="text-xs text-text-secondary mb-2">
                {ticket ? `Generated trade ticket for hedge: ${ticket.hedge_name}` : 'Generate a ticket first from the Run tab'}
              </p>
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!ticket) return;
                  const blob = new Blob([JSON.stringify(ticket, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ticket-${ticket.hedge_name}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!ticket}
                data-testid="export-ticket"
              >
                Download ticket.json
              </button>
            </div>

            {/* v1.22: Export ZIP Bundle */}
            <div className="bg-element-bg/40 border border-border rounded p-3">
              <h4 className="text-sm font-medium text-text mb-2">Complete Export Bundle (v1.22)</h4>
              <p className="text-xs text-text-secondary mb-2">
                Institutional-grade ZIP archive with all artifacts, portfolio data, and SHA256 manifest.
              </p>
              <button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!result) return;
                  try {
                    const blob = await RiskDeskAPI.exportRiskRun(result.run_id);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `risk-export-${result.run_id}.zip`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('[Risk Desk] Export failed:', err);
                    alert('Export failed. Ensure backend is running.');
                  }
                }}
                disabled={!result}
                data-testid="export-bundle-zip"
              >
                Download ZIP Bundle
              </button>
            </div>

            {/* Playwright report info */}
            <div className="bg-element-bg/40 border border-border rounded p-3">
              <h4 className="text-sm font-medium text-text mb-2">Playwright Test Report</h4>
              <p className="text-xs text-text-secondary mb-2">
                Local HTML report with videos, traces, and screenshots.
              </p>
              <div className="bg-background border border-border rounded p-2 text-xs text-text font-mono">
                <div>Path: frontend/playwright-report/</div>
                <div className="mt-1">Command: <span className="text-blue-400">npx playwright show-report</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
