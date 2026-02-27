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

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '1D', '1W', '1M'];
const CHART_TYPES = ['CANDLE', 'LINE', 'BAR', 'AREA', 'HEIKIN'];
const EXCHANGE_COLORS: Record<string, string> = { NASDAQ: BLUE, NYSE: GREEN, CBOE: AMBER, CRYPTO: SUBTLE };

import React, { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { useStore } from '../../state/store';
import { SymbolSearchModal } from './SymbolSearchModal';
import { IndicatorsModal } from './IndicatorsModal';

export function ChartHeaderStrip() {
  const { symbol, setSymbol, timeframe, setTimeframe, mode } = useAppStore();
  const { activeIndicators, setSymbol: setStoreSymbol } = useStore();
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [chartType, setChartType] = useState('CANDLE');
  const [showChartTypes, setShowChartTypes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div style={{
      height: 40, background: PANEL, borderBottom: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
      fontFamily: MONO, flexShrink: 0,
    }}>
      {/* Symbol selector */}
      <button
        onClick={() => setIsSymbolSearchOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
          background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3,
          cursor: 'pointer', transition: 'all 0.1s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.borderColor = AMBER; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}
      >
        <span data-testid="chart-symbol-display" style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 1 }}>{symbol}</span>
        <span style={{ fontSize: 9, color: SUBTLE }}>NASDAQ</span>
        <span style={{ fontSize: 9, color: SUBTLE }}>â–¼</span>
      </button>

      <div style={{ width: 1, height: 16, background: BORDER }} />

      {/* Timeframes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {TIMEFRAMES.map(tf => {
          const active = tf === timeframe;
          return (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '2px 5px', background: active ? BLUE + '22' : 'transparent',
                border: `1px solid ${active ? BLUE : 'transparent'}`, borderRadius: 2,
                color: active ? BLUE : SUBTLE, fontFamily: MONO, fontSize: 10,
                cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = TEXT; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = SUBTLE; }}
            >
              {tf}
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 16, background: BORDER }} />

      {/* Chart type */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowChartTypes(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px',
            background: showChartTypes ? AMBER + '22' : 'transparent',
            border: `1px solid ${showChartTypes ? AMBER : BORDER}`, borderRadius: 3,
            color: showChartTypes ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer',
          }}
        >
          {chartType} <span style={{ fontSize: 8 }}>â–¼</span>
        </button>
        {showChartTypes && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
            background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.7)', overflow: 'hidden',
          }}>
            {CHART_TYPES.map(ct => (
              <button
                key={ct}
                onClick={() => { setChartType(ct); setShowChartTypes(false); }}
                style={{
                  display: 'block', width: '100%', padding: '5px 12px', textAlign: 'left',
                  fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1,
                  background: chartType === ct ? AMBER + '22' : 'transparent',
                  color: chartType === ct ? AMBER : TEXT, border: 'none',
                  borderLeft: `2px solid ${chartType === ct ? AMBER : 'transparent'}`,
                }}
              >
                {ct}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 16, background: BORDER }} />

      {/* Indicators */}
      <button
        onClick={() => setIsIndicatorsOpen(true)}
        data-testid="indicators-btn"
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
          background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3,
          color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = SUBTLE; }}
      >
        âŒ INDICATORS
        {activeIndicators.length > 0 && (
          <span
            data-testid="indicator-count-badge"
            style={{ background: BLUE + '33', border: `1px solid ${BLUE}55`, borderRadius: 8, padding: '0 4px', fontSize: 9, color: BLUE }}
          >
            {activeIndicators.length}
          </span>
        )}
      </button>

      <div style={{ flex: 1 }} />

      {/* Chart controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[
          { icon: 'âŠž', title: 'Layout' },
          { icon: 'â›¶', title: 'Fullscreen', onClick: () => setFullscreen(f => !f) },
        ].map(({ icon, title, onClick }) => (
          <button
            key={title}
            title={title}
            onClick={onClick}
            style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, width: 24, height: 24, color: SUBTLE, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = SUBTLE; }}
          >
            {icon}
          </button>
        ))}
      </div>

      {mode === 'REPLAY' && (
        <>
          <div style={{ width: 1, height: 16, background: BORDER }} />
          <span style={{ fontSize: 9, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}44`, borderRadius: 8, padding: '1px 8px', letterSpacing: 1 }}>âª REPLAY</span>
        </>
      )}

      <SymbolSearchModal
        open={isSymbolSearchOpen}
        onClose={() => setIsSymbolSearchOpen(false)}
        onSelect={(newSymbol) => { setSymbol(newSymbol); setStoreSymbol(newSymbol); }}
      />
      <IndicatorsModal open={isIndicatorsOpen} onClose={() => setIsIndicatorsOpen(false)} />
    </div>
  );
}

