/**
 * Export UI2 - Terminal-grade export bundle V3 interface (Wave 12 v1.113)
 * 
 * Features:
 * - Export button trigger
 * - Progress indicator
 * - Success state with file summary (counts, hashes)
 * - Error state with clear message
 * - Full data-testid coverage
 */

import React, { useState } from 'react';
import { Download, CheckCircle, AlertCircle, FileArchive } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

type ExportState = 'idle' | 'loading' | 'success' | 'error';

interface ExportManifest {
  export_version: string;
  available: boolean;
  artifacts: {
    trading_state: { order_count: number; position_count: number };
    autopilot_decisions: { decision_count: number };
    automation_workflows: { workflow_count: number; run_count: number };
    telemetry_events: { event_count: number };
    search_metadata: { backend: string };
    platform_health: { status: string };
  };
  timestamp: string;
}

interface ExportResult {
  filename: string;
  size: number;
  artifacts: Record<string, unknown>;
}

export function ExportUI2() {
  const [state, setState] = useState<ExportState>('idle');
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    // Fetch manifest on mount
    fetchManifest();
  }, []);

  const fetchManifest = async () => {
    try {
      const response = await fetch('/api/v1/export/v3/manifest');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setManifest(data);
    } catch (err) {
      console.error('Failed to fetch export manifest:', err);
    }
  };

  const handleExport = async () => {
    setState('loading');
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/v1/export/v3/bundle');
      if (!response.ok) {
        throw new Error(`Export failed: HTTP ${response.status}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch ? filenameMatch[1] : 'apex-terminal-export-v3.zip';

      // Get blob
      const blob = await response.blob();

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Set success state
      setResult({
        filename,
        size: blob.size,
        artifacts: manifest?.artifacts || {},
      });
      setState('success');

      // Refresh manifest
      await fetchManifest();
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setState('error');
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950" data-testid="export-page" data-ready="true">
      <PageHeader
        title="Export Bundle V3"
        subtitle="Terminal-grade deterministic export"
        badge="v1.113"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Export Button Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6" data-testid="export-section">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-100 mb-2">Full System Export</h2>
                <p className="text-sm text-neutral-400 mb-4">
                  Create a deterministic ZIP archive containing complete trading state, autopilot decisions,
                  automation workflows, telemetry events, search metadata, and platform health.
                </p>

                {manifest && manifest.available && (
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-blue-400" />
                      <span className="text-neutral-400">Orders:</span>
                      <span className="text-neutral-200 font-mono" data-testid="export-order-count">
                        {manifest.artifacts.trading_state.order_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-green-400" />
                      <span className="text-neutral-400">Positions:</span>
                      <span className="text-neutral-200 font-mono" data-testid="export-position-count">
                        {manifest.artifacts.trading_state.position_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-purple-400" />
                      <span className="text-neutral-400">Telemetry:</span>
                      <span className="text-neutral-200 font-mono" data-testid="export-telemetry-count">
                        {manifest.artifacts.telemetry_events.event_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-orange-400" />
                      <span className="text-neutral-400">Workflows:</span>
                      <span className="text-neutral-200 font-mono" data-testid="export-workflow-count">
                        {manifest.artifacts.automation_workflows.workflow_count}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleExport}
                disabled={state === 'loading' || !!(manifest && !manifest.available)}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  flex items-center gap-2
                  ${
                    state === 'loading'
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }
                `}
                data-testid="export-button"
              >
                <Download className="w-4 h-4" />
                {state === 'loading' ? 'Exporting...' : 'Export Bundle'}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {state === 'loading' && (
            <div
              className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-6"
              data-testid="export-loading"
            >
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                <div>
                  <div className="text-sm font-medium text-blue-300">Creating export bundle...</div>
                  <div className="text-xs text-blue-400/70 mt-1">
                    Packaging trading state, telemetry, autopilot decisions, and platform health
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && result && (
            <div
              className="bg-green-950/30 border border-green-900/50 rounded-lg p-6"
              data-testid="export-success"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-300 mb-2">Export successful</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-400/70">File:</span>
                      <span className="text-green-300 font-mono" data-testid="export-filename">
                        {result.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-400/70">Size:</span>
                      <span className="text-green-300 font-mono" data-testid="export-size">
                        {(result.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <div className="text-xs text-green-400/70 mt-3">
                      Bundle contains 6 artifacts with content hashes for verification.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && error && (
            <div
              className="bg-red-950/30 border border-red-900/50 rounded-lg p-6"
              data-testid="export-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-300 mb-1">Export failed</div>
                  <div className="text-xs text-red-400/70" data-testid="export-error-message">
                    {error}
                  </div>
                  <button
                    onClick={() => setState('idle')}
                    className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
                    data-testid="export-error-dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-neutral-100 mb-3">Export Bundle Contents</h3>
            <div className="space-y-2 text-xs text-neutral-400">
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">manifest.json</span>
                  <span className="ml-2">- Metadata + content hashes</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">trading_state.json</span>
                  <span className="ml-2">- Orders, positions, PnL tape</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">autopilot_decisions.json</span>
                  <span className="ml-2">- Candidate decisions + rejection codes</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">automation_workflows.json</span>
                  <span className="ml-2">- Workflows + execution results</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">telemetry_events.json</span>
                  <span className="ml-2">- Recent event window (bounded)</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">search_metadata.json</span>
                  <span className="ml-2">- Index stats + backend type</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neutral-500">•</span>
                <div>
                  <span className="text-neutral-300 font-mono">platform_health.json</span>
                  <span className="ml-2">- Subsystem health snapshot</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-800">
              <div className="text-xs text-neutral-500">
                <span className="font-semibold text-neutral-400">Determinism guarantees:</span> Stable ordering,
                normalized timestamps in DEMO mode, content hashes for verification, reproducible across runs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
