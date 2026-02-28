/**
 * PageShellUI2 — W103 standardized page wrapper
 * Enforces loading / empty / error / ready state machine.
 * Every UI2 core page wraps its content in this component.
 */

import React from 'react';

export type PageStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface PageShellUI2Props {
  /** Current page status */
  status: PageStatus;
  /** Outer testid for the shell wrapper (default: "page-shell") */
  testId?: string;
  /** Error message shown when status === 'error' */
  errorMessage?: string;
  /** Empty state message shown when status === 'empty' */
  emptyMessage?: string;
  /** Children rendered when status === 'ready' */
  children?: React.ReactNode;
  /** Optional className on the outer wrapper */
  className?: string;
  /** Optional style on the outer wrapper */
  style?: React.CSSProperties;
}

const SHELL: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const OVERLAY: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 12,
  background: '#0F172A',
  zIndex: 10,
};

const SPINNER: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '3px solid #1E293B',
  borderTopColor: '#3B82F6',
  animation: 'spin 0.8s linear infinite',
};

export function PageShellUI2({
  status,
  testId = 'page-shell',
  errorMessage = 'Something went wrong. Please try again.',
  emptyMessage = 'No data available.',
  children,
  className,
  style,
}: PageShellUI2Props) {
  return (
    <>
      {/* Inject keyframe once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        data-testid={testId}
        data-page-status={status}
        className={className}
        style={{ ...SHELL, ...style }}
      >
        {/* Loading overlay */}
        {status === 'loading' && (
          <div data-testid="page-loading" style={OVERLAY}>
            <div style={SPINNER} />
            <span style={{ color: '#64748B', fontSize: 13 }}>Loading…</span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div data-testid="page-error" style={{ ...OVERLAY, background: '#1E293B' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <span style={{ color: '#F87171', fontSize: 14, maxWidth: 320, textAlign: 'center' }}>
              {errorMessage}
            </span>
          </div>
        )}

        {/* Empty overlay */}
        {status === 'empty' && (
          <div data-testid="page-empty" style={{ ...OVERLAY, background: '#0F172A' }}>
            <span style={{ fontSize: 28 }}>📭</span>
            <span style={{ color: '#475569', fontSize: 14 }}>{emptyMessage}</span>
          </div>
        )}

        {/* Content — always rendered in DOM, hidden while loading/error/empty */}
        <div
          data-testid="page-ready"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            visibility: status === 'ready' ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export default PageShellUI2;
