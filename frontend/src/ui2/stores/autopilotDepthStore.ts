/**
 * autopilotDepthStore.ts — Depth Upgrade A: Risk Controls + Execution Model + Evaluation
 * Pure deterministic DEMO store — no network, no randomness.
 */

// ─── FNV-1a 32-bit (same as elsewhere) ─────────────────────────────────────
function fnv32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RiskControls {
  max_position_notional: number;
  max_gross_exposure: number;
  max_daily_loss: number;
  max_trades_per_run: number;
}

export interface ExecutionParams {
  fee_per_order: number;
  bps_fee: number;
  slippage_base_bps: number;
  slippage_vol_multiplier: number;
}

export interface FillRecord {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  expected_price: number;
  fill_price: number;
  slippage_bps: number;
  fee: number;
  timestamp: string;
}

export interface EvaluationAttribution {
  category: string;
  expected: number;
  realized: number;
  delta: number;
}

export interface RunEvaluation {
  run_id: string;
  expected_pnl: number;
  realized_pnl: number;
  total_fees: number;
  total_slippage: number;
  adverse_movement: number;
  attribution: EvaluationAttribution[];
  fills: FillRecord[];
  risk_budget_remaining: RiskBudgetRemaining;
  breaches: RiskBreach[];
  hash: string;
}

export interface RiskBudgetRemaining {
  notional_used: number;
  notional_remaining: number;
  exposure_used: number;
  exposure_remaining: number;
  daily_loss_used: number;
  daily_loss_remaining: number;
  trades_used: number;
  trades_remaining: number;
}

export interface RiskBreach {
  rule: string;
  limit: number;
  attempted: number;
  rejected_symbol: string;
  reason: string;
}

// ─── Default Controls ───────────────────────────────────────────────────────
const DEFAULT_RISK_CONTROLS: RiskControls = {
  max_position_notional: 50000,
  max_gross_exposure: 200000,
  max_daily_loss: 5000,
  max_trades_per_run: 20,
};

const DEFAULT_EXECUTION_PARAMS: ExecutionParams = {
  fee_per_order: 1.50,
  bps_fee: 2.5,
  slippage_base_bps: 1.0,
  slippage_vol_multiplier: 1.5,
};

// ─── Deterministic Demo Data ────────────────────────────────────────────────
import { RECORDING_TS } from '../dataMode/config';
// RECORDING_TS anchors to data/recordings/core-default date_range.start (replaces synthetic DEMO_TS)
const DEMO_TS = RECORDING_TS;

function generateDeterministicEvaluation(runId: string, controls: RiskControls, params: ExecutionParams): RunEvaluation {
  const seed = fnv32(`${runId}:${DEMO_TS}`);
  const s1 = fnv32(`${seed}:fill1`);
  const s2 = fnv32(`${seed}:fill2`);
  const s3 = fnv32(`${seed}:fill3`);
  const s4 = fnv32(`${seed}:fill4`);
  const s5 = fnv32(`${seed}:fill5`);

  const symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'];
  const fills: FillRecord[] = symbols.map((sym, i) => {
    const h = [s1, s2, s3, s4, s5][i];
    const qty = 10 + (h % 90);
    const basePrice = 150 + (h % 200);
    const slippageBps = params.slippage_base_bps + (h % 3) * params.slippage_vol_multiplier;
    const fillPrice = basePrice * (1 + slippageBps / 10000);
    const fee = params.fee_per_order + (qty * basePrice * params.bps_fee) / 10000;
    return {
      symbol: sym,
      side: (h % 2 === 0 ? 'buy' : 'sell') as 'buy' | 'sell',
      qty,
      expected_price: Math.round(basePrice * 100) / 100,
      fill_price: Math.round(fillPrice * 100) / 100,
      slippage_bps: Math.round(slippageBps * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      timestamp: DEMO_TS,
    };
  });

  const totalFees = fills.reduce((s, f) => s + f.fee, 0);
  const totalSlippage = fills.reduce((s, f) => Math.abs(f.fill_price - f.expected_price) * f.qty + s, 0);
  const expectedPnl = Math.round(((seed % 5000) - 1000) * 100) / 100;
  const adverseMovement = Math.round(((s3 % 800) - 200) * 100) / 100;
  const realizedPnl = Math.round((expectedPnl - totalFees - totalSlippage - adverseMovement) * 100) / 100;

  const notionalUsed = fills.reduce((s, f) => s + f.qty * f.expected_price, 0);
  const tradesUsed = fills.length;

  // Generate one breach (deterministic)
  const breaches: RiskBreach[] = [];
  const breachSeed = fnv32(`${seed}:breach`);
  if (breachSeed % 3 === 0) {
    breaches.push({
      rule: 'max_position_notional',
      limit: controls.max_position_notional,
      attempted: controls.max_position_notional + 5000,
      rejected_symbol: 'GME',
      reason: `Position notional $${controls.max_position_notional + 5000} exceeds limit $${controls.max_position_notional}`,
    });
  }
  breaches.push({
    rule: 'max_trades_per_run',
    limit: controls.max_trades_per_run,
    attempted: controls.max_trades_per_run + 2,
    rejected_symbol: 'COIN',
    reason: `Trade count ${controls.max_trades_per_run + 2} exceeds limit ${controls.max_trades_per_run}`,
  });

  const attribution: EvaluationAttribution[] = [
    { category: 'Gross PnL', expected: expectedPnl, realized: expectedPnl, delta: 0 },
    { category: 'Fees', expected: 0, realized: -Math.round(totalFees * 100) / 100, delta: -Math.round(totalFees * 100) / 100 },
    { category: 'Slippage', expected: 0, realized: -Math.round(totalSlippage * 100) / 100, delta: -Math.round(totalSlippage * 100) / 100 },
    { category: 'Adverse Movement', expected: 0, realized: -Math.round(Math.abs(adverseMovement) * 100) / 100, delta: -Math.round(Math.abs(adverseMovement) * 100) / 100 },
    { category: 'Net PnL', expected: expectedPnl, realized: realizedPnl, delta: Math.round((realizedPnl - expectedPnl) * 100) / 100 },
  ];

  const evalHash = fnv32(JSON.stringify({ fills, attribution, breaches })).toString(16).padStart(8, '0');

  return {
    run_id: runId,
    expected_pnl: expectedPnl,
    realized_pnl: realizedPnl,
    total_fees: Math.round(totalFees * 100) / 100,
    total_slippage: Math.round(totalSlippage * 100) / 100,
    adverse_movement: Math.round(Math.abs(adverseMovement) * 100) / 100,
    attribution,
    fills,
    risk_budget_remaining: {
      notional_used: Math.round(notionalUsed),
      notional_remaining: Math.round(controls.max_gross_exposure - notionalUsed),
      exposure_used: Math.round(notionalUsed),
      exposure_remaining: Math.round(controls.max_gross_exposure - notionalUsed),
      daily_loss_used: Math.abs(Math.min(0, realizedPnl)),
      daily_loss_remaining: Math.round(controls.max_daily_loss - Math.abs(Math.min(0, realizedPnl))),
      trades_used: tradesUsed,
      trades_remaining: controls.max_trades_per_run - tradesUsed,
    },
    breaches,
    hash: evalHash,
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────
type Listener = () => void;

interface State {
  riskControls: RiskControls;
  executionParams: ExecutionParams;
  evaluations: Record<string, RunEvaluation>;
}

let state: State = {
  riskControls: { ...DEFAULT_RISK_CONTROLS },
  executionParams: { ...DEFAULT_EXECUTION_PARAMS },
  evaluations: {},
};

const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

export const autopilotDepthStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  // ── Risk Controls ─────────────────────────────────────────────────────
  getRiskControls: () => state.riskControls,
  updateRiskControls(updates: Partial<RiskControls>) {
    state = { ...state, riskControls: { ...state.riskControls, ...updates } };
    emit();
  },

  // ── Execution Params ──────────────────────────────────────────────────
  getExecutionParams: () => state.executionParams,
  updateExecutionParams(updates: Partial<ExecutionParams>) {
    state = { ...state, executionParams: { ...state.executionParams, ...updates } };
    emit();
  },

  // ── Evaluation ────────────────────────────────────────────────────────
  getEvaluation(runId: string): RunEvaluation {
    if (!state.evaluations[runId]) {
      const ev = generateDeterministicEvaluation(runId, state.riskControls, state.executionParams);
      state = { ...state, evaluations: { ...state.evaluations, [runId]: ev } };
      // no emit here — it's lazy-computed on read
    }
    return state.evaluations[runId];
  },

  runEvaluation(runId: string): RunEvaluation {
    const ev = generateDeterministicEvaluation(runId, state.riskControls, state.executionParams);
    state = { ...state, evaluations: { ...state.evaluations, [runId]: ev } };
    emit();
    return ev;
  },

  // ── Export hash ───────────────────────────────────────────────────────
  getExportHash(runId: string): string {
    const ev = this.getEvaluation(runId);
    return fnv32(JSON.stringify(ev)).toString(16).padStart(8, '0');
  },

  reset() {
    state = {
      riskControls: { ...DEFAULT_RISK_CONTROLS },
      executionParams: { ...DEFAULT_EXECUTION_PARAMS },
      evaluations: {},
    };
    emit();
  },
};
