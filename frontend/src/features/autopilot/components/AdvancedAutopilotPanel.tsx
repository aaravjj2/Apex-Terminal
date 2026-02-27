const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect } from 'react';
import { useAutopilotStore } from '../store';

interface AIDecision {
  id: string; timestamp: string;
  action: 'open_long' | 'open_short' | 'close' | 'hold' | 'skip';
  symbol: string; reasoning: string[]; confidence: number;
  signals: Signal[]; risk_assessment: string; expected_return: number; max_loss: number;
}
interface Signal { name: string; value: number; direction: 'bullish' | 'bearish' | 'neutral'; weight: number; }
interface CycleMetrics { cycle_number: number; candidates_scanned: number; candidates_passed: number; trades_executed: number; cycle_pnl: number; duration_ms: number; timestamp: string; }
interface StrategyStats { strategy_name: string; total_trades: number; win_rate: number; avg_return: number; total_pnl: number; sharpe_ratio: number; max_drawdown: number; }

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = confidence * 100;
  const color = confidence >= 0.8 ? GREEN : confidence >= 0.6 ? AMBER : RED;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const col = signal.direction === 'bullish' ? GREEN : signal.direction === 'bearish' ? RED : SUBTLE;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: BG, borderRadius: 2, marginBottom: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block' }} />
        <span style={{ fontSize: 10, color: TEXT }}>{signal.name}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 10, color: col, fontFamily: MONO }}>{signal.value.toFixed(2)}</span>
        <span style={{ fontSize: 9, color: SUBTLE }}>({(signal.weight * 100).toFixed(0)}%)</span>
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: AIDecision }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor: Record<string, string> = { open_long: GREEN, open_short: RED, close: AMBER, hold: SUBTLE, skip: SUBTLE };
  const actionIcon: Record<string, string> = { open_long: ' LONG', open_short: ' SHORT', close: ' CLOSE', hold: ' HOLD', skip: ' SKIP' };
  const ac = actionColor[decision.action];
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
      <button onClick={() => setExpanded(v => !v)} style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 9, padding: '2px 7px', background: ac + '22', color: ac, border: `1px solid ${ac}44`, borderRadius: 2, fontWeight: 700 }}>{actionIcon[decision.action]}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{decision.symbol}</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>{new Date(decision.timestamp).toLocaleTimeString()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ConfidenceBar confidence={decision.confidence} />
          <span style={{ color: SUBTLE, fontSize: 11 }}>{expanded ? '' : ''}</span>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 6 }}>AI REASONING</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginBottom: 10 }}>
            {decision.reasoning.map((r, i) => <li key={i} style={{ fontSize: 11, color: TEXT, padding: '2px 0', display: 'flex', gap: 6 }}><span style={{ color: BLUE }}></span>{r}</li>)}
          </ul>
          <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 6 }}>SIGNAL ANALYSIS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
            {decision.signals.map((s, i) => <SignalRow key={i} signal={s} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '8px 0', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
            {[
              { label: 'Expected Return', value: fmtPct(decision.expected_return), color: decision.expected_return >= 0 ? GREEN : RED },
              { label: 'Max Loss', value: fmtPct(decision.max_loss), color: RED },
              { label: 'Risk/Reward', value: `${Math.abs(decision.expected_return / (decision.max_loss || 0.01)).toFixed(1)}:1`, color: TEXT },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
                <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.06em', marginTop: 2 }}>{m.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, padding: '6px 8px', background: BG, borderRadius: 2, fontSize: 10, color: SUBTLE }}> {decision.risk_assessment}</div>
        </div>
      )}
    </div>
  );
}

function CycleTimeline({ cycles }: { cycles: CycleMetrics[] }) {
  return (
    <div>
      {cycles.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: BLUE + '22', border: `1px solid ${BLUE}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: BLUE, fontWeight: 700, flexShrink: 0 }}>{c.cycle_number}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: TEXT }}>Cycle #{c.cycle_number}</span>
              <span style={{ color: SUBTLE, fontSize: 10 }}>{new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: SUBTLE }}>
              <span>Scan: {c.candidates_scanned}</span>
              <span>Pass: {c.candidates_passed}</span>
              <span>Exec: {c.trades_executed}</span>
              <span style={{ color: c.cycle_pnl >= 0 ? GREEN : RED }}>P&L: {fmt$(c.cycle_pnl)}</span>
            </div>
          </div>
          <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{c.duration_ms}ms</span>
        </div>
      ))}
    </div>
  );
}

function StrategyCard({ stats }: { stats: StrategyStats }) {
  const win = stats.win_rate >= 0.5;
  return (
    <div style={{ padding: '10px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{stats.strategy_name}</span>
        <span style={{ fontSize: 9, color: win ? GREEN : AMBER, background: (win ? GREEN : AMBER) + '22', border: `1px solid ${(win ? GREEN : AMBER)}44`, borderRadius: 2, padding: '1px 6px' }}>{(stats.win_rate * 100).toFixed(0)}% WR</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, textAlign: 'center' }}>
        {[
          { label: 'Total P&L', value: fmt$(stats.total_pnl), color: stats.total_pnl >= 0 ? GREEN : RED },
          { label: 'Trades', value: stats.total_trades.toString(), color: TEXT },
          { label: 'Sharpe', value: stats.sharpe_ratio.toFixed(2), color: TEXT },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.06em', marginTop: 2 }}>{m.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdvancedAutopilotPanel() {
  const { config, status, portfolio, runs, isLoading, fetchConfig, fetchStatus, triggerRun, activateKillSwitch, pause, resume } = useAutopilotStore();

  const decisions: AIDecision[] = [];
  const cycles: CycleMetrics[] = runs.slice(0, 10).map((r: any, idx: number) => ({
    cycle_number: runs.length - idx,
    candidates_scanned: r.candidates?.generated ?? 0,
    candidates_passed: r.selection?.selected ?? 0,
    trades_executed: r.execution?.filled ?? 0,
    cycle_pnl: 0,
    duration_ms: r.duration_ms ?? 0,
    timestamp: r.started_at,
  }));
  const strategies: StrategyStats[] = status ? [{
    strategy_name: 'All Strategies',
    total_trades: status.broker_metrics?.total_orders ?? 0,
    win_rate: status.win_rate ?? 0,
    avg_return: status.avg_win ?? 0,
    total_pnl: status.portfolio?.total_pnl ?? 0,
    sharpe_ratio: status.sharpe_ratio ?? 0,
    max_drawdown: 0,
  }] : [];

  useEffect(() => { fetchConfig(); fetchStatus(); }, [fetchConfig, fetchStatus]);

  const pnl = portfolio?.total_pnl ?? 0;
  const equity = (config?.paper_equity ?? 1000) + pnl;
  const stateColor = status?.kill_switch ? RED : status?.state === 'running' ? GREEN : status?.state === 'paused' ? AMBER : SUBTLE;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: MONO }}>
      {/* Header */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}> AUTOPILOT AI</span>
          <span style={{ fontSize: 9, padding: '2px 8px', background: stateColor + '22', color: stateColor, border: `1px solid ${stateColor}44`, borderRadius: 2, fontWeight: 700 }}>
            {status?.kill_switch ? 'KILL SWITCH' : status?.state?.toUpperCase() || 'IDLE'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            <span style={{ fontSize: 10, color: SUBTLE }}>Equity:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{fmt$(equity)}</span>
            <span style={{ fontSize: 10, color: pnl >= 0 ? GREEN : RED, fontFamily: MONO }}>({pnl >= 0 ? '+' : ''}{fmt$(pnl)})</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => status?.state === 'paused' ? resume() : pause()} disabled={!!status?.kill_switch}
            style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, background: status?.state === 'paused' ? GREEN : AMBER, color: '#000', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: MONO, opacity: status?.kill_switch ? 0.5 : 1 }}>
            {status?.state === 'paused' ? ' RESUME' : ' PAUSE'}
          </button>
          <button onClick={() => triggerRun(true)} disabled={isLoading || !!status?.kill_switch}
            style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, background: BLUE, color: '#000', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: MONO, opacity: isLoading || status?.kill_switch ? 0.5 : 1 }}>
             RUN CYCLE
          </button>
          <button onClick={() => activateKillSwitch(true)}
            style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, background: RED, color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
             KILL SWITCH
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left  AI Decisions */}
        <div style={{ flex: 2, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> AI DECISIONS</span>
            <span style={{ fontSize: 9, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 2, padding: '1px 6px' }}>{decisions.length} RECENT</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {decisions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: SUBTLE, fontSize: 11 }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}></div>
                No decisions yet  arm autopilot to see AI reasoning
              </div>
            ) : decisions.map(d => <DecisionCard key={d.id} decision={d} />)}
          </div>
        </div>

        {/* Right  Metrics */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Cycle Timeline */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> RECENT CYCLES</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240 }}>
              {cycles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: SUBTLE, fontSize: 11 }}>No cycle history</div>
              ) : <CycleTimeline cycles={cycles} />}
            </div>
          </div>

          {/* Strategy Performance */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> STRATEGY PERFORMANCE</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {strategies.map((s, i) => <StrategyCard key={i} stats={s} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedAutopilotPanel;