/**
 * Dataset Snapshot Store v2 — Full-featured store for W14 Dataset Snapshot Management
 *
 * Endpoints:
 *  - createSnapshot(req)        → POST /api/v3/backtest/datasets/snapshot
 *  - fetchSnapshots(symbol?)    → GET  /api/v3/backtest/datasets
 *  - fetchSnapshotById(id)      → GET  /api/v3/backtest/datasets/{id}
 *  - fetchSnapshotBars(id)      → GET  /api/v3/backtest/datasets/{id}/bars
 *  - verifyChecksum(id)         → GET  /api/v3/backtest/datasets/{id}/checksum
 *  - runBacktestWithDataset()   → POST /api/backtest/run (with dataset_id binding)
 *  - batchVerifyAll()           → verify all snapshots in sequence
 *  - selectSnapshot(snap)       → set selected + load bars
 */

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
    setState: (partial: Partial<T>) => { state = { ...state, ...partial }; listeners.forEach(f => f()); },
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SourceManifest {
  provider: string;
  fetch_ms: number;
  checksum_algorithm: string;
  integrity: string;
  batch_id: string | null;
  batch_sha256: string | null;
}

export interface DatasetSnapshotInfo {
  dataset_id: string;
  symbol: string;
  start_date: string;
  end_date: string;
  provider: string;
  sha256: string;
  row_count: number;
  created_at: string;
  source_manifest: SourceManifest;
}

export interface DatasetBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: unknown;
}

export interface DatasetBarsResponse {
  dataset_id: string;
  row_count: number;
  bars: DatasetBar[];
  truncated: boolean;
}

export interface ChecksumVerification {
  dataset_id: string;
  stored_sha256: string;
  recomputed_sha256: string;
  integrity: 'verified' | 'CORRUPTED';
  row_count: number;
  verified_at?: string;
}

export interface BacktestProvenance {
  source: string;
  provider?: string;
  checksum?: string;
  dataset_id?: string;
  fetched_at?: string;
  cache_key?: string;
}

export interface BacktestRunResult {
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config_hash: string;
  started_at: string;
  completed_at: string;
  trades: Array<{
    trade_id: string;
    timestamp: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    fees: number;
    pnl: number | null;
  }>;
  equity_curve: Array<{ timestamp: string; equity: number }>;
  metrics: {
    total_return_pct: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
    total_trades: number;
    win_rate_pct: number;
    profit_factor: number;
    final_equity: number;
    [key: string]: number;
  } | null;
  provenance: BacktestProvenance | null;
  error?: string;
}

export interface DatasetStats {
  totalSnapshots: number;
  totalRows: number;
  uniqueSymbols: number;
  verifiedCount: number;
  corruptedCount: number;
  avgRowCount: number;
  oldestSnapshot: string | null;
  newestSnapshot: string | null;
  symbolDistribution: Record<string, number>;
}

export interface CreateSnapshotRequest {
  symbol: string;
  start_date: string;
  end_date: string;
  provider?: string;
}

export interface DatasetSnapshotState {
  snapshots: DatasetSnapshotInfo[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  selectedSnapshot: DatasetSnapshotInfo | null;
  selectedBars: DatasetBarsResponse | null;
  barsLoading: boolean;
  checksum: ChecksumVerification | null;
  checksumLoading: boolean;
  batchVerification: Map<string, ChecksumVerification>;
  batchVerifying: boolean;
  backtestResult: BacktestRunResult | null;
  backtestRunning: boolean;
  backtestError: string | null;
  stats: DatasetStats | null;
  lastRefresh: number | null;
}

const API = '/api/v3/backtest';
const BT_API = '/api/backtest';
const AUTH_TOKEN = 'apex-ui-session-token';

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' };
}

async function safeFetch(url: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 200) }; }
  if (!res.ok) {
    const msg = data?.message || data?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { status: res.status, data };
}

function computeStats(
  snapshots: DatasetSnapshotInfo[],
  verifications: Map<string, ChecksumVerification>,
): DatasetStats {
  const totalSnapshots = snapshots.length;
  const totalRows = snapshots.reduce((s, d) => s + d.row_count, 0);
  const symbols = new Set(snapshots.map(s => s.symbol));
  const avgRowCount = totalSnapshots > 0 ? Math.round(totalRows / totalSnapshots) : 0;
  let verifiedCount = 0;
  let corruptedCount = 0;
  for (const v of verifications.values()) {
    if (v.integrity === 'verified') verifiedCount++;
    else corruptedCount++;
  }
  const dates = snapshots.map(s => s.created_at).filter(Boolean).sort();
  const symbolDistribution: Record<string, number> = {};
  for (const s of snapshots) {
    symbolDistribution[s.symbol] = (symbolDistribution[s.symbol] || 0) + 1;
  }
  return {
    totalSnapshots, totalRows, uniqueSymbols: symbols.size,
    verifiedCount, corruptedCount, avgRowCount,
    oldestSnapshot: dates[0] ?? null, newestSnapshot: dates[dates.length - 1] ?? null,
    symbolDistribution,
  };
}

const store = createStore<DatasetSnapshotState>({
  snapshots: [], loading: false, creating: false, error: null,
  selectedSnapshot: null, selectedBars: null, barsLoading: false,
  checksum: null, checksumLoading: false,
  batchVerification: new Map(), batchVerifying: false,
  backtestResult: null, backtestRunning: false, backtestError: null,
  stats: null, lastRefresh: null,
});

async function fetchSnapshots(symbol?: string): Promise<void> {
  store.setState({ loading: true, error: null });
  try {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    const { data } = await safeFetch(`${API}/datasets${qs}`);
    const snapshots = data.datasets || [];
    const s = store.getSnapshot();
    const stats = computeStats(snapshots, s.batchVerification);
    store.setState({ snapshots, loading: false, stats, lastRefresh: Date.now() });
  } catch (err) {
    store.setState({ loading: false, error: String(err) });
  }
}

async function createSnapshot(req: CreateSnapshotRequest): Promise<DatasetSnapshotInfo | null> {
  store.setState({ creating: true, error: null });
  try {
    const { data } = await safeFetch(`${API}/datasets/snapshot`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(req),
    });
    store.setState({ creating: false });
    await fetchSnapshots();
    return data;
  } catch (err) {
    store.setState({ creating: false, error: String(err) });
    return null;
  }
}

async function fetchSnapshotById(id: string): Promise<DatasetSnapshotInfo | null> {
  store.setState({ loading: true, error: null, selectedSnapshot: null });
  try {
    const { data } = await safeFetch(`${API}/datasets/${id}`);
    store.setState({ selectedSnapshot: data, loading: false });
    return data;
  } catch (err) {
    store.setState({ loading: false, error: String(err) });
    return null;
  }
}

async function fetchSnapshotBars(id: string): Promise<DatasetBarsResponse | null> {
  store.setState({ barsLoading: true, error: null, selectedBars: null });
  try {
    const { data } = await safeFetch(`${API}/datasets/${id}/bars`);
    store.setState({ selectedBars: data, barsLoading: false });
    return data;
  } catch (err) {
    store.setState({ barsLoading: false, error: String(err) });
    return null;
  }
}

async function verifyChecksum(id: string): Promise<ChecksumVerification | null> {
  store.setState({ checksumLoading: true, error: null, checksum: null });
  try {
    const { data } = await safeFetch(`${API}/datasets/${id}/checksum`);
    const s = store.getSnapshot();
    const bv = new Map(s.batchVerification);
    bv.set(id, data);
    const stats = computeStats(s.snapshots, bv);
    store.setState({ checksum: data, checksumLoading: false, batchVerification: bv, stats });
    return data;
  } catch (err) {
    store.setState({ checksumLoading: false, error: String(err) });
    return null;
  }
}

async function batchVerifyAll(): Promise<void> {
  const { snapshots } = store.getSnapshot();
  store.setState({ batchVerifying: true, error: null });
  const bv = new Map<string, ChecksumVerification>();
  for (const snap of snapshots) {
    try {
      const { data } = await safeFetch(`${API}/datasets/${snap.dataset_id}/checksum`);
      bv.set(snap.dataset_id, data);
    } catch {
      bv.set(snap.dataset_id, {
        dataset_id: snap.dataset_id, stored_sha256: snap.sha256,
        recomputed_sha256: 'ERROR', integrity: 'CORRUPTED', row_count: snap.row_count,
      });
    }
  }
  const stats = computeStats(snapshots, bv);
  store.setState({ batchVerification: bv, batchVerifying: false, stats });
}

async function selectSnapshot(snap: DatasetSnapshotInfo | null): Promise<void> {
  store.setState({ selectedSnapshot: snap, selectedBars: null, checksum: null });
  if (snap) await fetchSnapshotBars(snap.dataset_id);
}

async function runBacktestWithDataset(config: {
  dataset_id: string; strategy_id: string; symbol: string;
  start_date: string; end_date: string;
  initial_capital?: number; slippage_bps?: number; fee_per_trade?: number; seed?: number;
}): Promise<BacktestRunResult | null> {
  store.setState({ backtestRunning: true, backtestError: null, backtestResult: null });
  try {
    const { data } = await safeFetch(`${BT_API}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_id: config.strategy_id, symbol: config.symbol,
        start_date: config.start_date, end_date: config.end_date,
        initial_capital: config.initial_capital ?? 100000,
        slippage_bps: config.slippage_bps ?? 5,
        fee_per_trade: config.fee_per_trade ?? 1.0,
        seed: config.seed ?? 42,
        dataset_id: config.dataset_id,
      }),
    });
    store.setState({ backtestResult: data, backtestRunning: false });
    return data;
  } catch (err) {
    store.setState({ backtestRunning: false, backtestError: String(err) });
    return null;
  }
}

function clearError(): void {
  store.setState({ error: null, backtestError: null });
}

function clearSelection(): void {
  store.setState({ selectedSnapshot: null, selectedBars: null, checksum: null });
}

export const datasetSnapshotStore = {
  ...store,
  fetchSnapshots, createSnapshot, fetchSnapshotById, fetchSnapshotBars,
  verifyChecksum, batchVerifyAll, selectSnapshot, runBacktestWithDataset,
  clearError, clearSelection,
};
