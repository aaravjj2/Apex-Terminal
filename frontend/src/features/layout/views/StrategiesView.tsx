import { useState, useEffect, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
    Play, Pause, Square, Settings, TrendingUp,
    MoreVertical, Plus, Search, Filter
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { IconButton } from '../../../ui/IconButton';
import { Table, type Column } from '../../../ui/Table';
import { EmptyState } from '../../../ui/EmptyState';
import { Drawer } from '../../../ui/Drawer';
import { ConfirmModal } from '../../../ui/Modal';
import { Input } from '../../../ui/Input';
import { ApiClient, type StrategyResponse } from '../../../data/ApiClient';
import { useToast } from '../../../ui/Toast';

// Mock trades still needed as API doesn't have a dedicated trades endpoint for strategies yet
// In a full implementation, this should also be fetched
const mockTrades = [
    { id: 't-1', time: '09:31:42', symbol: 'AAPL', side: 'BUY', qty: 100, price: 185.42, pnl: null },
    { id: 't-2', time: '10:15:30', symbol: 'AAPL', side: 'SELL', qty: 100, price: 186.20, pnl: 78.00 },
    { id: 't-3', time: '11:02:15', symbol: 'AAPL', side: 'BUY', qty: 50, price: 185.80, pnl: null },
];

function StrategyList({
    strategies,
    selectedId,
    onSelect,
    onNew
}: {
    strategies: StrategyResponse[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
}) {
    const statusColors: Record<string, string> = {
        RUNNING: 'bg-up',
        STOPPED: 'bg-text-secondary',
        PAUSED: 'bg-warn',
        ERROR: 'bg-down',
        CREATED: 'bg-brand',
    };

    return (
        <div className="h-full flex flex-col bg-panel-bg border-r border-border">
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-text">Strategies</h2>
                <Button size="sm" variant="primary" className="gap-1" onClick={onNew}>
                    <Plus size={14} /> New
                </Button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-element-bg rounded">
                    <Search size={14} className="text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Search strategies..."
                        className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
                {strategies.length > 0 ? (
                    strategies.map(strat => (
                        <button
                            key={strat.id}
                            onClick={() => onSelect(strat.id)}
                            className={`w-full text-left p-3 border-b border-border/50 transition-colors ${selectedId === strat.id ? 'bg-brand/10' : 'hover:bg-element-bg'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${statusColors[strat.status] || 'bg-text-muted'}`} />
                                <span className="text-sm font-medium text-text">{strat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xxs text-text-secondary">
                                <Badge size="sm" variant="outline">
                                    {strat.strategy_type}
                                </Badge>
                                <span>{strat.symbol}</span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-xs text-text-muted">No strategies found.</p>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 text-brand"
                            onClick={onNew}
                        >
                            Create your first strategy
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StrategyDetail({
    strategy,
    onStop,
    onStart,
    onDelete,
    onClose
}: {
    strategy: StrategyResponse | null;
    onStop: () => void;
    onStart: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    if (!strategy) {
        return (
            <EmptyState
                icon={<TrendingUp size={48} />}
                title="Select a strategy"
                description="Choose a strategy from the list to view details and controls."
                className="h-full"
            />
        );
    }

    const isRunning = strategy.status === 'RUNNING';

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-text">{strategy.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                            {strategy.strategy_type}
                        </Badge>
                        <Badge variant={strategy.status === 'RUNNING' ? 'success' : 'default'}>
                            {strategy.status}
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-text-secondary hover:text-text px-2"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </Button>
                    {isRunning ? (
                        <>
                            <Button size="sm" variant="secondary" className="gap-1">
                                <Pause size={14} /> Pause
                            </Button>
                            <Button size="sm" variant="danger" className="gap-1" onClick={onStop}>
                                <Square size={14} /> Stop
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="sm" variant="success" className="gap-1" onClick={onStart}>
                                <Play size={14} /> Start
                            </Button>
                            <IconButton icon={<Settings size={16} />} tooltip="Settings" variant="ghost" />
                            <IconButton
                                icon={<MoreVertical size={16} />}
                                tooltip="Delete"
                                variant="ghost"
                                onClick={onDelete}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Stats (Mocked for now as API response doesn't always have metrics) */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-border shrink-0">
                <div>
                    <div className="text-xxs text-text-secondary uppercase tracking-wider mb-1">P&L</div>
                    <div className="text-xl font-semibold text-up tabular-nums">+$0.00</div>
                </div>
                <div>
                    <div className="text-xxs text-text-secondary uppercase tracking-wider mb-1">Trades</div>
                    <div className="text-xl font-semibold text-text tabular-nums">0</div>
                </div>
                <div>
                    <div className="text-xxs text-text-secondary uppercase tracking-wider mb-1">Win Rate</div>
                    <div className="text-xl font-semibold text-text tabular-nums">0%</div>
                </div>
                <div>
                    <div className="text-xxs text-text-secondary uppercase tracking-wider mb-1">Symbol</div>
                    <div className="text-sm text-text">{strategy.symbol}</div>
                </div>
            </div>

            {/* Trades Blotter */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Recent Trades</h3>
                    <IconButton icon={<Filter size={14} />} tooltip="Filter" variant="ghost" size="sm" />
                </div>
                <div className="flex-1 overflow-auto">
                    <Table
                        columns={[
                            { key: 'time', header: 'Time', width: '100px' },
                            { key: 'symbol', header: 'Symbol' },
                            {
                                key: 'side', header: 'Side', render: (row) => (
                                    <span className={row.side === 'BUY' ? 'text-up' : 'text-down'}>{row.side}</span>
                                )
                            },
                            { key: 'qty', header: 'Qty', align: 'right' },
                            { key: 'price', header: 'Price', align: 'right', render: (row) => `$${row.price.toFixed(2)}` },
                            {
                                key: 'pnl', header: 'P&L', align: 'right', render: (row) =>
                                    row.pnl !== null
                                        ? <span className={row.pnl >= 0 ? 'text-up' : 'text-down'}>${row.pnl.toFixed(2)}</span>
                                        : <span className="text-text-muted">—</span>
                            },
                        ] as Column<typeof mockTrades[0]>[]}
                        data={mockTrades}
                        keyExtractor={(row) => row.id}
                        compact
                    />
                </div>
            </div>
        </div>
    );
}

// New Strategy Form Component
function NewStrategyForm({ onSubmit }: { onSubmit: (data: any) => void }) {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Strategy Name</label>
                <Input
                    placeholder="e.g. Mean Reversion"
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
                <label className="text-xs font-medium text-text-secondary">Strategy Type</label>
                <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 p-3 rounded bg-element-bg border border-brand text-left">
                        <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center text-brand">
                            <TrendingUp size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-text">Standard Logic</div>
                            <div className="text-xs text-text-secondary">Simple implementation</div>
                        </div>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded bg-element-bg border border-border hover:border-text-secondary transition-colors text-left">
                        <div className="w-8 h-8 rounded bg-text-secondary/10 flex items-center justify-center text-text-secondary">
                            <Settings size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-text">Custom Script</div>
                            <div className="text-xs text-text-secondary">Advanced Python strategy</div>
                        </div>
                    </button>
                </div>
            </div>

            <div className="pt-4 border-t border-border">
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => onSubmit({ name, symbol, strategy_type: 'standard' })}
                    disabled={!name || !symbol}
                >
                    Create Strategy
                </Button>
            </div>
        </div>
    );
}

export function StrategiesView() {
    const [strategies, setStrategies] = useState<StrategyResponse[]>([
        {
            id: 's-1', name: 'Sample Mean Reversion', symbol: 'AAPL', strategy_type: 'standard', status: 'RUNNING', created_at: new Date().toISOString(),
            params: {}, started_at: new Date().toISOString(), metrics: { pnl: 120.50, trades: 12, win_rate: 0.65 }
        },
        {
            id: 's-2', name: 'Sample Breakout', symbol: 'TSLA', strategy_type: 'standard', status: 'STOPPED', created_at: new Date().toISOString(),
            params: {}, started_at: null, metrics: { pnl: -45.00, trades: 5, win_rate: 0.40 }
        }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [stopConfirmId, setStopConfirmId] = useState<string | null>(null);
    const { addToast } = useToast();

    const fetchStrategies = useCallback(async () => {
        try {
            const data = await ApiClient.listStrategies();
            if (data.length > 0) {
                setStrategies(data);
                // Don't auto-select to preserve list view initially
                // setSelectedId(prev => prev || data[0].id);
            }
        } catch (error) {
            console.error('Failed to list strategies', error);
            addToast({ message: 'Failed to load strategies', variant: 'error' });
        }
    }, [addToast]);

    useEffect(() => {
        fetchStrategies();
    }, [fetchStrategies]);

    const handleCreate = async (data: any) => {
        try {
            await ApiClient.createStrategy(data);
            addToast({ message: 'Strategy created', variant: 'success' });
            setIsNewOpen(false);
            fetchStrategies();
        } catch {
            addToast({ message: 'Failed to create strategy', variant: 'error' });
        }
    };

    const handleStart = async (id: string) => {
        try {
            await ApiClient.startStrategy(id);
            addToast({ message: 'Strategy started', variant: 'success' });
            fetchStrategies();
        } catch {
            addToast({ message: 'Failed to start strategy', variant: 'error' });
        }
    };

    const handleStop = async (id: string) => {
        try {
            await ApiClient.stopStrategy(id);
            addToast({ message: 'Strategy stopped', variant: 'success' });
            setStopConfirmId(null);
            fetchStrategies();
        } catch {
            addToast({ message: 'Failed to stop strategy', variant: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await ApiClient.deleteStrategy(id);
            addToast({ message: 'Strategy deleted', variant: 'success' });
            if (selectedId === id) setSelectedId(null);
            fetchStrategies();
        } catch {
            addToast({ message: 'Failed to delete strategy', variant: 'error' });
        }
    };

    const selectedStrategy = strategies.find(s => s.id === selectedId) || null;

    return (
        <div className="h-full bg-background flex flex-col">
            {!selectedId ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <StrategyList
                        strategies={strategies}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onNew={() => setIsNewOpen(true)}
                    />
                </div>
            ) : (
                <PanelGroup orientation="horizontal" className="flex-1">
                    <Panel defaultSize={35} minSize={25} maxSize={45} className="flex flex-col">
                        <StrategyList
                            strategies={strategies}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onNew={() => setIsNewOpen(true)}
                        />
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-border hover:bg-brand transition-colors cursor-col-resize flex items-center justify-center">
                        <div className="w-px h-8 bg-border-strong group-hover:bg-brand/50" />
                    </PanelResizeHandle>
                    <Panel defaultSize={65} minSize={40} className="flex flex-col h-full overflow-hidden">
                        <div className="flex-1 h-full overflow-hidden">
                            <StrategyDetail
                                strategy={selectedStrategy}
                                onStop={() => setStopConfirmId(selectedStrategy?.id || null)}
                                onStart={() => selectedStrategy && handleStart(selectedStrategy.id)}
                                onDelete={() => selectedStrategy && handleDelete(selectedStrategy.id)}
                                onClose={() => setSelectedId(null)}
                            />
                        </div>
                    </Panel>
                </PanelGroup>
            )}

            {/* New Strategy Drawer */}
            <Drawer
                open={isNewOpen}
                onClose={() => setIsNewOpen(false)}
                title="Create New Strategy"
                description="Configure the initial parameters for your trading strategy."
                size="md"
            >
                <NewStrategyForm onSubmit={handleCreate} />
            </Drawer>

            {/* Stop Confirmation */}
            <ConfirmModal
                open={!!stopConfirmId}
                onClose={() => setStopConfirmId(null)}
                onConfirm={() => stopConfirmId && handleStop(stopConfirmId)}
                title="Stop Strategy?"
                message="Are you sure you want to stop this strategy? Position monitoring will cease immediately."
                confirmLabel="Stop Strategy"
                variant="danger"
            />
        </div>
    );
}
