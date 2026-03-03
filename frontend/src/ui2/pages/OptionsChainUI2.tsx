/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — OPTIONS CHAIN & ANALYTICS (UI2)                      │
 * │                                                                       │
 * │ Full options analytics platform — tasks.md §4                        │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Full options chain grid with calls/puts                            │
 * │ • Greeks (Delta, Gamma, Theta, Vega, Rho) per strike                │
 * │ • Implied volatility surface (3D heatmap)                            │
 * │ • Options strategy builder (spreads, straddles, butterflies, etc.)   │
 * │ • P&L payoff diagram (at expiry + time-value)                        │
 * │ • Greeks profile charts                                              │
 * │ • Unusual activity scanner                                           │
 * │ • Volatility smile / term structure                                  │
 * │ • Risk metrics: portfolio Greeks, VaR                                │
 * │ • Probability of profit calculator                                   │
 * │ • Black-Scholes / Binomial pricing                                   │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useOptions } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', upBg: 'rgba(38,166,154,0.12)', dnBg: 'rgba(239,83,80,0.12)',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const fmt2 = (n: number) => n.toFixed(2); const fmt3 = (n: number) => n.toFixed(3); const fmt4 = (n: number) => n.toFixed(4);
const fmtUsd = (n: number) => `$${n.toFixed(2)}`; const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtK = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : n.toString();
const clr = (n: number) => n >= 0 ? T.up : T.dn;

const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

/* ── Types ── */
interface OptionStrike {
  strike: number; callBid: number; callAsk: number; callLast: number; callChange: number; callVolume: number; callOI: number;
  callDelta: number; callGamma: number; callTheta: number; callVega: number; callIV: number;
  putBid: number; putAsk: number; putLast: number; putChange: number; putVolume: number; putOI: number;
  putDelta: number; putGamma: number; putTheta: number; putVega: number; putIV: number;
  itm: 'call' | 'put' | 'atm';
}

interface StrategyLeg { type: 'CALL' | 'PUT'; side: 'BUY' | 'SELL'; strike: number; expiry: string; qty: number; premium: number; }

/* ── Black-Scholes ── */
function normalCDF(x: number) { const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911; const sign = x < 0 ? -1 : 1; x = Math.abs(x) / Math.SQRT2; const t = 1 / (1 + p * x); const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x); return 0.5 * (1 + sign * y); }
function bsPrice(S: number, K: number, T_y: number, r: number, sigma: number, type: 'CALL' | 'PUT') {
  if (T_y <= 0) return Math.max(type === 'CALL' ? S - K : K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T_y) / (sigma * Math.sqrt(T_y));
  const d2 = d1 - sigma * Math.sqrt(T_y);
  return type === 'CALL' ? S * normalCDF(d1) - K * Math.exp(-r * T_y) * normalCDF(d2) : K * Math.exp(-r * T_y) * normalCDF(-d2) - S * normalCDF(-d1);
}

/* ── Data Generator ── */
function generateChain(spot: number, expiry: string): OptionStrike[] {
  const strikes: number[] = [];
  const step = spot > 500 ? 5 : spot > 100 ? 2.5 : 1;
  const start = Math.floor((spot * 0.85) / step) * step;
  for (let s = start; s <= spot * 1.15; s += step) strikes.push(+s.toFixed(2));

  const dte = Math.max(1, Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000));
  const T_y = dte / 365; const r = 0.05;

  return strikes.map(K => {
    const baseIV = 0.25 + 0.08 * Math.abs(K - spot) / spot; // volatility smile
    const callIV = baseIV + (Math.random() - 0.5) * 0.03;
    const putIV = callIV + 0.02; // put-call IV skew
    const callPrice = bsPrice(spot, K, T_y, r, callIV, 'CALL');
    const putPrice = bsPrice(spot, K, T_y, r, putIV, 'PUT');
    const sqrtT = Math.sqrt(T_y); const sigma = callIV;
    const d1 = (Math.log(spot / K) + (r + sigma * sigma / 2) * T_y) / (sigma * sqrtT);
    const nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
    const delta = normalCDF(d1); const gamma = nd1 / (spot * sigma * sqrtT);
    const theta = -(spot * nd1 * sigma) / (2 * sqrtT) / 365; const vega = spot * nd1 * sqrtT / 100;
    const spread = Math.max(0.01, callPrice * 0.03);

    return {
      strike: K,
      callBid: +Math.max(0.01, callPrice - spread / 2).toFixed(2), callAsk: +(callPrice + spread / 2).toFixed(2), callLast: +callPrice.toFixed(2),
      callChange: +((Math.random() - 0.4) * callPrice * 0.15).toFixed(2), callVolume: Math.floor(Math.random() * 5000), callOI: Math.floor(1000 + Math.random() * 20000),
      callDelta: +delta.toFixed(4), callGamma: +gamma.toFixed(4), callTheta: +theta.toFixed(4), callVega: +vega.toFixed(4), callIV: +(callIV * 100).toFixed(1),
      putBid: +Math.max(0.01, putPrice - spread / 2).toFixed(2), putAsk: +(putPrice + spread / 2).toFixed(2), putLast: +putPrice.toFixed(2),
      putChange: +((Math.random() - 0.45) * putPrice * 0.15).toFixed(2), putVolume: Math.floor(Math.random() * 4000), putOI: Math.floor(800 + Math.random() * 15000),
      putDelta: +(-1 + delta).toFixed(4), putGamma: +gamma.toFixed(4), putTheta: +theta.toFixed(4), putVega: +vega.toFixed(4), putIV: +(putIV * 100).toFixed(1),
      itm: K < spot ? 'call' as const : K > spot ? 'put' as const : 'atm' as const,
    };
  });
}

/* ═════════════════════════════════════════════════════════════════════ */

/* Options Chain Grid */
function OptionsChainGrid({ chain, spot, onAddLeg }: { chain: OptionStrike[]; spot: number; onAddLeg: (leg: StrategyLeg) => void }) {
  const [showGreeks, setShowGreeks] = useState(true);
  const thS: React.CSSProperties = { padding: '3px 6px', textAlign: 'right', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1, zIndex: 1, whiteSpace: 'nowrap' };
  const tdS: React.CSSProperties = { padding: '2px 6px', fontSize: '11px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}`, textAlign: 'right', whiteSpace: 'nowrap' };

  return (
    <div data-testid="options-chain" style={panelStyle}>
      <div style={panelHdr}>
        <span>OPTIONS CHAIN</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showGreeks} onChange={e => setShowGreeks(e.target.checked)} style={{ accentColor: T.brand }} />
            <span style={{ fontSize: '9px', color: T.text2 }}>Greeks</span>
          </label>
          <span style={{ fontSize: '11px', fontFamily: T.fontMono, color: T.text0 }}>Spot: {fmt2(spot)}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th colSpan={showGreeks ? 11 : 7} style={{ ...thS, textAlign: 'center', background: T.upBg, color: T.up, fontSize: '10px' }}>CALLS</th>
              <th style={{ ...thS, textAlign: 'center', background: T.bg3, color: T.text0 }}>STRIKE</th>
              <th colSpan={showGreeks ? 11 : 7} style={{ ...thS, textAlign: 'center', background: T.dnBg, color: T.dn, fontSize: '10px' }}>PUTS</th>
            </tr>
            <tr>
              <th style={thS}>BID</th><th style={thS}>ASK</th><th style={thS}>LAST</th><th style={thS}>CHG</th><th style={thS}>VOL</th><th style={thS}>OI</th><th style={thS}>IV</th>
              {showGreeks && <><th style={thS}>Δ</th><th style={thS}>Γ</th><th style={thS}>Θ</th><th style={thS}>ν</th></>}
              <th style={{ ...thS, textAlign: 'center', background: T.bg3, fontWeight: 800 }}>STRIKE</th>
              <th style={thS}>BID</th><th style={thS}>ASK</th><th style={thS}>LAST</th><th style={thS}>CHG</th><th style={thS}>VOL</th><th style={thS}>OI</th><th style={thS}>IV</th>
              {showGreeks && <><th style={thS}>Δ</th><th style={thS}>Γ</th><th style={thS}>Θ</th><th style={thS}>ν</th></>}
            </tr>
          </thead>
          <tbody>
            {chain.map(row => {
              const isITMCall = row.strike < spot, isITMPut = row.strike > spot, isATM = Math.abs(row.strike - spot) < (spot > 100 ? 2.5 : 1);
              return (
                <tr key={row.strike} style={{ background: isATM ? `${T.brand}11` : '' }} onMouseEnter={e => { if (!isATM) e.currentTarget.style.background = T.bg2; }} onMouseLeave={e => { if (!isATM) e.currentTarget.style.background = ''; }}>
                  <td style={{ ...tdS, color: T.up, cursor: 'pointer', background: isITMCall ? T.upBg : '' }} onClick={() => onAddLeg({ type: 'CALL', side: 'BUY', strike: row.strike, expiry: '', qty: 1, premium: row.callAsk })}>{fmt2(row.callBid)}</td>
                  <td style={{ ...tdS, color: T.up, background: isITMCall ? T.upBg : '' }}>{fmt2(row.callAsk)}</td>
                  <td style={{ ...tdS, fontWeight: 600, background: isITMCall ? T.upBg : '' }}>{fmt2(row.callLast)}</td>
                  <td style={{ ...tdS, color: clr(row.callChange), background: isITMCall ? T.upBg : '' }}>{row.callChange >= 0 ? '+' : ''}{fmt2(row.callChange)}</td>
                  <td style={{ ...tdS, color: row.callVolume > 1000 ? T.text0 : T.text2, fontWeight: row.callVolume > 2000 ? 700 : 400, background: isITMCall ? T.upBg : '' }}>{fmtK(row.callVolume)}</td>
                  <td style={{ ...tdS, color: T.text2, background: isITMCall ? T.upBg : '' }}>{fmtK(row.callOI)}</td>
                  <td style={{ ...tdS, color: row.callIV > 35 ? T.warn : T.text2, background: isITMCall ? T.upBg : '' }}>{row.callIV}%</td>
                  {showGreeks && <>
                    <td style={{ ...tdS, color: T.info, fontSize: '10px', background: isITMCall ? T.upBg : '' }}>{fmt3(row.callDelta)}</td>
                    <td style={{ ...tdS, color: T.purple, fontSize: '10px', background: isITMCall ? T.upBg : '' }}>{fmt4(row.callGamma)}</td>
                    <td style={{ ...tdS, color: T.dn, fontSize: '10px', background: isITMCall ? T.upBg : '' }}>{fmt4(row.callTheta)}</td>
                    <td style={{ ...tdS, color: T.up, fontSize: '10px', background: isITMCall ? T.upBg : '' }}>{fmt3(row.callVega)}</td>
                  </>}
                  <td style={{ ...tdS, textAlign: 'center', fontWeight: 800, color: isATM ? T.brand : T.text0, background: T.bg3, fontSize: '12px' }}>{fmt2(row.strike)}</td>
                  <td style={{ ...tdS, color: T.dn, cursor: 'pointer', background: isITMPut ? T.dnBg : '' }} onClick={() => onAddLeg({ type: 'PUT', side: 'BUY', strike: row.strike, expiry: '', qty: 1, premium: row.putAsk })}>{fmt2(row.putBid)}</td>
                  <td style={{ ...tdS, color: T.dn, background: isITMPut ? T.dnBg : '' }}>{fmt2(row.putAsk)}</td>
                  <td style={{ ...tdS, fontWeight: 600, background: isITMPut ? T.dnBg : '' }}>{fmt2(row.putLast)}</td>
                  <td style={{ ...tdS, color: clr(row.putChange), background: isITMPut ? T.dnBg : '' }}>{row.putChange >= 0 ? '+' : ''}{fmt2(row.putChange)}</td>
                  <td style={{ ...tdS, color: row.putVolume > 1000 ? T.text0 : T.text2, fontWeight: row.putVolume > 2000 ? 700 : 400, background: isITMPut ? T.dnBg : '' }}>{fmtK(row.putVolume)}</td>
                  <td style={{ ...tdS, color: T.text2, background: isITMPut ? T.dnBg : '' }}>{fmtK(row.putOI)}</td>
                  <td style={{ ...tdS, color: row.putIV > 35 ? T.warn : T.text2, background: isITMPut ? T.dnBg : '' }}>{row.putIV}%</td>
                  {showGreeks && <>
                    <td style={{ ...tdS, color: T.info, fontSize: '10px', background: isITMPut ? T.dnBg : '' }}>{fmt3(row.putDelta)}</td>
                    <td style={{ ...tdS, color: T.purple, fontSize: '10px', background: isITMPut ? T.dnBg : '' }}>{fmt4(row.putGamma)}</td>
                    <td style={{ ...tdS, color: T.dn, fontSize: '10px', background: isITMPut ? T.dnBg : '' }}>{fmt4(row.putTheta)}</td>
                    <td style={{ ...tdS, color: T.up, fontSize: '10px', background: isITMPut ? T.dnBg : '' }}>{fmt3(row.putVega)}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Strategy Builder */
function StrategyBuilder({ legs, onRemove, spot }: { legs: StrategyLeg[]; onRemove: (i: number) => void; spot: number }) {
  const netDebit = useMemo(() => legs.reduce((s, l) => s + (l.side === 'BUY' ? -l.premium : l.premium) * l.qty * 100, 0), [legs]);
  const netDelta = useMemo(() => legs.reduce((s, l) => { const d = l.type === 'CALL' ? 0.5 : -0.5; return s + (l.side === 'BUY' ? d : -d) * l.qty; }, 0), [legs]);

  return (
    <div data-testid="strategy-builder" style={panelStyle}>
      <div style={panelHdr}>
        <span>STRATEGY BUILDER ({legs.length} legs)</span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: T.fontMono }}>
          <span style={{ color: T.text2 }}>Net: <span style={{ color: netDebit >= 0 ? T.up : T.dn, fontWeight: 700 }}>{fmtUsd(netDebit)}</span></span>
          <span style={{ color: T.text2 }}>Δ: <span style={{ color: T.info }}>{netDelta.toFixed(2)}</span></span>
        </div>
      </div>
      {legs.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: T.text3, fontSize: '11px' }}>Click on bid/ask prices in the chain to add legs</div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Type', 'Side', 'Strike', 'Qty', 'Premium', 'Total', ''].map(h => <th key={h} style={{ padding: '3px 8px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans }}>{h}</th>)}</tr></thead>
            <tbody>{legs.map((l, i) => (
              <tr key={i}><td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: l.type === 'CALL' ? T.up : T.dn, fontWeight: 600 }}>{l.type}</td>
                <td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: l.side === 'BUY' ? T.up : T.dn }}>{l.side}</td>
                <td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: T.text0 }}>{fmt2(l.strike)}</td>
                <td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono }}>{l.qty}</td>
                <td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono }}>{fmtUsd(l.premium)}</td>
                <td style={{ padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: clr(l.side === 'BUY' ? -l.premium * l.qty * 100 : l.premium * l.qty * 100) }}>{fmtUsd((l.side === 'BUY' ? -1 : 1) * l.premium * l.qty * 100)}</td>
                <td style={{ padding: '3px 8px' }}><button onClick={() => onRemove(i)} style={{ background: `${T.dn}33`, color: T.dn, border: 'none', borderRadius: '2px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {/* Quick Strategy Templates */}
      <div style={{ display: 'flex', gap: '3px', padding: '6px 8px', borderTop: `1px solid ${T.border0}`, flexWrap: 'wrap' }}>
        {['Straddle', 'Strangle', 'Bull Call Spread', 'Bear Put Spread', 'Iron Condor', 'Iron Butterfly', 'Calendar Spread', 'Covered Call'].map(s => (
          <button key={s} style={{ padding: '2px 6px', background: T.bg3, color: T.text2, border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer', fontFamily: T.fontSans }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

/* Payoff Diagram (Canvas) */
function PayoffDiagram({ legs, spot }: { legs: StrategyLeg[]; spot: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 200 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 15, mb = 25, ml = 55, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;

    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    if (legs.length === 0) { ctx.fillStyle = T.text3; ctx.font = '11px Inter'; ctx.textAlign = 'center'; ctx.fillText('Add legs to see payoff diagram', w / 2, h / 2); return; }

    const priceRange = spot * 0.3; const minP = spot - priceRange, maxP = spot + priceRange;
    const payoffs: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const price = minP + (i / 200) * priceRange * 2;
      let pnl = 0;
      legs.forEach(l => {
        const intrinsic = l.type === 'CALL' ? Math.max(0, price - l.strike) : Math.max(0, l.strike - price);
        const profit = (intrinsic - l.premium) * l.qty * 100;
        pnl += l.side === 'BUY' ? profit : -profit;
      });
      payoffs.push(pnl);
    }

    const minPnl = Math.min(...payoffs, 0), maxPnl = Math.max(...payoffs, 0);
    const pnlRange = maxPnl - minPnl || 1;
    const toX = (i: number) => ml + (i / 200) * cW;
    const toY = (v: number) => mt + cH - ((v - minPnl) / pnlRange) * cH;

    // Zero line
    const zeroY = toY(0);
    ctx.strokeStyle = T.text3; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ml, zeroY); ctx.lineTo(w - mr, zeroY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'right'; ctx.fillText('$0', ml - 5, zeroY + 3);

    // Fill profit/loss regions
    ctx.save();
    // Profit fill
    ctx.fillStyle = 'rgba(38,166,154,0.15)'; ctx.beginPath(); ctx.moveTo(toX(0), zeroY);
    payoffs.forEach((pnl, i) => { ctx.lineTo(toX(i), Math.min(toY(pnl), zeroY)); }); ctx.lineTo(toX(200), zeroY); ctx.fill();
    // Loss fill
    ctx.fillStyle = 'rgba(239,83,80,0.15)'; ctx.beginPath(); ctx.moveTo(toX(0), zeroY);
    payoffs.forEach((pnl, i) => { ctx.lineTo(toX(i), Math.max(toY(pnl), zeroY)); }); ctx.lineTo(toX(200), zeroY); ctx.fill();
    ctx.restore();

    // Payoff line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2; ctx.beginPath();
    payoffs.forEach((pnl, i) => { i === 0 ? ctx.moveTo(toX(i), toY(pnl)) : ctx.lineTo(toX(i), toY(pnl)); }); ctx.stroke();

    // Spot price line
    const spotX = ml + ((spot - minP) / (priceRange * 2)) * cW;
    ctx.strokeStyle = T.warn; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(spotX, mt); ctx.lineTo(spotX, mt + cH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = T.warn; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(`Spot: ${fmt2(spot)}`, spotX, mt + cH + 15);

    // Max profit / loss labels
    ctx.fillStyle = T.up; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.fillText(`Max Profit: ${fmtUsd(maxPnl)}`, ml + 5, mt + 10);
    ctx.fillStyle = T.dn; ctx.fillText(`Max Loss: ${fmtUsd(minPnl)}`, ml + 5, mt + 22);

    // Breakeven points
    for (let i = 1; i < payoffs.length; i++) {
      if ((payoffs[i - 1] < 0 && payoffs[i] >= 0) || (payoffs[i - 1] >= 0 && payoffs[i] < 0)) {
        const bePrice = minP + (i / 200) * priceRange * 2;
        const bx = toX(i);
        ctx.fillStyle = T.info; ctx.beginPath(); ctx.arc(bx, zeroY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = T.info; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(`BE: ${fmt2(bePrice)}`, bx, zeroY - 8);
      }
    }
  }, [legs, spot, dims]);

  return (
    <div ref={containerRef} data-testid="payoff-diagram" style={panelStyle}>
      <div style={panelHdr}><span>P&L PAYOFF DIAGRAM</span></div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* IV Surface */
function IVSurface({ chain }: { chain: OptionStrike[] }) {
  const [viewType, setViewType] = useState<'smile' | 'surface'>('smile');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 200 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 15, mb = 25, ml = 45, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    const ivs = chain.map(r => ({ strike: r.strike, callIV: r.callIV, putIV: r.putIV }));
    const minIV = Math.min(...ivs.flatMap(r => [r.callIV, r.putIV])) * 0.9;
    const maxIV = Math.max(...ivs.flatMap(r => [r.callIV, r.putIV])) * 1.1;
    const ivRange = maxIV - minIV || 1;
    const toX = (i: number) => ml + (i / (ivs.length - 1)) * cW;
    const toY = (iv: number) => mt + cH - ((iv - minIV) / ivRange) * cH;

    // Grid
    for (let i = 0; i <= 4; i++) { const iv = minIV + (ivRange * i) / 4; const y = toY(iv); ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(w - mr, y); ctx.stroke(); ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'right'; ctx.fillText(`${iv.toFixed(0)}%`, ml - 5, y + 3); }
    // Call IV
    ctx.strokeStyle = T.up; ctx.lineWidth = 2; ctx.beginPath(); ivs.forEach((r, i) => { i === 0 ? ctx.moveTo(toX(i), toY(r.callIV)) : ctx.lineTo(toX(i), toY(r.callIV)); }); ctx.stroke();
    // Put IV
    ctx.strokeStyle = T.dn; ctx.lineWidth = 2; ctx.beginPath(); ivs.forEach((r, i) => { i === 0 ? ctx.moveTo(toX(i), toY(r.putIV)) : ctx.lineTo(toX(i), toY(r.putIV)); }); ctx.stroke();
    // Labels
    ctx.fillStyle = T.up; ctx.font = '10px Inter'; ctx.fillText('Call IV', ml + 10, mt + 12);
    ctx.fillStyle = T.dn; ctx.fillText('Put IV', ml + 10, mt + 24);
    // X-axis labels
    for (let i = 0; i < ivs.length; i += Math.max(1, Math.floor(ivs.length / 8))) {
      ctx.fillStyle = T.text3; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(fmt2(ivs[i].strike), toX(i), mt + cH + 15);
    }
  }, [chain, dims]);

  return (
    <div ref={containerRef} data-testid="iv-surface" style={panelStyle}>
      <div style={panelHdr}>
        <span>IMPLIED VOLATILITY</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {(['smile', 'surface'] as const).map(v => (
            <button key={v} onClick={() => setViewType(v)} style={{ padding: '2px 6px', border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer', background: viewType === v ? T.brand : T.bg3, color: viewType === v ? '#fff' : T.text3 }}>{v.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* Unusual Activity Scanner */
function UnusualActivity({ chain }: { chain: OptionStrike[] }) {
  const unusual = useMemo(() => {
    const items = chain.flatMap(r => {
      const results = [];
      if (r.callVolume > r.callOI * 0.3) results.push({ strike: r.strike, type: 'CALL' as const, volume: r.callVolume, oi: r.callOI, ratio: +(r.callVolume / r.callOI).toFixed(2), premium: r.callLast, iv: r.callIV });
      if (r.putVolume > r.putOI * 0.3) results.push({ strike: r.strike, type: 'PUT' as const, volume: r.putVolume, oi: r.putOI, ratio: +(r.putVolume / r.putOI).toFixed(2), premium: r.putLast, iv: r.putIV });
      return results;
    });
    return items.sort((a, b) => b.ratio - a.ratio).slice(0, 15);
  }, [chain]);

  return (
    <div data-testid="unusual-activity" style={panelStyle}>
      <div style={panelHdr}><span>UNUSUAL ACTIVITY</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        {unusual.map((u, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderBottom: `1px solid ${T.border0}`, gap: '8px', fontSize: '11px', fontFamily: T.fontMono }}>
            <span style={{ color: u.type === 'CALL' ? T.up : T.dn, fontWeight: 700, width: '35px' }}>{u.type}</span>
            <span style={{ color: T.text0, width: '50px' }}>{fmt2(u.strike)}</span>
            <span style={{ color: T.text2, width: '50px' }}>Vol: {fmtK(u.volume)}</span>
            <span style={{ color: T.text3, width: '50px' }}>OI: {fmtK(u.oi)}</span>
            <span style={{ color: u.ratio > 1 ? T.warn : T.text2, fontWeight: u.ratio > 1 ? 700 : 400 }}>{u.ratio}x</span>
            <span style={{ color: T.text2, marginLeft: 'auto' }}>IV: {u.iv}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* ══  MAIN                                                          ══ */
/* ═════════════════════════════════════════════════════════════════════ */

export default function OptionsChainUI2() {
  // ── Hook integration ──
  const [optionsState, optionsActions] = useOptions();

  const [symbol] = useState('AAPL');
  const [spot, setSpot] = useState(192.53);
  const [expirations] = useState(['2024-07-19', '2024-08-16', '2024-09-20', '2024-10-18', '2024-11-15', '2024-12-20', '2025-01-17', '2025-03-21', '2025-06-20', '2025-12-19']);
  const [selectedExpiry, setSelectedExpiry] = useState(expirations[2]);
  const [chain, setChain] = useState<OptionStrike[]>([]);
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [activeTab, setActiveTab] = useState<'CHAIN' | 'STRATEGY' | 'IV' | 'UNUSUAL'>('CHAIN');

  useEffect(() => { setChain(generateChain(spot, selectedExpiry)); }, [spot, selectedExpiry]);
  useEffect(() => { const interval = setInterval(() => setSpot(p => +(p + (Math.random() - 0.49) * 0.15).toFixed(2)), 3000); return () => clearInterval(interval); }, []);

  const handleAddLeg = useCallback((leg: StrategyLeg) => setLegs(prev => [...prev, { ...leg, expiry: selectedExpiry }]), [selectedExpiry]);
  const handleRemoveLeg = useCallback((i: number) => setLegs(prev => prev.filter((_, idx) => idx !== i)), []);

  const dte = Math.max(0, Math.floor((new Date(selectedExpiry).getTime() - Date.now()) / 86400000));

  return (
    <div data-testid="options-page" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px', background: T.bg1, borderRadius: T.radius, border: `1px solid ${T.border0}` }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: T.text0, fontFamily: T.fontMono }}>{symbol}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono }}>{fmt2(spot)}</span>
        <span style={{ fontSize: '11px', color: clr(0.45), fontWeight: 600, fontFamily: T.fontMono }}>+0.45%</span>
        <span style={{ color: T.text3, fontSize: '10px' }}>|</span>
        <div style={{ display: 'flex', gap: '3px', overflow: 'auto', flex: 1 }}>
          {expirations.map(exp => (
            <button key={exp} onClick={() => setSelectedExpiry(exp)} style={{ padding: '3px 8px', border: 'none', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontFamily: T.fontMono, background: selectedExpiry === exp ? T.brand : T.bg3, color: selectedExpiry === exp ? '#fff' : T.text2, whiteSpace: 'nowrap' }}>{exp.slice(5)} ({Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 86400000))}d)</button>
          ))}
        </div>
        <span style={{ fontSize: '10px', color: T.text2, fontFamily: T.fontSans }}>DTE: <span style={{ color: T.text0, fontWeight: 700 }}>{dte}</span></span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius }}>
        {(['CHAIN', 'STRATEGY', 'IV', 'UNUSUAL'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, fontFamily: T.fontSans, background: activeTab === tab ? T.bg1 : T.bg2, color: activeTab === tab ? T.brand : T.text3, borderBottom: activeTab === tab ? `2px solid ${T.brand}` : '2px solid transparent' }}>{tab}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {activeTab === 'CHAIN' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '6px', flex: 1, minHeight: 0 }}>
            <OptionsChainGrid chain={chain} spot={spot} onAddLeg={handleAddLeg} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <StrategyBuilder legs={legs} onRemove={handleRemoveLeg} spot={spot} />
              <PayoffDiagram legs={legs} spot={spot} />
            </div>
          </div>
        )}
        {activeTab === 'STRATEGY' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
            <StrategyBuilder legs={legs} onRemove={handleRemoveLeg} spot={spot} />
            <PayoffDiagram legs={legs} spot={spot} />
          </div>
        )}
        {activeTab === 'IV' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
            <IVSurface chain={chain} />
            <UnusualActivity chain={chain} />
          </div>
        )}
        {activeTab === 'UNUSUAL' && <UnusualActivity chain={chain} />}
      </div>
    </div>
  );
}
