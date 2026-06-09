import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { QuantNodeData } from '@/tcc/types/pipeline';

function fmtPct(value: number | undefined) {
  if (value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function QuantNode({ data }: NodeProps) {
  const d = data as QuantNodeData;

  return (
    <div className="pipeline-node" data-testid="quant-node">
      <Handle type="target" position={Position.Left} />
      <div className="pipeline-node__title">Quant · Kronos + SPCI</div>
      <div className="pipeline-node__body">
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">Forecast</span>
          <span className="font-mono tabular-nums text-[hsl(var(--primary))]">
            {fmtPct(d.predicted_return_pct)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">SPCI upper</span>
          <span className="font-mono tabular-nums">{fmtPct(d.confidence_interval_upper)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">SPCI lower</span>
          <span className="font-mono tabular-nums">{fmtPct(d.confidence_interval_lower)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">Horizon</span>
          <span className="font-mono tabular-nums">
            {d.horizon_periods ?? '—'}d
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
