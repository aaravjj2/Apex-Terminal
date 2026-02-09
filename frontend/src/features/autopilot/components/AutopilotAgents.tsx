import React, { useEffect, useState } from 'react';

interface AgentStatus {
    symbol: string;
    running: boolean;
    interval: number;
    last_check: string;
    status: string;
}

interface AgentsResponse {
    agents: AgentStatus[];
    count: number;
    monitoring_active: boolean;
}

export const AutopilotAgents: React.FC = () => {
    const [data, setData] = useState<AgentsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/v1/autopilot/agents');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error("Failed to fetch agents", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    if (loading && !data) return <div className="text-gray-500 text-sm p-4">Loading agents...</div>;
    if (!data || data.agents.length === 0) {
        if (data?.monitoring_active) {
            return (
                <div className="bg-gray-800 rounded p-4 mb-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <span>🛡️ Active Guardians</span>
                        <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Dispatcher Active</span>
                    </h3>
                    <div className="text-gray-500 text-sm text-center py-2">
                        No active positions to monitor.
                    </div>
                </div>
            )
        }
        return null;
    }

    return (
        <div className="bg-gray-800 rounded p-4 mb-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <span>🛡️ Active Guardians</span>
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">{data.count} Active</span>
                </h3>
                {data.monitoring_active && (
                    <span className="text-xs text-green-400 font-mono animate-pulse">● Dispatcher Running</span>
                )}
            </div>

            <div className="space-y-2">
                {data.agents.map((agent) => (
                    <div key={agent.symbol} className="flex items-center justify-between bg-gray-750 p-2 rounded border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${agent.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="font-bold text-sm font-mono">{agent.symbol}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>Interval: {agent.interval}s</span>
                            <span className={agent.status === 'watching' ? 'text-green-400' : 'text-gray-500'}>
                                {agent.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
