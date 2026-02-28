/**
 * Phase C — ErrorCard Component
 * Displays structured API errors with correlation_id and copy-debug button.
 */
import { useState } from 'react';
import type { ApiFetchError } from '../../lib/safeFetch';

interface ErrorCardProps {
  error: ApiFetchError | { code: string; message: string; correlation_id?: string | null; url?: string; status?: number };
  testId?: string;
}

export function ErrorCard({ error, testId = 'error-card' }: ErrorCardProps) {
  const [copied, setCopied] = useState(false);

  const debugBundle = JSON.stringify({
    code: error.code,
    message: error.message,
    url: 'url' in error ? error.url : undefined,
    status: 'status' in error ? error.status : undefined,
    correlation_id: error.correlation_id ?? undefined,
    timestamp: new Date().toISOString(),
  }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(debugBundle).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      data-testid={testId}
      style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#fca5a5',
        fontSize: '13px',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong data-testid={`${testId}-code`} style={{ color: '#ef4444' }}>
          {error.code}
        </strong>
        {error.correlation_id && (
          <span data-testid={`${testId}-cid`} style={{ fontSize: '11px', opacity: 0.7 }}>
            CID: {error.correlation_id}
          </span>
        )}
      </div>
      <div data-testid={`${testId}-message`} style={{ marginBottom: '12px' }}>
        {error.message}
      </div>
      <button
        data-testid={`${testId}-copy`}
        onClick={handleCopy}
        style={{
          padding: '4px 12px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          color: '#fca5a5',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        {copied ? '✓ Copied' : 'Copy Debug Bundle'}
      </button>
    </div>
  );
}
