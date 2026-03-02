import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  Trade,
  EquityPoint,
  StrategyParam,
  MonteCarloResult,
  WalkForwardResult,
  OptimizationResult,
  ParameterRange,
  OptimizationObjective,
} from '../lib/backtest/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BacktestStatus = 'idle' | 'configuring' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  params: StrategyParam[];
  paramValues: Record<string, number | boolean | string>;
  code?: string;
}

export interface BacktestRun {
  id: string;
  name: string;
  strategyConfig: StrategyConfig;
  backtestConfig: BacktestConfig;
  status: BacktestStatus;
  progress: number;
  result: BacktestResult | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
  executionTimeMs: number;
  tags: string[];
}

export interface OptimizationRun {
  id: string;
  name: string;
  strategyConfig: StrategyConfig;
  backtestConfig: BacktestConfig;
  parameterRanges: ParameterRange[];
  objectives: OptimizationObjective[];
  method: 'grid' | 'random' | 'bayesian' | 'genetic';
  status: BacktestStatus;
  progress: number;
  totalCombinations: number;
  completedCombinations: number;
  result: OptimizationResult | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

export interface ComparisonEntry {
  runId: string;
  name: string;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  color: string;
}

export interface BacktestBookmark {
  id: string;
  runId: string;
  name: string;
  notes: string;
  createdAt: number;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface BacktestStoreState {
  currentConfig: BacktestConfig | null;
  currentStrategy: StrategyConfig | null;

  runs: Record<string, BacktestRun>;
  runOrder: string[];
  activeRunId: string | null;

  optimizations: Record<string, OptimizationRun>;
  activeOptimizationId: string | null;

  monteCarloResult: MonteCarloResult | null;
  walkForwardResult: WalkForwardResult | null;

  comparison: ComparisonEntry[];
  maxComparisons: number;

  bookmarks: BacktestBookmark[];

  availableStrategies: StrategyConfig[];

  isRunning: boolean;
  isOptimizing: boolean;
  globalProgress: number;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const COMPARISON_COLORS = ['#2962FF', '#FF6D00', '#00C853', '#D500F9', '#FF1744', '#00B8D4', '#FFD600', '#795548'];

// ─── Actions ────────────────────────────────────────────────────────────────

interface BacktestStoreActions {
  setConfig: (config: BacktestConfig) => void;
  updateConfig: (updates: Partial<BacktestConfig>) => void;
  setStrategy: (strategy: StrategyConfig) => void;
  updateStrategyParams: (params: Record<string, number | boolean | string>) => void;

  runBacktest: (name?: string) => string | null;
  cancelBacktest: (runId: string) => void;
  updateRunProgress: (runId: string, progress: number) => void;
  completeRun: (runId: string, result: BacktestResult) => void;
  failRun: (runId: string, error: string) => void;
  deleteRun: (runId: string) => void;
  deleteAllRuns: () => void;
  setActiveRun: (runId: string | null) => void;
  renameRun: (runId: string, name: string) => void;
  tagRun: (runId: string, tag: string) => void;
  untagRun: (runId: string, tag: string) => void;

  startOptimization: (name: string, paramRanges: ParameterRange[], objectives: OptimizationObjective[], method?: OptimizationRun['method']) => string | null;
  cancelOptimization: (optId: string) => void;
  updateOptimizationProgress: (optId: string, completed: number) => void;
  completeOptimization: (optId: string, result: OptimizationResult) => void;
  failOptimization: (optId: string, error: string) => void;
  deleteOptimization: (optId: string) => void;
  setActiveOptimization: (optId: string | null) => void;
  applyOptimizedParams: (optId: string) => void;

  runMonteCarlo: (runId: string, simulations?: number) => void;
  clearMonteCarloResult: () => void;
  setMonteCarloResult: (result: MonteCarloResult) => void;

  runWalkForward: (windowCount?: number) => void;
  clearWalkForwardResult: () => void;
  setWalkForwardResult: (result: WalkForwardResult) => void;

  addToComparison: (runId: string) => void;
  removeFromComparison: (runId: string) => void;
  clearComparison: () => void;

  addBookmark: (runId: string, name: string, notes?: string) => string;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Pick<BacktestBookmark, 'name' | 'notes'>>) => void;

  addAvailableStrategy: (strategy: StrategyConfig) => void;
  removeAvailableStrategy: (strategyId: string) => void;

  saveResults: (runId: string) => string | null;
  loadResults: (json: string) => string | null;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useBacktestStore = create<BacktestStoreState & BacktestStoreActions>()(
  immer((set, get) => ({
    currentConfig: null,
    currentStrategy: null,
    runs: {},
    runOrder: [],
    activeRunId: null,
    optimizations: {},
    activeOptimizationId: null,
    monteCarloResult: null,
    walkForwardResult: null,
    comparison: [],
    maxComparisons: 8,
    bookmarks: [],
    availableStrategies: [],
    isRunning: false,
    isOptimizing: false,
    globalProgress: 0,

    setConfig: (config) => set((s) => { s.currentConfig = config; }),

    updateConfig: (updates) => {
      set((s) => {
        if (s.currentConfig) Object.assign(s.currentConfig, updates);
      });
    },

    setStrategy: (strategy) => set((s) => { s.currentStrategy = strategy; }),

    updateStrategyParams: (params) => {
      set((s) => {
        if (s.currentStrategy) Object.assign(s.currentStrategy.paramValues, params);
      });
    },

    runBacktest: (name) => {
      const { currentConfig, currentStrategy } = get();
      if (!currentConfig || !currentStrategy) return null;

      const id = generateId('bt');
      const now = Date.now();
      const run: BacktestRun = {
        id,
        name: name ?? `${currentStrategy.name} - ${new Date().toLocaleString()}`,
        strategyConfig: JSON.parse(JSON.stringify(currentStrategy)),
        backtestConfig: JSON.parse(JSON.stringify(currentConfig)),
        status: 'running',
        progress: 0,
        result: null,
        error: null,
        startedAt: now,
        completedAt: null,
        executionTimeMs: 0,
        tags: [],
      };

      set((s) => {
        s.runs[id] = run;
        s.runOrder.unshift(id);
        s.activeRunId = id;
        s.isRunning = true;
        s.globalProgress = 0;
      });

      return id;
    },

    cancelBacktest: (runId) => {
      set((s) => {
        const run = s.runs[runId];
        if (run && run.status === 'running') {
          run.status = 'cancelled';
          run.completedAt = Date.now();
          run.executionTimeMs = Date.now() - run.startedAt;
          s.isRunning = Object.values(s.runs).some((r) => r.status === 'running');
        }
      });
    },

    updateRunProgress: (runId, progress) => {
      set((s) => {
        const run = s.runs[runId];
        if (run && run.status === 'running') {
          run.progress = Math.min(100, Math.max(0, progress));
          s.globalProgress = progress;
        }
      });
    },

    completeRun: (runId, result) => {
      set((s) => {
        const run = s.runs[runId];
        if (!run) return;
        run.status = 'completed';
        run.result = result;
        run.progress = 100;
        run.completedAt = Date.now();
        run.executionTimeMs = result.executionTimeMs;
        s.isRunning = Object.values(s.runs).some((r) => r.status === 'running');
        s.globalProgress = 100;
      });
    },

    failRun: (runId, error) => {
      set((s) => {
        const run = s.runs[runId];
        if (!run) return;
        run.status = 'failed';
        run.error = error;
        run.completedAt = Date.now();
        run.executionTimeMs = Date.now() - run.startedAt;
        s.isRunning = Object.values(s.runs).some((r) => r.status === 'running');
      });
    },

    deleteRun: (runId) => {
      set((s) => {
        delete s.runs[runId];
        s.runOrder = s.runOrder.filter((id) => id !== runId);
        s.comparison = s.comparison.filter((c) => c.runId !== runId);
        s.bookmarks = s.bookmarks.filter((b) => b.runId !== runId);
        if (s.activeRunId === runId) s.activeRunId = s.runOrder[0] ?? null;
      });
    },

    deleteAllRuns: () => {
      set((s) => {
        s.runs = {};
        s.runOrder = [];
        s.activeRunId = null;
        s.comparison = [];
        s.bookmarks = [];
      });
    },

    setActiveRun: (runId) => set((s) => { s.activeRunId = runId; }),

    renameRun: (runId, name) => {
      set((s) => { if (s.runs[runId]) s.runs[runId].name = name; });
    },

    tagRun: (runId, tag) => {
      set((s) => {
        const run = s.runs[runId];
        if (run && !run.tags.includes(tag)) run.tags.push(tag);
      });
    },

    untagRun: (runId, tag) => {
      set((s) => {
        const run = s.runs[runId];
        if (run) run.tags = run.tags.filter((t) => t !== tag);
      });
    },

    startOptimization: (name, paramRanges, objectives, method) => {
      const { currentConfig, currentStrategy } = get();
      if (!currentConfig || !currentStrategy) return null;

      const id = generateId('opt');
      let totalCombinations = 1;
      for (const range of paramRanges) {
        totalCombinations *= Math.ceil((range.max - range.min) / range.step) + 1;
      }

      const run: OptimizationRun = {
        id,
        name,
        strategyConfig: JSON.parse(JSON.stringify(currentStrategy)),
        backtestConfig: JSON.parse(JSON.stringify(currentConfig)),
        parameterRanges: paramRanges,
        objectives,
        method: method ?? 'grid',
        status: 'running',
        progress: 0,
        totalCombinations,
        completedCombinations: 0,
        result: null,
        error: null,
        startedAt: Date.now(),
        completedAt: null,
      };

      set((s) => {
        s.optimizations[id] = run;
        s.activeOptimizationId = id;
        s.isOptimizing = true;
      });

      return id;
    },

    cancelOptimization: (optId) => {
      set((s) => {
        const opt = s.optimizations[optId];
        if (opt && opt.status === 'running') {
          opt.status = 'cancelled';
          opt.completedAt = Date.now();
          s.isOptimizing = Object.values(s.optimizations).some((o) => o.status === 'running');
        }
      });
    },

    updateOptimizationProgress: (optId, completed) => {
      set((s) => {
        const opt = s.optimizations[optId];
        if (opt) {
          opt.completedCombinations = completed;
          opt.progress = opt.totalCombinations > 0 ? (completed / opt.totalCombinations) * 100 : 0;
        }
      });
    },

    completeOptimization: (optId, result) => {
      set((s) => {
        const opt = s.optimizations[optId];
        if (!opt) return;
        opt.status = 'completed';
        opt.result = result;
        opt.progress = 100;
        opt.completedAt = Date.now();
        opt.completedCombinations = opt.totalCombinations;
        s.isOptimizing = Object.values(s.optimizations).some((o) => o.status === 'running');
      });
    },

    failOptimization: (optId, error) => {
      set((s) => {
        const opt = s.optimizations[optId];
        if (!opt) return;
        opt.status = 'failed';
        opt.error = error;
        opt.completedAt = Date.now();
        s.isOptimizing = Object.values(s.optimizations).some((o) => o.status === 'running');
      });
    },

    deleteOptimization: (optId) => {
      set((s) => {
        delete s.optimizations[optId];
        if (s.activeOptimizationId === optId) s.activeOptimizationId = null;
      });
    },

    setActiveOptimization: (optId) => set((s) => { s.activeOptimizationId = optId; }),

    applyOptimizedParams: (optId) => {
      const opt = get().optimizations[optId];
      if (!opt?.result?.bestParams) return;
      set((s) => {
        if (s.currentStrategy) {
          Object.assign(s.currentStrategy.paramValues, opt.result!.bestParams);
        }
      });
    },

    runMonteCarlo: (runId, simulations) => {
      const run = get().runs[runId];
      if (!run?.result) return;
      // In production, this would trigger the MC simulation engine
      // For now, we set a placeholder. The actual engine would call setMonteCarloResult.
      set((s) => { s.monteCarloResult = null; });
    },

    clearMonteCarloResult: () => set((s) => { s.monteCarloResult = null; }),

    setMonteCarloResult: (result) => set((s) => { s.monteCarloResult = result; }),

    runWalkForward: (_windowCount) => {
      // Trigger walk-forward analysis engine. The engine calls setWalkForwardResult on completion.
      set((s) => { s.walkForwardResult = null; });
    },

    clearWalkForwardResult: () => set((s) => { s.walkForwardResult = null; }),

    setWalkForwardResult: (result) => set((s) => { s.walkForwardResult = result; }),

    addToComparison: (runId) => {
      const { runs, comparison, maxComparisons } = get();
      const run = runs[runId];
      if (!run?.result || comparison.length >= maxComparisons) return;
      if (comparison.some((c) => c.runId === runId)) return;

      set((s) => {
        s.comparison.push({
          runId,
          name: run.name,
          metrics: run.result!.metrics,
          equityCurve: run.result!.equityCurve,
          color: COMPARISON_COLORS[s.comparison.length % COMPARISON_COLORS.length],
        });
      });
    },

    removeFromComparison: (runId) => {
      set((s) => {
        s.comparison = s.comparison.filter((c) => c.runId !== runId);
      });
    },

    clearComparison: () => set((s) => { s.comparison = []; }),

    addBookmark: (runId, name, notes) => {
      const id = generateId('bm');
      set((s) => {
        s.bookmarks.push({ id, runId, name, notes: notes ?? '', createdAt: Date.now() });
      });
      return id;
    },

    removeBookmark: (bookmarkId) => {
      set((s) => {
        s.bookmarks = s.bookmarks.filter((b) => b.id !== bookmarkId);
      });
    },

    updateBookmark: (bookmarkId, updates) => {
      set((s) => {
        const bm = s.bookmarks.find((b) => b.id === bookmarkId);
        if (bm) Object.assign(bm, updates);
      });
    },

    addAvailableStrategy: (strategy) => {
      set((s) => {
        if (!s.availableStrategies.some((st) => st.id === strategy.id)) {
          s.availableStrategies.push(strategy);
        }
      });
    },

    removeAvailableStrategy: (strategyId) => {
      set((s) => {
        s.availableStrategies = s.availableStrategies.filter((st) => st.id !== strategyId);
      });
    },

    saveResults: (runId) => {
      const run = get().runs[runId];
      if (!run) return null;
      return JSON.stringify({
        run: {
          name: run.name,
          strategyConfig: run.strategyConfig,
          backtestConfig: run.backtestConfig,
          result: run.result,
          tags: run.tags,
        },
        exportedAt: Date.now(),
      });
    },

    loadResults: (json) => {
      try {
        const data = JSON.parse(json);
        if (!data.run?.result) return null;
        const id = generateId('bt');
        const run: BacktestRun = {
          id,
          name: data.run.name ?? `Imported - ${new Date().toLocaleString()}`,
          strategyConfig: data.run.strategyConfig,
          backtestConfig: data.run.backtestConfig,
          status: 'completed',
          progress: 100,
          result: data.run.result,
          error: null,
          startedAt: data.run.result.startTime ?? Date.now(),
          completedAt: data.run.result.endTime ?? Date.now(),
          executionTimeMs: data.run.result.executionTimeMs ?? 0,
          tags: data.run.tags ?? ['imported'],
        };
        set((s) => {
          s.runs[id] = run;
          s.runOrder.unshift(id);
          s.activeRunId = id;
        });
        return id;
      } catch {
        return null;
      }
    },
  })),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveRun = (s: BacktestStoreState) =>
  s.activeRunId ? s.runs[s.activeRunId] ?? null : null;

export const selectActiveResult = (s: BacktestStoreState) =>
  s.activeRunId ? s.runs[s.activeRunId]?.result ?? null : null;

export const selectActiveMetrics = (s: BacktestStoreState) =>
  s.activeRunId ? s.runs[s.activeRunId]?.result?.metrics ?? null : null;

export const selectActiveTrades = (s: BacktestStoreState): Trade[] =>
  s.activeRunId ? s.runs[s.activeRunId]?.result?.trades ?? [] : [];

export const selectActiveEquityCurve = (s: BacktestStoreState): EquityPoint[] =>
  s.activeRunId ? s.runs[s.activeRunId]?.result?.equityCurve ?? [] : [];

export const selectRunsInOrder = (s: BacktestStoreState) =>
  s.runOrder.map((id) => s.runs[id]).filter(Boolean);

export const selectCompletedRuns = (s: BacktestStoreState) =>
  s.runOrder.map((id) => s.runs[id]).filter((r) => r?.status === 'completed');

export const selectRunsByTag = (tag: string) => (s: BacktestStoreState) =>
  Object.values(s.runs).filter((r) => r.tags.includes(tag));

export const selectActiveOptimization = (s: BacktestStoreState) =>
  s.activeOptimizationId ? s.optimizations[s.activeOptimizationId] ?? null : null;

export const selectComparisonMetrics = (s: BacktestStoreState) =>
  s.comparison.map((c) => ({ name: c.name, color: c.color, ...c.metrics }));

export const selectBookmarksByRun = (runId: string) => (s: BacktestStoreState) =>
  s.bookmarks.filter((b) => b.runId === runId);

export const selectAllTags = (s: BacktestStoreState): string[] => {
  const tags = new Set<string>();
  for (const run of Object.values(s.runs)) {
    for (const tag of run.tags) tags.add(tag);
  }
  return [...tags].sort();
};
