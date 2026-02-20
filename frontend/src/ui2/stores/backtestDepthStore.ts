/**
 * backtestDepthStore.ts — Depth Upgrade B: Param Sweeps + Walk-Forward + Robustness
 * Pure deterministic DEMO store.
 */

function fnv32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SweepParam {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface SweepConfig {
  sweep_id: string;
  symbol: string;
  strategy_id: string;
  params: SweepParam[];
  metric: string;
}

export interface SweepCell {
  cell_id: string;
  param_values: Record<string, number>;
  sharpe: number;
  total_return: number;
  max_drawdown: number;
  win_rate: number;
  trade_count: number;
}

export interface SweepResult {
  sweep_id: string;
  config: SweepConfig;
  cells: SweepCell[];
  best_cell_id: string;
  hash: string;
  timestamp: string;
}

export interface WalkForwardWindow {
  window_id: number;
  train_start: string;
  train_end: string;
  test_start: string;
  test_end: string;
  in_sample_sharpe: number;
  out_of_sample_sharpe: number;
  in_sample_return: number;
  out_of_sample_return: number;
}

export interface WalkForwardResult {
  wf_id: string;
  symbol: string;
  strategy_id: string;
  windows: WalkForwardWindow[];
  aggregate_sharpe: number;
  aggregate_return: number;
  oos_degradation: number;
  hash: string;
  timestamp: string;
}

export interface RobustnessScenario {
  scenario_id: string;
  label: string;
  fee_multiplier: number;
  slippage_multiplier: number;
  delay_ms: number;
  sharpe: number;
  total_return: number;
  delta_sharpe: number;
  delta_return: number;
}

export interface RobustnessResult {
  rob_id: string;
  symbol: string;
  strategy_id: string;
  base_sharpe: number;
  base_return: number;
  scenarios: RobustnessScenario[];
  robustness_score: number;
  hash: string;
  timestamp: string;
}

// ─── Demo Constants ─────────────────────────────────────────────────────────
const DEMO_TS = '2026-02-15T14:30:00Z';

function generateSweepCells(config: SweepConfig): SweepCell[] {
  const cells: SweepCell[] = [];
  const p0 = config.params[0];
  const p1 = config.params.length > 1 ? config.params[1] : null;

  const p0Values: number[] = [];
  for (let v = p0.min; v <= p0.max; v += p0.step) p0Values.push(v);
  const p1Values: number[] = p1 ? [] : [0];
  if (p1) for (let v = p1.min; v <= p1.max; v += p1.step) p1Values.push(v);

  for (const v0 of p0Values) {
    for (const v1 of p1Values) {
      const seed = fnv32(`${config.sweep_id}:${v0}:${v1}:${DEMO_TS}`);
      const paramValues: Record<string, number> = { [p0.name]: v0 };
      if (p1) paramValues[p1.name] = v1;

      cells.push({
        cell_id: `cell-${seed.toString(16).slice(0, 8)}`,
        param_values: paramValues,
        sharpe: Math.round(((seed % 300) / 100 - 0.5) * 100) / 100,
        total_return: Math.round(((seed % 6000) / 100 - 20) * 100) / 100,
        max_drawdown: -Math.round(((seed % 2000) / 100) * 100) / 100,
        win_rate: Math.round((40 + (seed % 25)) * 100) / 100,
        trade_count: 50 + (seed % 150),
      });
    }
  }
  return cells;
}

function generateWalkForward(symbol: string, strategyId: string): WalkForwardResult {
  const wfId = `wf-${fnv32(`${symbol}:${strategyId}:wf:${DEMO_TS}`).toString(16).slice(0, 8)}`;
  const windows: WalkForwardWindow[] = [];
  const baseYear = 2024;

  for (let i = 0; i < 6; i++) {
    const seed = fnv32(`${wfId}:window:${i}`);
    const trainStart = `${baseYear}-${String((i * 2) % 12 + 1).padStart(2, '0')}-01`;
    const trainEnd = `${baseYear}-${String((i * 2 + 3) % 12 + 1).padStart(2, '0')}-01`;
    const testStart = trainEnd;
    const testEnd = `${baseYear + Math.floor((i * 2 + 5) / 12)}-${String((i * 2 + 5) % 12 + 1).padStart(2, '0')}-01`;

    const isSharpe = Math.round(((seed % 250) / 100) * 100) / 100;
    const oosSharpe = Math.round((isSharpe * (0.6 + (seed % 40) / 100)) * 100) / 100;

    windows.push({
      window_id: i + 1,
      train_start: trainStart,
      train_end: trainEnd,
      test_start: testStart,
      test_end: testEnd,
      in_sample_sharpe: isSharpe,
      out_of_sample_sharpe: oosSharpe,
      in_sample_return: Math.round(((seed % 4000) / 100 - 10) * 100) / 100,
      out_of_sample_return: Math.round(((seed % 3000) / 100 - 8) * 100) / 100,
    });
  }

  const aggSharpe = Math.round((windows.reduce((s, w) => s + w.out_of_sample_sharpe, 0) / windows.length) * 100) / 100;
  const aggReturn = Math.round((windows.reduce((s, w) => s + w.out_of_sample_return, 0) / windows.length) * 100) / 100;
  const isAvg = windows.reduce((s, w) => s + w.in_sample_sharpe, 0) / windows.length;
  const degradation = isAvg > 0 ? Math.round(((isAvg - aggSharpe) / isAvg) * 10000) / 100 : 0;

  const hash = fnv32(JSON.stringify(windows)).toString(16).padStart(8, '0');

  return { wf_id: wfId, symbol, strategy_id: strategyId, windows, aggregate_sharpe: aggSharpe, aggregate_return: aggReturn, oos_degradation: degradation, hash, timestamp: DEMO_TS };
}

function generateRobustness(symbol: string, strategyId: string): RobustnessResult {
  const robId = `rob-${fnv32(`${symbol}:${strategyId}:rob:${DEMO_TS}`).toString(16).slice(0, 8)}`;
  const baseSeed = fnv32(`${robId}:base`);
  const baseSharpe = Math.round(((baseSeed % 200) / 100 + 0.5) * 100) / 100;
  const baseReturn = Math.round(((baseSeed % 3000) / 100 + 5) * 100) / 100;

  const scenarioDefs = [
    { label: 'Base Case', fee: 1.0, slip: 1.0, delay: 0 },
    { label: '2x Fees', fee: 2.0, slip: 1.0, delay: 0 },
    { label: '3x Fees', fee: 3.0, slip: 1.0, delay: 0 },
    { label: '2x Slippage', fee: 1.0, slip: 2.0, delay: 0 },
    { label: '3x Slippage', fee: 1.0, slip: 3.0, delay: 0 },
    { label: '100ms Delay', fee: 1.0, slip: 1.0, delay: 100 },
    { label: '500ms Delay', fee: 1.0, slip: 1.0, delay: 500 },
    { label: 'Worst Case', fee: 3.0, slip: 3.0, delay: 500 },
  ];

  const scenarios: RobustnessScenario[] = scenarioDefs.map((d, i) => {
    const seed = fnv32(`${robId}:scenario:${i}`);
    const degradation = (d.fee - 1) * 0.15 + (d.slip - 1) * 0.2 + d.delay * 0.0002;
    const scenSharpe = Math.round((baseSharpe * (1 - degradation) + (seed % 10 - 5) / 100) * 100) / 100;
    const scenReturn = Math.round((baseReturn * (1 - degradation * 0.8) + (seed % 20 - 10) / 100) * 100) / 100;
    return {
      scenario_id: `scen-${i}`,
      label: d.label,
      fee_multiplier: d.fee,
      slippage_multiplier: d.slip,
      delay_ms: d.delay,
      sharpe: scenSharpe,
      total_return: scenReturn,
      delta_sharpe: Math.round((scenSharpe - baseSharpe) * 100) / 100,
      delta_return: Math.round((scenReturn - baseReturn) * 100) / 100,
    };
  });

  const positiveCount = scenarios.filter((s) => s.sharpe > 0).length;
  const robustnessScore = Math.round((positiveCount / scenarios.length) * 100);
  const hash = fnv32(JSON.stringify(scenarios)).toString(16).padStart(8, '0');

  return { rob_id: robId, symbol, strategy_id: strategyId, base_sharpe: baseSharpe, base_return: baseReturn, scenarios, robustness_score: robustnessScore, hash, timestamp: DEMO_TS };
}

// ─── Store ──────────────────────────────────────────────────────────────────
type Listener = () => void;

interface State {
  sweeps: Record<string, SweepResult>;
  walkForwards: Record<string, WalkForwardResult>;
  robustness: Record<string, RobustnessResult>;
}

let state: State = { sweeps: {}, walkForwards: {}, robustness: {} };
const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

export const backtestDepthStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  // ── Sweeps ────────────────────────────────────────────────────────────
  runSweep(config: SweepConfig): SweepResult {
    const cells = generateSweepCells(config);
    let bestIdx = 0;
    cells.forEach((c, i) => { if (c.sharpe > cells[bestIdx].sharpe) bestIdx = i; });
    const hash = fnv32(JSON.stringify(cells)).toString(16).padStart(8, '0');
    const result: SweepResult = { sweep_id: config.sweep_id, config, cells, best_cell_id: cells[bestIdx].cell_id, hash, timestamp: DEMO_TS };
    state = { ...state, sweeps: { ...state.sweeps, [config.sweep_id]: result } };
    emit();
    return result;
  },
  getSweep: (sweepId: string) => state.sweeps[sweepId],
  getSweeps: () => Object.values(state.sweeps),

  // ── Walk-Forward ──────────────────────────────────────────────────────
  runWalkForward(symbol: string, strategyId: string): WalkForwardResult {
    const result = generateWalkForward(symbol, strategyId);
    state = { ...state, walkForwards: { ...state.walkForwards, [result.wf_id]: result } };
    emit();
    return result;
  },
  getWalkForward: (wfId: string) => state.walkForwards[wfId],
  getWalkForwards: () => Object.values(state.walkForwards),

  // ── Robustness ────────────────────────────────────────────────────────
  runRobustness(symbol: string, strategyId: string): RobustnessResult {
    const result = generateRobustness(symbol, strategyId);
    state = { ...state, robustness: { ...state.robustness, [result.rob_id]: result } };
    emit();
    return result;
  },
  getRobustness: (robId: string) => state.robustness[robId],
  getRobustnessResults: () => Object.values(state.robustness),

  // ── Export ────────────────────────────────────────────────────────────
  getExportHash(id: string): string {
    const sw = state.sweeps[id];
    if (sw) return fnv32(JSON.stringify(sw)).toString(16).padStart(8, '0');
    const wf = state.walkForwards[id];
    if (wf) return fnv32(JSON.stringify(wf)).toString(16).padStart(8, '0');
    const rb = state.robustness[id];
    if (rb) return fnv32(JSON.stringify(rb)).toString(16).padStart(8, '0');
    return '00000000';
  },

  reset() {
    state = { sweeps: {}, walkForwards: {}, robustness: {} };
    emit();
  },
};
