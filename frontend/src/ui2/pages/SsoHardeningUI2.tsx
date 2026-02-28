import React, { useState, useEffect, useCallback } from 'react'
﻿// SsoHardeningUI2 â€” Bloomberg APEX SSO Hardening terminal
// Enterprise SSO hardening, MFA enforcement, session management, federation analytics
// Tabs: SESSIONS | MFA | PROVIDERS | POLICIES | AUDIT
// APIs: /api/v4/sso/sessions, /mfa, /providers, /policies, /audit

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

interface SsoSession {
  sessionId: string
  userId: string
  email: string
  provider: string
  ipAddress: string
  deviceId: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'api'
  mfaVerified: boolean
  mfaMethod: 'totp' | 'push' | 'sms' | 'hardware_key' | 'biometric' | 'none'
  riskScore: number
  status: 'active' | 'expired' | 'revoked' | 'suspicious'
  createdAt: string
  expiresAt: string
  lastActivityAt: string
  geoLocation: string
}

interface MfaEnrollment {
  enrollmentId: string
  userId: string
  email: string
  method: 'totp' | 'push' | 'sms' | 'hardware_key' | 'biometric'
  status: 'active' | 'pending' | 'revoked'
  verifiedAt: string
  lastUsedAt: string
  failureCount: number
  isPrimary: boolean
}

interface SsoProvider {
  providerId: string
  name: string
  protocol: 'saml2' | 'oidc' | 'oauth2' | 'ldap'
  status: 'active' | 'inactive' | 'degraded' | 'testing'
  domain: string
  entityId: string
  usersCount: number
  lastSyncAt: string
  errorRatePct: number
  mfaEnforced: boolean
  sessionDurationMinutes: number
}

interface SsoPolicy {
  policyId: string
  name: string
  scope: 'global' | 'provider' | 'group' | 'user'
  mfaRequired: string
  deviceTrustRequired: boolean
  allowedGeos: string[]
  sessionMaxHours: number
  idleTimeoutMinutes: number
  riskThreshold: number
  status: 'active' | 'draft' | 'disabled'
  lastUpdated: string
}

interface SsoAuditEntry {
  auditId: string
  userId: string
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
  const m: Record<string, string> = { active: GREEN, expired: SUBTLE, revoked: RED, suspicious: RED, pending: AMBER, degraded: ORANGE, inactive: SUBTLE, testing: BLUE, draft: SUBTLE, disabled: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function MfaBadge({ m }: { m: string }) {
  const map: Record<string, string> = { totp: GREEN, push: BLUE, sms: AMBER, hardware_key: PURPLE, biometric: ORANGE, none: RED }
  const c = map[m] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{m.replace('_', ' ').toUpperCase()}</span>
}
function ProtocolBadge({ p }: { p: string }) {
  const m: Record<string, string> = { saml2: AMBER, oidc: BLUE, oauth2: GREEN, ldap: PURPLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function RiskBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 100))
  const col = pct >= 70 ? RED : pct >= 40 ? ORANGE : pct >= 20 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 45, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{(score * 100).toFixed(0)}</span>
    </div>
  )
}


export function SsoHardeningUI2() {
  const [tab, setTab] = useState<'sessions' | 'mfa' | 'providers' | 'policies' | 'audit'>('sessions')
  const [sessions, setSessions] = useState<SsoSession[]>([])
  const [mfaEnrollments, setMfaEnrollments] = useState<MfaEnrollment[]>([])
  const [providers, setProviders] = useState<SsoProvider[]>([])
  const [policies, setPolicies] = useState<SsoPolicy[]>([])
  const [auditLog, setAuditLog] = useState<SsoAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rM, rP, rPo, rA] = await Promise.allSettled([
        fetch('/api/v4/sso/sessions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sso/mfa').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sso/providers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sso/policies').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sso/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sessions ?? rS.value.data ?? []
        setSessions(raw.map((s: any) => ({
          sessionId: s.session_id ?? s.sessionId ?? '', userId: s.user_id ?? s.userId ?? '',
          email: s.email ?? '', provider: s.provider ?? '', ipAddress: s.ip_address ?? s.ipAddress ?? '',
          deviceId: s.device_id ?? s.deviceId ?? '', deviceType: s.device_type ?? s.deviceType ?? 'desktop',
          mfaVerified: Boolean(s.mfa_verified ?? s.mfaVerified),
          mfaMethod: s.mfa_method ?? s.mfaMethod ?? 'none',
          riskScore: Number(s.risk_score ?? s.riskScore ?? 0),
          status: s.status ?? 'active', createdAt: s.created_at ?? s.createdAt ?? '',
          expiresAt: s.expires_at ?? s.expiresAt ?? '',
          lastActivityAt: s.last_activity_at ?? s.lastActivityAt ?? '',
          geoLocation: s.geo_location ?? s.geoLocation ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load SSO data')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.enrollments ?? rM.value.mfa ?? rM.value.data ?? []
        setMfaEnrollments(raw.map((m: any) => ({
          enrollmentId: m.enrollment_id ?? m.enrollmentId ?? '', userId: m.user_id ?? m.userId ?? '',
          email: m.email ?? '', method: m.method ?? 'totp',
          status: m.status ?? 'active', verifiedAt: m.verified_at ?? m.verifiedAt ?? '',
          lastUsedAt: m.last_used_at ?? m.lastUsedAt ?? '',
          failureCount: Number(m.failure_count ?? m.failureCount ?? 0),
          isPrimary: Boolean(m.is_primary ?? m.isPrimary),
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.providers ?? rP.value.data ?? []
        setProviders(raw.map((p: any) => ({
          providerId: p.provider_id ?? p.providerId ?? '', name: p.name ?? '',
          protocol: p.protocol ?? 'oidc', status: p.status ?? 'active',
          domain: p.domain ?? '', entityId: p.entity_id ?? p.entityId ?? '',
          usersCount: Number(p.users_count ?? p.usersCount ?? 0),
          lastSyncAt: p.last_sync_at ?? p.lastSyncAt ?? '',
          errorRatePct: Number(p.error_rate_pct ?? p.errorRatePct ?? 0),
          mfaEnforced: Boolean(p.mfa_enforced ?? p.mfaEnforced),
          sessionDurationMinutes: Number(p.session_duration_minutes ?? p.sessionDurationMinutes ?? 60),
        })))
      }
      if (rPo.status === 'fulfilled') {
        const raw = Array.isArray(rPo.value) ? rPo.value : rPo.value.policies ?? rPo.value.data ?? []
        setPolicies(raw.map((p: any) => ({
          policyId: p.policy_id ?? p.policyId ?? '', name: p.name ?? '',
          scope: p.scope ?? 'global', mfaRequired: p.mfa_required ?? p.mfaRequired ?? 'all',
          deviceTrustRequired: Boolean(p.device_trust_required ?? p.deviceTrustRequired),
          allowedGeos: p.allowed_geos ?? p.allowedGeos ?? [],
          sessionMaxHours: Number(p.session_max_hours ?? p.sessionMaxHours ?? 8),
          idleTimeoutMinutes: Number(p.idle_timeout_minutes ?? p.idleTimeoutMinutes ?? 30),
          riskThreshold: Number(p.risk_threshold ?? p.riskThreshold ?? 0.7),
          status: p.status ?? 'active', lastUpdated: p.last_updated ?? p.lastUpdated ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', userId: a.user_id ?? a.userId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const suspiciousSessions = sessions.filter(s => s.status === 'suspicious').length
  const mfaNotVerified = sessions.filter(s => s.status === 'active' && !s.mfaVerified).length
  const degradedProviders = providers.filter(p => p.status === 'degraded').length
  const activeSessions = sessions.filter(s => s.status === 'active').length

  const TABS2 = [
    { id: 'sessions' as const, label: 'SESSIONS' },
    { id: 'mfa' as const, label: 'MFA' },
    { id: 'providers' as const, label: 'PROVIDERS' },
    { id: 'policies' as const, label: 'POLICIES' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SSO HARDENING â€” MFA ENFORCEMENT + SESSION MANAGEMENT + FEDERATION ANALYTICS</span>
        {suspiciousSessions > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {suspiciousSessions} SUSPICIOUS</span>}
        {mfaNotVerified > 0 && <span style={{ fontSize: 10, color: ORANGE }}>âš‘ {mfaNotVerified} MFA UNVERIFIED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Sessions" value={activeSessions} col={BLUE} />
        <StatCard label="Suspicious" value={suspiciousSessions} col={suspiciousSessions > 0 ? RED : GREEN} />
        <StatCard label="MFA Unverified" value={mfaNotVerified} col={mfaNotVerified > 0 ? ORANGE : GREEN} />
        <StatCard label="Degraded Providers" value={degradedProviders} col={degradedProviders > 0 ? RED : GREEN} />
        <StatCard label="MFA Enrollments" value={mfaEnrollments.filter(m => m.status === 'active').length} col={PURPLE} />
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

        {tab === 'sessions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Session ID</Th><Th>Email</Th><Th>Provider</Th><Th>Device</Th><Th>Status</Th><Th>MFA</Th><Th>Method</Th><Th>Risk</Th><Th>Location</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {sessions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sessions â€” check /api/v4/sso/sessions</td></tr>}
                {sessions.sort((a, b) => a.status === 'suspicious' ? -1 : 0).map((s, i) => (
                  <tr key={i} style={{ background: s.status === 'suspicious' ? RED + '0a' : !s.mfaVerified && s.status === 'active' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.sessionId.slice(0, 14)}â€¦</Td>
                    <Td mono col={TEXT}>{s.email}</Td>
                    <Td mono col={BLUE}>{s.provider}</Td>
                    <Td mono col={SUBTLE}>{s.deviceType}</Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td mono col={s.mfaVerified ? GREEN : RED}>{s.mfaVerified ? 'âœ“' : 'âœ—'}</Td>
                    <Td><MfaBadge m={s.mfaMethod} /></Td>
                    <Td><RiskBar score={s.riskScore} /></Td>
                    <Td mono col={SUBTLE}>{s.geoLocation || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{s.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'mfa' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Enrollment ID</Th><Th>Email</Th><Th>Method</Th><Th>Status</Th><Th>Primary</Th><Th right>Failures</Th><Th>Verified At</Th><Th>Last Used</Th></tr></thead>
              <tbody>
                {mfaEnrollments.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No MFA enrollments â€” check /api/v4/sso/mfa</td></tr>}
                {mfaEnrollments.sort((a, b) => b.failureCount - a.failureCount).map((m, i) => (
                  <tr key={i} style={{ background: m.status === 'revoked' ? RED + '0a' : m.failureCount > 3 ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.enrollmentId}</Td>
                    <Td mono col={TEXT}>{m.email}</Td>
                    <Td><MfaBadge m={m.method} /></Td>
                    <Td><StatusBadge s={m.status} /></Td>
                    <Td mono col={m.isPrimary ? AMBER : SUBTLE}>{m.isPrimary ? 'PRIMARY' : 'â€”'}</Td>
                    <Td right mono col={m.failureCount > 3 ? RED : TEXT}>{m.failureCount}</Td>
                    <Td mono col={SUBTLE}>{m.verifiedAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{m.lastUsedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'providers' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Provider ID</Th><Th>Name</Th><Th>Protocol</Th><Th>Status</Th><Th>Domain</Th><Th right>Users</Th><Th right>Error %</Th><Th>MFA Enforced</Th><Th>Session min</Th><Th>Last Sync</Th></tr></thead>
              <tbody>
                {providers.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No providers â€” check /api/v4/sso/providers</td></tr>}
                {providers.sort((a, b) => a.status === 'degraded' ? -1 : 0).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'degraded' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.providerId}</Td>
                    <Td mono col={TEXT}>{p.name}</Td>
                    <Td><ProtocolBadge p={p.protocol} /></Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td mono col={SUBTLE}>{p.domain || 'â€”'}</Td>
                    <Td right mono col={TEXT}>{p.usersCount.toLocaleString()}</Td>
                    <Td right mono col={p.errorRatePct > 1 ? RED : GREEN}>{p.errorRatePct.toFixed(2)}%</Td>
                    <Td mono col={p.mfaEnforced ? GREEN : RED}>{p.mfaEnforced ? 'âœ“ YES' : 'âœ— NO'}</Td>
                    <Td right mono col={TEXT}>{p.sessionDurationMinutes}</Td>
                    <Td mono col={SUBTLE}>{p.lastSyncAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'policies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Policy ID</Th><Th>Name</Th><Th>Scope</Th><Th>Status</Th><Th>MFA Required</Th><Th>Device Trust</Th><Th right>Max Hours</Th><Th right>Idle min</Th><Th right>Risk Threshold</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {policies.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No policies â€” check /api/v4/sso/policies</td></tr>}
                {policies.map((p, i) => (
                  <tr key={i} style={{ opacity: p.status === 'disabled' ? 0.5 : 1 }}>
                    <Td mono col={AMBER}>{p.policyId}</Td>
                    <Td mono col={TEXT}>{p.name}</Td>
                    <Td mono col={BLUE}>{p.scope.toUpperCase()}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td mono col={TEXT}>{p.mfaRequired}</Td>
                    <Td mono col={p.deviceTrustRequired ? GREEN : SUBTLE}>{p.deviceTrustRequired ? 'âœ“' : 'â€”'}</Td>
                    <Td right mono col={TEXT}>{p.sessionMaxHours}</Td>
                    <Td right mono col={TEXT}>{p.idleTimeoutMinutes}</Td>
                    <Td right mono col={AMBER}>{(p.riskThreshold * 100).toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{p.lastUpdated || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>User ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v4/sso/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.userId}</Td>
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
