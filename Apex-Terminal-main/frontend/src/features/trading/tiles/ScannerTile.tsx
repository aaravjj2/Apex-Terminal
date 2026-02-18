/**
 * Scanner Tile - Stock screener results
 */

import { useState } from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface ScanResult {
    symbol: string;
    name: string;
    price: number;
    change: number;
    volume: number;
    signal: string;
    strength: number;
}

const MOCK_RESULTS: ScanResult[] = [
    { symbol: 'SMCI', name: 'Super Micro', price: 289.50, change: 8.45, volume: 12500000, signal: 'Breakout', strength: 95 },
    { symbol: 'ARM', name: 'ARM Holdings', price: 148.20, change: 5.67, volume: 8900000, signal: 'Golden Cross', strength: 88 },
    { symbol: 'PLTR', name: 'Palantir', price: 24.80, change: 4.23, volume: 45000000, signal: 'RSI Oversold', strength: 82 },
    { symbol: 'COIN', name: 'Coinbase', price: 178.90, change: 6.78, volume: 15600000, signal: 'Volume Spike', strength: 78 },
    { symbol: 'RBLX', name: 'Roblox', price: 45.30, change: -2.45, volume: 9800000, signal: 'Support Test', strength: 72 },
];

const presetScans = [
    { id: 'breakouts', label: 'Breakouts' },
    { id: 'momentum', label: 'Momentum' },
    { id: 'oversold', label: 'Oversold' },
    { id: 'volume', label: 'Vol Spike' },
    { id: 'earnings', label: 'Pre-Earnings' },
];

export function ScannerTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [activeScan, setActiveScan] = useState('breakouts');

    return (
        <div className="h-full flex flex-col">
            {/* Scan Presets */}
            <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
                {presetScans.map(scan => (
                    <button
                        key={scan.id}
                        onClick={() => setActiveScan(scan.id)}
                        className={cn(
                            "px-2 py-1 rounded text-xs whitespace-nowrap flex items-center gap-1",
                            activeScan === scan.id
                                ? "bg-brand text-white"
                                : "bg-element-bg text-text-secondary hover:text-text"
                        )}
                    >
                        {activeScan === scan.id && <Zap size={10} />}
                        {scan.label}
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="grid grid-cols-5 gap-2 px-3 py-2 text-xs text-text-muted border-b border-border bg-element-bg/50">
                <div>Symbol</div>
                <div className="text-right">Price</div>
                <div className="text-right">Change</div>
                <div>Signal</div>
                <div className="text-right">Str</div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {MOCK_RESULTS.map(result => (
                    <div
                        key={result.symbol}
                        className="grid grid-cols-5 gap-2 px-3 py-2 text-sm hover:bg-element-bg cursor-pointer border-b border-border/50"
                    >
                        <div>
                            <div className="font-medium text-text">{result.symbol}</div>
                            <div className="text-xs text-text-muted truncate">{result.name}</div>
                        </div>
                        <div className="text-right font-mono text-text">
                            ${result.price.toFixed(2)}
                        </div>
                        <div className={cn(
                            "text-right flex items-center justify-end gap-1",
                            result.change >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {result.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {result.change >= 0 ? '+' : ''}{result.change.toFixed(2)}%
                        </div>
                        <div className="text-xs text-brand truncate">{result.signal}</div>
                        <div className="text-right">
                            <div className={cn(
                                "inline-block px-1.5 py-0.5 rounded text-xs font-semibold",
                                result.strength >= 80 ? "bg-green-500/20 text-green-500" :
                                result.strength >= 60 ? "bg-yellow-500/20 text-yellow-500" :
                                "bg-red-500/20 text-red-500"
                            )}>
                                {result.strength}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
