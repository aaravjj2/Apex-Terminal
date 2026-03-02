import React, { useState, useMemo } from 'react';
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
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Briefcase, BarChart3,
  RefreshCw, ArrowUpDown, ChevronDown, Eye, EyeOff, Star,
  AlertTriangle, Clock, Target, Activity,
} from 'lucide-react';

// --- Types ---

interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number;
  change: number;
  changePct: number;
  value: number;
  weight: number;
  dayPnL: number;
  totalPnL: number;
  totalPnLPct: number;
  sector: string;
}

interface Transaction {
  id: string;
  date: string;
  type: 'buy' | 'sell' | 'dividend';
  symbol: string;
  shares: number;
  price: number;
  total: number;
}

// --- Mock Data ---

const HOLDINGS: Holding[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', shares: 150, avgCost: 165.20, price: 189.84, change: 2.34, changePct: 1.25, value: 28476, weight: 18.5, dayPnL: 351, totalPnL: 3696, totalPnLPct: 14.91, sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', shares: 80, avgCost: 340.50, price: 378.91, change: -1.22, changePct: -0.32, value: 30313, weight: 19.7, dayPnL: -97.6, totalPnL: 3072.8, totalPnLPct: 11.28, sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', shares: 200, avgCost: 125.40, price: 141.80, change: 0.95, changePct: 0.67, value: 28360, weight: 18.4, dayPnL: 190, totalPnL: 3280, totalPnLPct: 13.08, sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan', shares: 100, avgCost: 148.30, price: 171.62, change: 0.44, changePct: 0.26, value: 17162, weight: 11.1, dayPnL: 44, totalPnL: 2332, totalPnLPct: 15.72, sector: 'Financial' },
  { symbol: 'JNJ', name: 'J&J', shares: 80, avgCost: 162.10, price: 157.18, change: -0.56, changePct: -0.36, value: 12574.4, weight: 8.2, dayPnL: -44.8, totalPnL: -393.6, totalPnLPct: -3.04, sector: 'Healthcare' },
  { symbol: 'XOM', name: 'Exxon Mobil', shares: 120, avgCost: 95.80, price: 104.52, change: 1.10, changePct: 1.06, value: 12542.4, weight: 8.1, dayPnL: 132, totalPnL: 1046.4, totalPnLPct: 9.10, sector: 'Energy' },
  { symbol: 'PG', name: 'P&G', shares: 60, avgCost: 149.90, price: 158.32, change: 0.22, changePct: 0.14, value: 9499.2, weight: 6.2, dayPnL: 13.2, totalPnL: 505.2, totalPnLPct: 5.62, sector: 'Consumer' },
  { symbol: 'V', name: 'Visa', shares: 40, avgCost: 245.60, price: 261.44, change: 1.02, changePct: 0.39, value: 10457.6, weight: 6.8, dayPnL: 40.8, totalPnL: 633.6, totalPnLPct: 6.45, sector: 'Financial' },
  { symbol: 'UNH', name: 'UnitedHealth', shares: 10, avgCost: 502.30, price: 528.15, change: -2.40, changePct: -0.45, value: 5281.5, weight: 3.4, dayPnL: -24, totalPnL: 258.5, totalPnLPct: 5.14, sector: 'Healthcare' },
];

const TOTAL_VALUE = 154666.1;
const CASH = 12450.80;
const DAY_PNL = 605.6;
const TOTAL_PNL = 14430.9;

const SECTOR_DATA = [
  { name: 'Technology', value: 56.6, color: '#6699ff' },
  { name: 'Financial', value: 17.9, color: '#ff9900' },
  { name: 'Healthcare', value: 11.6, color: '#00cc66' },
  { name: 'Energy', value: 8.1, color: '#ff3333' },
  { name: 'Consumer', value: 6.2, color: '#cc66ff' },
];

const ALLOCATION_DATA = [
  { name: 'Equities', value: 92.5, color: '#6699ff' },
  { name: 'Cash', value: 7.5, color: '#ff9900' },
];

const PERF_DATA = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(2025, 9, 1);
  date.setDate(date.getDate() + i);
  return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    portfolio: +(100 + Math.sin(i * 0.08) * 5 + i * 0.12 + Math.random() * 2).toFixed(2),
    benchmark: +(100 + Math.sin(i * 0.07) * 4 + i * 0.08 + Math.random() * 1.5).toFixed(2),
  };
});

const TRANSACTIONS: Transaction[] = [
  { id: 't1', date: '2025-02-28', type: 'buy', symbol: 'NVDA', shares: 20, price: 495.22, total: 9904.40 },
  { id: 't2', date: '2025-02-27', type: 'sell', symbol: 'META', shares: 15, price: 326.49, total: 4897.35 },
  { id: 't3', date: '2025-02-26', type: 'dividend', symbol: 'AAPL', shares: 150, price: 0.24, total: 36.00 },
  { id: 't4', date: '2025-02-25', type: 'buy', symbol: 'JPM', shares: 25, price: 170.80, total: 4270.00 },
  { id: 't5', date: '2025-02-24', type: 'sell', symbol: 'TSLA', shares: 10, price: 248.48, total: 2484.80 },
  { id: 't6', date: '2025-02-22', type: 'dividend', symbol: 'JPM', shares: 100, price: 1.05, total: 105.00 },
];

const REBALANCE_SUGGESTIONS = [
  { action: 'Reduce', symbol: 'MSFT', reason: 'Overweight Technology (+6.6%)', severity: 'medium' as const },
  { action: 'Add', symbol: 'VWO', reason: 'No EM exposure', severity: 'high' as const },
  { action: 'Add', symbol: 'BND', reason: 'No fixed income allocation', severity: 'high' as const },
  { action: 'Reduce', symbol: 'AAPL', reason: 'Single stock > 15% of portfolio', severity: 'low' as const },
];

const RISK_METRICS = {
  var95: -2847.2,
  sharpe: 1.42,
  sortino: 1.85,
  maxDD: -8.3,
  beta: 1.08,
  alpha: 2.4,
  treynor: 0.12,
  infoRatio: 0.68,
};

// --- Sub-components ---

const SummaryCard: React.FC<{
  icon: React.ReactNode; label: string; value: string; sub?: string; positive?: boolean | null;
}> = ({ icon, label, value, sub, positive }) => (
  <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3 flex-1 min-w-[140px]">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-gray-500">{icon}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-lg font-bold ${positive === true ? 'text-[#00cc66]' : positive === false ? 'text-[#ff3333]' : 'text-gray-200'}`}>
      {value}
    </div>
    {sub && <div className={`text-[10px] mt-0.5 ${positive === true ? 'text-[#00cc66]/70' : positive === false ? 'text-[#ff3333]/70' : 'text-gray-500'}`}>{sub}</div>}
  </div>
);

const MetricBox: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-gray-300' }) => (
  <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded p-2">
    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    <div className={`text-sm font-bold mt-0.5 ${color}`}>{value}</div>
  </div>
);

// --- Main Component ---

export const PortfolioDashboard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'risk' | 'transactions'>('overview');
  const [sortCol, setSortCol] = useState<string>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showValues, setShowValues] = useState(true);

  const sortedHoldings = useMemo(() =>
    [...HOLDINGS].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] as number;
      const bv = (b as Record<string, unknown>)[sortCol] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    }),
    [sortCol, sortDir]
  );

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'performance', label: 'Performance' },
    { key: 'risk', label: 'Risk' },
    { key: 'transactions', label: 'Transactions' },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <Briefcase size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">Portfolio Dashboard</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowValues((v) => !v)} className="text-gray-500 hover:text-gray-300 p-1" title="Toggle values">
          {showValues ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button className="text-gray-500 hover:text-gray-300 p-1"><RefreshCw size={14} /></button>
      </div>

      {/* Summary Cards */}
      <div className="flex gap-3 px-4 py-3 border-b border-[#1a1a2e]">
        <SummaryCard icon={<DollarSign size={14} />} label="Total Value" value={showValues ? `$${(TOTAL_VALUE + CASH).toLocaleString()}` : '••••••'} />
        <SummaryCard icon={<TrendingUp size={14} />} label="Day P&L" value={showValues ? `+$${DAY_PNL.toLocaleString()}` : '••••••'} sub="+0.39%" positive={DAY_PNL > 0} />
        <SummaryCard icon={<BarChart3 size={14} />} label="Total P&L" value={showValues ? `+$${TOTAL_PNL.toLocaleString()}` : '••••••'} sub="+10.3%" positive={TOTAL_PNL > 0} />
        <SummaryCard icon={<Briefcase size={14} />} label="Cash" value={showValues ? `$${CASH.toLocaleString()}` : '••••••'} sub="7.5% of portfolio" positive={null} />
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Allocation Chart */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Asset Allocation</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ALLOCATION_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                        {ALLOCATION_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-1">
                  {ALLOCATION_DATA.map((a) => (
                    <div key={a.name} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-gray-400">{a.name}</span>
                      <span className="text-gray-300 font-medium">{a.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Exposure */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sector Exposure</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SECTOR_DATA} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} domain={[0, 60]} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {SECTOR_DATA.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.7} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rebalancing Suggestions */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Target size={10} />
                  Rebalancing Suggestions
                </div>
                <div className="space-y-2">
                  {REBALANCE_SUGGESTIONS.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-[#0a0a14] rounded border border-[#1a1a2e]">
                      <AlertTriangle size={12} className={s.severity === 'high' ? 'text-[#ff3333] mt-0.5' : s.severity === 'medium' ? 'text-[#ff9900] mt-0.5' : 'text-gray-500 mt-0.5'} />
                      <div>
                        <div className="text-xs">
                          <span className={s.action === 'Reduce' ? 'text-[#ff3333]' : 'text-[#00cc66]'}>{s.action}</span>
                          <span className="text-amber-400 ml-1">{s.symbol}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{s.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e] flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Top Holdings ({HOLDINGS.length})</span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a2e]">
                      {[
                        { key: 'symbol', label: 'Symbol', align: 'left' },
                        { key: 'price', label: 'Price', align: 'right' },
                        { key: 'changePct', label: 'Chg%', align: 'right' },
                        { key: 'shares', label: 'Shares', align: 'right' },
                        { key: 'value', label: 'Value', align: 'right' },
                        { key: 'weight', label: 'Weight', align: 'right' },
                        { key: 'dayPnL', label: 'Day P&L', align: 'right' },
                        { key: 'totalPnLPct', label: 'Total P&L%', align: 'right' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-300 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
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
                    {sortedHoldings.map((h) => (
                      <tr key={h.symbol} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f] transition-colors cursor-pointer">
                        <td className="px-3 py-2">
                          <div className="text-amber-400 font-medium">{h.symbol}</div>
                          <div className="text-gray-600 text-[10px]">{h.name}</div>
                        </td>
                        <td className="px-3 py-2 text-right">${h.price.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${h.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {h.changePct >= 0 ? '+' : ''}{h.changePct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">{showValues ? h.shares : '••'}</td>
                        <td className="px-3 py-2 text-right">{showValues ? `$${h.value.toLocaleString()}` : '••••'}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{h.weight}%</td>
                        <td className={`px-3 py-2 text-right ${h.dayPnL >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {showValues ? `${h.dayPnL >= 0 ? '+' : ''}$${h.dayPnL.toFixed(0)}` : '••••'}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${h.totalPnLPct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {h.totalPnLPct >= 0 ? '+' : ''}{h.totalPnLPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="p-4 space-y-4">
            {/* Performance Chart */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Cumulative Return vs Benchmark (S&P 500)</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-amber-400" /><span className="text-gray-400">Portfolio</span></div>
                  <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#6699ff]" /><span className="text-gray-400">S&P 500</span></div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={PERF_DATA} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} tickCount={10} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} />
                    <Area type="monotone" dataKey="portfolio" fill="#ff990020" stroke="#ff9900" strokeWidth={2} />
                    <Line type="monotone" dataKey="benchmark" stroke="#6699ff" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Period Returns */}
            <div className="grid grid-cols-6 gap-2">
              {[
                { label: '1D', value: '+0.39%', positive: true },
                { label: '1W', value: '+1.82%', positive: true },
                { label: '1M', value: '+3.45%', positive: true },
                { label: '3M', value: '+7.21%', positive: true },
                { label: 'YTD', value: '+10.3%', positive: true },
                { label: '1Y', value: '+18.6%', positive: true },
              ].map((p) => (
                <div key={p.label} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3 text-center">
                  <div className="text-[10px] text-gray-500 uppercase">{p.label}</div>
                  <div className={`text-sm font-bold mt-1 ${p.positive ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="p-4">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <MetricBox label="VaR (95%)" value={showValues ? `$${Math.abs(RISK_METRICS.var95).toLocaleString()}` : '••••'} color="text-[#ff3333]" />
              <MetricBox label="Sharpe Ratio" value={RISK_METRICS.sharpe.toFixed(2)} color="text-[#00cc66]" />
              <MetricBox label="Max Drawdown" value={`${RISK_METRICS.maxDD}%`} color="text-[#ff3333]" />
              <MetricBox label="Beta" value={RISK_METRICS.beta.toFixed(2)} />
              <MetricBox label="Sortino" value={RISK_METRICS.sortino.toFixed(2)} color="text-[#00cc66]" />
              <MetricBox label="Alpha" value={`${RISK_METRICS.alpha}%`} color="text-[#00cc66]" />
              <MetricBox label="Treynor" value={RISK_METRICS.treynor.toFixed(2)} />
              <MetricBox label="Info Ratio" value={RISK_METRICS.infoRatio.toFixed(2)} color="text-[#6699ff]" />
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Recent Transactions</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Date</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Type</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Symbol</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Shares</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Price</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSACTIONS.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-gray-400">{tx.date}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tx.type === 'buy' ? 'bg-[#00cc66]/20 text-[#00cc66]' : tx.type === 'sell' ? 'bg-[#ff3333]/20 text-[#ff3333]' : 'bg-[#6699ff]/20 text-[#6699ff]'}`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-amber-400 font-medium">{tx.symbol}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{tx.shares}</td>
                      <td className="px-3 py-2 text-right">${tx.price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{showValues ? `$${tx.total.toLocaleString()}` : '••••'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioDashboard;
