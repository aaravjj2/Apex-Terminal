/**
 * Automation Runs UI2 — v1.123
 * Lists automation runs with detail drawer showing steps timeline + logs.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { CheckCircle, XCircle, Clock, AlertTriangle, Copy, Play } from 'lucide-react';
import { wave1314Store, type RunLog } from '../stores/wave1314Store';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'running': return <Play className="w-4 h-4 text-blue-400" />;
    case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
    default: return <AlertTriangle className="w-4 h-4 text-neutral-400" />;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-green-950/30 border-green-900/50 text-green-400',
    failed: 'bg-red-950/30 border-red-900/50 text-red-400',
    running: 'bg-blue-950/30 border-blue-900/50 text-blue-400',
    pending: 'bg-yellow-950/30 border-yellow-900/50 text-yellow-400',
  };
  return map[status] ?? 'bg-neutral-800 border-neutral-700 text-neutral-400';
}

function formatTs(iso: string) {
  return iso.replace('T', ' ').replace('Z', '').slice(0, 19);
}

export function AutomationRunsUI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const runs = wave1314Store.getRuns();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logCopied, setLogCopied] = useState(false);
  const selected = selectedId ? wave1314Store.getRun(selectedId) : null;

  const copyLogs = (logs: RunLog[]) => {
    navigator.clipboard.writeText(logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n'));
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full" data-testid="ui2-automation-runs-page" data-ready="true">
      <PageHeader
        title="Automation Runs"
        subtitle={`${runs.length} runs`}
        testId="ui2-automation-runs-header"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Runs list */}
        <div className="flex-1 overflow-auto p-4 space-y-2" data-testid="ui2-automation-runs-list">
          {runs.map((run) => (
            <button
              key={run.run_id}
              onClick={() => setSelectedId(run.run_id)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                selectedId === run.run_id
                  ? 'bg-neutral-800 border-blue-600'
                  : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800/70'
              }`}
              data-testid={`ui2-automation-run-row-${run.run_id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StatusIcon status={run.status} />
                  <span className="text-sm font-semibold text-neutral-100">{run.workflow_name}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadge(run.status)}`}>
                  {run.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span className="font-mono">{run.run_id}</span>
                <span>{formatTs(run.started_at)}</span>
                {run.duration_ms != null && <span>{run.duration_ms}ms</span>}
                <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400">{run.trigger_type}</span>
              </div>
            </button>
          ))}
          {runs.length === 0 && (
            <div className="text-center text-neutral-500 py-12" data-testid="ui2-automation-runs-empty">
              No automation runs yet
            </div>
          )}
        </div>

        {/* Detail drawer */}
        <div
          className={`w-96 border-l border-neutral-800 bg-neutral-950 overflow-auto transition-all ${
            selected ? 'translate-x-0' : 'translate-x-full w-0 border-0'
          }`}
          data-testid="ui2-automation-run-detail"
        >
          {selected && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-100">{selected.workflow_name}</h3>
                <button onClick={() => setSelectedId(null)} className="text-neutral-500 hover:text-neutral-300">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-neutral-500">Run ID</span><div className="font-mono text-neutral-200">{selected.run_id}</div></div>
                <div><span className="text-neutral-500">Status</span><div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${statusBadge(selected.status)}`}><StatusIcon status={selected.status} />{selected.status}</div></div>
                <div><span className="text-neutral-500">Started</span><div className="font-mono text-neutral-200 text-xs">{formatTs(selected.started_at)}</div></div>
                <div><span className="text-neutral-500">Duration</span><div className="font-mono text-neutral-200">{selected.duration_ms ?? '—'}ms</div></div>
              </div>

              {/* Steps timeline */}
              <div>
                <h4 className="text-sm font-medium text-neutral-400 mb-2">Steps</h4>
                <div className="space-y-2" data-testid="ui2-automation-run-steps">
                  {selected.steps.map((step) => (
                    <div key={step.step_id} className="flex items-start gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded">
                      <StatusIcon status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-neutral-200">{step.action_type}</div>
                        <div className="text-xs text-neutral-500 font-mono">{step.step_id}</div>
                        {Object.keys(step.output).length > 0 && (
                          <pre className="text-xs text-neutral-400 mt-1 bg-neutral-950 rounded px-2 py-1 overflow-x-auto">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-neutral-400">Logs</h4>
                  <button
                    onClick={() => copyLogs(selected.logs)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
                    data-testid="ui2-automation-run-copy-logs"
                  >
                    {logCopied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {logCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-auto" data-testid="ui2-automation-run-logs">
                  {selected.logs.map((log, i) => {
                    const levelColor: Record<string, string> = {
                      info: 'text-blue-400', warning: 'text-yellow-400', error: 'text-red-400', debug: 'text-neutral-500',
                    };
                    return (
                      <div key={i} className="flex gap-2 text-xs font-mono">
                        <span className="text-neutral-600 shrink-0">{log.timestamp.slice(11, 19)}</span>
                        <span className={`shrink-0 uppercase w-12 ${levelColor[log.level] ?? 'text-neutral-400'}`}>{log.level}</span>
                        <span className="text-neutral-300">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
