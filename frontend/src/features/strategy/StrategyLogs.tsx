import { useState, useEffect, useRef } from 'react';
import { FileText, X, RefreshCw, Filter, Circle } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'signal' | 'order' | 'fill' | 'error' | 'warning';
    message: string;
    data?: Record<string, unknown>;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function StrategyLogs({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const logsEndRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/strategies/${strategyId}/logs`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setLogs(data);
        } catch (e) {
            console.error('Failed to fetch logs:', e);
            // Mock data
            setLogs([
                { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'Strategy initialized', data: { symbol: 'AAPL' } },
                { id: '2', timestamp: new Date().toISOString(), level: 'signal', message: 'BUY signal generated', data: { price: 175.50, indicator: 'SMA crossover' } },
                { id: '3', timestamp: new Date().toISOString(), level: 'order', message: 'Order submitted', data: { side: 'buy', qty: 100, type: 'market' } },
                { id: '4', timestamp: new Date().toISOString(), level: 'fill', message: 'Order filled', data: { price: 175.52, qty: 100, commission: 1.00 } },
                { id: '5', timestamp: new Date().toISOString(), level: 'warning', message: 'Approaching position limit', data: { current: 8500, limit: 10000 } },
                { id: '6', timestamp: new Date().toISOString(), level: 'error', message: 'Order rejected by risk manager', data: { reason: 'Position size exceeded' } },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, [strategyId]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);

    const getLevelStyle = (level: string) => {
        switch (level) {
            case 'info': return { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: 'text-gray-400' };
            case 'signal': return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'text-blue-400' };
            case 'order': return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: 'text-purple-400' };
            case 'fill': return { bg: 'bg-green-500/20', text: 'text-green-400', icon: 'text-green-400' };
            case 'warning': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: 'text-yellow-400' };
            case 'error': return { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'text-red-400' };
            default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: 'text-gray-400' };
        }
    };

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[800px] h-[600px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FileText size={20} />
                        Strategy Logs
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchLogs} className="p-1 hover:bg-gray-700 rounded">
                            <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                            <X size={18} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-3 border-b border-gray-700 flex items-center gap-3">
                    <Filter size={14} className="text-gray-400" />
                    {['all', 'info', 'signal', 'order', 'fill', 'warning', 'error'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                            <input
                                type="checkbox"
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            Auto-scroll
                        </label>
                    </div>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto font-mono text-xs p-2 bg-gray-900">
                    {filteredLogs.map((log) => {
                        const style = getLevelStyle(log.level);
                        return (
                            <div key={log.id} className={`flex items-start gap-2 px-2 py-1 rounded mb-1 ${style.bg}`}>
                                <span className="text-gray-500 shrink-0">{formatTime(log.timestamp)}</span>
                                <Circle size={8} className={`mt-1 shrink-0 ${style.icon}`} fill="currentColor" />
                                <span className={`uppercase text-[10px] font-bold shrink-0 w-12 ${style.text}`}>{log.level}</span>
                                <span className="text-gray-200 flex-1">{log.message}</span>
                                {log.data && (
                                    <span className="text-gray-500 shrink-0">
                                        {JSON.stringify(log.data)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    <div ref={logsEndRef} />
                </div>

                {/* Stats */}
                <div className="p-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
                    <span>{filteredLogs.length} events</span>
                    <div className="flex gap-4">
                        <span className="text-green-400">{logs.filter(l => l.level === 'fill').length} fills</span>
                        <span className="text-yellow-400">{logs.filter(l => l.level === 'warning').length} warnings</span>
                        <span className="text-red-400">{logs.filter(l => l.level === 'error').length} errors</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
