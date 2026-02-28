import React, { useState, useEffect, useCallback } from 'react'
﻿// ControlsDomainUI2 â€” Bloomberg APEX Controls Domain terminal
// AP/AR reconciliation controls, evidence graph, ES-first search, risk assessment
// Tabs: CONTROLS | EVIDENCE | RECONCILIATION | RISK | AUDIT
// APIs: /api/v3/controls/items, /evidence, /reconciliation, /risk, /audit

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

interface ControlDoc {
  controlId: string
  title: string
  domain: 'ap' | 'ar' | 'reconciliation' | 'treasury' | 'compliance' | 'risk' | 'operations'
  category: 'preventive' | 'detective' | 'corrective' | 'directive'
  frequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  status: 'active' | 'draft' | 'suspended' | 'retired'
  owner: string
  lastTestedAt: string
  testResult: 'pass' | 'fail' | 'partial' | 'untested'
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  evidenceCount: number
  deficiencies: number
}

interface ControlEvidence {
  evidenceId: string
  controlId: string
  title: string
  type: 'screenshot' | 'log' | 'report' | 'attestation' | 'system_output' | 'sample'
  status: 'accepted' | 'pending' | 'rejected' | 'expired'
  reviewer: string
  reviewedAt: string
  expiresAt: string
  sizeBytes: number
  hash: string
}

interface ReconciliationItem {
  reconId: string
  entity: string
  period: string
  type: 'ap' | 'ar' | 'bank' | 'intercompany' | 'inventory' | 'payroll'
  status: 'reconciled' | 'unreconciled' | 'in_progress' | 'pending_approval' | 'exception'
  openItems: number
  exceptionAmount: number
  currency: string
  dueDate: string
  completedBy: string
  approvedBy: string
}

interface ControlRisk {
  riskId: string
  controlId: string
  description: string
  riskType: 'financial' | 'operational' | 'compliance' | 'reputational' | 'fraud'
  likelihood: 'high' | 'medium' | 'low'
  impact: 'critical' | 'high' | 'medium' | 'low'
  residualRisk: 'high' | 'medium' | 'low'
  mitigationStatus: 'mitigated' | 'partially_mitigated' | 'unmitigated' | 'accepted'
  owner: string
  dueDate: string
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
  const m: Record<string, string> = { active: GREEN, draft: BLUE, suspended: ORANGE, retired: SUBTLE, pass: GREEN, fail: RED, partial: AMBER, untested: SUBTLE, reconciled: GREEN, unreconciled: RED, in_progress: AMBER, pending_approval: BLUE, exception: RED, accepted: GREEN, pending: AMBER, rejected: RED, expired: SUBTLE, mitigated: GREEN, partially_mitigated: AMBER, unmitigated: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}


export function ControlsDomainUI2() {
  const [tab, setTab] = useState<'controls' | 'evidence' | 'reconciliation' | 'risk' | 'audit'>('controls')
  const [controls, setControls] = useState<ControlDoc[]>([])
  const [evidence, setEvidence] = useState<ControlEvidence[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationItem[]>([])
  const [risks, setRisks] = useState<ControlRisk[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const [rC, rE, rR, rRk, rA] = await Promise.allSettled([
        fetch('/api/v3/controls/items').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/controls/evidence').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/controls/reconciliation').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/controls/risk').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/controls/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.controls ?? rC.value.data ?? rC.value.items ?? []
        setControls(raw.map((c: any) => ({
          controlId: c.control_id ?? c.controlId ?? c.id ?? '',
          title: c.title ?? '', domain: c.domain ?? 'operations',
          category: c.category ?? 'detective', frequency: c.frequency ?? 'monthly',
          status: c.status ?? 'active', owner: c.owner ?? '',
          lastTestedAt: c.last_tested_at ?? c.lastTestedAt ?? '',
          testResult: c.test_result ?? c.testResult ?? 'untested',
          riskLevel: c.risk_level ?? c.riskLevel ?? 'medium',
          evidenceCount: Number(c.evidence_count ?? c.evidenceCount ?? 0),
          deficiencies: Number(c.deficiencies ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load controls')
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.evidence ?? rE.value.data ?? []
        setEvidence(raw.map((e: any) => ({
          evidenceId: e.evidence_id ?? e.evidenceId ?? e.id ?? '',
          controlId: e.control_id ?? e.controlId ?? '',
          title: e.title ?? '', type: e.type ?? 'report',
          status: e.status ?? 'pending', reviewer: e.reviewer ?? '',
          reviewedAt: e.reviewed_at ?? e.reviewedAt ?? '',
          expiresAt: e.expires_at ?? e.expiresAt ?? '',
          sizeBytes: Number(e.size_bytes ?? e.sizeBytes ?? 0),
          hash: e.hash ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reconciliation ?? rR.value.data ?? []
        setReconciliation(raw.map((r: any) => ({
          reconId: r.recon_id ?? r.reconId ?? r.id ?? '',
          entity: r.entity ?? '', period: r.period ?? '',
          type: r.type ?? 'bank', status: r.status ?? 'in_progress',
          openItems: Number(r.open_items ?? r.openItems ?? 0),
          exceptionAmount: Number(r.exception_amount ?? r.exceptionAmount ?? 0),
          currency: r.currency ?? 'USD', dueDate: r.due_date ?? r.dueDate ?? '',
          completedBy: r.completed_by ?? r.completedBy ?? '',
          approvedBy: r.approved_by ?? r.approvedBy ?? '',
        })))
      }
      if (rRk.status === 'fulfilled') {
        const raw = Array.isArray(rRk.value) ? rRk.value : rRk.value.risks ?? rRk.value.data ?? []
        setRisks(raw.map((r: any) => ({
          riskId: r.risk_id ?? r.riskId ?? r.id ?? '',
          controlId: r.control_id ?? r.controlId ?? '',
          description: r.description ?? '', riskType: r.risk_type ?? r.riskType ?? 'operational',
          likelihood: r.likelihood ?? 'medium', impact: r.impact ?? 'medium',
          residualRisk: r.residual_risk ?? r.residualRisk ?? 'medium',
          mitigationStatus: r.mitigation_status ?? r.mitigationStatus ?? 'unmitigated',
          owner: r.owner ?? '', dueDate: r.due_date ?? r.dueDate ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const failedControls = controls.filter(c => c.testResult === 'fail').length
  const deficientControls = controls.filter(c => c.deficiencies > 0).length
  const openExceptions = reconciliation.filter(r => r.status === 'exception').length
  const highRisks = risks.filter(r => r.residualRisk === 'high' || r.impact === 'critical').length
  const filtered = controls.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.domain.includes(search.toLowerCase()))

  const TABS2 = [
    { id: 'controls' as const, label: 'CONTROLS' },
    { id: 'evidence' as const, label: 'EVIDENCE' },
    { id: 'reconciliation' as const, label: 'RECONCILIATION' },
    { id: 'risk' as const, label: 'RISK' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CONTROLS DOMAIN â€” AP/AR RECONCILIATION + EVIDENCE GRAPH + ES-FIRST SEARCH</span>
        {failedControls > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {failedControls} FAILED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Controls" value={controls.length} col={BLUE} />
        <StatCard label="Failed Tests" value={failedControls} col={failedControls > 0 ? RED : GREEN} />
        <StatCard label="Deficiencies" value={deficientControls} col={deficientControls > 0 ? ORANGE : GREEN} />
        <StatCard label="Recon Exceptions" value={openExceptions} col={openExceptions > 0 ? RED : GREEN} />
        <StatCard label="High Risk Items" value={highRisks} col={highRisks > 0 ? RED : GREEN} />
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
        {tab === 'controls' && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search controls by title / domainâ€¦"
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '5px 10px', width: 320 }} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Control ID</Th><Th>Title</Th><Th>Domain</Th><Th>Category</Th><Th>Frequency</Th><Th>Status</Th><Th>Test Result</Th><Th>Risk</Th><Th right>Evidence</Th><Th right>Deficiencies</Th></tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No controls â€” check /api/v3/controls/items</td></tr>}
                  {filtered.sort((a, b) => a.deficiencies > 0 ? -1 : 0).map((c, i) => (
                    <tr key={i} style={{ background: c.testResult === 'fail' ? RED + '08' : c.deficiencies > 0 ? ORANGE + '06' : 'transparent' }}>
                      <Td mono col={AMBER}>{c.controlId}</Td>
                      <Td mono col={TEXT}>{c.title.slice(0, 40)}{c.title.length > 40 ? 'â€¦' : ''}</Td>
                      <Td mono col={BLUE}>{c.domain.toUpperCase()}</Td>
                      <Td mono col={PURPLE}>{c.category}</Td>
                      <Td mono col={SUBTLE}>{c.frequency}</Td>
                      <Td><StatusBadge s={c.status} /></Td>
                      <Td><StatusBadge s={c.testResult} /></Td>
                      <Td><RiskBadge r={c.riskLevel} /></Td>
                      <Td right mono col={TEXT}>{c.evidenceCount}</Td>
                      <Td right mono col={c.deficiencies > 0 ? RED : GREEN}>{c.deficiencies}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'evidence' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Evidence ID</Th><Th>Control ID</Th><Th>Title</Th><Th>Type</Th><Th>Status</Th><Th>Reviewer</Th><Th>Reviewed At</Th><Th>Expires At</Th></tr></thead>
              <tbody>
                {evidence.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No evidence â€” check /api/v3/controls/evidence</td></tr>}
                {evidence.sort((a, b) => a.status === 'rejected' ? -1 : 0).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'rejected' ? RED + '08' : e.status === 'expired' ? ORANGE + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.evidenceId}</Td>
                    <Td mono col={BLUE}>{e.controlId}</Td>
                    <Td mono col={TEXT}>{e.title.slice(0, 40)}{e.title.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={PURPLE}>{e.type.replace(/_/g, ' ')}</Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.reviewer || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.reviewedAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.expiresAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'reconciliation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Recon ID</Th><Th>Entity</Th><Th>Type</Th><Th>Period</Th><Th>Status</Th><Th right>Open Items</Th><Th right>Exception Amt</Th><Th>Ccy</Th><Th>Due Date</Th><Th>Approved By</Th></tr></thead>
              <tbody>
                {reconciliation.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reconciliation items â€” check /api/v3/controls/reconciliation</td></tr>}
                {reconciliation.sort((a, b) => a.status === 'exception' ? -1 : 0).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'exception' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reconId}</Td>
                    <Td mono col={TEXT}>{r.entity}</Td>
                    <Td mono col={PURPLE}>{r.type.toUpperCase()}</Td>
                    <Td mono col={SUBTLE}>{r.period}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={r.openItems > 0 ? ORANGE : GREEN}>{r.openItems}</Td>
                    <Td right mono col={r.exceptionAmount > 0 ? RED : GREEN}>{r.exceptionAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Td>
                    <Td mono col={SUBTLE}>{r.currency}</Td>
                    <Td mono col={SUBTLE}>{r.dueDate || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.approvedBy || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'risk' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Risk ID</Th><Th>Control ID</Th><Th>Description</Th><Th>Type</Th><Th>Likelihood</Th><Th>Impact</Th><Th>Residual</Th><Th>Mitigation</Th><Th>Owner</Th><Th>Due</Th></tr></thead>
              <tbody>
                {risks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No risk items â€” check /api/v3/controls/risk</td></tr>}
                {risks.sort((a, b) => a.residualRisk === 'high' ? -1 : 0).map((r, i) => (
                  <tr key={i} style={{ background: r.residualRisk === 'high' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.riskId}</Td>
                    <Td mono col={BLUE}>{r.controlId}</Td>
                    <Td mono col={TEXT}>{r.description.slice(0, 40)}{r.description.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={PURPLE}>{r.riskType}</Td>
                    <Td><RiskBadge r={r.likelihood} /></Td>
                    <Td><RiskBadge r={r.impact} /></Td>
                    <Td><RiskBadge r={r.residualRisk} /></Td>
                    <Td><StatusBadge s={r.mitigationStatus} /></Td>
                    <Td mono col={SUBTLE}>{r.owner || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.dueDate || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v3/controls/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
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
