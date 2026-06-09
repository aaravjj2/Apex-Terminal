import { useCallback, useEffect, useState } from 'react';

export interface PipelineLayer {
  status: string;
  detail: string;
}

export interface PipelineStatus {
  timestamp: string;
  demo_mode: boolean;
  paper_only: boolean;
  active_arbs: number;
  max_net_edge: number;
  loops: { arb_scan_loop: boolean; arb_scan_seq: number };
  layers: Record<string, PipelineLayer>;
}

export interface AuditEvent {
  event_type?: string;
  symbol?: string;
  timestamp?: string;
  message?: string;
  raw_payload?: Record<string, unknown>;
}

export function useAutopilotPipeline(pollMs = 10_000) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [stRes, evRes] = await Promise.all([
        fetch('/api/autopilot/pipeline/status'),
        fetch('/api/events?limit=30'),
      ]);
      if (stRes.ok) {
        const ct = stRes.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) setStatus(await stRes.json());
      }
      if (evRes.ok) {
        const ct = evRes.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) setEvents(await evRes.json());
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline fetch failed');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const runAction = useCallback(
    async (label: string, url: string, method = 'POST') => {
      setBusy(label);
      setError(null);
      try {
        const res = await fetch(url, { method });
        const body = (await res.json().catch(() => ({}))) as {
          detail?: string;
          status?: string;
        };
        if (!res.ok) {
          throw new Error(body.detail || res.statusText);
        }
        if (body.status === 'error') {
          throw new Error(body.detail || 'Autopilot action failed');
        }
        await refresh();
        return body;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Autopilot action failed';
        setError(msg);
        throw err;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  return {
    status,
    events,
    busy,
    error,
    refresh,
    scanArb: () => runAction('scan', '/api/arb/scan'),
    runPmAgents: () => runAction('agents', '/api/pm/agents/run'),
    runTccCycle: () =>
      runAction('tcc', '/api/v1/pipeline/run-cycle', 'POST'),
    runAgentMission: (missionId: string) =>
      runAction('mission', `/api/agent/run/${missionId}`),
  };
}
