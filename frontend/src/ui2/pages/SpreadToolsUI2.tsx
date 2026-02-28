import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// SpreadToolsUI2 — Bloomberg SPRD-grade options spread tools terminal
// Tabs: SPREAD BUILDER | STRATEGY SCANNER | RISK GRAPH | P&L TABLE | LEG OPTIMIZER
// APIs: /api/v4/spread-tools/strategies, /api/v4/spread-tools/scan,
//       /api/v4/spread-tools/pnl, /api/v4/spread-tools/legs

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

type OptionType = 'call' | 'put'
type SpreadType = 'bull_call' | 'bear_put' | 'bull_put' | 'bear_call' | 'iron_condor' | 'iron_butterfly' | 'calendar' | 'diagonal' | 'straddle' | 'strangle'

interface SpreadLeg {
  action: 'buy' | 'sell'
  optionType: OptionType
  expiry: string
  strike: number
  price: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  quantity: number
}

interface SpreadStrategy {
  id: string
  name: string
  type: SpreadType
  symbol: string
  legs: SpreadLeg[]
  maxProfit: number
  maxLoss: number
  breakeven: number[]
  netDebit: number
  netCredit: number
  probability: number
  expectedValue: number
  daysToExpiry: number
  pop: number // probability of profit
  netDelta: number
  netTheta: number
  netVega: number
  netGamma: number
  ivRank: number
  bidAskSpread: number
}

interface ScanResult {
  id: string
  symbol: string
  strategy: SpreadType
  score: number
  maxProfit: number
  maxLoss: number
  probability: number
  netCost: number
  daysToExpiry: number
  ivRank: number
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
  reason: string
}

interface PnlPoint {
  price: number
  pnl: number
}

// ── sub-components ─────────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col, small }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string; small?: boolean }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: small ? 9 : mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
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

function SignalBadge({ signal }: { signal: ScanResult['signal'] }) {
  const map: Record<string, [string, string]> = {
    strong_buy: [GREEN, 'STR BUY'], buy: [GREEN, 'BUY'],
    neutral: [SUBTLE, 'NEUTRAL'], sell: [RED, 'SELL'], strong_sell: [RED, 'STR SELL'],
  }
  const [c, l] = map[signal] ?? [SUBTLE, signal.toUpperCase()]
  return <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44` }}>{l}</span>
}

function SpreadTypeBadge({ type }: { type: SpreadType }) {
  const colMap: Record<string, string> = {
    bull_call: GREEN, bear_put: GREEN, bull_put: AMBER, bear_call: AMBER,
    iron_condor: BLUE, iron_butterfly: PURPLE, calendar: ORANGE,
    diagonal: ORANGE, straddle: RED, strangle: RED,
  }
  const c = colMap[type] || SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44` }}>{type.replace(/_/g, ' ').toUpperCase()}</span>
}

function PnlChart({ points, width = 400, height = 140 }: { points: PnlPoint[]; width?: number; height?: number }) {
  if (points.length < 2) return <div style={{ height, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: SUBTLE, fontSize: 11 }}>No P&L data</span></div>
  const prices = points.map(p => p.price)
  const pnls = points.map(p => p.pnl)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minPnl = Math.min(...pnls), maxPnl = Math.max(...pnls)
  const pnlRange = maxPnl - minPnl || 1
  const toX = (p: number) => ((p - minP) / (maxP - minP)) * (width - 40) + 20
  const toY = (v: number) => height - 20 - ((v - minPnl) / pnlRange) * (height - 40)
  const zeroY = toY(0)

  let profitPath = '', losePath = ''
  points.forEach((pt, i) => {
    const x = toX(pt.price), y = toY(pt.pnl)
    if (i === 0) { profitPath = `M ${x} ${y}`; losePath = `M ${x} ${y}` }
    else { profitPath += ` L ${x} ${y}`; losePath += ` L ${x} ${y}` }
  })

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'block' }}>
      {/* zero line */}
      <line x1="20" y1={zeroY} x2={width - 20} y2={zeroY} stroke={BORDER} strokeWidth="1.5" strokeDasharray="4,4" />
      <text x={width - 18} y={zeroY + 3} fontSize="8" fill={SUBTLE} fontFamily="monospace">0</text>
      {/* profit zone fill */}
      <clipPath id="profitClip"><rect x="0" y="0" width={width} height={zeroY} /></clipPath>
      <clipPath id="lossClip"><rect x="0" y={zeroY} width={width} height={height} /></clipPath>
      <path d={profitPath} fill="none" stroke={GREEN} strokeWidth="2" clipPath="url(#profitClip)" />
      <path d={losePath} fill="none" stroke={RED} strokeWidth="2" clipPath="url(#lossClip)" />
      {/* axis labels */}
      <text x={20} y={height - 4} fontSize="8" fill={SUBTLE} fontFamily="monospace">${minP.toFixed(0)}</text>
      <text x={width - 20} y={height - 4} fontSize="8" fill={SUBTLE} fontFamily="monospace" textAnchor="end">${maxP.toFixed(0)}</text>
      <text x="4" y="14" fontSize="8" fill={GREEN} fontFamily="monospace">{maxPnl > 0 ? `+${maxPnl.toFixed(0)}` : maxPnl.toFixed(0)}</text>
      <text x="4" y={height - 8} fontSize="8" fill={RED} fontFamily="monospace">{minPnl.toFixed(0)}</text>
    </svg>
  )
}


const SPREAD_TYPES: SpreadType[] = ['bull_call', 'bear_put', 'bull_put', 'bear_call', 'iron_condor', 'iron_butterfly', 'calendar', 'diagonal', 'straddle', 'strangle']

export function SpreadToolsUI2() {
  const [tab, setTab] = useState<'builder' | 'scanner' | 'riskgraph' | 'pnltable' | 'optimizer'>('builder')
  const [strategies, setStrategies] = useState<SpreadStrategy[]>([])
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [pnlPoints, setPnlPoints] = useState<PnlPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // builder state
  const [builderSymbol, setBuilderSymbol] = useState('SPY')
  const [builderType, setBuilderType] = useState<SpreadType>('bull_call')
  const [legs, setLegs] = useState<SpreadLeg[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<SpreadStrategy | null>(null)

  // scanner filters
  const [scanSymbol, setScanSymbol] = useState('')
  const [scanType, setScanType] = useState<string>('all')
  const [minPop, setMinPop] = useState(50)
  const [maxCost, setMaxCost] = useState(5)

  // optimizer state
  const [optSymbol, setOptSymbol] = useState('SPY')
  const [optResult, setOptResult] = useState<SpreadStrategy | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStrategies = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/spread-tools/strategies')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.strategies ?? d.data ?? []
      setStrategies(raw.map((s: any) => ({
        id: s.id ?? String(Math.random()),
        name: s.name ?? s.strategy_name ?? '',
        type: (s.type ?? s.spread_type ?? 'bull_call') as SpreadType,
        symbol: s.symbol ?? '',
        legs: (s.legs ?? []).map((l: any) => ({
          action: l.action ?? 'buy',
          optionType: (l.option_type ?? 'call') as OptionType,
          expiry: l.expiry ?? l.expiration ?? '',
          strike: Number(l.strike ?? 0),
          price: Number(l.price ?? l.premium ?? 0),
          iv: Number(l.iv ?? l.implied_vol ?? 0),
          delta: Number(l.delta ?? 0), gamma: Number(l.gamma ?? 0),
          theta: Number(l.theta ?? 0), vega: Number(l.vega ?? 0),
          quantity: Number(l.quantity ?? l.qty ?? 1),
        })),
        maxProfit: Number(s.max_profit ?? 0),
        maxLoss: Number(s.max_loss ?? 0),
        breakeven: Array.isArray(s.breakeven) ? s.breakeven.map(Number) : [Number(s.breakeven ?? 0)],
        netDebit: Number(s.net_debit ?? 0),
        netCredit: Number(s.net_credit ?? 0),
        probability: Number(s.probability ?? s.prob ?? 0),
        expectedValue: Number(s.expected_value ?? s.ev ?? 0),
        daysToExpiry: Number(s.days_to_expiry ?? s.dte ?? 0),
        pop: Number(s.pop ?? s.probability_of_profit ?? 0),
        netDelta: Number(s.net_delta ?? 0), netTheta: Number(s.net_theta ?? 0),
        netVega: Number(s.net_vega ?? 0), netGamma: Number(s.net_gamma ?? 0),
        ivRank: Number(s.iv_rank ?? 0),
        bidAskSpread: Number(s.bid_ask_spread ?? 0),
      })))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [])

  const fetchScan = useCallback(async () => {
    try {
      const params = new URLSearchParams({ min_pop: String(minPop), max_cost: String(maxCost) })
      if (scanSymbol) params.set('symbol', scanSymbol)
      if (scanType !== 'all') params.set('type', scanType)
      const r = await fetch(`/api/v4/spread-tools/scan?${params}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.results ?? d.data ?? []
      setScanResults(raw.map((s: any) => ({
        id: s.id ?? String(Math.random()),
        symbol: s.symbol ?? '',
        strategy: (s.strategy ?? s.spread_type ?? 'bull_call') as SpreadType,
        score: Number(s.score ?? 0),
        maxProfit: Number(s.max_profit ?? 0),
        maxLoss: Number(s.max_loss ?? 0),
        probability: Number(s.probability ?? 0),
        netCost: Number(s.net_cost ?? 0),
        daysToExpiry: Number(s.days_to_expiry ?? s.dte ?? 0),
        ivRank: Number(s.iv_rank ?? 0),
        signal: (s.signal ?? 'neutral') as ScanResult['signal'],
        reason: s.reason ?? '',
      })))
    } catch { /* empty */ }
  }, [scanSymbol, scanType, minPop, maxCost])

  const fetchPnl = useCallback(async (stratId?: string) => {
    try {
      const url = stratId ? `/api/v4/spread-tools/pnl?strategy_id=${stratId}` : '/api/v4/spread-tools/pnl'
      const r = await fetch(url)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.points ?? d.data ?? []
      setPnlPoints(raw.map((p: any) => ({ price: Number(p.price ?? p.x ?? 0), pnl: Number(p.pnl ?? p.y ?? 0) })))
    } catch { /* empty */ }
  }, [])

  const buildSpread = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/spread-tools/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: builderSymbol, type: builderType }),
      })
      if (!r.ok) return
      const d = await r.json()
      setLegs((d.legs ?? []).map((l: any) => ({
        action: l.action ?? 'buy',
        optionType: (l.option_type ?? 'call') as OptionType,
        expiry: l.expiry ?? '',
        strike: Number(l.strike ?? 0),
        price: Number(l.price ?? 0),
        iv: Number(l.iv ?? 0),
        delta: Number(l.delta ?? 0), gamma: Number(l.gamma ?? 0),
        theta: Number(l.theta ?? 0), vega: Number(l.vega ?? 0),
        quantity: Number(l.quantity ?? 1),
      })))
    } catch { /* empty */ }
  }, [builderSymbol, builderType])

  const optimizeLegs = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/spread-tools/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: optSymbol }),
      })
      if (!r.ok) return
      const d = await r.json()
      setOptResult(d.strategy ?? null)
    } catch { /* empty */ }
  }, [optSymbol])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStrategies(), fetchScan()]).finally(() => setLoading(false))
    pollRef.current = setInterval(fetchStrategies, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStrategies, fetchScan])

  const totalMaxProfit = strategies.reduce((s, x) => s + x.maxProfit, 0)
  const totalMaxLoss = strategies.reduce((s, x) => s + x.maxLoss, 0)
  const avgPop = strategies.length > 0 ? strategies.reduce((s, x) => s + x.pop, 0) / strategies.length : 0

  const tabs = [
    { id: 'builder' as const, label: 'SPREAD BUILDER' },
    { id: 'scanner' as const, label: 'STRATEGY SCANNER' },
    { id: 'riskgraph' as const, label: 'RISK GRAPH' },
    { id: 'pnltable' as const, label: 'P&L TABLE' },
    { id: 'optimizer' as const, label: 'LEG OPTIMIZER' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>SPRD</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SPREAD TOOLS — OPTIONS STRATEGY TERMINAL</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>{strategies.length} strategies loaded</span>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Strategies" value={strategies.length} />
        <StatCard label="Total Max Profit" value={`$${totalMaxProfit.toFixed(0)}`} col={GREEN} />
        <StatCard label="Total Max Loss" value={`-$${Math.abs(totalMaxLoss).toFixed(0)}`} col={RED} />
        <StatCard label="Avg POP" value={`${avgPop.toFixed(1)}%`} col={avgPop > 60 ? GREEN : avgPop > 40 ? AMBER : RED} />
        <StatCard label="Scan Results" value={scanResults.length} />
        <StatCard label="Legs Loaded" value={legs.length} sub={builderSymbol} />
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading spread data...</div>}

        {/* ── BUILDER ── */}
        {tab === 'builder' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Build Spread Strategy</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>SYMBOL</div>
                  <input value={builderSymbol} onChange={e => setBuilderSymbol(e.target.value.toUpperCase())}
                    style={{ fontFamily: MONO, fontSize: 12, color: AMBER, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: 80, outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>STRATEGY TYPE</div>
                  <select value={builderType} onChange={e => setBuilderType(e.target.value as SpreadType)}
                    style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', outline: 'none' }}>
                    {SPREAD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <button onClick={buildSpread}
                  style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#000', background: AMBER, border: 'none', borderRadius: 3, padding: '5px 16px', cursor: 'pointer' }}>
                  BUILD SPREAD
                </button>
              </div>
              {/* spread type quick select */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SPREAD_TYPES.map(t => (
                  <button key={t} onClick={() => setBuilderType(t)}
                    style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      color: builderType === t ? '#000' : TEXT, background: builderType === t ? AMBER : 'transparent',
                      border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* strategy descriptions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { type: 'bull_call', desc: 'Buy lower strike call, sell higher. Bullish. Max loss = debit.', outlook: 'BULLISH', risk: 'Limited' },
                { type: 'bear_put', desc: 'Buy higher strike put, sell lower. Bearish. Max loss = debit.', outlook: 'BEARISH', risk: 'Limited' },
                { type: 'iron_condor', desc: 'Sell OTM call spread + OTM put spread. Neutral. Profit from theta.', outlook: 'NEUTRAL', risk: 'Limited' },
                { type: 'iron_butterfly', desc: 'Sell ATM straddle, buy OTM wings. Neutral. High premium.', outlook: 'NEUTRAL', risk: 'Limited' },
                { type: 'straddle', desc: 'Buy ATM call + put. Profit from large move either direction.', outlook: 'VOLATILE', risk: 'Premium risk' },
                { type: 'calendar', desc: 'Same strike, different expiries. Profit from IV term structure.', outlook: 'NEUTRAL', risk: 'Debit at risk' },
              ].map(s => (
                <div key={s.type} onClick={() => setBuilderType(s.type as SpreadType)}
                  style={{ background: builderType === s.type ? '#151515' : PANEL, border: `1px solid ${builderType === s.type ? AMBER + '44' : BORDER}`, borderRadius: 4, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, fontWeight: 700, marginBottom: 4 }}>{s.type.replace(/_/g, ' ').toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: TEXT, lineHeight: 1.5, marginBottom: 6 }}>{s.desc}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 9, color: s.outlook === 'BULLISH' ? GREEN : s.outlook === 'BEARISH' ? RED : AMBER }}>{s.outlook}</span>
                    <span style={{ fontSize: 9, color: SUBTLE }}>Risk: {s.risk}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* legs table */}
            {legs.length > 0 && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `1px solid ${BORDER}` }}>
                  {builderSymbol} — {builderType.replace(/_/g, ' ').toUpperCase()} Spread Legs
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Action</Th><Th>Type</Th><Th>Strike</Th><Th>Expiry</Th>
                      <Th right>Price</Th><Th right>IV</Th><Th right>Δ Delta</Th>
                      <Th right>Θ Theta</Th><Th right>V Vega</Th><Th right>Qty</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map((l, i) => (
                      <tr key={i}>
                        <Td mono col={l.action === 'buy' ? GREEN : RED}>{l.action.toUpperCase()}</Td>
                        <Td mono col={l.optionType === 'call' ? BLUE : PURPLE}>{l.optionType.toUpperCase()}</Td>
                        <Td mono col={AMBER}>${l.strike.toFixed(0)}</Td>
                        <Td mono col={SUBTLE}>{l.expiry}</Td>
                        <Td right mono>${l.price.toFixed(2)}</Td>
                        <Td right mono>{(l.iv * 100).toFixed(1)}%</Td>
                        <Td right mono col={l.delta > 0 ? GREEN : RED}>{l.delta.toFixed(3)}</Td>
                        <Td right mono col={RED}>{l.theta.toFixed(3)}</Td>
                        <Td right mono col={GREEN}>{l.vega.toFixed(3)}</Td>
                        <Td right mono>{l.quantity}</Td>
                      </tr>
                    ))}
                    {/* net row */}
                    <tr style={{ background: '#0d0d0d', fontWeight: 700 }}>
                      <td colSpan={4} style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, padding: '6px 10px', textTransform: 'uppercase' }}>NET SPREAD</td>
                      <Td right mono col={legs.reduce((s, l) => s + (l.action === 'buy' ? -l.price : l.price), 0) < 0 ? RED : GREEN}>
                        ${Math.abs(legs.reduce((s, l) => s + (l.action === 'buy' ? -l.price : l.price), 0)).toFixed(2)}
                        {legs.reduce((s, l) => s + (l.action === 'buy' ? -l.price : l.price), 0) < 0 ? ' DR' : ' CR'}
                      </Td>
                      <Td right mono></Td>
                      <Td right mono col={GREEN}>{legs.reduce((s, l) => s + l.delta * (l.action === 'buy' ? 1 : -1), 0).toFixed(3)}</Td>
                      <Td right mono col={RED}>{legs.reduce((s, l) => s + l.theta * (l.action === 'buy' ? 1 : -1), 0).toFixed(3)}</Td>
                      <Td right mono col={GREEN}>{legs.reduce((s, l) => s + l.vega * (l.action === 'buy' ? 1 : -1), 0).toFixed(3)}</Td>
                      <Td right mono></Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {legs.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>Select a strategy and click BUILD SPREAD to load legs from /api/v4/spread-tools/build</div>}
          </>
        )}

        {/* ── SCANNER ── */}
        {tab === 'scanner' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>SYMBOL (BLANK=ALL)</div>
                <input value={scanSymbol} onChange={e => setScanSymbol(e.target.value.toUpperCase())} placeholder="SPY"
                  style={{ fontFamily: MONO, fontSize: 11, color: AMBER, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 80, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>STRATEGY TYPE</div>
                <select value={scanType} onChange={e => setScanType(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
                  <option value="all">ALL TYPES</option>
                  {SPREAD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>MIN POP %</div>
                <input type="number" value={minPop} onChange={e => setMinPop(Number(e.target.value))} min={0} max={100}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 60, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>MAX COST $</div>
                <input type="number" value={maxCost} onChange={e => setMaxCost(Number(e.target.value))} min={0} max={50}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 60, outline: 'none' }} />
              </div>
              <button onClick={fetchScan}
                style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#000', background: AMBER, border: 'none', borderRadius: 3, padding: '4px 14px', cursor: 'pointer' }}>
                SCAN
              </button>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Strategy</Th><Th>Signal</Th>
                    <Th right>Score</Th><Th right>Max Profit</Th><Th right>Max Loss</Th>
                    <Th right>Probability</Th><Th right>Net Cost</Th><Th right>DTE</Th>
                    <Th right>IV Rank</Th><Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Scanning...' : 'No results — click SCAN or check /api/v4/spread-tools/scan'}
                    </td></tr>
                  )}
                  {scanResults.sort((a, b) => b.score - a.score).map(s => (
                    <tr key={s.id}>
                      <Td mono col={AMBER}>{s.symbol}</Td>
                      <Td><SpreadTypeBadge type={s.strategy} /></Td>
                      <Td><SignalBadge signal={s.signal} /></Td>
                      <Td right mono col={s.score > 7 ? GREEN : s.score > 4 ? AMBER : RED}>{s.score.toFixed(1)}</Td>
                      <Td right mono col={GREEN}>${s.maxProfit.toFixed(0)}</Td>
                      <Td right mono col={RED}>-${Math.abs(s.maxLoss).toFixed(0)}</Td>
                      <Td right mono col={s.probability > 60 ? GREEN : s.probability > 40 ? AMBER : RED}>{s.probability.toFixed(1)}%</Td>
                      <Td right mono>{s.netCost > 0 ? `$${s.netCost.toFixed(2)}` : `-$${Math.abs(s.netCost).toFixed(2)}`}</Td>
                      <Td right mono col={s.daysToExpiry < 7 ? RED : SUBTLE}>{s.daysToExpiry}d</Td>
                      <Td right mono col={s.ivRank > 50 ? GREEN : SUBTLE}>{s.ivRank.toFixed(0)}</Td>
                      <Td small col={SUBTLE}>{s.reason}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── RISK GRAPH ── */}
        {tab === 'riskgraph' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <select value={selectedStrategy?.id ?? ''} onChange={e => {
                const s = strategies.find(x => x.id === e.target.value)
                setSelectedStrategy(s ?? null)
                if (s) fetchPnl(s.id)
              }}
                style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none', flex: 1, maxWidth: 360 }}>
                <option value="">-- Select Strategy --</option>
                {strategies.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.type.replace(/_/g, ' ').toUpperCase()} ({s.daysToExpiry}d)</option>)}
              </select>
              <button onClick={() => fetchPnl(selectedStrategy?.id)} style={{ fontFamily: MONO, fontSize: 11, color: '#000', background: AMBER, border: 'none', borderRadius: 3, padding: '4px 12px', cursor: 'pointer' }}>LOAD P&L CURVE</button>
            </div>

            {selectedStrategy && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>P&L at Expiration — {selectedStrategy.symbol}</div>
                  <PnlChart points={pnlPoints} />
                  {selectedStrategy.breakeven.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {selectedStrategy.breakeven.map((b, i) => (
                        <span key={i} style={{ fontSize: 10, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '2px 8px' }}>BE: ${b.toFixed(2)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Max Profit', `$${selectedStrategy.maxProfit.toFixed(0)}`, GREEN],
                    ['Max Loss', `-$${Math.abs(selectedStrategy.maxLoss).toFixed(0)}`, RED],
                    ['Net Debit/Credit', selectedStrategy.netDebit > 0 ? `-$${selectedStrategy.netDebit.toFixed(2)} DR` : `+$${selectedStrategy.netCredit.toFixed(2)} CR`, selectedStrategy.netDebit > 0 ? RED : GREEN],
                    ['Probability of Profit', `${selectedStrategy.pop.toFixed(1)}%`, selectedStrategy.pop > 60 ? GREEN : AMBER],
                    ['Expected Value', `$${selectedStrategy.expectedValue.toFixed(2)}`, selectedStrategy.expectedValue > 0 ? GREEN : RED],
                    ['Days to Expiry', `${selectedStrategy.daysToExpiry}d`, selectedStrategy.daysToExpiry < 7 ? RED : SUBTLE],
                    ['Net Delta', selectedStrategy.netDelta.toFixed(3), selectedStrategy.netDelta > 0 ? GREEN : RED],
                    ['Net Theta', selectedStrategy.netTheta.toFixed(3), RED],
                    ['Net Vega', selectedStrategy.netVega.toFixed(3), GREEN],
                    ['IV Rank', `${selectedStrategy.ivRank.toFixed(0)}`, selectedStrategy.ivRank > 50 ? GREEN : SUBTLE],
                  ].map(([l, v, c]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 11, color: SUBTLE }}>{l as string}</span>
                      <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: c as string }}>{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!selectedStrategy && <div style={{ color: SUBTLE, fontSize: 11 }}>Select a strategy above to view P&L graph</div>}
          </>
        )}

        {/* ── P&L TABLE ── */}
        {tab === 'pnltable' && (
          <>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 12 }}>P&L by expiry price — all loaded strategies</div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Strategy</Th><Th right>Max Profit</Th><Th right>Max Loss</Th>
                    <Th right>R/R Ratio</Th><Th right>POP %</Th><Th right>EV</Th>
                    <Th right>Θ/day</Th><Th right>Bid/Ask</Th><Th right>DTE</Th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No strategies — check /api/v4/spread-tools/strategies</td></tr>
                  )}
                  {strategies.map(s => {
                    const rr = s.maxLoss !== 0 ? (s.maxProfit / Math.abs(s.maxLoss)).toFixed(2) : '∞'
                    return (
                      <tr key={s.id} onClick={() => setSelectedStrategy(s)} style={{ cursor: 'pointer', background: selectedStrategy?.id === s.id ? '#141414' : 'transparent' }}>
                        <Td mono col={AMBER}>{s.symbol}</Td>
                        <Td><SpreadTypeBadge type={s.type} /></Td>
                        <Td right mono col={GREEN}>${s.maxProfit.toFixed(0)}</Td>
                        <Td right mono col={RED}>-${Math.abs(s.maxLoss).toFixed(0)}</Td>
                        <Td right mono col={parseFloat(rr) > 1 ? GREEN : RED}>{rr}</Td>
                        <Td right mono col={s.pop > 60 ? GREEN : s.pop > 40 ? AMBER : RED}>{s.pop.toFixed(1)}%</Td>
                        <Td right mono col={s.expectedValue > 0 ? GREEN : RED}>${s.expectedValue.toFixed(2)}</Td>
                        <Td right mono col={RED}>{s.netTheta.toFixed(2)}</Td>
                        <Td right mono col={s.bidAskSpread > 0.1 ? RED : SUBTLE}>{s.bidAskSpread.toFixed(3)}</Td>
                        <Td right mono col={s.daysToExpiry < 7 ? RED : SUBTLE}>{s.daysToExpiry}d</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── OPTIMIZER ── */}
        {tab === 'optimizer' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Optimal Spread Leg Finder</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>SYMBOL</div>
                  <input value={optSymbol} onChange={e => setOptSymbol(e.target.value.toUpperCase())}
                    style={{ fontFamily: MONO, fontSize: 12, color: AMBER, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: 80, outline: 'none' }} />
                </div>
                <button onClick={optimizeLegs}
                  style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#000', background: AMBER, border: 'none', borderRadius: 3, padding: '5px 16px', cursor: 'pointer' }}>
                  OPTIMIZE LEGS
                </button>
              </div>
              <div style={{ fontSize: 10, color: SUBTLE, lineHeight: 1.6 }}>
                The leg optimizer analyzes the options chain for {optSymbol} and finds the optimal strike selection
                to maximize expected value per dollar risked given current IV rank, skew, and liquidity constraints.
                Results are ranked by edge / capital efficiency ratio.
              </div>
            </div>

            {optResult ? (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>{optResult.symbol} — Optimal Strategy</span>
                  <SpreadTypeBadge type={optResult.type} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    ['Max Profit', `$${optResult.maxProfit.toFixed(0)}`, GREEN],
                    ['Max Loss', `-$${Math.abs(optResult.maxLoss).toFixed(0)}`, RED],
                    ['POP', `${optResult.pop.toFixed(1)}%`, GREEN],
                    ['EV', `$${optResult.expectedValue.toFixed(2)}`, GREEN],
                  ].map(([l, v, c]) => (
                    <StatCard key={l as string} label={l as string} value={v as string} col={c as string} />
                  ))}
                </div>
                {optResult.legs.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr><Th>Action</Th><Th>Type</Th><Th>Strike</Th><Th>Expiry</Th><Th right>Price</Th><Th right>IV</Th><Th right>Δ</Th><Th right>Θ</Th></tr>
                    </thead>
                    <tbody>
                      {optResult.legs.map((l, i) => (
                        <tr key={i}>
                          <Td mono col={l.action === 'buy' ? GREEN : RED}>{l.action.toUpperCase()}</Td>
                          <Td mono col={l.optionType === 'call' ? BLUE : PURPLE}>{l.optionType.toUpperCase()}</Td>
                          <Td mono col={AMBER}>${l.strike.toFixed(0)}</Td>
                          <Td mono col={SUBTLE}>{l.expiry}</Td>
                          <Td right mono>${l.price.toFixed(2)}</Td>
                          <Td right mono>{(l.iv * 100).toFixed(1)}%</Td>
                          <Td right mono col={l.delta > 0 ? GREEN : RED}>{l.delta.toFixed(3)}</Td>
                          <Td right mono col={RED}>{l.theta.toFixed(3)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div style={{ color: SUBTLE, fontSize: 11 }}>Enter symbol and click OPTIMIZE LEGS to call /api/v4/spread-tools/optimize</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
