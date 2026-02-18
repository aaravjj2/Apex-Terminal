/**
 * Run History Component
 * Displays recent autopilot cycles
 */

import React from 'react';
import { useAutopilotStore } from '../store';
import type { CycleResult } from '../types';

const RunItem: React.FC<{ run: CycleResult }> = ({ run }) => {
    const statusColor = run.success ? 'text-green-400' : 'text-red-400 border-red-800 bg-red-900/10';
    const duration = (run.duration_ms / 1000).toFixed(1);
    const time = new Date(run.started_at).toLocaleTimeString();

    return (
        <div className={`py-2 px-3 border-b border-gray-700 text-sm ${!run.success ? 'bg-red-900/10' : ''}`} data-testid={`run-${run.cycle_id}`}>
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${statusColor}`}>
                        {run.success ? 'CYCLE' : 'FAILED'}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">#{run.cycle_id.slice(0, 6)}</span>
                </div>
                <span className="text-gray-500 text-xs">{time} ({duration}s)</span>
            </div>

            {run.error && (
                <div className="text-red-300 text-xs mb-1 bg-red-900/20 p-1 rounded">
                    {run.error.message}
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mt-1">
                <div title="Candidates Generated/Selected">
                    🔍 {run.candidates.generated}/{run.selection.selected}
                </div>
                <div title="Orders Selected/Filled">
                    📝 {run.execution.submitted}/{run.execution.filled}
                </div>
                <div title="Monitoring Exits">
                    🔔 {run.monitoring.exit_signals}
                </div>
                <div title="Exits Executed">
                    📤 {run.monitoring.exits_executed}
                </div>
            </div>
        </div>
    );
};

export const RunHistory: React.FC = () => {
    const { runs, lastCycle } = useAutopilotStore();

    if (runs.length === 0 && !lastCycle) {
        return (
            <div className="text-gray-500 text-sm text-center py-4">
                No run history available
            </div>
        );
    }

    // Combine lists if needed, but store should handle it.
    // Using runs from store
    return (
        <div className="flex flex-col h-full" data-testid="run-history">
            <h3 className="text-sm font-semibold text-gray-300 px-3 py-2 bg-gray-800 border-b border-gray-700">
                Run History ({runs.length})
            </h3>
            <div className="flex-1 overflow-auto">
                {runs.map(run => (
                    <RunItem key={run.cycle_id} run={run} />
                ))}
            </div>
        </div>
    );
};
