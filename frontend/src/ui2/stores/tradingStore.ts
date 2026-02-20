/**
 * Trading Store (Wave 9 v1.83-84, Wave 10 v1.94)
 * Unified orders, positions, P&L from backend.
 * Prefers WebSocket streaming, falls back to polling if WS unavailable.
 */

// ── Types ───────────────────────────────────────────────────────

export interface Order {
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  filled_quantity: number;
  status: string;
  source: string;
  run_id?: string;
  timestamp: string;
}

export interface Position {
  symbol: string;
  side: string;
  quantity: number;
  avg_price: number;
  market_price: number;
  unrealized_pnl: number;
  sector: string;
  source: string;
  run_id?: string;
}

export interface PnLSnapshot {
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  total_notional: number;
  positions_count: number;
  orders_count: number;
  timestamp: string;
}

export interface TapeEvent {
  event: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  source: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'fallback';

// ── API Base ────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8090') + '/api/v1/trading';
const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8090').replace(/^http/, 'ws');

// ── State ───────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let orders: Order[] = [];
let positions: Position[] = [];
let pnl: PnLSnapshot = {
  realized_pnl: 0,
  unrealized_pnl: 0,
  total_pnl: 0,
  total_notional: 0,
  positions_count: 0,
  orders_count: 0,
  timestamp: '',
};
let tape: TapeEvent[] = [];
let isLoading = false;
let lastFetch = 0;
let pollInterval: number | null = null;

let connectionStatus: ConnectionStatus = 'disconnected';
let wsConnections: Map<string, WebSocket> = new Map();
let useWebSocket = true; // Prefer WS, fallback to polling if unavailable
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// ── WebSocket Handlers ─────────────────────────────────────────

function connectWebSocket(endpoint: string, onMessage: (data: any) => void) {
  const wsUrl = `${WS_BASE}${endpoint}`;
  
  try {
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`WebSocket connected: ${endpoint}`);
      connectionStatus = 'connected';
      reconnectAttempts = 0;
      notify();
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error(`WebSocket message parse error (${endpoint}):`, error);
      }
    };
    
    ws.onerror = (error) => {
      console.error(`WebSocket error (${endpoint}):`, error);
    };
    
    ws.onclose = () => {
      console.log(`WebSocket closed: ${endpoint}`);
      wsConnections.delete(endpoint);
      
      // Attempt reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
          if (useWebSocket) {
            connectWebSocket(endpoint, onMessage);
          }
        }, 2000 * reconnectAttempts); // Exponential backoff
      } else {
        // Max attempts reached, fallback to polling
        console.warn(`WebSocket max reconnect attempts reached for ${endpoint}, falling back to polling`);
        connectionStatus = 'fallback';
        useWebSocket = false;
        tradingStore.startPolling(5000);
        notify();
      }
    };
    
    wsConnections.set(endpoint, ws);
  } catch (error) {
    console.error(`Failed to create WebSocket for ${endpoint}:`, error);
    // Immediate fallback on connection failure
    connectionStatus = 'fallback';
    useWebSocket = false;
    tradingStore.startPolling(5000);
  }
}

function initWebSockets() {
  connectionStatus = 'connecting';
  notify();
  
  // Market tape
  connectWebSocket('/ws/market/tape', (message) => {
    if (message.type === 'snapshot' && message.data?.events) {
      tape = message.data.events;
      notify();
    } else if (message.type === 'update' && message.data) {
      tape = [message.data, ...tape].slice(0, 100); // Keep latest 100
      notify();
    }
  });
  
  // Orders
  connectWebSocket('/ws/orders', (message) => {
    if (message.type === 'snapshot' && message.data?.orders) {
      orders = message.data.orders;
      notify();
    }
  });
  
  // Positions
  connectWebSocket('/ws/positions', (message) => {
    if (message.type === 'snapshot' && message.data?.positions) {
      positions = message.data.positions;
      notify();
    }
  });
  
  // P&L
  connectWebSocket('/ws/pnl', (message) => {
    if (message.type === 'snapshot' && message.data) {
      pnl = message.data;
      notify();
    }
  });
}

function closeWebSockets() {
  wsConnections.forEach((ws, _endpoint) => {
    ws.close();
  });
  wsConnections.clear();
  connectionStatus = 'disconnected';
  notify();
}

// ── Polling Fetchers (Fallback) ────────────────────────────────

async function fetchOrders() {
  try {
    const response = await fetch(`${API_BASE}/orders`);
    if (!response.ok) return;
    const data = await response.json();
    orders = data.orders || [];
    notify();
  } catch (error) {
    console.error('fetchOrders error:', error);
  }
}

async function fetchPositions() {
  try {
    const response = await fetch(`${API_BASE}/positions`);
    if (!response.ok) return;
    const data = await response.json();
    positions = data.positions || [];
    notify();
  } catch (error) {
    console.error('fetchPositions error:', error);
  }
}

async function fetchPnL() {
  try {
    const response = await fetch(`${API_BASE}/pnl/snapshot`);
    if (!response.ok) return;
    pnl = await response.json();
    notify();
  } catch (error) {
    console.error('fetchPnL error:', error);
  }
}

async function fetchTape() {
  try {
    const response = await fetch(`${API_BASE}/market/tape?limit=100`);
    if (!response.ok) return;
    const data = await response.json();
    tape = data.tape || [];
    notify();
  } catch (error) {
    console.error('fetchTape error:', error);
  }
}

async function fetchAll() {
  if (isLoading) return;
  isLoading = true;
  await Promise.all([fetchOrders(), fetchPositions(), fetchPnL(), fetchTape()]);
  lastFetch = Date.now();
  isLoading = false;
}

// ── Store ───────────────────────────────────────────────────────

export const tradingStore = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  getOrders: () => orders,
  getPositions: () => positions,
  getPnL: () => pnl,
  getTape: () => tape,
  isLoading: () => isLoading,
  getLastFetch: () => lastFetch,
  getConnectionStatus: () => connectionStatus,

  async refresh() {
    await fetchAll();
  },

  startStreaming() {
    // Prefer WebSocket, fallback to polling if WS fails
    if (useWebSocket && wsConnections.size === 0) {
      initWebSockets();
    } else if (!useWebSocket) {
      // Already in fallback mode, start polling
      tradingStore.startPolling(5000);
    }
  },

  startPolling(intervalMs: number = 5000) {
    if (pollInterval !== null) return;
    connectionStatus = 'fallback';
    notify();
    fetchAll(); // Initial fetch
    pollInterval = window.setInterval(() => { fetchAll(); }, intervalMs);
  },

  stopStreaming() {
    closeWebSockets();
    tradingStore.stopPolling();
  },

  stopPolling() {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  },

  reset() {
    closeWebSockets();
    tradingStore.stopPolling();
    orders = [];
    positions = [];
    pnl = {
      realized_pnl: 0,
      unrealized_pnl: 0,
      total_pnl: 0,
      total_notional: 0,
      positions_count: 0,
      orders_count: 0,
      timestamp: '',
    };
    tape = [];
    lastFetch = 0;
    connectionStatus = 'disconnected';
    useWebSocket = true;
    reconnectAttempts = 0;
    notify();
  },
};
