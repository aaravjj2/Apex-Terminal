import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// SentimentUI2 — Bloomberg SENT-grade market sentiment terminal
// Tabs: OVERVIEW | SYMBOL SENTIMENT | NEWS FLOW | SOCIAL | FEAR & GREED
// APIs: /api/v4/sentiment/dashboard, /api/v4/sentiment/symbols,
//       /api/v4/sentiment/news, /api/v4/sentiment/social,
//       /api/v4/sentiment/fear-greed

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

type SentimentLabel = 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish'

interface SymbolSentiment {
  symbol: string
  overall: SentimentLabel
  score: number
  bullishCount: number
  bearishCount: number
  neutralCount: number
  articleCount: number
  socialVolume: number
  socialScore: number
  topHeadline: string
  change1h: number
  change24h: number
  analystBullish: number
  analystBearish: number
  analystNeutral: number
  putCallRatio: number
  shortInterest: number
}

interface NewsItem {
  id: string
  headline: string
  source: string
  publishedAt: string
  symbols: string[]
  sentiment: SentimentLabel
  score: number
  url: string
  summary: string
}

interface SocialEntry {
  platform: string
  symbol: string
  mentions: number
  bullish: number
  bearish: number
  volume24h: number
  trend: 'spiking' | 'rising' | 'flat' | 'falling'
  topPost: string
}

interface FearGreedData {
  current: number
  previous: number
  label: string
  change24h: number
  vix: number
  putCall: number
  junkBond: number
  marketMomentum: number
  stockBreadth: number
  safeHaven: number
}

// ── sub-components ─────────────────────────────────────────────────────────────
function sentColor(s: SentimentLabel): string {
  switch (s) {
    case 'strongly_bullish': return '#00e676'
    case 'bullish': return GREEN
    case 'neutral': return SUBTLE
    case 'bearish': return RED
    case 'strongly_bearish': return '#b71c1c'
  }
}

function SentBadge({ sentiment }: { sentiment: SentimentLabel }) {
  const c = sentColor(sentiment)
  const label = sentiment.replace('_', ' ').toUpperCase()
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44` }}>
      {label}
    </span>
  )
}

function ScoreGauge({ score, size = 60 }: { score: number; size?: number }) {
  // score: -1 to +1
  const normalized = (score + 1) / 2 // 0=full bear, 0.5=neutral, 1=full bull
  const angle = normalized * 180 - 90 // -90 to +90
  const r = size / 2 - 6
  const cx = size / 2, cy = size / 2 + 8
  const x = cx + r * Math.cos((angle - 90) * Math.PI / 180)
  const y = cy + r * Math.sin((angle - 90) * Math.PI / 180)
  const col = score > 0.3 ? GREEN : score < -0.3 ? RED : AMBER
  return (
    <svg width={size} height={size * 0.6} style={{ overflow: 'visible' }}>
      {/* arc background */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={BORDER} strokeWidth="6" />
      {/* colored arc */}
      <path d={`M ${cx} ${cy} A ${r} ${r} 0 0 ${score >= 0 ? 1 : 0} ${x} ${y}`} fill="none" stroke={col} strokeWidth="4" />
      {/* needle */}
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={col} strokeWidth="2" />
      <circle cx={x} cy={y} r="3" fill={col} />
      <text x={cx} y={cy - r - 8} fontSize="11" fill={col} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{score.toFixed(2)}</text>
    </svg>
  )
}

function SentBar({ bullish, bearish, neutral }: { bullish: number; bearish: number; neutral: number }) {
  const total = bullish + bearish + neutral
  if (total === 0) return <div style={{ height: 8, background: BORDER, borderRadius: 4 }} />
  const bPct = (bullish / total) * 100
  const ePct = (neutral / total) * 100
  const nPct = (bearish / total) * 100
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: BORDER }}>
      <div style={{ width: `${bPct}%`, background: GREEN }} title={`Bullish ${bPct.toFixed(0)}%`} />
      <div style={{ width: `${ePct}%`, background: SUBTLE }} title={`Neutral ${ePct.toFixed(0)}%`} />
      <div style={{ width: `${nPct}%`, background: RED }} title={`Bearish ${nPct.toFixed(0)}%`} />
    </div>
  )
}

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

function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const hours = Date.now() - d.getTime()
  if (hours < 3600000) return `${Math.floor(hours / 60000)}m ago`
  if (hours < 86400000) return `${Math.floor(hours / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Fear & Greed Dial ────────────────────────────────────────────────────────
function FearGreedDial({ data }: { data: FearGreedData }) {
  const score = data.current
  const col = score > 70 ? GREEN : score > 55 ? '#a5d6a7' : score > 45 ? AMBER : score > 30 ? ORANGE : RED
  const label = score > 70 ? 'EXTREME GREED' : score > 55 ? 'GREED' : score > 45 ? 'NEUTRAL' : score > 30 ? 'FEAR' : 'EXTREME FEAR'
  const W = 200, H = 120, cx = W / 2, cy = H, r = 80
  const toXY = (deg: number) => ({
    x: cx + r * Math.cos((deg - 90) * Math.PI / 180),
    y: cy + r * Math.sin((deg - 90) * Math.PI / 180),
  })
  const angle = (score / 100) * 180 - 90
  const needle = toXY(angle)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 220, height: 120 }}>
        {/* zones */}
        {[
          { start: -90, end: -54, color: RED + 'cc' },
          { start: -54, end: -18, color: ORANGE + 'cc' },
          { start: -18, end: 18, color: AMBER + 'cc' },
          { start: 18, end: 54, color: '#a5d6a755' },
          { start: 54, end: 90, color: GREEN + 'cc' },
        ].map((z, i) => {
          const s = toXY(z.start), e = toXY(z.end)
          const large = Math.abs(z.end - z.start) > 90 ? 1 : 0
          return (
            <path key={i} d={`M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`}
              fill={z.color} opacity="0.5" stroke="none" />
          )
        })}
        {/* arc outline */}
        <path d={`M ${toXY(-90).x} ${toXY(-90).y} A ${r} ${r} 0 0 1 ${toXY(90).x} ${toXY(90).y}`}
          fill="none" stroke={BORDER} strokeWidth="2" />
        {/* labels */}
        {[['0', -90], ['25', -45], ['50', 0], ['75', 45], ['100', 90]].map(([l, a]) => {
          const p = toXY(Number(a))
          return <text key={l} x={p.x} y={p.y - 6} fontSize="7" fill={SUBTLE} textAnchor="middle" fontFamily="monospace">{l}</text>
        })}
        {/* needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={col} />
        {/* score */}
        <text x={cx} y={cy - r - 12} fontSize="22" fill={col} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{score}</text>
        <text x={cx} y={cy - r} fontSize="8" fill={col} textAnchor="middle" fontFamily="monospace">{label}</text>
      </svg>
      <div style={{ fontSize: 9, color: SUBTLE, marginTop: 4 }}>
        Prev: {data.previous} | Δ {data.change24h > 0 ? '+' : ''}{data.change24h.toFixed(1)} (24h)
      </div>
    </div>
  )
}


export function SentimentUI2() {
  const [tab, setTab] = useState<'overview' | 'symbols' | 'news' | 'social' | 'feargreed'>('overview')
  const [symbols, setSymbols] = useState<SymbolSentiment[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [social, setSocial] = useState<SocialEntry[]>([])
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [sentFilter, setSentFilter] = useState<string>('all')
  const [selectedSym, setSelectedSym] = useState<string | null>(null)
  const [newsSearch, setNewsSearch] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSymbols = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/sentiment/symbols')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.sentiments ?? d.data ?? []
      setSymbols(raw.map((s: any) => ({
        symbol: s.symbol ?? '',
        overall: (s.overall_sentiment ?? s.sentiment ?? 'neutral') as SentimentLabel,
        score: Number(s.score ?? 0),
        bullishCount: Number(s.bullish_count ?? 0),
        bearishCount: Number(s.bearish_count ?? 0),
        neutralCount: Number(s.neutral_count ?? 0),
        articleCount: Number(s.article_count ?? 0),
        socialVolume: Number(s.social_volume ?? 0),
        socialScore: Number(s.social_score ?? 0),
        topHeadline: s.top_headline ?? '',
        change1h: Number(s.change_1h ?? 0),
        change24h: Number(s.change_24h ?? 0),
        analystBullish: Number(s.analyst_bullish ?? 0),
        analystBearish: Number(s.analyst_bearish ?? 0),
        analystNeutral: Number(s.analyst_neutral ?? 0),
        putCallRatio: Number(s.put_call_ratio ?? 0),
        shortInterest: Number(s.short_interest ?? 0),
      })))
      setErr(null)
    } catch (e: any) { setErr(e.message) }
  }, [])

  const fetchNews = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/sentiment/news')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.articles ?? d.news ?? d.data ?? []
      setNews(raw.map((n: any) => ({
        id: n.id ?? String(Math.random()),
        headline: n.headline ?? n.title ?? '',
        source: n.source ?? n.provider ?? '',
        publishedAt: n.published_at ?? n.timestamp ?? '',
        symbols: n.symbols ?? n.tickers ?? [],
        sentiment: (n.sentiment ?? 'neutral') as SentimentLabel,
        score: Number(n.score ?? 0),
        url: n.url ?? '',
        summary: n.summary ?? n.description ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  const fetchSocial = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/sentiment/social')
      if (!r.ok) return
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.social ?? d.data ?? []
      setSocial(raw.map((s: any) => ({
        platform: s.platform ?? 'Twitter/X',
        symbol: s.symbol ?? '',
        mentions: Number(s.mentions ?? 0),
        bullish: Number(s.bullish ?? 0),
        bearish: Number(s.bearish ?? 0),
        volume24h: Number(s.volume_24h ?? s.volume ?? 0),
        trend: s.trend ?? 'flat',
        topPost: s.top_post ?? '',
      })))
    } catch { /* empty */ }
  }, [])

  const fetchFearGreed = useCallback(async () => {
    try {
      const r = await fetch('/api/v4/sentiment/fear-greed')
      if (!r.ok) return
      const d = await r.json()
      setFearGreed({
        current: Number(d.current ?? d.value ?? 50),
        previous: Number(d.previous ?? d.yesterday ?? 50),
        label: d.label ?? d.rating ?? 'Neutral',
        change24h: Number(d.change_24h ?? 0),
        vix: Number(d.vix ?? 0),
        putCall: Number(d.put_call ?? 0),
        junkBond: Number(d.junk_bond ?? 0),
        marketMomentum: Number(d.market_momentum ?? 0),
        stockBreadth: Number(d.stock_breadth ?? 0),
        safeHaven: Number(d.safe_haven ?? 0),
      })
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSymbols(), fetchNews(), fetchSocial(), fetchFearGreed()])
      .finally(() => setLoading(false))
    pollRef.current = setInterval(() => { fetchSymbols(); fetchFearGreed() }, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchSymbols, fetchNews, fetchSocial, fetchFearGreed])

  // ── filters ────────────────────────────────────────────────────────────────
  const filteredSymbols = symbols.filter(s => {
    if (symbolSearch && !s.symbol.toUpperCase().includes(symbolSearch.toUpperCase())) return false
    if (sentFilter !== 'all' && s.overall !== sentFilter) return false
    return true
  })

  const filteredNews = news.filter(n => {
    if (newsSearch) {
      const q = newsSearch.toLowerCase()
      return n.headline.toLowerCase().includes(q) || n.symbols.some(s => s.toLowerCase().includes(q))
    }
    if (sentFilter !== 'all' && n.sentiment !== sentFilter) return false
    return true
  })

  // ── overview stats ──────────────────────────────────────────────────────────
  const bullishCount = symbols.filter(s => s.overall === 'bullish' || s.overall === 'strongly_bullish').length
  const bearishCount = symbols.filter(s => s.overall === 'bearish' || s.overall === 'strongly_bearish').length
  const neutralCount = symbols.filter(s => s.overall === 'neutral').length
  const avgScore = symbols.length > 0 ? symbols.reduce((s, x) => s + x.score, 0) / symbols.length : 0
  const marketMood: SentimentLabel = avgScore > 0.3 ? 'bullish' : avgScore < -0.3 ? 'bearish' : 'neutral'

  const tabs = [
    { id: 'overview' as const, label: 'OVERVIEW' },
    { id: 'symbols' as const, label: 'SYMBOL SENTIMENT' },
    { id: 'news' as const, label: 'NEWS FLOW' },
    { id: 'social' as const, label: 'SOCIAL' },
    { id: 'feargreed' as const, label: 'FEAR & GREED' },
  ]

  const sentFilterBar = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      {['all', 'strongly_bullish', 'bullish', 'neutral', 'bearish', 'strongly_bearish'].map(s => (
        <button key={s} onClick={() => setSentFilter(s)}
          style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            color: sentFilter === s ? '#000' : s === 'all' ? TEXT : sentColor(s as SentimentLabel),
            background: sentFilter === s ? (s === 'all' ? AMBER : sentColor(s as SentimentLabel)) : 'transparent',
            border: `1px solid ${s === 'all' ? BORDER : sentColor(s as SentimentLabel) + '44'}`,
            borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
          {s.replace('_', ' ')}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>SENT</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>MARKET SENTIMENT</span>
          <SentBadge sentiment={marketMood} />
          <span style={{ fontSize: 10, color: SUBTLE }}>Avg Score: {avgScore.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: GREEN }}>{bullishCount} BULLS</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>|</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>{neutralCount} NEUTRAL</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>|</span>
          <span style={{ fontSize: 10, color: RED }}>{bearishCount} BEARS</span>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Symbols Tracked" value={symbols.length} />
        <StatCard label="Avg Sent Score" value={avgScore.toFixed(2)} col={avgScore > 0 ? GREEN : avgScore < 0 ? RED : SUBTLE} />
        <StatCard label="Bull/Bear Ratio" value={bearishCount > 0 ? (bullishCount / bearishCount).toFixed(2) : '∞'} col={bullishCount > bearishCount ? GREEN : RED} />
        <StatCard label="News Articles" value={news.length} />
        <StatCard label="Social Entries" value={social.length} />
        <StatCard label="Fear & Greed" value={fearGreed?.current ?? '—'} col={fearGreed ? (fearGreed.current > 60 ? GREEN : fearGreed.current < 40 ? RED : AMBER) : SUBTLE} sub={fearGreed?.label} />
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading sentiment data...</div>}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              {/* sentiment distribution */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Sentiment Distribution</div>
                {[
                  ['Strongly Bullish', '#00e676', symbols.filter(s => s.overall === 'strongly_bullish').length],
                  ['Bullish', GREEN, symbols.filter(s => s.overall === 'bullish').length],
                  ['Neutral', SUBTLE, symbols.filter(s => s.overall === 'neutral').length],
                  ['Bearish', RED, symbols.filter(s => s.overall === 'bearish').length],
                  ['Strongly Bearish', '#b71c1c', symbols.filter(s => s.overall === 'strongly_bearish').length],
                ].map(([l, c, count]) => {
                  const pct = symbols.length > 0 ? ((count as number) / symbols.length) * 100 : 0
                  return (
                    <div key={l as string} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: c as string }}>{l as string}</span>
                        <span style={{ fontSize: 10, color: SUBTLE }}>{count as number} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 5, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c as string, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* market gauge */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Market Sentiment Score</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <ScoreGauge score={avgScore} size={90} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <SentBadge sentiment={marketMood} />
                </div>
              </div>

              {/* most bullish/bearish */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: GREEN, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Most Bullish</div>
                {symbols.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(s => (
                  <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ color: AMBER, fontWeight: 700 }}>{s.symbol}</span>
                    <span style={{ color: GREEN }}>{s.score.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: RED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 8 }}>Most Bearish</div>
                {symbols.filter(s => s.score < 0).sort((a, b) => a.score - b.score).slice(0, 4).map(s => (
                  <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ color: AMBER, fontWeight: 700 }}>{s.symbol}</span>
                    <span style={{ color: RED }}>{s.score.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* top headlines */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Top Headlines — Latest Sentiment</div>
              {news.slice(0, 10).map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <SentBadge sentiment={n.sentiment} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.4 }}>{n.headline}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 9, color: SUBTLE }}>{n.source}</span>
                      <span style={{ fontSize: 9, color: SUBTLE }}>{fmtTime(n.publishedAt)}</span>
                      {n.symbols.slice(0, 3).map(s => <span key={s} style={{ fontSize: 9, color: AMBER }}>{s}</span>)}
                    </div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: n.score > 0 ? GREEN : RED, minWidth: 40, textAlign: 'right' }}>{n.score.toFixed(2)}</span>
                </div>
              ))}
              {news.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No news data</div>}
            </div>
          </>
        )}

        {/* ── SYMBOLS ── */}
        {tab === 'symbols' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={symbolSearch} onChange={e => setSymbolSearch(e.target.value.toUpperCase())} placeholder="FILTER SYMBOL"
                style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 120, outline: 'none' }} />
              {sentFilterBar}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Sentiment</Th><Th right>Score</Th>
                    <Th right>Bull/Bear/Neu</Th><Th right>Articles</Th>
                    <Th right>Social Vol</Th><Th right>P/C Ratio</Th>
                    <Th right>Short Int</Th><Th right>Δ 24h</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSymbols.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Loading...' : 'No symbols'}
                    </td></tr>
                  )}
                  {filteredSymbols.sort((a, b) => b.score - a.score).map(s => (
                    <tr key={s.symbol} onClick={() => setSelectedSym(selectedSym === s.symbol ? null : s.symbol)}
                      style={{ cursor: 'pointer', background: selectedSym === s.symbol ? '#141414' : 'transparent' }}>
                      <Td mono col={AMBER}>{s.symbol}</Td>
                      <Td><SentBadge sentiment={s.overall} /></Td>
                      <Td right mono col={s.score > 0 ? GREEN : s.score < 0 ? RED : SUBTLE}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.abs(s.score) * 100)}%`, height: '100%', background: s.score > 0 ? GREEN : RED }} />
                          </div>
                          {s.score.toFixed(2)}
                        </div>
                      </Td>
                      <Td right>
                        <div style={{ minWidth: 120 }}>
                          <SentBar bullish={s.bullishCount} bearish={s.bearishCount} neutral={s.neutralCount} />
                          <div style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 9 }}>
                            <span style={{ color: GREEN }}>{s.bullishCount}</span>
                            <span style={{ color: RED }}>{s.bearishCount}</span>
                            <span style={{ color: SUBTLE }}>{s.neutralCount}</span>
                          </div>
                        </div>
                      </Td>
                      <Td right mono>{s.articleCount}</Td>
                      <Td right mono col={s.socialVolume > 1000 ? BLUE : SUBTLE}>{s.socialVolume > 1000 ? `${(s.socialVolume / 1000).toFixed(1)}K` : String(s.socialVolume)}</Td>
                      <Td right mono col={s.putCallRatio > 1 ? RED : s.putCallRatio < 0.7 ? GREEN : SUBTLE}>{s.putCallRatio > 0 ? s.putCallRatio.toFixed(2) : '—'}</Td>
                      <Td right mono col={s.shortInterest > 20 ? RED : SUBTLE}>{s.shortInterest > 0 ? `${s.shortInterest.toFixed(1)}%` : '—'}</Td>
                      <Td right mono col={s.change24h > 0 ? GREEN : s.change24h < 0 ? RED : SUBTLE}>{s.change24h > 0 ? '+' : ''}{s.change24h.toFixed(2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* symbol detail */}
            {selectedSym && (() => {
              const s = symbols.find(x => x.symbol === selectedSym)
              if (!s) return null
              const symNews = news.filter(n => n.symbols.includes(selectedSym))
              return (
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 11, color: AMBER, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>{s.symbol} Sentiment Detail</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div style={{ textAlign: 'center', background: GREEN + '22', border: `1px solid ${GREEN}44`, borderRadius: 4, padding: 8 }}>
                          <div style={{ fontSize: 9, color: SUBTLE }}>BULLISH</div>
                          <div style={{ fontSize: 16, color: GREEN, fontWeight: 700 }}>{s.bullishCount}</div>
                        </div>
                        <div style={{ textAlign: 'center', background: SUBTLE + '22', border: `1px solid ${SUBTLE}44`, borderRadius: 4, padding: 8 }}>
                          <div style={{ fontSize: 9, color: SUBTLE }}>NEUTRAL</div>
                          <div style={{ fontSize: 16, color: SUBTLE, fontWeight: 700 }}>{s.neutralCount}</div>
                        </div>
                        <div style={{ textAlign: 'center', background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 4, padding: 8 }}>
                          <div style={{ fontSize: 9, color: SUBTLE }}>BEARISH</div>
                          <div style={{ fontSize: 16, color: RED, fontWeight: 700 }}>{s.bearishCount}</div>
                        </div>
                      </div>
                      <SentBar bullish={s.bullishCount} bearish={s.bearishCount} neutral={s.neutralCount} />
                      {s.topHeadline && <div style={{ fontSize: 11, color: SUBTLE, marginTop: 10, lineHeight: 1.5 }}>"{s.topHeadline}"</div>}
                    </div>
                    <div>
                      {[
                        ['Sentiment Score', s.score.toFixed(3), s.score > 0 ? GREEN : RED],
                        ['Article Count', String(s.articleCount), TEXT],
                        ['Social Volume', s.socialVolume.toLocaleString(), BLUE],
                        ['Put/Call Ratio', s.putCallRatio > 0 ? s.putCallRatio.toFixed(2) : '—', s.putCallRatio > 1 ? RED : GREEN],
                        ['Short Interest', s.shortInterest > 0 ? `${s.shortInterest.toFixed(1)}%` : '—', s.shortInterest > 20 ? RED : SUBTLE],
                        ['Analyst Bull', String(s.analystBullish), GREEN],
                        ['Analyst Bear', String(s.analystBearish), RED],
                      ].map(([l, v, c]) => (
                        <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                          <span style={{ fontSize: 11, color: SUBTLE }}>{l as string}</span>
                          <span style={{ fontSize: 11, color: c as string, fontFamily: MONO }}>{v as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {symNews.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Recent News — {selectedSym}</div>
                      {symNews.slice(0, 5).map(n => (
                        <div key={n.id} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BORDER}`, alignItems: 'center' }}>
                          <SentBadge sentiment={n.sentiment} />
                          <span style={{ flex: 1, fontSize: 11, color: TEXT }}>{n.headline}</span>
                          <span style={{ fontSize: 9, color: SUBTLE, whiteSpace: 'nowrap' }}>{fmtTime(n.publishedAt)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })()}
          </>
        )}

        {/* ── NEWS FLOW ── */}
        {tab === 'news' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newsSearch} onChange={e => setNewsSearch(e.target.value)} placeholder="Search headlines..."
                style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 200, outline: 'none' }} />
              {sentFilterBar}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredNews.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No news</div>}
              {filteredNews.map(n => (
                <div key={n.id} style={{ background: PANEL, border: `1px solid ${n.sentiment === 'bullish' || n.sentiment === 'strongly_bullish' ? GREEN + '44' : n.sentiment === 'bearish' || n.sentiment === 'strongly_bearish' ? RED + '44' : BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <SentBadge sentiment={n.sentiment} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, fontWeight: 500 }}>{n.headline}</div>
                      {n.summary && <div style={{ fontSize: 11, color: SUBTLE, marginTop: 4, lineHeight: 1.4 }}>{n.summary}</div>}
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: SUBTLE }}>{n.source}</span>
                        <span style={{ fontSize: 9, color: SUBTLE }}>{fmtTime(n.publishedAt)}</span>
                        {n.symbols.slice(0, 5).map(s => (
                          <span key={s} style={{ fontSize: 9, color: AMBER, background: '#0d0d0d', border: `1px solid ${AMBER}33`, borderRadius: 2, padding: '1px 5px' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: n.score > 0 ? GREEN : RED, minWidth: 44, textAlign: 'right' }}>{n.score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SOCIAL ── */}
        {tab === 'social' && (
          <>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Platform</Th><Th>Symbol</Th>
                    <Th right>Mentions</Th><Th right>Bullish</Th><Th right>Bearish</Th>
                    <Th right>Vol 24h</Th><Th>Trend</Th><Th>Top Post</Th>
                  </tr>
                </thead>
                <tbody>
                  {social.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No social data
                    </td></tr>
                  )}
                  {social.sort((a, b) => b.mentions - a.mentions).map((s, i) => {
                    const trendCol = { spiking: RED, rising: AMBER, flat: SUBTLE, falling: BLUE }[s.trend] || SUBTLE
                    const trendSym = { spiking: '🔥', rising: '▲', flat: '━', falling: '▼' }[s.trend] || '—'
                    return (
                      <tr key={i}>
                        <Td mono col={PURPLE}>{s.platform}</Td>
                        <Td mono col={AMBER}>{s.symbol}</Td>
                        <Td right mono>{s.mentions.toLocaleString()}</Td>
                        <Td right mono col={GREEN}>{s.bullish.toLocaleString()}</Td>
                        <Td right mono col={RED}>{s.bearish.toLocaleString()}</Td>
                        <Td right mono>{s.volume24h.toLocaleString()}</Td>
                        <Td><span style={{ color: trendCol, fontFamily: MONO, fontSize: 11 }}>{trendSym} {s.trend}</span></Td>
                        <Td><div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: SUBTLE }}>{s.topPost}</div></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* top trending */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: RED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🔥 Trending / Spiking</div>
                {social.filter(s => s.trend === 'spiking' || s.trend === 'rising').slice(0, 8).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>
                    <span style={{ color: AMBER }}>{s.symbol}</span>
                    <span style={{ color: SUBTLE }}>{s.platform}</span>
                    <span style={{ color: s.trend === 'spiking' ? RED : AMBER }}>{s.mentions.toLocaleString()} mentions</span>
                  </div>
                ))}
                {social.filter(s => s.trend === 'spiking' || s.trend === 'rising').length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>None trending</div>}
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 10, color: GREEN, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Bull/Bear Social Ratio</div>
                {social.slice(0, 8).map((s, i) => {
                  const total = s.bullish + s.bearish
                  const bullPct = total > 0 ? (s.bullish / total) * 100 : 0
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: AMBER }}>{s.symbol}</span>
                        <span style={{ fontSize: 10, color: SUBTLE }}>{bullPct.toFixed(0)}% bull</span>
                      </div>
                      <SentBar bullish={s.bullish} bearish={s.bearish} neutral={0} />
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── FEAR & GREED ── */}
        {tab === 'feargreed' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Fear & Greed Index</div>
                {fearGreed ? <FearGreedDial data={fearGreed} /> : <div style={{ color: SUBTLE, fontSize: 11 }}>No data</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {fearGreed && [
                  ['VIX Level', fearGreed.vix.toFixed(2), fearGreed.vix > 30 ? RED : fearGreed.vix > 20 ? AMBER : GREEN, 'Volatility fear indicator'],
                  ['Put/Call Ratio', fearGreed.putCall.toFixed(2), fearGreed.putCall > 1 ? RED : GREEN, '> 1 = fear, < 0.7 = greed'],
                  ['Junk Bond Demand', `${fearGreed.junkBond.toFixed(1)}%`, fearGreed.junkBond > 0 ? GREEN : RED, 'Spread vs investment grade'],
                  ['Market Momentum', `${fearGreed.marketMomentum.toFixed(1)}%`, fearGreed.marketMomentum > 0 ? GREEN : RED, 'S&P 500 vs 125d MA'],
                  ['Stock Breadth', `${fearGreed.stockBreadth.toFixed(1)}%`, fearGreed.stockBreadth > 50 ? GREEN : RED, '% stocks above 52w high'],
                  ['Safe Haven Demand', `${fearGreed.safeHaven.toFixed(1)}%`, fearGreed.safeHaven > 0 ? RED : GREEN, 'Bonds vs stocks spread'],
                ].map(([l, v, c, d]) => (
                  <div key={l as string} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', marginBottom: 4 }}>{l as string}</div>
                    <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: c as string }}>{v as string}</div>
                    <div style={{ fontSize: 9, color: SUBTLE, marginTop: 3 }}>{d as string}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* fear & greed scale */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
              <div style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Scale Reference</div>
              <div style={{ display: 'flex', gap: 0, height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                {[
                  ['EXTREME FEAR', '#b71c1c', '0-20'],
                  ['FEAR', RED, '21-40'],
                  ['NEUTRAL', AMBER, '41-60'],
                  ['GREED', GREEN, '61-80'],
                  ['EXTREME GREED', '#00e676', '81-100'],
                ].map(([l, c]) => (
                  <div key={l as string} style={{ flex: 1, background: c as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontFamily: MONO, color: '#000', fontWeight: 700 }}>
                    {(l as string).split(' ')[0]}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 0, justifyContent: 'space-between' }}>
                {[0, 20, 40, 60, 80, 100].map(v => (
                  <span key={v} style={{ fontSize: 8, color: SUBTLE, fontFamily: MONO }}>{v}</span>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>
                The Fear & Greed Index synthesizes 6 market indicators: VIX volatility, put/call ratio,
                junk bond demand spread, S&P 500 momentum vs 125-day MA, stock price breadth (McClellan Volume Summation),
                and safe-haven asset demand (bonds vs stocks). Each indicator is normalized and weighted equally.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
