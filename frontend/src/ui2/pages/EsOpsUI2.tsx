import { useSyncExternalStore, useEffect } from 'react';
import { elasticV3Store } from '../stores/waves21_50Store';

function useElasticV3() {
  return useSyncExternalStore(elasticV3Store.subscribe, elasticV3Store.getState);
}

export function EsOpsUI2() {
  const { templates, aliases, pipelineMetrics, dlq, lag, semanticEnabled, artifacts, loading: _loading, error } = useElasticV3();

  useEffect(() => {
    elasticV3Store.fetchTemplates();
    elasticV3Store.fetchAliases();
    elasticV3Store.fetchPipelineMetrics();
    elasticV3Store.fetchLag();
    elasticV3Store.fetchSemanticStatus();
    elasticV3Store.fetchArtifacts();
  }, []);

  return (
    <div data-testid="es-ops-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Elasticsearch Ops — Waves 46-50</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div data-testid="es-ops-templates" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Index Templates</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{templates.length}</div>
        </div>
        <div data-testid="es-ops-aliases" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Aliases</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{aliases.length}</div>
        </div>
        <div data-testid="es-ops-pipeline" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Pipeline Status</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: pipelineMetrics?.status === 'idle' ? '#22c55e' : '#f59e0b' }}>{pipelineMetrics?.status ?? 'N/A'}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Ingested: {pipelineMetrics?.docs_ingested ?? 0}</div>
        </div>
        <div data-testid="es-ops-lag" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Ingestion Lag</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{lag?.lag_ms?.toFixed(1) ?? '0.0'} ms</div>
        </div>
        <div data-testid="es-ops-semantic" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Semantic Search</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: semanticEnabled ? '#22c55e' : '#64748b' }}>{semanticEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div data-testid="es-ops-artifacts" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Artifacts</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{artifacts.length}</div>
        </div>
      </div>

      {dlq.length > 0 && (
        <div data-testid="es-ops-dlq" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#ef4444' }}>Dead Letter Queue ({dlq.length})</h2>
          {dlq.map((entry: any, i: number) => (
            <div key={i} style={{ color: '#94a3b8', padding: '4px 0' }}>{entry.doc_id}: {entry.error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
