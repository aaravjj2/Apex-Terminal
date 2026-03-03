import React, { useState, useEffect, useCallback } from 'react'
﻿// NewsEnrichmentUI2 â€” Bloomberg NEWS NLP-enriched news terminal
// Live feed, entity extraction, sentiment scoring, alerts, audit
// Tabs: FEED | ENTITIES | SENTIMENT | ALERTS | AUDIT
// APIs: /api/v4/news/feed, /entities, /sentiment, /alerts, /audit

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

interface NewsItem {
  newsId: string
  headline: string
  source: string
  category: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sentimentScore: number
  relevanceScore: number
  entityCount: number
  topEntities: string[]
  tickers: string[]
  url: string
  breaking: boolean
}

interface EntityRecord {
  entityId: string
  name: string
  entityType: string
  ticker: string
  mentionCount: number
  sentimentScore: number
  articles: number
  trend: 'rising' | 'falling' | 'stable'
  category: string
  lastMentioned: string
}

interface SentimentEntry {
  sentimentId: string
  ticker: string
  entity: string
  overallSentiment: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  volume: number
  period: string
  change24h: number
  dominant: string
}

interface NewsAlert {
  alertId: string
  trigger: string
  headline: string
  ticker: string
  severity: 'high' | 'medium' | 'low'
  sentimentShift: number
  mentionSpike: number
  status: 'active' | 'acknowledged' | 'resolved'
  triggeredAt: string
}

interface NewsAuditEntry {
  auditId: string
  action: string
  actor: string
  target: string
  outcome: 'pass' | 'fail' | 'warn'
  notes: string
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
function SentBadge({ s }: { s: string }) {
  const m: Record<string, string> = { positive: GREEN, negative: RED, neutral: SUBTLE, mixed: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SentBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100
  const col = score > 0.2 ? GREEN : score < -0.2 ? RED : SUBTLE
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{score.toFixed(2)}</span>
    </div>
  )
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: RED, acknowledged: AMBER, resolved: GREEN, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function TrendArrow({ t }: { t: string }) {
  const c = t === 'rising' ? GREEN : t === 'falling' ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{t === 'rising' ? 'â–²' : t === 'falling' ? 'â–¼' : 'â†’'} {t.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { high: RED, medium: AMBER, low: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function NewsEnrichmentUI2() {
  const [tab, setTab] = useState<'feed' | 'entities' | 'sentiment' | 'alerts' | 'audit'>('feed')
  const [feed, setFeed] = useState<NewsItem[]>([])
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [sentiment, setSentiment] = useState<SentimentEntry[]>([])
  const [alerts, setAlerts] = useState<NewsAlert[]>([])
  const [auditLog, setAuditLog] = useState<NewsAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rF, rE, rS, rA, rAu] = await Promise.allSettled([
        fetch('/api/v4/news/feed').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/news/entities').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/news/sentiment').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/news/alerts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/news/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.items ?? rF.value.feed ?? rF.value.data ?? []
        setFeed(raw.map((n: any) => ({
          newsId: n.news_id ?? n.newsId ?? n.id ?? '', headline: n.headline ?? n.title ?? '',
          source: n.source ?? '', category: n.category ?? '',
          publishedAt: n.published_at ?? n.publishedAt ?? '', sentiment: n.sentiment ?? 'neutral',
          sentimentScore: Number(n.sentiment_score ?? n.sentimentScore ?? 0),
          relevanceScore: Number(n.relevance_score ?? n.relevanceScore ?? 0),
          entityCount: Number(n.entity_count ?? n.entityCount ?? 0),
          topEntities: Array.isArray(n.top_entities) ? n.top_entities : n.topEntities ?? [],
          tickers: Array.isArray(n.tickers) ? n.tickers : [],
          url: n.url ?? '', breaking: Boolean(n.breaking ?? false),
        })))
        setErr(null)
      } else setErr('Failed to load feed')
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.entities ?? rE.value.data ?? []
        setEntities(raw.map((e: any) => ({
          entityId: e.entity_id ?? e.entityId ?? '', name: e.name ?? '',
          entityType: e.entity_type ?? e.entityType ?? '', ticker: e.ticker ?? '',
          mentionCount: Number(e.mention_count ?? e.mentionCount ?? 0),
          sentimentScore: Number(e.sentiment_score ?? e.sentimentScore ?? 0),
          articles: Number(e.articles ?? 0), trend: e.trend ?? 'stable',
          category: e.category ?? '', lastMentioned: e.last_mentioned ?? e.lastMentioned ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sentiment ?? rS.value.data ?? []
        setSentiment(raw.map((s: any) => ({
          sentimentId: s.sentiment_id ?? s.sentimentId ?? '', ticker: s.ticker ?? '', entity: s.entity ?? '',
          overallSentiment: Number(s.overall_sentiment ?? s.overallSentiment ?? 0),
          positiveCount: Number(s.positive_count ?? s.positiveCount ?? 0),
          negativeCount: Number(s.negative_count ?? s.negativeCount ?? 0),
          neutralCount: Number(s.neutral_count ?? s.neutralCount ?? 0),
          volume: Number(s.volume ?? 0), period: s.period ?? '',
          change24h: Number(s.change_24h ?? s.change24h ?? 0), dominant: s.dominant ?? 'neutral',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.alerts ?? rA.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          alertId: a.alert_id ?? a.alertId ?? '', trigger: a.trigger ?? '', headline: a.headline ?? '',
          ticker: a.ticker ?? '', severity: a.severity ?? 'low',
          sentimentShift: Number(a.sentiment_shift ?? a.sentimentShift ?? 0),
          mentionSpike: Number(a.mention_spike ?? a.mentionSpike ?? 0),
          status: a.status ?? 'active', triggeredAt: a.triggered_at ?? a.triggeredAt ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          target: a.target ?? '', outcome: a.outcome ?? 'pass', notes: a.notes ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const breakingCount = feed.filter(n => n.breaking).length
  const negativeCount = feed.filter(n => n.sentiment === 'negative').length
  const activeAlerts = alerts.filter(a => a.status === 'active').length
  const risingEntities = entities.filter(e => e.trend === 'rising').length

  const TABS2 = [
    { id: 'feed' as const, label: 'FEED' },
    { id: 'entities' as const, label: 'ENTITIES' },
    { id: 'sentiment' as const, label: 'SENTIMENT' },
    { id: 'alerts' as const, label: 'ALERTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>NEWS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>NLP-ENRICHED NEWS FEED â€” ENTITY EXTRACTION + SENTIMENT SCORING + ALERT TRIGGERS</span>
        {breakingCount > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {breakingCount} BREAKING</span>}
        {activeAlerts > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {activeAlerts} ALERTS</span>}
        {negativeCount > 5 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {negativeCount} NEGATIVE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Articles" value={feed.length} col={BLUE} />
        <StatCard label="Breaking" value={breakingCount} col={breakingCount > 0 ? RED : SUBTLE} />
        <StatCard label="Active Alerts" value={activeAlerts} col={activeAlerts > 0 ? ORANGE : GREEN} />
        <StatCard label="Entities Tracked" value={entities.length} col={PURPLE} />
        <StatCard label="Rising Entities" value={risingEntities} col={risingEntities > 0 ? GREEN : SUBTLE} />
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

        {tab === 'feed' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Headline</Th><Th>Source</Th><Th>Category</Th><Th>Sentiment</Th><Th>Score</Th><Th right>Relevance</Th><Th>Tickers</Th><Th right>Entities</Th><Th>Breaking</Th><Th>Published</Th></tr></thead>
              <tbody>
                {feed.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No news â€” check /api/v4/news/feed</td></tr>}
                {[...feed].sort((a, b) => (b.breaking ? 1 : 0) - (a.breaking ? 1 : 0)).map((n, i) => (
                  <tr key={i} style={{ background: n.breaking ? RED + '0a' : n.sentiment === 'negative' ? RED + '07' : 'transparent' }}>
                    <Td mono col={n.breaking ? RED : AMBER}>{n.headline.slice(0, 60)}{n.headline.length > 60 ? 'â€¦' : ''}</Td>
                    <Td mono col={BLUE}>{n.source}</Td>
                    <Td mono col={PURPLE}>{n.category}</Td>
                    <Td><SentBadge s={n.sentiment} /></Td>
                    <Td><SentBar score={n.sentimentScore} /></Td>
                    <Td right mono col={n.relevanceScore > 0.8 ? GREEN : SUBTLE}>{n.relevanceScore.toFixed(2)}</Td>
                    <Td mono col={AMBER}>{n.tickers.join(', ') || 'â€”'}</Td>
                    <Td right mono col={n.entityCount > 5 ? ORANGE : SUBTLE}>{n.entityCount}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.breaking ? RED : SUBTLE }}>{n.breaking ? '⚠‘ BREAKING' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{n.publishedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'entities' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Entity</Th><Th>Type</Th><Th>Ticker</Th><Th>Category</Th><Th>Trend</Th><Th>Sentiment</Th><Th right>Mentions</Th><Th right>Articles</Th><Th>Last Mentioned</Th></tr></thead>
              <tbody>
                {entities.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No entities â€” check /api/v4/news/entities</td></tr>}
                {entities.sort((a, b) => b.mentionCount - a.mentionCount).map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.name}</Td>
                    <Td mono col={BLUE}>{e.entityType}</Td>
                    <Td mono col={ORANGE}>{e.ticker || 'â€”'}</Td>
                    <Td mono col={PURPLE}>{e.category}</Td>
                    <Td><TrendArrow t={e.trend} /></Td>
                    <Td><SentBar score={e.sentimentScore} /></Td>
                    <Td right mono col={e.mentionCount > 50 ? ORANGE : SUBTLE}>{e.mentionCount}</Td>
                    <Td right mono col={SUBTLE}>{e.articles}</Td>
                    <Td mono col={SUBTLE}>{e.lastMentioned}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sentiment' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Ticker</Th><Th>Entity</Th><Th>Period</Th><Th>Sentiment</Th><Th>Dominant</Th><Th right>Positive</Th><Th right>Negative</Th><Th right>Neutral</Th><Th right>Volume</Th><Th right>24h Change</Th></tr></thead>
              <tbody>
                {sentiment.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sentiment data â€” check /api/v4/news/sentiment</td></tr>}
                {sentiment.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.ticker || 'â€”'}</Td>
                    <Td mono col={BLUE}>{s.entity}</Td>
                    <Td mono col={SUBTLE}>{s.period}</Td>
                    <Td><SentBar score={s.overallSentiment} /></Td>
                    <Td><SentBadge s={s.dominant} /></Td>
                    <Td right mono col={GREEN}>{s.positiveCount}</Td>
                    <Td right mono col={RED}>{s.negativeCount}</Td>
                    <Td right mono col={SUBTLE}>{s.neutralCount}</Td>
                    <Td right mono col={SUBTLE}>{s.volume.toLocaleString()}</Td>
                    <Td right mono col={s.change24h > 0 ? GREEN : s.change24h < 0 ? RED : SUBTLE}>{s.change24h > 0 ? '+' : ''}{s.change24h.toFixed(3)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Alert ID</Th><Th>Trigger</Th><Th>Headline</Th><Th>Ticker</Th><Th>Severity</Th><Th>Status</Th><Th right>Sentiment Shift</Th><Th right>Mention Spike</Th><Th>Triggered</Th></tr></thead>
              <tbody>
                {alerts.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts â€” check /api/v4/news/alerts</td></tr>}
                {alerts.sort((a, b) => {
                  const p: Record<string, number> = { high: 0, medium: 1, low: 2 }
                  return (p[a.severity] ?? 3) - (p[b.severity] ?? 3)
                }).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'high' && a.status === 'active' ? RED + '0a' : 'transparent', opacity: a.status === 'resolved' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{a.alertId}</Td>
                    <Td mono col={ORANGE}>{a.trigger}</Td>
                    <Td mono col={TEXT}>{a.headline.slice(0, 40)}{a.headline.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={BLUE}>{a.ticker || 'â€”'}</Td>
                    <Td><SevBadge s={a.severity} /></Td>
                    <Td><StatusBadge2 s={a.status} /></Td>
                    <Td right mono col={Math.abs(a.sentimentShift) > 0.3 ? RED : SUBTLE}>{a.sentimentShift > 0 ? '+' : ''}{a.sentimentShift.toFixed(3)}</Td>
                    <Td right mono col={a.mentionSpike > 200 ? ORANGE : SUBTLE}>{a.mentionSpike.toFixed(0)}%</Td>
                    <Td mono col={SUBTLE}>{a.triggeredAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Target</Th><Th>Outcome</Th><Th>Notes</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/news/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.target}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.notes || 'â€”'}</Td>
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
