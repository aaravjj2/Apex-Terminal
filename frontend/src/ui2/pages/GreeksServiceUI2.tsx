import React, { useState, useEffect, useCallback } from 'react'
﻿// GreeksServiceUI2 â€” Bloomberg GRKS-grade real-time Greeks computation
// First/second/third-order Greeks, sensitivity surfaces, risk decomposition
// Tabs: LIVE GREEKS | PORTFOLIO GREEKS | SENSITIVITY | TERM STRUCTURE | RISK DECOMP
// APIs: /api/v4/greeks/live, /portfolio, /sensitivity, /term-structure, /decomp

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

interface LiveGreek {
  symbol: string
  underlying: string
  right: 'call' | 'put'
  strike: number
  expiry: string
  dtedays: number
  spot: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  vanna: number
  volga: number
  charm: number
  speed: number
  theoreticalPrice: number
  marketPrice: number
  edge: number
}

interface PortfolioGreek {
  portfolio: string
  netDelta: number
  netGamma: number
  netTheta: number
  netVega: number
  netRho: number
  deltaDollar: number
  gammaDollar: number
  thetaDay: number
  vegaPoint: number
  positions: number
}

interface SensRow {
  parameter: string
  baseValue: number
  shock: number
  deltaImpact: number
  portfolioImpact: number
  unit: string
}

interface TermStructurePoint {
  expiry: string
  dtedays: number
  atm_iv: number
  skew_25d: number
  rr_25d: number
  fly_25d: number
  forward: number
  intRate: number
}

interface DecompRow {
  riskFactor: string
  contribution: number
  pct: number
  category: string
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

function GreekCell({ label, value, decimals = 4, scaleColor }: { label: string; value: number; decimals?: number; scaleColor?: 'delta' | 'theta' | 'vega' | 'gamma' }) {
  const colors: Record<string, string> = { delta: value < 0 ? RED : GREEN, theta: value < 0 ? RED : GREEN, vega: AMBER, gamma: PURPLE }
  const c = scaleColor ? colors[scaleColor] : TEXT
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 8, color: SUBTLE, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: c, fontWeight: 600 }}>{value.toFixed(decimals)}</div>
    </div>
  )
}

function RightBadge({ right }: { right: 'call' | 'put' }) {
  return <span style={{ fontFamily: MONO, fontSize: 9, color: right === 'call' ? BLUE : ORANGE, background: (right === 'call' ? BLUE : ORANGE) + '22', borderRadius: 3, padding: '2px 6px' }}>{right.toUpperCase()}</span>
}

function DteBadge({ dte }: { dte: number }) {
  const c = dte < 7 ? RED : dte < 30 ? ORANGE : dte < 90 ? AMBER : GREEN
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c }}>{dte}d</span>
}

function CatBadge({ cat }: { cat: string }) {
  const m: Record<string, string> = { delta: GREEN, gamma: PURPLE, vega: AMBER, theta: RED, rho: BLUE, vanna: ORANGE, other: SUBTLE }
  const c = m[cat.toLowerCase()] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{cat.toUpperCase()}</span>
}


export function GreeksServiceUI2() {
  const [tab, setTab] = useState<'live' | 'portfolio' | 'sensitivity' | 'term' | 'decomp'>('live')
  const [liveGreeks, setLiveGreeks] = useState<LiveGreek[]>([])
  const [portfolioGreeks, setPortfolioGreeks] = useState<PortfolioGreek[]>([])
  const [sensitivity, setSensitivity] = useState<SensRow[]>([])
  const [termStructure, setTermStructure] = useState<TermStructurePoint[]>([])
  const [decompRows, setDecompRows] = useState<DecompRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [rightFilter, setRightFilter] = useState<string>('all')
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rL, rP, rS, rT, rD] = await Promise.allSettled([
        fetch('/api/v4/greeks/live').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/greeks/portfolio').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/greeks/sensitivity').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/greeks/term-structure').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/greeks/decomp').then(r => r.ok ? r.json() : []),
      ])
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.greeks ?? rL.value.data ?? []
        setLiveGreeks(raw.map((g: any) => ({
          symbol: g.symbol ?? '', underlying: g.underlying ?? '', right: g.right ?? 'call',
          strike: Number(g.strike ?? 0), expiry: g.expiry ?? '', dtedays: Number(g.dte_days ?? g.dtedays ?? 0),
          spot: Number(g.spot ?? 0), iv: Number(g.iv ?? g.implied_vol ?? 0),
          delta: Number(g.delta ?? 0), gamma: Number(g.gamma ?? 0), theta: Number(g.theta ?? 0),
          vega: Number(g.vega ?? 0), rho: Number(g.rho ?? 0), vanna: Number(g.vanna ?? 0),
          volga: Number(g.volga ?? 0), charm: Number(g.charm ?? 0), speed: Number(g.speed ?? 0),
          theoreticalPrice: Number(g.theoretical_price ?? g.theoreticalPrice ?? 0),
          marketPrice: Number(g.market_price ?? g.marketPrice ?? 0),
          edge: Number(g.edge ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load live greeks')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.portfolios ?? rP.value.data ?? []
        setPortfolioGreeks(raw.map((p: any) => ({
          portfolio: p.portfolio ?? '', netDelta: Number(p.net_delta ?? p.netDelta ?? 0),
          netGamma: Number(p.net_gamma ?? p.netGamma ?? 0), netTheta: Number(p.net_theta ?? p.netTheta ?? 0),
          netVega: Number(p.net_vega ?? p.netVega ?? 0), netRho: Number(p.net_rho ?? p.netRho ?? 0),
          deltaDollar: Number(p.delta_dollar ?? p.deltaDollar ?? 0),
          gammaDollar: Number(p.gamma_dollar ?? p.gammaDollar ?? 0), thetaDay: Number(p.theta_day ?? p.thetaDay ?? 0),
          vegaPoint: Number(p.vega_point ?? p.vegaPoint ?? 0), positions: Number(p.positions ?? 0),
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sensitivity ?? rS.value.data ?? []
        setSensitivity(raw.map((s: any) => ({
          parameter: s.parameter ?? '', baseValue: Number(s.base_value ?? s.baseValue ?? 0),
          shock: Number(s.shock ?? 0), deltaImpact: Number(s.delta_impact ?? s.deltaImpact ?? 0),
          portfolioImpact: Number(s.portfolio_impact ?? s.portfolioImpact ?? 0), unit: s.unit ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.term_structure ?? rT.value.data ?? []
        setTermStructure(raw.map((t: any) => ({
          expiry: t.expiry ?? '', dtedays: Number(t.dte_days ?? t.dtedays ?? 0),
          atm_iv: Number(t.atm_iv ?? 0), skew_25d: Number(t.skew_25d ?? 0),
          rr_25d: Number(t.rr_25d ?? 0), fly_25d: Number(t.fly_25d ?? 0),
          forward: Number(t.forward ?? 0), intRate: Number(t.int_rate ?? t.intRate ?? 0),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.decomp ?? rD.value.data ?? []
        setDecompRows(raw.map((d: any) => ({
          riskFactor: d.risk_factor ?? d.riskFactor ?? '', contribution: Number(d.contribution ?? 0),
          pct: Number(d.pct ?? 0), category: d.category ?? 'other',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 3000); return () => clearInterval(id) }, [fetchAll])

  const underlyings = ['all', ...Array.from(new Set(liveGreeks.map(g => g.underlying))).sort()]
  const filtered = liveGreeks.filter(g =>
    (rightFilter === 'all' || g.right === rightFilter) &&
    (selectedSymbol === 'all' || g.underlying === selectedSymbol)
  )

  const totalNetDelta = portfolioGreeks.reduce((s, p) => s + p.netDelta, 0)
  const totalNetVega = portfolioGreeks.reduce((s, p) => s + p.netVega, 0)
  const totalThetaDay = portfolioGreeks.reduce((s, p) => s + p.thetaDay, 0)

  const TABS = [
    { id: 'live' as const, label: 'LIVE GREEKS' },
    { id: 'portfolio' as const, label: 'PORTFOLIO GREEKS' },
    { id: 'sensitivity' as const, label: 'SENSITIVITY' },
    { id: 'term' as const, label: 'TERM STRUCTURE' },
    { id: 'decomp' as const, label: 'RISK DECOMP' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>GRKS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>GREEKS SERVICE â€” REAL-TIME Î” Î“ Î¸ V Ï + HIGHER ORDER + SENSITIVITY ANALYSIS</span>
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>Loading...</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Options" value={liveGreeks.length} sub="live greeks" />
        <StatCard label="Net Î”" value={totalNetDelta.toFixed(4)} col={Math.abs(totalNetDelta) > 0.5 ? ORANGE : GREEN} />
        <StatCard label="Net V" value={totalNetVega.toFixed(2)} col={AMBER} sub="vega exposure" />
        <StatCard label="Î˜ / Day" value={`$${totalThetaDay.toFixed(2)}`} col={totalThetaDay < 0 ? RED : GREEN} sub="time decay" />
        <StatCard label="Portfolios" value={portfolioGreeks.length} col={BLUE} />
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

        {/* LIVE GREEKS */}
        {tab === 'live' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {['all', 'call', 'put'].map(r => (
                <button key={r} onClick={() => setRightFilter(r)}
                  style={{ fontFamily: MONO, fontSize: 10, color: rightFilter === r ? (r === 'call' ? BLUE : r === 'put' ? ORANGE : AMBER) : SUBTLE, background: rightFilter === r ? '#ffffff11' : 'transparent', border: `1px solid ${rightFilter === r ? BORDER : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {r === 'all' ? 'ALL' : r.toUpperCase() + 'S'}
                </button>
              ))}
              <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 10, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 3, padding: '4px 8px' }}>
                {underlyings.map(u => <option key={u} value={u}>{u === 'all' ? 'ALL UNDERLYINGS' : u}</option>)}
              </select>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Symbol</Th><Th>Right</Th><Th right>Strike</Th><Th>DTE</Th><Th right>IV</Th><Th right>Spot</Th><Th right>Delta</Th><Th right>Gamma</Th><Th right>Theta</Th><Th right>Vega</Th><Th right>Vanna</Th><Th right>Volga</Th><Th right>Edge</Th></tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No greeks data â€” check /api/v4/greeks/live</td></tr>}
                  {filtered.map((g, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{g.symbol}</Td>
                      <Td><RightBadge right={g.right} /></Td>
                      <Td right mono>{g.strike.toFixed(0)}</Td>
                      <Td><DteBadge dte={g.dtedays} /></Td>
                      <Td right mono col={PURPLE}>{(g.iv * 100).toFixed(1)}%</Td>
                      <Td right mono>{g.spot.toFixed(2)}</Td>
                      <Td right mono col={g.delta < 0 ? RED : GREEN}>{g.delta.toFixed(4)}</Td>
                      <Td right mono col={PURPLE}>{g.gamma.toFixed(5)}</Td>
                      <Td right mono col={g.theta < 0 ? RED : GREEN}>{g.theta.toFixed(4)}</Td>
                      <Td right mono col={AMBER}>{g.vega.toFixed(4)}</Td>
                      <Td right mono col={ORANGE}>{g.vanna.toFixed(5)}</Td>
                      <Td right mono col={BLUE}>{g.volga.toFixed(5)}</Td>
                      <Td right mono col={g.edge > 0 ? GREEN : RED}>{g.edge >= 0 ? '+' : ''}{g.edge.toFixed(3)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PORTFOLIO GREEKS */}
        {tab === 'portfolio' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Portfolio</Th><Th right>Net Î”</Th><Th right>Net Î“</Th><Th right>Net Î¸</Th><Th right>Net V</Th><Th right>Net Ï</Th><Th right>Î”$</Th><Th right>Î“$</Th><Th right>Î¸/Day $</Th><Th right>Positions</Th></tr></thead>
              <tbody>
                {portfolioGreeks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No portfolio greeks â€” check /api/v4/greeks/portfolio</td></tr>}
                {portfolioGreeks.map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.portfolio}</Td>
                    <Td right mono col={p.netDelta < 0 ? RED : GREEN}>{p.netDelta.toFixed(4)}</Td>
                    <Td right mono col={PURPLE}>{p.netGamma.toFixed(5)}</Td>
                    <Td right mono col={p.netTheta < 0 ? RED : GREEN}>{p.netTheta.toFixed(4)}</Td>
                    <Td right mono col={AMBER}>{p.netVega.toFixed(4)}</Td>
                    <Td right mono col={BLUE}>{p.netRho.toFixed(4)}</Td>
                    <Td right mono col={p.deltaDollar < 0 ? RED : GREEN}>${Math.abs(p.deltaDollar / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={PURPLE}>${(p.gammaDollar / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={p.thetaDay < 0 ? RED : GREEN}>${p.thetaDay.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{p.positions}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SENSITIVITY */}
        {tab === 'sensitivity' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Parameter</Th><Th right>Base Value</Th><Th right>Shock</Th><Th right>Î” Impact</Th><Th right>Portfolio Impact $</Th><Th>Unit</Th></tr></thead>
              <tbody>
                {sensitivity.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sensitivity data â€” check /api/v4/greeks/sensitivity</td></tr>}
                {sensitivity.map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.parameter}</Td>
                    <Td right mono>{s.baseValue.toFixed(4)}</Td>
                    <Td right mono col={ORANGE}>{s.shock >= 0 ? '+' : ''}{s.shock.toFixed(4)}</Td>
                    <Td right mono col={s.deltaImpact < 0 ? RED : GREEN}>{s.deltaImpact >= 0 ? '+' : ''}{s.deltaImpact.toFixed(5)}</Td>
                    <Td right mono col={s.portfolioImpact < 0 ? RED : GREEN}>{s.portfolioImpact >= 0 ? '+' : ''}${s.portfolioImpact.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{s.unit}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TERM STRUCTURE */}
        {tab === 'term' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Expiry</Th><Th right>DTE</Th><Th right>ATM IV</Th><Th right>25Î” Skew</Th><Th right>25Î” RR</Th><Th right>25Î” Fly</Th><Th right>Forward</Th><Th right>Int Rate</Th></tr></thead>
              <tbody>
                {termStructure.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No term structure â€” check /api/v4/greeks/term-structure</td></tr>}
                {termStructure.sort((a, b) => a.dtedays - b.dtedays).map((t, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{t.expiry}</Td>
                    <Td right><DteBadge dte={t.dtedays} /></Td>
                    <Td right mono col={PURPLE}>{(t.atm_iv * 100).toFixed(2)}%</Td>
                    <Td right mono col={t.skew_25d < 0 ? GREEN : RED}>{(t.skew_25d > 0 ? '+' : '')}{(t.skew_25d * 100).toFixed(2)}%</Td>
                    <Td right mono col={ORANGE}>{(t.rr_25d * 100).toFixed(2)}%</Td>
                    <Td right mono col={BLUE}>{(t.fly_25d * 100).toFixed(2)}%</Td>
                    <Td right mono>{t.forward.toFixed(4)}</Td>
                    <Td right mono col={SUBTLE}>{(t.intRate * 100).toFixed(3)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RISK DECOMP */}
        {tab === 'decomp' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Risk Factor</Th><Th>Category</Th><Th right>Contribution $</Th><Th right>% of Total</Th></tr></thead>
              <tbody>
                {decompRows.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No decomp data â€” check /api/v4/greeks/decomp</td></tr>}
                {decompRows.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.riskFactor}</Td>
                    <Td><CatBadge cat={d.category} /></Td>
                    <Td right mono col={d.contribution < 0 ? RED : GREEN}>{d.contribution >= 0 ? '+' : ''}${d.contribution.toFixed(0)}</Td>
                    <Td right mono col={Math.abs(d.pct) > 20 ? ORANGE : SUBTLE}>{d.pct.toFixed(1)}%</Td>
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
