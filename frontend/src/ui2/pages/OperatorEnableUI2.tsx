import React, { useState, useEffect, useCallback } from 'react'
﻿// OperatorEnableUI2 â€” Bloomberg APEX operator enablement terminal
// Training, playbooks, certifications, competency tracking, audit
// Tabs: OPERATORS | PLAYBOOKS | CERTIFICATIONS | COMPETENCY | AUDIT
// APIs: /api/v4/operator-enable/operators, /playbooks, /certs, /competency, /audit

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

interface OperatorRecord {
  operatorId: string
  name: string
  role: string
  team: string
  status: 'active' | 'trainee' | 'suspended' | 'inactive'
  certLevel: string
  completedModules: number
  totalModules: number
  playbooksAssigned: number
  incidentsHandled: number
  avgScorePct: number
  lastActive: string
}

interface PlaybookRecord {
  playbookId: string
  title: string
  category: string
  version: string
  status: 'published' | 'draft' | 'deprecated'
  requiredCertLevel: string
  steps: number
  assignedOperators: number
  completionRatePct: number
  lastUpdated: string
}

interface CertRecord {
  certId: string
  operatorId: string
  operatorName: string
  certName: string
  level: string
  issuedAt: string
  expiresAt: string
  status: 'valid' | 'expired' | 'pending' | 'revoked'
  score: number
}

interface CompetencyRecord {
  competencyId: string
  operatorId: string
  operatorName: string
  domain: string
  skill: string
  proficiencyLevel: 'novice' | 'proficient' | 'expert'
  assessedAt: string
  scorePct: number
  assessor: string
}

interface EnableAuditEntry {
  auditId: string
  operatorId: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, trainee: BLUE, suspended: RED, inactive: SUBTLE, published: GREEN, draft: AMBER, deprecated: RED, valid: GREEN, expired: RED, pending: ORANGE, revoked: RED, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ProfBadge({ p }: { p: string }) {
  const m: Record<string, string> = { novice: BLUE, proficient: AMBER, expert: GREEN }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? (done / total) * 100 : 0
  const col = pct >= 90 ? GREEN : pct >= 50 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{done}/{total}</span>
    </div>
  )
}


export function OperatorEnableUI2() {
  const [tab, setTab] = useState<'operators' | 'playbooks' | 'certs' | 'competency' | 'audit'>('operators')
  const [operators, setOperators] = useState<OperatorRecord[]>([])
  const [playbooks, setPlaybooks] = useState<PlaybookRecord[]>([])
  const [certs, setCerts] = useState<CertRecord[]>([])
  const [competency, setCompetency] = useState<CompetencyRecord[]>([])
  const [auditLog, setAuditLog] = useState<EnableAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rO, rP, rC, rCo, rA] = await Promise.allSettled([
        fetch('/api/v4/operator-enable/operators').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/operator-enable/playbooks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/operator-enable/certs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/operator-enable/competency').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/operator-enable/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rO.status === 'fulfilled') {
        const raw = Array.isArray(rO.value) ? rO.value : rO.value.operators ?? rO.value.data ?? []
        setOperators(raw.map((o: any) => ({
          operatorId: o.operator_id ?? o.operatorId ?? '', name: o.name ?? '',
          role: o.role ?? '', team: o.team ?? '',
          status: o.status ?? 'active', certLevel: o.cert_level ?? o.certLevel ?? '',
          completedModules: Number(o.completed_modules ?? o.completedModules ?? 0),
          totalModules: Number(o.total_modules ?? o.totalModules ?? 0),
          playbooksAssigned: Number(o.playbooks_assigned ?? o.playbooksAssigned ?? 0),
          incidentsHandled: Number(o.incidents_handled ?? o.incidentsHandled ?? 0),
          avgScorePct: Number(o.avg_score_pct ?? o.avgScorePct ?? 0),
          lastActive: o.last_active ?? o.lastActive ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load operators')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.playbooks ?? rP.value.data ?? []
        setPlaybooks(raw.map((p: any) => ({
          playbookId: p.playbook_id ?? p.playbookId ?? '', title: p.title ?? '',
          category: p.category ?? '', version: p.version ?? '1.0',
          status: p.status ?? 'published', requiredCertLevel: p.required_cert_level ?? p.requiredCertLevel ?? '',
          steps: Number(p.steps ?? 0), assignedOperators: Number(p.assigned_operators ?? p.assignedOperators ?? 0),
          completionRatePct: Number(p.completion_rate_pct ?? p.completionRatePct ?? 0),
          lastUpdated: p.last_updated ?? p.lastUpdated ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.certs ?? rC.value.data ?? []
        setCerts(raw.map((c: any) => ({
          certId: c.cert_id ?? c.certId ?? '', operatorId: c.operator_id ?? c.operatorId ?? '',
          operatorName: c.operator_name ?? c.operatorName ?? '', certName: c.cert_name ?? c.certName ?? '',
          level: c.level ?? '', issuedAt: c.issued_at ?? c.issuedAt ?? '',
          expiresAt: c.expires_at ?? c.expiresAt ?? '', status: c.status ?? 'valid',
          score: Number(c.score ?? 0),
        })))
      }
      if (rCo.status === 'fulfilled') {
        const raw = Array.isArray(rCo.value) ? rCo.value : rCo.value.competency ?? rCo.value.data ?? []
        setCompetency(raw.map((c: any) => ({
          competencyId: c.competency_id ?? c.competencyId ?? '', operatorId: c.operator_id ?? c.operatorId ?? '',
          operatorName: c.operator_name ?? c.operatorName ?? '', domain: c.domain ?? '',
          skill: c.skill ?? '', proficiencyLevel: c.proficiency_level ?? c.proficiencyLevel ?? 'novice',
          assessedAt: c.assessed_at ?? c.assessedAt ?? '', scorePct: Number(c.score_pct ?? c.scorePct ?? 0),
          assessor: c.assessor ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', operatorId: a.operator_id ?? a.operatorId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const activeOps = operators.filter(o => o.status === 'active').length
  const traineeOps = operators.filter(o => o.status === 'trainee').length
  const expiredCerts = certs.filter(c => c.status === 'expired').length
  const expertCompetencies = competency.filter(c => c.proficiencyLevel === 'expert').length

  const TABS2 = [
    { id: 'operators' as const, label: 'OPERATORS' },
    { id: 'playbooks' as const, label: 'PLAYBOOKS' },
    { id: 'certs' as const, label: 'CERTIFICATIONS' },
    { id: 'competency' as const, label: 'COMPETENCY' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>OPERATOR ENABLEMENT â€” TRAINING + PLAYBOOKS + COMPETENCY TRACKING</span>
        {expiredCerts > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {expiredCerts} EXPIRED CERTS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Operators" value={activeOps} col={GREEN} />
        <StatCard label="Trainees" value={traineeOps} col={BLUE} />
        <StatCard label="Playbooks" value={playbooks.filter(p => p.status === 'published').length} col={PURPLE} />
        <StatCard label="Expired Certs" value={expiredCerts} col={expiredCerts > 0 ? ORANGE : GREEN} />
        <StatCard label="Expert Skills" value={expertCompetencies} col={AMBER} />
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

        {tab === 'operators' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Operator</Th><Th>Role</Th><Th>Team</Th><Th>Status</Th><Th>Cert Level</Th><Th>Progress</Th><Th right>Incidents</Th><Th right>Avg Score</Th><Th>Last Active</Th></tr></thead>
              <tbody>
                {operators.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No operators â€” check /api/v4/operator-enable/operators</td></tr>}
                {operators.sort((a, b) => a.name.localeCompare(b.name)).map((o, i) => (
                  <tr key={i} style={{ background: o.status === 'suspended' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{o.name}</Td>
                    <Td mono col={BLUE}>{o.role}</Td>
                    <Td mono col={SUBTLE}>{o.team}</Td>
                    <Td><StatusBadge s={o.status} /></Td>
                    <Td mono col={PURPLE}>{o.certLevel || 'â€”'}</Td>
                    <Td><MiniBar done={o.completedModules} total={o.totalModules} /></Td>
                    <Td right mono col={TEXT}>{o.incidentsHandled}</Td>
                    <Td right mono col={o.avgScorePct >= 80 ? GREEN : o.avgScorePct >= 60 ? AMBER : RED}>{o.avgScorePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{o.lastActive || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'playbooks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Playbook</Th><Th>Category</Th><Th>Version</Th><Th>Status</Th><Th>Cert Required</Th><Th right>Steps</Th><Th right>Assigned</Th><Th right>Completion %</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {playbooks.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No playbooks â€” check /api/v4/operator-enable/playbooks</td></tr>}
                {playbooks.sort((a, b) => a.title.localeCompare(b.title)).map((p, i) => (
                  <tr key={i} style={{ opacity: p.status === 'deprecated' ? 0.5 : 1 }}>
                    <Td mono col={AMBER}>{p.title}</Td>
                    <Td mono col={BLUE}>{p.category}</Td>
                    <Td mono col={SUBTLE}>{p.version}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td mono col={PURPLE}>{p.requiredCertLevel || 'â€”'}</Td>
                    <Td right mono col={SUBTLE}>{p.steps}</Td>
                    <Td right mono col={TEXT}>{p.assignedOperators}</Td>
                    <Td right mono col={p.completionRatePct >= 80 ? GREEN : p.completionRatePct >= 50 ? AMBER : RED}>{p.completionRatePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{p.lastUpdated || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'certs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Cert</Th><Th>Operator</Th><Th>Level</Th><Th>Status</Th><Th right>Score</Th><Th>Issued</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {certs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No certifications â€” check /api/v4/operator-enable/certs</td></tr>}
                {certs.sort((a, b) => a.status === 'expired' ? -1 : 1).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'expired' ? ORANGE + '0a' : c.status === 'revoked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.certName}</Td>
                    <Td mono col={TEXT}>{c.operatorName}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{c.level.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={c.status} /></Td>
                    <Td right mono col={c.score >= 80 ? GREEN : c.score >= 60 ? AMBER : RED}>{c.score.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{c.issuedAt}</Td>
                    <Td mono col={c.status === 'expired' ? ORANGE : SUBTLE}>{c.expiresAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'competency' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Operator</Th><Th>Domain</Th><Th>Skill</Th><Th>Proficiency</Th><Th right>Score %</Th><Th>Assessor</Th><Th>Assessed</Th></tr></thead>
              <tbody>
                {competency.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No competency data â€” check /api/v4/operator-enable/competency</td></tr>}
                {competency.map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.operatorName}</Td>
                    <Td mono col={BLUE}>{c.domain}</Td>
                    <Td mono col={TEXT}>{c.skill}</Td>
                    <Td><ProfBadge p={c.proficiencyLevel} /></Td>
                    <Td right mono col={c.scorePct >= 80 ? GREEN : c.scorePct >= 60 ? AMBER : RED}>{c.scorePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{c.assessor}</Td>
                    <Td mono col={SUBTLE}>{c.assessedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Operator</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/operator-enable/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.operatorId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge s={a.outcome} /></Td>
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
