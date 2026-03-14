/**
 * ApexAreaChart — lightweight-charts v5 area series component
 *
 * Simple area chart with the terminal's dark theme.
 * Designed for equity curve overlays (DashboardUI2) and similar
 * single-value time-series panels.
 *
 * Props:
 *   data   – Array<{ time: number (unix seconds); value: number }>
 *   color  – Optional line / fill colour (defaults to #2962FF brand blue)
 */
import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  AreaSeries,
  CrosshairMode,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  AreaData,
} from 'lightweight-charts';

/* ── Terminal dark-theme palette ─────────────────────────────────── */
const C = {
  bg:          '#0a0a0a',
  grid:        '#1a1a1a',
  text:        '#8b949e',
  crosshair:   '#444',
  lineColor:   '#2962FF',
  topColor:    'rgba(41,98,255,0.25)',
  bottomColor: 'rgba(41,98,255,0.0)',
  border:      '#1a1a1a',
  labelBg:     '#1a1a1a',
} as const;

/* ── Public types ────────────────────────────────────────────────── */

export interface AreaPoint {
  /** Unix timestamp in seconds (or milliseconds — normalised internally). */
  time:  number;
  value: number;
}

export interface ApexAreaChartProps {
  /** Time-series data to render. */
  data: AreaPoint[];
  /**
   * Optional line / fill accent colour.
   * Defaults to the terminal's brand blue (#2962FF).
   */
  color?: string;
}

/* ── Helper ──────────────────────────────────────────────────────── */

function toUTC(t: number): UTCTimestamp {
  return (t > 1e11 ? Math.floor(t / 1000) : Math.floor(t)) as UTCTimestamp;
}

/* ── Component ───────────────────────────────────────────────────── */

export default function ApexAreaChart({ data, color }: ApexAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi            | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Area'>   | null>(null);

  /* ── Create chart once on mount ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const lineColor   = color ?? C.lineColor;
    const topColor    = color ? `${color}40`   : C.topColor;
    const bottomColor = color ? `${color}00`   : C.bottomColor;

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
        borderColor: C.border,
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
    });

    chartRef.current  = chart;
    seriesRef.current = areaSeries;

    return () => {
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []); /* create chart once */

  /* ── Push data whenever the `data` prop changes ── */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || data.length === 0) return;

    /* Sort ascending + deduplicate */
    const sorted = [...data]
      .sort((a, b) => a.time - b.time)
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

    const areaData: AreaData[] = sorted.map(d => ({
      time:  toUTC(d.time),
      value: d.value,
    }));

    try {
      series.setData(areaData);
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.warn('[ApexAreaChart] setData failed:', err);
    }
  }, [data]);

  return (
    <div
      data-testid="apex-area-chart"
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    />
  );
}
