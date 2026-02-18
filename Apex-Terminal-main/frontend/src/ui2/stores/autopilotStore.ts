/**
 * v1.58 — Autopilot Store
 * Kill switch, rule toggles, activity feed for DEMO mode
 */

import { DEMO_TIMESTAMP } from '../demo/constants';

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

let killSwitchActive = false;
let rules: AutopilotRule[] = [
  { id: 'rule-1', name: 'Max Position Size', enabled: true, type: 'position-limit', value: 500, unit: 'shares' },
  { id: 'rule-2', name: 'Daily Loss Limit', enabled: true, type: 'loss-limit', value: 5000, unit: 'USD' },
  { id: 'rule-3', name: 'Sector Concentration', enabled: true, type: 'sector-limit', value: 40, unit: '%' },
  { id: 'rule-4', name: 'Trade Frequency', enabled: false, type: 'frequency-limit', value: 10, unit: 'trades/hour' },
];

let activityFeed: AutopilotActivity[] = [
  { id: 'act-1', timestamp: DEMO_TIMESTAMP - 60000, type: 'accepted', symbol: 'SPY', side: 'buy', quantity: 150, reason: 'RSI oversold bounce signal. All risk checks passed.', confidence: 0.78 },
  { id: 'act-2', timestamp: DEMO_TIMESTAMP - 120000, type: 'rejected', symbol: 'NVDA', side: 'buy', quantity: 800, reason: 'Exceeds max position size limit (500 shares).', confidence: 0.82 },
  { id: 'act-3', timestamp: DEMO_TIMESTAMP - 180000, type: 'accepted', symbol: 'AMZN', side: 'sell', quantity: 50, reason: 'Mean reversion sell signal. Position within limits.', confidence: 0.71 },
  { id: 'act-4', timestamp: DEMO_TIMESTAMP - 240000, type: 'rejected', symbol: 'TSLA', side: 'buy', quantity: 200, reason: 'Sector concentration would exceed 40% tech limit.', confidence: 0.65 },
  { id: 'act-5', timestamp: DEMO_TIMESTAMP - 300000, type: 'info', reason: 'Autopilot started. Monitoring 8 symbols across 3 strategies.' },
];

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export const autopilotStore = {
  isKillSwitchActive: () => killSwitchActive,

  activateKillSwitch() {
    killSwitchActive = true;
    activityFeed.unshift({
      id: `act-ks-${Date.now()}`,
      timestamp: DEMO_TIMESTAMP,
      type: 'kill-switch',
      reason: 'KILL SWITCH ACTIVATED. All autopilot trading halted.',
    });
    notify();
  },

  deactivateKillSwitch() {
    killSwitchActive = false;
    activityFeed.unshift({
      id: `act-ks-off-${Date.now()}`,
      timestamp: DEMO_TIMESTAMP,
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
        timestamp: DEMO_TIMESTAMP,
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
        timestamp: DEMO_TIMESTAMP,
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
      timestamp: DEMO_TIMESTAMP,
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

  reset() {
    killSwitchActive = false;
    rules = [
      { id: 'rule-1', name: 'Max Position Size', enabled: true, type: 'position-limit', value: 500, unit: 'shares' },
      { id: 'rule-2', name: 'Daily Loss Limit', enabled: true, type: 'loss-limit', value: 5000, unit: 'USD' },
      { id: 'rule-3', name: 'Sector Concentration', enabled: true, type: 'sector-limit', value: 40, unit: '%' },
      { id: 'rule-4', name: 'Trade Frequency', enabled: false, type: 'frequency-limit', value: 10, unit: 'trades/hour' },
    ];
    activityFeed = activityFeed.slice(0, 5); // Keep initial demo data
    notify();
  },
};
