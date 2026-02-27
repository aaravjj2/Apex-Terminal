/**
 * PortfolioUI2 — Bloomberg PRTU-grade Portfolio Terminal
 * Tabs: HOLDINGS | OPTIMIZER | RISK | ATTRIBUTION | REBALANCE
 * Real API: /api/v4/portfolio/* | /api/v1/positions
 * Full inline Bloomberg styling — no ui2/components dependency
 */
import React, { useState, useEffect, useCallback } from 'react';

// ─── Bloomberg palette ────────────────────────────────────────────────────────
const BG = '#040407';
const PANEL = '#0c0c14';
const BORDER = '#1e1e2e';
const AMBER = '#ff9900';
const GREEN = '#00d88a';
const RED = '#ff3b5c';
const BLUE = '#4da6ff';
const PURPLE = '#c084fc';
const SUBTLE = '#5d5d7d';
const TEXT = '#e8e8ee';
const MONO = "'IBM Plex Mono','Roboto Mono','Courier New',monospace";

// ─── Shared styles ────────────────────────────────────────────────────────────
const pnl: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`, borderRadius: 0, overflow: 'hidden' };
const hdr: React.CSSProperties = {
  padding: '4px 10px', background: 'rgba(255,153,0,0.06)', borderBottom: `1px solid ${BORDER}`,
  fontSize: 9, color: AMBER, fontWeight: 700, letterSpacing: '0.12em',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  textTransform: 'uppercase' as const, fontFamily: MONO,
};
const th: React.CSSProperties = {
  padding: '4px 8px', fontSize: 9, color: SUBTLE, fontFamily: MONO,
  fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '3px 8px', fontSize: 10, fontFamily: MONO,
  textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.5)`,
};
const inp: React.CSSProperties = {
  background: '#080810', border: `1px solid ${BORDER}`, borderRadius: 2,
  color: TEXT, fontFamily: MONO, fontSize: 10, padding: '4px 8px',
  outline: 'none', width: 120,
};
const btn = (active?: boolean): React.CSSProperties => ({
  padding: '5px 14px', border: `1px solid ${active ? AMBER : BORDER}`,
  background: active ? 'rgba(255,153,0,0.12)' : PANEL, color: active ? AMBER : TEXT,
  fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
  letterSpacing: '0.08em',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => isNaN(n) ? '─' : n.toFixed(2);
const fmtPct = (n: number) => isNaN(n) ? '─' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const fmtK = (n: number) => {
  if (isNaN(n)) return '─';
  return n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(2)}`;
};
const clr = (n: number) => n >= 0 ? GREEN : RED;

// ─── Types ────────────────────────────────────────────────────────────────────
interface HoldingRow {
  symbol: string; quantity: number; avg_price: number; market_price: number;
  unrealized_pnl: number; realized_pnl?: number; sector?: string;
  market_value?: number; weight?: number; beta?: number;
}
interface OptResult {
  weights: Record<string, number>;
  expected_return?: number; expected_volatility?: number; sharpe_ratio?: number;
  method?: string; efficient_frontier?: [number, number][];
}
interface RiskResult {
  portfolio_var?: number; portfolio_cvar?: number; beta?: number; sharpe?: number;
  volatility?: number; correlation_matrix?: Record<string, Record<string, number>>;
  marginal_contributions?: Record<string, number>;
}
interface AttrResult {
  total_return?: number; benchmark_return?: number; active_return?: number;
  allocation_effect?: number; selection_effect?: number; interaction_effect?: number;
  sector_breakdown?: Record<string, { allocation: number; selection: number; interaction: number }>;
}
interface RebalResult {
  current_weights: Record<string, number>;
  target_weights: Record<string, number>;
  trades: { symbol: string; shares: number; value: number; direction: 'BUY'|'SELL' }[];
  turnover?: number;
}

// ─── Efficient Frontier SVG ───────────────────────────────────────────────────
const EfficientFrontierSVG: React.FC<{ points: [number, number][]; opt?: [number, number] }> = ({ points, opt }) => {
  if (!points.length) return <div style={{ color: SUBTLE, fontSize: 10, padding: 10 }}>No frontier data</div>;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 480, H = 160, PAD = 30;
  const px = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - PAD * 2);
  const py = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  const pts = points.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="efGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={RED} stopOpacity="0.6" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={PAD} y1={py(minY + t * (maxY - minY))} x2={W - PAD} y2={py(minY + t * (maxY - minY))}
          stroke={BORDER} strokeWidth={1} strokeDasharray="3,3" />
      ))}
      <polyline points={pts} fill="none" stroke="url(#efGrad)" strokeWidth={2.5} />
      {opt && (
        <>
          <circle cx={px(opt[0])} cy={py(opt[1])} r={5} fill={AMBER} />
          <text x={px(opt[0]) + 7} y={py(opt[1]) - 5} fontSize={9} fill={AMBER} fontFamily={MONO}>
            OPT
          </text>
        </>
      )}
      {/* Axis labels */}
      <text x={W / 2} y={H - 5} fontSize={8} fill={SUBTLE} textAnchor="middle" fontFamily={MONO}>VOLATILITY →</text>
      <text x={10} y={H / 2} fontSize={8} fill={SUBTLE} textAnchor="middle" fontFamily={MONO}
        transform={`rotate(-90,10,${H/2})`}>RETURN</text>
    </svg>
  );
};

// ─── Weight Bar ───────────────────────────────────────────────────────────────
const WeightBar: React.FC<{ symbol: string; weight: number; maxW: number }> = ({ symbol, weight, maxW }) => (
  <div style={{ marginBottom: 5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
      <span style={{ color: AMBER, fontFamily: MONO }}>{symbol}</span>
      <span style={{ color: TEXT, fontFamily: MONO }}>{(weight * 100).toFixed(1)}%</span>
    </div>
    <div style={{ height: 5, background: 'rgba(30,30,46,0.7)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(weight / maxW) * 100}%`, background: weight > 0.15 ? AMBER : BLUE, borderRadius: 2 }} />
    </div>
  </div>
);

// ─── Correlation Cell ─────────────────────────────────────────────────────────
const CorrCell: React.FC<{ val: number }> = ({ val }) => {
  const abs = Math.abs(val);
  const bg = val > 0.7 ? `rgba(239,83,80,${0.2 + abs * 0.5})` : val < -0.3 ? `rgba(66,165,245,${0.1 + abs * 0.4})` : 'transparent';
  return (
    <td style={{ ...td, background: bg, color: Math.abs(val) > 0.5 ? TEXT : SUBTLE }}>
      {val.toFixed(2)}
    </td>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const TABS = ['HOLDINGS', 'OPTIMIZER', 'RISK', 'ATTRIBUTION', 'REBALANCE'] as const;
type Tab = typeof TABS[number];

const OPT_METHODS = [
  { id: 'mvo', label: 'MVO — Mean-Variance' },
  { id: 'hrp', label: 'HRP — Hierarchical Risk Parity' },
  { id: 'risk_parity', label: 'Risk Parity' },
  { id: 'black_litterman', label: 'Black-Litterman' },
  { id: 'equal_weight', label: 'Equal Weight' },
  { id: 'max_diversification', label: 'Max Diversification' },
];

export function PortfolioUI2() {
  const [tab, setTab] = useState<Tab>('HOLDINGS');
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  // Optimizer state
  const [optMethod, setOptMethod] = useState('mvo');
  const [optSymbols, setOptSymbols] = useState('AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,BRK.B,JNJ,JPM');
  const [targetReturn, setTargetReturn] = useState('');
  const [targetRisk, setTargetRisk] = useState('');
  const [optResult, setOptResult] = useState<OptResult | null>(null);
  const [loadingO, setLoadingO] = useState(false);
  const [optError, setOptError] = useState('');

  // Risk state
  const [riskSymbols, setRiskSymbols] = useState('AAPL,MSFT,NVDA,AMZN,GOOGL');
  const [riskWeights, setRiskWeights] = useState('0.2,0.2,0.2,0.2,0.2');
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [loadingR, setLoadingR] = useState(false);
  const [riskError, setRiskError] = useState('');

  // Attribution state
  const [attrPortSymbols, setAttrPortSymbols] = useState('AAPL,MSFT,NVDA');
  const [attrPortWeights, setAttrPortWeights] = useState('0.4,0.3,0.3');
  const [attrBenchSymbols, setAttrBenchSymbols] = useState('SPY,QQQ,IWM');
  const [attrBenchWeights, setAttrBenchWeights] = useState('0.5,0.3,0.2');
  const [attrResult, setAttrResult] = useState<AttrResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [attrError, setAttrError] = useState('');

  // Rebalance state
  const [rebalSymbols, setRebalSymbols] = useState('AAPL,MSFT,NVDA,AMZN');
  const [rebalTargets, setRebalTargets] = useState('0.25,0.25,0.25,0.25');
  const [portfolioValue, setPortfolioValue] = useState('100000');
  const [rebalResult, setRebalResult] = useState<RebalResult | null>(null);
  const [loadingReb, setLoadingReb] = useState(false);
  const [rebalError, setRebalError] = useState('');

  // Sort state for holdings
  const [sortCol, setSortCol] = useState<keyof HoldingRow>('unrealized_pnl');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // ── Fetch holdings from positions API ──────────────────────────────────────
  const loadHoldings = useCallback(async () => {
    setLoadingH(true);
    try {
      const r = await fetch('/api/v1/positions');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const pos: HoldingRow[] = Array.isArray(d) ? d : d.positions ?? [];
      const totalMV = pos.reduce((s, p) => s + (p.market_value ?? p.quantity * p.market_price), 0);
      setHoldings(pos.map(p => ({
        ...p,
        market_value: p.market_value ?? p.quantity * p.market_price,
        weight: totalMV > 0 ? (p.market_value ?? p.quantity * p.market_price) / totalMV : 0,
      })));
    } catch {
      setHoldings([]);
    } finally { setLoadingH(false); }
  }, []);

  useEffect(() => { loadHoldings(); }, []);

  // ── Run optimizer ──────────────────────────────────────────────────────────
  const runOptimizer = useCallback(async () => {
    setLoadingO(true); setOptError(''); setOptResult(null);
    try {
      const symbols = optSymbols.split(',').map(s => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = { symbols, method: optMethod };
      if (targetReturn) body.target_return = parseFloat(targetReturn);
      if (targetRisk) body.target_risk = parseFloat(targetRisk);
      const r = await fetch('/api/v4/portfolio/optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      setOptResult(await r.json());
    } catch (e) { setOptError(String(e)); }
    finally { setLoadingO(false); }
  }, [optMethod, optSymbols, targetReturn, targetRisk]);

  // ── Run risk analysis ──────────────────────────────────────────────────────
  const runRisk = useCallback(async () => {
    setLoadingR(true); setRiskError(''); setRiskResult(null);
    try {
      const symbols = riskSymbols.split(',').map(s => s.trim()).filter(Boolean);
      const weights = riskWeights.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const r = await fetch('/api/v4/portfolio/risk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, weights }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      setRiskResult(await r.json());
    } catch (e) { setRiskError(String(e)); }
    finally { setLoadingR(false); }
  }, [riskSymbols, riskWeights]);

  // ── Run attribution ────────────────────────────────────────────────────────
  const runAttribution = useCallback(async () => {
    setLoadingA(true); setAttrError(''); setAttrResult(null);
    try {
      const portfolio_symbols = attrPortSymbols.split(',').map(s => s.trim()).filter(Boolean);
      const portfolio_weights = attrPortWeights.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const benchmark_symbols = attrBenchSymbols.split(',').map(s => s.trim()).filter(Boolean);
      const benchmark_weights = attrBenchWeights.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const r = await fetch('/api/v4/portfolio/attribution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_symbols, portfolio_weights, benchmark_symbols, benchmark_weights }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      setAttrResult(await r.json());
    } catch (e) { setAttrError(String(e)); }
    finally { setLoadingA(false); }
  }, [attrPortSymbols, attrPortWeights, attrBenchSymbols, attrBenchWeights]);

  // ── Run rebalance ──────────────────────────────────────────────────────────
  const runRebalance = useCallback(async () => {
    setLoadingReb(true); setRebalError(''); setRebalResult(null);
    try {
      const symbols = rebalSymbols.split(',').map(s => s.trim()).filter(Boolean);
      const target_weights = rebalTargets.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const r = await fetch('/api/v4/portfolio/rebalance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, target_weights, portfolio_value: parseFloat(portfolioValue) }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      setRebalResult(await r.json());
    } catch (e) { setRebalError(String(e)); }
    finally { setLoadingReb(false); }
  }, [rebalSymbols, rebalTargets, portfolioValue]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalUnrPnL = holdings.reduce((s, h) => s + (h.unrealized_pnl ?? 0), 0);
  const totalRlzPnL = holdings.reduce((s, h) => s + (h.realized_pnl ?? 0), 0);
  const totalMV = holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);

  const sortedHoldings = [...holdings].sort((a, b) => {
    const av = (a[sortCol] ?? 0) as number, bv = (b[sortCol] ?? 0) as number;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const sortTh = (col: keyof HoldingRow, label: string) => (
    <th style={{ ...th, cursor: 'pointer', textAlign: 'right', color: sortCol === col ? AMBER : SUBTLE }}
      onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } }}>
      {label}{sortCol === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );

  // ── Input row helper ───────────────────────────────────────────────────────
  const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; w?: number }> = ({ label, value, onChange, w = 200 }) => (
    <div>
      <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ ...inp, width: w }} />
    </div>
  );

  const RunBtn: React.FC<{ label: string; loading: boolean; onClick: () => void }> = ({ label, loading, onClick }) => (
    <button onClick={onClick} disabled={loading} style={{
      ...btn(), background: loading ? PANEL : 'rgba(255,153,0,0.12)', color: loading ? SUBTLE : AMBER,
      borderColor: loading ? BORDER : AMBER, cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-end',
    }}>{loading ? 'COMPUTING…' : label}</button>
  );

  const ErrBox: React.FC<{ msg: string }> = ({ msg }) => msg
    ? <div style={{ padding: '6px 10px', background: 'rgba(255,59,92,0.12)', border: `1px solid ${RED}`, borderRadius: 2, color: RED, fontSize: 10 }}>{msg}</div>
    : null;

  // ── Tab styling ────────────────────────────────────────────────────────────
  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 16px', border: 'none', background: tab === t ? PANEL : 'transparent',
    color: tab === t ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`,
    letterSpacing: 1,
  });

  return (
    <div data-testid="portfolio-ui2-page" data-ready="true"
      style={{ height: '100%', overflow: 'auto', background: BG, padding: '10px 14px', fontFamily: MONO, color: TEXT }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>PORTFOLIO TERMINAL</span>
        <button onClick={loadHoldings} style={{ ...btn(), fontSize: 9 }}>{loadingH ? 'REFRESHING…' : 'REFRESH'}</button>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
        {[
          { l: 'UNREALIZED P&L', v: fmtK(totalUnrPnL), c: clr(totalUnrPnL) },
          { l: 'REALIZED P&L', v: fmtK(totalRlzPnL), c: clr(totalRlzPnL) },
          { l: 'MARKET VALUE', v: fmtK(totalMV), c: BLUE },
          { l: 'POSITIONS', v: holdings.length.toString(), c: TEXT },
          { l: 'WIN RATE', v: holdings.length > 0 ? `${((holdings.filter(h => (h.unrealized_pnl ?? 0) > 0).length / holdings.length) * 100).toFixed(1)}%` : '─', c: TEXT },
        ].map(item => (
          <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '7px 12px' }}>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 1 }}>{item.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 3 }}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
        {TABS.map(t => <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ══════════════ HOLDINGS TAB ════════════════════════════════════ */}
      {tab === 'HOLDINGS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...pnl, overflowX: 'auto' }}>
            <div style={hdr}>
              <span>OPEN POSITIONS</span>
              <span style={{ color: SUBTLE }}>{holdings.length} holdings — click column header to sort</span>
            </div>
            {holdings.length === 0
              ? <div style={{ padding: '30px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
                  {loadingH ? 'Loading positions…' : 'No positions found — connect broker or place orders'}
                </div>
              : <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left', cursor: 'default', color: SUBTLE }}>SYMBOL</th>
                      {sortTh('quantity', 'QTY')}
                      {sortTh('avg_price', 'AVG PX')}
                      {sortTh('market_price', 'MKT PX')}
                      {sortTh('market_value', 'MKT VALUE')}
                      {sortTh('weight', 'WEIGHT')}
                      {sortTh('unrealized_pnl', 'UNRLZ P&L')}
                      {sortTh('realized_pnl', 'RLZD P&L')}
                      <th style={{ ...th, textAlign: 'left', cursor: 'default' }}>SECTOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((h, i) => {
                      const pxChg = h.market_price - h.avg_price;
                      return (
                        <tr key={h.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{h.symbol}</td>
                          <td style={td}>{h.quantity}</td>
                          <td style={td}>{fmt2(h.avg_price)}</td>
                          <td style={{ ...td, color: pxChg >= 0 ? GREEN : RED }}>{fmt2(h.market_price)}</td>
                          <td style={{ ...td, color: BLUE }}>{fmtK(h.market_value ?? 0)}</td>
                          <td style={{ ...td, color: (h.weight ?? 0) > 0.15 ? PURPLE : TEXT }}>
                            {((h.weight ?? 0) * 100).toFixed(1)}%
                          </td>
                          <td style={{ ...td, color: clr(h.unrealized_pnl), fontWeight: 700 }}>
                            {fmtK(h.unrealized_pnl)}
                          </td>
                          <td style={{ ...td, color: clr(h.realized_pnl ?? 0) }}>{fmtK(h.realized_pnl ?? 0)}</td>
                          <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{h.sector ?? '─'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${BORDER}`, background: BG }}>
                      <td style={{ ...td, textAlign: 'left', color: TEXT, fontWeight: 700 }}>TOTAL</td>
                      <td colSpan={4} style={td} />
                      <td style={{ ...td, color: BLUE, fontWeight: 700 }}>{fmtK(totalMV)}</td>
                      <td style={td} />
                      <td style={{ ...td, color: clr(totalUnrPnL), fontWeight: 700 }}>{fmtK(totalUnrPnL)}</td>
                      <td style={{ ...td, color: clr(totalRlzPnL), fontWeight: 700 }}>{fmtK(totalRlzPnL)}</td>
                      <td style={td} />
                    </tr>
                  </tfoot>
                </table>
            }
          </div>

          {/* Sector allocation bar chart */}
          {holdings.length > 0 && (
            <div style={pnl}>
              <div style={hdr}><span>SECTOR ALLOCATION</span></div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {Object.entries(
                  holdings.reduce((acc, h) => {
                    const sec = h.sector ?? 'Unknown';
                    acc[sec] = (acc[sec] ?? 0) + (h.market_value ?? 0);
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([sec, val]) => {
                  const wpct = totalMV > 0 ? val / totalMV : 0;
                  return (
                    <div key={sec} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginBottom: 2 }}>
                        <span>{sec}</span>
                        <span style={{ fontFamily: MONO }}>
                          <span style={{ color: BLUE }}>{fmtK(val)}</span>
                          {'  '}<span style={{ color: TEXT }}>{(wpct * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(30,30,46,0.7)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${wpct * 100}%`, background: BLUE, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ OPTIMIZER TAB ════════════════════════════════════ */}
      {tab === 'OPTIMIZER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pnl}>
            <div style={hdr}><span>PORTFOLIO OPTIMIZATION ENGINE</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Method selector */}
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>OPTIMIZATION METHOD</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {OPT_METHODS.map(m => (
                    <button key={m.id} onClick={() => setOptMethod(m.id)} style={btn(optMethod === m.id)}>
                      {m.label.split(' — ')[0]}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 4, fontSize: 9, color: SUBTLE }}>
                  {OPT_METHODS.find(m => m.id === optMethod)?.label}
                </div>
              </div>
              {/* Inputs row */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="ASSET UNIVERSE (COMMA-SEPARATED)" value={optSymbols} onChange={setOptSymbols} w={380} />
                {optMethod === 'mvo' && <>
                  <Field label="TARGET RETURN (e.g. 0.12)" value={targetReturn} onChange={setTargetReturn} w={140} />
                  <Field label="TARGET RISK (e.g. 0.18)" value={targetRisk} onChange={setTargetRisk} w={140} />
                </>}
                <RunBtn label="OPTIMIZE PORTFOLIO" loading={loadingO} onClick={runOptimizer} />
              </div>
              <ErrBox msg={optError} />
            </div>
          </div>

          {/* Optimizer results */}
          {optResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Weights table */}
              <div style={pnl}>
                <div style={hdr}>
                  <span>OPTIMAL WEIGHTS — {(optResult.method ?? optMethod).toUpperCase()}</span>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  {Object.entries(optResult.weights)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sym, w]) => (
                      <WeightBar key={sym} symbol={sym} weight={w}
                        maxW={Math.max(...Object.values(optResult.weights))} />
                    ))
                  }
                </div>
                {/* Summary metrics */}
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 14px', display: 'flex', gap: 20 }}>
                  {optResult.expected_return != null && (
                    <span style={{ fontSize: 10 }}>
                      Exp Return: <span style={{ color: GREEN, fontFamily: MONO }}>{fmtPct(optResult.expected_return)}</span>
                    </span>
                  )}
                  {optResult.expected_volatility != null && (
                    <span style={{ fontSize: 10 }}>
                      Exp Vol: <span style={{ color: AMBER, fontFamily: MONO }}>{fmtPct(optResult.expected_volatility)}</span>
                    </span>
                  )}
                  {optResult.sharpe_ratio != null && (
                    <span style={{ fontSize: 10 }}>
                      Sharpe: <span style={{ color: BLUE, fontFamily: MONO }}>{fmt2(optResult.sharpe_ratio)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Efficient frontier */}
              <div style={pnl}>
                <div style={hdr}><span>EFFICIENT FRONTIER</span></div>
                <div style={{ padding: '10px' }}>
                  {optResult.efficient_frontier?.length
                    ? <EfficientFrontierSVG
                        points={optResult.efficient_frontier}
                        opt={optResult.expected_volatility != null && optResult.expected_return != null
                          ? [optResult.expected_volatility, optResult.expected_return] : undefined}
                      />
                    : <div style={{ color: SUBTLE, fontSize: 10, padding: 10 }}>Frontier data not available for this method</div>
                  }
                </div>
                {/* Table of weights */}
                <div style={{ borderTop: `1px solid ${BORDER}` }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                        <th style={th}>WEIGHT</th>
                        <th style={th}>ALLOCATION ($100K)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(optResult.weights).sort((a, b) => b[1] - a[1]).map(([sym, w], i) => (
                        <tr key={sym} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER }}>{sym}</td>
                          <td style={{ ...td, color: w > 0.15 ? PURPLE : TEXT }}>{(w * 100).toFixed(2)}%</td>
                          <td style={{ ...td, color: BLUE }}>{fmtK(w * 100000)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ RISK TAB ═════════════════════════════════════════ */}
      {tab === 'RISK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pnl}>
            <div style={hdr}><span>PORTFOLIO RISK ANALYTICS</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="SYMBOLS (COMMA-SEPARATED)" value={riskSymbols} onChange={setRiskSymbols} w={300} />
                <Field label="WEIGHTS (SUM TO 1.0)" value={riskWeights} onChange={setRiskWeights} w={250} />
                <RunBtn label="ANALYZE RISK" loading={loadingR} onClick={runRisk} />
              </div>
              <ErrBox msg={riskError} />
            </div>
          </div>

          {riskResult && (
            <>
              {/* Top metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { l: 'PORTFOLIO VaR (95%)', v: riskResult.portfolio_var != null ? fmtPct(riskResult.portfolio_var) : '─', c: RED },
                  { l: 'PORTFOLIO CVaR', v: riskResult.portfolio_cvar != null ? fmtPct(riskResult.portfolio_cvar) : '─', c: RED },
                  { l: 'PORTFOLIO BETA', v: riskResult.beta != null ? fmt2(riskResult.beta) : '─', c: AMBER },
                  { l: 'SHARPE RATIO', v: riskResult.sharpe != null ? fmt2(riskResult.sharpe) : '─', c: riskResult.sharpe != null && riskResult.sharpe >= 1 ? GREEN : AMBER },
                  { l: 'VOLATILITY (ANN)', v: riskResult.volatility != null ? fmtPct(riskResult.volatility) : '─', c: BLUE },
                ].map(item => (
                  <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px' }}>
                    <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 1 }}>{item.l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 3 }}>{item.v}</div>
                  </div>
                ))}
              </div>

              {/* Marginal contributions */}
              {riskResult.marginal_contributions && (
                <div style={pnl}>
                  <div style={hdr}><span>MARGINAL RISK CONTRIBUTIONS</span></div>
                  <div style={{ padding: '10px 14px' }}>
                    {Object.entries(riskResult.marginal_contributions)
                      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                      .map(([sym, mc]) => {
                        const maxMC = Math.max(...Object.values(riskResult.marginal_contributions!).map(Math.abs));
                        return (
                          <div key={sym} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                              <span style={{ color: AMBER, fontFamily: MONO }}>{sym}</span>
                              <span style={{ color: mc > 0 ? RED : GREEN, fontFamily: MONO }}>{(mc * 100).toFixed(3)}%</span>
                            </div>
                            <div style={{ height: 5, background: 'rgba(30,30,46,0.7)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(Math.abs(mc) / maxMC) * 100}%`, background: mc > 0 ? RED : GREEN, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Correlation matrix */}
              {riskResult.correlation_matrix && (
                <div style={pnl}>
                  <div style={hdr}><span>CORRELATION MATRIX</span></div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, textAlign: 'left' }}>{'  '}</th>
                          {Object.keys(riskResult.correlation_matrix).map(s => (
                            <th key={s} style={th}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(riskResult.correlation_matrix).map(([row, cols], i) => (
                          <tr key={row} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{row}</td>
                            {Object.values(cols).map((val, j) => (
                              <CorrCell key={j} val={val as number} />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ ATTRIBUTION TAB ══════════════════════════════════ */}
      {tab === 'ATTRIBUTION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pnl}>
            <div style={hdr}><span>BRINSON-HOOD-BEEBOWER ATTRIBUTION</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 9, color: AMBER, fontWeight: 700 }}>PORTFOLIO</div>
                  <Field label="SYMBOLS" value={attrPortSymbols} onChange={setAttrPortSymbols} w={260} />
                  <Field label="WEIGHTS (SUM TO 1.0)" value={attrPortWeights} onChange={setAttrPortWeights} w={260} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, fontWeight: 700 }}>BENCHMARK</div>
                  <Field label="SYMBOLS" value={attrBenchSymbols} onChange={setAttrBenchSymbols} w={260} />
                  <Field label="WEIGHTS (SUM TO 1.0)" value={attrBenchWeights} onChange={setAttrBenchWeights} w={260} />
                </div>
              </div>
              <RunBtn label="RUN ATTRIBUTION" loading={loadingA} onClick={runAttribution} />
              <ErrBox msg={attrError} />
            </div>
          </div>

          {attrResult && (
            <>
              {/* Top-level results */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { l: 'PORTFOLIO RETURN', v: attrResult.total_return != null ? fmtPct(attrResult.total_return) : '─', c: clr(attrResult.total_return ?? 0) },
                  { l: 'BENCHMARK RETURN', v: attrResult.benchmark_return != null ? fmtPct(attrResult.benchmark_return) : '─', c: BLUE },
                  { l: 'ACTIVE RETURN', v: attrResult.active_return != null ? fmtPct(attrResult.active_return) : '─', c: clr(attrResult.active_return ?? 0) },
                  { l: 'ALLOCATION EFFECT', v: attrResult.allocation_effect != null ? fmtPct(attrResult.allocation_effect) : '─', c: AMBER },
                  { l: 'SELECTION EFFECT', v: attrResult.selection_effect != null ? fmtPct(attrResult.selection_effect) : '─', c: PURPLE },
                ].map(item => (
                  <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px' }}>
                    <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 1 }}>{item.l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 3 }}>{item.v}</div>
                  </div>
                ))}
              </div>

              {/* Sector breakdown */}
              {attrResult.sector_breakdown && (
                <div style={pnl}>
                  <div style={hdr}><span>SECTOR ATTRIBUTION BREAKDOWN</span></div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SECTOR / ASSET</th>
                        <th style={th}>ALLOCATION</th>
                        <th style={th}>SELECTION</th>
                        <th style={th}>INTERACTION</th>
                        <th style={th}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(attrResult.sector_breakdown).map(([sec, v], i) => {
                        const total = (v.allocation ?? 0) + (v.selection ?? 0) + (v.interaction ?? 0);
                        return (
                          <tr key={sec} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: AMBER }}>{sec}</td>
                            <td style={{ ...td, color: clr(v.allocation ?? 0) }}>{fmtPct(v.allocation ?? 0)}</td>
                            <td style={{ ...td, color: clr(v.selection ?? 0) }}>{fmtPct(v.selection ?? 0)}</td>
                            <td style={{ ...td, color: clr(v.interaction ?? 0) }}>{fmtPct(v.interaction ?? 0)}</td>
                            <td style={{ ...td, color: clr(total), fontWeight: 700 }}>{fmtPct(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ REBALANCE TAB ════════════════════════════════════ */}
      {tab === 'REBALANCE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pnl}>
            <div style={hdr}><span>REBALANCE CALCULATOR</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="SYMBOLS (COMMA-SEPARATED)" value={rebalSymbols} onChange={setRebalSymbols} w={280} />
                <Field label="TARGET WEIGHTS (SUM TO 1.0)" value={rebalTargets} onChange={setRebalTargets} w={220} />
                <Field label="PORTFOLIO VALUE ($)" value={portfolioValue} onChange={setPortfolioValue} w={140} />
                <RunBtn label="COMPUTE REBALANCE" loading={loadingReb} onClick={runRebalance} />
              </div>
              <ErrBox msg={rebalError} />
            </div>
          </div>

          {rebalResult && (
            <>
              {/* Weight drift table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={pnl}>
                  <div style={hdr}><span>WEIGHT DRIFT MONITOR</span></div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                        <th style={th}>CURRENT</th>
                        <th style={th}>TARGET</th>
                        <th style={th}>DRIFT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(rebalResult.target_weights).map((sym, i) => {
                        const cur = rebalResult.current_weights[sym] ?? 0;
                        const tgt = rebalResult.target_weights[sym] ?? 0;
                        const drift = cur - tgt;
                        return (
                          <tr key={sym} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{sym}</td>
                            <td style={td}>{(cur * 100).toFixed(1)}%</td>
                            <td style={{ ...td, color: TEXT }}>{(tgt * 100).toFixed(1)}%</td>
                            <td style={{ ...td, color: Math.abs(drift) > 0.05 ? RED : Math.abs(drift) > 0.02 ? AMBER : GREEN, fontWeight: 700 }}>
                              {drift >= 0 ? '+' : ''}{(drift * 100).toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rebalResult.turnover != null && (
                    <div style={{ padding: '6px 12px', borderTop: `1px solid ${BORDER}`, fontSize: 10 }}>
                      Portfolio Turnover: <span style={{ color: AMBER, fontFamily: MONO }}>{fmtPct(rebalResult.turnover)}</span>
                    </div>
                  )}
                </div>

                {/* Trade list */}
                <div style={pnl}>
                  <div style={hdr}><span>REBALANCE TRADES</span></div>
                  {rebalResult.trades.length === 0
                    ? <div style={{ padding: '20px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>Portfolio already balanced</div>
                    : <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                            <th style={th}>ACTION</th>
                            <th style={th}>SHARES</th>
                            <th style={th}>NOTIONAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rebalResult.trades.map((t, i) => (
                            <tr key={t.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.025)' : 'transparent' }}>
                              <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{t.symbol}</td>
                              <td style={{ ...td, color: t.direction === 'BUY' ? GREEN : RED, fontWeight: 700 }}>
                                {t.direction}
                              </td>
                              <td style={td}>{Math.abs(t.shares)}</td>
                              <td style={{ ...td, color: BLUE }}>{fmtK(Math.abs(t.value))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  }
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div data-testid="portfolio-ready" style={{ display: 'none' }} />
    </div>
  );
}

