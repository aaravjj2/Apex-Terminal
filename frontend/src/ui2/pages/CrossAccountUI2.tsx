import React, { useState, useEffect, useCallback } from 'react'
﻿// CrossAccountUI2 — Bloomberg CXAC cross-account management terminal
// Aggregated positions, PnL, exposure limits, margin consolidation, account reconciliation
// Tabs: ACCOUNTS | POSITIONS | EXPOSURE | MARGIN | RECONCILIATION
// APIs: /api/v4/cross-account/accounts, /positions, /exposure, /margin, /reconciliation

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

interface AccountEntry {
  id: string
  name: string
  type: 'live' | 'paper' | 'managed' | 'omnibus' | 'ira' | 'margin'
  currency: string
  nav: number
  cash: number
  unrealizedPnl: number
  realizedPnl: number
  positions: number
  owner: string
  status: 'active' | 'suspended' | 'closed'
  leverage: number
}

interface AggregatedPosition {
  symbol: string
  assetClass: string
  totalQty: number
  avgPrice: number
  marketValue: number
  unrealizedPnl: number
  dailyPnlPct: number
  accounts: number
  beta: number
  deltaExp: number
}

interface ExposureEntry {
  category: string
  grossExp: number
  netExp: number
  longExp: number
  shortExp: number
  limitGross: number
  utilizationPct: number
  currency: string
}

interface MarginEntry {
  accountId: string
  accountName: string
  initialMargin: number
  maintenanceMargin: number
  usedMargin: number
  availableMargin: number
  marginCallLevel: number
  excess: number
  utilizationPct: number
  currency: string
}

interface ReconciliationEntry {
  accountId: string
  accountName: string
  internalBalance: number
  brokerBalance: number
  discrepancy: number
  discrepancyPct: number
  lastReconciled: string
  status: 'matched' | 'discrepancy' | 'pending'
  breakItems: number
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

function UtilBar({ pct, warn, crit }: { pct: number; warn?: number; crit?: number }) {
  const c = pct >= (crit ?? 90) ? RED : pct >= (warn ?? 75) ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function AcctTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { live: GREEN, paper: BLUE, managed: PURPLE, omnibus: ORANGE, ira: AMBER, margin: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.toUpperCase()}</span>
}

function Pnl({ val, pct }: { val: number; pct?: number }) {
  const c = val >= 0 ? GREEN : RED
  return <span style={{ fontFamily: MONO, fontSize: 11, color: c }}>{val >= 0 ? '+' : ''}{val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{pct !== undefined ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)` : ''}</span>
}


export function CrossAccountUI2() {
  const [tab, setTab] = useState<'accounts' | 'positions' | 'exposure' | 'margin' | 'reconciliation'>('accounts')
  const [accounts, setAccounts] = useState<AccountEntry[]>([])
  const [positions, setPositions] = useState<AggregatedPosition[]>([])
  const [exposure, setExposure] = useState<ExposureEntry[]>([])
  const [margin, setMargin] = useState<MarginEntry[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rA, rP, rE, rM, rR] = await Promise.allSettled([
        fetch('/api/v4/cross-account/accounts').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-account/positions/aggregated').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-account/limits').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-margin/requirements').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reconciliation/status').then(r => r.ok ? r.json() : []),
      ])
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.accounts ?? rA.value.data ?? []
        setAccounts(raw.map((a: any) => ({
          id: a.id ?? '', name: a.name ?? '', type: a.type ?? 'live', currency: a.currency ?? 'USD',
          nav: Number(a.nav ?? 0), cash: Number(a.cash ?? 0), unrealizedPnl: Number(a.unrealized_pnl ?? a.unrealizedPnl ?? 0),
          realizedPnl: Number(a.realized_pnl ?? a.realizedPnl ?? 0), positions: Number(a.positions ?? 0),
          owner: a.owner ?? '', status: a.status ?? 'active', leverage: Number(a.leverage ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load accounts')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.positions ?? rP.value.data ?? []
        setPositions(raw.map((p: any) => ({
          symbol: p.symbol ?? '', assetClass: p.asset_class ?? p.assetClass ?? '',
          totalQty: Number(p.total_qty ?? p.totalQty ?? 0), avgPrice: Number(p.avg_price ?? p.avgPrice ?? 0),
          marketValue: Number(p.market_value ?? p.marketValue ?? 0),
          unrealizedPnl: Number(p.unrealized_pnl ?? p.unrealizedPnl ?? 0),
          dailyPnlPct: Number(p.daily_pnl_pct ?? p.dailyPnlPct ?? 0), accounts: Number(p.accounts ?? 1),
          beta: Number(p.beta ?? 0), deltaExp: Number(p.delta_exp ?? p.deltaExp ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.exposure ?? rE.value.data ?? []
        setExposure(raw.map((e: any) => ({
          category: e.category ?? '', grossExp: Number(e.gross_exp ?? e.grossExp ?? 0),
          netExp: Number(e.net_exp ?? e.netExp ?? 0), longExp: Number(e.long_exp ?? e.longExp ?? 0),
          shortExp: Number(e.short_exp ?? e.shortExp ?? 0), limitGross: Number(e.limit_gross ?? e.limitGross ?? 0),
          utilizationPct: Number(e.utilization_pct ?? e.utilizationPct ?? 0), currency: e.currency ?? 'USD',
        })))
      }
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.margin ?? rM.value.data ?? []
        setMargin(raw.map((m: any) => ({
          accountId: m.account_id ?? m.accountId ?? '', accountName: m.account_name ?? m.accountName ?? '',
          initialMargin: Number(m.initial_margin ?? m.initialMargin ?? 0), maintenanceMargin: Number(m.maintenance_margin ?? m.maintenanceMargin ?? 0),
          usedMargin: Number(m.used_margin ?? m.usedMargin ?? 0), availableMargin: Number(m.available_margin ?? m.availableMargin ?? 0),
          marginCallLevel: Number(m.margin_call_level ?? m.marginCallLevel ?? 0),
          excess: Number(m.excess ?? 0), utilizationPct: Number(m.utilization_pct ?? m.utilizationPct ?? 0),
          currency: m.currency ?? 'USD',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reconciliation ?? rR.value.data ?? []
        setReconciliation(raw.map((r: any) => ({
          accountId: r.account_id ?? r.accountId ?? '', accountName: r.account_name ?? r.accountName ?? '',
          internalBalance: Number(r.internal_balance ?? r.internalBalance ?? 0),
          brokerBalance: Number(r.broker_balance ?? r.brokerBalance ?? 0),
          discrepancy: Number(r.discrepancy ?? 0), discrepancyPct: Number(r.discrepancy_pct ?? r.discrepancyPct ?? 0),
          lastReconciled: r.last_reconciled ?? r.lastReconciled ?? '', status: r.status ?? 'pending',
          breakItems: Number(r.break_items ?? r.breakItems ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const totalNAV = accounts.reduce((s, a) => s + a.nav, 0)
  const totalPnl = accounts.reduce((s, a) => s + a.unrealizedPnl, 0)
  const marginAlerts = margin.filter(m => m.utilizationPct >= 85).length
  const reconBreaks = reconciliation.filter(r => r.status === 'discrepancy').length
  const expBreaches = exposure.filter(e => e.utilizationPct >= 90).length

  const TABS = [
    { id: 'accounts' as const, label: 'ACCOUNTS' },
    { id: 'positions' as const, label: 'POSITIONS' },
    { id: 'exposure' as const, label: 'EXPOSURE' },
    { id: 'margin' as const, label: 'MARGIN' },
    { id: 'reconciliation' as const, label: 'RECONCILIATION' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CXAC</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CROSS-ACCOUNT — ACCOUNTS + AGGREGATED POSITIONS + EXPOSURE + MARGIN + RECONCILIATION</span>
        {expBreaches > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {expBreaches} EXPOSURE BREACHES</span>}
        {marginAlerts > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {marginAlerts} MARGIN ALERTS</span>}
        {reconBreaks > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {reconBreaks} RECON BREAKS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Accounts" value={accounts.length} col={BLUE} />
        <StatCard label="Total NAV" value={totalNAV > 0 ? `$${(totalNAV / 1e6).toFixed(2)}M` : '—'} col={TEXT} />
        <StatCard label="Total Unrealized" value={`$${totalPnl.toLocaleString()}`} col={totalPnl >= 0 ? GREEN : RED} />
        <StatCard label="Margin Alerts" value={marginAlerts} col={marginAlerts > 0 ? ORANGE : GREEN} />
        <StatCard label="Recon Breaks" value={reconBreaks} col={reconBreaks > 0 ? AMBER : GREEN} />
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

        {tab === 'accounts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Account</Th><Th>Type</Th><Th>Owner</Th><Th>Status</Th><Th right>NAV</Th><Th right>Cash</Th><Th right>Unrealized PnL</Th><Th right>Positions</Th><Th right>Leverage</Th></tr></thead>
              <tbody>
                {accounts.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No accounts</td></tr>}
                {accounts.sort((a, b) => b.nav - a.nav).map((a, i) => (
                  <tr key={i} style={{ background: a.status === 'suspended' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.name}</Td>
                    <Td><AcctTypeBadge t={a.type} /></Td>
                    <Td mono col={BLUE}>{a.owner}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.status === 'active' ? GREEN : a.status === 'suspended' ? AMBER : RED }}>{a.status.toUpperCase()}</span></Td>
                    <Td right mono col={TEXT}>${a.nav.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>${a.cash.toLocaleString()}</Td>
                    <Td right><Pnl val={a.unrealizedPnl} /></Td>
                    <Td right mono col={a.positions > 0 ? BLUE : SUBTLE}>{a.positions}</Td>
                    <Td right mono col={a.leverage > 5 ? RED : a.leverage > 2 ? AMBER : TEXT}>{a.leverage.toFixed(1)}x</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'positions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Asset Class</Th><Th right>Total Qty</Th><Th right>Avg Price</Th><Th right>Market Value</Th><Th right>Unrealized PnL</Th><Th right>Daily %</Th><Th right>Accounts</Th><Th right>Beta</Th></tr></thead>
              <tbody>
                {positions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No positions</td></tr>}
                {positions.sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue)).map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.symbol}</Td>
                    <Td mono col={BLUE}>{p.assetClass}</Td>
                    <Td right mono col={p.totalQty >= 0 ? GREEN : RED}>{p.totalQty.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{p.avgPrice.toFixed(4)}</Td>
                    <Td right mono col={TEXT}>${p.marketValue.toLocaleString()}</Td>
                    <Td right><Pnl val={p.unrealizedPnl} /></Td>
                    <Td right mono col={p.dailyPnlPct >= 0 ? GREEN : RED}>{p.dailyPnlPct >= 0 ? '+' : ''}{p.dailyPnlPct.toFixed(2)}%</Td>
                    <Td right mono col={p.accounts > 1 ? PURPLE : SUBTLE}>{p.accounts}</Td>
                    <Td right mono col={Math.abs(p.beta) > 1.5 ? AMBER : TEXT}>{p.beta.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exposure' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Category</Th><Th>Utilization</Th><Th right>Gross Exp</Th><Th right>Net Exp</Th><Th right>Long</Th><Th right>Short</Th><Th right>Limit</Th></tr></thead>
              <tbody>
                {exposure.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exposure</td></tr>}
                {exposure.sort((a, b) => b.utilizationPct - a.utilizationPct).map((e, i) => (
                  <tr key={i} style={{ background: e.utilizationPct >= 90 ? RED + '0a' : e.utilizationPct >= 75 ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.category}</Td>
                    <Td><UtilBar pct={e.utilizationPct} warn={75} crit={90} /></Td>
                    <Td right mono col={ORANGE}>${(e.grossExp / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={e.netExp >= 0 ? GREEN : RED}>${(e.netExp / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={GREEN}>${(e.longExp / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={RED}>${(e.shortExp / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={SUBTLE}>${(e.limitGross / 1e6).toFixed(2)}M</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'margin' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Account</Th><Th>Utilization</Th><Th right>Initial Margin</Th><Th right>Used</Th><Th right>Available</Th><Th right>Excess</Th></tr></thead>
              <tbody>
                {margin.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No margin</td></tr>}
                {margin.sort((a, b) => b.utilizationPct - a.utilizationPct).map((m, i) => (
                  <tr key={i} style={{ background: m.utilizationPct >= 90 ? RED + '0a' : m.utilizationPct >= 75 ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.accountName}</Td>
                    <Td><UtilBar pct={m.utilizationPct} warn={75} crit={90} /></Td>
                    <Td right mono col={SUBTLE}>${m.initialMargin.toLocaleString()}</Td>
                    <Td right mono col={ORANGE}>${m.usedMargin.toLocaleString()}</Td>
                    <Td right mono col={m.availableMargin < m.maintenanceMargin ? RED : GREEN}>${m.availableMargin.toLocaleString()}</Td>
                    <Td right mono col={m.excess < 0 ? RED : GREEN}>${m.excess.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reconciliation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Account</Th><Th>Status</Th><Th right>Internal</Th><Th right>Broker</Th><Th right>Discrepancy</Th><Th right>% Diff</Th><Th right>Break Items</Th><Th>Last Reconciled</Th></tr></thead>
              <tbody>
                {reconciliation.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reconciliation</td></tr>}
                {reconciliation.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy)).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'discrepancy' ? AMBER + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.accountName}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.status === 'matched' ? GREEN : r.status === 'discrepancy' ? AMBER : SUBTLE }}>{r.status.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>${r.internalBalance.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>${r.brokerBalance.toLocaleString()}</Td>
                    <Td right mono col={Math.abs(r.discrepancy) > 100 ? RED : Math.abs(r.discrepancy) > 0 ? AMBER : GREEN}>{r.discrepancy >= 0 ? '+' : ''}{r.discrepancy.toLocaleString()}</Td>
                    <Td right mono col={Math.abs(r.discrepancyPct) > 1 ? RED : Math.abs(r.discrepancyPct) > 0.1 ? AMBER : GREEN}>{r.discrepancyPct >= 0 ? '+' : ''}{r.discrepancyPct.toFixed(4)}%</Td>
                    <Td right mono col={r.breakItems > 0 ? ORANGE : GREEN}>{r.breakItems}</Td>
                    <Td mono col={SUBTLE}>{r.lastReconciled}</Td>
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
