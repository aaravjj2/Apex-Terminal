import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsEntry {
  id: string;
  ticker: string;
  company: string;
  sector: string;
  reportDate: string;
  timing: 'BMO' | 'AMC' | 'DMH';
  epsConsensus: number;
  epsActual?: number;
  epsSurprisePct?: number;
  revConsensusM: number;
  revActualM?: number;
  epsGrowthEst: number;
  expectedMovePct: number;
  historicalAvgMovePct: number;
  avgBeatRatePct: number;
  marketCapB: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  reported: boolean;
  direction?: 'BEAT' | 'MISS' | 'IN-LINE';
  gapPct?: number;
}

interface SeasonSummary {
  name: string;
  beatRate: number;
  avgEpsSurprise: number;
  avgRevSurprise: number;
  reported: number;
  total: number;
  guidanceRaisedPct: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COMPANIES: Record<string, { name: string; sector: string; cap: number }> = {
  NVDA: { name: 'NVIDIA Corp', sector: 'Technology', cap: 3200 },
  AAPL: { name: 'Apple Inc', sector: 'Technology', cap: 3100 },
  MSFT: { name: 'Microsoft Corp', sector: 'Technology', cap: 3000 },
  META: { name: 'Meta Platforms', sector: 'Technology', cap: 1300 },
  AMZN: { name: 'Amazon.com Inc', sector: 'Consumer', cap: 1900 },
  GOOGL: { name: 'Alphabet Inc', sector: 'Technology', cap: 2100 },
  TSLA: { name: 'Tesla Inc', sector: 'Consumer', cap: 1100 },
  JPM: { name: 'JPMorgan Chase', sector: 'Financials', cap: 650 },
  GS: { name: 'Goldman Sachs', sector: 'Financials', cap: 180 },
  JNJ: { name: 'Johnson & Johnson', sector: 'Health Care', cap: 380 },
  UNH: { name: 'UnitedHealth Group', sector: 'Health Care', cap: 450 },
  LLY: { name: 'Eli Lilly', sector: 'Health Care', cap: 850 },
  XOM: { name: 'ExxonMobil', sector: 'Energy', cap: 500 },
  BA: { name: 'Boeing Co', sector: 'Industrials', cap: 120 },
  CAT: { name: 'Caterpillar Inc', sector: 'Industrials', cap: 180 },
};

let idCounter = 0;
const genEntry = (ticker: string, daysOffset: number, reported = false): EarningsEntry => {
  const info = COMPANIES[ticker] ?? { name: ticker, sector: 'Unknown', cap: 50 };
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const epsConsensus = +(0.5 + Math.random() * 8).toFixed(2);
  const importance: EarningsEntry['importance'] = info.cap > 500 ? 'critical' : info.cap > 100 ? 'high' : 'medium';
  const expectedMove = 3 + Math.random() * 12;
  const epsActual = reported ? +(epsConsensus * (0.9 + Math.random() * 0.3)).toFixed(2) : undefined;
  const epsSurprisePct = epsActual !== undefined ? +((epsActual - epsConsensus) / Math.abs(epsConsensus) * 100).toFixed(2) : undefined;
  const direction: EarningsEntry['direction'] = epsSurprisePct !== undefined
    ? epsSurprisePct > 2 ? 'BEAT' : epsSurprisePct < -2 ? 'MISS' : 'IN-LINE'
    : undefined;
  const gapPct = reported ? +(direction === 'BEAT' ? Math.random() * 8 : direction === 'MISS' ? -(Math.random() * 8) : (Math.random() - 0.5) * 3).toFixed(2) : undefined;
  return {
    id: `e_${++idCounter}`,
    ticker,
    company: info.name,
    sector: info.sector,
    reportDate: d.toISOString().slice(0, 10),
    timing: (['BMO', 'AMC', 'DMH'] as const)[Math.floor(Math.random() * 3)],
    epsConsensus,
    epsActual,
    epsSurprisePct,
    revConsensusM: +(10 + Math.random() * 200).toFixed(1),
    revActualM: reported ? +(10 + Math.random() * 200).toFixed(1) : undefined,
    epsGrowthEst: +(-10 + Math.random() * 60).toFixed(1),
    expectedMovePct: +expectedMove.toFixed(1),
    historicalAvgMovePct: +(expectedMove * (0.8 + Math.random() * 0.4)).toFixed(1),
    avgBeatRatePct: +(60 + Math.random() * 25).toFixed(1),
    marketCapB: info.cap,
    importance,
    reported,
    direction,
    gapPct,
  };
};

const UPCOMING_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOGL', 'TSLA', 'JPM', 'GS', 'JNJ', 'UNH', 'LLY', 'XOM', 'BA', 'CAT'];
const generateCalendar = (): EarningsEntry[] => {
  const entries: EarningsEntry[] = [];
  UPCOMING_TICKERS.forEach((t, i) => {
    entries.push(genEntry(t, i * 2, i < 5));
  });
  return entries.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
};

const MOCK_SEASON: SeasonSummary = {
  name: 'Q2 2025 Earnings Season', beatRate: 76.3, avgEpsSurprise: 8.2,
  avgRevSurprise: 2.1, reported: 312, total: 500, guidanceRaisedPct: 58.4,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ImportanceDot: React.FC<{ level: EarningsEntry['importance'] }> = ({ level }) => {
  const colors: Record<string, string> = { critical: '#ff4466', high: '#ff9900', medium: '#4a9eff', low: '#445566' };
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: colors[level], marginRight: 4 }} />;
};

const DirectionBadge: React.FC<{ direction?: string }> = ({ direction }) => {
  if (!direction) return null;
  const colors: Record<string, string> = { BEAT: '#00d4aa', MISS: '#ff4466', 'IN-LINE': '#ff9900' };
  const color = colors[direction] ?? '#8899aa';
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 2,
      fontSize: 10, fontWeight: 700, background: color + '22', color,
    }}>{direction}</span>
  );
};

const SeasonBar: React.FC<{ season: SeasonSummary }> = ({ season }) => {
  const pct = (season.reported / season.total) * 100;
  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid #1a2a38', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 12, color: '#4a9eff', fontWeight: 700, marginBottom: 2 }}>{season.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 120, height: 6, background: '#0a1628', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: '#4a9eff', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, color: '#8899aa' }}>{season.reported}/{season.total} ({pct.toFixed(0)}%)</span>
        </div>
      </div>
      {[
        { label: 'BEAT RATE', value: season.beatRate + '%', color: '#00d4aa' },
        { label: 'AVG EPS SURP', value: '+' + season.avgEpsSurprise + '%', color: '#00d4aa' },
        { label: 'AVG REV SURP', value: '+' + season.avgRevSurprise + '%', color: '#4a9eff' },
        { label: 'GUIDE RAISED', value: season.guidanceRaisedPct + '%', color: '#ff9900' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#445566', fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
        </div>
      ))}
    </div>
  );
};

const CalendarRow: React.FC<{ entry: EarningsEntry; isSelected: boolean; onClick: () => void }> = ({ entry, isSelected, onClick }) => {
  const surpColor = (entry.epsSurprisePct ?? 0) >= 0 ? '#00d4aa' : '#ff4466';
  const gapColor = (entry.gapPct ?? 0) >= 0 ? '#00d4aa' : '#ff4466';
  return (
    <div onClick={onClick} style={{
      display: 'grid',
      gridTemplateColumns: '90px 80px 180px 55px 65px 65px 60px 60px 60px 55px',
      alignItems: 'center', padding: '5px 12px', cursor: 'pointer',
      background: isSelected ? '#0e1c2e' : entry.reported ? '#060e18' : 'transparent',
      borderBottom: '1px solid #0d1a26',
      borderLeft: isSelected ? '2px solid #4a9eff' : '2px solid transparent',
      fontSize: 11, opacity: entry.reported ? 1 : 0.95,
    }}>
      <span style={{ color: '#4a9eff', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        <ImportanceDot level={entry.importance} />{entry.ticker}
      </span>
      <span style={{ color: '#8899aa' }}>{entry.reportDate}</span>
      <span style={{ color: '#aabbcc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.company}</span>
      <span style={{ color: '#667788', fontSize: 10 }}>{entry.timing}</span>
      <span style={{ color: '#ccd0d5' }}>${entry.epsConsensus}</span>
      {entry.reported ? (
        <span style={{ color: surpColor, fontWeight: 600 }}>
          ${entry.epsActual} {entry.epsSurprisePct !== undefined ? `(${entry.epsSurprisePct > 0 ? '+' : ''}${entry.epsSurprisePct}%)` : ''}
        </span>
      ) : (
        <span style={{ color: '#445566' }}>--</span>
      )}
      <span style={{ color: '#8899aa' }}>{entry.expectedMovePct}%</span>
      {entry.reported && entry.gapPct !== undefined ? (
        <span style={{ color: gapColor, fontWeight: 600 }}>{entry.gapPct > 0 ? '+' : ''}{entry.gapPct}%</span>
      ) : (
        <span style={{ color: '#445566' }}>--</span>
      )}
      <div><DirectionBadge direction={entry.direction} /></div>
      <span style={{ color: '#8899aa' }}>{entry.avgBeatRatePct}%</span>
    </div>
  );
};

const DetailPanel: React.FC<{ entry: EarningsEntry }> = ({ entry }) => (
  <div style={{ padding: 16, background: '#060e18', minWidth: 300, borderLeft: '1px solid #1a2a38' }}>
    <div style={{ color: '#4a9eff', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
      {entry.ticker} — {entry.company}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { label: 'Report Date', value: entry.reportDate + ' ' + entry.timing },
        { label: 'Sector', value: entry.sector },
        { label: 'Market Cap', value: '$' + entry.marketCapB + 'B' },
        { label: 'EPS Consensus', value: '$' + entry.epsConsensus },
        { label: 'EPS Actual', value: entry.epsActual !== undefined ? '$' + entry.epsActual : 'Pending' },
        { label: 'EPS Surprise', value: entry.epsSurprisePct !== undefined ? (entry.epsSurprisePct > 0 ? '+' : '') + entry.epsSurprisePct + '%' : 'Pending', color: entry.epsSurprisePct !== undefined ? (entry.epsSurprisePct >= 0 ? '#00d4aa' : '#ff4466') : '#8899aa' },
        { label: 'Expected Move', value: '±' + entry.expectedMovePct + '%' },
        { label: 'Hist Avg Move', value: '±' + entry.historicalAvgMovePct + '%' },
        { label: 'Beat Rate', value: entry.avgBeatRatePct + '%' },
        { label: 'EPS Growth Est', value: (entry.epsGrowthEst > 0 ? '+' : '') + entry.epsGrowthEst + '%' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#667788' }}>{label}</span>
          <span style={{ color: color ?? '#ccd0d5', fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>
    {entry.reported && (
      <div style={{ marginTop: 12, padding: '8px 12px', background: '#0a1628', borderRadius: 4 }}>
        <div style={{ fontSize: 11, color: '#667788', marginBottom: 4 }}>RESULT</div>
        <DirectionBadge direction={entry.direction} />
        {entry.gapPct !== undefined && (
          <span style={{ marginLeft: 8, fontSize: 12, color: (entry.gapPct >= 0 ? '#00d4aa' : '#ff4466'), fontWeight: 700 }}>
            Gap: {entry.gapPct > 0 ? '+' : ''}{entry.gapPct}%
          </span>
        )}
      </div>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const EarningsCalendar: React.FC = () => {
  const [entries] = useState<EarningsEntry[]>(generateCalendar);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSector, setFilterSector] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'reported'>('all');
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'calendar' | 'season' | 'history'>('calendar');
  const [sortKey, setSortKey] = useState<'date' | 'cap' | 'move'>('date');

  const sectors = useMemo(() => ['All', ...Array.from(new Set(entries.map(e => e.sector)))], [entries]);

  const filtered = useMemo(() => {
    let data = entries;
    if (filterSector !== 'All') data = data.filter(e => e.sector === filterSector);
    if (filterStatus === 'upcoming') data = data.filter(e => !e.reported);
    if (filterStatus === 'reported') data = data.filter(e => e.reported);
    if (filterImportance !== 'all') data = data.filter(e => e.importance === filterImportance);
    if (sortKey === 'cap') data = [...data].sort((a, b) => b.marketCapB - a.marketCapB);
    if (sortKey === 'move') data = [...data].sort((a, b) => b.expectedMovePct - a.expectedMovePct);
    return data;
  }, [entries, filterSector, filterStatus, filterImportance, sortKey]);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? null;
  const beats = entries.filter(e => e.direction === 'BEAT').length;
  const misses = entries.filter(e => e.direction === 'MISS').length;
  const reported = entries.filter(e => e.reported).length;

  return (
    <div style={{ background: '#060e18', color: '#ccd0d5', fontFamily: 'monospace', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a2a38', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#4a9eff', fontSize: 14, fontWeight: 700 }}>EARNINGS CALENDAR</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Reported', value: reported, color: '#4a9eff' },
            { label: 'Beats', value: beats, color: '#00d4aa' },
            { label: 'Misses', value: misses, color: '#ff4466' },
          ].map(({ label, value, color }) => (
            <span key={label} style={{ fontSize: 11, color: '#667788' }}>
              {label}: <span style={{ color, fontWeight: 700 }}>{value}</span>
            </span>
          ))}
        </div>
      </div>

      <SeasonBar season={MOCK_SEASON} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 12px', borderBottom: '1px solid #1a2a38', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{ background: '#0a1628', border: '1px solid #1a2a38', color: '#ccd0d5', borderRadius: 3, padding: '2px 6px', fontFamily: 'monospace', fontSize: 11 }}>
          {sectors.map(s => <option key={s}>{s}</option>)}
        </select>
        {(['all', 'upcoming', 'reported'] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, background: filterStatus === f ? '#4a9eff22' : 'transparent', color: filterStatus === f ? '#4a9eff' : '#8899aa' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#667788' }}>Sort:</span>
          {(['date', 'cap', 'move'] as const).map(s => (
            <button key={s} onClick={() => setSortKey(s)} style={{ padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, background: sortKey === s ? '#ff990022' : 'transparent', color: sortKey === s ? '#ff9900' : '#8899aa' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 80px 180px 55px 65px 65px 60px 60px 60px 55px', padding: '3px 12px', borderBottom: '1px solid #1a2a38', fontSize: 10, color: '#445566', fontWeight: 700 }}>
        {['TICKER', 'DATE', 'COMPANY', 'TIME', 'EPS EST', 'EPS ACT', 'EXP MOV', 'GAP', 'RESULT', 'BEAT%'].map(h => <span key={h}>{h}</span>)}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(e => (
            <CalendarRow
              key={e.id} entry={e}
              isSelected={e.id === selectedId}
              onClick={() => setSelectedId(prev => prev === e.id ? null : e.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, color: '#445566', textAlign: 'center' }}>No earnings match current filters</div>
          )}
        </div>
        {selectedEntry && <DetailPanel entry={selectedEntry} />}
      </div>
    </div>
  );
};

export default EarningsCalendar;
