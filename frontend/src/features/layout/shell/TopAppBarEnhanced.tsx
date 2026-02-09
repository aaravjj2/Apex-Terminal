/**
 * Enhanced Top App Bar
 * 
 * Always visible with:
 * - PAPER MODE banner
 * - Broker info (Alpaca account)
 * - Autopilot toggle + kill switch
 * - Last cycle status + next scheduled run
 * - Health chips for all providers
 * - Global search
 * - Notifications bell
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Clock, Bell, Search, Power, Pause, Play, AlertTriangle,
    CheckCircle2, XCircle, Activity, X, Loader2, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { cn } from '../../../ui/utils';

import { useStore } from '../../../state/store';
import { VoiceControl } from '../../tts/VoiceControl';
import { DataSourceSelector } from '../../data/DataSourceSelector';
import type { DataSourceId } from '../../data/providers';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

// Types
interface AutopilotStatus {
    state: 'idle' | 'running' | 'paused' | 'error';
    mode: 'paper' | 'paused';
    kill_switch_active: boolean;
    last_cycle?: {
        success: boolean;
        timestamp: string;
        trades_placed: number;
        error?: string;
    };
    next_run?: string;
    schedule: {
        enabled: boolean;
        interval_minutes: number;
        market_hours_only: boolean;
    };
}

interface HealthStatus {
    provider: string;
    status: 'connected' | 'degraded' | 'disconnected' | 'error';
    latency_ms?: number;
    last_check?: string;
    error?: string;
}

interface AccountInfo {
    broker: string;
    account_id: string;
    label?: string;
}

interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
}

export function TopAppBarEnhanced() {
    const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
    const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus>>({});
    const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [marketTime, setMarketTime] = useState(new Date());
    const [wsReconnecting, setWsReconnecting] = useState(false);
    const [dataSource, setDataSource] = useState<DataSourceId>('fixture');

    // WebSocket state from store
    const wsState = useStore(state => state.wsState);
    const forceReconnect = useStore(state => state.forceReconnect);

    // Handle WS reconnect
    const handleWsReconnect = async () => {
        setWsReconnecting(true);
        try {
            forceReconnect();
            // Give it a moment to reconnect
            await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
            setWsReconnecting(false);
        }
    };

    // Get WS status color and icon
    const getWsStatusColor = () => {
        switch (wsState) {
            case 'CONNECTED': return 'bg-green-500';
            case 'CONNECTING': return 'bg-yellow-500';
            case 'DEGRADED': return 'bg-yellow-500';
            case 'DISCONNECTED': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getWsStatusIcon = () => {
        switch (wsState) {
            case 'CONNECTED': return <Wifi size={14} className="text-green-400" />;
            case 'CONNECTING': return <Loader2 size={14} className="text-yellow-400 animate-spin" />;
            case 'DEGRADED': return <Wifi size={14} className="text-yellow-400" />;
            case 'DISCONNECTED': return <WifiOff size={14} className="text-red-400" />;
            default: return <WifiOff size={14} className="text-gray-400" />;
        }
    };

    // Fetch autopilot status
    const fetchAutopilotStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/status`);
            if (res.ok) {
                const data = await res.json();
                setAutopilotStatus({
                    state: data.state || 'idle',
                    mode: data.mode || 'paper',
                    kill_switch_active: data.kill_switch_active || false,
                    last_cycle: data.last_cycle,
                    next_run: data.next_run,
                    schedule: data.schedule || { enabled: true, interval_minutes: 15, market_hours_only: true }
                });
            }
        } catch (err) {
            console.error('Failed to fetch autopilot status:', err);
        }
    }, []);

    // Fetch health statuses
    const fetchHealthStatuses = useCallback(async () => {
        const _providers = ['alpaca_rest', 'alpaca_stream', 'finnhub', 'yfinance', 'groq', 'gemini'];
        void _providers; // List of providers we'll check
        const statuses: Record<string, HealthStatus> = {};

        // Fetch from backend health endpoint
        try {
            const res = await fetch(`${API_BASE}/autopilot/broker/metrics`);
            if (res.ok) {
                const data = await res.json();
                statuses['alpaca_rest'] = {
                    provider: 'Alpaca REST',
                    status: data.connected ? 'connected' : 'disconnected',
                    latency_ms: data.avg_latency_ms
                };
            }
        } catch {
            statuses['alpaca_rest'] = { provider: 'Alpaca REST', status: 'disconnected' };
        }

        // Check websocket via autopilot status
        if (autopilotStatus) {
            statuses['alpaca_stream'] = {
                provider: 'Alpaca Stream',
                status: autopilotStatus.state === 'running' ? 'connected' : 'degraded'
            };
        }

        // Check other providers via health endpoint
        try {
            const res = await fetch('http://127.0.0.1:8000/health');
            if (res.ok) {
                statuses['finnhub'] = { provider: 'Finnhub', status: 'connected' };
                statuses['yfinance'] = { provider: 'yfinance', status: 'connected' };
            }
        } catch {
            statuses['finnhub'] = { provider: 'Finnhub', status: 'disconnected' };
            statuses['yfinance'] = { provider: 'yfinance', status: 'disconnected' };
        }

        // LLM providers (check via config)
        try {
            const res = await fetch(`${API_BASE}/autopilot/config`);
            if (res.ok) {
                const data = await res.json();
                const llmEnabled = data.config?.llm_settings?.enabled;
                statuses['groq'] = { provider: 'Groq', status: llmEnabled ? 'connected' : 'disconnected' };
                statuses['gemini'] = { provider: 'Gemini', status: llmEnabled ? 'connected' : 'disconnected' };
            }
        } catch {
            statuses['groq'] = { provider: 'Groq', status: 'disconnected' };
            statuses['gemini'] = { provider: 'Gemini', status: 'disconnected' };
        }

        setHealthStatuses(statuses);
    }, [autopilotStatus]);

    // Fetch account info
    const fetchAccountInfo = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/broker/metrics`);
            if (res.ok) {
                const data = await res.json();
                setAccountInfo({
                    broker: 'Alpaca',
                    account_id: data.account_id || 'PAPER-XXXX',
                    label: 'Paper Trading'
                });
            }
        } catch {
            setAccountInfo({
                broker: 'Alpaca',
                account_id: 'PAPER-XXXX',
                label: 'Paper Trading'
            });
        }
    }, []);

    // Fetch notifications (from activity log)
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/autopilot/logs?limit=20`);
            if (res.ok) {
                const data = await res.json();
                const notifs: Notification[] = (data.logs || []).slice(0, 10).map((log: any, idx: number) => ({
                    id: `notif-${idx}`,
                    type: log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'info',
                    title: log.event_type || 'Event',
                    message: log.message || JSON.stringify(log.data || {}),
                    timestamp: log.timestamp,
                    read: false
                }));
                setNotifications(notifs);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    }, []);

    // Toggle autopilot
    const toggleAutopilot = async () => {
        setLoading(true);
        try {
            const endpoint = autopilotStatus?.state === 'paused' ? 'resume' : 'pause';
            await fetch(`${API_BASE}/autopilot/${endpoint}`, { method: 'POST' });
            await fetchAutopilotStatus();
        } catch (err) {
            console.error('Failed to toggle autopilot:', err);
        }
        setLoading(false);
    };

    // Activate kill switch
    const activateKillSwitch = async () => {
        if (!confirm('Activate kill switch? This will pause autopilot and cancel open orders.')) return;
        setLoading(true);
        try {
            await fetch(`${API_BASE}/autopilot/kill_switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activate: true, close_all: false })
            });
            await fetchAutopilotStatus();
        } catch (err) {
            console.error('Failed to activate kill switch:', err);
        }
        setLoading(false);
    };

    // Market time update
    useEffect(() => {
        const interval = setInterval(() => setMarketTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchAutopilotStatus();
        fetchAccountInfo();
        fetchNotifications();
    }, [fetchAutopilotStatus, fetchAccountInfo, fetchNotifications]);

    // Health status polling
    useEffect(() => {
        fetchHealthStatuses();
        const interval = setInterval(fetchHealthStatuses, 60000); // Poll every 60s to reduce backend load
        return () => clearInterval(interval);
    }, [fetchHealthStatuses]);

    // Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'bg-green-500';
            case 'degraded': return 'bg-yellow-500';
            case 'disconnected': return 'bg-gray-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    // Get cycle status
    const getCycleStatus = () => {
        if (!autopilotStatus?.last_cycle) return null;
        const { success, timestamp, error } = autopilotStatus.last_cycle;
        return {
            status: success ? 'success' : error ? 'failed' : 'warning',
            time: new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        };
    };

    const cycleStatus = getCycleStatus();
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <header className="h-auto bg-panel-bg border-b border-border shrink-0 z-header" data-testid="top-app-bar">
            {/* PAPER MODE Banner */}
            <div className="h-8 bg-amber-500/90 text-black flex items-center justify-center gap-2 text-sm font-bold" data-testid="topbar-paper-mode-banner">
                <AlertTriangle size={16} />
                PAPER MODE — All trades are simulated
                <AlertTriangle size={16} />
            </div>

            {/* Main Bar */}
            <div className="h-12 flex items-center px-4 justify-between">
                {/* Left: Logo + Broker + Autopilot */}
                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand/10 rounded flex items-center justify-center text-brand font-bold text-sm">
                            T
                        </div>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Broker Info */}
                    <div className="flex items-center gap-2 text-xs" data-testid="broker-info">
                        <span className="text-text-secondary">Broker:</span>
                        <span className="font-medium text-text">
                            {accountInfo?.broker || 'Alpaca'}
                        </span>
                        <span className="text-text-muted">
                            ({accountInfo?.label} •••{accountInfo?.account_id?.slice(-4) || 'XXXX'})
                        </span>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Autopilot Toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleAutopilot}
                            disabled={loading || autopilotStatus?.kill_switch_active}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                autopilotStatus?.state === 'running'
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : autopilotStatus?.state === 'paused'
                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                        : "bg-element-bg text-text-secondary border border-border"
                            )}
                            data-testid="autopilot-toggle"
                        >
                            {loading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : autopilotStatus?.state === 'running' ? (
                                <Play size={14} />
                            ) : (
                                <Pause size={14} />
                            )}
                            <span>Autopilot</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] uppercase",
                                autopilotStatus?.state === 'running' ? "bg-green-500/30" : "bg-gray-500/30"
                            )}>
                                {autopilotStatus?.state === 'running' ? 'ON' : 'OFF'}
                            </span>
                        </button>

                        {/* Kill Switch */}
                        <button
                            onClick={activateKillSwitch}
                            disabled={loading || autopilotStatus?.kill_switch_active}
                            className={cn(
                                "p-1.5 rounded-lg transition-all",
                                autopilotStatus?.kill_switch_active
                                    ? "bg-red-500/30 text-red-400"
                                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            )}
                            title="Kill Switch - Emergency Stop"
                            data-testid="kill-switch"
                        >
                            <Power size={16} />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    {/* Last Cycle Status */}
                    {cycleStatus && (
                        <div
                            className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded text-xs",
                                cycleStatus.status === 'success' ? "bg-green-500/10 text-green-400" :
                                    cycleStatus.status === 'failed' ? "bg-red-500/10 text-red-400" :
                                        "bg-yellow-500/10 text-yellow-400"
                            )}
                            data-testid="last-cycle-status"
                        >
                            {cycleStatus.status === 'success' ? <CheckCircle2 size={12} /> :
                                cycleStatus.status === 'failed' ? <XCircle size={12} /> :
                                    <AlertTriangle size={12} />}
                            <span>Last: {cycleStatus.status}</span>
                            <span className="text-text-muted">{cycleStatus.time}</span>
                        </div>
                    )}

                    {/* Next Run */}
                    {autopilotStatus?.next_run && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary" data-testid="next-run">
                            <Clock size={12} />
                            <span>Next: {new Date(autopilotStatus.next_run).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                </div>

                {/* Right: Health + Search + Clock + Notifications */}
                <div className="flex items-center gap-3">
                    {/* Voice Control */}
                    <VoiceControl />

                    {/* Health Chips */}
                    <div className="flex items-center gap-2" data-testid="health-chips">
                        {Object.entries(healthStatuses).slice(0, 6).map(([key, health]) => (
                            <div
                                key={key}
                                className="flex items-center gap-1.5 text-[10px]"
                                title={`${health.provider}: ${health.status}${health.latency_ms ? ` (${health.latency_ms}ms)` : ''}`}
                            >
                                <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(health.status))} />
                                <span className="text-text-secondary hidden xl:inline">{health.provider}</span>
                            </div>
                        ))}
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* WebSocket Status Pill */}
                    <div className="flex items-center gap-2">
                        <div
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                                wsState === 'CONNECTED' ? "bg-green-500/10 text-green-400" :
                                    wsState === 'CONNECTING' ? "bg-yellow-500/10 text-yellow-400" :
                                        wsState === 'DEGRADED' ? "bg-yellow-500/10 text-yellow-400" :
                                            "bg-red-500/10 text-red-400"
                            )}
                            data-testid="ws-status-pill"
                            data-ws-status={wsState}
                        >
                            <div className={cn("w-2 h-2 rounded-full", getWsStatusColor())} />
                            {getWsStatusIcon()}
                            <span className="hidden lg:inline">{wsState}</span>
                        </div>

                        {/* WebSocket Reconnect Button */}
                        <button
                            onClick={handleWsReconnect}
                            disabled={wsReconnecting || wsState === 'CONNECTING'}
                            className={cn(
                                "p-1.5 rounded hover:bg-element-bg transition-colors disabled:opacity-50",
                                wsReconnecting && "animate-pulse"
                            )}
                            title="Force WebSocket Reconnect"
                            data-testid="ws-reconnect-btn"
                        >
                            <RefreshCw
                                size={14}
                                className={cn(
                                    "text-text-secondary",
                                    wsReconnecting && "animate-spin"
                                )}
                            />
                        </button>
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Data Source Selector */}
                    <DataSourceSelector value={dataSource} onChange={setDataSource} />

                    <div className="h-4 w-px bg-border" />

                    {/* Global Search */}
                    <div className="relative">
                        <button
                            onClick={() => setSearchOpen(!searchOpen)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-element-bg hover:bg-border transition-colors text-xs text-text-secondary"
                            data-testid="global-search-btn"
                        >
                            <Search size={14} />
                            <span className="hidden md:inline">Search</span>
                            <kbd className="hidden md:inline text-[10px] px-1 py-0.5 rounded bg-panel-bg text-text-muted">/</kbd>
                        </button>

                        {searchOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-panel-bg border border-border rounded-lg shadow-lg p-2 z-dropdown">
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-element-bg rounded">
                                    <Search size={14} className="text-text-secondary" />
                                    <input
                                        type="text"
                                        placeholder="Search symbol, order ID, run ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1 bg-transparent text-sm text-text outline-none"
                                        autoFocus
                                    />
                                    <button onClick={() => setSearchOpen(false)}>
                                        <X size={14} className="text-text-secondary" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Market Clock */}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
                        <Clock size={12} />
                        <span>{formatTime(marketTime)} ET</span>
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setNotificationsOpen(!notificationsOpen)}
                            className="relative p-1.5 rounded hover:bg-element-bg transition-colors"
                            data-testid="notifications-btn"
                        >
                            <Bell size={18} className="text-text-secondary" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {notificationsOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-panel-bg border border-border rounded-lg shadow-lg overflow-hidden z-dropdown">
                                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                                    <span className="text-sm font-medium text-text">Notifications</span>
                                    <span className="text-xs text-text-secondary">{unreadCount} unread</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-4 text-center text-text-secondary text-sm">No notifications</div>
                                    ) : (
                                        notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                className={cn(
                                                    "px-3 py-2 border-b border-border hover:bg-element-bg transition-colors cursor-pointer",
                                                    !notif.read && "bg-brand/5"
                                                )}
                                            >
                                                <div className="flex items-start gap-2">
                                                    {notif.type === 'error' ? <XCircle size={14} className="text-red-400 mt-0.5" /> :
                                                        notif.type === 'warning' ? <AlertTriangle size={14} className="text-yellow-400 mt-0.5" /> :
                                                            notif.type === 'success' ? <CheckCircle2 size={14} className="text-green-400 mt-0.5" /> :
                                                                <Activity size={14} className="text-blue-400 mt-0.5" />}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-text truncate">{notif.title}</div>
                                                        <div className="text-[10px] text-text-secondary truncate">{notif.message}</div>
                                                    </div>
                                                    <span className="text-[10px] text-text-muted">
                                                        {new Date(notif.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
