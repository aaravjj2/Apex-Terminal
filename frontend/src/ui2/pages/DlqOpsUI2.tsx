import React, { useState, useCallback, useEffect } from 'react'
﻿// DlqOpsUI2 — Bloomberg APEX DLQ Operations — ElastiHack Waves 011-020, 061-070
// Dead-letter queue mgmt, ingest bulk metrics, lag timeline, drain, latency, integrity
// Tabs: DLQ ENTRIES | INGEST | LAG TIMELINE | LATENCY | INTEGRITY | INDICES
// APIs: /api/v4/elastihack/dlq, /ingest, /lag, /latency, /integrity, /indices

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

const EH = '/api/v4/elastihack'

interface DlqEntry {
  id: string
  entityType: string
  error: string
  retryCount: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'pending' | 'retrying' | 'dead' | 'resolved'
  createdAt: string
  lastAttemptAt: string
}

interface IngestMetrics {
  totalIndexed: number
  totalFailed: number
  totalRetries: number
  docsPerSec: number
  bulkErrorRatePct: number
  lastBulkAt: string | null
  indexedLast1h: number
  failedLast1h: number
}

interface LagEntry {
  entityType: string
  dbCount: number
  esCount: number
  lag: number
  sloMet: boolean
  lagPct: number
}

interface LatencyPercentiles {
  p50: number
  p75: number
  p95: number
  p99: number
  sampleCount: number
  endpoint: string
}

interface IntegrityReport {
  missingEdges: number
  orphanDocs: number
  integrityScore: number
  duplicateKeys: number
  corruptedDocs: number
  lastCheckedAt: string
}

interface IndexInfo {
  index: string
  entityType: string
  docCount: number
  storeSize: string
  ilmPhase: string
  ilmPolicy: string
  shards: number
  replicas: number
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
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { pending: AMBER, retrying: BLUE, dead: RED, resolved: GREEN }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function DlqOpsUI2() {
  const [tab, setTab] = useState<'dlq' | 'ingest' | 'lag' | 'latency' | 'integrity' | 'indices'>('dlq')
  const [dlqEntries, setDlqEntries] = useState<DlqEntry[]>([])
  const [ingest, setIngest] = useState<IngestMetrics | null>(null)
  const [lag, setLag] = useState<LagEntry[]>([])
  const [latency, setLatency] = useState<LatencyPercentiles[]>([])
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null)
  const [indices, setIndices] = useState<IndexInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [draining, setDraining] = useState(false)
  const [drainMsg, setDrainMsg] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rD, rI, rL, rLa, rIn, rIdx] = await Promise.allSettled([
        fetch(`${EH}/dlq`).then(r => r.ok ? r.json() : []),
        fetch(`${EH}/ingest`).then(r => r.ok ? r.json() : null),
        fetch(`${EH}/lag`).then(r => r.ok ? r.json() : []),
        fetch(`${EH}/latency`).then(r => r.ok ? r.json() : []),
        fetch(`${EH}/integrity`).then(r => r.ok ? r.json() : null),
        fetch(`${EH}/indices`).then(r => r.ok ? r.json() : []),
      ])
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.entries ?? rD.value.data ?? []
        setDlqEntries(raw.map((d: any) => ({
          id: d.id ?? '', entityType: d.entity_type ?? d.entityType ?? '',
          error: d.error ?? '', retryCount: Number(d.retry_count ?? d.retryCount ?? 0),
          severity: d.severity ?? (d.retry_count > 5 ? 'critical' : d.retry_count > 3 ? 'high' : 'medium'),
          status: d.status ?? 'pending',
          createdAt: d.created_at ?? d.createdAt ?? '',
          lastAttemptAt: d.last_attempt_at ?? d.lastAttemptAt ?? d.created_at ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load DLQ entries')
      if (rI.status === 'fulfilled' && rI.value) {
        const m = rI.value
        setIngest({
          totalIndexed: Number(m.total_indexed ?? m.totalIndexed ?? 0),
          totalFailed: Number(m.total_failed ?? m.totalFailed ?? 0),
          totalRetries: Number(m.total_retries ?? m.totalRetries ?? 0),
          docsPerSec: Number(m.docs_per_sec ?? m.docsPerSec ?? 0),
          bulkErrorRatePct: Number(m.bulk_error_rate_pct ?? m.bulkErrorRatePct ?? 0),
          lastBulkAt: m.last_bulk_at ?? m.lastBulkAt ?? null,
          indexedLast1h: Number(m.indexed_last_1h ?? m.indexedLast1h ?? 0),
          failedLast1h: Number(m.failed_last_1h ?? m.failedLast1h ?? 0),
        })
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.lag ?? rL.value.data ?? []
        setLag(raw.map((l: any) => ({
          entityType: l.entity_type ?? l.entityType ?? '',
          dbCount: Number(l.db_count ?? l.dbCount ?? 0),
          esCount: Number(l.es_count ?? l.esCount ?? 0),
          lag: Number(l.lag ?? 0),
          sloMet: Boolean(l.slo_met ?? l.sloMet ?? true),
          lagPct: Number(l.lag_pct ?? l.lagPct ?? 0),
        })))
      }
      if (rLa.status === 'fulfilled') {
        const raw = Array.isArray(rLa.value) ? rLa.value : rLa.value.latency ?? rLa.value.data ?? []
        setLatency(raw.map((l: any) => ({
          endpoint: l.endpoint ?? 'unknown',
          p50: Number(l.p50 ?? 0), p75: Number(l.p75 ?? 0),
          p95: Number(l.p95 ?? 0), p99: Number(l.p99 ?? 0),
          sampleCount: Number(l.sample_count ?? l.sampleCount ?? 0),
        })))
      }
      if (rIn.status === 'fulfilled' && rIn.value) {
        const r = rIn.value
        setIntegrity({
          missingEdges: Number(r.missing_edges ?? r.missingEdges ?? 0),
          orphanDocs: Number(r.orphan_docs ?? r.orphanDocs ?? 0),
          integrityScore: Number(r.integrity_score ?? r.integrityScore ?? 0),
          duplicateKeys: Number(r.duplicate_keys ?? r.duplicateKeys ?? 0),
          corruptedDocs: Number(r.corrupted_docs ?? r.corruptedDocs ?? 0),
          lastCheckedAt: r.last_checked_at ?? r.lastCheckedAt ?? '',
        })
      }
      if (rIdx.status === 'fulfilled') {
        const raw = Array.isArray(rIdx.value) ? rIdx.value : rIdx.value.indices ?? rIdx.value.data ?? []
        setIndices(raw.map((ix: any) => ({
          index: ix.index ?? '',
          entityType: ix.entity_type ?? ix.entityType ?? '',
          docCount: Number(ix.doc_count ?? ix.docCount ?? 0),
          storeSize: ix.store_size ?? ix.storeSize ?? '0b',
          ilmPhase: ix.ilm_phase ?? ix.ilmPhase ?? 'hot',
          ilmPolicy: ix.ilm_policy ?? ix.ilmPolicy ?? '',
          shards: Number(ix.shards ?? 1),
          replicas: Number(ix.replicas ?? 1),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleDrain = async () => {
    setDraining(true); setDrainMsg(null)
    try {
      const r = await fetch(`${EH}/dlq/drain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 100 }) })
      if (r.ok) { const d = await r.json(); setDrainMsg(`Drained ${d.drained ?? 0} entries`); fetchAll() }
      else setDrainMsg('Drain failed — check backend logs')
    } catch (e: any) { setDrainMsg(e.message) }
    finally { setDraining(false) }
  }

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const deadCount = dlqEntries.filter(e => e.status === 'dead').length
  const pendingCount = dlqEntries.filter(e => e.status === 'pending').length
  const sloFailCount = lag.filter(l => !l.sloMet).length
  const avgIntegrity = integrity?.integrityScore ?? null

  const TABS2 = [
    { id: 'dlq' as const, label: 'DLQ ENTRIES' },
    { id: 'ingest' as const, label: 'INGEST' },
    { id: 'lag' as const, label: 'LAG TIMELINE' },
    { id: 'latency' as const, label: 'LATENCY' },
    { id: 'integrity' as const, label: 'INTEGRITY' },
    { id: 'indices' as const, label: 'INDICES' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DLQ OPERATIONS — ELASTIHACK WAVES 011-020 / 061-070 — DEAD-LETTER QUEUE + INGEST OPS</span>
        {loading && <span style={{ fontSize: 10, color: AMBER }}>LOADINGâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {drainMsg && <span style={{ fontSize: 10, color: GREEN }}>{drainMsg}</span>}
          <button onClick={handleDrain} disabled={draining}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: draining ? SUBTLE : RED, background: (draining ? SUBTLE : RED) + '22', border: `1px solid ${draining ? SUBTLE : RED}44`, borderRadius: 3, padding: '4px 10px', cursor: draining ? 'not-allowed' : 'pointer' }}>
            {draining ? 'DRAININGâ€¦' : 'DRAIN DLQ'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="DLQ Entries" value={dlqEntries.length} col={dlqEntries.length > 0 ? AMBER : GREEN} />
        <StatCard label="Dead Entries" value={deadCount} col={deadCount > 0 ? RED : GREEN} />
        <StatCard label="Pending Drain" value={pendingCount} col={AMBER} />
        <StatCard label="SLO Failures" value={sloFailCount} col={sloFailCount > 0 ? RED : GREEN} />
        <StatCard label="Docs/sec" value={ingest ? ingest.docsPerSec.toFixed(0) : '—'} col={BLUE} />
        <StatCard label="Integrity Score" value={avgIntegrity !== null ? `${(avgIntegrity * 100).toFixed(1)}%` : '—'} col={avgIntegrity !== null && avgIntegrity >= 0.99 ? GREEN : RED} />
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
        {tab === 'dlq' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Entity Type</Th><Th>Severity</Th><Th>Status</Th><Th right>Retries</Th><Th>Error</Th><Th>Created</Th><Th>Last Attempt</Th></tr></thead>
              <tbody>
                {dlqEntries.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No DLQ entries — backend at {EH}/dlq</td></tr>}
                {dlqEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.id.slice(0, 12)}</Td>
                    <Td mono col={BLUE}>{d.entityType}</Td>
                    <Td><SevBadge s={d.severity} /></Td>
                    <Td><StatusBadge s={d.status} /></Td>
                    <Td right mono col={d.retryCount > 5 ? RED : d.retryCount > 3 ? AMBER : TEXT}>{d.retryCount}</Td>
                    <Td mono col={RED}>{d.error.slice(0, 60)}</Td>
                    <Td mono col={SUBTLE}>{d.createdAt}</Td>
                    <Td mono col={SUBTLE}>{d.lastAttemptAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'ingest' && ingest && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <StatCard label="Total Indexed" value={ingest.totalIndexed.toLocaleString()} col={GREEN} />
              <StatCard label="Total Failed" value={ingest.totalFailed.toLocaleString()} col={RED} />
              <StatCard label="Total Retries" value={ingest.totalRetries.toLocaleString()} col={AMBER} />
              <StatCard label="Bulk Error Rate" value={`${ingest.bulkErrorRatePct.toFixed(2)}%`} col={ingest.bulkErrorRatePct > 1 ? RED : GREEN} />
              <StatCard label="Docs/sec" value={ingest.docsPerSec.toFixed(1)} col={BLUE} />
              <StatCard label="Indexed Last 1h" value={ingest.indexedLast1h.toLocaleString()} col={GREEN} />
              <StatCard label="Failed Last 1h" value={ingest.failedLast1h.toLocaleString()} col={ingest.failedLast1h > 0 ? RED : GREEN} />
              <StatCard label="Last Bulk At" value={ingest.lastBulkAt ? ingest.lastBulkAt.slice(0, 19) : '—'} col={SUBTLE} />
            </div>
          </div>
        )}
        {tab === 'ingest' && !ingest && (
          <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No ingest metrics — check {EH}/ingest</div>
        )}
        {tab === 'lag' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Entity Type</Th><Th right>DB Count</Th><Th right>ES Count</Th><Th right>Lag (docs)</Th><Th right>Lag %</Th><Th>SLO</Th></tr></thead>
              <tbody>
                {lag.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No lag data — check {EH}/lag</td></tr>}
                {lag.sort((a, b) => b.lag - a.lag).map((l, i) => (
                  <tr key={i} style={{ background: !l.sloMet ? RED + '08' : 'transparent' }}>
                    <Td mono col={BLUE}>{l.entityType}</Td>
                    <Td right mono col={TEXT}>{l.dbCount.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{l.esCount.toLocaleString()}</Td>
                    <Td right mono col={l.lag > 1000 ? RED : l.lag > 100 ? AMBER : GREEN}>{l.lag.toLocaleString()}</Td>
                    <Td right mono col={l.lag > 0 ? AMBER : GREEN}>{l.lagPct.toFixed(2)}%</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: l.sloMet ? GREEN : RED, background: (l.sloMet ? GREEN : RED) + '22', borderRadius: 3, padding: '2px 5px' }}>{l.sloMet ? 'MET' : 'BREACH'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'latency' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Endpoint</Th><Th right>P50 ms</Th><Th right>P75 ms</Th><Th right>P95 ms</Th><Th right>P99 ms</Th><Th right>Samples</Th></tr></thead>
              <tbody>
                {latency.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No latency data — check {EH}/latency</td></tr>}
                {latency.sort((a, b) => b.p99 - a.p99).map((l, i) => (
                  <tr key={i}>
                    <Td mono col={BLUE}>{l.endpoint}</Td>
                    <Td right mono col={l.p50 > 500 ? RED : l.p50 > 200 ? AMBER : GREEN}>{l.p50}ms</Td>
                    <Td right mono col={l.p75 > 1000 ? RED : l.p75 > 500 ? AMBER : GREEN}>{l.p75}ms</Td>
                    <Td right mono col={l.p95 > 2000 ? RED : l.p95 > 1000 ? AMBER : GREEN}>{l.p95}ms</Td>
                    <Td right mono col={l.p99 > 5000 ? RED : l.p99 > 2000 ? AMBER : GREEN}>{l.p99}ms</Td>
                    <Td right mono col={TEXT}>{l.sampleCount.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'integrity' && integrity && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <StatCard label="Integrity Score" value={`${(integrity.integrityScore * 100).toFixed(2)}%`} col={integrity.integrityScore >= 0.99 ? GREEN : integrity.integrityScore >= 0.95 ? AMBER : RED} />
              <StatCard label="Missing Edges" value={integrity.missingEdges} col={integrity.missingEdges > 0 ? RED : GREEN} />
              <StatCard label="Orphan Docs" value={integrity.orphanDocs} col={integrity.orphanDocs > 0 ? RED : GREEN} />
              <StatCard label="Duplicate Keys" value={integrity.duplicateKeys} col={integrity.duplicateKeys > 0 ? AMBER : GREEN} />
              <StatCard label="Corrupted Docs" value={integrity.corruptedDocs} col={integrity.corruptedDocs > 0 ? RED : GREEN} />
              <StatCard label="Last Check" value={integrity.lastCheckedAt ? integrity.lastCheckedAt.slice(0, 19) : '—'} col={SUBTLE} />
            </div>
          </div>
        )}
        {tab === 'integrity' && !integrity && (
          <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No integrity data — check {EH}/integrity</div>
        )}
        {tab === 'indices' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Index</Th><Th>Entity Type</Th><Th right>Docs</Th><Th>Store Size</Th><Th>ILM Phase</Th><Th>ILM Policy</Th><Th right>Shards</Th><Th right>Replicas</Th></tr></thead>
              <tbody>
                {indices.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No indices — check {EH}/indices</td></tr>}
                {indices.sort((a, b) => b.docCount - a.docCount).map((ix, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{ix.index}</Td>
                    <Td mono col={BLUE}>{ix.entityType}</Td>
                    <Td right mono col={TEXT}>{ix.docCount.toLocaleString()}</Td>
                    <Td mono col={TEXT}>{ix.storeSize}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: ix.ilmPhase === 'hot' ? GREEN : ix.ilmPhase === 'warm' ? AMBER : SUBTLE, background: (ix.ilmPhase === 'hot' ? GREEN : ix.ilmPhase === 'warm' ? AMBER : SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{ix.ilmPhase.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{ix.ilmPolicy}</Td>
                    <Td right mono col={TEXT}>{ix.shards}</Td>
                    <Td right mono col={TEXT}>{ix.replicas}</Td>
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
