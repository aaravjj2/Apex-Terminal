/**
 * v1.40 — Agents Panel
 * DEMO-first multi-step agent runner UI.
 */
import { useState, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { CitationsPanel, type CitationItem } from '../shared/CitationsPanel';

interface AgentStep {
  step_id: string;
  tool: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  citations: string[];
  duration_ms: number;
}

interface AgentRun {
  run_id: string;
  status: string;
  query: string;
  steps: AgentStep[];
  final_output: string;
  total_duration_ms: number;
}

const toolColors: Record<string, string> = {
  search: 'bg-blue-500/20 text-blue-400',
  backtest: 'bg-purple-500/20 text-purple-400',
  risk_analysis: 'bg-red-500/20 text-red-400',
  citations: 'bg-green-500/20 text-green-400',
  synthesize: 'bg-yellow-500/20 text-yellow-400',
};

export function AgentsPanel() {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [allCitations, setAllCitations] = useState<CitationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const executeAgent = useCallback(async () => {
    setLoading(true);
    try {
      const [runRes, citRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/agents/run`, { method: 'POST' }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/citations/`).then(r => r.json()),
      ]);
      setRun(runRes);
      setAllCitations(Array.isArray(citRes) ? citRes : []);
    } catch {
      setRun(null);
      setAllCitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div data-testid="agents-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text">Agent Runner</h2>
          <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.40 — DEMO</span>
        </div>
        <button
          data-testid="agent-run-btn"
          onClick={executeAgent}
          disabled={loading}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {loading && (
          <div data-testid="agents-loading" className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-element-bg/50 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !run && (
          <div data-testid="agents-empty" className="text-center py-12 text-text-muted">
            <p className="text-sm mb-2">No agent runs yet</p>
            <p className="text-xs">Click "Run Agent" to execute a multi-step analysis</p>
          </div>
        )}

        {!loading && run && (
          <>
            {/* Run header */}
            <div className="p-3 rounded-lg border border-border bg-panel-bg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-text-muted">{run.run_id}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  run.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {run.status}
                </span>
                <span className="text-xs text-text-muted ml-auto">{run.total_duration_ms}ms</span>
              </div>
              <p className="text-sm text-text">{run.query}</p>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text">Steps ({run.steps.length})</h3>
              {run.steps.map((step, idx) => (
                <div
                  key={step.step_id}
                  data-testid={`agent-step-${idx}`}
                  className="p-3 rounded-lg border border-border/50 bg-element-bg/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-text-muted">{step.step_id}</span>
                    <span
                      data-testid={`agent-tool-${idx}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${toolColors[step.tool] || 'bg-gray-500/20 text-gray-400'}`}
                    >
                      {step.tool}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">{step.duration_ms}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-muted">Inputs:</span>
                      <pre className="mt-0.5 text-text-secondary bg-background/50 rounded p-1 overflow-x-auto text-[10px]">
                        {JSON.stringify(step.inputs, null, 1)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-text-muted">Outputs:</span>
                      <pre className="mt-0.5 text-text-secondary bg-background/50 rounded p-1 overflow-x-auto text-[10px]">
                        {JSON.stringify(step.outputs, null, 1)}
                      </pre>
                    </div>
                  </div>
                  {step.citations.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {step.citations.map(c => (
                        <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-brand/10 text-brand font-mono">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Final output */}
            <div data-testid="agent-final-output" className="p-3 rounded-lg border border-brand/30 bg-brand/5">
              <h3 className="text-sm font-semibold text-brand mb-1">Final Output</h3>
              <p className="text-sm text-text">{run.final_output}</p>
            </div>

            {/* Citations */}
            {allCitations.length > 0 && (
              <CitationsPanel citations={allCitations} maxVisible={4} />
            )}
          </>
        )}
      </div>

      {/* Ready marker */}
      <div data-testid="agents-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
