// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 300];

import React, { useState } from 'react';
import { useAppStore } from '../../state/appStore';

export function ReplayControlBar() {
  const {
    isReplayPlaying,
    setReplayPlaying,
    replaySpeed,
    setReplaySpeed,
    setMode,
    replayTime,
    marketTime,
  } = useAppStore();

  const [speedOpen, setSpeedOpen] = useState(false);
  const [hovSpeed, setHovSpeed] = useState<number | null>(null);

  const formatTime = (ms: number | null) => {
    if (!ms) return '--:--:--';
    return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
  };

  const formatDate = (ms: number | null) => {
    if (!ms) return '-- --- ----';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  const replayPct = replayTime && marketTime ? Math.min((replayTime / marketTime) * 100, 100) : 33;

  return (
    <div
      data-testid="replay-control-bar"
      style={{
        height: 48, background: PANEL, borderTop: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', padding: '0 16px',
        justifyContent: 'space-between', fontFamily: MONO, color: TEXT,
        userSelect: 'none',
      }}
    >
      {/* Left: Playback controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: AMBER, letterSpacing: 2, marginRight: 4 }}>REPLAY</span>

        {/* Play/Pause */}
        <button
          data-testid={isReplayPlaying ? 'replay-pause-btn' : 'replay-play-btn'}
          onClick={() => setReplayPlaying(!isReplayPlaying)}
          style={{
            width: 28, height: 28, background: isReplayPlaying ? AMBER + '22' : GREEN + '22',
            border: `1px solid ${isReplayPlaying ? AMBER : GREEN}`,
            borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: isReplayPlaying ? AMBER : GREEN, transition: 'all 0.1s',
          }}
        >
          {isReplayPlaying ? 'â¸' : 'â–¶'}
        </button>

        {/* Step forward */}
        <button
          style={{ width: 24, height: 24, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 4, cursor: 'pointer', color: SUBTLE, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Step Forward (Arrow Right)"
        >â­</button>

        {/* Step back */}
        <button
          style={{ width: 24, height: 24, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 4, cursor: 'pointer', color: SUBTLE, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Step Back (Arrow Left)"
        >â®</button>

        <div style={{ width: 1, height: 16, background: BORDER, margin: '0 4px' }} />

        {/* Speed selector */}
        <div style={{ position: 'relative' }}>
          <button
            data-testid="replay-speed-btn"
            onClick={() => setSpeedOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              background: speedOpen ? BLUE + '22' : 'transparent',
              border: `1px solid ${speedOpen ? BLUE : BORDER}`, borderRadius: 3,
              color: speedOpen ? BLUE : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
            }}
          >
            {replaySpeed}x <span style={{ fontSize: 9 }}>â–¼</span>
          </button>
          {speedOpen && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, width: 80, zIndex: 200,
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
            }}>
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => { setReplaySpeed(s); setSpeedOpen(false); }}
                  onMouseEnter={() => setHovSpeed(s)}
                  onMouseLeave={() => setHovSpeed(null)}
                  style={{
                    width: '100%', padding: '5px 10px', textAlign: 'left', fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                    background: replaySpeed === s ? BLUE + '22' : hovSpeed === s ? '#1a1a1a' : 'transparent',
                    color: replaySpeed === s ? BLUE : TEXT, border: 'none',
                    borderLeft: `2px solid ${replaySpeed === s ? BLUE : 'transparent'}`,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Scrubber */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div data-testid="replay-date" style={{ fontSize: 11, fontFamily: MONO, color: TEXT, letterSpacing: 1 }}>{formatDate(replayTime)}</div>
          <div data-testid="replay-time" style={{ fontSize: 10, color: AMBER, fontFamily: MONO }}>{formatTime(replayTime)}</div>
        </div>

        <div style={{ flex: 1, maxWidth: 400 }}>
          <div
            data-testid="replay-scrubber"
            style={{ height: 6, background: '#1a1a1a', borderRadius: 3, position: 'relative', cursor: 'pointer', border: `1px solid ${BORDER}` }}
          >
            <div style={{ width: `${replayPct}%`, height: '100%', background: `linear-gradient(to right, ${AMBER}88, ${AMBER})`, borderRadius: 3 }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${replayPct}%`, transform: 'translate(-50%, -50%)',
              width: 10, height: 10, background: AMBER, borderRadius: '50%', boxShadow: `0 0 6px ${AMBER}`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: SUBTLE }}>START</span>
            <span style={{ fontSize: 9, color: SUBTLE }}>LIVE: {formatTime(marketTime)}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>LIVE CLOCK</div>
          <div style={{ fontSize: 11, fontFamily: MONO, color: GREEN }}>{formatTime(marketTime)}</div>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 9, color: SUBTLE }}>
          <span style={{ color: isReplayPlaying ? GREEN : AMBER }}>{isReplayPlaying ? 'â— PLAYING' : 'â¸ PAUSED'}</span>
        </div>
        <button
          onClick={() => setMode('PAPER' as Parameters<typeof setMode>[0])}
          style={{
            padding: '4px 12px', background: 'transparent', border: `1px solid ${ORANGE}`,
            borderRadius: 3, color: ORANGE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1,
          }}
        >
          GO LIVE
        </button>
      </div>
    </div>
  );
}
