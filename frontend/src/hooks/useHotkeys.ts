/**
 * useHotkeys.ts
 * Advanced keyboard shortcuts hook with global registration, context-aware
 * scoping, chord support (Ctrl+K, Ctrl+P), sequence support (g then d),
 * conflict detection, custom mapping, cheat sheet generation, and focus mgmt.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type HotkeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta';
export type HotkeyContext = 'global' | 'chart' | 'orderticket' | 'watchlist' | 'screener'
  | 'portfolio' | 'news' | 'settings' | 'dialog' | string;

export interface HotkeyCombo {
  key: string;
  modifiers?: HotkeyModifier[];
}

export interface HotkeyChord {
  first: HotkeyCombo;
  second: HotkeyCombo;
}

export interface HotkeySequence {
  keys: string[];
  timeout?: number;
}

export interface HotkeyBinding {
  id: string;
  label: string;
  description: string;
  category: string;
  context: HotkeyContext;
  combo?: HotkeyCombo;
  chord?: HotkeyChord;
  sequence?: HotkeySequence;
  handler: (event: KeyboardEvent) => void;
  enabled: boolean;
  preventDefault: boolean;
  allowInInput: boolean;
  priority: number;
}

export interface HotkeyConflict {
  bindingA: string;
  bindingB: string;
  key: string;
  context: HotkeyContext;
}

export interface CheatSheetEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  shortcutDisplay: string;
  context: HotkeyContext;
}

export interface UseHotkeysOptions {
  context?: HotkeyContext;
  enabled?: boolean;
  storageKey?: string;
  onConflict?: (conflict: HotkeyConflict) => void;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function normalizeKey(key: string): string {
  const map: Record<string, string> = {
    ' ': 'space', 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left',
    'ArrowRight': 'right', 'Escape': 'escape', 'Enter': 'enter',
    'Backspace': 'backspace', 'Tab': 'tab', 'Delete': 'delete',
  };
  return (map[key] ?? key).toLowerCase();
}

function getModifiers(e: KeyboardEvent): Set<HotkeyModifier> {
  const mods = new Set<HotkeyModifier>();
  if (e.ctrlKey || e.metaKey) mods.add('ctrl');
  if (e.altKey) mods.add('alt');
  if (e.shiftKey) mods.add('shift');
  if (e.metaKey) mods.add('meta');
  return mods;
}

function comboMatches(combo: HotkeyCombo, key: string, mods: Set<HotkeyModifier>): boolean {
  if (normalizeKey(combo.key) !== key) return false;
  const required = new Set(combo.modifiers ?? []);
  if (required.has('ctrl') && !mods.has('ctrl') && !mods.has('meta')) return false;
  for (const m of required) {
    if (m !== 'ctrl' && !mods.has(m)) return false;
  }
  const modCount = (combo.modifiers ?? []).length;
  const actualCount = [...mods].filter(m => m !== 'meta' || !required.has('ctrl')).length;
  if (actualCount > modCount) return false;
  return true;
}

function formatCombo(combo: HotkeyCombo): string {
  const modLabels: Record<HotkeyModifier, string> = { ctrl: '⌘/Ctrl', alt: 'Alt', shift: '⇧', meta: '⌘' };
  const parts = (combo.modifiers ?? []).map(m => modLabels[m]);
  parts.push(combo.key.toUpperCase());
  return parts.join(' + ');
}

function formatBinding(binding: HotkeyBinding): string {
  if (binding.combo) return formatCombo(binding.combo);
  if (binding.chord) return `${formatCombo(binding.chord.first)}, ${formatCombo(binding.chord.second)}`;
  if (binding.sequence) return binding.sequence.keys.map(k => k.toUpperCase()).join(' → ');
  return '';
}

// ─── Global Registry ───────────────────────────────────────────────────────────

const globalRegistry = new Map<string, HotkeyBinding>();
let activeContext: HotkeyContext = 'global';
const contextStack: HotkeyContext[] = ['global'];

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHotkeys(options: UseHotkeysOptions = {}) {
  const {
    context = 'global',
    enabled = true,
    storageKey = 'apex_hotkey_mappings',
    onConflict,
  } = options;

  const [bindings, setBindings] = useState<Map<string, HotkeyBinding>>(new Map());
  const [chordWaiting, setChordWaiting] = useState<HotkeyCombo | null>(null);
  const [conflicts, setConflicts] = useState<HotkeyConflict[]>([]);
  const sequenceBufferRef = useRef<string[]>([]);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customMappingsRef = useRef<Map<string, HotkeyCombo>>(new Map());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const mappings: Record<string, HotkeyCombo> = JSON.parse(stored);
        customMappingsRef.current = new Map(Object.entries(mappings));
      }
    } catch {}
  }, [storageKey]);

  // ── Registration ──

  const register = useCallback((
    id: string,
    config: Omit<HotkeyBinding, 'id' | 'enabled' | 'priority'> & { enabled?: boolean; priority?: number }
  ) => {
    const customCombo = customMappingsRef.current.get(id);
    const binding: HotkeyBinding = {
      ...config, id,
      combo: customCombo ?? config.combo,
      enabled: config.enabled ?? true,
      priority: config.priority ?? 0,
    };

    globalRegistry.set(id, binding);
    setBindings(prev => new Map(prev).set(id, binding));

    detectConflicts(binding);

    return () => {
      globalRegistry.delete(id);
      setBindings(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const unregister = useCallback((id: string) => {
    globalRegistry.delete(id);
    setBindings(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Conflict Detection ──

  const detectConflicts = useCallback((newBinding: HotkeyBinding) => {
    if (!newBinding.combo) return;
    const newComboStr = formatCombo(newBinding.combo);

    globalRegistry.forEach((existing, id) => {
      if (id === newBinding.id || !existing.combo) return;
      if (existing.context !== newBinding.context && existing.context !== 'global' && newBinding.context !== 'global') return;

      const existingStr = formatCombo(existing.combo);
      if (newComboStr === existingStr) {
        const conflict: HotkeyConflict = {
          bindingA: newBinding.id, bindingB: id,
          key: newComboStr, context: newBinding.context,
        };
        setConflicts(prev => [...prev, conflict]);
        onConflict?.(conflict);
      }
    });
  }, [onConflict]);

  // ── Context Management ──

  const pushContext = useCallback((ctx: HotkeyContext) => {
    contextStack.push(ctx);
    activeContext = ctx;
  }, []);

  const popContext = useCallback(() => {
    if (contextStack.length > 1) contextStack.pop();
    activeContext = contextStack[contextStack.length - 1];
  }, []);

  const setContext = useCallback((ctx: HotkeyContext) => {
    activeContext = ctx;
  }, []);

  // ── Custom Mapping ──

  const remapHotkey = useCallback((id: string, newCombo: HotkeyCombo) => {
    customMappingsRef.current.set(id, newCombo);
    const binding = globalRegistry.get(id);
    if (binding) {
      const updated = { ...binding, combo: newCombo };
      globalRegistry.set(id, updated);
      setBindings(prev => new Map(prev).set(id, updated));
    }
    try {
      const obj: Record<string, HotkeyCombo> = {};
      customMappingsRef.current.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch {}
  }, [storageKey]);

  const resetMapping = useCallback((id: string) => {
    customMappingsRef.current.delete(id);
    try {
      const obj: Record<string, HotkeyCombo> = {};
      customMappingsRef.current.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch {}
  }, [storageKey]);

  const resetAllMappings = useCallback(() => {
    customMappingsRef.current.clear();
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  // ── Key Handler ──

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inInput = ['input', 'textarea', 'select'].includes(tag ?? '');
      const key = normalizeKey(e.key);
      const mods = getModifiers(e);

      if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

      const matchingBindings = Array.from(globalRegistry.values())
        .filter(b => b.enabled)
        .filter(b => b.context === activeContext || b.context === 'global')
        .filter(b => !inInput || b.allowInInput)
        .sort((a, b) => b.priority - a.priority);

      // Chord mode: waiting for second key
      if (chordWaiting) {
        for (const binding of matchingBindings) {
          if (!binding.chord) continue;
          if (comboMatches(binding.chord.second, key, mods)) {
            if (binding.preventDefault) e.preventDefault();
            binding.handler(e);
            setChordWaiting(null);
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            return;
          }
        }
        setChordWaiting(null);
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
      }

      // Check for chord first-key matches
      for (const binding of matchingBindings) {
        if (!binding.chord) continue;
        if (comboMatches(binding.chord.first, key, mods)) {
          setChordWaiting(binding.chord.first);
          if (binding.preventDefault) e.preventDefault();
          chordTimerRef.current = setTimeout(() => setChordWaiting(null), 1500);
          return;
        }
      }

      // Sequence matching
      sequenceBufferRef.current.push(key);
      if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = setTimeout(() => { sequenceBufferRef.current = []; }, 2000);

      for (const binding of matchingBindings) {
        if (!binding.sequence) continue;
        const seq = binding.sequence.keys.map(k => normalizeKey(k));
        const buf = sequenceBufferRef.current;
        if (buf.length >= seq.length && buf.slice(-seq.length).every((k, i) => k === seq[i])) {
          if (binding.preventDefault) e.preventDefault();
          binding.handler(e);
          sequenceBufferRef.current = [];
          return;
        }
      }

      // Simple combo matching
      for (const binding of matchingBindings) {
        if (!binding.combo || binding.chord || binding.sequence) continue;
        if (comboMatches(binding.combo, key, mods)) {
          if (binding.preventDefault) e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, chordWaiting]);

  // ── Cheat Sheet ──

  const cheatSheet = useMemo((): CheatSheetEntry[] => {
    return Array.from(globalRegistry.values())
      .filter(b => b.enabled)
      .map(b => ({
        id: b.id,
        label: b.label,
        description: b.description,
        category: b.category,
        shortcutDisplay: formatBinding(b),
        context: b.context,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
  }, [bindings]);

  const cheatSheetByCategory = useMemo(() => {
    const grouped = new Map<string, CheatSheetEntry[]>();
    cheatSheet.forEach(entry => {
      if (!grouped.has(entry.category)) grouped.set(entry.category, []);
      grouped.get(entry.category)!.push(entry);
    });
    return grouped;
  }, [cheatSheet]);

  // ── Focus Management ──

  const focusElement = useCallback((selector: string) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.focus();
      el.scrollIntoView?.({ block: 'nearest' });
    }
  }, []);

  const focusNext = useCallback((containerSelector: string, itemSelector: string) => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    const active = document.activeElement;
    const idx = items.indexOf(active as HTMLElement);
    const next = items[(idx + 1) % items.length];
    next?.focus();
  }, []);

  const focusPrev = useCallback((containerSelector: string, itemSelector: string) => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    const active = document.activeElement;
    const idx = items.indexOf(active as HTMLElement);
    const prev = items[(idx - 1 + items.length) % items.length];
    prev?.focus();
  }, []);

  return {
    register, unregister,
    pushContext, popContext, setContext,
    remapHotkey, resetMapping, resetAllMappings,
    cheatSheet, cheatSheetByCategory,
    conflicts, chordWaiting,
    focusElement, focusNext, focusPrev,
    formatCombo, formatBinding: (b: HotkeyBinding) => formatBinding(b),
  };
}

export default useHotkeys;
