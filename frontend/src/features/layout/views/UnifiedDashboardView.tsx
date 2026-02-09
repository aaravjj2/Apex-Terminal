/**
 * Unified Dashboard View
 * 
 * Complete dashboard as per acceptance checklist:
 * - B1: Page header strip (symbol, timeframe, buttons)
 * - B2: Main grid (Supergraph + AI Panel)
 * - E: Today operational strip
 * - F: Unified Positions widget
 * - G: Unified Orders widget
 * - H: Event log feed
 * - I: Settings mini view
 */

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw, Play, Eye, ChevronDown, Activity,
    TrendingUp, TrendingDown, Wallet, FileText, Settings,
    Maximize2, Minimize2, Filter
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { SupergraphModule } from './SupergraphModule';
import { AIPanel } from './AIPanel';
import { TradeLifecycleDrawer } from './TradeLifecycleDrawer';

const API_BASE = '/api/v1';

// Types
interface DailyStats {
    realized_pnl: number;
    unrealized_pnl: number;
    daily_loss_cap_used: number;
    daily_loss_cap_remaining: number;
    total_open_risk: number;
    max_open_risk: number;
    trades_opened: number;
    trades_closed: number;
    monitoring_passes: number;
}

interface Position {
    id: string;
    symbol: string;
    type: 'equity' | 'option';
    strategy_tag?: string;
    size: number;
    entry_time: string;
    current_pnl: number;
    pnl_percent: number;
    dte?: number;
    status: 'healthy' | 'near_stop' | 'near_profit' | 'time_stop_soon';
}

interface Order {
    id: string;
    client_order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    status: 'pending' | 'partial' | 'filled' | 'rejected';
    qty: number;
    filled_qty: number;
    avg_fill_price?: number;
    retry_count: number;
    run_id?: string;
}

interface EventLogEntry {
    id: string;
    timestamp: string;
    type: 'monitoring' | 'exit' | 'order' | 'trade_update' | 'provider' | 'error';
    message: string;
    severity: 'info' | 'warning' | 'error';
    link_type?: 'run' | 'order' | 'position';
    link_id?: string;
}

interface RiskCaps {
    max_risk_per_trade: number;
    max_open_risk: number;
    max_trades_per_day: number;
    max_daily_loss: number;
}

interface SelectedTrade {
    id: string;
    symbol: string;
    strategy: string;
    timestamp: number;
    side: 'entry' | 'exit';
}

// Helper functions - defined before component to avoid hoisting issues
const getPositionStatus = (p: { dte?: number; pnl_percent?: number }): Position['status'] => {
    if (p.dte && p.dte <= 1) return 'time_stop_soon';
    if (p.pnl_percent && p.pnl_percent >= 40) return 'near_profit';
    if (p.pnl_percent && p.pnl_percent <= -30) return 'near_stop';
    return 'healthy';
};

const mapEventType = (type: string): EventLogEntry['type'] => {
    if (type?.includes('monitoring')) return 'monitoring';
    if (type?.includes('exit')) return 'exit';
    if (type?.includes('order')) return 'order';
    if (type?.includes('trade')) return 'trade_update';
    if (type?.includes('provider') || type?.includes('outage')) return 'provider';
    return 'error';
};

export function UnifiedDashboardView() {
    // State
    const [selectedSymbol, setSelectedSymbol] = useState('SPY');
    void setSelectedSymbol; // Mark as intentionally unused for now
    const [timeframe, setTimeframe] = useState('1D');
    const [focusMode, setFocusMode] = useState(false);
    const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
    const [riskCaps, setRiskCaps] = useState<RiskCaps | null>(null);
    const [enabledStrategies, setEnabledStrategies] = useState<string[]>([]);
    const [sentimentGatesEnabled, setSentimentGatesEnabled] = useState(false);
    const [autopilotSchedule, setAutopilotSchedule] = useState('');
    const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Symbols list
    const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN'];
    void symbols; // Mark as intentionally unused for now
    const timeframes = ['1D', '5D', '1M', '3M', '1Y'];

    // Fetch daily stats
    const fetchDailyStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/report`);
            if (res.ok) {
                const data = await res.json();
                const report = data.report || {};
                setDailyStats({
                    realized_pnl: report.realized_pnl || 0,
                    unrealized_pnl: report.unrealized_pnl || 0,
                    daily_loss_cap_used: report.daily_loss_used || 0,
                    daily_loss_cap_remaining: report.daily_loss_remaining || 100,
                    total_open_risk: report.total_open_risk || 0,
                    max_open_risk: report.max_open_risk || 500,
                    trades_opened: report.trades_opened || 0,
                    trades_closed: report.trades_closed || 0,
                    monitoring_passes: report.monitoring_passes || 0
                });
            }
        } catch (err) {
            console.error('Failed to fetch daily stats:', err);
        }
    }, []);

    // Fetch positions
    const fetchPositions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/positions?status=open`);
            if (res.ok) {
                const data = await res.json();
                const pos = (data.positions || []).slice(0, 10).map((p: any) => ({
                    id: p.position_id,
                    symbol: p.symbol,
                    type: p.legs?.length > 0 ? 'option' : 'equity',
                    strategy_tag: p.template || 'manual',
                    size: p.quantity,
                    entry_time: p.entry_time,
                    current_pnl: p.unrealized_pnl || 0,
                    pnl_percent: p.pnl_percent || 0,
                    dte: p.dte,
                    status: getPositionStatus(p)
                }));
                setPositions(pos);
            }
        } catch (err) {
            console.error('Failed to fetch positions:', err);
        }
    }, []);

    // Fetch orders
    const fetchOrders = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/portfolio/orders?status=open`);
            if (res.ok) {
                const data = await res.json();
                const ords = (data.orders || []).slice(0, 10).map((o: any) => ({
                    id: o.id,
                    client_order_id: o.client_order_id,
                    symbol: o.symbol,
                    side: o.side,
                    status: o.status,
                    qty: o.qty,
                    filled_qty: o.filled_qty || 0,
                    avg_fill_price: o.avg_fill_price,
                    retry_count: o.retry_count || 0,
                    run_id: o.run_id
                }));
                setOrders(ords);
            }
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        }
    }, []);

    // Fetch event log
    const fetchEventLog = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/logs?limit=20`);
            if (res.ok) {
                const data = await res.json();
                const logs = (data.logs || []).map((l: any, idx: number) => ({
                    id: `event-${idx}`,
                    timestamp: l.timestamp,
                    type: mapEventType(l.event_type),
                    message: l.message || l.event_type,
                    severity: l.level === 'error' ? 'error' : l.level === 'warning' ? 'warning' : 'info',
                    link_type: l.run_id ? 'run' : l.order_id ? 'order' : undefined,
                    link_id: l.run_id || l.order_id
                }));
                setEventLog(logs);
            }
        } catch (err) {
            console.error('Failed to fetch event log:', err);
        }
    }, []);

    // Fetch config
    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/config`);
            if (res.ok) {
                const data = await res.json();
                const config = data.config || {};
                setRiskCaps({
                    max_risk_per_trade: config.risk_limits?.max_risk_per_trade || 50,
                    max_open_risk: config.risk_limits?.max_total_risk || 500,
                    max_trades_per_day: config.risk_limits?.max_open_positions || 10,
                    max_daily_loss: config.risk_limits?.max_daily_loss || 100
                });
                setEnabledStrategies(config.strategy_constraints?.allowed_templates || []);
                setSentimentGatesEnabled(config.forecast_settings?.enabled || false);
                setAutopilotSchedule(`Every ${config.schedule?.interval_minutes || 15}min (market hours)`);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    }, []);

    // Run autopilot now
    const runAutopilotNow = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/autopilot/cycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dry_run: false, force: false })
            });
            const result = await response.json();
            console.log('Autopilot cycle result:', result);
            await Promise.all([fetchDailyStats(), fetchPositions(), fetchOrders(), fetchEventLog()]);
        } catch (err) {
            console.error('Failed to run autopilot:', err);
        }
        setLoading(false);
    };

    // Run monitoring now
    const runMonitoringNow = async () => {
        setLoading(true);
        try {
            await fetch(`${API_BASE}/autopilot/cycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true })
            });
            await Promise.all([fetchDailyStats(), fetchPositions(), fetchEventLog()]);
        } catch (err) {
            console.error('Failed to run monitoring:', err);
        }
        setLoading(false);
    };

    // Handle trade marker click
    const handleTradeClick = (trade: SelectedTrade) => {
        setSelectedTrade(trade);
        setDrawerOpen(true);
    };

    // Initial fetch
    useEffect(() => {
        fetchDailyStats();
        fetchPositions();
        fetchOrders();
        fetchEventLog();
        fetchConfig();
    }, [fetchDailyStats, fetchPositions, fetchOrders, fetchEventLog, fetchConfig]);

    // Polling
    useEffect(() => {
        const interval = setInterval(() => {
            fetchDailyStats();
            fetchPositions();
            fetchOrders();
            fetchEventLog();
        }, 60000); // Poll every 60s to reduce backend load
        return () => clearInterval(interval);
    }, [fetchDailyStats, fetchPositions, fetchOrders, fetchEventLog]);

    const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(v);

    void formatCurrency; // Mark as used if needed later

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="unified-dashboard">
            {/* B1: Page Header Strip */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-3">
                    {/* Symbol Dropdown */}
                    <div className="relative">
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-element-bg hover:bg-border transition-colors"
                            data-testid="symbol-selector"
                        >
                            <span className="font-semibold text-text">{selectedSymbol}</span>
                            <ChevronDown size={14} className="text-text-secondary" />
                        </button>
                    </div>

                    {/* Timeframe Selector */}
                    <div className="flex items-center gap-1 bg-element-bg rounded-lg p-0.5" data-testid="timeframe-selector">
                        {timeframes.map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={cn(
                                    "px-2 py-1 text-xs rounded transition-colors",
                                    timeframe === tf
                                        ? "bg-brand text-white"
                                        : "text-text-secondary hover:text-text"
                                )}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Start Risk Desk Demo */}
                    <button
                        onClick={() => {
                            // Dispatch custom event for Shell to navigate
                            window.dispatchEvent(new CustomEvent('navigate-risk-desk', { detail: { loadDemo: true } }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                        data-testid="start-risk-desk-demo-btn"
                    >
                        <TrendingUp size={14} />
                        Start Risk Desk Demo
                    </button>
                
                    {/* Run Autopilot Now */}
                    <button
                        onClick={runAutopilotNow}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        data-testid="run-autopilot-btn"
                    >
                        <Play size={14} />
                        Run Autopilot Now
                    </button>

                    {/* Run Monitoring Now */}
                    <button
                        onClick={runMonitoringNow}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-element-bg hover:bg-border text-text text-xs font-medium transition-colors disabled:opacity-50"
                        data-testid="run-monitoring-btn"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Run Monitoring Now
                    </button>

                    {/* Explain Last Action */}
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-element-bg hover:bg-border text-text text-xs font-medium transition-colors"
                        data-testid="explain-action-btn"
                    >
                        <Eye size={14} />
                        Explain last action
                    </button>

                    {/* Focus Mode Toggle */}
                    <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            focusMode ? "bg-brand text-white" : "bg-element-bg text-text-secondary hover:text-text"
                        )}
                        title="Focus Mode"
                        data-testid="focus-mode-toggle"
                    >
                        {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </div>

            {/* B2: Main Grid */}
            <div className={cn("flex-1 flex overflow-hidden", focusMode && "flex-col")}>
                {/* Left Column - Supergraph */}
                <div className={cn("flex-1 flex flex-col overflow-hidden", !focusMode && "border-r border-border")}>
                    <SupergraphModule
                        symbol={selectedSymbol}
                        timeframe={timeframe}
                        onTradeClick={handleTradeClick}
                    />
                </div>

                {/* Right Column - AI Panel (hidden in focus mode) */}
                {!focusMode && (
                    <div className="w-[400px] flex flex-col overflow-hidden">
                        <AIPanel symbol={selectedSymbol} />
                    </div>
                )}
            </div>

            {/* E: Today Operational Strip */}
            <div className="h-12 px-4 flex items-center justify-between border-t border-border bg-panel-bg shrink-0" data-testid="today-strip">
                <div className="flex items-center gap-6">
                    {/* Realized P&L */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-text-secondary">Realized P&L</span>
                        <span className={cn(
                            "text-sm font-semibold tabular-nums",
                            (dailyStats?.realized_pnl || 0) >= 0 ? "text-up" : "text-down"
                        )}>
                            {dailyStats ? `${dailyStats.realized_pnl >= 0 ? '+' : ''}${formatCurrency(dailyStats.realized_pnl)}` : '--'}
                        </span>
                    </div>

                    {/* Unrealized P&L */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-text-secondary">Unrealized P&L</span>
                        <span className={cn(
                            "text-sm font-semibold tabular-nums",
                            (dailyStats?.unrealized_pnl || 0) >= 0 ? "text-up" : "text-down"
                        )}>
                            {dailyStats ? `${dailyStats.unrealized_pnl >= 0 ? '+' : ''}${formatCurrency(dailyStats.unrealized_pnl)}` : '--'}
                        </span>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Daily Loss Cap */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-text-secondary">Daily Loss Cap</span>
                        <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-element-bg rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-500 transition-all"
                                    style={{ width: `${dailyStats ? (dailyStats.daily_loss_cap_used / (dailyStats.daily_loss_cap_used + dailyStats.daily_loss_cap_remaining)) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-xs text-text-secondary tabular-nums">
                                {dailyStats ? `$${dailyStats.daily_loss_cap_used}/$${dailyStats.daily_loss_cap_used + dailyStats.daily_loss_cap_remaining}` : '--'}
                            </span>
                        </div>
                    </div>

                    {/* Open Risk */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-text-secondary">Open Risk</span>
                        <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-element-bg rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-yellow-500 transition-all"
                                    style={{ width: `${dailyStats ? (dailyStats.total_open_risk / dailyStats.max_open_risk) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-xs text-text-secondary tabular-nums">
                                {dailyStats ? `$${dailyStats.total_open_risk}/$${dailyStats.max_open_risk}` : '--'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Trades Opened */}
                    <div className="flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-up" />
                        <span className="text-xs text-text-secondary">Opened:</span>
                        <span className="text-xs font-medium text-text tabular-nums">{dailyStats?.trades_opened || 0}</span>
                    </div>

                    {/* Trades Closed */}
                    <div className="flex items-center gap-1.5">
                        <TrendingDown size={12} className="text-down" />
                        <span className="text-xs text-text-secondary">Closed:</span>
                        <span className="text-xs font-medium text-text tabular-nums">{dailyStats?.trades_closed || 0}</span>
                    </div>

                    {/* Monitoring Passes */}
                    <div className="flex items-center gap-1.5">
                        <Activity size={12} className="text-brand" />
                        <span className="text-xs text-text-secondary">Passes:</span>
                        <span className="text-xs font-medium text-text tabular-nums">{dailyStats?.monitoring_passes || 0}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Positions + Orders + Events + Settings */}
            <div className="h-48 border-t border-border flex shrink-0 overflow-hidden">
                {/* F: Positions Widget */}
                <div className="flex-1 flex flex-col border-r border-border">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-element-bg">
                        <div className="flex items-center gap-2">
                            <Wallet size={14} className="text-text-secondary" />
                            <span className="text-xs font-medium text-text">Positions</span>
                            <span className="text-[10px] text-text-muted">({positions.length})</span>
                        </div>
                        <button className="text-[10px] text-brand hover:underline">View All →</button>
                    </div>
                    <div className="flex-1 overflow-y-auto" data-testid="positions-widget">
                        {positions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-text-secondary text-xs">No open positions</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-panel-bg sticky top-0">
                                    <tr className="text-text-secondary">
                                        <th className="px-2 py-1.5 text-left font-medium">Symbol</th>
                                        <th className="px-2 py-1.5 text-left font-medium">Type</th>
                                        <th className="px-2 py-1.5 text-right font-medium">Size</th>
                                        <th className="px-2 py-1.5 text-right font-medium">P&L</th>
                                        <th className="px-2 py-1.5 text-right font-medium">DTE</th>
                                        <th className="px-2 py-1.5 text-center font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {positions.map(pos => (
                                        <tr key={pos.id} className="hover:bg-element-bg cursor-pointer transition-colors">
                                            <td className="px-2 py-1.5 font-medium text-text">{pos.symbol}</td>
                                            <td className="px-2 py-1.5 text-text-secondary">{pos.type}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums text-text">{pos.size}</td>
                                            <td className={cn("px-2 py-1.5 text-right tabular-nums", pos.current_pnl >= 0 ? "text-up" : "text-down")}>
                                                {formatCurrency(pos.current_pnl)}
                                            </td>
                                            <td className="px-2 py-1.5 text-right tabular-nums text-text-secondary">{pos.dte ?? '-'}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                                    pos.status === 'healthy' ? "bg-green-500/20 text-green-400" :
                                                        pos.status === 'near_profit' ? "bg-blue-500/20 text-blue-400" :
                                                            pos.status === 'near_stop' ? "bg-red-500/20 text-red-400" :
                                                                "bg-yellow-500/20 text-yellow-400"
                                                )}>
                                                    {pos.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* G: Orders Widget */}
                <div className="w-72 flex flex-col border-r border-border">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-element-bg">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-text-secondary" />
                            <span className="text-xs font-medium text-text">Orders</span>
                            <span className="text-[10px] text-text-muted">({orders.length})</span>
                        </div>
                        <button className="text-[10px] text-brand hover:underline">View All →</button>
                    </div>
                    <div className="flex-1 overflow-y-auto" data-testid="orders-widget">
                        {orders.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-text-secondary text-xs">No pending orders</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {orders.map(order => (
                                    <div key={order.id} className="px-2 py-1.5 hover:bg-element-bg transition-colors cursor-pointer">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-text">{order.symbol}</span>
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[10px]",
                                                order.status === 'filled' ? "bg-green-500/20 text-green-400" :
                                                    order.status === 'pending' ? "bg-yellow-500/20 text-yellow-400" :
                                                        order.status === 'partial' ? "bg-blue-500/20 text-blue-400" :
                                                            "bg-red-500/20 text-red-400"
                                            )}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-text-secondary mt-0.5">
                                            <span>{order.side.toUpperCase()} {order.filled_qty}/{order.qty}</span>
                                            {order.avg_fill_price && <span>${order.avg_fill_price.toFixed(2)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* H: Event Log */}
                <div className="w-80 flex flex-col border-r border-border">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-element-bg">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-text-secondary" />
                            <span className="text-xs font-medium text-text">Event Log</span>
                        </div>
                        <button className="p-1 hover:bg-border rounded transition-colors">
                            <Filter size={12} className="text-text-secondary" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto" data-testid="event-log">
                        {eventLog.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-text-secondary text-xs">No events</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {eventLog.map(event => (
                                    <div key={event.id} className="px-2 py-1.5 hover:bg-element-bg transition-colors cursor-pointer">
                                        <div className="flex items-start gap-2">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                                event.severity === 'error' ? "bg-red-500" :
                                                    event.severity === 'warning' ? "bg-yellow-500" :
                                                        "bg-blue-500"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-text truncate">{event.message}</p>
                                                <p className="text-[9px] text-text-muted">
                                                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* I: Settings Mini View */}
                <div className="w-56 flex flex-col">
                    <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-element-bg">
                        <Settings size={14} className="text-text-secondary" />
                        <span className="text-xs font-medium text-text">Risk Caps</span>
                    </div>
                    <div className="flex-1 p-2 overflow-y-auto" data-testid="settings-mini">
                        <div className="space-y-2 text-[10px]">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Max Risk/Trade</span>
                                <span className="text-text tabular-nums">${riskCaps?.max_risk_per_trade || '--'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Max Open Risk</span>
                                <span className="text-text tabular-nums">${riskCaps?.max_open_risk || '--'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Max Trades/Day</span>
                                <span className="text-text tabular-nums">{riskCaps?.max_trades_per_day || '--'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Max Daily Loss</span>
                                <span className="text-text tabular-nums">${riskCaps?.max_daily_loss || '--'}</span>
                            </div>

                            <div className="pt-2 mt-2 border-t border-border">
                                <div className="flex justify-between mb-1">
                                    <span className="text-text-secondary">Strategies</span>
                                    <span className="text-text">{enabledStrategies.length} enabled</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-text-secondary">Sentiment Gates</span>
                                    <span className={sentimentGatesEnabled ? "text-green-400" : "text-text-muted"}>
                                        {sentimentGatesEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Schedule</span>
                                    <span className="text-text truncate ml-2">{autopilotSchedule || '--'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trade Lifecycle Drawer */}
            {drawerOpen && selectedTrade && (
                <TradeLifecycleDrawer
                    trade={selectedTrade}
                    onClose={() => setDrawerOpen(false)}
                />
            )}
        </div>
    );
}
