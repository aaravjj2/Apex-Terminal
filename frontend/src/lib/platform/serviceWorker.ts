// Platform Service Worker Management - Registration, Caching & Offline

export type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';

export interface CacheRoute {
  pattern: RegExp | string;
  strategy: CacheStrategy;
  cacheName?: string;
  maxAge?: number;
  maxEntries?: number;
}

export interface SWConfig {
  cacheVersion: string;
  precacheUrls: string[];
  routes: CacheRoute[];
  offlineFallbackUrl?: string;
  enableBackgroundSync?: boolean;
  enablePushNotifications?: boolean;
  onUpdate?: () => void;
  onInstall?: () => void;
  onActivate?: () => void;
}

export interface SyncTask {
  id: string;
  tag: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
}

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
}

interface CacheEntry {
  response: Response;
  timestamp: number;
}

// --- Service Worker Registration ---

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: SWConfig;
  private updateListeners = new Set<(reg: ServiceWorkerRegistration) => void>();
  private stateListeners = new Set<(state: 'installing' | 'waiting' | 'active' | 'redundant') => void>();
  private messageListeners = new Map<string, Set<(data: unknown) => void>>();
  private syncQueue: SyncTask[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: SWConfig) {
    this.config = config;
    this.loadSyncQueue();
  }

  async register(swUrl = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });

      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          this.stateListeners.forEach(fn => fn(newWorker.state as 'installing' | 'waiting' | 'active' | 'redundant'));

          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.updateListeners.forEach(fn => fn(this.registration!));
            this.config.onUpdate?.();
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data || {};
        if (type) {
          const listeners = this.messageListeners.get(type);
          listeners?.forEach(fn => fn(data));
        }
      });

      if (this.registration.active) {
        this.sendConfig();
      } else {
        navigator.serviceWorker.ready.then(() => this.sendConfig());
      }

      this.startUpdateCheck();
      this.config.onInstall?.();
      return this.registration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  }

  private sendConfig(): void {
    this.sendMessage('CONFIG', {
      cacheVersion: this.config.cacheVersion,
      precacheUrls: this.config.precacheUrls,
      routes: this.config.routes.map(r => ({
        pattern: r.pattern instanceof RegExp ? r.pattern.source : r.pattern,
        strategy: r.strategy,
        cacheName: r.cacheName,
        maxAge: r.maxAge,
        maxEntries: r.maxEntries,
      })),
      offlineFallbackUrl: this.config.offlineFallbackUrl,
    });
  }

  async unregister(): Promise<boolean> {
    this.stopUpdateCheck();
    if (!this.registration) return false;
    return this.registration.unregister();
  }

  async update(): Promise<void> {
    await this.registration?.update();
  }

  skipWaiting(): void {
    const waiting = this.registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  private startUpdateCheck(intervalMs = 60 * 60 * 1000): void {
    this.checkInterval = setInterval(() => {
      this.registration?.update().catch(() => {});
    }, intervalMs);
  }

  private stopUpdateCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  isActive(): boolean {
    return !!this.registration?.active;
  }

  hasUpdate(): boolean {
    return !!this.registration?.waiting;
  }

  onUpdate(callback: (reg: ServiceWorkerRegistration) => void): () => void {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  onStateChange(callback: (state: 'installing' | 'waiting' | 'active' | 'redundant') => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onMessage(type: string, callback: (data: unknown) => void): () => void {
    if (!this.messageListeners.has(type)) this.messageListeners.set(type, new Set());
    this.messageListeners.get(type)!.add(callback);
    return () => this.messageListeners.get(type)?.delete(callback);
  }

  sendMessage(type: string, data?: unknown): void {
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
      controller.postMessage({ type, data });
    }
  }

  // --- Cache Management ---

  async getCacheNames(): Promise<string[]> {
    return caches.keys();
  }

  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  }

  async getCacheSize(cacheName?: string): Promise<number> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) return 0;
    if (cacheName) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      let size = 0;
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          size += blob.size;
        }
      }
      return size;
    }
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }

  async cleanupOldCaches(): Promise<void> {
    const validCachePrefix = `v${this.config.cacheVersion}`;
    const names = await caches.keys();
    const oldCaches = names.filter(n => !n.startsWith(validCachePrefix) && !n.startsWith('precache'));
    await Promise.all(oldCaches.map(n => caches.delete(n)));
  }

  // --- Background Sync ---

  async queueSync(task: Omit<SyncTask, 'id' | 'retryCount' | 'createdAt'>): Promise<string> {
    const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const syncTask: SyncTask = {
      ...task,
      id,
      retryCount: 0,
      createdAt: Date.now(),
    };

    this.syncQueue.push(syncTask);
    this.persistSyncQueue();

    if ('SyncManager' in window && this.registration) {
      try {
        await this.registration.sync.register(task.tag);
      } catch {
        this.processSyncQueue();
      }
    } else {
      this.processSyncQueue();
    }

    return id;
  }

  async processSyncQueue(): Promise<void> {
    const pending = [...this.syncQueue];

    for (const task of pending) {
      try {
        const response = await fetch(task.url, {
          method: task.method,
          headers: task.headers,
          body: task.body,
        });

        if (response.ok) {
          this.syncQueue = this.syncQueue.filter(t => t.id !== task.id);
        } else if (task.retryCount < task.maxRetries) {
          task.retryCount++;
        } else {
          this.syncQueue = this.syncQueue.filter(t => t.id !== task.id);
        }
      } catch {
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
        } else {
          this.syncQueue = this.syncQueue.filter(t => t.id !== task.id);
        }
      }
    }

    this.persistSyncQueue();
  }

  getSyncQueue(): SyncTask[] {
    return [...this.syncQueue];
  }

  private persistSyncQueue(): void {
    try { localStorage.setItem('sw_sync_queue', JSON.stringify(this.syncQueue)); } catch { /* noop */ }
  }

  private loadSyncQueue(): void {
    try {
      const raw = localStorage.getItem('sw_sync_queue');
      this.syncQueue = raw ? JSON.parse(raw) : [];
    } catch { this.syncQueue = []; }
  }

  // --- Push Notifications ---

  async subscribeToPush(applicationServerKey: string): Promise<PushSubscriptionInfo | null> {
    if (!this.registration) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
      });

      const json = subscription.toJSON();
      return {
        endpoint: json.endpoint!,
        keys: {
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        expirationTime: json.expirationTime ?? null,
      };
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) return false;
    const subscription = await this.registration.pushManager.getSubscription();
    return subscription ? subscription.unsubscribe() : false;
  }

  async getPushSubscription(): Promise<PushSubscriptionInfo | null> {
    if (!this.registration) return null;
    const subscription = await this.registration.pushManager.getSubscription();
    if (!subscription) return null;
    const json = subscription.toJSON();
    return {
      endpoint: json.endpoint!,
      keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      expirationTime: json.expirationTime ?? null,
    };
  }

  isPushSupported(): boolean {
    return 'PushManager' in window && 'Notification' in window;
  }

  async getPushPermission(): Promise<NotificationPermission> {
    return Notification.permission;
  }

  destroy(): void {
    this.stopUpdateCheck();
    this.updateListeners.clear();
    this.stateListeners.clear();
    this.messageListeners.clear();
  }
}

// --- Runtime Cache (Client-Side) ---

export class RuntimeCache {
  private caches = new Map<string, Map<string, CacheEntry>>();
  private maxEntries: number;
  private maxAge: number;

  constructor(options?: { maxEntries?: number; maxAge?: number }) {
    this.maxEntries = options?.maxEntries ?? 100;
    this.maxAge = options?.maxAge ?? 5 * 60 * 1000;
  }

  async get(cacheName: string, request: Request): Promise<Response | null> {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    const entry = cache.get(request.url);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      cache.delete(request.url);
      return null;
    }

    return entry.response.clone();
  }

  async put(cacheName: string, request: Request, response: Response): Promise<void> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new Map());
    }

    const cache = this.caches.get(cacheName)!;

    if (cache.size >= this.maxEntries) {
      const oldest = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    cache.set(request.url, { response: response.clone(), timestamp: Date.now() });
  }

  clear(cacheName?: string): void {
    if (cacheName) {
      this.caches.delete(cacheName);
    } else {
      this.caches.clear();
    }
  }
}

// --- Offline Detection ---

export class OfflineDetector {
  private listeners = new Set<(online: boolean) => void>();
  private online: boolean;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor() {
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.onlineHandler = () => { this.online = true; this.notify(); };
    this.offlineHandler = () => { this.online = false; this.notify(); };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  isOnline(): boolean { return this.online; }

  onChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.online));
  }

  async ping(url = '/api/health'): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      this.online = response.ok;
    } catch {
      this.online = false;
    }
    this.notify();
    return this.online;
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
    this.listeners.clear();
  }
}

// --- Helpers ---

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- Default Config ---

export function createDefaultSWConfig(version: string): SWConfig {
  return {
    cacheVersion: version,
    precacheUrls: ['/', '/index.html', '/manifest.json'],
    routes: [
      { pattern: /\.(js|css|woff2?|ttf|eot)$/i, strategy: 'cache-first', cacheName: 'static-assets', maxAge: 30 * 24 * 60 * 60 * 1000 },
      { pattern: /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i, strategy: 'cache-first', cacheName: 'images', maxAge: 7 * 24 * 60 * 60 * 1000 },
      { pattern: /\/api\/market-data/, strategy: 'network-first', cacheName: 'market-data', maxAge: 60 * 1000 },
      { pattern: /\/api\//, strategy: 'network-first', cacheName: 'api-responses', maxAge: 5 * 60 * 1000 },
      { pattern: /.*/, strategy: 'stale-while-revalidate', cacheName: 'pages', maxAge: 24 * 60 * 60 * 1000 },
    ],
    offlineFallbackUrl: '/offline.html',
    enableBackgroundSync: true,
    enablePushNotifications: true,
  };
}
