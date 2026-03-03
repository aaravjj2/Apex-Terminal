import React, { useState, useEffect, useCallback } from 'react'
﻿// WalkForwardV3UI2 â€” Bloomberg APEX Walk-Forward V3 terminal
// Walk-forward analysis, fold results, robustness matrix, sensitivity heatmap, parameter optimization
// Tabs: FOLDS | ROBUSTNESS | HEATMAP | PARAMETER OPT | AUDIT
// APIs: /api/v3/walkforward/run, /robustness, /heatmap, /optimize, /audit

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

interface WfFold {
  foldIdx: number
  trainStart: number
  trainEnd: number
  testStart: number
  testEnd: number
  trainReturn: number
  testReturn: number
  purgeBars: number
  sharpe: number | null
  maxDrawdown: number | null
}

interface WalkResult {
  configId: string
  strategy: string
  nFolds: number
  purgeBars: number
  folds: WfFold[]
  avgTrainReturn: number
  avgTestReturn: number
  overfitScore: number | null
}

interface RobRow {
  slippage: number
  spread: number
  delayBars: number
  liquidityCap: number
  baseReturn: number
  adjReturn: number
  delta: number
}

interface RobResult {
  configId: string
  baseReturn: number
  matrix: RobRow[]
  count: number
  robustnessScore: number
}

interface HeatmapRow { slippage: number; returnsBySpread: Record<string, number> }
interface HeatmapData { slippageLevels: number[]; spreadLevels: number[]; heatmap: HeatmapRow[] }

interface ParamOptResult {
  paramName: string
  value: number
  trainReturn: number
  testReturn: number
  sharpe: number
  rank: number
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
function Pct({ v }: { v: number }) {
  const col = v >= 0 ? GREEN : RED
  return <span style={{ color: col, fontFamily: MONO, fontSize: 11 }}>{v >= 0 ? '+' : ''}{(v * 100).toFixed(2)}%</span>
}


export function WalkForwardV3UI2() {
  const [tab, setTab] = useState<'folds' | 'robustness' | 'heatmap' | 'optimize' | 'audit'>('folds')
  const [walkResult, setWalkResult] = useState<WalkResult | null>(null)
  const [robResult, setRobResult] = useState<RobResult | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [paramOpt, setParamOpt] = useState<ParamOptResult[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [nFolds, setNFolds] = useState(4)
  const [purgeBars, setPurgeBars] = useState(2)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleRunWalk = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/v3/walkforward/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n_folds: nFolds, purge_bars: purgeBars }),
      })
      if (r.ok) {
        const d = await r.json()
        setWalkResult({
          configId: d.config_id ?? d.configId ?? '',
          strategy: d.strategy ?? '',
          nFolds: Number(d.n_folds ?? d.nFolds ?? nFolds),
          purgeBars: Number(d.purge_bars ?? d.purgeBars ?? purgeBars),
          avgTrainReturn: Number(d.avg_train_return ?? d.avgTrainReturn ?? 0),
          avgTestReturn: Number(d.avg_test_return ?? d.avgTestReturn ?? 0),
          overfitScore: d.overfit_score ?? d.overfitScore ?? null,
          folds: (d.folds ?? []).map((f: any) => ({
            foldIdx: Number(f.fold_idx ?? f.foldIdx ?? 0),
            trainStart: Number(f.train_start ?? f.trainStart ?? 0),
            trainEnd: Number(f.train_end ?? f.trainEnd ?? 0),
            testStart: Number(f.test_start ?? f.testStart ?? 0),
            testEnd: Number(f.test_end ?? f.testEnd ?? 0),
            trainReturn: Number(f.train_return ?? f.trainReturn ?? 0),
            testReturn: Number(f.test_return ?? f.testReturn ?? 0),
            purgeBars: Number(f.purge_bars ?? f.purgeBars ?? 0),
            sharpe: f.sharpe ?? null, maxDrawdown: f.max_drawdown ?? f.maxDrawdown ?? null,
          })),
        })
        setTab('folds')
      } else { const e = await r.json(); setErr(e.detail ?? 'Walk-forward failed') }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const handleRobustness = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/v3/walkforward/robustness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: walkResult?.configId ?? 'standalone' }),
      })
      if (r.ok) {
        const d = await r.json()
        setRobResult({
          configId: d.config_id ?? d.configId ?? '',
          baseReturn: Number(d.base_return ?? d.baseReturn ?? 0),
          count: Number(d.count ?? 0),
          robustnessScore: Number(d.robustness_score ?? d.robustnessScore ?? 0),
          matrix: (d.matrix ?? []).map((m: any) => ({
            slippage: Number(m.slippage ?? 0), spread: Number(m.spread ?? 0),
            delayBars: Number(m.delay_bars ?? m.delayBars ?? 0),
            liquidityCap: Number(m.liquidity_cap ?? m.liquidityCap ?? 0),
            baseReturn: Number(m.base_return ?? m.baseReturn ?? 0),
            adjReturn: Number(m.adj_return ?? m.adjReturn ?? 0),
            delta: Number(m.delta ?? 0),
          })),
        })
        setTab('robustness')
      } else setErr('Robustness failed')
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const handleHeatmap = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/v3/walkforward/heatmap')
      if (r.ok) {
        const d = await r.json()
        setHeatmap({
          slippageLevels: d.slippage_levels ?? d.slippageLevels ?? [],
          spreadLevels: d.spread_levels ?? d.spreadLevels ?? [],
          heatmap: (d.heatmap ?? []).map((row: any) => ({
            slippage: Number(row.slippage ?? 0),
            returnsBySpread: row.returns_by_spread ?? row.returnsBySpread ?? {},
          })),
        })
        setTab('heatmap')
      } else setErr('Heatmap load failed')
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const fetchOptAndAudit = useCallback(async () => {
    try {
      const [rO, rA] = await Promise.allSettled([
        fetch('/api/v3/walkforward/optimize').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/walkforward/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rO.status === 'fulfilled') {
        const raw = Array.isArray(rO.value) ? rO.value : rO.value.results ?? rO.value.data ?? []
        setParamOpt(raw.map((p: any) => ({
          paramName: p.param_name ?? p.paramName ?? '',
          value: Number(p.value ?? 0), trainReturn: Number(p.train_return ?? p.trainReturn ?? 0),
          testReturn: Number(p.test_return ?? p.testReturn ?? 0),
          sharpe: Number(p.sharpe ?? 0), rank: Number(p.rank ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch {}
  }, [])

  useEffect(() => { fetchOptAndAudit() }, [fetchOptAndAudit])

  const avgTestReturn = walkResult ? walkResult.avgTestReturn : null
  const TABS2 = [
    { id: 'folds' as const, label: 'FOLDS' },
    { id: 'robustness' as const, label: 'ROBUSTNESS' },
    { id: 'heatmap' as const, label: 'HEATMAP' },
    { id: 'optimize' as const, label: 'PARAMETER OPT' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>WALK-FORWARD V3 â€” FOLD ANALYSIS + ROBUSTNESS MATRIX + SENSITIVITY HEATMAP + PARAM OPTIMIZATION</span>
        {loading && <span style={{ fontSize: 10, color: AMBER }}>RUNNINGâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Folds" value={walkResult ? walkResult.nFolds : 'â€”'} col={BLUE} />
        <StatCard label="Avg Train Ret." value={walkResult ? `${(walkResult.avgTrainReturn * 100).toFixed(2)}%` : 'â€”'} col={walkResult ? (walkResult.avgTrainReturn >= 0 ? GREEN : RED) : SUBTLE} />
        <StatCard label="Avg Test Ret." value={avgTestReturn !== null ? `${(avgTestReturn * 100).toFixed(2)}%` : 'â€”'} col={avgTestReturn !== null ? (avgTestReturn >= 0 ? GREEN : RED) : SUBTLE} />
        <StatCard label="Overfit Score" value={walkResult?.overfitScore !== null && walkResult?.overfitScore !== undefined ? walkResult.overfitScore.toFixed(3) : 'â€”'} col={AMBER} />
        <StatCard label="Robustness" value={robResult ? `${(robResult.robustnessScore * 100).toFixed(1)}%` : 'â€”'} col={robResult ? (robResult.robustnessScore >= 0.7 ? GREEN : RED) : SUBTLE} />
        <StatCard label="Matrix Rows" value={robResult ? robResult.count : 'â€”'} col={PURPLE} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, alignItems: 'center', gap: 12, padding: '4px 8px' }}>
        {TABS2.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: SUBTLE }}>Folds</label>
          <input type="number" min={2} max={10} value={nFolds} onChange={e => setNFolds(Number(e.target.value))}
            style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '3px 6px', width: 44, borderRadius: 3 }} />
          <label style={{ fontSize: 10, color: SUBTLE }}>Purge</label>
          <input type="number" min={0} max={10} value={purgeBars} onChange={e => setPurgeBars(Number(e.target.value))}
            style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '3px 6px', width: 44, borderRadius: 3 }} />
          {[{ label: 'RUN WALK', onClick: handleRunWalk, col: BLUE }, { label: 'ROBUSTNESS', onClick: handleRobustness, col: PURPLE }, { label: 'HEATMAP', onClick: handleHeatmap, col: GREEN }].map(btn => (
            <button key={btn.label} onClick={btn.onClick} disabled={loading}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: btn.col, background: btn.col + '22', border: `1px solid ${btn.col}44`, borderRadius: 3, padding: '4px 10px', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'folds' && (
          <div>
            {!walkResult && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No walk-forward results â€” click RUN WALK or check /api/v3/walkforward/run</div>}
            {walkResult && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th right>Fold</Th><Th right>Train Start</Th><Th right>Train End</Th><Th right>Purge</Th><Th right>Test Start</Th><Th right>Test End</Th><Th right>Train Ret.</Th><Th right>Test Ret.</Th><Th right>Sharpe</Th><Th right>Max DD</Th></tr></thead>
                  <tbody>
                    {walkResult.folds.map((f, i) => (
                      <tr key={i}>
                        <Td right mono col={AMBER}>{f.foldIdx}</Td>
                        <Td right mono col={SUBTLE}>{f.trainStart}</Td>
                        <Td right mono col={SUBTLE}>{f.trainEnd}</Td>
                        <Td right mono col={SUBTLE}>{f.purgeBars}</Td>
                        <Td right mono col={SUBTLE}>{f.testStart}</Td>
                        <Td right mono col={SUBTLE}>{f.testEnd}</Td>
                        <Td right><Pct v={f.trainReturn} /></Td>
                        <Td right><Pct v={f.testReturn} /></Td>
                        <Td right mono col={f.sharpe !== null ? (f.sharpe >= 1 ? GREEN : f.sharpe >= 0 ? AMBER : RED) : SUBTLE}>{f.sharpe !== null ? f.sharpe.toFixed(2) : 'â€”'}</Td>
                        <Td right mono col={f.maxDrawdown !== null && f.maxDrawdown < -0.2 ? RED : AMBER}>{f.maxDrawdown !== null ? `${(f.maxDrawdown * 100).toFixed(1)}%` : 'â€”'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'robustness' && (
          <div>
            {!robResult && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No robustness results â€” click ROBUSTNESS</div>}
            {robResult && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th right>Slippage</Th><Th right>Spread</Th><Th right>Delay Bars</Th><Th right>Liq Cap</Th><Th right>Base Ret.</Th><Th right>Adj Ret.</Th><Th right>Delta</Th></tr></thead>
                  <tbody>
                    {robResult.matrix.map((r, i) => (
                      <tr key={i}>
                        <Td right mono col={TEXT}>{r.slippage}</Td>
                        <Td right mono col={TEXT}>{r.spread}</Td>
                        <Td right mono col={TEXT}>{r.delayBars}</Td>
                        <Td right mono col={TEXT}>{r.liquidityCap}</Td>
                        <Td right><Pct v={r.baseReturn} /></Td>
                        <Td right><Pct v={r.adjReturn} /></Td>
                        <Td right mono col={r.delta >= 0 ? GREEN : RED}>{r.delta >= 0 ? '+' : ''}{(r.delta * 100).toFixed(2)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'heatmap' && (
          <div>
            {!heatmap && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No heatmap data â€” click HEATMAP</div>}
            {heatmap && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Slip \ Spread</Th>
                      {heatmap.spreadLevels.map(s => <Th key={s} right>{s}</Th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.heatmap.map((row, i) => (
                      <tr key={i}>
                        <Td mono col={AMBER}>{row.slippage}</Td>
                        {heatmap.spreadLevels.map(s => {
                          const val = Number(row.returnsBySpread[String(s)] ?? 0)
                          const intensity = Math.min(Math.abs(val) * 500, 80)
                          const bg = val >= 0 ? `rgba(38,166,154,${intensity / 100})` : `rgba(239,83,80,${intensity / 100})`
                          return <td key={s} style={{ fontFamily: MONO, fontSize: 11, padding: '4px 10px', background: bg, textAlign: 'right', color: TEXT, borderBottom: `1px solid #161616` }}>{val >= 0 ? '+' : ''}{(val * 100).toFixed(2)}%</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'optimize' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Param Name</Th><Th right>Value</Th><Th right>Train Ret.</Th><Th right>Test Ret.</Th><Th right>Sharpe</Th><Th right>Rank</Th></tr></thead>
              <tbody>
                {paramOpt.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No optimization results â€” check /api/v3/walkforward/optimize</td></tr>}
                {paramOpt.sort((a, b) => a.rank - b.rank).map((p, i) => (
                  <tr key={i}>
                    <Td mono col={BLUE}>{p.paramName}</Td>
                    <Td right mono col={TEXT}>{p.value}</Td>
                    <Td right><Pct v={p.trainReturn} /></Td>
                    <Td right><Pct v={p.testReturn} /></Td>
                    <Td right mono col={p.sharpe >= 1 ? GREEN : p.sharpe >= 0 ? AMBER : RED}>{p.sharpe.toFixed(2)}</Td>
                    <Td right mono col={p.rank <= 3 ? AMBER : TEXT}>#{p.rank}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v3/walkforward/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || 'â€”'}</Td>
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
