/**
 * Strategy Validation Panel (v1.29)
 * Displays deterministic validation results grouped by errors/warnings.
 * All elements have data-testid selectors.
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import type { ValidationReport, ValidationIssue } from './artifactTypes';
import { API_BASE } from '../../../config/api';

interface ValidationPanelProps {
  /** Current strategy spec to validate */
  specInput?: {
    name?: string;
    type?: string;
    spec?: Record<string, unknown>;
    version?: string;
    schema_version?: number;
  };
}

export function StrategyValidationPanel({ specInput }: ValidationPanelProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidation = useCallback(async () => {
    if (!specInput) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/strategy-artifacts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specInput),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ValidationReport = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [specInput]);

  return (
    <div data-testid="strategy-validation-panel" className="bg-panel-bg border border-border rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-element-bg">
        <h3 className="text-sm font-semibold text-text">Validation Results</h3>
        <button
          onClick={runValidation}
          data-testid="strategy-validation-run"
          disabled={loading}
          className="px-3 py-1 text-xs font-medium bg-brand hover:bg-brand/90 text-white rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Validating…' : 'Run Validation'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-2">
            {report.valid ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <XCircle size={16} className="text-red-400" />
            )}
            <span className={`text-sm font-medium ${report.valid ? 'text-green-400' : 'text-red-400'}`}>
              {report.valid ? 'Valid' : 'Invalid'}
            </span>
            <span className="text-xs text-text-muted ml-2">
              {report.errors.length} error{report.errors.length !== 1 ? 's' : ''}, {report.warnings.length} warning{report.warnings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Errors Group */}
          <div data-testid="strategy-validation-errors">
            <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <XCircle size={12} /> Errors ({report.errors.length})
            </h4>
            {report.errors.length === 0 ? (
              <p className="text-xs text-text-muted pl-4">No errors</p>
            ) : (
              <ul className="space-y-1">
                {report.errors.map((issue: ValidationIssue, idx: number) => (
                  <li
                    key={`error-${issue.rule_id}-${idx}`}
                    data-testid={`strategy-validation-issue-${issue.rule_id}-${idx}`}
                    className="flex items-start gap-2 px-3 py-2 bg-red-500/10 rounded text-xs"
                  >
                    <span className="font-mono text-red-300 shrink-0">{issue.rule_id}</span>
                    <span className="text-text">{issue.message}</span>
                    <span className="text-text-muted ml-auto shrink-0">{issue.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Warnings Group */}
          <div data-testid="strategy-validation-warnings">
            <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle size={12} /> Warnings ({report.warnings.length})
            </h4>
            {report.warnings.length === 0 ? (
              <p className="text-xs text-text-muted pl-4">No warnings</p>
            ) : (
              <ul className="space-y-1">
                {report.warnings.map((issue: ValidationIssue, idx: number) => (
                  <li
                    key={`warning-${issue.rule_id}-${idx}`}
                    data-testid={`strategy-validation-issue-${issue.rule_id}-${idx}`}
                    className="flex items-start gap-2 px-3 py-2 bg-yellow-500/10 rounded text-xs"
                  >
                    <span className="font-mono text-yellow-300 shrink-0">{issue.rule_id}</span>
                    <span className="text-text">{issue.message}</span>
                    <span className="text-text-muted ml-auto shrink-0">{issue.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !error && (
        <div className="px-4 py-6 text-center text-xs text-text-muted">
          Click &quot;Run Validation&quot; to validate the current strategy.
        </div>
      )}
    </div>
  );
}
