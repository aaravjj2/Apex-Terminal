/**
 * Telemetry Store - v1.103
 * WebSocket-first telemetry event streaming with polling fallback.
 * Deterministic in DEMO mode.
 */

interface TelemetryEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  sequence: number;
  source: string;
  data: Record<string, any>;
  tags: Record<string, string>;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'fallback';

interface TelemetryState {
  events: TelemetryEvent[];
  connectionStatus: ConnectionStatus;
  lastSequence: number;
}

// State
let state: TelemetryState = {
  events: [],
  connectionStatus: 'disconnected',
  lastSequence: 0,
};

// Subscribers
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// WebSocket support
const WS_BASE = 'ws://localhost:8000';
let wsConnection: WebSocket | null = null;
let useWebSocket = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Polling support
let pollingInterval: number | null = null;

function connectWebSocket() {
  if (!useWebSocket) return;

  const wsUrl = `${WS_BASE}/api/v1/telemetry/ws`;
  wsConnection = new WebSocket(wsUrl);

  wsConnection.onopen = () => {
    console.log('Telemetry WebSocket connected');
    state.connectionStatus = 'connected';
    reconnectAttempts = 0;
    notify();
  };

  wsConnection.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'snapshot') {
        // Initial snapshot
        const events = message.data?.events || [];
        state.events = events;
        if (events.length > 0) {
          state.lastSequence = Math.max(...events.map((e: TelemetryEvent) => e.sequence));
        }
        notify();
      } else if (message.type === 'update') {
        // Incremental update
        const newEvents = message.data?.events || [];
        newEvents.forEach((event: TelemetryEvent) => {
          // Only add if not already present (dedup by event_id)
          if (!state.events.find(e => e.event_id === event.event_id)) {
            state.events.push(event);
            if (event.sequence > state.lastSequence) {
              state.lastSequence = event.sequence;
            }
          }
        });
        // Keep last 500 events (window)
        if (state.events.length > 500) {
          state.events = state.events.slice(-500);
        }
        notify();
      }
    } catch (error) {
      console.error('Failed to parse telemetry WebSocket message:', error);
    }
  };

  wsConnection.onerror = (error) => {
    console.error('Telemetry WebSocket error:', error);
  };

  wsConnection.onclose = () => {
    console.log('Telemetry WebSocket disconnected');
    wsConnection = null;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && useWebSocket) {
      reconnectAttempts++;
      state.connectionStatus = 'connecting';
      notify();
      console.log(`Telemetry reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => {
        if (useWebSocket) connectWebSocket();
      }, 2000 * reconnectAttempts);
    } else {
      console.log('Telemetry falling back to polling');
      state.connectionStatus = 'fallback';
      useWebSocket = false;
      telemetryStore.startPolling(5000);
      notify();
    }
  };
}

function closeWebSocket() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

async function fetchTelemetryEvents(limit = 100): Promise<void> {
  try {
    const url = `/api/v1/telemetry/events?limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const events: TelemetryEvent[] = await response.json();
    state.events = events;
    if (events.length > 0) {
      state.lastSequence = Math.max(...events.map(e => e.sequence));
    }
    notify();
  } catch (error) {
    console.error('Failed to fetch telemetry events:', error);
  }
}

export const telemetryStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getState(): TelemetryState {
    return state;
  },

  getEvents(): TelemetryEvent[] {
    return state.events;
  },

  getConnectionStatus(): ConnectionStatus {
    return state.connectionStatus;
  },

  startStreaming() {
    if (useWebSocket && !wsConnection) {
      state.connectionStatus = 'connecting';
      notify();
      connectWebSocket();
    } else if (!useWebSocket) {
      telemetryStore.startPolling(5000);
    }
  },

  stopStreaming() {
    closeWebSocket();
    telemetryStore.stopPolling();
    state.connectionStatus = 'disconnected';
    notify();
  },

  startPolling(intervalMs: number) {
    if (pollingInterval !== null) return;
    
    state.connectionStatus = 'fallback';
    notify();
    
    // Initial fetch
    fetchTelemetryEvents();
    
    // Recurring polling
    pollingInterval = window.setInterval(() => {
      fetchTelemetryEvents();
    }, intervalMs);
  },

  stopPolling() {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },

  reset() {
    state = {
      events: [],
      connectionStatus: 'disconnected',
      lastSequence: 0,
    };
    closeWebSocket();
    telemetryStore.stopPolling();
    useWebSocket = true;
    reconnectAttempts = 0;
    notify();
  },
};
