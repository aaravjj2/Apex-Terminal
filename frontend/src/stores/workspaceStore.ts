import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkspaceCategory = 'trading' | 'research' | 'risk' | 'portfolio' | 'news' | 'custom';

export type WidgetType =
  | 'chart' | 'watchlist' | 'orderBook' | 'timeAndSales'
  | 'positions' | 'orders' | 'trades' | 'alerts'
  | 'news' | 'screener' | 'heatmap' | 'calendar'
  | 'portfolio' | 'riskDashboard' | 'optionChain'
  | 'domTrader' | 'tickerTape' | 'fundamentals'
  | 'technicals' | 'correlation' | 'sectorMap'
  | 'orderTicket' | 'accountSummary' | 'pnlChart'
  | 'terminal' | 'custom';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  props: Record<string, unknown>;
  minimized: boolean;
  locked: boolean;
}

export interface PanelConfig {
  id: string;
  widgets: string[];
  activeWidgetId: string | null;
  size: number;
}

export type LayoutDirection = 'horizontal' | 'vertical';

export interface LayoutNode {
  id: string;
  type: 'leaf' | 'split';
  direction?: LayoutDirection;
  children?: string[];
  sizes?: number[];
  panelId?: string;
}

export interface WorkspaceLayout {
  rootId: string;
  nodes: Record<string, LayoutNode>;
  panels: Record<string, PanelConfig>;
  widgets: Record<string, WidgetConfig>;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  category: WorkspaceCategory;
  layout: WorkspaceLayout;
  icon: string;
  color: string;
  isPinned: boolean;
  isDefault: boolean;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

// ─── Default Workspace Templates ────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createWidget(type: WidgetType, title: string, props: Record<string, unknown> = {}): WidgetConfig {
  return { id: generateId('w'), type, title, props, minimized: false, locked: false };
}

function createLeafNode(panelId: string): LayoutNode {
  return { id: generateId('ln'), type: 'leaf', panelId };
}

function createSplitNode(direction: LayoutDirection, children: string[], sizes: number[]): LayoutNode {
  return { id: generateId('sn'), type: 'split', direction, children, sizes };
}

function buildTradingWorkspace(): WorkspaceLayout {
  const chartWidget = createWidget('chart', 'Chart', { symbol: 'AAPL', timeframe: '1D' });
  const watchlistWidget = createWidget('watchlist', 'Watchlist');
  const positionsWidget = createWidget('positions', 'Positions');
  const ordersWidget = createWidget('orders', 'Orders');
  const orderTicketWidget = createWidget('orderTicket', 'Order Ticket');
  const timeAndSalesWidget = createWidget('timeAndSales', 'Time & Sales');

  const chartPanel: PanelConfig = { id: generateId('p'), widgets: [chartWidget.id], activeWidgetId: chartWidget.id, size: 60 };
  const rightPanel: PanelConfig = { id: generateId('p'), widgets: [watchlistWidget.id, orderTicketWidget.id], activeWidgetId: watchlistWidget.id, size: 25 };
  const bottomLeftPanel: PanelConfig = { id: generateId('p'), widgets: [positionsWidget.id, ordersWidget.id], activeWidgetId: positionsWidget.id, size: 50 };
  const bottomRightPanel: PanelConfig = { id: generateId('p'), widgets: [timeAndSalesWidget.id], activeWidgetId: timeAndSalesWidget.id, size: 50 };

  const chartLeaf = createLeafNode(chartPanel.id);
  const rightLeaf = createLeafNode(rightPanel.id);
  const bottomLeftLeaf = createLeafNode(bottomLeftPanel.id);
  const bottomRightLeaf = createLeafNode(bottomRightPanel.id);

  const bottomSplit = createSplitNode('horizontal', [bottomLeftLeaf.id, bottomRightLeaf.id], [50, 50]);
  const leftSplit = createSplitNode('vertical', [chartLeaf.id, bottomSplit.id], [65, 35]);
  const root = createSplitNode('horizontal', [leftSplit.id, rightLeaf.id], [75, 25]);

  return {
    rootId: root.id,
    nodes: {
      [root.id]: root, [leftSplit.id]: leftSplit, [bottomSplit.id]: bottomSplit,
      [chartLeaf.id]: chartLeaf, [rightLeaf.id]: rightLeaf,
      [bottomLeftLeaf.id]: bottomLeftLeaf, [bottomRightLeaf.id]: bottomRightLeaf,
    },
    panels: {
      [chartPanel.id]: chartPanel, [rightPanel.id]: rightPanel,
      [bottomLeftPanel.id]: bottomLeftPanel, [bottomRightPanel.id]: bottomRightPanel,
    },
    widgets: {
      [chartWidget.id]: chartWidget, [watchlistWidget.id]: watchlistWidget,
      [positionsWidget.id]: positionsWidget, [ordersWidget.id]: ordersWidget,
      [orderTicketWidget.id]: orderTicketWidget, [timeAndSalesWidget.id]: timeAndSalesWidget,
    },
  };
}

function buildResearchWorkspace(): WorkspaceLayout {
  const chartWidget = createWidget('chart', 'Chart', { symbol: 'SPY', timeframe: '1D' });
  const newsWidget = createWidget('news', 'News Feed');
  const fundamentalsWidget = createWidget('fundamentals', 'Fundamentals');
  const screenerWidget = createWidget('screener', 'Screener');
  const calendarWidget = createWidget('calendar', 'Calendar');

  const chartPanel: PanelConfig = { id: generateId('p'), widgets: [chartWidget.id], activeWidgetId: chartWidget.id, size: 50 };
  const rightTopPanel: PanelConfig = { id: generateId('p'), widgets: [newsWidget.id], activeWidgetId: newsWidget.id, size: 50 };
  const bottomPanel: PanelConfig = { id: generateId('p'), widgets: [fundamentalsWidget.id, screenerWidget.id, calendarWidget.id], activeWidgetId: fundamentalsWidget.id, size: 100 };

  const chartLeaf = createLeafNode(chartPanel.id);
  const newsLeaf = createLeafNode(rightTopPanel.id);
  const bottomLeaf = createLeafNode(bottomPanel.id);

  const topSplit = createSplitNode('horizontal', [chartLeaf.id, newsLeaf.id], [60, 40]);
  const root = createSplitNode('vertical', [topSplit.id, bottomLeaf.id], [65, 35]);

  return {
    rootId: root.id,
    nodes: {
      [root.id]: root, [topSplit.id]: topSplit,
      [chartLeaf.id]: chartLeaf, [newsLeaf.id]: newsLeaf, [bottomLeaf.id]: bottomLeaf,
    },
    panels: {
      [chartPanel.id]: chartPanel, [rightTopPanel.id]: rightTopPanel, [bottomPanel.id]: bottomPanel,
    },
    widgets: {
      [chartWidget.id]: chartWidget, [newsWidget.id]: newsWidget,
      [fundamentalsWidget.id]: fundamentalsWidget, [screenerWidget.id]: screenerWidget,
      [calendarWidget.id]: calendarWidget,
    },
  };
}

function buildPortfolioWorkspace(): WorkspaceLayout {
  const portfolioWidget = createWidget('portfolio', 'Portfolio');
  const pnlWidget = createWidget('pnlChart', 'P&L Chart');
  const positionsWidget = createWidget('positions', 'Positions');
  const riskWidget = createWidget('riskDashboard', 'Risk Dashboard');
  const accountWidget = createWidget('accountSummary', 'Account Summary');

  const topLeftPanel: PanelConfig = { id: generateId('p'), widgets: [portfolioWidget.id], activeWidgetId: portfolioWidget.id, size: 60 };
  const topRightPanel: PanelConfig = { id: generateId('p'), widgets: [pnlWidget.id], activeWidgetId: pnlWidget.id, size: 40 };
  const bottomPanel: PanelConfig = { id: generateId('p'), widgets: [positionsWidget.id, riskWidget.id, accountWidget.id], activeWidgetId: positionsWidget.id, size: 100 };

  const topLeftLeaf = createLeafNode(topLeftPanel.id);
  const topRightLeaf = createLeafNode(topRightPanel.id);
  const bottomLeaf = createLeafNode(bottomPanel.id);

  const topSplit = createSplitNode('horizontal', [topLeftLeaf.id, topRightLeaf.id], [55, 45]);
  const root = createSplitNode('vertical', [topSplit.id, bottomLeaf.id], [60, 40]);

  return {
    rootId: root.id,
    nodes: {
      [root.id]: root, [topSplit.id]: topSplit,
      [topLeftLeaf.id]: topLeftLeaf, [topRightLeaf.id]: topRightLeaf, [bottomLeaf.id]: bottomLeaf,
    },
    panels: {
      [topLeftPanel.id]: topLeftPanel, [topRightPanel.id]: topRightPanel, [bottomPanel.id]: bottomPanel,
    },
    widgets: {
      [portfolioWidget.id]: portfolioWidget, [pnlWidget.id]: pnlWidget,
      [positionsWidget.id]: positionsWidget, [riskWidget.id]: riskWidget,
      [accountWidget.id]: accountWidget,
    },
  };
}

function buildRiskWorkspace(): WorkspaceLayout {
  const riskWidget = createWidget('riskDashboard', 'Risk Overview');
  const correlationWidget = createWidget('correlation', 'Correlation Matrix');
  const positionsWidget = createWidget('positions', 'Positions');
  const heatmapWidget = createWidget('heatmap', 'Market Heatmap');

  const topLeftPanel: PanelConfig = { id: generateId('p'), widgets: [riskWidget.id], activeWidgetId: riskWidget.id, size: 60 };
  const topRightPanel: PanelConfig = { id: generateId('p'), widgets: [correlationWidget.id], activeWidgetId: correlationWidget.id, size: 40 };
  const bottomPanel: PanelConfig = { id: generateId('p'), widgets: [positionsWidget.id, heatmapWidget.id], activeWidgetId: positionsWidget.id, size: 100 };

  const topLeftLeaf = createLeafNode(topLeftPanel.id);
  const topRightLeaf = createLeafNode(topRightPanel.id);
  const bottomLeaf = createLeafNode(bottomPanel.id);

  const topSplit = createSplitNode('horizontal', [topLeftLeaf.id, topRightLeaf.id], [55, 45]);
  const root = createSplitNode('vertical', [topSplit.id, bottomLeaf.id], [60, 40]);

  return {
    rootId: root.id,
    nodes: {
      [root.id]: root, [topSplit.id]: topSplit,
      [topLeftLeaf.id]: topLeftLeaf, [topRightLeaf.id]: topRightLeaf, [bottomLeaf.id]: bottomLeaf,
    },
    panels: {
      [topLeftPanel.id]: topLeftPanel, [topRightPanel.id]: topRightPanel, [bottomPanel.id]: bottomPanel,
    },
    widgets: {
      [riskWidget.id]: riskWidget, [correlationWidget.id]: correlationWidget,
      [positionsWidget.id]: positionsWidget, [heatmapWidget.id]: heatmapWidget,
    },
  };
}

const WORKSPACE_COLORS: Record<WorkspaceCategory, string> = {
  trading: '#2962FF', research: '#00C853', risk: '#FF1744',
  portfolio: '#D500F9', news: '#FF6D00', custom: '#00B8D4',
};

function createBuiltInWorkspace(name: string, category: WorkspaceCategory, layout: WorkspaceLayout, icon: string): Workspace {
  const now = Date.now();
  return {
    id: generateId('ws'),
    name,
    description: `${category} workspace`,
    category,
    layout,
    icon,
    color: WORKSPACE_COLORS[category],
    isPinned: true,
    isDefault: category === 'trading',
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  };
}

// ─── Store State ────────────────────────────────────────────────────────────

interface WorkspaceStoreState {
  workspaces: Record<string, Workspace>;
  workspaceOrder: string[];
  activeWorkspaceId: string | null;
  previousWorkspaceId: string | null;
  recentWorkspaceIds: string[];
  maxRecent: number;
  isDirty: boolean;
}

interface WorkspaceStoreActions {
  createWorkspace: (name: string, category?: WorkspaceCategory) => string;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  updateDescription: (id: string, description: string) => void;
  duplicateWorkspace: (id: string) => string | null;
  setWorkspaceCategory: (id: string, category: WorkspaceCategory) => void;
  setWorkspaceColor: (id: string, color: string) => void;
  setWorkspaceIcon: (id: string, icon: string) => void;

  switchWorkspace: (id: string) => void;
  switchToPrevious: () => void;
  pinWorkspace: (id: string) => void;
  unpinWorkspace: (id: string) => void;
  reorderWorkspaces: (order: string[]) => void;
  setDefaultWorkspace: (id: string) => void;

  addWidget: (panelId: string, widgetType: WidgetType, title: string, props?: Record<string, unknown>) => string | null;
  removeWidget: (widgetId: string) => void;
  moveWidget: (widgetId: string, fromPanelId: string, toPanelId: string) => void;
  updateWidgetProps: (widgetId: string, props: Record<string, unknown>) => void;
  toggleWidgetMinimized: (widgetId: string) => void;
  toggleWidgetLocked: (widgetId: string) => void;
  setActivePanelWidget: (panelId: string, widgetId: string) => void;

  splitPanel: (panelId: string, direction: LayoutDirection, newWidgetType: WidgetType, newWidgetTitle: string) => void;
  resizePanel: (nodeId: string, sizes: number[]) => void;
  removePanel: (panelId: string) => void;

  saveLayout: () => void;
  loadLayout: (layoutJson: string) => boolean;

  exportWorkspace: (id: string) => string | null;
  importWorkspace: (json: string) => string | null;

  resetWorkspace: (id: string) => void;
  markDirty: () => void;
  markClean: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const tradingWS = createBuiltInWorkspace('Trading', 'trading', buildTradingWorkspace(), 'trending-up');
const researchWS = createBuiltInWorkspace('Research', 'research', buildResearchWorkspace(), 'search');
const portfolioWS = createBuiltInWorkspace('Portfolio', 'portfolio', buildPortfolioWorkspace(), 'briefcase');
const riskWS = createBuiltInWorkspace('Risk', 'risk', buildRiskWorkspace(), 'shield');

export const useWorkspaceStore = create<WorkspaceStoreState & WorkspaceStoreActions>()(
  persist(
    immer((set, get) => ({
      workspaces: {
        [tradingWS.id]: tradingWS,
        [researchWS.id]: researchWS,
        [portfolioWS.id]: portfolioWS,
        [riskWS.id]: riskWS,
      },
      workspaceOrder: [tradingWS.id, researchWS.id, portfolioWS.id, riskWS.id],
      activeWorkspaceId: tradingWS.id,
      previousWorkspaceId: null,
      recentWorkspaceIds: [tradingWS.id],
      maxRecent: 10,
      isDirty: false,

      createWorkspace: (name, category) => {
        const cat = category ?? 'custom';
        const chartWidget = createWidget('chart', 'Chart');
        const panel: PanelConfig = { id: generateId('p'), widgets: [chartWidget.id], activeWidgetId: chartWidget.id, size: 100 };
        const leaf = createLeafNode(panel.id);
        const layout: WorkspaceLayout = {
          rootId: leaf.id,
          nodes: { [leaf.id]: leaf },
          panels: { [panel.id]: panel },
          widgets: { [chartWidget.id]: chartWidget },
        };

        const ws: Workspace = {
          id: generateId('ws'), name, description: '', category: cat, layout,
          icon: 'layout', color: WORKSPACE_COLORS[cat],
          isPinned: false, isDefault: false, isBuiltIn: false,
          createdAt: Date.now(), updatedAt: Date.now(), lastAccessedAt: Date.now(),
        };

        set((s) => {
          s.workspaces[ws.id] = ws;
          s.workspaceOrder.push(ws.id);
          s.activeWorkspaceId = ws.id;
        });
        return ws.id;
      },

      deleteWorkspace: (id) => {
        set((s) => {
          if (s.workspaces[id]?.isBuiltIn) return;
          delete s.workspaces[id];
          s.workspaceOrder = s.workspaceOrder.filter((wid) => wid !== id);
          s.recentWorkspaceIds = s.recentWorkspaceIds.filter((wid) => wid !== id);
          if (s.activeWorkspaceId === id) {
            s.activeWorkspaceId = s.workspaceOrder[0] ?? null;
          }
        });
      },

      renameWorkspace: (id, name) => set((s) => { if (s.workspaces[id]) { s.workspaces[id].name = name; s.workspaces[id].updatedAt = Date.now(); } }),
      updateDescription: (id, description) => set((s) => { if (s.workspaces[id]) { s.workspaces[id].description = description; s.workspaces[id].updatedAt = Date.now(); } }),
      setWorkspaceCategory: (id, category) => set((s) => { if (s.workspaces[id]) s.workspaces[id].category = category; }),
      setWorkspaceColor: (id, color) => set((s) => { if (s.workspaces[id]) s.workspaces[id].color = color; }),
      setWorkspaceIcon: (id, icon) => set((s) => { if (s.workspaces[id]) s.workspaces[id].icon = icon; }),

      duplicateWorkspace: (id) => {
        const source = get().workspaces[id];
        if (!source) return null;
        const ws: Workspace = {
          ...JSON.parse(JSON.stringify(source)),
          id: generateId('ws'),
          name: `${source.name} (copy)`,
          isBuiltIn: false,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastAccessedAt: Date.now(),
        };
        set((s) => {
          s.workspaces[ws.id] = ws;
          s.workspaceOrder.push(ws.id);
        });
        return ws.id;
      },

      switchWorkspace: (id) => {
        set((s) => {
          if (!s.workspaces[id]) return;
          s.previousWorkspaceId = s.activeWorkspaceId;
          s.activeWorkspaceId = id;
          s.workspaces[id].lastAccessedAt = Date.now();
          s.recentWorkspaceIds = [id, ...s.recentWorkspaceIds.filter((wid) => wid !== id)].slice(0, s.maxRecent);
          s.isDirty = false;
        });
      },

      switchToPrevious: () => {
        const { previousWorkspaceId } = get();
        if (previousWorkspaceId) get().switchWorkspace(previousWorkspaceId);
      },

      pinWorkspace: (id) => set((s) => { if (s.workspaces[id]) s.workspaces[id].isPinned = true; }),
      unpinWorkspace: (id) => set((s) => { if (s.workspaces[id]) s.workspaces[id].isPinned = false; }),
      reorderWorkspaces: (order) => set((s) => { s.workspaceOrder = order.filter((id) => s.workspaces[id]); }),

      setDefaultWorkspace: (id) => {
        set((s) => {
          for (const ws of Object.values(s.workspaces)) ws.isDefault = ws.id === id;
        });
      },

      addWidget: (panelId, widgetType, title, props) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return null;

        const widget = createWidget(widgetType, title, props);
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return;
          const panel = ws.layout.panels[panelId];
          if (!panel) return;
          ws.layout.widgets[widget.id] = widget;
          panel.widgets.push(widget.id);
          panel.activeWidgetId = widget.id;
          ws.updatedAt = Date.now();
          s.isDirty = true;
        });
        return widget.id;
      },

      removeWidget: (widgetId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return;
          delete ws.layout.widgets[widgetId];
          for (const panel of Object.values(ws.layout.panels)) {
            const idx = panel.widgets.indexOf(widgetId);
            if (idx !== -1) {
              panel.widgets.splice(idx, 1);
              if (panel.activeWidgetId === widgetId) {
                panel.activeWidgetId = panel.widgets[0] ?? null;
              }
            }
          }
          ws.updatedAt = Date.now();
          s.isDirty = true;
        });
      },

      moveWidget: (widgetId, fromPanelId, toPanelId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return;
          const fromPanel = ws.layout.panels[fromPanelId];
          const toPanel = ws.layout.panels[toPanelId];
          if (!fromPanel || !toPanel) return;
          fromPanel.widgets = fromPanel.widgets.filter((id) => id !== widgetId);
          if (fromPanel.activeWidgetId === widgetId) fromPanel.activeWidgetId = fromPanel.widgets[0] ?? null;
          toPanel.widgets.push(widgetId);
          toPanel.activeWidgetId = widgetId;
          ws.updatedAt = Date.now();
          s.isDirty = true;
        });
      },

      updateWidgetProps: (widgetId, props) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const widget = s.workspaces[wsId]?.layout.widgets[widgetId];
          if (widget) Object.assign(widget.props, props);
          s.isDirty = true;
        });
      },

      toggleWidgetMinimized: (widgetId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const widget = s.workspaces[wsId]?.layout.widgets[widgetId];
          if (widget) widget.minimized = !widget.minimized;
        });
      },

      toggleWidgetLocked: (widgetId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const widget = s.workspaces[wsId]?.layout.widgets[widgetId];
          if (widget) widget.locked = !widget.locked;
        });
      },

      setActivePanelWidget: (panelId, widgetId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const panel = s.workspaces[wsId]?.layout.panels[panelId];
          if (panel && panel.widgets.includes(widgetId)) panel.activeWidgetId = widgetId;
        });
      },

      splitPanel: (panelId, direction, newWidgetType, newWidgetTitle) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return;

          const newWidget = createWidget(newWidgetType, newWidgetTitle);
          const newPanel: PanelConfig = { id: generateId('p'), widgets: [newWidget.id], activeWidgetId: newWidget.id, size: 50 };
          ws.layout.widgets[newWidget.id] = newWidget;
          ws.layout.panels[newPanel.id] = newPanel;

          const existingLeaf = Object.values(ws.layout.nodes).find((n) => n.type === 'leaf' && n.panelId === panelId);
          if (!existingLeaf) return;

          const newLeaf = createLeafNode(newPanel.id);
          ws.layout.nodes[newLeaf.id] = newLeaf;

          const split = createSplitNode(direction, [existingLeaf.id, newLeaf.id], [50, 50]);
          ws.layout.nodes[split.id] = split;

          // Replace existing leaf reference in parent
          for (const node of Object.values(ws.layout.nodes)) {
            if (node.children) {
              const idx = node.children.indexOf(existingLeaf.id);
              if (idx !== -1) node.children[idx] = split.id;
            }
          }
          if (ws.layout.rootId === existingLeaf.id) ws.layout.rootId = split.id;

          ws.updatedAt = Date.now();
          s.isDirty = true;
        });
      },

      resizePanel: (nodeId, sizes) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const node = s.workspaces[wsId]?.layout.nodes[nodeId];
          if (node && node.type === 'split') node.sizes = sizes;
          s.isDirty = true;
        });
      },

      removePanel: (panelId) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        set((s) => {
          const ws = s.workspaces[wsId];
          if (!ws) return;
          const panel = ws.layout.panels[panelId];
          if (!panel) return;

          for (const widgetId of panel.widgets) delete ws.layout.widgets[widgetId];
          delete ws.layout.panels[panelId];

          const leafNode = Object.values(ws.layout.nodes).find((n) => n.type === 'leaf' && n.panelId === panelId);
          if (leafNode) delete ws.layout.nodes[leafNode.id];

          ws.updatedAt = Date.now();
          s.isDirty = true;
        });
      },

      saveLayout: () => set((s) => { s.isDirty = false; if (s.activeWorkspaceId && s.workspaces[s.activeWorkspaceId]) s.workspaces[s.activeWorkspaceId].updatedAt = Date.now(); }),

      loadLayout: (layoutJson) => {
        try {
          const layout = JSON.parse(layoutJson) as WorkspaceLayout;
          if (!layout.rootId || !layout.nodes || !layout.panels || !layout.widgets) return false;
          const wsId = get().activeWorkspaceId;
          if (!wsId) return false;
          set((s) => {
            if (s.workspaces[wsId]) {
              s.workspaces[wsId].layout = layout;
              s.workspaces[wsId].updatedAt = Date.now();
              s.isDirty = false;
            }
          });
          return true;
        } catch {
          return false;
        }
      },

      exportWorkspace: (id) => {
        const ws = get().workspaces[id];
        if (!ws) return null;
        return JSON.stringify({
          name: ws.name, description: ws.description, category: ws.category,
          layout: ws.layout, icon: ws.icon, color: ws.color,
        }, null, 2);
      },

      importWorkspace: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data.name || !data.layout) return null;
          const ws: Workspace = {
            id: generateId('ws'),
            name: data.name,
            description: data.description ?? '',
            category: data.category ?? 'custom',
            layout: data.layout,
            icon: data.icon ?? 'layout',
            color: data.color ?? WORKSPACE_COLORS.custom,
            isPinned: false,
            isDefault: false,
            isBuiltIn: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessedAt: Date.now(),
          };
          set((s) => {
            s.workspaces[ws.id] = ws;
            s.workspaceOrder.push(ws.id);
          });
          return ws.id;
        } catch {
          return null;
        }
      },

      resetWorkspace: (id) => {
        set((s) => {
          const ws = s.workspaces[id];
          if (!ws || !ws.isBuiltIn) return;
          switch (ws.category) {
            case 'trading': ws.layout = buildTradingWorkspace(); break;
            case 'research': ws.layout = buildResearchWorkspace(); break;
            case 'portfolio': ws.layout = buildPortfolioWorkspace(); break;
            case 'risk': ws.layout = buildRiskWorkspace(); break;
          }
          ws.updatedAt = Date.now();
          s.isDirty = false;
        });
      },

      markDirty: () => set((s) => { s.isDirty = true; }),
      markClean: () => set((s) => { s.isDirty = false; }),
    })),
    {
      name: 'tv-workspaces',
      partialize: (state) => ({
        workspaces: state.workspaces,
        workspaceOrder: state.workspaceOrder,
        activeWorkspaceId: state.activeWorkspaceId,
        recentWorkspaceIds: state.recentWorkspaceIds,
      }),
    },
  ),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveWorkspace = (s: WorkspaceStoreState) =>
  s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId] ?? null : null;

export const selectActiveLayout = (s: WorkspaceStoreState) =>
  s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId]?.layout ?? null : null;

export const selectWorkspacesInOrder = (s: WorkspaceStoreState) =>
  s.workspaceOrder.map((id) => s.workspaces[id]).filter(Boolean);

export const selectPinnedWorkspaces = (s: WorkspaceStoreState) =>
  s.workspaceOrder.map((id) => s.workspaces[id]).filter((ws) => ws?.isPinned);

export const selectRecentWorkspaces = (s: WorkspaceStoreState) =>
  s.recentWorkspaceIds.map((id) => s.workspaces[id]).filter(Boolean);

export const selectWorkspacesByCategory = (category: WorkspaceCategory) => (s: WorkspaceStoreState) =>
  Object.values(s.workspaces).filter((ws) => ws.category === category);

export const selectWidgetsInPanel = (panelId: string) => (s: WorkspaceStoreState) => {
  const layout = s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId]?.layout : null;
  if (!layout) return [];
  const panel = layout.panels[panelId];
  if (!panel) return [];
  return panel.widgets.map((wid) => layout.widgets[wid]).filter(Boolean);
};
