import { useSyncExternalStore, useEffect, useState } from 'react';
import { discoveryStore } from '../stores/waves11_20Store';

function useDiscovery() {
  return useSyncExternalStore(discoveryStore.subscribe, discoveryStore.getState);
}

export function DiscoveryUI2() {
  const { templates, candidates, reports, loading, error } = useDiscovery();
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    discoveryStore.fetchTemplates();
    discoveryStore.fetchReports();
  }, []);

  const handleGenerate = () => {
    if (selectedTemplate) {
      discoveryStore.generateCandidates(selectedTemplate);
    }
  };

  return (
    <div data-testid="discovery-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Strategy Discovery Engine</h1>
      {loading && <p>Discovering strategies...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <select
          data-testid="disc-template"
          value={selectedTemplate}
          onChange={e => setSelectedTemplate(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, minWidth: 200 }}
        >
          <option value="">Select template...</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button data-testid="disc-generate-btn" onClick={handleGenerate} disabled={!selectedTemplate} style={{ background: selectedTemplate ? '#3b82f6' : '#64748b', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: selectedTemplate ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
          Generate Candidates
        </button>
        <button data-testid="disc-report-btn" onClick={() => discoveryStore.generateReport()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>
          Generate Report
        </button>
      </div>

      {/* Candidates */}
      {candidates.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Candidates ({candidates.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            {candidates.map((c, i) => (
              <div key={i} data-testid={`cand-${i}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{c.template}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{c.candidate_id.slice(0, 12)}</div>
                <div style={{ fontSize: 13 }}>
                  {Object.entries(c.params).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>{k}</span><span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Reports */}
      {reports.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Discovery Reports ({reports.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reports.map((r, i) => (
              <div key={i} data-testid={`report-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
                <pre style={{ fontSize: 12, color: '#94a3b8', overflow: 'auto', maxHeight: 200, margin: 0 }}>{JSON.stringify(r, null, 2)}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
