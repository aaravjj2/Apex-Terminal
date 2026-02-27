import React, { useState, useEffect, useCallback } from 'react'
﻿// RetentionPolicyUI2 — Bloomberg APEX data retention policy terminal
// Lifecycle management, purge scheduling, compliance timelines, storage analytics
// Tabs: POLICIES | SCHEDULES | PURGE JOBS | DATASETS | AUDIT
// APIs: /api/v4/retention-policy/policies, /schedules, /purge-jobs, /datasets, /audit

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

interface RetentionPolicy {
  policyId: string
  name: string
  dataType: string
  category: 'financial' | 'compliance' | 'operational' | 'analytics' | 'personal'
  retentionDays: number
  archiveDays: number
  purgeMethod: 'hard_delete' | 'soft_delete' | 'anonymize' | 'archive'
  complianceFramework: string
  enabled: boolean
  datasetCount: number
  totalSizeGb: number
  nextReviewAt: string
}

interface RetentionSchedule {
  scheduleId: string
  policyId: string
  name: string
  cronExpression: string
  nextRunAt: string
  lastRunAt: string
  lastStatus: 'success' | 'failed' | 'skipped' | 'running'
  datasetsAffected: number
  avgDurationMin: number
  alertOnFailure: boolean
}

interface PurgeJob {
  jobId: string
  policyId: string
  datasetId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  purgeMethod: string
  recordsTarget: number
  recordsProcessed: number
  storageFreedGb: number
  startedAt: string
  completedAt: string
  approvedBy: string
}

interface RetentionDataset {
  datasetId: string
  name: string
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted' | 'pii'
  policyId: string
  currentSizeGb: number
  oldestRecordAt: string
  newestRecordAt: string
  recordCount: number
  expiresAt: string
  scheduledForPurgeAt: string
  status: 'active' | 'expiring' | 'overdue' | 'archived'
}

interface RetentionAuditEntry {
  auditId: string
  policyId: string
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
  const m: Record<string, string> = { active: GREEN, expiring: AMBER, overdue: RED, archived: SUBTLE, queued: BLUE, running: AMBER, completed: GREEN, failed: RED, cancelled: SUBTLE, success: GREEN, skipped: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ClassBadge({ c }: { c: string }) {
  const m: Record<string, string> = { public: SUBTLE, internal: BLUE, confidential: AMBER, restricted: ORANGE, pii: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function PurgeMethodBadge({ p }: { p: string }) {
  const m: Record<string, string> = { hard_delete: RED, soft_delete: ORANGE, anonymize: PURPLE, archive: BLUE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.replace('_', ' ').toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { financial: AMBER, compliance: RED, operational: BLUE, analytics: GREEN, personal: ORANGE }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function SizeCell({ gb }: { gb: number }) {
  const col = gb > 1000 ? RED : gb > 100 ? ORANGE : gb > 10 ? AMBER : TEXT
  const fmt = gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : `${gb.toFixed(1)} GB`
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{fmt}</span>
}


export function RetentionPolicyUI2() {
  const [tab, setTab] = useState<'policies' | 'schedules' | 'purge-jobs' | 'datasets' | 'audit'>('policies')
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [schedules, setSchedules] = useState<RetentionSchedule[]>([])
  const [purgeJobs, setPurgeJobs] = useState<PurgeJob[]>([])
  const [datasets, setDatasets] = useState<RetentionDataset[]>([])
  const [auditLog, setAuditLog] = useState<RetentionAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rS, rJ, rD, rA] = await Promise.allSettled([
        fetch('/api/v4/retention-policy/policies').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/retention-policy/schedules').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/retention-policy/purge-jobs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/retention-policy/datasets').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/retention-policy/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.policies ?? rP.value.data ?? []
        setPolicies(raw.map((p: any) => ({
          policyId: p.policy_id ?? p.policyId ?? '', name: p.name ?? '',
          dataType: p.data_type ?? p.dataType ?? '', category: p.category ?? 'operational',
          retentionDays: Number(p.retention_days ?? p.retentionDays ?? 0),
          archiveDays: Number(p.archive_days ?? p.archiveDays ?? 0),
          purgeMethod: p.purge_method ?? p.purgeMethod ?? 'soft_delete',
          complianceFramework: p.compliance_framework ?? p.complianceFramework ?? '',
          enabled: Boolean(p.enabled), datasetCount: Number(p.dataset_count ?? p.datasetCount ?? 0),
          totalSizeGb: Number(p.total_size_gb ?? p.totalSizeGb ?? 0),
          nextReviewAt: p.next_review_at ?? p.nextReviewAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load policies')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.schedules ?? rS.value.data ?? []
        setSchedules(raw.map((s: any) => ({
          scheduleId: s.schedule_id ?? s.scheduleId ?? '', policyId: s.policy_id ?? s.policyId ?? '',
          name: s.name ?? '', cronExpression: s.cron_expression ?? s.cronExpression ?? '',
          nextRunAt: s.next_run_at ?? s.nextRunAt ?? '', lastRunAt: s.last_run_at ?? s.lastRunAt ?? '',
          lastStatus: s.last_status ?? s.lastStatus ?? 'success',
          datasetsAffected: Number(s.datasets_affected ?? s.datasetsAffected ?? 0),
          avgDurationMin: Number(s.avg_duration_min ?? s.avgDurationMin ?? 0),
          alertOnFailure: Boolean(s.alert_on_failure ?? s.alertOnFailure),
        })))
      }
      if (rJ.status === 'fulfilled') {
        const raw = Array.isArray(rJ.value) ? rJ.value : rJ.value.purge_jobs ?? rJ.value.data ?? []
        setPurgeJobs(raw.map((j: any) => ({
          jobId: j.job_id ?? j.jobId ?? '', policyId: j.policy_id ?? j.policyId ?? '',
          datasetId: j.dataset_id ?? j.datasetId ?? '', status: j.status ?? 'queued',
          purgeMethod: j.purge_method ?? j.purgeMethod ?? '',
          recordsTarget: Number(j.records_target ?? j.recordsTarget ?? 0),
          recordsProcessed: Number(j.records_processed ?? j.recordsProcessed ?? 0),
          storageFreedGb: Number(j.storage_freed_gb ?? j.storageFreedGb ?? 0),
          startedAt: j.started_at ?? j.startedAt ?? '', completedAt: j.completed_at ?? j.completedAt ?? '',
          approvedBy: j.approved_by ?? j.approvedBy ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.datasets ?? rD.value.data ?? []
        setDatasets(raw.map((d: any) => ({
          datasetId: d.dataset_id ?? d.datasetId ?? '', name: d.name ?? '',
          dataClassification: d.data_classification ?? d.dataClassification ?? 'internal',
          policyId: d.policy_id ?? d.policyId ?? '',
          currentSizeGb: Number(d.current_size_gb ?? d.currentSizeGb ?? 0),
          oldestRecordAt: d.oldest_record_at ?? d.oldestRecordAt ?? '',
          newestRecordAt: d.newest_record_at ?? d.newestRecordAt ?? '',
          recordCount: Number(d.record_count ?? d.recordCount ?? 0),
          expiresAt: d.expires_at ?? d.expiresAt ?? '',
          scheduledForPurgeAt: d.scheduled_for_purge_at ?? d.scheduledForPurgeAt ?? '',
          status: d.status ?? 'active',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', policyId: a.policy_id ?? a.policyId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const overdueDatasets = datasets.filter(d => d.status === 'overdue').length
  const runningJobs = purgeJobs.filter(j => j.status === 'running').length
  const failedSchedules = schedules.filter(s => s.lastStatus === 'failed').length
  const totalSizeGb = policies.reduce((acc, p) => acc + p.totalSizeGb, 0)

  const TABS2 = [
    { id: 'policies' as const, label: 'POLICIES' },
    { id: 'schedules' as const, label: 'SCHEDULES' },
    { id: 'purge-jobs' as const, label: 'PURGE JOBS' },
    { id: 'datasets' as const, label: 'DATASETS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RETENTION POLICY — LIFECYCLE MANAGEMENT + PURGE SCHEDULING + COMPLIANCE</span>
        {overdueDatasets > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚑ {overdueDatasets} OVERDUE</span>}
        {failedSchedules > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚑ {failedSchedules} SCHED FAIL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Policies" value={policies.filter(p => p.enabled).length} col={BLUE} />
        <StatCard label="Overdue Datasets" value={overdueDatasets} col={overdueDatasets > 0 ? RED : GREEN} />
        <StatCard label="Running Jobs" value={runningJobs} col={runningJobs > 0 ? AMBER : SUBTLE} />
        <StatCard label="Failed Schedules" value={failedSchedules} col={failedSchedules > 0 ? ORANGE : GREEN} />
        <StatCard label="Total Data" value={totalSizeGb >= 1000 ? `${(totalSizeGb / 1000).toFixed(1)} TB` : `${totalSizeGb.toFixed(0)} GB`} col={PURPLE} />
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

        {tab === 'policies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Policy Name</Th><Th>Category</Th><Th>Data Type</Th><Th>Framework</Th><Th>Purge Method</Th><Th>Enabled</Th><Th right>Retention days</Th><Th right>Archive days</Th><Th right>Datasets</Th><Th>Size</Th></tr></thead>
              <tbody>
                {policies.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No policies — check /api/v4/retention-policy/policies</td></tr>}
                {policies.map((p, i) => (
                  <tr key={i} style={{ opacity: p.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td><CatBadge c={p.category} /></Td>
                    <Td mono col={BLUE}>{p.dataType}</Td>
                    <Td mono col={SUBTLE}>{p.complianceFramework || '—'}</Td>
                    <Td><PurgeMethodBadge p={p.purgeMethod} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: p.enabled ? GREEN : RED }}>{p.enabled ? '✓ ON' : '✗ OFF'}</span></Td>
                    <Td right mono col={TEXT}>{p.retentionDays.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{p.archiveDays.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{p.datasetCount}</Td>
                    <Td><SizeCell gb={p.totalSizeGb} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'schedules' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Schedule</Th><Th>Policy ID</Th><Th>Cron</Th><Th>Last Status</Th><Th right>Datasets</Th><Th right>Avg Duration m</Th><Th>Alert</Th><Th>Last Run</Th><Th>Next Run</Th></tr></thead>
              <tbody>
                {schedules.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No schedules — check /api/v4/retention-policy/schedules</td></tr>}
                {schedules.sort((a, b) => (a.lastStatus === 'failed' ? -1 : 1) - (b.lastStatus === 'failed' ? -1 : 1)).map((s, i) => (
                  <tr key={i} style={{ background: s.lastStatus === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td mono col={BLUE}>{s.policyId}</Td>
                    <Td mono col={PURPLE}>{s.cronExpression}</Td>
                    <Td><StatusBadge s={s.lastStatus} /></Td>
                    <Td right mono col={TEXT}>{s.datasetsAffected}</Td>
                    <Td right mono col={s.avgDurationMin > 30 ? ORANGE : SUBTLE}>{s.avgDurationMin.toFixed(1)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.alertOnFailure ? AMBER : SUBTLE }}>{s.alertOnFailure ? '✓ YES' : '—'}</span></Td>
                    <Td mono col={SUBTLE}>{s.lastRunAt || '—'}</Td>
                    <Td mono col={SUBTLE}>{s.nextRunAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'purge-jobs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Job ID</Th><Th>Policy</Th><Th>Dataset</Th><Th>Method</Th><Th>Status</Th><Th right>Target</Th><Th right>Processed</Th><Th>Storage Freed</Th><Th>Approved By</Th><Th>Started</Th></tr></thead>
              <tbody>
                {purgeJobs.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No purge jobs — check /api/v4/retention-policy/purge-jobs</td></tr>}
                {purgeJobs.sort((a, b) => (b.status === 'running' ? 1 : 0) - (a.status === 'running' ? 1 : 0)).map((j, i) => (
                  <tr key={i} style={{ background: j.status === 'failed' ? RED + '0a' : j.status === 'running' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{j.jobId}</Td>
                    <Td mono col={BLUE}>{j.policyId}</Td>
                    <Td mono col={PURPLE}>{j.datasetId}</Td>
                    <Td><PurgeMethodBadge p={j.purgeMethod} /></Td>
                    <Td><StatusBadge s={j.status} /></Td>
                    <Td right mono col={SUBTLE}>{j.recordsTarget.toLocaleString()}</Td>
                    <Td right mono col={j.recordsProcessed >= j.recordsTarget ? GREEN : AMBER}>{j.recordsProcessed.toLocaleString()}</Td>
                    <Td><SizeCell gb={j.storageFreedGb} /></Td>
                    <Td mono col={TEXT}>{j.approvedBy || '—'}</Td>
                    <Td mono col={SUBTLE}>{j.startedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'datasets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Dataset</Th><Th>Classification</Th><Th>Policy ID</Th><Th>Status</Th><Th>Size</Th><Th right>Records</Th><Th>Oldest Record</Th><Th>Expires At</Th><Th>Purge Scheduled</Th></tr></thead>
              <tbody>
                {datasets.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No datasets — check /api/v4/retention-policy/datasets</td></tr>}
                {datasets.sort((a, b) => (a.status === 'overdue' ? -1 : 1) - (b.status === 'overdue' ? -1 : 1)).map((d, i) => (
                  <tr key={i} style={{ background: d.status === 'overdue' ? RED + '0a' : d.status === 'expiring' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.name}</Td>
                    <Td><ClassBadge c={d.dataClassification} /></Td>
                    <Td mono col={BLUE}>{d.policyId}</Td>
                    <Td><StatusBadge s={d.status} /></Td>
                    <Td><SizeCell gb={d.currentSizeGb} /></Td>
                    <Td right mono col={TEXT}>{d.recordCount.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{d.oldestRecordAt || '—'}</Td>
                    <Td mono col={d.expiresAt ? ORANGE : SUBTLE}>{d.expiresAt || '—'}</Td>
                    <Td mono col={d.scheduledForPurgeAt ? RED : SUBTLE}>{d.scheduledForPurgeAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Policy ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/retention-policy/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.policyId || '—'}</Td>
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
