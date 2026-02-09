import { useState, useEffect } from 'react';
import { History, X, ArrowRight, Circle } from 'lucide-react';

interface AuditEvent {
    id: string;
    timestamp: string;
    type: 'signal' | 'order' | 'fill' | 'portfolio' | 'risk';
    symbol?: string;
    details: Record<string, unknown>;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function AuditTrail({ onClose }: { onClose: () => void }) {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [_loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/audit`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setEvents(data);
            } catch (e) {
                // Mock data showing a complete trade lifecycle
                setEvents([
                    { id: '1', timestamp: new Date(Date.now() - 300000).toISOString(), type: 'signal', symbol: 'AAPL', details: { action: 'BUY', indicator: 'SMA crossover', price: 175.00 } },
                    { id: '2', timestamp: new Date(Date.now() - 299000).toISOString(), type: 'risk', symbol: 'AAPL', details: { check: 'position_limit', result: 'PASSED', current: 5000, max: 10000 } },
                    { id: '3', timestamp: new Date(Date.now() - 298000).toISOString(), type: 'order', symbol: 'AAPL', details: { side: 'buy', qty: 100, type: 'market', order_id: 'ORD-001' } },
                    { id: '4', timestamp: new Date(Date.now() - 295000).toISOString(), type: 'fill', symbol: 'AAPL', details: { qty: 100, price: 175.25, order_id: 'ORD-001' } },
                    { id: '5', timestamp: new Date(Date.now() - 294000).toISOString(), type: 'portfolio', symbol: 'AAPL', details: { action: 'position_opened', qty: 100, avg_cost: 175.25, market_value: 17525 } },
                    { id: '6', timestamp: new Date(Date.now() - 60000).toISOString(), type: 'signal', symbol: 'AAPL', details: { action: 'SELL', indicator: 'SMA crossover', price: 178.50 } },
                    { id: '7', timestamp: new Date(Date.now() - 59000).toISOString(), type: 'order', symbol: 'AAPL', details: { side: 'sell', qty: 100, type: 'market', order_id: 'ORD-002' } },
                    { id: '8', timestamp: new Date(Date.now() - 56000).toISOString(), type: 'fill', symbol: 'AAPL', details: { qty: 100, price: 178.40, order_id: 'ORD-002' } },
                    { id: '9', timestamp: new Date(Date.now() - 55000).toISOString(), type: 'portfolio', symbol: 'AAPL', details: { action: 'position_closed', realized_pnl: 315, return_pct: 1.80 } },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'signal': return { color: 'text-blue-400', bg: 'bg-blue-500/20' };
            case 'order': return { color: 'text-purple-400', bg: 'bg-purple-500/20' };
            case 'fill': return { color: 'text-green-400', bg: 'bg-green-500/20' };
            case 'portfolio': return { color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
            case 'risk': return { color: 'text-orange-400', bg: 'bg-orange-500/20' };
            default: return { color: 'text-gray-400', bg: 'bg-gray-500/20' };
        }
    };

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const formatDetails = (details: Record<string, unknown>) => {
        return Object.entries(details).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-700 rounded text-[10px] mr-1 mb-1">
                <span className="text-gray-400">{k}:</span>
                <span className="text-white">{typeof v === 'number' ? (Number.isInteger(v) ? v : (v as number).toFixed(2)) : String(v)}</span>
            </span>
        ));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[700px] h-[550px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <History size={20} />
                        Audit Trail
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-3 border-b border-gray-700 text-xs text-gray-400">
                    Signal → Risk Check → Order → Fill → Portfolio Update
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[72px] top-0 bottom-0 w-0.5 bg-gray-700" />

                        {events.map((event, idx) => {
                            const style = getTypeStyle(event.type);
                            return (
                                <div key={event.id} className="relative flex items-start gap-4 mb-4">
                                    {/* Time */}
                                    <div className="w-16 text-right text-xs text-gray-500 pt-0.5 shrink-0">
                                        {formatTime(event.timestamp)}
                                    </div>

                                    {/* Dot */}
                                    <div className={`relative z-10 w-4 h-4 rounded-full ${style.bg} flex items-center justify-center shrink-0`}>
                                        <Circle size={8} className={style.color} fill="currentColor" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.color}`}>
                                                {event.type.toUpperCase()}
                                            </span>
                                            {event.symbol && (
                                                <span className="text-sm font-medium text-white">{event.symbol}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap">
                                            {formatDetails(event.details)}
                                        </div>
                                    </div>

                                    {/* Arrow to next */}
                                    {idx < events.length - 1 && (
                                        <ArrowRight size={12} className="absolute left-[68px] top-6 text-gray-600" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
                    Showing {events.length} events
                </div>
            </div>
        </div>
    );
}
