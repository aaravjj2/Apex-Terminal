// Bloomberg DashboardView — tile-based workspace
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useCallback, useMemo } from 'react';
import React from 'react';
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

const DefaultTile = ({ tileId }: TileProps) => {
  const definition = useTileDefinition(tileId.split('-')[0]);
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{definition?.icon || '📊'}</div>
        <div style={{ color: SUBTLE, fontSize: 10 }}>{definition?.name || 'UNKNOWN TILE'}</div>
        <div style={{ color: SUBTLE, fontSize: 9, marginTop: 2 }}>COMING SOON</div>
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

    if (maximizedTile && !isMaximized) return null;

    const wrapStyle: React.CSSProperties = isMaximized
      ? { position: 'fixed', inset: 16, zIndex: 9000, background: PANEL, border: `1px solid ${AMBER}`, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }
      : { gridColumn: `span ${tile.w}`, gridRow: `span ${tile.h}`, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, minHeight: 0 };

    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: SUBTLE, fontSize: 10, cursor: 'grab' }}>⠿</span>
            <span style={{ color: TEXT, fontSize: 9, fontFamily: MONO, fontWeight: 600, letterSpacing: 0.5 }}>{definition?.name || tile.tileType.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button onClick={() => onMaximize(tile.tileId)} title={isMaximized ? 'Minimize' : 'Maximize'}
              style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 9, padding: '2px 4px', fontFamily: MONO }}
            >{isMaximized ? '⊡' : '⊞'}</button>
            <button onClick={() => onRemove(tile.tileId)} title="Remove tile"
              style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 10, padding: '2px 4px', fontFamily: MONO }}
            >✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TileComponent tileId={tile.tileId} onClose={() => onRemove(tile.tileId)} onMaximize={() => onMaximize(tile.tileId)} isMaximized={isMaximized} />
        </div>
      </div>
    );
}

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

  const catBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', fontFamily: MONO, fontSize: 9, letterSpacing: 0.5, cursor: 'pointer',
    background: active ? AMBER + '22' : 'transparent',
    border: `1px solid ${active ? AMBER : BORDER}`,
    color: active ? AMBER : SUBTLE, borderRadius: 2,
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', fontFamily: MONO }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: PANEL, border: `1px solid ${AMBER}`, borderRadius: 2, width: 540, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: BG, borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ color: AMBER, fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>ADD TILE</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', flexShrink: 0 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={catBtnStyle(category === cat)}>{cat.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, overflowY: 'auto' }}>
          {filteredTiles.map(([type, def]) => (
            <button key={type} onClick={() => { onAdd(type); onClose(); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = AMBER)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >
              <span style={{ fontSize: 22 }}>{def.icon}</span>
              <span style={{ color: TEXT, fontSize: 9, fontWeight: 700 }}>{def.name.toUpperCase()}</span>
              <span style={{ color: SUBTLE, fontSize: 8, textAlign: 'center' }}>{def.description}</span>
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
  const { addTile, removeTile, activeLayoutId, updateLayout } = useWorkspaceStore();

  const handleRemoveTile = useCallback((tileId: string) => {
    removeTile(activeLayoutId, tileId);
    if (maximizedTile === tileId) setMaximizedTile(null);
  }, [removeTile, maximizedTile, activeLayoutId]);

  const handleMaximize = useCallback((id: string) => {
    setMaximizedTile(prev => prev === id ? null : id);
  }, []);

  const handleAddTile = useCallback((tileType: string) => {
    addTile(activeLayoutId, tileType);
  }, [addTile, activeLayoutId]);

  const handleResetLayout = useCallback(() => {
    const defaultTiles = DEFAULT_DASHBOARD_TILES.map((tileType, idx) => ({
      tileId: `${tileType}-${Date.now()}-${idx}`, tileType, x: 0, y: 0,
      w: TILE_DEFINITIONS[tileType]?.defaultSize.w ?? 1,
      h: TILE_DEFINITIONS[tileType]?.defaultSize.h ?? 1,
    }));
    updateLayout(activeLayoutId, defaultTiles);
  }, [updateLayout, activeLayoutId]);

  const handleSaveLayout = useCallback(() => { console.log('Layout saved'); }, []);

  const hdrBtn = (col: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
    fontFamily: MONO, fontSize: 9, letterSpacing: 0.5, cursor: 'pointer',
    background: col + '22', border: `1px solid ${col}`, color: col, borderRadius: 2,
  });

  return (
    <div data-testid="dashboard-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO }}>
      <div data-testid="dashboard-ready" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: AMBER, fontSize: 14 }}>▦</span>
          <div>
            <div data-testid="dashboard-heading" style={{ color: AMBER, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>DASHBOARD</div>
            <div style={{ color: SUBTLE, fontSize: 8 }}>{tiles.length} TILES — CUSTOMIZE YOUR WORKSPACE</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={handleResetLayout} style={hdrBtn(SUBTLE)}>↺ RESET</button>
          <button onClick={handleSaveLayout} style={hdrBtn(GREEN)}>💾 SAVE</button>
          <button onClick={() => setShowAddDialog(true)} style={hdrBtn(AMBER)}>+ ADD TILE</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
        {tiles.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, border: `2px solid ${AMBER}33`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ color: AMBER, fontSize: 28 }}>▦</span>
            </div>
            <div style={{ color: TEXT, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>NO TILES YET</div>
            <div style={{ color: SUBTLE, fontSize: 10, marginBottom: 18, textAlign: 'center', maxWidth: 320 }}>
              ADD TILES TO CUSTOMIZE YOUR DASHBOARD. CHOOSE FROM WATCHLISTS, POSITIONS, CHARTS, AND MORE.
            </div>
            <button onClick={() => setShowAddDialog(true)}
              style={{ background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '7px 20px', cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5 }}>
              + ADD YOUR FIRST TILE
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gridAutoRows: 220 }}>
            {tiles.map(tile => (
              <TileWrapper key={tile.tileId} tile={tile} onRemove={handleRemoveTile} onMaximize={handleMaximize} maximizedTile={maximizedTile} />
            ))}
          </div>
        )}
      </div>
      <AddTileDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={handleAddTile} />
    </div>
  );
}
