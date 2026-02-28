import React, { useState, useEffect, useCallback } from 'react'
﻿// StrategySimUI2 — Bloomberg APEX strategy simulation terminal
// Monte Carlo analysis, walk-forward testing, scenario runs, waveform analytics
// Tabs: SIMULATIONS | MONTE CARLO | WALK-FORWARD | SCENARIOS | AUDIT
// APIs: /api/v4/strategy-sim/simulations, /monte-carlo, /walk-forward, /scenarios, /audit

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

interface StrategySim {
  simId: string
  strategyName: string
  universe: string
  simType: 'backtest' | 'forward' | 'monte_carlo' | 'walk_forward' | 'stress'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  startDate: string
  endDate: string
  totalReturn: number
  sharpeRatio: number
  maxDrawdownPct: number
  annualizedVolPct: number
  calmarRatio: number
  durationSecs: number
  iterationsTotal: number
}

interface MonteCarloResult {
  runId: string
  simId: string
  percentile: number
  totalReturn: number
  maxDrawdown: number
  sharpeRatio: number
  finalPortfolioValue: number
  probability: number
}

interface WalkForwardWindow {
  windowId: string
  simId: string
  windowStart: string
  windowEnd: string
  inSampleStart: string
  inSampleEnd: string
  outOfSampleReturn: number
  inSampleReturn: number
  oosSharpe: number
  isSharpe: number
  degradationPct: number
  passed: boolean
}

interface SimScenario {
  scenarioId: string
  name: string
  type: 'historical' | 'hypothetical' | 'stress' | 'reverse'
  shockDescription: string
  portfolioImpact: number
  maxLoss: number
  recoveryDays: number
  probability: number
  severityLevel: 'mild' | 'moderate' | 'severe' | 'extreme'
}

interface StrategySimAuditEntry {
  auditId: string
  simId: string
  action: string
  actor: string
  detail: string
  timestamp: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { queued: BLUE, running: AMBER, completed: GREEN, failed: RED, cancelled: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SimTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { backtest: BLUE, forward: GREEN, monte_carlo: PURPLE, walk_forward: AMBER, stress: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.replace('_', ' ').toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { mild: GREEN, moderate: AMBER, severe: ORANGE, extreme: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function Pct({ v, invert }: { v: number; invert?: boolean }) {
  const isGood = invert ? v < 0 : v > 0
  return <span style={{ fontFamily: MONO, fontSize: 11, color: isGood ? GREEN : v === 0 ? SUBTLE : RED }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}


export function StrategySimUI2() {
  const [tab, setTab] = useState<'simulations' | 'monte-carlo' | 'walk-forward' | 'scenarios' | 'audit'>('simulations')
  const [simulations, setSimulations] = useState<StrategySim[]>([])
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult[]>([])
  const [walkForward, setWalkForward] = useState<WalkForwardWindow[]>([])
  const [scenarios, setScenarios] = useState<SimScenario[]>([])
  const [auditLog, setAuditLog] = useState<StrategySimAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rM, rW, rSc, rA] = await Promise.allSettled([
        fetch('/api/v4/strategy-sim/simulations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/strategy-sim/monte-carlo').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/strategy-sim/walk-forward').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/strategy-sim/scenarios').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/strategy-sim/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.simulations ?? rS.value.data ?? []
        setSimulations(raw.map((s: any) => ({
          simId: s.sim_id ?? s.simId ?? '', strategyName: s.strategy_name ?? s.strategyName ?? '',
          universe: s.universe ?? '', simType: s.sim_type ?? s.simType ?? 'backtest',
          status: s.status ?? 'queued', startDate: s.start_date ?? s.startDate ?? '',
          endDate: s.end_date ?? s.endDate ?? '', totalReturn: Number(s.total_return ?? s.totalReturn ?? 0),
          sharpeRatio: Number(s.sharpe_ratio ?? s.sharpeRatio ?? 0),
          maxDrawdownPct: Number(s.max_drawdown_pct ?? s.maxDrawdownPct ?? 0),
          annualizedVolPct: Number(s.annualized_vol_pct ?? s.annualizedVolPct ?? 0),
          calmarRatio: Number(s.calmar_ratio ?? s.calmarRatio ?? 0),
          durationSecs: Number(s.duration_secs ?? s.durationSecs ?? 0),
          iterationsTotal: Number(s.iterations_total ?? s.iterationsTotal ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load simulations')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.runs ?? rM.value.data ?? []
        setMonteCarlo(raw.map((m: any) => ({
          runId: m.run_id ?? m.runId ?? '', simId: m.sim_id ?? m.simId ?? '',
          percentile: Number(m.percentile ?? 0), totalReturn: Number(m.total_return ?? m.totalReturn ?? 0),
          maxDrawdown: Number(m.max_drawdown ?? m.maxDrawdown ?? 0),
          sharpeRatio: Number(m.sharpe_ratio ?? m.sharpeRatio ?? 0),
          finalPortfolioValue: Number(m.final_portfolio_value ?? m.finalPortfolioValue ?? 0),
          probability: Number(m.probability ?? 0),
        })))
      }
      if (rW.status === 'fulfilled') {
        const raw = Array.isArray(rW.value) ? rW.value : rW.value.windows ?? rW.value.data ?? []
        setWalkForward(raw.map((w: any) => ({
          windowId: w.window_id ?? w.windowId ?? '', simId: w.sim_id ?? w.simId ?? '',
          windowStart: w.window_start ?? w.windowStart ?? '', windowEnd: w.window_end ?? w.windowEnd ?? '',
          inSampleStart: w.in_sample_start ?? w.inSampleStart ?? '',
          inSampleEnd: w.in_sample_end ?? w.inSampleEnd ?? '',
          outOfSampleReturn: Number(w.out_of_sample_return ?? w.outOfSampleReturn ?? 0),
          inSampleReturn: Number(w.in_sample_return ?? w.inSampleReturn ?? 0),
          oosSharpe: Number(w.oos_sharpe ?? w.oosSharpe ?? 0),
          isSharpe: Number(w.is_sharpe ?? w.isSharpe ?? 0),
          degradationPct: Number(w.degradation_pct ?? w.degradationPct ?? 0),
          passed: Boolean(w.passed),
        })))
      }
      if (rSc.status === 'fulfilled') {
        const raw = Array.isArray(rSc.value) ? rSc.value : rSc.value.scenarios ?? rSc.value.data ?? []
        setScenarios(raw.map((s: any) => ({
          scenarioId: s.scenario_id ?? s.scenarioId ?? '', name: s.name ?? '',
          type: s.type ?? 'historical', shockDescription: s.shock_description ?? s.shockDescription ?? '',
          portfolioImpact: Number(s.portfolio_impact ?? s.portfolioImpact ?? 0),
          maxLoss: Number(s.max_loss ?? s.maxLoss ?? 0),
          recoveryDays: Number(s.recovery_days ?? s.recoveryDays ?? 0),
          probability: Number(s.probability ?? 0), severityLevel: s.severity_level ?? s.severityLevel ?? 'moderate',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', simId: a.sim_id ?? a.simId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const runningCount = simulations.filter(s => s.status === 'running').length
  const avgSharpe = simulations.filter(s => s.status === 'completed').reduce((a, s, _, arr) => a + s.sharpeRatio / arr.length, 0)
  const failedWindows = walkForward.filter(w => !w.passed).length
  const extremeScenarios = scenarios.filter(s => s.severityLevel === 'extreme').length

  const TABS2 = [
    { id: 'simulations' as const, label: 'SIMULATIONS' },
    { id: 'monte-carlo' as const, label: 'MONTE CARLO' },
    { id: 'walk-forward' as const, label: 'WALK-FORWARD' },
    { id: 'scenarios' as const, label: 'SCENARIOS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>STRATEGY SIMULATION — MONTE CARLO + WALK-FORWARD + SCENARIO ANALYSIS</span>
        {runningCount > 0 && <span style={{ fontSize: 10, color: AMBER }}>▶ {runningCount} RUNNING</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Simulations" value={simulations.length} col={BLUE} />
        <StatCard label="Running" value={runningCount} col={runningCount > 0 ? AMBER : SUBTLE} />
        <StatCard label="Avg Sharpe (Completed)" value={avgSharpe.toFixed(3)} col={avgSharpe > 1 ? GREEN : avgSharpe > 0 ? AMBER : RED} />
        <StatCard label="Failed WF Windows" value={failedWindows} col={failedWindows > 0 ? ORANGE : GREEN} />
        <StatCard label="Extreme Scenarios" value={extremeScenarios} col={extremeScenarios > 0 ? RED : GREEN} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS2.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'simulations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Strategy</Th><Th>Universe</Th><Th>Type</Th><Th>Status</Th><Th right>Return %</Th><Th right>Sharpe</Th><Th right>Max DD %</Th><Th right>Vol %</Th><Th right>Calmar</Th><Th>Period</Th></tr></thead>
              <tbody>
                {simulations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No simulations — check /api/v4/strategy-sim/simulations</td></tr>}
                {simulations.sort((a, b) => b.sharpeRatio - a.sharpeRatio).map((s, i) => (
                  <tr key={i} style={{ background: s.status === 'running' ? AMBER + '06' : s.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.strategyName}</Td>
                    <Td mono col={BLUE}>{s.universe}</Td>
                    <Td><SimTypeBadge t={s.simType} /></Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td right><Pct v={s.totalReturn} /></Td>
                    <Td right mono col={s.sharpeRatio > 1.5 ? GREEN : s.sharpeRatio > 0.5 ? AMBER : RED}>{s.sharpeRatio.toFixed(3)}</Td>
                    <Td right mono col={s.maxDrawdownPct > 20 ? RED : s.maxDrawdownPct > 10 ? AMBER : GREEN}>{s.maxDrawdownPct.toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{s.annualizedVolPct.toFixed(2)}%</Td>
                    <Td right mono col={s.calmarRatio > 1 ? GREEN : AMBER}>{s.calmarRatio.toFixed(3)}</Td>
                    <Td mono col={SUBTLE}>{s.startDate} → {s.endDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'monte-carlo' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Sim ID</Th><Th right>Percentile</Th><Th right>Return %</Th><Th right>Max DD %</Th><Th right>Sharpe</Th><Th right>Final Value</Th><Th right>Probability</Th></tr></thead>
              <tbody>
                {monteCarlo.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No Monte Carlo results — check /api/v4/strategy-sim/monte-carlo</td></tr>}
                {monteCarlo.sort((a, b) => b.percentile - a.percentile).map((m, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{m.runId}</Td>
                    <Td mono col={BLUE}>{m.simId}</Td>
                    <Td right mono col={m.percentile >= 75 ? GREEN : m.percentile >= 50 ? AMBER : RED}>{m.percentile}th</Td>
                    <Td right><Pct v={m.totalReturn} /></Td>
                    <Td right mono col={m.maxDrawdown > 20 ? RED : AMBER}>{m.maxDrawdown.toFixed(2)}%</Td>
                    <Td right mono col={m.sharpeRatio > 1 ? GREEN : SUBTLE}>{m.sharpeRatio.toFixed(3)}</Td>
                    <Td right mono col={TEXT}>${m.finalPortfolioValue.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{(m.probability * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'walk-forward' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Window</Th><Th>Sim ID</Th><Th>Period</Th><Th>Pass</Th><Th right>IS Return</Th><Th right>OOS Return</Th><Th right>IS Sharpe</Th><Th right>OOS Sharpe</Th><Th right>Degradation %</Th></tr></thead>
              <tbody>
                {walkForward.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No walk-forward data — check /api/v4/strategy-sim/walk-forward</td></tr>}
                {walkForward.map((w, i) => (
                  <tr key={i} style={{ background: !w.passed ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{w.windowId}</Td>
                    <Td mono col={BLUE}>{w.simId}</Td>
                    <Td mono col={SUBTLE}>{w.windowStart} → {w.windowEnd}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: w.passed ? GREEN : RED }}>{w.passed ? '✓ PASS' : '✗ FAIL'}</span></Td>
                    <Td right><Pct v={w.inSampleReturn} /></Td>
                    <Td right><Pct v={w.outOfSampleReturn} /></Td>
                    <Td right mono col={w.isSharpe > 1 ? GREEN : SUBTLE}>{w.isSharpe.toFixed(3)}</Td>
                    <Td right mono col={w.oosSharpe > 0.5 ? GREEN : RED}>{w.oosSharpe.toFixed(3)}</Td>
                    <Td right mono col={w.degradationPct > 20 ? RED : w.degradationPct > 10 ? AMBER : GREEN}>{w.degradationPct.toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'scenarios' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Scenario</Th><Th>Type</Th><Th>Severity</Th><Th>Shock</Th><Th right>Portfolio Impact</Th><Th right>Max Loss</Th><Th right>Recovery Days</Th><Th right>Probability</Th></tr></thead>
              <tbody>
                {scenarios.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No scenarios — check /api/v4/strategy-sim/scenarios</td></tr>}
                {scenarios.sort((a, b) => b.maxLoss - a.maxLoss).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td mono col={BLUE}>{s.type.toUpperCase()}</Td>
                    <Td><SevBadge s={s.severityLevel} /></Td>
                    <Td mono col={SUBTLE}>{s.shockDescription.length > 40 ? s.shockDescription.slice(0, 40) + '…' : s.shockDescription}</Td>
                    <Td right><Pct v={s.portfolioImpact} invert /></Td>
                    <Td right mono col={RED}>{s.maxLoss.toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{s.recoveryDays}</Td>
                    <Td right mono col={SUBTLE}>{(s.probability * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Sim ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/strategy-sim/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.simId || '—'}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || '—'}</Td>
                    <Td mono col={SUBTLE}>{a.timestamp}</Td>
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
