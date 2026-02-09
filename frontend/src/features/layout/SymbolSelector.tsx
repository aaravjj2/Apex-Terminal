import { ChevronDown } from 'lucide-react';
import { useStore } from '../../state/store.ts';
import { useState } from 'react';

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'SPY', 'QQQ', 'BTC-USD'];

export const SymbolSelector = () => {
    const { symbol, setSymbol } = useStore();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1e222d] border border-[#2a2e39] rounded hover:bg-[#2a2e39] transition"
            >
                <span className="font-semibold text-sm">{symbol}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[#1e222d] border border-[#2a2e39] rounded shadow-lg z-50 min-w-[120px]">
                    {SYMBOLS.map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                setSymbol(s);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2e39] transition ${symbol === s ? 'text-blue-500' : 'text-gray-300'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
