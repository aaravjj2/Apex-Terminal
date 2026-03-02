import React, { useState, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface CreditEntity {
  name: string; ticker: string; sector: string; rating: string; outlook: string;
  cds5y: number; cdsChange: number; pd1y: number; pd5y: number; lgd: number;
  zSpread: number; oasSpread: number; debtOutstanding: number;
  netLeverage: number; intCoverage: number; altmanZ: number;
}

const RATINGS_ORDER = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC', 'CC', 'C', 'D'];

function genEntity(name: string, ticker: string, sector: string, ratingLevel: number): CreditEntity {
  const r = () => Math.random();
  const rating = RATINGS_ORDER[Math.min(ratingLevel + Math.floor(r() * 3 - 1), RATINGS_ORDER.length - 1)];
  const baseCDS = ratingLevel < 5 ? 20 + r() * 40 : ratingLevel < 10 ? 80 + r() * 200 : 300 + r() * 500;
  return {
    name, ticker, sector, rating, outlook: r() > 0.7 ? 'Negative' : r() > 0.4 ? 'Stable' : 'Positive',
    cds5y: baseCDS, cdsChange: -10 + r() * 20, pd1y: baseCDS * 0.01 + r() * 0.5,
    pd5y: baseCDS * 0.05 + r() * 2, lgd: 30 + r() * 40,
    zSpread: baseCDS * 0.8 + r() * 30, oasSpread: baseCDS * 0.75 + r() * 25,
    debtOutstanding: 5e9 + r() * 100e9, netLeverage: 0.5 + ratingLevel * 0.3 + r() * 1.5,
    intCoverage: Math.max(1, 15 - ratingLevel * 1.2 + r() * 4),
    altmanZ: Math.max(0.5, 5 - ratingLevel * 0.4 + r() * 1.5),
  };
}

const ENTITIES: CreditEntity[] = [
  genEntity('Apple Inc.', 'AAPL', 'Technology', 1),
  genEntity('Microsoft Corp.', 'MSFT', 'Technology', 1),
  genEntity('Johnson & Johnson', 'JNJ', 'Healthcare', 2),
  genEntity('JPMorgan Chase', 'JPM', 'Financial', 3),
  genEntity('Goldman Sachs', 'GS', 'Financial', 3),
  genEntity('AT&T Inc.', 'T', 'Telecom', 7),
  genEntity('Ford Motor Co.', 'F', 'Automotive', 9),
  genEntity('General Motors', 'GM', 'Automotive', 8),
  genEntity('Delta Air Lines', 'DAL', 'Airlines', 8),
  genEntity('Carnival Corp.', 'CCL', 'Leisure', 11),
  genEntity('AMC Entertainment', 'AMC', 'Entertainment', 14),
  genEntity('Carvana Co.', 'CVNA', 'Retail', 13),
  genEntity('Boeing Co.', 'BA', 'Aerospace', 7),
  genEntity('Verizon Comm.', 'VZ', 'Telecom', 6),
  genEntity('Walt Disney', 'DIS', 'Entertainment', 4),
  genEntity('Netflix Inc.', 'NFLX', 'Entertainment', 5),
  genEntity('Tesla Inc.', 'TSLA', 'Automotive', 6),
  genEntity('Amazon.com', 'AMZN', 'Technology', 2),
  genEntity('Bank of America', 'BAC', 'Financial', 4),
  genEntity('Citigroup Inc.', 'C', 'Financial', 5),
];

// Transition matrix (simplified 7x7: AAA, AA, A, BBB, BB, B, CCC/D)
const TRANSITION_MATRIX = [
  [90.81, 8.33, 0.68, 0.06, 0.12, 0.00, 0.00],
  [0.70, 90.65, 7.79, 0.64, 0.06, 0.14, 0.02],
  [0.09, 2.27, 91.05, 5.52, 0.74, 0.26, 0.07],
  [0.02, 0.33, 5.95, 86.93, 5.30, 1.17, 0.30],
  [0.03, 0.14, 0.67, 7.73, 80.53, 8.84, 2.06],
  [0.00, 0.11, 0.24, 0.43, 6.48, 83.46, 9.28],
  [0.22, 0.00, 0.22, 1.30, 2.38, 11.24, 84.64],
];
const MATRIX_LABELS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC/D'];

function fmtB(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  return '$' + (v / 1e6).toFixed(0) + 'M';
}

function drawCDSChart(ctx: CanvasRenderingContext2D, w: number, h: number, entities: CreditEntity[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 15, bottom: 45, left: 55 };
  const sorted = [...entities].sort((a, b) => a.cds5y - b.cds5y);
  const maxCDS = Math.max(...sorted.map(e => e.cds5y));

  ctx.fillStyle = AMBER; ctx.font = 'bold 11px monospace';
  ctx.fillText('CDS SPREADS (5Y)', pad.left, 16);

  const barW = Math.max(12, ((w - pad.left - pad.right) / sorted.length) - 4);

  sorted.forEach((e, i) => {
    const x = pad.left + i * ((w - pad.left - pad.right) / sorted.length) + 2;
    const barH = (e.cds5y / maxCDS) * (h - pad.top - pad.bottom);
    const y = h - pad.bottom - barH;

    // Color by rating
    const rIdx = RATINGS_ORDER.indexOf(e.rating);
    const color = rIdx < 5 ? GREEN : rIdx < 10 ? AMBER : RED;
    ctx.fillStyle = color; ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y, barW, barH);
    ctx.globalAlpha = 1;

    // Value
    ctx.fillStyle = WHITE; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText(e.cds5y.toFixed(0), x + barW / 2, y - 4);

    // Ticker
    ctx.fillStyle = DIM;
    ctx.save(); ctx.translate(x + barW / 2, h - pad.bottom + 8); ctx.rotate(Math.PI / 4);
    ctx.textAlign = 'left'; ctx.fillText(e.ticker, 0, 0); ctx.restore();
  });
  ctx.textAlign = 'left';
}

const TABS = ['Dashboard', 'CDS Spreads', 'PD Models', 'Transition Matrix', 'CVA/DVA', 'Watchlist'];

export default function CreditRiskUI2() {
  const [tab, setTab] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState<CreditEntity | null>(null);
  const [sectorFilter, setSectorFilter] = useState('All');
  const chartRef = useRef<HTMLCanvasElement>(null);

  const allSectors = ['All', ...new Set(ENTITIES.map(e => e.sector))];
  const filtered = sectorFilter === 'All' ? ENTITIES : ENTITIES.filter(e => e.sector === sectorFilter);

  useEffect(() => {
    if (tab !== 1) return;
    const c = chartRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawCDSChart(ctx, r.width, r.height, filtered);
  }, [tab, filtered]);

  // Summary metrics
  const avgCDS = filtered.reduce((a, e) => a + e.cds5y, 0) / filtered.length;
  const igCount = filtered.filter(e => RATINGS_ORDER.indexOf(e.rating) < 10).length;
  const hyCount = filtered.filter(e => RATINGS_ORDER.indexOf(e.rating) >= 10).length;
  const negOutlook = filtered.filter(e => e.outlook === 'Negative').length;

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>⚠️ CREDIT RISK ANALYTICS</span>
        <span style={{ color: DIM }}>|</span>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
          {allSectors.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ color: DIM }}>{filtered.length} entities</span>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', padding: '6px 16px', gap: 24, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {[
          { label: 'Avg CDS 5Y', value: avgCDS.toFixed(0) + ' bps', color: avgCDS > 200 ? RED : avgCDS > 100 ? AMBER : GREEN },
          { label: 'IG Count', value: igCount.toString(), color: GREEN },
          { label: 'HY Count', value: hyCount.toString(), color: hyCount > igCount ? RED : AMBER },
          { label: 'Neg Outlook', value: negOutlook.toString(), color: negOutlook > 0 ? RED : GREEN },
        ].map(s => (
          <div key={s.label}>
            <div style={{ color: DIM, fontSize: 9 }}>{s.label}</div>
            <div style={{ color: s.color, fontWeight: 'bold' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '6px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Dashboard */}
        {tab === 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                {['Entity', 'Rating', 'Outlook', 'CDS 5Y', 'Δ', 'PD 1Y', 'PD 5Y', 'LGD', 'Z-Spread', 'Net Lev', 'Int Cov', 'Altman Z', 'Debt'].map(h => (
                  <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Entity' ? 'left' : 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => b.cds5y - a.cds5y).map(e => {
                const rIdx = RATINGS_ORDER.indexOf(e.rating);
                const rColor = rIdx < 5 ? GREEN : rIdx < 10 ? AMBER : RED;
                return (
                  <tr key={e.ticker} onClick={() => setSelectedEntity(e)} style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: selectedEntity?.ticker === e.ticker ? 'rgba(245,166,35,0.08)' : 'transparent' }}>
                    <td style={{ padding: '4px 6px' }}>
                      <span style={{ color: AMBER, fontWeight: 'bold' }}>{e.ticker}</span>
                      <span style={{ color: DIM, marginLeft: 6, fontSize: 10 }}>{e.name}</span>
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: rColor, fontWeight: 'bold' }}>{e.rating}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.outlook === 'Negative' ? RED : e.outlook === 'Positive' ? GREEN : DIM }}>{e.outlook}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.cds5y > 300 ? RED : e.cds5y > 100 ? AMBER : TEXT, fontWeight: 'bold' }}>{e.cds5y.toFixed(0)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.cdsChange > 0 ? RED : GREEN }}>{e.cdsChange > 0 ? '+' : ''}{e.cdsChange.toFixed(1)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.pd1y > 2 ? RED : TEXT }}>{e.pd1y.toFixed(2)}%</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.pd5y > 5 ? RED : TEXT }}>{e.pd5y.toFixed(2)}%</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: TEXT }}>{e.lgd.toFixed(0)}%</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: DIM }}>{e.zSpread.toFixed(0)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.netLeverage > 4 ? RED : TEXT }}>{e.netLeverage.toFixed(1)}x</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.intCoverage < 3 ? RED : TEXT }}>{e.intCoverage.toFixed(1)}x</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: e.altmanZ < 1.8 ? RED : e.altmanZ > 3 ? GREEN : AMBER }}>{e.altmanZ.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: DIM }}>{fmtB(e.debtOutstanding)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* CDS Chart */}
        {tab === 1 && (
          <div style={{ height: '100%', position: 'relative' }}>
            <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* PD Models */}
        {tab === 2 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>PROBABILITY OF DEFAULT MODELS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filtered.sort((a, b) => b.pd5y - a.pd5y).map(e => (
                <div key={e.ticker} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: AMBER, fontWeight: 'bold' }}>{e.ticker}</span>
                    <span style={{ color: RATINGS_ORDER.indexOf(e.rating) < 5 ? GREEN : RATINGS_ORDER.indexOf(e.rating) < 10 ? AMBER : RED }}>{e.rating}</span>
                  </div>
                  {[
                    { label: 'PD 1Y', value: e.pd1y, color: e.pd1y > 2 ? RED : e.pd1y > 0.5 ? AMBER : GREEN },
                    { label: 'PD 5Y', value: e.pd5y, color: e.pd5y > 5 ? RED : e.pd5y > 2 ? AMBER : GREEN },
                    { label: 'LGD', value: e.lgd, color: e.lgd > 60 ? RED : TEXT },
                    { label: 'Expected Loss 1Y', value: e.pd1y * e.lgd / 100, color: RED },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: DIM, fontSize: 10 }}>{row.label}</span>
                      <span style={{ color: row.color, fontWeight: 'bold' }}>{row.value.toFixed(2)}%</span>
                    </div>
                  ))}
                  {/* PD bar */}
                  <div style={{ marginTop: 6, height: 6, background: '#1a1a1a', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(e.pd5y * 5, 100)}%`, background: `linear-gradient(90deg, ${GREEN}, ${AMBER}, ${RED})`, opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transition Matrix */}
        {tab === 3 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>CREDIT RATING TRANSITION MATRIX (1Y %)</div>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', color: AMBER, borderBottom: `1px solid ${BORDER}`, textAlign: 'left' }}>From \ To</th>
                  {MATRIX_LABELS.map(l => <th key={l} style={{ padding: '8px 12px', color: AMBER, borderBottom: `1px solid ${BORDER}`, textAlign: 'center', minWidth: 60 }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {TRANSITION_MATRIX.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 12px', color: WHITE, fontWeight: 'bold', borderBottom: `1px solid ${BORDER}` }}>{MATRIX_LABELS[i]}</td>
                    {row.map((val, j) => {
                      const isDiag = i === j;
                      const isUpgrade = j < i;
                      const isDowngrade = j > i;
                      const bg = isDiag ? 'rgba(245,166,35,0.08)' : val > 5 ? (isDowngrade ? 'rgba(239,83,80,0.08)' : 'rgba(38,166,154,0.08)') : 'transparent';
                      return (
                        <td key={j} style={{
                          padding: '6px 12px', textAlign: 'center', borderBottom: `1px solid ${BORDER}`,
                          color: isDiag ? AMBER : val > 5 ? (isDowngrade ? RED : GREEN) : val > 0.5 ? TEXT : DIM,
                          fontWeight: isDiag ? 'bold' : 'normal', background: bg
                        }}>{val.toFixed(2)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CVA/DVA */}
        {tab === 4 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>CREDIT VALUATION ADJUSTMENTS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total CVA', value: '-$2.34M', desc: 'Credit Valuation Adjustment', color: RED },
                { label: 'Total DVA', value: '+$1.12M', desc: 'Debit Valuation Adjustment', color: GREEN },
                { label: 'FVA', value: '-$0.89M', desc: 'Funding Valuation Adjustment', color: RED },
                { label: 'Net XVA', value: '-$2.11M', desc: 'Total Valuation Adjustments', color: RED },
              ].map(m => (
                <div key={m.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: DIM, fontSize: 10 }}>{m.label}</div>
                  <div style={{ color: m.color, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{m.value}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>{m.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>XVA BY COUNTERPARTY</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Counterparty', 'Rating', 'Exposure', 'CVA', 'DVA', 'FVA', 'Net XVA'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Counterparty' ? 'left' : 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 10).map(e => {
                  const exposure = e.debtOutstanding * 0.001;
                  const cva = exposure * e.pd5y / 100 * e.lgd / 100 * -1;
                  const dva = Math.abs(cva) * 0.4;
                  const fva = exposure * 0.001 * -1;
                  return (
                    <tr key={e.ticker} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '4px 8px', color: AMBER }}>{e.ticker}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: RATINGS_ORDER.indexOf(e.rating) < 10 ? GREEN : RED }}>{e.rating}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: TEXT }}>{fmtB(exposure)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: RED }}>{(cva / 1e6).toFixed(2)}M</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: GREEN }}>+{(dva / 1e6).toFixed(2)}M</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: RED }}>{(fva / 1e6).toFixed(2)}M</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: (cva + dva + fva) >= 0 ? GREEN : RED, fontWeight: 'bold' }}>
                        {((cva + dva + fva) / 1e6).toFixed(2)}M
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Watchlist */}
        {tab === 5 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>CREDIT WATCHLIST — HIGH RISK ENTITIES</div>
            {filtered.filter(e => RATINGS_ORDER.indexOf(e.rating) >= 10 || e.cds5y > 300 || e.outlook === 'Negative').map(e => (
              <div key={e.ticker} style={{ background: PANEL, border: `1px solid ${e.cds5y > 500 ? RED : BORDER}`, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>{e.ticker}</span>
                    <span style={{ color: DIM, marginLeft: 8 }}>{e.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ padding: '2px 6px', background: 'rgba(239,83,80,0.1)', color: RED, fontSize: 10, fontWeight: 'bold' }}>{e.rating}</span>
                    {e.outlook === 'Negative' && <span style={{ padding: '2px 6px', background: 'rgba(239,83,80,0.1)', color: RED, fontSize: 10 }}>NEG</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10 }}>
                  <span style={{ color: DIM }}>CDS: <span style={{ color: e.cds5y > 500 ? RED : AMBER }}>{e.cds5y.toFixed(0)} bps</span></span>
                  <span style={{ color: DIM }}>PD 1Y: <span style={{ color: e.pd1y > 2 ? RED : TEXT }}>{e.pd1y.toFixed(2)}%</span></span>
                  <span style={{ color: DIM }}>Altman Z: <span style={{ color: e.altmanZ < 1.8 ? RED : AMBER }}>{e.altmanZ.toFixed(2)}</span></span>
                  <span style={{ color: DIM }}>Net Lev: <span style={{ color: e.netLeverage > 4 ? RED : TEXT }}>{e.netLeverage.toFixed(1)}x</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Sector: {sectorFilter} | {filtered.length} entities</span>
        <span style={{ color: DIM }}>IG: {igCount} | HY: {hyCount}</span>
        <span style={{ color: DIM }}>Credit Risk Analytics</span>
      </div>
    </div>
  );
}
