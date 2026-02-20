/**
 * Decision Explainer V2 — Wave 18 v1.155-v1.158
 * Enhanced decision detail with feature attribution bars,
 * confidence breakdown, and post-trade evaluation.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { CheckCircle, XCircle, AlertTriangle, ChevronRight, BarChart3, Target } from 'lucide-react';
import { wave18Store } from '../stores/wave18Store';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="w-4 h-4 text-green-400" />,
  rejected: <XCircle className="w-4 h-4 text-red-400" />,
  pending: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
};

const DIR_COLORS: Record<string, string> = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-neutral-400',
  weak_positive: 'text-yellow-400',
};

function useWave18() {
  return useSyncExternalStore(wave18Store.subscribe, wave18Store.getState);
}

export function DecisionExplainerV2UI2() {
  const state = useWave18();
  const sorted = wave18Store.getDecisions();
  const selectedDecision = state.selectedDecision;  const [detailTab, setDetailTab] = useState<'attribution' | 'confidence' | 'post-trade'>('attribution');

  return (
    <div className="flex flex-col h-full" data-testid="ui2-decision-explainer-v2-page" data-ready="true">
      <PageHeader
        title="Decision Explainer"
        subtitle={`${sorted.length} decisions · feature attribution · confidence scoring`}
        testId="ui2-decision-explainer-v2-header"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Decision list */}
        <div className="flex-1 overflow-auto p-4 space-y-2" data-testid="ui2-decision-v2-list">
          {sorted.map(dec => (
            <button
              key={dec.decision_id}
              onClick={() => wave18Store.selectDecision(dec.decision_id)}
              className={`w-full text-left bg-neutral-900 border rounded-lg px-4 py-3 flex items-center gap-3 transition-colors ${
                selectedDecision?.decision_id === dec.decision_id ? 'border-blue-500' : 'border-neutral-800 hover:border-neutral-700'
              }`}
              data-testid={`ui2-dec-v2-row-${dec.decision_id}`}
            >
              <div className="flex-shrink-0">{STATUS_ICONS[dec.status] || STATUS_ICONS.pending}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-100">{dec.symbol} — {dec.action}</div>
                <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                  <span className={dec.status === 'approved' ? 'text-green-400' : dec.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}>{dec.status}</span>
                  <span>conf: {(dec.confidence * 100).toFixed(0)}%</span>
                  <span>risk: {dec.risk_score.toFixed(2)}</span>
                  {dec.post_trade_eval && <span className="text-blue-400">P&L: ${dec.post_trade_eval.actual_pnl.toFixed(0)}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selectedDecision && (
          <div className="w-[480px] border-l border-neutral-800 overflow-auto p-4 bg-neutral-950" data-testid="ui2-decision-v2-detail">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-neutral-100">{selectedDecision.symbol} — {selectedDecision.action}</h3>
              </div>
              <button onClick={() => wave18Store.selectDecision(null)} className="text-neutral-500 hover:text-neutral-300 text-sm">Close</button>
            </div>

            {/* Summary grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <div className="text-xs text-neutral-500">Status</div>
                <div className="flex items-center gap-1">{STATUS_ICONS[selectedDecision.status]} <span className="text-sm">{selectedDecision.status}</span></div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Confidence</div>
                <div className="text-sm font-mono font-bold text-neutral-200" data-testid="ui2-dec-v2-confidence">{(selectedDecision.confidence * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Risk Score</div>
                <div className={`text-sm font-mono font-bold ${selectedDecision.risk_score > 0.5 ? 'text-red-400' : 'text-green-400'}`}>{selectedDecision.risk_score.toFixed(2)}</div>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-4 text-sm text-neutral-300" data-testid="ui2-dec-v2-explanation">
              {selectedDecision.explanation}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-800 mb-4">
              {(['attribution', 'confidence', 'post-trade'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    detailTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                  data-testid={`ui2-dec-v2-tab-${t}`}
                >
                  {t === 'attribution' ? 'Feature Attribution' : t === 'confidence' ? 'Confidence' : 'Post-Trade'}
                </button>
              ))}
            </div>

            {/* Attribution tab */}
            {detailTab === 'attribution' && (
              <div className="space-y-3" data-testid="ui2-dec-v2-attribution-panel">
                {Object.entries(selectedDecision.feature_attribution).map(([key, attr]) => (
                  <div key={key} className="bg-neutral-900 border border-neutral-800 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-neutral-300 font-medium">{key}</span>
                      <span className={`text-xs font-mono ${DIR_COLORS[attr.direction] || 'text-neutral-400'}`}>{attr.direction}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${attr.contribution > 0 ? 'bg-green-500' : attr.contribution < 0 ? 'bg-red-500' : 'bg-neutral-600'}`}
                          style={{ width: `${Math.min(Math.abs(attr.contribution) * 300, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-neutral-400 w-16 text-right">
                        {attr.contribution > 0 ? '+' : ''}{attr.contribution.toFixed(3)}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">weight: {attr.weight.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Confidence tab */}
            {detailTab === 'confidence' && (
              <div className="space-y-3" data-testid="ui2-dec-v2-confidence-panel">
                {Object.entries(selectedDecision.confidence_breakdown).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center bg-neutral-900 border border-neutral-800 rounded p-3">
                    <span className="text-xs text-neutral-300">{key.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-800 rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${val * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-neutral-200 w-12 text-right">{(val * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Post-trade tab */}
            {detailTab === 'post-trade' && (
              <div data-testid="ui2-dec-v2-post-trade-panel">
                {selectedDecision.post_trade_eval ? (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-neutral-500">Actual P&L</div>
                        <div className={`text-lg font-mono font-bold ${selectedDecision.post_trade_eval.actual_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="ui2-dec-v2-actual-pnl">
                          ${selectedDecision.post_trade_eval.actual_pnl.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500">Accuracy</div>
                        <div className="text-lg font-mono font-bold text-blue-400" data-testid="ui2-dec-v2-accuracy">
                          {(selectedDecision.post_trade_eval.accuracy * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500">Time Held</div>
                        <div className="text-sm font-mono text-neutral-200">{selectedDecision.post_trade_eval.time_held}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500">Exit Reason</div>
                        <div className="text-sm text-neutral-200">{selectedDecision.post_trade_eval.exit_reason}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500" data-testid="ui2-dec-v2-no-post-trade">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div className="text-sm">No post-trade evaluation</div>
                    <div className="text-xs mt-1">Decision was rejected or trade not yet closed</div>
                  </div>
                )}
              </div>
            )}

            {/* Risk eval */}
            <div className="mt-4 bg-neutral-900 border border-neutral-800 rounded-lg p-3" data-testid="ui2-dec-v2-risk-eval">
              <div className="text-xs text-neutral-500 mb-2">Risk Evaluation</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-neutral-400">Max Profit</span><span className="font-mono text-green-400">${selectedDecision.risk_evaluation.max_profit}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Max Loss</span><span className="font-mono text-red-400">${selectedDecision.risk_evaluation.max_loss}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">VaR 95%</span><span className="font-mono text-neutral-200">${selectedDecision.risk_evaluation.var_95}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Position</span><span className="font-mono text-neutral-200">{selectedDecision.risk_evaluation.position_size}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
