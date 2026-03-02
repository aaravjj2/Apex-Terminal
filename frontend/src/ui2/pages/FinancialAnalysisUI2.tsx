import React, { useState, useRef, useEffect } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Financial Data ──
interface FinancialPeriod {
  period: string; revenue: number; cogs: number; grossProfit: number;
  opex: number; ebit: number; interestExp: number; taxRate: number;
  netIncome: number; eps: number; shares: number;
  // Balance Sheet
  totalAssets: number; totalLiabilities: number; equity: number;
  cash: number; debt: number; currentRatio: number;
  // Cash Flow
  cfOps: number; capex: number; fcf: number;
}

function generateFinancials(baseRev: number): FinancialPeriod[] {
  const periods = ['FY2020', 'FY2021', 'FY2022', 'FY2023', 'FY2024E', 'FY2025E'];
  let rev = baseRev;
  return periods.map((p, i) => {
    const growth = 0.08 + Math.random() * 0.15;
    rev *= (1 + growth);
    const gm = 0.35 + Math.random() * 0.2;
    const grossProfit = rev * gm;
    const opex = grossProfit * (0.5 + Math.random() * 0.2);
    const ebit = grossProfit - opex;
    const interestExp = rev * 0.02;
    const ebt = ebit - interestExp;
    const taxRate = 0.21;
    const netIncome = ebt * (1 - taxRate);
    const shares = 1000 + Math.random() * 500;
    const eps = netIncome / shares;
    const totalAssets = rev * (2 + Math.random());
    const debt = totalAssets * (0.2 + Math.random() * 0.3);
    const equity = totalAssets - debt * 0.8;
    const cash = rev * (0.1 + Math.random() * 0.2);
    const cfOps = netIncome * (1.1 + Math.random() * 0.3);
    const capex = rev * (0.05 + Math.random() * 0.08);
    return {
      period: p, revenue: Math.round(rev), cogs: Math.round(rev - grossProfit),
      grossProfit: Math.round(grossProfit), opex: Math.round(opex), ebit: Math.round(ebit),
      interestExp: Math.round(interestExp), taxRate, netIncome: Math.round(netIncome),
      eps: Math.round(eps * 100) / 100, shares: Math.round(shares),
      totalAssets: Math.round(totalAssets), totalLiabilities: Math.round(debt * 0.8 + totalAssets * 0.2),
      equity: Math.round(equity), cash: Math.round(cash), debt: Math.round(debt),
      currentRatio: Math.round((1.2 + Math.random() * 1.5) * 100) / 100,
      cfOps: Math.round(cfOps), capex: Math.round(capex), fcf: Math.round(cfOps - capex),
    };
  });
}

// ── Companies ──
interface Company { ticker: string; name: string; sector: string; price: number; marketCap: number; }

const COMPANIES: Company[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 189.84, marketCap: 2940e9 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', price: 415.56, marketCap: 3090e9 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', price: 174.23, marketCap: 2150e9 },
  { ticker: 'AMZN', name: 'Amazon.com', sector: 'Consumer', price: 186.13, marketCap: 1940e9 },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Technology', price: 505.95, marketCap: 1290e9 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', price: 903.56, marketCap: 2230e9 },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financial', price: 198.47, marketCap: 573e9 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', price: 156.72, marketCap: 378e9 },
];

// ── Ratios ──
interface FinancialRatio { name: string; value: number; benchmark: number; unit: string; category: string; }

function computeRatios(fin: FinancialPeriod, price: number, shares: number): FinancialRatio[] {
  return [
    { name: 'P/E Ratio', value: price / (fin.eps || 1), benchmark: 22.5, unit: 'x', category: 'Valuation' },
    { name: 'EV/EBITDA', value: (price * shares + fin.debt - fin.cash) / (fin.ebit * 1.15), benchmark: 14.2, unit: 'x', category: 'Valuation' },
    { name: 'P/S Ratio', value: (price * shares) / fin.revenue, benchmark: 3.5, unit: 'x', category: 'Valuation' },
    { name: 'P/B Ratio', value: (price * shares) / fin.equity, benchmark: 3.2, unit: 'x', category: 'Valuation' },
    { name: 'PEG Ratio', value: (price / (fin.eps || 1)) / 15, benchmark: 1.0, unit: 'x', category: 'Valuation' },
    { name: 'Gross Margin', value: (fin.grossProfit / fin.revenue) * 100, benchmark: 45, unit: '%', category: 'Profitability' },
    { name: 'Operating Margin', value: (fin.ebit / fin.revenue) * 100, benchmark: 20, unit: '%', category: 'Profitability' },
    { name: 'Net Margin', value: (fin.netIncome / fin.revenue) * 100, benchmark: 15, unit: '%', category: 'Profitability' },
    { name: 'ROE', value: (fin.netIncome / fin.equity) * 100, benchmark: 18, unit: '%', category: 'Profitability' },
    { name: 'ROA', value: (fin.netIncome / fin.totalAssets) * 100, benchmark: 8, unit: '%', category: 'Profitability' },
    { name: 'ROIC', value: (fin.ebit * (1 - fin.taxRate) / (fin.equity + fin.debt)) * 100, benchmark: 12, unit: '%', category: 'Profitability' },
    { name: 'Current Ratio', value: fin.currentRatio, benchmark: 1.5, unit: 'x', category: 'Liquidity' },
    { name: 'Debt/Equity', value: fin.debt / fin.equity, benchmark: 0.8, unit: 'x', category: 'Leverage' },
    { name: 'Debt/EBITDA', value: fin.debt / (fin.ebit * 1.15), benchmark: 2.5, unit: 'x', category: 'Leverage' },
    { name: 'Interest Coverage', value: fin.ebit / (fin.interestExp || 1), benchmark: 10, unit: 'x', category: 'Leverage' },
    { name: 'FCF Yield', value: (fin.fcf / (price * shares)) * 100, benchmark: 4, unit: '%', category: 'Cash Flow' },
    { name: 'Capex/Revenue', value: (fin.capex / fin.revenue) * 100, benchmark: 6, unit: '%', category: 'Cash Flow' },
  ];
}

function fmtM(v: number): string {
  if (Math.abs(v) >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + v.toFixed(0);
}

// ── DCF Model ──
interface DCFInputs { growthY1: number; growthY5: number; termGrowth: number; wacc: number; years: number; }

function runDCF(lastFCF: number, inputs: DCFInputs): { projections: number[]; terminalValue: number; ev: number; } {
  const projections: number[] = [];
  let fcf = lastFCF;
  for (let i = 0; i < inputs.years; i++) {
    const g = inputs.growthY1 + (inputs.growthY5 - inputs.growthY1) * (i / (inputs.years - 1));
    fcf *= (1 + g / 100);
    projections.push(fcf);
  }
  const terminalValue = (fcf * (1 + inputs.termGrowth / 100)) / ((inputs.wacc / 100) - (inputs.termGrowth / 100));
  const pvFCFs = projections.reduce((sum, f, i) => sum + f / Math.pow(1 + inputs.wacc / 100, i + 1), 0);
  const pvTV = terminalValue / Math.pow(1 + inputs.wacc / 100, inputs.years);
  return { projections, terminalValue, ev: pvFCFs + pvTV };
}

// ── Canvas ──
function drawFinChart(ctx: CanvasRenderingContext2D, w: number, h: number, financials: FinancialPeriod[], metric: 'revenue' | 'netIncome' | 'fcf' | 'eps') {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 15, bottom: 35, left: 55 };
  const titles: Record<string, string> = { revenue: 'REVENUE', netIncome: 'NET INCOME', fcf: 'FREE CASH FLOW', eps: 'EPS' };
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(titles[metric] || metric, pad.left, 16);

  const data = financials.map(f => f[metric] as number);
  const maxV = Math.max(...data.map(Math.abs), 1);
  const barW = Math.max(20, ((w - pad.left - pad.right) / data.length) - 8);

  data.forEach((v, i) => {
    const x = pad.left + i * ((w - pad.left - pad.right) / data.length) + 4;
    const barH = (Math.abs(v) / maxV) * (h - pad.top - pad.bottom);
    const y = v >= 0 ? pad.top + (h - pad.top - pad.bottom) - barH : pad.top + (h - pad.top - pad.bottom);

    ctx.fillStyle = v >= 0 ? GREEN : RED;
    ctx.fillRect(x, y, barW, barH || 2);

    // Value label
    ctx.fillStyle = WHITE;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(metric === 'eps' ? v.toFixed(2) : fmtM(v), x + barW / 2, y - 5);

    // Period label
    ctx.fillStyle = DIM;
    ctx.font = '9px monospace';
    ctx.fillText(financials[i].period, x + barW / 2, h - 8);
  });
  ctx.textAlign = 'left';

  // Growth arrow
  if (data.length >= 2) {
    const cagr = Math.pow(data[data.length - 1] / data[0], 1 / (data.length - 1)) - 1;
    ctx.fillStyle = cagr >= 0 ? GREEN : RED;
    ctx.font = '10px monospace';
    ctx.fillText(`CAGR: ${(cagr * 100).toFixed(1)}%`, w - 120, 16);
  }
}

// ── Main Component ──
const TABS = ['Income Stmt', 'Balance Sheet', 'Cash Flow', 'Ratios', 'DCF Model', 'Charts'];

export default function FinancialAnalysisUI2() {
  const [tab, setTab] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0]);
  const [financials] = useState(() => {
    const map: Record<string, FinancialPeriod[]> = {};
    COMPANIES.forEach(c => { map[c.ticker] = generateFinancials(c.marketCap * 0.03); });
    return map;
  });
  const [dcfInputs, setDcfInputs] = useState<DCFInputs>({ growthY1: 15, growthY5: 8, termGrowth: 2.5, wacc: 10, years: 10 });
  const [chartMetric, setChartMetric] = useState<'revenue' | 'netIncome' | 'fcf' | 'eps'>('revenue');
  const chartRef = useRef<HTMLCanvasElement>(null);

  const fins = financials[selectedCompany.ticker] || [];
  const latestFin = fins[fins.length - 1];
  const ratios = latestFin ? computeRatios(latestFin, selectedCompany.price, latestFin.shares) : [];
  const dcfResult = latestFin ? runDCF(latestFin.fcf, dcfInputs) : null;

  useEffect(() => {
    if (tab !== 5) return;
    const c = chartRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawFinChart(ctx, r.width, r.height, fins, chartMetric);
  }, [tab, fins, chartMetric]);

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>💰 FINANCIAL ANALYSIS</span>
        <span style={{ color: DIM }}>|</span>
        <select value={selectedCompany.ticker} onChange={e => {
          const c = COMPANIES.find(co => co.ticker === e.target.value);
          if (c) setSelectedCompany(c);
        }} style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: AMBER, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
          {COMPANIES.map(c => <option key={c.ticker} value={c.ticker}>{c.ticker} — {c.name}</option>)}
        </select>
        <span style={{ color: WHITE }}>${selectedCompany.price.toFixed(2)}</span>
        <span style={{ color: DIM }}>MCap: {fmtM(selectedCompany.marketCap)}</span>
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
        {/* Income Statement */}
        {tab === 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}`, minWidth: 180 }}>Line Item</th>
                {fins.map(f => <th key={f.period} style={{ padding: '6px 8px', textAlign: 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{f.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Revenue', key: 'revenue', bold: true },
                { label: 'Cost of Revenue', key: 'cogs', indent: true },
                { label: 'Gross Profit', key: 'grossProfit', bold: true },
                { label: 'Operating Expenses', key: 'opex', indent: true },
                { label: 'EBIT', key: 'ebit', bold: true },
                { label: 'Interest Expense', key: 'interestExp', indent: true },
                { label: 'Net Income', key: 'netIncome', bold: true, highlight: true },
                { label: 'EPS', key: 'eps', bold: true },
                { label: 'Shares (M)', key: 'shares' },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${BORDER}`, background: row.highlight ? 'rgba(245,166,35,0.05)' : 'transparent' }}>
                  <td style={{ padding: '5px 12px', paddingLeft: row.indent ? 24 : 12, color: row.bold ? WHITE : DIM, fontWeight: row.bold ? 'bold' : 'normal' }}>
                    {row.label}
                  </td>
                  {fins.map(f => {
                    const v = f[row.key as keyof FinancialPeriod] as number;
                    return (
                      <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: row.bold ? WHITE : TEXT }}>
                        {row.key === 'eps' ? `$${v.toFixed(2)}` : row.key === 'shares' ? `${v.toFixed(0)}` : fmtM(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Margins */}
              <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                <td colSpan={fins.length + 1} style={{ padding: '8px 12px', color: AMBER, fontWeight: 'bold', fontSize: 10 }}>MARGINS</td>
              </tr>
              {[
                { label: 'Gross Margin', calc: (f: FinancialPeriod) => (f.grossProfit / f.revenue * 100).toFixed(1) + '%' },
                { label: 'Operating Margin', calc: (f: FinancialPeriod) => (f.ebit / f.revenue * 100).toFixed(1) + '%' },
                { label: 'Net Margin', calc: (f: FinancialPeriod) => (f.netIncome / f.revenue * 100).toFixed(1) + '%' },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '5px 12px', color: DIM }}>{row.label}</td>
                  {fins.map(f => (
                    <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: CYAN }}>{row.calc(f)}</td>
                  ))}
                </tr>
              ))}
              {/* Growth */}
              <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                <td colSpan={fins.length + 1} style={{ padding: '8px 12px', color: AMBER, fontWeight: 'bold', fontSize: 10 }}>GROWTH RATES</td>
              </tr>
              {[
                { label: 'Revenue Growth', key: 'revenue' },
                { label: 'Net Income Growth', key: 'netIncome' },
                { label: 'EPS Growth', key: 'eps' },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '5px 12px', color: DIM }}>{row.label}</td>
                  {fins.map((f, i) => {
                    if (i === 0) return <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: DIM }}>—</td>;
                    const curr = f[row.key as keyof FinancialPeriod] as number;
                    const prev = fins[i - 1][row.key as keyof FinancialPeriod] as number;
                    const g = prev ? ((curr - prev) / Math.abs(prev) * 100) : 0;
                    return (
                      <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: g >= 0 ? GREEN : RED }}>
                        {g >= 0 ? '+' : ''}{g.toFixed(1)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Balance Sheet */}
        {tab === 1 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}`, minWidth: 180 }}>Line Item</th>
                {fins.map(f => <th key={f.period} style={{ padding: '6px 8px', textAlign: 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{f.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Total Assets', key: 'totalAssets', bold: true },
                { label: 'Cash & Equivalents', key: 'cash', indent: true },
                { label: 'Total Liabilities', key: 'totalLiabilities', bold: true },
                { label: 'Total Debt', key: 'debt', indent: true },
                { label: "Shareholders' Equity", key: 'equity', bold: true, highlight: true },
                { label: 'Current Ratio', key: 'currentRatio' },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${BORDER}`, background: row.highlight ? 'rgba(245,166,35,0.05)' : 'transparent' }}>
                  <td style={{ padding: '5px 12px', paddingLeft: row.indent ? 24 : 12, color: row.bold ? WHITE : DIM, fontWeight: row.bold ? 'bold' : 'normal' }}>
                    {row.label}
                  </td>
                  {fins.map(f => {
                    const v = f[row.key as keyof FinancialPeriod] as number;
                    return (
                      <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: row.bold ? WHITE : TEXT }}>
                        {row.key === 'currentRatio' ? v.toFixed(2) + 'x' : fmtM(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Cash Flow */}
        {tab === 2 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}`, minWidth: 180 }}>Line Item</th>
                {fins.map(f => <th key={f.period} style={{ padding: '6px 8px', textAlign: 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{f.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Net Income', key: 'netIncome', bold: true },
                { label: 'Cash from Operations', key: 'cfOps', bold: true },
                { label: 'Capital Expenditures', key: 'capex', indent: true },
                { label: 'Free Cash Flow', key: 'fcf', bold: true, highlight: true },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${BORDER}`, background: row.highlight ? 'rgba(245,166,35,0.05)' : 'transparent' }}>
                  <td style={{ padding: '5px 12px', paddingLeft: row.indent ? 24 : 12, color: row.bold ? WHITE : DIM, fontWeight: row.bold ? 'bold' : 'normal' }}>
                    {row.label}
                  </td>
                  {fins.map(f => {
                    const v = f[row.key as keyof FinancialPeriod] as number;
                    return (
                      <td key={f.period} style={{ padding: '5px 8px', textAlign: 'right', color: v >= 0 ? (row.bold ? WHITE : TEXT) : RED }}>
                        {row.key === 'capex' ? `(${fmtM(v)})` : fmtM(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Ratios */}
        {tab === 3 && (
          <div style={{ padding: 12 }}>
            {['Valuation', 'Profitability', 'Liquidity', 'Leverage', 'Cash Flow'].map(cat => {
              const catRatios = ratios.filter(r => r.category === cat);
              if (catRatios.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, padding: '4px 8px', background: 'rgba(245,166,35,0.05)', borderLeft: `3px solid ${AMBER}` }}>
                    {cat.toUpperCase()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {catRatios.map(r => {
                      const better = cat === 'Leverage' ? r.value < r.benchmark : r.value > r.benchmark;
                      return (
                        <div key={r.name} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
                          <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>{r.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ color: better ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>
                              {r.value.toFixed(1)}{r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}
                            </span>
                            <span style={{ color: DIM, fontSize: 10 }}>Bench: {r.benchmark}{r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DCF */}
        {tab === 4 && (
          <div style={{ padding: 12, display: 'flex', gap: 16 }}>
            {/* Inputs */}
            <div style={{ width: 280 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>DCF MODEL INPUTS</div>
              {[
                { label: 'Revenue Growth Y1 (%)', key: 'growthY1' as const },
                { label: 'Revenue Growth Y5 (%)', key: 'growthY5' as const },
                { label: 'Terminal Growth (%)', key: 'termGrowth' as const },
                { label: 'WACC (%)', key: 'wacc' as const },
                { label: 'Projection Years', key: 'years' as const },
              ].map(inp => (
                <div key={inp.key} style={{ marginBottom: 8 }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 2 }}>{inp.label}</div>
                  <input type="number" value={dcfInputs[inp.key]} onChange={e => setDcfInputs(prev => ({ ...prev, [inp.key]: parseFloat(e.target.value) || 0 }))}
                    step={inp.key === 'years' ? 1 : 0.5}
                    style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 11 }} />
                </div>
              ))}

              {dcfResult && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>VALUATION OUTPUT</div>
                  {[
                    { label: 'Enterprise Value', value: fmtM(dcfResult.ev) },
                    { label: 'Terminal Value', value: fmtM(dcfResult.terminalValue) },
                    { label: 'TV % of EV', value: ((dcfResult.terminalValue / Math.pow(1 + dcfInputs.wacc / 100, dcfInputs.years)) / dcfResult.ev * 100).toFixed(1) + '%' },
                    { label: 'Implied Price', value: '$' + (dcfResult.ev / (latestFin?.shares || 1)).toFixed(2) },
                    { label: 'Current Price', value: '$' + selectedCompany.price.toFixed(2) },
                    { label: 'Upside/Downside', value: ((dcfResult.ev / (latestFin?.shares || 1) / selectedCompany.price - 1) * 100).toFixed(1) + '%' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: DIM }}>{row.label}</span>
                      <span style={{ color: row.label === 'Upside/Downside' ? (parseFloat(row.value) >= 0 ? GREEN : RED) : WHITE, fontWeight: 'bold' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Projections table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>FCF PROJECTIONS</div>
              {dcfResult && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Year', 'Projected FCF', 'PV of FCF', 'Cumulative PV'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dcfResult.projections.map((fcf, i) => {
                      const pv = fcf / Math.pow(1 + dcfInputs.wacc / 100, i + 1);
                      const cumPV = dcfResult.projections.slice(0, i + 1).reduce((s, f, j) => s + f / Math.pow(1 + dcfInputs.wacc / 100, j + 1), 0);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: DIM }}>Y{i + 1}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: WHITE }}>{fmtM(fcf)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: CYAN }}>{fmtM(pv)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>{fmtM(cumPV)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Charts */}
        {tab === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
              {(['revenue', 'netIncome', 'fcf', 'eps'] as const).map(m => (
                <button key={m} onClick={() => setChartMetric(m)} style={{
                  padding: '4px 12px', background: chartMetric === m ? AMBER : '#1a1a1a', color: chartMetric === m ? '#000' : DIM,
                  border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{m.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{selectedCompany.ticker} — {selectedCompany.name}</span>
        <span style={{ color: DIM }}>Sector: {selectedCompany.sector}</span>
        <span style={{ color: DIM }}>Bloomberg FA Equivalent</span>
      </div>
    </div>
  );
}
