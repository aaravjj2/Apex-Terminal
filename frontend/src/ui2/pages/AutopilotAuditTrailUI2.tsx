import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface AuditEntry {
  id: string;
  timestamp: string;
  cycleId: string;
  phase: string;
  action: string;
  details: string;
  symbol: string;
  decision: string;
  confidence: number;
  signals: string[];
  outcome: string;
  pnl: number | null;
  riskScore: number;
  tags: string[];
}

const PHASES = ['Signal Detection', 'Analysis', 'Decision', 'Execution', 'Monitoring', 'Exit'];
const DECISIONS = ['Enter Long', 'Enter Short', 'Hold', 'Scale Up', 'Scale Down', 'Exit', 'Skip', 'Override'];
const TAGS = ['momentum', 'mean-reversion', 'breakout', 'risk-limit', 'regime-change', 'earnings', 'macro', 'technical', 'fundamental'];

function generateAuditEntries(count: number): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'JPM', 'XOM', 'AMZN', 'META', 'SPY'];
  let cycleNum = 1000;
  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - count);

  for (let i = 0; i < count; i++) {
    const t = new Date(baseTime.getTime() + i * 3600000 + Math.random() * 1800000);
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const phase = PHASES[Math.floor(Math.random() * PHASES.length)];
    const decision = DECISIONS[Math.floor(Math.random() * DECISIONS.length)];
    const confidence = 0.4 + Math.random() * 0.55;
    const hasPnl = phase === 'Exit' || Math.random() > 0.7;
    const pnl = hasPnl ? (Math.random() - 0.4) * 5000 : null;
    const riskScore = Math.random() * 10;
    const numSignals = 1 + Math.floor(Math.random() * 4);
    const signals = Array.from({ length: numSignals }, () => {
      const signalTypes = ['RSI oversold', 'MACD cross', 'Volume spike', 'Price breakout', 'Support bounce', 'Resistance test',
        'EMA cross 50/200', 'Bollinger squeeze', 'VWAP reclaim', 'Dark pool print', 'News sentiment shift',
        'Sector rotation', 'Unusual options flow', 'Insider activity', 'Earnings surprise'];
      return signalTypes[Math.floor(Math.random() * signalTypes.length)];
    });
    const numTags = 1 + Math.floor(Math.random() * 3);
    const tags = Array.from(new Set(Array.from({ length: numTags }, () => TAGS[Math.floor(Math.random() * TAGS.length)])));
    const outcomes = ['Executed', 'Pending', 'Completed', 'Cancelled', 'Partial Fill', 'Risk Blocked'];
    const actions = [
      `${phase}: ${decision} ${symbol}`,
      `Autopilot cycle ${cycleNum} — ${phase.toLowerCase()} phase`,
      `Signal detected: ${signals[0]} on ${symbol}`,
      `Position sizing calculated for ${symbol}`,
      `Risk check: ${riskScore < 5 ? 'PASSED' : 'WARNING'}`,
    ];

    if (i % 6 === 0) cycleNum++;

    entries.push({
      id: `AE-${String(i + 1).padStart(4, '0')}`,
      timestamp: t.toISOString().replace('T', ' ').slice(0, 19),
      cycleId: `CYC-${cycleNum}`,
      phase,
      action: actions[Math.floor(Math.random() * actions.length)],
      details: `${decision} signal with ${(confidence * 100).toFixed(0)}% confidence. ${signals.join(', ')}.`,
      symbol,
      decision,
      confidence,
      signals,
      outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
      pnl,
      riskScore,
      tags,
    });
  }
  return entries.reverse();
}

const TABS = ['Audit Log', 'Cycle View', 'Decision Trail', 'Compliance', 'Analytics'];

export default function AutopilotAuditTrailUI2() {
  const [tab, setTab] = useState(TABS[0]);
  const [entries] = useState(() => generateAuditEntries(80));
  const [filterPhase, setFilterPhase] = useState('All');
  const [filterSymbol, setFilterSymbol] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  const filtered = entries.filter(e => {
    if (filterPhase !== 'All' && e.phase !== filterPhase) return false;
    if (filterSymbol !== 'All' && e.symbol !== filterSymbol) return false;
    if (searchText && !e.action.toLowerCase().includes(searchText.toLowerCase()) && !e.details.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const symbols = [...new Set(entries.map(e => e.symbol))].sort();
  const cycles = [...new Set(entries.map(e => e.cycleId))];

  // Analytics
  const totalDecisions = entries.filter(e => e.phase === 'Decision').length;
  const positiveOutcomes = entries.filter(e => e.pnl !== null && e.pnl > 0).length;
  const negativeOutcomes = entries.filter(e => e.pnl !== null && e.pnl < 0).length;
  const avgConfidence = entries.reduce((a, e) => a + e.confidence, 0) / entries.length;
  const totalPnL = entries.reduce((a, e) => a + (e.pnl || 0), 0);
  const riskBlocked = entries.filter(e => e.outcome === 'Risk Blocked').length;
  const overrides = entries.filter(e => e.decision === 'Override').length;

  // Phase breakdown
  const phaseBreakdown: Record<string, number> = {};
  entries.forEach(e => { phaseBreakdown[e.phase] = (phaseBreakdown[e.phase] || 0) + 1; });

  const phaseColors: Record<string, string> = {
    'Signal Detection': '#4fc3f7', 'Analysis': CYAN, 'Decision': AMBER,
    'Execution': GREEN, 'Monitoring': '#ab47bc', 'Exit': RED,
  };

  const cellStyle: React.CSSProperties = { padding: '5px 8px', borderBottom: `1px solid ${BORDER}`, fontSize: 10 };
  const headerStyle: React.CSSProperties = { ...cellStyle, background: '#1a1a1a', color: DIM, fontWeight: 'bold', position: 'sticky' as const, top: 0, fontSize: 9 };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📋 AUDIT TRAIL</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 8px', background: tab === t ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{t}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search audit log..."
            style={{ padding: '3px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 10, width: 150 }} />
          <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)}
            style={{ padding: '3px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 10 }}>
            <option>All</option>
            {PHASES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)}
            style={{ padding: '3px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 10 }}>
            <option>All</option>
            {symbols.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', padding: '4px 16px', gap: 16, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', fontSize: 10 }}>
        <span style={{ color: DIM }}>Entries: <span style={{ color: WHITE }}>{entries.length}</span></span>
        <span style={{ color: DIM }}>Cycles: <span style={{ color: AMBER }}>{cycles.length}</span></span>
        <span style={{ color: DIM }}>Decisions: <span style={{ color: CYAN }}>{totalDecisions}</span></span>
        <span style={{ color: DIM }}>Win/Loss: <span style={{ color: GREEN }}>{positiveOutcomes}</span>/<span style={{ color: RED }}>{negativeOutcomes}</span></span>
        <span style={{ color: DIM }}>P&L: <span style={{ color: totalPnL >= 0 ? GREEN : RED }}>{totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(0)}</span></span>
        <span style={{ color: DIM }}>Risk Blocked: <span style={{ color: RED }}>{riskBlocked}</span></span>
        <span style={{ color: DIM }}>Overrides: <span style={{ color: AMBER }}>{overrides}</span></span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {tab === 'Audit Log' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'Timestamp', 'Cycle', 'Phase', 'Symbol', 'Action', 'Confidence', 'Outcome', 'P&L', 'Risk'].map(h => (
                    <th key={h} style={headerStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} onClick={() => setSelectedEntry(e)} style={{
                    cursor: 'pointer', background: selectedEntry?.id === e.id ? 'rgba(245,166,35,0.05)' : 'transparent'
                  }}>
                    <td style={{ ...cellStyle, color: DIM }}>{e.id}</td>
                    <td style={{ ...cellStyle, color: TEXT, fontSize: 9 }}>{e.timestamp}</td>
                    <td style={{ ...cellStyle, color: CYAN }}>{e.cycleId}</td>
                    <td style={cellStyle}>
                      <span style={{ padding: '1px 4px', background: `${phaseColors[e.phase] || DIM}20`, color: phaseColors[e.phase] || DIM, fontSize: 9 }}>{e.phase}</span>
                    </td>
                    <td style={{ ...cellStyle, color: AMBER, fontWeight: 'bold' }}>{e.symbol}</td>
                    <td style={{ ...cellStyle, color: TEXT, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.action}</td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 30, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                          <div style={{ width: `${e.confidence * 100}%`, height: '100%', background: e.confidence > 0.7 ? GREEN : e.confidence > 0.5 ? AMBER : RED, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9 }}>{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <span style={{
                        color: e.outcome === 'Executed' || e.outcome === 'Completed' ? GREEN :
                          e.outcome === 'Risk Blocked' ? RED : e.outcome === 'Cancelled' ? '#ff9800' : TEXT,
                        fontSize: 9
                      }}>{e.outcome}</span>
                    </td>
                    <td style={{ ...cellStyle, color: e.pnl === null ? DIM : e.pnl >= 0 ? GREEN : RED }}>
                      {e.pnl !== null ? `${e.pnl >= 0 ? '+' : ''}$${e.pnl.toFixed(0)}` : '—'}
                    </td>
                    <td style={cellStyle}>
                      <span style={{ color: e.riskScore > 7 ? RED : e.riskScore > 4 ? AMBER : GREEN, fontSize: 9 }}>
                        {e.riskScore.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'Cycle View' && (
            <div style={{ padding: 8 }}>
              {cycles.slice(0, 15).map(cycleId => {
                const cycleEntries = entries.filter(e => e.cycleId === cycleId);
                const cyclePnL = cycleEntries.reduce((a, e) => a + (e.pnl || 0), 0);
                const isExpanded = expandedCycle === cycleId;
                return (
                  <div key={cycleId} style={{ marginBottom: 4, background: PANEL, border: `1px solid ${BORDER}` }}>
                    <div onClick={() => setExpandedCycle(isExpanded ? null : cycleId)} style={{
                      display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', gap: 12
                    }}>
                      <span style={{ color: isExpanded ? AMBER : DIM }}>{isExpanded ? '▼' : '▶'}</span>
                      <span style={{ color: CYAN, fontWeight: 'bold' }}>{cycleId}</span>
                      <span style={{ color: DIM }}>({cycleEntries.length} entries)</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {PHASES.map(p => {
                          const has = cycleEntries.some(e => e.phase === p);
                          return <span key={p} style={{ width: 8, height: 8, borderRadius: '50%', background: has ? phaseColors[p] : '#1a1a1a' }} />;
                        })}
                      </div>
                      <span style={{ marginLeft: 'auto', color: cyclePnL >= 0 ? GREEN : RED, fontSize: 10 }}>
                        P&L: {cyclePnL >= 0 ? '+' : ''}${cyclePnL.toFixed(0)}
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0 12px 8px' }}>
                        {cycleEntries.map(e => (
                          <div key={e.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: `1px solid ${BORDER}`, fontSize: 10 }}>
                            <span style={{ color: DIM, width: 50 }}>{e.timestamp.slice(11, 19)}</span>
                            <span style={{ padding: '0 4px', background: `${phaseColors[e.phase]}20`, color: phaseColors[e.phase], width: 100 }}>{e.phase}</span>
                            <span style={{ color: AMBER, width: 40 }}>{e.symbol}</span>
                            <span style={{ color: TEXT, flex: 1 }}>{e.action}</span>
                            <span style={{ color: e.pnl !== null ? (e.pnl >= 0 ? GREEN : RED) : DIM, width: 60, textAlign: 'right' }}>
                              {e.pnl !== null ? `$${e.pnl.toFixed(0)}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Decision Trail' && (
            <div style={{ padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>DECISION FLOW</div>
              {entries.filter(e => e.phase === 'Decision').slice(0, 20).map((e, idx) => (
                <div key={e.id} style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
                  {/* Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.pnl !== null ? (e.pnl >= 0 ? GREEN : RED) : AMBER, flexShrink: 0 }} />
                    {idx < 19 && <div style={{ width: 1, flex: 1, background: BORDER }} />}
                  </div>
                  {/* Content */}
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 12px', flex: 1, marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: AMBER, fontWeight: 'bold' }}>{e.symbol} — {e.decision}</span>
                      <span style={{ color: DIM, fontSize: 9 }}>{e.timestamp} | {e.cycleId}</span>
                    </div>
                    <div style={{ color: TEXT, fontSize: 10, marginBottom: 4 }}>{e.details}</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                      <span style={{ color: DIM }}>Conf: <span style={{ color: e.confidence > 0.7 ? GREEN : AMBER }}>{(e.confidence * 100).toFixed(0)}%</span></span>
                      <span style={{ color: DIM }}>Risk: <span style={{ color: e.riskScore > 7 ? RED : GREEN }}>{e.riskScore.toFixed(1)}</span></span>
                      <span style={{ color: DIM }}>Result: <span style={{ color: e.pnl !== null ? (e.pnl >= 0 ? GREEN : RED) : DIM }}>{e.pnl !== null ? `$${e.pnl.toFixed(0)}` : 'pending'}</span></span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {e.tags.map(tag => (
                          <span key={tag} style={{ padding: '0 4px', background: '#1a1a1a', color: CYAN, fontSize: 8 }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Compliance' && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>COMPLIANCE SCORE</div>
                  <div style={{ color: GREEN, fontSize: 36, fontWeight: 'bold' }}>97.2%</div>
                  <div style={{ color: DIM, fontSize: 9 }}>Above 95% threshold</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>RISK BLOCKS</div>
                  <div style={{ color: RED, fontSize: 36, fontWeight: 'bold' }}>{riskBlocked}</div>
                  <div style={{ color: DIM, fontSize: 9 }}>Trades prevented by limits</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>MANUAL OVERRIDES</div>
                  <div style={{ color: AMBER, fontSize: 36, fontWeight: 'bold' }}>{overrides}</div>
                  <div style={{ color: DIM, fontSize: 9 }}>Human intervention events</div>
                </div>
              </div>

              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>COMPLIANCE CHECKS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Check', 'Status', 'Last Verified', 'Details'].map(h => (
                      <th key={h} style={headerStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { check: 'Position Size Limits', status: 'PASS', time: '2 min ago', detail: 'All positions within limits' },
                    { check: 'Sector Concentration', status: 'PASS', time: '2 min ago', detail: 'Tech at 32% (limit: 35%)' },
                    { check: 'Daily Loss Limit', status: 'PASS', time: '5 min ago', detail: 'Loss: -$1,950 (limit: -$10,000)' },
                    { check: 'Leverage Ratio', status: 'PASS', time: '5 min ago', detail: 'Gross: 0.38x (limit: 2.0x)' },
                    { check: 'Order Rate Limit', status: 'PASS', time: '1 min ago', detail: '12 orders/hr (limit: 100)' },
                    { check: 'Market Hours', status: 'PASS', time: 'Real-time', detail: 'Regular session active' },
                    { check: 'Circuit Breaker', status: 'PASS', time: 'Real-time', detail: 'No halt conditions' },
                    { check: 'Wash Sale Prevention', status: 'WARN', time: '15 min ago', detail: 'TSLA flagged — exit 28 days ago' },
                    { check: 'Pattern Day Trading', status: 'PASS', time: '30 min ago', detail: '2 day trades (limit: 3)' },
                    { check: 'Best Execution', status: 'PASS', time: '10 min ago', detail: 'All fills within NBBO' },
                  ].map((c, i) => (
                    <tr key={i}>
                      <td style={{ ...cellStyle, color: TEXT }}>{c.check}</td>
                      <td style={cellStyle}>
                        <span style={{
                          padding: '1px 6px',
                          background: c.status === 'PASS' ? 'rgba(38,166,154,0.15)' : c.status === 'WARN' ? 'rgba(245,166,35,0.15)' : 'rgba(239,83,80,0.15)',
                          color: c.status === 'PASS' ? GREEN : c.status === 'WARN' ? AMBER : RED,
                          fontSize: 9
                        }}>{c.status}</span>
                      </td>
                      <td style={{ ...cellStyle, color: DIM }}>{c.time}</td>
                      <td style={{ ...cellStyle, color: TEXT }}>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Analytics' && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>AVG CONFIDENCE</div>
                  <div style={{ color: avgConfidence > 0.6 ? GREEN : AMBER, fontSize: 22, fontWeight: 'bold' }}>{(avgConfidence * 100).toFixed(1)}%</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>WIN RATE</div>
                  <div style={{ color: GREEN, fontSize: 22, fontWeight: 'bold' }}>{positiveOutcomes + negativeOutcomes > 0 ? ((positiveOutcomes / (positiveOutcomes + negativeOutcomes)) * 100).toFixed(1) : 0}%</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>TOTAL P&L</div>
                  <div style={{ color: totalPnL >= 0 ? GREEN : RED, fontSize: 22, fontWeight: 'bold' }}>${totalPnL.toFixed(0)}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>AVG RISK SCORE</div>
                  <div style={{ color: AMBER, fontSize: 22, fontWeight: 'bold' }}>{(entries.reduce((a, e) => a + e.riskScore, 0) / entries.length).toFixed(1)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Phase distribution */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 12 }}>PHASE DISTRIBUTION</div>
                  {PHASES.map(p => {
                    const count = phaseBreakdown[p] || 0;
                    const pct = (count / entries.length) * 100;
                    return (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 100, color: phaseColors[p], fontSize: 10 }}>{p}</span>
                        <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 4 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: phaseColors[p], borderRadius: 4, opacity: 0.7 }} />
                        </div>
                        <span style={{ color: TEXT, width: 50, textAlign: 'right', fontSize: 10 }}>{count} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>

                {/* Decision breakdown */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 12 }}>DECISION BREAKDOWN</div>
                  {DECISIONS.map(d => {
                    const count = entries.filter(e => e.decision === d).length;
                    if (count === 0) return null;
                    const pct = (count / entries.length) * 100;
                    const color = d.includes('Long') || d === 'Scale Up' ? GREEN : d.includes('Short') || d === 'Exit' ? RED : AMBER;
                    return (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 80, color, fontSize: 10 }}>{d}</span>
                        <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 4 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.6 }} />
                        </div>
                        <span style={{ color: TEXT, width: 50, textAlign: 'right', fontSize: 10 }}>{count} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedEntry && tab === 'Audit Log' && (
          <div style={{ width: 300, borderLeft: `1px solid ${BORDER}`, padding: 12, overflowY: 'auto', background: '#0d0d0d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: AMBER, fontWeight: 'bold' }}>{selectedEntry.id}</span>
              <button onClick={() => setSelectedEntry(null)} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {[
              { label: 'Timestamp', value: selectedEntry.timestamp },
              { label: 'Cycle', value: selectedEntry.cycleId, color: CYAN },
              { label: 'Phase', value: selectedEntry.phase, color: phaseColors[selectedEntry.phase] },
              { label: 'Symbol', value: selectedEntry.symbol, color: AMBER },
              { label: 'Decision', value: selectedEntry.decision },
              { label: 'Confidence', value: `${(selectedEntry.confidence * 100).toFixed(0)}%`, color: selectedEntry.confidence > 0.7 ? GREEN : AMBER },
              { label: 'Outcome', value: selectedEntry.outcome },
              { label: 'Risk Score', value: selectedEntry.riskScore.toFixed(1), color: selectedEntry.riskScore > 7 ? RED : GREEN },
              { label: 'P&L', value: selectedEntry.pnl !== null ? `$${selectedEntry.pnl.toFixed(0)}` : '—', color: selectedEntry.pnl !== null ? (selectedEntry.pnl >= 0 ? GREEN : RED) : DIM },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ marginBottom: 6 }}>
                <div style={{ color: DIM, fontSize: 9 }}>{label}</div>
                <div style={{ color: color || TEXT, fontSize: 11 }}>{value}</div>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: DIM, fontSize: 9, marginBottom: 2 }}>Signals</div>
              {selectedEntry.signals.map((s, i) => (
                <div key={i} style={{ color: CYAN, fontSize: 10, padding: '1px 0' }}>• {s}</div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ color: DIM, fontSize: 9, marginBottom: 2 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {selectedEntry.tags.map(t => (
                  <span key={t} style={{ padding: '1px 4px', background: '#1a1a1a', color: AMBER, fontSize: 8 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ color: DIM, fontSize: 9, marginBottom: 2 }}>Details</div>
              <div style={{ color: TEXT, fontSize: 10, lineHeight: 1.4 }}>{selectedEntry.details}</div>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Showing {filtered.length} of {entries.length} entries</span>
        <span style={{ color: GREEN }}>Compliance: 97.2%</span>
        <span style={{ color: DIM }}>Autopilot Audit Trail v2.0</span>
      </div>
    </div>
  );
}
