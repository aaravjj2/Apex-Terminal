import React, { useState, useEffect, useCallback } from 'react'
﻿// AgentRegistryUI2 â€” Bloomberg APEX agent registry terminal
// AI agent lifecycle, capability discovery, health, versioning, audit
// Tabs: AGENTS | CAPABILITIES | DEPLOYMENTS | HEALTH | AUDIT
// APIs: /api/v4/agent-registry/agents, /capabilities, /deployments, /health, /audit

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

interface AgentRecord {
  agentId: string
  name: string
  agentType: string
  version: string
  status: 'active' | 'inactive' | 'deprecated' | 'testing'
  owner: string
  framework: string
  capabilityCount: number
  deploymentCount: number
  requestsToday: number
  avgLatencyMs: number
  errorRatePct: number
  registeredAt: string
}

interface AgentCapability {
  capabilityId: string
  agentId: string
  agentName: string
  capability: string
  category: string
  version: string
  enabled: boolean
  calledToday: number
  avgScorePercent: number
  description: string
}

interface AgentDeployment {
  deploymentId: string
  agentId: string
  agentName: string
  environment: 'production' | 'staging' | 'sandbox'
  endpoint: string
  replicas: number
  status: 'running' | 'stopped' | 'degraded' | 'scaling'
  deployedAt: string
  lastHealthCheck: string
  healthStatus: 'healthy' | 'degraded' | 'down'
}

interface AgentHealth {
  healthId: string
  agentId: string
  agentName: string
  uptime: number
  requestsPerMin: number
  errorCountLastHour: number
  p99LatencyMs: number
  memoryMb: number
  cpuPct: number
  lastCheckAt: string
  status: 'healthy' | 'degraded' | 'down'
}

interface AgentAuditEntry {
  auditId: string
  agentId: string
  action: string
  actor: string
  outcome: 'pass' | 'fail' | 'warn'
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
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, inactive: SUBTLE, deprecated: SUBTLE, testing: BLUE, running: GREEN, stopped: RED, degraded: AMBER, scaling: BLUE, healthy: GREEN, down: RED, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function EnvBadge({ e }: { e: string }) {
  const m: Record<string, string> = { production: GREEN, staging: AMBER, sandbox: BLUE }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{e.toUpperCase()}</span>
}


export function AgentRegistryUI2() {
  const [tab, setTab] = useState<'agents' | 'capabilities' | 'deployments' | 'health' | 'audit'>('agents')
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([])
  const [deployments, setDeployments] = useState<AgentDeployment[]>([])
  const [health, setHealth] = useState<AgentHealth[]>([])
  const [auditLog, setAuditLog] = useState<AgentAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rAg, rCa, rDe, rHe, rAu] = await Promise.allSettled([
        fetch('/api/v4/agent-registry/agents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/agent-registry/capabilities').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/agent-registry/deployments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/agent-registry/health').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/agent-registry/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rAg.status === 'fulfilled') {
        const raw = Array.isArray(rAg.value) ? rAg.value : rAg.value.agents ?? rAg.value.data ?? []
        setAgents(raw.map((a: any) => ({
          agentId: a.agent_id ?? a.agentId ?? '', name: a.name ?? '', agentType: a.agent_type ?? a.agentType ?? '',
          version: a.version ?? '', status: a.status ?? 'inactive', owner: a.owner ?? '',
          framework: a.framework ?? '', capabilityCount: Number(a.capability_count ?? a.capabilityCount ?? 0),
          deploymentCount: Number(a.deployment_count ?? a.deploymentCount ?? 0),
          requestsToday: Number(a.requests_today ?? a.requestsToday ?? 0),
          avgLatencyMs: Number(a.avg_latency_ms ?? a.avgLatencyMs ?? 0),
          errorRatePct: Number(a.error_rate_pct ?? a.errorRatePct ?? 0),
          registeredAt: a.registered_at ?? a.registeredAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load agents')
      if (rCa.status === 'fulfilled') {
        const raw = Array.isArray(rCa.value) ? rCa.value : rCa.value.capabilities ?? rCa.value.data ?? []
        setCapabilities(raw.map((c: any) => ({
          capabilityId: c.capability_id ?? c.capabilityId ?? '', agentId: c.agent_id ?? c.agentId ?? '',
          agentName: c.agent_name ?? c.agentName ?? '', capability: c.capability ?? '',
          category: c.category ?? '', version: c.version ?? '', enabled: Boolean(c.enabled),
          calledToday: Number(c.called_today ?? c.calledToday ?? 0),
          avgScorePercent: Number(c.avg_score_percent ?? c.avgScorePercent ?? 0),
          description: c.description ?? '',
        })))
      }
      if (rDe.status === 'fulfilled') {
        const raw = Array.isArray(rDe.value) ? rDe.value : rDe.value.deployments ?? rDe.value.data ?? []
        setDeployments(raw.map((d: any) => ({
          deploymentId: d.deployment_id ?? d.deploymentId ?? '', agentId: d.agent_id ?? d.agentId ?? '',
          agentName: d.agent_name ?? d.agentName ?? '', environment: d.environment ?? 'production',
          endpoint: d.endpoint ?? '', replicas: Number(d.replicas ?? 0), status: d.status ?? 'running',
          deployedAt: d.deployed_at ?? d.deployedAt ?? '', lastHealthCheck: d.last_health_check ?? d.lastHealthCheck ?? '',
          healthStatus: d.health_status ?? d.healthStatus ?? 'healthy',
        })))
      }
      if (rHe.status === 'fulfilled') {
        const raw = Array.isArray(rHe.value) ? rHe.value : rHe.value.health ?? rHe.value.data ?? []
        setHealth(raw.map((h: any) => ({
          healthId: h.health_id ?? h.healthId ?? '', agentId: h.agent_id ?? h.agentId ?? '',
          agentName: h.agent_name ?? h.agentName ?? '', uptime: Number(h.uptime ?? 0),
          requestsPerMin: Number(h.requests_per_min ?? h.requestsPerMin ?? 0),
          errorCountLastHour: Number(h.error_count_last_hour ?? h.errorCountLastHour ?? 0),
          p99LatencyMs: Number(h.p99_latency_ms ?? h.p99LatencyMs ?? 0),
          memoryMb: Number(h.memory_mb ?? h.memoryMb ?? 0), cpuPct: Number(h.cpu_pct ?? h.cpuPct ?? 0),
          lastCheckAt: h.last_check_at ?? h.lastCheckAt ?? '', status: h.status ?? 'healthy',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', agentId: a.agent_id ?? a.agentId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const degraded = health.filter(h => h.status === 'degraded' || h.status === 'down').length
  const prodDeploys = deployments.filter(d => d.environment === 'production').length

  const TABS2 = [
    { id: 'agents' as const, label: 'AGENTS' },
    { id: 'capabilities' as const, label: 'CAPABILITIES' },
    { id: 'deployments' as const, label: 'DEPLOYMENTS' },
    { id: 'health' as const, label: 'HEALTH' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AGENT REGISTRY â€” AI AGENT LIFECYCLE + CAPABILITY DISCOVERY + HEALTH MONITORING</span>
        {degraded > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {degraded} DEGRADED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Agents" value={agents.length} col={BLUE} />
        <StatCard label="Active" value={agents.filter(a => a.status === 'active').length} col={GREEN} />
        <StatCard label="Capabilities" value={capabilities.length} col={PURPLE} />
        <StatCard label="Prod Deployments" value={prodDeploys} col={AMBER} />
        <StatCard label="Degraded" value={degraded} col={degraded > 0 ? RED : GREEN} />
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

        {tab === 'agents' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Agent</Th><Th>Type</Th><Th>Version</Th><Th>Status</Th><Th>Framework</Th><Th right>Caps</Th><Th right>Deploys</Th><Th right>Req Today</Th><Th right>Latency ms</Th><Th right>Error %</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {agents.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No agents â€” check /api/v4/agent-registry/agents</td></tr>}
                {agents.sort((a, b) => b.requestsToday - a.requestsToday).map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.name}</Td>
                    <Td mono col={PURPLE}>{a.agentType}</Td>
                    <Td mono col={SUBTLE}>{a.version}</Td>
                    <Td><StatusBadge2 s={a.status} /></Td>
                    <Td mono col={BLUE}>{a.framework}</Td>
                    <Td right mono col={SUBTLE}>{a.capabilityCount}</Td>
                    <Td right mono col={SUBTLE}>{a.deploymentCount}</Td>
                    <Td right mono col={a.requestsToday > 0 ? TEXT : SUBTLE}>{a.requestsToday.toLocaleString()}</Td>
                    <Td right mono col={a.avgLatencyMs > 1000 ? ORANGE : SUBTLE}>{a.avgLatencyMs.toFixed(0)}</Td>
                    <Td right mono col={a.errorRatePct > 5 ? RED : a.errorRatePct > 1 ? AMBER : GREEN}>{a.errorRatePct.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{a.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'capabilities' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Capability</Th><Th>Agent</Th><Th>Category</Th><Th>Version</Th><Th>Enabled</Th><Th right>Called Today</Th><Th right>Avg Score</Th><Th>Description</Th></tr></thead>
              <tbody>
                {capabilities.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No capabilities â€” check /api/v4/agent-registry/capabilities</td></tr>}
                {capabilities.sort((a, b) => b.calledToday - a.calledToday).map((c, i) => (
                  <tr key={i} style={{ opacity: c.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{c.capability}</Td>
                    <Td mono col={BLUE}>{c.agentName}</Td>
                    <Td mono col={PURPLE}>{c.category}</Td>
                    <Td mono col={SUBTLE}>{c.version}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.enabled ? GREEN : RED }}>{c.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={c.calledToday > 0 ? TEXT : SUBTLE}>{c.calledToday}</Td>
                    <Td right mono col={c.avgScorePercent >= 80 ? GREEN : c.avgScorePercent >= 60 ? AMBER : RED}>{c.avgScorePercent.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{c.description.slice(0, 60)}{c.description.length > 60 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deployments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Deployment ID</Th><Th>Agent</Th><Th>Env</Th><Th>Status</Th><Th>Health</Th><Th right>Replicas</Th><Th>Endpoint</Th><Th>Deployed</Th><Th>Last Health Check</Th></tr></thead>
              <tbody>
                {deployments.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No deployments â€” check /api/v4/agent-registry/deployments</td></tr>}
                {deployments.sort((a, b) => (a.environment === 'production' ? -1 : 1) - (b.environment === 'production' ? -1 : 1)).map((d, i) => (
                  <tr key={i} style={{ background: d.healthStatus === 'down' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.deploymentId}</Td>
                    <Td mono col={BLUE}>{d.agentName}</Td>
                    <Td><EnvBadge e={d.environment} /></Td>
                    <Td><StatusBadge2 s={d.status} /></Td>
                    <Td><StatusBadge2 s={d.healthStatus} /></Td>
                    <Td right mono col={SUBTLE}>{d.replicas}</Td>
                    <Td mono col={SUBTLE}>{d.endpoint.slice(0, 40)}{d.endpoint.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{d.deployedAt}</Td>
                    <Td mono col={SUBTLE}>{d.lastHealthCheck}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'health' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Agent</Th><Th>Status</Th><Th right>Uptime %</Th><Th right>Req/min</Th><Th right>Errors/hr</Th><Th right>P99 ms</Th><Th right>CPU %</Th><Th right>Mem MB</Th><Th>Last Check</Th></tr></thead>
              <tbody>
                {health.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No health data â€” check /api/v4/agent-registry/health</td></tr>}
                {health.sort((a, b) => {
                  const p: Record<string, number> = { down: 0, degraded: 1, healthy: 2 }
                  return (p[a.status] ?? 3) - (p[b.status] ?? 3)
                }).map((h, i) => (
                  <tr key={i} style={{ background: h.status === 'down' ? RED + '0a' : h.status === 'degraded' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{h.agentName}</Td>
                    <Td><StatusBadge2 s={h.status} /></Td>
                    <Td right mono col={h.uptime >= 99.9 ? GREEN : h.uptime >= 99 ? AMBER : RED}>{h.uptime.toFixed(3)}%</Td>
                    <Td right mono col={SUBTLE}>{h.requestsPerMin.toFixed(1)}</Td>
                    <Td right mono col={h.errorCountLastHour > 10 ? RED : h.errorCountLastHour > 0 ? AMBER : GREEN}>{h.errorCountLastHour}</Td>
                    <Td right mono col={h.p99LatencyMs > 2000 ? RED : h.p99LatencyMs > 500 ? AMBER : GREEN}>{h.p99LatencyMs.toFixed(0)}</Td>
                    <Td right mono col={h.cpuPct > 80 ? RED : SUBTLE}>{h.cpuPct.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{h.memoryMb.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{h.lastCheckAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Agent</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/agent-registry/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.agentId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.detail || 'â€”'}</Td>
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
