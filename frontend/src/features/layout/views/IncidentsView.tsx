import { useState, useEffect } from 'react';
import { Play, FileText, Database, Download, CheckCircle, ShieldAlert } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Panel } from '../../../ui/Panel';
import { cn } from '../../../ui/utils';

// ==========================================
// TYPES
// ==========================================

interface IncidentBundle {
    id: string;
    name: string;
    recordedAt: string;
    durationSeconds: number;
    tickCount: number;
    hash: string;
    status: 'recording' | 'completed' | 'verified';
    symbols: string[];
}

interface SystemAlert {
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    category: string;
    title: string;
    description: string;
    run_id: string | null;
    created_at: string;
    resolved: boolean;
    resolved_at: string | null;
    resolution_note: string | null;
}

const mockBundles: IncidentBundle[] = [
    {
        id: 'bundle_001',
        name: 'AAPL_2026-01-12_morning',
        recordedAt: '2026-01-12T09:30:00Z',
        durationSeconds: 7200,
        tickCount: 45000,
        hash: 'sha256:abc123def456...',
        status: 'verified',
        symbols: ['AAPL'],
    },
];

export function IncidentsView() {
    const [activeTab, setActiveTab] = useState<'alerts' | 'bundles'>('alerts');

    // Alert State
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // Bundle State
    const [bundles, setBundles] = useState<IncidentBundle[]>(mockBundles);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedBundle, setSelectedBundle] = useState<IncidentBundle | null>(null);

    // ==========================================
    // ALERTS LOGIC
    // ==========================================

    const fetchAlerts = async () => {
        setAlertsLoading(true);
        try {
            const res = await fetch('/api/v1/alerts?limit=50');
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'alerts') {
            fetchAlerts();
            const interval = setInterval(fetchAlerts, 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab]);

    const handleResolveAlert = async (id: string) => {
        try {
            await fetch(`/api/v1/alerts/${id}/resolve?note=Manual resolution`, { method: 'POST' });
            fetchAlerts();
        } catch (err) {
            console.error('Failed to resolve alert:', err);
        }
    };

    // ==========================================
    // BUNDLE LOGIC
    // ==========================================

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const handleStartRecording = () => {
        setIsRecording(true);
        // In real implementation: POST /api/v1/incidents/start
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        // In real implementation: POST /api/v1/incidents/{run_id}/stop
        const newBundle: IncidentBundle = {
            id: `bundle_${Date.now()}`,
            name: `Recording_${new Date().toISOString().slice(0, 10)}`,
            recordedAt: new Date().toISOString(),
            durationSeconds: 0,
            tickCount: 0,
            hash: 'pending...',
            status: 'completed',
            symbols: ['AAPL'],
        };
        setBundles(prev => [newBundle, ...prev]);
    };

    return (
        <div className="h-full overflow-auto bg-background flex flex-col">
            {/* Header */}
            <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-text">Incidents & Forensics</h1>
                        <p className="text-sm text-text-secondary">
                            Monitor system health alerts and manage replay bundles
                        </p>
                    </div>
                    {activeTab === 'bundles' && (
                        <Button
                            variant={isRecording ? 'danger' : 'primary'}
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            className="gap-2"
                        >
                            {isRecording ? (
                                <>
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    Stop Recording
                                </>
                            ) : (
                                <>
                                    <Database size={16} />
                                    Start Recording
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-6 border-b border-border">
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className={cn(
                            "pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                            activeTab === 'alerts'
                                ? "border-brand text-brand"
                                : "border-transparent text-text-secondary hover:text-text"
                        )}
                    >
                        <ShieldAlert size={16} />
                        System Alerts
                        {alerts.filter(a => !a.resolved).length > 0 && (
                            <Badge variant="error" className="ml-1 h-5 px-1.5">
                                {alerts.filter(a => !a.resolved).length}
                            </Badge>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('bundles')}
                        className={cn(
                            "pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                            activeTab === 'bundles'
                                ? "border-brand text-brand"
                                : "border-transparent text-text-secondary hover:text-text"
                        )}
                    >
                        <Database size={16} />
                        Replay Bundles
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-hidden">
                {activeTab === 'alerts' ? (
                    <div className="h-full overflow-auto space-y-4">
                        {alertsLoading && alerts.length === 0 ? (
                            <div className="text-center py-12 text-text-secondary">Loading alerts...</div>
                        ) : alerts.length === 0 ? (
                            <div className="text-center py-12 text-text-secondary">
                                <CheckCircle size={48} className="mx-auto mb-4 text-green-500/50" />
                                <h3 className="text-lg font-medium text-text">All Clear</h3>
                                <p>No active system incidents or alerts.</p>
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <Panel
                                    key={alert.id}
                                    className={cn(
                                        "p-4 border-l-4",
                                        alert.resolved ? "border-l-border" :
                                            alert.severity === 'critical' || alert.severity === 'error' ? "border-l-red-500" :
                                                alert.severity === 'warning' ? "border-l-yellow-500" : "border-l-blue-500"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant={
                                                    alert.resolved ? 'default' :
                                                        alert.severity === 'critical' || alert.severity === 'error' ? 'error' :
                                                            alert.severity === 'warning' ? 'warning' : 'outline'
                                                }>
                                                    {alert.severity.toUpperCase()}
                                                </Badge>
                                                <span className="font-medium text-text">{alert.title}</span>
                                                <span className="text-text-muted text-xs mx-2">
                                                    {new Date(alert.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-text-secondary mt-1">{alert.description}</p>
                                            {alert.run_id && (
                                                <div className="mt-2 text-xs font-mono text-text-muted bg-element-bg inline-block px-1.5 py-0.5 rounded">
                                                    Run: {alert.run_id}
                                                </div>
                                            )}
                                        </div>
                                        {!alert.resolved ? (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleResolveAlert(alert.id)}
                                            >
                                                Resolve
                                            </Button>
                                        ) : (
                                            <div className="text-xs text-text-muted flex items-center gap-1">
                                                <CheckCircle size={12} />
                                                Resolved
                                            </div>
                                        )}
                                    </div>
                                </Panel>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="h-full overflow-auto space-y-6">
                        {/* Recording Status */}
                        {isRecording && (
                            <Panel className="bg-red-500/10 border-red-500/50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    <div>
                                        <p className="font-semibold text-red-400">Recording in progress...</p>
                                        <p className="text-sm text-red-300/70">Capturing live market data for replay bundle</p>
                                    </div>
                                    <div className="ml-auto text-sm text-red-300 font-mono">
                                        00:05:32
                                    </div>
                                </div>
                            </Panel>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Bundle List */}
                            <div className="space-y-4">
                                {bundles.map(bundle => (
                                    <Panel
                                        key={bundle.id}
                                        className={cn(
                                            "p-4 cursor-pointer hover:bg-element-bg transition-colors",
                                            selectedBundle?.id === bundle.id && "ring-2 ring-brand"
                                        )}
                                        onClick={() => setSelectedBundle(bundle)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-element-bg rounded flex items-center justify-center">
                                                    <FileText size={16} className="text-text-secondary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-text text-sm">{bundle.name}</h3>
                                                    <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                                                        <span>{new Date(bundle.recordedAt).toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <span>{formatDuration(bundle.durationSeconds)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="outline">{bundle.status}</Badge>
                                        </div>
                                    </Panel>
                                ))}
                            </div>

                            {/* Bundle Details */}
                            {selectedBundle ? (
                                <Panel className="p-6 h-fit bg-surface-elevated">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Database size={18} />
                                        Bundle Details
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <label className="text-text-secondary text-xs">ID</label>
                                                <div className="font-mono">{selectedBundle.id}</div>
                                            </div>
                                            <div>
                                                <label className="text-text-secondary text-xs">Tick Count</label>
                                                <div>{selectedBundle.tickCount.toLocaleString()}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-text-secondary text-xs">Content Hash</label>
                                                <div className="font-mono text-xs break-all bg-element-bg p-2 rounded mt-1">
                                                    {selectedBundle.hash}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-border flex gap-2">
                                            <Button className="flex-1" variant="primary">
                                                <Play size={16} className="mr-2" /> Load Replay
                                            </Button>
                                            <Button variant="secondary">
                                                <Download size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                </Panel>
                            ) : (
                                <div className="hidden lg:flex items-center justify-center text-text-secondary h-64 border-2 border-dashed border-border rounded-lg">
                                    Select a bundle to view details
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

