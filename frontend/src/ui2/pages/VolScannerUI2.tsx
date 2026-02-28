import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// VolScannerUI2 â€” Bloomberg OVML-grade volatility scanner terminal
// Tabs: SCANNER | IV RANK | SURFACE ALERTS | UNUSUAL ACTIVITY | TERM STRUCTURE
// APIs: /api/v4/vol-scanner/scan, /api/v4/vol-scanner/iv-rank,
//       /api/v4/vol-scanner/alerts, /api/v4/vol-scanner/unusual,
//       /api/v4/vol-scanner/term-structure

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

interface VolScanResult {
  symbol: string
  ivCurrent: number
  ivRank: number
  ivPercentile: number
  hv20: number
  hv60: number
  ivHvSpread: number
  skew: number
  termSlope: number
  callIv: number
  putIv: number
  atmIv: number
  putCallSkew: number
  signal: 'buy_vol' | 'sell_vol' | 'fade_skew' | 'fly' | 'neutral'
  score: number
  unusualActivity: boolean
  volumeRatio: number
  openInterestChange: number
  sector: string
}

interface IvRankEntry {
  symbol: string
  ivRank: number
  ivPercentile: number
  currentIv: number
  iv52wHigh: number
  iv52wLow: number
  iv52wAvg: number
  dteTarget: number
  regime: 'high' | 'normal' | 'low' | 'extreme_high' | 'extreme_low'
}

interface VolAlert {
  id: string
  symbol: string
  type: 'iv_spike' | 'iv_crush' | 'skew_shift' | 'unusual_call' | 'unusual_put' | 'term_inversion'
  severity: 'high' | 'medium' | 'low'
  message: string
  value: number
  threshold: number
  timestamp: string
}

interface UnusualActivity {
  symbol: string
  strike: number
  expiry: string
  optionType: 'call' | 'put'
  volume: number
  openInterest: number
  volToOi: number
  premium: number
  iv: number
  bid: number
  ask: number
  flags: string[]
  reportTime: string
}

interface TermStructurePoint {
  symbol: string
  dte: number
  iv: number
  forwardIv: number
  slope: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function SignalBadge({ signal }: { signal: VolScanResult['signal'] }) {
  const map: Record<string, [string, string]> = {
    buy_vol: [GREEN, 'BUY VOL'], sell_vol: [RED, 'SELL VOL'],
    fade_skew: [PURPLE, 'FADE SKEW'], fly: [BLUE, 'FLY'], neutral: [SUBTLE, 'NEUTRAL'],
  }
  const [c, l] = map[signal] ?? [SUBTLE, signal.toUpperCase()]
  return <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44` }}>{l}</span>
}

function SeverityBadge({ severity }: { severity: VolAlert['severity'] }) {
  const c = severity === 'high' ? RED : severity === 'medium' ? AMBER : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2, border: `1px solid ${c}44`, textTransform: 'uppercase' }}>{severity}</span>
}

function RegimeBadge({ regime }: { regime: IvRankEntry['regime'] }) {
  const map: Record<string, string> = { high: RED, normal: SUBTLE, low: GREEN, extreme_high: '#b71c1c', extreme_low: '#00e676' }
  const c = map[regime] || SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2, border: `1px solid ${c}44` }}>{regime.replace('_', ' ').toUpperCase()}</span>
}

function IvRankGauge({ rank }: { rank: number }) {
  const col = rank > 70 ? RED : rank > 50 ? AMBER : rank < 30 ? GREEN : SUBTLE
  const pct = Math.min(100, Math.max(0, rank))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: col, minWidth: 32 }}>{rank.toFixed(0)}</span>
    </div>
  )
}

function fmtTime(ts: string) {
  if (!ts) return 'â€”'
  try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) } catch { return ts }
}


export function VolScannerUI2() {
  const [tab, setTab] = useState<'scanner' | 'ivrank' | 'alerts' | 'unusual' | 'term'>('scanner')
  const [scanResults, setScanResults] = useState<VolScanResult[]>([])
  const [ivRanks, setIvRanks] = useState<IvRankEntry[]>([])
  const [alerts, setAlerts] = useState<VolAlert[]>([])
  const [unusual, setUnusual] = useState<UnusualActivity[]>([])
  const [termStructure, setTermStructure] = useState<TermStructurePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [minScore, setMinScore] = useState(0)
  const [unusualFilter, setUnusualFilter] = useState<'all' | 'call' | 'put'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchScan = useCallback(async () => {
    try {
      const r = await fetch(`/api/v4/vol-scanner/scan?min_score=${minScore}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.results ?? d.signals ?? d.data ?? []
      setScanResults(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        ivCurrent: Number(x.iv_current ?? x.current_iv ?? 0),
        ivRank: Number(x.iv_rank ?? 0),
        ivPercentile: Number(x.iv_percentile ?? 0),
        hv20: Number(x.hv_20 ?? x.hv20 ?? 0),
        hv60: Number(x.hv_60 ?? x.hv60 ?? 0),
        ivHvSpread: Number(x.iv_hv_spread ?? 0),
        skew: Number(x.skew ?? 0),
        termSlope: Number(x.term_slope ?? 0),
        callIv: Number(x.call_iv ?? 0),
        putIv: Number(x.put_iv ?? 0),
        atmIv: Number(x.atm_iv ?? 0),
        putCallSkew: Number(x.put_call_skew ?? 0),
        signal: (x.signal ?? 'neutral') as VolScanResult['signal'],
        score: Number(x.score ?? 0),
        unusualActivity: Boolean(x.unusual_activity ?? false),
        volumeRatio: Number(x.volume_ratio ?? 0),
        openInterestChange: Number(x.open_interest_change ?? 0),
        sector: x.sector ?? '',
      })))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [minScore])

  const fetchIvRank = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/vol-scanner/iv-rank')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.iv_ranks ?? d.data ?? []
      setIvRanks(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        ivRank: Number(x.iv_rank ?? 0),
        ivPercentile: Number(x.iv_percentile ?? 0),
        currentIv: Number(x.current_iv ?? 0),
        iv52wHigh: Number(x.iv_52w_high ?? x.iv52w_high ?? 0),
        iv52wLow: Number(x.iv_52w_low ?? x.iv52w_low ?? 0),
        iv52wAvg: Number(x.iv_52w_avg ?? x.iv52w_avg ?? 0),
        dteTarget: Number(x.dte_target ?? 30),
        regime: (x.regime ?? 'normal') as IvRankEntry['regime'],
      })))
    } catch { /* empty */ }
  }, [])

  const fetchAlerts = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/vol-scanner/alerts')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.alerts ?? d.data ?? []
      setAlerts(raw.map((x: any) => ({
        id: x.id ?? String(Math.random()),
        symbol: x.symbol ?? '',
        type: (x.type ?? x.alert_type ?? 'iv_spike') as VolAlert['type'],
        severity: (x.severity ?? 'medium') as VolAlert['severity'],
        message: x.message ?? x.description ?? '',
        value: Number(x.value ?? 0),
        threshold: Number(x.threshold ?? 0),
        timestamp: x.timestamp ?? x.time ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  const fetchUnusual = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/vol-scanner/unusual')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.unusual ?? d.activity ?? d.data ?? []
      setUnusual(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        strike: Number(x.strike ?? 0),
        expiry: x.expiry ?? x.expiration ?? '',
        optionType: (x.option_type ?? x.type ?? 'call') as 'call' | 'put',
        volume: Number(x.volume ?? 0),
        openInterest: Number(x.open_interest ?? x.oi ?? 0),
        volToOi: Number(x.vol_to_oi ?? x.volume_to_oi ?? 0),
        premium: Number(x.premium ?? 0),
        iv: Number(x.iv ?? 0),
        bid: Number(x.bid ?? 0),
        ask: Number(x.ask ?? 0),
        flags: Array.isArray(x.flags) ? x.flags : [],
        reportTime: x.report_time ?? x.time ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  const fetchTerm = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/vol-scanner/term-structure')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.points ?? d.data ?? []
      setTermStructure(raw.map((x: any) => ({
        symbol: x.symbol ?? '',
        dte: Number(x.dte ?? x.days_to_expiry ?? 0),
        iv: Number(x.iv ?? 0),
        forwardIv: Number(x.forward_iv ?? 0),
        slope: Number(x.slope ?? 0),
      })))
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchScan(), fetchIvRank(), fetchAlerts(), fetchUnusual(), fetchTerm()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(() => { fetchScan(); fetchAlerts() }, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchScan, fetchIvRank, fetchAlerts, fetchUnusual, fetchTerm])

  const filteredResults = scanResults.filter(s => {
    if (signalFilter !== 'all' && s.signal !== signalFilter) return false
    if (s.score < minScore) return false
    return true
  })

  const highIvRank = ivRanks.filter(x => x.ivRank > 70).length
  const lowIvRank = ivRanks.filter(x => x.ivRank < 30).length
  const highAlerts = alerts.filter(a => a.severity === 'high').length
  const unusualFiltered = unusualFilter === 'all' ? unusual : unusual.filter(u => u.optionType === unusualFilter)

  const tabs = [
    { id: 'scanner' as const, label: 'SCANNER' },
    { id: 'ivrank' as const, label: 'IV RANK' },
    { id: 'alerts' as const, label: `ALERTS${highAlerts > 0 ? ` (${highAlerts})` : ''}` },
    { id: 'unusual' as const, label: 'UNUSUAL ACTIVITY' },
    { id: 'term' as const, label: 'TERM STRUCTURE' },
  ]

  const SIGNALS = ['all', 'buy_vol', 'sell_vol', 'fade_skew', 'fly', 'neutral']

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>VOLSCAN</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>VOLATILITY SCANNER â€” UNUSUAL ACTIVITY DETECTION</span>
        {highAlerts > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš  {highAlerts} HIGH ALERTS</span>}
      </div>

      {/* â”€â”€ STATS STRIP â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Scanned Symbols" value={scanResults.length} />
        <StatCard label="Buy Vol Signals" value={scanResults.filter(x => x.signal === 'buy_vol').length} col={GREEN} />
        <StatCard label="Sell Vol Signals" value={scanResults.filter(x => x.signal === 'sell_vol').length} col={RED} />
        <StatCard label="High IV Rank (>70)" value={highIvRank} col={RED} sub="potential sell vol" />
        <StatCard label="Low IV Rank (<30)" value={lowIvRank} col={GREEN} sub="potential buy vol" />
        <StatCard label="Unusual Activity" value={unusual.length} col={AMBER} />
      </div>

      {/* â”€â”€ TABS â”€â”€ */}
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

      {/* â”€â”€ BODY â”€â”€ */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Scanning volatility...</div>}

        {/* â”€â”€ SCANNER â”€â”€ */}
        {tab === 'scanner' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {SIGNALS.map(s => (
                <button key={s} onClick={() => setSignalFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: signalFilter === s ? '#000' : TEXT, background: signalFilter === s ? AMBER : 'transparent',
                    border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {s.replace('_', ' ')}
                </button>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: SUBTLE }}>MIN SCORE:</span>
                <input type="number" value={minScore} onChange={e => setMinScore(Number(e.target.value))} min={0} max={10}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 6px', width: 50, outline: 'none' }} />
              </div>
              <button onClick={fetchScan} style={{ fontFamily: MONO, fontSize: 10, color: '#000', background: AMBER, border: 'none', borderRadius: 3, padding: '3px 12px', cursor: 'pointer' }}>SCAN</button>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Signal</Th><Th right>Score</Th>
                    <Th right>IV</Th><Th right>IV Rank</Th><Th right>HV20</Th><Th right>IV-HV</Th>
                    <Th right>Skew</Th><Th right>Term Slope</Th><Th right>Vol Ratio</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Scanning...' : 'No results â€” click SCAN or check /api/v4/vol-scanner/scan'}
                    </td></tr>
                  )}
                  {filteredResults.sort((a, b) => b.score - a.score).map(s => (
                    <tr key={s.symbol}>
                      <Td mono col={AMBER}>
                        {s.symbol}
                        {s.unusualActivity && <span style={{ fontSize: 7, color: RED, marginLeft: 5 }}>âš¡U</span>}
                      </Td>
                      <Td><SignalBadge signal={s.signal} /></Td>
                      <Td right mono col={s.score > 7 ? GREEN : s.score > 4 ? AMBER : RED}>{s.score.toFixed(1)}</Td>
                      <Td right mono>{(s.ivCurrent * 100).toFixed(1)}%</Td>
                      <Td right><IvRankGauge rank={s.ivRank} /></Td>
                      <Td right mono col={SUBTLE}>{(s.hv20 * 100).toFixed(1)}%</Td>
                      <Td right mono col={s.ivHvSpread > 0 ? RED : GREEN}>{(s.ivHvSpread * 100).toFixed(1)}pp</Td>
                      <Td right mono col={s.skew > 0 ? PURPLE : SUBTLE}>{(s.skew * 100).toFixed(1)}%</Td>
                      <Td right mono col={s.termSlope > 0 ? BLUE : ORANGE}>{(s.termSlope * 100).toFixed(1)}%</Td>
                      <Td right mono col={s.volumeRatio > 2 ? RED : SUBTLE}>{s.volumeRatio.toFixed(1)}x</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ IV RANK â”€â”€ */}
        {tab === 'ivrank' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                ['Extreme High (>80)', ivRanks.filter(x => x.ivRank > 80).length, '#b71c1c'],
                ['High (70-80)', ivRanks.filter(x => x.ivRank > 70 && x.ivRank <= 80).length, RED],
                ['Low (20-30)', ivRanks.filter(x => x.ivRank >= 20 && x.ivRank < 30).length, GREEN],
                ['Extreme Low (<20)', ivRanks.filter(x => x.ivRank < 20).length, '#00e676'],
              ].map(([l, v, c]) => (
                <StatCard key={l as string} label={l as string} value={v as number} col={c as string} />
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th right>IV Rank</Th><Th right>IV Pctile</Th>
                    <Th right>Current IV</Th><Th right>52w High</Th><Th right>52w Low</Th><Th right>52w Avg</Th>
                    <Th right>DTE</Th><Th>Regime</Th>
                  </tr>
                </thead>
                <tbody>
                  {ivRanks.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No IV rank data â€” check /api/v4/vol-scanner/iv-rank
                    </td></tr>
                  )}
                  {[...ivRanks].sort((a, b) => b.ivRank - a.ivRank).map(x => (
                    <tr key={x.symbol}>
                      <Td mono col={AMBER}>{x.symbol}</Td>
                      <Td right><IvRankGauge rank={x.ivRank} /></Td>
                      <Td right mono col={x.ivPercentile > 70 ? RED : x.ivPercentile < 30 ? GREEN : SUBTLE}>{x.ivPercentile.toFixed(0)}</Td>
                      <Td right mono>{(x.currentIv * 100).toFixed(1)}%</Td>
                      <Td right mono col={RED}>{(x.iv52wHigh * 100).toFixed(1)}%</Td>
                      <Td right mono col={GREEN}>{(x.iv52wLow * 100).toFixed(1)}%</Td>
                      <Td right mono col={SUBTLE}>{(x.iv52wAvg * 100).toFixed(1)}%</Td>
                      <Td right mono>{x.dteTarget}d</Td>
                      <Td><RegimeBadge regime={x.regime} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ ALERTS â”€â”€ */}
        {tab === 'alerts' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No alerts â€” check /api/v4/vol-scanner/alerts</div>}
              {[...alerts].sort((a, b) => {
                const sev = { high: 3, medium: 2, low: 1 }
                return sev[b.severity] - sev[a.severity]
              }).map(a => (
                <div key={a.id} style={{ background: PANEL, border: `1px solid ${a.severity === 'high' ? RED + '44' : a.severity === 'medium' ? AMBER + '44' : BORDER}`, borderRadius: 4, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <SeverityBadge severity={a.severity} />
                  <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, minWidth: 50 }}>{a.symbol}</span>
                  <span style={{ fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{a.type.replace(/_/g, ' ').toUpperCase()}</span>
                  <span style={{ flex: 1, fontSize: 11, color: TEXT }}>{a.message}</span>
                  <span style={{ fontSize: 10, color: SUBTLE, whiteSpace: 'nowrap' }}>{fmtTime(a.timestamp)}</span>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: RED }}>val={a.value.toFixed(2)} vs {a.threshold.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* â”€â”€ UNUSUAL ACTIVITY â”€â”€ */}
        {tab === 'unusual' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['all', 'call', 'put'] as const).map(f => (
                <button key={f} onClick={() => setUnusualFilter(f)}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: unusualFilter === f ? '#000' : TEXT, background: unusualFilter === f ? AMBER : 'transparent',
                    border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Type</Th><Th right>Strike</Th><Th>Expiry</Th>
                    <Th right>Volume</Th><Th right>OI</Th><Th right>Vol/OI</Th>
                    <Th right>Premium</Th><Th right>IV</Th><Th right>Bid/Ask</Th><Th>Flags</Th>
                  </tr>
                </thead>
                <tbody>
                  {unusualFiltered.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No unusual activity â€” check /api/v4/vol-scanner/unusual
                    </td></tr>
                  )}
                  {[...unusualFiltered].sort((a, b) => b.volToOi - a.volToOi).map((u, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{u.symbol}</Td>
                      <Td mono col={u.optionType === 'call' ? BLUE : PURPLE}>{u.optionType.toUpperCase()}</Td>
                      <Td right mono>${u.strike.toFixed(0)}</Td>
                      <Td mono col={SUBTLE}>{u.expiry}</Td>
                      <Td right mono col={u.volume > 10000 ? RED : SUBTLE}>{u.volume.toLocaleString()}</Td>
                      <Td right mono>{u.openInterest.toLocaleString()}</Td>
                      <Td right mono col={u.volToOi > 1 ? RED : SUBTLE}>{u.volToOi.toFixed(2)}x</Td>
                      <Td right mono col={ORANGE}>${u.premium.toFixed(0)}K</Td>
                      <Td right mono>{(u.iv * 100).toFixed(1)}%</Td>
                      <Td right mono col={SUBTLE}>${u.bid.toFixed(2)}/${u.ask.toFixed(2)}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {u.flags.slice(0, 3).map((f, fi) => (
                            <span key={fi} style={{ fontSize: 7, color: RED, background: RED + '22', padding: '1px 4px', borderRadius: 2 }}>{f}</span>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ TERM STRUCTURE â”€â”€ */}
        {tab === 'term' && (
          <>
            {termStructure.length === 0 ? (
              <div style={{ color: SUBTLE, fontSize: 11 }}>No term structure data â€” check /api/v4/vol-scanner/term-structure</div>
            ) : (
              (() => {
                const symbols = [...new Set(termStructure.map(p => p.symbol))]
                return (
                  <>
                    {symbols.map(sym => {
                      const pts = termStructure.filter(p => p.symbol === sym).sort((a, b) => a.dte - b.dte)
                      if (pts.length < 2) return null
                      const maxIv = Math.max(...pts.map(p => p.iv))
                      const minIv = Math.min(...pts.map(p => p.iv))
                      const ivRange = maxIv - minIv || 0.01
                      const W = 300, H = 80
                      const toX = (dte: number) => {
                        const maxDte = pts[pts.length - 1].dte
                        return 20 + (dte / maxDte) * (W - 40)
                      }
                      const toY = (iv: number) => H - 10 - ((iv - minIv) / ivRange) * (H - 20)
                      const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.dte)} ${toY(p.iv)}`).join(' ')
                      const isContango = pts[0].iv < pts[pts.length - 1].iv
                      return (
                        <div key={sym} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px', marginBottom: 10 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>{sym}</span>
                            <span style={{ fontSize: 9, color: isContango ? RED : GREEN }}>{isContango ? 'CONTANGO' : 'BACKWARDATION'}</span>
                            <span style={{ fontSize: 9, color: SUBTLE }}>{pts.length} expiries</span>
                          </div>
                          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 320, display: 'block' }}>
                            <path d={pathD} fill="none" stroke={isContango ? RED : GREEN} strokeWidth="2" />
                            {pts.map((p, i) => (
                              <g key={i}>
                                <circle cx={toX(p.dte)} cy={toY(p.iv)} r="3" fill={isContango ? RED : GREEN} />
                                <text x={toX(p.dte)} y={H - 2} fontSize="7" fill={SUBTLE} textAnchor="middle" fontFamily="monospace">{p.dte}d</text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      )
                    })}
                  </>
                )
              })()
            )}
          </>
        )}
      </div>
    </div>
  )
}
