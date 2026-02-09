import { useState, useEffect } from 'react';
import { Play, Pause, Square, RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Run {
    run_id: string;
    strategy_id: string;
    run_type: string;
    status: string;
    created_at: string;
    started_at: string | null;
    stopped_at: string | null;
    last_heartbeat: string | null;
    last_error: string | null;
    error_count: number;
    restart_count: number;
}

export function RunsDashboard() {
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        fetchRuns();
        const interval = setInterval(fetchRuns, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchRuns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/runs`);
            if (res.ok) {
                const data = await res.json();
                setRuns(data);
            }
        } catch (e) {
            console.error('Failed to fetch runs:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (runId: string) => {
        try {
            const res = await fetch(`${API_BASE}/runs/${runId}/logs`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (e) {
            console.error('Failed to fetch logs:', e);
        }
    };

    const handleAction = async (runId: string, action: 'start' | 'pause' | 'resume' | 'stop') => {
        try {
            await fetch(`${API_BASE}/runs/${runId}/${action}`, { method: 'POST' });
            fetchRuns();
        } catch (e) {
            console.error(`Failed to ${action} run:`, e);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running': return <Zap size={14} className="text-green-400" />;
            case 'paused': return <Pause size={14} className="text-yellow-400" />;
            case 'stopped': return <Square size={14} className="text-gray-400" />;
            case 'error': return <AlertCircle size={14} className="text-red-400" />;
            case 'completed': return <CheckCircle size={14} className="text-blue-400" />;
            default: return <Clock size={14} className="text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'bg-green-500/20 text-green-400';
            case 'paused': return 'bg-yellow-500/20 text-yellow-400';
            case 'stopped': return 'bg-gray-500/20 text-gray-400';
            case 'error': return 'bg-red-500/20 text-red-400';
            case 'completed': return 'bg-blue-500/20 text-blue-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const formatTime = (iso: string | null) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleTimeString();
    };

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-10 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <span className="text-sm font-bold text-[#d1d4dc]">Runs Dashboard</span>
                <button onClick={fetchRuns} className="p-1 hover:bg-[#2a2e39] rounded">
                    <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                    <thead className="bg-[#1e222d] sticky top-0">
                        <tr className="text-[#787b86] text-left">
                            <th className="p-3">Status</th>
                            <th className="p-3">Run ID</th>
                            <th className="p-3">Strategy</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Started</th>
                            <th className="p-3">Heartbeat</th>
                            <th className="p-3">Errors</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run) => (
                            <tr
                                key={run.run_id}
                                onClick={() => { setSelectedRun(run.run_id); fetchLogs(run.run_id); }}
                                className={`border-b border-[#2a2e39] hover:bg-[#1e222d] cursor-pointer ${selectedRun === run.run_id ? 'bg-[#2962ff]/10' : ''}`}
                            >
                                <td className="p-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${getStatusColor(run.status)}`}>
                                        {getStatusIcon(run.status)}
                                        {run.status}
                                    </span>
                                </td>
                                <td className="p-3 font-mono text-[#d1d4dc]">{run.run_id}</td>
                                <td className="p-3 text-[#d1d4dc]">{run.strategy_id}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] ${run.run_type === 'backtest' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                        {run.run_type}
                                    </span>
                                </td>
                                <td className="p-3 text-[#787b86]">{formatTime(run.started_at)}</td>
                                <td className="p-3 text-[#787b86]">{formatTime(run.last_heartbeat)}</td>
                                <td className="p-3">
                                    {run.error_count > 0 && (
                                        <span className="text-red-400">{run.error_count}</span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        {run.status === 'pending' && (
                                            <button onClick={() => handleAction(run.run_id, 'start')} className="p-1 hover:bg-[#2a2e39] rounded">
                                                <Play size={12} className="text-green-400" />
                                            </button>
                                        )}
                                        {run.status === 'running' && (
                                            <>
                                                <button onClick={() => handleAction(run.run_id, 'pause')} className="p-1 hover:bg-[#2a2e39] rounded">
                                                    <Pause size={12} className="text-yellow-400" />
                                                </button>
                                                <button onClick={() => handleAction(run.run_id, 'stop')} className="p-1 hover:bg-[#2a2e39] rounded">
                                                    <Square size={12} className="text-red-400" />
                                                </button>
                                            </>
                                        )}
                                        {run.status === 'paused' && (
                                            <>
                                                <button onClick={() => handleAction(run.run_id, 'resume')} className="p-1 hover:bg-[#2a2e39] rounded">
                                                    <Play size={12} className="text-green-400" />
                                                </button>
                                                <button onClick={() => handleAction(run.run_id, 'stop')} className="p-1 hover:bg-[#2a2e39] rounded">
                                                    <Square size={12} className="text-red-400" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {runs.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-[#787b86]">
                                    No runs found. Create a run from the Strategy IDE.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Logs Panel */}
            {selectedRun && (
                <div className="h-40 border-t border-[#2a2e39] bg-[#0d1117] overflow-y-auto">
                    <div className="px-3 py-1 border-b border-[#2a2e39] text-[10px] text-[#787b86] uppercase font-bold sticky top-0 bg-[#0d1117] flex justify-between">
                        <span>Logs: {selectedRun}</span>
                        <button onClick={() => setSelectedRun(null)} className="text-[#787b86] hover:text-white">×</button>
                    </div>
                    <div className="p-2 font-mono text-xs">
                        {logs.map((log, i) => (
                            <div key={i} className={`py-0.5 ${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-[#787b86]'}`}>
                                [{log.timestamp}] [{log.level?.toUpperCase()}] {log.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
