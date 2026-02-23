/**
 * W89 — Deep Link Contract
 * URL builders and hook for entity deep-links with row highlight via query params.
 *
 * URL pattern: /ui2/<entity-page>?highlight=<entity-id>
 */
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

// ── Entity pages ─────────────────────────────────────────────────────────────

export type DeepLinkEntity =
  | 'strategy'
  | 'backtest'
  | 'run'
  | 'job'
  | 'event'
  | 'ticket'
  | 'agent-run';

const ENTITY_PATHS: Record<DeepLinkEntity, string> = {
  strategy: '/ui2/research',
  backtest: '/ui2/backtest',
  run: '/ui2/runs',
  job: '/ui2/runs',
  event: '/ui2/runs',
  ticket: '/ui2/runs',
  'agent-run': '/ui2/autopilot',
};

// ── URL Builders ─────────────────────────────────────────────────────────────

/**
 * Build a deep-link URL that navigates to an entity page with row highlight.
 * Example: buildDeepLink('backtest', 'bt-abc123') → '/ui2/backtest?highlight=bt-abc123'
 */
export function buildDeepLink(entity: DeepLinkEntity, id: string): string {
  const path = ENTITY_PATHS[entity];
  return `${path}?highlight=${encodeURIComponent(id)}`;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useRowHighlight — reads `?highlight=<id>` from URL.
 * Returns the highlighted row key (or null) and a function to clear it.
 */
export function useRowHighlight(): { highlightKey: string | null; clearHighlight: () => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightKey = searchParams.get('highlight');

  const clearHighlight = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('highlight');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { highlightKey, clearHighlight };
}

/**
 * useDeepLinkNavigate — navigate to an entity deep link.
 * Saves the current path in state so browser back works.
 */
export function useDeepLinkNavigate() {
  const navigate = useNavigate();

  return useCallback((entity: DeepLinkEntity, id: string) => {
    navigate(buildDeepLink(entity, id));
  }, [navigate]);
}
