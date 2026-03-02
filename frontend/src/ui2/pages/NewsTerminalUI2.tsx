/**
 * NewsTerminalUI2.tsx — Bloomberg TOP / TradingView News Terminal
 * ================================================================
 * Full-featured news terminal with:
 * - Multi-source news feed (Reuters, Bloomberg, CNBC, MarketWatch, etc.)
 * - Real-time sentiment analysis with NLP scores
 * - Category filtering (Macro, Earnings, M&A, IPO, Crypto, Commodities)
 * - Symbol-specific news lookup
 * - Trending topics / keyword cloud
 * - Canvas sentiment timeline chart
 * - Reading list / bookmarks
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// ── Theme ────────────────────────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Source definitions ───────────────────────────────────────────────────────
const NEWS_SOURCES = [
  { id: 'reuters', label: 'Reuters', color: '#ff6900' },
  { id: 'bloomberg', label: 'Bloomberg', color: '#2196f3' },
  { id: 'cnbc', label: 'CNBC', color: '#ffab00' },
  { id: 'wsj', label: 'Wall St Journal', color: '#90caf9' },
  { id: 'ft', label: 'Financial Times', color: '#f8bbd0' },
  { id: 'marketwatch', label: 'MarketWatch', color: '#69f0ae' },
  { id: 'sec', label: 'SEC Filing', color: '#ce93d8' },
  { id: 'fed', label: 'Federal Reserve', color: '#80cbc4' },
];

const CATEGORIES = ['All', 'Macro', 'Earnings', 'M&A', 'IPO', 'Crypto', 'Commodities', 'Tech', 'Geopolitical', 'Central Banks', 'Regulations'];

// ── Mock news data ───────────────────────────────────────────────────────────
interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  category: string;
  tickers: string[];
  sentiment: number;       // -1 to 1
  sentimentLabel: 'Bullish' | 'Bearish' | 'Neutral';
  importance: 'high' | 'medium' | 'low';
  timestamp: Date;
  readTime: number;        // minutes
  bookmarked?: boolean;
  read?: boolean;
}

function generateMockNews(): NewsItem[] {
  const headlines = [
    { h: 'Fed Holds Rates Steady, Signals Possible Cut in September', cat: 'Central Banks', src: 'fed', tickers: ['SPY', 'TLT', 'GLD'], sent: 0.3, imp: 'high' as const },
    { h: 'NVIDIA Reports Record Q2 Revenue of $30.04B, Beats Estimates by 15%', cat: 'Earnings', src: 'bloomberg', tickers: ['NVDA', 'AMD', 'AVGO'], sent: 0.8, imp: 'high' as const },
    { h: 'Apple Unveils Apple Intelligence — AI Features Coming to All Devices', cat: 'Tech', src: 'reuters', tickers: ['AAPL', 'GOOGL', 'MSFT'], sent: 0.6, imp: 'high' as const },
    { h: 'Oil Prices Surge 4% After OPEC+ Extends Production Cuts to Q4', cat: 'Commodities', src: 'reuters', tickers: ['XOM', 'CVX', 'COP'], sent: 0.5, imp: 'high' as const },
    { h: 'Bitcoin Breaks Above $70,000 as ETF Inflows Hit Record $1.2B', cat: 'Crypto', src: 'cnbc', tickers: ['COIN', 'MSTR', 'RIOT'], sent: 0.7, imp: 'high' as const },
    { h: 'Microsoft-Activision Deal Gets Final EU Approval', cat: 'M&A', src: 'wsj', tickers: ['MSFT', 'ATVI'], sent: 0.4, imp: 'medium' as const },
    { h: 'US GDP Growth Revised Up to 3.4% in Q1, Above Expectations', cat: 'Macro', src: 'marketwatch', tickers: ['SPY', 'QQQ'], sent: 0.5, imp: 'high' as const },
    { h: 'Goldman Sachs Downgrades China Equities to Underweight', cat: 'Geopolitical', src: 'bloomberg', tickers: ['GS', 'FXI', 'EEM'], sent: -0.4, imp: 'medium' as const },
    { h: 'Tesla Recalls 125,000 Vehicles Over Seat Belt Warning Light Issue', cat: 'Tech', src: 'reuters', tickers: ['TSLA'], sent: -0.3, imp: 'medium' as const },
    { h: 'Arm Holdings IPO Prices at $51/Share, Values Company at $54.5B', cat: 'IPO', src: 'ft', tickers: ['ARM', 'NVDA'], sent: 0.6, imp: 'high' as const },
    { h: 'EU Carbon Prices Hit 3-Month Low as Economic Slowdown Weighs', cat: 'Commodities', src: 'ft', tickers: ['KRBN'], sent: -0.3, imp: 'low' as const },
    { h: 'SEC Approves 11 Spot Bitcoin ETFs for US Listing', cat: 'Crypto', src: 'sec', tickers: ['BTC', 'COIN', 'GBTC'], sent: 0.9, imp: 'high' as const },
    { h: 'Amazon Web Services Revenue Grows 17% YoY to $25.04B', cat: 'Earnings', src: 'cnbc', tickers: ['AMZN', 'MSFT', 'GOOGL'], sent: 0.5, imp: 'medium' as const },
    { h: 'Bank of Japan Ends Negative Interest Rate Policy After 17 Years', cat: 'Central Banks', src: 'bloomberg', tickers: ['EWJ', 'FXY'], sent: 0.2, imp: 'high' as const },
    { h: 'Pfizer Announces $43B Acquisition of Seagen for Cancer Portfolio', cat: 'M&A', src: 'wsj', tickers: ['PFE', 'SGEN'], sent: 0.3, imp: 'high' as const },
    { h: 'Copper Prices Reach All-Time High on AI Data Center Demand', cat: 'Commodities', src: 'reuters', tickers: ['FCX', 'SCCO'], sent: 0.6, imp: 'medium' as const },
    { h: 'Meta Platforms Misses Q3 Revenue Estimates, Guides Lower', cat: 'Earnings', src: 'bloomberg', tickers: ['META'], sent: -0.6, imp: 'high' as const },
    { h: 'US Imposes New Chip Export Controls on China, Targeting AI', cat: 'Regulations', src: 'reuters', tickers: ['NVDA', 'AMD', 'INTC'], sent: -0.4, imp: 'high' as const },
    { h: 'Ethereum ETFs See First Week of Net Outflows Since Launch', cat: 'Crypto', src: 'marketwatch', tickers: ['ETH', 'COIN'], sent: -0.3, imp: 'medium' as const },
    { h: 'Disney+ Subscriber Count Falls 2M, Stock Drops 8% After-Hours', cat: 'Earnings', src: 'cnbc', tickers: ['DIS', 'NFLX'], sent: -0.5, imp: 'medium' as const },
    { h: 'Saudi Aramco Reports 30% Profit Decline in H1 2024', cat: 'Earnings', src: 'ft', tickers: ['XOM', 'CVX'], sent: -0.2, imp: 'medium' as const },
    { h: 'ECB Cuts Rates by 25bps, First Cut Since 2019', cat: 'Central Banks', src: 'bloomberg', tickers: ['EFA', 'FXE'], sent: 0.3, imp: 'high' as const },
    { h: 'Reddit IPO Surges 48% on First Day of Trading', cat: 'IPO', src: 'cnbc', tickers: ['RDDT'], sent: 0.7, imp: 'medium' as const },
    { h: 'China Retaliates with Tariffs on $34B of US Agricultural Goods', cat: 'Geopolitical', src: 'reuters', tickers: ['ADM', 'DE', 'MOS'], sent: -0.6, imp: 'high' as const },
    { h: 'US Job Market Adds 303K Positions, Unemployment Falls to 3.5%', cat: 'Macro', src: 'marketwatch', tickers: ['SPY', 'TLT'], sent: 0.4, imp: 'high' as const },
    { h: 'Broadcom Completes $61B Acquisition of VMware', cat: 'M&A', src: 'wsj', tickers: ['AVGO', 'VMW'], sent: 0.3, imp: 'medium' as const },
    { h: 'Natural Gas Prices Drop 15% on Warmer-Than-Expected Forecasts', cat: 'Commodities', src: 'marketwatch', tickers: ['UNG', 'SWN'], sent: -0.4, imp: 'low' as const },
    { h: 'Stripe Raises $6.5B at $50B Valuation in Private Round', cat: 'IPO', src: 'bloomberg', tickers: [], sent: 0.5, imp: 'medium' as const },
    { h: 'US Consumer Confidence Falls to Lowest Level Since November', cat: 'Macro', src: 'cnbc', tickers: ['SPY', 'XRT'], sent: -0.4, imp: 'medium' as const },
    { h: 'OpenAI Valued at $86B After Latest Funding Round Led by Thrive', cat: 'Tech', src: 'ft', tickers: ['MSFT'], sent: 0.5, imp: 'medium' as const },
  ];

  return headlines.map((h, i) => {
    const minsAgo = i * 7 + Math.floor(Math.random() * 30);
    return {
      id: `news-${i}`,
      headline: h.h,
      summary: `${h.h.split(',')[0]}. Analysts and market participants are closely watching developments as this could have significant implications for the ${h.cat.toLowerCase()} sector and broader market sentiment moving forward.`,
      source: h.src,
      category: h.cat,
      tickers: h.tickers,
      sentiment: h.sent,
      sentimentLabel: h.sent > 0.2 ? 'Bullish' : h.sent < -0.2 ? 'Bearish' : 'Neutral',
      importance: h.imp,
      timestamp: new Date(Date.now() - minsAgo * 60000),
      readTime: 2 + Math.floor(Math.random() * 5),
      bookmarked: false,
      read: false,
    };
  });
}

// ── Sentiment chart ──────────────────────────────────────────────────────────
function SentimentChart({ news, width = 700, height = 120 }: { news: NewsItem[]; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 0.5;
    const mid = height / 2;
    [0, 0.25, 0.5, 0.75, 1].forEach(p => {
      const y = p * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // Zero line
    ctx.strokeStyle = MUTED;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = MUTED;
    ctx.font = '9px monospace';
    ctx.fillText('BULLISH', 4, 12);
    ctx.fillText('BEARISH', 4, height - 4);

    // Plot sentiment dots
    const sorted = [...news].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (sorted.length === 0) return;

    const minT = sorted[0].timestamp.getTime();
    const maxT = sorted[sorted.length - 1].timestamp.getTime();
    const rangeT = maxT - minT || 1;

    sorted.forEach(item => {
      const x = ((item.timestamp.getTime() - minT) / rangeT) * (width - 20) + 10;
      const y = mid - item.sentiment * (mid - 8);
      const r = item.importance === 'high' ? 5 : item.importance === 'medium' ? 3.5 : 2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = item.sentiment > 0.2 ? GREEN : item.sentiment < -0.2 ? RED : MUTED;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Trendline
    if (sorted.length >= 3) {
      ctx.beginPath();
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1.5;
      const windowSize = 5;
      for (let i = 0; i < sorted.length; i++) {
        const slice = sorted.slice(Math.max(0, i - windowSize), i + 1);
        const avgSent = slice.reduce((a, s) => a + s.sentiment, 0) / slice.length;
        const x = ((sorted[i].timestamp.getTime() - minT) / rangeT) * (width - 20) + 10;
        const y = mid - avgSent * (mid - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [news, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Trending keywords ────────────────────────────────────────────────────────
function extractTrending(news: NewsItem[]): Array<{ word: string; count: number; sentiment: number }> {
  const words = new Map<string, { count: number; totalSent: number }>();
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'by', 'is', 'as', 'its', 'after', 'with', 'from', 'new', 'first', 'all', 'than']);

  news.forEach(item => {
    const tokens = item.headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const seen = new Set<string>();
    tokens.forEach(t => {
      if (t.length < 3 || stopWords.has(t) || seen.has(t)) return;
      seen.add(t);
      const existing = words.get(t) || { count: 0, totalSent: 0 };
      words.set(t, { count: existing.count + 1, totalSent: existing.totalSent + item.sentiment });
    });
  });

  return Array.from(words.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([word, v]) => ({ word, count: v.count, sentiment: v.totalSent / v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ── Time formatting ──────────────────────────────────────────────────────────
function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'feed' | 'sentiment' | 'trending' | 'bookmarks';

export default function NewsTerminalUI2() {
  const [news, setNews] = useState<NewsItem[]>(() => generateMockNews());
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(NEWS_SOURCES.map(s => s.id)));
  const [searchQuery, setSearchQuery] = useState('');
  const [tickerFilter, setTickerFilter] = useState('');
  const [selectedNews, setSelectedNews] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  // ── Filter news ──
  const filteredNews = useMemo(() => {
    let items = news;
    if (activeCategory !== 'All') {
      items = items.filter(n => n.category === activeCategory);
    }
    items = items.filter(n => activeSources.has(n.source));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(n => n.headline.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q));
    }
    if (tickerFilter) {
      const t = tickerFilter.toUpperCase();
      items = items.filter(n => n.tickers.some(tk => tk.includes(t)));
    }
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [news, activeCategory, activeSources, searchQuery, tickerFilter]);

  const bookmarkedNews = useMemo(() => news.filter(n => n.bookmarked), [news]);

  const trending = useMemo(() => extractTrending(news), [news]);

  // ── Toggle bookmark ──
  const toggleBookmark = useCallback((id: string) => {
    setNews(prev => prev.map(n => n.id === id ? { ...n, bookmarked: !n.bookmarked } : n));
  }, []);

  // ── Mark as read ──
  const markRead = useCallback((id: string) => {
    setNews(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setSelectedNews(id);
  }, []);

  // ── Toggle source ──
  const toggleSource = useCallback((srcId: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(srcId)) next.delete(srcId);
      else next.add(srcId);
      return next;
    });
  }, []);

  // ── Sentiment stats ──
  const sentimentStats = useMemo(() => {
    const bullish = filteredNews.filter(n => n.sentiment > 0.2).length;
    const bearish = filteredNews.filter(n => n.sentiment < -0.2).length;
    const neutral = filteredNews.length - bullish - bearish;
    const avg = filteredNews.length > 0 ? filteredNews.reduce((a, n) => a + n.sentiment, 0) / filteredNews.length : 0;
    return { bullish, bearish, neutral, avg };
  }, [filteredNews]);

  const selectedItem = selectedNews ? news.find(n => n.id === selectedNews) : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'feed', label: 'NEWS FEED' },
    { key: 'sentiment', label: 'SENTIMENT' },
    { key: 'trending', label: 'TRENDING' },
    { key: 'bookmarks', label: `SAVED (${bookmarkedNews.length})` },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11, textTransform: 'uppercase' }}>
          NEWS TERMINAL
        </span>
        <span style={{ color: MUTED, fontSize: 9 }}>{filteredNews.length} articles</span>

        {/* Sentiment indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginLeft: 16,
          padding: '3px 8px',
          background: sentimentStats.avg > 0.1 ? 'rgba(38,166,154,0.1)' : sentimentStats.avg < -0.1 ? 'rgba(239,83,80,0.1)' : 'transparent',
          borderRadius: 3,
          border: `1px solid ${sentimentStats.avg > 0.1 ? GREEN : sentimentStats.avg < -0.1 ? RED : BORDER}`,
        }}>
          <span style={{ fontSize: 9, color: MUTED }}>MARKET SENTIMENT:</span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: sentimentStats.avg > 0.1 ? GREEN : sentimentStats.avg < -0.1 ? RED : MUTED,
          }}>
            {sentimentStats.avg > 0.1 ? '▲ BULLISH' : sentimentStats.avg < -0.1 ? '▼ BEARISH' : '● NEUTRAL'}
            ({sentimentStats.avg.toFixed(2)})
          </span>
        </div>

        {/* Tabs */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category + search bar ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {/* Categories */}
        {CATEGORIES.map(c => (
          <button
            key={c}
            style={{
              background: activeCategory === c ? 'rgba(245,166,35,0.12)' : 'transparent',
              border: `1px solid ${activeCategory === c ? AMBER : BORDER}`,
              color: activeCategory === c ? AMBER : MUTED,
              padding: '3px 8px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 9,
              fontFamily: '"Roboto Mono", monospace',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Ticker filter */}
        <input
          style={{
            background: '#0d0d0d',
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            color: TEXT,
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: '"Roboto Mono", monospace',
            width: 80,
            outline: 'none',
          }}
          placeholder="Ticker..."
          value={tickerFilter}
          onChange={e => setTickerFilter(e.target.value)}
        />

        {/* Search */}
        <input
          style={{
            background: '#0d0d0d',
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            color: TEXT,
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: '"Roboto Mono", monospace',
            width: 160,
            outline: 'none',
          }}
          placeholder="Search news..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        {/* Sources toggle */}
        <div style={{ position: 'relative' }}>
          <button
            style={{
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              color: MUTED,
              padding: '3px 8px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 9,
              fontFamily: '"Roboto Mono", monospace',
            }}
            onClick={() => setShowSources(!showSources)}
          >
            SOURCES ({activeSources.size}/{NEWS_SOURCES.length})
          </button>
          {showSources && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 3,
              padding: 6,
              zIndex: 100,
              width: 180,
            }}>
              {NEWS_SOURCES.map(s => (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 4px',
                    cursor: 'pointer',
                    fontSize: 9,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={activeSources.has(s.id)}
                    onChange={() => toggleSource(s.id)}
                    style={{ accentColor: s.color }}
                  />
                  <span style={{ color: s.color }}>●</span>
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {activeTab === 'feed' && (
          <>
            {/* News list */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filteredNews.map(item => {
                const source = NEWS_SOURCES.find(s => s.id === item.source);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: `1px solid ${BORDER}`,
                      background: selectedNews === item.id ? 'rgba(245,166,35,0.06)' : item.read ? BG : PANEL,
                      cursor: 'pointer',
                      borderLeft: `3px solid ${
                        item.importance === 'high' ? RED :
                        item.importance === 'medium' ? AMBER : BORDER
                      }`,
                    }}
                    onClick={() => markRead(item.id)}
                  >
                    {/* Top row: source + time + importance */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: source?.color || MUTED, fontSize: 9, fontWeight: 600 }}>
                          {source?.label || item.source}
                        </span>
                        <span style={{
                          background: 'rgba(245,166,35,0.1)',
                          color: AMBER,
                          padding: '1px 5px',
                          borderRadius: 2,
                          fontSize: 8,
                        }}>
                          {item.category}
                        </span>
                        {item.importance === 'high' && (
                          <span style={{ color: RED, fontSize: 8 }}>🔴 HIGH</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: MUTED, fontSize: 9 }}>{timeAgo(item.timestamp)}</span>
                        <span style={{ color: MUTED, fontSize: 9 }}>{item.readTime}min read</span>
                        <span
                          style={{ cursor: 'pointer', fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); toggleBookmark(item.id); }}
                        >
                          {item.bookmarked ? '⭐' : '☆'}
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <div style={{
                      fontSize: 12,
                      fontWeight: item.read ? 400 : 600,
                      color: item.read ? MUTED : TEXT,
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}>
                      {item.headline}
                    </div>

                    {/* Bottom: tickers + sentiment */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {item.tickers.map(t => (
                          <span
                            key={t}
                            style={{
                              background: 'rgba(66,165,245,0.1)',
                              color: BLUE,
                              padding: '1px 5px',
                              borderRadius: 2,
                              fontSize: 9,
                              cursor: 'pointer',
                            }}
                            onClick={e => { e.stopPropagation(); setTickerFilter(t); }}
                          >
                            ${t}
                          </span>
                        ))}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 6px',
                        borderRadius: 2,
                        background: item.sentiment > 0.2
                          ? 'rgba(38,166,154,0.1)'
                          : item.sentiment < -0.2
                            ? 'rgba(239,83,80,0.1)'
                            : 'rgba(136,136,136,0.1)',
                      }}>
                        <span style={{
                          color: item.sentiment > 0.2 ? GREEN : item.sentiment < -0.2 ? RED : MUTED,
                          fontSize: 9,
                          fontWeight: 600,
                        }}>
                          {item.sentimentLabel} ({item.sentiment > 0 ? '+' : ''}{item.sentiment.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedItem && (
              <div style={{
                width: 350,
                background: PANEL,
                borderLeft: `1px solid ${BORDER}`,
                padding: 16,
                overflow: 'auto',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: NEWS_SOURCES.find(s => s.id === selectedItem.source)?.color, fontSize: 10, fontWeight: 600 }}>
                    {NEWS_SOURCES.find(s => s.id === selectedItem.source)?.label}
                  </span>
                  <span style={{ color: MUTED, fontSize: 9 }}>{timeAgo(selectedItem.timestamp)}</span>
                </div>

                <h3 style={{ color: TEXT, fontSize: 13, fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>
                  {selectedItem.headline}
                </h3>

                <p style={{ color: MUTED, fontSize: 10, lineHeight: 1.5, marginBottom: 12 }}>
                  {selectedItem.summary}
                </p>

                {/* Sentiment gauge */}
                <div style={{
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 12,
                }}>
                  <div style={{ color: AMBER, fontSize: 9, fontWeight: 600, marginBottom: 6 }}>NLP SENTIMENT ANALYSIS</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: RED }}>Bearish</span>
                    <span style={{ fontSize: 9, color: GREEN }}>Bullish</span>
                  </div>
                  <div style={{
                    height: 8,
                    background: `linear-gradient(to right, ${RED}, ${MUTED}, ${GREEN})`,
                    borderRadius: 4,
                    position: 'relative',
                    marginBottom: 8,
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: `${(selectedItem.sentiment + 1) / 2 * 100}%`,
                      top: -3,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: AMBER,
                      transform: 'translateX(-50%)',
                      border: '2px solid #000',
                    }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      color: selectedItem.sentiment > 0.2 ? GREEN : selectedItem.sentiment < -0.2 ? RED : MUTED,
                      fontSize: 14,
                      fontWeight: 700,
                    }}>
                      {selectedItem.sentimentLabel}
                    </span>
                    <span style={{ color: MUTED, fontSize: 10, marginLeft: 6 }}>
                      Score: {selectedItem.sentiment.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Related tickers */}
                <div style={{
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 10,
                  marginBottom: 12,
                }}>
                  <div style={{ color: AMBER, fontSize: 9, fontWeight: 600, marginBottom: 6 }}>RELATED TICKERS</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedItem.tickers.map(t => (
                      <span
                        key={t}
                        style={{
                          background: 'rgba(66,165,245,0.15)',
                          color: BLUE,
                          padding: '4px 8px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        ${t}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ color: MUTED, fontSize: 9, textAlign: 'center' }}>
                  {selectedItem.readTime} min read • {selectedItem.importance.toUpperCase()} importance
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'sentiment' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {/* Sentiment overview */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{
                flex: 1,
                background: 'rgba(38,166,154,0.1)',
                border: `1px solid ${GREEN}`,
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
              }}>
                <div style={{ color: GREEN, fontSize: 24, fontWeight: 700 }}>{sentimentStats.bullish}</div>
                <div style={{ color: GREEN, fontSize: 9 }}>BULLISH</div>
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(136,136,136,0.1)',
                border: `1px solid ${MUTED}`,
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
              }}>
                <div style={{ color: MUTED, fontSize: 24, fontWeight: 700 }}>{sentimentStats.neutral}</div>
                <div style={{ color: MUTED, fontSize: 9 }}>NEUTRAL</div>
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(239,83,80,0.1)',
                border: `1px solid ${RED}`,
                borderRadius: 4,
                padding: 12,
                textAlign: 'center',
              }}>
                <div style={{ color: RED, fontSize: 24, fontWeight: 700 }}>{sentimentStats.bearish}</div>
                <div style={{ color: RED, fontSize: 9 }}>BEARISH</div>
              </div>
            </div>

            {/* Sentiment timeline */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 12,
              marginBottom: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>SENTIMENT TIMELINE</div>
              <SentimentChart news={filteredNews} />
            </div>

            {/* Per-category sentiment */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 12,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>SENTIMENT BY CATEGORY</div>
              {CATEGORIES.filter(c => c !== 'All').map(cat => {
                const catNews = news.filter(n => n.category === cat);
                if (catNews.length === 0) return null;
                const avg = catNews.reduce((a, n) => a + n.sentiment, 0) / catNews.length;
                const barWidth = Math.abs(avg) * 200;
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ width: 100, fontSize: 9, color: MUTED }}>{cat}</span>
                    <div style={{ width: 200, height: 12, background: BG, borderRadius: 2, position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: avg >= 0 ? '50%' : `calc(50% - ${barWidth}px)`,
                        width: barWidth,
                        height: '100%',
                        background: avg >= 0 ? GREEN : RED,
                        borderRadius: 2,
                        opacity: 0.7,
                      }} />
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        width: 1,
                        height: '100%',
                        background: MUTED,
                      }} />
                    </div>
                    <span style={{
                      color: avg > 0.2 ? GREEN : avg < -0.2 ? RED : MUTED,
                      fontSize: 9,
                      width: 40,
                      textAlign: 'right',
                    }}>
                      {avg > 0 ? '+' : ''}{avg.toFixed(2)}
                    </span>
                    <span style={{ color: MUTED, fontSize: 9 }}>({catNews.length})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'trending' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 12 }}>
              TRENDING KEYWORDS
            </div>

            {/* Word cloud-like display */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 24,
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
            }}>
              {trending.map(t => (
                <span
                  key={t.word}
                  style={{
                    fontSize: 10 + t.count * 3,
                    color: t.sentiment > 0.2 ? GREEN : t.sentiment < -0.2 ? RED : TEXT,
                    fontWeight: t.count >= 4 ? 700 : 400,
                    opacity: 0.4 + (t.count / 8) * 0.6,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 3,
                  }}
                  onClick={() => setSearchQuery(t.word)}
                >
                  {t.word}
                </span>
              ))}
            </div>

            {/* Trending table */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex',
                borderBottom: `2px solid ${BORDER}`,
                padding: '6px 12px',
              }}>
                <span style={{ flex: 1, color: MUTED, fontSize: 9, fontWeight: 600 }}>KEYWORD</span>
                <span style={{ width: 50, textAlign: 'right', color: MUTED, fontSize: 9, fontWeight: 600 }}>COUNT</span>
                <span style={{ width: 70, textAlign: 'right', color: MUTED, fontSize: 9, fontWeight: 600 }}>SENTIMENT</span>
              </div>
              {trending.map((t, i) => (
                <div
                  key={t.word}
                  style={{
                    display: 'flex',
                    padding: '6px 12px',
                    borderBottom: `1px solid ${BORDER}`,
                    background: i % 2 === 0 ? BG : PANEL,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSearchQuery(t.word)}
                >
                  <span style={{ flex: 1, color: TEXT, fontSize: 10 }}>{t.word}</span>
                  <span style={{ width: 50, textAlign: 'right', color: AMBER, fontSize: 10 }}>{t.count}</span>
                  <span style={{
                    width: 70,
                    textAlign: 'right',
                    color: t.sentiment > 0.2 ? GREEN : t.sentiment < -0.2 ? RED : MUTED,
                    fontSize: 10,
                  }}>
                    {t.sentiment > 0 ? '+' : ''}{t.sentiment.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {bookmarkedNews.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>☆</div>
                <div style={{ fontSize: 12 }}>No saved articles</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>Click the star icon on any article to save it</div>
              </div>
            ) : (
              bookmarkedNews.map(item => {
                const source = NEWS_SOURCES.find(s => s.id === item.source);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: `1px solid ${BORDER}`,
                      background: PANEL,
                      cursor: 'pointer',
                    }}
                    onClick={() => { markRead(item.id); setActiveTab('feed'); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: source?.color, fontSize: 9, fontWeight: 600 }}>{source?.label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: MUTED, fontSize: 9 }}>{timeAgo(item.timestamp)}</span>
                        <span
                          style={{ cursor: 'pointer', fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); toggleBookmark(item.id); }}
                        >⭐</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>
                      {item.headline}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
