// Platform Keyboard System - Shortcuts, Sequences & Focus Management

export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyBinding {
  key: string;
  modifiers?: ModifierKey[];
}

export interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  context: ShortcutContext;
  binding: KeyBinding;
  secondaryBinding?: KeyBinding;
  action: () => void;
  enabled?: boolean;
  when?: () => boolean;
}

export type ShortcutCategory =
  | 'navigation' | 'trading' | 'chart' | 'drawing'
  | 'indicators' | 'layout' | 'system' | 'search'
  | 'portfolio' | 'orders' | 'watchlist';

export type ShortcutContext =
  | 'global' | 'chart' | 'orderEntry' | 'portfolio'
  | 'watchlist' | 'screener' | 'modal' | 'panel'
  | 'input' | 'grid' | 'table';

export interface ChordSequence {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  keys: KeyBinding[];
  action: () => void;
  timeout?: number;
}

export interface ShortcutConflict {
  existingId: string;
  newId: string;
  binding: string;
  resolution: 'context' | 'override' | 'error';
}

export interface ShortcutCheatSheetEntry {
  category: ShortcutCategory;
  shortcuts: { id: string; label: string; keys: string; description: string }[];
}

// --- Key Serialization ---

function serializeBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.modifiers?.includes('ctrl')) parts.push('Ctrl');
  if (binding.modifiers?.includes('alt')) parts.push('Alt');
  if (binding.modifiers?.includes('shift')) parts.push('Shift');
  if (binding.modifiers?.includes('meta')) parts.push('Meta');
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
  return parts.join('+');
}

function matchesBinding(e: KeyboardEvent, binding: KeyBinding): boolean {
  const ctrl = binding.modifiers?.includes('ctrl') ?? false;
  const alt = binding.modifiers?.includes('alt') ?? false;
  const shift = binding.modifiers?.includes('shift') ?? false;
  const meta = binding.modifiers?.includes('meta') ?? false;

  if (e.ctrlKey !== ctrl || e.altKey !== alt || e.shiftKey !== shift || e.metaKey !== meta) {
    return false;
  }

  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
  return eventKey === bindingKey;
}

function displayBinding(binding: KeyBinding): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const parts: string[] = [];
  if (binding.modifiers?.includes('ctrl')) parts.push(isMac ? '\u2318' : 'Ctrl');
  if (binding.modifiers?.includes('alt')) parts.push(isMac ? '\u2325' : 'Alt');
  if (binding.modifiers?.includes('shift')) parts.push(isMac ? '\u21E7' : 'Shift');
  if (binding.modifiers?.includes('meta')) parts.push(isMac ? '\u2318' : 'Win');

  const keyMap: Record<string, string> = {
    'ArrowUp': '\u2191', 'ArrowDown': '\u2193', 'ArrowLeft': '\u2190', 'ArrowRight': '\u2192',
    'Enter': '\u23CE', 'Escape': 'Esc', 'Backspace': '\u232B', 'Delete': 'Del',
    'Tab': '\u21B9', ' ': 'Space',
  };
  parts.push(keyMap[binding.key] || (binding.key.length === 1 ? binding.key.toUpperCase() : binding.key));
  return parts.join(isMac ? '' : '+');
}

// --- Input Detection ---

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return (active as HTMLElement).isContentEditable;
}

// --- Shortcut Registry ---

export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutDefinition>();
  private userOverrides = new Map<string, KeyBinding>();
  private contextStack: ShortcutContext[] = ['global'];
  private enabled = true;
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private chordState: { sequence: ChordSequence; step: number; timer: ReturnType<typeof setTimeout> } | null = null;
  private chords: ChordSequence[] = [];
  private viSequenceBuffer: { key: string; time: number }[] = [];
  private viSequences = new Map<string, { action: () => void; label: string; description: string; category: ShortcutCategory }>();
  private viTimeout = 800;
  private paused = false;

  constructor() {
    this.loadOverrides();
  }

  register(def: ShortcutDefinition): void {
    this.shortcuts.set(def.id, def);
  }

  registerMany(defs: ShortcutDefinition[]): void {
    defs.forEach(d => this.register(d));
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  registerChord(chord: ChordSequence): void {
    this.chords.push(chord);
  }

  registerViSequence(keys: string, action: () => void, meta: { label: string; description: string; category: ShortcutCategory }): void {
    this.viSequences.set(keys, { action, ...meta });
  }

  getShortcut(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  getActiveContext(): ShortcutContext {
    return this.contextStack[this.contextStack.length - 1];
  }

  pushContext(context: ShortcutContext): void {
    this.contextStack.push(context);
  }

  popContext(): ShortcutContext | undefined {
    if (this.contextStack.length <= 1) return undefined;
    return this.contextStack.pop();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }

  overrideBinding(shortcutId: string, binding: KeyBinding): void {
    this.userOverrides.set(shortcutId, binding);
    this.persistOverrides();
  }

  resetBinding(shortcutId: string): void {
    this.userOverrides.delete(shortcutId);
    this.persistOverrides();
  }

  resetAllBindings(): void {
    this.userOverrides.clear();
    this.persistOverrides();
  }

  getEffectiveBinding(shortcutId: string): KeyBinding | undefined {
    return this.userOverrides.get(shortcutId) || this.shortcuts.get(shortcutId)?.binding;
  }

  detectConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const bindingMap = new Map<string, ShortcutDefinition[]>();

    this.shortcuts.forEach(def => {
      const binding = this.userOverrides.get(def.id) || def.binding;
      const key = serializeBinding(binding);
      const existing = bindingMap.get(key) || [];
      existing.push(def);
      bindingMap.set(key, existing);
    });

    bindingMap.forEach((defs, binding) => {
      if (defs.length <= 1) return;
      for (let i = 0; i < defs.length; i++) {
        for (let j = i + 1; j < defs.length; j++) {
          const sameContext = defs[i].context === defs[j].context || defs[i].context === 'global' || defs[j].context === 'global';
          conflicts.push({
            existingId: defs[i].id,
            newId: defs[j].id,
            binding,
            resolution: sameContext ? 'error' : 'context',
          });
        }
      }
    });

    return conflicts;
  }

  activate(): void {
    if (this.listener) return;

    this.listener = (e: KeyboardEvent) => {
      if (!this.enabled || this.paused) return;

      if (this.handleChord(e)) return;
      if (this.handleViSequence(e)) return;

      const currentContext = this.getActiveContext();
      const passthrough = isInputFocused() && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (passthrough) return;

      const candidates = Array.from(this.shortcuts.values()).filter(def => {
        if (def.enabled === false) return false;
        if (def.when && !def.when()) return false;
        if (def.context !== 'global' && def.context !== currentContext) return false;
        const binding = this.userOverrides.get(def.id) || def.binding;
        return matchesBinding(e, binding);
      });

      candidates.sort((a, b) => {
        if (a.context === currentContext && b.context !== currentContext) return -1;
        if (b.context === currentContext && a.context !== currentContext) return 1;
        return 0;
      });

      if (candidates.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        candidates[0].action();
      }
    };

    document.addEventListener('keydown', this.listener, true);
  }

  deactivate(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener, true);
      this.listener = null;
    }
  }

  private handleChord(e: KeyboardEvent): boolean {
    if (this.chordState) {
      const chord = this.chordState.sequence;
      const nextStep = this.chordState.step;
      const nextBinding = chord.keys[nextStep];

      if (matchesBinding(e, nextBinding)) {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(this.chordState.timer);

        if (nextStep + 1 >= chord.keys.length) {
          this.chordState = null;
          chord.action();
        } else {
          this.chordState = {
            sequence: chord,
            step: nextStep + 1,
            timer: setTimeout(() => { this.chordState = null; }, chord.timeout || 1500),
          };
        }
        return true;
      }

      clearTimeout(this.chordState.timer);
      this.chordState = null;
      return false;
    }

    for (const chord of this.chords) {
      if (chord.keys.length > 0 && matchesBinding(e, chord.keys[0])) {
        e.preventDefault();
        e.stopPropagation();

        if (chord.keys.length === 1) {
          chord.action();
        } else {
          this.chordState = {
            sequence: chord,
            step: 1,
            timer: setTimeout(() => { this.chordState = null; }, chord.timeout || 1500),
          };
        }
        return true;
      }
    }

    return false;
  }

  private handleViSequence(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.altKey || e.metaKey || isInputFocused()) return false;
    if (e.key.length !== 1) return false;

    const now = Date.now();
    this.viSequenceBuffer = this.viSequenceBuffer.filter(k => now - k.time < this.viTimeout);
    this.viSequenceBuffer.push({ key: e.key, time: now });

    const seq = this.viSequenceBuffer.map(k => k.key).join('');
    const match = this.viSequences.get(seq);
    if (match) {
      e.preventDefault();
      this.viSequenceBuffer = [];
      match.action();
      return true;
    }

    const hasPartial = Array.from(this.viSequences.keys()).some(k => k.startsWith(seq));
    return hasPartial;
  }

  generateCheatSheet(): ShortcutCheatSheetEntry[] {
    const categories = new Map<ShortcutCategory, ShortcutCheatSheetEntry>();

    this.shortcuts.forEach(def => {
      if (def.enabled === false) return;
      if (!categories.has(def.category)) {
        categories.set(def.category, { category: def.category, shortcuts: [] });
      }
      const binding = this.userOverrides.get(def.id) || def.binding;
      categories.get(def.category)!.shortcuts.push({
        id: def.id,
        label: def.label,
        keys: displayBinding(binding),
        description: def.description,
      });
    });

    this.viSequences.forEach((meta, keys) => {
      if (!categories.has(meta.category)) {
        categories.set(meta.category, { category: meta.category, shortcuts: [] });
      }
      categories.get(meta.category)!.shortcuts.push({
        id: `vi-${keys}`,
        label: meta.label,
        keys: keys.split('').join(' → '),
        description: meta.description,
      });
    });

    this.chords.forEach(chord => {
      if (!categories.has(chord.category)) {
        categories.set(chord.category, { category: chord.category, shortcuts: [] });
      }
      categories.get(chord.category)!.shortcuts.push({
        id: chord.id,
        label: chord.label,
        keys: chord.keys.map(displayBinding).join(' '),
        description: chord.description,
      });
    });

    const order: ShortcutCategory[] = [
      'navigation', 'trading', 'chart', 'drawing', 'indicators',
      'portfolio', 'orders', 'watchlist', 'search', 'layout', 'system',
    ];
    return order
      .filter(c => categories.has(c))
      .map(c => categories.get(c)!);
  }

  private persistOverrides(): void {
    try {
      const data: Record<string, KeyBinding> = {};
      this.userOverrides.forEach((v, k) => { data[k] = v; });
      localStorage.setItem('shortcut_overrides', JSON.stringify(data));
    } catch { /* noop */ }
  }

  private loadOverrides(): void {
    try {
      const raw = localStorage.getItem('shortcut_overrides');
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, KeyBinding>;
      Object.entries(data).forEach(([k, v]) => this.userOverrides.set(k, v));
    } catch { /* noop */ }
  }
}

// --- Default Shortcuts Factory ---

export function createDefaultShortcuts(actions: Record<string, () => void>): ShortcutDefinition[] {
  const a = (id: string) => actions[id] || (() => {});

  return [
    { id: 'nav.chart', label: 'Go to Chart', description: 'Navigate to chart view', category: 'navigation', context: 'global', binding: { key: '1', modifiers: ['alt'] }, action: a('nav.chart') },
    { id: 'nav.watchlist', label: 'Go to Watchlist', description: 'Navigate to watchlist', category: 'navigation', context: 'global', binding: { key: '2', modifiers: ['alt'] }, action: a('nav.watchlist') },
    { id: 'nav.portfolio', label: 'Go to Portfolio', description: 'Navigate to portfolio', category: 'navigation', context: 'global', binding: { key: '3', modifiers: ['alt'] }, action: a('nav.portfolio') },
    { id: 'nav.screener', label: 'Go to Screener', description: 'Navigate to screener', category: 'navigation', context: 'global', binding: { key: '4', modifiers: ['alt'] }, action: a('nav.screener') },
    { id: 'nav.orders', label: 'Go to Orders', description: 'Navigate to orders', category: 'navigation', context: 'global', binding: { key: '5', modifiers: ['alt'] }, action: a('nav.orders') },
    { id: 'nav.news', label: 'Go to News', description: 'Navigate to news', category: 'navigation', context: 'global', binding: { key: '6', modifiers: ['alt'] }, action: a('nav.news') },
    { id: 'nav.settings', label: 'Settings', description: 'Open settings', category: 'navigation', context: 'global', binding: { key: ',', modifiers: ['ctrl'] }, action: a('nav.settings') },

    { id: 'search.symbol', label: 'Symbol Search', description: 'Open symbol search', category: 'search', context: 'global', binding: { key: 'k', modifiers: ['ctrl'] }, action: a('search.symbol') },
    { id: 'search.command', label: 'Command Palette', description: 'Open command palette', category: 'search', context: 'global', binding: { key: 'p', modifiers: ['ctrl', 'shift'] }, action: a('search.command') },

    { id: 'trade.buy', label: 'Quick Buy', description: 'Open buy order', category: 'trading', context: 'chart', binding: { key: 'b' }, action: a('trade.buy'), when: () => !isInputFocused() },
    { id: 'trade.sell', label: 'Quick Sell', description: 'Open sell order', category: 'trading', context: 'chart', binding: { key: 's' }, action: a('trade.sell'), when: () => !isInputFocused() },
    { id: 'trade.closeAll', label: 'Close All Positions', description: 'Close all open positions', category: 'trading', context: 'global', binding: { key: 'x', modifiers: ['ctrl', 'shift'] }, action: a('trade.closeAll') },
    { id: 'trade.cancelOrders', label: 'Cancel All Orders', description: 'Cancel all pending orders', category: 'orders', context: 'global', binding: { key: 'z', modifiers: ['ctrl', 'shift'] }, action: a('trade.cancelOrders') },

    { id: 'chart.timeframe.1m', label: '1 Minute', description: 'Switch to 1m timeframe', category: 'chart', context: 'chart', binding: { key: '1' }, action: a('chart.timeframe.1m'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.5m', label: '5 Minutes', description: 'Switch to 5m timeframe', category: 'chart', context: 'chart', binding: { key: '2' }, action: a('chart.timeframe.5m'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.15m', label: '15 Minutes', description: 'Switch to 15m timeframe', category: 'chart', context: 'chart', binding: { key: '3' }, action: a('chart.timeframe.15m'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.1h', label: '1 Hour', description: 'Switch to 1h timeframe', category: 'chart', context: 'chart', binding: { key: '4' }, action: a('chart.timeframe.1h'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.4h', label: '4 Hours', description: 'Switch to 4h timeframe', category: 'chart', context: 'chart', binding: { key: '5' }, action: a('chart.timeframe.4h'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.1d', label: '1 Day', description: 'Switch to daily timeframe', category: 'chart', context: 'chart', binding: { key: '6' }, action: a('chart.timeframe.1d'), when: () => !isInputFocused() },
    { id: 'chart.timeframe.1w', label: '1 Week', description: 'Switch to weekly timeframe', category: 'chart', context: 'chart', binding: { key: '7' }, action: a('chart.timeframe.1w'), when: () => !isInputFocused() },

    { id: 'chart.crosshair', label: 'Toggle Crosshair', description: 'Toggle crosshair mode', category: 'chart', context: 'chart', binding: { key: 'c' }, action: a('chart.crosshair'), when: () => !isInputFocused() },
    { id: 'chart.fullscreen', label: 'Fullscreen', description: 'Toggle fullscreen chart', category: 'chart', context: 'chart', binding: { key: 'f', modifiers: ['alt'] }, action: a('chart.fullscreen') },
    { id: 'chart.zoomIn', label: 'Zoom In', description: 'Zoom in on chart', category: 'chart', context: 'chart', binding: { key: '=', modifiers: ['ctrl'] }, action: a('chart.zoomIn') },
    { id: 'chart.zoomOut', label: 'Zoom Out', description: 'Zoom out on chart', category: 'chart', context: 'chart', binding: { key: '-', modifiers: ['ctrl'] }, action: a('chart.zoomOut') },
    { id: 'chart.resetZoom', label: 'Reset Zoom', description: 'Reset chart zoom', category: 'chart', context: 'chart', binding: { key: '0', modifiers: ['ctrl'] }, action: a('chart.resetZoom') },
    { id: 'chart.scrollLeft', label: 'Scroll Left', description: 'Scroll chart left', category: 'chart', context: 'chart', binding: { key: 'ArrowLeft' }, action: a('chart.scrollLeft'), when: () => !isInputFocused() },
    { id: 'chart.scrollRight', label: 'Scroll Right', description: 'Scroll chart right', category: 'chart', context: 'chart', binding: { key: 'ArrowRight' }, action: a('chart.scrollRight'), when: () => !isInputFocused() },

    { id: 'draw.trendline', label: 'Trend Line', description: 'Draw trend line', category: 'drawing', context: 'chart', binding: { key: 't', modifiers: ['alt'] }, action: a('draw.trendline') },
    { id: 'draw.hline', label: 'Horizontal Line', description: 'Draw horizontal line', category: 'drawing', context: 'chart', binding: { key: 'h', modifiers: ['alt'] }, action: a('draw.hline') },
    { id: 'draw.vline', label: 'Vertical Line', description: 'Draw vertical line', category: 'drawing', context: 'chart', binding: { key: 'v', modifiers: ['alt'] }, action: a('draw.vline') },
    { id: 'draw.fibonacci', label: 'Fibonacci Retracement', description: 'Draw fibonacci levels', category: 'drawing', context: 'chart', binding: { key: 'f', modifiers: ['alt', 'shift'] }, action: a('draw.fibonacci') },
    { id: 'draw.rectangle', label: 'Rectangle', description: 'Draw rectangle', category: 'drawing', context: 'chart', binding: { key: 'r', modifiers: ['alt'] }, action: a('draw.rectangle') },
    { id: 'draw.deleteAll', label: 'Delete All Drawings', description: 'Remove all drawings', category: 'drawing', context: 'chart', binding: { key: 'Delete', modifiers: ['ctrl', 'shift'] }, action: a('draw.deleteAll') },
    { id: 'draw.undo', label: 'Undo Drawing', description: 'Undo last drawing action', category: 'drawing', context: 'chart', binding: { key: 'z', modifiers: ['ctrl'] }, action: a('draw.undo') },
    { id: 'draw.redo', label: 'Redo Drawing', description: 'Redo last drawing action', category: 'drawing', context: 'chart', binding: { key: 'z', modifiers: ['ctrl', 'shift'] }, action: a('draw.redo') },

    { id: 'indicator.add', label: 'Add Indicator', description: 'Open indicator picker', category: 'indicators', context: 'chart', binding: { key: '/', modifiers: [] }, action: a('indicator.add'), when: () => !isInputFocused() },
    { id: 'indicator.removeAll', label: 'Remove All Indicators', description: 'Clear all indicators', category: 'indicators', context: 'chart', binding: { key: 'Backspace', modifiers: ['ctrl', 'shift'] }, action: a('indicator.removeAll') },

    { id: 'layout.toggleSidebar', label: 'Toggle Sidebar', description: 'Show/hide sidebar', category: 'layout', context: 'global', binding: { key: 'b', modifiers: ['ctrl'] }, action: a('layout.toggleSidebar') },
    { id: 'layout.toggleBottomPanel', label: 'Toggle Bottom Panel', description: 'Show/hide bottom panel', category: 'layout', context: 'global', binding: { key: 'j', modifiers: ['ctrl'] }, action: a('layout.toggleBottomPanel') },
    { id: 'layout.resetLayout', label: 'Reset Layout', description: 'Reset to default layout', category: 'layout', context: 'global', binding: { key: 'l', modifiers: ['ctrl', 'shift'] }, action: a('layout.resetLayout') },
    { id: 'layout.splitHorizontal', label: 'Split Horizontal', description: 'Split chart horizontally', category: 'layout', context: 'global', binding: { key: '\\', modifiers: ['ctrl'] }, action: a('layout.splitHorizontal') },

    { id: 'system.help', label: 'Keyboard Shortcuts', description: 'Show keyboard shortcuts', category: 'system', context: 'global', binding: { key: '?', modifiers: ['shift'] }, action: a('system.help'), when: () => !isInputFocused() },
    { id: 'system.toggleTheme', label: 'Toggle Theme', description: 'Switch dark/light theme', category: 'system', context: 'global', binding: { key: 't', modifiers: ['ctrl', 'shift'] }, action: a('system.toggleTheme') },
    { id: 'system.screenshot', label: 'Screenshot', description: 'Take chart screenshot', category: 'system', context: 'chart', binding: { key: 's', modifiers: ['ctrl', 'shift'] }, action: a('system.screenshot') },
    { id: 'system.escape', label: 'Cancel/Close', description: 'Cancel current action or close modal', category: 'system', context: 'global', binding: { key: 'Escape' }, action: a('system.escape') },

    { id: 'watchlist.add', label: 'Add to Watchlist', description: 'Add symbol to watchlist', category: 'watchlist', context: 'chart', binding: { key: 'w', modifiers: ['alt'] }, action: a('watchlist.add') },
    { id: 'watchlist.next', label: 'Next Symbol', description: 'Next watchlist symbol', category: 'watchlist', context: 'global', binding: { key: 'ArrowDown', modifiers: ['alt'] }, action: a('watchlist.next') },
    { id: 'watchlist.prev', label: 'Previous Symbol', description: 'Previous watchlist symbol', category: 'watchlist', context: 'global', binding: { key: 'ArrowUp', modifiers: ['alt'] }, action: a('watchlist.prev') },

    { id: 'portfolio.refresh', label: 'Refresh Portfolio', description: 'Refresh portfolio data', category: 'portfolio', context: 'portfolio', binding: { key: 'r', modifiers: ['ctrl'] }, action: a('portfolio.refresh') },
  ];
}

// --- Default Vi Sequences ---

export function registerDefaultViSequences(registry: ShortcutRegistry, actions: Record<string, () => void>): void {
  const a = (id: string) => actions[id] || (() => {});

  registry.registerViSequence('gd', a('vi.goDashboard'), { label: 'Go to Dashboard', description: 'Navigate to dashboard', category: 'navigation' });
  registry.registerViSequence('gc', a('vi.goChart'), { label: 'Go to Chart', description: 'Navigate to chart', category: 'navigation' });
  registry.registerViSequence('gw', a('vi.goWatchlist'), { label: 'Go to Watchlist', description: 'Navigate to watchlist', category: 'navigation' });
  registry.registerViSequence('gp', a('vi.goPortfolio'), { label: 'Go to Portfolio', description: 'Navigate to portfolio', category: 'navigation' });
  registry.registerViSequence('go', a('vi.goOrders'), { label: 'Go to Orders', description: 'Navigate to orders', category: 'navigation' });
  registry.registerViSequence('gs', a('vi.goScreener'), { label: 'Go to Screener', description: 'Navigate to screener', category: 'navigation' });
  registry.registerViSequence('gn', a('vi.goNews'), { label: 'Go to News', description: 'Navigate to news', category: 'navigation' });
  registry.registerViSequence('dd', a('vi.deleteDrawing'), { label: 'Delete Drawing', description: 'Delete selected drawing', category: 'drawing' });
  registry.registerViSequence('da', a('vi.deleteAllDrawings'), { label: 'Delete All', description: 'Delete all drawings', category: 'drawing' });
  registry.registerViSequence('yy', a('vi.copySymbol'), { label: 'Copy Symbol', description: 'Copy current symbol name', category: 'system' });
  registry.registerViSequence('gg', a('vi.scrollToStart'), { label: 'Scroll to Start', description: 'Scroll chart to beginning', category: 'chart' });
}

// --- Default Chord Sequences ---

export function registerDefaultChords(registry: ShortcutRegistry, actions: Record<string, () => void>): void {
  const a = (id: string) => actions[id] || (() => {});

  registry.registerChord({
    id: 'chord.saveLayout', label: 'Save Layout', description: 'Save current layout',
    category: 'layout', keys: [{ key: 'k', modifiers: ['ctrl'] }, { key: 's', modifiers: ['ctrl'] }],
    action: a('chord.saveLayout'),
  });

  registry.registerChord({
    id: 'chord.loadLayout', label: 'Load Layout', description: 'Load saved layout',
    category: 'layout', keys: [{ key: 'k', modifiers: ['ctrl'] }, { key: 'l', modifiers: ['ctrl'] }],
    action: a('chord.loadLayout'),
  });

  registry.registerChord({
    id: 'chord.newWindow', label: 'New Window', description: 'Open in new window',
    category: 'layout', keys: [{ key: 'k', modifiers: ['ctrl'] }, { key: 'n', modifiers: ['ctrl'] }],
    action: a('chord.newWindow'),
  });

  registry.registerChord({
    id: 'chord.togglePanel', label: 'Toggle Panel', description: 'Toggle specific panel',
    category: 'layout', keys: [{ key: 'k', modifiers: ['ctrl'] }, { key: 'p', modifiers: ['ctrl'] }],
    action: a('chord.togglePanel'),
  });
}

export { serializeBinding, displayBinding, matchesBinding, isInputFocused };
