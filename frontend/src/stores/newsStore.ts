import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NewsCategory =
  | 'market' | 'earnings' | 'economy' | 'politics' | 'technology'
  | 'crypto' | 'commodities' | 'forex' | 'ipo' | 'mergers'
  | 'regulation' | 'analysis' | 'opinion' | 'breaking';

export type NewsSource =
  | 'reuters' | 'bloomberg' | 'cnbc' | 'wsj' | 'ft'
  | 'marketwatch' | 'benzinga' | 'seekingalpha' | 'yahoo'
  | 'barrons' | 'investopedia' | 'thestreet' | 'zacks'
  | 'motleyfool' | 'coindesk' | 'cointelegraph';

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  body: string;
  url: string;
  imageUrl: string | null;
  source: NewsSource;
  author: string;
  categories: NewsCategory[];
  symbols: string[];
  sentiment: NewsSentiment;
  sentimentScore: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
  publishedAt: number;
  updatedAt: number;
  isBreaking: boolean;
  isRead: boolean;
  isBookmarked: boolean;
  relatedArticleIds: string[];
  tags: string[];
}

export interface NewsAlert {
  id: string;
  name: string;
  keywords: string[];
  symbols: string[];
  categories: NewsCategory[];
  sources: NewsSource[];
  minImportance: 'low' | 'medium' | 'high' | 'critical';
  sentimentFilter: NewsSentiment | 'any';
  enabled: boolean;
  notifyPopup: boolean;
  notifySound: boolean;
  createdAt: number;
  matchCount: number;
}

export interface NewsStats {
  totalArticles: number;
  unreadCount: number;
  bookmarkCount: number;
  breakingCount: number;
  sentimentDistribution: Record<NewsSentiment, number>;
  topSymbols: { symbol: string; count: number }[];
  topCategories: { category: NewsCategory; count: number }[];
  articlesPerHour: number;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface NewsStoreState {
  articles: Record<string, NewsArticle>;
  articleOrder: string[];
  breakingNews: string[];

  categoryFilter: NewsCategory | null;
  sourceFilters: NewsSource[];
  sentimentFilter: NewsSentiment | null;
  symbolFilter: string | null;
  importanceFilter: 'low' | 'medium' | 'high' | 'critical' | null;
  searchQuery: string;
  dateRange: { from: number; to: number } | null;

  bookmarkedIds: Set<string>;
  readIds: Set<string>;

  newsAlerts: Record<string, NewsAlert>;

  stats: NewsStats;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  page: number;
  pageSize: number;
  lastFetchedAt: number;
  autoRefresh: boolean;
  refreshIntervalMs: number;
  error: string | null;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyStats(): NewsStats {
  return {
    totalArticles: 0,
    unreadCount: 0,
    bookmarkCount: 0,
    breakingCount: 0,
    sentimentDistribution: { bullish: 0, bearish: 0, neutral: 0, mixed: 0 },
    topSymbols: [],
    topCategories: [],
    articlesPerHour: 0,
  };
}

function computeStats(articles: Record<string, NewsArticle>, readIds: Set<string>, bookmarkedIds: Set<string>): NewsStats {
  const all = Object.values(articles);
  if (all.length === 0) return emptyStats();

  const sentimentDist: Record<NewsSentiment, number> = { bullish: 0, bearish: 0, neutral: 0, mixed: 0 };
  const symbolCounts = new Map<string, number>();
  const categoryCounts = new Map<NewsCategory, number>();

  let breakingCount = 0;
  let minTime = Infinity;
  let maxTime = 0;

  for (const a of all) {
    sentimentDist[a.sentiment]++;
    if (a.isBreaking) breakingCount++;
    if (a.publishedAt < minTime) minTime = a.publishedAt;
    if (a.publishedAt > maxTime) maxTime = a.publishedAt;
    for (const sym of a.symbols) symbolCounts.set(sym, (symbolCounts.get(sym) ?? 0) + 1);
    for (const cat of a.categories) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  const topSymbols = [...symbolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([symbol, count]) => ({ symbol, count }));

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  const hoursSpan = Math.max(1, (maxTime - minTime) / 3_600_000);

  return {
    totalArticles: all.length,
    unreadCount: all.filter((a) => !readIds.has(a.id)).length,
    bookmarkCount: bookmarkedIds.size,
    breakingCount,
    sentimentDistribution: sentimentDist,
    topSymbols,
    topCategories,
    articlesPerHour: all.length / hoursSpan,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

interface NewsStoreActions {
  addArticle: (article: Omit<NewsArticle, 'isRead' | 'isBookmarked'>) => void;
  addArticles: (articles: Omit<NewsArticle, 'isRead' | 'isBookmarked'>[]) => void;
  removeArticle: (articleId: string) => void;

  markRead: (articleId: string) => void;
  markAllRead: () => void;
  markUnread: (articleId: string) => void;
  bookmark: (articleId: string) => void;
  unbookmark: (articleId: string) => void;

  fetchNews: () => Promise<void>;
  fetchMore: () => Promise<void>;
  searchNews: (query: string) => void;
  refreshNews: () => Promise<void>;

  setCategoryFilter: (category: NewsCategory | null) => void;
  setSourceFilters: (sources: NewsSource[]) => void;
  toggleSourceFilter: (source: NewsSource) => void;
  setSentimentFilter: (sentiment: NewsSentiment | null) => void;
  setSymbolFilter: (symbol: string | null) => void;
  setImportanceFilter: (importance: 'low' | 'medium' | 'high' | 'critical' | null) => void;
  setDateRange: (range: { from: number; to: number } | null) => void;
  clearFilters: () => void;

  createNewsAlert: (alert: Omit<NewsAlert, 'id' | 'createdAt' | 'matchCount'>) => string;
  updateNewsAlert: (alertId: string, updates: Partial<NewsAlert>) => void;
  deleteNewsAlert: (alertId: string) => void;
  toggleNewsAlert: (alertId: string) => void;

  evaluateNewsAlerts: (article: NewsArticle) => string[];

  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (ms: number) => void;
  clearBreakingNews: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNewsStore = create<NewsStoreState & NewsStoreActions>()(
  immer((set, get) => ({
    articles: {},
    articleOrder: [],
    breakingNews: [],
    categoryFilter: null,
    sourceFilters: [],
    sentimentFilter: null,
    symbolFilter: null,
    importanceFilter: null,
    searchQuery: '',
    dateRange: null,
    bookmarkedIds: new Set<string>(),
    readIds: new Set<string>(),
    newsAlerts: {},
    stats: emptyStats(),
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    page: 0,
    pageSize: 50,
    lastFetchedAt: 0,
    autoRefresh: true,
    refreshIntervalMs: 60_000,
    error: null,

    addArticle: (article) => {
      set((s) => {
        const full: NewsArticle = { ...article, isRead: false, isBookmarked: false };
        s.articles[article.id] = full;
        s.articleOrder.unshift(article.id);
        if (article.isBreaking) s.breakingNews.unshift(article.id);
        s.stats = computeStats(s.articles, s.readIds, s.bookmarkedIds);
      });
      get().evaluateNewsAlerts(get().articles[article.id]);
    },

    addArticles: (articles) => {
      set((s) => {
        for (const article of articles) {
          const full: NewsArticle = { ...article, isRead: false, isBookmarked: false };
          s.articles[article.id] = full;
          if (!s.articleOrder.includes(article.id)) {
            s.articleOrder.push(article.id);
          }
          if (article.isBreaking && !s.breakingNews.includes(article.id)) {
            s.breakingNews.unshift(article.id);
          }
        }
        s.articleOrder.sort((a, b) => (s.articles[b]?.publishedAt ?? 0) - (s.articles[a]?.publishedAt ?? 0));
        s.stats = computeStats(s.articles, s.readIds, s.bookmarkedIds);
      });
    },

    removeArticle: (articleId) => {
      set((s) => {
        delete s.articles[articleId];
        s.articleOrder = s.articleOrder.filter((id) => id !== articleId);
        s.breakingNews = s.breakingNews.filter((id) => id !== articleId);
        s.readIds.delete(articleId);
        s.bookmarkedIds.delete(articleId);
        s.stats = computeStats(s.articles, s.readIds, s.bookmarkedIds);
      });
    },

    markRead: (articleId) => {
      set((s) => {
        if (s.articles[articleId]) {
          s.articles[articleId].isRead = true;
          s.readIds.add(articleId);
          s.stats.unreadCount = Math.max(0, s.stats.unreadCount - 1);
        }
      });
    },

    markAllRead: () => {
      set((s) => {
        for (const article of Object.values(s.articles)) {
          article.isRead = true;
          s.readIds.add(article.id);
        }
        s.stats.unreadCount = 0;
      });
    },

    markUnread: (articleId) => {
      set((s) => {
        if (s.articles[articleId]) {
          s.articles[articleId].isRead = false;
          s.readIds.delete(articleId);
          s.stats.unreadCount++;
        }
      });
    },

    bookmark: (articleId) => {
      set((s) => {
        if (s.articles[articleId]) {
          s.articles[articleId].isBookmarked = true;
          s.bookmarkedIds.add(articleId);
          s.stats.bookmarkCount = s.bookmarkedIds.size;
        }
      });
    },

    unbookmark: (articleId) => {
      set((s) => {
        if (s.articles[articleId]) {
          s.articles[articleId].isBookmarked = false;
          s.bookmarkedIds.delete(articleId);
          s.stats.bookmarkCount = s.bookmarkedIds.size;
        }
      });
    },

    fetchNews: async () => {
      set((s) => { s.isLoading = true; s.error = null; });
      try {
        // In production, fetch from API with current filters
        await new Promise((resolve) => setTimeout(resolve, 200));
        set((s) => {
          s.isLoading = false;
          s.lastFetchedAt = Date.now();
          s.page = 1;
        });
      } catch (err) {
        set((s) => {
          s.isLoading = false;
          s.error = err instanceof Error ? err.message : 'Failed to fetch news';
        });
      }
    },

    fetchMore: async () => {
      const { hasMore, isLoadingMore } = get();
      if (!hasMore || isLoadingMore) return;
      set((s) => { s.isLoadingMore = true; });
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        set((s) => {
          s.isLoadingMore = false;
          s.page++;
        });
      } catch (err) {
        set((s) => {
          s.isLoadingMore = false;
          s.error = err instanceof Error ? err.message : 'Failed to load more';
        });
      }
    },

    searchNews: (query) => {
      set((s) => {
        s.searchQuery = query;
        s.page = 0;
      });
    },

    refreshNews: async () => {
      await get().fetchNews();
    },

    setCategoryFilter: (category) => set((s) => { s.categoryFilter = category; }),
    setSourceFilters: (sources) => set((s) => { s.sourceFilters = sources; }),
    toggleSourceFilter: (source) => {
      set((s) => {
        const idx = s.sourceFilters.indexOf(source);
        if (idx >= 0) s.sourceFilters.splice(idx, 1);
        else s.sourceFilters.push(source);
      });
    },
    setSentimentFilter: (sentiment) => set((s) => { s.sentimentFilter = sentiment; }),
    setSymbolFilter: (symbol) => set((s) => { s.symbolFilter = symbol; }),
    setImportanceFilter: (importance) => set((s) => { s.importanceFilter = importance; }),
    setDateRange: (range) => set((s) => { s.dateRange = range; }),

    clearFilters: () => {
      set((s) => {
        s.categoryFilter = null;
        s.sourceFilters = [];
        s.sentimentFilter = null;
        s.symbolFilter = null;
        s.importanceFilter = null;
        s.searchQuery = '';
        s.dateRange = null;
      });
    },

    createNewsAlert: (alert) => {
      const id = generateId('nalert');
      set((s) => {
        s.newsAlerts[id] = { ...alert, id, createdAt: Date.now(), matchCount: 0 };
      });
      return id;
    },

    updateNewsAlert: (alertId, updates) => {
      set((s) => {
        if (s.newsAlerts[alertId]) Object.assign(s.newsAlerts[alertId], updates);
      });
    },

    deleteNewsAlert: (alertId) => {
      set((s) => { delete s.newsAlerts[alertId]; });
    },

    toggleNewsAlert: (alertId) => {
      set((s) => {
        if (s.newsAlerts[alertId]) s.newsAlerts[alertId].enabled = !s.newsAlerts[alertId].enabled;
      });
    },

    evaluateNewsAlerts: (article) => {
      const matched: string[] = [];
      if (!article) return matched;

      set((s) => {
        for (const alert of Object.values(s.newsAlerts)) {
          if (!alert.enabled) continue;

          let matches = true;

          if (alert.keywords.length > 0) {
            const text = `${article.title} ${article.summary}`.toLowerCase();
            matches = alert.keywords.some((kw) => text.includes(kw.toLowerCase()));
          }

          if (matches && alert.symbols.length > 0) {
            matches = alert.symbols.some((sym) => article.symbols.includes(sym));
          }

          if (matches && alert.categories.length > 0) {
            matches = alert.categories.some((cat) => article.categories.includes(cat));
          }

          if (matches && alert.sources.length > 0) {
            matches = alert.sources.includes(article.source);
          }

          if (matches && alert.sentimentFilter !== 'any') {
            matches = article.sentiment === alert.sentimentFilter;
          }

          const importanceOrder = ['low', 'medium', 'high', 'critical'];
          if (matches) {
            const minIdx = importanceOrder.indexOf(alert.minImportance);
            const artIdx = importanceOrder.indexOf(article.importance);
            matches = artIdx >= minIdx;
          }

          if (matches) {
            alert.matchCount++;
            matched.push(alert.id);
          }
        }
      });

      return matched;
    },

    setAutoRefresh: (enabled) => set((s) => { s.autoRefresh = enabled; }),
    setRefreshInterval: (ms) => set((s) => { s.refreshIntervalMs = Math.max(10_000, ms); }),
    clearBreakingNews: () => set((s) => { s.breakingNews = []; }),
  })),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectFilteredArticles = (s: NewsStoreState): NewsArticle[] => {
  let ids = s.articleOrder;

  return ids
    .map((id) => s.articles[id])
    .filter((a): a is NewsArticle => {
      if (!a) return false;
      if (s.categoryFilter && !a.categories.includes(s.categoryFilter)) return false;
      if (s.sourceFilters.length > 0 && !s.sourceFilters.includes(a.source)) return false;
      if (s.sentimentFilter && a.sentiment !== s.sentimentFilter) return false;
      if (s.symbolFilter && !a.symbols.includes(s.symbolFilter)) return false;
      if (s.importanceFilter) {
        const order = ['low', 'medium', 'high', 'critical'];
        if (order.indexOf(a.importance) < order.indexOf(s.importanceFilter)) return false;
      }
      if (s.searchQuery) {
        const q = s.searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.summary.toLowerCase().includes(q)) return false;
      }
      if (s.dateRange) {
        if (a.publishedAt < s.dateRange.from || a.publishedAt > s.dateRange.to) return false;
      }
      return true;
    });
};

export const selectBreakingArticles = (s: NewsStoreState) =>
  s.breakingNews.map((id) => s.articles[id]).filter(Boolean) as NewsArticle[];

export const selectBookmarkedArticles = (s: NewsStoreState) =>
  Object.values(s.articles).filter((a) => a.isBookmarked);

export const selectUnreadArticles = (s: NewsStoreState) =>
  Object.values(s.articles).filter((a) => !a.isRead);

export const selectArticlesBySymbol = (symbol: string) => (s: NewsStoreState) =>
  Object.values(s.articles).filter((a) => a.symbols.includes(symbol));

export const selectArticle = (id: string) => (s: NewsStoreState) =>
  s.articles[id] ?? null;

export const selectActiveNewsAlerts = (s: NewsStoreState) =>
  Object.values(s.newsAlerts).filter((a) => a.enabled);
