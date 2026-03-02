// Platform Accessibility Infrastructure - WCAG 2.1 AA Compliance

export interface ContrastResult {
  ratio: number;
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
  aaaLarge: boolean;
}

export interface FocusTrapOptions {
  container: HTMLElement;
  initialFocus?: HTMLElement | string;
  returnFocusTo?: HTMLElement;
  onEscape?: () => void;
  allowOutsideClick?: boolean;
}

export interface LiveRegionOptions {
  politeness: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: string;
  clearAfterMs?: number;
}

export interface SkipLink {
  id: string;
  label: string;
  target: string;
}

export interface HeadingNode {
  level: number;
  text: string;
  element: HTMLElement;
  issues: string[];
}

export interface LandmarkInfo {
  role: string;
  label?: string;
  element: HTMLElement;
}

export type ColorBlindType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

export interface AccessibilityAuditResult {
  passed: boolean;
  violations: AccessibilityViolation[];
  warnings: string[];
  score: number;
}

export interface AccessibilityViolation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element?: string;
  message: string;
  fix: string;
}

// --- Color Contrast ---

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) return [+match[1], +match[2], +match[3]];
  return [0, 0, 0];
}

export function contrastRatio(fg: string, bg: string): ContrastResult {
  const [r1, g1, b1] = parseColor(fg);
  const [r2, g2, b2] = parseColor(bg);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

export function suggestAccessibleColor(
  fg: string,
  bg: string,
  targetRatio = 4.5
): string {
  const [fr, fg_, fb] = parseColor(fg);
  const [br, bg_, bb] = parseColor(bg);
  const bgLum = relativeLuminance(br, bg_, bb);

  for (let step = 0; step <= 255; step++) {
    const factor = bgLum > 0.5 ? -step : step;
    const nr = Math.max(0, Math.min(255, fr + factor));
    const ng = Math.max(0, Math.min(255, fg_ + factor));
    const nb = Math.max(0, Math.min(255, fb + factor));
    const fgLum = relativeLuminance(nr, ng, nb);
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    if (ratio >= targetRatio) {
      return `rgb(${nr}, ${ng}, ${nb})`;
    }
  }
  return fg;
}

// --- Color Blind Simulation ---

const CB_MATRICES: Record<ColorBlindType, number[][]> = {
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

export function simulateColorBlindness(
  r: number, g: number, b: number, type: ColorBlindType
): [number, number, number] {
  const m = CB_MATRICES[type];
  return [
    Math.round(Math.min(255, m[0][0] * r + m[0][1] * g + m[0][2] * b)),
    Math.round(Math.min(255, m[1][0] * r + m[1][1] * g + m[1][2] * b)),
    Math.round(Math.min(255, m[2][0] * r + m[2][1] * g + m[2][2] * b)),
  ];
}

export function colorBlindSafeCheck(
  colors: string[],
  type: ColorBlindType,
  minContrast = 3
): { safe: boolean; conflicts: [string, string][] } {
  const conflicts: [string, string][] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const [r1, g1, b1] = simulateColorBlindness(...parseColor(colors[i]), type);
      const [r2, g2, b2] = simulateColorBlindness(...parseColor(colors[j]), type);
      const l1 = relativeLuminance(r1, g1, b1);
      const l2 = relativeLuminance(r2, g2, b2);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < minContrast) {
        conflicts.push([colors[i], colors[j]]);
      }
    }
  }
  return { safe: conflicts.length === 0, conflicts };
}

// --- Focus Management ---

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable]',
  'details > summary', 'audio[controls]', 'video[controls]',
].join(', ');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => {
      if (el.offsetParent === null && el.getAttribute('tabindex') !== '-1') return false;
      return !el.closest('[aria-hidden="true"]');
    });
}

export class FocusTrap {
  private container: HTMLElement;
  private returnFocusTo: HTMLElement | null;
  private handler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private onEscape?: () => void;
  private active = false;

  constructor(private options: FocusTrapOptions) {
    this.container = options.container;
    this.returnFocusTo = options.returnFocusTo || null;
    this.onEscape = options.onEscape;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.returnFocusTo = this.returnFocusTo || (document.activeElement as HTMLElement);

    const initialTarget = typeof this.options.initialFocus === 'string'
      ? this.container.querySelector<HTMLElement>(this.options.initialFocus)
      : this.options.initialFocus;

    if (initialTarget) {
      initialTarget.focus();
    } else {
      const focusable = getFocusableElements(this.container);
      focusable[0]?.focus();
    }

    this.handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.onEscape) {
        e.preventDefault();
        this.onEscape();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(this.container);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    if (!this.options.allowOutsideClick) {
      this.clickHandler = (e: MouseEvent) => {
        if (!this.container.contains(e.target as Node)) {
          e.stopPropagation();
          e.preventDefault();
        }
      };
      document.addEventListener('click', this.clickHandler, true);
    }

    document.addEventListener('keydown', this.handler);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    if (this.handler) document.removeEventListener('keydown', this.handler);
    if (this.clickHandler) document.removeEventListener('click', this.clickHandler, true);
    this.handler = null;
    this.clickHandler = null;
    this.returnFocusTo?.focus();
  }

  isActive(): boolean {
    return this.active;
  }
}

// --- Roving Tabindex ---

export class RovingTabindex {
  private items: HTMLElement[] = [];
  private currentIndex = 0;
  private orientation: 'horizontal' | 'vertical' | 'grid';
  private columns: number;
  private wrap: boolean;
  private onSelect?: (el: HTMLElement, index: number) => void;

  constructor(options: {
    container: HTMLElement;
    selector: string;
    orientation?: 'horizontal' | 'vertical' | 'grid';
    columns?: number;
    wrap?: boolean;
    onSelect?: (el: HTMLElement, index: number) => void;
  }) {
    this.orientation = options.orientation || 'horizontal';
    this.columns = options.columns || 1;
    this.wrap = options.wrap !== false;
    this.onSelect = options.onSelect;
    this.items = Array.from(options.container.querySelectorAll<HTMLElement>(options.selector));

    this.items.forEach((el, i) => {
      el.setAttribute('tabindex', i === 0 ? '0' : '-1');
      el.addEventListener('keydown', this.handleKeyDown);
      el.addEventListener('focus', () => this.setCurrentIndex(i));
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    let nextIndex = this.currentIndex;
    const { key } = e;

    if (this.orientation === 'grid') {
      if (key === 'ArrowRight') nextIndex += 1;
      else if (key === 'ArrowLeft') nextIndex -= 1;
      else if (key === 'ArrowDown') nextIndex += this.columns;
      else if (key === 'ArrowUp') nextIndex -= this.columns;
      else if (key === 'Home') nextIndex = e.ctrlKey ? 0 : Math.floor(this.currentIndex / this.columns) * this.columns;
      else if (key === 'End') nextIndex = e.ctrlKey ? this.items.length - 1 : Math.min(Math.floor(this.currentIndex / this.columns) * this.columns + this.columns - 1, this.items.length - 1);
      else if (key === 'Enter' || key === ' ') { this.onSelect?.(this.items[this.currentIndex], this.currentIndex); e.preventDefault(); return; }
      else return;
    } else {
      const next = this.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
      const prev = this.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
      if (key === next) nextIndex += 1;
      else if (key === prev) nextIndex -= 1;
      else if (key === 'Home') nextIndex = 0;
      else if (key === 'End') nextIndex = this.items.length - 1;
      else if (key === 'Enter' || key === ' ') { this.onSelect?.(this.items[this.currentIndex], this.currentIndex); e.preventDefault(); return; }
      else return;
    }

    e.preventDefault();
    if (this.wrap) {
      nextIndex = ((nextIndex % this.items.length) + this.items.length) % this.items.length;
    } else {
      nextIndex = Math.max(0, Math.min(this.items.length - 1, nextIndex));
    }

    this.moveTo(nextIndex);
  };

  private setCurrentIndex(index: number): void {
    this.currentIndex = index;
  }

  moveTo(index: number): void {
    this.items[this.currentIndex]?.setAttribute('tabindex', '-1');
    this.currentIndex = index;
    this.items[this.currentIndex]?.setAttribute('tabindex', '0');
    this.items[this.currentIndex]?.focus();
  }

  destroy(): void {
    this.items.forEach(el => el.removeEventListener('keydown', this.handleKeyDown));
  }
}

// --- Live Region Manager ---

export class LiveRegionManager {
  private container: HTMLElement;
  private regions = new Map<string, HTMLElement>();
  private clearTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.container = document.createElement('div');
    this.container.setAttribute('aria-relevant', 'additions text');
    this.container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
    document.body.appendChild(this.container);
  }

  private getOrCreateRegion(id: string, politeness: 'polite' | 'assertive'): HTMLElement {
    const key = `${id}-${politeness}`;
    if (!this.regions.has(key)) {
      const region = document.createElement('div');
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
      region.id = `live-region-${key}`;
      this.container.appendChild(region);
      this.regions.set(key, region);
    }
    return this.regions.get(key)!;
  }

  announce(message: string, options: LiveRegionOptions = { politeness: 'polite' }): void {
    const regionId = options.politeness;
    const region = this.getOrCreateRegion(regionId, options.politeness);

    if (options.atomic !== undefined) region.setAttribute('aria-atomic', String(options.atomic));
    if (options.relevant) region.setAttribute('aria-relevant', options.relevant);

    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = message;
    });

    if (options.clearAfterMs) {
      const existing = this.clearTimers.get(regionId);
      if (existing) clearTimeout(existing);
      this.clearTimers.set(regionId, setTimeout(() => {
        region.textContent = '';
        this.clearTimers.delete(regionId);
      }, options.clearAfterMs));
    }
  }

  announcePolite(message: string, clearAfterMs?: number): void {
    this.announce(message, { politeness: 'polite', clearAfterMs });
  }

  announceAssertive(message: string, clearAfterMs?: number): void {
    this.announce(message, { politeness: 'assertive', clearAfterMs });
  }

  clear(id?: string): void {
    if (id) {
      const region = this.regions.get(id);
      if (region) region.textContent = '';
    } else {
      this.regions.forEach(r => { r.textContent = ''; });
    }
  }

  destroy(): void {
    this.clearTimers.forEach(t => clearTimeout(t));
    this.clearTimers.clear();
    this.container.remove();
    this.regions.clear();
  }
}

// --- Skip Navigation ---

export function createSkipLinks(links: SkipLink[]): HTMLElement {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Skip navigation');
  nav.className = 'skip-nav';
  nav.style.cssText = 'position:absolute;top:0;left:0;z-index:100000;';

  links.forEach(link => {
    const a = document.createElement('a');
    a.href = `#${link.target}`;
    a.textContent = link.label;
    a.className = 'skip-link';
    a.style.cssText = `
      position:absolute;top:-100%;left:0;padding:8px 16px;
      background:#1a1a2e;color:#fff;font-size:14px;font-weight:600;
      text-decoration:none;z-index:100001;border-radius:0 0 4px 0;
      transition:top 0.15s ease;
    `;
    a.addEventListener('focus', () => { a.style.top = '0'; });
    a.addEventListener('blur', () => { a.style.top = '-100%'; });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.target);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.removeAttribute('tabindex');
      }
    });
    nav.appendChild(a);
  });

  return nav;
}

// --- ARIA Helpers ---

export const ariaHelpers = {
  dialog(el: HTMLElement, options: { labelledBy?: string; describedBy?: string; modal?: boolean }): void {
    el.setAttribute('role', 'dialog');
    if (options.modal !== false) el.setAttribute('aria-modal', 'true');
    if (options.labelledBy) el.setAttribute('aria-labelledby', options.labelledBy);
    if (options.describedBy) el.setAttribute('aria-describedby', options.describedBy);
  },

  menu(container: HTMLElement, items: HTMLElement[]): void {
    container.setAttribute('role', 'menu');
    items.forEach(item => {
      item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '-1');
    });
    if (items[0]) items[0].setAttribute('tabindex', '0');
  },

  tabs(
    tablist: HTMLElement,
    tabs: HTMLElement[],
    panels: HTMLElement[],
    activeIndex: number
  ): void {
    tablist.setAttribute('role', 'tablist');
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === activeIndex));
      tab.setAttribute('tabindex', i === activeIndex ? '0' : '-1');
      if (panels[i]) {
        const panelId = panels[i].id || `tabpanel-${i}`;
        panels[i].id = panelId;
        tab.setAttribute('aria-controls', panelId);
      }
    });
    panels.forEach((panel, i) => {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('tabindex', '0');
      if (tabs[i]) {
        const tabId = tabs[i].id || `tab-${i}`;
        tabs[i].id = tabId;
        panel.setAttribute('aria-labelledby', tabId);
      }
      panel.hidden = i !== activeIndex;
    });
  },

  tree(container: HTMLElement, items: HTMLElement[], expandedIds: Set<string>): void {
    container.setAttribute('role', 'tree');
    items.forEach(item => {
      const id = item.id || item.dataset.id || '';
      const hasChildren = item.querySelector('[role="group"]') !== null;
      item.setAttribute('role', 'treeitem');
      if (hasChildren) {
        item.setAttribute('aria-expanded', String(expandedIds.has(id)));
      }
    });
  },

  grid(table: HTMLElement, rows: HTMLElement[][], activeRow: number, activeCol: number): void {
    table.setAttribute('role', 'grid');
    rows.forEach((cells, ri) => {
      cells.forEach((cell, ci) => {
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', ri === activeRow && ci === activeCol ? '0' : '-1');
      });
    });
  },

  combobox(
    input: HTMLElement,
    listbox: HTMLElement,
    options: { expanded: boolean; activeDescendant?: string; hasPopup?: string }
  ): void {
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', String(options.expanded));
    input.setAttribute('aria-haspopup', options.hasPopup || 'listbox');
    input.setAttribute('aria-autocomplete', 'list');
    if (options.activeDescendant) {
      input.setAttribute('aria-activedescendant', options.activeDescendant);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    listbox.setAttribute('role', 'listbox');
  },

  listbox(container: HTMLElement, items: HTMLElement[], selectedIndices: Set<number>, multiselect = false): void {
    container.setAttribute('role', 'listbox');
    if (multiselect) container.setAttribute('aria-multiselectable', 'true');
    items.forEach((item, i) => {
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(selectedIndices.has(i)));
    });
  },
};

// --- Form Accessibility ---

export function associateErrorMessage(input: HTMLElement, errorId: string, message: string): HTMLElement {
  const error = document.createElement('div');
  error.id = errorId;
  error.setAttribute('role', 'alert');
  error.setAttribute('aria-live', 'polite');
  error.textContent = message;
  error.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;';

  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-errormessage', errorId);

  const existing = input.getAttribute('aria-describedby');
  if (existing && !existing.includes(errorId)) {
    input.setAttribute('aria-describedby', `${existing} ${errorId}`);
  } else {
    input.setAttribute('aria-describedby', errorId);
  }

  return error;
}

export function clearErrorMessage(input: HTMLElement, errorId: string): void {
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-errormessage');
  const described = input.getAttribute('aria-describedby');
  if (described) {
    const filtered = described.split(' ').filter(id => id !== errorId).join(' ');
    if (filtered) input.setAttribute('aria-describedby', filtered);
    else input.removeAttribute('aria-describedby');
  }
  document.getElementById(errorId)?.remove();
}

export function makeFieldAccessible(
  input: HTMLElement,
  options: { label?: string; description?: string; required?: boolean; labelId?: string; descId?: string }
): void {
  if (options.label && options.labelId) {
    input.setAttribute('aria-labelledby', options.labelId);
  } else if (options.label) {
    input.setAttribute('aria-label', options.label);
  }
  if (options.descId) input.setAttribute('aria-describedby', options.descId);
  if (options.required) input.setAttribute('aria-required', 'true');
}

// --- Landmark Management ---

export function validateLandmarks(root: HTMLElement = document.body): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const mains = root.querySelectorAll('[role="main"], main');
  if (mains.length === 0) issues.push('No <main> landmark found');
  if (mains.length > 1) issues.push('Multiple <main> landmarks found');

  const navs = root.querySelectorAll('[role="navigation"], nav');
  const navLabels = new Set<string>();
  navs.forEach(n => {
    const label = n.getAttribute('aria-label') || n.getAttribute('aria-labelledby') || '';
    if (navs.length > 1 && !label) {
      issues.push('Multiple <nav> landmarks exist without unique labels');
    }
    if (label && navLabels.has(label)) {
      issues.push(`Duplicate navigation label: "${label}"`);
    }
    navLabels.add(label);
  });

  const banners = root.querySelectorAll('[role="banner"], header');
  if (banners.length > 1) issues.push('Multiple banner landmarks');

  const contentinfos = root.querySelectorAll('[role="contentinfo"], footer');
  if (contentinfos.length > 1) issues.push('Multiple contentinfo landmarks');

  return { valid: issues.length === 0, issues };
}

export function getLandmarks(root: HTMLElement = document.body): LandmarkInfo[] {
  const landmarks: LandmarkInfo[] = [];
  const selectors = [
    { sel: 'main, [role="main"]', role: 'main' },
    { sel: 'nav, [role="navigation"]', role: 'navigation' },
    { sel: 'header, [role="banner"]', role: 'banner' },
    { sel: 'footer, [role="contentinfo"]', role: 'contentinfo' },
    { sel: 'aside, [role="complementary"]', role: 'complementary' },
    { sel: '[role="search"]', role: 'search' },
    { sel: 'form, [role="form"]', role: 'form' },
    { sel: '[role="region"]', role: 'region' },
  ];

  selectors.forEach(({ sel, role }) => {
    root.querySelectorAll<HTMLElement>(sel).forEach(el => {
      landmarks.push({
        role,
        label: el.getAttribute('aria-label') || undefined,
        element: el,
      });
    });
  });
  return landmarks;
}

// --- Heading Hierarchy ---

export function validateHeadingHierarchy(root: HTMLElement = document.body): HeadingNode[] {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
  const results: HeadingNode[] = [];
  let lastLevel = 0;
  let h1Count = 0;

  headings.forEach(el => {
    const level = parseInt(el.tagName[1]);
    const issues: string[] = [];

    if (level === 1) {
      h1Count++;
      if (h1Count > 1) issues.push('Multiple <h1> elements found');
    }

    if (level - lastLevel > 1 && lastLevel > 0) {
      issues.push(`Skipped heading level: h${lastLevel} → h${level}`);
    }

    if (!el.textContent?.trim()) {
      issues.push('Empty heading');
    }

    results.push({ level, text: el.textContent?.trim() || '', element: el, issues });
    lastLevel = level;
  });

  if (h1Count === 0) {
    results.unshift({ level: 0, text: '', element: document.createElement('div'), issues: ['No <h1> found'] });
  }

  return results;
}

// --- Media Preferences ---

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(forced-colors: active)').matches
    || window.matchMedia('(-ms-high-contrast: active)').matches;
}

export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function onMotionPreferenceChange(callback: (reduced: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

export function onContrastPreferenceChange(callback: (high: boolean) => void): () => void {
  const mq = window.matchMedia('(forced-colors: active)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// --- Font Size System ---

export class FontSizeManager {
  private static STORAGE_KEY = 'a11y_font_scale';
  private scale: number;
  private min: number;
  private max: number;
  private step: number;
  private listeners = new Set<(scale: number) => void>();

  constructor(options?: { min?: number; max?: number; step?: number }) {
    this.min = options?.min ?? 0.75;
    this.max = options?.max ?? 2.0;
    this.step = options?.step ?? 0.125;
    this.scale = this.loadScale();
    this.apply();
  }

  private loadScale(): number {
    try {
      const stored = localStorage.getItem(FontSizeManager.STORAGE_KEY);
      if (stored) return Math.max(this.min, Math.min(this.max, parseFloat(stored)));
    } catch { /* noop */ }
    return 1.0;
  }

  private persistScale(): void {
    try { localStorage.setItem(FontSizeManager.STORAGE_KEY, String(this.scale)); } catch { /* noop */ }
  }

  private apply(): void {
    document.documentElement.style.fontSize = `${this.scale * 100}%`;
    this.listeners.forEach(fn => fn(this.scale));
  }

  increase(): number {
    this.scale = Math.min(this.max, Math.round((this.scale + this.step) * 1000) / 1000);
    this.persistScale();
    this.apply();
    return this.scale;
  }

  decrease(): number {
    this.scale = Math.max(this.min, Math.round((this.scale - this.step) * 1000) / 1000);
    this.persistScale();
    this.apply();
    return this.scale;
  }

  reset(): number {
    this.scale = 1.0;
    this.persistScale();
    this.apply();
    return this.scale;
  }

  setScale(value: number): number {
    this.scale = Math.max(this.min, Math.min(this.max, value));
    this.persistScale();
    this.apply();
    return this.scale;
  }

  getScale(): number {
    return this.scale;
  }

  onChange(callback: (scale: number) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

// --- Chart Accessibility ---

export function generateChartDescription(data: {
  title: string;
  type: string;
  symbol?: string;
  timeframe?: string;
  dataPoints: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  change?: number;
  changePercent?: number;
  indicators?: string[];
}): string {
  const parts = [`${data.type} chart for ${data.title}`];
  if (data.symbol) parts[0] += ` (${data.symbol})`;
  if (data.timeframe) parts.push(`Timeframe: ${data.timeframe}`);
  parts.push(`Data points: ${data.dataPoints}`);

  if (data.open !== undefined) parts.push(`Open: ${data.open}`);
  if (data.high !== undefined) parts.push(`High: ${data.high}`);
  if (data.low !== undefined) parts.push(`Low: ${data.low}`);
  if (data.close !== undefined) parts.push(`Close: ${data.close}`);

  if (data.change !== undefined) {
    const dir = data.change >= 0 ? 'up' : 'down';
    parts.push(`Change: ${dir} ${Math.abs(data.change)}${data.changePercent !== undefined ? ` (${data.changePercent}%)` : ''}`);
  }

  if (data.indicators?.length) {
    parts.push(`Active indicators: ${data.indicators.join(', ')}`);
  }

  return parts.join('. ') + '.';
}

// --- WCAG Audit ---

export function runAccessibilityAudit(root: HTMLElement = document.body): AccessibilityAuditResult {
  const violations: AccessibilityViolation[] = [];
  const warnings: string[] = [];

  const images = root.querySelectorAll('img');
  images.forEach(img => {
    if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
      violations.push({
        rule: 'img-alt',
        severity: 'critical',
        element: img.outerHTML.slice(0, 100),
        message: 'Image missing alt attribute',
        fix: 'Add alt="" for decorative images or descriptive alt text',
      });
    }
  });

  const buttons = root.querySelectorAll('button, [role="button"]');
  buttons.forEach(btn => {
    const text = btn.textContent?.trim() || '';
    const ariaLabel = btn.getAttribute('aria-label') || '';
    const ariaLabelledBy = btn.getAttribute('aria-labelledby') || '';
    if (!text && !ariaLabel && !ariaLabelledBy) {
      violations.push({
        rule: 'button-name',
        severity: 'critical',
        element: btn.outerHTML.slice(0, 100),
        message: 'Button has no accessible name',
        fix: 'Add text content, aria-label, or aria-labelledby',
      });
    }
  });

  const links = root.querySelectorAll('a[href]');
  links.forEach(link => {
    const text = link.textContent?.trim() || '';
    const ariaLabel = link.getAttribute('aria-label') || '';
    if (!text && !ariaLabel) {
      violations.push({
        rule: 'link-name',
        severity: 'serious',
        element: link.outerHTML.slice(0, 100),
        message: 'Link has no accessible name',
        fix: 'Add link text or aria-label',
      });
    }
  });

  const inputs = root.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    const label = id ? root.querySelector(`label[for="${id}"]`) : null;
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const title = input.getAttribute('title');
    const type = input.getAttribute('type');

    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;

    if (!label && !ariaLabel && !ariaLabelledBy && !title && !input.closest('label')) {
      violations.push({
        rule: 'input-label',
        severity: 'critical',
        element: input.outerHTML.slice(0, 100),
        message: 'Form input has no associated label',
        fix: 'Add a <label> element, aria-label, or aria-labelledby',
      });
    }
  });

  const headingResult = validateHeadingHierarchy(root);
  headingResult.forEach(h => {
    h.issues.forEach(issue => {
      violations.push({
        rule: 'heading-order',
        severity: 'moderate',
        element: `<h${h.level}>${h.text}</h${h.level}>`,
        message: issue,
        fix: 'Ensure headings follow a logical hierarchy',
      });
    });
  });

  const landmarkResult = validateLandmarks(root);
  landmarkResult.issues.forEach(issue => {
    warnings.push(issue);
  });

  const autoplay = root.querySelectorAll('video[autoplay], audio[autoplay]');
  autoplay.forEach(el => {
    if (!el.hasAttribute('muted')) {
      violations.push({
        rule: 'no-autoplay-audio',
        severity: 'serious',
        element: el.tagName.toLowerCase(),
        message: 'Autoplaying media without muted attribute',
        fix: 'Add muted attribute or provide play controls',
      });
    }
  });

  const tabindexAbuse = root.querySelectorAll('[tabindex]');
  tabindexAbuse.forEach(el => {
    const val = parseInt(el.getAttribute('tabindex') || '0');
    if (val > 0) {
      warnings.push(`Positive tabindex (${val}) found on ${el.tagName.toLowerCase()} — use 0 or -1 instead`);
    }
  });

  const total = images.length + buttons.length + links.length + inputs.length + headingResult.length;
  const score = total > 0 ? Math.max(0, Math.round((1 - violations.length / Math.max(total, 1)) * 100)) : 100;

  return {
    passed: violations.filter(v => v.severity === 'critical' || v.severity === 'serious').length === 0,
    violations,
    warnings,
    score,
  };
}
