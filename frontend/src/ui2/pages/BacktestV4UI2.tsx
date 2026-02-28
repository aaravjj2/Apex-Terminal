import React, { useState, useCallback, useRef } from 'react'
﻿// BacktestV4UI2 â€” Bloomberg BKTST-grade backtesting terminal v4
// Tabs: RUN CONFIG | PERFORMANCE | TRADES | RISK | OPTIMIZATION
// APIs: /api/v4/backtest-v4/run, /api/v4/backtest-v4/results,
//       /api/v4/backtest-v4/trades, /api/v4/backtest-v4/risk,
//       /api/v4/backtest-v4/optimize

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

interface BacktestConfig {
  symbols: string
  startDate: string
  endDate: string
  capital: number
  costModel: 'zero' | 'realistic' | 'pessimistic'
  strategy: string
  slippage: number
  commission: number
  positionSizing: 'fixed' | 'kelly' | 'equal_weight' | 'vol_target'
  maxPositionPct: number
  riskTarget: number
}

interface BacktestResult {
  runId: string
  status: 'running' | 'completed' | 'failed'
  startDate: string
  endDate: string
  symbols: string[]
  totalReturn: number
  annualizedReturn: number
  sharpe: number
  sortino: number
  calmar: number
  maxDrawdown: number
  maxDrawdownDuration: number
  volatility: number
  beta: number
  alpha: number
  ir: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  totalTrades: number
  avgHoldDays: number
  equityCurve: { date: string; equity: number; benchmark: number }[]
  drawdownSeries: { date: string; drawdown: number }[]
}

interface BacktestTrade {
  tradeId: string
  symbol: string
  side: 'long' | 'short'
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  quantity: number
  grossPnl: number
  netPnl: number
  holdDays: number
  returnPct: number
  commission: number
  slippage: number
  exitReason: string
  maxFavorable: number
  maxAdverse: number
}

interface BacktestRisk {
  var95: number
  var99: number
  cvar95: number
  cvar99: number
  tailRatio: number
  skewness: number
  kurtosis: number
  downCaptureRatio: number
  upCaptureRatio: number
  recoveryFactor: number
  ulcerIndex: number
  painIndex: number
  monthlyReturns: { month: string; return_: number }[]
}

interface OptimResult {
  paramName: string
  paramValue: number
  sharpe: number
  totalReturn: number
  maxDrawdown: number
  winRate: number
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function MiniEquityCurve({ data }: { data: BacktestResult['equityCurve'] }) {
  if (!data || data.length < 2) return <div style={{ color: SUBTLE, fontSize: 10 }}>No data</div>
  const W = 400, H = 80
  const equities = data.map(d => d.equity)
  const benchmarks = data.map(d => d.benchmark)
  const allVals = [...equities, ...benchmarks]
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const r = maxV - minV || 1
  const toX = (i: number) => (i / (data.length - 1)) * W
  const toY = (v: number) => H - ((v - minV) / r) * H
  const eq = equities.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
  const bm = benchmarks.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }}>
      <path d={bm} fill="none" stroke={SUBTLE} strokeWidth="1.5" strokeDasharray="4,2" />
      <path d={eq} fill="none" stroke={GREEN} strokeWidth="2" />
    </svg>
  )
}

function fmtPct(v: number, d = 1) { return (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%' }
function fmtNum(v: number, d = 2) { return v.toFixed(d) }


export function BacktestV4UI2() {
  const [tab, setTab] = useState<'config' | 'perf' | 'trades' | 'risk' | 'optim'>('config')
  const [config, setConfig] = useState<BacktestConfig>({
    symbols: 'AAPL,MSFT,NVDA',
    startDate: '2022-01-01',
    endDate: '2024-01-01',
    capital: 100000,
    costModel: 'realistic',
    strategy: 'momentum',
    slippage: 5,
    commission: 1,
    positionSizing: 'equal_weight',
    maxPositionPct: 10,
    riskTarget: 15,
  })
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [trades, setTrades] = useState<BacktestTrade[]>([])
  const [risk, setRisk] = useState<BacktestRisk | null>(null)
  const [optimResults, setOptimResults] = useState<OptimResult[]>([])
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [optimParam, setOptimParam] = useState('lookback')
  const [tradeFilter, setTradeFilter] = useState<'all' | 'long' | 'short' | 'winners' | 'losers'>('all')
  const abortRef = useRef<AbortController | null>(null)

  const runBacktest = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setRunning(true)
    setErr(null)
    try {
      const r = await fetch('/api/v4/backtest-v4/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: config.symbols.split(',').map(s => s.trim().toUpperCase()),
          start_date: config.startDate, end_date: config.endDate,
          capital: config.capital, cost_model: config.costModel,
          strategy: config.strategy, slippage_bps: config.slippage,
          commission_per_trade: config.commission,
          position_sizing: config.positionSizing,
          max_position_pct: config.maxPositionPct / 100,
          risk_target: config.riskTarget / 100,
        }),
        signal: abortRef.current.signal,
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const runId = d.run_id ?? d.id ?? ''
      // poll results
      let res: any = null
      for (let i = 0; i < 60; i++) {
        await new Promise(ok => setTimeout(ok, 1000))
        const rr = await fetch(`/api/v4/backtest-v4/results/${runId}`)
        if (!rr.ok) continue
        const rd = await rr.json()
        if (rd.status === 'completed' || rd.status !== 'running') { res = rd; break }
      }
      if (!res) throw new Error('Backtest timeout after 60s')
      const eq: any[] = Array.isArray(res.equity_curve) ? res.equity_curve : []
      const dd: any[] = Array.isArray(res.drawdown_series) ? res.drawdown_series : []
      setResult({
        runId, status: 'completed',
        startDate: res.start_date ?? '', endDate: res.end_date ?? '',
        symbols: Array.isArray(res.symbols) ? res.symbols : [],
        totalReturn: Number(res.total_return ?? 0),
        annualizedReturn: Number(res.annualized_return ?? 0),
        sharpe: Number(res.sharpe ?? 0),
        sortino: Number(res.sortino ?? 0),
        calmar: Number(res.calmar ?? 0),
        maxDrawdown: Number(res.max_drawdown ?? 0),
        maxDrawdownDuration: Number(res.max_drawdown_duration ?? 0),
        volatility: Number(res.volatility ?? 0),
        beta: Number(res.beta ?? 0),
        alpha: Number(res.alpha ?? 0),
        ir: Number(res.information_ratio ?? res.ir ?? 0),
        winRate: Number(res.win_rate ?? 0),
        avgWin: Number(res.avg_win ?? 0),
        avgLoss: Number(res.avg_loss ?? 0),
        profitFactor: Number(res.profit_factor ?? 0),
        totalTrades: Number(res.total_trades ?? 0),
        avgHoldDays: Number(res.avg_hold_days ?? 0),
        equityCurve: eq.map((x: any) => ({ date: x.date ?? '', equity: Number(x.equity ?? x.value ?? 0), benchmark: Number(x.benchmark ?? x.bm ?? 0) })),
        drawdownSeries: dd.map((x: any) => ({ date: x.date ?? '', drawdown: Number(x.drawdown ?? x.dd ?? 0) })),
      })
      // fetch trades and risk
      const [rT, rK] = await Promise.all([
        fetch(`/api/v4/backtest-v4/trades/${runId}`).then(rr => rr.ok ? rr.json() : null),
        fetch(`/api/v4/backtest-v4/risk/${runId}`).then(rr => rr.ok ? rr.json() : null),
      ])
      if (rT) {
        const tRaw: any[] = Array.isArray(rT) ? rT : rT.trades ?? []
        setTrades(tRaw.map((t: any) => ({
          tradeId: t.trade_id ?? String(Math.random()),
          symbol: t.symbol ?? '', side: (t.side ?? 'long') as BacktestTrade['side'],
          entryDate: t.entry_date ?? '', exitDate: t.exit_date ?? '',
          entryPrice: Number(t.entry_price ?? 0), exitPrice: Number(t.exit_price ?? 0),
          quantity: Number(t.quantity ?? 0), grossPnl: Number(t.gross_pnl ?? 0),
          netPnl: Number(t.net_pnl ?? t.pnl ?? 0), holdDays: Number(t.hold_days ?? 0),
          returnPct: Number(t.return_pct ?? t.return ?? 0), commission: Number(t.commission ?? 0),
          slippage: Number(t.slippage ?? 0), exitReason: t.exit_reason ?? '',
          maxFavorable: Number(t.max_favorable_excursion ?? t.mfe ?? 0),
          maxAdverse: Number(t.max_adverse_excursion ?? t.mae ?? 0),
        })))
      }
      if (rK) {
        const k = rK
        const mr: any[] = Array.isArray(k.monthly_returns) ? k.monthly_returns : []
        setRisk({
          var95: Number(k.var_95 ?? 0), var99: Number(k.var_99 ?? 0),
          cvar95: Number(k.cvar_95 ?? 0), cvar99: Number(k.cvar_99 ?? 0),
          tailRatio: Number(k.tail_ratio ?? 0), skewness: Number(k.skewness ?? 0),
          kurtosis: Number(k.kurtosis ?? 0), downCaptureRatio: Number(k.down_capture_ratio ?? 0),
          upCaptureRatio: Number(k.up_capture_ratio ?? 0), recoveryFactor: Number(k.recovery_factor ?? 0),
          ulcerIndex: Number(k.ulcer_index ?? 0), painIndex: Number(k.pain_index ?? 0),
          monthlyReturns: mr.map((x: any) => ({ month: x.month ?? '', return_: Number(x.return ?? x.return_ ?? 0) })),
        })
      }
      setTab('perf')
    } catch (e: any) { if (e.name !== 'AbortError') setErr(e.message) }
    finally { setRunning(false) }
  }, [config])

  const runOptim = useCallback(async () => {
    setRunning(true)
    setErr(null)
    try {
      const r = await fetch('/api/v4/backtest-v4/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ param: optimParam, symbols: config.symbols.split(',').map(s => s.trim().toUpperCase()), start_date: config.startDate, end_date: config.endDate, capital: config.capital }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const raw: any[] = Array.isArray(d) ? d : d.results ?? []
      setOptimResults(raw.map((x: any) => ({
        paramName: x.param_name ?? optimParam, paramValue: Number(x.param_value ?? 0),
        sharpe: Number(x.sharpe ?? 0), totalReturn: Number(x.total_return ?? 0),
        maxDrawdown: Number(x.max_drawdown ?? 0), winRate: Number(x.win_rate ?? 0),
      })))
    } catch (e: any) { setErr(e.message) }
    finally { setRunning(false) }
  }, [config, optimParam])

  const filtTrades = trades.filter(t => {
    if (tradeFilter === 'long') return t.side === 'long'
    if (tradeFilter === 'short') return t.side === 'short'
    if (tradeFilter === 'winners') return t.netPnl > 0
    if (tradeFilter === 'losers') return t.netPnl < 0
    return true
  })

  const TABS = [
    { id: 'config' as const, label: 'RUN CONFIG' },
    { id: 'perf' as const, label: 'PERFORMANCE' },
    { id: 'trades' as const, label: `TRADES (${trades.length})` },
    { id: 'risk' as const, label: 'RISK' },
    { id: 'optim' as const, label: 'OPTIMIZATION' },
  ]

  const COST_MODELS = ['zero', 'realistic', 'pessimistic']
  const STRATEGIES = ['momentum', 'mean_reversion', 'trend_following', 'value', 'quality', 'ml_signal', 'pairs', 'stat_arb']
  const POS_SIZING = ['equal_weight', 'kelly', 'fixed', 'vol_target']

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>BKTST</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>BACKTEST ENGINE V4 â€” MULTI-STRATEGY SIMULATION</span>
        {result && <span style={{ fontSize: 10, color: result.totalReturn >= 0 ? GREEN : RED }}>LAST: {fmtPct(result.totalReturn)} Â· SR={result.sharpe.toFixed(2)} Â· MDD={fmtPct(result.maxDrawdown)}</span>}
        {running && <span style={{ fontSize: 10, color: AMBER }}>âŸ³ RUNNING...</span>}
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

        {/* â”€â”€ CONFIG â”€â”€ */}
        {tab === 'config' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 2 }}>UNIVERSE & TIME</div>
              {([
                ['SYMBOLS (comma-sep)', 'symbols', 'text'],
                ['START DATE', 'startDate', 'date'],
                ['END DATE', 'endDate', 'date'],
              ] as const).map(([label, key, type]) => (
                <div key={key}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 3 }}>{label}</div>
                  <input type={type} value={config[key as keyof BacktestConfig] as string}
                    onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                    style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 3 }}>INITIAL CAPITAL ($)</div>
                <input type="number" value={config.capital}
                  onChange={e => setConfig(c => ({ ...c, capital: Number(e.target.value) }))}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 2 }}>EXECUTION & STRATEGY</div>
              {([
                ['COST MODEL', 'costModel', COST_MODELS],
                ['STRATEGY', 'strategy', STRATEGIES],
                ['POSITION SIZING', 'positionSizing', POS_SIZING],
              ] as const).map(([label, key, opts]) => (
                <div key={key}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 3 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(opts as readonly string[]).map(o => (
                      <button key={o} onClick={() => setConfig(c => ({ ...c, [key]: o }))}
                        style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase',
                          color: config[key as keyof BacktestConfig] === o ? '#000' : SUBTLE,
                          background: config[key as keyof BacktestConfig] === o ? AMBER : 'transparent',
                          border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
                        {o.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {([
                ['SLIPPAGE (bps)', 'slippage'], ['COMMISSION ($)', 'commission'],
                ['MAX POSITION (%)', 'maxPositionPct'], ['RISK TARGET (%)', 'riskTarget'],
              ] as const).map(([label, key]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, minWidth: 150 }}>{label}</div>
                  <input type="number" value={config[key] as number}
                    onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                    style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', width: 80, outline: 'none' }} />
                </div>
              ))}
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <button onClick={runBacktest} disabled={running}
                style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#000', background: running ? SUBTLE : AMBER,
                  border: 'none', borderRadius: 4, padding: '10px 24px', cursor: running ? 'default' : 'pointer', marginRight: 10 }}>
                {running ? 'RUNNING...' : 'â–¶ RUN BACKTEST'}
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ PERFORMANCE â”€â”€ */}
        {tab === 'perf' && (
          <>
            {!result ? <div style={{ color: SUBTLE, fontSize: 11 }}>Run a backtest first</div> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
                  <StatCard label="Total Return" value={fmtPct(result.totalReturn)} col={result.totalReturn >= 0 ? GREEN : RED} />
                  <StatCard label="Ann. Return" value={fmtPct(result.annualizedReturn)} col={result.annualizedReturn >= 0 ? GREEN : RED} />
                  <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} col={result.sharpe > 1 ? GREEN : result.sharpe > 0 ? AMBER : RED} />
                  <StatCard label="Sortino" value={result.sortino.toFixed(2)} col={result.sortino > 1 ? GREEN : AMBER} />
                  <StatCard label="Max Drawdown" value={fmtPct(result.maxDrawdown)} col={RED} sub={`${result.maxDrawdownDuration}d duration`} />
                  <StatCard label="Calmar" value={result.calmar.toFixed(2)} col={result.calmar > 3 ? GREEN : AMBER} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="Win Rate" value={(result.winRate * 100).toFixed(1) + '%'} col={result.winRate > 0.5 ? GREEN : RED} />
                  <StatCard label="Profit Factor" value={result.profitFactor.toFixed(2)} col={result.profitFactor > 1.5 ? GREEN : RED} />
                  <StatCard label="Volatility" value={fmtPct(result.volatility)} col={SUBTLE} />
                  <StatCard label="Beta" value={result.beta.toFixed(2)} col={SUBTLE} />
                  <StatCard label="Alpha" value={fmtPct(result.alpha)} col={result.alpha > 0 ? GREEN : RED} />
                  <StatCard label="Total Trades" value={result.totalTrades} sub={`avg ${result.avgHoldDays.toFixed(0)} days hold`} />
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>EQUITY CURVE (green) vs BENCHMARK (dashed)</div>
                  <MiniEquityCurve data={result.equityCurve} />
                </div>
              </>
            )}
          </>
        )}

        {/* â”€â”€ TRADES â”€â”€ */}
        {tab === 'trades' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['all', 'long', 'short', 'winners', 'losers'] as const).map(f => (
                <button key={f} onClick={() => setTradeFilter(f)}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: tradeFilter === f ? '#000' : TEXT, background: tradeFilter === f ? AMBER : 'transparent',
                    border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Side</Th><Th>Entry</Th><Th>Exit</Th>
                    <Th right>Qty</Th><Th right>Return</Th><Th right>Net P&L</Th>
                    <Th right>Hold</Th><Th right>MFE</Th><Th right>MAE</Th><Th>Exit Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtTrades.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      No trades â€” run backtest first
                    </td></tr>
                  )}
                  {filtTrades.map(t => (
                    <tr key={t.tradeId}>
                      <Td mono col={AMBER}>{t.symbol}</Td>
                      <Td mono col={t.side === 'long' ? BLUE : RED}>{t.side.toUpperCase()}</Td>
                      <Td mono col={SUBTLE}>{t.entryDate}</Td>
                      <Td mono col={SUBTLE}>{t.exitDate}</Td>
                      <Td right mono>{t.quantity.toLocaleString()}</Td>
                      <Td right mono col={t.returnPct >= 0 ? GREEN : RED}>{fmtPct(t.returnPct)}</Td>
                      <Td right mono col={t.netPnl >= 0 ? GREEN : RED}>${t.netPnl.toFixed(0)}</Td>
                      <Td right mono col={SUBTLE}>{t.holdDays}d</Td>
                      <Td right mono col={GREEN}>{fmtPct(t.maxFavorable)}</Td>
                      <Td right mono col={RED}>{fmtPct(t.maxAdverse)}</Td>
                      <Td mono col={SUBTLE}>{t.exitReason}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ RISK â”€â”€ */}
        {tab === 'risk' && (
          <>
            {!risk ? <div style={{ color: SUBTLE, fontSize: 11 }}>Run a backtest first to see risk metrics</div> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="VaR 95% (1d)" value={fmtPct(risk.var95)} col={RED} />
                  <StatCard label="CVaR 95% (1d)" value={fmtPct(risk.cvar95)} col={RED} />
                  <StatCard label="VaR 99% (1d)" value={fmtPct(risk.var99)} col={RED} />
                  <StatCard label="CVaR 99% (1d)" value={fmtPct(risk.cvar99)} col={RED} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="Skewness" value={risk.skewness.toFixed(3)} col={risk.skewness < 0 ? RED : GREEN} />
                  <StatCard label="Excess Kurtosis" value={risk.kurtosis.toFixed(3)} col={risk.kurtosis > 3 ? AMBER : SUBTLE} />
                  <StatCard label="Tail Ratio" value={fmtNum(risk.tailRatio)} col={risk.tailRatio > 1 ? GREEN : RED} />
                  <StatCard label="Recovery Factor" value={fmtNum(risk.recoveryFactor)} col={risk.recoveryFactor > 5 ? GREEN : AMBER} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <StatCard label="Up Capture" value={(risk.upCaptureRatio * 100).toFixed(0) + '%'} col={risk.upCaptureRatio > 1 ? GREEN : SUBTLE} />
                  <StatCard label="Down Capture" value={(risk.downCaptureRatio * 100).toFixed(0) + '%'} col={risk.downCaptureRatio < 1 ? GREEN : RED} />
                  <StatCard label="Ulcer Index" value={fmtNum(risk.ulcerIndex)} col={AMBER} />
                  <StatCard label="Pain Index" value={fmtNum(risk.painIndex)} col={AMBER} />
                </div>
                {risk.monthlyReturns.length > 0 && (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>MONTHLY RETURNS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {risk.monthlyReturns.map(m => (
                        <div key={m.month} style={{ padding: '4px 8px', borderRadius: 3, background: (m.return_ >= 0 ? GREEN : RED) + '22', border: `1px solid ${(m.return_ >= 0 ? GREEN : RED)}44`, minWidth: 70 }}>
                          <div style={{ fontSize: 8, color: SUBTLE }}>{m.month}</div>
                          <div style={{ fontSize: 11, fontFamily: MONO, color: m.return_ >= 0 ? GREEN : RED }}>{fmtPct(m.return_)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* â”€â”€ OPTIMIZATION â”€â”€ */}
        {tab === 'optim' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 3 }}>OPTIMIZE PARAMETER</div>
                <input value={optimParam} onChange={e => setOptimParam(e.target.value)}
                  style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', outline: 'none', width: 130 }} />
              </div>
              <button onClick={runOptim} disabled={running}
                style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#000', background: running ? SUBTLE : AMBER, border: 'none', borderRadius: 4, padding: '8px 16px', cursor: running ? 'default' : 'pointer' }}>
                {running ? 'RUNNING...' : 'OPTIMIZE'}
              </button>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Parameter</Th><Th right>Value</Th>
                    <Th right>Sharpe</Th><Th right>Total Return</Th><Th right>Max DD</Th><Th right>Win Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {optimResults.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>Click OPTIMIZE to run parameter sweep via /api/v4/backtest-v4/optimize</td></tr>
                  )}
                  {[...optimResults].sort((a, b) => b.sharpe - a.sharpe).map((o, i) => (
                    <tr key={i} style={{ background: i === 0 ? '#0d1500' : 'transparent' }}>
                      <Td mono col={i === 0 ? GREEN : SUBTLE}>{o.paramName}</Td>
                      <Td right mono col={AMBER}>{o.paramValue}</Td>
                      <Td right mono col={o.sharpe > 1 ? GREEN : o.sharpe > 0 ? AMBER : RED}>{o.sharpe.toFixed(2)}</Td>
                      <Td right mono col={o.totalReturn >= 0 ? GREEN : RED}>{fmtPct(o.totalReturn)}</Td>
                      <Td right mono col={RED}>{fmtPct(o.maxDrawdown)}</Td>
                      <Td right mono col={o.winRate > 0.5 ? GREEN : RED}>{(o.winRate * 100).toFixed(1)}%</Td>
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
