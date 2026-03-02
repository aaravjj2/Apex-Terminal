/**
 * useNews.ts
 * News feed hook with article fetching, real-time updates, category/source
 * filtering, sentiment analysis results, breaking news detection, and search.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NewsSentiment = 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
export type NewsCategory = 'market' | 'earnings' | 'economy' | 'politics' | 'crypto' | 'commodities' | 'forex' | 'ipos' | 'mergers' | 'regulation';
export type NewsSource = 'reuters' | 'bloomberg' | 'cnbc' | 'wsj' | 'ft' | 'seekingalpha' | 'benzinga' | 'marketwatch';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: number;
  updatedAt?: number;
  imageUrl?: string;
  symbols: string[];
  categories: NewsCategory[];
  sentiment: NewsSentiment;
  sentimentScore: number;
  relevanceScore: number;
  isBreaking: boolean;
  readTime: number;
  tags?: string[];
}

export interface NewsFilter {
  categories?: NewsCategory[];
  sources?: NewsSource[];
  symbols?: string[];
  sentiment?: NewsSentiment[];
  dateFrom?: number;
  dateTo?: number;
  searchQuery?: string;
  breakingOnly?: boolean;
}

export interface NewsStats {
  totalArticles: number;
  breakingCount: number;
  sentimentDistribution: Record<NewsSentiment, number>;
  topSymbols: Array<{ symbol: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
}

export interface UseNewsOptions {
  apiUrl?: string;
  wsUrl?: string;
  refreshIntervalMs?: number;
  maxArticles?: number;
  onBreakingNews?: (article: NewsArticle) => void;
  onError?: (error: string) => void;
  mockMode?: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_HEADLINES: Array<Omit<NewsArticle, 'id' | 'publishedAt' | 'sentimentScore' | 'relevanceScore' | 'readTime'>> = [
  { title: 'Fed Signals Potential Rate Cut in March Meeting', summary: 'Federal Reserve officials indicated they may consider cutting interest rates at their next policy meeting.', url: '#', source: 'reuters', symbols: ['SPY', 'QQQ', 'TLT'], categories: ['economy', 'market'], sentiment: 'bullish', isBreaking: true, author: 'Sarah Johnson', tags: ['fed', 'rates'] },
  { title: 'NVIDIA Reports Record Q4 Revenue on AI Demand', summary: 'NVIDIA beat estimates with data center revenue surging 400% year-over-year.', url: '#', source: 'bloomberg', symbols: ['NVDA', 'AMD', 'AVGO'], categories: ['earnings', 'market'], sentiment: 'very_bullish', isBreaking: false, author: 'Michael Chen' },
  { title: 'Oil Prices Slide on Higher-Than-Expected Inventories', summary: 'Crude oil dropped 3% after EIA reported a surprise build in inventories.', url: '#', source: 'cnbc', symbols: ['XOM', 'CVX', 'USO'], categories: ['commodities', 'market'], sentiment: 'bearish', isBreaking: false },
  { title: 'Apple Vision Pro Sales Disappoint in First Quarter', summary: 'Apple mixed reality headset sales fell short of internal targets.', url: '#', source: 'wsj', symbols: ['AAPL', 'META'], categories: ['earnings', 'market'], sentiment: 'bearish', isBreaking: false },
  { title: 'Bitcoin ETF Sees Record Inflows of $1.2 Billion', summary: 'Spot Bitcoin ETFs attracted massive institutional interest, pushing BTC above $70k.', url: '#', source: 'bloomberg', symbols: ['BTC', 'IBIT', 'GBTC'], categories: ['crypto', 'market'], sentiment: 'very_bullish', isBreaking: true },
  { title: 'European Markets Rally on ECB Dovish Stance', summary: 'Euro STOXX 50 gains 2% as ECB hints at earlier-than-expected easing.', url: '#', source: 'ft', symbols: ['EWG', 'FEZ', 'VGK'], categories: ['economy', 'market'], sentiment: 'bullish', isBreaking: false },
  { title: 'Tesla Announces Major Price Cuts Across All Models', summary: 'Tesla reduces prices by up to 15%, intensifying the EV price war.', url: '#', source: 'cnbc', symbols: ['TSLA', 'RIVN', 'LCID'], categories: ['market'], sentiment: 'bearish', isBreaking: false },
  { title: 'Microsoft Cloud Revenue Surpasses Expectations', summary: 'Azure revenue grew 29% as enterprise AI adoption accelerated.', url: '#', source: 'seekingalpha', symbols: ['MSFT', 'AMZN', 'GOOGL'], categories: ['earnings', 'market'], sentiment: 'bullish', isBreaking: false },
  { title: 'Congress Introduces New Crypto Regulation Bill', summary: 'Bipartisan bill aims to establish comprehensive framework for digital assets.', url: '#', source: 'wsj', symbols: ['BTC', 'ETH', 'COIN'], categories: ['regulation', 'crypto'], sentiment: 'neutral', isBreaking: false },
  { title: 'IPO Market Heats Up with Tech Unicorn Filing', summary: 'AI startup valued at $15B files S-1 registration for NASDAQ listing.', url: '#', source: 'bloomberg', symbols: ['QQQ'], categories: ['ipos', 'market'], sentiment: 'neutral', isBreaking: false },
];

function generateMockArticles(count: number): NewsArticle[] {
  const now = Date.now();
  return MOCK_HEADLINES.slice(0, Math.min(count, MOCK_HEADLINES.length)).map((h, i) => ({
    ...h,
    id: `news-${now}-${i}`,
    publishedAt: now - i * 3600000 - Math.random() * 1800000,
    sentimentScore: h.sentiment === 'very_bullish' ? 0.9 : h.sentiment === 'bullish' ? 0.6 : h.sentiment === 'neutral' ? 0 : h.sentiment === 'bearish' ? -0.4 : -0.8,
    relevanceScore: 0.5 + Math.random() * 0.5,
    readTime: 2 + Math.floor(Math.random() * 8),
  }));
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useNews(options: UseNewsOptions = {}) {
  const {
    apiUrl = '/api/news',
    refreshIntervalMs = 60000,
    maxArticles = 200,
    onBreakingNews,
    onError,
    mockMode = true,
  } = options;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filter, setFilter] = useState<NewsFilter>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchArticles = useCallback(async (append = false) => {
    setIsLoading(true);
    setError(null);

    try {
      let data: NewsArticle[];

      if (mockMode) {
        await new Promise(r => setTimeout(r, 300));
        data = generateMockArticles(10).map(a => ({
          ...a,
          publishedAt: a.publishedAt - (append ? articles.length * 3600000 : 0),
        }));
      } else {
        const params = new URLSearchParams();
        if (filter.categories?.length) params.set('categories', filter.categories.join(','));
        if (filter.sources?.length) params.set('sources', filter.sources.join(','));
        if (filter.symbols?.length) params.set('symbols', filter.symbols.join(','));
        if (filter.searchQuery) params.set('q', filter.searchQuery);
        if (filter.breakingOnly) params.set('breaking', '1');
        if (append && articles.length > 0) params.set('before', String(articles[articles.length - 1].publishedAt));

        const res = await fetch(`${apiUrl}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }

      const newBreaking = data.filter(a => a.isBreaking && !seenIdsRef.current.has(a.id));
      newBreaking.forEach(a => onBreakingNews?.(a));
      data.forEach(a => seenIdsRef.current.add(a.id));

      if (append) {
        setArticles(prev => [...prev, ...data].slice(0, maxArticles));
      } else {
        setArticles(data.slice(0, maxArticles));
      }
      setHasMore(data.length > 0);
    } catch (err) {
      const msg = `News fetch failed: ${err}`;
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, filter, articles.length, maxArticles, mockMode, onBreakingNews, onError]);

  const loadMore = useCallback(() => fetchArticles(true), [fetchArticles]);
  const refresh = useCallback(() => fetchArticles(false), [fetchArticles]);

  useEffect(() => {
    fetchArticles();
  }, [filter.categories?.join(','), filter.sources?.join(','), filter.symbols?.join(','), filter.searchQuery, filter.breakingOnly]);

  useEffect(() => {
    refreshTimerRef.current = setInterval(() => fetchArticles(false), refreshIntervalMs);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchArticles, refreshIntervalMs]);

  // ── Filtering ──

  const filteredArticles = useMemo(() => {
    let result = articles;

    if (filter.sentiment?.length) {
      result = result.filter(a => filter.sentiment!.includes(a.sentiment));
    }
    if (filter.dateFrom) {
      result = result.filter(a => a.publishedAt >= filter.dateFrom!);
    }
    if (filter.dateTo) {
      result = result.filter(a => a.publishedAt <= filter.dateTo!);
    }

    return result.sort((a, b) => b.publishedAt - a.publishedAt);
  }, [articles, filter.sentiment, filter.dateFrom, filter.dateTo]);

  const breakingNews = useMemo(() => {
    const cutoff = Date.now() - 3600000;
    return filteredArticles.filter(a => a.isBreaking && a.publishedAt > cutoff);
  }, [filteredArticles]);

  const stats = useMemo((): NewsStats => {
    const sentimentDist: Record<NewsSentiment, number> = { very_bullish: 0, bullish: 0, neutral: 0, bearish: 0, very_bearish: 0 };
    const symbolCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    articles.forEach(a => {
      sentimentDist[a.sentiment]++;
      a.symbols.forEach(s => symbolCounts.set(s, (symbolCounts.get(s) ?? 0) + 1));
      sourceCounts.set(a.source, (sourceCounts.get(a.source) ?? 0) + 1);
    });

    return {
      totalArticles: articles.length,
      breakingCount: articles.filter(a => a.isBreaking).length,
      sentimentDistribution: sentimentDist,
      topSymbols: [...symbolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([symbol, count]) => ({ symbol, count })),
      topSources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
    };
  }, [articles]);

  const setCategories = useCallback((categories: NewsCategory[]) => setFilter(prev => ({ ...prev, categories })), []);
  const setSources = useCallback((sources: NewsSource[]) => setFilter(prev => ({ ...prev, sources })), []);
  const setSymbols = useCallback((symbols: string[]) => setFilter(prev => ({ ...prev, symbols })), []);
  const setSentimentFilter = useCallback((sentiment: NewsSentiment[]) => setFilter(prev => ({ ...prev, sentiment })), []);
  const setSearchQuery = useCallback((searchQuery: string) => setFilter(prev => ({ ...prev, searchQuery })), []);
  const setBreakingOnly = useCallback((breakingOnly: boolean) => setFilter(prev => ({ ...prev, breakingOnly })), []);
  const clearFilters = useCallback(() => setFilter({}), []);

  const searchNews = useCallback(async (query: string): Promise<NewsArticle[]> => {
    if (mockMode) {
      const lower = query.toLowerCase();
      return articles.filter(a =>
        a.title.toLowerCase().includes(lower) ||
        a.summary.toLowerCase().includes(lower) ||
        a.symbols.some(s => s.toLowerCase().includes(lower))
      );
    }
    const res = await fetch(`${apiUrl}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  }, [apiUrl, articles, mockMode]);

  return {
    articles: filteredArticles,
    breakingNews,
    stats,
    filter,
    isLoading, error, hasMore,
    refresh, loadMore, searchNews,
    setFilter, setCategories, setSources, setSymbols,
    setSentimentFilter, setSearchQuery, setBreakingOnly, clearFilters,
  };
}

export default useNews;
