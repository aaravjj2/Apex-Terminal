/**
 * Strategy Lab Panel - Main component with subtabs
 * v1.28: Artifacts panel + create/store flow
 * v1.29: Validation panel with deterministic ordering
 * v1.30: Diff viewer + Version lineage
 */

import { useState } from 'react';
import type { StrategyLabTab, StrategyDefinition } from './types';
import type { StrategyArtifact } from './artifactTypes';
import { StrategyArtifactsPanel } from './StrategyArtifactsPanel';
import { StrategyValidationPanel } from './StrategyValidationPanel';
import { StrategyDiffPanel } from './StrategyDiffPanel';

type ExtendedTab = StrategyLabTab | 'artifacts' | 'diff';


const DEMO_STRATEGIES: StrategyDefinition[] = [
  { 
    id: 'demo-sma', 
    name: 'SMA Crossover 20/50', 
    description: 'Simple moving average crossover strategy', 
    strategy_type: 'crossover', 
    indicators: [
      { type: 'SMA', params: { period: 20 } },
      { type: 'SMA', params: { period: 50 } }
    ], 
    tags: ['trend','moving-average'] 
  },
  { 
    id: 'demo-rsi', 
    name: 'RSI Mean Reversion', 
    description: 'RSI-based mean reversion strategy', 
    strategy_type: 'mean_reversion', 
    indicators: [
      { type: 'RSI', params: { period: 14 } }
    ], 
    tags: ['oscillator','mean-reversion'] 
  },
];

export function StrategyLabPanel() {
  const [activeTab, setActiveTab] = useState<ExtendedTab>('builder');
  const [strategies, setStrategies] = useState<StrategyDefinition[]>(DEMO_STRATEGIES);
  const [currentStrategy, setCurrentStrategy] = useState<StrategyDefinition>({
    name: '',
    description: '',
    strategy_type: 'crossover',
    indicators: [],
    tags: []
  });
  const [validateJson, setValidateJson] = useState('');
  const [validateResult, setValidateResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [artifactCreateResult, setArtifactCreateResult] = useState<{ id: string } | null>(null);
  const [diffArtifacts, setDiffArtifacts] = useState<StrategyArtifact[]>([]);

  const tabs = [
    { id: 'builder' as const, label: 'Builder' },
    { id: 'library' as const, label: 'Library' },
    { id: 'artifacts' as const, label: 'Artifacts' },
    { id: 'diff' as const, label: 'Diff' },
    { id: 'validate' as const, label: 'Validate' }
  ];

  const handleSave = async () => {
    try {
      const res = await fetch('/api/strategy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentStrategy)
      });
      const data = await res.json();
      if (data.strategy) {
        alert(`Strategy saved: ${data.strategy.id}`);
        loadStrategies();
      }
    } catch (e) {
      console.error('Failed to save strategy:', e);
    }
  };

  const loadStrategies = async () => {
    try {
      const res = await fetch('/api/v1/strategies');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setStrategies(list.length > 0 ? list : DEMO_STRATEGIES);
    } catch (e) {
      console.error('Failed to load strategies (using demo data):', e);
      setStrategies(DEMO_STRATEGIES);
    }
  };

  const handleValidate = async () => {
    try {
      const res = await fetch('/api/strategy/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentStrategy)
      });
      const data = await res.json();
      alert(data.valid ? 'Strategy is valid!' : `Errors: ${data.errors.length}`);
    } catch (e) {
      console.error('Failed to validate:', e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="strategy-lab-panel">
      {/* Header with subtabs */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel-bg">
        <h2 className="text-lg font-semibold text-text" data-testid="strategy-lab-heading">Strategy Lab</h2>
        
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'library') loadStrategies();
              }}
              data-testid={`strategy-lab-tab-${tab.id}`}
              data-strategy-tab={tab.id}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand text-white'
                  : 'bg-element-bg text-text-secondary hover:text-text'
              }`}
            >
              <span data-testid={`strategy-tab-${tab.id}`}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'builder' && (
          <div className="max-w-4xl mx-auto space-y-4" data-testid="strategy-builder-ready">
            <div className="bg-panel-bg border border-border rounded p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Strategy Name</label>
                <input
                  type="text"
                  value={currentStrategy.name}
                  onChange={(e) => setCurrentStrategy({...currentStrategy, name: e.target.value})}
                  placeholder="e.g., SMA Crossover 20/50"
                  data-testid="strategy-name-input"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Strategy Type</label>
                <select
                  value={currentStrategy.strategy_type}
                  onChange={(e) => setCurrentStrategy({...currentStrategy, strategy_type: e.target.value as any})}
                  data-testid="strategy-type-select"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                >
                  <option value="crossover">Crossover</option>
                  <option value="signal">Signal</option>
                  <option value="mean_reversion">Mean Reversion</option>
                  <option value="breakout">Breakout</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Description</label>
                <textarea
                  value={currentStrategy.description || ''}
                  onChange={(e) => setCurrentStrategy({...currentStrategy, description: e.target.value})}
                  rows={3}
                  data-testid="strategy-description-input"
                  className="w-full px-3 py-2 bg-element-bg border border-border rounded text-text"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  data-testid="save-strategy-btn"
                  className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded font-medium"
                >
                  Save Strategy
                </button>
                <button
                  onClick={async () => {
                    try {
                      const spec = {
                        indicators: currentStrategy.indicators || [],
                        entry: currentStrategy.entry_condition ? { condition: currentStrategy.entry_condition.condition_type, indicator: currentStrategy.entry_condition.indicator } : undefined,
                        exit: currentStrategy.exit_condition ? { condition: currentStrategy.exit_condition.condition_type, indicator: currentStrategy.exit_condition.indicator } : undefined,
                        stop_loss_pct: currentStrategy.stop_loss_pct,
                        take_profit_pct: currentStrategy.take_profit_pct,
                      };
                      const res = await fetch('/api/v1/strategy-artifacts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: currentStrategy.name || 'Untitled',
                          type: currentStrategy.strategy_type || 'crossover',
                          spec,
                        }),
                      });
                      const data = await res.json();
                      if (data.id) {
                        setArtifactCreateResult({ id: data.id });
                      }
                    } catch (e) {
                      console.error('Failed to create artifact:', e);
                    }
                  }}
                  data-testid="strategy-artifact-create"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                >
                  Create Artifact
                </button>
                <button
                  onClick={handleValidate}
                  data-testid="validate-strategy-btn"
                  className="px-4 py-2 bg-element-bg hover:bg-border text-text rounded font-medium"
                >
                  Validate
                </button>
              </div>

              {/* Artifact creation result */}
              {artifactCreateResult && (
                <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded" data-testid="strategy-artifact-create-success">
                  <span className="text-xs text-green-400">Artifact created: </span>
                  <span className="text-xs font-mono text-green-300" data-testid="strategy-artifact-id-display">{artifactCreateResult.id}</span>
                </div>
              )}
            </div>

            {/* JSON Preview */}
            <div className="bg-panel-bg border border-border rounded p-4">
              <h3 className="text-sm font-semibold text-text mb-2">JSON Preview</h3>
              <pre className="text-xs text-text-secondary overflow-auto max-h-64 bg-background p-2 rounded">
                {JSON.stringify(currentStrategy, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="max-w-6xl mx-auto" data-testid="strategy-library-ready">
            <div className="bg-panel-bg border border-border rounded overflow-hidden">
              <table className="w-full" data-testid="strategy-library-table">
                <thead className="bg-element-bg border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Tags</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                        No strategies yet. Create one in the Builder tab.
                      </td>
                    </tr>
                  ) : (
                    strategies.map((strat, idx) => (
                      <tr key={strat.id || idx} className="border-b border-border hover:bg-element-bg/50" data-testid={`library-item-${idx}`}>
                        <td className="px-4 py-3 text-sm text-text">{strat.name}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{strat.strategy_type}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{strat.tags?.join(', ') || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => { setCurrentStrategy(strat); setActiveTab('builder'); }}
                            className="text-brand hover:underline"
                            data-testid={`load-strategy-${strat.id}`}
                          >
                            Load
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div className="max-w-6xl mx-auto space-y-4" data-testid="strategy-artifacts-ready">
            <StrategyArtifactsPanel onArtifactsLoaded={setDiffArtifacts} />
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="max-w-6xl mx-auto space-y-4" data-testid="strategy-diff-tab-ready">
            <StrategyDiffPanel artifacts={diffArtifacts} />
          </div>
        )}

        {activeTab === 'validate' && (
          <div className="max-w-4xl mx-auto space-y-4" data-testid="strategy-validate-ready">
            {/* v1.29: Deterministic Validation Panel */}
            <StrategyValidationPanel specInput={{
              name: currentStrategy.name,
              type: currentStrategy.strategy_type,
              spec: {
                indicators: currentStrategy.indicators || [],
                entry: currentStrategy.entry_condition ? { condition: currentStrategy.entry_condition.condition_type, indicator: currentStrategy.entry_condition.indicator } : undefined,
                exit: currentStrategy.exit_condition ? { condition: currentStrategy.exit_condition.condition_type, indicator: currentStrategy.exit_condition.indicator } : undefined,
                stop_loss_pct: currentStrategy.stop_loss_pct,
                take_profit_pct: currentStrategy.take_profit_pct,
              },
            }} />

            <div className="bg-panel-bg border border-border rounded p-4">
              <h3 className="text-sm font-semibold text-text mb-3">Upload Strategy JSON</h3>
              <textarea
                rows={15}
                placeholder='Paste strategy JSON here...'
                data-testid="strategy-json-input"
                value={validateJson}
                onChange={(e) => { setValidateJson(e.target.value); setValidateResult(null); }}
                className="w-full px-3 py-2 bg-element-bg border border-border rounded text-sm text-text font-mono"
              />
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(validateJson);
                    if (parsed && typeof parsed === 'object' && parsed.name) {
                      setValidateResult({ valid: true, message: 'Strategy JSON is valid.' });
                    } else {
                      setValidateResult({ valid: false, message: 'Error: Missing required fields (name).' });
                    }
                  } catch {
                    setValidateResult({ valid: false, message: 'Error: Invalid JSON syntax.' });
                  }
                }}
                data-testid="validate-json-btn"
                className="mt-3 px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded font-medium"
              >
                Validate JSON
              </button>
              {validateResult && (
                <div className={`mt-3 p-3 rounded text-sm ${validateResult.valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`} data-testid="validate-result">
                  {validateResult.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
