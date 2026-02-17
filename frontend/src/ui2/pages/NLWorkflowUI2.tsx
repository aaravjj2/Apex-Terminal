/**
 * NL Workflow Generator — Wave 18 v1.159-v1.162
 * Natural language workflow generation with validation and simulation.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Sparkles, Play, CheckCircle, XCircle, AlertTriangle, Loader2, FileJson } from 'lucide-react';
import { wave18Store } from '../stores/wave18Store';

function useWave18() {
  return useSyncExternalStore(wave18Store.subscribe, wave18Store.getState);
}

const EXAMPLE_PROMPTS = [
  'Create a daily report export workflow',
  'Set up stop loss at 5% and hedge with puts',
  'Alert me when any order fills',
];

export function NLWorkflowUI2() {
  const { nlPrompt, generatedWorkflow, validation: validationResult, simulation: simulationResult, loading } = useWave18();
  const [simSeed, setSimSeed] = useState(42);

  const handleGenerate = () => {
    if (nlPrompt.trim()) wave18Store.generateWorkflow(nlPrompt);
  };

  const handleValidate = () => {
    if (generatedWorkflow) wave18Store.validateWorkflow(generatedWorkflow as unknown as Record<string, unknown>);
  };

  const handleSimulate = () => {
    if (generatedWorkflow) wave18Store.simulateWorkflow(generatedWorkflow as unknown as Record<string, unknown>, simSeed);
  };

  return (
    <div className="flex flex-col h-full" data-testid="ui2-nl-workflow-page" data-ready="true">
      <PageHeader
        title="NL Workflow Generator"
        subtitle="Describe workflows in plain English · auto-generate · validate · simulate"
        testId="ui2-nl-workflow-header"
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Prompt input */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-nl-prompt-section">
            <label className="block text-xs text-neutral-400 mb-2">Describe your workflow in natural language</label>
            <textarea
              value={nlPrompt}
              onChange={e => wave18Store.setNLPrompt(e.target.value)}
              placeholder="e.g. Create a daily report export workflow..."
              className="w-full h-24 bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none focus:border-blue-500"
              data-testid="ui2-nl-prompt-input"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => wave18Store.setNLPrompt(p)}
                    className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 rounded px-2 py-1 transition-colors"
                    data-testid={`ui2-nl-example-${i}`}
                  >
                    {p.length > 30 ? p.slice(0, 30) + '…' : p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!nlPrompt.trim() || loading}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2 transition-colors"
                data-testid="ui2-nl-generate-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </button>
            </div>
          </div>

          {/* Generated workflow */}
          {generatedWorkflow && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-nl-workflow-result">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-neutral-200">Generated Workflow</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleValidate}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded px-3 py-1.5 transition-colors"
                    data-testid="ui2-nl-validate-btn"
                  >
                    <CheckCircle className="w-3. h-3.5" />
                    Validate
                  </button>
                  <button
                    onClick={handleSimulate}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded px-3 py-1.5 transition-colors"
                    data-testid="ui2-nl-simulate-btn"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Simulate
                  </button>
                  <button
                    onClick={() => wave18Store.clearWorkflow()}
                    className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1"
                    data-testid="ui2-nl-clear-btn"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Workflow summary */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Name</div>
                  <div className="text-sm text-neutral-200" data-testid="ui2-nl-wf-name">{generatedWorkflow.name}</div>
                </div>
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Trigger</div>
                  <div className="text-sm text-neutral-200">{generatedWorkflow.trigger.type}</div>
                </div>
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Actions</div>
                  <div className="text-sm text-neutral-200">{generatedWorkflow.actions.length}</div>
                </div>
              </div>

              {/* JSON preview */}
              <details className="group">
                <summary className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer select-none">
                  Show JSON
                </summary>
                <pre className="mt-2 bg-neutral-950 border border-neutral-800 rounded p-3 text-xs text-neutral-300 overflow-auto max-h-40 font-mono" data-testid="ui2-nl-wf-json">
                  {JSON.stringify(generatedWorkflow, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Validation result */}
          {validationResult && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-nl-validation-result">
              <div className="flex items-center gap-2 mb-3">
                {validationResult.valid ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <h3 className="text-sm font-medium text-neutral-200">
                  Validation: {validationResult.valid ? 'Passed' : 'Failed'}
                </h3>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="space-y-1 mb-2">
                  {validationResult.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-400">
                      <XCircle className="w-3 h-3 flex-shrink-0" />
                      <span data-testid={`ui2-nl-val-error-${i}`}>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="space-y-1">
                  {validationResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span data-testid={`ui2-nl-val-warn-${i}`}>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Simulation result */}
          {simulationResult && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4" data-testid="ui2-nl-simulation-result">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-neutral-200">Simulation Result</h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Seed:</label>
                  <input
                    type="number"
                    value={simSeed}
                    onChange={e => setSimSeed(Number(e.target.value))}
                    className="w-16 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                    data-testid="ui2-nl-sim-seed"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Status</div>
                  <div className={`text-sm font-medium ${simulationResult.status === 'completed' ? 'text-green-400' : 'text-red-400'}`} data-testid="ui2-nl-sim-status">
                    {simulationResult.status === 'completed' ? 'Success' : 'Failed'}
                  </div>
                </div>
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Steps</div>
                  <div className="text-sm text-neutral-200">{simulationResult.steps.filter(s => s.status === 'completed').length}/{simulationResult.steps.length}</div>
                </div>
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Duration</div>
                  <div className="text-sm text-neutral-200">{simulationResult.total_duration_ms}ms</div>
                </div>
                <div className="bg-neutral-950 rounded p-2">
                  <div className="text-xs text-neutral-500">Seed</div>
                  <div className="text-sm font-mono text-neutral-200">{simulationResult.seed}</div>
                </div>
              </div>

              {/* Step log */}
              <div className="space-y-1">
                {simulationResult.steps.map((step, i) => {
                  const isPass = step.status === 'completed';
                  const isFail = step.status === 'failed';
                  const label = `Step ${step.step}: ${step.action_type} — ${step.status} (${step.duration_ms}ms)`;
                  return (
                    <div
                      key={i}
                      className={`text-xs font-mono px-2 py-1 rounded ${
                        isFail ? 'bg-red-950/30 text-red-400' : isPass ? 'bg-green-950/30 text-green-400' : 'bg-neutral-950 text-neutral-400'
                      }`}
                      data-testid={`ui2-nl-sim-log-${i}`}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
