/**
 * MultiChartLayout.tsx — Multi-pane chart grid (1, 2×1, 2×2, 2×3)
 * =================================================================
 * Renders a grid of AdvancedChartEngine instances with shared timeframe.
 * Each pane has its own symbol; layout selector for 1, 2×1, 2×2, 2×3 panes.
 */

import { useState } from 'react';
import { AdvancedChartEngine, type Timeframe } from './AdvancedChartEngine';

export type LayoutType = 1 | 2 | 4 | 6;

export interface MultiChartLayoutProps {
  layout?: LayoutType;
  symbols?: string[];
  timeframe?: Timeframe;
  defaultSymbols?: string[];
}

const LAYOUTS: { value: LayoutType; label: string; grid: string }[] = [
  { value: 1, label: '1', grid: '1fr' },
  { value: 2, label: '2×1', grid: '1fr 1fr' },
  { value: 4, label: '2×2', grid: '1fr 1fr / 1fr 1fr' },
  { value: 6, label: '2×3', grid: '1fr 1fr 1fr / 1fr 1fr' },
];

const DEFAULT_SYMBOLS = ['AAPL', 'SPY', 'TSLA', 'QQQ', 'NVDA', 'META'];

export function MultiChartLayout({
  layout: initialLayout = 1,
  symbols: initialSymbols,
  timeframe: initialTf = '1D',
  defaultSymbols = DEFAULT_SYMBOLS,
}: MultiChartLayoutProps) {
  const [layout, setLayout] = useState<LayoutType>(initialLayout);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTf);
  const [symbols, setSymbols] = useState<string[]>(
    initialSymbols ?? defaultSymbols.slice(0, 6)
  );

  const paneCount = layout;
  const paneSymbols = symbols.slice(0, paneCount);
  // Pad with defaults if needed
  const resolvedSymbols = paneSymbols.length >= paneCount
    ? paneSymbols
    : [...paneSymbols, ...defaultSymbols.filter(s => !paneSymbols.includes(s))].slice(0, paneCount);

  const gridStyle =
    layout === 1
      ? { display: 'grid' as const, gridTemplateRows: '1fr', gridTemplateColumns: '1fr', flex: 1, minHeight: 0 }
      : layout === 2
      ? { display: 'grid' as const, gridTemplateRows: '1fr 1fr', gridTemplateColumns: '1fr', flex: 1, minHeight: 0 }
      : layout === 4
      ? { display: 'grid' as const, gridTemplateRows: '1fr 1fr', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0 }
      : { display: 'grid' as const, gridTemplateRows: '1fr 1fr', gridTemplateColumns: '1fr 1fr 1fr', flex: 1, minHeight: 0 };

  return (
    <div
      data-testid="multi-chart-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0a0a',
        color: '#d1d4dc',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: '#555', letterSpacing: '0.05em' }}>
          LAYOUT
        </span>
        {LAYOUTS.map(l => (
          <button
            key={l.value}
            onClick={() => setLayout(l.value)}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              borderRadius: 3,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
              fontWeight: layout === l.value ? 700 : 400,
              background: layout === l.value ? '#2a1800' : 'transparent',
              color: layout === l.value ? '#f5a623' : '#666',
            }}
          >
            {l.label}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: '#2a2a2a', margin: '0 4px' }} />
        <span style={{ fontSize: 11, color: '#555' }}>TIMEFRAME</span>
        {(['1m', '5m', '15m', '1h', '1D', '1W'] as Timeframe[]).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              padding: '3px 6px',
              fontSize: 11,
              borderRadius: 3,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
              fontWeight: timeframe === tf ? 700 : 400,
              background: timeframe === tf ? '#2a1800' : 'transparent',
              color: timeframe === tf ? '#f5a623' : '#666',
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart grid */}
      <div style={gridStyle}>
        {resolvedSymbols.map((sym, i) => (
          <div
            key={`${sym}-${i}`}
            style={{
              minHeight: 0,
              borderRight: i % (layout === 2 ? 1 : layout === 4 ? 2 : 3) !== (layout === 2 ? 1 : layout === 4 ? 1 : 2) ? '1px solid #1e1e1e' : undefined,
              borderBottom: layout > 1 && i < (layout === 2 ? 1 : layout === 4 ? 2 : 2) * (layout === 2 ? 1 : layout === 4 ? 2 : 3) ? '1px solid #1e1e1e' : undefined,
            }}
          >
            <AdvancedChartEngine
              symbol={sym}
              timeframe={timeframe}
              height={layout === 1 ? 500 : 240}
              theme="bloomberg"
              className="multi-chart-pane"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default MultiChartLayout;
