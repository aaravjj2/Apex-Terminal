/**
 * B2 — DEMO_MODE deterministic fixtures
 * Provides stable synthetic data for testing.
 * Used by E2E tests and the RunsPanel fallback.
 */

export const DEMO_SEED = 42;

export const DEMO_TIMESTAMP = '2025-06-01T12:00:00.000Z';

export const DEMO_RISK_RUNS = [
  {
    run_type: 'risk' as const,
    run_id: 'risk-demo-001',
    created_at: '2025-06-01T12:00:00.000Z',
    scenario_or_strategy: 'SPY -20% Crash',
    determinism_hash: 'a1b2c3d4e5f6',
    key_metrics: { worst_case_pnl: -15420.50, max_loss: -15420.50 },
    status: 'success' as const,
  },
  {
    run_type: 'risk' as const,
    run_id: 'risk-demo-002',
    created_at: '2025-06-01T11:00:00.000Z',
    scenario_or_strategy: 'Vol Spike +50%',
    determinism_hash: 'f6e5d4c3b2a1',
    key_metrics: { worst_case_pnl: -8200.00, max_loss: -8200.00 },
    status: 'blocked' as const,
  },
  {
    run_type: 'risk' as const,
    run_id: 'risk-demo-003',
    created_at: '2025-05-31T12:00:00.000Z',
    scenario_or_strategy: 'Rates +200bps',
    determinism_hash: 'aabbccddeeff',
    key_metrics: { worst_case_pnl: -3580.00, max_loss: -3580.00 },
    status: 'success' as const,
  },
];

export const DEMO_BACKTEST_RUNS = [
  {
    run_type: 'backtest' as const,
    run_id: 'bt-demo-001',
    created_at: '2025-06-01T10:00:00.000Z',
    scenario_or_strategy: 'iron_condor',
    determinism_hash: '112233445566',
    key_metrics: { total_return_pct: 12.45, max_drawdown_pct: -5.20, sharpe_ratio: 1.85 },
    status: 'success' as const,
  },
  {
    run_type: 'backtest' as const,
    run_id: 'bt-demo-002',
    created_at: '2025-06-01T09:00:00.000Z',
    scenario_or_strategy: 'covered_call',
    determinism_hash: '665544332211',
    key_metrics: { total_return_pct: 8.30, max_drawdown_pct: -3.10, sharpe_ratio: 2.10 },
    status: 'success' as const,
  },
];

export const ALL_DEMO_RUNS = [...DEMO_RISK_RUNS, ...DEMO_BACKTEST_RUNS];

/**
 * Determinism check: run twice, same output.
 */
export function verifyDemoRunsDeterminism(): boolean {
  const run1 = JSON.stringify(ALL_DEMO_RUNS);
  const run2 = JSON.stringify(ALL_DEMO_RUNS);
  return run1 === run2;
}
