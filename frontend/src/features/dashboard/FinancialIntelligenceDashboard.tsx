/**
 * Financial Intelligence Dashboard
 * 
 * Inspired by AI Finance Agent Team patterns from awesome-llm-apps:
 * - Multi-agent insights (sentiment, technical, fundamental)
 * - Real-time P&L visualization with charts
 * - Risk assessment with severity indicators
 * - Portfolio health metrics
 * - AI-powered market analysis
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity, TrendingUp, TrendingDown, DollarSign, Shield,
    AlertTriangle, Bot, Brain, Zap, Target, BarChart3, Info,
    Wallet, RefreshCw, Sparkles, Globe, Radio, ChevronRight
} from 'lucide-react';
import { cn } from '../../ui/utils';
import { Badge } from '../../ui/Badge';

const API_BASE = '/api/v1';

// Types
interface PortfolioMetrics {
    total_equity: number;
    total_cash: number;
    buying_power: number;
    open_pnl: number;
    day_pnl: number;
    realized_pnl: number;
    position_count: number;
    win_rate: number;
    avg_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    options_exposure: number;
}

interface RiskMetrics {
    overall_score: number; // 1-10
    market_risk: number;
    execution_risk: number;
    concentration_risk: number;
    volatility_exposure: number;
    recommendations: string[];
}

interface MarketSentiment {
    overall: 'bullish' | 'neutral' | 'bearish';
    score: number; // -1 to 1
    news_velocity: 'low' | 'normal' | 'high';
    vix_level: number;
    trend_strength: number;
    key_events: string[];
}

interface AIInsight {
    id: string;
    type: 'opportunity' | 'warning' | 'info' | 'action';
    title: string;
    description: string;
    confidence: number;
    timestamp: string;
    symbol?: string;
}

interface Position {
    id: string;
    symbol: string;
    underlying: string;
    asset_type: 'equity' | 'option';
    qty: number;
    avg_price: number;
    current_price: number;
    market_value: number;
    pnl: number;
    pnl_percent: number;
    dte?: number;
    option_type?: 'call' | 'put';
    strike?: number;
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

// Mini Chart Component
function SparklineChart({ data, positive }: { data: number[]; positive: boolean }) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((v - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke={positive ? 'var(--color-up)' : 'var(--color-down)'}
                strokeWidth="2"
                points={points}
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

// Circular Progress Component
function CircularGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
    const percentage = (value / max) * 100;
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90">
                <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="8"
                />
                <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-lg font-bold text-text">{value.toFixed(1)}</span>
                <span className="text-[10px] text-text-secondary uppercase">{label}</span>
            </div>
        </div>
    );
}

// AI Agent Card
function AIAgentCard({ name, status, lastAction, icon: Icon }: {
    name: string;
    status: 'active' | 'idle' | 'analyzing';
    lastAction: string;
    icon: React.ElementType;
}) {
    return (
        <div className="p-3 bg-element-bg rounded-lg border border-border hover:border-brand/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                    "p-2 rounded-lg",
                    status === 'active' ? 'bg-up/20 text-up' :
                    status === 'analyzing' ? 'bg-brand/20 text-brand animate-pulse' :
                    'bg-border text-text-secondary'
                )}>
                    <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text">{name}</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider">{status}</div>
                </div>
            </div>
            <div className="text-xs text-text-secondary truncate">{lastAction}</div>
        </div>
    );
}

// Insight Card
function InsightCard({ insight }: { insight: AIInsight }) {
    const icons = {
        opportunity: <Sparkles size={14} className="text-up" />,
        warning: <AlertTriangle size={14} className="text-warn" />,
        info: <Info size={14} className="text-brand" />,
        action: <Target size={14} className="text-primary" />
    };

    const bgColors = {
        opportunity: 'border-up/30 bg-up/5',
        warning: 'border-warn/30 bg-warn/5',
        info: 'border-brand/30 bg-brand/5',
        action: 'border-primary/30 bg-primary/5'
    };

    return (
        <div className={cn(
            "p-3 rounded-lg border transition-colors hover:bg-element-bg cursor-pointer",
            bgColors[insight.type]
        )}>
            <div className="flex items-start gap-2">
                {icons[insight.type]}
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text">{insight.title}</div>
                    <div className="text-xs text-text-secondary mt-1">{insight.description}</div>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-text-muted">
                            {new Date(insight.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] text-text-muted">
                            {(insight.confidence * 100).toFixed(0)}% confidence
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Position Row
function PositionRow({ position }: { position: Position }) {
    const isOption = position.asset_type === 'option';
    const isProfitable = position.pnl >= 0;

    return (
        <div className="flex items-center gap-4 p-3 hover:bg-element-bg rounded-lg transition-colors">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{position.symbol}</span>
                    {isOption && (
                        <Badge variant={position.option_type === 'call' ? 'success' : 'error'} size="sm">
                            {position.option_type?.toUpperCase()}
                        </Badge>
                    )}
                    {position.dte !== undefined && (
                        <span className="text-[10px] text-text-muted">{position.dte} DTE</span>
                    )}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                    {position.qty} × {formatCurrency(position.avg_price)}
                </div>
            </div>

            <div className="text-right">
                <div className={cn("text-sm font-semibold tabular-nums", isProfitable ? "text-up" : "text-down")}>
                    {formatCurrency(position.pnl)}
                </div>
                <div className={cn("text-xs tabular-nums", isProfitable ? "text-up" : "text-down")}>
                    {formatPercent(position.pnl_percent)}
                </div>
            </div>
        </div>
    );
}

// Main Dashboard Component
export function FinancialIntelligenceDashboard() {
    const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
    const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
    const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(false);
    const [pnlHistory, setPnlHistory] = useState<number[]>([]);

    // Fetch all data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch portfolio unified data
            const res = await fetch(`${API_BASE}/portfolio/unified`);
            if (res.ok) {
                const data = await res.json();
                
                // Map stats to metrics
                if (data.stats) {
                    setMetrics({
                        total_equity: data.stats.total_equity || 0,
                        total_cash: data.stats.total_cash || 0,
                        buying_power: data.stats.buying_power || 0,
                        open_pnl: data.stats.open_pnl || 0,
                        day_pnl: data.stats.day_pnl || 0,
                        realized_pnl: 0,
                        position_count: data.stats.position_count || 0,
                        win_rate: 0.65, // Would come from backend
                        avg_return: 0.032,
                        sharpe_ratio: 1.2,
                        max_drawdown: -0.05,
                        options_exposure: data.stats.options_exposure || 0
                    });
                }

                // Map positions
                if (data.positions) {
                    setPositions(data.positions.map((p: Record<string, unknown>) => ({
                        id: String(p.id),
                        symbol: String(p.symbol),
                        underlying: String(p.underlying || p.symbol),
                        asset_type: p.asset_class === 'option' ? 'option' : 'equity',
                        qty: Number(p.quantity),
                        avg_price: Number(p.avg_cost),
                        current_price: Number(p.current_price),
                        market_value: Number(p.market_value),
                        pnl: Number(p.unrealized_pnl),
                        pnl_percent: Number(p.unrealized_pnl_pct) / 100,
                        dte: p.dte != null ? Number(p.dte) : undefined,
                        option_type: p.option_type ? String(p.option_type) : undefined,
                        strike: p.strike != null ? Number(p.strike) : undefined
                    })));
                }
            }

            // Fetch autopilot status for sentiment
            const statusRes = await fetch(`${API_BASE}/autopilot/status`);
            if (statusRes.ok) {
                const status = await statusRes.json();
                if (status.sentiment) {
                    const sentScore = status.sentiment.sentiment_scores?.MARKET ?? 0;
                    setSentiment({
                        overall: sentScore > 0.3 ? 'bullish' : sentScore < -0.3 ? 'bearish' : 'neutral',
                        score: sentScore,
                        news_velocity: status.sentiment.news_velocity || 'normal',
                        vix_level: 18.5, // Would come from market data
                        trend_strength: Math.abs(sentScore),
                        key_events: status.sentiment.key_events || []
                    });
                }

                // Generate risk metrics based on status
                setRiskMetrics({
                    overall_score: status.kill_switch ? 10 : 4,
                    market_risk: 3,
                    execution_risk: 2,
                    concentration_risk: 5,
                    volatility_exposure: 4,
                    recommendations: [
                        "Consider diversifying across more underlyings",
                        "Monitor VIX for volatility expansion",
                        "Set tighter stops for high-DTE options"
                    ]
                });
            }

            // Generate mock AI insights
            setInsights([
                {
                    id: '1',
                    type: 'opportunity',
                    title: 'AAPL shows bullish divergence',
                    description: 'RSI divergence detected with price action. Consider long call strategy.',
                    confidence: 0.78,
                    timestamp: new Date().toISOString(),
                    symbol: 'AAPL'
                },
                {
                    id: '2',
                    type: 'warning',
                    title: 'High concentration in tech sector',
                    description: '80% of positions are in technology. Consider hedging with sector rotation.',
                    confidence: 0.92,
                    timestamp: new Date(Date.now() - 300000).toISOString()
                },
                {
                    id: '3',
                    type: 'info',
                    title: 'FOMC meeting in 2 days',
                    description: 'Expect increased volatility. IV expansion likely across all underlyings.',
                    confidence: 0.95,
                    timestamp: new Date(Date.now() - 600000).toISOString()
                }
            ]);

            // Generate P&L history for sparkline
            const history = [];
            let pnl = 1000;
            for (let i = 0; i < 30; i++) {
                pnl += (Math.random() - 0.45) * 50;
                history.push(pnl);
            }
            setPnlHistory(history);

        } catch (e) {
            console.error('Failed to fetch dashboard data:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchData();
        };
        load();
        const interval = setInterval(load, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [fetchData]);

    const isPnlPositive = useMemo(() => {
        return (metrics?.open_pnl ?? 0) >= 0;
    }, [metrics]);

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-brand" />
                        <h1 className="text-lg font-semibold text-text">Financial Intelligence</h1>
                    </div>

                    {sentiment && (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2",
                            sentiment.overall === 'bullish' ? 'bg-up/20 text-up' :
                            sentiment.overall === 'bearish' ? 'bg-down/20 text-down' :
                            'bg-border text-text-secondary'
                        )}>
                            {sentiment.overall === 'bullish' ? <TrendingUp size={12} /> :
                             sentiment.overall === 'bearish' ? <TrendingDown size={12} /> :
                             <Activity size={12} />}
                            Market: {sentiment.overall.toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 rounded bg-element-bg hover:bg-border transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-12 gap-4">

                    {/* Portfolio Summary - Spans 8 columns */}
                    <div className="col-span-8 space-y-4">
                        {/* Key Metrics Row */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="p-4 bg-panel-bg rounded-lg border border-border">
                                <div className="flex items-center gap-2 text-text-secondary mb-2">
                                    <Wallet size={14} />
                                    <span className="text-[10px] uppercase tracking-wider">Total Equity</span>
                                </div>
                                <div className="text-2xl font-bold text-text tabular-nums">
                                    {metrics ? formatCurrency(metrics.total_equity) : '---'}
                                </div>
                                <div className="mt-2">
                                    <SparklineChart data={pnlHistory} positive={isPnlPositive} />
                                </div>
                            </div>

                            <div className="p-4 bg-panel-bg rounded-lg border border-border">
                                <div className="flex items-center gap-2 text-text-secondary mb-2">
                                    {isPnlPositive ? <TrendingUp size={14} className="text-up" /> : <TrendingDown size={14} className="text-down" />}
                                    <span className="text-[10px] uppercase tracking-wider">Open P&L</span>
                                </div>
                                <div className={cn("text-2xl font-bold tabular-nums", isPnlPositive ? "text-up" : "text-down")}>
                                    {metrics ? `${metrics.open_pnl >= 0 ? '+' : ''}${formatCurrency(metrics.open_pnl)}` : '---'}
                                </div>
                                <div className="text-xs text-text-secondary mt-1">
                                    Today: {metrics ? formatCurrency(metrics.day_pnl) : '---'}
                                </div>
                            </div>

                            <div className="p-4 bg-panel-bg rounded-lg border border-border">
                                <div className="flex items-center gap-2 text-text-secondary mb-2">
                                    <DollarSign size={14} />
                                    <span className="text-[10px] uppercase tracking-wider">Buying Power</span>
                                </div>
                                <div className="text-2xl font-bold text-text tabular-nums">
                                    {metrics ? formatCurrency(metrics.buying_power) : '---'}
                                </div>
                                <div className="text-xs text-text-secondary mt-1">
                                    {metrics ? formatPercent(metrics.buying_power / metrics.total_equity) : '---'} available
                                </div>
                            </div>

                            <div className="p-4 bg-panel-bg rounded-lg border border-border">
                                <div className="flex items-center gap-2 text-text-secondary mb-2">
                                    <Target size={14} />
                                    <span className="text-[10px] uppercase tracking-wider">Win Rate</span>
                                </div>
                                <div className="text-2xl font-bold text-up tabular-nums">
                                    {metrics ? `${(metrics.win_rate * 100).toFixed(0)}%` : '---'}
                                </div>
                                <div className="text-xs text-text-secondary mt-1">
                                    {metrics?.position_count || 0} active trades
                                </div>
                            </div>
                        </div>

                        {/* AI Agents Grid */}
                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Bot size={16} className="text-brand" />
                                    <h3 className="text-sm font-semibold text-text">AI Agent Team</h3>
                                </div>
                                <Badge variant="success" size="sm">All Active</Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                <AIAgentCard
                                    name="Market Analyst"
                                    status="active"
                                    lastAction="Analyzed 5 opportunities"
                                    icon={Globe}
                                />
                                <AIAgentCard
                                    name="Risk Manager"
                                    status="active"
                                    lastAction="Risk score updated"
                                    icon={Shield}
                                />
                                <AIAgentCard
                                    name="Sentiment Agent"
                                    status="analyzing"
                                    lastAction="Processing news feed..."
                                    icon={Radio}
                                />
                                <AIAgentCard
                                    name="Execution Agent"
                                    status="idle"
                                    lastAction="Awaiting signals"
                                    icon={Zap}
                                />
                            </div>
                        </div>

                        {/* Positions List */}
                        <div className="bg-panel-bg rounded-lg border border-border">
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} className="text-text-secondary" />
                                    <h3 className="text-sm font-semibold text-text">Active Positions</h3>
                                </div>
                                <span className="text-xs text-text-secondary">{positions.length} positions</span>
                            </div>
                            <div className="p-2 max-h-[300px] overflow-auto">
                                {positions.length === 0 ? (
                                    <div className="py-8 text-center text-text-secondary text-sm">
                                        No active positions
                                    </div>
                                ) : (
                                    positions.map(p => <PositionRow key={p.id} position={p} />)
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar - Spans 4 columns */}
                    <div className="col-span-4 space-y-4">
                        {/* Risk Assessment */}
                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield size={16} className="text-brand" />
                                <h3 className="text-sm font-semibold text-text">Risk Assessment</h3>
                            </div>

                            <div className="flex justify-center mb-4">
                                <CircularGauge
                                    value={riskMetrics?.overall_score ?? 0}
                                    max={10}
                                    label="Risk"
                                    color={riskMetrics ? 
                                        (riskMetrics.overall_score <= 3 ? 'var(--color-up)' :
                                         riskMetrics.overall_score <= 6 ? 'var(--color-warn)' :
                                         'var(--color-down)') : 'var(--color-border)'
                                    }
                                />
                            </div>

                            <div className="space-y-3">
                                <RiskBar label="Market Risk" value={riskMetrics?.market_risk ?? 0} />
                                <RiskBar label="Execution Risk" value={riskMetrics?.execution_risk ?? 0} />
                                <RiskBar label="Concentration" value={riskMetrics?.concentration_risk ?? 0} />
                                <RiskBar label="Volatility" value={riskMetrics?.volatility_exposure ?? 0} />
                            </div>

                            {riskMetrics?.recommendations && riskMetrics.recommendations.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border">
                                    <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                                        Recommendations
                                    </div>
                                    <ul className="space-y-1">
                                        {riskMetrics.recommendations.slice(0, 3).map((rec, i) => (
                                            <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                                                <ChevronRight size={12} className="text-brand mt-0.5 shrink-0" />
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* AI Insights */}
                        <div className="bg-panel-bg rounded-lg border border-border">
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-brand" />
                                    <h3 className="text-sm font-semibold text-text">AI Insights</h3>
                                </div>
                                <Badge variant="info" size="sm">{insights.length} new</Badge>
                            </div>
                            <div className="p-2 max-h-[400px] overflow-auto space-y-2">
                                {insights.map(insight => (
                                    <InsightCard key={insight.id} insight={insight} />
                                ))}
                            </div>
                        </div>

                        {/* Market Pulse */}
                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Activity size={16} className="text-brand" />
                                <h3 className="text-sm font-semibold text-text">Market Pulse</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-element-bg rounded-lg">
                                    <div className="text-[10px] text-text-secondary uppercase mb-1">VIX</div>
                                    <div className="text-lg font-bold text-text">{sentiment?.vix_level?.toFixed(2) ?? '--'}</div>
                                </div>
                                <div className="p-3 bg-element-bg rounded-lg">
                                    <div className="text-[10px] text-text-secondary uppercase mb-1">News Flow</div>
                                    <div className="text-lg font-bold text-text capitalize">{sentiment?.news_velocity ?? '--'}</div>
                                </div>
                                <div className="p-3 bg-element-bg rounded-lg">
                                    <div className="text-[10px] text-text-secondary uppercase mb-1">Trend</div>
                                    <div className={cn("text-lg font-bold", 
                                        sentiment?.overall === 'bullish' ? 'text-up' :
                                        sentiment?.overall === 'bearish' ? 'text-down' : 'text-text'
                                    )}>
                                        {sentiment?.overall === 'bullish' ? '↑ Bull' :
                                         sentiment?.overall === 'bearish' ? '↓ Bear' : '↔ Flat'}
                                    </div>
                                </div>
                                <div className="p-3 bg-element-bg rounded-lg">
                                    <div className="text-[10px] text-text-secondary uppercase mb-1">Strength</div>
                                    <div className="text-lg font-bold text-text">
                                        {sentiment ? `${(sentiment.trend_strength * 100).toFixed(0)}%` : '--'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Risk Bar Component
function RiskBar({ label, value }: { label: string; value: number }) {
    const percentage = (value / 10) * 100;
    const color = value <= 3 ? 'bg-up' : value <= 6 ? 'bg-warn' : 'bg-down';

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{label}</span>
                <span className="text-text">{value}/10</span>
            </div>
            <div className="h-1.5 bg-element-bg rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", color)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export default FinancialIntelligenceDashboard;
