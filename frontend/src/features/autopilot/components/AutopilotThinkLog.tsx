/**
 * Autopilot Think Log Component
 * Displays the AI's decision-making process in real-time
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAutopilotStore } from '../store';

// Use type from store/types if shared, or keep local mapping
interface ThinkLogEntry {
    timestamp: string;
    emoji?: string;
    phase: string;
    thought: string;
    details?: Record<string, unknown>;
}

interface ThinkLogResponse {
    run_id: string | null;
    timestamp?: string;
    success?: boolean;
    duration_ms?: number;
    think_log: ThinkLogEntry[];
    count: number;
    summary?: {
        orders_filled: number;
        exits_triggered: number;
        candidates_generated: number;
    };
    message?: string;
}

const phaseColors: Record<string, string> = {
    START: 'text-blue-400',
    OBSERVE: 'text-cyan-400',
    MONITOR: 'text-purple-400',
    EVALUATE: 'text-yellow-400',
    DECIDE: 'text-green-400',
    SELECT: 'text-green-500',
    REJECT: 'text-red-400',
    SKIP: 'text-gray-400',
    EXECUTE: 'text-orange-400',
    ALERT: 'text-red-500',
    SAVE: 'text-gray-500',
    COMPLETE: 'text-green-500',
};

export const AutopilotThinkLog: React.FC = () => {
    const [thinkLog, setThinkLog] = useState<ThinkLogEntry[]>([]);
    const [runId, setRunId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchThinkLog = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/v1/autopilot/think-log');
            if (response.ok) {
                const data: ThinkLogResponse = await response.json();
                setThinkLog(data.think_log || []);
                setRunId(data.run_id);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch think log:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const { thinkLog: storeThinkLog, connectionStatus } = useAutopilotStore();

    // Merge store log with local (or just us store log)
    // Actually, let's switch to fully using store log if connected

    useEffect(() => {
        if (connectionStatus === 'CONNECTED') {
            // If connected, rely on store updates (pushed via WS)
            setThinkLog(storeThinkLog);
            if (storeThinkLog.length > 0) {
                setLastUpdated(new Date());
            }
        } else if (autoRefresh) {
            // Fallback to polling
            fetchThinkLog();
            const interval = setInterval(fetchThinkLog, 5000);
            return () => clearInterval(interval);
        }
    }, [connectionStatus, storeThinkLog, fetchThinkLog, autoRefresh]);

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="think-log">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-750 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <h2 className="text-lg font-semibold text-white">Think Engine Log</h2>
                    {runId && (
                        <span className="text-xs text-gray-500 font-mono">{runId}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="w-4 h-4"
                        />
                        Auto-refresh
                    </label>
                    <button
                        onClick={fetchThinkLog}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
                    >
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </div>

            {/* Log Content */}
            <div className="max-h-96 overflow-y-auto p-4 font-mono text-sm space-y-1">
                {thinkLog.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                        No think log entries yet. Run a cycle to see the AI's decision process.
                    </div>
                ) : (
                    thinkLog.map((entry, index) => (
                        <div key={index} className="flex items-start gap-2 hover:bg-gray-750 px-2 py-1 rounded">
                            <span className="text-gray-500 text-xs mt-1 w-16 shrink-0 font-mono">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                            </span>
                            <span className="text-lg">{entry.emoji}</span>
                            <span className={`font-bold ${phaseColors[entry.phase] || 'text-white'}`}>
                                [{entry.phase}]
                            </span>
                            <span className="text-gray-200 flex-1">{entry.thought}</span>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {lastUpdated && (
                <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                    {thinkLog.length > 0 && ` • ${thinkLog.length} entries`}
                </div>
            )}
        </div>
    );
};

export default AutopilotThinkLog;
