import React, { useState, useEffect, useCallback } from 'react'
﻿// HedgeEngineUI2 â€” Bloomberg HEDG-grade hedge recommendation engine
// Delta/Gamma/Vega hedge recommendations, cost metrics, live P&L attribution
// Tabs: EXPOSURES | RECOMMENDATIONS | ACTIVE HEDGES | EFFECTIVENESS | COST ANALYSIS
// APIs: /api/v4/hedge-engine/exposures, /recommendations, /active, /effectiveness, /cost

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

interface Exposure {
  symbol: string
  assetClass: string
  delta: number
  gamma: number
  vega: number
  theta: number
  notional: number
  deltaDollar: number
  gammaDollar: number
  vegaDollar: number
}

interface HedgeRecommendation {
  id: string
  portfolio: string
  symbol: string
  hedgeType: 'delta_neutral' | 'gamma_hedge' | 'vega_hedge' | 'portfolio_hedge' | 'tail_risk'
  instrument: string
  action: 'buy' | 'sell'
  qty: number
  cost: number
  effectiveness: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  rationale: string
  deltaImpact: number
  gammmaImpact: number
  vegaImpact: number
}

interface ActiveHedge {
  id: string
  symbol: string
  instrument: string
  action: 'buy' | 'sell'
  qty: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  effectiveness: number
  openedAt: string
  hedgeType: string
}

interface HedgeEffectiveness {
  portfolio: string
  hedgeRatio: number
  correlationWithPortfolio: number
  dailyVarReduction: number
  betaReduction: number
  r2: number
  windowDays: number
}

interface HedgeCostEntry {
  symbol: string
  instrument: string
  annualCostBps: number
  carryBps: number
  impliedVol: number
  realizedVol: number
  volPremiumBps: number
  totalCostBps: number
  costRating: 'cheap' | 'fair' | 'expensive'
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

function AssetClassBadge({ cls }: { cls: string }) {
  const m: Record<string, string> = { equity: BLUE, option: PURPLE, future: AMBER, etf: GREEN, bond: ORANGE, fx: RED }
  const c = m[cls.toLowerCase()] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', border: `1px solid ${c}44`, borderRadius: 3, padding: '2px 6px' }}>{cls.toUpperCase()}</span>
}

function PriorityBadge({ p }: { p: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', border: `1px solid ${c}44`, borderRadius: 3, padding: '2px 6px' }}>{p.toUpperCase()}</span>
}

function HedgeTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { delta_neutral: BLUE, gamma_hedge: PURPLE, vega_hedge: AMBER, portfolio_hedge: GREEN, tail_risk: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px', textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</span>
}

function EffBar({ v }: { v: number }) {
  const c = v > 0.7 ? GREEN : v > 0.4 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 5, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, v * 100)}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{(v * 100).toFixed(1)}%</span>
    </div>
  )
}

function CostRatingBadge({ r }: { r: string }) {
  const m: Record<string, string> = { cheap: GREEN, fair: AMBER, expensive: RED }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{r.toUpperCase()}</span>
}


export function HedgeEngineUI2() {
  const [tab, setTab] = useState<'exposures' | 'recommendations' | 'active' | 'effectiveness' | 'cost'>('exposures')
  const [exposures, setExposures] = useState<Exposure[]>([])
  const [recommendations, setRecommendations] = useState<HedgeRecommendation[]>([])
  const [activeHedges, setActiveHedges] = useState<ActiveHedge[]>([])
  const [effectiveness, setEffectiveness] = useState<HedgeEffectiveness[]>([])
  const [costData, setCostData] = useState<HedgeCostEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [hedgeTypeFilter, setHedgeTypeFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rE, rR, rA, rEff, rC] = await Promise.allSettled([
        fetch('/api/v4/hedge-engine/exposures').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hedge-engine/recommendations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hedge-engine/active').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hedge-engine/effectiveness').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hedge-engine/cost').then(r => r.ok ? r.json() : []),
      ])
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.exposures ?? rE.value.data ?? []
        setExposures(raw.map((e: any) => ({
          symbol: e.symbol ?? '', assetClass: e.asset_class ?? e.assetClass ?? 'equity',
          delta: Number(e.delta ?? 0), gamma: Number(e.gamma ?? 0), vega: Number(e.vega ?? 0), theta: Number(e.theta ?? 0),
          notional: Number(e.notional ?? 0), deltaDollar: Number(e.delta_dollar ?? e.deltaDollar ?? 0),
          gammaDollar: Number(e.gamma_dollar ?? e.gammaDollar ?? 0), vegaDollar: Number(e.vega_dollar ?? e.vegaDollar ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load exposures')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.recommendations ?? rR.value.data ?? []
        setRecommendations(raw.map((r: any) => ({
          id: r.id ?? Math.random().toString(), portfolio: r.portfolio ?? '', symbol: r.symbol ?? '',
          hedgeType: r.hedge_type ?? r.hedgeType ?? 'delta_neutral', instrument: r.instrument ?? '',
          action: r.action ?? 'buy', qty: Number(r.qty ?? 0), cost: Number(r.cost ?? 0),
          effectiveness: Number(r.effectiveness ?? 0), priority: r.priority ?? 'medium',
          rationale: r.rationale ?? '', deltaImpact: Number(r.delta_impact ?? r.deltaImpact ?? 0),
          gammmaImpact: Number(r.gamma_impact ?? r.gammaImpact ?? 0), vegaImpact: Number(r.vega_impact ?? r.vegaImpact ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.hedges ?? rA.value.data ?? []
        setActiveHedges(raw.map((h: any) => ({
          id: h.id ?? Math.random().toString(), symbol: h.symbol ?? '', instrument: h.instrument ?? '',
          action: h.action ?? 'buy', qty: Number(h.qty ?? 0), entryPrice: Number(h.entry_price ?? h.entryPrice ?? 0),
          currentPrice: Number(h.current_price ?? h.currentPrice ?? 0), unrealizedPnl: Number(h.unrealized_pnl ?? h.unrealizedPnl ?? 0),
          effectiveness: Number(h.effectiveness ?? 0), openedAt: h.opened_at ?? h.openedAt ?? '', hedgeType: h.hedge_type ?? h.hedgeType ?? '',
        })))
      }
      if (rEff.status === 'fulfilled') {
        const raw = Array.isArray(rEff.value) ? rEff.value : rEff.value.effectiveness ?? rEff.value.data ?? []
        setEffectiveness(raw.map((e: any) => ({
          portfolio: e.portfolio ?? '', hedgeRatio: Number(e.hedge_ratio ?? e.hedgeRatio ?? 0),
          correlationWithPortfolio: Number(e.correlation_with_portfolio ?? e.correlationWithPortfolio ?? 0),
          dailyVarReduction: Number(e.daily_var_reduction ?? e.dailyVarReduction ?? 0),
          betaReduction: Number(e.beta_reduction ?? e.betaReduction ?? 0),
          r2: Number(e.r2 ?? 0), windowDays: Number(e.window_days ?? e.windowDays ?? 30),
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.cost ?? rC.value.data ?? []
        setCostData(raw.map((c: any) => ({
          symbol: c.symbol ?? '', instrument: c.instrument ?? '', annualCostBps: Number(c.annual_cost_bps ?? c.annualCostBps ?? 0),
          carryBps: Number(c.carry_bps ?? c.carryBps ?? 0), impliedVol: Number(c.implied_vol ?? c.impliedVol ?? 0),
          realizedVol: Number(c.realized_vol ?? c.realizedVol ?? 0), volPremiumBps: Number(c.vol_premium_bps ?? c.volPremiumBps ?? 0),
          totalCostBps: Number(c.total_cost_bps ?? c.totalCostBps ?? 0), costRating: c.cost_rating ?? c.costRating ?? 'fair',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 5000); return () => clearInterval(id) }, [fetchAll])

  const filteredRec = recommendations.filter(r =>
    (priorityFilter === 'all' || r.priority === priorityFilter) &&
    (hedgeTypeFilter === 'all' || r.hedgeType === hedgeTypeFilter)
  )

  const totalDeltaDollar = exposures.reduce((s, e) => s + e.deltaDollar, 0)
  const totalGammaDollar = exposures.reduce((s, e) => s + e.gammaDollar, 0)
  const totalVegaDollar = exposures.reduce((s, e) => s + e.vegaDollar, 0)
  const criticalCount = recommendations.filter(r => r.priority === 'critical').length

  const TABS = [
    { id: 'exposures' as const, label: 'EXPOSURES' },
    { id: 'recommendations' as const, label: 'RECOMMENDATIONS' },
    { id: 'active' as const, label: 'ACTIVE HEDGES' },
    { id: 'effectiveness' as const, label: 'EFFECTIVENESS' },
    { id: 'cost' as const, label: 'COST ANALYSIS' },
  ]
  const fmtM = (n: number) => `${n >= 0 ? '+' : ''}$${(Math.abs(n) / 1e6).toFixed(1)}M`
  const fmtK = (n: number) => `${n >= 0 ? '+' : ''}$${(Math.abs(n) / 1e3).toFixed(1)}K`

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>HEDG</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>HEDGE ENGINE â€” DELTA/GAMMA/VEGA HEDGE RECOMMENDATIONS + COST OPTIMIZATION + EFFECTIVENESS</span>
        {criticalCount > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: RED, fontWeight: 700 }}>⚠  {criticalCount} CRITICAL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>Loading...</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Symbols" value={exposures.length} />
        <StatCard label="Î”Î” Delta $" value={fmtM(totalDeltaDollar)} col={Math.abs(totalDeltaDollar) > 1e6 ? RED : GREEN} sub="aggregate" />
        <StatCard label="Î“Î“ Gamma $" value={fmtK(totalGammaDollar)} col={PURPLE} />
        <StatCard label="VV Vega $" value={fmtK(totalVegaDollar)} col={AMBER} />
        <StatCard label="Active Hedges" value={activeHedges.length} col={BLUE} />
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

        {/* EXPOSURES */}
        {tab === 'exposures' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Asset Class</Th><Th right>Delta</Th><Th right>Gamma</Th><Th right>Vega</Th><Th right>Theta</Th><Th right>Î”$ Dollar</Th><Th right>Î“$ Dollar</Th><Th right>V$ Dollar</Th></tr></thead>
              <tbody>
                {exposures.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exposure data â€” check /api/v4/hedge-engine/exposures</td></tr>}
                {exposures.map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.symbol}</Td>
                    <Td><AssetClassBadge cls={e.assetClass} /></Td>
                    <Td right mono col={e.delta < 0 ? RED : GREEN}>{e.delta.toFixed(4)}</Td>
                    <Td right mono col={PURPLE}>{e.gamma.toFixed(5)}</Td>
                    <Td right mono col={AMBER}>{e.vega.toFixed(4)}</Td>
                    <Td right mono col={e.theta < 0 ? RED : TEXT}>{e.theta.toFixed(4)}</Td>
                    <Td right mono col={e.deltaDollar < 0 ? RED : GREEN}>{fmtM(e.deltaDollar)}</Td>
                    <Td right mono col={PURPLE}>{fmtK(e.gammaDollar)}</Td>
                    <Td right mono col={AMBER}>{fmtK(e.vegaDollar)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RECOMMENDATIONS */}
        {tab === 'recommendations' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'critical', 'high', 'medium', 'low'].map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)}
                  style={{ fontFamily: MONO, fontSize: 10, color: priorityFilter === p ? AMBER : SUBTLE, background: priorityFilter === p ? AMBER + '22' : 'transparent', border: `1px solid ${priorityFilter === p ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {p.toUpperCase()}
                </button>
              ))}
              <div style={{ width: 1, background: BORDER, margin: '0 4px' }} />
              {['all', 'delta_neutral', 'gamma_hedge', 'vega_hedge', 'portfolio_hedge', 'tail_risk'].map(ht => (
                <button key={ht} onClick={() => setHedgeTypeFilter(ht)}
                  style={{ fontFamily: MONO, fontSize: 10, color: hedgeTypeFilter === ht ? BLUE : SUBTLE, background: hedgeTypeFilter === ht ? BLUE + '22' : 'transparent', border: `1px solid ${hedgeTypeFilter === ht ? BLUE + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {ht === 'all' ? 'ALL TYPES' : ht.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Priority</Th><Th>Symbol</Th><Th>Type</Th><Th>Instrument</Th><Th>Action</Th><Th right>Qty</Th><Th right>Cost</Th><Th>Effectiveness</Th><Th>Rationale</Th></tr></thead>
                <tbody>
                  {filteredRec.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No recommendations match filter</td></tr>}
                  {filteredRec.sort((a, b) => { const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }; return (o[a.priority] ?? 99) - (o[b.priority] ?? 99) }).map((r, i) => (
                    <tr key={i} style={{ background: r.priority === 'critical' ? RED + '10' : 'transparent' }}>
                      <Td><PriorityBadge p={r.priority} /></Td>
                      <Td mono col={AMBER}>{r.symbol}</Td>
                      <Td><HedgeTypeBadge t={r.hedgeType} /></Td>
                      <Td mono col={TEXT}>{r.instrument}</Td>
                      <Td mono col={r.action === 'buy' ? GREEN : RED}>{r.action.toUpperCase()}</Td>
                      <Td right mono>{r.qty.toLocaleString()}</Td>
                      <Td right mono col={ORANGE}>${r.cost.toFixed(2)}</Td>
                      <Td><EffBar v={r.effectiveness} /></Td>
                      <Td><span style={{ fontSize: 10, color: SUBTLE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.rationale}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIVE HEDGES */}
        {tab === 'active' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Instrument</Th><Th>Action</Th><Th right>Qty</Th><Th right>Entry</Th><Th right>Current</Th><Th right>Unrealized P&L</Th><Th>Effectiveness</Th><Th>Type</Th><Th>Opened</Th></tr></thead>
              <tbody>
                {activeHedges.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No active hedges â€” check /api/v4/hedge-engine/active</td></tr>}
                {activeHedges.map((h, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{h.symbol}</Td>
                    <Td mono col={TEXT}>{h.instrument}</Td>
                    <Td mono col={h.action === 'buy' ? GREEN : RED}>{h.action.toUpperCase()}</Td>
                    <Td right mono>{h.qty.toLocaleString()}</Td>
                    <Td right mono>{h.entryPrice.toFixed(2)}</Td>
                    <Td right mono>{h.currentPrice.toFixed(2)}</Td>
                    <Td right mono col={h.unrealizedPnl >= 0 ? GREEN : RED}>{h.unrealizedPnl >= 0 ? '+' : ''}${h.unrealizedPnl.toFixed(2)}</Td>
                    <Td><EffBar v={h.effectiveness} /></Td>
                    <Td><HedgeTypeBadge t={h.hedgeType} /></Td>
                    <Td mono col={SUBTLE}>{h.openedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EFFECTIVENESS */}
        {tab === 'effectiveness' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {effectiveness.slice(0, 3).map((e, i) => (
                <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{e.portfolio}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>Hedge Ratio</div><div style={{ fontFamily: MONO, fontSize: 13, color: BLUE }}>{(e.hedgeRatio * 100).toFixed(1)}%</div></div>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>Correlation</div><div style={{ fontFamily: MONO, fontSize: 13, color: e.correlationWithPortfolio < -0.7 ? GREEN : ORANGE }}>{e.correlationWithPortfolio.toFixed(3)}</div></div>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>VaR Reduction</div><div style={{ fontFamily: MONO, fontSize: 13, color: GREEN }}>{(e.dailyVarReduction * 100).toFixed(1)}%</div></div>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>Beta Reduction</div><div style={{ fontFamily: MONO, fontSize: 13, color: GREEN }}>{(e.betaReduction * 100).toFixed(1)}%</div></div>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>RÂ²</div><div style={{ fontFamily: MONO, fontSize: 13, color: AMBER }}>{e.r2.toFixed(4)}</div></div>
                    <div><div style={{ fontSize: 9, color: SUBTLE }}>Window</div><div style={{ fontFamily: MONO, fontSize: 13, color: SUBTLE }}>{e.windowDays}d</div></div>
                  </div>
                </div>
              ))}
            </div>
            {effectiveness.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No effectiveness data â€” check /api/v4/hedge-engine/effectiveness</div>}
          </div>
        )}

        {/* COST ANALYSIS */}
        {tab === 'cost' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Instrument</Th><Th right>Annual Cost (bps)</Th><Th right>Carry (bps)</Th><Th right>IV</Th><Th right>RV</Th><Th right>Vol Premium (bps)</Th><Th right>Total Cost (bps)</Th><Th>Rating</Th></tr></thead>
              <tbody>
                {costData.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No cost data â€” check /api/v4/hedge-engine/cost</td></tr>}
                {costData.sort((a, b) => a.totalCostBps - b.totalCostBps).map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.symbol}</Td>
                    <Td mono col={TEXT}>{c.instrument}</Td>
                    <Td right mono col={ORANGE}>{c.annualCostBps.toFixed(1)}</Td>
                    <Td right mono col={c.carryBps < 0 ? GREEN : RED}>{c.carryBps.toFixed(1)}</Td>
                    <Td right mono col={PURPLE}>{(c.impliedVol * 100).toFixed(1)}%</Td>
                    <Td right mono col={BLUE}>{(c.realizedVol * 100).toFixed(1)}%</Td>
                    <Td right mono col={c.volPremiumBps > 50 ? RED : c.volPremiumBps > 20 ? AMBER : GREEN}>{c.volPremiumBps.toFixed(1)}</Td>
                    <Td right mono col={c.totalCostBps > 100 ? RED : c.totalCostBps > 50 ? AMBER : GREEN}>{c.totalCostBps.toFixed(1)}</Td>
                    <Td><CostRatingBadge r={c.costRating} /></Td>
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
