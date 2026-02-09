import { Clock, ChevronDown, Radio } from 'lucide-react';
import { ModeBadge } from '../../../ui/ModeBadge';
import { Button } from '../../../ui/Button';
import { StatusIndicator, type ConnectionStatus } from '../../../ui/StatusIndicator';
import { useAppStore, type ProviderName } from '../../../state/appStore';
import { useStore } from '../../../state/store';

function DataFeedStatus() {
    const { wsState, reconnectAttempts } = useStore();

    let label = 'Data Feed';
    if (wsState === 'CONNECTING' && reconnectAttempts > 0) {
        label = `Reconnecting (${reconnectAttempts})`;
    } else if (wsState === 'DISCONNECTED' && reconnectAttempts > 0) {
        // Show attempts even if disconnected (waiting to retry)
        label = `Offline (${reconnectAttempts})`;
    }

    return (
        <StatusIndicator
            status={wsState === 'CONNECTING' ? 'connecting' : (wsState === 'CONNECTED' ? 'connected' : (wsState === 'DEGRADED' ? 'degraded' : 'disconnected'))}
            label={label}
            size="sm"
        />
    );
}

export function TopBar() {
    const { mode, symbol, timeframe, providers, marketTime, replayTime, isReplayPlaying, setReplayPlaying } = useAppStore();

    // Format time display
    const displayTime = mode === 'REPLAY' && replayTime
        ? new Date(replayTime).toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' })
        : new Date(marketTime).toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' });

    const displayDate = mode === 'REPLAY' && replayTime
        ? new Date(replayTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    // Map provider status
    const getProviderStatus = (name: ProviderName): ConnectionStatus => {
        const p = providers[name];
        if (p.status === 'rate_limited') return 'degraded';
        return p.status;
    };

    // Primary action based on mode
    const getPrimaryAction = () => {
        switch (mode) {
            case 'REPLAY':
                return (
                    <Button
                        size="sm"
                        variant={isReplayPlaying ? 'secondary' : 'primary'}
                        onClick={() => setReplayPlaying(!isReplayPlaying)}
                        className="gap-2"
                    >
                        <Radio size={14} className={isReplayPlaying ? 'animate-pulse' : ''} />
                        {isReplayPlaying ? 'Pause' : 'Play'}
                    </Button>
                );
            case 'BACKTEST':
                return (
                    <Button size="sm" variant="primary" className="gap-2">
                        Run Backtest
                    </Button>
                );
            default:
                return (
                    <Button size="sm" variant="primary" className="gap-2" data-testid="start-strategy-btn">
                        Start Strategy
                    </Button>
                );
        }
    };

    return (
        <header className="h-14 bg-panel-bg border-b border-border flex items-center px-4 justify-between shrink-0 z-header">
            {/* Left: Logo + Mode + Symbol */}
            <div className="flex items-center gap-4">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand/10 rounded flex items-center justify-center text-brand font-bold text-sm">
                        T
                    </div>
                </div>

                <div className="h-6 w-px bg-border" />

                {/* Mode Badge */}
                <ModeBadge mode={mode} />

                <div className="h-6 w-px bg-border" />

                {/* Symbol + Timeframe */}
                <button className="flex items-center gap-2 hover:bg-element-bg px-2 py-1.5 rounded transition-colors group">
                    <span className="font-semibold text-text group-hover:text-white">{symbol}</span>
                    <span className="text-xs text-text-secondary px-1.5 py-0.5 bg-element-bg rounded">{timeframe}</span>
                    <ChevronDown size={14} className="text-text-secondary" />
                </button>
            </div>

            {/* Center: Replay info (when in replay) */}
            {mode === 'REPLAY' && displayDate && (
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm">
                    <span className="text-replay font-medium">{displayDate}</span>
                    <span className="text-text-secondary">•</span>
                    <span className="font-mono text-text">{displayTime}</span>
                </div>
            )}

            {/* Right: Providers + Clock + Actions */}
            <div className="flex items-center gap-3">
                {/* Provider Status */}
                <div className="flex items-center gap-3 text-xs">
                    <StatusIndicator
                        status={getProviderStatus('finnhub')}
                        label="Finnhub"
                        size="sm"
                    />
                    <StatusIndicator
                        status={getProviderStatus('alpaca')}
                        label="Alpaca"
                        size="sm"
                    />
                    <StatusIndicator
                        status={getProviderStatus('yahoo')}
                        label="Yahoo"
                        size="sm"
                    />
                </div>

                <div className="h-4 w-px bg-border" />

                {/* Data Feed Status */}
                <DataFeedStatus />

                <div className="h-4 w-px bg-border" />

                {/* Rate Limit Countdown */}
                <div className="flex items-center gap-1 text-[10px] text-text-secondary font-mono">
                    <span className="w-1 h-1 rounded-full bg-green-500/50" />
                    <span>298/300</span>
                </div>

                <div className="h-6 w-px bg-border" />

                {/* Market Clock */}
                {mode !== 'REPLAY' && (
                    <>
                        <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
                            <Clock size={14} />
                            <span>{displayTime} EST</span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                    </>
                )}

                {/* Primary Action */}
                {getPrimaryAction()}
            </div>
        </header>
    );
}
