import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// CrossAssetQuoteUI2 — Bloomberg XASQ-grade cross-asset quote matrix terminal
// Tabs: QUOTE MATRIX | WATCHLIST | HEATMAP | SPREADS | ANALYTICS
// APIs: /api/v4/quotes/matrix, /api/v4/quotes/watchlist,
//       /api/v4/quotes/heatmap, /api/v4/quotes/spreads,
//       /api/v4/quotes/analytics

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

type AssetClass = 'equity' | 'fx' | 'rates' | 'commodity' | 'crypto' | 'option' | 'futures'

interface Quote {
  symbol: string
  description: string
  assetClass: AssetClass
  exchange: string
  bid: number
  ask: number
  last: number
  change: number
  changePct: number
  volume: number
  openInterest?: number
  high: number
  low: number
  open: number
  prevClose: number
  vwap: number
  iv?: number
  delta?: number
  yield_?: number
  duration?: number
  beta?: number
  timestamp: string
  alertTriggered?: boolean
}

interface Spread {
  name: string
  leg1: string
  leg2: string
  spread: number
  spreadChange: number
  zscore: number
  percentile: number
  signal: 'buy_spread' | 'sell_spread' | 'neutral'
}

interface HeatmapCell {
  symbol: string
  changePct: number
  volume: number
  assetClass: AssetClass
  sector?: string
}

interface QuoteAnalytics {
  symbol: string
  avgBidAskSpread: number
  liquidityScore: number
  correlationToSPY: number
  beta: number
  realizedVol: number
  impliedVol?: number
  skew?: number
  relativeStrength: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function AssetBadge({ ac }: { ac: AssetClass }) {
  const map: Record<AssetClass, string> = { equity: BLUE, fx: AMBER, rates: PURPLE, commodity: ORANGE, crypto: GREEN, option: RED, futures: SUBTLE }
  const c = map[ac] || SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 8, color: c, background: c + '22', padding: '2px 5px', borderRadius: 2 }}>{ac.toUpperCase()}</span>
}

function SpreadSignalBadge({ signal }: { signal: Spread['signal'] }) {
  const c = signal === 'buy_spread' ? GREEN : signal === 'sell_spread' ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{signal.replace(/_/g, ' ').toUpperCase()}</span>
}

function ChangeCell({ v }: { v: number }) {
  const c = v > 0 ? GREEN : v < 0 ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 11, color: c }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

function fmtPrice(v: number, ac?: AssetClass) {
  if (!v && v !== 0) return '—'
  if (ac === 'fx') return v.toFixed(5)
  if (ac === 'rates') return v.toFixed(3)
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(ts: string) { try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) } catch { return ts } }


export function CrossAssetQuoteUI2() {
  const [tab, setTab] = useState<'matrix' | 'watchlist' | 'heatmap' | 'spreads' | 'analytics'>('matrix')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [spreadData, setSpreadData] = useState<Spread[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [analytics, setAnalytics] = useState<QuoteAnalytics[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState<string>('all')
  const [searchSym, setSearchSym] = useState('')
  const [sortBy, setSortBy] = useState<string>('changePct')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const parseQuote = (x: any): Quote => ({
    symbol: x.symbol ?? '',
    description: x.description ?? x.name ?? '',
    assetClass: (x.asset_class ?? x.type ?? 'equity') as AssetClass,
    exchange: x.exchange ?? x.venue ?? '',
    bid: Number(x.bid ?? 0),
    ask: Number(x.ask ?? 0),
    last: Number(x.last ?? x.price ?? x.close ?? 0),
    change: Number(x.change ?? 0),
    changePct: Number(x.change_pct ?? x.change_percent ?? x.pct_change ?? 0),
    volume: Number(x.volume ?? 0),
    openInterest: x.open_interest !== undefined ? Number(x.open_interest) : undefined,
    high: Number(x.high ?? 0),
    low: Number(x.low ?? 0),
    open: Number(x.open ?? 0),
    prevClose: Number(x.prev_close ?? x.previous_close ?? 0),
    vwap: Number(x.vwap ?? 0),
    iv: x.iv !== undefined ? Number(x.iv) : undefined,
    delta: x.delta !== undefined ? Number(x.delta) : undefined,
    yield_: x.yield !== undefined ? Number(x.yield) : undefined,
    duration: x.duration !== undefined ? Number(x.duration) : undefined,
    beta: x.beta !== undefined ? Number(x.beta) : undefined,
    timestamp: x.timestamp ?? x.time ?? '',
    alertTriggered: Boolean(x.alert_triggered ?? false),
  })

  const fetchAll = useCallback(async () => {
    try {
      const [rQ, rS, rH, rA] = await Promise.allSettled([
        fetch('/api/v4/quotes/matrix').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/quotes/spreads').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/quotes/heatmap').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/quotes/analytics').then(r => r.ok ? r.json() : []),
      ])
      if (rQ.status === 'fulfilled') {
        const d = rQ.value
        const raw: any[] = Array.isArray(d) ? d : d.quotes ?? d.instruments ?? d.data ?? []
        setQuotes(raw.map(parseQuote))
        setErr(null)
      } else setErr('Failed to load quotes')

      if (rS.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rS.value) ? rS.value : rS.value.spreads ?? rS.value.data ?? []
        setSpreadData(raw.map((x: any) => ({
          name: x.name ?? '', leg1: x.leg1 ?? '', leg2: x.leg2 ?? '',
          spread: Number(x.spread ?? 0), spreadChange: Number(x.spread_change ?? 0),
          zscore: Number(x.zscore ?? x.z_score ?? 0),
          percentile: Number(x.percentile ?? 0),
          signal: (x.signal ?? 'neutral') as Spread['signal'],
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rH.value) ? rH.value : rH.value.cells ?? rH.value.data ?? []
        setHeatmap(raw.map((x: any) => ({
          symbol: x.symbol ?? '', changePct: Number(x.change_pct ?? x.pct_change ?? 0),
          volume: Number(x.volume ?? 0), assetClass: (x.asset_class ?? 'equity') as AssetClass,
          sector: x.sector ?? undefined,
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rA.value) ? rA.value : rA.value.analytics ?? rA.value.data ?? []
        setAnalytics(raw.map((x: any) => ({
          symbol: x.symbol ?? '', avgBidAskSpread: Number(x.avg_bid_ask_spread ?? 0),
          liquidityScore: Number(x.liquidity_score ?? 0), correlationToSPY: Number(x.correlation_to_spy ?? x.spy_corr ?? 0),
          beta: Number(x.beta ?? 0), realizedVol: Number(x.realized_vol ?? x.rvol ?? 0),
          impliedVol: x.implied_vol !== undefined ? Number(x.implied_vol) : undefined,
          skew: x.skew !== undefined ? Number(x.skew) : undefined,
          relativeStrength: Number(x.relative_strength ?? x.rsi ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 3000)  // real-time quotes — 3s poll
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortBy(col); setSortDir(-1) }
  }

  const filtQuotes = quotes.filter(q => {
    if (classFilter !== 'all' && q.assetClass !== classFilter) return false
    if (searchSym && !q.symbol.toLowerCase().includes(searchSym.toLowerCase()) && !q.description.toLowerCase().includes(searchSym.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0
    const bVal = (b as any)[sortBy] ?? 0
    return (aVal < bVal ? -1 : 1) * sortDir
  })

  const advancers = quotes.filter(q => q.changePct > 0).length
  const decliners = quotes.filter(q => q.changePct < 0).length
  const alertCount = quotes.filter(q => q.alertTriggered).length

  const ASSET_CLASSES: AssetClass[] = ['equity', 'fx', 'rates', 'commodity', 'crypto', 'option', 'futures']

  const TABS = [
    { id: 'matrix' as const, label: 'QUOTE MATRIX' },
    { id: 'watchlist' as const, label: 'WATCHLIST' },
    { id: 'heatmap' as const, label: 'HEATMAP' },
    { id: 'spreads' as const, label: 'SPREADS' },
    { id: 'analytics' as const, label: 'ANALYTICS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>XASQ</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CROSS-ASSET QUOTE MATRIX — MULTI-EXCHANGE REAL-TIME FEEDS</span>
        {alertCount > 0 && <span style={{ fontSize: 10, color: RED }}>⚠¡ {alertCount} ALERTS</span>}
        {loading && <span style={{ fontSize: 9, color: SUBTLE }}>â—</span>}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Instruments" value={quotes.length} />
        <StatCard label="Advancers" value={advancers} col={GREEN} />
        <StatCard label="Decliners" value={decliners} col={RED} />
        <StatCard label="Unchanged" value={quotes.length - advancers - decliners} col={SUBTLE} />
        <StatCard label="Alerts" value={alertCount} col={alertCount > 0 ? RED : SUBTLE} />
        <StatCard label="Spreads" value={spreadData.length} col={BLUE} />
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

      {/* FILTERS */}
      <div style={{ padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setClassFilter('all')}
          style={{ fontFamily: MONO, fontSize: 9, color: classFilter === 'all' ? '#000' : TEXT, background: classFilter === 'all' ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
          ALL
        </button>
        {ASSET_CLASSES.map(ac => (
          <button key={ac} onClick={() => setClassFilter(ac)}
            style={{ fontFamily: MONO, fontSize: 9, color: classFilter === ac ? '#000' : TEXT, background: classFilter === ac ? AMBER : 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
            {ac.toUpperCase()}
          </button>
        ))}
        <input placeholder="Search..." value={searchSym} onChange={e => setSearchSym(e.target.value)}
          style={{ fontFamily: MONO, fontSize: 10, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 8px', outline: 'none', width: 100 }} />
        {err && <span style={{ fontSize: 9, color: RED }}>Error: {err}</span>}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* â”€â”€ QUOTE MATRIX â”€â”€ */}
        {(tab === 'matrix' || tab === 'watchlist') && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[['Symbol', 'symbol'], ['Class', 'assetClass'], ['Exchange', 'exchange'], ['Bid', 'bid', true], ['Ask', 'ask', true], ['Last', 'last', true], ['Change', 'change', true], ['Chg%', 'changePct', true], ['Volume', 'volume', true], ['High', 'high', true], ['Low', 'low', true], ['VWAP', 'vwap', true]].map(([label, key, right]) => (
                  <th key={key as string} onClick={() => handleSort(key as string)}
                    style={{ fontFamily: MONO, fontSize: 9, color: sortBy === key ? AMBER : SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {label as string}{sortBy === key ? (sortDir === -1 ? ' â†“' : ' â†‘') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtQuotes.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No quotes
                </td></tr>
              )}
              {filtQuotes.map(q => (
                <tr key={q.symbol} style={{ background: q.alertTriggered ? '#1a0800' : 'transparent' }}>
                  <Td mono col={AMBER}>{q.symbol}{q.alertTriggered && <span style={{ fontSize: 7, color: RED, marginLeft: 4 }}>⚠¡</span>}</Td>
                  <Td><AssetBadge ac={q.assetClass} /></Td>
                  <Td mono col={SUBTLE}>{q.exchange}</Td>
                  <Td right mono col={SUBTLE}>{fmtPrice(q.bid, q.assetClass)}</Td>
                  <Td right mono col={SUBTLE}>{fmtPrice(q.ask, q.assetClass)}</Td>
                  <Td right mono>{fmtPrice(q.last, q.assetClass)}</Td>
                  <Td right mono col={q.change >= 0 ? GREEN : RED}>{q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}</Td>
                  <Td right><ChangeCell v={q.changePct} /></Td>
                  <Td right mono col={SUBTLE}>{q.volume.toLocaleString()}</Td>
                  <Td right mono col={SUBTLE}>{fmtPrice(q.high, q.assetClass)}</Td>
                  <Td right mono col={SUBTLE}>{fmtPrice(q.low, q.assetClass)}</Td>
                  <Td right mono col={BLUE}>{fmtPrice(q.vwap, q.assetClass)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* â”€â”€ HEATMAP â”€â”€ */}
        {tab === 'heatmap' && (
          <div style={{ padding: 16 }}>
            {heatmap.length === 0 ? <div style={{ color: SUBTLE, fontSize: 11 }}>No heatmap data</div> : (
              (() => {
                const sectors = [...new Set(heatmap.map(c => c.sector ?? c.assetClass))]
                return (
                  <>
                    {sectors.map(sec => {
                      const cells = heatmap.filter(c => (c.sector ?? c.assetClass) === sec)
                      return (
                        <div key={sec} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 5, letterSpacing: 1 }}>{sec.toUpperCase()}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {cells.map(c => {
                              const clamp = Math.max(-5, Math.min(5, c.changePct))
                              const intensity = Math.abs(clamp) / 5
                              const base = c.changePct >= 0 ? GREEN : RED
                              return (
                                <div key={c.symbol}
                                  title={`${c.symbol}: ${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(2)}%`}
                                  style={{ width: 64, height: 44, background: base + Math.round(40 + intensity * 200).toString(16).padStart(2, '0'),
                                    border: `1px solid ${base}44`, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: TEXT }}>{c.symbol}</div>
                                  <div style={{ fontSize: 9, fontFamily: MONO, color: base }}>{c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(1)}%</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()
            )}
          </div>
        )}

        {/* â”€â”€ SPREADS â”€â”€ */}
        {tab === 'spreads' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Spread Name</Th><Th>Leg 1</Th><Th>Leg 2</Th>
                <Th right>Spread</Th><Th right>Change</Th><Th right>Z-Score</Th>
                <Th right>Percentile</Th><Th>Signal</Th>
              </tr>
            </thead>
            <tbody>
              {spreadData.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No spread data
                </td></tr>
              )}
              {spreadData.map((s, i) => (
                <tr key={i}>
                  <Td mono col={AMBER}>{s.name}</Td>
                  <Td mono col={BLUE}>{s.leg1}</Td>
                  <Td mono col={PURPLE}>{s.leg2}</Td>
                  <Td right mono>{s.spread.toFixed(4)}</Td>
                  <Td right mono col={s.spreadChange >= 0 ? GREEN : RED}>{s.spreadChange >= 0 ? '+' : ''}{s.spreadChange.toFixed(4)}</Td>
                  <Td right mono col={Math.abs(s.zscore) > 2 ? RED : Math.abs(s.zscore) > 1 ? AMBER : SUBTLE}>{s.zscore.toFixed(2)}Ïƒ</Td>
                  <Td right mono color={s.percentile > 80 ? RED : s.percentile < 20 ? GREEN : SUBTLE}>{s.percentile.toFixed(0)}th</Td>
                  <Td><SpreadSignalBadge signal={s.signal} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* â”€â”€ ANALYTICS â”€â”€ */}
        {tab === 'analytics' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Symbol</Th><Th right>Bid/Ask Sprd</Th><Th right>Liquidity</Th>
                <Th right>SPY Corr</Th><Th right>Beta</Th><Th right>RVol</Th>
                <Th right>IVol</Th><Th right>Skew</Th><Th right>Rel Strength</Th>
              </tr>
            </thead>
            <tbody>
              {analytics.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                  No analytics
                </td></tr>
              )}
              {analytics.map((a, i) => (
                <tr key={i}>
                  <Td mono col={AMBER}>{a.symbol}</Td>
                  <Td right mono col={a.avgBidAskSpread > 0.02 ? RED : SUBTLE}>{(a.avgBidAskSpread * 100).toFixed(3)}%</Td>
                  <Td right mono col={a.liquidityScore > 7 ? GREEN : a.liquidityScore > 4 ? AMBER : RED}>{a.liquidityScore.toFixed(1)}/10</Td>
                  <Td right mono col={Math.abs(a.correlationToSPY) > 0.8 ? ORANGE : SUBTLE}>{a.correlationToSPY.toFixed(3)}</Td>
                  <Td right mono col={a.beta > 1.5 ? ORANGE : SUBTLE}>{a.beta.toFixed(2)}</Td>
                  <Td right mono>{(a.realizedVol * 100).toFixed(1)}%</Td>
                  <Td right mono col={a.impliedVol !== undefined && a.impliedVol > a.realizedVol ? RED : GREEN}>{a.impliedVol !== undefined ? (a.impliedVol * 100).toFixed(1) + '%' : '—'}</Td>
                  <Td right mono col={a.skew !== undefined && a.skew > 0 ? PURPLE : SUBTLE}>{a.skew !== undefined ? a.skew.toFixed(3) : '—'}</Td>
                  <Td right mono col={a.relativeStrength > 60 ? GREEN : a.relativeStrength < 40 ? RED : SUBTLE}>{a.relativeStrength.toFixed(0)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
