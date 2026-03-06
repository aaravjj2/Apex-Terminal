import React, { useState, useEffect, useCallback } from 'react'
﻿// ThirdPartyRiskUI2 — Bloomberg APEX Third-Party Risk terminal
// Vendor assessment, risk monitoring, due diligence, contract compliance
// Tabs: VENDORS | ASSESSMENTS | MONITORING | CONTRACTS | AUDIT
// APIs: /api/v4/third-party-risk/vendors, /assessments, /monitoring, /contracts, /audit

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

interface Vendor {
  vendorId: string
  name: string
  category: 'cloud' | 'data_provider' | 'software' | 'consulting' | 'financial' | 'infrastructure' | 'compliance'
  criticality: 'critical' | 'high' | 'medium' | 'low'
  riskScore: number
  riskStatus: 'approved' | 'under_review' | 'flagged' | 'suspended' | 'terminated'
  country: string
  lastAssessmentAt: string
  nextReviewAt: string
  dataAccess: boolean
  regulatorySubject: boolean
  soxRelevant: boolean
  annualSpendUsd: number
}

interface VendorAssessment {
  assessmentId: string
  vendorId: string
  vendorName: string
  type: 'initial' | 'annual' | 'triggered' | 'due_diligence' | 'exit'
  overallScore: number
  securityScore: number
  financialScore: number
  complianceScore: number
  operationalScore: number
  status: 'draft' | 'in_review' | 'completed' | 'failed'
  assessedBy: string
  completedAt: string
  findings: number
  criticalFindings: number
}

interface VendorMonitor {
  monitorId: string
  vendorId: string
  vendorName: string
  metricType: 'sla_compliance' | 'incident_rate' | 'data_breach' | 'financial_health' | 'regulatory_news'
  currentValue: number
  threshold: number
  status: 'normal' | 'warning' | 'alert' | 'critical'
  trend: 'improving' | 'stable' | 'degrading'
  lastUpdated: string
}

interface VendorContract {
  contractId: string
  vendorId: string
  vendorName: string
  type: 'master_services' | 'data_processing' | 'nda' | 'sow' | 'license'
  status: 'active' | 'expiring_soon' | 'expired' | 'terminated' | 'under_negotiation'
  startDate: string
  endDate: string
  valueUsd: number
  autoRenew: boolean
  dpaPresent: boolean
  slaIncluded: boolean
}

interface TPRAuditEntry {
  auditId: string
  vendorId: string
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
  const m: Record<string, string> = { approved: GREEN, under_review: AMBER, flagged: RED, suspended: RED, terminated: SUBTLE, draft: SUBTLE, in_review: AMBER, completed: GREEN, failed: RED, active: GREEN, expiring_soon: ORANGE, expired: RED, under_negotiation: BLUE, normal: GREEN, warning: AMBER, alert: ORANGE, critical: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function CritBadge({ c }: { c: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function TrendArrow({ t }: { t: string }) {
  const m: Record<string, [string, string]> = { improving: ['â–²', GREEN], stable: ['—', SUBTLE], degrading: ['â–¼', RED] }
  const [sym, col] = m[t] ?? ['?', SUBTLE]
  return <span style={{ color: col, fontFamily: MONO, fontSize: 11 }}>{sym}</span>
}
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const col = pct >= 80 ? GREEN : pct >= 60 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{score.toFixed(0)}</span>
    </div>
  )
}


export function ThirdPartyRiskUI2() {
  const [tab, setTab] = useState<'vendors' | 'assessments' | 'monitoring' | 'contracts' | 'audit'>('vendors')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [assessments, setAssessments] = useState<VendorAssessment[]>([])
  const [monitoring, setMonitoring] = useState<VendorMonitor[]>([])
  const [contracts, setContracts] = useState<VendorContract[]>([])
  const [auditLog, setAuditLog] = useState<TPRAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rV, rA, rM, rC, rAu] = await Promise.allSettled([
        fetch('/api/v4/third-party-risk/vendors').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/third-party-risk/assessments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/third-party-risk/monitoring').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/third-party-risk/contracts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/third-party-risk/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.vendors ?? rV.value.data ?? []
        setVendors(raw.map((v: any) => ({
          vendorId: v.vendor_id ?? v.vendorId ?? '', name: v.name ?? '',
          category: v.category ?? 'software', criticality: v.criticality ?? 'medium',
          riskScore: Number(v.risk_score ?? v.riskScore ?? 0),
          riskStatus: v.risk_status ?? v.riskStatus ?? 'under_review',
          country: v.country ?? '', lastAssessmentAt: v.last_assessment_at ?? v.lastAssessmentAt ?? '',
          nextReviewAt: v.next_review_at ?? v.nextReviewAt ?? '',
          dataAccess: Boolean(v.data_access ?? v.dataAccess),
          regulatorySubject: Boolean(v.regulatory_subject ?? v.regulatorySubject),
          soxRelevant: Boolean(v.sox_relevant ?? v.soxRelevant),
          annualSpendUsd: Number(v.annual_spend_usd ?? v.annualSpendUsd ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load vendor data')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.assessments ?? rA.value.data ?? []
        setAssessments(raw.map((a: any) => ({
          assessmentId: a.assessment_id ?? a.assessmentId ?? '', vendorId: a.vendor_id ?? a.vendorId ?? '',
          vendorName: a.vendor_name ?? a.vendorName ?? '', type: a.type ?? 'annual',
          overallScore: Number(a.overall_score ?? a.overallScore ?? 0),
          securityScore: Number(a.security_score ?? a.securityScore ?? 0),
          financialScore: Number(a.financial_score ?? a.financialScore ?? 0),
          complianceScore: Number(a.compliance_score ?? a.complianceScore ?? 0),
          operationalScore: Number(a.operational_score ?? a.operationalScore ?? 0),
          status: a.status ?? 'draft', assessedBy: a.assessed_by ?? a.assessedBy ?? '',
          completedAt: a.completed_at ?? a.completedAt ?? '',
          findings: Number(a.findings ?? 0), criticalFindings: Number(a.critical_findings ?? a.criticalFindings ?? 0),
        })))
      }
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.monitoring ?? rM.value.data ?? []
        setMonitoring(raw.map((m: any) => ({
          monitorId: m.monitor_id ?? m.monitorId ?? '', vendorId: m.vendor_id ?? m.vendorId ?? '',
          vendorName: m.vendor_name ?? m.vendorName ?? '',
          metricType: m.metric_type ?? m.metricType ?? 'sla_compliance',
          currentValue: Number(m.current_value ?? m.currentValue ?? 0),
          threshold: Number(m.threshold ?? 0), status: m.status ?? 'normal',
          trend: m.trend ?? 'stable', lastUpdated: m.last_updated ?? m.lastUpdated ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.contracts ?? rC.value.data ?? []
        setContracts(raw.map((c: any) => ({
          contractId: c.contract_id ?? c.contractId ?? '', vendorId: c.vendor_id ?? c.vendorId ?? '',
          vendorName: c.vendor_name ?? c.vendorName ?? '', type: c.type ?? 'master_services',
          status: c.status ?? 'active', startDate: c.start_date ?? c.startDate ?? '',
          endDate: c.end_date ?? c.endDate ?? '', valueUsd: Number(c.value_usd ?? c.valueUsd ?? 0),
          autoRenew: Boolean(c.auto_renew ?? c.autoRenew),
          dpaPresent: Boolean(c.dpa_present ?? c.dpaPresent),
          slaIncluded: Boolean(c.sla_included ?? c.slaIncluded),
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', vendorId: a.vendor_id ?? a.vendorId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const flaggedVendors = vendors.filter(v => v.riskStatus === 'flagged' || v.riskStatus === 'suspended').length
  const criticalVendors = vendors.filter(v => v.criticality === 'critical').length
  const alertMonitors = monitoring.filter(m => m.status === 'alert' || m.status === 'critical').length
  const expiringContracts = contracts.filter(c => c.status === 'expiring_soon').length

  const TABS2 = [
    { id: 'vendors' as const, label: 'VENDORS' },
    { id: 'assessments' as const, label: 'ASSESSMENTS' },
    { id: 'monitoring' as const, label: 'MONITORING' },
    { id: 'contracts' as const, label: 'CONTRACTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>THIRD-PARTY RISK — VENDOR ASSESSMENT + MONITORING + CONTRACT COMPLIANCE</span>
        {flaggedVendors > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {flaggedVendors} FLAGGED</span>}
        {alertMonitors > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚠‘ {alertMonitors} MONITOR ALERTS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Vendors" value={vendors.length} col={BLUE} />
        <StatCard label="Flagged/Suspended" value={flaggedVendors} col={flaggedVendors > 0 ? RED : GREEN} />
        <StatCard label="Critical Vendors" value={criticalVendors} col={ORANGE} />
        <StatCard label="Monitor Alerts" value={alertMonitors} col={alertMonitors > 0 ? RED : GREEN} />
        <StatCard label="Expiring Contracts" value={expiringContracts} col={expiringContracts > 0 ? AMBER : SUBTLE} />
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

        {tab === 'vendors' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Vendor ID</Th><Th>Name</Th><Th>Category</Th><Th>Criticality</Th><Th>Risk Status</Th><Th right>Risk Score</Th><Th>Country</Th><Th>Data</Th><Th>SOX</Th><Th right>Annual Spend</Th></tr></thead>
              <tbody>
                {vendors.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No vendors</td></tr>}
                {vendors.sort((a, b) => b.riskScore - a.riskScore).map((v, i) => (
                  <tr key={i} style={{ background: v.riskStatus === 'flagged' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.vendorId}</Td>
                    <Td mono col={TEXT}>{v.name}</Td>
                    <Td mono col={BLUE}>{v.category.replace(/_/g, ' ')}</Td>
                    <Td><CritBadge c={v.criticality} /></Td>
                    <Td><StatusBadge s={v.riskStatus} /></Td>
                    <Td right mono col={v.riskScore > 75 ? RED : v.riskScore > 50 ? AMBER : GREEN}>{v.riskScore.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{v.country || '—'}</Td>
                    <Td mono col={v.dataAccess ? ORANGE : SUBTLE}>{v.dataAccess ? 'âœ“' : '—'}</Td>
                    <Td mono col={v.soxRelevant ? PURPLE : SUBTLE}>{v.soxRelevant ? 'âœ“' : '—'}</Td>
                    <Td right mono col={TEXT}>${(v.annualSpendUsd / 1000).toFixed(0)}K</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'assessments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Vendor</Th><Th>Type</Th><Th>Status</Th><Th>Overall</Th><Th>Security</Th><Th>Compliance</Th><Th>Financial</Th><Th right>Findings</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {assessments.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No assessments</td></tr>}
                {assessments.sort((a, b) => a.overallScore - b.overallScore).map((a, i) => (
                  <tr key={i} style={{ background: a.criticalFindings > 0 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.assessmentId}</Td>
                    <Td mono col={TEXT}>{a.vendorName}</Td>
                    <Td mono col={BLUE}>{a.type.replace(/_/g, ' ')}</Td>
                    <Td><StatusBadge s={a.status} /></Td>
                    <Td><ScoreBar score={a.overallScore} /></Td>
                    <Td><ScoreBar score={a.securityScore} /></Td>
                    <Td><ScoreBar score={a.complianceScore} /></Td>
                    <Td><ScoreBar score={a.financialScore} /></Td>
                    <Td right mono col={a.criticalFindings > 0 ? RED : TEXT}>{a.criticalFindings}/{a.findings}</Td>
                    <Td mono col={SUBTLE}>{a.completedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'monitoring' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Vendor</Th><Th>Metric</Th><Th>Status</Th><Th right>Current</Th><Th right>Threshold</Th><Th>Trend</Th><Th>Last Updated</Th></tr></thead>
              <tbody>
                {monitoring.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No monitor data</td></tr>}
                {monitoring.sort((a, b) => a.status === 'critical' ? -1 : 0).map((m, i) => (
                  <tr key={i} style={{ background: m.status === 'critical' ? RED + '0a' : m.status === 'alert' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.vendorName || m.vendorId}</Td>
                    <Td mono col={BLUE}>{m.metricType.replace(/_/g, ' ')}</Td>
                    <Td><StatusBadge s={m.status} /></Td>
                    <Td right mono col={TEXT}>{m.currentValue.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{m.threshold.toFixed(2)}</Td>
                    <Td><TrendArrow t={m.trend} /></Td>
                    <Td mono col={SUBTLE}>{m.lastUpdated}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'contracts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Contract ID</Th><Th>Vendor</Th><Th>Type</Th><Th>Status</Th><Th>Start</Th><Th>End</Th><Th right>Value USD</Th><Th>DPA</Th><Th>SLA</Th><Th>Auto-Renew</Th></tr></thead>
              <tbody>
                {contracts.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No contracts</td></tr>}
                {contracts.sort((a, b) => a.status === 'expiring_soon' ? -1 : 0).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'expiring_soon' ? AMBER + '0a' : c.status === 'expired' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.contractId}</Td>
                    <Td mono col={TEXT}>{c.vendorName}</Td>
                    <Td mono col={BLUE}>{c.type.replace(/_/g, ' ')}</Td>
                    <Td><StatusBadge s={c.status} /></Td>
                    <Td mono col={SUBTLE}>{c.startDate}</Td>
                    <Td mono col={c.status === 'expiring_soon' ? AMBER : SUBTLE}>{c.endDate}</Td>
                    <Td right mono col={c.valueUsd > 1000000 ? ORANGE : TEXT}>${(c.valueUsd / 1000).toFixed(0)}K</Td>
                    <Td mono col={c.dpaPresent ? GREEN : RED}>{c.dpaPresent ? 'âœ“' : 'âœ—'}</Td>
                    <Td mono col={c.slaIncluded ? GREEN : SUBTLE}>{c.slaIncluded ? 'âœ“' : '—'}</Td>
                    <Td mono col={c.autoRenew ? AMBER : SUBTLE}>{c.autoRenew ? 'YES' : 'NO'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Vendor ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.vendorId}</Td>
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
