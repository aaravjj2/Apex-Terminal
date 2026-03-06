import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// SmartRoutingUI2 — Bloomberg SORD-grade smart order routing terminal
// Venue analysis, execution quality, TCA, routing logic visualization
// Tabs: ROUTING STATUS | VENUES | TCA | ALGO PERFORMANCE | ROUTING RULES
// APIs: /api/v4/smart-routing/orders, /venues, /tca, /algos, /rules

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

type OrderStatus = 'routing' | 'partial' | 'filled' | 'cancelled'
type AlgoType = 'twap' | 'vwap' | 'is' | 'pov' | 'sniper' | 'iceberg' | 'arrival_price'
type VenueType = 'exchange' | 'dark_pool' | 'ats' | 'ecn' | 'internalization'

interface RoutedOrder {
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  totalQty: number
  filledQty: number
  algo: AlgoType
  status: OrderStatus
  venue: string
  arrivalPrice: number
  avgFillPrice: number
  limitPrice: number
  slippageBps: number
  marketImpactBps: number
  timingCostBps: number
  totalCostBps: number
  completionPct: number
  routedAt: string
}

interface VenueStats {
  venueId: string
  name: string
  venueType: VenueType
  fillRate: number
  avgSlippageBps: number
  avgLatencyMs: number
  darkPoolShares: number
  totalShares: number
  darkPoolRatio: number
  costBps: number
  qualityScore: number
  active: boolean
  connectionStatus: 'connected' | 'degraded' | 'disconnected'
}

interface TcaRecord {
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  algo: AlgoType
  arrivalPrice: number
  vwapBenchmark: number
  twapBenchmark: number
  avgFillPrice: number
  vwapSlippageBps: number
  twapSlippageBps: number
  marketImpactBps: number
  timingCostBps: number
  commissionBps: number
  totalCostBps: number
  executedAt: string
}

interface AlgoStats {
  algo: AlgoType
  ordersExecuted: number
  avgSlippageBps: number
  avgCompletionPct: number
  avgDurationMin: number
  winRate: number
  totalNotional: number
}

interface RoutingRule {
  ruleId: string
  name: string
  condition: string
  action: string
  priority: number
  active: boolean
  matchCount: number
  description: string
}

// ── sub-components ──────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col, style: sx }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string; style?: React.CSSProperties }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap', ...sx }}>{children}</td>
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

function AlgoBadge({ algo }: { algo: AlgoType }) {
  const colors: Record<AlgoType, string> = { twap: BLUE, vwap: GREEN, is: AMBER, pov: ORANGE, sniper: RED, iceberg: PURPLE, arrival_price: SUBTLE }
  const c = colors[algo] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{algo.toUpperCase()}</span>
}

function VenueTypeBadge({ vt }: { vt: VenueType }) {
  const c = vt === 'exchange' ? BLUE : vt === 'dark_pool' ? PURPLE : vt === 'ats' ? ORANGE : vt === 'ecn' ? GREEN : AMBER
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{vt.replace(/_/g, ' ').toUpperCase()}</span>
}

function ConnBadge({ status }: { status: VenueStats['connectionStatus'] }) {
  const c = status === 'connected' ? GREEN : status === 'degraded' ? AMBER : RED
  return <span style={{ fontFamily: MONO, fontSize: 8, color: c, background: c + '22', padding: '1px 5px', borderRadius: 2 }}>{'● ' + status.toUpperCase()}</span>
}

function FillBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 60, height: 5, background: BORDER, borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct >= 100 ? GREEN : AMBER, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function SlippageCell({ bps }: { bps: number }) {
  const c = Math.abs(bps) < 5 ? GREEN : Math.abs(bps) < 15 ? AMBER : RED
  return <span style={{ fontFamily: MONO, fontSize: 11, color: c }}>{bps >= 0 ? '+' : ''}{bps.toFixed(1)}</span>
}


export function SmartRoutingUI2() {
  const [tab, setTab] = useState<'orders' | 'venues' | 'tca' | 'algos' | 'rules'>('orders')
  const [orders, setOrders] = useState<RoutedOrder[]>([])
  const [venues, setVenues] = useState<VenueStats[]>([])
  const [tcaRecords, setTcaRecords] = useState<TcaRecord[]>([])
  const [algoStats, setAlgoStats] = useState<AlgoStats[]>([])
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [algoFilter, setAlgoFilter] = useState<AlgoType | 'all'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rOr, rVe, rTca, rAl, rRu] = await Promise.allSettled([
        fetch('/api/v4/smart-routing/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/smart-routing/venues').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/smart-routing/tca').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/smart-routing/algos').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/smart-routing/rules').then(r => r.ok ? r.json() : []),
      ])
      if (rOr.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rOr.value) ? rOr.value : rOr.value.orders ?? rOr.value.data ?? []
        setOrders(raw.map((o: any) => ({
          orderId: o.order_id ?? o.id ?? '', symbol: o.symbol ?? '',
          side: (o.side ?? 'buy') as RoutedOrder['side'], totalQty: Number(o.total_qty ?? o.qty ?? 0),
          filledQty: Number(o.filled_qty ?? o.filled ?? 0), algo: (o.algo ?? 'vwap') as AlgoType,
          status: (o.status ?? 'routing') as OrderStatus, venue: o.venue ?? '',
          arrivalPrice: Number(o.arrival_price ?? 0), avgFillPrice: Number(o.avg_fill_price ?? o.avg_price ?? 0),
          limitPrice: Number(o.limit_price ?? 0),
          slippageBps: Number(o.slippage_bps ?? o.slippage ?? 0),
          marketImpactBps: Number(o.market_impact_bps ?? 0),
          timingCostBps: Number(o.timing_cost_bps ?? 0),
          totalCostBps: Number(o.total_cost_bps ?? 0),
          completionPct: Number(o.completion_pct ?? o.completion ?? 0),
          routedAt: o.routed_at ?? o.created_at ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load smart routing data')
      if (rVe.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rVe.value) ? rVe.value : rVe.value.venues ?? rVe.value.data ?? []
        setVenues(raw.map((v: any) => ({
          venueId: v.venue_id ?? v.id ?? '', name: v.name ?? '',
          venueType: (v.venue_type ?? v.type ?? 'exchange') as VenueType,
          fillRate: Number(v.fill_rate ?? 0), avgSlippageBps: Number(v.avg_slippage_bps ?? 0),
          avgLatencyMs: Number(v.avg_latency_ms ?? v.latency_ms ?? 0),
          darkPoolShares: Number(v.dark_pool_shares ?? 0), totalShares: Number(v.total_shares ?? 0),
          darkPoolRatio: Number(v.dark_pool_ratio ?? 0), costBps: Number(v.cost_bps ?? 0),
          qualityScore: Number(v.quality_score ?? 0), active: Boolean(v.active ?? true),
          connectionStatus: (v.connection_status ?? v.status ?? 'connected') as VenueStats['connectionStatus'],
        })))
      }
      if (rTca.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rTca.value) ? rTca.value : rTca.value.records ?? rTca.value.data ?? []
        setTcaRecords(raw.map((t: any) => ({
          orderId: t.order_id ?? '', symbol: t.symbol ?? '', side: (t.side ?? 'buy') as 'buy' | 'sell',
          qty: Number(t.qty ?? 0), algo: (t.algo ?? 'vwap') as AlgoType,
          arrivalPrice: Number(t.arrival_price ?? 0), vwapBenchmark: Number(t.vwap_benchmark ?? t.vwap ?? 0),
          twapBenchmark: Number(t.twap_benchmark ?? t.twap ?? 0), avgFillPrice: Number(t.avg_fill_price ?? 0),
          vwapSlippageBps: Number(t.vwap_slippage_bps ?? 0), twapSlippageBps: Number(t.twap_slippage_bps ?? 0),
          marketImpactBps: Number(t.market_impact_bps ?? 0), timingCostBps: Number(t.timing_cost_bps ?? 0),
          commissionBps: Number(t.commission_bps ?? 0), totalCostBps: Number(t.total_cost_bps ?? 0),
          executedAt: t.executed_at ?? '',
        })))
      }
      if (rAl.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAl.value) ? rAl.value : rAl.value.algos ?? rAl.value.data ?? []
        setAlgoStats(raw.map((a: any) => ({
          algo: (a.algo ?? a.name ?? 'vwap') as AlgoType,
          ordersExecuted: Number(a.orders_executed ?? 0),
          avgSlippageBps: Number(a.avg_slippage_bps ?? 0),
          avgCompletionPct: Number(a.avg_completion_pct ?? 0),
          avgDurationMin: Number(a.avg_duration_min ?? 0),
          winRate: Number(a.win_rate ?? 0),
          totalNotional: Number(a.total_notional ?? 0),
        })))
      }
      if (rRu.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rRu.value) ? rRu.value : rRu.value.rules ?? rRu.value.data ?? []
        setRules(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.id ?? '', name: r.name ?? '',
          condition: r.condition ?? '', action: r.action ?? '',
          priority: Number(r.priority ?? 0), active: Boolean(r.active ?? true),
          matchCount: Number(r.match_count ?? 0), description: r.description ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const activeOrders = orders.filter(o => o.status === 'routing' || o.status === 'partial')
  const activeVenues = venues.filter(v => v.active && v.connectionStatus === 'connected')
  const avgTca = tcaRecords.length ? tcaRecords.reduce((s, t) => s + t.totalCostBps, 0) / tcaRecords.length : 0
  const visOrders = orders.filter(o => algoFilter === 'all' || o.algo === algoFilter)

  const TABS = [
    { id: 'orders' as const, label: `ROUTING STATUS (${activeOrders.length})` },
    { id: 'venues' as const, label: `VENUES (${venues.length})` },
    { id: 'tca' as const, label: 'TCA' },
    { id: 'algos' as const, label: 'ALGO PERFORMANCE' },
    { id: 'rules' as const, label: 'ROUTING RULES' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>SORD</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SMART ORDER ROUTING — VENUE ANALYSIS + EXECUTION QUALITY + TCA</span>
        {venues.some(v => v.connectionStatus === 'disconnected') && <span style={{ fontSize: 10, color: RED }}>⚠ VENUE CONNECTION ISSUE</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Orders" value={activeOrders.length} col={activeOrders.length > 0 ? BLUE : SUBTLE} />
        <StatCard label="Active Venues" value={`${activeVenues.length}/${venues.length}`} col={GREEN} />
        <StatCard label="Avg TCA Cost" value={avgTca.toFixed(1) + ' bps'} col={avgTca > 10 ? RED : avgTca > 5 ? AMBER : GREEN} />
        <StatCard label="Fill Rate" value={venues.length ? (venues.reduce((s, v) => s + v.fillRate, 0) / venues.length * 100).toFixed(1) + '%' : '—'} col={GREEN} />
        <StatCard label="Total Routed" value={orders.length} col={SUBTLE} sub="all orders" />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ALGO FILTER */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {(['all', 'twap', 'vwap', 'is', 'pov', 'sniper', 'iceberg'] as const).map(a => (
            <button key={a} onClick={() => setAlgoFilter(a as any)}
              style={{ fontFamily: MONO, fontSize: 10, color: algoFilter === a ? AMBER : SUBTLE, background: algoFilter === a ? AMBER + '22' : 'transparent', border: `1px solid ${algoFilter === a ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {a.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading smart routing...</div>}

        {/* ROUTING STATUS */}
        {tab === 'orders' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Symbol</Th><Th>Side</Th><Th>Algo</Th><Th>Venue</Th>
                <Th>Fill</Th><Th right>Arrival Px</Th><Th right>Avg Fill</Th>
                <Th right>Slip bps</Th><Th right>Impact bps</Th><Th right>Total bps</Th>
                <Th>Status</Th><Th>Routed</Th>
              </tr></thead>
              <tbody>
                {visOrders.length === 0 && <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No orders</td></tr>}
                {visOrders.map((o, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{o.symbol}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: o.side === 'buy' ? GREEN : RED }}>{o.side.toUpperCase()}</span></Td>
                    <Td><AlgoBadge algo={o.algo} /></Td>
                    <Td mono col={BLUE}>{o.venue}</Td>
                    <Td><FillBar pct={o.completionPct} /></Td>
                    <Td right mono>{o.arrivalPrice.toFixed(2)}</Td>
                    <Td right mono col={BLUE}>{o.avgFillPrice.toFixed(2)}</Td>
                    <Td right mono><SlippageCell bps={o.slippageBps} /></Td>
                    <Td right mono col={o.marketImpactBps > 10 ? ORANGE : SUBTLE}>{o.marketImpactBps.toFixed(1)}</Td>
                    <Td right mono col={o.totalCostBps > 15 ? RED : o.totalCostBps > 8 ? AMBER : GREEN}>{o.totalCostBps.toFixed(1)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: o.status === 'filled' ? GREEN : o.status === 'routing' ? BLUE : o.status === 'partial' ? AMBER : SUBTLE, background: (o.status === 'filled' ? GREEN : o.status === 'routing' ? BLUE : o.status === 'partial' ? AMBER : SUBTLE) + '22', padding: '2px 6px', borderRadius: 2 }}>{o.status.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{o.routedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VENUES */}
        {tab === 'venues' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Venue</Th><Th>Type</Th><Th>Connection</Th>
                <Th right>Fill Rate</Th><Th right>Avg Slip bps</Th><Th right>Latency ms</Th>
                <Th right>Dark Pool %</Th><Th right>Cost bps</Th><Th right>Quality</Th>
              </tr></thead>
              <tbody>
                {venues.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No venues</td></tr>}
                {[...venues].sort((a, b) => b.qualityScore - a.qualityScore).map((v, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{v.name}</Td>
                    <Td><VenueTypeBadge vt={v.venueType} /></Td>
                    <Td><ConnBadge status={v.connectionStatus} /></Td>
                    <Td right mono col={v.fillRate > 0.9 ? GREEN : v.fillRate > 0.7 ? AMBER : RED}>{(v.fillRate * 100).toFixed(1)}%</Td>
                    <Td right mono><SlippageCell bps={v.avgSlippageBps} /></Td>
                    <Td right mono col={v.avgLatencyMs > 50 ? RED : v.avgLatencyMs > 20 ? AMBER : GREEN}>{v.avgLatencyMs.toFixed(1)}</Td>
                    <Td right mono col={PURPLE}>{(v.darkPoolRatio * 100).toFixed(1)}%</Td>
                    <Td right mono col={v.costBps > 5 ? RED : GREEN}>{v.costBps.toFixed(2)}</Td>
                    <Td right mono col={v.qualityScore > 80 ? GREEN : v.qualityScore > 60 ? AMBER : RED}>{v.qualityScore.toFixed(0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TCA */}
        {tab === 'tca' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Symbol</Th><Th>Side</Th><Th>Algo</Th><Th right>Qty</Th>
                <Th right>Arrival Px</Th><Th right>Avg Fill</Th>
                <Th right>vs VWAP</Th><Th right>vs TWAP</Th>
                <Th right>Mkt Impact</Th><Th right>Timing</Th><Th right>Commission</Th><Th right>Total bps</Th>
              </tr></thead>
              <tbody>
                {tcaRecords.length === 0 && <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No TCA records</td></tr>}
                {tcaRecords.map((t, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{t.symbol}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: t.side === 'buy' ? GREEN : RED }}>{t.side.toUpperCase()}</span></Td>
                    <Td><AlgoBadge algo={t.algo} /></Td>
                    <Td right mono>{t.qty.toLocaleString()}</Td>
                    <Td right mono>{t.arrivalPrice.toFixed(2)}</Td>
                    <Td right mono col={BLUE}>{t.avgFillPrice.toFixed(2)}</Td>
                    <Td right mono><SlippageCell bps={t.vwapSlippageBps} /></Td>
                    <Td right mono><SlippageCell bps={t.twapSlippageBps} /></Td>
                    <Td right mono col={t.marketImpactBps > 10 ? ORANGE : SUBTLE}>{t.marketImpactBps.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{t.timingCostBps.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{t.commissionBps.toFixed(2)}</Td>
                    <Td right mono col={t.totalCostBps > 15 ? RED : t.totalCostBps > 8 ? AMBER : GREEN} style={{ fontWeight: 700 }}>{t.totalCostBps.toFixed(1)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ALGO PERFORMANCE */}
        {tab === 'algos' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Algorithm</Th><Th right>Orders</Th><Th right>Avg Slip bps</Th>
                <Th right>Avg Completion</Th><Th right>Avg Duration</Th><Th right>Win Rate</Th><Th right>Total Notional</Th>
              </tr></thead>
              <tbody>
                {algoStats.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No algo stats</td></tr>}
                {[...algoStats].sort((a, b) => a.avgSlippageBps - b.avgSlippageBps).map((a, i) => (
                  <tr key={i}>
                    <Td><AlgoBadge algo={a.algo} /></Td>
                    <Td right mono>{a.ordersExecuted}</Td>
                    <Td right mono><SlippageCell bps={a.avgSlippageBps} /></Td>
                    <Td right mono col={a.avgCompletionPct > 95 ? GREEN : AMBER}>{a.avgCompletionPct.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{a.avgDurationMin.toFixed(0)} min</Td>
                    <Td right mono col={a.winRate > 0.6 ? GREEN : RED}>{(a.winRate * 100).toFixed(1)}%</Td>
                    <Td right mono col={BLUE}>${(a.totalNotional / 1e6).toFixed(1)}M</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ROUTING RULES */}
        {tab === 'rules' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th right>Priority</Th><Th>Name</Th><Th>Active</Th>
                <Th>Condition</Th><Th>Action</Th><Th right>Matches</Th><Th>Description</Th>
              </tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No routing rules</td></tr>}
                {[...rules].sort((a, b) => a.priority - b.priority).map((r, i) => (
                  <tr key={i}>
                    <Td right mono col={SUBTLE}>{r.priority}</Td>
                    <Td mono col={AMBER}>{r.name}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.active ? GREEN : SUBTLE }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span></Td>
                    <Td mono col={BLUE} style={{ fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.condition}</Td>
                    <Td mono col={ORANGE} style={{ fontSize: 10 }}>{r.action}</Td>
                    <Td right mono col={r.matchCount > 0 ? TEXT : SUBTLE}>{r.matchCount}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.description}</Td>
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
