import React, { useState, useEffect, useCallback } from 'react'
﻿// PerformanceUI2 â€” Bloomberg PERF-grade performance analytics terminal
// Tabs: RETURNS | ATTRIBUTION | PEER COMPARISON | DRAWDOWN | METRICS
// APIs: /api/v1/performance/dashboard, /api/v1/performance/periods,
//       /api/v1/performance/strategies, /api/v4/performance/attribution,
//       /api/v4/performance/drawdown, /api/v4/performance/peer-comparison

const BG = '#0a0a0a'
const PANEL = '#111111'
const BORDER = '#1e1e1e'
const AMBER = '#f5a623'
const GREEN = '#26a69a'
const RED = '#ef5350'
const BLUE = '#42a5f5'
const PURPLE = '#ab47bc'
const FADED_RED = '#ef535055'
const SUBTLE = '#555'
const TEXT = '#d1d4dc'
const MONO = '"Roboto Mono","Courier New",monospace'

interface PerfDashboard {
  totalPnl: number
  unrealizedPnl: number
  realizedPnl: number
  totalReturn: number
  winRate: number
  sharpe: number
  sortino: number
  calmar: number
  maxDrawdown: number
  maxDrawdownDuration: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  totalTrades: number
  beta: number
  alpha: number
  informationRatio: number
  treynorRatio: number
  omega: number
  var95: number
  cvar95: number
  volatility: number
}

interface PeriodReturn {
  period: string
  returnPct: number
  pnl: number
  trades: number
  winRate: number
  sharpe: number
  maxDD: number
}

interface StrategyRow {
  id: string
  name: string
  returnPct: number
  sharpe: number
  winRate: number
  trades: number
  pnl: number
  maxDD: number
  alpha: number
  beta: number
  active: boolean
}

interface AttributionRow {
  asset: string
  weight: number
  portReturn: number
  bmkReturn: number
  allocation: number
  selection: number
  interaction: number
  total: number
}

interface DrawdownPeriod {
  start: string
  end: string | null
  trough: string
  drawdown: number
  recovery: number | null
  duration: number
  recoveryDays: number | null
}

interface PeerRow {
  fund: string
  ticker: string
  ytd: number
  oneYear: number
  sharpe: number
  maxDD: number
  beta: number
  aum: string
  isPortfolio: boolean
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReturnBadge({ v }: { v: number }) {
  const col = v > 0 ? GREEN : v < 0 ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: col }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

function StatCard({ label, value, sub, col, small }: { label: string; value: string | number; sub?: string; col?: string; small?: boolean }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: small ? '8px 12px' : '10px 14px' }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 15 : 18, fontFamily: MONO, fontWeight: 700, color: col || TEXT }}>{value}</div>
      {sub && <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
}

function fmtNum(v: number | null | undefined, dp = 2) {
  if (v === null || v === undefined) return 'â€”'
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function fmtPct(v: number | null | undefined, dp = 2) {
  if (v === null || v === undefined) return 'â€”'
  return `${v > 0 ? '+' : ''}${v.toFixed(dp)}%`
}

function PerfBar({ v, max }: { v: number; max: number }) {
  const w = max > 0 ? Math.min(100, Math.abs(v) / max * 100) : 0
  const col = v >= 0 ? GREEN : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', [v >= 0 ? 'left' : 'right']: 0, top: 0, bottom: 0, width: `${w}%`, background: col, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: col, minWidth: 52, textAlign: 'right' }}>{fmtPct(v)}</span>
    </div>
  )
}

function PeriodCard({ p }: { p: PeriodReturn }) {
  const col = p.returnPct > 0 ? GREEN : RED
  return (
    <div style={{ background: PANEL, border: `1px solid ${p.returnPct > 0 ? GREEN + '44' : RED + '44'}`, borderRadius: 4, padding: 12 }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{p.period}</div>
      <div style={{ fontSize: 22, fontFamily: MONO, fontWeight: 700, color: col }}>{p.returnPct > 0 ? '+' : ''}{p.returnPct.toFixed(2)}%</div>
      <div style={{ fontSize: 10, color: SUBTLE, marginTop: 4, fontFamily: MONO }}>P&L: ${(p.pnl / 1000).toFixed(1)}K</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
        <div><div style={{ fontSize: 8, color: SUBTLE }}>WIN RATE</div><div style={{ fontSize: 11, color: GREEN, fontFamily: MONO }}>{p.winRate.toFixed(1)}%</div></div>
        <div><div style={{ fontSize: 8, color: SUBTLE }}>SHARPE</div><div style={{ fontSize: 11, color: p.sharpe > 1 ? GREEN : p.sharpe > 0 ? AMBER : RED, fontFamily: MONO }}>{p.sharpe.toFixed(2)}</div></div>
        <div><div style={{ fontSize: 8, color: SUBTLE }}>TRADES</div><div style={{ fontSize: 11, color: TEXT, fontFamily: MONO }}>{p.trades}</div></div>
        <div><div style={{ fontSize: 8, color: SUBTLE }}>MAX DD</div><div style={{ fontSize: 11, color: RED, fontFamily: MONO }}>{p.maxDD.toFixed(1)}%</div></div>
      </div>
    </div>
  )
}

function DrawdownSVG({ periods }: { periods: DrawdownPeriod[] }) {
  if (periods.length === 0) return <div style={{ color: SUBTLE, fontSize: 11, textAlign: 'center', padding: 20 }}>No drawdown data</div>
  const maxDD = Math.max(...periods.map(p => Math.abs(p.drawdown)), 0.01)
  const W = 640, H = 120
  const pts = periods.map((p, i) => {
    const x = (i / Math.max(1, periods.length - 1)) * W
    const y = H - (Math.abs(p.drawdown) / maxDD) * (H - 10)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = `M 0,${H} L ${pts.join(' L ')} L ${W},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      <defs>
        <linearGradient id="ddgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED} stopOpacity="0.5" />
          <stop offset="100%" stopColor={RED} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={path} fill="url(#ddgrad)" />
      <polyline points={pts.join(' ')} fill="none" stroke={RED} strokeWidth="1.5" />
      <line x1="0" y1={H} x2={W} y2={H} stroke={BORDER} strokeWidth="1" />
    </svg>
  )
}

function AttrBar({ v }: { v: number }) {
  const abs = Math.abs(v)
  const col = v >= 0 ? GREEN : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: col, minWidth: 60, textAlign: 'right' }}>{fmtPct(v, 3)}</span>
      <div style={{ width: 50, height: 5, background: BORDER, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', [v >= 0 ? 'left' : 'right']: 0, top: 0, bottom: 0, width: `${Math.min(100, abs * 500)}%`, background: col }} />
      </div>
    </div>
  )
}


export function PerformanceUI2() {
  const [tab, setTab] = useState<'returns' | 'attribution' | 'peers' | 'drawdown' | 'metrics'>('returns')
  const [dashboard, setDashboard] = useState<PerfDashboard | null>(null)
  const [periods, setPeriods] = useState<PeriodReturn[]>([])
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [attribution, setAttribution] = useState<AttributionRow[]>([])
  const [ddPeriods, setDDPeriods] = useState<DrawdownPeriod[]>([])
  const [peers, setPeers] = useState<PeerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [stratSort, setStratSort] = useState<keyof StrategyRow>('pnl')
  const [bmk, setBmk] = useState('SPY')
  const [peerSym, setPeerSym] = useState('SPY,QQQ,IWM,AGG,GLD')

  const fetchDashboard = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/performance/dashboard')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const x = d.data ?? d
      setDashboard({
        totalPnl: Number(x.total_pnl ?? 0),
        unrealizedPnl: Number(x.unrealized_pnl ?? 0),
        realizedPnl: Number(x.realized_pnl ?? 0),
        totalReturn: Number(x.total_return ?? 0),
        winRate: Number(x.win_rate ?? 0),
        sharpe: Number(x.sharpe_ratio ?? x.sharpe ?? 0),
        sortino: Number(x.sortino_ratio ?? x.sortino ?? 0),
        calmar: Number(x.calmar_ratio ?? x.calmar ?? 0),
        maxDrawdown: Number(x.max_drawdown ?? 0),
        maxDrawdownDuration: Number(x.max_drawdown_duration ?? 0),
        avgWin: Number(x.avg_win ?? 0),
        avgLoss: Number(x.avg_loss ?? 0),
        profitFactor: Number(x.profit_factor ?? 0),
        totalTrades: Number(x.total_trades ?? 0),
        beta: Number(x.beta ?? 0),
        alpha: Number(x.alpha ?? 0),
        informationRatio: Number(x.information_ratio ?? 0),
        treynorRatio: Number(x.treynor_ratio ?? 0),
        omega: Number(x.omega_ratio ?? x.omega ?? 0),
        var95: Number(x.var_95 ?? x.var ?? 0),
        cvar95: Number(x.cvar_95 ?? x.cvar ?? 0),
        volatility: Number(x.volatility ?? x.annual_vol ?? 0),
      })
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [])

  const fetchPeriods = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/performance/periods')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.periods ?? d.data ?? []
      setPeriods(raw.map((p: any) => ({
        period: p.period ?? p.label ?? '',
        returnPct: Number(p.return_pct ?? p.return ?? 0),
        pnl: Number(p.pnl ?? 0),
        trades: Number(p.trades ?? 0),
        winRate: Number(p.win_rate ?? 0),
        sharpe: Number(p.sharpe_ratio ?? p.sharpe ?? 0),
        maxDD: Number(p.max_drawdown ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchStrategies = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/performance/strategies')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.strategies ?? d.data ?? []
      setStrategies(raw.map((s: any) => ({
        id: s.strategy_id ?? s.id ?? String(Math.random()),
        name: s.name ?? s.strategy_id ?? '',
        returnPct: Number(s.return_pct ?? s.return ?? 0),
        sharpe: Number(s.sharpe_ratio ?? s.sharpe ?? 0),
        winRate: Number(s.win_rate ?? 0),
        trades: Number(s.trades ?? 0),
        pnl: Number(s.pnl ?? 0),
        maxDD: Number(s.max_drawdown ?? 0),
        alpha: Number(s.alpha ?? 0),
        beta: Number(s.beta ?? 0),
        active: Boolean(s.active ?? true),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchAttribution = useCallback(async (benchmark: string) => {
    try {
      const r = await fetch(`/api/v4/performance/attribution?benchmark=${benchmark}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.attribution ?? d.data ?? []
      setAttribution(raw.map((a: any) => ({
        asset: a.asset ?? a.symbol ?? '',
        weight: Number(a.weight ?? 0),
        portReturn: Number(a.portfolio_return ?? a.port_return ?? 0),
        bmkReturn: Number(a.benchmark_return ?? a.bmk_return ?? 0),
        allocation: Number(a.allocation_effect ?? a.allocation ?? 0),
        selection: Number(a.selection_effect ?? a.selection ?? 0),
        interaction: Number(a.interaction_effect ?? a.interaction ?? 0),
        total: Number(a.total_effect ?? a.total ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchDrawdown = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/performance/drawdown')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.drawdowns ?? d.data ?? []
      setDDPeriods(raw.map((x: any) => ({
        start: x.start ?? '',
        end: x.end ?? null,
        trough: x.trough ?? x.min_date ?? '',
        drawdown: Number(x.drawdown ?? x.max_drawdown ?? 0),
        recovery: x.recovery != null ? Number(x.recovery) : null,
        duration: Number(x.duration ?? 0),
        recoveryDays: x.recovery_days != null ? Number(x.recovery_days) : null,
      })))
    } catch { /* empty */ }
  }, [])

  const fetchPeers = useCallback(async (symbols: string) => {
    try {
      const r = await fetch(`/api/v4/performance/peer-comparison?symbols=${symbols}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.peers ?? d.data ?? []
      setPeers(raw.map((p: any, i: number) => ({
        fund: p.name ?? p.fund ?? p.symbol ?? '',
        ticker: p.ticker ?? p.symbol ?? '',
        ytd: Number(p.ytd ?? 0),
        oneYear: Number(p.one_year ?? p['1y'] ?? 0),
        sharpe: Number(p.sharpe ?? 0),
        maxDD: Number(p.max_drawdown ?? 0),
        beta: Number(p.beta ?? 0),
        aum: p.aum ?? p.market_cap ?? 'â€”',
        isPortfolio: i === 0 || Boolean(p.is_portfolio),
      })))
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDashboard(), fetchPeriods(), fetchStrategies(), fetchDrawdown()])
      .finally(() => setLoading(false))
    fetchAttribution(bmk)
    fetchPeers(peerSym)
  }, [fetchDashboard, fetchPeriods, fetchStrategies, fetchDrawdown, fetchAttribution, fetchPeers, bmk, peerSym])

  // â”€â”€ sorted strategies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sortedStrats = [...strategies].sort((a, b) => {
    const av = a[stratSort as keyof StrategyRow] as number
    const bv = b[stratSort as keyof StrategyRow] as number
    return bv - av
  })

  // â”€â”€ attribution totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const attrTotal = attribution.reduce((s, a) => ({ alloc: s.alloc + a.allocation, sel: s.sel + a.selection, int: s.int + a.interaction, tot: s.tot + a.total }), { alloc: 0, sel: 0, int: 0, tot: 0 })
  const maxAttrAbs = Math.max(...attribution.map(a => Math.abs(a.total)), 0.0001)

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabs = [
    { id: 'returns' as const, label: 'RETURNS' },
    { id: 'attribution' as const, label: 'ATTRIBUTION' },
    { id: 'peers' as const, label: 'PEER COMPARISON' },
    { id: 'drawdown' as const, label: 'DRAWDOWN' },
    { id: 'metrics' as const, label: 'METRICS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>PERF</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>PERFORMANCE ANALYTICS</span>
          {dashboard && (
            <span style={{ fontSize: 11, color: dashboard.totalReturn > 0 ? GREEN : RED, fontWeight: 700 }}>
              {dashboard.totalReturn > 0 ? '+' : ''}{dashboard.totalReturn.toFixed(2)}% Total Return
            </span>
          )}
        </div>
        <button onClick={() => { fetchDashboard(); fetchPeriods(); fetchStrategies(); fetchDrawdown() }}
          style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: '#161616', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
          â†» REFRESH
        </button>
      </div>

      {/* â”€â”€ STATS STRIP â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Return" value={dashboard ? fmtPct(dashboard.totalReturn) : 'â€”'} col={dashboard ? (dashboard.totalReturn > 0 ? GREEN : RED) : SUBTLE} />
        <StatCard label="Total P&L" value={dashboard ? `$${(dashboard.totalPnl / 1000).toFixed(1)}K` : 'â€”'} col={dashboard ? (dashboard.totalPnl > 0 ? GREEN : RED) : SUBTLE} />
        <StatCard label="Sharpe" value={dashboard ? fmtNum(dashboard.sharpe) : 'â€”'} col={dashboard ? (dashboard.sharpe > 1 ? GREEN : dashboard.sharpe > 0 ? AMBER : RED) : SUBTLE} />
        <StatCard label="Max Drawdown" value={dashboard ? `${dashboard.maxDrawdown.toFixed(1)}%` : 'â€”'} col={RED} />
        <StatCard label="Win Rate" value={dashboard ? `${dashboard.winRate.toFixed(1)}%` : 'â€”'} col={dashboard ? (dashboard.winRate > 55 ? GREEN : dashboard.winRate > 45 ? AMBER : RED) : SUBTLE} />
        <StatCard label="Profit Factor" value={dashboard ? fmtNum(dashboard.profitFactor) : 'â€”'} col={dashboard ? (dashboard.profitFactor > 1.5 ? GREEN : dashboard.profitFactor > 1 ? AMBER : RED) : SUBTLE} />
        <StatCard label="Volatility" value={dashboard ? `${dashboard.volatility.toFixed(1)}%` : 'â€”'} col={SUBTLE} />
      </div>

      {/* â”€â”€ TABS â”€â”€ */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ BODY â”€â”€ */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading...</div>}

        {/* â”€â”€ RETURNS TAB â”€â”€ */}
        {tab === 'returns' && (
          <>
            {/* period cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
              {periods.map(p => <PeriodCard key={p.period} p={p} />)}
              {periods.length === 0 && <div style={{ color: SUBTLE, fontSize: 11, gridColumn: '1/-1' }}>No period data â€” check /api/v1/performance/periods</div>}
            </div>

            {/* strategies table */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: SUBTLE }}>STRATEGY BREAKDOWN â€” {strategies.length} strategies</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['pnl', 'returnPct', 'sharpe', 'winRate'] as const).map(s => (
                    <button key={s} onClick={() => setStratSort(s)}
                      style={{ fontFamily: MONO, fontSize: 9, color: stratSort === s ? AMBER : SUBTLE, background: stratSort === s ? '#1a1200' : 'transparent',
                        border: `1px solid ${stratSort === s ? AMBER : BORDER}`, borderRadius: 2, padding: '2px 6px', cursor: 'pointer', textTransform: 'uppercase' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Strategy</Th><Th right>Return</Th><Th right>P&L</Th>
                    <Th right>Sharpe</Th><Th right>Win Rate</Th><Th right>Trades</Th>
                    <Th right>Max DD</Th><Th right>Alpha</Th><Th right>Beta</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStrats.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No strategies â€” check /api/v1/performance/strategies
                    </td></tr>
                  )}
                  {sortedStrats.map(s => (
                    <tr key={s.id}>
                      <Td><span style={{ fontWeight: 600, color: TEXT }}>{s.name}</span></Td>
                      <Td right><ReturnBadge v={s.returnPct} /></Td>
                      <Td right mono col={s.pnl >= 0 ? GREEN : RED}>${(s.pnl / 1000).toFixed(1)}K</Td>
                      <Td right mono col={s.sharpe > 1 ? GREEN : s.sharpe > 0 ? AMBER : RED}>{fmtNum(s.sharpe)}</Td>
                      <Td right mono col={s.winRate > 55 ? GREEN : s.winRate > 45 ? AMBER : RED}>{s.winRate.toFixed(1)}%</Td>
                      <Td right mono>{s.trades}</Td>
                      <Td right mono col={RED}>{s.maxDD.toFixed(1)}%</Td>
                      <Td right mono col={s.alpha > 0 ? GREEN : RED}>{fmtPct(s.alpha, 3)}</Td>
                      <Td right mono col={SUBTLE}>{fmtNum(s.beta)}</Td>
                      <Td><span style={{ fontSize: 9, color: s.active ? GREEN : SUBTLE, background: s.active ? '#0a1a18' : BORDER, border: `1px solid ${s.active ? GREEN : SUBTLE}33`, borderRadius: 2, padding: '2px 5px', fontFamily: MONO, textTransform: 'uppercase' }}>{s.active ? 'ACTIVE' : 'INACTIVE'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* monthly return grid placeholder */}
            <div style={{ marginTop: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Monthly Returns Grid</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 2 }}>
                {['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m, i) => (
                  <div key={m + i} style={{ fontSize: 9, fontFamily: MONO, color: i === 0 ? TEXT : SUBTLE, textAlign: 'center', padding: 3, fontWeight: i === 0 ? 700 : 400 }}>{m}</div>
                ))}
                {[2022, 2023, 2024, 2025].map(year => {
                  const yearPeriods = periods.filter(p => p.period?.includes(String(year)))
                  const yearReturn = yearPeriods.reduce((s, p) => s + p.returnPct, 0)
                  return (
                    <React.Fragment key={year}>
                      <div style={{ fontSize: 9, fontFamily: MONO, color: TEXT, textAlign: 'center', padding: 3, fontWeight: 700 }}>{year}</div>
                      {Array.from({ length: 12 }, (_, m) => {
                        const monthPeriod = yearPeriods.find(p => p.period?.includes(`${year}-${(m + 1).toString().padStart(2, '0')}`))
                        const v = monthPeriod?.returnPct ?? null
                        const bg = v === null ? BORDER : v > 0 ? `rgba(38,166,154,${Math.min(0.8, Math.abs(v) / 10)})` : `rgba(239,83,80,${Math.min(0.8, Math.abs(v) / 10)})`
                        return (
                          <div key={m} title={v !== null ? `${fmtPct(v)}` : 'â€”'} style={{ fontSize: 8, fontFamily: MONO, color: v === null ? SUBTLE : '#fff', textAlign: 'center', padding: 3, background: bg, borderRadius: 2 }}>
                            {v !== null ? (v > 0 ? '+' : '') + v.toFixed(1) : 'â€”'}
                          </div>
                        )
                      })}
                      <div style={{ fontSize: 9, fontFamily: MONO, color: yearReturn >= 0 ? GREEN : RED, textAlign: 'center', padding: 3, fontWeight: 700, background: yearReturn >= 0 ? '#0a1a18' : '#1a0a0a', borderRadius: 2 }}>
                        {yearReturn >= 0 ? '+' : ''}{yearReturn.toFixed(1)}%
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* â”€â”€ ATTRIBUTION TAB â”€â”€ */}
        {tab === 'attribution' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: SUBTLE }}>BENCHMARK:</span>
              <input value={bmk} onChange={e => setBmk(e.target.value.toUpperCase())}
                style={{ fontFamily: MONO, fontSize: 12, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: 80, outline: 'none' }} />
              <button onClick={() => fetchAttribution(bmk)}
                style={{ fontFamily: MONO, fontSize: 11, color: AMBER, background: '#0d0d0d', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '5px 10px', cursor: 'pointer' }}>
                RUN BRINSON
              </button>
              {['SPY', 'QQQ', 'IWM', 'AGG'].map(b => (
                <button key={b} onClick={() => { setBmk(b); fetchAttribution(b) }}
                  style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 7px', cursor: 'pointer' }}>{b}</button>
              ))}
            </div>

            {/* attribution summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              <StatCard label="Allocation Effect" value={fmtPct(attrTotal.alloc, 3)} col={attrTotal.alloc >= 0 ? GREEN : RED} />
              <StatCard label="Selection Effect" value={fmtPct(attrTotal.sel, 3)} col={attrTotal.sel >= 0 ? GREEN : RED} />
              <StatCard label="Interaction Effect" value={fmtPct(attrTotal.int, 3)} col={attrTotal.int >= 0 ? GREEN : RED} />
              <StatCard label="Total Active Return" value={fmtPct(attrTotal.tot, 3)} col={attrTotal.tot >= 0 ? GREEN : RED} />
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Asset / Sector</Th>
                    <Th right>Weight</Th><Th right>Port Return</Th><Th right>Bmk Return</Th>
                    <Th right>Allocation</Th><Th right>Selection</Th><Th right>Interaction</Th><Th right>Total Effect</Th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No attribution data â€” select benchmark and run Brinson
                    </td></tr>
                  )}
                  {attribution.map(a => (
                    <tr key={a.asset}>
                      <Td mono col={AMBER}>{a.asset}</Td>
                      <Td right mono>{(a.weight * 100).toFixed(1)}%</Td>
                      <Td right><ReturnBadge v={a.portReturn * 100} /></Td>
                      <Td right mono col={SUBTLE}>{fmtPct(a.bmkReturn * 100)}</Td>
                      <Td right><AttrBar v={a.allocation} /></Td>
                      <Td right><AttrBar v={a.selection} /></Td>
                      <Td right><AttrBar v={a.interaction} /></Td>
                      <Td right><AttrBar v={a.total} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BHB decomp chart */}
            {attribution.length > 0 && (
              <div style={{ marginTop: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Brinson-Hood-Beebower Attribution Waterfall</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
                  {attribution.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 12).map(a => {
                    const h = Math.round((Math.abs(a.total) / maxAttrAbs) * 70)
                    const col = a.total >= 0 ? GREEN : RED
                    return (
                      <div key={a.asset} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', height: h, background: col + '55', border: `1px solid ${col}`, borderRadius: '2px 2px 0 0' }} title={`${a.asset}: ${fmtPct(a.total, 3)}`} />
                        <div style={{ fontSize: 7, color: SUBTLE, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{a.asset.slice(0, 4)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* â”€â”€ PEER COMPARISON TAB â”€â”€ */}
        {tab === 'peers' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: SUBTLE }}>PEERS:</span>
              <input value={peerSym} onChange={e => setPeerSym(e.target.value.toUpperCase())}
                style={{ fontFamily: MONO, fontSize: 12, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: 240, outline: 'none' }} />
              <button onClick={() => fetchPeers(peerSym)}
                style={{ fontFamily: MONO, fontSize: 11, color: AMBER, background: '#0d0d0d', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '5px 10px', cursor: 'pointer' }}>
                COMPARE
              </button>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Fund / ETF</Th><Th right>YTD</Th><Th right>1Y Return</Th>
                    <Th right>Sharpe</Th><Th right>Max DD</Th><Th right>Beta</Th><Th>AUM</Th>
                  </tr>
                </thead>
                <tbody>
                  {peers.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No peer data â€” enter symbols and click Compare
                    </td></tr>
                  )}
                  {peers.map(p => (
                    <tr key={p.ticker} style={{ background: p.isPortfolio ? '#0d1a0d' : 'transparent', borderLeft: p.isPortfolio ? `3px solid ${GREEN}` : `3px solid transparent` }}>
                      <Td><span style={{ fontWeight: p.isPortfolio ? 700 : 400, color: p.isPortfolio ? GREEN : TEXT }}>{p.fund || p.ticker}{p.isPortfolio && ' (Portfolio)'}</span></Td>
                      <Td right><ReturnBadge v={p.ytd} /></Td>
                      <Td right><ReturnBadge v={p.oneYear} /></Td>
                      <Td right mono col={p.sharpe > 1 ? GREEN : p.sharpe > 0 ? AMBER : RED}>{fmtNum(p.sharpe)}</Td>
                      <Td right mono col={RED}>{p.maxDD.toFixed(1)}%</Td>
                      <Td right mono col={SUBTLE}>{fmtNum(p.beta)}</Td>
                      <Td mono col={SUBTLE}>{p.aum}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* visual comparison bars */}
            {peers.length > 0 && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>YTD Return Comparison</div>
                {peers.map(p => {
                  const maxAbs = Math.max(...peers.map(x => Math.abs(x.ytd)), 1)
                  return (
                    <div key={p.ticker} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 60, fontSize: 11, color: p.isPortfolio ? GREEN : TEXT, fontFamily: MONO, fontWeight: p.isPortfolio ? 700 : 400 }}>{p.ticker}</div>
                      <PerfBar v={p.ytd} max={maxAbs} />
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* â”€â”€ DRAWDOWN TAB â”€â”€ */}
        {tab === 'drawdown' && (
          <>
            {/* drawdown chart */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Underwater Chart</div>
              <DrawdownSVG periods={ddPeriods} />
            </div>

            {/* summary stats */}
            {dashboard && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <StatCard label="Max Drawdown" value={`${dashboard.maxDrawdown.toFixed(2)}%`} col={RED} />
                <StatCard label="DD Duration" value={`${dashboard.maxDrawdownDuration} days`} col={SUBTLE} />
                <StatCard label="Calmar Ratio" value={fmtNum(dashboard.calmar)} col={dashboard.calmar > 0.5 ? GREEN : RED} />
                <StatCard label="Sortino Ratio" value={fmtNum(dashboard.sortino)} col={dashboard.sortino > 1 ? GREEN : RED} />
              </div>
            )}

            {/* drawdown periods table */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: SUBTLE }}>
                TOP DRAWDOWN PERIODS â€” {ddPeriods.length} periods
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Start</Th><Th>Trough</Th><Th>End</Th>
                    <Th right>Drawdown</Th><Th right>Duration</Th><Th right>Recovery</Th><Th right>Recovery Days</Th>
                  </tr>
                </thead>
                <tbody>
                  {ddPeriods.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No drawdown data â€” check /api/v4/performance/drawdown
                    </td></tr>
                  )}
                  {ddPeriods.sort((a, b) => Math.abs(b.drawdown) - Math.abs(a.drawdown)).map((p, i) => (
                    <tr key={i} style={{ borderLeft: i === 0 ? `3px solid ${RED}` : `3px solid transparent` }}>
                      <Td mono col={SUBTLE}>{p.start}</Td>
                      <Td mono col={RED}>{p.trough}</Td>
                      <Td mono col={SUBTLE}>{p.end ?? 'Ongoing'}</Td>
                      <Td right mono col={RED}>{p.drawdown.toFixed(2)}%</Td>
                      <Td right mono>{p.duration} days</Td>
                      <Td right mono col={p.recovery !== null ? (p.recovery > 0 ? GREEN : RED) : AMBER}>
                        {p.recovery !== null ? fmtPct(p.recovery) : 'In progress'}
                      </Td>
                      <Td right mono col={SUBTLE}>{p.recoveryDays !== null ? `${p.recoveryDays}d` : 'â€”'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ METRICS TAB â”€â”€ */}
        {tab === 'metrics' && dashboard && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {/* Risk-Adjusted Returns */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: AMBER, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Risk-Adjusted Returns</div>
                {[
                  ['Sharpe Ratio', dashboard.sharpe, dashboard.sharpe > 1 ? GREEN : dashboard.sharpe > 0 ? AMBER : RED, '> 1.0 is good'],
                  ['Sortino Ratio', dashboard.sortino, dashboard.sortino > 1 ? GREEN : dashboard.sortino > 0 ? AMBER : RED, 'downside-only risk'],
                  ['Calmar Ratio', dashboard.calmar, dashboard.calmar > 0.5 ? GREEN : RED, 'return / maxDD'],
                  ['Treynor Ratio', dashboard.treynorRatio, dashboard.treynorRatio > 0 ? GREEN : RED, 'return per unit Î²'],
                  ['Information Ratio', dashboard.informationRatio, dashboard.informationRatio > 0.5 ? GREEN : RED, 'active return / tracking error'],
                  ['Omega Ratio', dashboard.omega, dashboard.omega > 1 ? GREEN : RED, 'weighted gains / losses'],
                ].map(([l, v, c, d]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <div>
                      <div style={{ fontSize: 12, color: TEXT }}>{l as string}</div>
                      <div style={{ fontSize: 9, color: SUBTLE }}>{d as string}</div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: c as string }}>{fmtNum(v as number)}</span>
                  </div>
                ))}
              </div>

              {/* Risk Metrics */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: RED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Risk Metrics</div>
                {[
                  ['Annual Volatility', `${dashboard.volatility.toFixed(2)}%`, dashboard.volatility > 30 ? RED : dashboard.volatility > 15 ? AMBER : GREEN],
                  ['VaR 95% (1-day)', `${dashboard.var95.toFixed(2)}%`, RED],
                  ['CVaR 95% (1-day)', `${dashboard.cvar95.toFixed(2)}%`, RED],
                  ['Beta', fmtNum(dashboard.beta), SUBTLE],
                  ['Alpha (annualized)', fmtPct(dashboard.alpha), dashboard.alpha > 0 ? GREEN : RED],
                  ['Max Drawdown', `${dashboard.maxDrawdown.toFixed(2)}%`, RED],
                  ['DD Duration', `${dashboard.maxDrawdownDuration} days`, SUBTLE],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 12, color: TEXT }}>{l as string}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: c as string }}>{v as string}</span>
                  </div>
                ))}
              </div>

              {/* Trade Statistics */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Trade Statistics</div>
                {[
                  ['Total Trades', String(dashboard.totalTrades), TEXT],
                  ['Win Rate', `${dashboard.winRate.toFixed(1)}%`, dashboard.winRate > 55 ? GREEN : dashboard.winRate > 45 ? AMBER : RED],
                  ['Profit Factor', fmtNum(dashboard.profitFactor), dashboard.profitFactor > 1.5 ? GREEN : dashboard.profitFactor > 1 ? AMBER : RED],
                  ['Avg Win', `$${fmtNum(dashboard.avgWin)}`, GREEN],
                  ['Avg Loss', `$${fmtNum(Math.abs(dashboard.avgLoss))}`, RED],
                  ['Win/Loss Ratio', `${(Math.abs(dashboard.avgWin) / Math.max(Math.abs(dashboard.avgLoss), 0.01)).toFixed(2)}`, AMBER],
                  ['Avg Win Days', 'â€”', SUBTLE],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 12, color: TEXT }}>{l as string}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: c as string }}>{v as string}</span>
                  </div>
                ))}
              </div>

              {/* P&L Summary */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: GREEN, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>P&L Summary</div>
                {[
                  ['Total P&L', `$${(dashboard.totalPnl / 1000).toFixed(2)}K`, dashboard.totalPnl > 0 ? GREEN : RED],
                  ['Realized P&L', `$${(dashboard.realizedPnl / 1000).toFixed(2)}K`, dashboard.realizedPnl > 0 ? GREEN : RED],
                  ['Unrealized P&L', `$${(dashboard.unrealizedPnl / 1000).toFixed(2)}K`, dashboard.unrealizedPnl > 0 ? GREEN : RED],
                  ['Total Return', fmtPct(dashboard.totalReturn), dashboard.totalReturn > 0 ? GREEN : RED],
                  ['Ann. Return (est.)', fmtPct(dashboard.totalReturn * 12 / 3), AMBER],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 12, color: TEXT }}>{l as string}</span>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: c as string }}>{v as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {tab === 'metrics' && !dashboard && !loading && (
          <div style={{ color: SUBTLE, fontSize: 11 }}>No dashboard data â€” check /api/v1/performance/dashboard</div>
        )}
      </div>
    </div>
  )
}
