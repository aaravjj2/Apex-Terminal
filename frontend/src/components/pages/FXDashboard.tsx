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
  BarChart,
  Cell,
} from 'recharts';
import {
  Globe, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw,
  BarChart3, Activity, DollarSign, ArrowRightLeft,
} from 'lucide-react';

// --- Mock Data ---

const MAJOR_PAIRS = [
  { pair: 'EUR/USD', bid: 1.0842, ask: 1.0844, change: -0.0012, changePct: -0.11, high: 1.0868, low: 1.0825 },
  { pair: 'GBP/USD', bid: 1.2645, ask: 1.2647, change: 0.0018, changePct: 0.14, high: 1.2672, low: 1.2618 },
  { pair: 'USD/JPY', bid: 150.32, ask: 150.34, change: 0.45, changePct: 0.30, high: 150.88, low: 149.82 },
  { pair: 'USD/CHF', bid: 0.8815, ask: 0.8817, change: 0.0008, changePct: 0.09, high: 0.8842, low: 0.8798 },
  { pair: 'AUD/USD', bid: 0.6528, ask: 0.6530, change: -0.0022, changePct: -0.34, high: 0.6558, low: 0.6512 },
  { pair: 'USD/CAD', bid: 1.3568, ask: 1.3570, change: 0.0015, changePct: 0.11, high: 1.3592, low: 1.3545 },
  { pair: 'NZD/USD', bid: 0.6112, ask: 0.6114, change: -0.0018, changePct: -0.29, high: 0.6138, low: 0.6098 },
  { pair: 'EUR/GBP', bid: 0.8575, ask: 0.8577, change: -0.0015, changePct: -0.17, high: 0.8598, low: 0.8562 },
];

const CROSS_RATE_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];
const CROSS_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, EUR: 0.9222, GBP: 0.7908, JPY: 150.33, CHF: 0.8816, AUD: 1.5319, CAD: 1.3569 },
  EUR: { USD: 1.0843, EUR: 1, GBP: 0.8576, JPY: 163.02, CHF: 0.9560, AUD: 1.6609, CAD: 1.4716 },
  GBP: { USD: 1.2646, EUR: 1.1661, GBP: 1, JPY: 190.09, CHF: 1.1147, AUD: 1.9367, CAD: 1.7156 },
  JPY: { USD: 0.00665, EUR: 0.00614, GBP: 0.00526, JPY: 1, CHF: 0.00586, AUD: 0.01019, CAD: 0.00903 },
  CHF: { USD: 1.1342, EUR: 1.0460, GBP: 0.8971, JPY: 170.50, CHF: 1, AUD: 1.7375, CAD: 1.5391 },
  AUD: { USD: 0.6528, EUR: 0.6021, GBP: 0.5163, JPY: 98.16, CHF: 0.5756, AUD: 1, CAD: 0.8857 },
  CAD: { USD: 0.7370, EUR: 0.6795, GBP: 0.5829, JPY: 110.79, CHF: 0.6497, AUD: 1.1290, CAD: 1 },
};

const CARRY_TRADE = [
  { pair: 'AUD/JPY', long: 'AUD', short: 'JPY', rateSpread: 4.25, carry: 85, change3m: 2.1, risk: 'medium' as const },
  { pair: 'NZD/JPY', long: 'NZD', short: 'JPY', rateSpread: 5.40, carry: 108, change3m: 3.4, risk: 'medium' as const },
  { pair: 'USD/JPY', long: 'USD', short: 'JPY', rateSpread: 5.40, carry: 108, change3m: 4.2, risk: 'high' as const },
  { pair: 'GBP/JPY', long: 'GBP', short: 'JPY', rateSpread: 5.15, carry: 103, change3m: 1.8, risk: 'high' as const },
  { pair: 'MXN/JPY', long: 'MXN', short: 'JPY', rateSpread: 11.15, carry: 223, change3m: -1.5, risk: 'high' as const },
  { pair: 'EUR/CHF', long: 'EUR', short: 'CHF', rateSpread: 2.75, carry: 55, change3m: 0.3, risk: 'low' as const },
];

const FORWARD_POINTS = [
  { pair: 'EUR/USD', spot: 1.0843, '1M': -12.5, '3M': -35.2, '6M': -68.8, '1Y': -132.4 },
  { pair: 'GBP/USD', spot: 1.2646, '1M': -8.2, '3M': -22.5, '6M': -42.1, '1Y': -78.5 },
  { pair: 'USD/JPY', spot: 150.33, '1M': -52.0, '3M': -148.5, '6M': -285.0, '1Y': -545.2 },
  { pair: 'USD/CHF', spot: 0.8816, '1M': 5.8, '3M': 18.2, '6M': 38.5, '1Y': 82.1 },
  { pair: 'AUD/USD', spot: 0.6528, '1M': -2.1, '3M': -5.8, '6M': -10.2, '1Y': -18.5 },
  { pair: 'USD/CAD', spot: 1.3569, '1M': 1.5, '3M': 4.2, '6M': 8.8, '1Y': 18.2 },
];

const CB_RATE_COMPARISON = [
  { bank: 'Fed', currency: 'USD', rate: 5.50, color: '#6699ff' },
  { bank: 'ECB', currency: 'EUR', rate: 4.50, color: '#ff9900' },
  { bank: 'BoE', currency: 'GBP', rate: 5.25, color: '#00cc66' },
  { bank: 'BoJ', currency: 'JPY', rate: 0.10, color: '#ff3333' },
  { bank: 'SNB', currency: 'CHF', rate: 1.75, color: '#cc66ff' },
  { bank: 'RBA', currency: 'AUD', rate: 4.35, color: '#66cccc' },
  { bank: 'BoC', currency: 'CAD', rate: 5.00, color: '#ff6699' },
];

const STRENGTH_METER = [
  { currency: 'USD', strength: 72, change: 1.2 },
  { currency: 'EUR', strength: 48, change: -0.8 },
  { currency: 'GBP', strength: 55, change: 0.5 },
  { currency: 'JPY', strength: 28, change: -2.1 },
  { currency: 'CHF', strength: 52, change: 0.2 },
  { currency: 'AUD', strength: 38, change: -1.5 },
  { currency: 'CAD', strength: 45, change: -0.3 },
  { currency: 'NZD', strength: 35, change: -1.8 },
];

const FX_CORRELATION = [
  ['', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'],
  ['EUR', 1.00, 0.78, -0.35, 0.85, 0.52, 0.42],
  ['GBP', 0.78, 1.00, -0.28, 0.62, 0.55, 0.48],
  ['JPY', -0.35, -0.28, 1.00, -0.18, -0.45, -0.38],
  ['CHF', 0.85, 0.62, -0.18, 1.00, 0.38, 0.32],
  ['AUD', 0.52, 0.55, -0.45, 0.38, 1.00, 0.72],
  ['CAD', 0.42, 0.48, -0.38, 0.32, 0.72, 1.00],
];

const ECON_SURPRISE = [
  { country: 'US', index: 42.5, direction: 'positive' as const },
  { country: 'EU', index: -18.2, direction: 'negative' as const },
  { country: 'UK', index: -5.8, direction: 'negative' as const },
  { country: 'JP', index: 12.4, direction: 'positive' as const },
  { country: 'CN', index: -28.5, direction: 'negative' as const },
  { country: 'AU', index: 8.2, direction: 'positive' as const },
  { country: 'CA', index: -3.1, direction: 'negative' as const },
];

const MINI_CHART_DATA = Array.from({ length: 24 }, (_, i) => ({
  t: i,
  v: 1.0840 + Math.sin(i * 0.4) * 0.0015 + Math.random() * 0.001,
}));

// --- Main Component ---

export const FXDashboard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'cross' | 'carry' | 'forwards' | 'strength' | 'correlation'>('overview');

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'cross', label: 'Cross Rates' },
    { key: 'carry', label: 'Carry Trade' },
    { key: 'forwards', label: 'Forwards' },
    { key: 'strength', label: 'Strength' },
    { key: 'correlation', label: 'Correlation' },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <DollarSign size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">FX Dashboard</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-2.5 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs">
          <div><span className="text-gray-500">DXY:</span> <span className="text-amber-400">104.28</span> <span className="text-[#00cc66] text-[10px]">+0.15%</span></div>
        </div>
        <button className="text-gray-500 hover:text-gray-300 p-1 ml-2"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Major Pairs */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Major Pairs</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Pair</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Bid</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Ask</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Spread</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Change</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Chg%</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">High</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Low</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {MAJOR_PAIRS.map((p) => {
                    const spread = ((p.ask - p.bid) * (p.pair.includes('JPY') ? 100 : 10000)).toFixed(1);
                    return (
                      <tr key={p.pair} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f] cursor-pointer">
                        <td className="px-3 py-2 text-amber-400 font-bold">{p.pair}</td>
                        <td className="px-3 py-2 text-right text-gray-200 font-medium">{p.bid.toFixed(p.pair.includes('JPY') ? 2 : 4)}</td>
                        <td className="px-3 py-2 text-right text-gray-200">{p.ask.toFixed(p.pair.includes('JPY') ? 2 : 4)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{spread}</td>
                        <td className={`px-3 py-2 text-right font-medium ${p.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {p.change >= 0 ? '+' : ''}{p.change.toFixed(p.pair.includes('JPY') ? 2 : 4)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${p.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">{p.high.toFixed(p.pair.includes('JPY') ? 2 : 4)}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{p.low.toFixed(p.pair.includes('JPY') ? 2 : 4)}</td>
                        <td className="px-3 py-2">
                          <div className="w-20 h-6 mx-auto">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={MINI_CHART_DATA} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                                <Line type="monotone" dataKey="v" stroke={p.changePct >= 0 ? '#00cc66' : '#ff3333'} strokeWidth={1} dot={false} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Central Bank Rate Comparison */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Central Bank Rate Comparison</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CB_RATE_COMPARISON} margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="currency" tick={{ fill: '#999', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="rate" name="Policy Rate" radius={[3, 3, 0, 0]}>
                      {CB_RATE_COMPARISON.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.7} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Econ Surprise Index */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Economic Surprise Index</div>
              <div className="grid grid-cols-7 gap-2">
                {ECON_SURPRISE.map((es) => (
                  <div key={es.country} className="bg-[#0a0a14] border border-[#1a1a2e] rounded p-2 text-center">
                    <div className="text-xs text-gray-400 font-medium">{es.country}</div>
                    <div className={`text-sm font-bold mt-0.5 ${es.index >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                      {es.index >= 0 ? '+' : ''}{es.index}
                    </div>
                    <div className="mt-0.5">
                      {es.direction === 'positive' ? <TrendingUp size={10} className="text-[#00cc66] mx-auto" /> : <TrendingDown size={10} className="text-[#ff3333] mx-auto" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cross' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cross Rate Matrix</div>
              <div className="overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-1.5 text-left text-amber-400 font-bold">Base ↓ / Quote →</th>
                      {CROSS_RATE_CURRENCIES.map((c) => (
                        <th key={c} className="px-3 py-1.5 text-center text-amber-400 font-bold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CROSS_RATE_CURRENCIES.map((base) => (
                      <tr key={base} className="border-t border-[#1a1a2e]/50">
                        <td className="px-3 py-1.5 text-amber-400 font-bold">{base}</td>
                        {CROSS_RATE_CURRENCIES.map((quote) => {
                          const rate = CROSS_RATES[base]?.[quote] ?? 0;
                          const isIdentity = base === quote;
                          return (
                            <td key={quote} className={`px-3 py-1.5 text-center ${isIdentity ? 'text-gray-600 bg-[#1a1a2e]/30' : 'text-gray-300 hover:bg-[#12121f] cursor-pointer'}`}>
                              {isIdentity ? '—' : (rate < 1 ? rate.toFixed(4) : rate < 10 ? rate.toFixed(3) : rate.toFixed(2))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'carry' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Carry Trade Rankings</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Pair</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Long / Short</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Rate Diff</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Carry (bp/yr)</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">3M Spot Chg</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {CARRY_TRADE.map((ct) => (
                    <tr key={ct.pair} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-amber-400 font-medium">{ct.pair}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[#00cc66]">{ct.long}</span>
                        <ArrowRightLeft size={10} className="inline text-gray-600 mx-1" />
                        <span className="text-[#ff3333]">{ct.short}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{ct.rateSpread.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-[#00cc66] font-medium">{ct.carry}</td>
                      <td className={`px-3 py-2 text-right font-medium ${ct.change3m >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                        {ct.change3m >= 0 ? '+' : ''}{ct.change3m.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          ct.risk === 'high' ? 'bg-[#ff3333]/20 text-[#ff3333]' :
                          ct.risk === 'medium' ? 'bg-[#ff9900]/20 text-[#ff9900]' :
                          'bg-[#00cc66]/20 text-[#00cc66]'
                        }`}>{ct.risk.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'forwards' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Forward Points (pips)</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Pair</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Spot</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">1M</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">3M</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">6M</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">1Y</th>
                  </tr>
                </thead>
                <tbody>
                  {FORWARD_POINTS.map((fp) => (
                    <tr key={fp.pair} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-amber-400 font-medium">{fp.pair}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fp.spot.toFixed(fp.pair.includes('JPY') ? 2 : 4)}</td>
                      {[fp['1M'], fp['3M'], fp['6M'], fp['1Y']].map((pts, i) => (
                        <td key={i} className={`px-3 py-2 text-right font-medium ${pts >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                          {pts >= 0 ? '+' : ''}{pts.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'strength' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Currency Strength Meter (0-100)</div>
              <div className="space-y-2.5">
                {[...STRENGTH_METER].sort((a, b) => b.strength - a.strength).map((cs) => (
                  <div key={cs.currency} className="flex items-center gap-3">
                    <span className="text-xs text-amber-400 font-bold w-8">{cs.currency}</span>
                    <div className="flex-1 bg-[#1a1a2e] rounded-full h-3 relative">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{
                          width: `${cs.strength}%`,
                          backgroundColor: cs.strength > 60 ? '#00cc66' : cs.strength > 40 ? '#ff9900' : '#ff3333',
                          opacity: 0.7,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-[9px] font-bold text-white/80">{cs.strength}</span>
                      </div>
                    </div>
                    <span className={`text-xs w-14 text-right font-medium ${cs.change >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                      {cs.change >= 0 ? '+' : ''}{cs.change.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'correlation' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">FX Correlation Matrix (30D, vs USD)</div>
              <div className="overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      {(FX_CORRELATION[0] as string[]).map((h, i) => (
                        <th key={i} className={`px-3 py-1.5 ${i === 0 ? 'text-left' : 'text-center'} text-amber-400 font-bold`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FX_CORRELATION.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-[#1a1a2e]/50">
                        {(row as (string | number)[]).map((cell, ci) => {
                          const isNum = typeof cell === 'number';
                          const getColor = (v: number) => {
                            if (v >= 0.7) return 'bg-[#00cc66]/40';
                            if (v >= 0.3) return 'bg-[#00cc66]/20';
                            if (v >= -0.3) return 'bg-[#1a1a2e]/30';
                            if (v >= -0.7) return 'bg-[#ff3333]/20';
                            return 'bg-[#ff3333]/40';
                          };
                          return (
                            <td key={ci} className={`px-3 py-1.5 ${ci === 0 ? 'text-left text-amber-400 font-bold' : `text-center ${isNum ? getColor(cell as number) : ''}`} ${isNum && cell === 1 ? 'text-gray-600' : isNum ? 'text-gray-300 font-medium' : ''}`}>
                              {isNum ? (cell as number).toFixed(2) : cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FXDashboard;
