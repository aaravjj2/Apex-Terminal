/**
 * Heatmap Tile - Sector/Market heatmap visualization
 */

import { useMemo } from 'react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface HeatmapItem {
    symbol: string;
    name: string;
    change: number;
    marketCap: number;
}

const MOCK_HEATMAP: HeatmapItem[] = [
    { symbol: 'AAPL', name: 'Apple', change: 1.33, marketCap: 2800 },
    { symbol: 'MSFT', name: 'Microsoft', change: -0.32, marketCap: 2700 },
    { symbol: 'GOOGL', name: 'Alphabet', change: 0.63, marketCap: 1800 },
    { symbol: 'AMZN', name: 'Amazon', change: 1.97, marketCap: 1600 },
    { symbol: 'NVDA', name: 'NVIDIA', change: 1.44, marketCap: 1500 },
    { symbol: 'META', name: 'Meta', change: 1.79, marketCap: 1200 },
    { symbol: 'TSLA', name: 'Tesla', change: -2.23, marketCap: 800 },
    { symbol: 'BRK.B', name: 'Berkshire', change: 0.25, marketCap: 750 },
    { symbol: 'JPM', name: 'JPMorgan', change: 0.89, marketCap: 500 },
    { symbol: 'V', name: 'Visa', change: 0.45, marketCap: 480 },
    { symbol: 'UNH', name: 'UnitedHealth', change: -0.67, marketCap: 450 },
    { symbol: 'HD', name: 'Home Depot', change: 0.12, marketCap: 350 },
];

function getHeatmapColor(change: number): string {
    if (change >= 2) return 'bg-green-600';
    if (change >= 1) return 'bg-green-500';
    if (change >= 0.5) return 'bg-green-400/80';
    if (change >= 0) return 'bg-green-400/40';
    if (change >= -0.5) return 'bg-red-400/40';
    if (change >= -1) return 'bg-red-400/80';
    if (change >= -2) return 'bg-red-500';
    return 'bg-red-600';
}

export function HeatmapTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const sortedData = useMemo(() => 
        [...MOCK_HEATMAP].sort((a, b) => b.marketCap - a.marketCap),
        []
    );

    return (
        <div className="h-full p-2 overflow-auto">
            <div className="grid grid-cols-4 gap-1 h-full min-h-[200px]">
                {sortedData.map((item, idx) => {
                    return (
                        <div
                            key={item.symbol}
                            className={cn(
                                "rounded flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105",
                                getHeatmapColor(item.change)
                            )}
                            style={{
                                gridColumn: idx < 2 ? 'span 2' : 'span 1',
                                gridRow: idx < 2 ? 'span 2' : 'span 1',
                            }}
                        >
                            <span className="text-white font-bold text-sm">{item.symbol}</span>
                            <span className="text-white/90 text-xs">
                                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
