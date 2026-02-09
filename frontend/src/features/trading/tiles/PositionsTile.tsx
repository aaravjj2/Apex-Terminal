/**
 * Positions Tile - Shows open positions with P&L
 */

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface Position {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}

const MOCK_POSITIONS: Position[] = [
    { symbol: 'AAPL', quantity: 100, avgCost: 165.50, currentPrice: 178.52, marketValue: 17852, unrealizedPL: 1302, unrealizedPLPercent: 7.87 },
    { symbol: 'MSFT', quantity: 50, avgCost: 385.00, currentPrice: 378.91, marketValue: 18945.5, unrealizedPL: -304.5, unrealizedPLPercent: -1.58 },
    { symbol: 'NVDA', quantity: 25, avgCost: 750.00, currentPrice: 875.28, marketValue: 21882, unrealizedPL: 3132, unrealizedPLPercent: 16.70 },
    { symbol: 'SPY', quantity: 200, avgCost: 498.00, currentPrice: 502.34, marketValue: 100468, unrealizedPL: 868, unrealizedPLPercent: 0.87 },
];

export function PositionsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [positions, _setPositions] = useState<Position[]>(MOCK_POSITIONS);

    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

    // Simulate updates
    // Simulation removed as per P0.1
    useEffect(() => {
        // No-op: Simulation disabled
    }, []);

    return (
        <div className="h-full flex flex-col">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 p-2 border-b border-border bg-element-bg/50">
                <div>
                    <div className="text-xs text-text-muted">Total Value</div>
                    <div className="text-lg font-semibold text-text">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                    <div className="text-xs text-text-muted">Unrealized P&L</div>
                    <div className={cn(
                        "text-lg font-semibold flex items-center gap-1 tabular-nums",
                        totalPL >= 0 ? "text-up" : "text-down"
                    )}>
                        {totalPL >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-5 gap-2 px-3 py-1 text-xs text-text-muted border-b border-border">
                <div className="flex items-center gap-2">
                    Symbol <span className="px-1 py-0.5 bg-yellow-900/50 text-yellow-500 rounded text-[10px] border border-yellow-800">MOCK DATA</span>
                </div>
                <div className="text-right">Qty</div>
                <div className="text-right">Price</div>
                <div className="text-right">Value</div>
                <div className="text-right">P&L</div>
            </div>

            {/* Positions */}
            <div className="flex-1 overflow-y-auto">
                {positions.map(pos => (
                    <div
                        key={pos.symbol}
                        className="grid grid-cols-5 gap-2 px-3 py-1 text-sm hover:bg-element-bg cursor-pointer border-b border-border/50"
                    >
                        <div className="font-medium text-text">{pos.symbol}</div>
                        <div className="text-right text-text-secondary">{pos.quantity}</div>
                        <div className="text-right font-mono text-text">${pos.currentPrice.toFixed(2)}</div>
                        <div className="text-right font-mono text-text">${pos.marketValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
                        <div className={cn(
                            "text-right font-mono tabular-nums",
                            pos.unrealizedPL >= 0 ? "text-up" : "text-down"
                        )}>
                            {pos.unrealizedPL >= 0 ? '+' : ''}{pos.unrealizedPLPercent.toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
