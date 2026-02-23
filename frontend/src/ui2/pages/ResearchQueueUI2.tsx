import { useSyncExternalStore, useEffect } from 'react';
import { strategyV2Store } from '../stores/waves21_50Store';

function useStrategyV2() {
  return useSyncExternalStore(strategyV2Store.subscribe, strategyV2Store.getState);
}

export function ResearchQueueUI2() {
  const { jobs, loading, error } = useStrategyV2();

  useEffect(() => { strategyV2Store.fetchJobs(); }, []);

  const handleSubmit = () => {
    strategyV2Store.submitJob({ symbols: ['AAPL'], initial_capital: 100000 });
  };

  return (
    <div data-testid="research-queue-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Research Queue — Waves 44-45</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <button data-testid="rq-submit-btn" onClick={handleSubmit} disabled={loading} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Submit Job</button>
        <button data-testid="rq-refresh-btn" onClick={() => strategyV2Store.fetchJobs()} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
        <span data-testid="rq-count" style={{ color: '#94a3b8' }}>{jobs.length} jobs</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {jobs.map((job: any) => (
          <div key={job.job_id} data-testid="rq-job-row" style={{ background: '#1e293b', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{job.job_id}</span>
              <span style={{ color: '#94a3b8', marginLeft: 12, fontSize: 13 }}>{job.status}</span>
            </div>
            {job.status === 'pending' && (
              <button onClick={() => strategyV2Store.cancelJob(job.job_id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }} data-testid={`rq-cancel-${job.job_id}`}>Cancel</button>
            )}
          </div>
        ))}
        {jobs.length === 0 && <p style={{ color: '#64748b' }}>No jobs in queue.</p>}
      </div>
    </div>
  );
}
