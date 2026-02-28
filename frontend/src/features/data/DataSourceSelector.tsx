// Bloomberg palette
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

const LABELS: Record<string, string> = {
  fixture: 'DEMO FIXTURES',
  'cached-yahoo': 'CACHED YAHOO',
  yahoo: 'YAHOO FINANCE',
  alpaca: 'ALPACA LIVE',
  polygon: 'POLYGON.IO',
};

const STATUS_COLORS: Record<string, string> = {
  fixture: AMBER, 'cached-yahoo': BLUE, yahoo: GREEN, alpaca: GREEN, polygon: GREEN,
};

const DESCRIPTIONS: Record<string, string> = {
  fixture: 'Pre-loaded demo market data for offline use',
  'cached-yahoo': 'Locally cached Yahoo Finance snapshots',
  yahoo: 'Live Yahoo Finance REST API (requires network)',
  alpaca: 'Alpaca Markets live data feed',
  polygon: 'Polygon.io real-time data warehouse',
};

import React, { useState, useRef, useEffect } from 'react';
import type { DataSourceId } from './providers';
import { getAvailableProviders } from './providers';

interface DataSourceSelectorProps {
  value: DataSourceId;
  onChange: (id: DataSourceId) => void;
  className?: string;
}

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const providers = getAvailableProviders();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = LABELS[value] ?? value.toUpperCase();
  const col = STATUS_COLORS[value] ?? SUBTLE;

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: MONO }} data-testid="data-source-selector">
      <button
        data-testid="data-source-trigger"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', background: open ? col + '22' : PANEL,
          border: `1px solid ${open ? col : BORDER}`, borderRadius: 3,
          color: open ? col : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 8, color: col }}>â—</span>
        {label}
        <span style={{ fontSize: 9, color: SUBTLE }}>{open ? 'â–²' : 'â–¼'}</span>
      </button>

      {open && (
        <div
          data-testid="data-source-dropdown"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 240, zIndex: 200,
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}
        >
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 9, color: SUBTLE, letterSpacing: 2 }}>DATA SOURCE</div>
          {providers.map(p => {
            const id = p.id as DataSourceId;
            const isActive = id === value;
            const pCol = STATUS_COLORS[p.id] ?? SUBTLE;
            const desc = DESCRIPTIONS[p.id] ?? (p as { description?: string }).description ?? '';
            return (
              <div
                key={p.id}
                data-testid={`data-source-option-${p.id}`}
                onClick={() => { onChange(id); setOpen(false); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                  background: isActive ? pCol + '11' : 'transparent',
                  borderBottom: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${isActive ? pCol : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#181818'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 10, color: pCol, marginTop: 2 }}>â—‰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: isActive ? pCol : TEXT, fontWeight: isActive ? 700 : 400, fontFamily: MONO, letterSpacing: 1 }}>
                    {LABELS[p.id] ?? p.name.toUpperCase()}
                    {isActive && <span style={{ marginLeft: 6, color: GREEN, fontSize: 10 }}>âœ“</span>}
                  </div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
                  {(p as { requiresNetwork?: boolean }).requiresNetwork && (
                    <span style={{ fontSize: 8, color: AMBER, marginTop: 3, display: 'block', letterSpacing: 1 }}>âš  REQUIRES NETWORK</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


export default DataSourceSelector;
