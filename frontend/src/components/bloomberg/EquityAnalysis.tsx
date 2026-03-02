import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'financials' | 'estimates' | 'ownership' | 'peers';

interface EquityAnalysisProps {
  symbol?: string;
  className?: string;
}

interface FinancialPeriod {
  period: string;
  revenue: number;
  netIncome: number;
  eps: number;
  ebitda: number;
  operatingCF: number;
  capex: number;
  freeCF: number;
}

interface AnalystRec {
  firm: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Overweight' | 'Underweight';
  target: number;
  date: string;
}

interface InsiderTx {
  name: string;
  title: string;
  type: 'Buy' | 'Sell';
  shares: number;
  price: number;
  date: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const COMPANY = {
  name: 'Apple Inc',
  ticker: 'AAPL US Equity',
  sector: 'Technology',
  industry: 'Consumer Electronics',
  exchange: 'NASDAQ',
  currency: 'USD',
  country: 'United States',
  employees: 164000,
  founded: 1976,
  ceo: 'Tim Cook',
  website: 'apple.com',
  description: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
};

const PRICE_DATA = {
  last: 189.84, open: 187.50, high: 191.20, low: 186.90,
  prevClose: 187.53, volume: 52340000, avgVolume: 58200000,
  week52High: 199.62, week52Low: 124.17, beta: 1.29,
  marketCap: 2980, enterpriseValue: 3040, sharesOut: 15700,
};

const KEY_STATS = {
  peRatio: 29.5, forwardPE: 27.8, pegRatio: 2.1,
  pbRatio: 45.2, psRatio: 7.6, evEbitda: 23.4,
  roe: 156.3, roa: 28.3, roic: 56.7,
  grossMargin: 45.5, operatingMargin: 30.7, netMargin: 25.3,
  debtEquity: 1.87, currentRatio: 0.99, quickRatio: 0.94,
  dividendYield: 0.52, payoutRatio: 15.3, dividendPerShare: 0.96,
};

const QUARTERLY: FinancialPeriod[] = [
  { period: 'Q4 2024', revenue: 119600, netIncome: 33900, eps: 2.18, ebitda: 46200, operatingCF: 39900, capex: 2900, freeCF: 37000 },
  { period: 'Q3 2024', revenue: 94900, netIncome: 22960, eps: 1.46, ebitda: 34100, operatingCF: 26810, capex: 2100, freeCF: 24710 },
  { period: 'Q2 2024', revenue: 85780, netIncome: 21450, eps: 1.40, ebitda: 31200, operatingCF: 28520, capex: 2500, freeCF: 26020 },
  { period: 'Q1 2024', revenue: 90750, netIncome: 23640, eps: 1.53, ebitda: 33800, operatingCF: 34010, capex: 2800, freeCF: 31210 },
  { period: 'Q4 2023', revenue: 117200, netIncome: 33520, eps: 2.10, ebitda: 44800, operatingCF: 39120, capex: 2700, freeCF: 36420 },
  { period: 'Q3 2023', revenue: 89500, netIncome: 22950, eps: 1.46, ebitda: 32900, operatingCF: 24160, capex: 2100, freeCF: 22060 },
];

const ANNUAL: FinancialPeriod[] = [
  { period: 'FY2024', revenue: 391030, netIncome: 101950, eps: 6.57, ebitda: 145300, operatingCF: 129240, capex: 10300, freeCF: 118940 },
  { period: 'FY2023', revenue: 383290, netIncome: 97000, eps: 6.13, ebitda: 137100, operatingCF: 110540, capex: 11000, freeCF: 99540 },
  { period: 'FY2022', revenue: 394330, netIncome: 99800, eps: 6.11, ebitda: 142300, operatingCF: 122150, capex: 10710, freeCF: 111440 },
];

const REVENUE_SEGMENTS = [
  { name: 'iPhone', value: 200600, pct: 51.3 },
  { name: 'Services', value: 85200, pct: 21.8 },
  { name: 'Mac', value: 29400, pct: 7.5 },
  { name: 'iPad', value: 28300, pct: 7.2 },
  { name: 'Wearables', value: 47530, pct: 12.2 },
];

const REVENUE_GEO = [
  { name: 'Americas', value: 169660, pct: 43.4 },
  { name: 'Europe', value: 94080, pct: 24.1 },
  { name: 'Greater China', value: 72560, pct: 18.5 },
  { name: 'Japan', value: 24890, pct: 6.4 },
  { name: 'Rest of Asia Pacific', value: 29840, pct: 7.6 },
];

const ANALYST_RECS: AnalystRec[] = [
  { firm: 'Morgan Stanley', rating: 'Overweight', target: 210, date: '2024-12-15' },
  { firm: 'Goldman Sachs', rating: 'Buy', target: 205, date: '2024-12-10' },
  { firm: 'JP Morgan', rating: 'Overweight', target: 215, date: '2024-12-08' },
  { firm: 'Bank of America', rating: 'Buy', target: 208, date: '2024-11-28' },
  { firm: 'Barclays', rating: 'Hold', target: 186, date: '2024-11-25' },
  { firm: 'UBS', rating: 'Buy', target: 200, date: '2024-11-20' },
  { firm: 'Deutsche Bank', rating: 'Hold', target: 190, date: '2024-11-15' },
  { firm: 'Citi', rating: 'Buy', target: 210, date: '2024-11-12' },
  { firm: 'Wells Fargo', rating: 'Overweight', target: 205, date: '2024-11-10' },
  { firm: 'RBC Capital', rating: 'Sell', target: 155, date: '2024-11-05' },
];

const EARNINGS_SURPRISES = [
  { period: 'Q4 2024', estimate: 2.10, actual: 2.18, surprise: 3.8 },
  { period: 'Q3 2024', estimate: 1.39, actual: 1.46, surprise: 5.0 },
  { period: 'Q2 2024', estimate: 1.35, actual: 1.40, surprise: 3.7 },
  { period: 'Q1 2024', estimate: 1.50, actual: 1.53, surprise: 2.0 },
  { period: 'Q4 2023', estimate: 2.08, actual: 2.10, surprise: 1.0 },
  { period: 'Q3 2023', estimate: 1.38, actual: 1.46, surprise: 5.8 },
];

const DIVIDENDS = [
  { date: '2024-11-15', amount: 0.25 }, { date: '2024-08-15', amount: 0.25 },
  { date: '2024-05-16', amount: 0.25 }, { date: '2024-02-15', amount: 0.24 },
  { date: '2023-11-16', amount: 0.24 }, { date: '2023-08-17', amount: 0.24 },
];

const INSIDER_TXS: InsiderTx[] = [
  { name: 'Tim Cook', title: 'CEO', type: 'Sell', shares: 511000, price: 188.50, date: '2024-11-20' },
  { name: 'Luca Maestri', title: 'CFO', type: 'Sell', shares: 176000, price: 190.20, date: '2024-10-15' },
  { name: 'Jeff Williams', title: 'COO', type: 'Sell', shares: 88000, price: 185.90, date: '2024-09-22' },
  { name: 'Deirdre O\'Brien', title: 'SVP', type: 'Sell', shares: 32000, price: 182.40, date: '2024-08-30' },
];

const PEERS = [
  { ticker: 'MSFT', name: 'Microsoft', price: 378.91, pe: 35.2, mc: 2810, rev: 227580, margin: 36.4 },
  { ticker: 'GOOGL', name: 'Alphabet', price: 141.80, pe: 25.3, mc: 1780, rev: 307390, margin: 25.7 },
  { ticker: 'AMZN', name: 'Amazon', price: 178.25, pe: 60.8, mc: 1860, rev: 574780, margin: 5.3 },
  { ticker: 'META', name: 'Meta', price: 505.48, pe: 27.1, mc: 1280, rev: 134900, margin: 33.4 },
  { ticker: 'NVDA', name: 'NVIDIA', price: 878.36, pe: 65.2, mc: 2160, rev: 60920, margin: 55.6 },
];

const INSTITUTIONS = [
  { name: 'Vanguard Group', shares: 1310, pct: 8.3 },
  { name: 'BlackRock', shares: 1040, pct: 6.6 },
  { name: 'Berkshire Hathaway', shares: 916, pct: 5.8 },
  { name: 'State Street', shares: 620, pct: 3.9 },
  { name: 'FMR LLC', shares: 390, pct: 2.5 },
];

const SHORT_INTEREST = { shares: 120, pctFloat: 0.77, daysToCover: 1.8, prevShares: 115 };

// ─── Sub-Components ─────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[#555] text-[11px]">{label}</span>
      <span className={`text-[11px] font-bold ${color ?? 'text-[#ccc]'}`}>{value}</span>
    </div>
  );
}

function BarSegment({ segments }: { segments: { name: string; pct: number; color: string }[] }) {
  return (
    <div className="space-y-1">
      <div className="flex h-4 rounded overflow-hidden">
        {segments.map(s => (
          <div key={s.name} className={`${s.color}`} style={{ width: `${s.pct}%` }}
            title={`${s.name}: ${s.pct}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(s => (
          <span key={s.name} className="flex items-center gap-1 text-[10px] text-[#888]">
            <span className={`w-2 h-2 rounded-sm ${s.color}`} />
            {s.name} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-16 h-2 bg-[#1a1a2e] rounded overflow-hidden">
      <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Segment Colors ─────────────────────────────────────────────────────────

const SEG_COLORS = ['bg-[#ff9900]', 'bg-[#00cc66]', 'bg-[#6699ff]', 'bg-[#cc66ff]', 'bg-[#66cccc]'];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EquityAnalysis({ symbol = 'AAPL US', className = '' }: EquityAnalysisProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [finPeriod, setFinPeriod] = useState<'quarterly' | 'annual'>('quarterly');

  const recSummary = useMemo(() => {
    const buy = ANALYST_RECS.filter(r => r.rating === 'Buy' || r.rating === 'Overweight').length;
    const hold = ANALYST_RECS.filter(r => r.rating === 'Hold').length;
    const sell = ANALYST_RECS.filter(r => r.rating === 'Sell' || r.rating === 'Underweight').length;
    const targets = ANALYST_RECS.map(r => r.target);
    return { buy, hold, sell, total: ANALYST_RECS.length, high: Math.max(...targets), low: Math.min(...targets), mean: targets.reduce((a, b) => a + b, 0) / targets.length };
  }, []);

  const segmentColors = REVENUE_SEGMENTS.map((s, i) => ({
    ...s, color: SEG_COLORS[i % SEG_COLORS.length],
  }));

  const geoColors = REVENUE_GEO.map((s, i) => ({
    ...s, color: SEG_COLORS[(i + 2) % SEG_COLORS.length],
  }));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'financials', label: 'FINANCIALS' },
    { key: 'estimates', label: 'ESTIMATES' },
    { key: 'ownership', label: 'OWNERSHIP' },
    { key: 'peers', label: 'PEERS' },
  ];

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#ff9900] font-bold text-sm">{COMPANY.name}</span>
            <span className="text-[#555] text-xs ml-2">{COMPANY.ticker}</span>
          </div>
          <div className="text-right">
            <span className="text-[#ccc] font-bold text-lg">{PRICE_DATA.last.toFixed(2)}</span>
            <span className={`text-sm ml-2 ${PRICE_DATA.last >= PRICE_DATA.prevClose ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
              {PRICE_DATA.last >= PRICE_DATA.prevClose ? '+' : ''}{(PRICE_DATA.last - PRICE_DATA.prevClose).toFixed(2)}
              ({((PRICE_DATA.last - PRICE_DATA.prevClose) / PRICE_DATA.prevClose * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-1 text-[10px] text-[#666]">
          <span>{COMPANY.exchange}</span>
          <span>{COMPANY.sector}</span>
          <span>{COMPANY.industry}</span>
          <span>{COMPANY.currency}</span>
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
        {tab === 'overview' && (
          <>
            {/* Price Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[#0f0f1e] rounded p-2">
                <Stat label="Open" value={PRICE_DATA.open.toFixed(2)} />
                <Stat label="High" value={PRICE_DATA.high.toFixed(2)} />
                <Stat label="Low" value={PRICE_DATA.low.toFixed(2)} />
                <Stat label="Prev Close" value={PRICE_DATA.prevClose.toFixed(2)} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <Stat label="Volume" value={`${(PRICE_DATA.volume / 1e6).toFixed(1)}M`} />
                <Stat label="Avg Volume" value={`${(PRICE_DATA.avgVolume / 1e6).toFixed(1)}M`} />
                <Stat label="52W High" value={PRICE_DATA.week52High.toFixed(2)} />
                <Stat label="52W Low" value={PRICE_DATA.week52Low.toFixed(2)} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <Stat label="Mkt Cap" value={`$${PRICE_DATA.marketCap.toFixed(0)}B`} />
                <Stat label="EV" value={`$${PRICE_DATA.enterpriseValue.toFixed(0)}B`} />
                <Stat label="Shares Out" value={`${PRICE_DATA.sharesOut.toFixed(0)}M`} />
                <Stat label="Beta" value={PRICE_DATA.beta.toFixed(2)} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <Stat label="P/E" value={KEY_STATS.peRatio.toFixed(1)} />
                <Stat label="Fwd P/E" value={KEY_STATS.forwardPE.toFixed(1)} />
                <Stat label="P/B" value={KEY_STATS.pbRatio.toFixed(1)} />
                <Stat label="EV/EBITDA" value={KEY_STATS.evEbitda.toFixed(1)} />
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0f0f1e] rounded p-2">
                <div className="text-[10px] text-[#555] mb-1 tracking-wider">PROFITABILITY</div>
                <Stat label="ROE" value={`${KEY_STATS.roe.toFixed(1)}%`} color="text-[#00cc66]" />
                <Stat label="ROA" value={`${KEY_STATS.roa.toFixed(1)}%`} color="text-[#00cc66]" />
                <Stat label="ROIC" value={`${KEY_STATS.roic.toFixed(1)}%`} color="text-[#00cc66]" />
                <Stat label="Gross Margin" value={`${KEY_STATS.grossMargin.toFixed(1)}%`} />
                <Stat label="Op Margin" value={`${KEY_STATS.operatingMargin.toFixed(1)}%`} />
                <Stat label="Net Margin" value={`${KEY_STATS.netMargin.toFixed(1)}%`} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <div className="text-[10px] text-[#555] mb-1 tracking-wider">LEVERAGE</div>
                <Stat label="D/E" value={KEY_STATS.debtEquity.toFixed(2)} />
                <Stat label="Current Ratio" value={KEY_STATS.currentRatio.toFixed(2)} />
                <Stat label="Quick Ratio" value={KEY_STATS.quickRatio.toFixed(2)} />
                <Stat label="PEG Ratio" value={KEY_STATS.pegRatio.toFixed(1)} />
                <Stat label="P/S" value={KEY_STATS.psRatio.toFixed(1)} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <div className="text-[10px] text-[#555] mb-1 tracking-wider">DIVIDEND</div>
                <Stat label="Yield" value={`${KEY_STATS.dividendYield.toFixed(2)}%`} color="text-[#ff9900]" />
                <Stat label="DPS" value={`$${KEY_STATS.dividendPerShare.toFixed(2)}`} />
                <Stat label="Payout Ratio" value={`${KEY_STATS.payoutRatio.toFixed(1)}%`} />
                <div className="mt-2 text-[10px] text-[#555] mb-0.5">HISTORY</div>
                {DIVIDENDS.slice(0, 4).map(d => (
                  <Stat key={d.date} label={d.date} value={`$${d.amount.toFixed(2)}`} />
                ))}
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f0f1e] rounded p-2">
                <div className="text-[10px] text-[#555] mb-2 tracking-wider">REVENUE BY SEGMENT</div>
                <BarSegment segments={segmentColors} />
              </div>
              <div className="bg-[#0f0f1e] rounded p-2">
                <div className="text-[10px] text-[#555] mb-2 tracking-wider">REVENUE BY GEOGRAPHY</div>
                <BarSegment segments={geoColors} />
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#0f0f1e] rounded p-2">
              <div className="text-[10px] text-[#555] mb-1 tracking-wider">DESCRIPTION</div>
              <p className="text-[11px] text-[#888] leading-relaxed">{COMPANY.description}</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Stat label="CEO" value={COMPANY.ceo} />
                <Stat label="Employees" value={COMPANY.employees.toLocaleString()} />
                <Stat label="Founded" value={String(COMPANY.founded)} />
              </div>
            </div>
          </>
        )}

        {tab === 'financials' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setFinPeriod('quarterly')}
                className={`px-3 py-1 text-[10px] rounded ${finPeriod === 'quarterly' ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555]'}`}
              >QUARTERLY</button>
              <button
                onClick={() => setFinPeriod('annual')}
                className={`px-3 py-1 text-[10px] rounded ${finPeriod === 'annual' ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555]'}`}
              >ANNUAL</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left text-[#555] py-1 pr-4">($M)</th>
                    {(finPeriod === 'quarterly' ? QUARTERLY : ANNUAL).map(p => (
                      <th key={p.period} className="text-right text-[#555] py-1 px-2">{p.period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Revenue', key: 'revenue' as const },
                    { label: 'EBITDA', key: 'ebitda' as const },
                    { label: 'Net Income', key: 'netIncome' as const },
                    { label: 'EPS', key: 'eps' as const },
                    { label: 'Operating CF', key: 'operatingCF' as const },
                    { label: 'CapEx', key: 'capex' as const },
                    { label: 'Free CF', key: 'freeCF' as const },
                  ].map(row => (
                    <tr key={row.label} className="border-b border-[#1a1a2e]/50 hover:bg-[#0f0f1e]">
                      <td className="text-[#888] py-1 pr-4">{row.label}</td>
                      {(finPeriod === 'quarterly' ? QUARTERLY : ANNUAL).map(p => (
                        <td key={p.period} className="text-right text-[#ccc] py-1 px-2">
                          {row.key === 'eps' ? p[row.key].toFixed(2) : p[row.key].toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Revenue Chart */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">REVENUE TREND</div>
              <div className="flex items-end gap-1 h-24">
                {(finPeriod === 'quarterly' ? QUARTERLY : ANNUAL).map(p => {
                  const maxRev = Math.max(...(finPeriod === 'quarterly' ? QUARTERLY : ANNUAL).map(q => q.revenue));
                  const pct = (p.revenue / maxRev) * 100;
                  return (
                    <div key={p.period} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-[#666]">{(p.revenue / 1000).toFixed(0)}B</span>
                      <div className="w-full bg-[#ff9900]/30 rounded-t" style={{ height: `${pct}%` }}>
                        <div className="w-full h-full bg-[#ff9900]/60 rounded-t" />
                      </div>
                      <span className="text-[8px] text-[#555] truncate">{p.period}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'estimates' && (
          <>
            {/* Analyst Recommendations */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">ANALYST RECOMMENDATIONS ({recSummary.total})</div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                  <span className="text-[#00cc66] font-bold text-lg">{recSummary.buy}</span>
                  <span className="text-[10px] text-[#555]">BUY</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[#ff9900] font-bold text-lg">{recSummary.hold}</span>
                  <span className="text-[10px] text-[#555]">HOLD</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[#ff3333] font-bold text-lg">{recSummary.sell}</span>
                  <span className="text-[10px] text-[#555]">SELL</span>
                </div>
              </div>
              <div className="flex h-3 rounded overflow-hidden mb-2">
                <div className="bg-[#00cc66]" style={{ width: `${(recSummary.buy / recSummary.total) * 100}%` }} />
                <div className="bg-[#ff9900]" style={{ width: `${(recSummary.hold / recSummary.total) * 100}%` }} />
                <div className="bg-[#ff3333]" style={{ width: `${(recSummary.sell / recSummary.total) * 100}%` }} />
              </div>
            </div>

            {/* Price Target */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">CONSENSUS PRICE TARGET</div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#ff3333]">${recSummary.low}</span>
                <div className="flex-1 mx-4 relative h-2 bg-[#1a1a2e] rounded">
                  <div
                    className="absolute h-full bg-[#ff9900]/30 rounded"
                    style={{
                      left: `${((recSummary.low - recSummary.low) / (recSummary.high - recSummary.low)) * 100}%`,
                      width: `${((recSummary.high - recSummary.low) / (recSummary.high - recSummary.low)) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute w-2 h-4 bg-[#ff9900] rounded -top-1"
                    style={{ left: `${((recSummary.mean - recSummary.low) / (recSummary.high - recSummary.low)) * 100}%` }}
                  />
                  <div
                    className="absolute w-1 h-4 bg-[#ccc] rounded -top-1"
                    style={{ left: `${((PRICE_DATA.last - recSummary.low) / (recSummary.high - recSummary.low)) * 100}%` }}
                  />
                </div>
                <span className="text-[#00cc66]">${recSummary.high}</span>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
                <span className="text-[#555]">Mean: <span className="text-[#ff9900] font-bold">${recSummary.mean.toFixed(0)}</span></span>
                <span className="text-[#555]">Current: <span className="text-[#ccc] font-bold">${PRICE_DATA.last}</span></span>
                <span className="text-[#555]">Upside: <span className={`font-bold ${recSummary.mean > PRICE_DATA.last ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                  {((recSummary.mean / PRICE_DATA.last - 1) * 100).toFixed(1)}%
                </span></span>
              </div>
            </div>

            {/* Individual Recs */}
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left text-[#555] py-1">Firm</th>
                  <th className="text-left text-[#555] py-1">Rating</th>
                  <th className="text-right text-[#555] py-1">Target</th>
                  <th className="text-right text-[#555] py-1">Date</th>
                </tr>
              </thead>
              <tbody>
                {ANALYST_RECS.map(r => (
                  <tr key={r.firm} className="border-b border-[#1a1a2e]/50 hover:bg-[#0f0f1e]">
                    <td className="text-[#888] py-1">{r.firm}</td>
                    <td className={`py-1 font-bold ${r.rating === 'Buy' || r.rating === 'Overweight' ? 'text-[#00cc66]' : r.rating === 'Hold' ? 'text-[#ff9900]' : 'text-[#ff3333]'}`}>
                      {r.rating}
                    </td>
                    <td className="text-right text-[#ccc] py-1">${r.target}</td>
                    <td className="text-right text-[#555] py-1">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Earnings Surprises */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">EARNINGS SURPRISES</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left text-[#555] py-1">Period</th>
                    <th className="text-right text-[#555] py-1">Est EPS</th>
                    <th className="text-right text-[#555] py-1">Act EPS</th>
                    <th className="text-right text-[#555] py-1">Surprise</th>
                  </tr>
                </thead>
                <tbody>
                  {EARNINGS_SURPRISES.map(e => (
                    <tr key={e.period} className="border-b border-[#1a1a2e]/50">
                      <td className="text-[#888] py-1">{e.period}</td>
                      <td className="text-right text-[#ccc] py-1">${e.estimate.toFixed(2)}</td>
                      <td className="text-right text-[#ccc] py-1">${e.actual.toFixed(2)}</td>
                      <td className={`text-right font-bold py-1 ${e.surprise >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                        {e.surprise >= 0 ? '+' : ''}{e.surprise.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'ownership' && (
          <>
            {/* Institutional */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">TOP INSTITUTIONAL HOLDERS</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left text-[#555] py-1">Institution</th>
                    <th className="text-right text-[#555] py-1">Shares (M)</th>
                    <th className="text-right text-[#555] py-1">% Out</th>
                    <th className="text-right text-[#555] py-1">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {INSTITUTIONS.map(inst => (
                    <tr key={inst.name} className="border-b border-[#1a1a2e]/50 hover:bg-[#111122]">
                      <td className="text-[#888] py-1">{inst.name}</td>
                      <td className="text-right text-[#ccc] py-1">{inst.shares.toLocaleString()}</td>
                      <td className="text-right text-[#ff9900] py-1">{inst.pct}%</td>
                      <td className="text-right py-1"><MiniBar value={inst.pct} max={10} color="bg-[#ff9900]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Insider Transactions */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">INSIDER TRANSACTIONS</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left text-[#555] py-1">Name</th>
                    <th className="text-left text-[#555] py-1">Title</th>
                    <th className="text-left text-[#555] py-1">Type</th>
                    <th className="text-right text-[#555] py-1">Shares</th>
                    <th className="text-right text-[#555] py-1">Price</th>
                    <th className="text-right text-[#555] py-1">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {INSIDER_TXS.map(tx => (
                    <tr key={`${tx.name}-${tx.date}`} className="border-b border-[#1a1a2e]/50 hover:bg-[#111122]">
                      <td className="text-[#888] py-1">{tx.name}</td>
                      <td className="text-[#666] py-1">{tx.title}</td>
                      <td className={`py-1 font-bold ${tx.type === 'Buy' ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>{tx.type}</td>
                      <td className="text-right text-[#ccc] py-1">{tx.shares.toLocaleString()}</td>
                      <td className="text-right text-[#ccc] py-1">${tx.price.toFixed(2)}</td>
                      <td className="text-right text-[#555] py-1">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Short Interest */}
            <div className="bg-[#0f0f1e] rounded p-3">
              <div className="text-[10px] text-[#555] mb-2 tracking-wider">SHORT INTEREST</div>
              <div className="grid grid-cols-4 gap-3">
                <Stat label="Short Shares" value={`${SHORT_INTEREST.shares}M`} />
                <Stat label="% of Float" value={`${SHORT_INTEREST.pctFloat}%`} />
                <Stat label="Days to Cover" value={SHORT_INTEREST.daysToCover.toFixed(1)} />
                <Stat label="Prev Period" value={`${SHORT_INTEREST.prevShares}M`} />
              </div>
            </div>
          </>
        )}

        {tab === 'peers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left text-[#555] py-1.5">Ticker</th>
                  <th className="text-left text-[#555] py-1.5">Name</th>
                  <th className="text-right text-[#555] py-1.5">Price</th>
                  <th className="text-right text-[#555] py-1.5">P/E</th>
                  <th className="text-right text-[#555] py-1.5">Mkt Cap (B)</th>
                  <th className="text-right text-[#555] py-1.5">Revenue (M)</th>
                  <th className="text-right text-[#555] py-1.5">Net Margin %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#ff9900]/30 bg-[#ff9900]/5">
                  <td className="text-[#ff9900] font-bold py-1.5">AAPL</td>
                  <td className="text-[#ff9900] py-1.5">{COMPANY.name}</td>
                  <td className="text-right text-[#ccc] py-1.5">${PRICE_DATA.last.toFixed(2)}</td>
                  <td className="text-right text-[#ccc] py-1.5">{KEY_STATS.peRatio.toFixed(1)}</td>
                  <td className="text-right text-[#ccc] py-1.5">{PRICE_DATA.marketCap}</td>
                  <td className="text-right text-[#ccc] py-1.5">{ANNUAL[0].revenue.toLocaleString()}</td>
                  <td className="text-right text-[#ccc] py-1.5">{KEY_STATS.netMargin.toFixed(1)}</td>
                </tr>
                {PEERS.map(p => (
                  <tr key={p.ticker} className="border-b border-[#1a1a2e]/50 hover:bg-[#0f0f1e]">
                    <td className="text-[#6699ff] font-bold py-1.5">{p.ticker}</td>
                    <td className="text-[#888] py-1.5">{p.name}</td>
                    <td className="text-right text-[#ccc] py-1.5">${p.price.toFixed(2)}</td>
                    <td className="text-right text-[#ccc] py-1.5">{p.pe.toFixed(1)}</td>
                    <td className="text-right text-[#ccc] py-1.5">{p.mc}</td>
                    <td className="text-right text-[#ccc] py-1.5">{p.rev.toLocaleString()}</td>
                    <td className="text-right text-[#ccc] py-1.5">{p.margin.toFixed(1)}</td>
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
