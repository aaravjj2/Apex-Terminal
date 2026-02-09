/**
 * Risk Desk types — mirrors backend schemas (Week 1 + Week 2).
 */

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  row: number | null;
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  total_rows: number;
  error_count: number;
  warning_count: number;
  issues: ValidationIssue[];
}

// ── Week 2 types ──────────────────────────────────────────────────────

export interface ToolTraceEntry {
  tool_id: string;
  tool_name: string;
  started_at?: string;
  ended_at?: string;
  duration_ms: number;
  status: string;
  inputs_summary: string;
  outputs_summary: string;
  cache_hit?: boolean;
}

export interface GreeksSummary {
  net_delta: number;
  net_gamma: number;
  net_vega: number;
  net_theta: number;
  per_leg: Record<string, unknown>[];
}

export interface StressScenario {
  id: string;
  label: string;
  spot_shift_pct: number;
  vol_shift_pct: number;
}

export interface StressLegResult {
  symbol: string;
  option_type: string;
  strike: number;
  base_value: number;
  stressed_value: number;
  pnl: number;
}

export interface HedgeLeg {
  symbol: string;
  option_type: string;
  strike: number;
  expiry: string;
  side: string;
  quantity: number;
  premium_est: number;
}

export interface HedgeCandidate {
  id: string;
  name: string;
  strategy_type: string;
  legs: HedgeLeg[];
  net_cost_est: number;
  max_loss_reduction_est: number;
  explanation: string;
}

export interface StressResult {
  scenario: StressScenario;
  total_pnl: number;
  leg_results: StressLegResult[];
  hedge_candidates: HedgeCandidate[];
}

export interface ComplianceViolation {
  code: string;
  severity: string;
  message: string;
  suggested_fix: string;
}

export interface ComplianceResult {
  status: string;
  violations: ComplianceViolation[];
}

export interface VerifierResult {
  method: string;
  verified: boolean;
  max_delta_deviation: number;
  max_gamma_deviation: number;
  max_vega_deviation: number;
}

export interface TicketDraft {
  run_id: string;
  hedge_id: string;
  hedge_name: string;
  legs: Record<string, unknown>[];
  net_cost_est: number;
  compliance_status: string;
  generated_at: string;
  notes: string;
}

export interface RiskRunResult {
  run_id: string;
  ok: boolean;
  error: string;
  created_at?: string;
  config_hash?: string;
  portfolio_hash?: string;
  validation: ValidationResult | null;
  greeks: GreeksSummary | null;
  stress: StressResult | null;
  verification: VerifierResult | null;
  compliance: ComplianceResult | null;
  tool_trace: ToolTraceEntry[];
}

export interface ScenarioOption {
  id: string;
  label: string;
}

export type RunState = 'idle' | 'running' | 'done';
