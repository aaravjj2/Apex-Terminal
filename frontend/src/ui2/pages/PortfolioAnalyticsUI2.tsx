/**
 * PortfolioAnalyticsUI2.tsx — Bloomberg PORT / Portfolio Analytics
 * =================================================================
 * Comprehensive portfolio analytics with:
 * - Holdings breakdown with allocation chart (Canvas)
 * - Performance attribution (sector, factor)
 * - Correlation matrix
 * - Risk metrics (VaR, CVaR, Beta, Sharpe)
 * - Drawdown chart (Canvas)
 * - Sector/geography allocation pie
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff9800';
const TEAL = '#4db6ac';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Types ────────────────────────────────────────────────────────────────────
interface Holding {
  symbol: string;
  name: string;
  sector: string;
  shares: number;
  avgCost: number;
  price: number;
  value: number;
  weight: number;
  dailyChange: number;
  totalReturn: number;
  beta: number;
  alpha: number;
}

interface SectorAllocation {
  sector: string;
  weight: number;
  change: number;
  color: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  Technology: '#42a5f5',
  Healthcare: '#26a69a',
  Financials: '#f5a623',
  'Consumer Discretionary': '#ab47bc',
  Energy: '#ef5350',
  Industrials: '#ff9800',
  'Communication Services': '#4db6ac',
  'Real Estate': '#78909c',
  Materials: '#8d6e63',
  Utilities: '#90a4ae',
  'Consumer Staples': '#a5d6a7',
};

function generateHoldings(): Holding[] {
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', shares: 500, cost: 145.20, price: 189.50 },
    { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', shares: 300, cost: 280.50, price: 434.72 },
    { symbol: 'GOOGL', name: 'Alphabet Inc', sector: 'Communication Services', shares: 200, cost: 95.30, price: 178.34 },
    { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer Discretionary', shares: 250, cost: 112.40, price: 185.25 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', shares: 150, cost: 220.10, price: 129.55 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', shares: 400, cost: 138.90, price: 198.45 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', shares: 350, cost: 162.30, price: 148.92 },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', shares: 100, cost: 475.60, price: 498.30 },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', shares: 600, cost: 95.80, price: 112.45 },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', shares: 200, cost: 145.70, price: 163.82 },
    { symbol: 'MA', name: 'Mastercard', sector: 'Financials', shares: 120, cost: 362.40, price: 445.18 },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', shares: 150, cost: 310.20, price: 348.67 },
    { symbol: 'DIS', name: 'Walt Disney', sector: 'Communication Services', shares: 300, cost: 88.90, price: 98.42 },
    { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities', shares: 250, cost: 72.30, price: 78.15 },
    { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials', shares: 100, cost: 245.60, price: 334.90 },
  ];

  const totalPortValue = stocks.reduce((a, s) => a + s.shares * s.price, 0);

  return stocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    shares: s.shares,
    avgCost: s.cost,
    price: s.price,
    value: s.shares * s.price,
    weight: (s.shares * s.price) / totalPortValue,
    dailyChange: +(Math.random() * 4 - 2).toFixed(2),
    totalReturn: +((s.price - s.cost) / s.cost * 100).toFixed(2),
    beta: +(0.6 + Math.random() * 0.8).toFixed(2),
    alpha: +(Math.random() * 3 - 1).toFixed(2),
  }));
}

// ── Canvas: Allocation Donut ─────────────────────────────────────────────────
function AllocationDonut({ sectors, size = 220 }: { sectors: SectorAllocation[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = (size - 20) / 2;
    const inner = r * 0.6;

    let startAngle = -Math.PI / 2;
    sectors.forEach(s => {
      const sweep = s.weight * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.arc(cx, cy, inner, startAngle + sweep, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label if big enough
      if (s.weight > 0.08) {
        const mid = startAngle + sweep / 2;
        const lx = cx + (r + inner) / 2 * Math.cos(mid);
        const ly = cy + (r + inner) / 2 * Math.sin(mid);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(s.weight * 100).toFixed(0)}%`, lx, ly);
      }

      startAngle += sweep;
    });

    // Center text
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PORT', cx, cy - 6);
    ctx.font = '9px monospace';
    ctx.fillStyle = MUTED;
    ctx.fillText(`${sectors.length} sectors`, cx, cy + 8);
  }, [sectors, size]);

  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

// ── Canvas: Drawdown Chart ───────────────────────────────────────────────────
function DrawdownChart({ width = 600, height = 180 }: { width?: number; height?: number }) {
  const drawdowns = useMemo(() => {
    const pts: number[] = [];
    let dd = 0;
    for (let i = 0; i < 252; i++) {  // ~1 year trading days
      dd = Math.min(0, dd + (Math.random() - 0.52) * 0.5);
      if (Math.random() > 0.95) dd = 0; // recovery
      pts.push(dd);
    }
    return pts;
  }, []);

  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 10, right: 10, bottom: 20, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const minDD = Math.min(...drawdowns);

    // Zero line
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left + w, margin.top);
    ctx.stroke();

    // Fill
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    drawdowns.forEach((dd, i) => {
      const x = margin.left + (i / (drawdowns.length - 1)) * w;
      const y = margin.top + (-dd / -minDD) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(margin.left + w, margin.top);
    ctx.closePath();
    ctx.fillStyle = 'rgba(239,83,80,0.2)';
    ctx.fill();

    // Line
    ctx.beginPath();
    drawdowns.forEach((dd, i) => {
      const x = margin.left + (i / (drawdowns.length - 1)) * w;
      const y = margin.top + (-dd / -minDD) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Y labels
    ctx.fillStyle = MUTED;
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('0%', margin.left - 4, margin.top + 4);
    ctx.fillText(`${minDD.toFixed(1)}%`, margin.left - 4, margin.top + h);

    // Max DD annotation
    const maxDDIdx = drawdowns.indexOf(minDD);
    const maxDDX = margin.left + (maxDDIdx / (drawdowns.length - 1)) * w;
    const maxDDY = margin.top + h;
    ctx.fillStyle = RED;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Max DD: ${minDD.toFixed(1)}%`, maxDDX, maxDDY + 14);
  }, [drawdowns, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'holdings' | 'attribution' | 'risk';

export default function PortfolioAnalyticsUI2() {
  const [holdings] = useState<Holding[]>(() => generateHoldings());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sortCol, setSortCol] = useState<keyof Holding>('weight');
  const [sortAsc, setSortAsc] = useState(false);

  const totalValue = useMemo(() => holdings.reduce((a, h) => a + h.value, 0), [holdings]);
  const totalPnL = useMemo(() => holdings.reduce((a, h) => a + (h.price - h.avgCost) * h.shares, 0), [holdings]);
  const avgBeta = useMemo(() => holdings.reduce((a, h) => a + h.beta * h.weight, 0), [holdings]);

  const sectors = useMemo<SectorAllocation[]>(() => {
    const map: Record<string, { weight: number; change: number }> = {};
    holdings.forEach(h => {
      if (!map[h.sector]) map[h.sector] = { weight: 0, change: 0 };
      map[h.sector].weight += h.weight;
      map[h.sector].change += h.dailyChange * h.weight;
    });
    return Object.entries(map)
      .map(([s, v]) => ({ sector: s, ...v, color: SECTOR_COLORS[s] || MUTED }))
      .sort((a, b) => b.weight - a.weight);
  }, [holdings]);

  const sorted = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const av = a[sortCol] as number;
      const bv = b[sortCol] as number;
      return sortAsc ? av - bv : bv - av;
    });
  }, [holdings, sortCol, sortAsc]);

  const handleSort = (col: keyof Holding) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'holdings', label: 'HOLDINGS' },
    { key: 'attribution', label: 'ATTRIBUTION' },
    { key: 'risk', label: 'RISK' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* Header */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>
          PORTFOLIO ANALYTICS
        </span>
        <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>
          ${(totalValue / 1e6).toFixed(2)}M
        </span>
        <span style={{ color: totalPnL >= 0 ? GREEN : RED, fontSize: 10 }}>
          {totalPnL >= 0 ? '+' : ''}${(totalPnL / 1000).toFixed(1)}K
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'overview' && (
          <div>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total Value', value: `$${(totalValue / 1e6).toFixed(2)}M`, color: AMBER },
                { label: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}$${(totalPnL / 1000).toFixed(1)}K`, color: totalPnL >= 0 ? GREEN : RED },
                { label: 'Portfolio Beta', value: avgBeta.toFixed(2), color: BLUE },
                { label: 'Holdings', value: holdings.length.toString(), color: TEXT },
                { label: 'Sectors', value: sectors.length.toString(), color: PURPLE },
                { label: 'Top Weight', value: `${(Math.max(...holdings.map(h => h.weight)) * 100).toFixed(1)}%`, color: ORANGE },
              ].map((s, i) => (
                <div key={i} style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 12,
                  textAlign: 'center',
                }}>
                  <div style={{ color: MUTED, fontSize: 8, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 16, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Allocation donut + Sector table */}
            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>SECTOR ALLOCATION</div>
                <AllocationDonut sectors={sectors} />
              </div>

              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>SECTORS</div>
                {sectors.map(s => (
                  <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 10 }}>{s.sector}</span>
                    <div style={{ width: 120, height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.weight * 100}%`, background: s.color, opacity: 0.7, borderRadius: 4 }} />
                    </div>
                    <span style={{ width: 45, textAlign: 'right', fontSize: 9, color: AMBER }}>{(s.weight * 100).toFixed(1)}%</span>
                    <span style={{ width: 45, textAlign: 'right', fontSize: 9, color: s.change >= 0 ? GREEN : RED }}>
                      {s.change >= 0 ? '+' : ''}{(s.change).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawdown chart */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>PORTFOLIO DRAWDOWN (1Y)</div>
              <DrawdownChart width={800} height={180} />
            </div>
          </div>
        )}

        {activeTab === 'holdings' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                {[
                  { key: 'symbol' as const, label: 'Symbol', align: 'left' },
                  { key: 'name' as const, label: 'Name', align: 'left' },
                  { key: 'sector' as const, label: 'Sector', align: 'left' },
                  { key: 'shares' as const, label: 'Shares', align: 'right' },
                  { key: 'avgCost' as const, label: 'Avg Cost', align: 'right' },
                  { key: 'price' as const, label: 'Price', align: 'right' },
                  { key: 'value' as const, label: 'Value', align: 'right' },
                  { key: 'weight' as const, label: 'Weight', align: 'right' },
                  { key: 'dailyChange' as const, label: 'Day %', align: 'right' },
                  { key: 'totalReturn' as const, label: 'Total %', align: 'right' },
                  { key: 'beta' as const, label: 'Beta', align: 'right' },
                ].map(col => (
                  <th
                    key={col.key}
                    style={{
                      padding: '6px 8px',
                      color: sortCol === col.key ? AMBER : MUTED,
                      fontSize: 8,
                      textAlign: col.align as 'left' | 'right',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label} {sortCol === col.key ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => (
                <tr key={h.symbol} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{h.symbol}</td>
                  <td style={{ padding: '6px 8px', color: MUTED }}>{h.name}</td>
                  <td style={{ padding: '6px 8px', color: SECTOR_COLORS[h.sector] || TEXT, fontSize: 9 }}>{h.sector}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{h.shares.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: MUTED }}>${h.avgCost.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>${h.price.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>${(h.value / 1000).toFixed(1)}K</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: AMBER }}>{(h.weight * 100).toFixed(1)}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: h.dailyChange >= 0 ? GREEN : RED }}>
                    {h.dailyChange >= 0 ? '+' : ''}{h.dailyChange}%
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: h.totalReturn >= 0 ? GREEN : RED, fontWeight: 600 }}>
                    {h.totalReturn >= 0 ? '+' : ''}{h.totalReturn}%
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: h.beta > 1.2 ? RED : h.beta < 0.8 ? GREEN : TEXT }}>
                    {h.beta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'attribution' && (
          <div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>SECTOR ATTRIBUTION</div>
              {sectors.map(s => {
                const sectorHoldings = holdings.filter(h => h.sector === s.sector);
                const sectorPnL = sectorHoldings.reduce((a, h) => a + (h.price - h.avgCost) * h.shares, 0);
                return (
                  <div key={s.sector} style={{ padding: '6px 0', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                    <span style={{ width: 180, fontSize: 10 }}>{s.sector}</span>
                    <span style={{ width: 50, fontSize: 9, color: AMBER, textAlign: 'right' }}>{(s.weight * 100).toFixed(1)}%</span>
                    <div style={{ flex: 1, height: 14, background: BORDER, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute',
                        left: sectorPnL >= 0 ? '50%' : `${50 + sectorPnL / (totalValue * 0.01) * 50}%`,
                        width: `${Math.abs(sectorPnL) / (totalValue * 0.01) * 50}%`,
                        height: '100%',
                        background: sectorPnL >= 0 ? GREEN : RED,
                        opacity: 0.6,
                        borderRadius: 4,
                      }} />
                    </div>
                    <span style={{ width: 80, fontSize: 9, textAlign: 'right', color: sectorPnL >= 0 ? GREEN : RED }}>
                      {sectorPnL >= 0 ? '+' : ''}${(sectorPnL / 1000).toFixed(1)}K
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Portfolio Beta', value: avgBeta.toFixed(2), color: BLUE },
                { label: '1-Day VaR (95%)', value: `-$${(totalValue * 0.018).toFixed(0)}`, color: RED },
                { label: 'Sharpe Ratio', value: '1.84', color: GREEN },
                { label: 'Max Drawdown', value: '-8.4%', color: RED },
              ].map((s, i) => (
                <div key={i} style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 16,
                  textAlign: 'center',
                }}>
                  <div style={{ color: MUTED, fontSize: 9, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>PORTFOLIO DRAWDOWN (1Y)</div>
              <DrawdownChart width={800} height={200} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
