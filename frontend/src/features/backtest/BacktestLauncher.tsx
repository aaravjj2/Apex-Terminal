import { useState, useRef, useEffect } from 'react';
import { FlaskConical, Play, X, TrendingUp, Hash } from 'lucide-react';

interface BacktestConfig {
    strategy_type: string;
    symbol: string;
    start_date: string;
    end_date: string;
    timeframe: string;
    initial_capital: number;
    slippage_pct: number;
    commission_per_share: number;
}

interface BacktestResult {
    id: string;
    config_hash: string;
    trade_log_hash: string;
    equity_curve_hash: string;
    initial_capital: number;
    final_equity: number;
    total_return: number;
    total_return_pct: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    equity_curve: number[];
}

export function BacktestLauncher({ onClose }: { onClose: () => void }) {
    const [config, setConfig] = useState<BacktestConfig>({
        strategy_type: 'sma_crossover',
        symbol: 'AAPL',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        timeframe: '1d',
        initial_capital: 100000,
        slippage_pct: 0.05,
        commission_per_share: 0.01,
    });

    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BacktestResult[]>([]);
    const [selectedResults, setSelectedResults] = useState<string[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const runBacktest = async () => {
        setRunning(true);
        setProgress(0);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setProgress(p => Math.min(p + 10, 90));
        }, 200);

        try {
            // In real implementation, call the backtest API
            await new Promise(r => setTimeout(r, 2000));

            clearInterval(progressInterval);
            setProgress(100);

            // Mock result
            const result: BacktestResult = {
                id: `BT-${Date.now()}`,
                config_hash: Math.random().toString(36).substring(2, 18),
                trade_log_hash: Math.random().toString(36).substring(2, 18),
                equity_curve_hash: Math.random().toString(36).substring(2, 18),
                initial_capital: config.initial_capital,
                final_equity: config.initial_capital * (1 + Math.random() * 0.2 - 0.05),
                total_return: 0,
                total_return_pct: 0,
                total_trades: Math.floor(Math.random() * 50) + 10,
                winning_trades: 0,
                losing_trades: 0,
                win_rate: Math.random() * 30 + 40,
                max_drawdown_pct: Math.random() * 10 + 2,
                sharpe_ratio: Math.random() * 2,
                sortino_ratio: Math.random() * 2.5,
                equity_curve: Array.from({ length: 50 }, (_, i) =>
                    config.initial_capital * (1 + (Math.random() * 0.02 - 0.005) * i)
                ),
            };
            result.total_return = result.final_equity - result.initial_capital;
            result.total_return_pct = (result.total_return / result.initial_capital) * 100;
            result.winning_trades = Math.floor(result.total_trades * (result.win_rate / 100));
            result.losing_trades = result.total_trades - result.winning_trades;

            setResults(prev => [result, ...prev]);
        } catch (e) {
            console.error('Backtest failed:', e);
        } finally {
            setRunning(false);
        }
    };

    // Draw comparison chart
    useEffect(() => {
        if (!canvasRef.current || results.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const toShow = selectedResults.length > 0
            ? results.filter(r => selectedResults.includes(r.id))
            : results.slice(0, 3);

        if (toShow.length === 0) return;

        const allValues = toShow.flatMap(r => r.equity_curve);
        const min = Math.min(...allValues) * 0.995;
        const max = Math.max(...allValues) * 1.005;
        const range = max - min || 1;

        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        toShow.forEach((result, idx) => {
            ctx.strokeStyle = colors[idx % colors.length];
            ctx.lineWidth = 2;
            ctx.beginPath();

            result.equity_curve.forEach((val, i) => {
                const x = (i / (result.equity_curve.length - 1)) * width;
                const y = height - ((val - min) / range) * height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.stroke();
        });
    }, [results, selectedResults]);

    const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[900px] max-h-[700px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FlaskConical size={20} />
                        Backtest Launcher
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Config Panel */}
                    <div className="w-72 border-r border-gray-700 p-4 space-y-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Strategy</label>
                            <select
                                value={config.strategy_type}
                                onChange={(e) => setConfig(prev => ({ ...prev, strategy_type: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            >
                                <option value="sma_crossover">SMA Crossover</option>
                                <option value="rsi_breakout">RSI Breakout</option>
                                <option value="vwap_reversion">VWAP Reversion</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Symbol</label>
                            <select
                                value={config.symbol}
                                onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            >
                                {['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={config.start_date}
                                    onChange={(e) => setConfig(prev => ({ ...prev, start_date: e.target.value }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={config.end_date}
                                    onChange={(e) => setConfig(prev => ({ ...prev, end_date: e.target.value }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Initial Capital</label>
                            <input
                                type="number"
                                value={config.initial_capital}
                                onChange={(e) => setConfig(prev => ({ ...prev, initial_capital: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Slippage %</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={config.slippage_pct}
                                    onChange={(e) => setConfig(prev => ({ ...prev, slippage_pct: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Commission/Share</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={config.commission_per_share}
                                    onChange={(e) => setConfig(prev => ({ ...prev, commission_per_share: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                        </div>

                        <button
                            onClick={runBacktest}
                            disabled={running}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50"
                        >
                            <Play size={14} />
                            {running ? `Running... ${progress}%` : 'Run Backtest'}
                        </button>

                        {running && (
                            <div className="w-full bg-gray-700 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                        )}
                    </div>

                    {/* Results Panel */}
                    <div className="flex-1 flex flex-col">
                        {/* Chart */}
                        <div className="p-4 border-b border-gray-700">
                            <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                                <TrendingUp size={12} />
                                Equity Curves (select runs to compare)
                            </div>
                            <canvas ref={canvasRef} width={560} height={120} className="w-full bg-gray-900 rounded" />
                        </div>

                        {/* Results Table */}
                        <div className="flex-1 overflow-y-auto">
                            {results.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No backtest results yet. Configure and run a backtest.</div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-750 sticky top-0">
                                        <tr className="text-gray-400 text-left">
                                            <th className="p-2 w-8"></th>
                                            <th className="p-2">ID</th>
                                            <th className="p-2 text-right">Return</th>
                                            <th className="p-2 text-right">Trades</th>
                                            <th className="p-2 text-right">Win %</th>
                                            <th className="p-2 text-right">Sharpe</th>
                                            <th className="p-2 text-right">DD %</th>
                                            <th className="p-2">Hash</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((r) => (
                                            <tr
                                                key={r.id}
                                                className={`border-b border-gray-700 hover:bg-gray-750 cursor-pointer ${selectedResults.includes(r.id) ? 'bg-blue-900/30' : ''
                                                    }`}
                                                onClick={() => {
                                                    setSelectedResults(prev =>
                                                        prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                                    );
                                                }}
                                            >
                                                <td className="p-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedResults.includes(r.id)}
                                                        onChange={() => { }}
                                                        className="rounded bg-gray-700 border-gray-600"
                                                    />
                                                </td>
                                                <td className="p-2 font-mono text-gray-300">{r.id}</td>
                                                <td className={`p-2 text-right font-medium ${r.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatPercent(r.total_return_pct)}
                                                </td>
                                                <td className="p-2 text-right text-gray-300">{r.total_trades}</td>
                                                <td className="p-2 text-right text-gray-300">{r.win_rate.toFixed(1)}%</td>
                                                <td className="p-2 text-right text-gray-300">{r.sharpe_ratio.toFixed(2)}</td>
                                                <td className="p-2 text-right text-red-400">{r.max_drawdown_pct.toFixed(2)}%</td>
                                                <td className="p-2">
                                                    <span className="flex items-center gap-1 text-gray-500 font-mono">
                                                        <Hash size={10} />
                                                        {r.config_hash.substring(0, 8)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
