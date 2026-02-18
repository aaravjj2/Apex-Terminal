export interface ClockState {
    mode: 'live' | 'virtual';
    current_time_ms: number;
    frozen: boolean;
    speed_multiplier: number;
    running: boolean;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1/clock';

export const ClockClient = {
    async getState(): Promise<ClockState> {
        const res = await fetch(`${API_BASE}/`);
        if (!res.ok) throw new Error('Failed to fetch clock state');
        return res.json();
    },

    async setMode(mode: 'live' | 'virtual', startTimeMs?: number): Promise<void> {
        const res = await fetch(`${API_BASE}/mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, start_time_ms: startTimeMs })
        });
        if (!res.ok) throw new Error('Failed to set mode');
    },

    async control(action: 'freeze' | 'resume' | 'start' | 'stop'): Promise<void> {
        const res = await fetch(`${API_BASE}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        if (!res.ok) throw new Error(`Failed to ${action} clock`);
    },

    async advance(deltaMs: number): Promise<void> {
        const res = await fetch(`${API_BASE}/advance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta_ms: deltaMs })
        });
        if (!res.ok) throw new Error('Failed to advance clock');
    },

    async setSpeed(multiplier: number): Promise<void> {
        const res = await fetch(`${API_BASE}/speed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ multiplier })
        });
        if (!res.ok) throw new Error('Failed to set speed');
    }
};
