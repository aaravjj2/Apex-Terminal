import React, { useState, useEffect, useCallback } from 'react'
﻿// CompatMatrixUI2 â€” Bloomberg CMPX compatibility matrix terminal
// API versioning, breaking changes, deprecation, client compatibility, migration paths
// Tabs: COMPAT MATRIX | BREAKING CHANGES | DEPRECATIONS | CLIENT VERSIONS | MIGRATION
// APIs: /api/v4/compat-matrix/matrix, /breaking, /deprecations, /clients, /migration

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

interface CompatEntry {
  component: string
  version: string
  status: 'stable' | 'beta' | 'deprecated' | 'eol'
  releaseDate: string
  eolDate?: string
  compatibleWith: string[]
  breakingChanges: number
  knownIssues: number
  testedPlatforms: string[]
}

interface BreakingChange {
  id: string
  component: string
  fromVersion: string
  toVersion: string
  changeType: 'api_removal' | 'schema_change' | 'behavior_change' | 'auth_change' | 'config_change'
  description: string
  severity: 'critical' | 'major' | 'minor'
  mitigationPath: string
  affectedClients: number
  discoveredAt: string
}

interface Deprecation {
  id: string
  component: string
  feature: string
  deprecatedIn: string
  removedIn: string
  reason: string
  replacement: string
  migrationGuide: string
  affectedClients: number
  acknowledged: number
}

interface ClientVersion {
  clientId: string
  clientName: string
  currentVersion: string
  latestVersion: string
  versionsBehind: number
  lastUpdated: string
  status: 'current' | 'outdated' | 'critical' | 'incompatible'
  pendingBreakingChanges: number
}

interface MigrationPath {
  id: string
  component: string
  fromVersion: string
  toVersion: string
  status: 'available' | 'in_progress' | 'blocked' | 'completed'
  estimatedEffort: string
  automatedSteps: number
  manualSteps: number
  rollbackSupported: boolean
  testedBy: string[]
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

function VerStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { stable: GREEN, beta: BLUE, deprecated: AMBER, eol: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, major: ORANGE, minor: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function ClientStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { current: GREEN, outdated: AMBER, critical: RED, incompatible: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function ChangeTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { api_removal: RED, schema_change: ORANGE, behavior_change: AMBER, auth_change: PURPLE, config_change: BLUE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.replace(/_/g, ' ').toUpperCase()}</span>
}


export function CompatMatrixUI2() {
  const [tab, setTab] = useState<'matrix' | 'breaking' | 'deprecations' | 'clients' | 'migration'>('matrix')
  const [matrix, setMatrix] = useState<CompatEntry[]>([])
  const [breaking, setBreaking] = useState<BreakingChange[]>([])
  const [deprecations, setDeprecations] = useState<Deprecation[]>([])
  const [clients, setClients] = useState<ClientVersion[]>([])
  const [migration, setMigration] = useState<MigrationPath[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rM, rB, rD, rC, rMig] = await Promise.allSettled([
        fetch('/api/v4/compat-matrix/matrix').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/compat-matrix/breaking').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/compat-matrix/deprecations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/compat-matrix/clients').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/compat-matrix/migration').then(r => r.ok ? r.json() : []),
      ])
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.matrix ?? rM.value.data ?? []
        setMatrix(raw.map((e: any) => ({
          component: e.component ?? '', version: e.version ?? '', status: e.status ?? 'stable',
          releaseDate: e.release_date ?? e.releaseDate ?? '', eolDate: e.eol_date ?? e.eolDate,
          compatibleWith: Array.isArray(e.compatible_with) ? e.compatible_with : e.compatibleWith ?? [],
          breakingChanges: Number(e.breaking_changes ?? e.breakingChanges ?? 0),
          knownIssues: Number(e.known_issues ?? e.knownIssues ?? 0),
          testedPlatforms: Array.isArray(e.tested_platforms) ? e.tested_platforms : e.testedPlatforms ?? [],
        })))
        setErr(null)
      } else setErr('Failed to load matrix')
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.changes ?? rB.value.data ?? []
        setBreaking(raw.map((b: any) => ({
          id: b.id ?? '', component: b.component ?? '', fromVersion: b.from_version ?? b.fromVersion ?? '',
          toVersion: b.to_version ?? b.toVersion ?? '', changeType: b.change_type ?? b.changeType ?? 'api_removal',
          description: b.description ?? '', severity: b.severity ?? 'minor',
          mitigationPath: b.mitigation_path ?? b.mitigationPath ?? '',
          affectedClients: Number(b.affected_clients ?? b.affectedClients ?? 0),
          discoveredAt: b.discovered_at ?? b.discoveredAt ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.deprecations ?? rD.value.data ?? []
        setDeprecations(raw.map((d: any) => ({
          id: d.id ?? '', component: d.component ?? '', feature: d.feature ?? '',
          deprecatedIn: d.deprecated_in ?? d.deprecatedIn ?? '', removedIn: d.removed_in ?? d.removedIn ?? '',
          reason: d.reason ?? '', replacement: d.replacement ?? '', migrationGuide: d.migration_guide ?? d.migrationGuide ?? '',
          affectedClients: Number(d.affected_clients ?? d.affectedClients ?? 0),
          acknowledged: Number(d.acknowledged ?? 0),
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.clients ?? rC.value.data ?? []
        setClients(raw.map((c: any) => ({
          clientId: c.client_id ?? c.clientId ?? '', clientName: c.client_name ?? c.clientName ?? '',
          currentVersion: c.current_version ?? c.currentVersion ?? '', latestVersion: c.latest_version ?? c.latestVersion ?? '',
          versionsBehind: Number(c.versions_behind ?? c.versionsBehind ?? 0), lastUpdated: c.last_updated ?? c.lastUpdated ?? '',
          status: c.status ?? 'current', pendingBreakingChanges: Number(c.pending_breaking_changes ?? c.pendingBreakingChanges ?? 0),
        })))
      }
      if (rMig.status === 'fulfilled') {
        const raw = Array.isArray(rMig.value) ? rMig.value : rMig.value.paths ?? rMig.value.data ?? []
        setMigration(raw.map((m: any) => ({
          id: m.id ?? '', component: m.component ?? '', fromVersion: m.from_version ?? m.fromVersion ?? '',
          toVersion: m.to_version ?? m.toVersion ?? '', status: m.status ?? 'available',
          estimatedEffort: m.estimated_effort ?? m.estimatedEffort ?? '',
          automatedSteps: Number(m.automated_steps ?? m.automatedSteps ?? 0),
          manualSteps: Number(m.manual_steps ?? m.manualSteps ?? 0),
          rollbackSupported: Boolean(m.rollback_supported ?? m.rollbackSupported ?? false),
          testedBy: Array.isArray(m.tested_by) ? m.tested_by : m.testedBy ?? [],
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 60000); return () => clearInterval(id) }, [fetchAll])

  const criticalBreaking = breaking.filter(b => b.severity === 'critical').length
  const criticalClients = clients.filter(c => c.status === 'critical' || c.status === 'incompatible').length
  const eolComponents = matrix.filter(m => m.status === 'eol').length
  const unackDeprecations = deprecations.reduce((s, d) => s + Math.max(0, d.affectedClients - d.acknowledged), 0)

  const TABS = [
    { id: 'matrix' as const, label: 'COMPAT MATRIX' },
    { id: 'breaking' as const, label: 'BREAKING CHANGES' },
    { id: 'deprecations' as const, label: 'DEPRECATIONS' },
    { id: 'clients' as const, label: 'CLIENT VERSIONS' },
    { id: 'migration' as const, label: 'MIGRATION' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CMPX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>COMPATIBILITY MATRIX â€” API VERSIONS + BREAKING CHANGES + EOL + CLIENT TRACKING + MIGRATION PATHS</span>
        {criticalBreaking > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {criticalBreaking} CRITICAL BREAKING</span>}
        {criticalClients > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {criticalClients} INCOMPATIBLE CLIENTS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Components" value={matrix.length} />
        <StatCard label="EOL" value={eolComponents} col={eolComponents > 0 ? RED : GREEN} />
        <StatCard label="Critical Breaking" value={criticalBreaking} col={criticalBreaking > 0 ? RED : GREEN} />
        <StatCard label="Critical Clients" value={criticalClients} col={criticalClients > 0 ? RED : GREEN} />
        <StatCard label="Unack Deprecations" value={unackDeprecations} col={unackDeprecations > 0 ? AMBER : GREEN} />
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

        {tab === 'matrix' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Component</Th><Th>Version</Th><Th>Status</Th><Th>Release Date</Th><Th>EOL</Th><Th right>Breaking</Th><Th right>Issues</Th><Th>Compatible With</Th></tr></thead>
              <tbody>
                {matrix.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No matrix â€” check /api/v4/compat-matrix/matrix</td></tr>}
                {matrix.sort((a, b) => { const o: Record<string, number> = { stable: 0, beta: 1, deprecated: 2, eol: 3 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'eol' ? RED + '0a' : e.status === 'deprecated' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.component}</Td>
                    <Td mono col={BLUE}>{e.version}</Td>
                    <Td><VerStatusBadge s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.releaseDate}</Td>
                    <Td mono col={e.eolDate ? RED : SUBTLE}>{e.eolDate ?? 'â€”'}</Td>
                    <Td right mono col={e.breakingChanges > 0 ? RED : GREEN}>{e.breakingChanges}</Td>
                    <Td right mono col={e.knownIssues > 0 ? AMBER : GREEN}>{e.knownIssues}</Td>
                    <Td><span style={{ fontSize: 9, color: SUBTLE }}>{e.compatibleWith.join(', ') || 'â€”'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'breaking' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Component</Th><Th>From â†’ To</Th><Th>Type</Th><Th>Severity</Th><Th right>Affected</Th><Th>Description</Th><Th>Mitigation</Th></tr></thead>
              <tbody>
                {breaking.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No breaking changes â€” check /api/v4/compat-matrix/breaking</td></tr>}
                {breaking.sort((a, b) => { const o: Record<string, number> = { critical: 0, major: 1, minor: 2 }; return (o[a.severity] ?? 9) - (o[b.severity] ?? 9) }).map((b, i) => (
                  <tr key={i} style={{ background: b.severity === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.component}</Td>
                    <Td mono col={SUBTLE}>{b.fromVersion} â†’ {b.toVersion}</Td>
                    <Td><ChangeTypeBadge t={b.changeType} /></Td>
                    <Td><SeverityBadge s={b.severity} /></Td>
                    <Td right mono col={b.affectedClients > 10 ? RED : TEXT}>{b.affectedClients}</Td>
                    <Td><span style={{ fontSize: 10, color: TEXT }}>{b.description}</span></Td>
                    <Td><span style={{ fontSize: 10, color: GREEN }}>{b.mitigationPath || 'â€”'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deprecations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Component</Th><Th>Feature</Th><Th>Deprecated In</Th><Th>Removed In</Th><Th>Replacement</Th><Th right>Affected</Th><Th right>Ack'd</Th><Th>Reason</Th></tr></thead>
              <tbody>
                {deprecations.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No deprecations â€” check /api/v4/compat-matrix/deprecations</td></tr>}
                {deprecations.sort((a, b) => b.affectedClients - a.affectedClients).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.component}</Td>
                    <Td mono col={RED}>{d.feature}</Td>
                    <Td mono col={SUBTLE}>{d.deprecatedIn}</Td>
                    <Td mono col={RED}>{d.removedIn}</Td>
                    <Td mono col={GREEN}>{d.replacement || 'â€”'}</Td>
                    <Td right mono col={d.affectedClients > 0 ? ORANGE : SUBTLE}>{d.affectedClients}</Td>
                    <Td right mono col={d.acknowledged >= d.affectedClients ? GREEN : AMBER}>{d.acknowledged}</Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{d.reason}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'clients' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Client</Th><Th>Current Version</Th><Th>Latest</Th><Th>Status</Th><Th right>Behind</Th><Th right>Pending Breaking</Th><Th>Last Updated</Th></tr></thead>
              <tbody>
                {clients.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No clients â€” check /api/v4/compat-matrix/clients</td></tr>}
                {clients.sort((a, b) => b.versionsBehind - a.versionsBehind).map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'critical' || c.status === 'incompatible' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.clientName}</Td>
                    <Td mono col={c.status !== 'current' ? AMBER : GREEN}>{c.currentVersion}</Td>
                    <Td mono col={BLUE}>{c.latestVersion}</Td>
                    <Td><ClientStatusBadge s={c.status} /></Td>
                    <Td right mono col={c.versionsBehind > 5 ? RED : c.versionsBehind > 2 ? AMBER : GREEN}>{c.versionsBehind}</Td>
                    <Td right mono col={c.pendingBreakingChanges > 0 ? RED : GREEN}>{c.pendingBreakingChanges}</Td>
                    <Td mono col={SUBTLE}>{c.lastUpdated}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'migration' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Component</Th><Th>From â†’ To</Th><Th>Status</Th><Th>Effort</Th><Th right>Auto Steps</Th><Th right>Manual Steps</Th><Th>Rollback</Th><Th>Tested By</Th></tr></thead>
              <tbody>
                {migration.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No migration paths â€” check /api/v4/compat-matrix/migration</td></tr>}
                {migration.map((m, i) => (
                  <tr key={i} style={{ background: m.status === 'blocked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.component}</Td>
                    <Td mono col={SUBTLE}>{m.fromVersion} â†’ {m.toVersion}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: m.status === 'completed' ? GREEN : m.status === 'in_progress' ? BLUE : m.status === 'blocked' ? RED : AMBER }}>{m.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{m.estimatedEffort}</Td>
                    <Td right mono col={GREEN}>{m.automatedSteps}</Td>
                    <Td right mono col={m.manualSteps > 5 ? RED : AMBER}>{m.manualSteps}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: m.rollbackSupported ? GREEN : RED }}>{m.rollbackSupported ? 'YES' : 'NO'}</span></Td>
                    <Td><span style={{ fontSize: 9, color: SUBTLE }}>{m.testedBy.join(', ') || 'â€”'}</span></Td>
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

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'data',      label: 'Data' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'config',    label: 'Configuration' },
];

const S = {
  page:    { height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  content: { flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' },
  gap:     { display: 'flex', flexDirection: 'column' as const, gap: 'var(--ui2-space-4)' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ui2-space-3)' },
  grid3:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--ui2-space-3)' },
  surface: { background: 'var(--ui2-bg-surface)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)' } as React.CSSProperties,
  mono:    { fontFamily: 'var(--ui2-font-mono)', fontSize: '11px', color: 'var(--ui2-text-tertiary)' } as React.CSSProperties,
  dimText: { fontSize: '11px', color: 'var(--ui2-text-muted)' } as React.CSSProperties,
  label:   { fontSize: '11px', fontWeight: 600, color: 'var(--ui2-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', display: 'block' } as React.CSSProperties,
  errorBox:  { background: 'var(--ui2-danger-bg)', border: '1px solid var(--ui2-danger-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-danger)', fontSize: '13px' } as React.CSSProperties,
};

interface DataItem { [key: string]: unknown }

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={S.dimText}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }}>{value}</span>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.surface}>
      <div style={S.dimText}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--ui2-font-mono)', color: 'var(--ui2-text-primary)', marginTop: '2px' }}>{value}</div>
    </div>
  );
}

