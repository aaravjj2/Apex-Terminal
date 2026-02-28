import React, { useState, useMemo, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenerCriteria {
  minMarketCap: number;
  maxMarketCap: number;
  minPE: number;
  maxPE: number;
  minRSI: number;
  maxRSI: number;
  minVolume: number;
  minDivYield: number;
  sectors: string[];
  signals: string[];
  minMomentum1m: number;
  maxMomentum1m: number;
  minRevGrowth: number;
  minEpsGrowth: number;
}

interface ScreenerResult {
  ticker: string;
  company: string;
  sector: string;
  price: number;
  change1d: number;
  change1w: number;
  change1m: number;
  change3m: number;
  marketCap: number;
  pe: number;
  fwdPe: number;
  pb: number;
  divYield: number;
  rsi: number;
  ema50: number;
  ema200: number;
  volumeAvg: number;
  volumeRatio: number;
  revGrowth: number;
  epsGrowth: number;
  grossMargin: number;
  debtEquity: number;
  roe: number;
  beta: number;
  signal: string;
  score: number;
}

// ─── Data Generator ──────────────────────────────────────────────────────────

const SECTORS = ['Technology', 'Financials', 'Health Care', 'Consumer', 'Energy', 'Industrials', 'Materials', 'Utilities', 'Real Estate'];

const UNIVERSE: Record<string, { name: string; sector: string; cap: number; beta: number }> = {
  NVDA: { name: 'NVIDIA Corp', sector: 'Technology', cap: 3200, beta: 1.85 },
  AAPL: { name: 'Apple Inc', sector: 'Technology', cap: 3100, beta: 1.20 },
  MSFT: { name: 'Microsoft Corp', sector: 'Technology', cap: 3000, beta: 1.15 },
  META: { name: 'Meta Platforms', sector: 'Technology', cap: 1300, beta: 1.40 },
  AMZN: { name: 'Amazon.com Inc', sector: 'Consumer', cap: 1900, beta: 1.35 },
  GOOGL: { name: 'Alphabet Inc', sector: 'Technology', cap: 2100, beta: 1.18 },
  TSLA: { name: 'Tesla Inc', sector: 'Consumer', cap: 1100, beta: 2.10 },
  JPM: { name: 'JPMorgan Chase', sector: 'Financials', cap: 650, beta: 1.05 },
  GS: { name: 'Goldman Sachs', sector: 'Financials', cap: 180, beta: 1.20 },
  JNJ: { name: 'Johnson & Johnson', sector: 'Health Care', cap: 380, beta: 0.55 },
  UNH: { name: 'UnitedHealth', sector: 'Health Care', cap: 450, beta: 0.78 },
  LLY: { name: 'Eli Lilly', sector: 'Health Care', cap: 850, beta: 0.82 },
  XOM: { name: 'ExxonMobil', sector: 'Energy', cap: 500, beta: 0.85 },
  CVX: { name: 'Chevron Corp', sector: 'Energy', cap: 280, beta: 0.90 },
  CAT: { name: 'Caterpillar Inc', sector: 'Industrials', cap: 180, beta: 1.10 },
  BA: { name: 'Boeing Co', sector: 'Industrials', cap: 120, beta: 1.30 },
  AMD: { name: 'AMD Inc', sector: 'Technology', cap: 380, beta: 1.75 },
  INTC: { name: 'Intel Corp', sector: 'Technology', cap: 90, beta: 0.85 },
  NFLX: { name: 'Netflix Inc', sector: 'Consumer', cap: 420, beta: 1.55 },
  WMT: { name: 'Walmart Inc', sector: 'Consumer', cap: 750, beta: 0.45 },
  PG: { name: 'Procter & Gamble', sector: 'Consumer', cap: 380, beta: 0.55 },
  KO: { name: 'Coca-Cola Co', sector: 'Consumer', cap: 270, beta: 0.60 },
  PFE: { name: 'Pfizer Inc', sector: 'Health Care', cap: 140, beta: 0.68 },
  MRK: { name: 'Merck & Co', sector: 'Health Care', cap: 280, beta: 0.72 },
  BRK: { name: 'Berkshire Hathaway', sector: 'Financials', cap: 900, beta: 0.72 },
};

const gen = (min: number, max: number, fixed = 2) => +(min + Math.random() * (max - min)).toFixed(fixed);

const generateResults = (): ScreenerResult[] =>
  Object.entries(UNIVERSE).map(([ticker, info]) => {
    const price = gen(50, 800);
    const rsi = gen(25, 80);
    const ema50 = price * gen(0.95, 1.05);
    const ema200 = price * gen(0.88, 1.12);
    const pe = gen(10, 80);
    const score = +(Math.random() * 100).toFixed(1);
    const signal = score > 75 ? 'STRONG_BUY' : score > 55 ? 'BUY' : score > 40 ? 'NEUTRAL' : score > 25 ? 'SELL' : 'STRONG_SELL';
    return {
      ticker,
      company: info.name,
      sector: info.sector,
      price,
      change1d: gen(-4, 4),
      change1w: gen(-8, 8),
      change1m: gen(-15, 20),
      change3m: gen(-25, 40),
      marketCap: info.cap,
      pe,
      fwdPe: pe * gen(0.8, 0.95),
      pb: gen(1, 15),
      divYield: gen(0, 5),
      rsi,
      ema50,
      ema200,
      volumeAvg: Math.floor(gen(500000, 50000000, 0)),
      volumeRatio: gen(0.5, 2.5),
      revGrowth: gen(-5, 40),
      epsGrowth: gen(-10, 60),
      grossMargin: gen(20, 80),
      debtEquity: gen(0, 3),
      roe: gen(5, 50),
      beta: info.beta + gen(-0.1, 0.1),
      signal,
      score,
    };
  });

// ─── Sub-components ──────────────────────────────────────────────────────────

const Pct: React.FC<{ value: number; decimals?: number }> = ({ value, decimals = 2 }) => (
  <span style={{ color: value >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 600 }}>
    {value >= 0 ? '+' : ''}{value.toFixed(decimals)}%
  </span>
);

const SignalBadge: React.FC<{ signal: string }> = ({ signal }) => {
  const map: Record<string, [string, string]> = {
    STRONG_BUY: ['#00ff88', 'S.BUY'], BUY: ['#00d4aa', 'BUY'],
    NEUTRAL: ['#8899aa', 'NEUT'], SELL: ['#ff9900', 'SELL'], STRONG_SELL: ['#ff4466', 'S.SELL'],
  };
  const [color, label] = map[signal] ?? ['#8899aa', '?'];
  return <span style={{ padding: '1px 5px', borderRadius: 2, background: color + '22', color, fontSize: 10, fontWeight: 700 }}>{label}</span>;
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const color = score > 65 ? '#00d4aa' : score > 40 ? '#ff9900' : '#ff4466';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 6, background: '#0a1628', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: score + '%', height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color, fontSize: 10, fontWeight: 700 }}>{score.toFixed(0)}</span>
    </div>
  );
};

const FilterRange: React.FC<{
  label: string;
  min: number; max: number;
  minVal: number; maxVal: number;
  step?: number;
  onMin: (v: number) => void;
  onMax: (v: number) => void;
}> = ({ label, min, max, minVal, maxVal, step = 1, onMin, onMax }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 150 }}>
    <span style={{ fontSize: 10, color: '#667788', fontWeight: 700 }}>{label}</span>
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="number" value={minVal} min={min} max={max} step={step} onChange={e => onMin(+e.target.value)}
        style={{ width: 60, background: '#0a1628', border: '1px solid #1a2a38', color: '#ccd0d5', borderRadius: 3, padding: '2px 4px', fontFamily: 'monospace', fontSize: 11 }} />
      <span style={{ color: '#445566', fontSize: 11 }}>—</span>
      <input type="number" value={maxVal} min={min} max={max} step={step} onChange={e => onMax(+e.target.value)}
        style={{ width: 60, background: '#0a1628', border: '1px solid #1a2a38', color: '#ccd0d5', borderRadius: 3, padding: '2px 4px', fontFamily: 'monospace', fontSize: 11 }} />
    </div>
  </div>
);

// ─── Column Definitions ───────────────────────────────────────────────────────

type ColKey = keyof ScreenerResult | 'score_bar';

interface Column { key: ColKey; label: string; width: number; format: (r: ScreenerResult) => React.ReactNode }

const COLUMNS: Column[] = [
  { key: 'ticker', label: 'TICKER', width: 60, format: r => <span style={{ color: '#4a9eff', fontWeight: 700 }}>{r.ticker}</span> },
  { key: 'company', label: 'COMPANY', width: 160, format: r => <span style={{ color: '#aabbcc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.company}</span> },
  { key: 'sector', label: 'SECTOR', width: 110, format: r => <span style={{ color: '#8899aa', fontSize: 10 }}>{r.sector}</span> },
  { key: 'price', label: 'PRICE', width: 65, format: r => <span style={{ color: '#ccd0d5' }}>${r.price.toFixed(2)}</span> },
  { key: 'change1d', label: '1D%', width: 60, format: r => <Pct value={r.change1d} /> },
  { key: 'change1m', label: '1M%', width: 60, format: r => <Pct value={r.change1m} /> },
  { key: 'change3m', label: '3M%', width: 60, format: r => <Pct value={r.change3m} /> },
  { key: 'marketCap', label: 'MKT CAP', width: 70, format: r => <span style={{ color: '#aabbcc' }}>${r.marketCap}B</span> },
  { key: 'pe', label: 'P/E', width: 50, format: r => <span style={{ color: r.pe < 20 ? '#00d4aa' : r.pe > 50 ? '#ff4466' : '#ccd0d5' }}>{r.pe.toFixed(1)}</span> },
  { key: 'fwdPe', label: 'FWD P/E', width: 65, format: r => <span style={{ color: '#aabbcc' }}>{r.fwdPe.toFixed(1)}</span> },
  { key: 'rsi', label: 'RSI', width: 50, format: r => <span style={{ color: r.rsi > 70 ? '#ff4466' : r.rsi < 30 ? '#00d4aa' : '#ccd0d5' }}>{r.rsi.toFixed(1)}</span> },
  { key: 'divYield', label: 'DIV%', width: 55, format: r => <span style={{ color: r.divYield > 3 ? '#ff9900' : '#aabbcc' }}>{r.divYield.toFixed(2)}%</span> },
  { key: 'epsGrowth', label: 'EPS GRW', width: 70, format: r => <Pct value={r.epsGrowth} /> },
  { key: 'revGrowth', label: 'REV GRW', width: 70, format: r => <Pct value={r.revGrowth} /> },
  { key: 'beta', label: 'BETA', width: 50, format: r => <span style={{ color: '#8899aa' }}>{r.beta.toFixed(2)}</span> },
  { key: 'signal', label: 'SIGNAL', width: 70, format: r => <SignalBadge signal={r.signal} /> },
  { key: 'score_bar', label: 'SCORE', width: 90, format: r => <ScoreBar score={r.score} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_CRITERIA: ScreenerCriteria = {
  minMarketCap: 0, maxMarketCap: 5000, minPE: 0, maxPE: 100,
  minRSI: 0, maxRSI: 100, minVolume: 0, minDivYield: 0,
  sectors: [], signals: [], minMomentum1m: -100, maxMomentum1m: 100,
  minRevGrowth: -100, minEpsGrowth: -100,
};

const ScreenerPage: React.FC = () => {
  const [allResults] = useState<ScreenerResult[]>(generateResults);
  const [criteria, setCriteria] = useState<ScreenerCriteria>(DEFAULT_CRITERIA);
  const [sortCol, setSortCol] = useState<keyof ScreenerResult>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(COLUMNS.map(c => c.key)));
  const [showFilters, setShowFilters] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [savedScreens, setSavedScreens] = useState<{ name: string; criteria: ScreenerCriteria }[]>([]);
  const [screenName, setScreenName] = useState('');

  const filtered = useMemo(() => {
    let data = allResults.filter(r =>
      r.marketCap >= criteria.minMarketCap && r.marketCap <= criteria.maxMarketCap &&
      r.pe >= criteria.minPE && r.pe <= criteria.maxPE &&
      r.rsi >= criteria.minRSI && r.rsi <= criteria.maxRSI &&
      r.change1m >= criteria.minMomentum1m && r.change1m <= criteria.maxMomentum1m &&
      r.revGrowth >= criteria.minRevGrowth && r.epsGrowth >= criteria.minEpsGrowth &&
      (criteria.sectors.length === 0 || criteria.sectors.includes(r.sector)) &&
      (criteria.signals.length === 0 || criteria.signals.includes(r.signal))
    );
    data = [...data].sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol];
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return data;
  }, [allResults, criteria, sortCol, sortAsc]);

  const handleSort = (key: keyof ScreenerResult) => {
    if (key === sortCol) setSortAsc(v => !v);
    else { setSortCol(key); setSortAsc(false); }
  };

  const toggleSector = (s: string) => setCriteria(prev => ({
    ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x => x !== s) : [...prev.sectors, s],
  }));
  const toggleSignal = (s: string) => setCriteria(prev => ({
    ...prev, signals: prev.signals.includes(s) ? prev.signals.filter(x => x !== s) : [...prev.signals, s],
  }));

  const saveScreen = () => {
    if (!screenName.trim()) return;
    setSavedScreens(prev => [...prev, { name: screenName, criteria: { ...criteria } }]);
    setScreenName('');
  };
  const loadScreen = (idx: number) => setCriteria({ ...savedScreens[idx].criteria });
  const resetFilters = () => setCriteria(DEFAULT_CRITERIA);

  const visibleColumns = COLUMNS.filter(c => visibleCols.has(c.key));

  return (
    <div style={{ background: '#060e18', color: '#ccd0d5', fontFamily: 'monospace', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#4a9eff', fontSize: 14, fontWeight: 700 }}>STOCK SCREENER</span>
        <span style={{ color: '#445566', fontSize: 12 }}>|</span>
        <span style={{ color: '#00d4aa', fontSize: 12 }}>{filtered.length}</span>
        <span style={{ color: '#667788', fontSize: 12 }}>/ {allResults.length} results</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowFilters(v => !v)} style={{ padding: '3px 10px', borderRadius: 3, border: '1px solid #1a2a38', background: showFilters ? '#0e1c2e' : 'transparent', color: '#4a9eff', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
          {showFilters ? '▲ Filters' : '▼ Filters'}
        </button>
        <button onClick={resetFilters} style={{ padding: '3px 8px', borderRadius: 3, border: 'none', background: '#ff446622', color: '#ff4466', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>Reset</button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a2a38', background: '#060e18', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Numeric ranges */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FilterRange label="MARKET CAP ($B)" min={0} max={5000} step={10} minVal={criteria.minMarketCap} maxVal={criteria.maxMarketCap} onMin={v => setCriteria(p => ({ ...p, minMarketCap: v }))} onMax={v => setCriteria(p => ({ ...p, maxMarketCap: v }))} />
            <FilterRange label="P/E RATIO" min={0} max={200} step={1} minVal={criteria.minPE} maxVal={criteria.maxPE} onMin={v => setCriteria(p => ({ ...p, minPE: v }))} onMax={v => setCriteria(p => ({ ...p, maxPE: v }))} />
            <FilterRange label="RSI" min={0} max={100} step={1} minVal={criteria.minRSI} maxVal={criteria.maxRSI} onMin={v => setCriteria(p => ({ ...p, minRSI: v }))} onMax={v => setCriteria(p => ({ ...p, maxRSI: v }))} />
            <FilterRange label="1M MOMENTUM (%)" min={-100} max={100} step={1} minVal={criteria.minMomentum1m} maxVal={criteria.maxMomentum1m} onMin={v => setCriteria(p => ({ ...p, minMomentum1m: v }))} onMax={v => setCriteria(p => ({ ...p, maxMomentum1m: v }))} />
          </div>
          {/* Sectors */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#667788', fontWeight: 700, marginRight: 4 }}>SECTOR:</span>
            {SECTORS.map(s => (
              <button key={s} onClick={() => toggleSector(s)} style={{
                padding: '2px 7px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 10,
                background: criteria.sectors.includes(s) ? '#4a9eff' : '#0a1628',
                color: criteria.sectors.includes(s) ? '#000' : '#8899aa', fontFamily: 'monospace',
              }}>{s}</button>
            ))}
          </div>
          {/* Signals */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#667788', fontWeight: 700, marginRight: 4 }}>SIGNAL:</span>
            {['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'].map(s => {
              const colors: Record<string, string> = { STRONG_BUY: '#00ff88', BUY: '#00d4aa', NEUTRAL: '#8899aa', SELL: '#ff9900', STRONG_SELL: '#ff4466' };
              const active = criteria.signals.includes(s);
              return (
                <button key={s} onClick={() => toggleSignal(s)} style={{
                  padding: '2px 8px', borderRadius: 3, border: `1px solid ${colors[s]}44`,
                  cursor: 'pointer', fontSize: 10, fontFamily: 'monospace',
                  background: active ? colors[s] + '33' : 'transparent',
                  color: colors[s],
                }}>{s.replace('_', ' ')}</button>
              );
            })}
          </div>
          {/* Save/Load */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#667788', fontWeight: 700 }}>SAVE:</span>
            <input value={screenName} onChange={e => setScreenName(e.target.value)} placeholder="Screen name..." style={{ width: 140, background: '#0a1628', border: '1px solid #1a2a38', color: '#ccd0d5', borderRadius: 3, padding: '2px 6px', fontFamily: 'monospace', fontSize: 11 }} />
            <button onClick={saveScreen} style={{ padding: '2px 8px', borderRadius: 3, border: 'none', background: '#4a9eff22', color: '#4a9eff', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>Save</button>
            {savedScreens.map((s, i) => (
              <button key={i} onClick={() => loadScreen(i)} style={{ padding: '2px 8px', borderRadius: 3, border: '1px solid #1a2a38', background: 'transparent', color: '#ff9900', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace' }}>{s.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Table header */}
      <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid #1a2a38', background: '#060e18', overflowX: 'auto' }}>
        {visibleColumns.map(col => (
          <div key={String(col.key)} onClick={() => col.key !== 'score_bar' && handleSort(col.key as keyof ScreenerResult)}
            style={{ minWidth: col.width, width: col.width, padding: '0 8px', fontSize: 10, color: '#445566', fontWeight: 700, cursor: col.key !== 'score_bar' ? 'pointer' : 'default', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            {col.label}
            {sortCol === col.key && <span style={{ color: '#4a9eff' }}>{sortAsc ? '▲' : '▼'}</span>}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {filtered.map(r => (
          <div key={r.ticker} onClick={() => setSelectedRows(prev => { const n = new Set(prev); prev.has(r.ticker) ? n.delete(r.ticker) : n.add(r.ticker); return n; })} style={{
            display: 'flex', alignItems: 'center',
            background: selectedRows.has(r.ticker) ? '#0e1c2e' : 'transparent',
            borderBottom: '1px solid #0d1a26', cursor: 'pointer',
            borderLeft: selectedRows.has(r.ticker) ? '2px solid #4a9eff' : '2px solid transparent',
          }}>
            {visibleColumns.map(col => (
              <div key={String(col.key)} style={{ minWidth: col.width, width: col.width, padding: '5px 8px', fontSize: 11, overflow: 'hidden' }}>
                {col.format(r)}
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 24, color: '#445566', textAlign: 'center' }}>No stocks match current criteria</div>}
      </div>

      {/* Status bar */}
      <div style={{ padding: '4px 16px', borderTop: '1px solid #1a2a38', display: 'flex', gap: 16, fontSize: 10, color: '#445566' }}>
        <span>Showing <span style={{ color: '#4a9eff' }}>{filtered.length}</span> of <span style={{ color: '#8899aa' }}>{allResults.length}</span> stocks</span>
        {selectedRows.size > 0 && <span><span style={{ color: '#ff9900' }}>{selectedRows.size}</span> selected</span>}
        <span style={{ marginLeft: 'auto' }}>Sort: <span style={{ color: '#8899aa' }}>{sortCol} {sortAsc ? '↑' : '↓'}</span></span>
      </div>
    </div>
  );
};

export default ScreenerPage;
