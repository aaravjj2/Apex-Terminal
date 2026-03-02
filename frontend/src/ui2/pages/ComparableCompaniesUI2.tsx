import React, { useState, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Company {
  ticker: string; name: string; sector: string; subsector: string;
  price: number; marketCap: number; ev: number;
  pe: number; fwdPe: number; evEbitda: number; evSales: number; pb: number; ps: number;
  divYield: number; revenue: number; revenueGrowth: number; ebitdaMargin: number;
  netMargin: number; roe: number; roic: number; debtEquity: number;
  fcfYield: number; beta: number; shortInterest: number;
}

function genCompany(ticker: string, name: string, sector: string, subsector: string, basePrice: number): Company {
  const r = () => Math.random();
  const marketCap = basePrice * (1000 + r() * 5000);
  const ev = marketCap * (1.1 + r() * 0.3);
  return {
    ticker, name, sector, subsector, price: basePrice * (0.95 + r() * 0.1),
    marketCap, ev,
    pe: 15 + r() * 35, fwdPe: 12 + r() * 30, evEbitda: 8 + r() * 20, evSales: 2 + r() * 10,
    pb: 1 + r() * 8, ps: 1 + r() * 12, divYield: r() * 4,
    revenue: marketCap * (0.1 + r() * 0.5), revenueGrowth: -5 + r() * 40,
    ebitdaMargin: 10 + r() * 40, netMargin: 5 + r() * 30,
    roe: 5 + r() * 35, roic: 5 + r() * 25, debtEquity: r() * 2,
    fcfYield: 1 + r() * 8, beta: 0.5 + r() * 1.5, shortInterest: r() * 15
  };
}

const PEER_GROUPS: Record<string, Company[]> = {
  'Mega-Cap Tech': [
    genCompany('AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 189),
    genCompany('MSFT', 'Microsoft Corp.', 'Technology', 'Software', 415),
    genCompany('GOOGL', 'Alphabet Inc.', 'Technology', 'Internet Services', 174),
    genCompany('AMZN', 'Amazon.com Inc.', 'Technology', 'E-Commerce', 186),
    genCompany('META', 'Meta Platforms', 'Technology', 'Social Media', 505),
    genCompany('NVDA', 'NVIDIA Corp.', 'Technology', 'Semiconductors', 903),
    genCompany('TSLA', 'Tesla Inc.', 'Technology', 'Auto/EV', 177),
    genCompany('AVGO', 'Broadcom Inc.', 'Technology', 'Semiconductors', 1345),
  ],
  'Banking': [
    genCompany('JPM', 'JPMorgan Chase', 'Financial', 'Banking', 198),
    genCompany('BAC', 'Bank of America', 'Financial', 'Banking', 37),
    genCompany('WFC', 'Wells Fargo', 'Financial', 'Banking', 58),
    genCompany('C', 'Citigroup', 'Financial', 'Banking', 58),
    genCompany('GS', 'Goldman Sachs', 'Financial', 'Banking', 465),
    genCompany('MS', 'Morgan Stanley', 'Financial', 'Banking', 95),
  ],
  'Pharma': [
    genCompany('JNJ', 'Johnson & Johnson', 'Healthcare', 'Pharma', 156),
    genCompany('UNH', 'UnitedHealth Group', 'Healthcare', 'Insurance', 527),
    genCompany('LLY', 'Eli Lilly', 'Healthcare', 'Pharma', 790),
    genCompany('PFE', 'Pfizer Inc.', 'Healthcare', 'Pharma', 27),
    genCompany('ABBV', 'AbbVie Inc.', 'Healthcare', 'Pharma', 171),
    genCompany('MRK', 'Merck & Co.', 'Healthcare', 'Pharma', 127),
    genCompany('TMO', 'Thermo Fisher', 'Healthcare', 'Life Sciences', 571),
  ],
  'Energy': [
    genCompany('XOM', 'Exxon Mobil', 'Energy', 'Oil & Gas', 117),
    genCompany('CVX', 'Chevron Corp.', 'Energy', 'Oil & Gas', 156),
    genCompany('COP', 'ConocoPhillips', 'Energy', 'E&P', 115),
    genCompany('SLB', 'Schlumberger', 'Energy', 'Services', 48),
    genCompany('EOG', 'EOG Resources', 'Energy', 'E&P', 128),
  ],
};

interface SortConfig { key: keyof Company; dir: 'asc' | 'desc'; }

function fmtB(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + v.toFixed(0);
}

type ColDef = { key: keyof Company; label: string; fmt: (v: any) => string; width?: number; category: string; };

const COLUMNS: ColDef[] = [
  { key: 'ticker', label: 'Ticker', fmt: (v: string) => v, width: 70, category: 'Identity' },
  { key: 'name', label: 'Company', fmt: (v: string) => v, width: 160, category: 'Identity' },
  { key: 'price', label: 'Price', fmt: (v: number) => '$' + v.toFixed(2), category: 'Market' },
  { key: 'marketCap', label: 'Mkt Cap', fmt: fmtB, category: 'Market' },
  { key: 'ev', label: 'EV', fmt: fmtB, category: 'Market' },
  { key: 'pe', label: 'P/E', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'fwdPe', label: 'Fwd P/E', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'evEbitda', label: 'EV/EBITDA', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'evSales', label: 'EV/Sales', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'pb', label: 'P/B', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'ps', label: 'P/S', fmt: (v: number) => v.toFixed(1) + 'x', category: 'Valuation' },
  { key: 'divYield', label: 'Div Yield', fmt: (v: number) => v.toFixed(2) + '%', category: 'Valuation' },
  { key: 'revenueGrowth', label: 'Rev Growth', fmt: (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%', category: 'Growth' },
  { key: 'ebitdaMargin', label: 'EBITDA Mgn', fmt: (v: number) => v.toFixed(1) + '%', category: 'Margins' },
  { key: 'netMargin', label: 'Net Mgn', fmt: (v: number) => v.toFixed(1) + '%', category: 'Margins' },
  { key: 'roe', label: 'ROE', fmt: (v: number) => v.toFixed(1) + '%', category: 'Returns' },
  { key: 'roic', label: 'ROIC', fmt: (v: number) => v.toFixed(1) + '%', category: 'Returns' },
  { key: 'debtEquity', label: 'D/E', fmt: (v: number) => v.toFixed(2) + 'x', category: 'Leverage' },
  { key: 'fcfYield', label: 'FCF Yield', fmt: (v: number) => v.toFixed(1) + '%', category: 'Cash Flow' },
  { key: 'beta', label: 'Beta', fmt: (v: number) => v.toFixed(2), category: 'Risk' },
  { key: 'shortInterest', label: 'Short Int', fmt: (v: number) => v.toFixed(1) + '%', category: 'Risk' },
];

function drawScatterPlot(ctx: CanvasRenderingContext2D, w: number, h: number, companies: Company[], xKey: keyof Company, yKey: keyof Company) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 20, bottom: 40, left: 60 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;

  const xVals = companies.map(c => c[xKey] as number);
  const yVals = companies.map(c => c[yKey] as number);
  const xMin = Math.min(...xVals) * 0.9, xMax = Math.max(...xVals) * 1.1;
  const yMin = Math.min(...yVals) * 0.9, yMax = Math.max(...yVals) * 1.1;

  // Grid
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + plotH * (i / 5);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    ctx.fillStyle = DIM; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText((yMax - (yMax - yMin) * (i / 5)).toFixed(1), pad.left - 5, y + 3);
  }
  for (let i = 0; i <= 5; i++) {
    const x = pad.left + plotW * (i / 5);
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, h - pad.bottom); ctx.stroke();
    ctx.fillStyle = DIM; ctx.textAlign = 'center';
    ctx.fillText((xMin + (xMax - xMin) * (i / 5)).toFixed(1), x, h - pad.bottom + 14);
  }

  // Axes labels
  ctx.fillStyle = AMBER; ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(xKey).toUpperCase(), pad.left + plotW / 2, h - 5);
  ctx.save(); ctx.translate(12, pad.top + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(String(yKey).toUpperCase(), 0, 0); ctx.restore();

  // Mean lines
  const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length;
  const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
  ctx.strokeStyle = 'rgba(245,166,35,0.3)'; ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left + ((xMean - xMin) / (xMax - xMin)) * plotW, pad.top);
  ctx.lineTo(pad.left + ((xMean - xMin) / (xMax - xMin)) * plotW, pad.top + plotH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + ((yMax - yMean) / (yMax - yMin)) * plotH);
  ctx.lineTo(pad.left + plotW, pad.top + ((yMax - yMean) / (yMax - yMin)) * plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Points
  const colors = [AMBER, GREEN, CYAN, RED, '#b388ff', '#ff9800'];
  companies.forEach((c, i) => {
    const x = pad.left + ((c[xKey] as number - xMin) / (xMax - xMin)) * plotW;
    const y = pad.top + ((yMax - (c[yKey] as number)) / (yMax - yMin)) * plotH;
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WHITE; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(c.ticker, x + 9, y + 3);
  });

  // Title
  ctx.fillStyle = AMBER; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`SCATTER: ${String(xKey).toUpperCase()} vs ${String(yKey).toUpperCase()}`, pad.left, 16);
}

const TABS = ['Comp Table', 'Scatter Plot', 'Waterfall', 'Football Field', 'Custom Screen'];

export default function ComparableCompaniesUI2() {
  const [tab, setTab] = useState(0);
  const [group, setGroup] = useState('Mega-Cap Tech');
  const [sort, setSort] = useState<SortConfig>({ key: 'marketCap', dir: 'desc' });
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
  const [scatterX, setScatterX] = useState<keyof Company>('evEbitda');
  const [scatterY, setScatterY] = useState<keyof Company>('revenueGrowth');
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const companies = PEER_GROUPS[group] || [];
  const sorted = [...companies].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
    return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const avgFor = (key: keyof Company) => {
    const vals = companies.map(c => c[key] as number).filter(v => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const medianFor = (key: keyof Company) => {
    const vals = companies.map(c => c[key] as number).filter(v => typeof v === 'number').sort((a, b) => a - b);
    if (!vals.length) return 0;
    const m = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  };

  useEffect(() => {
    if (tab !== 1) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawScatterPlot(ctx, r.width, r.height, companies, scatterX, scatterY);
  }, [tab, companies, scatterX, scatterY]);

  const toggleSort = (key: keyof Company) => {
    setSort(prev => prev.key === key ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📊 COMPARABLE COMPANIES</span>
        <span style={{ color: DIM }}>|</span>
        <select value={group} onChange={e => setGroup(e.target.value)} style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: AMBER, fontFamily: 'monospace', fontSize: 12 }}>
          {Object.keys(PEER_GROUPS).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span style={{ color: DIM }}>{companies.length} companies</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Comp Table */}
        {tab === 0 && (
          <div style={{ overflow: 'auto', height: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 2 }}>
                  {COLUMNS.filter(c => visibleCols.has(c.key)).map(col => (
                    <th key={col.key} onClick={() => toggleSort(col.key)}
                      style={{ padding: '6px 6px', textAlign: col.key === 'name' || col.key === 'ticker' ? 'left' : 'right', color: sort.key === col.key ? AMBER : DIM, fontSize: 10, borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', whiteSpace: 'nowrap', width: col.width }}>
                      {col.label} {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => (
                  <tr key={c.ticker} onClick={() => setHighlighted(prev => {
                    const next = new Set(prev);
                    next.has(c.ticker) ? next.delete(c.ticker) : next.add(c.ticker);
                    return next;
                  })} style={{
                    borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                    background: highlighted.has(c.ticker) ? 'rgba(245,166,35,0.08)' : 'transparent',
                  }}>
                    {COLUMNS.filter(col => visibleCols.has(col.key)).map(col => {
                      const v = c[col.key];
                      const isNum = typeof v === 'number';
                      const avg = isNum ? avgFor(col.key) : 0;
                      let color = TEXT;
                      if (col.key === 'ticker') color = AMBER;
                      else if (col.key === 'revenueGrowth') color = (v as number) >= 0 ? GREEN : RED;
                      else if (isNum && col.category === 'Valuation' && col.key !== 'divYield') {
                        color = (v as number) < avg ? GREEN : (v as number) > avg * 1.3 ? RED : TEXT;
                      }
                      return (
                        <td key={col.key} style={{
                          padding: '5px 6px', textAlign: col.key === 'name' || col.key === 'ticker' ? 'left' : 'right',
                          color, fontWeight: col.key === 'ticker' ? 'bold' : 'normal',
                          fontSize: col.key === 'name' ? 11 : 12
                        }}>
                          {col.fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Summary rows */}
                {[
                  { label: 'MEAN', calc: avgFor },
                  { label: 'MEDIAN', calc: medianFor },
                ].map(summary => (
                  <tr key={summary.label} style={{ borderTop: `2px solid ${AMBER}`, background: 'rgba(245,166,35,0.03)' }}>
                    {COLUMNS.filter(col => visibleCols.has(col.key)).map(col => {
                      if (col.key === 'ticker') return <td key={col.key} style={{ padding: '5px 6px', color: AMBER, fontWeight: 'bold' }}>{summary.label}</td>;
                      if (col.key === 'name') return <td key={col.key} style={{ padding: '5px 6px', color: DIM }}>—</td>;
                      const v = summary.calc(col.key);
                      return (
                        <td key={col.key} style={{ padding: '5px 6px', textAlign: 'right', color: CYAN, fontWeight: 'bold' }}>
                          {col.fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Scatter Plot */}
        {tab === 1 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ color: DIM, fontSize: 10 }}>X-Axis:</span>
              <select value={scatterX as string} onChange={e => setScatterX(e.target.value as keyof Company)} style={{ padding: '3px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10 }}>
                {COLUMNS.filter(c => typeof companies[0]?.[c.key] === 'number').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <span style={{ color: DIM, fontSize: 10 }}>Y-Axis:</span>
              <select value={scatterY as string} onChange={e => setScatterY(e.target.value as keyof Company)} style={{ padding: '3px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10 }}>
                {COLUMNS.filter(c => typeof companies[0]?.[c.key] === 'number').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}

        {/* Waterfall */}
        {tab === 2 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>VALUATION WATERFALL — EV/EBITDA BRIDGE</div>
            {companies.map((c, i) => {
              const avg = avgFor('evEbitda');
              const diff = c.evEbitda - avg;
              const barWidth = Math.min(Math.abs(diff) / avg * 300, 200);
              return (
                <div key={c.ticker} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, height: 28 }}>
                  <span style={{ width: 80, color: AMBER, fontWeight: 'bold' }}>{c.ticker}</span>
                  <span style={{ width: 60, color: TEXT, textAlign: 'right', marginRight: 8 }}>{c.evEbitda.toFixed(1)}x</span>
                  <div style={{ flex: 1, position: 'relative', height: 16 }}>
                    {diff >= 0 ? (
                      <div style={{ position: 'absolute', left: '50%', width: barWidth, height: '100%', background: RED, opacity: 0.7 }} />
                    ) : (
                      <div style={{ position: 'absolute', left: `calc(50% - ${barWidth}px)`, width: barWidth, height: '100%', background: GREEN, opacity: 0.7 }} />
                    )}
                    <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: AMBER, opacity: 0.5 }} />
                  </div>
                  <span style={{ width: 60, textAlign: 'right', color: diff >= 0 ? RED : GREEN, fontSize: 10 }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}x
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <span style={{ width: 80, color: CYAN, fontWeight: 'bold' }}>AVG</span>
              <span style={{ width: 60, color: CYAN, textAlign: 'right', marginRight: 8 }}>{avgFor('evEbitda').toFixed(1)}x</span>
            </div>
          </div>
        )}

        {/* Football Field */}
        {tab === 3 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>FOOTBALL FIELD VALUATION</div>
            {['pe', 'fwdPe', 'evEbitda', 'evSales', 'pb'].map(metric => {
              const col = COLUMNS.find(c => c.key === metric)!;
              const vals = companies.map(c => c[metric as keyof Company] as number).sort((a, b) => a - b);
              const min = vals[0], max = vals[vals.length - 1];
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              const q1 = vals[Math.floor(vals.length * 0.25)];
              const q3 = vals[Math.floor(vals.length * 0.75)];
              const range = max - min || 1;

              return (
                <div key={metric} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ width: 100, color: WHITE, fontWeight: 'bold' }}>{col.label}</span>
                    <div style={{ flex: 1, position: 'relative', height: 24, background: '#1a1a1a', borderRadius: 2 }}>
                      {/* IQR Box */}
                      <div style={{
                        position: 'absolute', top: 4, height: 16,
                        left: `${((q1 - min) / range) * 100}%`,
                        width: `${((q3 - q1) / range) * 100}%`,
                        background: 'rgba(0,188,212,0.3)', border: `1px solid ${CYAN}`, borderRadius: 2
                      }} />
                      {/* Whiskers */}
                      <div style={{ position: 'absolute', top: 11, height: 2, left: 0, right: 0, background: DIM }} />
                      {/* Mean marker */}
                      <div style={{
                        position: 'absolute', top: 2, height: 20, width: 2,
                        left: `${((avg - min) / range) * 100}%`,
                        background: AMBER
                      }} />
                      {/* Company dots */}
                      {companies.map(c => (
                        <div key={c.ticker} title={c.ticker} style={{
                          position: 'absolute', top: 8, width: 8, height: 8, borderRadius: '50%',
                          background: GREEN,
                          left: `calc(${(((c[metric as keyof Company] as number) - min) / range) * 100}% - 4px)`,
                        }} />
                      ))}
                    </div>
                    <span style={{ width: 80, textAlign: 'right', color: DIM, fontSize: 10 }}>
                      {min.toFixed(1)} – {max.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 10, color: DIM }}>
              <span>● <span style={{ color: GREEN }}>Company</span></span>
              <span>— <span style={{ color: AMBER }}>Mean</span></span>
              <span>□ <span style={{ color: CYAN }}>IQR (25th–75th)</span></span>
            </div>
          </div>
        )}

        {/* Custom Screen */}
        {tab === 4 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>COLUMN VISIBILITY</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
              {COLUMNS.map(col => (
                <button key={col.key} onClick={() => {
                  const next = new Set(visibleCols);
                  next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                  setVisibleCols(next);
                }} style={{
                  padding: '3px 8px', background: visibleCols.has(col.key) ? 'rgba(245,166,35,0.15)' : '#1a1a1a',
                  border: `1px solid ${visibleCols.has(col.key) ? AMBER : BORDER}`,
                  color: visibleCols.has(col.key) ? AMBER : DIM, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{col.label}</button>
              ))}
            </div>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>QUICK VIEWS</div>
            {[
              { name: 'Valuation', cols: ['ticker', 'name', 'price', 'marketCap', 'pe', 'fwdPe', 'evEbitda', 'evSales', 'pb', 'ps', 'divYield'] },
              { name: 'Growth & Margins', cols: ['ticker', 'name', 'revenueGrowth', 'ebitdaMargin', 'netMargin', 'roe', 'roic'] },
              { name: 'Risk', cols: ['ticker', 'name', 'price', 'beta', 'shortInterest', 'debtEquity', 'fcfYield'] },
              { name: 'All', cols: COLUMNS.map(c => c.key) },
            ].map(v => (
              <button key={v.name} onClick={() => setVisibleCols(new Set(v.cols))} style={{
                marginRight: 8, padding: '4px 12px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
              }}>{v.name}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Peer Group: {group} | {companies.length} companies</span>
        <span style={{ color: DIM }}>Sort: {sort.key} ({sort.dir})</span>
        <span style={{ color: DIM }}>Bloomberg COMP Equivalent</span>
      </div>
    </div>
  );
}
