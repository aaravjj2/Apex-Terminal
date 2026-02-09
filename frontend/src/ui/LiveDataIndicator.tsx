import { useEffect, useState } from 'react';

export const LiveDataIndicator = () => {
    const [mode, setMode] = useState<'live'|'mock'|'unknown'>('unknown');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/api/v1/debug/config');
                if (!res.ok) return;
                const cfg = await res.json();
                if (!mounted) return;
                setMode(cfg.ingestion_mode === 'live' ? 'live' : (cfg.ingestion_mode === 'mock' ? 'mock' : 'unknown'));
            } catch (e) {
                setMode('unknown');
            }
        })();
        return () => { mounted = false; };
    }, []);

    const color = mode === 'live' ? 'bg-emerald-500' : (mode === 'mock' ? 'bg-amber-400' : 'bg-gray-400');
    const text = mode === 'live' ? 'Live Data' : (mode === 'mock' ? 'Mock Data' : 'No Backend');

    return (
        <div className={`flex items-center gap-2 px-2 py-1 rounded ${color} text-white text-xs font-medium`} title={`Data mode: ${mode}`}>
            <span className="w-2 h-2 rounded-full bg-white/80" />
            <span>{text}</span>
        </div>
    );
};
