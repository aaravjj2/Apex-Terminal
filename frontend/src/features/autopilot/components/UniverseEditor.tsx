/**
 * Universe Editor - V1 Autopilot
 * 
 * The ONLY required user control for v1 autonomous operation.
 * Allows editing the symbol universe that autopilot scans.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../config/api';

interface UniverseEditorProps {
    onClose?: () => void;
}

// Default v1 universe
const DEFAULT_UNIVERSE = ['AAPL', 'SPY', 'QQQ', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'META'];

export const UniverseEditor: React.FC<UniverseEditorProps> = ({ onClose }) => {
    const [symbols, setSymbols] = useState<string[]>(DEFAULT_UNIVERSE);
    const [newSymbol, setNewSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // Load current universe from backend
    useEffect(() => {
        const loadUniverse = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/autopilot/config`);
                if (res.ok) {
                    const config = await res.json();
                    if (config.universe && config.universe.length > 0) {
                        setSymbols(config.universe);
                    }
                }
            } catch (err) {
                console.error('Failed to load universe:', err);
            }
        };
        loadUniverse();
    }, []);

    const addSymbol = useCallback(() => {
        const sym = newSymbol.toUpperCase().trim();
        if (sym && !symbols.includes(sym)) {
            setSymbols([...symbols, sym]);
            setNewSymbol('');
            setSaved(false);
        }
    }, [newSymbol, symbols]);

    const removeSymbol = useCallback((sym: string) => {
        setSymbols(symbols.filter(s => s !== sym));
        setSaved(false);
    }, [symbols]);

    const saveUniverse = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/autopilot/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ universe: symbols }),
            });
            if (!res.ok) {
                throw new Error('Failed to save universe');
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setLoading(false);
        }
    }, [symbols]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addSymbol();
        }
    };

    return (
        <div
            style={{
                background: 'var(--bg-secondary, #1a1a2e)',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid var(--border-color, #333)',
            }}
            data-testid="universe-editor"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)', fontSize: '14px' }}>
                    🌎 Universe Editor
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary, #888)',
                            cursor: 'pointer',
                            fontSize: '16px',
                        }}
                        data-testid="universe-editor-close"
                    >
                        ✕
                    </button>
                )}
            </div>

            <p style={{ color: 'var(--text-secondary, #888)', fontSize: '12px', margin: '0 0 12px 0' }}>
                Autopilot scans these symbols for trade opportunities.
            </p>

            {/* Current symbols */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px',
                }}
                data-testid="universe-symbols"
            >
                {symbols.map(sym => (
                    <span
                        key={sym}
                        style={{
                            background: 'var(--bg-tertiary, #2a2a4a)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: 'var(--text-primary, #fff)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                        data-testid={`universe-symbol-${sym}`}
                    >
                        {sym}
                        <button
                            onClick={() => removeSymbol(sym)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-danger, #ff6b6b)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                padding: '0',
                            }}
                            title={`Remove ${sym}`}
                            data-testid={`remove-${sym}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            {/* Add new symbol */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                    type="text"
                    value={newSymbol}
                    onChange={e => setNewSymbol(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add symbol..."
                    style={{
                        flex: 1,
                        background: 'var(--bg-tertiary, #2a2a4a)',
                        border: '1px solid var(--border-color, #444)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        color: 'var(--text-primary, #fff)',
                        fontSize: '12px',
                    }}
                    data-testid="universe-add-input"
                />
                <button
                    onClick={addSymbol}
                    disabled={!newSymbol.trim()}
                    style={{
                        background: 'var(--accent-color, #4a9fff)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: newSymbol.trim() ? 'pointer' : 'not-allowed',
                        opacity: newSymbol.trim() ? 1 : 0.5,
                    }}
                    data-testid="universe-add-btn"
                >
                    Add
                </button>
            </div>

            {/* Save button */}
            <button
                onClick={saveUniverse}
                disabled={loading}
                style={{
                    width: '100%',
                    background: saved
                        ? 'var(--success-color, #4caf50)'
                        : 'var(--accent-color, #4a9fff)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '10px 16px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: loading ? 'wait' : 'pointer',
                }}
                data-testid="universe-save-btn"
            >
                {loading ? 'Saving...' : saved ? '✓ Saved' : `Save Universe (${symbols.length} symbols)`}
            </button>

            {error && (
                <p style={{ color: 'var(--text-danger, #ff6b6b)', fontSize: '12px', marginTop: '8px' }}>
                    {error}
                </p>
            )}
        </div>
    );
};

export default UniverseEditor;
