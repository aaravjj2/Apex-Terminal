import React, { useState, useEffect, useCallback } from 'react'
// StrategyStudioV3UI2 — Bloomberg APEX Strategy Studio V3 terminal
// Strategy authoring, backtesting, templating, parameter optimization, version history
// Tabs: STRATEGIES | TEMPLATES | BACKTEST | ANALYTICS | AUDIT
// APIs: /api/v3/strategy-studio/strategies, /templates, /backtest, /analytics, /audit

const BG = '#0a0a0a'
const PANEL = '#111111'
const BORDER = '#1e1e1e'
const AMBER = '#f5a623'
const GREEN = '#26a69a'
const RED = '#ef5350'
const BLUE = '#42a5f5'
const PURPLE = '#ab47bc'
const ORANGE = '#ff8a65'
const SUBTLE = '#555'
const TEXT = '#d1d4dc'
const MONO = '"Roboto Mono","Courier New",monospace'

interface StrategyV3 {
  strategyId: string
  name: string
  strategyType: string
  symbols: string[]
  startDate: string
  endDate: string
  params: Record<string, unknown>
  version: number
  archived: boolean
  status: 'active' | 'draft' | 'archived' | 'running'
  totalReturn: number | null
  sharpeRatio: number | null
  maxDrawdown: number | null
  createdAt: string
  updatedAt: string
}

interface StrategyTemplate {
  templateId: string
  name: string
  strategyType: string
  description: string
  defaultSymbols: string[]
  defaultStartDate: string
  defaultEndDate: string
  defaultParams: Record<string, unknown>
  usageCount: number
}

interface BacktestResult {
  backtestId: string
  strategyId: string
  strategyName: string
  totalReturn: number
  annualizedReturn: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  winRatePct: number
  profitFactor: number
  totalTrades: number
  duration: number
  status: 'completed' | 'running' | 'failed'
  runAt: string
}

interface StrategyAnalytic {
  strategyId: string
  strategyName: string
  metricName: string
  value: number
  period: string
  rank: number
  percentile: number
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
}
function StatCard({ label, value, sub, col }: { label: string; value: string | number; sub?: string; col?: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: col || TEXT }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, draft: BLUE, archived: SUBTLE, running: AMBER, completed: GREEN, failed: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function Pct({ v, pos }: { v: number | null; pos?: boolean }) {
  if (v === null) return <span style={{ color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>—</span>
  const col = pos ? (v >= 0 ? GREEN : RED) : TEXT
  return <span style={{ color: col, fontFamily: MONO, fontSize: 11 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>
}


export function StrategyStudioV3UI2() {
  const [tab, setTab] = useState<'strategies' | 'templates' | 'backtest' | 'analytics' | 'audit'>('strategies')
  const [strategies, setStrategies] = useState<StrategyV3[]>([])
  const [templates, setTemplates] = useState<StrategyTemplate[]>([])
  const [backtests, setBacktests] = useState<BacktestResult[]>([])
  const [analytics, setAnalytics] = useState<StrategyAnalytic[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rT, rB, rA, rL] = await Promise.allSettled([
        fetch('/api/v3/strategy-studio/strategies').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/strategy-studio/templates').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/strategy-studio/backtest').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/strategy-studio/analytics').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/strategy-studio/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.strategies ?? rS.value.data ?? []
        setStrategies(raw.map((s: any) => ({
          strategyId: s.strategy_id ?? s.strategyId ?? s.id ?? '',
          name: s.name ?? '', strategyType: s.strategy_type ?? s.strategyType ?? '',
          symbols: s.symbols ?? [], startDate: s.start_date ?? s.startDate ?? '',
          endDate: s.end_date ?? s.endDate ?? '', params: s.params ?? {},
          version: Number(s.version ?? 1), archived: Boolean(s.archived),
          status: s.archived ? 'archived' : (s.status ?? 'active'),
          totalReturn: s.total_return ?? s.totalReturn ?? null,
          sharpeRatio: s.sharpe_ratio ?? s.sharpeRatio ?? null,
          maxDrawdown: s.max_drawdown ?? s.maxDrawdown ?? null,
          createdAt: s.created_at ?? s.createdAt ?? '',
          updatedAt: s.updated_at ?? s.updatedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load strategies')
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.templates ?? rT.value.data ?? []
        setTemplates(raw.map((t: any) => ({
          templateId: t.template_id ?? t.templateId ?? t.id ?? '',
          name: t.name ?? '', strategyType: t.strategy_type ?? t.strategyType ?? '',
          description: t.description ?? '',
          defaultSymbols: t.default_symbols ?? t.symbols ?? [],
          defaultStartDate: t.default_start_date ?? t.start_date ?? '',
          defaultEndDate: t.default_end_date ?? t.end_date ?? '',
          defaultParams: t.default_params ?? t.params ?? {},
          usageCount: Number(t.usage_count ?? t.usageCount ?? 0),
        })))
      }
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.backtests ?? rB.value.results ?? rB.value.data ?? []
        setBacktests(raw.map((b: any) => ({
          backtestId: b.backtest_id ?? b.backtestId ?? b.id ?? '',
          strategyId: b.strategy_id ?? b.strategyId ?? '',
          strategyName: b.strategy_name ?? b.strategyName ?? '',
          totalReturn: Number(b.total_return ?? b.totalReturn ?? 0),
          annualizedReturn: Number(b.annualized_return ?? b.annualizedReturn ?? 0),
          sharpeRatio: Number(b.sharpe_ratio ?? b.sharpeRatio ?? 0),
          sortinoRatio: Number(b.sortino_ratio ?? b.sortinoRatio ?? 0),
          maxDrawdown: Number(b.max_drawdown ?? b.maxDrawdown ?? 0),
          winRatePct: Number(b.win_rate_pct ?? b.winRatePct ?? 0),
          profitFactor: Number(b.profit_factor ?? b.profitFactor ?? 0),
          totalTrades: Number(b.total_trades ?? b.totalTrades ?? 0),
          duration: Number(b.duration_ms ?? b.duration ?? 0),
          status: b.status ?? 'completed', runAt: b.run_at ?? b.runAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.analytics ?? rA.value.data ?? []
        setAnalytics(raw.map((a: any) => ({
          strategyId: a.strategy_id ?? a.strategyId ?? '',
          strategyName: a.strategy_name ?? a.strategyName ?? '',
          metricName: a.metric_name ?? a.metricName ?? '',
          value: Number(a.value ?? 0), period: a.period ?? '1Y',
          rank: Number(a.rank ?? 0), percentile: Number(a.percentile ?? 0),
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.audit ?? rL.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const activeStrats = strategies.filter(s => s.status === 'active').length
  const avgSharpe = backtests.length ? (backtests.reduce((s, b) => s + b.sharpeRatio, 0) / backtests.length).toFixed(2) : '—'
  const bestReturn = backtests.length ? Math.max(...backtests.map(b => b.totalReturn)) : null
  const filtered = strategies.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.strategyType.toLowerCase().includes(search.toLowerCase()))

  const TABS2 = [
    { id: 'strategies' as const, label: 'STRATEGIES' },
    { id: 'templates' as const, label: 'TEMPLATES' },
    { id: 'backtest' as const, label: 'BACKTEST' },
    { id: 'analytics' as const, label: 'ANALYTICS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>STRATEGY STUDIO V3 — AUTHORING + BACKTEST + PARAMETER OPTIMIZATION + VERSION HISTORY</span>
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Strategies" value={activeStrats} col={BLUE} />
        <StatCard label="Total Strategies" value={strategies.length} col={TEXT} />
        <StatCard label="Avg Sharpe Ratio" value={avgSharpe} col={AMBER} />
        <StatCard label="Best Total Return" value={bestReturn !== null ? `${bestReturn >= 0 ? '+' : ''}${bestReturn.toFixed(1)}%` : '—'} col={bestReturn !== null && bestReturn >= 0 ? GREEN : RED} />
        <StatCard label="Templates" value={templates.length} col={PURPLE} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS2.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'strategies' && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name / type…"
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '5px 10px', width: 280 }} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>ID</Th><Th>Name</Th><Th>Type</Th><Th>Symbols</Th><Th>Status</Th><Th>Ver.</Th><Th right>Total Ret.</Th><Th right>Sharpe</Th><Th right>Max DD</Th><Th>Updated</Th></tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No strategies — check /api/v3/strategy-studio/strategies</td></tr>}
                  {filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((s, i) => (
                    <tr key={i} style={{ opacity: s.archived ? 0.5 : 1 }}>
                      <Td mono col={AMBER}>{s.strategyId}</Td>
                      <Td mono col={TEXT}>{s.name.slice(0, 30)}</Td>
                      <Td mono col={BLUE}>{s.strategyType}</Td>
                      <Td mono col={SUBTLE}>{s.symbols.slice(0, 3).join(', ')}{s.symbols.length > 3 ? `+${s.symbols.length - 3}` : ''}</Td>
                      <Td><StatusBadge s={s.status} /></Td>
                      <Td mono col={SUBTLE}>v{s.version}</Td>
                      <Td right><Pct v={s.totalReturn} pos /></Td>
                      <Td right mono col={s.sharpeRatio !== null ? (s.sharpeRatio >= 1 ? GREEN : s.sharpeRatio >= 0 ? AMBER : RED) : SUBTLE}>{s.sharpeRatio !== null ? s.sharpeRatio.toFixed(2) : '—'}</Td>
                      <Td right mono col={s.maxDrawdown !== null && s.maxDrawdown < -0.2 ? RED : AMBER}>{s.maxDrawdown !== null ? `${(s.maxDrawdown * 100).toFixed(1)}%` : '—'}</Td>
                      <Td mono col={SUBTLE}>{s.updatedAt || s.createdAt || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'templates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Template ID</Th><Th>Name</Th><Th>Type</Th><Th>Description</Th><Th>Default Symbols</Th><Th right>Usage</Th></tr></thead>
              <tbody>
                {templates.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No templates — check /api/v3/strategy-studio/templates</td></tr>}
                {templates.sort((a, b) => b.usageCount - a.usageCount).map((t, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{t.templateId}</Td>
                    <Td mono col={TEXT}>{t.name}</Td>
                    <Td mono col={BLUE}>{t.strategyType}</Td>
                    <Td mono col={SUBTLE}>{t.description.slice(0, 50)}</Td>
                    <Td mono col={SUBTLE}>{t.defaultSymbols.slice(0, 3).join(', ')}</Td>
                    <Td right mono col={TEXT}>{t.usageCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'backtest' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Backtest ID</Th><Th>Strategy</Th><Th>Status</Th><Th right>Total Ret.</Th><Th right>Annlzd Ret.</Th><Th right>Sharpe</Th><Th right>Sortino</Th><Th right>Max DD</Th><Th right>Win %</Th><Th right>Trades</Th></tr></thead>
              <tbody>
                {backtests.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No backtest results — check /api/v3/strategy-studio/backtest</td></tr>}
                {backtests.sort((a, b) => b.sharpeRatio - a.sharpeRatio).map((b, i) => (
                  <tr key={i} style={{ background: b.status === 'failed' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.backtestId}</Td>
                    <Td mono col={TEXT}>{b.strategyName.slice(0, 28)}</Td>
                    <Td><StatusBadge s={b.status} /></Td>
                    <Td right><Pct v={b.totalReturn} pos /></Td>
                    <Td right><Pct v={b.annualizedReturn} pos /></Td>
                    <Td right mono col={b.sharpeRatio >= 1 ? GREEN : b.sharpeRatio >= 0 ? AMBER : RED}>{b.sharpeRatio.toFixed(2)}</Td>
                    <Td right mono col={TEXT}>{b.sortinoRatio.toFixed(2)}</Td>
                    <Td right mono col={b.maxDrawdown < -20 ? RED : AMBER}>{b.maxDrawdown.toFixed(1)}%</Td>
                    <Td right mono col={b.winRatePct >= 50 ? GREEN : RED}>{b.winRatePct.toFixed(1)}%</Td>
                    <Td right mono col={TEXT}>{b.totalTrades}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'analytics' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Strategy ID</Th><Th>Strategy Name</Th><Th>Metric</Th><Th>Period</Th><Th right>Value</Th><Th right>Rank</Th><Th right>Percentile</Th></tr></thead>
              <tbody>
                {analytics.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No analytics — check /api/v3/strategy-studio/analytics</td></tr>}
                {analytics.sort((a, b) => b.percentile - a.percentile).map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.strategyId}</Td>
                    <Td mono col={TEXT}>{a.strategyName}</Td>
                    <Td mono col={BLUE}>{a.metricName}</Td>
                    <Td mono col={SUBTLE}>{a.period}</Td>
                    <Td right mono col={TEXT}>{a.value.toFixed(4)}</Td>
                    <Td right mono col={TEXT}>#{a.rank}</Td>
                    <Td right mono col={a.percentile >= 75 ? GREEN : a.percentile >= 25 ? AMBER : RED}>{a.percentile.toFixed(0)}th</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries — check /api/v3/strategy-studio/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || '—'}</Td>
                    <Td mono col={SUBTLE}>{a.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
