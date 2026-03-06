import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// PayoffLabUI2 — Bloomberg PLAB-grade options payoff diagram & strategy lab
// Payoff at expiry, Greeks profile, breakeven analysis, strategy comparison
// Tabs: PAYOFF BUILDER | DIAGRAM | GREEKS PROFILE | BREAKEVEN | COMPARE
// APIs: /api/v4/payoff-lab/strategies, /payoff, /greeks, /breakeven, /compare

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

type OptionRight = 'call' | 'put'
type LegAction = 'buy' | 'sell'

interface StrategyLeg {
  id: number
  action: LegAction
  right: OptionRight
  strike: number
  expiry: string
  qty: number
  premium: number
  iv: number
}

interface PayoffPoint {
  underlyingPrice: number
  payoff: number
  profitLoss: number
  intrinsicValue: number
}

interface GreekProfile {
  underlyingPrice: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

interface BreakevenResult {
  breakevenPoints: number[]
  maxProfit: number
  maxProfitAt: string
  maxLoss: number
  maxLossAt: string
  profitProbability: number
  expectedValue: number
  riskReward: number
  totalCost: number
}

interface ComparedStrategy {
  name: string
  legs: StrategyLeg[]
  maxProfit: number
  maxLoss: number
  riskReward: number
  profitProbability: number
  totalCost: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// SVG payoff curve renderer
function PayoffChart({ points, width = 640, height = 220 }: { points: PayoffPoint[]; width?: number; height?: number }) {
  if (!points.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11, background: PANEL, borderRadius: 4 }}>No payoff data</div>
  const pad = { t: 16, b: 30, l: 50, r: 16 }
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b
  const xs = points.map(p => p.underlyingPrice)
  const ys = points.map(p => p.profitLoss)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0)
  const rangeY = maxY - minY || 1
  const xScale = (x: number) => ((x - minX) / (maxX - minX || 1)) * W + pad.l
  const yScale = (y: number) => H - ((y - minY) / rangeY) * H + pad.t
  const zeroY = yScale(0)
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.underlyingPrice).toFixed(1)},${yScale(p.profitLoss).toFixed(1)}`).join(' ')
  // profit fill above zero
  const profitPts = points.filter(p => p.profitLoss >= 0)
  const lossPts = points.filter(p => p.profitLoss <= 0)
  const fillProfit = profitPts.length > 1 ? `M${xScale(profitPts[0].underlyingPrice)},${zeroY} ` + profitPts.map(p => `L${xScale(p.underlyingPrice).toFixed(1)},${yScale(p.profitLoss).toFixed(1)}`).join(' ') + ` L${xScale(profitPts[profitPts.length - 1].underlyingPrice)},${zeroY} Z` : ''
  const fillLoss = lossPts.length > 1 ? `M${xScale(lossPts[0].underlyingPrice)},${zeroY} ` + lossPts.map(p => `L${xScale(p.underlyingPrice).toFixed(1)},${yScale(p.profitLoss).toFixed(1)}`).join(' ') + ` L${xScale(lossPts[lossPts.length - 1].underlyingPrice)},${zeroY} Z` : ''
  // x / y axis ticks
  const xTicks = 5, yTicks = 4
  return (
    <svg width={width} height={height} style={{ display: 'block', fontFamily: MONO }}>
      {/* zero line */}
      <line x1={pad.l} y1={zeroY} x2={W + pad.l} y2={zeroY} stroke={BORDER} strokeWidth={1} />
      {/* fills */}
      {fillProfit && <path d={fillProfit} fill={GREEN + '33'} />}
      {fillLoss && <path d={fillLoss} fill={RED + '33'} />}
      {/* payoff line */}
      <path d={linePath} fill="none" stroke={AMBER} strokeWidth={2} />
      {/* axes */}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const v = minX + (maxX - minX) * (i / xTicks)
        const x = xScale(v)
        return <g key={i}><line x1={x} y1={H + pad.t} x2={x} y2={H + pad.t + 4} stroke={BORDER} /><text x={x} y={H + pad.t + 14} textAnchor="middle" fill={SUBTLE} fontSize={9}>{v.toFixed(0)}</text></g>
      })}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = minY + rangeY * (i / yTicks)
        const y = yScale(v)
        return <g key={i}><line x1={pad.l - 4} y1={y} x2={pad.l} y2={y} stroke={BORDER} /><text x={pad.l - 6} y={y + 4} textAnchor="end" fill={v >= 0 ? GREEN : RED} fontSize={9}>{v >= 0 ? '+' : ''}{v.toFixed(0)}</text></g>
      })}
    </svg>
  )
}

let nextId = 1
function makeDefaultLegs(): StrategyLeg[] {
  return [{ id: nextId++, action: 'buy', right: 'call', strike: 100, expiry: '2025-12-19', qty: 1, premium: 5.0, iv: 0.25 }]
}


export function PayoffLabUI2() {
  const [tab, setTab] = useState<'builder' | 'diagram' | 'greeks' | 'breakeven' | 'compare'>('builder')
  const [legs, setLegs] = useState<StrategyLeg[]>(makeDefaultLegs)
  const [payoffPoints, setPayoffPoints] = useState<PayoffPoint[]>([])
  const [greekProfile, setGreekProfile] = useState<GreekProfile[]>([])
  const [breakevenResult, setBreakevenResult] = useState<BreakevenResult | null>(null)
  const [comparedStrategies, setComparedStrategies] = useState<ComparedStrategy[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [underlying, setUnderlying] = useState('100')
  const [spotPrice, setSpotPrice] = useState(100)
  const calcRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calculatePayoff = useCallback(async () => {
    try {
      const body = { legs, spot_price: spotPrice, underlying }
      const [rPay, rGreeks, rBe, rComp] = await Promise.allSettled([
        fetch('/api/v4/payoff-lab/payoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : []),
        fetch('/api/v4/payoff-lab/greeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : []),
        fetch('/api/v4/payoff-lab/breakeven', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null),
        fetch('/api/v4/payoff-lab/compare').then(r => r.ok ? r.json() : []),
      ])
      if (rPay.status === 'fulfilled') {
        const raw = Array.isArray(rPay.value) ? rPay.value : rPay.value.points ?? rPay.value.data ?? []
        setPayoffPoints(raw.map((p: any) => ({
          underlyingPrice: Number(p.underlying_price ?? p.price ?? 0),
          payoff: Number(p.payoff ?? 0), profitLoss: Number(p.profit_loss ?? p.pnl ?? p.payoff ?? 0),
          intrinsicValue: Number(p.intrinsic_value ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to calculate payoff')
      if (rGreeks.status === 'fulfilled') {
        const raw = Array.isArray(rGreeks.value) ? rGreeks.value : rGreeks.value.profile ?? rGreeks.value.data ?? []
        setGreekProfile(raw.map((p: any) => ({
          underlyingPrice: Number(p.underlying_price ?? p.price ?? 0),
          delta: Number(p.delta ?? 0), gamma: Number(p.gamma ?? 0),
          theta: Number(p.theta ?? 0), vega: Number(p.vega ?? 0), rho: Number(p.rho ?? 0),
        })))
      }
      if (rBe.status === 'fulfilled' && rBe.value) {
        const v = rBe.value
        setBreakevenResult({
          breakevenPoints: Array.isArray(v.breakeven_points) ? v.breakeven_points.map(Number) : [],
          maxProfit: Number(v.max_profit ?? 0), maxProfitAt: v.max_profit_at ?? '',
          maxLoss: Number(v.max_loss ?? 0), maxLossAt: v.max_loss_at ?? '',
          profitProbability: Number(v.profit_probability ?? 0),
          expectedValue: Number(v.expected_value ?? 0), riskReward: Number(v.risk_reward ?? 0),
          totalCost: Number(v.total_cost ?? 0),
        })
      }
      if (rComp.status === 'fulfilled') {
        const raw = Array.isArray(rComp.value) ? rComp.value : rComp.value.strategies ?? rComp.value.data ?? []
        setComparedStrategies(raw.map((s: any) => ({
          name: s.name ?? '', legs: s.legs ?? [],
          maxProfit: Number(s.max_profit ?? 0), maxLoss: Number(s.max_loss ?? 0),
          riskReward: Number(s.risk_reward ?? 0), profitProbability: Number(s.profit_probability ?? 0),
          totalCost: Number(s.total_cost ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [legs, spotPrice, underlying])

  useEffect(() => {
    setLoading(true)
    calculatePayoff().finally(() => setLoading(false))
  }, [calculatePayoff])

  const addLeg = () => setLegs(ls => [...ls, { id: nextId++, action: 'buy', right: 'call', strike: spotPrice, expiry: '2025-12-19', qty: 1, premium: 3.0, iv: 0.25 }])
  const removeLeg = (id: number) => setLegs(ls => ls.filter(l => l.id !== id))
  const updateLeg = (id: number, field: keyof StrategyLeg, value: any) => setLegs(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))

  const totalCost = legs.reduce((s, l) => s + (l.action === 'buy' ? 1 : -1) * l.premium * l.qty * 100, 0)
  const netDelta = greekProfile.length ? greekProfile[Math.floor(greekProfile.length / 2)]?.delta ?? 0 : 0

  const TABS = [
    { id: 'builder' as const, label: 'PAYOFF BUILDER' },
    { id: 'diagram' as const, label: 'DIAGRAM' },
    { id: 'greeks' as const, label: 'GREEKS PROFILE' },
    { id: 'breakeven' as const, label: 'BREAKEVEN' },
    { id: 'compare' as const, label: 'COMPARE' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>PLAB</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PAYOFF LAB — STRATEGY BUILDER + PAYOFF DIAGRAMS + BREAKEVEN ANALYSIS</span>
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Legs" value={legs.length} />
        <StatCard label="Net Cost" value={`${totalCost >= 0 ? '+' : ''}$${totalCost.toFixed(0)}`} col={totalCost < 0 ? GREEN : RED} sub="debit/credit" />
        {breakevenResult ? <>
          <StatCard label="Max Profit" value={breakevenResult.maxProfit === Infinity ? 'âˆž' : `$${breakevenResult.maxProfit.toFixed(0)}`} col={GREEN} />
          <StatCard label="Max Loss" value={`$${Math.abs(breakevenResult.maxLoss).toFixed(0)}`} col={RED} />
          <StatCard label="P(Profit)" value={(breakevenResult.profitProbability * 100).toFixed(1) + '%'} col={breakevenResult.profitProbability > 0.5 ? GREEN : RED} />
        </> : <>
          <StatCard label="Max Profit" value="—" col={SUBTLE} />
          <StatCard label="Max Loss" value="—" col={SUBTLE} />
          <StatCard label="P(Profit)" value="—" col={SUBTLE} />
        </>}
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Calculating...</div>}

        {/* BUILDER */}
        {tab === 'builder' && (
          <div>
            {/* Spot input */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <label style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>UNDERLYING</label>
              <input value={underlying} onChange={e => setUnderlying(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '4px 8px', width: 80 }} />
              <label style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>SPOT</label>
              <input type="number" value={spotPrice} onChange={e => setSpotPrice(Number(e.target.value))}
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '4px 8px', width: 80 }} />
            </div>

            {/* Legs table */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Action</Th><Th>Right</Th><Th right>Strike</Th><Th>Expiry</Th><Th right>Qty</Th><Th right>Premium</Th><Th right>IV</Th><Th>Remove</Th></tr></thead>
                <tbody>
                  {legs.map(l => (
                    <tr key={l.id}>
                      <Td>
                        {(['buy', 'sell'] as const).map(a => (
                          <button key={a} onClick={() => updateLeg(l.id, 'action', a)}
                            style={{ fontFamily: MONO, fontSize: 9, color: l.action === a ? (a === 'buy' ? GREEN : RED) : SUBTLE, background: l.action === a ? (a === 'buy' ? GREEN : RED) + '22' : 'transparent', border: `1px solid ${l.action === a ? (a === 'buy' ? GREEN : RED) + '55' : BORDER}`, borderRadius: 2, padding: '2px 6px', cursor: 'pointer', marginRight: 3 }}>
                            {a.toUpperCase()}
                          </button>
                        ))}
                      </Td>
                      <Td>
                        {(['call', 'put'] as const).map(r => (
                          <button key={r} onClick={() => updateLeg(l.id, 'right', r)}
                            style={{ fontFamily: MONO, fontSize: 9, color: l.right === r ? (r === 'call' ? BLUE : ORANGE) : SUBTLE, background: l.right === r ? (r === 'call' ? BLUE : ORANGE) + '22' : 'transparent', border: `1px solid ${l.right === r ? (r === 'call' ? BLUE : ORANGE) + '55' : BORDER}`, borderRadius: 2, padding: '2px 6px', cursor: 'pointer', marginRight: 3 }}>
                            {r.toUpperCase()}
                          </button>
                        ))}
                      </Td>
                      <Td right><input type="number" value={l.strike} onChange={e => updateLeg(l.id, 'strike', Number(e.target.value))} style={{ fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', color: TEXT, width: 60, textAlign: 'right' }} /></Td>
                      <Td><input value={l.expiry} onChange={e => updateLeg(l.id, 'expiry', e.target.value)} style={{ fontFamily: MONO, fontSize: 10, background: 'transparent', border: 'none', color: SUBTLE, width: 90 }} /></Td>
                      <Td right><input type="number" value={l.qty} onChange={e => updateLeg(l.id, 'qty', Number(e.target.value))} style={{ fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', color: TEXT, width: 40, textAlign: 'right' }} /></Td>
                      <Td right><input type="number" step="0.01" value={l.premium} onChange={e => updateLeg(l.id, 'premium', Number(e.target.value))} style={{ fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', color: AMBER, width: 60, textAlign: 'right' }} /></Td>
                      <Td right><input type="number" step="0.01" value={(l.iv * 100).toFixed(1)} onChange={e => updateLeg(l.id, 'iv', Number(e.target.value) / 100)} style={{ fontFamily: MONO, fontSize: 11, background: 'transparent', border: 'none', color: PURPLE, width: 50, textAlign: 'right' }} />%</Td>
                      <Td><button onClick={() => removeLeg(l.id)} style={{ fontFamily: MONO, fontSize: 10, color: RED, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>âœ•</button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addLeg} style={{ fontFamily: MONO, fontSize: 11, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 3, padding: '6px 14px', cursor: 'pointer' }}>+ ADD LEG</button>
              <button onClick={() => { setLoading(true); calculatePayoff().finally(() => setLoading(false)); setTab('diagram') }}
                style={{ fontFamily: MONO, fontSize: 11, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '6px 16px', cursor: 'pointer', fontWeight: 700 }}>
                â–¶ CALCULATE & VIEW DIAGRAM
              </button>
            </div>
          </div>
        )}

        {/* DIAGRAM */}
        {tab === 'diagram' && (
          <div>
            <PayoffChart points={payoffPoints} width={740} height={260} />
            {payoffPoints.length > 0 && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginTop: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th right>Underlying</Th><Th right>Payoff</Th><Th right>P&L</Th><Th right>Intrinsic Value</Th></tr></thead>
                  <tbody>
                    {payoffPoints.filter((_, i) => i % Math.max(1, Math.floor(payoffPoints.length / 15)) === 0).map((p, i) => (
                      <tr key={i}>
                        <Td right mono col={BLUE}>{p.underlyingPrice.toFixed(2)}</Td>
                        <Td right mono>{p.payoff.toFixed(2)}</Td>
                        <Td right mono col={p.profitLoss >= 0 ? GREEN : RED}>{p.profitLoss >= 0 ? '+' : ''}{p.profitLoss.toFixed(2)}</Td>
                        <Td right mono col={SUBTLE}>{p.intrinsicValue.toFixed(2)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GREEKS PROFILE */}
        {tab === 'greeks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th right>Underlying</Th><Th right>Delta</Th><Th right>Gamma</Th><Th right>Theta</Th><Th right>Vega</Th><Th right>Rho</Th></tr></thead>
              <tbody>
                {greekProfile.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No greek data</td></tr>}
                {greekProfile.filter((_, i) => i % Math.max(1, Math.floor(greekProfile.length / 20)) === 0).map((g, i) => (
                  <tr key={i}>
                    <Td right mono col={BLUE}>{g.underlyingPrice.toFixed(2)}</Td>
                    <Td right mono col={g.delta < 0 ? RED : GREEN}>{g.delta.toFixed(4)}</Td>
                    <Td right mono col={PURPLE}>{g.gamma.toFixed(5)}</Td>
                    <Td right mono col={g.theta < 0 ? RED : TEXT}>{g.theta.toFixed(4)}</Td>
                    <Td right mono col={AMBER}>{g.vega.toFixed(4)}</Td>
                    <Td right mono col={SUBTLE}>{g.rho.toFixed(4)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BREAKEVEN */}
        {tab === 'breakeven' && (
          <>
            {!breakevenResult ? <div style={{ color: SUBTLE, fontSize: 11 }}>No breakeven data — build a strategy first</div> : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="Risk/Reward" value={breakevenResult.riskReward.toFixed(2) + 'x'} col={breakevenResult.riskReward > 1. ? GREEN : RED} />
                  <StatCard label="P(Profit)" value={(breakevenResult.profitProbability * 100).toFixed(1) + '%'} col={breakevenResult.profitProbability > 0.5 ? GREEN : RED} />
                  <StatCard label="Expected Value" value={`$${breakevenResult.expectedValue.toFixed(2)}`} col={breakevenResult.expectedValue > 0 ? GREEN : RED} />
                  <StatCard label="Total Cost" value={`$${breakevenResult.totalCost.toFixed(2)}`} col={breakevenResult.totalCost > 0 ? RED : GREEN} sub="net debit/credit" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>BREAKEVEN POINTS</div>
                    {breakevenResult.breakevenPoints.map((be, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 16, color: AMBER, fontWeight: 700, marginBottom: 4 }}>${be.toFixed(2)}</div>
                    ))}
                    {breakevenResult.breakevenPoints.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No breakeven points</div>}
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>PROFIT / LOSS EXTREMES</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN, marginBottom: 6 }}>Max Profit: ${breakevenResult.maxProfit === Infinity ? 'âˆž' : breakevenResult.maxProfit.toFixed(2)} {breakevenResult.maxProfitAt ? `@ ${breakevenResult.maxProfitAt}` : ''}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: RED }}>Max Loss: ${Math.abs(breakevenResult.maxLoss).toFixed(2)} {breakevenResult.maxLossAt ? `@ ${breakevenResult.maxLossAt}` : ''}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* COMPARE */}
        {tab === 'compare' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Strategy</Th><Th right>Max Profit</Th><Th right>Max Loss</Th><Th right>Risk/Reward</Th><Th right>P(Profit)</Th><Th right>Total Cost</Th></tr></thead>
              <tbody>
                {comparedStrategies.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No strategies to compare</td></tr>}
                {comparedStrategies.map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td right mono col={GREEN}>{s.maxProfit === Infinity ? 'âˆž' : `$${s.maxProfit.toFixed(0)}`}</Td>
                    <Td right mono col={RED}>${Math.abs(s.maxLoss).toFixed(0)}</Td>
                    <Td right mono col={s.riskReward > 1 ? GREEN : RED}>{s.riskReward.toFixed(2)}x</Td>
                    <Td right mono col={s.profitProbability > 0.5 ? GREEN : RED}>{(s.profitProbability * 100).toFixed(1)}%</Td>
                    <Td right mono col={s.totalCost < 0 ? GREEN : RED}>${s.totalCost.toFixed(2)}</Td>
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
