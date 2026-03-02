import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ── Theme ─────────────────────────────────────────────────── */
const BG      = '#0a0a0a';
const PANEL   = '#111111';
const BORDER  = '#1e1e1e';
const AMBER   = '#f5a623';
const GREEN   = '#26a69a';
const RED     = '#ef5350';
const BLUE    = '#42a5f5';
const PURPLE  = '#ab47bc';
const ORANGE  = '#ff8a65';
const CYAN    = '#00bcd4';
const SUBTLE  = '#555';
const TEXT    = '#d1d4dc';
const MONO    = '"Roboto Mono","Courier New",monospace';

/* ── Types ─────────────────────────────────────────────────── */
interface Idea {
  id: number; author: string; avatar: string; title: string;
  symbol: string; direction: 'LONG' | 'SHORT';
  timeframe: string; timestamp: string;
  likes: number; comments: number; views: number;
  description: string; tags: string[];
  winRate: number; profitFactor: number;
}

interface Contributor {
  rank: number; name: string; avatar: string;
  ideas: number; followers: number; winRate: number;
  reputation: number; badge: string; streak: number;
}

interface SentimentData {
  symbol: string; bullish: number; bearish: number;
  mentions: number; change24h: number;
}

interface ChatMessage {
  time: string; user: string; message: string; role: string;
}

/* ── Mock Data ─────────────────────────────────────────────── */
const IDEAS: Idea[] = [
  { id: 1, author: 'AlphaTrader', avatar: 'AT', title: 'BTC Breaking Out of Descending Wedge — $48K Target', symbol: 'BTCUSD', direction: 'LONG', timeframe: '4H', timestamp: '2h ago', likes: 342, comments: 48, views: 8420, description: 'Clean breakout from the descending wedge pattern on the 4H timeframe. Volume confirmation present with RSI divergence. Target at the measured move height projected from the breakout point.', tags: ['bitcoin', 'breakout', 'wedge'], winRate: 72, profitFactor: 2.4 },
  { id: 2, author: 'ChartMaster', avatar: 'CM', title: 'NVDA Head & Shoulders — Bearish Reversal Setup', symbol: 'NVDA', direction: 'SHORT', timeframe: '1D', timestamp: '4h ago', likes: 218, comments: 35, views: 5640, description: 'Classic H&S pattern forming on NVDA daily chart. Neckline at $445, target at $420. Wait for neckline break with volume confirmation before entry.', tags: ['nvidia', 'reversal', 'headshoulders'], winRate: 65, profitFactor: 1.8 },
  { id: 3, author: 'SwingKing', avatar: 'SK', title: 'Gold Breaking $2050 Resistance — New ATH Incoming', symbol: 'XAUUSD', direction: 'LONG', timeframe: '1W', timestamp: '6h ago', likes: 428, comments: 62, views: 12800, description: 'Weekly close above $2050 resistance confirming the breakout. Monthly RSI breaking out of a multi-year range. Targets at $2150 and $2300 based on fibonacci extensions.', tags: ['gold', 'breakout', 'ATH'], winRate: 78, profitFactor: 3.1 },
  { id: 4, author: 'QuantEdge', avatar: 'QE', title: 'SPY Divergence at All-Time Highs — Caution Advised', symbol: 'SPY', direction: 'SHORT', timeframe: '1D', timestamp: '8h ago', likes: 186, comments: 42, views: 4280, description: 'Bearish divergence on MACD and RSI at new highs. Market breadth deteriorating with fewer stocks participating. Smart money flow negative. Hedging recommended.', tags: ['sp500', 'divergence', 'macro'], winRate: 68, profitFactor: 2.0 },
  { id: 5, author: 'CryptoNinja', avatar: 'CN', title: 'SOL/USD Cup and Handle — Measured Move to $140', symbol: 'SOLUSD', direction: 'LONG', timeframe: '1D', timestamp: '12h ago', likes: 524, comments: 78, views: 18600, description: 'Beautiful cup and handle pattern on SOL daily. Handle forming at the $95-100 support zone. Volume profile shows strong support. Breakout target at $140 based on cup depth.', tags: ['solana', 'cup&handle', 'crypto'], winRate: 74, profitFactor: 2.8 },
  { id: 6, author: 'FXWizard', avatar: 'FW', title: 'EUR/USD Double Bottom at 1.0720 — Target 1.1000', symbol: 'EURUSD', direction: 'LONG', timeframe: '4H', timestamp: '14h ago', likes: 156, comments: 28, views: 3420, description: 'Clean double bottom formation at the 1.0720 support level. RSI showing bullish divergence. ECB rate path shifting hawkish relative to Fed expectations.', tags: ['eurusd', 'doublebottom', 'forex'], winRate: 70, profitFactor: 2.2 },
  { id: 7, author: 'TechBull', avatar: 'TB', title: 'AAPL Approaching Critical $200 Level — Breakout Setup', symbol: 'AAPL', direction: 'LONG', timeframe: '1D', timestamp: '18h ago', likes: 298, comments: 54, views: 9840, description: 'AAPL consolidating in a tight range below $200 psychological resistance. Volume contracting typical of pre-breakout behavior. Services revenue growth supporting valuation.', tags: ['apple', 'breakout', 'tech'], winRate: 62, profitFactor: 1.6 },
  { id: 8, author: 'MacroMind', avatar: 'MM', title: 'TLT Yield Curve Steepening Play — Bonds Rally', symbol: 'TLT', direction: 'LONG', timeframe: '1W', timestamp: '1d ago', likes: 142, comments: 32, views: 2860, description: 'Fed pivot expectations driving long-duration bond rally. TLT breaking out of a multi-month base. Yield curve steepening as short rates decline faster than long rates.', tags: ['bonds', 'macro', 'yieldcurve'], winRate: 66, profitFactor: 1.9 },
];

const CONTRIBUTORS: Contributor[] = [
  { rank: 1,  name: 'AlphaTrader',  avatar: 'AT', ideas: 342, followers: 48200,  winRate: 72, reputation: 9850,  badge: '🏆', streak: 12 },
  { rank: 2,  name: 'CryptoNinja',  avatar: 'CN', ideas: 286, followers: 42800,  winRate: 74, reputation: 9420,  badge: '🥇', streak: 8 },
  { rank: 3,  name: 'SwingKing',    avatar: 'SK', ideas: 418, followers: 38600,  winRate: 78, reputation: 9180,  badge: '🥇', streak: 15 },
  { rank: 4,  name: 'ChartMaster',  avatar: 'CM', ideas: 524, followers: 35400,  winRate: 65, reputation: 8860,  badge: '🥇', streak: 6 },
  { rank: 5,  name: 'QuantEdge',    avatar: 'QE', ideas: 198, followers: 28600,  winRate: 68, reputation: 8540,  badge: '🥈', streak: 4 },
  { rank: 6,  name: 'TechBull',     avatar: 'TB', ideas: 312, followers: 24200,  winRate: 62, reputation: 7920,  badge: '🥈', streak: 3 },
  { rank: 7,  name: 'FXWizard',     avatar: 'FW', ideas: 248, followers: 18400,  winRate: 70, reputation: 7680,  badge: '🥈', streak: 7 },
  { rank: 8,  name: 'MacroMind',    avatar: 'MM', ideas: 186, followers: 15600,  winRate: 66, reputation: 7240,  badge: '🥉', streak: 2 },
  { rank: 9,  name: 'DayTrader99',  avatar: 'DT', ideas: 624, followers: 12800,  winRate: 58, reputation: 6840,  badge: '🥉', streak: 1 },
  { rank: 10, name: 'ValueHunter',  avatar: 'VH', ideas: 98,  followers: 8400,   winRate: 82, reputation: 6520,  badge: '🥉', streak: 5 },
];

const SENTIMENT: SentimentData[] = [
  { symbol: 'BTC',  bullish: 72, bearish: 28, mentions: 12480, change24h: 8.5 },
  { symbol: 'ETH',  bullish: 68, bearish: 32, mentions: 8420,  change24h: 5.2 },
  { symbol: 'SOL',  bullish: 78, bearish: 22, mentions: 6240,  change24h: 24.5 },
  { symbol: 'NVDA', bullish: 45, bearish: 55, mentions: 4860,  change24h: -12.4 },
  { symbol: 'AAPL', bullish: 62, bearish: 38, mentions: 3420,  change24h: 3.8 },
  { symbol: 'SPY',  bullish: 52, bearish: 48, mentions: 8640,  change24h: -2.4 },
  { symbol: 'GOLD', bullish: 74, bearish: 26, mentions: 5280,  change24h: 15.2 },
  { symbol: 'TSLA', bullish: 58, bearish: 42, mentions: 7860,  change24h: 6.8 },
  { symbol: 'AVAX', bullish: 82, bearish: 18, mentions: 2840,  change24h: 32.6 },
  { symbol: 'EUR/USD', bullish: 56, bearish: 44, mentions: 1860, change24h: -1.2 },
];

const CHAT_MESSAGES: ChatMessage[] = [
  { time: '14:32', user: 'AlphaTrader', message: 'BTC breaking out of the wedge as called. $48K target still valid.', role: 'pro' },
  { time: '14:30', user: 'CryptoNinja', message: 'SOL looking incredibly strong. Cup and handle formation is textbook.', role: 'pro' },
  { time: '14:28', user: 'NewTrader42', message: 'Should I buy NVDA here or wait for the pullback?', role: 'member' },
  { time: '14:26', user: 'ChartMaster', message: 'NVDA H&S still valid. Wait for neckline break confirmation. Patience.', role: 'pro' },
  { time: '14:24', user: 'SwingKing', message: 'Gold weekly close above $2050 is MASSIVE. Multi-year breakout confirmed.', role: 'pro' },
  { time: '14:22', user: 'DayTrader99', message: 'Took profits on my ES long. Nice 20 point move today.', role: 'member' },
  { time: '14:20', user: 'QuantEdge', message: 'Market breadth is concerning. A/D line diverging from SPX.', role: 'pro' },
  { time: '14:18', user: 'FXWizard', message: 'EUR/USD double bottom playing out. Target 1.1000 intact.', role: 'pro' },
  { time: '14:16', user: 'MacroMind', message: 'Treasury auction results bullish for TLT. Indirect bidders strong.', role: 'pro' },
  { time: '14:14', user: 'BullOrBear', message: 'What\'s everyone thinking about CPI tomorrow? Consensus seems low.', role: 'member' },
  { time: '14:12', user: 'AlphaTrader', message: 'CPI will determine the next leg. Position sizing should be reduced.', role: 'pro' },
  { time: '14:10', user: 'ValueHunter', message: 'Quietly building a position in GOOGL. Undervalued relative to peers.', role: 'pro' },
];

const KPI_DATA = [
  { label: 'IDEAS TODAY', value: '142', change: 12 },
  { label: 'ACTIVE USERS', value: '8.4K', change: 5.2 },
  { label: 'TRENDING', value: 'BTC', change: 0 },
  { label: 'AVG WIN RATE', value: '68%', change: 2.4 },
  { label: 'TOP IDEA VIEWS', value: '18.6K', change: 0 },
  { label: 'CHAT MSGS/HR', value: '2.4K', change: 8.5 },
];

/* ── Styles ────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root: { background: BG, color: TEXT, fontFamily: MONO, fontSize: 11, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  kpiStrip: { display: 'flex', gap: 1, padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  kpiItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px', borderRight: `1px solid ${BORDER}` },
  kpiLabel: { color: SUBTLE, fontSize: 9, letterSpacing: 1.2 },
  kpiValue: { fontSize: 12, fontWeight: 600 },
  tabBar: { display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  tab: { padding: '6px 16px', cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, borderBottom: '2px solid transparent', color: SUBTLE, transition: 'all .15s' },
  tabActive: { color: AMBER, borderBottomColor: AMBER },
  body: { flex: 1, overflow: 'auto', padding: 8 },
  panel: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, marginBottom: 8 },
  panelHead: { padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: 1.2, color: AMBER, textTransform: 'uppercase' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { padding: '5px 8px', textAlign: 'right' as const, color: SUBTLE, fontSize: 9, letterSpacing: 1, borderBottom: `1px solid ${BORDER}`, position: 'sticky' as const, top: 0, background: PANEL },
  thLeft: { textAlign: 'left' as const },
  td: { padding: '4px 8px', textAlign: 'right' as const, borderBottom: `1px solid ${BORDER}22` },
  tdLeft: { textAlign: 'left' as const },
  gridRow: { display: 'grid', gap: 8 },
};

function chColor(v: number): string { return v >= 0 ? GREEN : RED; }
function chSign(v: number): string { return v >= 0 ? '+' : ''; }
function fmt(v: number, dec = 1): string { return v.toFixed(dec); }

/* ── KPI Strip ─────────────────────────────────────────────── */
const KPIStrip: React.FC = () => (
  <div style={S.kpiStrip}>
    {KPI_DATA.map(k => (
      <div key={k.label} style={S.kpiItem}>
        <span style={S.kpiLabel}>{k.label}</span>
        <span style={{ ...S.kpiValue, color: k.change > 0 ? GREEN : k.change === 0 ? AMBER : RED }}>{k.value}</span>
        {k.change !== 0 && <span style={{ fontSize: 10, color: chColor(k.change) }}>{chSign(k.change)}{fmt(k.change)}%</span>}
      </div>
    ))}
  </div>
);

/* ── Idea Card ─────────────────────────────────────────────── */
const IdeaCard: React.FC<{ idea: Idea }> = ({ idea }) => (
  <div style={{ ...S.panel, cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.borderColor = AMBER)} onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
    <div style={{ padding: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
            {idea.avatar}
          </div>
          <div>
            <div style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>{idea.author}</div>
            <div style={{ color: SUBTLE, fontSize: 9 }}>{idea.timestamp} · {idea.timeframe}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: 9, fontWeight: 700, background: idea.direction === 'LONG' ? `${GREEN}20` : `${RED}20`, color: idea.direction === 'LONG' ? GREEN : RED, border: `1px solid ${idea.direction === 'LONG' ? GREEN : RED}40` }}>
            {idea.direction}
          </span>
          <span style={{ color: AMBER, fontWeight: 600 }}>{idea.symbol}</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{idea.title}</div>

      {/* Description */}
      <div style={{ color: SUBTLE, fontSize: 10, lineHeight: '1.5', marginBottom: 8 }}>{idea.description}</div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' as const }}>
        {idea.tags.map(t => (
          <span key={t} style={{ padding: '1px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 9, color: BLUE }}>#{t}</span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: SUBTLE, fontSize: 10 }}>♥ {idea.likes}</span>
          <span style={{ color: SUBTLE, fontSize: 10 }}>💬 {idea.comments}</span>
          <span style={{ color: SUBTLE, fontSize: 10 }}>👁 {(idea.views / 1000).toFixed(1)}K</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 9, color: GREEN }}>WR: {idea.winRate}%</span>
          <span style={{ fontSize: 9, color: AMBER }}>PF: {idea.profitFactor.toFixed(1)}</span>
        </div>
      </div>
    </div>
  </div>
);

/* ── Ideas Feed Tab ────────────────────────────────────────── */
const IdeasFeedTab: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
  const filtered = filter === 'ALL' ? IDEAS : IDEAS.filter(i => i.direction === filter);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        {(['ALL', 'LONG', 'SHORT'] as const).map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{ padding: '4px 12px', borderRadius: 2, cursor: 'pointer', fontSize: 10, letterSpacing: 1, background: filter === f ? (f === 'LONG' ? `${GREEN}20` : f === 'SHORT' ? `${RED}20` : `${AMBER}20`) : 'transparent', color: filter === f ? (f === 'LONG' ? GREEN : f === 'SHORT' ? RED : AMBER) : SUBTLE, border: `1px solid ${filter === f ? (f === 'LONG' ? GREEN : f === 'SHORT' ? RED : AMBER) : BORDER}40` }}>
            {f}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {(['recent', 'popular', 'trending'] as const).map(s => (
          <div key={s} onClick={() => setSortBy(s)} style={{ padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: sortBy === s ? AMBER : SUBTLE }}>
            {s}
          </div>
        ))}
      </div>

      {/* Ideas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {filtered.map(idea => <IdeaCard key={idea.id} idea={idea} />)}
      </div>
    </div>
  );
};

/* ── Sentiment Tab ─────────────────────────────────────────── */
const SentimentTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 260;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const barH = Math.min(20, chartH / SENTIMENT.length - 4);

    SENTIMENT.forEach((s, i) => {
      const y = pad.top + (i / SENTIMENT.length) * chartH + 2;
      const bullW = (s.bullish / 100) * chartW;
      const bearW = chartW - bullW;

      // Bull bar
      ctx.fillStyle = `${GREEN}80`;
      ctx.fillRect(pad.left, y, bullW, barH);
      // Bear bar
      ctx.fillStyle = `${RED}60`;
      ctx.fillRect(pad.left + bullW, y, bearW, barH);

      // Label
      ctx.fillStyle = AMBER; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(s.symbol, pad.left - 6, y + barH / 2 + 3);

      // Percentages  
      ctx.fillStyle = '#fff'; ctx.font = '8px ' + MONO; ctx.textAlign = 'center';
      if (bullW > 40) ctx.fillText(`${s.bullish}%`, pad.left + bullW / 2, y + barH / 2 + 3);
      if (bearW > 40) ctx.fillText(`${s.bearish}%`, pad.left + bullW + bearW / 2, y + barH / 2 + 3);
    });

    ctx.fillStyle = AMBER; ctx.font = 'bold 10px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('COMMUNITY SENTIMENT', pad.left, pad.top - 10);
    // Legend
    ctx.fillStyle = `${GREEN}80`; ctx.fillRect(W - 200, pad.top - 16, 10, 10);
    ctx.fillStyle = TEXT; ctx.font = '9px ' + MONO; ctx.fillText('Bullish', W - 186, pad.top - 7);
    ctx.fillStyle = `${RED}60`; ctx.fillRect(W - 120, pad.top - 16, 10, 10);
    ctx.fillStyle = TEXT; ctx.fillText('Bearish', W - 106, pad.top - 7);
  }, []);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelHead}>SOCIAL SENTIMENT ANALYSIS</div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>SENTIMENT DETAILS</div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>SYMBOL</th>
                <th style={S.th}>BULLISH</th>
                <th style={S.th}>BEARISH</th>
                <th style={S.th}>MENTIONS</th>
                <th style={S.th}>24H CHG</th>
                <th style={S.th}>SENTIMENT</th>
              </tr>
            </thead>
            <tbody>
              {SENTIMENT.map(s => (
                <tr key={s.symbol}>
                  <td style={{ ...S.td, ...S.tdLeft, color: AMBER, fontWeight: 600 }}>{s.symbol}</td>
                  <td style={{ ...S.td, color: GREEN }}>{s.bullish}%</td>
                  <td style={{ ...S.td, color: RED }}>{s.bearish}%</td>
                  <td style={S.td}>{(s.mentions / 1000).toFixed(1)}K</td>
                  <td style={{ ...S.td, color: chColor(s.change24h) }}>{chSign(s.change24h)}{fmt(s.change24h)}%</td>
                  <td style={S.td}>
                    <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 9, background: s.bullish > 60 ? `${GREEN}20` : s.bullish < 40 ? `${RED}20` : `${AMBER}20`, color: s.bullish > 60 ? GREEN : s.bullish < 40 ? RED : AMBER }}>
                      {s.bullish > 65 ? 'VERY BULLISH' : s.bullish > 55 ? 'BULLISH' : s.bullish < 35 ? 'VERY BEARISH' : s.bullish < 45 ? 'BEARISH' : 'NEUTRAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trending Topics */}
      <div style={S.panel}>
        <div style={S.panelHead}>TRENDING TOPICS</div>
        <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
          {[
            { tag: '#BTCBreakout', count: 2840, trend: 'up' },
            { tag: '#GoldATH', count: 1860, trend: 'up' },
            { tag: '#NVDAEarnings', count: 1420, trend: 'down' },
            { tag: '#FedPivot', count: 3240, trend: 'up' },
            { tag: '#SOLSeason', count: 2180, trend: 'up' },
            { tag: '#CPI', count: 4620, trend: 'neutral' },
            { tag: '#AltSeason', count: 1680, trend: 'up' },
            { tag: '#Bonds', count: 980, trend: 'up' },
            { tag: '#DeFi', count: 1240, trend: 'up' },
            { tag: '#Macro', count: 2860, trend: 'neutral' },
            { tag: '#TechBubble', count: 860, trend: 'down' },
            { tag: '#YieldCurve', count: 720, trend: 'up' },
          ].map(t => (
            <div key={t.tag} style={{ padding: '4px 10px', background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: BLUE, fontSize: 10 }}>{t.tag}</span>
              <span style={{ color: SUBTLE, fontSize: 9 }}>{(t.count / 1000).toFixed(1)}K</span>
              <span style={{ color: t.trend === 'up' ? GREEN : t.trend === 'down' ? RED : SUBTLE, fontSize: 9 }}>
                {t.trend === 'up' ? '▲' : t.trend === 'down' ? '▼' : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Leaderboard Tab ───────────────────────────────────────── */
const LeaderboardTab: React.FC = () => (
  <div>
    <div style={S.panel}>
      <div style={S.panelHead}>TOP CONTRIBUTORS<span style={{ color: SUBTLE, fontSize: 9 }}>ALL TIME</span></div>
      <div style={{ overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'center' as const, width: 30 }}>#</th>
              <th style={{ ...S.th, ...S.thLeft }}>CONTRIBUTOR</th>
              <th style={S.th}>BADGE</th>
              <th style={S.th}>IDEAS</th>
              <th style={S.th}>FOLLOWERS</th>
              <th style={S.th}>WIN RATE</th>
              <th style={S.th}>REPUTATION</th>
              <th style={S.th}>STREAK</th>
            </tr>
          </thead>
          <tbody>
            {CONTRIBUTORS.map(c => (
              <tr key={c.name} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...S.td, textAlign: 'center' as const, color: c.rank <= 3 ? AMBER : SUBTLE, fontWeight: c.rank <= 3 ? 700 : 400 }}>{c.rank}</td>
                <td style={{ ...S.td, ...S.tdLeft }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.rank <= 3 ? AMBER : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#000' }}>
                      {c.avatar}
                    </div>
                    <span style={{ color: AMBER, fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ ...S.td, textAlign: 'center' as const }}>{c.badge}</td>
                <td style={S.td}>{c.ideas}</td>
                <td style={S.td}>{(c.followers / 1000).toFixed(1)}K</td>
                <td style={{ ...S.td, color: c.winRate >= 70 ? GREEN : c.winRate >= 60 ? AMBER : RED }}>{c.winRate}%</td>
                <td style={{ ...S.td, color: AMBER }}>{c.reputation.toLocaleString()}</td>
                <td style={S.td}>
                  <span style={{ color: c.streak >= 7 ? GREEN : c.streak >= 3 ? AMBER : TEXT}}>
                    🔥 {c.streak}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Stats cards */}
    <div style={{ ...S.gridRow, gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {[
        { label: 'Total Contributors', value: '24.8K', color: AMBER },
        { label: 'Ideas Published', value: '142.6K', color: GREEN },
        { label: 'Community Win Rate', value: '64.2%', color: BLUE },
        { label: 'Ideas This Week', value: '1,842', color: PURPLE },
      ].map(s => (
        <div key={s.label} style={{ ...S.panel, padding: 12, textAlign: 'center' }}>
          <div style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1.2 }}>{s.label.toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Chat Tab ──────────────────────────────────────────────── */
const ChatTab: React.FC = () => {
  const [msg, setMsg] = useState('');
  const [channel, setChannel] = useState('general');
  const channels = ['general', 'crypto', 'stocks', 'forex', 'macro', 'options'];

  return (
    <div style={{ display: 'flex', gap: 8, height: '100%' }}>
      {/* Channel sidebar */}
      <div style={{ ...S.panel, width: 150, flexShrink: 0 }}>
        <div style={S.panelHead}>CHANNELS</div>
        <div style={{ padding: 4 }}>
          {channels.map(c => (
            <div key={c} onClick={() => setChannel(c)} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 2, background: channel === c ? `${AMBER}15` : 'transparent', color: channel === c ? AMBER : SUBTLE, fontSize: 10, marginBottom: 2 }}>
              # {c}
            </div>
          ))}
        </div>
        <div style={{ ...S.panelHead, marginTop: 8 }}>ONLINE — 842</div>
        <div style={{ padding: 4, maxHeight: 200, overflow: 'auto' }}>
          {CONTRIBUTORS.slice(0, 6).map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px'  }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
              <span style={{ color: TEXT, fontSize: 9 }}>{c.name}</span>
              {c.rank <= 3 && <span style={{ fontSize: 8 }}>{c.badge}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={S.panel}>
          <div style={S.panelHead}>#{channel.toUpperCase()}<span style={{ color: SUBTLE, fontSize: 9 }}>842 online</span></div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8, maxHeight: 500 }}>
            {CHAT_MESSAGES.map((m, i) => (
              <div key={i} style={{ marginBottom: 8, padding: '4px 0', borderBottom: `1px solid ${BORDER}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: m.role === 'pro' ? AMBER : BLUE, fontWeight: 600, fontSize: 10 }}>{m.user}</span>
                  {m.role === 'pro' && <span style={{ padding: '0 4px', background: `${AMBER}20`, color: AMBER, fontSize: 7, borderRadius: 2, fontWeight: 700 }}>PRO</span>}
                  <span style={{ color: SUBTLE, fontSize: 9 }}>{m.time}</span>
                </div>
                <div style={{ color: TEXT, fontSize: 11, paddingLeft: 2 }}>{m.message}</div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: `1px solid ${BORDER}` }}>
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder={`Message #${channel}...`}
              style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '6px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO, outline: 'none' }}
            />
            <div style={{ padding: '6px 16px', background: AMBER, color: '#000', fontWeight: 700, fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>SEND</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Publish Tab ───────────────────────────────────────────── */
const PublishTab: React.FC = () => {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={S.panel}>
        <div style={S.panelHead}>PUBLISH TRADING IDEA</div>
        <div style={{ padding: 16 }}>
          {/* Symbol and Direction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>SYMBOL</label>
              <input placeholder="e.g. BTCUSD" style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>DIRECTION</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['LONG', 'SHORT'] as const).map(d => (
                  <div key={d} onClick={() => setDirection(d)} style={{ flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer', borderRadius: 2, fontSize: 11, fontWeight: 700, background: direction === d ? (d === 'LONG' ? `${GREEN}20` : `${RED}20`) : '#1a1a1a', color: direction === d ? (d === 'LONG' ? GREEN : RED) : SUBTLE, border: `1px solid ${direction === d ? (d === 'LONG' ? GREEN : RED) : BORDER}40` }}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>TIMEFRAME</label>
              <select style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO }}>
                <option>1H</option><option>4H</option><option>1D</option><option>1W</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>TITLE</label>
            <input placeholder="Your idea title..." style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 12, borderRadius: 2, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>ANALYSIS</label>
            <textarea placeholder="Describe your analysis, entry/exit levels, risk management..." rows={8} style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO, outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const }} />
          </div>

          {/* Levels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'ENTRY PRICE', placeholder: '0.00' },
              { label: 'STOP LOSS', placeholder: '0.00' },
              { label: 'TARGET 1', placeholder: '0.00' },
              { label: 'TARGET 2', placeholder: '0.00' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input placeholder={f.placeholder} style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
            ))}
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: SUBTLE, fontSize: 9, letterSpacing: 1, display: 'block', marginBottom: 4 }}>TAGS</label>
            <input placeholder="#bitcoin #breakout #technical" style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '8px 10px', fontSize: 11, borderRadius: 2, fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <div style={{ padding: '8px 20px', border: `1px solid ${BORDER}`, color: SUBTLE, borderRadius: 2, cursor: 'pointer', fontSize: 10 }}>SAVE DRAFT</div>
            <div style={{ padding: '8px 20px', background: AMBER, color: '#000', fontWeight: 700, borderRadius: 2, cursor: 'pointer', fontSize: 10 }}>PUBLISH IDEA</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Component ────────────────────────────────────────── */
const TABS = ['IDEAS', 'SENTIMENT', 'LEADERBOARD', 'CHAT', 'PUBLISH'] as const;
type Tab = typeof TABS[number];

export default function SocialUI2() {
  const [tab, setTab] = useState<Tab>('IDEAS');

  return (
    <div style={S.root}>
      <KPIStrip />
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={S.body}>
        {tab === 'IDEAS' && <IdeasFeedTab />}
        {tab === 'SENTIMENT' && <SentimentTab />}
        {tab === 'LEADERBOARD' && <LeaderboardTab />}
        {tab === 'CHAT' && <ChatTab />}
        {tab === 'PUBLISH' && <PublishTab />}
      </div>
    </div>
  );
}
