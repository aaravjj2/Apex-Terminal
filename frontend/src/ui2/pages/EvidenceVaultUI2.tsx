import React, { useState, useEffect, useCallback } from 'react'
﻿// EvidenceVaultUI2 â€” Bloomberg EVID immutable regulatory evidence vault
// Vault items, collection, chain of custody, reviews, audit
// Tabs: VAULT | COLLECTION | CUSTODY | REVIEWS | AUDIT
// APIs: /api/v4/evidence-vault/vault, /collection, /custody, /reviews, /audit

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

interface VaultItem {
  evidenceId: string
  title: string
  type: string
  classification: string
  storedAt: string
  expiresAt: string
  hash: string
  sizeMb: number
  status: 'sealed' | 'pending' | 'expired' | 'retrieved'
  regulatoryRef: string
  custodian: string
  tags: string[]
}

interface CollectionRecord {
  collectionId: string
  evidenceId: string
  collectionMethod: string
  sourceSys: string
  collectedAt: string
  collectedBy: string
  verificationStatus: 'verified' | 'pending' | 'failed'
  checksumValid: boolean
  integrityScore: number
  retentionYears: number
  legalHold: boolean
}

interface CustodyEvent {
  eventId: string
  evidenceId: string
  action: string
  actor: string
  fromLocation: string
  toLocation: string
  timestamp: string
  reason: string
  authorizedBy: string
  integrityVerified: boolean
  hashBefore: string
  hashAfter: string
}

interface EvidenceReview {
  reviewId: string
  evidenceId: string
  reviewType: string
  reviewer: string
  reviewedAt: string
  outcome: 'approved' | 'rejected' | 'flagged' | 'pending'
  notes: string
  regulatoryDeadline: string
  priority: 'high' | 'medium' | 'low'
  linkedCase: string
}

interface VaultAuditEntry {
  auditId: string
  action: string
  actor: string
  evidenceId: string
  details: string
  ipAddress: string
  timestamp: string
  outcome: 'success' | 'failure' | 'warning'
  jurisdiction: string
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
function EvidTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { document: BLUE, 'communication': PURPLE, 'trade-record': AMBER, 'audit-log': GREEN, 'snapshot': ORANGE }
  const c = m[t.toLowerCase()] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { sealed: GREEN, pending: AMBER, expired: RED, retrieved: BLUE, verified: GREEN, failed: RED, approved: GREEN, rejected: RED, flagged: ORANGE, success: GREEN, failure: RED, warning: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function PriorityBadge({ p }: { p: string }) {
  const m: Record<string, string> = { high: RED, medium: AMBER, low: GREEN }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}


export function EvidenceVaultUI2() {
  const [tab, setTab] = useState<'vault' | 'collection' | 'custody' | 'reviews' | 'audit'>('vault')
  const [vault, setVault] = useState<VaultItem[]>([])
  const [collection, setCollection] = useState<CollectionRecord[]>([])
  const [custody, setCustody] = useState<CustodyEvent[]>([])
  const [reviews, setReviews] = useState<EvidenceReview[]>([])
  const [auditLog, setAuditLog] = useState<VaultAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rV, rC, rCu, rR, rA] = await Promise.allSettled([
        fetch('/api/v4/evidence-vault/vault').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/evidence-vault/collection').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/evidence-vault/custody').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/evidence-vault/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/evidence-vault/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.vault ?? rV.value.data ?? []
        setVault(raw.map((v: any) => ({
          evidenceId: v.evidence_id ?? v.evidenceId ?? '', title: v.title ?? '',
          type: v.type ?? '', classification: v.classification ?? '',
          storedAt: v.stored_at ?? v.storedAt ?? '', expiresAt: v.expires_at ?? v.expiresAt ?? '',
          hash: v.hash ?? '', sizeMb: Number(v.size_mb ?? v.sizeMb ?? 0),
          status: v.status ?? 'pending', regulatoryRef: v.regulatory_ref ?? v.regulatoryRef ?? '',
          custodian: v.custodian ?? '', tags: Array.isArray(v.tags) ? v.tags : [],
        })))
        setErr(null)
      } else setErr('Failed to load vault')
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.collection ?? rC.value.data ?? []
        setCollection(raw.map((c: any) => ({
          collectionId: c.collection_id ?? c.collectionId ?? '', evidenceId: c.evidence_id ?? c.evidenceId ?? '',
          collectionMethod: c.collection_method ?? c.collectionMethod ?? '', sourceSys: c.source_sys ?? c.sourceSys ?? '',
          collectedAt: c.collected_at ?? c.collectedAt ?? '', collectedBy: c.collected_by ?? c.collectedBy ?? '',
          verificationStatus: c.verification_status ?? c.verificationStatus ?? 'pending',
          checksumValid: Boolean(c.checksum_valid ?? c.checksumValid ?? false),
          integrityScore: Number(c.integrity_score ?? c.integrityScore ?? 0),
          retentionYears: Number(c.retention_years ?? c.retentionYears ?? 0),
          legalHold: Boolean(c.legal_hold ?? c.legalHold ?? false),
        })))
      }
      if (rCu.status === 'fulfilled') {
        const raw = Array.isArray(rCu.value) ? rCu.value : rCu.value.custody ?? rCu.value.data ?? []
        setCustody(raw.map((e: any) => ({
          eventId: e.event_id ?? e.eventId ?? '', evidenceId: e.evidence_id ?? e.evidenceId ?? '',
          action: e.action ?? '', actor: e.actor ?? '',
          fromLocation: e.from_location ?? e.fromLocation ?? '', toLocation: e.to_location ?? e.toLocation ?? '',
          timestamp: e.timestamp ?? '', reason: e.reason ?? '', authorizedBy: e.authorized_by ?? e.authorizedBy ?? '',
          integrityVerified: Boolean(e.integrity_verified ?? e.integrityVerified ?? false),
          hashBefore: e.hash_before ?? e.hashBefore ?? '', hashAfter: e.hash_after ?? e.hashAfter ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviews ?? rR.value.data ?? []
        setReviews(raw.map((r: any) => ({
          reviewId: r.review_id ?? r.reviewId ?? '', evidenceId: r.evidence_id ?? r.evidenceId ?? '',
          reviewType: r.review_type ?? r.reviewType ?? '', reviewer: r.reviewer ?? '',
          reviewedAt: r.reviewed_at ?? r.reviewedAt ?? '', outcome: r.outcome ?? 'pending',
          notes: r.notes ?? '', regulatoryDeadline: r.regulatory_deadline ?? r.regulatoryDeadline ?? '',
          priority: r.priority ?? 'medium', linkedCase: r.linked_case ?? r.linkedCase ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', actor: a.actor ?? '',
          evidenceId: a.evidence_id ?? a.evidenceId ?? '', details: a.details ?? '',
          ipAddress: a.ip_address ?? a.ipAddress ?? '', timestamp: a.timestamp ?? '',
          outcome: a.outcome ?? 'success', jurisdiction: a.jurisdiction ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const sealedItems = vault.filter(v => v.status === 'sealed').length
  const expiredItems = vault.filter(v => v.status === 'expired').length
  const legalHolds = collection.filter(c => c.legalHold).length
  const pendingReviews = reviews.filter(r => r.outcome === 'pending').length
  const highPriorityReviews = reviews.filter(r => r.priority === 'high' && r.outcome === 'pending').length

  const TABS2 = [
    { id: 'vault' as const, label: 'VAULT' },
    { id: 'collection' as const, label: 'COLLECTION' },
    { id: 'custody' as const, label: 'CUSTODY' },
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>EVID</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EVIDENCE VAULT â€” IMMUTABLE REGULATORY STORAGE + CHAIN OF CUSTODY + REVIEW WORKFLOW</span>
        {expiredItems > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {expiredItems} EXPIRED</span>}
        {highPriorityReviews > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {highPriorityReviews} HIGH PRIORITY REVIEWS</span>}
        {legalHolds > 0 && <span style={{ fontSize: 10, color: PURPLE, fontWeight: 700 }}>⚠‘ {legalHolds} LEGAL HOLDS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Evidence" value={vault.length} col={BLUE} />
        <StatCard label="Sealed" value={sealedItems} col={GREEN} />
        <StatCard label="Expired" value={expiredItems} col={expiredItems > 0 ? RED : SUBTLE} />
        <StatCard label="Legal Holds" value={legalHolds} col={PURPLE} />
        <StatCard label="Pending Reviews" value={pendingReviews} col={pendingReviews > 0 ? ORANGE : SUBTLE} />
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

        {tab === 'vault' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Evidence ID</Th><Th>Title</Th><Th>Type</Th><Th>Classification</Th><Th>Status</Th><Th right>Size (MB)</Th><Th>Regulatory Ref</Th><Th>Custodian</Th><Th>Stored At</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {vault.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No vault items â€” check /api/v4/evidence-vault/vault</td></tr>}
                {vault.sort((a, b) => {
                  const ord: Record<string, number> = { expired: 0, pending: 1, sealed: 2, retrieved: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.status === 'expired' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.evidenceId}</Td>
                    <Td mono col={TEXT}>{v.title}</Td>
                    <Td><EvidTypeBadge t={v.type} /></Td>
                    <Td mono col={v.classification === 'CONFIDENTIAL' ? RED : v.classification === 'RESTRICTED' ? ORANGE : SUBTLE}>{v.classification}</Td>
                    <Td><StatusBadge2 s={v.status} /></Td>
                    <Td right mono col={SUBTLE}>{v.sizeMb.toFixed(2)}</Td>
                    <Td mono col={BLUE}>{v.regulatoryRef || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{v.custodian}</Td>
                    <Td mono col={SUBTLE}>{v.storedAt}</Td>
                    <Td mono col={v.status === 'expired' ? RED : SUBTLE}>{v.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'collection' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Collection ID</Th><Th>Evidence ID</Th><Th>Method</Th><Th>Source Sys</Th><Th>Verification</Th><Th>Checksum</Th><Th right>Integrity</Th><Th right>Retention (yrs)</Th><Th>Legal Hold</Th><Th>Collected</Th></tr></thead>
              <tbody>
                {collection.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No collections â€” check /api/v4/evidence-vault/collection</td></tr>}
                {collection.map((c, i) => (
                  <tr key={i} style={{ background: c.legalHold ? PURPLE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.collectionId}</Td>
                    <Td mono col={BLUE}>{c.evidenceId}</Td>
                    <Td mono col={SUBTLE}>{c.collectionMethod}</Td>
                    <Td mono col={SUBTLE}>{c.sourceSys}</Td>
                    <Td><StatusBadge2 s={c.verificationStatus} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.checksumValid ? GREEN : RED }}>{c.checksumValid ? 'âœ“ VALID' : 'âœ— INVALID'}</span></Td>
                    <Td right mono col={c.integrityScore >= 0.99 ? GREEN : c.integrityScore >= 0.95 ? AMBER : RED}>{(c.integrityScore * 100).toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{c.retentionYears}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.legalHold ? PURPLE : SUBTLE }}>{c.legalHold ? 'HOLD' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{c.collectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'custody' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Event ID</Th><Th>Evidence ID</Th><Th>Action</Th><Th>Actor</Th><Th>From</Th><Th>To</Th><Th>Authorized By</Th><Th>Integrity</Th><Th>Reason</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {custody.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No custody events â€” check /api/v4/evidence-vault/custody</td></tr>}
                {custody.map((e, i) => (
                  <tr key={i} style={{ background: !e.integrityVerified ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.eventId}</Td>
                    <Td mono col={BLUE}>{e.evidenceId}</Td>
                    <Td mono col={ORANGE}>{e.action}</Td>
                    <Td mono col={TEXT}>{e.actor}</Td>
                    <Td mono col={SUBTLE}>{e.fromLocation}</Td>
                    <Td mono col={SUBTLE}>{e.toLocation}</Td>
                    <Td mono col={SUBTLE}>{e.authorizedBy}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.integrityVerified ? GREEN : RED }}>{e.integrityVerified ? 'âœ“ OK' : 'âœ— FAIL'}</span></Td>
                    <Td mono col={SUBTLE}>{e.reason || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Review ID</Th><Th>Evidence ID</Th><Th>Type</Th><Th>Reviewer</Th><Th>Priority</Th><Th>Outcome</Th><Th>Linked Case</Th><Th>Regulatory Deadline</Th><Th>Reviewed At</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews â€” check /api/v4/evidence-vault/reviews</td></tr>}
                {reviews.sort((a, b) => {
                  const pOrd: Record<string, number> = { high: 0, medium: 1, low: 2 }
                  return (pOrd[a.priority] ?? 3) - (pOrd[b.priority] ?? 3)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.priority === 'high' && r.outcome === 'pending' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reviewId}</Td>
                    <Td mono col={BLUE}>{r.evidenceId}</Td>
                    <Td mono col={PURPLE}>{r.reviewType}</Td>
                    <Td mono col={TEXT}>{r.reviewer}</Td>
                    <Td><PriorityBadge p={r.priority} /></Td>
                    <Td><StatusBadge2 s={r.outcome} /></Td>
                    <Td mono col={BLUE}>{r.linkedCase || 'â€”'}</Td>
                    <Td mono col={AMBER}>{r.regulatoryDeadline}</Td>
                    <Td mono col={SUBTLE}>{r.reviewedAt || 'PENDING'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Evidence ID</Th><Th>Jurisdiction</Th><Th>Outcome</Th><Th>IP Address</Th><Th>Details</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/evidence-vault/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'failure' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.evidenceId}</Td>
                    <Td mono col={SUBTLE}>{a.jurisdiction}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.ipAddress}</Td>
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
