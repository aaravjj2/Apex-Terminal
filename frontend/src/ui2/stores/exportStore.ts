/**
 * Export Store (Wave 8 — v1.79)
 * Export bundle management for autopilot + automation artifacts.
 * Deterministic — no network required.
 */

// ── Types ───────────────────────────────────────────────────────

export interface ExportSection {
  key: string;
  label: string;
  endpoint: string;
}

export interface ExportManifest {
  manifest_version: string;
  generated_at: string;
  sections: ExportSection[];
}

export interface ExportBundle {
  bundle_id: string;
  generated_at: string;
  mode: string;
  autopilot: { runs: unknown[]; total: number };
  automation: { runs: unknown[]; total: number };
  deterministic_hash: string;
}

// ── Hash ────────────────────────────────────────────────────────

function stableHash(data: unknown): string {
  const raw = JSON.stringify(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── Demo Data ──────────────────────────────────────────────────

import { RECORDING_TS } from '../dataMode/config'; const DEMO_TS = RECORDING_TS; // recording anchor replaces synthetic ts

const DEMO_MANIFEST: ExportManifest = {
  manifest_version: '1.0.0',
  generated_at: DEMO_TS,
  sections: [
    { key: 'autopilot', label: 'Autopilot V2 Runs', endpoint: '/api/v1/platform/export/bundle' },
    { key: 'automation', label: 'Automation Runs', endpoint: '/api/v1/platform/export/bundle' },
    { key: 'health', label: 'Platform Health', endpoint: '/api/v1/platform/health' },
  ],
};

// ── Store ───────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let manifest: ExportManifest = { ...DEMO_MANIFEST };
let bundle: ExportBundle | null = null;
let isExporting: boolean = false;

export const exportStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getManifest: () => manifest,
  getBundle: () => bundle,
  getIsExporting: () => isExporting,

  generateBundle() {
    isExporting = true;
    notify();

    bundle = {
      bundle_id: `bundle-${stableHash({ ts: DEMO_TS })}`,
      generated_at: DEMO_TS,
      mode: 'demo',
      autopilot: { runs: [], total: 0 },
      automation: { runs: [], total: 0 },
      deterministic_hash: stableHash({ ts: DEMO_TS, mode: 'demo' }),
    };

    isExporting = false;
    notify();
    return bundle;
  },

  reset() {
    manifest = { ...DEMO_MANIFEST }; bundle = null; isExporting = false;
    notify();
  },
};
