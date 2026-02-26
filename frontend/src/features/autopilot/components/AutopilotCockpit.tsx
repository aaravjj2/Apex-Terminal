/**
 * AutopilotCockpit — Phase 2 live cockpit UI
 *
 * Tabs: Overview · Health · Cycle Log · Positions · Orders · Universe
 * All data pulled from /api/ops/autopilot/* (Phase 0 endpoints).
 * Zero mocks — all state is real Alpaca paper data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  DollarSign,
  Flame,
  Globe,
  Heart,
  Layers,
  ListOrdered,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Sigma,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  opsApi,
  type OpsHealthCheck,
  type OpsHealthResponse,
  type OpsLastCycle,
  type OpsOrder,
  type OpsPosition,
  type OpsRunSummary,
  type OpsUniverseSymbol,
} from '../ops-api';
import { cn } from '../../../ui/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
};

const fmtPct = (v: number | string | null | undefined, multiply = false) => {
  if (v == null || v === '') return '—';
  const n = Number(v) * (multiply ? 100 : 1);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const fmtMs = (ms: number | null | undefined) => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const fmtAge = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
};

const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const regimeColor = (regime: string | null | undefined) => {
  switch ((regime ?? '').toLowerCase()) {
    case 'bull': return 'text-emerald-400';
    case 'bear': return 'text-red-400';
    case 'volatile': return 'text-orange-400';
    case 'chaos': return 'text-red-600 font-bold animate-pulse';
    case 'neutral': return 'text-sky-400';
    default: return 'text-slate-400';
  }
};

const regimeIcon = (regime: string | null | undefined) => {
  switch ((regime ?? '').toLowerCase()) {
    case 'bull': return <TrendingUp size={14} className="text-emerald-400" />;
    case 'bear': return <TrendingDown size={14} className="text-red-400" />;
    case 'volatile': return <Flame size={14} className="text-orange-400" />;
    case 'chaos': return <ShieldAlert size={14} className="text-red-600" />;
    default: return <Sigma size={14} className="text-sky-400" />;
  }
};

const statusDot = (ok: boolean, pulsing = false) => (
  <span
    className={cn(
      'inline-block h-2.5 w-2.5 rounded-full',
      ok ? 'bg-emerald-400' : 'bg-red-500',
      pulsing && ok && 'animate-pulse',
    )}
  />
);

// ─── Shared sub-components ─────────────────────────────────────────────────────

const Card: React.FC<{ title?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; 'data-testid'?: string }> = ({
  title,
  icon,
  children,
  className,
  'data-testid': testId,
}) => (
  <div
    className={cn('rounded-xl border border-border/50 bg-panel-bg/60 backdrop-blur-sm overflow-hidden', className)}
    data-testid={testId}
  >
    {title && (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-black/20">
        {icon}
        <span className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">{title}</span>
      </div>
    )}
    {children}
  </div>
);

const Pill: React.FC<{ label: string; variant?: 'ok' | 'warn' | 'err' | 'info' | 'neutral' }> = ({ label, variant = 'neutral' }) => {
  const colors = {
    ok: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    warn: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    err: 'bg-red-500/20 text-red-300 border-red-500/40',
    info: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    neutral: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-mono font-semibold border', colors[variant])}>
      {label}
    </span>
  );
};

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 size={18} className={cn('animate-spin text-sky-400', className)} />
);

// ─── Cockpit Tabs ─────────────────────────────────────────────────────────────

type CockpitTab = 'overview' | 'health' | 'cycle-log' | 'positions' | 'orders' | 'universe';

const COCKPIT_TABS: { id: CockpitTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Bot size={14} /> },
  { id: 'health', label: 'Health', icon: <Heart size={14} /> },
  { id: 'cycle-log', label: 'Cycle Log', icon: <Activity size={14} /> },
  { id: 'positions', label: 'Positions', icon: <Layers size={14} /> },
  { id: 'orders', label: 'Orders', icon: <ListOrdered size={14} /> },
  { id: 'universe', label: 'Universe', icon: <Globe size={14} /> },
];

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  health: OpsHealthResponse | null;
  lastCycle: OpsLastCycle | null;
  loading: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onRunNow: () => void;
  actionLoading: string | null;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  health,
  lastCycle,
  loading,
  onArm,
  onDisarm,
  onRunNow,
  actionLoading,
}) => {
  const state = health?.autopilot_state;
  const session = health?.market_session;
  const market = lastCycle?.market;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4" data-testid="cockpit-overview-tab">
      {/* Engine State Card */}
      <Card title="Engine State" icon={<Bot size={14} className="text-sky-400" />} data-testid="cockpit-engine-card">
        <div className="p-4 space-y-3">
          {loading ? (
            <Spinner />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Status</span>
                <div className="flex items-center gap-2">
                  {statusDot(state?.is_running ?? false, true)}
                  <span
                    className={cn(
                      'text-sm font-semibold uppercase',
                      state?.is_running ? 'text-emerald-400' : 'text-slate-400',
                    )}
                    data-testid="engine-running-status"
                  >
                    {state?.is_running ? 'RUNNING' : state?.current_phase ?? 'IDLE'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Phase</span>
                <Pill label={state?.current_phase ?? '—'} variant="info" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Cycles Run</span>
                <span className="text-sm font-mono font-semibold text-foreground" data-testid="cycle-count">
                  {state?.cycle_count ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Paper Verified</span>
                {state?.paper_verified ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 size={12} /> YES
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle size={12} /> NO
                  </span>
                )}
              </div>

              {state?.kill_switch && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-2">
                  <ShieldAlert size={14} className="text-red-400" />
                  <span className="text-xs font-bold text-red-300 uppercase">Kill Switch Active</span>
                </div>
              )}

              {state?.circuit_breaker_active && (
                <div className="flex items-center gap-2 rounded-lg bg-orange-500/20 border border-orange-500/50 px-3 py-2">
                  <AlertTriangle size={14} className="text-orange-400" />
                  <span className="text-xs font-bold text-orange-300 uppercase">Circuit Breaker ON</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            data-testid="cockpit-arm-btn"
            onClick={onArm}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold py-2 px-3 transition disabled:opacity-50"
          >
            {actionLoading === 'arm' ? <Spinner className="w-3 h-3" /> : <Play size={12} />}
            ARM
          </button>
          <button
            data-testid="cockpit-disarm-btn"
            onClick={onDisarm}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-600/80 hover:bg-slate-600 text-white text-xs font-semibold py-2 px-3 transition disabled:opacity-50"
          >
            {actionLoading === 'disarm' ? <Spinner className="w-3 h-3" /> : <Pause size={12} />}
            DISARM
          </button>
          <button
            data-testid="cockpit-run-now-btn"
            onClick={onRunNow}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-xs font-semibold py-2 px-3 transition disabled:opacity-50"
          >
            {actionLoading === 'run-now' ? <Spinner className="w-3 h-3" /> : <Zap size={12} />}
            RUN NOW
          </button>
        </div>
      </Card>

      {/* Market Regime Card */}
      <Card title="Market Regime" icon={<Globe size={14} className="text-sky-400" />} data-testid="cockpit-regime-card">
        <div className="p-4 space-y-3">
          {loading ? (
            <Spinner />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Session</span>
                <div className="flex items-center gap-2">
                  {statusDot(session?.allow_trading ?? false, session?.allow_trading)}
                  <span
                    className={cn(
                      'text-xs font-semibold uppercase',
                      session?.allow_trading ? 'text-emerald-400' : 'text-slate-400',
                    )}
                    data-testid="market-session-state"
                  >
                    {session?.state ?? '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Regime</span>
                <div className="flex items-center gap-1.5">
                  {regimeIcon(market?.regime)}
                  <span
                    className={cn('text-sm font-semibold uppercase', regimeColor(market?.regime))}
                    data-testid="market-regime"
                  >
                    {market?.regime ?? '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">VIX</span>
                <span
                  className={cn(
                    'text-sm font-mono font-semibold',
                    (market?.vix_level ?? 0) > 30 ? 'text-orange-400' : (market?.vix_level ?? 0) > 20 ? 'text-yellow-400' : 'text-emerald-400',
                  )}
                  data-testid="vix-level"
                >
                  {market?.vix_level != null ? market.vix_level.toFixed(2) : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">SPY 21d</span>
                <span
                  className={cn(
                    'text-sm font-mono font-semibold',
                    (market?.spy_change_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                  data-testid="spy-change"
                >
                  {market?.spy_change_pct != null ? fmtPct(market.spy_change_pct * 100) : '—'}
                </span>
              </div>

              {session?.reason && (
                <div className="rounded-lg bg-black/30 px-3 py-2">
                  <p className="text-xs text-muted-fg/70 leading-relaxed">{session.reason}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Last Cycle Card */}
      <Card title="Last Cycle" icon={<Clock size={14} className="text-sky-400" />} data-testid="cockpit-last-cycle-card">
        <div className="p-4 space-y-3">
          {loading ? (
            <Spinner />
          ) : lastCycle ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Run ID</span>
                <span className="text-xs font-mono text-foreground/70 truncate max-w-[120px]" data-testid="last-run-id">
                  {lastCycle.run_id}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Status</span>
                {lastCycle.success ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 size={12} /> SUCCESS
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                    <XCircle size={12} /> FAILED
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Duration</span>
                <span className="text-sm font-mono text-foreground" data-testid="last-cycle-duration">
                  {fmtMs(lastCycle.duration_ms)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Candidates</span>
                <span className="text-sm font-mono text-foreground">
                  {lastCycle.candidates_generated} gen / {lastCycle.candidates_selected} sel
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-fg">Orders</span>
                <span className="text-sm font-mono text-foreground">
                  {lastCycle.orders_placed} placed / {lastCycle.orders_filled} filled
                </span>
              </div>

              {lastCycle.gates_triggered.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-fg/70">Gates triggered:</span>
                  <div className="flex flex-wrap gap-1">
                    {lastCycle.gates_triggered.map((g) => (
                      <Pill key={g} label={g} variant="warn" />
                    ))}
                  </div>
                </div>
              )}

              {lastCycle.no_action_reasons.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-fg/70">No-action:</span>
                  <div className="flex flex-wrap gap-1">
                    {lastCycle.no_action_reasons.map((r, i) => (
                      <Pill key={i} label={r} variant="neutral" />
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-fg/50 text-right">{fmtAge(lastCycle.timestamp)}</div>
            </>
          ) : (
            <p className="text-sm text-muted-fg/60 italic text-center py-4">No cycles yet this session</p>
          )}
        </div>
      </Card>
    </div>
  );
};

// ─── Health Tab ────────────────────────────────────────────────────────────────

interface HealthTabProps {
  health: OpsHealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

const HealthCheckRow: React.FC<{ check: OpsHealthCheck }> = ({ check }) => {
  const isOk = check.status === 'ok';
  const isDegraded = check.status === 'degraded';
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-border/30 last:border-0 hover:bg-white/3 transition"
      data-testid={`health-check-${check.name}`}
    >
      <div className="flex items-center gap-3">
        {isOk ? (
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
        ) : isDegraded ? (
          <AlertTriangle size={15} className="text-yellow-400 shrink-0" />
        ) : (
          <XCircle size={15} className="text-red-400 shrink-0" />
        )}
        <span className="text-sm font-semibold text-foreground/90 capitalize">{check.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-fg/60 font-mono">{check.detail}</span>
        <span
          className={cn(
            'text-xs font-mono',
            check.latency_ms < 100 ? 'text-emerald-400' : check.latency_ms < 500 ? 'text-yellow-400' : 'text-red-400',
          )}
        >
          {fmtMs(check.latency_ms)}
        </span>
        <Pill
          label={check.status.toUpperCase()}
          variant={isOk ? 'ok' : isDegraded ? 'warn' : 'err'}
        />
      </div>
    </div>
  );
};

const HealthTab: React.FC<HealthTabProps> = ({ health, loading, onRefresh }) => (
  <div className="p-4 space-y-4" data-testid="cockpit-health-tab">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {health && (
          <>
            {statusDot(health.overall_status === 'ok')}
            <span
              className={cn(
                'text-sm font-semibold uppercase',
                health.overall_status === 'ok' ? 'text-emerald-400' : 'text-red-400',
              )}
              data-testid="health-overall-status"
            >
              {health.overall_status}
            </span>
          </>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-foreground transition"
        data-testid="health-refresh-btn"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>

    <Card data-testid="health-checks-card">
      {loading ? (
        <div className="p-8 flex justify-center">
          <Spinner />
        </div>
      ) : health?.checks.length ? (
        health.checks.map((c) => <HealthCheckRow key={c.name} check={c} />)
      ) : (
        <p className="text-sm text-muted-fg p-6 text-center">No health data</p>
      )}
    </Card>
  </div>
);

// ─── Cycle Log Tab ─────────────────────────────────────────────────────────────

interface CycleLogTabProps {
  runs: OpsRunSummary[];
  loading: boolean;
  onRefresh: () => void;
}

const CycleLogTab: React.FC<CycleLogTabProps> = ({ runs, loading, onRefresh }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-3" data-testid="cockpit-cycle-log-tab">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-fg">{runs.length} runs in session</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-foreground transition"
          data-testid="cycle-log-refresh-btn"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-panel-bg/40 p-8 text-center">
          <CircleDot size={24} className="mx-auto mb-3 text-muted-fg/40" />
          <p className="text-sm text-muted-fg/60 italic">No cycles recorded yet</p>
        </div>
      ) : (
        <div className="space-y-1.5" data-testid="cycle-log-list">
          {runs.map((run) => (
            <div
              key={run.run_id}
              className="rounded-lg border border-border/40 bg-panel-bg/40 overflow-hidden"
              data-testid={`cycle-row-${run.run_id}`}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition text-left"
                onClick={() => setExpanded(expanded === run.run_id ? null : run.run_id)}
              >
                <div className="flex items-center gap-3">
                  {run.success ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-red-400 shrink-0" />
                  )}
                  <span className="text-xs font-mono text-foreground/70">{run.run_id}</span>
                  <div className="flex items-center gap-1">
                    {regimeIcon(run.regime)}
                    <span className={cn('text-xs font-semibold uppercase', regimeColor(run.regime))}>
                      {run.regime}
                    </span>
                  </div>
                  {run.vix_level != null && (
                    <span className="text-xs font-mono text-muted-fg/60">VIX {run.vix_level.toFixed(1)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-fg/60">{fmtMs(run.duration_ms)}</span>
                  <span className="text-xs text-muted-fg/50">{fmtAge(run.timestamp)}</span>
                  {expanded === run.run_id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              </button>

              {expanded === run.run_id && (
                <div className="px-4 py-3 border-t border-border/30 bg-black/20 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-fg/60 mb-1">Candidates</p>
                    <p className="text-sm font-mono">
                      {run.candidates_generated} gen / {run.candidates_selected} sel
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-fg/60 mb-1">Orders Filled</p>
                    <p className="text-sm font-mono">{run.orders_filled}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-fg/60 mb-1">Market Open</p>
                    <p className="text-sm font-mono">{run.market_open ? 'YES' : 'NO'}</p>
                  </div>
                  {run.gates_triggered.length > 0 && (
                    <div className="sm:col-span-4">
                      <p className="text-xs text-muted-fg/60 mb-1.5">Gates triggered</p>
                      <div className="flex flex-wrap gap-1">
                        {run.gates_triggered.map((g) => (
                          <Pill key={g} label={g} variant="warn" />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-4">
                    <p className="text-xs text-muted-fg/40">{new Date(run.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Positions Tab ─────────────────────────────────────────────────────────────

interface PositionsTabProps {
  positions: OpsPosition[];
  loading: boolean;
  onRefresh: () => void;
}

const PositionsTab: React.FC<PositionsTabProps> = ({ positions, loading, onRefresh }) => (
  <div className="p-4 space-y-3" data-testid="cockpit-positions-tab">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-fg">{positions.length} open position{positions.length !== 1 ? 's' : ''}</span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-foreground transition"
        data-testid="positions-refresh-btn"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>

    {loading ? (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    ) : positions.length === 0 ? (
      <div className="rounded-xl border border-border/40 bg-panel-bg/40 p-8 text-center">
        <Wallet size={24} className="mx-auto mb-3 text-muted-fg/40" />
        <p className="text-sm text-muted-fg/60 italic">No open positions (paper account)</p>
      </div>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-border/40" data-testid="positions-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-black/30 text-xs text-muted-fg/60 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Symbol</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Avg Entry</th>
              <th className="text-right px-4 py-3">Current</th>
              <th className="text-right px-4 py-3">Mkt Value</th>
              <th className="text-right px-4 py-3">Unrealised P&L</th>
              <th className="text-right px-4 py-3">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const plNum = Number(p.unrealized_pl ?? 0);
              const plPct = Number(p.unrealized_plpc ?? 0) * 100;
              return (
                <tr
                  key={p.symbol}
                  className="border-b border-border/20 last:border-0 hover:bg-white/3 transition"
                  data-testid={`position-row-${p.symbol}`}
                >
                  <td className="px-4 py-3 font-semibold text-foreground">{p.symbol}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt$(p.avg_entry_price)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt$(p.current_price)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt$(p.market_value)}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-semibold', plNum >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmt$(plNum)}
                  </td>
                  <td className={cn('px-4 py-3 text-right font-mono', plPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmtPct(plPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ─── Orders Tab ────────────────────────────────────────────────────────────────

interface OrdersTabProps {
  orders: OpsOrder[];
  loading: boolean;
  onRefresh: () => void;
}

const statusVariant = (s: string): 'ok' | 'warn' | 'err' | 'info' | 'neutral' => {
  if (s === 'filled') return 'ok';
  if (s === 'canceled' || s === 'rejected') return 'err';
  if (s === 'pending_new' || s === 'new') return 'info';
  return 'neutral';
};

const OrdersTab: React.FC<OrdersTabProps> = ({ orders, loading, onRefresh }) => (
  <div className="p-4 space-y-3" data-testid="cockpit-orders-tab">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-fg">{orders.length} recent orders</span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-foreground transition"
        data-testid="orders-refresh-btn"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>

    {loading ? (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    ) : orders.length === 0 ? (
      <div className="rounded-xl border border-border/40 bg-panel-bg/40 p-8 text-center">
        <DollarSign size={24} className="mx-auto mb-3 text-muted-fg/40" />
        <p className="text-sm text-muted-fg/60 italic">No orders in paper account</p>
      </div>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-border/40" data-testid="orders-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-black/30 text-xs text-muted-fg/60 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Symbol</th>
              <th className="text-left px-4 py-3">Side</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Filled</th>
              <th className="text-right px-4 py-3">Avg Price</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-border/20 last:border-0 hover:bg-white/3 transition"
                data-testid={`order-row-${o.id}`}
              >
                <td className="px-4 py-3 font-semibold">{o.symbol}</td>
                <td className={cn('px-4 py-3 font-semibold uppercase text-xs', o.side === 'buy' ? 'text-emerald-400' : 'text-red-400')}>
                  {o.side}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-fg/70">{o.type}</td>
                <td className="px-4 py-3 text-right font-mono">{o.qty}</td>
                <td className="px-4 py-3 text-right font-mono">{o.filled_qty}</td>
                <td className="px-4 py-3 text-right font-mono">{o.filled_avg_price ? fmt$(o.filled_avg_price) : '—'}</td>
                <td className="px-4 py-3">
                  <Pill label={o.status.toUpperCase()} variant={statusVariant(o.status)} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-fg/60">{fmtTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ─── Universe Tab ──────────────────────────────────────────────────────────────

interface UniverseTabProps {
  symbols: OpsUniverseSymbol[];
  account: { equity: number | string; cash: number | string; buying_power: number | string; portfolio_value: number | string } | null;
  loading: boolean;
  onRefresh: () => void;
}

const UniverseTab: React.FC<UniverseTabProps> = ({ symbols, account, loading, onRefresh }) => (
  <div className="p-4 space-y-4" data-testid="cockpit-universe-tab">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-fg">{symbols.length} symbols in trading universe</span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-foreground transition"
        data-testid="universe-refresh-btn"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>

    {account && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="account-summary">
        {[
          { label: 'Portfolio Value', value: fmt$(account.portfolio_value) },
          { label: 'Equity', value: fmt$(account.equity) },
          { label: 'Cash', value: fmt$(account.cash) },
          { label: 'Buying Power', value: fmt$(account.buying_power) },
        ].map((item) => (
          <Card key={item.label}>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-muted-fg/60 mb-1">{item.label}</p>
              <p className="text-base font-mono font-semibold text-foreground">{item.value}</p>
            </div>
          </Card>
        ))}
      </div>
    )}

    {loading ? (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2" data-testid="universe-grid">
        {symbols.map((s) => (
          <div
            key={s.symbol}
            className="rounded-lg border border-border/40 bg-panel-bg/40 px-3 py-2 hover:border-sky-500/50 hover:bg-sky-500/5 transition"
            data-testid={`universe-symbol-${s.symbol}`}
          >
            <p className="text-sm font-bold text-foreground leading-none">{s.symbol}</p>
            <p className="text-xs text-muted-fg/60 mt-1 truncate">{s.sector}</p>
            <Pill label={s.liquidity_tier} variant="info" />
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Main Cockpit Component ────────────────────────────────────────────────────

export const AutopilotCockpit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CockpitTab>('overview');
  const [health, setHealth] = useState<OpsHealthResponse | null>(null);
  const [lastCycle, setLastCycle] = useState<OpsLastCycle | null>(null);
  const [runs, setRuns] = useState<OpsRunSummary[]>([]);
  const [positions, setPositions] = useState<OpsPosition[]>([]);
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [universeSymbols, setUniverseSymbols] = useState<OpsUniverseSymbol[]>([]);
  const [account, setAccount] = useState<UniverseTabProps['account']>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingUniverse, setLoadingUniverse] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const [h, c] = await Promise.all([opsApi.getHealth(), opsApi.getLastCycle()]);
      setHealth(h);
      if (c.has_cycle && c.cycle) setLastCycle(c.cycle);
    } catch (e) {
      console.error('Failed to load health/cycle', e);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await opsApi.getRuns(30);
      setRuns(res.runs ?? []);
    } catch (e) {
      console.error('Failed to load runs', e);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadPositions = useCallback(async () => {
    setLoadingPositions(true);
    try {
      const res = await opsApi.getPositions();
      setPositions(res.positions ?? []);
    } catch (e) {
      console.error('Failed to load positions', e);
    } finally {
      setLoadingPositions(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await opsApi.getOrders(25);
      setOrders(res.orders ?? []);
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadUniverse = useCallback(async () => {
    setLoadingUniverse(true);
    try {
      const [u, a] = await Promise.all([opsApi.getUniverse(), opsApi.getAccount()]);
      setUniverseSymbols(u.symbols ?? []);
      if (a.account) setAccount(a.account as UniverseTabProps['account']);
    } catch (e) {
      console.error('Failed to load universe/account', e);
    } finally {
      setLoadingUniverse(false);
    }
  }, []);

  // Initial load + periodic refresh every 30s
  useEffect(() => {
    loadHealth();
    loadRuns();
    loadPositions();
    loadOrders();
    loadUniverse();

    pollRef.current = setInterval(() => {
      loadHealth();
    }, 30_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHealth, loadRuns, loadPositions, loadOrders, loadUniverse]);

  // Reload tab-specific data when switching tabs
  useEffect(() => {
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'cycle-log') loadRuns();
    if (activeTab === 'positions') loadPositions();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'universe') loadUniverse();
  }, [activeTab, loadHealth, loadRuns, loadPositions, loadOrders, loadUniverse]);

  const handleArm = async () => {
    setActionLoading('arm');
    try {
      const res = await opsApi.arm();
      showToast(res.message, res.ok);
      await loadHealth();
    } catch (e: unknown) {
      showToast(`Arm failed: ${(e as Error).message}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisarm = async () => {
    setActionLoading('disarm');
    try {
      const res = await opsApi.disarm();
      showToast(res.message, res.ok);
      await loadHealth();
    } catch (e: unknown) {
      showToast(`Disarm failed: ${(e as Error).message}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunNow = async () => {
    setActionLoading('run-now');
    try {
      const res = await opsApi.runNow(true);
      showToast(res.message, res.ok);
      // Poll for result after 8 seconds
      setTimeout(async () => {
        await loadHealth();
        await loadRuns();
      }, 8000);
    } catch (e: unknown) {
      showToast(`Run failed: ${(e as Error).message}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="autopilot-cockpit">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur border transition',
            toast.ok
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
              : 'bg-red-500/20 border-red-500/50 text-red-200',
          )}
          data-testid="cockpit-toast"
        >
          {toast.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Cockpit Tab Bar */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 shrink-0 border-b border-border/40 bg-black/10">
        {COCKPIT_TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`cockpit-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            aria-selected={activeTab === t.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-lg border border-transparent transition-all',
              activeTab === t.id
                ? 'bg-panel-bg border-border/40 border-b-panel-bg text-foreground -mb-px'
                : 'text-muted-fg hover:text-foreground hover:bg-white/5',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'overview' && (
          <OverviewTab
            health={health}
            lastCycle={lastCycle}
            loading={loadingHealth}
            onArm={handleArm}
            onDisarm={handleDisarm}
            onRunNow={handleRunNow}
            actionLoading={actionLoading}
          />
        )}
        {activeTab === 'health' && (
          <HealthTab health={health} loading={loadingHealth} onRefresh={loadHealth} />
        )}
        {activeTab === 'cycle-log' && (
          <CycleLogTab runs={runs} loading={loadingRuns} onRefresh={loadRuns} />
        )}
        {activeTab === 'positions' && (
          <PositionsTab positions={positions} loading={loadingPositions} onRefresh={loadPositions} />
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} loading={loadingOrders} onRefresh={loadOrders} />
        )}
        {activeTab === 'universe' && (
          <UniverseTab
            symbols={universeSymbols}
            account={account}
            loading={loadingUniverse}
            onRefresh={loadUniverse}
          />
        )}
      </div>
    </div>
  );
};

export default AutopilotCockpit;
