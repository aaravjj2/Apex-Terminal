import React, { useState, useEffect, useCallback } from 'react'
﻿// HotPathUI2 â€” Bloomberg HPTH hot path profiling terminal
// Flame graph analysis, bottleneck detection, CPU/memory profiles, optimization guides
// Tabs: FLAMEGRAPH | BOTTLENECKS | PROFILES | OPTIMIZATION | HISTORY
// APIs: /api/v4/hot-path/flamegraph, /bottlenecks, /profiles, /optimization, /history

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

interface FlameNode {
  nodeId: string
  funcName: string
  module: string
  selfTimePct: number
  totalTimePct: number
  selfTimeMs: number
  totalTimeMs: number
  calls: number
  avgCallMs: number
  depth: number
  isHot: boolean
  inlined: boolean
}

interface Bottleneck {
  bottleneckId: string
  category: string
  location: string
  funcName: string
  impact: 'critical' | 'high' | 'medium' | 'low'
  cpuPct: number
  memoryMb: number
  callCount: number
  avgLatencyMs: number
  suggestion: string
  estimatedSavingPct: number
}

interface ProfileSnapshot {
  snapshotId: string
  capturedAt: string
  profileType: string
  duration: number
  totalSamples: number
  cpuPctAvg: number
  cpuPctPeak: number
  memUsedMb: number
  gcPauseMs: number
  hotFunctions: number
  trigger: string
  notes: string
}

interface OptimizationGuide {
  guideId: string
  title: string
  category: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  affectedFunctions: string[]
  status: 'open' | 'in-progress' | 'done' | 'wont-fix'
  estimatedSavingPct: number
  effortHours: number
  description: string
  assignedTo: string
}

interface ProfileHistoryEntry {
  runId: string
  capturedAt: string
  profileType: string
  p50CpuPct: number
  p95CpuPct: number
  p50MemMb: number
  hotFunctions: number
  regressions: number
  improvements: number
  triggerTag: string
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
function HeatBar({ pct, max = 100 }: { pct: number; max?: number }) {
  const ratio = Math.min(pct / max, 1)
  const col = ratio > 0.8 ? RED : ratio > 0.5 ? ORANGE : ratio > 0.25 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 80, height: 5, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${ratio * 100}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(1)}%</span>
    </div>
  )
}
function ImpactBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function GuideStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: BLUE, 'in-progress': AMBER, done: GREEN, 'wont-fix': SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function HotPathUI2() {
  const [tab, setTab] = useState<'flamegraph' | 'bottlenecks' | 'profiles' | 'optimization' | 'history'>('flamegraph')
  const [flame, setFlame] = useState<FlameNode[]>([])
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [profiles, setProfiles] = useState<ProfileSnapshot[]>([])
  const [guides, setGuides] = useState<OptimizationGuide[]>([])
  const [history, setHistory] = useState<ProfileHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rF, rB, rP, rG, rH] = await Promise.allSettled([
        fetch('/api/v4/hot-path/flamegraph').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hot-path/bottlenecks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hot-path/profiles').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hot-path/optimization').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/hot-path/history').then(r => r.ok ? r.json() : []),
      ])
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.nodes ?? rF.value.data ?? []
        setFlame(raw.map((n: any) => ({
          nodeId: n.node_id ?? n.nodeId ?? '', funcName: n.func_name ?? n.funcName ?? n.name ?? '',
          module: n.module ?? '', selfTimePct: Number(n.self_time_pct ?? n.selfTimePct ?? 0),
          totalTimePct: Number(n.total_time_pct ?? n.totalTimePct ?? 0),
          selfTimeMs: Number(n.self_time_ms ?? n.selfTimeMs ?? 0),
          totalTimeMs: Number(n.total_time_ms ?? n.totalTimeMs ?? 0),
          calls: Number(n.calls ?? 0), avgCallMs: Number(n.avg_call_ms ?? n.avgCallMs ?? 0),
          depth: Number(n.depth ?? 0), isHot: Boolean(n.is_hot ?? n.isHot ?? false),
          inlined: Boolean(n.inlined ?? false),
        })))
        setErr(null)
      } else setErr('Failed to load flame graph')
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.bottlenecks ?? rB.value.data ?? []
        setBottlenecks(raw.map((b: any) => ({
          bottleneckId: b.bottleneck_id ?? b.bottleneckId ?? '', category: b.category ?? '',
          location: b.location ?? '', funcName: b.func_name ?? b.funcName ?? '',
          impact: b.impact ?? 'medium', cpuPct: Number(b.cpu_pct ?? b.cpuPct ?? 0),
          memoryMb: Number(b.memory_mb ?? b.memoryMb ?? 0), callCount: Number(b.call_count ?? b.callCount ?? 0),
          avgLatencyMs: Number(b.avg_latency_ms ?? b.avgLatencyMs ?? 0),
          suggestion: b.suggestion ?? '', estimatedSavingPct: Number(b.estimated_saving_pct ?? b.estimatedSavingPct ?? 0),
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.profiles ?? rP.value.data ?? []
        setProfiles(raw.map((p: any) => ({
          snapshotId: p.snapshot_id ?? p.snapshotId ?? '', capturedAt: p.captured_at ?? p.capturedAt ?? '',
          profileType: p.profile_type ?? p.profileType ?? '', duration: Number(p.duration ?? 0),
          totalSamples: Number(p.total_samples ?? p.totalSamples ?? 0),
          cpuPctAvg: Number(p.cpu_pct_avg ?? p.cpuPctAvg ?? 0),
          cpuPctPeak: Number(p.cpu_pct_peak ?? p.cpuPctPeak ?? 0),
          memUsedMb: Number(p.mem_used_mb ?? p.memUsedMb ?? 0),
          gcPauseMs: Number(p.gc_pause_ms ?? p.gcPauseMs ?? 0),
          hotFunctions: Number(p.hot_functions ?? p.hotFunctions ?? 0),
          trigger: p.trigger ?? '', notes: p.notes ?? '',
        })))
      }
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.guides ?? rG.value.data ?? []
        setGuides(raw.map((g: any) => ({
          guideId: g.guide_id ?? g.guideId ?? '', title: g.title ?? '', category: g.category ?? '',
          priority: g.priority ?? 'medium', affectedFunctions: Array.isArray(g.affected_functions ?? g.affectedFunctions) ? (g.affected_functions ?? g.affectedFunctions) : [],
          status: g.status ?? 'open', estimatedSavingPct: Number(g.estimated_saving_pct ?? g.estimatedSavingPct ?? 0),
          effortHours: Number(g.effort_hours ?? g.effortHours ?? 0), description: g.description ?? '',
          assignedTo: g.assigned_to ?? g.assignedTo ?? '',
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw = Array.isArray(rH.value) ? rH.value : rH.value.history ?? rH.value.data ?? []
        setHistory(raw.map((h: any) => ({
          runId: h.run_id ?? h.runId ?? '', capturedAt: h.captured_at ?? h.capturedAt ?? '',
          profileType: h.profile_type ?? h.profileType ?? '',
          p50CpuPct: Number(h.p50_cpu_pct ?? h.p50CpuPct ?? 0), p95CpuPct: Number(h.p95_cpu_pct ?? h.p95CpuPct ?? 0),
          p50MemMb: Number(h.p50_mem_mb ?? h.p50MemMb ?? 0),
          hotFunctions: Number(h.hot_functions ?? h.hotFunctions ?? 0),
          regressions: Number(h.regressions ?? 0), improvements: Number(h.improvements ?? 0),
          triggerTag: h.trigger_tag ?? h.triggerTag ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const hotNodes = flame.filter(n => n.isHot).length
  const criticalBottlenecks = bottlenecks.filter(b => b.impact === 'critical').length
  const openGuides = guides.filter(g => g.status === 'open').length
  const totalSavings = guides.filter(g => g.status === 'open').reduce((s, g) => s + g.estimatedSavingPct, 0)

  const TABS2 = [
    { id: 'flamegraph' as const, label: 'FLAMEGRAPH' },
    { id: 'bottlenecks' as const, label: 'BOTTLENECKS' },
    { id: 'profiles' as const, label: 'PROFILES' },
    { id: 'optimization' as const, label: 'OPTIMIZATION' },
    { id: 'history' as const, label: 'HISTORY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>HPTH</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>HOT PATH â€” FLAME GRAPH + BOTTLENECK DETECTION + CPU PROFILES + OPTIMIZATION GUIDES</span>
        {criticalBottlenecks > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {criticalBottlenecks} CRITICAL BOTTLENECKS</span>}
        {hotNodes > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {hotNodes} HOT NODES</span>}
        {openGuides > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {openGuides} OPEN â€” est. {totalSavings.toFixed(0)}% savings</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Flame Nodes" value={flame.length} col={BLUE} />
        <StatCard label="Hot Nodes" value={hotNodes} col={hotNodes > 0 ? RED : SUBTLE} />
        <StatCard label="Bottlenecks" value={bottlenecks.length} col={criticalBottlenecks > 0 ? RED : ORANGE} />
        <StatCard label="Open Guides" value={openGuides} col={openGuides > 0 ? AMBER : GREEN} />
        <StatCard label="Est. Savings" value={`${totalSavings.toFixed(0)}%`} col={GREEN} />
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

        {tab === 'flamegraph' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Function</Th><Th>Module</Th><Th>Self Time %</Th><Th>Total Time %</Th><Th right>Self (ms)</Th><Th right>Total (ms)</Th><Th right>Calls</Th><Th right>Avg (ms)</Th><Th right>Depth</Th><Th>Hot</Th></tr></thead>
              <tbody>
                {flame.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No flame data â€” check /api/v4/hot-path/flamegraph</td></tr>}
                {flame.sort((a, b) => b.selfTimePct - a.selfTimePct).map((n, i) => (
                  <tr key={i} style={{ background: n.isHot ? RED + '08' : 'transparent' }}>
                    <Td mono col={n.isHot ? RED : TEXT}>{n.funcName}</Td>
                    <Td mono col={BLUE}>{n.module}</Td>
                    <Td><HeatBar pct={n.selfTimePct} /></Td>
                    <Td><HeatBar pct={n.totalTimePct} /></Td>
                    <Td right mono col={n.selfTimeMs > 50 ? RED : SUBTLE}>{n.selfTimeMs.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{n.totalTimeMs.toFixed(2)}</Td>
                    <Td right mono col={n.calls > 10000 ? ORANGE : SUBTLE}>{n.calls.toLocaleString()}</Td>
                    <Td right mono col={n.avgCallMs > 10 ? AMBER : SUBTLE}>{n.avgCallMs.toFixed(3)}</Td>
                    <Td right mono col={SUBTLE}>{n.depth}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.isHot ? RED : SUBTLE }}>{n.isHot ? 'ðŸ”¥ HOT' : 'â€”'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'bottlenecks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Category</Th><Th>Location</Th><Th>Function</Th><Th>Impact</Th><Th right>CPU %</Th><Th right>Memory (MB)</Th><Th right>Calls</Th><Th right>Avg Latency</Th><Th right>Est. Saving %</Th><Th>Suggestion</Th></tr></thead>
              <tbody>
                {bottlenecks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No bottlenecks â€” check /api/v4/hot-path/bottlenecks</td></tr>}
                {bottlenecks.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (ord[a.impact] ?? 4) - (ord[b.impact] ?? 4)
                }).map((b, i) => (
                  <tr key={i} style={{ background: b.impact === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={PURPLE}>{b.category}</Td>
                    <Td mono col={BLUE}>{b.location}</Td>
                    <Td mono col={AMBER}>{b.funcName}</Td>
                    <Td><ImpactBadge s={b.impact} /></Td>
                    <Td right mono col={b.cpuPct > 50 ? RED : b.cpuPct > 25 ? AMBER : GREEN}>{b.cpuPct.toFixed(1)}%</Td>
                    <Td right mono col={b.memoryMb > 512 ? RED : SUBTLE}>{b.memoryMb.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{b.callCount.toLocaleString()}</Td>
                    <Td right mono col={b.avgLatencyMs > 100 ? RED : b.avgLatencyMs > 50 ? AMBER : GREEN}>{b.avgLatencyMs.toFixed(1)}ms</Td>
                    <Td right mono col={b.estimatedSavingPct > 20 ? GREEN : AMBER}>{b.estimatedSavingPct.toFixed(0)}%</Td>
                    <Td mono col={SUBTLE}>{b.suggestion}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'profiles' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Snapshot ID</Th><Th>Type</Th><Th>CPU Avg %</Th><Th right>CPU Peak %</Th><Th right>Mem (MB)</Th><Th right>GC Pause (ms)</Th><Th right>Samples</Th><Th right>Hot Fns</Th><Th>Trigger</Th><Th>Captured</Th></tr></thead>
              <tbody>
                {profiles.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No profiles â€” check /api/v4/hot-path/profiles</td></tr>}
                {profiles.map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.snapshotId}</Td>
                    <Td mono col={PURPLE}>{p.profileType}</Td>
                    <Td><HeatBar pct={p.cpuPctAvg} /></Td>
                    <Td right mono col={p.cpuPctPeak > 80 ? RED : p.cpuPctPeak > 50 ? AMBER : GREEN}>{p.cpuPctPeak.toFixed(1)}%</Td>
                    <Td right mono col={p.memUsedMb > 1000 ? RED : SUBTLE}>{p.memUsedMb.toFixed(0)}</Td>
                    <Td right mono col={p.gcPauseMs > 100 ? RED : SUBTLE}>{p.gcPauseMs.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{p.totalSamples.toLocaleString()}</Td>
                    <Td right mono col={p.hotFunctions > 10 ? ORANGE : SUBTLE}>{p.hotFunctions}</Td>
                    <Td mono col={SUBTLE}>{p.trigger}</Td>
                    <Td mono col={SUBTLE}>{p.capturedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'optimization' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Guide</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th right>Est. Saving %</Th><Th right>Effort (hrs)</Th><Th>Assigned</Th><Th>Description</Th></tr></thead>
              <tbody>
                {guides.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No optimization guides â€” check /api/v4/hot-path/optimization</td></tr>}
                {guides.sort((a, b) => {
                  const pOrd: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (pOrd[a.priority] ?? 4) - (pOrd[b.priority] ?? 4)
                }).map((g, i) => (
                  <tr key={i} style={{ background: g.priority === 'critical' && g.status === 'open' ? RED + '0a' : 'transparent', opacity: g.status === 'done' || g.status === 'wont-fix' ? 0.55 : 1 }}>
                    <Td mono col={AMBER}>{g.title}</Td>
                    <Td mono col={BLUE}>{g.category}</Td>
                    <Td><ImpactBadge s={g.priority} /></Td>
                    <Td><GuideStatusBadge s={g.status} /></Td>
                    <Td right mono col={g.estimatedSavingPct > 20 ? GREEN : AMBER}>{g.estimatedSavingPct.toFixed(0)}%</Td>
                    <Td right mono col={g.effortHours > 40 ? ORANGE : SUBTLE}>{g.effortHours}</Td>
                    <Td mono col={SUBTLE}>{g.assignedTo || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{g.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Type</Th><Th right>P50 CPU %</Th><Th right>P95 CPU %</Th><Th right>P50 Mem (MB)</Th><Th right>Hot Fns</Th><Th right>Regressions</Th><Th right>Improvements</Th><Th>Trigger</Th><Th>Captured</Th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No history â€” check /api/v4/hot-path/history</td></tr>}
                {history.map((h, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{h.runId}</Td>
                    <Td mono col={PURPLE}>{h.profileType}</Td>
                    <Td right mono col={h.p50CpuPct > 50 ? AMBER : GREEN}>{h.p50CpuPct.toFixed(1)}%</Td>
                    <Td right mono col={h.p95CpuPct > 80 ? RED : AMBER}>{h.p95CpuPct.toFixed(1)}%</Td>
                    <Td right mono col={h.p50MemMb > 512 ? ORANGE : SUBTLE}>{h.p50MemMb.toFixed(0)}</Td>
                    <Td right mono col={h.hotFunctions > 10 ? ORANGE : SUBTLE}>{h.hotFunctions}</Td>
                    <Td right mono col={h.regressions > 0 ? RED : GREEN}>{h.regressions}</Td>
                    <Td right mono col={h.improvements > 0 ? GREEN : SUBTLE}>{h.improvements}</Td>
                    <Td mono col={SUBTLE}>{h.triggerTag}</Td>
                    <Td mono col={SUBTLE}>{h.capturedAt}</Td>
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
