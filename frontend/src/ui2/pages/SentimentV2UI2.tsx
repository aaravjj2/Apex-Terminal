/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Sentiment Analysis V2 (UI2)                        │
 * │  Multi-source NLP sentiment: news, social, earnings calls,          │
 * │  SEC filings, Reddit/Twitter, analyst estimates                     │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Data Types ──────────────────────────────────────────────────────── */
interface SentimentItem {
  ticker: string;
  source: string;
  score: number; // -1 to 1
  magnitude: number;
  headline: string;
  time: string;
  category: string;
}

interface TickerSentiment {
  ticker: string;
  name: string;
  overallScore: number;
  news: number;
  social: number;
  analyst: number;
  insider: number;
  technical: number;
  momentum: number;
  articles: number;
  socialMentions: number;
  trend: 'improving' | 'declining' | 'stable';
}

/* ── Mock Generators ─────────────────────────────────────────────────── */
const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'AMD', 'NFLX', 'COIN', 'PLTR', 'ARM', 'SMCI', 'SPY', 'QQQ'];
const SOURCES = ['Reuters', 'Bloomberg', 'CNBC', 'MarketWatch', 'WSJ', 'Barron\'s', 'SeekingAlpha', 'Reddit/WSB', 'Twitter/X', 'StockTwits', 'SEC Filing', 'Earnings Call'];
const CATEGORIES = ['earnings', 'guidance', 'product', 'regulatory', 'macro', 'insider', 'analyst', 'social'];

const HEADLINES = [
  'beats Q4 estimates, raises guidance for FY2025',
  'announces $10B share buyback program',
  'faces antitrust probe in EU over market dominance',
  'CEO sells $50M in shares amid insider trading investigation',
  'launches revolutionary AI product, stock surges 8%',
  'misses revenue expectations, guides below consensus',
  'receives FDA approval for breakthrough therapy',
  'partners with leading cloud provider for enterprise AI',
  'analysts upgrade to Strong Buy citing accelerating growth',
  'faces class action lawsuit over data privacy concerns',
  'reports record quarterly revenue, margins expand',
  'supply chain disruptions expected to impact Q1 margins',
  'short interest surges 40% as bears pile in',
  'insiders bought $25M in open market purchases',
  'options flow shows massive call buying ahead of earnings',
  'named to S&P 500 index, effective next month',
  'cutting 15% of workforce in restructuring plan',
  'new product launch receives mixed reviews from analysts',
  'credit downgrade warning from Moody\'s on leverage concerns',
  'activist investor takes 5% stake, pushes for board seats',
];

function generateSentimentFeed(): SentimentItem[] {
  return Array.from({ length: 100 }, (_, i) => {
    const score = (Math.random() - 0.45) * 2; // slightly bullish bias
    return {
      ticker: TICKERS[Math.floor(Math.random() * TICKERS.length)],
      source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
      score: Math.max(-1, Math.min(1, score)),
      magnitude: 0.3 + Math.random() * 0.7,
      headline: `${TICKERS[Math.floor(Math.random() * TICKERS.length)]} ${HEADLINES[Math.floor(Math.random() * HEADLINES.length)]}`,
      time: `${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    };
  });
}

function generateTickerSentiments(): TickerSentiment[] {
  return TICKERS.map(t => ({
    ticker: t,
    name: { AAPL: 'Apple', MSFT: 'Microsoft', NVDA: 'NVIDIA', TSLA: 'Tesla', META: 'Meta', AMZN: 'Amazon', GOOGL: 'Alphabet', AMD: 'AMD', NFLX: 'Netflix', COIN: 'Coinbase', PLTR: 'Palantir', ARM: 'Arm Holdings', SMCI: 'Super Micro', SPY: 'S&P 500 ETF', QQQ: 'NASDAQ 100 ETF' }[t] || t,
    overallScore: (Math.random() - 0.4) * 2,
    news: (Math.random() - 0.4) * 2,
    social: (Math.random() - 0.45) * 2,
    analyst: (Math.random() - 0.3) * 2,
    insider: (Math.random() - 0.5) * 2,
    technical: (Math.random() - 0.4) * 2,
    momentum: (Math.random() - 0.5) * 200,
    articles: Math.floor(Math.random() * 80) + 5,
    socialMentions: Math.floor(Math.random() * 5000) + 100,
    trend: (['improving', 'declining', 'stable'] as const)[Math.floor(Math.random() * 3)],
  })).sort((a, b) => b.overallScore - a.overallScore);
}

/* ── Canvas Components ───────────────────────────────────────────────── */
function SentimentGaugeCanvas({ score }: { score: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const S = 80;
    c.width = S * 2; c.height = (S / 2 + 15) * 2; ctx.scale(2, 2);
    const cx = S / 2; const cy = S / 2;
    const r = S / 2 - 8;

    // Background arc
    ctx.strokeStyle = T.bg3; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.stroke();

    // Colored arc
    const norm = (score + 1) / 2; // 0..1
    const angle = Math.PI + norm * Math.PI;
    const gradient = ctx.createLinearGradient(0, cy, S, cy);
    gradient.addColorStop(0, T.dn); gradient.addColorStop(0.5, T.warn); gradient.addColorStop(1, T.up);
    ctx.strokeStyle = gradient; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, angle); ctx.stroke();

    // Needle
    ctx.strokeStyle = T.tx0; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4));
    ctx.stroke();

    // Value
    ctx.fillStyle = score > 0.2 ? T.up : score < -0.2 ? T.dn : T.warn;
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${score > 0 ? '+' : ''}${(score * 100).toFixed(0)}`, cx, cy + 14);
  }, [score]);
  return <canvas ref={ref} style={{ width: 80, height: 55 }} />;
}

function SentimentTimelineCanvas({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 120;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    // Zero line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);

    // Area fill
    const step = W / (data.length - 1);
    ctx.beginPath(); ctx.moveTo(0, H / 2);
    data.forEach((d, i) => {
      const x = i * step; const y = H / 2 - (d * H / 2 * 0.8);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H / 2); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `${T.up}40`); grad.addColorStop(0.5, 'transparent'); grad.addColorStop(1, `${T.dn}40`);
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = i * step; const y = H / 2 - (d * H / 2 * 0.8);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Labels
    ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ['30d ago', '20d ago', '10d ago', 'Today'].forEach((l, i) => {
      ctx.fillText(l, (i / 3) * W, H - 3);
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 120, borderRadius: T.r }} />;
}

function SentimentBar({ score, width = 60 }: { score: number; width?: number }) {
  const norm = (score + 1) / 2;
  const color = score > 0.2 ? T.up : score < -0.2 ? T.dn : T.warn;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width, height: 6, background: T.bg3, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, width: `${Math.abs(norm - 0.5) * 100}%`, height: '100%', background: color, borderRadius: 3, transform: score < 0 ? 'translateX(-100%)' : 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 8, background: T.tx3 }} />
      </div>
      <span style={{ fontSize: '8px', fontFamily: T.mono, color, fontWeight: 600, minWidth: '25px', textAlign: 'right' }}>
        {score > 0 ? '+' : ''}{(score * 100).toFixed(0)}
      </span>
    </div>
  );
}

/* ── Panels ───────────────────────────────────────────────────────────── */
function OverviewPanel({ sentiments }: { sentiments: TickerSentiment[] }) {
  const timeline = useMemo(() => Array.from({ length: 30 }, (_, i) => Math.sin(i * 0.3) * 0.4 + (Math.random() - 0.4) * 0.3), []);
  const avgScore = sentiments.reduce((s, t) => s + t.overallScore, 0) / sentiments.length;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: T.tx3, marginBottom: '4px' }}>Market Sentiment</div>
          <SentimentGaugeCanvas score={avgScore} />
          <div style={{ fontSize: '8px', color: T.tx2, marginTop: '2px' }}>{avgScore > 0.15 ? 'BULLISH' : avgScore < -0.15 ? 'BEARISH' : 'NEUTRAL'}</div>
        </div>
        {[
          { label: 'News Sentiment', val: sentiments.reduce((s, t) => s + t.news, 0) / sentiments.length },
          { label: 'Social Sentiment', val: sentiments.reduce((s, t) => s + t.social, 0) / sentiments.length },
          { label: 'Analyst Outlook', val: sentiments.reduce((s, t) => s + t.analyst, 0) / sentiments.length },
        ].map(m => (
          <div key={m.label} style={{ flex: '1 1 120px', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: T.tx3, marginBottom: '4px' }}>{m.label}</div>
            <SentimentGaugeCanvas score={m.val} />
          </div>
        ))}
      </div>
      <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>30-Day Sentiment Timeline</div>
        <SentimentTimelineCanvas data={timeline} />
      </div>
    </div>
  );
}

function RankingPanel({ sentiments }: { sentiments: TickerSentiment[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Sentiment Rankings</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['#', 'Ticker', 'Name', 'Overall', 'News', 'Social', 'Analyst', 'Insider', 'Momentum', 'Trend', 'Articles', 'Mentions'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: h === 'Name' || h === 'Ticker' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sentiments.map((s, i) => (
            <tr key={s.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right' }}>{i + 1}</td>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 700, textAlign: 'left' }}>{s.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'left', fontSize: '7px' }}>{s.name}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SentimentBar score={s.overallScore} /></td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SentimentBar score={s.news} width={40} /></td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SentimentBar score={s.social} width={40} /></td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SentimentBar score={s.analyst} width={40} /></td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SentimentBar score={s.insider} width={40} /></td>
              <td style={{ padding: '3px 4px', color: s.momentum > 0 ? T.up : T.dn, textAlign: 'right' }}>{s.momentum > 0 ? '+' : ''}{s.momentum.toFixed(0)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: s.trend === 'improving' ? `${T.up}20` : s.trend === 'declining' ? `${T.dn}20` : `${T.tx3}20`, color: s.trend === 'improving' ? T.up : s.trend === 'declining' ? T.dn : T.tx2 }}>
                  {s.trend === 'improving' ? '↗' : s.trend === 'declining' ? '↘' : '→'}
                </span>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{s.articles}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{s.socialMentions.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedPanel({ feed }: { feed: SentimentItem[] }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? feed : feed.filter(f => f.category === filter);

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>Live Sentiment Feed</span>
        <div style={{ flex: 1 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 4px', fontSize: '8px', fontFamily: T.mono }}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ maxHeight: '500px', overflow: 'auto' }}>
        {filtered.slice(0, 50).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ minWidth: '35px', textAlign: 'center', padding: '2px 4px', borderRadius: '2px', fontSize: '8px', fontWeight: 700, background: item.score > 0.2 ? `${T.up}20` : item.score < -0.2 ? `${T.dn}20` : `${T.warn}20`, color: item.score > 0.2 ? T.up : item.score < -0.2 ? T.dn : T.warn, fontFamily: T.mono }}>
              {item.score > 0 ? '+' : ''}{(item.score * 100).toFixed(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '8px', color: T.tx1, lineHeight: 1.3 }}>{item.headline}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px', fontSize: '7px' }}>
                <span style={{ color: T.brand }}>{item.ticker}</span>
                <span style={{ color: T.tx3 }}>{item.source}</span>
                <span style={{ color: T.tx3 }}>{item.time}</span>
                <span style={{ padding: '0 3px', borderRadius: '2px', background: `${T.border2}`, color: T.tx2 }}>{item.category}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} style={{ width: 3, height: 3 + j * 2, background: j / 5 < item.magnitude ? (item.score > 0 ? T.up : T.dn) : T.bg3, borderRadius: 1 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordCloudPanel() {
  const words = [
    { text: 'AI', size: 28, sentiment: 0.8 }, { text: 'earnings', size: 22, sentiment: 0.3 },
    { text: 'guidance', size: 20, sentiment: 0.5 }, { text: 'revenue', size: 18, sentiment: 0.4 },
    { text: 'buyback', size: 17, sentiment: 0.6 }, { text: 'growth', size: 24, sentiment: 0.7 },
    { text: 'margin', size: 16, sentiment: 0.2 }, { text: 'lawsuit', size: 15, sentiment: -0.7 },
    { text: 'upgrade', size: 19, sentiment: 0.8 }, { text: 'downgrade', size: 14, sentiment: -0.8 },
    { text: 'dividend', size: 13, sentiment: 0.5 }, { text: 'layoffs', size: 16, sentiment: -0.6 },
    { text: 'IPO', size: 14, sentiment: 0.3 }, { text: 'merger', size: 15, sentiment: 0.4 },
    { text: 'tariff', size: 18, sentiment: -0.5 }, { text: 'innovation', size: 21, sentiment: 0.9 },
    { text: 'recession', size: 17, sentiment: -0.9 }, { text: 'rally', size: 16, sentiment: 0.7 },
    { text: 'inflation', size: 19, sentiment: -0.4 }, { text: 'semiconductor', size: 20, sentiment: 0.6 },
    { text: 'cloud', size: 17, sentiment: 0.5 }, { text: 'data center', size: 18, sentiment: 0.7 },
    { text: 'short squeeze', size: 15, sentiment: 0.4 }, { text: 'bankruptcy', size: 13, sentiment: -0.95 },
  ];

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Trending Topics</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', padding: '10px' }}>
        {words.map(w => (
          <span key={w.text} style={{
            fontSize: `${w.size * 0.5}px`, fontWeight: w.size > 18 ? 700 : 400,
            color: w.sentiment > 0.3 ? T.up : w.sentiment < -0.3 ? T.dn : T.warn,
            opacity: 0.5 + Math.abs(w.sentiment) * 0.5,
            cursor: 'pointer', padding: '1px 3px',
          }}>{w.text}</span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type SentTab = 'overview' | 'rankings' | 'feed' | 'wordcloud';

export default function SentimentV2UI2() {
  const [tab, setTab] = useState<SentTab>('overview');
  const sentiments = useMemo(() => generateTickerSentiments(), []);
  const feed = useMemo(() => generateSentimentFeed(), []);

  return (
    <div data-testid="sentiment-v2-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SENTIMENT ENGINE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <div style={{ display: 'flex', gap: '6px', fontSize: '8px', fontFamily: T.mono }}>
          <span style={{ color: T.tx3 }}>Sources: <span style={{ color: T.info }}>12</span></span>
          <span style={{ color: T.tx3 }}>Tickers: <span style={{ color: T.tx0 }}>{sentiments.length}</span></span>
          <span style={{ color: T.tx3 }}>Signals: <span style={{ color: T.up }}>{feed.length}</span></span>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'overview' as SentTab, label: '🌡️ Overview' },
          { key: 'rankings' as SentTab, label: '📊 Rankings' },
          { key: 'feed' as SentTab, label: '📰 Live Feed' },
          { key: 'wordcloud' as SentTab, label: '☁️ Topics' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'overview' && <OverviewPanel sentiments={sentiments} />}
        {tab === 'rankings' && <RankingPanel sentiments={sentiments} />}
        {tab === 'feed' && <FeedPanel feed={feed} />}
        {tab === 'wordcloud' && <WordCloudPanel />}
      </div>
    </div>
  );
}

export { SentimentV2UI2 };
