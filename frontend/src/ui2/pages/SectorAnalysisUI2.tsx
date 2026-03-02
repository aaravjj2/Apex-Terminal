/**
 * SectorAnalysisUI2 — Sector Rotation, Relative Strength, Flow Analysis
 * GICS sectors, rotation model, RS rankings, flow heatmap, breadth.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

interface Sector {
  name: string; ticker: string; color: string;
  weight: number; perf1d: number; perf1w: number; perf1m: number; perf3m: number; perf6m: number; perfYTD: number;
  rs: number; flow: number; breadth: number; pe: number; divYield: number;
  top5: { name: string; ticker: string; weight: number; change: number }[];
}

function genSectors(): Sector[] {
  let s = 42;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const sectors: { name: string; ticker: string; color: string; weight: number }[] = [
    { name: 'Technology', ticker: 'XLK', color: '#4a90d9', weight: 28.5 },
    { name: 'Healthcare', ticker: 'XLV', color: '#26a69a', weight: 13.2 },
    { name: 'Financials', ticker: 'XLF', color: '#f5a623', weight: 12.8 },
    { name: 'Consumer Disc.', ticker: 'XLY', color: '#e74c3c', weight: 10.3 },
    { name: 'Communication', ticker: 'XLC', color: '#9b59b6', weight: 8.9 },
    { name: 'Industrials', ticker: 'XLI', color: '#3498db', weight: 8.4 },
    { name: 'Consumer Stpl.', ticker: 'XLP', color: '#2ecc71', weight: 6.2 },
    { name: 'Energy', ticker: 'XLE', color: '#e67e22', weight: 4.5 },
    { name: 'Utilities', ticker: 'XLU', color: '#1abc9c', weight: 2.5 },
    { name: 'Real Estate', ticker: 'XLRE', color: '#34495e', weight: 2.4 },
    { name: 'Materials', ticker: 'XLB', color: '#95a5a6', weight: 2.3 },
  ];
  const topHoldings: Record<string, { name: string; ticker: string }[]> = {
    XLK: [{ name: 'Apple Inc', ticker: 'AAPL' }, { name: 'Microsoft', ticker: 'MSFT' }, { name: 'NVIDIA', ticker: 'NVDA' }, { name: 'Broadcom', ticker: 'AVGO' }, { name: 'Salesforce', ticker: 'CRM' }],
    XLV: [{ name: 'UnitedHealth', ticker: 'UNH' }, { name: 'Eli Lilly', ticker: 'LLY' }, { name: 'Johnson & J', ticker: 'JNJ' }, { name: 'AbbVie', ticker: 'ABBV' }, { name: 'Merck', ticker: 'MRK' }],
    XLF: [{ name: 'Berkshire B', ticker: 'BRK.B' }, { name: 'JPMorgan', ticker: 'JPM' }, { name: 'Visa', ticker: 'V' }, { name: 'Mastercard', ticker: 'MA' }, { name: 'Bank of Am.', ticker: 'BAC' }],
    XLY: [{ name: 'Amazon', ticker: 'AMZN' }, { name: 'Tesla', ticker: 'TSLA' }, { name: 'Home Depot', ticker: 'HD' }, { name: 'McDonald\'s', ticker: 'MCD' }, { name: 'Nike', ticker: 'NKE' }],
    XLC: [{ name: 'Meta', ticker: 'META' }, { name: 'Alphabet A', ticker: 'GOOGL' }, { name: 'Alphabet C', ticker: 'GOOG' }, { name: 'Netflix', ticker: 'NFLX' }, { name: 'Comcast', ticker: 'CMCSA' }],
    XLI: [{ name: 'GE Aero.', ticker: 'GE' }, { name: 'Caterpillar', ticker: 'CAT' }, { name: 'RTX', ticker: 'RTX' }, { name: 'UPS', ticker: 'UPS' }, { name: 'Union Pacific', ticker: 'UNP' }],
    XLP: [{ name: 'Procter & G', ticker: 'PG' }, { name: 'Costco', ticker: 'COST' }, { name: 'Coca-Cola', ticker: 'KO' }, { name: 'PepsiCo', ticker: 'PEP' }, { name: 'Walmart', ticker: 'WMT' }],
    XLE: [{ name: 'Exxon', ticker: 'XOM' }, { name: 'Chevron', ticker: 'CVX' }, { name: 'ConocoPhil.', ticker: 'COP' }, { name: 'EOG Res.', ticker: 'EOG' }, { name: 'Schlumberger', ticker: 'SLB' }],
    XLU: [{ name: 'NextEra', ticker: 'NEE' }, { name: 'Southern Co', ticker: 'SO' }, { name: 'Duke Energy', ticker: 'DUK' }, { name: 'Dominion', ticker: 'D' }, { name: 'Exelon', ticker: 'EXC' }],
    XLRE: [{ name: 'Prologis', ticker: 'PLD' }, { name: 'Am. Tower', ticker: 'AMT' }, { name: 'Equinix', ticker: 'EQIX' }, { name: 'Crown Castle', ticker: 'CCI' }, { name: 'Public Strg', ticker: 'PSA' }],
    XLB: [{ name: 'Linde', ticker: 'LIN' }, { name: 'Sherwin-W', ticker: 'SHW' }, { name: 'Air Products', ticker: 'APD' }, { name: 'Freeport-Mc', ticker: 'FCX' }, { name: 'Ecolab', ticker: 'ECL' }],
  };

  return sectors.map(sec => ({
    ...sec,
    perf1d: (rng() - 0.45) * 3,
    perf1w: (rng() - 0.4) * 6,
    perf1m: (rng() - 0.35) * 10,
    perf3m: (rng() - 0.3) * 18,
    perf6m: (rng() - 0.25) * 28,
    perfYTD: (rng() - 0.2) * 35,
    rs: 20 + rng() * 80,
    flow: (rng() - 0.4) * 5000,
    breadth: 30 + rng() * 60,
    pe: 12 + rng() * 25,
    divYield: 0.5 + rng() * 3.5,
    top5: (topHoldings[sec.ticker] || []).map(h => ({
      ...h, weight: 3 + rng() * 20, change: (rng() - 0.45) * 5,
    })),
  }));
}

/* ─── Rotation Canvas ────────────────────────────────────────────────── */
function RotationChart({ sectors }: { sectors: Sector[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const r = Math.min(cx, cy) - 30;

    // Quadrant labels
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = `${GREEN}44`; ctx.fillText('LEADING', cx + r / 2, cy - r - 8);
    ctx.fillStyle = `${AMBER}44`; ctx.fillText('WEAKENING', cx + r / 2, cy + r + 14);
    ctx.fillStyle = `${RED}44`; ctx.fillText('LAGGING', cx - r / 2, cy + r + 14);
    ctx.fillStyle = '#5599ee44'; ctx.fillText('IMPROVING', cx - r / 2, cy - r - 8);

    // Quadrant fills
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = GREEN; ctx.fillRect(cx, cy - r, r, r);
    ctx.fillStyle = AMBER; ctx.fillRect(cx, cy, r, r);
    ctx.fillStyle = RED; ctx.fillRect(cx - r, cy, r, r);
    ctx.fillStyle = '#5599ee'; ctx.fillRect(cx - r, cy - r, r, r);
    ctx.globalAlpha = 1;

    // Axes
    ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

    // Axis labels
    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('← Negative RS    Relative Strength →', cx, cy + r + 25);
    ctx.save(); ctx.translate(cx - r - 15, cy); ctx.rotate(-Math.PI / 2);
    ctx.fillText('← Declining    RS Momentum →', 0, 0); ctx.restore();

    // Plot sectors
    sectors.forEach(sec => {
      const x = cx + ((sec.rs - 50) / 50) * r;
      const y = cy - ((sec.perf1m / 20) * r);
      const size = 4 + sec.weight / 5;

      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = sec.color + '88'; ctx.fill();
      ctx.strokeStyle = sec.color; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.fillStyle = '#eee'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sec.ticker, x, y - size - 3);
    });
  }, [sectors]);
  return <canvas ref={ref} style={{ width: '100%', height: 350, borderRadius: 4 }} />;
}

/* ─── Performance Heatmap ────────────────────────────────────────────── */
function PerfHeatmap({ sectors }: { sectors: Sector[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = useMemo(() => {
    return sectors.sort((a, b) => b.weight - a.weight);
  }, [sectors]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const totalWeight = colors.reduce((s, sec) => s + sec.weight, 0);
    let x = 4, y = 4;
    const totalWidth = w - 8, totalHeight = h - 8;
    let rowHeight = totalHeight / 3;
    let currentRowStart = x;
    let currentRowWidth = 0;
    let row = 0;

    colors.forEach(sec => {
      const area = (sec.weight / totalWeight) * totalWidth * totalHeight;
      const cellW = Math.max(60, area / rowHeight);

      if (currentRowWidth + cellW > totalWidth) {
        row++;
        currentRowStart = 4;
        currentRowWidth = 0;
        y += rowHeight;
      }

      const perf = sec.perf1d;
      const intensity = Math.min(0.7, Math.abs(perf) / 2);
      ctx.fillStyle = perf >= 0 ? `rgba(38,166,154,${intensity + 0.15})` : `rgba(239,83,80,${intensity + 0.15})`;
      ctx.fillRect(currentRowStart + currentRowWidth + 1, y + 1, cellW - 2, rowHeight - 2);
      ctx.strokeStyle = BG; ctx.lineWidth = 1; ctx.strokeRect(currentRowStart + currentRowWidth, y, cellW, rowHeight);

      const cx2 = currentRowStart + currentRowWidth + cellW / 2;
      const cy2 = y + rowHeight / 2;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sec.ticker, cx2, cy2 - 5);
      ctx.font = '8px monospace';
      ctx.fillText(`${perf >= 0 ? '+' : ''}${perf.toFixed(2)}%`, cx2, cy2 + 8);

      currentRowWidth += cellW;
    });
  }, [colors]);
  return <canvas ref={ref} style={{ width: '100%', height: 220, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['OVERVIEW', 'ROTATION', 'FLOW', 'BREADTH'] as const;
type Tab = typeof TABS[number];

export default function SectorAnalysisUI2() {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [sectors] = useState(() => genSectors());
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [perfPeriod, setPerfPeriod] = useState<'1d' | '1w' | '1m' | '3m' | '6m' | 'YTD'>('1m');

  const sorted = useMemo(() => {
    const key = { '1d': 'perf1d', '1w': 'perf1w', '1m': 'perf1m', '3m': 'perf3m', '6m': 'perf6m', 'YTD': 'perfYTD' }[perfPeriod] as keyof Sector;
    return [...sectors].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [sectors, perfPeriod]);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>🏭 SECTOR ANALYSIS</span>
          <div style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
            {(['1d', '1w', '1m', '3m', '6m', 'YTD'] as const).map(p => (
              <button key={p} onClick={() => setPerfPeriod(p)} style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                background: perfPeriod === p ? AMBER : 'transparent', color: perfPeriod === p ? '#000' : MUTED,
                border: perfPeriod === p ? 'none' : `1px solid ${BORDER}`,
              }}>{p}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <span style={{ color: MUTED }}>SPX +0.42%</span>
          <span style={{ color: MUTED }}>VIX 15.23</span>
          <span style={{ color: MUTED }}>Adv/Dec 287/215</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'OVERVIEW' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedSector ? '1fr 320px' : '1fr', gap: 12 }}>
            <div>
              <PerfHeatmap sectors={sectors} />
              <div style={{ ...panelStyle, marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
                      {['Sector', 'Weight', '1D', '1W', '1M', '3M', 'YTD', 'RS', 'P/E', 'Yield', 'Breadth'].map(h => (
                        <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Sector' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(sec => (
                      <tr key={sec.ticker} onClick={() => setSelectedSector(sec)} style={{
                        borderBottom: `1px solid ${BORDER}22`, cursor: 'pointer',
                        background: selectedSector?.ticker === sec.ticker ? 'rgba(245,166,35,0.05)' : 'transparent',
                      }}>
                        <td style={{ padding: '5px 6px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sec.color }} />
                            <span style={{ fontWeight: 600 }}>{sec.name}</span>
                            <span style={{ color: MUTED, fontSize: 9 }}>{sec.ticker}</span>
                          </div>
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{sec.weight.toFixed(1)}%</td>
                        {[sec.perf1d, sec.perf1w, sec.perf1m, sec.perf3m, sec.perfYTD].map((p, i) => (
                          <td key={i} style={{ padding: '5px 6px', textAlign: 'right', color: p > 0 ? GREEN : RED, fontWeight: 600 }}>
                            {p > 0 ? '+' : ''}{p.toFixed(2)}%
                          </td>
                        ))}
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <div style={{ width: 30, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                              <div style={{ width: `${sec.rs}%`, height: '100%', background: sec.rs > 60 ? GREEN : sec.rs > 40 ? AMBER : RED, borderRadius: 2 }} />
                            </div>
                            <span style={{ width: 24 }}>{sec.rs.toFixed(0)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{sec.pe.toFixed(1)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{sec.divYield.toFixed(2)}%</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <div style={{ width: 30, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                              <div style={{ width: `${sec.breadth}%`, height: '100%', background: sec.breadth > 60 ? GREEN : sec.breadth > 40 ? AMBER : RED, borderRadius: 2 }} />
                            </div>
                            <span style={{ width: 24 }}>{sec.breadth.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedSector && (
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedSector.color }} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedSector.name}</span>
                    </div>
                    <span style={{ color: MUTED, fontSize: 10 }}>{selectedSector.ticker} • Weight: {selectedSector.weight}%</span>
                  </div>
                  <button onClick={() => setSelectedSector(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: AMBER, fontWeight: 600, fontSize: 10 }}>TOP HOLDINGS</span>
                  {selectedSector.top5.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{h.ticker}</span>
                        <span style={{ color: MUTED, marginLeft: 6, fontSize: 9 }}>{h.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ color: MUTED, width: 40, textAlign: 'right' }}>{h.weight.toFixed(1)}%</span>
                        <span style={{ color: h.change > 0 ? GREEN : RED, fontWeight: 600, width: 50, textAlign: 'right' }}>
                          {h.change > 0 ? '+' : ''}{h.change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <span style={{ color: AMBER, fontWeight: 600, fontSize: 10 }}>METRICS</span>
                  {[
                    { l: 'P/E Ratio', v: selectedSector.pe.toFixed(1) },
                    { l: 'Div Yield', v: `${selectedSector.divYield.toFixed(2)}%` },
                    { l: 'RS Score', v: selectedSector.rs.toFixed(0), c: selectedSector.rs > 60 ? GREEN : AMBER },
                    { l: 'Breadth', v: `${selectedSector.breadth.toFixed(0)}%`, c: selectedSector.breadth > 60 ? GREEN : AMBER },
                    { l: 'Flow', v: `$${selectedSector.flow > 0 ? '+' : ''}${(selectedSector.flow / 1000).toFixed(1)}B`, c: selectedSector.flow > 0 ? GREEN : RED },
                  ].map(m => (
                    <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                      <span style={{ color: MUTED }}>{m.l}</span>
                      <span style={{ color: (m as any).c || '#eee', fontWeight: 600 }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'ROTATION' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SECTOR ROTATION MODEL</span>
                <span style={{ color: MUTED, fontSize: 9 }}>Relative Strength × RS Momentum</span>
              </div>
              <RotationChart sectors={sectors} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{ label: 'LEADING', color: GREEN, filter: (s: Sector) => s.rs > 60 && s.perf1m > 2 },
                { label: 'WEAKENING', color: AMBER, filter: (s: Sector) => s.rs > 60 && s.perf1m <= 2 },
                { label: 'LAGGING', color: RED, filter: (s: Sector) => s.rs <= 60 && s.perf1m <= 0 },
                { label: 'IMPROVING', color: '#5599ee', filter: (s: Sector) => s.rs <= 60 && s.perf1m > 0 },
              ].map(q => (
                <div key={q.label} style={panelStyle}>
                  <span style={{ color: q.color, fontWeight: 700, fontSize: 10 }}>{q.label}</span>
                  {sectors.filter(q.filter).map(sec => (
                    <div key={sec.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.color }} />
                        {sec.name}
                      </span>
                      <span style={{ color: sec.perf1m > 0 ? GREEN : RED }}>{sec.perf1m > 0 ? '+' : ''}{sec.perf1m.toFixed(1)}%</span>
                    </div>
                  ))}
                  {sectors.filter(q.filter).length === 0 && <span style={{ color: MUTED, fontSize: 9 }}>None</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'FLOW' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>FUND FLOWS (30D, $M)</span>
              {[...sectors].sort((a, b) => b.flow - a.flow).map(sec => {
                const maxFlow = Math.max(...sectors.map(s => Math.abs(s.flow)));
                const barW = (Math.abs(sec.flow) / maxFlow) * 100;
                return (
                  <div key={sec.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ width: 90, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.color }} />
                      {sec.name}
                    </span>
                    <div style={{ flex: 1, height: 12, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BORDER }} />
                      <div style={{
                        position: 'absolute',
                        [sec.flow >= 0 ? 'left' : 'right']: '50%',
                        width: `${barW / 2}%`, height: '100%', borderRadius: 2,
                        background: sec.flow >= 0 ? GREEN : RED,
                      }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', fontSize: 10, color: sec.flow > 0 ? GREEN : RED, fontWeight: 600 }}>
                      {sec.flow > 0 ? '+' : ''}${(sec.flow / 1000).toFixed(1)}B
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>INSTITUTIONAL ACTIVITY</span>
              {sectors.map((sec, i) => {
                const inst = 40 + (i * 7 + 13) % 35;
                const retail = 100 - inst;
                return (
                  <div key={sec.ticker} style={{ padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{sec.ticker}</span>
                      <span style={{ color: MUTED }}>Inst: {inst}% / Retail: {retail}%</span>
                    </div>
                    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, display: 'flex' }}>
                      <div style={{ width: `${inst}%`, background: '#4a90d9', borderRadius: '2px 0 0 2px' }} />
                      <div style={{ width: `${retail}%`, background: AMBER, borderRadius: '0 2px 2px 0' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'BREADTH' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>% ABOVE 50 DMA</span>
              {sorted.map(sec => (
                <div key={sec.ticker} style={{ padding: '5px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.color }} /> {sec.name}
                    </span>
                    <span style={{ color: sec.breadth > 60 ? GREEN : sec.breadth > 40 ? AMBER : RED, fontWeight: 600 }}>{sec.breadth.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                    <div style={{ width: `${sec.breadth}%`, height: '100%', background: sec.breadth > 60 ? GREEN : sec.breadth > 40 ? AMBER : RED, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>NEW HIGHS / LOWS</span>
              {sectors.map((sec, i) => {
                const highs = Math.floor(5 + (i * 13 + 7) % 25);
                const lows = Math.floor(2 + (i * 11 + 3) % 15);
                return (
                  <div key={sec.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.color }} /> {sec.ticker}
                    </span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: GREEN }}>▲ {highs}</span>
                      <span style={{ color: RED }}>▼ {lows}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>RELATIVE STRENGTH RANKING</span>
              {[...sectors].sort((a, b) => b.rs - a.rs).map((sec, i) => (
                <div key={sec.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: i < 3 ? GREEN : i < 7 ? AMBER : RED, fontWeight: 700, width: 14 }}>#{i + 1}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.color }} />
                    <span style={{ fontWeight: 600 }}>{sec.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 50, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                      <div style={{ width: `${sec.rs}%`, height: '100%', background: sec.color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontWeight: 700, color: sec.rs > 60 ? GREEN : sec.rs > 40 ? AMBER : RED }}>{sec.rs.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
