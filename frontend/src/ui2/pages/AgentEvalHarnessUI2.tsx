import React, { useState, useCallback, useEffect } from 'react';

interface EvalCase {
  id: string;
  prompt: string;
  expected_evidence_ids: string[];
  expected_keywords: string[];
  category: string;
}

interface CaseScore {
  case_id: string;
  category: string;
  citation_recall: number;
  keyword_score: number;
  total_score: number;
  evidence_returned: string[];
  evidence_expected: string[];
  response_answer: string;
}

interface EvalRun {
  run_id: string;
  dataset_version: string;
  case_count: number;
  avg_recall: number;
  avg_keyword: number;
  avg_total: number;
  scores?: CaseScore[];
  created_at: string;
}

const API = 'http://localhost:8090/api/v3/eval';

const scoreColor = (score: number) => {
  if (score >= 0.8) return '#10B981';
  if (score >= 0.5) return '#F59E0B';
  return '#EF4444';
};

export function AgentEvalHarnessUI2() {
  const [dataset, setDataset] = useState<EvalCase[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [latestRun, setLatestRun] = useState<EvalRun | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseScore | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchDataset = useCallback(async () => {
    const r = await fetch(`${API}/dataset`);
    const data = await r.json();
    setDataset(data.cases || []);
  }, []);

  const fetchRuns = useCallback(async () => {
    const r = await fetch(`${API}/runs`);
    const data = await r.json();
    setRuns(data.runs || []);
  }, []);

  useEffect(() => {
    fetchDataset();
    fetchRuns();
  }, [fetchDataset, fetchRuns]);

  const handleRunEval = async () => {
    setError('');
    setRunning(true);
    try {
      const r = await fetch(`${API}/run`, { method: 'POST' });
      if (!r.ok) { setError('Eval run failed'); return; }
      const run: EvalRun = await r.json();
      setLatestRun(run);
      await fetchRuns();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const openCaseDetail = (cs: CaseScore) => {
    setSelectedCase(cs);
    setDrawerOpen(true);
  };

  return (
    <div
      data-testid="agent-eval-page"
      style={{ fontFamily: 'Inter, sans-serif', background: '#0F172A', minHeight: '100vh', color: '#E2E8F0', padding: '24px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Agent Eval Harness</h1>
            <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Repeatable scoring of agent output and citation correctness</p>
          </div>
          <button
            data-testid="run-eval-btn"
            onClick={handleRunEval}
            disabled={running}
            style={{ background: running ? '#334155' : '#3B82F6', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', fontSize: 14 }}
          >
            {running ? 'Running…' : 'Run Eval'}
          </button>
        </div>

        {error && <div style={{ color: '#F87171', marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Dataset table */}
          <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Eval Dataset ({dataset.length} cases)</h2>
            </div>
            <table data-testid="eval-dataset-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0F172A' }}>
                  {['ID', 'Category', 'Keywords'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.map(c => (
                  <tr key={c.id} data-testid={`eval-case-row-${c.id}`} style={{ borderTop: '1px solid #1E293B' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#93C5FD' }}>{c.id}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>{c.category}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: '#64748B' }}>{c.expected_keywords.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trend (run history) */}
          <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Run History ({runs.length})</h2>
            </div>
            {runs.length === 0 ? (
              <div data-testid="runs-empty-state" style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                No eval runs yet — click "Run Eval" to start
              </div>
            ) : (
              <table data-testid="eval-runs-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0F172A' }}>
                    {['Run', 'Recall', 'Keyword', 'Total', 'Time'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, idx) => (
                    <tr key={run.run_id} data-testid={`eval-run-row-${run.run_id}`} style={{ borderTop: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#94A3B8' }}>#{runs.length - idx}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: scoreColor(run.avg_recall) }}>{(run.avg_recall * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: scoreColor(run.avg_keyword) }}>{(run.avg_keyword * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: scoreColor(run.avg_total) }}>{(run.avg_total * 100).toFixed(0)}%</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: '#475569' }}>{new Date(run.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Latest run score breakdown */}
        {latestRun?.scores && (
          <div style={{ marginTop: 16, background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Latest Run — Case Scores</h2>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span>Recall: <strong style={{ color: scoreColor(latestRun.avg_recall) }}>{(latestRun.avg_recall * 100).toFixed(0)}%</strong></span>
                <span>Keyword: <strong style={{ color: scoreColor(latestRun.avg_keyword) }}>{(latestRun.avg_keyword * 100).toFixed(0)}%</strong></span>
                <span>Total: <strong style={{ color: scoreColor(latestRun.avg_total) }}>{(latestRun.avg_total * 100).toFixed(0)}%</strong></span>
              </div>
            </div>
            <table data-testid="eval-scores-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0F172A' }}>
                  {['Case', 'Category', 'Recall', 'Keyword', 'Total', ''].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestRun.scores.map(cs => (
                  <tr key={cs.case_id} data-testid={`score-row-${cs.case_id}`} style={{ borderTop: '1px solid #1E293B' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: '#93C5FD' }}>{cs.case_id}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}>{cs.category}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: scoreColor(cs.citation_recall) }}>{(cs.citation_recall * 100).toFixed(0)}%</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: scoreColor(cs.keyword_score) }}>{(cs.keyword_score * 100).toFixed(0)}%</td>
                    <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: scoreColor(cs.total_score) }}>{(cs.total_score * 100).toFixed(0)}%</td>
                    <td style={{ padding: '8px 14px' }}>
                      <button
                        data-testid={`inspect-case-btn-${cs.case_id}`}
                        onClick={() => openCaseDetail(cs)}
                        style={{ background: '#1E3A5F', color: '#93C5FD', border: '1px solid #1D4ED8', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case detail drawer */}
      {drawerOpen && selectedCase && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div
            data-testid="case-detail-drawer"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
              background: '#1E293B', borderLeft: '1px solid #334155', zIndex: 50, padding: 24, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Case Detail</h2>
              <button
                data-testid="drawer-close-btn"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer' }}
              >×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Case ID</div>
              <div style={{ fontWeight: 600, color: '#93C5FD' }}>{selectedCase.case_id}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Citation Recall', val: selectedCase.citation_recall },
                { label: 'Keyword Score', val: selectedCase.keyword_score },
                { label: 'Total Score', val: selectedCase.total_score },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: '#0F172A', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(val) }}>{(val * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Agent Answer</div>
              <div data-testid="drawer-answer" style={{ fontSize: 12, color: '#E2E8F0', background: '#0F172A', borderRadius: 8, padding: 10, lineHeight: 1.6 }}>
                {selectedCase.response_answer}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Evidence Returned</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedCase.evidence_returned.map(e => (
                  <span key={e} style={{ fontSize: 11, background: '#1E3A5F', color: '#93C5FD', padding: '3px 8px', borderRadius: 8 }}>{e}</span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Expected Evidence</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedCase.evidence_expected.map(e => (
                  <span key={e} style={{ fontSize: 11, background: '#14532D', color: '#86EFAC', padding: '3px 8px', borderRadius: 8 }}>{e}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
