// Platform Error Handling - Classification, Retry, Reporting & Recovery

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'permission' | 'timeout'
  | 'rate_limit' | 'server' | 'client' | 'data' | 'unknown';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface AppError {
  id: string;
  message: string;
  userMessage: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code?: string;
  statusCode?: number;
  originalError?: Error;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  url?: string;
  recoverable: boolean;
  recoverySuggestion?: string;
  retryable: boolean;
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  type: 'navigation' | 'click' | 'api' | 'console' | 'error' | 'custom';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
  retryableCategories: ErrorCategory[];
  onRetry?: (attempt: number, error: AppError) => void;
}

export interface ErrorReportPayload {
  error: AppError;
  session: {
    id: string;
    userId?: string;
    url: string;
    userAgent: string;
    timestamp: number;
  };
  environment: {
    platform: string;
    version?: string;
    locale: string;
  };
}

export interface ErrorStats {
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  recent: AppError[];
  deduplicatedCount: number;
}

// --- Error Classification ---

export function classifyError(error: unknown, statusCode?: number): { category: ErrorCategory; severity: ErrorSeverity } {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { category: 'network', severity: 'error' };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { category: 'timeout', severity: 'warning' };
  }

  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) return { category: 'auth', severity: 'error' };
    if (statusCode === 400 || statusCode === 422) return { category: 'validation', severity: 'warning' };
    if (statusCode === 404) return { category: 'client', severity: 'warning' };
    if (statusCode === 429) return { category: 'rate_limit', severity: 'warning' };
    if (statusCode >= 500) return { category: 'server', severity: 'error' };
  }

  if (error instanceof SyntaxError) return { category: 'data', severity: 'error' };
  if (error instanceof RangeError) return { category: 'client', severity: 'error' };
  if (error instanceof URIError) return { category: 'client', severity: 'warning' };

  return { category: 'unknown', severity: 'error' };
}

// --- User-Friendly Messages ---

const USER_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Connection issue. Please check your internet and try again.',
  auth: 'Your session has expired. Please log in again.',
  validation: 'Please check your input and try again.',
  permission: 'You don\'t have permission to perform this action.',
  timeout: 'The request timed out. Please try again.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong on our end. We\'re working to fix it.',
  client: 'An error occurred. Please refresh and try again.',
  data: 'We received unexpected data. Please try again.',
  unknown: 'An unexpected error occurred. Please try again.',
};

const RECOVERY_SUGGESTIONS: Record<ErrorCategory, string> = {
  network: 'Check your internet connection, then retry.',
  auth: 'Log out and log back in to refresh your session.',
  validation: 'Review the form fields for any errors.',
  permission: 'Contact your administrator for access.',
  timeout: 'Try again in a few moments. The server might be busy.',
  rate_limit: 'Wait 30 seconds before trying again.',
  server: 'Wait a few minutes and retry. If the problem persists, contact support.',
  client: 'Refresh the page. If the problem persists, clear your browser cache.',
  data: 'Refresh the page and try again.',
  unknown: 'Try refreshing the page. If the issue continues, contact support.',
};

// --- Error Factory ---

let errorCounter = 0;

export function createAppError(
  error: unknown,
  options?: {
    statusCode?: number;
    context?: Record<string, unknown>;
    userMessage?: string;
    breadcrumbs?: Breadcrumb[];
  }
): AppError {
  const { category, severity } = classifyError(error, options?.statusCode);
  const originalError = error instanceof Error ? error : new Error(String(error));

  const retryableCategories: ErrorCategory[] = ['network', 'timeout', 'rate_limit', 'server'];
  const recoverableCategories: ErrorCategory[] = ['network', 'timeout', 'rate_limit', 'server', 'validation', 'auth'];

  return {
    id: `err_${Date.now()}_${++errorCounter}`,
    message: originalError.message,
    userMessage: options?.userMessage || USER_MESSAGES[category],
    category,
    severity,
    code: (error as { code?: string })?.code,
    statusCode: options?.statusCode,
    originalError,
    stack: originalError.stack,
    context: options?.context,
    timestamp: Date.now(),
    url: typeof location !== 'undefined' ? location.href : undefined,
    recoverable: recoverableCategories.includes(category),
    recoverySuggestion: RECOVERY_SUGGESTIONS[category],
    retryable: retryableCategories.includes(category),
    breadcrumbs: options?.breadcrumbs || [],
  };
}

// --- Retry Logic ---

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableCategories: ['network', 'timeout', 'rate_limit', 'server'],
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  const jitter = delay * 0.1 * Math.random();
  return Math.min(delay + jitter, config.maxDelay);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const appError = error instanceof Error && 'category' in error
        ? error as unknown as AppError
        : createAppError(error);

      lastError = appError;

      if (attempt >= cfg.maxRetries) break;
      if (!cfg.retryableCategories.includes(appError.category)) break;
      if (appError.statusCode && !cfg.retryableStatuses.includes(appError.statusCode)) break;

      cfg.onRetry?.(attempt + 1, appError);
      const delay = calculateDelay(attempt, cfg);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// --- Breadcrumb Collector ---

export class BreadcrumbCollector {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number;
  private cleanupFns: (() => void)[] = [];

  constructor(maxBreadcrumbs = 100) {
    this.maxBreadcrumbs = maxBreadcrumbs;
    this.initAutoCapture();
  }

  private add(crumb: Breadcrumb): void {
    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  addCustom(message: string, data?: Record<string, unknown>): void {
    this.add({ type: 'custom', message, timestamp: Date.now(), data });
  }

  addApi(method: string, url: string, status?: number): void {
    this.add({
      type: 'api',
      message: `${method} ${url}${status ? ` → ${status}` : ''}`,
      timestamp: Date.now(),
      data: { method, url, status },
    });
  }

  getAll(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  getRecent(count = 20): Breadcrumb[] {
    return this.breadcrumbs.slice(-count);
  }

  clear(): void {
    this.breadcrumbs = [];
  }

  private initAutoCapture(): void {
    if (typeof window === 'undefined') return;

    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const text = target.textContent?.slice(0, 50)?.trim() || '';
      const id = target.id ? `#${target.id}` : '';
      const cls = target.className ? `.${String(target.className).split(' ')[0]}` : '';
      this.add({
        type: 'click',
        message: `Click: ${tag}${id}${cls}${text ? ` "${text}"` : ''}`,
        timestamp: Date.now(),
      });
    };

    const navHandler = () => {
      this.add({
        type: 'navigation',
        message: `Navigate: ${location.pathname}`,
        timestamp: Date.now(),
        data: { url: location.href },
      });
    };

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method || 'GET';
      try {
        const response = await origFetch(input, init);
        this.addApi(method, url, response.status);
        return response;
      } catch (error) {
        this.addApi(method, url);
        throw error;
      }
    };

    document.addEventListener('click', clickHandler, true);
    window.addEventListener('popstate', navHandler);

    this.cleanupFns.push(
      () => document.removeEventListener('click', clickHandler, true),
      () => window.removeEventListener('popstate', navHandler),
      () => { window.fetch = origFetch; }
    );
  }

  destroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    this.breadcrumbs = [];
  }
}

// --- Error Reporter ---

export class ErrorReporter {
  private endpoint: string | null = null;
  private errors: AppError[] = [];
  private deduplicationWindow = 60_000;
  private errorHashes = new Map<string, number>();
  private rateLimitPerMinute = 10;
  private recentErrorCount = 0;
  private rateLimitResetTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(error: AppError) => void>();
  private breadcrumbs: BreadcrumbCollector;
  private maxStoredErrors = 200;

  constructor(options?: { endpoint?: string; maxErrors?: number; rateLimitPerMinute?: number }) {
    this.endpoint = options?.endpoint || null;
    this.maxStoredErrors = options?.maxErrors ?? 200;
    this.rateLimitPerMinute = options?.rateLimitPerMinute ?? 10;
    this.breadcrumbs = new BreadcrumbCollector();
    this.startRateLimitReset();
  }

  private startRateLimitReset(): void {
    this.rateLimitResetTimer = setInterval(() => {
      this.recentErrorCount = 0;
    }, 60_000);
  }

  report(error: unknown, context?: Record<string, unknown>): AppError {
    const appError = error instanceof Error && 'category' in error && 'id' in error
      ? error as unknown as AppError
      : createAppError(error, { context, breadcrumbs: this.breadcrumbs.getRecent() });

    if (this.isDuplicate(appError)) {
      return appError;
    }

    if (this.recentErrorCount >= this.rateLimitPerMinute) {
      return appError;
    }

    this.recentErrorCount++;
    this.errors.push(appError);
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(-this.maxStoredErrors);
    }

    this.listeners.forEach(fn => fn(appError));

    if (this.endpoint) {
      this.sendReport(appError).catch(() => {});
    }

    return appError;
  }

  private isDuplicate(error: AppError): boolean {
    const hash = `${error.category}:${error.message.slice(0, 100)}`;
    const lastSeen = this.errorHashes.get(hash);
    const now = Date.now();

    if (lastSeen && now - lastSeen < this.deduplicationWindow) {
      return true;
    }

    this.errorHashes.set(hash, now);

    if (this.errorHashes.size > 500) {
      const cutoff = now - this.deduplicationWindow;
      for (const [key, time] of this.errorHashes) {
        if (time < cutoff) this.errorHashes.delete(key);
      }
    }

    return false;
  }

  private async sendReport(error: AppError): Promise<void> {
    if (!this.endpoint) return;

    const payload: ErrorReportPayload = {
      error,
      session: {
        id: this.getSessionId(),
        url: typeof location !== 'undefined' ? location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
      },
      environment: {
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
      },
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
      } else {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch { /* silently fail */ }
  }

  private getSessionId(): string {
    try { return sessionStorage.getItem('analytics_session') || 'unknown'; } catch { return 'unknown'; }
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  getStats(): ErrorStats {
    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;

    for (const error of this.errors) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return {
      total: this.errors.length,
      byCategory,
      bySeverity,
      recent: this.errors.slice(-10),
      deduplicatedCount: this.errorHashes.size,
    };
  }

  onError(callback: (error: AppError) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    this.breadcrumbs.addCustom(message, data);
  }

  clearErrors(): void {
    this.errors = [];
    this.errorHashes.clear();
  }

  destroy(): void {
    if (this.rateLimitResetTimer) clearInterval(this.rateLimitResetTimer);
    this.breadcrumbs.destroy();
    this.listeners.clear();
  }
}

// --- Global Error Handler ---

export class GlobalErrorHandler {
  private reporter: ErrorReporter;
  private cleanupFns: (() => void)[] = [];
  private recoveryHandlers = new Map<ErrorCategory, (error: AppError) => void>();

  constructor(reporter: ErrorReporter) {
    this.reporter = reporter;
  }

  install(): void {
    if (typeof window === 'undefined') return;

    const errorHandler = (event: ErrorEvent) => {
      event.preventDefault();
      const appError = this.reporter.report(event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
      this.tryRecover(appError);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const appError = this.reporter.report(event.reason);
      this.tryRecover(appError);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    this.cleanupFns.push(
      () => window.removeEventListener('error', errorHandler),
      () => window.removeEventListener('unhandledrejection', rejectionHandler)
    );
  }

  setRecoveryHandler(category: ErrorCategory, handler: (error: AppError) => void): void {
    this.recoveryHandlers.set(category, handler);
  }

  private tryRecover(error: AppError): void {
    if (!error.recoverable) return;
    const handler = this.recoveryHandlers.get(error.category);
    handler?.(error);
  }

  uninstall(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}

// --- React Error Boundary (functional pattern) ---

export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  retryCount: number;
}

export function createErrorBoundaryState(): ErrorBoundaryState {
  return { hasError: false, error: null, retryCount: 0 };
}

export function handleErrorBoundaryCatch(
  error: Error,
  state: ErrorBoundaryState,
  reporter?: ErrorReporter
): ErrorBoundaryState {
  const appError = createAppError(error);
  reporter?.report(error);

  return {
    hasError: true,
    error: appError,
    retryCount: state.retryCount,
  };
}

export function retryErrorBoundary(state: ErrorBoundaryState): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
    retryCount: state.retryCount + 1,
  };
}

// --- HTTP Error Helpers ---

export function createHttpError(response: Response, body?: unknown): AppError {
  const messages: Record<number, string> = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    409: 'Conflict with current state',
    422: 'Validation failed',
    429: 'Rate limit exceeded',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
    504: 'Gateway timeout',
  };

  return createAppError(
    new Error(messages[response.status] || `HTTP Error ${response.status}`),
    {
      statusCode: response.status,
      context: {
        url: response.url,
        body,
      },
    }
  );
}

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = await response.text().catch(() => null); }
    throw createHttpError(response, body);
  }
  return response.json();
}
