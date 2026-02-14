/**
 * Migration Warning Banner (v1.34)
 * Shows when viewing an older schema version artifact.
 * Provides read-only migrated preview.
 */

import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../../../config/api';

interface MigrationWarningProps {
  schemaVersion: number;
  artifactData: Record<string, unknown>;
}

interface MigrationPreview {
  migrated: Record<string, unknown>;
  needs_migration: boolean;
  source_version: number;
  target_version: number;
  warnings: string[];
}

export function MigrationWarning({ schemaVersion, artifactData }: MigrationWarningProps) {
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const needsMigration = schemaVersion !== 1;

  const loadPreview = async () => {
    if (preview) {
      setShowPreview(!showPreview);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/strategy-artifacts/migration-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_data: artifactData }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
        setShowPreview(true);
      }
    } catch (e) {
      console.error('Migration preview failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!needsMigration) return null;

  return (
    <div data-testid="migration-warning" className="bg-yellow-900/20 border border-yellow-700 rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-yellow-400" />
        <span data-testid="migration-warning-text" className="text-sm text-yellow-300">
          This artifact uses schema version {schemaVersion}. Current version is 1.
        </span>
      </div>

      <button
        onClick={loadPreview}
        data-testid="migration-preview-toggle"
        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
        disabled={loading}
      >
        {loading ? 'Loading...' : showPreview ? (
          <><EyeOff size={12} /> Hide Preview</>
        ) : (
          <><Eye size={12} /> Show Migrated Preview</>
        )}
      </button>

      {showPreview && preview && (
        <div data-testid="migration-preview" className="mt-2">
          {preview.warnings.length > 0 && (
            <div data-testid="migration-preview-warnings" className="text-xs text-yellow-400 mb-2">
              {preview.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
          <pre
            data-testid="migration-preview-json"
            className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-48 text-gray-300 font-mono"
          >
            {JSON.stringify(preview.migrated, null, 2)}
          </pre>
          <div className="text-xs text-gray-500 mt-1">
            Read-only preview — no changes applied.
          </div>
        </div>
      )}
    </div>
  );
}
