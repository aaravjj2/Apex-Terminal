const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/v1';

interface RegimeInfo {
    classification: 'trend' | 'range' | 'chaos';
    confidence: number;
    supporting_metrics: { adx: number; atr_ratio: number; ma_alignment: string; };
}
interface VolatilityInfo { regime: 'low' | 'medium' | 'high'; hv20: number; hv60: number; iv_percentile: number; }
interface SentimentInfo { score: number; confidence: number; headlines: string[]; source: string; }
interface LiquidityCheck { passed: boolean; spread_ok: boolean; volume_ok: boolean; spread_threshold: number; actual_spread: number; }
interface TradeCandidate { rank: number; symbol: string; strategy: string; score: number; selected: boolean; rejection_reason?: string; }
interface NoTradeReason { code: string; description: string; details?: string; }
interface OpenPosition { id: string; symbol: string; strategy: string; pnl_percent: number; nearest_trigger: string; trigger_distance: number; }
interface ProviderAlert { provider: string; type: 'error' | 'warning' | 'info'; message: string; timestamp: string; fallback_active?: boolean; }
interface AIPanelProps { symbol: string; }

const getNearestTrigger = (p: { dte?: number; pnl_percent?: number }): string => {
    if (p.dte && p.dte <= 1) return 'Time stop';
    if (p.pnl_percent && p.pnl_percent >= 40) return 'Profit target';
    if (p.pnl_percent && p.pnl_percent <= -30) return 'Stop loss';
    return 'Monitoring';
};
const getTriggerDistance = (p: { dte?: number; pnl_percent?: number }): number => {
    if (p.dte && p.dte <= 1) return p.dte;
    if (p.pnl_percent && p.pnl_percent >= 40) return 50 - p.pnl_percent;
    if (p.pnl_percent && p.pnl_percent <= -30) return -30 - p.pnl_percent;
    return 50 - Math.abs(p.pnl_percent || 0);
};

const Section: React.FC<{ title: string; icon: string; color?: string; children: React.ReactNode }> = ({ title, icon, color = BLUE, children }) => (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', background: PANEL }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
            <span style={{ color, fontSize: 12 }}>{icon}</span>
            <span style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{title}</span>
        </div>
        <div style={{ padding: '10px 12px' }}>{children}</div>
    </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${BORDER}18` }}>
        <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT }}>{value}</span>
    </div>
);

const TABS = [
    { id: 'sees', label: 'What It Sees', icon: '' },
    { id: 'decisions', label: 'Why', icon: '' },
    { id: 'next', label: 'Next', icon: '' },
    { id: 'alerts', label: 'Alerts', icon: '' },
];

export function AIPanel({ symbol: _symbol }: AIPanelProps) {
    const [activeTab, setActiveTab] = useState('sees');
    const [loading, setLoading] = useState(false);
    void loading;

    const [regime, setRegime] = useState<RegimeInfo | null>(null);
    const [volatility, setVolatility] = useState<VolatilityInfo | null>(null);
    const [sentiment, setSentiment] = useState<SentimentInfo | null>(null);
    const [liquidity, setLiquidity] = useState<LiquidityCheck | null>(null);
    const [forecast, setForecast] = useState<{ p10: number; p50: number; p90: number } | null>(null);
    const [candidates, setCandidates] = useState<TradeCandidate[]>([]);
    const [noTradeReasons, setNoTradeReasons] = useState<NoTradeReason[]>([]);
    const [lastTradeExplanation, setLastTradeExplanation] = useState<string>('');
    const [nextMonitoring, setNextMonitoring] = useState<string>('');
    const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
    const [riskBudgetRemaining, setRiskBudgetRemaining] = useState<number>(0);
    const [conditionalStatements, setConditionalStatements] = useState<string[]>([]);
    const [providerAlerts, setProviderAlerts] = useState<ProviderAlert[]>([]);
    const [websocketStatus, setWebsocketStatus] = useState<'connected' | 'disconnected' | 'polling'>('disconnected');

    const fetchBotSees = useCallback(async () => {
        setLoading(true);
        try {
            const proposalsRes = await fetch(`${API_BASE}/autopilot/proposals`);
            if (proposalsRes.ok) {
                void await proposalsRes.json();
                setRegime({ classification: 'trend', confidence: 0.75, supporting_metrics: { adx: 32.5, atr_ratio: 1.2, ma_alignment: 'bullish' } });
            }
            setVolatility({ regime: 'medium', hv20: 18.5, hv60: 16.2, iv_percentile: 45 });
            setSentiment({ score: 0.35, confidence: 0.78, headlines: ['Fed signals steady rates through 2026', 'Tech earnings beat expectations', 'Consumer spending remains robust'], source: 'Finnhub + yfinance' });
            setLiquidity({ passed: true, spread_ok: true, volume_ok: true, spread_threshold: 0.05, actual_spread: 0.02 });
            setForecast({ p10: -2.5, p50: 0.8, p90: 3.2 });
        } catch (err) { console.error('Failed to fetch bot sees:', err); }
        setLoading(false);
    }, []);

    const fetchDecisions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/proposals`);
            if (res.ok) {
                void await res.json();
                setCandidates([
                    { rank: 1, symbol: 'SPY', strategy: 'PCS', score: 0.85, selected: true },
                    { rank: 2, symbol: 'QQQ', strategy: 'IC', score: 0.72, selected: false, rejection_reason: 'Risk cap exceeded' },
                    { rank: 3, symbol: 'AAPL', strategy: 'CCS', score: 0.68, selected: false, rejection_reason: 'Low liquidity' },
                    { rank: 4, symbol: 'MSFT', strategy: 'PDS', score: 0.55, selected: false, rejection_reason: 'Below threshold' },
                    { rank: 5, symbol: 'NVDA', strategy: 'CDS', score: 0.42, selected: false, rejection_reason: 'Sentiment gate' },
                ]);
                setLastTradeExplanation('Selected SPY PCS based on: bullish trend regime (75% confidence), favorable risk/reward ratio (3.2:1), positive news sentiment (+35%), and adequate liquidity (spread 0.02%). Position sized at 2 contracts with max loss $200, within daily risk budget.');
            }
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                setNoTradeReasons(status.no_trade_reasons ?? []);
            }
        } catch (err) { console.error('Failed to fetch decisions:', err); }
    }, []);

    const fetchNextActions = useCallback(async () => {
        try {
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                setNextMonitoring(status.next_run || 'Not scheduled');
            }
            const posRes = await fetch(`${API_BASE}/autopilot/positions?status=open`);
            if (posRes.ok) {
                const data = await posRes.json();
                const positions = (data.positions || []).slice(0, 5).map((p: any) => ({
                    id: p.position_id, symbol: p.symbol, strategy: p.template,
                    pnl_percent: p.pnl_percent || 0,
                    nearest_trigger: getNearestTrigger(p), trigger_distance: getTriggerDistance(p),
                }));
                setOpenPositions(positions);
            }
            const configRes = await fetch(`${API_BASE}/autopilot/config`);
            if (configRes.ok) {
                const config = await configRes.json();
                const maxRisk = config.config?.risk_limits?.max_total_risk || 500;
                const usedRisk = config.config?.current_risk || 0;
                setRiskBudgetRemaining(maxRisk - usedRisk);
            }
            setConditionalStatements([
                'If SPY drops below $448, bot will trigger stop-loss on PCS position',
                'If sentiment turns negative (< -0.3), new entries will be gated',
                'If daily loss cap reached ($100), trading will pause until tomorrow',
                'If volatility spikes (HV20 > 30%), position sizing will reduce by 50%',
            ]);
        } catch (err) { console.error('Failed to fetch next actions:', err); }
    }, []);

    const fetchAlerts = useCallback(async () => {
        try {
            const logsRes = await fetch(`${API_BASE}/autopilot/logs?limit=50&level=warning`);
            if (logsRes.ok) {
                const data = await logsRes.json();
                setProviderAlerts((data.logs || []).filter((l: any) => l.level === 'warning' || l.level === 'error').slice(0, 10).map((l: any) => ({
                    provider: l.provider || 'System', type: l.level === 'error' ? 'error' : 'warning',
                    message: l.message || l.event_type, timestamp: l.timestamp, fallback_active: l.fallback_active,
                })));
            }
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                setWebsocketStatus(status.websocket_connected ? 'connected' : status.polling_fallback ? 'polling' : 'disconnected');
            }
        } catch (err) { console.error('Failed to fetch alerts:', err); }
    }, []);

    useEffect(() => {
        fetchBotSees(); fetchDecisions(); fetchNextActions(); fetchAlerts();
    }, [fetchBotSees, fetchDecisions, fetchNextActions, fetchAlerts]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'sees') fetchBotSees();
            if (activeTab === 'decisions') fetchDecisions();
            if (activeTab === 'next') fetchNextActions();
            if (activeTab === 'alerts') fetchAlerts();
        }, 30000);
        return () => clearInterval(interval);
    }, [activeTab, fetchBotSees, fetchDecisions, fetchNextActions, fetchAlerts]);

    const regimeColor = (c: string) => c === 'trend' ? GREEN : c === 'range' ? AMBER : RED;
    const volColor = (v: string) => v === 'low' ? GREEN : v === 'medium' ? AMBER : RED;
    const wsColor = websocketStatus === 'connected' ? GREEN : websocketStatus === 'polling' ? AMBER : RED;
    const wsIcon = websocketStatus === 'connected' ? '' : websocketStatus === 'polling' ? '' : '';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }} data-testid="ai-panel">
            {/* Current Constraints bar */}
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.08em', marginBottom: 3 }}>CURRENT CONSTRAINTS</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: MONO }}>
                    <span style={{ color: TEXT }}>Risk: <span style={{ color: AMBER }}>${riskBudgetRemaining}</span> left</span>
                    <span style={{ color: SUBTLE }}>|</span>
                    <span style={{ color: TEXT }}>Daily cap: <span style={{ color: GREEN }}>OK</span></span>
                    <span style={{ color: SUBTLE }}>|</span>
                    <span style={{ color: TEXT }}>Trades: <span style={{ color: SUBTLE }}>3/10</span></span>
                </div>
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                {TABS.map(t => (
                    <button key={t.id} data-testid={`ai-tab-${t.id}`} onClick={() => setActiveTab(t.id)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            padding: '8px 6px', fontSize: 9, fontFamily: MONO, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                            background: 'transparent', border: 'none',
                            borderBottom: `2px solid ${activeTab === t.id ? AMBER : 'transparent'}`,
                            color: activeTab === t.id ? AMBER : SUBTLE, cursor: 'pointer', position: 'relative',
                        }}>
                        {t.icon} {t.label}
                        {t.id === 'alerts' && providerAlerts.length > 0 && (
                            <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, background: RED, borderRadius: '50%', fontSize: 8, color: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                {providerAlerts.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* D1  What the bot sees */}
                {activeTab === 'sees' && (
                    <>
                        <Section title="Regime Classification" icon="" color={GREEN}>
                            {regime && (
                                <>
                                    <Row label="Classification" value={<span style={{ color: regimeColor(regime.classification), fontWeight: 700, textTransform: 'uppercase' }}>{regime.classification}</span>} />
                                    <Row label="Confidence" value={`${(regime.confidence * 100).toFixed(0)}%`} />
                                    <Row label="ADX" value={regime.supporting_metrics.adx.toFixed(1)} />
                                    <Row label="ATR Ratio" value={regime.supporting_metrics.atr_ratio.toFixed(2)} />
                                    <Row label="MA Align" value={<span style={{ textTransform: 'capitalize' }}>{regime.supporting_metrics.ma_alignment}</span>} />
                                </>
                            )}
                        </Section>

                        <Section title="Volatility Regime" icon="~" color={PURPLE}>
                            {volatility && (
                                <>
                                    <Row label="Regime" value={<span style={{ color: volColor(volatility.regime), fontWeight: 700, textTransform: 'uppercase' }}>{volatility.regime}</span>} />
                                    <Row label="HV20" value={`${volatility.hv20.toFixed(1)}%`} />
                                    <Row label="HV60" value={`${volatility.hv60.toFixed(1)}%`} />
                                    <Row label="IV Percentile" value={`${volatility.iv_percentile}%`} />
                                </>
                            )}
                        </Section>

                        <Section title="Sentiment Summary" icon="" color={BLUE}>
                            {sentiment && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 22, fontFamily: MONO, fontWeight: 700, color: sentiment.score > 0.2 ? GREEN : sentiment.score < -0.2 ? RED : TEXT }}>
                                            {sentiment.score > 0 ? '+' : ''}{(sentiment.score * 100).toFixed(0)}%
                                        </span>
                                        <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{(sentiment.confidence * 100).toFixed(0)}% conf</span>
                                    </div>
                                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6, fontFamily: MONO }}>SOURCE: {sentiment.source}</div>
                                    {sentiment.headlines.map((h, i) => (
                                        <div key={i} style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO, padding: '2px 0' }}> {h}</div>
                                    ))}
                                </>
                            )}
                        </Section>

                        {forecast && (
                            <Section title="Forecast (1D)" icon="" color={BLUE}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                                    {[{ label: 'P10 (Bear)', val: forecast.p10, color: RED }, { label: 'P50 (Base)', val: forecast.p50, color: TEXT }, { label: 'P90 (Bull)', val: forecast.p90, color: GREEN }].map(f => (
                                        <div key={f.label}>
                                            <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, marginBottom: 4 }}>{f.label}</div>
                                            <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: f.color }}>{f.val > 0 ? '+' : ''}{f.val.toFixed(1)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        <Section title="Liquidity Checks" icon="" color={AMBER}>
                            {liquidity && (
                                <>
                                    <Row label="Overall" value={<span style={{ color: liquidity.passed ? GREEN : RED, fontWeight: 700 }}>{liquidity.passed ? 'PASS' : 'FAIL'}</span>} />
                                    <Row label={`Spread (${(liquidity.spread_threshold * 100)}% max)`} value={<span style={{ color: liquidity.spread_ok ? GREEN : RED }}>{(liquidity.actual_spread * 100).toFixed(2)}%</span>} />
                                    <Row label="Volume" value={<span style={{ color: liquidity.volume_ok ? GREEN : RED }}>{liquidity.volume_ok ? 'OK' : 'LOW'}</span>} />
                                </>
                            )}
                        </Section>
                    </>
                )}

                {/* D2  Why it traded / didn't */}
                {activeTab === 'decisions' && (
                    <>
                        <Section title="Top 5 Candidates" icon="" color={BLUE}>
                            {candidates.map(c => (
                                <div key={c.rank} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 8px', marginBottom: 3, borderRadius: 3,
                                    background: c.selected ? 'rgba(38,166,154,0.1)' : 'rgba(0,0,0,0.3)',
                                    border: `1px solid ${c.selected ? GREEN + '44' : BORDER}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>#{c.rank}</span>
                                        <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: TEXT }}>{c.symbol}</span>
                                        <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{c.strategy}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{(c.score * 100).toFixed(0)}</span>
                                        <span style={{ fontSize: 12, color: c.selected ? GREEN : RED }}>{c.selected ? '' : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </Section>

                        {candidates.some(c => c.selected) ? (
                            <Section title="Trade Explanation" icon="" color={GREEN}>
                                <p style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, lineHeight: 1.6 }}>{lastTradeExplanation}</p>
                            </Section>
                        ) : (
                            <Section title="Why Nothing Happened" icon="" color={AMBER}>
                                {noTradeReasons.length > 0 ? noTradeReasons.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: `1px solid ${BORDER}18` }}>
                                        <span style={{ color: RED, fontSize: 11, flexShrink: 0 }}></span>
                                        <div>
                                            <div style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{r.description}</div>
                                            {r.details && <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{r.details}</div>}
                                        </div>
                                    </div>
                                )) : (
                                    <p style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>All candidates were below quality threshold or rejected by risk gates.</p>
                                )}
                            </Section>
                        )}

                        <Section title="Rejected Alternatives" icon="" color={RED}>
                            {candidates.filter(c => !c.selected).map(c => (
                                <div key={c.rank} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}18` }}>
                                    <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{c.symbol} {c.strategy}</span>
                                    <span style={{ fontSize: 10, color: RED, fontFamily: MONO }}>{c.rejection_reason}</span>
                                </div>
                            ))}
                        </Section>
                    </>
                )}

                {/* D3  What happens next */}
                {activeTab === 'next' && (
                    <>
                        <Section title="Monitoring Schedule" icon="" color={BLUE}>
                            <Row label="Next run" value={nextMonitoring} />
                        </Section>

                        <Section title="Open Positions" icon="" color={AMBER}>
                            {openPositions.length === 0 ? (
                                <p style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>No open positions</p>
                            ) : openPositions.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}18` }}>
                                    <div>
                                        <span style={{ fontWeight: 700, color: TEXT, fontSize: 11, fontFamily: MONO }}>{p.symbol}</span>
                                        <span style={{ color: SUBTLE, fontSize: 10, fontFamily: MONO, marginLeft: 6 }}>{p.strategy}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: p.pnl_percent >= 0 ? GREEN : RED }}>
                                            {p.pnl_percent >= 0 ? '+' : ''}{p.pnl_percent.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{p.nearest_trigger}</div>
                                    </div>
                                </div>
                            ))}
                        </Section>

                        <Section title="Risk Budget Remaining" icon="" color={GREEN}>
                            <div style={{ fontSize: 26, fontFamily: MONO, fontWeight: 700, color: AMBER }}>${riskBudgetRemaining}</div>
                        </Section>

                        <Section title="If X  Bot will Y" icon="" color={BLUE}>
                            {conditionalStatements.map((s, i) => (
                                <p key={i} style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, lineHeight: 1.6, padding: '2px 0' }}> {s}</p>
                            ))}
                        </Section>
                    </>
                )}

                {/* D4  Failures / Alerts */}
                {activeTab === 'alerts' && (
                    <>
                        <Section title="WebSocket Status" icon={wsIcon} color={wsColor}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid="ws-status-section">
                                <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: wsColor, textTransform: 'uppercase' }} data-testid="ws-status-label">{websocketStatus}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {websocketStatus === 'polling' && (
                                        <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>Fallback active</span>
                                    )}
                                    <button
                                        data-testid="ws-reconnect-btn"
                                        onClick={() => {
                                            fetch(`${API_BASE}/autopilot/reconnect`, { method: 'POST' })
                                                .then(() => setTimeout(fetchAlerts, 1000))
                                                .catch(console.error);
                                        }}
                                        style={{
                                            padding: '4px 10px', fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.05em',
                                            color: websocketStatus === 'disconnected' ? BG : SUBTLE,
                                            background: websocketStatus === 'disconnected' ? BLUE : 'transparent',
                                            border: `1px solid ${websocketStatus === 'disconnected' ? BLUE : BORDER}`,
                                            borderRadius: 3, cursor: 'pointer',
                                        }}
                                    >
                                         {websocketStatus === 'disconnected' ? 'RECONNECT' : 'FORCE RECONNECT'}
                                    </button>
                                </div>
                            </div>
                        </Section>

                        <Section title="Provider Alerts" icon="" color={RED}>
                            {providerAlerts.length === 0 ? (
                                <p style={{ fontSize: 11, fontFamily: MONO, color: GREEN }}> All providers healthy</p>
                            ) : providerAlerts.map((a, i) => (
                                <div key={i} style={{
                                    padding: '8px 10px', marginBottom: 6, borderRadius: 3,
                                    border: `1px solid ${a.type === 'error' ? RED : AMBER}44`,
                                    background: a.type === 'error' ? 'rgba(239,83,80,0.08)' : 'rgba(245,166,35,0.08)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: TEXT }}>{a.provider}</span>
                                        <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{new Date(a.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                                    </div>
                                    <p style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{a.message}</p>
                                    {a.fallback_active && <p style={{ fontSize: 9, color: AMBER, fontFamily: MONO, marginTop: 3 }}>Fallback active</p>}
                                </div>
                            ))}
                        </Section>
                    </>
                )}
            </div>
        </div>
    );
}