/**
 * v1.47 — Risk Scenarios Panel
 * DEMO-first stress test / what-if scenario viewer.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface Scenario {
  id: string;
  name: string;
  description: string;
  shock: Record<string, number>;
  portfolio_impact: number;
  max_drawdown: number;
  recovery_days: number;
  status: string;
}

export function RiskScenariosPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/risk-scenarios`)
      .then(r => r.json())
      .then(data => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="risk-scenarios-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Risk Scenarios</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.47 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="risk-scenarios-loading" className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && scenarios.length === 0 && (
        <div data-testid="risk-scenarios-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No scenarios available</p>
        </div>
      )}

      {!loading && scenarios.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {scenarios.map((s, idx) => (
            <div
              key={s.id}
              data-testid={`scenario-card-${idx}`}
              className="p-4 rounded-lg border border-border/50 bg-element-bg/20 cursor-pointer hover:border-border transition-colors"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text">{s.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-text-secondary mb-2">{s.description}</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-text-muted">Impact</div>
                  <div className="text-sm font-mono text-red-400">${Math.abs(s.portfolio_impact).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Max Drawdown</div>
                  <div className="text-sm font-mono text-yellow-400">{(s.max_drawdown * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Recovery</div>
                  <div className="text-sm font-mono text-text">{s.recovery_days}d</div>
                </div>
              </div>

              {expanded === s.id && (
                <div data-testid={`scenario-shock-${idx}`} className="mt-3 pt-3 border-t border-border/30">
                  <div className="text-[10px] text-text-muted mb-1">Shock Parameters</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(s.shock).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-element-bg font-mono">
                        {k}: {v > 0 ? '+' : ''}{(v * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div data-testid="risk-scenarios-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
