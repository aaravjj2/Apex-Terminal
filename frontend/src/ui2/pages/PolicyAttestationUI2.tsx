import React, { useState, useEffect, useCallback } from 'react'
﻿// PolicyAttestationUI2 — Bloomberg APEX policy attestation terminal
// Attestation packs, evidence collection, compliance reporting, policy lifecycle, audit
// Tabs: PACKS | ATTESTATIONS | EVIDENCE | COMPLIANCE | AUDIT
// APIs: /api/v4/policy-attestation/packs, /attestations, /evidence, /compliance, /audit

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

interface AttestationPack {
  packId: string
  name: string
  framework: string
  category: string
  status: 'active' | 'draft' | 'archived'
  controlCount: number
  attestedCount: number
  evidenceRequired: number
  dueDate: string
  owningTeam: string
  completionPct: number
}

interface AttestationRecord {
  attestationId: string
  packId: string
  packName: string
  controlId: string
  controlName: string
  attestedBy: string
  attestedAt: string
  outcome: 'pass' | 'fail' | 'exception' | 'not_applicable'
  expiresAt: string
  evidenceCount: number
  comment: string
}

interface EvidenceItem {
  evidenceId: string
  packId: string
  controlId: string
  evidenceType: 'document' | 'screenshot' | 'log' | 'api_response' | 'auto_generated'
  title: string
  source: string
  collectedAt: string
  validUntil: string
  status: 'valid' | 'expired' | 'pending_review'
  collectedBy: string
}

interface ComplianceReport {
  reportId: string
  framework: string
  period: string
  overallScore: number
  passedControls: number
  failedControls: number
  exceptionsControls: number
  naControls: number
  generatedAt: string
  status: 'final' | 'draft' | 'under_review'
}

interface PolicyAttAuditEntry {
  auditId: string
  packId: string
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
function OutcomeBadge({ s }: { s: string }) {
  const m: Record<string, string> = { pass: GREEN, fail: RED, exception: ORANGE, not_applicable: SUBTLE, valid: GREEN, expired: RED, pending_review: AMBER, final: GREEN, draft: BLUE, under_review: AMBER, active: GREEN, archived: SUBTLE, pass2: GREEN, fail2: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/[_2]/g, ' ').toUpperCase()}</span>
}
function ProgressBar({ pct, col }: { pct: number; col?: string }) {
  const c = col ?? (pct >= 90 ? GREEN : pct >= 60 ? AMBER : RED)
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(0)}%</span>
    </div>
  )
}


export function PolicyAttestationUI2() {
  const [tab, setTab] = useState<'packs' | 'attestations' | 'evidence' | 'compliance' | 'audit'>('packs')
  const [packs, setPacks] = useState<AttestationPack[]>([])
  const [attestations, setAttestations] = useState<AttestationRecord[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [compliance, setCompliance] = useState<ComplianceReport[]>([])
  const [auditLog, setAuditLog] = useState<PolicyAttAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rA, rE, rC, rAu] = await Promise.allSettled([
        fetch('/api/v4/policy-attestation/packs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-attestation/attestations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-attestation/evidence').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-attestation/compliance').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-attestation/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.packs ?? rP.value.data ?? []
        setPacks(raw.map((p: any) => ({
          packId: p.pack_id ?? p.packId ?? '', name: p.name ?? '',
          framework: p.framework ?? '', category: p.category ?? '',
          status: p.status ?? 'active', controlCount: Number(p.control_count ?? p.controlCount ?? 0),
          attestedCount: Number(p.attested_count ?? p.attestedCount ?? 0),
          evidenceRequired: Number(p.evidence_required ?? p.evidenceRequired ?? 0),
          dueDate: p.due_date ?? p.dueDate ?? '', owningTeam: p.owning_team ?? p.owningTeam ?? '',
          completionPct: Number(p.completion_pct ?? p.completionPct ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load packs')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.attestations ?? rA.value.data ?? []
        setAttestations(raw.map((a: any) => ({
          attestationId: a.attestation_id ?? a.attestationId ?? '', packId: a.pack_id ?? a.packId ?? '',
          packName: a.pack_name ?? a.packName ?? '', controlId: a.control_id ?? a.controlId ?? '',
          controlName: a.control_name ?? a.controlName ?? '', attestedBy: a.attested_by ?? a.attestedBy ?? '',
          attestedAt: a.attested_at ?? a.attestedAt ?? '', outcome: a.outcome ?? 'not_applicable',
          expiresAt: a.expires_at ?? a.expiresAt ?? '', evidenceCount: Number(a.evidence_count ?? a.evidenceCount ?? 0),
          comment: a.comment ?? '',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.evidence ?? rE.value.data ?? []
        setEvidence(raw.map((e: any) => ({
          evidenceId: e.evidence_id ?? e.evidenceId ?? '', packId: e.pack_id ?? e.packId ?? '',
          controlId: e.control_id ?? e.controlId ?? '',
          evidenceType: e.evidence_type ?? e.evidenceType ?? 'document', title: e.title ?? '',
          source: e.source ?? '', collectedAt: e.collected_at ?? e.collectedAt ?? '',
          validUntil: e.valid_until ?? e.validUntil ?? '', status: e.status ?? 'valid',
          collectedBy: e.collected_by ?? e.collectedBy ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.compliance ?? rC.value.data ?? []
        setCompliance(raw.map((c: any) => ({
          reportId: c.report_id ?? c.reportId ?? '', framework: c.framework ?? '',
          period: c.period ?? '', overallScore: Number(c.overall_score ?? c.overallScore ?? 0),
          passedControls: Number(c.passed_controls ?? c.passedControls ?? 0),
          failedControls: Number(c.failed_controls ?? c.failedControls ?? 0),
          exceptionsControls: Number(c.exceptions_controls ?? c.exceptionsControls ?? 0),
          naControls: Number(c.na_controls ?? c.naControls ?? 0),
          generatedAt: c.generated_at ?? c.generatedAt ?? '', status: c.status ?? 'draft',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', packId: a.pack_id ?? a.packId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const failedAttestations = attestations.filter(a => a.outcome === 'fail').length
  const expiredEvidence = evidence.filter(e => e.status === 'expired').length
  const activePacks = packs.filter(p => p.status === 'active').length
  const avgScore = compliance.length > 0 ? compliance.reduce((s, c) => s + c.overallScore, 0) / compliance.length : 0

  const TABS2 = [
    { id: 'packs' as const, label: 'PACKS' },
    { id: 'attestations' as const, label: 'ATTESTATIONS' },
    { id: 'evidence' as const, label: 'EVIDENCE' },
    { id: 'compliance' as const, label: 'COMPLIANCE' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>POLICY ATTESTATION — PACKS + EVIDENCE COLLECTION + COMPLIANCE REPORTING</span>
        {failedAttestations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {failedAttestations} FAILED ATTESTATIONS</span>}
        {expiredEvidence > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚠‘ {expiredEvidence} EXPIRED EVIDENCE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Packs" value={activePacks} col={BLUE} />
        <StatCard label="Failed Attestations" value={failedAttestations} col={failedAttestations > 0 ? RED : GREEN} />
        <StatCard label="Expired Evidence" value={expiredEvidence} col={expiredEvidence > 0 ? ORANGE : GREEN} />
        <StatCard label="Avg Score" value={avgScore > 0 ? `${avgScore.toFixed(1)}%` : '—'} col={avgScore >= 90 ? GREEN : avgScore >= 70 ? AMBER : RED} />
        <StatCard label="Reports" value={compliance.filter(c => c.status === 'final').length} col={PURPLE} />
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

        {tab === 'packs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Pack</Th><Th>Framework</Th><Th>Category</Th><Th>Status</Th><Th right>Controls</Th><Th>Completion</Th><Th>Team</Th><Th>Due Date</Th></tr></thead>
              <tbody>
                {packs.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No packs</td></tr>}
                {packs.sort((a, b) => a.completionPct - b.completionPct).map((p, i) => (
                  <tr key={i} style={{ background: p.completionPct < 50 ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td mono col={BLUE}>{p.framework}</Td>
                    <Td mono col={PURPLE}>{p.category}</Td>
                    <Td><OutcomeBadge s={p.status} /></Td>
                    <Td right mono col={SUBTLE}>{p.attestedCount}/{p.controlCount}</Td>
                    <Td><ProgressBar pct={p.completionPct} /></Td>
                    <Td mono col={TEXT}>{p.owningTeam}</Td>
                    <Td mono col={SUBTLE}>{p.dueDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'attestations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Control</Th><Th>Pack</Th><Th>Attested By</Th><Th>Outcome</Th><Th right>Evidence</Th><Th>Attested</Th><Th>Expires</Th><Th>Comment</Th></tr></thead>
              <tbody>
                {attestations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No attestations</td></tr>}
                {attestations.sort((a, b) => a.outcome === 'fail' ? -1 : 1).map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.controlName.slice(0, 32)}{a.controlName.length > 32 ? 'â€¦' : ''}</Td>
                    <Td mono col={BLUE}>{a.packName}</Td>
                    <Td mono col={TEXT}>{a.attestedBy}</Td>
                    <Td><OutcomeBadge s={a.outcome} /></Td>
                    <Td right mono col={a.evidenceCount === 0 ? ORANGE : GREEN}>{a.evidenceCount}</Td>
                    <Td mono col={SUBTLE}>{a.attestedAt}</Td>
                    <Td mono col={SUBTLE}>{a.expiresAt || '—'}</Td>
                    <Td mono col={SUBTLE}>{a.comment.slice(0, 28) || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'evidence' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Title</Th><Th>Type</Th><Th>Source</Th><Th>Status</Th><Th>Collected By</Th><Th>Collected</Th><Th>Valid Until</Th></tr></thead>
              <tbody>
                {evidence.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No evidence</td></tr>}
                {evidence.sort((a, b) => a.status === 'expired' ? -1 : 1).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'expired' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.title.slice(0, 36)}{e.title.length > 36 ? 'â€¦' : ''}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.evidenceType === 'auto_generated' ? PURPLE : BLUE, background: (e.evidenceType === 'auto_generated' ? PURPLE : BLUE) + '22', borderRadius: 3, padding: '2px 5px' }}>{e.evidenceType.replace('_', ' ').toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{e.source.slice(0, 32) || '—'}</Td>
                    <Td><OutcomeBadge s={e.status} /></Td>
                    <Td mono col={TEXT}>{e.collectedBy}</Td>
                    <Td mono col={SUBTLE}>{e.collectedAt}</Td>
                    <Td mono col={e.status === 'expired' ? ORANGE : SUBTLE}>{e.validUntil || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'compliance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Framework</Th><Th>Period</Th><Th>Status</Th><Th right>Score</Th><Th right>Passed</Th><Th right>Failed</Th><Th right>Exceptions</Th><Th right>N/A</Th><Th>Generated</Th></tr></thead>
              <tbody>
                {compliance.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compliance reports</td></tr>}
                {compliance.sort((a, b) => b.overallScore - a.overallScore).map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.framework}</Td>
                    <Td mono col={SUBTLE}>{c.period}</Td>
                    <Td><OutcomeBadge s={c.status} /></Td>
                    <Td right mono col={c.overallScore >= 95 ? GREEN : c.overallScore >= 80 ? AMBER : RED}>{c.overallScore.toFixed(1)}%</Td>
                    <Td right mono col={GREEN}>{c.passedControls}</Td>
                    <Td right mono col={c.failedControls > 0 ? RED : SUBTLE}>{c.failedControls}</Td>
                    <Td right mono col={c.exceptionsControls > 0 ? ORANGE : SUBTLE}>{c.exceptionsControls}</Td>
                    <Td right mono col={SUBTLE}>{c.naControls}</Td>
                    <Td mono col={SUBTLE}>{c.generatedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Pack</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.packId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><OutcomeBadge s={a.outcome} /></Td>
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
