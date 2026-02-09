/**
 * Advanced Autopilot AI Panel
 * 
 * Features:
 * - AI decision visualization
 * - Trade reasoning display
 * - Strategy performance tracking
 * - Risk management dashboard
 * - Live cycle monitoring
 */

import { useState, useEffect } from 'react';
import {
    Brain, Zap, Shield, Activity, Play, Pause, Square,
    ChevronRight, Radio, Cpu, Layers, Lightbulb
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Badge } from '../../../ui/Badge';
import { useAutopilotStore } from '../store';

// Types
interface AIDecision {
    id: string;
    timestamp: string;
    action: 'open_long' | 'open_short' | 'close' | 'hold' | 'skip';
    symbol: string;
    reasoning: string[];
    confidence: number;
    signals: Signal[];
    risk_assessment: string;
    expected_return: number;
    max_loss: number;
}

interface Signal {
    name: string;
    value: number;
    direction: 'bullish' | 'bearish' | 'neutral';
    weight: number;
}

interface CycleMetrics {
    cycle_number: number;
    candidates_scanned: number;
    candidates_passed: number;
    trades_executed: number;
    cycle_pnl: number;
    duration_ms: number;
    timestamp: string;
}

interface StrategyStats {
    strategy_name: string;
    total_trades: number;
    win_rate: number;
    avg_return: number;
    total_pnl: number;
    sharpe_ratio: number;
    max_drawdown: number;
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

// Signal Indicator
function SignalIndicator({ signal }: { signal: Signal }) {
    const colors = {
        bullish: 'text-up bg-up/20',
        bearish: 'text-down bg-down/20',
        neutral: 'text-text-secondary bg-border'
    };

    return (
        <div className="flex items-center justify-between p-2 rounded-lg bg-element-bg">
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", 
                    signal.direction === 'bullish' ? 'bg-up' : 
                    signal.direction === 'bearish' ? 'bg-down' : 'bg-border'
                )} />
                <span className="text-xs text-text">{signal.name}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={cn("text-xs font-mono", colors[signal.direction].split(' ')[0])}>
                    {signal.value.toFixed(2)}
                </span>
                <span className="text-[10px] text-text-muted">
                    ({(signal.weight * 100).toFixed(0)}%)
                </span>
            </div>
        </div>
    );
}

// AI Decision Card
function DecisionCard({ decision }: { decision: AIDecision }) {
    const [expanded, setExpanded] = useState(false);

    const actionColors = {
        open_long: 'bg-up/20 text-up border-up',
        open_short: 'bg-down/20 text-down border-down',
        close: 'bg-warn/20 text-warn border-warn',
        hold: 'bg-border text-text-secondary border-border',
        skip: 'bg-element-bg text-text-muted border-border'
    };

    const actionLabels = {
        open_long: '📈 OPEN LONG',
        open_short: '📉 OPEN SHORT',
        close: '🔄 CLOSE',
        hold: '⏸️ HOLD',
        skip: '⏭️ SKIP'
    };

    return (
        <div className="bg-panel-bg rounded-lg border border-border overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-element-bg transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold border",
                        actionColors[decision.action]
                    )}>
                        {actionLabels[decision.action]}
                    </span>
                    <span className="font-semibold text-text">{decision.symbol}</span>
                    <span className="text-xs text-text-secondary">
                        {new Date(decision.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <ConfidenceBar confidence={decision.confidence} />
                    <ChevronRight className={cn(
                        "transition-transform",
                        expanded && "rotate-90"
                    )} size={16} />
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                    {/* Reasoning */}
                    <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            <Lightbulb size={12} className="inline mr-1" />
                            AI Reasoning
                        </h4>
                        <ul className="space-y-1">
                            {decision.reasoning.map((reason, i) => (
                                <li key={i} className="text-sm text-text flex items-start gap-2">
                                    <span className="text-brand mt-0.5">•</span>
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Signals */}
                    <div>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                            <Radio size={12} className="inline mr-1" />
                            Signal Analysis
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {decision.signals.map((signal, i) => (
                                <SignalIndicator key={i} signal={signal} />
                            ))}
                        </div>
                    </div>

                    {/* Risk/Reward */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                        <div className="text-center">
                            <div className="text-[10px] text-text-secondary uppercase mb-1">Expected Return</div>
                            <div className={cn("text-lg font-bold", decision.expected_return >= 0 ? "text-up" : "text-down")}>
                                {formatPercent(decision.expected_return)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-text-secondary uppercase mb-1">Max Loss</div>
                            <div className="text-lg font-bold text-down">
                                {formatPercent(decision.max_loss)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-text-secondary uppercase mb-1">Risk/Reward</div>
                            <div className="text-lg font-bold text-text">
                                {Math.abs(decision.expected_return / decision.max_loss).toFixed(1)}:1
                            </div>
                        </div>
                    </div>

                    <div className="p-2 rounded bg-element-bg text-xs text-text-secondary">
                        <Shield size={12} className="inline mr-1" />
                        {decision.risk_assessment}
                    </div>
                </div>
            )}
        </div>
    );
}

// Confidence Bar
function ConfidenceBar({ confidence }: { confidence: number }) {
    const percentage = confidence * 100;
    const color = confidence >= 0.8 ? 'bg-up' : confidence >= 0.6 ? 'bg-warn' : 'bg-down';

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-element-bg rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${percentage}%` }} />
            </div>
            <span className="text-xs text-text-secondary">{percentage.toFixed(0)}%</span>
        </div>
    );
}

// Cycle Timeline
function CycleTimeline({ cycles }: { cycles: CycleMetrics[] }) {
    return (
        <div className="space-y-2">
            {cycles.map((cycle, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-element-bg rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold">
                        {cycle.cycle_number}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-text">Cycle #{cycle.cycle_number}</span>
                            <span className="text-xs text-text-muted">
                                {new Date(cycle.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-text-secondary">
                            <span>Scanned: {cycle.candidates_scanned}</span>
                            <span>Passed: {cycle.candidates_passed}</span>
                            <span>Executed: {cycle.trades_executed}</span>
                            <span className={cn(cycle.cycle_pnl >= 0 ? "text-up" : "text-down")}>
                                P&L: {formatCurrency(cycle.cycle_pnl)}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-text-muted">
                        {cycle.duration_ms}ms
                    </div>
                </div>
            ))}
        </div>
    );
}

// Strategy Performance Card
function StrategyCard({ stats }: { stats: StrategyStats }) {
    return (
        <div className="p-4 bg-element-bg rounded-lg border border-border">
            <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-text">{stats.strategy_name}</span>
                <Badge variant={stats.win_rate >= 0.5 ? 'success' : 'warning'} size="sm">
                    {(stats.win_rate * 100).toFixed(0)}% WR
                </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                    <div className={cn("text-lg font-bold", stats.total_pnl >= 0 ? "text-up" : "text-down")}>
                        {formatCurrency(stats.total_pnl)}
                    </div>
                    <div className="text-[10px] text-text-secondary">Total P&L</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-text">{stats.total_trades}</div>
                    <div className="text-[10px] text-text-secondary">Trades</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-text">{stats.sharpe_ratio.toFixed(2)}</div>
                    <div className="text-[10px] text-text-secondary">Sharpe</div>
                </div>
            </div>
        </div>
    );
}

// Main Component
export function AdvancedAutopilotPanel() {
    const {
        config,
        status,
        portfolio,
        isLoading,
        fetchConfig,
        fetchStatus,
        triggerRun,
        activateKillSwitch,
        pause,
        resume
    } = useAutopilotStore();

    // Initial data - set directly without useEffect for static mock data
    const [decisions] = useState<AIDecision[]>(() => [
        {
            id: '1',
            timestamp: new Date().toISOString(),
            action: 'open_long',
            symbol: 'AAPL260130C00252500',
            reasoning: [
                'RSI showing bullish divergence at 35',
                'Price broke above 20-day SMA with volume confirmation',
                'Implied volatility rank at 25% - favorable for long calls',
                'Earnings in 45 days - time decay manageable'
            ],
            confidence: 0.82,
            signals: [
                { name: 'RSI', value: 35, direction: 'bullish', weight: 0.2 },
                { name: 'MACD', value: 0.5, direction: 'bullish', weight: 0.25 },
                { name: 'IV Rank', value: 25, direction: 'bullish', weight: 0.3 },
                { name: 'Trend', value: 0.7, direction: 'bullish', weight: 0.25 }
            ],
            risk_assessment: 'Low to moderate risk. Stop loss at 8% below entry.',
            expected_return: 0.25,
            max_loss: -0.08
        },
        {
            id: '2',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            action: 'skip',
            symbol: 'NVDA',
            reasoning: [
                'IV rank above 70% - premiums too expensive',
                'No clear directional bias in technicals',
                'Earnings announcement too close (5 days)'
            ],
            confidence: 0.45,
            signals: [
                { name: 'RSI', value: 55, direction: 'neutral', weight: 0.2 },
                { name: 'IV Rank', value: 72, direction: 'bearish', weight: 0.4 },
                { name: 'Trend', value: 0.1, direction: 'neutral', weight: 0.4 }
            ],
            risk_assessment: 'High IV environment not favorable for directional plays.',
            expected_return: 0.15,
            max_loss: -0.20
        }
    ]);

    const [cycles] = useState<CycleMetrics[]>(() => [
        { cycle_number: 5, candidates_scanned: 15, candidates_passed: 3, trades_executed: 1, cycle_pnl: 45, duration_ms: 2340, timestamp: new Date().toISOString() },
        { cycle_number: 4, candidates_scanned: 15, candidates_passed: 2, trades_executed: 1, cycle_pnl: -22, duration_ms: 1890, timestamp: new Date(Date.now() - 300000).toISOString() },
        { cycle_number: 3, candidates_scanned: 15, candidates_passed: 4, trades_executed: 2, cycle_pnl: 78, duration_ms: 3120, timestamp: new Date(Date.now() - 600000).toISOString() }
    ]);

    const [strategies] = useState<StrategyStats[]>([
        { strategy_name: 'RSI Divergence', total_trades: 24, win_rate: 0.67, avg_return: 0.034, total_pnl: 892, sharpe_ratio: 1.45, max_drawdown: -0.08 },
        { strategy_name: 'IV Crush', total_trades: 18, win_rate: 0.72, avg_return: 0.028, total_pnl: 634, sharpe_ratio: 1.82, max_drawdown: -0.05 }
    ]);

    useEffect(() => {
        fetchConfig();
        fetchStatus();
    }, [fetchConfig, fetchStatus]);

    const pnl = portfolio?.total_pnl ?? 0;
    const equity = (config?.paper_equity ?? 1000) + pnl;

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-semibold text-text">Autopilot AI</h2>
                    </div>

                    {/* Status Badge */}
                    <Badge
                        variant={status?.state === 'running' ? 'success' :
                                status?.state === 'paused' ? 'warning' :
                                status?.kill_switch ? 'error' : 'default'}
                    >
                        {status?.kill_switch ? '🛑 KILL SWITCH' : status?.state?.toUpperCase() || 'IDLE'}
                    </Badge>

                    {/* Equity Display */}
                    <div className="flex items-center gap-2 px-3 py-1 bg-element-bg rounded-lg">
                        <span className="text-xs text-text-secondary">Equity:</span>
                        <span className="text-sm font-semibold text-text">{formatCurrency(equity)}</span>
                        <span className={cn("text-xs", pnl >= 0 ? "text-up" : "text-down")}>
                            ({pnl >= 0 ? '+' : ''}{formatCurrency(pnl)})
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Control Buttons */}
                    <button
                        onClick={() => status?.state === 'paused' ? resume() : pause()}
                        disabled={status?.kill_switch}
                        className={cn(
                            "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                            status?.state === 'paused' 
                                ? "bg-up hover:bg-up/90 text-white"
                                : "bg-warn hover:bg-warn/90 text-black"
                        )}
                    >
                        {status?.state === 'paused' ? (
                            <><Play size={12} className="inline mr-1" /> Resume</>
                        ) : (
                            <><Pause size={12} className="inline mr-1" /> Pause</>
                        )}
                    </button>

                    <button
                        onClick={() => triggerRun(true)}
                        disabled={isLoading || status?.kill_switch}
                        className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                        <Zap size={12} className="inline mr-1" />
                        Run Cycle
                    </button>

                    <button
                        onClick={() => activateKillSwitch(true)}
                        className="px-3 py-1.5 bg-down hover:bg-down/90 text-white text-xs font-medium rounded transition-colors"
                    >
                        <Square size={12} className="inline mr-1" />
                        Kill Switch
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - AI Decisions */}
                <div className="w-2/3 border-r border-border flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border bg-panel-bg">
                        <div className="flex items-center gap-2">
                            <Brain size={16} className="text-brand" />
                            <h3 className="text-sm font-semibold text-text">AI Decisions</h3>
                            <Badge variant="info" size="sm">{decisions.length} recent</Badge>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {decisions.map(decision => (
                            <DecisionCard key={decision.id} decision={decision} />
                        ))}
                    </div>
                </div>

                {/* Right Panel - Metrics */}
                <div className="w-1/3 flex flex-col overflow-hidden">
                    {/* Cycle Timeline */}
                    <div className="border-b border-border">
                        <div className="p-4 border-b border-border bg-panel-bg">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-brand" />
                                <h3 className="text-sm font-semibold text-text">Recent Cycles</h3>
                            </div>
                        </div>
                        <div className="p-4 max-h-[250px] overflow-auto">
                            <CycleTimeline cycles={cycles} />
                        </div>
                    </div>

                    {/* Strategy Performance */}
                    <div className="flex-1 overflow-auto">
                        <div className="p-4 border-b border-border bg-panel-bg">
                            <div className="flex items-center gap-2">
                                <Layers size={16} className="text-brand" />
                                <h3 className="text-sm font-semibold text-text">Strategy Performance</h3>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            {strategies.map((strat, i) => (
                                <StrategyCard key={i} stats={strat} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdvancedAutopilotPanel;
