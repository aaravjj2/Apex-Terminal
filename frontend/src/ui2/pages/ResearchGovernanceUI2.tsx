import React, { useState, useEffect, useCallback } from 'react'
﻿// ResearchGovernanceUI2 â€” Bloomberg APEX research governance terminal
// QA controls, compliance attestation, model approval, research review
// Tabs: RESEARCH | REVIEWS | ATTESTATIONS | CONTROLS | AUDIT
// APIs: /api/v4/research-governance/research, /reviews, /attestations, /controls, /audit

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

interface ResearchItem {
  researchId: string
  title: string
  author: string
  category: 'model' | 'strategy' | 'signal' | 'analysis' | 'backtest' | 'paper'
  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'archived' | 'published'
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted'
  submittedAt: string
  reviewDeadline: string
  reviewerCount: number
  approvalCount: number
  flagCount: number
}

interface ResearchReview {
  reviewId: string
  researchId: string
  reviewerName: string
  verdict: 'approve' | 'reject' | 'revise' | 'abstain' | 'pending'
  qualityScore: number
  methodologyScore: number
  riskScore: number
  comment: string
  submittedAt: string
}

interface ResearchAttestation {
  attestationId: string
  researchId: string
  attestationType: 'data_quality' | 'methodology' | 'conflict_of_interest' | 'regulatory' | 'replication'
  outcome: 'pass' | 'fail' | 'conditional' | 'not_applicable'
  attestedBy: string
  attestedAt: string
  expiresAt: string
  notes: string
}

interface GovernanceControl {
  controlId: string
  name: string
  category: 'access' | 'review' | 'approval' | 'disclosure' | 'archival'
  enabled: boolean
  automatedPct: number
  compliancePct: number
  failureCount: number
  lastAssessedAt: string
  framework: string
}

interface ResearchAuditEntry {
  auditId: string
  researchId: string
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
  const m: Record<string, string> = { draft: SUBTLE, under_review: AMBER, approved: GREEN, rejected: RED, archived: SUBTLE, published: BLUE, approve: GREEN, reject: RED, revise: ORANGE, abstain: SUBTLE, pending: AMBER, pass: GREEN, fail: RED, conditional: ORANGE, not_applicable: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function ConfLevel({ c }: { c: string }) {
  const m: Record<string, string> = { public: GREEN, internal: BLUE, confidential: AMBER, restricted: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { model: RED, strategy: ORANGE, signal: AMBER, analysis: BLUE, backtest: PURPLE, paper: GREEN }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function ScoreBar({ val }: { val: number }) {
  const col = val >= 80 ? GREEN : val >= 60 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${val}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{val.toFixed(0)}</span>
    </div>
  )
}


export function ResearchGovernanceUI2() {
  const [tab, setTab] = useState<'research' | 'reviews' | 'attestations' | 'controls' | 'audit'>('research')
  const [research, setResearch] = useState<ResearchItem[]>([])
  const [reviews, setReviews] = useState<ResearchReview[]>([])
  const [attestations, setAttestations] = useState<ResearchAttestation[]>([])
  const [controls, setControls] = useState<GovernanceControl[]>([])
  const [auditLog, setAuditLog] = useState<ResearchAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rRev, rAt, rC, rA] = await Promise.allSettled([
        fetch('/api/v4/research-governance/research').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/research-governance/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/research-governance/attestations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/research-governance/controls').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/research-governance/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.research ?? rR.value.data ?? []
        setResearch(raw.map((r: any) => ({
          researchId: r.research_id ?? r.researchId ?? '', title: r.title ?? '',
          author: r.author ?? '', category: r.category ?? 'analysis', status: r.status ?? 'draft',
          confidentialityLevel: r.confidentiality_level ?? r.confidentialityLevel ?? 'internal',
          submittedAt: r.submitted_at ?? r.submittedAt ?? '',
          reviewDeadline: r.review_deadline ?? r.reviewDeadline ?? '',
          reviewerCount: Number(r.reviewer_count ?? r.reviewerCount ?? 0),
          approvalCount: Number(r.approval_count ?? r.approvalCount ?? 0),
          flagCount: Number(r.flag_count ?? r.flagCount ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load research')
      if (rRev.status === 'fulfilled') {
        const raw = Array.isArray(rRev.value) ? rRev.value : rRev.value.reviews ?? rRev.value.data ?? []
        setReviews(raw.map((r: any) => ({
          reviewId: r.review_id ?? r.reviewId ?? '', researchId: r.research_id ?? r.researchId ?? '',
          reviewerName: r.reviewer_name ?? r.reviewerName ?? '', verdict: r.verdict ?? 'pending',
          qualityScore: Number(r.quality_score ?? r.qualityScore ?? 0),
          methodologyScore: Number(r.methodology_score ?? r.methodologyScore ?? 0),
          riskScore: Number(r.risk_score ?? r.riskScore ?? 0),
          comment: r.comment ?? '', submittedAt: r.submitted_at ?? r.submittedAt ?? '',
        })))
      }
      if (rAt.status === 'fulfilled') {
        const raw = Array.isArray(rAt.value) ? rAt.value : rAt.value.attestations ?? rAt.value.data ?? []
        setAttestations(raw.map((a: any) => ({
          attestationId: a.attestation_id ?? a.attestationId ?? '',
          researchId: a.research_id ?? a.researchId ?? '',
          attestationType: a.attestation_type ?? a.attestationType ?? 'methodology',
          outcome: a.outcome ?? 'pass', attestedBy: a.attested_by ?? a.attestedBy ?? '',
          attestedAt: a.attested_at ?? a.attestedAt ?? '', expiresAt: a.expires_at ?? a.expiresAt ?? '',
          notes: a.notes ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.controls ?? rC.value.data ?? []
        setControls(raw.map((c: any) => ({
          controlId: c.control_id ?? c.controlId ?? '', name: c.name ?? '',
          category: c.category ?? 'review', enabled: Boolean(c.enabled),
          automatedPct: Number(c.automated_pct ?? c.automatedPct ?? 0),
          compliancePct: Number(c.compliance_pct ?? c.compliancePct ?? 0),
          failureCount: Number(c.failure_count ?? c.failureCount ?? 0),
          lastAssessedAt: c.last_assessed_at ?? c.lastAssessedAt ?? '',
          framework: c.framework ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', researchId: a.research_id ?? a.researchId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const pendingReview = research.filter(r => r.status === 'under_review').length
  const flagged = research.filter(r => r.flagCount > 0).length
  const failedAttestations = attestations.filter(a => a.outcome === 'fail').length

  const TABS2 = [
    { id: 'research' as const, label: 'RESEARCH' },
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'attestations' as const, label: 'ATTESTATIONS' },
    { id: 'controls' as const, label: 'CONTROLS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RESEARCH GOVERNANCE â€” QA + REVIEW CONTROLS + COMPLIANCE ATTESTATION</span>
        {pendingReview > 0 && <span style={{ fontSize: 10, color: AMBER }}>âš‘ {pendingReview} PENDING REVIEW</span>}
        {flagged > 0 && <span style={{ fontSize: 10, color: ORANGE }}>âš‘ {flagged} FLAGGED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Research Items" value={research.length} col={BLUE} />
        <StatCard label="Under Review" value={pendingReview} col={pendingReview > 0 ? AMBER : SUBTLE} />
        <StatCard label="Flagged" value={flagged} col={flagged > 0 ? ORANGE : GREEN} />
        <StatCard label="Failed Attest." value={failedAttestations} col={failedAttestations > 0 ? RED : GREEN} />
        <StatCard label="Controls" value={controls.filter(c => c.enabled).length} col={PURPLE} />
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

        {tab === 'research' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Title</Th><Th>Author</Th><Th>Category</Th><Th>Status</Th><Th>Confidentiality</Th><Th right>Reviewers</Th><Th right>Approvals</Th><Th right>Flags</Th><Th>Submitted</Th><Th>Deadline</Th></tr></thead>
              <tbody>
                {research.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No research â€” check /api/v4/research-governance/research</td></tr>}
                {research.sort((a, b) => (b.flagCount) - (a.flagCount)).map((r, i) => (
                  <tr key={i} style={{ background: r.flagCount > 0 ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.title}</Td>
                    <Td mono col={TEXT}>{r.author}</Td>
                    <Td><CatBadge c={r.category} /></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td><ConfLevel c={r.confidentialityLevel} /></Td>
                    <Td right mono col={SUBTLE}>{r.reviewerCount}</Td>
                    <Td right mono col={r.approvalCount > 0 ? GREEN : SUBTLE}>{r.approvalCount}</Td>
                    <Td right mono col={r.flagCount > 0 ? RED : SUBTLE}>{r.flagCount}</Td>
                    <Td mono col={SUBTLE}>{r.submittedAt}</Td>
                    <Td mono col={SUBTLE}>{r.reviewDeadline || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Review ID</Th><Th>Research ID</Th><Th>Reviewer</Th><Th>Verdict</Th><Th>Quality</Th><Th>Methodology</Th><Th right>Risk Score</Th><Th>Comment</Th><Th>Submitted At</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews â€” check /api/v4/research-governance/reviews</td></tr>}
                {reviews.sort((a, b) => (a.verdict === 'reject' ? -1 : 1) - (b.verdict === 'reject' ? -1 : 1)).map((r, i) => (
                  <tr key={i} style={{ background: r.verdict === 'reject' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reviewId}</Td>
                    <Td mono col={BLUE}>{r.researchId}</Td>
                    <Td mono col={TEXT}>{r.reviewerName}</Td>
                    <Td><StatusBadge s={r.verdict} /></Td>
                    <Td><ScoreBar val={r.qualityScore} /></Td>
                    <Td><ScoreBar val={r.methodologyScore} /></Td>
                    <Td right mono col={r.riskScore > 70 ? RED : r.riskScore > 40 ? ORANGE : GREEN}>{r.riskScore.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{r.comment || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.submittedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'attestations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Attestation ID</Th><Th>Research ID</Th><Th>Type</Th><Th>Outcome</Th><Th>Attested By</Th><Th>Attested At</Th><Th>Expires</Th><Th>Notes</Th></tr></thead>
              <tbody>
                {attestations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No attestations â€” check /api/v4/research-governance/attestations</td></tr>}
                {attestations.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.attestationId}</Td>
                    <Td mono col={BLUE}>{a.researchId}</Td>
                    <Td mono col={PURPLE}>{a.attestationType.replace('_', ' ')}</Td>
                    <Td><StatusBadge s={a.outcome} /></Td>
                    <Td mono col={TEXT}>{a.attestedBy || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.attestedAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.expiresAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.notes || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'controls' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Control</Th><Th>Category</Th><Th>Framework</Th><Th>Enabled</Th><Th right>Automated %</Th><Th right>Compliance %</Th><Th right>Failures</Th><Th>Last Assessed</Th></tr></thead>
              <tbody>
                {controls.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No controls â€” check /api/v4/research-governance/controls</td></tr>}
                {controls.sort((a, b) => a.compliancePct - b.compliancePct).map((c, i) => (
                  <tr key={i} style={{ opacity: c.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{c.name}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', borderRadius: 3, padding: '2px 5px' }}>{c.category.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{c.framework || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.enabled ? GREEN : RED }}>{c.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={TEXT}>{c.automatedPct.toFixed(0)}%</Td>
                    <Td right mono col={c.compliancePct >= 95 ? GREEN : c.compliancePct >= 80 ? AMBER : RED}>{c.compliancePct.toFixed(1)}%</Td>
                    <Td right mono col={c.failureCount > 0 ? RED : SUBTLE}>{c.failureCount}</Td>
                    <Td mono col={SUBTLE}>{c.lastAssessedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Research ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/research-governance/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.researchId || 'â€”'}</Td>
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
