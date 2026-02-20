/**
 * v1.95 — UI2 Error Boundary
 * Catches React errors and displays professional error panel.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          data-testid="ui2-error-panel"
          style={{
            padding: '24px',
            background: 'var(--ui2-bg-panel)',
            border: '2px solid var(--ui2-color-danger)',
            borderRadius: 'var(--ui2-radius-lg)',
            margin: '24px',
            color: 'var(--ui2-text-primary)',
          }}
        >
          <h2 style={{ color: 'var(--ui2-color-danger)', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>
            ⚠️ Application Error
          </h2>
          <p style={{ color: 'var(--ui2-text-muted)', marginBottom: '16px', fontSize: '14px' }}>
            Something went wrong. The error has been logged.
          </p>
          {this.state.error && (
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--ui2-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                Error Details (for debugging)
              </summary>
              <pre
                style={{
                  background: 'var(--ui2-bg-root)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: '300px',
                  color: 'var(--ui2-color-danger)',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo && `\n\n${this.state.errorInfo.componentStack}`}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: 'var(--ui2-bg-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--ui2-radius-md)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
