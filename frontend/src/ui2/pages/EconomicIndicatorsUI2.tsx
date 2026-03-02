import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Economic Indicators Data ──
interface EconIndicator {
  id: string; name: string; category: string; country: string;
  actual: number; previous: number; forecast: number; unit: string;
  frequency: string; lastRelease: string; nextRelease: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  history: number[];
}

const CATEGORIES = ['GDP & Growth', 'Inflation', 'Employment', 'Manufacturing', 'Housing', 'Consumer', 'Central Bank', 'Trade', 'Money Supply'];
const COUNTRIES = ['US', 'EU', 'UK', 'JP', 'CN', 'DE', 'CA', 'AU'];

function generateIndicators(): EconIndicator[] {
  const indicators: { name: string; cat: string; base: number; unit: string; freq: string; imp: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [
    { name: 'Real GDP (QoQ)', cat: 'GDP & Growth', base: 2.8, unit: '%', freq: 'Quarterly', imp: 'HIGH' },
    { name: 'GDP Price Index', cat: 'GDP & Growth', base: 2.3, unit: '%', freq: 'Quarterly', imp: 'MEDIUM' },
    { name: 'Industrial Production', cat: 'GDP & Growth', base: 0.4, unit: '%', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'CPI (YoY)', cat: 'Inflation', base: 3.4, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Core CPI (YoY)', cat: 'Inflation', base: 3.6, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'PPI (YoY)', cat: 'Inflation', base: 2.2, unit: '%', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'PCE Deflator', cat: 'Inflation', base: 2.7, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Core PCE', cat: 'Inflation', base: 2.8, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Non-Farm Payrolls', cat: 'Employment', base: 175, unit: 'K', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Unemployment Rate', cat: 'Employment', base: 3.9, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Average Hourly Earnings', cat: 'Employment', base: 4.1, unit: '%', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Initial Jobless Claims', cat: 'Employment', base: 212, unit: 'K', freq: 'Weekly', imp: 'MEDIUM' },
    { name: 'JOLTS Job Openings', cat: 'Employment', base: 8.7, unit: 'M', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'ISM Manufacturing', cat: 'Manufacturing', base: 49.2, unit: '', freq: 'Monthly', imp: 'HIGH' },
    { name: 'ISM Services', cat: 'Manufacturing', base: 53.4, unit: '', freq: 'Monthly', imp: 'HIGH' },
    { name: 'PMI Manufacturing', cat: 'Manufacturing', base: 50.1, unit: '', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Durable Goods', cat: 'Manufacturing', base: 0.8, unit: '%', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Housing Starts', cat: 'Housing', base: 1.42, unit: 'M', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Building Permits', cat: 'Housing', base: 1.46, unit: 'M', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Existing Home Sales', cat: 'Housing', base: 4.19, unit: 'M', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'New Home Sales', cat: 'Housing', base: 0.66, unit: 'M', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Case-Shiller (YoY)', cat: 'Housing', base: 6.4, unit: '%', freq: 'Monthly', imp: 'LOW' },
    { name: 'Consumer Confidence', cat: 'Consumer', base: 104.7, unit: '', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Michigan Sentiment', cat: 'Consumer', base: 67.4, unit: '', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Retail Sales (MoM)', cat: 'Consumer', base: 0.7, unit: '%', freq: 'Monthly', imp: 'HIGH' },
    { name: 'Personal Income', cat: 'Consumer', base: 0.4, unit: '%', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Fed Funds Rate', cat: 'Central Bank', base: 5.50, unit: '%', freq: 'FOMC', imp: 'HIGH' },
    { name: 'ECB Main Rate', cat: 'Central Bank', base: 4.50, unit: '%', freq: 'ECB', imp: 'HIGH' },
    { name: 'BoE Bank Rate', cat: 'Central Bank', base: 5.25, unit: '%', freq: 'MPC', imp: 'HIGH' },
    { name: 'BoJ Policy Rate', cat: 'Central Bank', base: -0.10, unit: '%', freq: 'BoJ', imp: 'HIGH' },
    { name: 'Trade Balance', cat: 'Trade', base: -68.3, unit: 'B', freq: 'Monthly', imp: 'MEDIUM' },
    { name: 'Current Account', cat: 'Trade', base: -194.8, unit: 'B', freq: 'Quarterly', imp: 'LOW' },
    { name: 'M2 Money Supply', cat: 'Money Supply', base: 20.87, unit: 'T', freq: 'Weekly', imp: 'LOW' },
    { name: 'FRA/OIS Spread', cat: 'Money Supply', base: 8.5, unit: 'bp', freq: 'Daily', imp: 'LOW' },
  ];

  return indicators.map((ind, i) => {
    const countries = ['US'];
    if (ind.cat === 'Central Bank') {
      if (ind.name.includes('ECB')) countries[0] = 'EU';
      else if (ind.name.includes('BoE')) countries[0] = 'UK';
      else if (ind.name.includes('BoJ')) countries[0] = 'JP';
    }
    const noise = () => (Math.random() - 0.5) * ind.base * 0.1;
    const actual = Math.round((ind.base + noise()) * 100) / 100;
    const previous = Math.round((ind.base + noise()) * 100) / 100;
    const forecast = Math.round((ind.base + noise()) * 100) / 100;
    const history = Array.from({ length: 24 }, () => Math.round((ind.base + noise()) * 100) / 100);

    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 30));
    const nextD = new Date();
    nextD.setDate(nextD.getDate() + Math.floor(Math.random() * 30) + 1);

    return {
      id: `ind_${i}`,
      name: ind.name,
      category: ind.cat,
      country: countries[0],
      actual, previous, forecast,
      unit: ind.unit,
      frequency: ind.freq,
      lastRelease: d.toISOString().split('T')[0],
      nextRelease: nextD.toISOString().split('T')[0],
      importance: ind.imp,
      history,
    };
  });
}

// ── Canvas Chart ──
function drawTrendChart(ctx: CanvasRenderingContext2D, w: number, h: number, data: number[], title: string, unit: string) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 25, right: 10, bottom: 20, left: 45 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(title, pad.left, 14);

  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * ch;
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.font = '9px monospace';
    ctx.fillText((maxV - (i / 4) * range).toFixed(1) + unit, 2, y + 3);
  }

  // Area fill
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - ((v - minV) / range) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245,166,35,0.1)';
  ctx.fill();

  // Line
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - ((v - minV) / range) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ── Dashboard Cards ──
function drawDashboard(ctx: CanvasRenderingContext2D, w: number, h: number, indicators: EconIndicator[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = 20;
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('MACRO DASHBOARD — KEY INDICATORS', pad, 18);

  const keyInds = indicators.filter(i => i.importance === 'HIGH').slice(0, 12);
  const cols = 4, rows = 3;
  const cellW = (w - pad * 2) / cols - 4;
  const cellH = (h - pad - 30) / rows - 4;

  keyInds.forEach((ind, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (cellW + 4);
    const y = 28 + row * (cellH + 4);

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = BORDER;
    ctx.strokeRect(x, y, cellW, cellH);

    // Name
    ctx.fillStyle = DIM;
    ctx.font = '9px monospace';
    ctx.fillText(ind.name, x + 6, y + 14);

    // Actual
    const surprise = ind.actual - ind.forecast;
    ctx.fillStyle = surprise > 0 ? GREEN : surprise < 0 ? RED : WHITE;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${ind.actual}${ind.unit}`, x + 6, y + 36);

    // Beat/miss
    ctx.fillStyle = surprise > 0 ? GREEN : surprise < 0 ? RED : DIM;
    ctx.font = '9px monospace';
    ctx.fillText(surprise > 0 ? `▲ Beat by ${Math.abs(surprise).toFixed(1)}` : surprise < 0 ? `▼ Miss by ${Math.abs(surprise).toFixed(1)}` : '= Inline', x + 6, y + 50);

    // Mini sparkline
    const sparkY = y + 55;
    const sparkH = cellH - 60;
    if (sparkH > 5 && ind.history.length > 0) {
      const minH = Math.min(...ind.history);
      const maxH = Math.max(...ind.history);
      const rng = maxH - minH || 1;
      ctx.strokeStyle = 'rgba(245,166,35,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ind.history.forEach((v, hi) => {
        const hx = x + 6 + (hi / (ind.history.length - 1)) * (cellW - 12);
        const hy = sparkY + sparkH - ((v - minH) / rng) * sparkH;
        hi === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      });
      ctx.stroke();
    }
  });
}

// ── Main Component ──
const TABS = ['Dashboard', 'Indicators', 'Calendar', 'Trend Charts', 'Central Banks', 'Custom Groups'];

export default function EconomicIndicatorsUI2() {
  const [tab, setTab] = useState(0);
  const [indicators] = useState<EconIndicator[]>(() => generateIndicators());
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedInd, setSelectedInd] = useState<EconIndicator | null>(null);
  const [importanceFilter, setImportanceFilter] = useState<string>('All');
  const dashRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);

  const filtered = indicators.filter(ind =>
    (selectedCat === 'All' || ind.category === selectedCat) &&
    (selectedCountry === 'All' || ind.country === selectedCountry) &&
    (importanceFilter === 'All' || ind.importance === importanceFilter)
  );

  // Draw dashboard
  useEffect(() => {
    if (tab !== 0) return;
    const c = dashRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawDashboard(ctx, r.width, r.height, indicators);
  }, [tab, indicators]);

  // Draw trend chart
  useEffect(() => {
    if (tab !== 3 || !selectedInd) return;
    const c = chartRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawTrendChart(ctx, r.width, r.height, selectedInd.history, selectedInd.name, selectedInd.unit);
  }, [tab, selectedInd]);

  // Calendar events
  const calendarEvents = indicators
    .map(ind => ({
      date: ind.nextRelease,
      name: ind.name,
      category: ind.category,
      importance: ind.importance,
      forecast: ind.forecast,
      previous: ind.previous,
      unit: ind.unit,
      country: ind.country,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Central bank data
  const cbIndicators = indicators.filter(i => i.category === 'Central Bank');

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📊 ECONOMIC INDICATORS</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: GREEN }}>● LIVE</span>
        <span style={{ color: DIM, marginLeft: 'auto' }}>
          {indicators.filter(i => i.importance === 'HIGH').length} high-impact tracked
        </span>
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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <div style={{ width: 220, borderRight: `1px solid ${BORDER}`, overflow: 'auto', padding: 12 }}>
          <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>FILTERS</div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ color: DIM, fontSize: 10 }}>Category:</span>
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} style={{
              width: '100%', marginTop: 4, padding: '4px', background: '#1a1a1a',
              border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10
            }}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ color: DIM, fontSize: 10 }}>Country:</span>
            <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} style={{
              width: '100%', marginTop: 4, padding: '4px', background: '#1a1a1a',
              border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10
            }}>
              <option value="All">All Countries</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ color: DIM, fontSize: 10 }}>Importance:</span>
            <select value={importanceFilter} onChange={e => setImportanceFilter(e.target.value)} style={{
              width: '100%', marginTop: 4, padding: '4px', background: '#1a1a1a',
              border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10
            }}>
              <option value="All">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>UPCOMING RELEASES</div>
            {calendarEvents.slice(0, 8).map((e, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: WHITE, fontSize: 10 }}>{e.name}</span>
                  <span style={{
                    fontSize: 8, padding: '1px 4px', borderRadius: 2,
                    background: e.importance === 'HIGH' ? 'rgba(239,83,80,0.2)' : e.importance === 'MEDIUM' ? 'rgba(245,166,35,0.2)' : 'rgba(85,85,85,0.2)',
                    color: e.importance === 'HIGH' ? RED : e.importance === 'MEDIUM' ? AMBER : DIM
                  }}>{e.importance}</span>
                </div>
                <div style={{ color: DIM, fontSize: 9 }}>{e.date} — F: {e.forecast}{e.unit}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 0 && (
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={dashRef} style={{ width: '100%', height: '100%' }} />
            </div>
          )}

          {tab === 1 && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                    {['Indicator', 'Country', 'Actual', 'Forecast', 'Previous', 'Surprise', 'Freq', 'Last', 'Next', 'Imp'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ind => {
                    const surprise = ind.actual - ind.forecast;
                    return (
                      <tr key={ind.id} onClick={() => setSelectedInd(ind)} style={{
                        cursor: 'pointer', borderBottom: `1px solid ${BORDER}`,
                        background: selectedInd?.id === ind.id ? 'rgba(245,166,35,0.1)' : 'transparent'
                      }}>
                        <td style={{ padding: '5px 8px' }}>
                          <span style={{ color: WHITE }}>{ind.name}</span>
                          <div style={{ color: DIM, fontSize: 9 }}>{ind.category}</div>
                        </td>
                        <td style={{ padding: '5px 8px', color: CYAN }}>{ind.country}</td>
                        <td style={{ padding: '5px 8px', color: WHITE, fontWeight: 'bold' }}>{ind.actual}{ind.unit}</td>
                        <td style={{ padding: '5px 8px', color: DIM }}>{ind.forecast}{ind.unit}</td>
                        <td style={{ padding: '5px 8px', color: DIM }}>{ind.previous}{ind.unit}</td>
                        <td style={{ padding: '5px 8px', color: surprise > 0 ? GREEN : surprise < 0 ? RED : DIM }}>
                          {surprise > 0 ? '▲' : surprise < 0 ? '▼' : '='} {Math.abs(surprise).toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 8px', color: DIM, fontSize: 10 }}>{ind.frequency}</td>
                        <td style={{ padding: '5px 8px', color: DIM, fontSize: 10 }}>{ind.lastRelease}</td>
                        <td style={{ padding: '5px 8px', color: AMBER, fontSize: 10 }}>{ind.nextRelease}</td>
                        <td style={{ padding: '5px 8px' }}>
                          <span style={{
                            fontSize: 8, padding: '1px 6px', borderRadius: 2,
                            background: ind.importance === 'HIGH' ? 'rgba(239,83,80,0.2)' : ind.importance === 'MEDIUM' ? 'rgba(245,166,35,0.2)' : 'rgba(85,85,85,0.2)',
                            color: ind.importance === 'HIGH' ? RED : ind.importance === 'MEDIUM' ? AMBER : DIM
                          }}>{ind.importance}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 2 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>ECONOMIC CALENDAR</div>
              {(() => {
                const grouped: Record<string, typeof calendarEvents> = {};
                calendarEvents.forEach(e => {
                  if (!grouped[e.date]) grouped[e.date] = [];
                  grouped[e.date].push(e);
                });
                return Object.entries(grouped).slice(0, 15).map(([date, events]) => (
                  <div key={date} style={{ marginBottom: 12 }}>
                    <div style={{ color: AMBER, fontWeight: 'bold', padding: '4px 8px', background: 'rgba(245,166,35,0.05)', borderLeft: `3px solid ${AMBER}` }}>
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    {events.map((e, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '30px 1fr 60px 60px 60px 50px',
                        padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, alignItems: 'center'
                      }}>
                        <span style={{ color: CYAN, fontSize: 10 }}>{e.country}</span>
                        <span style={{ color: WHITE }}>{e.name}</span>
                        <span style={{ color: DIM, fontSize: 10 }}>F: {e.forecast}{e.unit}</span>
                        <span style={{ color: DIM, fontSize: 10 }}>P: {e.previous}{e.unit}</span>
                        <span style={{ color: DIM, fontSize: 10 }}>{e.category}</span>
                        <span style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 2, textAlign: 'center',
                          background: e.importance === 'HIGH' ? 'rgba(239,83,80,0.2)' : 'rgba(245,166,35,0.1)',
                          color: e.importance === 'HIGH' ? RED : AMBER
                        }}>{e.importance}</span>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {tab === 3 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: AMBER, fontWeight: 'bold' }}>SELECT INDICATOR: </span>
                <select onChange={e => {
                  const ind = indicators.find(i => i.id === e.target.value);
                  if (ind) setSelectedInd(ind);
                }} value={selectedInd?.id || ''} style={{
                  padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                  color: WHITE, fontFamily: 'monospace', fontSize: 11
                }}>
                  <option value="">Choose...</option>
                  {indicators.map(ind => <option key={ind.id} value={ind.id}>{ind.name} ({ind.country})</option>)}
                </select>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                {selectedInd ? (
                  <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: DIM }}>
                    Select an indicator to view trend chart
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 4 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>CENTRAL BANK RATES & POLICY</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {cbIndicators.map(cb => (
                  <div key={cb.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: WHITE, fontWeight: 'bold' }}>{cb.name}</span>
                      <span style={{ color: CYAN }}>{cb.country}</span>
                    </div>
                    <div style={{ color: AMBER, fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>{cb.actual}%</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                      <div>
                        <span style={{ color: DIM }}>Previous: </span>
                        <span style={{ color: WHITE }}>{cb.previous}%</span>
                      </div>
                      <div>
                        <span style={{ color: DIM }}>Expected: </span>
                        <span style={{ color: WHITE }}>{cb.forecast}%</span>
                      </div>
                      <div>
                        <span style={{ color: DIM }}>Next Meeting: </span>
                        <span style={{ color: AMBER }}>{cb.nextRelease}</span>
                      </div>
                      <div>
                        <span style={{ color: DIM }}>Frequency: </span>
                        <span style={{ color: WHITE }}>{cb.frequency}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, padding: '4px 8px', background: 'rgba(245,166,35,0.1)', borderRadius: 2 }}>
                      <span style={{ color: DIM, fontSize: 9 }}>Market pricing: </span>
                      <span style={{ color: AMBER, fontSize: 10 }}>
                        {Math.random() > 0.5 ? 'Hold' : Math.random() > 0.5 ? '-25bp Cut' : '+25bp Hike'}
                        {' '}({(60 + Math.random() * 35).toFixed(0)}% prob)
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rate comparison table */}
              <div style={{ marginTop: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>GLOBAL RATE COMPARISON</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Central Bank', 'Current', 'YTD Change', 'Next Meeting', 'Market Expects'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cbIndicators.map(cb => {
                      const ytdChange = Math.round((cb.actual - cb.previous) * 100);
                      return (
                        <tr key={cb.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '5px 8px', color: WHITE }}>{cb.name}</td>
                          <td style={{ padding: '5px 8px', color: AMBER, fontWeight: 'bold' }}>{cb.actual}%</td>
                          <td style={{ padding: '5px 8px', color: ytdChange >= 0 ? GREEN : RED }}>
                            {ytdChange >= 0 ? '+' : ''}{ytdChange}bp
                          </td>
                          <td style={{ padding: '5px 8px', color: DIM }}>{cb.nextRelease}</td>
                          <td style={{ padding: '5px 8px', color: CYAN }}>
                            {Math.random() > 0.5 ? 'HOLD' : 'CUT -25bp'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 5 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>CUSTOM INDICATOR GROUPS</div>
              {[
                { name: 'Inflation Watch', indicators: ['CPI (YoY)', 'Core CPI (YoY)', 'PPI (YoY)', 'PCE Deflator', 'Core PCE'] },
                { name: 'Labor Market', indicators: ['Non-Farm Payrolls', 'Unemployment Rate', 'Average Hourly Earnings', 'Initial Jobless Claims', 'JOLTS Job Openings'] },
                { name: 'Growth Pulse', indicators: ['Real GDP (QoQ)', 'ISM Manufacturing', 'ISM Services', 'Industrial Production', 'Retail Sales (MoM)'] },
                { name: 'Housing & Consumer', indicators: ['Housing Starts', 'Existing Home Sales', 'Consumer Confidence', 'Michigan Sentiment', 'Personal Income'] },
              ].map(group => (
                <div key={group.name} style={{ marginBottom: 16, background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
                  <div style={{ color: CYAN, fontWeight: 'bold', marginBottom: 8 }}>{group.name}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Indicator', 'Actual', 'Forecast', 'Surprise'].map(h => (
                          <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: AMBER, fontSize: 9, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.indicators.map(name => {
                        const ind = indicators.find(i => i.name === name);
                        if (!ind) return null;
                        const surprise = ind.actual - ind.forecast;
                        return (
                          <tr key={name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '4px 8px', color: WHITE, fontSize: 11 }}>{ind.name}</td>
                            <td style={{ padding: '4px 8px', color: WHITE }}>{ind.actual}{ind.unit}</td>
                            <td style={{ padding: '4px 8px', color: DIM }}>{ind.forecast}{ind.unit}</td>
                            <td style={{ padding: '4px 8px', color: surprise > 0 ? GREEN : surprise < 0 ? RED : DIM }}>
                              {surprise > 0 ? '▲' : surprise < 0 ? '▼' : '='} {Math.abs(surprise).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Source: BLS, BEA, Census, Fed, ECB, BoE, BoJ</span>
        <span style={{ color: DIM }}>{filtered.length} indicators displayed</span>
        <span style={{ color: DIM }}>Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
