import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Job {
  id: string;
  name: string;
  job_type: string;
  status: string;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  result?: string;
  error_msg?: string;
  params?: Record<string, unknown>;
}

const API = '/api/v3/jobs';
const JOB_TYPES = ['backtest', 'search_index', 'data_export', 'report_gen', 'model_train'];

const STATUS_COLORS: Record<string, string> = {
  queued: '#6B7280',
  running: '#2563EB',
  succeeded: '#16A34A',
  failed: '#DC2626',
  canceled: '#9CA3AF',
};

export function JobQueueV2UI2() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [_pageReady, _setPageReady] = useState(false);
  const [jobName, setJobName] = useState('');
  const [jobType, setJobType] = useState('backtest');
  const [submitError, setSubmitError] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/jobs`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchJobs();
    _setPageReady(true);
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleSubmit = async () => {
    setSubmitError('');
    if (!jobName.trim()) {
      setSubmitError('Job name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: jobName.trim(), job_type: jobType, auto_run: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.detail || 'Submit failed');
      } else {
        setJobName('');
        await fetchJobs();
      }
    } catch (e: unknown) {
      setSubmitError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${API}/jobs/${jobId}/cancel`, { method: 'POST' });
    await fetchJobs();
    if (selectedJob?.id === jobId) {
      const updated = await fetch(`${API}/jobs/${jobId}`).then(r => r.json());
      setSelectedJob(updated);
    }
  };

  const openDrawer = async (job: Job) => {
    const detail = await fetch(`${API}/jobs/${job.id}`).then(r => r.json());
    setSelectedJob(detail);
    setDrawerOpen(true);

    // Connect WS for live progress
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (!['succeeded', 'failed', 'canceled'].includes(detail.status)) {
      const _wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${_wsProto}//${window.location.host}/api/v3/jobs/ws/jobs/${job.id}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = async (msg) => {
        const payload = JSON.parse(msg.data);
        setSelectedJob(prev => prev?.id === job.id ? { ...prev, ...payload } : prev);
        if (['succeeded', 'failed', 'canceled'].includes(payload.status)) {
          ws.close();
          await fetchJobs();
        }
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const progressColor = (p: number) => {
    if (p < 33) return '#EF4444';
    if (p < 66) return '#F59E0B';
    return '#10B981';
  };

  return (
    <>
    {!_pageReady && <div data-testid="page-loading" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    {_pageReady && <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    <div
      data-testid="job-queue-page"
      style={{ fontFamily: 'Inter, sans-serif', background: '#0F172A', minHeight: '100vh', color: '#E2E8F0', padding: '24px' }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>
          Job Queue v2
        </h1>
        <p style={{ color: '#94A3B8', marginBottom: 24 }}>
          Submit, monitor, and cancel background jobs with live progress
        </p>

        {/* Submit form */}
        <div style={{ background: '#1E293B', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #334155' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Submit Job</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Job Name</label>
              <input
                data-testid="job-name-input"
                value={jobName}
                onChange={e => setJobName(e.target.value)}
                placeholder="e.g. My Backtest Run"
                style={{ width: '100%', background: '#0F172A', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px', color: '#F8FAFC', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Job Type</label>
              <select
                data-testid="job-type-select"
                value={jobType}
                onChange={e => setJobType(e.target.value)}
                style={{ width: '100%', background: '#0F172A', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px', color: '#F8FAFC', fontSize: 14 }}
              >
                {JOB_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button
              data-testid="submit-job-btn"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: loading ? '#475569' : '#3B82F6', color: '#FFF',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Submitting…' : 'Submit Job'}
            </button>
          </div>
          {submitError && (
            <div style={{ marginTop: 10, color: '#F87171', fontSize: 13 }}>{submitError}</div>
          )}
        </div>

        {/* Jobs table */}
        <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Jobs ({jobs.length})</h2>
            <button
              onClick={fetchJobs}
              style={{ background: 'transparent', border: '1px solid #475569', color: '#94A3B8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
            >
              Refresh
            </button>
          </div>

          {jobs.length === 0 ? (
            <div
              data-testid="jobs-empty-state"
              style={{ padding: 48, textAlign: 'center', color: '#64748B' }}
            >
              No jobs submitted yet
            </div>
          ) : (
            <table
              data-testid="jobs-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr style={{ background: '#0F172A' }}>
                  {['Name', 'Type', 'Status', 'Progress', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#64748B', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr
                    key={job.id}
                    data-testid={`job-row-${job.id}`}
                    onClick={() => openDrawer(job)}
                    style={{ borderTop: '1px solid #1E293B', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1E3A5F')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14 }}>{job.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>{job.job_type}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        data-testid={`job-status-badge-${job.id}`}
                        style={{
                          background: STATUS_COLORS[job.status] + '22',
                          color: STATUS_COLORS[job.status],
                          border: `1px solid ${STATUS_COLORS[job.status]}55`,
                          borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${job.progress}%`, height: '100%', background: progressColor(job.progress), transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>{Math.round(job.progress)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>
                      {job.created_at ? new Date(job.created_at).toLocaleTimeString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      {['queued', 'running'].includes(job.status) && (
                        <button
                          data-testid={`cancel-job-btn-${job.id}`}
                          onClick={e => handleCancel(job.id, e)}
                          style={{
                            background: '#7F1D1D', color: '#FCA5A5', border: '1px solid #991B1B',
                            borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Job Detail Drawer */}
      {drawerOpen && selectedJob && (
        <>
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
          <div
            data-testid="job-detail-drawer"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
              background: '#1E293B', borderLeft: '1px solid #334155', zIndex: 50,
              padding: 24, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Job Detail</h2>
              <button
                data-testid="job-drawer-close"
                onClick={closeDrawer}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>Status</span>
              <div style={{ marginTop: 4 }}>
                <span
                  data-testid="job-drawer-status"
                  style={{
                    background: STATUS_COLORS[selectedJob.status] + '22',
                    color: STATUS_COLORS[selectedJob.status],
                    border: `1px solid ${STATUS_COLORS[selectedJob.status]}55`,
                    borderRadius: 20, padding: '4px 14px', fontSize: 14, fontWeight: 600,
                  }}
                >
                  {selectedJob.status}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>Progress</span>
              <div data-testid="job-drawer-progress" style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{Math.round(selectedJob.progress)}%</span>
                </div>
                <div style={{ height: 8, background: '#0F172A', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${selectedJob.progress}%`, height: '100%',
                    background: progressColor(selectedJob.progress), transition: 'width 0.4s',
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            </div>

            {[
              { label: 'ID', value: selectedJob.id },
              { label: 'Name', value: selectedJob.name },
              { label: 'Type', value: selectedJob.job_type },
              { label: 'Created', value: selectedJob.created_at },
              { label: 'Started', value: selectedJob.started_at || '—' },
              { label: 'Completed', value: selectedJob.completed_at || '—' },
              { label: 'Canceled', value: selectedJob.canceled_at || '—' },
              { label: 'Result', value: selectedJob.result || '—' },
              { label: 'Error', value: selectedJob.error_msg || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#E2E8F0', wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}

            {['queued', 'running'].includes(selectedJob.status) && (
              <button
                data-testid={`cancel-job-btn-${selectedJob.id}`}
                onClick={async () => {
                  await handleCancel(selectedJob.id, { stopPropagation: () => {} } as React.MouseEvent);
                  const updated = await fetch(`${API}/jobs/${selectedJob.id}`).then(r => r.json());
                  setSelectedJob(updated);
                }}
                style={{
                  marginTop: 12, width: '100%', background: '#7F1D1D', color: '#FCA5A5',
                  border: '1px solid #991B1B', borderRadius: 8, padding: '10px', fontSize: 14,
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                Cancel Job
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
}
