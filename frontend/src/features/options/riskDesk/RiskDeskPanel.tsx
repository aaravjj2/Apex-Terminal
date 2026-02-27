const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useCallback, useEffect } from 'react';
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
import { API_BASE } from '../../../config/api';
import { PortfolioAttachSelector, PortfolioValuationCards, MultiPortfolioSelector, MultiValuationCards } from '../../portfolio';
import type { RiskRunResult, RunState, TicketDraft } from './types';

type RiskDeskTab = 'run' | 'runs' | 'export';

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 14px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
  color: active ? AMBER : SUBTLE,
  fontFamily: MONO,
  transition: 'color 0.1s, border-color 0.1s',
});

function Btn({ children, onClick, disabled, color, testId }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; color?: string; testId?: string }) {
  const bg = color === 'green' ? GREEN : color === 'red' ? RED : color === 'purple' ? PURPLE : BLUE;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        background: disabled ? BORDER : bg,
        color: disabled ? SUBTLE : '#fff',
        border: 'none',
        borderRadius: 2,
        padding: '6px 14px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: MONO,
        textTransform: 'uppercase',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, mismatch, testId }: { children: React.ReactNode; mismatch?: boolean; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        background: mismatch ? '#1a0a0a' : PANEL,
        border: `1px solid ${mismatch ? RED + '44' : BORDER}`,
        borderRadius: 3,
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: MONO }}>
      {children}
    </div>
  );
}

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
  const [attachedPortfolioId, setAttachedPortfolioId] = useState<string>('DEMO-PORT-001');
  const [multiPortfolioIds, setMultiPortfolioIds] = useState<string[]>(['DEMO-PORT-001']);
  const [runHistory, setRunHistory] = useState<RiskRunResult[]>([]);
  const [beforeFixResult, setBeforeFixResult] = useState<RiskRunResult | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');
  const [spinAngle, setSpinAngle] = useState(0);

  const [providerInfo, setProviderInfo] = useState<{ mode: 'DEMO'; provider: 'demo'; source: 'demo' | 'replay' }>({
    mode: 'DEMO', provider: 'demo', source: 'demo'
  });

  useEffect(() => {
    if (runState === 'running') {
      const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50);
      return () => clearInterval(t);
    }
  }, [runState]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/market-data/providers`)
      .then(r => r.json())
      .then(data => {
        const providers = Array.isArray(data) ? data : [];
        const demo = providers.find((p: any) => p.name === 'demo');
        if (demo) setProviderInfo({ mode: demo.mode, provider: 'demo', source: demo.replay_available ? 'replay' : 'demo' });
      })
      .catch(err => console.error('Failed to fetch provider info:', err))
      .finally(() => setIsReady(true));
  }, []);

  const handleFileSelected = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
      setFileName(f.name);
      setResult(null); setTicket(null); setError(null);
    };
    reader.readAsText(f);
  }, []);

  const handleLoadDemo = useCallback(async () => {
    try {
      setError(null);
      const csv = await RiskDeskAPI.fetchDemoCsv();
      setCsvText(csv); setFileName('demo_portfolio.csv');
      setResult(null); setTicket(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo');
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!csvText) { setError('No portfolio loaded. Upload a CSV or load demo.'); return; }
    try {
      setRunState('running'); setError(null); setTicket(null);
      const res = await RiskDeskAPI.runRiskPipeline(csvText, scenarioId);
      setResult(res); setRunState('done');
      setRunHistory(prev => [res, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Risk run failed');
      setRunState('done');
    }
  }, [csvText, scenarioId]);

  const handleBuildTicket = useCallback(async (hedgeId: string) => {
    if (!result) return;
    try {
      const t = await RiskDeskAPI.buildTicket(result.run_id, hedgeId);
      setTicket(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket build failed');
    }
  }, [result]);

  const handleViewRun = useCallback((run: RiskRunResult) => {
    setResult(run); setRunState('done'); setActiveTab('run'); setTicket(null);
  }, []);

  const handleApplyFix = useCallback(async () => {
    if (!csvText || !result || !fileName.includes('demo')) {
      setError('Fix-It is only available for demo portfolios.'); return;
    }
    try {
      setError(null);
      setBeforeFixResult(result); setShowBeforeAfter('after');
      const lines = csvText.trim().split('\n');
      const headers = lines[0];
      const dataLines = lines.slice(1);
      const fixedLines: string[] = [headers];
      const rows = dataLines.map(line => {
        const parts = line.split(',');
        return { original: line, symbol: parts[0], expiry: parts[1], strike: parseFloat(parts[2]), optionType: parts[3], qty: parseInt(parts[4]) };
      });
      for (const row of rows) {
        fixedLines.push(row.original);
        if (row.qty < 0) {
          const strikeOffset = row.optionType === 'call' ? 5 : -5;
          fixedLines.push(`${row.symbol},${row.expiry},${row.strike + strikeOffset},${row.optionType},${Math.abs(row.qty)},100`);
        }
      }
      const fixedCsv = fixedLines.join('\n');
      setCsvText(fixedCsv);
      setRunState('running');
      const res = await RiskDeskAPI.runRiskPipeline(fixedCsv, scenarioId);
      setResult(res); setRunState('done');
      setRunHistory(prev => [res, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fix failed');
      setRunState('done');
    }
  }, [csvText, result, fileName, scenarioId]);

  const downloadBlob = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const hasPortfolio = !!csvText;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO }} data-testid="risk-desk-panel">
      {isReady && <div data-testid="risk-desk-ready" style={{ display: 'none' }} />}

      {/* Header */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, color: GREEN }}></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }} data-testid="risk-desk-title">RISK DESK</span>
          <ProviderPill {...providerInfo} testIdPrefix="riskdesk-provider" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <PortfolioAttachSelector onPortfolioChange={setAttachedPortfolioId} currentPortfolioId={attachedPortfolioId} />
          {attachedPortfolioId && <PortfolioValuationCards portfolioId={attachedPortfolioId} />}
        </div>
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto', borderBottom: `1px solid ${BORDER}` }} role="tablist" aria-label="Risk Desk tabs" data-testid="riskdesk-tablist">
          {(['run', 'runs', 'export'] as RiskDeskTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}
              data-testid={`riskdesk-subtab-${tab}`} role="tab" aria-selected={activeTab === tab}
              aria-controls={`riskdesk-tabpanel-${tab}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        <RunStatusHeader result={result} runState={runState} />

        {/* RUN TAB */}
        {activeTab === 'run' && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 10, minHeight: 0 }}>
            {/* Left: Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="inputs-column">
              <PortfolioUpload onFileSelected={handleFileSelected} onLoadDemo={handleLoadDemo} disabled={runState === 'running'} fileName={fileName} />

              <Card>
                <SectionTitle>Stress Scenario</SectionTitle>
                <select
                  value={scenarioId}
                  onChange={e => setScenarioId(e.target.value)}
                  disabled={runState === 'running'}
                  data-testid="scenario-select"
                  style={{ width: '100%', background: BG, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 6px', fontSize: 10, fontFamily: MONO }}
                >
                  <option value="moderate_selloff">Moderate Sell-off (-10% spot, +20% vol)</option>
                  <option value="severe_crash">Severe Crash (-25% spot, +50% vol)</option>
                  <option value="vol_expansion">Vol Expansion (0% spot, +40% vol)</option>
                </select>
              </Card>

              <Btn onClick={handleRun} disabled={!hasPortfolio || runState === 'running'} color="green" testId="run-button">
                {runState === 'running' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> RUNNING
                  </span>
                ) : 'RUN RISK PIPELINE'}
              </Btn>

              {error && (
                <div style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, padding: '6px 8px', fontSize: 10, color: RED }} data-testid="error-banner">
                  {error}
                </div>
              )}

              <Card testId="multi-portfolio-section">
                <SectionTitle>Multi-Portfolio Analysis (v1.25)</SectionTitle>
                <MultiPortfolioSelector onSelectionChange={setMultiPortfolioIds} selectedIds={multiPortfolioIds} />
                {multiPortfolioIds.length > 0 && <div style={{ marginTop: 8 }}><MultiValuationCards portfolioIds={multiPortfolioIds} /></div>}
              </Card>
            </div>

            {/* Middle: Outputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }} data-testid="outputs-column">
              {runState === 'idle' && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }} data-testid="empty-state">
                  <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 8 }}>Load a portfolio and click RUN RISK PIPELINE to begin.</div>
                  <div style={{ fontSize: 10, color: SUBTLE, maxWidth: 320, margin: '0 auto 12px' }}>
                    The 5-tool pipeline calculates greeks, runs stress tests, verifies results, checks compliance, and generates hedge candidates.
                  </div>
                  <button onClick={handleLoadDemo} style={{ fontSize: 10, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: MONO }} data-testid="empty-state-load-demo">
                    Load sample portfolio to get started
                  </button>
                </div>
              )}

              {runState === 'running' && (
                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: BLUE }} data-testid="running-indicator">
                  Running 5-tool pipeline
                </div>
              )}

              {runState === 'done' && result && (
                <div data-testid="riskdesk-ready">
                  <ProvenanceDisplay provenance={result.provenance || null} />
                  <div style={{ margin: '8px 0' }}><ProviderRegistryPanel /></div>

                  {/* Run status */}
                  <div
                    style={{ padding: '8px 10px', borderRadius: 2, border: `1px solid ${result.ok ? GREEN + '44' : RED + '44'}`, background: result.ok ? GREEN + '11' : RED + '11', fontSize: 11, color: result.ok ? GREEN : RED, marginBottom: 8 }}
                    data-testid="run-status"
                  >
                    <span style={{ fontWeight: 700 }}>{result.ok ? ' PIPELINE COMPLETE' : ' PIPELINE FAILED'}</span>
                    <span style={{ marginLeft: 8, color: SUBTLE, fontSize: 10 }}>{result.run_id}</span>
                    {result.error && <div style={{ marginTop: 4, fontSize: 10 }}>{result.error}</div>}
                  </div>

                  {/* Greeks */}
                  {result.greeks && (
                    <Card testId="greeks-card">
                      <SectionTitle>Portfolio Greeks</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                        {[
                          { l: 'Delta Δ', v: result.greeks.net_delta.toFixed(2), testId: 'net-delta' },
                          { l: 'Gamma Γ', v: result.greeks.net_gamma.toFixed(4), testId: 'net-gamma' },
                          { l: 'Vega V', v: result.greeks.net_vega.toFixed(2), testId: 'net-vega' },
                          { l: 'Theta Θ', v: result.greeks.net_theta.toFixed(2), testId: 'net-theta' },
                        ].map(g => (
                          <div key={g.l} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '5px 6px', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: SUBTLE }}>{g.l}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: MONO }} data-testid={g.testId}>{g.v}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Stress */}
                  {result.stress && (
                    <Card testId="stress-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <SectionTitle>
                          Stress: {(showBeforeAfter === 'before' && beforeFixResult?.stress ? beforeFixResult.stress.scenario.label : result.stress.scenario.label)}
                        </SectionTitle>
                        {beforeFixResult && beforeFixResult.stress && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {(['before', 'after'] as const).map(v => (
                              <button key={v} onClick={() => setShowBeforeAfter(v)}
                                data-testid={`toggle-${v}`}
                                style={{ fontSize: 9, padding: '2px 8px', background: showBeforeAfter === v ? AMBER : BG, color: showBeforeAfter === v ? '#000' : SUBTLE, border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {v === 'before' ? 'Before Fix' : 'After Fix'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {(() => {
                        const ds = showBeforeAfter === 'before' && beforeFixResult?.stress ? beforeFixResult.stress : result.stress;
                        return (
                          <>
                            <div style={{ fontSize: 20, fontWeight: 700, color: ds.total_pnl < 0 ? RED : GREEN, fontFamily: MONO, marginBottom: 8 }} data-testid="stress-pnl">
                              ${ds.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 10 }} data-testid="stress-legs-table">
                              <thead>
                                <tr style={{ color: SUBTLE }}>
                                  {['Symbol', 'Type', 'Strike', 'Base', 'Stressed', 'P&L'].map(h => (
                                    <th key={h} style={{ textAlign: h === 'Symbol' || h === 'Type' ? 'left' : 'right', padding: '2px 4px', fontWeight: 600 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ds.leg_results.map((leg: any, i: number) => (
                                  <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, color: TEXT }}>
                                    <td style={{ padding: '2px 4px' }}>{leg.symbol}</td>
                                    <td style={{ padding: '2px 4px' }}>{leg.option_type}</td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right' }}>{leg.strike}</td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right', fontFamily: MONO }}>{leg.base_value.toFixed(0)}</td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right', fontFamily: MONO }}>{leg.stressed_value.toFixed(0)}</td>
                                    <td style={{ padding: '2px 4px', textAlign: 'right', fontFamily: MONO, color: leg.pnl < 0 ? RED : GREEN }}>{leg.pnl.toFixed(0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {beforeFixResult && beforeFixResult.stress && (
                              <div style={{ marginTop: 10 }} data-testid="before-after-chart">
                                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 6 }}>BEFORE / AFTER HEDGE PAYOFF</div>
                                <ResponsiveContainer width="100%" height={180}>
                                  <BarChart
                                    data={(() => {
                                      const bLegs = beforeFixResult.stress.leg_results || [];
                                      const aLegs = ds.leg_results || [];
                                      const syms = [...new Set([...bLegs.map((l: any) => l.symbol), ...aLegs.map((l: any) => l.symbol)])];
                                      return syms.map(s => ({
                                        symbol: s,
                                        before: bLegs.find((l: any) => l.symbol === s)?.pnl ?? 0,
                                        after: aLegs.find((l: any) => l.symbol === s)?.pnl ?? 0,
                                      }));
                                    })()}
                                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                                    <XAxis dataKey="symbol" stroke={SUBTLE} tick={{ fontSize: 9, fill: SUBTLE }} />
                                    <YAxis stroke={SUBTLE} tick={{ fontSize: 9, fill: SUBTLE }} />
                                    <Tooltip contentStyle={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 10 }} />
                                    <Legend wrapperStyle={{ fontSize: 9 }} />
                                    <Bar dataKey="before" name="Before Fix" fill={RED} opacity={0.7} />
                                    <Bar dataKey="after" name="After Fix" fill={GREEN} opacity={0.7} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <div style={{ fontSize: 10, color: SUBTLE, margin: '8px 0 4px', fontWeight: 700, letterSpacing: '0.08em' }}>HEDGE CANDIDATES</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="hedge-candidates">
                        {result.stress.hedge_candidates.map((hc: any) => (
                          <div key={hc.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '6px 8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }} data-testid={`hedge-name-${hc.id}`}>{hc.name}</span>
                              <button onClick={() => handleBuildTicket(hc.id)} data-testid={`build-ticket-${hc.id}`}
                                style={{ fontSize: 9, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: MONO }}>
                                BUILD TICKET
                              </button>
                            </div>
                            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 3 }}>{hc.explanation}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: TEXT }}>
                              <span>Cost: ${hc.net_cost_est.toFixed(2)}</span>
                              <span>Max loss reduction: ${hc.max_loss_reduction_est.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {result && <PremiumRiskCharts result={result} />}

                  {/* Verification */}
                  {result.verification && (
                    <div
                      style={{ padding: '6px 10px', borderRadius: 2, border: `1px solid ${result.verification.verified ? GREEN + '44' : AMBER + '44'}`, background: result.verification.verified ? GREEN + '11' : AMBER + '11', fontSize: 10, color: result.verification.verified ? GREEN : AMBER, marginBottom: 8 }}
                      data-testid="verification-card"
                    >
                      <span style={{ fontWeight: 700 }}>GREEKS VERIFICATION ({result.verification.method}): {result.verification.verified ? ' PASSED' : ' DISCREPANCY'}</span>
                      <span style={{ marginLeft: 8, color: SUBTLE }}>Max Δ deviation: {result.verification.max_delta_deviation.toFixed(6)}</span>
                    </div>
                  )}

                  {/* Compliance */}
                  {result.compliance && (
                    <div
                      style={{ padding: '8px 10px', borderRadius: 2, border: `1px solid ${result.compliance.status === 'approved' ? GREEN + '44' : RED + '44'}`, background: result.compliance.status === 'approved' ? GREEN + '11' : RED + '11', fontSize: 11, marginBottom: 8 }}
                      data-testid="compliance-card"
                    >
                      <div style={{ fontWeight: 700, color: result.compliance.status === 'approved' ? GREEN : RED, marginBottom: 4 }}>
                        COMPLIANCE: {result.compliance.status === 'approved' ? ' APPROVED' : ' BLOCKED'}
                      </div>
                      {result.compliance.violations.length > 0 && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {result.compliance.violations.map((v: any, i: number) => (
                              <div key={i} style={{ fontSize: 10, color: TEXT }} data-testid={`violation-${i}`}>
                                <span style={{ fontWeight: 700, color: v.severity === 'critical' ? RED : AMBER }}>[{v.severity.toUpperCase()}]</span>{' '}
                                {v.message}
                                {v.suggested_fix && <span style={{ color: SUBTLE }}>  {v.suggested_fix}</span>}
                              </div>
                            ))}
                          </div>
                          {result.compliance.status === 'blocked' && (
                            <div style={{ marginTop: 8 }}>
                              <Btn onClick={handleApplyFix} color="green" testId="apply-fix-button">
                                {fileName.includes('demo') ? 'Apply Suggested Fix (Demo)' : 'Fix-It: Demo Only'}
                              </Btn>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Ticket */}
                  {ticket && (
                    <Card testId="ticket-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <SectionTitle>TRADE TICKET: {ticket.hedge_name}</SectionTitle>
                        <Btn onClick={() => navigator.clipboard.writeText(JSON.stringify(ticket, null, 2))} testId="copy-ticket">
                          COPY JSON
                        </Btn>
                      </div>
                      <pre style={{ fontSize: 10, color: TEXT, fontFamily: MONO, background: BG, padding: '6px 8px', borderRadius: 2, overflowX: 'auto', maxHeight: 180 }} data-testid="ticket-json">
                        {JSON.stringify(ticket, null, 2)}
                      </pre>
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Right: Tool Trace */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="trace-column">
              <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>TOOL TRACE</div>
              {(!result || result.tool_trace.length === 0) && (
                <div style={{ fontSize: 10, color: SUBTLE }}>No trace yet.</div>
              )}
              {result?.tool_trace.map((t: any, i: number) => (
                <div key={i} style={{ background: t.status === 'ok' ? GREEN + '11' : RED + '11', border: `1px solid ${t.status === 'ok' ? GREEN + '44' : RED + '44'}`, borderRadius: 2, padding: '5px 7px' }} data-testid={`trace-${t.tool_id}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEXT }}>{t.tool_id}: {t.tool_name}</span>
                    <span style={{ fontSize: 9, color: t.status === 'ok' ? GREEN : RED }}>{t.status === 'ok' ? '' : ''} {t.duration_ms}ms</span>
                  </div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.outputs_summary}</div>
                </div>
              ))}
              {result && result.tool_trace.length > 0 && (
                <button onClick={() => downloadBlob(result.tool_trace, `trace-${result.run_id}.json`)}
                  style={{ fontSize: 9, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: MONO, textAlign: 'left', marginTop: 4 }}
                  data-testid="download-trace">
                  Download Trace JSON
                </button>
              )}
            </div>
          </div>
        )}

        {/* RUNS TAB */}
        {activeTab === 'runs' && (
          <div data-testid="runs-tab" role="tabpanel" id="riskdesk-tabpanel-runs">
            <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', marginBottom: 8 }}>RUN HISTORY</div>
            {runHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }} data-testid="runs-empty-state">
                <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 8 }}>No runs yet.</div>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 12 }}>Execute your first risk analysis from the Run tab to see results here.</div>
                <button onClick={() => setActiveTab('run')} style={{ fontSize: 10, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: MONO }} data-testid="runs-empty-goto-run">
                  Go to Run tab 
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {runHistory.map((run, idx) => (
                  <div key={run.run_id} onClick={() => handleViewRun(run)}
                    style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '8px 10px', cursor: 'pointer' }}
                    data-testid={`run-history-item-${idx}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }} data-testid="run-history-run-id">{run.run_id}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', background: run.ok ? GREEN + '22' : RED + '22', color: run.ok ? GREEN : RED, border: `1px solid ${run.ok ? GREEN + '44' : RED + '44'}`, borderRadius: 2 }}>{run.ok ? 'OK' : 'FAILED'}</span>
                    </div>
                    {run.stress && <div style={{ fontSize: 10, color: SUBTLE }}>Scenario: {run.stress.scenario.label}</div>}
                    {run.compliance && <div style={{ fontSize: 10, color: SUBTLE }}>Compliance: {run.compliance.status}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div data-testid="export-tab" role="tabpanel" id="riskdesk-tabpanel-export">
            <span data-testid="riskdesk-export-ready" style={{ display: 'none' }}></span>
            <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', marginBottom: 10 }}>EXPORT RISK DESK DATA</div>
            {!result && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 12 }}>No risk run available. Execute a run first to enable exports.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
              {[
                {
                  title: 'Risk Run Result',
                  desc: 'Complete pipeline output including greeks, stress test, compliance, and verification.',
                  disabled: !result,
                  onClick: () => result && downloadBlob(result, `risk_run-${result.run_id}.json`),
                  label: 'Download risk_run.json',
                  testId: 'export-risk-run',
                  color: 'blue',
                },
                {
                  title: 'Tool Trace Timeline',
                  desc: 'Execution timeline for all 5 tools (T1-T5) with timing and outputs.',
                  disabled: !result || !result?.tool_trace.length,
                  onClick: () => result && downloadBlob(result.tool_trace, `tool_trace-${result.run_id}.json`),
                  label: 'Download tool_trace.json',
                  testId: 'export-tool-trace',
                  color: 'blue',
                },
                {
                  title: 'Trade Ticket',
                  desc: ticket ? `Generated trade ticket for hedge: ${ticket.hedge_name}` : 'Generate a ticket first from the Run tab',
                  disabled: !ticket,
                  onClick: () => ticket && downloadBlob(ticket, `ticket-${ticket.hedge_name}.json`),
                  label: 'Download ticket.json',
                  testId: 'export-ticket',
                  color: 'blue',
                },
              ].map(item => (
                <Card key={item.title}>
                  <SectionTitle>{item.title}</SectionTitle>
                  <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8 }}>{item.desc}</div>
                  <Btn onClick={item.onClick} disabled={item.disabled} color={item.color as any} testId={item.testId}>
                    {item.label}
                  </Btn>
                </Card>
              ))}

              <Card>
                <SectionTitle>Complete Export Bundle (v1.22)</SectionTitle>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8 }}>Institutional-grade ZIP archive with all artifacts, portfolio data, and SHA256 manifest.</div>
                <Btn
                  disabled={!result}
                  color="purple"
                  testId="export-bundle-zip"
                  onClick={async () => {
                    if (!result) return;
                    try {
                      const blob = await RiskDeskAPI.exportRiskRun(result.run_id);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `risk-export-${result.run_id}.zip`; a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error('[Risk Desk] Export failed:', err);
                    }
                  }}
                >
                  Download ZIP Bundle
                </Btn>
              </Card>

              <Card>
                <SectionTitle>Playwright Test Report</SectionTitle>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8 }}>Local HTML report with videos, traces, and screenshots.</div>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '6px 8px', fontSize: 10, fontFamily: MONO, color: TEXT }}>
                  <div>Path: frontend/playwright-report/</div>
                  <div style={{ marginTop: 3 }}>Command: <span style={{ color: BLUE }}>npx playwright show-report</span></div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}