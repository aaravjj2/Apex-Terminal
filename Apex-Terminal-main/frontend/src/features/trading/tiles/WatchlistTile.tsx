/**
 * Watchlist Tile - Shows user's watchlist with real-time quotes
 */

import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface WatchlistItem {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
}

// Mock data - in production this would come from WebSocket
const MOCK_WATCHLIST: WatchlistItem[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 182.41, change: -1.23, changePercent: -0.67, volume: 38200000 },
    { symbol: 'MSFT', name: 'Microsoft Corp', price: 412.33, change: 2.15, changePercent: 0.52, volume: 19800000 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 152.23, change: 1.05, changePercent: 0.69, volume: 15400000 },
    { symbol: 'AMZN', name: 'Amazon.com', price: 178.92, change: -0.78, changePercent: -0.43, volume: 33100000 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', price: 789.55, change: -8.45, changePercent: -1.06, volume: 28900000 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 218.77, change: 5.12, changePercent: 2.40, volume: 51300000 },
    { symbol: 'META', name: 'Meta Platforms', price: 487.63, change: 4.22, changePercent: 0.87, volume: 12700000 },
    { symbol: 'SPY', name: 'SPDR S&P 500', price: 547.23, change: 3.45, changePercent: 0.63, volume: 42150000 },
];

export function WatchlistTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [watchlist, _setWatchlist] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredList = watchlist.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Simulate real-time updates
    // Simulation removed as per P0.1
    useEffect(() => {
        // No-op: Simulation disabled
    }, []);

    return (
        <div className="h-full flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search symbols..."
                        className="w-full bg-element-bg text-text text-sm rounded pl-8 pr-2 py-1.5 outline-none border border-border focus:border-brand"
                    />
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-text-muted border-b border-border bg-element-bg/50">
                <div className="flex items-center gap-2">
                    Symbol <span className="px-1 py-0.5 bg-yellow-900/50 text-yellow-500 rounded text-[10px] border border-yellow-800">MOCK DATA</span>
                </div>
                <div className="text-right">Price</div>
                <div className="text-right">Change</div>
                <div className="text-right">Volume</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filteredList.map(item => (
                    <div
                        key={item.symbol}
                        className="grid grid-cols-4 gap-2 px-3 py-2 text-sm hover:bg-element-bg cursor-pointer border-b border-border/50"
                    >
                        <div>
                            <div className="font-medium text-text">{item.symbol}</div>
                            <div className="text-xs text-text-muted truncate">{item.name}</div>
                        </div>
                        <div className="text-right font-mono text-text">
                            ${item.price.toFixed(2)}
                        </div>
                        <div className={cn(
                            "text-right font-mono flex items-center justify-end gap-1",
                            item.change >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {item.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </div>
                        <div className="text-right text-text-secondary text-xs">
                            {(item.volume / 1000000).toFixed(1)}M
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Symbol */}
            <div className="p-2 border-t border-border">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-element-bg text-text-secondary hover:text-text text-sm transition-colors">
                    <Plus size={14} />
                    Add Symbol
                </button>
            </div>
        </div>
    );
}
