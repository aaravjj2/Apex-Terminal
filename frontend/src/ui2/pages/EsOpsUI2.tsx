/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — ES/Futures Operations Dashboard (UI2)             │
 * │  E-mini S&P (ES) + Futures operations with contract specs,        │
 * │  term structure, roll calendar, and position management            │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface FuturesContract {
  symbol: string; name: string; expiry: string; daysToExpiry: number;
  last: number; change: number; changePct: number; volume: number;
  openInterest: number; bid: number; ask: number; high: number;
  low: number; settle: number; basis: number;
}

interface FuturesPosition {
  symbol: string; side: 'LONG' | 'SHORT'; qty: number; avgEntry: number;
  current: number; pnl: number; margin: number; daysHeld: number;
}

interface RollEvent {
  from: string; to: string; rollDate: string; daysUntil: number;
  spread: number; status: 'upcoming' | 'active' | 'completed';
  carryBps: number;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateContracts(): FuturesContract[] {
  const months = ['M4', 'U4', 'Z4', 'H5', 'M5', 'U5', 'Z5', 'H6'];
  const names = ['Jun 24', 'Sep 24', 'Dec 24', 'Mar 25', 'Jun 25', 'Sep 25', 'Dec 25', 'Mar 26'];
  const days = [12, 102, 193, 284, 375, 466, 557, 648];
  const base = 5245.50;

  return months.map((m, i) => {
    const premium = (i * 8.5) + (Math.random() - 0.5) * 5;
    const last = +(base + premium).toFixed(2);
    const chg = +((Math.random() - 0.48) * 25).toFixed(2);
    return {
      symbol: `ES${m}`, name: `ES ${names[i]}`, expiry: names[i],
      daysToExpiry: days[i],
      last, change: chg, changePct: +(chg / last * 100).toFixed(3),
      volume: Math.floor(50000 + Math.random() * 2000000 / (i + 1)),
      openInterest: Math.floor(100000 + Math.random() * 3000000 / (i + 1)),
      bid: +(last - 0.25).toFixed(2), ask: +(last + 0.25).toFixed(2),
      high: +(last + Math.random() * 20).toFixed(2),
      low: +(last - Math.random() * 20).toFixed(2),
      settle: +(last - chg).toFixed(2),
      basis: +premium.toFixed(2),
    };
  });
}

function generatePositions(): FuturesPosition[] {
  return [
    { symbol: 'ESM4', side: 'LONG', qty: 5, avgEntry: 5220.00, current: 5248.50, pnl: 7125, margin: 65000, daysHeld: 8 },
    { symbol: 'NQM4', side: 'LONG', qty: 2, avgEntry: 18350.00, current: 18420.50, pnl: 2820, margin: 42000, daysHeld: 3 },
    { symbol: 'ESU4', side: 'SHORT', qty: 3, avgEntry: 5265.00, current: 5254.00, pnl: 1650, margin: 39000, daysHeld: 15 },
    { symbol: 'CLN4', side: 'LONG', qty: 10, avgEntry: 78.50, current: 79.20, pnl: 7000, margin: 58000, daysHeld: 5 },
    { symbol: 'GCQ4', side: 'LONG', qty: 3, avgEntry: 2340.00, current: 2365.80, pnl: 7740, margin: 33000, daysHeld: 12 },
    { symbol: 'ZBU4', side: 'SHORT', qty: 4, avgEntry: 118.50, current: 117.75, pnl: 3000, margin: 20000, daysHeld: 7 },
  ];
}

function generateRolls(): RollEvent[] {
  return [
    { from: 'ESM4', to: 'ESU4', rollDate: '2024-06-14', daysUntil: 8, spread: -12.25, status: 'active', carryBps: 18.5 },
    { from: 'NQM4', to: 'NQU4', rollDate: '2024-06-14', daysUntil: 8, spread: -45.00, status: 'active', carryBps: 22.3 },
    { from: 'CLN4', to: 'CLQ4', rollDate: '2024-06-20', daysUntil: 14, spread: -0.85, status: 'upcoming', carryBps: 12.8 },
    { from: 'GCQ4', to: 'GCV4', rollDate: '2024-07-25', daysUntil: 49, spread: 3.20, status: 'upcoming', carryBps: -5.2 },
    { from: 'ZBU4', to: 'ZBZ4', rollDate: '2024-08-30', daysUntil: 85, spread: -0.125, status: 'upcoming', carryBps: 3.1 },
    { from: 'ESH4', to: 'ESM4', rollDate: '2024-03-15', daysUntil: 0, spread: -10.50, status: 'completed', carryBps: 15.8 },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function TermStructureCanvas({ contracts }: { contracts: FuturesContract[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);

    const prices = contracts.map(c => c.last);
    const mn = Math.min(...prices) - 5; const mx = Math.max(...prices) + 5;
    const rng = mx - mn || 1;
    const pad = 40;

    // Grid
    ctx.strokeStyle = `${T.tx3}20`; ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = pad + (i / 4) * (H - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = `6px ${T.mono}`; ctx.textAlign = 'right';
      ctx.fillText((mx - (i / 4) * rng).toFixed(0), pad - 3, y + 2);
    }

    // Term structure line
    const toX = (i: number) => pad + (i / (contracts.length - 1)) * (W - pad - 10);
    const toY = (v: number) => pad + ((mx - v) / rng) * (H - pad * 2);

    ctx.strokeStyle = T.brand; ctx.lineWidth = 2;
    ctx.beginPath();
    contracts.forEach((c, i) => { i === 0 ? ctx.moveTo(toX(i), toY(c.last)) : ctx.lineTo(toX(i), toY(c.last)); });
    ctx.stroke();

    // Points + labels
    contracts.forEach((ci, i) => {
      const x = toX(i); const y = toY(ci.last);
      // Dot
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ci.change >= 0 ? T.up : T.dn; ctx.fill();
      ctx.strokeStyle = T.bg1; ctx.lineWidth = 1; ctx.stroke();
      // Symbol
      ctx.fillStyle = T.tx1; ctx.font = `bold 6px ${T.mono}`; ctx.textAlign = 'center';
      ctx.fillText(ci.symbol, x, H - 5);
      // Price
      ctx.fillStyle = T.tx0; ctx.font = `6px ${T.mono}`;
      ctx.fillText(ci.last.toFixed(2), x, y - 8);
    });

    // Contango/Backwardation label
    const isContango = prices[prices.length - 1] > prices[0];
    ctx.fillStyle = isContango ? T.warn : T.up; ctx.font = `bold 8px ${T.sans}`;
    ctx.textAlign = 'right';
    ctx.fillText(isContango ? 'CONTANGO' : 'BACKWARDATION', W - 15, 15);
  }, [contracts]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: T.r }} />;
}

function BasisChart({ contracts }: { contracts: FuturesContract[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 120;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const bases = contracts.map(c => c.basis);
    const mx = Math.max(...bases.map(Math.abs)) || 1;
    const barW = (W - 20) / contracts.length;

    contracts.forEach((ci, i) => {
      const x = 10 + i * barW;
      const h = Math.abs(ci.basis / mx) * (H / 2 - 10);
      const y = ci.basis >= 0 ? H / 2 - h : H / 2;
      ctx.fillStyle = ci.basis >= 0 ? `${T.up}80` : `${T.dn}80`;
      ctx.fillRect(x + 2, y, barW - 4, h);

      ctx.fillStyle = T.tx2; ctx.font = `5px ${T.mono}`; ctx.textAlign = 'center';
      ctx.fillText(ci.symbol, x + barW / 2, H - 3);
      ctx.fillText(ci.basis.toFixed(1), x + barW / 2, ci.basis >= 0 ? y - 3 : y + h + 7);
    });

    // Zero line
    ctx.strokeStyle = `${T.tx3}40`; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(10, H / 2); ctx.lineTo(W - 10, H / 2); ctx.stroke();
  }, [contracts]);
  return <canvas ref={ref} style={{ width: '100%', height: 120, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type EsTab = 'chain' | 'structure' | 'positions' | 'rolls';

export default function EsOpsUI2() {
  const [tab, setTab] = useState<EsTab>('chain');
  const contracts = useMemo(() => generateContracts(), []);
  const positions = useMemo(() => generatePositions(), []);
  const rolls = useMemo(() => generateRolls(), []);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div data-testid="esops-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>ES / FUTURES OPS</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Front: <span style={{ color: T.tx0 }}>{contracts[0]?.symbol}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: contracts[0]?.change >= 0 ? T.up : T.dn }}>{contracts[0]?.last.toFixed(2)} ({contracts[0]?.change >= 0 ? '+' : ''}{contracts[0]?.change.toFixed(2)})</span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>P&L: <span style={{ color: totalPnl >= 0 ? T.up : T.dn }}>${totalPnl.toLocaleString()}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'chain' as EsTab, label: '📋 Chain' },
          { key: 'structure' as EsTab, label: '📈 Term Structure' },
          { key: 'positions' as EsTab, label: '💼 Positions' },
          { key: 'rolls' as EsTab, label: '🔄 Rolls' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'chain' && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead><tr style={{ background: T.bg2 }}>
                {['Symbol','Expiry','DTE','Last','Chg','Chg%','Bid','Ask','Volume','OI','High','Low','Basis'].map(h => (
                  <th key={h} style={{ padding: '5px 3px', textAlign: h === 'Symbol' || h === 'Expiry' ? 'left' : 'right', color: T.tx3, fontWeight: 600, fontSize: '7px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {contracts.map((c, i) => (
                  <tr key={c.symbol} style={{ borderBottom: `1px solid ${T.border}`, background: i === 0 ? `${T.brand}08` : 'transparent' }}>
                    <td style={{ padding: '4px 3px', fontWeight: 700, color: T.tx0 }}>{c.symbol}{i === 0 && <span style={{ fontSize: '5px', color: T.brand, marginLeft: 3 }}>FRONT</span>}</td>
                    <td style={{ padding: '4px 3px', color: T.tx2 }}>{c.expiry}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: c.daysToExpiry < 30 ? T.warn : T.tx1 }}>{c.daysToExpiry}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', fontWeight: 700, color: T.tx0 }}>{c.last.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: c.change >= 0 ? T.up : T.dn }}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: c.change >= 0 ? T.up : T.dn }}>{c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(3)}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.up }}>{c.bid.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.dn }}>{c.ask.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx1 }}>{(c.volume / 1000).toFixed(0)}K</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx1 }}>{(c.openInterest / 1000).toFixed(0)}K</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx2 }}>{c.high.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx2 }}>{c.low.toFixed(2)}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: c.basis >= 0 ? T.up : T.dn }}>{c.basis >= 0 ? '+' : ''}{c.basis.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'structure' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>ES Futures Term Structure</div>
            <TermStructureCanvas contracts={contracts} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px', marginTop: '8px' }}>Basis vs Spot</div>
            <BasisChart contracts={contracts} />
          </div>
        )}
        {tab === 'positions' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
              {[
                { label: 'Total P&L', value: `$${totalPnl.toLocaleString()}`, color: totalPnl >= 0 ? T.up : T.dn },
                { label: 'Total Margin', value: `$${positions.reduce((s, p) => s + p.margin, 0).toLocaleString()}`, color: T.tx0 },
                { label: 'Net Contracts', value: String(positions.reduce((s, p) => s + (p.side === 'LONG' ? p.qty : -p.qty), 0)), color: T.brand },
                { label: 'Positions', value: String(positions.length), color: T.tx0 },
              ].map(m => (
                <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: T.tx3 }}>{m.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: m.color, fontFamily: T.mono }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['Symbol','Side','Qty','Avg Entry','Current','P&L','Margin','Days'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: h === 'Symbol' || h === 'Side' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {positions.map(p => (
                    <tr key={p.symbol} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', fontWeight: 700, color: T.tx0 }}>{p.symbol}</td>
                      <td style={{ padding: '4px' }}>
                        <span style={{ fontSize: '7px', padding: '1px 3px', borderRadius: '2px', fontWeight: 700, background: p.side === 'LONG' ? `${T.up}20` : `${T.dn}20`, color: p.side === 'LONG' ? T.up : T.dn }}>{p.side}</span>
                      </td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx0 }}>{p.qty}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{p.avgEntry.toFixed(2)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx0, fontWeight: 700 }}>{p.current.toFixed(2)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: p.pnl >= 0 ? T.up : T.dn, fontWeight: 700 }}>${p.pnl.toLocaleString()}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>${p.margin.toLocaleString()}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx2 }}>{p.daysHeld}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'rolls' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Roll Calendar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rolls.map((r, i) => {
                const statusColor = { upcoming: T.warn, active: T.brand, completed: T.up }[r.status];
                return (
                  <div key={i} style={{ background: T.bg1, border: `1px solid ${r.status === 'active' ? T.brand : T.border}`, borderRadius: T.r, padding: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{r.from}</span>
                        <span style={{ color: T.brand }}>→</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{r.to}</span>
                      </div>
                      <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, background: `${statusColor}20`, color: statusColor }}>{r.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '7px', fontFamily: T.mono }}>
                      <span style={{ color: T.tx3 }}>Roll: <span style={{ color: T.tx1 }}>{r.rollDate}</span></span>
                      <span style={{ color: T.tx3 }}>DTE: <span style={{ color: r.daysUntil < 14 ? T.warn : T.tx1 }}>{r.daysUntil}d</span></span>
                      <span style={{ color: T.tx3 }}>Spread: <span style={{ color: r.spread >= 0 ? T.up : T.dn }}>{r.spread >= 0 ? '+' : ''}{r.spread.toFixed(2)}</span></span>
                      <span style={{ color: T.tx3 }}>Carry: <span style={{ color: r.carryBps >= 0 ? T.up : T.dn }}>{r.carryBps >= 0 ? '+' : ''}{r.carryBps.toFixed(1)}bp</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { EsOpsUI2 };
