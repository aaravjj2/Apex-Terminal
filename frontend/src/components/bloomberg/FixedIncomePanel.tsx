import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type FITab = 'calculator' | 'cashflows' | 'curve' | 'spread' | 'comps';

interface BondData {
  cusip: string;
  isin: string;
  name: string;
  coupon: number;
  maturity: string;
  issueDate: string;
  frequency: number;
  dayCount: string;
  rating: { sp: string; moody: string; fitch: string };
  currency: string;
  issuer: string;
  sector: string;
  faceValue: number;
}

interface CashFlow {
  date: string;
  couponPayment: number;
  principal: number;
  total: number;
  discountFactor: number;
  pv: number;
}

interface YieldCurvePoint {
  tenor: string;
  years: number;
  yield: number;
  change: number;
}

interface ComparableBond {
  ticker: string;
  coupon: number;
  maturity: string;
  rating: string;
  yield: number;
  spread: number;
  price: number;
  duration: number;
}

interface FixedIncomePanelProps {
  className?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const BOND: BondData = {
  cusip: '91282CJL6',
  isin: 'US91282CJL63',
  name: 'T 4.5 11/15/33',
  coupon: 4.5,
  maturity: '2033-11-15',
  issueDate: '2023-11-15',
  frequency: 2,
  dayCount: 'ACT/ACT',
  rating: { sp: 'AA+', moody: 'Aaa', fitch: 'AA+' },
  currency: 'USD',
  issuer: 'US Treasury',
  sector: 'Government',
  faceValue: 100,
};

const YIELD_CURVE: YieldCurvePoint[] = [
  { tenor: '1M', years: 1 / 12, yield: 5.37, change: -0.02 },
  { tenor: '3M', years: 0.25, yield: 5.34, change: -0.01 },
  { tenor: '6M', years: 0.5, yield: 5.28, change: 0.01 },
  { tenor: '1Y', years: 1, yield: 5.05, change: 0.03 },
  { tenor: '2Y', years: 2, yield: 4.62, change: 0.05 },
  { tenor: '3Y', years: 3, yield: 4.38, change: 0.04 },
  { tenor: '5Y', years: 5, yield: 4.22, change: 0.03 },
  { tenor: '7Y', years: 7, yield: 4.25, change: 0.02 },
  { tenor: '10Y', years: 10, yield: 4.30, change: 0.01 },
  { tenor: '20Y', years: 20, yield: 4.58, change: -0.01 },
  { tenor: '30Y', years: 30, yield: 4.47, change: -0.02 },
];

const COMPARABLES: ComparableBond[] = [
  { ticker: 'T 4.0 11/15/32', coupon: 4.0, maturity: '2032-11-15', rating: 'AA+', yield: 4.25, spread: 0, price: 99.12, duration: 7.2 },
  { ticker: 'T 4.75 11/15/34', coupon: 4.75, maturity: '2034-11-15', rating: 'AA+', yield: 4.38, spread: 0, price: 102.45, duration: 8.5 },
  { ticker: 'T 3.875 11/15/33', coupon: 3.875, maturity: '2033-11-15', rating: 'AA+', yield: 4.32, spread: 0, price: 97.80, duration: 8.1 },
  { ticker: 'AAPL 3.25 02/23/26', coupon: 3.25, maturity: '2026-02-23', rating: 'AA+', yield: 4.85, spread: 52, price: 97.20, duration: 1.8 },
  { ticker: 'MSFT 2.40 08/08/26', coupon: 2.40, maturity: '2026-08-08', rating: 'AAA', yield: 4.72, spread: 38, price: 95.60, duration: 2.3 },
  { ticker: 'GOOGL 1.10 08/15/30', coupon: 1.10, maturity: '2030-08-15', rating: 'AA+', yield: 4.90, spread: 62, price: 82.35, duration: 5.8 },
];

const KEY_RATE_DURATIONS = [
  { tenor: '1Y', duration: 0.02 }, { tenor: '2Y', duration: 0.15 },
  { tenor: '3Y', duration: 0.28 }, { tenor: '5Y', duration: 0.85 },
  { tenor: '7Y', duration: 1.42 }, { tenor: '10Y', duration: 5.12 },
  { tenor: '20Y', duration: 0.35 }, { tenor: '30Y', duration: 0.08 },
];

const SPREAD_DATA = [
  { name: 'G-Spread', value: 0, desc: 'vs Treasury benchmark' },
  { name: 'I-Spread', value: 2, desc: 'vs swap curve' },
  { name: 'Z-Spread', value: 3, desc: 'zero-volatility spread' },
  { name: 'ASW', value: -5, desc: 'asset swap spread' },
  { name: 'OAS', value: 1, desc: 'option-adjusted spread' },
];

// ─── Calculation Helpers ────────────────────────────────────────────────────

function bondPrice(coupon: number, yieldPct: number, periods: number, freq: number, face: number): number {
  const c = (coupon / 100) * face / freq;
  const y = yieldPct / 100 / freq;
  if (y === 0) return c * periods + face;
  const pvCoupons = c * (1 - Math.pow(1 + y, -periods)) / y;
  const pvFace = face / Math.pow(1 + y, periods);
  return pvCoupons + pvFace;
}

function modifiedDuration(coupon: number, yieldPct: number, periods: number, freq: number, face: number): number {
  const y = yieldPct / 100 / freq;
  const c = (coupon / 100) * face / freq;
  const price = bondPrice(coupon, yieldPct, periods, freq, face);
  let macD = 0;
  for (let t = 1; t <= periods; t++) {
    const cf = t === periods ? c + face : c;
    macD += (t / freq) * cf / Math.pow(1 + y, t);
  }
  macD /= price;
  return macD / (1 + y);
}

function convexity(coupon: number, yieldPct: number, periods: number, freq: number, face: number): number {
  const y = yieldPct / 100 / freq;
  const c = (coupon / 100) * face / freq;
  const price = bondPrice(coupon, yieldPct, periods, freq, face);
  let conv = 0;
  for (let t = 1; t <= periods; t++) {
    const cf = t === periods ? c + face : c;
    conv += (t * (t + 1)) * cf / Math.pow(1 + y, t + 2);
  }
  return conv / (price * freq * freq);
}

function generateCashFlows(coupon: number, yieldPct: number, maturity: string, freq: number, face: number): CashFlow[] {
  const mat = new Date(maturity);
  const now = new Date();
  const flows: CashFlow[] = [];
  const y = yieldPct / 100 / freq;
  const couponPmt = (coupon / 100) * face / freq;

  let periodNum = 0;
  const startDate = new Date(mat);
  while (startDate > now) {
    startDate.setMonth(startDate.getMonth() - 12 / freq);
  }
  startDate.setMonth(startDate.getMonth() + 12 / freq);

  const current = new Date(startDate);
  while (current <= mat) {
    periodNum++;
    const isMaturity = current.getTime() === mat.getTime() ||
      (current.getFullYear() === mat.getFullYear() && current.getMonth() === mat.getMonth());
    const principal = isMaturity ? face : 0;
    const total = couponPmt + principal;
    const df = 1 / Math.pow(1 + y, periodNum);
    flows.push({
      date: current.toISOString().split('T')[0],
      couponPayment: couponPmt,
      principal,
      total,
      discountFactor: df,
      pv: total * df,
    });
    current.setMonth(current.getMonth() + 12 / freq);
    if (flows.length > 50) break;
  }

  if (flows.length > 0 && flows[flows.length - 1].principal === 0) {
    flows[flows.length - 1].principal = face;
    flows[flows.length - 1].total += face;
    flows[flows.length - 1].pv = flows[flows.length - 1].total * flows[flows.length - 1].discountFactor;
  }

  return flows;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[#555] text-[11px]">{label}</span>
      <span className={`text-[11px] font-bold ${color ?? 'text-[#ccc]'}`}>{value}</span>
    </div>
  );
}

function RatingBadge({ agency, rating }: { agency: string; rating: string }) {
  const color = rating.startsWith('AAA') || rating.startsWith('Aaa')
    ? 'text-[#00cc66] bg-[#00cc66]/10'
    : rating.startsWith('AA') || rating.startsWith('Aa')
    ? 'text-[#6699ff] bg-[#6699ff]/10'
    : 'text-[#ff9900] bg-[#ff9900]/10';
  return (
    <div className={`px-2 py-0.5 rounded text-center ${color}`}>
      <div className="text-[9px] opacity-60">{agency}</div>
      <div className="text-xs font-bold">{rating}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function FixedIncomePanel({ className = '' }: FixedIncomePanelProps) {
  const [tab, setTab] = useState<FITab>('calculator');
  const [inputYield, setInputYield] = useState(4.30);
  const [inputPrice, setInputPrice] = useState(101.25);
  const [calcMode, setCalcMode] = useState<'yield' | 'price'>('yield');

  const periodsToMaturity = useMemo(() => {
    const mat = new Date(BOND.maturity);
    const now = new Date();
    const years = (mat.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.max(1, Math.round(years * BOND.frequency));
  }, []);

  const calcResults = useMemo(() => {
    const yld = calcMode === 'yield' ? inputYield : inputYield;
    const price = bondPrice(BOND.coupon, yld, periodsToMaturity, BOND.frequency, BOND.faceValue);
    const dur = modifiedDuration(BOND.coupon, yld, periodsToMaturity, BOND.frequency, BOND.faceValue);
    const conv = convexity(BOND.coupon, yld, periodsToMaturity, BOND.frequency, BOND.faceValue);
    const macDur = dur * (1 + yld / 100 / BOND.frequency);
    const dv01 = dur * price / 10000;
    const currentYield = BOND.coupon / price * 100;
    const ytm = yld;

    return { price, dur, conv, macDur, dv01, currentYield, ytm };
  }, [inputYield, calcMode, periodsToMaturity]);

  const cashFlows = useMemo(
    () => generateCashFlows(BOND.coupon, inputYield, BOND.maturity, BOND.frequency, BOND.faceValue),
    [inputYield],
  );

  const maxCurveYield = Math.max(...YIELD_CURVE.map(p => p.yield));
  const minCurveYield = Math.min(...YIELD_CURVE.map(p => p.yield));
  const yieldRange = maxCurveYield - minCurveYield || 1;

  const tabs: { key: FITab; label: string }[] = [
    { key: 'calculator', label: 'CALCULATOR' },
    { key: 'cashflows', label: 'CASH FLOWS' },
    { key: 'curve', label: 'YIELD CURVE' },
    { key: 'spread', label: 'SPREADS' },
    { key: 'comps', label: 'COMPARABLES' },
  ];

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#ff9900] font-bold text-sm">{BOND.name}</span>
            <span className="text-[#555] text-xs ml-2">YAS &lt;GO&gt;</span>
          </div>
          <div className="flex gap-2">
            <RatingBadge agency="S&P" rating={BOND.rating.sp} />
            <RatingBadge agency="Moody's" rating={BOND.rating.moody} />
            <RatingBadge agency="Fitch" rating={BOND.rating.fitch} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-1 text-[10px] text-[#666]">
          <span>CUSIP: {BOND.cusip}</span>
          <span>ISIN: {BOND.isin}</span>
          <span>{BOND.issuer}</span>
          <span>Cpn: {BOND.coupon}%</span>
          <span>Mat: {BOND.maturity}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a2e]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-[10px] tracking-wider transition-colors ${
              tab === t.key ? 'text-[#ff9900] border-b-2 border-[#ff9900]' : 'text-[#555] hover:text-[#888]'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === 'calculator' && (
          <>
            {/* Bond Terms */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">BOND TERMS</div>
              <div className="grid grid-cols-3 gap-x-6">
                <Stat label="Coupon" value={`${BOND.coupon}%`} color="text-[#ff9900]" />
                <Stat label="Maturity" value={BOND.maturity} />
                <Stat label="Issue Date" value={BOND.issueDate} />
                <Stat label="Frequency" value={`${BOND.frequency}x/yr`} />
                <Stat label="Day Count" value={BOND.dayCount} />
                <Stat label="Face Value" value={`$${BOND.faceValue}`} />
                <Stat label="Currency" value={BOND.currency} />
                <Stat label="Sector" value={BOND.sector} />
                <Stat label="Issuer" value={BOND.issuer} />
              </div>
            </div>

            {/* Calculator Input */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">PRICE ↔ YIELD CALCULATOR</div>
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={() => setCalcMode('yield')}
                  className={`px-3 py-1 text-[10px] rounded ${calcMode === 'yield' ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555]'}`}
                >INPUT YIELD</button>
                <button
                  onClick={() => setCalcMode('price')}
                  className={`px-3 py-1 text-[10px] rounded ${calcMode === 'price' ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555]'}`}
                >INPUT PRICE</button>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-[11px] text-[#555]">Yield (%)</span>
                  <input
                    type="number" step="0.01"
                    value={inputYield}
                    onChange={e => setInputYield(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-sm px-2 py-1 rounded outline-none focus:border-[#ff9900]/40"
                  />
                </label>
                <span className="text-[#333]">⟷</span>
                <div className="text-[11px]">
                  <span className="text-[#555]">Price: </span>
                  <span className="text-[#ccc] font-bold text-sm">{calcResults.price.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f0f1e] rounded p-3">
                <div className="text-[10px] text-[#555] mb-2 tracking-wider">DURATION & CONVEXITY</div>
                <Stat label="Modified Duration" value={calcResults.dur.toFixed(4)} color="text-[#ff9900]" />
                <Stat label="Macaulay Duration" value={calcResults.macDur.toFixed(4)} />
                <Stat label="Convexity" value={calcResults.conv.toFixed(4)} color="text-[#6699ff]" />
                <Stat label="DV01" value={`$${calcResults.dv01.toFixed(4)}`} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-3">
                <div className="text-[10px] text-[#555] mb-2 tracking-wider">YIELD MEASURES</div>
                <Stat label="YTM" value={`${calcResults.ytm.toFixed(3)}%`} color="text-[#ff9900]" />
                <Stat label="Current Yield" value={`${calcResults.currentYield.toFixed(3)}%`} />
                <Stat label="Coupon" value={`${BOND.coupon}%`} />
                <Stat label="Accrued Interest" value="$1.125" />
              </div>
            </div>

            {/* Key Rate Duration */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">KEY RATE DURATIONS</div>
              <div className="flex items-end gap-2 h-20">
                {KEY_RATE_DURATIONS.map(krd => {
                  const maxKrd = Math.max(...KEY_RATE_DURATIONS.map(k => k.duration));
                  const pct = (krd.duration / maxKrd) * 100;
                  return (
                    <div key={krd.tenor} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-[#666]">{krd.duration.toFixed(2)}</span>
                      <div className="w-full bg-[#6699ff]/60 rounded-t" style={{ height: `${pct}%` }} />
                      <span className="text-[8px] text-[#555]">{krd.tenor}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'cashflows' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left text-[#555] py-1.5">#</th>
                  <th className="text-left text-[#555] py-1.5">Date</th>
                  <th className="text-right text-[#555] py-1.5">Coupon</th>
                  <th className="text-right text-[#555] py-1.5">Principal</th>
                  <th className="text-right text-[#555] py-1.5">Total</th>
                  <th className="text-right text-[#555] py-1.5">DF</th>
                  <th className="text-right text-[#555] py-1.5">PV</th>
                </tr>
              </thead>
              <tbody>
                {cashFlows.map((cf, i) => (
                  <tr key={i} className={`border-b border-[#1a1a2e]/50 ${cf.principal > 0 ? 'bg-[#ff9900]/5' : 'hover:bg-[#0f0f1e]'}`}>
                    <td className="text-[#555] py-1">{i + 1}</td>
                    <td className="text-[#888] py-1">{cf.date}</td>
                    <td className="text-right text-[#ccc] py-1">{cf.couponPayment.toFixed(3)}</td>
                    <td className="text-right text-[#ff9900] py-1">{cf.principal > 0 ? cf.principal.toFixed(2) : '—'}</td>
                    <td className="text-right text-[#ccc] font-bold py-1">{cf.total.toFixed(3)}</td>
                    <td className="text-right text-[#666] py-1">{cf.discountFactor.toFixed(6)}</td>
                    <td className="text-right text-[#6699ff] py-1">{cf.pv.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#ff9900]/30">
                  <td colSpan={4} className="text-[#555] py-1 font-bold">TOTAL</td>
                  <td className="text-right text-[#ccc] font-bold py-1">
                    {cashFlows.reduce((s, cf) => s + cf.total, 0).toFixed(3)}
                  </td>
                  <td />
                  <td className="text-right text-[#6699ff] font-bold py-1">
                    {cashFlows.reduce((s, cf) => s + cf.pv, 0).toFixed(3)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'curve' && (
          <>
            {/* Yield Curve Chart */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">US TREASURY YIELD CURVE</div>
              <div className="relative h-40">
                <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                    <line key={pct} x1="0" y1={pct * 110 + 5} x2="400" y2={pct * 110 + 5}
                      stroke="#1a1a2e" strokeWidth="0.5" />
                  ))}
                  {/* Curve */}
                  <polyline
                    fill="none"
                    stroke="#ff9900"
                    strokeWidth="2"
                    points={YIELD_CURVE.map((p, i) => {
                      const x = (i / (YIELD_CURVE.length - 1)) * 380 + 10;
                      const y = (1 - (p.yield - minCurveYield) / yieldRange) * 100 + 10;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {/* Points */}
                  {YIELD_CURVE.map((p, i) => {
                    const x = (i / (YIELD_CURVE.length - 1)) * 380 + 10;
                    const y = (1 - (p.yield - minCurveYield) / yieldRange) * 100 + 10;
                    return <circle key={p.tenor} cx={x} cy={y} r="3" fill="#ff9900" />;
                  })}
                </svg>
              </div>
            </div>

            {/* Curve Data */}
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left text-[#555] py-1">Tenor</th>
                  <th className="text-right text-[#555] py-1">Yield (%)</th>
                  <th className="text-right text-[#555] py-1">Change (bp)</th>
                  <th className="text-right text-[#555] py-1">Visual</th>
                </tr>
              </thead>
              <tbody>
                {YIELD_CURVE.map(p => (
                  <tr key={p.tenor} className="border-b border-[#1a1a2e]/50 hover:bg-[#0f0f1e]">
                    <td className="text-[#ff9900] py-1 font-bold">{p.tenor}</td>
                    <td className="text-right text-[#ccc] py-1">{p.yield.toFixed(2)}</td>
                    <td className={`text-right py-1 ${p.change >= 0 ? 'text-[#ff3333]' : 'text-[#00cc66]'}`}>
                      {p.change >= 0 ? '+' : ''}{(p.change * 100).toFixed(0)}
                    </td>
                    <td className="text-right py-1">
                      <div className="inline-block w-16 h-2 bg-[#1a1a2e] rounded overflow-hidden">
                        <div className="h-full bg-[#ff9900]/60 rounded"
                          style={{ width: `${((p.yield - minCurveYield) / yieldRange) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'spread' && (
          <>
            {/* Spread Analysis */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">SPREAD ANALYSIS</div>
              {SPREAD_DATA.map(s => (
                <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-[#1a1a2e]/30">
                  <div>
                    <span className="text-[#ccc] text-xs font-bold">{s.name}</span>
                    <span className="text-[#555] text-[10px] ml-2">{s.desc}</span>
                  </div>
                  <span className={`text-sm font-bold ${s.value >= 0 ? 'text-[#ff9900]' : 'text-[#00cc66]'}`}>
                    {s.value >= 0 ? '+' : ''}{s.value} bp
                  </span>
                </div>
              ))}
            </div>

            {/* Relative Value Scatter */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">RELATIVE VALUE (SPREAD vs DURATION)</div>
              <div className="relative h-40">
                <svg viewBox="0 0 400 140" className="w-full h-full">
                  {/* Axes */}
                  <line x1="40" y1="120" x2="390" y2="120" stroke="#1a1a2e" strokeWidth="1" />
                  <line x1="40" y1="10" x2="40" y2="120" stroke="#1a1a2e" strokeWidth="1" />
                  <text x="200" y="138" fill="#555" fontSize="8" textAnchor="middle">Duration (yrs)</text>
                  <text x="10" y="70" fill="#555" fontSize="8" textAnchor="middle" transform="rotate(-90, 10, 70)">Spread (bp)</text>

                  {COMPARABLES.map((b, i) => {
                    const x = 40 + (b.duration / 10) * 340;
                    const y = 120 - (b.spread / 80) * 100;
                    const isSubject = i < 3;
                    return (
                      <g key={b.ticker}>
                        <circle cx={x} cy={y} r="5"
                          fill={isSubject ? '#ff9900' : '#6699ff'}
                          opacity="0.8"
                        />
                        <text x={x} y={y - 8} fill="#888" fontSize="7" textAnchor="middle">
                          {b.ticker.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </>
        )}

        {tab === 'comps' && (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-[#555] mb-2 tracking-wider">COMPARABLE BONDS</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left text-[#555] py-1.5">Bond</th>
                  <th className="text-right text-[#555] py-1.5">Coupon</th>
                  <th className="text-right text-[#555] py-1.5">Maturity</th>
                  <th className="text-right text-[#555] py-1.5">Rating</th>
                  <th className="text-right text-[#555] py-1.5">Yield</th>
                  <th className="text-right text-[#555] py-1.5">Spread</th>
                  <th className="text-right text-[#555] py-1.5">Price</th>
                  <th className="text-right text-[#555] py-1.5">Mod Dur</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#ff9900]/30 bg-[#ff9900]/5">
                  <td className="text-[#ff9900] font-bold py-1.5">{BOND.name}</td>
                  <td className="text-right text-[#ccc] py-1.5">{BOND.coupon}%</td>
                  <td className="text-right text-[#ccc] py-1.5">{BOND.maturity}</td>
                  <td className="text-right text-[#6699ff] py-1.5">{BOND.rating.sp}</td>
                  <td className="text-right text-[#ff9900] py-1.5">{inputYield.toFixed(2)}%</td>
                  <td className="text-right text-[#ccc] py-1.5">—</td>
                  <td className="text-right text-[#ccc] py-1.5">{calcResults.price.toFixed(2)}</td>
                  <td className="text-right text-[#ccc] py-1.5">{calcResults.dur.toFixed(2)}</td>
                </tr>
                {COMPARABLES.map(b => (
                  <tr key={b.ticker} className="border-b border-[#1a1a2e]/50 hover:bg-[#0f0f1e]">
                    <td className="text-[#6699ff] font-bold py-1.5">{b.ticker}</td>
                    <td className="text-right text-[#ccc] py-1.5">{b.coupon}%</td>
                    <td className="text-right text-[#ccc] py-1.5">{b.maturity}</td>
                    <td className="text-right text-[#6699ff] py-1.5">{b.rating}</td>
                    <td className="text-right text-[#ccc] py-1.5">{b.yield.toFixed(2)}%</td>
                    <td className="text-right text-[#ff9900] py-1.5">{b.spread > 0 ? `+${b.spread}` : b.spread}</td>
                    <td className="text-right text-[#ccc] py-1.5">{b.price.toFixed(2)}</td>
                    <td className="text-right text-[#ccc] py-1.5">{b.duration.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
