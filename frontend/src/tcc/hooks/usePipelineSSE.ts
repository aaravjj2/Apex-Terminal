import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ORCHESTRATION_SSE_EVENTS,
  type DirectorNodeData,
  type ExecutionNodeData,
  type OrchestrationEventType,
  type PipelineSSEEnvelope,
  type QuantNodeData,
  type RiskGateId,
  type RiskNodeData,
  defaultRiskGates,
} from '@/tcc/types/pipeline';

export interface PipelineSSEState {
  connected: boolean;
  lastEvent: OrchestrationEventType | null;
  events: OrchestrationEventType[];
  thoughts: string[];
  director: DirectorNodeData;
  quant: QuantNodeData;
  risk: RiskNodeData;
  execution: ExecutionNodeData;
  error: string | null;
}

const INITIAL_STATE: PipelineSSEState = {
  connected: false,
  lastEvent: null,
  events: [],
  thoughts: [],
  director: { mcRunning: false },
  quant: {},
  risk: { gates: defaultRiskGates() },
  execution: { blocked: true, hitlAuthorized: false },
  error: null,
};

function parseEnvelope(raw: string): PipelineSSEEnvelope | null {
  try {
    return JSON.parse(raw) as PipelineSSEEnvelope;
  } catch {
    return null;
  }
}

function eventTypeFromName(name: string): OrchestrationEventType | null {
  return ORCHESTRATION_SSE_EVENTS.includes(name as OrchestrationEventType)
    ? (name as OrchestrationEventType)
    : null;
}

function applyEvent(
  prev: PipelineSSEState,
  eventType: OrchestrationEventType,
  payload: Record<string, unknown>,
): PipelineSSEState {
  const next: PipelineSSEState = {
    ...prev,
    lastEvent: eventType,
    events: prev.events.includes(eventType) ? prev.events : [...prev.events, eventType],
  };

  switch (eventType) {
    case 'agent_thought': {
      const message = String(payload.message ?? payload.thought ?? '');
      if (message) {
        next.thoughts = [...prev.thoughts.slice(-49), message];
      }
      break;
    }
    case 'mirofish_mc_progress': {
      const running = payload.status !== 'completed' && payload.status !== 'complete';
      next.director = {
        ...prev.director,
        mcRunning: running || Boolean(payload.run),
        bullish_agent_ratio:
          typeof payload.mu === 'number'
            ? payload.mu
            : typeof payload.bullish_agent_ratio === 'number'
              ? payload.bullish_agent_ratio
              : prev.director.bullish_agent_ratio,
        sigma_sq:
          typeof payload.sigma_sq === 'number' ? payload.sigma_sq : prev.director.sigma_sq,
        alpha_param:
          typeof payload.alpha_param === 'number' ? payload.alpha_param : prev.director.alpha_param,
        beta_param:
          typeof payload.beta_param === 'number' ? payload.beta_param : prev.director.beta_param,
        primary_catalyst:
          typeof payload.primary_catalyst === 'string'
            ? payload.primary_catalyst
            : prev.director.primary_catalyst,
      };
      if (!running && payload.status === 'completed') {
        next.director.mcRunning = false;
      }
      break;
    }
    case 'spci_applied': {
      next.quant = {
        ...prev.quant,
        predicted_return_pct:
          typeof payload.predicted_return_pct === 'number'
            ? payload.predicted_return_pct
            : prev.quant.predicted_return_pct,
        confidence_interval_upper:
          typeof payload.confidence_interval_upper === 'number'
            ? payload.confidence_interval_upper
            : prev.quant.confidence_interval_upper,
        confidence_interval_lower:
          typeof payload.confidence_interval_lower === 'number'
            ? payload.confidence_interval_lower
            : prev.quant.confidence_interval_lower,
        horizon_periods:
          typeof payload.horizon_periods === 'number'
            ? payload.horizon_periods
            : prev.quant.horizon_periods,
      };
      break;
    }
    case 'risk_gate_evaluation': {
      const gates = { ...prev.risk.gates };
      const results = payload.results ?? payload.gates;
      if (results && typeof results === 'object') {
        for (const [gateId, status] of Object.entries(results as Record<string, string>)) {
          if (gateId in gates) {
            gates[gateId as RiskGateId] =
              status === 'pass' || status === 'fail' ? status : 'pending';
          }
        }
      } else if (typeof payload.gate_id === 'string' && typeof payload.status === 'string') {
        const gid = payload.gate_id as RiskGateId;
        if (gid in gates) {
          gates[gid] = payload.status === 'pass' || payload.status === 'fail' ? payload.status : 'pending';
        }
      }
      next.risk = { gates };
      break;
    }
    case 'execution_success': {
      next.execution = {
        ...prev.execution,
        blocked: false,
        hitlAuthorized: true,
        weight_delta:
          typeof payload.weight_delta === 'number' ? payload.weight_delta : prev.execution.weight_delta,
        cost_est: typeof payload.cost_est === 'number' ? payload.cost_est : prev.execution.cost_est,
        slippage_budget:
          typeof payload.slippage_budget === 'number'
            ? payload.slippage_budget
            : prev.execution.slippage_budget,
        invalidated: false,
      };
      break;
    }
    case 'signal_invalidated': {
      next.execution = {
        ...prev.execution,
        blocked: true,
        hitlAuthorized: false,
        invalidated: true,
      };
      break;
    }
    default:
      break;
  }

  return next;
}

export interface UsePipelineSSEOptions {
  jobId?: string;
  streamUrl?: string;
  enabled?: boolean;
}

export function usePipelineSSE(options: UsePipelineSSEOptions = {}) {
  const { jobId, streamUrl = '/api/v1/orchestration/stream', enabled = true } = options;
  const [state, setState] = useState<PipelineSSEState>(INITIAL_STATE);
  const sourceRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const params = new URLSearchParams();
    if (jobId) params.set('job_id', jobId);
    const url = params.toString() ? `${streamUrl}?${params}` : streamUrl;

    const source = new EventSource(url);
    sourceRef.current = source;

    const onOpen = () => {
      setState((prev) => ({ ...prev, connected: true, error: null }));
    };

    const onError = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        error: 'SSE connection error',
      }));
    };

    const handleNamedEvent = (event: MessageEvent<string>) => {
      const eventType = eventTypeFromName(event.type);
      if (!eventType) return;

      const envelope = parseEnvelope(event.data);
      const payload = envelope?.payload ?? {};

      setState((prev) => applyEvent(prev, eventType, payload));
    };

    source.addEventListener('open', onOpen);
    source.addEventListener('error', onError);

    for (const eventName of ORCHESTRATION_SSE_EVENTS) {
      source.addEventListener(eventName, handleNamedEvent as EventListener);
    }

    // Heartbeat / orchestration fallback
    source.addEventListener('orchestration', (event: MessageEvent<string>) => {
      const envelope = parseEnvelope(event.data);
      if (!envelope?.payload) return;
      const nested = envelope.payload.event;
      if (typeof nested === 'string') {
        const eventType = eventTypeFromName(nested);
        if (eventType) {
          setState((prev) => applyEvent(prev, eventType, envelope.payload));
        }
      }
    });

    return () => {
      source.removeEventListener('open', onOpen);
      source.removeEventListener('error', onError);
      for (const eventName of ORCHESTRATION_SSE_EVENTS) {
        source.removeEventListener(eventName, handleNamedEvent as EventListener);
      }
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, jobId, streamUrl]);

  return { ...state, reset };
}
