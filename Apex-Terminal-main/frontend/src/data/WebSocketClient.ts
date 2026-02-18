import type { WSMessage } from '../core/types.ts';

// WebSocket connection states
export type WSConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED';

export interface WSStateDetails {
    reconnectAttempts: number;
}

type MessageCallback = (msg: WSMessage) => void;
type StateChangeCallback = (state: WSConnectionState, prevState: WSConnectionState, details?: WSStateDetails) => void;

export class WebSocketClient {
    private url: string;
    private socket: WebSocket | null = null;
    private onMessage: MessageCallback;
    private onStateChange?: StateChangeCallback;
    private shouldReconnect: boolean = true;
    private reconnectDelay: number = 1000; // Start at 1s
    private maxReconnectDelay: number = 30000; // Max 30s
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 1000; // Effectively infinite (was 50)
    private connectionStartTime: number = 0;
    private lastHeartbeat: number = 0;
    private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;
    private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    private _state: WSConnectionState = 'DISCONNECTED';
    private degradedThreshold: number = 30000; // 30s without heartbeat = degraded
    private reconnectThreshold: number = 35000; // 35s without heartbeat = reconnect (Strict Stale Detection)
    private connectionStableTimer: ReturnType<typeof setTimeout> | null = null;
    private visibilityHandler: (() => void) | null = null;

    // E2E Config Overrides
    public static overrideThresholds(degraded: number, reconnect: number) {
        WebSocketClient.E2E_DEGRADED_MS = degraded;
        WebSocketClient.E2E_RECONNECT_MS = reconnect;
    }
    private static E2E_DEGRADED_MS: number | null = null;
    private static E2E_RECONNECT_MS: number | null = null;

    constructor(url: string, onMessage: MessageCallback, onStateChange?: StateChangeCallback) {
        this.url = url;
        this.onMessage = onMessage;
        this.onStateChange = onStateChange;

        // Apply overrides if set
        if (WebSocketClient.E2E_DEGRADED_MS) this.degradedThreshold = WebSocketClient.E2E_DEGRADED_MS;
        if (WebSocketClient.E2E_RECONNECT_MS) this.reconnectThreshold = WebSocketClient.E2E_RECONNECT_MS;
    }

    // State machine getter
    public get state(): WSConnectionState {
        return this._state;
    }

    private setState(newState: WSConnectionState) {
        if (this._state !== newState) {
            const prevState = this._state;
            this._state = newState;
            console.log(`WS State: ${prevState} -> ${newState}`);
            this.onStateChange?.(newState, prevState, { reconnectAttempts: this.reconnectAttempts });
        } else if (newState === 'CONNECTING') {
            // Force update for attempt counting
            this.onStateChange?.(newState, this._state, { reconnectAttempts: this.reconnectAttempts });
        }
    }

    private getReconnectDelay(): number {
        // Exponential backoff with jitter
        const baseDelay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        const jitter = Math.random() * 1000; // 0-1s jitter
        return baseDelay + jitter;
    }

    private startHeartbeatCheck() {
        if (this.heartbeatCheckInterval) {
            clearInterval(this.heartbeatCheckInterval);
        }
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }

        // Check every 5s for tighter control (was 15s)
        this.heartbeatCheckInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastHeartbeat = now - this.lastHeartbeat;

            // If no heartbeat in degradedThreshold, mark as degraded
            if (this.lastHeartbeat > 0 && this._state === 'CONNECTED' && timeSinceLastHeartbeat > this.degradedThreshold) {
                this.setState('DEGRADED');
            }

            // If no heartbeat in reconnectThreshold (35s), reconnect
            if (this.lastHeartbeat > 0 && timeSinceLastHeartbeat > this.reconnectThreshold) {
                console.warn(`No heartbeat received in ${this.reconnectThreshold}ms, reconnecting...`);
                this.reconnect();
            }
        }, 5000);

        // Proactive keepalive ping every 20s (prevents idle disconnects)
        this.keepAliveInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                    this.socket.send(JSON.stringify({ action: 'ping' }));
                } catch (e) {
                    console.warn('Keepalive ping failed', e);
                }
            }
        }, 20000);
    }

    private stopHeartbeatCheck() {
        if (this.heartbeatCheckInterval) {
            clearInterval(this.heartbeatCheckInterval);
            this.heartbeatCheckInterval = null;
        }
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    private reconnect() {
        this.shouldReconnect = true;
        if (this.socket) {
            try {
                this.socket.close();
            } catch { }
            this.socket = null;
        }
        this.connect();
    }

    /**
     * Force a reconnection attempt - resets attempt counter and reconnects immediately
     */
    public forceReconnect() {
        console.log('Force reconnect requested');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.reconnect();
    }

    public connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            console.log('WS already connected or connecting');
            return;
        }

        this.shouldReconnect = true;
        this.connectionStartTime = Date.now();
        this.setState('CONNECTING');

        const delay = this.reconnectAttempts > 0 ? this.getReconnectDelay() : 0;
        console.log(`Connecting to ${this.url}${this.reconnectAttempts > 0 ? ` (attempt ${this.reconnectAttempts + 1}, delay ${Math.round(delay)}ms)` : ''}`);

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                const connectionTime = Date.now() - this.connectionStartTime;
                console.log(`WS Connected in ${connectionTime}ms`);

                // Don't reset backoff immediately. Wait for stable connection.
                if (this.connectionStableTimer) {
                    clearTimeout(this.connectionStableTimer);
                }

                // If connection holds for 5 seconds, we consider it stable and reset the backoff
                this.connectionStableTimer = setTimeout(() => {
                    console.log('WS Connection Stable - Resetting Backoff');
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = 1000;
                    this.connectionStableTimer = null;
                }, 5000);

                this.lastHeartbeat = Date.now();

                this.setState('CONNECTED');

                // Start monitoring heartbeats
                this.startHeartbeatCheck();

                // Add visibility change handler for tab focus
                this.setupVisibilityHandler();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as WSMessage;
                    // Auto-respond to server heartbeat to keep connection alive
                    if ((data as any).type === 'HEARTBEAT') {
                        this.lastHeartbeat = Date.now();
                        // If we were degraded, we're now connected again
                        if (this._state === 'DEGRADED') {
                            this.setState('CONNECTED');
                        }
                        try {
                            this.socket?.send(JSON.stringify({ action: 'ping' }));
                        } catch (e) {
                            console.error('Failed to send heartbeat response', e);
                        }
                        return;
                    }
                    // Handle server request to refresh connection
                    if ((data as any).type === 'REFRESH_REQUIRED') {
                        console.log('Server requested connection refresh:', (data as any).reason);
                        this.forceReconnect();
                        return;
                    }
                    this.onMessage(data);
                } catch (e) {
                    console.error('Failed to parse WS message', e);
                }
            };

            this.socket.onclose = () => {
                this.stopHeartbeatCheck();

                // If connection didn't stabilize, cancel the reset timer
                if (this.connectionStableTimer) {
                    clearTimeout(this.connectionStableTimer);
                    this.connectionStableTimer = null;
                }

                this.setState('DISCONNECTED');

                if (this.shouldReconnect) {
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`);
                        this.shouldReconnect = false;
                        return;
                    }

                    this.reconnectAttempts++;
                    const delay = this.getReconnectDelay();
                    console.log(`WS Closed, reconnecting in ${Math.round(delay)}ms...`);
                    setTimeout(() => this.connect(), delay);
                } else {
                    console.log('WS Disconnected Cleanly');
                }
            };

            this.socket.onerror = () => {
                console.log('WS Error Event');
                // On error, let onclose handle reconnect if valid
            };
        } catch (e) {
            console.error('WS Connection Creation Failed', e);
            if (this.shouldReconnect) {
                setTimeout(() => this.connect(), this.reconnectDelay);
            }
        }
    }

    private setupVisibilityHandler() {
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }

        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible - check connection health
                const timeSinceLastHeartbeat = this.lastHeartbeat > 0 ? Date.now() - this.lastHeartbeat : 0;

                if (this._state === 'DISCONNECTED' ||
                    (this._state === 'DEGRADED' && timeSinceLastHeartbeat > this.reconnectThreshold)) {
                    console.log('Tab visible, reconnecting WebSocket...');
                    this.forceReconnect();
                } else if (this._state === 'CONNECTED' && timeSinceLastHeartbeat > 30000) {
                    // Send a ping to verify connection is still alive
                    try {
                        this.socket?.send(JSON.stringify({ action: 'ping' }));
                    } catch {
                        this.forceReconnect();
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    private removeVisibilityHandler() {
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }

    public disconnect() {
        this.shouldReconnect = false;
        this.stopHeartbeatCheck();
        this.removeVisibilityHandler();

        if (this.socket) {
            this.socket.onclose = null;
            this.socket.onerror = null; // Prevent error log on manual close
            try {
                this.socket.close();
            } catch {
                // Ignore close errors on already-closed sockets
            }
            console.log('WebSocket connection to', this.url, 'closed');
            this.socket = null;
        }

        this.setState('DISCONNECTED');

        // Reset state
        this.reconnectAttempts = 0;
        this.lastHeartbeat = 0;
    }

    public getConnectionStats() {
        return {
            state: this._state,
            connected: this.socket?.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts,
            lastHeartbeat: this.lastHeartbeat,
            timeSinceLastHeartbeat: this.lastHeartbeat > 0 ? Date.now() - this.lastHeartbeat : null
        };
    }
}
