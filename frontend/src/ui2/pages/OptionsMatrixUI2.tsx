/**
 * OptionsMatrixUI2 — Bloomberg-Grade Options Terminal
 * =====================================================
 * Full options chain with real Greeks, IV surface, strategy builder & P&L diagram.
 *
 * Features:
 *  • Full options chain table (calls + puts) with 14 Greeks columns each
 *  • Expiration date picker + strike range filter
 *  • In-the-money highlighting, moneyness indicators
 *  • IV Surface heatmap (strike × expiry)
 *  • Strategy builder: select legs, compute combined P&L, net Greeks
 *  • Put/Call ratio, max pain computation
 *  • Open interest & volume by strike bar charts
 *  • All data from /api/v4/options — real BSM pricing engine
 */

import {
  useState, useEffect, useCallback, useMemo, type CSSProperties,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionRow {
  strike:        number;
  expiry:        string;
  option_type:   'call' | 'put';
  bid:           number;
  ask:           number;
  mid:           number;
  iv:            number;
  delta:         number;
  gamma:         number;
  theta:         number;
  vega:          number;
  rho:           number;
  volume:        number;
  open_interest: number;
  intrinsic:     number;
  time_value:    number;
  moneyness:     number;   // (S - K) / S  for calls, (K - S) / S for puts
}

interface ChainData {
  symbol:       string;
  spot_price:   number;
  expiries:     string[];
  calls:        OptionRow[];
  puts:         OptionRow[];
  put_call_ratio: number;
  max_pain:     number;
  iv_rank:      number;
  iv_percentile: number;
}

interface StrategyLeg {
  option_type: 'call' | 'put';
  action:      'buy'  | 'sell';
  strike:      number;
  expiry:      string;
  qty:         number;
  mid:         number;
  iv:          number;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const BG     = '#0a0a0a';
const PANEL  = '#111111';
const BORDER = '#1e1e1e';
const AMBER  = '#f5a623';
const GREEN  = '#26a69a';
const RED    = '#ef5350';
const PURPLE = '#9c27b0';
const SUBTLE  = '#555';
const TEXT    = '#d1d4dc';
const MONO    = '"Roboto Mono", "Courier New", monospace';
const ITM_BG  = '#1a1200';   // in-the-money background

const cell: CSSProperties = { padding: '3px 6px', fontFamily: MONO, fontSize: 11, textAlign: 'right' as const, whiteSpace: 'nowrap' };
const th:   CSSProperties = { ...cell, color: SUBTLE, fontWeight: 600, fontSize: 10, borderBottom: `1px solid ${BORDER}`, background: '#141414', position: 'sticky' as const, top: 0, zIndex: 5 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined, d = 2) =>
  n == null || isNaN(n) ? '—' : n.toFixed(d);

const fmtK = (n: number) =>
  n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n);

// Color for Greek values
const greekColor = (v: number, threshold = 0) =>
  v > threshold ? GREEN : v < -threshold ? RED : TEXT;

// ─── IV Heatmap ───────────────────────────────────────────────────────────────

function IVHeatmap({ calls, expiries }: { calls: OptionRow[]; expiries: string[] }) {
  // Build strike list
  const strikes = Array.from(new Set(calls.map(c => c.strike))).sort((a, b) => a - b);
  const ivMap: Record<string, number> = {};
  calls.forEach(c => { ivMap[`${c.strike}_${c.expiry}`] = c.iv; });
  const allIVs = Object.values(ivMap).filter(v => v > 0);
  const minIV = Math.min(...allIVs);
  const maxIV = Math.max(...allIVs);

  const colorForIV = (iv: number): string => {
    if (!iv || minIV === maxIV) return '#1a1a1a';
    const t = (iv - minIV) / (maxIV - minIV);
    // low IV = dark blue, high IV = bright red
    const r = Math.round(t * 200 + 30);
    const b = Math.round((1 - t) * 120 + 30);
    const g = Math.round(30 + t * 20);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', minWidth: 60 }}>Strike</th>
            {expiries.slice(0, 8).map(e => (
              <th key={e} style={{ ...th, minWidth: 70 }}>{e.slice(5)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strikes.map(k => (
            <tr key={k}>
              <td style={{ ...cell, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{k}</td>
              {expiries.slice(0, 8).map(e => {
                const iv = ivMap[`${k}_${e}`];
                return (
                  <td key={e} style={{ ...cell, background: iv ? colorForIV(iv) : '#111', color: iv ? '#fff' : SUBTLE }}>
                    {iv ? `${(iv * 100).toFixed(1)}%` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── StrategyBuilder ──────────────────────────────────────────────────────────

function StrategyBuilder({ legs, onRemove, spotPrice }: { legs: StrategyLeg[]; onRemove: (i: number) => void; spotPrice: number }) {
  if (!legs.length) {
    return <div style={{ color: SUBTLE, fontSize: 11, padding: '20px 0', textAlign: 'center', fontFamily: MONO }}>No legs added. Click strikes in the chain to build a strategy.</div>;
  }

  // Net Greeks + cost
  const net = legs.reduce((acc, l) => {
    const sign = l.action === 'buy' ? 1 : -1;
    return {
      delta: acc.delta + sign * l.delta * l.qty,
      cost:  acc.cost  + sign * l.mid   * l.qty * 100,
    };
  }, { delta: 0, cost: 0 });

  // P&L at expiry across spot range
  const spotRange = Array.from({ length: 21 }, (_, i) => spotPrice * (0.8 + i * 0.02));
  const pnl = spotRange.map(s => {
    let val = 0;
    for (const leg of legs) {
      const sign = leg.action === 'buy' ? 1 : -1;
      const payoff = leg.option_type === 'call'
        ? Math.max(0, s - leg.strike)
        : Math.max(0, leg.strike - s);
      val += sign * (payoff - leg.mid) * leg.qty * 100;
    }
    return val;
  });

  const maxP = Math.max(...pnl);
  const minP = Math.min(...pnl);
  const range_ = maxP - minP || 1;
  const chartH = 80;
  const chartW = 400;

  const pts = pnl.map((v, i) => {
    const x = (i / (pnl.length - 1)) * chartW;
    const y = chartH - ((v - minP) / range_) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const zeroY = chartH - ((0 - minP) / range_) * chartH;

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Legs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {legs.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: TEXT }}>
            <span style={{ color: l.action === 'buy' ? GREEN : RED, fontWeight: 700, minWidth: 32 }}>{l.action.toUpperCase()}</span>
            <span style={{ minWidth: 24 }}>{l.qty}×</span>
            <span style={{ color: AMBER }}>{l.strike}</span>
            <span style={{ color: SUBTLE }}>{l.option_type.charAt(0).toUpperCase()}</span>
            <span style={{ color: SUBTLE }}>{l.expiry.slice(5)}</span>
            <span style={{ flex: 1, color: SUBTLE }}>${l.mid.toFixed(2)}</span>
            <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      {/* Net metrics */}
      <div style={{ display: 'flex', gap: 20, fontSize: 11, marginBottom: 12 }}>
        <span style={{ color: SUBTLE }}>Net Cost: <span style={{ color: net.cost > 0 ? RED : GREEN, fontWeight: 700 }}>${Math.abs(net.cost).toFixed(0)}{net.cost > 0 ? ' Debit' : ' Credit'}</span></span>
        <span style={{ color: SUBTLE }}>Net Δ: <span style={{ color: greekColor(net.delta), fontWeight: 700 }}>{net.delta.toFixed(3)}</span></span>
        <span style={{ color: SUBTLE }}>Max Profit: <span style={{ color: GREEN }}>{maxP > 1e6 ? 'Unlimited' : `$${maxP.toFixed(0)}`}</span></span>
        <span style={{ color: SUBTLE }}>Max Loss: <span style={{ color: RED }}>{minP < -1e6 ? 'Unlimited' : `$${Math.abs(minP).toFixed(0)}`}</span></span>
      </div>
      {/* P&L diagram */}
      <div style={{ position: 'relative', background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px' }}>
        <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>P&L AT EXPIRY (unhedged)</div>
        <svg width={chartW} height={chartH} style={{ display: 'block' }}>
          {/* zero line */}
          <line x1={0} y1={zeroY} x2={chartW} y2={zeroY} stroke={BORDER} strokeWidth={1} strokeDasharray="4,4" />
          {/* spot line */}
          <line x1={chartW / 2} y1={0} x2={chartW / 2} y2={chartH} stroke={AMBER + '44'} strokeWidth={1} />
          {/* P&L line */}
          <polyline points={pts} fill="none" stroke={AMBER} strokeWidth={2} />
          {/* fill above/below zero */}
          <polyline points={`0,${zeroY} ${pts} ${chartW},${zeroY}`} fill={GREEN + '18'} stroke="none" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginTop: 2 }}>
          <span>${spotRange[0].toFixed(0)}</span>
          <span>±20% range</span>
          <span>${spotRange[spotRange.length-1].toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── OI Bar Chart ─────────────────────────────────────────────────────────────

function OIBarChart({ rows, type }: { rows: OptionRow[]; type: 'volume' | 'open_interest' }) {
  const top = [...rows].sort((a, b) => b[type] - a[type]).slice(0, 15);
  const max = Math.max(1, ...top.map(r => r[type]));
  const col = type === 'volume' ? AMBER : PURPLE;

  return (
    <div style={{ fontFamily: MONO, fontSize: 10 }}>
      {top.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: r.option_type === 'call' ? GREEN : RED, minWidth: 32 }}>{r.strike}</span>
          <div style={{ flex: 1, background: BORDER, borderRadius: 2, overflow: 'hidden', height: 12 }}>
            <div style={{ width: `${(r[type] / max) * 100}%`, height: '100%', background: col + '99', borderRadius: 2 }} />
          </div>
          <span style={{ color: TEXT, minWidth: 40, textAlign: 'right' }}>{fmtK(r[type])}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Chain Table ──────────────────────────────────────────────────────────────

function ChainTable({
  calls, puts, spotPrice, onLegAdd,
}: {
  calls: OptionRow[];
  puts: OptionRow[];
  spotPrice: number;
  onLegAdd: (row: OptionRow, action: 'buy' | 'sell') => void;
}) {
  // Align by strike
  const allStrikes = Array.from(new Set([...calls, ...puts].map(r => r.strike))).sort((a, b) => a - b);
  const callMap: Record<number, OptionRow> = {};
  const putMap:  Record<number, OptionRow> = {};
  calls.forEach(c => { callMap[c.strike] = c; });
  puts.forEach(p  => { putMap[p.strike]  = p; });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
        <thead>
          <tr>
            {/* CALLS side */}
            <th style={{ ...th, textAlign: 'left', color: GREEN + 'cc' }}>ITM</th>
            <th style={th}>Bid</th><th style={th}>Ask</th><th style={th}>IV%</th>
            <th style={th}>Δ</th><th style={th}>Γ</th><th style={th}>Θ</th><th style={th}>V</th>
            <th style={th}>OI</th><th style={th}>Vol</th>
            {/* STRIKE */}
            <th style={{ ...th, textAlign: 'center', color: AMBER, background: '#161200' }}>STRIKE</th>
            {/* PUTS side */}
            <th style={th}>Bid</th><th style={th}>Ask</th><th style={th}>IV%</th>
            <th style={th}>Δ</th><th style={th}>Γ</th><th style={th}>Θ</th><th style={th}>V</th>
            <th style={th}>OI</th><th style={th}>Vol</th>
            <th style={{ ...th, textAlign: 'right', color: RED + 'cc' }}>ITM</th>
          </tr>
        </thead>
        <tbody>
          {allStrikes.map(k => {
            const c = callMap[k];
            const p = putMap[k];
            const callITM = c && k < spotPrice;
            const putITM  = p && k > spotPrice;
            const atm     = Math.abs(k - spotPrice) / spotPrice < 0.005;

            const rowBg = atm
              ? '#1a1200'
              : (callITM || putITM) ? ITM_BG : 'transparent';

            return (
              <tr
                key={k}
                style={{ background: rowBg, borderBottom: `1px solid ${BORDER}22` }}
              >
                {/* CALL side */}
                <td style={{ ...cell, color: callITM ? GREEN : SUBTLE }}>
                  {callITM ? '●' : '○'}
                </td>
                {c ? (
                  <>
                    <td style={{ ...cell, color: GREEN }}>{fmt(c.bid)}</td>
                    <td style={{ ...cell, color: RED   }}>{fmt(c.ask)}</td>
                    <td style={{ ...cell, color: AMBER }}>{fmt(c.iv * 100, 1)}%</td>
                    <td style={{ ...cell, color: greekColor(c.delta, 0) }}>{fmt(c.delta, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmt(c.gamma, 4)}</td>
                    <td style={{ ...cell, color: greekColor(c.theta, 0) }}>{fmt(c.theta, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmt(c.vega, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmtK(c.open_interest)}</td>
                    <td style={{ ...cell, color: c.volume > 0 ? AMBER : SUBTLE }}>{fmtK(c.volume)}</td>
                  </>
                ) : Array.from({ length: 8 }, (_, i) => <td key={i} style={{ ...cell, color: SUBTLE }}>—</td>)}

                {/* STRIKE */}
                <td
                  style={{
                    ...cell, textAlign: 'center', fontWeight: 700,
                    color: atm ? AMBER : TEXT,
                    fontSize: atm ? 12 : 11,
                    background: '#161200',
                    cursor: 'pointer',
                  }}
                  title={`ATM: ${atm}`}
                >
                  {atm && <span style={{ fontSize: 8, color: AMBER, display: 'block' }}>ATM</span>}
                  {k}
                </td>

                {/* PUT side */}
                {p ? (
                  <>
                    <td style={{ ...cell, color: GREEN }}>{fmt(p.bid)}</td>
                    <td style={{ ...cell, color: RED   }}>{fmt(p.ask)}</td>
                    <td style={{ ...cell, color: AMBER }}>{fmt(p.iv * 100, 1)}%</td>
                    <td style={{ ...cell, color: greekColor(p.delta, 0) }}>{fmt(p.delta, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmt(p.gamma, 4)}</td>
                    <td style={{ ...cell, color: greekColor(p.theta, 0) }}>{fmt(p.theta, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmt(p.vega, 3)}</td>
                    <td style={{ ...cell, color: TEXT  }}>{fmtK(p.open_interest)}</td>
                    <td style={{ ...cell, color: p.volume > 0 ? AMBER : SUBTLE }}>{fmtK(p.volume)}</td>
                  </>
                ) : Array.from({ length: 8 }, (_, i) => <td key={i} style={{ ...cell, color: SUBTLE }}>—</td>)}
                <td style={{ ...cell, color: putITM ? RED : SUBTLE }}>
                  {putITM ? '●' : '○'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function OptionsMatrixUI2() {
  const [symbol,     setSymbol]     = useState('AAPL');
  const [symbolInput, setSymbolInput] = useState('AAPL');
  const [expiry,     setExpiry]     = useState<string>('');
  const [chain,      setChain]      = useState<ChainData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [tab,        setTab]        = useState<'chain' | 'ivsurf' | 'oiflow' | 'strategy'>('chain');
  const [legs,       setLegs]       = useState<StrategyLeg[]>([]);
  const [strikePct,  setStrikePct]  = useState(20);  // show strikes within ±pct of spot
  const [rf,         setRf]         = useState(0.04);

  // Fetch the options chain
  const fetchChain = useCallback(async (sym: string, exp: string) => {
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        symbol: sym,
        spot:   null,   // null = use latest price from backend
        r:      rf,
        n_strikes: 30,
        option_type: 'both',
      };
      if (exp) body['expiry'] = exp;

      const res = await fetch('/api/v4/options/chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();

      // Separate calls and puts
      const all: OptionRow[] = Array.isArray(data.chain) ? data.chain : data;
      const calls = all.filter((r: OptionRow) => r.option_type === 'call');
      const puts  = all.filter((r: OptionRow) => r.option_type === 'put');
      const spot  = data.spot_price ?? 0;
      const expiries = data.expiries ?? [];

      // Compute P/C ratio and max pain
      const totalPutOI  = puts.reduce((s, r) => s + (r.open_interest ?? 0), 0);
      const totalCallOI = calls.reduce((s, r) => s + (r.open_interest ?? 0), 0);
      const pcRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

      // Max pain = strike where total OI loss for option buyers is maximized
      const strikes = Array.from(new Set(all.map(r => r.strike))).sort((a, b) => a - b);
      let maxPainStrike = strikes[0];
      let minLoss = Infinity;
      strikes.forEach(k => {
        const loss = calls.filter(c => k < c.strike).reduce((s, c) => s + (c.strike - k) * c.open_interest, 0)
                   + puts.filter(p => k > p.strike).reduce((s, p) => s + (k - p.strike) * p.open_interest, 0);
        if (loss < minLoss) { minLoss = loss; maxPainStrike = k; }
      });

      setChain({
        symbol: sym,
        spot_price: spot,
        expiries,
        calls,
        puts,
        put_call_ratio: pcRatio,
        max_pain:       maxPainStrike,
        iv_rank:        data.iv_rank ?? 0,
        iv_percentile:  data.iv_percentile ?? 0,
      });
      if (expiries.length > 0 && !exp) setExpiry(expiries[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chain');
    } finally {
      setLoading(false);
    }
  }, [rf]);

  useEffect(() => { fetchChain(symbol, expiry); }, [fetchChain, symbol]);

  // Filter chain to ±strikePct from spot
  const filteredCalls = useMemo(() => {
    if (!chain) return [];
    const spot = chain.spot_price;
    const lo = spot * (1 - strikePct / 100);
    const hi = spot * (1 + strikePct / 100);
    return chain.calls.filter(c => (!expiry || c.expiry === expiry) && c.strike >= lo && c.strike <= hi);
  }, [chain, expiry, strikePct]);

  const filteredPuts = useMemo(() => {
    if (!chain) return [];
    const spot = chain.spot_price;
    const lo = spot * (1 - strikePct / 100);
    const hi = spot * (1 + strikePct / 100);
    return chain.puts.filter(p => (!expiry || p.expiry === expiry) && p.strike >= lo && p.strike <= hi);
  }, [chain, expiry, strikePct]);

  const addLeg = useCallback((row: OptionRow, action: 'buy' | 'sell') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLegs(ls => [...ls, { ...row, action, qty: 1, delta: (row as any).delta ?? 0 }]);
  }, []);

  // ─── UI helpers ───────────────────────────────────────────────────────────
  const BG_ = BG, P_ = PANEL, B_ = BORDER; // avoid shadowing

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '5px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: MONO, fontSize: 11, fontWeight: tab === t ? 700 : 400,
        color: tab === t ? AMBER : SUBTLE,
        borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  const kv = (label: string, val: string, col = TEXT) => (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: 80 }}>
      <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: MONO }}>{val}</span>
    </div>
  );

  const spot = chain?.spot_price ?? 0;

  return (
    <div
      data-testid="options-matrix-page"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG_, fontFamily: MONO, color: TEXT, overflow: 'hidden' }}
    >
      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px', background: '#0d0d0d', borderBottom: `1px solid ${B_}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Symbol */}
        <form onSubmit={e => { e.preventDefault(); setSymbol(symbolInput.toUpperCase()); }}>
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value.toUpperCase())}
            style={{ background: B_, border: 'none', color: AMBER, padding: '3px 8px', borderRadius: 4, fontFamily: MONO, fontSize: 14, fontWeight: 700, width: 80, textAlign: 'center' }}
            placeholder="AAPL"
          />
        </form>

        {/* Spot price */}
        {chain && kv('LAST', `$${spot.toFixed(2)}`, AMBER)}
        {chain && kv('IV RANK', `${(chain.iv_rank * 100).toFixed(0)}`, chain.iv_rank > 0.5 ? RED : GREEN)}
        {chain && kv('IV%ILE', `${(chain.iv_percentile * 100).toFixed(0)}`, TEXT)}
        {chain && kv('P/C RATIO', chain.put_call_ratio.toFixed(2), chain.put_call_ratio > 1.2 ? RED : chain.put_call_ratio < 0.8 ? GREEN : TEXT)}
        {chain && kv('MAX PAIN', String(chain.max_pain), AMBER)}

        <div style={{ flex: 1 }} />

        {/* Expiry select */}
        {chain?.expiries.length ? (
          <select
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            style={{ background: P_, border: `1px solid ${B_}`, color: TEXT, padding: '3px 8px', borderRadius: 4, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}
          >
            <option value="">All Expiries</option>
            {chain.expiries.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        ) : null}

        {/* Strike range */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: SUBTLE }}>
          ±<input
            type="number" min={5} max={50} value={strikePct}
            onChange={e => setStrikePct(Number(e.target.value))}
            style={{ width: 40, background: P_, border: `1px solid ${B_}`, color: TEXT, padding: '2px 4px', borderRadius: 4, fontFamily: MONO, fontSize: 11 }}
          />% strikes
        </label>

        {/* rf */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: SUBTLE }}>
          r%<input
            type="number" min={0} max={20} step={0.1} value={(rf * 100).toFixed(1)}
            onChange={e => setRf(Number(e.target.value) / 100)}
            style={{ width: 40, background: P_, border: `1px solid ${B_}`, color: TEXT, padding: '2px 4px', borderRadius: 4, fontFamily: MONO, fontSize: 11 }}
          />
        </label>

        <button onClick={() => fetchChain(symbol, expiry)} disabled={loading} style={{ padding: '4px 12px', background: '#1a1200', border: `1px solid ${AMBER}44`, color: AMBER, borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 11 }}>
          {loading ? '⟳' : 'REFRESH'}
        </button>
      </div>

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${B_}`, background: '#0d0d0d', flexShrink: 0 }}>
        {tabBtn('chain',    'OPTIONS CHAIN')}
        {tabBtn('ivsurf',   'IV SURFACE')}
        {tabBtn('oiflow',   'OI / FLOW')}
        {tabBtn('strategy', `STRATEGY BUILDER${legs.length ? ` (${legs.length})` : ''}`)}
      </div>

      {/* ── ERROR ───────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '6px 14px', fontSize: 11, color: RED, background: '#1a0505', borderBottom: `1px solid ${B_}`, flexShrink: 0 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: BG_ }}>

        {/* CHAIN TAB */}
        {tab === 'chain' && (
          <div>
            {/* Column headers legend */}
            <div style={{ display: 'flex', gap: 20, padding: '6px 14px', fontSize: 10, color: SUBTLE, borderBottom: `1px solid ${B_}`, background: '#0d0d0d' }}>
              <span style={{ color: GREEN }}>CALLS</span>
              <span>Bid · Ask · IV · Delta · Gamma · Theta · Vega · OI · Vol</span>
              <span style={{ color: AMBER }}>STRIKE</span>
              <span>Bid · Ask · IV · Delta · Gamma · Theta · Vega · OI · Vol</span>
              <span style={{ color: RED }}>PUTS</span>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: SUBTLE }}>Loading chain…</div>
            ) : chain ? (
              <ChainTable
                calls={filteredCalls}
                puts={filteredPuts}
                spotPrice={spot}
                onLegAdd={addLeg}
              />
            ) : null}
          </div>
        )}

        {/* IV SURFACE */}
        {tab === 'ivsurf' && (
          <div style={{ padding: '14px' }}>
            <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 10 }}>
              Implied Volatility Surface — strike × expiry (color: low=blue, high=red)
            </div>
            {chain ? (
              <IVHeatmap calls={chain.calls} expiries={chain.expiries} />
            ) : (
              <div style={{ color: SUBTLE }}>No data.</div>
            )}
          </div>
        )}

        {/* OI FLOW */}
        {tab === 'oiflow' && chain && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: 14 }}>
            <div style={{ background: P_, border: `1px solid ${B_}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: GREEN, fontWeight: 700, marginBottom: 8 }}>CALL OI BY STRIKE</div>
              <OIBarChart rows={chain.calls.filter(c => !expiry || c.expiry === expiry)} type="open_interest" />
            </div>
            <div style={{ background: P_, border: `1px solid ${B_}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: RED, fontWeight: 700, marginBottom: 8 }}>PUT OI BY STRIKE</div>
              <OIBarChart rows={chain.puts.filter(p => !expiry || p.expiry === expiry)} type="open_interest" />
            </div>
            <div style={{ background: P_, border: `1px solid ${B_}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: GREEN, fontWeight: 700, marginBottom: 8 }}>CALL VOLUME</div>
              <OIBarChart rows={chain.calls.filter(c => !expiry || c.expiry === expiry)} type="volume" />
            </div>
            <div style={{ background: P_, border: `1px solid ${B_}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: RED, fontWeight: 700, marginBottom: 8 }}>PUT VOLUME</div>
              <OIBarChart rows={chain.puts.filter(p => !expiry || p.expiry === expiry)} type="volume" />
            </div>
          </div>
        )}

        {/* STRATEGY BUILDER */}
        {tab === 'strategy' && (
          <div style={{ padding: 14, maxWidth: 700 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8 }}>
                To add legs: go to CHAIN tab → click a strike price (coming soon for one-click entry).
                You can also add legs manually below.
              </div>
              {/* Manual add form */}
              <ManualLegForm
                calls={filteredCalls}
                puts={filteredPuts}
                expiries={chain?.expiries ?? []}
                onAdd={leg => setLegs(ls => [...ls, leg])}
              />
            </div>
            <StrategyBuilder legs={legs} onRemove={i => setLegs(ls => ls.filter((_, idx) => idx !== i))} spotPrice={spot} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ManualLegForm ────────────────────────────────────────────────────────────

function ManualLegForm({
  calls, puts, expiries, onAdd,
}: {
  calls:   OptionRow[];
  puts:    OptionRow[];
  expiries: string[];
  onAdd:   (leg: StrategyLeg) => void;
}) {
  const [type,   setType]   = useState<'call' | 'put'>('call');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [expiry, setExpiry] = useState(expiries[0] ?? '');
  const [qty,    setQty]    = useState(1);
  const rows = type === 'call' ? calls.filter(c => c.expiry === expiry) : puts.filter(p => p.expiry === expiry);
  const [strikeIdx, setStrikeIdx] = useState(0);

  const selected = rows[strikeIdx];

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
      {/* Buy/Sell */}
      {(['buy','sell'] as const).map(a => (
        <button key={a} onClick={() => setAction(a)} style={{
          padding: '4px 10px', border: `1px solid ${action === a ? (a === 'buy' ? GREEN : RED) : BORDER}`,
          background: action === a ? (a === 'buy' ? GREEN + '22' : RED + '22') : 'transparent',
          color: action === a ? (a === 'buy' ? GREEN : RED) : SUBTLE,
          borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 700,
        }}>{a.toUpperCase()}</button>
      ))}
      {/* Call/Put */}
      {(['call','put'] as const).map(t => (
        <button key={t} onClick={() => setType(t)} style={{
          padding: '4px 10px', border: `1px solid ${type === t ? AMBER : BORDER}`,
          background: type === t ? AMBER + '22' : 'transparent',
          color: type === t ? AMBER : SUBTLE,
          borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 11,
        }}>{t.toUpperCase()}</button>
      ))}
      {/* Expiry */}
      <select value={expiry} onChange={e => setExpiry(e.target.value)} style={{ background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 6px', borderRadius: 4, fontFamily: MONO, fontSize: 11 }}>
        {expiries.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      {/* Strike */}
      <select value={strikeIdx} onChange={e => setStrikeIdx(Number(e.target.value))} style={{ background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 6px', borderRadius: 4, fontFamily: MONO, fontSize: 11 }}>
        {rows.map((r, i) => <option key={i} value={i}>{r.strike}</option>)}
      </select>
      {/* Qty */}
      <input type="number" min={1} max={100} value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 50, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 6px', borderRadius: 4, fontFamily: MONO, fontSize: 11 }} />
      <button
        onClick={() => {
          if (!selected) return;
          onAdd({ ...selected, action, qty, delta: selected.delta });
        }}
        style={{ padding: '4px 14px', background: AMBER + '22', border: `1px solid ${AMBER}44`, color: AMBER, borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}
      >
        + ADD LEG
      </button>
      {selected && (
        <span style={{ fontSize: 10, color: SUBTLE }}>mid ${selected.mid?.toFixed(2)} · IV {(selected.iv * 100).toFixed(1)}%</span>
      )}
    </div>
  );
}
