/**
 * Platform Health Store (Wave 8 â€” v1.80)
 * Platform health observability with deterministic demo data.
 */

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

const DEFAULT_HEALTH: PlatformHealth = {
  status: 'healthy',
  mode: 'live',
  timestamp: new Date().toISOString(),
  services: {
    autopilot_v2: { status: 'ok', version: '2.0.0' },
    automation: { status: 'ok', version: '1.0.0' },
    search: { status: 'ok', version: '1.0.0' },
    llm: { status: 'online', provider: 'api' },
  },
  metrics: {
    uptime_seconds: 86400,
    total_autopilot_runs: 0,
    total_automation_runs: 0,
    error_rate: 0.0,
  },
};

// â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let health: PlatformHealth = { ...DEFAULT_HEALTH };
let lastRefresh: string = new Date().toISOString();

export const platformHealthStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getHealth: () => health,
  getLastRefresh: () => lastRefresh,

  refresh() {
    health = { ...DEFAULT_HEALTH };
    lastRefresh = new Date().toISOString();
    notify();
  },

  reset() {
    health = { ...DEFAULT_HEALTH }; lastRefresh = new Date().toISOString();
    notify();
  },
};
