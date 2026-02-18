/**
 * Strategy Export Status (v1.32)
 * Shows included files in deterministic order after export.
 */

import { useState } from 'react';
import { FileText, Check, Copy } from 'lucide-react';

interface BundleManifest {
  run_id: string;
  version: string;
  files: { name: string; sha256: string }[];
  checksums: Record<string, string>;
  file_count: number;
  manifest_checksum?: string;
  strategy_spec?: Record<string, unknown>;
  strategy_validation?: Record<string, unknown>;
}

interface ExportStatusProps {
  manifest: BundleManifest | null;
  loading?: boolean;
}

export function ExportBundleStatus({ manifest, loading }: ExportStatusProps) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div data-testid="export-bundle-status-loading" className="animate-pulse">
        <div className="h-16 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!manifest) {
    return (
      <div data-testid="export-bundle-status-empty" className="text-gray-500 text-sm">
        No export manifest available
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid="export-bundle-status" className="bg-gray-800 border border-gray-700 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText size={14} className="text-blue-400" />
          <span>Export Bundle ({manifest.file_count} files)</span>
        </div>
        <button
          onClick={handleCopy}
          data-testid="export-bundle-copy"
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div data-testid="export-bundle-file-list" className="space-y-1">
        {manifest.files.map((file, idx) => (
          <div
            key={file.name}
            data-testid={`export-bundle-file-${idx}`}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-mono text-gray-300">{file.name}</span>
            <span className="font-mono text-gray-500 truncate ml-2">
              {file.sha256.slice(0, 12)}…
            </span>
          </div>
        ))}
      </div>

      {manifest.manifest_checksum && (
        <div data-testid="export-bundle-checksum" className="text-xs text-gray-500 pt-1 border-t border-gray-700">
          Manifest: {manifest.manifest_checksum.slice(0, 16)}…
        </div>
      )}
    </div>
  );
}
