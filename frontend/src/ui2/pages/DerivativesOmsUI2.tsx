import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// DerivativesOmsUI2 — Bloomberg DOMS-grade derivatives OMS terminal
// Multi-leg order management, exercise / assignment, expiry management
// Tabs: OPEN ORDERS | POSITIONS | EXPIRY MGMT | EXERCISE | AUDIT LOG
// APIs: /api/v4/derivatives-oms/orders, /positions, /expiry, /exercise, /audit

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

type OrderSide = 'buy' | 'sell'
type OrderStatus = 'working' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired'
type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit' | 'mit' | 'loc'
type OptionRight = 'call' | 'put'

interface DerivOrder {
  orderId: string
  underlying: string
  symbol: string
  side: OrderSide
  orderType: OrderType
  right: OptionRight | null
  strike: number | null
  expiry: string
  legs: OrderLeg[]
  totalQty: number
  filledQty: number
  limitPrice: number
  limitBid: number
  limitAsk: number
  status: OrderStatus
  strategy: string
  account: string
  submittedAt: string
  delta: number
  gamma: number
  theta: number
  vega: number
  pnl: number
}

interface OrderLeg {
  symbol: string
  side: OrderSide
  right: OptionRight
  strike: number
  expiry: string
  qty: number
  filled: number
  price: number
  delta: number
}

interface DerivPosition {
  symbol: string
  underlying: string
  right: OptionRight | null
  strike: number | null
  expiry: string
  qty: number
  avgCost: number
  marketPrice: number
  marketValue: number
  unrealizedPnl: number
  realizedPnl: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  daysToExpiry: number
  accountWorthAtRisk: number
}

interface ExpiryEvent {
  symbol: string
  underlying: string
  right: OptionRight
  strike: number
  expiry: string
  qty: number
  action: 'expire_worthless' | 'exercise' | 'assign' | 'close_before_expiry' | 'roll'
  itm: boolean
  intrinsicValue: number
  autoAction: string
  daysToExpiry: number
  riskToExpiry: number
}

interface ExerciseEntry {
  exerciseId: string
  symbol: string
  underlying: string
  right: OptionRight
  strike: number
  expiry: string
  qty: number
  action: 'exercise' | 'lapse' | 'do_not_exercise'
  status: 'pending' | 'submitted' | 'confirmed' | 'cancelled'
  submittedAt: string
  account: string
}

interface OmsAuditEntry {
  entryId: string
  timestamp: string
  orderId: string
  event: string
  user: string
  details: string
  status: string
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

function SideBadge({ side }: { side: OrderSide }) {
  return <span style={{ fontFamily: MONO, fontSize: 9, color: side === 'buy' ? GREEN : RED, background: (side === 'buy' ? GREEN : RED) + '22', padding: '2px 6px', borderRadius: 2 }}>{side.toUpperCase()}</span>
}

function StatusBadge2({ status }: { status: OrderStatus }) {
  const c = status === 'filled' ? GREEN : status === 'partial' ? AMBER : status === 'working' ? BLUE : status === 'rejected' ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{status.toUpperCase()}</span>
}

function RightBadge({ right }: { right: OptionRight }) {
  const c = right === 'call' ? BLUE : ORANGE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{right.toUpperCase()}</span>
}

function GreekCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'inline-block', marginRight: 8 }}>
      <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{label}:</span>
      <span style={{ fontSize: 10, color: TEXT, fontFamily: MONO, marginLeft: 3 }}>{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
    </div>
  )
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? (filled / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? GREEN : AMBER, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{filled}/{total}</span>
    </div>
  )
}

function fmtDte(dte: number) { return dte <= 7 ? <span style={{ color: RED, fontWeight: 700 }}>{dte}d</span> : dte <= 21 ? <span style={{ color: AMBER }}>{dte}d</span> : <span style={{ color: SUBTLE }}>{dte}d</span> }


export function DerivativesOmsUI2() {
  const [tab, setTab] = useState<'orders' | 'positions' | 'expiry' | 'exercise' | 'audit'>('orders')
  const [orders, setOrders] = useState<DerivOrder[]>([])
  const [positions, setPositions] = useState<DerivPosition[]>([])
  const [expiryEvents, setExpiryEvents] = useState<ExpiryEvent[]>([])
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [auditLog, setAuditLog] = useState<OmsAuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [rightFilter, setRightFilter] = useState<OptionRight | 'all'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rOr, rPos, rEx, rExc, rAu] = await Promise.allSettled([
        fetch('/api/v4/derivatives-oms/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-oms/positions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-oms/expiry').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-oms/exercise').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-oms/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rOr.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rOr.value) ? rOr.value : rOr.value.orders ?? rOr.value.data ?? []
        setOrders(raw.map((o: any) => ({
          orderId: o.order_id ?? o.id ?? '',
          underlying: o.underlying ?? '', symbol: o.symbol ?? '',
          side: (o.side ?? 'buy') as OrderSide, orderType: (o.order_type ?? o.type ?? 'limit') as OrderType,
          right: o.right as OptionRight | null, strike: o.strike ? Number(o.strike) : null,
          expiry: o.expiry ?? '', legs: Array.isArray(o.legs) ? o.legs : [],
          totalQty: Number(o.total_qty ?? o.qty ?? 0), filledQty: Number(o.filled_qty ?? o.filled ?? 0),
          limitPrice: Number(o.limit_price ?? o.price ?? 0),
          limitBid: Number(o.limit_bid ?? o.bid ?? 0), limitAsk: Number(o.limit_ask ?? o.ask ?? 0),
          status: (o.status ?? 'working') as OrderStatus, strategy: o.strategy ?? '',
          account: o.account ?? '', submittedAt: o.submitted_at ?? o.created_at ?? '',
          delta: Number(o.delta ?? 0), gamma: Number(o.gamma ?? 0),
          theta: Number(o.theta ?? 0), vega: Number(o.vega ?? 0),
          pnl: Number(o.pnl ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load derivatives OMS')
      if (rPos.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rPos.value) ? rPos.value : rPos.value.positions ?? rPos.value.data ?? []
        setPositions(raw.map((p: any) => ({
          symbol: p.symbol ?? '', underlying: p.underlying ?? '',
          right: p.right as OptionRight | null, strike: p.strike ? Number(p.strike) : null,
          expiry: p.expiry ?? '', qty: Number(p.qty ?? 0),
          avgCost: Number(p.avg_cost ?? 0), marketPrice: Number(p.market_price ?? 0),
          marketValue: Number(p.market_value ?? 0), unrealizedPnl: Number(p.unrealized_pnl ?? 0),
          realizedPnl: Number(p.realized_pnl ?? 0), delta: Number(p.delta ?? 0),
          gamma: Number(p.gamma ?? 0), theta: Number(p.theta ?? 0),
          vega: Number(p.vega ?? 0), rho: Number(p.rho ?? 0),
          daysToExpiry: Number(p.days_to_expiry ?? p.dte ?? 0),
          accountWorthAtRisk: Number(p.account_worth_at_risk ?? p.var ?? 0),
        })))
      }
      if (rEx.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rEx.value) ? rEx.value : rEx.value.events ?? rEx.value.data ?? []
        setExpiryEvents(raw.map((e: any) => ({
          symbol: e.symbol ?? '', underlying: e.underlying ?? '',
          right: (e.right ?? 'call') as OptionRight, strike: Number(e.strike ?? 0),
          expiry: e.expiry ?? '', qty: Number(e.qty ?? 0),
          action: (e.action ?? 'expire_worthless') as ExpiryEvent['action'],
          itm: Boolean(e.itm ?? false), intrinsicValue: Number(e.intrinsic_value ?? 0),
          autoAction: e.auto_action ?? '', daysToExpiry: Number(e.days_to_expiry ?? e.dte ?? 0),
          riskToExpiry: Number(e.risk_to_expiry ?? 0),
        })))
      }
      if (rExc.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rExc.value) ? rExc.value : rExc.value.exercises ?? rExc.value.data ?? []
        setExercises(raw.map((e: any) => ({
          exerciseId: e.exercise_id ?? e.id ?? '', symbol: e.symbol ?? '', underlying: e.underlying ?? '',
          right: (e.right ?? 'call') as OptionRight, strike: Number(e.strike ?? 0), expiry: e.expiry ?? '',
          qty: Number(e.qty ?? 0), action: (e.action ?? 'exercise') as ExerciseEntry['action'],
          status: (e.status ?? 'pending') as ExerciseEntry['status'],
          submittedAt: e.submitted_at ?? '', account: e.account ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAu.value) ? rAu.value : rAu.value.entries ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          entryId: a.entry_id ?? a.id ?? '', timestamp: a.timestamp ?? a.created_at ?? '',
          orderId: a.order_id ?? '', event: a.event ?? '', user: a.user ?? '',
          details: a.details ?? a.description ?? '', status: a.status ?? '',
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

  const visOrders = orders.filter(o => (statusFilter === 'all' || o.status === statusFilter) && (rightFilter === 'all' || o.right === rightFilter))
  const visPositions = positions.filter(p => rightFilter === 'all' || p.right === rightFilter)
  const urgentExpiry = expiryEvents.filter(e => e.daysToExpiry <= 3).length
  const totalGreekDelta = positions.reduce((s, p) => s + p.delta * p.qty, 0)

  const TABS = [
    { id: 'orders' as const, label: `OPEN ORDERS (${orders.filter(o => o.status === 'working' || o.status === 'partial').length})` },
    { id: 'positions' as const, label: `POSITIONS (${positions.length})` },
    { id: 'expiry' as const, label: `EXPIRY MGMT${urgentExpiry > 0 ? ` ⚠${urgentExpiry}` : ''}` },
    { id: 'exercise' as const, label: 'EXERCISE / ASSIGN' },
    { id: 'audit' as const, label: 'AUDIT LOG' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>DOMS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DERIVATIVES OMS — MULTI-LEG ORDER MGMT + EXERCISE + EXPIRY</span>
        {urgentExpiry > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠ {urgentExpiry} EXPIRING IN 3 DAYS</span>}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Working Orders" value={orders.filter(o => o.status === 'working').length} col={BLUE} />
        <StatCard label="Open Positions" value={positions.length} />
        <StatCard label="Portfolio Delta" value={totalGreekDelta.toFixed(0)} col={totalGreekDelta < 0 ? RED : GREEN} sub="net delta units" />
        <StatCard label="Expiry Events" value={expiryEvents.length} col={urgentExpiry > 0 ? RED : SUBTLE} sub={urgentExpiry > 0 ? `${urgentExpiry} urgent` : 'this week'} />
        <StatCard label="Pending Exercise" value={exercises.filter(e => e.status === 'pending').length} col={AMBER} />
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

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {(['all', 'working', 'partial', 'filled', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s as any)}
            style={{ fontFamily: MONO, fontSize: 10, color: statusFilter === s ? AMBER : SUBTLE,
              background: statusFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${statusFilter === s ? AMBER + '55' : BORDER}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
            {s.toUpperCase()}
          </button>
        ))}
        <div style={{ width: 1, background: BORDER, margin: '0 4px' }} />
        {(['all', 'call', 'put'] as const).map(r => (
          <button key={r} onClick={() => setRightFilter(r as any)}
            style={{ fontFamily: MONO, fontSize: 10, color: rightFilter === r ? AMBER : SUBTLE,
              background: rightFilter === r ? AMBER + '22' : 'transparent', border: `1px solid ${rightFilter === r ? AMBER + '55' : BORDER}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading derivatives OMS...</div>}

        {/* OPEN ORDERS */}
        {tab === 'orders' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Order ID</Th><Th>Underlying</Th><Th>Side</Th><Th>Right</Th>
                <Th right>Strike</Th><Th>Expiry</Th><Th>Strategy</Th><Th>Type</Th>
                <Th right>Qty</Th><Th>Fill</Th><Th right>Limit</Th>
                <Th>Status</Th><Th>Greeks</Th><Th right>P&L</Th>
              </tr></thead>
              <tbody>
                {visOrders.length === 0 && <tr><td colSpan={14} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No orders — check /api/v4/derivatives-oms/orders</td></tr>}
                {visOrders.map((o, i) => (
                  <tr key={i}>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{o.orderId.slice(0, 12)}</Td>
                    <Td mono col={AMBER}>{o.underlying}</Td>
                    <Td><SideBadge side={o.side} /></Td>
                    <Td>{o.right ? <RightBadge right={o.right} /> : <span style={{ color: SUBTLE, fontSize: 11 }}>—</span>}</Td>
                    <Td right mono>{o.strike ? o.strike.toFixed(0) : '—'}</Td>
                    <Td mono col={SUBTLE}>{o.expiry}</Td>
                    <Td mono col={PURPLE} style={{ fontSize: 10 }}>{o.strategy}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{o.orderType}</Td>
                    <Td right mono>{o.totalQty}</Td>
                    <Td><FillBar filled={o.filledQty} total={o.totalQty} /></Td>
                    <Td right mono>{o.limitPrice > 0 ? `$${o.limitPrice.toFixed(2)}` : '—'}</Td>
                    <Td><StatusBadge2 status={o.status} /></Td>
                    <Td>
                      <GreekCell label="Δ" value={o.delta} />
                      <GreekCell label="θ" value={o.theta} />
                    </Td>
                    <Td right mono col={o.pnl >= 0 ? GREEN : RED}>{o.pnl >= 0 ? '+' : ''}{o.pnl.toFixed(0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* POSITIONS */}
        {tab === 'positions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Symbol</Th><Th>Right</Th><Th right>Strike</Th><Th>Expiry</Th><Th>DTE</Th>
                <Th right>Qty</Th><Th right>Avg Cost</Th><Th right>Mkt Price</Th>
                <Th right>Mkt Value</Th><Th right>Unreal PnL</Th>
                <Th right>Delta</Th><Th right>Gamma</Th><Th right>Theta</Th><Th right>Vega</Th>
              </tr></thead>
              <tbody>
                {visPositions.length === 0 && <tr><td colSpan={14} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No positions — check /api/v4/derivatives-oms/positions</td></tr>}
                {visPositions.map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.symbol}</Td>
                    <Td>{p.right ? <RightBadge right={p.right} /> : <span style={{ color: SUBTLE }}>—</span>}</Td>
                    <Td right mono>{p.strike ? p.strike.toFixed(0) : '—'}</Td>
                    <Td mono col={SUBTLE}>{p.expiry}</Td>
                    <Td>{fmtDte(p.daysToExpiry)}</Td>
                    <Td right mono col={p.qty >= 0 ? GREEN : RED}>{p.qty}</Td>
                    <Td right mono>{p.avgCost.toFixed(2)}</Td>
                    <Td right mono col={BLUE}>{p.marketPrice.toFixed(2)}</Td>
                    <Td right mono col={BLUE}>${(p.marketValue / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={p.unrealizedPnl >= 0 ? GREEN : RED}>{p.unrealizedPnl >= 0 ? '+' : ''}${(p.unrealizedPnl / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={p.delta < 0 ? RED : TEXT}>{p.delta.toFixed(3)}</Td>
                    <Td right mono col={SUBTLE}>{p.gamma.toFixed(4)}</Td>
                    <Td right mono col={p.theta < 0 ? RED : TEXT}>{p.theta.toFixed(3)}</Td>
                    <Td right mono col={PURPLE}>{p.vega.toFixed(3)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EXPIRY MGMT */}
        {tab === 'expiry' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {expiryEvents.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No expiry events — check /api/v4/derivatives-oms/expiry</div>}
            {[...expiryEvents].sort((a, b) => a.daysToExpiry - b.daysToExpiry).map((e, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${e.daysToExpiry <= 3 ? RED + '66' : BORDER}`, borderRadius: 4, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER, minWidth: 120 }}>{e.symbol}</span>
                <RightBadge right={e.right} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>K={e.strike.toFixed(0)}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: SUBTLE }}>{e.expiry}</span>
                {fmtDte(e.daysToExpiry)}
                <span style={{ fontFamily: MONO, fontSize: 10, color: e.itm ? GREEN : SUBTLE }}>{e.itm ? 'ITM' : 'OTM'}</span>
                {e.itm && <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>IV=${e.intrinsicValue.toFixed(2)}</span>}
                <span style={{ flex: 1, fontSize: 10, color: BLUE, fontFamily: MONO }}>{e.autoAction}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, background: ORANGE + '22', padding: '2px 6px', borderRadius: 2 }}>{e.action.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}

        {/* EXERCISE */}
        {tab === 'exercise' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Exercise ID</Th><Th>Symbol</Th><Th>Right</Th><Th right>Strike</Th>
                <Th>Expiry</Th><Th right>Qty</Th><Th>Action</Th><Th>Status</Th><Th>Account</Th><Th>Submitted</Th>
              </tr></thead>
              <tbody>
                {exercises.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exercise entries — check /api/v4/derivatives-oms/exercise</td></tr>}
                {exercises.map((e, i) => {
                  const ac = e.action === 'exercise' ? GREEN : e.action === 'lapse' ? SUBTLE : RED
                  const sc = e.status === 'confirmed' ? GREEN : e.status === 'pending' ? AMBER : e.status === 'cancelled' ? RED : BLUE
                  return (
                    <tr key={i}>
                      <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{e.exerciseId.slice(0, 12)}</Td>
                      <Td mono col={AMBER}>{e.symbol}</Td>
                      <Td><RightBadge right={e.right} /></Td>
                      <Td right mono>{e.strike.toFixed(0)}</Td>
                      <Td mono col={SUBTLE}>{e.expiry}</Td>
                      <Td right mono>{e.qty}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: ac, background: ac + '22', padding: '2px 6px', borderRadius: 2 }}>{e.action.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: sc, background: sc + '22', padding: '2px 6px', borderRadius: 2 }}>{e.status.toUpperCase()}</span></Td>
                      <Td mono col={SUBTLE}>{e.account}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{e.submittedAt}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* AUDIT LOG */}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Timestamp</Th><Th>Order ID</Th><Th>Event</Th><Th>User</Th><Th>Details</Th><Th>Status</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries — check /api/v4/derivatives-oms/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{a.timestamp}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{a.orderId.slice(0, 12)}</Td>
                    <Td mono col={BLUE}>{a.event}</Td>
                    <Td mono col={SUBTLE}>{a.user}</Td>
                    <Td mono col={TEXT} style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10 } as any}>{a.details}</Td>
                    <Td mono col={SUBTLE}>{a.status}</Td>
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
