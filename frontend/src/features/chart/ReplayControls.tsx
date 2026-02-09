import { Play, Pause, Square, SkipForward } from 'lucide-react';
import { useStore } from '../../state/store.ts';
import { useEffect } from 'react';

export const ReplayControls = () => {
    const { replayState, fetchClockState, setReplayMode, controlReplay, setReplaySpeed, stepReplay } = useStore();

    useEffect(() => {
        fetchClockState();
        const interval = setInterval(fetchClockState, 1000); // Poll state
        return () => clearInterval(interval);
    }, [fetchClockState]);

    if (!replayState) return null;

    const isVirtual = replayState.mode === 'virtual';
    const isRunning = replayState.running && !replayState.frozen;

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-lg p-2 flex items-center space-x-2 z-50">
            <div className="flex items-center space-x-1 border-r border-[#2a2e39] pr-2">
                <span className={`text-xs font-bold ${isVirtual ? 'text-blue-500' : 'text-gray-500'}`}>
                    {isVirtual ? 'REPLAY' : 'LIVE'}
                </span>
                <button
                    onClick={() => setReplayMode(!isVirtual)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition"
                >
                    {isVirtual ? 'Exit' : 'Enter'}
                </button>
            </div>

            {isVirtual && (
                <>
                    <button onClick={() => stepReplay()} className="p-1 hover:bg-[#2a2e39] rounded text-gray-300" title="Step">
                        <SkipForward size={16} />
                    </button>

                    {isRunning ? (
                        <button onClick={() => controlReplay('freeze')} className="p-1 hover:bg-[#2a2e39] rounded text-yellow-500" title="Pause">
                            <Pause size={16} />
                        </button>
                    ) : (
                        <button onClick={() => controlReplay('start')} className="p-1 hover:bg-[#2a2e39] rounded text-green-500" title="Play">
                            <Play size={16} />
                        </button>
                    )}

                    <button onClick={() => controlReplay('stop')} className="p-1 hover:bg-[#2a2e39] rounded text-red-500" title="Stop">
                        <Square size={16} />
                    </button>

                    <select
                        value={replayState.speed_multiplier}
                        onChange={(e) => setReplaySpeed(Number(e.target.value))}
                        className="bg-[#2a2e39] text-gray-300 text-xs rounded px-1 py-1 outline-none"
                    >
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                        <option value="10">10x</option>
                        <option value="60">60x</option>
                        <option value="3600">Max</option>
                    </select>
                </>
            )}

            <div className="text-xs text-gray-500 ml-2">
                {new Intl.DateTimeFormat('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: 'America/New_York'
                }).format(new Date(replayState.current_time_ms))} EST
            </div>
        </div>
    );
};
