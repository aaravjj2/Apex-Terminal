import { useSyncExternalStore, useEffect } from 'react';
import { scoringStore } from '../stores/waveStores';
import type { ScoreResult } from '../stores/waveStores';

function useScoring() {
  return useSyncExternalStore(scoringStore.subscribe, scoringStore.getState);
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#84cc16';
    case 'C': return '#f59e0b';
    case 'D': return '#f97316';
    default: return '#ef4444';
  }
}

export function ScoringUI2() {
  const { scores, loading, error } = useScoring();

  useEffect(() => {
    scoringStore.fetchDemo();
  }, []);

  return (
    <div data-testid="scoring-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Entry Scoring</h1>
      {loading && <p>Loading scores...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {scores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {scores.map((s: ScoreResult) => (
            <div key={`${s.symbol}-${s.strategy}`} data-testid={`score-card-${s.symbol}`} style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${gradeColor(s.grade)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{s.symbol}</div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>{s.strategy}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: gradeColor(s.grade) }}>{s.grade}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#94a3b8' }}>Total Score</span>
                <span style={{ fontWeight: 600 }}>{s.total_score}/100</span>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{s.recommendation}</div>
              {s.breakdown && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
                  {Object.entries(s.breakdown).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ color: '#64748b' }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
