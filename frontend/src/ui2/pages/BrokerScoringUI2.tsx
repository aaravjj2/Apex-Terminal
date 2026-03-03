import React, { useState, useEffect, useCallback } from 'react'
﻿// BrokerScoringUI2 â€” Bloomberg BRKR-grade broker quality scoring terminal
// Execution benchmarking, counterparty analytics, commission tracking, SLA monitoring
// Tabs: BROKER SCORES | EXECUTION BENCHMARKS | COMMISSIONS | COUNTERPARTY RISK | SLA
// APIs: /api/v4/broker-scoring/scores, /benchmarks, /commissions, /counterparty, /sla

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

interface BrokerScore {
  brokerId: string
  brokerName: string
  tier: 'prime' | 'preferred' | 'standard' | 'restricted'
  overallScore: number
  fillQualityScore: number
  priceImprovementScore: number
  speedScore: number
  reliabilityScore: number
  complianceScore: number
  ordersYtd: number
  avgSlippageBps: number
  fillRatePct: number
}

interface BenchmarkEntry {
  brokerId: string
  brokerName: string
  symbol: string
  side: 'buy' | 'sell'
  vwapVsBenchmarkBps: number
  twapVsBenchmarkBps: number
  implementationShortfallBps: number
  participationRate: number
  avgOrderSizeK: number
  tradeCount: number
}

interface CommissionRecord {
  brokerId: string
  brokerName: string
  period: string
  totalCommissionUsd: number
  softDollarUsd: number
  hardDollarUsd: number
  shareCount: number
  commissionPerShareCents: number
  rebateUsd: number
  netCommissionUsd: number
}

interface CounterpartyRisk {
  brokerId: string
  brokerName: string
  creditRating: string
  exposureUsd: number
  limitUsd: number
  utilizationPct: number
  daysToSettlement: number
  pendingSettlementUsd: number
  failedTradesPct: number
  riskStatus: 'green' | 'amber' | 'red'
}

interface SlaEntry {
  brokerId: string
  brokerName: string
  metric: string
  target: number
  actual: number
  unit: string
  slaStatus: 'met' | 'breach' | 'warning'
  breachCount30d: number
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

function TierBadge({ tier }: { tier: string }) {
  const m: Record<string, string> = { prime: AMBER, preferred: GREEN, standard: BLUE, restricted: RED }
  const c = m[tier] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', border: `1px solid ${c}44`, borderRadius: 3, padding: '2px 6px' }}>{tier.toUpperCase()}</span>
}

function ScoreBar({ v, max = 100 }: { v: number; max?: number }) {
  const pct = (v / max) * 100
  const c = pct >= 80 ? GREEN : pct >= 60 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 55, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{v.toFixed(1)}</span>
    </div>
  )
}

function RiskBadge({ s }: { s: string }) {
  const m: Record<string, string> = { green: GREEN, amber: AMBER, red: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function SlaBadge({ s }: { s: string }) {
  const m: Record<string, string> = { met: GREEN, warning: AMBER, breach: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function UtilBar({ pct, crit = 90 }: { pct: number; crit?: number }) {
  const c = pct >= crit ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}


export function BrokerScoringUI2() {
  const [tab, setTab] = useState<'scores' | 'benchmarks' | 'commissions' | 'counterparty' | 'sla'>('scores')
  const [scores, setScores] = useState<BrokerScore[]>([])
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([])
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [counterparty, setCounterparty] = useState<CounterpartyRisk[]>([])
  const [sla, setSla] = useState<SlaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rB, rC, rCp, rSla] = await Promise.allSettled([
        fetch('/api/v4/broker-scoring/scores').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/broker-scoring/benchmarks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/broker-scoring/commissions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/broker-scoring/counterparty').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/broker-scoring/sla').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.brokers ?? rS.value.data ?? []
        setScores(raw.map((b: any) => ({
          brokerId: b.broker_id ?? b.brokerId ?? '', brokerName: b.broker_name ?? b.brokerName ?? '', tier: b.tier ?? 'standard',
          overallScore: Number(b.overall_score ?? b.overallScore ?? 0), fillQualityScore: Number(b.fill_quality_score ?? b.fillQualityScore ?? 0),
          priceImprovementScore: Number(b.price_improvement_score ?? b.priceImprovementScore ?? 0),
          speedScore: Number(b.speed_score ?? b.speedScore ?? 0), reliabilityScore: Number(b.reliability_score ?? b.reliabilityScore ?? 0),
          complianceScore: Number(b.compliance_score ?? b.complianceScore ?? 0), ordersYtd: Number(b.orders_ytd ?? b.ordersYtd ?? 0),
          avgSlippageBps: Number(b.avg_slippage_bps ?? b.avgSlippageBps ?? 0), fillRatePct: Number(b.fill_rate_pct ?? b.fillRatePct ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load broker scores')
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.benchmarks ?? rB.value.data ?? []
        setBenchmarks(raw.map((b: any) => ({
          brokerId: b.broker_id ?? b.brokerId ?? '', brokerName: b.broker_name ?? b.brokerName ?? '', symbol: b.symbol ?? '', side: b.side ?? 'buy',
          vwapVsBenchmarkBps: Number(b.vwap_vs_benchmark_bps ?? b.vwapVsBenchmarkBps ?? 0),
          twapVsBenchmarkBps: Number(b.twap_vs_benchmark_bps ?? b.twapVsBenchmarkBps ?? 0),
          implementationShortfallBps: Number(b.implementation_shortfall_bps ?? b.implementationShortfallBps ?? 0),
          participationRate: Number(b.participation_rate ?? b.participationRate ?? 0),
          avgOrderSizeK: Number(b.avg_order_size_k ?? b.avgOrderSizeK ?? 0), tradeCount: Number(b.trade_count ?? b.tradeCount ?? 0),
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.commissions ?? rC.value.data ?? []
        setCommissions(raw.map((c: any) => ({
          brokerId: c.broker_id ?? c.brokerId ?? '', brokerName: c.broker_name ?? c.brokerName ?? '', period: c.period ?? '',
          totalCommissionUsd: Number(c.total_commission_usd ?? c.totalCommissionUsd ?? 0),
          softDollarUsd: Number(c.soft_dollar_usd ?? c.softDollarUsd ?? 0), hardDollarUsd: Number(c.hard_dollar_usd ?? c.hardDollarUsd ?? 0),
          shareCount: Number(c.share_count ?? c.shareCount ?? 0), commissionPerShareCents: Number(c.commission_per_share_cents ?? c.commissionPerShareCents ?? 0),
          rebateUsd: Number(c.rebate_usd ?? c.rebateUsd ?? 0), netCommissionUsd: Number(c.net_commission_usd ?? c.netCommissionUsd ?? 0),
        })))
      }
      if (rCp.status === 'fulfilled') {
        const raw = Array.isArray(rCp.value) ? rCp.value : rCp.value.counterparty ?? rCp.value.data ?? []
        setCounterparty(raw.map((c: any) => ({
          brokerId: c.broker_id ?? c.brokerId ?? '', brokerName: c.broker_name ?? c.brokerName ?? '', creditRating: c.credit_rating ?? c.creditRating ?? '',
          exposureUsd: Number(c.exposure_usd ?? c.exposureUsd ?? 0), limitUsd: Number(c.limit_usd ?? c.limitUsd ?? 0),
          utilizationPct: Number(c.utilization_pct ?? c.utilizationPct ?? 0), daysToSettlement: Number(c.days_to_settlement ?? c.daysToSettlement ?? 0),
          pendingSettlementUsd: Number(c.pending_settlement_usd ?? c.pendingSettlementUsd ?? 0),
          failedTradesPct: Number(c.failed_trades_pct ?? c.failedTradesPct ?? 0), riskStatus: c.risk_status ?? c.riskStatus ?? 'green',
        })))
      }
      if (rSla.status === 'fulfilled') {
        const raw = Array.isArray(rSla.value) ? rSla.value : rSla.value.sla ?? rSla.value.data ?? []
        setSla(raw.map((s: any) => ({
          brokerId: s.broker_id ?? s.brokerId ?? '', brokerName: s.broker_name ?? s.brokerName ?? '', metric: s.metric ?? '',
          target: Number(s.target ?? 0), actual: Number(s.actual ?? 0), unit: s.unit ?? '',
          slaStatus: s.sla_status ?? s.slaStatus ?? 'met', breachCount30d: Number(s.breach_count_30d ?? s.breachCount30d ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const avgScore = scores.length > 0 ? scores.reduce((s, b) => s + b.overallScore, 0) / scores.length : 0
  const primeBrokers = scores.filter(b => b.tier === 'prime').length
  const restrictedBrokers = scores.filter(b => b.tier === 'restricted').length
  const totalCommYtd = commissions.reduce((s, c) => s + c.totalCommissionUsd, 0)

  const TABS = [
    { id: 'scores' as const, label: 'BROKER SCORES' },
    { id: 'benchmarks' as const, label: 'EXEC BENCHMARKS' },
    { id: 'commissions' as const, label: 'COMMISSIONS' },
    { id: 'counterparty' as const, label: 'COUNTERPARTY RISK' },
    { id: 'sla' as const, label: 'SLA' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>BRKR</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>BROKER SCORING â€” EXEC BENCHMARKING + COMMISSION TRACKING + COUNTERPARTY RISK + SLA</span>
        {restrictedBrokers > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠  {restrictedBrokers} RESTRICTED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>Loading...</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Brokers" value={scores.length} />
        <StatCard label="Avg Score" value={avgScore.toFixed(1)} col={avgScore >= 80 ? GREEN : avgScore >= 60 ? AMBER : RED} sub="/ 100" />
        <StatCard label="Prime Brokers" value={primeBrokers} col={AMBER} />
        <StatCard label="Restricted" value={restrictedBrokers} col={restrictedBrokers > 0 ? RED : GREEN} />
        <StatCard label="Total Comm YTD" value={`$${(totalCommYtd / 1e6).toFixed(2)}M`} col={PURPLE} />
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

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {/* BROKER SCORES */}
        {tab === 'scores' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Broker</Th><Th>Tier</Th><Th right>Overall</Th><Th>Fill Quality</Th><Th>Price Impr.</Th><Th>Speed</Th><Th>Reliability</Th><Th>Compliance</Th><Th right>Avg Slip</Th><Th right>Fill Rate</Th></tr></thead>
              <tbody>
                {scores.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No broker data â€” check /api/v4/broker-scoring/scores</td></tr>}
                {scores.sort((a, b) => b.overallScore - a.overallScore).map((b, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{b.brokerName}</Td>
                    <Td><TierBadge tier={b.tier} /></Td>
                    <Td right><ScoreBar v={b.overallScore} /></Td>
                    <Td><ScoreBar v={b.fillQualityScore} /></Td>
                    <Td><ScoreBar v={b.priceImprovementScore} /></Td>
                    <Td><ScoreBar v={b.speedScore} /></Td>
                    <Td><ScoreBar v={b.reliabilityScore} /></Td>
                    <Td><ScoreBar v={b.complianceScore} /></Td>
                    <Td right mono col={b.avgSlippageBps > 10 ? RED : b.avgSlippageBps > 3 ? AMBER : GREEN}>{b.avgSlippageBps.toFixed(2)} bps</Td>
                    <Td right mono col={b.fillRatePct > 95 ? GREEN : b.fillRatePct > 85 ? AMBER : RED}>{b.fillRatePct.toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BENCHMARKS */}
        {tab === 'benchmarks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Broker</Th><Th>Symbol</Th><Th>Side</Th><Th right>vs VWAP (bps)</Th><Th right>vs TWAP (bps)</Th><Th right>IS (bps)</Th><Th right>Part. Rate</Th><Th right>Avg Order</Th><Th right>Trades</Th></tr></thead>
              <tbody>
                {benchmarks.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No benchmark data â€” check /api/v4/broker-scoring/benchmarks</td></tr>}
                {benchmarks.map((b, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{b.brokerName}</Td>
                    <Td mono col={BLUE}>{b.symbol}</Td>
                    <Td mono col={b.side === 'buy' ? GREEN : RED}>{b.side.toUpperCase()}</Td>
                    <Td right mono col={b.vwapVsBenchmarkBps > 5 ? RED : b.vwapVsBenchmarkBps > 0 ? AMBER : GREEN}>{b.vwapVsBenchmarkBps >= 0 ? '+' : ''}{b.vwapVsBenchmarkBps.toFixed(2)}</Td>
                    <Td right mono col={b.twapVsBenchmarkBps > 5 ? RED : b.twapVsBenchmarkBps > 0 ? AMBER : GREEN}>{b.twapVsBenchmarkBps >= 0 ? '+' : ''}{b.twapVsBenchmarkBps.toFixed(2)}</Td>
                    <Td right mono col={b.implementationShortfallBps > 10 ? RED : AMBER}>{b.implementationShortfallBps.toFixed(2)}</Td>
                    <Td right mono>{(b.participationRate * 100).toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>${b.avgOrderSizeK.toFixed(0)}K</Td>
                    <Td right mono col={SUBTLE}>{b.tradeCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* COMMISSIONS */}
        {tab === 'commissions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Broker</Th><Th>Period</Th><Th right>Total Comm</Th><Th right>Hard $</Th><Th right>Soft $</Th><Th right>Rebate</Th><Th right>Net Comm</Th><Th right>Â¢/Share</Th><Th right>Shares</Th></tr></thead>
              <tbody>
                {commissions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No commission data â€” check /api/v4/broker-scoring/commissions</td></tr>}
                {commissions.sort((a, b) => b.totalCommissionUsd - a.totalCommissionUsd).map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.brokerName}</Td>
                    <Td mono col={SUBTLE}>{c.period}</Td>
                    <Td right mono col={ORANGE}>${(c.totalCommissionUsd / 1e3).toFixed(1)}K</Td>
                    <Td right mono>${(c.hardDollarUsd / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={PURPLE}>${(c.softDollarUsd / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={GREEN}>${(c.rebateUsd / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={RED}>${(c.netCommissionUsd / 1e3).toFixed(1)}K</Td>
                    <Td right mono col={c.commissionPerShareCents > 3 ? RED : GREEN}>{c.commissionPerShareCents.toFixed(3)}Â¢</Td>
                    <Td right mono col={SUBTLE}>{(c.shareCount / 1e6).toFixed(2)}M</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* COUNTERPARTY RISK */}
        {tab === 'counterparty' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Broker</Th><Th>Credit</Th><Th>Risk Status</Th><Th right>Exposure</Th><Th right>Limit</Th><Th>Utilization</Th><Th right>Pending Sett.</Th><Th right>Failed %</Th><Th right>DTS</Th></tr></thead>
              <tbody>
                {counterparty.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No counterparty data â€” check /api/v4/broker-scoring/counterparty</td></tr>}
                {counterparty.sort((a, b) => b.utilizationPct - a.utilizationPct).map((c, i) => (
                  <tr key={i} style={{ background: c.riskStatus === 'red' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.brokerName}</Td>
                    <Td mono col={c.creditRating.startsWith('A') ? GREEN : c.creditRating.startsWith('B') ? AMBER : RED}>{c.creditRating}</Td>
                    <Td><RiskBadge s={c.riskStatus} /></Td>
                    <Td right mono col={ORANGE}>${(c.exposureUsd / 1e6).toFixed(1)}M</Td>
                    <Td right mono col={SUBTLE}>${(c.limitUsd / 1e6).toFixed(1)}M</Td>
                    <Td><UtilBar pct={c.utilizationPct} /></Td>
                    <Td right mono col={BLUE}>${(c.pendingSettlementUsd / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={c.failedTradesPct > 0.5 ? RED : GREEN}>{c.failedTradesPct.toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{c.daysToSettlement}d</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SLA */}
        {tab === 'sla' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Broker</Th><Th>Metric</Th><Th>Status</Th><Th right>Target</Th><Th right>Actual</Th><Th>Unit</Th><Th right>Breaches 30d</Th></tr></thead>
              <tbody>
                {sla.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No SLA data â€” check /api/v4/broker-scoring/sla</td></tr>}
                {sla.sort((a, b) => { const o: Record<string, number> = { breach: 0, warning: 1, met: 2 }; return (o[a.slaStatus] ?? 9) - (o[b.slaStatus] ?? 9) }).map((s, i) => (
                  <tr key={i} style={{ background: s.slaStatus === 'breach' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.brokerName}</Td>
                    <Td mono col={TEXT}>{s.metric}</Td>
                    <Td><SlaBadge s={s.slaStatus} /></Td>
                    <Td right mono col={SUBTLE}>{s.target} {s.unit}</Td>
                    <Td right mono col={s.slaStatus === 'met' ? GREEN : s.slaStatus === 'warning' ? AMBER : RED}>{s.actual} {s.unit}</Td>
                    <Td mono col={SUBTLE}>{s.unit}</Td>
                    <Td right mono col={s.breachCount30d > 0 ? RED : GREEN}>{s.breachCount30d}</Td>
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
