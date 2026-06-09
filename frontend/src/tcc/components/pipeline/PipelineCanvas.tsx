import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';

import { usePipelineSSE, type PipelineSSEState } from '@/tcc/hooks/usePipelineSSE';
import { defaultRiskGates, type PipelineEdge, type PipelineNode } from '@/tcc/types/pipeline';

import { DataEdge } from './DataEdge';
import { DirectorNode } from './DirectorNode';
import { ExecutionNode } from './ExecutionNode';
import { QuantNode } from './QuantNode';
import { RiskNode } from './RiskNode';

const nodeTypes: NodeTypes = {
  director: DirectorNode,
  quant: QuantNode,
  risk: RiskNode,
  execution: ExecutionNode,
};

const edgeTypes: EdgeTypes = {
  data: DataEdge,
};

function buildInitialNodes(): PipelineNode[] {
  return [
    {
      id: 'director',
      type: 'director',
      position: { x: 0, y: 80 },
      data: { mcRunning: false },
    },
    {
      id: 'quant',
      type: 'quant',
      position: { x: 280, y: 80 },
      data: {},
    },
    {
      id: 'risk',
      type: 'risk',
      position: { x: 560, y: 80 },
      data: { gates: defaultRiskGates() },
    },
    {
      id: 'execution',
      type: 'execution',
      position: { x: 840, y: 80 },
      data: { blocked: true, hitlAuthorized: false },
    },
  ];
}

function buildInitialEdges(): PipelineEdge[] {
  return [
    {
      id: 'e-director-quant',
      source: 'director',
      target: 'quant',
      type: 'data',
      data: { bullish_agent_ratio: 0.55, label: 'μ 0.550' },
    },
    {
      id: 'e-quant-risk',
      source: 'quant',
      target: 'risk',
      type: 'data',
      data: { confidence_score: 0.9, label: 'conf 0.90' },
    },
    {
      id: 'e-risk-execution',
      source: 'risk',
      target: 'execution',
      type: 'data',
      data: { label: 'gates' },
    },
  ];
}

export interface PipelineCanvasProps {
  jobId?: string;
  className?: string;
  /** Shared SSE state — avoids duplicate EventSource when embedded in HITL */
  sse?: PipelineSSEState & { reset: () => void };
}

function PipelineCanvasInner({ jobId, className, sse: sseProp }: PipelineCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(buildInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<PipelineEdge>(buildInitialEdges());
  const internalSse = usePipelineSSE({ jobId, enabled: sseProp === undefined });
  const sse = sseProp ?? internalSse;

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id === 'director') return { ...node, data: { ...node.data, ...sse.director } };
        if (node.id === 'quant') return { ...node, data: { ...node.data, ...sse.quant } };
        if (node.id === 'risk') return { ...node, data: { ...node.data, ...sse.risk } };
        if (node.id === 'execution') return { ...node, data: { ...node.data, ...sse.execution } };
        return node;
      }),
    );
  }, [sse.director, sse.quant, sse.risk, sse.execution, setNodes]);

  useEffect(() => {
    setEdges((current) =>
      current.map((edge) => {
        if (edge.id === 'e-director-quant' && sse.director.bullish_agent_ratio !== undefined) {
          const mu = sse.director.bullish_agent_ratio;
          return {
            ...edge,
            data: { ...edge.data, bullish_agent_ratio: mu, label: `μ ${mu.toFixed(3)}` },
          };
        }
        if (edge.id === 'e-quant-risk' && sse.quant.confidence_interval_upper !== undefined) {
          const conf = 0.9;
          return {
            ...edge,
            data: { ...edge.data, confidence_score: conf, label: `conf ${conf.toFixed(2)}` },
          };
        }
        return edge;
      }),
    );
  }, [sse.director.bullish_agent_ratio, sse.quant.confidence_interval_upper, setEdges]);

  const statusLine = useMemo(() => {
    const parts = [
      sse.connected ? 'SSE connected' : 'SSE disconnected',
      sse.lastEvent ? `last: ${sse.lastEvent}` : 'idle',
    ];
    return parts.join(' · ');
  }, [sse.connected, sse.lastEvent]);

  return (
    <div className={className ?? 'flex h-full min-h-[480px] flex-col'}>
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
        <span>Pipeline DAG</span>
        <span>{statusLine}</span>
      </div>
      <div className="pipeline-canvas flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="hsl(var(--border))" />
          <MiniMap
            nodeColor={() => 'hsl(var(--primary))'}
            maskColor="hsl(var(--background) / 0.75)"
          />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export function PipelineCanvas(props: PipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
