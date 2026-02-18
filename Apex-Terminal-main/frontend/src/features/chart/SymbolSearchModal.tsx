import { useState, useEffect, useRef } from 'react';
import { Search, Clock } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';

interface SymbolSearchModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (symbol: string) => void;
}

const recentSymbols = ['AAPL', 'MSFT', 'SPY', 'QQQ', 'NVDA', 'TSLA'];

const searchResults = [
    { symbol: 'AAPL', description: 'Apple Inc.', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'MSFT', description: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'GOOGL', description: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'AMZN', description: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'TSLA', description: 'Tesla Inc.', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'NVDA', description: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'META', description: 'Meta Platforms Inc.', exchange: 'NASDAQ', type: 'Stock' },
    { symbol: 'AMD', description: 'Advanced Micro Devices', exchange: 'NASDAQ', type: 'Stock' },
];

export function SymbolSearchModal({ open, onClose, onSelect }: SymbolSearchModalProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus after animation frame
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    const filtered = query
        ? searchResults.filter(s =>
            s.symbol.toLowerCase().includes(query.toLowerCase()) ||
            s.description.toLowerCase().includes(query.toLowerCase())
        )
        : [];

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Symbol Search"
            size="md"
        >
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                    <Input
                        ref={inputRef}
                        placeholder="Search symbols..."
                        className="pl-9"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {!query && (
                    <div>
                        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Recent</h3>
                        <div className="flex flex-wrap gap-2">
                            {recentSymbols.map(sym => (
                                <button
                                    key={sym}
                                    onClick={() => { onSelect(sym); onClose(); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-element-bg border border-border hover:border-brand hover:text-brand transition-colors text-sm font-medium text-text"
                                >
                                    <Clock size={12} className="text-text-secondary" />
                                    {sym}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {query && (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-sm text-text-muted">No symbols found.</div>
                        ) : (
                            filtered.map(item => (
                                <button
                                    key={item.symbol}
                                    onClick={() => { onSelect(item.symbol); onClose(); }}
                                    className="w-full flex items-center justify-between p-2 rounded hover:bg-element-bg transition-colors text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                                            {item.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-text">{item.symbol}</span>
                                                <Badge size="sm" variant="outline" className="text-xxs">{item.exchange}</Badge>
                                            </div>
                                            <div className="text-xs text-text-secondary">{item.description}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-muted">{item.type}</div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
