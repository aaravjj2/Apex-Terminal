import { useState, useEffect } from 'react';
import { AlertTriangle, Play, Download, RefreshCw, Clock, Hash } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Incident {
    incident_id: string;
    run_id: string;
    strategy_id: string;
    captured_at: string;
    duration_seconds: number;
    event_count: number;
    content_hash: string;
}

export function IncidentViewer() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [replayResult, setReplayResult] = useState<any>(null);

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/incidents`);
            if (res.ok) {
                setIncidents(await res.json());
            }
        } catch (e) {
            console.error('Failed to fetch incidents:', e);
        } finally {
            setLoading(false);
        }
    };

    const viewIncident = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}`);
            if (res.ok) {
                setSelectedIncident(await res.json());
                setReplayResult(null);
            }
        } catch (e) {
            console.error('Failed to fetch incident:', e);
        }
    };

    const replayIncident = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/replay`, { method: 'POST' });
            if (res.ok) {
                setReplayResult(await res.json());
            }
        } catch (e) {
            console.error('Failed to replay incident:', e);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-10 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-400" />
                    <span className="text-sm font-bold text-[#d1d4dc]">Incident Viewer</span>
                </div>
                <button onClick={fetchIncidents} className="p-1 hover:bg-[#2a2e39] rounded">
                    <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Incidents List */}
                <div className="w-64 border-r border-[#2a2e39] overflow-y-auto">
                    {incidents.length === 0 ? (
                        <div className="p-4 text-center text-[#787b86] text-xs">
                            No incidents captured yet.
                        </div>
                    ) : (
                        incidents.map(inc => (
                            <button
                                key={inc.incident_id}
                                onClick={() => viewIncident(inc.incident_id)}
                                className={`w-full p-3 text-left border-b border-[#2a2e39] hover:bg-[#1e222d] ${selectedIncident?.incident_id === inc.incident_id ? 'bg-[#2962ff]/10' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs text-[#d1d4dc]">{inc.incident_id}</span>
                                    <span className="text-[10px] text-[#787b86]">{inc.event_count} events</span>
                                </div>
                                <div className="text-[10px] text-[#787b86] mt-1">{inc.strategy_id}</div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-[#787b86]">
                                    <Clock size={10} /> {formatTime(inc.duration_seconds)}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Incident Detail */}
                <div className="flex-1 overflow-y-auto p-4">
                    {selectedIncident ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-[#d1d4dc]">
                                    Incident {selectedIncident.incident_id}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => replayIncident(selectedIncident.incident_id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#089981] text-white text-xs rounded"
                                    >
                                        <Play size={12} /> Replay
                                    </button>
                                    <a
                                        href={`${API_BASE}/incidents/${selectedIncident.incident_id}/export`}
                                        target="_blank"
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#2a2e39] text-[#d1d4dc] text-xs rounded"
                                    >
                                        <Download size={12} /> Export
                                    </a>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-[#1e222d] p-3 rounded">
                                    <div className="text-[#787b86]">Strategy</div>
                                    <div className="text-[#d1d4dc]">{selectedIncident.strategy_id}</div>
                                </div>
                                <div className="bg-[#1e222d] p-3 rounded">
                                    <div className="text-[#787b86]">Duration</div>
                                    <div className="text-[#d1d4dc]">{formatTime(selectedIncident.duration_seconds)}</div>
                                </div>
                                <div className="bg-[#1e222d] p-3 rounded col-span-2">
                                    <div className="text-[#787b86] flex items-center gap-1"><Hash size={10} /> Content Hash</div>
                                    <div className="text-[#d1d4dc] font-mono text-[10px] break-all">{selectedIncident.content_hash}</div>
                                </div>
                            </div>

                            {/* Events Timeline */}
                            <div>
                                <h4 className="text-sm font-bold text-[#787b86] mb-2">Events ({selectedIncident.events?.length || 0})</h4>
                                <div className="bg-[#0d1117] rounded border border-[#2a2e39] max-h-48 overflow-y-auto">
                                    {selectedIncident.events?.slice(0, 50).map((evt: any, i: number) => (
                                        <div key={i} className="px-3 py-1 border-b border-[#2a2e39] text-[10px] flex justify-between">
                                            <span className={`${evt.type === 'error' ? 'text-red-400' : 'text-[#787b86]'}`}>{evt.type}</span>
                                            <span className="text-[#787b86]">{evt.timestamp?.split('T')[1]?.slice(0, 8)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Replay Result */}
                            {replayResult && (
                                <div className="bg-[#1e222d] p-3 rounded border border-[#2a2e39]">
                                    <h4 className="text-sm font-bold text-[#787b86] mb-2">Replay Result</h4>
                                    <div className="text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-[#787b86]">Events Replayed</span>
                                            <span className="text-[#d1d4dc]">{replayResult.events_replayed}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[#787b86]">Errors</span>
                                            <span className={replayResult.errors?.length ? 'text-red-400' : 'text-[#d1d4dc]'}>{replayResult.errors?.length || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[#787b86]">Output Hash</span>
                                            <span className="font-mono text-[10px] text-[#d1d4dc]">{replayResult.output_hash?.slice(0, 16)}...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[#787b86]">
                            Select an incident to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
