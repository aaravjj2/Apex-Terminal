/**
 * Alerts Tile - Active price alerts
 */

import { useState } from 'react';
import { Bell, BellOff, Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type AlertCondition = 'above' | 'below' | 'crosses';

interface Alert {
    id: string;
    symbol: string;
    condition: AlertCondition;
    price: number;
    currentPrice: number;
    enabled: boolean;
    triggered: boolean;
}

const MOCK_ALERTS: Alert[] = [
    { id: '1', symbol: 'AAPL', condition: 'above', price: 180.00, currentPrice: 178.52, enabled: true, triggered: false },
    { id: '2', symbol: 'MSFT', condition: 'below', price: 375.00, currentPrice: 378.91, enabled: true, triggered: false },
    { id: '3', symbol: 'NVDA', condition: 'crosses', price: 900.00, currentPrice: 875.28, enabled: false, triggered: true },
    { id: '4', symbol: 'TSLA', condition: 'below', price: 250.00, currentPrice: 248.50, enabled: true, triggered: true },
];

export function AlertsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);

    const toggleAlert = (id: string) => {
        setAlerts(prev => prev.map(a => 
            a.id === id ? { ...a, enabled: !a.enabled } : a
        ));
    };

    const deleteAlert = (id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">{alerts.filter(a => a.enabled).length} active</span>
                    <span className="text-xs text-yellow-500">
                        {alerts.filter(a => a.triggered).length} triggered
                    </span>
                </div>
                <button className="flex items-center gap-1 px-2 py-1 rounded bg-brand text-white text-xs">
                    <Plus size={12} />
                    New
                </button>
            </div>

            {/* Alerts */}
            <div className="flex-1 overflow-y-auto">
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 border-b border-border/50",
                            alert.triggered && "bg-yellow-500/10",
                            !alert.enabled && "opacity-50"
                        )}
                    >
                        <button onClick={() => toggleAlert(alert.id)}>
                            {alert.enabled ? (
                                <Bell size={16} className={cn(alert.triggered ? "text-yellow-500" : "text-text-secondary")} />
                            ) : (
                                <BellOff size={16} className="text-text-muted" />
                            )}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-text">{alert.symbol}</span>
                                {alert.condition === 'above' && <TrendingUp size={12} className="text-green-500" />}
                                {alert.condition === 'below' && <TrendingDown size={12} className="text-red-500" />}
                                <span className="text-sm text-text-secondary">${alert.price.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                                Current: ${alert.currentPrice.toFixed(2)}
                            </div>
                        </div>

                        <button
                            onClick={() => deleteAlert(alert.id)}
                            className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
