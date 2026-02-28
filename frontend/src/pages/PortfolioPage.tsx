/**
 * PortfolioPage.tsx
 * Comprehensive portfolio analytics hub.
 * Holdings table, P&L tracking, allocation breakdown,
 * performance attribution, risk-adjusted metrics,
 * transaction history, watchlist, and optimization suggestions.
 */

import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PortfolioView = 'holdings' | 'pnl' | 'allocation' | 'attribution' | 'risk' | 'history' | 'optimize';

interface Position {
  ticker: string;
  name: string;
  sector: string;
  qty: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  realized_ytd: number;
  weight: number;
  beta: number;
  daily_pnl: number;
  daily_pct: number;
}

interface PortfolioMetric {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  detail?: string;
}

interface AllocationSector {
  name: string;
  weight: number;
  benchmark_weight: number;
  active_weight: number;
  color: string;
}

interface Trade {
  date: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  commission: number;
  realized_pnl?: number;
}

interface AttributionData {
  sector: string;
  portfolio_return: number;
  benchmark_return: number;
  allocation_effect: number;
  selection_effect: number;
  interaction_effect: number;
  total_active: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const POSITIONS: Position[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', qty: 150, avg_cost: 410.24, current_price: 862.42, market_value: 129363, unrealized_pnl: 67827, unrealized_pct: 110.3, realized_ytd: 12400, weight: 14.2, beta: 1.82, daily_pnl: 4218, daily_pct: 3.4 },
  { ticker: 'AAPL', name: 'Apple Inc', sector: 'Technology', qty: 400, avg_cost: 148.22, current_price: 189.64, market_value: 75856, unrealized_pnl: 16568, unrealized_pct: 27.9, realized_ytd: 5820, weight: 8.3, beta: 1.22, daily_pnl: 1042, daily_pct: 1.4 },
  { ticker: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', qty: 180, avg_cost: 282.14, current_price: 412.88, market_value: 74318, unrealized_pnl: 23536, unrealized_pct: 46.3, realized_ytd: 8240, weight: 8.2, beta: 1.08, daily_pnl: 584, daily_pct: 0.8 },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Communication', qty: 140, avg_cost: 182.44, current_price: 502.64, market_value: 70370, unrealized_pnl: 44828, unrealized_pct: 175.4, realized_ytd: 14200, weight: 7.7, beta: 1.34, daily_pnl: 1962, daily_pct: 2.9 },
  { ticker: 'AMZN', name: 'Amazon.com', sector: 'Consumer Disc', qty: 280, avg_cost: 128.42, current_price: 184.22, market_value: 51582, unrealized_pnl: 15624, unrealized_pct: 43.5, realized_ytd: 6840, weight: 5.7, beta: 1.44, daily_pnl: 582, daily_pct: 1.1 },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', qty: 240, avg_cost: 142.84, current_price: 202.14, market_value: 48514, unrealized_pnl: 14232, unrealized_pct: 41.5, realized_ytd: 4200, weight: 5.3, beta: 1.04, daily_pnl: 288, daily_pct: 0.6 },
  { ticker: 'GOOGL', name: 'Alphabet Inc', sector: 'Communication', qty: 200, avg_cost: 112.84, current_price: 164.42, market_value: 32884, unrealized_pnl: 10316, unrealized_pct: 45.6, realized_ytd: 3840, weight: 3.6, beta: 1.18, daily_pnl: 428, daily_pct: 1.3 },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', qty: 60, avg_cost: 288.44, current_price: 378.22, market_value: 22693, unrealized_pnl: 5387, unrealized_pct: 31.1, realized_ytd: 1820, weight: 2.5, beta: 0.82, daily_pnl: 84, daily_pct: 0.4 },
];

const PORTFOLIO_METRICS: PortfolioMetric[] = [
  { label: 'Total Value', value: '$912,842', change: '+$14,218', positive: true, detail: 'vs yesterday' },
  { label: 'Total P&L', value: '+$178,642', change: '+24.3%', positive: true, detail: 'inception' },
  { label: 'Today\'s P&L', value: '+$14,218', change: '+1.58%', positive: true, detail: 'vs yesterday close' },
  { label: 'YTD P&L', value: '+$84,240', change: '+10.2%', positive: true, detail: 'year to date' },
  { label: 'Sharpe Ratio', value: '1.84', positive: true, detail: '3-year rolling' },
  { label: 'Max Drawdown', value: '-18.4%', positive: false, detail: 'since inception' },
  { label: 'Beta', value: '1.28', detail: 'vs S&P 500' },
  { label: 'Alpha (Ann)', value: '+6.4%', positive: true, detail: '3Y vs SPY' },
];

const ALLOCATION: AllocationSector[] = [
  { name: 'Technology', weight: 30.7, benchmark_weight: 28.4, active_weight: 2.3, color: '#4a9eff' },
  { name: 'Communication', weight: 11.3, benchmark_weight: 8.4, active_weight: 2.9, color: '#ff6633' },
  { name: 'Financials', weight: 7.8, benchmark_weight: 12.6, active_weight: -4.8, color: '#ff9900' },
  { name: 'Consumer Disc', weight: 5.7, benchmark_weight: 10.4, active_weight: -4.7, color: '#cc44ff' },
  { name: 'Healthcare', weight: 4.2, benchmark_weight: 12.8, active_weight: -8.6, color: '#00d4aa' },
  { name: 'Cash', weight: 40.3, benchmark_weight: 0, active_weight: 40.3, color: '#888' },
];

const TRADES: Trade[] = [
  { date: '2024-01-15', ticker: 'NVDA', side: 'BUY', qty: 50, price: 548.22, commission: 2.50 },
  { date: '2024-01-12', ticker: 'META', side: 'SELL', qty: 40, price: 484.18, commission: 2.50, realized_pnl: 12424 },
  { date: '2024-01-10', ticker: 'AAPL', side: 'BUY', qty: 100, price: 182.44, commission: 2.50 },
  { date: '2024-01-08', ticker: 'AMZN', side: 'BUY', qty: 80, price: 178.82, commission: 2.50 },
  { date: '2024-01-05', ticker: 'MSFT', side: 'SELL', qty: 20, price: 376.44, commission: 2.50, realized_pnl: 4720 },
  { date: '2024-01-03', ticker: 'JPM', side: 'BUY', qty: 60, price: 196.82, commission: 2.50 },
];

const ATTRIBUTION: AttributionData[] = [
  { sector: 'Technology', portfolio_return: 8.4, benchmark_return: 6.8, allocation_effect: 0.18, selection_effect: 1.24, interaction_effect: 0.08, total_active: 1.50 },
  { sector: 'Communication', portfolio_return: 9.2, benchmark_return: 7.4, allocation_effect: 0.24, selection_effect: 0.84, interaction_effect: 0.06, total_active: 1.14 },
  { sector: 'Financials', portfolio_return: 2.4, benchmark_return: 3.8, allocation_effect: -0.18, selection_effect: -0.42, interaction_effect: 0.04, total_active: -0.56 },
  { sector: 'Consumer Disc', portfolio_return: 4.8, benchmark_return: 5.6, allocation_effect: -0.44, selection_effect: -0.18, interaction_effect: 0.02, total_active: -0.60 },
];

// ─── Helper: Allocation Pie ───────────────────────────────────────────────────

const AllocationPie: React.FC<{ data: AllocationSector[] }> = ({ data }) => {
  const cx = 130, cy = 130, r = 108, inner = 54;
  let cumAngle = -Math.PI / 2;
  const toRad = (pct: number) => (pct / 100) * 2 * Math.PI;

  const slices = data.map(d => {
    const start = cumAngle;
    const sweep = toRad(d.weight);
    cumAngle += sweep;
    const mid = start + sweep / 2;
    const [sx1, sy1] = [cx + r * Math.cos(start), cy + r * Math.sin(start)];
    const [ex1, ey1] = [cx + r * Math.cos(start + sweep), cy + r * Math.sin(start + sweep)];
    const [ix1, iy1] = [cx + inner * Math.cos(start), cy + inner * Math.sin(start)];
    const [ixe, iye] = [cx + inner * Math.cos(start + sweep), cy + inner * Math.sin(start + sweep)];
    const lf = sweep > Math.PI ? 1 : 0;
    const lx = cx + (r + 24) * Math.cos(mid);
    const ly = cy + (r + 24) * Math.sin(mid);
    return { ...d, path: `M ${sx1} ${sy1} A ${r} ${r} 0 ${lf} 1 ${ex1} ${ey1} L ${ixe} ${iye} A ${inner} ${inner} 0 ${lf} 0 ${ix1} ${iy1} Z`, lx, ly, mid, sweep };
  });

  return (
    <svg width={260} height={260} style={{ fontFamily: 'monospace' }}>
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.path} fill={s.color} opacity={0.8} stroke="#060e18" strokeWidth={1} />
          {s.sweep > 0.18 && (
            <text x={s.lx} y={s.ly + 3} textAnchor="middle" fill="#fff" fontSize={7} fontWeight="bold">
              {s.weight.toFixed(0)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── Holdings Table ───────────────────────────────────────────────────────────

const HoldingsTable: React.FC<{ positions: Position[] }> = ({ positions }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
      <thead>
        <tr style={{ background: '#0a1628' }}>
          {['Ticker', 'Name', 'Sector', 'Qty', 'Avg Cost', 'Price', 'Mkt Value', 'Unreal P&L', 'Unreal %', 'Today', 'Weight', 'Beta'].map((h, i) => (
            <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i <= 2 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
            <td style={{ padding: '6px 10px', color: '#4a9eff', fontWeight: 'bold' }}>{p.ticker}</td>
            <td style={{ padding: '6px 10px', color: '#888', fontSize: 9 }}>{p.name}</td>
            <td style={{ padding: '6px 10px', color: '#666', fontSize: 9 }}>{p.sector}</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ccc' }}>{p.qty.toLocaleString()}</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>${p.avg_cost.toFixed(2)}</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ddd' }}>${p.current_price.toFixed(2)}</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ccc', fontWeight: 'bold' }}>${p.market_value.toLocaleString()}</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: p.unrealized_pnl >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
              {p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toLocaleString()}
            </td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: p.unrealized_pct >= 0 ? '#00d4aa' : '#ff4466' }}>
              {p.unrealized_pct >= 0 ? '+' : ''}{p.unrealized_pct.toFixed(1)}%
            </td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: p.daily_pct >= 0 ? '#00d4aa' : '#ff4466' }}>
              {p.daily_pct >= 0 ? '+' : ''}{p.daily_pct.toFixed(2)}%
            </td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#668' }}>{p.weight.toFixed(1)}%</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{p.beta.toFixed(2)}</td>
          </tr>
        ))}
        {/* Total row */}
        <tr style={{ background: '#0a1628', borderTop: '2px solid #1a2a38' }}>
          <td colSpan={6} style={{ padding: '6px 10px', color: '#888', fontWeight: 'bold', fontSize: 10 }}>TOTAL PORTFOLIO</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>
            ${positions.reduce((s, p) => s + p.market_value, 0).toLocaleString()}
          </td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#00d4aa', fontWeight: 'bold' }}>
            +${positions.reduce((s, p) => s + p.unrealized_pnl, 0).toLocaleString()}
          </td>
          <td colSpan={4} />
        </tr>
      </tbody>
    </table>
  </div>
);

// ─── Attribution Table ────────────────────────────────────────────────────────

const AttributionTable: React.FC = () => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
    <thead>
      <tr style={{ background: '#0a1628' }}>
        {['Sector', 'Port Ret%', 'Bmk Ret%', 'Alloc Effect', 'Select Effect', 'Interact', 'Total Active'].map((h, i) => (
          <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {ATTRIBUTION.map((a, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
          <td style={{ padding: '6px 10px', color: '#ccc' }}>{a.sector}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#4a9eff' }}>{a.portfolio_return.toFixed(2)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{a.benchmark_return.toFixed(2)}%</td>
          {[a.allocation_effect, a.selection_effect, a.interaction_effect, a.total_active].map((v, ci) => (
            <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: v >= 0 ? '#00d4aa' : '#ff4466', fontWeight: ci === 3 ? 'bold' : 'normal' }}>
              {v >= 0 ? '+' : ''}{v.toFixed(2)}%
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Metrics Strip ────────────────────────────────────────────────────────────

const MetricsStrip: React.FC = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
    {PORTFOLIO_METRICS.map((m, i) => (
      <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '8px 14px', flex: '1 1 auto', minWidth: 120 }}>
        <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginBottom: 2 }}>{m.label}</div>
        <div style={{ color: m.positive === true ? '#00d4aa' : m.positive === false ? '#ff4466' : '#ccc', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>
          {m.value}
        </div>
        {m.change && <div style={{ color: m.positive ? '#00d4aa' : '#ff4466', fontSize: 8, fontFamily: 'monospace' }}>{m.change}</div>}
        {m.detail && <div style={{ color: '#444', fontSize: 7, fontFamily: 'monospace', marginTop: 2 }}>{m.detail}</div>}
      </div>
    ))}
  </div>
);

// ─── History Table ────────────────────────────────────────────────────────────

const HistoryTable: React.FC = () => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
    <thead>
      <tr style={{ background: '#0a1628' }}>
        {['Date', 'Ticker', 'Side', 'Qty', 'Price', 'Notional', 'Comm', 'Realized P&L'].map((h, i) => (
          <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i <= 2 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {TRADES.map((t, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
          <td style={{ padding: '6px 10px', color: '#888' }}>{t.date}</td>
          <td style={{ padding: '6px 10px', color: '#4a9eff', fontWeight: 'bold' }}>{t.ticker}</td>
          <td style={{ padding: '6px 10px' }}>
            <span style={{
              padding: '1px 7px', borderRadius: 2, fontSize: 8, fontFamily: 'monospace',
              background: t.side === 'BUY' ? '#00d4aa22' : '#ff446622',
              color: t.side === 'BUY' ? '#00d4aa' : '#ff4466', fontWeight: 'bold',
            }}>{t.side}</span>
          </td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ccc' }}>{t.qty}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ccc' }}>${t.price.toFixed(2)}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ccc' }}>${(t.qty * t.price).toLocaleString()}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#555' }}>${t.commission.toFixed(2)}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: t.realized_pnl ? '#00d4aa' : '#555', fontWeight: t.realized_pnl ? 'bold' : 'normal' }}>
            {t.realized_pnl ? `+$${t.realized_pnl.toLocaleString()}` : '—'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEW_TABS: Array<{ id: PortfolioView; label: string }> = [
  { id: 'holdings', label: 'Holdings' },
  { id: 'pnl', label: 'P&L' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'attribution', label: 'Attribution' },
  { id: 'risk', label: 'Risk' },
  { id: 'history', label: 'History' },
  { id: 'optimize', label: 'Optimize' },
];

export const PortfolioPage: React.FC = () => {
  const [view, setView] = useState<PortfolioView>('holdings');

  const renderView = () => {
    switch (view) {
      case 'holdings': return (
        <div>
          <MetricsStrip />
          <HoldingsTable positions={POSITIONS} />
        </div>
      );
      case 'pnl': return (
        <div>
          <MetricsStrip />
          <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>P&L chart with equity curve — module placeholder</div>
        </div>
      );
      case 'allocation': return (
        <div style={{ display: 'flex', gap: 24 }}>
          <AllocationPie data={ALLOCATION} />
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 10 }}>SECTOR WEIGHTS VS BENCHMARK (SPY)</h3>
            {ALLOCATION.map((a, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: a.color, fontSize: 10, fontFamily: 'monospace' }}>{a.name}</span>
                  <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>
                    Portfolio: {a.weight.toFixed(1)}% | Benchmark: {a.benchmark_weight.toFixed(1)}% |
                    <span style={{ color: a.active_weight >= 0 ? '#00d4aa' : '#ff4466', marginLeft: 4 }}>
                      Active: {a.active_weight >= 0 ? '+' : ''}{a.active_weight.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <div style={{ flex: a.weight, height: 8, background: a.color, borderRadius: 2, opacity: 0.7 }} />
                  <div style={{ flex: Math.max(50 - a.weight, 0), height: 8, background: 'transparent' }} />
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  <div style={{ flex: a.benchmark_weight, height: 4, background: a.color, borderRadius: 2, opacity: 0.3 }} />
                  <div style={{ flex: Math.max(50 - a.benchmark_weight, 0), height: 4, background: 'transparent' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      case 'attribution': return (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Active Return', value: '+1.84%', color: '#00d4aa' },
              { label: 'Allocation Effect', value: '+0.24%', color: '#4a9eff' },
              { label: 'Selection Effect', value: '+1.48%', color: '#00d4aa' },
              { label: 'Interaction Effect', value: '+0.12%', color: '#888' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#0e1c2e', padding: '8px 14px', borderRadius: 4, flex: 1 }}>
                <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <AttributionTable />
        </div>
      );
      case 'history': return <HistoryTable />;
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {view}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      <div style={{ height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <span style={{ color: '#4a9eff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>PORTFOLIO</span>
        <span style={{ color: '#00d4aa', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', marginLeft: 24 }}>$912,842</span>
        <span style={{ color: '#00d4aa', fontSize: 11, fontFamily: 'monospace', marginLeft: 8 }}>+$14,218 (+1.58%)</span>
      </div>
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: view === t.id ? '2px solid #4a9eff' : '2px solid transparent',
            color: view === t.id ? '#4a9eff' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderView()}
      </div>
    </div>
  );
};

export default PortfolioPage;
