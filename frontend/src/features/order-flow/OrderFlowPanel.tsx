import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowEntry {
  id: string;
  ticker: string;
  timestamp: string;
  expiry: string;
  strike: number;
  optionType: 'call' | 'put';
  side: 'BUY' | 'SELL';
  size: number;
  premium: number;
  totalPremium: number;
  spotAtTrade: number;
  delta: number;
  iv: number;
  isSweep: boolean;
  isUnusual: boolean;
  sentimentScore: number;
}

interface TapeEntry {
  id: string;
  ticker: string;
  timestamp: string;
  price: number;
  size: number;
  dollarValue: number;
  tradeType: string;
  side: 'BUY' | 'SELL' | 'NEUTRAL';
  exchange: string;
  isDarkPool: boolean;
  isBlock: boolean;
}

interface FlowSummary {
  ticker: string;
  callPremium: number;
  putPremium: number;
  netPremium: number;
  putCallRatio: number;
  callSweeps: number;
  putSweeps: number;
  unusualCount: number;
  sentiment: string;
}

interface GammaExposure {
  strike: number;
  callGEX: number;
  putGEX: number;
  netGEX: number;
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

const TICKERS = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'SPY', 'QQQ'];
const EXPIRIES = ['2025-07-18', '2025-08-15', '2025-09-19', '2025-12-19'];
const EXCHANGES = ['NYSE', 'NASDAQ', 'BATS', 'IEX', 'CBOE'];

const SPOT_MAP: Record<string, number> = {
  NVDA: 138, AAPL: 213, MSFT: 475, AMZN: 230, META: 660, TSLA: 342, SPY: 615, QQQ: 545,
};

let flowIdCounter = 0;
const genFlowEntry = (ticker: string): FlowEntry => {
  const spot = SPOT_MAP[ticker] ?? 100;
  const strikeBump = [-20, -15, -10, -5, 0, 5, 10, 15, 20][Math.floor(Math.random() * 9)];
  const strike = Math.round(spot + strikeBump);
  const optionType = Math.random() < 0.58 ? 'call' : 'put';
  const side = Math.random() < 0.55 ? 'BUY' : 'SELL';
  const size = Math.floor(Math.random() * 500) + 1;
  const iv = 0.20 + Math.random() * 0.50;
  const premium = spot * iv * (0.02 + Math.random() * 0.10);
  const total = premium * size * 100;
  const delta = optionType === 'call' ? 0.15 + Math.random() * 0.70 : -(0.15 + Math.random() * 0.70);
  const isSweep = Math.random() < 0.08;
  const isUnusual = size > 300 && total > 80000;
  const sentimentScore = optionType === 'call' && side === 'BUY' ? Math.random() * 0.9 : -(Math.random() * 0.9);
  const d = new Date();
  d.setSeconds(d.getSeconds() - Math.floor(Math.random() * 3600));
  return {
    id: `flow_${++flowIdCounter}`,
    ticker,
    timestamp: d.toISOString(),
    expiry: EXPIRIES[Math.floor(Math.random() * EXPIRIES.length)],
    strike,
    optionType,
    side,
    size,
    premium: +premium.toFixed(4),
    totalPremium: +total.toFixed(2),
    spotAtTrade: spot,
    delta: +delta.toFixed(3),
    iv: +iv.toFixed(4),
    isSweep,
    isUnusual,
    sentimentScore: +sentimentScore.toFixed(3),
  };
};

let tapeIdCounter = 0;
const genTapeEntry = (ticker: string): TapeEntry => {
  const spot = SPOT_MAP[ticker] ?? 100;
  const price = +(spot * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2);
  const size = Math.floor(Math.pow(10, 2 + Math.random() * 3));
  const dollar = +(price * size).toFixed(2);
  const isDark = Math.random() < 0.35;
  const isBlock = size > 50000;
  const tradeType = isDark ? 'DARK_POOL' : isBlock ? 'BLOCK' : Math.random() < 0.05 ? 'SWEEP' : 'REGULAR';
  const rnd = Math.random();
  const side = rnd < 0.48 ? 'BUY' : rnd < 0.96 ? 'SELL' : 'NEUTRAL';
  const exchange = isDark ? 'FINRA ADF' : EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
  const d = new Date();
  d.setSeconds(d.getSeconds() - Math.floor(Math.random() * 1800));
  return {
    id: `tape_${++tapeIdCounter}`,
    ticker,
    timestamp: d.toISOString(),
    price,
    size,
    dollarValue: dollar,
    tradeType,
    side,
    exchange,
    isDarkPool: isDark,
    isBlock,
  };
};

const genFlowSummary = (ticker: string): FlowSummary => {
  const callPremium = 200000 + Math.random() * 800000;
  const putPremium = 150000 + Math.random() * 600000;
  const net = callPremium - putPremium;
  const pcr = putPremium / callPremium;
  const sentiment = net > 200000 ? 'VERY_BULLISH' : net > 50000 ? 'BULLISH' : net < -200000 ? 'VERY_BEARISH' : net < -50000 ? 'BEARISH' : 'NEUTRAL';
  return {
    ticker,
    callPremium: +callPremium.toFixed(2),
    putPremium: +putPremium.toFixed(2),
    netPremium: +net.toFixed(2),
    putCallRatio: +pcr.toFixed(3),
    callSweeps: Math.floor(Math.random() * 10),
    putSweeps: Math.floor(Math.random() * 6),
    unusualCount: Math.floor(Math.random() * 15),
    sentiment,
  };
};

const genGEX = (spot: number): GammaExposure[] => {
  const points: GammaExposure[] = [];
  for (let i = -12; i <= 12; i++) {
    const strike = Math.round(spot + i * (spot * 0.01));
    const factor = Math.exp(-Math.pow(i, 2) / 8);
    const callGEX = +(factor * (500000 + Math.random() * 1000000) * (i > 0 ? 1 : 0.6)).toFixed(0);
    const putGEX = -(factor * (400000 + Math.random() * 800000) * (i < 0 ? 1 : 0.5)).toFixed(0);
    points.push({ strike, callGEX, putGEX, netGEX: callGEX + putGEX });
  }
  return points;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const formatMs = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const SentimentBadge: React.FC<{ sentiment: string }> = ({ sentiment }) => {
  const colors: Record<string, string> = {
    VERY_BULLISH: '#00ff88', BULLISH: '#00d4aa', NEUTRAL: '#8899aa',
    BEARISH: '#ff9900', VERY_BEARISH: '#ff4466',
  };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      background: (colors[sentiment] || '#8899aa') + '22',
      color: colors[sentiment] || '#8899aa', border: `1px solid ${colors[sentiment] || '#8899aa'}44`,
    }}>{sentiment.replace('_', ' ')}</span>
  );
};

const FlowRow: React.FC<{ entry: FlowEntry }> = ({ entry }) => {
  const isCall = entry.optionType === 'call';
  const isBuy = entry.side === 'BUY';
  const bullish = (isCall && isBuy) || (!isCall && !isBuy);
  const color = bullish ? '#00d4aa' : '#ff4466';
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '55px 52px 60px 58px 52px 48px 70px 80px 52px',
      alignItems: 'center', padding: '4px 8px',
      background: entry.isUnusual ? '#1a2a1a' : 'transparent',
      borderBottom: '1px solid #0d1a26',
      fontSize: 11,
    }}>
      <span style={{ color: '#4a9eff', fontWeight: 700 }}>{entry.ticker}</span>
      <span style={{ color: '#8899aa' }}>{time}</span>
      <span style={{ color: color, fontWeight: 600 }}>
        {entry.optionType.toUpperCase()} {entry.strike}
      </span>
      <span style={{ color: '#aabbcc' }}>{entry.expiry.slice(5)}</span>
      <span style={{ color: color }}>{entry.side}</span>
      <span style={{ color: '#ccd0d5' }}>{entry.size}</span>
      <span style={{ color: color, fontWeight: 600 }}>{formatMs(entry.totalPremium)}</span>
      <span style={{ color: '#8899aa' }}>{(entry.iv * 100).toFixed(1)}%</span>
      <span style={{ display: 'flex', gap: 4 }}>
        {entry.isSweep && <span style={{ color: '#ff9900', fontSize: 10 }}>SWP</span>}
        {entry.isUnusual && <span style={{ color: '#ff4466', fontSize: 10 }}>UNS</span>}
      </span>
    </div>
  );
};

const TapeRow: React.FC<{ entry: TapeEntry }> = ({ entry }) => {
  const sideColor = entry.side === 'BUY' ? '#00d4aa' : entry.side === 'SELL' ? '#ff4466' : '#8899aa';
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '55px 52px 65px 70px 55px 70px 70px',
      alignItems: 'center', padding: '3px 8px',
      background: entry.isBlock ? '#0a1628' : 'transparent',
      borderBottom: '1px solid #0d1a26', fontSize: 11,
    }}>
      <span style={{ color: '#4a9eff', fontWeight: 700 }}>{entry.ticker}</span>
      <span style={{ color: '#8899aa' }}>{time}</span>
      <span style={{ color: '#ccd0d5', fontWeight: 600 }}>{entry.price.toFixed(2)}</span>
      <span style={{ color: '#aabbcc' }}>{entry.size.toLocaleString()}</span>
      <span style={{ color: sideColor, fontWeight: 600 }}>{entry.side}</span>
      <span style={{ color: entry.isDarkPool ? '#ff9900' : '#8899aa', fontSize: 10 }}>
        {entry.tradeType}
      </span>
      <span style={{ color: '#667788' }}>{entry.exchange}</span>
    </div>
  );
};

const GEXChart: React.FC<{ data: GammaExposure[]; spot: number }> = ({ data, spot }) => {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.netGEX)));
  const barH = 16;
  const width = 340;
  const labelW = 50;
  const barW = width - labelW - 20;
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, color: '#8899aa' }}>
        <span style={{ color: '#00d4aa' }}>■ Call GEX</span>
        <span style={{ color: '#ff4466' }}>■ Put GEX</span>
        <span style={{ color: '#4a9eff' }}>● Net</span>
      </div>
      {data.map(d => {
        const isAtm = Math.abs(d.strike - spot) < spot * 0.005;
        const netPct = d.netGEX / maxAbs;
        const callPct = d.callGEX / maxAbs;
        const putPct = d.putGEX / maxAbs;
        return (
          <div key={d.strike} style={{
            display: 'flex', alignItems: 'center', marginBottom: 2,
            background: isAtm ? '#0e2040' : 'transparent',
            borderRadius: 2,
          }}>
            <div style={{ width: labelW, color: isAtm ? '#4a9eff' : '#8899aa', fontWeight: isAtm ? 700 : 400 }}>
              {d.strike}
            </div>
            <div style={{ flex: 1, position: 'relative', height: barH }}>
              <div style={{
                position: 'absolute', left: Math.min(50, 50 + netPct * 50) + '%',
                width: Math.abs(netPct) * 50 + '%', height: barH - 4, top: 2,
                background: netPct >= 0 ? '#00d4aa33' : '#ff446633', borderRadius: 2,
              }} />
              <div style={{
                position: 'absolute', left: '50%', top: barH / 2 - 1,
                width: 2, height: 2, borderRadius: '50%',
                background: '#4a9eff',
              }} />
            </div>
            <div style={{ width: 60, color: d.netGEX >= 0 ? '#00d4aa' : '#ff4466', textAlign: 'right' }}>
              {formatMs(Math.abs(d.netGEX))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

const OrderFlowPanel: React.FC = () => {
  const [activeTicker, setActiveTicker] = useState('NVDA');
  const [activeTab, setActiveTab] = useState<'flow' | 'tape' | 'gex' | 'sweeps'>('flow');
  const [flowEntries, setFlowEntries] = useState<FlowEntry[]>(() =>
    Array.from({ length: 40 }, (_, i) =>
      genFlowEntry(TICKERS[i % TICKERS.length])
    ).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  );
  const [tapeEntries, setTapeEntries] = useState<TapeEntry[]>(() =>
    Array.from({ length: 50 }, () => genTapeEntry(activeTicker))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  );
  const [summary, setSummary] = useState<FlowSummary>(() => genFlowSummary(activeTicker));
  const [gexData, setGexData] = useState<GammaExposure[]>(() => genGEX(SPOT_MAP[activeTicker] ?? 100));
  const [isLive, setIsLive] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unusual' | 'sweeps' | 'calls' | 'puts'>('all');
  const [minPremium, setMinPremium] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSummary(genFlowSummary(activeTicker));
    setGexData(genGEX(SPOT_MAP[activeTicker] ?? 100));
    setTapeEntries(
      Array.from({ length: 50 }, () => genTapeEntry(activeTicker))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    );
  }, [activeTicker]);

  useEffect(() => {
    if (!isLive) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      const newFlow = genFlowEntry(TICKERS[Math.floor(Math.random() * TICKERS.length)]);
      setFlowEntries(prev => [newFlow, ...prev.slice(0, 199)]);
      const newTape = genTapeEntry(activeTicker);
      setTapeEntries(prev => [newTape, ...prev.slice(0, 199)]);
      if (Math.random() < 0.2) setSummary(genFlowSummary(activeTicker));
    }, 1500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLive, activeTicker]);

  const filteredFlow = useMemo(() => {
    let data = flowEntries;
    if (filter === 'unusual') data = data.filter(e => e.isUnusual);
    else if (filter === 'sweeps') data = data.filter(e => e.isSweep);
    else if (filter === 'calls') data = data.filter(e => e.optionType === 'call');
    else if (filter === 'puts') data = data.filter(e => e.optionType === 'put');
    if (minPremium > 0) data = data.filter(e => e.totalPremium >= minPremium * 1000);
    return data;
  }, [flowEntries, filter, minPremium]);

  const sweepsOnly = flowEntries.filter(e => e.isSweep);
  const spot = SPOT_MAP[activeTicker] ?? 100;

  const TABS = [
    { key: 'flow', label: 'Options Flow' },
    { key: 'tape', label: 'Live Tape' },
    { key: 'gex', label: 'GEX' },
    { key: 'sweeps', label: `Sweeps (${sweepsOnly.length})` },
  ] as const;

  return (
    <div style={{ background: '#060e18', color: '#ccd0d5', fontFamily: 'monospace', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#4a9eff', fontSize: 14, fontWeight: 700 }}>ORDER FLOW</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TICKERS.map(t => (
            <button key={t} onClick={() => setActiveTicker(t)} style={{
              padding: '3px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 11,
              background: activeTicker === t ? '#4a9eff' : '#0a1628',
              color: activeTicker === t ? '#000' : '#8899aa', fontFamily: 'monospace',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={() => setIsLive(v => !v)} style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 3, border: 'none',
          background: isLive ? '#00d4aa22' : '#ff446622', color: isLive ? '#00d4aa' : '#ff4466',
          cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        }}>{isLive ? '⏸ PAUSE' : '▶ LIVE'}</button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: '1px solid #1a2a38', flexWrap: 'wrap' }}>
        {[
          { label: 'CALL $', value: formatMs(summary.callPremium), color: '#00d4aa' },
          { label: 'PUT $', value: formatMs(summary.putPremium), color: '#ff4466' },
          { label: 'NET', value: formatMs(Math.abs(summary.netPremium)), color: summary.netPremium > 0 ? '#00d4aa' : '#ff4466' },
          { label: 'P/C', value: summary.putCallRatio.toFixed(2), color: '#8899aa' },
          { label: 'C SWEEPS', value: summary.callSweeps, color: '#ff9900' },
          { label: 'P SWEEPS', value: summary.putSweeps, color: '#ff9900' },
          { label: 'UNUSUAL', value: summary.unusualCount, color: '#ff4466' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ color: '#445566', fontSize: 9, fontWeight: 700 }}>{label}</span>
            <span style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <SentimentBadge sentiment={summary.sentiment} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2a38' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontFamily: 'monospace', fontWeight: 600,
            background: activeTab === key ? '#0e1c2e' : 'transparent',
            color: activeTab === key ? '#4a9eff' : '#8899aa',
            borderBottom: activeTab === key ? '2px solid #4a9eff' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'flow' && (
          <>
            <div style={{ display: 'flex', gap: 8, padding: '6px 12px', borderBottom: '1px solid #0d1a26', flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'unusual', 'sweeps', 'calls', 'puts'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
                  background: filter === f ? '#4a9eff22' : 'transparent',
                  color: filter === f ? '#4a9eff' : '#8899aa', fontSize: 11, fontFamily: 'monospace',
                }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#667788', fontSize: 11 }}>Min $</span>
                <input
                  type="number" value={minPremium} onChange={e => setMinPremium(+e.target.value)}
                  style={{ width: 60, background: '#0a1628', border: '1px solid #1a2a38', color: '#ccd0d5', borderRadius: 3, padding: '2px 4px', fontFamily: 'monospace', fontSize: 11 }}
                />
                <span style={{ color: '#667788', fontSize: 11 }}>K</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '55px 52px 60px 58px 52px 48px 70px 80px 52px', padding: '3px 8px', borderBottom: '1px solid #1a2a38', fontSize: 10, color: '#445566', fontWeight: 700 }}>
              {['TICKER', 'TIME', 'OPT', 'EXP', 'SIDE', 'SIZE', 'TOTAL', 'IV', 'FLAGS'].map(h => <span key={h}>{h}</span>)}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredFlow.map(e => <FlowRow key={e.id} entry={e} />)}
            </div>
          </>
        )}

        {activeTab === 'tape' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '55px 52px 65px 70px 55px 70px 70px', padding: '3px 8px', borderBottom: '1px solid #1a2a38', fontSize: 10, color: '#445566', fontWeight: 700 }}>
              {['TICKER', 'TIME', 'PRICE', 'SIZE', 'SIDE', 'TYPE', 'EXCH'].map(h => <span key={h}>{h}</span>)}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tapeEntries.map(e => <TapeRow key={e.id} entry={e} />)}
            </div>
          </>
        )}

        {activeTab === 'gex' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ marginBottom: 8, color: '#8899aa', fontSize: 12 }}>
              Gamma Exposure by Strike — <span style={{ color: '#4a9eff' }}>{activeTicker}</span> @ <span style={{ color: '#ccd0d5' }}>{spot}</span>
            </div>
            <GEXChart data={gexData} spot={spot} />
          </div>
        )}

        {activeTab === 'sweeps' && (
          <>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid #0d1a26', color: '#8899aa', fontSize: 11 }}>
              {sweepsOnly.length} sweep orders detected across all tickers
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '55px 52px 60px 58px 52px 48px 70px 80px 52px', padding: '3px 8px', borderBottom: '1px solid #1a2a38', fontSize: 10, color: '#445566', fontWeight: 700 }}>
              {['TICKER', 'TIME', 'OPT', 'EXP', 'SIDE', 'SIZE', 'TOTAL', 'IV', 'FLAGS'].map(h => <span key={h}>{h}</span>)}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sweepsOnly.map(e => <FlowRow key={e.id} entry={e} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderFlowPanel;
