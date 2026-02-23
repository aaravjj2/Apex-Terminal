/**
 * Positions Tile - Shows open positions with P&L
 */

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { streamSimulator } from '../../../ui2/stores/streamSimulator';

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

// Online-only: seed prices for initial position display
const SEED_PRICES: Record<string, number> = { SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55, MSFT: 412.33 };

const MOCK_POSITIONS: Position[] = [
    { symbol: 'SPY', quantity: 150, avgCost: 535.20, currentPrice: SEED_PRICES['SPY'], marketValue: 82084.50, unrealizedPL: 1804.50, unrealizedPLPercent: 2.24 },
    { symbol: 'AAPL', quantity: 200, avgCost: 185.30, currentPrice: SEED_PRICES['AAPL'], marketValue: 36482.00, unrealizedPL: -578.00, unrealizedPLPercent: -1.56 },
    { symbol: 'TSLA', quantity: 75, avgCost: 210.15, currentPrice: SEED_PRICES['TSLA'], marketValue: 16407.75, unrealizedPL: 646.50, unrealizedPLPercent: 4.10 },
    { symbol: 'NVDA', quantity: 50, avgCost: 805.40, currentPrice: SEED_PRICES['NVDA'], marketValue: 39477.50, unrealizedPL: -792.50, unrealizedPLPercent: -1.97 },
];

export function PositionsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);

    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

    // Subscribe to deterministic stream simulator and update displayed prices
    useEffect(() => {
        // Apply any immediately-available latest prices
        setPositions(prev => prev.map(p => {
            const latest = streamSimulator.getLatestPrice(p.symbol) || p.currentPrice;
            const marketValue = Number((latest * p.quantity).toFixed(2));
            const costBasis = Number((p.avgCost * p.quantity).toFixed(2));
            const unrealizedPL = Number((marketValue - costBasis).toFixed(2));
            const unrealizedPLPercent = costBasis ? Number(((unrealizedPL / costBasis) * 100).toFixed(2)) : p.unrealizedPLPercent;
            return { ...p, currentPrice: latest, marketValue, unrealizedPL, unrealizedPLPercent };
        }));

        const unsub = streamSimulator.subscribe((tick) => {
            setPositions(prev => prev.map(p => {
                if (p.symbol !== tick.symbol) return p;
                const latest = tick.price ?? p.currentPrice;
                const marketValue = Number((latest * p.quantity).toFixed(2));
                const costBasis = Number((p.avgCost * p.quantity).toFixed(2));
                const unrealizedPL = Number((marketValue - costBasis).toFixed(2));
                const unrealizedPLPercent = costBasis ? Number(((unrealizedPL / costBasis) * 100).toFixed(2)) : p.unrealizedPLPercent;
                return { ...p, currentPrice: latest, marketValue, unrealizedPL, unrealizedPLPercent };
            }));
        });

        return () => unsub();
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
                        <div className="text-right font-mono text-text" data-testid={`positions-tile-price-${pos.symbol}`}>
                            ${pos.currentPrice.toFixed(2)}
                        </div>
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
