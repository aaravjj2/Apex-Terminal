import React, { useState, useEffect, useCallback } from 'react'
﻿// ThemeClusteringUI2 — Bloomberg APEX ML Theme Clustering terminal
// Thematic clustering of market sectors, narratives, factor exposures, cluster evolution
// Tabs: CLUSTERS | NARRATIVES | EXPOSURE | EVOLUTION | AUDIT
// APIs: /api/v4/themes/clusters, /narratives, /exposure, /evolution, /audit

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

interface ThemeCluster {
  clusterId: string
  name: string
  sector: string
  algorithmType: 'kmeans' | 'hierarchical' | 'dbscan' | 'spectral' | 'lda' | 'bertopic'
  cohesionScore: number
  separationScore: number
  silhouetteScore: number
  memberCount: number
  dominantKeywords: string[]
  topHoldings: string[]
  marketCapBillions: number
  returnYtd: number
  volatility: number
  status: 'stable' | 'forming' | 'splitting' | 'merging' | 'dissolving'
  lastUpdated: string
}

interface ThemeNarrative {
  narrativeId: string
  theme: string
  headline: string
  momentum: number
  sentiment: number
  buySideExposurePct: number
  mediaIntensity: number
  clusterCount: number
  catalysts: string[]
  risks: string[]
  direction: 'rising' | 'falling' | 'stable' | 'reversing'
  timeHorizon: 'short' | 'medium' | 'long'
  firstSeenAt: string
  lastUpdated: string
}

interface ThemeExposure {
  exposureId: string
  portfolioId: string
  portfolioName: string
  clusterId: string
  clusterName: string
  exposurePct: number
  absoluteValueUsd: number
  betaToCluster: number
  correlationToTheme: number
  activeWeight: number
  benchmarkWeight: number
  activeExposure: number
  riskContribution: number
}

interface ClusterEvolution {
  evolutionId: string
  clusterId: string
  clusterName: string
  eventType: 'split' | 'merge' | 'birth' | 'death' | 'rotation' | 'membership_change' | 'rename'
  description: string
  affectedSymbols: number
  impactScore: number
  occurredAt: string
}

interface ThemeAuditEntry {
  auditId: string
  clusterId: string
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
  const m: Record<string, string> = { stable: GREEN, forming: BLUE, splitting: AMBER, merging: PURPLE, dissolving: RED, rising: GREEN, falling: RED, reversing: ORANGE, short: AMBER, medium: BLUE, long: PURPLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function AlgoBadge({ a }: { a: string }) {
  const m: Record<string, string> = { kmeans: BLUE, hierarchical: PURPLE, dbscan: GREEN, spectral: ORANGE, lda: AMBER, bertopic: RED }
  const c = m[a] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{a.toUpperCase()}</span>
}
function SentBar({ val, min = -1, max = 1 }: { val: number; min?: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))
  const col = val > 0.2 ? GREEN : val < -0.2 ? RED : AMBER
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{val.toFixed(2)}</span>
    </div>
  )
}


export function ThemeClusteringUI2() {
  const [tab, setTab] = useState<'clusters' | 'narratives' | 'exposure' | 'evolution' | 'audit'>('clusters')
  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [narratives, setNarratives] = useState<ThemeNarrative[]>([])
  const [exposure, setExposure] = useState<ThemeExposure[]>([])
  const [evolution, setEvolution] = useState<ClusterEvolution[]>([])
  const [auditLog, setAuditLog] = useState<ThemeAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rC, rN, rE, rEv, rA] = await Promise.allSettled([
        fetch('/api/v4/themes/clusters').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/themes/narratives').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/themes/exposure').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/themes/evolution').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/themes/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.clusters ?? rC.value.data ?? []
        setClusters(raw.map((c: any) => ({
          clusterId: c.cluster_id ?? c.clusterId ?? '', name: c.name ?? '',
          sector: c.sector ?? '', algorithmType: c.algorithm_type ?? c.algorithmType ?? 'kmeans',
          cohesionScore: Number(c.cohesion_score ?? c.cohesionScore ?? 0),
          separationScore: Number(c.separation_score ?? c.separationScore ?? 0),
          silhouetteScore: Number(c.silhouette_score ?? c.silhouetteScore ?? 0),
          memberCount: Number(c.member_count ?? c.memberCount ?? 0),
          dominantKeywords: c.dominant_keywords ?? c.dominantKeywords ?? [],
          topHoldings: c.top_holdings ?? c.topHoldings ?? [],
          marketCapBillions: Number(c.market_cap_billions ?? c.marketCapBillions ?? 0),
          returnYtd: Number(c.return_ytd ?? c.returnYtd ?? 0),
          volatility: Number(c.volatility ?? 0),
          status: c.status ?? 'stable', lastUpdated: c.last_updated ?? c.lastUpdated ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load cluster data')
      if (rN.status === 'fulfilled') {
        const raw = Array.isArray(rN.value) ? rN.value : rN.value.narratives ?? rN.value.data ?? []
        setNarratives(raw.map((n: any) => ({
          narrativeId: n.narrative_id ?? n.narrativeId ?? '', theme: n.theme ?? '',
          headline: n.headline ?? '', momentum: Number(n.momentum ?? 0),
          sentiment: Number(n.sentiment ?? 0),
          buySideExposurePct: Number(n.buy_side_exposure_pct ?? n.buySideExposurePct ?? 0),
          mediaIntensity: Number(n.media_intensity ?? n.mediaIntensity ?? 0),
          clusterCount: Number(n.cluster_count ?? n.clusterCount ?? 0),
          catalysts: n.catalysts ?? [], risks: n.risks ?? [],
          direction: n.direction ?? 'stable', timeHorizon: n.time_horizon ?? n.timeHorizon ?? 'medium',
          firstSeenAt: n.first_seen_at ?? n.firstSeenAt ?? '', lastUpdated: n.last_updated ?? n.lastUpdated ?? '',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.exposure ?? rE.value.data ?? []
        setExposure(raw.map((e: any) => ({
          exposureId: e.exposure_id ?? e.exposureId ?? '', portfolioId: e.portfolio_id ?? e.portfolioId ?? '',
          portfolioName: e.portfolio_name ?? e.portfolioName ?? '',
          clusterId: e.cluster_id ?? e.clusterId ?? '', clusterName: e.cluster_name ?? e.clusterName ?? '',
          exposurePct: Number(e.exposure_pct ?? e.exposurePct ?? 0),
          absoluteValueUsd: Number(e.absolute_value_usd ?? e.absoluteValueUsd ?? 0),
          betaToCluster: Number(e.beta_to_cluster ?? e.betaToCluster ?? 0),
          correlationToTheme: Number(e.correlation_to_theme ?? e.correlationToTheme ?? 0),
          activeWeight: Number(e.active_weight ?? e.activeWeight ?? 0),
          benchmarkWeight: Number(e.benchmark_weight ?? e.benchmarkWeight ?? 0),
          activeExposure: Number(e.active_exposure ?? e.activeExposure ?? 0),
          riskContribution: Number(e.risk_contribution ?? e.riskContribution ?? 0),
        })))
      }
      if (rEv.status === 'fulfilled') {
        const raw = Array.isArray(rEv.value) ? rEv.value : rEv.value.evolution ?? rEv.value.data ?? []
        setEvolution(raw.map((e: any) => ({
          evolutionId: e.evolution_id ?? e.evolutionId ?? '', clusterId: e.cluster_id ?? e.clusterId ?? '',
          clusterName: e.cluster_name ?? e.clusterName ?? '', eventType: e.event_type ?? e.eventType ?? 'rotation',
          description: e.description ?? '', affectedSymbols: Number(e.affected_symbols ?? e.affectedSymbols ?? 0),
          impactScore: Number(e.impact_score ?? e.impactScore ?? 0), occurredAt: e.occurred_at ?? e.occurredAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', clusterId: a.cluster_id ?? a.clusterId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const unstableClusters = clusters.filter(c => c.status !== 'stable').length
  const risingNarratives = narratives.filter(n => n.direction === 'rising').length
  const avgSilhouette = clusters.length ? clusters.reduce((a, c) => a + c.silhouetteScore, 0) / clusters.length : 0
  const highExposure = exposure.filter(e => e.exposurePct > 15).length

  const TABS2 = [
    { id: 'clusters' as const, label: 'CLUSTERS' },
    { id: 'narratives' as const, label: 'NARRATIVES' },
    { id: 'exposure' as const, label: 'EXPOSURE' },
    { id: 'evolution' as const, label: 'EVOLUTION' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>THEME CLUSTERING — ML THEMATIC SECTOR + NARRATIVE MOMENTUM + EXPOSURE ANALYTICS</span>
        {unstableClusters > 0 && <span style={{ fontSize: 10, color: AMBER }}>⚠‘ {unstableClusters} UNSTABLE CLUSTERS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Clusters" value={clusters.length} col={BLUE} />
        <StatCard label="Unstable" value={unstableClusters} col={unstableClusters > 0 ? AMBER : GREEN} />
        <StatCard label="Rising Narratives" value={risingNarratives} col={GREEN} />
        <StatCard label="Avg Silhouette" value={avgSilhouette.toFixed(3)} col={avgSilhouette > 0.5 ? GREEN : avgSilhouette > 0.3 ? AMBER : RED} />
        <StatCard label="High Exposure" value={highExposure} col={highExposure > 0 ? ORANGE : SUBTLE} />
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

        {tab === 'clusters' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Cluster ID</Th><Th>Name</Th><Th>Sector</Th><Th>Algorithm</Th><Th>Status</Th><Th right>Members</Th><Th right>Silhouette</Th><Th right>Ret YTD</Th><Th right>Vol</Th><Th>Keywords</Th></tr></thead>
              <tbody>
                {clusters.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No clusters</td></tr>}
                {clusters.sort((a, b) => b.silhouetteScore - a.silhouetteScore).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'dissolving' ? RED + '0a' : c.status === 'splitting' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.clusterId}</Td>
                    <Td mono col={TEXT}>{c.name}</Td>
                    <Td mono col={BLUE}>{c.sector || '—'}</Td>
                    <Td><AlgoBadge a={c.algorithmType} /></Td>
                    <Td><StatusBadge s={c.status} /></Td>
                    <Td right mono col={TEXT}>{c.memberCount}</Td>
                    <Td right mono col={c.silhouetteScore > 0.5 ? GREEN : c.silhouetteScore > 0.3 ? AMBER : RED}>{c.silhouetteScore.toFixed(3)}</Td>
                    <Td right mono col={c.returnYtd > 0 ? GREEN : RED}>{c.returnYtd > 0 ? '+' : ''}{c.returnYtd.toFixed(1)}%</Td>
                    <Td right mono col={c.volatility > 25 ? RED : TEXT}>{c.volatility.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(c.dominantKeywords ?? []).slice(0, 3).join(', ')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'narratives' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Theme</Th><Th>Headline</Th><Th>Direction</Th><Th>Horizon</Th><Th right>Momentum</Th><Th>Sentiment</Th><Th right>Buy-Side %</Th><Th right>Clusters</Th><Th>Media</Th></tr></thead>
              <tbody>
                {narratives.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No narratives</td></tr>}
                {narratives.sort((a, b) => b.momentum - a.momentum).map((n, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{n.theme}</Td>
                    <Td mono col={TEXT}>{n.headline.length > 35 ? n.headline.slice(0, 35) + 'â€¦' : n.headline}</Td>
                    <Td><StatusBadge s={n.direction} /></Td>
                    <Td><StatusBadge s={n.timeHorizon} /></Td>
                    <Td right mono col={n.momentum > 0.5 ? GREEN : n.momentum > 0 ? AMBER : RED}>{n.momentum.toFixed(2)}</Td>
                    <Td><SentBar val={n.sentiment} /></Td>
                    <Td right mono col={n.buySideExposurePct > 20 ? ORANGE : TEXT}>{n.buySideExposurePct.toFixed(1)}%</Td>
                    <Td right mono col={TEXT}>{n.clusterCount}</Td>
                    <Td><SentBar val={n.mediaIntensity} min={0} max={10} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exposure' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Portfolio</Th><Th>Cluster</Th><Th right>Exposure %</Th><Th right>Value USD</Th><Th right>Beta</Th><Th right>Corr</Th><Th right>Active Wt</Th><Th right>Bmk Wt</Th><Th right>Risk Contrib</Th></tr></thead>
              <tbody>
                {exposure.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exposure data</td></tr>}
                {exposure.sort((a, b) => b.exposurePct - a.exposurePct).map((e, i) => (
                  <tr key={i} style={{ background: e.exposurePct > 15 ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.portfolioName || e.portfolioId}</Td>
                    <Td mono col={BLUE}>{e.clusterName || e.clusterId}</Td>
                    <Td right mono col={e.exposurePct > 15 ? ORANGE : TEXT}>{e.exposurePct.toFixed(1)}%</Td>
                    <Td right mono col={TEXT}>${(e.absoluteValueUsd / 1e6).toFixed(1)}M</Td>
                    <Td right mono col={Math.abs(e.betaToCluster) > 1.5 ? ORANGE : TEXT}>{e.betaToCluster.toFixed(2)}</Td>
                    <Td right mono col={e.correlationToTheme > 0.7 ? GREEN : TEXT}>{e.correlationToTheme.toFixed(2)}</Td>
                    <Td right mono col={e.activeWeight > 0 ? GREEN : RED}>{(e.activeWeight * 100).toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{(e.benchmarkWeight * 100).toFixed(1)}%</Td>
                    <Td right mono col={e.riskContribution > 5 ? RED : TEXT}>{e.riskContribution.toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'evolution' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Event ID</Th><Th>Cluster</Th><Th>Event Type</Th><Th>Description</Th><Th right>Symbols</Th><Th right>Impact</Th><Th>Occurred At</Th></tr></thead>
              <tbody>
                {evolution.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No evolution events</td></tr>}
                {evolution.sort((a, b) => b.impactScore - a.impactScore).map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.evolutionId}</Td>
                    <Td mono col={BLUE}>{e.clusterName || e.clusterId}</Td>
                    <Td mono col={e.eventType === 'split' || e.eventType === 'death' ? RED : e.eventType === 'birth' ? GREEN : ORANGE}>{e.eventType.replace('_', ' ').toUpperCase()}</Td>
                    <Td mono col={SUBTLE}>{e.description.length > 40 ? e.description.slice(0, 40) + 'â€¦' : e.description}</Td>
                    <Td right mono col={TEXT}>{e.affectedSymbols}</Td>
                    <Td right mono col={e.impactScore > 7 ? RED : e.impactScore > 4 ? ORANGE : TEXT}>{e.impactScore.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{e.occurredAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Cluster ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.clusterId}</Td>
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
