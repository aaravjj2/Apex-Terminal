/**
 * Autopilot Zustand Store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { WebSocketClient } from '../../data/WebSocketClient';
import type { WSConnectionState } from '../../data/WebSocketClient';
import type {
  AutopilotConfig,
  AutopilotPosition,
  PortfolioState,
  CycleResult,
  ActivityLogEntry,
  DailyReport,
  AutopilotStatus,
  Incident,
} from './types';
import { autopilotApi } from './api';

// Defined here if not in types yet, or assume it will be
interface ThinkLogEntry {
  timestamp: string;
  phase: string;
  thought: string;
  details?: Record<string, any>;
  emoji?: string;
}

interface AutopilotStore {
  // State
  config: AutopilotConfig | null;
  defaults: AutopilotConfig | null;
  status: AutopilotStatus | null;
  positions: AutopilotPosition[];
  portfolio: PortfolioState | null;
  logs: ActivityLogEntry[]; // This remains for historical API logs
  thinkLog: ThinkLogEntry[]; // New real-time log
  lastCycle: CycleResult | null;
  runs: CycleResult[]; // History of recent runs
  incidents: Incident[]; // Active or recent incidents
  dailyReport: DailyReport | null;
  reportMarkdown: string;

  // UI state
  isLoading: boolean;
  error: string | null;
  killSwitchPending: boolean;
  connectionStatus: WSConnectionState;

  // Actions
  fetchConfig: () => Promise<void>;
  updateConfig: (update: Partial<AutopilotConfig>) => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchPositions: (status?: 'open' | 'closed' | 'all') => Promise<void>;
  fetchLogs: (options?: { limit?: number; event_type?: string }) => Promise<void>;
  triggerRun: (force?: boolean) => Promise<CycleResult | null>;
  activateKillSwitch: (closeAll?: boolean) => Promise<void>;
  deactivateKillSwitch: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  fetchDailyReport: (date?: string) => Promise<void>;
  clearError: () => void;
  dismissIncident: (index: number) => void;
  closePosition: (symbol: string) => Promise<void>;

  // WebSocket
  ws: WebSocketClient | null;
  connect: () => void;
  disconnect: () => void;
}

export const useAutopilotStore = create<AutopilotStore>()(
  immer((set, get) => ({
    // Initial state
    config: null,
    defaults: null,
    status: null,
    positions: [],
    portfolio: null,
    logs: [],
    thinkLog: [],
    lastCycle: null,
    runs: [],
    incidents: [],
    dailyReport: null,
    reportMarkdown: '',
    isLoading: false,
    error: null,
    killSwitchPending: false,
    connectionStatus: 'DISCONNECTED',
    ws: null,

    fetchConfig: async () => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { config, defaults } = await autopilotApi.getConfig();
        set((state) => {
          state.config = config;
          state.defaults = defaults;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to fetch config';
          state.isLoading = false;
        });
      }
    },

    updateConfig: async (update) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { config } = await autopilotApi.updateConfig(update);
        set((state) => {
          state.config = config;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to update config';
          state.isLoading = false;
        });
      }
    },

    fetchStatus: async () => {
      try {
        const status = await autopilotApi.getStatus();
        set((state) => { state.status = status; });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to fetch status';
        });
      }
    },

    fetchPositions: async (status) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { positions, portfolio } = await autopilotApi.getPositions(status);
        set((state) => {
          state.positions = positions ?? [];
          state.portfolio = portfolio ?? null;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to fetch positions';
          state.isLoading = false;
        });
      }
    },

    fetchLogs: async (options) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { logs } = await autopilotApi.getLogs(options);
        set((state) => {
          state.logs = logs ?? [];
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to fetch logs';
          state.isLoading = false;
        });
      }
    },

    triggerRun: async (force = false) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { cycle } = await autopilotApi.triggerRun(force);
        set((state) => {
          state.lastCycle = cycle;
          // Add to local runs history
          if (cycle) {
            state.runs.unshift(cycle);
            if (state.runs.length > 50) state.runs = state.runs.slice(0, 50);
          }
          state.isLoading = false;
        });
        // Refresh positions after run
        get().fetchPositions('open');
        return cycle;
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to trigger run';
          state.isLoading = false;
        });
        return null;
      }
    },

    activateKillSwitch: async (closeAll = false) => {
      set((state) => { state.killSwitchPending = true; state.error = null; });
      try {
        await autopilotApi.setKillSwitch(true, closeAll);
        await get().fetchStatus();
        set((state) => { state.killSwitchPending = false; });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to activate kill switch';
          state.killSwitchPending = false;
        });
      }
    },

    deactivateKillSwitch: async () => {
      set((state) => { state.killSwitchPending = true; state.error = null; });
      try {
        await autopilotApi.setKillSwitch(false);
        await get().fetchStatus();
        set((state) => { state.killSwitchPending = false; });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to deactivate kill switch';
          state.killSwitchPending = false;
        });
      }
    },

    pause: async () => {
      try {
        await autopilotApi.pause();
        await get().fetchStatus();
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to pause';
        });
      }
    },

    resume: async () => {
      try {
        await autopilotApi.resume();
        await get().fetchStatus();
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to resume';
        });
      }
    },

    fetchDailyReport: async (date) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const { report, markdown } = await autopilotApi.getDailyReport(date);
        set((state) => {
          state.dailyReport = report;
          state.reportMarkdown = markdown;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to fetch report';
          state.isLoading = false;
        });
      }
    },

    clearError: () => {
      set((state) => { state.error = null; });
    },

    dismissIncident: (index) => {
      set((state) => {
        state.incidents.splice(index, 1);
      });
    },

    closePosition: async (symbol: string) => {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        await autopilotApi.closePosition(symbol);

        // Log to think log immediately
        set((state) => {
          state.thinkLog.push({
            timestamp: new Date().toISOString(),
            phase: 'MANUAL',
            thought: `Panic close triggered for ${symbol}`,
            emoji: '🚨'
          });
        });

        // Refresh positions
        await get().fetchPositions('open');
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to close position';
          state.isLoading = false;
        });
      }
    },

    connect: () => {
      if (get().ws) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws/autopilot`;

      const ws = new WebSocketClient(url,
        (msg: any) => {
          set(state => {
            if (msg.type === 'THINK_LOG') {
              state.thinkLog.push(msg.data);
              // Keep log bounded
              if (state.thinkLog.length > 500) {
                state.thinkLog = state.thinkLog.slice(-500);
              }
            } else if (msg.type === 'STATUS_UPDATE') {
              if (state.status) {
                // Partial update if possible, or trigger fetch
                get().fetchStatus();
              }
            } else if (msg.type === 'RUN_COMPLETE') {
              // Add to runs history
              state.runs.unshift(msg.data);
              if (state.runs.length > 50) state.runs = state.runs.slice(0, 50);

              // Refresh status and positions
              get().fetchStatus();
              get().fetchPositions('open');

              // Add to think log
              state.thinkLog.push({
                timestamp: new Date().toISOString(),
                phase: 'COMPLETE',
                thought: `Run ${msg.data.run_id} completed (Success: ${msg.data.success})`,
                emoji: msg.data.success ? '✅' : '❌'
              });
            } else if (msg.type === 'INCIDENT') {
              state.incidents.push(msg.data);
              state.thinkLog.push({
                timestamp: new Date().toISOString(),
                phase: 'INCIDENT',
                thought: `${msg.data.severity.toUpperCase()}: ${msg.data.title}`,
                emoji: '🚨',
                details: msg.data
              });
            } else if (msg.type === 'EXIT_SIGNAL') {
              state.thinkLog.push({
                timestamp: new Date().toISOString(),
                phase: 'MONITOR',
                thought: `Exit Signal: ${msg.data.symbol} - ${msg.data.trigger} (${msg.data.urgency})`,
                emoji: '🔔',
                details: msg.data
              });
            } else if (msg.type === 'POSITIONS_UPDATE') {
              // Just trigger a refresh if mismatched > 0
              if (msg.data.mismatched > 0) {
                state.thinkLog.push({
                  timestamp: new Date().toISOString(),
                  phase: 'BROKER',
                  thought: `Position mismatch detected: ${msg.data.mismatched} positions differ from Alpaca`,
                  emoji: '⚠️'
                });
                get().fetchPositions('open');
              }
            }
          });
        },
        (stateStr, _prev, _details) => {
          set(state => {
            state.connectionStatus = stateStr;
            // We could track details.reconnectAttempts here too if needed
          });
        }
      );

      set(state => { state.ws = ws; });
      ws.connect();
    },

    disconnect: () => {
      const { ws } = get();
      if (ws) {
        ws.disconnect();
        set(state => { state.ws = null; });
      }
    }
  }))
);
