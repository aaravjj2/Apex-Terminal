import React, { useState, useEffect, useCallback } from 'react'
﻿// ResearchNotebookUI2 — Bloomberg APEX research notebook terminal
// Collaborative notebooks, code execution, version management, sharing
// Tabs: NOTEBOOKS | CELLS | EXECUTIONS | SHARING | AUDIT
// APIs: /api/v4/notebooks/notebooks, /cells, /executions, /sharing, /audit

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

interface Notebook {
  notebookId: string
  title: string
  author: string
  kernelType: 'python' | 'r' | 'julia' | 'scala' | 'sql'
  status: 'active' | 'idle' | 'running' | 'error' | 'archived'
  cellCount: number
  codeCellCount: number
  markdownCellCount: number
  outputCellCount: number
  lastExecutedAt: string
  lastModifiedAt: string
  collaborators: number
  isPublic: boolean
  version: string
}

interface NotebookCell {
  cellId: string
  notebookId: string
  cellType: 'code' | 'markdown' | 'output' | 'annotation'
  executionOrder: number
  executionStatus: 'success' | 'error' | 'pending' | 'skipped'
  executionTime: number
  language: string
  outputType: string
  hasError: boolean
  errorMessage: string
  lastRunAt: string
}

interface Execution {
  executionId: string
  notebookId: string
  triggeredBy: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  totalCells: number
  completedCells: number
  failedCells: number
  startedAt: string
  completedAt: string
  durationSecs: number
  memoryPeakMb: number
  kernelVersion: string
}

interface NotebookShare {
  shareId: string
  notebookId: string
  sharedWith: string
  permission: 'view' | 'comment' | 'edit' | 'execute' | 'admin'
  sharedAt: string
  expiresAt: string
  lastAccessedAt: string
}

interface NotebookAuditEntry {
  auditId: string
  notebookId: string
  action: string
  actor: string
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
function KernelBadge({ k }: { k: string }) {
  const m: Record<string, string> = { python: BLUE, r: GREEN, julia: PURPLE, scala: ORANGE, sql: AMBER }
  const c = m[k] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{k.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, idle: SUBTLE, running: AMBER, error: RED, archived: SUBTLE, success: GREEN, pending: AMBER, skipped: SUBTLE, completed: GREEN, failed: RED, cancelled: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function PermBadge({ p }: { p: string }) {
  const m: Record<string, string> = { view: SUBTLE, comment: BLUE, edit: AMBER, execute: ORANGE, admin: RED }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}


export function ResearchNotebookUI2() {
  const [tab, setTab] = useState<'notebooks' | 'cells' | 'executions' | 'sharing' | 'audit'>('notebooks')
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [cells, setCells] = useState<NotebookCell[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [shares, setShares] = useState<NotebookShare[]>([])
  const [auditLog, setAuditLog] = useState<NotebookAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rN, rC, rE, rS, rA] = await Promise.allSettled([
        fetch('/api/v4/notebooks/notebooks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/notebooks/cells').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/notebooks/executions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/notebooks/sharing').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/notebooks/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rN.status === 'fulfilled') {
        const raw = Array.isArray(rN.value) ? rN.value : rN.value.notebooks ?? rN.value.data ?? []
        setNotebooks(raw.map((n: any) => ({
          notebookId: n.notebook_id ?? n.notebookId ?? '', title: n.title ?? '',
          author: n.author ?? '', kernelType: n.kernel_type ?? n.kernelType ?? 'python',
          status: n.status ?? 'idle', cellCount: Number(n.cell_count ?? n.cellCount ?? 0),
          codeCellCount: Number(n.code_cell_count ?? n.codeCellCount ?? 0),
          markdownCellCount: Number(n.markdown_cell_count ?? n.markdownCellCount ?? 0),
          outputCellCount: Number(n.output_cell_count ?? n.outputCellCount ?? 0),
          lastExecutedAt: n.last_executed_at ?? n.lastExecutedAt ?? '',
          lastModifiedAt: n.last_modified_at ?? n.lastModifiedAt ?? '',
          collaborators: Number(n.collaborators ?? 0), isPublic: Boolean(n.is_public ?? n.isPublic),
          version: n.version ?? '1.0',
        })))
        setErr(null)
      } else setErr('Failed to load notebooks')
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.cells ?? rC.value.data ?? []
        setCells(raw.map((c: any) => ({
          cellId: c.cell_id ?? c.cellId ?? '', notebookId: c.notebook_id ?? c.notebookId ?? '',
          cellType: c.cell_type ?? c.cellType ?? 'code',
          executionOrder: Number(c.execution_order ?? c.executionOrder ?? 0),
          executionStatus: c.execution_status ?? c.executionStatus ?? 'pending',
          executionTime: Number(c.execution_time ?? c.executionTime ?? 0),
          language: c.language ?? '', outputType: c.output_type ?? c.outputType ?? '',
          hasError: Boolean(c.has_error ?? c.hasError), errorMessage: c.error_message ?? c.errorMessage ?? '',
          lastRunAt: c.last_run_at ?? c.lastRunAt ?? '',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.executions ?? rE.value.data ?? []
        setExecutions(raw.map((e: any) => ({
          executionId: e.execution_id ?? e.executionId ?? '', notebookId: e.notebook_id ?? e.notebookId ?? '',
          triggeredBy: e.triggered_by ?? e.triggeredBy ?? '', status: e.status ?? 'completed',
          totalCells: Number(e.total_cells ?? e.totalCells ?? 0),
          completedCells: Number(e.completed_cells ?? e.completedCells ?? 0),
          failedCells: Number(e.failed_cells ?? e.failedCells ?? 0),
          startedAt: e.started_at ?? e.startedAt ?? '', completedAt: e.completed_at ?? e.completedAt ?? '',
          durationSecs: Number(e.duration_secs ?? e.durationSecs ?? 0),
          memoryPeakMb: Number(e.memory_peak_mb ?? e.memoryPeakMb ?? 0),
          kernelVersion: e.kernel_version ?? e.kernelVersion ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sharing ?? rS.value.data ?? []
        setShares(raw.map((s: any) => ({
          shareId: s.share_id ?? s.shareId ?? '', notebookId: s.notebook_id ?? s.notebookId ?? '',
          sharedWith: s.shared_with ?? s.sharedWith ?? '', permission: s.permission ?? 'view',
          sharedAt: s.shared_at ?? s.sharedAt ?? '', expiresAt: s.expires_at ?? s.expiresAt ?? '',
          lastAccessedAt: s.last_accessed_at ?? s.lastAccessedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', notebookId: a.notebook_id ?? a.notebookId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const runningNbs = notebooks.filter(n => n.status === 'running').length
  const errorNbs = notebooks.filter(n => n.status === 'error').length
  const errorCells = cells.filter(c => c.hasError).length

  const TABS2 = [
    { id: 'notebooks' as const, label: 'NOTEBOOKS' },
    { id: 'cells' as const, label: 'CELLS' },
    { id: 'executions' as const, label: 'EXECUTIONS' },
    { id: 'sharing' as const, label: 'SHARING' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RESEARCH NOTEBOOKS — CODE CELLS + EXECUTION + COLLABORATION + VERSION CONTROL</span>
        {runningNbs > 0 && <span style={{ fontSize: 10, color: AMBER }}>⚠‘ {runningNbs} RUNNING</span>}
        {errorNbs > 0 && <span style={{ fontSize: 10, color: RED }}>⚠‘ {errorNbs} ERROR</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Notebooks" value={notebooks.length} col={BLUE} />
        <StatCard label="Running" value={runningNbs} col={runningNbs > 0 ? AMBER : SUBTLE} />
        <StatCard label="Error State" value={errorNbs} col={errorNbs > 0 ? RED : GREEN} />
        <StatCard label="Cell Errors" value={errorCells} col={errorCells > 0 ? ORANGE : GREEN} />
        <StatCard label="Executions" value={executions.length} col={PURPLE} />
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

        {tab === 'notebooks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Title</Th><Th>Author</Th><Th>Kernel</Th><Th>Status</Th><Th>Version</Th><Th right>Cells</Th><Th right>Code</Th><Th right>Collaborators</Th><Th>Public</Th><Th>Last Modified</Th></tr></thead>
              <tbody>
                {notebooks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No notebooks</td></tr>}
                {notebooks.sort((a, b) => (b.status === 'running' ? 1 : 0) - (a.status === 'running' ? 1 : 0)).map((n, i) => (
                  <tr key={i} style={{ background: n.status === 'error' ? RED + '0a' : n.status === 'running' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{n.title}</Td>
                    <Td mono col={TEXT}>{n.author}</Td>
                    <Td><KernelBadge k={n.kernelType} /></Td>
                    <Td><StatusBadge s={n.status} /></Td>
                    <Td mono col={SUBTLE}>v{n.version}</Td>
                    <Td right mono col={TEXT}>{n.cellCount}</Td>
                    <Td right mono col={BLUE}>{n.codeCellCount}</Td>
                    <Td right mono col={n.collaborators > 0 ? GREEN : SUBTLE}>{n.collaborators}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.isPublic ? ORANGE : SUBTLE }}>{n.isPublic ? 'âœ“ PUBLIC' : '—'}</span></Td>
                    <Td mono col={SUBTLE}>{n.lastModifiedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'cells' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Cell ID</Th><Th>Notebook</Th><Th>Type</Th><Th right>Order</Th><Th>Status</Th><Th right>Exec Time ms</Th><Th>Output Type</Th><Th>Error</Th><Th>Last Run</Th></tr></thead>
              <tbody>
                {cells.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No cells</td></tr>}
                {cells.sort((a, b) => (a.hasError ? -1 : 1) - (b.hasError ? -1 : 1)).map((c, i) => (
                  <tr key={i} style={{ background: c.hasError ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.cellId}</Td>
                    <Td mono col={BLUE}>{c.notebookId}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.cellType === 'code' ? BLUE : c.cellType === 'output' ? GREEN : SUBTLE, background: (c.cellType === 'code' ? BLUE : c.cellType === 'output' ? GREEN : SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{c.cellType.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>{c.executionOrder}</Td>
                    <Td><StatusBadge s={c.executionStatus} /></Td>
                    <Td right mono col={c.executionTime > 5000 ? RED : c.executionTime > 1000 ? ORANGE : GREEN}>{c.executionTime.toFixed(0)}</Td>
                    <Td mono col={PURPLE}>{c.outputType || '—'}</Td>
                    <Td mono col={RED}>{c.hasError ? (c.errorMessage || 'Error') : '—'}</Td>
                    <Td mono col={SUBTLE}>{c.lastRunAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'executions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Execution ID</Th><Th>Notebook</Th><Th>Triggered By</Th><Th>Status</Th><Th right>Cells Total</Th><Th right>Completed</Th><Th right>Failed</Th><Th right>Duration s</Th><Th right>Peak MB</Th><Th>Started At</Th></tr></thead>
              <tbody>
                {executions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No executions</td></tr>}
                {executions.map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.executionId}</Td>
                    <Td mono col={BLUE}>{e.notebookId}</Td>
                    <Td mono col={TEXT}>{e.triggeredBy}</Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td right mono col={SUBTLE}>{e.totalCells}</Td>
                    <Td right mono col={GREEN}>{e.completedCells}</Td>
                    <Td right mono col={e.failedCells > 0 ? RED : SUBTLE}>{e.failedCells}</Td>
                    <Td right mono col={e.durationSecs > 300 ? ORANGE : SUBTLE}>{e.durationSecs.toFixed(1)}</Td>
                    <Td right mono col={e.memoryPeakMb > 4096 ? RED : e.memoryPeakMb > 2048 ? ORANGE : TEXT}>{e.memoryPeakMb.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{e.startedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sharing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Share ID</Th><Th>Notebook ID</Th><Th>Shared With</Th><Th>Permission</Th><Th>Shared At</Th><Th>Expires</Th><Th>Last Accessed</Th></tr></thead>
              <tbody>
                {shares.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No shares</td></tr>}
                {shares.map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.shareId}</Td>
                    <Td mono col={BLUE}>{s.notebookId}</Td>
                    <Td mono col={TEXT}>{s.sharedWith}</Td>
                    <Td><PermBadge p={s.permission} /></Td>
                    <Td mono col={SUBTLE}>{s.sharedAt}</Td>
                    <Td mono col={SUBTLE}>{s.expiresAt || '—'}</Td>
                    <Td mono col={SUBTLE}>{s.lastAccessedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Notebook ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.notebookId || '—'}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
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
