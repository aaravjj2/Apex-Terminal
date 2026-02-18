import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceType, WorkspaceLayout, TilePosition, TileDefinition } from '../core/types';

// ============================================================================
// TILE REGISTRY
// ============================================================================

export const TILE_DEFINITIONS: Record<string, TileDefinition> = {
    // Trading Tiles
    'watchlist': {
        id: 'watchlist',
        name: 'Watchlist',
        category: 'trading',
        description: 'Track your favorite symbols',
        icon: '👁️',
        defaultSize: { w: 1, h: 2 },
        minSize: { w: 1, h: 1 },
        refreshRate: 5000,
    },
    'positions': {
        id: 'positions',
        name: 'Positions',
        category: 'trading',
        description: 'Active positions and P&L',
        icon: '📊',
        defaultSize: { w: 2, h: 1 },
        minSize: { w: 1, h: 1 },
    },
    'orders': {
        id: 'orders',
        name: 'Orders',
        category: 'trading',
        description: 'Pending and filled orders',
        icon: '📝',
        defaultSize: { w: 2, h: 1 },
        minSize: { w: 1, h: 1 },
    },
    'time_sales': {
        id: 'time_sales',
        name: 'Time & Sales',
        category: 'trading',
        description: 'Real-time trade tape',
        icon: '⏱️',
        defaultSize: { w: 1, h: 2 },
        minSize: { w: 1, h: 1 },
        refreshRate: 1000,
    },

    // Analytics Tiles
    'mini_chart': {
        id: 'mini_chart',
        name: 'Mini Chart',
        category: 'analytics',
        description: 'Compact price chart',
        icon: '📈',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
    },
    'heatmap': {
        id: 'heatmap',
        name: 'Market Heatmap',
        category: 'analytics',
        description: 'Sector and stock heatmap',
        icon: '🗺️',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
    },
    'scanner': {
        id: 'scanner',
        name: 'Market Scanner',
        category: 'analytics',
        description: 'Real-time stock screener',
        icon: '🔍',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
    },
    'performance': {
        id: 'performance',
        name: 'Performance',
        category: 'analytics',
        description: 'Portfolio performance metrics',
        icon: '📉',
        defaultSize: { w: 2, h: 1 },
        minSize: { w: 1, h: 1 },
    },

    // Market Tiles
    'news': {
        id: 'news',
        name: 'News Feed',
        category: 'market',
        description: 'Latest market news',
        icon: '📰',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
        refreshRate: 60000,
    },
    'calendar': {
        id: 'calendar',
        name: 'Economic Calendar',
        category: 'market',
        description: 'Economic events calendar',
        icon: '📅',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
    },
    'alerts': {
        id: 'alerts',
        name: 'Alerts',
        category: 'market',
        description: 'Price and indicator alerts',
        icon: '🔔',
        defaultSize: { w: 1, h: 1 },
        minSize: { w: 1, h: 1 },
    },

    // Options Tiles
    'option_chain': {
        id: 'option_chain',
        name: 'Options Chain',
        category: 'options',
        description: 'Full options chain with Greeks',
        icon: '⛓️',
        defaultSize: { w: 3, h: 2 },
        minSize: { w: 2, h: 2 },
        dataEndpoint: '/api/v1/options/chain',
        refreshRate: 10000,
    },
    'greeks': {
        id: 'greeks',
        name: 'Greeks Panel',
        category: 'options',
        description: 'Position Greeks summary',
        icon: '🇬🇷',
        defaultSize: { w: 1, h: 1 },
        minSize: { w: 1, h: 1 },
    },
    'vol_surface': {
        id: 'vol_surface',
        name: 'IV Surface',
        category: 'options',
        description: 'Implied volatility surface',
        icon: '🌊',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 2, h: 2 },
    },

    // Risk Tiles  
    'whale_flow': {
        id: 'whale_flow',
        name: 'Whale Flow Alerts',
        category: 'risk',
        description: 'Real-time large options flow',
        icon: '🐋',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
        dataEndpoint: '/api/v1/whale/alerts',
        refreshRate: 30000,
    },
    'regime': {
        id: 'regime',
        name: 'Market Regime',
        category: 'risk',
        description: 'Current market regime classification',
        icon: '🎯',
        defaultSize: { w: 1, h: 1 },
        minSize: { w: 1, h: 1 },
        dataEndpoint: '/api/v1/analytics/regime',
        refreshRate: 60000,
    },
    'gex_profile': {
        id: 'gex_profile',
        name: 'GEX Profile',
        category: 'risk',
        description: 'Gamma exposure by strike',
        icon: '📊',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
        dataEndpoint: '/api/v1/options/gex',
        refreshRate: 60000,
    },

    // AI Tiles
    'ai_copilot': {
        id: 'ai_copilot',
        name: 'AI Copilot',
        category: 'ai',
        description: 'AI strategy assistant',
        icon: '🤖',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 2 },
    },

    // Journal Tiles
    'trade_journal': {
        id: 'trade_journal',
        name: 'Trade Journal',
        category: 'journal',
        description: 'Trade notes and annotations',
        icon: '📓',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
    },
    'uncertainty_cone': {
        id: 'uncertainty_cone',
        name: 'Uncertainty Cone',
        category: 'analytics',
        description: 'Price forecast with confidence intervals',
        icon: '🔮',
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 2, h: 2 },
    },
};

// Default tiles for dashboard
export const DEFAULT_DASHBOARD_TILES = [
    'watchlist',
    'positions',
    'mini_chart',
    'news'
];

// ============================================================================
// DEFAULT LAYOUTS
// ============================================================================

const DEFAULT_CHART_LAYOUT: WorkspaceLayout = {
    id: 'default-chart',
    name: 'Default Chart',
    type: 'chart',
    tiles: [],
};

const DEFAULT_DASHBOARD_LAYOUT: WorkspaceLayout = {
    id: 'default-dashboard',
    name: 'Default Dashboard',
    type: 'dashboard',
    tiles: [
        { tileId: 'watchlist-1', tileType: 'watchlist', x: 0, y: 0, w: 1, h: 2 },
        { tileId: 'positions-1', tileType: 'positions', x: 1, y: 0, w: 2, h: 1 },
        { tileId: 'mini_chart-1', tileType: 'mini_chart', x: 1, y: 1, w: 2, h: 2 },
        { tileId: 'news-1', tileType: 'news', x: 3, y: 0, w: 1, h: 2 },
    ],
};

// ============================================================================
// WORKSPACE STORE
// ============================================================================

interface WorkspaceState {
    // Active workspace
    activeWorkspace: WorkspaceType;
    setActiveWorkspace: (type: WorkspaceType) => void;

    // Layouts
    layouts: WorkspaceLayout[];
    activeLayoutId: string;
    setActiveLayout: (id: string) => void;
    updateLayout: (id: string, tiles: TilePosition[]) => void;
    createLayout: (name: string, type: WorkspaceType) => string;
    deleteLayout: (id: string) => void;
    duplicateLayout: (id: string, newName: string) => string;

    // Dashboard tiles
    addTile: (layoutId: string, tileType: string, position?: Partial<TilePosition>) => void;
    removeTile: (layoutId: string, tileId: string) => void;
    updateTilePosition: (layoutId: string, tileId: string, position: Partial<TilePosition>) => void;

    // Tile data cache
    tileData: Record<string, { data: unknown; lastUpdated: number; loading: boolean; error?: string }>;
    setTileData: (tileId: string, data: unknown) => void;
    setTileLoading: (tileId: string, loading: boolean) => void;
    setTileError: (tileId: string, error: string) => void;

    // Favorites
    favoriteTiles: string[];
    toggleFavoriteTile: (tileId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            // Active workspace
            activeWorkspace: 'chart',
            setActiveWorkspace: (type) => set({ activeWorkspace: type }),

            // Layouts
            layouts: [DEFAULT_CHART_LAYOUT, DEFAULT_DASHBOARD_LAYOUT],
            activeLayoutId: 'default-chart',

            setActiveLayout: (id) => {
                const layout = get().layouts.find(l => l.id === id);
                if (layout) {
                    set({
                        activeLayoutId: id,
                        activeWorkspace: layout.type,
                    });
                }
            },

            updateLayout: (id, tiles) => {
                set((state) => ({
                    layouts: state.layouts.map(l =>
                        l.id === id ? { ...l, tiles } : l
                    ),
                }));
            },

            createLayout: (name, type) => {
                const id = `layout-${Date.now()}`;
                const newLayout: WorkspaceLayout = {
                    id,
                    name,
                    type,
                    tiles: type === 'dashboard' ? [...DEFAULT_DASHBOARD_LAYOUT.tiles!] : [],
                };
                set((state) => ({
                    layouts: [...state.layouts, newLayout],
                }));
                return id;
            },

            deleteLayout: (id) => {
                if (id === 'default-chart' || id === 'default-dashboard') return;
                set((state) => ({
                    layouts: state.layouts.filter(l => l.id !== id),
                    activeLayoutId: state.activeLayoutId === id ? 'default-chart' : state.activeLayoutId,
                }));
            },

            duplicateLayout: (id, newName) => {
                const layout = get().layouts.find(l => l.id === id);
                if (!layout) return '';
                const newId = `layout-${Date.now()}`;
                const newLayout: WorkspaceLayout = {
                    ...layout,
                    id: newId,
                    name: newName,
                    tiles: layout.tiles ? [...layout.tiles] : [],
                };
                set((state) => ({
                    layouts: [...state.layouts, newLayout],
                }));
                return newId;
            },

            // Dashboard tiles
            addTile: (layoutId, tileType, position) => {
                const definition = TILE_DEFINITIONS[tileType];
                if (!definition) return;

                const newPosition: TilePosition = {
                    tileId: `${tileType}-${Date.now()}`,
                    tileType,
                    x: position?.x ?? 0,
                    y: position?.y ?? 0,
                    w: position?.w ?? definition.defaultSize.w,
                    h: position?.h ?? definition.defaultSize.h,
                };

                set((state) => ({
                    layouts: state.layouts.map(l =>
                        l.id === layoutId
                            ? { ...l, tiles: [...(l.tiles || []), newPosition] }
                            : l
                    ),
                }));
            },

            removeTile: (layoutId, tileId) => {
                set((state) => ({
                    layouts: state.layouts.map(l =>
                        l.id === layoutId
                            ? { ...l, tiles: (l.tiles || []).filter(t => t.tileId !== tileId) }
                            : l
                    ),
                }));
            },

            updateTilePosition: (layoutId, tileId, position) => {
                set((state) => ({
                    layouts: state.layouts.map(l =>
                        l.id === layoutId
                            ? {
                                ...l,
                                tiles: (l.tiles || []).map(t =>
                                    t.tileId === tileId ? { ...t, ...position } : t
                                ),
                            }
                            : l
                    ),
                }));
            },

            // Tile data cache
            tileData: {},
            setTileData: (tileId, data) => {
                set((state) => ({
                    tileData: {
                        ...state.tileData,
                        [tileId]: { data, lastUpdated: Date.now(), loading: false },
                    },
                }));
            },
            setTileLoading: (tileId, loading) => {
                set((state) => ({
                    tileData: {
                        ...state.tileData,
                        [tileId]: { ...state.tileData[tileId], loading },
                    },
                }));
            },
            setTileError: (tileId, error) => {
                set((state) => ({
                    tileData: {
                        ...state.tileData,
                        [tileId]: { ...state.tileData[tileId], loading: false, error },
                    },
                }));
            },

            // Favorites
            favoriteTiles: ['whale-flow', 'gex-profile', 'mini-chart'],
            toggleFavoriteTile: (tileId) => {
                set((state) => ({
                    favoriteTiles: state.favoriteTiles.includes(tileId)
                        ? state.favoriteTiles.filter(id => id !== tileId)
                        : [...state.favoriteTiles, tileId],
                }));
            },
        }),
        {
            name: 'workspace-storage',
            partialize: (state) => ({
                layouts: state.layouts,
                activeLayoutId: state.activeLayoutId,
                favoriteTiles: state.favoriteTiles,
            }),
        }
    )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const useActiveLayout = () => {
    const { layouts, activeLayoutId } = useWorkspaceStore();
    return layouts.find(l => l.id === activeLayoutId) || layouts[0];
};

export const useDashboardTiles = () => {
    const layout = useActiveLayout();
    return layout.tiles || [];
};

export const useTileDefinition = (tileId: string) => TILE_DEFINITIONS[tileId];

export const useAvailableTiles = () => Object.values(TILE_DEFINITIONS);
