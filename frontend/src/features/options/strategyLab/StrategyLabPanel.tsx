/**
 * Strategy Lab Panel - Main component with subtabs
 */

import { useState } from 'react';
import type { StrategyLabTab, StrategyDefinition } from './types';

export function StrategyLabPanel() {
  const [activeTab, setActiveTab] = useState<StrategyLabTab>('builder');
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<StrategyDefinition>({
    name: '',
    description: '',
    strategy_type: 'crossover',
    indicators: [],
    tags: []
  });
  const [validateJson, setValidateJson] = useState('');
  const [validateResult, setValidateResult] = useState<{ valid: boolean; message: string } | null>(null);

  const tabs = [
    { id: 'builder' as const, label: 'Builder' },
    { id: 'library' as const, label: 'Library' },
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
      setStrategies(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load strategies:', e);
      setStrategies([]);
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
        <h2 className="text-lg font-semibold text-text">Strategy Lab</h2>
        
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
          <div className="max-w-4xl mx-auto space-y-4">
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
                  onClick={handleValidate}
                  data-testid="validate-strategy-btn"
                  className="px-4 py-2 bg-element-bg hover:bg-border text-text rounded font-medium"
                >
                  Validate
                </button>
              </div>
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
          <div className="max-w-6xl mx-auto">
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

        {activeTab === 'validate' && (
          <div className="max-w-4xl mx-auto space-y-4">
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
