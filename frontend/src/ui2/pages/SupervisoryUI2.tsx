import React, { useState, useEffect, useCallback } from 'react'
﻿// SupervisoryUI2 — Bloomberg APEX supervisory terminal
// KPI monitoring, escalation management, supervisory review workflows, breach tracking
// Tabs: REVIEWS | KPIs | ESCALATIONS | SURVEILLANCE | AUDIT
// APIs: /api/v4/supervisory/reviews, /kpis, /escalations, /surveillance, /audit

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

interface SupervisoryReview {
  reviewId: string
  subject: string
  category: 'trade' | 'communication' | 'compliance' | 'conduct' | 'risk' | 'performance'
  status: 'pending' | 'in_review' | 'escalated' | 'closed' | 'archived'
  priority: 'critical' | 'high' | 'medium' | 'low'
  supervisor: string
  reviewee: string
  daysOpen: number
  score: number
  flagCount: number
  resolvedAt: string
  dueDate: string
}

interface SupervisoryKpi {
  kpiId: string
  name: string
  category: 'oversight' | 'compliance' | 'risk' | 'performance' | 'conduct'
  currentValue: number
  targetValue: number
  redLineValue: number
  unit: string
  trend: 'up' | 'down' | 'flat'
  status: 'ok' | 'warning' | 'breach'
  lastUpdated: string
  period: string
}

interface SupervisoryEscalation {
  escalationId: string
  reviewId: string
  reason: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  escalatedTo: string
  escalatedBy: string
  daysOpen: number
  status: 'open' | 'in_review' | 'resolved' | 'closed'
  regulatoryNotification: boolean
  targetDate: string
}

interface SurveillanceAlert {
  alertId: string
  alertType: string
  entity: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'new' | 'investigating' | 'cleared' | 'escalated' | 'false_positive'
  detectedAt: string
  assignedTo: string
  source: string
}

interface SupervisoryAuditEntry {
  auditId: string
  reviewId: string
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
  const m: Record<string, string> = { ok: GREEN, pending: BLUE, in_review: AMBER, escalated: RED, closed: SUBTLE, archived: SUBTLE, warning: AMBER, breach: RED, open: RED, resolved: GREEN, investigating: AMBER, cleared: GREEN, false_positive: SUBTLE, new: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function PrioBadge({ p }: { p: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { trade: BLUE, communication: PURPLE, compliance: RED, conduct: ORANGE, risk: AMBER, performance: GREEN, oversight: BLUE }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function TrendArrow({ t }: { t: string }) {
  const m: Record<string, { symbol: string; col: string }> = { up: { symbol: '▲', col: GREEN }, down: { symbol: '▼', col: RED }, flat: { symbol: '—', col: SUBTLE } }
  const { symbol, col } = m[t] ?? { symbol: '—', col: SUBTLE }
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{symbol}</span>
}


export function SupervisoryUI2() {
  const [tab, setTab] = useState<'reviews' | 'kpis' | 'escalations' | 'surveillance' | 'audit'>('reviews')
  const [reviews, setReviews] = useState<SupervisoryReview[]>([])
  const [kpis, setKpis] = useState<SupervisoryKpi[]>([])
  const [escalations, setEscalations] = useState<SupervisoryEscalation[]>([])
  const [surveillance, setSurveillance] = useState<SurveillanceAlert[]>([])
  const [auditLog, setAuditLog] = useState<SupervisoryAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rK, rE, rS, rA] = await Promise.allSettled([
        fetch('/api/v4/supervisory/reviews').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/supervisory/kpis').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/supervisory/escalations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/supervisory/surveillance').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/supervisory/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviews ?? rR.value.data ?? []
        setReviews(raw.map((r: any) => ({
          reviewId: r.review_id ?? r.reviewId ?? '', subject: r.subject ?? '',
          category: r.category ?? 'compliance', status: r.status ?? 'pending',
          priority: r.priority ?? 'medium', supervisor: r.supervisor ?? '',
          reviewee: r.reviewee ?? '', daysOpen: Number(r.days_open ?? r.daysOpen ?? 0),
          score: Number(r.score ?? 0), flagCount: Number(r.flag_count ?? r.flagCount ?? 0),
          resolvedAt: r.resolved_at ?? r.resolvedAt ?? '', dueDate: r.due_date ?? r.dueDate ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load reviews')
      if (rK.status === 'fulfilled') {
        const raw = Array.isArray(rK.value) ? rK.value : rK.value.kpis ?? rK.value.data ?? []
        setKpis(raw.map((k: any) => ({
          kpiId: k.kpi_id ?? k.kpiId ?? '', name: k.name ?? '',
          category: k.category ?? 'oversight', currentValue: Number(k.current_value ?? k.currentValue ?? 0),
          targetValue: Number(k.target_value ?? k.targetValue ?? 0),
          redLineValue: Number(k.red_line_value ?? k.redLineValue ?? 0),
          unit: k.unit ?? '', trend: k.trend ?? 'flat', status: k.status ?? 'ok',
          lastUpdated: k.last_updated ?? k.lastUpdated ?? '', period: k.period ?? '',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.escalations ?? rE.value.data ?? []
        setEscalations(raw.map((e: any) => ({
          escalationId: e.escalation_id ?? e.escalationId ?? '', reviewId: e.review_id ?? e.reviewId ?? '',
          reason: e.reason ?? '', severity: e.severity ?? 'medium',
          escalatedTo: e.escalated_to ?? e.escalatedTo ?? '', escalatedBy: e.escalated_by ?? e.escalatedBy ?? '',
          daysOpen: Number(e.days_open ?? e.daysOpen ?? 0), status: e.status ?? 'open',
          regulatoryNotification: Boolean(e.regulatory_notification ?? e.regulatoryNotification),
          targetDate: e.target_date ?? e.targetDate ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.alerts ?? rS.value.data ?? []
        setSurveillance(raw.map((s: any) => ({
          alertId: s.alert_id ?? s.alertId ?? '', alertType: s.alert_type ?? s.alertType ?? '',
          entity: s.entity ?? '', description: s.description ?? '',
          severity: s.severity ?? 'medium', status: s.status ?? 'new',
          detectedAt: s.detected_at ?? s.detectedAt ?? '', assignedTo: s.assigned_to ?? s.assignedTo ?? '',
          source: s.source ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', reviewId: a.review_id ?? a.reviewId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const criticalEscalations = escalations.filter(e => e.severity === 'critical').length
  const kpiBreaches = kpis.filter(k => k.status === 'breach').length
  const openAlerts = surveillance.filter(s => s.status === 'new' || s.status === 'investigating').length
  const pendingReviews = reviews.filter(r => r.status === 'pending' || r.status === 'in_review').length

  const TABS2 = [
    { id: 'reviews' as const, label: 'REVIEWS' },
    { id: 'kpis' as const, label: 'KPIs' },
    { id: 'escalations' as const, label: 'ESCALATIONS' },
    { id: 'surveillance' as const, label: 'SURVEILLANCE' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SUPERVISORY — KPI MONITORING + ESCALATION MANAGEMENT + SURVEILLANCE</span>
        {criticalEscalations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚑ {criticalEscalations} CRITICAL</span>}
        {kpiBreaches > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚑ {kpiBreaches} KPI BREACH</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Pending Reviews" value={pendingReviews} col={pendingReviews > 0 ? AMBER : GREEN} />
        <StatCard label="KPI Breaches" value={kpiBreaches} col={kpiBreaches > 0 ? RED : GREEN} />
        <StatCard label="Critical Escalations" value={criticalEscalations} col={criticalEscalations > 0 ? RED : GREEN} />
        <StatCard label="Open Alerts" value={openAlerts} col={openAlerts > 0 ? ORANGE : GREEN} />
        <StatCard label="Regulatory Notified" value={escalations.filter(e => e.regulatoryNotification).length} col={PURPLE} />
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

        {tab === 'reviews' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Review ID</Th><Th>Subject</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Supervisor</Th><Th>Reviewee</Th><Th right>Days Open</Th><Th right>Flags</Th><Th>Due Date</Th></tr></thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviews — check /api/v4/supervisory/reviews</td></tr>}
                {reviews.sort((a, b) => b.daysOpen - a.daysOpen).map((r, i) => (
                  <tr key={i} style={{ background: r.priority === 'critical' ? RED + '0a' : r.status === 'escalated' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reviewId}</Td>
                    <Td mono col={TEXT}>{r.subject.length > 30 ? r.subject.slice(0, 30) + '…' : r.subject}</Td>
                    <Td><CatBadge c={r.category} /></Td>
                    <Td><PrioBadge p={r.priority} /></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td mono col={TEXT}>{r.supervisor}</Td>
                    <Td mono col={BLUE}>{r.reviewee}</Td>
                    <Td right mono col={r.daysOpen > 14 ? RED : r.daysOpen > 7 ? AMBER : TEXT}>{r.daysOpen}</Td>
                    <Td right mono col={r.flagCount > 0 ? RED : GREEN}>{r.flagCount}</Td>
                    <Td mono col={SUBTLE}>{r.dueDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'kpis' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>KPI Name</Th><Th>Category</Th><Th>Status</Th><Th>Trend</Th><Th right>Current</Th><Th right>Target</Th><Th right>Red Line</Th><Th>Unit</Th><Th>Period</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {kpis.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No KPIs — check /api/v4/supervisory/kpis</td></tr>}
                {kpis.sort((a, b) => (b.status === 'breach' ? 1 : 0) - (a.status === 'breach' ? 1 : 0)).map((k, i) => (
                  <tr key={i} style={{ background: k.status === 'breach' ? RED + '0a' : k.status === 'warning' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{k.name}</Td>
                    <Td><CatBadge c={k.category} /></Td>
                    <Td><StatusBadge s={k.status} /></Td>
                    <Td><TrendArrow t={k.trend} /></Td>
                    <Td right mono col={k.status === 'breach' ? RED : k.status === 'warning' ? AMBER : GREEN}>{k.currentValue.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{k.targetValue.toLocaleString()}</Td>
                    <Td right mono col={RED}>{k.redLineValue.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{k.unit}</Td>
                    <Td mono col={SUBTLE}>{k.period}</Td>
                    <Td mono col={SUBTLE}>{k.lastUpdated || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'escalations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Review ID</Th><Th>Reason</Th><Th>Severity</Th><Th>Status</Th><Th>Escalated To</Th><Th>By</Th><Th right>Days Open</Th><Th>Reg Notif</Th><Th>Target</Th></tr></thead>
              <tbody>
                {escalations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No escalations — check /api/v4/supervisory/escalations</td></tr>}
                {escalations.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)).map((e, i) => (
                  <tr key={i} style={{ background: e.severity === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.escalationId}</Td>
                    <Td mono col={BLUE}>{e.reviewId || '—'}</Td>
                    <Td mono col={TEXT}>{e.reason.length > 35 ? e.reason.slice(0, 35) + '…' : e.reason}</Td>
                    <Td><PrioBadge p={e.severity} /></Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td mono col={TEXT}>{e.escalatedTo}</Td>
                    <Td mono col={SUBTLE}>{e.escalatedBy}</Td>
                    <Td right mono col={e.daysOpen > 7 ? RED : TEXT}>{e.daysOpen}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.regulatoryNotification ? RED : SUBTLE }}>{e.regulatoryNotification ? '✓ YES' : '—'}</span></Td>
                    <Td mono col={SUBTLE}>{e.targetDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'surveillance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Alert ID</Th><Th>Type</Th><Th>Entity</Th><Th>Severity</Th><Th>Status</Th><Th>Description</Th><Th>Source</Th><Th>Assigned To</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {surveillance.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts — check /api/v4/supervisory/surveillance</td></tr>}
                {surveillance.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)).map((s, i) => (
                  <tr key={i} style={{ background: s.severity === 'critical' ? RED + '0a' : s.status === 'investigating' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.alertId}</Td>
                    <Td mono col={BLUE}>{s.alertType}</Td>
                    <Td mono col={TEXT}>{s.entity}</Td>
                    <Td><PrioBadge p={s.severity} /></Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td mono col={SUBTLE}>{s.description.length > 35 ? s.description.slice(0, 35) + '…' : s.description}</Td>
                    <Td mono col={PURPLE}>{s.source || '—'}</Td>
                    <Td mono col={TEXT}>{s.assignedTo || '—'}</Td>
                    <Td mono col={SUBTLE}>{s.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Review ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/supervisory/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.reviewId || '—'}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || '—'}</Td>
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
