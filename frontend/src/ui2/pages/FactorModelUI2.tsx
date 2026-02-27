import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// FactorModelUI2 — Bloomberg FACS-grade multi-factor risk model terminal
// Tabs: FACTOR MAP | EXPOSURES | RISK DECOMP | COVARIANCE | STRESS TEST
// APIs: /api/v4/factor-model/factors, /api/v4/factor-model/exposures,
//       /api/v4/factor-model/risk, /api/v4/factor-model/covariance,
//       /api/v4/factor-model/stress

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

interface Factor {
  id: string
  name: string
  category: 'style' | 'sector' | 'macro' | 'technical' | 'sentiment'
  value: number
  zScore: number
  return1d: number
  return5d: number
  return1m: number
  return3m: number
  volatility: number
  t_stat: number
  informationRatio: number
  cumReturn: number
}

interface Exposure {
  symbol: string
  sector: string
  factors: Record<string, number>
  specificRisk: number
  totalRisk: number
  factorRisk: number
  beta: number
  activeExposure: number
}

interface RiskDecomp {
  source: string
  contribution: number
  percent: number
  standalone: number
}

interface CovRow {
  factor: string
  values: Record<string, number>
}

interface StressScenario {
  scenario: string
  description: string
  portfolioImpact: number
  factorMoves: Record<string, number>
  probability: number
  historicalDate: string
}

// ── sub-components ────────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616` }}>{children}</td>
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

function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` }

function ZBar({ z }: { z: number }) {
  const pct = Math.min(100, Math.abs(z) * 20)
  const col = Math.abs(z) > 2 ? (z > 0 ? GREEN : RED) : Math.abs(z) > 1.5 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 50, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', [z >= 0 ? 'left' : 'right']: '50%', top: 0, width: `${pct / 2}%`, height: '100%', background: col }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BORDER + 'aa' }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col, minWidth: 36, textAlign: 'right' }}>{z.toFixed(2)}σ</span>
    </div>
  )
}

function catColor(cat: Factor['category']): string {
  return { style: BLUE, sector: ORANGE, macro: GREEN, technical: PURPLE, sentiment: AMBER }[cat] || SUBTLE
}

function CovarianceHeatmap({ rows }: { rows: CovRow[] }) {
  if (rows.length === 0) return null
  const factors = rows.map(r => r.factor)
  const maxVal = Math.max(...rows.flatMap(r => Object.values(r.values).map(Math.abs)), 0.0001)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 8, fontFamily: MONO }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 6px', color: SUBTLE, textAlign: 'right', minWidth: 80 }}></th>
            {factors.map(f => <th key={f} style={{ padding: '4px 4px', color: SUBTLE, transform: 'rotate(-30deg)', transformOrigin: 'bottom left', fontSize: 7, whiteSpace: 'nowrap', minWidth: 30 }}>{f.slice(0, 8)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.factor}>
              <td style={{ padding: '2px 6px', color: SUBTLE, textAlign: 'right', fontSize: 8 }}>{row.factor.slice(0, 10)}</td>
              {factors.map(col => {
                const v = row.values[col] ?? 0
                const intensity = Math.abs(v / maxVal)
                const bg = v > 0 ? `rgba(38,166,154,${intensity * 0.7})` : `rgba(239,83,80,${intensity * 0.7})`
                return (
                  <td key={col} style={{ width: 28, height: 22, background: bg, textAlign: 'center', fontSize: 6, color: TEXT, border: `1px solid ${BORDER}22` }}>
                    {v.toFixed(2)}
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


const FACTOR_CATEGORIES = ['all', 'style', 'sector', 'macro', 'technical', 'sentiment'] as const

export function FactorModelUI2() {
  const [tab, setTab] = useState<'factormap' | 'exposures' | 'riskdecomp' | 'covariance' | 'stress'>('factormap')
  const [factors, setFactors] = useState<Factor[]>([])
  const [exposures, setExposures] = useState<Exposure[]>([])
  const [riskDecomp, setRiskDecomp] = useState<RiskDecomp[]>([])
  const [covariance, setCovariance] = useState<CovRow[]>([])
  const [stress, setStress] = useState<StressScenario[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string>('all')
  const [sortCol, setSortCol] = useState<'zScore' | 'return1m' | 'informationRatio'>('zScore')
  const [selectedFactor, setSelectedFactor] = useState<Factor | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFactors = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/factor-model/factors')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.factors ?? d.data ?? []
      setFactors(raw.map((x: any) => ({
        id: x.id ?? x.factor_id ?? x.name ?? '',
        name: x.name ?? x.factor_name ?? '',
        category: (x.category ?? 'style') as Factor['category'],
        value: Number(x.value ?? 0),
        zScore: Number(x.z_score ?? x.zscore ?? 0),
        return1d: Number(x.return_1d ?? 0),
        return5d: Number(x.return_5d ?? 0),
        return1m: Number(x.return_1m ?? 0),
        return3m: Number(x.return_3m ?? 0),
        volatility: Number(x.volatility ?? x.vol ?? 0),
        t_stat: Number(x.t_stat ?? x.t_statistic ?? 0),
        informationRatio: Number(x.information_ratio ?? x.ir ?? 0),
        cumReturn: Number(x.cum_return ?? 0),
      })))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [])

  const fetchExposures = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/factor-model/exposures')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.exposures ?? d.data ?? []
      setExposures(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        sector: x.sector ?? '',
        factors: x.factors ?? x.factor_exposures ?? {},
        specificRisk: Number(x.specific_risk ?? 0),
        totalRisk: Number(x.total_risk ?? 0),
        factorRisk: Number(x.factor_risk ?? 0),
        beta: Number(x.beta ?? 0),
        activeExposure: Number(x.active_exposure ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchRisk = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/factor-model/risk')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.decomp ?? d.risk_decomposition ?? d.data ?? []
      setRiskDecomp(raw.map((x: any) => ({
        source: x.source ?? x.name ?? '',
        contribution: Number(x.contribution ?? 0),
        percent: Number(x.percent ?? x.pct ?? 0),
        standalone: Number(x.standalone ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  const fetchCovariance = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/factor-model/covariance')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.covariance ?? d.matrix ?? d.data ?? []
      setCovariance(raw.map((x: any) => ({
        factor: x.factor ?? x.name ?? '',
        values: x.values ?? x.covariance ?? {},
      })))
    } catch { /* empty */ }
  }, [])

  const fetchStress = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/factor-model/stress')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.scenarios ?? d.data ?? []
      setStress(raw.map((x: any) => ({
        scenario: x.scenario ?? x.name ?? '',
        description: x.description ?? '',
        portfolioImpact: Number(x.portfolio_impact ?? x.impact ?? 0),
        factorMoves: x.factor_moves ?? {},
        probability: Number(x.probability ?? x.prob ?? 0),
        historicalDate: x.historical_date ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchFactors(), fetchExposures(), fetchRisk(), fetchCovariance(), fetchStress()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(fetchFactors, 60000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchFactors, fetchExposures, fetchRisk, fetchCovariance, fetchStress])

  const filteredFactors = (catFilter === 'all' ? factors : factors.filter(f => f.category === catFilter))
    .sort((a, b) => Math.abs(b[sortCol]) - Math.abs(a[sortCol]))

  const totalFactorRisk = riskDecomp.reduce((s, r) => s + r.contribution, 0)
  const topZFactor = [...factors].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0]

  const tabs = [
    { id: 'factormap' as const, label: 'FACTOR MAP' },
    { id: 'exposures' as const, label: 'EXPOSURES' },
    { id: 'riskdecomp' as const, label: 'RISK DECOMP' },
    { id: 'covariance' as const, label: 'COVARIANCE' },
    { id: 'stress' as const, label: 'STRESS TEST' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>FACS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>MULTI-FACTOR RISK MODEL</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>{factors.length} factors loaded</span>
        {topZFactor && <span style={{ fontSize: 10, color: Math.abs(topZFactor.zScore) > 2 ? RED : SUBTLE }}>Top: {topZFactor.name} ({topZFactor.zScore.toFixed(2)}σ)</span>}
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Factors" value={factors.length} />
        <StatCard label="Style Factors" value={factors.filter(f => f.category === 'style').length} col={BLUE} />
        <StatCard label="Sector Factors" value={factors.filter(f => f.category === 'sector').length} col={ORANGE} />
        <StatCard label="Macro Factors" value={factors.filter(f => f.category === 'macro').length} col={GREEN} />
        <StatCard label="Exposures" value={exposures.length} />
        <StatCard label="Total Factor Risk" value={totalFactorRisk > 0 ? `${totalFactorRisk.toFixed(1)}%` : '—'} col={RED} />
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
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading factor model data...</div>}

        {/* ── FACTOR MAP ── */}
        {tab === 'factormap' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {FACTOR_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: catFilter === c ? '#000' : c === 'all' ? TEXT : catColor(c as Factor['category']),
                    background: catFilter === c ? (c === 'all' ? AMBER : catColor(c as Factor['category'])) : 'transparent',
                    border: `1px solid ${c === 'all' ? BORDER : catColor(c as Factor['category']) + '44'}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
              <span style={{ fontSize: 9, color: SUBTLE, margin: '0 8px' }}>SORT:</span>
              {(['zScore', 'return1m', 'informationRatio'] as const).map(s => (
                <button key={s} onClick={() => setSortCol(s)}
                  style={{ fontFamily: MONO, fontSize: 9, color: sortCol === s ? '#000' : TEXT, background: sortCol === s ? BLUE : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {s === 'zScore' ? 'Z-SCORE' : s === 'return1m' ? '1M RETURN' : 'IR'}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 14 }}>
              {filteredFactors.slice(0, 24).map(f => (
                <div key={f.id} onClick={() => setSelectedFactor(selectedFactor?.id === f.id ? null : f)}
                  style={{ background: selectedFactor?.id === f.id ? '#151515' : PANEL, border: `1px solid ${selectedFactor?.id === f.id ? AMBER + '66' : catColor(f.category) + '33'}`, borderRadius: 4, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: catColor(f.category), fontWeight: 700 }}>{f.name}</span>
                    <span style={{ fontSize: 8, color: catColor(f.category), background: catColor(f.category) + '22', padding: '1px 5px', borderRadius: 2 }}>{f.category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 7, color: SUBTLE }}>Z-SCORE</div>
                      <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: Math.abs(f.zScore) > 2 ? (f.zScore > 0 ? GREEN : RED) : TEXT }}>{f.zScore.toFixed(2)}σ</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: SUBTLE }}>1M RET</div>
                      <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: f.return1m >= 0 ? GREEN : RED }}>{fmtPct(f.return1m)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: SUBTLE }}>IR</div>
                      <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: f.informationRatio > 0 ? GREEN : RED }}>{f.informationRatio.toFixed(2)}</div>
                    </div>
                  </div>
                  <ZBar z={f.zScore} />
                </div>
              ))}
            </div>
            {selectedFactor && (
              <div style={{ background: PANEL, border: `1px solid ${AMBER}44`, borderRadius: 4, padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>{selectedFactor.name}</span>
                  <span style={{ fontSize: 9, color: catColor(selectedFactor.category), background: catColor(selectedFactor.category) + '22', padding: '2px 6px', borderRadius: 2 }}>{selectedFactor.category}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    ['Z-Score', `${selectedFactor.zScore.toFixed(3)}σ`, Math.abs(selectedFactor.zScore) > 2 ? (selectedFactor.zScore > 0 ? GREEN : RED) : TEXT],
                    ['T-Stat', selectedFactor.t_stat.toFixed(3), Math.abs(selectedFactor.t_stat) > 2 ? GREEN : SUBTLE],
                    ['1D Return', fmtPct(selectedFactor.return1d), selectedFactor.return1d >= 0 ? GREEN : RED],
                    ['5D Return', fmtPct(selectedFactor.return5d), selectedFactor.return5d >= 0 ? GREEN : RED],
                    ['1M Return', fmtPct(selectedFactor.return1m), selectedFactor.return1m >= 0 ? GREEN : RED],
                    ['3M Return', fmtPct(selectedFactor.return3m), selectedFactor.return3m >= 0 ? GREEN : RED],
                    ['Volatility', fmtPct(selectedFactor.volatility), SUBTLE],
                    ['Info Ratio', selectedFactor.informationRatio.toFixed(3), selectedFactor.informationRatio > 0 ? GREEN : RED],
                  ].map(([l, v, c]) => (
                    <StatCard key={l as string} label={l as string} value={v as string} col={c as string} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── EXPOSURES ── */}
        {tab === 'exposures' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Symbol</Th><Th>Sector</Th>
                  <Th right>Total Risk</Th><Th right>Factor Risk</Th><Th right>Specific Risk</Th>
                  <Th right>Beta</Th><Th right>Active Exp</Th>
                </tr>
              </thead>
              <tbody>
                {exposures.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No exposure data — check /api/v4/factor-model/exposures
                  </td></tr>
                )}
                {exposures.sort((a, b) => b.totalRisk - a.totalRisk).map(e => (
                  <tr key={e.symbol}>
                    <Td mono col={AMBER}>{e.symbol}</Td>
                    <Td col={SUBTLE}>{e.sector}</Td>
                    <Td right mono col={e.totalRisk > 30 ? RED : SUBTLE}>{e.totalRisk.toFixed(1)}%</Td>
                    <Td right mono col={BLUE}>{e.factorRisk.toFixed(1)}%</Td>
                    <Td right mono col={ORANGE}>{e.specificRisk.toFixed(1)}%</Td>
                    <Td right mono col={e.beta > 1.2 ? RED : e.beta < 0.8 ? GREEN : SUBTLE}>{e.beta.toFixed(2)}</Td>
                    <Td right mono col={e.activeExposure > 0 ? GREEN : RED}>{e.activeExposure.toFixed(3)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RISK DECOMP ── */}
        {tab === 'riskdecomp' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Risk Source Breakdown</div>
                {riskDecomp.map(r => {
                  const maxPct = Math.max(...riskDecomp.map(x => x.percent), 1)
                  return (
                    <div key={r.source} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: TEXT }}>{r.source}</span>
                        <span style={{ fontSize: 10, fontFamily: MONO, color: r.percent > 20 ? RED : r.percent > 10 ? AMBER : SUBTLE }}>{r.percent.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(r.percent / maxPct) * 100}%`, height: '100%', background: r.percent > 20 ? RED : r.percent > 10 ? AMBER : BLUE, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
                {riskDecomp.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No risk data — check /api/v4/factor-model/risk</div>}
              </div>
              <div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr><Th>Risk Source</Th><Th right>Contribution</Th><Th right>% of Total</Th><Th right>Standalone</Th></tr>
                    </thead>
                    <tbody>
                      {riskDecomp.sort((a, b) => b.percent - a.percent).map(r => (
                        <tr key={r.source}>
                          <Td mono col={AMBER}>{r.source}</Td>
                          <Td right mono col={r.contribution > 0 ? RED : GREEN}>{r.contribution.toFixed(2)}%</Td>
                          <Td right mono col={r.percent > 20 ? RED : SUBTLE}>{r.percent.toFixed(1)}%</Td>
                          <Td right mono col={SUBTLE}>{r.standalone.toFixed(2)}%</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── COVARIANCE ── */}
        {tab === 'covariance' && (
          <>
            <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 10 }}>Factor covariance matrix — green = positive correlation, red = negative</div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
              <CovarianceHeatmap rows={covariance} />
              {covariance.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No covariance data — check /api/v4/factor-model/covariance</div>}
            </div>
          </>
        )}

        {/* ── STRESS TEST ── */}
        {tab === 'stress' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Scenario</Th><Th>Description</Th>
                    <Th right>Portfolio Impact</Th><Th right>Probability</Th><Th right>Historical Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {stress.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No stress scenarios — check /api/v4/factor-model/stress
                    </td></tr>
                  )}
                  {stress.sort((a, b) => a.portfolioImpact - b.portfolioImpact).map((s, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{s.scenario}</Td>
                      <Td col={TEXT} small>{s.description}</Td>
                      <Td right mono col={s.portfolioImpact < -10 ? RED : s.portfolioImpact < 0 ? ORANGE : GREEN}>
                        {s.portfolioImpact >= 0 ? '+' : ''}{s.portfolioImpact.toFixed(2)}%
                      </Td>
                      <Td right mono col={SUBTLE}>{s.probability.toFixed(1)}%</Td>
                      <Td right mono col={SUBTLE}>{s.historicalDate || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
