/**
 * WebSocketService — unified WebSocket management for real-time data streams.
 *
 * Provides: connection management, auto-reconnect, heartbeat,
 * message routing, subscription multiplexing, binary frame support.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect: boolean;
  reconnectDelay: number;       // initial ms
  reconnectMaxDelay: number;    // max backoff ms
  reconnectAttempts: number;    // 0 = infinite
  heartbeatInterval: number;    // ms, 0 = disabled
  heartbeatMessage: string;
  heartbeatTimeout: number;     // ms, expected pong within
  binaryType: BinaryType;
  debug: boolean;
}

export interface Subscription {
  id: string;
  channel: string;
  params?: Record<string, any>;
  callback: (data: any) => void;
}

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  id?: string;
  timestamp?: number;
}

export interface WebSocketStats {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  reconnectCount: number;
  lastMessageAt: number;
  connectedAt: number;
  latency: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WebSocketConfig = {
  url: '',
  reconnect: true,
  reconnectDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectAttempts: 0,
  heartbeatInterval: 30000,
  heartbeatMessage: 'ping',
  heartbeatTimeout: 5000,
  binaryType: 'arraybuffer',
  debug: false,
};

export class WebSocketService {
  private config: WebSocketConfig;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private subscriptions: Map<string, Subscription> = new Map();
  private channelSubscribers: Map<string, Set<string>> = new Map();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private stats: WebSocketStats;
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private messageListeners: Array<(message: WebSocketMessage) => void> = [];
  private subCounter = 0;
  private pendingSubscriptions: Subscription[] = [];

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      reconnectCount: 0,
      lastMessageAt: 0,
      connectedAt: 0,
      latency: 0,
    };
  }

  connect(url?: string): void {
    if (url) this.config.url = url;
    if (!this.config.url) {
      this.log('No URL configured');
      return;
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.ws.binaryType = this.config.binaryType;

      this.ws.onopen = () => {
        this.log('Connected');
        this.setStatus('connected');
        this.reconnectAttempt = 0;
        this.stats.connectedAt = Date.now();

        // Re-subscribe
        this.resubscribe();

        // Process pending subscriptions
        this.pendingSubscriptions.forEach(sub => {
          this.sendSubscribe(sub);
        });
        this.pendingSubscriptions = [];

        // Start heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        this.stats.messagesReceived++;
        this.stats.lastMessageAt = Date.now();

        if (typeof event.data === 'string') {
          this.stats.bytesReceived += event.data.length;
          this.handleMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.stats.bytesReceived += event.data.byteLength;
          this.handleBinaryMessage(event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.log(`Disconnected: ${event.code} ${event.reason}`);
        this.stopHeartbeat();

        if (this.status !== 'disconnected' && this.config.reconnect) {
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };

      this.ws.onerror = (event) => {
        this.log('Error occurred');
        this.setStatus('error');
      };
    } catch (err) {
      this.log(`Connection failed: ${err}`);
      this.setStatus('error');
      if (this.config.reconnect) this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.config.reconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  subscribe(channel: string, callback: (data: any) => void, params?: Record<string, any>): string {
    const id = `ws_sub_${++this.subCounter}`;
    const sub: Subscription = { id, channel, params, callback };
    this.subscriptions.set(id, sub);

    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)!.add(id);

    if (this.status === 'connected') {
      this.sendSubscribe(sub);
    } else {
      this.pendingSubscriptions.push(sub);
    }

    return id;
  }

  unsubscribe(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;

    this.subscriptions.delete(subscriptionId);
    const channelSubs = this.channelSubscribers.get(sub.channel);
    if (channelSubs) {
      channelSubs.delete(subscriptionId);
      if (channelSubs.size === 0) {
        this.channelSubscribers.delete(sub.channel);
        this.sendUnsubscribe(sub.channel);
      }
    }
  }

  send(message: WebSocketMessage | string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('Cannot send: not connected');
      return;
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(data);
    this.stats.messagesSent++;
    this.stats.bytesSent += data.length;
  }

  sendBinary(data: ArrayBuffer | Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(data);
    this.stats.messagesSent++;
    this.stats.bytesSent += data.byteLength;
  }

  getStatus(): ConnectionStatus { return this.status; }
  getStats(): WebSocketStats { return { ...this.stats }; }
  isConnected(): boolean { return this.status === 'connected'; }

  onStatus(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const idx = this.statusListeners.indexOf(callback);
      if (idx >= 0) this.statusListeners.splice(idx, 1);
    };
  }

  onMessage(callback: (message: WebSocketMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      const idx = this.messageListeners.indexOf(callback);
      if (idx >= 0) this.messageListeners.splice(idx, 1);
    };
  }

  private handleMessage(raw: string): void {
    // Handle pong
    if (raw === 'pong') {
      this.handlePong();
      return;
    }

    try {
      const msg: WebSocketMessage = JSON.parse(raw);
      this.messageListeners.forEach(cb => cb(msg));

      // Route to channel subscribers
      if (msg.channel) {
        const subs = this.channelSubscribers.get(msg.channel);
        if (subs) {
          subs.forEach(subId => {
            const sub = this.subscriptions.get(subId);
            sub?.callback(msg.data);
          });
        }
      }

      // Route by type
      if (msg.type) {
        const subs = this.channelSubscribers.get(msg.type);
        if (subs) {
          subs.forEach(subId => {
            const sub = this.subscriptions.get(subId);
            sub?.callback(msg.data || msg);
          });
        }
      }
    } catch {
      // Non-JSON message — treat as raw
      this.messageListeners.forEach(cb => cb({ type: 'raw', data: raw }));
    }
  }

  private handleBinaryMessage(data: ArrayBuffer): void {
    this.messageListeners.forEach(cb => cb({ type: 'binary', data }));
  }

  private sendSubscribe(sub: Subscription): void {
    this.send({
      type: 'subscribe',
      channel: sub.channel,
      data: sub.params,
      id: sub.id,
    });
  }

  private sendUnsubscribe(channel: string): void {
    this.send({
      type: 'unsubscribe',
      channel,
    });
  }

  private resubscribe(): void {
    const channels = new Set<string>();
    this.subscriptions.forEach(sub => {
      if (!channels.has(sub.channel)) {
        channels.add(sub.channel);
        this.sendSubscribe(sub);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.config.reconnectAttempts > 0 && this.reconnectAttempt >= this.config.reconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.config.reconnectMaxDelay,
    );

    this.setStatus('reconnecting');
    this.reconnectAttempt++;
    this.stats.reconnectCount++;
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;
    this.heartbeatTimer = setInterval(() => {
      this.send(this.config.heartbeatMessage);
      this.heartbeatTimeoutTimer = setTimeout(() => {
        this.log('Heartbeat timeout — reconnecting');
        this.ws?.close(4000, 'Heartbeat timeout');
      }, this.config.heartbeatTimeout);
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.heartbeatTimeoutTimer) { clearTimeout(this.heartbeatTimeoutTimer); this.heartbeatTimeoutTimer = null; }
  }

  private handlePong(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
    this.stats.latency = Date.now() - this.stats.lastMessageAt;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(cb => cb(status));
  }

  private log(msg: string): void {
    if (this.config.debug) console.log(`[WS] ${msg}`);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

const instances: Map<string, WebSocketService> = new Map();

export function getWebSocketService(name: string, config?: Partial<WebSocketConfig>): WebSocketService {
  if (!instances.has(name)) {
    instances.set(name, new WebSocketService(config));
  }
  return instances.get(name)!;
}

export function removeWebSocketService(name: string): void {
  const ws = instances.get(name);
  if (ws) {
    ws.disconnect();
    instances.delete(name);
  }
}

export function removeAllWebSocketServices(): void {
  instances.forEach(ws => ws.disconnect());
  instances.clear();
}

export default WebSocketService;
