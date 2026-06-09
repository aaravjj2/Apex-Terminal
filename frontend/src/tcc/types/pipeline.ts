import type { Edge, Node } from '@xyflow/react';

export const ORCHESTRATION_SSE_EVENTS = [
  'agent_thought',
  'risk_gate_evaluation',
  'mirofish_mc_progress',
  'spci_applied',
  'execution_success',
  'signal_invalidated',
] as const;

export type OrchestrationEventType = (typeof ORCHESTRATION_SSE_EVENTS)[number];

export type GateStatus = 'pass' | 'fail' | 'pending';

export const RISK_GATE_IDS = [
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
  'M07',
  'M08',
  'M09',
] as const;

export type RiskGateId = (typeof RISK_GATE_IDS)[number];

export interface DirectorNodeData {
  bullish_agent_ratio?: number;
  sigma_sq?: number;
  alpha_param?: number;
  beta_param?: number;
  primary_catalyst?: string;
  mcRunning?: boolean;
  [key: string]: unknown;
}

export interface QuantNodeData {
  predicted_return_pct?: number;
  confidence_interval_upper?: number;
  confidence_interval_lower?: number;
  horizon_periods?: number;
  [key: string]: unknown;
}

export interface RiskNodeData {
  gates: Record<RiskGateId, GateStatus>;
  [key: string]: unknown;
}

export interface ExecutionNodeData {
  blocked: boolean;
  hitlAuthorized: boolean;
  weight_delta?: number;
  cost_est?: number;
  slippage_budget?: number;
  invalidated?: boolean;
  [key: string]: unknown;
}

export type PipelineNodeData =
  | DirectorNodeData
  | QuantNodeData
  | RiskNodeData
  | ExecutionNodeData;

export type PipelineNode = Node<PipelineNodeData, string>;
export type PipelineEdge = Edge<{ label?: string; confidence_score?: number; bullish_agent_ratio?: number }>;

export interface PipelineSSEEnvelope {
  seq: number;
  timestamp: string;
  job_id?: string;
  payload: Record<string, unknown>;
}

export function defaultRiskGates(): Record<RiskGateId, GateStatus> {
  return Object.fromEntries(RISK_GATE_IDS.map((id) => [id, 'pending' as GateStatus])) as Record<
    RiskGateId,
    GateStatus
  >;
}
