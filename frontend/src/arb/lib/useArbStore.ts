import { create } from 'zustand';

import { normalizeArbRows } from '@/arb/lib/arbNormalize';
import type { ArbOpportunity } from '@/arb/types/arb';

type PatchOp = { op: string; path: string; value?: unknown };

interface ArbState {
  opportunities: ArbOpportunity[];
  streamConnected: boolean;
  lastPatchAt: number | null;
  patchMode: boolean;
  maxEdge: number;
  setConnected: (v: boolean) => void;
  setStatus: (maxEdge: number, patchMode?: boolean) => void;
  applySync: (rows: ArbOpportunity[]) => void;
  applyPatches: (patches: PatchOp[]) => void;
  handleStreamMessage: (msg: Record<string, unknown>) => void;
}

function applyJsonPatches(doc: { opportunities: ArbOpportunity[] }, patches: PatchOp[]) {
  const next = structuredClone(doc);
  for (const patch of patches) {
    const parts = patch.path.split('/').filter(Boolean);
    if (parts[0] !== 'opportunities') continue;
    const idx = Number(parts[1]);
    if (Number.isNaN(idx)) continue;
    if (patch.op === 'remove') {
      next.opportunities.splice(idx, 1);
    } else if (patch.op === 'add' && parts.length === 2) {
      next.opportunities.splice(idx, 0, patch.value as ArbOpportunity);
    } else if (patch.op === 'replace' && parts.length === 2) {
      next.opportunities[idx] = patch.value as ArbOpportunity;
    } else if (patch.op === 'replace' && parts.length === 3) {
      const key = parts[2] as keyof ArbOpportunity;
      (next.opportunities[idx] as Record<string, unknown>)[key] = patch.value;
    }
  }
  return next;
}

export const useArbStore = create<ArbState>((set, get) => ({
  opportunities: [],
  streamConnected: false,
  lastPatchAt: null,
  patchMode: true,
  maxEdge: 0,

  setConnected: (streamConnected) => set({ streamConnected }),

  setStatus: (maxEdge, patchMode) =>
    set({
      maxEdge,
      ...(patchMode !== undefined ? { patchMode } : {}),
    }),

  applySync: (rows) =>
    set({
      opportunities: [...rows].sort((a, b) => b.net_edge - a.net_edge),
      lastPatchAt: Date.now(),
    }),

  applyPatches: (patches) => {
    try {
      const doc = { opportunities: get().opportunities };
      const next = applyJsonPatches(doc, patches);
      set({
        opportunities: [...next.opportunities].sort((a, b) => b.net_edge - a.net_edge),
        lastPatchAt: Date.now(),
      });
    } catch (err) {
      console.warn('arb patch apply failed', err);
    }
  },

  handleStreamMessage: (msg) => {
    const type = msg.type as string;
    if (type === 'heartbeat') return;
    if (type === 'sync' || type === 'data') {
      const raw = (msg.opportunities as unknown[]) ?? [];
      get().applySync(normalizeArbRows(raw));
      return;
    }
    if (type === 'patch' && Array.isArray(msg.patches)) {
      get().applyPatches(msg.patches as PatchOp[]);
      return;
    }
    if (type === 'status') {
      get().setStatus(Number(msg.max_edge ?? 0), Boolean(msg.patch_mode ?? get().patchMode));
    }
  },
}));
