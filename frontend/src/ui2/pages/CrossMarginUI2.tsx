import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// CrossMarginUI2 — Bloomberg XMGN-grade cross-margin & portfolio margining terminal
// Tabs: PORTFOLIO MARGIN | COLLATERAL | MARGIN CALLS | STRESS TESTS | OPTIMIZER
// APIs: /api/v4/cross-margin/portfolio, /api/v4/cross-margin/collateral,
//       /api/v4/cross-margin/calls, /api/v4/cross-margin/stress,
//       /api/v4/cross-margin/optimize

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

interface MarginAccount {
  account: string
  portfolioValue: number
  marginEquity: number
  initialMargin: number
  maintenanceMargin: number
  marginExcess: number
  marginUtilization: number
  portfolioMarginReduction: number
  netLiquidity: number
  leverage: number
  buyingPower: number
  positions: MarginPosition[]
}

interface MarginPosition {
  symbol: string
  assetClass: string
  quantity: number
  marketValue: number
  initialMarginReq: number
  maintenanceMarginReq: number
  haircut: number
  concentrationCharge: number
  correlationOffset: number
  netMarginReq: number
}

interface CollateralEntry {
  asset: string
  type: 'cash' | 'equity' | 'bond' | 'etf' | 'other'
  marketValue: number
  haircut: number
  eligibleValue: number
  currency: string
  account: string
  pledged: boolean
}

interface MarginCall {
  callId: string
  account: string
  callType: 'initial' | 'maintenance' | 'variation' | 'delivery'
  amount: number
  currency: string
  dueDate: string
  status: 'pending' | 'met' | 'overdue' | 'partial'
  shortfall: number
  description: string
}

interface StressTest {
  scenarioName: string
  marketShock: number
  portfolioLoss: number
  marginIncrease: number
  newMarginReq: number
  marginShortfall: number
  probability: number
  severity: 'extreme' | 'severe' | 'moderate' | 'mild'
}

interface MarginOptimSuggestion {
  symbol: string
  action: 'reduce' | 'hedge' | 'rebalance' | 'add_collateral'
  currentMargin: number
  optimizedMargin: number
  saving: number
  description: string
}

// ── sub-components ─────────────────────────────────────────────────────────
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

function UtilBar({ pct }: { pct: number }) {
  const c = pct > 90 ? RED : pct > 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 70, height: 6, background: BORDER, borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: c, minWidth: 38 }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function SeverityBadge({ sev }: { sev: StressTest['severity'] }) {
  const c = sev === 'extreme' ? '#b71c1c' : sev === 'severe' ? RED : sev === 'moderate' ? AMBER : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{sev.toUpperCase()}</span>
}

function CallStatusBadge({ status }: { status: MarginCall['status'] }) {
  const c = status === 'met' ? GREEN : status === 'overdue' ? RED : status === 'partial' ? AMBER : BLUE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{status.toUpperCase()}</span>
}

function fmtM(v: number) { return `$${(v / 1e6).toFixed(2)}M` }
function fmtK(v: number) { return `$${(v / 1e3).toFixed(0)}K` }


export function CrossMarginUI2() {
  const [tab, setTab] = useState<'portfolio' | 'collateral' | 'calls' | 'stress' | 'optim'>('portfolio')
  const [accounts, setAccounts] = useState<MarginAccount[]>([])
  const [collateral, setCollateral] = useState<CollateralEntry[]>([])
  const [calls, setCalls] = useState<MarginCall[]>([])
  const [stressTests, setStressTests] = useState<StressTest[]>([])
  const [optimSuggestions, setOptimSuggestions] = useState<MarginOptimSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rPm, rCo, rCa, rSt, rOp] = await Promise.allSettled([
        fetch('/api/v4/cross-margin/portfolio').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-margin/collateral').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-margin/calls').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-margin/stress').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cross-margin/optimize').then(r => r.ok ? r.json() : []),
      ])

      if (rPm.status === 'fulfilled') {
        const d = rPm.value
        const raw: any[] = Array.isArray(d) ? d : d.accounts ?? d.portfolio ?? d.data ?? []
        setAccounts(raw.map((a: any) => ({
          account: a.account ?? a.account_id ?? '',
          portfolioValue: Number(a.portfolio_value ?? a.market_value ?? 0),
          marginEquity: Number(a.margin_equity ?? a.equity ?? 0),
          initialMargin: Number(a.initial_margin ?? a.im ?? 0),
          maintenanceMargin: Number(a.maintenance_margin ?? a.mm ?? 0),
          marginExcess: Number(a.margin_excess ?? a.excess ?? 0),
          marginUtilization: Number(a.margin_utilization ?? a.utilization ?? 0),
          portfolioMarginReduction: Number(a.portfolio_margin_reduction ?? a.pm_reduction ?? 0),
          netLiquidity: Number(a.net_liquidity ?? 0),
          leverage: Number(a.leverage ?? 0),
          buyingPower: Number(a.buying_power ?? a.bp ?? 0),
          positions: Array.isArray(a.positions) ? a.positions.map((p: any) => ({
            symbol: p.symbol ?? '', assetClass: p.asset_class ?? '',
            quantity: Number(p.quantity ?? 0), marketValue: Number(p.market_value ?? 0),
            initialMarginReq: Number(p.initial_margin_req ?? 0),
            maintenanceMarginReq: Number(p.maintenance_margin_req ?? 0),
            haircut: Number(p.haircut ?? 0), concentrationCharge: Number(p.concentration_charge ?? 0),
            correlationOffset: Number(p.correlation_offset ?? 0), netMarginReq: Number(p.net_margin_req ?? 0),
          })) : [],
        })))
        if (!selectedAccount && raw.length > 0) setSelectedAccount(raw[0].account ?? raw[0].account_id ?? '')
        setErr(null)
      } else setErr('Failed to load cross-margin data')

      if (rCo.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rCo.value) ? rCo.value : rCo.value.collateral ?? rCo.value.data ?? []
        setCollateral(raw.map((x: any) => ({
          asset: x.asset ?? x.symbol ?? '',
          type: (x.type ?? x.collateral_type ?? 'cash') as CollateralEntry['type'],
          marketValue: Number(x.market_value ?? 0),
          haircut: Number(x.haircut ?? 0),
          eligibleValue: Number(x.eligible_value ?? x.eligible ?? 0),
          currency: x.currency ?? 'USD',
          account: x.account ?? '',
          pledged: Boolean(x.pledged ?? false),
        })))
      }
      if (rCa.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rCa.value) ? rCa.value : rCa.value.calls ?? rCa.value.data ?? []
        setCalls(raw.map((x: any) => ({
          callId: x.call_id ?? x.id ?? '', account: x.account ?? '',
          callType: (x.call_type ?? x.type ?? 'maintenance') as MarginCall['callType'],
          amount: Number(x.amount ?? 0), currency: x.currency ?? 'USD',
          dueDate: x.due_date ?? x.due ?? '', status: (x.status ?? 'pending') as MarginCall['status'],
          shortfall: Number(x.shortfall ?? 0), description: x.description ?? '',
        })))
      }
      if (rSt.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rSt.value) ? rSt.value : rSt.value.scenarios ?? rSt.value.data ?? []
        setStressTests(raw.map((x: any) => ({
          scenarioName: x.scenario_name ?? x.name ?? '',
          marketShock: Number(x.market_shock ?? x.shock ?? 0),
          portfolioLoss: Number(x.portfolio_loss ?? x.loss ?? 0),
          marginIncrease: Number(x.margin_increase ?? 0),
          newMarginReq: Number(x.new_margin_req ?? 0),
          marginShortfall: Number(x.margin_shortfall ?? x.shortfall ?? 0),
          probability: Number(x.probability ?? 0),
          severity: (x.severity ?? 'moderate') as StressTest['severity'],
        })))
      }
      if (rOp.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rOp.value) ? rOp.value : rOp.value.suggestions ?? rOp.value.data ?? []
        setOptimSuggestions(raw.map((x: any) => ({
          symbol: x.symbol ?? '', action: (x.action ?? 'rebalance') as MarginOptimSuggestion['action'],
          currentMargin: Number(x.current_margin ?? 0), optimizedMargin: Number(x.optimized_margin ?? 0),
          saving: Number(x.saving ?? 0), description: x.description ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [selectedAccount])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const sel = accounts.find(a => a.account === selectedAccount) ?? accounts[0]
  const totalMarginExcess = accounts.reduce((s, a) => s + a.marginExcess, 0)
  const pendingCalls = calls.filter(c => c.status === 'pending' || c.status === 'overdue').length
  const totalCollatEligible = collateral.reduce((s, c) => s + c.eligibleValue, 0)
  const totalOptimSaving = optimSuggestions.reduce((s, x) => s + x.saving, 0)

  const TABS = [
    { id: 'portfolio' as const, label: 'PORTFOLIO MARGIN' },
    { id: 'collateral' as const, label: 'COLLATERAL' },
    { id: 'calls' as const, label: `MARGIN CALLS${pendingCalls > 0 ? ` (${pendingCalls})` : ''}` },
    { id: 'stress' as const, label: 'STRESS TESTS' },
    { id: 'optim' as const, label: 'OPTIMIZER' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>XMGN</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CROSS-MARGIN — PORTFOLIO MARGINING + COLLATERAL OPTIMIZATION</span>
        {pendingCalls > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠ {pendingCalls} CALLS DUE</span>}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Accounts" value={accounts.length} />
        {sel && <StatCard label="Margin Util" value={sel.marginUtilization.toFixed(1) + '%'} col={sel.marginUtilization > 80 ? RED : sel.marginUtilization > 60 ? AMBER : GREEN} sub={`${sel.account}`} />}
        <StatCard label="Margin Excess" value={fmtM(totalMarginExcess)} col={totalMarginExcess > 0 ? GREEN : RED} />
        <StatCard label="Collateral Eligible" value={fmtM(totalCollatEligible)} col={BLUE} />
        <StatCard label="Pending Calls" value={pendingCalls} col={pendingCalls > 0 ? RED : SUBTLE} />
        <StatCard label="Optim Saving" value={fmtK(totalOptimSaving)} col={GREEN} sub="potential margin reduction" />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading margin data...</div>}

        {/* ── PORTFOLIO MARGIN ── */}
        {tab === 'portfolio' && (
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Account selector */}
            <div style={{ width: 140, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>ACCOUNTS</div>
              {accounts.map(a => (
                <div key={a.account} onClick={() => setSelectedAccount(a.account)}
                  style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 3,
                    background: selectedAccount === a.account ? PANEL : 'transparent',
                    border: `1px solid ${selectedAccount === a.account ? BORDER : 'transparent'}`, marginBottom: 2 }}>
                  <div style={{ fontSize: 10, color: AMBER }}>{a.account}</div>
                  <UtilBar pct={a.marginUtilization} />
                </div>
              ))}
              {accounts.length === 0 && <div style={{ fontSize: 10, color: SUBTLE }}>No accounts</div>}
            </div>
            {/* Account detail */}
            {sel && (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  <StatCard label="Portfolio Value" value={fmtM(sel.portfolioValue)} col={BLUE} />
                  <StatCard label="Margin Equity" value={fmtM(sel.marginEquity)} />
                  <StatCard label="Initial Margin Req" value={fmtM(sel.initialMargin)} col={AMBER} />
                  <StatCard label="Maintenance Req" value={fmtM(sel.maintenanceMargin)} col={AMBER} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="Margin Excess" value={fmtM(sel.marginExcess)} col={sel.marginExcess > 0 ? GREEN : RED} />
                  <StatCard label="PM Reduction" value={fmtM(sel.portfolioMarginReduction)} col={GREEN} sub="vs Reg-T margin" />
                  <StatCard label="Leverage" value={sel.leverage.toFixed(1) + 'x'} col={sel.leverage > 4 ? RED : AMBER} />
                  <StatCard label="Buying Power" value={fmtM(sel.buyingPower)} col={BLUE} />
                </div>
                {sel.positions.length > 0 && (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>POSITIONS MARGIN BREAKDOWN</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <Th>Symbol</Th><Th right>Qty</Th><Th right>Mkt Value</Th>
                          <Th right>IM Req</Th><Th right>MM Req</Th><Th right>Net Mgn Req</Th>
                          <Th right>Haircut</Th><Th right>Conc Charge</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {sel.positions.map((p, i) => (
                          <tr key={i}>
                            <Td mono col={AMBER}>{p.symbol}</Td>
                            <Td right mono>{p.quantity.toLocaleString()}</Td>
                            <Td right mono col={BLUE}>{fmtK(p.marketValue)}</Td>
                            <Td right mono>{fmtK(p.initialMarginReq)}</Td>
                            <Td right mono>{fmtK(p.maintenanceMarginReq)}</Td>
                            <Td right mono col={p.netMarginReq < p.initialMarginReq ? GREEN : SUBTLE}>{fmtK(p.netMarginReq)}</Td>
                            <Td right mono col={ORANGE}>{(p.haircut * 100).toFixed(1)}%</Td>
                            <Td right mono col={p.concentrationCharge > 0 ? RED : SUBTLE}>{fmtK(p.concentrationCharge)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── COLLATERAL ── */}
        {tab === 'collateral' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Asset</Th><Th>Type</Th><Th>Currency</Th><Th>Account</Th>
                  <Th right>Market Value</Th><Th right>Haircut</Th><Th right>Eligible Value</Th><Th>Pledged</Th>
                </tr>
              </thead>
              <tbody>
                {collateral.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No collateral
                  </td></tr>
                )}
                {collateral.map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.asset}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{c.type.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{c.currency}</Td>
                    <Td mono col={SUBTLE}>{c.account}</Td>
                    <Td right mono col={BLUE}>{fmtK(c.marketValue)}</Td>
                    <Td right mono col={c.haircut > 0.2 ? RED : SUBTLE}>{(c.haircut * 100).toFixed(1)}%</Td>
                    <Td right mono col={GREEN}>{fmtK(c.eligibleValue)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.pledged ? GREEN : SUBTLE }}>{c.pledged ? 'YES' : 'NO'}</span></Td>
                  </tr>
                ))}
                {collateral.length > 0 && (
                  <tr style={{ background: '#0d0d0d' }}>
                    <Td mono col={TEXT}>TOTAL</Td><Td /><Td /><Td />
                    <Td right mono col={BLUE}>{fmtM(collateral.reduce((s, c) => s + c.marketValue, 0))}</Td>
                    <Td />
                    <Td right mono col={GREEN}>{fmtM(totalCollatEligible)}</Td>
                    <Td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── MARGIN CALLS ── */}
        {tab === 'calls' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {calls.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No margin calls</div>}
            {calls.map(c => (
              <div key={c.callId} style={{ background: PANEL, border: `1px solid ${c.status === 'overdue' ? RED + '66' : BORDER}`, borderRadius: 4, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <CallStatusBadge status={c.status} />
                <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, minWidth: 100 }}>{c.account}</span>
                <span style={{ fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{c.callType.toUpperCase()}</span>
                <span style={{ fontSize: 12, fontFamily: MONO, color: RED, fontWeight: 700, minWidth: 100 }}>${c.amount.toLocaleString()}</span>
                <span style={{ fontSize: 10, color: SUBTLE }}>Due: {c.dueDate}</span>
                <span style={{ flex: 1, fontSize: 10, color: TEXT }}>{c.description}</span>
                {c.shortfall > 0 && <span style={{ fontSize: 10, fontFamily: MONO, color: RED }}>Shortfall: ${c.shortfall.toLocaleString()}</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── STRESS TESTS ── */}
        {tab === 'stress' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Scenario</Th><Th>Severity</Th><Th right>Market Shock</Th>
                  <Th right>Portfolio Loss</Th><Th right>Margin Increase</Th><Th right>New Req</Th>
                  <Th right>Shortfall</Th><Th right>Probability</Th>
                </tr>
              </thead>
              <tbody>
                {stressTests.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No stress tests
                  </td></tr>
                )}
                {stressTests.map((s, i) => (
                  <tr key={i}>
                    <Td mono col={TEXT}>{s.scenarioName}</Td>
                    <Td><SeverityBadge sev={s.severity} /></Td>
                    <Td right mono col={RED}>{(s.marketShock * 100).toFixed(1)}%</Td>
                    <Td right mono col={RED}>{fmtM(s.portfolioLoss)}</Td>
                    <Td right mono col={ORANGE}>{fmtK(s.marginIncrease)}</Td>
                    <Td right mono col={AMBER}>{fmtM(s.newMarginReq)}</Td>
                    <Td right mono col={s.marginShortfall > 0 ? RED : GREEN}>{s.marginShortfall > 0 ? fmtK(s.marginShortfall) : '—'}</Td>
                    <Td right mono col={SUBTLE}>{(s.probability * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── OPTIMIZER ── */}
        {tab === 'optim' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <StatCard label="Suggestions" value={optimSuggestions.length} col={BLUE} />
              <StatCard label="Total Margin Saving" value={fmtK(totalOptimSaving)} col={GREEN} />
              <StatCard label="Avg Saving / Suggestion" value={optimSuggestions.length ? fmtK(totalOptimSaving / optimSuggestions.length) : '$0'} col={GREEN} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Action</Th><Th right>Current Margin</Th>
                    <Th right>Optimized</Th><Th right>Saving</Th><Th>Description</Th>
                  </tr>
                </thead>
                <tbody>
                  {optimSuggestions.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No suggestions
                    </td></tr>
                  )}
                  {[...optimSuggestions].sort((a, b) => b.saving - a.saving).map((s, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{s.symbol}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', padding: '2px 6px', borderRadius: 2 }}>{s.action.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td right mono>{fmtK(s.currentMargin)}</Td>
                      <Td right mono col={GREEN}>{fmtK(s.optimizedMargin)}</Td>
                      <Td right mono col={GREEN} style={{ fontWeight: 700 }}>{fmtK(s.saving)}</Td>
                      <Td mono col={SUBTLE} style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{s.description}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
