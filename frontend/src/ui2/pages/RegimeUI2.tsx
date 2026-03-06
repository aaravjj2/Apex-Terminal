import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// RegimeUI2 — Bloomberg REGM-grade market regime detection terminal
// Tabs: CURRENT REGIME | HISTORY | TRANSITIONS | SIGNALS | MACRO OVERLAY
// APIs: /api/v4/regime/current, /api/v4/regime/history,
//       /api/v4/regime/transitions, /api/v4/regime/signals, /api/v4/regime/macro

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

type RegimeType = 'bull_trend' | 'bear_trend' | 'volatile' | 'low_vol_range' | 'high_vol_range' | 'crisis' | 'recovery' | 'neutral'

interface RegimeCurrent {
  symbol: string
  regime: RegimeType
  confidence: number
  startDate: string
  duration: number
  breakout: number
  momentum: number
  trend: number
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme'
  breadth: number
  description: string
  signals: string[]
}

interface RegimeHistory {
  startDate: string
  endDate: string
  regime: RegimeType
  duration: number
  return_: number
  volatility: number
  maxDrawdown: number
  sharpe: number
}

interface RegimeTransition {
  fromRegime: RegimeType
  toRegime: RegimeType
  probability: number
  avgDuration: number
  avgReturn: number
  historicalCount: number
}

interface RegimeSignal {
  name: string
  category: 'momentum' | 'breadth' | 'volatility' | 'technical' | 'macro'
  value: number
  signal: 'bullish' | 'bearish' | 'neutral'
  weight: number
  zscore: number
}

interface MacroOverlay {
  indicator: string
  value: number
  prior: number
  frequency: string
  regime_implication: 'positive' | 'negative' | 'neutral'
  surprise: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function regimeColor(r: RegimeType): string {
  const map: Record<RegimeType, string> = {
    bull_trend: GREEN, bear_trend: RED, volatile: AMBER, crisis: '#b71c1c',
    recovery: BLUE, low_vol_range: PURPLE, high_vol_range: ORANGE, neutral: SUBTLE,
  }
  return map[r] || SUBTLE
}

function RegimeBadge({ regime, conf }: { regime: RegimeType; conf?: number }) {
  const c = regimeColor(regime)
  const label = regime.replace(/_/g, ' ').toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: c, background: c + '22', padding: '2px 8px', borderRadius: 2, border: `1px solid ${c}44` }}>{label}</span>
      {conf !== undefined && <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{(conf * 100).toFixed(0)}%</span>}
    </div>
  )
}

function ConfBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function SignalCell({ signal }: { signal: RegimeSignal['signal'] }) {
  const c = signal === 'bullish' ? GREEN : signal === 'bearish' ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{signal.toUpperCase()}</span>
}

function fmtDate(s: string) { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) } catch { return s } }
function fmtPct(v: number) { return (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%' }


export function RegimeUI2() {
  const [tab, setTab] = useState<'current' | 'history' | 'transitions' | 'signals' | 'macro'>('current')
  const [regimes, setRegimes] = useState<RegimeCurrent[]>([])
  const [history, setHistory] = useState<RegimeHistory[]>([])
  const [transitions, setTransitions] = useState<RegimeTransition[]>([])
  const [signals, setSignals] = useState<RegimeSignal[]>([])
  const [macro, setMacro] = useState<MacroOverlay[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rCur, rHist, rTrans, rSig, rMac] = await Promise.allSettled([
        fetch('/api/v4/regime/current').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regime/history').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regime/transitions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regime/signals').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regime/macro').then(r => r.ok ? r.json() : []),
      ])
      if (rCur.status === 'fulfilled') {
        const d = rCur.value
        const raw: any[] = Array.isArray(d) ? d : d.regimes ?? d.data ?? []
        setRegimes(raw.map((x: any) => ({
          symbol: x.symbol ?? x.asset ?? 'MARKET',
          regime: (x.regime ?? 'neutral') as RegimeType,
          confidence: Number(x.confidence ?? 0),
          startDate: x.start_date ?? x.since ?? '',
          duration: Number(x.duration_days ?? x.duration ?? 0),
          breakout: Number(x.breakout ?? 0),
          momentum: Number(x.momentum ?? 0),
          trend: Number(x.trend ?? 0),
          volatilityRegime: (x.volatility_regime ?? 'normal') as RegimeCurrent['volatilityRegime'],
          breadth: Number(x.breadth ?? 0),
          description: x.description ?? '',
          signals: Array.isArray(x.signals) ? x.signals : [],
        })))
        setErr(null)
      } else { setErr('Failed to load regime data') }

      if (rHist.status === 'fulfilled') {
        const d = rHist.value
        const raw: any[] = Array.isArray(d) ? d : d.history ?? d.data ?? []
        setHistory(raw.map((x: any) => ({
          startDate: x.start_date ?? '', endDate: x.end_date ?? '',
          regime: (x.regime ?? 'neutral') as RegimeType,
          duration: Number(x.duration_days ?? x.duration ?? 0),
          return_: Number(x.return ?? x.total_return ?? 0),
          volatility: Number(x.volatility ?? x.annualized_vol ?? 0),
          maxDrawdown: Number(x.max_drawdown ?? 0),
          sharpe: Number(x.sharpe ?? 0),
        })))
      }

      if (rTrans.status === 'fulfilled') {
        const d = rTrans.value
        const raw: any[] = Array.isArray(d) ? d : d.transitions ?? d.data ?? []
        setTransitions(raw.map((x: any) => ({
          fromRegime: (x.from_regime ?? x.from ?? 'neutral') as RegimeType,
          toRegime: (x.to_regime ?? x.to ?? 'neutral') as RegimeType,
          probability: Number(x.probability ?? 0),
          avgDuration: Number(x.avg_duration_days ?? x.avg_duration ?? 0),
          avgReturn: Number(x.avg_return ?? 0),
          historicalCount: Number(x.historical_count ?? x.count ?? 0),
        })))
      }

      if (rSig.status === 'fulfilled') {
        const d = rSig.value
        const raw: any[] = Array.isArray(d) ? d : d.signals ?? d.data ?? []
        setSignals(raw.map((x: any) => ({
          name: x.name ?? '',
          category: (x.category ?? 'technical') as RegimeSignal['category'],
          value: Number(x.value ?? 0),
          signal: (x.signal ?? 'neutral') as RegimeSignal['signal'],
          weight: Number(x.weight ?? 1),
          zscore: Number(x.zscore ?? x.z_score ?? 0),
        })))
      }

      if (rMac.status === 'fulfilled') {
        const d = rMac.value
        const raw: any[] = Array.isArray(d) ? d : d.macro ?? d.data ?? []
        setMacro(raw.map((x: any) => ({
          indicator: x.indicator ?? x.name ?? '',
          value: Number(x.value ?? 0),
          prior: Number(x.prior ?? 0),
          frequency: x.frequency ?? 'monthly',
          regime_implication: (x.regime_implication ?? x.implication ?? 'neutral') as MacroOverlay['regime_implication'],
          surprise: Number(x.surprise ?? 0),
        })))
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchAll()
    pollRef.current = setInterval(fetchAll, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const market = regimes.find(r => r.symbol === 'MARKET' || r.symbol === 'SPY') ?? regimes[0]
  const bullCount = regimes.filter(r => r.regime === 'bull_trend' || r.regime === 'recovery').length
  const bearCount = regimes.filter(r => r.regime === 'bear_trend' || r.regime === 'crisis').length
  const sigBull = signals.filter(s => s.signal === 'bullish').length
  const sigBear = signals.filter(s => s.signal === 'bearish').length

  const selectedRegime = selected ? regimes.find(r => r.symbol === selected) : market

  const TABS = [
    { id: 'current' as const, label: 'CURRENT REGIME' },
    { id: 'history' as const, label: 'HISTORY' },
    { id: 'transitions' as const, label: 'TRANSITIONS' },
    { id: 'signals' as const, label: 'SIGNALS' },
    { id: 'macro' as const, label: 'MACRO OVERLAY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>REGM</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>MARKET REGIME DETECTION — ADAPTIVE MACRO INTELLIGENCE</span>
        {market && <RegimeBadge regime={market.regime} conf={market.confidence} />}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Symbols Analyzed" value={regimes.length} />
        <StatCard label="Bull Regime" value={bullCount} col={GREEN} sub="bull_trend + recovery" />
        <StatCard label="Bear Regime" value={bearCount} col={RED} sub="bear_trend + crisis" />
        <StatCard label="Sig Bullish" value={sigBull} col={GREEN} />
        <StatCard label="Sig Bearish" value={sigBear} col={RED} />
        {market && <StatCard label="Regime Confidence" value={`${(market.confidence * 100).toFixed(0)}%`} col={regimeColor(market.regime)} sub={market.regime.replace(/_/g, ' ')} />}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Detecting regimes...</div>}

        {/* â”€â”€ CURRENT REGIME â”€â”€ */}
        {tab === 'current' && (
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Symbol list */}
            <div style={{ width: 160, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6, letterSpacing: 1 }}>SYMBOLS</div>
              {regimes.map(r => (
                <div key={r.symbol} onClick={() => setSelected(r.symbol)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', borderRadius: 3,
                    background: (selected ?? market?.symbol) === r.symbol ? PANEL : 'transparent',
                    border: `1px solid ${(selected ?? market?.symbol) === r.symbol ? BORDER : 'transparent'}`,
                    marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: AMBER, minWidth: 40 }}>{r.symbol}</span>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: regimeColor(r.regime), flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: SUBTLE }}>{(r.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
              {regimes.length === 0 && <div style={{ color: SUBTLE, fontSize: 10, padding: 4 }}>No data yet</div>}
            </div>

            {/* Detail panel */}
            {selectedRegime && (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: AMBER }}>{selectedRegime.symbol}</span>
                  <RegimeBadge regime={selectedRegime.regime} conf={selectedRegime.confidence} />
                  <span style={{ fontSize: 10, color: SUBTLE }}>Since {fmtDate(selectedRegime.startDate)} Â· {selectedRegime.duration}d</span>
                </div>
                {selectedRegime.description && (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{selectedRegime.description}</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  <StatCard label="Confidence" value={`${(selectedRegime.confidence * 100).toFixed(0)}%`} col={regimeColor(selectedRegime.regime)} />
                  <StatCard label="Momentum" value={(selectedRegime.momentum * 100).toFixed(1) + '%'} col={selectedRegime.momentum > 0 ? GREEN : RED} />
                  <StatCard label="Trend Score" value={selectedRegime.trend.toFixed(2)} col={selectedRegime.trend > 0 ? GREEN : RED} />
                  <StatCard label="Breadth" value={`${(selectedRegime.breadth * 100).toFixed(0)}%`} col={selectedRegime.breadth > 0.5 ? GREEN : RED} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>CONFIDENCE GAUGE</div>
                    <ConfBar value={selectedRegime.confidence} color={regimeColor(selectedRegime.regime)} />
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>VOLATILITY REGIME</div>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      color: selectedRegime.volatilityRegime === 'extreme' ? RED : selectedRegime.volatilityRegime === 'high' ? ORANGE : selectedRegime.volatilityRegime === 'low' ? GREEN : SUBTLE }}>
                      {selectedRegime.volatilityRegime.toUpperCase()}
                    </span>
                  </div>
                </div>
                {selectedRegime.signals.length > 0 && (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>KEY SIGNALS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedRegime.signals.map((s, i) => (
                        <span key={i} style={{ fontSize: 10, color: TEXT, background: '#1a1a1a', padding: '3px 8px', borderRadius: 3, border: `1px solid ${BORDER}` }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Regime distribution panel */}
            <div style={{ width: 180, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6, letterSpacing: 1 }}>REGIME DISTRIBUTION</div>
              {(['bull_trend', 'bear_trend', 'volatile', 'recovery', 'crisis', 'neutral', 'low_vol_range', 'high_vol_range'] as RegimeType[]).map(r => {
                const cnt = regimes.filter(x => x.regime === r).length
                if (cnt === 0 && regimes.length > 0) return null
                const pct = regimes.length ? cnt / regimes.length : 0
                const c = regimeColor(r)
                return (
                  <div key={r} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: c }}>{r.replace(/_/g, ' ').toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: SUBTLE }}>{cnt}</span>
                    </div>
                    <div style={{ height: 4, background: BORDER, borderRadius: 2 }}>
                      <div style={{ width: `${pct * 100}%`, height: '100%', background: c, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* â”€â”€ HISTORY â”€â”€ */}
        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Start</Th><Th>End</Th><Th>Regime</Th><Th right>Duration</Th>
                  <Th right>Return</Th><Th right>Volatility</Th><Th right>Max DD</Th><Th right>Sharpe</Th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No history
                  </td></tr>
                )}
                {history.map((h, i) => (
                  <tr key={i}>
                    <Td mono col={SUBTLE}>{fmtDate(h.startDate)}</Td>
                    <Td mono col={SUBTLE}>{fmtDate(h.endDate)}</Td>
                    <Td><RegimeBadge regime={h.regime} /></Td>
                    <Td right mono>{h.duration}d</Td>
                    <Td right mono col={h.return_ > 0 ? GREEN : RED}>{fmtPct(h.return_)}</Td>
                    <Td right mono>{fmtPct(h.volatility)}</Td>
                    <Td right mono col={RED}>{fmtPct(h.maxDrawdown)}</Td>
                    <Td right mono col={h.sharpe > 1 ? GREEN : h.sharpe > 0 ? AMBER : RED}>{h.sharpe.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* â”€â”€ TRANSITIONS â”€â”€ */}
        {tab === 'transitions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>From Regime</Th><Th>To Regime</Th><Th right>Probability</Th><Th right>Avg Duration</Th>
                  <Th right>Avg Return</Th><Th right>Count</Th>
                </tr>
              </thead>
              <tbody>
                {transitions.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No transitions
                  </td></tr>
                )}
                {[...transitions].sort((a, b) => b.probability - a.probability).map((t, i) => (
                  <tr key={i}>
                    <Td><RegimeBadge regime={t.fromRegime} /></Td>
                    <Td><RegimeBadge regime={t.toRegime} /></Td>
                    <Td right>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2 }}>
                          <div style={{ width: `${t.probability * 100}%`, height: '100%', background: AMBER, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>{(t.probability * 100).toFixed(0)}%</span>
                      </div>
                    </Td>
                    <Td right mono>{t.avgDuration.toFixed(0)}d</Td>
                    <Td right mono col={t.avgReturn > 0 ? GREEN : RED}>{fmtPct(t.avgReturn)}</Td>
                    <Td right mono col={SUBTLE}>{t.historicalCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* â”€â”€ SIGNALS â”€â”€ */}
        {tab === 'signals' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {(['momentum', 'breadth', 'volatility', 'technical', 'macro'] as const).map(cat => {
                const catSigs = signals.filter(s => s.category === cat)
                const bull = catSigs.filter(s => s.signal === 'bullish').length
                const bear = catSigs.filter(s => s.signal === 'bearish').length
                return (
                  <div key={cat} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: GREEN, fontFamily: MONO }}>â–²{bull}</span>
                      <span style={{ fontSize: 12, color: RED, fontFamily: MONO }}>â–¼{bear}</span>
                      <span style={{ fontSize: 12, color: SUBTLE, fontFamily: MONO }}>â—‹{catSigs.length - bull - bear}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Signal Name</Th><Th>Category</Th><Th>Direction</Th>
                    <Th right>Value</Th><Th right>Z-Score</Th><Th right>Weight</Th>
                  </tr>
                </thead>
                <tbody>
                  {signals.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No signals
                    </td></tr>
                  )}
                  {[...signals].sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore)).map((s, i) => (
                    <tr key={i}>
                      <Td mono col={TEXT}>{s.name}</Td>
                      <Td><span style={{ fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{s.category}</span></Td>
                      <Td><SignalCell signal={s.signal} /></Td>
                      <Td right mono>{s.value.toFixed(4)}</Td>
                      <Td right mono col={Math.abs(s.zscore) > 2 ? AMBER : SUBTLE}>{s.zscore.toFixed(2)}Ïƒ</Td>
                      <Td right mono col={SUBTLE}>{s.weight.toFixed(2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ MACRO OVERLAY â”€â”€ */}
        {tab === 'macro' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Indicator</Th><Th right>Value</Th><Th right>Prior</Th><Th right>Change</Th>
                  <Th right>Surprise</Th><Th>Frequency</Th><Th>Regime Implication</Th>
                </tr>
              </thead>
              <tbody>
                {macro.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No macro data
                  </td></tr>
                )}
                {macro.map((m, i) => {
                  const chg = m.value - m.prior
                  const ic = m.regime_implication === 'positive' ? GREEN : m.regime_implication === 'negative' ? RED : SUBTLE
                  return (
                    <tr key={i}>
                      <Td mono col={TEXT}>{m.indicator}</Td>
                      <Td right mono>{m.value.toFixed(2)}</Td>
                      <Td right mono col={SUBTLE}>{m.prior.toFixed(2)}</Td>
                      <Td right mono col={chg > 0 ? GREEN : chg < 0 ? RED : SUBTLE}>{chg > 0 ? '+' : ''}{chg.toFixed(2)}</Td>
                      <Td right mono col={Math.abs(m.surprise) > 1 ? AMBER : SUBTLE}>{m.surprise > 0 ? '+' : ''}{m.surprise.toFixed(2)}Ïƒ</Td>
                      <Td><span style={{ fontSize: 9, color: SUBTLE }}>{m.frequency}</span></Td>
                      <Td><span style={{ fontSize: 9, color: ic, background: ic + '22', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>{m.regime_implication}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
