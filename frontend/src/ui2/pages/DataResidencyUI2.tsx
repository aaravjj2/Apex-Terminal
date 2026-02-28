import React, { useState, useEffect, useCallback } from 'react'
﻿// DataResidencyUI2 â€” Bloomberg DRSD data residency terminal
// Geographic zones, classification, compliance, transfer controls, audit
// Tabs: REGIONS | CLASSIFICATION | COMPLIANCE | TRANSFERS | AUDIT
// APIs: /api/v4/data-residency/regions, /classification, /compliance, /transfers, /audit

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

interface DataRegion {
  regionId: string
  regionName: string
  jurisdiction: string
  dataCenter: string
  totalAssets: number
  personalData: number
  sensitiveData: number
  status: 'active' | 'degraded' | 'offline'
  replicationLag: number
  storageUsedTb: number
  storageCapTb: number
  regulatoryFramework: string[]
}

interface DataClassification {
  dataType: string
  classification: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret'
  recordCount: number
  regionPrimary: string
  replicationRegions: string[]
  retentionDays: number
  encryptionLevel: string
  piiContains: boolean
  lastAudit: string
  owner: string
}

interface ComplianceRule {
  ruleId: string
  framework: string
  jurisdiction: string
  requirement: string
  status: 'compliant' | 'non_compliant' | 'under_review' | 'exempt'
  affectedDataTypes: string[]
  lastChecked: string
  dueDate: string
  penalty: string
}

interface DataTransfer {
  transferId: string
  sourceRegion: string
  destRegion: string
  dataType: string
  volumeMb: number
  mechanism: string
  status: 'approved' | 'pending' | 'blocked' | 'in_progress'
  legalBasis: string
  initiatedBy: string
  timestamp: string
}

interface ResidencyAuditEntry {
  entryId: string
  action: string
  actor: string
  targetRegion: string
  dataType: string
  outcome: 'allowed' | 'blocked' | 'flagged'
  reason: string
  timestamp: string
  policyRef: string
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
function UtilBar({ pct }: { pct: number }) {
  const c = pct >= 90 ? RED : pct >= 75 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}
function ClassBadge({ c }: { c: string }) {
  const m: Record<string, string> = { public: GREEN, internal: BLUE, confidential: AMBER, restricted: ORANGE, top_secret: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.replace('_', ' ').toUpperCase()}</span>
}
function ComplianceBadge({ s }: { s: string }) {
  const m: Record<string, string> = { compliant: GREEN, non_compliant: RED, under_review: AMBER, exempt: SUBTLE }
  const col = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function TransferBadge({ s }: { s: string }) {
  const m: Record<string, string> = { approved: GREEN, pending: AMBER, blocked: RED, in_progress: BLUE }
  const col = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function OutcomeBadge({ s }: { s: string }) {
  const m: Record<string, string> = { allowed: GREEN, blocked: RED, flagged: AMBER }
  const col = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function DataResidencyUI2() {
  const [tab, setTab] = useState<'regions' | 'classification' | 'compliance' | 'transfers' | 'audit'>('regions')
  const [regions, setRegions] = useState<DataRegion[]>([])
  const [classification, setClassification] = useState<DataClassification[]>([])
  const [compliance, setCompliance] = useState<ComplianceRule[]>([])
  const [transfers, setTransfers] = useState<DataTransfer[]>([])
  const [audit, setAudit] = useState<ResidencyAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rReg, rCls, rCom, rTr, rAu] = await Promise.allSettled([
        fetch('/api/v4/data-residency/regions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/data-residency/classification').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/data-residency/compliance').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/data-residency/transfers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/data-residency/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rReg.status === 'fulfilled') {
        const raw = Array.isArray(rReg.value) ? rReg.value : rReg.value.regions ?? rReg.value.data ?? []
        setRegions(raw.map((r: any) => ({
          regionId: r.region_id ?? r.regionId ?? '', regionName: r.region_name ?? r.regionName ?? '',
          jurisdiction: r.jurisdiction ?? '', dataCenter: r.data_center ?? r.dataCenter ?? '',
          totalAssets: Number(r.total_assets ?? r.totalAssets ?? 0), personalData: Number(r.personal_data ?? r.personalData ?? 0),
          sensitiveData: Number(r.sensitive_data ?? r.sensitiveData ?? 0), status: r.status ?? 'active',
          replicationLag: Number(r.replication_lag ?? r.replicationLag ?? 0),
          storageUsedTb: Number(r.storage_used_tb ?? r.storageUsedTb ?? 0),
          storageCapTb: Number(r.storage_cap_tb ?? r.storageCapTb ?? 1),
          regulatoryFramework: Array.isArray(r.regulatory_framework ?? r.regulatoryFramework) ? (r.regulatory_framework ?? r.regulatoryFramework) : [],
        })))
        setErr(null)
      } else setErr('Failed to load regions')
      if (rCls.status === 'fulfilled') {
        const raw = Array.isArray(rCls.value) ? rCls.value : rCls.value.classification ?? rCls.value.data ?? []
        setClassification(raw.map((c: any) => ({
          dataType: c.data_type ?? c.dataType ?? '', classification: c.classification ?? 'internal',
          recordCount: Number(c.record_count ?? c.recordCount ?? 0), regionPrimary: c.region_primary ?? c.regionPrimary ?? '',
          replicationRegions: Array.isArray(c.replication_regions ?? c.replicationRegions) ? (c.replication_regions ?? c.replicationRegions) : [],
          retentionDays: Number(c.retention_days ?? c.retentionDays ?? 0), encryptionLevel: c.encryption_level ?? c.encryptionLevel ?? '',
          piiContains: Boolean(c.pii_contains ?? c.piiContains ?? false), lastAudit: c.last_audit ?? c.lastAudit ?? '',
          owner: c.owner ?? '',
        })))
      }
      if (rCom.status === 'fulfilled') {
        const raw = Array.isArray(rCom.value) ? rCom.value : rCom.value.compliance ?? rCom.value.data ?? []
        setCompliance(raw.map((c: any) => ({
          ruleId: c.rule_id ?? c.ruleId ?? '', framework: c.framework ?? '', jurisdiction: c.jurisdiction ?? '',
          requirement: c.requirement ?? '', status: c.status ?? 'under_review',
          affectedDataTypes: Array.isArray(c.affected_data_types ?? c.affectedDataTypes) ? (c.affected_data_types ?? c.affectedDataTypes) : [],
          lastChecked: c.last_checked ?? c.lastChecked ?? '', dueDate: c.due_date ?? c.dueDate ?? '',
          penalty: c.penalty ?? '',
        })))
      }
      if (rTr.status === 'fulfilled') {
        const raw = Array.isArray(rTr.value) ? rTr.value : rTr.value.transfers ?? rTr.value.data ?? []
        setTransfers(raw.map((t: any) => ({
          transferId: t.transfer_id ?? t.transferId ?? '', sourceRegion: t.source_region ?? t.sourceRegion ?? '',
          destRegion: t.dest_region ?? t.destRegion ?? '', dataType: t.data_type ?? t.dataType ?? '',
          volumeMb: Number(t.volume_mb ?? t.volumeMb ?? 0), mechanism: t.mechanism ?? '', status: t.status ?? 'pending',
          legalBasis: t.legal_basis ?? t.legalBasis ?? '', initiatedBy: t.initiated_by ?? t.initiatedBy ?? '',
          timestamp: t.timestamp ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAudit(raw.map((a: any) => ({
          entryId: a.entry_id ?? a.entryId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          targetRegion: a.target_region ?? a.targetRegion ?? '', dataType: a.data_type ?? a.dataType ?? '',
          outcome: a.outcome ?? 'allowed', reason: a.reason ?? '', timestamp: a.timestamp ?? '',
          policyRef: a.policy_ref ?? a.policyRef ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const nonCompliant = compliance.filter(c => c.status === 'non_compliant').length
  const blockedTransfers = transfers.filter(t => t.status === 'blocked').length
  const totalRegions = regions.length
  const auditFlags = audit.filter(a => a.outcome === 'flagged' || a.outcome === 'blocked').length

  const TABS = [
    { id: 'regions' as const, label: 'REGIONS' },
    { id: 'classification' as const, label: 'CLASSIFICATION' },
    { id: 'compliance' as const, label: 'COMPLIANCE' },
    { id: 'transfers' as const, label: 'TRANSFERS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>DRSD</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DATA RESIDENCY â€” REGIONS + CLASSIFICATION + COMPLIANCE + TRANSFERS + AUDIT</span>
        {nonCompliant > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {nonCompliant} NON-COMPLIANT</span>}
        {blockedTransfers > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {blockedTransfers} BLOCKED TRANSFERS</span>}
        {auditFlags > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {auditFlags} AUDIT FLAGS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Regions" value={totalRegions} col={BLUE} />
        <StatCard label="Data Types" value={classification.length} col={PURPLE} />
        <StatCard label="Non-Compliant" value={nonCompliant} col={nonCompliant > 0 ? RED : GREEN} />
        <StatCard label="Blocked Transfers" value={blockedTransfers} col={blockedTransfers > 0 ? ORANGE : GREEN} />
        <StatCard label="Audit Flags" value={auditFlags} col={auditFlags > 0 ? AMBER : GREEN} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
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
              <thead><tr><Th>Region</Th><Th>Jurisdiction</Th><Th>Data Center</Th><Th>Status</Th><Th right>Total Assets</Th><Th right>PII Records</Th><Th>Storage</Th><Th right>Repl Lag (ms)</Th><Th>Frameworks</Th></tr></thead>
              <tbody>
                {regions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regions â€” check /api/v4/data-residency/regions</td></tr>}
                {regions.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.regionName}</Td>
                    <Td mono col={BLUE}>{r.jurisdiction}</Td>
                    <Td mono col={SUBTLE}>{r.dataCenter}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.status === 'active' ? GREEN : r.status === 'degraded' ? AMBER : RED }}>{r.status.toUpperCase()}</span></Td>
                    <Td right mono col={TEXT}>{r.totalAssets.toLocaleString()}</Td>
                    <Td right mono col={r.personalData > 0 ? ORANGE : SUBTLE}>{r.personalData.toLocaleString()}</Td>
                    <Td><UtilBar pct={r.storageCapTb > 0 ? (r.storageUsedTb / r.storageCapTb) * 100 : 0} /></Td>
                    <Td right mono col={r.replicationLag > 500 ? RED : r.replicationLag > 100 ? AMBER : GREEN}>{r.replicationLag}</Td>
                    <Td mono col={PURPLE} style={{ fontSize: 10 } as any}>{r.regulatoryFramework.join(', ')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'classification' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Data Type</Th><Th>Classification</Th><Th>Primary Region</Th><Th right>Records</Th><Th right>Retention (d)</Th><Th>Encryption</Th><Th>PII</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {classification.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No classification â€” check /api/v4/data-residency/classification</td></tr>}
                {classification.sort((a, b) => {
                  const ord: Record<string, number> = { top_secret: 0, restricted: 1, confidential: 2, internal: 3, public: 4 }
                  return (ord[a.classification] ?? 5) - (ord[b.classification] ?? 5)
                }).map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.dataType}</Td>
                    <Td><ClassBadge c={c.classification} /></Td>
                    <Td mono col={BLUE}>{c.regionPrimary}</Td>
                    <Td right mono col={TEXT}>{c.recordCount.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{c.retentionDays}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 } as any}>{c.encryptionLevel}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.piiContains ? ORANGE : SUBTLE }}>{c.piiContains ? 'PII' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{c.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'compliance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Framework</Th><Th>Jurisdiction</Th><Th>Requirement</Th><Th>Status</Th><Th>Affected Types</Th><Th>Last Checked</Th><Th>Due Date</Th><Th>Penalty</Th></tr></thead>
              <tbody>
                {compliance.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compliance â€” check /api/v4/data-residency/compliance</td></tr>}
                {compliance.sort((a, b) => {
                  const ord: Record<string, number> = { non_compliant: 0, under_review: 1, compliant: 2, exempt: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'non_compliant' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.framework}</Td>
                    <Td mono col={BLUE}>{c.jurisdiction}</Td>
                    <Td mono col={TEXT} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{c.requirement}</Td>
                    <Td><ComplianceBadge s={c.status} /></Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 } as any}>{c.affectedDataTypes.slice(0, 3).join(', ')}</Td>
                    <Td mono col={SUBTLE}>{c.lastChecked}</Td>
                    <Td mono col={SUBTLE}>{c.dueDate}</Td>
                    <Td mono col={c.penalty ? RED : SUBTLE}>{c.penalty || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'transfers' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Source</Th><Th>Destination</Th><Th>Data Type</Th><Th>Status</Th><Th right>Volume (MB)</Th><Th>Mechanism</Th><Th>Legal Basis</Th><Th>Initiated By</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {transfers.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No transfers â€” check /api/v4/data-residency/transfers</td></tr>}
                {transfers.map((t, i) => (
                  <tr key={i} style={{ background: t.status === 'blocked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={GREEN}>{t.sourceRegion}</Td>
                    <Td mono col={BLUE}>{t.destRegion}</Td>
                    <Td mono col={AMBER}>{t.dataType}</Td>
                    <Td><TransferBadge s={t.status} /></Td>
                    <Td right mono col={TEXT}>{t.volumeMb.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{t.mechanism}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 } as any}>{t.legalBasis}</Td>
                    <Td mono col={SUBTLE}>{t.initiatedBy}</Td>
                    <Td mono col={SUBTLE}>{t.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Action</Th><Th>Actor</Th><Th>Target Region</Th><Th>Data Type</Th><Th>Outcome</Th><Th>Policy Ref</Th><Th>Reason</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit â€” check /api/v4/data-residency/audit</td></tr>}
                {audit.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.action}</Td>
                    <Td mono col={BLUE}>{a.actor}</Td>
                    <Td mono col={TEXT}>{a.targetRegion}</Td>
                    <Td mono col={SUBTLE}>{a.dataType}</Td>
                    <Td><OutcomeBadge s={a.outcome} /></Td>
                    <Td mono col={PURPLE}>{a.policyRef}</Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.reason}</Td>
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
