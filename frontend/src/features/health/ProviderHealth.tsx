// Bloomberg Palette
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

import React, { useState, useEffect, useCallback } from 'react';

interface ProviderStatus {
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'rate_limited';
    last_update: string;
    message?: string;
    retry_in_seconds?: number;
    requests_remaining?: number;
    requests_limit?: number;
}

const API_BASE = '/api/v1';

const statusColor = (s: string) => s === 'connected' ? GREEN : s === 'rate_limited' ? AMBER : RED;
const statusLabel = (s: string) => s.replace('_', ' ').toUpperCase();

const MOCK: ProviderStatus[] = [
    { name: 'Finnhub WebSocket', status: 'connected', last_update: new Date().toISOString(), requests_remaining: 45, requests_limit: 60 },
    { name: 'Alpaca Trading', status: 'connected', last_update: new Date().toISOString() },
    { name: 'Alpaca Data', status: 'connected', last_update: new Date().toISOString(), requests_remaining: 180, requests_limit: 200 },
    { name: 'Yahoo Finance', status: 'connected', last_update: new Date(Date.now() - 60000).toISOString() },
    { name: 'Polygon.io', status: 'rate_limited', last_update: new Date(Date.now() - 30000).toISOString(), retry_in_seconds: 12, requests_remaining: 0, requests_limit: 100 },
    { name: 'Alpha Vantage', status: 'disconnected', last_update: new Date(Date.now() - 120000).toISOString(), message: 'API key invalid' },
];

export function ProviderHealth() {
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/health/providers`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setProviders(data);
        } catch {
            setProviders(MOCK);
        }
        setLastUpdate(new Date());
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const formatTime = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 10000) return 'NOW';
        if (diff < 60000) return `${Math.floor(diff / 1000)}s AGO`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m AGO`;
        return `${Math.floor(diff / 3600000)}h AGO`;
    };

    const allConnected = providers.every(p => p.status === 'connected');
    const hasIssues = providers.some(p => p.status !== 'connected');
    const issueCount = providers.filter(p => p.status !== 'connected').length;
    const overallColor = allConnected ? GREEN : hasIssues ? AMBER : RED;

    return (
        <div style={{ position: 'absolute', top: 50, right: 420, zIndex: 50, fontFamily: MONO }}>
            <button
                onClick={() => setIsOpen(o => !o)}
                onMouseEnter={e => (e.currentTarget.style.background = overallColor + '33')}
                onMouseLeave={e => (e.currentTarget.style.background = overallColor + '22')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: overallColor + '22', border: `1px solid ${overallColor}44`, color: overallColor, borderRadius: 3, cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}
            >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: overallColor, display: 'inline-block', boxShadow: allConnected ? `0 0 4px ${GREEN}` : 'none' }} />
                HEALTH
                {issueCount > 0 && <span style={{ background: RED, color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>{issueCount}</span>}
            </button>

            {isOpen && (
                <div style={{ position: 'absolute', right: 0, marginTop: 4, width: 320, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    {/* Header */}
                    <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>PH</span>
                            <span style={{ color: SUBTLE, fontSize: 9 }}>|</span>
                            <span style={{ fontSize: 9, color: TEXT }}>PROVIDER HEALTH</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 8, color: SUBTLE }}>{lastUpdate.toLocaleTimeString()}</span>
                            <button onClick={fetchStatus} style={{ fontSize: 9, background: 'transparent', border: `1px solid ${BORDER}`, color: SUBTLE, borderRadius: 2, padding: '1px 6px', cursor: 'pointer' }}>âŸ³</button>
                            <button onClick={() => setIsOpen(false)} onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 12 }}>âœ•</button>
                        </div>
                    </div>

                    {/* Summary row */}
                    <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12 }}>
                        {[
                            { label: 'CONN', val: providers.filter(p => p.status === 'connected').length, color: GREEN },
                            { label: 'LIMIT', val: providers.filter(p => p.status === 'rate_limited').length, color: AMBER },
                            { label: 'DOWN', val: providers.filter(p => ['disconnected', 'error'].includes(p.status)).length, color: RED },
                        ].map(({ label, val, color }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 8, color: SUBTLE }}>{label}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color }}>{val}</span>
                            </div>
                        ))}
                        <span style={{ fontSize: 8, color: SUBTLE, marginLeft: 'auto' }}>
                            {allConnected ? 'â— ALL SYSTEMS OK' : `âš  ${issueCount} ISSUE(S)`}
                        </span>
                    </div>

                    {/* Provider list */}
                    <div>
                        {providers.map((p, i) => {
                            const color = statusColor(p.status);
                            const ratePct = p.requests_remaining != null && p.requests_limit ? (p.requests_remaining / p.requests_limit) * 100 : null;
                            return (
                                <div key={i} style={{ padding: '8px 14px', borderBottom: i < providers.length - 1 ? `1px solid ${BORDER}18` : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ratePct != null ? 5 : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                            <span style={{ fontSize: 10, color: TEXT }}>{p.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: color + '22', color }}>{statusLabel(p.status)}</span>
                                            <span style={{ fontSize: 8, color: SUBTLE }}>{formatTime(p.last_update)}</span>
                                        </div>
                                    </div>
                                    {ratePct != null && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <span style={{ fontSize: 8, color: SUBTLE }}>RATE LIMIT</span>
                                                <span style={{ fontSize: 8, fontFamily: MONO, color: ratePct < 20 ? RED : ratePct < 50 ? AMBER : GREEN }}>{p.requests_remaining}/{p.requests_limit}</span>
                                            </div>
                                            <div style={{ height: 3, background: BORDER, borderRadius: 2 }}>
                                                <div style={{ width: `${ratePct}%`, height: '100%', background: ratePct < 20 ? RED : ratePct < 50 ? AMBER : GREEN, borderRadius: 2 }} />
                                            </div>
                                        </div>
                                    )}
                                    {p.retry_in_seconds && (
                                        <div style={{ fontSize: 8, color: AMBER, marginTop: 3 }}>â± RETRY IN {p.retry_in_seconds}s</div>
                                    )}
                                    {p.message && (
                                        <div style={{ fontSize: 8, color: RED, marginTop: 3 }}>âš  {p.message}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '5px 14px', borderTop: `1px solid ${BORDER}`, fontSize: 8, color: SUBTLE, display: 'flex', justifyContent: 'space-between' }}>
                        <span>AUTO-REFRESH 10s</span>
                        <span>{providers.length} PROVIDERS</span>
                    </div>
                </div>
            )}
        </div>
    );
}
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'rate_limited';
    last_update: string;
    message?: string;
    retry_in_seconds?: number;
    requests_remaining?: number;
    requests_limit?: number;
}
