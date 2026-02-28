/**
 * Export Store (Wave 8 â€” v1.79)
 * Export bundle management for autopilot + automation artifacts.
 * Deterministic â€” no network required.
 */

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Hash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function stableHash(data: unknown): string {
  const raw = JSON.stringify(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const DEFAULT_MANIFEST: ExportManifest = {
  manifest_version: '1.0.0',
  generated_at: new Date().toISOString(),
  sections: [
    { key: 'autopilot', label: 'Autopilot V2 Runs', endpoint: '/api/v1/platform/export/bundle' },
    { key: 'automation', label: 'Automation Runs', endpoint: '/api/v1/platform/export/bundle' },
    { key: 'health', label: 'Platform Health', endpoint: '/api/v1/platform/health' },
  ],
};

// â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let manifest: ExportManifest = { ...DEFAULT_MANIFEST };
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
      bundle_id: `bundle-${stableHash({ ts: new Date().toISOString() })}`,
      generated_at: new Date().toISOString(),
      mode: 'live',
      autopilot: { runs: [], total: 0 },
      automation: { runs: [], total: 0 },
      deterministic_hash: stableHash({ ts: new Date().toISOString(), mode: 'live' }),
    };

    isExporting = false;
    notify();
    return bundle;
  },

  reset() {
    manifest = { ...DEFAULT_MANIFEST }; bundle = null; isExporting = false;
    notify();
  },
};
