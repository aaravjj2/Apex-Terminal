/**
 * RunStatusHeader — v1.8 Industrial UI component.
 * Shows run_id, config hash, status, last run time, cache hit indicator.
 */

import type { RiskRunResult } from './types';

interface RunStatusHeaderProps {
  result: RiskRunResult | null;
  runState: 'idle' | 'running' | 'done';
}

export function RunStatusHeader({ result, runState }: RunStatusHeaderProps) {
  if (runState === 'idle' || !result) return null;

  const statusColor = result.ok
    ? 'bg-green-900/20 border-green-700 text-green-400'
    : 'bg-red-900/20 border-red-700 text-red-400';

  const cacheHits = result.tool_trace?.filter(t => t.cache_hit).length ?? 0;
  const totalTools = result.tool_trace?.length ?? 0;

  return (
    <div
      className="flex items-center justify-between p-2 rounded border text-xs mb-3"
      style={{ minHeight: 36 }}
      data-testid="run-status-header"
      role="status"
      aria-live="polite"
      aria-label={`Run ${result.run_id} ${result.ok ? 'completed successfully' : 'failed'}`}
    >
      <div className={`flex items-center gap-3 px-2 py-1 rounded ${statusColor}`}>
        <span className="font-mono font-medium" data-testid="run-status-run-id">
          {result.run_id}
        </span>
        <span className="opacity-75" data-testid="run-status-badge">
          {result.ok ? '✓ OK' : '✗ Failed'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-text-secondary">
        {result.config_hash && (
          <span title="Config hash" data-testid="run-status-config-hash">
            <span className="opacity-60">Hash:</span>{' '}
            <span className="font-mono">{result.config_hash.slice(0, 8)}</span>
          </span>
        )}

        {result.created_at && (
          <span title="Last run time" data-testid="run-status-time">
            {new Date(result.created_at).toLocaleTimeString()}
          </span>
        )}

        {cacheHits > 0 && (
          <span
            className="text-yellow-400"
            title={`${cacheHits}/${totalTools} tools served from cache`}
            data-testid="run-status-cache"
          >
            ⚡ {cacheHits}/{totalTools} cached
          </span>
        )}
      </div>
    </div>
  );
}
