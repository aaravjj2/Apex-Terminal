import { Handle, Position, type NodeProps } from '@xyflow/react';

import { cn } from '@/tcc/lib/cn';
import type { DirectorNodeData } from '@/tcc/types/pipeline';

function fmt(value: number | undefined, digits = 3) {
  return value === undefined ? '—' : value.toFixed(digits);
}

export function DirectorNode({ data }: NodeProps) {
  const d = data as DirectorNodeData;
  const alpha = d.alpha_param ?? 0;
  const beta = d.beta_param ?? 0;
  const total = alpha + beta;
  const betaPct = total > 0 ? (alpha / total) * 100 : 50;

  return (
    <div
      className={cn('pipeline-node', d.mcRunning && 'pipeline-node--pulse-amber')}
      data-testid="director-node"
    >
      <Handle type="target" position={Position.Left} />
      <div className="pipeline-node__title">Director · MiroFish MC</div>
      <div className="pipeline-node__body">
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">μ ratio</span>
          <span className="font-mono tabular-nums">{fmt(d.bullish_agent_ratio)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[hsl(var(--muted-foreground))]">σ²</span>
          <span className="font-mono tabular-nums">{fmt(d.sigma_sq, 4)}</span>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>Beta α={fmt(alpha, 2)}</span>
            <span>β={fmt(beta, 2)}</span>
          </div>
          <div className="beta-bar" aria-label="Beta distribution bar">
            <div className="beta-bar__fill" style={{ width: `${betaPct}%` }} />
          </div>
        </div>
        <div className="text-[11px] leading-snug text-[hsl(var(--foreground))]">
          {d.primary_catalyst ?? (d.mcRunning ? 'MC swarm running…' : 'Awaiting catalyst')}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
