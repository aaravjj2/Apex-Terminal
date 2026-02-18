/**
 * Hash Ledger Display (v1.36)
 * Shows the chained hash ledger from strategy → backtest → report.
 */

import { useState } from 'react';
import { Copy, Check, ShieldCheck, Link2 } from 'lucide-react';

interface LedgerEntry {
  step: string;
  hash: string;
  source: string;
}

interface HashLedger {
  run_id: string;
  strategy_artifact_id: string;
  created_at: string;
  chain: LedgerEntry[];
  ledger_checksum: string;
}

interface HashLedgerDisplayProps {
  ledger: HashLedger | null;
  loading?: boolean;
}

export function HashLedgerDisplay({ ledger, loading }: HashLedgerDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (loading) {
    return (
      <div data-testid="hash-ledger-loading" className="p-3 bg-gray-800 rounded border border-gray-700 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-2" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div data-testid="hash-ledger-empty" className="p-3 bg-gray-800 rounded border border-gray-700 text-gray-500 text-sm">
        No hash ledger available.
      </div>
    );
  }

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <div data-testid="hash-ledger" className="bg-gray-800 rounded border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <ShieldCheck size={16} className="text-green-400" />
        <span className="text-sm font-medium text-white">Hash Ledger</span>
        <span className="text-xs text-gray-400 ml-auto" data-testid="hash-ledger-run-id">
          {ledger.run_id}
        </span>
      </div>

      {/* Chain entries */}
      <div className="p-2 space-y-1" data-testid="hash-ledger-chain">
        {ledger.chain.map((entry, idx) => (
          <div
            key={entry.step}
            data-testid={`hash-ledger-entry-${idx}`}
            className="flex items-center gap-2 px-2 py-1.5 bg-gray-900 rounded text-xs group"
          >
            {idx > 0 && (
              <Link2 size={10} className="text-blue-400 -ml-1 mr-0.5" />
            )}
            <span className="text-gray-400 w-28 truncate" title={entry.step}>
              {entry.step}
            </span>
            <code className="flex-1 text-green-300 font-mono truncate" title={entry.hash}>
              {entry.hash}
            </code>
            <button
              data-testid={`hash-ledger-copy-${idx}`}
              onClick={() => handleCopy(entry.hash, entry.step)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
              title="Copy hash"
            >
              {copied === entry.step ? (
                <Check size={12} className="text-green-400" />
              ) : (
                <Copy size={12} className="text-gray-500" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Ledger checksum */}
      <div className="px-3 py-2 border-t border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-400">Ledger Checksum:</span>
        <code
          data-testid="hash-ledger-checksum"
          className="text-xs text-yellow-300 font-mono truncate flex-1"
          title={ledger.ledger_checksum}
        >
          {ledger.ledger_checksum}
        </code>
        <button
          data-testid="hash-ledger-copy-checksum"
          onClick={() => handleCopy(ledger.ledger_checksum, 'checksum')}
          className="p-0.5"
        >
          {copied === 'checksum' ? (
            <Check size={12} className="text-green-400" />
          ) : (
            <Copy size={12} className="text-gray-500" />
          )}
        </button>
      </div>
    </div>
  );
}
