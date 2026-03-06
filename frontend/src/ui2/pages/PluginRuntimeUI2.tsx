import React, { useState, useEffect, useCallback } from 'react'
﻿// PluginRuntimeUI2 — Bloomberg APEX plugin sandbox runtime terminal
// Plugin instances, capabilities, resources, violations, audit
// Tabs: PLUGINS | CAPABILITIES | RESOURCES | VIOLATIONS | AUDIT
// APIs: /api/v4/plugins/instances, /capabilities, /resources, /violations, /audit

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

interface PluginInstance {
  pluginId: string
  name: string
  version: string
  vendor: string
  sandboxType: 'wasm' | 'container' | 'process' | 'thread'
  status: 'running' | 'stopped' | 'crashed' | 'starting' | 'suspended'
  cpuPct: number
  memMb: number
  uptime: number
  requestsToday: number
  errorRatePct: number
  isolationLevel: 'strict' | 'standard' | 'permissive'
}

interface PluginCapability {
  capabilityId: string
  pluginId: string
  pluginName: string
  capability: string
  granted: boolean
  scope: string
  lastUsed: string
  usageCount: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

interface PluginResource {
  resourceId: string
  pluginId: string
  pluginName: string
  resourceType: string
  allocated: number
  used: number
  unit: string
  limit: number
  throttled: boolean
  timestamp: string
}

interface PluginViolation {
  violationId: string
  pluginId: string
  pluginName: string
  violationType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  action: 'blocked' | 'logged' | 'quarantined' | 'terminated'
  detail: string
  timestamp: string
  status: 'open' | 'resolved' | 'investigating'
}

interface PluginAuditEntry {
  auditId: string
  pluginId: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { running: GREEN, stopped: SUBTLE, crashed: RED, starting: AMBER, suspended: ORANGE, pass: GREEN, fail: RED, warn: AMBER, open: RED, resolved: GREEN, investigating: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function IsoLevel({ s }: { s: string }) {
  const m: Record<string, string> = { strict: GREEN, standard: BLUE, permissive: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function UsageBar({ used, limit, unit }: { used: number; limit: number; unit: string }) {
  const pct = limit > 0 ? (used / limit) * 100 : 0
  const col = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 44, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{used.toFixed(0)}{unit}</span>
    </div>
  )
}


export function PluginRuntimeUI2() {
  const [tab, setTab] = useState<'plugins' | 'capabilities' | 'resources' | 'violations' | 'audit'>('plugins')
  const [plugins, setPlugins] = useState<PluginInstance[]>([])
  const [capabilities, setCapabilities] = useState<PluginCapability[]>([])
  const [resources, setResources] = useState<PluginResource[]>([])
  const [violations, setViolations] = useState<PluginViolation[]>([])
  const [auditLog, setAuditLog] = useState<PluginAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rC, rR, rV, rA] = await Promise.allSettled([
        fetch('/api/v4/plugins/instances').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/plugins/capabilities').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/plugins/resources').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/plugins/violations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/plugins/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.instances ?? rP.value.plugins ?? rP.value.data ?? []
        setPlugins(raw.map((p: any) => ({
          pluginId: p.plugin_id ?? p.pluginId ?? '', name: p.name ?? '',
          version: p.version ?? '', vendor: p.vendor ?? '',
          sandboxType: p.sandbox_type ?? p.sandboxType ?? 'process',
          status: p.status ?? 'stopped', cpuPct: Number(p.cpu_pct ?? p.cpuPct ?? 0),
          memMb: Number(p.mem_mb ?? p.memMb ?? 0), uptime: Number(p.uptime ?? 0),
          requestsToday: Number(p.requests_today ?? p.requestsToday ?? 0),
          errorRatePct: Number(p.error_rate_pct ?? p.errorRatePct ?? 0),
          isolationLevel: p.isolation_level ?? p.isolationLevel ?? 'standard',
        })))
        setErr(null)
      } else setErr('Failed to load plugins')
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.capabilities ?? rC.value.data ?? []
        setCapabilities(raw.map((c: any) => ({
          capabilityId: c.capability_id ?? c.capabilityId ?? '', pluginId: c.plugin_id ?? c.pluginId ?? '',
          pluginName: c.plugin_name ?? c.pluginName ?? '', capability: c.capability ?? '',
          granted: Boolean(c.granted), scope: c.scope ?? '',
          lastUsed: c.last_used ?? c.lastUsed ?? '', usageCount: Number(c.usage_count ?? c.usageCount ?? 0),
          riskLevel: c.risk_level ?? c.riskLevel ?? 'low',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.resources ?? rR.value.data ?? []
        setResources(raw.map((r: any) => ({
          resourceId: r.resource_id ?? r.resourceId ?? '', pluginId: r.plugin_id ?? r.pluginId ?? '',
          pluginName: r.plugin_name ?? r.pluginName ?? '', resourceType: r.resource_type ?? r.resourceType ?? '',
          allocated: Number(r.allocated ?? 0), used: Number(r.used ?? 0), unit: r.unit ?? '',
          limit: Number(r.limit ?? 0), throttled: Boolean(r.throttled),
          timestamp: r.timestamp ?? '',
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.violations ?? rV.value.data ?? []
        setViolations(raw.map((v: any) => ({
          violationId: v.violation_id ?? v.violationId ?? '', pluginId: v.plugin_id ?? v.pluginId ?? '',
          pluginName: v.plugin_name ?? v.pluginName ?? '', violationType: v.violation_type ?? v.violationType ?? '',
          severity: v.severity ?? 'low', action: v.action ?? 'logged', detail: v.detail ?? '',
          timestamp: v.timestamp ?? '', status: v.status ?? 'open',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', pluginId: a.plugin_id ?? a.pluginId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const runningPlugins = plugins.filter(p => p.status === 'running').length
  const crashedPlugins = plugins.filter(p => p.status === 'crashed').length
  const criticalViolations = violations.filter(v => v.severity === 'critical' && v.status === 'open').length
  const throttledResources = resources.filter(r => r.throttled).length

  const TABS2 = [
    { id: 'plugins' as const, label: 'PLUGINS' },
    { id: 'capabilities' as const, label: 'CAPABILITIES' },
    { id: 'resources' as const, label: 'RESOURCES' },
    { id: 'violations' as const, label: 'VIOLATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PLUGIN RUNTIME — SANDBOX EXECUTION + CAPABILITY MODEL + RESOURCE ISOLATION</span>
        {crashedPlugins > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {crashedPlugins} CRASHED</span>}
        {criticalViolations > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {criticalViolations} CRITICAL VIOLATIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Running" value={runningPlugins} col={GREEN} />
        <StatCard label="Crashed" value={crashedPlugins} col={crashedPlugins > 0 ? RED : GREEN} />
        <StatCard label="Critical Violations" value={criticalViolations} col={criticalViolations > 0 ? ORANGE : GREEN} />
        <StatCard label="Throttled Resources" value={throttledResources} col={throttledResources > 0 ? AMBER : GREEN} />
        <StatCard label="Capabilities" value={capabilities.filter(c => c.granted).length} col={BLUE} />
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

        {tab === 'plugins' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Plugin</Th><Th>Vendor</Th><Th>Version</Th><Th>Sandbox</Th><Th>Status</Th><Th>Isolation</Th><Th right>CPU %</Th><Th right>Mem MB</Th><Th right>Uptime h</Th><Th right>Reqs/day</Th><Th right>Err %</Th></tr></thead>
              <tbody>
                {plugins.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No plugins</td></tr>}
                {plugins.sort((a, b) => a.status === 'crashed' ? -1 : 1).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'crashed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td mono col={BLUE}>{p.vendor}</Td>
                    <Td mono col={SUBTLE}>{p.version}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{p.sandboxType.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td><IsoLevel s={p.isolationLevel} /></Td>
                    <Td right mono col={p.cpuPct > 80 ? ORANGE : SUBTLE}>{p.cpuPct.toFixed(1)}%</Td>
                    <Td right mono col={p.memMb > 512 ? ORANGE : SUBTLE}>{p.memMb.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{(p.uptime / 3600).toFixed(1)}</Td>
                    <Td right mono col={TEXT}>{p.requestsToday.toLocaleString()}</Td>
                    <Td right mono col={p.errorRatePct > 1 ? RED : p.errorRatePct > 0.1 ? AMBER : GREEN}>{p.errorRatePct.toFixed(3)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'capabilities' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Plugin</Th><Th>Capability</Th><Th>Granted</Th><Th>Scope</Th><Th>Risk</Th><Th right>Usage Count</Th><Th>Last Used</Th></tr></thead>
              <tbody>
                {capabilities.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No capabilities</td></tr>}
                {capabilities.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (sp[a.riskLevel] ?? 4) - (sp[b.riskLevel] ?? 4)
                }).map((c, i) => (
                  <tr key={i} style={{ opacity: c.granted ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{c.pluginName}</Td>
                    <Td mono col={BLUE}>{c.capability}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.granted ? GREEN : RED }}>{c.granted ? 'âœ“ GRANTED' : 'âœ— DENIED'}</span></Td>
                    <Td mono col={SUBTLE}>{c.scope}</Td>
                    <Td><SevBadge s={c.riskLevel} /></Td>
                    <Td right mono col={c.usageCount > 0 ? TEXT : SUBTLE}>{c.usageCount.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{c.lastUsed || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'resources' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Plugin</Th><Th>Resource</Th><Th>Throttled</Th><Th>Usage</Th><Th right>Allocated</Th><Th right>Limit</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {resources.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No resource data</td></tr>}
                {resources.sort((a, b) => (a.throttled === b.throttled ? 0 : a.throttled ? -1 : 1)).map((r, i) => (
                  <tr key={i} style={{ background: r.throttled ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.pluginName}</Td>
                    <Td mono col={BLUE}>{r.resourceType}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.throttled ? ORANGE : GREEN }}>{r.throttled ? '⚠‘ YES' : '—'}</span></Td>
                    <Td><UsageBar used={r.used} limit={r.limit} unit={r.unit} /></Td>
                    <Td right mono col={SUBTLE}>{r.allocated}{r.unit}</Td>
                    <Td right mono col={SUBTLE}>{r.limit}{r.unit}</Td>
                    <Td mono col={SUBTLE}>{r.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'violations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Violation ID</Th><Th>Plugin</Th><Th>Type</Th><Th>Severity</Th><Th>Action</Th><Th>Status</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {violations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No violations</td></tr>}
                {violations.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (sp[a.severity] ?? 4) - (sp[b.severity] ?? 4)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.severity === 'critical' && v.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.violationId}</Td>
                    <Td mono col={BLUE}>{v.pluginName}</Td>
                    <Td mono col={ORANGE}>{v.violationType}</Td>
                    <Td><SevBadge s={v.severity} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: v.action === 'blocked' || v.action === 'terminated' ? RED : v.action === 'quarantined' ? ORANGE : SUBTLE, background: (v.action === 'blocked' || v.action === 'terminated' ? RED : v.action === 'quarantined' ? ORANGE : SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{v.action.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={v.status} /></Td>
                    <Td mono col={SUBTLE}>{v.detail.slice(0, 40) || '—'}</Td>
                    <Td mono col={SUBTLE}>{v.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Plugin</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.pluginId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge s={a.outcome} /></Td>
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
