import { useState, useEffect, useCallback } from 'react';
import { Bot, Play, Square, Shield, AlertTriangle, DollarSign, TrendingUp, Activity, RefreshCw, BarChart3, Zap } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Panel } from '../../../ui/Panel';
import { cn } from '../../../ui/utils';
import { ApiClient } from '../../../data/ApiClient';
import type { AutopilotStatus, ForecastConfig, ForecastStatus } from '../../../data/ApiClient';
import { UncertaintyConeContent } from '../../trading/tiles/UncertaintyCone';

interface BudgetConfig {
    maxTotalNotional: number;
    maxDailySpend: number;
    maxPerTrade: number;
    maxConcurrentPositions: number;
    maxLeverage: number;
    hardDrawdownStop: number;
}

interface LocalForecastConfig {
    enabled: boolean;
    confidenceLevel: number;
    useForFiltering: boolean;
    useForSizing: boolean;
    maxVolatilityThreshold: number;
}

// Convert API response to local format
function apiStatusToLocal(api: AutopilotStatus): {
    armed: boolean;
    mode: 'paper' | 'live';
    currentSpentToday: number;
    activeStrategies: string[];
    killSwitchTriggered: boolean;
} {
    return {
        armed: api.armed,
        mode: api.mode,
        currentSpentToday: api.current_spent_today,
        activeStrategies: api.active_strategies,
        killSwitchTriggered: api.kill_switch_triggered,
    };
}

function apiBudgetToLocal(api: AutopilotStatus['budget']): BudgetConfig {
    return {
        maxTotalNotional: api.max_total_notional,
        maxDailySpend: api.max_daily_spend,
        maxPerTrade: api.max_per_trade,
        maxConcurrentPositions: api.max_concurrent_positions,
        maxLeverage: api.max_leverage,
        hardDrawdownStop: api.hard_drawdown_stop,
    };
}

function apiForecastConfigToLocal(api?: ForecastConfig): LocalForecastConfig {
    return {
        enabled: api?.enabled ?? true,
        confidenceLevel: api?.confidence_level ?? 0.68,
        useForFiltering: api?.use_for_filtering ?? true,
        useForSizing: api?.use_for_sizing ?? true,
        maxVolatilityThreshold: api?.max_volatility_threshold ?? 0.5,
    };
}

// Activity Log Section Component
function ActivityLogSection({ armed }: { armed: boolean }) {
    const [logs, setLogs] = useState<Array<{
        id: string;
        timestamp: string;
        type: string;
        message: string;
        symbol?: string;
        details?: Record<string, unknown>;
    }>>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/api/v1/autopilot/status');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();

            // Convert last cycle data to log entries
            const newLogs: typeof logs = [];
            const lastCycle = data.last_cycle;

            if (lastCycle) {
                newLogs.push({
                    id: `${lastCycle.cycle_id}-start`,
                    timestamp: lastCycle.started_at,
                    type: 'CYCLE',
                    message: `Cycle ${lastCycle.cycle_id} started`,
                });

                if (lastCycle.candidates?.generated > 0) {
                    newLogs.push({
                        id: `${lastCycle.cycle_id}-candidates`,
                        timestamp: lastCycle.started_at,
                        type: 'CANDIDATES',
                        message: `Generated ${lastCycle.candidates.generated} candidates`,
                        details: lastCycle.candidates.by_template,
                    });
                }

                if (lastCycle.selection?.selected > 0) {
                    newLogs.push({
                        id: `${lastCycle.cycle_id}-selected`,
                        timestamp: lastCycle.started_at,
                        type: 'SELECTION',
                        message: `Selected ${lastCycle.selection.selected} trades, rejected ${lastCycle.selection.rejected}`,
                    });
                }

                if (lastCycle.execution?.filled > 0) {
                    newLogs.push({
                        id: `${lastCycle.cycle_id}-filled`,
                        timestamp: lastCycle.completed_at,
                        type: 'FILL',
                        message: `Filled ${lastCycle.execution.filled} orders`,
                    });
                }

                newLogs.push({
                    id: `${lastCycle.cycle_id}-complete`,
                    timestamp: lastCycle.completed_at,
                    type: lastCycle.success ? 'SUCCESS' : 'ERROR',
                    message: lastCycle.success
                        ? `Cycle complete in ${lastCycle.duration_ms.toFixed(0)}ms`
                        : `Cycle failed: ${lastCycle.error}`,
                });
            }

            setLogs(newLogs.reverse());
        } catch (e) {
            console.error('Failed to fetch activity:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fetchLogs, armed]);

    const typeColors: Record<string, string> = {
        'CYCLE': 'text-blue-400',
        'CANDIDATES': 'text-purple-400',
        'SELECTION': 'text-yellow-400',
        'FILL': 'text-green-400',
        'SUCCESS': 'text-green-500',
        'ERROR': 'text-red-500',
    };

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString();

    if (logs.length === 0) {
        return (
            <div className="text-center py-6 text-text-secondary">
                {loading ? (
                    <RefreshCw className="mx-auto animate-spin" size={20} />
                ) : (
                    <>
                        <Activity size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No activity yet. Run a cycle to see logs.</p>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
            {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 p-2 bg-element-bg/50 rounded">
                    <span className="text-text-muted shrink-0">{formatTime(log.timestamp)}</span>
                    <span className={`shrink-0 w-16 uppercase font-semibold ${typeColors[log.type] || 'text-text-secondary'}`}>
                        {log.type}
                    </span>
                    <span className="text-text flex-1">{log.message}</span>
                    {log.details && (
                        <span className="text-text-muted shrink-0">
                            {JSON.stringify(log.details)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}


const isMarketOpen = () => {
    // Basic EST 9:30-16:00 check
    const now = new Date();
    // Convert to ET
    const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = etNow.getDay(); // 0 is Sun, 6 is Sat
    const hour = etNow.getHours();
    const minute = etNow.getMinutes();

    // Weekend check
    if (day === 0 || day === 6) return false;

    // Time check (9:30 - 16:00)
    const time = hour * 100 + minute;
    return time >= 930 && time < 1600;
};

export function AutomationView() {
    const [status, setStatus] = useState({
        armed: false,
        mode: 'paper' as 'paper' | 'live',
        currentSpentToday: 0,
        activeStrategies: [] as string[],
        killSwitchTriggered: false,
    });

    const [budget, setBudget] = useState<BudgetConfig>({
        maxTotalNotional: 10000,
        maxDailySpend: 1000,
        maxPerTrade: 500,
        maxConcurrentPositions: 5,
        maxLeverage: 1,
        hardDrawdownStop: 0.1,
    });

    const [forecastConfig, setForecastConfig] = useState<LocalForecastConfig>({
        enabled: true,
        confidenceLevel: 0.68,
        useForFiltering: true,
        useForSizing: true,
        maxVolatilityThreshold: 0.5,
    });

    const [forecastStatus, setForecastStatus] = useState<ForecastStatus | null>(null);

    const [confirmArm, setConfirmArm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch status on mount
    const fetchStatus = useCallback(async () => {
        try {
            const apiStatus = await ApiClient.getAutomationStatus();
            setStatus(apiStatusToLocal(apiStatus));
            setBudget(apiBudgetToLocal(apiStatus.budget));
            if (apiStatus.forecast_config) {
                setForecastConfig(apiForecastConfigToLocal(apiStatus.forecast_config));
            }
            // Fetch forecast status for a default symbol
            try {
                const fsStatus = await ApiClient.getForecastStatus('AAPL');
                setForecastStatus(fsStatus);
            } catch {
                // Forecast status fetch failed, non-critical
            }
            setError(null);
        } catch (e) {
            setError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        // Poll every 5 seconds if armed
        const interval = setInterval(() => {
            if (status.armed) {
                fetchStatus();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus, status.armed]);

    const handleArmPaper = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiStatus = await ApiClient.armAutomation('paper');
            setStatus(apiStatusToLocal(apiStatus));
            setBudget(apiBudgetToLocal(apiStatus.budget));
            setConfirmArm(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleArmLive = async () => {
        if (!confirmArm) {
            setConfirmArm(true);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const apiStatus = await ApiClient.armAutomation('live', true);
            setStatus(apiStatusToLocal(apiStatus));
            setBudget(apiBudgetToLocal(apiStatus.budget));
            setConfirmArm(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDisarm = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiStatus = await ApiClient.disarmAutomation();
            setStatus(apiStatusToLocal(apiStatus));
            setConfirmArm(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleKillSwitch = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiStatus = await ApiClient.killAutomation();
            setStatus(apiStatusToLocal(apiStatus));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiStatus = await ApiClient.resetAutomation();
            setStatus(apiStatusToLocal(apiStatus));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-auto bg-background p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bot className="text-brand" size={28} />
                        <div>
                            <h1 className="text-2xl font-bold text-text">Automation</h1>
                            <p className="text-sm text-text-secondary">One-click Autopilot with budget controls</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Badge variant={status.armed ? (status.mode === 'live' ? 'error' : 'success') : 'default'}>
                            {status.armed ? `${status.mode.toUpperCase()} ARMED` : 'DISARMED'}
                        </Badge>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <Panel className="bg-red-500/10 border-red-500">
                        <div className="flex items-center gap-3 text-red-500">
                            <AlertTriangle size={20} />
                            <p className="text-sm">{error}</p>
                        </div>
                    </Panel>
                )}

                {/* Kill Switch Warning */}
                {status.killSwitchTriggered && (
                    <Panel className="bg-red-500/10 border-red-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-red-500">
                                <AlertTriangle size={24} />
                                <div>
                                    <p className="font-semibold">Kill Switch Triggered</p>
                                    <p className="text-sm opacity-80">All automation has been stopped. Review incidents before restarting.</p>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleReset} disabled={loading}>
                                Reset Kill Switch
                            </Button>
                        </div>
                    </Panel>
                )}

                {/* Forecast Intelligence Panel */}
                <Panel>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="text-blue-400" size={20} />
                        <h2 className="text-lg font-semibold text-text">Forecast Intelligence</h2>
                        {forecastConfig.enabled && (
                            <Badge variant="success" className="ml-2">
                                <Zap size={12} className="mr-1" />
                                Active
                            </Badge>
                        )}
                    </div>

                    {/* Forecast Chart & Status */}
                    <div className="bg-surface-secondary rounded-lg p-4 flex flex-col gap-4">
                        <h3 className="text-sm font-medium text-text-secondary">Current Forecast</h3>
                        <div className="h-48 w-full border border-border/50 rounded bg-background/50 overflow-hidden">
                            {forecastStatus ? (
                                <UncertaintyConeContent symbol={forecastStatus.symbol} showControls={false} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-text-secondary italic">
                                    <RefreshCw className="animate-spin mr-2" size={16} />
                                    Loading forecast visual...
                                </div>
                            )}
                        </div>

                        {forecastStatus && (
                            <div className="grid grid-cols-2 gap-2 text-sm border-t border-border pt-4">
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Bias</span>
                                    <Badge variant={
                                        forecastStatus.bias === 'bullish' ? 'success' :
                                            forecastStatus.bias === 'bearish' ? 'error' : 'default'
                                    }>
                                        {forecastStatus.bias?.toUpperCase() || 'N/A'}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-secondary">Size Mult.</span>
                                    <span className="text-text font-mono">{forecastStatus.size_multiplier?.toFixed(2) || '1.00'}x</span>
                                </div>
                                <div className="col-span-2 flex justify-between">
                                    <span className="text-text-secondary">30D Range</span>
                                    <span className="text-text font-mono text-xs">
                                        ${forecastStatus.lower_bound_30d?.toFixed(2)} - ${forecastStatus.upper_bound_30d?.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Forecast Config */}
                    <div className="bg-surface-secondary rounded-lg p-4">
                        <h3 className="text-sm font-medium text-text-secondary mb-3">Configuration</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Enabled</span>
                                <button
                                    onClick={() => {
                                        const newConfig = { ...forecastConfig, enabled: !forecastConfig.enabled };
                                        setForecastConfig(newConfig);
                                        ApiClient.updateForecastConfig({
                                            enabled: newConfig.enabled,
                                            confidence_level: newConfig.confidenceLevel,
                                            use_for_filtering: newConfig.useForFiltering,
                                            use_for_sizing: newConfig.useForSizing,
                                            max_volatility_threshold: newConfig.maxVolatilityThreshold,
                                        }).catch(console.error);
                                    }}
                                    className={cn(
                                        "px-3 py-1 rounded text-xs font-medium transition",
                                        forecastConfig.enabled
                                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                            : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                    )}
                                >
                                    {forecastConfig.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Confidence</span>
                                <select
                                    value={forecastConfig.confidenceLevel}
                                    onChange={(e) => {
                                        const level = parseFloat(e.target.value);
                                        const newConfig = { ...forecastConfig, confidenceLevel: level };
                                        setForecastConfig(newConfig);
                                        ApiClient.updateForecastConfig({
                                            enabled: newConfig.enabled,
                                            confidence_level: level,
                                            use_for_filtering: newConfig.useForFiltering,
                                            use_for_sizing: newConfig.useForSizing,
                                            max_volatility_threshold: newConfig.maxVolatilityThreshold,
                                        }).catch(console.error);
                                    }}
                                    className="bg-surface text-text text-xs rounded px-2 py-1 border border-border"
                                >
                                    <option value={0.68}>68%</option>
                                    <option value={0.95}>95%</option>
                                    <option value={0.99}>99%</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Filter Trades</span>
                                <button
                                    onClick={() => {
                                        const newConfig = { ...forecastConfig, useForFiltering: !forecastConfig.useForFiltering };
                                        setForecastConfig(newConfig);
                                        ApiClient.updateForecastConfig({
                                            enabled: newConfig.enabled,
                                            confidence_level: newConfig.confidenceLevel,
                                            use_for_filtering: newConfig.useForFiltering,
                                            use_for_sizing: newConfig.useForSizing,
                                            max_volatility_threshold: newConfig.maxVolatilityThreshold,
                                        }).catch(console.error);
                                    }}
                                    className={cn(
                                        "px-3 py-1 rounded text-xs font-medium transition",
                                        forecastConfig.useForFiltering
                                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                            : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                    )}
                                >
                                    {forecastConfig.useForFiltering ? 'YES' : 'NO'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Size by Vol</span>
                                <button
                                    onClick={() => {
                                        const newConfig = { ...forecastConfig, useForSizing: !forecastConfig.useForSizing };
                                        setForecastConfig(newConfig);
                                        ApiClient.updateForecastConfig({
                                            enabled: newConfig.enabled,
                                            confidence_level: newConfig.confidenceLevel,
                                            use_for_filtering: newConfig.useForFiltering,
                                            use_for_sizing: newConfig.useForSizing,
                                            max_volatility_threshold: newConfig.maxVolatilityThreshold,
                                        }).catch(console.error);
                                    }}
                                    className={cn(
                                        "px-3 py-1 rounded text-xs font-medium transition",
                                        forecastConfig.useForSizing
                                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                            : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                    )}
                                >
                                    {forecastConfig.useForSizing ? 'YES' : 'NO'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Max Vol</span>
                                <span className="text-text font-mono">{(forecastConfig.maxVolatilityThreshold * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </Panel>

                {/* Main Controls */}
                {/* Visual helper for market status */}
                {!isMarketOpen() && (
                    <div className="col-span-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center text-sm text-blue-400 mb-2">
                        Market is currently closed. Live trading is disabled. (Open 9:30 AM - 4:00 PM ET)
                    </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <Panel className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Play size={18} className="text-green-500" />
                            Run Autopilot (Paper)
                        </h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Start automated trading in paper mode. No real money at risk.
                        </p>
                        <Button
                            variant={status.armed && status.mode === 'paper' ? 'secondary' : 'primary'}
                            className="w-full"
                            onClick={status.armed ? handleDisarm : handleArmPaper}
                            disabled={status.killSwitchTriggered || loading}
                        >
                            {status.armed && status.mode === 'paper' ? 'Stop Paper Trading' : 'Start Paper Trading'}
                        </Button>
                    </Panel>

                    <Panel className="p-6 border-orange-500/30">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Shield size={18} className="text-orange-500" />
                            Arm Live Autopilot
                        </h3>
                        <p className="text-sm text-text-secondary mb-4">
                            {confirmArm
                                ? '⚠️ Click again to confirm LIVE trading activation.'
                                : 'Enable real trading. Requires two-step confirmation.'}
                        </p>
                        <Button
                            variant={confirmArm ? 'danger' : 'secondary'}
                            className={cn("w-full", confirmArm && "animate-pulse")}
                            onClick={status.armed && status.mode === 'live' ? handleDisarm : handleArmLive}
                            disabled={status.killSwitchTriggered || loading || !isMarketOpen()}
                            title={!isMarketOpen() ? "Market is closed" : "Enable Live Trading"}
                        >
                            {!isMarketOpen() ? 'Market Closed' :
                                status.armed && status.mode === 'live' ? 'Disarm Live Mode' :
                                    confirmArm ? 'Confirm Live Mode' : 'Arm Live Trading'}
                        </Button>
                    </Panel>

                    <Panel className="p-6 border-red-500/30">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Square size={18} className="text-red-500" />
                            Emergency Kill Switch
                        </h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Immediately stop all automation and optionally close positions.
                        </p>
                        <Button
                            variant="danger"
                            className="w-full"
                            onClick={handleKillSwitch}
                            disabled={!status.armed || loading}
                        >
                            Kill All Automation
                        </Button>
                    </Panel>
                </div>

                {/* Budget Controls */}
                <Panel className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-brand" />
                        Budget & Risk Controls
                    </h3>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="text-sm text-text-secondary">Max Total Notional</label>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-text-muted">$</span>
                                <input
                                    type="number"
                                    value={budget.maxTotalNotional}
                                    onChange={e => setBudget(prev => ({ ...prev, maxTotalNotional: Number(e.target.value) }))}
                                    className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full"
                                    disabled={status.armed}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary">Max Daily Spend</label>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-text-muted">$</span>
                                <input
                                    type="number"
                                    value={budget.maxDailySpend}
                                    onChange={e => setBudget(prev => ({ ...prev, maxDailySpend: Number(e.target.value) }))}
                                    className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full"
                                    disabled={status.armed}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary">Max Per Trade</label>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-text-muted">$</span>
                                <input
                                    type="number"
                                    value={budget.maxPerTrade}
                                    onChange={e => setBudget(prev => ({ ...prev, maxPerTrade: Number(e.target.value) }))}
                                    className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full"
                                    disabled={status.armed}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary">Max Concurrent Positions</label>
                            <input
                                type="number"
                                value={budget.maxConcurrentPositions}
                                onChange={e => setBudget(prev => ({ ...prev, maxConcurrentPositions: Number(e.target.value) }))}
                                className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full mt-1"
                                disabled={status.armed}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary">Max Leverage</label>
                            <input
                                type="number"
                                value={budget.maxLeverage}
                                onChange={e => setBudget(prev => ({ ...prev, maxLeverage: Number(e.target.value) }))}
                                className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full mt-1"
                                step="0.5"
                                min="1"
                                max="4"
                                disabled={status.armed}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary">Hard Drawdown Stop (%)</label>
                            <input
                                type="number"
                                value={budget.hardDrawdownStop * 100}
                                onChange={e => setBudget(prev => ({ ...prev, hardDrawdownStop: Number(e.target.value) / 100 }))}
                                className="bg-element-bg border border-border rounded px-3 py-2 text-text w-full mt-1"
                                step="1"
                                min="1"
                                max="50"
                                disabled={status.armed}
                            />
                        </div>
                    </div>

                    {/* Spend Progress */}
                    <div className="mt-6 pt-6 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-text-secondary">Today's Spend</span>
                            <span className="text-sm font-mono">${status.currentSpentToday.toLocaleString()} / ${budget.maxDailySpend.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-element-bg rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    status.currentSpentToday / budget.maxDailySpend > 0.8 ? "bg-red-500" :
                                        status.currentSpentToday / budget.maxDailySpend > 0.5 ? "bg-yellow-500" : "bg-green-500"
                                )}
                                style={{ width: `${Math.min(100, (status.currentSpentToday / budget.maxDailySpend) * 100)}%` }}
                            />
                        </div>
                    </div>
                </Panel>

                {/* Active Strategies */}
                <Panel className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-brand" />
                        Active Strategies
                    </h3>
                    {status.activeStrategies.length === 0 ? (
                        <div className="text-center py-8 text-text-secondary">
                            <Activity size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No active strategies</p>
                            <p className="text-sm">Arm autopilot to activate strategies</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {status.activeStrategies.map(strat => (
                                <div key={strat} className="flex items-center justify-between p-3 bg-element-bg rounded">
                                    <span>{strat}</span>
                                    <Badge variant="success">Running</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>

                {/* Activity Log */}
                <Panel className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Activity size={18} className="text-brand" />
                            Activity Log
                        </h3>
                        <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                    <ActivityLogSection armed={status.armed} />
                </Panel>

                {/* Strategy Selection Note */}
                <Panel className="p-4 bg-blue-500/10 border-blue-500/30">
                    <p className="text-sm text-blue-400">
                        <strong>Strategy Selection:</strong> Autopilot selects strategies based on long-horizon backtests,
                        robustness suite results, and current regime classification. It will never "invent a strategy and trade immediately."
                    </p>
                </Panel>
            </div >
        </div >
    );
}
