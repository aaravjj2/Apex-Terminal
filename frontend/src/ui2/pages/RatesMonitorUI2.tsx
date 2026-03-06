import React, { useState, useEffect, useCallback } from 'react'
﻿// RatesMonitorUI2 — Bloomberg APEX interest rates monitor
// Yield curves, spreads, central bank tracking, sovereign bonds
// Tabs: YIELD CURVES | SPREADS | CENTRAL BANKS | BONDS | AUDIT
// APIs: /api/v4/rates/yield-curves, /spreads, /central-banks, /bonds, /audit

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

interface YieldCurve {
  curveId: string
  country: string
  currency: string
  m1: number; m3: number; m6: number
  y1: number; y2: number; y5: number; y10: number; y30: number
  slope: number
  inverted: boolean
  asOf: string
}

interface RateSpread {
  spreadId: string
  name: string
  legA: string
  legB: string
  spreadBps: number
  changeBps: number
  min52w: number
  max52w: number
  category: 'credit' | 'sovereign' | 'swap' | 'basis' | 'ted'
  asOf: string
}

interface CentralBank {
  bankId: string
  name: string
  country: string
  currency: string
  currentRate: number
  prevRate: number
  nextMeeting: string
  expectedChange: number
  marketImplied: number
  hike_cut: 'hike' | 'cut' | 'hold'
  lastAction: string
}

interface SovereignBond {
  bondId: string
  issuer: string
  isin: string
  maturity: string
  couponPct: number
  yieldPct: number
  durationYears: number
  bidPx: number
  askPx: number
  spreadVsSwapBps: number
  lastUpdated: string
}

interface RatesAuditEntry {
  auditId: string
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
function BpsChange({ bps }: { bps: number }) {
  const col = bps > 0 ? RED : bps < 0 ? GREEN : SUBTLE
  const sign = bps > 0 ? '+' : ''
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{sign}{bps.toFixed(1)}</span>
}
function HikeCut({ v }: { v: string }) {
  const m: Record<string, string> = { hike: RED, cut: GREEN, hold: AMBER }
  const col = m[v] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{v.toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { credit: ORANGE, sovereign: BLUE, swap: PURPLE, basis: AMBER, ted: GREEN }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function YieldCell({ v, inverted }: { v: number; inverted?: boolean }) {
  const col = inverted ? ORANGE : v > 5 ? RED : v < 0 ? RED : v < 2 ? AMBER : GREEN
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{v.toFixed(3)}%</span>
}


export function RatesMonitorUI2() {
  const [tab, setTab] = useState<'yield-curves' | 'spreads' | 'central-banks' | 'bonds' | 'audit'>('yield-curves')
  const [yieldCurves, setYieldCurves] = useState<YieldCurve[]>([])
  const [spreads, setSpreads] = useState<RateSpread[]>([])
  const [centralBanks, setCentralBanks] = useState<CentralBank[]>([])
  const [bonds, setBonds] = useState<SovereignBond[]>([])
  const [auditLog, setAuditLog] = useState<RatesAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rY, rS, rC, rB, rA] = await Promise.allSettled([
        fetch('/api/v4/rates/yield-curves').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/rates/spreads').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/rates/central-banks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/rates/bonds').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/rates/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rY.status === 'fulfilled') {
        const raw = Array.isArray(rY.value) ? rY.value : rY.value.yield_curves ?? rY.value.data ?? []
        setYieldCurves(raw.map((y: any) => ({
          curveId: y.curve_id ?? y.curveId ?? '', country: y.country ?? '',
          currency: y.currency ?? '', m1: Number(y.m1 ?? 0), m3: Number(y.m3 ?? 0),
          m6: Number(y.m6 ?? 0), y1: Number(y.y1 ?? 0), y2: Number(y.y2 ?? 0),
          y5: Number(y.y5 ?? 0), y10: Number(y.y10 ?? 0), y30: Number(y.y30 ?? 0),
          slope: Number(y.slope ?? 0), inverted: Boolean(y.inverted), asOf: y.as_of ?? y.asOf ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load yield curves')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.spreads ?? rS.value.data ?? []
        setSpreads(raw.map((s: any) => ({
          spreadId: s.spread_id ?? s.spreadId ?? '', name: s.name ?? '',
          legA: s.leg_a ?? s.legA ?? '', legB: s.leg_b ?? s.legB ?? '',
          spreadBps: Number(s.spread_bps ?? s.spreadBps ?? 0),
          changeBps: Number(s.change_bps ?? s.changeBps ?? 0),
          min52w: Number(s.min_52w ?? s.min52w ?? 0), max52w: Number(s.max_52w ?? s.max52w ?? 0),
          category: s.category ?? 'credit', asOf: s.as_of ?? s.asOf ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.central_banks ?? rC.value.data ?? []
        setCentralBanks(raw.map((c: any) => ({
          bankId: c.bank_id ?? c.bankId ?? '', name: c.name ?? '',
          country: c.country ?? '', currency: c.currency ?? '',
          currentRate: Number(c.current_rate ?? c.currentRate ?? 0),
          prevRate: Number(c.prev_rate ?? c.prevRate ?? 0),
          nextMeeting: c.next_meeting ?? c.nextMeeting ?? '',
          expectedChange: Number(c.expected_change ?? c.expectedChange ?? 0),
          marketImplied: Number(c.market_implied ?? c.marketImplied ?? 0),
          hike_cut: c.hike_cut ?? 'hold', lastAction: c.last_action ?? c.lastAction ?? '',
        })))
      }
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.bonds ?? rB.value.data ?? []
        setBonds(raw.map((b: any) => ({
          bondId: b.bond_id ?? b.bondId ?? '', issuer: b.issuer ?? '',
          isin: b.isin ?? '', maturity: b.maturity ?? '',
          couponPct: Number(b.coupon_pct ?? b.couponPct ?? 0),
          yieldPct: Number(b.yield_pct ?? b.yieldPct ?? 0),
          durationYears: Number(b.duration_years ?? b.durationYears ?? 0),
          bidPx: Number(b.bid_px ?? b.bidPx ?? 0), askPx: Number(b.ask_px ?? b.askPx ?? 0),
          spreadVsSwapBps: Number(b.spread_vs_swap_bps ?? b.spreadVsSwapBps ?? 0),
          lastUpdated: b.last_updated ?? b.lastUpdated ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const invertedCount = yieldCurves.filter(y => y.inverted).length

  const TABS2 = [
    { id: 'yield-curves' as const, label: 'YIELD CURVES' },
    { id: 'spreads' as const, label: 'SPREADS' },
    { id: 'central-banks' as const, label: 'CENTRAL BANKS' },
    { id: 'bonds' as const, label: 'BONDS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RATES MONITOR — YIELD CURVES + SPREADS + CENTRAL BANK + SOVEREIGN BONDS</span>
        {invertedCount > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {invertedCount} INVERTED CURVE{invertedCount > 1 ? 'S' : ''}</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Yield Curves" value={yieldCurves.length} col={BLUE} />
        <StatCard label="Inverted" value={invertedCount} col={invertedCount > 0 ? ORANGE : GREEN} />
        <StatCard label="Rate Spreads" value={spreads.length} col={AMBER} />
        <StatCard label="Central Banks" value={centralBanks.length} col={PURPLE} />
        <StatCard label="Sovereign Bonds" value={bonds.length} col={GREEN} />
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

        {tab === 'yield-curves' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Country</Th><Th>CCY</Th><Th right>1M</Th><Th right>3M</Th><Th right>6M</Th><Th right>1Y</Th><Th right>2Y</Th><Th right>5Y</Th><Th right>10Y</Th><Th right>30Y</Th><Th right>Slope 10Y-2Y</Th><Th>Shape</Th><Th>As of</Th></tr></thead>
              <tbody>
                {yieldCurves.length === 0 && <tr><td colSpan={13} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No yield curves</td></tr>}
                {yieldCurves.map((y, i) => (
                  <tr key={i} style={{ background: y.inverted ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{y.country}</Td>
                    <Td mono col={BLUE}>{y.currency}</Td>
                    <Td right><YieldCell v={y.m1} /></Td>
                    <Td right><YieldCell v={y.m3} /></Td>
                    <Td right><YieldCell v={y.m6} /></Td>
                    <Td right><YieldCell v={y.y1} /></Td>
                    <Td right><YieldCell v={y.y2} /></Td>
                    <Td right><YieldCell v={y.y5} /></Td>
                    <Td right><YieldCell v={y.y10} /></Td>
                    <Td right><YieldCell v={y.y30} /></Td>
                    <Td right><BpsChange bps={y.slope * 100} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: y.inverted ? ORANGE : GREEN }}>{y.inverted ? 'INVERTED' : 'NORMAL'}</span></Td>
                    <Td mono col={SUBTLE}>{y.asOf}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'spreads' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Leg A</Th><Th>Leg B</Th><Th>Category</Th><Th right>Spread bps</Th><Th right>Chg bps</Th><Th right>52W Low</Th><Th right>52W High</Th><Th>As of</Th></tr></thead>
              <tbody>
                {spreads.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No spread data</td></tr>}
                {spreads.sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps)).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td mono col={BLUE}>{s.legA}</Td>
                    <Td mono col={PURPLE}>{s.legB}</Td>
                    <Td><CatBadge c={s.category} /></Td>
                    <Td right mono col={s.spreadBps > 200 ? RED : s.spreadBps > 100 ? ORANGE : TEXT}>{s.spreadBps.toFixed(1)}</Td>
                    <Td right><BpsChange bps={s.changeBps} /></Td>
                    <Td right mono col={SUBTLE}>{s.min52w.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{s.max52w.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{s.asOf}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'central-banks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Bank</Th><Th>Country</Th><Th>CCY</Th><Th right>Current Rate</Th><Th right>Prev Rate</Th><Th right>Expected Î” bp</Th><Th right>Market Implied</Th><Th>Bias</Th><Th>Next Meeting</Th><Th>Last Action</Th></tr></thead>
              <tbody>
                {centralBanks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No central bank data</td></tr>}
                {centralBanks.map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.name}</Td>
                    <Td mono col={BLUE}>{c.country}</Td>
                    <Td mono col={PURPLE}>{c.currency}</Td>
                    <Td right mono col={TEXT}>{c.currentRate.toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{c.prevRate.toFixed(2)}%</Td>
                    <Td right><BpsChange bps={c.expectedChange} /></Td>
                    <Td right mono col={TEXT}>{c.marketImplied.toFixed(2)}%</Td>
                    <Td><HikeCut v={c.hike_cut} /></Td>
                    <Td mono col={SUBTLE}>{c.nextMeeting || '—'}</Td>
                    <Td mono col={SUBTLE}>{c.lastAction || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'bonds' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Issuer</Th><Th>ISIN</Th><Th>Maturity</Th><Th right>Coupon %</Th><Th right>Yield %</Th><Th right>Duration</Th><Th right>Bid</Th><Th right>Ask</Th><Th right>Spread vs Swap</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {bonds.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No bond data</td></tr>}
                {bonds.sort((a, b) => a.yieldPct - b.yieldPct).map((b, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{b.issuer}</Td>
                    <Td mono col={SUBTLE}>{b.isin}</Td>
                    <Td mono col={BLUE}>{b.maturity}</Td>
                    <Td right mono col={SUBTLE}>{b.couponPct.toFixed(3)}%</Td>
                    <Td right mono col={b.yieldPct > b.couponPct ? RED : GREEN}>{b.yieldPct.toFixed(3)}%</Td>
                    <Td right mono col={TEXT}>{b.durationYears.toFixed(2)}y</Td>
                    <Td right mono col={GREEN}>{b.bidPx.toFixed(4)}</Td>
                    <Td right mono col={RED}>{b.askPx.toFixed(4)}</Td>
                    <Td right mono col={b.spreadVsSwapBps > 100 ? ORANGE : TEXT}>{b.spreadVsSwapBps.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{b.lastUpdated}</Td>
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
                    <Td mono col={SUBTLE}>{a.detail}</Td>
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
