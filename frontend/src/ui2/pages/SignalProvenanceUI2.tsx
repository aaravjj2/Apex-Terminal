import React, { useState, useEffect, useCallback } from 'react'
﻿// SignalProvenanceUI2 — Bloomberg APEX Signal Provenance terminal
// Signal lineage tracking, reproducibility attestation, provenance ledger, audit chain
// Tabs: SIGNALS | LINEAGE | ATTESTATION | REPRODUCIBILITY | AUDIT
// APIs: /api/v4/signal-provenance/signals, /lineage, /attestation, /reproducibility, /audit

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

interface SignalRecord {
  signalId: string
  name: string
  category: 'alpha' | 'risk' | 'execution' | 'macro' | 'micro' | 'alternative'
  owner: string
  version: string
  status: 'active' | 'deprecated' | 'experimental' | 'archived'
  dataSourceCount: number
  derivedSignalCount: number
  lineageDepth: number
  lastComputedAt: string
  reproducibilityScore: number
  attestedBy: string
  hash: string
}

interface LineageNode {
  nodeId: string
  signalId: string
  signalName: string
  upstreamIds: string[]
  downstreamIds: string[]
  transformation: string
  transformationVersion: string
  parameterHash: string
  dataVintage: string
  computedAt: string
  environment: string
  isRoot: boolean
  isLeaf: boolean
}

interface AttestationRecord {
  attestationId: string
  signalId: string
  signalName: string
  attestedBy: string
  attestedAt: string
  schemaVersion: string
  expiresAt: string
  status: 'valid' | 'expired' | 'revoked' | 'pending'
  evidenceHash: string
  complianceFramework: string
  notes: string
}

interface ReproducibilityRun {
  runId: string
  signalId: string
  signalName: string
  originalHash: string
  replayHash: string
  matchStatus: 'exact' | 'within_tolerance' | 'failed' | 'running'
  maxDeviationPct: number
  startDate: string
  endDate: string
  executionTimeMs: number
  initiatedBy: string
  completedAt: string
}

interface ProvenanceAuditEntry {
  auditId: string
  signalId: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, deprecated: RED, experimental: AMBER, archived: SUBTLE, valid: GREEN, expired: RED, revoked: RED, pending: AMBER, exact: GREEN, within_tolerance: AMBER, failed: RED, running: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { alpha: AMBER, risk: RED, execution: BLUE, macro: GREEN, micro: PURPLE, alternative: ORANGE }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 100))
  const col = pct >= 90 ? GREEN : pct >= 70 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{(score * 100).toFixed(0)}</span>
    </div>
  )
}


export function SignalProvenanceUI2() {
  const [tab, setTab] = useState<'signals' | 'lineage' | 'attestation' | 'reproducibility' | 'audit'>('signals')
  const [signals, setSignals] = useState<SignalRecord[]>([])
  const [lineage, setLineage] = useState<LineageNode[]>([])
  const [attestations, setAttestations] = useState<AttestationRecord[]>([])
  const [reproducibility, setReproducibility] = useState<ReproducibilityRun[]>([])
  const [auditLog, setAuditLog] = useState<ProvenanceAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rL, rA, rR, rAu] = await Promise.allSettled([
        fetch('/api/v4/signal-provenance/signals').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/signal-provenance/lineage').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/signal-provenance/attestation').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/signal-provenance/reproducibility').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/signal-provenance/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.signals ?? rS.value.data ?? []
        setSignals(raw.map((s: any) => ({
          signalId: s.signal_id ?? s.signalId ?? '', name: s.name ?? '',
          category: s.category ?? 'alpha', owner: s.owner ?? '',
          version: s.version ?? '1.0.0', status: s.status ?? 'active',
          dataSourceCount: Number(s.data_source_count ?? s.dataSourceCount ?? 0),
          derivedSignalCount: Number(s.derived_signal_count ?? s.derivedSignalCount ?? 0),
          lineageDepth: Number(s.lineage_depth ?? s.lineageDepth ?? 0),
          lastComputedAt: s.last_computed_at ?? s.lastComputedAt ?? '',
          reproducibilityScore: Number(s.reproducibility_score ?? s.reproducibilityScore ?? 0),
          attestedBy: s.attested_by ?? s.attestedBy ?? '',
          hash: s.hash ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load signal data')
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.lineage ?? rL.value.nodes ?? rL.value.data ?? []
        setLineage(raw.map((l: any) => ({
          nodeId: l.node_id ?? l.nodeId ?? '', signalId: l.signal_id ?? l.signalId ?? '',
          signalName: l.signal_name ?? l.signalName ?? '',
          upstreamIds: l.upstream_ids ?? l.upstreamIds ?? [],
          downstreamIds: l.downstream_ids ?? l.downstreamIds ?? [],
          transformation: l.transformation ?? '', transformationVersion: l.transformation_version ?? l.transformationVersion ?? '',
          parameterHash: l.parameter_hash ?? l.parameterHash ?? '',
          dataVintage: l.data_vintage ?? l.dataVintage ?? '',
          computedAt: l.computed_at ?? l.computedAt ?? '',
          environment: l.environment ?? '', isRoot: Boolean(l.is_root ?? l.isRoot),
          isLeaf: Boolean(l.is_leaf ?? l.isLeaf),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.attestations ?? rA.value.data ?? []
        setAttestations(raw.map((a: any) => ({
          attestationId: a.attestation_id ?? a.attestationId ?? '', signalId: a.signal_id ?? a.signalId ?? '',
          signalName: a.signal_name ?? a.signalName ?? '',
          attestedBy: a.attested_by ?? a.attestedBy ?? '',
          attestedAt: a.attested_at ?? a.attestedAt ?? '',
          schemaVersion: a.schema_version ?? a.schemaVersion ?? '',
          expiresAt: a.expires_at ?? a.expiresAt ?? '',
          status: a.status ?? 'pending', evidenceHash: a.evidence_hash ?? a.evidenceHash ?? '',
          complianceFramework: a.compliance_framework ?? a.complianceFramework ?? '',
          notes: a.notes ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.runs ?? rR.value.data ?? []
        setReproducibility(raw.map((r: any) => ({
          runId: r.run_id ?? r.runId ?? '', signalId: r.signal_id ?? r.signalId ?? '',
          signalName: r.signal_name ?? r.signalName ?? '',
          originalHash: r.original_hash ?? r.originalHash ?? '',
          replayHash: r.replay_hash ?? r.replayHash ?? '',
          matchStatus: r.match_status ?? r.matchStatus ?? 'running',
          maxDeviationPct: Number(r.max_deviation_pct ?? r.maxDeviationPct ?? 0),
          startDate: r.start_date ?? r.startDate ?? '',
          endDate: r.end_date ?? r.endDate ?? '',
          executionTimeMs: Number(r.execution_time_ms ?? r.executionTimeMs ?? 0),
          initiatedBy: r.initiated_by ?? r.initiatedBy ?? '',
          completedAt: r.completed_at ?? r.completedAt ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', signalId: a.signal_id ?? a.signalId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const expiredAttestations = attestations.filter(a => a.status === 'expired' || a.status === 'revoked').length
  const failedReplays = reproducibility.filter(r => r.matchStatus === 'failed').length
  const avgRepro = signals.length ? signals.reduce((a, s) => a + s.reproducibilityScore, 0) / signals.length : 0
  const activeSignals = signals.filter(s => s.status === 'active').length

  const TABS2 = [
    { id: 'signals' as const, label: 'SIGNALS' },
    { id: 'lineage' as const, label: 'LINEAGE' },
    { id: 'attestation' as const, label: 'ATTESTATION' },
    { id: 'reproducibility' as const, label: 'REPRODUCIBILITY' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SIGNAL PROVENANCE — LINEAGE TRACKING + REPRODUCIBILITY ATTESTATION + AUDIT LEDGER</span>
        {expiredAttestations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {expiredAttestations} ATTESTATION EXPIRED</span>}
        {failedReplays > 0 && <span style={{ fontSize: 10, color: RED }}>⚠‘ {failedReplays} REPLAY FAILURES</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Signals" value={signals.length} sub={`${activeSignals} active`} col={BLUE} />
        <StatCard label="Expired Attestations" value={expiredAttestations} col={expiredAttestations > 0 ? RED : GREEN} />
        <StatCard label="Failed Replays" value={failedReplays} col={failedReplays > 0 ? RED : GREEN} />
        <StatCard label="Avg Reproducibility" value={`${(avgRepro * 100).toFixed(1)}%`} col={avgRepro > 0.9 ? GREEN : avgRepro > 0.7 ? AMBER : RED} />
        <StatCard label="Lineage Nodes" value={lineage.length} col={PURPLE} />
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

        {tab === 'signals' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Signal ID</Th><Th>Name</Th><Th>Category</Th><Th>Status</Th><Th>Version</Th><Th>Owner</Th><Th right>Sources</Th><Th right>Derived</Th><Th>Reproduct.</Th><Th>Hash</Th></tr></thead>
              <tbody>
                {signals.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No signals</td></tr>}
                {signals.sort((a, b) => a.status === 'deprecated' ? 1 : -1).map((s, i) => (
                  <tr key={i} style={{ opacity: s.status === 'deprecated' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{s.signalId}</Td>
                    <Td mono col={TEXT}>{s.name}</Td>
                    <Td><CatBadge c={s.category} /></Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td mono col={SUBTLE}>{s.version}</Td>
                    <Td mono col={BLUE}>{s.owner || '—'}</Td>
                    <Td right mono col={TEXT}>{s.dataSourceCount}</Td>
                    <Td right mono col={TEXT}>{s.derivedSignalCount}</Td>
                    <Td><ScoreBar score={s.reproducibilityScore} /></Td>
                    <Td mono col={SUBTLE}>{s.hash ? s.hash.slice(0, 12) + 'â€¦' : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'lineage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Node ID</Th><Th>Signal</Th><Th>Transformation</Th><Th>Up/Downstream</Th><Th>Env</Th><Th>Data Vintage</Th><Th>Param Hash</Th><Th>Computed At</Th><Th>Root</Th><Th>Leaf</Th></tr></thead>
              <tbody>
                {lineage.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No lineage data</td></tr>}
                {lineage.map((l, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{l.nodeId}</Td>
                    <Td mono col={BLUE}>{l.signalName || l.signalId}</Td>
                    <Td mono col={TEXT}>{l.transformation || '—'}</Td>
                    <Td mono col={SUBTLE}>{l.upstreamIds.length}â†‘ / {l.downstreamIds.length}â†“</Td>
                    <Td mono col={PURPLE}>{l.environment || '—'}</Td>
                    <Td mono col={SUBTLE}>{l.dataVintage || '—'}</Td>
                    <Td mono col={SUBTLE}>{l.parameterHash ? l.parameterHash.slice(0, 10) + 'â€¦' : '—'}</Td>
                    <Td mono col={SUBTLE}>{l.computedAt}</Td>
                    <Td mono col={l.isRoot ? GREEN : SUBTLE}>{l.isRoot ? 'ROOT' : '—'}</Td>
                    <Td mono col={l.isLeaf ? AMBER : SUBTLE}>{l.isLeaf ? 'LEAF' : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'attestation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Attest ID</Th><Th>Signal</Th><Th>Status</Th><Th>Attested By</Th><Th>Framework</Th><Th>Schema</Th><Th>Evidence Hash</Th><Th>Attested At</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {attestations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No attestations</td></tr>}
                {attestations.sort((a, b) => a.status === 'expired' ? -1 : 0).map((a, i) => (
                  <tr key={i} style={{ background: a.status === 'expired' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.attestationId}</Td>
                    <Td mono col={BLUE}>{a.signalName || a.signalId}</Td>
                    <Td><StatusBadge s={a.status} /></Td>
                    <Td mono col={TEXT}>{a.attestedBy || '—'}</Td>
                    <Td mono col={PURPLE}>{a.complianceFramework || '—'}</Td>
                    <Td mono col={SUBTLE}>{a.schemaVersion || '—'}</Td>
                    <Td mono col={SUBTLE}>{a.evidenceHash ? a.evidenceHash.slice(0, 12) + 'â€¦' : '—'}</Td>
                    <Td mono col={SUBTLE}>{a.attestedAt}</Td>
                    <Td mono col={a.status === 'expired' ? RED : SUBTLE}>{a.expiresAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reproducibility' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Signal</Th><Th>Match</Th><Th right>Max Dev %</Th><Th>Orig Hash</Th><Th>Replay Hash</Th><Th right>Exec ms</Th><Th>Initiated</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {reproducibility.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reproducibility runs</td></tr>}
                {reproducibility.sort((a, b) => a.matchStatus === 'failed' ? -1 : 0).map((r, i) => (
                  <tr key={i} style={{ background: r.matchStatus === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.runId}</Td>
                    <Td mono col={BLUE}>{r.signalName || r.signalId}</Td>
                    <Td><StatusBadge s={r.matchStatus} /></Td>
                    <Td right mono col={r.maxDeviationPct > 1 ? RED : GREEN}>{r.maxDeviationPct.toFixed(4)}%</Td>
                    <Td mono col={SUBTLE}>{r.originalHash ? r.originalHash.slice(0, 12) + 'â€¦' : '—'}</Td>
                    <Td mono col={r.matchStatus === 'exact' ? GREEN : SUBTLE}>{r.replayHash ? r.replayHash.slice(0, 12) + 'â€¦' : '—'}</Td>
                    <Td right mono col={TEXT}>{r.executionTimeMs.toLocaleString()}</Td>
                    <Td mono col={TEXT}>{r.initiatedBy || '—'}</Td>
                    <Td mono col={SUBTLE}>{r.completedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Signal ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.signalId}</Td>
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
