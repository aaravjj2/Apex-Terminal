import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type WidgetType = 'Chart' | 'Quote' | 'News' | 'Watchlist' | 'Matrix' | 'Monitor';
type LinkGroup = 'red' | 'green' | 'blue' | 'yellow' | 'none';
type LayoutTemplate = 'Trading' | 'Research' | 'Risk' | 'Portfolio';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  linkGroup: LinkGroup;
  config: Record<string, unknown>;
  isFullscreen: boolean;
}

interface Layout {
  id: string;
  name: string;
  rows: number;
  cols: number;
  widgets: Widget[];
}

interface LaunchpadProps {
  className?: string;
  onWidgetAction?: (widgetId: string, action: string) => void;
}

// ─── Data ───────────────────────────────────────────────────────────────────

const WIDGET_PALETTE: { type: WidgetType; icon: string; description: string }[] = [
  { type: 'Chart', icon: '📈', description: 'Price chart with indicators' },
  { type: 'Quote', icon: '💲', description: 'Real-time quote panel' },
  { type: 'News', icon: '📰', description: 'News feed panel' },
  { type: 'Watchlist', icon: '👁', description: 'Security watchlist' },
  { type: 'Matrix', icon: '🔲', description: 'Correlation matrix' },
  { type: 'Monitor', icon: '📊', description: 'Security monitor grid' },
];

const LINK_COLORS: Record<LinkGroup, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  none: 'bg-[#333]',
};

const LINK_BORDER_COLORS: Record<LinkGroup, string> = {
  red: 'border-red-500/30',
  green: 'border-green-500/30',
  blue: 'border-blue-500/30',
  yellow: 'border-yellow-500/30',
  none: 'border-[#1a1a2e]',
};

let widgetIdCounter = 0;
function newWidgetId() { return `w-${++widgetIdCounter}`; }

function createTemplate(template: LayoutTemplate): Layout {
  const base = { id: `layout-${Date.now()}`, name: template, rows: 3, cols: 4 };
  const templates: Record<LayoutTemplate, Widget[]> = {
    Trading: [
      { id: newWidgetId(), type: 'Chart', title: 'Price Chart', row: 0, col: 0, rowSpan: 2, colSpan: 2, linkGroup: 'red', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Quote', title: 'Quote', row: 0, col: 2, rowSpan: 1, colSpan: 1, linkGroup: 'red', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Monitor', title: 'Monitor', row: 0, col: 3, rowSpan: 2, colSpan: 1, linkGroup: 'none', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'News', title: 'News', row: 1, col: 2, rowSpan: 1, colSpan: 1, linkGroup: 'red', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Watchlist', title: 'Watchlist', row: 2, col: 0, rowSpan: 1, colSpan: 4, linkGroup: 'none', config: {}, isFullscreen: false },
    ],
    Research: [
      { id: newWidgetId(), type: 'Chart', title: 'Chart', row: 0, col: 0, rowSpan: 2, colSpan: 2, linkGroup: 'green', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'News', title: 'Research News', row: 0, col: 2, rowSpan: 2, colSpan: 2, linkGroup: 'green', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Matrix', title: 'Correlation', row: 2, col: 0, rowSpan: 1, colSpan: 2, linkGroup: 'none', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Watchlist', title: 'Universe', row: 2, col: 2, rowSpan: 1, colSpan: 2, linkGroup: 'green', config: {}, isFullscreen: false },
    ],
    Risk: [
      { id: newWidgetId(), type: 'Matrix', title: 'Risk Matrix', row: 0, col: 0, rowSpan: 2, colSpan: 2, linkGroup: 'blue', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Monitor', title: 'Risk Monitor', row: 0, col: 2, rowSpan: 2, colSpan: 2, linkGroup: 'blue', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Chart', title: 'VaR Chart', row: 2, col: 0, rowSpan: 1, colSpan: 2, linkGroup: 'none', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'News', title: 'Risk News', row: 2, col: 2, rowSpan: 1, colSpan: 2, linkGroup: 'none', config: {}, isFullscreen: false },
    ],
    Portfolio: [
      { id: newWidgetId(), type: 'Monitor', title: 'Holdings', row: 0, col: 0, rowSpan: 2, colSpan: 3, linkGroup: 'yellow', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Chart', title: 'Performance', row: 0, col: 3, rowSpan: 1, colSpan: 1, linkGroup: 'yellow', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'Quote', title: 'NAV', row: 1, col: 3, rowSpan: 1, colSpan: 1, linkGroup: 'yellow', config: {}, isFullscreen: false },
      { id: newWidgetId(), type: 'News', title: 'Portfolio News', row: 2, col: 0, rowSpan: 1, colSpan: 4, linkGroup: 'none', config: {}, isFullscreen: false },
    ],
  };
  return { ...base, widgets: templates[template] };
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function WidgetPlaceholder({ widget }: { widget: Widget }) {
  const typeIcons: Record<WidgetType, string> = {
    Chart: '📈', Quote: '💲', News: '📰', Watchlist: '👁', Matrix: '🔲', Monitor: '📊',
  };
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#333] gap-2">
      <span className="text-2xl opacity-50">{typeIcons[widget.type]}</span>
      <span className="text-[10px]">{widget.type.toUpperCase()}</span>
      {widget.linkGroup !== 'none' && (
        <span className="text-[9px] text-[#555]">Linked: {widget.linkGroup}</span>
      )}
    </div>
  );
}

function ConfigPanel({
  widget,
  onUpdate,
  onClose,
}: {
  widget: Widget;
  onUpdate: (w: Widget) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-[#0a0a14]/95 z-50 flex items-center justify-center">
      <div className="bg-[#0f0f1e] border border-[#1a1a2e] rounded p-4 w-72">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#ff9900] text-sm font-bold">CONFIGURE WIDGET</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ff9900] text-xs">✕</button>
        </div>

        <label className="block mb-2">
          <span className="text-[10px] text-[#555]">TITLE</span>
          <input
            value={widget.title}
            onChange={e => onUpdate({ ...widget, title: e.target.value })}
            className="w-full bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-xs px-2 py-1 mt-0.5 rounded outline-none focus:border-[#ff9900]/40"
          />
        </label>

        <label className="block mb-2">
          <span className="text-[10px] text-[#555]">LINK GROUP</span>
          <div className="flex gap-2 mt-1">
            {(Object.keys(LINK_COLORS) as LinkGroup[]).map(lg => (
              <button
                key={lg}
                onClick={() => onUpdate({ ...widget, linkGroup: lg })}
                className={`w-5 h-5 rounded-full border-2 ${LINK_COLORS[lg]} ${
                  widget.linkGroup === lg ? 'border-white' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </label>

        <label className="block mb-2">
          <span className="text-[10px] text-[#555]">COL SPAN</span>
          <input
            type="number" min={1} max={4}
            value={widget.colSpan}
            onChange={e => onUpdate({ ...widget, colSpan: parseInt(e.target.value) || 1 })}
            className="w-full bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-xs px-2 py-1 mt-0.5 rounded outline-none"
          />
        </label>

        <label className="block mb-3">
          <span className="text-[10px] text-[#555]">ROW SPAN</span>
          <input
            type="number" min={1} max={3}
            value={widget.rowSpan}
            onChange={e => onUpdate({ ...widget, rowSpan: parseInt(e.target.value) || 1 })}
            className="w-full bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-xs px-2 py-1 mt-0.5 rounded outline-none"
          />
        </label>

        <button
          onClick={onClose}
          className="w-full py-1.5 bg-[#ff9900]/20 text-[#ff9900] text-xs rounded hover:bg-[#ff9900]/30 transition-colors"
        >DONE</button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Launchpad({ className = '', onWidgetAction }: LaunchpadProps) {
  const [layouts, setLayouts] = useState<Layout[]>([createTemplate('Trading')]);
  const [activeLayoutIdx, setActiveLayoutIdx] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [configWidget, setConfigWidget] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<{ type: WidgetType } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const layout = layouts[activeLayoutIdx];

  const updateLayout = useCallback((updater: (l: Layout) => Layout) => {
    setLayouts(prev => prev.map((l, i) => (i === activeLayoutIdx ? updater(l) : l)));
  }, [activeLayoutIdx]);

  const addWidget = useCallback((type: WidgetType, row = 0, col = 0) => {
    updateLayout(l => ({
      ...l,
      widgets: [...l.widgets, {
        id: newWidgetId(),
        type,
        title: type,
        row,
        col,
        rowSpan: 1,
        colSpan: 1,
        linkGroup: 'none',
        config: {},
        isFullscreen: false,
      }],
    }));
    setShowPalette(false);
  }, [updateLayout]);

  const removeWidget = useCallback((widgetId: string) => {
    updateLayout(l => ({ ...l, widgets: l.widgets.filter(w => w.id !== widgetId) }));
  }, [updateLayout]);

  const updateWidget = useCallback((updated: Widget) => {
    updateLayout(l => ({
      ...l,
      widgets: l.widgets.map(w => (w.id === updated.id ? updated : w)),
    }));
  }, [updateLayout]);

  const toggleFullscreen = useCallback((widgetId: string) => {
    updateLayout(l => ({
      ...l,
      widgets: l.widgets.map(w =>
        w.id === widgetId ? { ...w, isFullscreen: !w.isFullscreen } : w
      ),
    }));
  }, [updateLayout]);

  const saveLayout = useCallback((name: string) => {
    const newLayout = { ...layout, id: `layout-${Date.now()}`, name };
    setLayouts(prev => [...prev, newLayout]);
  }, [layout]);

  const loadTemplate = useCallback((template: LayoutTemplate) => {
    const newLayout = createTemplate(template);
    setLayouts(prev => [...prev, newLayout]);
    setActiveLayoutIdx(layouts.length);
  }, [layouts.length]);

  const handleDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (dragItem) {
      addWidget(dragItem.type, row, col);
      setDragItem(null);
    }
  }, [dragItem, addWidget]);

  const fullscreenWidget = layout.widgets.find(w => w.isFullscreen);

  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gap: '2px',
  }), [layout.rows, layout.cols]);

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full relative ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center gap-3">
          <span className="text-[#ff9900] font-bold text-xs tracking-wider">LAUNCHPAD</span>

          {/* Layout Tabs */}
          <div className="flex gap-1">
            {layouts.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setActiveLayoutIdx(i)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  i === activeLayoutIdx
                    ? 'bg-[#ff9900]/20 text-[#ff9900]'
                    : 'text-[#555] hover:text-[#888]'
                }`}
              >{l.name}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Templates */}
          {(['Trading', 'Research', 'Risk', 'Portfolio'] as LayoutTemplate[]).map(t => (
            <button
              key={t}
              onClick={() => loadTemplate(t)}
              className="text-[10px] text-[#555] hover:text-[#ff9900] transition-colors"
            >{t}</button>
          ))}
          <div className="w-px h-3 bg-[#1a1a2e]" />
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="text-[10px] text-[#ff9900] hover:text-[#ffbb44] transition-colors"
          >+ ADD</button>
          <button
            onClick={() => {
              const name = `Layout ${layouts.length + 1}`;
              saveLayout(name);
            }}
            className="text-[10px] text-[#555] hover:text-[#ff9900] transition-colors"
          >SAVE</button>
          <button
            onClick={() => updateLayout(l => ({ ...l, rows: Math.min(l.rows + 1, 6) }))}
            className="text-[10px] text-[#555] hover:text-[#ff9900]"
          >+ROW</button>
          <button
            onClick={() => updateLayout(l => ({ ...l, cols: Math.min(l.cols + 1, 8) }))}
            className="text-[10px] text-[#555] hover:text-[#ff9900]"
          >+COL</button>
        </div>
      </div>

      {/* Widget Palette */}
      {showPalette && (
        <div className="absolute top-10 right-3 z-40 bg-[#0f0f1e] border border-[#1a1a2e] rounded p-2 w-56 shadow-xl">
          <div className="text-[10px] text-[#555] mb-1 tracking-wider">WIDGET PALETTE</div>
          {WIDGET_PALETTE.map(wp => (
            <button
              key={wp.type}
              draggable
              onDragStart={() => setDragItem({ type: wp.type })}
              onClick={() => addWidget(wp.type)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[#1a1a2e] rounded transition-colors"
            >
              <span className="text-sm">{wp.icon}</span>
              <div>
                <div className="text-[#ff9900] text-xs">{wp.type}</div>
                <div className="text-[#555] text-[9px]">{wp.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Widget */}
      {fullscreenWidget && (
        <div className="flex-1 relative border border-[#1a1a2e]">
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-[#0f0f1e] border-b border-[#1a1a2e] z-10">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${LINK_COLORS[fullscreenWidget.linkGroup]}`} />
              <span className="text-[#ff9900] text-xs font-bold">{fullscreenWidget.title}</span>
            </div>
            <button
              onClick={() => toggleFullscreen(fullscreenWidget.id)}
              className="text-[#555] hover:text-[#ff9900] text-xs"
            >EXIT FS</button>
          </div>
          <div className="pt-7 h-full">
            <WidgetPlaceholder widget={fullscreenWidget} />
          </div>
        </div>
      )}

      {/* Grid */}
      {!fullscreenWidget && (
        <div ref={gridRef} className="flex-1 p-1 min-h-0" style={gridStyle}>
          {layout.widgets.map(widget => (
            <div
              key={widget.id}
              className={`relative border ${LINK_BORDER_COLORS[widget.linkGroup]} bg-[#0a0a14] rounded overflow-hidden group`}
              style={{
                gridRow: `${widget.row + 1} / span ${widget.rowSpan}`,
                gridColumn: `${widget.col + 1} / span ${widget.colSpan}`,
              }}
            >
              {/* Widget Header */}
              <div className="flex items-center justify-between px-2 py-0.5 bg-[#0f0f1e] border-b border-[#1a1a2e] cursor-move">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${LINK_COLORS[widget.linkGroup]}`} />
                  <span className="text-[#ff9900] text-[10px] font-bold truncate">{widget.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setConfigWidget(widget.id)}
                    className="text-[#555] hover:text-[#ff9900] text-[10px]"
                  >⚙</button>
                  <button
                    onClick={() => toggleFullscreen(widget.id)}
                    className="text-[#555] hover:text-[#ff9900] text-[10px]"
                  >⛶</button>
                  <button
                    onClick={() => removeWidget(widget.id)}
                    className="text-[#555] hover:text-[#ff3333] text-[10px]"
                  >✕</button>
                </div>
              </div>

              {/* Widget Content */}
              <div className="h-[calc(100%-24px)]">
                <WidgetPlaceholder widget={widget} />
              </div>
            </div>
          ))}

          {/* Empty Cells for Drop Targets */}
          {Array.from({ length: layout.rows * layout.cols }).map((_, idx) => {
            const row = Math.floor(idx / layout.cols);
            const col = idx % layout.cols;
            const occupied = layout.widgets.some(w =>
              row >= w.row && row < w.row + w.rowSpan &&
              col >= w.col && col < w.col + w.colSpan
            );
            if (occupied) return null;
            return (
              <div
                key={`cell-${row}-${col}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, row, col)}
                className="border border-dashed border-[#1a1a2e]/50 rounded flex items-center justify-center"
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
              >
                <span className="text-[#222] text-[9px]">DROP</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Config Panel Overlay */}
      {configWidget && (
        <ConfigPanel
          widget={layout.widgets.find(w => w.id === configWidget)!}
          onUpdate={updateWidget}
          onClose={() => setConfigWidget(null)}
        />
      )}
    </div>
  );
}
