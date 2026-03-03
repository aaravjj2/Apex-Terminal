/**
 * AnalyticsService — centralized analytics, metrics collection,
 * event tracking, user journey, performance monitoring.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  name: string;
  category: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface PageView {
  path: string;
  title: string;
  referrer: string;
  timestamp: number;
  duration?: number;
  sessionId: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'fps' | 'count' | 'percent';
  timestamp: number;
  tags: Record<string, string>;
}

export interface UserJourney {
  sessionId: string;
  steps: Array<{
    action: string;
    page: string;
    timestamp: number;
    duration: number;
    data?: Record<string, any>;
  }>;
  startedAt: number;
  endedAt?: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  sampleRate: number;       // 0-1
  maxEvents: number;
  flushInterval: number;    // ms
  endpoint?: string;
  anonymize: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class AnalyticsService {
  private config: AnalyticsConfig;
  private events: AnalyticsEvent[] = [];
  private pageViews: PageView[] = [];
  private metrics: PerformanceMetric[] = [];
  private journey: UserJourney;
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentPage: { path: string; enteredAt: number } | null = null;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      enabled: true,
      debug: false,
      sampleRate: 1,
      maxEvents: 10000,
      flushInterval: 30000,
      anonymize: true,
      ...config,
    };
    this.sessionId = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.journey = {
      sessionId: this.sessionId,
      steps: [],
      startedAt: Date.now(),
    };
  }

  // ── Event Tracking ─────────────────────────────────────────────────────────

  track(name: string, properties: Record<string, any> = {}, category = 'general'): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    const event: AnalyticsEvent = {
      name,
      category,
      properties: this.config.anonymize ? this.anonymizeProperties(properties) : properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.events.push(event);
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents / 2);
    }

    this.log(`Track: ${name}`, properties);
  }

  // ── Trading Events ─────────────────────────────────────────────────────────

  trackOrderSubmitted(symbol: string, side: string, type: string, quantity: number): void {
    this.track('order_submitted', { symbol, side, type, quantity }, 'trading');
  }

  trackOrderFilled(symbol: string, side: string, price: number, quantity: number): void {
    this.track('order_filled', { symbol, side, price, quantity }, 'trading');
  }

  trackPositionOpened(symbol: string, side: string, size: number): void {
    this.track('position_opened', { symbol, side, size }, 'trading');
  }

  trackPositionClosed(symbol: string, pnl: number, holdingPeriod: number): void {
    this.track('position_closed', { symbol, pnl, holdingPeriod }, 'trading');
  }

  trackAlertTriggered(alertType: string, symbol: string): void {
    this.track('alert_triggered', { alertType, symbol }, 'alerts');
  }

  trackBacktestRun(strategy: string, period: string, result: number): void {
    this.track('backtest_run', { strategy, period, result }, 'backtest');
  }

  trackChartAction(action: string, data?: Record<string, any>): void {
    this.track(`chart_${action}`, data || {}, 'chart');
  }

  trackDrawingCreated(type: string): void {
    this.track('drawing_created', { type }, 'drawing');
  }

  trackIndicatorAdded(name: string): void {
    this.track('indicator_added', { name }, 'indicator');
  }

  trackScreenerRun(filters: number, results: number): void {
    this.track('screener_run', { filters, results }, 'screener');
  }

  // ── Page Views ─────────────────────────────────────────────────────────────

  trackPageView(path: string, title = ''): void {
    if (!this.config.enabled) return;

    // Close previous page
    if (this.currentPage) {
      const duration = Date.now() - this.currentPage.enteredAt;
      const prevView = this.pageViews[this.pageViews.length - 1];
      if (prevView) prevView.duration = duration;
    }

    const pageView: PageView = {
      path,
      title,
      referrer: this.currentPage?.path || '',
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.pageViews.push(pageView);
    this.currentPage = { path, enteredAt: Date.now() };

    // Add to journey
    this.journey.steps.push({
      action: 'page_view',
      page: path,
      timestamp: Date.now(),
      duration: 0,
    });

    this.log(`PageView: ${path}`);
  }

  // ── Performance Metrics ────────────────────────────────────────────────────

  recordMetric(name: string, value: number, unit: PerformanceMetric['unit'] = 'ms', tags: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    this.metrics.push({
      name, value, unit,
      timestamp: Date.now(),
      tags,
    });

    // Keep last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  measureStart(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(name, +duration.toFixed(2), 'ms');
    };
  }

  recordFPS(fps: number): void {
    this.recordMetric('fps', fps, 'fps');
  }

  recordRenderTime(ms: number): void {
    this.recordMetric('render_time', ms, 'ms');
  }

  recordMemory(bytes: number): void {
    this.recordMetric('memory', bytes, 'bytes');
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getEvents(category?: string, limit = 100): AnalyticsEvent[] {
    let events = category ? this.events.filter(e => e.category === category) : this.events;
    return events.slice(-limit);
  }

  getPageViews(): PageView[] {
    return [...this.pageViews];
  }

  getMetrics(name?: string): PerformanceMetric[] {
    return name ? this.metrics.filter(m => m.name === name) : [...this.metrics];
  }

  getMetricAverage(name: string, windowMs = 60000): number {
    const cutoff = Date.now() - windowMs;
    const recent = this.metrics.filter(m => m.name === name && m.timestamp > cutoff);
    if (recent.length === 0) return 0;
    return recent.reduce((s, m) => s + m.value, 0) / recent.length;
  }

  getJourney(): UserJourney {
    return { ...this.journey };
  }

  getSessionDuration(): number {
    return Date.now() - this.journey.startedAt;
  }

  getEventCount(category?: string, windowMs?: number): number {
    let events = this.events;
    if (category) events = events.filter(e => e.category === category);
    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      events = events.filter(e => e.timestamp > cutoff);
    }
    return events.length;
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  getSummary(): Record<string, any> {
    const categories = new Map<string, number>();
    this.events.forEach(e => categories.set(e.category, (categories.get(e.category) || 0) + 1));

    return {
      sessionId: this.sessionId,
      duration: this.getSessionDuration(),
      totalEvents: this.events.length,
      totalPageViews: this.pageViews.length,
      totalMetrics: this.metrics.length,
      journeySteps: this.journey.steps.length,
      eventsByCategory: Object.fromEntries(categories),
      avgFPS: this.getMetricAverage('fps'),
      avgRenderTime: this.getMetricAverage('render_time'),
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  startAutoFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  stopAutoFlush(): void {
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null; }
  }

  flush(): void {
    if (this.config.endpoint) {
      this.log(`Flushing ${this.events.length} events`);
      // Would send to endpoint in production
    }
  }

  reset(): void {
    this.events = [];
    this.pageViews = [];
    this.metrics = [];
    this.journey = {
      sessionId: this.sessionId,
      steps: [],
      startedAt: Date.now(),
    };
    this.currentPage = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private anonymizeProperties(props: Record<string, any>): Record<string, any> {
    const anonymized = { ...props };
    const sensitiveKeys = ['email', 'name', 'phone', 'address', 'ssn', 'password', 'token', 'key', 'secret'];
    sensitiveKeys.forEach(key => {
      if (key in anonymized) anonymized[key] = '***';
    });
    return anonymized;
  }

  private log(msg: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Analytics] ${msg}`, data || '');
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: AnalyticsService | null = null;

export function getAnalyticsService(config?: Partial<AnalyticsConfig>): AnalyticsService {
  if (!instance) instance = new AnalyticsService(config);
  return instance;
}

export function resetAnalyticsService(): void {
  if (instance) { instance.reset(); instance = null; }
}

export default AnalyticsService;
