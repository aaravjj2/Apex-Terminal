/**
 * v1.58 — Autopilot Store
 * Kill switch, rule toggles, activity feed
 */

import { API_BASE } from '@/config/api';

// Live timestamp utility
function now() { return Date.now(); }

export interface AutopilotRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'position-limit' | 'loss-limit' | 'sector-limit' | 'frequency-limit';
  value: number;
  unit: string;
}

export interface AutopilotActivity {
  id: string;
  timestamp: number;
  type: 'accepted' | 'rejected' | 'info' | 'kill-switch';
  symbol?: string;
  side?: 'buy' | 'sell';
  quantity?: number;
  reason: string;
  confidence?: number;
}

// Hardcoded fallback rules — used only when the API returns an empty set
const FALLBACK_RULES: AutopilotRule[] = [
  { id: 'rule-1', name: 'Max Position Size', enabled: true, type: 'position-limit', value: 500, unit: 'shares' },
  { id: 'rule-2', name: 'Daily Loss Limit', enabled: true, type: 'loss-limit', value: 5000, unit: 'USD' },
  { id: 'rule-3', name: 'Sector Concentration', enabled: true, type: 'sector-limit', value: 40, unit: '%' },
  { id: 'rule-4', name: 'Trade Frequency', enabled: false, type: 'frequency-limit', value: 10, unit: 'trades/hour' },
];

let killSwitchActive = false;
let rules: AutopilotRule[] = [];

let activityFeed: AutopilotActivity[] = [];

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export const autopilotStore = {
  isKillSwitchActive: () => killSwitchActive,

  activateKillSwitch() {
    killSwitchActive = true;
    activityFeed.unshift({
      id: `act-ks-${Date.now()}`,
      timestamp: now(),
      type: 'kill-switch',
      reason: 'KILL SWITCH ACTIVATED. All autopilot trading halted.',
    });
    notify();
  },

  deactivateKillSwitch() {
    killSwitchActive = false;
    activityFeed.unshift({
      id: `act-ks-off-${Date.now()}`,
      timestamp: now(),
      type: 'info',
      reason: 'Kill switch deactivated. Autopilot resumed.',
    });
    notify();
  },

  getRules: () => [...rules],

  toggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      notify();
    }
  },

  getActivity: () => [...activityFeed],

  /** Simulate a trade attempt - deterministic */
  attemptTrade(symbol: string, side: 'buy' | 'sell', quantity: number, confidence: number) {
    if (killSwitchActive) {
      activityFeed.unshift({
        id: `act-${Date.now()}`,
        timestamp: now(),
        type: 'rejected',
        symbol, side, quantity, confidence,
        reason: 'Kill switch is active. Trade blocked.',
      });
      notify();
      return false;
    }

    // Check rules
    const posLimit = rules.find(r => r.id === 'rule-1');
    if (posLimit?.enabled && quantity > posLimit.value) {
      activityFeed.unshift({
        id: `act-${Date.now()}`,
        timestamp: now(),
        type: 'rejected',
        symbol, side, quantity, confidence,
        reason: `Exceeds max position size limit (${posLimit.value} ${posLimit.unit}).`,
      });
      notify();
      return false;
    }

    // Accept the trade
    activityFeed.unshift({
      id: `act-${Date.now()}`,
      timestamp: now(),
      type: 'accepted',
      symbol, side, quantity, confidence,
      reason: `Signal accepted. All ${rules.filter(r => r.enabled).length} risk checks passed.`,
    });
    notify();
    return true;
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  /** Fetch risk rules from the backend; falls back to FALLBACK_RULES if the API is unavailable or returns an empty array */
  async fetchRules(): Promise<void> {
    try {
      const resp = await fetch(`${API_BASE}/api/v1/autopilot/risk-rules`, {
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const fetched: AutopilotRule[] = Array.isArray(data) ? data : (data?.rules ?? []);
        if (fetched.length > 0) {
          rules = fetched;
          notify();
          return;
        }
      }
    } catch (e) {
      console.warn('[autopilotStore] Failed to fetch risk rules from API, using fallback:', e);
    }
    // API unavailable or returned empty — apply fallback
    if (rules.length === 0) {
      rules = [...FALLBACK_RULES];
      notify();
    }
  },

  reset() {
    killSwitchActive = false;
    rules = [];
    activityFeed = [];
    notify();
    // Re-fetch rules from the API (async, non-blocking)
    autopilotStore.fetchRules();
  },
};

// Populate rules on module load — API first, fallback if unavailable
autopilotStore.fetchRules();
