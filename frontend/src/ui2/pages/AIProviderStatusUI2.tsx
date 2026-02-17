/**
 * AI Provider Status UI2 — Wave 17 v1.149-v1.154
 * LLM provider status dashboard: provider, budget, cache, rate limiting, replay log.
 */
import { useSyncExternalStore, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { llmProviderStore } from '../stores/llmProviderStore';

function useProviderState() {
  return useSyncExternalStore(llmProviderStore.subscribe, llmProviderStore.getState);
}

export function AIProviderStatusUI2() {
  const { status, replayLog } = useProviderState();

  useEffect(() => {
    llmProviderStore.fetchStatus();
    llmProviderStore.fetchReplay();
  }, []);

  if (!status) return <div data-testid="ui2-ai-provider-page" data-ready="false">Loading...</div>;

  const budget = status.budget;
  const rate = status.rate_limit;
  const cache = status.cache;

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="ui2-ai-provider-page" data-ready="true">
      <PageHeader
        title="AI Provider Status"
        subtitle={`Provider: ${status.active_provider} · Nova: ${status.nova_enabled ? 'ON' : 'OFF'}`}
        testId="ui2-ai-provider-header"
      />

      <div className="p-4 space-y-4">
        {/* Provider Info */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-ai-provider-info">
          <h3 className="text-sm font-semibold text-neutral-100 mb-3">Provider</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-neutral-500">Active Provider</div>
              <div className="text-sm font-mono text-neutral-200" data-testid="ui2-ai-provider-active">{status.active_provider}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Nova Enabled</div>
              <div className={`text-sm font-semibold ${status.nova_enabled ? 'text-green-400' : 'text-neutral-500'}`} data-testid="ui2-ai-provider-nova">
                {status.nova_enabled ? 'YES' : 'NO'}
              </div>
            </div>
          </div>
          {status.guard_reasons.length > 0 && (
            <div className="mt-3" data-testid="ui2-ai-provider-guards">
              <div className="text-xs text-neutral-500 mb-1">Guard Reasons (Nova blocked because):</div>
              {status.guard_reasons.map((reason, i) => (
                <div key={i} className="text-xs text-yellow-400 font-mono">• {reason}</div>
              ))}
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-ai-budget-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-100">Budget</h3>
            <button
              data-testid="ui2-ai-budget-reset-btn"
              onClick={() => llmProviderStore.resetBudget()}
              className="text-xs text-blue-400 hover:text-blue-300"
            >Reset</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-neutral-500">Remaining</div>
              <div className={`text-lg font-mono font-bold ${budget.remaining > 20 ? 'text-green-400' : budget.remaining > 5 ? 'text-yellow-400' : 'text-red-400'}`} data-testid="ui2-ai-budget-remaining">
                {budget.remaining}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Used / Hour</div>
              <div className="text-sm font-mono text-neutral-200">{budget.calls_this_hour} / {budget.max_per_hour}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Total Calls</div>
              <div className="text-sm font-mono text-neutral-200" data-testid="ui2-ai-budget-total">{budget.total_calls}</div>
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${budget.remaining > 20 ? 'bg-green-500' : budget.remaining > 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.round((budget.remaining / budget.max_per_hour) * 100)}%` }}
                data-testid="ui2-ai-budget-bar"
              />
            </div>
          </div>
        </div>

        {/* Cache + Rate */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cache */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-ai-cache-panel">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-100">Cache</h3>
              <button
                data-testid="ui2-ai-cache-clear-btn"
                onClick={() => llmProviderStore.clearCache()}
                className="text-xs text-blue-400 hover:text-blue-300"
              >Clear</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-500">Entries</div>
                <div className="text-sm font-mono text-neutral-200" data-testid="ui2-ai-cache-entries">{cache.entries}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Hit Rate</div>
                <div className="text-sm font-mono text-green-400" data-testid="ui2-ai-cache-hit-rate">{(cache.hit_rate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Hits</div>
                <div className="text-sm font-mono text-neutral-200">{cache.hits}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Misses</div>
                <div className="text-sm font-mono text-neutral-200">{cache.misses}</div>
              </div>
            </div>
          </div>

          {/* Rate Limit */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-ai-rate-panel">
            <h3 className="text-sm font-semibold text-neutral-100 mb-3">Rate Limit</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-500">Remaining</div>
                <div className={`text-sm font-mono ${rate.remaining > 10 ? 'text-green-400' : 'text-yellow-400'}`} data-testid="ui2-ai-rate-remaining">
                  {rate.remaining}/{rate.limit_per_minute}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Window</div>
                <div className="text-sm font-mono text-neutral-200">{rate.window_size} calls</div>
              </div>
            </div>
          </div>
        </div>

        {/* Replay Log */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-ai-replay-panel">
          <h3 className="text-sm font-semibold text-neutral-100 mb-3">Replay Log ({replayLog.length} entries)</h3>
          {replayLog.length === 0 ? (
            <div className="text-sm text-neutral-500">No replay entries</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {replayLog.map((entry, i) => (
                <div key={`${entry.prompt_hash}-${i}`} className="bg-neutral-950 border border-neutral-800 rounded p-2" data-testid={`ui2-ai-replay-entry-${i}`}>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span className="font-mono">{entry.prompt_hash.slice(0, 12)}...</span>
                    <span className="px-1.5 py-0.5 bg-neutral-800 rounded">{entry.provider}</span>
                  </div>
                  <div className="text-xs text-neutral-300 truncate">{entry.prompt}</div>
                  <div className="text-xs text-neutral-500 truncate mt-0.5">{entry.response_summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
