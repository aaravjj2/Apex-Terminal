/**
 * Vol Surface Tile - Implied Volatility surface visualization
 */

import { useMemo } from 'react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

// Mock IV data for different strikes and expirations
const strikes = [160, 165, 170, 175, 180, 185, 190, 195];
const expirations = ['1W', '2W', '1M', '2M', '3M', '6M'];

function generateIVSurface(): number[][] {
    // Generate mock IV surface with typical skew pattern
    return expirations.map((_, expIdx) => 
        strikes.map((_, strikeIdx) => {
            // Base IV increases with time
            const baseIV = 0.20 + expIdx * 0.02;
            // Smile/skew effect - higher IV for OTM options
            const moneyness = Math.abs(strikeIdx - 3.5) / 4;
            const skew = moneyness * 0.08;
            // Add some noise
            const noise = (Math.random() - 0.5) * 0.02;
            return baseIV + skew + noise;
        })
    );
}

function getIVColor(iv: number): string {
    if (iv < 0.18) return 'bg-blue-600';
    if (iv < 0.22) return 'bg-blue-500';
    if (iv < 0.26) return 'bg-green-500';
    if (iv < 0.30) return 'bg-yellow-500';
    if (iv < 0.35) return 'bg-orange-500';
    return 'bg-red-500';
}

export function VolSurfaceTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const ivSurface = useMemo(() => generateIVSurface(), []);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="text-xs text-text-muted mb-2 flex items-center justify-between">
                <span>AAPL Implied Volatility Surface</span>
                <span>ATM: 175</span>
            </div>

            {/* Surface Grid */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr>
                            <th className="text-left text-text-muted p-1">Exp \\ Strike</th>
                            {strikes.map(strike => (
                                <th key={strike} className="text-center text-text-muted p-1">{strike}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {expirations.map((exp, expIdx) => (
                            <tr key={exp}>
                                <td className="text-text-muted p-1">{exp}</td>
                                {ivSurface[expIdx].map((iv, strikeIdx) => (
                                    <td key={strikeIdx} className="p-0.5">
                                        <div
                                            className={cn(
                                                "rounded text-center py-1 text-white text-xxs font-mono",
                                                getIVColor(iv),
                                                strikes[strikeIdx] === 175 && "ring-1 ring-white/50"
                                            )}
                                            title={`Strike ${strikes[strikeIdx]}, Exp ${exp}: ${(iv * 100).toFixed(1)}%`}
                                        >
                                            {(iv * 100).toFixed(1)}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-1 mt-2 text-xxs">
                <span className="text-text-muted">Low IV</span>
                <div className="w-3 h-3 rounded bg-blue-600"></div>
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-text-muted">High IV</span>
            </div>
        </div>
    );
}
