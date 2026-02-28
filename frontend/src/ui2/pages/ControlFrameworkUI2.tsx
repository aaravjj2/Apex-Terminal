import React, { useState, useEffect, useCallback } from 'react'
﻿// ControlFrameworkUI2 â€” Bloomberg CTFW control framework terminal
// Maturity assessment, control objectives, gap analysis, evidence tracking, signoff
// Tabs: CONTROLS | MATURITY | GAPS | EVIDENCE | SIGNOFFS
// APIs: /api/v4/control-framework/controls, /maturity, /gaps, /evidence, /signoffs

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

interface ControlEntry {
  id: string
  domain: string
  objective: string
  controlType: 'preventive' | 'detective' | 'corrective' | 'directive'
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  status: 'effective' | 'partially_effective' | 'ineffective' | 'not_tested'
  owner: string
  lastTested: string
  nextTest: string
  framework: string
}

interface MaturityEntry {
  domain: string
  currentLevel: number
  targetLevel: number
  gap: number
  score: number
  strength: string
  weakness: string
  roadmapItems: number
}

interface GapEntry {
  id: string
  domain: string
  requirement: string
  currentState: string
  targetState: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediationDate: string
  owner: string
  status: 'open' | 'in_progress' | 'remediated' | 'accepted'
  effort: string
}

interface EvidenceEntry {
  id: string
  controlId: string
  controlName: string
  evidenceType: string
  collectedAt: string
  collectedBy: string
  status: 'accepted' | 'rejected' | 'pending_review'
  reviewedBy?: string
  expiresAt: string
}

interface SignoffEntry {
  id: string
  framework: string
  scope: string
  signedBy: string
  role: string
  signedAt: string
  period: string
  status: 'signed' | 'pending' | 'expired' | 'rejected'
  comments: string
  nextDue: string
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

function ControlStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { effective: GREEN, partially_effective: AMBER, ineffective: RED, not_tested: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}

function CtrlTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { preventive: GREEN, detective: BLUE, corrective: ORANGE, directive: PURPLE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.toUpperCase()}</span>
}

function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function MaturityBar({ current, target }: { current: number; target: number }) {
  const pct = (current / 5) * 100
  const tPct = (target / 5) * 100
  const c = current >= target ? GREEN : current >= target - 1 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 90, height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 4 }} />
        <div style={{ position: 'absolute', top: 0, left: `${tPct}%`, width: 2, height: '100%', background: SUBTLE }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{current}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>/{target}</span>
    </div>
  )
}


export function ControlFrameworkUI2() {
  const [tab, setTab] = useState<'controls' | 'maturity' | 'gaps' | 'evidence' | 'signoffs'>('controls')
  const [controls, setControls] = useState<ControlEntry[]>([])
  const [maturity, setMaturity] = useState<MaturityEntry[]>([])
  const [gaps, setGaps] = useState<GapEntry[]>([])
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([])
  const [signoffs, setSignoffs] = useState<SignoffEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [ctrlFilter, setCtrlFilter] = useState<string>('all')
  const [gapFilter, setGapFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rC, rM, rG, rE, rS] = await Promise.allSettled([
        fetch('/api/v4/control-framework/controls').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-framework/maturity').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-framework/gaps').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-framework/evidence').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-framework/signoffs').then(r => r.ok ? r.json() : []),
      ])
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.controls ?? rC.value.data ?? []
        setControls(raw.map((c: any) => ({
          id: c.id ?? '', domain: c.domain ?? '', objective: c.objective ?? '',
          controlType: c.control_type ?? c.controlType ?? 'preventive',
          frequency: c.frequency ?? 'monthly', status: c.status ?? 'not_tested',
          owner: c.owner ?? '', lastTested: c.last_tested ?? c.lastTested ?? '',
          nextTest: c.next_test ?? c.nextTest ?? '', framework: c.framework ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load controls')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.maturity ?? rM.value.data ?? []
        setMaturity(raw.map((m: any) => ({
          domain: m.domain ?? '', currentLevel: Number(m.current_level ?? m.currentLevel ?? 0),
          targetLevel: Number(m.target_level ?? m.targetLevel ?? 3), gap: Number(m.gap ?? 0),
          score: Number(m.score ?? 0), strength: m.strength ?? '', weakness: m.weakness ?? '',
          roadmapItems: Number(m.roadmap_items ?? m.roadmapItems ?? 0),
        })))
      }
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.gaps ?? rG.value.data ?? []
        setGaps(raw.map((g: any) => ({
          id: g.id ?? '', domain: g.domain ?? '', requirement: g.requirement ?? '',
          currentState: g.current_state ?? g.currentState ?? '', targetState: g.target_state ?? g.targetState ?? '',
          severity: g.severity ?? 'medium', remediationDate: g.remediation_date ?? g.remediationDate ?? '',
          owner: g.owner ?? '', status: g.status ?? 'open', effort: g.effort ?? '',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.evidence ?? rE.value.data ?? []
        setEvidence(raw.map((e: any) => ({
          id: e.id ?? '', controlId: e.control_id ?? e.controlId ?? '', controlName: e.control_name ?? e.controlName ?? '',
          evidenceType: e.evidence_type ?? e.evidenceType ?? '', collectedAt: e.collected_at ?? e.collectedAt ?? '',
          collectedBy: e.collected_by ?? e.collectedBy ?? '', status: e.status ?? 'pending_review',
          reviewedBy: e.reviewed_by ?? e.reviewedBy, expiresAt: e.expires_at ?? e.expiresAt ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.signoffs ?? rS.value.data ?? []
        setSignoffs(raw.map((s: any) => ({
          id: s.id ?? '', framework: s.framework ?? '', scope: s.scope ?? '',
          signedBy: s.signed_by ?? s.signedBy ?? '', role: s.role ?? '', signedAt: s.signed_at ?? s.signedAt ?? '',
          period: s.period ?? '', status: s.status ?? 'pending', comments: s.comments ?? '',
          nextDue: s.next_due ?? s.nextDue ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 60000); return () => clearInterval(id) }, [fetchAll])

  const ineffective = controls.filter(c => c.status === 'ineffective').length
  const critGaps = gaps.filter(g => g.severity === 'critical' && g.status !== 'remediated').length
  const pendingSignoffs = signoffs.filter(s => s.status === 'pending').length
  const pendingEvidence = evidence.filter(e => e.status === 'pending_review').length
  const filteredControls = controls.filter(c => ctrlFilter === 'all' || c.status === ctrlFilter)
  const filteredGaps = gaps.filter(g => gapFilter === 'all' || g.severity === gapFilter)

  const TABS = [
    { id: 'controls' as const, label: 'CONTROLS' },
    { id: 'maturity' as const, label: 'MATURITY' },
    { id: 'gaps' as const, label: 'GAPS' },
    { id: 'evidence' as const, label: 'EVIDENCE' },
    { id: 'signoffs' as const, label: 'SIGNOFFS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CTFW</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CONTROL FRAMEWORK â€” CONTROLS + MATURITY + GAP ANALYSIS + EVIDENCE + SIGNOFFS</span>
        {ineffective > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {ineffective} INEFFECTIVE CONTROLS</span>}
        {critGaps > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {critGaps} CRITICAL GAPS</span>}
        {pendingSignoffs > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {pendingSignoffs} PENDING SIGNOFFS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Controls" value={controls.length} col={BLUE} />
        <StatCard label="Ineffective" value={ineffective} col={ineffective > 0 ? RED : GREEN} />
        <StatCard label="Critical Gaps" value={critGaps} col={critGaps > 0 ? RED : GREEN} />
        <StatCard label="Pending Evidence" value={pendingEvidence} col={pendingEvidence > 0 ? AMBER : GREEN} />
        <StatCard label="Pending Signoffs" value={pendingSignoffs} col={pendingSignoffs > 0 ? AMBER : GREEN} />
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

        {tab === 'controls' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['all', 'effective', 'partially_effective', 'ineffective', 'not_tested'].map(s => (
                <button key={s} onClick={() => setCtrlFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: ctrlFilter === s ? AMBER : SUBTLE, background: ctrlFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${ctrlFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Domain</Th><Th>Objective</Th><Th>Type</Th><Th>Status</Th><Th>Frequency</Th><Th>Owner</Th><Th>Last Tested</Th><Th>Framework</Th></tr></thead>
                <tbody>
                  {filteredControls.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No controls â€” check /api/v4/control-framework/controls</td></tr>}
                  {filteredControls.map((c, i) => (
                    <tr key={i} style={{ background: c.status === 'ineffective' ? RED + '0a' : 'transparent' }}>
                      <Td mono col={AMBER}>{c.domain}</Td>
                      <Td><span style={{ fontSize: 11, color: TEXT }}>{c.objective}</span></Td>
                      <Td><CtrlTypeBadge t={c.controlType} /></Td>
                      <Td><ControlStatusBadge s={c.status} /></Td>
                      <Td mono col={SUBTLE}>{c.frequency}</Td>
                      <Td mono col={BLUE}>{c.owner}</Td>
                      <Td mono col={SUBTLE}>{c.lastTested}</Td>
                      <Td mono col={SUBTLE}>{c.framework}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'maturity' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Domain</Th><Th>Maturity Level</Th><Th right>Gap</Th><Th right>Score</Th><Th right>Roadmap Items</Th><Th>Strength</Th><Th>Weakness</Th></tr></thead>
              <tbody>
                {maturity.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No maturity data â€” check /api/v4/control-framework/maturity</td></tr>}
                {maturity.sort((a, b) => b.gap - a.gap).map((m, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{m.domain}</Td>
                    <Td><MaturityBar current={m.currentLevel} target={m.targetLevel} /></Td>
                    <Td right mono col={m.gap > 1 ? RED : m.gap > 0 ? AMBER : GREEN}>{m.gap.toFixed(1)}</Td>
                    <Td right mono col={m.score >= 80 ? GREEN : m.score >= 60 ? AMBER : RED}>{m.score.toFixed(0)}</Td>
                    <Td right mono col={m.roadmapItems > 0 ? BLUE : SUBTLE}>{m.roadmapItems}</Td>
                    <Td><span style={{ fontSize: 10, color: GREEN }}>{m.strength || 'â€”'}</span></Td>
                    <Td><span style={{ fontSize: 10, color: ORANGE }}>{m.weakness || 'â€”'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gaps' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                <button key={s} onClick={() => setGapFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: gapFilter === s ? AMBER : SUBTLE, background: gapFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${gapFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Domain</Th><Th>Requirement</Th><Th>Severity</Th><Th>Status</Th><Th>Owner</Th><Th>Effort</Th><Th>Target Date</Th></tr></thead>
                <tbody>
                  {filteredGaps.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No gaps â€” check /api/v4/control-framework/gaps</td></tr>}
                  {filteredGaps.sort((a, b) => { const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }; return (o[a.severity] ?? 9) - (o[b.severity] ?? 9) }).map((g, i) => (
                    <tr key={i} style={{ background: g.severity === 'critical' && g.status !== 'remediated' ? RED + '0a' : 'transparent' }}>
                      <Td mono col={AMBER}>{g.domain}</Td>
                      <Td><span style={{ fontSize: 11, color: TEXT }}>{g.requirement}</span></Td>
                      <Td><SeverityBadge s={g.severity} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: g.status === 'remediated' ? GREEN : g.status === 'in_progress' ? BLUE : g.status === 'accepted' ? PURPLE : AMBER }}>{g.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td mono col={BLUE}>{g.owner}</Td>
                      <Td mono col={SUBTLE}>{g.effort}</Td>
                      <Td mono col={SUBTLE}>{g.remediationDate}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'evidence' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Control</Th><Th>Evidence Type</Th><Th>Status</Th><Th>Collected By</Th><Th>Collected At</Th><Th>Reviewed By</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {evidence.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No evidence â€” check /api/v4/control-framework/evidence</td></tr>}
                {evidence.map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'rejected' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.controlName || e.controlId}</Td>
                    <Td mono col={BLUE}>{e.evidenceType}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.status === 'accepted' ? GREEN : e.status === 'rejected' ? RED : AMBER }}>{e.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                    <Td mono col={BLUE}>{e.collectedBy}</Td>
                    <Td mono col={SUBTLE}>{e.collectedAt}</Td>
                    <Td mono col={SUBTLE}>{e.reviewedBy ?? 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'signoffs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Framework</Th><Th>Scope</Th><Th>Period</Th><Th>Status</Th><Th>Signed By</Th><Th>Role</Th><Th>Signed At</Th><Th>Next Due</Th></tr></thead>
              <tbody>
                {signoffs.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No signoffs â€” check /api/v4/control-framework/signoffs</td></tr>}
                {signoffs.sort((a, b) => { const o: Record<string, number> = { pending: 0, expired: 1, signed: 2, rejected: 3 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.framework}</Td>
                    <Td mono col={SUBTLE}>{s.scope}</Td>
                    <Td mono col={SUBTLE}>{s.period}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.status === 'signed' ? GREEN : s.status === 'pending' ? AMBER : s.status === 'expired' ? ORANGE : RED }}>{s.status.toUpperCase()}</span></Td>
                    <Td mono col={BLUE}>{s.signedBy || 'â€”'}</Td>
                    <Td mono col={PURPLE}>{s.role}</Td>
                    <Td mono col={SUBTLE}>{s.signedAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{s.nextDue}</Td>
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
