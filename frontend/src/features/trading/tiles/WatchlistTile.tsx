/**
 * Watchlist Tile - Shows user's watchlist with real-time quotes
 */

import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { streamSimulator } from '../../../ui2/stores/streamSimulator';

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

import { DEMO_QUOTES } from '../../../ui2/demo/canonicalDemo';

// Derive mock watchlist from canonical demo quotes (single source of truth)
const MOCK_WATCHLIST: WatchlistItem[] = DEMO_QUOTES.map(q => ({
  symbol: q.symbol,
  name: q.symbol,
  price: q.last,
  change: q.change,
  changePercent: q.changePct,
  volume: q.volume,
}));

export function WatchlistTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [watchlist, _setWatchlist] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
    const [searchQuery, setSearchQuery] = useState('');
    // Local state to trigger re-render on stream ticks
    const [_tickSeq, setTickSeq] = useState(0);

    useEffect(() => {
        const unsub = streamSimulator.subscribe(() => setTickSeq(s => s + 1));
        return unsub;
    }, []);

    const filteredList = watchlist.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        <div className="text-right font-mono text-text" data-testid={`watchlist-tile-price-${item.symbol}`}>
                            ${ (streamSimulator.getLatestPrice(item.symbol) ?? item.price).toFixed(2) }
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
