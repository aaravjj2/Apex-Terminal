import React, { useState, useEffect, useCallback } from 'react'
﻿// MarketplaceTrustUI2 — Bloomberg MKTT marketplace trust & security terminal
// Listing health, malware scanning, signing certificates, reviews, audit
// Tabs: LISTINGS | SCANNING | SIGNING | REVIEWS | AUDIT
// APIs: /api/v4/marketplace-trust/listings, /scanning, /signing, /reviews, /audit

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

interface TrustedListing {
  listingId: string
  name: string
  publisher: string
  category: string
  version: string
  trustScore: number
  signedStatus: 'signed' | 'unsigned' | 'revoked'
  scanStatus: 'clean' | 'warning' | 'malicious' | 'pending'
  downloads: number
  rating: number
  reviews: number
  publishedAt: string
  lastScanned: string
}

interface ScanResult {
  scanId: string
  listingId: string
  listingName: string
  scanType: string
  status: 'clean' | 'suspicious' | 'malicious' | 'failed'
  threatsFound: number
  threatDetails: string
  engine: string
  duration: string
  scannedAt: string
}

interface SigningEntry {
  certId: string
  listingId: string
  publisher: string
  certType: string
  issuedBy: string
  validFrom: string
  validUntil: string
  status: 'valid' | 'expired' | 'revoked' | 'pending'
  fingerprint: string
  daysUntilExpiry: number
}

interface TrustReview {
  reviewId: string
  listingId: string
  listingName: string
  reviewer: string
  rating: number
  trustRating: 'trusted' | 'suspicious' | 'blocked'
  report: string
  flagged: boolean
  resolution: 'approved' | 'rejected' | 'escalated' | 'pending'
  createdAt: string
}

interface TrustAuditEntry {
  auditId: string
  listingId: string
  action: string
  actor: string
  previousStatus: string
  newStatus: string
  outcome: 'pass' | 'fail' | 'warn'
  reason: string
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
function TrustBadge({ score }: { score: number }) {
  const col = score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 52, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{score}</span>
    </div>
  )
}
function ScanBadge({ s }: { s: string }) {
  const m: Record<string, string> = { clean: GREEN, warning: AMBER, suspicious: AMBER, malicious: RED, pending: SUBTLE, failed: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SignBadge({ s }: { s: string }) {
  const m: Record<string, string> = { signed: GREEN, unsigned: AMBER, revoked: RED, valid: GREEN, expired: ORANGE, pending: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { approved: GREEN, rejected: RED, escalated: ORANGE, pending: SUBTLE, trusted: GREEN, suspicious: AMBER, blocked: RED, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StarRating({ r }: { r: number }) {
  const filled = Math.round(r)
  return <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>{'â˜…'.repeat(filled)}{'â˜†'.repeat(5 - filled)} <span style={{ color: SUBTLE, fontSize: 9 }}>{r.toFixed(1)}</span></span>
}


export function MarketplaceTrustUI2() {
  const [tab, setTab] = useState<'listings' | 'scanning' | 'signing' | 'reviews' | 'audit'>('listings')
  const [listings, setListings] = useState<TrustedListing[]>([])
  const [scans, setScans] = useState<ScanResult[]>([])
  const [signing, setSigning] = useState<SigningEntry[]>([])
  const [reviews, setReviews] = useState<TrustReview[]>([])
  const [auditLog, setAuditLog] = useState<TrustAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rL, rSc, rSi, rR, rA] = await Promise.allSettled([
        fetch('/api/v4/marketplace-trust/listings').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace-trust/scanning').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace-trust/signing').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace-trust/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace-trust/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.listings ?? rL.value.data ?? []
        setListings(raw.map((l: any) => ({
          listingId: l.listing_id ?? l.listingId ?? '', name: l.name ?? '', publisher: l.publisher ?? '',
          category: l.category ?? '', version: l.version ?? '',
          trustScore: Number(l.trust_score ?? l.trustScore ?? 0),
          signedStatus: l.signed_status ?? l.signedStatus ?? 'unsigned',
          scanStatus: l.scan_status ?? l.scanStatus ?? 'pending',
          downloads: Number(l.downloads ?? 0), rating: Number(l.rating ?? 0), reviews: Number(l.reviews ?? 0),
          publishedAt: l.published_at ?? l.publishedAt ?? '', lastScanned: l.last_scanned ?? l.lastScanned ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load listings')
      if (rSc.status === 'fulfilled') {
        const raw = Array.isArray(rSc.value) ? rSc.value : rSc.value.scans ?? rSc.value.data ?? []
        setScans(raw.map((s: any) => ({
          scanId: s.scan_id ?? s.scanId ?? '', listingId: s.listing_id ?? s.listingId ?? '',
          listingName: s.listing_name ?? s.listingName ?? '', scanType: s.scan_type ?? s.scanType ?? '',
          status: s.status ?? 'pending', threatsFound: Number(s.threats_found ?? s.threatsFound ?? 0),
          threatDetails: s.threat_details ?? s.threatDetails ?? '', engine: s.engine ?? '',
          duration: s.duration ?? '', scannedAt: s.scanned_at ?? s.scannedAt ?? '',
        })))
      }
      if (rSi.status === 'fulfilled') {
        const raw = Array.isArray(rSi.value) ? rSi.value : rSi.value.signing ?? rSi.value.data ?? []
        setSigning(raw.map((s: any) => ({
          certId: s.cert_id ?? s.certId ?? '', listingId: s.listing_id ?? s.listingId ?? '',
          publisher: s.publisher ?? '', certType: s.cert_type ?? s.certType ?? '',
          issuedBy: s.issued_by ?? s.issuedBy ?? '', validFrom: s.valid_from ?? s.validFrom ?? '',
          validUntil: s.valid_until ?? s.validUntil ?? '', status: s.status ?? 'pending',
          fingerprint: s.fingerprint ?? '', daysUntilExpiry: Number(s.days_until_expiry ?? s.daysUntilExpiry ?? 0),
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviews ?? rR.value.data ?? []
        setReviews(raw.map((r: any) => ({
          reviewId: r.review_id ?? r.reviewId ?? '', listingId: r.listing_id ?? r.listingId ?? '',
          listingName: r.listing_name ?? r.listingName ?? '', reviewer: r.reviewer ?? '',
          rating: Number(r.rating ?? 0), trustRating: r.trust_rating ?? r.trustRating ?? 'trusted',
          report: r.report ?? '', flagged: Boolean(r.flagged ?? false),
          resolution: r.resolution ?? 'pending', createdAt: r.created_at ?? r.createdAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', listingId: a.listing_id ?? a.listingId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          previousStatus: a.previous_status ?? a.previousStatus ?? '', newStatus: a.new_status ?? a.newStatus ?? '',
          outcome: a.outcome ?? 'pass', reason: a.reason ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const malicious = listings.filter(l => l.scanStatus === 'malicious').length
  const unsigned = listings.filter(l => l.signedStatus === 'unsigned').length
  const flaggedReviews = reviews.filter(r => r.flagged).length
  const expiringCerts = signing.filter(s => s.daysUntilExpiry > 0 && s.daysUntilExpiry < 30).length

  const TABS2 = [
    { id: 'listings' as const, label: 'LISTINGS' },
    { id: 'scanning' as const, label: 'SCANNING' },
    { id: 'signing' as const, label: 'SIGNING' },
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>MKTT</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>MARKETPLACE TRUST — SCANNING + SIGNING + REVIEW SECURITY + MALWARE DETECTION</span>
        {malicious > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {malicious} MALICIOUS</span>}
        {unsigned > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {unsigned} UNSIGNED</span>}
        {flaggedReviews > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {flaggedReviews} FLAGGED REVIEWS</span>}
        {expiringCerts > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {expiringCerts} CERTS EXPIRING</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Listings" value={listings.length} col={BLUE} />
        <StatCard label="Malicious" value={malicious} col={malicious > 0 ? RED : GREEN} />
        <StatCard label="Unsigned" value={unsigned} col={unsigned > 0 ? ORANGE : GREEN} />
        <StatCard label="Flagged Reviews" value={flaggedReviews} col={flaggedReviews > 0 ? AMBER : GREEN} />
        <StatCard label="Certs Expiring" value={expiringCerts} col={expiringCerts > 0 ? AMBER : SUBTLE} sub="< 30 days" />
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

        {tab === 'listings' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Publisher</Th><Th>Category</Th><Th>Trust Score</Th><Th>Signed</Th><Th>Scan</Th><Th>Rating</Th><Th right>Downloads</Th><Th>Version</Th><Th>Published</Th><Th>Last Scan</Th></tr></thead>
              <tbody>
                {listings.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No listings</td></tr>}
                {listings.sort((a, b) => {
                  const p: Record<string, number> = { malicious: 0, warning: 1, pending: 2, clean: 3 }
                  return (p[a.scanStatus] ?? 4) - (p[b.scanStatus] ?? 4)
                }).map((l, i) => (
                  <tr key={i} style={{ background: l.scanStatus === 'malicious' ? RED + '0a' : l.scanStatus === 'warning' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{l.name}</Td>
                    <Td mono col={BLUE}>{l.publisher}</Td>
                    <Td mono col={PURPLE}>{l.category}</Td>
                    <Td><TrustBadge score={l.trustScore} /></Td>
                    <Td><SignBadge s={l.signedStatus} /></Td>
                    <Td><ScanBadge s={l.scanStatus} /></Td>
                    <Td><StarRating r={l.rating} /></Td>
                    <Td right mono col={SUBTLE}>{l.downloads.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{l.version}</Td>
                    <Td mono col={SUBTLE}>{l.publishedAt}</Td>
                    <Td mono col={SUBTLE}>{l.lastScanned}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'scanning' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Scan ID</Th><Th>Listing</Th><Th>Scan Type</Th><Th>Status</Th><Th right>Threats</Th><Th>Details</Th><Th>Engine</Th><Th>Duration</Th><Th>Scanned</Th></tr></thead>
              <tbody>
                {scans.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No scans</td></tr>}
                {scans.sort((a, b) => {
                  const p: Record<string, number> = { malicious: 0, suspicious: 1, failed: 2, pending: 3, clean: 4 }
                  return (p[a.status] ?? 5) - (p[b.status] ?? 5)
                }).map((s, i) => (
                  <tr key={i} style={{ background: s.status === 'malicious' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.scanId}</Td>
                    <Td mono col={BLUE}>{s.listingName}</Td>
                    <Td mono col={PURPLE}>{s.scanType}</Td>
                    <Td><ScanBadge s={s.status} /></Td>
                    <Td right mono col={s.threatsFound > 0 ? RED : GREEN}>{s.threatsFound}</Td>
                    <Td mono col={s.threatDetails ? RED : SUBTLE}>{s.threatDetails || '—'}</Td>
                    <Td mono col={SUBTLE}>{s.engine}</Td>
                    <Td mono col={SUBTLE}>{s.duration}</Td>
                    <Td mono col={SUBTLE}>{s.scannedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'signing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Cert ID</Th><Th>Publisher</Th><Th>Type</Th><Th>Status</Th><Th>Issued By</Th><Th>Valid From</Th><Th>Valid Until</Th><Th right>Days</Th><Th>Fingerprint</Th></tr></thead>
              <tbody>
                {signing.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No certificates</td></tr>}
                {signing.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry).map((s, i) => (
                  <tr key={i} style={{ background: s.status === 'revoked' ? RED + '0a' : s.daysUntilExpiry > 0 && s.daysUntilExpiry < 30 ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.certId}</Td>
                    <Td mono col={BLUE}>{s.publisher}</Td>
                    <Td mono col={PURPLE}>{s.certType}</Td>
                    <Td><SignBadge s={s.status} /></Td>
                    <Td mono col={SUBTLE}>{s.issuedBy}</Td>
                    <Td mono col={SUBTLE}>{s.validFrom}</Td>
                    <Td mono col={SUBTLE}>{s.validUntil}</Td>
                    <Td right mono col={s.daysUntilExpiry < 30 ? RED : s.daysUntilExpiry < 90 ? AMBER : GREEN}>{s.daysUntilExpiry}</Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{s.fingerprint}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Review ID</Th><Th>Listing</Th><Th>Reviewer</Th><Th>Trust</Th><Th>Resolution</Th><Th>Rating</Th><Th>Flagged</Th><Th>Report</Th><Th>Created</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews</td></tr>}
                {reviews.sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0)).map((r, i) => (
                  <tr key={i} style={{ background: r.flagged ? AMBER + '09' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reviewId}</Td>
                    <Td mono col={BLUE}>{r.listingName}</Td>
                    <Td mono col={TEXT}>{r.reviewer}</Td>
                    <Td><StatusBadge2 s={r.trustRating} /></Td>
                    <Td><StatusBadge2 s={r.resolution} /></Td>
                    <Td><StarRating r={r.rating} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.flagged ? RED : SUBTLE }}>{r.flagged ? '⚠‘ FLAGGED' : '—'}</span></Td>
                    <Td mono col={SUBTLE}>{r.report ? r.report.slice(0, 40) + (r.report.length > 40 ? '...' : '') : '—'}</Td>
                    <Td mono col={SUBTLE}>{r.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Listing</Th><Th>Action</Th><Th>Actor</Th><Th>From</Th><Th>To</Th><Th>Outcome</Th><Th>Reason</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.listingId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.previousStatus}</Td>
                    <Td mono col={TEXT}>{a.newStatus}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.reason || '—'}</Td>
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
