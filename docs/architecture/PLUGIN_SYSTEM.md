# Plugin System

> Extensibility architecture for custom indicators, drawing tools, chart types, backtest strategies, and dashboard widgets.

---

## Table of Contents

- [Overview](#overview)
- [Plugin Types](#plugin-types)
- [Plugin Manifest](#plugin-manifest)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Indicator Plugins](#indicator-plugins)
- [Drawing Tool Plugins](#drawing-tool-plugins)
- [Chart Type Plugins](#chart-type-plugins)
- [Strategy Plugins](#strategy-plugins)
- [Widget Plugins](#widget-plugins)
- [Plugin Registry](#plugin-registry)
- [Sandboxing and Security](#sandboxing-and-security)
- [Plugin Marketplace](#plugin-marketplace)

---

## Overview

Apex Terminal's plugin architecture allows users and third-party developers to extend the platform without modifying core code. Plugins register through a typed registry, follow a standard lifecycle (`register → init → destroy`), and are isolated via the permission system and API surface restrictions. The architecture supports five plugin categories covering the platform's primary extension points.

---

## Plugin Types

| Type | Extension Point | Core Module |
|------|----------------|-------------|
| `indicator` | Custom technical indicators on chart | `lib/indicators/` |
| `drawing` | Custom drawing/annotation tools | `lib/drawing/` |
| `chartType` | New chart rendering types | `lib/chartTypes/` |
| `strategy` | Backtest and auto-trade strategies | `lib/backtest/` |
| `widget` | Dashboard panel widgets | `components/bloomberg/` |

---

## Plugin Manifest

Every plugin declares a manifest describing its identity, dependencies, and capabilities:

```typescript
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: 'indicator' | 'drawing' | 'chartType' | 'strategy' | 'widget';
  author: string;
  description: string;
  homepage?: string;
  license?: string;
  minPlatformVersion?: string;
  dependencies?: string[];       // IDs of required plugins
  permissions?: string[];        // requested platform permissions
  config?: PluginConfigSchema;   // user-configurable parameters
}

interface PluginConfigSchema {
  [key: string]: {
    type: 'number' | 'string' | 'boolean' | 'select' | 'color';
    label: string;
    default: unknown;
    options?: { label: string; value: unknown }[];
    min?: number;
    max?: number;
  };
}
```

---

## Plugin Lifecycle

All plugins implement a standard interface:

```typescript
interface Plugin<T = unknown> {
  manifest: PluginManifest;
  init(context: PluginContext): Promise<void>;
  destroy(): void;
  getAPI(): T;
}

interface PluginContext {
  config: Record<string, unknown>;
  logger: PluginLogger;
  events: PluginEventBus;
  storage: PluginStorage;
  permissions: PluginPermissionGate;
  i18n: { t: (key: string) => string };
}
```

Lifecycle stages:

1. **Register** — Plugin manifest is validated (dependency check, version compatibility, permission approval). Added to registry in `pending` state.
2. **Init** — `init(context)` is called with a scoped context. Plugin transitions to `active`. Errors during init move it to `error` state.
3. **Destroy** — `destroy()` is called on unload, locale change requiring re-init, or platform shutdown. Cleans up event subscriptions, timers, and DOM references.

---

## Indicator Plugins

Custom indicators extend the chart overlay system. The indicator API receives OHLCV data and returns computed series:

```typescript
interface IndicatorPlugin extends Plugin<IndicatorAPI> {
  manifest: PluginManifest & { type: 'indicator' };
}

interface IndicatorAPI {
  name: string;
  shortName: string;
  overlay: boolean;                    // render on main chart vs separate pane
  inputs: IndicatorInput[];            // user-configurable params (period, source, etc.)
  outputs: IndicatorOutput[];          // line, histogram, band, cloud
  calculate(data: OHLCVData[]): IndicatorResult;
}

// Example: custom Supertrend indicator
const supertrendPlugin: IndicatorPlugin = {
  manifest: {
    id: 'supertrend',
    name: 'Supertrend',
    version: '1.0.0',
    type: 'indicator',
    author: 'community',
    description: 'ATR-based trend following indicator',
  },
  async init(ctx) {
    ctx.logger.info('Supertrend indicator initialized');
  },
  destroy() {},
  getAPI() {
    return {
      name: 'Supertrend',
      shortName: 'ST',
      overlay: true,
      inputs: [
        { id: 'period', label: 'ATR Period', type: 'number', default: 10 },
        { id: 'multiplier', label: 'Multiplier', type: 'number', default: 3.0 },
      ],
      outputs: [
        { id: 'trend', type: 'line', color: '#26a69a' },
        { id: 'direction', type: 'background', colors: ['#26a69a33', '#ef535033'] },
      ],
      calculate(data) { /* ATR-based trend computation */ },
    };
  },
};
```

Indicator calculations can be offloaded to the `indicatorWorker` Web Worker for large datasets.

---

## Drawing Tool Plugins

Drawing plugins register custom annotation tools in the chart toolbar:

```typescript
interface DrawingToolPlugin extends Plugin<DrawingToolAPI> {
  manifest: PluginManifest & { type: 'drawing' };
}

interface DrawingToolAPI {
  name: string;
  icon: string;                        // SVG string or icon identifier
  category: 'line' | 'shape' | 'measure' | 'custom';
  requiredPoints: number;              // clicks needed to complete drawing
  onStart(point: ChartPoint): DrawingState;
  onMove(state: DrawingState, point: ChartPoint): DrawingState;
  onComplete(state: DrawingState, point: ChartPoint): DrawingState;
  render(state: DrawingState, ctx: CanvasRenderingContext2D): void;
  serialize(state: DrawingState): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): DrawingState;
}
```

Drawings serialize to JSON for workspace persistence via the `workspaceStore`.

---

## Chart Type Plugins

Chart type plugins define entirely new visualization modes alongside built-in types (candlestick, line, area, Heikin-Ashi, Renko, Kagi, Point & Figure):

```typescript
interface ChartTypePlugin extends Plugin<ChartTypeAPI> {
  manifest: PluginManifest & { type: 'chartType' };
}

interface ChartTypeAPI {
  name: string;
  icon: string;
  dataRequirements: ('open' | 'high' | 'low' | 'close' | 'volume')[];
  transform?(data: OHLCVData[]): TransformedData[];
  render(data: TransformedData[], viewport: Viewport, ctx: CanvasRenderingContext2D): void;
  getTooltip(point: TransformedData): TooltipContent;
}
```

---

## Strategy Plugins

Strategy plugins integrate with the backtest engine in `lib/backtest/` and the `backtestWorker`:

```typescript
interface StrategyPlugin extends Plugin<StrategyAPI> {
  manifest: PluginManifest & { type: 'strategy' };
}

interface StrategyAPI {
  name: string;
  description: string;
  parameters: StrategyParam[];
  onBar(bar: OHLCVData, context: StrategyContext): Signal[];
  onInit?(context: StrategyContext): void;
  onComplete?(context: StrategyContext): StrategyReport;
}

interface Signal {
  type: 'buy' | 'sell' | 'close';
  symbol: string;
  quantity: number;
  price?: number;
  reason: string;
}

interface StrategyContext {
  portfolio: { cash: number; positions: Position[] };
  indicators: Record<string, number[]>;
  history: OHLCVData[];
  currentBar: number;
}
```

Strategies are executed bar-by-bar by the backtest engine. The `optimizationWorker` handles parameter grid search across strategy configurations.

---

## Widget Plugins

Widget plugins add custom panels to the Bloomberg-style dashboard layout:

```typescript
interface WidgetPlugin extends Plugin<WidgetAPI> {
  manifest: PluginManifest & { type: 'widget' };
}

interface WidgetAPI {
  name: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  render(container: HTMLElement, config: Record<string, unknown>): void;
  update?(config: Record<string, unknown>): void;
  resize?(width: number, height: number): void;
}
```

Widgets are placed via the workspace layout manager and their configuration persists in `workspaceStore`.

---

## Plugin Registry

The central registry manages all installed plugins:

```typescript
class PluginRegistry {
  private plugins = new Map<string, { plugin: Plugin; state: PluginState }>();

  register(plugin: Plugin): void;
  unregister(pluginId: string): void;
  getPlugin<T>(id: string): Plugin<T> | undefined;
  getPluginsByType(type: PluginManifest['type']): Plugin[];
  isActive(id: string): boolean;

  async initAll(): Promise<void>;
  async destroyAll(): Promise<void>;
}

type PluginState = 'pending' | 'active' | 'error' | 'disabled';
```

Dependency resolution runs at registration time — a plugin with unmet dependencies stays in `pending` state until its dependencies are registered and initialized.

---

## Sandboxing and Security

Plugins operate within a restricted context:

- **Permission gating** — Plugins declare required permissions in their manifest. The `PluginPermissionGate` enforces that the current user has sufficient permissions for the plugin to activate.
- **Scoped storage** — Each plugin gets a namespaced `PluginStorage` backed by IndexedDB, preventing cross-plugin data access.
- **Event isolation** — The `PluginEventBus` only delivers events the plugin has subscribed to. Plugins cannot emit core platform events.
- **API surface** — Plugins receive a `PluginContext` with curated APIs. Direct access to stores, DOM outside the plugin container, or network APIs is not provided.

---

## Plugin Marketplace

The marketplace concept provides discovery, installation, and updates:

| Feature | Description |
|---------|-------------|
| **Browse** | Search plugins by type, rating, author, compatibility |
| **Install** | One-click install fetches the plugin bundle and registers it |
| **Update** | Version comparison with changelog; auto-update option |
| **Rate & Review** | User ratings and reviews for community plugins |
| **Publish** | Developer portal for submitting and managing plugins |
| **Verify** | Verified badge for plugins passing security review |

Plugin bundles are loaded as ES modules via dynamic `import()` and cached by the service worker for offline use.
