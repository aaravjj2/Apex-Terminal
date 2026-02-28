/**
 * SentimentPage.tsx
 * Social + news sentiment hub with Fear & Greed Index, Reddit/WallStreetBets analysis,
 * Twitter/X sentiment flow, news sentiment scanner, topic clustering,
 * trending tickers, and sentiment vs price divergence.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SentimentView = 'overview' | 'social' | 'news' | 'wsb' | 'trending' | 'divergence';

interface FearGreedData {
  score: number;           // 0-100
  label: string;
  prev_score: number;
  prev_label: string;
  week_ago: number;
  month_ago: number;
  components: Array<{ name: string; value: number; weight: number }>;
}

interface TickerSentiment {
  ticker: string;
  name: string;
  mentions_24h: number;
  mentions_7d: number;
  sentiment_score: number;   // -1 to +1
  sentiment_label: string;
  price_change_1d: number;
  call_put_ratio: number;
  trending: boolean;
  wsb_mentions: number;
  news_score: number;
}

interface NewsItem {
  headline: string;
  source: string;
  published: string;
  ticker?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  category: string;
  summary?: string;
}

interface WSBPost {
  title: string;
  ticker: string;
  score: number;
  comments: number;
  awards: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  flair: string;
  created: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const FEAR_GREED: FearGreedData = {
  score: 72,
  label: 'GREED',
  prev_score: 68,
  prev_label: 'GREED',
  week_ago: 65,
  month_ago: 48,
  components: [
    { name: 'Stock Price Momentum', value: 78, weight: 0.25 },
    { name: 'Stock Price Strength', value: 82, weight: 0.25 },
    { name: 'Stock Price Breadth', value: 69, weight: 0.125 },
    { name: 'Put/Call Ratio', value: 61, weight: 0.125 },
    { name: 'Market Volatility (VIX)', value: 74, weight: 0.125 },
    { name: 'Safe Haven Demand', value: 58, weight: 0.0625 },
    { name: 'Junk Bond Demand', value: 76, weight: 0.0625 },
  ],
};

const TICKER_SENTIMENTS: TickerSentiment[] = [
  { ticker: 'NVDA', name: 'NVIDIA', mentions_24h: 48200, mentions_7d: 312400, sentiment_score: 0.82, sentiment_label: 'VERY BULLISH', price_change_1d: 4.2, call_put_ratio: 3.4, trending: true, wsb_mentions: 2840, news_score: 0.74 },
  { ticker: 'TSLA', name: 'Tesla', mentions_24h: 38100, mentions_7d: 284600, sentiment_score: 0.18, sentiment_label: 'SLIGHTLY BULLISH', price_change_1d: -2.1, call_put_ratio: 1.8, trending: true, wsb_mentions: 4200, news_score: -0.12 },
  { ticker: 'AAPL', name: 'Apple', mentions_24h: 24600, mentions_7d: 184500, sentiment_score: 0.61, sentiment_label: 'BULLISH', price_change_1d: 1.4, call_put_ratio: 2.1, trending: false, wsb_mentions: 1240, news_score: 0.58 },
  { ticker: 'GME', name: 'GameStop', mentions_24h: 18400, mentions_7d: 124200, sentiment_score: 0.44, sentiment_label: 'NEUTRAL-BULLISH', price_change_1d: 8.7, call_put_ratio: 4.2, trending: true, wsb_mentions: 8400, news_score: 0.22 },
  { ticker: 'META', name: 'Meta', mentions_24h: 16200, mentions_7d: 98400, sentiment_score: 0.71, sentiment_label: 'BULLISH', price_change_1d: 2.8, call_put_ratio: 2.4, trending: true, wsb_mentions: 980, news_score: 0.66 },
  { ticker: 'AMZN', name: 'Amazon', mentions_24h: 13800, mentions_7d: 92100, sentiment_score: 0.54, sentiment_label: 'BULLISH', price_change_1d: 1.1, call_put_ratio: 1.9, trending: false, wsb_mentions: 760, news_score: 0.48 },
  { ticker: 'MSFT', name: 'Microsoft', mentions_24h: 11400, mentions_7d: 84200, sentiment_score: 0.68, sentiment_label: 'BULLISH', price_change_1d: 0.8, call_put_ratio: 2.2, trending: false, wsb_mentions: 540, news_score: 0.71 },
  { ticker: 'SPY', name: 'S&P 500 ETF', mentions_24h: 28400, mentions_7d: 198600, sentiment_score: 0.58, sentiment_label: 'BULLISH', price_change_1d: 0.4, call_put_ratio: 1.7, trending: false, wsb_mentions: 3200, news_score: 0.42 },
];

const NEWS_ITEMS: NewsItem[] = [
  { headline: 'Nvidia Reports Record Revenue, Beats Estimates by 20%', source: 'Bloomberg', published: '14:32', ticker: 'NVDA', sentiment: 'positive', score: 0.94, category: 'Earnings' },
  { headline: 'Fed Officials Signal Rate Cuts Could Begin in March', source: 'WSJ', published: '14:18', sentiment: 'positive', score: 0.76, category: 'Macro' },
  { headline: 'Tesla Cuts Prices Again in China Amid Price War', source: 'Reuters', published: '13:55', ticker: 'TSLA', sentiment: 'negative', score: -0.68, category: 'Corporate' },
  { headline: 'S&P 500 Reaches New All-Time High on Tech Rally', source: 'MarketWatch', published: '13:42', sentiment: 'positive', score: 0.82, category: 'Market' },
  { headline: 'China Manufacturing PMI Misses Expectations', source: 'FT', published: '13:28', sentiment: 'negative', score: -0.54, category: 'Macro' },
  { headline: 'Apple Faces Antitrust Investigation in EU Over App Store', source: 'Axios', published: '12:54', ticker: 'AAPL', sentiment: 'negative', score: -0.48, category: 'Regulatory' },
  { headline: 'Meta AI Investments Drive 25% Revenue Growth', source: 'Bloomberg', published: '12:31', ticker: 'META', sentiment: 'positive', score: 0.88, category: 'Earnings' },
  { headline: 'Oil Prices Fall on Demand Concerns', source: 'Reuters', published: '12:10', sentiment: 'negative', score: -0.42, category: 'Commodities' },
];

const WSB_POSTS: WSBPost[] = [
  { title: 'NVDA to $1000 by EOY - the AI revolution is just beginning', ticker: 'NVDA', score: 48200, comments: 2840, awards: 42, sentiment: 'bullish', flair: 'DD', created: '2h' },
  { title: 'I YOLO\'d everything into TSLA calls and now I\'m down 47%', ticker: 'TSLA', score: 28100, comments: 4210, awards: 28, sentiment: 'bearish', flair: 'Loss Porn', created: '4h' },
  { title: 'GME is a MOASS setup - short interest at 22%', ticker: 'GME', score: 22800, comments: 6840, awards: 68, sentiment: 'bullish', flair: 'Due Diligence', created: '5h' },
  { title: 'The AI bubble will pop in 2024 - here\'s why', ticker: 'QQQ', score: 18400, comments: 3420, awards: 18, sentiment: 'bearish', flair: 'Discussion', created: '6h' },
  { title: 'META just became my retirement fund', ticker: 'META', score: 14200, comments: 1840, awards: 22, sentiment: 'bullish', flair: 'Gain Porn', created: '8h' },
];

// ─── Fear & Greed Gauge ───────────────────────────────────────────────────────

const FearGreedGauge: React.FC<{ data: FearGreedData }> = ({ data }) => {
  const score = data.score;
  const radius = 70;
  const strokeW = 14;
  const cx = 110, cy = 110;

  // Color based on score
  const gaugeColor = score >= 75 ? '#ff4466' :
                     score >= 55 ? '#ff9900' :
                     score >= 45 ? '#ffcc00' :
                     score >= 25 ? '#4a9eff' : '#0066cc';

  const label = score >= 75 ? 'EXTREME GREED' :
                score >= 55 ? 'GREED' :
                score >= 45 ? 'NEUTRAL' :
                score >= 25 ? 'FEAR' : 'EXTREME FEAR';

  // Arc parameters (180° half-circle)
  const arcAngle = (score / 100) * 180;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = 180;
  const endAngle = 180 + arcAngle;

  function arcCoords(angle: number, r: number) {
    return {
      x: cx + r * Math.cos(toRad(angle)),
      y: cy + r * Math.sin(toRad(angle)),
    };
  }

  const start = arcCoords(startAngle, radius);
  const end = arcCoords(endAngle, radius);
  const largeArc = arcAngle > 180 ? 1 : 0;

  const needleAngle = 180 + arcAngle;
  const needleEnd = {
    x: cx + (radius - 6) * Math.cos(toRad(needleAngle)),
    y: cy + (radius - 6) * Math.sin(toRad(needleAngle)),
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <svg width={220} height={130} style={{ fontFamily: 'monospace' }}>
        {/* Background arc */}
        <path
          d={`M ${arcCoords(180, radius).x} ${arcCoords(180, radius).y} A ${radius} ${radius} 0 0 1 ${arcCoords(360, radius).x} ${arcCoords(360, radius).y}`}
          fill="none" stroke="#1a2a38" strokeWidth={strokeW} strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none" stroke={gaugeColor} strokeWidth={strokeW} strokeLinecap="round"
        />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#fff" />
        {/* Score */}
        <text x={cx} y={cy + 24} textAnchor="middle" fill={gaugeColor} fontSize={24} fontWeight="bold">{score}</text>
        <text x={cx} y={cy + 40} textAnchor="middle" fill={gaugeColor} fontSize={10} fontWeight="bold">{label}</text>
        {/* Labels */}
        {['FEAR', 'NEUTRAL', 'GREED'].map((l, i) => (
          <text key={i} x={40 + i * 70} y={117} textAnchor="middle" fill="#444" fontSize={7}>{l}</text>
        ))}
      </svg>

      {/* Components */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.components.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', width: 160 }}>{c.name}</span>
            <div style={{ width: 80, height: 6, background: '#0a1628', borderRadius: 2 }}>
              <div style={{
                width: `${c.value}%`, height: 6,
                background: c.value >= 60 ? '#ff9900' : c.value >= 40 ? '#ffcc00' : '#4a9eff',
                borderRadius: 2,
              }} />
            </div>
            <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace', width: 28 }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Historical comparison */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Previous', value: data.prev_score, change: data.score - data.prev_score },
          { label: '1 Week Ago', value: data.week_ago, change: data.score - data.week_ago },
          { label: '1 Month Ago', value: data.month_ago, change: data.score - data.month_ago },
        ].map((h, i) => (
          <div key={i}>
            <div style={{ color: '#555', fontSize: 8, fontFamily: 'monospace' }}>{h.label}</div>
            <div style={{ color: '#ccc', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {h.value}
              <span style={{ color: h.change > 0 ? '#ff9900' : '#4a9eff', fontSize: 9, marginLeft: 6 }}>
                {h.change > 0 ? '▲' : '▼'} {Math.abs(h.change)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Ticker Sentiment Row ─────────────────────────────────────────────────────

const TickerSentimentRow: React.FC<{ t: TickerSentiment }> = ({ t }) => {
  const sentColor = t.sentiment_score > 0.5 ? '#00d4aa' :
                    t.sentiment_score > 0.1 ? '#ffcc00' :
                    t.sentiment_score > -0.1 ? '#888' :
                    t.sentiment_score > -0.5 ? '#ff9900' : '#ff4466';
  const barW = Math.abs(t.sentiment_score) * 60;
  const priceColor = t.price_change_1d >= 0 ? '#00d4aa' : '#ff4466';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', background: '#0e1c2e', borderRadius: 4,
      borderLeft: t.trending ? '3px solid #4a9eff' : '3px solid transparent',
    }}>
      <div style={{ width: 50 }}>
        <div style={{ color: '#4a9eff', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' }}>{t.ticker}</div>
        {t.trending && <div style={{ color: '#4a9eff', fontSize: 7, fontFamily: 'monospace' }}>TRENDING</div>}
      </div>
      <div style={{ width: 80, color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{t.name}</div>
      <div style={{ width: 56, textAlign: 'right' }}>
        <div style={{ color: '#888', fontSize: 8, fontFamily: 'monospace' }}>24h mentions</div>
        <div style={{ color: '#ccc', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}>{(t.mentions_24h / 1000).toFixed(1)}K</div>
      </div>
      <div style={{ width: 70, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: barW, height: 6, background: sentColor, borderRadius: 2, opacity: 0.8 }} />
        <span style={{ color: sentColor, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }}>
          {t.sentiment_score > 0 ? '+' : ''}{t.sentiment_score.toFixed(2)}
        </span>
      </div>
      <div style={{ width: 80, color: sentColor, fontSize: 9, fontFamily: 'monospace' }}>{t.sentiment_label}</div>
      <div style={{ width: 50, textAlign: 'right', color: priceColor, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }}>
        {t.price_change_1d >= 0 ? '+' : ''}{t.price_change_1d.toFixed(2)}%
      </div>
      <div style={{ width: 40, textAlign: 'right', color: '#888', fontSize: 9, fontFamily: 'monospace' }}>
        C/P: {t.call_put_ratio.toFixed(1)}
      </div>
      <div style={{ width: 44, textAlign: 'right', color: '#666', fontSize: 9, fontFamily: 'monospace' }}>
        WSB: {(t.wsb_mentions / 1000).toFixed(1)}K
      </div>
    </div>
  );
};

// ─── News Sentiment Stream ────────────────────────────────────────────────────

const NewsSentimentStream: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {NEWS_ITEMS.map((n, i) => (
      <div key={i} style={{
        background: '#0e1c2e',
        borderLeft: `3px solid ${n.sentiment === 'positive' ? '#00d4aa' : n.sentiment === 'negative' ? '#ff4466' : '#888'}`,
        borderRadius: '0 4px 4px 0', padding: '8px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <div>
            {n.ticker && <span style={{ color: '#4a9eff', fontSize: 9, fontFamily: 'monospace', marginRight: 8 }}>{n.ticker}</span>}
            <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace', marginRight: 8 }}>{n.category}</span>
            <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{n.source} · {n.published}</span>
          </div>
          <span style={{
            color: n.sentiment === 'positive' ? '#00d4aa' : n.sentiment === 'negative' ? '#ff4466' : '#888',
            fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold',
          }}>
            {n.score > 0 ? '+' : ''}{n.score.toFixed(2)}
          </span>
        </div>
        <div style={{ color: '#ccc', fontSize: 11, fontFamily: 'monospace' }}>{n.headline}</div>
      </div>
    ))}
  </div>
);

// ─── WSB Panel ────────────────────────────────────────────────────────────────

const WSBPanel: React.FC = () => (
  <div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      {[
        { label: 'Total Posts (24h)', value: '4,284', color: '#4a9eff' },
        { label: 'Bullish Posts', value: '61%', color: '#00d4aa' },
        { label: 'Bearish Posts', value: '28%', color: '#ff4466' },
        { label: 'Active Users', value: '84,200', color: '#888' },
      ].map((item, i) => (
        <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '6px 12px' }}>
          <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
          <div style={{ color: item.color, fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {WSB_POSTS.map((p, i) => (
        <div key={i} style={{
          background: '#0e1c2e', borderRadius: 4, padding: '10px 14px',
          borderLeft: `3px solid ${p.sentiment === 'bullish' ? '#00d4aa' : p.sentiment === 'bearish' ? '#ff4466' : '#888'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#4a9eff', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }}>{p.ticker}</span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace',
                color: p.sentiment === 'bullish' ? '#00d4aa' : p.sentiment === 'bearish' ? '#ff4466' : '#888',
                background: '#1a2a38', padding: '1px 5px', borderRadius: 2,
              }}>{p.flair}</span>
              <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{p.created} ago</span>
            </div>
            <div style={{ display: 'flex', gap: 12, color: '#666', fontSize: 9, fontFamily: 'monospace' }}>
              <span>▲ {(p.score / 1000).toFixed(1)}K</span>
              <span>💬 {(p.comments / 1000).toFixed(1)}K</span>
              <span>🏆 {p.awards}</span>
            </div>
          </div>
          <div style={{ color: '#bbb', fontSize: 11, fontFamily: 'monospace' }}>{p.title}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEW_TABS: Array<{ id: SentimentView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'social', label: 'Social Sentiment' },
  { id: 'news', label: 'News Stream' },
  { id: 'wsb', label: 'WSB / Reddit' },
  { id: 'trending', label: 'Trending' },
  { id: 'divergence', label: 'Price Divergence' },
];

export const SentimentPage: React.FC = () => {
  const [view, setView] = useState<SentimentView>('overview');

  const renderView = () => {
    switch (view) {
      case 'overview': return (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>FEAR & GREED INDEX</h3>
            <FearGreedGauge data={FEAR_GREED} />
          </div>
          <div>
            <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 8 }}>TOP MENTIONED TICKERS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TICKER_SENTIMENTS.slice(0, 5).map(t => <TickerSentimentRow key={t.ticker} t={t} />)}
            </div>
          </div>
        </div>
      );
      case 'social': return (
        <div>
          <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>SOCIAL SENTIMENT LEADERBOARD</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TICKER_SENTIMENTS.map(t => <TickerSentimentRow key={t.ticker} t={t} />)}
          </div>
        </div>
      );
      case 'news': return (
        <div>
          <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>NEWS SENTIMENT STREAM</h3>
          <NewsSentimentStream />
        </div>
      );
      case 'wsb': return (
        <div>
          <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>WALLSTREETBETS</h3>
          <WSBPanel />
        </div>
      );
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {view}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      <div style={{
        height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38',
        display: 'flex', alignItems: 'center', padding: '0 16px',
      }}>
        <span style={{ color: '#ff9900', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>SENTIMENT DASHBOARD</span>
      </div>
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: view === t.id ? '2px solid #ff9900' : '2px solid transparent',
            color: view === t.id ? '#ff9900' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderView()}
      </div>
    </div>
  );
};

export default SentimentPage;
