import { useState, useEffect } from 'react';
import { Settings, Upload, Save, AlertCircle, CheckCircle, X } from 'lucide-react';

interface StrategyConfig {
    name: string;
    strategy_type: string;
    symbols: string[];
    timeframe: string;
    params: Record<string, number | string>;
    risk_limits: {
        max_position_size: number;
        max_position_pct: number;
        max_daily_loss: number;
        stop_loss_pct: number;
    };
    execution_mode: 'backtest' | 'paper' | 'live';
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

const STRATEGY_TEMPLATES = [
    { id: 'sma_crossover', name: 'SMA Crossover', params: { fast_period: 10, slow_period: 50 } },
    { id: 'rsi_breakout', name: 'RSI Breakout', params: { rsi_period: 14, oversold: 30, overbought: 70 } },
    { id: 'vwap_reversion', name: 'VWAP Reversion', params: { deviation: 2.0, lookback: 20 } },
    { id: 'macd_signal', name: 'MACD Signal', params: { fast: 12, slow: 26, signal: 9 } },
    { id: 'bollinger_bands', name: 'Bollinger Bands', params: { period: 20, std_dev: 2.0 } },
];

const SYMBOLS = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'AMD'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function StrategyEditor({ strategyId, onClose }: { strategyId?: string; onClose: () => void }) {
    const [config, setConfig] = useState<StrategyConfig>({
        name: '',
        strategy_type: 'sma_crossover',
        symbols: ['AAPL'],
        timeframe: '1d',
        params: { fast_period: 10, slow_period: 50 },
        risk_limits: {
            max_position_size: 10000,
            max_position_pct: 20,
            max_daily_loss: 1000,
            stop_loss_pct: 2,
        },
        execution_mode: 'paper',
    });

    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [fileContent, setFileContent] = useState<string | null>(null);

    useEffect(() => {
        if (strategyId) {
            // Load existing strategy
            fetch(`${API_BASE}/strategies/${strategyId}`)
                .then(r => r.json())
                .then(data => {
                    setConfig({
                        name: data.name,
                        strategy_type: data.strategy_type,
                        symbols: [data.symbol],
                        timeframe: '1d',
                        params: data.params || {},
                        risk_limits: data.risk_limits || config.risk_limits,
                        execution_mode: 'paper',
                    });
                })
                .catch(console.error);
        }
    }, [strategyId]);

    const handleTemplateChange = (templateId: string) => {
        const template = STRATEGY_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setConfig(prev => ({
                ...prev,
                strategy_type: templateId,
                params: { ...template.params } as unknown as Record<string, number | string>,
            }));
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setFileContent(content);
            // Parse file name for strategy name
            setConfig(prev => ({
                ...prev,
                name: file.name.replace('.py', ''),
                strategy_type: 'custom',
            }));
        };
        reader.readAsText(file);
    };

    const validate = () => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!config.name.trim()) errors.push('Strategy name is required');
        if (config.symbols.length === 0) errors.push('At least one symbol is required');
        if (config.risk_limits.max_position_size <= 0) errors.push('Max position size must be positive');
        if (config.risk_limits.stop_loss_pct <= 0) warnings.push('Stop loss is disabled (0%)');
        if (config.execution_mode === 'live') warnings.push('Live trading is disabled for safety');

        setValidation({
            valid: errors.length === 0,
            errors,
            warnings,
        });

        return errors.length === 0;
    };

    const saveStrategy = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const method = strategyId ? 'PUT' : 'POST';
            const url = strategyId ? `${API_BASE}/strategies/${strategyId}` : `${API_BASE}/strategies`;

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: config.name,
                    strategy_type: config.strategy_type,
                    symbol: config.symbols[0],
                    params: config.params,
                    risk_limits: config.risk_limits,
                }),
            });

            onClose();
        } catch (e) {
            console.error('Failed to save strategy:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[600px] max-h-[700px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings size={20} />
                        {strategyId ? 'Edit Strategy' : 'New Strategy'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Strategy Name</label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            placeholder="My Strategy"
                        />
                    </div>

                    {/* Template / Upload */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Template</label>
                            <select
                                value={config.strategy_type}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            >
                                {STRATEGY_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Or Upload File</label>
                            <label className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 border-dashed rounded text-sm text-gray-400 cursor-pointer hover:bg-gray-650">
                                <Upload size={14} />
                                {fileContent ? 'File loaded' : 'Choose .py file'}
                                <input type="file" accept=".py" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {/* Symbols */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Symbols</label>
                        <div className="flex flex-wrap gap-2">
                            {SYMBOLS.map(sym => (
                                <button
                                    key={sym}
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            symbols: prev.symbols.includes(sym)
                                                ? prev.symbols.filter(s => s !== sym)
                                                : [...prev.symbols, sym],
                                        }));
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${config.symbols.includes(sym)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Timeframe */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
                        <div className="flex gap-2">
                            {TIMEFRAMES.map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setConfig(prev => ({ ...prev, timeframe: tf }))}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${config.timeframe === tf
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Parameters */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Parameters</label>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(config.params).map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-xs text-gray-500 mb-1">{key.replace(/_/g, ' ')}</label>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            params: { ...prev.params, [key]: parseFloat(e.target.value) || 0 },
                                        }))}
                                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risk Limits */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Risk Limits</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max Position ($)</label>
                                <input
                                    type="number"
                                    value={config.risk_limits.max_position_size}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        risk_limits: { ...prev.risk_limits, max_position_size: parseFloat(e.target.value) || 0 },
                                    }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max Position (%)</label>
                                <input
                                    type="number"
                                    value={config.risk_limits.max_position_pct}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        risk_limits: { ...prev.risk_limits, max_position_pct: parseFloat(e.target.value) || 0 },
                                    }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max Daily Loss ($)</label>
                                <input
                                    type="number"
                                    value={config.risk_limits.max_daily_loss}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        risk_limits: { ...prev.risk_limits, max_daily_loss: parseFloat(e.target.value) || 0 },
                                    }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Stop Loss (%)</label>
                                <input
                                    type="number"
                                    value={config.risk_limits.stop_loss_pct}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        risk_limits: { ...prev.risk_limits, stop_loss_pct: parseFloat(e.target.value) || 0 },
                                    }))}
                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Execution Mode */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Execution Mode</label>
                        <div className="flex gap-2">
                            {['backtest', 'paper'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setConfig(prev => ({ ...prev, execution_mode: mode as 'backtest' | 'paper' }))}
                                    className={`px-4 py-2 rounded text-xs font-medium transition-colors ${config.execution_mode === mode
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                            <button
                                disabled
                                className="px-4 py-2 rounded text-xs font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
                                title="Live trading disabled for safety"
                            >
                                Live (disabled)
                            </button>
                        </div>
                    </div>

                    {/* Validation Results */}
                    {validation && (
                        <div className="space-y-2">
                            {validation.errors.map((err, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-300">
                                    <AlertCircle size={14} />
                                    {err}
                                </div>
                            ))}
                            {validation.warnings.map((warn, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700 rounded text-xs text-yellow-300">
                                    <AlertCircle size={14} />
                                    {warn}
                                </div>
                            ))}
                            {validation.valid && validation.warnings.length === 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-700 rounded text-xs text-green-300">
                                    <CheckCircle size={14} />
                                    All validations passed
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                    <button
                        onClick={validate}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
                    >
                        Validate
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveStrategy}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50"
                        >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save Strategy'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
