import React, { useState, useEffect, useCallback } from 'react'
﻿// PromptFirewallUI2 â€” Bloomberg APEX prompt firewall terminal
// Input sanitization, output guardrails, blocked events, rules, audit
// Tabs: EVENTS | RULES | GUARDRAILS | SANITIZATION | AUDIT
// APIs: /api/v4/prompt-firewall/events, /rules, /guardrails, /sanitization, /audit

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

interface FirewallEvent {
  eventId: string
  promptId: string
  modelId: string
  direction: 'input' | 'output'
  action: 'allowed' | 'blocked' | 'sanitized' | 'flagged'
  threatCategory: string
  riskScore: number
  ruleMatched: string
  latencyMs: number
  userId: string
  timestamp: string
}

interface FirewallRule {
  ruleId: string
  ruleName: string
  direction: 'input' | 'output' | 'both'
  ruleType: 'regex' | 'classifier' | 'embedding' | 'keyword' | 'llm_judge'
  action: 'block' | 'flag' | 'sanitize' | 'log'
  enabled: boolean
  matchCount: number
  falsePositiveRate: number
  priority: number
  lastEvaluated: string
}

interface Guardrail {
  guardrailId: string
  name: string
  category: string
  scope: 'input' | 'output' | 'both'
  threshold: number
  model: string
  enabled: boolean
  triggeredToday: number
  accuracyPct: number
  avgLatencyMs: number
}

interface SanitizationRecord {
  sanitizationId: string
  promptId: string
  technique: string
  transformations: number
  piiRemoved: boolean
  injectionDefused: boolean
  sensitiveDataMasked: boolean
  originalLength: number
  sanitizedLength: number
  timestamp: string
}

interface FirewallAuditEntry {
  auditId: string
  ruleId: string
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
function ActionBadge({ a }: { a: string }) {
  const m: Record<string, string> = { allowed: GREEN, blocked: RED, sanitized: AMBER, flagged: ORANGE, block: RED, flag: ORANGE, sanitize: AMBER, log: SUBTLE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[a] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{a.toUpperCase()}</span>
}
function DirBadge({ d }: { d: string }) {
  const m: Record<string, string> = { input: BLUE, output: PURPLE, both: ORANGE }
  const c = m[d] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{d.toUpperCase()}</span>
}
function RiskBar({ score }: { score: number }) {
  const col = score >= 0.7 ? RED : score >= 0.4 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 44, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score * 100}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{score.toFixed(2)}</span>
    </div>
  )
}


export function PromptFirewallUI2() {
  const [tab, setTab] = useState<'events' | 'rules' | 'guardrails' | 'sanitization' | 'audit'>('events')
  const [events, setEvents] = useState<FirewallEvent[]>([])
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [guardrails, setGuardrails] = useState<Guardrail[]>([])
  const [sanitization, setSanitization] = useState<SanitizationRecord[]>([])
  const [auditLog, setAuditLog] = useState<FirewallAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rE, rR, rG, rS, rA] = await Promise.allSettled([
        fetch('/api/v4/prompt-firewall/events').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/prompt-firewall/rules').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/prompt-firewall/guardrails').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/prompt-firewall/sanitization').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/prompt-firewall/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.events ?? rE.value.data ?? []
        setEvents(raw.map((e: any) => ({
          eventId: e.event_id ?? e.eventId ?? '', promptId: e.prompt_id ?? e.promptId ?? '',
          modelId: e.model_id ?? e.modelId ?? '', direction: e.direction ?? 'input',
          action: e.action ?? 'allowed', threatCategory: e.threat_category ?? e.threatCategory ?? '',
          riskScore: Number(e.risk_score ?? e.riskScore ?? 0), ruleMatched: e.rule_matched ?? e.ruleMatched ?? '',
          latencyMs: Number(e.latency_ms ?? e.latencyMs ?? 0), userId: e.user_id ?? e.userId ?? '',
          timestamp: e.timestamp ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load events')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.rules ?? rR.value.data ?? []
        setRules(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.ruleId ?? '', ruleName: r.rule_name ?? r.ruleName ?? '',
          direction: r.direction ?? 'input', ruleType: r.rule_type ?? r.ruleType ?? 'keyword',
          action: r.action ?? 'log', enabled: Boolean(r.enabled),
          matchCount: Number(r.match_count ?? r.matchCount ?? 0),
          falsePositiveRate: Number(r.false_positive_rate ?? r.falsePositiveRate ?? 0),
          priority: Number(r.priority ?? 0), lastEvaluated: r.last_evaluated ?? r.lastEvaluated ?? '',
        })))
      }
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.guardrails ?? rG.value.data ?? []
        setGuardrails(raw.map((g: any) => ({
          guardrailId: g.guardrail_id ?? g.guardrailId ?? '', name: g.name ?? '',
          category: g.category ?? '', scope: g.scope ?? 'both',
          threshold: Number(g.threshold ?? 0), model: g.model ?? '',
          enabled: Boolean(g.enabled), triggeredToday: Number(g.triggered_today ?? g.triggeredToday ?? 0),
          accuracyPct: Number(g.accuracy_pct ?? g.accuracyPct ?? 0),
          avgLatencyMs: Number(g.avg_latency_ms ?? g.avgLatencyMs ?? 0),
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sanitization ?? rS.value.data ?? []
        setSanitization(raw.map((s: any) => ({
          sanitizationId: s.sanitization_id ?? s.sanitizationId ?? '',
          promptId: s.prompt_id ?? s.promptId ?? '', technique: s.technique ?? '',
          transformations: Number(s.transformations ?? 0), piiRemoved: Boolean(s.pii_removed ?? s.piiRemoved),
          injectionDefused: Boolean(s.injection_defused ?? s.injectionDefused),
          sensitiveDataMasked: Boolean(s.sensitive_data_masked ?? s.sensitiveDataMasked),
          originalLength: Number(s.original_length ?? s.originalLength ?? 0),
          sanitizedLength: Number(s.sanitized_length ?? s.sanitizedLength ?? 0),
          timestamp: s.timestamp ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', ruleId: a.rule_id ?? a.ruleId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const blockedEvents = events.filter(e => e.action === 'blocked').length
  const highRiskEvents = events.filter(e => e.riskScore >= 0.7).length
  const activeRules = rules.filter(r => r.enabled).length
  const activeGuardrails = guardrails.filter(g => g.enabled).length

  const TABS2 = [
    { id: 'events' as const, label: 'EVENTS' },
    { id: 'rules' as const, label: 'RULES' },
    { id: 'guardrails' as const, label: 'GUARDRAILS' },
    { id: 'sanitization' as const, label: 'SANITIZATION' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PROMPT FIREWALL â€” INPUT SANITIZATION + OUTPUT GUARDRAILS + THREAT DETECTION</span>
        {blockedEvents > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {blockedEvents} BLOCKED</span>}
        {highRiskEvents > 0 && <span style={{ fontSize: 10, color: ORANGE }}>âš‘ {highRiskEvents} HIGH RISK</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Blocked Events" value={blockedEvents} col={blockedEvents > 0 ? RED : GREEN} />
        <StatCard label="High Risk" value={highRiskEvents} col={highRiskEvents > 0 ? ORANGE : GREEN} />
        <StatCard label="Active Rules" value={activeRules} col={BLUE} />
        <StatCard label="Active Guardrails" value={activeGuardrails} col={PURPLE} />
        <StatCard label="Sanitized" value={events.filter(e => e.action === 'sanitized').length} col={AMBER} />
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

        {tab === 'events' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Event ID</Th><Th>Model</Th><Th>Direction</Th><Th>Action</Th><Th>Threat Type</Th><Th>Risk</Th><Th>Rule Matched</Th><Th right>Latency ms</Th><Th>User</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No events â€” check /api/v4/prompt-firewall/events</td></tr>}
                {events.sort((a, b) => b.riskScore - a.riskScore).map((e, i) => (
                  <tr key={i} style={{ background: e.action === 'blocked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.eventId}</Td>
                    <Td mono col={BLUE}>{e.modelId}</Td>
                    <Td><DirBadge d={e.direction} /></Td>
                    <Td><ActionBadge a={e.action} /></Td>
                    <Td mono col={ORANGE}>{e.threatCategory || 'â€”'}</Td>
                    <Td><RiskBar score={e.riskScore} /></Td>
                    <Td mono col={SUBTLE}>{e.ruleMatched || 'â€”'}</Td>
                    <Td right mono col={e.latencyMs > 50 ? ORANGE : SUBTLE}>{e.latencyMs.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{e.userId}</Td>
                    <Td mono col={SUBTLE}>{e.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'rules' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th>Type</Th><Th>Direction</Th><Th>Action</Th><Th>Enabled</Th><Th right>Priority</Th><Th right>Matches</Th><Th right>FP Rate</Th><Th>Last Eval</Th></tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rules â€” check /api/v4/prompt-firewall/rules</td></tr>}
                {rules.sort((a, b) => a.priority - b.priority).map((r, i) => (
                  <tr key={i} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{r.ruleName}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{r.ruleType.toUpperCase()}</span></Td>
                    <Td><DirBadge d={r.direction} /></Td>
                    <Td><ActionBadge a={r.action} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.enabled ? GREEN : RED }}>{r.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={r.priority <= 5 ? AMBER : SUBTLE}>{r.priority}</Td>
                    <Td right mono col={r.matchCount > 0 ? TEXT : SUBTLE}>{r.matchCount.toLocaleString()}</Td>
                    <Td right mono col={r.falsePositiveRate > 0.05 ? ORANGE : GREEN}>{(r.falsePositiveRate * 100).toFixed(2)}%</Td>
                    <Td mono col={SUBTLE}>{r.lastEvaluated || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'guardrails' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Guardrail</Th><Th>Category</Th><Th>Scope</Th><Th>Model</Th><Th>Enabled</Th><Th right>Threshold</Th><Th right>Triggered/day</Th><Th right>Accuracy %</Th><Th right>Avg ms</Th></tr></thead>
              <tbody>
                {guardrails.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No guardrails â€” check /api/v4/prompt-firewall/guardrails</td></tr>}
                {guardrails.sort((a, b) => b.triggeredToday - a.triggeredToday).map((g, i) => (
                  <tr key={i} style={{ opacity: g.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{g.name}</Td>
                    <Td mono col={BLUE}>{g.category}</Td>
                    <Td><DirBadge d={g.scope} /></Td>
                    <Td mono col={PURPLE}>{g.model}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: g.enabled ? GREEN : RED }}>{g.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={SUBTLE}>{g.threshold.toFixed(2)}</Td>
                    <Td right mono col={g.triggeredToday > 0 ? ORANGE : GREEN}>{g.triggeredToday}</Td>
                    <Td right mono col={g.accuracyPct >= 90 ? GREEN : g.accuracyPct >= 75 ? AMBER : RED}>{g.accuracyPct.toFixed(1)}%</Td>
                    <Td right mono col={g.avgLatencyMs > 100 ? ORANGE : SUBTLE}>{g.avgLatencyMs.toFixed(0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sanitization' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Sanitization ID</Th><Th>Technique</Th><Th>PII Removed</Th><Th>Injection Defused</Th><Th>Data Masked</Th><Th right>Transforms</Th><Th right>Orig Len</Th><Th right>Result Len</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {sanitization.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sanitization records â€” check /api/v4/prompt-firewall/sanitization</td></tr>}
                {sanitization.map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.sanitizationId}</Td>
                    <Td mono col={BLUE}>{s.technique}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.piiRemoved ? ORANGE : SUBTLE }}>{s.piiRemoved ? 'âœ“ YES' : 'â€”'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.injectionDefused ? GREEN : SUBTLE }}>{s.injectionDefused ? 'âœ“ YES' : 'â€”'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.sensitiveDataMasked ? AMBER : SUBTLE }}>{s.sensitiveDataMasked ? 'âœ“ YES' : 'â€”'}</span></Td>
                    <Td right mono col={TEXT}>{s.transformations}</Td>
                    <Td right mono col={SUBTLE}>{s.originalLength}</Td>
                    <Td right mono col={s.sanitizedLength < s.originalLength ? GREEN : SUBTLE}>{s.sanitizedLength}</Td>
                    <Td mono col={SUBTLE}>{s.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Rule</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/prompt-firewall/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.ruleId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><ActionBadge a={a.outcome} /></Td>
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
