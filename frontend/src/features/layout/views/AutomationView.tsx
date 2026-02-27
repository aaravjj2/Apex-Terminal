const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../../data/ApiClient';
import type { AutopilotStatus, ForecastConfig, ForecastStatus } from '../../../data/ApiClient';
import { UncertaintyConeContent } from '../../trading/tiles/UncertaintyCone';

interface BudgetConfig {
  maxTotalNotional: number; maxDailySpend: number; maxPerTrade: number;
  maxConcurrentPositions: number; maxLeverage: number; hardDrawdownStop: number;
}
interface LocalForecastConfig {
  enabled: boolean; confidenceLevel: number; useForFiltering: boolean;
  useForSizing: boolean; maxVolatilityThreshold: number;
}

function apiStatusToLocal(api: AutopilotStatus) {
  return { armed: api.armed, mode: api.mode as 'paper' | 'live', currentSpentToday: api.current_spent_today, activeStrategies: api.active_strategies, killSwitchTriggered: api.kill_switch_triggered };
}
function apiBudgetToLocal(api: AutopilotStatus['budget']): BudgetConfig {
  return { maxTotalNotional: api.max_total_notional, maxDailySpend: api.max_daily_spend, maxPerTrade: api.max_per_trade, maxConcurrentPositions: api.max_concurrent_positions, maxLeverage: api.max_leverage, hardDrawdownStop: api.hard_drawdown_stop };
}
function apiForecastConfigToLocal(api?: ForecastConfig): LocalForecastConfig {
  return { enabled: api?.enabled ?? true, confidenceLevel: api?.confidence_level ?? 0.68, useForFiltering: api?.use_for_filtering ?? true, useForSizing: api?.use_for_sizing ?? true, maxVolatilityThreshold: api?.max_volatility_threshold ?? 0.5 };
}
const isMarketOpen = () => {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const d = et.getDay(); if (d === 0 || d === 6) return false;
  const t = et.getHours() * 100 + et.getMinutes(); return t >= 930 && t < 1600;
};

const inputStyle = (disabled = false): React.CSSProperties => ({
  width: '100%', background: disabled ? BORDER : PANEL, color: disabled ? SUBTLE : TEXT,
  border: `1px solid ${BORDER}`, borderRadius: 2, padding: '5px 8px', fontSize: 11,
  fontFamily: MONO, boxSizing: 'border-box' as const,
});

function PanelCard({ children, accent, testId }: { children: React.ReactNode; accent?: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ background: PANEL, border: `1px solid ${accent || BORDER}`, borderRadius: 3, padding: '14px 16px', marginBottom: 10 }}>
      {children}
    </div>
  );
}
function CardTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 10, letterSpacing: '0.04em' }}><span style={{ fontSize: 15 }}>{icon}</span>{children}</div>;
}
function ToggleBtn({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ fontSize: 10, padding: '2px 10px', background: value ? GREEN + '22' : BORDER, color: value ? GREEN : SUBTLE, border: `1px solid ${value ? GREEN + '44' : BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO, fontWeight: 700, letterSpacing: '0.06em' }}>
      {value ? 'ON' : 'OFF'}
    </button>
  );
}

function ActivityLogSection({ armed }: { armed: boolean }) {
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: string; type: string; message: string; details?: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (loading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [loading]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/autopilot/status');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const newLogs: typeof logs = [];
      const lc = data.last_cycle;
      if (lc) {
        newLogs.push({ id: `${lc.cycle_id}-start`, timestamp: lc.started_at, type: 'CYCLE', message: `Cycle ${lc.cycle_id} started` });
        if (lc.candidates?.generated > 0) newLogs.push({ id: `${lc.cycle_id}-candidates`, timestamp: lc.started_at, type: 'CANDIDATES', message: `Generated ${lc.candidates.generated} candidates`, details: lc.candidates.by_template });
        if (lc.selection?.selected > 0) newLogs.push({ id: `${lc.cycle_id}-selected`, timestamp: lc.started_at, type: 'SELECTION', message: `Selected ${lc.selection.selected} trades, rejected ${lc.selection.rejected}` });
        if (lc.execution?.filled > 0) newLogs.push({ id: `${lc.cycle_id}-filled`, timestamp: lc.completed_at, type: 'FILL', message: `Filled ${lc.execution.filled} orders` });
        newLogs.push({ id: `${lc.cycle_id}-complete`, timestamp: lc.completed_at, type: lc.success ? 'SUCCESS' : 'ERROR', message: lc.success ? `Cycle complete in ${lc.duration_ms.toFixed(0)}ms` : `Cycle failed: ${lc.error}` });
      }
      setLogs(newLogs.reverse());
    } catch (e) { console.error('Failed to fetch activity:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); const t = setInterval(fetchLogs, 5000); return () => clearInterval(t); }, [fetchLogs, armed]);

  const typeColor: Record<string, string> = { CYCLE: BLUE, CANDIDATES: PURPLE, SELECTION: AMBER, FILL: GREEN, SUCCESS: GREEN, ERROR: RED };

  if (logs.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: SUBTLE, fontSize: 11 }}>
      {loading ? <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> : <><div style={{ fontSize: 20, marginBottom: 4 }}></div>No activity yet. Run a cycle to see logs.</>}
    </div>
  );

  return (
    <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 10, fontFamily: MONO }}>
      {logs.map(log => (
        <div key={log.id} style={{ display: 'flex', gap: 8, padding: '3px 6px', borderBottom: `1px solid ${BORDER}`, alignItems: 'flex-start' }}>
          <span style={{ color: SUBTLE, flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span style={{ color: typeColor[log.type] || SUBTLE, width: 72, flexShrink: 0, fontWeight: 700, textTransform: 'uppercase' }}>{log.type}</span>
          <span style={{ color: TEXT, flex: 1 }}>{log.message}</span>
          {log.details && <span style={{ color: SUBTLE }}>{JSON.stringify(log.details)}</span>}
        </div>
      ))}
    </div>
  );
}

export function AutomationView() {
  const [status, setStatus] = useState({ armed: false, mode: 'paper' as 'paper' | 'live', currentSpentToday: 0, activeStrategies: [] as string[], killSwitchTriggered: false });
  const [budget, setBudget] = useState<BudgetConfig>({ maxTotalNotional: 10000, maxDailySpend: 1000, maxPerTrade: 500, maxConcurrentPositions: 5, maxLeverage: 1, hardDrawdownStop: 0.1 });
  const [forecastConfig, setForecastConfig] = useState<LocalForecastConfig>({ enabled: true, confidenceLevel: 0.68, useForFiltering: true, useForSizing: true, maxVolatilityThreshold: 0.5 });
  const [forecastStatus, setForecastStatus] = useState<ForecastStatus | null>(null);
  const [confirmArm, setConfirmArm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (loading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [loading]);

  const updateForecast = (cfg: LocalForecastConfig) => {
    ApiClient.updateForecastConfig({ enabled: cfg.enabled, confidence_level: cfg.confidenceLevel, use_for_filtering: cfg.useForFiltering, use_for_sizing: cfg.useForSizing, max_volatility_threshold: cfg.maxVolatilityThreshold }).catch(console.error);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const api = await ApiClient.getAutomationStatus();
      setStatus(apiStatusToLocal(api)); setBudget(apiBudgetToLocal(api.budget));
      if (api.forecast_config) setForecastConfig(apiForecastConfigToLocal(api.forecast_config));
      try { setForecastStatus(await ApiClient.getForecastStatus('AAPL')); } catch {}
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => { fetchStatus(); const t = setInterval(() => { if (status.armed) fetchStatus(); }, 5000); return () => clearInterval(t); }, [fetchStatus, status.armed]);

  const handleArmPaper = async () => {
    setLoading(true); setError(null);
    try { const api = await ApiClient.armAutomation('paper'); setStatus(apiStatusToLocal(api)); setBudget(apiBudgetToLocal(api.budget)); setConfirmArm(false); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const handleArmLive = async () => {
    if (!confirmArm) { setConfirmArm(true); return; }
    setLoading(true); setError(null);
    try { const api = await ApiClient.armAutomation('live', true); setStatus(apiStatusToLocal(api)); setBudget(apiBudgetToLocal(api.budget)); setConfirmArm(false); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const handleDisarm = async () => {
    setLoading(true); setError(null);
    try { const api = await ApiClient.disarmAutomation(); setStatus(apiStatusToLocal(api)); setConfirmArm(false); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const handleKillSwitch = async () => {
    setLoading(true); setError(null);
    try { const api = await ApiClient.killAutomation(); setStatus(apiStatusToLocal(api)); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const handleReset = async () => {
    setLoading(true); setError(null);
    try { const api = await ApiClient.resetAutomation(); setStatus(apiStatusToLocal(api)); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  const spendPct = Math.min(100, (status.currentSpentToday / budget.maxDailySpend) * 100);
  const spendColor = spendPct > 80 ? RED : spendPct > 50 ? AMBER : GREEN;
  const mktOpen = isMarketOpen();

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: BG, padding: '16px 20px', fontFamily: MONO }} data-testid="automation-view">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: AMBER }}></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>AUTOMATION</span>
            <span style={{ fontSize: 10, color: SUBTLE }}>One-click Autopilot with budget controls</span>
            <span style={{ fontSize: 9, padding: '2px 8px', background: status.armed ? (status.mode === 'live' ? RED + '22' : GREEN + '22') : BORDER, color: status.armed ? (status.mode === 'live' ? RED : GREEN) : SUBTLE, border: `1px solid ${status.armed ? (status.mode === 'live' ? RED : GREEN) : BORDER}44`, borderRadius: 2, fontWeight: 700, letterSpacing: '0.06em' }}>
              {status.armed ? `${status.mode.toUpperCase()} ARMED` : 'DISARMED'}
            </span>
          </div>
          <button onClick={fetchStatus} disabled={loading}
            style={{ fontSize: 14, background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, width: 28, height: 28, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: RED, fontSize: 14 }}></span>
            <span style={{ fontSize: 11, color: RED }}>{error}</span>
          </div>
        )}

        {/* Kill Switch Warning */}
        {status.killSwitchTriggered && (
          <div style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: RED, fontSize: 18 }}></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: RED }}>KILL SWITCH TRIGGERED</div>
                <div style={{ fontSize: 10, color: '#ff8a80', marginTop: 2 }}>All automation stopped. Review incidents before restarting.</div>
              </div>
            </div>
            <button onClick={handleReset} disabled={loading}
              style={{ fontSize: 10, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em' }}>
              RESET KILL SWITCH
            </button>
          </div>
        )}

        {/* Forecast Intelligence */}
        <PanelCard>
          <CardTitle icon="">Forecast Intelligence</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 6 }}>CURRENT FORECAST</div>
              <div style={{ height: 180, border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden', background: BG }}>
                {forecastStatus ? (
                  <UncertaintyConeContent symbol={forecastStatus.symbol} showControls={false} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: SUBTLE }}>
                    <span style={{ display: 'inline-block', marginRight: 6, transform: `rotate(${spinAngle}deg)` }}></span> Loading forecast
                  </div>
                )}
              </div>
              {forecastStatus && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                  {[
                    { label: 'Bias', value: forecastStatus.bias?.toUpperCase() || 'N/A', color: forecastStatus.bias === 'bullish' ? GREEN : forecastStatus.bias === 'bearish' ? RED : SUBTLE },
                    { label: 'Size Mult.', value: `${(forecastStatus.size_multiplier || 1).toFixed(2)}x` },
                    { label: '30D Lower', value: `$${forecastStatus.lower_bound_30d?.toFixed(2) || '--'}` },
                    { label: '30D Upper', value: `$${forecastStatus.upper_bound_30d?.toFixed(2) || '--'}` },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: SUBTLE }}>{item.label}</span>
                      <span style={{ color: item.color || TEXT, fontFamily: MONO }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', marginBottom: 8 }}>CONFIG</div>
              {[
                { label: 'Enabled', node: <ToggleBtn value={forecastConfig.enabled} onChange={v => { const c = { ...forecastConfig, enabled: v }; setForecastConfig(c); updateForecast(c); }} /> },
                { label: 'Confidence', node: <select value={forecastConfig.confidenceLevel} onChange={e => { const c = { ...forecastConfig, confidenceLevel: parseFloat(e.target.value) }; setForecastConfig(c); updateForecast(c); }} style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}`, fontSize: 10, padding: '2px 4px', fontFamily: MONO }}><option value={0.68}>68%</option><option value={0.95}>95%</option><option value={0.99}>99%</option></select> },
                { label: 'Filter Trades', node: <ToggleBtn value={forecastConfig.useForFiltering} onChange={v => { const c = { ...forecastConfig, useForFiltering: v }; setForecastConfig(c); updateForecast(c); }} /> },
                { label: 'Size by Vol', node: <ToggleBtn value={forecastConfig.useForSizing} onChange={v => { const c = { ...forecastConfig, useForSizing: v }; setForecastConfig(c); updateForecast(c); }} /> },
                { label: 'Max Vol', node: <span style={{ fontSize: 10, color: TEXT, fontFamily: MONO }}>{(forecastConfig.maxVolatilityThreshold * 100).toFixed(0)}%</span> },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 10, color: SUBTLE }}>{row.label}</span>
                  {row.node}
                </div>
              ))}
            </div>
          </div>
        </PanelCard>

        {/* Market Status */}
        {!mktOpen && (
          <div style={{ background: BLUE + '11', border: `1px solid ${BLUE}44`, borderRadius: 2, padding: '8px 12px', textAlign: 'center', fontSize: 11, color: BLUE, marginBottom: 10 }}>
            Market is currently closed. Live trading is disabled. (Open 9:30 AM - 4:00 PM ET)
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <PanelCard>
            <CardTitle icon="">Run Autopilot (Paper)</CardTitle>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 10 }}>Start automated trading in paper mode. No real money at risk.</div>
            <button onClick={status.armed ? handleDisarm : handleArmPaper} disabled={status.killSwitchTriggered || loading}
              style={{ width: '100%', padding: '7px', fontSize: 11, fontWeight: 700, background: status.armed && status.mode === 'paper' ? BORDER : GREEN, color: status.armed && status.mode === 'paper' ? TEXT : '#000', border: 'none', borderRadius: 2, cursor: status.killSwitchTriggered || loading ? 'not-allowed' : 'pointer', fontFamily: MONO, letterSpacing: '0.06em', opacity: status.killSwitchTriggered || loading ? 0.5 : 1 }}>
              {status.armed && status.mode === 'paper' ? 'STOP PAPER TRADING' : 'START PAPER TRADING'}
            </button>
          </PanelCard>

          <PanelCard accent={AMBER + '44'}>
            <CardTitle icon="">Arm Live Autopilot</CardTitle>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 10 }}>
              {confirmArm ? ' Click again to confirm LIVE trading activation.' : 'Enable real trading. Requires two-step confirmation.'}
            </div>
            <button onClick={status.armed && status.mode === 'live' ? handleDisarm : handleArmLive}
              disabled={status.killSwitchTriggered || loading || !mktOpen}
              title={!mktOpen ? 'Market is closed' : 'Enable Live Trading'}
              style={{ width: '100%', padding: '7px', fontSize: 11, fontWeight: 700, background: confirmArm ? RED : AMBER, color: '#000', border: 'none', borderRadius: 2, cursor: status.killSwitchTriggered || loading || !mktOpen ? 'not-allowed' : 'pointer', fontFamily: MONO, letterSpacing: '0.06em', opacity: status.killSwitchTriggered || loading || !mktOpen ? 0.5 : 1 }}>
              {!mktOpen ? 'MARKET CLOSED' : status.armed && status.mode === 'live' ? 'DISARM LIVE MODE' : confirmArm ? 'CONFIRM LIVE MODE' : 'ARM LIVE TRADING'}
            </button>
          </PanelCard>

          <PanelCard accent={RED + '44'}>
            <CardTitle icon="">Emergency Kill Switch</CardTitle>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 10 }}>Immediately stop all automation and optionally close positions.</div>
            <button onClick={handleKillSwitch} disabled={!status.armed || loading}
              style={{ width: '100%', padding: '7px', fontSize: 11, fontWeight: 700, background: !status.armed || loading ? BORDER : RED, color: '#fff', border: 'none', borderRadius: 2, cursor: !status.armed || loading ? 'not-allowed' : 'pointer', fontFamily: MONO, letterSpacing: '0.06em', opacity: !status.armed || loading ? 0.5 : 1 }}>
              KILL ALL AUTOMATION
            </button>
          </PanelCard>
        </div>

        {/* Budget Controls */}
        <PanelCard>
          <CardTitle icon="$">Budget & Risk Controls</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Max Total Notional', key: 'maxTotalNotional', prefix: '$' },
              { label: 'Max Daily Spend', key: 'maxDailySpend', prefix: '$' },
              { label: 'Max Per Trade', key: 'maxPerTrade', prefix: '$' },
              { label: 'Max Concurrent Positions', key: 'maxConcurrentPositions' },
              { label: 'Max Leverage', key: 'maxLeverage', step: '0.5' },
              { label: 'Hard Drawdown Stop (%)', key: 'hardDrawdownStop', isPercent: true, step: '1' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 3 }}>{f.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f.prefix && <span style={{ fontSize: 11, color: SUBTLE }}>{f.prefix}</span>}
                  <input type="number" disabled={status.armed}
                    value={f.isPercent ? (budget[f.key as keyof BudgetConfig] as number) * 100 : budget[f.key as keyof BudgetConfig]}
                    step={f.step}
                    onChange={e => setBudget(prev => ({ ...prev, [f.key]: f.isPercent ? Number(e.target.value) / 100 : Number(e.target.value) }))}
                    style={inputStyle(status.armed)} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: SUBTLE }}>Today's Spend</span>
              <span style={{ color: TEXT, fontFamily: MONO }}>${status.currentSpentToday.toLocaleString()} / ${budget.maxDailySpend.toLocaleString()}</span>
            </div>
            <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${spendPct}%`, background: spendColor, transition: 'width 0.3s, background 0.3s' }} />
            </div>
          </div>
        </PanelCard>

        {/* Active Strategies */}
        <PanelCard>
          <CardTitle icon="">Active Strategies</CardTitle>
          {status.activeStrategies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: SUBTLE, fontSize: 11 }}>
              <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}></div>
              No active strategies  Arm autopilot to activate strategies
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {status.activeStrategies.map(strat => (
                <div key={strat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                  <span style={{ fontSize: 11, color: TEXT }}>{strat}</span>
                  <span style={{ fontSize: 9, color: GREEN, background: GREEN + '22', border: `1px solid ${GREEN}44`, borderRadius: 2, padding: '1px 6px', fontFamily: MONO }}>RUNNING</span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Activity Log */}
        <PanelCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <CardTitle icon="">Activity Log</CardTitle>
            <button onClick={fetchStatus} disabled={loading}
              style={{ fontSize: 12, background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, width: 24, height: 24, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span>
            </button>
          </div>
          <ActivityLogSection armed={status.armed} />
        </PanelCard>

        {/* Note */}
        <div style={{ background: BLUE + '11', border: `1px solid ${BLUE}44`, borderRadius: 2, padding: '8px 12px', fontSize: 10, color: BLUE }}>
          <strong>Strategy Selection:</strong> Autopilot selects strategies based on long-horizon backtests, robustness suite results, and current regime classification. It will never "invent a strategy and trade immediately."
        </div>
      </div>
    </div>
  );
}