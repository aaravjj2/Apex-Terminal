/**
 * Strategy Artifacts Panel (v1.28 + v1.31)
 * Displays strategy artifacts with deterministic content-hash IDs.
 * v1.31: "Run Backtest" button per artifact row.
 * All elements have data-testid selectors.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FlaskConical } from 'lucide-react';
import type { StrategyArtifact } from './artifactTypes';
import { useAppStore } from '../../../state/appStore';

import { API_BASE as ROOT_URL } from '../../../config/api';

const API_BASE = `${ROOT_URL}/api/v1/strategy-artifacts`;

interface Props {
  onArtifactsLoaded?: (artifacts: StrategyArtifact[]) => void;
}

export function StrategyArtifactsPanel({ onArtifactsLoaded }: Props) {
  const [artifacts, setArtifacts] = useState<StrategyArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPendingStrategyArtifactId = useAppStore((s) => s.setPendingStrategyArtifactId);

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StrategyArtifact[] = await res.json();
      setArtifacts(data);
      onArtifactsLoaded?.(data);
    } catch (e) {
      // Demo fallback artifacts when API unavailable
      const demoArtifacts: StrategyArtifact[] = [
        {
          schema_version: 1,
          id: 'demo-artifact-001',
          checksum: 'sha256-demo-001',
          name: 'Momentum Crossover v1',
          type: 'crossover',
          version: '1.0.0',
          spec: { entry_rule: 'SMA(20) > SMA(50)', exit_rule: 'SMA(20) < SMA(50)', stop_loss: 0.02 },
          created_at: new Date().toISOString(),
        },
        {
          schema_version: 1,
          id: 'demo-artifact-002',
          checksum: 'sha256-demo-002',
          name: 'Mean Reversion RSI',
          type: 'mean_reversion',
          version: '1.0.0',
          spec: { entry_rule: 'RSI(14) < 30', exit_rule: 'RSI(14) > 70', stop_loss: 0.03 },
          created_at: new Date().toISOString(),
        },
      ];
      setArtifacts(demoArtifacts);
      onArtifactsLoaded?.(demoArtifacts);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [onArtifactsLoaded]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const handleRunBacktest = (artifactId: string) => {
    setPendingStrategyArtifactId(artifactId);
    // Dispatch event so Shell can switch to backtest view
    window.dispatchEvent(new CustomEvent('navigate-to-backtest', { detail: { artifactId } }));
  };

  return (
    <div data-testid="strategy-artifacts-panel" className="bg-panel-bg border border-border rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-element-bg">
        <h3 className="text-sm font-semibold text-text">Strategy Artifacts</h3>
        <button
          onClick={fetchArtifacts}
          data-testid="strategy-artifacts-refresh"
          className="p-1.5 hover:bg-border rounded text-text-secondary hover:text-text transition-colors"
          title="Refresh artifacts"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-element-bg/50 border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Version</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Checksum</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary text-xs">
                  No artifacts found.
                </td>
              </tr>
            )}
            {artifacts.map((artifact) => (
              <tr
                key={artifact.id}
                data-testid={`strategy-artifact-row-${artifact.id}`}
                className="border-b border-border/50 hover:bg-element-bg/30 transition-colors"
              >
                <td className="px-4 py-2">
                  <span
                    data-testid={`strategy-artifact-id-${artifact.id}`}
                    className="text-xs font-mono text-brand"
                    title={artifact.id}
                  >
                    {artifact.id.substring(0, 12)}…
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    data-testid={`strategy-artifact-name-${artifact.id}`}
                    className="text-text"
                  >
                    {artifact.name}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    data-testid={`strategy-artifact-type-${artifact.id}`}
                    className="text-text-secondary"
                  >
                    {artifact.type}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    data-testid={`strategy-artifact-version-${artifact.id}`}
                    className="text-text-secondary"
                  >
                    {artifact.version}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    data-testid={`strategy-artifact-checksum-${artifact.id}`}
                    className="text-xs font-mono text-text-muted"
                    title={artifact.checksum}
                  >
                    {artifact.checksum.substring(0, 12)}…
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleRunBacktest(artifact.id)}
                    data-testid="strategy-run-backtest"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-brand/10 text-brand hover:bg-brand/20 rounded transition-colors"
                    title="Run backtest with this artifact"
                  >
                    <FlaskConical size={12} />
                    Run Backtest
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
