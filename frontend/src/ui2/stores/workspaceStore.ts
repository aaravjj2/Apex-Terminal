/**
 * v1.54 — Workspace Persistence Store
 * Persists active workspace + subview in localStorage with deterministic keys
 */

const STORAGE_KEY = 'apex-ui2-workspace';
const SUBVIEW_KEY = 'apex-ui2-subview';

export interface WorkspaceState {
  activeWorkspace: string;
  subviews: Record<string, string>;
}

const DEFAULT_STATE: WorkspaceState = {
  activeWorkspace: 'dashboard',
  subviews: {},
};

function loadState(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { ...DEFAULT_STATE };
}

function saveState(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

let currentState = loadState();
const listeners = new Set<() => void>();

export const workspaceStore = {
  getState: () => currentState,

  setActiveWorkspace(id: string) {
    currentState = { ...currentState, activeWorkspace: id };
    saveState(currentState);
    listeners.forEach(fn => fn());
  },

  setSubview(workspaceId: string, subview: string) {
    currentState = {
      ...currentState,
      subviews: { ...currentState.subviews, [workspaceId]: subview },
    };
    saveState(currentState);
    listeners.forEach(fn => fn());
  },

  resetLayout() {
    currentState = { ...DEFAULT_STATE };
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SUBVIEW_KEY);
    listeners.forEach(fn => fn());
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
