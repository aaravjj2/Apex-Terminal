import React, { useState, useEffect, useCallback } from 'react'
﻿// KriScoringUI2 â€” Bloomberg KRIS key risk indicator scoring terminal
// KRI monitoring, control effectiveness, breach alerts, trend analysis, audit
// Tabs: INDICATORS | CONTROLS | ALERTS | TRENDS | AUDIT
// APIs: /api/v4/kri-scoring/indicators, /controls, /alerts, /trends, /audit

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

interface KriIndicator {
  kriId: string
  kriName: string
  category: string
  riskDomain: string
  currentValue: number
  greenThreshold: number
  amberThreshold: number
  redThreshold: number
  status: 'green' | 'amber' | 'red' | 'breach'
  trend: 'improving' | 'stable' | 'deteriorating'
  score: number
  weight: number
  owner: string
  lastUpdated: string
  frequency: string
}

interface ControlEntry {
  controlId: string
  controlName: string
  kriRef: string
  controlType: string
  effectiveness: 'high' | 'medium' | 'low' | 'failed'
  testDate: string
  status: 'effective' | 'partially-effective' | 'ineffective' | 'not-tested'
  gaps: string
  remediationDue: string
  owner: string
  evidence: string
}

interface KriAlert {
  alertId: string
  kriId: string
  kriName: string
  alertType: string
  severity: 'critical' | 'major' | 'minor'
  triggeredAt: string
  resolution: 'open' | 'escalated' | 'accepted' | 'resolved'
  breachDuration: string
  affectedRiskDomain: string
  acknowledged: boolean
  escalatedTo: string
}

interface KriTrend {
  trendId: string
  kriId: string
  period: string
  avgValue: number
  minValue: number
  maxValue: number
  breachCount: number
  improvingPct: number
  deterioratingPct: number
  avgScore: number
  direction: 'up' | 'down' | 'flat'
  significance: string
}

interface KriAuditEntry {
  auditId: string
  kriId: string
  action: string
  actor: string
  previousValue: number
  newValue: number
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
function TrafficLight({ s }: { s: string }) {
  const m: Record<string, string> = { green: GREEN, amber: AMBER, red: RED, breach: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 7px' }}>{s.toUpperCase()}</span>
}
function TrendBadge({ t }: { t: string }) {
  const m: Record<string, string> = { improving: GREEN, stable: SUBTLE, deteriorating: RED }
  const c = m[t] ?? SUBTLE
  const arrow = t === 'improving' ? 'â–¼' : t === 'deteriorating' ? 'â–²' : 'â†’'
  return <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{arrow} {t.toUpperCase()}</span>
}
function EffBadge({ e }: { e: string }) {
  const m: Record<string, string> = { high: GREEN, medium: AMBER, low: ORANGE, failed: RED, effective: GREEN, 'partially-effective': AMBER, ineffective: RED, 'not-tested': SUBTLE }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{e.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, major: ORANGE, minor: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusB({ s }: { s: string }) {
  const m: Record<string, string> = { open: RED, escalated: ORANGE, accepted: AMBER, resolved: GREEN, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ScoreBar({ score }: { score: number }) {
  const col = score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{score}</span>
    </div>
  )
}


export function KriScoringUI2() {
  const [tab, setTab] = useState<'indicators' | 'controls' | 'alerts' | 'trends' | 'audit'>('indicators')
  const [indicators, setIndicators] = useState<KriIndicator[]>([])
  const [controls, setControls] = useState<ControlEntry[]>([])
  const [alerts, setAlerts] = useState<KriAlert[]>([])
  const [trends, setTrends] = useState<KriTrend[]>([])
  const [auditLog, setAuditLog] = useState<KriAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rI, rC, rA, rT, rAu] = await Promise.allSettled([
        fetch('/api/v4/kri-scoring/indicators').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/kri-scoring/controls').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/kri-scoring/alerts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/kri-scoring/trends').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/kri-scoring/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.indicators ?? rI.value.data ?? []
        setIndicators(raw.map((k: any) => ({
          kriId: k.kri_id ?? k.kriId ?? '', kriName: k.kri_name ?? k.kriName ?? '',
          category: k.category ?? '', riskDomain: k.risk_domain ?? k.riskDomain ?? '',
          currentValue: Number(k.current_value ?? k.currentValue ?? 0),
          greenThreshold: Number(k.green_threshold ?? k.greenThreshold ?? 0),
          amberThreshold: Number(k.amber_threshold ?? k.amberThreshold ?? 0),
          redThreshold: Number(k.red_threshold ?? k.redThreshold ?? 0),
          status: k.status ?? 'green', trend: k.trend ?? 'stable',
          score: Number(k.score ?? 0), weight: Number(k.weight ?? 1),
          owner: k.owner ?? '', lastUpdated: k.last_updated ?? k.lastUpdated ?? '', frequency: k.frequency ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load indicators')
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.controls ?? rC.value.data ?? []
        setControls(raw.map((c: any) => ({
          controlId: c.control_id ?? c.controlId ?? '', controlName: c.control_name ?? c.controlName ?? '',
          kriRef: c.kri_ref ?? c.kriRef ?? '', controlType: c.control_type ?? c.controlType ?? '',
          effectiveness: c.effectiveness ?? 'medium', testDate: c.test_date ?? c.testDate ?? '',
          status: c.status ?? 'not-tested', gaps: c.gaps ?? '', remediationDue: c.remediation_due ?? c.remediationDue ?? '',
          owner: c.owner ?? '', evidence: c.evidence ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.alerts ?? rA.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          alertId: a.alert_id ?? a.alertId ?? '', kriId: a.kri_id ?? a.kriId ?? '',
          kriName: a.kri_name ?? a.kriName ?? '', alertType: a.alert_type ?? a.alertType ?? '',
          severity: a.severity ?? 'minor', triggeredAt: a.triggered_at ?? a.triggeredAt ?? '',
          resolution: a.resolution ?? 'open', breachDuration: a.breach_duration ?? a.breachDuration ?? '',
          affectedRiskDomain: a.affected_risk_domain ?? a.affectedRiskDomain ?? '',
          acknowledged: Boolean(a.acknowledged ?? false), escalatedTo: a.escalated_to ?? a.escalatedTo ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.trends ?? rT.value.data ?? []
        setTrends(raw.map((t: any) => ({
          trendId: t.trend_id ?? t.trendId ?? '', kriId: t.kri_id ?? t.kriId ?? '',
          period: t.period ?? '', avgValue: Number(t.avg_value ?? t.avgValue ?? 0),
          minValue: Number(t.min_value ?? t.minValue ?? 0), maxValue: Number(t.max_value ?? t.maxValue ?? 0),
          breachCount: Number(t.breach_count ?? t.breachCount ?? 0),
          improvingPct: Number(t.improving_pct ?? t.improvingPct ?? 0),
          deterioratingPct: Number(t.deteriorating_pct ?? t.deterioratingPct ?? 0),
          avgScore: Number(t.avg_score ?? t.avgScore ?? 0), direction: t.direction ?? 'flat', significance: t.significance ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', kriId: a.kri_id ?? a.kriId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          previousValue: Number(a.previous_value ?? a.previousValue ?? 0), newValue: Number(a.new_value ?? a.newValue ?? 0),
          outcome: a.outcome ?? 'pass', notes: a.notes ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const redIndicators = indicators.filter(k => k.status === 'red' || k.status === 'breach').length
  const amberIndicators = indicators.filter(k => k.status === 'amber').length
  const openAlerts = alerts.filter(a => a.resolution === 'open').length
  const ineffectiveControls = controls.filter(c => c.effectiveness === 'failed' || c.status === 'ineffective').length

  const TABS2 = [
    { id: 'indicators' as const, label: 'INDICATORS' },
    { id: 'controls' as const, label: 'CONTROLS' },
    { id: 'alerts' as const, label: 'ALERTS' },
    { id: 'trends' as const, label: 'TRENDS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>KRIS</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>KEY RISK INDICATORS â€” SCORING + CONTROL EFFECTIVENESS + BREACH ALERTS + TREND ANALYSIS</span>
        {redIndicators > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {redIndicators} RED KRIs</span>}
        {amberIndicators > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {amberIndicators} AMBER KRIs</span>}
        {ineffectiveControls > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {ineffectiveControls} INEFFECTIVE CONTROLS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total KRIs" value={indicators.length} col={BLUE} />
        <StatCard label="Red" value={redIndicators} col={redIndicators > 0 ? RED : SUBTLE} />
        <StatCard label="Amber" value={amberIndicators} col={amberIndicators > 0 ? AMBER : SUBTLE} />
        <StatCard label="Open Alerts" value={openAlerts} col={openAlerts > 0 ? ORANGE : SUBTLE} />
        <StatCard label="Ineffective Controls" value={ineffectiveControls} col={ineffectiveControls > 0 ? RED : GREEN} />
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

        {tab === 'indicators' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>KRI Name</Th><Th>Category</Th><Th>Risk Domain</Th><Th>Status</Th><Th>Trend</Th><Th>Score</Th><Th right>Current</Th><Th right>Amber</Th><Th right>Red</Th><Th>Owner</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {indicators.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No KRIs â€” check /api/v4/kri-scoring/indicators</td></tr>}
                {indicators.sort((a, b) => {
                  const ord: Record<string, number> = { breach: 0, red: 1, amber: 2, green: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((k, i) => (
                  <tr key={i} style={{ background: k.status === 'red' || k.status === 'breach' ? RED + '0a' : k.status === 'amber' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{k.kriName}</Td>
                    <Td mono col={BLUE}>{k.category}</Td>
                    <Td mono col={PURPLE}>{k.riskDomain}</Td>
                    <Td><TrafficLight s={k.status} /></Td>
                    <Td><TrendBadge t={k.trend} /></Td>
                    <Td><ScoreBar score={k.score} /></Td>
                    <Td right mono col={k.status === 'red' ? RED : k.status === 'amber' ? AMBER : GREEN}>{k.currentValue.toFixed(2)}</Td>
                    <Td right mono col={AMBER}>{k.amberThreshold.toFixed(2)}</Td>
                    <Td right mono col={RED}>{k.redThreshold.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{k.owner}</Td>
                    <Td mono col={SUBTLE}>{k.lastUpdated}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'controls' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Control ID</Th><Th>Name</Th><Th>KRI Ref</Th><Th>Type</Th><Th>Effectiveness</Th><Th>Status</Th><Th>Gaps</Th><Th>Owner</Th><Th>Test Date</Th><Th>Remediation</Th></tr></thead>
              <tbody>
                {controls.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No controls â€” check /api/v4/kri-scoring/controls</td></tr>}
                {controls.sort((a, b) => {
                  const ord: Record<string, number> = { failed: 0, low: 1, medium: 2, high: 3 }
                  return (ord[a.effectiveness] ?? 4) - (ord[b.effectiveness] ?? 4)
                }).map((c, i) => (
                  <tr key={i} style={{ background: c.effectiveness === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.controlId}</Td>
                    <Td mono col={TEXT}>{c.controlName}</Td>
                    <Td mono col={BLUE}>{c.kriRef}</Td>
                    <Td mono col={PURPLE}>{c.controlType}</Td>
                    <Td><EffBadge e={c.effectiveness} /></Td>
                    <Td><EffBadge e={c.status} /></Td>
                    <Td mono col={c.gaps ? RED : SUBTLE}>{c.gaps || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{c.owner}</Td>
                    <Td mono col={SUBTLE}>{c.testDate}</Td>
                    <Td mono col={AMBER}>{c.remediationDue || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Alert ID</Th><Th>KRI Name</Th><Th>Type</Th><Th>Severity</Th><Th>Resolution</Th><Th>Risk Domain</Th><Th>Breach Duration</Th><Th>Acked</Th><Th>Escalated To</Th><Th>Triggered</Th></tr></thead>
              <tbody>
                {alerts.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts â€” check /api/v4/kri-scoring/alerts</td></tr>}
                {alerts.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, major: 1, minor: 2 }
                  return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3)
                }).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' && !a.acknowledged ? RED + '0a' : 'transparent', opacity: a.resolution === 'resolved' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{a.alertId}</Td>
                    <Td mono col={BLUE}>{a.kriName}</Td>
                    <Td mono col={PURPLE}>{a.alertType}</Td>
                    <Td><SevBadge s={a.severity} /></Td>
                    <Td><StatusB s={a.resolution} /></Td>
                    <Td mono col={SUBTLE}>{a.affectedRiskDomain}</Td>
                    <Td mono col={ORANGE}>{a.breachDuration || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.acknowledged ? GREEN : RED }}>{a.acknowledged ? 'ACKED' : 'OPEN'}</span></Td>
                    <Td mono col={SUBTLE}>{a.escalatedTo || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.triggeredAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'trends' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>KRI</Th><Th>Period</Th><Th>Direction</Th><Th right>Avg</Th><Th right>Min</Th><Th right>Max</Th><Th right>Breaches</Th><Th right>Improving %</Th><Th right>Deteriorating %</Th><Th>Significance</Th></tr></thead>
              <tbody>
                {trends.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No trends â€” check /api/v4/kri-scoring/trends</td></tr>}
                {trends.map((t, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{t.kriId}</Td>
                    <Td mono col={SUBTLE}>{t.period}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 10, color: t.direction === 'up' ? RED : t.direction === 'down' ? GREEN : SUBTLE }}>{t.direction === 'up' ? 'â–²' : t.direction === 'down' ? 'â–¼' : 'â†’'} {t.direction.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>{t.avgValue.toFixed(2)}</Td>
                    <Td right mono col={GREEN}>{t.minValue.toFixed(2)}</Td>
                    <Td right mono col={RED}>{t.maxValue.toFixed(2)}</Td>
                    <Td right mono col={t.breachCount > 0 ? RED : GREEN}>{t.breachCount}</Td>
                    <Td right mono col={GREEN}>{t.improvingPct.toFixed(1)}%</Td>
                    <Td right mono col={t.deterioratingPct > 30 ? RED : SUBTLE}>{t.deterioratingPct.toFixed(1)}%</Td>
                    <Td mono col={BLUE}>{t.significance}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>KRI</Th><Th>Action</Th><Th>Actor</Th><Th right>Previous</Th><Th right>New</Th><Th>Outcome</Th><Th>Notes</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/kri-scoring/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.kriId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td right mono col={SUBTLE}>{a.previousValue.toFixed(2)}</Td>
                    <Td right mono col={a.newValue > a.previousValue ? RED : GREEN}>{a.newValue.toFixed(2)}</Td>
                    <Td><StatusB s={a.outcome} /></Td>
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
