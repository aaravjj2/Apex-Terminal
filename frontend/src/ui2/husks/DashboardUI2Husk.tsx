/**
 * DashboardUI2Husk — Bloomberg Terminal Dashboard Page Skeleton
 *
 * Layout:
 *  ┌────────────────────────────────────────────────────────┐
 *  │  MARKET SNAPSHOT (ticker row)                         │
 *  ├──────────────┬───────────────────────┬────────────────┤
 *  │ SECTOR MAP   │ PORTFOLIO KPIs (3×2)  │ NEWS & ALERTS  │
 *  ├──────────────┴───────────────────────┴────────────────┤
 *  │  POSITIONS MINI-TABLE                                 │
 *  └────────────────────────────────────────────────────────┘
 */
import { BG, AMBER, GREEN, RED, TEXT, SUBTLE, MONO, BORDER, panelStyle, panelHdr } from './ui2-tokens';
import React from 'react';

const TICKERS = [
  { sym: 'SPY',  last: '518.70', chg: '+0.82%', up: true  },
  { sym: 'QQQ',  last: '442.30', chg: '+1.14%', up: true  },
  { sym: 'AAPL', last: '185.30', chg: '+0.55%', up: true  },
  { sym: 'MSFT', last: '415.60', chg: '-0.22%', up: false },
  { sym: 'NVDA', last: '874.20', chg: '+2.30%', up: true  },
  { sym: 'TSLA', last: '175.40', chg: '-1.92%', up: false },
  { sym: 'BTC',  last: '62,410', chg: '+3.41%', up: true  },
  { sym: 'GLD',  last: '192.80', chg: '+0.18%', up: true  },
];

const KPI_CARDS = [
  { label: 'Portfolio NAV',    value: '$2.41M',   sub: '+$28.4K today',    col: GREEN },
  { label: 'Day P&L',          value: '+$28.4K',  sub: '+1.19% vs prev',   col: GREEN },
  { label: 'Total Unrealised', value: '+$71.9K',  sub: 'across 6 symbols', col: GREEN },
  { label: 'Open Orders',      value: '3',        sub: '2 limit, 1 stop',  col: AMBER },
  { label: 'Buying Power',     value: '$249.6K',  sub: '10.4% of NAV',     col: TEXT  },
  { label: 'Risk Score',       value: '62 / 100', sub: 'Moderate risk',    col: AMBER },
];

const NEWS_ITEMS = [
  { time: '09:42', headline: 'Fed signals rate path unchanged for Q2' },
  { time: '09:31', headline: 'NVDA beats EPS by 18¢; guidance raised' },
  { time: '09:15', headline: 'CPI in-line at 2.8% YoY; core 3.1%' },
  { time: '08:50', headline: 'TSLA recall affects 240K vehicles in EU' },
  { time: '08:22', headline: 'SPX futures +0.6% on tech momentum' },
];

export function DashboardUI2Husk(): React.JSX.Element {
  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: MONO, color: TEXT, padding: 8, gap: 8 }}>

      {/* ── Ticker strip ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, padding: '5px 12px', background: '#060608', border: `1px solid ${BORDER}`, flexShrink: 0, overflowX: 'auto' }}>
        {TICKERS.map(t => (
          <div key={t.sym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: AMBER, fontWeight: 700, fontSize: 11 }}>{t.sym}</span>
            <span style={{ color: TEXT, fontSize: 12 }}>{t.last}</span>
            <span style={{ color: t.up ? GREEN : RED, fontSize: 10 }}>{t.chg}</span>
          </div>
        ))}
      </div>

      {/* ── Main 3-column row ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 240px', gap: 8 }}>

        {/* Sector heatmap */}
        <div style={{ ...panelStyle }}>
          <div style={panelHdr}>SECTOR HEATMAP</div>
          <div style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, flex: 1 }}>
            {[
              ['Technology', +2.3, '#ff9900'],
              ['Financials', +0.8, '#00d88a'],
              ['Healthcare', -0.4, '#ff3b5c'],
              ['Energy',     +1.1, '#00d88a'],
              ['Utilities',  -0.2, '#ff3b5c'],
              ['Materials',  +0.5, '#00d88a'],
              ['Industrials',+0.3, '#00d88a'],
              ['Cons.Disc.', -1.2, '#ff3b5c'],
            ].map(([name, chg, col]) => (
              <div key={name as string} style={{
                background: (col as string) + '22',
                border: `1px solid ${col}44`,
                padding: '6px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span style={{ color: TEXT, fontSize: 9 }}>{name as string}</span>
                <span style={{ color: col as string, fontWeight: 700, fontSize: 12 }}>{(chg as number) >= 0 ? '+' : ''}{chg}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8 }}>
          {KPI_CARDS.map(k => (
            <div key={k.label} style={{ ...panelStyle }}>
              <div style={panelHdr}>{k.label}</div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 20, color: k.col, fontWeight: 700, letterSpacing: '0.04em' }}>{k.value}</div>
                <div style={{ fontSize: 10, color: SUBTLE, marginTop: 3 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* News */}
        <div style={{ ...panelStyle }}>
          <div style={panelHdr}>NEWS & ALERTS</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {NEWS_ITEMS.map((n, i) => (
              <div key={i} style={{ padding: '6px 10px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>{n.time}</div>
                <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{n.headline}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Positions mini table ───────────────────────────── */}
      <div style={{ ...panelStyle, flexShrink: 0 }}>
        <div style={panelHdr}>OPEN POSITIONS · 6 SYMBOLS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#080810' }}>
              {['Symbol', 'Qty', 'Last', 'P&L', 'P&L %', 'Weight'].map(h => (
                <th key={h} style={{ padding: '4px 10px', textAlign: h === 'Symbol' ? 'left' : 'right', fontSize: 9, color: SUBTLE, fontFamily: MONO, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['AAPL', '500', '185.30', '+$10.1K', '+12.1%', '19.5%', true],
              ['MSFT', '300', '415.60', '+$8.2K',  '+7.0%',  '26.3%', true],
              ['NVDA', '200', '874.20', '+$38.8K', '+28.6%', '36.8%', true],
              ['TSLA', '150', '175.40', '-$5.3K',  '-16.8%', '5.5%',  false],
            ].map(([sym, qty, last, pnl, pp, wt, up], i) => (
              <tr key={sym as string} style={{ background: i % 2 === 0 ? 'rgba(255,153,0,0.02)' : 'transparent' }}>
                <td style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 11, color: AMBER, fontWeight: 700, borderBottom: `1px solid rgba(30,30,46,0.4)` }}>{sym as string}</td>
                {[qty, last].map(v => <td key={v as string} style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 11, color: TEXT, textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.4)` }}>{v as string}</td>)}
                {[pnl, pp].map(v => <td key={v as string} style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 11, color: (up as boolean) ? GREEN : RED, textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.4)` }}>{v as string}</td>)}
                <td style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 11, color: SUBTLE, textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.4)` }}>{wt as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
