/**
 * client.ts
 * Base HTTP client for all Apex Terminal API calls.
 * Provides retry logic, authentication header injection, request queuing,
 * response caching, error normalisation, and global request/response interceptors.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ApiClientConfig {
  baseUrl?: string;
  defaultTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryOnStatusCodes?: number[];
  authToken?: string | (() => string | null);
  onRequest?: (req: RequestInit & { url: string }) => void;
  onResponse?: (resp: Response, url: string) => void;
  onError?: (err: ApiError, url: string) => void;
  cacheTtlMs?: number;
  enableCache?: boolean;
}

const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  defaultTimeoutMs: 12000,
  maxRetries: 3,
  retryDelayMs: 500,
  retryOnStatusCodes: [429, 502, 503, 504],
  authToken: '',
  onRequest: () => undefined,
  onResponse: () => undefined,
  onError: () => undefined,
  cacheTtlMs: 10000,
  enableCache: false,
};

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly endpoint: string,
    public readonly requestId?: string,
  ) {
    super(`[${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'ApiError';
  }

  get isServerError(): boolean { return this.statusCode >= 500; }
  get isClientError(): boolean { return this.statusCode >= 400 && this.statusCode < 500; }
  get isNetworkError(): boolean { return this.statusCode === 0; }
  get isAuthError(): boolean { return this.statusCode === 401 || this.statusCode === 403; }
  get isRateLimit(): boolean { return this.statusCode === 429; }
  get isTimeout(): boolean { return this.statusCode === 408; }
}

export class NetworkError extends ApiError {
  constructor(endpoint: string, cause?: Error) {
    super(0, cause?.message ?? 'Network error', endpoint);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(endpoint: string, timeoutMs: number) {
    super(408, `Request timed out after ${timeoutMs}ms`, endpoint);
    this.name = 'TimeoutError';
  }
}

// ─── Simple LRU Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
  key: string;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(key, { data, expiry: Date.now() + ttlMs, key });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number { return this.cache.size; }
}

const globalCache = new ResponseCache();

// ─── Request Queue ────────────────────────────────────────────────────────────

type PendingRequest<T> = {
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<unknown>[]>();

  isInFlight(key: string): boolean {
    return this.pending.has(key);
  }

  enqueue<T>(key: string, callback: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.pending.has(key)) {
        this.pending.set(key, []);
        callback().then(
          (result) => {
            const waiting = this.pending.get(key) ?? [];
            this.pending.delete(key);
            for (const w of waiting) (w.resolve as (v: T) => void)(result);
            resolve(result);
          },
          (err) => {
            const waiting = this.pending.get(key) ?? [];
            this.pending.delete(key);
            for (const w of waiting) w.reject(err);
            reject(err);
          }
        );
      } else {
        this.pending.get(key)!.push({ resolve: resolve as (v: unknown) => void, reject });
      }
    });
  }
}

const deduplicator = new RequestDeduplicator();

// ─── Retry Utility ────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
  retryOnStatusCodes: number[],
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && !retryOnStatusCodes.includes(err.statusCode)) {
        throw err;
      }
      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt); // exponential backoff
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ─── Core Client ──────────────────────────────────────────────────────────────

export class ApiClient {
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Update config (e.g. set auth token after login) */
  configure(updates: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private getAuthHeader(): Record<string, string> {
    const token = typeof this.config.authToken === 'function'
      ? this.config.authToken()
      : this.config.authToken;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private cacheKey(url: string, body?: unknown): string {
    return body ? `${url}::${JSON.stringify(body)}` : url;
  }

  /** Low-level fetch with timeout + error normalisation */
  private async fetchOnce<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
    try {
      this.config.onRequest({ url, ...init });
      const response = await fetch(url, { ...init, signal: ctrl.signal });
      this.config.onResponse(response, url);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        const reqId = response.headers.get('x-request-id') ?? undefined;
        throw new ApiError(response.status, body.detail ?? response.statusText, url, reqId);
      }
      return response.json() as Promise<T>;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(url, timeoutMs);
      }
      const networkErr = new NetworkError(url, err instanceof Error ? err : undefined);
      this.config.onError(networkErr, url);
      throw networkErr;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Main request method */
  async request<T>(
    path: string,
    options: RequestInit & {
      timeoutMs?: number;
      useCache?: boolean;
      cacheTtlMs?: number;
      deduplicate?: boolean;
    } = {},
  ): Promise<T> {
    const {
      timeoutMs = this.config.defaultTimeoutMs,
      useCache = this.config.enableCache,
      cacheTtlMs = this.config.cacheTtlMs,
      deduplicate = options.method === 'GET' || !options.method,
      ...fetchOptions
    } = options;

    const url = `${this.config.baseUrl}${path}`;
    const cacheKey = this.cacheKey(url, fetchOptions.body);

    // Cache check
    if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
      const cached = globalCache.get<T>(cacheKey);
      if (cached !== null) return cached;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...fetchOptions.headers,
    };

    const doFetch = () => withRetry(
      () => this.fetchOnce<T>(url, { ...fetchOptions, headers }, timeoutMs),
      this.config.maxRetries,
      this.config.retryDelayMs,
      this.config.retryOnStatusCodes,
    );

    const result = deduplicate
      ? await deduplicator.enqueue(cacheKey, doFetch)
      : await doFetch();

    if (useCache) globalCache.set(cacheKey, result, cacheTtlMs);
    return result;
  }

  get<T>(path: string, opts?: RequestInit & { timeoutMs?: number; useCache?: boolean; cacheTtlMs?: number }): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...opts });
  }

  post<T>(path: string, body: unknown, opts?: RequestInit & { timeoutMs?: number }): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts });
  }

  put<T>(path: string, body: unknown, opts?: RequestInit & { timeoutMs?: number }): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts });
  }

  patch<T>(path: string, body: unknown, opts?: RequestInit & { timeoutMs?: number }): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts });
  }

  delete<T>(path: string, opts?: RequestInit & { timeoutMs?: number }): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', ...opts });
  }

  /** Invalidate cached responses for a URL prefix */
  invalidateCache(prefix: string): void {
    globalCache.invalidate(`${this.config.baseUrl}${prefix}`);
  }

  clearCache(): void {
    globalCache.clear();
  }

  get cacheSize(): number { return globalCache.size; }
}

// ─── Singleton Instances ──────────────────────────────────────────────────────

/** Default API client — use this in most places */
export const apiClient = new ApiClient();

/** Cached API client — suitable for reference data that changes rarely */
export const cachedApiClient = new ApiClient({
  enableCache: true,
  cacheTtlMs: 30000,
  maxRetries: 2,
});

/** Long-poll client for streaming / polling endpoints */
export const pollClient = new ApiClient({
  defaultTimeoutMs: 30000,
  maxRetries: 1,
  retryDelayMs: 1000,
});

// ─── Paginated fetch ──────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function fetchAllPages<T>(
  client: ApiClient,
  path: string,
  pageSize = 100,
  maxPages = 10,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const result = await client.get<PagedResult<T>>(`${path}?page=${page}&page_size=${pageSize}`);
    all.push(...result.items);
    if (!result.hasNext) break;
  }
  return all;
}

// ─── WebSocket helper ─────────────────────────────────────────────────────────

export interface WebSocketOptions {
  onMessage: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: (code: number) => void;
  onError?: (err: Event) => void;
  reconnectMs?: number;
  maxReconnects?: number;
}

export function createWebSocket(
  path: string,
  options: WebSocketOptions,
): { close: () => void; send: (data: unknown) => void; readyState: () => number } {
  const wsBase = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000').replace(/^http/, 'ws');
  const url = `${wsBase}${path}`;
  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let closed = false;
  const { reconnectMs = 3000, maxReconnects = 5 } = options;

  function connect(): void {
    ws = new WebSocket(url);
    ws.onopen = () => { reconnectCount = 0; options.onOpen?.(); };
    ws.onmessage = (ev) => {
      try { options.onMessage(JSON.parse(ev.data)); }
      catch { options.onMessage(ev.data); }
    };
    ws.onclose = (ev) => {
      options.onClose?.(ev.code);
      if (!closed && reconnectCount < maxReconnects) {
        reconnectCount++;
        setTimeout(connect, reconnectMs * reconnectCount);
      }
    };
    ws.onerror = (ev) => options.onError?.(ev);
  }

  connect();

  return {
    close: () => { closed = true; ws?.close(); },
    send: (data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      }
    },
    readyState: () => ws?.readyState ?? WebSocket.CLOSED,
  };
}

// ─── Health check ─────────────────────────────────────────────────────────────

export interface ServerHealth {
  status: 'ok' | 'degraded' | 'down';
  version?: string;
  uptime_seconds?: number;
  db_connected?: boolean;
  cache_connected?: boolean;
  latency_ms?: number;
}

export async function checkHealth(timeoutMs = 3000): Promise<ServerHealth> {
  const start = performance.now();
  try {
    const result = await apiClient.get<Omit<ServerHealth, 'latency_ms'>>('/health', { timeoutMs });
    return { ...result, latency_ms: performance.now() - start };
  } catch {
    return { status: 'down', latency_ms: performance.now() - start };
  }
}

export async function waitForServer(
  maxAttempts = 10,
  intervalMs = 2000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const health = await checkHealth(3000);
    if (health.status !== 'down') return true;
    await sleep(intervalMs);
  }
  return false;
}
