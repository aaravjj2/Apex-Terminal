import { useState, useEffect } from 'react';
import { Bell, X, Filter, Check, AlertTriangle, Clock, Trash2 } from 'lucide-react';

interface AlertTrigger {
    id: string;
    alert_id: string;
    alert_name: string;
    symbol: string;
    condition: string;
    target_value: number;
    triggered_value: number;
    timestamp: string;
    acknowledged: boolean;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function AlertFeed() {
    const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [showToast, setShowToast] = useState<AlertTrigger | null>(null);

    const fetchTriggers = async () => {
        try {
            const res = await fetch(`${API_BASE}/alerts/triggers`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // Check for new triggers
            if (data.length > triggers.length) {
                const newest = data[0];
                if (!newest.acknowledged) {
                    setShowToast(newest);
                    setTimeout(() => setShowToast(null), 5000);
                }
            }

            setTriggers(data);
        } catch (e) {
            console.error('Failed to fetch triggers:', e);
            // Mock data
            setTriggers([
                { id: '1', alert_id: 'A1', alert_name: 'AAPL Above 180', symbol: 'AAPL', condition: 'price_above', target_value: 180, triggered_value: 181.25, timestamp: new Date().toISOString(), acknowledged: false },
                { id: '2', alert_id: 'A2', alert_name: 'TSLA Below 250', symbol: 'TSLA', condition: 'price_below', target_value: 250, triggered_value: 248.50, timestamp: new Date(Date.now() - 3600000).toISOString(), acknowledged: true },
                { id: '3', alert_id: 'A3', alert_name: 'RSI Oversold', symbol: 'MSFT', condition: 'rsi_below', target_value: 30, triggered_value: 28.5, timestamp: new Date(Date.now() - 7200000).toISOString(), acknowledged: true },
            ]);
        }
    };

    useEffect(() => {
        fetchTriggers();
        const interval = setInterval(fetchTriggers, 5000);
        return () => clearInterval(interval);
    }, []);

    const acknowledge = (id: string) => {
        setTriggers(prev => prev.map(t => t.id === id ? { ...t, acknowledged: true } : t));
    };

    const acknowledgeAll = () => {
        setTriggers(prev => prev.map(t => ({ ...t, acknowledged: true })));
    };

    const clearAll = () => {
        setTriggers([]);
    };

    const filteredTriggers = triggers.filter(t => {
        if (filter === 'unread') return !t.acknowledged;
        if (filter === 'read') return t.acknowledged;
        return true;
    });

    const unreadCount = triggers.filter(t => !t.acknowledged).length;

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    const formatCondition = (cond: string) => cond.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <>
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
                    <div className="bg-orange-600 border border-orange-500 rounded-lg shadow-lg p-4 max-w-sm flex items-start gap-3">
                        <AlertTriangle className="text-white shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-white">{showToast.alert_name}</div>
                            <div className="text-xs text-orange-100 mt-1">
                                {showToast.symbol}: {formatCondition(showToast.condition)} @ ${showToast.triggered_value.toFixed(2)}
                            </div>
                        </div>
                        <button onClick={() => setShowToast(null)} className="text-orange-200 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded transition-colors"
            >
                <Bell size={14} />
                Alert Feed
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Feed Panel */}
            {isOpen && (
                <div className="fixed right-4 top-20 z-50 w-96 max-h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
                    <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Alert Feed</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={acknowledgeAll} className="text-xs text-gray-400 hover:text-white">Mark all read</button>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-700 rounded">
                                <X size={14} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-2 border-b border-gray-700 flex items-center gap-2">
                        <Filter size={12} className="text-gray-400" />
                        {(['all', 'unread', 'read'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2 py-1 rounded text-xs ${filter === f ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
                            </button>
                        ))}
                        <button onClick={clearAll} className="ml-auto p-1 hover:bg-gray-700 rounded text-gray-400">
                            <Trash2 size={12} />
                        </button>
                    </div>

                    {/* Triggers List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredTriggers.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">No alerts triggered</div>
                        ) : (
                            filteredTriggers.map(t => (
                                <div
                                    key={t.id}
                                    className={`p-3 border-b border-gray-700 hover:bg-gray-750 cursor-pointer ${!t.acknowledged ? 'bg-orange-900/20' : ''}`}
                                    onClick={() => acknowledge(t.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            {!t.acknowledged ? (
                                                <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                                            ) : (
                                                <Check size={14} className="text-gray-500 shrink-0" />
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-white">{t.alert_name}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {t.symbol}: {formatCondition(t.condition)} @ ${t.triggered_value.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Clock size={10} />
                                            {formatTime(t.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
