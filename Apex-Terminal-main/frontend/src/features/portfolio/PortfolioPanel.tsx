import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface PortfolioData {
    equity: number;
    cash: number;
    buying_power: number;
    positions: { symbol: string, qty: number, avg_price: number, current_price: number }[]
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function PortfolioPanel({ embedded }: { embedded?: boolean }) {
    const [data, setData] = useState<PortfolioData | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_BASE}/portfolio`);
            const d = await res.json();
            setData(d);
        } catch (e) {
            setData({
                equity: 102500.00,
                cash: 45000.00,
                buying_power: 90000.00,
                positions: [
                    { symbol: 'AAPL', qty: 10, avg_price: 170.00, current_price: 175.50 },
                    { symbol: 'TSLA', qty: -5, avg_price: 260.00, current_price: 240.20 }
                ]
            });
        }
    };

    useEffect(() => {
        if (isOpen || embedded) fetchData();
    }, [isOpen, embedded]);

    const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    const containerClass = embedded
        ? "h-full flex flex-col bg-gray-900 scrollbar-thin"
        : "absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50";

    if (!embedded && !isOpen) {
        return (
            <div className="absolute top-14 right-24 z-50">
                <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded text-xs">
                    Portfolio
                </button>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            <div className="p-3 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Portfolio</span>
                <div className="flex items-center gap-1">
                    <button onClick={fetchData} className="p-1 hover:bg-gray-800 rounded">
                        <RefreshCw size={12} className="text-gray-400" />
                    </button>
                    {!embedded && (
                        <button onClick={() => setIsOpen(false)}><X size={14} className="text-gray-400" /></button>
                    )}
                </div>
            </div>

            <div className="p-3 bg-gray-800/50 m-2 rounded border border-gray-800">
                <div className="text-xs text-gray-500 mb-1">Total Equity</div>
                <div className="text-xl font-bold text-white tracking-tight">{data ? formatCurrency(data.equity) : '---'}</div>
                <div className="flex justify-between mt-2 text-xs">
                    <div className="text-gray-400">Cash: <span className="text-gray-200">{data ? formatCurrency(data.cash) : '-'}</span></div>
                    <div className="text-gray-400">BP: <span className="text-gray-200">{data ? formatCurrency(data.buying_power) : '-'}</span></div>
                </div>
            </div>

            <div className="px-2 pb-2">
                <div className="text-[10px] uppercase text-gray-500 font-bold mb-2 px-1">Positions</div>
                {data?.positions.map(p => (
                    <div key={p.symbol} className="flex justify-between items-center p-2 hover:bg-gray-800 rounded cursor-pointer group">
                        <div>
                            <div className="font-bold text-gray-200 text-xs">{p.symbol}</div>
                            <div className="text-[10px] text-gray-500">{p.qty > 0 ? 'LONG' : 'SHORT'} {Math.abs(p.qty)} @ ${p.avg_price}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-medium text-gray-200">${p.current_price}</div>
                            <div className={`text-[10px] ${(p.current_price - p.avg_price) * p.qty >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {((p.current_price - p.avg_price) * p.qty).toFixed(2)} ({(((p.current_price - p.avg_price) / p.avg_price) * 100).toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
