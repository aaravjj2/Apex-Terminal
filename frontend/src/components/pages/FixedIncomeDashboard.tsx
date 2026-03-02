import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Calculator, BarChart3, ArrowUpDown,
  RefreshCw, Landmark, Filter, ChevronDown, Activity,
} from 'lucide-react';

// --- Mock Data ---

const YIELD_CURVE_CURRENT = [
  { tenor: '1M', yield: 5.38, prev: 5.40 },
  { tenor: '3M', yield: 5.35, prev: 5.38 },
  { tenor: '6M', yield: 5.28, prev: 5.32 },
  { tenor: '1Y', yield: 5.05, prev: 5.12 },
  { tenor: '2Y', yield: 4.65, prev: 4.72 },
  { tenor: '3Y', yield: 4.38, prev: 4.48 },
  { tenor: '5Y', yield: 4.18, prev: 4.28 },
  { tenor: '7Y', yield: 4.22, prev: 4.32 },
  { tenor: '10Y', yield: 4.25, prev: 4.35 },
  { tenor: '20Y', yield: 4.52, prev: 4.60 },
  { tenor: '30Y', yield: 4.42, prev: 4.50 },
];

const CREDIT_SPREADS = Array.from({ length: 30 }, (_, i) => ({
  date: `${Math.floor(i / 30 * 28 + 1)}`,
  ig: +(85 + Math.sin(i * 0.2) * 10 + Math.random() * 5).toFixed(0),
  hy: +(340 + Math.sin(i * 0.18) * 30 + Math.random() * 15).toFixed(0),
  em: +(250 + Math.sin(i * 0.15) * 25 + Math.random() * 12).toFixed(0),
}));

const BOND_SCREENER = [
  { isin: 'US912810TD00', issuer: 'US Treasury', coupon: 4.625, maturity: '2034-02-15', yield: 4.25, price: 103.12, rating: 'AAA', duration: 7.8, spread: 0 },
  { isin: 'US037833DX09', issuer: 'Apple Inc.', coupon: 3.850, maturity: '2029-05-04', yield: 4.15, price: 97.85, rating: 'AA+', duration: 4.2, spread: 45 },
  { isin: 'US594918CE10', issuer: 'Microsoft', coupon: 3.500, maturity: '2028-02-12', yield: 4.05, price: 98.22, rating: 'AAA', duration: 3.5, spread: 35 },
  { isin: 'US46625HRU23', issuer: 'JPMorgan', coupon: 5.125, maturity: '2031-05-01', yield: 4.85, price: 101.45, rating: 'A+', duration: 5.8, spread: 95 },
  { isin: 'US172967MR80', issuer: 'Citigroup', coupon: 5.500, maturity: '2033-09-29', yield: 5.15, price: 102.18, rating: 'A', duration: 7.1, spread: 125 },
  { isin: 'US38141GXV94', issuer: 'Goldman Sachs', coupon: 4.750, maturity: '2030-10-21', yield: 4.95, price: 99.32, rating: 'A+', duration: 5.2, spread: 110 },
  { isin: 'US345370CW47', issuer: 'Ford Motor', coupon: 6.100, maturity: '2032-08-19', yield: 6.45, price: 97.58, rating: 'BBB-', duration: 6.3, spread: 275 },
  { isin: 'US097023CT78', issuer: 'Boeing', coupon: 5.805, maturity: '2050-05-01', yield: 6.12, price: 94.65, rating: 'BBB-', duration: 14.2, spread: 245 },
];

const RELATIVE_VALUE = [
  { pair: '2s10s', current: -40, prev: -37, zScore: -1.2 },
  { pair: '5s30s', current: 24, prev: 22, zScore: 0.5 },
  { pair: '2s5s', current: -47, prev: -44, zScore: -0.8 },
  { pair: '10s30s', current: 17, prev: 15, zScore: 0.3 },
  { pair: 'IG-HY', current: 255, prev: 248, zScore: -0.4 },
  { pair: 'US-DE 10Y', current: 185, prev: 182, zScore: 1.1 },
];

const KEY_RATE_DURATIONS = [
  { tenor: '2Y', krd: 0.15 },
  { tenor: '5Y', krd: 0.82 },
  { tenor: '7Y', krd: 1.45 },
  { tenor: '10Y', krd: 2.18 },
  { tenor: '20Y', krd: 1.65 },
  { tenor: '30Y', krd: 0.95 },
];

const CENTRAL_BANK_RATES = [
  { bank: 'Federal Reserve', rate: 5.50, expected: 5.25, nextMove: 'Cut -25bp', meetingDate: 'Jun 2025' },
  { bank: 'ECB', rate: 4.50, expected: 4.25, nextMove: 'Cut -25bp', meetingDate: 'Mar 2025' },
  { bank: 'BoE', rate: 5.25, expected: 5.00, nextMove: 'Cut -25bp', meetingDate: 'May 2025' },
  { bank: 'BoJ', rate: 0.10, expected: 0.25, nextMove: 'Hike +15bp', meetingDate: 'Apr 2025' },
];

const INFLATION_EXPECTATIONS = [
  { tenor: '1Y', breakeven: 2.45, tip: 2.32 },
  { tenor: '2Y', breakeven: 2.38, tip: 2.28 },
  { tenor: '5Y', breakeven: 2.25, tip: 2.18 },
  { tenor: '10Y', breakeven: 2.32, tip: 2.22 },
  { tenor: '30Y', breakeven: 2.28, tip: 2.20 },
];

// --- Sub-components ---

const BondCalculator: React.FC = () => {
  const [faceValue, setFaceValue] = useState(1000);
  const [coupon, setCoupon] = useState(5.0);
  const [yieldVal, setYieldVal] = useState(4.5);
  const [maturityYears, setMaturityYears] = useState(10);
  const [frequency, setFrequency] = useState(2);

  const results = useMemo(() => {
    const c = (coupon / 100 * faceValue) / frequency;
    const y = yieldVal / 100 / frequency;
    const n = maturityYears * frequency;
    let price = 0;
    let duration = 0;
    for (let t = 1; t <= n; t++) {
      const pv = c / Math.pow(1 + y, t);
      price += pv;
      duration += (t / frequency) * pv;
    }
    price += faceValue / Math.pow(1 + y, n);
    duration += maturityYears * (faceValue / Math.pow(1 + y, n));
    duration /= price;
    const modDuration = duration / (1 + y);
    const convexity = (price * (1 + y) * (1 + y)) > 0 ? (2 * price) / (price * y * y) : 0;
    return {
      price: price.toFixed(2),
      duration: duration.toFixed(3),
      modDuration: modDuration.toFixed(3),
      convexity: convexity.toFixed(2),
      dv01: (modDuration * price * 0.0001).toFixed(4),
    };
  }, [faceValue, coupon, yieldVal, maturityYears, frequency]);

  return (
    <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Calculator size={10} /> Bond Calculator
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[
          { label: 'Face Value', value: faceValue, set: setFaceValue },
          { label: 'Coupon (%)', value: coupon, set: setCoupon },
          { label: 'Yield (%)', value: yieldVal, set: setYieldVal },
          { label: 'Years', value: maturityYears, set: setMaturityYears },
          { label: 'Freq/yr', value: frequency, set: setFrequency },
        ].map((inp) => (
          <div key={inp.label}>
            <label className="text-[9px] text-gray-500 block mb-0.5">{inp.label}</label>
            <input
              type="number"
              value={inp.value}
              onChange={(e) => inp.set(+e.target.value)}
              className="w-full bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-amber-500/50"
              step={inp.label.includes('%') ? 0.1 : 1}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Price', value: `$${results.price}` },
          { label: 'Duration', value: results.duration },
          { label: 'Mod Duration', value: results.modDuration },
          { label: 'Convexity', value: results.convexity },
          { label: 'DV01', value: `$${results.dv01}` },
        ].map((r) => (
          <div key={r.label} className="bg-[#0a0a14] border border-[#1a1a2e] rounded p-2 text-center">
            <div className="text-[9px] text-gray-500 uppercase">{r.label}</div>
            <div className="text-xs text-amber-400 font-bold mt-0.5">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---

export const FixedIncomeDashboard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'curve' | 'spreads' | 'screener' | 'relval' | 'inflation'>('curve');
  const [sortCol, setSortCol] = useState<string>('spread');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedBonds = useMemo(() =>
    [...BOND_SCREENER].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] as number;
      const bv = (b as Record<string, unknown>)[sortCol] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    }),
    [sortCol, sortDir]
  );

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'curve', label: 'Yield Curve' },
    { key: 'spreads', label: 'Credit Spreads' },
    { key: 'screener', label: 'Bond Screener' },
    { key: 'relval', label: 'Relative Value' },
    { key: 'inflation', label: 'Inflation' },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <Landmark size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">Fixed Income</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-2.5 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs">
          <div><span className="text-gray-500">10Y:</span> <span className="text-amber-400">4.25%</span></div>
          <div><span className="text-gray-500">2s10s:</span> <span className="text-[#ff3333]">-40bp</span></div>
          <div><span className="text-gray-500">IG OAS:</span> <span className="text-gray-300">85bp</span></div>
        </div>
        <button className="text-gray-500 hover:text-gray-300 p-1 ml-2"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'curve' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">US Treasury Yield Curve</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-amber-400" /><span className="text-gray-400">Current</span></div>
                  <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#6699ff] opacity-50" /><span className="text-gray-400">1M Ago</span></div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={YIELD_CURVE_CURRENT} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="tenor" tick={{ fill: '#999', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[3.5, 5.5]} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="prev" name="1M Ago" stroke="#6699ff" strokeWidth={1.5} dot={{ r: 3, fill: '#6699ff' }} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="yield" name="Current" fill="#ff990015" stroke="#ff9900" strokeWidth={2} dot={{ r: 4, fill: '#ff9900', stroke: '#0d0d1a', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Key Rate Duration */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Key Rate Duration</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={KEY_RATE_DURATIONS} margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="tenor" tick={{ fill: '#999', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} />
                    <Bar dataKey="krd" name="KRD" fill="#6699ff" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Central Bank Rates */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Central Bank Rates & Market Expectations</div>
              <div className="grid grid-cols-4 gap-3">
                {CENTRAL_BANK_RATES.map((cb) => (
                  <div key={cb.bank} className="bg-[#0a0a14] border border-[#1a1a2e] rounded p-2.5">
                    <div className="text-xs text-gray-300 font-medium">{cb.bank}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold text-amber-400">{cb.rate}%</span>
                      <span className="text-[10px] text-gray-500">→ {cb.expected}%</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${cb.nextMove.includes('Cut') ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                      {cb.nextMove} ({cb.meetingDate})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <BondCalculator />
          </div>
        )}

        {activeTab === 'spreads' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Credit Spread Trends (bp)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={CREDIT_SPREADS} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}bp`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}bp`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="ig" name="IG OAS" stroke="#6699ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="hy" name="HY OAS" stroke="#ff3333" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="em" name="EM Spread" stroke="#00cc66" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'screener' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Bond Screener</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    {[
                      { key: 'issuer', label: 'Issuer', align: 'left' },
                      { key: 'coupon', label: 'Coupon', align: 'right' },
                      { key: 'maturity', label: 'Maturity', align: 'right' },
                      { key: 'yield', label: 'Yield', align: 'right' },
                      { key: 'price', label: 'Price', align: 'right' },
                      { key: 'rating', label: 'Rating', align: 'center' },
                      { key: 'duration', label: 'Duration', align: 'right' },
                      { key: 'spread', label: 'Spread', align: 'right' },
                    ].map((col) => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className={`px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-gray-300 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key && <ArrowUpDown size={10} className="text-amber-400" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBonds.map((b) => (
                    <tr key={b.isin} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f] cursor-pointer">
                      <td className="px-3 py-2">
                        <div className="text-gray-300">{b.issuer}</div>
                        <div className="text-[10px] text-gray-600">{b.isin}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{b.coupon.toFixed(3)}%</td>
                      <td className="px-3 py-2 text-right text-gray-400">{b.maturity}</td>
                      <td className="px-3 py-2 text-right text-amber-400 font-medium">{b.yield.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right">${b.price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          b.rating.startsWith('AAA') ? 'bg-[#00cc66]/20 text-[#00cc66]' :
                          b.rating.startsWith('AA') ? 'bg-[#6699ff]/20 text-[#6699ff]' :
                          b.rating.startsWith('A') ? 'bg-amber-500/20 text-amber-400' :
                          'bg-[#ff9900]/20 text-[#ff9900]'
                        }`}>{b.rating}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{b.duration.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{b.spread}bp</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'relval' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Relative Value Monitor</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Spread</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Current (bp)</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">1W Ago</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Change</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Z-Score</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {RELATIVE_VALUE.map((rv) => (
                    <tr key={rv.pair} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-amber-400 font-medium">{rv.pair}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{rv.current}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{rv.prev}</td>
                      <td className={`px-3 py-2 text-right font-medium ${rv.current - rv.prev > 0 ? 'text-[#ff3333]' : 'text-[#00cc66]'}`}>
                        {rv.current - rv.prev > 0 ? '+' : ''}{rv.current - rv.prev}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${Math.abs(rv.zScore) > 1.5 ? 'text-[#ff3333]' : Math.abs(rv.zScore) > 1 ? 'text-[#ff9900]' : 'text-gray-300'}`}>
                        {rv.zScore > 0 ? '+' : ''}{rv.zScore.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          Math.abs(rv.zScore) > 1.5 ? 'bg-[#ff3333]/20 text-[#ff3333]' :
                          Math.abs(rv.zScore) > 1 ? 'bg-[#ff9900]/20 text-[#ff9900]' :
                          'bg-[#1a1a2e] text-gray-400'
                        }`}>
                          {Math.abs(rv.zScore) > 1.5 ? 'EXTREME' : Math.abs(rv.zScore) > 1 ? 'WATCH' : 'NEUTRAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inflation' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Inflation Expectations — Breakevens & TIPS</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Tenor</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Breakeven</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">TIPS Real Yield</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Nominal - Real</th>
                  </tr>
                </thead>
                <tbody>
                  {INFLATION_EXPECTATIONS.map((ie) => (
                    <tr key={ie.tenor} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-amber-400 font-medium">{ie.tenor}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{ie.breakeven}%</td>
                      <td className="px-3 py-2 text-right text-gray-300">{ie.tip}%</td>
                      <td className="px-3 py-2 text-right text-[#6699ff]">{(ie.breakeven - ie.tip).toFixed(2)}%</td>
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

export default FixedIncomeDashboard;
