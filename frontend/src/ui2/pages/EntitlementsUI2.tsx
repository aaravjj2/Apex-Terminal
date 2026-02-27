import React, { useState, useEffect, useCallback } from 'react'
﻿// EntitlementsUI2 â€” Bloomberg ENTL entitlements terminal
// Role-based access matrix, permission grants, policy enforcement, approval queue, audit
// Tabs: MATRIX | ROLES | POLICIES | REQUESTS | AUDIT
// APIs: /api/v4/entitlements/matrix, /roles, /policies, /requests, /audit

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

interface EntitlementEntry {
  entId: string
  principal: string
  principalType: 'user' | 'service' | 'group' | 'role'
  resource: string
  resourceType: string
  permissions: string[]
  grantType: 'direct' | 'inherited' | 'delegated'
  grantedBy: string
  grantedAt: string
  expiresAt: string
  classification: 'public' | 'internal' | 'confidential' | 'restricted'
  active: boolean
}

interface RoleEntry {
  roleId: string
  roleName: string
  description: string
  memberCount: number
  permCount: number
  classification: string
  owner: string
  lastReviewed: string
  inheritedFrom: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

interface PolicyEntry {
  policyId: string
  policyName: string
  type: 'permission' | 'restriction' | 'condition' | 'data_mask'
  scope: string
  effect: 'allow' | 'deny'
  classifications: string[]
  principals: number
  resources: number
  active: boolean
  lastModified: string
  modifiedBy: string
}

interface EntRequest {
  reqId: string
  requestor: string
  target: string
  resource: string
  permissions: string[]
  justification: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reviewer: string
  requestedAt: string
  resolvedAt: string
  riskScore: number
}

interface EntAuditEntry {
  auditId: string
  action: string
  actor: string
  target: string
  resource: string
  outcome: 'granted' | 'denied' | 'revoked' | 'modified'
  policyApplied: string
  ipAddress: string
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
function PrincipalBadge({ t }: { t: string }) {
  const m: Record<string, string> = { user: BLUE, service: PURPLE, group: ORANGE, role: AMBER }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function ClassBadge({ c }: { c: string }) {
  const m: Record<string, string> = { public: GREEN, internal: BLUE, confidential: AMBER, restricted: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { low: GREEN, medium: AMBER, high: ORANGE, critical: RED }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function OutcomeBadge({ s }: { s: string }) {
  const m: Record<string, string> = { granted: GREEN, denied: RED, revoked: AMBER, modified: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function EntitlementsUI2() {
  const [tab, setTab] = useState<'matrix' | 'roles' | 'policies' | 'requests' | 'audit'>('matrix')
  const [matrix, setMatrix] = useState<EntitlementEntry[]>([])
  const [roles, setRoles] = useState<RoleEntry[]>([])
  const [policies, setPolicies] = useState<PolicyEntry[]>([])
  const [requests, setRequests] = useState<EntRequest[]>([])
  const [audit, setAudit] = useState<EntAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rM, rR, rP, rRq, rA] = await Promise.allSettled([
        fetch('/api/v4/entitlements/matrix').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entitlements/roles').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entitlements/policies').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entitlements/requests').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entitlements/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.matrix ?? rM.value.entitlements ?? rM.value.data ?? []
        setMatrix(raw.map((e: any) => ({
          entId: e.ent_id ?? e.entId ?? '', principal: e.principal ?? '', principalType: e.principal_type ?? e.principalType ?? 'user',
          resource: e.resource ?? '', resourceType: e.resource_type ?? e.resourceType ?? '',
          permissions: Array.isArray(e.permissions) ? e.permissions : [], grantType: e.grant_type ?? e.grantType ?? 'direct',
          grantedBy: e.granted_by ?? e.grantedBy ?? '', grantedAt: e.granted_at ?? e.grantedAt ?? '',
          expiresAt: e.expires_at ?? e.expiresAt ?? '', classification: e.classification ?? 'internal',
          active: Boolean(e.active ?? true),
        })))
        setErr(null)
      } else setErr('Failed to load entitlements')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.roles ?? rR.value.data ?? []
        setRoles(raw.map((r: any) => ({
          roleId: r.role_id ?? r.roleId ?? '', roleName: r.role_name ?? r.roleName ?? r.name ?? '',
          description: r.description ?? '', memberCount: Number(r.member_count ?? r.memberCount ?? 0),
          permCount: Number(r.perm_count ?? r.permCount ?? 0), classification: r.classification ?? 'internal',
          owner: r.owner ?? '', lastReviewed: r.last_reviewed ?? r.lastReviewed ?? '', inheritedFrom: r.inherited_from ?? r.inheritedFrom ?? '',
          riskLevel: r.risk_level ?? r.riskLevel ?? 'low',
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.policies ?? rP.value.data ?? []
        setPolicies(raw.map((p: any) => ({
          policyId: p.policy_id ?? p.policyId ?? '', policyName: p.policy_name ?? p.policyName ?? p.name ?? '',
          type: p.type ?? 'permission', scope: p.scope ?? '', effect: p.effect ?? 'allow',
          classifications: Array.isArray(p.classifications) ? p.classifications : [],
          principals: Number(p.principals ?? 0), resources: Number(p.resources ?? 0),
          active: Boolean(p.active ?? true), lastModified: p.last_modified ?? p.lastModified ?? '',
          modifiedBy: p.modified_by ?? p.modifiedBy ?? '',
        })))
      }
      if (rRq.status === 'fulfilled') {
        const raw = Array.isArray(rRq.value) ? rRq.value : rRq.value.requests ?? rRq.value.data ?? []
        setRequests(raw.map((r: any) => ({
          reqId: r.req_id ?? r.reqId ?? '', requestor: r.requestor ?? '', target: r.target ?? '',
          resource: r.resource ?? '', permissions: Array.isArray(r.permissions) ? r.permissions : [],
          justification: r.justification ?? '', status: r.status ?? 'pending', reviewer: r.reviewer ?? '',
          requestedAt: r.requested_at ?? r.requestedAt ?? '', resolvedAt: r.resolved_at ?? r.resolvedAt ?? '',
          riskScore: Number(r.risk_score ?? r.riskScore ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAudit(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          target: a.target ?? '', resource: a.resource ?? '', outcome: a.outcome ?? 'granted',
          policyApplied: a.policy_applied ?? a.policyApplied ?? '', ipAddress: a.ip_address ?? a.ipAddress ?? '',
          timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const pendingRequests = requests.filter(r => r.status === 'pending').length
  const expiredEntitlements = matrix.filter(e => e.expiresAt && new Date(e.expiresAt) < new Date()).length
  const highRiskRoles = roles.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high').length
  const denyPolicies = policies.filter(p => p.effect === 'deny').length

  const TABS = [
    { id: 'matrix' as const, label: 'MATRIX' },
    { id: 'roles' as const, label: 'ROLES' },
    { id: 'policies' as const, label: 'POLICIES' },
    { id: 'requests' as const, label: 'REQUESTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ENTL</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>ENTITLEMENTS â€” ACCESS MATRIX + ROLES + POLICIES + APPROVALS + AUDIT</span>
        {pendingRequests > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {pendingRequests} PENDING</span>}
        {highRiskRoles > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {highRiskRoles} HIGH-RISK ROLES</span>}
        {expiredEntitlements > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {expiredEntitlements} EXPIRED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Entitlements" value={matrix.length} col={BLUE} />
        <StatCard label="Roles" value={roles.length} col={PURPLE} />
        <StatCard label="Policies" value={policies.length} col={TEXT} />
        <StatCard label="Pending Requests" value={pendingRequests} col={pendingRequests > 0 ? AMBER : GREEN} />
        <StatCard label="High Risk Roles" value={highRiskRoles} col={highRiskRoles > 0 ? RED : GREEN} />
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

        {tab === 'matrix' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Principal</Th><Th>Type</Th><Th>Resource</Th><Th>Class</Th><Th>Permissions</Th><Th>Grant</Th><Th>Granted By</Th><Th>Active</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {matrix.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No entitlements â€” check /api/v4/entitlements/matrix</td></tr>}
                {matrix.map((e, i) => (
                  <tr key={i} style={{ opacity: e.active ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{e.principal}</Td>
                    <Td><PrincipalBadge t={e.principalType} /></Td>
                    <Td mono col={BLUE}>{e.resource}</Td>
                    <Td><ClassBadge c={e.classification} /></Td>
                    <Td mono col={GREEN} style={{ fontSize: 10 } as any}>{e.permissions.slice(0, 3).join(', ')}</Td>
                    <Td mono col={e.grantType === 'delegated' ? ORANGE : SUBTLE}>{e.grantType}</Td>
                    <Td mono col={SUBTLE}>{e.grantedBy}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.active ? GREEN : RED }}>{e.active ? 'ACTIVE' : 'INACTIVE'}</span></Td>
                    <Td mono col={e.expiresAt && new Date(e.expiresAt) < new Date() ? RED : SUBTLE}>{e.expiresAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'roles' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Role Name</Th><Th>Risk</Th><Th>Class</Th><Th right>Members</Th><Th right>Permissions</Th><Th>Owner</Th><Th>Inherits From</Th><Th>Last Review</Th></tr></thead>
              <tbody>
                {roles.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No roles â€” check /api/v4/entitlements/roles</td></tr>}
                {roles.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (ord[a.riskLevel] ?? 4) - (ord[b.riskLevel] ?? 4)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.riskLevel === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.roleName}</Td>
                    <Td><RiskBadge r={r.riskLevel} /></Td>
                    <Td><ClassBadge c={r.classification} /></Td>
                    <Td right mono col={r.memberCount > 50 ? ORANGE : TEXT}>{r.memberCount.toLocaleString()}</Td>
                    <Td right mono col={r.permCount > 100 ? RED : TEXT}>{r.permCount.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{r.owner}</Td>
                    <Td mono col={r.inheritedFrom ? BLUE : SUBTLE}>{r.inheritedFrom || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.lastReviewed}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'policies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Policy Name</Th><Th>Type</Th><Th>Effect</Th><Th>Scope</Th><Th>Classifications</Th><Th right>Principals</Th><Th right>Resources</Th><Th>Active</Th><Th>Modified</Th></tr></thead>
              <tbody>
                {policies.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No policies â€” check /api/v4/entitlements/policies</td></tr>}
                {policies.map((p, i) => {
                  const typeC: Record<string, string> = { permission: GREEN, restriction: RED, condition: AMBER, data_mask: PURPLE }
                  return (
                    <tr key={i}>
                      <Td mono col={AMBER}>{p.policyName}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: typeC[p.type] ?? SUBTLE, background: (typeC[p.type] ?? SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{p.type.replace('_', ' ').toUpperCase()}</span></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: p.effect === 'allow' ? GREEN : RED }}>{p.effect.toUpperCase()}</span></Td>
                      <Td mono col={BLUE}>{p.scope}</Td>
                      <Td mono col={PURPLE} style={{ fontSize: 10 } as any}>{p.classifications.join(', ')}</Td>
                      <Td right mono col={TEXT}>{p.principals.toLocaleString()}</Td>
                      <Td right mono col={TEXT}>{p.resources.toLocaleString()}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: p.active ? GREEN : SUBTLE }}>{p.active ? 'ACTIVE' : 'INACTIVE'}</span></Td>
                      <Td mono col={SUBTLE}>{p.lastModified}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'requests' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Requestor</Th><Th>Target</Th><Th>Resource</Th><Th>Permissions</Th><Th>Status</Th><Th right>Risk Score</Th><Th>Reviewer</Th><Th>Requested</Th><Th>Resolved</Th></tr></thead>
              <tbody>
                {requests.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No requests â€” check /api/v4/entitlements/requests</td></tr>}
                {requests.sort((a, b) => {
                  const ord: Record<string, number> = { pending: 0, approved: 1, rejected: 2, expired: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((r, i) => {
                  const stC: Record<string, string> = { pending: AMBER, approved: GREEN, rejected: RED, expired: SUBTLE }
                  return (
                    <tr key={i} style={{ background: r.status === 'pending' ? AMBER + '06' : 'transparent' }}>
                      <Td mono col={AMBER}>{r.requestor}</Td>
                      <Td mono col={BLUE}>{r.target}</Td>
                      <Td mono col={TEXT}>{r.resource}</Td>
                      <Td mono col={GREEN} style={{ fontSize: 10 } as any}>{r.permissions.slice(0, 2).join(', ')}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: stC[r.status] ?? SUBTLE, background: (stC[r.status] ?? SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{r.status.toUpperCase()}</span></Td>
                      <Td right mono col={r.riskScore >= 0.8 ? RED : r.riskScore >= 0.5 ? AMBER : GREEN}>{r.riskScore.toFixed(2)}</Td>
                      <Td mono col={SUBTLE}>{r.reviewer || 'â€”'}</Td>
                      <Td mono col={SUBTLE}>{r.requestedAt}</Td>
                      <Td mono col={SUBTLE}>{r.resolvedAt || 'â€”'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Action</Th><Th>Actor</Th><Th>Target</Th><Th>Resource</Th><Th>Outcome</Th><Th>Policy Applied</Th><Th>IP Address</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit â€” check /api/v4/entitlements/audit</td></tr>}
                {audit.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.action}</Td>
                    <Td mono col={BLUE}>{a.actor}</Td>
                    <Td mono col={TEXT}>{a.target}</Td>
                    <Td mono col={SUBTLE}>{a.resource}</Td>
                    <Td><OutcomeBadge s={a.outcome} /></Td>
                    <Td mono col={PURPLE}>{a.policyApplied}</Td>
                    <Td mono col={SUBTLE}>{a.ipAddress}</Td>
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
