import { useState, useEffect, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
    Bell, Plus, Search, MoreVertical, Trash2,
    Clock
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { IconButton } from '../../../ui/IconButton';
import { EmptyState } from '../../../ui/EmptyState';
import { Drawer } from '../../../ui/Drawer';
import { Input } from '../../../ui/Input';
import { ApiClient } from '../../../data/ApiClient';
import { useToast } from '../../../ui/Toast';

function AlertList({
    alerts,
    selectedId,
    onSelect,
    onNew
}: {
    alerts: any[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
}) {
    const statusColors: Record<string, string> = {
        ACTIVE: 'bg-up',
        PAUSED: 'bg-warn',
        INACTIVE: 'bg-text-secondary',
    };

    return (
        <div className="h-full flex flex-col bg-panel-bg border-r border-border">
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-text">Alerts</h2>
                <Button size="sm" variant="primary" className="gap-1" onClick={onNew}>
                    <Plus size={14} /> Create
                </Button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-element-bg rounded">
                    <Search size={14} className="text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Search alerts..."
                        className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
                {alerts.length > 0 ? (
                    alerts.map(alert => (
                        <button
                            key={alert.id}
                            onClick={() => onSelect(alert.id)}
                            className={`w-full text-left p-3 border-b border-border/50 transition-colors ${selectedId === alert.id ? 'bg-brand/10' : 'hover:bg-element-bg'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${statusColors[alert.status] || 'bg-text-muted'}`} />
                                <span className="text-sm font-medium text-text">{alert.name}</span>
                            </div>
                            <div className="text-xs text-text-secondary mb-1">{alert.condition}</div>
                            <div className="flex items-center gap-2 text-xxs text-text-muted">
                                <span>{alert.symbol}</span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-xs text-text-muted">No alerts found.</p>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 text-brand"
                            onClick={onNew}
                        >
                            Create your first alert
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function AlertDetail({ alert, onDelete, onClose }: { alert: any | null, onDelete: (id: string) => void, onClose: () => void }) {
    if (!alert) {
        return (
            <EmptyState
                icon={<Bell size={48} />}
                title="Select an alert"
                description="Choose an alert from the list to view details and history."
                className="h-full"
            />
        );
    }

    const isActive = alert.status === 'ACTIVE';

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-text">{alert.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant={isActive ? 'success' : 'warning'}>
                            {alert.status}
                        </Badge>
                        <span className="text-xs text-text-secondary">{alert.symbol}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant={isActive ? 'secondary' : 'success'}>
                        {isActive ? 'Pause' : 'Activate'}
                    </Button>
                    <IconButton
                        icon={<Trash2 size={16} />}
                        tooltip="Delete"
                        variant="danger"
                        onClick={() => onDelete(alert.id)}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-text-secondary hover:text-text px-2"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </Button>
                    <IconButton icon={<MoreVertical size={16} />} tooltip="More" variant="ghost" />
                </div>
            </div>

            {/* Condition */}
            <div className="p-4 border-b border-border">
                <h3 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Condition</h3>
                <div className="p-3 bg-element-bg rounded font-mono text-sm text-text">
                    {alert.condition}
                </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 p-4 border-b border-border">
                <div>
                    <h3 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Throttle</h3>
                    <div className="flex items-center gap-2 text-text">
                        <Clock size={14} className="text-text-secondary" />
                        <span className="text-sm">{alert.throttle || 'None'}</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Delivery</h3>
                    <div className="flex items-center gap-2">
                        {(alert.delivery || []).map((ch: string) => (
                            <Badge key={ch} size="sm">{ch}</Badge>
                        ))}
                    </div>
                </div>
            </div>

            {/* History */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Trigger History</h3>
                    <span className="text-xxs text-text-muted">0 total</span>
                </div>
                <div className="flex-1 overflow-auto p-4 text-center text-text-secondary text-xs">
                    No history available.
                </div>
            </div>
        </div>
    );
}

// Alert Builder Form
function AlertBuilderForm({ onSubmit }: { onSubmit: (data: any) => void }) {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [value, setValue] = useState('');

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Alert Name</label>
                <Input
                    placeholder="e.g. Price Breakout"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Symbol</label>
                <Input
                    placeholder="AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Trigger Condition</label>
                <div className="p-3 rounded bg-element-bg border border-border">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <select className="bg-panel-bg text-text text-xs border border-border rounded px-2 py-1.5 focus:border-brand focus:outline-none">
                            <option>Price</option>
                        </select>
                        <select className="bg-panel-bg text-text text-xs border border-border rounded px-2 py-1.5 focus:border-brand focus:outline-none">
                            <option>Greater Than</option>
                        </select>
                        <Input
                            placeholder="Value"
                            className="h-[28px]"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    </div>
                    <p className="text-xxs text-text-muted italic">Example: Price &gt; 190.00</p>
                </div>
            </div>

            <div className="pt-4 border-t border-border">
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => onSubmit({
                        name,
                        symbol,
                        condition: `Price > ${value}`,
                        value: parseFloat(value),
                        delivery: ['webhook']
                    })}
                    disabled={!name || !symbol || !value}
                >
                    Create Alert
                </Button>
            </div>
        </div>
    );
}

export function AlertsView() {
    const [alerts, setAlerts] = useState<any[]>([
        { id: 'a-1', name: 'Sample AAPL Price', symbol: 'AAPL', condition: 'Price > 190.00', status: 'ACTIVE', delivery: ['webhook'] },
        { id: 'a-2', name: 'Sample TSLA Volume', symbol: 'TSLA', condition: 'Volume > 1M', status: 'INACTIVE', delivery: ['email'] }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const { addToast } = useToast();

    const fetchAlerts = useCallback(async () => {
        try {
            const data = await ApiClient.listAlerts();
            if (data.length > 0) {
                setAlerts(data);
                // Don't auto-select
                // setSelectedId(prev => prev || data[0].id);
            }
        } catch (error) {
            console.error('Failed to list alerts', error);
            addToast({ message: 'Failed to load alerts', variant: 'error' });
        }
    }, [addToast]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const handleCreate = async (data: any) => {
        try {
            await ApiClient.createAlert(data);
            addToast({ message: 'Alert created', variant: 'success' });
            setIsBuilderOpen(false);
            fetchAlerts();
        } catch {
            addToast({ message: 'Failed to create alert', variant: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await ApiClient.deleteAlert(id);
            addToast({ message: 'Alert deleted', variant: 'success' });
            if (selectedId === id) setSelectedId(null);
            fetchAlerts();
        } catch {
            addToast({ message: 'Failed to delete alert', variant: 'error' });
        }
    };

    const selectedAlert = alerts.find(a => a.id === selectedId) || null;

    return (
        <div className="h-full bg-background flex flex-col">
            {!selectedId ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <AlertList
                        alerts={alerts}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onNew={() => setIsBuilderOpen(true)}
                    />
                </div>
            ) : (
                <PanelGroup orientation="horizontal" className="flex-1">
                    <Panel defaultSize={35} minSize={25} maxSize={45} className="flex flex-col">
                        <AlertList
                            alerts={alerts}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onNew={() => setIsBuilderOpen(true)}
                        />
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-border hover:bg-brand transition-colors cursor-col-resize flex items-center justify-center">
                        <div className="w-px h-8 bg-border-strong group-hover:bg-brand/50" />
                    </PanelResizeHandle>
                    <Panel defaultSize={65} minSize={40} className="flex flex-col h-full overflow-hidden">
                        <div className="flex-1 h-full overflow-hidden">
                            <AlertDetail
                                alert={selectedAlert}
                                onDelete={handleDelete}
                                onClose={() => setSelectedId(null)}
                            />
                        </div>
                    </Panel>
                </PanelGroup>
            )}

            {/* Alert Builder Drawer */}
            <Drawer
                open={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                title="Create Alert"
                description="Configure trigger conditions and delivery methods."
                size="md"
            >
                <AlertBuilderForm onSubmit={handleCreate} />
            </Drawer>
        </div>
    );
}
