// Bloomberg RC — Replay Controls Terminal Bar
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useStore } from '../../state/store.ts';
import { useEffect } from 'react';
import React from 'react';

export const ReplayControls = () => {
    const { replayState, fetchClockState, setReplayMode, controlReplay, setReplaySpeed, stepReplay } = useStore();

    useEffect(() => {
        fetchClockState();
        const interval = setInterval(fetchClockState, 1000);
        return () => clearInterval(interval);
    }, [fetchClockState]);

    if (!replayState) return null;

    const isVirtual = replayState.mode === 'virtual';
    const isRunning = replayState.running && !replayState.frozen;

    const safeMs = replayState.current_time_ms && replayState.current_time_ms > 0 ? replayState.current_time_ms : Date.now();
    const ts = new Intl.DateTimeFormat('en-US', {
        hour:'2-digit', minute:'2-digit', second:'2-digit',
        hour12:false, timeZone:'America/New_York',
    }).format(new Date(safeMs));

    const btnStyle = (color: string, disabled = false): React.CSSProperties => ({
        background:'transparent', border:`1px solid ${color}`, color, fontFamily:MONO,
        fontSize:10, padding:'2px 8px', cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius:2, opacity: disabled ? 0.4 : 1, minWidth:28,
    });

    return (
        <div data-testid="replay-controls"
            style={{
                position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
                background:PANEL, border:`1px solid ${BORDER}`, borderRadius:3,
                boxShadow:'0 4px 16px rgba(0,0,0,0.6)',
                padding:'4px 8px', display:'flex', alignItems:'center', gap:6, zIndex:50,
                fontFamily:MONO, fontSize:11,
            }}
        >
            {/* Mode badge */}
            <div style={{ display:'flex', alignItems:'center', gap:4, borderRight:`1px solid ${BORDER}`, paddingRight:8 }}>
                <span style={{ color: isVirtual ? BLUE : SUBTLE, fontWeight:700, letterSpacing:1, fontSize:9 }}>
                    {isVirtual ? '⏪ REPLAY' : '● LIVE'}
                </span>
                <button onClick={() => setReplayMode(!isVirtual)}
                    style={{ background: isVirtual ? '#1a2a40' : AMBER, border:`1px solid ${isVirtual ? BLUE : AMBER}`, color: isVirtual ? BLUE : BG, fontFamily:MONO, fontSize:9, padding:'2px 6px', cursor:'pointer', borderRadius:2 }}>
                    {isVirtual ? 'EXIT' : 'ENTER'}
                </button>
            </div>

            {isVirtual && (
                <>
                    {/* Step */}
                    <button onClick={() => stepReplay()} style={btnStyle(TEXT)} title="Step forward">
                        ⏭
                    </button>

                    {/* Play/Pause */}
                    {isRunning ? (
                        <button data-testid="replay-pause-btn" onClick={() => controlReplay('freeze')} style={btnStyle(AMBER)} title="Pause">
                            ⏸
                        </button>
                    ) : (
                        <button data-testid="replay-play-btn" onClick={() => controlReplay('start')} style={btnStyle(GREEN)} title="Play">
                            ▶
                        </button>
                    )}

                    {/* Stop */}
                    <button onClick={() => controlReplay('stop')} style={btnStyle(RED)} title="Stop">
                        ■
                    </button>

                    {/* Speed */}
                    <select
                        data-testid="replay-speed-select"
                        value={replayState.speed_multiplier}
                        onChange={(e) => setReplaySpeed(Number(e.target.value))}
                        style={{ background:BG, color:TEXT, border:`1px solid ${BORDER}`, fontFamily:MONO, fontSize:9, padding:'2px 4px', outline:'none', cursor:'pointer' }}
                    >
                        {[['1','1×'],['2','2×'],['5','5×'],['10','10×'],['60','60×'],['3600','MAX']].map(([v,l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>

                    {/* Status dot */}
                    <div style={{ width:6, height:6, borderRadius:'50%', background: isRunning ? GREEN : SUBTLE }} title={isRunning ? 'Running' : 'Paused'} />
                </>
            )}

            {/* Timestamp */}
            <div data-testid="replay-timestamp"
                style={{ color: isVirtual ? AMBER : SUBTLE, fontFamily:MONO, fontSize:9, borderLeft:`1px solid ${BORDER}`, paddingLeft:8 }}>
                {ts} EST
            </div>
        </div>
    );
};
