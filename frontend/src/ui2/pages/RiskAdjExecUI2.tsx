import React, { useState, useEffect, useCallback } from 'react'
﻿// RiskAdjExecUI2 — Bloomberg APEX risk-adjusted execution terminal
// Dynamic size optimization, VaR-gated orders, adaptive algorithms, execution analytics
// Tabs: ORDERS | RISK PARAMS | SIGNALS | PERFORMANCE | AUDIT
// APIs: /api/v4/risk-adj-exec/orders, /risk-params, /signals, /performance, /audit

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

interface RiskAdjOrder {
  orderId: string
  symbol: string
  side: 'buy' | 'sell' | 'short' | 'cover'
  requestedQty: number
  adjustedQty: number
  adjReason: string
  algorithm: 'twap' | 'vwap' | 'pov' | 'is' | 'arrival_price' | 'sniper'
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'rejected'
  varBudgetUsd: number
  varConsumedUsd: number
  slippageBps: number
  fillPct: number
  startedAt: string
}

interface RiskParameter {
  paramId: string
  name: string
  scope: 'global' | 'portfolio' | 'asset_class' | 'symbol'
  type: 'var_limit' | 'position_limit' | 'concentration' | 'drawdown' | 'beta' | 'correlation'
  currentValue: number
  limit: number
  utilizationPct: number
  status: 'ok' | 'warning' | 'breach'
  lastUpdated: string
}

interface RiskSignal {
  signalId: string
  name: string
  category: 'volatility' | 'momentum' | 'mean_reversion' | 'sentiment' | 'liquidity' | 'macro'
  value: number
  normalizedScore: number
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: 'strong' | 'moderate' | 'weak'
  confidencePct: number
  halfLifeMin: number
  weight: number
}

interface ExecPerformance {
  sessionId: string
  strategy: string
  totalOrders: number
  completedOrders: number
  totalNotional: number
  avgSlippageBps: number
  avgFillRatePct: number
  varEfficiencyPct: number
  reductionFromRiskAdj: number
  pnlFromExec: number
  date: string
}

interface RiskExecAuditEntry {
  auditId: string
  orderId: string
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
  const m: Record<string, string> = { ok: GREEN, warning: AMBER, breach: RED, active: AMBER, completed: GREEN, pending: BLUE, cancelled: SUBTLE, rejected: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SideBadge({ s }: { s: string }) {
  const m: Record<string, string> = { buy: GREEN, cover: GREEN, sell: RED, short: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function AlgoBadge({ a }: { a: string }) {
  const m: Record<string, string> = { twap: BLUE, vwap: GREEN, pov: AMBER, is: PURPLE, arrival_price: ORANGE, sniper: RED }
  const c = m[a] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{a.toUpperCase()}</span>
}
function ScoreBar({ v, max }: { v: number; max: number }) {
  const pct = Math.min(100, (v / max) * 100)
  const col = pct > 80 ? RED : pct > 60 ? ORANGE : pct > 40 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{v.toFixed(1)}</span>
    </div>
  )
}
function DirBadge({ d }: { d: string }) {
  const m: Record<string, string> = { bullish: GREEN, bearish: RED, neutral: SUBTLE }
  const c = m[d] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{d.toUpperCase()}</span>
}


export function RiskAdjExecUI2() {
  const [tab, setTab] = useState<'orders' | 'risk-params' | 'signals' | 'performance' | 'audit'>('orders')
  const [orders, setOrders] = useState<RiskAdjOrder[]>([])
  const [riskParams, setRiskParams] = useState<RiskParameter[]>([])
  const [signals, setSignals] = useState<RiskSignal[]>([])
  const [performance, setPerformance] = useState<ExecPerformance[]>([])
  const [auditLog, setAuditLog] = useState<RiskExecAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rO, rP, rS, rPf, rA] = await Promise.allSettled([
        fetch('/api/v4/risk-adj-exec/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-adj-exec/risk-params').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-adj-exec/signals').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-adj-exec/performance').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-adj-exec/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rO.status === 'fulfilled') {
        const raw = Array.isArray(rO.value) ? rO.value : rO.value.orders ?? rO.value.data ?? []
        setOrders(raw.map((o: any) => ({
          orderId: o.order_id ?? o.orderId ?? '', symbol: o.symbol ?? '',
          side: o.side ?? 'buy', requestedQty: Number(o.requested_qty ?? o.requestedQty ?? 0),
          adjustedQty: Number(o.adjusted_qty ?? o.adjustedQty ?? 0), adjReason: o.adj_reason ?? o.adjReason ?? '',
          algorithm: o.algorithm ?? 'twap', status: o.status ?? 'pending',
          varBudgetUsd: Number(o.var_budget_usd ?? o.varBudgetUsd ?? 0),
          varConsumedUsd: Number(o.var_consumed_usd ?? o.varConsumedUsd ?? 0),
          slippageBps: Number(o.slippage_bps ?? o.slippageBps ?? 0),
          fillPct: Number(o.fill_pct ?? o.fillPct ?? 0), startedAt: o.started_at ?? o.startedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load orders')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.params ?? rP.value.data ?? []
        setRiskParams(raw.map((p: any) => ({
          paramId: p.param_id ?? p.paramId ?? '', name: p.name ?? '',
          scope: p.scope ?? 'global', type: p.type ?? 'var_limit',
          currentValue: Number(p.current_value ?? p.currentValue ?? 0),
          limit: Number(p.limit ?? 0), utilizationPct: Number(p.utilization_pct ?? p.utilizationPct ?? 0),
          status: p.status ?? 'ok', lastUpdated: p.last_updated ?? p.lastUpdated ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.signals ?? rS.value.data ?? []
        setSignals(raw.map((s: any) => ({
          signalId: s.signal_id ?? s.signalId ?? '', name: s.name ?? '',
          category: s.category ?? 'volatility', value: Number(s.value ?? 0),
          normalizedScore: Number(s.normalized_score ?? s.normalizedScore ?? 0),
          direction: s.direction ?? 'neutral', strength: s.strength ?? 'moderate',
          confidencePct: Number(s.confidence_pct ?? s.confidencePct ?? 0),
          halfLifeMin: Number(s.half_life_min ?? s.halfLifeMin ?? 0),
          weight: Number(s.weight ?? 0),
        })))
      }
      if (rPf.status === 'fulfilled') {
        const raw = Array.isArray(rPf.value) ? rPf.value : rPf.value.sessions ?? rPf.value.data ?? []
        setPerformance(raw.map((p: any) => ({
          sessionId: p.session_id ?? p.sessionId ?? '', strategy: p.strategy ?? '',
          totalOrders: Number(p.total_orders ?? p.totalOrders ?? 0),
          completedOrders: Number(p.completed_orders ?? p.completedOrders ?? 0),
          totalNotional: Number(p.total_notional ?? p.totalNotional ?? 0),
          avgSlippageBps: Number(p.avg_slippage_bps ?? p.avgSlippageBps ?? 0),
          avgFillRatePct: Number(p.avg_fill_rate_pct ?? p.avgFillRatePct ?? 0),
          varEfficiencyPct: Number(p.var_efficiency_pct ?? p.varEfficiencyPct ?? 0),
          reductionFromRiskAdj: Number(p.reduction_from_risk_adj ?? p.reductionFromRiskAdj ?? 0),
          pnlFromExec: Number(p.pnl_from_exec ?? p.pnlFromExec ?? 0),
          date: p.date ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', orderId: a.order_id ?? a.orderId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 5000); return () => clearInterval(id) }, [fetchAll])

  const breachCount = riskParams.filter(p => p.status === 'breach').length
  const activeOrders = orders.filter(o => o.status === 'active').length
  const avgFill = performance.length ? performance.reduce((a, p) => a + p.avgFillRatePct, 0) / performance.length : 0
  const avgSlippage = performance.length ? performance.reduce((a, p) => a + p.avgSlippageBps, 0) / performance.length : 0

  const TABS2 = [
    { id: 'orders' as const, label: 'ORDERS' },
    { id: 'risk-params' as const, label: 'RISK PARAMS' },
    { id: 'signals' as const, label: 'SIGNALS' },
    { id: 'performance' as const, label: 'PERFORMANCE' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RISK-ADJ EXECUTION — DYNAMIC SIZING + VaR-GATED + ADAPTIVE ALGORITHMS</span>
        {breachCount > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚑ {breachCount} BREACH</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Orders" value={activeOrders} col={AMBER} />
        <StatCard label="Risk Breaches" value={breachCount} col={breachCount > 0 ? RED : GREEN} />
        <StatCard label="Avg Fill Rate" value={`${avgFill.toFixed(1)}%`} col={avgFill > 90 ? GREEN : AMBER} />
        <StatCard label="Avg Slippage" value={`${avgSlippage.toFixed(2)} bps`} col={avgSlippage > 5 ? RED : GREEN} />
        <StatCard label="Signals Active" value={signals.filter(s => s.strength !== 'weak').length} col={BLUE} />
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

        {tab === 'orders' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Order ID</Th><Th>Symbol</Th><Th>Side</Th><Th>Algorithm</Th><Th>Status</Th><Th right>Req Qty</Th><Th right>Adj Qty</Th><Th>Adj Reason</Th><Th right>Fill %</Th><Th right>Slippage bps</Th><Th>VaR %</Th></tr></thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No orders — check /api/v4/risk-adj-exec/orders</td></tr>}
                {orders.map((o, i) => (
                  <tr key={i} style={{ background: o.status === 'rejected' ? RED + '0a' : o.status === 'active' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{o.orderId}</Td>
                    <Td mono col={BLUE}>{o.symbol}</Td>
                    <Td><SideBadge s={o.side} /></Td>
                    <Td><AlgoBadge a={o.algorithm} /></Td>
                    <Td><StatusBadge s={o.status} /></Td>
                    <Td right mono col={TEXT}>{o.requestedQty.toLocaleString()}</Td>
                    <Td right mono col={o.adjustedQty < o.requestedQty ? ORANGE : GREEN}>{o.adjustedQty.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{o.adjReason || '—'}</Td>
                    <Td right mono col={o.fillPct > 90 ? GREEN : o.fillPct > 50 ? AMBER : RED}>{o.fillPct.toFixed(1)}%</Td>
                    <Td right mono col={o.slippageBps > 5 ? RED : o.slippageBps > 2 ? AMBER : GREEN}>{o.slippageBps.toFixed(2)}</Td>
                    <Td><ScoreBar v={o.varBudgetUsd > 0 ? (o.varConsumedUsd / o.varBudgetUsd) * 100 : 0} max={100} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'risk-params' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Parameter</Th><Th>Scope</Th><Th>Type</Th><Th>Status</Th><Th right>Current</Th><Th right>Limit</Th><Th>Utilization</Th><Th>Last Updated</Th></tr></thead>
              <tbody>
                {riskParams.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No risk params — check /api/v4/risk-adj-exec/risk-params</td></tr>}
                {riskParams.sort((a, b) => b.utilizationPct - a.utilizationPct).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'breach' ? RED + '0a' : p.status === 'warning' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td mono col={BLUE}>{p.scope.replace('_', ' ').toUpperCase()}</Td>
                    <Td mono col={PURPLE}>{p.type.replace(/_/g, ' ').toUpperCase()}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td right mono col={TEXT}>{p.currentValue.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{p.limit.toFixed(2)}</Td>
                    <Td><ScoreBar v={p.utilizationPct} max={100} /></Td>
                    <Td mono col={SUBTLE}>{p.lastUpdated || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'signals' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Signal</Th><Th>Category</Th><Th>Direction</Th><Th>Strength</Th><Th right>Score</Th><Th right>Value</Th><Th right>Confidence %</Th><Th right>Half-life min</Th><Th right>Weight</Th></tr></thead>
              <tbody>
                {signals.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No signals — check /api/v4/risk-adj-exec/signals</td></tr>}
                {signals.sort((a, b) => b.normalizedScore - a.normalizedScore).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td mono col={BLUE}>{s.category.replace('_', '-').toUpperCase()}</Td>
                    <Td><DirBadge d={s.direction} /></Td>
                    <Td mono col={s.strength === 'strong' ? GREEN : s.strength === 'moderate' ? AMBER : SUBTLE}>{s.strength.toUpperCase()}</Td>
                    <Td right><ScoreBar v={s.normalizedScore} max={100} /></Td>
                    <Td right mono col={TEXT}>{s.value.toFixed(4)}</Td>
                    <Td right mono col={s.confidencePct > 75 ? GREEN : s.confidencePct > 50 ? AMBER : RED}>{s.confidencePct.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{s.halfLifeMin}</Td>
                    <Td right mono col={PURPLE}>{s.weight.toFixed(3)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'performance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Session</Th><Th>Strategy</Th><Th>Date</Th><Th right>Orders</Th><Th right>Notional</Th><Th right>Avg Slippage bps</Th><Th right>Fill Rate %</Th><Th right>VaR Eff %</Th><Th right>Risk Adj Reduction</Th><Th right>Exec PnL</Th></tr></thead>
              <tbody>
                {performance.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No performance — check /api/v4/risk-adj-exec/performance</td></tr>}
                {performance.map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.sessionId}</Td>
                    <Td mono col={BLUE}>{p.strategy}</Td>
                    <Td mono col={SUBTLE}>{p.date}</Td>
                    <Td right mono col={TEXT}>{p.completedOrders}/{p.totalOrders}</Td>
                    <Td right mono col={TEXT}>${p.totalNotional.toLocaleString()}</Td>
                    <Td right mono col={p.avgSlippageBps > 5 ? RED : p.avgSlippageBps > 2 ? AMBER : GREEN}>{p.avgSlippageBps.toFixed(2)}</Td>
                    <Td right mono col={p.avgFillRatePct > 90 ? GREEN : AMBER}>{p.avgFillRatePct.toFixed(1)}</Td>
                    <Td right mono col={p.varEfficiencyPct > 80 ? GREEN : AMBER}>{p.varEfficiencyPct.toFixed(1)}</Td>
                    <Td right mono col={PURPLE}>{p.reductionFromRiskAdj.toFixed(1)}%</Td>
                    <Td right mono col={p.pnlFromExec >= 0 ? GREEN : RED}>${p.pnlFromExec.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Order ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/risk-adj-exec/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.orderId || '—'}</Td>
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
