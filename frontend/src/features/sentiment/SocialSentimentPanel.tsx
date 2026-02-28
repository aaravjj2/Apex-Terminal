/**
 * SocialSentimentPanel.tsx
 * Bloomberg-style Social Sentiment & News Sentiment Analysis Panel.
 * Displays aggregate sentiment, mention spikes, trending symbols, WSB analysis, and controversy alerts.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  compound: number;
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  confidence: number;
}

interface MentionVolume {
  symbol: string;
  mentions_total: number;
  mentions_change_pct: number;
  sentiment_score: number;
  velocity: number;
  sources: Record<string, number>;
}

interface SentimentSpike {
  symbol: string;
  spike_magnitude: number;
  baseline_mentions: number;
  spike_mentions: number;
  sentiment_direction: 'bullish' | 'bearish';
  detected_at: string;
}

interface WSBAnalysis {
  symbol: string;
  dd_count: number;
  yolo_count: number;
  rocket_count: number;
  bear_count: number;
  net_sentiment: number;
  squeeze_probability: number;
  apes_together_strong: boolean;
}

interface ControversyAlert {
  symbol: string;
  controversy_score: number;
  debate_intensity: number;
  bull_bear_ratio: number;
  trending: boolean;
}

interface SentimentMomentum {
  symbol: string;
  short_term_sentiment: number;
  medium_term_sentiment: number;
  momentum: number;
  reversal_signal: boolean;
}

interface SentimentPost {
  id: string;
  symbol: string;
  source: string;
  text: string;
  sentiment: SentimentScore;
  timestamp: string;
  likes?: number;
  replies?: number;
}

interface SentimentDashboard {
  top_bullish: MentionVolume[];
  top_bearish: MentionVolume[];
  spikes: SentimentSpike[];
  wsb_picks: WSBAnalysis[];
  controversy: ControversyAlert[];
  momentum: SentimentMomentum[];
  trending: string[];
  overall_market_sentiment: SentimentScore;
  fear_greed_index: number;
  posts_feed: SentimentPost[];
  timestamp: string;
}

// ─── Mock Data Factory ────────────────────────────────────────────────────────

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'GME', 'AMC', 'PLTR', 'MSTR', 'COIN', 'SPCE'];
const SOURCES = ['reddit', 'twitter', 'stocktwits', 'discord', 'telegram'];
const SAMPLE_POSTS = [
  "NVDA absolutely printing, AI supercycle just beginning 🚀🚀🚀",
  "TSLA breaking down below key support. Bears loading up.",
  "GME squeeze incoming?? Short interest back to 20%",
  "AAPL earnings beat, long term bull thesis intact",
  "COIN following BTC, crypto sentiment flipping",
  "MSTR is literally a leveraged BTC play at this point hedge accordingly",
  "AMD vs NVDA in datacenter — AMD lagging big",
  "PLTR contract wins keep piling up, still love this name",
  "SPCE cash burn is insane, avoid",
  "Market breadth deteriorating, caution warranted here",
];

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function generateSentiment(bias: 'bull' | 'bear' | 'neutral' = 'neutral'): SentimentScore {
  let pos: number, neg: number;
  if (bias === 'bull') { pos = randomBetween(0.5, 0.85); neg = randomBetween(0.02, 0.15); }
  else if (bias === 'bear') { pos = randomBetween(0.02, 0.20); neg = randomBetween(0.5, 0.80); }
  else { pos = randomBetween(0.2, 0.5); neg = randomBetween(0.2, 0.5); }
  const neutral = 1 - pos - neg;
  const compound = pos - neg;
  const label: SentimentScore['label'] = compound > 0.15 ? 'BULLISH' : compound < -0.15 ? 'BEARISH' :
    Math.abs(pos - neg) < 0.1 ? 'NEUTRAL' : 'MIXED';
  return { positive: pos, negative: neg, neutral: Math.max(0, neutral), compound, label, confidence: randomBetween(0.6, 0.95) };
}

function generateMockDashboard(): SentimentDashboard {
  const top_bullish: MentionVolume[] = SYMBOLS.slice(0, 5).map(s => ({
    symbol: s,
    mentions_total: Math.floor(randomBetween(500, 5000)),
    mentions_change_pct: randomBetween(10, 300),
    sentiment_score: randomBetween(0.3, 0.9),
    velocity: randomBetween(0.5, 3.0),
    sources: { reddit: Math.floor(randomBetween(100, 1000)), twitter: Math.floor(randomBetween(200, 2000)), stocktwits: Math.floor(randomBetween(50, 500)) },
  }));

  const top_bearish: MentionVolume[] = SYMBOLS.slice(5).map(s => ({
    symbol: s,
    mentions_total: Math.floor(randomBetween(200, 2000)),
    mentions_change_pct: randomBetween(5, 150),
    sentiment_score: randomBetween(-0.9, -0.2),
    velocity: randomBetween(-2.0, -0.2),
    sources: { reddit: Math.floor(randomBetween(50, 500)), twitter: Math.floor(randomBetween(100, 1000)), stocktwits: Math.floor(randomBetween(20, 200)) },
  }));

  const spikes: SentimentSpike[] = [
    { symbol: 'NVDA', spike_magnitude: 4.8, baseline_mentions: 800, spike_mentions: 3840, sentiment_direction: 'bullish', detected_at: new Date().toISOString() },
    { symbol: 'GME', spike_magnitude: 7.2, baseline_mentions: 200, spike_mentions: 1440, sentiment_direction: 'bullish', detected_at: new Date().toISOString() },
    { symbol: 'TSLA', spike_magnitude: 3.1, baseline_mentions: 1200, spike_mentions: 3720, sentiment_direction: 'bearish', detected_at: new Date().toISOString() },
  ];

  const wsb_picks: WSBAnalysis[] = [
    { symbol: 'GME', dd_count: 145, yolo_count: 89, rocket_count: 412, bear_count: 23, net_sentiment: 0.78, squeeze_probability: 0.65, apes_together_strong: true },
    { symbol: 'NVDA', dd_count: 223, yolo_count: 156, rocket_count: 890, bear_count: 45, net_sentiment: 0.85, squeeze_probability: 0.12, apes_together_strong: false },
    { symbol: 'AMC', dd_count: 78, yolo_count: 34, rocket_count: 156, bear_count: 89, net_sentiment: 0.22, squeeze_probability: 0.45, apes_together_strong: false },
  ];

  const controversy: ControversyAlert[] = [
    { symbol: 'TSLA', controversy_score: 0.82, debate_intensity: 0.91, bull_bear_ratio: 0.45, trending: true },
    { symbol: 'GME', controversy_score: 0.74, debate_intensity: 0.85, bull_bear_ratio: 3.2, trending: true },
    { symbol: 'COIN', controversy_score: 0.61, debate_intensity: 0.72, bull_bear_ratio: 1.1, trending: false },
  ];

  const momentum: SentimentMomentum[] = SYMBOLS.slice(0, 6).map(s => ({
    symbol: s,
    short_term_sentiment: randomBetween(-1, 1),
    medium_term_sentiment: randomBetween(-1, 1),
    momentum: randomBetween(-0.5, 0.5),
    reversal_signal: Math.random() > 0.75,
  }));

  const posts_feed: SentimentPost[] = SAMPLE_POSTS.map((text, i) => ({
    id: `post_${i}`,
    symbol: SYMBOLS[i % SYMBOLS.length],
    source: SOURCES[i % SOURCES.length],
    text,
    sentiment: generateSentiment(i % 3 === 0 ? 'bull' : i % 3 === 1 ? 'bear' : 'neutral'),
    timestamp: new Date(Date.now() - i * 180000).toISOString(),
    likes: Math.floor(randomBetween(0, 500)),
    replies: Math.floor(randomBetween(0, 100)),
  }));

  return {
    top_bullish,
    top_bearish,
    spikes,
    wsb_picks,
    controversy,
    momentum,
    trending: ['AI', 'NVDA', 'BTC', 'earnings', 'recession', 'fed'],
    overall_market_sentiment: generateSentiment('neutral'),
    fear_greed_index: Math.floor(randomBetween(20, 80)),
    posts_feed,
    timestamp: new Date().toISOString(),
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface FearGreedGaugeProps {
  value: number; // 0-100
}

const FEAR_GREED_LABELS = [
  { max: 20, label: 'Extreme Fear', color: '#cc0000' },
  { max: 40, label: 'Fear', color: '#ff4444' },
  { max: 60, label: 'Neutral', color: '#ffcc00' },
  { max: 80, label: 'Greed', color: '#88cc44' },
  { max: 100, label: 'Extreme Greed', color: '#00d4aa' },
];

const FearGreedGauge: React.FC<FearGreedGaugeProps> = ({ value }) => {
  const zone = FEAR_GREED_LABELS.find(z => value <= z.max) || FEAR_GREED_LABELS[4];
  const angle = -180 + (value / 100) * 180;

  return (
    <div className="fear-greed-gauge">
      <svg viewBox="-70 -60 140 80" width="200" height="120">
        {/* Gradient arc segments */}
        {FEAR_GREED_LABELS.map((zone, i) => {
          const startAngle = -180 + (i > 0 ? FEAR_GREED_LABELS[i - 1].max : 0) / 100 * 180;
          const endAngle = -180 + zone.max / 100 * 180;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const r = 55;
          const x1 = Math.cos(startRad) * r;
          const y1 = Math.sin(startRad) * r;
          const x2 = Math.cos(endRad) * r;
          const y2 = Math.sin(endRad) * r;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={zone.color}
              strokeWidth="9"
              strokeLinecap="butt"
              opacity="0.7"
            />
          );
        })}
        {/* Needle */}
        <line
          x1="0" y1="0"
          x2={Math.cos((angle * Math.PI) / 180) * 48}
          y2={Math.sin((angle * Math.PI) / 180) * 48}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="0" cy="0" r="4" fill="#1a2332" stroke="white" strokeWidth="1.5" />
        <text x="0" y="18" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{value}</text>
        <text x="0" y="30" textAnchor="middle" fill={zone.color} fontSize="9">{zone.label}</text>
      </svg>
    </div>
  );
};

interface SentimentBarProps {
  sentiment: SentimentScore;
  compact?: boolean;
}

const SentimentBar: React.FC<SentimentBarProps> = ({ sentiment, compact = false }) => {
  const labelColor = sentiment.label === 'BULLISH' ? '#00d4aa' : sentiment.label === 'BEARISH' ? '#ff4444' : '#ffcc00';
  if (compact) {
    return (
      <div className="sentiment-bar-compact">
        <span className="sentiment-label" style={{ color: labelColor }}>{sentiment.label}</span>
        <div className="sentiment-mini">
          <div style={{ width: `${sentiment.positive * 100}%`, backgroundColor: '#00d4aa55', height: 4 }} />
          <div style={{ width: `${sentiment.negative * 100}%`, backgroundColor: '#ff444455', height: 4 }} />
        </div>
        <span className="sentiment-compound" style={{ color: labelColor }}>
          {sentiment.compound > 0 ? '+' : ''}{(sentiment.compound * 100).toFixed(0)}
        </span>
      </div>
    );
  }
  return (
    <div className="sentiment-bar-full">
      <div className="sentiment-bar-track">
        <div className="segment-bull" style={{ width: `${sentiment.positive * 100}%` }}>
          <span>Bull {(sentiment.positive * 100).toFixed(0)}%</span>
        </div>
        <div className="segment-neutral" style={{ width: `${sentiment.neutral * 100}%` }} />
        <div className="segment-bear" style={{ width: `${sentiment.negative * 100}%` }}>
          <span>Bear {(sentiment.negative * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

interface SpikeAlertListProps {
  spikes: SentimentSpike[];
}

const SpikeAlertList: React.FC<SpikeAlertListProps> = ({ spikes }) => (
  <div className="spike-alert-list">
    {spikes.map(spike => {
      const color = spike.sentiment_direction === 'bullish' ? '#00d4aa' : '#ff4444';
      return (
        <div key={spike.symbol} className="spike-alert" style={{ borderLeftColor: color }}>
          <div className="spike-alert__symbol" style={{ color }}>{spike.symbol}</div>
          <div className="spike-alert__magnitude">
            {spike.spike_magnitude.toFixed(1)}x spike
          </div>
          <div className="spike-alert__mentions">
            {spike.baseline_mentions.toLocaleString()} → {spike.spike_mentions.toLocaleString()} mentions
          </div>
          <div className="spike-alert__direction" style={{ color }}>
            {spike.sentiment_direction === 'bullish' ? '▲ BULLISH' : '▼ BEARISH'}
          </div>
        </div>
      );
    })}
  </div>
);

interface WSBGridProps {
  picks: WSBAnalysis[];
}

const WSBGrid: React.FC<WSBGridProps> = ({ picks }) => (
  <div className="wsb-grid">
    {picks.map(p => (
      <div key={p.symbol} className={`wsb-card${p.apes_together_strong ? ' wsb-card--apes' : ''}`}>
        <div className="wsb-card__header">
          <span className="wsb-card__symbol">{p.symbol}</span>
          {p.apes_together_strong && <span className="wsb-badge">🦍 APES</span>}
          {p.squeeze_probability > 0.5 && <span className="wsb-badge wsb-badge--squeeze">⚡ SQUEEZE</span>}
        </div>
        <div className="wsb-card__emojis">
          <span title="DD posts">📝 {p.dd_count}</span>
          <span title="YOLO posts">💎 {p.yolo_count}</span>
          <span title="Rockets">🚀 {p.rocket_count}</span>
          <span title="Bears">🐻 {p.bear_count}</span>
        </div>
        <div className="wsb-card__sentiment">
          <div className="wsb-net" style={{ color: p.net_sentiment > 0.5 ? '#00d4aa' : p.net_sentiment > 0.2 ? '#ffcc00' : '#ff4444' }}>
            Net: {(p.net_sentiment * 100).toFixed(0)}%
          </div>
          <div className="wsb-squeeze">
            Squeeze Prob: {(p.squeeze_probability * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    ))}
  </div>
);

interface MomentumTableProps {
  momentum: SentimentMomentum[];
}

const MomentumTable: React.FC<MomentumTableProps> = ({ momentum }) => (
  <table className="sentiment-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Short-Term</th>
        <th>Medium-Term</th>
        <th>Momentum</th>
        <th>Signal</th>
      </tr>
    </thead>
    <tbody>
      {momentum.map(m => {
        const stColor = m.short_term_sentiment > 0.2 ? '#00d4aa' : m.short_term_sentiment < -0.2 ? '#ff4444' : '#ffcc00';
        const mtColor = m.medium_term_sentiment > 0.2 ? '#00d4aa' : m.medium_term_sentiment < -0.2 ? '#ff4444' : '#ffcc00';
        const momColor = m.momentum > 0.1 ? '#00d4aa' : m.momentum < -0.1 ? '#ff4444' : '#ffcc00';
        return (
          <tr key={m.symbol} className="sentiment-row">
            <td className="symbol-cell">{m.symbol}</td>
            <td style={{ color: stColor }}>{m.short_term_sentiment > 0 ? '+' : ''}{(m.short_term_sentiment * 100).toFixed(1)}</td>
            <td style={{ color: mtColor }}>{m.medium_term_sentiment > 0 ? '+' : ''}{(m.medium_term_sentiment * 100).toFixed(1)}</td>
            <td style={{ color: momColor }}>{m.momentum > 0 ? '▲' : '▼'}{Math.abs(m.momentum * 100).toFixed(1)}</td>
            <td>
              {m.reversal_signal && (
                <span className="reversal-signal">⚠ REVERSAL</span>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

interface PostFeedProps {
  posts: SentimentPost[];
}

const PostFeed: React.FC<PostFeedProps> = ({ posts }) => (
  <div className="post-feed">
    {posts.map(post => {
      const sentColor = post.sentiment.label === 'BULLISH' ? '#00d4aa' : post.sentiment.label === 'BEARISH' ? '#ff4444' : '#ffcc00';
      const timeAgo = Math.round((Date.now() - new Date(post.timestamp).getTime()) / 60000);
      return (
        <div key={post.id} className="post-card" style={{ borderLeftColor: `${sentColor}55` }}>
          <div className="post-card__header">
            <span className="post-symbol" style={{ color: sentColor }}>{post.symbol}</span>
            <span className="post-source">{post.source}</span>
            <span className="post-time">{timeAgo}m ago</span>
            <span className="post-sentiment" style={{ color: sentColor }}>{post.sentiment.label}</span>
          </div>
          <div className="post-text">{post.text}</div>
          {(post.likes !== undefined || post.replies !== undefined) && (
            <div className="post-stats">
              {post.likes !== undefined && <span>♥ {post.likes}</span>}
              {post.replies !== undefined && <span>💬 {post.replies}</span>}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

interface MentionVolumeBarProps {
  volume: MentionVolume;
  maxMentions: number;
}

const MentionVolumeBar: React.FC<MentionVolumeBarProps> = ({ volume, maxMentions }) => {
  const pct = Math.min((volume.mentions_total / maxMentions) * 100, 100);
  const color = volume.sentiment_score > 0.2 ? '#00d4aa' : volume.sentiment_score < -0.2 ? '#ff4444' : '#ffcc00';
  const changeColor = volume.mentions_change_pct > 0 ? '#00d4aa' : '#ff4444';
  return (
    <div className="mention-bar-row">
      <div className="mention-bar-symbol" style={{ color }}>{volume.symbol}</div>
      <div className="mention-bar-track">
        <div className="mention-bar-fill" style={{ width: `${pct}%`, backgroundColor: `${color}55` }} />
      </div>
      <div className="mention-bar-total">{volume.mentions_total.toLocaleString()}</div>
      <div className="mention-bar-change" style={{ color: changeColor }}>
        {volume.mentions_change_pct > 0 ? '+' : ''}{volume.mentions_change_pct.toFixed(1)}%
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface SocialSentimentPanelProps {
  className?: string;
  onRefresh?: () => Promise<SentimentDashboard>;
  refreshIntervalMs?: number;
}

type SentimentTab = 'overview' | 'mentions' | 'spikes' | 'wsb' | 'momentum' | 'feed';

const SocialSentimentPanel: React.FC<SocialSentimentPanelProps> = ({
  className = '',
  onRefresh,
  refreshIntervalMs = 30000,
}) => {
  const [activeTab, setActiveTab] = useState<SentimentTab>('overview');
  const [data, setData] = useState<SentimentDashboard>(generateMockDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!onRefresh) {
      setData(generateMockDashboard());
      setLastUpdate(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onRefresh();
      setData(result);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, refreshIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh, refreshIntervalMs]);

  const maxBullishMentions = useMemo(
    () => Math.max(1, ...data.top_bullish.map(m => m.mentions_total)),
    [data.top_bullish]
  );
  const maxBearishMentions = useMemo(
    () => Math.max(1, ...data.top_bearish.map(m => m.mentions_total)),
    [data.top_bearish]
  );

  const tabs: { id: SentimentTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'mentions', label: 'Mentions', icon: '📊' },
    { id: 'spikes', label: 'Spikes', icon: '⚡' },
    { id: 'wsb', label: 'WallStreetBets', icon: '🦍' },
    { id: 'momentum', label: 'Momentum', icon: '→' },
    { id: 'feed', label: 'Live Feed', icon: '📡' },
  ];

  const fgZone = FEAR_GREED_LABELS.find(z => data.fear_greed_index <= z.max) || FEAR_GREED_LABELS[4];

  return (
    <div className={`social-sentiment-panel ${className}`}>
      {/* Header */}
      <div className="social-sentiment-panel__header">
        <div className="social-sentiment-panel__title">
          <span>📡</span> SOCIAL SENTIMENT
        </div>
        <div className="social-sentiment-panel__controls">
          <div className="trending-tags">
            {data.trending.map(tag => (
              <span key={tag} className="trending-tag">#{tag}</span>
            ))}
          </div>
          <span className="update-time">{loading ? 'Updating...' : lastUpdate.toLocaleTimeString()}</span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading}>⟳</button>
        </div>
      </div>

      {error && <div className="panel-error">⚠ {error}</div>}

      {/* Tabs */}
      <div className="social-sentiment-panel__tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`sentiment-tab${activeTab === t.id ? ' sentiment-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="social-sentiment-panel__content">

        {activeTab === 'overview' && (
          <div className="sentiment-overview">
            {/* Fear & Greed */}
            <div className="fear-greed-section">
              <h3 className="panel-title">Fear & Greed Index</h3>
              <FearGreedGauge value={data.fear_greed_index} />
              <div className="fg-description" style={{ color: fgZone.color }}>
                Market is showing <strong>{fgZone.label}</strong>
              </div>
            </div>

            {/* Overall Market Sentiment */}
            <div className="market-sentiment-section">
              <h3 className="panel-title">Market-Wide Sentiment</h3>
              <SentimentBar sentiment={data.overall_market_sentiment} />
              <div className="sentiment-stats">
                <span>Confidence: {(data.overall_market_sentiment.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Spike alerts summary */}
            <div className="spike-summary">
              <h3 className="panel-title">Active Mention Spikes</h3>
              <SpikeAlertList spikes={data.spikes.slice(0, 3)} />
            </div>

            {/* Top bullish at-a-glance */}
            <div className="top-movers">
              <h3 className="panel-title">Most Bullish Mentions</h3>
              {data.top_bullish.slice(0, 5).map(v => (
                <MentionVolumeBar key={v.symbol} volume={v} maxMentions={maxBullishMentions} />
              ))}
            </div>

            <div className="top-movers">
              <h3 className="panel-title">Most Bearish Mentions</h3>
              {data.top_bearish.slice(0, 5).map(v => (
                <MentionVolumeBar key={v.symbol} volume={v} maxMentions={maxBearishMentions} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mentions' && (
          <div className="mentions-view">
            <div className="mentions-col">
              <h3 className="panel-title" style={{ color: '#00d4aa' }}>▲ Bullish Volume</h3>
              {data.top_bullish.map(v => (
                <MentionVolumeBar key={v.symbol} volume={v} maxMentions={maxBullishMentions} />
              ))}
            </div>
            <div className="mentions-col">
              <h3 className="panel-title" style={{ color: '#ff4444' }}>▼ Bearish Volume</h3>
              {data.top_bearish.map(v => (
                <MentionVolumeBar key={v.symbol} volume={v} maxMentions={maxBearishMentions} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'spikes' && (
          <div className="spikes-view">
            <h3 className="panel-title">Unusual Mention Spikes</h3>
            <p className="panel-subtitle">Symbols with abnormally high mention velocity compared to baseline</p>
            <SpikeAlertList spikes={data.spikes} />
          </div>
        )}

        {activeTab === 'wsb' && (
          <div className="wsb-view">
            <h3 className="panel-title">r/WallStreetBets Analysis</h3>
            <p className="panel-subtitle">DD posts, YOLO mentions, rocket emojis, and squeeze probability</p>
            <WSBGrid picks={data.wsb_picks} />

            {/* Controversy alerts */}
            <h3 className="panel-title" style={{ marginTop: 16 }}>Controversy Alerts</h3>
            <div className="controversy-list">
              {data.controversy.map(c => {
                const cColor = c.controversy_score > 0.7 ? '#ff4444' : c.controversy_score > 0.5 ? '#ffcc00' : '#88cc44';
                return (
                  <div key={c.symbol} className="controversy-item" style={{ borderLeftColor: cColor }}>
                    <div className="controversy-symbol" style={{ color: cColor }}>
                      {c.symbol} {c.trending && '🔥 TRENDING'}
                    </div>
                    <div className="controversy-stats">
                      <span>Controversy: {(c.controversy_score * 100).toFixed(0)}%</span>
                      <span>Debate: {(c.debate_intensity * 100).toFixed(0)}%</span>
                      <span>Bull/Bear: {c.bull_bear_ratio.toFixed(2)}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'momentum' && (
          <div className="momentum-view">
            <h3 className="panel-title">Sentiment Momentum</h3>
            <p className="panel-subtitle">Short vs medium-term sentiment trend and reversal signals</p>
            <MomentumTable momentum={data.momentum} />
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="feed-view">
            <h3 className="panel-title">Live Social Feed</h3>
            <PostFeed posts={data.posts_feed} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialSentimentPanel;
export type { SentimentDashboard, SentimentScore, MentionVolume, SentimentSpike, WSBAnalysis };
