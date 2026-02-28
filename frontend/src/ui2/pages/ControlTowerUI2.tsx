import React, { useState, useEffect, useCallback } from 'react'
﻿// ControlTowerUI2 â€” Bloomberg CTWR-grade autopilot control tower
// Real-time agent status, intervention controls, health monitoring, system state
// Tabs: SYSTEM STATUS | AGENTS | INTERVENTIONS | ALERTS | AUDIT LOG
// APIs: /api/v4/control-tower/status, /agents, /interventions, /alerts, /audit

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

interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline'
  uptimePct: number
  lastCheckAt: string
  activeAgents: number
  pendingInterventions: number
  criticalAlerts: number
  services: ServiceHealth[]
}

interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'offline'
  latencyMs: number
  errorRatePct: number
  requestsPerMin: number
  lastSuccess: string
}

interface AgentRecord {
  id: string
  name: string
  type: string
  state: 'running' | 'idle' | 'paused' | 'stopped' | 'error'
  tasksCurrent: number
  tasksCompleted: number
  tasksFailed: number
  cpuPct: number
  memMB: number
  lastHeartbeat: string
  uptime: number
}

interface InterventionRequest {
  id: string
  agentId: string
  agentName: string
  type: 'pause' | 'resume' | 'override' | 'rollback' | 'escalate'
  reason: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  priority: 'critical' | 'high' | 'medium' | 'low'
  approvedBy?: string
}

interface AlertRecord {
  id: string
  source: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  timestamp: string
  acknowledged: boolean
  resolvedAt?: string
  count: number
}

interface AuditEntry {
  id: string
  actor: string
  action: string
  target: string
  timestamp: string
  outcome: 'success' | 'failure' | 'pending'
  details: string
  ipAddress: string
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

function HealthDot({ status }: { status: string }) {
  const c = status === 'healthy' ? GREEN : status === 'degraded' ? AMBER : RED
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}88`, marginRight: 6, flexShrink: 0 }} />
}

function StateBadge({ s }: { s: string }) {
  const m: Record<string, string> = { running: GREEN, idle: BLUE, paused: AMBER, stopped: SUBTLE, error: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 7px' }}>{s.toUpperCase()}</span>
}

function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, warning: AMBER, info: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 7px' }}>{s.toUpperCase()}</span>
}

function PriorityBadge({ p }: { p: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 7px' }}>{p.toUpperCase()}</span>
}

function InterventionTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { pause: AMBER, resume: GREEN, override: ORANGE, rollback: RED, escalate: PURPLE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 7px' }}>{t.toUpperCase()}</span>
}

function UtilBar({ pct, warn, crit }: { pct: number; warn?: number; crit?: number }) {
  const c = pct >= (crit ?? 90) ? RED : pct >= (warn ?? 70) ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}


export function ControlTowerUI2() {
  const [tab, setTab] = useState<'status' | 'agents' | 'interventions' | 'alerts' | 'audit'>('status')
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null)
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [interventions, setInterventions] = useState<InterventionRequest[]>([])
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [sevFilter, setSevFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rA, rI, rAl, rAu] = await Promise.allSettled([
        fetch('/api/v4/control-tower/status').then(r => r.ok ? r.json() : null),
        fetch('/api/v4/control-tower/agents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-tower/interventions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-tower/alerts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/control-tower/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled' && rS.value) {
        const d = rS.value
        setSysStatus({
          overall: d.overall ?? 'healthy', uptimePct: Number(d.uptime_pct ?? d.uptimePct ?? 0),
          lastCheckAt: d.last_check_at ?? d.lastCheckAt ?? '', activeAgents: Number(d.active_agents ?? d.activeAgents ?? 0),
          pendingInterventions: Number(d.pending_interventions ?? d.pendingInterventions ?? 0),
          criticalAlerts: Number(d.critical_alerts ?? d.criticalAlerts ?? 0),
          services: Array.isArray(d.services) ? d.services.map((s: any) => ({
            name: s.name ?? '', status: s.status ?? 'healthy', latencyMs: Number(s.latency_ms ?? s.latencyMs ?? 0),
            errorRatePct: Number(s.error_rate_pct ?? s.errorRatePct ?? 0), requestsPerMin: Number(s.requests_per_min ?? s.requestsPerMin ?? 0),
            lastSuccess: s.last_success ?? s.lastSuccess ?? '',
          })) : [],
        })
        setErr(null)
      } else setErr('Failed to load system status')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.agents ?? rA.value.data ?? []
        setAgents(raw.map((a: any) => ({
          id: a.id ?? '', name: a.name ?? '', type: a.type ?? '', state: a.state ?? 'idle',
          tasksCurrent: Number(a.tasks_current ?? a.tasksCurrent ?? 0), tasksCompleted: Number(a.tasks_completed ?? a.tasksCompleted ?? 0),
          tasksFailed: Number(a.tasks_failed ?? a.tasksFailed ?? 0), cpuPct: Number(a.cpu_pct ?? a.cpuPct ?? 0),
          memMB: Number(a.mem_mb ?? a.memMB ?? 0), lastHeartbeat: a.last_heartbeat ?? a.lastHeartbeat ?? '',
          uptime: Number(a.uptime ?? 0),
        })))
      }
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.interventions ?? rI.value.data ?? []
        setInterventions(raw.map((i: any) => ({
          id: i.id ?? '', agentId: i.agent_id ?? i.agentId ?? '', agentName: i.agent_name ?? i.agentName ?? '',
          type: i.type ?? 'pause', reason: i.reason ?? '', requestedBy: i.requested_by ?? i.requestedBy ?? '',
          requestedAt: i.requested_at ?? i.requestedAt ?? '', status: i.status ?? 'pending',
          priority: i.priority ?? 'medium', approvedBy: i.approved_by ?? i.approvedBy,
        })))
      }
      if (rAl.status === 'fulfilled') {
        const raw = Array.isArray(rAl.value) ? rAl.value : rAl.value.alerts ?? rAl.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          id: a.id ?? '', source: a.source ?? '', severity: a.severity ?? 'info', message: a.message ?? '',
          timestamp: a.timestamp ?? '', acknowledged: Boolean(a.acknowledged), resolvedAt: a.resolved_at ?? a.resolvedAt,
          count: Number(a.count ?? 1),
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.entries ?? rAu.value.data ?? []
        setAuditLog(raw.map((e: any) => ({
          id: e.id ?? '', actor: e.actor ?? '', action: e.action ?? '', target: e.target ?? '',
          timestamp: e.timestamp ?? '', outcome: e.outcome ?? 'success', details: e.details ?? '', ipAddress: e.ip_address ?? e.ipAddress ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const overallColor = sysStatus?.overall === 'healthy' ? GREEN : sysStatus?.overall === 'degraded' ? AMBER : RED
  const pendingCount = interventions.filter(i => i.status === 'pending').length
  const critAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length
  const filteredAgents = agents.filter(a => stateFilter === 'all' || a.state === stateFilter)
  const filteredAlerts = alerts.filter(a => sevFilter === 'all' || a.severity === sevFilter)

  const TABS = [
    { id: 'status' as const, label: 'SYSTEM STATUS' },
    { id: 'agents' as const, label: 'AGENTS' },
    { id: 'interventions' as const, label: 'INTERVENTIONS' },
    { id: 'alerts' as const, label: 'ALERTS' },
    { id: 'audit' as const, label: 'AUDIT LOG' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CTWR</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CONTROL TOWER â€” AUTOPILOT STATUS + AGENTS + INTERVENTIONS + ALERTS + AUDIT</span>
        {sysStatus && (
          <span style={{ fontSize: 10, color: overallColor, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            <HealthDot status={sysStatus.overall} />{sysStatus.overall.toUpperCase()} â€” {sysStatus.uptimePct.toFixed(3)}% UPTIME
          </span>
        )}
        {critAlerts > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {critAlerts} CRITICAL UNACK</span>}
        {pendingCount > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {pendingCount} PENDING INTERVENTIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="System" value={sysStatus?.overall?.toUpperCase() ?? 'â€”'} col={overallColor} />
        <StatCard label="Active Agents" value={sysStatus?.activeAgents ?? agents.filter(a => a.state === 'running').length} col={GREEN} />
        <StatCard label="Pending Interventions" value={pendingCount} col={pendingCount > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical Alerts" value={critAlerts} col={critAlerts > 0 ? RED : GREEN} />
        <StatCard label="Uptime" value={sysStatus ? `${sysStatus.uptimePct.toFixed(2)}%` : 'â€”'} col={GREEN} />
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

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {/* SYSTEM STATUS */}
        {tab === 'status' && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 10, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>
              SERVICE HEALTH â€” Last check: {sysStatus?.lastCheckAt ?? 'â€”'}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Service</Th><Th>Status</Th><Th right>Latency (ms)</Th><Th right>Error Rate %</Th><Th right>Req/min</Th><Th>Last Success</Th></tr></thead>
                <tbody>
                  {(!sysStatus || sysStatus.services.length === 0) && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No services â€” check /api/v4/control-tower/status</td></tr>}
                  {sysStatus?.services.map((s, i) => (
                    <tr key={i} style={{ background: s.status === 'offline' ? RED + '0a' : s.status === 'degraded' ? AMBER + '06' : 'transparent' }}>
                      <Td mono col={AMBER}><span style={{ display: 'flex', alignItems: 'center' }}><HealthDot status={s.status} />{s.name}</span></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.status === 'healthy' ? GREEN : s.status === 'degraded' ? AMBER : RED }}>{s.status.toUpperCase()}</span></Td>
                      <Td right mono col={s.latencyMs > 500 ? RED : s.latencyMs > 200 ? AMBER : GREEN}>{s.latencyMs}</Td>
                      <Td right mono col={s.errorRatePct > 5 ? RED : s.errorRatePct > 1 ? AMBER : GREEN}>{s.errorRatePct.toFixed(2)}%</Td>
                      <Td right mono col={BLUE}>{s.requestsPerMin.toLocaleString()}</Td>
                      <Td mono col={SUBTLE}>{s.lastSuccess}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'running', 'idle', 'paused', 'stopped', 'error'].map(s => (
                <button key={s} onClick={() => setStateFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: stateFilter === s ? AMBER : SUBTLE, background: stateFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${stateFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.toUpperCase()}
                </button>
              ))}
              <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE, marginLeft: 'auto', alignSelf: 'center' }}>{filteredAgents.length} agents</span>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Agent</Th><Th>Type</Th><Th>State</Th><Th right>Current Tasks</Th><Th right>Completed</Th><Th right>Failed</Th><Th>CPU</Th><Th>Memory</Th><Th>Last Heartbeat</Th></tr></thead>
                <tbody>
                  {filteredAgents.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No agents â€” check /api/v4/control-tower/agents</td></tr>}
                  {filteredAgents.map((a, i) => (
                    <tr key={i} style={{ background: a.state === 'error' ? RED + '0a' : 'transparent' }}>
                      <Td mono col={AMBER}>{a.name}</Td>
                      <Td mono col={BLUE}>{a.type}</Td>
                      <Td><StateBadge s={a.state} /></Td>
                      <Td right mono col={a.tasksCurrent > 0 ? GREEN : SUBTLE}>{a.tasksCurrent}</Td>
                      <Td right mono col={GREEN}>{a.tasksCompleted.toLocaleString()}</Td>
                      <Td right mono col={a.tasksFailed > 0 ? RED : SUBTLE}>{a.tasksFailed}</Td>
                      <Td><UtilBar pct={a.cpuPct} warn={70} crit={90} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{a.memMB.toFixed(0)} MB</span></Td>
                      <Td mono col={SUBTLE}>{a.lastHeartbeat}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INTERVENTIONS */}
        {tab === 'interventions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Agent</Th><Th>Type</Th><Th>Priority</Th><Th>Status</Th><Th>Requested By</Th><Th>Requested At</Th><Th>Approved By</Th><Th>Reason</Th></tr></thead>
              <tbody>
                {interventions.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No interventions â€” check /api/v4/control-tower/interventions</td></tr>}
                {interventions.sort((a, b) => { const o: Record<string, number> = { pending: 0, approved: 1, executed: 2, rejected: 3 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((iv, i) => (
                  <tr key={i} style={{ background: iv.priority === 'critical' && iv.status === 'pending' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{iv.agentName}</Td>
                    <Td><InterventionTypeBadge t={iv.type} /></Td>
                    <Td><PriorityBadge p={iv.priority} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: iv.status === 'approved' ? GREEN : iv.status === 'pending' ? AMBER : iv.status === 'rejected' ? RED : SUBTLE }}>{iv.status.toUpperCase()}</span></Td>
                    <Td mono col={BLUE}>{iv.requestedBy}</Td>
                    <Td mono col={SUBTLE}>{iv.requestedAt}</Td>
                    <Td mono col={SUBTLE}>{iv.approvedBy ?? 'â€”'}</Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{iv.reason}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ALERTS */}
        {tab === 'alerts' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['all', 'critical', 'warning', 'info'].map(s => (
                <button key={s} onClick={() => setSevFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: sevFilter === s ? AMBER : SUBTLE, background: sevFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${sevFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Source</Th><Th>Severity</Th><Th>Message</Th><Th right>Count</Th><Th>Timestamp</Th><Th>Ack</Th><Th>Resolved</Th></tr></thead>
                <tbody>
                  {filteredAlerts.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts â€” check /api/v4/control-tower/alerts</td></tr>}
                  {filteredAlerts.sort((a, b) => { const o: Record<string, number> = { critical: 0, warning: 1, info: 2 }; return (o[a.severity] ?? 9) - (o[b.severity] ?? 9) }).map((a, i) => (
                    <tr key={i} style={{ background: a.severity === 'critical' && !a.acknowledged ? RED + '0a' : 'transparent' }}>
                      <Td mono col={AMBER}>{a.source}</Td>
                      <Td><SeverityBadge s={a.severity} /></Td>
                      <Td><span style={{ fontSize: 11, color: TEXT }}>{a.message}</span></Td>
                      <Td right mono col={a.count > 1 ? ORANGE : SUBTLE}>{a.count}</Td>
                      <Td mono col={SUBTLE}>{a.timestamp}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.acknowledged ? GREEN : AMBER }}>{a.acknowledged ? 'ACK' : 'UNACK'}</span></Td>
                      <Td mono col={SUBTLE}>{a.resolvedAt ?? 'â€”'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT LOG */}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Outcome</Th><Th>Timestamp</Th><Th>IP</Th><Th>Details</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v4/control-tower/audit</td></tr>}
                {auditLog.map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.actor}</Td>
                    <Td mono col={BLUE}>{e.action}</Td>
                    <Td mono col={PURPLE}>{e.target}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.outcome === 'success' ? GREEN : e.outcome === 'failure' ? RED : AMBER }}>{e.outcome.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{e.timestamp}</Td>
                    <Td mono col={SUBTLE}>{e.ipAddress}</Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{e.details}</span></Td>
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
