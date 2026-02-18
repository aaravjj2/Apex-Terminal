import { useState, useEffect } from 'react';
import { Plus, Trash2, X, RefreshCw } from 'lucide-react';

interface Alert {
    id: string;
    name: string;
    symbol: string;
    condition: string;
    value: number;
    active: boolean;
}


export function AlertsPanel({ embedded }: { embedded?: boolean }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const fetchAlerts = async () => {
        try {
            // Mock
            setAlerts([
                { id: '1', name: 'AAPL Breakout', symbol: 'AAPL', condition: 'price_above', value: 180.00, active: true },
                { id: '2', name: 'TSLA Support', symbol: 'TSLA', condition: 'price_below', value: 220.50, active: true },
            ]);
        } catch (e) { }
    };

    useEffect(() => { if (isOpen || embedded) fetchAlerts(); }, [isOpen, embedded]);

    const containerClass = embedded
        ? "h-full flex flex-col bg-gray-900 scrollbar-thin"
        : "absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50";

    if (!embedded && !isOpen) {
        return (
            <div className="absolute top-14 right-44 z-50">
                <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 rounded text-xs">
                    Alerts
                </button>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            <div className="p-3 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alerts</span>
                <div className="flex items-center gap-1">
                    <button onClick={fetchAlerts} className="p-1 hover:bg-gray-800 rounded">
                        <RefreshCw size={12} className="text-gray-400" />
                    </button>
                    {!embedded && (
                        <button onClick={() => setIsOpen(false)}><X size={14} className="text-gray-400" /></button>
                    )}
                </div>
            </div>

            <div className="p-2 space-y-1">
                {alerts.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-2 bg-gray-800 border border-gray-700 rounded hover:border-orange-500/50 transition-colors group">
                        <div>
                            <div className="text-sm font-medium text-gray-200">{a.name}</div>
                            <div className="text-[10px] text-gray-500">{a.symbol} • {a.condition.replace('_', ' ')} {a.value}</div>
                        </div>
                        <button className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                <button className="w-full py-2 border border-dashed border-gray-700 text-gray-500 text-xs rounded hover:bg-gray-800 hover:text-gray-300 transiton-colors flex items-center justify-center gap-1">
                    <Plus size={12} /> Create Alert
                </button>
            </div>
        </div>
    );
}
