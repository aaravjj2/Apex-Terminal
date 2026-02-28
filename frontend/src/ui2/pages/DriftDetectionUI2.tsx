import React, { useState, useEffect, useCallback } from 'react'
﻿// DriftDetectionUI2 â€” Bloomberg DRTD drift detection terminal
// Data drift, model drift, segment analysis, root cause, alerts, retraining
// Tabs: DRIFT MONITOR | SEGMENTS | ROOT CAUSE | ALERTS | HISTORY
// APIs: /api/v4/drift-detection/monitor, /segments, /root-cause, /alerts, /history

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

interface DriftMonitorEntry {
  modelId: string
  modelName: string
  driftType: 'data' | 'concept' | 'prediction' | 'feature' | 'label'
  driftScore: number
  threshold: number
  status: 'stable' | 'warning' | 'drifted' | 'retraining'
  detectedAt: string
  baselinePeriod: string
  currentPeriod: string
  samplesCompared: number
  testMethod: string
}

interface SegmentAnalysis {
  segmentId: string
  segmentName: string
  dimension: string
  driftScore: number
  volume: number
  volumeChange: number
  featureDrifted: string
  pValue: number
  jsDivergence: number
  wasserstein: number
}

interface RootCause {
  causeId: string
  modelId: string
  feature: string
  contribution: number
  driftMagnitude: number
  direction: 'increase' | 'decrease' | 'shift'
  expectedRange: string
  currentRange: string
  dataSource: string
  recommendation: string
}

interface DriftAlert {
  alertId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  modelId: string
  driftType: string
  metric: string
  threshold: number
  currentValue: number
  acknowledged: boolean
  assignedTo: string
  createdAt: string
  retrainingTriggered: boolean
}

interface DriftHistoryEntry {
  snapshotId: string
  modelId: string
  date: string
  driftScore: number
  driftType: string
  outcome: 'stable' | 'drifted' | 'retrained' | 'rolled_back'
  psi: number
  ks: number
  actionTaken: string
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
function DriftBar({ score, threshold }: { score: number; threshold: number }) {
  const pct = Math.min((score / Math.max(threshold * 2, 1)) * 100, 100)
  const c = score >= threshold ? RED : score >= threshold * 0.7 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'visible' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: -2, left: `${(threshold / Math.max(threshold * 2, 1)) * 100}%`, width: 1, height: 10, background: AMBER }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{score.toFixed(4)}</span>
    </div>
  )
}
function DriftTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { data: BLUE, concept: PURPLE, prediction: ORANGE, feature: AMBER, label: GREEN }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function DriftStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { stable: GREEN, warning: AMBER, drifted: RED, retraining: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function OutcomeBadge({ s }: { s: string }) {
  const m: Record<string, string> = { stable: GREEN, drifted: RED, retrained: BLUE, rolled_back: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}


export function DriftDetectionUI2() {
  const [tab, setTab] = useState<'monitor' | 'segments' | 'rootcause' | 'alerts' | 'history'>('monitor')
  const [monitor, setMonitor] = useState<DriftMonitorEntry[]>([])
  const [segments, setSegments] = useState<SegmentAnalysis[]>([])
  const [rootCause, setRootCause] = useState<RootCause[]>([])
  const [alerts, setAlerts] = useState<DriftAlert[]>([])
  const [history, setHistory] = useState<DriftHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rM, rS, rR, rA, rH] = await Promise.allSettled([
        fetch('/api/v4/drift-detection/monitor').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/drift-detection/segments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/drift-detection/root-cause').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/drift-detection/alerts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/drift-detection/history').then(r => r.ok ? r.json() : []),
      ])
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.monitor ?? rM.value.data ?? []
        setMonitor(raw.map((m: any) => ({
          modelId: m.model_id ?? m.modelId ?? '', modelName: m.model_name ?? m.modelName ?? '',
          driftType: m.drift_type ?? m.driftType ?? 'data', driftScore: Number(m.drift_score ?? m.driftScore ?? 0),
          threshold: Number(m.threshold ?? 0.1), status: m.status ?? 'stable',
          detectedAt: m.detected_at ?? m.detectedAt ?? '', baselinePeriod: m.baseline_period ?? m.baselinePeriod ?? '',
          currentPeriod: m.current_period ?? m.currentPeriod ?? '', samplesCompared: Number(m.samples_compared ?? m.samplesCompared ?? 0),
          testMethod: m.test_method ?? m.testMethod ?? 'PSI',
        })))
        setErr(null)
      } else setErr('Failed to load drift monitor')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.segments ?? rS.value.data ?? []
        setSegments(raw.map((s: any) => ({
          segmentId: s.segment_id ?? s.segmentId ?? '', segmentName: s.segment_name ?? s.segmentName ?? '',
          dimension: s.dimension ?? '', driftScore: Number(s.drift_score ?? s.driftScore ?? 0),
          volume: Number(s.volume ?? 0), volumeChange: Number(s.volume_change ?? s.volumeChange ?? 0),
          featureDrifted: s.feature_drifted ?? s.featureDrifted ?? '', pValue: Number(s.p_value ?? s.pValue ?? 0),
          jsDivergence: Number(s.js_divergence ?? s.jsDivergence ?? 0), wasserstein: Number(s.wasserstein ?? 0),
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.root_cause ?? rR.value.rootCause ?? rR.value.data ?? []
        setRootCause(raw.map((r: any) => ({
          causeId: r.cause_id ?? r.causeId ?? '', modelId: r.model_id ?? r.modelId ?? '',
          feature: r.feature ?? '', contribution: Number(r.contribution ?? 0),
          driftMagnitude: Number(r.drift_magnitude ?? r.driftMagnitude ?? 0),
          direction: r.direction ?? 'shift', expectedRange: r.expected_range ?? r.expectedRange ?? '',
          currentRange: r.current_range ?? r.currentRange ?? '', dataSource: r.data_source ?? r.dataSource ?? '',
          recommendation: r.recommendation ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.alerts ?? rA.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          alertId: a.alert_id ?? a.alertId ?? '', severity: a.severity ?? 'medium',
          modelId: a.model_id ?? a.modelId ?? '', driftType: a.drift_type ?? a.driftType ?? '',
          metric: a.metric ?? '', threshold: Number(a.threshold ?? 0), currentValue: Number(a.current_value ?? a.currentValue ?? 0),
          acknowledged: Boolean(a.acknowledged ?? false), assignedTo: a.assigned_to ?? a.assignedTo ?? '',
          createdAt: a.created_at ?? a.createdAt ?? '', retrainingTriggered: Boolean(a.retraining_triggered ?? a.retrainingTriggered ?? false),
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw = Array.isArray(rH.value) ? rH.value : rH.value.history ?? rH.value.data ?? []
        setHistory(raw.map((h: any) => ({
          snapshotId: h.snapshot_id ?? h.snapshotId ?? '', modelId: h.model_id ?? h.modelId ?? '',
          date: h.date ?? '', driftScore: Number(h.drift_score ?? h.driftScore ?? 0),
          driftType: h.drift_type ?? h.driftType ?? '', outcome: h.outcome ?? 'stable',
          psi: Number(h.psi ?? 0), ks: Number(h.ks ?? 0), actionTaken: h.action_taken ?? h.actionTaken ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const driftedModels = monitor.filter(m => m.status === 'drifted').length
  const warningModels = monitor.filter(m => m.status === 'warning').length
  const unackedAlerts = alerts.filter(a => !a.acknowledged).length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length

  const TABS = [
    { id: 'monitor' as const, label: 'DRIFT MONITOR' },
    { id: 'segments' as const, label: 'SEGMENTS' },
    { id: 'rootcause' as const, label: 'ROOT CAUSE' },
    { id: 'alerts' as const, label: 'ALERTS' },
    { id: 'history' as const, label: 'HISTORY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>DRTD</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DRIFT DETECTION â€” MODEL DRIFT + SEGMENT ANALYSIS + ROOT CAUSE + ALERTS + HISTORY</span>
        {driftedModels > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {driftedModels} DRIFTED</span>}
        {warningModels > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {warningModels} WARNING</span>}
        {criticalAlerts > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalAlerts} CRITICAL ALERTS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Models Monitored" value={monitor.length} col={BLUE} />
        <StatCard label="Drifted" value={driftedModels} col={driftedModels > 0 ? RED : GREEN} />
        <StatCard label="Warning" value={warningModels} col={warningModels > 0 ? AMBER : GREEN} />
        <StatCard label="Unacked Alerts" value={unackedAlerts} col={unackedAlerts > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical" value={criticalAlerts} col={criticalAlerts > 0 ? RED : GREEN} />
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

        {tab === 'monitor' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model</Th><Th>Drift Type</Th><Th>Status</Th><Th>Drift Score</Th><Th right>Samples</Th><Th>Test Method</Th><Th>Detected</Th><Th>Baseline</Th></tr></thead>
              <tbody>
                {monitor.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No monitor â€” check /api/v4/drift-detection/monitor</td></tr>}
                {monitor.sort((a, b) => b.driftScore - a.driftScore).map((m, i) => (
                  <tr key={i} style={{ background: m.status === 'drifted' ? RED + '0a' : m.status === 'warning' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.modelName}</Td>
                    <Td><DriftTypeBadge t={m.driftType} /></Td>
                    <Td><DriftStatusBadge s={m.status} /></Td>
                    <Td><DriftBar score={m.driftScore} threshold={m.threshold} /></Td>
                    <Td right mono col={SUBTLE}>{m.samplesCompared.toLocaleString()}</Td>
                    <Td mono col={BLUE}>{m.testMethod}</Td>
                    <Td mono col={SUBTLE}>{m.detectedAt}</Td>
                    <Td mono col={SUBTLE}>{m.baselinePeriod}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'segments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Segment</Th><Th>Dimension</Th><Th right>Drift Score</Th><Th right>Volume</Th><Th right>Vol Change %</Th><Th>Feature Drifted</Th><Th right>p-Value</Th><Th right>JS Div</Th><Th right>Wasserstein</Th></tr></thead>
              <tbody>
                {segments.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No segments â€” check /api/v4/drift-detection/segments</td></tr>}
                {segments.sort((a, b) => b.driftScore - a.driftScore).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.segmentName}</Td>
                    <Td mono col={BLUE}>{s.dimension}</Td>
                    <Td right mono col={s.driftScore > 0.2 ? RED : s.driftScore > 0.1 ? AMBER : GREEN}>{s.driftScore.toFixed(4)}</Td>
                    <Td right mono col={TEXT}>{s.volume.toLocaleString()}</Td>
                    <Td right mono col={Math.abs(s.volumeChange) > 30 ? RED : Math.abs(s.volumeChange) > 15 ? AMBER : TEXT}>{s.volumeChange >= 0 ? '+' : ''}{s.volumeChange.toFixed(1)}%</Td>
                    <Td mono col={ORANGE}>{s.featureDrifted}</Td>
                    <Td right mono col={s.pValue < 0.05 ? RED : s.pValue < 0.1 ? AMBER : GREEN}>{s.pValue.toFixed(4)}</Td>
                    <Td right mono col={PURPLE}>{s.jsDivergence.toFixed(4)}</Td>
                    <Td right mono col={SUBTLE}>{s.wasserstein.toFixed(4)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'rootcause' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model</Th><Th>Feature</Th><Th right>Contribution</Th><Th right>Magnitude</Th><Th>Direction</Th><Th>Expected Range</Th><Th>Current Range</Th><Th>Recommendation</Th></tr></thead>
              <tbody>
                {rootCause.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No root causes â€” check /api/v4/drift-detection/root-cause</td></tr>}
                {rootCause.sort((a, b) => b.contribution - a.contribution).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.modelId}</Td>
                    <Td mono col={BLUE}>{r.feature}</Td>
                    <Td right mono col={r.contribution > 0.5 ? RED : r.contribution > 0.2 ? AMBER : TEXT}>{(r.contribution * 100).toFixed(1)}%</Td>
                    <Td right mono col={RED}>{r.driftMagnitude.toFixed(4)}</Td>
                    <Td mono col={r.direction === 'increase' ? GREEN : r.direction === 'decrease' ? RED : AMBER}>{r.direction.toUpperCase()}</Td>
                    <Td mono col={SUBTLE}>{r.expectedRange}</Td>
                    <Td mono col={ORANGE}>{r.currentRange}</Td>
                    <Td mono col={TEXT} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.recommendation}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Severity</Th><Th>Model</Th><Th>Drift Type</Th><Th>Metric</Th><Th right>Threshold</Th><Th right>Current</Th><Th>Acked</Th><Th>Retrain</Th><Th>Assigned</Th><Th>Created</Th></tr></thead>
              <tbody>
                {alerts.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts â€” check /api/v4/drift-detection/alerts</td></tr>}
                {alerts.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (ord[a.severity] ?? 4) - (ord[b.severity] ?? 4)
                }).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' && !a.acknowledged ? RED + '0a' : 'transparent', opacity: a.acknowledged ? 0.6 : 1 }}>
                    <Td><SeverityBadge s={a.severity} /></Td>
                    <Td mono col={AMBER}>{a.modelId}</Td>
                    <Td><DriftTypeBadge t={a.driftType} /></Td>
                    <Td mono col={BLUE}>{a.metric}</Td>
                    <Td right mono col={SUBTLE}>{a.threshold.toFixed(4)}</Td>
                    <Td right mono col={a.currentValue > a.threshold ? RED : GREEN}>{a.currentValue.toFixed(4)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.acknowledged ? GREEN : RED }}>{a.acknowledged ? 'ACKED' : 'OPEN'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.retrainingTriggered ? BLUE : SUBTLE }}>{a.retrainingTriggered ? 'TRIGGERED' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{a.assignedTo}</Td>
                    <Td mono col={SUBTLE}>{a.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model</Th><Th>Date</Th><Th>Drift Type</Th><Th right>Drift Score</Th><Th right>PSI</Th><Th right>KS</Th><Th>Outcome</Th><Th>Action</Th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No history â€” check /api/v4/drift-detection/history</td></tr>}
                {history.map((h, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{h.modelId}</Td>
                    <Td mono col={SUBTLE}>{h.date}</Td>
                    <Td><DriftTypeBadge t={h.driftType} /></Td>
                    <Td right mono col={h.driftScore > 0.2 ? RED : h.driftScore > 0.1 ? AMBER : GREEN}>{h.driftScore.toFixed(4)}</Td>
                    <Td right mono col={h.psi > 0.2 ? RED : h.psi > 0.1 ? AMBER : GREEN}>{h.psi.toFixed(4)}</Td>
                    <Td right mono col={h.ks > 0.1 ? AMBER : GREEN}>{h.ks.toFixed(4)}</Td>
                    <Td><OutcomeBadge s={h.outcome} /></Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{h.actionTaken || 'â€”'}</Td>
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
