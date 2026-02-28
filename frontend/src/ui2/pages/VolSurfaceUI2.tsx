import React, { useState, useEffect, useCallback } from 'react';
﻿/**
 * VolSurfaceUI2 â€” Bloomberg OVML-grade Volatility Surface Terminal
 * Tabs: IV SURFACE | TERM STRUCTURE | SKEW | SCANNER | HISTORY
 * Real API: /api/v4/vol-surface/* | /api/v4/options/chain
 * Full inline Bloomberg styling â€” no ui2/components dependency
 */

// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

// â”€â”€â”€ Shared micro-styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const card: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' };
const hdr: React.CSSProperties = {
  padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`,
  fontSize: 10, color: SUBTLE, fontWeight: 700, letterSpacing: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const th: React.CSSProperties = {
  padding: '4px 8px', fontSize: 9, color: SUBTLE, fontFamily: MONO,
  fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '3px 8px', fontSize: 10, fontFamily: MONO,
  textAlign: 'right', borderBottom: `1px solid #0f0f0f`,
};
const inp: React.CSSProperties = {
  background: '#131313', border: `1px solid ${BORDER}`, borderRadius: 3,
  color: TEXT, fontFamily: MONO, fontSize: 10, padding: '4px 8px', outline: 'none',
};

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface IVPoint { strike: number; expiry: string; iv: number; delta?: number; gamma?: number; vega?: number; }
interface TermPoint { expiry: string; dte: number; atm_iv: number; skew?: number; rr25?: number; fly25?: number; }
interface SkewPoint { strike: number; delta?: number; call_iv?: number; put_iv?: number; iv?: number; moneyness?: number; }
interface VolScanRow { symbol: string; atm_iv: number; iv_rank?: number; iv_percentile?: number; hv_30?: number; iv_hv_ratio?: number; skew?: number; term_slope?: number; }

// â”€â”€â”€ IV Cell with heatmap coloring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IVCell: React.FC<{ iv: number; min: number; max: number }> = ({ iv, min, max }) => {
  const pct = max > min ? (iv - min) / (max - min) : 0;
  // Low IV = blue/green, high IV = amber/red
  const bg = pct > 0.7 ? `rgba(239,83,80,${0.1 + pct * 0.5})`
    : pct > 0.4 ? `rgba(245,166,35,${0.1 + pct * 0.4})`
    : `rgba(66,165,245,${0.05 + (1 - pct) * 0.15})`;
  const color = pct > 0.6 ? TEXT : SUBTLE;
  return <td style={{ ...td, background: bg, color, fontWeight: pct > 0.7 ? 700 : 400 }}>
    {(iv * 100).toFixed(1)}%
  </td>;
};

// â”€â”€â”€ Term structure SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TermStrucSVG: React.FC<{ points: TermPoint[] }> = ({ points }) => {
  if (points.length < 2) return <div style={{ color: SUBTLE, fontSize: 10, padding: 10 }}>Insufficient data</div>;
  const W = 500, H = 140, PAD = 35;
  const xs = points.map(p => p.dte), ys = points.map(p => p.atm_iv * 100);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys) * 0.9, maxY = Math.max(...ys) * 1.1;
  const px = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - PAD * 2);
  const py = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  const pts = points.map(p => `${px(p.dte).toFixed(1)},${py(p.atm_iv * 100).toFixed(1)}`).join(' ');
  // Y-axis grid
  const gridYs = [minY, minY + (maxY - minY) / 2, maxY];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {gridYs.map((y, i) => (
        <React.Fragment key={i}>
          <line x1={PAD} y1={py(y)} x2={W - PAD} y2={py(y)} stroke={BORDER} strokeWidth={1} strokeDasharray="3,3" />
          <text x={PAD - 3} y={py(y) + 3} fontSize={8} fill={SUBTLE} textAnchor="end" fontFamily={MONO}>{y.toFixed(1)}%</text>
        </React.Fragment>
      ))}
      <polyline points={pts} fill="none" stroke={AMBER} strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={px(p.dte)} cy={py(p.atm_iv * 100)} r={3} fill={AMBER} />
      ))}
      {/* X axis labels */}
      {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 5)) === 0).map((p, i) => (
        <text key={i} x={px(p.dte)} y={H - 5} fontSize={8} fill={SUBTLE} textAnchor="middle" fontFamily={MONO}>
          {p.dte}d
        </text>
      ))}
      <text x={W / 2} y={H - 16} fontSize={8} fill={SUBTLE} textAnchor="middle" fontFamily={MONO}>DAYS TO EXPIRY</text>
      <text x={8} y={H / 2} fontSize={8} fill={AMBER} textAnchor="middle" fontFamily={MONO}
        transform={`rotate(-90,8,${H/2})`}>ATM IV</text>
    </svg>
  );
};

// â”€â”€â”€ Skew SVG (smile chart) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SkewSVG: React.FC<{ points: SkewPoint[] }> = ({ points }) => {
  const valid = points.filter(p => p.iv != null && p.moneyness != null);
  if (valid.length < 3) return <div style={{ color: SUBTLE, fontSize: 10, padding: 10 }}>Insufficient skew data</div>;
  const W = 500, H = 140, PAD = 35;
  const xs = valid.map(p => p.moneyness!), ys = valid.map(p => p.iv! * 100);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys) * 0.95, maxY = Math.max(...ys) * 1.05;
  const px = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - PAD * 2);
  const py = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  const pts = [...valid].sort((a, b) => a.moneyness! - b.moneyness!).map(p => `${px(p.moneyness!).toFixed(1)},${py(p.iv! * 100).toFixed(1)}`).join(' ');
  // ATM line at moneyness = 1
  const atmX = px(1.0);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <line x1={atmX} y1={PAD} x2={atmX} y2={H - PAD} stroke={GREEN} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
      <text x={atmX + 3} y={PAD + 10} fontSize={8} fill={GREEN} fontFamily={MONO}>ATM</text>
      <polyline points={pts} fill="none" stroke={PURPLE} strokeWidth={2} />
      {valid.map((p, i) => (
        <circle key={i} cx={px(p.moneyness!)} cy={py(p.iv! * 100)} r={2.5} fill={PURPLE} />
      ))}
      <text x={W / 2} y={H - 5} fontSize={8} fill={SUBTLE} textAnchor="middle" fontFamily={MONO}>MONEYNESS (K/S)</text>
      <text x={8} y={H / 2} fontSize={8} fill={PURPLE} textAnchor="middle" fontFamily={MONO}
        transform={`rotate(-90,8,${H/2})`}>IV</text>
    </svg>
  );
};

// â”€â”€â”€ IV Rank Gauge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IVRankGauge: React.FC<{ rank: number; label: string }> = ({ rank, label }) => {
  const color = rank > 70 ? RED : rank > 40 ? AMBER : GREEN;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
        <span style={{ color: SUBTLE }}>{label}</span>
        <span style={{ color, fontFamily: MONO, fontWeight: 700 }}>{rank.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rank}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
};

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS = ['IV SURFACE', 'TERM STRUCTURE', 'SKEW', 'SCANNER', 'HISTORY'] as const;
type Tab = typeof TABS[number];

export function VolSurfaceUI2() {
  const [tab, setTab] = useState<Tab>('IV SURFACE');
  const [symbol, setSymbol] = useState('AAPL');
  const [symbol2, setSymbol2] = useState('AAPL');

  // IV surface state
  const [surface, setSurface] = useState<IVPoint[]>([]);
  const [loadingSurf, setLoadingSurf] = useState(false);
  const [surfError, setSurfError] = useState('');
  const [spotPrice, setSpotPrice] = useState(0);

  // Term structure state
  const [termPoints, setTermPoints] = useState<TermPoint[]>([]);
  const [loadingTerm, setLoadingTerm] = useState(false);
  const [termError, setTermError] = useState('');

  // Skew state
  const [skewPoints, setSkewPoints] = useState<SkewPoint[]>([]);
  const [skewExpiry, setSkewExpiry] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [loadingSkew, setLoadingSkew] = useState(false);
  const [skewError, setSkewError] = useState('');

  // Scanner state
  const [scanSymbols, setScanSymbols] = useState('AAPL,MSFT,NVDA,TSLA,AMZN,META,GOOGL,SPY,QQQ,GLD');
  const [scanData, setScanData] = useState<VolScanRow[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanSort, setScanSort] = useState<keyof VolScanRow>('iv_rank');

  // History state
  const [histData, setHistData] = useState<{ date: string; iv: number; rv: number }[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [histError, setHistError] = useState('');

  // â”€â”€ Fetch IV surface â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadSurface = useCallback(async () => {
    setLoadingSurf(true); setSurfError('');
    try {
      const r = await fetch(`/api/v4/vol-surface/current/${symbol.toUpperCase()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSurface((d.surface ?? d.points ?? []) as IVPoint[]);
      setSpotPrice(d.spot_price ?? d.spot ?? 0);
      // Extract unique expiries for skew tab
      const exps: string[] = [...new Set((d.surface ?? d.points ?? []).map((p: IVPoint) => p.expiry))].sort() as string[];
      setExpiries(exps);
      if (exps.length > 0 && !skewExpiry) setSkewExpiry(exps[0]);
    } catch (e) { setSurfError(String(e)); setSurface([]); }
    finally { setLoadingSurf(false); }
  }, [symbol, skewExpiry]);

  // â”€â”€ Fetch term structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadTermStructure = useCallback(async () => {
    setLoadingTerm(true); setTermError('');
    try {
      const r = await fetch(`/api/v4/vol-surface/term-structure/${symbol.toUpperCase()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const pts = (d.term_structure ?? d.points ?? []) as TermPoint[];
      pts.sort((a, b) => (a.dte ?? 0) - (b.dte ?? 0));
      setTermPoints(pts);
    } catch (e) { setTermError(String(e)); setTermPoints([]); }
    finally { setLoadingTerm(false); }
  }, [symbol]);

  // â”€â”€ Fetch skew â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadSkew = useCallback(async () => {
    setLoadingSkew(true); setSkewError('');
    try {
      const url = skewExpiry
        ? `/api/v4/vol-surface/skew/${symbol.toUpperCase()}?expiry=${skewExpiry}`
        : `/api/v4/vol-surface/skew/${symbol.toUpperCase()}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const pts = (d.skew ?? d.points ?? []) as SkewPoint[];
      // Compute moneyness if not provided
      pts.forEach(p => {
        if (p.moneyness == null && spotPrice > 0) p.moneyness = p.strike / spotPrice;
      });
      setSkewPoints(pts.sort((a, b) => (a.strike ?? 0) - (b.strike ?? 0)));
    } catch (e) { setSkewError(String(e)); setSkewPoints([]); }
    finally { setLoadingSkew(false); }
  }, [symbol, skewExpiry, spotPrice]);

  // â”€â”€ Fetch scanner data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadScanner = useCallback(async () => {
    setLoadingScan(true);
    const syms = scanSymbols.split(',').map(s => s.trim()).filter(Boolean);
    const results: VolScanRow[] = [];
    await Promise.allSettled(syms.map(async sym => {
      try {
        const r = await fetch(`/api/v4/vol-surface/current/${sym.toUpperCase()}`);
        if (!r.ok) return;
        const d = await r.json();
        results.push({
          symbol: sym, atm_iv: d.atm_iv ?? 0,
          iv_rank: d.iv_rank ?? 0, iv_percentile: d.iv_percentile ?? 0,
          hv_30: d.hv_30 ?? 0,
          iv_hv_ratio: d.atm_iv && d.hv_30 ? d.atm_iv / d.hv_30 : 0,
          skew: d.skew_slope ?? 0, term_slope: d.term_slope ?? 0,
        });
      } catch { /* ignore */ }
    }));
    setScanData(results);
    setLoadingScan(false);
  }, [scanSymbols]);

  // â”€â”€ Fetch historical IV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadHistory = useCallback(async () => {
    setLoadingHist(true); setHistError('');
    try {
      const r = await fetch(`/api/v4/vol-surface/historical/${symbol2.toUpperCase()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setHistData((d.history ?? d.data ?? []) as { date: string; iv: number; rv: number }[]);
    } catch (e) { setHistError(String(e)); setHistData([]); }
    finally { setLoadingHist(false); }
  }, [symbol2]);

  // â”€â”€ On tab change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (tab === 'IV SURFACE') loadSurface();
    if (tab === 'TERM STRUCTURE') loadTermStructure();
    if (tab === 'SKEW') loadSkew();
    if (tab === 'SCANNER') loadScanner();
    if (tab === 'HISTORY') loadHistory();
  }, [tab]);

  // â”€â”€ Derived surface data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const expiryCols = [...new Set(surface.map(p => p.expiry))].sort();
  const strikeRows = [...new Set(surface.map(p => p.strike))].sort((a, b) => a - b);
  const ivMap: Record<string, Record<number, number>> = {};
  surface.forEach(p => { if (!ivMap[p.expiry]) ivMap[p.expiry] = {}; ivMap[p.expiry][p.strike] = p.iv; });
  const allIVs = surface.map(p => p.iv).filter(v => v > 0);
  const minIV = allIVs.length ? Math.min(...allIVs) : 0;
  const maxIV = allIVs.length ? Math.max(...allIVs) : 1;

  // Sorted scanner data
  const sortedScan = [...scanData].sort((a, b) => {
    const av = a[scanSort] as number ?? 0, bv = b[scanSort] as number ?? 0;
    return bv - av;
  });

  // â”€â”€ Tab styling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', background: tab === t ? '#141414' : 'transparent',
    color: tab === t ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`,
    letterSpacing: 1,
  });

  // â”€â”€ Symbol input field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SymbolBar: React.FC<{ val: string; set: (v: string) => void; onLoad: () => void; loading: boolean; label?: string }> = ({
    val, set, onLoad, loading, label = 'SYMBOL',
  }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
      <div>
        <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3, letterSpacing: 1 }}>{label}</label>
        <input value={val} onChange={e => set(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && onLoad()}
          style={{ ...inp, width: 100, textTransform: 'uppercase' }} placeholder="AAPL" />
      </div>
      <button onClick={onLoad} disabled={loading} style={{
        padding: '5px 14px', border: `1px solid ${loading ? BORDER : AMBER}`,
        background: loading ? '#111' : '#1a1200', color: loading ? SUBTLE : AMBER,
        fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        borderRadius: 3,
      }}>{loading ? 'LOADINGâ€¦' : 'LOAD'}</button>
      {spotPrice > 0 && tab === 'IV SURFACE' && (
        <span style={{ fontSize: 10, color: SUBTLE }}>Spot: <span style={{ color: TEXT, fontFamily: MONO }}>${spotPrice.toFixed(2)}</span></span>
      )}
    </div>
  );

  return (
    <div data-testid="vol-surface-page" data-ready="true"
      style={{ height: '100%', overflow: 'auto', background: BG, padding: '10px 14px', fontFamily: MONO, color: TEXT }}>

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>
          VOLATILITY SURFACE TERMINAL
        </span>
        <span style={{ fontSize: 9, color: SUBTLE, marginLeft: 12 }}>OPTIONS MARKET ANALYTICS</span>
      </div>

      {/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
        {TABS.map(t => <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• IV SURFACE TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'IV SURFACE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SymbolBar val={symbol} set={setSymbol} onLoad={loadSurface} loading={loadingSurf} />
          {surfError && <div style={{ padding: '6px 10px', background: '#1a0505', border: `1px solid ${RED}3`, borderRadius: 3, color: RED, fontSize: 10 }}>{surfError}</div>}

          {surface.length > 0 ? (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {[
                  { l: 'ATM IV (NEAR)', v: allIVs.length ? `${(((surface.find(p => p.expiry === expiryCols[0] && Math.abs(p.strike - spotPrice) < spotPrice * 0.02)?.iv) ?? allIVs[0]) * 100).toFixed(1)}%` : 'â”€', c: AMBER },
                  { l: 'IV RANGE', v: `${(minIV * 100).toFixed(1)}% â€“ ${(maxIV * 100).toFixed(1)}%`, c: TEXT },
                  { l: 'STRIKES', v: strikeRows.length.toString(), c: BLUE },
                  { l: 'EXPIRIES', v: expiryCols.length.toString(), c: BLUE },
                  { l: 'SPOT PRICE', v: spotPrice > 0 ? `$${spotPrice.toFixed(2)}` : 'â”€', c: TEXT },
                ].map(item => (
                  <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
                    <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 1 }}>{item.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 2 }}>{item.v}</div>
                  </div>
                ))}
              </div>

              {/* IV Matrix heatmap */}
              <div style={{ ...card, overflowX: 'auto' }}>
                <div style={hdr}><span>IMPLIED VOLATILITY MATRIX (%) â€” HEATMAP</span></div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left', minWidth: 70 }}>STRIKE</th>
                      {expiryCols.map(exp => <th key={exp} style={th}>{exp}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {strikeRows.map((strike, i) => {
                      const isATM = spotPrice > 0 && Math.abs(strike - spotPrice) / spotPrice < 0.02;
                      return (
                        <tr key={strike} style={{ background: isATM ? '#0d1200' : i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: isATM ? AMBER : TEXT, fontWeight: isATM ? 700 : 400 }}>
                            {isATM && <span style={{ color: AMBER, marginRight: 3 }}>â–¶</span>}
                            {strike}
                          </td>
                          {expiryCols.map(exp => {
                            const iv = ivMap[exp]?.[strike];
                            return iv != null
                              ? <IVCell key={exp} iv={iv} min={minIV} max={maxIV} />
                              : <td key={exp} style={{ ...td, color: SUBTLE }}>â”€</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
              {loadingSurf ? 'Fetching IV surface dataâ€¦' : 'Enter a symbol and click LOAD to fetch the volatility surface'}
            </div>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• TERM STRUCTURE TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'TERM STRUCTURE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SymbolBar val={symbol} set={setSymbol} onLoad={loadTermStructure} loading={loadingTerm} />
          {termError && <div style={{ color: RED, fontSize: 10 }}>{termError}</div>}

          {termPoints.length > 0 ? (
            <>
              <div style={card}>
                <div style={hdr}><span>ATM IV TERM STRUCTURE â€” {symbol.toUpperCase()}</span></div>
                <div style={{ padding: '10px 14px' }}>
                  <TermStrucSVG points={termPoints} />
                </div>
              </div>

              <div style={card}>
                <div style={hdr}><span>TERM STRUCTURE TABLE</span></div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>EXPIRY</th>
                      <th style={th}>DTE</th>
                      <th style={th}>ATM IV</th>
                      <th style={th}>SKEW</th>
                      <th style={th}>25d RR</th>
                      <th style={th}>25d FLY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termPoints.map((p, i) => (
                      <tr key={p.expiry} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                        <td style={{ ...td, textAlign: 'left', color: AMBER }}>{p.expiry}</td>
                        <td style={{ ...td, color: TEXT }}>{p.dte}</td>
                        <td style={{ ...td, color: p.atm_iv > 0.3 ? RED : p.atm_iv > 0.2 ? AMBER : GREEN, fontWeight: 700 }}>
                          {(p.atm_iv * 100).toFixed(1)}%
                        </td>
                        <td style={{ ...td, color: (p.skew ?? 0) < 0 ? RED : SUBTLE }}>
                          {p.skew != null ? (p.skew * 100).toFixed(2) : 'â”€'}
                        </td>
                        <td style={{ ...td, color: (p.rr25 ?? 0) < 0 ? RED : GREEN }}>
                          {p.rr25 != null ? (p.rr25 * 100).toFixed(2) : 'â”€'}
                        </td>
                        <td style={td}>{p.fly25 != null ? (p.fly25 * 100).toFixed(2) : 'â”€'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Contango/Backwardation detection */}
              {termPoints.length >= 2 && (
                <div style={card}>
                  <div style={hdr}><span>TERM STRUCTURE ANALYSIS</span></div>
                  <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {(() => {
                      const slope = termPoints.length >= 2
                        ? (termPoints[termPoints.length - 1].atm_iv - termPoints[0].atm_iv) / (termPoints[termPoints.length - 1].dte - termPoints[0].dte)
                        : 0;
                      const shape = slope > 0.0002 ? 'CONTANGO' : slope < -0.0002 ? 'BACKWARDATION' : 'FLAT';
                      const shapeColor = shape === 'CONTANGO' ? GREEN : shape === 'BACKWARDATION' ? RED : SUBTLE;
                      return [
                        { l: 'TERM SHAPE', v: shape, c: shapeColor },
                        { l: 'FRONT IV', v: `${(termPoints[0]?.atm_iv * 100).toFixed(1)}%`, c: AMBER },
                        { l: 'BACK IV', v: `${(termPoints[termPoints.length - 1]?.atm_iv * 100).toFixed(1)}%`, c: BLUE },
                        { l: 'SLOPE (IV/DTE)', v: `${(slope * 1000).toFixed(3)}`, c: TEXT },
                      ].map(item => (
                        <div key={item.l} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '7px 10px' }}>
                          <div style={{ fontSize: 8, color: SUBTLE }}>{item.l}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 2 }}>{item.v}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
              {loadingTerm ? 'Fetching term structureâ€¦' : 'Enter a symbol and click LOAD'}
            </div>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• SKEW TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'SKEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <SymbolBar val={symbol} set={setSymbol} onLoad={loadSkew} loading={loadingSkew} />
            {expiries.length > 0 && (
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>EXPIRY</label>
                <select value={skewExpiry} onChange={e => setSkewExpiry(e.target.value)}
                  style={{ ...inp, cursor: 'pointer', width: 120 }}>
                  {expiries.map(exp => <option key={exp} value={exp}>{exp}</option>)}
                </select>
              </div>
            )}
          </div>
          {skewError && <div style={{ color: RED, fontSize: 10 }}>{skewError}</div>}

          {skewPoints.length > 0 ? (
            <>
              <div style={card}>
                <div style={hdr}><span>VOLATILITY SMILE â€” {symbol.toUpperCase()} {skewExpiry}</span></div>
                <div style={{ padding: '10px 14px' }}>
                  <SkewSVG points={skewPoints} />
                </div>
              </div>

              {/* Skew metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(() => {
                  const sorted = [...skewPoints].sort((a, b) => (a.moneyness ?? a.strike ?? 0) - (b.moneyness ?? b.strike ?? 0));
                  const atmIdx = sorted.findIndex(p => (p.moneyness ?? 1) >= 1);
                  const atmIV = sorted[atmIdx]?.iv ?? 0;
                  const otmPutIV = sorted[0]?.iv ?? 0;
                  const otmCallIV = sorted[sorted.length - 1]?.iv ?? 0;
                  const putCallSkew = otmPutIV - otmCallIV;
                  return [
                    { l: 'ATM IV', v: `${(atmIV * 100).toFixed(1)}%`, c: AMBER },
                    { l: 'OTM PUT IV', v: `${(otmPutIV * 100).toFixed(1)}%`, c: RED },
                    { l: 'OTM CALL IV', v: `${(otmCallIV * 100).toFixed(1)}%`, c: GREEN },
                    { l: 'PUT/CALL SKEW', v: `${(putCallSkew * 100).toFixed(1)}%`, c: putCallSkew > 0 ? RED : GREEN },
                  ].map(item => (
                    <div key={item.l} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px' }}>
                      <div style={{ fontSize: 8, color: SUBTLE }}>{item.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.c, fontFamily: MONO, marginTop: 2 }}>{item.v}</div>
                    </div>
                  ));
                })()}
              </div>

              <div style={card}>
                <div style={hdr}><span>SKEW TABLE</span></div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>STRIKE</th>
                        <th style={th}>MONEYNESS</th>
                        <th style={th}>DELTA</th>
                        <th style={th}>IV</th>
                        <th style={th}>CALL IV</th>
                        <th style={th}>PUT IV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skewPoints.map((p, i) => {
                        const isATM = spotPrice > 0 && Math.abs(p.strike - spotPrice) / spotPrice < 0.015;
                        return (
                          <tr key={p.strike} style={{ background: isATM ? '#0d1200' : i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: isATM ? AMBER : TEXT, fontWeight: isATM ? 700 : 400 }}>{p.strike}</td>
                            <td style={{ ...td, color: SUBTLE }}>{p.moneyness?.toFixed(3) ?? 'â”€'}</td>
                            <td style={{ ...td, color: BLUE }}>{p.delta?.toFixed(3) ?? 'â”€'}</td>
                            <td style={{ ...td, color: (p.iv ?? 0) > 0.3 ? RED : (p.iv ?? 0) > 0.2 ? AMBER : GREEN, fontWeight: 700 }}>
                              {p.iv != null ? `${(p.iv * 100).toFixed(1)}%` : 'â”€'}
                            </td>
                            <td style={td}>{p.call_iv != null ? `${(p.call_iv * 100).toFixed(1)}%` : 'â”€'}</td>
                            <td style={td}>{p.put_iv != null ? `${(p.put_iv * 100).toFixed(1)}%` : 'â”€'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
              {loadingSkew ? 'Fetching skew dataâ€¦' : 'Enter a symbol and click LOAD'}
            </div>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• SCANNER TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'SCANNER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>SCAN UNIVERSE</label>
              <input value={scanSymbols} onChange={e => setScanSymbols(e.target.value.toUpperCase())}
                style={{ ...inp, width: 400 }} placeholder="AAPL,MSFT,NVDA,â€¦" />
            </div>
            <button onClick={loadScanner} disabled={loadingScan} style={{
              padding: '5px 14px', border: `1px solid ${loadingScan ? BORDER : GREEN}`,
              background: loadingScan ? '#111' : '#001a0d', color: loadingScan ? SUBTLE : GREEN,
              fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: loadingScan ? 'not-allowed' : 'pointer', borderRadius: 3,
            }}>{loadingScan ? 'SCANNINGâ€¦' : 'SCAN'}</button>
          </div>

          {scanData.length > 0 && (
            <>
              {/* IV rank gauges for top 5 */}
              <div style={card}>
                <div style={hdr}><span>IV RANK â€” TOP 5</span></div>
                <div style={{ padding: '10px 14px' }}>
                  {[...scanData].sort((a, b) => (b.iv_rank ?? 0) - (a.iv_rank ?? 0)).slice(0, 5).map(row => (
                    <IVRankGauge key={row.symbol} label={row.symbol} rank={row.iv_rank ?? 0} />
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={hdr}>
                  <span>VOLATILITY SCANNER</span>
                  <span style={{ fontSize: 9, color: SUBTLE }}>click header to sort</span>
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                      {([
                        ['atm_iv', 'ATM IV'],
                        ['iv_rank', 'IV RANK'],
                        ['iv_percentile', 'IV %ILE'],
                        ['hv_30', 'HV30'],
                        ['iv_hv_ratio', 'IV/HV'],
                        ['skew', 'SKEW'],
                        ['term_slope', 'TERM SLP'],
                      ] as Array<[keyof VolScanRow, string]>).map(([col, label]) => (
                        <th key={col} style={{ ...th, cursor: 'pointer', color: scanSort === col ? AMBER : SUBTLE }}
                          onClick={() => setScanSort(col)}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScan.map((row, i) => (
                      <tr key={row.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                        <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{row.symbol}</td>
                        <td style={{ ...td, color: (row.atm_iv ?? 0) > 0.4 ? RED : (row.atm_iv ?? 0) > 0.25 ? AMBER : GREEN, fontWeight: 700 }}>
                          {row.atm_iv > 0 ? `${(row.atm_iv * 100).toFixed(1)}%` : 'â”€'}
                        </td>
                        <td style={{ ...td, color: (row.iv_rank ?? 0) > 70 ? RED : (row.iv_rank ?? 0) > 40 ? AMBER : GREEN }}>
                          {row.iv_rank != null ? `${row.iv_rank.toFixed(0)}%` : 'â”€'}
                        </td>
                        <td style={{ ...td, color: (row.iv_percentile ?? 0) > 70 ? RED : SUBTLE }}>
                          {row.iv_percentile != null ? `${row.iv_percentile.toFixed(0)}%` : 'â”€'}
                        </td>
                        <td style={td}>{row.hv_30 != null ? `${(row.hv_30 * 100).toFixed(1)}%` : 'â”€'}</td>
                        <td style={{ ...td, color: (row.iv_hv_ratio ?? 1) > 1.2 ? RED : (row.iv_hv_ratio ?? 1) < 0.8 ? GREEN : SUBTLE }}>
                          {row.iv_hv_ratio != null && row.iv_hv_ratio > 0 ? row.iv_hv_ratio.toFixed(2) : 'â”€'}
                        </td>
                        <td style={{ ...td, color: (row.skew ?? 0) < -0.02 ? RED : SUBTLE }}>
                          {row.skew != null ? row.skew.toFixed(3) : 'â”€'}
                        </td>
                        <td style={{ ...td, color: (row.term_slope ?? 0) < 0 ? RED : GREEN }}>
                          {row.term_slope != null ? row.term_slope.toFixed(4) : 'â”€'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• HISTORY TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {tab === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SymbolBar val={symbol2} set={setSymbol2} onLoad={loadHistory} loading={loadingHist} label="SYMBOL" />
          {histError && <div style={{ color: RED, fontSize: 10 }}>{histError}</div>}

          {histData.length > 0 ? (
            <>
              {/* IV vs RV chart */}
              <div style={card}>
                <div style={hdr}><span>HISTORICAL IV vs REALIZED VOL â€” {symbol2.toUpperCase()}</span></div>
                <div style={{ padding: '10px 14px' }}>
                  {(() => {
                    const W = 560, H = 150, PAD = 40;
                    const ivs = histData.map(d => d.iv * 100), rvs = histData.map(d => d.rv * 100);
                    const allVals = [...ivs, ...rvs].filter(v => v > 0);
                    if (!allVals.length) return <div style={{ color: SUBTLE, fontSize: 10 }}>No historical data</div>;
                    const minV = Math.min(...allVals) * 0.9, maxV = Math.max(...allVals) * 1.1;
                    const pxX = (i: number) => PAD + (i / (histData.length - 1)) * (W - PAD * 2);
                    const pxY = (v: number) => H - PAD - ((v - minV) / (maxV - minV || 1)) * (H - PAD * 2);
                    const ivPts = ivs.map((v, i) => `${pxX(i).toFixed(1)},${pxY(v).toFixed(1)}`).join(' ');
                    const rvPts = rvs.map((v, i) => `${pxX(i).toFixed(1)},${pxY(v).toFixed(1)}`).join(' ');
                    return (
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                        <polyline points={ivPts} fill="none" stroke={AMBER} strokeWidth={1.5} />
                        <polyline points={rvPts} fill="none" stroke={BLUE} strokeWidth={1.5} />
                        <circle cx={W - PAD + 10} cy={pxY((ivs[ivs.length - 1] ?? 0))} r={3} fill={AMBER} />
                        <circle cx={W - PAD + 10} cy={pxY((rvs[rvs.length - 1] ?? 0))} r={3} fill={BLUE} />
                        {/* Legend */}
                        <rect x={PAD} y={8} width={8} height={4} fill={AMBER} />
                        <text x={PAD + 12} y={14} fontSize={8} fill={AMBER} fontFamily={MONO}>IV (30d)</text>
                        <rect x={PAD + 65} y={8} width={8} height={4} fill={BLUE} />
                        <text x={PAD + 80} y={14} fontSize={8} fill={BLUE} fontFamily={MONO}>HV (30d)</text>
                      </svg>
                    );
                  })()}
                </div>
              </div>

              <div style={card}>
                <div style={hdr}><span>HISTORICAL VOL DATA TABLE</span></div>
                <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>DATE</th>
                        <th style={th}>IV (30d ATM)</th>
                        <th style={th}>HV (30d)</th>
                        <th style={th}>IV PREMIUM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...histData].reverse().slice(0, 60).map((d, i) => {
                        const premium = (d.iv - d.rv) * 100;
                        return (
                          <tr key={d.date} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: SUBTLE, fontSize: 9 }}>{d.date}</td>
                            <td style={{ ...td, color: AMBER, fontWeight: 700 }}>{(d.iv * 100).toFixed(1)}%</td>
                            <td style={{ ...td, color: BLUE }}>{(d.rv * 100).toFixed(1)}%</td>
                            <td style={{ ...td, color: premium > 0 ? RED : GREEN }}>
                              {premium >= 0 ? '+' : ''}{premium.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
              {loadingHist ? 'Fetching historical vol dataâ€¦' : 'Enter a symbol and click LOAD'}
            </div>
          )}
        </div>
      )}

      <div data-testid="vol-surface-ready" style={{ display: 'none' }} />
    </div>
  );
}
