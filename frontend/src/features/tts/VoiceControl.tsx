
import { useEffect, useState } from 'react';
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

    // Initial Status Check
    useEffect(() => {
        fetch('http://localhost:8090/api/v1/tts/status')
            .then(res => res.json())
            .then(data => {
                setStatus(data);
                if (data.enabled) {
                    // Load saved preferences if any
                    const savedVol = localStorage.getItem('tts_volume');
                    if (savedVol) setVolume(parseFloat(savedVol));
                }
            })
            .catch(err => console.error("TTS status check failed", err));
    }, []);

    // Volume Sync
    useEffect(() => {
        audioQueue.setVolume(muted ? 0 : volume);
        localStorage.setItem('tts_volume', volume.toString());
    }, [volume, muted]);

    if (!status?.enabled) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-panel-bg-lighter rounded border border-border">
            <button
                onClick={() => setMuted(!muted)}
                className={`text-xs font-bold ${muted ? 'text-gray-400' : 'text-accent-primary'}`}
                title={muted ? "Enable Voice" : "Mute Voice"}
                data-testid="voice-toggle-btn"
            >
                {muted ? "VOICE OFF" : "VOICE ON"}
            </button>

            {!muted && (
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    data-testid="voice-volume-slider"
                />
            )}
        </div>
    );
};
