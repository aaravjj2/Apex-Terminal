/**
 * UI2 Demo Constants
 * Fixed timestamps, IDs, and seed data for deterministic demo experience
 */

// Fixed demo timestamp: 2026-02-15 14:30:00 UTC
export const DEMO_TIMESTAMP = new Date('2026-02-15T14:30:00Z').getTime();

// Demo user
export const DEMO_USER = {
  id: 'demo-user-1',
  name: 'Demo Trader',
  email: 'demo@apexterminal.io',
  avatar: null,
};

// Market status
export const DEMO_MARKET_STATUS = {
  isOpen: true,
  nextOpen: DEMO_TIMESTAMP + 18 * 60 * 60 * 1000, // 18 hours from now
  nextClose: DEMO_TIMESTAMP + 2 * 60 * 60 * 1000, // 2 hours from now
};

// WebSocket connection mock
export const DEMO_WS_STATUS = {
  connected: true,
  latency: 23,
  reconnectCount: 0,
};
