import { Handle, Position, type NodeProps } from '@xyflow/react';

import { cn } from '@/tcc/lib/cn';
import { RISK_GATE_IDS, type RiskNodeData } from '@/tcc/types/pipeline';

export function RiskNode({ data }: NodeProps) {
  const d = data as RiskNodeData;

  return (
    <div className="pipeline-node" data-testid="risk-node">
      <Handle type="target" position={Position.Left} />
      <div className="pipeline-node__title">Risk · M01–M09</div>
      <div className="pipeline-node__body">
        <div className="gate-grid">
          {RISK_GATE_IDS.map((gateId) => {
            const status = d.gates[gateId] ?? 'pending';
            return (
              <div
                key={gateId}
                className={cn(
                  'gate-pill',
                  status === 'pass' && 'gate-pill--pass',
                  status === 'fail' && 'gate-pill--fail',
                  status === 'pending' && 'gate-pill--pending',
                )}
                title={`${gateId}: ${status}`}
              >
                {gateId}
              </div>
            );
          })}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
