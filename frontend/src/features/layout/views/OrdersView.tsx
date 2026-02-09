/**
 * Orders View
 * 
 * Full orders page with:
 * - Pending/open orders list
 * - Status, filled qty, avg fill price
 * - Retry state
 * - Filter by run_id
 */

import { useState, useEffect, useCallback } from 'react';
import {
    FileText, RefreshCw, Search
} from 'lucide-react';
import { cn } from '../../../ui/utils';

const API_BASE = '/api/v1';

interface Order {
    id: string;
    client_order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    qty: number;
    filled_qty: number;
    avg_fill_price?: number;
    limit_price?: number;
    stop_price?: number;
    status: 'new' | 'pending' | 'partial' | 'filled' | 'canceled' | 'rejected';
    created_at: string;
    filled_at?: string;
    source: 'manual' | 'autopilot' | 'strategy';
    run_id?: string;
    retry_count: number;
    rejection_reason?: string;
}

export function OrdersView() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [runIdFilter, setRunIdFilter] = useState('');

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/portfolio/orders`;
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
            }
        } catch (err) {
            console.error('Failed to fetch orders:', err);
            // Mock data for demo
            setOrders([
                {
                    id: 'ord-1',
                    client_order_id: 'autopilot_12345',
                    symbol: 'SPY',
                    side: 'buy',
                    type: 'limit',
                    qty: 2,
                    filled_qty: 2,
                    avg_fill_price: 1.25,
                    limit_price: 1.30,
                    status: 'filled',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    filled_at: new Date(Date.now() - 3550000).toISOString(),
                    source: 'autopilot',
                    run_id: 'run-abc123',
                    retry_count: 0
                },
                {
                    id: 'ord-2',
                    client_order_id: 'autopilot_12346',
                    symbol: 'QQQ',
                    side: 'sell',
                    type: 'limit',
                    qty: 1,
                    filled_qty: 0,
                    limit_price: 2.50,
                    status: 'pending',
                    created_at: new Date(Date.now() - 1800000).toISOString(),
                    source: 'autopilot',
                    run_id: 'run-abc124',
                    retry_count: 1
                },
                {
                    id: 'ord-3',
                    client_order_id: 'manual_67890',
                    symbol: 'AAPL',
                    side: 'buy',
                    type: 'market',
                    qty: 100,
                    filled_qty: 100,
                    avg_fill_price: 185.50,
                    status: 'filled',
                    created_at: new Date(Date.now() - 7200000).toISOString(),
                    filled_at: new Date(Date.now() - 7199000).toISOString(),
                    source: 'manual',
                    retry_count: 0
                },
                {
                    id: 'ord-4',
                    client_order_id: 'autopilot_12347',
                    symbol: 'NVDA',
                    side: 'buy',
                    type: 'limit',
                    qty: 1,
                    filled_qty: 0,
                    limit_price: 3.00,
                    status: 'rejected',
                    created_at: new Date(Date.now() - 900000).toISOString(),
                    source: 'autopilot',
                    run_id: 'run-abc125',
                    retry_count: 2,
                    rejection_reason: 'Insufficient buying power'
                }
            ]);
        }
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Filter orders
    const filteredOrders = orders.filter(o => {
        if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
        if (runIdFilter && !o.run_id?.includes(runIdFilter)) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                o.symbol.toLowerCase().includes(q) ||
                o.client_order_id.toLowerCase().includes(q) ||
                o.id.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'filled': return 'bg-green-500/20 text-green-400';
            case 'partial': return 'bg-blue-500/20 text-blue-400';
            case 'pending': case 'new': return 'bg-yellow-500/20 text-yellow-400';
            case 'canceled': return 'bg-gray-500/20 text-gray-400';
            case 'rejected': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <div className="h-full flex flex-col bg-background" data-testid="orders-view">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-panel-bg flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText size={20} className="text-brand" />
                    <h1 className="text-lg font-semibold text-text">Orders</h1>
                    <span className="text-sm text-text-muted">({filteredOrders.length})</span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-48 pl-8 pr-3 py-1.5 text-xs bg-element-bg border border-border rounded focus:outline-none focus:border-brand"
                        />
                    </div>

                    {/* Run ID Filter */}
                    <input
                        type="text"
                        placeholder="Filter by run_id..."
                        value={runIdFilter}
                        onChange={(e) => setRunIdFilter(e.target.value)}
                        className="w-36 px-3 py-1.5 text-xs bg-element-bg border border-border rounded focus:outline-none focus:border-brand"
                    />

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-element-bg border border-border rounded focus:outline-none focus:border-brand"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="filled">Filled</option>
                        <option value="canceled">Canceled</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    {/* Source Filter */}
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-element-bg border border-border rounded focus:outline-none focus:border-brand"
                    >
                        <option value="all">All Sources</option>
                        <option value="autopilot">Autopilot</option>
                        <option value="manual">Manual</option>
                        <option value="strategy">Strategy</option>
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={fetchOrders}
                        disabled={loading}
                        className="p-2 rounded hover:bg-element-bg transition-colors"
                    >
                        <RefreshCw size={16} className={cn("text-text-secondary", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-element-bg sticky top-0 z-10">
                        <tr className="text-text-secondary text-xs">
                            <th className="px-4 py-2 text-left font-medium">Time</th>
                            <th className="px-4 py-2 text-left font-medium">Symbol</th>
                            <th className="px-4 py-2 text-left font-medium">Side</th>
                            <th className="px-4 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-right font-medium">Qty</th>
                            <th className="px-4 py-2 text-right font-medium">Filled</th>
                            <th className="px-4 py-2 text-right font-medium">Price</th>
                            <th className="px-4 py-2 text-center font-medium">Status</th>
                            <th className="px-4 py-2 text-left font-medium">Source</th>
                            <th className="px-4 py-2 text-center font-medium">Retry</th>
                            <th className="px-4 py-2 text-left font-medium">Client Order ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredOrders.map(order => (
                            <tr key={order.id} className="hover:bg-element-bg transition-colors">
                                <td className="px-4 py-2 text-xs text-text-secondary whitespace-nowrap">
                                    {formatTime(order.created_at)}
                                </td>
                                <td className="px-4 py-2 font-medium text-text">{order.symbol}</td>
                                <td className={cn(
                                    "px-4 py-2 uppercase text-xs font-medium",
                                    order.side === 'buy' ? "text-green-400" : "text-red-400"
                                )}>
                                    {order.side}
                                </td>
                                <td className="px-4 py-2 text-text-secondary capitalize">{order.type}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-text">{order.qty}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-text">{order.filled_qty}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-text">
                                    {order.avg_fill_price ? `$${order.avg_fill_price.toFixed(2)}` :
                                        order.limit_price ? `$${order.limit_price.toFixed(2)}` : '-'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium uppercase",
                                        getStatusColor(order.status)
                                    )}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-text-secondary text-xs capitalize">{order.source}</td>
                                <td className="px-4 py-2 text-center">
                                    {order.retry_count > 0 && (
                                        <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
                                            {order.retry_count}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-xs text-text-muted font-mono truncate max-w-[150px]">
                                    {order.client_order_id}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredOrders.length === 0 && (
                    <div className="flex items-center justify-center h-48 text-text-secondary">
                        No orders found
                    </div>
                )}
            </div>
        </div>
    );
}
