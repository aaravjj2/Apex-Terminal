/**
 * Centralized API Configuration
 * 
 * All API calls should use these constants instead of hardcoded URLs.
 */

// API Base URL - configurable via environment variable
export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// WebSocket Base URL - derived from API base
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

// API Endpoints
export const API_ENDPOINTS = {
    // Health
    health: `${API_BASE}/health`,

    // Autopilot
    autopilot: {
        status: `${API_BASE}/api/v1/autopilot/status`,
        config: `${API_BASE}/api/v1/autopilot/config`,
        universe: `${API_BASE}/api/v1/autopilot/universe`,
        run: `${API_BASE}/api/v1/autopilot/run`,
        positions: `${API_BASE}/api/v1/autopilot/positions`,
        orders: `${API_BASE}/api/v1/autopilot/orders`,
        runs: `${API_BASE}/api/v1/autopilot/runs`,
        incidents: `${API_BASE}/api/v1/autopilot/incidents`,
    },

    // Market
    clock: `${API_BASE}/api/v1/clock`,

    // Options
    options: {
        chain: (symbol: string) => `${API_BASE}/api/v1/options/chain/${symbol}`,
        greeks: (symbol: string) => `${API_BASE}/api/v1/options/greeks/${symbol}`,
    },
} as const;

// WebSocket Endpoints
export const WS_ENDPOINTS = {
    bars: (symbol: string, timeframe: string) => `${WS_BASE}/ws/bars/${symbol}/${timeframe}`,
    autopilot: `${WS_BASE}/ws/autopilot`,
} as const;
