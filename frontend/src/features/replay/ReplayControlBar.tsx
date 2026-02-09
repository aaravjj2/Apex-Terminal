import { Play, Pause, SkipForward, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { useAppStore } from '../../state/appStore';
import { cn } from '../../ui/utils';

export function ReplayControlBar() {
    const {
        isReplayPlaying,
        setReplayPlaying,
        replaySpeed,
        setReplaySpeed,
        setMode,
        replayTime,
        marketTime
    } = useAppStore();

    const speeds = [0.1, 0.5, 1, 2, 5, 10, 60, 300];

    const formatTime = (ms: number | null) => {
        if (!ms) return '--:--';
        return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
    };

    const formatDate = (ms: number | null) => {
        if (!ms) return '---';
        return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="h-12 bg-panel-bg border-t border-border flex items-center px-4 justify-between shrink-0">
            {/* Left: Playback Controls */}
            <div className="flex items-center gap-2">
                <IconButton
                    icon={<Play className={cn("fill-current", isReplayPlaying && "hidden")} size={20} />}
                    onClick={() => setReplayPlaying(true)}
                    isActive={isReplayPlaying}
                    tooltip="Play (Space)"
                    className={cn(isReplayPlaying && "hidden")}
                />
                <IconButton
                    icon={<Pause className={cn("fill-current", !isReplayPlaying && "hidden")} size={20} />}
                    onClick={() => setReplayPlaying(false)}
                    isActive={!isReplayPlaying}
                    tooltip="Pause (Space)"
                    className={cn(!isReplayPlaying && "hidden")}
                />

                <div className="h-4 w-px bg-border mx-1" />

                <IconButton icon={<SkipForward size={18} />} tooltip="Step Forward (Right Arrow)" />

                {/* Speed Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text px-2 py-1 rounded hover:bg-element-bg transition-colors">
                        <span>{replaySpeed}x</span>
                        <ChevronDown size={12} />
                    </button>
                    {/* Simplified dropdown for now - would usually use a proper Dropdown component */}
                    <div className="absolute bottom-full left-0 mb-1 w-20 bg-element-bg border border-border rounded shadow-lg hidden group-hover:block z-dropdown">
                        {speeds.map(s => (
                            <button
                                key={s}
                                onClick={() => setReplaySpeed(s)}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs hover:bg-background transition-colors",
                                    replaySpeed === s ? "text-brand font-bold" : "text-text"
                                )}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Center: Scrubber / Timeline */}
            <div className="flex-1 flex items-center justify-center gap-4 px-8">
                <div className="flex flex-col items-center">
                    <div className="text-xs font-mono text-text">{formatDate(replayTime)}</div>
                    <div className="text-xxs text-text-secondary">{formatTime(replayTime)}</div>
                </div>

                {/* Fake progress bar for now */}
                <div className="flex-1 h-1.5 bg-element-bg rounded-full overflow-hidden relative group cursor-pointer">
                    <div className="absolute inset-y-0 left-0 bg-replay w-1/3" />
                    <div className="absolute inset-y-0 left-1/3 w-2 h-2 -ml-1 top-1/2 -translate-y-1/2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
                </div>

                <div className="text-xxs font-mono text-text-secondary w-16 text-right">
                    Live: {formatTime(marketTime)}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-replay hover:text-replay hover:bg-replay-bg border border-transparent hover:border-replay"
                    onClick={() => {
                        setMode('PAPER');
                        // In reality this would jump to live
                    }}
                >
                    Go to Realtime
                </Button>
            </div>
        </div>
    );
}
