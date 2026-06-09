/**
 * OHLCVChart — lightweight-charts v5 (canvas only, zero SVG).
 *
 * Renders 512 daily bars, Kronos point forecast (dashed), SPCI band shading.
 */
import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';

export interface OHLCVBarInput {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OHLCVChartProps {
  bars: OHLCVBarInput[];
  predictedReturnPct?: number;
  horizonPeriods?: number;
  confidenceIntervalUpper?: number;
  confidenceIntervalLower?: number;
  height?: number;
  className?: string;
}

const C = {
  bg: '#0b0f17',
  grid: '#1c2333',
  text: '#94a3b8',
  up: '#22c55e',
  down: '#ef4444',
  forecast: '#38bdf8',
  band: 'rgba(56, 189, 248, 0.16)',
  bandLine: 'rgba(56, 189, 248, 0.55)',
} as const;

const MAX_BARS = 512;

function toUtc(time: number | string): UTCTimestamp {
  if (typeof time === 'string') {
    return Math.floor(new Date(time).getTime() / 1000) as UTCTimestamp;
  }
  return (time > 1e11 ? Math.floor(time / 1000) : Math.floor(time)) as UTCTimestamp;
}

function dayOffset(base: UTCTimestamp, days: number): UTCTimestamp {
  return (base + days * 86_400) as UTCTimestamp;
}

function buildCandles(bars: OHLCVBarInput[]): CandlestickData<UTCTimestamp>[] {
  const slice = bars.slice(-MAX_BARS);
  return slice.map((bar) => ({
    time: toUtc(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));
}

export function OHLCVChart({
  bars,
  predictedReturnPct = 1.25,
  horizonPeriods = 5,
  confidenceIntervalUpper = 2.5,
  confidenceIntervalLower = -1.0,
  height = 360,
  className,
}: OHLCVChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const forecastRef = useRef<ISeriesApi<'Line'> | null>(null);
  const upperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const chart = createChart(host, {
      width: host.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: C.grid },
      timeScale: { borderColor: C.grid, timeVisible: true, secondsVisible: false },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderUpColor: C.up,
      borderDownColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
    });

    const forecast = chart.addSeries(LineSeries, {
      color: C.forecast,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const upper = chart.addSeries(LineSeries, {
      color: C.bandLine,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const lower = chart.addSeries(LineSeries, {
      color: C.bandLine,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    forecastRef.current = forecast;
    upperRef.current = upper;
    lowerRef.current = lower;

    const resize = () => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: hostRef.current.clientWidth });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      forecastRef.current = null;
      upperRef.current = null;
      lowerRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || bars.length === 0) return;

    const candleData = buildCandles(bars);
    candleRef.current.setData(candleData);

    const last = candleData[candleData.length - 1];
    if (!last || !forecastRef.current || !upperRef.current || !lowerRef.current) return;

    const lastClose = last.close;
    const targetClose = lastClose * (1 + predictedReturnPct / 100);
    const upperClose = lastClose * (1 + confidenceIntervalUpper / 100);
    const lowerClose = lastClose * (1 + confidenceIntervalLower / 100);

    const forecastLine: LineData<UTCTimestamp>[] = [];
    const upperLine: LineData<UTCTimestamp>[] = [];
    const lowerLine: LineData<UTCTimestamp>[] = [];

    for (let h = 0; h <= horizonPeriods; h += 1) {
      const t = dayOffset(last.time, h);
      const progress = h / Math.max(horizonPeriods, 1);
      const price = lastClose + (targetClose - lastClose) * progress;
      const up = lastClose + (upperClose - lastClose) * progress;
      const lo = lastClose + (lowerClose - lastClose) * progress;
      forecastLine.push({ time: t, value: price });
      upperLine.push({ time: t, value: up });
      lowerLine.push({ time: t, value: lo });
    }

    forecastRef.current.setData(forecastLine);
    upperRef.current.setData(upperLine);
    lowerRef.current.setData(lowerLine);

    chartRef.current?.timeScale().fitContent();
  }, [bars, predictedReturnPct, horizonPeriods, confidenceIntervalUpper, confidenceIntervalLower]);

  return (
    <div
      className={className ?? 'ohlcv-chart-host'}
      data-testid="ohlcv-chart"
      ref={hostRef}
      style={{ height }}
    />
  );
}

/** Dev helper — assert chart host contains canvas, not SVG. */
export function chartUsesCanvasOnly(container: HTMLElement): boolean {
  return container.querySelectorAll('canvas').length > 0 && container.querySelectorAll('svg').length === 0;
}
