/**
 * BacktestStatusHeader — v1.8 Industrial UI component.
 * Shows run_id, config hash, status, last run time for backtest panel.
 */

interface BacktestStatusHeaderProps {
  runId?: string;
  configHash?: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  completedAt?: string;
}

export function BacktestStatusHeader({ runId, configHash, status, completedAt }: BacktestStatusHeaderProps) {
  if (status === 'idle' || !runId) return null;

  const statusColor = status === 'complete'
    ? 'bg-green-900/20 border-green-700 text-green-400'
    : status === 'error'
    ? 'bg-red-900/20 border-red-700 text-red-400'
    : 'bg-blue-900/20 border-blue-700 text-blue-400';

  const statusLabel = status === 'complete' ? '✓ Complete' : status === 'error' ? '✗ Failed' : '⏳ Running';

  return (
    <div
      className="flex items-center justify-between p-2 rounded border text-xs mb-3"
      style={{ minHeight: 36 }}
      data-testid="backtest-status-header"
      role="status"
      aria-live="polite"
      aria-label={`Backtest ${runId} ${statusLabel}`}
    >
      <div className={`flex items-center gap-3 px-2 py-1 rounded ${statusColor}`}>
        <span className="font-mono font-medium" data-testid="backtest-status-run-id">
          {runId}
        </span>
        <span className="opacity-75" data-testid="backtest-status-badge">
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-4 text-text-secondary">
        {configHash && (
          <span title="Config hash" data-testid="backtest-status-config-hash">
            <span className="opacity-60">Hash:</span>{' '}
            <span className="font-mono">{configHash.slice(0, 8)}</span>
          </span>
        )}

        {completedAt && (
          <span title="Completed at" data-testid="backtest-status-time">
            {new Date(completedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
