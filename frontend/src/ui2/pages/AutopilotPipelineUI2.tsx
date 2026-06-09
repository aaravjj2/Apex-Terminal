/**
 * Complete autopilot pipeline — vendor L0–L4 + TCC handshake + arb radar.
 */
import { ArbTracker } from '@/arb/components/ArbTracker';
import { useAutopilotPipeline } from '@/arb/hooks/useAutopilotPipeline';
import { HITLReview } from '@/tcc/components/hitl/HITLReview';
import { cn } from '@/tcc/lib/cn';

import '@/tcc/styles/hitl.css';
import '@/tcc/styles/shadcn.css';

const LAYER_ORDER = [
  'L0_ingestion',
  'L1_brain',
  'L2_agents',
  'L3_execution',
  'L4_observability',
] as const;

const LAYER_LABELS: Record<string, string> = {
  L0_ingestion: 'L0 Ingest',
  L1_brain: 'L1 Brain',
  L2_agents: 'L2 Agents',
  L3_execution: 'L3 Execute',
  L4_observability: 'L4 Audit',
};

function layerClass(status: string) {
  if (status === 'ok') return 'pipe-layer--ok';
  if (status === 'warn' || status === 'idle') return 'pipe-layer--warn';
  return 'pipe-layer--bad';
}

export default function AutopilotPipelineUI2() {
  const jobId =
    (import.meta.env.VITE_PIPELINE_JOB_ID as string | undefined) ?? 'dry-run-apex-command-center';
  const pipe = useAutopilotPipeline();

  return (
    <div data-testid="autopilot-pipeline-page" className="pipe-shell">
      <header className="pipe-header">
        <div>
          <h1 className="pipe-title">Autopilot Pipeline</h1>
          <p className="pipe-sub">
            Kalshi × Polymarket arb · TCC oracles · paper execution
            {pipe.status?.demo_mode ? ' · demo' : ''}
          </p>
        </div>
        <div className="pipe-actions">
          <a href="/ui2/research-agent" className="hitl-btn hitl-btn--sm" data-testid="pipe-link-research">
            Research Agent
          </a>
          <button
            type="button"
            className="hitl-btn hitl-btn--sm"
            disabled={!!pipe.busy}
            onClick={() => pipe.scanArb()}
            data-testid="pipe-scan-arb"
          >
            {pipe.busy === 'scan' ? 'Scanning…' : 'Scan Arb'}
          </button>
          <button
            type="button"
            className="hitl-btn hitl-btn--sm"
            disabled={!!pipe.busy}
            onClick={() => pipe.runPmAgents()}
            data-testid="pipe-run-agents"
          >
            {pipe.busy === 'agents' ? 'Running…' : 'PM Agents'}
          </button>
          <button
            type="button"
            className="hitl-btn hitl-btn--sm"
            disabled={!!pipe.busy}
            onClick={() => pipe.runAgentMission('morning_arb_briefing')}
            data-testid="pipe-morning-briefing"
          >
            Briefing
          </button>
        </div>
      </header>

      <section className="pipe-layers" data-testid="pipe-layers" aria-label="Pipeline layers">
        {LAYER_ORDER.map((key) => {
          const layer = pipe.status?.layers?.[key];
          return (
            <div key={key} className={cn('pipe-layer', layer ? layerClass(layer.status) : '')}>
              <span className="pipe-layer__name">{LAYER_LABELS[key]}</span>
              <span className="pipe-layer__status">{layer?.status ?? '…'}</span>
              <span className="pipe-layer__detail">{layer?.detail ?? 'Loading'}</span>
            </div>
          );
        })}
        {pipe.status ? (
          <div className="pipe-layer pipe-layer--meta">
            <span className="pipe-layer__name">Arbs</span>
            <span className="pipe-layer__status">{pipe.status.active_arbs}</span>
            <span className="pipe-layer__detail">
              max {(pipe.status.max_net_edge * 100).toFixed(1)}% · scan #{pipe.status.loops.arb_scan_seq}
            </span>
          </div>
        ) : null}
      </section>

      {pipe.error ? (
        <div className="hitl-invalidation" data-testid="pipe-error">
          {pipe.error}
        </div>
      ) : null}

      <div className="pipe-body">
        <div className="pipe-main">
          <ArbTracker />
        </div>
        <aside className="pipe-audit" aria-label="Audit log" data-testid="pipe-audit">
          <div className="pipe-audit__title">Audit trail</div>
          <ul className="pipe-audit__list">
            {pipe.events.length === 0 ? (
              <li className="pipe-audit__empty">No events yet</li>
            ) : (
              pipe.events.slice(0, 20).map((ev, i) => (
                <li key={`${ev.timestamp}-${i}`}>
                  <span className="pipe-audit__ts">
                    {(ev.timestamp ?? '').slice(11, 19) || '—'}
                  </span>{' '}
                  <span className="pipe-audit__type">{ev.event_type ?? 'event'}</span>
                  {ev.symbol ? ` · ${ev.symbol}` : ''}
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>

      <section className="pipe-hitl" aria-label="HITL review">
        <HITLReview jobId={jobId} />
      </section>
    </div>
  );
}
