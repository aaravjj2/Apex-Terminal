import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Settings2, Copy,
  RotateCcw, ArrowUpDown, Layers, TrendingUp, X, Save, Download,
} from 'lucide-react';

// --- Types ---

interface OptionLeg {
  id: string;
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  expiry: string;
  qty: number;
  premium: number;
}

interface OptionData {
  strike: number;
  callBid: number;
  callAsk: number;
  callLast: number;
  callVol: number;
  callOI: number;
  callIV: number;
  callDelta: number;
  callGamma: number;
  callTheta: number;
  callVega: number;
  putBid: number;
  putAsk: number;
  putLast: number;
  putVol: number;
  putOI: number;
  putIV: number;
  putDelta: number;
  putGamma: number;
  putTheta: number;
  putVega: number;
}

interface StrategyTemplate {
  name: string;
  description: string;
  legs: Omit<OptionLeg, 'id' | 'expiry' | 'premium'>[];
}

// --- Mock Data ---

const EXPIRIES = ['Mar 15', 'Mar 22', 'Apr 05', 'Apr 19', 'May 17', 'Jun 21', 'Sep 20', 'Dec 20', 'Mar 2027'];

const UNDERLYING_PRICE = 189.84;

const genOptionRow = (strike: number): OptionData => {
  const diff = strike - UNDERLYING_PRICE;
  const moneyness = Math.abs(diff) / UNDERLYING_PRICE;
  const baseIV = 0.25 + moneyness * 0.3 + Math.random() * 0.05;
  const callITM = diff < 0;
  const cDelta = callITM ? 0.5 + (1 - moneyness) * 0.4 : 0.5 - moneyness * 3;
  return {
    strike,
    callBid: Math.max(0.01, +(callITM ? -diff + Math.random() * 3 : Math.random() * 2 * (1 - moneyness)).toFixed(2)),
    callAsk: Math.max(0.05, +(callITM ? -diff + Math.random() * 3 + 0.1 : Math.random() * 2.2 * (1 - moneyness)).toFixed(2)),
    callLast: Math.max(0.02, +(callITM ? -diff + Math.random() * 3 + 0.05 : Math.random() * 2.1 * (1 - moneyness)).toFixed(2)),
    callVol: Math.floor(Math.random() * 5000 + 100),
    callOI: Math.floor(Math.random() * 20000 + 500),
    callIV: +baseIV.toFixed(2),
    callDelta: +Math.max(-1, Math.min(1, cDelta + Math.random() * 0.1)).toFixed(3),
    callGamma: +(0.01 + Math.random() * 0.05).toFixed(4),
    callTheta: +(-0.01 - Math.random() * 0.08).toFixed(4),
    callVega: +(0.05 + Math.random() * 0.15).toFixed(4),
    putBid: Math.max(0.01, +(!callITM ? diff + UNDERLYING_PRICE * 0.01 + Math.random() * 2 : Math.random() * 2 * moneyness).toFixed(2)),
    putAsk: Math.max(0.05, +(!callITM ? diff + UNDERLYING_PRICE * 0.01 + Math.random() * 2 + 0.1 : Math.random() * 2.2 * moneyness).toFixed(2)),
    putLast: Math.max(0.02, +(!callITM ? diff + UNDERLYING_PRICE * 0.01 + Math.random() * 2 + 0.05 : Math.random() * 2.1 * moneyness).toFixed(2)),
    putVol: Math.floor(Math.random() * 4000 + 80),
    putOI: Math.floor(Math.random() * 18000 + 400),
    putIV: +(baseIV + 0.02).toFixed(2),
    putDelta: +Math.max(-1, Math.min(0, -1 + cDelta + Math.random() * 0.1)).toFixed(3),
    putGamma: +(0.01 + Math.random() * 0.05).toFixed(4),
    putTheta: +(-0.01 - Math.random() * 0.09).toFixed(4),
    putVega: +(0.05 + Math.random() * 0.15).toFixed(4),
  };
};

const STRIKES = Array.from({ length: 21 }, (_, i) => 170 + i * 2.5);
const OPTION_CHAIN = STRIKES.map(genOptionRow);

const VOL_SURFACE: { strike: number; iv30: number; iv60: number; iv90: number; iv180: number }[] =
  STRIKES.map((s) => ({
    strike: s,
    iv30: +(0.2 + Math.abs(s - UNDERLYING_PRICE) * 0.004 + Math.random() * 0.02).toFixed(2),
    iv60: +(0.22 + Math.abs(s - UNDERLYING_PRICE) * 0.003 + Math.random() * 0.02).toFixed(2),
    iv90: +(0.24 + Math.abs(s - UNDERLYING_PRICE) * 0.0025 + Math.random() * 0.02).toFixed(2),
    iv180: +(0.26 + Math.abs(s - UNDERLYING_PRICE) * 0.002 + Math.random() * 0.02).toFixed(2),
  }));

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  { name: 'Bull Call Spread', description: 'Buy lower call, sell higher call', legs: [{ type: 'call', side: 'buy', strike: 185, qty: 1 }, { type: 'call', side: 'sell', strike: 195, qty: 1 }] },
  { name: 'Bear Put Spread', description: 'Buy higher put, sell lower put', legs: [{ type: 'put', side: 'buy', strike: 195, qty: 1 }, { type: 'put', side: 'sell', strike: 185, qty: 1 }] },
  { name: 'Iron Condor', description: 'Sell strangle, buy wings', legs: [{ type: 'put', side: 'buy', strike: 175, qty: 1 }, { type: 'put', side: 'sell', strike: 182.5, qty: 1 }, { type: 'call', side: 'sell', strike: 197.5, qty: 1 }, { type: 'call', side: 'buy', strike: 205, qty: 1 }] },
  { name: 'Long Straddle', description: 'Buy ATM call and put', legs: [{ type: 'call', side: 'buy', strike: 190, qty: 1 }, { type: 'put', side: 'buy', strike: 190, qty: 1 }] },
  { name: 'Covered Call', description: 'Long stock + sell call', legs: [{ type: 'call', side: 'sell', strike: 195, qty: 1 }] },
  { name: 'Protective Put', description: 'Long stock + buy put', legs: [{ type: 'put', side: 'buy', strike: 185, qty: 1 }] },
];

// --- Helpers ---

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

// --- Sub-components ---

const PayoffChart: React.FC<{ legs: OptionLeg[] }> = ({ legs }) => {
  const data = useMemo(() => {
    const prices = Array.from({ length: 61 }, (_, i) => UNDERLYING_PRICE - 30 + i);
    return prices.map((px) => {
      let pnl = 0;
      legs.forEach((leg) => {
        const mult = leg.side === 'buy' ? 1 : -1;
        if (leg.type === 'call') {
          pnl += mult * (Math.max(0, px - leg.strike) - leg.premium) * leg.qty * 100;
        } else {
          pnl += mult * (Math.max(0, leg.strike - px) - leg.premium) * leg.qty * 100;
        }
      });
      return { price: px, pnl: +pnl.toFixed(2) };
    });
  }, [legs]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
        <XAxis dataKey="price" tick={{ fill: '#666', fontSize: 10 }} tickCount={7} />
        <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11 }}
          labelFormatter={(l: number) => `Price: $${l}`}
          formatter={(v: number) => [`$${v.toFixed(0)}`, 'P&L']}
        />
        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
        <ReferenceLine x={UNDERLYING_PRICE} stroke="#ff9900" strokeDasharray="3 3" label={{ value: 'Current', fill: '#ff9900', fontSize: 10 }} />
        <Area type="monotone" dataKey="pnl" fill="#00cc6620" stroke="#00cc66" strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

const VolSurfaceHeatmap: React.FC = () => {
  const maxIV = Math.max(...VOL_SURFACE.flatMap((r) => [r.iv30, r.iv60, r.iv90, r.iv180]));
  const minIV = Math.min(...VOL_SURFACE.flatMap((r) => [r.iv30, r.iv60, r.iv90, r.iv180]));

  const getColor = (iv: number) => {
    const t = (iv - minIV) / (maxIV - minIV);
    if (t < 0.33) return `rgba(0, 204, 102, ${0.3 + t})`;
    if (t < 0.66) return `rgba(255, 153, 0, ${0.3 + t * 0.5})`;
    return `rgba(255, 51, 51, ${0.3 + t * 0.5})`;
  };

  const tenors = ['30D', '60D', '90D', '180D'];
  const keys: ('iv30' | 'iv60' | 'iv90' | 'iv180')[] = ['iv30', 'iv60', 'iv90', 'iv180'];

  return (
    <div className="overflow-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-gray-500 text-left">Strike</th>
            {tenors.map((t) => <th key={t} className="px-2 py-1 text-gray-500 text-center">{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {VOL_SURFACE.filter((_, i) => i % 2 === 0).map((row) => (
            <tr key={row.strike}>
              <td className={`px-2 py-0.5 font-medium ${row.strike <= UNDERLYING_PRICE ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                {row.strike.toFixed(1)}
              </td>
              {keys.map((k) => (
                <td key={k} className="px-2 py-0.5 text-center" style={{ backgroundColor: getColor(row[k]) }}>
                  <span className="text-white font-medium">{(row[k] * 100).toFixed(1)}%</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Main Component ---

export const OptionsChain: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [selectedExpiry, setSelectedExpiry] = useState(EXPIRIES[0]);
  const [strategyLegs, setStrategyLegs] = useState<OptionLeg[]>([]);
  const [activeView, setActiveView] = useState<'chain' | 'surface'>('chain');
  const [showStrategy, setShowStrategy] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(['bid', 'ask', 'last', 'vol', 'oi', 'iv', 'delta']));

  const addLeg = useCallback((type: 'call' | 'put', strike: number, side: 'buy' | 'sell' = 'buy') => {
    const row = OPTION_CHAIN.find((r) => r.strike === strike);
    if (!row) return;
    const premium = type === 'call' ? (side === 'buy' ? row.callAsk : row.callBid) : (side === 'buy' ? row.putAsk : row.putBid);
    setStrategyLegs((prev) => [...prev, {
      id: `leg${Date.now()}`,
      type,
      side,
      strike,
      expiry: selectedExpiry,
      qty: 1,
      premium,
    }]);
    setShowStrategy(true);
  }, [selectedExpiry]);

  const removeLeg = useCallback((id: string) => {
    setStrategyLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const loadStrategy = useCallback((template: StrategyTemplate) => {
    setStrategyLegs(template.legs.map((l, i) => {
      const row = OPTION_CHAIN.find((r) => r.strike === l.strike) ?? OPTION_CHAIN[10];
      const premium = l.type === 'call'
        ? (l.side === 'buy' ? row.callAsk : row.callBid)
        : (l.side === 'buy' ? row.putAsk : row.putBid);
      return { ...l, id: `leg${i}`, expiry: selectedExpiry, premium };
    }));
    setShowStrategy(true);
  }, [selectedExpiry]);

  const strategyGreeks = useMemo(() => {
    let delta = 0, gamma = 0, theta = 0, vega = 0, cost = 0;
    strategyLegs.forEach((leg) => {
      const row = OPTION_CHAIN.find((r) => r.strike === leg.strike);
      if (!row) return;
      const mult = leg.side === 'buy' ? 1 : -1;
      if (leg.type === 'call') {
        delta += mult * row.callDelta * leg.qty;
        gamma += mult * row.callGamma * leg.qty;
        theta += mult * row.callTheta * leg.qty;
        vega += mult * row.callVega * leg.qty;
      } else {
        delta += mult * row.putDelta * leg.qty;
        gamma += mult * row.putGamma * leg.qty;
        theta += mult * row.putTheta * leg.qty;
        vega += mult * row.putVega * leg.qty;
      }
      cost += mult * leg.premium * leg.qty * 100;
    });
    return { delta, gamma, theta, vega, cost };
  }, [strategyLegs]);

  const maxProfit = useMemo(() => {
    if (strategyLegs.length === 0) return { max: 0, min: 0, breakeven: [] as number[] };
    let maxP = -Infinity, minP = Infinity;
    const bes: number[] = [];
    for (let px = UNDERLYING_PRICE - 50; px <= UNDERLYING_PRICE + 50; px += 0.5) {
      let pnl = 0;
      strategyLegs.forEach((leg) => {
        const mult = leg.side === 'buy' ? 1 : -1;
        if (leg.type === 'call') pnl += mult * (Math.max(0, px - leg.strike) - leg.premium) * leg.qty * 100;
        else pnl += mult * (Math.max(0, leg.strike - px) - leg.premium) * leg.qty * 100;
      });
      maxP = Math.max(maxP, pnl);
      minP = Math.min(minP, pnl);
      if (Math.abs(pnl) < 15) bes.push(px);
    }
    const uniqueBEs = [...new Set(bes.map((b) => Math.round(b * 2) / 2))];
    return { max: maxP === Infinity ? NaN : maxP, min: minP === -Infinity ? NaN : minP, breakeven: uniqueBEs.slice(0, 3) };
  }, [strategyLegs]);

  const CALL_COLS = [
    { key: 'bid', label: 'Bid', get: (r: OptionData) => fmt(r.callBid) },
    { key: 'ask', label: 'Ask', get: (r: OptionData) => fmt(r.callAsk) },
    { key: 'last', label: 'Last', get: (r: OptionData) => fmt(r.callLast) },
    { key: 'vol', label: 'Vol', get: (r: OptionData) => fmtK(r.callVol) },
    { key: 'oi', label: 'OI', get: (r: OptionData) => fmtK(r.callOI) },
    { key: 'iv', label: 'IV', get: (r: OptionData) => `${(r.callIV * 100).toFixed(1)}%` },
    { key: 'delta', label: 'Δ', get: (r: OptionData) => fmt(r.callDelta, 3) },
    { key: 'gamma', label: 'Γ', get: (r: OptionData) => fmt(r.callGamma, 4) },
    { key: 'theta', label: 'Θ', get: (r: OptionData) => fmt(r.callTheta, 4) },
    { key: 'vega', label: 'V', get: (r: OptionData) => fmt(r.callVega, 4) },
  ];

  const PUT_COLS = [
    { key: 'bid', label: 'Bid', get: (r: OptionData) => fmt(r.putBid) },
    { key: 'ask', label: 'Ask', get: (r: OptionData) => fmt(r.putAsk) },
    { key: 'last', label: 'Last', get: (r: OptionData) => fmt(r.putLast) },
    { key: 'vol', label: 'Vol', get: (r: OptionData) => fmtK(r.putVol) },
    { key: 'oi', label: 'OI', get: (r: OptionData) => fmtK(r.putOI) },
    { key: 'iv', label: 'IV', get: (r: OptionData) => `${(r.putIV * 100).toFixed(1)}%` },
    { key: 'delta', label: 'Δ', get: (r: OptionData) => fmt(r.putDelta, 3) },
    { key: 'gamma', label: 'Γ', get: (r: OptionData) => fmt(r.putGamma, 4) },
    { key: 'theta', label: 'Θ', get: (r: OptionData) => fmt(r.putTheta, 4) },
    { key: 'vega', label: 'V', get: (r: OptionData) => fmt(r.putVega, 4) },
  ];

  const filteredCallCols = CALL_COLS.filter((c) => visibleCols.has(c.key));
  const filteredPutCols = PUT_COLS.filter((c) => visibleCols.has(c.key));

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <span className="text-amber-400 font-bold text-sm">AAPL</span>
        <span className="text-gray-300 text-sm">${UNDERLYING_PRICE}</span>
        <span className="text-[#00cc66] text-xs">+1.25%</span>
        <div className="h-4 w-px bg-[#1a1a2e] mx-2" />

        <div className="flex items-center gap-0.5 bg-[#0a0a14] rounded p-0.5">
          <button onClick={() => setActiveView('chain')} className={`px-3 py-1 text-xs rounded ${activeView === 'chain' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>Chain</button>
          <button onClick={() => setActiveView('surface')} className={`px-3 py-1 text-xs rounded ${activeView === 'surface' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>Vol Surface</button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Cols:</span>
          {['bid', 'ask', 'last', 'vol', 'oi', 'iv', 'delta', 'gamma', 'theta', 'vega'].map((col) => (
            <button
              key={col}
              onClick={() => setVisibleCols((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n; })}
              className={`px-1.5 py-0.5 text-[10px] rounded ${visibleCols.has(col) ? 'bg-amber-500/20 text-amber-400' : 'text-gray-600 hover:text-gray-400'}`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#1a1a2e] overflow-x-auto">
        {EXPIRIES.map((exp) => (
          <button
            key={exp}
            onClick={() => setSelectedExpiry(exp)}
            className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-colors ${selectedExpiry === exp ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
          >
            {exp}
          </button>
        ))}
      </div>

      {activeView === 'chain' ? (
        <>
          {/* Options Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#0d0d1a] z-10">
                <tr>
                  <th colSpan={filteredCallCols.length + 1} className="text-center text-[#00cc66] text-[10px] uppercase tracking-wider py-1 border-b border-[#1a1a2e]">
                    Calls
                  </th>
                  <th className="border-b border-[#1a1a2e]" />
                  <th colSpan={filteredPutCols.length + 1} className="text-center text-[#ff3333] text-[10px] uppercase tracking-wider py-1 border-b border-[#1a1a2e]">
                    Puts
                  </th>
                </tr>
                <tr>
                  {filteredCallCols.map((c) => (
                    <th key={`c-${c.key}`} className="px-2 py-1 text-right text-gray-500 font-medium border-b border-[#1a1a2e]">{c.label}</th>
                  ))}
                  <th className="px-1 py-1 border-b border-[#1a1a2e] text-gray-600 text-[10px]">+</th>
                  <th className="px-3 py-1 text-center text-amber-400 font-bold border-b border-[#1a1a2e] bg-[#0c0c18]">Strike</th>
                  <th className="px-1 py-1 border-b border-[#1a1a2e] text-gray-600 text-[10px]">+</th>
                  {filteredPutCols.map((c) => (
                    <th key={`p-${c.key}`} className="px-2 py-1 text-right text-gray-500 font-medium border-b border-[#1a1a2e]">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OPTION_CHAIN.map((row) => {
                  const callITM = row.strike < UNDERLYING_PRICE;
                  const putITM = row.strike > UNDERLYING_PRICE;
                  const atm = Math.abs(row.strike - UNDERLYING_PRICE) < 1.25;
                  return (
                    <tr key={row.strike} className={`border-b border-[#1a1a2e]/30 ${atm ? 'bg-amber-500/5' : ''}`}>
                      {filteredCallCols.map((c) => (
                        <td key={`c-${c.key}`} className={`px-2 py-1 text-right ${callITM ? 'bg-[#00cc66]/5' : ''} ${c.key === 'bid' || c.key === 'ask' ? 'text-gray-300' : 'text-gray-500'}`}>
                          {c.get(row)}
                        </td>
                      ))}
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => addLeg('call', row.strike)} className="text-gray-600 hover:text-[#00cc66] transition-colors" title="Add call"><Plus size={10} /></button>
                      </td>
                      <td className={`px-3 py-1 text-center font-bold bg-[#0c0c18] ${atm ? 'text-amber-400' : 'text-gray-300'}`}>
                        {row.strike.toFixed(1)}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => addLeg('put', row.strike)} className="text-gray-600 hover:text-[#ff3333] transition-colors" title="Add put"><Plus size={10} /></button>
                      </td>
                      {filteredPutCols.map((c) => (
                        <td key={`p-${c.key}`} className={`px-2 py-1 text-right ${putITM ? 'bg-[#ff3333]/5' : ''} ${c.key === 'bid' || c.key === 'ask' ? 'text-gray-300' : 'text-gray-500'}`}>
                          {c.get(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Strategy Builder */}
          {showStrategy && (
            <div className="border-t border-[#1a1a2e] bg-[#0c0c18]">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a2e]">
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Strategy Builder</span>
                  <span className="text-gray-500 text-[10px]">{strategyLegs.length} legs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto max-w-sm">
                    {STRATEGY_TEMPLATES.map((t) => (
                      <button key={t.name} onClick={() => loadStrategy(t)} className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-amber-400 bg-[#0d0d1a] rounded border border-[#1a1a2e] hover:border-amber-900/40 whitespace-nowrap transition-colors">
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setStrategyLegs([])} className="text-gray-600 hover:text-gray-400"><RotateCcw size={12} /></button>
                  <button onClick={() => setShowStrategy(false)} className="text-gray-600 hover:text-gray-400"><X size={12} /></button>
                </div>
              </div>

              {strategyLegs.length > 0 ? (
                <div className="flex">
                  {/* Legs */}
                  <div className="flex-1 p-3">
                    <div className="space-y-1">
                      {strategyLegs.map((leg) => (
                        <div key={leg.id} className="flex items-center gap-3 p-2 bg-[#0d0d1a] rounded border border-[#1a1a2e] text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${leg.side === 'buy' ? 'bg-[#00cc66]/20 text-[#00cc66]' : 'bg-[#ff3333]/20 text-[#ff3333]'}`}>
                            {leg.side.toUpperCase()}
                          </span>
                          <span className={`font-medium ${leg.type === 'call' ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>{leg.type.toUpperCase()}</span>
                          <span className="text-amber-400">{leg.strike}</span>
                          <span className="text-gray-500">{leg.expiry}</span>
                          <span className="text-gray-400">×{leg.qty}</span>
                          <span className="text-gray-400">@${leg.premium}</span>
                          <div className="flex-1" />
                          <button onClick={() => removeLeg(leg.id)} className="text-gray-600 hover:text-[#ff3333]"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className="flex items-center gap-4 mt-3 text-[10px]">
                      <div><span className="text-gray-500">Net Cost:</span> <span className={strategyGreeks.cost > 0 ? 'text-[#ff3333]' : 'text-[#00cc66]'}>${Math.abs(strategyGreeks.cost).toFixed(0)}</span></div>
                      <div><span className="text-gray-500">Max Profit:</span> <span className="text-[#00cc66]">{isNaN(maxProfit.max) ? '∞' : `$${maxProfit.max.toFixed(0)}`}</span></div>
                      <div><span className="text-gray-500">Max Loss:</span> <span className="text-[#ff3333]">{isNaN(maxProfit.min) ? '∞' : `$${Math.abs(maxProfit.min).toFixed(0)}`}</span></div>
                      <div><span className="text-gray-500">Breakeven:</span> <span className="text-amber-400">{maxProfit.breakeven.map((b) => `$${b}`).join(', ') || '—'}</span></div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[10px]">
                      <div><span className="text-gray-500">Δ:</span> <span className="text-gray-300">{strategyGreeks.delta.toFixed(3)}</span></div>
                      <div><span className="text-gray-500">Γ:</span> <span className="text-gray-300">{strategyGreeks.gamma.toFixed(4)}</span></div>
                      <div><span className="text-gray-500">Θ:</span> <span className="text-gray-300">{strategyGreeks.theta.toFixed(4)}</span></div>
                      <div><span className="text-gray-500">V:</span> <span className="text-gray-300">{strategyGreeks.vega.toFixed(4)}</span></div>
                    </div>
                  </div>

                  {/* Payoff Chart */}
                  <div className="w-80 border-l border-[#1a1a2e] p-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 px-1">Payoff at Expiry</div>
                    <PayoffChart legs={strategyLegs} />
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-600 text-xs py-6">Click + on a call or put to add legs, or select a strategy template above</div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Vol Surface View */
        <div className="flex-1 overflow-auto p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Implied Volatility Surface — {selectedExpiry}</div>
          <VolSurfaceHeatmap />
        </div>
      )}
    </div>
  );
};

export default OptionsChain;
