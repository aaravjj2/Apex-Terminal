import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// OrdersUI2 — Bloomberg OMON-grade order management terminal
// Tabs: ACTIVE | HISTORY | ENTRY | BLOTTER | TCA
// APIs: /api/v1/orders, /api/v1/orders/{id}, /api/v1/trading/place-order, /api/v1/market-data/{sym}/quote

const BG = '#0a0a0a'
const PANEL = '#111111'
const BORDER = '#1e1e1e'
const AMBER = '#f5a623'
const GREEN = '#26a69a'
const RED = '#ef5350'
const BLUE = '#42a5f5'
const PURPLE = '#ab47bc'
const SUBTLE = '#555'
const TEXT = '#d1d4dc'
const MONO = '"Roboto Mono","Courier New",monospace'

type OrderSide = 'buy' | 'sell' | 'buy_to_cover' | 'sell_short'
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trail' | 'moo' | 'moc'
type OrderStatus = 'pending' | 'working' | 'partial' | 'filled' | 'canceled' | 'rejected' | 'expired'
type OrderTIF = 'day' | 'gtc' | 'gtd' | 'ioc' | 'fok' | 'opg' | 'cls'

interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  filled: number
  price: number | null
  stopPrice: number | null
  trailAmt: number | null
  status: OrderStatus
  tif: OrderTIF
  avgFill: number | null
  commission: number
  slippage: number | null
  vwap: number | null
  createdAt: string
  updatedAt: string
  note: string
}

interface BlotterRow {
  id: string
  symbol: string
  execTime: string
  side: OrderSide
  qty: number
  price: number
  value: number
  venue: string
  commission: number
}

interface TCARow {
  symbol: string
  orders: number
  totalQty: number
  avgSlippage: number
  bpsVsVwap: number
  participation: number
  estImpact: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SideChip({ side }: { side: OrderSide }) {
  const buy = side === 'buy' || side === 'buy_to_cover'
  const label = side === 'buy' ? 'BUY' : side === 'sell' ? 'SELL' : side === 'buy_to_cover' ? 'BTC' : 'SS'
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700,
      color: buy ? GREEN : RED, background: buy ? '#0d2020' : '#1a0808',
      padding: '2px 6px', borderRadius: 2, border: `1px solid ${buy ? '#1a3838' : '#2a1010'}` }}>
      {label}
    </span>
  )
}

function StatusChip({ status }: { status: OrderStatus }) {
  const cfg: Record<OrderStatus, { c: string; bg: string }> = {
    pending:  { c: '#aaa', bg: '#1a1a1a' },
    working:  { c: AMBER, bg: '#1a1200' },
    partial:  { c: BLUE,  bg: '#0a1220' },
    filled:   { c: GREEN, bg: '#0a1a18' },
    canceled: { c: SUBTLE, bg: '#141414' },
    rejected: { c: RED,  bg: '#1a0a0a' },
    expired:  { c: '#888', bg: '#161616' },
  }
  const { c, bg } = cfg[status]
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      color: c, background: bg, padding: '2px 6px', borderRadius: 2, border: `1px solid ${c}33` }}>
      {status}
    </span>
  )
}

function TypeChip({ type }: { type: OrderType }) {
  const cfg: Record<OrderType, string> = {
    market: AMBER, limit: BLUE, stop: RED, stop_limit: '#ff8a65', trail: PURPLE,
    moo: '#80cbc4', moc: '#80cbc4',
  }
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, color: cfg[type] || TEXT,
      background: '#111', padding: '1px 5px', borderRadius: 2, border: `1px solid ${cfg[type] || '#333'}44` }}>
      {type.toUpperCase().replace('_', '-')}
    </span>
  )
}

function FillBar({ filled, qty }: { filled: number; qty: number }) {
  const pct = qty > 0 ? Math.min(100, (filled / qty) * 100) : 0
  const col = pct >= 100 ? GREEN : pct > 0 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 50, height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{filled}/{qty}</span>
    </div>
  )
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 8px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 8px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
}

function Btn({ onClick, children, disabled, col }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; col?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: MONO, fontSize: 11, color: disabled ? SUBTLE : col || TEXT, background: '#161616', border: `1px solid ${disabled ? BORDER : col || '#444'}`, borderRadius: 3, padding: '4px 10px', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{ fontFamily: MONO, fontSize: 12, color: TEXT, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: '100%', outline: 'none' }} />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ fontFamily: MONO, fontSize: 12, color: TEXT, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: '100%', outline: 'none' }}>
      {options.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
    </select>
  )
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}
function fmtNum(v: number | null, dp = 2) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
function fmtBps(v: number) {
  return `${v > 0 ? '+' : ''}${(v * 10000).toFixed(1)} bps`
}


export function OrdersUI2() {
  const [tab, setTab] = useState<'active' | 'history' | 'entry' | 'blotter' | 'tca'>('active')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [sideFilter, setSideFilter] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Order entry state
  const [eSymbol, setESymbol] = useState('AAPL')
  const [eSide, setESide] = useState<OrderSide>('buy')
  const [eType, setEType] = useState<OrderType>('limit')
  const [eQty, setEQty] = useState('100')
  const [ePrice, setEPrice] = useState('')
  const [eStop, setEStop] = useState('')
  const [eTIF, setETIF] = useState<OrderTIF>('day')
  const [eNote, setENote] = useState('')
  const [eSubmitting, setESubmitting] = useState(false)
  const [eSuccess, setESuccess] = useState<string | null>(null)
  const [eErr, setEErr] = useState<string | null>(null)
  const [eLiveQuote, setELiveQuote] = useState<{ price: number; bid: number; ask: number } | null>(null)
  const [blotter, setBlotter] = useState<BlotterRow[]>([])
  const [tca, setTCA] = useState<TCARow[]>([])

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/orders')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.orders ?? d.data ?? []
      const mapped: Order[] = raw.map((o: any) => ({
        id: o.order_id ?? o.id ?? String(Math.random()),
        symbol: o.symbol ?? '',
        side: o.side ?? 'buy',
        type: o.type ?? o.order_type ?? 'market',
        qty: Number(o.quantity ?? o.qty ?? 0),
        filled: Number(o.filled_quantity ?? o.filled ?? 0),
        price: o.price != null ? Number(o.price) : null,
        stopPrice: o.stop_price != null ? Number(o.stop_price) : null,
        trailAmt: o.trail_amount != null ? Number(o.trail_amount) : null,
        status: o.status ?? 'pending',
        tif: o.tif ?? o.time_in_force ?? 'day',
        avgFill: o.avg_fill_price != null ? Number(o.avg_fill_price) : null,
        commission: Number(o.commission ?? 0),
        slippage: o.slippage != null ? Number(o.slippage) : null,
        vwap: o.vwap != null ? Number(o.vwap) : null,
        createdAt: o.created_at ?? o.timestamp ?? '',
        updatedAt: o.updated_at ?? o.timestamp ?? '',
        note: o.note ?? '',
      }))
      setOrders(mapped)
      setErr(null)
    } catch (e: any) {
      setErr(e.message)
    }
  }, [])

  const fetchBlotter = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/orders/executions')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.executions ?? []
      setBlotter(raw.map((x: any) => ({
        id: x.exec_id ?? x.id ?? String(Math.random()),
        symbol: x.symbol ?? '',
        execTime: x.exec_time ?? x.timestamp ?? '',
        side: x.side ?? 'buy',
        qty: Number(x.qty ?? 0),
        price: Number(x.price ?? 0),
        value: Number(x.value ?? x.qty * x.price ?? 0),
        venue: x.venue ?? x.exchange ?? 'ARCA',
        commission: Number(x.commission ?? 0),
      })))
    } catch { /* empty blotter on fail */ }
  }, [])

  const fetchTCA = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/orders/tca')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.tca ?? []
      setTCA(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        orders: Number(x.orders ?? 0),
        totalQty: Number(x.total_qty ?? 0),
        avgSlippage: Number(x.avg_slippage ?? 0),
        bpsVsVwap: Number(x.bps_vs_vwap ?? 0),
        participation: Number(x.participation ?? 0),
        estImpact: Number(x.est_impact ?? 0),
      })))
    } catch { /* empty TCA */ }
  }, [])

  const fetchLiveQuote = useCallback(async (sym: string) => {
    if (!sym) return
    try {
      const r = await fetch(`/api/v1/market-data/${sym}/quote`)
      if (!r.ok) return
      const d = await r.json()
      const p = Number(d.price ?? d.last ?? d.close ?? 0)
      const bid = Number(d.bid ?? p * 0.9995)
      const ask = Number(d.ask ?? p * 1.0005)
      setELiveQuote({ price: p, bid, ask })
    } catch { setELiveQuote(null) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchOrders().finally(() => setLoading(false))
    fetchBlotter()
    fetchTCA()
    pollRef.current = setInterval(() => {
      fetchOrders()
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchOrders, fetchBlotter, fetchTCA])

  useEffect(() => {
    if (tab === 'entry' && eSymbol) {
      fetchLiveQuote(eSymbol)
      const t = setInterval(() => fetchLiveQuote(eSymbol), 3000)
      return () => clearInterval(t)
    }
  }, [tab, eSymbol, fetchLiveQuote])

  const cancelOrder = async (id: string) => {
    try {
      await fetch(`/api/v1/orders/${id}`, { method: 'DELETE' })
      fetchOrders()
    } catch { /* ignore */ }
  }

  const modifyOrder = async (id: string, price: number) => {
    try {
      await fetch(`/api/v1/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price }) })
      fetchOrders()
    } catch { /* ignore */ }
  }

  const submitOrder = async () => {
    if (!eSymbol || !eQty) { setEErr('Symbol and quantity required'); return }
    setESubmitting(true); setEErr(null); setESuccess(null)
    try {
      const body: any = { symbol: eSymbol.toUpperCase(), side: eSide, type: eType, quantity: Number(eQty), time_in_force: eTIF }
      if (eType !== 'market' && ePrice) body.price = Number(ePrice)
      if ((eType === 'stop' || eType === 'stop_limit') && eStop) body.stop_price = Number(eStop)
      if (eNote) body.note = eNote
      const r = await fetch('/api/v1/trading/place-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail ?? `HTTP ${r.status}`) }
      const d = await r.json()
      setESuccess(`Order placed — ID: ${d.order_id ?? d.id ?? 'OK'}`)
      fetchOrders()
      setEQty('100'); setEPrice(''); setEStop(''); setENote('')
    } catch (e: any) { setEErr(e.message) }
    finally { setESubmitting(false) }
  }

  // â”€â”€ FILTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const activeStatuses: OrderStatus[] = ['pending', 'working', 'partial']
  const historyStatuses: OrderStatus[] = ['filled', 'canceled', 'rejected', 'expired']

  const filteredOrders = orders.filter(o => {
    const inScope = tab === 'active' ? activeStatuses.includes(o.status) : historyStatuses.includes(o.status)
    if (!inScope) return false
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (symbolFilter && !o.symbol.toUpperCase().includes(symbolFilter.toUpperCase())) return false
    if (sideFilter !== 'all' && o.side !== sideFilter) return false
    return true
  })

  // â”€â”€ STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalValue = orders.filter(o => o.qty && o.avgFill).reduce((s, o) => s + o.filled * (o.avgFill ?? 0), 0)
  const totalComm = orders.reduce((s, o) => s + o.commission, 0)
  const fillRate = orders.length ? (orders.filter(o => o.status === 'filled').length / orders.length) * 100 : 0
  const workingOrders = orders.filter(o => activeStatuses.includes(o.status))

  // â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const css: React.CSSProperties = { fontFamily: MONO }
  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'active', label: 'ACTIVE' }, { id: 'history', label: 'HISTORY' },
    { id: 'entry', label: 'ORDER ENTRY' }, { id: 'blotter', label: 'BLOTTER' }, { id: 'tca', label: 'TCA' },
  ]

  const filterBar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
      <input value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} placeholder="SYMBOL"
        style={{ ...css, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 90, outline: 'none' }} />
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        style={{ ...css, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
        <option value="all">ALL STATUS</option>
        {(tab === 'active' ? activeStatuses : historyStatuses).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
      </select>
      <select value={sideFilter} onChange={e => setSideFilter(e.target.value)}
        style={{ ...css, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
        <option value="all">BOTH SIDES</option>
        <option value="buy">BUY</option>
        <option value="sell">SELL</option>
      </select>
      <span style={{ fontSize: 10, color: SUBTLE, marginLeft: 8 }}>{filteredOrders.length} orders</span>
    </div>
  )

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>OMON</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>ORDER MANAGEMENT</span>
          {workingOrders.length > 0 && (
            <span style={{ fontSize: 10, color: AMBER, background: '#1a1200', border: `1px solid ${AMBER}44`, borderRadius: 10, padding: '2px 8px' }}>
              â— {workingOrders.length} WORKING
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={fetchOrders}>â†» REFRESH</Btn>
          <Btn onClick={() => setTab('entry')} col={GREEN}>+ NEW ORDER</Btn>
        </div>
      </div>

      {/* â”€â”€ STATS STRIP â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Orders" value={orders.length} />
        <StatCard label="Working" value={workingOrders.length} col={workingOrders.length > 0 ? AMBER : TEXT} />
        <StatCard label="Fill Rate" value={`${fillRate.toFixed(1)}%`} col={fillRate > 80 ? GREEN : fillRate > 50 ? AMBER : RED} />
        <StatCard label="Total Value" value={`$${(totalValue / 1e6).toFixed(2)}M`} />
        <StatCard label="Commission" value={`$${fmtNum(totalComm)}`} col={totalComm > 0 ? RED : SUBTLE} />
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11 }}>Loading...</div>}

        {/* â”€â”€ ACTIVE â”€â”€ */}
        {(tab === 'active' || tab === 'history') && (
          <>
            {filterBar}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <Th>Time</Th><Th>Symbol</Th><Th>Side</Th><Th>Type</Th>
                    <Th right>Qty / Filled</Th><Th right>Price</Th><Th right>Stop</Th>
                    <Th right>Avg Fill</Th><Th>TIF</Th><Th>Status</Th><Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : 'No orders'}
                    </td></tr>
                  )}
                  {filteredOrders.map(o => (
                    <tr key={o.id} onClick={() => setSelected(selected === o.id ? null : o.id)}
                      style={{ cursor: 'pointer', background: selected === o.id ? '#141414' : 'transparent', transition: 'background 0.1s' }}>
                      <Td mono>{fmtTime(o.createdAt)}</Td>
                      <Td mono col={AMBER}>{o.symbol}</Td>
                      <Td><SideChip side={o.side} /></Td>
                      <Td><TypeChip type={o.type} /></Td>
                      <Td right><FillBar filled={o.filled} qty={o.qty} /></Td>
                      <Td right mono>{o.price != null ? `$${fmtNum(o.price)}` : 'MKT'}</Td>
                      <Td right mono>{o.stopPrice != null ? `$${fmtNum(o.stopPrice)}` : '—'}</Td>
                      <Td right mono col={o.avgFill ? GREEN : SUBTLE}>{o.avgFill != null ? `$${fmtNum(o.avgFill)}` : '—'}</Td>
                      <Td mono>{o.tif.toUpperCase()}</Td>
                      <Td><StatusChip status={o.status} /></Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(o.status === 'working' || o.status === 'pending') && (
                            <Btn col={RED} onClick={() => cancelOrder(o.id)}>âœ•</Btn>
                          )}
                          {o.type === 'limit' && (o.status === 'working' || o.status === 'pending') && (
                            <Btn col={BLUE} onClick={() => { const p = prompt('New price:'); if (p) modifyOrder(o.id, Number(p)) }}>MOD</Btn>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* â”€â”€ detail panel â”€â”€ */}
            {selected && (() => {
              const o = orders.find(x => x.id === selected)
              if (!o) return null
              const slip = o.avgFill && o.price ? ((o.avgFill - o.price) / o.price) * (o.side === 'buy' ? 1 : -1) : null
              return (
                <div style={{ marginTop: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Order Detail — {o.id}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      ['Symbol', o.symbol, AMBER], ['Side', o.side.toUpperCase(), o.side === 'buy' ? GREEN : RED],
                      ['Type', o.type.toUpperCase(), BLUE], ['Status', o.status.toUpperCase(), TEXT],
                      ['Qty', String(o.qty), TEXT], ['Filled', String(o.filled), TEXT],
                      ['LimitPrice', o.price != null ? `$${fmtNum(o.price)}` : '—', TEXT],
                      ['AvgFill', o.avgFill != null ? `$${fmtNum(o.avgFill)}` : '—', GREEN],
                      ['Slippage', slip != null ? `${(slip * 10000).toFixed(1)} bps` : '—', slip && slip > 0.0005 ? RED : GREEN],
                      ['VWAP', o.vwap != null ? `$${fmtNum(o.vwap)}` : '—', TEXT],
                      ['Commission', `$${fmtNum(o.commission)}`, TEXT],
                      ['Created', fmtTime(o.createdAt), SUBTLE],
                    ].map(([l, v, c]) => (
                      <div key={l as string} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}>
                        <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>{l as string}</div>
                        <div style={{ fontSize: 12, color: c as string, fontFamily: MONO, marginTop: 2 }}>{v as string}</div>
                      </div>
                    ))}
                    {o.note && <div style={{ gridColumn: '1/-1', fontSize: 11, color: SUBTLE }}>Note: {o.note}</div>}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* â”€â”€ ORDER ENTRY â”€â”€ */}
        {tab === 'entry' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* left — order form */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 11, color: AMBER, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>
                Order Entry
              </div>

              {/* side toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 4, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                {(['buy', 'sell'] as OrderSide[]).map(s => (
                  <button key={s} onClick={() => setESide(s)} style={{ flex: 1, padding: '8px', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', letterSpacing: 1,
                    background: eSide === s ? (s === 'buy' ? GREEN : RED) : '#0d0d0d', color: eSide === s ? '#000' : SUBTLE, transition: 'all 0.15s' }}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label="Symbol"><Input value={eSymbol} onChange={v => setESymbol(v.toUpperCase())} placeholder="AAPL" /></Field>
                <Field label="Quantity"><Input value={eQty} onChange={setEQty} type="number" placeholder="100" /></Field>
                <Field label="Order Type"><Select value={eType} onChange={v => setEType(v as OrderType)} options={['market', 'limit', 'stop', 'stop_limit', 'trail', 'moo', 'moc']} /></Field>
                <Field label="Time In Force"><Select value={eTIF} onChange={v => setETIF(v as OrderTIF)} options={['day', 'gtc', 'gtd', 'ioc', 'fok', 'opg', 'cls']} /></Field>
                {eType !== 'market' && eType !== 'stop' && eType !== 'moo' && eType !== 'moc' && (
                  <Field label="Limit Price"><Input value={ePrice} onChange={setEPrice} type="number" placeholder="0.00" /></Field>
                )}
                {(eType === 'stop' || eType === 'stop_limit') && (
                  <Field label="Stop Price"><Input value={eStop} onChange={setEStop} type="number" placeholder="0.00" /></Field>
                )}
                <Field label="Note (optional)"><Input value={eNote} onChange={setENote} placeholder="Optional note" /></Field>
              </div>

              {/* order preview */}
              <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 12px', marginBottom: 12, fontSize: 11 }}>
                <div style={{ color: SUBTLE, marginBottom: 4 }}>ORDER PREVIEW</div>
                <div style={{ color: eSide === 'buy' ? GREEN : RED, fontWeight: 700, fontSize: 13 }}>
                  {eSide.toUpperCase()} {eQty || '0'} {eSymbol || '—'} @ {eType === 'market' ? 'MARKET' : (ePrice ? `$${ePrice}` : 'TBD')}
                </div>
                {eType === 'stop_limit' && eStop && <div style={{ color: SUBTLE, fontSize: 10 }}>Stop: ${eStop}</div>}
                <div style={{ color: SUBTLE, fontSize: 10, marginTop: 2 }}>TIF: {eTIF.toUpperCase()} | {eType.toUpperCase()}</div>
                {eLiveQuote && ePrice && eType === 'limit' && (
                  <div style={{ fontSize: 10, color: AMBER, marginTop: 4 }}>
                    âˆ† vs last: {((Number(ePrice) - eLiveQuote.price) / eLiveQuote.price * 100).toFixed(3)}%
                  </div>
                )}
              </div>

              {eErr && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 3, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: RED }}>{eErr}</div>}
              {eSuccess && <div style={{ background: '#0a1a18', border: `1px solid ${GREEN}44`, borderRadius: 3, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: GREEN }}>{eSuccess}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitOrder} disabled={eSubmitting}
                  style={{ flex: 1, padding: '10px', fontFamily: MONO, fontSize: 12, fontWeight: 700, cursor: eSubmitting ? 'not-allowed' : 'pointer',
                    background: eSide === 'buy' ? (eSubmitting ? '#0d2020' : GREEN) : (eSubmitting ? '#1a0808' : RED),
                    color: '#000', border: 'none', borderRadius: 3, letterSpacing: 1, transition: 'all 0.15s' }}>
                  {eSubmitting ? 'SUBMITTING...' : `SUBMIT ${eSide.toUpperCase()} ORDER`}
                </button>
                <Btn onClick={() => { setEPrice(''); setEStop(''); setENote(''); setEErr(null); setESuccess(null) }}>CLEAR</Btn>
              </div>
            </div>

            {/* right — live quote + quick order presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* live quote */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Live Quote — {eSymbol || '—'}</div>
                {eLiveQuote ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <StatCard label="Last" value={`$${fmtNum(eLiveQuote.price)}`} />
                    <StatCard label="Bid" value={`$${fmtNum(eLiveQuote.bid)}`} col={GREEN} />
                    <StatCard label="Ask" value={`$${fmtNum(eLiveQuote.ask)}`} col={RED} />
                  </div>
                ) : <div style={{ color: SUBTLE, fontSize: 11 }}>No quote — enter valid symbol</div>}
              </div>

              {/* quick bracket presets */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Quick Bracket Presets</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Aggressive Buy Market 100', action: () => { setESide('buy'); setEType('market'); setEQty('100') } },
                    { label: 'Buy Limit at Bid', action: () => { setESide('buy'); setEType('limit'); setEQty('100'); if (eLiveQuote) setEPrice(fmtNum(eLiveQuote.bid, 2)) } },
                    { label: 'Sell Limit at Ask', action: () => { setESide('sell'); setEType('limit'); setEQty('100'); if (eLiveQuote) setEPrice(fmtNum(eLiveQuote.ask, 2)) } },
                    { label: 'Buy Stop +2% Breakout', action: () => { setESide('buy'); setEType('stop'); setEQty('100'); if (eLiveQuote) setEStop(fmtNum(eLiveQuote.price * 1.02, 2)) } },
                    { label: 'Sell Stop -2% Protect', action: () => { setESide('sell'); setEType('stop'); setEQty('100'); if (eLiveQuote) setEStop(fmtNum(eLiveQuote.price * 0.98, 2)) } },
                    { label: 'MOO Market on Open', action: () => { setESide('buy'); setEType('moo'); setEQty('100'); setETIF('opg') } },
                    { label: 'MOC Market on Close', action: () => { setESide('sell'); setEType('moc'); setEQty('100'); setETIF('cls') } },
                  ].map(p => (
                    <button key={p.label} onClick={p.action}
                      style={{ fontFamily: MONO, fontSize: 10, color: BLUE, background: '#0a1220', border: `1px solid ${BLUE}33`, borderRadius: 3, padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}>
                      â–º {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* recent fills */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, flex: 1 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recent Fills</div>
                {orders.filter(o => o.status === 'filled').slice(-5).reverse().map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>
                    <span style={{ color: AMBER }}>{o.symbol}</span>
                    <SideChip side={o.side} />
                    <span style={{ color: TEXT }}>{o.filled} @ ${o.avgFill != null ? fmtNum(o.avgFill) : '—'}</span>
                    <span style={{ color: SUBTLE }}>{fmtTime(o.updatedAt)}</span>
                  </div>
                ))}
                {orders.filter(o => o.status === 'filled').length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No fills today</div>}
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ BLOTTER â”€â”€ */}
        {tab === 'blotter' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: SUBTLE, display: 'flex', justifyContent: 'space-between' }}>
              <span>EXECUTION BLOTTER — {blotter.length} records</span>
              <span>Total Value: ${(blotter.reduce((s, x) => s + x.value, 0) / 1e6).toFixed(2)}M</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Exec Time</Th><Th>Symbol</Th><Th>Side</Th><Th right>Qty</Th>
                  <Th right>Price</Th><Th right>Value</Th><Th>Venue</Th><Th right>Commission</Th>
                </tr>
              </thead>
              <tbody>
                {blotter.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No executions — connect to live broker</td></tr>
                )}
                {blotter.map(x => (
                  <tr key={x.id}>
                    <Td mono>{fmtTime(x.execTime)}</Td>
                    <Td mono col={AMBER}>{x.symbol}</Td>
                    <Td><SideChip side={x.side} /></Td>
                    <Td right mono>{x.qty.toLocaleString()}</Td>
                    <Td right mono>${fmtNum(x.price)}</Td>
                    <Td right mono col={x.side === 'buy' ? RED : GREEN}>${(x.value / 1000).toFixed(1)}K</Td>
                    <Td mono>{x.venue}</Td>
                    <Td right mono col={RED}>${fmtNum(x.commission)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* â”€â”€ TCA â”€â”€ */}
        {tab === 'tca' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {tca.length > 0 && [
                ['Symbols Traded', tca.length],
                ['Total Orders', tca.reduce((s, x) => s + x.orders, 0)],
                ['Total Qty', tca.reduce((s, x) => s + x.totalQty, 0).toLocaleString()],
                ['Avg Slippage', fmtBps(tca.reduce((s, x) => s + x.avgSlippage, 0) / (tca.length || 1))],
              ].map(([l, v]) => (
                <StatCard key={l as string} label={l as string} value={v as string | number} />
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: SUBTLE }}>
                TRANSACTION COST ANALYSIS
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th right>Orders</Th><Th right>Total Qty</Th>
                    <Th right>Avg Slippage</Th><Th right>vs VWAP</Th>
                    <Th right>Participation%</Th><Th right>Est. Impact</Th>
                  </tr>
                </thead>
                <tbody>
                  {tca.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No TCA data — execute orders to build TCA report
                    </td></tr>
                  )}
                  {tca.map(x => (
                    <tr key={x.symbol}>
                      <Td mono col={AMBER}>{x.symbol}</Td>
                      <Td right mono>{x.orders}</Td>
                      <Td right mono>{x.totalQty.toLocaleString()}</Td>
                      <Td right mono col={Math.abs(x.avgSlippage) > 0.001 ? RED : GREEN}>{fmtBps(x.avgSlippage)}</Td>
                      <Td right mono col={x.bpsVsVwap > 0 ? RED : GREEN}>{fmtBps(x.bpsVsVwap)}</Td>
                      <Td right mono>{(x.participation * 100).toFixed(2)}%</Td>
                      <Td right mono col={x.estImpact > 0.001 ? RED : TEXT}>{fmtBps(x.estImpact)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TCA explanation */}
            <div style={{ marginTop: 12, background: '#0a1220', border: `1px solid ${BLUE}33`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>TCA Methodology</div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>
                <strong style={{ color: TEXT }}>Slippage</strong> = (AvgFill - LimitPrice) / LimitPrice Ã— direction &nbsp;|&nbsp;
                <strong style={{ color: TEXT }}>VWAP Benchmark</strong> = AvgFill vs intraday VWAP &nbsp;|&nbsp;
                <strong style={{ color: TEXT }}>Market Impact</strong> = estimated permanent + temporary price impact &nbsp;|&nbsp;
                <strong style={{ color: TEXT }}>Participation</strong> = order qty / total market volume for that session
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
