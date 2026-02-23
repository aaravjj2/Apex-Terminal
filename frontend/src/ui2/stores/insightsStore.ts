/**
 * Insights Store (v1.93)
 * Provides trading insights and notifications.
 * Returns deterministic insights in DEMO mode.
 */

export interface Insight {
  id: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  dismissible: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

// Deterministic insights for DEMO mode
import { RECORDING_TS } from '../dataMode/config'; const DEMO_TS = new Date(RECORDING_TS).getTime(); // recording anchor

let insights: Insight[] = [];

export const insightsStore = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  getInsights: () => insights,

  addInsight(data: Omit<Insight, 'id' | 'timestamp'>) {
    const insight: Insight = {
      ...data,
      id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: DEMO_TS,
    };
    insights = [insight, ...insights];
    notify();
    return insight;
  },

  dismissInsight(id: string) {
    insights = insights.filter(i => i.id !== id);
    notify();
  },

  clearAll() {
    insights = [];
    notify();
  },

  reset() {
    insights = [];
    notify();
  },
};
