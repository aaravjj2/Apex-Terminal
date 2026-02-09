/**
 * Dashboard View - Bloomberg-style tile-based workspace
 * 
 * Features:
 * - Configurable tile grid layout
 * - Drag-and-drop tile arrangement
 * - Multiple tile types (watchlist, positions, orders, news, etc.)
 * - Real-time data updates
 */

import { useState, useCallback, useMemo } from 'react';
import {
    Plus,
    Maximize2,
    Minimize2,
    X,
    GripVertical,
    LayoutGrid,
    Save,
    RotateCcw
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { useWorkspaceStore, useDashboardTiles, useTileDefinition, TILE_DEFINITIONS, DEFAULT_DASHBOARD_TILES } from '../../../state/workspaceStore';
import type { TilePosition } from '../../../core/types';

// Tile Components - import from barrel
import {
    WatchlistTile,
    PositionsTile,
    OrdersTile,
    NewsTile,
    ChartTile,
    AlertsTile,
    HeatmapTile,
    OptionChainTile,
    GreeksTile,
    VolSurfaceTile,
    PerformanceTile,
    CalendarTile,
    ScannerTile,
    TimeAndSalesTile,
    UncertaintyCone,
} from '../../trading/tiles';

// Tile component mapping
const TILE_COMPONENTS: Record<string, React.ComponentType<TileProps>> = {
    watchlist: WatchlistTile,
    positions: PositionsTile,
    orders: OrdersTile,
    news: NewsTile,
    mini_chart: ChartTile,
    alerts: AlertsTile,
    heatmap: HeatmapTile,
    option_chain: OptionChainTile,
    greeks: GreeksTile,
    vol_surface: VolSurfaceTile,
    performance: PerformanceTile,
    calendar: CalendarTile,
    scanner: ScannerTile,
    time_sales: TimeAndSalesTile,
    uncertainty_cone: UncertaintyCone,
};

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

// Default fallback tile
const DefaultTile = ({ tileId }: TileProps) => {
    const definition = useTileDefinition(tileId.split('-')[0]);
    return (
        <div className="h-full flex items-center justify-center text-text-secondary">
            <div className="text-center">
                <div className="text-3xl mb-2">{definition?.icon || '📊'}</div>
                <div className="text-sm">{definition?.name || 'Unknown Tile'}</div>
                <div className="text-xs text-text-muted mt-1">Coming soon</div>
            </div>
        </div>
    );
};

// Tile wrapper component
interface TileWrapperProps {
    tile: TilePosition;
    onRemove: (id: string) => void;
    onMaximize: (id: string) => void;
    maximizedTile: string | null;
}

function TileWrapper({ tile, onRemove, onMaximize, maximizedTile }: TileWrapperProps) {
    const definition = useTileDefinition(tile.tileType);
    const isMaximized = maximizedTile === tile.tileId;

    const TileComponent = TILE_COMPONENTS[tile.tileType] || DefaultTile;

    if (maximizedTile && !isMaximized) {
        return null;
    }

    return (
        <div
            className={cn(
                "bg-panel-bg border border-border rounded-lg overflow-hidden flex flex-col",
                isMaximized ? "fixed inset-4 z-modal" : ""
            )}
            style={!isMaximized ? {
                gridColumn: `span ${tile.w}`,
                gridRow: `span ${tile.h}`,
            } : undefined}
        >
            {/* Tile Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-element-bg">
                <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-text-muted cursor-grab" />
                    <span className="text-sm font-medium text-text">{definition?.name || tile.tileType}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onMaximize(tile.tileId)}
                        className="p-1 rounded hover:bg-border text-text-secondary hover:text-text transition-colors"
                        title={isMaximized ? "Minimize" : "Maximize"}
                    >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        onClick={() => onRemove(tile.tileId)}
                        className="p-1 rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors"
                        title="Remove tile"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tile Content */}
            <div className="flex-1 overflow-hidden">
                <TileComponent
                    tileId={tile.tileId}
                    onClose={() => onRemove(tile.tileId)}
                    onMaximize={() => onMaximize(tile.tileId)}
                    isMaximized={isMaximized}
                />
            </div>
        </div>
    );
}

// Add Tile Dialog
interface AddTileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (tileType: string) => void;
}

function AddTileDialog({ isOpen, onClose, onAdd }: AddTileDialogProps) {
    const [category, setCategory] = useState<string>('all');

    const categories = useMemo(() => {
        const cats = new Set<string>();
        Object.values(TILE_DEFINITIONS).forEach(def => cats.add(def.category));
        return ['all', ...Array.from(cats)];
    }, []);

    const filteredTiles = useMemo(() => {
        return Object.entries(TILE_DEFINITIONS).filter(([_, def]) =>
            category === 'all' || def.category === category
        );
    }, [category]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-panel-bg border border-border rounded-lg w-[500px] max-h-[80vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-lg font-semibold text-text">Add Tile</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text">
                        <X size={18} />
                    </button>
                </div>

                {/* Category Filter */}
                <div className="flex gap-2 px-4 py-3 border-b border-border overflow-x-auto">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={cn(
                                "px-3 py-1 rounded-full text-sm capitalize whitespace-nowrap",
                                category === cat
                                    ? "bg-brand text-white"
                                    : "bg-element-bg text-text-secondary hover:text-text"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Tile Grid */}
                <div className="p-4 grid grid-cols-3 gap-3 overflow-y-auto max-h-[400px]">
                    {filteredTiles.map(([type, def]) => (
                        <button
                            key={type}
                            onClick={() => {
                                onAdd(type);
                                onClose();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-brand hover:bg-brand/5 transition-colors"
                        >
                            <span className="text-2xl">{def.icon}</span>
                            <span className="text-sm font-medium text-text">{def.name}</span>
                            <span className="text-xs text-text-muted text-center">{def.description}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function DashboardView() {
    const [maximizedTile, setMaximizedTile] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const tiles = useDashboardTiles();
    const {
        addTile,
        removeTile,
        activeLayoutId,
        updateLayout,
    } = useWorkspaceStore();

    const handleRemoveTile = useCallback((tileId: string) => {
        removeTile(activeLayoutId, tileId);
        if (maximizedTile === tileId) {
            setMaximizedTile(null);
        }
    }, [removeTile, maximizedTile, activeLayoutId]);

    const handleMaximize = useCallback((id: string) => {
        setMaximizedTile(prev => prev === id ? null : id);
    }, []);

    const handleAddTile = useCallback((tileType: string) => {
        addTile(activeLayoutId, tileType);
    }, [addTile, activeLayoutId]);

    const handleResetLayout = useCallback(() => {
        // Reset to default dashboard layout
        const defaultTiles = DEFAULT_DASHBOARD_TILES.map((tileType, idx) => ({
            tileId: `${tileType}-${Date.now()}-${idx}`,
            tileType,
            x: 0,
            y: 0,
            w: TILE_DEFINITIONS[tileType]?.defaultSize.w ?? 1,
            h: TILE_DEFINITIONS[tileType]?.defaultSize.h ?? 1,
        }));
        updateLayout(activeLayoutId, defaultTiles);
    }, [updateLayout, activeLayoutId]);

    const handleSaveLayout = useCallback(() => {
        // Layout is auto-persisted by Zustand persist middleware
        // This could trigger a toast notification
        console.log('Layout saved');
    }, []);

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Dashboard Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-panel-bg">
                <div className="flex items-center gap-3">
                    <LayoutGrid size={18} className="text-brand" />
                    <h1 className="text-sm font-semibold text-text">Dashboard</h1>
                    <span className="text-xs text-text-muted">{tiles.length} tiles</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddDialog(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand text-white text-sm hover:bg-brand-hover transition-colors"
                    >
                        <Plus size={14} />
                        Add Tile
                    </button>
                    <button
                        onClick={handleSaveLayout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-element-bg text-text-secondary hover:text-text text-sm transition-colors"
                        title="Save Layout"
                    >
                        <Save size={14} />
                    </button>
                    <button
                        onClick={handleResetLayout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-element-bg text-text-secondary hover:text-text text-sm transition-colors"
                        title="Reset Layout"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Tile Grid */}
            <div className="flex-1 p-4 overflow-auto">
                {tiles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                        <LayoutGrid size={48} className="mb-4 opacity-50" />
                        <p className="text-lg mb-2">No tiles configured</p>
                        <p className="text-sm text-text-muted mb-4">Add tiles to build your custom dashboard</p>
                        <button
                            onClick={() => setShowAddDialog(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
                        >
                            <Plus size={16} />
                            Add Your First Tile
                        </button>
                    </div>
                ) : (
                    <div
                        className="grid gap-4 auto-rows-[200px]"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
                    >
                        {tiles.map(tile => (
                            <TileWrapper
                                key={tile.tileId}
                                tile={tile}
                                onRemove={handleRemoveTile}
                                onMaximize={handleMaximize}
                                maximizedTile={maximizedTile}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Tile Dialog */}
            <AddTileDialog
                isOpen={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                onAdd={handleAddTile}
            />
        </div>
    );
}
