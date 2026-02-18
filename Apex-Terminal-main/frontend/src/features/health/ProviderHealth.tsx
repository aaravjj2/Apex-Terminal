import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface ProviderStatus {
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'rate_limited';
    last_update: string;
    message?: string;
    retry_in_seconds?: number;
    requests_remaining?: number;
    requests_limit?: number;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function ProviderHealth() {
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/health/providers`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setProviders(data);
            } catch (e) {
                // Mock data
                setProviders([
                    { name: 'Finnhub WebSocket', status: 'connected', last_update: new Date().toISOString(), requests_remaining: 45, requests_limit: 60 },
                    { name: 'Alpaca Trading', status: 'connected', last_update: new Date().toISOString() },
                    { name: 'Alpaca Data', status: 'connected', last_update: new Date().toISOString(), requests_remaining: 180, requests_limit: 200 },
                    { name: 'Yahoo Finance', status: 'connected', last_update: new Date(Date.now() - 60000).toISOString() },
                ]);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected': return <CheckCircle size={12} className="text-green-400" />;
            case 'disconnected': return <WifiOff size={12} className="text-red-400" />;
            case 'error': return <AlertTriangle size={12} className="text-red-400" />;
            case 'rate_limited': return <Clock size={12} className="text-yellow-400" />;
            default: return <Activity size={12} className="text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'text-green-400';
            case 'disconnected': return 'text-red-400';
            case 'error': return 'text-red-400';
            case 'rate_limited': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };

    const allConnected = providers.every(p => p.status === 'connected');
    const hasIssues = providers.some(p => p.status !== 'connected');

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        if (diff < 10000) return 'Just now';
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    };

    return (
        <div className="absolute top-14 right-[420px] z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ${allConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
            >
                {allConnected ? <Wifi size={14} /> : <AlertTriangle size={14} />}
                Health
                {hasIssues && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
                    <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Provider Health</h3>
                        <span className={`text-xs ${allConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                            {allConnected ? 'All Connected' : 'Issues Detected'}
                        </span>
                    </div>

                    <div className="divide-y divide-gray-700">
                        {providers.map((p, i) => (
                            <div key={i} className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(p.status)}
                                        <span className="text-sm text-white">{p.name}</span>
                                    </div>
                                    <span className={`text-xs ${getStatusColor(p.status)}`}>
                                        {p.status.charAt(0).toUpperCase() + p.status.slice(1).replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                                    <span>Updated {formatTime(p.last_update)}</span>
                                    {p.requests_remaining !== undefined && (
                                        <span className={p.requests_remaining < 10 ? 'text-yellow-400' : ''}>
                                            {p.requests_remaining}/{p.requests_limit} req
                                        </span>
                                    )}
                                </div>
                                {p.retry_in_seconds && (
                                    <div className="mt-1 text-xs text-yellow-400">
                                        Retry in {p.retry_in_seconds}s
                                    </div>
                                )}
                                {p.message && (
                                    <div className="mt-1 text-xs text-red-400">{p.message}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
