/**
 * Real-Time P&L Analytics Component
 * 
 * Features:
 * - Interactive P&L chart with multiple timeframes
 * - Trade history visualization
 * - Win/loss streak tracking
 * - Performance metrics dashboard
 * - Live updating values
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Activity, BarChart2, Target, RefreshCw, Zap, DollarSign
} from 'lucide-react';
import { cn } from '../../ui/utils';
import { Badge } from '../../ui/Badge';

// Types
interface TradeRecord {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    entry_price: number;
    exit_price?: number;
    pnl: number;
    pnl_percent: number;
    entry_time: string;
    exit_time?: string;
    status: 'open' | 'closed';
    holding_period?: number; // in hours
}

interface PerformanceMetrics {
    total_pnl: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    avg_win: number;
    avg_loss: number;
    profit_factor: number;
    max_drawdown: number;
    current_streak: number;
    streak_type: 'win' | 'loss';
    best_trade: number;
    worst_trade: number;
    avg_holding_time: number;
    sharpe_ratio: number;
}

interface TimeframeData {
    labels: string[];
    values: number[];
    cumulative: number[];
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

// Chart Component with Gradient
function PnLChart({ data, height = 200 }: { data: TimeframeData; height?: number }) {
    const maxValue = Math.max(...data.cumulative);
    const minValue = Math.min(...data.cumulative);
    const range = Math.max(maxValue - minValue, 1);
    const padding = 40;

    const points = data.cumulative.map((v, i) => {
        const x = padding + (i / (data.cumulative.length - 1)) * (100 - padding * 2);
        const y = height - padding - ((v - minValue) / range) * (height - padding * 2);
        return { x, y, value: v };
    });

    const pathD = points.map((p, i) => 
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');

    const areaD = pathD + 
        ` L ${points[points.length - 1].x} ${height - padding}` +
        ` L ${padding} ${height - padding} Z`;

    const zeroY = height - padding - ((0 - minValue) / range) * (height - padding * 2);
    const isPositive = data.cumulative[data.cumulative.length - 1] >= 0;

    return (
        <div className="relative w-full" style={{ height }}>
            <svg className="w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
                {/* Gradient definitions */}
                <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isPositive ? 'var(--color-up)' : 'var(--color-down)'} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={isPositive ? 'var(--color-up)' : 'var(--color-down)'} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Zero line */}
                <line
                    x1={padding}
                    y1={zeroY}
                    x2={100 - padding}
                    y2={zeroY}
                    stroke="var(--color-border)"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Area fill */}
                <path
                    d={areaD}
                    fill="url(#pnlGradient)"
                />

                {/* Line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke={isPositive ? 'var(--color-up)' : 'var(--color-down)'}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Current value dot */}
                <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r="3"
                    fill={isPositive ? 'var(--color-up)' : 'var(--color-down)'}
                    className="animate-pulse"
                />
            </svg>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-8 text-[10px] text-text-muted">
                <span>{formatCurrency(maxValue)}</span>
                <span>{formatCurrency(minValue)}</span>
            </div>

            {/* Current value overlay */}
            <div className="absolute right-2 top-2">
                <div className={cn(
                    "px-2 py-1 rounded text-sm font-bold",
                    isPositive ? "bg-up/20 text-up" : "bg-down/20 text-down"
                )}>
                    {formatCurrency(data.cumulative[data.cumulative.length - 1])}
                </div>
            </div>
        </div>
    );
}

// Metric Card Component
function MetricCard({ 
    label, 
    value, 
    subValue, 
    icon: Icon, 
    trend,
    color 
}: { 
    label: string; 
    value: string; 
    subValue?: string; 
    icon: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
}) {
    return (
        <div className="p-4 bg-element-bg rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color || "text-text-secondary"} />
                <span className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-end justify-between">
                <span className={cn(
                    "text-xl font-bold tabular-nums",
                    trend === 'up' ? 'text-up' : trend === 'down' ? 'text-down' : 'text-text'
                )}>
                    {value}
                </span>
                {subValue && (
                    <span className="text-xs text-text-muted">{subValue}</span>
                )}
            </div>
        </div>
    );
}

// Win/Loss Bar
function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
    const total = wins + losses || 1;
    const winPct = (wins / total) * 100;

    return (
        <div className="relative h-3 bg-down rounded-full overflow-hidden">
            <div 
                className="absolute left-0 top-0 h-full bg-up transition-all duration-500"
                style={{ width: `${winPct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white drop-shadow">
                    {wins}W / {losses}L
                </span>
            </div>
        </div>
    );
}

// Streak Indicator
function StreakIndicator({ count, type }: { count: number; type: 'win' | 'loss' }) {
    const isWin = type === 'win';
    const flames = Array.from({ length: Math.min(count, 5) });

    return (
        <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
            isWin ? "bg-up/20 text-up" : "bg-down/20 text-down"
        )}>
            <span className="text-sm">{isWin ? '🔥' : '❄️'}</span>
            {flames.map((_, i) => (
                <span key={i} className="text-[10px]">{isWin ? '🔥' : '❄️'}</span>
            ))}
            <span>{count} {isWin ? 'Win' : 'Loss'} Streak</span>
        </div>
    );
}

// Trade History Row
function TradeRow({ trade }: { trade: TradeRecord }) {
    const isProfitable = trade.pnl >= 0;

    return (
        <div className="flex items-center gap-4 p-3 hover:bg-element-bg rounded-lg transition-colors">
            <div className={cn(
                "w-1 h-8 rounded-full",
                isProfitable ? "bg-up" : "bg-down"
            )} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{trade.symbol}</span>
                    <Badge 
                        variant={trade.side === 'long' ? 'success' : 'error'} 
                        size="sm"
                    >
                        {trade.side.toUpperCase()}
                    </Badge>
                    <Badge 
                        variant={trade.status === 'open' ? 'info' : 'default'} 
                        size="sm"
                    >
                        {trade.status}
                    </Badge>
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                    {new Date(trade.entry_time).toLocaleDateString()} @ {formatCurrency(trade.entry_price)}
                    {trade.exit_price && ` → ${formatCurrency(trade.exit_price)}`}
                </div>
            </div>
            <div className="text-right">
                <div className={cn(
                    "text-sm font-semibold tabular-nums",
                    isProfitable ? "text-up" : "text-down"
                )}>
                    {formatCurrency(trade.pnl)}
                </div>
                <div className={cn(
                    "text-xs tabular-nums",
                    isProfitable ? "text-up" : "text-down"
                )}>
                    {formatPercent(trade.pnl_percent)}
                </div>
            </div>
        </div>
    );
}

// Main Component
export function RealTimePnLAnalytics() {
    const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | 'ALL'>('1W');
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [chartData, setChartData] = useState<TimeframeData | null>(null);
    const [loading, setLoading] = useState(false);

    // Generate mock data
    const generateData = useCallback(() => {
        setLoading(true);

        // Generate trade history
        const mockTrades: TradeRecord[] = [];
        let cumPnl = 0;
        const numTrades = 20;

        for (let i = 0; i < numTrades; i++) {
            const isWin = Math.random() > 0.4;
            const pnlAmount = isWin ? 
                (Math.random() * 100 + 20) : 
                -(Math.random() * 60 + 10);
            cumPnl += pnlAmount;

            mockTrades.push({
                id: `trade-${i}`,
                symbol: ['AAPL', 'NVDA', 'GOOGL', 'SPY', 'TSLA'][Math.floor(Math.random() * 5)],
                side: Math.random() > 0.5 ? 'long' : 'short',
                entry_price: 100 + Math.random() * 200,
                exit_price: i < numTrades - 2 ? 100 + Math.random() * 200 : undefined,
                pnl: pnlAmount,
                pnl_percent: pnlAmount / (100 + Math.random() * 200),
                entry_time: new Date(Date.now() - (numTrades - i) * 3600000 * 4).toISOString(),
                exit_time: i < numTrades - 2 ? new Date(Date.now() - (numTrades - i - 1) * 3600000 * 4).toISOString() : undefined,
                status: i < numTrades - 2 ? 'closed' : 'open',
                holding_period: Math.random() * 24 + 1
            });
        }

        setTrades(mockTrades.reverse());

        // Calculate metrics
        const closedTrades = mockTrades.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl <= 0);

        const avgWin = winningTrades.length > 0 ? 
            winningTrades.reduce((a, b) => a + b.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? 
            Math.abs(losingTrades.reduce((a, b) => a + b.pnl, 0) / losingTrades.length) : 0;

        // Calculate streak
        let streak = 0;
        let streakType: 'win' | 'loss' = 'win';
        for (let i = closedTrades.length - 1; i >= 0; i--) {
            const isWin = closedTrades[i].pnl > 0;
            if (i === closedTrades.length - 1) {
                streakType = isWin ? 'win' : 'loss';
                streak = 1;
            } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
                streak++;
            } else {
                break;
            }
        }

        setMetrics({
            total_pnl: cumPnl,
            total_trades: closedTrades.length,
            winning_trades: winningTrades.length,
            losing_trades: losingTrades.length,
            win_rate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
            avg_win: avgWin,
            avg_loss: avgLoss,
            profit_factor: avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : avgWin > 0 ? 999 : 0,
            max_drawdown: -Math.random() * 0.15,
            current_streak: streak,
            streak_type: streakType,
            best_trade: Math.max(...closedTrades.map(t => t.pnl)),
            worst_trade: Math.min(...closedTrades.map(t => t.pnl)),
            avg_holding_time: closedTrades.reduce((a, b) => a + (b.holding_period || 0), 0) / closedTrades.length,
            sharpe_ratio: 1.2 + Math.random() * 0.8
        });

        // Generate chart data
        const numPoints = timeframe === '1D' ? 24 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : 90;
        const labels: string[] = [];
        const values: number[] = [];
        const cumulative: number[] = [];
        let runningTotal = 0;

        for (let i = 0; i < numPoints; i++) {
            const dailyPnl = (Math.random() - 0.45) * 50;
            runningTotal += dailyPnl;
            
            labels.push(timeframe === '1D' ? 
                `${i}:00` : 
                new Date(Date.now() - (numPoints - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            );
            values.push(dailyPnl);
            cumulative.push(runningTotal);
        }

        setChartData({ labels, values, cumulative });
        setLoading(false);
    }, [timeframe]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await generateData();
        };
        load();
        return () => { mounted = false; };
    }, [generateData]);

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-semibold text-text">P&L Analytics</h2>
                    </div>
                    {metrics && (
                        <StreakIndicator count={metrics.current_streak} type={metrics.streak_type} />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Timeframe selector */}
                    <div className="flex bg-element-bg rounded-lg p-0.5">
                        {(['1D', '1W', '1M', 'ALL'] as const).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                                    timeframe === tf ? 
                                        "bg-brand text-white" : 
                                        "text-text-secondary hover:text-text"
                                )}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={generateData}
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
                    {/* Chart Section */}
                    <div className="col-span-8">
                        <div className="bg-panel-bg rounded-lg border border-border p-4 mb-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-text">Cumulative P&L</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-text-secondary">
                                        {timeframe === '1D' ? 'Today' : 
                                         timeframe === '1W' ? 'This Week' :
                                         timeframe === '1M' ? 'This Month' : 'All Time'}
                                    </span>
                                </div>
                            </div>
                            {chartData && <PnLChart data={chartData} height={250} />}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-4 gap-3">
                            <MetricCard
                                label="Total P&L"
                                value={formatCurrency(metrics?.total_pnl ?? 0)}
                                icon={DollarSign}
                                trend={metrics && metrics.total_pnl >= 0 ? 'up' : 'down'}
                            />
                            <MetricCard
                                label="Win Rate"
                                value={`${((metrics?.win_rate ?? 0) * 100).toFixed(1)}%`}
                                subValue={`${metrics?.winning_trades ?? 0}/${metrics?.total_trades ?? 0}`}
                                icon={Target}
                                trend={(metrics?.win_rate ?? 0) >= 0.5 ? 'up' : 'down'}
                            />
                            <MetricCard
                                label="Profit Factor"
                                value={(metrics?.profit_factor ?? 0).toFixed(2)}
                                icon={BarChart2}
                                trend={(metrics?.profit_factor ?? 0) >= 1.5 ? 'up' : (metrics?.profit_factor ?? 0) < 1 ? 'down' : 'neutral'}
                            />
                            <MetricCard
                                label="Sharpe Ratio"
                                value={(metrics?.sharpe_ratio ?? 0).toFixed(2)}
                                icon={Zap}
                                trend={(metrics?.sharpe_ratio ?? 0) >= 1 ? 'up' : 'neutral'}
                            />
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="col-span-4 space-y-4">
                        {/* Win/Loss Summary */}
                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <h3 className="text-sm font-semibold text-text mb-4">Win/Loss Distribution</h3>
                            <WinLossBar 
                                wins={metrics?.winning_trades ?? 0} 
                                losses={metrics?.losing_trades ?? 0} 
                            />

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="text-center p-3 bg-up/10 rounded-lg">
                                    <div className="text-up text-lg font-bold">{formatCurrency(metrics?.avg_win ?? 0)}</div>
                                    <div className="text-[10px] text-text-secondary uppercase">Avg Win</div>
                                </div>
                                <div className="text-center p-3 bg-down/10 rounded-lg">
                                    <div className="text-down text-lg font-bold">{formatCurrency(metrics?.avg_loss ?? 0)}</div>
                                    <div className="text-[10px] text-text-secondary uppercase">Avg Loss</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <div className="text-center">
                                    <div className="text-up text-sm font-semibold">{formatCurrency(metrics?.best_trade ?? 0)}</div>
                                    <div className="text-[10px] text-text-secondary">Best Trade</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-down text-sm font-semibold">{formatCurrency(metrics?.worst_trade ?? 0)}</div>
                                    <div className="text-[10px] text-text-secondary">Worst Trade</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Trades */}
                        <div className="bg-panel-bg rounded-lg border border-border">
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <h3 className="text-sm font-semibold text-text">Recent Trades</h3>
                                <span className="text-xs text-text-secondary">{trades.length} trades</span>
                            </div>
                            <div className="max-h-[400px] overflow-auto">
                                {trades.slice(0, 10).map(trade => (
                                    <TradeRow key={trade.id} trade={trade} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RealTimePnLAnalytics;
