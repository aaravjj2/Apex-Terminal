/**
 * Platform Health Store (Wave 8 — v1.80)
 * Platform health observability with deterministic demo data.
 */

// ── Types ───────────────────────────────────────────────────────

export interface ServiceStatus {
  status: string;
  version?: string;
  provider?: string;
}

export interface HealthMetrics {
  uptime_seconds: number;
  total_autopilot_runs: number;
  total_automation_runs: number;
  error_rate: number;
}

export interface PlatformHealth {
  status: string;
  mode: string;
  timestamp: string;
  services: Record<string, ServiceStatus>;
  metrics: HealthMetrics;
}

// ── Demo Data ──────────────────────────────────────────────────

import { RECORDING_TS } from '../dataMode/config'; const DEMO_TS = RECORDING_TS; // recording anchor replaces synthetic ts

const DEMO_HEALTH: PlatformHealth = {
  status: 'healthy',
  mode: 'demo',
  timestamp: DEMO_TS,
  services: {
    autopilot_v2: { status: 'ok', version: '2.0.0' },
    automation: { status: 'ok', version: '1.0.0' },
    search: { status: 'ok', version: '1.0.0' },
    llm: { status: 'stub', provider: 'mock' },
  },
  metrics: {
    uptime_seconds: 86400,
    total_autopilot_runs: 0,
    total_automation_runs: 0,
    error_rate: 0.0,
  },
};

// ── Store ───────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let health: PlatformHealth = { ...DEMO_HEALTH };
let lastRefresh: string = DEMO_TS;

export const platformHealthStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getHealth: () => health,
  getLastRefresh: () => lastRefresh,

  refresh() {
    health = { ...DEMO_HEALTH };
    lastRefresh = DEMO_TS;
    notify();
  },

  reset() {
    health = { ...DEMO_HEALTH }; lastRefresh = DEMO_TS;
    notify();
  },
};
