/**
 * sentimentApi.ts
 * API client for Social Sentiment Analysis endpoints.
 * Fear & Greed, mention spikes, WallStreetBets analysis, momentum, and controversy alerts.
 */

import { useState, useCallback, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SENTIMENT_BASE = `${BASE_URL}/api/social-sentiment`;

export class SentimentApiError extends Error {
  constructor(public statusCode: number, public detail: string, public endpoint: string) {
    super(`SentimentAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'SentimentApiError';
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...init.headers }, ...init });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new SentimentApiError(r.status, e.detail ?? r.statusText, url);
  }
  return r.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${SENTIMENT_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

const get = <T>(path: string) => apiFetch<T>(`${SENTIMENT_BASE}${path}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SentimentLabel = 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
export type FearGreedLabel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
export type MomentumDirection = 'accelerating_bullish' | 'steady_bullish' | 'reversing' | 'accelerating_bearish';

export interface TextContent {
  text: string;
  source?: string;
  timestamp?: string;
  author?: string;
  upvotes?: number;
}

export interface BulkTextRequest {
  texts: TextContent[];
  symbol?: string;
}

export interface TextSentimentResult {
  score: number;              // -1 to +1
  label: SentimentLabel;
  confidence: number;
  keyword_hits: string[];
  is_actionable: boolean;
}

export interface BulkSentimentResult {
  results: TextSentimentResult[];
  aggregate_score: number;
  aggregate_label: SentimentLabel;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  total_analyzed: number;
  most_bullish_text?: string;
  most_bearish_text?: string;
}

export interface MentionVolumeRequest {
  symbol: string;
  hourly_counts: number[];    // 24 or 168 values (hours)
  dates?: string[];
  baseline_count?: number;
}

export interface VolumeSpike {
  timestamp?: string;
  hour_index: number;
  count: number;
  spike_multiplier: number;  // e.g. 8.5 = 8.5x above baseline
  is_significant: boolean;
}

export interface MentionVolumeResult {
  symbol: string;
  total_mentions: number;
  average_hourly: number;
  peak_hour_count: number;
  spikes: VolumeSpike[];
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
  z_score: number;
  is_trending: boolean;
}

export interface FearGreedRequest {
  put_call_ratio?: number;            // default 1.0
  vix_level?: number;                 // default 20
  market_breadth_pct?: number;        // 0-1
  junk_bond_demand?: number;          // spread bps
  market_momentum_pct?: number;       // SPX vs 125-day MA %
  safe_haven_demand?: number;         // 0-1 (Treasuries vs stocks flow)
  stock_price_breadth?: number;       // McClellan Oscillator normalized
}

export interface FearGreedResult {
  score: number;                 // 0=extreme fear, 100=extreme greed
  label: FearGreedLabel;
  components: {
    put_call_ratio: number;
    vix: number;
    breadth: number;
    junk_bonds: number;
    momentum: number;
    safe_haven: number;
  };
  previous_week?: number;
  previous_month?: number;
  trend: 'improving' | 'deteriorating' | 'stable';
}

export interface WSBRequest {
  posts: Array<{
    title: string;
    body?: string;
    upvotes: number;
    comments: number;
    timestamp: string;
    author?: string;
  }>;
  symbol?: string;
}

export interface WSBPostAnalysis {
  title: string;
  sentiment: SentimentLabel;
  sentiment_score: number;
  estimated_reach: number;
  has_position_disclosure: boolean;
  position_type?: 'long' | 'short' | 'options' | null;
  mentions_leverage: boolean;
  meme_score: number;           // 0-1
  is_dd: boolean;               // Due Diligence flagged
  is_loss_porn: boolean;
}

export interface WSBAnalysisResult {
  symbol?: string;
  total_posts: number;
  aggregate_sentiment: SentimentLabel;
  aggregate_score: number;
  estimated_total_reach: number;
  dd_posts: number;
  meme_ratio: number;
  has_gamma_squeeze_signal: boolean;
  has_short_squeeze_signal: boolean;
  bullish_momentum_score: number;
  post_analyses: WSBPostAnalysis[];
  risk_level: 'low' | 'elevated' | 'high' | 'extreme';
}

export interface SentimentMomentumRequest {
  symbol: string;
  daily_scores: number[];     // recent daily composite scores — last N days
  volume_ratios?: number[];   // mention volume vs baseline
  lookback_days?: number;
}

export interface SentimentMomentumResult {
  symbol: string;
  momentum_direction: MomentumDirection;
  momentum_score: number;     // -1 to +1
  acceleration: number;
  signal_strength: 'weak' | 'moderate' | 'strong';
  days_to_peak?: number;
  reversal_probability: number;
  actionable: boolean;
}

export interface ControversyRequest {
  symbol: string;
  posts: TextContent[];
  volume_spike_multiplier?: number;
}

export interface ControversyAlert {
  symbol: string;
  alert_type: 'volume_spike' | 'sentiment_flip' | 'coordinated' | 'influencer' | 'news_driven';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  affected_posts_count: number;
  recommended_action: string;
}

export interface FullSentimentDashboard {
  fear_greed: FearGreedResult;
  top_mentions: Array<{
    symbol: string;
    mentions_24h: number;
    sentiment: SentimentLabel;
    score: number;
    trending: boolean;
    volume_change_pct: number;
  }>;
  spike_alerts: Array<{
    symbol: string;
    spike_multiplier: number;
    mentions_1h: number;
    sentiment: SentimentLabel;
    timestamp: string;
  }>;
  wsb_movers: Array<{
    symbol: string;
    wsb_score: number;
    gamma_squeeze_risk: boolean;
    short_squeeze_risk: boolean;
  }>;
  momentum_leaders: SentimentMomentumResult[];
  controversy_alerts: ControversyAlert[];
  market_sentiment_score: number;
  timestamp: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const getSentimentCapabilities = () =>
  get<{ endpoints: string[]; models: string[] }>('/capabilities');

export const analyzeSingleText = (req: { text: string; symbol?: string }) =>
  post<TextSentimentResult>('/text/analyze', req);

export const analyzeBulkTexts = (req: BulkTextRequest) =>
  post<BulkSentimentResult>('/text/bulk', req);

export const analyzeMentionVolume = (req: MentionVolumeRequest) =>
  post<MentionVolumeResult>('/mentions/volume', req);

export const getFearGreedIndex = (req: FearGreedRequest) =>
  post<FearGreedResult>('/fear-greed', req);

export const analyzeWSB = (req: WSBRequest) =>
  post<WSBAnalysisResult>('/wsb/analyze', req);

export const getSentimentMomentum = (req: SentimentMomentumRequest) =>
  post<SentimentMomentumResult>('/momentum', req);

export const detectControversy = (req: ControversyRequest) =>
  post<ControversyAlert[]>('/controversy/detect', req);

export const getFullSentimentDashboard = (req: {
  symbols: string[];
  include_wsb?: boolean;
  include_fear_greed?: boolean;
}) => post<FullSentimentDashboard>('/dashboard', req);

export const getTopMentions = (params: { limit?: number; timeframe?: '1h' | '4h' | '24h' }) => {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.timeframe) q.set('timeframe', params.timeframe);
  return get<FullSentimentDashboard['top_mentions']>(`/mentions/top?${q}`);
};

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fearGreedColor(score: number): string {
  if (score <= 20) return '#ff4444';
  if (score <= 40) return '#ff9900';
  if (score <= 60) return '#ffcc00';
  if (score <= 80) return '#00d4aa';
  return '#00ff9d';
}

export function fearGreedLabel(score: number): FearGreedLabel {
  if (score <= 20) return 'extreme_fear';
  if (score <= 40) return 'fear';
  if (score <= 60) return 'neutral';
  if (score <= 80) return 'greed';
  return 'extreme_greed';
}

export function fearGreedDisplayLabel(label: FearGreedLabel): string {
  const labels: Record<FearGreedLabel, string> = {
    extreme_fear: 'Extreme Fear',
    fear: 'Fear',
    neutral: 'Neutral',
    greed: 'Greed',
    extreme_greed: 'Extreme Greed',
  };
  return labels[label];
}

export function sentimentColor(label: SentimentLabel): string {
  switch (label) {
    case 'very_bullish': return '#00ff9d';
    case 'bullish': return '#00d4aa';
    case 'neutral': return '#888';
    case 'bearish': return '#ff9900';
    case 'very_bearish': return '#ff4444';
  }
}

export function formatMentionCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useFearGreed(req: FearGreedRequest | null, refreshMs = 60000) {
  const [data, setData] = useState<FearGreedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await getFearGreedIndex(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useFullSentimentDashboard(
  symbols: string[],
  refreshMs = 30000,
) {
  const [data, setData] = useState<FullSentimentDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!symbols.length) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getFullSentimentDashboard({ symbols, include_wsb: true, include_fear_greed: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(symbols)]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useWSBAnalysis(req: WSBRequest | null) {
  const [data, setData] = useState<WSBAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await analyzeWSB(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
