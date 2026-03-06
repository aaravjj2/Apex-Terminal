import React, { useState, useEffect, useCallback } from 'react'
﻿// ResearchUI2 — Bloomberg APEX Research Terminal
// Strategy artifacts, validation, backtest diff viewer, artifact registry, research governance
// Tabs: STRATEGIES | ARTIFACTS | VALIDATION | DIFF VIEWER | AUDIT
// APIs: /api/v3/research/strategies, /artifacts, /validation, /diff, /audit

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

interface ResearchStrategy {
  id: string
  name: string
  type: 'momentum' | 'meanReversion' | 'breakout' | 'custom' | 'arbitrage' | 'pairs'
  symbol: string
  status: 'draft' | 'validated' | 'backtested' | 'live' | 'archived'
  version: number
  createdAt: number
  updatedAt: number
  author: string
}

interface ResearchArtifact {
  id: string
  strategyId: string
  type: 'backtest' | 'validation' | 'export' | 'report' | 'notebook'
  name: string
  status: 'running' | 'completed' | 'failed'
  sizeBytes: number
  sha256: string
  createdAt: number
}

interface ValidationResult {
  strategyId: string
  strategyName: string
  passed: boolean
  score: number
  checks: Array<{ name: string; passed: boolean; message: string; severity: 'error' | 'warning' | 'info' }>
  validatedAt: string
}

interface DiffEntry {
  artifactId: string
  name: string
  strategyId: string
  fieldName: string
  oldValue: string
  newValue: string
  changePct: number | null
  changeType: 'params' | 'symbols' | 'performance' | 'logic'
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
  const m: Record<string, string> = { draft: SUBTLE, validated: GREEN, backtested: BLUE, live: AMBER, archived: SUBTLE, running: ORANGE, completed: GREEN, failed: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function fmtBytes(b: number) {
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}


export function ResearchUI2() {
  const [tab, setTab] = useState<'strategies' | 'artifacts' | 'validation' | 'diff' | 'audit'>('strategies')
  const [strategies, setStrategies] = useState<ResearchStrategy[]>([])
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([])
  const [validations, setValidations] = useState<ValidationResult[]>([])
  const [diffs, setDiffs] = useState<DiffEntry[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)
  const [backtesting, setBacktesting] = useState(false)
  const [btMsg, setBtMsg] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rA, rV, rD, rL] = await Promise.allSettled([
        fetch('/api/v3/research/strategies').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/research/artifacts').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/research/validation').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/research/diff').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/research/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.strategies ?? rS.value.data ?? []
        setStrategies(raw.map((s: any) => ({
          id: s.id ?? '', name: s.name ?? '', type: s.type ?? 'custom',
          symbol: s.symbol ?? '', status: s.status ?? 'draft',
          version: Number(s.version ?? 1), createdAt: Number(s.created_at ?? s.createdAt ?? 0),
          updatedAt: Number(s.updated_at ?? s.updatedAt ?? 0), author: s.author ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load strategies')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.artifacts ?? rA.value.data ?? []
        setArtifacts(raw.map((a: any) => ({
          id: a.id ?? '', strategyId: a.strategy_id ?? a.strategyId ?? '',
          type: a.type ?? 'backtest', name: a.name ?? '', status: a.status ?? 'completed',
          sizeBytes: Number(a.size ?? a.sizeBytes ?? 0), sha256: a.sha256 ?? '',
          createdAt: Number(a.created_at ?? a.createdAt ?? 0),
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.validations ?? rV.value.data ?? []
        setValidations(raw.map((v: any) => ({
          strategyId: v.strategy_id ?? v.strategyId ?? '',
          strategyName: v.strategy_name ?? v.strategyName ?? '',
          passed: Boolean(v.passed), score: Number(v.score ?? 0),
          checks: (v.checks ?? []).map((c: any) => ({
            name: c.name ?? '', passed: Boolean(c.passed), message: c.message ?? '', severity: c.severity ?? 'info',
          })),
          validatedAt: v.validated_at ?? v.validatedAt ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.diffs ?? rD.value.data ?? []
        setDiffs(raw.map((d: any) => ({
          artifactId: d.artifact_id ?? d.artifactId ?? '',
          name: d.name ?? '', strategyId: d.strategy_id ?? d.strategyId ?? '',
          fieldName: d.field_name ?? d.fieldName ?? '',
          oldValue: String(d.old_value ?? d.oldValue ?? ''),
          newValue: String(d.new_value ?? d.newValue ?? ''),
          changePct: d.change_pct ?? d.changePct ?? null,
          changeType: d.change_type ?? d.changeType ?? 'params',
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.audit ?? rL.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleRunBacktest = async () => {
    if (!selectedStrategy) return
    setBacktesting(true); setBtMsg(null)
    try {
      const r = await fetch('/api/v3/research/backtest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy_id: selectedStrategy }),
      })
      if (r.ok) { const d = await r.json(); setBtMsg(`Backtest queued: ${d.artifact_id ?? d.id ?? 'ok'}`); fetchAll() }
      else setBtMsg('Backtest failed — check backend')
    } catch (e: any) { setBtMsg(e.message) }
    finally { setBacktesting(false) }
  }

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const validatedCount = strategies.filter(s => s.status === 'validated' || s.status === 'backtested' || s.status === 'live').length
  const passedValidations = validations.filter(v => v.passed).length
  const artCompleted = artifacts.filter(a => a.status === 'completed').length
  const TABS2 = [
    { id: 'strategies' as const, label: 'STRATEGIES' },
    { id: 'artifacts' as const, label: 'ARTIFACTS' },
    { id: 'validation' as const, label: 'VALIDATION' },
    { id: 'diff' as const, label: 'DIFF VIEWER' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RESEARCH — STRATEGY ARTIFACTS + VALIDATION + BACKTEST DIFF + ARTIFACT REGISTRY</span>
        {loading && <span style={{ fontSize: 10, color: AMBER }}>LOADINGâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {btMsg && <span style={{ fontSize: 10, color: GREEN }}>{btMsg}</span>}
          <button onClick={handleRunBacktest} disabled={backtesting || !selectedStrategy}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: !selectedStrategy ? SUBTLE : BLUE, background: (!selectedStrategy ? SUBTLE : BLUE) + '22', border: `1px solid ${!selectedStrategy ? SUBTLE : BLUE}44`, borderRadius: 3, padding: '4px 10px', cursor: !selectedStrategy || backtesting ? 'not-allowed' : 'pointer' }}>
            {backtesting ? 'QUEUEINGâ€¦' : 'RUN BACKTEST'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Strategies" value={strategies.length} col={TEXT} />
        <StatCard label="Validated / Live" value={validatedCount} col={GREEN} />
        <StatCard label="Artifacts" value={artifacts.length} col={BLUE} sub={`${artCompleted} completed`} />
        <StatCard label="Validation Pass" value={passedValidations} col={passedValidations > 0 ? GREEN : AMBER} sub={`/ ${validations.length} total`} />
        <StatCard label="Diff Entries" value={diffs.length} col={PURPLE} />
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
        {tab === 'strategies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th></Th><Th>ID</Th><Th>Name</Th><Th>Type</Th><Th>Symbol</Th><Th>Status</Th><Th right>Version</Th><Th>Author</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {strategies.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No strategies</td></tr>}
                {strategies.sort((a, b) => b.updatedAt - a.updatedAt).map((s, i) => (
                  <tr key={i} onClick={() => setSelectedStrategy(selectedStrategy === s.id ? null : s.id)} style={{ cursor: 'pointer', background: selectedStrategy === s.id ? AMBER + '11' : 'transparent' }}>
                    <Td mono col={selectedStrategy === s.id ? AMBER : SUBTLE}>{selectedStrategy === s.id ? 'â–¶' : 'â—‹'}</Td>
                    <Td mono col={AMBER}>{s.id.slice(0, 12)}</Td>
                    <Td mono col={TEXT}>{s.name.slice(0, 30)}</Td>
                    <Td mono col={BLUE}>{s.type}</Td>
                    <Td mono col={TEXT}>{s.symbol}</Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td right mono col={SUBTLE}>v{s.version}</Td>
                    <Td mono col={SUBTLE}>{s.author}</Td>
                    <Td mono col={SUBTLE}>{s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 10) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'artifacts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Artifact ID</Th><Th>Name</Th><Th>Type</Th><Th>Strategy</Th><Th>Status</Th><Th right>Size</Th><Th>SHA256</Th><Th>Created</Th></tr></thead>
              <tbody>
                {artifacts.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No artifacts</td></tr>}
                {artifacts.sort((a, b) => b.createdAt - a.createdAt).map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.id.slice(0, 12)}</Td>
                    <Td mono col={TEXT}>{a.name.slice(0, 28)}</Td>
                    <Td mono col={BLUE}>{a.type}</Td>
                    <Td mono col={SUBTLE}>{a.strategyId.slice(0, 12)}</Td>
                    <Td><StatusBadge s={a.status} /></Td>
                    <Td right mono col={TEXT}>{fmtBytes(a.sizeBytes)}</Td>
                    <Td mono col={SUBTLE}>{a.sha256.slice(0, 14)}â€¦</Td>
                    <Td mono col={SUBTLE}>{a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'validation' && (
          <div>
            {validations.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No validations</div>}
            {validations.map((v, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${v.passed ? GREEN : RED}33`, borderRadius: 4, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>{v.strategyId.slice(0, 14)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{v.strategyName.slice(0, 30)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: v.passed ? GREEN : RED, background: (v.passed ? GREEN : RED) + '22', borderRadius: 3, padding: '2px 5px' }}>{v.passed ? 'PASSED' : 'FAILED'}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: v.score >= 80 ? GREEN : v.score >= 50 ? AMBER : RED }}>{v.score.toFixed(0)}/100</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE, marginLeft: 'auto' }}>{v.validatedAt.slice(0, 16)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {v.checks.map((c, j) => (
                    <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: c.passed ? GREEN : c.severity === 'error' ? RED : AMBER }}>{c.passed ? 'âœ“' : 'âœ—'}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{c.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{c.message.slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'diff' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Artifact ID</Th><Th>Name</Th><Th>Change Type</Th><Th>Field</Th><Th>Old Value</Th><Th>New Value</Th><Th right>Change %</Th></tr></thead>
              <tbody>
                {diffs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No diffs</td></tr>}
                {diffs.map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.artifactId.slice(0, 12)}</Td>
                    <Td mono col={TEXT}>{d.name.slice(0, 26)}</Td>
                    <Td mono col={BLUE}>{d.changeType}</Td>
                    <Td mono col={TEXT}>{d.fieldName}</Td>
                    <Td mono col={RED}>{String(d.oldValue).slice(0, 20)}</Td>
                    <Td mono col={GREEN}>{String(d.newValue).slice(0, 20)}</Td>
                    <Td right mono col={d.changePct !== null ? (d.changePct > 0 ? GREEN : RED) : SUBTLE}>{d.changePct !== null ? `${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(1)}%` : '—'}</Td>
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
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
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
