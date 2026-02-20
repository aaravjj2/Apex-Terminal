/**
 * AI Panel (Section D)
 * 
 * Four tabs:
 * D1: "What the bot sees" - regime, volatility, sentiment, forecasts, liquidity
 * D2: "Why it traded / didn't trade" - candidates, decisions, rejections
 * D3: "What happens next" - monitoring schedule, open positions, risk budget
 * D4: "Failures / Alerts" - provider errors, unfilled orders, websocket status
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Eye, Brain, Clock, AlertTriangle, Activity, TrendingUp,
    BarChart3, Zap, CheckCircle2, XCircle,
    Wifi, WifiOff, RefreshCw, FileText, Info
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';

const API_BASE = 'http://127.0.0.1:8090/api/v1';

// Types
interface RegimeInfo {
    classification: 'trend' | 'range' | 'chaos';
    confidence: number;
    supporting_metrics: {
        adx: number;
        atr_ratio: number;
        ma_alignment: string;
    };
}

interface VolatilityInfo {
    regime: 'low' | 'medium' | 'high';
    hv20: number;
    hv60: number;
    iv_percentile: number;
}

interface SentimentInfo {
    score: number;
    confidence: number;
    headlines: string[];
    source: string;
}

interface LiquidityCheck {
    passed: boolean;
    spread_ok: boolean;
    volume_ok: boolean;
    spread_threshold: number;
    actual_spread: number;
}

interface TradeCandidate {
    rank: number;
    symbol: string;
    strategy: string;
    score: number;
    selected: boolean;
    rejection_reason?: string;
}

interface NoTradeReason {
    code: string;
    description: string;
    details?: string;
}

interface OpenPosition {
    id: string;
    symbol: string;
    strategy: string;
    pnl_percent: number;
    nearest_trigger: string;
    trigger_distance: number;
}

interface ProviderAlert {
    provider: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
    fallback_active?: boolean;
}

interface AIPanelProps {
    symbol: string;
}

// Helper functions - defined before component to avoid hoisting issues
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

export function AIPanel({ symbol: _symbol }: AIPanelProps) {
    const [activeTab, setActiveTab] = useState('sees');
    const [loading, setLoading] = useState(false);
    void loading; // Mark as used

    // D1: What the bot sees
    const [regime, setRegime] = useState<RegimeInfo | null>(null);
    const [volatility, setVolatility] = useState<VolatilityInfo | null>(null);
    const [sentiment, setSentiment] = useState<SentimentInfo | null>(null);
    const [liquidity, setLiquidity] = useState<LiquidityCheck | null>(null);
    const [forecast, setForecast] = useState<{ p10: number; p50: number; p90: number } | null>(null);

    // D2: Why it traded / didn't trade
    const [candidates, setCandidates] = useState<TradeCandidate[]>([]);
    const [noTradeReasons, setNoTradeReasons] = useState<NoTradeReason[]>([]);
    const [lastTradeExplanation, setLastTradeExplanation] = useState<string>('');

    // D3: What happens next
    const [nextMonitoring, setNextMonitoring] = useState<string>('');
    const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
    const [riskBudgetRemaining, setRiskBudgetRemaining] = useState<number>(0);
    const [conditionalStatements, setConditionalStatements] = useState<string[]>([]);

    // D4: Failures / Alerts
    const [providerAlerts, setProviderAlerts] = useState<ProviderAlert[]>([]);
    const [websocketStatus, setWebsocketStatus] = useState<'connected' | 'disconnected' | 'polling'>('disconnected');

    // Fetch data for D1
    const fetchBotSees = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch from proposals endpoint for regime/features
            const proposalsRes = await fetch(`${API_BASE}/autopilot/proposals`);
            if (proposalsRes.ok) {
                void await proposalsRes.json(); // Parse response but data mocked for now
                // Mock regime data for now
                setRegime({
                    classification: 'trend',
                    confidence: 0.75,
                    supporting_metrics: {
                        adx: 32.5,
                        atr_ratio: 1.2,
                        ma_alignment: 'bullish'
                    }
                });
            }

            // Mock volatility
            setVolatility({
                regime: 'medium',
                hv20: 18.5,
                hv60: 16.2,
                iv_percentile: 45
            });

            // Mock sentiment
            setSentiment({
                score: 0.35,
                confidence: 0.78,
                headlines: [
                    'Fed signals steady rates through 2026',
                    'Tech earnings beat expectations',
                    'Consumer spending remains robust'
                ],
                source: 'Finnhub + yfinance'
            });

            // Mock liquidity
            setLiquidity({
                passed: true,
                spread_ok: true,
                volume_ok: true,
                spread_threshold: 0.05,
                actual_spread: 0.02
            });

            // Mock forecast
            setForecast({
                p10: -2.5,
                p50: 0.8,
                p90: 3.2
            });
        } catch (err) {
            console.error('Failed to fetch bot sees:', err);
        }
        setLoading(false);
    }, []);

    // Fetch data for D2
    const fetchDecisions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/proposals`);
            if (res.ok) {
                void await res.json(); // Parse response but data mocked for now
                // Mock candidates
                setCandidates([
                    { rank: 1, symbol: 'SPY', strategy: 'PCS', score: 0.85, selected: true },
                    { rank: 2, symbol: 'QQQ', strategy: 'IC', score: 0.72, selected: false, rejection_reason: 'Risk cap exceeded' },
                    { rank: 3, symbol: 'AAPL', strategy: 'CCS', score: 0.68, selected: false, rejection_reason: 'Low liquidity' },
                    { rank: 4, symbol: 'MSFT', strategy: 'PDS', score: 0.55, selected: false, rejection_reason: 'Below threshold' },
                    { rank: 5, symbol: 'NVDA', strategy: 'CDS', score: 0.42, selected: false, rejection_reason: 'Sentiment gate' },
                ]);

                setLastTradeExplanation(
                    'Selected SPY PCS based on: bullish trend regime (75% confidence), favorable risk/reward ratio (3.2:1), ' +
                    'positive news sentiment (+35%), and adequate liquidity (spread 0.02%). Position sized at 2 contracts ' +
                    'with max loss $200, within daily risk budget.'
                );
            }

            // Check for no-trade reasons
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                if (status.no_trade_reasons) {
                    setNoTradeReasons(status.no_trade_reasons);
                } else {
                    setNoTradeReasons([]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch decisions:', err);
        }
    }, []);

    // Fetch data for D3
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
                    id: p.position_id,
                    symbol: p.symbol,
                    strategy: p.template,
                    pnl_percent: p.pnl_percent || 0,
                    nearest_trigger: getNearestTrigger(p),
                    trigger_distance: getTriggerDistance(p)
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

            // Generate conditional statements
            setConditionalStatements([
                'If SPY drops below $448, bot will trigger stop-loss on PCS position',
                'If sentiment turns negative (< -0.3), new entries will be gated',
                'If daily loss cap reached ($100), trading will pause until tomorrow',
                'If volatility spikes (HV20 > 30%), position sizing will reduce by 50%'
            ]);
        } catch (err) {
            console.error('Failed to fetch next actions:', err);
        }
    }, []);

    // Fetch data for D4
    const fetchAlerts = useCallback(async () => {
        try {
            const logsRes = await fetch(`${API_BASE}/autopilot/logs?limit=50&level=warning`);
            if (logsRes.ok) {
                const data = await logsRes.json();
                const alerts: ProviderAlert[] = (data.logs || [])
                    .filter((l: any) => l.level === 'warning' || l.level === 'error')
                    .slice(0, 10)
                    .map((l: any) => ({
                        provider: l.provider || 'System',
                        type: l.level === 'error' ? 'error' : 'warning',
                        message: l.message || l.event_type,
                        timestamp: l.timestamp,
                        fallback_active: l.fallback_active
                    }));
                setProviderAlerts(alerts);
            }

            // Check websocket status
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                setWebsocketStatus(
                    status.websocket_connected ? 'connected' :
                    status.polling_fallback ? 'polling' : 'disconnected'
                );
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchBotSees();
        fetchDecisions();
        fetchNextActions();
        fetchAlerts();
    }, [fetchBotSees, fetchDecisions, fetchNextActions, fetchAlerts]);

    // Polling
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'sees') fetchBotSees();
            if (activeTab === 'decisions') fetchDecisions();
            if (activeTab === 'next') fetchNextActions();
            if (activeTab === 'alerts') fetchAlerts();
        }, 30000);
        return () => clearInterval(interval);
    }, [activeTab, fetchBotSees, fetchDecisions, fetchNextActions, fetchAlerts]);

    return (
        <div className="h-full flex flex-col bg-panel-bg" data-testid="ai-panel">
            {/* Current Constraints Mini-Card */}
            <div className="px-3 py-2 border-b border-border bg-element-bg">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Current Constraints</div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-text">Risk: <span className="text-brand">${riskBudgetRemaining}</span> left</span>
                    <span className="text-text-muted">|</span>
                    <span className="text-text">Daily cap: <span className="text-green-400">OK</span></span>
                    <span className="text-text-muted">|</span>
                    <span className="text-text">Trades: <span className="text-text-secondary">3/10</span></span>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="sees" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="px-2 py-1 border-b border-border shrink-0">
                    <TabsTrigger value="sees" className="text-xs gap-1" data-testid="ai-tab-sees">
                        <Eye size={12} /> What it sees
                    </TabsTrigger>
                    <TabsTrigger value="decisions" className="text-xs gap-1" data-testid="ai-tab-decisions">
                        <Brain size={12} /> Why
                    </TabsTrigger>
                    <TabsTrigger value="next" className="text-xs gap-1" data-testid="ai-tab-next">
                        <Clock size={12} /> Next
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="text-xs gap-1" data-testid="ai-tab-alerts">
                        <AlertTriangle size={12} /> Alerts
                        {providerAlerts.length > 0 && (
                            <span className="ml-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                                {providerAlerts.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* D1: What the bot sees */}
                <TabsContent value="sees" className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Regime Classification */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-brand" />
                            <span className="text-xs font-medium text-text">Regime Classification</span>
                        </div>
                        {regime && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "px-2 py-1 rounded text-xs font-medium uppercase",
                                        regime.classification === 'trend' ? "bg-green-500/20 text-green-400" :
                                        regime.classification === 'range' ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-red-500/20 text-red-400"
                                    )}>
                                        {regime.classification}
                                    </span>
                                    <span className="text-xs text-text-secondary">{(regime.confidence * 100).toFixed(0)}% confidence</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div>
                                        <span className="text-text-muted">ADX</span>
                                        <div className="text-text">{regime.supporting_metrics.adx.toFixed(1)}</div>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">ATR Ratio</span>
                                        <div className="text-text">{regime.supporting_metrics.atr_ratio.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">MA Align</span>
                                        <div className="text-text capitalize">{regime.supporting_metrics.ma_alignment}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Volatility Regime */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap size={14} className="text-purple-500" />
                            <span className="text-xs font-medium text-text">Volatility Regime</span>
                        </div>
                        {volatility && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "px-2 py-1 rounded text-xs font-medium uppercase",
                                        volatility.regime === 'low' ? "bg-green-500/20 text-green-400" :
                                        volatility.regime === 'medium' ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-red-500/20 text-red-400"
                                    )}>
                                        {volatility.regime}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div>
                                        <span className="text-text-muted">HV20</span>
                                        <div className="text-text">{volatility.hv20.toFixed(1)}%</div>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">HV60</span>
                                        <div className="text-text">{volatility.hv60.toFixed(1)}%</div>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">IV %ile</span>
                                        <div className="text-text">{volatility.iv_percentile}%</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sentiment Summary */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-blue-500" />
                            <span className="text-xs font-medium text-text">Sentiment Summary</span>
                        </div>
                        {sentiment && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "text-lg font-bold tabular-nums",
                                        sentiment.score > 0.2 ? "text-green-400" :
                                        sentiment.score < -0.2 ? "text-red-400" : "text-text"
                                    )}>
                                        {sentiment.score > 0 ? '+' : ''}{(sentiment.score * 100).toFixed(0)}%
                                    </span>
                                    <span className="text-xs text-text-secondary">{(sentiment.confidence * 100).toFixed(0)}% conf</span>
                                </div>
                                <div className="text-[10px] text-text-muted">Source: {sentiment.source}</div>
                                <div className="space-y-1">
                                    {sentiment.headlines.map((h, i) => (
                                        <div key={i} className="text-[10px] text-text-secondary truncate">• {h}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Forecast */}
                    {forecast && (
                        <div className="bg-element-bg rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={14} className="text-cyan-500" />
                                <span className="text-xs font-medium text-text">Forecast (1D)</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-[10px] text-text-muted">P10 (Bear)</div>
                                    <div className="text-red-400 font-medium">{forecast.p10.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-text-muted">P50 (Base)</div>
                                    <div className="text-text font-medium">{forecast.p50.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-text-muted">P90 (Bull)</div>
                                    <div className="text-green-400 font-medium">+{forecast.p90.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Liquidity Checks */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 size={14} className="text-yellow-500" />
                            <span className="text-xs font-medium text-text">Liquidity Checks</span>
                        </div>
                        {liquidity && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-text-secondary">Overall</span>
                                    <span className={liquidity.passed ? "text-green-400" : "text-red-400"}>
                                        {liquidity.passed ? 'PASS' : 'FAIL'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-text-muted">Spread ({liquidity.spread_threshold * 100}% max)</span>
                                    <span className={liquidity.spread_ok ? "text-green-400" : "text-red-400"}>
                                        {(liquidity.actual_spread * 100).toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-text-muted">Volume</span>
                                    <span className={liquidity.volume_ok ? "text-green-400" : "text-red-400"}>
                                        {liquidity.volume_ok ? 'OK' : 'LOW'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* D2: Why it traded / didn't trade */}
                <TabsContent value="decisions" className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Candidate List */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Brain size={14} className="text-brand" />
                            <span className="text-xs font-medium text-text">Top 5 Candidates</span>
                        </div>
                        <div className="space-y-2">
                            {candidates.map(c => (
                                <div 
                                    key={c.rank}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded text-xs",
                                        c.selected ? "bg-green-500/10 border border-green-500/30" : "bg-panel-bg"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-text-muted">#{c.rank}</span>
                                        <span className="font-medium text-text">{c.symbol}</span>
                                        <span className="text-text-secondary">{c.strategy}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="tabular-nums text-text-secondary">{(c.score * 100).toFixed(0)}</span>
                                        {c.selected ? (
                                            <CheckCircle2 size={14} className="text-green-400" />
                                        ) : (
                                            <XCircle size={14} className="text-red-400" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trade Explanation or No-Trade Reasons */}
                    {candidates.some(c => c.selected) ? (
                        <div className="bg-element-bg rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 size={14} className="text-green-400" />
                                <span className="text-xs font-medium text-text">Trade Explanation</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">{lastTradeExplanation}</p>
                        </div>
                    ) : (
                        <div className="bg-element-bg rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={14} className="text-yellow-400" />
                                <span className="text-xs font-medium text-text">Why Nothing Happened</span>
                            </div>
                            {noTradeReasons.length > 0 ? (
                                <div className="space-y-2">
                                    {noTradeReasons.map((r, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="text-text">{r.description}</div>
                                                {r.details && <div className="text-text-muted text-[10px]">{r.details}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-text-secondary">All candidates were below quality threshold or rejected by risk gates.</p>
                            )}
                        </div>
                    )}

                    {/* Rejected Alternatives */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle size={14} className="text-red-400" />
                            <span className="text-xs font-medium text-text">Rejected Alternatives</span>
                        </div>
                        <div className="space-y-1">
                            {candidates.filter(c => !c.selected).map(c => (
                                <div key={c.rank} className="flex items-center justify-between text-[10px]">
                                    <span className="text-text-secondary">{c.symbol} {c.strategy}</span>
                                    <span className="text-red-400">{c.rejection_reason}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* D3: What happens next */}
                <TabsContent value="next" className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Monitoring Schedule */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-brand" />
                            <span className="text-xs font-medium text-text">Monitoring Schedule</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary">Next run</span>
                            <span className="text-xs text-text font-medium">{nextMonitoring}</span>
                        </div>
                    </div>

                    {/* Open Positions Summary */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-yellow-500" />
                            <span className="text-xs font-medium text-text">Open Positions</span>
                        </div>
                        {openPositions.length === 0 ? (
                            <p className="text-xs text-text-secondary">No open positions</p>
                        ) : (
                            <div className="space-y-2">
                                {openPositions.map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-medium text-text">{p.symbol}</span>
                                            <span className="text-text-muted ml-1">{p.strategy}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className={p.pnl_percent >= 0 ? "text-green-400" : "text-red-400"}>
                                                {p.pnl_percent >= 0 ? '+' : ''}{p.pnl_percent.toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] text-text-muted">{p.nearest_trigger}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Risk Budget */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 size={14} className="text-green-500" />
                            <span className="text-xs font-medium text-text">Risk Budget Remaining</span>
                        </div>
                        <div className="text-2xl font-bold text-green-400">${riskBudgetRemaining}</div>
                    </div>

                    {/* Conditional Statements */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Info size={14} className="text-blue-500" />
                            <span className="text-xs font-medium text-text">If X → Bot will Y</span>
                        </div>
                        <div className="space-y-2">
                            {conditionalStatements.map((s, i) => (
                                <p key={i} className="text-[10px] text-text-secondary leading-relaxed">• {s}</p>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* D4: Failures / Alerts */}
                <TabsContent value="alerts" className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Websocket Status */}
                    <div className="bg-element-bg rounded-lg p-3" data-testid="ws-status-section">
                        <div className="flex items-center gap-2 mb-2">
                            {websocketStatus === 'connected' ? (
                                <Wifi size={14} className="text-green-400" />
                            ) : websocketStatus === 'polling' ? (
                                <RefreshCw size={14} className="text-yellow-400" />
                            ) : (
                                <WifiOff size={14} className="text-red-400" />
                            )}
                            <span className="text-xs font-medium text-text" data-testid="ws-status-label">WebSocket Status</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={cn(
                                "px-2 py-1 rounded text-xs font-medium uppercase",
                                websocketStatus === 'connected' ? "bg-green-500/20 text-green-400" :
                                websocketStatus === 'polling' ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-red-500/20 text-red-400"
                            )}>
                                {websocketStatus}
                            </span>
                            <div className="flex items-center gap-2">
                                {websocketStatus === 'polling' && (
                                    <span className="text-[10px] text-text-muted">Fallback active</span>
                                )}
                                <button
                                    onClick={() => {
                                        // Trigger reconnect via API
                                        fetch(`${API_BASE}/autopilot/reconnect`, { method: 'POST' })
                                            .then(() => {
                                                // Refetch status after reconnect attempt
                                                setTimeout(fetchAlerts, 1000);
                                            })
                                            .catch(console.error);
                                    }}
                                    className={cn(
                                        "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                                        websocketStatus === 'disconnected' 
                                            ? "bg-brand text-white hover:bg-brand/80" 
                                            : "bg-element-bg-lighter text-text-secondary hover:bg-border"
                                    )}
                                    data-testid="ws-reconnect-btn"
                                >
                                    <RefreshCw size={10} className="inline mr-1" />
                                    {websocketStatus === 'disconnected' ? 'Reconnect Now' : 'Force Reconnect'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Provider Alerts */}
                    <div className="bg-element-bg rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={14} className="text-red-400" />
                            <span className="text-xs font-medium text-text">Provider Alerts</span>
                        </div>
                        {providerAlerts.length === 0 ? (
                            <p className="text-xs text-green-400">All providers healthy</p>
                        ) : (
                            <div className="space-y-2">
                                {providerAlerts.map((a, i) => (
                                    <div key={i} className={cn(
                                        "p-2 rounded text-xs",
                                        a.type === 'error' ? "bg-red-500/10 border border-red-500/30" :
                                        "bg-yellow-500/10 border border-yellow-500/30"
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-text">{a.provider}</span>
                                            <span className="text-[10px] text-text-muted">
                                                {new Date(a.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                                            </span>
                                        </div>
                                        <p className="text-text-secondary">{a.message}</p>
                                        {a.fallback_active && (
                                            <p className="text-[10px] text-yellow-400 mt-1">Fallback active</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
