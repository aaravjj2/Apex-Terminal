const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React from 'react';
import { useAutopilotStore } from '../store';
import type { CycleResult } from '../types';

function RunItem({ run }: { run: CycleResult }) {
  const dur = (run.duration_ms / 1000).toFixed(1);
  const time = new Date(run.started_at).toLocaleTimeString();
  return (
    <div data-testid={`run-${run.cycle_id}`} style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, background: run.success ? 'transparent' : RED + '0a', fontFamily: MONO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: run.success ? GREEN : RED }}>{run.success ? 'CYCLE' : 'FAILED'}</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>#{run.cycle_id.slice(0, 6)}</span>
        </div>
        <span style={{ fontSize: 10, color: SUBTLE }}>{time} ({dur}s)</span>
      </div>
      {run.error && (
        <div style={{ fontSize: 10, color: RED, background: RED + '22', borderRadius: 2, padding: '3px 6px', marginBottom: 4 }}>{run.error.message}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 10, color: SUBTLE }}>
        <span title="Candidates Gen/Selected"> {run.candidates.generated}/{run.selection.selected}</span>
        <span title="Orders Submitted/Filled"> {run.execution.submitted}/{run.execution.filled}</span>
        <span title="Exit Signals"> {run.monitoring.exit_signals}</span>
        <span title="Exits Executed"> {run.monitoring.exits_executed}</span>
      </div>
    </div>
  );
}

export const RunHistory: React.FC = () => {
  const { runs, lastCycle } = useAutopilotStore();
  if (runs.length === 0 && !lastCycle) return (
    <div style={{ fontSize: 11, color: SUBTLE, textAlign: 'center', padding: '12px 0', fontFamily: MONO }}>No run history</div>
  );
  return (
    <div data-testid="run-history" style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: MONO }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, padding: '6px 12px', background: PANEL, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}> RUN HISTORY ({runs.length})</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {runs.map(run => <RunItem key={run.cycle_id} run={run} />)}
      </div>
    </div>
  );
};