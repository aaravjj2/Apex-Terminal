import React, { useState, useEffect, useCallback } from 'react'
﻿// EntityResolutionUI2 â€” Bloomberg ENTR entity resolution terminal
// Cross-reference matching, deduplication, entity graph, pipeline status, audit
// Tabs: ENTITIES | MATCHES | PIPELINE | DUPLICATES | AUDIT
// APIs: /api/v4/entities/entities, /matches, /pipeline, /duplicates, /audit

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

interface EntityRecord {
  entityId: string
  canonicalName: string
  entityType: 'company' | 'person' | 'instrument' | 'fund' | 'index' | 'counterparty'
  ticker: string
  isin: string
  lei: string
  figi: string
  cusip: string
  cik: string
  status: 'active' | 'inactive' | 'merged' | 'duplicate'
  confidenceScore: number
  sources: number
  aliases: number
  lastUpdated: string
}

interface MatchRecord {
  matchId: string
  entity1Id: string
  entity1Name: string
  entity2Id: string
  entity2Name: string
  matchScore: number
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'embedding' | 'rule'
  fields: string[]
  status: 'confirmed' | 'pending_review' | 'rejected'
  reviewer: string
  confidence: number
}

interface PipelineEntry {
  pipelineId: string
  name: string
  stage: 'ingestion' | 'normalisation' | 'blocking' | 'matching' | 'clustering' | 'export'
  status: 'running' | 'completed' | 'failed' | 'waiting'
  processedRecords: number
  totalRecords: number
  matchesFound: number
  duplicatesRemoved: number
  startTime: string
  duration: number
  errorCount: number
}

interface DuplicateGroup {
  groupId: string
  canonical: string
  memberCount: number
  sources: string[]
  resolvedBy: string
  mergedAt: string
  bestRecord: string
  conflictFields: string[]
  autoMerged: boolean
}

interface EntityAuditEntry {
  auditId: string
  action: string
  entityId: string
  entityName: string
  changedFields: string[]
  oldValue: string
  newValue: string
  actor: string
  timestamp: string
  pipelineId: string
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
function ConfBar({ v }: { v: number }) {
  const c = v >= 0.9 ? GREEN : v >= 0.7 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 5, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${v * 100}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{(v * 100).toFixed(1)}%</span>
    </div>
  )
}
function EntityTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { company: BLUE, person: PURPLE, instrument: AMBER, fund: GREEN, index: ORANGE, counterparty: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function MatchTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { exact: GREEN, fuzzy: BLUE, phonetic: PURPLE, embedding: ORANGE, rule: AMBER }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function PipelineStageBadge({ s }: { s: string }) {
  const m: Record<string, string> = { ingestion: BLUE, normalisation: PURPLE, blocking: AMBER, matching: ORANGE, clustering: GREEN, export: TEXT }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function PipelineStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { running: BLUE, completed: GREEN, failed: RED, waiting: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function EntityResolutionUI2() {
  const [tab, setTab] = useState<'entities' | 'matches' | 'pipeline' | 'duplicates' | 'audit'>('entities')
  const [entities, setEntities] = useState<EntityRecord[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [audit, setAudit] = useState<EntityAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rE, rM, rP, rD, rA] = await Promise.allSettled([
        fetch('/api/v4/entities/entities').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entities/matches').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entities/pipeline').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entities/duplicates').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/entities/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.entities ?? rE.value.data ?? []
        setEntities(raw.map((e: any) => ({
          entityId: e.entity_id ?? e.entityId ?? '', canonicalName: e.canonical_name ?? e.canonicalName ?? e.name ?? '',
          entityType: e.entity_type ?? e.entityType ?? 'company', ticker: e.ticker ?? '', isin: e.isin ?? '',
          lei: e.lei ?? '', figi: e.figi ?? '', cusip: e.cusip ?? '', cik: e.cik ?? '',
          status: e.status ?? 'active', confidenceScore: Number(e.confidence_score ?? e.confidenceScore ?? 0),
          sources: Number(e.sources ?? 0), aliases: Number(e.aliases ?? 0), lastUpdated: e.last_updated ?? e.lastUpdated ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load entities')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.matches ?? rM.value.data ?? []
        setMatches(raw.map((m: any) => ({
          matchId: m.match_id ?? m.matchId ?? '', entity1Id: m.entity1_id ?? m.entity1Id ?? '',
          entity1Name: m.entity1_name ?? m.entity1Name ?? '', entity2Id: m.entity2_id ?? m.entity2Id ?? '',
          entity2Name: m.entity2_name ?? m.entity2Name ?? '', matchScore: Number(m.match_score ?? m.matchScore ?? 0),
          matchType: m.match_type ?? m.matchType ?? 'fuzzy', fields: Array.isArray(m.fields) ? m.fields : [],
          status: m.status ?? 'pending_review', reviewer: m.reviewer ?? '', confidence: Number(m.confidence ?? 0),
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.pipeline ?? rP.value.data ?? []
        setPipeline(raw.map((p: any) => ({
          pipelineId: p.pipeline_id ?? p.pipelineId ?? '', name: p.name ?? '',
          stage: p.stage ?? 'ingestion', status: p.status ?? 'waiting',
          processedRecords: Number(p.processed_records ?? p.processedRecords ?? 0),
          totalRecords: Number(p.total_records ?? p.totalRecords ?? 0),
          matchesFound: Number(p.matches_found ?? p.matchesFound ?? 0),
          duplicatesRemoved: Number(p.duplicates_removed ?? p.duplicatesRemoved ?? 0),
          startTime: p.start_time ?? p.startTime ?? '', duration: Number(p.duration ?? 0), errorCount: Number(p.error_count ?? p.errorCount ?? 0),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.duplicates ?? rD.value.data ?? []
        setDuplicates(raw.map((d: any) => ({
          groupId: d.group_id ?? d.groupId ?? '', canonical: d.canonical ?? '', memberCount: Number(d.member_count ?? d.memberCount ?? 0),
          sources: Array.isArray(d.sources) ? d.sources : [], resolvedBy: d.resolved_by ?? d.resolvedBy ?? '',
          mergedAt: d.merged_at ?? d.mergedAt ?? '', bestRecord: d.best_record ?? d.bestRecord ?? '',
          conflictFields: Array.isArray(d.conflict_fields ?? d.conflictFields) ? (d.conflict_fields ?? d.conflictFields) : [],
          autoMerged: Boolean(d.auto_merged ?? d.autoMerged ?? false),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAudit(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '', entityId: a.entity_id ?? a.entityId ?? '',
          entityName: a.entity_name ?? a.entityName ?? '', changedFields: Array.isArray(a.changed_fields ?? a.changedFields) ? (a.changed_fields ?? a.changedFields) : [],
          oldValue: a.old_value ?? a.oldValue ?? '', newValue: a.new_value ?? a.newValue ?? '',
          actor: a.actor ?? '', timestamp: a.timestamp ?? '', pipelineId: a.pipeline_id ?? a.pipelineId ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const pendingMatches = matches.filter(m => m.status === 'pending_review').length
  const failedPipelines = pipeline.filter(p => p.status === 'failed').length
  const totalDuplicates = duplicates.reduce((s, d) => s + d.memberCount, 0)
  const lowConfidence = entities.filter(e => e.confidenceScore < 0.7).length

  const TABS = [
    { id: 'entities' as const, label: 'ENTITIES' },
    { id: 'matches' as const, label: 'MATCHES' },
    { id: 'pipeline' as const, label: 'PIPELINE' },
    { id: 'duplicates' as const, label: 'DUPLICATES' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ENTR</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>ENTITY RESOLUTION â€” ENTITY GRAPH + MATCHING + PIPELINE + DEDUPLICATION + AUDIT</span>
        {pendingMatches > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {pendingMatches} PENDING REVIEW</span>}
        {failedPipelines > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {failedPipelines} PIPELINE FAILED</span>}
        {lowConfidence > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {lowConfidence} LOW CONFIDENCE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Entities" value={entities.length} col={BLUE} />
        <StatCard label="Pending Matches" value={pendingMatches} col={pendingMatches > 0 ? AMBER : GREEN} />
        <StatCard label="Pipelines" value={pipeline.length} col={TEXT} />
        <StatCard label="Duplicate Records" value={totalDuplicates} col={totalDuplicates > 0 ? ORANGE : GREEN} />
        <StatCard label="Low Confidence" value={lowConfidence} col={lowConfidence > 0 ? RED : GREEN} />
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

        {tab === 'entities' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Canonical Name</Th><Th>Type</Th><Th>Confidence</Th><Th>Ticker</Th><Th>ISIN</Th><Th>LEI</Th><Th>Status</Th><Th right>Sources</Th><Th right>Aliases</Th></tr></thead>
              <tbody>
                {entities.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No entities â€” check /api/v4/entities/entities</td></tr>}
                {entities.sort((a, b) => b.confidenceScore - a.confidenceScore).map((e, i) => {
                  const stC: Record<string, string> = { active: GREEN, inactive: SUBTLE, merged: BLUE, duplicate: AMBER }
                  return (
                    <tr key={i}>
                      <Td mono col={AMBER}>{e.canonicalName}</Td>
                      <Td><EntityTypeBadge t={e.entityType} /></Td>
                      <Td><ConfBar v={e.confidenceScore} /></Td>
                      <Td mono col={e.ticker ? BLUE : SUBTLE}>{e.ticker || 'â€”'}</Td>
                      <Td mono col={SUBTLE}>{e.isin || 'â€”'}</Td>
                      <Td mono col={e.lei ? PURPLE : SUBTLE}>{e.lei || 'â€”'}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: stC[e.status] ?? SUBTLE }}>{e.status.toUpperCase()}</span></Td>
                      <Td right mono col={TEXT}>{e.sources}</Td>
                      <Td right mono col={e.aliases > 5 ? ORANGE : SUBTLE}>{e.aliases}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'matches' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Entity 1</Th><Th>Entity 2</Th><Th>Match Type</Th><Th>Score</Th><Th>Confidence</Th><Th>Fields</Th><Th>Status</Th><Th>Reviewer</Th></tr></thead>
              <tbody>
                {matches.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No matches â€” check /api/v4/entities/matches</td></tr>}
                {matches.sort((a, b) => b.matchScore - a.matchScore).map((m, i) => {
                  const stC: Record<string, string> = { confirmed: GREEN, pending_review: AMBER, rejected: RED }
                  return (
                    <tr key={i}>
                      <Td mono col={AMBER}>{m.entity1Name}</Td>
                      <Td mono col={BLUE}>{m.entity2Name}</Td>
                      <Td><MatchTypeBadge t={m.matchType} /></Td>
                      <Td><ConfBar v={m.matchScore} /></Td>
                      <Td><ConfBar v={m.confidence} /></Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10 } as any}>{m.fields.slice(0, 3).join(', ')}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: stC[m.status] ?? SUBTLE, background: (stC[m.status] ?? SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{m.status.replace('_', ' ').toUpperCase()}</span></Td>
                      <Td mono col={SUBTLE}>{m.reviewer || 'â€”'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pipeline' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Pipeline</Th><Th>Stage</Th><Th>Status</Th><Th right>Processed</Th><Th right>Total</Th><Th right>Matches</Th><Th right>Dupes Removed</Th><Th right>Errors</Th><Th>Start Time</Th></tr></thead>
              <tbody>
                {pipeline.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No pipeline â€” check /api/v4/entities/pipeline</td></tr>}
                {pipeline.map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td><PipelineStageBadge s={p.stage} /></Td>
                    <Td><PipelineStatusBadge s={p.status} /></Td>
                    <Td right mono col={TEXT}>{p.processedRecords.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{p.totalRecords.toLocaleString()}</Td>
                    <Td right mono col={GREEN}>{p.matchesFound.toLocaleString()}</Td>
                    <Td right mono col={ORANGE}>{p.duplicatesRemoved.toLocaleString()}</Td>
                    <Td right mono col={p.errorCount > 0 ? RED : GREEN}>{p.errorCount.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{p.startTime}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'duplicates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Canonical Entity</Th><Th right>Members</Th><Th>Sources</Th><Th>Conflict Fields</Th><Th>Auto Merged</Th><Th>Resolved By</Th><Th>Merged At</Th></tr></thead>
              <tbody>
                {duplicates.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No duplicates â€” check /api/v4/entities/duplicates</td></tr>}
                {duplicates.sort((a, b) => b.memberCount - a.memberCount).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.canonical}</Td>
                    <Td right mono col={d.memberCount > 3 ? ORANGE : TEXT}>{d.memberCount}</Td>
                    <Td mono col={BLUE} style={{ fontSize: 10 } as any}>{d.sources.join(', ')}</Td>
                    <Td mono col={RED} style={{ fontSize: 10 } as any}>{d.conflictFields.join(', ')}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.autoMerged ? GREEN : AMBER }}>{d.autoMerged ? 'AUTO' : 'MANUAL'}</span></Td>
                    <Td mono col={SUBTLE}>{d.resolvedBy}</Td>
                    <Td mono col={SUBTLE}>{d.mergedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Action</Th><Th>Entity</Th><Th>Changed Fields</Th><Th>Old Value</Th><Th>New Value</Th><Th>Actor</Th><Th>Pipeline</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit â€” check /api/v4/entities/audit</td></tr>}
                {audit.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.action}</Td>
                    <Td mono col={BLUE}>{a.entityName}</Td>
                    <Td mono col={ORANGE} style={{ fontSize: 10 } as any}>{a.changedFields.join(', ')}</Td>
                    <Td mono col={RED} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.oldValue || 'â€”'}</Td>
                    <Td mono col={GREEN} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.newValue || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.actor}</Td>
                    <Td mono col={PURPLE}>{a.pipelineId || 'â€”'}</Td>
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
