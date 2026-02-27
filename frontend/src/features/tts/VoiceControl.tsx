// Bloomberg VC — Voice Control
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useEffect, useState } from 'react';
import React from 'react';
import { audioQueue } from './AudioQueue';

interface TTSStatus {
  enabled: boolean;
  voice_id: string | null;
}

export const VoiceControl = () => {
  const [_enabled, _setEnabled] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [status, setStatus] = useState<TTSStatus | null>(null);

  useEffect(() => {
    fetch('/api/v1/tts/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data);
        if (data.enabled) {
          const saved = localStorage.getItem('tts_volume');
          if (saved) setVolume(parseFloat(saved));
        }
      })
      .catch(e => console.error('TTS status check failed', e));
  }, []);

  useEffect(() => {
    audioQueue.setVolume(muted ? 0 : volume);
    localStorage.setItem('tts_volume', volume.toString());
  }, [volume, muted]);

  if (!status?.enabled) return null;

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'2px 10px', background:PANEL, border:`1px solid ${BORDER}`,
      borderRadius:2, fontFamily:MONO,
    }}>
      <button data-testid="voice-toggle-btn"
        onClick={() => setMuted(!muted)}
        title={muted ? 'Enable Voice' : 'Mute Voice'}
        style={{
          background:'none', border:'none', cursor:'pointer',
          color: muted ? SUBTLE : GREEN,
          fontSize:9, fontWeight:700, fontFamily:MONO, letterSpacing:0.5,
        }}>
        {muted ? '■ VOICE OFF' : '♪ VOICE ON'}
      </button>

      {!muted && (
        <input type="range" min="0" max="1" step="0.1"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          data-testid="voice-volume-slider"
          style={{
            width:56, height:3, accentColor:GREEN,
            cursor:'pointer', verticalAlign:'middle',
          }}
        />
      )}
    </div>
  );
};
