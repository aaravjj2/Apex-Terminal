import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// BqlQueryUI2 â€” Bloomberg BQL-grade query terminal
// Live market data queries, custom formula engine, saved queries, results grid
// Tabs: QUERY EDITOR | RESULTS | SAVED QUERIES | FORMULA GUIDE | HISTORY
// APIs: /api/v4/bql/execute, /results, /saved, /formulas, /history

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

interface BqlResult {
  id: string
  field: string
  symbol: string
  value: string | number
  type: string
  timestamp: string
}

interface SavedQuery {
  id: string
  name: string
  query: string
  description: string
  lastRun: string
  resultCount: number
  category: string
}

interface FormulaEntry {
  name: string
  syntax: string
  description: string
  category: string
  example: string
  returnType: string
}

interface QueryHistoryEntry {
  id: string
  query: string
  executedAt: string
  durationMs: number
  rowCount: number
  status: 'success' | 'error' | 'timeout'
  errorMsg?: string
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

function CatBadge({ cat }: { cat: string }) {
  const m: Record<string, string> = { price: GREEN, fundamental: BLUE, derived: PURPLE, macro: AMBER, risk: RED, reference: ORANGE }
  const c = m[cat.toLowerCase()] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{cat.toUpperCase()}</span>
}

function RunStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { success: GREEN, error: RED, timeout: ORANGE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}


export function BqlQueryUI2() {
  const [tab, setTab] = useState<'editor' | 'results' | 'saved' | 'formulas' | 'history'>('editor')
  const [query, setQuery] = useState<string>(`GET PRICE, VOLUME, PE_RATIO, EV_TO_EBITDA\nFOR SECURITIES(['AAPL US Equity','MSFT US Equity','GOOGL US Equity'])\nWHERE VOLUME > 1000000`)
  const [results, setResults] = useState<BqlResult[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [formulas, setFormulas] = useState<FormulaEntry[]>([])
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [lastRunMs, setLastRunMs] = useState<number | null>(null)
  const [formulaSearch, setFormulaSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const loadSupportData = useCallback(async () => {
    try {
      const [rS, rF, rH] = await Promise.allSettled([
        fetch('/api/v4/bql/saved').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/bql/formulas').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/bql/history').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.queries ?? rS.value.data ?? []
        setSavedQueries(raw.map((q: any) => ({
          id: q.id ?? '', name: q.name ?? '', query: q.query ?? '', description: q.description ?? '',
          lastRun: q.last_run ?? q.lastRun ?? '', resultCount: Number(q.result_count ?? q.resultCount ?? 0),
          category: q.category ?? 'price',
        })))
      }
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.formulas ?? rF.value.data ?? []
        setFormulas(raw.map((f: any) => ({
          name: f.name ?? '', syntax: f.syntax ?? '', description: f.description ?? '',
          category: f.category ?? 'price', example: f.example ?? '', returnType: f.return_type ?? f.returnType ?? '',
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw = Array.isArray(rH.value) ? rH.value : rH.value.history ?? rH.value.data ?? []
        setHistory(raw.map((h: any) => ({
          id: h.id ?? '', query: h.query ?? '', executedAt: h.executed_at ?? h.executedAt ?? '',
          durationMs: Number(h.duration_ms ?? h.durationMs ?? 0), rowCount: Number(h.row_count ?? h.rowCount ?? 0),
          status: h.status ?? 'success', errorMsg: h.error_msg ?? h.errorMsg,
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSupportData() }, [loadSupportData])

  const executeQuery = async () => {
    if (!query.trim()) return
    setRunning(true)
    setErr(null)
    const t0 = Date.now()
    try {
      const r = await fetch('/api/v4/bql/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
      const data = await r.json()
      const ms = Date.now() - t0
      setLastRunMs(ms)
      if (!r.ok) { setErr(data.detail ?? data.message ?? 'Query error'); return }
      const raw = Array.isArray(data) ? data : data.results ?? data.data ?? []
      setResults(raw.map((row: any) => ({
        id: row.id ?? Math.random().toString(), field: row.field ?? '', symbol: row.symbol ?? '',
        value: row.value ?? '', type: row.type ?? 'string', timestamp: row.timestamp ?? '',
      })))
      setTab('results')
      setHistory(h => [{ id: Math.random().toString(), query, executedAt: new Date().toISOString(), durationMs: ms, rowCount: raw.length, status: 'success' }, ...h.slice(0, 49)])
    } catch (e: any) { setErr(e.message) }
    finally { setRunning(false) }
  }

  const filteredFormulas = formulas.filter(f =>
    (catFilter === 'all' || f.category.toLowerCase() === catFilter) &&
    (!formulaSearch || f.name.toLowerCase().includes(formulaSearch.toLowerCase()) || f.description.toLowerCase().includes(formulaSearch.toLowerCase()))
  )

  const categories = ['all', ...Array.from(new Set(formulas.map(f => f.category.toLowerCase()))).sort()]

  const TABS = [
    { id: 'editor' as const, label: 'QUERY EDITOR' },
    { id: 'results' as const, label: `RESULTS${results.length ? ' (' + results.length + ')' : ''}` },
    { id: 'saved' as const, label: 'SAVED QUERIES' },
    { id: 'formulas' as const, label: 'FORMULA GUIDE' },
    { id: 'history' as const, label: 'HISTORY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>BQL</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>BLOOMBERG QUERY LANGUAGE â€” LIVE DATA RETRIEVAL + FORMULA ENGINE + ANALYTICS</span>
        {lastRunMs && <span style={{ fontSize: 10, color: GREEN }}>âœ“ {lastRunMs}ms Â· {results.length} rows</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Saved Queries" value={savedQueries.length} />
        <StatCard label="Formulas" value={formulas.length} col={PURPLE} />
        <StatCard label="Last Result Rows" value={results.length} col={results.length > 0 ? GREEN : SUBTLE} />
        <StatCard label="Query Runs" value={history.length} col={BLUE} />
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

        {/* EDITOR */}
        {tab === 'editor' && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 10, color: SUBTLE }}>BQL SYNTAX: GET [fields] FOR SECURITIES([...]) WHERE [conditions] SORT BY [field] LIMIT [n]</div>
            <textarea
              ref={textRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); executeQuery() } }}
              style={{ width: '100%', minHeight: 180, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontFamily: MONO, fontSize: 13, padding: 16, resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.8 }}
              placeholder="GET PRICE, VOLUME&#10;FOR SECURITIES(['AAPL US Equity'])&#10;..."
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
              <button onClick={executeQuery} disabled={running}
                style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BG, background: running ? SUBTLE : AMBER, border: 'none', borderRadius: 3, padding: '8px 22px', cursor: running ? 'not-allowed' : 'pointer' }}>
                {running ? 'RUNNING...' : 'â–¶ RUN  (Ctrl+Enter)'}
              </button>
              <button onClick={() => setQuery('')}
                style={{ fontFamily: MONO, fontSize: 11, color: SUBTLE, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '7px 14px', cursor: 'pointer' }}>
                CLEAR
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {tab === 'results' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Field</Th><Th right>Value</Th><Th>Type</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {results.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No results yet â€” write a query and click RUN</td></tr>}
                {results.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.symbol}</Td>
                    <Td mono col={BLUE}>{r.field}</Td>
                    <Td right mono col={typeof r.value === 'number' ? (r.value < 0 ? RED : GREEN) : TEXT}>{String(r.value)}</Td>
                    <Td mono col={SUBTLE}>{r.type}</Td>
                    <Td mono col={SUBTLE}>{r.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SAVED QUERIES */}
        {tab === 'saved' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedQueries.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No saved queries â€” check /api/v4/bql/saved</div>}
            {savedQueries.map((q, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER, fontWeight: 700 }}>{q.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CatBadge cat={q.category} />
                    <span style={{ fontSize: 9, color: SUBTLE }}>{q.resultCount} rows Â· {q.lastRun}</span>
                    <button onClick={() => { setQuery(q.query); setTab('editor') }}
                      style={{ fontFamily: MONO, fontSize: 10, color: GREEN, background: GREEN + '22', border: `1px solid ${GREEN}44`, borderRadius: 3, padding: '3px 10px', cursor: 'pointer' }}>
                      LOAD
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 6 }}>{q.description}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: BG, borderRadius: 3, padding: '6px 10px' }}>{q.query}</div>
              </div>
            ))}
          </div>
        )}

        {/* FORMULA GUIDE */}
        {tab === 'formulas' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={formulaSearch} onChange={e => setFormulaSearch(e.target.value)} placeholder="Search formulas..."
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '5px 10px', width: 200 }} />
              {categories.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ fontFamily: MONO, fontSize: 10, color: catFilter === c ? AMBER : SUBTLE, background: catFilter === c ? AMBER + '22' : 'transparent', border: `1px solid ${catFilter === c ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {c === 'all' ? 'ALL' : c.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Formula</Th><Th>Category</Th><Th>Return Type</Th><Th>Syntax</Th><Th>Description</Th></tr></thead>
                <tbody>
                  {filteredFormulas.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No formulas match â€” check /api/v4/bql/formulas</td></tr>}
                  {filteredFormulas.map((f, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{f.name}</Td>
                      <Td><CatBadge cat={f.category} /></Td>
                      <Td mono col={BLUE}>{f.returnType}</Td>
                      <Td mono col={SUBTLE}>{f.syntax}</Td>
                      <Td><span style={{ fontSize: 10, color: TEXT }}>{f.description}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Status</Th><Th>Query</Th><Th right>Duration</Th><Th right>Rows</Th><Th>Executed At</Th><Th>Action</Th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No history yet â€” run some queries</td></tr>}
                {history.map((h, i) => (
                  <tr key={i}>
                    <Td><RunStatusBadge s={h.status} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 10, color: TEXT, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>{h.query}</span></Td>
                    <Td right mono col={h.durationMs > 5000 ? RED : h.durationMs > 1000 ? AMBER : GREEN}>{h.durationMs}ms</Td>
                    <Td right mono>{h.rowCount}</Td>
                    <Td mono col={SUBTLE}>{h.executedAt}</Td>
                    <Td>
                      <button onClick={() => { setQuery(h.query); setTab('editor') }}
                        style={{ fontFamily: MONO, fontSize: 10, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>RE-RUN</button>
                    </Td>
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
