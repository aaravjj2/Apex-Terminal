const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useCallback, useState } from 'react';
import { useAutopilotStore } from '../store';
import { AutopilotThinkLog } from './AutopilotThinkLog';
import { AutopilotPositions } from './AutopilotPositions';
import { UniverseEditor } from './UniverseEditor';
import { IncidentsPanel } from './IncidentsPanel';
import { RunHistory } from './RunHistory';
import { AutopilotAgents } from './AutopilotAgents';
import { AutopilotProposals } from './AutopilotProposals';

const fmtCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const STATE_COLOR: Record<string, string> = { idle: SUBTLE, running: GREEN, paused: AMBER, error: RED };

function StatCard({ label, value, color, testId }: { label: string; value: React.ReactNode; color?: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: color || TEXT }}>{value}</div>
    </div>
  );
}

function Btn({ onClick, disabled, color = BLUE, children, testId }: { onClick: () => void; disabled?: boolean; color?: string; children: React.ReactNode; testId?: string }) {
  return (
    <button data-testid={testId} onClick={onClick} disabled={disabled}
      style={{ padding: '6px 14px', background: disabled ? BORDER : color, color: disabled ? SUBTLE : '#000', border: 'none', borderRadius: 2, fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

export const AutopilotDashboard: React.FC = () => {
  const { config, status, portfolio, isLoading, error, killSwitchPending, fetchConfig, fetchStatus, fetchPositions, triggerRun, startLoop, stopLoop, activateKillSwitch, deactivateKillSwitch, pause, resume, clearError, connect, disconnect, connectionStatus } = useAutopilotStore();
  const [showUniverse, setShowUniverse] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (isLoading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [isLoading]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    fetchConfig(); fetchStatus(); fetchPositions('open');
    const si = setInterval(() => fetchStatus(), 15000);
    const pi = setInterval(() => fetchPositions('open'), 15000);
    return () => { clearInterval(si); clearInterval(pi); };
  }, [fetchConfig, fetchStatus, fetchPositions]);

  const handleRunCycle = useCallback(async () => { await triggerRun(true); await fetchPositions('open'); }, [triggerRun, fetchPositions]);
  const handleStartStopLoop = useCallback(async () => { status?.state === 'running' ? await stopLoop() : await startLoop(); }, [status, startLoop, stopLoop]);
  const handleKillSwitch = useCallback(async () => { status?.kill_switch ? await deactivateKillSwitch() : await activateKillSwitch(true); }, [status, activateKillSwitch, deactivateKillSwitch]);
  const handlePauseResume = useCallback(async () => { status?.state === 'paused' ? await resume() : await pause(); }, [status, pause, resume]);

  const pnl = portfolio?.total_pnl ?? 0;
  const equity = (config?.paper_equity ?? 1000) + pnl;
  const stateColor = STATE_COLOR[status?.state ?? 'idle'] || SUBTLE;

  const wsColor = connectionStatus === 'CONNECTED' ? GREEN : connectionStatus === 'CONNECTING' ? AMBER : RED;
  const sentimentScore = status?.sentiment?.sentiment_scores?.MARKET ?? 0;
  const sentimentLabel = sentimentScore > 0.4 ? ' BULLISH' : sentimentScore < -0.4 ? ' BEARISH' : ' NEUTRAL';
  const sentimentColor = sentimentScore > 0.4 ? GREEN : sentimentScore < -0.4 ? RED : TEXT;

  return (
    <div data-testid="autopilot-dashboard" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Paper Banner */}
      <div data-testid="paper-mode-banner" style={{ textAlign: 'center', padding: '5px 0', background: AMBER, color: '#000', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
         PAPER TRADING MODE  NO REAL MONEY AT RISK
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: PANEL }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span data-testid="autopilot-heading" style={{ fontSize: 14, fontWeight: 700 }}> AI OPTIONS AUTOPILOT</span>
          {status && (
            <span data-testid="autopilot-status-badge" style={{ fontSize: 10, fontWeight: 700, color: stateColor, border: `1px solid ${stateColor}44`, borderRadius: 2, padding: '2px 8px' }}>
              {status.kill_switch ? ' KILL SWITCH' : (status.state ?? 'idle').toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 10, color: wsColor, border: `1px solid ${wsColor}44`, borderRadius: 2, padding: '2px 6px' }}>WS:{connectionStatus}</span>
          {status?.sentiment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
              <span style={{ color: SUBTLE }}>MARKET:</span>
              <span data-testid="sentiment-badge" style={{ color: sentimentColor, fontWeight: 700 }}>{sentimentLabel}</span>
              <span style={{ color: SUBTLE }}>{status.sentiment.news_velocity?.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: SUBTLE }}>EQ: <span style={{ color: TEXT }}>{fmtCur(equity)}</span> <span style={{ color: pnl >= 0 ? GREEN : RED }}>({pnl >= 0 ? '+' : ''}{fmtCur(pnl)})</span></span>
          <button onClick={() => setShowUniverse(!showUniverse)} data-testid="toggle-universe-btn" style={{ padding: '5px 10px', background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 10, cursor: 'pointer', fontFamily: MONO }}> UNIVERSE</button>
          <Btn onClick={handlePauseResume} disabled={isLoading || !!status?.kill_switch} color={AMBER} testId="pause-resume-btn">{status?.state === 'paused' ? ' RESUME' : ' PAUSE'}</Btn>
          <Btn onClick={handleStartStopLoop} disabled={isLoading || !!status?.kill_switch} color={status?.state === 'running' ? RED : GREEN} testId="start-stop-loop-btn">{isLoading ? <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> : null} {status?.state === 'running' ? ' STOP LOOP' : ' START LOOP'}</Btn>
          <Btn onClick={handleRunCycle} disabled={isLoading || !!status?.kill_switch} color={BLUE} testId="run-cycle-btn">{isLoading ? '' : ''} RUN CYCLE</Btn>
          <Btn onClick={handleKillSwitch} disabled={killSwitchPending} color={status?.kill_switch ? GREEN : RED} testId="kill-switch-btn">{status?.kill_switch ? ' DEACTIVATE KS' : ' KILL SWITCH'}</Btn>
        </div>
      </div>

      {showUniverse && (
        <div style={{ position: 'absolute', top: 80, right: 16, zIndex: 50, width: 380, boxShadow: '0 8px 32px #000a' }}>
          <UniverseEditor onClose={() => setShowUniverse(false)} />
        </div>
      )}

      {error && (
        <div data-testid="error-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', background: RED + '22', color: RED, fontSize: 11, flexShrink: 0 }}>
          <span> {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 14 }}></button>
        </div>
      )}

      <div style={{ padding: '8px 16px 0', flexShrink: 0 }}><IncidentsPanel /></div>

      {/* Chart Placeholder */}
      <div data-testid="chart-canvas" style={{ padding: '8px 16px', flexShrink: 0 }}>
        <div style={{ height: 80, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontSize: 11 }}> MARKET OVERVIEW  REAL-TIME FEED</div>
      </div>

      {/* Stats */}
      <div data-testid="autopilot-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '8px 16px', flexShrink: 0 }}>
        <StatCard label="PAPER EQUITY" value={fmtCur(equity)} testId="portfolio-card-paper-equity" />
        <StatCard label="TOTAL P&L" value={<>{pnl >= 0 ? '+' : ''}{fmtCur(pnl)}</>} color={pnl >= 0 ? GREEN : RED} testId="portfolio-card-total-p&l" />
        <StatCard label="OPEN POSITIONS" value={`${portfolio?.open_positions ?? 0} / ${config?.risk_limits?.max_open_positions ?? 10}`} testId="stat-positions" />
        <StatCard label="WIN RATE" value={fmtPct(status?.win_rate ?? 0)} color={(status?.win_rate ?? 0) >= 0.5 ? GREEN : RED} testId="stat-win-rate" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 8px', flexShrink: 0 }}>
        <StatCard label="NET DELTA" value={(portfolio?.net_delta ?? 0).toFixed(2)} testId="stat-net-delta" />
        <StatCard label="NET THETA" value={(portfolio?.net_theta ?? 0).toFixed(2)} testId="stat-net-theta" />
      </div>

      {/* Main Content Split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Positions + Proposals */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${BORDER}` }}>
          <div style={{ flex: 1, overflow: 'auto', borderBottom: `1px solid ${BORDER}`, minHeight: 200 }}><AutopilotPositions /></div>
          <div style={{ minHeight: 100, padding: 8 }}><AutopilotProposals /></div>
        </div>

        {/* Right: Agents + RunHistory + ThinkLog */}
        <div style={{ width: 400, display: 'flex', flexDirection: 'column', background: PANEL }}>
          <div style={{ flex: '0 0 50%', borderBottom: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px 0' }}><AutopilotAgents /></div>
            <RunHistory />
          </div>
          <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, padding: '6px 12px', background: PANEL, borderBottom: `1px solid ${BORDER}` }}> THINK ENGINE</div>
            <div style={{ flex: 1, overflow: 'hidden' }}><AutopilotThinkLog /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutopilotDashboard;