/**
 * newsApi.ts
 * News & research API client.
 * Covers headlines, symbol news, category feeds, search, sentiment analysis,
 * breaking news, economic calendar, analyst research, and real-time subscriptions.
 */

import { apiClient, cachedApiClient, createWebSocket } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewsCategory =
  | 'markets'
  | 'economy'
  | 'earnings'
  | 'ipos'
  | 'mergers'
  | 'politics'
  | 'crypto'
  | 'commodities'
  | 'forex'
  | 'technology'
  | 'healthcare'
  | 'energy';

export type NewsSentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type NewsImpact = 'high' | 'medium' | 'low';

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  body?: string;
  source: string;
  author: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  symbols: string[];
  categories: NewsCategory[];
  sentiment: NewsSentiment | null;
  sentimentScore: number | null;
  impact: NewsImpact | null;
  isBreaking: boolean;
  isPremium: boolean;
  readTime: number;
}

export interface NewsListResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface NewsSearchParams {
  query: string;
  symbols?: string[];
  categories?: NewsCategory[];
  sources?: string[];
  sentiment?: NewsSentiment;
  since?: string;
  until?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'date' | 'popularity';
}

export interface NewsAnalysis {
  articleId: string;
  headline: string;
  sentiment: NewsSentiment;
  sentimentScore: number;
  confidence: number;
  entities: NewsEntity[];
  topics: string[];
  keyPhrases: string[];
  impact: NewsImpact;
  affectedSymbols: Array<{
    symbol: string;
    expectedDirection: 'up' | 'down' | 'neutral';
    confidence: number;
  }>;
  summary: string;
  relatedArticles: string[];
}

export interface NewsEntity {
  name: string;
  type: 'person' | 'company' | 'sector' | 'country' | 'index' | 'other';
  sentiment: NewsSentiment;
  relevance: number;
}

export type EconomicEventImpact = 'high' | 'medium' | 'low';

export interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  date: string;
  time: string;
  impact: EconomicEventImpact;
  category: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  unit: string;
  currency: string;
  description: string;
  sourceUrl: string | null;
}

export interface EconomicCalendarResponse {
  events: EconomicEvent[];
  startDate: string;
  endDate: string;
  total: number;
  countries: string[];
}

export type ResearchRating = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

export interface AnalystResearch {
  id: string;
  symbol: string;
  firm: string;
  analyst: string;
  rating: ResearchRating;
  priorRating: ResearchRating | null;
  targetPrice: number;
  priorTargetPrice: number | null;
  summary: string;
  publishedAt: string;
  isPremium: boolean;
}

export interface AnalystResearchResponse {
  symbol: string;
  research: AnalystResearch[];
  consensusRating: ResearchRating;
  avgTargetPrice: number;
  highTargetPrice: number;
  lowTargetPrice: number;
  numAnalysts: number;
  ratingDistribution: Record<ResearchRating, number>;
}

export interface BreakingNewsEvent {
  id: string;
  headline: string;
  summary: string;
  source: string;
  symbols: string[];
  impact: NewsImpact;
  timestamp: string;
}

export interface NewsSubscription {
  unsubscribe: () => void;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/news';

export async function getTopNews(
  page = 1,
  pageSize = 20,
): Promise<NewsListResponse> {
  return apiClient.get<NewsListResponse>(
    `${BASE}/top${qs({ page, page_size: pageSize })}`,
    { useCache: true, cacheTtlMs: 30_000 },
  );
}

export async function getNewsBySymbol(
  symbol: string,
  page = 1,
  pageSize = 20,
): Promise<NewsListResponse> {
  return apiClient.get<NewsListResponse>(
    `${BASE}/symbol/${encodeURIComponent(symbol)}${qs({ page, page_size: pageSize })}`,
    { useCache: true, cacheTtlMs: 30_000 },
  );
}

export async function getNewsByCategory(
  category: NewsCategory,
  page = 1,
  pageSize = 20,
): Promise<NewsListResponse> {
  return apiClient.get<NewsListResponse>(
    `${BASE}/category/${category}${qs({ page, page_size: pageSize })}`,
    { useCache: true, cacheTtlMs: 30_000 },
  );
}

export async function searchNews(
  params: NewsSearchParams,
): Promise<NewsListResponse> {
  return apiClient.post<NewsListResponse>(`${BASE}/search`, params);
}

export async function getNewsAnalysis(
  articleId: string,
): Promise<NewsAnalysis> {
  return cachedApiClient.get<NewsAnalysis>(
    `${BASE}/analysis/${articleId}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function getBreakingNews(
  limit = 10,
): Promise<BreakingNewsEvent[]> {
  return apiClient.get<BreakingNewsEvent[]>(
    `${BASE}/breaking${qs({ limit })}`,
  );
}

export async function getEconomicCalendar(
  startDate: string,
  endDate: string,
  countries?: string[],
  impact?: EconomicEventImpact,
): Promise<EconomicCalendarResponse> {
  return cachedApiClient.get<EconomicCalendarResponse>(
    `${BASE}/economic-calendar${qs({
      start_date: startDate,
      end_date: endDate,
      countries: countries?.join(','),
      impact,
    })}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function getAnalystResearch(
  symbol: string,
  limit?: number,
): Promise<AnalystResearchResponse> {
  return cachedApiClient.get<AnalystResearchResponse>(
    `${BASE}/research/${encodeURIComponent(symbol)}${qs({ limit })}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

// ─── WebSocket Subscription ───────────────────────────────────────────────────

export function subscribeNews(
  callback: (event: NewsArticle | BreakingNewsEvent) => void,
  options?: {
    symbols?: string[];
    categories?: NewsCategory[];
    breakingOnly?: boolean;
  },
): NewsSubscription {
  const ws = createWebSocket('/ws/news', {
    onMessage: (raw) => {
      callback(raw as NewsArticle | BreakingNewsEvent);
    },
    onOpen: () => {
      ws.send({
        action: 'subscribe',
        symbols: options?.symbols ?? [],
        categories: options?.categories ?? [],
        breaking_only: options?.breakingOnly ?? false,
      });
    },
    reconnectMs: 3000,
    maxReconnects: 10,
  });

  return {
    unsubscribe: () => {
      ws.send({ action: 'unsubscribe' });
      ws.close();
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function sentimentColor(sentiment: NewsSentiment): string {
  const map: Record<NewsSentiment, string> = {
    very_positive: '#00ff9d',
    positive: '#00d4aa',
    neutral: '#888888',
    negative: '#ff9900',
    very_negative: '#ff4444',
  };
  return map[sentiment];
}

export function impactColor(impact: NewsImpact): string {
  const map: Record<NewsImpact, string> = {
    high: '#ff4444',
    medium: '#f59e0b',
    low: '#6b7280',
  };
  return map[impact];
}

export function ratingColor(rating: ResearchRating): string {
  const map: Record<ResearchRating, string> = {
    strong_buy: '#00ff9d',
    buy: '#00d4aa',
    hold: '#f59e0b',
    sell: '#ff9900',
    strong_sell: '#ff4444',
  };
  return map[rating];
}

export function ratingLabel(rating: ResearchRating): string {
  const map: Record<ResearchRating, string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  };
  return map[rating];
}

export function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
