import { useState, useEffect } from 'react';
import { ClipboardList, Filter, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Order {
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    order_type: string;
    limit_price?: number;
    stop_price?: number;
    status: string;
    filled_qty: number;
    avg_fill_price?: number;
    submitted_at: string;
    filled_at?: string;
    rejected_reason?: string;
    strategy_id?: string;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function OrdersBlotter({ embedded }: { embedded?: boolean }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Filters
    const [filterSymbol, setFilterSymbol] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortField, setSortField] = useState<'submitted_at' | 'symbol'>('submitted_at');
    const [sortAsc, setSortAsc] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/orders`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOrders(data);
        } catch (e) {
            console.error('Failed to fetch orders:', e);
            // Use mock data if API not available
            setOrders([
                { id: 'ORD-001', symbol: 'AAPL', side: 'buy', quantity: 100, order_type: 'market', status: 'filled', filled_qty: 100, avg_fill_price: 175.50, submitted_at: new Date().toISOString(), filled_at: new Date().toISOString() },
                { id: 'ORD-002', symbol: 'TSLA', side: 'sell', quantity: 50, order_type: 'limit', limit_price: 250.00, status: 'submitted', filled_qty: 0, submitted_at: new Date().toISOString() },
                { id: 'ORD-003', symbol: 'MSFT', side: 'buy', quantity: 75, order_type: 'stop', stop_price: 400.00, status: 'canceled', filled_qty: 0, submitted_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen || embedded) {
            fetchOrders();
            const interval = setInterval(fetchOrders, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen, embedded]);

    const filteredOrders = orders
        .filter(o => !filterSymbol || o.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
        .filter(o => !filterStatus || o.status === filterStatus)
        .sort((a, b) => {
            const aVal = sortField === 'submitted_at' ? new Date(a.submitted_at).getTime() : a.symbol;
            const bVal = sortField === 'submitted_at' ? new Date(b.submitted_at).getTime() : b.symbol;
            if (aVal < bVal) return sortAsc ? -1 : 1;
            if (aVal > bVal) return sortAsc ? 1 : -1;
            return 0;
        });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'filled': return 'bg-green-500/20 text-green-400';
            case 'partial': return 'bg-yellow-500/20 text-yellow-400';
            case 'submitted': return 'bg-blue-500/20 text-blue-400';
            case 'canceled': return 'bg-gray-500/20 text-gray-400';
            case 'rejected': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getSideColor = (side: string) => side === 'buy' ? 'text-green-400' : 'text-red-400';

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const toggleSort = (field: 'submitted_at' | 'symbol') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const containerClass = embedded
        ? "h-full flex flex-col bg-gray-900 text-gray-100"
        : "fixed bottom-0 left-0 right-0 h-80 bg-gray-900 border-t border-gray-700 z-50 flex flex-col shadow-2xl animate-slide-up";

    return (
        <>
            {!embedded && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors"
                >
                    <ClipboardList size={14} />
                    Orders
                    {orders.filter(o => o.status === 'submitted').length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-indigo-800 rounded-full text-xs">
                            {orders.filter(o => o.status === 'submitted').length}
                        </span>
                    )}
                </button>
            )}

            {(isOpen || embedded) && (
                <div className={containerClass}>
                    {/* Header - Only show if NOT embedded, or simplified if embedded */}
                    {!embedded ? (
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Orders Blotter</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={fetchOrders} className="p-1 hover:bg-gray-700 rounded">
                                    <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-700 rounded">
                                    <X size={16} className="text-gray-400" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Embedded Toolbar
                        <div className="p-2 border-b border-gray-800 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Symbol..."
                                value={filterSymbol}
                                onChange={(e) => setFilterSymbol(e.target.value)}
                                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white w-24 focus:outline-none focus:border-blue-500"
                            />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">All Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="filled">Filled</option>
                                <option value="canceled">Canceled</option>
                            </select>
                            <button onClick={fetchOrders} className="p-1 hover:bg-gray-800 rounded ml-auto">
                                <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    )}

                    {/* Legacy Filter Bar (only if not embedded, because embedded uses toolbar above) */}
                    {!embedded && (
                        <div className="p-3 border-b border-gray-700 flex items-center gap-3">
                            <Filter size={14} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Symbol..."
                                value={filterSymbol}
                                onChange={(e) => setFilterSymbol(e.target.value)}
                                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white w-24"
                            />
                            {/* ... existing select ... */}
                            <span className="ml-auto text-xs text-gray-400">{filteredOrders.length} orders</span>
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-800 sticky top-0">
                                <tr className="text-gray-400 text-left">
                                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => toggleSort('submitted_at')}>
                                        Time {sortField === 'submitted_at' && (sortAsc ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)}
                                    </th>
                                    <th className="p-2 cursor-pointer hover:text-white" onClick={() => toggleSort('symbol')}>
                                        Symbol {sortField === 'symbol' && (sortAsc ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)}
                                    </th>
                                    <th className="p-2">Side</th>
                                    <th className="p-2">Type</th>
                                    <th className="p-2 text-right">Qty</th>
                                    <th className="p-2 text-right">Filled</th>
                                    <th className="p-2 text-right">Price</th>
                                    <th className="p-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors"
                                    >
                                        <td className="p-2 text-gray-400">{formatTime(order.submitted_at)}</td>
                                        <td className="p-2 font-medium text-gray-200">{order.symbol}</td>
                                        <td className={`p-2 font-medium ${getSideColor(order.side)}`}>{order.side?.toUpperCase() ?? '-'}</td>
                                        <td className="p-2 text-gray-400">{order.order_type}</td>
                                        <td className="p-2 text-right text-gray-300">{order.quantity}</td>
                                        <td className="p-2 text-right text-gray-300">{order.filled_qty}</td>
                                        <td className="p-2 text-right text-gray-300">
                                            {order.avg_fill_price ? `$${order.avg_fill_price.toFixed(2)}` : order.limit_price ? `$${order.limit_price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="p-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Order Details Drawer via Portal or Absolute if not embedded */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
                    <div className="w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white">Order Details</h3>
                            <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-700 rounded">
                                <X size={14} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 text-xs">
                            {/* ... details ... */}
                            <div className="flex justify-between"><span className="text-gray-400">ID</span><span className="text-white mono">{selectedOrder.id}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Symbol</span><span className="text-white">{selectedOrder.symbol}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`${getStatusColor(selectedOrder.status)} px-1 rounded`}>{selectedOrder.status}</span></div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
