import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// StressScenariosUI2 — Bloomberg STRS-grade stress testing & scenario analysis terminal
// Historical replay, custom shock modeling, multi-factor scenarios
// Tabs: SCENARIOS | RESULTS | CUSTOM BUILDER | HISTORICAL REPLAY | COMPARISON
// APIs: /api/v4/stress-scenarios/list, /run, /results, /custom, /historical, /comparison

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

type ScenarioCategory = 'historical' | 'custom' | 'regulatory' | 'macro' | 'geopolitical' | 'credit'

interface StressScenario {
  scenarioId: string
  name: string
  category: ScenarioCategory
  description: string
  shocks: Record<string, number>
  duration: string
  probability: number
  severity: 'extreme' | 'severe' | 'moderate' | 'mild'
  lastRun: string
  status: 'ready' | 'running' | 'completed' | 'error'
}

interface ScenarioResult {
  scenarioId: string
  scenarioName: string
  runAt: string
  portfolioLoss: number
  portfolioLossPct: number
  varImpact: number
  marginImpact: number
  liquidityImpact: number
  greekImpact: { delta: number; gamma: number; vega: number; theta: number }
  positionBreakdown: PositionImpact[]
  worstPosition: string
  worstLoss: number
}

interface PositionImpact {
  symbol: string
  assetClass: string
  quantity: number
  baseValue: number
  stressedValue: number
  loss: number
  lossPct: number
}

interface CustomShock {
  factor: string
  shockType: 'absolute' | 'relative' | 'zscore'
  value: number
  description: string
}

interface HistoricalEvent {
  eventId: string
  name: string
  date: string
  duration: string
  spxReturn: number
  vixPeak: number
  portfolioImpact: number
  recoveryDays: number
  category: string
}

interface ComparisonRow {
  metric: string
  unit: string
  values: Record<string, number>
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

function SevBadge({ sev }: { sev: StressScenario['severity'] }) {
  const c = sev === 'extreme' ? '#b71c1c' : sev === 'severe' ? RED : sev === 'moderate' ? AMBER : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{sev.toUpperCase()}</span>
}

function CatBadge({ cat }: { cat: ScenarioCategory }) {
  const colors: Record<ScenarioCategory, string> = { historical: BLUE, custom: PURPLE, regulatory: ORANGE, macro: GREEN, geopolitical: RED, credit: AMBER }
  const c = colors[cat] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{cat.toUpperCase()}</span>
}

function LossBar({ lossPct }: { lossPct: number }) {
  const abs = Math.min(Math.abs(lossPct), 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 70, height: 6, background: BORDER, borderRadius: 3 }}>
        <div style={{ width: `${abs}%`, height: '100%', background: RED, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>{lossPct.toFixed(1)}%</span>
    </div>
  )
}

function fmtM(v: number) { return `${v >= 0 ? '+' : ''}$${Math.abs(v / 1e6).toFixed(2)}M` }


export function StressScenariosUI2() {
  const [tab, setTab] = useState<'scenarios' | 'results' | 'builder' | 'historical' | 'comparison'>('scenarios')
  const [scenarios, setScenarios] = useState<StressScenario[]>([])
  const [results, setResults] = useState<ScenarioResult[]>([])
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([])
  const [comparison, setComparison] = useState<ComparisonRow[]>([])
  const [customShocks, setCustomShocks] = useState<CustomShock[]>([
    { factor: 'Equity', shockType: 'relative', value: -0.2, description: '20% equity decline' },
    { factor: 'VIX', shockType: 'absolute', value: 20, description: 'VIX +20 pts' },
  ])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<ScenarioCategory | 'all'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rSc, rRe, rHi, rCo] = await Promise.allSettled([
        fetch('/api/v4/stress-scenarios/list').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/stress-scenarios/results').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/stress-scenarios/historical').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/stress-scenarios/comparison').then(r => r.ok ? r.json() : []),
      ])
      if (rSc.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rSc.value) ? rSc.value : rSc.value.scenarios ?? rSc.value.data ?? []
        setScenarios(raw.map((s: any) => ({
          scenarioId: s.scenario_id ?? s.id ?? '',
          name: s.name ?? '', category: (s.category ?? 'custom') as ScenarioCategory,
          description: s.description ?? '', shocks: s.shocks ?? {},
          duration: s.duration ?? '', probability: Number(s.probability ?? 0),
          severity: (s.severity ?? 'moderate') as StressScenario['severity'],
          lastRun: s.last_run ?? '', status: (s.status ?? 'ready') as StressScenario['status'],
        })))
        setErr(null)
      } else setErr('Failed to load stress scenarios')
      if (rRe.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rRe.value) ? rRe.value : rRe.value.results ?? rRe.value.data ?? []
        setResults(raw.map((r: any) => ({
          scenarioId: r.scenario_id ?? '', scenarioName: r.scenario_name ?? r.name ?? '',
          runAt: r.run_at ?? '', portfolioLoss: Number(r.portfolio_loss ?? 0),
          portfolioLossPct: Number(r.portfolio_loss_pct ?? 0),
          varImpact: Number(r.var_impact ?? 0), marginImpact: Number(r.margin_impact ?? 0),
          liquidityImpact: Number(r.liquidity_impact ?? 0),
          greekImpact: r.greek_impact ?? { delta: 0, gamma: 0, vega: 0, theta: 0 },
          positionBreakdown: Array.isArray(r.position_breakdown) ? r.position_breakdown.map((p: any) => ({
            symbol: p.symbol ?? '', assetClass: p.asset_class ?? '',
            quantity: Number(p.quantity ?? 0), baseValue: Number(p.base_value ?? 0),
            stressedValue: Number(p.stressed_value ?? 0), loss: Number(p.loss ?? 0),
            lossPct: Number(p.loss_pct ?? 0),
          })) : [],
          worstPosition: r.worst_position ?? '', worstLoss: Number(r.worst_loss ?? 0),
        })))
      }
      if (rHi.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rHi.value) ? rHi.value : rHi.value.events ?? rHi.value.data ?? []
        setHistoricalEvents(raw.map((e: any) => ({
          eventId: e.event_id ?? e.id ?? '', name: e.name ?? '',
          date: e.date ?? '', duration: e.duration ?? '',
          spxReturn: Number(e.spx_return ?? e.sp500_return ?? 0),
          vixPeak: Number(e.vix_peak ?? 0), portfolioImpact: Number(e.portfolio_impact ?? 0),
          recoveryDays: Number(e.recovery_days ?? 0), category: e.category ?? '',
        })))
      }
      if (rCo.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rCo.value) ? rCo.value : rCo.value.rows ?? rCo.value.data ?? []
        setComparison(raw.map((r: any) => ({
          metric: r.metric ?? '', unit: r.unit ?? '',
          values: r.values ?? {},
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const runScenario = async (id: string) => {
    setRunning(id)
    try {
      await fetch('/api/v4/stress-scenarios/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario_id: id }) })
      await fetchAll()
    } catch (e: any) { setErr(e.message) }
    setRunning(null)
  }

  const runCustom = async () => {
    setRunning('custom')
    try {
      await fetch('/api/v4/stress-scenarios/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shocks: customShocks }) })
      await fetchAll()
      setTab('results')
    } catch (e: any) { setErr(e.message) }
    setRunning(null)
  }

  const worstResult = results.length ? results.reduce((a, b) => b.portfolioLoss < a.portfolioLoss ? b : a, results[0]) : null
  const visScenarios = scenarios.filter(s => catFilter === 'all' || s.category === catFilter)
  const scenarioNames = comparison.length && comparison[0] ? Object.keys(comparison[0].values) : []

  const TABS = [
    { id: 'scenarios' as const, label: `SCENARIOS (${scenarios.length})` },
    { id: 'results' as const, label: `RESULTS (${results.length})` },
    { id: 'builder' as const, label: 'CUSTOM BUILDER' },
    { id: 'historical' as const, label: 'HISTORICAL REPLAY' },
    { id: 'comparison' as const, label: 'COMPARISON' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>STRS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>STRESS SCENARIOS — HISTORICAL REPLAY + CUSTOM SHOCK MODELING + COMPARISON</span>
        {worstResult && <span style={{ fontSize: 10, color: RED }}>WORST: {worstResult.scenarioName} → {fmtM(worstResult.portfolioLoss)}</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Scenarios" value={scenarios.length} />
        <StatCard label="Results Available" value={results.length} col={BLUE} />
        <StatCard label="Historical Events" value={historicalEvents.length} col={SUBTLE} />
        {worstResult ? <StatCard label="Worst Loss" value={fmtM(worstResult.portfolioLoss)} col={RED} sub={worstResult.scenarioName} /> : <StatCard label="Worst Loss" value="—" col={SUBTLE} />}
        <StatCard label="Avg Loss (Severe)" value={results.length ? fmtM(results.reduce((s, r) => s + r.portfolioLoss, 0) / results.length) : '—'} col={ORANGE} />
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
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading stress scenarios...</div>}

        {/* SCENARIOS */}
        {tab === 'scenarios' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['all', 'historical', 'custom', 'regulatory', 'macro', 'geopolitical', 'credit'] as const).map(c => (
                <button key={c} onClick={() => setCatFilter(c as any)}
                  style={{ fontFamily: MONO, fontSize: 10, color: catFilter === c ? AMBER : SUBTLE, background: catFilter === c ? AMBER + '22' : 'transparent', border: `1px solid ${catFilter === c ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 8 }}>
              {visScenarios.map(s => (
                <div key={s.scenarioId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <CatBadge cat={s.category} />
                    <SevBadge sev={s.severity} />
                    <span style={{ flex: 1, fontSize: 11, color: AMBER, fontWeight: 700 }}>{s.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8 }}>{s.description}</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Prob: <span style={{ color: TEXT }}>{(s.probability * 100).toFixed(1)}%</span></span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Duration: <span style={{ color: TEXT }}>{s.duration}</span></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>{s.lastRun ? `Last: ${s.lastRun}` : 'Never run'}</span>
                    <button onClick={() => runScenario(s.scenarioId)}
                      disabled={running === s.scenarioId}
                      style={{ fontFamily: MONO, fontSize: 10, color: running === s.scenarioId ? SUBTLE : AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                      {running === s.scenarioId ? 'RUNNING...' : 'RUN'}
                    </button>
                  </div>
                </div>
              ))}
              {visScenarios.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No scenarios</div>}
            </div>
          </>
        )}

        {/* RESULTS */}
        {tab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No results — run a scenario first</div>}
            {[...results].sort((a, b) => a.portfolioLoss - b.portfolioLoss).map((r, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>{r.scenarioName}</span>
                  <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: RED }}>{fmtM(r.portfolioLoss)}</span>
                  <LossBar lossPct={r.portfolioLossPct} />
                  <span style={{ flex: 1, textAlign: 'right', fontSize: 9, color: SUBTLE }}>{r.runAt}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>VaR Impact: <span style={{ color: ORANGE }}>{fmtM(r.varImpact)}</span></div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Margin Impact: <span style={{ color: AMBER }}>{fmtM(r.marginImpact)}</span></div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Liquidity: <span style={{ color: BLUE }}>{fmtM(r.liquidityImpact)}</span></div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Worst: <span style={{ color: RED }}>{r.worstPosition} ({fmtM(r.worstLoss)})</span></div>
                </div>
                {r.positionBreakdown.length > 0 && (
                  <div style={{ overflow: 'hidden', borderRadius: 3, border: `1px solid ${BORDER}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Symbol</Th><Th right>Base Value</Th><Th right>Stressed</Th><Th right>Loss</Th><Th>Loss %</Th></tr></thead>
                      <tbody>
                        {r.positionBreakdown.slice(0, 5).map((p, j) => (
                          <tr key={j}>
                            <Td mono col={AMBER}>{p.symbol}</Td>
                            <Td right mono>{fmtM(p.baseValue)}</Td>
                            <Td right mono col={BLUE}>{fmtM(p.stressedValue)}</Td>
                            <Td right mono col={RED}>{fmtM(p.loss)}</Td>
                            <Td><LossBar lossPct={p.lossPct} /></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CUSTOM BUILDER */}
        {tab === 'builder' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 12 }}>Define custom shocks for each risk factor and run a scenario against the current portfolio.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {customShocks.map((sh, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER, minWidth: 80 }}>{sh.factor}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', padding: '2px 5px', borderRadius: 2 }}>{sh.shockType.toUpperCase()}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: sh.value < 0 ? RED : GREEN, minWidth: 60 }}>{sh.value > 0 ? '+' : ''}{sh.value}</span>
                  <span style={{ fontSize: 10, color: SUBTLE, flex: 1 }}>{sh.description}</span>
                  <button onClick={() => setCustomShocks(cs => cs.filter((_, j) => j !== i))}
                    style={{ fontFamily: MONO, fontSize: 10, color: RED, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>REMOVE</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCustomShocks(cs => [...cs, { factor: 'New Factor', shockType: 'relative', value: -0.1, description: '' }])}
                style={{ fontFamily: MONO, fontSize: 11, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 3, padding: '6px 14px', cursor: 'pointer' }}>
                + ADD SHOCK
              </button>
              <button onClick={runCustom} disabled={running === 'custom' || customShocks.length === 0}
                style={{ fontFamily: MONO, fontSize: 11, color: running === 'custom' ? SUBTLE : AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '6px 16px', cursor: 'pointer', fontWeight: 700 }}>
                {running === 'custom' ? '⟳ RUNNING...' : '▶ RUN CUSTOM SCENARIO'}
              </button>
            </div>
          </div>
        )}

        {/* HISTORICAL REPLAY */}
        {tab === 'historical' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Event</Th><Th>Date</Th><Th>Duration</Th><Th>Category</Th>
                <Th right>SPX Return</Th><Th right>VIX Peak</Th><Th right>Portfolio Impact</Th><Th right>Recovery Days</Th>
              </tr></thead>
              <tbody>
                {historicalEvents.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No historical events</td></tr>}
                {[...historicalEvents].sort((a, b) => a.spxReturn - b.spxReturn).map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.name}</Td>
                    <Td mono col={SUBTLE}>{e.date}</Td>
                    <Td mono col={SUBTLE}>{e.duration}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{e.category.toUpperCase()}</span></Td>
                    <Td right mono col={e.spxReturn < 0 ? RED : GREEN}>{e.spxReturn > 0 ? '+' : ''}{(e.spxReturn * 100).toFixed(1)}%</Td>
                    <Td right mono col={ORANGE}>{e.vixPeak.toFixed(0)}</Td>
                    <Td right mono col={e.portfolioImpact < 0 ? RED : GREEN}>{fmtM(e.portfolioImpact)}</Td>
                    <Td right mono col={e.recoveryDays > 180 ? RED : e.recoveryDays > 90 ? AMBER : SUBTLE}>{e.recoveryDays}d</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* COMPARISON */}
        {tab === 'comparison' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            {comparison.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No comparison data</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <Th>Metric</Th><Th>Unit</Th>
                  {scenarioNames.map(n => <Th key={n} right>{n}</Th>)}
                </tr></thead>
                <tbody>
                  {comparison.map((row, i) => (
                    <tr key={i}>
                      <Td mono col={TEXT}>{row.metric}</Td>
                      <Td mono col={SUBTLE}>{row.unit}</Td>
                      {scenarioNames.map(n => {
                        const v = row.values[n] ?? 0
                        return <Td key={n} right mono col={v < 0 ? RED : v > 0 ? GREEN : SUBTLE}>{v > 0 ? '+' : ''}{row.unit === '%' ? (v * 100).toFixed(1) + '%' : v.toLocaleString()}</Td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
