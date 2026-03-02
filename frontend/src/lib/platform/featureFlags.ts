// Platform Feature Flags - Registry, Remote Flags, A/B Tests & Rollout

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'ab_test';
  percentage?: number;
  allowedUsers?: string[];
  variants?: FlagVariant[];
  defaultVariant?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface FlagVariant {
  id: string;
  name: string;
  weight: number;
  payload?: Record<string, unknown>;
}

export interface FlagEvaluation {
  flagId: string;
  enabled: boolean;
  variant?: string;
  payload?: Record<string, unknown>;
  reason: 'default' | 'override' | 'percentage' | 'user_list' | 'remote' | 'expired' | 'disabled';
  timestamp: number;
}

export interface FlagOverride {
  flagId: string;
  enabled: boolean;
  variant?: string;
  source: 'local' | 'url' | 'api';
  expiresAt?: number;
}

export interface FlagAuditEntry {
  flagId: string;
  action: 'evaluate' | 'override' | 'update' | 'create' | 'delete';
  previousValue?: boolean;
  newValue?: boolean;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface RemoteFlagConfig {
  endpoint: string;
  pollIntervalMs?: number;
  headers?: Record<string, string>;
  timeout?: number;
}

// --- Feature Flag Engine ---

export class FeatureFlagEngine {
  private static STORAGE_KEY = 'feature_flags';
  private static OVERRIDE_KEY = 'feature_flag_overrides';
  private static AUDIT_KEY = 'feature_flag_audit';

  private flags = new Map<string, FeatureFlag>();
  private overrides = new Map<string, FlagOverride>();
  private evaluationCache = new Map<string, FlagEvaluation>();
  private auditLog: FlagAuditEntry[] = [];
  private maxAuditEntries = 500;
  private listeners = new Map<string, Set<(evaluation: FlagEvaluation) => void>>();
  private globalListeners = new Set<(flagId: string, evaluation: FlagEvaluation) => void>();
  private userId: string | null = null;
  private remoteConfig: RemoteFlagConfig | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cacheTTL = 5 * 60 * 1000;

  constructor() {
    this.loadPersistedFlags();
    this.loadOverrides();
    this.loadAuditLog();
    this.applyUrlOverrides();
  }

  // --- Registration ---

  register(flag: FeatureFlag): void {
    this.flags.set(flag.id, flag);
    this.persistFlags();
    this.addAuditEntry(flag.id, 'create', undefined, flag.enabled);
  }

  registerMany(flags: FeatureFlag[]): void {
    flags.forEach(f => this.flags.set(f.id, f));
    this.persistFlags();
  }

  update(flagId: string, updates: Partial<FeatureFlag>): void {
    const existing = this.flags.get(flagId);
    if (!existing) return;

    const previousEnabled = existing.enabled;
    Object.assign(existing, updates, { updatedAt: Date.now() });
    this.flags.set(flagId, existing);
    this.evaluationCache.delete(flagId);
    this.persistFlags();
    this.addAuditEntry(flagId, 'update', previousEnabled, existing.enabled);
  }

  remove(flagId: string): void {
    this.flags.delete(flagId);
    this.evaluationCache.delete(flagId);
    this.overrides.delete(flagId);
    this.persistFlags();
    this.persistOverrides();
    this.addAuditEntry(flagId, 'delete');
  }

  getFlag(flagId: string): FeatureFlag | undefined {
    return this.flags.get(flagId);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlagsByTag(tag: string): FeatureFlag[] {
    return this.getAllFlags().filter(f => f.tags?.includes(tag));
  }

  // --- Evaluation ---

  isEnabled(flagId: string, userId?: string): boolean {
    return this.evaluate(flagId, userId).enabled;
  }

  evaluate(flagId: string, userId?: string): FlagEvaluation {
    const uid = userId || this.userId;
    const cacheKey = `${flagId}:${uid || 'anon'}`;

    const cached = this.evaluationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }

    const override = this.overrides.get(flagId);
    if (override) {
      if (override.expiresAt && Date.now() > override.expiresAt) {
        this.overrides.delete(flagId);
        this.persistOverrides();
      } else {
        const evaluation: FlagEvaluation = {
          flagId,
          enabled: override.enabled,
          variant: override.variant,
          reason: 'override',
          timestamp: Date.now(),
        };
        this.cacheAndNotify(cacheKey, flagId, evaluation);
        return evaluation;
      }
    }

    const flag = this.flags.get(flagId);
    if (!flag) {
      const evaluation: FlagEvaluation = {
        flagId,
        enabled: false,
        reason: 'default',
        timestamp: Date.now(),
      };
      return evaluation;
    }

    if (flag.expiresAt && Date.now() > flag.expiresAt) {
      const evaluation: FlagEvaluation = {
        flagId,
        enabled: false,
        reason: 'expired',
        timestamp: Date.now(),
      };
      this.cacheAndNotify(cacheKey, flagId, evaluation);
      return evaluation;
    }

    if (!flag.enabled) {
      const evaluation: FlagEvaluation = {
        flagId,
        enabled: false,
        reason: 'disabled',
        timestamp: Date.now(),
      };
      this.cacheAndNotify(cacheKey, flagId, evaluation);
      return evaluation;
    }

    switch (flag.type) {
      case 'boolean': {
        const evaluation: FlagEvaluation = {
          flagId,
          enabled: true,
          reason: 'default',
          timestamp: Date.now(),
        };
        this.cacheAndNotify(cacheKey, flagId, evaluation);
        return evaluation;
      }

      case 'percentage': {
        const hash = this.hashUserForFlag(uid || 'anon', flagId);
        const bucket = hash % 100;
        const enabled = bucket < (flag.percentage ?? 0);
        const evaluation: FlagEvaluation = {
          flagId,
          enabled,
          reason: 'percentage',
          timestamp: Date.now(),
        };
        this.cacheAndNotify(cacheKey, flagId, evaluation);
        return evaluation;
      }

      case 'user_list': {
        const enabled = uid ? (flag.allowedUsers?.includes(uid) ?? false) : false;
        const evaluation: FlagEvaluation = {
          flagId,
          enabled,
          reason: 'user_list',
          timestamp: Date.now(),
        };
        this.cacheAndNotify(cacheKey, flagId, evaluation);
        return evaluation;
      }

      case 'ab_test': {
        if (!flag.variants?.length) {
          const evaluation: FlagEvaluation = { flagId, enabled: false, reason: 'default', timestamp: Date.now() };
          this.cacheAndNotify(cacheKey, flagId, evaluation);
          return evaluation;
        }

        const variant = this.selectVariant(uid || 'anon', flagId, flag.variants);
        const evaluation: FlagEvaluation = {
          flagId,
          enabled: true,
          variant: variant.id,
          payload: variant.payload,
          reason: 'percentage',
          timestamp: Date.now(),
        };
        this.cacheAndNotify(cacheKey, flagId, evaluation);
        return evaluation;
      }

      default: {
        const evaluation: FlagEvaluation = { flagId, enabled: false, reason: 'default', timestamp: Date.now() };
        return evaluation;
      }
    }
  }

  getVariant(flagId: string, userId?: string): string | null {
    const evaluation = this.evaluate(flagId, userId);
    return evaluation.variant ?? null;
  }

  getPayload<T = Record<string, unknown>>(flagId: string, userId?: string): T | null {
    const evaluation = this.evaluate(flagId, userId);
    return (evaluation.payload as T) ?? null;
  }

  private selectVariant(userId: string, flagId: string, variants: FlagVariant[]): FlagVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const hash = this.hashUserForFlag(userId, flagId);
    const bucket = hash % totalWeight;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) return variant;
    }
    return variants[variants.length - 1];
  }

  private hashUserForFlag(userId: string, flagId: string): number {
    const str = `${userId}:${flagId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private cacheAndNotify(cacheKey: string, flagId: string, evaluation: FlagEvaluation): void {
    this.evaluationCache.set(cacheKey, evaluation);
    this.addAuditEntry(flagId, 'evaluate', undefined, evaluation.enabled, { variant: evaluation.variant, reason: evaluation.reason });

    const listeners = this.listeners.get(flagId);
    listeners?.forEach(fn => fn(evaluation));
    this.globalListeners.forEach(fn => fn(flagId, evaluation));
  }

  // --- Overrides ---

  setOverride(flagId: string, enabled: boolean, variant?: string, expiresAt?: number): void {
    const previous = this.isEnabled(flagId);
    this.overrides.set(flagId, {
      flagId,
      enabled,
      variant,
      source: 'local',
      expiresAt,
    });
    this.evaluationCache.delete(flagId);
    this.persistOverrides();
    this.addAuditEntry(flagId, 'override', previous, enabled);
  }

  clearOverride(flagId: string): void {
    this.overrides.delete(flagId);
    this.evaluationCache.delete(flagId);
    this.persistOverrides();
  }

  clearAllOverrides(): void {
    this.overrides.clear();
    this.evaluationCache.clear();
    this.persistOverrides();
  }

  getOverrides(): FlagOverride[] {
    return Array.from(this.overrides.values());
  }

  private applyUrlOverrides(): void {
    if (typeof location === 'undefined') return;
    const params = new URLSearchParams(location.search);
    for (const [key, value] of params) {
      if (key.startsWith('ff_')) {
        const flagId = key.slice(3);
        this.overrides.set(flagId, {
          flagId,
          enabled: value === '1' || value === 'true',
          source: 'url',
        });
      }
    }
  }

  // --- Remote Flags ---

  setUserId(userId: string | null): void {
    this.userId = userId;
    this.evaluationCache.clear();
  }

  async configureRemote(config: RemoteFlagConfig): Promise<void> {
    this.remoteConfig = config;
    await this.fetchRemoteFlags();

    if (config.pollIntervalMs) {
      this.pollTimer = setInterval(() => {
        this.fetchRemoteFlags().catch(() => {});
      }, config.pollIntervalMs);
    }
  }

  async fetchRemoteFlags(): Promise<void> {
    if (!this.remoteConfig) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.remoteConfig.timeout || 5000);

      const response = await fetch(this.remoteConfig.endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...this.remoteConfig.headers,
          ...(this.userId ? { 'X-User-Id': this.userId } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as { flags: FeatureFlag[] };
      if (data.flags) {
        for (const flag of data.flags) {
          this.flags.set(flag.id, flag);
        }
        this.evaluationCache.clear();
        this.persistFlags();
      }
    } catch (error) {
      console.warn('Failed to fetch remote feature flags:', error);
    }
  }

  // --- Listeners ---

  onFlagChange(flagId: string, callback: (evaluation: FlagEvaluation) => void): () => void {
    if (!this.listeners.has(flagId)) this.listeners.set(flagId, new Set());
    this.listeners.get(flagId)!.add(callback);
    return () => this.listeners.get(flagId)?.delete(callback);
  }

  onAnyFlagChange(callback: (flagId: string, evaluation: FlagEvaluation) => void): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  // --- Audit ---

  private addAuditEntry(
    flagId: string,
    action: FlagAuditEntry['action'],
    previousValue?: boolean,
    newValue?: boolean,
    metadata?: Record<string, unknown>
  ): void {
    this.auditLog.push({
      flagId,
      action,
      previousValue,
      newValue,
      userId: this.userId || undefined,
      timestamp: Date.now(),
      metadata,
    });

    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }

    this.persistAuditLog();
  }

  getAuditLog(flagId?: string): FlagAuditEntry[] {
    if (flagId) return this.auditLog.filter(e => e.flagId === flagId);
    return [...this.auditLog];
  }

  // --- Persistence ---

  private persistFlags(): void {
    try {
      const data = Array.from(this.flags.values());
      localStorage.setItem(FeatureFlagEngine.STORAGE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  }

  private loadPersistedFlags(): void {
    try {
      const raw = localStorage.getItem(FeatureFlagEngine.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as FeatureFlag[];
      data.forEach(f => this.flags.set(f.id, f));
    } catch { /* noop */ }
  }

  private persistOverrides(): void {
    try {
      const data = Array.from(this.overrides.values());
      localStorage.setItem(FeatureFlagEngine.OVERRIDE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  }

  private loadOverrides(): void {
    try {
      const raw = localStorage.getItem(FeatureFlagEngine.OVERRIDE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as FlagOverride[];
      data.forEach(o => this.overrides.set(o.flagId, o));
    } catch { /* noop */ }
  }

  private persistAuditLog(): void {
    try {
      localStorage.setItem(FeatureFlagEngine.AUDIT_KEY, JSON.stringify(this.auditLog.slice(-100)));
    } catch { /* noop */ }
  }

  private loadAuditLog(): void {
    try {
      const raw = localStorage.getItem(FeatureFlagEngine.AUDIT_KEY);
      this.auditLog = raw ? JSON.parse(raw) : [];
    } catch { this.auditLog = []; }
  }

  // --- Cleanup ---

  destroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.listeners.clear();
    this.globalListeners.clear();
    this.evaluationCache.clear();
  }
}

// --- Default Flags Factory ---

export function createDefaultFlags(): FeatureFlag[] {
  const now = Date.now();
  return [
    { id: 'dark_pool_trading', name: 'Dark Pool Trading', description: 'Enable dark pool order routing', enabled: false, type: 'boolean', tags: ['trading'], createdAt: now, updatedAt: now },
    { id: 'advanced_charts', name: 'Advanced Chart Types', description: 'Enable Renko, P&F, and Kagi charts', enabled: true, type: 'boolean', tags: ['charts'], createdAt: now, updatedAt: now },
    { id: 'ai_predictions', name: 'AI Price Predictions', description: 'ML-based price predictions overlay', enabled: false, type: 'percentage', percentage: 10, tags: ['ai', 'beta'], createdAt: now, updatedAt: now },
    { id: 'social_trading', name: 'Social Trading', description: 'Copy trading and social features', enabled: false, type: 'percentage', percentage: 25, tags: ['social', 'beta'], createdAt: now, updatedAt: now },
    { id: 'options_chain', name: 'Options Chain', description: 'Options chain visualization', enabled: true, type: 'boolean', tags: ['options'], createdAt: now, updatedAt: now },
    { id: 'new_order_panel', name: 'New Order Panel', description: 'Redesigned order entry panel', enabled: true, type: 'ab_test', variants: [{ id: 'control', name: 'Current', weight: 50 }, { id: 'variant_a', name: 'Redesign A', weight: 25 }, { id: 'variant_b', name: 'Redesign B', weight: 25 }], defaultVariant: 'control', tags: ['trading', 'experiment'], createdAt: now, updatedAt: now },
    { id: 'portfolio_analytics', name: 'Portfolio Analytics', description: 'Advanced portfolio analytics dashboard', enabled: true, type: 'boolean', tags: ['portfolio'], createdAt: now, updatedAt: now },
    { id: 'multi_monitor', name: 'Multi-Monitor Support', description: 'Pop-out windows for multi-monitor setups', enabled: false, type: 'boolean', tags: ['layout'], createdAt: now, updatedAt: now },
    { id: 'risk_management', name: 'Risk Management Tools', description: 'VaR, stress testing, and risk metrics', enabled: true, type: 'boolean', tags: ['risk'], createdAt: now, updatedAt: now },
    { id: 'crypto_trading', name: 'Cryptocurrency Trading', description: 'Enable crypto pairs trading', enabled: true, type: 'boolean', tags: ['trading', 'crypto'], createdAt: now, updatedAt: now },
  ];
}
