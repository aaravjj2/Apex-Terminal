/**
 * W01 — Symbol Context Bus (Zustand)
 *
 * Central store for the "active" symbol / entity across all panels.
 * Any panel can call `setActiveSymbol("AAPL")` and every consumer
 * (chart, blotter, risk panel, inspector) reacts.
 *
 * Also tracks the "active entity" concept — e.g. a particular strategy,
 * run-id, or order-id — for cross-panel deep-link inspection.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType =
  | 'symbol'
  | 'strategy'
  | 'order'
  | 'position'
  | 'run'
  | 'alert'
  | 'backtest'
  | 'workflow';

export interface ActiveEntity {
  /** Unique id inside that entity type, e.g. order-id */
  id: string;
  /** Discriminator */
  type: EntityType;
  /** Human label (optional) */
  label?: string;
  /** Extra metadata (optional) */
  meta?: Record<string, unknown>;
}

export interface ContextBusState {
  /** Primary active ticker symbol — e.g. "AAPL" */
  activeSymbol: string;
  /** History of recently accessed symbols (last 10) */
  symbolHistory: string[];
  /** Active cross-panel entity (inspector target) */
  activeEntity: ActiveEntity | null;
  /** Timestamp of last symbol change */
  lastSymbolChangeAt: number;

  // Actions
  setActiveSymbol: (symbol: string) => void;
  setActiveEntity: (entity: ActiveEntity | null) => void;
  clearActiveEntity: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_HISTORY = 10;

export const useContextBus = create<ContextBusState>((set) => ({
  activeSymbol: 'AAPL',
  symbolHistory: ['AAPL'],
  activeEntity: null,
  lastSymbolChangeAt: Date.now(),

  setActiveSymbol: (symbol: string) =>
    set((state) => {
      const upper = symbol.toUpperCase().trim();
      if (!upper) return state;
      const history = [upper, ...state.symbolHistory.filter((s) => s !== upper)].slice(
        0,
        MAX_HISTORY,
      );
      return {
        activeSymbol: upper,
        symbolHistory: history,
        lastSymbolChangeAt: Date.now(),
      };
    }),

  setActiveEntity: (entity: ActiveEntity | null) =>
    set(() => ({ activeEntity: entity })),

  clearActiveEntity: () => set(() => ({ activeEntity: null })),
}));

// ---------------------------------------------------------------------------
// Non-React accessors (for legacy code or tests)
// ---------------------------------------------------------------------------

/**
 * Subscribe externally (non-React).
 * Returns unsubscribe function.
 */
export function subscribeContextBus(fn: (state: ContextBusState) => void) {
  return useContextBus.subscribe(fn);
}

/** Read current symbol imperatively */
export function getActiveSymbol(): string {
  return useContextBus.getState().activeSymbol;
}

/** Read current entity imperatively */
export function getActiveEntity(): ActiveEntity | null {
  return useContextBus.getState().activeEntity;
}
