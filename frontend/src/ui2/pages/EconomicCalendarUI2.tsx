import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// EconomicCalendarUI2 — Bloomberg ECON-grade economic calendar terminal
// Tabs: TODAY | CALENDAR | IMPACT | COUNTRIES | INDICATORS
// APIs: /api/v4/economic-calendar/events, /api/v4/economic-calendar/events/today,
//       /api/v4/economic-calendar/impact/{id}, /api/v4/economic-calendar/countries,
//       /api/v4/economic-calendar/indicators

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

type Impact = 'high' | 'medium' | 'low' | 'holiday'
type EventStatus = 'upcoming' | 'live' | 'released' | 'revised'

interface EconEvent {
  id: string
  name: string
  country: string
  countryCode: string
  currency: string
  date: string
  time: string
  impact: Impact
  status: EventStatus
  actual: number | null
  forecast: number | null
  previous: number | null
  unit: string
  description: string
  assetClasses: string[]
  revision: number | null
}

interface CountryData {
  code: string
  name: string
  currency: string
  eventCount: number
  highImpactEvents: number
  nextEvent: string
  gdpGrowth: number | null
  cpi: number | null
  interestRate: number | null
}

interface Indicator {
  id: string
  name: string
  country: string
  category: string
  frequency: string
  lastRelease: string
  nextRelease: string
  lastActual: number | null
  lastForecast: number | null
  lastPrevious: number | null
  trend: 'up' | 'down' | 'flat'
  importance: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ImpactDot({ impact }: { impact: Impact }) {
  const cfg: Record<Impact, { color: string; label: string }> = {
    high:    { color: RED,    label: 'â—â—â—' },
    medium:  { color: AMBER,  label: 'â—â—â—‹' },
    low:     { color: GREEN,  label: 'â—â—‹â—‹' },
    holiday: { color: SUBTLE, label: '—' },
  }
  const { color, label } = cfg[impact]
  return <span style={{ fontFamily: MONO, fontSize: 11, color, fontWeight: 700, letterSpacing: -1 }}>{label}</span>
}

function StatusBadge({ status }: { status: EventStatus }) {
  const cfg: Record<EventStatus, { c: string; bg: string }> = {
    upcoming: { c: BLUE,   bg: '#0a1220' },
    live:     { c: AMBER,  bg: '#1a1200' },
    released: { c: GREEN,  bg: '#0a1a18' },
    revised:  { c: PURPLE, bg: '#140a1a' },
  }
  const { c, bg } = cfg[status]
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      color: c, background: bg, padding: '2px 6px', borderRadius: 2, border: `1px solid ${c}33` }}>
      {status === 'live' ? 'â— LIVE' : status}
    </span>
  )
}

function SurpriseBar({ actual, forecast }: { actual: number | null; forecast: number | null }) {
  if (actual === null || forecast === null) return <span style={{ color: SUBTLE, fontSize: 11 }}>—</span>
  const diff = actual - forecast
  const pct = forecast !== 0 ? (diff / Math.abs(forecast)) * 100 : 0
  const col = diff > 0 ? GREEN : RED
  const label = diff > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: `${Math.min(50, Math.abs(pct) / 2)}%`,
          background: col, transform: diff < 0 ? 'translateX(-100%)' : 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: SUBTLE }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{label}</span>
    </div>
  )
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span style={{ color: GREEN, fontSize: 13 }}>â–²</span>
  if (trend === 'down') return <span style={{ color: RED, fontSize: 13 }}>â–¼</span>
  return <span style={{ color: SUBTLE, fontSize: 13 }}>â”</span>
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
}

function fmtNum(v: number | null, dp = 2, unit = '') {
  if (v === null || v === undefined) return '—'
  return `${v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}${unit}`
}

function CountryFlag({ code }: { code: string }) {
  const flags: Record<string, string> = {
    US: 'ðŸ‡ºðŸ‡¸', GB: 'ðŸ‡¬ðŸ‡§', EU: 'ðŸ‡ªðŸ‡º', DE: 'ðŸ‡©ðŸ‡ª', JP: 'ðŸ‡¯ðŸ‡µ', CN: 'ðŸ‡¨ðŸ‡³', CA: 'ðŸ‡¨ðŸ‡¦', AU: 'ðŸ‡¦ðŸ‡º',
    CH: 'ðŸ‡¨ðŸ‡­', NZ: 'ðŸ‡³ðŸ‡¿', FR: 'ðŸ‡«ðŸ‡·', IT: 'ðŸ‡®ðŸ‡¹', ES: 'ðŸ‡ªðŸ‡¸', KR: 'ðŸ‡°ðŸ‡·', IN: 'ðŸ‡®ðŸ‡³', BR: 'ðŸ‡§ðŸ‡·',
  }
  return <span style={{ fontSize: 14 }}>{flags[code.toUpperCase()] ?? 'ðŸŒ'}</span>
}

// â”€â”€ category colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const catColor: Record<string, string> = {
  'Employment': BLUE, 'Inflation': RED, 'Growth': GREEN, 'Trade': AMBER,
  'Housing': PURPLE, 'Consumer': ORANGE, 'Manufacturing': '#80cbc4', 'Central Bank': '#ffca28',
}


export function EconomicCalendarUI2() {
  const [tab, setTab] = useState<'today' | 'calendar' | 'impact' | 'countries' | 'indicators'>('today')
  const [todayEvents, setTodayEvents] = useState<EconEvent[]>([])
  const [allEvents, setAllEvents] = useState<EconEvent[]>([])
  const [countries, setCountries] = useState<CountryData[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<string>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [calDate, setCalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [indicatorCat, setIndicatorCat] = useState<string>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchToday = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/economic-calendar/events/today')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.events ?? d.data ?? []
      setTodayEvents(raw.map(mapEvent))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [])

  const fetchAll = useCallback(async (date?: string) => {
    try {
      const url = date ? `/api/v4/economic-calendar/events?date=${date}` : '/api/v4/economic-calendar/events'
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.events ?? d.data ?? []
      setAllEvents(raw.map(mapEvent))
    } catch { /* use empty */ }
  }, [])

  const fetchCountries = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/economic-calendar/countries')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.countries ?? []
      setCountries(raw.map((c: any) => ({
        code: c.code ?? c.country_code ?? 'US',
        name: c.name ?? c.country_name ?? '',
        currency: c.currency ?? '',
        eventCount: Number(c.event_count ?? 0),
        highImpactEvents: Number(c.high_impact_events ?? 0),
        nextEvent: c.next_event ?? '',
        gdpGrowth: c.gdp_growth != null ? Number(c.gdp_growth) : null,
        cpi: c.cpi != null ? Number(c.cpi) : null,
        interestRate: c.interest_rate != null ? Number(c.interest_rate) : null,
      })))
    } catch { /* empty */ }
  }, [])

  const fetchIndicators = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/economic-calendar/indicators')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.indicators ?? []
      setIndicators(raw.map((x: any) => ({
        id: x.id ?? String(Math.random()),
        name: x.name ?? '',
        country: x.country ?? '',
        category: x.category ?? 'General',
        frequency: x.frequency ?? 'Monthly',
        lastRelease: x.last_release ?? '',
        nextRelease: x.next_release ?? '',
        lastActual: x.last_actual != null ? Number(x.last_actual) : null,
        lastForecast: x.last_forecast != null ? Number(x.last_forecast) : null,
        lastPrevious: x.last_previous != null ? Number(x.last_previous) : null,
        trend: x.trend ?? 'flat',
        importance: Number(x.importance ?? 3),
      })))
    } catch { /* empty */ }
  }, [])

  function mapEvent(e: any): EconEvent {
    return {
      id: e.id ?? e.event_id ?? String(Math.random()),
      name: e.name ?? e.event_name ?? e.title ?? '',
      country: e.country ?? e.country_name ?? '',
      countryCode: e.country_code ?? e.code ?? 'US',
      currency: e.currency ?? 'USD',
      date: e.date ?? e.event_date ?? '',
      time: e.time ?? e.event_time ?? '',
      impact: (e.impact ?? e.importance ?? 'low') as Impact,
      status: (e.status ?? 'upcoming') as EventStatus,
      actual: e.actual != null ? Number(e.actual) : null,
      forecast: e.forecast != null ? Number(e.forecast) : null,
      previous: e.previous != null ? Number(e.previous) : null,
      unit: e.unit ?? '',
      description: e.description ?? '',
      assetClasses: e.asset_classes ?? e.assets ?? [],
      revision: e.revision != null ? Number(e.revision) : null,
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchToday(), fetchAll(), fetchCountries(), fetchIndicators()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(() => fetchToday(), 60000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchToday, fetchAll, fetchCountries, fetchIndicators])

  useEffect(() => { fetchAll(calDate) }, [calDate, fetchAll])

  // â”€â”€ FILTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filterEvents = (evts: EconEvent[]) => evts.filter(e => {
    if (impactFilter !== 'all' && e.impact !== impactFilter) return false
    if (countryFilter !== 'all' && e.countryCode !== countryFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    return true
  })

  const filteredToday = filterEvents(todayEvents)
  const filteredAll = filterEvents(allEvents)
  const filteredIndicators = indicatorCat === 'all' ? indicators :
    indicators.filter(x => x.category === indicatorCat)

  // â”€â”€ SUMMARY STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const highImpact = todayEvents.filter(e => e.impact === 'high').length
  const released = todayEvents.filter(e => e.status === 'released').length
  const live = todayEvents.filter(e => e.status === 'live').length
  const upcoming = todayEvents.filter(e => e.status === 'upcoming').length

  // â”€â”€ UNIQUE COUNTRIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uniqueCountries = [...new Set(allEvents.map(e => e.countryCode))].filter(Boolean)
  const indicatorCategories = [...new Set(indicators.map(x => x.category))].filter(Boolean)

  // â”€â”€ BAR CHART â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function ImpactTimeline() {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const byHour: Record<number, { high: number; med: number; low: number }> = {}
    hours.forEach(h => { byHour[h] = { high: 0, med: 0, low: 0 } })
    todayEvents.forEach(e => {
      const [hStr] = (e.time || '00:00').split(':')
      const h = parseInt(hStr, 10)
      if (!isNaN(h) && byHour[h]) {
        if (e.impact === 'high') byHour[h].high++
        else if (e.impact === 'medium') byHour[h].med++
        else byHour[h].low++
      }
    })
    const maxCount = Math.max(...Object.values(byHour).map(b => b.high + b.med + b.low), 1)
    const now = new Date().getHours()
    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60, padding: '0 0 4px 0' }}>
        {hours.map(h => {
          const { high, med, low } = byHour[h]
          const total = high + med + low
          const heightPx = Math.round((total / maxCount) * 52)
          return (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {total > 0 && (
                <div style={{ width: '100%', height: heightPx, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 0, position: 'relative' }}>
                  {high > 0 && <div style={{ height: `${(high / total) * 100}%`, background: RED, borderRadius: '1px 1px 0 0' }} />}
                  {med > 0 && <div style={{ height: `${(med / total) * 100}%`, background: AMBER }} />}
                  {low > 0 && <div style={{ height: `${(low / total) * 100}%`, background: GREEN, borderRadius: '0 0 1px 1px' }} />}
                </div>
              )}
              <div style={{ fontSize: 7, color: h === now ? AMBER : SUBTLE, fontFamily: MONO, marginTop: 2 }}>{h.toString().padStart(2, '0')}</div>
              {h === now && <div style={{ width: 2, height: 4, background: AMBER, borderRadius: 1 }} />}
            </div>
          )
        })}
      </div>
    )
  }

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabs = [
    { id: 'today' as const, label: 'TODAY' },
    { id: 'calendar' as const, label: 'CALENDAR' },
    { id: 'impact' as const, label: 'IMPACT ANALYSIS' },
    { id: 'countries' as const, label: 'COUNTRIES' },
    { id: 'indicators' as const, label: 'INDICATORS' },
  ]

  const filterBar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
      <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)}
        style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
        <option value="all">ALL IMPACT</option>
        <option value="high">HIGH â—â—â—</option>
        <option value="medium">MEDIUM â—â—â—‹</option>
        <option value="low">LOW â—â—‹â—‹</option>
        <option value="holiday">HOLIDAY</option>
      </select>
      <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
        style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
        <option value="all">ALL COUNTRIES</option>
        {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', outline: 'none' }}>
        <option value="all">ALL STATUS</option>
        <option value="upcoming">UPCOMING</option>
        <option value="live">LIVE</option>
        <option value="released">RELEASED</option>
        <option value="revised">REVISED</option>
      </select>
    </div>
  )

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* â”€â”€ HEADER â”€â”€ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ECON</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>ECONOMIC CALENDAR</span>
          {live > 0 && (
            <span style={{ fontSize: 10, color: AMBER, background: '#1a1200', border: `1px solid ${AMBER}44`, borderRadius: 10, padding: '2px 8px', animation: 'none' }}>
              â— {live} LIVE
            </span>
          )}
          {highImpact > 0 && (
            <span style={{ fontSize: 10, color: RED, background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 10, padding: '2px 8px' }}>
              {highImpact} HIGH IMPACT
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: SUBTLE }}>{new Date().toUTCString().slice(0, 25)} UTC</div>
      </div>

      {/* â”€â”€ STATS STRIP â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Today Events" value={todayEvents.length} />
        <StatCard label="High Impact" value={highImpact} col={highImpact > 0 ? RED : TEXT} />
        <StatCard label="Released" value={released} col={GREEN} />
        <StatCard label="Upcoming" value={upcoming} col={BLUE} />
        <StatCard label="Live Now" value={live} col={live > 0 ? AMBER : SUBTLE} />
      </div>

      {/* â”€â”€ TABS â”€â”€ */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ BODY â”€â”€ */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}

        {/* â”€â”€ TODAY TAB â”€â”€ */}
        {tab === 'today' && (
          <>
            {/* intraday timeline */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Intraday Event Distribution (24h UTC)
              </div>
              <ImpactTimeline />
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {[['HIGH', RED], ['MEDIUM', AMBER], ['LOW', GREEN]].map(([l, c]) => (
                  <div key={l} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, background: c, borderRadius: 1 }} />
                    <span style={{ fontSize: 9, color: SUBTLE }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {filterBar}

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Time (UTC)</Th><Th>Country</Th><Th>Event</Th><Th>Impact</Th>
                    <Th>Status</Th><Th right>Actual</Th><Th right>Forecast</Th>
                    <Th right>Previous</Th><Th>Surprise</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredToday.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : 'No events today matching filters'}
                    </td></tr>
                  )}
                  {filteredToday.sort((a, b) => a.time.localeCompare(b.time)).map(e => (
                    <tr key={e.id} onClick={() => setSelectedEvent(selectedEvent === e.id ? null : e.id)}
                      style={{ cursor: 'pointer', background: selectedEvent === e.id ? '#141414' : 'transparent', borderLeft: e.impact === 'high' ? `3px solid ${RED}` : e.impact === 'medium' ? `3px solid ${AMBER}` : `3px solid transparent` }}>
                      <Td mono col={e.status === 'live' ? AMBER : TEXT}>{e.time || '—'}</Td>
                      <Td><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><CountryFlag code={e.countryCode} />{e.countryCode}</span></Td>
                      <Td><div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{e.name}</div></Td>
                      <Td><ImpactDot impact={e.impact} /></Td>
                      <Td><StatusBadge status={e.status} /></Td>
                      <Td right mono col={e.actual !== null ? (e.actual > (e.forecast ?? e.actual) ? GREEN : e.actual < (e.forecast ?? e.actual) ? RED : TEXT) : SUBTLE}>
                        {e.actual !== null ? fmtNum(e.actual, 2, e.unit ? ` ${e.unit}` : '') : '—'}
                      </Td>
                      <Td right mono col={SUBTLE}>{e.forecast !== null ? fmtNum(e.forecast, 2, e.unit ? ` ${e.unit}` : '') : '—'}</Td>
                      <Td right mono col={SUBTLE}>{e.previous !== null ? fmtNum(e.previous, 2, e.unit ? ` ${e.unit}` : '') : '—'}</Td>
                      <Td><SurpriseBar actual={e.actual} forecast={e.forecast} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* detail panel */}
            {selectedEvent && (() => {
              const e = todayEvents.find(x => x.id === selectedEvent)
              if (!e) return null
              return (
                <div style={{ marginTop: 12, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 11, color: AMBER, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>{e.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      ['Country', `${e.countryCode} — ${e.country}`, TEXT],
                      ['Date / Time', `${e.date} ${e.time}`, SUBTLE],
                      ['Impact', e.impact.toUpperCase(), e.impact === 'high' ? RED : e.impact === 'medium' ? AMBER : GREEN],
                      ['Status', e.status.toUpperCase(), BLUE],
                      ['Actual', e.actual !== null ? fmtNum(e.actual, 2, e.unit) : 'Pending', e.actual !== null ? (e.actual > (e.forecast ?? e.actual) ? GREEN : RED) : SUBTLE],
                      ['Forecast', e.forecast !== null ? fmtNum(e.forecast, 2, e.unit) : '—', SUBTLE],
                      ['Previous', e.previous !== null ? fmtNum(e.previous, 2, e.unit) : '—', SUBTLE],
                      ['Currency', e.currency, BLUE],
                    ].map(([l, v, c]) => (
                      <div key={l as string} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}>
                        <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>{l as string}</div>
                        <div style={{ fontSize: 12, color: c as string, fontFamily: MONO, marginTop: 2 }}>{v as string}</div>
                      </div>
                    ))}
                    {e.description && (
                      <div style={{ gridColumn: '1/-1', fontSize: 11, color: SUBTLE, lineHeight: 1.5 }}>
                        <span style={{ color: TEXT }}>Description: </span>{e.description}
                      </div>
                    )}
                    {e.assetClasses.length > 0 && (
                      <div style={{ gridColumn: '1/-1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase' }}>Affected Assets:</span>
                        {e.assetClasses.map(a => (
                          <span key={a} style={{ fontSize: 9, color: BLUE, background: '#0a1220', border: `1px solid ${BLUE}33`, borderRadius: 2, padding: '2px 6px' }}>{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* â”€â”€ CALENDAR TAB â”€â”€ */}
        {tab === 'calendar' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 12, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', outline: 'none' }} />
              <button onClick={() => setCalDate(new Date().toISOString().slice(0, 10))}
                style={{ fontFamily: MONO, fontSize: 11, color: AMBER, background: '#0d0d0d', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '5px 10px', cursor: 'pointer' }}>
                TODAY
              </button>
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => {
                  const dt = new Date(); dt.setDate(dt.getDate() + d)
                  setCalDate(dt.toISOString().slice(0, 10))
                }} style={{ fontFamily: MONO, fontSize: 11, color: SUBTLE, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', cursor: 'pointer' }}>
                  +{d}D
                </button>
              ))}
            </div>
            {filterBar}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: SUBTLE, display: 'flex', justifyContent: 'space-between' }}>
                <span>CALENDAR — {calDate}</span>
                <span>{filteredAll.length} events</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Time</Th><Th>Country</Th><Th>Event</Th><Th>Impact</Th>
                    <Th>Status</Th><Th right>Forecast</Th><Th right>Previous</Th><Th right>Actual</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No events for {calDate}
                    </td></tr>
                  )}
                  {filteredAll.sort((a, b) => a.time.localeCompare(b.time)).map(e => (
                    <tr key={e.id} style={{ borderLeft: e.impact === 'high' ? `2px solid ${RED}` : `2px solid transparent` }}>
                      <Td mono>{e.time || '—'}</Td>
                      <Td><span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><CountryFlag code={e.countryCode} />{e.countryCode}</span></Td>
                      <Td><div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div></Td>
                      <Td><ImpactDot impact={e.impact} /></Td>
                      <Td><StatusBadge status={e.status} /></Td>
                      <Td right mono col={SUBTLE}>{e.forecast !== null ? fmtNum(e.forecast, 2, e.unit) : '—'}</Td>
                      <Td right mono col={SUBTLE}>{e.previous !== null ? fmtNum(e.previous, 2, e.unit) : '—'}</Td>
                      <Td right mono col={e.actual !== null ? GREEN : SUBTLE}>{e.actual !== null ? fmtNum(e.actual, 2, e.unit) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ IMPACT ANALYSIS TAB â”€â”€ */}
        {tab === 'impact' && (
          <>
            {/* surprise index chart */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Economic Surprise Index — Today
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {todayEvents.filter(e => e.actual !== null && e.forecast !== null).map(e => {
                  const surprise = e.actual! - e.forecast!
                  const pct = e.forecast !== 0 ? (surprise / Math.abs(e.forecast!)) * 100 : 0
                  const col = pct > 0 ? GREEN : RED
                  return (
                    <div key={e.id} style={{ background: '#0d0d0d', border: `1px solid ${col}33`, borderRadius: 3, padding: '6px 10px', minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: SUBTLE }}>{e.countryCode}</div>
                      <div style={{ fontSize: 10, color: TEXT, marginBottom: 2, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name.split(' ').slice(0, 2).join(' ')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</div>
                    </div>
                  )
                })}
                {todayEvents.filter(e => e.actual !== null && e.forecast !== null).length === 0 && (
                  <div style={{ color: SUBTLE, fontSize: 11 }}>No released events with forecasts yet today</div>
                )}
              </div>
            </div>

            {/* high impact breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: RED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>High Impact Events — This Week</div>
                {todayEvents.filter(e => e.impact === 'high').map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <div>
                      <div style={{ fontSize: 11, color: TEXT }}>{e.name}</div>
                      <div style={{ fontSize: 9, color: SUBTLE }}>{e.countryCode} | {e.time}</div>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                ))}
                {todayEvents.filter(e => e.impact === 'high').length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No high-impact events today</div>}
              </div>

              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: AMBER, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Impact Distribution</div>
                {[['HIGH', RED, todayEvents.filter(e => e.impact === 'high').length],
                  ['MEDIUM', AMBER, todayEvents.filter(e => e.impact === 'medium').length],
                  ['LOW', GREEN, todayEvents.filter(e => e.impact === 'low').length],
                ].map(([l, c, count]) => {
                  const pct = todayEvents.length > 0 ? ((count as number) / todayEvents.length) * 100 : 0
                  return (
                    <div key={l as string} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: c as string }}>{l as string}</span>
                        <span style={{ fontSize: 10, color: SUBTLE }}>{count as number} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c as string, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>By Country</div>
                  {[...new Set(todayEvents.map(e => e.countryCode))].slice(0, 8).map(cc => {
                    const cnt = todayEvents.filter(e => e.countryCode === cc).length
                    return (
                      <div key={cc} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><CountryFlag code={cc} />{cc}</span>
                        <span style={{ color: AMBER }}>{cnt} events</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* â”€â”€ COUNTRIES TAB â”€â”€ */}
        {tab === 'countries' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: SUBTLE }}>
              COUNTRY MONITORING — {countries.length} countries
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Country</Th><Th>Currency</Th>
                  <Th right>Events</Th><Th right>High Impact</Th>
                  <Th right>GDP Growth</Th><Th right>CPI</Th><Th right>Interest Rate</Th>
                  <Th>Next Event</Th>
                </tr>
              </thead>
              <tbody>
                {countries.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No country data
                  </td></tr>
                )}
                {countries.map(c => (
                  <tr key={c.code}>
                    <Td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CountryFlag code={c.code} /><span style={{ fontWeight: 700, color: TEXT }}>{c.name || c.code}</span></span></Td>
                    <Td mono col={BLUE}>{c.currency}</Td>
                    <Td right mono>{c.eventCount}</Td>
                    <Td right mono col={c.highImpactEvents > 0 ? RED : SUBTLE}>{c.highImpactEvents}</Td>
                    <Td right mono col={c.gdpGrowth !== null ? (c.gdpGrowth > 0 ? GREEN : RED) : SUBTLE}>{c.gdpGrowth !== null ? `${c.gdpGrowth.toFixed(1)}%` : '—'}</Td>
                    <Td right mono col={c.cpi !== null ? (c.cpi > 3 ? RED : GREEN) : SUBTLE}>{c.cpi !== null ? `${c.cpi.toFixed(1)}%` : '—'}</Td>
                    <Td right mono col={c.interestRate !== null ? AMBER : SUBTLE}>{c.interestRate !== null ? `${c.interestRate.toFixed(2)}%` : '—'}</Td>
                    <Td mono col={SUBTLE}>{c.nextEvent || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* â”€â”€ INDICATORS TAB â”€â”€ */}
        {tab === 'indicators' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>CATEGORY:</span>
              <button onClick={() => setIndicatorCat('all')}
                style={{ fontFamily: MONO, fontSize: 10, color: indicatorCat === 'all' ? AMBER : SUBTLE,
                  background: indicatorCat === 'all' ? '#1a1200' : 'transparent', border: `1px solid ${indicatorCat === 'all' ? AMBER : BORDER}`,
                  borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>ALL</button>
              {indicatorCategories.map(cat => (
                <button key={cat} onClick={() => setIndicatorCat(cat)}
                  style={{ fontFamily: MONO, fontSize: 10, color: indicatorCat === cat ? (catColor[cat] || BLUE) : SUBTLE,
                    background: indicatorCat === cat ? ((catColor[cat] || BLUE) + '22') : 'transparent',
                    border: `1px solid ${indicatorCat === cat ? (catColor[cat] || BLUE) : BORDER}`,
                    borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>{cat}</button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Indicator</Th><Th>Country</Th><Th>Category</Th><Th>Frequency</Th>
                    <Th right>Actual</Th><Th right>Forecast</Th><Th right>Previous</Th>
                    <Th>Trend</Th><Th>Next Release</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndicators.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No indicators
                    </td></tr>
                  )}
                  {filteredIndicators.sort((a, b) => b.importance - a.importance).map(x => (
                    <tr key={x.id}>
                      <Td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: TEXT }}>{x.name}</div></Td>
                      <Td><span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><CountryFlag code={x.country} />{x.country}</span></Td>
                      <Td><span style={{ fontSize: 10, color: catColor[x.category] || BLUE, background: (catColor[x.category] || BLUE) + '22', padding: '2px 6px', borderRadius: 2 }}>{x.category}</span></Td>
                      <Td mono col={SUBTLE}>{x.frequency}</Td>
                      <Td right mono col={x.lastActual !== null ? (x.lastActual > (x.lastForecast ?? x.lastActual) ? GREEN : RED) : SUBTLE}>
                        {x.lastActual !== null ? fmtNum(x.lastActual) : '—'}
                      </Td>
                      <Td right mono col={SUBTLE}>{x.lastForecast !== null ? fmtNum(x.lastForecast) : '—'}</Td>
                      <Td right mono col={SUBTLE}>{x.lastPrevious !== null ? fmtNum(x.lastPrevious) : '—'}</Td>
                      <Td><TrendArrow trend={x.trend} /></Td>
                      <Td mono col={SUBTLE}>{x.nextRelease || '—'}</Td>
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
