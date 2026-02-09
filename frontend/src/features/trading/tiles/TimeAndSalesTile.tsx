/**
 * Time and Sales Tile - Real-time trade tape
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface Trade {
    id: string;
    time: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    exchange: string;
}

function generateTrade(id: number, lastPrice: number): Trade {
    const change = (Math.random() - 0.5) * 0.05;
    const price = lastPrice * (1 + change);
    const size = Math.floor(Math.random() * 1000) * 100;
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const exchanges = ['NYSE', 'ARCA', 'BATS', 'IEX', 'EDGX'];
    
    return {
        id: `t${id}`,
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        price,
        size,
        side,
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
    };
}

export function TimeAndSalesTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [paused, setPaused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPriceRef = useRef(178.52);
    const idRef = useRef(0);

    // Simulate streaming trades
    useEffect(() => {
        if (paused) return;

        const interval = setInterval(() => {
            const newTrade = generateTrade(idRef.current++, lastPriceRef.current);
            lastPriceRef.current = newTrade.price;
            
            setTrades(prev => [newTrade, ...prev.slice(0, 99)]);
        }, 200 + Math.random() * 300);

        return () => clearInterval(interval);
    }, [paused]);

    // Auto-scroll to top
    useEffect(() => {
        if (containerRef.current && !paused) {
            containerRef.current.scrollTop = 0;
        }
    }, [trades, paused]);

    return (
        <div className="h-full flex flex-col">
            {/* Controls */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-sm font-medium text-text">AAPL</span>
                <button
                    onClick={() => setPaused(!paused)}
                    className={cn(
                        "px-2 py-1 rounded text-xs",
                        paused ? "bg-green-500 text-white" : "bg-element-bg text-text-secondary"
                    )}
                >
                    {paused ? 'Resume' : 'Pause'}
                </button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-5 gap-1 px-3 py-1.5 text-xs text-text-muted border-b border-border bg-element-bg/50">
                <div>Time</div>
                <div className="text-right">Price</div>
                <div className="text-right">Size</div>
                <div className="text-center">Side</div>
                <div className="text-right">Exch</div>
            </div>

            {/* Trades */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-y-auto font-mono text-xs"
            >
                {trades.map((trade, idx) => (
                    <div
                        key={trade.id}
                        className={cn(
                            "grid grid-cols-5 gap-1 px-3 py-1 border-b border-border/30",
                            idx === 0 && "bg-element-bg"
                        )}
                    >
                        <div className="text-text-muted">{trade.time}</div>
                        <div className={cn(
                            "text-right",
                            trade.side === 'buy' ? "text-green-500" : "text-red-500"
                        )}>
                            {trade.price.toFixed(2)}
                        </div>
                        <div className={cn(
                            "text-right",
                            trade.size >= 10000 ? "text-yellow-500 font-semibold" : "text-text-secondary"
                        )}>
                            {trade.size.toLocaleString()}
                        </div>
                        <div className="text-center">
                            <span className={cn(
                                "px-1 py-0.5 rounded text-xxs",
                                trade.side === 'buy' 
                                    ? "bg-green-500/20 text-green-500" 
                                    : "bg-red-500/20 text-red-500"
                            )}>
                                {trade.side.toUpperCase()}
                            </span>
                        </div>
                        <div className="text-right text-text-muted">{trade.exchange}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
