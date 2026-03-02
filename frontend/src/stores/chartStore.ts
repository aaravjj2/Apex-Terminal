import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DrawingType, Drawing } from '../lib/drawing/types';
import type { TimeFrame } from '../lib/marketData/types';

// ─── Chart Types ────────────────────────────────────────────────────────────

export type ChartType =
  | 'candlestick'
  | 'ohlc'
  | 'line'
  | 'area'
  | 'baseline'
  | 'heikinAshi'
  | 'renko'
  | 'kagi'
  | 'pointAndFigure'
  | 'lineBreak'
  | 'hollowCandle'
  | 'range'
  | 'histogram';

export type ChartScale = 'linear' | 'logarithmic' | 'percentage' | 'indexedTo100';

export interface IndicatorConfig {
  id: string;
  name: string;
  type: string;
  params: Record<string, number | string | boolean>;
  visible: boolean;
  overlay: boolean;
  paneIndex: number;
  style: {
    colors: string[];
    lineWidth: number;
    opacity: number;
  };
}

export interface IndicatorPreset {
  id: string;
  name: string;
  indicators: IndicatorConfig[];
  createdAt: number;
}

export interface ChartAnnotation {
  id: string;
  text: string;
  time: number;
  price: number;
  color: string;
  shape: 'circle' | 'diamond' | 'arrow_up' | 'arrow_down' | 'flag';
  size: 'small' | 'medium' | 'large';
}

export interface ComparisonSymbol {
  symbol: string;
  color: string;
  visible: boolean;
  lineWidth: number;
}

export interface ReplayState {
  active: boolean;
  speed: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  paused: boolean;
}

export interface ChartSettings {
  scale: ChartScale;
  autoScale: boolean;
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  showLegend: boolean;
  showWatermark: boolean;
  showCountdown: boolean;
  showHighLow: boolean;
  showOpenClose: boolean;
  showPrePostMarket: boolean;
  showDividends: boolean;
  showEarnings: boolean;
  showSplits: boolean;
  magnet: boolean;
  magnetStrength: number;
  gridColor: string;
  backgroundColor: string;
  textColor: string;
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  volumeUpColor: string;
  volumeDownColor: string;
  crosshairColor: string;
  borderColor: string;
}

export interface ChartTemplate {
  id: string;
  name: string;
  chartType: ChartType;
  timeframe: TimeFrame;
  settings: ChartSettings;
  indicators: IndicatorConfig[];
  createdAt: number;
  isDefault: boolean;
}

export type LayoutConfig =
  | { type: 'single' }
  | { type: 'horizontal-2'; ratio: number }
  | { type: 'vertical-2'; ratio: number }
  | { type: 'grid-4' }
  | { type: 'grid-6'; rows: 2; cols: 3 }
  | { type: 'grid-8'; rows: 2; cols: 4 }
  | { type: 'grid-9'; rows: 3; cols: 3 }
  | { type: 'grid-16'; rows: 4; cols: 4 }
  | { type: 'left-main'; ratio: number }
  | { type: 'top-main'; ratio: number }
  | { type: 'custom'; areas: string };

export interface LinkGroup {
  id: string;
  color: string;
  chartIds: string[];
  syncSymbol: boolean;
  syncTimeframe: boolean;
  syncCrosshair: boolean;
  syncScroll: boolean;
}

export interface ChartPane {
  id: string;
  height: number;
  indicators: string[];
  collapsed: boolean;
}

export interface ChartInstance {
  id: string;
  symbol: string;
  timeframe: TimeFrame;
  chartType: ChartType;
  indicators: IndicatorConfig[];
  drawings: Drawing[];
  annotations: ChartAnnotation[];
  comparisons: ComparisonSymbol[];
  settings: ChartSettings;
  panes: ChartPane[];
  replay: ReplayState;
  linkGroupId: string | null;
  scrollPosition: number;
  visibleRange: { from: number; to: number } | null;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface ChartStoreState {
  charts: Record<string, ChartInstance>;
  chartOrder: string[];
  activeChartId: string | null;
  layout: LayoutConfig;
  linkGroups: Record<string, LinkGroup>;

  selectedDrawingTool: DrawingType | null;
  drawingToolLocked: boolean;

  crosshairSyncEnabled: boolean;
  crosshairPosition: { time: number; price: number } | null;

  templates: ChartTemplate[];
  indicatorPresets: IndicatorPreset[];

  maxCharts: number;
}

// ─── Default Factories ──────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ChartSettings = {
  scale: 'linear',
  autoScale: true,
  showVolume: true,
  showGrid: true,
  showCrosshair: true,
  showLegend: true,
  showWatermark: false,
  showCountdown: true,
  showHighLow: true,
  showOpenClose: false,
  showPrePostMarket: false,
  showDividends: true,
  showEarnings: true,
  showSplits: true,
  magnet: false,
  magnetStrength: 10,
  gridColor: '#1C2030',
  backgroundColor: '#131722',
  textColor: '#D1D4DC',
  upColor: '#26A69A',
  downColor: '#EF5350',
  wickUpColor: '#26A69A',
  wickDownColor: '#EF5350',
  volumeUpColor: 'rgba(38,166,154,0.3)',
  volumeDownColor: 'rgba(239,83,80,0.3)',
  crosshairColor: '#758696',
  borderColor: '#2A2E39',
};

function createChartInstance(id: string, symbol = 'AAPL', timeframe: TimeFrame = '1D' as TimeFrame): ChartInstance {
  return {
    id,
    symbol,
    timeframe,
    chartType: 'candlestick',
    indicators: [],
    drawings: [],
    annotations: [],
    comparisons: [],
    settings: { ...DEFAULT_SETTINGS },
    panes: [{ id: `${id}_main`, height: 70, indicators: [], collapsed: false }],
    replay: { active: false, speed: 1, currentTime: 0, startTime: 0, endTime: 0, paused: true },
    linkGroupId: null,
    scrollPosition: 0,
    visibleRange: null,
  };
}

const LINK_GROUP_COLORS = ['#2962FF', '#FF6D00', '#00C853', '#D500F9', '#FF1744', '#00B8D4'];

// ─── Actions Interface ──────────────────────────────────────────────────────

interface ChartStoreActions {
  addChart: (symbol?: string, timeframe?: TimeFrame) => string | null;
  removeChart: (chartId: string) => void;
  setActiveChart: (chartId: string) => void;
  duplicateChart: (chartId: string) => string | null;

  updateChartSymbol: (chartId: string, symbol: string) => void;
  updateChartTimeframe: (chartId: string, timeframe: TimeFrame) => void;
  updateChartType: (chartId: string, chartType: ChartType) => void;
  updateChartSettings: (chartId: string, settings: Partial<ChartSettings>) => void;
  updateChartScroll: (chartId: string, position: number) => void;
  updateVisibleRange: (chartId: string, from: number, to: number) => void;

  addIndicator: (chartId: string, indicator: Omit<IndicatorConfig, 'id'>) => string;
  removeIndicator: (chartId: string, indicatorId: string) => void;
  updateIndicator: (chartId: string, indicatorId: string, updates: Partial<IndicatorConfig>) => void;
  toggleIndicatorVisibility: (chartId: string, indicatorId: string) => void;

  addDrawing: (chartId: string, drawing: Drawing) => void;
  removeDrawing: (chartId: string, drawingId: string) => void;
  updateDrawing: (chartId: string, drawingId: string, updates: Partial<Drawing>) => void;
  clearDrawings: (chartId: string) => void;

  addAnnotation: (chartId: string, annotation: Omit<ChartAnnotation, 'id'>) => string;
  removeAnnotation: (chartId: string, annotationId: string) => void;

  addComparison: (chartId: string, symbol: string, color: string) => void;
  removeComparison: (chartId: string, symbol: string) => void;
  toggleComparisonVisibility: (chartId: string, symbol: string) => void;

  setSelectedDrawingTool: (tool: DrawingType | null) => void;
  toggleDrawingToolLock: () => void;

  setLayout: (layout: LayoutConfig) => void;
  reorderCharts: (order: string[]) => void;

  createLinkGroup: (chartIds: string[]) => string;
  removeLinkGroup: (groupId: string) => void;
  addChartToLinkGroup: (chartId: string, groupId: string) => void;
  removeChartFromLinkGroup: (chartId: string) => void;
  updateLinkGroupSync: (groupId: string, sync: Partial<Pick<LinkGroup, 'syncSymbol' | 'syncTimeframe' | 'syncCrosshair' | 'syncScroll'>>) => void;

  setCrosshairSync: (enabled: boolean) => void;
  updateCrosshairPosition: (position: { time: number; price: number } | null) => void;

  startReplay: (chartId: string, startTime: number, endTime: number) => void;
  stopReplay: (chartId: string) => void;
  setReplaySpeed: (chartId: string, speed: number) => void;
  toggleReplayPause: (chartId: string) => void;
  advanceReplay: (chartId: string, time: number) => void;

  saveTemplate: (name: string, chartId: string) => string;
  loadTemplate: (chartId: string, templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  setDefaultTemplate: (templateId: string) => void;

  saveIndicatorPreset: (name: string, indicators: IndicatorConfig[]) => string;
  loadIndicatorPreset: (chartId: string, presetId: string) => void;
  deleteIndicatorPreset: (presetId: string) => void;

  addPane: (chartId: string) => string;
  removePane: (chartId: string, paneId: string) => void;
  resizePane: (chartId: string, paneId: string, height: number) => void;
  togglePaneCollapse: (chartId: string, paneId: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const initialChartId = 'chart_1';
const initialChart = createChartInstance(initialChartId);

export const useChartStore = create<ChartStoreState & ChartStoreActions>()(
  immer((set, get) => ({
    charts: { [initialChartId]: initialChart },
    chartOrder: [initialChartId],
    activeChartId: initialChartId,
    layout: { type: 'single' },
    linkGroups: {},
    selectedDrawingTool: null,
    drawingToolLocked: false,
    crosshairSyncEnabled: false,
    crosshairPosition: null,
    templates: [],
    indicatorPresets: [],
    maxCharts: 16,

    addChart: (symbol, timeframe) => {
      const state = get();
      if (state.chartOrder.length >= state.maxCharts) return null;
      const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      set((s) => {
        s.charts[id] = createChartInstance(id, symbol, timeframe);
        s.chartOrder.push(id);
        s.activeChartId = id;
      });
      return id;
    },

    removeChart: (chartId) => {
      set((s) => {
        if (s.chartOrder.length <= 1) return;
        delete s.charts[chartId];
        s.chartOrder = s.chartOrder.filter((id) => id !== chartId);
        if (s.activeChartId === chartId) {
          s.activeChartId = s.chartOrder[0] ?? null;
        }
        for (const group of Object.values(s.linkGroups)) {
          group.chartIds = group.chartIds.filter((id) => id !== chartId);
        }
      });
    },

    setActiveChart: (chartId) => {
      set((s) => {
        if (s.charts[chartId]) s.activeChartId = chartId;
      });
    },

    duplicateChart: (chartId) => {
      const state = get();
      const source = state.charts[chartId];
      if (!source || state.chartOrder.length >= state.maxCharts) return null;
      const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      set((s) => {
        const clone = JSON.parse(JSON.stringify(source)) as ChartInstance;
        clone.id = id;
        clone.linkGroupId = null;
        s.charts[id] = clone;
        const idx = s.chartOrder.indexOf(chartId);
        s.chartOrder.splice(idx + 1, 0, id);
        s.activeChartId = id;
      });
      return id;
    },

    updateChartSymbol: (chartId, symbol) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        chart.symbol = symbol;
        if (chart.linkGroupId) {
          const group = s.linkGroups[chart.linkGroupId];
          if (group?.syncSymbol) {
            for (const linkedId of group.chartIds) {
              if (linkedId !== chartId && s.charts[linkedId]) {
                s.charts[linkedId].symbol = symbol;
              }
            }
          }
        }
      });
    },

    updateChartTimeframe: (chartId, timeframe) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        chart.timeframe = timeframe;
        if (chart.linkGroupId) {
          const group = s.linkGroups[chart.linkGroupId];
          if (group?.syncTimeframe) {
            for (const linkedId of group.chartIds) {
              if (linkedId !== chartId && s.charts[linkedId]) {
                s.charts[linkedId].timeframe = timeframe;
              }
            }
          }
        }
      });
    },

    updateChartType: (chartId, chartType) => {
      set((s) => {
        if (s.charts[chartId]) s.charts[chartId].chartType = chartType;
      });
    },

    updateChartSettings: (chartId, settings) => {
      set((s) => {
        if (s.charts[chartId]) Object.assign(s.charts[chartId].settings, settings);
      });
    },

    updateChartScroll: (chartId, position) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        chart.scrollPosition = position;
        if (chart.linkGroupId) {
          const group = s.linkGroups[chart.linkGroupId];
          if (group?.syncScroll) {
            for (const linkedId of group.chartIds) {
              if (linkedId !== chartId && s.charts[linkedId]) {
                s.charts[linkedId].scrollPosition = position;
              }
            }
          }
        }
      });
    },

    updateVisibleRange: (chartId, from, to) => {
      set((s) => {
        if (s.charts[chartId]) s.charts[chartId].visibleRange = { from, to };
      });
    },

    addIndicator: (chartId, indicator) => {
      const id = `ind_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      set((s) => {
        if (s.charts[chartId]) {
          s.charts[chartId].indicators.push({ ...indicator, id });
        }
      });
      return id;
    },

    removeIndicator: (chartId, indicatorId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) {
          chart.indicators = chart.indicators.filter((i) => i.id !== indicatorId);
          for (const pane of chart.panes) {
            pane.indicators = pane.indicators.filter((id) => id !== indicatorId);
          }
        }
      });
    },

    updateIndicator: (chartId, indicatorId, updates) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const idx = chart.indicators.findIndex((i) => i.id === indicatorId);
        if (idx !== -1) Object.assign(chart.indicators[idx], updates);
      });
    },

    toggleIndicatorVisibility: (chartId, indicatorId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const ind = chart.indicators.find((i) => i.id === indicatorId);
        if (ind) ind.visible = !ind.visible;
      });
    },

    addDrawing: (chartId, drawing) => {
      set((s) => {
        if (s.charts[chartId]) s.charts[chartId].drawings.push(drawing);
      });
    },

    removeDrawing: (chartId, drawingId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) chart.drawings = chart.drawings.filter((d) => d.id !== drawingId);
      });
    },

    updateDrawing: (chartId, drawingId, updates) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const idx = chart.drawings.findIndex((d) => d.id === drawingId);
        if (idx !== -1) Object.assign(chart.drawings[idx], updates);
      });
    },

    clearDrawings: (chartId) => {
      set((s) => {
        if (s.charts[chartId]) s.charts[chartId].drawings = [];
      });
    },

    addAnnotation: (chartId, annotation) => {
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      set((s) => {
        if (s.charts[chartId]) s.charts[chartId].annotations.push({ ...annotation, id });
      });
      return id;
    },

    removeAnnotation: (chartId, annotationId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) chart.annotations = chart.annotations.filter((a) => a.id !== annotationId);
      });
    },

    addComparison: (chartId, symbol, color) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        if (chart.comparisons.some((c) => c.symbol === symbol)) return;
        chart.comparisons.push({ symbol, color, visible: true, lineWidth: 2 });
      });
    },

    removeComparison: (chartId, symbol) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) chart.comparisons = chart.comparisons.filter((c) => c.symbol !== symbol);
      });
    },

    toggleComparisonVisibility: (chartId, symbol) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const comp = chart.comparisons.find((c) => c.symbol === symbol);
        if (comp) comp.visible = !comp.visible;
      });
    },

    setSelectedDrawingTool: (tool) => {
      set((s) => {
        s.selectedDrawingTool = tool;
        if (!tool) s.drawingToolLocked = false;
      });
    },

    toggleDrawingToolLock: () => {
      set((s) => {
        s.drawingToolLocked = !s.drawingToolLocked;
      });
    },

    setLayout: (layout) => {
      set((s) => {
        s.layout = layout;
      });
    },

    reorderCharts: (order) => {
      set((s) => {
        s.chartOrder = order.filter((id) => s.charts[id]);
      });
    },

    createLinkGroup: (chartIds) => {
      const idx = Object.keys(get().linkGroups).length;
      const id = `link_${Date.now()}`;
      set((s) => {
        s.linkGroups[id] = {
          id,
          color: LINK_GROUP_COLORS[idx % LINK_GROUP_COLORS.length],
          chartIds: chartIds.filter((cid) => s.charts[cid]),
          syncSymbol: true,
          syncTimeframe: true,
          syncCrosshair: true,
          syncScroll: false,
        };
        for (const cid of chartIds) {
          if (s.charts[cid]) s.charts[cid].linkGroupId = id;
        }
      });
      return id;
    },

    removeLinkGroup: (groupId) => {
      set((s) => {
        const group = s.linkGroups[groupId];
        if (!group) return;
        for (const cid of group.chartIds) {
          if (s.charts[cid]) s.charts[cid].linkGroupId = null;
        }
        delete s.linkGroups[groupId];
      });
    },

    addChartToLinkGroup: (chartId, groupId) => {
      set((s) => {
        const group = s.linkGroups[groupId];
        const chart = s.charts[chartId];
        if (!group || !chart) return;
        if (chart.linkGroupId) {
          const prevGroup = s.linkGroups[chart.linkGroupId];
          if (prevGroup) prevGroup.chartIds = prevGroup.chartIds.filter((id) => id !== chartId);
        }
        group.chartIds.push(chartId);
        chart.linkGroupId = groupId;
      });
    },

    removeChartFromLinkGroup: (chartId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart || !chart.linkGroupId) return;
        const group = s.linkGroups[chart.linkGroupId];
        if (group) group.chartIds = group.chartIds.filter((id) => id !== chartId);
        chart.linkGroupId = null;
      });
    },

    updateLinkGroupSync: (groupId, sync) => {
      set((s) => {
        const group = s.linkGroups[groupId];
        if (group) Object.assign(group, sync);
      });
    },

    setCrosshairSync: (enabled) => {
      set((s) => {
        s.crosshairSyncEnabled = enabled;
      });
    },

    updateCrosshairPosition: (position) => {
      set((s) => {
        s.crosshairPosition = position;
      });
    },

    startReplay: (chartId, startTime, endTime) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) {
          chart.replay = { active: true, speed: 1, currentTime: startTime, startTime, endTime, paused: false };
        }
      });
    },

    stopReplay: (chartId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) {
          chart.replay = { active: false, speed: 1, currentTime: 0, startTime: 0, endTime: 0, paused: true };
        }
      });
    },

    setReplaySpeed: (chartId, speed) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) chart.replay.speed = speed;
      });
    },

    toggleReplayPause: (chartId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart && chart.replay.active) chart.replay.paused = !chart.replay.paused;
      });
    },

    advanceReplay: (chartId, time) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (chart && chart.replay.active) {
          chart.replay.currentTime = Math.min(time, chart.replay.endTime);
          if (chart.replay.currentTime >= chart.replay.endTime) {
            chart.replay.paused = true;
          }
        }
      });
    },

    saveTemplate: (name, chartId) => {
      const chart = get().charts[chartId];
      if (!chart) return '';
      const id = `tmpl_${Date.now()}`;
      set((s) => {
        s.templates.push({
          id,
          name,
          chartType: chart.chartType,
          timeframe: chart.timeframe,
          settings: JSON.parse(JSON.stringify(chart.settings)),
          indicators: JSON.parse(JSON.stringify(chart.indicators)),
          createdAt: Date.now(),
          isDefault: false,
        });
      });
      return id;
    },

    loadTemplate: (chartId, templateId) => {
      set((s) => {
        const chart = s.charts[chartId];
        const template = s.templates.find((t) => t.id === templateId);
        if (!chart || !template) return;
        chart.chartType = template.chartType;
        chart.timeframe = template.timeframe;
        chart.settings = JSON.parse(JSON.stringify(template.settings));
        chart.indicators = JSON.parse(JSON.stringify(template.indicators));
      });
    },

    deleteTemplate: (templateId) => {
      set((s) => {
        s.templates = s.templates.filter((t) => t.id !== templateId);
      });
    },

    setDefaultTemplate: (templateId) => {
      set((s) => {
        for (const t of s.templates) t.isDefault = t.id === templateId;
      });
    },

    saveIndicatorPreset: (name, indicators) => {
      const id = `preset_${Date.now()}`;
      set((s) => {
        s.indicatorPresets.push({
          id,
          name,
          indicators: JSON.parse(JSON.stringify(indicators)),
          createdAt: Date.now(),
        });
      });
      return id;
    },

    loadIndicatorPreset: (chartId, presetId) => {
      set((s) => {
        const chart = s.charts[chartId];
        const preset = s.indicatorPresets.find((p) => p.id === presetId);
        if (!chart || !preset) return;
        chart.indicators = JSON.parse(JSON.stringify(preset.indicators));
      });
    },

    deleteIndicatorPreset: (presetId) => {
      set((s) => {
        s.indicatorPresets = s.indicatorPresets.filter((p) => p.id !== presetId);
      });
    },

    addPane: (chartId) => {
      const id = `pane_${Date.now()}`;
      set((s) => {
        const chart = s.charts[chartId];
        if (chart) chart.panes.push({ id, height: 20, indicators: [], collapsed: false });
      });
      return id;
    },

    removePane: (chartId, paneId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart || chart.panes.length <= 1) return;
        chart.panes = chart.panes.filter((p) => p.id !== paneId);
      });
    },

    resizePane: (chartId, paneId, height) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const pane = chart.panes.find((p) => p.id === paneId);
        if (pane) pane.height = height;
      });
    },

    togglePaneCollapse: (chartId, paneId) => {
      set((s) => {
        const chart = s.charts[chartId];
        if (!chart) return;
        const pane = chart.panes.find((p) => p.id === paneId);
        if (pane) pane.collapsed = !pane.collapsed;
      });
    },
  })),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveChart = (s: ChartStoreState) =>
  s.activeChartId ? s.charts[s.activeChartId] ?? null : null;

export const selectChart = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId] ?? null;

export const selectChartIndicators = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId]?.indicators ?? [];

export const selectChartDrawings = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId]?.drawings ?? [];

export const selectChartComparisons = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId]?.comparisons ?? [];

export const selectChartCount = (s: ChartStoreState) => s.chartOrder.length;

export const selectLinkGroup = (groupId: string) => (s: ChartStoreState) =>
  s.linkGroups[groupId] ?? null;

export const selectChartsInOrder = (s: ChartStoreState) =>
  s.chartOrder.map((id) => s.charts[id]).filter(Boolean);

export const selectReplayState = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId]?.replay ?? null;
