/**
 * Strategy Diff Panel (v1.30)
 * Side-by-side canonical JSON diff viewer with deterministic output.
 * All elements have data-testid selectors.
 */

import { useState, useEffect, useCallback } from 'react';
import { GitCompare, ChevronRight } from 'lucide-react';
import type { StrategyArtifact, DiffResult, LineageEntry } from './artifactTypes';

const API_BASE = '/api/v1/strategy-artifacts';

interface Props {
  artifacts: StrategyArtifact[];
}

export function StrategyDiffPanel({ artifacts: propArtifacts }: Props) {
  const [localArtifacts, setLocalArtifacts] = useState<StrategyArtifact[]>([]);
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [lineage, setLineage] = useState<LineageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const artifacts = propArtifacts.length > 0 ? propArtifacts : localArtifacts;

  // If no artifacts passed, fetch them ourselves
  useEffect(() => {
    if (propArtifacts.length === 0) {
      fetch(API_BASE)
        .then((r) => r.json())
        .then((data: StrategyArtifact[]) => setLocalArtifacts(data))
        .catch(() => setLocalArtifacts([]));
    }
  }, [propArtifacts]);

  // Auto-select first two artifacts
  useEffect(() => {
    if (artifacts.length >= 2 && !leftId && !rightId) {
      setLeftId(artifacts[0].id);
      setRightId(artifacts[1].id);
    }
  }, [artifacts, leftId, rightId]);

  const computeDiff = useCallback(async () => {
    if (!leftId || !rightId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ left_id: leftId, right_id: rightId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DiffResult = await res.json();
      setDiffResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute diff');
      setDiffResult(null);
    } finally {
      setLoading(false);
    }
  }, [leftId, rightId]);

  const fetchLineage = useCallback(async (artifactId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${artifactId}/lineage`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // API returns { artifact_id, lineage: [...] }
      setLineage(Array.isArray(data) ? data : (data.lineage || []));
    } catch {
      setLineage([]);
    }
  }, []);

  // Auto-compute diff when both selected
  useEffect(() => {
    if (leftId && rightId) {
      computeDiff();
      fetchLineage(rightId);
    }
  }, [leftId, rightId, computeDiff, fetchLineage]);

  const ready = diffResult !== null && !loading;

  return (
    <div data-testid="strategy-diff-panel" className="space-y-4">
      {/* Artifact selectors */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Left Artifact</label>
          <select
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            data-testid="strategy-diff-left-select"
            className="w-full px-3 py-2 bg-element-bg border border-border rounded text-sm text-text"
          >
            <option value="">Select...</option>
            {artifacts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.id.substring(0, 8)})</option>
            ))}
          </select>
        </div>
        <GitCompare size={20} className="text-text-secondary mb-2" />
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Right Artifact</label>
          <select
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            data-testid="strategy-diff-right-select"
            className="w-full px-3 py-2 bg-element-bg border border-border rounded text-sm text-text"
          >
            <option value="">Select...</option>
            {artifacts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.id.substring(0, 8)})</option>
            ))}
          </select>
        </div>
        <button
          onClick={computeDiff}
          disabled={!leftId || !rightId || loading}
          data-testid="strategy-diff-open"
          className="px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded text-sm font-medium"
        >
          {loading ? 'Computing...' : 'Compute Diff'}
        </button>
      </div>

      {error && (
        <div className="p-2 text-xs text-red-400 bg-red-500/10 rounded">{error}</div>
      )}

      {/* Ready marker for E2E */}
      {ready && <div data-testid="strategy-diff-ready" className="hidden" />}

      {/* Side-by-side canonical JSON */}
      {diffResult && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-panel-bg border border-border rounded p-3">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">
              Left: {diffResult.left_id.substring(0, 12)}
            </h4>
            <pre
              data-testid="strategy-diff-left-json"
              className="text-xs font-mono text-text overflow-auto max-h-96 bg-background p-2 rounded whitespace-pre-wrap"
            >
              {JSON.stringify(diffResult.left_canonical, null, 2)}
            </pre>
          </div>
          <div className="bg-panel-bg border border-border rounded p-3">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">
              Right: {diffResult.right_id.substring(0, 12)}
            </h4>
            <pre
              data-testid="strategy-diff-right-json"
              className="text-xs font-mono text-text overflow-auto max-h-96 bg-background p-2 rounded whitespace-pre-wrap"
            >
              {JSON.stringify(diffResult.right_canonical, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Changes list */}
      {diffResult && (
        <div className="bg-panel-bg border border-border rounded p-3">
          <h4 className="text-xs font-semibold text-text-secondary mb-2">
            Changes ({diffResult.changes.length})
          </h4>
          <div data-testid="strategy-diff-changes" className="space-y-1">
            {diffResult.changes.length === 0 ? (
              <p className="text-xs text-text-muted">No changes detected.</p>
            ) : (
              diffResult.changes.map((c, i) => (
                <div
                  key={i}
                  className={`text-xs font-mono px-2 py-1 rounded ${
                    c.op === 'added' ? 'bg-green-500/10 text-green-400' :
                    c.op === 'removed' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  <span className="font-bold">{c.op.toUpperCase()}</span>{' '}
                  <span>{c.path}</span>
                  {c.op === 'changed' && (
                    <span className="ml-2 text-text-muted">
                      {JSON.stringify(c.left_value)} → {JSON.stringify(c.right_value)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="mt-2 text-xs text-text-muted">
            Diff hash: <span className="font-mono">{diffResult.diff_hash?.substring(0, 16)}</span>
          </div>
        </div>
      )}

      {/* Lineage panel */}
      {lineage.length > 0 && (
        <div data-testid="strategy-lineage-panel" className="bg-panel-bg border border-border rounded p-3">
          <h4 className="text-xs font-semibold text-text-secondary mb-2">Version Lineage</h4>
          <div className="flex items-center gap-1 flex-wrap">
            {lineage.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-1">
                <div
                  data-testid={`strategy-lineage-item-${i}`}
                  className={`text-xs px-2 py-1 rounded border ${
                    entry.id === rightId
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-element-bg text-text-secondary'
                  }`}
                >
                  {entry.name} (d{entry.depth})
                </div>
                {i < lineage.length - 1 && (
                  <ChevronRight size={12} className="text-text-muted" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
