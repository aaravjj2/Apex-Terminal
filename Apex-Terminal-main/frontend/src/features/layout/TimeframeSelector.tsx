import { ChevronDown } from 'lucide-react';
import { useStore } from '../../state/store.ts';
import { useState } from 'react';

const TIMEFRAMES = ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1D'];

export const TimeframeSelector = () => {
    const { timeframe, setTimeframe } = useStore();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1e222d] border border-[#2a2e39] rounded hover:bg-[#2a2e39] transition"
            >
                <span className="font-semibold text-sm">{timeframe}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[#1e222d] border border-[#2a2e39] rounded shadow-lg z-50 min-w-[80px]">
                    {TIMEFRAMES.map(tf => (
                        <button
                            key={tf}
                            onClick={() => {
                                setTimeframe(tf);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2e39] transition ${timeframe === tf ? 'text-blue-500' : 'text-gray-300'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
