import { useState, useEffect } from 'react';
import { ScrollText, Download, X, RefreshCw } from 'lucide-react';

interface Trade {
    id: string;
    order_id: string;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    commission: number;
    timestamp: string;
}



export function TradesLedger({ embedded }: { embedded?: boolean }) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            // const res = await fetch(`${API_BASE}/portfolio/trades`); ...
            // Mock data
            setTrades([
                { id: 'TRD-101', order_id: 'ORD-001', symbol: 'AAPL', side: 'buy', quantity: 100, price: 175.50, commission: 1.00, timestamp: new Date().toISOString() },
                { id: 'TRD-100', order_id: 'ORD-005', symbol: 'TSLA', side: 'sell', quantity: 10, price: 240.20, commission: 0.50, timestamp: new Date(Date.now() - 86400000).toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen || embedded) fetchTrades();
    }, [isOpen, embedded]);

    const exportCSV = () => {
        const headers = ['ID', 'Time', 'Symbol', 'Side', 'Qty', 'Price', 'Comm'];
        const rows = trades.map(t => [t.id, t.timestamp, t.symbol, t.side, t.quantity, t.price, t.commission]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trades.csv';
        a.click();
    };

    return (
        <>
            {!embedded && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded transition-colors"
                >
                    <ScrollText size={14} />
                    Trades
                </button>
            )}

            {(isOpen || embedded) && (
                <div className={embedded ? "h-full flex flex-col bg-gray-900" : "fixed bottom-0 left-0 right-0 h-80 bg-gray-900 border-t border-gray-700 z-50 flex flex-col shadow-2xl animate-slide-up"}>
                    {/* Header */}
                    <div className="p-2 border-b border-gray-800 flex items-center justify-between">
                        {!embedded && <h2 className="text-lg font-semibold text-white">Trades Ledger</h2>}
                        <div className="flex items-center gap-2 ml-auto">
                            <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-xs rounded">
                                <Download size={12} />
                                CSV
                            </button>
                            <button onClick={fetchTrades} className="p-1 hover:bg-gray-800 rounded">
                                <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            {!embedded && (
                                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-700 rounded">
                                    <X size={16} className="text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-800 sticky top-0">
                                <tr className="text-gray-400 text-left">
                                    <th className="p-2">Time</th>
                                    <th className="p-2">Symbol</th>
                                    <th className="p-2">Side</th>
                                    <th className="p-2 text-right">Qty</th>
                                    <th className="p-2 text-right">Price</th>
                                    <th className="p-2 text-right">Comm</th>
                                    <th className="p-2">ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((t) => (
                                    <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800">
                                        <td className="p-2 text-gray-400">{new Date(t.timestamp).toLocaleString()}</td>
                                        <td className="p-2 font-medium text-gray-200">{t.symbol}</td>
                                        <td className={`p-2 font-bold uppercase ${t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                                        <td className="p-2 text-right text-gray-300">{t.quantity}</td>
                                        <td className="p-2 text-right text-gray-300">${t.price.toFixed(2)}</td>
                                        <td className="p-2 text-right text-gray-400">${t.commission.toFixed(2)}</td>
                                        <td className="p-2 text-gray-500 font-mono text-[10px]">{t.id}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
