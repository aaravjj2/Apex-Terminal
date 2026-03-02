import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  createContext,
  useContext,
} from 'react';
import {
  Maximize2,
  Minimize2,
  Plus,
  X,
  Link,
  Unlink,
  Settings,
  Grid,
  MoreVertical,
  Save,
  FolderOpen,
  Copy,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LayoutPreset =
  | '1'
  | '2x1'
  | '1x2'
  | '2x2'
  | '3x1'
  | '2x3'
  | '3x3'
  | '4x4';

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  timeframe: string;
  linkGroup: number | null;
  settings: Record<string, unknown>;
}

export interface CrosshairPosition {
  x: number;
  y: number;
  timestamp: number;
  price: number;
  sourceId: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  preset: LayoutPreset;
  panes: ChartPaneConfig[];
  timestamp: number;
}

export interface MultiChartLayoutProps {
  defaultPreset?: LayoutPreset;
  defaultSymbol?: string;
  defaultTimeframe?: string;
  savedLayouts?: SavedLayout[];
  onSaveLayout?: (layout: SavedLayout) => void;
  onLoadLayout?: (id: string) => void;
  onSymbolChange?: (paneId: string, symbol: string) => void;
  onTimeframeChange?: (paneId: string, timeframe: string) => void;
  renderChart?: (
    pane: ChartPaneConfig,
    crosshair: CrosshairPosition | null
  ) => React.ReactNode;
  className?: string;
}

interface CrosshairCtx {
  position: CrosshairPosition | null;
  setCrosshair: (pos: CrosshairPosition | null) => void;
}

const CrosshairContext = createContext<CrosshairCtx>({
  position: null,
  setCrosshair: () => {},
});

export const useSyncedCrosshair = () => useContext(CrosshairContext);

// ─── Layout Definitions ──────────────────────────────────────────────────────

const LAYOUT_GRIDS: Record<LayoutPreset, { rows: number; cols: number }> = {
  '1': { rows: 1, cols: 1 },
  '2x1': { rows: 1, cols: 2 },
  '1x2': { rows: 2, cols: 1 },
  '2x2': { rows: 2, cols: 2 },
  '3x1': { rows: 1, cols: 3 },
  '2x3': { rows: 3, cols: 2 },
  '3x3': { rows: 3, cols: 3 },
  '4x4': { rows: 4, cols: 4 },
};

const LINK_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultPane(
  symbol: string,
  timeframe: string
): ChartPaneConfig {
  return {
    id: generatePaneId(),
    symbol,
    timeframe,
    linkGroup: null,
    settings: {},
  };
}

// ─── Layout Selector ─────────────────────────────────────────────────────────

const LayoutSelector: React.FC<{
  current: LayoutPreset;
  onSelect: (preset: LayoutPreset) => void;
}> = ({ current, onSelect }) => {
  const [open, setOpen] = useState(false);

  const presets: { key: LayoutPreset; label: string; grid: string }[] = [
    { key: '1', label: '1×1', grid: '1/1' },
    { key: '2x1', label: '2×1', grid: '2/1' },
    { key: '1x2', label: '1×2', grid: '1/2' },
    { key: '2x2', label: '2×2', grid: '2/2' },
    { key: '3x1', label: '3×1', grid: '3/1' },
    { key: '2x3', label: '2×3', grid: '2/3' },
    { key: '3x3', label: '3×3', grid: '3/3' },
    { key: '4x4', label: '4×4', grid: '4/4' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded
          bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
        title="Change layout"
      >
        <Grid size={14} />
        <span>{presets.find((p) => p.key === current)?.label}</span>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-neutral-900 border border-neutral-700
            rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 min-w-[180px]"
        >
          {presets.map((p) => {
            const { rows, cols } = LAYOUT_GRIDS[p.key];
            return (
              <button
                key={p.key}
                onClick={() => {
                  onSelect(p.key);
                  setOpen(false);
                }}
                className={`p-2 rounded flex flex-col items-center gap-1 transition-colors ${
                  current === p.key
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-neutral-800 text-neutral-400'
                }`}
                title={p.label}
              >
                <div
                  className="grid gap-0.5 w-8 h-8"
                  style={{
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  }}
                >
                  {Array.from({ length: rows * cols }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-[1px] ${
                        current === p.key
                          ? 'bg-blue-300'
                          : 'bg-neutral-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px]">{p.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  pane: ChartPaneConfig;
  onClose: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMaximize: () => void;
  onResetSettings: () => void;
  onCycleLinkGroup: () => void;
}

const PaneContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  pane,
  onClose,
  onDuplicate,
  onRemove,
  onMaximize,
  onResetSettings,
  onCycleLinkGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Maximize', icon: Maximize2, action: onMaximize },
    { label: 'Duplicate', icon: Copy, action: onDuplicate },
    {
      label: `Link Group: ${pane.linkGroup !== null ? LINK_COLORS[pane.linkGroup] ? `#${pane.linkGroup + 1}` : 'None' : 'None'}`,
      icon: Link,
      action: onCycleLinkGroup,
    },
    { label: 'Reset Settings', icon: Settings, action: onResetSettings },
    { label: 'Remove', icon: X, action: onRemove, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl
        py-1 min-w-[180px] text-sm"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
            'danger' in item && item.danger
              ? 'text-red-400 hover:bg-red-900/30'
              : 'text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <item.icon size={14} />
          {item.label}
        </button>
      ))}
    </div>
  );
};

// ─── Pane Header ─────────────────────────────────────────────────────────────

interface PaneHeaderProps {
  pane: ChartPaneConfig;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onRemove: () => void;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onCycleLinkGroup: () => void;
  totalPanes: number;
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];

const PaneHeader: React.FC<PaneHeaderProps> = ({
  pane,
  isMaximized,
  onToggleMaximize,
  onRemove,
  onSymbolChange,
  onTimeframeChange,
  onContextMenu,
  onCycleLinkGroup,
  totalPanes,
}) => {
  const [editingSymbol, setEditingSymbol] = useState(false);
  const [symbolInput, setSymbolInput] = useState(pane.symbol);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSymbol) inputRef.current?.focus();
  }, [editingSymbol]);

  const commitSymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed && trimmed !== pane.symbol) {
      onSymbolChange(trimmed);
    } else {
      setSymbolInput(pane.symbol);
    }
    setEditingSymbol(false);
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 bg-neutral-900/80 border-b border-neutral-800
        text-xs select-none shrink-0"
    >
      {pane.linkGroup !== null && (
        <button
          onClick={onCycleLinkGroup}
          className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-125"
          style={{ backgroundColor: LINK_COLORS[pane.linkGroup % LINK_COLORS.length] }}
          title={`Link group ${pane.linkGroup + 1}`}
        />
      )}

      {editingSymbol ? (
        <input
          ref={inputRef}
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          onBlur={commitSymbol}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSymbol();
            if (e.key === 'Escape') {
              setSymbolInput(pane.symbol);
              setEditingSymbol(false);
            }
          }}
          className="w-20 bg-neutral-800 text-white px-1 py-0.5 rounded border border-blue-500
            outline-none text-xs font-medium"
        />
      ) : (
        <button
          onClick={() => setEditingSymbol(true)}
          className="font-semibold text-white hover:text-blue-400 transition-colors"
        >
          {pane.symbol}
        </button>
      )}

      <div className="flex items-center gap-0.5 ml-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              pane.timeframe === tf
                ? 'bg-blue-600 text-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        {pane.linkGroup === null ? (
          <button
            onClick={onCycleLinkGroup}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            title="Link chart"
          >
            <Unlink size={12} />
          </button>
        ) : (
          <button
            onClick={onCycleLinkGroup}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-300"
            title="Change/remove link group"
          >
            <Link size={12} />
          </button>
        )}

        <button
          onClick={onToggleMaximize}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>

        {totalPanes > 1 && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-900/40 text-neutral-500 hover:text-red-400"
            title="Remove chart"
          >
            <X size={12} />
          </button>
        )}

        <button
          onClick={onContextMenu}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          title="More options"
        >
          <MoreVertical size={12} />
        </button>
      </div>
    </div>
  );
};

// ─── Resizable Divider ───────────────────────────────────────────────────────

const ResizeDivider: React.FC<{
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}> = ({ direction, onResize }) => {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const current =
          direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = current - lastPos.current;
        lastPos.current = current;
        onResize(delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [direction, onResize]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`shrink-0 bg-neutral-800 hover:bg-blue-600 transition-colors z-10 ${
        direction === 'horizontal'
          ? 'w-1 cursor-col-resize hover:w-1.5'
          : 'h-1 cursor-row-resize hover:h-1.5'
      }`}
    />
  );
};

// ─── Default Chart Placeholder ───────────────────────────────────────────────

const DefaultChartContent: React.FC<{
  pane: ChartPaneConfig;
  crosshair: CrosshairPosition | null;
}> = ({ pane, crosshair }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
    <div className="text-4xl font-bold text-neutral-700">{pane.symbol}</div>
    <div className="text-sm">{pane.timeframe}</div>
    {crosshair && crosshair.sourceId !== pane.id && (
      <div className="text-xs text-blue-400 mt-2">
        Crosshair: {crosshair.price.toFixed(2)} @ {new Date(crosshair.timestamp).toLocaleTimeString()}
      </div>
    )}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const MultiChartLayout: React.FC<MultiChartLayoutProps> = ({
  defaultPreset = '2x2',
  defaultSymbol = 'AAPL',
  defaultTimeframe = '1D',
  savedLayouts = [],
  onSaveLayout,
  onLoadLayout,
  onSymbolChange,
  onTimeframeChange,
  renderChart,
  className = '',
}) => {
  const [preset, setPreset] = useState<LayoutPreset>(defaultPreset);
  const { rows, cols } = LAYOUT_GRIDS[preset];
  const totalSlots = rows * cols;

  const [panes, setPanes] = useState<ChartPaneConfig[]>(() =>
    Array.from({ length: totalSlots }, () =>
      createDefaultPane(defaultSymbol, defaultTimeframe)
    )
  );

  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairPosition | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    paneId: string;
  } | null>(null);
  const [colSizes, setColSizes] = useState<number[]>(() =>
    Array(cols).fill(100 / cols)
  );
  const [rowSizes, setRowSizes] = useState<number[]>(() =>
    Array(rows).fill(100 / rows)
  );
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const handlePresetChange = useCallback(
    (newPreset: LayoutPreset) => {
      const { rows: r, cols: c } = LAYOUT_GRIDS[newPreset];
      const newTotal = r * c;
      setPreset(newPreset);
      setColSizes(Array(c).fill(100 / c));
      setRowSizes(Array(r).fill(100 / r));
      setMaximizedId(null);

      setPanes((prev) => {
        if (prev.length >= newTotal) return prev.slice(0, newTotal);
        const extra = Array.from({ length: newTotal - prev.length }, () =>
          createDefaultPane(defaultSymbol, defaultTimeframe)
        );
        return [...prev, ...extra];
      });
    },
    [defaultSymbol, defaultTimeframe]
  );

  const updatePane = useCallback(
    (id: string, patch: Partial<ChartPaneConfig>) => {
      setPanes((prev) => {
        const updated = prev.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        );

        const target = updated.find((p) => p.id === id);
        if (!target || target.linkGroup === null) return updated;

        return updated.map((p) => {
          if (p.id === id || p.linkGroup !== target.linkGroup) return p;
          const linked: Partial<ChartPaneConfig> = {};
          if (patch.symbol !== undefined) linked.symbol = patch.symbol;
          if (patch.timeframe !== undefined) linked.timeframe = patch.timeframe;
          return { ...p, ...linked };
        });
      });
    },
    []
  );

  const handleSymbolChange = useCallback(
    (paneId: string, symbol: string) => {
      updatePane(paneId, { symbol });
      onSymbolChange?.(paneId, symbol);
    },
    [updatePane, onSymbolChange]
  );

  const handleTimeframeChange = useCallback(
    (paneId: string, timeframe: string) => {
      updatePane(paneId, { timeframe });
      onTimeframeChange?.(paneId, timeframe);
    },
    [updatePane, onTimeframeChange]
  );

  const handleRemovePane = useCallback(
    (id: string) => {
      setPanes((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((p) => p.id !== id);
      });
      if (maximizedId === id) setMaximizedId(null);
    },
    [maximizedId]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      setPanes((prev) => {
        const source = prev.find((p) => p.id === id);
        if (!source) return prev;
        return [
          ...prev,
          { ...source, id: generatePaneId(), linkGroup: null },
        ];
      });
    },
    []
  );

  const handleCycleLinkGroup = useCallback((id: string) => {
    setPanes((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next =
          p.linkGroup === null
            ? 0
            : p.linkGroup >= LINK_COLORS.length - 1
              ? null
              : p.linkGroup + 1;
        return { ...p, linkGroup: next };
      })
    );
  }, []);

  const handleSaveLayout = useCallback(() => {
    if (!saveName.trim() || !onSaveLayout) return;
    const layout: SavedLayout = {
      id: `layout-${Date.now()}`,
      name: saveName.trim(),
      preset,
      panes: panes.map((p) => ({ ...p })),
      timestamp: Date.now(),
    };
    onSaveLayout(layout);
    setShowSaveDialog(false);
    setSaveName('');
  }, [saveName, preset, panes, onSaveLayout]);

  const handleColResize = useCallback(
    (colIndex: number, delta: number) => {
      if (!containerRef.current) return;
      const totalWidth = containerRef.current.clientWidth;
      const pctDelta = (delta / totalWidth) * 100;
      setColSizes((prev) => {
        const next = [...prev];
        const minSize = 10;
        next[colIndex] = Math.max(minSize, next[colIndex] + pctDelta);
        next[colIndex + 1] = Math.max(minSize, next[colIndex + 1] - pctDelta);
        return next;
      });
    },
    []
  );

  const handleRowResize = useCallback(
    (rowIndex: number, delta: number) => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.clientHeight;
      const pctDelta = (delta / totalHeight) * 100;
      setRowSizes((prev) => {
        const next = [...prev];
        const minSize = 10;
        next[rowIndex] = Math.max(minSize, next[rowIndex] + pctDelta);
        next[rowIndex + 1] = Math.max(minSize, next[rowIndex + 1] - pctDelta);
        return next;
      });
    },
    []
  );

  const crosshairCtx = useMemo(
    () => ({ position: crosshair, setCrosshair }),
    [crosshair]
  );

  const visiblePanes = maximizedId
    ? panes.filter((p) => p.id === maximizedId)
    : panes.slice(0, totalSlots);

  const renderChartFn = renderChart ?? ((p, c) => <DefaultChartContent pane={p} crosshair={c} />);

  return (
    <CrosshairContext.Provider value={crosshairCtx}>
      <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800
            shrink-0"
        >
          <LayoutSelector current={preset} onSelect={handlePresetChange} />

          <button
            onClick={() =>
              setPanes((prev) => [
                ...prev,
                createDefaultPane(defaultSymbol, defaultTimeframe),
              ])
            }
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-800
              hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Add chart pane"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>

          {maximizedId && (
            <button
              onClick={() => setMaximizedId(null)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600
                hover:bg-blue-500 text-white transition-colors"
            >
              <Minimize2 size={12} />
              <span>Restore</span>
            </button>
          )}

          <div className="flex-1" />

          {onSaveLayout && (
            <div className="relative">
              <button
                onClick={() => setShowSaveDialog(!showSaveDialog)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-800
                  hover:bg-neutral-700 text-neutral-300 transition-colors"
              >
                <Save size={12} />
                <span>Save</span>
              </button>
              {showSaveDialog && (
                <div
                  className="absolute top-full right-0 mt-1 z-50 bg-neutral-900 border
                    border-neutral-700 rounded-lg shadow-xl p-3 min-w-[200px]"
                >
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Layout name..."
                    className="w-full bg-neutral-800 text-white px-2 py-1 rounded text-xs
                      border border-neutral-700 outline-none focus:border-blue-500 mb-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveLayout()}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveLayout}
                    className="w-full px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500
                      text-white transition-colors"
                  >
                    Save Layout
                  </button>
                </div>
              )}
            </div>
          )}

          {savedLayouts.length > 0 && onLoadLayout && (
            <div className="relative group">
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-800
                  hover:bg-neutral-700 text-neutral-300 transition-colors"
              >
                <FolderOpen size={12} />
                <span>Load</span>
              </button>
              <div
                className="absolute top-full right-0 mt-1 z-50 bg-neutral-900 border border-neutral-700
                  rounded-lg shadow-xl py-1 min-w-[160px] hidden group-hover:block"
              >
                {savedLayouts.map((sl) => (
                  <button
                    key={sl.id}
                    onClick={() => onLoadLayout(sl.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-300
                      hover:bg-neutral-800 transition-colors"
                  >
                    {sl.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart Grid */}
        <div ref={containerRef} className="flex-1 overflow-hidden">
          {maximizedId ? (
            <div className="w-full h-full flex flex-col">
              {visiblePanes.map((pane) => (
                <div key={pane.id} className="flex-1 flex flex-col min-h-0">
                  <PaneHeader
                    pane={pane}
                    isMaximized
                    onToggleMaximize={() => setMaximizedId(null)}
                    onRemove={() => handleRemovePane(pane.id)}
                    onSymbolChange={(s) => handleSymbolChange(pane.id, s)}
                    onTimeframeChange={(tf) => handleTimeframeChange(pane.id, tf)}
                    onContextMenu={(e) =>
                      setContextMenu({ x: e.clientX, y: e.clientY, paneId: pane.id })
                    }
                    onCycleLinkGroup={() => handleCycleLinkGroup(pane.id)}
                    totalPanes={panes.length}
                  />
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {renderChartFn(pane, crosshair)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {Array.from({ length: rows }).map((_, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  <div
                    className="flex min-h-0"
                    style={{ height: `${rowSizes[rowIdx]}%` }}
                  >
                    {Array.from({ length: cols }).map((_, colIdx) => {
                      const paneIdx = rowIdx * cols + colIdx;
                      const pane = visiblePanes[paneIdx];
                      if (!pane) return null;
                      return (
                        <React.Fragment key={pane.id}>
                          <div
                            className="flex flex-col min-w-0 border-r border-neutral-800 last:border-r-0"
                            style={{ width: `${colSizes[colIdx]}%` }}
                          >
                            <PaneHeader
                              pane={pane}
                              isMaximized={false}
                              onToggleMaximize={() => setMaximizedId(pane.id)}
                              onRemove={() => handleRemovePane(pane.id)}
                              onSymbolChange={(s) => handleSymbolChange(pane.id, s)}
                              onTimeframeChange={(tf) =>
                                handleTimeframeChange(pane.id, tf)
                              }
                              onContextMenu={(e) =>
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  paneId: pane.id,
                                })
                              }
                              onCycleLinkGroup={() => handleCycleLinkGroup(pane.id)}
                              totalPanes={panes.length}
                            />
                            <div className="flex-1 min-h-0 overflow-hidden">
                              {renderChartFn(pane, crosshair)}
                            </div>
                          </div>
                          {colIdx < cols - 1 && (
                            <ResizeDivider
                              direction="horizontal"
                              onResize={(d) => handleColResize(colIdx, d)}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {rowIdx < rows - 1 && (
                    <ResizeDivider
                      direction="vertical"
                      onResize={(d) => handleRowResize(rowIdx, d)}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (() => {
          const pane = panes.find((p) => p.id === contextMenu.paneId);
          if (!pane) return null;
          return (
            <PaneContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              pane={pane}
              onClose={() => setContextMenu(null)}
              onDuplicate={() => handleDuplicate(contextMenu.paneId)}
              onRemove={() => handleRemovePane(contextMenu.paneId)}
              onMaximize={() => setMaximizedId(contextMenu.paneId)}
              onResetSettings={() =>
                updatePane(contextMenu.paneId, { settings: {} })
              }
              onCycleLinkGroup={() => handleCycleLinkGroup(contextMenu.paneId)}
            />
          );
        })()}
      </div>
    </CrosshairContext.Provider>
  );
};

export default MultiChartLayout;
