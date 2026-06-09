import { describe, expect, it } from 'vitest';

import { ORCHESTRATION_SSE_EVENTS } from '@/tcc/types/pipeline';

describe('ORCHESTRATION_SSE_EVENTS', () => {
  it('lists all six pipeline event types', () => {
    expect(ORCHESTRATION_SSE_EVENTS).toEqual([
      'agent_thought',
      'risk_gate_evaluation',
      'mirofish_mc_progress',
      'spci_applied',
      'execution_success',
      'signal_invalidated',
    ]);
  });
});
