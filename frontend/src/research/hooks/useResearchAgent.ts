import { useCallback, useEffect, useState } from 'react';

import type {
  ResearchAgentStatus,
  ResearchHandshakeResult,
  ResearchNewsArticle,
  TradePlanPayload,
} from '@/research/types/tradePlan';

export interface ResearchRunInput {
  osi_symbol?: string;
  occ_symbol?: string;
  news_text?: string;
  event_type?: string;
  market_mid?: number;
  fetch_news?: boolean;
}

export function useResearchAgent() {
  const [status, setStatus] = useState<ResearchAgentStatus | null>(null);
  const [plan, setPlan] = useState<TradePlanPayload | null>(null);
  const [handshake, setHandshake] = useState<ResearchHandshakeResult | null>(null);
  const [newsPreview, setNewsPreview] = useState<ResearchNewsArticle[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/research/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const fetchNews = useCallback(async (symbol: string) => {
    setBusy(true);
    setError(null);
    try {
      const sym = symbol.trim().split(/\s+/)[0] || 'SPY';
      const res = await fetch(`/api/v1/research/news/${encodeURIComponent(sym)}?limit=6`);
      const body = await res.json();
      if (!res.ok) throw new Error((body as { detail?: string }).detail || res.statusText);
      const articles = (body as { articles?: ResearchNewsArticle[] }).articles ?? [];
      setNewsPreview(articles);
      if (articles[0]) {
        const top = articles[0];
        const text = top.summary ? `${top.headline}. ${top.summary}` : top.headline;
        return text;
      }
      return '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'News fetch failed';
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const run = useCallback(async (input: ResearchRunInput) => {
    setBusy(true);
    setError(null);
    setHandshake(null);
    try {
      const res = await fetch('/api/v1/research/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error((body as { detail?: string }).detail || res.statusText);
      setPlan(body as TradePlanPayload);
      return body as TradePlanPayload;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Research run failed';
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const runDemo = useCallback(async () => {
    setBusy(true);
    setError(null);
    setHandshake(null);
    try {
      const res = await fetch('/api/v1/research/demo');
      const body = await res.json();
      if (!res.ok) throw new Error((body as { detail?: string }).detail || res.statusText);
      setPlan(body as TradePlanPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const submitHandshake = useCallback(async (tradePlan?: TradePlanPayload) => {
    const payload = tradePlan ?? plan;
    if (!payload) {
      setError('Run pipeline first');
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/research/handshake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_plan: payload, dry_run: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error((body as { detail?: string }).detail || res.statusText);
      setHandshake(body as ResearchHandshakeResult);
      if (body.trade_plan) setPlan(body.trade_plan as TradePlanPayload);
      return body as ResearchHandshakeResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Handshake failed';
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [plan]);

  return {
    status,
    plan,
    handshake,
    newsPreview,
    busy,
    error,
    run,
    runDemo,
    fetchNews,
    submitHandshake,
    refreshStatus,
  };
}
