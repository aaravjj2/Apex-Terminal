import React, { useState, useEffect, useCallback } from 'react'
﻿// MarketplaceUI2 â€” Bloomberg MKTX extension marketplace terminal
// Listing discovery, reviews, publishers, featured rankings, audit
// Tabs: LISTINGS | DISCOVERY | REVIEWS | PUBLISHERS | AUDIT
// APIs: /api/v4/marketplace/listings, /discovery, /reviews, /publishers, /audit

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

interface MarketListing {
  listingId: string
  name: string
  description: string
  publisher: string
  category: string
  version: string
  price: number
  pricingModel: 'free' | 'freemium' | 'paid' | 'subscription'
  downloads: number
  rating: number
  reviews: number
  featured: boolean
  status: 'active' | 'deprecated' | 'beta' | 'suspended'
  publishedAt: string
  updatedAt: string
}

interface DiscoveryEntry {
  discoveryId: string
  listingId: string
  name: string
  recommendationScore: number
  reason: string
  category: string
  trending: boolean
  newlyAdded: boolean
  rankChange: number
  compatibilityScore: number
}

interface MarketReview {
  reviewId: string
  listingId: string
  listingName: string
  reviewer: string
  rating: number
  title: string
  body: string
  helpfulVotes: number
  verified: boolean
  status: 'published' | 'pending' | 'rejected' | 'flagged'
  createdAt: string
}

interface PublisherEntry {
  publisherId: string
  name: string
  verified: boolean
  totalListings: number
  totalDownloads: number
  avgRating: number
  trustLevel: 'gold' | 'silver' | 'bronze' | 'standard' | 'suspended'
  joinedAt: string
  activeListings: number
  revenue: number
}

interface MarketAuditEntry {
  auditId: string
  listingId: string
  action: string
  actor: string
  previousStatus: string
  newStatus: string
  outcome: 'pass' | 'fail' | 'warn'
  notes: string
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
function PricingBadge({ p }: { p: string }) {
  const m: Record<string, string> = { free: GREEN, freemium: BLUE, paid: AMBER, subscription: PURPLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, deprecated: SUBTLE, beta: BLUE, suspended: RED, published: GREEN, pending: AMBER, rejected: RED, flagged: ORANGE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function TrustBadge({ t }: { t: string }) {
  const m: Record<string, string> = { gold: AMBER, silver: TEXT, bronze: ORANGE, standard: SUBTLE, suspended: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function StarRating({ r }: { r: number }) {
  const filled = Math.round(r)
  return <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>{'â˜…'.repeat(filled)}{'â˜†'.repeat(5 - filled)} <span style={{ color: SUBTLE, fontSize: 9 }}>{r.toFixed(1)}</span></span>
}
function ScoreBar({ score, col }: { score: number; col?: string }) {
  const c = col ?? (score >= 80 ? GREEN : score >= 60 ? AMBER : RED)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: c }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{score}</span>
    </div>
  )
}


export function MarketplaceUI2() {
  const [tab, setTab] = useState<'listings' | 'discovery' | 'reviews' | 'publishers' | 'audit'>('listings')
  const [listings, setListings] = useState<MarketListing[]>([])
  const [discovery, setDiscovery] = useState<DiscoveryEntry[]>([])
  const [reviews, setReviews] = useState<MarketReview[]>([])
  const [publishers, setPublishers] = useState<PublisherEntry[]>([])
  const [auditLog, setAuditLog] = useState<MarketAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rL, rD, rR, rP, rA] = await Promise.allSettled([
        fetch('/api/v4/marketplace/listings').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace/discovery').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace/publishers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/marketplace/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.listings ?? rL.value.data ?? []
        setListings(raw.map((l: any) => ({
          listingId: l.listing_id ?? l.listingId ?? '', name: l.name ?? '', description: l.description ?? '',
          publisher: l.publisher ?? '', category: l.category ?? '', version: l.version ?? '',
          price: Number(l.price ?? 0), pricingModel: l.pricing_model ?? l.pricingModel ?? 'free',
          downloads: Number(l.downloads ?? 0), rating: Number(l.rating ?? 0), reviews: Number(l.reviews ?? 0),
          featured: Boolean(l.featured ?? false), status: l.status ?? 'active',
          publishedAt: l.published_at ?? l.publishedAt ?? '', updatedAt: l.updated_at ?? l.updatedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load listings')
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.discovery ?? rD.value.data ?? []
        setDiscovery(raw.map((d: any) => ({
          discoveryId: d.discovery_id ?? d.discoveryId ?? '', listingId: d.listing_id ?? d.listingId ?? '',
          name: d.name ?? '', recommendationScore: Number(d.recommendation_score ?? d.recommendationScore ?? 0),
          reason: d.reason ?? '', category: d.category ?? '', trending: Boolean(d.trending ?? false),
          newlyAdded: Boolean(d.newly_added ?? d.newlyAdded ?? false),
          rankChange: Number(d.rank_change ?? d.rankChange ?? 0),
          compatibilityScore: Number(d.compatibility_score ?? d.compatibilityScore ?? 0),
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviews ?? rR.value.data ?? []
        setReviews(raw.map((r: any) => ({
          reviewId: r.review_id ?? r.reviewId ?? '', listingId: r.listing_id ?? r.listingId ?? '',
          listingName: r.listing_name ?? r.listingName ?? '', reviewer: r.reviewer ?? '',
          rating: Number(r.rating ?? 0), title: r.title ?? '', body: r.body ?? '',
          helpfulVotes: Number(r.helpful_votes ?? r.helpfulVotes ?? 0),
          verified: Boolean(r.verified ?? false), status: r.status ?? 'published',
          createdAt: r.created_at ?? r.createdAt ?? '',
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.publishers ?? rP.value.data ?? []
        setPublishers(raw.map((p: any) => ({
          publisherId: p.publisher_id ?? p.publisherId ?? '', name: p.name ?? '',
          verified: Boolean(p.verified ?? false), totalListings: Number(p.total_listings ?? p.totalListings ?? 0),
          totalDownloads: Number(p.total_downloads ?? p.totalDownloads ?? 0),
          avgRating: Number(p.avg_rating ?? p.avgRating ?? 0),
          trustLevel: p.trust_level ?? p.trustLevel ?? 'standard',
          joinedAt: p.joined_at ?? p.joinedAt ?? '', activeListings: Number(p.active_listings ?? p.activeListings ?? 0),
          revenue: Number(p.revenue ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', listingId: a.listing_id ?? a.listingId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          previousStatus: a.previous_status ?? a.previousStatus ?? '', newStatus: a.new_status ?? a.newStatus ?? '',
          outcome: a.outcome ?? 'pass', notes: a.notes ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const activeListings = listings.filter(l => l.status === 'active').length
  const suspended = listings.filter(l => l.status === 'suspended').length
  const totalDownloads = listings.reduce((s, l) => s + l.downloads, 0)
  const flaggedReviews = reviews.filter(r => r.status === 'flagged').length

  const TABS2 = [
    { id: 'listings' as const, label: 'LISTINGS' },
    { id: 'discovery' as const, label: 'DISCOVERY' },
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'publishers' as const, label: 'PUBLISHERS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>MKTX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXTENSION MARKETPLACE â€” LISTING + DISCOVERY + REVIEWS + PUBLISHER MANAGEMENT</span>
        {suspended > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {suspended} SUSPENDED</span>}
        {flaggedReviews > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {flaggedReviews} FLAGGED REVIEWS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Listings" value={activeListings} col={BLUE} />
        <StatCard label="Suspended" value={suspended} col={suspended > 0 ? RED : GREEN} />
        <StatCard label="Total Downloads" value={totalDownloads.toLocaleString()} col={GREEN} />
        <StatCard label="Publishers" value={publishers.length} col={PURPLE} />
        <StatCard label="Flagged Reviews" value={flaggedReviews} col={flaggedReviews > 0 ? AMBER : GREEN} />
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
              <thead><tr><Th>Name</Th><Th>Publisher</Th><Th>Category</Th><Th>Status</Th><Th>Pricing</Th><Th right>Price</Th><Th right>Downloads</Th><Th>Rating</Th><Th right>Reviews</Th><Th>Featured</Th><Th>Version</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {listings.length === 0 && <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No listings â€” check /api/v4/marketplace/listings</td></tr>}
                {listings.sort((a, b) => b.downloads - a.downloads).map((l, i) => (
                  <tr key={i} style={{ background: l.status === 'suspended' ? RED + '0a' : l.featured ? AMBER + '05' : 'transparent' }}>
                    <Td mono col={AMBER}>{l.name}</Td>
                    <Td mono col={BLUE}>{l.publisher}</Td>
                    <Td mono col={PURPLE}>{l.category}</Td>
                    <Td><StatusBadge2 s={l.status} /></Td>
                    <Td><PricingBadge p={l.pricingModel} /></Td>
                    <Td right mono col={l.price > 0 ? AMBER : SUBTLE}>{l.price > 0 ? `$${l.price.toFixed(2)}` : 'FREE'}</Td>
                    <Td right mono col={SUBTLE}>{l.downloads.toLocaleString()}</Td>
                    <Td><StarRating r={l.rating} /></Td>
                    <Td right mono col={SUBTLE}>{l.reviews.toLocaleString()}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: l.featured ? AMBER : SUBTLE }}>{l.featured ? 'â˜… FEATURED' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{l.version}</Td>
                    <Td mono col={SUBTLE}>{l.updatedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'discovery' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Category</Th><Th>Score</Th><Th>Compatibility</Th><Th>Trending</Th><Th>New</Th><Th right>Rank Change</Th><Th>Reason</Th></tr></thead>
              <tbody>
                {discovery.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No discovery data â€” check /api/v4/marketplace/discovery</td></tr>}
                {discovery.sort((a, b) => b.recommendationScore - a.recommendationScore).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.name}</Td>
                    <Td mono col={PURPLE}>{d.category}</Td>
                    <Td><ScoreBar score={d.recommendationScore} col={BLUE} /></Td>
                    <Td><ScoreBar score={d.compatibilityScore} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.trending ? ORANGE : SUBTLE }}>{d.trending ? 'â–² TRENDING' : 'â€”'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.newlyAdded ? GREEN : SUBTLE }}>{d.newlyAdded ? 'â˜… NEW' : 'â€”'}</span></Td>
                    <Td right mono col={d.rankChange > 0 ? GREEN : d.rankChange < 0 ? RED : SUBTLE}>{d.rankChange > 0 ? `+${d.rankChange}` : d.rankChange}</Td>
                    <Td mono col={SUBTLE}>{d.reason}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Review ID</Th><Th>Listing</Th><Th>Reviewer</Th><Th>Rating</Th><Th>Status</Th><Th>Verified</Th><Th right>Helpful</Th><Th>Title</Th><Th>Created</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews â€” check /api/v4/marketplace/reviews</td></tr>}
                {reviews.sort((a, b) => {
                  const p: Record<string, number> = { flagged: 0, pending: 1, rejected: 2, published: 3 }
                  return (p[a.status] ?? 4) - (p[b.status] ?? 4)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'flagged' ? AMBER + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reviewId}</Td>
                    <Td mono col={BLUE}>{r.listingName}</Td>
                    <Td mono col={TEXT}>{r.reviewer}</Td>
                    <Td><StarRating r={r.rating} /></Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.verified ? GREEN : SUBTLE }}>{r.verified ? 'âœ“ VERIFIED' : 'â€”'}</span></Td>
                    <Td right mono col={r.helpfulVotes > 0 ? GREEN : SUBTLE}>{r.helpfulVotes}</Td>
                    <Td mono col={TEXT}>{r.title ? r.title.slice(0, 35) + (r.title.length > 35 ? 'â€¦' : '') : 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'publishers' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Publisher ID</Th><Th>Name</Th><Th>Trust</Th><Th>Verified</Th><Th right>Listings</Th><Th right>Active</Th><Th right>Downloads</Th><Th>Rating</Th><Th right>Revenue</Th><Th>Joined</Th></tr></thead>
              <tbody>
                {publishers.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No publishers â€” check /api/v4/marketplace/publishers</td></tr>}
                {publishers.sort((a, b) => b.totalDownloads - a.totalDownloads).map((p, i) => (
                  <tr key={i} style={{ background: p.trustLevel === 'suspended' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.publisherId}</Td>
                    <Td mono col={BLUE}>{p.name}</Td>
                    <Td><TrustBadge t={p.trustLevel} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: p.verified ? GREEN : SUBTLE }}>{p.verified ? 'âœ“ YES' : 'NO'}</span></Td>
                    <Td right mono col={SUBTLE}>{p.totalListings}</Td>
                    <Td right mono col={GREEN}>{p.activeListings}</Td>
                    <Td right mono col={SUBTLE}>{p.totalDownloads.toLocaleString()}</Td>
                    <Td><StarRating r={p.avgRating} /></Td>
                    <Td right mono col={p.revenue > 0 ? GREEN : SUBTLE}>{p.revenue > 0 ? `$${p.revenue.toLocaleString()}` : 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{p.joinedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Listing</Th><Th>Action</Th><Th>Actor</Th><Th>From</Th><Th>To</Th><Th>Outcome</Th><Th>Notes</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/marketplace/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.listingId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.previousStatus}</Td>
                    <Td mono col={TEXT}>{a.newStatus}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.notes || 'â€”'}</Td>
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
