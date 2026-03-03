import React, { useState, useEffect, useCallback } from 'react'
﻿// ApprovalChainUI2 â€” Bloomberg APEX approval chain terminal
// Multi-level approval chain with escalation and delegation management
// Tabs: CHAINS | NODES | ESCALATIONS | DELEGATIONS | AUDIT
// APIs: /api/v4/approval-chain/chains, /nodes, /escalations, /delegations, /audit

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

interface ApprovalChain {
  chainId: string
  chainName: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  maxLevel: number
  status: 'active' | 'draft' | 'deprecated'
  slaHours: number
  passedCount: number
  rejectedCount: number
  escalatedCount: number
  avgCompletionHours: number
  owner: string
}

interface ChainNode {
  nodeId: string
  chainId: string
  chainName: string
  level: number
  nodeType: 'individual' | 'group' | 'role' | 'system'
  assignee: string
  slaHours: number
  canDelegate: boolean
  canEscalate: boolean
  autoApproveCondition: string
  pendingItems: number
}

interface EscalationRecord {
  escalationId: string
  chainId: string
  itemId: string
  fromLevel: number
  toLevel: number
  reason: string
  triggeredBy: 'sla_breach' | 'manual' | 'auto_rule'
  resolvedAt: string
  status: 'open' | 'resolved'
  escalatedAt: string
}

interface DelegationRecord {
  delegationId: string
  nodeId: string
  chainName: string
  delegateFrom: string
  delegateTo: string
  reason: string
  validFrom: string
  validTo: string
  scope: string
  status: 'active' | 'expired' | 'revoked'
}

interface ChainAuditEntry {
  auditId: string
  chainId: string
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
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, draft: BLUE, deprecated: SUBTLE, open: AMBER, resolved: GREEN, 'sla_breach': RED, manual: ORANGE, auto_rule: BLUE, expired: SUBTLE, revoked: RED, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  const lbl = s.replace(/_/g, ' ').toUpperCase()
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{lbl}</span>
}
function LevelPip({ level, max }: { level: number; max: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: Math.max(max, level) }, (_, i) => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: i < level ? AMBER : BORDER }} />
      ))}
    </div>
  )
}


export function ApprovalChainUI2() {
  const [tab, setTab] = useState<'chains' | 'nodes' | 'escalations' | 'delegations' | 'audit'>('chains')
  const [chains, setChains] = useState<ApprovalChain[]>([])
  const [nodes, setNodes] = useState<ChainNode[]>([])
  const [escalations, setEscalations] = useState<EscalationRecord[]>([])
  const [delegations, setDelegations] = useState<DelegationRecord[]>([])
  const [auditLog, setAuditLog] = useState<ChainAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rC, rN, rE, rD, rA] = await Promise.allSettled([
        fetch('/api/v4/approval-chain/chains').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-chain/nodes').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-chain/escalations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-chain/delegations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-chain/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.chains ?? rC.value.data ?? []
        setChains(raw.map((c: any) => ({
          chainId: c.chain_id ?? c.chainId ?? '', chainName: c.chain_name ?? c.chainName ?? '',
          riskLevel: c.risk_level ?? c.riskLevel ?? 'low', maxLevel: Number(c.max_level ?? c.maxLevel ?? 0),
          status: c.status ?? 'active', slaHours: Number(c.sla_hours ?? c.slaHours ?? 0),
          passedCount: Number(c.passed_count ?? c.passedCount ?? 0),
          rejectedCount: Number(c.rejected_count ?? c.rejectedCount ?? 0),
          escalatedCount: Number(c.escalated_count ?? c.escalatedCount ?? 0),
          avgCompletionHours: Number(c.avg_completion_hours ?? c.avgCompletionHours ?? 0),
          owner: c.owner ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load chains')
      if (rN.status === 'fulfilled') {
        const raw = Array.isArray(rN.value) ? rN.value : rN.value.nodes ?? rN.value.data ?? []
        setNodes(raw.map((n: any) => ({
          nodeId: n.node_id ?? n.nodeId ?? '', chainId: n.chain_id ?? n.chainId ?? '',
          chainName: n.chain_name ?? n.chainName ?? '', level: Number(n.level ?? 0),
          nodeType: n.node_type ?? n.nodeType ?? 'individual', assignee: n.assignee ?? '',
          slaHours: Number(n.sla_hours ?? n.slaHours ?? 0),
          canDelegate: Boolean(n.can_delegate ?? n.canDelegate), canEscalate: Boolean(n.can_escalate ?? n.canEscalate),
          autoApproveCondition: n.auto_approve_condition ?? n.autoApproveCondition ?? '',
          pendingItems: Number(n.pending_items ?? n.pendingItems ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.escalations ?? rE.value.data ?? []
        setEscalations(raw.map((e: any) => ({
          escalationId: e.escalation_id ?? e.escalationId ?? '', chainId: e.chain_id ?? e.chainId ?? '',
          itemId: e.item_id ?? e.itemId ?? '', fromLevel: Number(e.from_level ?? e.fromLevel ?? 0),
          toLevel: Number(e.to_level ?? e.toLevel ?? 0), reason: e.reason ?? '',
          triggeredBy: e.triggered_by ?? e.triggeredBy ?? 'manual',
          resolvedAt: e.resolved_at ?? e.resolvedAt ?? '', status: e.status ?? 'open',
          escalatedAt: e.escalated_at ?? e.escalatedAt ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.delegations ?? rD.value.data ?? []
        setDelegations(raw.map((d: any) => ({
          delegationId: d.delegation_id ?? d.delegationId ?? '', nodeId: d.node_id ?? d.nodeId ?? '',
          chainName: d.chain_name ?? d.chainName ?? '', delegateFrom: d.delegate_from ?? d.delegateFrom ?? '',
          delegateTo: d.delegate_to ?? d.delegateTo ?? '', reason: d.reason ?? '',
          validFrom: d.valid_from ?? d.validFrom ?? '', validTo: d.valid_to ?? d.validTo ?? '',
          scope: d.scope ?? '', status: d.status ?? 'active',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', chainId: a.chain_id ?? a.chainId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const openEscalations = escalations.filter(e => e.status === 'open').length
  const activeDelegations = delegations.filter(d => d.status === 'active').length
  const totalPending = nodes.reduce((s, n) => s + n.pendingItems, 0)

  const TABS2 = [
    { id: 'chains' as const, label: 'CHAINS' },
    { id: 'nodes' as const, label: 'NODES' },
    { id: 'escalations' as const, label: 'ESCALATIONS' },
    { id: 'delegations' as const, label: 'DELEGATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>APPROVAL CHAIN â€” MULTI-LEVEL CHAIN ENGINE + ESCALATION + DELEGATION</span>
        {openEscalations > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {openEscalations} OPEN ESCALATIONS</span>}
        {totalPending > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {totalPending} PENDING ITEMS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Chains" value={chains.length} col={BLUE} />
        <StatCard label="Nodes" value={nodes.length} col={AMBER} />
        <StatCard label="Pending Items" value={totalPending} col={totalPending > 0 ? AMBER : GREEN} />
        <StatCard label="Open Escalations" value={openEscalations} col={openEscalations > 0 ? ORANGE : GREEN} />
        <StatCard label="Active Delegations" value={activeDelegations} col={PURPLE} />
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

        {tab === 'chains' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Chain</Th><Th>Risk</Th><Th>Status</Th><Th right>Levels</Th><Th right>SLA</Th><Th right>Passed</Th><Th right>Rejected</Th><Th right>Escalated</Th><Th right>Avg Hours</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {chains.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No chains â€” check /api/v4/approval-chain/chains</td></tr>}
                {chains.sort((a, b) => {
                  const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (p[a.riskLevel] ?? 4) - (p[b.riskLevel] ?? 4)
                }).map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.chainName}</Td>
                    <Td><RiskBadge r={c.riskLevel} /></Td>
                    <Td><StatusBadge2 s={c.status} /></Td>
                    <Td right><LevelPip level={c.maxLevel} max={5} /></Td>
                    <Td right mono col={c.slaHours < 4 ? RED : SUBTLE}>{c.slaHours}h</Td>
                    <Td right mono col={GREEN}>{c.passedCount}</Td>
                    <Td right mono col={RED}>{c.rejectedCount}</Td>
                    <Td right mono col={c.escalatedCount > 0 ? ORANGE : SUBTLE}>{c.escalatedCount}</Td>
                    <Td right mono col={SUBTLE}>{c.avgCompletionHours.toFixed(1)}h</Td>
                    <Td mono col={SUBTLE}>{c.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'nodes' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Chain</Th><Th right>Level</Th><Th>Type</Th><Th>Assignee</Th><Th right>SLA</Th><Th>Delegate</Th><Th>Escalate</Th><Th right>Pending</Th><Th>Auto-Approve</Th></tr></thead>
              <tbody>
                {nodes.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No nodes â€” check /api/v4/approval-chain/nodes</td></tr>}
                {nodes.sort((a, b) => a.chainName.localeCompare(b.chainName) || a.level - b.level).map((n, i) => (
                  <tr key={i} style={{ background: n.pendingItems > 0 ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{n.chainName}</Td>
                    <Td right mono col={SUBTLE}>{n.level}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{n.nodeType.toUpperCase()}</span></Td>
                    <Td mono col={TEXT}>{n.assignee}</Td>
                    <Td right mono col={n.slaHours < 2 ? RED : SUBTLE}>{n.slaHours}h</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.canDelegate ? GREEN : SUBTLE }}>{n.canDelegate ? 'âœ“ YES' : 'âœ— NO'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.canEscalate ? BLUE : SUBTLE }}>{n.canEscalate ? 'âœ“ YES' : 'âœ— NO'}</span></Td>
                    <Td right mono col={n.pendingItems > 0 ? AMBER : SUBTLE}>{n.pendingItems}</Td>
                    <Td mono col={SUBTLE}>{n.autoApproveCondition || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'escalations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Escalation ID</Th><Th>Chain</Th><Th>Item</Th><Th right>From</Th><Th right>To</Th><Th>Triggered By</Th><Th>Status</Th><Th>Reason</Th><Th>Escalated</Th><Th>Resolved</Th></tr></thead>
              <tbody>
                {escalations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No escalations â€” check /api/v4/approval-chain/escalations</td></tr>}
                {escalations.sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1)).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'open' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.escalationId}</Td>
                    <Td mono col={BLUE}>{e.chainId}</Td>
                    <Td mono col={SUBTLE}>{e.itemId}</Td>
                    <Td right mono col={SUBTLE}>{e.fromLevel}</Td>
                    <Td right mono col={ORANGE}>{e.toLevel}</Td>
                    <Td><StatusBadge2 s={e.triggeredBy} /></Td>
                    <Td><StatusBadge2 s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.reason.slice(0, 40)}{e.reason.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{e.escalatedAt}</Td>
                    <Td mono col={SUBTLE}>{e.resolvedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'delegations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Delegation ID</Th><Th>Chain</Th><Th>From</Th><Th>To</Th><Th>Scope</Th><Th>Status</Th><Th>Valid From</Th><Th>Valid To</Th><Th>Reason</Th></tr></thead>
              <tbody>
                {delegations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No delegations â€” check /api/v4/approval-chain/delegations</td></tr>}
                {delegations.sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1)).map((d, i) => (
                  <tr key={i} style={{ opacity: d.status !== 'active' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{d.delegationId}</Td>
                    <Td mono col={BLUE}>{d.chainName}</Td>
                    <Td mono col={TEXT}>{d.delegateFrom}</Td>
                    <Td mono col={GREEN}>{d.delegateTo}</Td>
                    <Td mono col={PURPLE}>{d.scope}</Td>
                    <Td><StatusBadge2 s={d.status} /></Td>
                    <Td mono col={SUBTLE}>{d.validFrom}</Td>
                    <Td mono col={SUBTLE}>{d.validTo}</Td>
                    <Td mono col={SUBTLE}>{d.reason.slice(0, 40)}{d.reason.length > 40 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Chain</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/approval-chain/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.chainId}</Td>
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
