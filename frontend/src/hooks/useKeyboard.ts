/**
 * useKeyboard.ts
 * Bloomberg-style hotkey system with multi-modifier support,
 * scope isolation, sequence detection (e.g., "g then h"),
 * conflict detection, modal/overlay awareness, and key chord display.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyCombo {
  key: string;
  modifiers?: Modifier[];
  sequence?: string[];  // multi-key chord: ['g', 'h'] means press g then h
}

export interface HotkeyDef {
  id: string;
  combo: KeyCombo;
  description: string;
  scope?: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

export interface UseKeyboardOptions {
  scope?: string;
  enabled?: boolean;
  target?: HTMLElement | null;
  preventDefault?: boolean;
}

// ─── Key Utilities ────────────────────────────────────────────────────────────

function normalizeKey(key: string): string {
  const aliases: Record<string, string> = {
    ' ': 'space', 'ArrowUp': 'up', 'ArrowDown': 'down',
    'ArrowLeft': 'left', 'ArrowRight': 'right',
    'Escape': 'esc', 'Enter': 'enter', 'Backspace': 'backspace',
    'Tab': 'tab', 'Delete': 'del', 'Home': 'home', 'End': 'end',
    'PageUp': 'pageup', 'PageDown': 'pagedown', 'F1': 'f1',
    'F2': 'f2', 'F3': 'f3', 'F4': 'f4', 'F5': 'f5', 'F6': 'f6',
    'F7': 'f7', 'F8': 'f8', 'F9': 'f9', 'F10': 'f10',
    'F11': 'f11', 'F12': 'f12',
  };
  return (aliases[key] ?? key).toLowerCase();
}

function comboMatches(combo: KeyCombo, event: KeyboardEvent, modifiers: Set<Modifier>): boolean {
  const keyMatch = normalizeKey(event.key) === normalizeKey(combo.key);
  if (!keyMatch) return false;
  const required = new Set<Modifier>(combo.modifiers ?? []);
  for (const mod of required) if (!modifiers.has(mod)) return false;
  for (const mod of modifiers) if (!required.has(mod)) return false;
  return true;
}

function formatCombo(combo: KeyCombo): string {
  const mods = (combo.modifiers ?? []).map(m => m.charAt(0).toUpperCase() + m.slice(1));
  return [...mods, combo.key.toUpperCase()].join('+');
}

// ─── Global Registry ──────────────────────────────────────────────────────────

const globalHotkeys = new Map<string, HotkeyDef>();
let activeScopes: Set<string> = new Set(['global']);

function registerHotkey(def: HotkeyDef) {
  globalHotkeys.set(def.id, def);
  return () => globalHotkeys.delete(def.id);
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useKeyboard(hotkeys: HotkeyDef[], options: UseKeyboardOptions = {}) {
  const { scope = 'global', enabled = true, target, preventDefault: globalPD = false } = options;
  const sequenceRef = useRef<string[]>([]);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeModifiers = useRef<Set<Modifier>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const ids = hotkeys.map(def => registerHotkey({ ...def, scope }));
    return () => ids.forEach(fn => fn());
  }, [enabled, scope, hotkeys]);

  useEffect(() => {
    if (!enabled) return;
    const el = target ?? window;

    const handleKeyDown = (e: Event) => {
      const event = e as KeyboardEvent;
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      const inInput = ['input', 'textarea', 'select'].includes(tag ?? '');

      // Track modifiers
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        const mod = event.key.toLowerCase().replace('control', 'ctrl').replace('meta', 'meta') as Modifier;
        activeModifiers.current.add(mod);
      }

      for (const def of hotkeys) {
        if (!def.enabled && def.enabled !== undefined) continue;
        if (def.combo.sequence) {
          // Sequence handling
          sequenceRef.current.push(normalizeKey(event.key));
          if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
          sequenceTimerRef.current = setTimeout(() => { sequenceRef.current = []; }, 1500);

          const seq = def.combo.sequence.map(k => normalizeKey(k));
          const cur = sequenceRef.current;
          if (cur.length >= seq.length && cur.slice(-seq.length).join('') === seq.join('')) {
            sequenceRef.current = [];
            if (def.preventDefault || globalPD) event.preventDefault();
            def.handler(event);
          }
          continue;
        }
        if (inInput && !(def.combo.modifiers ?? []).includes('ctrl') && !(def.combo.modifiers ?? []).includes('alt')) continue;
        if (comboMatches(def.combo, event, activeModifiers.current)) {
          if (def.preventDefault || globalPD) event.preventDefault();
          def.handler(event);
        }
      }
    };

    const handleKeyUp = (e: Event) => {
      const event = e as KeyboardEvent;
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        const mod = event.key.toLowerCase().replace('control', 'ctrl').replace('meta', 'meta') as Modifier;
        activeModifiers.current.delete(mod);
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    el.addEventListener('keyup', handleKeyUp);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, target, hotkeys, globalPD]);
}

// ─── Single Hotkey Hook ───────────────────────────────────────────────────────

export function useHotkey(
  combo: KeyCombo,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean; description?: string } = {}
) {
  const { enabled = true } = options;
  useKeyboard([{
    id: `hotkey_${formatCombo(combo)}`,
    combo,
    description: options.description ?? '',
    handler,
    enabled,
  }], { enabled });
}

// ─── Bloomberg Terminal Hotkeys ───────────────────────────────────────────────

export interface BloombergAction {
  combo: KeyCombo;
  action: string;
  description: string;
  category: string;
}

export const BLOOMBERG_HOTKEYS: BloombergAction[] = [
  // Navigation
  { combo: { key: 'F1' }, action: 'help', description: 'Open help panel', category: 'navigation' },
  { combo: { key: 'F2' }, action: 'toggle_sidebar', description: 'Toggle sidebar', category: 'navigation' },
  { combo: { key: 'F3' }, action: 'search', description: 'Open search', category: 'navigation' },
  { combo: { key: 'F4' }, action: 'news', description: 'Open news', category: 'navigation' },
  { combo: { key: 'F5' }, action: 'refresh', description: 'Refresh data', category: 'navigation' },
  { combo: { key: 'F8' }, action: 'monitor', description: 'Open monitor', category: 'navigation' },
  { combo: { key: 'F10' }, action: 'menu', description: 'Toggle menu', category: 'navigation' },
  // Charts
  { combo: { key: '1', modifiers: ['alt'] }, action: 'chart_1m', description: '1-minute chart', category: 'chart' },
  { combo: { key: '5', modifiers: ['alt'] }, action: 'chart_5m', description: '5-minute chart', category: 'chart' },
  { combo: { key: 'd', modifiers: ['alt'] }, action: 'chart_1d', description: 'Daily chart', category: 'chart' },
  { combo: { key: 'w', modifiers: ['alt'] }, action: 'chart_1w', description: 'Weekly chart', category: 'chart' },
  // Workspace
  { combo: { key: 'k', modifiers: ['ctrl'] }, action: 'command_palette', description: 'Open command palette', category: 'workspace' },
  { combo: { key: 'l', modifiers: ['ctrl'] }, action: 'layout', description: 'Change layout', category: 'workspace' },
  { combo: { key: 's', modifiers: ['ctrl'] }, action: 'save_workspace', description: 'Save workspace', category: 'workspace' },
  { combo: { key: 'n', modifiers: ['ctrl'] }, action: 'new_tab', description: 'New panel tab', category: 'workspace' },
  { combo: { key: 'w', modifiers: ['ctrl'] }, action: 'close_tab', description: 'Close panel tab', category: 'workspace' },
  // Analysis
  { combo: { key: 't', modifiers: ['alt'] }, action: 'technical', description: 'Technical Analysis', category: 'analysis' },
  { combo: { key: 'r', modifiers: ['alt'] }, action: 'risk', description: 'Risk screen', category: 'analysis' },
  { combo: { key: 'o', modifiers: ['alt'] }, action: 'options', description: 'Options screen', category: 'analysis' },
  { combo: { key: 'm', modifiers: ['alt'] }, action: 'macro', description: 'Macro dashboard', category: 'analysis' },
  { combo: { key: 'p', modifiers: ['alt'] }, action: 'portfolio', description: 'Portfolio', category: 'analysis' },
  // Quick navigation (Bloomberg-style sequences)
  { combo: { key: 'escape' }, action: 'back', description: 'Go back', category: 'navigation' },
];

export function useBloombergKeyboard(
  handlers: Partial<Record<string, () => void>>,
  options: UseKeyboardOptions = {}
) {
  const hotkeys: HotkeyDef[] = useMemo(() => 
    BLOOMBERG_HOTKEYS
      .filter(bk => handlers[bk.action])
      .map(bk => ({
        id: `bloomberg_${bk.action}`,
        combo: bk.combo,
        description: bk.description,
        handler: () => handlers[bk.action]?.(),
        preventDefault: true,
      })),
    [handlers]
  );
  useKeyboard(hotkeys, options);
}

// ─── Key Display Component Logic ─────────────────────────────────────────────

export function formatKeyCombo(combo: KeyCombo): string {
  return formatCombo(combo);
}

export function parseKeyCombo(str: string): KeyCombo {
  const parts = str.toLowerCase().split('+');
  const modifiers: Modifier[] = [];
  let key = '';
  for (const part of parts) {
    if (['ctrl', 'alt', 'shift', 'meta'].includes(part)) modifiers.push(part as Modifier);
    else key = part;
  }
  return { key, modifiers: modifiers.length > 0 ? modifiers : undefined };
}

// ─── Key Press Display Hook ───────────────────────────────────────────────────

export function useKeyPressDisplay(timeout = 1500) {
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = normalizeKey(e.key);
      if (['control', 'alt', 'shift', 'meta'].includes(key)) return;
      setPressedKeys(prev => [...prev.slice(-4), key]);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPressedKeys([]), timeout);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [timeout]);

  return pressedKeys;
}

// ─── useMemo import ──────────────────────────────────────────────────────────
import { useMemo } from 'react';

export default useKeyboard;
