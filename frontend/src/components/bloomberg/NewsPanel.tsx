import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type NewsCategory = 'Top' | 'Markets' | 'Company' | 'Economy' | 'Politics';
type Sentiment = 'positive' | 'negative' | 'neutral';
type ImpactLevel = 'high' | 'medium' | 'low';

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  category: NewsCategory;
  timestamp: number;
  sentiment: Sentiment;
  impact: ImpactLevel;
  tickers: string[];
  isBreaking: boolean;
  isRead: boolean;
}

interface NewsPanelProps {
  linkedSymbol?: string;
  className?: string;
  onTickerClick?: (ticker: string) => void;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const SOURCES = ['Bloomberg', 'Reuters', 'CNBC', 'FT', 'WSJ', 'AP', 'Barrons', 'MarketWatch'];

const MOCK_ARTICLES: NewsArticle[] = [
  {
    id: 'n1', headline: 'Fed Signals Potential Rate Cuts in Second Half of 2025',
    summary: 'Federal Reserve Chair Jerome Powell indicated the central bank may begin easing monetary policy as inflation trends toward its 2% target. Markets rallied on the dovish signals with Treasury yields falling across the curve.',
    source: 'Bloomberg', category: 'Economy', timestamp: Date.now() - 300000,
    sentiment: 'positive', impact: 'high', tickers: ['SPX', 'TLT', 'US10Y'], isBreaking: true, isRead: false,
  },
  {
    id: 'n2', headline: 'Apple Reports Record Q4 Revenue Driven by Services Growth',
    summary: 'Apple Inc. posted quarterly revenue of $119.6B, beating Wall Street estimates by $2.4B. Services revenue hit an all-time high, offsetting continued weakness in China iPhone sales.',
    source: 'Reuters', category: 'Company', timestamp: Date.now() - 900000,
    sentiment: 'positive', impact: 'high', tickers: ['AAPL'], isBreaking: false, isRead: false,
  },
  {
    id: 'n3', headline: 'NVIDIA Announces Next-Gen AI Chip Architecture at GTC',
    summary: 'NVIDIA unveiled its Blackwell Ultra GPU platform featuring 2x performance improvements for large language model inference. Major cloud providers committed to early adoption orders.',
    source: 'CNBC', category: 'Company', timestamp: Date.now() - 1800000,
    sentiment: 'positive', impact: 'high', tickers: ['NVDA', 'MSFT', 'GOOGL', 'AMZN'], isBreaking: false, isRead: false,
  },
  {
    id: 'n4', headline: 'Oil Prices Fall as OPEC+ Considers Production Increase',
    summary: 'Crude oil futures dropped 3.2% after reports that Saudi Arabia is considering raising output. Brent fell below $80 per barrel for the first time in two weeks.',
    source: 'FT', category: 'Markets', timestamp: Date.now() - 3600000,
    sentiment: 'negative', impact: 'medium', tickers: ['CL1', 'XOM', 'CVX'], isBreaking: false, isRead: true,
  },
  {
    id: 'n5', headline: 'US-China Trade Tensions Escalate Over Semiconductor Exports',
    summary: 'The White House announced new restrictions on AI chip exports to China, prompting retaliatory tariff threats from Beijing. Tech stocks with significant China exposure fell in after-hours trading.',
    source: 'WSJ', category: 'Politics', timestamp: Date.now() - 5400000,
    sentiment: 'negative', impact: 'high', tickers: ['NVDA', 'AMD', 'INTC', 'QCOM'], isBreaking: false, isRead: true,
  },
  {
    id: 'n6', headline: 'European Markets Rally on Strong PMI Data',
    summary: 'The Eurozone composite PMI rose to 52.3, surprising economists who expected 49.8. The Euro gained against the dollar as traders priced in reduced ECB easing expectations.',
    source: 'Bloomberg', category: 'Markets', timestamp: Date.now() - 7200000,
    sentiment: 'positive', impact: 'medium', tickers: ['EURUSD', 'DAX', 'SX5E'], isBreaking: false, isRead: true,
  },
  {
    id: 'n7', headline: 'Tesla Recalls 2.1 Million Vehicles Over Autopilot Safety Concerns',
    summary: 'NHTSA ordered the recall after investigating dozens of accidents involving the Autopilot system. Tesla said the issue can be resolved with an over-the-air software update.',
    source: 'AP', category: 'Company', timestamp: Date.now() - 10800000,
    sentiment: 'negative', impact: 'medium', tickers: ['TSLA'], isBreaking: false, isRead: true,
  },
  {
    id: 'n8', headline: 'Bitcoin Surges Past $75,000 as Institutional Demand Accelerates',
    summary: 'Bitcoin reached a new all-time high, driven by record inflows into spot Bitcoin ETFs. BlackRock\'s IBIT saw $1.2B in daily inflows, the largest single-day figure since launch.',
    source: 'Bloomberg', category: 'Markets', timestamp: Date.now() - 14400000,
    sentiment: 'positive', impact: 'medium', tickers: ['BTC', 'IBIT', 'COIN'], isBreaking: false, isRead: true,
  },
  {
    id: 'n9', headline: 'JPMorgan Reports Trading Revenue Surge on Market Volatility',
    summary: 'JPMorgan Chase posted FICC trading revenue up 21% year-over-year as elevated volatility in rates and FX markets boosted client activity.',
    source: 'Barrons', category: 'Company', timestamp: Date.now() - 18000000,
    sentiment: 'positive', impact: 'low', tickers: ['JPM', 'GS', 'MS'], isBreaking: false, isRead: true,
  },
  {
    id: 'n10', headline: 'US Jobless Claims Fall Below 200K, Labor Market Remains Tight',
    summary: 'Initial jobless claims dropped to 194,000, the lowest level in three months. Continuing claims also fell, suggesting limited layoff activity despite tech sector headwinds.',
    source: 'Reuters', category: 'Economy', timestamp: Date.now() - 21600000,
    sentiment: 'neutral', impact: 'medium', tickers: ['SPX', 'DXY'], isBreaking: false, isRead: true,
  },
  {
    id: 'n11', headline: 'Microsoft Azure Revenue Grows 29%, Beats Cloud Expectations',
    summary: 'Microsoft reported Azure cloud revenue growth of 29% year-over-year, driven by AI workload adoption. The company raised its full-year guidance for intelligent cloud.',
    source: 'MarketWatch', category: 'Company', timestamp: Date.now() - 25200000,
    sentiment: 'positive', impact: 'medium', tickers: ['MSFT', 'AMZN', 'GOOGL'], isBreaking: false, isRead: true,
  },
  {
    id: 'n12', headline: 'Gold Hits $2,050 on Safe Haven Demand Amid Middle East Tensions',
    summary: 'Spot gold climbed 1.4% to $2,050/oz as geopolitical risks in the Middle East drove safe haven buying. Silver and platinum also advanced.',
    source: 'FT', category: 'Markets', timestamp: Date.now() - 28800000,
    sentiment: 'neutral', impact: 'low', tickers: ['GC1', 'GLD', 'SLV'], isBreaking: false, isRead: true,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SENTIMENT_CONFIG: Record<Sentiment, { label: string; color: string; bg: string }> = {
  positive: { label: 'POS', color: 'text-[#00cc66]', bg: 'bg-[#00cc66]/15' },
  negative: { label: 'NEG', color: 'text-[#ff3333]', bg: 'bg-[#ff3333]/15' },
  neutral: { label: 'NEU', color: 'text-[#888]', bg: 'bg-[#888]/10' },
};

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; color: string }> = {
  high: { label: '●●●', color: 'text-[#ff9900]' },
  medium: { label: '●●○', color: 'text-[#666]' },
  low: { label: '●○○', color: 'text-[#444]' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function NewsPanel({ linkedSymbol, className = '', onTickerClick }: NewsPanelProps) {
  const [articles, setArticles] = useState<NewsArticle[]>(MOCK_ARTICLES);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const categories: (NewsCategory | 'All')[] = ['All', 'Top', 'Markets', 'Company', 'Economy', 'Politics'];

  const unreadCount = useMemo(() => articles.filter(a => !a.isRead).length, [articles]);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory !== 'All') list = list.filter(a => a.category === activeCategory);
    if (sourceFilter) list = list.filter(a => a.source === sourceFilter);
    if (linkedSymbol) {
      const sym = linkedSymbol.toUpperCase();
      list = list.filter(a => a.tickers.some(t => t.includes(sym)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.headline.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tickers.some(t => t.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [articles, activeCategory, sourceFilter, linkedSymbol, searchQuery]);

  const markRead = useCallback((id: string) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  const markAllRead = useCallback(() => {
    setArticles(prev => prev.map(a => ({ ...a, isRead: true })));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    markRead(id);
  }, [markRead]);

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[#ff9900] font-bold text-xs tracking-wider">NEWS</span>
            {linkedSymbol && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#ff9900]/20 text-[#ff9900] rounded">
                {linkedSymbol}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#ff3333]/20 text-[#ff3333] rounded font-bold">
                {unreadCount} NEW
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="text-[10px] text-[#555] hover:text-[#ff9900]">MARK ALL READ</button>
            <button
              onClick={() => setShowSourceFilter(!showSourceFilter)}
              className="text-[10px] text-[#555] hover:text-[#ff9900]"
            >SOURCES</button>
          </div>
        </div>

        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search news..."
          className="w-full bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-[11px] px-2 py-1 rounded outline-none focus:border-[#ff9900]/40 placeholder-[#333]"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-[#1a1a2e]">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-1.5 text-[10px] tracking-wider transition-colors ${
              activeCategory === cat
                ? 'text-[#ff9900] border-b-2 border-[#ff9900]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >{cat.toUpperCase()}</button>
        ))}
      </div>

      {/* Source Filter */}
      {showSourceFilter && (
        <div className="px-3 py-1.5 border-b border-[#1a1a2e] flex flex-wrap gap-1">
          <button
            onClick={() => setSourceFilter(null)}
            className={`px-2 py-0.5 text-[10px] rounded ${!sourceFilter ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555]'}`}
          >ALL</button>
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
              className={`px-2 py-0.5 text-[10px] rounded ${
                sourceFilter === s ? 'bg-[#6699ff]/20 text-[#6699ff]' : 'text-[#555] hover:text-[#888]'
              }`}
            >{s}</button>
          ))}
        </div>
      )}

      {/* News List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filtered.map(article => {
          const sentCfg = SENTIMENT_CONFIG[article.sentiment];
          const impactCfg = IMPACT_CONFIG[article.impact];
          const isExpanded = expandedId === article.id;

          return (
            <div
              key={article.id}
              onClick={() => toggleExpand(article.id)}
              className={`border-b border-[#1a1a2e] px-3 py-2 cursor-pointer transition-colors ${
                isExpanded ? 'bg-[#0f0f1e]' : 'hover:bg-[#0f0f1e]/50'
              } ${!article.isRead ? 'border-l-2 border-l-[#ff9900]' : ''}`}
            >
              {/* Breaking Banner */}
              {article.isBreaking && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#ff3333] text-white font-bold rounded animate-pulse">
                    BREAKING
                  </span>
                </div>
              )}

              {/* Headline Row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-xs leading-snug ${!article.isRead ? 'text-[#ccc] font-bold' : 'text-[#999]'}`}>
                    {article.headline}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[9px] px-1 py-0.5 rounded ${sentCfg.bg} ${sentCfg.color}`}>
                    {sentCfg.label}
                  </span>
                  <span className={`text-[9px] ${impactCfg.color}`} title={`Impact: ${article.impact}`}>
                    {impactCfg.label}
                  </span>
                </div>
              </div>

              {/* Meta Row */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-[#666]">{article.source}</span>
                <span className="text-[10px] text-[#444]">{timeAgo(article.timestamp)}</span>
                <span className="text-[10px] text-[#555] px-1 bg-[#1a1a2e] rounded">{article.category}</span>
                <div className="flex gap-1">
                  {article.tickers.slice(0, 4).map(t => (
                    <button
                      key={t}
                      onClick={e => { e.stopPropagation(); onTickerClick?.(t); }}
                      className="text-[9px] text-[#ff9900] hover:text-[#ffbb44] bg-[#ff9900]/10 px-1 rounded"
                    >{t}</button>
                  ))}
                  {article.tickers.length > 4 && (
                    <span className="text-[9px] text-[#555]">+{article.tickers.length - 4}</span>
                  )}
                </div>
              </div>

              {/* Expanded Summary */}
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[#1a1a2e]">
                  <p className="text-[11px] text-[#888] leading-relaxed">{article.summary}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-[#555]">Related:</span>
                    {article.tickers.map(t => (
                      <button
                        key={t}
                        onClick={e => { e.stopPropagation(); onTickerClick?.(t); }}
                        className="text-[10px] text-[#6699ff] hover:text-[#88bbff] underline"
                      >{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[#555] text-sm">
            No news articles match your filters
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#1a1a2e] bg-[#0f0f1e] text-[10px] text-[#555]">
        <span>{filtered.length} articles</span>
        <div className="flex items-center gap-3">
          <span className="text-[#00cc66]">POS {filtered.filter(a => a.sentiment === 'positive').length}</span>
          <span className="text-[#888]">NEU {filtered.filter(a => a.sentiment === 'neutral').length}</span>
          <span className="text-[#ff3333]">NEG {filtered.filter(a => a.sentiment === 'negative').length}</span>
        </div>
      </div>
    </div>
  );
}
