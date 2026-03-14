/**
 * ApexChart — lightweight-charts v5 OHLCV candlestick + volume component
 *
 * v5 API:
 *   chart.addSeries(CandlestickSeries, options)          → main pane (0)
 *   chart.addSeries(HistogramSeries, options, 1)         → volume pane (1)
 *
 * Features:
 *   • Fetches OHLCV bars from /api/v1/bars on mount / symbol change
 *   • Dark terminal theme (#0a0a0a bg, #1a1a1a grid)
 *   • CrosshairMode.Normal with dashed crosshair lines
 *   • Proper time axis with timeVisible: true
 *   • Volume in a separate pane with per-bar color
 *   • auto-resize via autoSize: true (ResizeObserver)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickData,
  HistogramData,
} from 'lightweight-charts';

/* ── Terminal dark-theme palette ─────────────────────────────────── */
const C = {
  bg:          '#0a0a0a',
  grid:        '#1a1a1a',
  text:        '#8b949e',
  crosshair:   '#444',
  upColor:     '#26a641',
  downColor:   '#da3633',
  volUp:       'rgba(38,166,65,0.4)',
  volDown:     'rgba(218,54,51,0.4)',
  border:      '#1a1a1a',
  labelBg:     '#1a1a1a',
} as const;

/* ── Panel header style ──────────────────────────────────────────── */
const pHdr: React.CSSProperties = {
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'space-between',
  padding:         '6px 10px',
  borderBottom:    `1px solid ${C.border}`,
  fontSize:        '10px',
  fontWeight:       700,
  textTransform:   'uppercase',
  letterSpacing:   '0.8px',
  color:           '#787B86',
  fontFamily:      "'Inter','Segoe UI',system-ui,sans-serif",
  flexShrink:       0,
  background:      C.bg,
};

/* ── Public types ────────────────────────────────────────────────── */

/** Single OHLCV bar as returned by /api/v1/bars */
export interface OHLCVBar {
  time:   number;  // Unix timestamp in seconds (or ms — normalised internally)
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface ApexChartProps {
  /** Ticker symbol (e.g. "AAPL"). Triggers a fresh fetch on change. */
  symbol: string;
  /**
   * Pre-fetched bars. When non-empty the component skips the API fetch
   * and renders this data directly. Pass `[]` to always fetch from API.
   */
  bars?: OHLCVBar[];
  /** Explicit pixel height. Omit to fill the parent flex container. */
  height?: number;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Normalise a raw timestamp to UTCTimestamp (seconds). */
function toUTC(t: number): UTCTimestamp {
  // milliseconds (> ~year 5000 in seconds) → convert
  return (t > 1e11 ? Math.floor(t / 1000) : Math.floor(t)) as UTCTimestamp;
}

/* ── Component ───────────────────────────────────────────────────── */

export default function ApexChart({ symbol, bars: propBars = [], height }: ApexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef       = useRef<ISeriesApi<'Histogram'>   | null>(null);

  const [bars,       setBars]       = useState<OHLCVBar[]>(propBars);
  const [loading,    setLoading]    = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── Fetch bars from API when symbol changes ── */
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setFetchError(null);

    fetch(
      `/api/v1/bars?symbol=${encodeURIComponent(symbol.toUpperCase())}&timeframe=1Day&limit=200`,
    )
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ bars?: OHLCVBar[] }>;
      })
      .then(d => {
        if (d.bars && d.bars.length > 0) setBars(d.bars);
        setLoading(false);
      })
      .catch(err => {
        setFetchError(String(err));
        setLoading(false);
      });
  }, [symbol]);

  /* ── Create chart once on mount ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor:   C.text,
        fontFamily:  "'JetBrains Mono','Fira Code',monospace",
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      crosshair: {
        mode:     CrosshairMode.Normal,
        vertLine: { color: C.crosshair, width: 1, style: 3, labelBackgroundColor: C.labelBg },
        horzLine: { color: C.crosshair, width: 1, style: 3, labelBackgroundColor: C.labelBg },
      },
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        borderColor:    C.border,
        rightOffset:    5,
      },
      rightPriceScale: {
        borderColor:   C.border,
        scaleMargins:  { top: 0.05, bottom: 0.2 },
      },
    });

    /* Candlestick series — main pane (index 0) */
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:        C.upColor,
      downColor:      C.downColor,
      borderUpColor:  C.upColor,
      borderDownColor: C.downColor,
      wickUpColor:    C.upColor,
      wickDownColor:  C.downColor,
    });

    /* Volume histogram — separate pane (index 1) */
    const volSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: 'volume' } },
      1,
    );

    chartRef.current  = chart;
    candleRef.current = candleSeries;
    volRef.current    = volSeries;

    return () => {
      chart.remove();
      chartRef.current  = null;
      candleRef.current = null;
      volRef.current    = null;
    };
  }, []); /* create chart once — never recreate */

  /* ── Push data into series whenever bars change ── */
  useEffect(() => {
    const candle = candleRef.current;
    const vol    = volRef.current;
    if (!candle || !vol || bars.length === 0) return;

    /* Sort ascending + deduplicate by time */
    const sorted = [...bars]
      .sort((a, b) => a.time - b.time)
      .filter((b, i, arr) => i === 0 || b.time !== arr[i - 1].time);

    const candleData: CandlestickData[] = sorted.map(b => ({
      time:  toUTC(b.time),
      open:  b.open,
      high:  b.high,
      low:   b.low,
      close: b.close,
    }));

    const volData: HistogramData[] = sorted.map(b => ({
      time:  toUTC(b.time),
      value: b.volume,
      color: b.close >= b.open ? C.volUp : C.volDown,
    }));

    try {
      candle.setData(candleData);
      vol.setData(volData);
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.warn('[ApexChart] setData failed:', err);
    }
  }, [bars]);

  /* ── Render ── */
  return (
    <div
      data-testid="trading-chart-container"
      style={{
        display:        'flex',
        flexDirection:  'column',
        flex:            1,
        width:          '100%',
        height:          height != null ? `${height}px` : '100%',
        background:      C.bg,
        border:         `1px solid ${C.border}`,
        borderRadius:   '4px',
        overflow:       'hidden',
      }}
    >
      {/* Panel header */}
      <div style={pHdr}>
        <span>{symbol} · CANDLESTICK · 1D</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {loading && (
            <span style={{ color: C.text, fontSize: '9px', fontFamily: "'JetBrains Mono',monospace" }}>
              Loading…
            </span>
          )}
          {fetchError && (
            <span style={{ color: C.downColor, fontSize: '9px' }}>
              {fetchError}
            </span>
          )}
        </div>
      </div>
      {/* Chart fills remaining space */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
