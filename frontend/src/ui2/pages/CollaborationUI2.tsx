import React, { useState, useEffect, useCallback } from 'react'
﻿// CollaborationUI2 â€” Bloomberg COLB-grade analyst collaboration terminal
// Shared workspaces, research notes, review workflows, data annotations, team presence
// Tabs: WORKSPACES | NOTES | REVIEWS | ANNOTATIONS | TEAM
// APIs: /api/v4/collaboration/workspaces, /notes, /reviews, /annotations, /team

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

interface Workspace {
  id: string
  name: string
  description: string
  owner: string
  members: string[]
  status: 'active' | 'archived' | 'locked'
  lastActivity: string
  assetCount: number
  noteCount: number
  type: 'research' | 'watchlist' | 'portfolio' | 'strategy' | 'report'
}

interface ResearchNote {
  id: string
  workspaceId: string
  workspaceName: string
  author: string
  title: string
  symbol: string
  tags: string[]
  createdAt: string
  updatedAt: string
  status: 'draft' | 'published' | 'under_review' | 'archived'
  viewCount: number
  commentCount: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
}

interface ReviewRequest {
  id: string
  title: string
  requestedBy: string
  assignedTo: string
  dueDate: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_revision'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  type: string
  commentCount: number
}

interface Annotation {
  id: string
  symbol: string
  annotationType: 'support' | 'resistance' | 'target' | 'pattern' | 'event' | 'custom'
  price: number
  text: string
  author: string
  createdAt: string
  visible: boolean
  sharedWith: string[]
}

interface TeamMember {
  userId: string
  displayName: string
  role: string
  status: 'online' | 'away' | 'busy' | 'offline'
  currentActivity: string
  lastSeen: string
  notesCount: number
  reviewsCompleted: number
  workspaces: string[]
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

function StatusDot({ s }: { s: string }) {
  const m: Record<string, string> = { online: GREEN, away: AMBER, busy: RED, offline: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 5 }} />
}

function SentimentBadge({ s }: { s: string }) {
  const m: Record<string, [string, string]> = { bullish: [GREEN, 'â–²'], bearish: [RED, 'â–¼'], neutral: [SUBTLE, 'â€”'] }
  const [c, icon] = m[s] ?? [SUBTLE, 'â€”']
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c }}>{icon} {s.toUpperCase()}</span>
}

function TypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { research: BLUE, watchlist: GREEN, portfolio: AMBER, strategy: PURPLE, report: ORANGE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.toUpperCase()}</span>
}

function ReviewStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { pending: AMBER, in_review: BLUE, approved: GREEN, rejected: RED, needs_revision: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}

function AnnoBadge({ t }: { t: string }) {
  const m: Record<string, string> = { support: GREEN, resistance: RED, target: BLUE, pattern: PURPLE, event: ORANGE, custom: SUBTLE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.toUpperCase()}</span>
}


export function CollaborationUI2() {
  const [tab, setTab] = useState<'workspaces' | 'notes' | 'reviews' | 'annotations' | 'team'>('workspaces')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [reviews, setReviews] = useState<ReviewRequest[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [noteFilter, setNoteFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rW, rN, rR, rA, rT] = await Promise.allSettled([
        fetch('/api/v4/collaboration/workspaces').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/collaboration/notes').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/collaboration/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/collaboration/annotations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/collaboration/team').then(r => r.ok ? r.json() : []),
      ])
      if (rW.status === 'fulfilled') {
        const raw = Array.isArray(rW.value) ? rW.value : rW.value.workspaces ?? rW.value.data ?? []
        setWorkspaces(raw.map((w: any) => ({
          id: w.id ?? '', name: w.name ?? '', description: w.description ?? '', owner: w.owner ?? '',
          members: Array.isArray(w.members) ? w.members : [], status: w.status ?? 'active',
          lastActivity: w.last_activity ?? w.lastActivity ?? '', assetCount: Number(w.asset_count ?? w.assetCount ?? 0),
          noteCount: Number(w.note_count ?? w.noteCount ?? 0), type: w.type ?? 'research',
        })))
        setErr(null)
      } else setErr('Failed to load workspaces')
      if (rN.status === 'fulfilled') {
        const raw = Array.isArray(rN.value) ? rN.value : rN.value.notes ?? rN.value.data ?? []
        setNotes(raw.map((n: any) => ({
          id: n.id ?? '', workspaceId: n.workspace_id ?? n.workspaceId ?? '', workspaceName: n.workspace_name ?? n.workspaceName ?? '',
          author: n.author ?? '', title: n.title ?? '', symbol: n.symbol ?? '',
          tags: Array.isArray(n.tags) ? n.tags : [], createdAt: n.created_at ?? n.createdAt ?? '',
          updatedAt: n.updated_at ?? n.updatedAt ?? '', status: n.status ?? 'draft',
          viewCount: Number(n.view_count ?? n.viewCount ?? 0), commentCount: Number(n.comment_count ?? n.commentCount ?? 0),
          sentiment: n.sentiment ?? 'neutral',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviews ?? rR.value.data ?? []
        setReviews(raw.map((r: any) => ({
          id: r.id ?? '', title: r.title ?? '', requestedBy: r.requested_by ?? r.requestedBy ?? '',
          assignedTo: r.assigned_to ?? r.assignedTo ?? '', dueDate: r.due_date ?? r.dueDate ?? '',
          status: r.status ?? 'pending', priority: r.priority ?? 'normal', type: r.type ?? '',
          commentCount: Number(r.comment_count ?? r.commentCount ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.annotations ?? rA.value.data ?? []
        setAnnotations(raw.map((a: any) => ({
          id: a.id ?? '', symbol: a.symbol ?? '', annotationType: a.annotation_type ?? a.annotationType ?? 'custom',
          price: Number(a.price ?? 0), text: a.text ?? '', author: a.author ?? '',
          createdAt: a.created_at ?? a.createdAt ?? '', visible: Boolean(a.visible ?? true),
          sharedWith: Array.isArray(a.shared_with) ? a.shared_with : a.sharedWith ?? [],
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.members ?? rT.value.data ?? []
        setTeam(raw.map((m: any) => ({
          userId: m.user_id ?? m.userId ?? '', displayName: m.display_name ?? m.displayName ?? '',
          role: m.role ?? '', status: m.status ?? 'offline', currentActivity: m.current_activity ?? m.currentActivity ?? '',
          lastSeen: m.last_seen ?? m.lastSeen ?? '', notesCount: Number(m.notes_count ?? m.notesCount ?? 0),
          reviewsCompleted: Number(m.reviews_completed ?? m.reviewsCompleted ?? 0),
          workspaces: Array.isArray(m.workspaces) ? m.workspaces : [],
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const onlineCount = team.filter(m => m.status === 'online').length
  const pendingReviews = reviews.filter(r => r.status === 'pending' || r.status === 'in_review').length
  const filteredNotes = notes.filter(n => noteFilter === 'all' || n.status === noteFilter)
  const activeWorkspaces = workspaces.filter(w => w.status === 'active').length

  const TABS = [
    { id: 'workspaces' as const, label: 'WORKSPACES' },
    { id: 'notes' as const, label: 'NOTES' },
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'annotations' as const, label: 'ANNOTATIONS' },
    { id: 'team' as const, label: 'TEAM' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>COLB</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>COLLABORATION â€” WORKSPACES + RESEARCH NOTES + REVIEWS + ANNOTATIONS + TEAM PRESENCE</span>
        <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>â— {onlineCount} ONLINE</span>
        {pendingReviews > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {pendingReviews} PENDING REVIEWS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Workspaces" value={activeWorkspaces} col={GREEN} />
        <StatCard label="Research Notes" value={notes.length} col={BLUE} />
        <StatCard label="Pending Reviews" value={pendingReviews} col={pendingReviews > 0 ? AMBER : GREEN} />
        <StatCard label="Annotations" value={annotations.length} col={PURPLE} />
        <StatCard label="Team Online" value={`${onlineCount}/${team.length}`} col={GREEN} />
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

        {tab === 'workspaces' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Type</Th><Th>Owner</Th><Th>Status</Th><Th right>Members</Th><Th right>Assets</Th><Th right>Notes</Th><Th>Last Activity</Th></tr></thead>
              <tbody>
                {workspaces.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No workspaces â€” check /api/v4/collaboration/workspaces</td></tr>}
                {workspaces.map((w, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{w.name}</Td>
                    <Td><TypeBadge t={w.type} /></Td>
                    <Td mono col={BLUE}>{w.owner}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: w.status === 'active' ? GREEN : w.status === 'locked' ? RED : SUBTLE }}>{w.status.toUpperCase()}</span></Td>
                    <Td right mono col={TEXT}>{w.members.length}</Td>
                    <Td right mono col={TEXT}>{w.assetCount}</Td>
                    <Td right mono col={BLUE}>{w.noteCount}</Td>
                    <Td mono col={SUBTLE}>{w.lastActivity}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['all', 'draft', 'published', 'under_review', 'archived'].map(s => (
                <button key={s} onClick={() => setNoteFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: noteFilter === s ? AMBER : SUBTLE, background: noteFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${noteFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Title</Th><Th>Symbol</Th><Th>Author</Th><Th>Sentiment</Th><Th>Status</Th><Th>Tags</Th><Th right>Views</Th><Th right>Comments</Th><Th>Updated</Th></tr></thead>
                <tbody>
                  {filteredNotes.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No notes â€” check /api/v4/collaboration/notes</td></tr>}
                  {filteredNotes.map((n, i) => (
                    <tr key={i}>
                      <Td><span style={{ fontSize: 11, color: TEXT }}>{n.title}</span></Td>
                      <Td mono col={AMBER}>{n.symbol || 'â€”'}</Td>
                      <Td mono col={BLUE}>{n.author}</Td>
                      <Td><SentimentBadge s={n.sentiment} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.status === 'published' ? GREEN : n.status === 'draft' ? SUBTLE : n.status === 'under_review' ? AMBER : SUBTLE }}>{n.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td><span style={{ fontSize: 9, color: SUBTLE }}>{n.tags.slice(0, 3).join(' â€¢ ')}</span></Td>
                      <Td right mono col={SUBTLE}>{n.viewCount}</Td>
                      <Td right mono col={n.commentCount > 0 ? BLUE : SUBTLE}>{n.commentCount}</Td>
                      <Td mono col={SUBTLE}>{n.updatedAt}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Title</Th><Th>Type</Th><Th>Priority</Th><Th>Status</Th><Th>Requested By</Th><Th>Assigned To</Th><Th right>Comments</Th><Th>Due</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews â€” check /api/v4/collaboration/reviews</td></tr>}
                {reviews.sort((a, b) => { const o: Record<string, number> = { pending: 0, in_review: 1, needs_revision: 2, approved: 3, rejected: 4 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((r, i) => (
                  <tr key={i} style={{ background: r.priority === 'urgent' && (r.status === 'pending' || r.status === 'in_review') ? RED + '0a' : 'transparent' }}>
                    <Td><span style={{ fontSize: 11, color: TEXT }}>{r.title}</span></Td>
                    <Td mono col={SUBTLE}>{r.type}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.priority === 'urgent' ? RED : r.priority === 'high' ? ORANGE : r.priority === 'normal' ? BLUE : SUBTLE }}>{r.priority.toUpperCase()}</span></Td>
                    <Td><ReviewStatusBadge s={r.status} /></Td>
                    <Td mono col={BLUE}>{r.requestedBy}</Td>
                    <Td mono col={PURPLE}>{r.assignedTo}</Td>
                    <Td right mono col={r.commentCount > 0 ? BLUE : SUBTLE}>{r.commentCount}</Td>
                    <Td mono col={SUBTLE}>{r.dueDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'annotations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Type</Th><Th right>Price</Th><Th>Text</Th><Th>Author</Th><Th>Visible</Th><Th right>Shared With</Th><Th>Created</Th></tr></thead>
              <tbody>
                {annotations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No annotations â€” check /api/v4/collaboration/annotations</td></tr>}
                {annotations.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.symbol}</Td>
                    <Td><AnnoBadge t={a.annotationType} /></Td>
                    <Td right mono col={BLUE}>{a.price.toFixed(4)}</Td>
                    <Td><span style={{ fontSize: 10, color: TEXT }}>{a.text}</span></Td>
                    <Td mono col={BLUE}>{a.author}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.visible ? GREEN : SUBTLE }}>{a.visible ? 'VISIBLE' : 'HIDDEN'}</span></Td>
                    <Td right mono col={SUBTLE}>{a.sharedWith.length}</Td>
                    <Td mono col={SUBTLE}>{a.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'team' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Current Activity</Th><Th right>Notes</Th><Th right>Reviews</Th><Th right>Workspaces</Th><Th>Last Seen</Th></tr></thead>
              <tbody>
                {team.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No team members â€” check /api/v4/collaboration/team</td></tr>}
                {team.sort((a, b) => { const o: Record<string, number> = { online: 0, busy: 1, away: 2, offline: 3 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((m, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}><span style={{ display: 'flex', alignItems: 'center' }}><StatusDot s={m.status} />{m.displayName}</span></Td>
                    <Td mono col={BLUE}>{m.role}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: m.status === 'online' ? GREEN : m.status === 'away' ? AMBER : m.status === 'busy' ? RED : SUBTLE }}>{m.status.toUpperCase()}</span></Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{m.currentActivity || 'â€”'}</span></Td>
                    <Td right mono col={m.notesCount > 0 ? BLUE : SUBTLE}>{m.notesCount}</Td>
                    <Td right mono col={m.reviewsCompleted > 0 ? GREEN : SUBTLE}>{m.reviewsCompleted}</Td>
                    <Td right mono col={PURPLE}>{m.workspaces.length}</Td>
                    <Td mono col={SUBTLE}>{m.lastSeen}</Td>
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
