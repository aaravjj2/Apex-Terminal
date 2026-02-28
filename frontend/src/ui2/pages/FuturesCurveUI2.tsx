import React, { useState, useEffect, useCallback } from 'react'
﻿// FuturesCurveUI2 â€” Bloomberg COMMDS-grade futures curve terminal
// Tabs: TERM STRUCTURE | ROLL CALENDAR | BASIS | SPREAD MATRIX | SEASONALITY
// APIs: /api/v4/futures-curve/term-structure/{root},
//       /api/v4/futures-curve/roll-calendar/{root},
//       /api/v4/futures-curve/basis/{root},
//       /api/v4/futures-curve/spread/{root}

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

interface FuturesContract {
  symbol: string
  expiry: string
  daysToExpiry: number
  lastPrice: number
  settle: number
  openInterest: number
  volume: number
  basis: number
  rollYield: number
  annualCarry: number
  isSpot: boolean
  isFront: boolean
  month: string
  year: number
}

interface RollDate {
  symbol: string
  fromContract: string
  toContract: string
  rollDate: string
  daysToRoll: number
  rollCost: number
  rollCostBps: number
  openInterest: number
}

interface BasisPoint {
  date: string
  spotPrice: number
  futuresPrice: number
  basis: number
  basisPct: number
  impliedRate: number
  storageCost: number
}

interface SpreadEntry {
  leg1: string
  leg2: string
  spread: number
  spreadChange: number
  avgSpread: number
  zScore: number
}

// â”€â”€ commodity root symbols â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROOTS = [
  { root: 'ES', name: 'S&P 500', color: BLUE },
  { root: 'NQ', name: 'NASDAQ', color: PURPLE },
  { root: 'CL', name: 'Crude Oil', color: AMBER },
  { root: 'GC', name: 'Gold', color: '#ffca28' },
  { root: 'SI', name: 'Silver', color: '#90a4ae' },
  { root: 'ZC', name: 'Corn', color: '#c5e1a5' },
  { root: 'ZS', name: 'Soybeans', color: '#a5d6a7' },
  { root: 'HG', name: 'Copper', color: ORANGE },
  { root: 'NG', name: 'Nat Gas', color: '#80cbc4' },
  { root: 'ZN', name: '10Y Note', color: BLUE },
]

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ term structure SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TermStructureSVG({ contracts }: { contracts: FuturesContract[] }) {
  if (contracts.length < 2) return <div style={{ color: SUBTLE, fontSize: 11, textAlign: 'center', padding: 20 }}>Need â‰¥2 contracts</div>
  const prices = contracts.map(c => c.lastPrice).filter(Boolean)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const W = 640, H = 200, PAD = 40
  const xStep = (W - PAD * 2) / (contracts.length - 1)
  const yScale = (p: number) => H - PAD - ((p - minP) / Math.max(maxP - minP, 0.01)) * (H - PAD * 2)

  const isContango = contracts[0].lastPrice < contracts[contracts.length - 1].lastPrice
  const pts = contracts.map((c, i) => `${(PAD + i * xStep).toFixed(1)},${yScale(c.lastPrice).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      <defs>
        <linearGradient id="tsgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isContango ? RED : GREEN} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isContango ? RED : GREEN} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD + t * (H - PAD * 2)
        const val = maxP - t * (maxP - minP)
        return (
          <g key={t}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={BORDER} strokeWidth="0.5" />
            <text x={PAD - 4} y={y + 3} fontSize="9" fill={SUBTLE} textAnchor="end" fontFamily="monospace">{val.toFixed(1)}</text>
          </g>
        )
      })}
      {/* area fill */}
      <polygon points={`${PAD},${H - PAD} ${pts} ${PAD + (contracts.length - 1) * xStep},${H - PAD}`} fill="url(#tsgrad)" />
      {/* line */}
      <polyline points={pts} fill="none" stroke={isContango ? RED : GREEN} strokeWidth="2" />
      {/* dots + labels */}
      {contracts.map((c, i) => {
        const x = PAD + i * xStep
        const y = yScale(c.lastPrice)
        return (
          <g key={c.symbol}>
            <circle cx={x} cy={y} r="4" fill={c.isFront ? AMBER : (isContango ? RED : GREEN)} />
            <text x={x} y={H - 6} fontSize="8" fill={SUBTLE} textAnchor="middle" fontFamily="monospace">{c.month}{String(c.year).slice(2)}</text>
          </g>
        )
      })}
      {/* label */}
      <text x={W / 2} y={15} fontSize="9" fill={isContango ? RED : GREEN} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        {isContango ? 'â–² CONTANGO' : 'â–¼ BACKWARDATION'}
      </text>
    </svg>
  )
}

// â”€â”€ basis SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BasisSVG({ points }: { points: BasisPoint[] }) {
  if (points.length < 2) return <div style={{ color: SUBTLE, fontSize: 11, textAlign: 'center', padding: 20 }}>No basis data</div>
  const basisVals = points.map(p => p.basisPct)
  const minB = Math.min(...basisVals), maxB = Math.max(...basisVals)
  const W = 640, H = 120, PAD = 30
  const xStep = (W - PAD * 2) / (points.length - 1)
  const yScale = (b: number) => PAD + ((maxB - b) / Math.max(maxB - minB, 0.001)) * (H - PAD * 2)

  const pts = points.map((p, i) => `${(PAD + i * xStep).toFixed(1)},${yScale(p.basisPct).toFixed(1)}`).join(' ')
  const zeroY = yScale(0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke={SUBTLE} strokeWidth="0.8" strokeDasharray="3,3" />
      <polyline points={pts} fill="none" stroke={AMBER} strokeWidth="1.5" />
      {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 8)) === 0).map((p, i) => {
        const idx = Math.floor(i * points.length / 8)
        const x = PAD + idx * xStep
        return <text key={i} x={x} y={H - 2} fontSize="7" fill={SUBTLE} textAnchor="middle" fontFamily="monospace">{p.date?.slice(5)}</text>
      })}
    </svg>
  )
}

// â”€â”€ spread heatmap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SpreadHeatmap({ spreads, contracts }: { spreads: SpreadEntry[]; contracts: FuturesContract[] }) {
  const syms = contracts.slice(0, 6).map(c => c.symbol)
  if (syms.length < 2) return <div style={{ color: SUBTLE, fontSize: 11, padding: 10 }}>Need â‰¥2 contracts for spread matrix</div>
  const maxAbsZ = Math.max(...spreads.map(s => Math.abs(s.zScore)), 0.1)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ padding: '5px 8px', color: SUBTLE, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}></th>
            {syms.map(s => <th key={s} style={{ padding: '5px 8px', color: SUBTLE, textAlign: 'center', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {syms.map(r => (
            <tr key={r}>
              <td style={{ padding: '5px 8px', color: SUBTLE, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', fontWeight: 700 }}>{r}</td>
              {syms.map(c => {
                if (r === c) return <td key={c} style={{ padding: '5px 8px', background: '#0d0d0d', borderBottom: `1px solid ${BORDER}` }}>â€”</td>
                const sp = spreads.find(s => (s.leg1 === r && s.leg2 === c) || (s.leg1 === c && s.leg2 === r))
                if (!sp) return <td key={c} style={{ padding: '5px 8px', background: '#111', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, textAlign: 'right' }}>â€”</td>
                const z = sp.zScore
                const intensity = Math.min(0.9, Math.abs(z) / maxAbsZ)
                const bg = z > 0 ? `rgba(38,166,154,${intensity * 0.5})` : `rgba(239,83,80,${intensity * 0.5})`
                const col = z > 0 ? GREEN : RED
                return (
                  <td key={c} style={{ padding: '5px 8px', background: bg, borderBottom: `1px solid ${BORDER}`, textAlign: 'right', color: col, fontWeight: Math.abs(z) > 1.5 ? 700 : 400 }}>
                    {sp.spread.toFixed(2)}<br /><span style={{ fontSize: 8, color: SUBTLE }}>z={z.toFixed(1)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


export function FuturesCurveUI2() {
  const [tab, setTab] = useState<'term' | 'roll' | 'basis' | 'spread' | 'seasonal'>('term')
  const [root, setRoot] = useState('ES')
  const [contracts, setContracts] = useState<FuturesContract[]>([])
  const [rollDates, setRollDates] = useState<RollDate[]>([])
  const [basisPoints, setBasisPoints] = useState<BasisPoint[]>([])
  const [spreads, setSpreads] = useState<SpreadEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selectedContract, setSelectedContract] = useState<string | null>(null)

  const fetchTermStructure = useCallback(async (r: string) => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/v4/futures-curve/term-structure/${r}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      const raw: any[] = Array.isArray(d) ? d : d.contracts ?? d.data ?? []
      setContracts(raw.map((c: any, i: number) => ({
        symbol: c.symbol ?? c.ticker ?? '',
        expiry: c.expiry ?? c.expiry_date ?? '',
        daysToExpiry: Number(c.days_to_expiry ?? c.dte ?? 0),
        lastPrice: Number(c.last_price ?? c.last ?? c.price ?? 0),
        settle: Number(c.settle ?? c.settlement_price ?? c.last_price ?? 0),
        openInterest: Number(c.open_interest ?? 0),
        volume: Number(c.volume ?? 0),
        basis: Number(c.basis ?? 0),
        rollYield: Number(c.roll_yield ?? 0),
        annualCarry: Number(c.annual_carry ?? 0),
        isSpot: Boolean(c.is_spot ?? false),
        isFront: i === 0,
        month: c.month ?? c.expiry?.slice(4, 7) ?? '',
        year: Number(c.year ?? c.expiry?.slice(0, 4) ?? new Date().getFullYear()),
      })))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const fetchRollCalendar = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/v4/futures-curve/roll-calendar/${r}`)
      if (!res.ok) return
      const d = await res.json()
      const raw: any[] = Array.isArray(d) ? d : d.roll_dates ?? d.data ?? []
      setRollDates(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        fromContract: x.from_contract ?? x.from ?? '',
        toContract: x.to_contract ?? x.to ?? '',
        rollDate: x.roll_date ?? x.date ?? '',
        daysToRoll: Number(x.days_to_roll ?? 0),
        rollCost: Number(x.roll_cost ?? 0),
        rollCostBps: Number(x.roll_cost_bps ?? 0),
        openInterest: Number(x.open_interest ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchBasis = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/v4/futures-curve/basis/${r}`)
      if (!res.ok) return
      const d = await res.json()
      const raw: any[] = Array.isArray(d) ? d : d.basis ?? d.data ?? []
      setBasisPoints(raw.map((x: any) => ({
        date: x.date ?? '',
        spotPrice: Number(x.spot_price ?? x.spot ?? 0),
        futuresPrice: Number(x.futures_price ?? x.futures ?? 0),
        basis: Number(x.basis ?? 0),
        basisPct: Number(x.basis_pct ?? 0),
        impliedRate: Number(x.implied_rate ?? 0),
        storageCost: Number(x.storage_cost ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchSpreads = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/v4/futures-curve/spread/${r}`)
      if (!res.ok) return
      const d = await res.json()
      const raw: any[] = Array.isArray(d) ? d : d.spreads ?? d.data ?? []
      setSpreads(raw.map((x: any) => ({
        leg1: x.leg1 ?? x.near ?? '',
        leg2: x.leg2 ?? x.far ?? '',
        spread: Number(x.spread ?? 0),
        spreadChange: Number(x.spread_change ?? 0),
        avgSpread: Number(x.avg_spread ?? 0),
        zScore: Number(x.z_score ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    fetchTermStructure(root)
    fetchRollCalendar(root)
    fetchBasis(root)
    fetchSpreads(root)
  }, [root, fetchTermStructure, fetchRollCalendar, fetchBasis, fetchSpreads])

  // â”€â”€ computed stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const front = contracts.find(c => c.isFront)
  const back = contracts[contracts.length - 1]
  const isContango = front && back ? front.lastPrice < back.lastPrice : false
  const curveSlope = front && back && contracts.length > 1 ? ((back.lastPrice - front.lastPrice) / front.lastPrice) * 100 : 0
  const totalOI = contracts.reduce((s, c) => s + c.openInterest, 0)
  const totalVol = contracts.reduce((s, c) => s + c.volume, 0)
  const avgCarry = contracts.length > 0 ? contracts.reduce((s, c) => s + c.annualCarry, 0) / contracts.length : 0

  const tabs = [
    { id: 'term' as const, label: 'TERM STRUCTURE' },
    { id: 'roll' as const, label: 'ROLL CALENDAR' },
    { id: 'basis' as const, label: 'BASIS' },
    { id: 'spread' as const, label: 'SPREAD MATRIX' },
    { id: 'seasonal' as const, label: 'SEASONALITY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>COMMDS</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>FUTURES CURVE ANALYTICS</span>
          {front && <span style={{ fontSize: 11, color: TEXT }}>{root} {front.symbol} @ ${fmtNum(front.lastPrice)}</span>}
          <span style={{ fontSize: 10, color: isContango ? RED : GREEN, background: isContango ? '#1a0808' : '#0a1a18', border: `1px solid ${isContango ? RED : GREEN}44`, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>
            {isContango ? 'â–² CONTANGO' : 'â–¼ BACKWARDATION'}
          </span>
        </div>
        {/* root selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {ROOTS.map(r => (
            <button key={r.root} onClick={() => setRoot(r.root)}
              style={{ fontFamily: MONO, fontSize: 10, color: root === r.root ? r.color : SUBTLE,
                background: root === r.root ? r.color + '22' : 'transparent',
                border: `1px solid ${root === r.root ? r.color : BORDER}`, borderRadius: 3,
                padding: '3px 7px', cursor: 'pointer', transition: 'all 0.15s' }}>
              {r.root}
            </button>
          ))}
        </div>
      </div>

      {/* â”€â”€ STATS â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Front Price" value={front ? `$${fmtNum(front.lastPrice)}` : 'â€”'} col={AMBER} />
        <StatCard label="Curve Slope" value={fmtPct(curveSlope)} col={isContango ? RED : GREEN} sub={isContango ? 'Contango' : 'Backwardation'} />
        <StatCard label="Contracts" value={contracts.length} />
        <StatCard label="Total OI" value={`${(totalOI / 1000).toFixed(0)}K`} />
        <StatCard label="Total Volume" value={`${(totalVol / 1000).toFixed(0)}K`} />
        <StatCard label="Avg Carry" value={fmtPct(avgCarry)} col={avgCarry < 0 ? RED : GREEN} />
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading {root} futures curve...</div>}

        {/* â”€â”€ TERM STRUCTURE â”€â”€ */}
        {tab === 'term' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Forward Curve â€” {root} ({contracts.length} contracts)
              </div>
              <TermStructureSVG contracts={contracts} />
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Contract</Th><Th>Expiry</Th><Th right>DTE</Th>
                    <Th right>Last Price</Th><Th right>Settle</Th>
                    <Th right>Open Interest</Th><Th right>Volume</Th>
                    <Th right>Basis</Th><Th right>Roll Yield</Th><Th right>Annual Carry</Th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : `No contracts found for ${root} â€” check /api/v4/futures-curve/term-structure/${root}`}
                    </td></tr>
                  )}
                  {contracts.map(c => {
                    const priceChange = back && c !== contracts[0] ? ((c.lastPrice - contracts[0].lastPrice) / contracts[0].lastPrice) * 100 : 0
                    return (
                      <tr key={c.symbol} onClick={() => setSelectedContract(selectedContract === c.symbol ? null : c.symbol)}
                        style={{ cursor: 'pointer', background: selectedContract === c.symbol ? '#141414' : c.isFront ? '#0d0d0d' : 'transparent', borderLeft: c.isFront ? `3px solid ${AMBER}` : `3px solid transparent` }}>
                        <Td mono col={c.isFront ? AMBER : TEXT}>{c.symbol}{c.isFront && ' â–¶'}</Td>
                        <Td mono col={SUBTLE}>{c.expiry}</Td>
                        <Td right mono col={c.daysToExpiry < 30 ? RED : c.daysToExpiry < 90 ? AMBER : SUBTLE}>{c.daysToExpiry}</Td>
                        <Td right mono>{`$${fmtNum(c.lastPrice)}`}</Td>
                        <Td right mono col={SUBTLE}>{`$${fmtNum(c.settle)}`}</Td>
                        <Td right mono>{(c.openInterest / 1000).toFixed(1)}K</Td>
                        <Td right mono col={SUBTLE}>{(c.volume / 1000).toFixed(1)}K</Td>
                        <Td right mono col={c.basis > 0 ? GREEN : RED}>{fmtNum(c.basis)}</Td>
                        <Td right mono col={c.rollYield > 0 ? GREEN : RED}>{fmtPct(c.rollYield)}</Td>
                        <Td right mono col={c.annualCarry > 0 ? GREEN : RED}>{fmtPct(c.annualCarry)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* detail panel */}
            {selectedContract && (() => {
              const c = contracts.find(x => x.symbol === selectedContract)
              if (!c) return null
              return (
                <div style={{ marginTop: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: AMBER, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>{c.symbol} Detail</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {[
                      ['Symbol', c.symbol, AMBER], ['Expiry', c.expiry, SUBTLE],
                      ['DTE', String(c.daysToExpiry), c.daysToExpiry < 30 ? RED : TEXT],
                      ['Last Price', `$${fmtNum(c.lastPrice)}`, TEXT],
                      ['Settle', `$${fmtNum(c.settle)}`, SUBTLE],
                      ['Open Interest', c.openInterest.toLocaleString(), TEXT],
                      ['Volume', c.volume.toLocaleString(), TEXT],
                      ['Basis', fmtNum(c.basis), c.basis > 0 ? GREEN : RED],
                      ['Roll Yield', fmtPct(c.rollYield), c.rollYield > 0 ? GREEN : RED],
                      ['Annual Carry', fmtPct(c.annualCarry), c.annualCarry > 0 ? GREEN : RED],
                    ].map(([l, v, col]) => (
                      <div key={l as string} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}>
                        <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>{l as string}</div>
                        <div style={{ fontSize: 12, color: col as string, fontFamily: MONO, marginTop: 2 }}>{v as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* â”€â”€ ROLL CALENDAR â”€â”€ */}
        {tab === 'roll' && (
          <>
            {/* upcoming rolls */}
            {rollDates.filter(r => r.daysToRoll <= 30).length > 0 && (
              <div style={{ background: '#0d1a0d', border: `1px solid ${AMBER}44`, borderRadius: 4, padding: '8px 14px', marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: AMBER, fontFamily: MONO }}>âš  UPCOMING ROLLS (â‰¤30 days): </span>
                {rollDates.filter(r => r.daysToRoll <= 30).map(r => (
                  <span key={r.fromContract} style={{ fontSize: 10, color: TEXT, marginLeft: 12 }}>{r.fromContract}â†’{r.toContract} in {r.daysToRoll}d (cost {r.rollCostBps.toFixed(1)} bps)</span>
                ))}
              </div>
            )}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>From</Th><Th>To</Th><Th>Roll Date</Th>
                    <Th right>Days to Roll</Th><Th right>Roll Cost</Th>
                    <Th right>Roll Cost (bps)</Th><Th right>Open Interest</Th>
                  </tr>
                </thead>
                <tbody>
                  {rollDates.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No roll calendar data â€” check /api/v4/futures-curve/roll-calendar/{root}
                    </td></tr>
                  )}
                  {rollDates.map(r => (
                    <tr key={r.fromContract} style={{ borderLeft: r.daysToRoll <= 10 ? `3px solid ${RED}` : r.daysToRoll <= 30 ? `3px solid ${AMBER}` : `3px solid transparent` }}>
                      <Td mono col={AMBER}>{r.fromContract}</Td>
                      <Td mono col={BLUE}>{r.toContract}</Td>
                      <Td mono col={SUBTLE}>{r.rollDate}</Td>
                      <Td right mono col={r.daysToRoll <= 10 ? RED : r.daysToRoll <= 30 ? AMBER : TEXT}>{r.daysToRoll} days</Td>
                      <Td right mono col={r.rollCost < 0 ? RED : GREEN}>{fmtNum(r.rollCost)}</Td>
                      <Td right mono col={Math.abs(r.rollCostBps) > 5 ? RED : GREEN}>{r.rollCostBps.toFixed(1)} bps</Td>
                      <Td right mono>{(r.openInterest / 1000).toFixed(1)}K</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ BASIS â”€â”€ */}
        {tab === 'basis' && (
          <>
            {/* basis chart */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Basis % (Futures âˆ’ Spot) / Spot</div>
              <BasisSVG points={basisPoints} />
            </div>

            {/* basis stats */}
            {basisPoints.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  ['Current Basis', basisPoints[basisPoints.length - 1]?.basisPct, undefined],
                  ['Avg Basis', basisPoints.reduce((s, p) => s + p.basisPct, 0) / basisPoints.length, undefined],
                  ['Min Basis', Math.min(...basisPoints.map(p => p.basisPct)), RED],
                  ['Max Basis', Math.max(...basisPoints.map(p => p.basisPct)), GREEN],
                ].map(([l, v, c]) => (
                  <StatCard key={l as string} label={l as string} value={fmtPct(v as number)} col={c as string | undefined || ((v as number) > 0 ? GREEN : RED)} />
                ))}
              </div>
            )}

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Date</Th><Th right>Spot</Th><Th right>Futures</Th>
                    <Th right>Basis</Th><Th right>Basis %</Th>
                    <Th right>Implied Rate</Th><Th right>Storage Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {basisPoints.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No basis data â€” check /api/v4/futures-curve/basis/{root}
                    </td></tr>
                  )}
                  {[...basisPoints].reverse().slice(0, 60).map(p => (
                    <tr key={p.date}>
                      <Td mono col={SUBTLE}>{p.date}</Td>
                      <Td right mono>{`$${fmtNum(p.spotPrice)}`}</Td>
                      <Td right mono>{`$${fmtNum(p.futuresPrice)}`}</Td>
                      <Td right mono col={p.basis > 0 ? GREEN : RED}>{fmtNum(p.basis)}</Td>
                      <Td right mono col={p.basisPct > 0 ? GREEN : RED}>{fmtPct(p.basisPct)}</Td>
                      <Td right mono col={SUBTLE}>{fmtPct(p.impliedRate)}</Td>
                      <Td right mono col={SUBTLE}>{fmtPct(p.storageCost)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ SPREAD MATRIX â”€â”€ */}
        {tab === 'spread' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Calendar Spread Matrix (Z-Score Heatmap)
              </div>
              <SpreadHeatmap spreads={spreads} contracts={contracts} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Near Leg</Th><Th>Far Leg</Th>
                    <Th right>Spread</Th><Th right>Change</Th><Th right>Avg Spread</Th>
                    <Th right>Z-Score</Th><Th>Signal</Th>
                  </tr>
                </thead>
                <tbody>
                  {spreads.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No spread data â€” check /api/v4/futures-curve/spread/{root}
                    </td></tr>
                  )}
                  {spreads.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).map((s, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{s.leg1}</Td>
                      <Td mono col={BLUE}>{s.leg2}</Td>
                      <Td right mono>{fmtNum(s.spread)}</Td>
                      <Td right mono col={s.spreadChange > 0 ? GREEN : RED}>{s.spreadChange > 0 ? '+' : ''}{fmtNum(s.spreadChange)}</Td>
                      <Td right mono col={SUBTLE}>{fmtNum(s.avgSpread)}</Td>
                      <Td right mono col={Math.abs(s.zScore) > 2 ? RED : Math.abs(s.zScore) > 1 ? AMBER : GREEN}>{s.zScore.toFixed(2)}</Td>
                      <Td>
                        <span style={{ fontSize: 9, fontFamily: MONO, textTransform: 'uppercase',
                          color: s.zScore > 2 ? RED : s.zScore < -2 ? GREEN : SUBTLE,
                          background: s.zScore > 2 ? '#1a0808' : s.zScore < -2 ? '#0a1a18' : 'transparent',
                          border: `1px solid ${s.zScore > 2 ? RED : s.zScore < -2 ? GREEN : BORDER}33`,
                          borderRadius: 2, padding: '2px 5px' }}>
                          {Math.abs(s.zScore) > 2 ? (s.zScore > 0 ? 'OVERBOUGHT' : 'OVERSOLD') : Math.abs(s.zScore) > 1 ? 'WATCH' : 'NEUTRAL'}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ SEASONALITY â”€â”€ */}
        {tab === 'seasonal' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Seasonal Return Pattern â€” {root} (Average Monthly Return)
              </div>
              {/* month bars â€” requires historical data from backend */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100 }}>
                {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].map((m, i) => {
                  const mockReturn = [1.2, -0.5, 2.1, 1.8, 0.3, -1.1, 0.8, -0.2, -1.5, 1.9, 2.3, 1.5][i]
                  const h = Math.round(Math.abs(mockReturn) * 20)
                  const col = mockReturn > 0 ? GREEN : RED
                  return (
                    <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 8, color: col, fontFamily: MONO }}>{mockReturn > 0 ? '+' : ''}{mockReturn.toFixed(1)}%</div>
                      <div style={{ width: '100%', height: h, background: col + '66', border: `1px solid ${col}33`, borderRadius: '2px 2px 0 0' }} />
                      <div style={{ fontSize: 7, color: SUBTLE, fontFamily: MONO }}>{m}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: SUBTLE, marginTop: 10, fontStyle: 'italic' }}>
                * Seasonal pattern data from /api/v4/futures-curve/seasonality/{root} â€” placeholder shown
              </div>
            </div>

            <div style={{ background: '#0a1220', border: `1px solid ${BLUE}33`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Seasonality Methodology</div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>
                Seasonal returns calculated from 20-year rolling average of monthly price changes.
                {' '}<strong style={{ color: TEXT }}>Contango months</strong> (positive roll cost) suppress returns vs spot.
                {' '}<strong style={{ color: TEXT }}>Backwardation months</strong> boost returns. Use in conjunction with COT data for signal confirmation.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
