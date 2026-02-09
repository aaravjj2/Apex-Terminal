/**
 * Command Center View
 * 
 * Unified dashboard combining Portfolio, Autopilot, and Orders
 * with a tabbed interface for better UX.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw, Activity, Wallet, FileText, Bot,
    TrendingUp, TrendingDown, Shield, AlertTriangle
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import { Badge } from '../../../ui/Badge';
import { useAutopilotStore } from '../../autopilot/store';

const API_BASE = '/api/v1';

// Types
interface Position {
    id: string;
    symbol: string;
    quantity: number;
    avg_cost: number;
    current_price: number;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
    side: string;
    asset_class: string;
    dte?: number;
    managed: boolean;
}

interface Order {
    id: string;
    symbol: string;
    side: string;
    qty: number;
    type: string;
    status: string;
    filled_qty: number;
    limit_price?: number;
    created_at: string;
}

interface Stats {
    total_equity: number;
    total_cash: number;
    buying_power: number;
    open_pnl: number;
    day_pnl: number;
    position_count: number;
    order_count: number;
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export function CommandCenterView() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Autopilot store
    const {
        status: autopilotStatus,
        fetchStatus,
        triggerRun,
        activateKillSwitch
    } = useAutopilotStore();

    // Fetch unified data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/portfolio/unified`);
            if (res.ok) {
                const data = await res.json();
                setPositions(data.positions || []);
                setOrders(data.orders || []);
                setStats(data.stats || null);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error('Failed to fetch data:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        fetchStatus();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData, fetchStatus]);

    const handleRunAutopilot = async () => {
        await triggerRun(true);
        await fetchData();
    };

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="command-center">
            {/* Header Strip */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-text">Command Center</h1>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 ml-4">
                        <div className="flex items-center gap-2">
                            <Wallet size={14} className="text-text-secondary" />
                            <span className="text-sm text-text-secondary">Equity:</span>
                            <span className="text-sm font-semibold text-text">
                                {stats ? formatCurrency(stats.total_equity) : '---'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {(stats?.open_pnl ?? 0) >= 0 ?
                                <TrendingUp size={14} className="text-up" /> :
                                <TrendingDown size={14} className="text-down" />
                            }
                            <span className="text-sm text-text-secondary">P&L:</span>
                            <span className={cn(
                                "text-sm font-semibold",
                                (stats?.open_pnl ?? 0) >= 0 ? "text-up" : "text-down"
                            )}>
                                {stats ? formatCurrency(stats.open_pnl) : '---'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Autopilot Status */}
                    <Badge
                        variant={autopilotStatus?.state === 'running' ? 'success' :
                            autopilotStatus?.state === 'paused' ? 'warning' : 'default'}
                    >
                        <Bot size={12} className="mr-1" />
                        {autopilotStatus?.state?.toUpperCase() || 'IDLE'}
                    </Badge>

                    {/* Kill Switch */}
                    {autopilotStatus?.kill_switch && (
                        <Badge variant="error">
                            <AlertTriangle size={12} className="mr-1" />
                            KILL SWITCH
                        </Badge>
                    )}

                    {/* Actions */}
                    <button
                        onClick={handleRunAutopilot}
                        disabled={loading || autopilotStatus?.kill_switch}
                        className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                        Run Cycle
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded bg-element-bg hover:bg-border transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 border-b border-border bg-panel-bg shrink-0">
                    <TabsList>
                        <TabsTrigger value="overview">
                            <Activity size={12} className="mr-1.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="positions">
                            <Wallet size={12} className="mr-1.5" />
                            Positions ({positions.length})
                        </TabsTrigger>
                        <TabsTrigger value="orders">
                            <FileText size={12} className="mr-1.5" />
                            Orders ({orders.length})
                        </TabsTrigger>
                        <TabsTrigger value="autopilot">
                            <Bot size={12} className="mr-1.5" />
                            Autopilot
                        </TabsTrigger>
                    </TabsList>
                    {lastUpdated && (
                        <span className="text-[10px] text-text-muted ml-4">
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="flex-1 overflow-auto p-4">
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <StatCard label="Total Equity" value={formatCurrency(stats?.total_equity ?? 0)} icon={<Wallet size={16} />} />
                        <StatCard label="Cash" value={formatCurrency(stats?.total_cash ?? 0)} icon={<Wallet size={16} />} />
                        <StatCard label="Open P&L" value={formatCurrency(stats?.open_pnl ?? 0)} positive={(stats?.open_pnl ?? 0) >= 0} icon={<TrendingUp size={16} />} />
                        <StatCard label="Buying Power" value={formatCurrency(stats?.buying_power ?? 0)} icon={<Shield size={16} />} />
                    </div>

                    {/* Recent Positions */}
                    <div className="bg-panel-bg rounded-lg border border-border">
                        <div className="px-4 py-3 border-b border-border">
                            <h3 className="text-sm font-semibold text-text">Recent Positions</h3>
                        </div>
                        <div className="p-4">
                            {positions.length === 0 ? (
                                <p className="text-sm text-text-secondary text-center py-4">No positions</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-text-secondary text-[10px] uppercase">
                                            <th className="text-left py-2">Symbol</th>
                                            <th className="text-right py-2">Qty</th>
                                            <th className="text-right py-2">Value</th>
                                            <th className="text-right py-2">P&L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.slice(0, 5).map(p => (
                                            <tr key={p.id} className="border-t border-border">
                                                <td className="py-2 font-medium">{p.symbol}</td>
                                                <td className="py-2 text-right">{p.quantity}</td>
                                                <td className="py-2 text-right">{formatCurrency(p.market_value)}</td>
                                                <td className={cn("py-2 text-right", p.unrealized_pnl >= 0 ? "text-up" : "text-down")}>
                                                    {formatCurrency(p.unrealized_pnl)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Positions Tab */}
                <TabsContent value="positions" className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-panel-bg border-b border-border">
                            <tr className="text-text-secondary text-[10px] uppercase">
                                <th className="px-4 py-2 text-left">Symbol</th>
                                <th className="px-4 py-2 text-center">Type</th>
                                <th className="px-4 py-2 text-right">Qty</th>
                                <th className="px-4 py-2 text-right">Avg Cost</th>
                                <th className="px-4 py-2 text-right">Current</th>
                                <th className="px-4 py-2 text-right">Value</th>
                                <th className="px-4 py-2 text-right">P&L</th>
                                <th className="px-4 py-2 text-right">DTE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map(p => (
                                <tr key={p.id} className="border-t border-border hover:bg-element-bg">
                                    <td className="px-4 py-2 font-medium">{p.symbol}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge variant={p.asset_class === 'option' ? 'info' : 'default'} size="sm">
                                            {p.asset_class}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-right">{p.quantity}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(p.avg_cost)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(p.current_price)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(p.market_value)}</td>
                                    <td className={cn("px-4 py-2 text-right", p.unrealized_pnl >= 0 ? "text-up" : "text-down")}>
                                        {formatCurrency(p.unrealized_pnl)} ({formatPercent(p.unrealized_pnl_pct)})
                                    </td>
                                    <td className="px-4 py-2 text-right">{p.dte ?? '-'}</td>
                                </tr>
                            ))}
                            {positions.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                                        No positions found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-panel-bg border-b border-border">
                            <tr className="text-text-secondary text-[10px] uppercase">
                                <th className="px-4 py-2 text-left">Time</th>
                                <th className="px-4 py-2 text-left">Symbol</th>
                                <th className="px-4 py-2 text-center">Side</th>
                                <th className="px-4 py-2 text-right">Qty</th>
                                <th className="px-4 py-2 text-right">Filled</th>
                                <th className="px-4 py-2 text-right">Price</th>
                                <th className="px-4 py-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(o => (
                                <tr key={o.id} className="border-t border-border hover:bg-element-bg">
                                    <td className="px-4 py-2">{new Date(o.created_at).toLocaleTimeString()}</td>
                                    <td className="px-4 py-2 font-medium">{o.symbol}</td>
                                    <td className={cn("px-4 py-2 text-center", o.side === 'buy' ? "text-up" : "text-down")}>
                                        {o.side.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-2 text-right">{o.qty}</td>
                                    <td className="px-4 py-2 text-right">{o.filled_qty}</td>
                                    <td className="px-4 py-2 text-right">{o.limit_price ? formatCurrency(o.limit_price) : '-'}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge
                                            variant={o.status === 'filled' ? 'success' :
                                                o.status === 'pending' ? 'warning' :
                                                    o.status === 'rejected' ? 'error' : 'default'}
                                            size="sm"
                                        >
                                            {o.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                                        No orders found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </TabsContent>

                {/* Autopilot Tab */}
                <TabsContent value="autopilot" className="flex-1 overflow-auto p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <h3 className="text-sm font-semibold text-text mb-3">Status</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">State</span>
                                    <Badge variant={autopilotStatus?.state === 'running' ? 'success' : 'default'}>
                                        {autopilotStatus?.state || 'idle'}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Mode</span>
                                    <span className="text-text">{autopilotStatus?.mode || 'paper'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Cycles Completed</span>
                                    <span className="text-text">{autopilotStatus?.cycles_completed || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Win Rate</span>
                                    <span className="text-text">{formatPercent(autopilotStatus?.win_rate ?? 0)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-panel-bg rounded-lg border border-border p-4">
                            <h3 className="text-sm font-semibold text-text mb-3">Controls</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={handleRunAutopilot}
                                    disabled={autopilotStatus?.kill_switch}
                                    className="w-full px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded transition-colors disabled:opacity-50"
                                >
                                    Run Cycle Now
                                </button>
                                <button
                                    onClick={() => activateKillSwitch(true)}
                                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                >
                                    Activate Kill Switch
                                </button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Stat Card Component
function StatCard({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
    return (
        <div className="bg-panel-bg rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-2">
                {icon}
                <span className="text-xs uppercase tracking-wider">{label}</span>
            </div>
            <div className={cn("text-xl font-semibold", positive !== undefined ? (positive ? "text-up" : "text-down") : "text-text")}>
                {value}
            </div>
        </div>
    );
}
