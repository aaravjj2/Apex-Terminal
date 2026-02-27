import React, { useState, useEffect, useCallback } from 'react'
﻿// ExecutionCockpitUI2 â€” Bloomberg XCKT execution monitoring cockpit
// Real-time order flow, fill quality, latency heatmap, venue analysis, slippage tracking
// Tabs: ORDER FLOW | FILL QUALITY | LATENCY | VENUES | SLIPPAGE
// APIs: /api/v4/execution-cockpit/flow, /fills, /latency, /venues, /slippage

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

interface OrderFlowEntry {
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  orderType: string
  qty: number
  filledQty: number
  price: number
  avgFill: number
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected'
  venue: string
  algo: string
  submittedAt: string
  latencyMs: number
}

interface FillRecord {
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  fillPrice: number
  fillQty: number
  arrivalPrice: number
  vwap: number
  slippageBps: number
  implementationShortfall: number
  filledAt: string
  venue: string
}

interface LatencyEntry {
  component: string
  p50Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  avgMs: number
  breachCount: number
  thresholdMs: number
  category: string
}

interface VenueStats {
  venue: string
  fillRate: number
  avgLatencyMs: number
  ordersCount: number
  fillsCount: number
  avgSlippageBps: number
  rejectRate: number
  venueType: string
  connected: boolean
}

interface SlippageRecord {
  symbol: string
  side: 'buy' | 'sell'
  slippageBps: number
  implementationShortfall: number
  marketImpactBps: number
  timingCostBps: number
  spreadCostBps: number
  totalCostBps: number
  tradeDate: string
  algo: string
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

function SideBadge({ side }: { side: 'buy' | 'sell' }) {
  return <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: side === 'buy' ? GREEN : RED, background: (side === 'buy' ? GREEN : RED) + '22', borderRadius: 3, padding: '2px 6px' }}>{side.toUpperCase()}</span>
}

function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { filled: GREEN, partial: AMBER, pending: BLUE, cancelled: SUBTLE, rejected: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function LatencyCell({ ms, threshold }: { ms: number; threshold: number }) {
  const c = ms > threshold * 2 ? RED : ms > threshold ? ORANGE : GREEN
  return <span style={{ fontFamily: MONO, fontSize: 11, color: c }}>{ms.toFixed(1)}ms</span>
}

function FillBar({ qty, total }: { qty: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (qty / total) * 100) : 0
  const c = pct >= 100 ? GREEN : pct > 50 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function ConnDot({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? GREEN : RED, marginRight: 4 }}>â—</span>
}


export function ExecutionCockpitUI2() {
  const [tab, setTab] = useState<'flow' | 'fills' | 'latency' | 'venues' | 'slippage'>('flow')
  const [orderFlow, setOrderFlow] = useState<OrderFlowEntry[]>([])
  const [fills, setFills] = useState<FillRecord[]>([])
  const [latency, setLatency] = useState<LatencyEntry[]>([])
  const [venues, setVenues] = useState<VenueStats[]>([])
  const [slippage, setSlippage] = useState<SlippageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sideFilter, setSideFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rF, rFl, rL, rV, rS] = await Promise.allSettled([
        fetch('/api/v4/execution-cockpit/flow').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/execution-cockpit/fills').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/execution-cockpit/latency').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/execution-cockpit/venues').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/execution-cockpit/slippage').then(r => r.ok ? r.json() : []),
      ])
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.orders ?? rF.value.data ?? []
        setOrderFlow(raw.map((o: any) => ({
          orderId: o.order_id ?? o.orderId ?? '', symbol: o.symbol ?? '', side: o.side ?? 'buy',
          orderType: o.order_type ?? o.orderType ?? '', qty: Number(o.qty ?? 0),
          filledQty: Number(o.filled_qty ?? o.filledQty ?? 0), price: Number(o.price ?? 0),
          avgFill: Number(o.avg_fill ?? o.avgFill ?? 0), status: o.status ?? 'pending',
          venue: o.venue ?? '', algo: o.algo ?? '', submittedAt: o.submitted_at ?? o.submittedAt ?? '',
          latencyMs: Number(o.latency_ms ?? o.latencyMs ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load order flow')
      if (rFl.status === 'fulfilled') {
        const raw = Array.isArray(rFl.value) ? rFl.value : rFl.value.fills ?? rFl.value.data ?? []
        setFills(raw.map((f: any) => ({
          orderId: f.order_id ?? f.orderId ?? '', symbol: f.symbol ?? '', side: f.side ?? 'buy',
          fillPrice: Number(f.fill_price ?? f.fillPrice ?? 0), fillQty: Number(f.fill_qty ?? f.fillQty ?? 0),
          arrivalPrice: Number(f.arrival_price ?? f.arrivalPrice ?? 0), vwap: Number(f.vwap ?? 0),
          slippageBps: Number(f.slippage_bps ?? f.slippageBps ?? 0),
          implementationShortfall: Number(f.implementation_shortfall ?? f.implementationShortfall ?? 0),
          filledAt: f.filled_at ?? f.filledAt ?? '', venue: f.venue ?? '',
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.latency ?? rL.value.data ?? []
        setLatency(raw.map((l: any) => ({
          component: l.component ?? '', p50Ms: Number(l.p50_ms ?? l.p50Ms ?? 0),
          p95Ms: Number(l.p95_ms ?? l.p95Ms ?? 0), p99Ms: Number(l.p99_ms ?? l.p99Ms ?? 0),
          maxMs: Number(l.max_ms ?? l.maxMs ?? 0), avgMs: Number(l.avg_ms ?? l.avgMs ?? 0),
          breachCount: Number(l.breach_count ?? l.breachCount ?? 0), thresholdMs: Number(l.threshold_ms ?? l.thresholdMs ?? 10),
          category: l.category ?? 'network',
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.venues ?? rV.value.data ?? []
        setVenues(raw.map((v: any) => ({
          venue: v.venue ?? '', fillRate: Number(v.fill_rate ?? v.fillRate ?? 0),
          avgLatencyMs: Number(v.avg_latency_ms ?? v.avgLatencyMs ?? 0), ordersCount: Number(v.orders_count ?? v.ordersCount ?? 0),
          fillsCount: Number(v.fills_count ?? v.fillsCount ?? 0), avgSlippageBps: Number(v.avg_slippage_bps ?? v.avgSlippageBps ?? 0),
          rejectRate: Number(v.reject_rate ?? v.rejectRate ?? 0), venueType: v.venue_type ?? v.venueType ?? '',
          connected: Boolean(v.connected ?? true),
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.slippage ?? rS.value.data ?? []
        setSlippage(raw.map((s: any) => ({
          symbol: s.symbol ?? '', side: s.side ?? 'buy', slippageBps: Number(s.slippage_bps ?? s.slippageBps ?? 0),
          implementationShortfall: Number(s.implementation_shortfall ?? s.implementationShortfall ?? 0),
          marketImpactBps: Number(s.market_impact_bps ?? s.marketImpactBps ?? 0),
          timingCostBps: Number(s.timing_cost_bps ?? s.timingCostBps ?? 0),
          spreadCostBps: Number(s.spread_cost_bps ?? s.spreadCostBps ?? 0),
          totalCostBps: Number(s.total_cost_bps ?? s.totalCostBps ?? 0),
          tradeDate: s.trade_date ?? s.tradeDate ?? '', algo: s.algo ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 2000); return () => clearInterval(id) }, [fetchAll])

  const filteredFlow = orderFlow.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (sideFilter === 'all' || o.side === sideFilter)
  )

  const fillRate = orderFlow.length > 0 ? orderFlow.filter(o => o.status === 'filled').length / orderFlow.length : 0
  const avgFillLatency = orderFlow.length > 0 ? orderFlow.reduce((s, o) => s + o.latencyMs, 0) / orderFlow.length : 0
  const avgSlip = fills.length > 0 ? fills.reduce((s, f) => s + f.slippageBps, 0) / fills.length : 0
  const rejectCount = orderFlow.filter(o => o.status === 'rejected').length

  const TABS = [
    { id: 'flow' as const, label: 'ORDER FLOW' },
    { id: 'fills' as const, label: 'FILL QUALITY' },
    { id: 'latency' as const, label: 'LATENCY' },
    { id: 'venues' as const, label: 'VENUES' },
    { id: 'slippage' as const, label: 'SLIPPAGE' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>XCKT</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXECUTION COCKPIT â€” REAL-TIME ORDER FLOW + FILL QUALITY + LATENCY + TCA</span>
        {rejectCount > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: RED, fontWeight: 700 }}>âš  {rejectCount} REJECTED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>Loading...</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Orders" value={orderFlow.length} />
        <StatCard label="Fill Rate" value={(fillRate * 100).toFixed(1) + '%'} col={fillRate > 0.9 ? GREEN : fillRate > 0.7 ? AMBER : RED} />
        <StatCard label="Avg Latency" value={avgFillLatency.toFixed(1) + 'ms'} col={avgFillLatency < 5 ? GREEN : avgFillLatency < 20 ? AMBER : RED} />
        <StatCard label="Avg Slippage" value={avgSlip.toFixed(1) + ' bps'} col={avgSlip < 3 ? GREEN : avgSlip < 10 ? AMBER : RED} />
        <StatCard label="Venues" value={venues.length} col={BLUE} />
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

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {/* ORDER FLOW */}
        {tab === 'flow' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'pending', 'partial', 'filled', 'cancelled', 'rejected'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: statusFilter === s ? AMBER : SUBTLE, background: statusFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${statusFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s.toUpperCase()}
                </button>
              ))}
              <div style={{ width: 1, background: BORDER, margin: '0 4px' }} />
              {['all', 'buy', 'sell'].map(s => (
                <button key={s} onClick={() => setSideFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: sideFilter === s ? (s === 'buy' ? GREEN : s === 'sell' ? RED : AMBER) : SUBTLE, background: sideFilter === s ? '#ffffff11' : 'transparent', border: `1px solid ${sideFilter === s ? BORDER : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Order ID</Th><Th>Symbol</Th><Th>Side</Th><Th>Type</Th><Th right>Qty</Th><Th>Fill</Th><Th right>Price</Th><Th right>Avg Fill</Th><Th>Status</Th><Th>Venue</Th><Th right>Latency</Th></tr></thead>
                <tbody>
                  {filteredFlow.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No orders â€” check /api/v4/execution-cockpit/flow</td></tr>}
                  {filteredFlow.map((o, i) => (
                    <tr key={i} style={{ background: o.status === 'rejected' ? RED + '11' : 'transparent' }}>
                      <Td mono col={SUBTLE}>{o.orderId.slice(-8)}</Td>
                      <Td mono col={AMBER}>{o.symbol}</Td>
                      <Td><SideBadge side={o.side} /></Td>
                      <Td mono col={SUBTLE}>{o.orderType}</Td>
                      <Td right mono>{o.qty.toLocaleString()}</Td>
                      <Td><FillBar qty={o.filledQty} total={o.qty} /></Td>
                      <Td right mono>{o.price.toFixed(2)}</Td>
                      <Td right mono col={o.avgFill > o.price && o.side === 'buy' ? RED : GREEN}>{o.avgFill.toFixed(2)}</Td>
                      <Td><StatusBadge s={o.status} /></Td>
                      <Td mono col={BLUE}>{o.venue}</Td>
                      <Td right><LatencyCell ms={o.latencyMs} threshold={10} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FILL QUALITY */}
        {tab === 'fills' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Side</Th><Th right>Fill Qty</Th><Th right>Fill Price</Th><Th right>Arrival</Th><Th right>VWAP</Th><Th right>Slippage (bps)</Th><Th right>IS</Th><Th>Venue</Th><Th>Time</Th></tr></thead>
              <tbody>
                {fills.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No fill data â€” check /api/v4/execution-cockpit/fills</td></tr>}
                {fills.map((f, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{f.symbol}</Td>
                    <Td><SideBadge side={f.side} /></Td>
                    <Td right mono>{f.fillQty.toLocaleString()}</Td>
                    <Td right mono>{f.fillPrice.toFixed(4)}</Td>
                    <Td right mono col={SUBTLE}>{f.arrivalPrice.toFixed(4)}</Td>
                    <Td right mono col={BLUE}>{f.vwap.toFixed(4)}</Td>
                    <Td right mono col={f.slippageBps > 10 ? RED : f.slippageBps > 3 ? AMBER : GREEN}>{f.slippageBps.toFixed(2)}</Td>
                    <Td right mono col={f.implementationShortfall < 0 ? GREEN : RED}>${f.implementationShortfall.toFixed(2)}</Td>
                    <Td mono col={BLUE}>{f.venue}</Td>
                    <Td mono col={SUBTLE}>{f.filledAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LATENCY */}
        {tab === 'latency' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Component</Th><Th>Category</Th><Th right>P50</Th><Th right>P95</Th><Th right>P99</Th><Th right>Max</Th><Th right>Avg</Th><Th right>Breaches</Th><Th right>Threshold</Th></tr></thead>
              <tbody>
                {latency.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No latency data â€” check /api/v4/execution-cockpit/latency</td></tr>}
                {latency.sort((a, b) => b.p99Ms - a.p99Ms).map((l, i) => (
                  <tr key={i} style={{ background: l.breachCount > 0 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{l.component}</Td>
                    <Td mono col={SUBTLE}>{l.category}</Td>
                    <Td right><LatencyCell ms={l.p50Ms} threshold={l.thresholdMs} /></Td>
                    <Td right><LatencyCell ms={l.p95Ms} threshold={l.thresholdMs} /></Td>
                    <Td right><LatencyCell ms={l.p99Ms} threshold={l.thresholdMs} /></Td>
                    <Td right><LatencyCell ms={l.maxMs} threshold={l.thresholdMs} /></Td>
                    <Td right><LatencyCell ms={l.avgMs} threshold={l.thresholdMs} /></Td>
                    <Td right mono col={l.breachCount > 0 ? RED : GREEN}>{l.breachCount}</Td>
                    <Td right mono col={SUBTLE}>{l.thresholdMs}ms</Td>
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
              <thead><tr><Th>Venue</Th><Th>Status</Th><Th>Type</Th><Th right>Fill Rate</Th><Th right>Avg Latency</Th><Th right>Orders</Th><Th right>Fills</Th><Th right>Avg Slippage</Th><Th right>Reject Rate</Th></tr></thead>
              <tbody>
                {venues.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No venue data â€” check /api/v4/execution-cockpit/venues</td></tr>}
                {venues.sort((a, b) => b.fillRate - a.fillRate).map((v, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{v.venue}</Td>
                    <Td><ConnDot ok={v.connected} /><span style={{ fontFamily: MONO, fontSize: 9, color: v.connected ? GREEN : RED }}>{v.connected ? 'CONNECTED' : 'DISCONNECTED'}</span></Td>
                    <Td mono col={BLUE}>{v.venueType}</Td>
                    <Td right mono col={v.fillRate > 0.9 ? GREEN : v.fillRate > 0.7 ? AMBER : RED}>{(v.fillRate * 100).toFixed(1)}%</Td>
                    <Td right><LatencyCell ms={v.avgLatencyMs} threshold={5} /></Td>
                    <Td right mono>{v.ordersCount.toLocaleString()}</Td>
                    <Td right mono>{v.fillsCount.toLocaleString()}</Td>
                    <Td right mono col={v.avgSlippageBps > 10 ? RED : v.avgSlippageBps > 3 ? AMBER : GREEN}>{v.avgSlippageBps.toFixed(2)} bps</Td>
                    <Td right mono col={v.rejectRate > 0.05 ? RED : GREEN}>{(v.rejectRate * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SLIPPAGE */}
        {tab === 'slippage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Side</Th><Th>Algo</Th><Th right>Slippage</Th><Th right>Mkt Impact</Th><Th right>Timing</Th><Th right>Spread</Th><Th right>Total Cost</Th><Th right>IS $</Th><Th>Date</Th></tr></thead>
              <tbody>
                {slippage.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No slippage data â€” check /api/v4/execution-cockpit/slippage</td></tr>}
                {slippage.sort((a, b) => b.totalCostBps - a.totalCostBps).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.symbol}</Td>
                    <Td><SideBadge side={s.side} /></Td>
                    <Td mono col={PURPLE}>{s.algo}</Td>
                    <Td right mono col={s.slippageBps > 10 ? RED : s.slippageBps > 3 ? AMBER : GREEN}>{s.slippageBps.toFixed(2)}</Td>
                    <Td right mono col={ORANGE}>{s.marketImpactBps.toFixed(2)}</Td>
                    <Td right mono col={BLUE}>{s.timingCostBps.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{s.spreadCostBps.toFixed(2)}</Td>
                    <Td right mono col={s.totalCostBps > 20 ? RED : s.totalCostBps > 8 ? AMBER : GREEN}>{s.totalCostBps.toFixed(2)} bps</Td>
                    <Td right mono col={s.implementationShortfall < 0 ? GREEN : RED}>${s.implementationShortfall.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{s.tradeDate}</Td>
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
