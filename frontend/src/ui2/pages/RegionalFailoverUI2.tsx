import React, { useState, useEffect, useCallback } from 'react'
﻿// RegionalFailoverUI2 â€” Bloomberg APEX regional failover terminal
// Drills, automated failover testing, recovery validation, SLA tracking
// Tabs: DRILLS | FAILOVERS | REGIONS | RECOVERY | AUDIT
// APIs: /api/v4/regional-failover/drills, /failovers, /regions, /recovery, /audit

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

interface FailoverDrill {
  drillId: string
  name: string
  type: 'scheduled' | 'unplanned' | 'chaos' | 'tabletop' | 'live'
  sourceRegion: string
  targetRegion: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'aborted'
  rtoTargetMin: number
  rtoActualMin: number
  rpoTargetMin: number
  rpoActualMin: number
  passedTests: number
  failedTests: number
  scheduledAt: string
  completedAt: string
}

interface FailoverEvent {
  failoverId: string
  trigger: 'manual' | 'automatic' | 'chaos' | 'disaster' | 'maintenance'
  fromRegion: string
  toRegion: string
  services: number
  status: 'active' | 'completed' | 'rolled_back' | 'failed'
  startedAt: string
  endedAt: string
  durationMin: number
  trafficShifted: number
  errors: number
}

interface RegionStatus {
  regionId: string
  name: string
  cloudProvider: string
  isPrimary: boolean
  health: 'healthy' | 'degraded' | 'offline' | 'maintenance'
  latencyMs: number
  availabilityPct: number
  lastFailoverAt: string
  capacityPct: number
  sloTargetPct: number
}

interface RecoveryValidation {
  validationId: string
  drillId: string
  service: string
  checkType: 'connectivity' | 'data_integrity' | 'performance' | 'latency' | 'functional'
  result: 'pass' | 'fail' | 'warning' | 'skipped'
  expectedMs: number
  actualMs: number
  detail: string
  validatedAt: string
}

interface FailoverAuditEntry {
  auditId: string
  action: string
  actor: string
  region: string
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
  const m: Record<string, string> = { scheduled: BLUE, in_progress: AMBER, completed: GREEN, failed: RED, aborted: ORANGE, active: AMBER, rolled_back: PURPLE, healthy: GREEN, degraded: ORANGE, offline: RED, maintenance: BLUE, pass: GREEN, fail: RED, warning: AMBER, skipped: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function DrillTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { scheduled: BLUE, unplanned: RED, chaos: ORANGE, tabletop: PURPLE, live: AMBER }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function RtoBar({ actual, target }: { actual: number; target: number }) {
  const ok = actual <= target
  const col = ok ? GREEN : actual <= target * 1.5 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{actual.toFixed(1)}m</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>/{target.toFixed(1)}m</span>
    </div>
  )
}


export function RegionalFailoverUI2() {
  const [tab, setTab] = useState<'drills' | 'failovers' | 'regions' | 'recovery' | 'audit'>('drills')
  const [drills, setDrills] = useState<FailoverDrill[]>([])
  const [failovers, setFailovers] = useState<FailoverEvent[]>([])
  const [regions, setRegions] = useState<RegionStatus[]>([])
  const [recovery, setRecovery] = useState<RecoveryValidation[]>([])
  const [auditLog, setAuditLog] = useState<FailoverAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rD, rF, rR, rRec, rA] = await Promise.allSettled([
        fetch('/api/v4/regional-failover/drills').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regional-failover/failovers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regional-failover/regions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regional-failover/recovery').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/regional-failover/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.drills ?? rD.value.data ?? []
        setDrills(raw.map((d: any) => ({
          drillId: d.drill_id ?? d.drillId ?? '', name: d.name ?? '',
          type: d.type ?? 'scheduled', sourceRegion: d.source_region ?? d.sourceRegion ?? '',
          targetRegion: d.target_region ?? d.targetRegion ?? '',
          status: d.status ?? 'scheduled',
          rtoTargetMin: Number(d.rto_target_min ?? d.rtoTargetMin ?? 0),
          rtoActualMin: Number(d.rto_actual_min ?? d.rtoActualMin ?? 0),
          rpoTargetMin: Number(d.rpo_target_min ?? d.rpoTargetMin ?? 0),
          rpoActualMin: Number(d.rpo_actual_min ?? d.rpoActualMin ?? 0),
          passedTests: Number(d.passed_tests ?? d.passedTests ?? 0),
          failedTests: Number(d.failed_tests ?? d.failedTests ?? 0),
          scheduledAt: d.scheduled_at ?? d.scheduledAt ?? '',
          completedAt: d.completed_at ?? d.completedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load drills')
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.failovers ?? rF.value.data ?? []
        setFailovers(raw.map((f: any) => ({
          failoverId: f.failover_id ?? f.failoverId ?? '',
          trigger: f.trigger ?? 'manual', fromRegion: f.from_region ?? f.fromRegion ?? '',
          toRegion: f.to_region ?? f.toRegion ?? '', services: Number(f.services ?? 0),
          status: f.status ?? 'completed',
          startedAt: f.started_at ?? f.startedAt ?? '', endedAt: f.ended_at ?? f.endedAt ?? '',
          durationMin: Number(f.duration_min ?? f.durationMin ?? 0),
          trafficShifted: Number(f.traffic_shifted ?? f.trafficShifted ?? 0),
          errors: Number(f.errors ?? 0),
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.regions ?? rR.value.data ?? []
        setRegions(raw.map((r: any) => ({
          regionId: r.region_id ?? r.regionId ?? '', name: r.name ?? '',
          cloudProvider: r.cloud_provider ?? r.cloudProvider ?? '',
          isPrimary: Boolean(r.is_primary ?? r.isPrimary),
          health: r.health ?? 'healthy', latencyMs: Number(r.latency_ms ?? r.latencyMs ?? 0),
          availabilityPct: Number(r.availability_pct ?? r.availabilityPct ?? 0),
          lastFailoverAt: r.last_failover_at ?? r.lastFailoverAt ?? '',
          capacityPct: Number(r.capacity_pct ?? r.capacityPct ?? 0),
          sloTargetPct: Number(r.slo_target_pct ?? r.sloTargetPct ?? 99.9),
        })))
      }
      if (rRec.status === 'fulfilled') {
        const raw = Array.isArray(rRec.value) ? rRec.value : rRec.value.recovery ?? rRec.value.data ?? []
        setRecovery(raw.map((v: any) => ({
          validationId: v.validation_id ?? v.validationId ?? '', drillId: v.drill_id ?? v.drillId ?? '',
          service: v.service ?? '', checkType: v.check_type ?? v.checkType ?? 'functional',
          result: v.result ?? 'pass', expectedMs: Number(v.expected_ms ?? v.expectedMs ?? 0),
          actualMs: Number(v.actual_ms ?? v.actualMs ?? 0),
          detail: v.detail ?? '', validatedAt: v.validated_at ?? v.validatedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', region: a.region ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const failedDrills = drills.filter(d => d.status === 'failed').length
  const offlineRegions = regions.filter(r => r.health === 'offline').length
  const activeFailovers = failovers.filter(f => f.status === 'active').length

  const TABS2 = [
    { id: 'drills' as const, label: 'DRILLS' },
    { id: 'failovers' as const, label: 'FAILOVERS' },
    { id: 'regions' as const, label: 'REGIONS' },
    { id: 'recovery' as const, label: 'RECOVERY' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>REGIONAL FAILOVER â€” DRILLS + AUTOMATED TESTING + RECOVERY VALIDATION</span>
        {activeFailovers > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ FAILOVER ACTIVE</span>}
        {offlineRegions > 0 && <span style={{ fontSize: 10, color: RED }}>âš‘ {offlineRegions} REGION OFFLINE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Drills" value={drills.length} col={BLUE} />
        <StatCard label="Failed Drills" value={failedDrills} col={failedDrills > 0 ? RED : GREEN} />
        <StatCard label="Active Failovers" value={activeFailovers} col={activeFailovers > 0 ? RED : GREEN} />
        <StatCard label="Offline Regions" value={offlineRegions} col={offlineRegions > 0 ? RED : GREEN} />
        <StatCard label="Recovery Checks" value={recovery.length} col={PURPLE} />
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

        {tab === 'drills' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Drill</Th><Th>Type</Th><Th>From</Th><Th>To</Th><Th>Status</Th><Th>RTO Target/Actual</Th><Th>RPO Target/Actual</Th><Th right>Passed</Th><Th right>Failed</Th><Th>Scheduled</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {drills.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No drills â€” check /api/v4/regional-failover/drills</td></tr>}
                {drills.map((d, i) => (
                  <tr key={i} style={{ background: d.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.name || d.drillId}</Td>
                    <Td><DrillTypeBadge t={d.type} /></Td>
                    <Td mono col={BLUE}>{d.sourceRegion}</Td>
                    <Td mono col={PURPLE}>{d.targetRegion}</Td>
                    <Td><StatusBadge s={d.status} /></Td>
                    <Td><RtoBar actual={d.rtoActualMin} target={d.rtoTargetMin} /></Td>
                    <Td><RtoBar actual={d.rpoActualMin} target={d.rpoTargetMin} /></Td>
                    <Td right mono col={GREEN}>{d.passedTests}</Td>
                    <Td right mono col={d.failedTests > 0 ? RED : SUBTLE}>{d.failedTests}</Td>
                    <Td mono col={SUBTLE}>{d.scheduledAt}</Td>
                    <Td mono col={SUBTLE}>{d.completedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'failovers' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Failover ID</Th><Th>Trigger</Th><Th>From</Th><Th>To</Th><Th>Status</Th><Th right>Services</Th><Th right>Traffic %</Th><Th right>Duration m</Th><Th right>Errors</Th><Th>Started</Th><Th>Ended</Th></tr></thead>
              <tbody>
                {failovers.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No failover events â€” check /api/v4/regional-failover/failovers</td></tr>}
                {failovers.map((f, i) => (
                  <tr key={i} style={{ background: f.status === 'active' ? AMBER + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{f.failoverId}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: f.trigger === 'disaster' ? RED : f.trigger === 'automatic' ? ORANGE : BLUE, background: (f.trigger === 'disaster' ? RED : f.trigger === 'automatic' ? ORANGE : BLUE) + '22', borderRadius: 3, padding: '2px 5px' }}>{f.trigger.toUpperCase()}</span></Td>
                    <Td mono col={BLUE}>{f.fromRegion}</Td>
                    <Td mono col={GREEN}>{f.toRegion}</Td>
                    <Td><StatusBadge s={f.status} /></Td>
                    <Td right mono col={TEXT}>{f.services}</Td>
                    <Td right mono col={TEXT}>{f.trafficShifted.toFixed(1)}%</Td>
                    <Td right mono col={f.durationMin > 30 ? RED : f.durationMin > 15 ? AMBER : GREEN}>{f.durationMin.toFixed(1)}</Td>
                    <Td right mono col={f.errors > 0 ? RED : SUBTLE}>{f.errors}</Td>
                    <Td mono col={SUBTLE}>{f.startedAt}</Td>
                    <Td mono col={SUBTLE}>{f.endedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'regions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Cloud</Th><Th>Primary</Th><Th>Health</Th><Th right>Latency ms</Th><Th right>Availability %</Th><Th right>Capacity %</Th><Th right>SLO Target</Th><Th>Last Failover</Th></tr></thead>
              <tbody>
                {regions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regions â€” check /api/v4/regional-failover/regions</td></tr>}
                {regions.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map((r, i) => (
                  <tr key={i} style={{ background: r.health === 'offline' ? RED + '0a' : r.isPrimary ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.name}</Td>
                    <Td mono col={BLUE}>{r.cloudProvider}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.isPrimary ? AMBER : SUBTLE }}>{r.isPrimary ? 'â˜… PRIMARY' : 'STANDBY'}</span></Td>
                    <Td><StatusBadge s={r.health} /></Td>
                    <Td right mono col={r.latencyMs > 100 ? ORANGE : GREEN}>{r.latencyMs.toFixed(0)}</Td>
                    <Td right mono col={r.availabilityPct >= 99.9 ? GREEN : r.availabilityPct >= 99 ? AMBER : RED}>{r.availabilityPct.toFixed(3)}%</Td>
                    <Td right mono col={r.capacityPct > 85 ? RED : r.capacityPct > 70 ? ORANGE : GREEN}>{r.capacityPct.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{r.sloTargetPct.toFixed(3)}%</Td>
                    <Td mono col={SUBTLE}>{r.lastFailoverAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'recovery' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Validation ID</Th><Th>Drill ID</Th><Th>Service</Th><Th>Check Type</Th><Th>Result</Th><Th right>Expected ms</Th><Th right>Actual ms</Th><Th>Detail</Th><Th>Validated At</Th></tr></thead>
              <tbody>
                {recovery.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No recovery data â€” check /api/v4/regional-failover/recovery</td></tr>}
                {recovery.sort((a, b) => (a.result === 'fail' ? -1 : 1) - (b.result === 'fail' ? -1 : 1)).map((v, i) => (
                  <tr key={i} style={{ background: v.result === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.validationId}</Td>
                    <Td mono col={BLUE}>{v.drillId}</Td>
                    <Td mono col={TEXT}>{v.service}</Td>
                    <Td mono col={PURPLE}>{v.checkType}</Td>
                    <Td><StatusBadge s={v.result} /></Td>
                    <Td right mono col={SUBTLE}>{v.expectedMs}</Td>
                    <Td right mono col={v.actualMs > v.expectedMs * 1.5 ? RED : v.actualMs > v.expectedMs ? AMBER : GREEN}>{v.actualMs}</Td>
                    <Td mono col={SUBTLE}>{v.detail || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{v.validatedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Region</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/regional-failover/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.region || 'â€”'}</Td>
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
