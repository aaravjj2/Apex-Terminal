import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// AttributionUI2 — Bloomberg ATTR-grade portfolio attribution terminal
// Tabs: BRINSON | FACTOR | SECURITY SELECTION | CURRENCY | RISK CONTRIBUTION
// APIs: /api/v4/attribution/brinson, /api/v4/attribution/factor,
//       /api/v4/attribution/selection, /api/v4/attribution/currency,
//       /api/v4/attribution/risk

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

interface BrinsonRow {
  sector: string
  portfolioWeight: number
  benchmarkWeight: number
  portfolioReturn: number
  benchmarkReturn: number
  allocationEffect: number
  selectionEffect: number
  interactionEffect: number
  totalEffect: number
}

interface FactorRow {
  factor: string
  exposure: number
  t_stat: number
  return_contribution: number
  risk_contribution: number
  information_ratio: number
  active_weight: number
}

interface SecurityRow {
  symbol: string
  sector: string
  portfolioWeight: number
  benchmarkWeight: number
  activeWeight: number
  portfolioReturn: number
  benchmarkReturn: number
  selectionEffect: number
  allocationEffect: number
}

interface CurrencyRow {
  currency: string
  weight: number
  unrealizedReturn: number
  hedgeRatio: number
  currencyReturn: number
  totalEffect: number
  forwardRate: number
  spotRate: number
}

interface RiskContrib {
  symbol: string
  marginalVaR: number
  componentVaR: number
  percentVaR: number
  beta: number
  correlationToPort: number
  trackingError: number
}

// ── sub-components ────────────────────────────────────────────────────────────
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

function fmtPct(v: number, decimals = 2) {
  if (v === undefined || v === null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

function EffectBar({ value, max }: { value: number; max: number }) {
  const pct = max !== 0 ? Math.min(100, Math.abs(value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 60, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', [value >= 0 ? 'left' : 'right']: '50%', top: 0, width: `${pct / 2}%`, height: '100%', background: value >= 0 ? GREEN : RED, borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: SUBTLE }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: value >= 0 ? GREEN : RED, minWidth: 52, textAlign: 'right' }}>{fmtPct(value)}</span>
    </div>
  )
}

function WaterfallBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, x) => s + x.value, 0)
  const absMax = Math.max(...items.map(x => Math.abs(x.value)))
  const barMax = absMax || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: SUBTLE, width: 140, textAlign: 'right', shrink: 0 } as React.CSSProperties}>{item.label}</span>
          <div style={{ flex: 1, height: 16, background: BORDER, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', [item.value >= 0 ? 'left' : 'right']: 0, top: 0, width: `${(Math.abs(item.value) / barMax) * 50}%`, height: '100%', background: item.color, opacity: 0.85 }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: SUBTLE }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: MONO, color: item.color, width: 60, textAlign: 'right' }}>{fmtPct(item.value)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 10, color: AMBER, fontWeight: 700, width: 140, textAlign: 'right' }}>TOTAL ACTIVE</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color: total >= 0 ? GREEN : RED, width: 60, textAlign: 'right' }}>{fmtPct(total)}</span>
      </div>
    </div>
  )
}


const BENCHMARKS = ['SPY', 'QQQ', 'IWM', 'AGG', 'EFA', 'VTI']
const PERIODS = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'ITD']

export function AttributionUI2() {
  const [tab, setTab] = useState<'brinson' | 'factor' | 'selection' | 'currency' | 'risk'>('brinson')
  const [brinson, setBrinson] = useState<BrinsonRow[]>([])
  const [factors, setFactors] = useState<FactorRow[]>([])
  const [selection, setSelection] = useState<SecurityRow[]>([])
  const [currency, setCurrency] = useState<CurrencyRow[]>([])
  const [riskContrib, setRiskContrib] = useState<RiskContrib[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [benchmark, setBenchmark] = useState('SPY')
  const [period, setPeriod] = useState('1M')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchBrinson = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/attribution/brinson?benchmark=${benchmark}&period=${period}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.sectors ?? d.data ?? []
      setBrinson(raw.map((x: any) => ({
        sector: x.sector ?? x.name ?? '',
        portfolioWeight: Number(x.portfolio_weight ?? x.port_weight ?? 0),
        benchmarkWeight: Number(x.benchmark_weight ?? x.bench_weight ?? 0),
        portfolioReturn: Number(x.portfolio_return ?? x.port_return ?? 0),
        benchmarkReturn: Number(x.benchmark_return ?? x.bench_return ?? 0),
        allocationEffect: Number(x.allocation_effect ?? x.allocation ?? 0),
        selectionEffect: Number(x.selection_effect ?? x.selection ?? 0),
        interactionEffect: Number(x.interaction_effect ?? x.interaction ?? 0),
        totalEffect: Number(x.total_effect ?? x.total ?? 0),
      })))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [benchmark, period])

  const fetchFactor = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/attribution/factor?benchmark=${benchmark}&period=${period}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.factors ?? d.data ?? []
      setFactors(raw.map((x: any) => ({
        factor: x.factor ?? x.name ?? '',
        exposure: Number(x.exposure ?? 0),
        t_stat: Number(x.t_stat ?? x.t_statistic ?? 0),
        return_contribution: Number(x.return_contribution ?? x.return ?? 0),
        risk_contribution: Number(x.risk_contribution ?? x.risk ?? 0),
        information_ratio: Number(x.information_ratio ?? x.ir ?? 0),
        active_weight: Number(x.active_weight ?? 0),
      })))
    } catch { /* empty */ }
  }, [benchmark, period])

  const fetchSelection = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/attribution/selection?benchmark=${benchmark}&period=${period}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.securities ?? d.data ?? []
      setSelection(raw.map((x: any) => ({
        symbol: x.symbol ?? x.ticker ?? '',
        sector: x.sector ?? '',
        portfolioWeight: Number(x.portfolio_weight ?? 0),
        benchmarkWeight: Number(x.benchmark_weight ?? 0),
        activeWeight: Number(x.active_weight ?? 0),
        portfolioReturn: Number(x.portfolio_return ?? 0),
        benchmarkReturn: Number(x.benchmark_return ?? 0),
        selectionEffect: Number(x.selection_effect ?? 0),
        allocationEffect: Number(x.allocation_effect ?? 0),
      })))
    } catch { /* empty */ }
  }, [benchmark, period])

  const fetchCurrency = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/attribution/currency?period=${period}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.currencies ?? d.data ?? []
      setCurrency(raw.map((x: any) => ({
        currency: x.currency ?? x.ccf ?? '',
        weight: Number(x.weight ?? 0),
        unrealizedReturn: Number(x.unrealized_return ?? 0),
        hedgeRatio: Number(x.hedge_ratio ?? x.hedge ?? 0),
        currencyReturn: Number(x.currency_return ?? 0),
        totalEffect: Number(x.total_effect ?? 0),
        forwardRate: Number(x.forward_rate ?? 0),
        spotRate: Number(x.spot_rate ?? 0),
      })))
    } catch { /* empty */ }
  }, [period])

  const fetchRisk = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/attribution/risk?period=${period}`)
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.contributions ?? d.data ?? []
      setRiskContrib(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        marginalVaR: Number(x.marginal_var ?? 0),
        componentVaR: Number(x.component_var ?? 0),
        percentVaR: Number(x.percent_var ?? x.pct_var ?? 0),
        beta: Number(x.beta ?? 0),
        correlationToPort: Number(x.correlation_to_port ?? x.correlation ?? 0),
        trackingError: Number(x.tracking_error ?? x.te ?? 0),
      })))
    } catch { /* empty */ }
  }, [period])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchBrinson(), fetchFactor(), fetchSelection(), fetchCurrency(), fetchRisk()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(fetchBrinson, 60000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchBrinson, fetchFactor, fetchSelection, fetchCurrency, fetchRisk])

  const totalActive = brinson.reduce((s, x) => s + x.totalEffect, 0)
  const totalAlloc = brinson.reduce((s, x) => s + x.allocationEffect, 0)
  const totalSelect = brinson.reduce((s, x) => s + x.selectionEffect, 0)
  const totalInteract = brinson.reduce((s, x) => s + x.interactionEffect, 0)
  const topContrib = selection.filter(s => s.selectionEffect > 0).sort((a, b) => b.selectionEffect - a.selectionEffect)[0]
  const topDetract = selection.filter(s => s.selectionEffect < 0).sort((a, b) => a.selectionEffect - b.selectionEffect)[0]

  const tabs = [
    { id: 'brinson' as const, label: 'BRINSON' },
    { id: 'factor' as const, label: 'FACTOR' },
    { id: 'selection' as const, label: 'SECURITY SELECTION' },
    { id: 'currency' as const, label: 'CURRENCY' },
    { id: 'risk' as const, label: 'RISK CONTRIBUTION' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ATTR</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PORTFOLIO ATTRIBUTION ENGINE</span>
        <span style={{ fontSize: 10, color: totalActive >= 0 ? GREEN : RED, fontWeight: 700 }}>
          ACTIVE RETURN: {fmtPct(totalActive)}
        </span>
        {/* benchmark/period selectors */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {BENCHMARKS.map(b => (
            <button key={b} onClick={() => setBenchmark(b)}
              style={{ fontFamily: MONO, fontSize: 9, color: benchmark === b ? '#000' : TEXT, background: benchmark === b ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 7px', cursor: 'pointer' }}>
              {b}
            </button>
          ))}
          <span style={{ fontSize: 10, color: SUBTLE, margin: '0 4px' }}>|</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ fontFamily: MONO, fontSize: 9, color: period === p ? '#000' : TEXT, background: period === p ? BLUE : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 7px', cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Active Return" value={fmtPct(totalActive)} col={totalActive >= 0 ? GREEN : RED} sub={`vs ${benchmark}`} />
        <StatCard label="Allocation Effect" value={fmtPct(totalAlloc)} col={totalAlloc >= 0 ? GREEN : RED} />
        <StatCard label="Selection Effect" value={fmtPct(totalSelect)} col={totalSelect >= 0 ? GREEN : RED} />
        <StatCard label="Interaction Effect" value={fmtPct(totalInteract)} col={totalInteract >= 0 ? GREEN : RED} />
        <StatCard label="Top Contributor" value={topContrib?.symbol ?? '—'} col={GREEN} sub={topContrib ? fmtPct(topContrib.selectionEffect) : undefined} />
        <StatCard label="Top Detractor" value={topDetract?.symbol ?? '—'} col={RED} sub={topDetract ? fmtPct(topDetract.selectionEffect) : undefined} />
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading attribution data...</div>}

        {/* ── BRINSON ── */}
        {tab === 'brinson' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>BHB Attribution Waterfall — {period} vs {benchmark}</div>
                <WaterfallBar items={[
                  { label: 'Allocation Effect', value: totalAlloc, color: BLUE },
                  { label: 'Selection Effect', value: totalSelect, color: GREEN },
                  { label: 'Interaction Effect', value: totalInteract, color: PURPLE },
                ]} />
                <div style={{ marginTop: 14, fontSize: 10, color: SUBTLE, lineHeight: 1.7 }}>
                  <b style={{ color: BLUE }}>Allocation</b> — sector weight vs benchmark<br />
                  <b style={{ color: GREEN }}>Selection</b> — stock picking within sector<br />
                  <b style={{ color: PURPLE }}>Interaction</b> — combined active bet effect
                </div>
              </div>
              <div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Attribution Summary</div>
                  {[
                    ['Benchmark Return', brinson.length > 0 ? fmtPct(brinson.reduce((s, x) => s + x.benchmarkReturn * x.benchmarkWeight, 0)) : '—', BLUE],
                    ['Allocation Effect', fmtPct(totalAlloc), totalAlloc >= 0 ? GREEN : RED],
                    ['Selection Effect', fmtPct(totalSelect), totalSelect >= 0 ? GREEN : RED],
                    ['Interaction Effect', fmtPct(totalInteract), totalInteract >= 0 ? GREEN : RED],
                    ['Total Active Return', fmtPct(totalActive), totalActive >= 0 ? GREEN : RED],
                  ].map(([l, v, c]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 11, color: SUBTLE }}>{l as string}</span>
                      <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: c as string }}>{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Sector</Th>
                    <Th right>Port Wt</Th><Th right>Bench Wt</Th><Th right>Active Wt</Th>
                    <Th right>Port Ret</Th><Th right>Bench Ret</Th>
                    <Th right>Allocation</Th><Th right>Selection</Th><Th right>Interaction</Th><Th right>Total Effect</Th>
                  </tr>
                </thead>
                <tbody>
                  {brinson.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : 'No data — check /api/v4/attribution/brinson'}
                    </td></tr>
                  )}
                  {brinson.sort((a, b) => Math.abs(b.totalEffect) - Math.abs(a.totalEffect)).map(r => (
                    <tr key={r.sector}>
                      <Td mono col={AMBER}>{r.sector}</Td>
                      <Td right mono>{r.portfolioWeight.toFixed(1)}%</Td>
                      <Td right mono>{r.benchmarkWeight.toFixed(1)}%</Td>
                      <Td right mono col={r.portfolioWeight > r.benchmarkWeight ? GREEN : RED}>{fmtPct(r.portfolioWeight - r.benchmarkWeight, 1)}</Td>
                      <Td right mono col={r.portfolioReturn >= 0 ? GREEN : RED}>{fmtPct(r.portfolioReturn)}</Td>
                      <Td right mono col={SUBTLE}>{fmtPct(r.benchmarkReturn)}</Td>
                      <Td right><EffectBar value={r.allocationEffect} max={Math.max(...brinson.map(x => Math.abs(x.allocationEffect)), 0.01)} /></Td>
                      <Td right><EffectBar value={r.selectionEffect} max={Math.max(...brinson.map(x => Math.abs(x.selectionEffect)), 0.01)} /></Td>
                      <Td right><EffectBar value={r.interactionEffect} max={Math.max(...brinson.map(x => Math.abs(x.interactionEffect)), 0.01)} /></Td>
                      <Td right mono col={r.totalEffect >= 0 ? GREEN : RED} >{fmtPct(r.totalEffect)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── FACTOR ── */}
        {tab === 'factor' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {factors.slice(0, 6).map(f => (
                <div key={f.factor} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{f.factor}</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>EXPOSURE</div>
                      <div style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: f.exposure > 0 ? GREEN : RED }}>{f.exposure.toFixed(2)}σ</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>RETURN CONTRIB</div>
                      <div style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: f.return_contribution >= 0 ? GREEN : RED }}>{fmtPct(f.return_contribution)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>IR</div>
                      <div style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: f.information_ratio > 0 ? GREEN : RED }}>{f.information_ratio.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Factor</Th><Th right>Exposure</Th><Th right>T-Stat</Th>
                    <Th right>Return Contrib</Th><Th right>Risk Contrib</Th>
                    <Th right>Info Ratio</Th><Th right>Active Wt</Th>
                  </tr>
                </thead>
                <tbody>
                  {factors.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No factor data — check /api/v4/attribution/factor
                    </td></tr>
                  )}
                  {factors.sort((a, b) => Math.abs(b.return_contribution) - Math.abs(a.return_contribution)).map(f => (
                    <tr key={f.factor}>
                      <Td mono col={AMBER}>{f.factor}</Td>
                      <Td right mono col={f.exposure > 0 ? GREEN : RED}>{f.exposure.toFixed(3)}σ</Td>
                      <Td right mono col={Math.abs(f.t_stat) > 2 ? (f.t_stat > 0 ? GREEN : RED) : SUBTLE}>{f.t_stat.toFixed(2)}</Td>
                      <Td right mono col={f.return_contribution >= 0 ? GREEN : RED}>{fmtPct(f.return_contribution)}</Td>
                      <Td right mono col={f.risk_contribution > 10 ? RED : SUBTLE}>{fmtPct(f.risk_contribution)}</Td>
                      <Td right mono col={f.information_ratio > 0 ? GREEN : RED}>{f.information_ratio.toFixed(2)}</Td>
                      <Td right mono col={f.active_weight > 0 ? BLUE : SUBTLE}>{fmtPct(f.active_weight)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── SELECTION ── */}
        {tab === 'selection' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Sector</Th>
                    <Th right>Port Wt</Th><Th right>Bench Wt</Th><Th right>Active Wt</Th>
                    <Th right>Port Ret</Th><Th right>Bench Ret</Th>
                    <Th right>Selection Effect</Th><Th right>Alloc Effect</Th>
                  </tr>
                </thead>
                <tbody>
                  {selection.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No selection data — check /api/v4/attribution/selection
                    </td></tr>
                  )}
                  {selection.sort((a, b) => b.selectionEffect - a.selectionEffect).map(s => (
                    <tr key={s.symbol}>
                      <Td mono col={AMBER}>{s.symbol}</Td>
                      <Td col={SUBTLE}>{s.sector}</Td>
                      <Td right mono>{s.portfolioWeight.toFixed(2)}%</Td>
                      <Td right mono col={SUBTLE}>{s.benchmarkWeight.toFixed(2)}%</Td>
                      <Td right mono col={s.activeWeight > 0 ? GREEN : RED}>{fmtPct(s.activeWeight, 2)}</Td>
                      <Td right mono col={s.portfolioReturn >= 0 ? GREEN : RED}>{fmtPct(s.portfolioReturn)}</Td>
                      <Td right mono col={SUBTLE}>{fmtPct(s.benchmarkReturn)}</Td>
                      <Td right>
                        <EffectBar value={s.selectionEffect} max={Math.max(...selection.map(x => Math.abs(x.selectionEffect)), 0.01)} />
                      </Td>
                      <Td right>
                        <EffectBar value={s.allocationEffect} max={Math.max(...selection.map(x => Math.abs(x.allocationEffect)), 0.01)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── CURRENCY ── */}
        {tab === 'currency' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Currency</Th><Th right>Weight</Th><Th right>Spot Rate</Th>
                    <Th right>Fwd Rate</Th><Th right>Hedge Ratio</Th>
                    <Th right>Ccy Return</Th><Th right>Unrealized</Th><Th right>Total Effect</Th>
                  </tr>
                </thead>
                <tbody>
                  {currency.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No currency data — check /api/v4/attribution/currency
                    </td></tr>
                  )}
                  {currency.map(c => (
                    <tr key={c.currency}>
                      <Td mono col={AMBER}>{c.currency}</Td>
                      <Td right mono>{c.weight.toFixed(1)}%</Td>
                      <Td right mono>{c.spotRate.toFixed(4)}</Td>
                      <Td right mono col={SUBTLE}>{c.forwardRate.toFixed(4)}</Td>
                      <Td right mono col={c.hedgeRatio > 0.5 ? GREEN : RED}>{(c.hedgeRatio * 100).toFixed(0)}%</Td>
                      <Td right mono col={c.currencyReturn >= 0 ? GREEN : RED}>{fmtPct(c.currencyReturn)}</Td>
                      <Td right mono col={c.unrealizedReturn >= 0 ? GREEN : RED}>{fmtPct(c.unrealizedReturn)}</Td>
                      <Td right>
                        <EffectBar value={c.totalEffect} max={Math.max(...currency.map(x => Math.abs(x.totalEffect)), 0.01)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── RISK CONTRIBUTION ── */}
        {tab === 'risk' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th right>Marginal VaR</Th><Th right>Component VaR</Th>
                    <Th right>% of VaR</Th><Th right>Beta</Th>
                    <Th right>Correlation</Th><Th right>Tracking Error</Th>
                    <Th>Risk Bar</Th>
                  </tr>
                </thead>
                <tbody>
                  {riskContrib.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No risk data — check /api/v4/attribution/risk
                    </td></tr>
                  )}
                  {riskContrib.sort((a, b) => b.percentVaR - a.percentVaR).map(r => {
                    const pct = r.percentVaR
                    return (
                      <tr key={r.symbol}>
                        <Td mono col={AMBER}>{r.symbol}</Td>
                        <Td right mono col={RED}>{r.marginalVaR.toFixed(3)}</Td>
                        <Td right mono col={ORANGE}>{r.componentVaR.toFixed(3)}</Td>
                        <Td right mono col={pct > 20 ? RED : pct > 10 ? AMBER : SUBTLE}>{pct.toFixed(1)}%</Td>
                        <Td right mono col={r.beta > 1.2 ? RED : r.beta < 0.8 ? GREEN : SUBTLE}>{r.beta.toFixed(2)}</Td>
                        <Td right mono col={r.correlationToPort > 0.8 ? RED : SUBTLE}>{r.correlationToPort.toFixed(2)}</Td>
                        <Td right mono col={r.trackingError > 5 ? RED : SUBTLE}>{r.trackingError.toFixed(2)}%</Td>
                        <td style={{ padding: '5px 10px', borderBottom: `1px solid #161616` }}>
                          <div style={{ width: `${Math.min(100, pct * 3)}%`, minWidth: 4, height: 8, background: pct > 20 ? RED : pct > 10 ? AMBER : BLUE, borderRadius: 3 }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
