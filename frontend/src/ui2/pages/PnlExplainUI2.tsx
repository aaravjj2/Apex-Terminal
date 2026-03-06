import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// PnlExplainUI2 — Bloomberg PNLX-grade P&L explainability terminal
// Tabs: WATERFALL | GREEK P&L | MARKET RISK | POSITION DRILL | EXPLAIN LOG
// APIs: /api/v4/pnl-explain/waterfall, /api/v4/pnl-explain/greeks,
//       /api/v4/pnl-explain/market-risk, /api/v4/pnl-explain/positions,
//       /api/v4/pnl-explain/log

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

interface WaterfallItem {
  label: string
  value: number
  category: 'price' | 'greek' | 'fx' | 'div' | 'vol' | 'other' | 'unexplained'
  cumulative: number
}

interface GreekPnl {
  symbol: string
  deltaP: number
  gammaP: number
  thetaP: number
  vegaP: number
  rhoP: number
  totalGreek: number
  residual: number
  explanation: string
}

interface MarketRisk {
  riskFactor: string
  delta: number
  sensCurr: number
  sensBp: number
  pnlImpact: number
  varContrib: number
  category: string
}

interface PositionPnl {
  symbol: string
  quantity: number
  prevPrice: number
  currPrice: number
  priceChange: number
  pnlDay: number
  pnlMtd: number
  pnlYtd: number
  pnlRealized: number
  pnlUnrealized: number
  pnlFx: number
  pnlFees: number
  pnlExplained: number
  pnlUnexplained: number
}

interface ExplainLog {
  timestamp: string
  symbol: string
  event: string
  oldValue: number
  newValue: number
  pnlImpact: number
  category: string
}

// ── sub-components ────────────────────────────────────────────────────────────
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

function fmt(v: number, decimals = 2) {
  if (isNaN(v)) return '—'
  const s = v >= 0 ? '+' : ''
  return `${s}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` }

function catColor(cat: WaterfallItem['category']): string {
  const map: Record<string, string> = {
    price: AMBER, greek: BLUE, fx: GREEN, div: ORANGE, vol: PURPLE, other: SUBTLE, unexplained: RED,
  }
  return map[cat] || SUBTLE
}

function WaterfallChart({ items }: { items: WaterfallItem[] }) {
  if (items.length === 0) return <div style={{ height: 180, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: SUBTLE, fontSize: 11 }}>No waterfall data</span></div>
  const W = 700, H = 200
  const values = items.map(x => x.value)
  const minCumul = Math.min(0, ...items.map(x => x.cumulative - Math.max(0, x.value)))
  const maxCumul = Math.max(...items.map(x => x.cumulative))
  const range = maxCumul - minCumul || 1
  const colW = (W - 40) / items.length - 4
  const toY = (v: number) => H - 20 - ((v - minCumul) / range) * (H - 40)
  const zeroY = toY(0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'block' }}>
      <line x1="20" y1={zeroY} x2={W - 20} y2={zeroY} stroke={BORDER} strokeWidth="1" strokeDasharray="4,4" />
      {items.map((item, i) => {
        const x = 20 + i * (colW + 4)
        const base = item.cumulative - item.value
        const y1 = toY(Math.max(base, item.cumulative))
        const y2 = toY(Math.min(base, item.cumulative))
        const barH = Math.abs(y2 - y1)
        return (
          <g key={item.label}>
            <rect x={x} y={y1} width={colW} height={Math.max(barH, 2)} fill={catColor(item.category)} opacity="0.85" />
            <text x={x + colW / 2} y={H - 4} fontSize="6.5" fill={SUBTLE} textAnchor="middle" fontFamily="monospace">
              {item.label.slice(0, 8)}
            </text>
            <text x={x + colW / 2} y={y1 - 2} fontSize="7" fill={catColor(item.category)} textAnchor="middle" fontFamily="monospace">
              {item.value >= 0 ? '+' : ''}{(item.value / 1000).toFixed(1)}K
            </text>
          </g>
        )
      })}
      <text x="4" y="12" fontSize="7" fill={GREEN} fontFamily="monospace">{(maxCumul / 1000).toFixed(1)}K</text>
      <text x="4" y={H - 8} fontSize="7" fill={RED} fontFamily="monospace">{(minCumul / 1000).toFixed(1)}K</text>
    </svg>
  )
}

function fmtTime(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return iso }
}


const DATES = ['TODAY', '1D', '1W', '1M', 'MTD', 'YTD']

export function PnlExplainUI2() {
  const [tab, setTab] = useState<'waterfall' | 'greeks' | 'market' | 'positions' | 'log'>('waterfall')
  const [waterfall, setWaterfall] = useState<WaterfallItem[]>([])
  const [greeks, setGreeks] = useState<GreekPnl[]>([])
  const [marketRisk, setMarketRisk] = useState<MarketRisk[]>([])
  const [positions, setPositions] = useState<PositionPnl[]>([])
  const [logs, setLogs] = useState<ExplainLog[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [datePeriod, setDatePeriod] = useState('TODAY')
  const [logFilter, setLogFilter] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWaterfall = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/pnl-explain/waterfall?period=${datePeriod}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.items ?? d.waterfall ?? d.data ?? []
      let cumul = 0
      setWaterfall(raw.map((x: any) => {
        const v = Number(x.value ?? x.pnl ?? 0)
        cumul += v
        return {
          label: x.label ?? x.driver ?? x.name ?? '',
          value: v,
          category: (x.category ?? x.type ?? 'other') as WaterfallItem['category'],
          cumulative: cumul,
        }
      }))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [datePeriod])

  const fetchGreeks = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/pnl-explain/greeks?period=${datePeriod}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.positions ?? d.data ?? []
      setGreeks(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        deltaP: Number(x.delta_pnl ?? x.delta_p ?? 0),
        gammaP: Number(x.gamma_pnl ?? x.gamma_p ?? 0),
        thetaP: Number(x.theta_pnl ?? x.theta_p ?? 0),
        vegaP: Number(x.vega_pnl ?? x.vega_p ?? 0),
        rhoP: Number(x.rho_pnl ?? x.rho_p ?? 0),
        totalGreek: Number(x.total_greek ?? x.total ?? 0),
        residual: Number(x.residual ?? 0),
        explanation: x.explanation ?? '',
      })))
    } catch { /* empty */ }
  }, [datePeriod])

  const fetchMarket = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/pnl-explain/market-risk?period=${datePeriod}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.risks ?? d.data ?? []
      setMarketRisk(raw.map((x: any) => ({
        riskFactor: x.risk_factor ?? x.factor ?? '',
        delta: Number(x.delta ?? x.sensitivity ?? 0),
        sensCurr: Number(x.sens_curr ?? x.sensitivity_current ?? 0),
        sensBp: Number(x.sens_bp ?? x.sensitivity_bp ?? 0),
        pnlImpact: Number(x.pnl_impact ?? x.pnl ?? 0),
        varContrib: Number(x.var_contrib ?? x.var ?? 0),
        category: x.category ?? x.type ?? '',
      })))
    } catch { /* empty */ }
  }, [datePeriod])

  const fetchPositions = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/pnl-explain/positions?period=${datePeriod}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.positions ?? d.data ?? []
      setPositions(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        quantity: Number(x.quantity ?? x.qty ?? 0),
        prevPrice: Number(x.prev_price ?? x.previous_price ?? 0),
        currPrice: Number(x.curr_price ?? x.current_price ?? 0),
        priceChange: Number(x.price_change ?? 0),
        pnlDay: Number(x.pnl_day ?? x.daily_pnl ?? 0),
        pnlMtd: Number(x.pnl_mtd ?? 0),
        pnlYtd: Number(x.pnl_ytd ?? 0),
        pnlRealized: Number(x.pnl_realized ?? x.realized_pnl ?? 0),
        pnlUnrealized: Number(x.pnl_unrealized ?? x.unrealized_pnl ?? 0),
        pnlFx: Number(x.pnl_fx ?? x.fx_pnl ?? 0),
        pnlFees: Number(x.pnl_fees ?? x.fees ?? 0),
        pnlExplained: Number(x.pnl_explained ?? 0),
        pnlUnexplained: Number(x.pnl_unexplained ?? 0),
      })))
    } catch { /* empty */ }
  }, [datePeriod])

  const fetchLog = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/pnl-explain/log')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.events ?? d.log ?? d.data ?? []
      setLogs(raw.map((x: any) => ({
        timestamp: x.timestamp ?? x.time ?? '',
        symbol: x.symbol ?? '',
        event: x.event ?? x.description ?? '',
        oldValue: Number(x.old_value ?? x.prev ?? 0),
        newValue: Number(x.new_value ?? x.curr ?? 0),
        pnlImpact: Number(x.pnl_impact ?? 0),
        category: x.category ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchWaterfall(), fetchGreeks(), fetchMarket(), fetchPositions(), fetchLog()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(() => { fetchWaterfall(); fetchPositions() }, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchWaterfall, fetchGreeks, fetchMarket, fetchPositions, fetchLog])

  const totalPnl = waterfall.length > 0 ? waterfall[waterfall.length - 1].cumulative : 0
  const totalPos = positions.reduce((s, x) => s + x.pnlDay, 0)
  const totalRealized = positions.reduce((s, x) => s + x.pnlRealized, 0)
  const totalUnrealized = positions.reduce((s, x) => s + x.pnlUnrealized, 0)
  const totalUnexplained = positions.reduce((s, x) => s + Math.abs(x.pnlUnexplained), 0)

  const tabs = [
    { id: 'waterfall' as const, label: 'WATERFALL' },
    { id: 'greeks' as const, label: 'GREEK P&L' },
    { id: 'market' as const, label: 'MARKET RISK' },
    { id: 'positions' as const, label: 'POSITION DRILL' },
    { id: 'log' as const, label: 'EXPLAIN LOG' },
  ]

  const filteredLogs = logFilter ? logs.filter(l => l.symbol.toLowerCase().includes(logFilter.toLowerCase()) || l.event.toLowerCase().includes(logFilter.toLowerCase())) : logs

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>PNLX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>P&L EXPLAINABILITY — DRIVER DECOMPOSITION</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: totalPnl >= 0 ? GREEN : RED }}>
          {fmt(totalPnl)}
        </span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {DATES.map(d => (
            <button key={d} onClick={() => setDatePeriod(d)}
              style={{ fontFamily: MONO, fontSize: 9, color: datePeriod === d ? '#000' : TEXT, background: datePeriod === d ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 7px', cursor: 'pointer' }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total P&L" value={fmt(totalPnl)} col={totalPnl >= 0 ? GREEN : RED} sub={datePeriod} />
        <StatCard label="Daily P&L" value={fmt(totalPos)} col={totalPos >= 0 ? GREEN : RED} />
        <StatCard label="Realized" value={fmt(totalRealized)} col={GREEN} />
        <StatCard label="Unrealized" value={fmt(totalUnrealized)} col={totalUnrealized >= 0 ? GREEN : RED} />
        <StatCard label="Unexplained" value={fmt(totalUnexplained)} col={totalUnexplained < 100 ? GREEN : RED} sub={totalUnexplained < 100 ? 'within tolerance' : 'review required'} />
        <StatCard label="Event Log" value={logs.length} sub="entries" />
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading P&L data...</div>}

        {/* ── WATERFALL ── */}
        {tab === 'waterfall' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>P&L Decomposition — {datePeriod}</div>
              <WaterfallChart items={waterfall} />
            </div>
            {/* category legend */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {(['price', 'greek', 'fx', 'div', 'vol', 'other', 'unexplained'] as WaterfallItem['category'][]).map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, background: catColor(cat), borderRadius: 2 }} />
                  <span style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase' }}>{cat}</span>
                </div>
              ))}
            </div>
            {/* waterfall table */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><Th>Driver</Th><Th>Category</Th><Th right>P&L Impact</Th><Th right>Cumulative</Th><Th right>% of Total</Th></tr>
                </thead>
                <tbody>
                  {waterfall.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : 'No waterfall data'}
                    </td></tr>
                  )}
                  {waterfall.map((w, i) => {
                    const pct = totalPnl !== 0 ? (w.value / Math.abs(totalPnl)) * 100 : 0
                    return (
                      <tr key={i}>
                        <Td mono col={AMBER}>{w.label}</Td>
                        <Td><span style={{ fontSize: 9, color: catColor(w.category), background: catColor(w.category) + '22', padding: '2px 6px', borderRadius: 2 }}>{w.category}</span></Td>
                        <Td right mono col={w.value >= 0 ? GREEN : RED}>{fmt(w.value)}</Td>
                        <Td right mono col={w.cumulative >= 0 ? GREEN : RED}>{fmt(w.cumulative)}</Td>
                        <Td right mono col={SUBTLE}>{pct.toFixed(1)}%</Td>
                      </tr>
                    )
                  })}
                  {waterfall.length > 0 && (
                    <tr style={{ background: '#0d0d0d' }}>
                      <td colSpan={2} style={{ fontSize: 10, fontFamily: MONO, color: AMBER, fontWeight: 700, padding: '6px 10px' }}>TOTAL</td>
                      <Td right mono col={totalPnl >= 0 ? GREEN : RED}>{fmt(totalPnl)}</Td>
                      <Td right mono col={totalPnl >= 0 ? GREEN : RED}>{fmt(totalPnl)}</Td>
                      <Td right mono col={SUBTLE}>100.0%</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── GREEK P&L ── */}
        {tab === 'greeks' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th>
                    <Th right>Δ P&L</Th><Th right>Γ P&L</Th><Th right>Θ P&L</Th><Th right>V P&L</Th><Th right>ρ P&L</Th>
                    <Th right>Total Greek</Th><Th right>Residual</Th>
                  </tr>
                </thead>
                <tbody>
                  {greeks.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No greek P&L
                    </td></tr>
                  )}
                  {greeks.sort((a, b) => Math.abs(b.totalGreek) - Math.abs(a.totalGreek)).map(g => (
                    <tr key={g.symbol}>
                      <Td mono col={AMBER}>{g.symbol}</Td>
                      <Td right mono col={g.deltaP >= 0 ? GREEN : RED}>{fmt(g.deltaP, 0)}</Td>
                      <Td right mono col={g.gammaP >= 0 ? GREEN : RED}>{fmt(g.gammaP, 0)}</Td>
                      <Td right mono col={g.thetaP >= 0 ? GREEN : RED}>{fmt(g.thetaP, 0)}</Td>
                      <Td right mono col={g.vegaP >= 0 ? GREEN : RED}>{fmt(g.vegaP, 0)}</Td>
                      <Td right mono col={g.rhoP >= 0 ? GREEN : RED}>{fmt(g.rhoP, 0)}</Td>
                      <Td right mono col={g.totalGreek >= 0 ? GREEN : RED}><b>{fmt(g.totalGreek, 0)}</b></Td>
                      <Td right mono col={Math.abs(g.residual) < 100 ? SUBTLE : RED}>{fmt(g.residual, 0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MARKET RISK ── */}
        {tab === 'market' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Risk Factor</Th><Th>Category</Th>
                    <Th right>Delta</Th><Th right>Sens $</Th><Th right>Sens /bp</Th>
                    <Th right>P&L Impact</Th><Th right>VaR Contrib</Th>
                  </tr>
                </thead>
                <tbody>
                  {marketRisk.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No market risk data
                    </td></tr>
                  )}
                  {marketRisk.sort((a, b) => Math.abs(b.pnlImpact) - Math.abs(a.pnlImpact)).map((r, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{r.riskFactor}</Td>
                      <Td col={SUBTLE}>{r.category}</Td>
                      <Td right mono col={r.delta > 0 ? GREEN : RED}>{r.delta.toFixed(3)}</Td>
                      <Td right mono>{r.sensCurr.toFixed(2)}</Td>
                      <Td right mono col={SUBTLE}>{r.sensBp.toFixed(2)}</Td>
                      <Td right mono col={r.pnlImpact >= 0 ? GREEN : RED}>{fmt(r.pnlImpact, 0)}</Td>
                      <Td right mono col={r.varContrib > 10 ? RED : SUBTLE}>{r.varContrib.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── POSITION DRILL ── */}
        {tab === 'positions' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th right>Qty</Th>
                    <Th right>Prev</Th><Th right>Curr</Th><Th right>Chg</Th>
                    <Th right>Day P&L</Th><Th right>MTD</Th><Th right>YTD</Th>
                    <Th right>Realized</Th><Th right>Unrealized</Th>
                    <Th right>FX</Th><Th right>Fees</Th><Th right>Unexplained</Th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 && (
                    <tr><td colSpan={13} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No positions
                    </td></tr>
                  )}
                  {positions.sort((a, b) => Math.abs(b.pnlDay) - Math.abs(a.pnlDay)).map(p => (
                    <tr key={p.symbol}>
                      <Td mono col={AMBER}>{p.symbol}</Td>
                      <Td right mono>{p.quantity.toLocaleString()}</Td>
                      <Td right mono col={SUBTLE}>${p.prevPrice.toFixed(2)}</Td>
                      <Td right mono>${p.currPrice.toFixed(2)}</Td>
                      <Td right mono col={p.priceChange >= 0 ? GREEN : RED}>{p.priceChange >= 0 ? '+' : ''}{p.priceChange.toFixed(2)}</Td>
                      <Td right mono col={p.pnlDay >= 0 ? GREEN : RED}>{fmt(p.pnlDay, 0)}</Td>
                      <Td right mono col={p.pnlMtd >= 0 ? GREEN : RED}>{fmt(p.pnlMtd, 0)}</Td>
                      <Td right mono col={p.pnlYtd >= 0 ? GREEN : RED}>{fmt(p.pnlYtd, 0)}</Td>
                      <Td right mono col={p.pnlRealized >= 0 ? GREEN : RED}>{fmt(p.pnlRealized, 0)}</Td>
                      <Td right mono col={p.pnlUnrealized >= 0 ? GREEN : RED}>{fmt(p.pnlUnrealized, 0)}</Td>
                      <Td right mono col={SUBTLE}>{fmt(p.pnlFx, 0)}</Td>
                      <Td right mono col={RED}>{fmt(p.pnlFees, 0)}</Td>
                      <Td right mono col={Math.abs(p.pnlUnexplained) < 10 ? SUBTLE : RED}>{fmt(p.pnlUnexplained, 0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── EXPLAIN LOG ── */}
        {tab === 'log' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <input value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder="Filter by symbol or event..."
                style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 240, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredLogs.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No events</div>}
              {filteredLogs.map((l, i) => (
                <div key={i} style={{ background: PANEL, border: `1px solid ${l.pnlImpact > 0 ? GREEN + '33' : l.pnlImpact < 0 ? RED + '33' : BORDER}`, borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: SUBTLE, minWidth: 80 }}>{fmtTime(l.timestamp)}</span>
                  <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, minWidth: 50 }}>{l.symbol}</span>
                  <span style={{ fontSize: 10, color: SUBTLE, minWidth: 60 }}>{l.category}</span>
                  <span style={{ flex: 1, fontSize: 11, color: TEXT }}>{l.event}</span>
                  <span style={{ fontSize: 10, color: SUBTLE }}>{l.oldValue.toFixed(3)} → {l.newValue.toFixed(3)}</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: l.pnlImpact >= 0 ? GREEN : RED, minWidth: 70, textAlign: 'right' }}>{fmt(l.pnlImpact, 0)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
