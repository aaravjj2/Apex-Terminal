/**
 * Performance Tile - P&L and performance metrics
 */

import { TrendingUp, TrendingDown, Percent, Activity } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

export function PerformanceTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const metrics = {
        todayPL: 1234.56,
        todayPLPercent: 0.82,
        weekPL: 4567.89,
        weekPLPercent: 3.12,
        monthPL: 12345.67,
        monthPLPercent: 8.45,
        ytdPL: 45678.90,
        ytdPLPercent: 32.15,
        sharpe: 1.85,
        maxDrawdown: -12.5,
        winRate: 62.5,
    };

    return (
        <div className="h-full flex flex-col p-3">
            {/* Main P&L */}
            <div className="text-center mb-4">
                <div className="text-xs text-text-muted mb-1">Today's P&L</div>
                <div className={cn(
                    "text-2xl font-bold flex items-center justify-center gap-2",
                    metrics.todayPL >= 0 ? "text-green-500" : "text-red-500"
                )}>
                    {metrics.todayPL >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    ${Math.abs(metrics.todayPL).toLocaleString()}
                </div>
                <div className={cn(
                    "text-sm",
                    metrics.todayPLPercent >= 0 ? "text-green-500" : "text-red-500"
                )}>
                    {metrics.todayPLPercent >= 0 ? '+' : ''}{metrics.todayPLPercent.toFixed(2)}%
                </div>
            </div>

            {/* Period Returns */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                    { label: 'Week', value: metrics.weekPLPercent },
                    { label: 'Month', value: metrics.monthPLPercent },
                    { label: 'YTD', value: metrics.ytdPLPercent },
                ].map(item => (
                    <div key={item.label} className="text-center p-2 bg-element-bg rounded">
                        <div className="text-xs text-text-muted">{item.label}</div>
                        <div className={cn(
                            "text-sm font-semibold",
                            item.value >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>

            {/* Risk Metrics */}
            <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between p-2 bg-element-bg rounded">
                    <div className="flex items-center gap-2 text-text-secondary">
                        <Activity size={14} />
                        <span className="text-xs">Sharpe Ratio</span>
                    </div>
                    <span className="font-semibold text-text">{metrics.sharpe.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-element-bg rounded">
                    <div className="flex items-center gap-2 text-text-secondary">
                        <TrendingDown size={14} />
                        <span className="text-xs">Max Drawdown</span>
                    </div>
                    <span className="font-semibold text-red-500">{metrics.maxDrawdown.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-element-bg rounded">
                    <div className="flex items-center gap-2 text-text-secondary">
                        <Percent size={14} />
                        <span className="text-xs">Win Rate</span>
                    </div>
                    <span className="font-semibold text-text">{metrics.winRate.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}
