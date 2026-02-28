/**
 * PortfolioUI2Husk — Bloomberg Terminal Portfolio Page Skeleton
 *
 * Layout:
 *  ┌──────────────────────────────────────┬─────────────────┐
 *  │ TAB BAR: Holdings | Risk | Perf | … │                 │
 *  ├──────────────────────────────────────┤  SUMMARY PANEL  │
 *  │  HOLDINGS TABLE (placeholder rows)  │  P&L / Exposure │
 *  ├──────────────────────────────────────┤                 │
 *  │  ALLOCATION BAR CHART               │                 │
 *  └──────────────────────────────────────┴─────────────────┘
 */
import React, { useState } from 'react';
import { BG, PANEL, AMBER, GREEN, RED, TEXT, SUBTLE, MONO, BORDER, panelStyle, panelHdr } from './ui2-tokens';

type Tab = 'Holdings' | 'Risk' | 'Performance' | 'Correlation' | 'Exposure';

const TABS: Tab[] = ['Holdings', 'Risk', 'Performance', 'Correlation', 'Exposure'];

const MOCK_ROWS = [
  { symbol: 'AAPL',  qty: 500,  avgCost: 165.20, last: 185.30, pnl: +10_050, pnlPct: +12.1 },
  { symbol: 'MSFT',  qty: 300,  avgCost: 388.40, last: 415.60, pnl: +8_160,  pnlPct: +7.0  },
  { symbol: 'NVDA',  qty: 200,  avgCost: 680.00, last: 874.20, pnl: +38_840, pnlPct: +28.6 },
  { symbol: 'TSLA',  qty: 150,  avgCost: 210.80, last: 175.40, pnl: -5_310,  pnlPct: -16.8 },
  { symbol: 'SPY',   qty: 1000, avgCost: 502.30, last: 518.70, pnl: +16_400, pnlPct: +3.3  },
  { symbol: 'GLD',   qty: 400,  avgCost: 183.50, last: 192.80, pnl: +3_720,  pnlPct: +5.1  },
];

function fmt2(n: number) { return Math.abs(n).toFixed(2); }
function fmtK(n: number) { const s = n < 0 ? '-' : '+'; return `${s}$${(Math.abs(n) / 1000).toFixed(1)}K`; }

export function PortfolioUI2Husk(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('Holdings');

  const totalPnl  = MOCK_ROWS.reduce((s, r) => s + r.pnl, 0);
  const totalMktv  = MOCK_ROWS.reduce((s, r) => s + r.qty * r.last, 0);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', background: 'transparent',
    color: tab === t ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`,
    letterSpacing: '0.1em',
  });

  const th: React.CSSProperties = { padding: '4px 10px', fontSize: 9, color: SUBTLE, fontFamily: MONO, fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', letterSpacing: '0.1em' };
  const td: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontFamily: MONO, textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.5)` };

  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: MONO, color: TEXT, padding: 8, gap: 8 }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{t.toUpperCase()}</button>)}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 8 }}>

        {/* Main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Holdings table */}
          <div style={{ ...panelStyle, flex: 2 }}>
            <div style={panelHdr}>POSITIONS · {MOCK_ROWS.length} SYMBOLS</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: PANEL, position: 'sticky', top: 0 }}>
                    {['Symbol', 'Qty', 'Avg Cost', 'Last', 'Mkt Value', 'P&L', 'P&L %'].map(h => (
                      <th key={h} style={{ ...th, textAlign: h === 'Symbol' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ROWS.map((r, i) => (
                    <tr key={r.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.02)' : 'transparent' }}>
                      <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{r.symbol}</td>
                      <td style={td}>{r.qty.toLocaleString()}</td>
                      <td style={td}>{fmt2(r.avgCost)}</td>
                      <td style={{ ...td, color: r.pnl >= 0 ? GREEN : RED }}>{fmt2(r.last)}</td>
                      <td style={td}>${(r.qty * r.last / 1000).toFixed(1)}K</td>
                      <td style={{ ...td, color: r.pnl >= 0 ? GREEN : RED }}>{fmtK(r.pnl)}</td>
                      <td style={{ ...td, color: r.pnlPct >= 0 ? GREEN : RED }}>{r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation bar */}
          <div style={{ ...panelStyle, flexShrink: 0 }}>
            <div style={panelHdr}>SECTOR ALLOCATION</div>
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['Technology', 68, AMBER], ['Consumer', 12, GREEN], ['Industrials', 10, '#4da6ff'], ['Commodities', 10, '#c084fc']].map(([label, pct, col]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 90, fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{label as string}</div>
                  <div style={{ flex: 1, height: 6, background: 'rgba(30,30,46,0.7)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col as string }} />
                  </div>
                  <div style={{ width: 36, fontSize: 10, color: col as string, textAlign: 'right', fontFamily: MONO }}>{pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'TOTAL MKT VALUE', value: `$${(totalMktv / 1e6).toFixed(2)}M`, color: TEXT },
            { label: 'UNREALISED P&L',  value: fmtK(totalPnl),                       color: totalPnl >= 0 ? GREEN : RED },
            { label: 'DAY P&L',         value: '+$4.2K',                              color: GREEN },
            { label: 'CASH',            value: '$124,800',                            color: TEXT },
            { label: 'BUYING POWER',    value: '$249,600',                            color: AMBER },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...panelStyle, flexShrink: 0 }}>
              <div style={panelHdr}>{label}</div>
              <div style={{ padding: '10px 14px', fontSize: 22, color, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.04em' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
