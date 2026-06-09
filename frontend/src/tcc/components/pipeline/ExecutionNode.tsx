import { Handle, Position, type NodeProps } from '@xyflow/react';

import { cn } from '@/tcc/lib/cn';
import type { ExecutionNodeData } from '@/tcc/types/pipeline';

function fmtNum(value: number | undefined, digits = 4) {
  return value === undefined ? '—' : value.toFixed(digits);
}

export function ExecutionNode({ data }: NodeProps) {
  const d = data as ExecutionNodeData;
  const blocked = d.blocked || !d.hitlAuthorized || d.invalidated;

  return (
    <div
      className={cn('pipeline-node', blocked && 'execution-node--blocked')}
      data-testid="execution-node"
    >
      <Handle type="target" position={Position.Left} />
      <div className="pipeline-node__title">Execution · HITL</div>
      <div className="pipeline-node__body">
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">weight_Δ</span>
          <span className="font-mono tabular-nums">{fmtNum(d.weight_delta)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">cost_est</span>
          <span className="font-mono tabular-nums">{fmtNum(d.cost_est, 2)}</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide">
          {d.invalidated
            ? 'Signal invalidated'
            : d.hitlAuthorized
              ? 'Authorized'
              : 'Awaiting operator'}
        </div>
      </div>
    </div>
  );
}
