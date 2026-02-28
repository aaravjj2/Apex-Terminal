import React, { useState, useEffect, useCallback } from 'react'
﻿// MultiRegionUI2 â€” Bloomberg APEX multi-region terminal
// Global traffic steering, geo-routing, failover, region health, audit
// Tabs: REGIONS | TRAFFIC | ROUTING | FAILOVER | AUDIT
// APIs: /api/v4/multi-region/regions, /traffic, /routing, /failover, /audit

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

interface Region {
  regionId: string
  name: string
  cloudProvider: string
  zone: string
  status: 'primary' | 'secondary' | 'standby' | 'degraded' | 'offline'
  healthScore: number
  latencyMs: number
  requestSharePct: number
  capacity: number
  load: number
  lastHealthCheck: string
  errorRatePct: number
}

interface TrafficFlow {
  flowId: string
  sourceRegion: string
  destRegion: string
  protocol: string
  requestsPerSec: number
  bandwidthMbps: number
  avgLatencyMs: number
  errorPct: number
  weight: number
  status: 'active' | 'degraded' | 'idle'
}

interface RoutingRule {
  ruleId: string
  ruleName: string
  priority: number
  condition: string
  targetRegion: string
  routingMethod: 'latency' | 'geo' | 'weighted' | 'failover' | 'round-robin'
  weight: number
  enabled: boolean
  matchCount: number
  lastEvaluated: string
}

interface FailoverRecord {
  failoverId: string
  fromRegion: string
  toRegion: string
  trigger: string
  triggeredAt: string
  recoveredAt: string
  durationMin: number
  requestsMigrated: number
  status: 'active' | 'completed' | 'partial'
}

interface RegionAuditEntry {
  auditId: string
  regionId: string
  action: string
  actor: string
  outcome: 'pass' | 'fail' | 'warn'
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
function RegionStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { primary: AMBER, secondary: BLUE, standby: PURPLE, degraded: ORANGE, offline: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, degraded: AMBER, idle: SUBTLE, completed: GREEN, partial: ORANGE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function LoadBar({ pct }: { pct: number }) {
  const col = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(1)}%</span>
    </div>
  )
}


export function MultiRegionUI2() {
  const [tab, setTab] = useState<'regions' | 'traffic' | 'routing' | 'failover' | 'audit'>('regions')
  const [regions, setRegions] = useState<Region[]>([])
  const [traffic, setTraffic] = useState<TrafficFlow[]>([])
  const [routing, setRouting] = useState<RoutingRule[]>([])
  const [failover, setFailover] = useState<FailoverRecord[]>([])
  const [auditLog, setAuditLog] = useState<RegionAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rT, rRu, rF, rA] = await Promise.allSettled([
        fetch('/api/v4/multi-region/regions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/multi-region/traffic').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/multi-region/routing').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/multi-region/failover').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/multi-region/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.regions ?? rR.value.data ?? []
        setRegions(raw.map((r: any) => ({
          regionId: r.region_id ?? r.regionId ?? '', name: r.name ?? '',
          cloudProvider: r.cloud_provider ?? r.cloudProvider ?? '', zone: r.zone ?? '',
          status: r.status ?? 'secondary', healthScore: Number(r.health_score ?? r.healthScore ?? 0),
          latencyMs: Number(r.latency_ms ?? r.latencyMs ?? 0),
          requestSharePct: Number(r.request_share_pct ?? r.requestSharePct ?? 0),
          capacity: Number(r.capacity ?? 0), load: Number(r.load ?? 0),
          lastHealthCheck: r.last_health_check ?? r.lastHealthCheck ?? '',
          errorRatePct: Number(r.error_rate_pct ?? r.errorRatePct ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load regions')
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.traffic ?? rT.value.data ?? []
        setTraffic(raw.map((t: any) => ({
          flowId: t.flow_id ?? t.flowId ?? '', sourceRegion: t.source_region ?? t.sourceRegion ?? '',
          destRegion: t.dest_region ?? t.destRegion ?? '', protocol: t.protocol ?? '',
          requestsPerSec: Number(t.requests_per_sec ?? t.requestsPerSec ?? 0),
          bandwidthMbps: Number(t.bandwidth_mbps ?? t.bandwidthMbps ?? 0),
          avgLatencyMs: Number(t.avg_latency_ms ?? t.avgLatencyMs ?? 0),
          errorPct: Number(t.error_pct ?? t.errorPct ?? 0), weight: Number(t.weight ?? 0),
          status: t.status ?? 'active',
        })))
      }
      if (rRu.status === 'fulfilled') {
        const raw = Array.isArray(rRu.value) ? rRu.value : rRu.value.rules ?? rRu.value.data ?? []
        setRouting(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.ruleId ?? '', ruleName: r.rule_name ?? r.ruleName ?? '',
          priority: Number(r.priority ?? 0), condition: r.condition ?? '',
          targetRegion: r.target_region ?? r.targetRegion ?? '',
          routingMethod: r.routing_method ?? r.routingMethod ?? 'round-robin',
          weight: Number(r.weight ?? 0), enabled: Boolean(r.enabled),
          matchCount: Number(r.match_count ?? r.matchCount ?? 0),
          lastEvaluated: r.last_evaluated ?? r.lastEvaluated ?? '',
        })))
      }
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.failover ?? rF.value.data ?? []
        setFailover(raw.map((f: any) => ({
          failoverId: f.failover_id ?? f.failoverId ?? '', fromRegion: f.from_region ?? f.fromRegion ?? '',
          toRegion: f.to_region ?? f.toRegion ?? '', trigger: f.trigger ?? '',
          triggeredAt: f.triggered_at ?? f.triggeredAt ?? '', recoveredAt: f.recovered_at ?? f.recoveredAt ?? '',
          durationMin: Number(f.duration_min ?? f.durationMin ?? 0),
          requestsMigrated: Number(f.requests_migrated ?? f.requestsMigrated ?? 0),
          status: f.status ?? 'completed',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', regionId: a.region_id ?? a.regionId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const degradedRegions = regions.filter(r => r.status === 'degraded' || r.status === 'offline').length
  const activeFailovers = failover.filter(f => f.status === 'active').length
  const totalRps = traffic.reduce((s, t) => s + t.requestsPerSec, 0)

  const TABS2 = [
    { id: 'regions' as const, label: 'REGIONS' },
    { id: 'traffic' as const, label: 'TRAFFIC' },
    { id: 'routing' as const, label: 'ROUTING' },
    { id: 'failover' as const, label: 'FAILOVER' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>MULTI-REGION â€” GLOBAL TRAFFIC STEERING + GEO-ROUTING + FAILOVER MANAGEMENT</span>
        {degradedRegions > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {degradedRegions} DEGRADED</span>}
        {activeFailovers > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {activeFailovers} ACTIVE FAILOVER</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Regions" value={regions.length} col={BLUE} />
        <StatCard label="Degraded" value={degradedRegions} col={degradedRegions > 0 ? RED : GREEN} />
        <StatCard label="Total RPS" value={totalRps.toFixed(0)} col={AMBER} />
        <StatCard label="Active Failovers" value={activeFailovers} col={activeFailovers > 0 ? ORANGE : GREEN} />
        <StatCard label="Routing Rules" value={routing.length} col={PURPLE} />
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

        {tab === 'regions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Provider</Th><Th>Zone</Th><Th>Status</Th><Th right>Health</Th><Th right>Latency ms</Th><Th>Load</Th><Th right>Traffic %</Th><Th right>Error %</Th><Th>Last Check</Th></tr></thead>
              <tbody>
                {regions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regions â€” check /api/v4/multi-region/regions</td></tr>}
                {regions.sort((a, b) => {
                  const p: Record<string, number> = { primary: 0, secondary: 1, standby: 2, degraded: 3, offline: 4 }
                  return (p[a.status] ?? 5) - (p[b.status] ?? 5)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'offline' ? RED + '0a' : r.status === 'degraded' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.name}</Td>
                    <Td mono col={BLUE}>{r.cloudProvider}</Td>
                    <Td mono col={SUBTLE}>{r.zone}</Td>
                    <Td><RegionStatusBadge s={r.status} /></Td>
                    <Td right mono col={r.healthScore >= 90 ? GREEN : r.healthScore >= 70 ? AMBER : RED}>{r.healthScore.toFixed(1)}</Td>
                    <Td right mono col={r.latencyMs > 100 ? ORANGE : SUBTLE}>{r.latencyMs.toFixed(0)}</Td>
                    <Td><LoadBar pct={r.load} /></Td>
                    <Td right mono col={SUBTLE}>{r.requestSharePct.toFixed(1)}%</Td>
                    <Td right mono col={r.errorRatePct > 1 ? RED : r.errorRatePct > 0.1 ? AMBER : GREEN}>{r.errorRatePct.toFixed(3)}%</Td>
                    <Td mono col={SUBTLE}>{r.lastHealthCheck}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'traffic' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Source</Th><Th>Dest</Th><Th>Protocol</Th><Th>Status</Th><Th right>RPS</Th><Th right>BW Mbps</Th><Th right>Latency ms</Th><Th right>Error %</Th><Th right>Weight</Th></tr></thead>
              <tbody>
                {traffic.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No traffic data â€” check /api/v4/multi-region/traffic</td></tr>}
                {traffic.sort((a, b) => b.requestsPerSec - a.requestsPerSec).map((t, i) => (
                  <tr key={i} style={{ background: t.errorPct > 1 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.sourceRegion}</Td>
                    <Td mono col={BLUE}>{t.destRegion}</Td>
                    <Td mono col={PURPLE}>{t.protocol}</Td>
                    <Td><StatusBadge2 s={t.status} /></Td>
                    <Td right mono col={TEXT}>{t.requestsPerSec.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{t.bandwidthMbps.toFixed(2)}</Td>
                    <Td right mono col={t.avgLatencyMs > 200 ? ORANGE : SUBTLE}>{t.avgLatencyMs.toFixed(0)}</Td>
                    <Td right mono col={t.errorPct > 1 ? RED : t.errorPct > 0.1 ? AMBER : GREEN}>{t.errorPct.toFixed(3)}%</Td>
                    <Td right mono col={SUBTLE}>{t.weight}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'routing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th right>Priority</Th><Th>Target Region</Th><Th>Method</Th><Th right>Weight</Th><Th>Enabled</Th><Th>Condition</Th><Th right>Matches</Th><Th>Last Eval</Th></tr></thead>
              <tbody>
                {routing.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No routing rules â€” check /api/v4/multi-region/routing</td></tr>}
                {routing.sort((a, b) => a.priority - b.priority).map((r, i) => (
                  <tr key={i} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{r.ruleName}</Td>
                    <Td right mono col={SUBTLE}>{r.priority}</Td>
                    <Td mono col={BLUE}>{r.targetRegion}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{r.routingMethod.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>{r.weight}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.enabled ? GREEN : RED }}>{r.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td mono col={SUBTLE}>{r.condition.slice(0, 40)}{r.condition.length > 40 ? 'â€¦' : ''}</Td>
                    <Td right mono col={r.matchCount > 0 ? TEXT : SUBTLE}>{r.matchCount}</Td>
                    <Td mono col={SUBTLE}>{r.lastEvaluated || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'failover' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Failover ID</Th><Th>From</Th><Th>To</Th><Th>Status</Th><Th>Trigger</Th><Th right>Duration</Th><Th right>Requests Migrated</Th><Th>Triggered</Th><Th>Recovered</Th></tr></thead>
              <tbody>
                {failover.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No failover records â€” check /api/v4/multi-region/failover</td></tr>}
                {failover.sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1)).map((f, i) => (
                  <tr key={i} style={{ background: f.status === 'active' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{f.failoverId}</Td>
                    <Td mono col={RED}>{f.fromRegion}</Td>
                    <Td mono col={GREEN}>{f.toRegion}</Td>
                    <Td><StatusBadge2 s={f.status} /></Td>
                    <Td mono col={SUBTLE}>{f.trigger}</Td>
                    <Td right mono col={f.durationMin > 30 ? ORANGE : SUBTLE}>{f.durationMin.toFixed(1)} min</Td>
                    <Td right mono col={TEXT}>{f.requestsMigrated.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{f.triggeredAt}</Td>
                    <Td mono col={SUBTLE}>{f.recoveredAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Region</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/multi-region/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.regionId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
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
