import React, { useState, useEffect, useCallback } from 'react'
﻿// AppSandboxUI2 â€” Bloomberg APEX app sandbox security terminal
// Sandbox management, resource limits, security boundaries, violations, audit
// Tabs: SANDBOXES | RESOURCES | SECURITY | VIOLATIONS | AUDIT
// APIs: /api/v4/app-sandbox/sandboxes, /resources, /security, /violations, /audit

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

interface SandboxEntry {
  sandboxId: string
  appId: string
  appName: string
  version: string
  state: 'running' | 'idle' | 'stopped' | 'suspended' | 'error'
  isolationLevel: 'strict' | 'standard' | 'permissive'
  cpuLimitPct: number
  memoryLimitMb: number
  networkPolicy: string
  startedAt: string
  lastActivity: string
  violationCount: number
  owner: string
}

interface ResourceUsage {
  usageId: string
  sandboxId: string
  appName: string
  cpuPct: number
  memoryMb: number
  diskIoMbps: number
  networkKbps: number
  cpuLimit: number
  memoryLimit: number
  cpuUtilization: number
  memUtilization: number
  timestamp: string
}

interface SecurityRule {
  ruleId: string
  ruleName: string
  ruleType: string
  scope: string
  enforcement: 'block' | 'warn' | 'audit'
  status: 'active' | 'disabled' | 'override'
  matchCount: number
  lastTriggered: string
  severity: 'critical' | 'major' | 'minor'
  owner: string
}

interface SandboxViolation {
  violationId: string
  sandboxId: string
  appName: string
  violationType: string
  severity: 'critical' | 'major' | 'minor'
  action: 'blocked' | 'warned' | 'logged'
  detail: string
  status: 'open' | 'investigated' | 'resolved'
  detectedAt: string
}

interface SandboxAuditEntry {
  auditId: string
  sandboxId: string
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
function StateBadge({ s }: { s: string }) {
  const m: Record<string, string> = { running: GREEN, idle: SUBTLE, stopped: RED, suspended: AMBER, error: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function IsoLevel({ l }: { l: string }) {
  const m: Record<string, string> = { strict: GREEN, standard: AMBER, permissive: RED }
  const c = m[l] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{l.toUpperCase()}</span>
}
function UsageBar({ pct }: { pct: number }) {
  const col = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(1)}%</span>
    </div>
  )
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, disabled: SUBTLE, override: ORANGE, block: RED, warn: AMBER, audit: BLUE, open: RED, investigated: AMBER, resolved: GREEN, pass: GREEN, fail: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, major: ORANGE, minor: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function AppSandboxUI2() {
  const [tab, setTab] = useState<'sandboxes' | 'resources' | 'security' | 'violations' | 'audit'>('sandboxes')
  const [sandboxes, setSandboxes] = useState<SandboxEntry[]>([])
  const [resources, setResources] = useState<ResourceUsage[]>([])
  const [security, setSecurity] = useState<SecurityRule[]>([])
  const [violations, setViolations] = useState<SandboxViolation[]>([])
  const [auditLog, setAuditLog] = useState<SandboxAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rSa, rR, rSe, rV, rA] = await Promise.allSettled([
        fetch('/api/v4/app-sandbox/sandboxes').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/app-sandbox/resources').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/app-sandbox/security').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/app-sandbox/violations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/app-sandbox/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rSa.status === 'fulfilled') {
        const raw = Array.isArray(rSa.value) ? rSa.value : rSa.value.sandboxes ?? rSa.value.data ?? []
        setSandboxes(raw.map((s: any) => ({
          sandboxId: s.sandbox_id ?? s.sandboxId ?? '', appId: s.app_id ?? s.appId ?? '', appName: s.app_name ?? s.appName ?? '',
          version: s.version ?? '', state: s.state ?? 'idle', isolationLevel: s.isolation_level ?? s.isolationLevel ?? 'standard',
          cpuLimitPct: Number(s.cpu_limit_pct ?? s.cpuLimitPct ?? 0), memoryLimitMb: Number(s.memory_limit_mb ?? s.memoryLimitMb ?? 0),
          networkPolicy: s.network_policy ?? s.networkPolicy ?? '', startedAt: s.started_at ?? s.startedAt ?? '',
          lastActivity: s.last_activity ?? s.lastActivity ?? '', violationCount: Number(s.violation_count ?? s.violationCount ?? 0),
          owner: s.owner ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load sandboxes')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.resources ?? rR.value.data ?? []
        setResources(raw.map((r: any) => ({
          usageId: r.usage_id ?? r.usageId ?? '', sandboxId: r.sandbox_id ?? r.sandboxId ?? '', appName: r.app_name ?? r.appName ?? '',
          cpuPct: Number(r.cpu_pct ?? r.cpuPct ?? 0), memoryMb: Number(r.memory_mb ?? r.memoryMb ?? 0),
          diskIoMbps: Number(r.disk_io_mbps ?? r.diskIoMbps ?? 0), networkKbps: Number(r.network_kbps ?? r.networkKbps ?? 0),
          cpuLimit: Number(r.cpu_limit ?? r.cpuLimit ?? 0), memoryLimit: Number(r.memory_limit ?? r.memoryLimit ?? 0),
          cpuUtilization: Number(r.cpu_utilization ?? r.cpuUtilization ?? 0), memUtilization: Number(r.mem_utilization ?? r.memUtilization ?? 0),
          timestamp: r.timestamp ?? '',
        })))
      }
      if (rSe.status === 'fulfilled') {
        const raw = Array.isArray(rSe.value) ? rSe.value : rSe.value.rules ?? rSe.value.data ?? []
        setSecurity(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.ruleId ?? '', ruleName: r.rule_name ?? r.ruleName ?? '', ruleType: r.rule_type ?? r.ruleType ?? '',
          scope: r.scope ?? '', enforcement: r.enforcement ?? 'audit', status: r.status ?? 'active',
          matchCount: Number(r.match_count ?? r.matchCount ?? 0), lastTriggered: r.last_triggered ?? r.lastTriggered ?? '',
          severity: r.severity ?? 'minor', owner: r.owner ?? '',
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.violations ?? rV.value.data ?? []
        setViolations(raw.map((v: any) => ({
          violationId: v.violation_id ?? v.violationId ?? '', sandboxId: v.sandbox_id ?? v.sandboxId ?? '',
          appName: v.app_name ?? v.appName ?? '', violationType: v.violation_type ?? v.violationType ?? '',
          severity: v.severity ?? 'minor', action: v.action ?? 'logged', detail: v.detail ?? '',
          status: v.status ?? 'open', detectedAt: v.detected_at ?? v.detectedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', sandboxId: a.sandbox_id ?? a.sandboxId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const errorSandboxes = sandboxes.filter(s => s.state === 'error').length
  const openViolations = violations.filter(v => v.status === 'open').length
  const criticalViolations = violations.filter(v => v.severity === 'critical').length
  const overloadedBoxes = resources.filter(r => r.cpuUtilization > 90 || r.memUtilization > 90).length

  const TABS2 = [
    { id: 'sandboxes' as const, label: 'SANDBOXES' },
    { id: 'resources' as const, label: 'RESOURCES' },
    { id: 'security' as const, label: 'SECURITY' },
    { id: 'violations' as const, label: 'VIOLATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>APP SANDBOX â€” ISOLATION + RESOURCE LIMITS + SECURITY BOUNDARIES + VIOLATION MONITORING</span>
        {errorSandboxes > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {errorSandboxes} ERROR</span>}
        {criticalViolations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {criticalViolations} CRITICAL VIOLATIONS</span>}
        {overloadedBoxes > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {overloadedBoxes} OVERLOADED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Sandboxes" value={sandboxes.length} col={BLUE} />
        <StatCard label="Running" value={sandboxes.filter(s => s.state === 'running').length} col={GREEN} />
        <StatCard label="Errors" value={errorSandboxes} col={errorSandboxes > 0 ? RED : GREEN} />
        <StatCard label="Open Violations" value={openViolations} col={openViolations > 0 ? AMBER : GREEN} />
        <StatCard label="Overloaded" value={overloadedBoxes} col={overloadedBoxes > 0 ? ORANGE : GREEN} />
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

        {tab === 'sandboxes' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Sandbox ID</Th><Th>App</Th><Th>Version</Th><Th>State</Th><Th>Isolation</Th><Th right>CPU Limit</Th><Th right>Mem Limit</Th><Th>Network Policy</Th><Th right>Violations</Th><Th>Owner</Th><Th>Last Activity</Th></tr></thead>
              <tbody>
                {sandboxes.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sandboxes â€” check /api/v4/app-sandbox/sandboxes</td></tr>}
                {sandboxes.sort((a, b) => {
                  const p: Record<string, number> = { error: 0, suspended: 1, running: 2, idle: 3, stopped: 4 }
                  return (p[a.state] ?? 5) - (p[b.state] ?? 5)
                }).map((s, i) => (
                  <tr key={i} style={{ background: s.state === 'error' ? RED + '0a' : s.violationCount > 0 ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.sandboxId}</Td>
                    <Td mono col={BLUE}>{s.appName}</Td>
                    <Td mono col={SUBTLE}>{s.version}</Td>
                    <Td><StateBadge s={s.state} /></Td>
                    <Td><IsoLevel l={s.isolationLevel} /></Td>
                    <Td right mono col={SUBTLE}>{s.cpuLimitPct}%</Td>
                    <Td right mono col={SUBTLE}>{s.memoryLimitMb} MB</Td>
                    <Td mono col={PURPLE}>{s.networkPolicy}</Td>
                    <Td right mono col={s.violationCount > 0 ? ORANGE : GREEN}>{s.violationCount}</Td>
                    <Td mono col={SUBTLE}>{s.owner}</Td>
                    <Td mono col={SUBTLE}>{s.lastActivity}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'resources' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>App</Th><Th>CPU Usage</Th><Th>Mem Usage</Th><Th right>CPU %</Th><Th right>Mem MB</Th><Th right>Disk IO</Th><Th right>Network</Th><Th right>CPU Limit</Th><Th right>Mem Limit</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {resources.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No resource data â€” check /api/v4/app-sandbox/resources</td></tr>}
                {resources.sort((a, b) => b.cpuUtilization - a.cpuUtilization).map((r, i) => (
                  <tr key={i} style={{ background: r.cpuUtilization > 90 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.appName}</Td>
                    <Td><UsageBar pct={r.cpuUtilization} /></Td>
                    <Td><UsageBar pct={r.memUtilization} /></Td>
                    <Td right mono col={r.cpuPct > 80 ? RED : SUBTLE}>{r.cpuPct.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{r.memoryMb.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{r.diskIoMbps.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{r.networkKbps.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{r.cpuLimit}%</Td>
                    <Td right mono col={SUBTLE}>{r.memoryLimit} MB</Td>
                    <Td mono col={SUBTLE}>{r.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'security' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th>Type</Th><Th>Scope</Th><Th>Enforcement</Th><Th>Status</Th><Th>Severity</Th><Th right>Matches</Th><Th>Owner</Th><Th>Last Triggered</Th></tr></thead>
              <tbody>
                {security.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rules â€” check /api/v4/app-sandbox/security</td></tr>}
                {security.sort((a, b) => {
                  const p: Record<string, number> = { critical: 0, major: 1, minor: 2 }
                  return (p[a.severity] ?? 3) - (p[b.severity] ?? 3)
                }).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.ruleName}</Td>
                    <Td mono col={PURPLE}>{r.ruleType}</Td>
                    <Td mono col={SUBTLE}>{r.scope}</Td>
                    <Td><StatusBadge2 s={r.enforcement} /></Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td><SevBadge s={r.severity} /></Td>
                    <Td right mono col={r.matchCount > 0 ? ORANGE : SUBTLE}>{r.matchCount}</Td>
                    <Td mono col={SUBTLE}>{r.owner}</Td>
                    <Td mono col={SUBTLE}>{r.lastTriggered || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'violations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Violation ID</Th><Th>App</Th><Th>Type</Th><Th>Severity</Th><Th>Action</Th><Th>Status</Th><Th>Detail</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {violations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No violations â€” check /api/v4/app-sandbox/violations</td></tr>}
                {violations.sort((a, b) => {
                  const p: Record<string, number> = { critical: 0, major: 1, minor: 2 }
                  return (p[a.severity] ?? 3) - (p[b.severity] ?? 3)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.severity === 'critical' ? RED + '0a' : 'transparent', opacity: v.status === 'resolved' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{v.violationId}</Td>
                    <Td mono col={BLUE}>{v.appName}</Td>
                    <Td mono col={PURPLE}>{v.violationType}</Td>
                    <Td><SevBadge s={v.severity} /></Td>
                    <Td><StatusBadge2 s={v.action} /></Td>
                    <Td><StatusBadge2 s={v.status} /></Td>
                    <Td mono col={SUBTLE}>{v.detail.slice(0, 50)}{v.detail.length > 50 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{v.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Sandbox</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/app-sandbox/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.sandboxId}</Td>
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
