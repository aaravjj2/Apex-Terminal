/**
 * Decision Explorer UI2 — v1.130 + v1.137 (Portfolio Impact)
 * Autopilot decision history with explanation, risk evaluation, and portfolio impact.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { BrainCircuit, CheckCircle, XCircle, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { wave1314Store, type AutopilotDecision } from '../stores/wave1314Store';

const STATUS_ICONS_MAP: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="w-4 h-4 text-green-400" />,
  rejected: <XCircle className="w-4 h-4 text-red-400" />,
  pending: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
};

export function DecisionExplorerUI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const decisions = wave1314Store.getDecisions();
  const [selected, setSelected] = useState<AutopilotDecision | null>(null);

  return (
    <div className="flex flex-col h-full" data-testid="ui2-decision-explorer-page" data-ready="true">
      <PageHeader
        title="Decision Explorer"
        subtitle={`${decisions.length} autopilot decisions`}
        testId="ui2-decision-explorer-header"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-2" data-testid="ui2-decision-list">
          {decisions.length === 0 && (
            <div className="text-center text-neutral-500 py-12" data-testid="ui2-decision-list-empty">No decisions recorded</div>
          )}
          {decisions.map((dec) => (
            <button
              key={dec.decision_id}
              onClick={() => setSelected(dec)}
              className={`w-full text-left bg-neutral-900 border rounded-lg px-4 py-3 flex items-center gap-3 transition-colors ${
                selected?.decision_id === dec.decision_id ? 'border-blue-500' : 'border-neutral-800 hover:border-neutral-700'
              }`}
              data-testid={`ui2-decision-row-${dec.decision_id}`}
            >
              <div className="flex-shrink-0">{STATUS_ICONS_MAP[dec.status] || STATUS_ICONS_MAP.pending}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-100">{dec.symbol} — {dec.action}</div>
                <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                  <span className="font-mono">{dec.decision_id}</span>
                  <span className={dec.status === 'approved' ? 'text-green-400' : dec.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}>{dec.status}</span>
                  <span>conf: {(dec.confidence * 100).toFixed(0)}%</span>
                  <span>{new Date(dec.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[420px] border-l border-neutral-800 overflow-auto p-4 bg-neutral-950" data-testid="ui2-decision-detail">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-neutral-100">Decision Detail</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-300 text-sm" data-testid="de-close-btn">Close</button>
            </div>

            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Symbol</div>
                  <div className="text-sm font-semibold text-neutral-100" data-testid="ui2-decision-detail-symbol">{selected.symbol}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Action</div>
                  <div className="text-sm text-neutral-200">{selected.action}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Status</div>
                  <div className="flex items-center gap-1.5">{STATUS_ICONS_MAP[selected.status]} <span className="text-sm text-neutral-200">{selected.status}</span></div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Confidence</div>
                  <div className="text-sm text-neutral-200">{(selected.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-xs text-neutral-500 mb-2">Features</div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2" data-testid="ui2-decision-detail-features">
                  {Object.entries(selected.features).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-neutral-400">{k}</span>
                      <span className="font-mono text-neutral-200">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Evaluation */}
              <div>
                <div className="text-xs text-neutral-500 mb-2">Risk Evaluation</div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2" data-testid="ui2-decision-detail-risk">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Risk Score</span>
                    <span className={`font-mono font-semibold ${selected.risk_score > 0.7 ? 'text-red-400' : selected.risk_score > 0.4 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {selected.risk_score.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Max Profit</span>
                    <span className="font-mono text-green-400">${selected.risk_evaluation.max_profit}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Max Loss</span>
                    <span className="font-mono text-red-400">${selected.risk_evaluation.max_loss}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">VaR 95%</span>
                    <span className="font-mono text-neutral-200">${selected.risk_evaluation.var_95}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Position Size</span>
                    <span className="font-mono text-neutral-200">{selected.risk_evaluation.position_size}</span>
                  </div>
                </div>
              </div>

              {/* v1.137 Portfolio Impact */}
              {selected.portfolio_impact && (
                <div>
                  <div className="flex items-center gap-1 text-xs text-neutral-500 mb-2"><TrendingUp className="w-3 h-3" /> Portfolio Impact</div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2" data-testid="ui2-decision-detail-portfolio-impact">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Old Weight</span>
                      <span className="font-mono text-neutral-200">{(selected.portfolio_impact.old_weight * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">New Weight</span>
                      <span className="font-mono text-neutral-200">{(selected.portfolio_impact.new_weight * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Concentration Warning</span>
                      <span className={selected.portfolio_impact.concentration_warning ? 'text-yellow-400 font-semibold' : 'text-green-400'}>
                        {selected.portfolio_impact.concentration_warning ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div>
                <div className="text-xs text-neutral-500 mb-2">Explanation</div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300" data-testid="ui2-decision-detail-explanation">
                  {selected.explanation}
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-xs text-neutral-500">
                {new Date(selected.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
