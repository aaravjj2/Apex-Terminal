// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { INDICATOR_REGISTRY } from './IndicatorRegistry';

const PARAM_COLORS: Record<string, string> = {
  period: BLUE, fast: GREEN, slow: AMBER, signal: PURPLE,
  length: BLUE, source: SUBTLE, color: AMBER,
};

export function IndicatorDock() {
  const { activeIndicators, removeIndicator } = useStore();
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (activeIndicators.length === 0) {
    return (
      <div data-testid="indicator-dock-empty" style={{ padding: 24, textAlign: 'center', fontFamily: MONO }}>
        <div style={{ fontSize: 24, color: SUBTLE, marginBottom: 8 }}>â—«</div>
        <p data-testid="no-indicators-msg" style={{ fontSize: 11, color: SUBTLE, margin: 0 }}>No indicators added</p>
        <p style={{ fontSize: 10, color: '#3a3a3a', marginTop: 6 }}>Use the Indicators button in the chart header</p>
      </div>
    );
  }

  const totalParams = activeIndicators.reduce((s, i) => s + Object.keys(i.params).length, 0);

  return (
    <div style={{ padding: '6px 0', fontFamily: MONO }}>
      {/* Summary bar */}
      <div style={{ padding: '4px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>ACTIVE</div>
          <div style={{ fontSize: 12, color: AMBER }}>{activeIndicators.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>PARAMS</div>
          <div style={{ fontSize: 12, color: BLUE }}>{totalParams}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>HIDDEN</div>
          <div style={{ fontSize: 12, color: hidden.size > 0 ? RED : SUBTLE }}>{hidden.size}</div>
        </div>
      </div>

      {activeIndicators.map(ind => {
        const config = INDICATOR_REGISTRY[ind.type];
        if (!config) return null;

        const isHov = hovered === ind.id;
        const isExpanded = expanded === ind.id;
        const isHidden = hidden.has(ind.id);
        const visibleParams = Object.entries(ind.params).filter(([k, v]) => k !== 'color' && typeof v !== 'boolean');

        return (
          <div
            key={ind.id}
            data-testid={`active-indicator-${ind.type}`}
            style={{
              margin: '3px 8px', borderRadius: 4,
              background: isHov ? '#161616' : PANEL,
              border: `1px solid ${isHov ? AMBER + '44' : BORDER}`,
              borderLeft: `3px solid ${ind.color || AMBER}`,
              opacity: isHidden ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={() => setHovered(ind.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', cursor: 'pointer' }} onClick={() => setExpanded(prev => prev === ind.id ? null : ind.id)}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ind.color || AMBER, flexShrink: 0, marginRight: 8 }} />
              <span style={{ fontSize: 11, color: TEXT, fontWeight: 600 }}>{config.shortName}</span>
              {ind.period && <span style={{ fontSize: 10, color: SUBTLE, marginLeft: 4 }}>({ind.period})</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button
                  onClick={e => { e.stopPropagation(); setHidden(prev => { const n = new Set(prev); n.has(ind.id) ? n.delete(ind.id) : n.add(ind.id); return n; }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHidden ? RED : SUBTLE, fontSize: 12, padding: '0 2px' }}
                  title={isHidden ? 'Show' : 'Hide'}
                >
                  {isHidden ? 'â—¯' : 'â—'}
                </button>
                <button
                  data-testid={`remove-indicator-${ind.type}`}
                  onClick={e => { e.stopPropagation(); removeIndicator(ind.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHov ? RED : SUBTLE, fontSize: 12, padding: '0 2px' }}
                  title="Remove"
                >
                  âœ•
                </button>
              </div>
            </div>

            {/* Params summary (collapsed) */}
            {!isExpanded && visibleParams.length > 0 && (
              <div style={{ padding: '0 10px 7px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {visibleParams.map(([key, value]) => (
                  <span key={key} style={{ fontSize: 9, color: SUBTLE }}>
                    {key}: <span style={{ color: PARAM_COLORS[key] || TEXT, fontFamily: MONO }}>{String(value)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Expanded params */}
            {isExpanded && (
              <div style={{ padding: '4px 10px 8px', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>PARAMETERS</div>
                {visibleParams.map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                    <span style={{ color: SUBTLE, textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ color: PARAM_COLORS[key] || TEXT, fontFamily: MONO }}>{String(value)}</span>
                  </div>
                ))}
                {ind.color && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                    <span style={{ color: SUBTLE }}>color</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: ind.color, border: `1px solid ${BORDER}` }} />
                      <span style={{ color: TEXT, fontFamily: MONO, fontSize: 10 }}>{ind.color}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


