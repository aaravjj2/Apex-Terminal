import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-xl p-6 border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-2xl font-bold">Something went wrong</h1>
            </div>
            
            <p className="text-gray-300 mb-4">
              The application encountered an unexpected error. This has been logged and will be investigated.
            </p>

            {this.state.error && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-red-400 mb-2">Error Details:</h2>
                <div className="bg-gray-900 rounded p-3 font-mono text-sm overflow-auto max-h-40">
                  <p className="text-red-300">{this.state.error.toString()}</p>
                </div>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="mb-4">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-200 mb-2">
                  Stack Trace
                </summary>
                <div className="bg-gray-900 rounded p-3 font-mono text-xs overflow-auto max-h-60">
                  <pre className="text-gray-400">{this.state.errorInfo.componentStack}</pre>
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
