import React, { useState, useEffect, useCallback } from 'react'
﻿// ExportBundleUI2 â€” Bloomberg APEX Export Bundle terminal
// One-click judge bundle: manifest, ES templates, DB tables, integrity hashing
// Tabs: BUNDLES | MANIFEST | TEMPLATES | DATABASE | AUDIT
// APIs: /api/v3/export/bundles, /manifest, /templates, /database, /audit

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

interface ExportBundle {
  bundleId: string
  version: string
  status: 'ready' | 'building' | 'failed' | 'archived'
  sizeBytes: number
  fileCount: number
  bundleHash: string
  createdAt: string
  createdBy: string
  schemaVersion: string
  includes: string[]
}

interface BundleManifest {
  bundleId: string
  version: string
  files: Array<{ name: string; sha256: string; sizeBytes: number; type: string }>
  bundleHash: string
  signedAt: string
  signerKey: string
}

interface ExportTemplate {
  templateId: string
  name: string
  indexPattern: string
  mappingVersion: string
  shards: number
  replicas: number
  status: 'active' | 'deprecated' | 'draft'
  docCount: number
  sizeBytes: number
}

interface DatabaseTable {
  tableName: string
  rowCount: number
  sizeBytes: number
  lastModified: string
  included: boolean
  schemaVersion: string
}

interface ExportAuditEntry {
  auditId: string
  action: string
  actor: string
  bundleId: string
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
  const m: Record<string, string> = { ready: GREEN, building: AMBER, failed: RED, archived: SUBTLE, active: GREEN, deprecated: SUBTLE, draft: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(2) + ' MB'
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB'
  return b + ' B'
}


export function ExportBundleUI2() {
  const [tab, setTab] = useState<'bundles' | 'manifest' | 'templates' | 'database' | 'audit'>('bundles')
  const [bundles, setBundles] = useState<ExportBundle[]>([])
  const [manifests, setManifests] = useState<BundleManifest[]>([])
  const [templates, setTemplates] = useState<ExportTemplate[]>([])
  const [tables, setTables] = useState<DatabaseTable[]>([])
  const [auditLog, setAuditLog] = useState<ExportAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [buildStatus, setBuildStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  const fetchAll = useCallback(async () => {
    try {
      const [rB, rM, rT, rD, rA] = await Promise.allSettled([
        fetch('/api/v3/export/bundles').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/manifest').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/templates').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/database').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.bundles ?? rB.value.data ?? []
        setBundles(raw.map((b: any) => ({
          bundleId: b.bundle_id ?? b.bundleId ?? b.id ?? '',
          version: b.version ?? '', status: b.status ?? 'ready',
          sizeBytes: Number(b.size_bytes ?? b.sizeBytes ?? 0),
          fileCount: Number(b.file_count ?? b.fileCount ?? 0),
          bundleHash: b.bundle_hash ?? b.bundleHash ?? '',
          createdAt: b.created_at ?? b.createdAt ?? '',
          createdBy: b.created_by ?? b.createdBy ?? '',
          schemaVersion: b.schema_version ?? b.schemaVersion ?? '',
          includes: b.includes ?? [],
        })))
        setErr(null)
      } else setErr('Failed to load export bundles')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.manifests ?? [rM.value]
        setManifests(raw.map((m: any) => ({
          bundleId: m.bundle_id ?? m.bundleId ?? '',
          version: m.version ?? '',
          files: (m.files ?? []).map((f: any) => ({ name: f.name ?? f.filename ?? '', sha256: f.sha256 ?? '', sizeBytes: Number(f.size_bytes ?? f.sizeBytes ?? 0), type: f.type ?? '' })),
          bundleHash: m.bundle_hash ?? m.bundleHash ?? '',
          signedAt: m.signed_at ?? m.signedAt ?? '',
          signerKey: m.signer_key ?? m.signerKey ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.templates ?? rT.value.data ?? []
        setTemplates(raw.map((t: any) => ({
          templateId: t.template_id ?? t.templateId ?? t.id ?? '',
          name: t.name ?? '', indexPattern: t.index_pattern ?? t.indexPattern ?? '',
          mappingVersion: t.mapping_version ?? t.mappingVersion ?? '',
          shards: Number(t.shards ?? 1), replicas: Number(t.replicas ?? 1),
          status: t.status ?? 'active',
          docCount: Number(t.doc_count ?? t.docCount ?? 0),
          sizeBytes: Number(t.size_bytes ?? t.sizeBytes ?? 0),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.tables ?? rD.value.data ?? []
        setTables(raw.map((t: any) => ({
          tableName: t.table_name ?? t.tableName ?? '',
          rowCount: Number(t.row_count ?? t.rowCount ?? 0),
          sizeBytes: Number(t.size_bytes ?? t.sizeBytes ?? 0),
          lastModified: t.last_modified ?? t.lastModified ?? '',
          included: Boolean(t.included ?? true),
          schemaVersion: t.schema_version ?? t.schemaVersion ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          bundleId: a.bundle_id ?? a.bundleId ?? '',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const handleBuild = useCallback(async () => {
    setBuildStatus('running')
    try {
      const r = await fetch('/api/v3/export', { method: 'POST' })
      if (r.ok) { setBuildStatus('done'); setTimeout(fetchAll, 2000) }
      else setBuildStatus('error')
    } catch { setBuildStatus('error') }
    finally { setTimeout(() => setBuildStatus('idle'), 5000) }
  }, [fetchAll])

  const readyBundles = bundles.filter(b => b.status === 'ready').length
  const latestBundle = bundles.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const totalSize = bundles.reduce((s, b) => s + b.sizeBytes, 0)
  const includedTables = tables.filter(t => t.included).length

  const TABS2 = [
    { id: 'bundles' as const, label: 'BUNDLES' },
    { id: 'manifest' as const, label: 'MANIFEST' },
    { id: 'templates' as const, label: 'ES TEMPLATES' },
    { id: 'database' as const, label: 'DATABASE' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXPORT BUNDLE â€” JUDGE BUNDLE BUILDER + MANIFEST + ES TEMPLATES + DB TABLES</span>
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
        <button onClick={handleBuild} disabled={buildStatus === 'running'} style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, fontWeight: 700, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 3, padding: '5px 14px', cursor: buildStatus === 'running' ? 'wait' : 'pointer' }}>
          {buildStatus === 'running' ? 'BUILDINGâ€¦' : buildStatus === 'done' ? 'BUILT âœ“' : buildStatus === 'error' ? 'ERROR' : 'BUILD BUNDLE'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Bundles" value={bundles.length} col={BLUE} />
        <StatCard label="Ready" value={readyBundles} col={GREEN} />
        <StatCard label="Total Size" value={fmtBytes(totalSize)} col={AMBER} />
        <StatCard label="ES Templates" value={templates.length} col={PURPLE} />
        <StatCard label="DB Tables Included" value={`${includedTables} / ${tables.length}`} col={TEXT} />
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
        {tab === 'bundles' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Bundle ID</Th><Th>Version</Th><Th>Status</Th><Th>Schema</Th><Th right>Files</Th><Th right>Size</Th><Th>Bundle Hash</Th><Th>Created By</Th><Th>Created At</Th></tr></thead>
              <tbody>
                {bundles.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No bundles â€” check /api/v3/export/bundles or build one</td></tr>}
                {bundles.map((b, i) => (
                  <tr key={i} style={{ background: b.status === 'failed' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.bundleId}</Td>
                    <Td mono col={TEXT}>{b.version}</Td>
                    <Td><StatusBadge s={b.status} /></Td>
                    <Td mono col={SUBTLE}>{b.schemaVersion || 'â€”'}</Td>
                    <Td right mono col={TEXT}>{b.fileCount}</Td>
                    <Td right mono col={TEXT}>{fmtBytes(b.sizeBytes)}</Td>
                    <Td mono col={SUBTLE}>{b.bundleHash.slice(0, 16)}â€¦</Td>
                    <Td mono col={SUBTLE}>{b.createdBy || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{b.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'manifest' && (
          <div>
            {manifests.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No manifests â€” check /api/v3/export/manifest</div>}
            {manifests.map((m, idx) => (
              <div key={idx} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: AMBER, fontFamily: MONO }}>{m.bundleId}</span>
                  <span style={{ fontSize: 10, color: SUBTLE }}>v{m.version}</span>
                  <span style={{ fontSize: 10, color: SUBTLE }}>Hash: {m.bundleHash.slice(0, 20)}â€¦</span>
                  <span style={{ fontSize: 10, color: GREEN }}>Signed: {m.signedAt || 'â€”'}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>File Name</Th><Th>Type</Th><Th right>Size</Th><Th>SHA-256</Th></tr></thead>
                  <tbody>
                    {m.files.map((f, fi) => (
                      <tr key={fi}>
                        <Td mono col={BLUE}>{f.name}</Td>
                        <Td mono col={SUBTLE}>{f.type || 'â€”'}</Td>
                        <Td right mono col={TEXT}>{fmtBytes(f.sizeBytes)}</Td>
                        <Td mono col={SUBTLE}>{f.sha256.slice(0, 24)}â€¦</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        {tab === 'templates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Template ID</Th><Th>Name</Th><Th>Index Pattern</Th><Th>Mapping Ver.</Th><Th>Status</Th><Th right>Shards</Th><Th right>Replicas</Th><Th right>Docs</Th><Th right>Size</Th></tr></thead>
              <tbody>
                {templates.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No ES templates â€” check /api/v3/export/templates</td></tr>}
                {templates.map((t, i) => (
                  <tr key={i} style={{ opacity: t.status === 'deprecated' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{t.templateId}</Td>
                    <Td mono col={TEXT}>{t.name}</Td>
                    <Td mono col={BLUE}>{t.indexPattern}</Td>
                    <Td mono col={SUBTLE}>{t.mappingVersion || 'â€”'}</Td>
                    <Td><StatusBadge s={t.status} /></Td>
                    <Td right mono col={TEXT}>{t.shards}</Td>
                    <Td right mono col={TEXT}>{t.replicas}</Td>
                    <Td right mono col={TEXT}>{t.docCount.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{fmtBytes(t.sizeBytes)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'database' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Table Name</Th><Th>Schema Ver.</Th><Th right>Row Count</Th><Th right>Size</Th><Th>Included</Th><Th>Last Modified</Th></tr></thead>
              <tbody>
                {tables.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No database tables â€” check /api/v3/export/database</td></tr>}
                {tables.map((t, i) => (
                  <tr key={i} style={{ opacity: t.included ? 1 : 0.4 }}>
                    <Td mono col={AMBER}>{t.tableName}</Td>
                    <Td mono col={SUBTLE}>{t.schemaVersion || 'â€”'}</Td>
                    <Td right mono col={TEXT}>{t.rowCount.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{fmtBytes(t.sizeBytes)}</Td>
                    <Td mono col={t.included ? GREEN : SUBTLE}>{t.included ? 'âœ“ YES' : 'âœ— NO'}</Td>
                    <Td mono col={SUBTLE}>{t.lastModified || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Bundle ID</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v3/export/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.bundleId || 'â€”'}</Td>
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
