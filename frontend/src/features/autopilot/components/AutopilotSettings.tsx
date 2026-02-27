const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState } from 'react';
import { useAutopilotStore } from '../store';
import type { AutopilotMode } from '../types';
import { useTickerInput } from '../../ticker/useTickerInput';
import { TickerDisambiguationDialog } from '../../ticker/TickerDisambiguationDialog';

const STRATEGY_TEMPLATES = [
  { id: 'PUT_CREDIT_SPREAD', name: 'Put Credit Spread', description: 'Bullish, sell OTM put spread' },
  { id: 'CALL_CREDIT_SPREAD', name: 'Call Credit Spread', description: 'Bearish, sell OTM call spread' },
  { id: 'IRON_CONDOR', name: 'Iron Condor', description: 'Neutral, sell both spreads' },
  { id: 'CALL_DEBIT_SPREAD', name: 'Call Debit Spread', description: 'Bullish, buy ATM call spread' },
  { id: 'PUT_DEBIT_SPREAD', name: 'Put Debit Spread', description: 'Bearish, buy ATM put spread' },
];

const inputStyle: React.CSSProperties = { background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '5px 8px', fontSize: 11, fontFamily: MONO };

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{label}</div>
        {description && <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ marginLeft: 20 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 36, height: 18, borderRadius: 9, background: checked ? GREEN : BORDER, position: 'relative', cursor: 'pointer', border: `1px solid ${checked ? GREEN + '44' : BORDER}`, transition: 'background 0.2s' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: TEXT, position: 'absolute', top: 1, left: checked ? 20 : 2, transition: 'left 0.2s' }} />
      </div>
      <span style={{ fontSize: 10, color: checked ? GREEN : SUBTLE }}>{checked ? 'Enabled' : 'Disabled'}</span>
    </label>
  );
}

function SectionTitle({ icon, children, color = BLUE }: { icon: string; children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '0.04em', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>{icon} {children}</div>;
}

export const AutopilotSettings: React.FC = () => {
  const { config, defaults, isLoading, error, fetchConfig, updateConfig, clearError } = useAutopilotStore();

  const [paperEquity, setPaperEquity] = useState(1000);
  const [mode, setMode] = useState<AutopilotMode>('auto');
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [forecastInfluence, setForecastInfluence] = useState(0.3);
  const [allowedTemplates, setAllowedTemplates] = useState<string[]>([]);
  const [focusSymbol, setFocusSymbol] = useState('');
  const [maxSymbolsPerCycle, setMaxSymbolsPerCycle] = useState(1);
  const [contractsPerTrade, setContractsPerTrade] = useState(10);
  const [continuousRun, setContinuousRun] = useState(true);
  const [weeklyExpiryOnly, setWeeklyExpiryOnly] = useState(true);
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState(50);
  const [maxTotalRisk, setMaxTotalRisk] = useState(400);
  const [maxDailyLoss, setMaxDailyLoss] = useState(30);
  const [maxOpenPositions, setMaxOpenPositions] = useState(10);
  const [maxSymbolConcentration, setMaxSymbolConcentration] = useState(0.25);
  const [maxPositionsPerUnderlying, setMaxPositionsPerUnderlying] = useState(2);
  const [maxClusterConcentration, setMaxClusterConcentration] = useState(0.4);
  const [isDirty, setIsDirty] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (isLoading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [isLoading]);

  const focusSymbolInput = useTickerInput({ initialValue: '', onResolved: (sym) => { setFocusSymbol(sym); setIsDirty(true); }, watchlist: [] });

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setPaperEquity(config.paper_equity ?? 1000);
      setMode((config.mode === 'paused' ? 'manual' : 'auto') as AutopilotMode);
      setLlmEnabled(config.llm_enabled ?? false);
      setForecastInfluence(config.forecast_influence ?? 0.3);
      setAllowedTemplates(config.allowed_templates ?? STRATEGY_TEMPLATES.map(t => t.id));
      setFocusSymbol(config.focus_symbol ?? '');
      focusSymbolInput.onChange(config.focus_symbol ?? '');
      setMaxSymbolsPerCycle(config.max_symbols_per_cycle ?? 1);
      setContractsPerTrade(config.contracts_per_trade ?? 10);
      setContinuousRun(config.continuous_run ?? true);
      setWeeklyExpiryOnly(config.weekly_expiry_only ?? true);
      setMaxRiskPerTrade(config.risk_limits?.max_risk_per_trade ?? 50);
      setMaxTotalRisk(config.risk_limits?.max_total_risk ?? 400);
      setMaxDailyLoss(config.risk_limits?.max_daily_loss ?? 30);
      setMaxOpenPositions(config.risk_limits?.max_open_positions ?? 10);
      setMaxSymbolConcentration(config.risk_limits?.max_symbol_concentration ?? 0.25);
      setIsDirty(false);
    }
  }, [config]);

  const handleTemplateToggle = (id: string) => {
    setAllowedTemplates(prev => { const t = prev ?? []; return t.includes(id) ? t.filter(x => x !== id) : [...t, id]; });
    setIsDirty(true);
  };

  const handleSave = async () => {
    await updateConfig({ paper_equity: paperEquity, mode: mode === 'manual' ? 'paused' : 'paper', llm_enabled: llmEnabled, forecast_influence: forecastInfluence, allowed_templates: allowedTemplates, focus_symbol: focusSymbol || null, max_symbols_per_cycle: maxSymbolsPerCycle, contracts_per_trade: contractsPerTrade, continuous_run: continuousRun, weekly_expiry_only: weeklyExpiryOnly, risk_limits: { max_risk_per_trade: maxRiskPerTrade, max_total_risk: maxTotalRisk, max_daily_loss: maxDailyLoss, max_open_positions: maxOpenPositions, max_symbol_concentration: maxSymbolConcentration, max_positions_per_underlying: maxPositionsPerUnderlying, max_cluster_concentration: maxClusterConcentration } });
    setIsDirty(false);
  };

  const handleReset = () => {
    if (defaults) {
      setPaperEquity(defaults.paper_equity);
      setMode((defaults.mode === 'paused' ? 'manual' : 'auto') as AutopilotMode);
      setLlmEnabled(defaults.llm_enabled); setForecastInfluence(defaults.forecast_influence); setAllowedTemplates(defaults.allowed_templates);
      setFocusSymbol(defaults.focus_symbol ?? ''); setMaxSymbolsPerCycle(defaults.max_symbols_per_cycle ?? 1); setContractsPerTrade(defaults.contracts_per_trade ?? 10);
      setContinuousRun(defaults.continuous_run ?? true); setWeeklyExpiryOnly(defaults.weekly_expiry_only ?? true);
      setMaxRiskPerTrade(defaults.risk_limits.max_risk_per_trade); setMaxTotalRisk(defaults.risk_limits.max_total_risk); setMaxDailyLoss(defaults.risk_limits.max_daily_loss);
      setMaxOpenPositions(defaults.risk_limits.max_open_positions); setMaxSymbolConcentration(defaults.risk_limits.max_symbol_concentration ?? 0.25);
      setMaxPositionsPerUnderlying(defaults.risk_limits.max_positions_per_underlying); setMaxClusterConcentration(defaults.risk_limits.max_cluster_concentration ?? 0.4);
      setIsDirty(true);
    }
  };

  return (
    <div data-testid="autopilot-settings" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <span data-testid="autopilot-settings-heading" style={{ fontSize: 13, fontWeight: 700 }}> AUTOPILOT SETTINGS</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-testid="reset-btn" onClick={handleReset} disabled={isLoading}
            style={{ fontSize: 10, padding: '5px 12px', background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
            RESET TO DEFAULTS
          </button>
          <button data-testid="save-btn" onClick={handleSave} disabled={isLoading || !isDirty}
            style={{ fontSize: 10, padding: '5px 12px', background: isDirty ? BLUE : BORDER, color: isDirty ? '#000' : SUBTLE, border: 'none', borderRadius: 2, cursor: isDirty ? 'pointer' : 'not-allowed', fontFamily: MONO, fontWeight: 700 }}>
            {isLoading ? <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> : null} {isLoading ? 'SAVING...' : ' SAVE CHANGES'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: RED + '22', color: RED, fontSize: 11, flexShrink: 0 }}>
          <span> {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 14 }}></button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* General */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle icon="" color={BLUE}>GENERAL</SectionTitle>
          <SettingRow label="Paper Equity" description="Starting paper trading equity (no real money)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: SUBTLE, fontSize: 11 }}>$</span>
              <input type="number" value={paperEquity} onChange={e => { setPaperEquity(Number(e.target.value)); setIsDirty(true); }} style={{ ...inputStyle, width: 90, textAlign: 'right' }} min={100} max={100000} step={100} data-testid="paper-equity-input" />
            </div>
          </SettingRow>
          <SettingRow label="Focus Symbol" description="Only trade this underlying (leave blank for full universe)">
            <input type="text" value={focusSymbolInput.value} onChange={e => { focusSymbolInput.onChange(e.target.value); setIsDirty(true); }} onBlur={() => focusSymbolInput.submit()} style={{ ...inputStyle, width: 80, textTransform: 'uppercase' }} placeholder="AAPL" data-testid="focus-symbol-input" />
          </SettingRow>
          <SettingRow label="Contracts Per Trade" description="Fixed number of contracts per trade">
            <input type="number" value={contractsPerTrade} onChange={e => { setContractsPerTrade(Number(e.target.value)); setIsDirty(true); }} style={{ ...inputStyle, width: 70, textAlign: 'right' }} min={1} data-testid="contracts-per-trade" />
          </SettingRow>
          <SettingRow label="Max Symbols Per Cycle" description="Limit to a single underlying per cycle">
            <input type="number" value={maxSymbolsPerCycle} onChange={e => { setMaxSymbolsPerCycle(Number(e.target.value)); setIsDirty(true); }} style={{ ...inputStyle, width: 70, textAlign: 'right' }} min={1} data-testid="max-symbols-per-cycle" />
          </SettingRow>
          <SettingRow label="Continuous Run" description="Keep running cycles until stopped">
            <Toggle checked={continuousRun} onChange={v => { setContinuousRun(v); setIsDirty(true); }} testId="continuous-run" />
          </SettingRow>
          <SettingRow label="Weekly Expiry Only" description="Prefer weekly options expirations">
            <Toggle checked={weeklyExpiryOnly} onChange={v => { setWeeklyExpiryOnly(v); setIsDirty(true); }} testId="weekly-expiry-only" />
          </SettingRow>
          <SettingRow label="Operating Mode" description="auto = fully automated, semi = requires approval, manual = suggestions only">
            <select value={mode} onChange={e => { setMode(e.target.value as AutopilotMode); setIsDirty(true); }} style={inputStyle} data-testid="mode-select">
              <option value="auto">Auto</option>
              <option value="semi">Semi-Auto</option>
              <option value="manual">Manual</option>
            </select>
          </SettingRow>
          <SettingRow label="LLM Integration" description="Enable AI-powered candidate ranking">
            <Toggle checked={llmEnabled} onChange={v => { setLlmEnabled(v); setIsDirty(true); }} testId="llm-checkbox" />
          </SettingRow>
          {llmEnabled && (
            <SettingRow label="Forecast Influence" description="How much LLM forecasts affect candidate ranking (0-1)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" value={forecastInfluence} onChange={e => { setForecastInfluence(Number(e.target.value)); setIsDirty(true); }} min={0} max={1} step={0.1} style={{ width: 100 }} data-testid="forecast-influence" />
                <span style={{ fontSize: 11, color: TEXT, fontFamily: MONO }}>{forecastInfluence.toFixed(1)}</span>
              </div>
            </SettingRow>
          )}
        </section>

        {/* Risk Limits */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle icon="" color={RED}>RISK LIMITS</SectionTitle>
          {[
            { label: 'Max Risk Per Trade', desc: 'Maximum dollar risk on any single trade', val: maxRiskPerTrade, set: setMaxRiskPerTrade, testId: 'max-risk-per-trade', min: 10, max: 500, step: 10 },
            { label: 'Max Total Risk', desc: 'Maximum total portfolio risk across all positions', val: maxTotalRisk, set: setMaxTotalRisk, testId: 'max-total-risk', min: 100, max: 5000, step: 50 },
            { label: 'Max Daily Loss', desc: 'Maximum allowed loss in a single day (triggers pause)', val: maxDailyLoss, set: setMaxDailyLoss, testId: 'max-daily-loss', min: 10, max: 500, step: 10 },
            { label: 'Max Open Positions', desc: 'Maximum number of simultaneous open positions', val: maxOpenPositions, set: setMaxOpenPositions, testId: 'max-open-positions', min: 1, max: 20, step: 1 },
          ].map(f => (
            <SettingRow key={f.testId} label={f.label} description={f.desc}>
              <input type="number" value={f.val} onChange={e => { f.set(Number(e.target.value)); setIsDirty(true); }} style={{ ...inputStyle, width: 90, textAlign: 'right' }} min={f.min} max={f.max} step={f.step} data-testid={f.testId} />
            </SettingRow>
          ))}
          <SettingRow label="Max Symbol Concentration" description="Maximum risk percentage in any single underlying">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" value={maxSymbolConcentration} onChange={e => { setMaxSymbolConcentration(Number(e.target.value)); setIsDirty(true); }} min={0.1} max={0.5} step={0.05} style={{ width: 100 }} data-testid="max-symbol-concentration" />
              <span style={{ fontSize: 11, color: TEXT, fontFamily: MONO }}>{(maxSymbolConcentration * 100).toFixed(0)}%</span>
            </div>
          </SettingRow>
        </section>

        {/* Strategy Templates */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle icon="" color={PURPLE}>STRATEGY TEMPLATES</SectionTitle>
          <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 10 }}>Select which strategy templates the autopilot is allowed to use. All templates are defined-risk.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STRATEGY_TEMPLATES.map(t => {
              const active = allowedTemplates.includes(t.id);
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: active ? PURPLE + '11' : PANEL, border: `1px solid ${active ? PURPLE + '44' : BORDER}`, borderRadius: 2 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: SUBTLE }}>{t.description}</div>
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={active} onChange={() => handleTemplateToggle(t.id)} data-testid={`template-${t.id}`} style={{ width: 14, height: 14, accentColor: PURPLE }} />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        {/* Danger Zone */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle icon="" color={RED}>DANGER ZONE</SectionTitle>
          <div style={{ background: RED + '08', border: `1px solid ${RED}44`, borderRadius: 2, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 10 }}>These actions cannot be undone. Use with caution.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button data-testid="reset-positions-btn" style={{ fontSize: 10, padding: '5px 12px', background: RED + '22', color: RED, border: `1px solid ${RED}44`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}> CLEAR ALL POSITIONS</button>
              <button data-testid="reset-all-btn" style={{ fontSize: 10, padding: '5px 12px', background: RED + '22', color: RED, border: `1px solid ${RED}44`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}> RESET EVERYTHING</button>
            </div>
          </div>
        </section>
      </div>

      <TickerDisambiguationDialog {...focusSymbolInput.dialogProps} />
    </div>
  );
};

export default AutopilotSettings;