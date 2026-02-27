// Bloomberg BSH — Backtest Status Header
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import React from 'react';

interface BacktestStatusHeaderProps {
  runId?: string;
  configHash?: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  completedAt?: string;
}

export function BacktestStatusHeader({ runId, configHash, status, completedAt }: BacktestStatusHeaderProps) {
  if (status === 'idle' || !runId) return null;

  const statusColor = status === 'complete' ? GREEN : status === 'error' ? RED : BLUE;
  const statusBg = status === 'complete' ? '#0d2b18' : status === 'error' ? '#2b0d0d' : '#0d1a2b';
  const statusLabel = status === 'complete' ? '✓ COMPLETE' : status === 'error' ? '✗ FAILED' : '⏳ RUNNING';

  return (
    <div
      style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'5px 10px', background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2,
        minHeight:32, marginBottom:8, fontFamily:MONO, fontSize:11,
        borderLeft:`3px solid ${statusColor}`,
      }}
      data-testid="backtest-status-header"
      role="status"
      aria-live="polite"
      aria-label={`Backtest ${runId} ${statusLabel}`}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ background:statusBg, border:`1px solid ${statusColor}`, borderRadius:2, padding:'2px 8px', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:TEXT, fontFamily:MONO }} data-testid="backtest-status-run-id">
            {runId}
          </span>
          <span style={{ color:statusColor, fontWeight:700 }} data-testid="backtest-status-badge">
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        {configHash && (
          <span title="Config hash" data-testid="backtest-status-config-hash" style={{ color:SUBTLE, fontSize:10 }}>
            HASH: <span style={{ color:AMBER, fontFamily:MONO }}>{configHash.slice(0, 8)}</span>
          </span>
        )}
        {completedAt && (
          <span title="Completed at" data-testid="backtest-status-time" style={{ color:SUBTLE, fontSize:10, fontFamily:MONO }}>
            {new Date(completedAt).toLocaleTimeString()}
          </span>
        )}
        {status === 'running' && (
          <div style={{ display:'flex', gap:2 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:4, height:4, borderRadius:'50%', background:BLUE, opacity: 0.3 + i * 0.35 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
