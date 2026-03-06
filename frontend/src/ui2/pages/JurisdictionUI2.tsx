import React, { useState, useEffect, useCallback } from 'react'
﻿// JurisdictionUI2 — Bloomberg JURIS jurisdiction ruleset terminal
// Regulatory mapping, trade restrictions, exemptions, compliance automation
// Tabs: RULESETS | MAPPING | RESTRICTIONS | EXEMPTIONS | AUDIT
// APIs: /api/v4/jurisdiction/rulesets, /mapping, /restrictions, /exemptions, /audit

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

interface Ruleset {
  rulesetId: string
  rulesetName: string
  jurisdiction: string
  framework: string
  version: string
  effectiveDate: string
  expiryDate: string
  status: 'active' | 'draft' | 'superseded' | 'archived'
  ruleCount: number
  lastUpdated: string
  owner: string
}

interface JurisdictionMapping {
  mappingId: string
  entityId: string
  entityType: string
  primaryJurisdiction: string
  additionalJurisdictions: string[]
  mappingBasis: string
  applicableFrameworks: string[]
  status: 'mapped' | 'pending' | 'disputed' | 'override'
  reviewedAt: string
  reviewedBy: string
  complexity: 'low' | 'medium' | 'high'
}

interface TradeRestriction {
  restrictionId: string
  jurisdiction: string
  restrictionType: string
  assetClass: string
  scope: string
  status: 'active' | 'suspended' | 'expired'
  effectiveDate: string
  expiryDate: string
  authority: string
  penalty: string
  affectedEntities: number
}

interface JurisExemption {
  exemptionId: string
  entityId: string
  jurisdiction: string
  exemptionType: string
  grantedBy: string
  grantedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'revoked' | 'pending'
  conditions: string
  reviewPeriodDays: number
}

interface JurisAuditEntry {
  auditId: string
  action: string
  actor: string
  jurisdiction: string
  rulesetRef: string
  outcome: 'pass' | 'fail' | 'override'
  details: string
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
  const m: Record<string, string> = { active: GREEN, draft: SUBTLE, superseded: ORANGE, archived: SUBTLE, mapped: GREEN, pending: AMBER, disputed: RED, override: ORANGE, suspended: AMBER, expired: RED, revoked: RED, pass: GREEN, fail: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ComplexityBadge({ c }: { c: string }) {
  const m: Record<string, string> = { low: GREEN, medium: AMBER, high: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}


export function JurisdictionUI2() {
  const [tab, setTab] = useState<'rulesets' | 'mapping' | 'restrictions' | 'exemptions' | 'audit'>('rulesets')
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [mapping, setMapping] = useState<JurisdictionMapping[]>([])
  const [restrictions, setRestrictions] = useState<TradeRestriction[]>([])
  const [exemptions, setExemptions] = useState<JurisExemption[]>([])
  const [auditLog, setAuditLog] = useState<JurisAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rRS, rM, rR, rE, rA] = await Promise.allSettled([
        fetch('/api/v4/jurisdiction/rulesets').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/jurisdiction/mapping').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/jurisdiction/restrictions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/jurisdiction/exemptions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/jurisdiction/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rRS.status === 'fulfilled') {
        const raw = Array.isArray(rRS.value) ? rRS.value : rRS.value.rulesets ?? rRS.value.data ?? []
        setRulesets(raw.map((r: any) => ({
          rulesetId: r.ruleset_id ?? r.rulesetId ?? '', rulesetName: r.ruleset_name ?? r.rulesetName ?? '',
          jurisdiction: r.jurisdiction ?? '', framework: r.framework ?? '', version: r.version ?? '',
          effectiveDate: r.effective_date ?? r.effectiveDate ?? '', expiryDate: r.expiry_date ?? r.expiryDate ?? '',
          status: r.status ?? 'draft', ruleCount: Number(r.rule_count ?? r.ruleCount ?? 0),
          lastUpdated: r.last_updated ?? r.lastUpdated ?? '', owner: r.owner ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load rulesets')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.mapping ?? rM.value.data ?? []
        setMapping(raw.map((m: any) => ({
          mappingId: m.mapping_id ?? m.mappingId ?? '', entityId: m.entity_id ?? m.entityId ?? '',
          entityType: m.entity_type ?? m.entityType ?? '', primaryJurisdiction: m.primary_jurisdiction ?? m.primaryJurisdiction ?? '',
          additionalJurisdictions: Array.isArray(m.additional_jurisdictions ?? m.additionalJurisdictions) ? (m.additional_jurisdictions ?? m.additionalJurisdictions) : [],
          mappingBasis: m.mapping_basis ?? m.mappingBasis ?? '',
          applicableFrameworks: Array.isArray(m.applicable_frameworks ?? m.applicableFrameworks) ? (m.applicable_frameworks ?? m.applicableFrameworks) : [],
          status: m.status ?? 'pending', reviewedAt: m.reviewed_at ?? m.reviewedAt ?? '',
          reviewedBy: m.reviewed_by ?? m.reviewedBy ?? '', complexity: m.complexity ?? 'medium',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.restrictions ?? rR.value.data ?? []
        setRestrictions(raw.map((r: any) => ({
          restrictionId: r.restriction_id ?? r.restrictionId ?? '', jurisdiction: r.jurisdiction ?? '',
          restrictionType: r.restriction_type ?? r.restrictionType ?? '', assetClass: r.asset_class ?? r.assetClass ?? '',
          scope: r.scope ?? '', status: r.status ?? 'active',
          effectiveDate: r.effective_date ?? r.effectiveDate ?? '', expiryDate: r.expiry_date ?? r.expiryDate ?? '',
          authority: r.authority ?? '', penalty: r.penalty ?? '', affectedEntities: Number(r.affected_entities ?? r.affectedEntities ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.exemptions ?? rE.value.data ?? []
        setExemptions(raw.map((e: any) => ({
          exemptionId: e.exemption_id ?? e.exemptionId ?? '', entityId: e.entity_id ?? e.entityId ?? '',
          jurisdiction: e.jurisdiction ?? '', exemptionType: e.exemption_type ?? e.exemptionType ?? '',
          grantedBy: e.granted_by ?? e.grantedBy ?? '', grantedAt: e.granted_at ?? e.grantedAt ?? '',
          expiresAt: e.expires_at ?? e.expiresAt ?? '', status: e.status ?? 'active',
          conditions: e.conditions ?? '', reviewPeriodDays: Number(e.review_period_days ?? e.reviewPeriodDays ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          jurisdiction: a.jurisdiction ?? '', rulesetRef: a.ruleset_ref ?? a.rulesetRef ?? '',
          outcome: a.outcome ?? 'pass', details: a.details ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const activeRulesets = rulesets.filter(r => r.status === 'active').length
  const disputedMappings = mapping.filter(m => m.status === 'disputed').length
  const activeRestrictions = restrictions.filter(r => r.status === 'active').length
  const expiringExemptions = exemptions.filter(e => e.status === 'active' && e.expiresAt).length

  const TABS2 = [
    { id: 'rulesets' as const, label: 'RULESETS' },
    { id: 'mapping' as const, label: 'MAPPING' },
    { id: 'restrictions' as const, label: 'RESTRICTIONS' },
    { id: 'exemptions' as const, label: 'EXEMPTIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>JURIS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>JURISDICTION — RULESET ENGINE + ENTITY MAPPING + TRADE RESTRICTIONS + EXEMPTIONS</span>
        {disputedMappings > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {disputedMappings} DISPUTED MAPPINGS</span>}
        {activeRestrictions > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {activeRestrictions} ACTIVE RESTRICTIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Rulesets" value={activeRulesets} col={GREEN} />
        <StatCard label="Total Rulesets" value={rulesets.length} col={BLUE} />
        <StatCard label="Disputed Mappings" value={disputedMappings} col={disputedMappings > 0 ? RED : SUBTLE} />
        <StatCard label="Restrictions" value={activeRestrictions} col={activeRestrictions > 0 ? ORANGE : SUBTLE} />
        <StatCard label="Active Exemptions" value={expiringExemptions} col={PURPLE} />
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

        {tab === 'rulesets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Ruleset ID</Th><Th>Name</Th><Th>Jurisdiction</Th><Th>Framework</Th><Th>Version</Th><Th>Status</Th><Th right>Rules</Th><Th>Owner</Th><Th>Effective</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {rulesets.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rulesets</td></tr>}
                {rulesets.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.rulesetId}</Td>
                    <Td mono col={TEXT}>{r.rulesetName}</Td>
                    <Td mono col={BLUE}>{r.jurisdiction}</Td>
                    <Td mono col={PURPLE}>{r.framework}</Td>
                    <Td mono col={SUBTLE}>{r.version}</Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td right mono col={SUBTLE}>{r.ruleCount}</Td>
                    <Td mono col={SUBTLE}>{r.owner}</Td>
                    <Td mono col={SUBTLE}>{r.effectiveDate}</Td>
                    <Td mono col={SUBTLE}>{r.expiryDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'mapping' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Entity</Th><Th>Type</Th><Th>Primary Jurisdiction</Th><Th>Complexity</Th><Th>Status</Th><Th>Mapping Basis</Th><Th>Reviewed By</Th><Th>Reviewed At</Th></tr></thead>
              <tbody>
                {mapping.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No mappings</td></tr>}
                {mapping.sort((a, b) => {
                  const ord: Record<string, number> = { disputed: 0, pending: 1, override: 2, mapped: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((m, i) => (
                  <tr key={i} style={{ background: m.status === 'disputed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.entityId}</Td>
                    <Td mono col={BLUE}>{m.entityType}</Td>
                    <Td mono col={TEXT}>{m.primaryJurisdiction}</Td>
                    <Td><ComplexityBadge c={m.complexity} /></Td>
                    <Td><StatusBadge2 s={m.status} /></Td>
                    <Td mono col={SUBTLE}>{m.mappingBasis}</Td>
                    <Td mono col={SUBTLE}>{m.reviewedBy || '—'}</Td>
                    <Td mono col={SUBTLE}>{m.reviewedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'restrictions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Restriction ID</Th><Th>Jurisdiction</Th><Th>Type</Th><Th>Asset Class</Th><Th>Scope</Th><Th>Status</Th><Th>Authority</Th><Th right>Affected</Th><Th>Penalty</Th><Th>Effective</Th></tr></thead>
              <tbody>
                {restrictions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No restrictions</td></tr>}
                {restrictions.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'active' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.restrictionId}</Td>
                    <Td mono col={BLUE}>{r.jurisdiction}</Td>
                    <Td mono col={ORANGE}>{r.restrictionType}</Td>
                    <Td mono col={PURPLE}>{r.assetClass}</Td>
                    <Td mono col={SUBTLE}>{r.scope}</Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td mono col={SUBTLE}>{r.authority}</Td>
                    <Td right mono col={r.affectedEntities > 100 ? ORANGE : SUBTLE}>{r.affectedEntities.toLocaleString()}</Td>
                    <Td mono col={r.penalty ? RED : SUBTLE}>{r.penalty || '—'}</Td>
                    <Td mono col={SUBTLE}>{r.effectiveDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exemptions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Exemption ID</Th><Th>Entity</Th><Th>Jurisdiction</Th><Th>Type</Th><Th>Status</Th><Th>Granted By</Th><Th right>Review Period (days)</Th><Th>Conditions</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {exemptions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exemptions</td></tr>}
                {exemptions.sort((a, b) => {
                  const ord: Record<string, number> = { revoked: 0, expired: 1, pending: 2, active: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'revoked' ? RED + '0a' : 'transparent', opacity: e.status === 'expired' ? 0.55 : 1 }}>
                    <Td mono col={AMBER}>{e.exemptionId}</Td>
                    <Td mono col={BLUE}>{e.entityId}</Td>
                    <Td mono col={TEXT}>{e.jurisdiction}</Td>
                    <Td mono col={PURPLE}>{e.exemptionType}</Td>
                    <Td><StatusBadge2 s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.grantedBy}</Td>
                    <Td right mono col={e.reviewPeriodDays < 90 ? AMBER : SUBTLE}>{e.reviewPeriodDays}</Td>
                    <Td mono col={SUBTLE}>{e.conditions || '—'}</Td>
                    <Td mono col={AMBER}>{e.expiresAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Jurisdiction</Th><Th>Ruleset Ref</Th><Th>Outcome</Th><Th>Details</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.jurisdiction}</Td>
                    <Td mono col={SUBTLE}>{a.rulesetRef || '—'}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.details}</Td>
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
