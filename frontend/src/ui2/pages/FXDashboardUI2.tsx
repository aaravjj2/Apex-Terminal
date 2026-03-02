/**
 * FXDashboardUI2 — Bloomberg Terminal-Grade FX Analytics Dashboard
 * Tabs: CROSS RATES | FORWARDS | CENTRAL BANKS | VOL SURFACE | POSITIONING | CARRY TRADE
 */
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', BLUE = '#42a5f5';
const PURPLE = '#ab47bc', ORANGE = '#ff8a65', SUBTLE = '#555', TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

type Tab = 'cross' | 'forwards' | 'central' | 'vol' | 'positioning' | 'carry';

const CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'] as const;
type Ccy = typeof CCYS[number];

// Realistic FX rates (quote convention: CCY/USD or USD/CCY)
const BASE_RATES: Record<string, number> = {
  'EUR/USD': 1.0852, 'GBP/USD': 1.2648, 'USD/JPY': 149.82, 'USD/CHF': 0.8812,
  'AUD/USD': 0.6524, 'USD/CAD': 1.3598, 'NZD/USD': 0.6142,
  'EUR/GBP': 0.8581, 'EUR/JPY': 162.58, 'EUR/CHF': 0.9564, 'EUR/AUD': 1.6635,
  'EUR/CAD': 1.4755, 'EUR/NZD': 1.7669, 'GBP/JPY': 189.42, 'GBP/CHF': 1.1142,
  'GBP/AUD': 1.9389, 'GBP/CAD': 1.7193, 'GBP/NZD': 2.0596, 'AUD/JPY': 97.72,
  'AUD/NZD': 1.0622, 'AUD/CHF': 0.5750, 'AUD/CAD': 0.8874, 'CAD/JPY': 110.18,
  'CAD/CHF': 0.6481, 'CHF/JPY': 170.02, 'NZD/JPY': 92.01, 'NZD/CHF': 0.5414,
  'NZD/CAD': 0.8352,
};

const CHANGES: Record<string, number> = {
  'EUR/USD': 0.0012, 'GBP/USD': -0.0028, 'USD/JPY': 0.34, 'USD/CHF': -0.0018,
  'AUD/USD': 0.0035, 'USD/CAD': -0.0042, 'NZD/USD': 0.0018,
};

function getCrossRate(base: Ccy, quote: Ccy): number {
  if (base === quote) return 1;
  const key1 = `${base}/${quote}`;
  const key2 = `${quote}/${base}`;
  if (BASE_RATES[key1]) return BASE_RATES[key1];
  if (BASE_RATES[key2]) return 1 / BASE_RATES[key2];
  // Derive via USD
  const baseUsd = base === 'USD' ? 1 : (BASE_RATES[`${base}/USD`] || 1 / (BASE_RATES[`USD/${base}`] || 1));
  const quoteUsd = quote === 'USD' ? 1 : (BASE_RATES[`${quote}/USD`] || 1 / (BASE_RATES[`USD/${quote}`] || 1));
  return baseUsd / quoteUsd;
}

const CENTRAL_BANKS = [
  { bank: 'Federal Reserve', ccy: 'USD', rate: 5.50, lastChange: '2023-07-26', nextMeeting: '2026-03-19', expected: 'HOLD', probCut: 12, probHold: 82, probHike: 6 },
  { bank: 'ECB', ccy: 'EUR', rate: 4.50, lastChange: '2023-09-14', nextMeeting: '2026-03-06', expected: 'CUT', probCut: 65, probHold: 32, probHike: 3 },
  { bank: 'Bank of England', ccy: 'GBP', rate: 5.25, lastChange: '2023-08-03', nextMeeting: '2026-03-20', expected: 'HOLD', probCut: 28, probHold: 68, probHike: 4 },
  { bank: 'Bank of Japan', ccy: 'JPY', rate: 0.25, lastChange: '2024-03-19', nextMeeting: '2026-03-14', expected: 'HIKE', probCut: 2, probHold: 38, probHike: 60 },
  { bank: 'Swiss National Bank', ccy: 'CHF', rate: 1.75, lastChange: '2023-06-22', nextMeeting: '2026-03-20', expected: 'HOLD', probCut: 42, probHold: 55, probHike: 3 },
  { bank: 'Reserve Bank of Australia', ccy: 'AUD', rate: 4.35, lastChange: '2023-11-07', nextMeeting: '2026-04-01', expected: 'CUT', probCut: 55, probHold: 42, probHike: 3 },
  { bank: 'Bank of Canada', ccy: 'CAD', rate: 5.00, lastChange: '2023-07-12', nextMeeting: '2026-03-12', expected: 'CUT', probCut: 48, probHold: 48, probHike: 4 },
  { bank: 'Reserve Bank of NZ', ccy: 'NZD', rate: 5.50, lastChange: '2023-05-24', nextMeeting: '2026-04-09', expected: 'CUT', probCut: 72, probHold: 26, probHike: 2 },
  { bank: 'Riksbank', ccy: 'SEK', rate: 4.00, lastChange: '2023-09-21', nextMeeting: '2026-03-27', expected: 'CUT', probCut: 58, probHold: 38, probHike: 4 },
  { bank: "People's Bank of China", ccy: 'CNY', rate: 3.45, lastChange: '2023-08-21', nextMeeting: '2026-03-20', expected: 'CUT', probCut: 35, probHold: 62, probHike: 3 },
];

const FORWARD_TENORS = ['ON', 'TN', '1W', '2W', '1M', '2M', '3M', '6M', '9M', '1Y', '2Y'];
const FORWARD_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];

function genForwardPts(pair: string): number[] {
  const seed = pair.charCodeAt(0) + pair.charCodeAt(4);
  return FORWARD_TENORS.map((_, i) => {
    const base = (seed % 10 - 5) * (i + 1) * 0.3;
    return Math.round(base * 10) / 10;
  });
}

const VOL_DELTAS = ['10D Put', '25D Put', 'ATM', '25D Call', '10D Call'];
const VOL_TENORS = ['ON', '1W', '2W', '1M', '2M', '3M', '6M', '1Y'];

function genVolSurface(): number[][] {
  return VOL_TENORS.map((_, ti) =>
    VOL_DELTAS.map((_, di) => {
      const smile = Math.abs(di - 2) * 0.8;
      const term = 6 + ti * 0.4 + smile + Math.random() * 0.5;
      return Math.round(term * 100) / 100;
    })
  );
}

// Positioning data (CFTC COT-style)
const POSITIONING = CCYS.filter(c => c !== 'USD').map(ccy => {
  const net = Math.round((Math.random() - 0.5) * 80000);
  const longPos = Math.round(Math.abs(net) + Math.random() * 50000);
  const shortPos = longPos - net;
  return {
    ccy,
    net,
    long: longPos,
    short: shortPos,
    change: Math.round((Math.random() - 0.5) * 12000),
    percentile: Math.round(Math.random() * 100),
    extreme: Math.abs(net) > 50000,
  };
});

// ── UI helpers ──────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 0,
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '4px 10px',
  background: 'rgba(255,153,0,0.06)', borderBottom: `1px solid ${BORDER}`,
  fontSize: 9, fontFamily: MONO, color: AMBER, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
};

const cellTd: CSSProperties = {
  padding: '4px 8px', fontSize: 11, fontFamily: MONO,
  borderBottom: `1px solid ${BORDER}`, color: TEXT, textAlign: 'right',
};

const thStyle: CSSProperties = {
  ...cellTd, color: SUBTLE, fontSize: 9, textTransform: 'uppercase',
  letterSpacing: '0.08em', fontWeight: 700, position: 'sticky', top: 0,
  background: PANEL, zIndex: 1,
};

// ─── CROSS RATES TAB ────────────────────────────────────────────────────────────

function CrossRatesTab() {
  const [selected, setSelected] = useState<{ base: Ccy; quote: Ccy } | null>(null);

  const colorForRate = (base: Ccy, quote: Ccy): string => {
    const pair = `${base}/${quote}`;
    const rev = `${quote}/${base}`;
    const chg = CHANGES[pair] ?? (CHANGES[rev] ? -CHANGES[rev] : 0);
    if (chg > 0) return GREEN;
    if (chg < 0) return RED;
    return TEXT;
  };

  const formatRate = (v: number): string => {
    if (v > 100) return v.toFixed(2);
    if (v > 10) return v.toFixed(3);
    return v.toFixed(4);
  };

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={headerStyle}>FX CROSS-RATE MATRIX</div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>BASE\QUOTE</th>
                {CCYS.map(c => <th key={c} style={thStyle}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {CCYS.map(base => (
                <tr key={base} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {}}>
                  <td style={{ ...cellTd, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{base}</td>
                  {CCYS.map(quote => {
                    if (base === quote) {
                      return <td key={quote} style={{ ...cellTd, background: 'rgba(255,153,0,0.05)', color: SUBTLE }}>—</td>;
                    }
                    const rate = getCrossRate(base, quote);
                    return (
                      <td key={quote}
                          style={{ ...cellTd, color: colorForRate(base, quote), cursor: 'pointer' }}
                          onClick={() => setSelected({ base, quote })}>
                        {formatRate(rate)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ ...panelStyle, width: 280 }}>
        <div style={headerStyle}>PAIR DETAIL</div>
        <div style={{ padding: 12 }}>
          {selected ? (() => {
            const pair = `${selected.base}/${selected.quote}`;
            const rate = getCrossRate(selected.base, selected.quote);
            const spread = rate * 0.0001;
            const chg = CHANGES[pair] ?? (CHANGES[`${selected.quote}/${selected.base}`] ? -CHANGES[`${selected.quote}/${selected.base}`] : (Math.random() - 0.5) * 0.01);
            const chgPct = (chg / rate) * 100;
            const dayHigh = rate + Math.abs(chg) * 1.5;
            const dayLow = rate - Math.abs(chg) * 1.2;
            return (
              <div style={{ fontFamily: MONO, fontSize: 11 }}>
                <div style={{ color: AMBER, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{pair}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><span style={{ color: SUBTLE }}>BID</span><br/><span style={{ color: GREEN }}>{(rate - spread).toFixed(5)}</span></div>
                  <div><span style={{ color: SUBTLE }}>ASK</span><br/><span style={{ color: RED }}>{(rate + spread).toFixed(5)}</span></div>
                  <div><span style={{ color: SUBTLE }}>MID</span><br/><span style={{ color: TEXT }}>{rate.toFixed(5)}</span></div>
                  <div><span style={{ color: SUBTLE }}>SPREAD</span><br/><span style={{ color: TEXT }}>{(spread * 2 * 10000).toFixed(1)} pips</span></div>
                  <div><span style={{ color: SUBTLE }}>CHANGE</span><br/><span style={{ color: chg >= 0 ? GREEN : RED }}>{chg >= 0 ? '+' : ''}{chg.toFixed(4)}</span></div>
                  <div><span style={{ color: SUBTLE }}>CHG %</span><br/><span style={{ color: chgPct >= 0 ? GREEN : RED }}>{chgPct >= 0 ? '+' : ''}{chgPct.toFixed(3)}%</span></div>
                  <div><span style={{ color: SUBTLE }}>DAY HIGH</span><br/><span style={{ color: TEXT }}>{dayHigh.toFixed(5)}</span></div>
                  <div><span style={{ color: SUBTLE }}>DAY LOW</span><br/><span style={{ color: TEXT }}>{dayLow.toFixed(5)}</span></div>
                </div>
                <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                  <div style={{ color: SUBTLE, fontSize: 9, marginBottom: 4 }}>52-WEEK RANGE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: TEXT, fontSize: 10 }}>{(rate * 0.94).toFixed(4)}</span>
                    <div style={{ flex: 1, height: 4, background: BORDER, borderRadius: 2, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '60%', top: -2, width: 8, height: 8, borderRadius: '50%', background: AMBER }} />
                    </div>
                    <span style={{ color: TEXT, fontSize: 10 }}>{(rate * 1.06).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{ color: SUBTLE, fontFamily: MONO, fontSize: 11, textAlign: 'center', marginTop: 40 }}>
              Click a cross rate to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FORWARDS TAB ───────────────────────────────────────────────────────────────

function ForwardsTab() {
  const [selPair, setSelPair] = useState('EUR/USD');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const forwardData = FORWARD_PAIRS.map(p => ({ pair: p, pts: genForwardPts(p) }));

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw forward points chart for selected pair
    const data = forwardData.find(d => d.pair === selPair)?.pts || [];
    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    const minV = Math.min(...data, 0), maxV = Math.max(...data, 0);
    const range = maxV - minV || 1;

    // Grid
    ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (ch / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      const val = maxV - (range / 5) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), pad.left - 4, y + 3);
    }

    // X labels
    ctx.textAlign = 'center';
    data.forEach((_, i) => {
      const x = pad.left + (cw / (data.length - 1)) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '8px ' + MONO;
      ctx.fillText(FORWARD_TENORS[i], x, h - 8);
    });

    // Zero line
    const zeroY = pad.top + ch * (maxV / range);
    ctx.strokeStyle = SUBTLE; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(w - pad.right, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + (cw / (data.length - 1)) * i;
      const y = pad.top + ch * ((maxV - v) / range);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.stroke();

    // Dots
    data.forEach((v, i) => {
      const x = pad.left + (cw / (data.length - 1)) * i;
      const y = pad.top + ch * ((maxV - v) / range);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = v >= 0 ? GREEN : RED; ctx.fill();
    });

    // Title
    ctx.fillStyle = AMBER; ctx.font = 'bold 11px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText(`${selPair} Forward Points`, pad.left, 14);
  }, [selPair, forwardData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {FORWARD_PAIRS.map(p => (
          <button key={p} onClick={() => setSelPair(p)}
            style={{ padding: '4px 10px', fontSize: 10, fontFamily: MONO, cursor: 'pointer',
              background: selPair === p ? 'rgba(255,153,0,0.15)' : PANEL,
              border: `1px solid ${selPair === p ? AMBER : BORDER}`,
              color: selPair === p ? AMBER : TEXT, borderRadius: 0 }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ ...panelStyle, flex: 1, minHeight: 200 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ ...panelStyle }}>
        <div style={headerStyle}>FORWARD POINTS TABLE</div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>PAIR</th>
                {FORWARD_TENORS.map(t => <th key={t} style={thStyle}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {forwardData.map(({ pair, pts }) => (
                <tr key={pair}>
                  <td style={{ ...cellTd, textAlign: 'left', color: AMBER }}>{pair}</td>
                  {pts.map((v, i) => (
                    <td key={i} style={{ ...cellTd, color: v >= 0 ? GREEN : RED }}>
                      {v >= 0 ? '+' : ''}{v.toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── CENTRAL BANKS TAB ──────────────────────────────────────────────────────────

function CentralBanksTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={headerStyle}>CENTRAL BANK POLICY RATES</div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>CENTRAL BANK</th>
                <th style={thStyle}>CCY</th>
                <th style={thStyle}>RATE %</th>
                <th style={thStyle}>LAST CHANGE</th>
                <th style={thStyle}>NEXT MEETING</th>
                <th style={thStyle}>EXPECTED</th>
                <th style={thStyle}>P(CUT)</th>
                <th style={thStyle}>P(HOLD)</th>
                <th style={thStyle}>P(HIKE)</th>
              </tr>
            </thead>
            <tbody>
              {CENTRAL_BANKS.map(cb => (
                <tr key={cb.bank}>
                  <td style={{ ...cellTd, textAlign: 'left', color: TEXT }}>{cb.bank}</td>
                  <td style={{ ...cellTd, color: AMBER }}>{cb.ccy}</td>
                  <td style={{ ...cellTd, color: BLUE, fontWeight: 700 }}>{cb.rate.toFixed(2)}%</td>
                  <td style={{ ...cellTd, color: SUBTLE }}>{cb.lastChange}</td>
                  <td style={{ ...cellTd, color: TEXT }}>{cb.nextMeeting}</td>
                  <td style={{
                    ...cellTd,
                    color: cb.expected === 'CUT' ? RED : cb.expected === 'HIKE' ? GREEN : BLUE,
                    fontWeight: 700,
                  }}>{cb.expected}</td>
                  <td style={{ ...cellTd }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: Math.max(cb.probCut * 0.6, 2), height: 8, background: RED, borderRadius: 1 }} />
                      <span style={{ color: RED, fontSize: 10 }}>{cb.probCut}%</span>
                    </div>
                  </td>
                  <td style={{ ...cellTd }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: Math.max(cb.probHold * 0.6, 2), height: 8, background: BLUE, borderRadius: 1 }} />
                      <span style={{ color: BLUE, fontSize: 10 }}>{cb.probHold}%</span>
                    </div>
                  </td>
                  <td style={{ ...cellTd }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: Math.max(cb.probHike * 0.6, 2), height: 8, background: GREEN, borderRadius: 1 }} />
                      <span style={{ color: GREEN, fontSize: 10 }}>{cb.probHike}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── VOL SURFACE TAB ────────────────────────────────────────────────────────────

function VolSurfaceTab() {
  const [pair, setPair] = useState('EUR/USD');
  const surface = genVolSurface();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw vol term structure (ATM vol across tenors)
    const atmIdx = 2;
    const atmVols = surface.map(row => row[atmIdx]);
    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    const minV = Math.min(...atmVols) - 1, maxV = Math.max(...atmVols) + 1;
    const range = maxV - minV;

    // Grid
    ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      const val = maxV - (range / 4) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1) + '%', pad.left - 4, y + 3);
    }

    // X labels
    ctx.textAlign = 'center';
    VOL_TENORS.forEach((t, i) => {
      const x = pad.left + (cw / (VOL_TENORS.length - 1)) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '8px ' + MONO;
      ctx.fillText(t, x, h - 8);
    });

    // ATM line
    ctx.beginPath();
    atmVols.forEach((v, i) => {
      const x = pad.left + (cw / (atmVols.length - 1)) * i;
      const y = pad.top + ch * ((maxV - v) / range);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.stroke();

    // 25D RR line
    const rr = surface.map(row => row[3] - row[1]);
    ctx.beginPath();
    rr.forEach((v, i) => {
      const x = pad.left + (cw / (rr.length - 1)) * i;
      const scaled = pad.top + ch * 0.5 + v * ch * 0.1;
      if (i === 0) ctx.moveTo(x, scaled); else ctx.lineTo(x, scaled);
    });
    ctx.strokeStyle = PURPLE; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2]); ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('— ATM Vol', pad.left, 14);
    ctx.fillStyle = PURPLE;
    ctx.fillText('--- 25D Risk Reversal', pad.left + 100, 14);
  }, [pair, surface]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {FORWARD_PAIRS.map(p => (
          <button key={p} onClick={() => setPair(p)}
            style={{ padding: '4px 10px', fontSize: 10, fontFamily: MONO, cursor: 'pointer',
              background: pair === p ? 'rgba(255,153,0,0.15)' : PANEL,
              border: `1px solid ${pair === p ? AMBER : BORDER}`,
              color: pair === p ? AMBER : TEXT, borderRadius: 0 }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ ...panelStyle, flex: 1, minHeight: 200 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ ...panelStyle }}>
        <div style={headerStyle}>{pair} VOLATILITY SURFACE</div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>TENOR</th>
                {VOL_DELTAS.map(d => <th key={d} style={thStyle}>{d}</th>)}
                <th style={thStyle}>25D RR</th>
                <th style={thStyle}>25D BF</th>
              </tr>
            </thead>
            <tbody>
              {surface.map((row, ti) => {
                const rr = row[3] - row[1];
                const bf = (row[1] + row[3]) / 2 - row[2];
                return (
                  <tr key={ti}>
                    <td style={{ ...cellTd, textAlign: 'left', color: AMBER }}>{VOL_TENORS[ti]}</td>
                    {row.map((v, di) => (
                      <td key={di} style={{ ...cellTd, color: di === 2 ? BLUE : TEXT }}>{v.toFixed(2)}%</td>
                    ))}
                    <td style={{ ...cellTd, color: rr >= 0 ? GREEN : RED }}>{rr >= 0 ? '+' : ''}{rr.toFixed(2)}</td>
                    <td style={{ ...cellTd, color: PURPLE }}>{bf.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── POSITIONING TAB ────────────────────────────────────────────────────────────

function PositioningTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 20, right: 20, bottom: 30, left: 60 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    const maxAbs = Math.max(...POSITIONING.map(p => Math.abs(p.net)));
    const barW = cw / POSITIONING.length - 8;

    // Zero line
    const zeroY = pad.top + ch / 2;
    ctx.strokeStyle = SUBTLE; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(w - pad.right, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Bars
    POSITIONING.forEach((p, i) => {
      const x = pad.left + (cw / POSITIONING.length) * i + 4;
      const barH = (Math.abs(p.net) / maxAbs) * (ch / 2);
      const y = p.net >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = p.net >= 0 ? GREEN : RED;
      ctx.fillRect(x, y, barW, barH);

      // Label
      ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'center';
      ctx.fillText(p.ccy, x + barW / 2, h - 8);

      // Value
      ctx.fillStyle = p.net >= 0 ? GREEN : RED; ctx.font = '9px ' + MONO;
      const valY = p.net >= 0 ? y - 4 : y + barH + 12;
      ctx.fillText((p.net / 1000).toFixed(1) + 'K', x + barW / 2, valY);
    });

    ctx.fillStyle = AMBER; ctx.font = 'bold 11px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('NET SPECULATIVE POSITIONING (CONTRACTS)', pad.left, 14);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ ...panelStyle, flex: 1, minHeight: 200 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ ...panelStyle }}>
        <div style={headerStyle}>CFTC COT POSITIONING DATA</div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>CCY</th>
                <th style={thStyle}>NET</th>
                <th style={thStyle}>LONG</th>
                <th style={thStyle}>SHORT</th>
                <th style={thStyle}>WoW CHG</th>
                <th style={thStyle}>PERCENTILE</th>
                <th style={thStyle}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {POSITIONING.map(p => (
                <tr key={p.ccy}>
                  <td style={{ ...cellTd, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{p.ccy}</td>
                  <td style={{ ...cellTd, color: p.net >= 0 ? GREEN : RED, fontWeight: 700 }}>
                    {p.net >= 0 ? '+' : ''}{p.net.toLocaleString()}
                  </td>
                  <td style={{ ...cellTd, color: GREEN }}>{p.long.toLocaleString()}</td>
                  <td style={{ ...cellTd, color: RED }}>{p.short.toLocaleString()}</td>
                  <td style={{ ...cellTd, color: p.change >= 0 ? GREEN : RED }}>
                    {p.change >= 0 ? '+' : ''}{p.change.toLocaleString()}
                  </td>
                  <td style={cellTd}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 6, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${p.percentile}%`, height: '100%', background: p.percentile > 80 ? RED : p.percentile < 20 ? GREEN : BLUE }} />
                      </div>
                      <span style={{ fontSize: 10/*, color: TEXT*/ }}>{p.percentile}%</span>
                    </div>
                  </td>
                  <td style={{ ...cellTd, color: p.extreme ? RED : SUBTLE, fontWeight: p.extreme ? 700 : 400 }}>
                    {p.extreme ? '⚠ EXTREME' : 'NORMAL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── CARRY TRADE TAB ────────────────────────────────────────────────────────────

function CarryTradeTab() {
  const carryPairs = [
    { pair: 'AUD/JPY', longRate: 4.35, shortRate: 0.25, carry: 4.10, vol: 11.2, carryRisk: 0.37, ytdReturn: 8.4 },
    { pair: 'NZD/JPY', longRate: 5.50, shortRate: 0.25, carry: 5.25, vol: 12.8, carryRisk: 0.41, ytdReturn: 10.2 },
    { pair: 'USD/JPY', longRate: 5.50, shortRate: 0.25, carry: 5.25, vol: 8.9, carryRisk: 0.59, ytdReturn: 12.1 },
    { pair: 'GBP/JPY', longRate: 5.25, shortRate: 0.25, carry: 5.00, vol: 10.4, carryRisk: 0.48, ytdReturn: 9.8 },
    { pair: 'EUR/CHF', longRate: 4.50, shortRate: 1.75, carry: 2.75, vol: 5.6, carryRisk: 0.49, ytdReturn: 3.1 },
    { pair: 'USD/CHF', longRate: 5.50, shortRate: 1.75, carry: 3.75, vol: 7.2, carryRisk: 0.52, ytdReturn: 5.4 },
    { pair: 'AUD/CHF', longRate: 4.35, shortRate: 1.75, carry: 2.60, vol: 9.1, carryRisk: 0.29, ytdReturn: 2.8 },
    { pair: 'NZD/CHF', longRate: 5.50, shortRate: 1.75, carry: 3.75, vol: 10.5, carryRisk: 0.36, ytdReturn: 4.2 },
    { pair: 'CAD/JPY', longRate: 5.00, shortRate: 0.25, carry: 4.75, vol: 9.8, carryRisk: 0.48, ytdReturn: 7.6 },
    { pair: 'GBP/CHF', longRate: 5.25, shortRate: 1.75, carry: 3.50, vol: 8.3, carryRisk: 0.42, ytdReturn: 4.8 },
  ].sort((a, b) => b.carryRisk - a.carryRisk);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={headerStyle}>CARRY TRADE OPPORTUNITIES (RANKED BY CARRY/RISK)</div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>PAIR</th>
                <th style={thStyle}>LONG RATE</th>
                <th style={thStyle}>SHORT RATE</th>
                <th style={thStyle}>CARRY (bp)</th>
                <th style={thStyle}>IV %</th>
                <th style={thStyle}>CARRY/RISK</th>
                <th style={thStyle}>YTD RETURN</th>
                <th style={thStyle}>SIGNAL</th>
              </tr>
            </thead>
            <tbody>
              {carryPairs.map(cp => (
                <tr key={cp.pair}>
                  <td style={{ ...cellTd, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{cp.pair}</td>
                  <td style={{ ...cellTd, color: GREEN }}>{cp.longRate.toFixed(2)}%</td>
                  <td style={{ ...cellTd, color: RED }}>{cp.shortRate.toFixed(2)}%</td>
                  <td style={{ ...cellTd, color: BLUE, fontWeight: 700 }}>{(cp.carry * 100).toFixed(0)} bp</td>
                  <td style={{ ...cellTd, color: TEXT }}>{cp.vol.toFixed(1)}%</td>
                  <td style={{ ...cellTd }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: 50, height: 6, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(cp.carryRisk * 100, 100)}%`, height: '100%',
                          background: cp.carryRisk > 0.45 ? GREEN : cp.carryRisk > 0.3 ? BLUE : RED }} />
                      </div>
                      <span style={{ color: cp.carryRisk > 0.45 ? GREEN : TEXT, fontWeight: 700, fontSize: 10 }}>
                        {cp.carryRisk.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...cellTd, color: cp.ytdReturn >= 0 ? GREEN : RED, fontWeight: 700 }}>
                    {cp.ytdReturn >= 0 ? '+' : ''}{cp.ytdReturn.toFixed(1)}%
                  </td>
                  <td style={{ ...cellTd }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 2, fontSize: 9, fontFamily: MONO, fontWeight: 700,
                      color: cp.carryRisk > 0.45 ? '#000' : TEXT,
                      background: cp.carryRisk > 0.45 ? GREEN : cp.carryRisk > 0.3 ? `${BLUE}30` : `${RED}30`,
                    }}>
                      {cp.carryRisk > 0.45 ? 'STRONG BUY' : cp.carryRisk > 0.3 ? 'BUY' : 'NEUTRAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'AVG CARRY', val: `${(carryPairs.reduce((s, c) => s + c.carry, 0) / carryPairs.length * 100).toFixed(0)} bp`, color: BLUE },
          { label: 'BEST CARRY/RISK', val: carryPairs[0].pair, color: GREEN },
          { label: 'AVG YTD RETURN', val: `${(carryPairs.reduce((s, c) => s + c.ytdReturn, 0) / carryPairs.length).toFixed(1)}%`, color: GREEN },
          { label: 'AVG VOL', val: `${(carryPairs.reduce((s, c) => s + c.vol, 0) / carryPairs.length).toFixed(1)}%`, color: ORANGE },
        ].map(k => (
          <div key={k.label} style={{ ...panelStyle, padding: 10, textAlign: 'center' }}>
            <div style={{ color: SUBTLE, fontSize: 9, fontFamily: MONO, letterSpacing: '0.08em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 16, fontWeight: 700, fontFamily: MONO }}>{k.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function FXDashboardUI2() {
  const [tab, setTab] = useState<Tab>('cross');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'cross', label: 'CROSS RATES' },
    { id: 'forwards', label: 'FORWARDS' },
    { id: 'central', label: 'CENTRAL BANKS' },
    { id: 'vol', label: 'VOL SURFACE' },
    { id: 'positioning', label: 'POSITIONING' },
    { id: 'carry', label: 'CARRY TRADE' },
  ];

  // KPI strip data
  const kpis = [
    { label: 'DXY', value: '104.28', change: '+0.15%', up: true },
    { label: 'EUR/USD', value: '1.0852', change: '+0.11%', up: true },
    { label: 'GBP/USD', value: '1.2648', change: '-0.22%', up: false },
    { label: 'USD/JPY', value: '149.82', change: '+0.23%', up: true },
    { label: 'GOLD', value: '2,042.80', change: '+0.45%', up: true },
    { label: 'RV 1M', value: '7.2%', change: '-0.3', up: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO }}>
      {/* KPI Strip */}
      <div style={{ display: 'flex', gap: 1, padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '4px 8px', background: PANEL,
          }}>
            <span style={{ color: SUBTLE, fontSize: 9 }}>{k.label}</span>
            <span style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>{k.value}</span>
            <span style={{ color: k.up ? GREEN : RED, fontSize: 10 }}>{k.change}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '6px 16px', fontSize: 10, fontFamily: MONO, fontWeight: 700,
              letterSpacing: '0.1em', cursor: 'pointer', border: 'none',
              background: tab === t.id ? 'rgba(255,153,0,0.08)' : 'transparent',
              color: tab === t.id ? AMBER : SUBTLE,
              borderBottom: tab === t.id ? `2px solid ${AMBER}` : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'cross' && <CrossRatesTab />}
        {tab === 'forwards' && <ForwardsTab />}
        {tab === 'central' && <CentralBanksTab />}
        {tab === 'vol' && <VolSurfaceTab />}
        {tab === 'positioning' && <PositioningTab />}
        {tab === 'carry' && <CarryTradeTab />}
      </div>
    </div>
  );
}
