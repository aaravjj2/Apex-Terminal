import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Play, Pause, RotateCcw, Save, Download, Settings2, ChevronDown,
  ChevronRight, Calendar, TrendingUp, BarChart3, ArrowUpDown,
  Layers, Zap, Clock, Target, AlertTriangle, X, Plus,
} from 'lucide-react';

// --- Types ---

type BacktestStatus = 'idle' | 'running' | 'complete' | 'error';

interface StrategyParam {
  name: string;
  type: 'number' | 'select';
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

interface Trade {
  id: string;
  entryDate: string;
  exitDate: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
}

interface MonthlyReturn {
  month: string;
  returns: { year: number; value: number }[];
}

// --- Mock Data ---

const STRATEGIES = [
  { id: 'sma_cross', name: 'SMA Crossover', description: 'Long when fast SMA crosses above slow SMA' },
  { id: 'rsi_revert', name: 'RSI Mean Reversion', description: 'Buy oversold, sell overbought' },
  { id: 'breakout', name: 'Breakout Momentum', description: 'Enter on N-day high breakout' },
  { id: 'pairs', name: 'Pairs Trading', description: 'Mean reversion on correlated pairs' },
  { id: 'macd_div', name: 'MACD Divergence', description: 'Trade divergences between price and MACD' },
];

const DEFAULT_PARAMS: StrategyParam[] = [
  { name: 'Fast Period', type: 'number', value: 10, min: 2, max: 50, step: 1 },
  { name: 'Slow Period', type: 'number', value: 30, min: 10, max: 200, step: 5 },
  { name: 'Stop Loss %', type: 'number', value: 2, min: 0.5, max: 10, step: 0.5 },
  { name: 'Take Profit %', type: 'number', value: 5, min: 1, max: 20, step: 1 },
  { name: 'Position Size', type: 'select', value: '10%', options: ['5%', '10%', '20%', '25%', '50%', '100%'] },
  { name: 'Rebalance', type: 'select', value: 'Daily', options: ['Daily', 'Weekly', 'Monthly'] },
];

const genEquityCurve = () => {
  const data: { date: string; equity: number; benchmark: number; drawdown: number }[] = [];
  let eq = 100000, bm = 100000, peak = 100000;
  for (let i = 0; i < 252; i++) {
    const d = new Date(2024, 0, 2);
    d.setDate(d.getDate() + i);
    eq *= 1 + (Math.random() - 0.47) * 0.02;
    bm *= 1 + (Math.random() - 0.48) * 0.015;
    peak = Math.max(peak, eq);
    const dd = ((eq - peak) / peak) * 100;
    data.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      equity: +eq.toFixed(0),
      benchmark: +bm.toFixed(0),
      drawdown: +dd.toFixed(2),
    });
  }
  return data;
};

const EQUITY_DATA = genEquityCurve();

const MOCK_TRADES: Trade[] = Array.from({ length: 30 }, (_, i) => {
  const side = Math.random() > 0.3 ? 'long' : 'short';
  const entry = +(150 + Math.random() * 50).toFixed(2);
  const exitMult = side === 'long' ? 1 + (Math.random() - 0.4) * 0.1 : 1 - (Math.random() - 0.4) * 0.1;
  const exit = +(entry * exitMult).toFixed(2);
  const pnl = side === 'long' ? exit - entry : entry - exit;
  const d1 = new Date(2024, 0, 2 + i * 8);
  const d2 = new Date(d1.getTime() + (1 + Math.floor(Math.random() * 15)) * 86400000);
  return {
    id: `t${i}`,
    entryDate: d1.toISOString().slice(0, 10),
    exitDate: d2.toISOString().slice(0, 10),
    symbol: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'][i % 5],
    side,
    entryPrice: entry,
    exitPrice: exit,
    pnl: +pnl.toFixed(2),
    pnlPct: +((pnl / entry) * 100).toFixed(2),
    holdingDays: Math.ceil((d2.getTime() - d1.getTime()) / 86400000),
  };
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHLY_RETURNS: { month: string; [key: string]: number | string }[] = MONTHS.map((m, mi) => {
  const row: Record<string, number | string> = { month: m };
  [2022, 2023, 2024].forEach((y) => {
    row[String(y)] = +((Math.random() - 0.4) * 8).toFixed(2);
  });
  return row;
});

const KEY_METRICS = {
  totalReturn: 28.4,
  annualReturn: 22.1,
  sharpe: 1.65,
  sortino: 2.12,
  maxDD: -12.3,
  maxDDDuration: '34 days',
  winRate: 58.2,
  profitFactor: 1.82,
  avgWin: 3.45,
  avgLoss: -2.10,
  totalTrades: 142,
  avgHolding: '4.2 days',
  calmarRatio: 1.80,
  expectancy: 0.72,
};

// --- Sub-components ---

const MetricCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-gray-200' }) => (
  <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-2.5">
    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    <div className={`text-sm font-bold mt-0.5 ${color}`}>{value}</div>
  </div>
);

const MonthlyHeatmap: React.FC = () => {
  const years = [2022, 2023, 2024];
  const getColor = (v: number) => {
    if (v > 4) return 'bg-[#00cc66]/60';
    if (v > 2) return 'bg-[#00cc66]/40';
    if (v > 0) return 'bg-[#00cc66]/20';
    if (v > -2) return 'bg-[#ff3333]/20';
    if (v > -4) return 'bg-[#ff3333]/40';
    return 'bg-[#ff3333]/60';
  };

  return (
    <div className="overflow-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-gray-500 text-left">Month</th>
            {years.map((y) => <th key={y} className="px-2 py-1 text-gray-500 text-center">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {MONTHLY_RETURNS.map((row) => (
            <tr key={row.month}>
              <td className="px-2 py-1 text-gray-400 font-medium">{row.month}</td>
              {years.map((y) => {
                const v = row[String(y)] as number;
                return (
                  <td key={y} className={`px-2 py-1 text-center font-medium rounded ${getColor(v)} ${v >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                    {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Main Component ---

export const BacktestWorkspace: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [params, setParams] = useState<StrategyParam[]>(DEFAULT_PARAMS);
  const [status, setStatus] = useState<BacktestStatus>('complete');
  const [progress, setProgress] = useState(100);
  const [dateRange, setDateRange] = useState({ from: '2024-01-01', to: '2024-12-31' });
  const [resultTab, setResultTab] = useState<'equity' | 'heatmap' | 'trades' | 'drawdown'>('equity');
  const [showOptimize, setShowOptimize] = useState(false);
  const [sortCol, setSortCol] = useState<string>('pnl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [compareMode, setCompareMode] = useState(false);

  const updateParam = useCallback((name: string, value: number | string) => {
    setParams((prev) => prev.map((p) => (p.name === name ? { ...p, value } : p)));
  }, []);

  const runBacktest = useCallback(() => {
    setStatus('running');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setStatus('complete'); return 100; }
        return p + Math.random() * 15;
      });
    }, 200);
  }, []);

  const sortedTrades = useMemo(() =>
    [...MOCK_TRADES].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol];
      const bv = (b as Record<string, unknown>)[sortCol];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return 0;
    }),
    [sortCol, sortDir]
  );

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <div className={`flex h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Left Panel: Config */}
      <div className="w-64 border-r border-[#1a1a2e] flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Strategy</span>
        </div>

        {/* Strategy Selector */}
        <div className="p-2 border-b border-[#1a1a2e]">
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="w-full bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-amber-500/50"
          >
            {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="text-[10px] text-gray-500 mt-1 px-1">
            {STRATEGIES.find((s) => s.id === selectedStrategy)?.description}
          </div>
        </div>

        {/* Parameters */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1">Parameters</div>
          {params.map((p) => (
            <div key={p.name} className="px-1">
              <label className="text-[10px] text-gray-400 mb-0.5 block">{p.name}</label>
              {p.type === 'number' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={p.value as number}
                    onChange={(e) => updateParam(p.name, +e.target.value)}
                    className="flex-1 accent-amber-500 h-1"
                  />
                  <span className="text-xs text-amber-400 w-8 text-right">{p.value}</span>
                </div>
              ) : (
                <select
                  value={p.value as string}
                  onChange={(e) => updateParam(p.name, e.target.value)}
                  className="w-full bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-amber-500/50"
                >
                  {p.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Date Range */}
        <div className="p-2 border-t border-[#1a1a2e]">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1">
            <Calendar size={10} /> Date Range
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
              className="flex-1 bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-1.5 py-1 rounded focus:outline-none focus:border-amber-500/50"
            />
            <span className="text-gray-600 text-[10px]">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
              className="flex-1 bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-1.5 py-1 rounded focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-2 border-t border-[#1a1a2e] space-y-1.5">
          <button
            onClick={runBacktest}
            disabled={status === 'running'}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium transition-colors ${status === 'running' ? 'bg-amber-500/10 text-amber-400/50 cursor-wait' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}
          >
            {status === 'running' ? <><Clock size={12} className="animate-spin" /> Running {Math.min(100, Math.floor(progress))}%</> : <><Play size={12} /> Run Backtest</>}
          </button>
          {status === 'running' && (
            <div className="w-full bg-[#1a1a2e] rounded-full h-1">
              <div className="bg-amber-500 h-1 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          )}
          <div className="flex gap-1.5">
            <button onClick={() => setShowOptimize((o) => !o)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-[#12121f] hover:bg-[#1a1a2e] transition-colors">
              <Zap size={10} /> Optimize
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-[#12121f] hover:bg-[#1a1a2e] transition-colors">
              <Layers size={10} /> Compare
            </button>
          </div>
          <div className="flex gap-1.5">
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-[#12121f] hover:bg-[#1a1a2e] transition-colors">
              <Save size={10} /> Save
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-[#12121f] hover:bg-[#1a1a2e] transition-colors">
              <Download size={10} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 flex flex-col min-w-0">
        {status === 'complete' ? (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-7 gap-2 p-3 border-b border-[#1a1a2e]">
              <MetricCard label="Total Return" value={`+${KEY_METRICS.totalReturn}%`} color="text-[#00cc66]" />
              <MetricCard label="Sharpe" value={KEY_METRICS.sharpe.toFixed(2)} color="text-[#00cc66]" />
              <MetricCard label="Max DD" value={`${KEY_METRICS.maxDD}%`} color="text-[#ff3333]" />
              <MetricCard label="Win Rate" value={`${KEY_METRICS.winRate}%`} color="text-amber-400" />
              <MetricCard label="Profit Factor" value={KEY_METRICS.profitFactor.toFixed(2)} color="text-[#00cc66]" />
              <MetricCard label="Trades" value={String(KEY_METRICS.totalTrades)} />
              <MetricCard label="Avg Holding" value={KEY_METRICS.avgHolding} />
            </div>

            {/* Result Tabs */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#1a1a2e] bg-[#0d0d1a]">
              {([
                { key: 'equity', label: 'Equity Curve' },
                { key: 'drawdown', label: 'Drawdown' },
                { key: 'heatmap', label: 'Monthly Returns' },
                { key: 'trades', label: 'Trade List' },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => setResultTab(t.key)} className={`px-3 py-1 text-xs rounded transition-colors ${resultTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-3">
              {resultTab === 'equity' && (
                <div className="h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={EQUITY_DATA} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} tickCount={12} />
                      <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" dataKey="equity" name="Strategy" fill="#ff990015" stroke="#ff9900" strokeWidth={2} />
                      <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#6699ff" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {resultTab === 'drawdown' && (
                <div className="h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={EQUITY_DATA} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} tickCount={12} />
                      <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={['auto', 0]} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']} />
                      <ReferenceLine y={KEY_METRICS.maxDD} stroke="#ff333380" strokeDasharray="4 2" label={{ value: `Max DD: ${KEY_METRICS.maxDD}%`, fill: '#ff3333', fontSize: 10 }} />
                      <Area type="monotone" dataKey="drawdown" fill="#ff333320" stroke="#ff3333" strokeWidth={1.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {resultTab === 'heatmap' && (
                <MonthlyHeatmap />
              )}

              {resultTab === 'trades' && (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0d0d1a]">
                      <tr>
                        {[
                          { key: 'entryDate', label: 'Entry' },
                          { key: 'exitDate', label: 'Exit' },
                          { key: 'symbol', label: 'Symbol' },
                          { key: 'side', label: 'Side' },
                          { key: 'entryPrice', label: 'Entry $', align: 'right' },
                          { key: 'exitPrice', label: 'Exit $', align: 'right' },
                          { key: 'pnl', label: 'P&L', align: 'right' },
                          { key: 'pnlPct', label: 'P&L%', align: 'right' },
                          { key: 'holdingDays', label: 'Days', align: 'right' },
                        ].map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={`px-3 py-2 font-medium text-gray-500 border-b border-[#1a1a2e] cursor-pointer hover:text-gray-300 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortCol === col.key && <ArrowUpDown size={10} className="text-amber-400" />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTrades.map((t) => (
                        <tr key={t.id} className="border-b border-[#1a1a2e]/30 hover:bg-[#0d0d1a]">
                          <td className="px-3 py-1.5 text-gray-400">{t.entryDate}</td>
                          <td className="px-3 py-1.5 text-gray-400">{t.exitDate}</td>
                          <td className="px-3 py-1.5 text-amber-400 font-medium">{t.symbol}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.side === 'long' ? 'bg-[#00cc66]/20 text-[#00cc66]' : 'bg-[#ff3333]/20 text-[#ff3333]'}`}>
                              {t.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">${t.entryPrice.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right">${t.exitPrice.toFixed(2)}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${t.pnl >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                            {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                          </td>
                          <td className={`px-3 py-1.5 text-right ${t.pnlPct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                            {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-400">{t.holdingDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Additional Metrics */}
            <div className="border-t border-[#1a1a2e] bg-[#0c0c18] px-3 py-2">
              <div className="flex items-center gap-6 text-[10px]">
                <div><span className="text-gray-500">Annual Return:</span> <span className="text-[#00cc66] font-medium">{KEY_METRICS.annualReturn}%</span></div>
                <div><span className="text-gray-500">Sortino:</span> <span className="text-gray-300">{KEY_METRICS.sortino}</span></div>
                <div><span className="text-gray-500">Calmar:</span> <span className="text-gray-300">{KEY_METRICS.calmarRatio}</span></div>
                <div><span className="text-gray-500">Avg Win:</span> <span className="text-[#00cc66]">{KEY_METRICS.avgWin}%</span></div>
                <div><span className="text-gray-500">Avg Loss:</span> <span className="text-[#ff3333]">{KEY_METRICS.avgLoss}%</span></div>
                <div><span className="text-gray-500">Expectancy:</span> <span className="text-gray-300">${KEY_METRICS.expectancy}</span></div>
                <div><span className="text-gray-500">DD Duration:</span> <span className="text-gray-300">{KEY_METRICS.maxDDDuration}</span></div>
              </div>
            </div>
          </>
        ) : status === 'idle' ? (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <Play size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Configure strategy and click Run Backtest</div>
            </div>
          </div>
        ) : null}

        {/* Optimization Panel */}
        {showOptimize && (
          <div className="border-t border-[#1a1a2e] bg-[#0c0c18] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <Zap size={12} /> Parameter Optimization
              </span>
              <button onClick={() => setShowOptimize(false)} className="text-gray-600 hover:text-gray-400"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              {params.filter((p) => p.type === 'number').map((p) => (
                <div key={p.name} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-gray-500 mb-1">{p.name}</div>
                  <div className="flex items-center gap-1.5">
                    <input type="number" defaultValue={p.min} className="w-14 bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-1 py-0.5 rounded" placeholder="Min" />
                    <span className="text-gray-600">→</span>
                    <input type="number" defaultValue={p.max} className="w-14 bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-1 py-0.5 rounded" placeholder="Max" />
                    <span className="text-gray-600">Δ</span>
                    <input type="number" defaultValue={p.step} className="w-14 bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-1 py-0.5 rounded" placeholder="Step" />
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-2 px-4 py-1.5 bg-amber-500/20 text-amber-400 text-xs rounded hover:bg-amber-500/30 transition-colors flex items-center gap-1">
              <Zap size={12} /> Run Optimization
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BacktestWorkspace;
