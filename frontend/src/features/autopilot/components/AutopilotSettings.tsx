/**
 * Autopilot Settings Component
 * Configuration UI for autopilot parameters
 */

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

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children }) => (
  <div className="flex items-start justify-between py-4 border-b border-gray-700">
    <div className="flex-1">
      <label className="text-white font-medium">{label}</label>
      {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
    </div>
    <div className="ml-4">{children}</div>
  </div>
);

export const AutopilotSettings: React.FC = () => {
  const { config, defaults, isLoading, error, fetchConfig, updateConfig, clearError } = useAutopilotStore();
  
  // Local form state
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
  
  // Ticker disambiguation for focus symbol
  const focusSymbolInput = useTickerInput({
    initialValue: '',
    onResolved: (symbol) => { setFocusSymbol(symbol); setIsDirty(true); },
    watchlist: [],
  });
  
  // Risk limits
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState(50);
  const [maxTotalRisk, setMaxTotalRisk] = useState(400);
  const [maxDailyLoss, setMaxDailyLoss] = useState(30);
  const [maxOpenPositions, setMaxOpenPositions] = useState(10);
  const [maxSymbolConcentration, setMaxSymbolConcentration] = useState(0.25);
  const [maxPositionsPerUnderlying, setMaxPositionsPerUnderlying] = useState(2);
  const [maxClusterConcentration, setMaxClusterConcentration] = useState(0.4);
  
  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Sync local state with config
  useEffect(() => {
    if (config) {
      setPaperEquity(config.paper_equity ?? 1000);
      const uiMode = config.mode === 'paused' ? 'manual' : 'auto';
      setMode(uiMode as AutopilotMode);
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

  const handleTemplateToggle = (templateId: string) => {
    setAllowedTemplates((prev) => {
      const templates = prev ?? [];
      if (templates.includes(templateId)) {
        return templates.filter((t) => t !== templateId);
      } else {
        return [...templates, templateId];
      }
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    const backendMode = mode === 'manual' ? 'paused' : 'paper';
    await updateConfig({
      paper_equity: paperEquity,
      mode: backendMode,
      llm_enabled: llmEnabled,
      forecast_influence: forecastInfluence,
      allowed_templates: allowedTemplates,
      focus_symbol: focusSymbol || null,
      max_symbols_per_cycle: maxSymbolsPerCycle,
      contracts_per_trade: contractsPerTrade,
      continuous_run: continuousRun,
      weekly_expiry_only: weeklyExpiryOnly,
      risk_limits: {
        max_risk_per_trade: maxRiskPerTrade,
        max_total_risk: maxTotalRisk,
        max_daily_loss: maxDailyLoss,
        max_open_positions: maxOpenPositions,
        max_symbol_concentration: maxSymbolConcentration,
        max_positions_per_underlying: maxPositionsPerUnderlying,
        max_cluster_concentration: maxClusterConcentration,
      },
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    if (defaults) {
      setPaperEquity(defaults.paper_equity);
      const uiMode = defaults.mode === 'paused' ? 'manual' : 'auto';
      setMode(uiMode as AutopilotMode);
      setLlmEnabled(defaults.llm_enabled);
      setForecastInfluence(defaults.forecast_influence);
      setAllowedTemplates(defaults.allowed_templates);
      setFocusSymbol(defaults.focus_symbol ?? '');
      setMaxSymbolsPerCycle(defaults.max_symbols_per_cycle ?? 1);
      setContractsPerTrade(defaults.contracts_per_trade ?? 10);
      setContinuousRun(defaults.continuous_run ?? true);
      setWeeklyExpiryOnly(defaults.weekly_expiry_only ?? true);
      setMaxRiskPerTrade(defaults.risk_limits.max_risk_per_trade);
      setMaxTotalRisk(defaults.risk_limits.max_total_risk);
      setMaxDailyLoss(defaults.risk_limits.max_daily_loss);
      setMaxOpenPositions(defaults.risk_limits.max_open_positions);
      setMaxSymbolConcentration(defaults.risk_limits.max_symbol_concentration ?? 0.25);
      setMaxPositionsPerUnderlying(defaults.risk_limits.max_positions_per_underlying);
      setMaxClusterConcentration(defaults.risk_limits.max_cluster_concentration ?? 0.4);
      setIsDirty(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" data-testid="autopilot-settings">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold" data-testid="autopilot-settings-heading">⚙️ Autopilot Settings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium"
            data-testid="reset-btn"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !isDirty}
            className={`px-4 py-2 rounded font-medium ${
              isDirty 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 cursor-not-allowed'
            }`}
            data-testid="save-btn"
          >
            {isLoading ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900 text-red-200 p-3 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* General Section */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">General</h3>
          
          <SettingRow 
            label="Paper Equity" 
            description="Starting paper trading equity (no real money)"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={paperEquity}
                onChange={(e) => { setPaperEquity(Number(e.target.value)); setIsDirty(true); }}
                className="w-24 bg-gray-700 rounded px-3 py-2 text-right font-mono"
                min={100}
                max={100000}
                step={100}
                data-testid="paper-equity-input"
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Focus Symbol"
            description="Only trade this underlying (leave blank for full universe)"
          >
            <input
              type="text"
              value={focusSymbolInput.value}
              onChange={(e) => { focusSymbolInput.onChange(e.target.value); setIsDirty(true); }}
              onBlur={() => focusSymbolInput.submit()}
              className="w-32 bg-gray-700 rounded px-3 py-2 font-mono uppercase"
              placeholder="AAPL"
              data-testid="focus-symbol-input"
            />
          </SettingRow>

          <SettingRow
            label="Contracts Per Trade"
            description="Fixed number of contracts per trade"
          >
            <input
              type="number"
              value={contractsPerTrade}
              onChange={(e) => { setContractsPerTrade(Number(e.target.value)); setIsDirty(true); }}
              className="w-20 bg-gray-700 rounded px-3 py-2 text-right font-mono"
              min={1}
              data-testid="contracts-per-trade"
            />
          </SettingRow>

          <SettingRow
            label="Max Symbols Per Cycle"
            description="Limit to a single underlying per cycle"
          >
            <input
              type="number"
              value={maxSymbolsPerCycle}
              onChange={(e) => { setMaxSymbolsPerCycle(Number(e.target.value)); setIsDirty(true); }}
              className="w-20 bg-gray-700 rounded px-3 py-2 text-right font-mono"
              min={1}
              data-testid="max-symbols-per-cycle"
            />
          </SettingRow>

          <SettingRow
            label="Continuous Run"
            description="Keep running cycles until stopped"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={continuousRun}
                onChange={(e) => { setContinuousRun(e.target.checked); setIsDirty(true); }}
                className="w-5 h-5 rounded"
                data-testid="continuous-run"
              />
              <span>{continuousRun ? 'Enabled' : 'Disabled'}</span>
            </label>
          </SettingRow>

          <SettingRow
            label="Weekly Expiry Only"
            description="Prefer weekly options expirations"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={weeklyExpiryOnly}
                onChange={(e) => { setWeeklyExpiryOnly(e.target.checked); setIsDirty(true); }}
                className="w-5 h-5 rounded"
                data-testid="weekly-expiry-only"
              />
              <span>{weeklyExpiryOnly ? 'Enabled' : 'Disabled'}</span>
            </label>
          </SettingRow>

          <SettingRow
            label="Operating Mode"
            description="auto = fully automated, semi = requires approval, manual = suggestions only"
          >
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value as AutopilotMode); setIsDirty(true); }}
              className="bg-gray-700 rounded px-3 py-2"
              data-testid="mode-select"
            >
              <option value="auto">Auto</option>
              <option value="semi">Semi-Auto</option>
              <option value="manual">Manual</option>
            </select>
          </SettingRow>

          <SettingRow
            label="LLM Integration"
            description="Enable AI-powered candidate ranking (requires external LLM endpoint)"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={llmEnabled}
                onChange={(e) => { setLlmEnabled(e.target.checked); setIsDirty(true); }}
                className="w-5 h-5 rounded"
                data-testid="llm-checkbox"
              />
              <span>{llmEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </SettingRow>

          {llmEnabled && (
            <SettingRow
              label="Forecast Influence"
              description="How much LLM forecasts affect candidate ranking (0-1)"
            >
              <input
                type="range"
                value={forecastInfluence}
                onChange={(e) => { setForecastInfluence(Number(e.target.value)); setIsDirty(true); }}
                className="w-32"
                min={0}
                max={1}
                step={0.1}
                data-testid="forecast-influence"
              />
              <span className="ml-2 font-mono text-sm">{forecastInfluence.toFixed(1)}</span>
            </SettingRow>
          )}
        </section>

        {/* Risk Limits Section */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Risk Limits</h3>
          
          <SettingRow
            label="Max Risk Per Trade"
            description="Maximum dollar risk on any single trade"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={maxRiskPerTrade}
                onChange={(e) => { setMaxRiskPerTrade(Number(e.target.value)); setIsDirty(true); }}
                className="w-24 bg-gray-700 rounded px-3 py-2 text-right font-mono"
                min={10}
                max={500}
                step={10}
                data-testid="max-risk-per-trade"
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Max Total Risk"
            description="Maximum total portfolio risk across all positions"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={maxTotalRisk}
                onChange={(e) => { setMaxTotalRisk(Number(e.target.value)); setIsDirty(true); }}
                className="w-24 bg-gray-700 rounded px-3 py-2 text-right font-mono"
                min={100}
                max={5000}
                step={50}
                data-testid="max-total-risk"
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Max Daily Loss"
            description="Maximum allowed loss in a single day (triggers pause)"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={maxDailyLoss}
                onChange={(e) => { setMaxDailyLoss(Number(e.target.value)); setIsDirty(true); }}
                className="w-24 bg-gray-700 rounded px-3 py-2 text-right font-mono"
                min={10}
                max={500}
                step={10}
                data-testid="max-daily-loss"
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Max Open Positions"
            description="Maximum number of simultaneous open positions"
          >
            <input
              type="number"
              value={maxOpenPositions}
              onChange={(e) => { setMaxOpenPositions(Number(e.target.value)); setIsDirty(true); }}
              className="w-20 bg-gray-700 rounded px-3 py-2 text-right font-mono"
              min={1}
              max={20}
              step={1}
              data-testid="max-open-positions"
            />
          </SettingRow>

          <SettingRow
            label="Max Symbol Concentration"
            description="Maximum risk percentage in any single underlying"
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={maxSymbolConcentration}
                onChange={(e) => { setMaxSymbolConcentration(Number(e.target.value)); setIsDirty(true); }}
                className="w-32"
                min={0.1}
                max={0.5}
                step={0.05}
                data-testid="max-symbol-concentration"
              />
              <span className="font-mono text-sm">{(maxSymbolConcentration * 100).toFixed(0)}%</span>
            </div>
          </SettingRow>
        </section>

        {/* Strategy Templates Section */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-purple-400 mb-4">Strategy Templates</h3>
          <p className="text-gray-500 text-sm mb-4">
            Select which strategy templates the autopilot is allowed to use. All templates are defined-risk.
          </p>
          
          <div className="grid gap-3">
            {STRATEGY_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`flex items-center justify-between p-4 rounded border ${
                  allowedTemplates.includes(template.id)
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div>
                  <span className="font-medium">{template.name}</span>
                  <p className="text-gray-500 text-sm">{template.description}</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedTemplates.includes(template.id)}
                    onChange={() => handleTemplateToggle(template.id)}
                    className="w-5 h-5 rounded"
                    data-testid={`template-${template.id}`}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-500 mb-4">⚠️ Danger Zone</h3>
          <div className="border border-red-800 rounded p-4 bg-red-900/10">
            <p className="text-gray-400 text-sm mb-4">
              These actions cannot be undone. Use with caution.
            </p>
            <div className="flex gap-4">
              <button
                className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded font-medium"
                data-testid="reset-positions-btn"
              >
                🗑️ Clear All Positions
              </button>
              <button
                className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded font-medium"
                data-testid="reset-all-btn"
              >
                🔄 Reset Everything
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Ticker Disambiguation Dialog */}
      <TickerDisambiguationDialog {...focusSymbolInput.dialogProps} />
    </div>
  );
};

export default AutopilotSettings;
