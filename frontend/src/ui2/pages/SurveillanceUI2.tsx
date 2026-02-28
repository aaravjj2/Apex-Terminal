import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// SurveillanceUI2 — Bloomberg SRVY-grade post-trade surveillance terminal
// Pattern detection, spoofing/layering/marking detection, compliance alerting
// Tabs: LIVE ALERTS | INVESTIGATIONS | PATTERNS | TRADER ACTIVITY | REPORTS
// APIs: /api/v4/surveillance/alerts, /investigations, /patterns, /activity, /reports

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

type AlertType = 'spoofing' | 'layering' | 'wash_trading' | 'marking' | 'front_running' | 'insider_trading' | 'momentum_ignition' | 'fat_finger' | 'unusual_volume'
type AlertStatus = 'open' | 'investigating' | 'escalated' | 'closed' | 'false_positive'
type Severity = 'critical' | 'high' | 'medium' | 'low'

interface SurveillanceAlert {
  alertId: string
  alertType: AlertType
  severity: Severity
  status: AlertStatus
  symbol: string
  trader: string
  account: string
  detectedAt: string
  description: string
  confidence: number
  estimatedImpact: number
  ordersInvolved: number
  regulatoryFlag: boolean
}

interface Investigation {
  caseId: string
  alertId: string
  assignedTo: string
  openedAt: string
  resolvedAt: string | null
  status: 'open' | 'pending_review' | 'submitted' | 'closed'
  priority: Severity
  findings: string
  symbol: string
  trader: string
  regulatoryReport: boolean
}

interface SurveillancePattern {
  patternId: string
  name: string
  patternType: AlertType
  detectionCount: number
  lastDetected: string
  avgConfidence: number
  description: string
  indicators: string[]
  active: boolean
}

interface TraderActivity {
  trader: string
  account: string
  alertCount: number
  openAlerts: number
  lastAlert: string
  riskScore: number
  totalNotional: number
  cancelRate: number
  orderToFillRatio: number
  suspiciousPatterns: string[]
}

interface SurveillanceReport {
  reportId: string
  reportType: string
  period: string
  generatedAt: string
  alertCount: number
  investigationCount: number
  submittedToRegulator: boolean
  summary: string
}

// ── sub-components ──────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col, style: sx }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string; style?: React.CSSProperties }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap', ...sx }}>{children}</td>
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

function SevBadge({ sev }: { sev: Severity }) {
  const c = sev === 'critical' ? '#b71c1c' : sev === 'high' ? RED : sev === 'medium' ? AMBER : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{sev.toUpperCase()}</span>
}

function AlertTypeBadge({ type }: { type: AlertType }) {
  const colors: Record<AlertType, string> = {
    spoofing: RED, layering: ORANGE, wash_trading: PURPLE, marking: AMBER,
    front_running: '#b71c1c', insider_trading: '#b71c1c', momentum_ignition: ORANGE,
    fat_finger: BLUE, unusual_volume: SUBTLE,
  }
  const c = colors[type] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 8, color: c, background: c + '22', padding: '2px 5px', borderRadius: 2 }}>{type.replace(/_/g, ' ').toUpperCase()}</span>
}

function StatusBadgeSrvy({ status }: { status: AlertStatus }) {
  const c = status === 'open' ? RED : status === 'investigating' ? AMBER : status === 'escalated' ? ORANGE : status === 'closed' ? GREEN : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{status.replace(/_/g, ' ').toUpperCase()}</span>
}

function ConfBar({ pct }: { pct: number }) {
  const c = pct > 80 ? RED : pct > 60 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 55, height: 5, background: BORDER, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function RiskScoreBar({ score }: { score: number }) {
  const c = score > 80 ? RED : score > 60 ? AMBER : score > 40 ? ORANGE : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 55, height: 5, background: BORDER, borderRadius: 3 }}>
        <div style={{ width: `${score}%`, height: '100%', background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{score.toFixed(0)}</span>
    </div>
  )
}


export function SurveillanceUI2() {
  const [tab, setTab] = useState<'alerts' | 'investigations' | 'patterns' | 'activity' | 'reports'>('alerts')
  const [alerts, setAlerts] = useState<SurveillanceAlert[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [patterns, setPatterns] = useState<SurveillancePattern[]>([])
  const [activity, setActivity] = useState<TraderActivity[]>([])
  const [reports, setReports] = useState<SurveillanceReport[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rAl, rIn, rPa, rAc, rRe] = await Promise.allSettled([
        fetch('/api/v4/surveillance/alerts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/surveillance/investigations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/surveillance/patterns').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/surveillance/activity').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/surveillance/reports').then(r => r.ok ? r.json() : []),
      ])
      if (rAl.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAl.value) ? rAl.value : rAl.value.alerts ?? rAl.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          alertId: a.alert_id ?? a.id ?? '', alertType: (a.alert_type ?? a.type ?? 'unusual_volume') as AlertType,
          severity: (a.severity ?? 'medium') as Severity, status: (a.status ?? 'open') as AlertStatus,
          symbol: a.symbol ?? '', trader: a.trader ?? a.trader_id ?? '',
          account: a.account ?? '', detectedAt: a.detected_at ?? a.created_at ?? '',
          description: a.description ?? '', confidence: Number(a.confidence ?? 0),
          estimatedImpact: Number(a.estimated_impact ?? 0), ordersInvolved: Number(a.orders_involved ?? 0),
          regulatoryFlag: Boolean(a.regulatory_flag ?? false),
        })))
        setErr(null)
      } else setErr('Failed to load surveillance data')
      if (rIn.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rIn.value) ? rIn.value : rIn.value.investigations ?? rIn.value.data ?? []
        setInvestigations(raw.map((i: any) => ({
          caseId: i.case_id ?? i.id ?? '', alertId: i.alert_id ?? '',
          assignedTo: i.assigned_to ?? i.assignee ?? '', openedAt: i.opened_at ?? '',
          resolvedAt: i.resolved_at ?? null, status: (i.status ?? 'open') as Investigation['status'],
          priority: (i.priority ?? 'medium') as Severity, findings: i.findings ?? '',
          symbol: i.symbol ?? '', trader: i.trader ?? '',
          regulatoryReport: Boolean(i.regulatory_report ?? false),
        })))
      }
      if (rPa.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rPa.value) ? rPa.value : rPa.value.patterns ?? rPa.value.data ?? []
        setPatterns(raw.map((p: any) => ({
          patternId: p.pattern_id ?? p.id ?? '', name: p.name ?? '',
          patternType: (p.pattern_type ?? p.type ?? 'unusual_volume') as AlertType,
          detectionCount: Number(p.detection_count ?? 0), lastDetected: p.last_detected ?? '',
          avgConfidence: Number(p.avg_confidence ?? 0), description: p.description ?? '',
          indicators: Array.isArray(p.indicators) ? p.indicators : [], active: Boolean(p.active ?? true),
        })))
      }
      if (rAc.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rAc.value) ? rAc.value : rAc.value.activity ?? rAc.value.data ?? []
        setActivity(raw.map((a: any) => ({
          trader: a.trader ?? a.trader_id ?? '', account: a.account ?? '',
          alertCount: Number(a.alert_count ?? 0), openAlerts: Number(a.open_alerts ?? 0),
          lastAlert: a.last_alert ?? '', riskScore: Number(a.risk_score ?? 0),
          totalNotional: Number(a.total_notional ?? 0), cancelRate: Number(a.cancel_rate ?? 0),
          orderToFillRatio: Number(a.order_to_fill_ratio ?? a.otf_ratio ?? 0),
          suspiciousPatterns: Array.isArray(a.suspicious_patterns) ? a.suspicious_patterns : [],
        })))
      }
      if (rRe.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rRe.value) ? rRe.value : rRe.value.reports ?? rRe.value.data ?? []
        setReports(raw.map((r: any) => ({
          reportId: r.report_id ?? r.id ?? '', reportType: r.report_type ?? r.type ?? '',
          period: r.period ?? '', generatedAt: r.generated_at ?? '',
          alertCount: Number(r.alert_count ?? 0), investigationCount: Number(r.investigation_count ?? 0),
          submittedToRegulator: Boolean(r.submitted_to_regulator ?? false), summary: r.summary ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const openAlerts = alerts.filter(a => a.status === 'open' || a.status === 'escalated')
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const regulatoryFlags = alerts.filter(a => a.regulatoryFlag)
  const highRiskTraders = activity.filter(t => t.riskScore > 70).length

  const visAlerts = alerts.filter(a =>
    (sevFilter === 'all' || a.severity === sevFilter) &&
    (statusFilter === 'all' || a.status === statusFilter)
  ).sort((a, b) => {
    const s: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return s[a.severity] - s[b.severity]
  })

  const TABS = [
    { id: 'alerts' as const, label: `LIVE ALERTS (${openAlerts.length})${criticalAlerts.length ? ` ⚠${criticalAlerts.length}` : ''}` },
    { id: 'investigations' as const, label: `INVESTIGATIONS (${investigations.filter(i => i.status !== 'closed').length})` },
    { id: 'patterns' as const, label: 'PATTERNS' },
    { id: 'activity' as const, label: `TRADER ACTIVITY${highRiskTraders > 0 ? ` (${highRiskTraders} HIGH RISK)` : ''}` },
    { id: 'reports' as const, label: 'REPORTS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>SRVY</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SURVEILLANCE — POST-TRADE PATTERN DETECTION + COMPLIANCE ALERTING</span>
        {regulatoryFlags.length > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>🚩 {regulatoryFlags.length} REGULATORY FLAGS</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Open Alerts" value={openAlerts.length} col={openAlerts.length > 0 ? RED : GREEN} />
        <StatCard label="Critical" value={criticalAlerts.length} col={criticalAlerts.length > 0 ? '#b71c1c' : SUBTLE} />
        <StatCard label="Active Investigations" value={investigations.filter(i => i.status === 'open').length} col={AMBER} />
        <StatCard label="Regulatory Flags" value={regulatoryFlags.length} col={regulatoryFlags.length > 0 ? RED : SUBTLE} />
        <StatCard label="High Risk Traders" value={highRiskTraders} col={highRiskTraders > 0 ? ORANGE : SUBTLE} />
        <StatCard label="Active Patterns" value={patterns.filter(p => p.active).length} col={BLUE} />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      {tab === 'alerts' && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
            <button key={s} onClick={() => setSevFilter(s as any)}
              style={{ fontFamily: MONO, fontSize: 10, color: sevFilter === s ? AMBER : SUBTLE, background: sevFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${sevFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {s.toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, background: BORDER, margin: '0 4px' }} />
          {(['all', 'open', 'investigating', 'escalated', 'closed', 'false_positive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s as any)}
              style={{ fontFamily: MONO, fontSize: 10, color: statusFilter === s ? AMBER : SUBTLE, background: statusFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${statusFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {s.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading surveillance data...</div>}

        {/* LIVE ALERTS */}
        {tab === 'alerts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Type</Th><Th>Severity</Th><Th>Symbol</Th><Th>Trader</Th>
                <Th>Confidence</Th><Th right>Impact</Th><Th right>Orders</Th>
                <Th>Reg Flag</Th><Th>Status</Th><Th>Detected</Th><Th>Description</Th>
              </tr></thead>
              <tbody>
                {visAlerts.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts — check /api/v4/surveillance/alerts</td></tr>}
                {visAlerts.map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' ? '#1a0808' : 'transparent' }}>
                    <Td><AlertTypeBadge type={a.alertType} /></Td>
                    <Td><SevBadge sev={a.severity} /></Td>
                    <Td mono col={AMBER}>{a.symbol}</Td>
                    <Td mono col={BLUE}>{a.trader}</Td>
                    <Td><ConfBar pct={a.confidence} /></Td>
                    <Td right mono col={a.estimatedImpact > 0 ? RED : SUBTLE}>${a.estimatedImpact.toLocaleString()}</Td>
                    <Td right mono>{a.ordersInvolved}</Td>
                    <Td>{a.regulatoryFlag ? <span style={{ fontFamily: MONO, fontSize: 9, color: RED }}>🚩 YES</span> : <span style={{ color: SUBTLE, fontSize: 11 }}>—</span>}</Td>
                    <Td><StatusBadgeSrvy status={a.status} /></Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{a.detectedAt}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* INVESTIGATIONS */}
        {tab === 'investigations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Case ID</Th><Th>Symbol</Th><Th>Trader</Th>
                <Th>Priority</Th><Th>Status</Th><Th>Assigned To</Th>
                <Th>Opened</Th><Th>Resolved</Th><Th>Reg Report</Th><Th>Findings</Th>
              </tr></thead>
              <tbody>
                {investigations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No investigations — check /api/v4/surveillance/investigations</td></tr>}
                {investigations.map((inv, i) => {
                  const sc = inv.status === 'closed' ? GREEN : inv.status === 'submitted' ? BLUE : inv.status === 'pending_review' ? AMBER : RED
                  return (
                    <tr key={i}>
                      <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{inv.caseId.slice(0, 12)}</Td>
                      <Td mono col={AMBER}>{inv.symbol}</Td>
                      <Td mono col={BLUE}>{inv.trader}</Td>
                      <Td><SevBadge sev={inv.priority} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: sc, background: sc + '22', padding: '2px 6px', borderRadius: 2 }}>{inv.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td mono col={SUBTLE}>{inv.assignedTo}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{inv.openedAt}</Td>
                      <Td mono col={inv.resolvedAt ? GREEN : SUBTLE} style={{ fontSize: 10 }}>{inv.resolvedAt ?? 'Open'}</Td>
                      <Td>{inv.regulatoryReport ? <span style={{ fontFamily: MONO, fontSize: 9, color: ORANGE }}>FILED</span> : <span style={{ color: SUBTLE, fontSize: 11 }}>—</span>}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{inv.findings || 'Pending'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PATTERNS */}
        {tab === 'patterns' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
            {patterns.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No patterns — check /api/v4/surveillance/patterns</div>}
            {patterns.map(p => (
              <div key={p.patternId} style={{ background: PANEL, border: `1px solid ${p.active ? BORDER : BORDER + '55'}`, borderRadius: 4, padding: 12, opacity: p.active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <AlertTypeBadge type={p.patternType} />
                  <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, flex: 1 }}>{p.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: p.active ? GREEN : SUBTLE }}>{p.active ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 6 }}>{p.description}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Hits: <span style={{ color: TEXT }}>{p.detectionCount}</span></span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Conf: <span style={{ color: p.avgConfidence > 70 ? RED : AMBER }}>{p.avgConfidence.toFixed(0)}%</span></span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Last: <span style={{ color: TEXT }}>{p.lastDetected || '—'}</span></span>
                </div>
                {p.indicators.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {p.indicators.slice(0, 4).map((ind, j) => (
                      <span key={j} style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, background: BORDER, padding: '1px 5px', borderRadius: 2 }}>{ind}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TRADER ACTIVITY */}
        {tab === 'activity' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Trader</Th><Th>Account</Th>
                <Th>Risk Score</Th><Th right>Alerts</Th><Th right>Open</Th>
                <Th right>Notional</Th><Th right>Cancel Rate</Th><Th right>OTF Ratio</Th>
                <Th>Suspicious Patterns</Th>
              </tr></thead>
              <tbody>
                {activity.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No activity data — check /api/v4/surveillance/activity</td></tr>}
                {[...activity].sort((a, b) => b.riskScore - a.riskScore).map((t, i) => (
                  <tr key={i} style={{ background: t.riskScore > 80 ? '#1a0808' : 'transparent' }}>
                    <Td mono col={t.riskScore > 70 ? RED : AMBER}>{t.trader}</Td>
                    <Td mono col={SUBTLE}>{t.account}</Td>
                    <Td><RiskScoreBar score={t.riskScore} /></Td>
                    <Td right mono col={t.alertCount > 5 ? RED : TEXT}>{t.alertCount}</Td>
                    <Td right mono col={t.openAlerts > 0 ? AMBER : SUBTLE}>{t.openAlerts}</Td>
                    <Td right mono col={BLUE}>${(t.totalNotional / 1e6).toFixed(1)}M</Td>
                    <Td right mono col={t.cancelRate > 0.7 ? RED : t.cancelRate > 0.4 ? AMBER : GREEN}>{(t.cancelRate * 100).toFixed(0)}%</Td>
                    <Td right mono col={t.orderToFillRatio > 10 ? RED : SUBTLE}>{t.orderToFillRatio.toFixed(1)}x</Td>
                    <Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>
                      {t.suspiciousPatterns.map((p, j) => (
                        <span key={j} style={{ fontFamily: MONO, fontSize: 8, color: ORANGE, background: ORANGE + '22', padding: '1px 4px', borderRadius: 2, marginRight: 3 }}>{p.replace(/_/g, ' ').toUpperCase()}</span>
                      ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Report ID</Th><Th>Type</Th><Th>Period</Th><Th>Generated</Th>
                <Th right>Alerts</Th><Th right>Investigations</Th><Th>Regulatory</Th><Th>Summary</Th>
              </tr></thead>
              <tbody>
                {reports.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reports — check /api/v4/surveillance/reports</td></tr>}
                {reports.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{r.reportId.slice(0, 12)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{r.reportType.toUpperCase()}</span></Td>
                    <Td mono col={TEXT}>{r.period}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{r.generatedAt}</Td>
                    <Td right mono>{r.alertCount}</Td>
                    <Td right mono>{r.investigationCount}</Td>
                    <Td>{r.submittedToRegulator ? <span style={{ fontFamily: MONO, fontSize: 9, color: GREEN }}>SUBMITTED</span> : <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>INTERNAL</span>}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.summary}</Td>
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
