import React, { useState, useEffect, useCallback } from 'react'
﻿// GlobalReadinessUI2 â€” Bloomberg GLRD global readiness certification terminal
// Launch checklist, region gates, certification status, compliance, audit
// Tabs: CHECKLIST | REGIONS | GATES | CERTIFICATIONS | AUDIT
// APIs: /api/v4/global-readiness/checklist, /regions, /gates, /certifications, /audit

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

interface ChecklistItem {
  itemId: string
  category: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'pending' | 'blocked' | 'na'
  priority: 'critical' | 'high' | 'medium' | 'low'
  owner: string
  dueDate: string
  lastChecked: string
  region: string
  blocker: boolean
}

interface RegionReadiness {
  regionCode: string
  regionName: string
  overallStatus: 'ready' | 'not-ready' | 'partial' | 'blocked'
  checksPassed: number
  totalChecks: number
  criticalFailed: number
  estimatedLaunchDate: string
  regulatory: string
  dataResidency: string
  supportTier: string
}

interface GateEntry {
  gateId: string
  gateName: string
  gateType: string
  status: 'open' | 'closed' | 'pending'
  criteria: string
  approvedBy: string
  approvedAt: string
  requiredFor: string[]
  blocksRegion: string
  expiresAt: string
}

interface CertificationEntry {
  certId: string
  certName: string
  jurisdiction: string
  status: 'active' | 'expired' | 'pending' | 'revoked'
  issuedAt: string
  expiresAt: string
  issuingBody: string
  scope: string
  renewalRequired: boolean
  daysUntilExpiry: number
}

interface ReadinessAuditEntry {
  auditId: string
  action: string
  actor: string
  region: string
  gate: string
  outcome: 'pass' | 'fail' | 'override'
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
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { pass: GREEN, fail: RED, pending: AMBER, blocked: RED, na: SUBTLE, ready: GREEN, 'not-ready': RED, partial: AMBER, open: GREEN, closed: RED, active: GREEN, expired: RED, revoked: RED, override: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function PriorityBadge({ p }: { p: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function GateBar({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0
  const col = pct >= 100 ? GREEN : pct >= 75 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 70, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: col }}>{passed}/{total}</span>
    </div>
  )
}


export function GlobalReadinessUI2() {
  const [tab, setTab] = useState<'checklist' | 'regions' | 'gates' | 'certifications' | 'audit'>('checklist')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [regions, setRegions] = useState<RegionReadiness[]>([])
  const [gates, setGates] = useState<GateEntry[]>([])
  const [certs, setCerts] = useState<CertificationEntry[]>([])
  const [auditLog, setAuditLog] = useState<ReadinessAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rCh, rR, rG, rCe, rA] = await Promise.allSettled([
        fetch('/api/v4/global-readiness/checklist').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/global-readiness/regions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/global-readiness/gates').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/global-readiness/certifications').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/global-readiness/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rCh.status === 'fulfilled') {
        const raw = Array.isArray(rCh.value) ? rCh.value : rCh.value.checklist ?? rCh.value.data ?? []
        setChecklist(raw.map((c: any) => ({
          itemId: c.item_id ?? c.itemId ?? '', category: c.category ?? '', title: c.title ?? '',
          description: c.description ?? '', status: c.status ?? 'pending',
          priority: c.priority ?? 'medium', owner: c.owner ?? '', dueDate: c.due_date ?? c.dueDate ?? '',
          lastChecked: c.last_checked ?? c.lastChecked ?? '', region: c.region ?? 'GLOBAL',
          blocker: Boolean(c.blocker ?? false),
        })))
        setErr(null)
      } else setErr('Failed to load checklist')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.regions ?? rR.value.data ?? []
        setRegions(raw.map((r: any) => ({
          regionCode: r.region_code ?? r.regionCode ?? '', regionName: r.region_name ?? r.regionName ?? '',
          overallStatus: r.overall_status ?? r.overallStatus ?? 'partial',
          checksPassed: Number(r.checks_passed ?? r.checksPassed ?? 0),
          totalChecks: Number(r.total_checks ?? r.totalChecks ?? 0),
          criticalFailed: Number(r.critical_failed ?? r.criticalFailed ?? 0),
          estimatedLaunchDate: r.estimated_launch_date ?? r.estimatedLaunchDate ?? '',
          regulatory: r.regulatory ?? '', dataResidency: r.data_residency ?? r.dataResidency ?? '',
          supportTier: r.support_tier ?? r.supportTier ?? '',
        })))
      }
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.gates ?? rG.value.data ?? []
        setGates(raw.map((g: any) => ({
          gateId: g.gate_id ?? g.gateId ?? '', gateName: g.gate_name ?? g.gateName ?? '',
          gateType: g.gate_type ?? g.gateType ?? '', status: g.status ?? 'pending',
          criteria: g.criteria ?? '', approvedBy: g.approved_by ?? g.approvedBy ?? '',
          approvedAt: g.approved_at ?? g.approvedAt ?? '', requiredFor: Array.isArray(g.required_for ?? g.requiredFor) ? (g.required_for ?? g.requiredFor) : [],
          blocksRegion: g.blocks_region ?? g.blocksRegion ?? '', expiresAt: g.expires_at ?? g.expiresAt ?? '',
        })))
      }
      if (rCe.status === 'fulfilled') {
        const raw = Array.isArray(rCe.value) ? rCe.value : rCe.value.certifications ?? rCe.value.data ?? []
        setCerts(raw.map((c: any) => ({
          certId: c.cert_id ?? c.certId ?? '', certName: c.cert_name ?? c.certName ?? '',
          jurisdiction: c.jurisdiction ?? '', status: c.status ?? 'pending',
          issuedAt: c.issued_at ?? c.issuedAt ?? '', expiresAt: c.expires_at ?? c.expiresAt ?? '',
          issuingBody: c.issuing_body ?? c.issuingBody ?? '', scope: c.scope ?? '',
          renewalRequired: Boolean(c.renewal_required ?? c.renewalRequired ?? false),
          daysUntilExpiry: Number(c.days_until_expiry ?? c.daysUntilExpiry ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          region: a.region ?? '', gate: a.gate ?? '', outcome: a.outcome ?? 'pass',
          notes: a.notes ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const blockingItems = checklist.filter(c => c.blocker && c.status !== 'pass').length
  const failedItems = checklist.filter(c => c.status === 'fail').length
  const readyRegions = regions.filter(r => r.overallStatus === 'ready').length
  const closedGates = gates.filter(g => g.status === 'closed').length
  const expiringCerts = certs.filter(c => c.daysUntilExpiry < 30 && c.status === 'active').length

  const TABS2 = [
    { id: 'checklist' as const, label: 'CHECKLIST' },
    { id: 'regions' as const, label: 'REGIONS' },
    { id: 'gates' as const, label: 'GATES' },
    { id: 'certifications' as const, label: 'CERTIFICATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>GLRD</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>GLOBAL READINESS â€” LAUNCH CHECKLIST + REGION GATES + CERTIFICATIONS + COMPLIANCE</span>
        {blockingItems > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {blockingItems} BLOCKERS</span>}
        {closedGates > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {closedGates} GATES CLOSED</span>}
        {expiringCerts > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {expiringCerts} CERTS EXPIRING</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Checklist Items" value={checklist.length} col={BLUE} />
        <StatCard label="Blockers" value={blockingItems} col={blockingItems > 0 ? RED : GREEN} />
        <StatCard label="Regions Ready" value={`${readyRegions}/${regions.length}`} col={readyRegions === regions.length ? GREEN : AMBER} />
        <StatCard label="Gates Closed" value={closedGates} col={closedGates > 0 ? RED : GREEN} />
        <StatCard label="Certs Expiring" value={expiringCerts} col={expiringCerts > 0 ? AMBER : SUBTLE} />
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

        {tab === 'checklist' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Category</Th><Th>Title</Th><Th>Priority</Th><Th>Status</Th><Th>Region</Th><Th>Blocker</Th><Th>Owner</Th><Th>Due</Th><Th>Last Checked</Th></tr></thead>
              <tbody>
                {checklist.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No checklist â€” check /api/v4/global-readiness/checklist</td></tr>}
                {checklist.sort((a, b) => {
                  const pOrd: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (pOrd[a.priority] ?? 4) - (pOrd[b.priority] ?? 4)
                }).map((c, i) => (
                  <tr key={i} style={{ background: c.blocker && c.status !== 'pass' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={BLUE}>{c.category}</Td>
                    <Td mono col={TEXT}>{c.title}</Td>
                    <Td><PriorityBadge p={c.priority} /></Td>
                    <Td><StatusBadge2 s={c.status} /></Td>
                    <Td mono col={SUBTLE}>{c.region}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.blocker ? RED : SUBTLE }}>{c.blocker ? 'âš‘ YES' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{c.owner}</Td>
                    <Td mono col={AMBER}>{c.dueDate}</Td>
                    <Td mono col={SUBTLE}>{c.lastChecked}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'regions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Code</Th><Th>Region</Th><Th>Status</Th><Th>Progress</Th><Th right>Critical Failed</Th><Th>Regulatory</Th><Th>Data Residency</Th><Th>Support Tier</Th><Th>Est. Launch</Th></tr></thead>
              <tbody>
                {regions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regions â€” check /api/v4/global-readiness/regions</td></tr>}
                {regions.sort((a, b) => {
                  const ord: Record<string, number> = { blocked: 0, 'not-ready': 1, partial: 2, ready: 3 }
                  return (ord[a.overallStatus] ?? 4) - (ord[b.overallStatus] ?? 4)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.overallStatus === 'blocked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.regionCode}</Td>
                    <Td mono col={TEXT}>{r.regionName}</Td>
                    <Td><StatusBadge2 s={r.overallStatus} /></Td>
                    <Td><GateBar passed={r.checksPassed} total={r.totalChecks} /></Td>
                    <Td right mono col={r.criticalFailed > 0 ? RED : GREEN}>{r.criticalFailed}</Td>
                    <Td mono col={SUBTLE}>{r.regulatory}</Td>
                    <Td mono col={SUBTLE}>{r.dataResidency}</Td>
                    <Td mono col={BLUE}>{r.supportTier}</Td>
                    <Td mono col={AMBER}>{r.estimatedLaunchDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Gate ID</Th><Th>Gate Name</Th><Th>Type</Th><Th>Status</Th><Th>Criteria</Th><Th>Blocks Region</Th><Th>Approved By</Th><Th>Approved At</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {gates.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No gates â€” check /api/v4/global-readiness/gates</td></tr>}
                {gates.sort((a, b) => {
                  const ord: Record<string, number> = { closed: 0, pending: 1, open: 2 }
                  return (ord[a.status] ?? 3) - (ord[b.status] ?? 3)
                }).map((g, i) => (
                  <tr key={i} style={{ background: g.status === 'closed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{g.gateId}</Td>
                    <Td mono col={TEXT}>{g.gateName}</Td>
                    <Td mono col={PURPLE}>{g.gateType}</Td>
                    <Td><StatusBadge2 s={g.status} /></Td>
                    <Td mono col={SUBTLE}>{g.criteria}</Td>
                    <Td mono col={g.blocksRegion ? RED : SUBTLE}>{g.blocksRegion || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{g.approvedBy || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{g.approvedAt || 'â€”'}</Td>
                    <Td mono col={AMBER}>{g.expiresAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'certifications' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Cert ID</Th><Th>Certification</Th><Th>Jurisdiction</Th><Th>Status</Th><Th>Issuing Body</Th><Th>Scope</Th><Th right>Days Until Expiry</Th><Th>Renewal Req</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {certs.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No certifications â€” check /api/v4/global-readiness/certifications</td></tr>}
                {certs.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'expired' || c.status === 'revoked' ? RED + '0a' : c.daysUntilExpiry < 30 ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.certId}</Td>
                    <Td mono col={TEXT}>{c.certName}</Td>
                    <Td mono col={BLUE}>{c.jurisdiction}</Td>
                    <Td><StatusBadge2 s={c.status} /></Td>
                    <Td mono col={SUBTLE}>{c.issuingBody}</Td>
                    <Td mono col={SUBTLE}>{c.scope}</Td>
                    <Td right mono col={c.daysUntilExpiry < 30 ? RED : c.daysUntilExpiry < 90 ? AMBER : GREEN}>{c.daysUntilExpiry}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.renewalRequired ? ORANGE : SUBTLE }}>{c.renewalRequired ? 'YES' : 'NO'}</span></Td>
                    <Td mono col={c.daysUntilExpiry < 30 ? RED : SUBTLE}>{c.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Region</Th><Th>Gate</Th><Th>Outcome</Th><Th>Notes</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/global-readiness/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.region || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.gate || 'â€”'}</Td>
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
