const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useCallback, useState, useEffect } from 'react';
import { useAutopilotStore } from '../store';

export interface V1TerminalPanelProps {
  onStartDay?: () => void;
  onEndDay?: () => void;
}

interface AntiThrashStatus {
  tickerCooldowns: Record<string, number>;
  consecutiveStopouts: number;
  circuitBreakerActive: boolean;
  circuitBreakerRemaining: number;
  dailyLossPct: number;
  dailyLossLimit: number;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function ProgressBar({ value, max, testId }: { value: number; max: number; testId?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = pct >= 100 ? RED : pct >= 80 ? AMBER : GREEN;
  return (
    <div data-testid={testId} style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width 0.3s' }} />
    </div>
  );
}

function V1RiskLimits({ positions, maxPositions, exposure, maxExposure }: { positions: number; maxPositions: number; exposure: number; maxExposure: number }) {
  return (
    <div data-testid="v1-risk-limits" style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>V1 RISK LIMITS</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
          <span style={{ color: SUBTLE }}>POSITIONS</span>
          <span style={{ color: positions >= maxPositions ? RED : TEXT, fontFamily: MONO }}>{positions} / {maxPositions}</span>
        </div>
        <ProgressBar value={positions} max={maxPositions} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
          <span style={{ color: SUBTLE }}>EXPOSURE</span>
          <span style={{ color: exposure >= maxExposure ? RED : TEXT, fontFamily: MONO }}>{fmtCur(exposure)} / {fmtCur(maxExposure)}</span>
        </div>
        <ProgressBar value={exposure} max={maxExposure} />
      </div>
    </div>
  );
}

function AntiThrashDisplay({ status }: { status: AntiThrashStatus }) {
  const isBlocked = status.circuitBreakerActive || status.dailyLossPct >= status.dailyLossLimit;
  return (
    <div data-testid="anti-thrash-status" style={{ background: PANEL, border: `1px solid ${isBlocked ? RED : BORDER}`, borderRadius: 2, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>ANTI-THRASH</div>
      {status.circuitBreakerActive && (
        <div style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, padding: '6px 10px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
            <span style={{ color: RED, fontWeight: 700 }}> CIRCUIT BREAKER</span>
            <span style={{ color: TEXT, fontFamily: MONO }}>{fmtTime(status.circuitBreakerRemaining)}</span>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
        <div><span style={{ color: SUBTLE }}>STOP-OUTS: </span><span style={{ color: status.consecutiveStopouts >= 2 ? AMBER : TEXT, fontFamily: MONO }}>{status.consecutiveStopouts}/3</span></div>
        <div><span style={{ color: SUBTLE }}>DAILY LOSS: </span><span style={{ color: status.dailyLossPct >= status.dailyLossLimit ? RED : TEXT, fontFamily: MONO }}>{fmtPct(status.dailyLossPct)}</span></div>
      </div>
      {Object.keys(status.tickerCooldowns).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>COOLDOWNS:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(status.tickerCooldowns).slice(0, 5).map(([ticker, secs]) => (
              <span key={ticker} style={{ fontSize: 10, padding: '2px 6px', background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 2, color: AMBER, fontFamily: MONO }}>{ticker} {fmtTime(secs)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionTimer({ startTime, isActive }: { startTime: Date | null; isActive: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isActive || !startTime) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isActive, startTime]);
  const h = Math.floor(elapsed / 3600); const m = Math.floor((elapsed % 3600) / 60); const s = elapsed % 60;
  return (
    <div data-testid="session-timer" style={{ textAlign: 'center', fontSize: 28, fontFamily: MONO, fontWeight: 700, color: isActive ? GREEN : SUBTLE }}>
      {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </div>
  );
}

export const V1TerminalPanel: React.FC<V1TerminalPanelProps> = ({ onStartDay, onEndDay }) => {
  const { config, status, portfolio, isLoading, triggerRun, activateKillSwitch } = useAutopilotStore();
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (isLoading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [isLoading]);
  const [antiThrash, setAntiThrash] = useState<AntiThrashStatus>({ tickerCooldowns: {}, consecutiveStopouts: 0, circuitBreakerActive: false, circuitBreakerRemaining: 0, dailyLossPct: 0, dailyLossLimit: 0.05 });

  const handleStartDay = useCallback(async () => {
    setSessionActive(true); setSessionStart(new Date()); setIsRecording(true);
    setAntiThrash(p => ({ ...p, consecutiveStopouts: 0, circuitBreakerActive: false, dailyLossPct: 0, tickerCooldowns: {} }));
    onStartDay?.();
    await triggerRun(true);
  }, [triggerRun, onStartDay]);

  const handleEndDay = useCallback(async () => {
    await activateKillSwitch(true);
    setSessionActive(false); setSessionStart(null); setIsRecording(false);
    onEndDay?.();
  }, [activateKillSwitch, onEndDay]);

  const pnl = portfolio?.total_pnl ?? 0;
  const positions = portfolio?.positions?.length ?? 0;
  const exposure = portfolio?.total_exposure ?? 0;
  const maxPositions = config?.risk_limits?.max_open_positions ?? 10;
  const maxExposure = config?.risk_limits?.max_total_exposure_usd ?? 1000;

  return (
    <div data-testid="v1-terminal-panel" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: 16, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}> V1 TERMINAL</div>
          <div style={{ fontSize: 10, color: SUBTLE }}>LONG PREMIUM ONLY  PAPER MODE</div>
        </div>
        {isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: RED, animation: 'none' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: RED }}>REC</span>
          </div>
        )}
      </div>

      {/* Session Timer */}
      <div style={{ marginBottom: 12 }}>
        <SessionTimer startTime={sessionStart} isActive={sessionActive} />
        <div style={{ textAlign: 'center', fontSize: 10, color: SUBTLE, marginTop: 4 }}>{sessionActive ? 'SESSION ACTIVE' : 'SESSION INACTIVE'}</div>
      </div>

      {/* P&L */}
      <div data-testid="v1-pnl-display" style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '12px 16px', marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>SESSION P&L</div>
        <div data-testid="pnl-indicator" style={{ fontSize: 28, fontFamily: MONO, fontWeight: 700, color: pnl >= 0 ? GREEN : RED }}>{pnl >= 0 ? '+' : ''}{fmtCur(pnl)}</div>
      </div>

      {/* Risk */}
      <div style={{ marginBottom: 12 }}>
        <V1RiskLimits positions={positions} maxPositions={maxPositions} exposure={exposure} maxExposure={maxExposure} />
      </div>

      {/* Anti-Thrash */}
      <div style={{ marginBottom: 12 }}><AntiThrashDisplay status={antiThrash} /></div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!sessionActive ? (
          <button data-testid="start-day-btn" onClick={handleStartDay} disabled={isLoading || !!status?.kill_switch}
            style={{ padding: '14px 0', background: isLoading || status?.kill_switch ? BORDER : GREEN, color: '#000', border: 'none', borderRadius: 2, fontSize: 14, fontWeight: 700, cursor: isLoading || status?.kill_switch ? 'not-allowed' : 'pointer', fontFamily: MONO }}>
            {isLoading ? <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> : ''} {isLoading ? 'STARTING...' : 'START DAY'}
          </button>
        ) : (
          <>
            <button data-testid="run-cycle-btn" onClick={() => triggerRun(true)} disabled={isLoading || !!status?.kill_switch}
              style={{ padding: '10px 0', background: isLoading || status?.kill_switch ? BORDER : BLUE, color: '#000', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO }}>
              {isLoading ? <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> : ''} RUN CYCLE NOW
            </button>
            <button data-testid="end-day-btn" onClick={handleEndDay} disabled={isLoading}
              style={{ padding: '10px 0', background: isLoading ? BORDER : RED, color: '#000', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: MONO }}>
               END DAY (CLOSE ALL)
            </button>
          </>
        )}
      </div>

      {/* Contract Info */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}`, textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
        <div>V1 CONTRACT: 10 POSITIONS  $1,000 EXPOSURE  10% STOP LOSS</div>
        <div style={{ marginTop: 3 }}>TEMPLATES: LONG_CALL, LONG_PUT ONLY</div>
      </div>
    </div>
  );
};

export default V1TerminalPanel;