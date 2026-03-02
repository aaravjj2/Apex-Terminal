// Platform Analytics - Tracking, Performance Metrics & User Journey

export interface AnalyticsEvent {
  name: string;
  category: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  page?: string;
  referrer?: string;
}

export interface PageView {
  path: string;
  title: string;
  referrer: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  loadTime?: number;
  queryParams?: Record<string, string>;
}

export interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
  inp: number | null;
  domContentLoaded: number | null;
  loadComplete: number | null;
  longTasks: number;
  resourceCount: number;
  totalTransferSize: number;
}

export interface UserJourneyStep {
  action: string;
  page: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface FunnelStep {
  id: string;
  name: string;
  count: number;
  dropoff: number;
  conversionRate: number;
}

export interface ABTestVariant {
  testId: string;
  variantId: string;
  assignedAt: number;
}

export interface ErrorEvent {
  message: string;
  stack?: string;
  type: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
  sessionId: string;
  breadcrumbs: string[];
}

export interface FeatureUsage {
  featureId: string;
  action: string;
  count: number;
  firstUsed: number;
  lastUsed: number;
}

export interface SessionInfo {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  pageViews: number;
  events: number;
  duration: number;
  isActive: boolean;
  referrer: string;
  userAgent: string;
  screenSize: string;
  viewport: string;
  language: string;
  timezone: string;
}

export type AnalyticsProvider = (events: AnalyticsEvent[]) => Promise<void>;

// --- Analytics Engine ---

export class AnalyticsEngine {
  private sessionId: string;
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private pageViewQueue: PageView[] = [];
  private featureUsage = new Map<string, FeatureUsage>();
  private journey: UserJourneyStep[] = [];
  private abTests = new Map<string, ABTestVariant>();
  private breadcrumbs: string[] = [];
  private maxBreadcrumbs = 50;
  private providers: AnalyticsProvider[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private flushSize = 20;
  private flushIntervalMs = 30_000;
  private sessionInfo: SessionInfo;
  private performanceObservers: PerformanceObserver[] = [];
  private metrics: PerformanceMetrics = {
    lcp: null, fid: null, cls: null, ttfb: null, fcp: null, inp: null,
    domContentLoaded: null, loadComplete: null, longTasks: 0,
    resourceCount: 0, totalTransferSize: 0,
  };
  private enabled = true;
  private consent = false;
  private debugMode = false;
  private listeners = new Map<string, Set<(event: AnalyticsEvent) => void>>();

  constructor(options?: {
    flushSize?: number;
    flushIntervalMs?: number;
    maxBreadcrumbs?: number;
    autoTrackPageViews?: boolean;
    autoTrackPerformance?: boolean;
    autoTrackErrors?: boolean;
    debugMode?: boolean;
  }) {
    this.sessionId = this.getOrCreateSession();
    this.flushSize = options?.flushSize ?? 20;
    this.flushIntervalMs = options?.flushIntervalMs ?? 30_000;
    this.maxBreadcrumbs = options?.maxBreadcrumbs ?? 50;
    this.debugMode = options?.debugMode ?? false;

    this.sessionInfo = {
      id: this.sessionId,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      pageViews: 0,
      events: 0,
      duration: 0,
      isActive: true,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screenSize: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    if (options?.autoTrackPerformance !== false) this.initPerformanceTracking();
    if (options?.autoTrackErrors !== false) this.initErrorTracking();
    if (options?.autoTrackPageViews !== false) this.initPageViewTracking();

    this.startFlushInterval();
  }

  private getOrCreateSession(): string {
    const key = 'analytics_session';
    try {
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  // --- Configuration ---

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  setConsent(consent: boolean): void {
    this.consent = consent;
    if (!consent) this.eventQueue = [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  addProvider(provider: AnalyticsProvider): void {
    this.providers.push(provider);
  }

  // --- Event Tracking ---

  track(name: string, category: string, properties?: Record<string, string | number | boolean>): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name,
      category,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      page: typeof location !== 'undefined' ? location.pathname : undefined,
    };

    this.eventQueue.push(event);
    this.sessionInfo.events++;
    this.sessionInfo.lastActivityAt = Date.now();
    this.addBreadcrumb(`Event: ${category}/${name}`);

    if (this.debugMode) console.debug('[Analytics]', event);

    const listeners = this.listeners.get(name);
    listeners?.forEach(fn => fn(event));

    if (this.eventQueue.length >= this.flushSize) {
      this.flush();
    }
  }

  // --- Page Views ---

  trackPageView(path?: string, title?: string): void {
    if (!this.enabled) return;

    const pageView: PageView = {
      path: path || (typeof location !== 'undefined' ? location.pathname : '/'),
      title: title || (typeof document !== 'undefined' ? document.title : ''),
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
    };

    this.pageViewQueue.push(pageView);
    this.sessionInfo.pageViews++;
    this.addBreadcrumb(`PageView: ${pageView.path}`);

    this.track('page_view', 'navigation', {
      path: pageView.path,
      title: pageView.title,
    });
  }

  private initPageViewTracking(): void {
    if (typeof window === 'undefined') return;

    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPushState(...args);
      this.trackPageView();
    };

    history.replaceState = (...args) => {
      origReplaceState(...args);
      this.trackPageView();
    };

    window.addEventListener('popstate', () => this.trackPageView());
  }

  // --- Feature Usage ---

  trackFeatureUsage(featureId: string, action = 'used'): void {
    if (!this.enabled) return;

    const existing = this.featureUsage.get(featureId);
    const now = Date.now();

    if (existing) {
      existing.count++;
      existing.lastUsed = now;
      if (existing.action !== action) existing.action = action;
    } else {
      this.featureUsage.set(featureId, {
        featureId, action, count: 1, firstUsed: now, lastUsed: now,
      });
    }

    this.track('feature_usage', 'engagement', { featureId, action });
  }

  getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values());
  }

  // --- User Journey ---

  trackJourneyStep(action: string, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const step: UserJourneyStep = {
      action,
      page: typeof location !== 'undefined' ? location.pathname : '',
      timestamp: Date.now(),
      metadata,
    };

    if (this.journey.length > 0) {
      const prev = this.journey[this.journey.length - 1];
      prev.duration = step.timestamp - prev.timestamp;
    }

    this.journey.push(step);
    this.addBreadcrumb(`Journey: ${action}`);
  }

  getJourney(): UserJourneyStep[] {
    return [...this.journey];
  }

  // --- A/B Testing ---

  assignABTest(testId: string, variants: string[], userId?: string): string {
    const existing = this.abTests.get(testId);
    if (existing) return existing.variantId;

    const seed = userId || this.userId || this.sessionId;
    const hash = this.simpleHash(seed + testId);
    const variantIndex = hash % variants.length;
    const variantId = variants[variantIndex];

    const assignment: ABTestVariant = { testId, variantId, assignedAt: Date.now() };
    this.abTests.set(testId, assignment);

    this.track('ab_test_assigned', 'experiment', {
      testId, variantId, variantIndex,
    });

    return variantId;
  }

  trackABTestConversion(testId: string, conversionEvent: string): void {
    const variant = this.abTests.get(testId);
    if (!variant) return;

    this.track('ab_test_conversion', 'experiment', {
      testId,
      variantId: variant.variantId,
      conversionEvent,
    });
  }

  getABTestVariant(testId: string): string | null {
    return this.abTests.get(testId)?.variantId ?? null;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // --- Performance Tracking ---

  private initPerformanceTracking(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const lcpObs = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (last) this.metrics.lcp = last.startTime;
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      this.performanceObservers.push(lcpObs);

      const fidObs = new PerformanceObserver(list => {
        const entry = list.getEntries()[0] as PerformanceEntry & { processingStart: number; startTime: number };
        if (entry) this.metrics.fid = entry.processingStart - entry.startTime;
      });
      fidObs.observe({ type: 'first-input', buffered: true });
      this.performanceObservers.push(fidObs);

      const clsObs = new PerformanceObserver(list => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
            clsValue += (entry as PerformanceEntry & { value: number }).value;
          }
        }
        this.metrics.cls = (this.metrics.cls || 0) + clsValue;
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      this.performanceObservers.push(clsObs);

      const fcpObs = new PerformanceObserver(list => {
        const entry = list.getEntries()[0];
        if (entry) this.metrics.fcp = entry.startTime;
      });
      fcpObs.observe({ type: 'paint', buffered: true });
      this.performanceObservers.push(fcpObs);

      const longTaskObs = new PerformanceObserver(list => {
        this.metrics.longTasks += list.getEntries().length;
      });
      longTaskObs.observe({ type: 'longtask', buffered: true });
      this.performanceObservers.push(longTaskObs);
    } catch { /* observer type not supported */ }

    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (nav) {
            this.metrics.ttfb = nav.responseStart - nav.requestStart;
            this.metrics.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
            this.metrics.loadComplete = nav.loadEventEnd - nav.startTime;
          }

          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          this.metrics.resourceCount = resources.length;
          this.metrics.totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
        }, 0);
      });
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getWebVitalsScore(): { score: 'good' | 'needs-improvement' | 'poor'; details: Record<string, string> } {
    const details: Record<string, string> = {};
    let worstScore: 'good' | 'needs-improvement' | 'poor' = 'good';

    if (this.metrics.lcp !== null) {
      const lcpScore = this.metrics.lcp <= 2500 ? 'good' : this.metrics.lcp <= 4000 ? 'needs-improvement' : 'poor';
      details.lcp = `${Math.round(this.metrics.lcp)}ms (${lcpScore})`;
      if (lcpScore === 'poor') worstScore = 'poor';
      else if (lcpScore === 'needs-improvement' && worstScore !== 'poor') worstScore = 'needs-improvement';
    }

    if (this.metrics.fid !== null) {
      const fidScore = this.metrics.fid <= 100 ? 'good' : this.metrics.fid <= 300 ? 'needs-improvement' : 'poor';
      details.fid = `${Math.round(this.metrics.fid)}ms (${fidScore})`;
      if (fidScore === 'poor') worstScore = 'poor';
      else if (fidScore === 'needs-improvement' && worstScore !== 'poor') worstScore = 'needs-improvement';
    }

    if (this.metrics.cls !== null) {
      const clsScore = this.metrics.cls <= 0.1 ? 'good' : this.metrics.cls <= 0.25 ? 'needs-improvement' : 'poor';
      details.cls = `${this.metrics.cls.toFixed(4)} (${clsScore})`;
      if (clsScore === 'poor') worstScore = 'poor';
      else if (clsScore === 'needs-improvement' && worstScore !== 'poor') worstScore = 'needs-improvement';
    }

    return { score: worstScore, details };
  }

  // --- Error Tracking ---

  private initErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        stack: event.error?.stack,
        type: 'runtime',
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        breadcrumbs: [...this.breadcrumbs],
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      this.trackError({
        message,
        stack,
        type: 'unhandled_promise',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        breadcrumbs: [...this.breadcrumbs],
      });
    });
  }

  trackError(error: ErrorEvent): void {
    if (!this.enabled) return;

    this.track('error', 'errors', {
      message: error.message.slice(0, 200),
      type: error.type,
      url: error.url || '',
    });
  }

  // --- Breadcrumbs ---

  addBreadcrumb(message: string): void {
    this.breadcrumbs.push(`[${new Date().toISOString().slice(11, 23)}] ${message}`);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getBreadcrumbs(): string[] {
    return [...this.breadcrumbs];
  }

  // --- Session ---

  getSession(): SessionInfo {
    this.sessionInfo.duration = Date.now() - this.sessionInfo.startedAt;
    return { ...this.sessionInfo };
  }

  // --- Flushing ---

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.consent) return;

    const batch = this.eventQueue.splice(0, this.flushSize);
    const sendPromises = this.providers.map(provider =>
      provider(batch).catch(err => {
        if (this.debugMode) console.error('[Analytics] Provider error:', err);
        this.eventQueue.unshift(...batch);
      })
    );

    await Promise.allSettled(sendPromises);
  }

  // --- Event Listeners ---

  on(eventName: string, callback: (event: AnalyticsEvent) => void): () => void {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName)!.add(callback);
    return () => this.listeners.get(eventName)?.delete(callback);
  }

  // --- Funnel ---

  analyzeFunnel(steps: string[]): FunnelStep[] {
    const counts = steps.map(step =>
      this.journey.filter(j => j.action === step).length
    );

    return steps.map((step, i) => ({
      id: step,
      name: step,
      count: counts[i],
      dropoff: i > 0 ? counts[i - 1] - counts[i] : 0,
      conversionRate: i > 0 && counts[i - 1] > 0
        ? Math.round((counts[i] / counts[i - 1]) * 100)
        : 100,
    }));
  }

  // --- Retention ---

  calculateSessionDuration(): number {
    return Date.now() - this.sessionInfo.startedAt;
  }

  // --- Cleanup ---

  destroy(): void {
    this.flush();
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.performanceObservers.forEach(obs => obs.disconnect());
    this.listeners.clear();
    this.featureUsage.clear();
    this.journey = [];
    this.breadcrumbs = [];
  }
}

// --- Beacon Provider ---

export function createBeaconProvider(endpoint: string): AnalyticsProvider {
  return async (events) => {
    const data = JSON.stringify(events);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(endpoint, data);
      if (!sent) {
        await fetch(endpoint, { method: 'POST', body: data, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } else {
      await fetch(endpoint, { method: 'POST', body: data, headers: { 'Content-Type': 'application/json' } });
    }
  };
}

// --- Console Provider (for development) ---

export function createConsoleProvider(): AnalyticsProvider {
  return async (events) => {
    events.forEach(e => {
      console.log(`[Analytics] ${e.category}/${e.name}`, e.properties || '');
    });
  };
}
