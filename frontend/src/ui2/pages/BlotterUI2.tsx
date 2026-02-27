import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// BlotterUI2 â€” Bloomberg BLOT-grade execution blotter terminal
// Tabs: EXECUTIONS | ORDERS | ALLOCATIONS | P&L ATTRIBUTION | AUDIT TRAIL
// APIs: /api/v4/blotter/executions, /api/v4/blotter/orders,
//       /api/v4/blotter/allocations, /api/v4/blotter/pnl,
//       /api/v4/blotter/audit

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

type OrderSide = 'buy' | 'sell' | 'buy_to_open' | 'sell_to_close' | 'buy_to_close' | 'sell_to_open'
type OrderStatus = 'filled' | 'partial' | 'pending' | 'cancelled' | 'rejected' | 'working'
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'vwap' | 'twap' | 'algo'

interface Execution {
  execId: string
  orderId: string
  parentOrderId?: string
  symbol: string
  side: OrderSide
  quantity: number
  fillPrice: number
  marketPrice: number
  venue: string
  route: string
  execTime: string
  commission: number
  slippage: number
  slippageBps: number
  pnl: number
  pnlType: 'realized' | 'unrealized'
  trader: string
  strategy: string
  account: string
  assetClass: 'equity' | 'option' | 'futures' | 'fx' | 'fixed_income'
  notional: number
}

interface BlotterOrder {
  orderId: string
  parentOrderId?: string
  symbol: string
  side: OrderSide
  type: OrderType
  status: OrderStatus
  quantity: number
  filled: number
  remaining: number
  limitPrice?: number
  avgFillPrice: number
  commission: number
  submitTime: string
  lastUpdateTime: string
  venue: string
  account: string
  strategy: string
  childOrders: number
  fills: number
}

interface Allocation {
  allocationId: string
  orderId: string
  symbol: string
  account: string
  quantity: number
  fillPrice: number
  notional: number
  commission: number
  status: 'confirmed' | 'pending' | 'failed'
  settlement: string
}

interface BlotterPnl {
  symbol: string
  account: string
  strategy: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  commissions: number
  netPnl: number
  quantity: number
  avgCost: number
  currentPrice: number
  pnlPct: number
}

interface AuditEntry {
  auditId: string
  orderId: string
  event: string
  timestamp: string
  user: string
  details: string
  oldValue?: string
  newValue?: string
  ipAddress: string
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function SideBadge({ side }: { side: OrderSide }) {
  const isBuy = side.startsWith('buy')
  const c = isBuy ? BLUE : RED
  return <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44` }}>{side.replace(/_/g, ' ').toUpperCase()}</span>
}

function StatusBadge2({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = { filled: GREEN, partial: AMBER, pending: BLUE, cancelled: SUBTLE, rejected: RED, working: ORANGE }
  const c = map[status] || SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{status.toUpperCase()}</span>
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? GREEN : AMBER, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function fmtTime(ts: string) { try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return ts } }
function fmtCcy(v: number) { return (v >= 0 ? '+' : '') + v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtQty(v: number) { return v.toLocaleString('en-US') }


export function BlotterUI2() {
  const [tab, setTab] = useState<'execs' | 'orders' | 'alloc' | 'pnl' | 'audit'>('execs')
  const [executions, setExecutions] = useState<Execution[]>([])
  const [orders, setOrders] = useState<BlotterOrder[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [pnlData, setPnlData] = useState<BlotterPnl[]>([])
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sideFilter, setSideFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchSym, setSearchSym] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rEx, rOrd, rAl, rPnl, rAud] = await Promise.allSettled([
        fetch('/api/v4/blotter/executions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/blotter/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/blotter/allocations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/blotter/pnl').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/blotter/audit').then(r => r.ok ? r.json() : []),
      ])

      if (rEx.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rEx.value) ? rEx.value : rEx.value.executions ?? rEx.value.data ?? []
        setExecutions(raw.map((x: any) => ({
          execId: x.exec_id ?? x.id ?? String(Math.random()),
          orderId: x.order_id ?? '',
          parentOrderId: x.parent_order_id ?? undefined,
          symbol: x.symbol ?? '',
          side: (x.side ?? 'buy') as OrderSide,
          quantity: Number(x.quantity ?? x.qty ?? 0),
          fillPrice: Number(x.fill_price ?? x.price ?? 0),
          marketPrice: Number(x.market_price ?? 0),
          venue: x.venue ?? x.exchange ?? '',
          route: x.route ?? '',
          execTime: x.exec_time ?? x.time ?? '',
          commission: Number(x.commission ?? 0),
          slippage: Number(x.slippage ?? 0),
          slippageBps: Number(x.slippage_bps ?? 0),
          pnl: Number(x.pnl ?? 0),
          pnlType: (x.pnl_type ?? 'realized') as Execution['pnlType'],
          trader: x.trader ?? '',
          strategy: x.strategy ?? '',
          account: x.account ?? '',
          assetClass: (x.asset_class ?? 'equity') as Execution['assetClass'],
          notional: Number(x.notional ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load blotter data')

      if (rOrd.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rOrd.value) ? rOrd.value : rOrd.value.orders ?? rOrd.value.data ?? []
        setOrders(raw.map((x: any) => ({
          orderId: x.order_id ?? x.id ?? '',
          parentOrderId: x.parent_order_id ?? undefined,
          symbol: x.symbol ?? '',
          side: (x.side ?? 'buy') as OrderSide,
          type: (x.order_type ?? x.type ?? 'market') as OrderType,
          status: (x.status ?? 'working') as OrderStatus,
          quantity: Number(x.quantity ?? x.qty ?? 0),
          filled: Number(x.filled_qty ?? x.filled ?? 0),
          remaining: Number(x.remaining_qty ?? x.remaining ?? 0),
          limitPrice: x.limit_price !== undefined ? Number(x.limit_price) : undefined,
          avgFillPrice: Number(x.avg_fill_price ?? x.avg_price ?? 0),
          commission: Number(x.commission ?? 0),
          submitTime: x.submit_time ?? x.created_at ?? '',
          lastUpdateTime: x.last_update_time ?? x.updated_at ?? '',
          venue: x.venue ?? '',
          account: x.account ?? '',
          strategy: x.strategy ?? '',
          childOrders: Number(x.child_orders ?? 0),
          fills: Number(x.fills ?? 0),
        })))
      }

      if (rAl.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAl.value) ? rAl.value : rAl.value.allocations ?? rAl.value.data ?? []
        setAllocations(raw.map((x: any) => ({
          allocationId: x.allocation_id ?? x.id ?? '',
          orderId: x.order_id ?? '',
          symbol: x.symbol ?? '',
          account: x.account ?? '',
          quantity: Number(x.quantity ?? 0),
          fillPrice: Number(x.fill_price ?? 0),
          notional: Number(x.notional ?? 0),
          commission: Number(x.commission ?? 0),
          status: (x.status ?? 'pending') as Allocation['status'],
          settlement: x.settlement ?? x.settle_date ?? '',
        })))
      }

      if (rPnl.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rPnl.value) ? rPnl.value : rPnl.value.pnl ?? rPnl.value.data ?? []
        setPnlData(raw.map((x: any) => ({
          symbol: x.symbol ?? '',
          account: x.account ?? '',
          strategy: x.strategy ?? '',
          realizedPnl: Number(x.realized_pnl ?? x.realized ?? 0),
          unrealizedPnl: Number(x.unrealized_pnl ?? x.unrealized ?? 0),
          totalPnl: Number(x.total_pnl ?? x.total ?? 0),
          commissions: Number(x.commissions ?? x.commission ?? 0),
          netPnl: Number(x.net_pnl ?? x.net ?? 0),
          quantity: Number(x.quantity ?? x.qty ?? 0),
          avgCost: Number(x.avg_cost ?? 0),
          currentPrice: Number(x.current_price ?? 0),
          pnlPct: Number(x.pnl_pct ?? x.pnl_percent ?? 0),
        })))
      }

      if (rAud.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAud.value) ? rAud.value : rAud.value.audit ?? rAud.value.events ?? rAud.value.data ?? []
        setAuditTrail(raw.map((x: any) => ({
          auditId: x.audit_id ?? x.id ?? String(Math.random()),
          orderId: x.order_id ?? '',
          event: x.event ?? x.event_type ?? '',
          timestamp: x.timestamp ?? x.time ?? '',
          user: x.user ?? x.trader ?? '',
          details: x.details ?? x.description ?? '',
          oldValue: x.old_value ?? undefined,
          newValue: x.new_value ?? undefined,
          ipAddress: x.ip_address ?? x.ip ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const filtExecs = executions.filter(e => {
    if (sideFilter !== 'all' && !e.side.startsWith(sideFilter.replace('buy', 'buy').replace('sell', 'sell'))) return false
    if (searchSym && !e.symbol.toLowerCase().includes(searchSym.toLowerCase())) return false
    return true
  })

  const filtOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (searchSym && !o.symbol.toLowerCase().includes(searchSym.toLowerCase())) return false
    return true
  })

  const totalFills = executions.length
  const totalNotional = executions.reduce((s, e) => s + e.notional, 0)
  const totalPnl = pnlData.reduce((s, p) => s + p.netPnl, 0)
  const avgSlipBps = executions.length ? executions.reduce((s, e) => s + e.slippageBps, 0) / executions.length : 0
  const workingOrders = orders.filter(o => o.status === 'working' || o.status === 'partial').length

  const TABS = [
    { id: 'execs' as const, label: `EXECUTIONS (${totalFills})` },
    { id: 'orders' as const, label: `ORDERS (${orders.length})` },
    { id: 'alloc' as const, label: 'ALLOCATIONS' },
    { id: 'pnl' as const, label: 'P&L ATTR' },
    { id: 'audit' as const, label: 'AUDIT TRAIL' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>BLOT</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXECUTION BLOTTER â€” PARENT-CHILD LINKING + AUDIT TRAIL</span>
        {workingOrders > 0 && <span style={{ fontSize: 10, color: ORANGE }}>â— {workingOrders} WORKING</span>}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Fills" value={totalFills} />
        <StatCard label="Total Notional" value={'$' + (totalNotional / 1e6).toFixed(2) + 'M'} col={BLUE} />
        <StatCard label="Net P&L" value={fmtCcy(totalPnl)} col={totalPnl >= 0 ? GREEN : RED} />
        <StatCard label="Avg Slippage" value={avgSlipBps.toFixed(1) + 'bps'} col={avgSlipBps > 5 ? RED : AMBER} />
        <StatCard label="Working Orders" value={workingOrders} col={ORANGE} />
        <StatCard label="Total Orders" value={orders.length} />
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

      {/* FILTERS */}
      <div style={{ padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        {(['all', 'buy', 'sell'] as const).map(s => (
          <button key={s} onClick={() => setSideFilter(s)}
            style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', color: sideFilter === s ? '#000' : TEXT,
              background: sideFilter === s ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
            {s}
          </button>
        ))}
        <input placeholder="Symbol..." value={searchSym} onChange={e => setSearchSym(e.target.value)}
          style={{ fontFamily: MONO, fontSize: 10, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', outline: 'none', width: 100 }} />
        {tab === 'orders' && (['all', 'filled', 'partial', 'working', 'cancelled', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ fontFamily: MONO, fontSize: 8, textTransform: 'uppercase', color: statusFilter === s ? '#000' : TEXT,
              background: statusFilter === s ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>
            {s}
          </button>
        ))}
        {loading && <span style={{ fontSize: 9, color: SUBTLE }}>Refreshing...</span>}
        {err && <span style={{ fontSize: 9, color: RED }}>Error: {err}</span>}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* â”€â”€ EXECUTIONS â”€â”€ */}
        {tab === 'execs' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Time</Th><Th>Symbol</Th><Th>Side</Th><Th right>Qty</Th>
                <Th right>Fill Price</Th><Th right>Notional</Th><Th right>Slip (bps)</Th>
                <Th right>Commission</Th><Th right>P&L</Th><Th>Venue</Th><Th>Strategy</Th><Th>Acct</Th>
              </tr>
            </thead>
            <tbody>
              {filtExecs.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No executions â€” check /api/v4/blotter/executions
                </td></tr>
              )}
              {filtExecs.map(e => (
                <tr key={e.execId} style={{ background: selectedOrder === e.orderId ? '#1a1500' : 'transparent' }}
                  onClick={() => setSelectedOrder(e.orderId === selectedOrder ? null : e.orderId)}>
                  <Td mono col={SUBTLE}>{fmtTime(e.execTime)}</Td>
                  <Td mono col={AMBER}>{e.symbol}</Td>
                  <Td><SideBadge side={e.side} /></Td>
                  <Td right mono>{fmtQty(e.quantity)}</Td>
                  <Td right mono>${e.fillPrice.toFixed(2)}</Td>
                  <Td right mono col={BLUE}>${(e.notional / 1000).toFixed(0)}K</Td>
                  <Td right mono col={Math.abs(e.slippageBps) > 5 ? RED : SUBTLE}>{e.slippageBps.toFixed(1)}</Td>
                  <Td right mono col={SUBTLE}>${e.commission.toFixed(2)}</Td>
                  <Td right mono col={e.pnl >= 0 ? GREEN : RED}>{fmtCcy(e.pnl)}</Td>
                  <Td mono col={SUBTLE}>{e.venue}</Td>
                  <Td mono col={SUBTLE}>{e.strategy}</Td>
                  <Td mono col={SUBTLE}>{e.account}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* â”€â”€ ORDERS â”€â”€ */}
        {tab === 'orders' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Order ID</Th><Th>Symbol</Th><Th>Side</Th><Th>Type</Th><Th>Status</Th>
                <Th right>Qty</Th><Th right>Filled</Th><Th>Fill Bar</Th>
                <Th right>Avg Fill</Th><Th right>Limit</Th><Th>Venue</Th><Th>Submit</Th>
              </tr>
            </thead>
            <tbody>
              {filtOrders.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No orders â€” check /api/v4/blotter/orders
                </td></tr>
              )}
              {filtOrders.map(o => (
                <tr key={o.orderId}>
                  <Td mono col={SUBTLE}>{o.orderId.slice(0, 12)}</Td>
                  <Td mono col={AMBER}>{o.symbol}</Td>
                  <Td><SideBadge side={o.side} /></Td>
                  <Td mono col={SUBTLE}>{o.type.toUpperCase()}</Td>
                  <Td><StatusBadge2 status={o.status} /></Td>
                  <Td right mono>{fmtQty(o.quantity)}</Td>
                  <Td right mono col={o.filled === o.quantity ? GREEN : AMBER}>{fmtQty(o.filled)}</Td>
                  <Td><FillBar filled={o.filled} total={o.quantity} /></Td>
                  <Td right mono>{o.avgFillPrice > 0 ? '$' + o.avgFillPrice.toFixed(2) : 'â€”'}</Td>
                  <Td right mono col={SUBTLE}>{o.limitPrice !== undefined ? '$' + o.limitPrice.toFixed(2) : 'â€”'}</Td>
                  <Td mono col={SUBTLE}>{o.venue}</Td>
                  <Td mono col={SUBTLE}>{fmtTime(o.submitTime)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* â”€â”€ ALLOCATIONS â”€â”€ */}
        {tab === 'alloc' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Alloc ID</Th><Th>Symbol</Th><Th>Account</Th><Th right>Qty</Th>
                <Th right>Fill Price</Th><Th right>Notional</Th><Th right>Commission</Th>
                <Th>Status</Th><Th>Settlement</Th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No allocations â€” check /api/v4/blotter/allocations
                </td></tr>
              )}
              {allocations.map(a => (
                <tr key={a.allocationId}>
                  <Td mono col={SUBTLE}>{a.allocationId.slice(0, 12)}</Td>
                  <Td mono col={AMBER}>{a.symbol}</Td>
                  <Td mono col={PURPLE}>{a.account}</Td>
                  <Td right mono>{fmtQty(a.quantity)}</Td>
                  <Td right mono>${a.fillPrice.toFixed(2)}</Td>
                  <Td right mono col={BLUE}>${(a.notional / 1000).toFixed(0)}K</Td>
                  <Td right mono col={SUBTLE}>${a.commission.toFixed(2)}</Td>
                  <Td><span style={{ fontFamily: MONO, fontSize: 9,
                    color: a.status === 'confirmed' ? GREEN : a.status === 'failed' ? RED : AMBER,
                    background: (a.status === 'confirmed' ? GREEN : a.status === 'failed' ? RED : AMBER) + '22',
                    padding: '2px 6px', borderRadius: 2 }}>{a.status.toUpperCase()}</span></Td>
                  <Td mono col={SUBTLE}>{a.settlement}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* â”€â”€ P&L ATTRIBUTION â”€â”€ */}
        {tab === 'pnl' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Symbol</Th><Th>Account</Th><Th>Strategy</Th>
                <Th right>Qty</Th><Th right>Avg Cost</Th><Th right>Current</Th>
                <Th right>Realized P&L</Th><Th right>Unrealized P&L</Th>
                <Th right>Commissions</Th><Th right>Net P&L</Th><Th right>P&L %</Th>
              </tr>
            </thead>
            <tbody>
              {pnlData.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No P&L data â€” check /api/v4/blotter/pnl
                </td></tr>
              )}
              {[...pnlData].sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl)).map((p, i) => (
                <tr key={i}>
                  <Td mono col={AMBER}>{p.symbol}</Td>
                  <Td mono col={PURPLE}>{p.account}</Td>
                  <Td mono col={SUBTLE}>{p.strategy}</Td>
                  <Td right mono>{fmtQty(p.quantity)}</Td>
                  <Td right mono>${p.avgCost.toFixed(2)}</Td>
                  <Td right mono>${p.currentPrice.toFixed(2)}</Td>
                  <Td right mono col={p.realizedPnl >= 0 ? GREEN : RED}>{fmtCcy(p.realizedPnl)}</Td>
                  <Td right mono col={p.unrealizedPnl >= 0 ? GREEN : RED}>{fmtCcy(p.unrealizedPnl)}</Td>
                  <Td right mono col={SUBTLE}>{fmtCcy(p.commissions)}</Td>
                  <Td right mono col={p.netPnl >= 0 ? GREEN : RED} style={{ fontWeight: 700 }}>{fmtCcy(p.netPnl)}</Td>
                  <Td right mono col={p.pnlPct >= 0 ? GREEN : RED}>{(p.pnlPct * 100).toFixed(2)}%</Td>
                </tr>
              ))}
              {pnlData.length > 0 && (
                <tr style={{ background: '#0d0d0d' }}>
                  <Td mono col={TEXT}>TOTAL</Td>
                  <Td /><Td /><Td /><Td /><Td />
                  <Td right mono col={pnlData.reduce((s, p) => s + p.realizedPnl, 0) >= 0 ? GREEN : RED} style={{ fontWeight: 700 }}>{fmtCcy(pnlData.reduce((s, p) => s + p.realizedPnl, 0))}</Td>
                  <Td right mono col={pnlData.reduce((s, p) => s + p.unrealizedPnl, 0) >= 0 ? GREEN : RED} style={{ fontWeight: 700 }}>{fmtCcy(pnlData.reduce((s, p) => s + p.unrealizedPnl, 0))}</Td>
                  <Td right mono col={SUBTLE} style={{ fontWeight: 700 }}>{fmtCcy(pnlData.reduce((s, p) => s + p.commissions, 0))}</Td>
                  <Td right mono col={totalPnl >= 0 ? GREEN : RED} style={{ fontWeight: 700 }}>{fmtCcy(totalPnl)}</Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* â”€â”€ AUDIT TRAIL â”€â”€ */}
        {tab === 'audit' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Time</Th><Th>Order ID</Th><Th>Event</Th><Th>User</Th>
                <Th>Details</Th><Th>Old Value</Th><Th>New Value</Th><Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No audit events â€” check /api/v4/blotter/audit
                </td></tr>
              )}
              {auditTrail.map((a, i) => (
                <tr key={i}>
                  <Td mono col={SUBTLE}>{fmtTime(a.timestamp)}</Td>
                  <Td mono col={AMBER}>{a.orderId.slice(0, 12)}</Td>
                  <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{a.event}</span></Td>
                  <Td mono col={PURPLE}>{a.user}</Td>
                  <Td mono col={TEXT} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.details}</Td>
                  <Td mono col={RED} style={{ maxWidth: 120 } as any}>{a.oldValue ?? 'â€”'}</Td>
                  <Td mono col={GREEN} style={{ maxWidth: 120 } as any}>{a.newValue ?? 'â€”'}</Td>
                  <Td mono col={SUBTLE}>{a.ipAddress}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
