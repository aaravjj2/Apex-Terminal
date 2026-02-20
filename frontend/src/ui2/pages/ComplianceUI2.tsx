import { useSyncExternalStore, useEffect } from 'react';
import { complianceStore } from '../stores/waveStores';

function useCompliance() {
  return useSyncExternalStore(complianceStore.subscribe, complianceStore.getState);
}

function statusColor(s: string): string {
  switch (s) {
    case 'pass': return '#22c55e';
    case 'fail': return '#ef4444';
    case 'warning': return '#f59e0b';
    default: return '#64748b';
  }
}

export function ComplianceUI2() {
  const { report, checks, loading, error } = useCompliance();

  useEffect(() => {
    complianceStore.fetchReport();
  }, []);

  return (
    <div data-testid="compliance-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Compliance</h1>
      {loading && <p>Running compliance checks...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderLeft: `4px solid ${(report as any).overall_compliant ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Status</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (report as any).overall_compliant ? '#22c55e' : '#ef4444' }}>
              {(report as any).overall_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Passed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{(report as any).passed}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Failed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{(report as any).failed}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Warnings</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{(report as any).warnings}</div>
          </div>
        </div>
      )}
      {checks.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Checks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checks.map((c: any) => (
              <div key={c.check_id} data-testid={`compliance-${c.check_id}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{c.description}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4, textTransform: 'uppercase' }}>{c.category}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    backgroundColor: `${statusColor(c.status)}22`,
                    color: statusColor(c.status),
                  }}>
                    {c.status}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{c.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
