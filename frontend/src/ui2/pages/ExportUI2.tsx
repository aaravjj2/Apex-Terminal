import React, { useState, useEffect, useCallback } from 'react'
﻿// ExportUI2 â€” Bloomberg APEX Export Bundle V3 terminal
// Judge bundle builder, artifact manifest, export state, format config, audit
// Tabs: EXPORT | MANIFEST | ARTIFACTS | FORMATS | AUDIT
// APIs: /api/v3/export/bundle, /manifest, /artifacts, /formats, /audit

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
  name: string
  status: 'ready' | 'building' | 'failed' | 'archived' | 'uploading'
  sizeBytes: number
  fileCount: number
  bundleHash: string
  exportVersion: string
  createdAt: string
  downloadUrl: string | null
}

interface ExportManifest {
  bundleId: string
  exportVersion: string
  available: boolean
  artifacts: Array<{
    key: string
    count: number
    status: string
    description: string
  }>
  timestamp: string
  signerKey: string
}

interface ExportArtifact {
  artifactId: string
  bundleId: string
  name: string
  type: 'trading_state' | 'decisions' | 'workflows' | 'telemetry' | 'search_meta' | 'platform_health' | 'strategy'
  status: 'ready' | 'building' | 'failed'
  sizeBytes: number
  sha256: string
  rowCount: number | null
  createdAt: string
}

interface ExportFormat {
  formatId: string
  name: string
  extension: string
  description: string
  compression: 'gzip' | 'zstd' | 'none' | 'brotli'
  supported: boolean
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
  const m: Record<string, string> = { ready: GREEN, building: AMBER, failed: RED, archived: SUBTLE, uploading: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function fmtBytes(b: number) {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}


export function ExportUI2() {
  const [tab, setTab] = useState<'export' | 'manifest' | 'artifacts' | 'formats' | 'audit'>('export')
  const [bundles, setBundles] = useState<ExportBundle[]>([])
  const [manifest, setManifest] = useState<ExportManifest | null>(null)
  const [artifacts, setArtifacts] = useState<ExportArtifact[]>([])
  const [formats, setFormats] = useState<ExportFormat[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildMsg, setBuildMsg] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rB, rM, rA, rF, rL] = await Promise.allSettled([
        fetch('/api/v3/export/bundles').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/manifest').then(r => r.ok ? r.json() : null),
        fetch('/api/v3/export/artifacts').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/formats').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/export/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.bundles ?? rB.value.data ?? []
        setBundles(raw.map((b: any) => ({
          bundleId: b.bundle_id ?? b.bundleId ?? b.id ?? '',
          name: b.name ?? '', status: b.status ?? 'ready',
          sizeBytes: Number(b.size_bytes ?? b.sizeBytes ?? b.size ?? 0),
          fileCount: Number(b.file_count ?? b.fileCount ?? 0),
          bundleHash: b.bundle_hash ?? b.bundleHash ?? '',
          exportVersion: b.export_version ?? b.exportVersion ?? '',
          createdAt: b.created_at ?? b.createdAt ?? '',
          downloadUrl: b.download_url ?? b.downloadUrl ?? null,
        })))
        setErr(null)
      } else setErr('Failed to load export bundles')
      if (rM.status === 'fulfilled' && rM.value) {
        const m = rM.value
        const arts = m.artifacts ? (typeof m.artifacts === 'object' && !Array.isArray(m.artifacts)
          ? Object.entries(m.artifacts).map(([key, val]: any) => ({ key, count: val?.count ?? val?.order_count ?? val?.decision_count ?? 0, status: val?.status ?? 'ok', description: key }))
          : m.artifacts)
          : []
        setManifest({
          bundleId: m.bundle_id ?? m.bundleId ?? '',
          exportVersion: m.export_version ?? m.exportVersion ?? '',
          available: Boolean(m.available),
          artifacts: arts,
          timestamp: m.timestamp ?? '',
          signerKey: m.signer_key ?? m.signerKey ?? '',
        })
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.artifacts ?? rA.value.data ?? []
        setArtifacts(raw.map((a: any) => ({
          artifactId: a.artifact_id ?? a.artifactId ?? a.id ?? '',
          bundleId: a.bundle_id ?? a.bundleId ?? '',
          name: a.name ?? '', type: a.type ?? 'trading_state',
          status: a.status ?? 'ready',
          sizeBytes: Number(a.size_bytes ?? a.sizeBytes ?? 0),
          sha256: a.sha256 ?? '',
          rowCount: a.row_count ?? a.rowCount ?? null,
          createdAt: a.created_at ?? a.createdAt ?? '',
        })))
      }
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.formats ?? rF.value.data ?? []
        setFormats(raw.map((f: any) => ({
          formatId: f.format_id ?? f.formatId ?? f.id ?? '',
          name: f.name ?? '', extension: f.extension ?? '',
          description: f.description ?? '',
          compression: f.compression ?? 'none',
          supported: Boolean(f.supported ?? true),
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.audit ?? rL.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleBuild = async () => {
    setBuilding(true); setBuildMsg(null)
    try {
      const r = await fetch('/api/v3/export/bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'zip' }) })
      if (r.ok) { const d = await r.json(); setBuildMsg(`Bundle built: ${d.bundle_id ?? d.filename ?? 'ok'}`); fetchAll() }
      else setBuildMsg('Build failed â€” check backend')
    } catch (e: any) { setBuildMsg(e.message) }
    finally { setBuilding(false) }
  }

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const readyBundles = bundles.filter(b => b.status === 'ready').length
  const totalSize = bundles.reduce((s, b) => s + b.sizeBytes, 0)
  const artReady = artifacts.filter(a => a.status === 'ready').length

  const TABS2 = [
    { id: 'export' as const, label: 'EXPORT' },
    { id: 'manifest' as const, label: 'MANIFEST' },
    { id: 'artifacts' as const, label: 'ARTIFACTS' },
    { id: 'formats' as const, label: 'FORMATS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXPORT BUNDLE V3 â€” JUDGE BUNDLE BUILDER + MANIFEST + ARTIFACT REGISTRY + INTEGRITY</span>
        {loading && <span style={{ fontSize: 10, color: AMBER }}>LOADINGâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {buildMsg && <span style={{ fontSize: 10, color: GREEN }}>{buildMsg}</span>}
          <button onClick={handleBuild} disabled={building}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: building ? SUBTLE : AMBER, background: (building ? SUBTLE : AMBER) + '22', border: `1px solid ${building ? SUBTLE : AMBER}44`, borderRadius: 3, padding: '4px 10px', cursor: building ? 'not-allowed' : 'pointer' }}>
            {building ? 'BUILDINGâ€¦' : 'BUILD BUNDLE'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Bundles" value={bundles.length} col={TEXT} />
        <StatCard label="Ready Bundles" value={readyBundles} col={GREEN} />
        <StatCard label="Total Size" value={fmtBytes(totalSize)} col={BLUE} />
        <StatCard label="Artifacts Ready" value={artReady} col={artReady > 0 ? GREEN : AMBER} />
        <StatCard label="Manifest" value={manifest?.available ? 'AVAILABLE' : 'PENDING'} col={manifest?.available ? GREEN : AMBER} />
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
        {tab === 'export' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Bundle ID</Th><Th>Name</Th><Th>Status</Th><Th>Version</Th><Th right>Files</Th><Th right>Size</Th><Th>Hash</Th><Th>Created</Th><Th>Action</Th></tr></thead>
              <tbody>
                {bundles.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No bundles â€” POST to /api/v3/export/bundle to build</td></tr>}
                {bundles.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((b, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{b.bundleId.slice(0, 12)}</Td>
                    <Td mono col={TEXT}>{b.name.slice(0, 28)}</Td>
                    <Td><StatusBadge s={b.status} /></Td>
                    <Td mono col={SUBTLE}>{b.exportVersion}</Td>
                    <Td right mono col={TEXT}>{b.fileCount}</Td>
                    <Td right mono col={TEXT}>{fmtBytes(b.sizeBytes)}</Td>
                    <Td mono col={SUBTLE}>{b.bundleHash.slice(0, 12)}â€¦</Td>
                    <Td mono col={SUBTLE}>{b.createdAt}</Td>
                    <Td>
                      {b.downloadUrl && <a href={b.downloadUrl} style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>DOWNLOAD</a>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'manifest' && (
          <div>
            {!manifest && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No manifest â€” check /api/v3/export/manifest</div>}
            {manifest && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <StatCard label="Bundle ID" value={manifest.bundleId.slice(0, 12)} col={AMBER} />
                  <StatCard label="Export Version" value={manifest.exportVersion} col={BLUE} />
                  <StatCard label="Available" value={manifest.available ? 'YES' : 'NO'} col={manifest.available ? GREEN : RED} />
                  <StatCard label="Signer Key" value={manifest.signerKey.slice(0, 14) || 'â€”'} col={PURPLE} />
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><Th>Artifact Key</Th><Th>Description</Th><Th right>Count</Th><Th>Status</Th></tr></thead>
                    <tbody>
                      {manifest.artifacts.map((a, i) => (
                        <tr key={i}>
                          <Td mono col={AMBER}>{a.key}</Td>
                          <Td mono col={SUBTLE}>{a.description}</Td>
                          <Td right mono col={TEXT}>{a.count.toLocaleString()}</Td>
                          <Td><StatusBadge s={a.status} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'artifacts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Artifact ID</Th><Th>Name</Th><Th>Type</Th><Th>Status</Th><Th right>Rows</Th><Th right>Size</Th><Th>SHA256</Th><Th>Created</Th></tr></thead>
              <tbody>
                {artifacts.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No artifacts â€” check /api/v3/export/artifacts</td></tr>}
                {artifacts.sort((a, b) => b.sizeBytes - a.sizeBytes).map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.artifactId.slice(0, 10)}</Td>
                    <Td mono col={TEXT}>{a.name.slice(0, 28)}</Td>
                    <Td mono col={BLUE}>{a.type}</Td>
                    <Td><StatusBadge s={a.status} /></Td>
                    <Td right mono col={TEXT}>{a.rowCount !== null ? a.rowCount.toLocaleString() : 'â€”'}</Td>
                    <Td right mono col={TEXT}>{fmtBytes(a.sizeBytes)}</Td>
                    <Td mono col={SUBTLE}>{a.sha256.slice(0, 14)}â€¦</Td>
                    <Td mono col={SUBTLE}>{a.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'formats' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Format ID</Th><Th>Name</Th><Th>Extension</Th><Th>Compression</Th><Th>Description</Th><Th>Supported</Th></tr></thead>
              <tbody>
                {formats.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No formats â€” check /api/v3/export/formats</td></tr>}
                {formats.map((f, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{f.formatId}</Td>
                    <Td mono col={TEXT}>{f.name}</Td>
                    <Td mono col={BLUE}>{f.extension}</Td>
                    <Td mono col={ORANGE}>{f.compression}</Td>
                    <Td mono col={SUBTLE}>{f.description.slice(0, 50)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: f.supported ? GREEN : RED, background: (f.supported ? GREEN : RED) + '22', borderRadius: 3, padding: '2px 5px' }}>{f.supported ? 'YES' : 'NO'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v3/export/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
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
