import { useState, useEffect } from 'react';
import { Play, Pause, Plus, Trash2, RefreshCw, X } from 'lucide-react';

interface Strategy {
    id: string;
    name: string;
    strategy_type: string;
    symbol: string;
    status: string;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function StrategyPanel({ embedded }: { embedded?: boolean }) {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchStrategies = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/strategies`);
            if (!res.ok) throw new Error("Err");
            const data = await res.json();
            setStrategies(data);
        } catch (e) {
            // Mock
            setStrategies([
                { id: '1', name: 'SMA Crossover', strategy_type: 'sma', symbol: 'AAPL', status: 'running' },
                { id: '2', name: 'RSI Reversal', strategy_type: 'rsi', symbol: 'TSLA', status: 'paused' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen || embedded) fetchStrategies();
    }, [isOpen, embedded]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-green-400';
            case 'paused': return 'text-yellow-400';
            case 'stopped': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const containerClass = embedded
        ? "h-full flex flex-col bg-gray-900 scrollbar-thin"
        : "absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50";

    if (!embedded && !isOpen) {
        return (
            <div className="absolute top-14 right-4 z-50">
                <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded text-xs">
                    Strategies
                </button>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="p-3 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Strategies</span>
                <div className="flex items-center gap-1">
                    <button onClick={fetchStrategies} className="p-1 hover:bg-gray-800 rounded">
                        <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {!embedded && (
                        <button onClick={() => setIsOpen(false)}><X size={14} className="text-gray-400" /></button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className={`p-2 space-y-2 ${!embedded && "max-h-96 overflow-y-auto"}`}>
                {strategies.map(s => (
                    <div key={s.id} className="bg-gray-800 border border-gray-700 p-2 rounded hover:border-gray-600 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-sm font-medium text-gray-200">{s.name}</div>
                                <div className="text-[10px] text-gray-500">{s.strategy_type} • {s.symbol}</div>
                            </div>
                            <span className={`text-[10px] uppercase font-bold ${getStatusColor(s.status)}`}>{s.status}</span>
                        </div>
                        <div className="flex gap-2">
                            <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded flex justify-center text-green-400"><Play size={12} /></button>
                            <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded flex justify-center text-yellow-400"><Pause size={12} /></button>
                            <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded flex justify-center text-red-400"><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}
                <button className="w-full py-2 border border-dashed border-gray-700 text-gray-500 text-xs rounded hover:bg-gray-800 hover:text-gray-300 transiton-colors flex items-center justify-center gap-1">
                    <Plus size={12} /> New Strategy
                </button>
            </div>
        </div>
    );
}
